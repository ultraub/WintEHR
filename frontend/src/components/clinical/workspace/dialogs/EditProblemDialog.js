/**
 * Edit Problem Dialog Component (Enhanced with Clinical Theming)
 * Uses the new EnhancedBaseResourceDialog for clinical context-aware theming
 */
import React, { useMemo } from 'react';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { Button } from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';
import EnhancedBaseResourceDialog from '../../../base/EnhancedBaseResourceDialog';
import EnhancedConditionFormFields from './components/EnhancedConditionFormFields';
import {
  validationRules,
  parseConditionResource,
  updateConditionResource
} from './config/conditionDialogConfig';

const EditProblemDialog = ({ open, onClose, onSave, onDelete, condition, patientId }) => {
  
  // Parse existing resource into initial form values - memoized to prevent recreation
  const initialValues = useMemo(() => {
    return condition ? parseConditionResource(condition) : {};
  }, [condition?.id, condition?.meta?.versionId]); // Only recompute when condition ID or version changes

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
      <EnhancedBaseResourceDialog
        // Force re-mount when condition changes to prevent state conflicts
        key={`edit-condition-${condition?.id || 'new'}`}
        
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
        
        // Clinical context
        clinicalContext="emergency"
        patientId={patientId}
        
        // Enhanced features
        showCDSHooks={true}
        showResourceInfo={true}
        enableAutoSave={false}
      >
        <EnhancedConditionFormFields />
      </EnhancedBaseResourceDialog>
    </LocalizationProvider>
  );
};

export default EditProblemDialog;