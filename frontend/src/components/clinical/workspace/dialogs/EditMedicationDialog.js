/**
 * Edit Medication Dialog Component (Enhanced with Clinical Theming)
 * Uses the new EnhancedBaseResourceDialog for clinical context-aware theming
 */
import React from 'react';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { Button } from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';
import EnhancedBaseResourceDialog from '../../../base/EnhancedBaseResourceDialog';
import MedicationFormFields from './components/MedicationFormFields';
import {
  validationRules,
  parseMedicationRequestResource,
  updateMedicationRequestResource
} from './config/medicationDialogConfig';

const EditMedicationDialog = ({ open, onClose, onSave, onDelete, medicationRequest, patientId }) => {
  
  // Parse existing resource into initial form values
  const initialValues = medicationRequest ? parseMedicationRequestResource(medicationRequest) : {};

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
    
    return errors;
  };

  // Handle save operation
  const handleSave = async (formData, mode) => {
    try {
      // Create updated FHIR MedicationRequest resource
      const updatedMedicationRequest = updateMedicationRequestResource(formData, medicationRequest);
      
      // Call the onSave callback with the updated medication request
      await onSave(updatedMedicationRequest);
    } catch (error) {
      throw new Error(error.message || 'Failed to update medication');
    }
  };

  // Handle delete operation
  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this medication? This action cannot be undone.')) {
      try {
        await onDelete(medicationRequest.id);
      } catch (error) {
        throw new Error(error.message || 'Failed to delete medication');
      }
    }
  };

  // Custom delete button for actions
  const customActions = (
    <Button 
      onClick={handleDelete}
      color="error"
      variant="outlined"
      size="small"
      startIcon={<DeleteIcon />}
    >
      Delete
    </Button>
  );

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <EnhancedBaseResourceDialog
        // Dialog props
        open={open}
        onClose={onClose}
        title="Edit Medication"
        maxWidth="lg"
        fullWidth
        
        // Resource props
        resourceType="MedicationRequest"
        resource={medicationRequest}
        mode="edit"
        
        // Form configuration
        initialValues={initialValues}
        validationRules={validationRules}
        
        // Callbacks
        onSave={handleSave}
        onValidate={handleValidate}
        
        // UI customization
        showPreview={true}
        showCancel={true}
        customActions={customActions}
        
        // Clinical context
        clinicalContext="pharmacy"
        patientId={patientId}
        
        // Enhanced features
        showCDSHooks={true}
        showResourceInfo={true}
        enableAutoSave={false}
        
        // Pharmacy-specific theming
        primaryColor="pharmacy"
      >
        <MedicationFormFields />
      </EnhancedBaseResourceDialog>
    </LocalizationProvider>
  );
};

export default EditMedicationDialog;