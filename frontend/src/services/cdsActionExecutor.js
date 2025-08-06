/**
 * CDS Action Executor Service
 * Handles execution of CDS suggestion actions (create, update, delete FHIR resources)
 */
import { fhirClient } from '../core/fhir/services/fhirClient';
import { cdsLogger } from '../config/logging';
import { cdsFeedbackService } from './cdsFeedbackService';

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
   * @returns {Promise<Object>} Execution result
   */
  async executeSuggestion(alert, suggestion) {
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
          const actionResult = await this.executeAction(action);
          
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
   * @returns {Promise<Object>} Action result
   */
  async executeAction(action) {
    try {
      const { type, description, resource } = action;
      
      if (!type) {
        throw new Error('Action type is required');
      }

      const handler = this.actionHandlers[type.toLowerCase()];
      if (!handler) {
        throw new Error(`Unknown action type: ${type}`);
      }

      const result = await handler(resource, description);
      
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
   * Handle create action
   * @param {Object} resource - FHIR resource to create
   * @param {string} description - Action description
   * @returns {Promise<Object>} Creation result
   */
  async handleCreateAction(resource, description) {
    if (!resource || !resource.resourceType) {
      throw new Error('Invalid resource for create action');
    }

    // Validate resource before creation
    this.validateResource(resource);

    // Create the resource
    const createdResource = await fhirClient.create(resource);

    cdsLogger.info('Created FHIR resource', {
      resourceType: resource.resourceType,
      id: createdResource.id,
      description
    });

    return {
      resourceType: resource.resourceType,
      resourceId: createdResource.id,
      resource: createdResource
    };
  }

  /**
   * Handle update action
   * @param {Object} resource - FHIR resource to update
   * @param {string} description - Action description
   * @returns {Promise<Object>} Update result
   */
  async handleUpdateAction(resource, description) {
    if (!resource || !resource.resourceType || !resource.id) {
      throw new Error('Invalid resource for update action - must include resourceType and id');
    }

    // Validate resource before update
    this.validateResource(resource);

    // Update the resource
    const updatedResource = await fhirClient.update(resource);

    cdsLogger.info('Updated FHIR resource', {
      resourceType: resource.resourceType,
      id: resource.id,
      description
    });

    return {
      resourceType: resource.resourceType,
      resourceId: resource.id,
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
   * @returns {Object} Dry run result
   */
  async dryRunSuggestion(suggestion) {
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
            this.validateResource(action.resource);
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