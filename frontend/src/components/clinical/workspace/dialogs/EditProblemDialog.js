/**
 * Edit Problem Dialog Component (Migrated to BaseResourceDialog)
 * Uses the new BaseResourceDialog pattern for consistent UX
 */
import React from 'react';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { Button } from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';
import BaseResourceDialog from '../../../base/BaseResourceDialog';
import ConditionFormFields from './components/ConditionFormFields';
import {
  validationRules,
  parseConditionResource,
  updateConditionResource
} from './config/conditionDialogConfig';

const EditProblemDialog = ({ open, onClose, onSave, onDelete, condition, patientId }) => {
  
  // Parse existing resource into initial form values
  const initialValues = condition ? parseConditionResource(condition) : {};

  // Custom validation function
  const handleValidate = (formData) => {
    const errors = {};
    
    // Check problem requirement
    if (!formData.selectedProblem && !formData.problemText) {
      errors.selectedProblem = 'Please specify a problem description or select from the list';
    }
    
    return errors;
  };

  // Handle save operation
  const handleSave = async (formData, mode) => {
    try {
      // Create updated FHIR Condition resource
      const updatedCondition = updateConditionResource(formData, condition);
      
      // Call the onSave callback with the updated condition
      await onSave(updatedCondition);
    } catch (error) {
      throw new Error(error.message || 'Failed to update problem');
    }
  };

  // Handle delete operation
  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this problem? This action cannot be undone.')) {
      try {
        await onDelete(condition.id);
      } catch (error) {
        throw new Error(error.message || 'Failed to delete problem');
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
        title="Edit Problem/Condition"
        maxWidth="md"
        fullWidth
        
        // Resource props
        resourceType="Condition"
        resource={condition}
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
        <ConditionFormFields />
      </BaseResourceDialog>
    </LocalizationProvider>
  );
};

export default EditProblemDialog;