/**
 * CarePlanConverter - FHIR CarePlan Resource Converter
 * Extends AbstractFHIRConverter to provide CarePlan-specific conversion logic
 */
import { AbstractFHIRConverter } from './AbstractFHIRConverter';

// FHIR Value Sets for CarePlan
export const CAREPLAN_STATUS_OPTIONS = [
  { value: 'draft', display: 'Draft' },
  { value: 'active', display: 'Active' },
  { value: 'on-hold', display: 'On Hold' },
  { value: 'revoked', display: 'Revoked' },
  { value: 'completed', display: 'Completed' },
  { value: 'entered-in-error', display: 'Entered in Error' },
  { value: 'unknown', display: 'Unknown' }
];

export const CAREPLAN_INTENT_OPTIONS = [
  { value: 'proposal', display: 'Proposal' },
  { value: 'plan', display: 'Plan' },
  { value: 'order', display: 'Order' },
  { value: 'option', display: 'Option' }
];

export const CAREPLAN_CATEGORIES = [
  { value: 'assess-plan', display: 'Assessment and Plan', description: 'Overall assessment and care plan' },
  { value: 'careteam', display: 'Care Team', description: 'Care team coordination plan' },
  { value: 'diet', display: 'Diet', description: 'Dietary and nutrition care plan' },
  { value: 'drug', display: 'Drug', description: 'Medication management plan' },
  { value: 'encounter', display: 'Encounter', description: 'Encounter-specific care plan' },
  { value: 'episodeofcare', display: 'Episode of Care', description: 'Episode-based care plan' },
  { value: 'investigation', display: 'Investigation', description: 'Diagnostic investigation plan' },
  { value: 'procedure', display: 'Procedure', description: 'Procedure-specific care plan' },
  { value: 'referral', display: 'Referral', description: 'Referral coordination plan' },
  { value: 'rehabilitation', display: 'Rehabilitation', description: 'Rehabilitation care plan' },
  { value: 'treatment', display: 'Treatment', description: 'Treatment management plan' }
];

export const ACTIVITY_STATUS_OPTIONS = [
  { value: 'not-started', display: 'Not Started' },
  { value: 'scheduled', display: 'Scheduled' },
  { value: 'in-progress', display: 'In Progress' },
  { value: 'on-hold', display: 'On Hold' },
  { value: 'completed', display: 'Completed' },
  { value: 'cancelled', display: 'Cancelled' },
  { value: 'stopped', display: 'Stopped' },
  { value: 'unknown', display: 'Unknown' },
  { value: 'entered-in-error', display: 'Entered in Error' }
];

export const ACTIVITY_CATEGORIES = [
  { value: 'diet', display: 'Diet', description: 'Dietary and nutrition activities' },
  { value: 'drug', display: 'Drug', description: 'Medication-related activities' },
  { value: 'encounter', display: 'Encounter', description: 'Scheduled encounters and visits' },
  { value: 'observation', display: 'Observation', description: 'Monitoring and observation activities' },
  { value: 'procedure', display: 'Procedure', description: 'Scheduled procedures' },
  { value: 'supply', display: 'Supply', description: 'Equipment and supply provision' },
  { value: 'other', display: 'Other', description: 'Other care activities' }
];

// Common SNOMED CT codes for care plan activities
export const COMMON_ACTIVITY_CODES = [
  { code: '182840001', display: 'Drug compliance good', category: 'drug' },
  { code: '408289007', display: 'Refer to weight management program', category: 'diet' },
  { code: '229065009', display: 'Exercise therapy', category: 'other' },
  { code: '386053000', display: 'Evaluation procedure', category: 'observation' },
  { code: '418995006', display: 'Feeding and dietary management', category: 'diet' },
  { code: '385763009', display: 'Smoking cessation education', category: 'other' },
  { code: '183057004', display: 'Patient education about disease', category: 'other' },
  { code: '225323000', display: 'Smoking cessation therapy', category: 'drug' },
  { code: '370847001', display: 'Dietary needs education', category: 'diet' }
];

export class CarePlanConverter extends AbstractFHIRConverter {
  constructor() {
    super('CarePlan', {
      generateId: true,
      validateRequired: true,
      preserveMeta: true
    });
  }

  /**
   * Get initial form values for new care plan
   * @returns {Object} Initial form values
   */
  getInitialValues() {
    return {
      title: '',
      description: '',
      status: 'active',
      intent: 'plan',
      category: 'assess-plan',
      period: {
        start: new Date(),
        end: null
      },
      careTeam: [], // Array of care team member references
      addresses: [], // Array of condition references this plan addresses
      goals: [], // Array of goal references
      activities: [], // Array of planned activities
      notes: ''
    };
  }

