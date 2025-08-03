# Clinical Dialog Template

This template demonstrates the standardized patterns for clinical dialogs in WintEHR.

## Key Features

1. **Standardized Callback**: Always use `onSave` (not `onSaved`)
2. **Consistent Error Handling**: Use `useDialogSave` hook
3. **Loading States**: Proper button states with CircularProgress
4. **Validation**: Use `useDialogValidation` hook

## Example Implementation

```javascript
import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Save as SaveIcon,
  Close as CloseIcon
} from '@mui/icons-material';

// Import dialog helpers
import { useDialogSave, useDialogValidation, VALIDATION_RULES } from './utils/dialogHelpers';

const ExampleDialog = ({
  open,
  onClose,
  resource = null,  // Existing resource for edit mode
  onSave,          // Standardized callback name
  patientId,
  mode = 'create'  // 'create' or 'edit'
}) => {
  // Form state
  const [formData, setFormData] = useState({
    field1: resource?.field1 || '',
    field2: resource?.field2 || '',
    status: resource?.status || 'active'
  });
  
  // Use consistent dialog helpers
  const { saving, error: saveError, handleSave: performSave } = useDialogSave(onSave, null);
  const { errors, validateForm } = useDialogValidation();
  
  // Local state for UI
  const [localErrors, setLocalErrors] = useState({});
  
  // Handle form submission
  const handleSubmit = async () => {
    // Define validation rules
    const validationRules = {
      field1: {
        required: true,
        minLength: 3,
        patternMessage: 'Field1 must be at least 3 characters'
      },
      field2: {
        required: true
      }
    };
    
    // Validate form
    if (!validateForm(formData, validationRules)) {
      return;
    }
    
    try {
      // Build FHIR resource
      const fhirResource = {
        resourceType: 'ResourceType',
        ...(resource?.id && { id: resource.id }), // Include ID for updates
        status: formData.status,
        // ... other FHIR fields
        subject: {
          reference: `Patient/${patientId}`
        }
      };
      
      // Use consistent save handler
      const successMessage = mode === 'edit' 
        ? 'Resource updated successfully' 
        : 'Resource created successfully';
      
      const success = await performSave(fhirResource, successMessage);
      
      if (success) {
        // Additional success actions (events, etc)
        // The dialog will close automatically via onClose callback
        onClose();
      }
    } catch (error) {
      console.error('Error preparing resource:', error);
      // The performSave function handles error display
    }
  };
  
  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        {mode === 'edit' ? 'Edit Resource' : 'Create Resource'}
      </DialogTitle>
      
      <DialogContent>
        <TextField
          fullWidth
          label="Field 1"
          value={formData.field1}
          onChange={(e) => setFormData(prev => ({ ...prev, field1: e.target.value }))}
          error={!!errors.field1}
          helperText={errors.field1}
          margin="normal"
        />
        
        <TextField
          fullWidth
          label="Field 2"
          value={formData.field2}
          onChange={(e) => setFormData(prev => ({ ...prev, field2: e.target.value }))}
          error={!!errors.field2}
          helperText={errors.field2}
          margin="normal"
        />
        
        {/* Show save error if any */}
        {saveError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {saveError}
          </Alert>
        )}
      </DialogContent>
      
      <DialogActions>
        <Button 
          onClick={onClose} 
          disabled={saving}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={saving}
          startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ExampleDialog;
```

## Usage in Parent Component

```javascript
const ParentComponent = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedResource, setSelectedResource] = useState(null);
  
  // Handle save from dialog
  const handleSaveResource = async (resource) => {
    try {
      if (resource.id) {
        // Update existing
        await fhirClient.update(resource.resourceType, resource.id, resource);
      } else {
        // Create new
        await fhirClient.create(resource.resourceType, resource);
      }
      
      // Refresh data
      await refreshData();
    } catch (error) {
      // Re-throw to let dialog handle error display
      throw error;
    }
  };
  
  return (
    <>
      <Button onClick={() => setDialogOpen(true)}>
        Add Resource
      </Button>
      
      <ExampleDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        resource={selectedResource}
        onSave={handleSaveResource}  // Always use 'onSave'
        patientId={patientId}
        mode={selectedResource ? 'edit' : 'create'}
      />
    </>
  );
};
```

## Key Points

1. **Consistent Naming**: Always use `onSave` prop (not `onSaved`)
2. **Error Handling**: Let `useDialogSave` handle errors and display
3. **Loading States**: Use `saving` state for button disabled/loading
4. **Validation**: Use `useDialogValidation` for consistent validation
5. **Success Messages**: Provide clear success messages
6. **Mode Support**: Support both create and edit modes
7. **FHIR Compliance**: Build proper FHIR resources

## Migration Checklist

When updating existing dialogs:

- [ ] Change `onSaved` to `onSave` in parent components
- [ ] Import dialog helpers
- [ ] Replace manual save handling with `useDialogSave`
- [ ] Replace manual validation with `useDialogValidation`
- [ ] Update button states to use consistent loading
- [ ] Add error display using `saveError`
- [ ] Remove manual `setSaving` calls
- [ ] Test both create and edit modes