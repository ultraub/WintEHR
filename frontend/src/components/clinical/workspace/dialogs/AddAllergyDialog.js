/**
 * Add Allergy Dialog Component (Enhanced with Clinical Theming)
 * Uses the new EnhancedBaseResourceDialog for clinical context-aware theming
 */
import React from 'react';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import EnhancedBaseResourceDialog from '../../../base/EnhancedBaseResourceDialog';
import AllergyFormFields from './components/AllergyFormFields';
import {
  initialValues,
  validationRules,
  createAllergyIntoleranceResource
} from './config/allergyDialogConfig';

const AddAllergyDialog = ({ open, onClose, onAdd, patientId }) => {
  
  // Custom validation function
  const handleValidate = (formData) => {
    const errors = {};
    
    // Check allergen requirement
    if (!formData.selectedAllergen && !formData.customAllergen) {
      errors.selectedAllergen = 'Please specify an allergen or select from the list';
    }
    
    return errors;
  };

  // Handle save operation
  const handleSave = async (formData, mode) => {
    try {
      // Create FHIR AllergyIntolerance resource
      const allergyIntolerance = createAllergyIntoleranceResource(formData, patientId);
      
      // Call the onAdd callback with the new allergy
      await onAdd(allergyIntolerance);
    } catch (error) {
      throw new Error(error.message || 'Failed to add allergy');
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <EnhancedBaseResourceDialog
        // Dialog props
        open={open}
        onClose={onClose}
        title="Add New Allergy/Intolerance"
        maxWidth="md"
        fullWidth
        
        // Resource props
        resourceType="AllergyIntolerance"
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
        clinicalContext="emergency"
        patientId={patientId}
        
        // Enhanced features
        showCDSHooks={true}
        showResourceInfo={true}
        enableAutoSave={false}
        
        // Alert-specific theming for allergies
        primaryColor="error"
      >
        <AllergyFormFields />
      </EnhancedBaseResourceDialog>
    </LocalizationProvider>
  );
};

export default AddAllergyDialog;