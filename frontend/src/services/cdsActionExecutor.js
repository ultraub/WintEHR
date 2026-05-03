/**
 * CDS Action Executor Service
 *
 * Handles execution of CDS suggestion actions (create, update, delete FHIR
 * resources) on the **client side**. This is a parallel implementation to
 * the backend executor at
 * `backend/api/cds_hooks/actions/executor.py::_execute_create_action`.
 * Both must agree on which fields get auto-injected from the hook context
 * (subject, requester, encounter) so the wizard can produce the same
 * `actions[].resource` shape and have it work through either path.
 *
 * Resource types that require a subject (MedicationRequest, ServiceRequest,
 * Observation, Condition, AllergyIntolerance, CarePlan, Goal, Task) get
 * `subject` auto-filled here when the caller passes a `patientId` in the
 * execution context, exactly mirroring the backend's behavior.
 */
import { fhirClient } from '../core/fhir/services/fhirClient';
import { cdsLogger } from '../config/logging';
import { cdsFeedbackService } from './cdsFeedbackService';

// Resource types that the runtime auto-fills `subject` on when missing.
// Source: backend/api/cds_hooks/actions/executor.py:_execute_create_action.
const SUBJECT_REQUIRED_TYPES = new Set([
  'MedicationRequest', 'ServiceRequest', 'Observation', 'Condition',
  'AllergyIntolerance', 'CarePlan', 'Goal', 'Task'
]);

// Resource types that get `requester` auto-filled (subset of above).
const REQUESTER_REQUIRED_TYPES = new Set([
  'MedicationRequest', 'ServiceRequest', 'Task'
]);

class CDSActionExecutor {
  constructor() {
    this.actionHandlers = {
      'create': this.handleCreateAction.bind(this),
      'update': this.handleUpdateAction.bind(this),
      'delete': this.handleDeleteAction.bind(this)
    };
  }

  /**
   * Execute a CDS suggestion
   * @param {Object} alert - CDS alert/card
   * @param {Object} suggestion - Suggestion to execute
   * @param {Object} [context] - Hook context. Pass at least `patientId` so
   *   subject/requester/encounter can be auto-injected before validation.
   *   Without this, resources whose type requires a subject (Condition,
   *   ServiceRequest, MedicationRequest, etc.) will fail validation —
   *   the wizard generates them without a subject by design, expecting
   *   the executor to fill it in from context.
   * @param {string} [context.patientId] - FHIR Patient ID
   * @param {string} [context.userId] - FHIR Practitioner ID (for requester)
   * @param {string} [context.encounterId] - FHIR Encounter ID
   * @returns {Promise<Object>} Execution result
   */
  async executeSuggestion(alert, suggestion, context = {}) {
    try {
      cdsLogger.info('Executing CDS suggestion', {
        alertId: alert.uuid,
        suggestionId: suggestion.uuid,
        suggestionLabel: suggestion.label
      });

      const results = {
        success: true,
        executedActions: [],
        failedActions: [],
        createdResources: [],
        updatedResources: [],
        deletedResources: []
      };

      // Process actions in the suggestion
      if (suggestion.actions && Array.isArray(suggestion.actions)) {
        for (const action of suggestion.actions) {
          const actionResult = await this.executeAction(action, context);
          
          if (actionResult.success) {
            results.executedActions.push(actionResult);
            
            // Track created/updated/deleted resources
            if (action.type === 'create' && actionResult.resourceId) {
              results.createdResources.push({
                resourceType: actionResult.resourceType,
                id: actionResult.resourceId
              });
            } else if (action.type === 'update' && actionResult.resourceId) {
              results.updatedResources.push({
                resourceType: actionResult.resourceType,
                id: actionResult.resourceId
              });
            } else if (action.type === 'delete' && actionResult.resourceId) {
              results.deletedResources.push({
                resourceType: actionResult.resourceType,
                id: actionResult.resourceId
              });
            }
          } else {
            results.failedActions.push(actionResult);
            results.success = false;
          }
        }
      }

      // Send feedback about the execution
      if (alert.serviceId && alert.uuid && suggestion.uuid) {
        await cdsFeedbackService.sendAcceptanceFeedback(
          alert.serviceId,
          alert.uuid,
          [suggestion.uuid]
        );
      }

      cdsLogger.info('CDS suggestion execution completed', results);
      return results;

    } catch (error) {
      cdsLogger.error('Failed to execute CDS suggestion', {
        alertId: alert.uuid,
        suggestionId: suggestion.uuid,
        error: error.message
      });
      
      throw error;
    }
  }

