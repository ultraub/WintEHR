/**
 * Goal Dialog Configuration
 * Configuration for BaseResourceDialog to handle Goal resource management
 * Uses GoalConverter for standardized FHIR resource conversion
 */
import { 
  goalConverter,
  GOAL_LIFECYCLE_STATUS_OPTIONS,
  GOAL_ACHIEVEMENT_STATUS_OPTIONS,
  GOAL_PRIORITY_OPTIONS,
  GOAL_CATEGORIES,
  GOAL_MEASUREMENT_UNITS,
  COMMON_GOAL_CODES,
  getLifecycleStatusColor,
  getAchievementStatusColor,
  getPriorityColor,
  getGoalDisplay
} from '../../../../../utils/fhir/GoalConverter';

// Re-export from converter for backward compatibility
export {
  GOAL_LIFECYCLE_STATUS_OPTIONS,
  GOAL_ACHIEVEMENT_STATUS_OPTIONS,
  GOAL_PRIORITY_OPTIONS,
  GOAL_CATEGORIES,
  GOAL_MEASUREMENT_UNITS,
  COMMON_GOAL_CODES,
  getLifecycleStatusColor,
  getAchievementStatusColor,
  getPriorityColor,
  getGoalDisplay
};

// Get initial values from converter
export const initialValues = goalConverter.getInitialValues();

// Validation rules for form fields
export const validationRules = {
  description: {
    required: false,
    label: 'Goal Description',
    custom: (value, formData) => {
      if (!formData.selectedGoalCode && !formData.description) {
        return 'Please provide a goal description or select from the list';
      }
      return null;
    }
  },
  selectedGoalCode: {
    required: false,
    label: 'Selected Goal'
  },
  category: {
    required: true,
    label: 'Category'
  },
  priority: {
    required: true,
    label: 'Priority'
  },
  lifecycleStatus: {
    required: true,
    label: 'Lifecycle Status'
  },
  achievementStatus: {
    required: true,
    label: 'Achievement Status'
  },
  startDate: {
    required: true,
    label: 'Start Date'
  },
  targetMeasure: {
    required: false,
    label: 'Target Measure',
    custom: (value, formData) => {
      if (formData.targetMeasure?.hasTarget) {
        if (!formData.targetMeasure.valueQuantity || formData.targetMeasure.valueQuantity.trim() === '') {
          return 'Target value is required when target measure is enabled';
        }
        
        const numValue = parseFloat(formData.targetMeasure.valueQuantity);
        if (isNaN(numValue) || numValue <= 0) {
          return 'Target value must be a positive number';
        }
        
        if (!formData.targetMeasure.unit || formData.targetMeasure.unit.trim() === '') {
          return 'Target unit is required when target measure is enabled';
        }
      }
      return null;
    }
  }
};

// Use converter methods instead of duplicated logic
export const parseGoalResource = (goal) => {
  return goalConverter.parseToForm(goal);
};

export const createGoalResource = (formData, patientId) => {
  return goalConverter.createResource(formData, patientId);
};

export const updateGoalResource = (formData, existingResource) => {
  return goalConverter.updateResource(formData, existingResource);
};