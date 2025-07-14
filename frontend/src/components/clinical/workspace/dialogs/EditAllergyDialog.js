/**
 * Edit Allergy Dialog Component (Migrated to BaseResourceDialog)
 * Uses the new BaseResourceDialog pattern for consistent UX
 */
import React from 'react';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { Button } from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';
import BaseResourceDialog from '../../../base/BaseResourceDialog';
import AllergyFormFields from './components/AllergyFormFields';
import {
  validationRules,
  parseAllergyIntoleranceResource,
  updateAllergyIntoleranceResource
} from './config/allergyDialogConfig';

const EditAllergyDialog = ({ open, onClose, onSave, onDelete, allergyIntolerance, patientId }) => {
  
  // Parse existing resource into initial form values
  const initialValues = allergyIntolerance ? parseAllergyIntoleranceResource(allergyIntolerance) : {};

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
      // Create updated FHIR AllergyIntolerance resource
      const updatedAllergyIntolerance = updateAllergyIntoleranceResource(formData, allergyIntolerance);
      
      // Call the onSave callback with the updated allergy
      await onSave(updatedAllergyIntolerance);
    } catch (error) {
      throw new Error(error.message || 'Failed to update allergy');
    }
  };

  // Handle delete operation
  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this allergy? This action cannot be undone.')) {
      try {
        await onDelete(allergyIntolerance.id);
      } catch (error) {
        throw new Error(error.message || 'Failed to delete allergy');
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
      <BaseResourceDialog
        // Dialog props
        open={open}
        onClose={onClose}
        title="Edit Allergy/Intolerance"
        maxWidth="md"
        fullWidth
        
        // Resource props
        resourceType="AllergyIntolerance"
        resource={allergyIntolerance}
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
      >
        <AllergyFormFields />
      </BaseResourceDialog>
    </LocalizationProvider>
  );
};

export default EditAllergyDialog;