/**
 * AllergyIntolerance Dialog Configuration
 * Configuration for BaseResourceDialog to handle allergy/intolerance management
 * Uses AllergyConverter for standardized FHIR resource conversion
 */
import { 
  allergyConverter,
  ALLERGY_TYPES,
  CRITICALITY_LEVELS,
  CLINICAL_STATUS_OPTIONS,
  VERIFICATION_STATUS_OPTIONS,
  REACTION_SEVERITIES,
  COMMON_REACTIONS,
  getCriticalityColor,
  getAllergenDisplay,
  getStatusColor
} from '../../../utils/fhir/AllergyConverter';

// Re-export from converter for backward compatibility
export {
  ALLERGY_TYPES,
  CRITICALITY_LEVELS,
  CLINICAL_STATUS_OPTIONS,
  VERIFICATION_STATUS_OPTIONS,
  REACTION_SEVERITIES,
  COMMON_REACTIONS,
  getCriticalityColor,
  getAllergenDisplay,
  getStatusColor
};

// Get initial values from converter
export const initialValues = allergyConverter.getInitialValues();

// Validation rules for form fields
export const validationRules = {
  selectedAllergen: {
    required: false, // Custom validation below
    label: 'Allergen',
    custom: (value, formData) => {
      if (!formData.selectedAllergen && !formData.customAllergen) {
        return 'Please specify an allergen or select from the list';
      }
      return null;
    }
  },
  customAllergen: {
    required: false, // Custom validation above
    label: 'Custom Allergen'
  },
  allergyType: {
    required: true,
    label: 'Allergy Type'
  },
  criticality: {
    required: true,
    label: 'Criticality'
  },
  clinicalStatus: {
    required: true,
    label: 'Clinical Status'
  },
  verificationStatus: {
    required: true,
    label: 'Verification Status'
  }
};

// Use converter method instead of duplicated logic
export const createAllergyIntoleranceResource = (formData, patientId) => {
  return allergyConverter.createResource(formData, patientId);
};

// Helper functions are now imported from converter

// Use converter method instead of duplicated logic
export const parseAllergyIntoleranceResource = (allergyIntolerance) => {
  return allergyConverter.parseToForm(allergyIntolerance);
};

// Use converter method instead of duplicated logic
export const updateAllergyIntoleranceResource = (formData, existingResource) => {
  return allergyConverter.updateResource(formData, existingResource);
};