  /**
   * Execute a single action
   * @param {Object} action - Action to execute
   * @param {Object} [context] - Hook context for subject/requester/encounter
   *   injection. See `executeSuggestion` for the shape.
   * @returns {Promise<Object>} Action result
   */
  async executeAction(action, context = {}) {
    try {
      const { type, description, resource } = action;

      if (!type) {
        throw new Error('Action type is required');
      }

      const handler = this.actionHandlers[type.toLowerCase()];
      if (!handler) {
        throw new Error(`Unknown action type: ${type}`);
      }

      const result = await handler(resource, description, context);
      
      return {
        success: true,
        type,
        description,
        ...result
      };

    } catch (error) {
      cdsLogger.error('Failed to execute action', {
        action,
        error: error.message
      });

      return {
        success: false,
        type: action.type,
        description: action.description,
        error: error.message
      };
    }
  }

  /**
   * Inject subject/requester/encounter from the hook context into a
   * partial resource before validation, mirroring the backend executor
   * (`_execute_create_action` in actions/executor.py). Returns a new
   * resource — does not mutate the input.
   */
  _injectContext(resource, context = {}) {
    if (!resource || !resource.resourceType) return resource;
    const { patientId, userId, encounterId } = context;
    const result = { ...resource };

    if (patientId
        && SUBJECT_REQUIRED_TYPES.has(result.resourceType)
        && !result.subject) {
      result.subject = { reference: `Patient/${patientId}` };
    }
    if (userId
        && REQUESTER_REQUIRED_TYPES.has(result.resourceType)
        && !result.requester) {
      result.requester = { reference: `Practitioner/${userId}` };
    }
    if (encounterId && !result.encounter) {
      result.encounter = { reference: `Encounter/${encounterId}` };
    }
    return result;
  }

  /**
   * Handle create action
   * @param {Object} resource - FHIR resource to create
   * @param {string} description - Action description
   * @param {Object} [context] - Hook context for subject/requester/encounter
   * @returns {Promise<Object>} Creation result
   */
  async handleCreateAction(resource, description, context = {}) {
    if (!resource || !resource.resourceType) {
      throw new Error('Invalid resource for create action');
    }

    const enriched = this._injectContext(resource, context);

    // Validate resource (with injected context) before creation
    this.validateResource(enriched);

    // Create the resource. fhirClient.create takes (resourceType, body)
    // — the previous single-arg form sent the resource type as
    // [object Object] in the URL and HAPI returned 400.
    const createdResource = await fhirClient.create(enriched.resourceType, enriched);

    cdsLogger.info('Created FHIR resource', {
      resourceType: enriched.resourceType,
      id: createdResource.id,
      description
    });

    return {
      resourceType: enriched.resourceType,
      resourceId: createdResource.id,
      resource: createdResource
    };
  }

  /**
   * Handle update action
   * @param {Object} resource - FHIR resource to update
   * @param {string} description - Action description
   * @param {Object} [context] - Hook context (typically not needed for
   *   updates since the resource already has subject etc., but accepted
   *   for symmetry with create)
   * @returns {Promise<Object>} Update result
   */
  async handleUpdateAction(resource, description, context = {}) {
    if (!resource || !resource.resourceType || !resource.id) {
      throw new Error('Invalid resource for update action - must include resourceType and id');
    }

    const enriched = this._injectContext(resource, context);

    // Validate resource (with injected context) before update
    this.validateResource(enriched);

    // fhirClient.update takes (resourceType, id, body); same shape mismatch
    // as create that we fix here for symmetry.
    const updatedResource = await fhirClient.update(enriched.resourceType, enriched.id, enriched);

    cdsLogger.info('Updated FHIR resource', {
      resourceType: enriched.resourceType,
      id: enriched.id,
      description
    });

    return {
      resourceType: enriched.resourceType,
      resourceId: enriched.id,
      resource: updatedResource
    };
  }

  /**
   * Handle delete action
   * @param {Object} resource - Resource reference to delete
   * @param {string} description - Action description
   * @returns {Promise<Object>} Deletion result
   */
  async handleDeleteAction(resource, description) {
    if (!resource || !resource.resourceType || !resource.id) {
      throw new Error('Invalid resource for delete action - must include resourceType and id');
    }

    // Delete the resource
    await fhirClient.delete(resource.resourceType, resource.id);

    cdsLogger.info('Deleted FHIR resource', {
      resourceType: resource.resourceType,
      id: resource.id,
      description
    });

    return {
      resourceType: resource.resourceType,
      resourceId: resource.id
    };
  }

