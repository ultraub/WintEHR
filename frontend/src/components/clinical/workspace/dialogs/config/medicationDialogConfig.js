/**
 * MedicationRequest Dialog Configuration
 * Configuration for BaseResourceDialog to handle medication request management
 * Uses MedicationConverter for standardized FHIR resource conversion
 */
import { 
  medicationConverter,
  MEDICATION_STATUS_OPTIONS,
  MEDICATION_PRIORITY_OPTIONS,
  DOSING_FREQUENCIES,
  ROUTES,
  INTENT_OPTIONS,
  getStatusColor,
  getPriorityColor,
  getMedicationDisplay
} from '../../../../../core/fhir/converters/MedicationConverter';

// Re-export from converter for backward compatibility
export {
  MEDICATION_STATUS_OPTIONS,
  MEDICATION_PRIORITY_OPTIONS,
  DOSING_FREQUENCIES,
  ROUTES,
  INTENT_OPTIONS,
  getStatusColor,
  getPriorityColor,
  getMedicationDisplay
};

// Get initial values from converter
export const initialValues = medicationConverter.getInitialValues();

// Validation rules for form fields
export const validationRules = {
  selectedMedication: {
    required: false,
    label: 'Medication',
    custom: (value, formData) => {
      if (!formData.selectedMedication && !formData.customMedication) {
        return 'Please specify a medication or select from the list';
      }
      return null;
    }
  },
  customMedication: {
    required: false,
    label: 'Custom Medication'
  },
  dosage: {
    required: true,
    label: 'Dosage',
    minLength: 1
  },
  route: {
    required: true,
    label: 'Route'
  },
  frequency: {
    required: true,
    label: 'Frequency'
  },
  quantity: {
    required: true,
    label: 'Quantity',
    pattern: /^\d+(\.\d+)?$/,
    patternMessage: 'Quantity must be a valid number'
  },
  priority: {
    required: true,
    label: 'Priority'
  },
  status: {
    required: true,
    label: 'Status'
  },
  intent: {
    required: true,
    label: 'Intent'
  }
};

// Helper functions are now imported from converter

// Use converter method instead of duplicated logic
export const parseMedicationRequestResource = (medicationRequest) => {
  return medicationConverter.parseToForm(medicationRequest);
};

// Use converter method instead of duplicated logic
export const createMedicationRequestResource = (formData, patientId) => {
  return medicationConverter.createResource(formData, patientId);
};

// Use converter method instead of duplicated logic
export const updateMedicationRequestResource = (formData, existingResource) => {
  return medicationConverter.updateResource(formData, existingResource);
};

// Helper function moved to converter