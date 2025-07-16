/**
 * CarePlan Dialog Configuration
 * Configuration for BaseResourceDialog to handle CarePlan resource management
 * Uses CarePlanConverter for standardized FHIR resource conversion
 */
import { 
  carePlanConverter,
  CAREPLAN_STATUS_OPTIONS,
  CAREPLAN_INTENT_OPTIONS,
  CAREPLAN_CATEGORIES,
  ACTIVITY_STATUS_OPTIONS,
  ACTIVITY_CATEGORIES,
  COMMON_ACTIVITY_CODES,
  getStatusColor,
  getActivityStatusColor,
  getIntentColor,
  getCarePlanDisplay
} from '../../../../../core/fhir/converters/CarePlanConverter';

// Re-export from converter for backward compatibility
export {
  CAREPLAN_STATUS_OPTIONS,
  CAREPLAN_INTENT_OPTIONS,
  CAREPLAN_CATEGORIES,
  ACTIVITY_STATUS_OPTIONS,
  ACTIVITY_CATEGORIES,
  COMMON_ACTIVITY_CODES,
  getStatusColor,
  getActivityStatusColor,
  getIntentColor,
  getCarePlanDisplay
};

// Get initial values from converter
export const initialValues = carePlanConverter.getInitialValues();

// Validation rules for form fields
export const validationRules = {
  title: {
    required: true,
    label: 'Care Plan Title',
    minLength: 3,
    maxLength: 200
  },
  description: {
    required: false,
    label: 'Description',
    maxLength: 1000
  },
  status: {
    required: true,
    label: 'Status'
  },
  intent: {
    required: true,
    label: 'Intent'
  },
  category: {
    required: true,
    label: 'Category'
  },
  period: {
    required: true,
    label: 'Care Period',
    custom: (value, formData) => {
      if (!formData.period?.start) {
        return 'Start date is required';
      }
      
      if (formData.period.end && formData.period.start > formData.period.end) {
        return 'End date must be after start date';
      }
      
      return null;
    }
  },
  activities: {
    required: false,
    label: 'Activities',
    custom: (value, formData) => {
      if (!formData.activities || formData.activities.length === 0) {
        return null; // Activities are optional
      }
      
      for (let i = 0; i < formData.activities.length; i++) {
        const activity = formData.activities[i];
        
        if (!activity.description || activity.description.trim() === '') {
          return `Activity ${i + 1}: Description is required`;
        }
        
        if (!activity.status) {
          return `Activity ${i + 1}: Status is required`;
        }
        
        if (!activity.category) {
          return `Activity ${i + 1}: Category is required`;
        }
        
        if (activity.scheduledPeriod?.start && activity.scheduledPeriod?.end) {
          if (activity.scheduledPeriod.start > activity.scheduledPeriod.end) {
            return `Activity ${i + 1}: End date must be after start date`;
          }
        }
      }
      
      return null;
    }
  }
};

// Use converter methods instead of duplicated logic
export const parseCarePlanResource = (carePlan) => {
  return carePlanConverter.parseToForm(carePlan);
};

export const createCarePlanResource = (formData, patientId) => {
  return carePlanConverter.createResource(formData, patientId);
};

export const updateCarePlanResource = (formData, existingResource) => {
  return carePlanConverter.updateResource(formData, existingResource);
};