  /**
   * Validate a FHIR resource before creation/update
   * @param {Object} resource - Resource to validate
   * @throws {Error} If resource is invalid
   */
  validateResource(resource) {
    // Basic validation
    if (!resource.resourceType) {
      throw new Error('Resource must have a resourceType');
    }

    // Resource-specific validation
    switch (resource.resourceType) {
      case 'Appointment':
        this.validateAppointment(resource);
        break;
      case 'ServiceRequest':
        this.validateServiceRequest(resource);
        break;
      case 'MedicationRequest':
        this.validateMedicationRequest(resource);
        break;
      case 'CarePlan':
        this.validateCarePlan(resource);
        break;
      case 'Task':
        this.validateTask(resource);
        break;
      default:
        // Generic validation for other resource types
        cdsLogger.warn(`No specific validation for resource type: ${resource.resourceType}`);
    }
  }

  /**
   * Validate Appointment resource
   */
  validateAppointment(resource) {
    if (!resource.status) {
      throw new Error('Appointment must have a status');
    }
    if (!resource.participant || !Array.isArray(resource.participant) || resource.participant.length === 0) {
      throw new Error('Appointment must have at least one participant');
    }
  }

  /**
   * Validate ServiceRequest resource
   */
  validateServiceRequest(resource) {
    if (!resource.status) {
      throw new Error('ServiceRequest must have a status');
    }
    if (!resource.intent) {
      throw new Error('ServiceRequest must have an intent');
    }
    if (!resource.subject) {
      throw new Error('ServiceRequest must have a subject (patient)');
    }
  }

  /**
   * Validate MedicationRequest resource
   */
  validateMedicationRequest(resource) {
    if (!resource.status) {
      throw new Error('MedicationRequest must have a status');
    }
    if (!resource.intent) {
      throw new Error('MedicationRequest must have an intent');
    }
    if (!resource.subject) {
      throw new Error('MedicationRequest must have a subject (patient)');
    }
    if (!resource.medicationCodeableConcept && !resource.medicationReference) {
      throw new Error('MedicationRequest must have either medicationCodeableConcept or medicationReference');
    }
  }

  /**
   * Validate CarePlan resource
   */
  validateCarePlan(resource) {
    if (!resource.status) {
      throw new Error('CarePlan must have a status');
    }
    if (!resource.intent) {
      throw new Error('CarePlan must have an intent');
    }
    if (!resource.subject) {
      throw new Error('CarePlan must have a subject (patient)');
    }
  }

  /**
   * Validate Task resource
   */
  validateTask(resource) {
    if (!resource.status) {
      throw new Error('Task must have a status');
    }
    if (!resource.intent) {
      throw new Error('Task must have an intent');
    }
  }

  /**
   * Dry run a suggestion to preview what would happen
   * @param {Object} suggestion - Suggestion to dry run
   * @param {Object} [context] - Hook context, same shape as
   *   `executeSuggestion`. Forwarded to `_injectContext` so the dry-run
   *   validation matches what the live execute path would see.
   * @returns {Object} Dry run result
   */
  async dryRunSuggestion(suggestion, context = {}) {
    const result = {
      wouldCreate: [],
      wouldUpdate: [],
      wouldDelete: [],
      validationErrors: []
    };

    if (suggestion.actions && Array.isArray(suggestion.actions)) {
      for (const action of suggestion.actions) {
        try {
          if (action.resource) {
            const enriched = this._injectContext(action.resource, context);
            this.validateResource(enriched);
          }

          switch (action.type) {
            case 'create':
              result.wouldCreate.push({
                resourceType: action.resource?.resourceType,
                description: action.description
              });
              break;
            case 'update':
              result.wouldUpdate.push({
                resourceType: action.resource?.resourceType,
                id: action.resource?.id,
                description: action.description
              });
              break;
            case 'delete':
              result.wouldDelete.push({
                resourceType: action.resource?.resourceType,
                id: action.resource?.id,
                description: action.description
              });
              break;
          }
        } catch (error) {
          result.validationErrors.push({
            action: action.description,
            error: error.message
          });
        }
      }
    }

    return result;
  }
}

// Export singleton instance
export const cdsActionExecutor = new CDSActionExecutor();

// Also export class for testing
export default CDSActionExecutor;