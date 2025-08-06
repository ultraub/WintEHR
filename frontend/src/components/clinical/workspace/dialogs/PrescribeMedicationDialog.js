/**
 * Prescribe Medication Dialog Component (Migrated to BaseResourceDialog)
 * Uses the new BaseResourceDialog pattern for consistent UX
 */
import React from 'react';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import EnhancedBaseResourceDialog from '../../../base/EnhancedBaseResourceDialog';
import MedicationFormFields from './components/MedicationFormFields';
import {
  initialValues,
  validationRules,
  createMedicationRequestResource
} from './config/medicationDialogConfig';

const PrescribeMedicationDialog = ({ open, onClose, onPrescribe, patientId, department }) => {
  
  // Custom validation function
  const handleValidate = (formData) => {
    const errors = {};
    
    // Check medication requirement
    if (!formData.selectedMedication && !formData.customMedication) {
      errors.selectedMedication = 'Please specify a medication or select from the list';
    }
    
    // Check dosage requirement
    if (!formData.dosage || formData.dosage.trim() === '') {
      errors.dosage = 'Dosage is required';
    }
    
    // Check quantity requirement and format
    if (!formData.quantity || formData.quantity.trim() === '') {
      errors.quantity = 'Quantity is required';
    } else if (isNaN(parseFloat(formData.quantity))) {
      errors.quantity = 'Quantity must be a valid number';
    }
    
    // Check date logic
    if (formData.endDate && formData.startDate && formData.endDate <= formData.startDate) {
      errors.endDate = 'End date must be after start date';
    }
    
    // Check refills range
    if (formData.refills < 0 || formData.refills > 12) {
      errors.refills = 'Refills must be between 0 and 12';
    }
    
    // Check indication for new prescriptions
    if (!formData.indication || formData.indication.trim() === '') {
      errors.indication = 'Please specify what condition this medication is treating';
    }
    
    return errors;
  };

  // Handle save operation
  const handleSave = async (formData, mode) => {
    try {
      // Create FHIR MedicationRequest resource
      const medicationRequest = createMedicationRequestResource(formData, patientId);
      
      // Call the onPrescribe callback with the new medication request
      await onPrescribe(medicationRequest);
    } catch (error) {
      throw new Error(error.message || 'Failed to prescribe medication');
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <EnhancedBaseResourceDialog
        // Dialog props
        open={open}
        onClose={onClose}
        title="Prescribe New Medication"
        maxWidth="lg"
        fullWidth
        
        // Resource props
        resourceType="MedicationRequest"
        mode="add"
        
        // Form configuration
        initialValues={initialValues}
        validationRules={validationRules}
        
        // Callbacks
        onSave={handleSave}
        onValidate={handleValidate}
        
        // UI customization
        showPreview={true}
        showCancel={true}
        
        // Clinical context
        department={department}
      >
        <MedicationFormFields />
      </EnhancedBaseResourceDialog>
    </LocalizationProvider>
  );
};

export default PrescribeMedicationDialog;