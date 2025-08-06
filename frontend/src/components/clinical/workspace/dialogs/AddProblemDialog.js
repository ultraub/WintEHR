/**
 * Add Problem Dialog Component (Migrated to BaseResourceDialog)
 * Uses the new BaseResourceDialog pattern for consistent UX
 */
import React, { useState } from 'react';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import EnhancedBaseResourceDialog from '../../../base/EnhancedBaseResourceDialog';
import EnhancedConditionFormFields from './components/EnhancedConditionFormFields';
import {
  initialValues,
  validationRules,
  createConditionResource
} from './config/conditionDialogConfig';

const AddProblemDialog = ({ open, onClose, onAdd, patientId, department }) => {
  
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
      // Create FHIR Condition resource
      const condition = createConditionResource(formData, patientId);
      
      // Call the onAdd callback with the new condition
      await onAdd(condition);
    } catch (error) {
      throw new Error(error.message || 'Failed to add problem');
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <EnhancedBaseResourceDialog
        // Force clean state for new additions
        key={`add-condition-${open ? 'open' : 'closed'}`}
        
        // Dialog props
        open={open}
        onClose={onClose}
        title="Add New Problem/Condition"
        maxWidth="md"
        fullWidth
        
        // Resource props
        resourceType="Condition"
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
        <EnhancedConditionFormFields />
      </EnhancedBaseResourceDialog>
    </LocalizationProvider>
  );
};

export default AddProblemDialog;