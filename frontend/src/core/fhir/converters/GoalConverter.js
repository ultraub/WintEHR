/**
 * GoalConverter - FHIR Goal Resource Converter
 * Extends AbstractFHIRConverter to provide Goal-specific conversion logic
 */
import { AbstractFHIRConverter } from './AbstractFHIRConverter';

// FHIR Value Sets for Goal (moved from existing implementations)
export const GOAL_LIFECYCLE_STATUS_OPTIONS = [
  { value: 'proposed', display: 'Proposed' },
  { value: 'planned', display: 'Planned' },
  { value: 'accepted', display: 'Accepted' },
  { value: 'active', display: 'Active' },
  { value: 'on-hold', display: 'On Hold' },
  { value: 'completed', display: 'Completed' },
  { value: 'cancelled', display: 'Cancelled' },
  { value: 'entered-in-error', display: 'Entered in Error' },
  { value: 'rejected', display: 'Rejected' }
];

export const GOAL_ACHIEVEMENT_STATUS_OPTIONS = [
  { value: 'in-progress', display: 'In Progress' },
  { value: 'improving', display: 'Improving' },
  { value: 'worsening', display: 'Worsening' },
  { value: 'no-change', display: 'No Change' },
  { value: 'achieved', display: 'Achieved' },
  { value: 'sustaining', display: 'Sustaining' },
  { value: 'not-achieved', display: 'Not Achieved' },
  { value: 'no-progress', display: 'No Progress' },
  { value: 'not-attainable', display: 'Not Attainable' }
];

export const GOAL_PRIORITY_OPTIONS = [
  { value: 'high-priority', display: 'High Priority' },
  { value: 'medium-priority', display: 'Medium Priority' },
  { value: 'low-priority', display: 'Low Priority' }
];

export const GOAL_CATEGORIES = [
  { value: 'dietary', display: 'Dietary', description: 'Nutrition and diet-related goals' },
  { value: 'safety', display: 'Safety', description: 'Safety and fall prevention goals' },
  { value: 'behavioral', display: 'Behavioral', description: 'Behavior modification goals' },
  { value: 'nursing', display: 'Nursing', description: 'Nursing care goals' },
  { value: 'physiotherapy', display: 'Physiotherapy', description: 'Physical therapy goals' },
  { value: 'health-maintenance', display: 'Health Maintenance', description: 'General health maintenance' },
  { value: 'exercise', display: 'Exercise', description: 'Physical activity and exercise' },
  { value: 'medical', display: 'Medical', description: 'Medical treatment goals' },
  { value: 'medication', display: 'Medication', description: 'Medication adherence goals' },
  { value: 'social', display: 'Social', description: 'Social and lifestyle goals' }
];

// Common SNOMED CT codes for goal descriptions
export const COMMON_GOAL_CODES = [
  { code: '182840001', display: 'Drug compliance good', category: 'medication' },
  { code: '182849000', display: 'Drug compliance poor', category: 'medication' },
  { code: '408289007', display: 'Refer to weight management program', category: 'health-maintenance' },
  { code: '229065009', display: 'Exercise therapy', category: 'exercise' },
  { code: '386053000', display: 'Evaluation procedure', category: 'medical' },
  { code: '418995006', display: 'Feeding and dietary management', category: 'dietary' },
  { code: '385763009', display: 'Smoking cessation education', category: 'behavioral' },
  { code: '183057004', display: 'Patient education about disease', category: 'health-maintenance' },
  { code: '225323000', display: 'Smoking cessation therapy', category: 'behavioral' },
  { code: '370847001', display: 'Dietary needs education', category: 'dietary' }
];

// Common units for goal measurements
export const GOAL_MEASUREMENT_UNITS = [
  { value: 'kg', display: 'kilograms', category: 'weight' },
  { value: 'lb', display: 'pounds', category: 'weight' },
  { value: 'mmHg', display: 'mmHg', category: 'blood-pressure' },
  { value: 'mg/dL', display: 'mg/dL', category: 'laboratory' },
  { value: 'mmol/L', display: 'mmol/L', category: 'laboratory' },
  { value: '%', display: 'percent', category: 'general' },
  { value: 'bpm', display: 'beats per minute', category: 'vitals' },
  { value: 'steps', display: 'steps', category: 'exercise' },
  { value: 'minutes', display: 'minutes', category: 'time' },
  { value: 'hours', display: 'hours', category: 'time' },
  { value: 'days', display: 'days', category: 'time' }
];

export class GoalConverter extends AbstractFHIRConverter {
  constructor() {
    super('Goal', {
      generateId: true,
      validateRequired: true,
      preserveMeta: true
    });
  }