  /**
   * Parse FHIR CarePlan resource to form data
   * @param {Object} carePlan - FHIR CarePlan resource
   * @returns {Object} Form data
   */
  _parseResourceToForm(carePlan) {
    // Extract basic fields
    const status = this.safeString(carePlan.status, 'active');
    const intent = this.safeString(carePlan.intent, 'plan');
    const title = this.safeString(carePlan.title, '');
    const description = this.safeString(carePlan.description, '');
    
    // Extract category
    const category = this.extractCoding(carePlan.category?.[0], 'assess-plan');
    
    // Extract period
    const period = {
      start: this.parseDate(carePlan.period?.start) || new Date(),
      end: this.parseDate(carePlan.period?.end)
    };
    
    // Extract care team references
    const careTeam = carePlan.careTeam?.map(ref => this.extractReferenceId(ref)).filter(Boolean) || [];
    
    // Extract addresses (conditions this plan addresses)
    const addresses = carePlan.addresses?.map(ref => this.extractReferenceId(ref)).filter(Boolean) || [];
    
    // Extract goal references
    const goals = carePlan.goal?.map(ref => this.extractReferenceId(ref)).filter(Boolean) || [];
    
    // Extract activities
    const activities = carePlan.activity?.map(activity => {
      const detail = activity.detail;
      if (!detail) return null;
      
      return {
        id: detail.id || `activity-${Math.random().toString(36).substr(2, 9)}`,
        description: this.safeString(detail.description, ''),
        status: this.safeString(detail.status, 'not-started'),
        category: this.extractCoding(detail.category, 'other'),
        code: detail.code ? {
          code: this.extractCoding(detail.code, ''),
          display: this.extractDisplay(detail.code, ''),
          system: detail.code.coding?.[0]?.system || 'http://snomed.info/sct'
        } : null,
        scheduledPeriod: {
          start: this.parseDate(detail.scheduledPeriod?.start),
          end: this.parseDate(detail.scheduledPeriod?.end)
        },
        location: this.extractReferenceId(detail.location),
        performer: detail.performer?.map(ref => this.extractReferenceId(ref)).filter(Boolean) || []
      };
    }).filter(Boolean) || [];
    
    // Extract notes
    const notes = this.extractNotes(carePlan.note);

    return {
      title,
      description,
      status,
      intent,
      category,
      period,
      careTeam,
      addresses,
      goals,
      activities,
      notes
    };
  }

  /**
   * Create FHIR CarePlan resource from form data
   * @param {Object} formData - Form data
   * @param {Object} context - Additional context (patientId, etc.)
   * @returns {Object} FHIR resource fields
   */
  _createResourceFromForm(formData, context = {}) {
    const resource = {
      status: formData.status,
      intent: formData.intent,
      category: [{
        coding: [{
          system: 'http://hl7.org/fhir/us/core/CodeSystem/careplan-category',
          code: formData.category,
          display: CAREPLAN_CATEGORIES.find(c => c.value === formData.category)?.display
        }]
      }],
      title: formData.title,
      description: formData.description,
      period: {
        start: this.createDateString(formData.period.start)
      }
    };

    // Add end date if specified
    if (formData.period.end) {
      resource.period.end = this.createDateString(formData.period.end);
    }

    // Add care team references
    if (formData.careTeam && formData.careTeam.length > 0) {
      resource.careTeam = formData.careTeam.map(teamId => ({
        reference: `CareTeam/${teamId}`
      }));
    }

    // Add addresses (conditions this plan addresses)
    if (formData.addresses && formData.addresses.length > 0) {
      resource.addresses = formData.addresses.map(conditionId => ({
        reference: `Condition/${conditionId}`
      }));
    }

    // Add goal references
    if (formData.goals && formData.goals.length > 0) {
      resource.goal = formData.goals.map(goalId => ({
        reference: `Goal/${goalId}`
      }));
    }

    // Add activities
    if (formData.activities && formData.activities.length > 0) {
      resource.activity = formData.activities.map(activity => ({
        detail: {
          description: activity.description,
          status: activity.status,
          category: {
            coding: [{
              system: 'http://hl7.org/fhir/care-plan-activity-category',
              code: activity.category,
              display: ACTIVITY_CATEGORIES.find(c => c.value === activity.category)?.display
            }]
          },
          ...(activity.code && {
            code: {
              coding: [{
                system: activity.code.system || 'http://snomed.info/sct',
                code: activity.code.code,
                display: activity.code.display
              }],
              text: activity.code.display
            }
          }),
          ...(activity.scheduledPeriod.start && {
            scheduledPeriod: {
              start: this.createDateString(activity.scheduledPeriod.start),
              ...(activity.scheduledPeriod.end && {
                end: this.createDateString(activity.scheduledPeriod.end)
              })
            }
          }),
          ...(activity.location && {
            location: {
              reference: `Location/${activity.location}`
            }
          }),
          ...(activity.performer && activity.performer.length > 0 && {
            performer: activity.performer.map(performerId => ({
              reference: `Practitioner/${performerId}`
            }))
          })
        }
      }));
    }

    // Add notes if provided
    if (formData.notes) {
      resource.note = this.createNotes(formData.notes);
    }

    return resource;
  }

