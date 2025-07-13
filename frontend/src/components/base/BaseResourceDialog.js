/**
 * BaseResourceDialog Component
 * Standardized dialog foundation for all FHIR resource management
 */
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Typography,
  Box,
  Stepper,
  Step,
  StepLabel,
  Alert,
  CircularProgress,
  Divider
} from '@mui/material';
import {
  Close as CloseIcon,
  Save as SaveIcon,
  Preview as PreviewIcon,
  ArrowBack as BackIcon,
  ArrowForward as ForwardIcon
} from '@mui/icons-material';

const BaseResourceDialog = ({
  // Dialog props
  open,
  onClose,
  title,
  maxWidth = 'md',
  fullWidth = true,
  
  // Resource props
  resourceType,
  resource, // For edit mode
  mode = 'add', // 'add' | 'edit' | 'view'
  
  // Form configuration
  formConfig, // Configuration object defining form structure
  initialValues = {},
  validationRules = {},
  
  // Callbacks
  onSave,
  onValidate,
  
  // UI customization
  showStepper = false,
  steps = [],
  showPreview = true,
  showCancel = true,
  renderPreview, // Custom preview render function
  
  // Loading states
  loading = false,
  saving = false,
  
  // Error handling
  error = null,
  
  // Children components
  children,
  customActions,
  
  ...dialogProps
}) => {
  const [formData, setFormData] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [activeStep, setActiveStep] = useState(0);
  const [showPreviewMode, setShowPreviewMode] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize form data when resource changes
  useEffect(() => {
    if (mode === 'edit') {
      // In edit mode, use parsed initialValues instead of raw resource
      setFormData(initialValues);
    } else {
      setFormData(initialValues);
    }
    setErrors({});
    setActiveStep(0);
    setShowPreviewMode(false);
    setHasChanges(false);
    setJustSaved(false);
  }, [resource, mode, initialValues, open]);

  // Track changes
  useEffect(() => {
    if (justSaved) {
      setHasChanges(false);
      return;
    }
    const hasChanged = JSON.stringify(formData) !== JSON.stringify(initialValues);
    setHasChanges(hasChanged);
  }, [formData, initialValues, justSaved]);

  // Handle form data change
  const handleFieldChange = (fieldName, value) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: value
    }));
    
    // Clear field error when user starts typing
    if (errors[fieldName]) {
      setErrors(prev => ({
        ...prev,
        [fieldName]: null
      }));
    }
    
    // Clear save error when user makes changes
    if (saveError) {
      setSaveError(null);
    }
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};
    let isValid = true;

    // Run custom validation if provided
    if (onValidate) {
      const customErrors = onValidate(formData);
      if (customErrors && Object.keys(customErrors).length > 0) {
        Object.assign(newErrors, customErrors);
        isValid = false;
      }
    }

    // Run built-in validation rules
    Object.entries(validationRules).forEach(([fieldName, rules]) => {
      const value = formData[fieldName];
      
      if (rules.required && (!value || value === '')) {
        newErrors[fieldName] = `${rules.label || fieldName} is required`;
        isValid = false;
      }
      
      if (rules.minLength && value && value.length < rules.minLength) {
        newErrors[fieldName] = `${rules.label || fieldName} must be at least ${rules.minLength} characters`;
        isValid = false;
      }
      
      if (rules.pattern && value && !rules.pattern.test(value)) {
        newErrors[fieldName] = rules.patternMessage || `${rules.label || fieldName} format is invalid`;
        isValid = false;
      }

      if (rules.custom) {
        const customError = rules.custom(value, formData);
        if (customError) {
          newErrors[fieldName] = customError;
          isValid = false;
        }
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  // Handle save
  const handleSave = async () => {
    console.log('BaseResourceDialog: handleSave called');
    console.log('BaseResourceDialog: formData:', formData);
    console.log('BaseResourceDialog: validationRules:', validationRules);
    
    const isValid = validateForm();
    console.log('BaseResourceDialog: validation result:', isValid);
    console.log('BaseResourceDialog: validation errors:', errors);
    
    if (!isValid) {
      console.log('BaseResourceDialog: validation failed, not saving');
      return;
    }

    console.log('BaseResourceDialog: starting save...');
    setIsSubmitting(true);
    setSaveError(null);

    try {
      console.log('BaseResourceDialog: calling onSave with:', formData, mode);
      await onSave(formData, mode);
      console.log('BaseResourceDialog: save successful');
      // Mark as just saved to bypass unsaved changes check
      setJustSaved(true);
      handleClose(true); // Bypass unsaved check
    } catch (error) {
      console.error('BaseResourceDialog: save error:', error);
      setSaveError(error.message || 'An error occurred while saving');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle close with unsaved changes check
  const handleClose = (bypassUnsavedCheck = false) => {
    if (!bypassUnsavedCheck && hasChanges && !justSaved && !window.confirm('You have unsaved changes. Are you sure you want to close?')) {
      return;
    }
    
    setFormData(initialValues);
    setErrors({});
    setActiveStep(0);
    setShowPreviewMode(false);
    setHasChanges(false);
    setJustSaved(false);
    onClose();
  };

  // Handle stepper navigation
  const handleNext = () => {
    if (showStepper && activeStep < steps.length - 1) {
      setActiveStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (showStepper && activeStep > 0) {
      setActiveStep(prev => prev - 1);
    }
  };

  // Toggle preview mode
  const togglePreview = () => {
    if (!showPreviewMode && !validateForm()) {
      return;
    }
    setShowPreviewMode(!showPreviewMode);
  };

  // Get dialog title
  const getDialogTitle = () => {
    if (showPreviewMode) return `Preview ${resourceType}`;
    if (mode === 'edit') return title || `Edit ${resourceType}`;
    if (mode === 'view') return title || `View ${resourceType}`;
    return title || `Add ${resourceType}`;
  };

  // Check if save should be enabled
  const canSave = () => {
    return hasChanges && !loading && !saving && !isSubmitting && mode !== 'view';
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth={maxWidth}
      fullWidth={fullWidth}
      {...dialogProps}
    >
      {/* Dialog Title */}
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">
            {getDialogTitle()}
          </Typography>
          <IconButton onClick={handleClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
        
        {/* Stepper */}
        {showStepper && steps.length > 1 && (
          <Box sx={{ mt: 2 }}>
            <Stepper activeStep={activeStep} alternativeLabel>
              {steps.map((step, index) => (
                <Step key={index}>
                  <StepLabel>{step.label}</StepLabel>
                </Step>
              ))}
            </Stepper>
          </Box>
        )}
      </DialogTitle>

      {/* Dialog Content */}
      <DialogContent dividers>
        {/* Error Display */}
        {(error || saveError) && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error || saveError}
          </Alert>
        )}

        {/* Loading State */}
        {loading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        ) : showPreviewMode ? (
          /* Preview Mode */
          <Box>
            <Alert severity="info" sx={{ mb: 2 }}>
              Review the information below before saving.
            </Alert>
            <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
              {renderPreview ? (
                renderPreview(formData)
              ) : (
                <pre style={{ fontSize: '0.875rem', fontFamily: 'monospace' }}>
                  {JSON.stringify(formData, null, 2)}
                </pre>
              )}
            </Box>
          </Box>
        ) : (
          /* Form Content */
          <Box>
            {/* Render children with form context */}
            {React.Children.map(children, child => {
              if (React.isValidElement(child)) {
                return React.cloneElement(child, {
                  formData,
                  errors,
                  onChange: handleFieldChange,
                  disabled: mode === 'view' || saving,
                  activeStep: showStepper ? activeStep : undefined
                });
              }
              return child;
            })}
          </Box>
        )}
      </DialogContent>

      {/* Dialog Actions */}
      <DialogActions sx={{ p: 2 }}>
        <Box display="flex" justifyContent="space-between" width="100%">
          {/* Left side actions */}
          <Box>
            {showStepper && activeStep > 0 && (
              <Button
                onClick={handleBack}
                startIcon={<BackIcon />}
                disabled={saving}
              >
                Back
              </Button>
            )}
          </Box>

          {/* Right side actions */}
          <Box display="flex" gap={1}>
            {/* Custom actions */}
            {customActions}

            {/* Cancel */}
            {showCancel && (
              <Button
                onClick={handleClose}
                disabled={saving}
              >
                Cancel
              </Button>
            )}

            {/* Preview */}
            {showPreview && mode !== 'view' && (
              <Button
                onClick={togglePreview}
                startIcon={<PreviewIcon />}
                disabled={saving}
              >
                {showPreviewMode ? 'Edit' : 'Preview'}
              </Button>
            )}

            {/* Next (for stepper) */}
            {showStepper && activeStep < steps.length - 1 && (
              <Button
                onClick={handleNext}
                endIcon={<ForwardIcon />}
                disabled={saving}
                variant="contained"
              >
                Next
              </Button>
            )}

            {/* Save */}
            {mode !== 'view' && (!showStepper || activeStep === steps.length - 1) && (
              <Button
                onClick={handleSave}
                startIcon={(saving || isSubmitting) ? <CircularProgress size={20} /> : <SaveIcon />}
                disabled={!canSave()}
                variant="contained"
                color="primary"
              >
                {(saving || isSubmitting) ? 'Saving...' : 'Save'}
              </Button>
            )}
          </Box>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default BaseResourceDialog;