  /**
   * Get initial form values for new goal
   * @returns {Object} Initial form values
   */
  getInitialValues() {
    return {
      description: '',
      selectedGoalCode: null,
      category: 'health-maintenance',
      priority: 'medium-priority',
      lifecycleStatus: 'active',
      achievementStatus: 'in-progress',
      startDate: new Date(),
      targetDate: null,
      targetMeasure: {
        hasTarget: false,
        valueQuantity: '',
        unit: '',
        comparison: 'greater-than'
      },
      notes: '',
      addresses: [] // Array of condition references this goal addresses
    };
  }

  /**
   * Parse FHIR Goal resource to form data
   * @param {Object} goal - FHIR Goal resource
   * @returns {Object} Form data
   */
  _parseResourceToForm(goal) {
    // Extract basic status fields
    const lifecycleStatus = this.extractCoding(goal.lifecycleStatus, 'active');
    const achievementStatus = this.extractCoding(goal.achievementStatus, 'in-progress');
    const priority = this.extractCoding(goal.priority, 'medium-priority');
    
    // Extract category
    const category = this.extractCoding(goal.category?.[0], 'health-maintenance');
    
    // Extract dates
    const startDate = this.parseDate(goal.startDate) || new Date();
    const targetDate = this.parseDate(goal.target?.[0]?.dueDate);
    
    // Extract description
    const description = this.extractDisplay(goal.description, '');
    
    // Extract goal code if available
    let selectedGoalCode = null;
    if (goal.description?.coding?.[0]) {
      const coding = goal.description.coding[0];
      selectedGoalCode = {
        code: coding.code,
        display: coding.display || goal.description.text,
        system: coding.system || 'http://snomed.info/sct',
        source: 'existing'
      };
    }
    
    // Extract target measures
    const target = goal.target?.[0];
    let targetMeasure = {
      hasTarget: false,
      valueQuantity: '',
      unit: '',
      comparison: 'greater-than'
    };
    
    if (target) {
      targetMeasure.hasTarget = true;
      
      if (target.detailQuantity) {
        targetMeasure.valueQuantity = target.detailQuantity.value?.toString() || '';
        targetMeasure.unit = target.detailQuantity.unit || '';
      }
      
      if (target.detailRange) {
        // For ranges, use the high value as the target
        targetMeasure.valueQuantity = target.detailRange.high?.value?.toString() || '';
        targetMeasure.unit = target.detailRange.high?.unit || '';
      }
      
      // Extract comparison operator
      if (target.detailRange) {
        targetMeasure.comparison = 'range';
      } else {
        targetMeasure.comparison = 'greater-than'; // Default assumption
      }
    }
    
    // Extract addresses (conditions this goal addresses)
    const addresses = goal.addresses?.map(ref => this.extractReferenceId(ref)).filter(Boolean) || [];
    
    // Extract notes
    const notes = this.extractNotes(goal.note);

    return {
      description: this.safeString(description, ''),
      selectedGoalCode,
      category: this.safeString(category, 'health-maintenance'),
      priority: this.safeString(priority, 'medium-priority'),
      lifecycleStatus: this.safeString(lifecycleStatus, 'active'),
      achievementStatus: this.safeString(achievementStatus, 'in-progress'),
      startDate,
      targetDate,
      targetMeasure,
      notes,
      addresses
    };
  }