  /**
   * Validate required fields for care plan
   * @param {Object} formData - Form data to validate
   * @throws {Error} If validation fails
   */
  _validateRequiredFields(formData) {
    if (!formData.title || formData.title.trim() === '') {
      throw new Error('Care plan title is required');
    }

    if (!formData.status) {
      throw new Error('Status is required');
    }

    if (!formData.intent) {
      throw new Error('Intent is required');
    }

    if (!formData.category) {
      throw new Error('Category is required');
    }

    if (!formData.period || !formData.period.start) {
      throw new Error('Start date is required');
    }

    // Validate activities
    if (formData.activities && formData.activities.length > 0) {
      formData.activities.forEach((activity, index) => {
        if (!activity.description || activity.description.trim() === '') {
          throw new Error(`Activity ${index + 1}: Description is required`);
        }
        
        if (!activity.status) {
          throw new Error(`Activity ${index + 1}: Status is required`);
        }
        
        if (!activity.category) {
          throw new Error(`Activity ${index + 1}: Category is required`);
        }
      });
    }
  }

  /**
   * Post-process the care plan resource
   * @param {Object} resource - The resource
   * @param {string} operation - 'create' or 'update'
   * @param {Object} formData - Original form data
   * @param {Object} context - Additional context
   * @returns {Object} Processed resource
   */
  _postProcessResource(resource, operation, formData, context) {
    // Ensure dates are properly formatted
    if (resource.period?.start && typeof resource.period.start !== 'string') {
      resource.period.start = new Date(resource.period.start).toISOString().split('T')[0];
    }

    if (resource.period?.end && typeof resource.period.end !== 'string') {
      resource.period.end = new Date(resource.period.end).toISOString().split('T')[0];
    }

    // Process activity dates
    if (resource.activity) {
      resource.activity.forEach(activity => {
        if (activity.detail?.scheduledPeriod?.start && typeof activity.detail.scheduledPeriod.start !== 'string') {
          activity.detail.scheduledPeriod.start = new Date(activity.detail.scheduledPeriod.start).toISOString().split('T')[0];
        }
        
        if (activity.detail?.scheduledPeriod?.end && typeof activity.detail.scheduledPeriod.end !== 'string') {
          activity.detail.scheduledPeriod.end = new Date(activity.detail.scheduledPeriod.end).toISOString().split('T')[0];
        }
      });
    }

    // Ensure category is an array
    if (resource.category && !Array.isArray(resource.category)) {
      resource.category = [resource.category];
    }

    return resource;
  }
}

// Helper functions that can be used by the dialog config
export const getStatusColor = (status) => {
  switch (status?.toLowerCase()) {
    case 'active':
      return 'success';
    case 'draft':
      return 'info';
    case 'on-hold':
      return 'warning';
    case 'completed':
      return 'success';
    case 'revoked':
    case 'entered-in-error':
      return 'error';
    default:
      return 'default';
  }
};

export const getActivityStatusColor = (status) => {
  switch (status?.toLowerCase()) {
    case 'completed':
      return 'success';
    case 'in-progress':
    case 'scheduled':
      return 'info';
    case 'not-started':
      return 'warning';
    case 'on-hold':
      return 'warning';
    case 'cancelled':
    case 'stopped':
    case 'entered-in-error':
      return 'error';
    default:
      return 'default';
  }
};

export const getIntentColor = (intent) => {
  switch (intent?.toLowerCase()) {
    case 'order':
      return 'error';
    case 'plan':
      return 'success';
    case 'proposal':
      return 'info';
    case 'option':
      return 'warning';
    default:
      return 'default';
  }
};

export const getCarePlanDisplay = (formData) => {
  return formData.title || 'Untitled Care Plan';
};

// Export singleton instance for use in dialog configs
export const carePlanConverter = new CarePlanConverter();