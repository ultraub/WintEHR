/**
 * Condition Dialog Configuration
 * Configuration for BaseResourceDialog to handle condition/problem management
 * Uses ConditionConverter for standardized FHIR resource conversion
 */
import { 
  conditionConverter,
  CLINICAL_STATUS_OPTIONS,
  VERIFICATION_STATUS_OPTIONS,
  CONDITION_CATEGORIES,
  SEVERITY_OPTIONS,
  getStatusColor,
  getProblemDisplay
} from '../../../../../core/fhir/converters/ConditionConverter';

// Re-export from converter for backward compatibility
export {
  CLINICAL_STATUS_OPTIONS,
  VERIFICATION_STATUS_OPTIONS,
  CONDITION_CATEGORIES,
  SEVERITY_OPTIONS,
  getStatusColor,
  getProblemDisplay
};

// Get initial values from converter
export const initialValues = conditionConverter.getInitialValues();

// Validation rules for form fields
export const validationRules = {
  selectedProblem: {
    required: false,
    label: 'Problem',
    custom: (value, formData) => {
      if (!formData.selectedProblem && !formData.problemText) {
        return 'Please specify a problem description or select from the list';
      }
      return null;
    }
  },
  problemText: {
    required: false,
    label: 'Problem Description'
  },
  clinicalStatus: {
    required: true,
    label: 'Clinical Status'
  },
  verificationStatus: {
    required: true,
    label: 'Verification Status'
  },
  category: {
    required: true,
    label: 'Category'
  }
};

// Helper functions are now imported from converter

// Use converter method instead of duplicated logic
export const parseConditionResource = (condition) => {
  return conditionConverter.parseToForm(condition);
};

// Use converter method instead of duplicated logic
export const createConditionResource = (formData, patientId) => {
  return conditionConverter.createResource(formData, patientId);
};

// Use converter method instead of duplicated logic
export const updateConditionResource = (formData, existingResource) => {
  return conditionConverter.updateResource(formData, existingResource);
};