  /**
   * Create FHIR Goal resource from form data
   * @param {Object} formData - Form data
   * @param {Object} context - Additional context (patientId, etc.)
   * @returns {Object} FHIR resource fields
   */
  _createResourceFromForm(formData, context = {}) {
    const resource = {
      lifecycleStatus: formData.lifecycleStatus,
      achievementStatus: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/goal-achievement',
          code: formData.achievementStatus,
          display: GOAL_ACHIEVEMENT_STATUS_OPTIONS.find(s => s.value === formData.achievementStatus)?.display
        }]
      },
      priority: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/goal-priority',
          code: formData.priority,
          display: GOAL_PRIORITY_OPTIONS.find(p => p.value === formData.priority)?.display
        }]
      },
      category: [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/goal-category',
          code: formData.category,
          display: GOAL_CATEGORIES.find(c => c.value === formData.category)?.display
        }]
      }],
      startDate: this.createDateString(formData.startDate)
    };

    // Add description
    if (formData.selectedGoalCode) {
      resource.description = this.createCodeableConcept(formData.selectedGoalCode);
    } else if (formData.description) {
      resource.description = { text: formData.description };
    }

    // Add target measures if specified
    if (formData.targetMeasure?.hasTarget && formData.targetMeasure.valueQuantity) {
      const target = {
        measure: {
          coding: [{
            system: 'http://loinc.org',
            code: '72133-2', // Generic "Goal" code
            display: 'Goal'
          }]
        }
      };

      // Add target date if specified
      if (formData.targetDate) {
        target.dueDate = this.createDateString(formData.targetDate);
      }

      // Add target value
      const value = parseFloat(formData.targetMeasure.valueQuantity);
      if (!isNaN(value)) {
        if (formData.targetMeasure.comparison === 'range') {
          target.detailRange = {
            low: { value: value * 0.9, unit: formData.targetMeasure.unit },
            high: { value: value * 1.1, unit: formData.targetMeasure.unit }
          };
        } else {
          target.detailQuantity = {
            value: value,
            unit: formData.targetMeasure.unit,
            system: 'http://unitsofmeasure.org'
          };
        }
      }

      resource.target = [target];
    }

    // Add addresses (conditions this goal addresses)
    if (formData.addresses && formData.addresses.length > 0) {
      resource.addresses = formData.addresses.map(conditionId => ({
        reference: `Condition/${conditionId}`
      }));
    }

    // Add notes if provided
    if (formData.notes) {
      resource.note = this.createNotes(formData.notes);
    }

    return resource;
  }

  /**
   * Validate required fields for goal
   * @param {Object} formData - Form data to validate
   * @throws {Error} If validation fails
   */
  _validateRequiredFields(formData) {
    if (!formData.description && !formData.selectedGoalCode) {
      throw new Error('Please provide a goal description or select from the list');
    }

    if (!formData.lifecycleStatus) {
      throw new Error('Lifecycle status is required');
    }

    if (!formData.achievementStatus) {
      throw new Error('Achievement status is required');
    }

    if (!formData.category) {
      throw new Error('Category is required');
    }

    if (!formData.priority) {
      throw new Error('Priority is required');
    }

    // Validate target measure if specified
    if (formData.targetMeasure?.hasTarget) {
      if (!formData.targetMeasure.valueQuantity || formData.targetMeasure.valueQuantity.trim() === '') {
        throw new Error('Target value is required when target measure is enabled');
      }
      
      const value = parseFloat(formData.targetMeasure.valueQuantity);
      if (isNaN(value) || value <= 0) {
        throw new Error('Target value must be a positive number');
      }
      
      if (!formData.targetMeasure.unit || formData.targetMeasure.unit.trim() === '') {
        throw new Error('Target unit is required when target measure is enabled');
      }
    }
  }

  /**
   * Post-process the goal resource
   * @param {Object} resource - The resource
   * @param {string} operation - 'create' or 'update'
   * @param {Object} formData - Original form data
   * @param {Object} context - Additional context
   * @returns {Object} Processed resource
   */
  _postProcessResource(resource, operation, formData, context) {
    // Ensure dates are properly formatted
    if (resource.startDate && typeof resource.startDate !== 'string') {
      resource.startDate = new Date(resource.startDate).toISOString().split('T')[0]; // Date only
    }

    if (resource.target?.[0]?.dueDate && typeof resource.target[0].dueDate !== 'string') {
      resource.target[0].dueDate = new Date(resource.target[0].dueDate).toISOString().split('T')[0];
    }

    // Ensure category is an array
    if (resource.category && !Array.isArray(resource.category)) {
      resource.category = [resource.category];
    }

    return resource;
  }
}

// Helper functions that can be used by the dialog config
export const getLifecycleStatusColor = (status) => {
  switch (status?.toLowerCase()) {
    case 'active':
    case 'accepted':
      return 'success';
    case 'proposed':
    case 'planned':
      return 'info';
    case 'on-hold':
      return 'warning';
    case 'completed':
      return 'success';
    case 'cancelled':
    case 'rejected':
    case 'entered-in-error':
      return 'error';
    default:
      return 'default';
  }
};

export const getAchievementStatusColor = (status) => {
  switch (status?.toLowerCase()) {
    case 'achieved':
    case 'sustaining':
      return 'success';
    case 'improving':
    case 'in-progress':
      return 'info';
    case 'no-change':
    case 'no-progress':
      return 'warning';
    case 'worsening':
    case 'not-achieved':
    case 'not-attainable':
      return 'error';
    default:
      return 'default';
  }
};

export const getPriorityColor = (priority) => {
  switch (priority?.toLowerCase()) {
    case 'high-priority':
      return 'error';
    case 'medium-priority':
      return 'warning';
    case 'low-priority':
      return 'info';
    default:
      return 'default';
  }
};

export const getGoalDisplay = (formData) => {
  if (formData.selectedGoalCode) {
    return formData.selectedGoalCode.display;
  }
  return formData.description || 'No goal description';
};

// Export singleton instance for use in dialog configs
export const goalConverter = new GoalConverter();