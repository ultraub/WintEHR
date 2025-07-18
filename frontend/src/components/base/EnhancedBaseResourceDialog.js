/**
 * EnhancedBaseResourceDialog Component
 * Extends BaseResourceDialog with clinical context-aware theming and enhanced UX
 */
import React, { useState, useEffect, useContext } from 'react';
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
  Divider,
  Chip,
  Stack,
  useTheme,
  alpha,
  Fade,
  Paper
} from '@mui/material';
import {
  Close as CloseIcon,
  Save as SaveIcon,
  Preview as PreviewIcon,
  ArrowBack as BackIcon,
  ArrowForward as ForwardIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';
import { 
  getClinicalContext, 
  getSeverityColor,
  getClinicalAnimation,
  getClinicalSpacing 
} from '../../themes/clinicalThemeUtils';
import StatusChip from '../clinical/common/StatusChip';
import { MedicalThemeContext } from '../../App';

const EnhancedBaseResourceDialog = ({
  // All BaseResourceDialog props
  open,
  onClose,
  title,
  maxWidth = 'md',
  fullWidth = true,
  resourceType,
  resource,
  mode = 'add',
  formConfig,
  initialValues = {},
  validationRules = {},
  onSave,
  onValidate,
  showStepper = false,
  steps = [],
  showPreview = true,
  showCancel = true,
  renderPreview,
  loading = false,
  saving = false,
  error = null,
  children,
  customActions,
  
  // Enhanced props
  severity,
  urgency = 'normal',
  department,
  clinicalContext,
  showClinicalStatus = true,
  autoFocusFirst = true,
  enableSmartValidation = true,
  ...dialogProps
}) => {
  const theme = useTheme();
  const { department: contextDepartment } = useContext(MedicalThemeContext) || {};
  
  const [formData, setFormData] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [activeStep, setActiveStep] = useState(0);
  const [showPreviewMode, setShowPreviewMode] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get clinical context
  const context = clinicalContext || getClinicalContext(
    window.location.pathname,
    new Date().getHours(),
    department || contextDepartment
  );
  
  // Enhanced context with urgency
  const enhancedContext = {
    ...context,
    urgency
  };

  // Get clinical styling
  const spacing = getClinicalSpacing(theme, enhancedContext, 'comfortable');
  const animation = getClinicalAnimation(theme, 'hover', enhancedContext);
  
  // Get severity color
  const severityColor = severity ? getSeverityColor(theme, severity, enhancedContext) : null;

  // Initialize form data
  useEffect(() => {
    if (open) {
      setFormData(initialValues);
      setErrors({});
      setActiveStep(0);
      setShowPreviewMode(false);
      setHasChanges(false);
      setJustSaved(false);
    }
  }, [open, mode, resource?.id]);

  // Track changes
  useEffect(() => {
    if (justSaved || !open) {
      setHasChanges(false);
      return;
    }
    
    const hasFormChanges = JSON.stringify(formData) !== JSON.stringify(initialValues);
    setHasChanges(hasFormChanges);
  }, [formData, initialValues, justSaved, open]);

  // Validate form
  const validateForm = () => {
    let newErrors = {};
    
    // Apply validation rules
    if (validationRules) {
      Object.keys(validationRules).forEach(field => {
        const rule = validationRules[field];
        const value = formData[field];
        
        if (rule.required && !value) {
          newErrors[field] = rule.message || `${field} is required`;
        }
        
        if (rule.validate && !rule.validate(value, formData)) {
          newErrors[field] = rule.message || `${field} is invalid`;
        }
      });
    }
    
    // Custom validation
    if (onValidate) {
      const customErrors = onValidate(formData);
      newErrors = { ...newErrors, ...customErrors };
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle save
  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    setSaveError(null);
    
    try {
      await onSave(formData, mode);
      setJustSaved(true);
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (error) {
      setSaveError(error.message || 'Failed to save');
      setIsSubmitting(false);
    }
  };

  // Get mode configuration
  const getModeConfig = () => {
    const configs = {
      add: {
        color: 'primary',
        icon: <SaveIcon />,
        label: 'Create',
        title: title || `Create New ${resourceType}`
      },
      edit: {
        color: 'primary',
        icon: <SaveIcon />,
        label: 'Update',
        title: title || `Edit ${resourceType}`
      },
      view: {
        color: 'default',
        icon: null,
        label: null,
        title: title || `View ${resourceType}`
      }
    };
    
    return configs[mode] || configs.add;
  };

  const modeConfig = getModeConfig();

  // Enhanced dialog styles
  const dialogSx = {
    '& .MuiDialog-paper': {
      borderRadius: 0,
      border: '1px solid',
      borderColor: theme.palette.divider,
      ...(severityColor && {
        borderTop: `4px solid ${severityColor}`,
      }),
      ...(urgency === 'urgent' && {
        boxShadow: `0 0 0 2px ${alpha(theme.palette.error?.main || '#f44336', 0.2)}`,
      })
    }
  };

  // Title with clinical status
  const renderTitle = () => (
    <Box sx={{ pr: 4 }}>
      <Stack direction="row" spacing={2} alignItems="center">
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          {modeConfig.title}
        </Typography>
        {showClinicalStatus && (
          <Stack direction="row" spacing={1}>
            {severity && (
              <Chip
                size="small"
                label={severity.toUpperCase()}
                sx={{
                  backgroundColor: alpha(severityColor || theme.palette.warning?.main || '#ff9800', 0.1),
                  color: severityColor || theme.palette.warning?.main || '#ff9800',
                  border: `1px solid ${alpha(severityColor || theme.palette.warning?.main || '#ff9800', 0.3)}`,
                  fontWeight: 600
                }}
              />
            )}
            {urgency === 'urgent' && (
              <Chip
                size="small"
                label="URGENT"
                color="error"
                sx={{
                  animation: 'pulse 2s infinite',
                  '@keyframes pulse': {
                    '0%': { opacity: 1 },
                    '50%': { opacity: 0.7 },
                    '100%': { opacity: 1 }
                  }
                }}
              />
            )}
            {mode !== 'view' && hasChanges && (
              <Chip
                size="small"
                label="Unsaved Changes"
                icon={<WarningIcon fontSize="small" />}
                color="warning"
              />
            )}
          </Stack>
        )}
        <IconButton
          edge="end"
          color="inherit"
          onClick={onClose}
          aria-label="close"
          sx={{ position: 'absolute', right: spacing, top: spacing }}
        >
          <CloseIcon />
        </IconButton>
      </Stack>
      {resourceType && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
          FHIR {resourceType} Resource
        </Typography>
      )}
    </Box>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={maxWidth}
      fullWidth={fullWidth}
      sx={dialogSx}
      {...dialogProps}
    >
      <DialogTitle sx={{ pb: 1 }}>
        {renderTitle()}
      </DialogTitle>
      
      <Divider />
      
      <DialogContent sx={{ pt: spacing, pb: spacing }}>
        {/* Error display */}
        {(error || saveError) && (
          <Alert 
            severity="error" 
            sx={{ mb: spacing }}
            icon={<ErrorIcon />}
            onClose={() => setSaveError(null)}
          >
            {error || saveError}
          </Alert>
        )}
        
        {/* Success message */}
        {justSaved && (
          <Fade in={justSaved}>
            <Alert 
              severity="success" 
              sx={{ mb: spacing }}
              icon={<CheckCircleIcon />}
            >
              {resourceType} saved successfully!
            </Alert>
          </Fade>
        )}
        
        {/* Stepper */}
        {showStepper && steps.length > 0 && (
          <Box sx={{ mb: spacing * 2 }}>
            <Stepper activeStep={activeStep}>
              {steps.map((step, index) => (
                <Step key={step.label || index}>
                  <StepLabel>{step.label}</StepLabel>
                </Step>
              ))}
            </Stepper>
          </Box>
        )}
        
        {/* Loading state */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: spacing * 4 }}>
            <CircularProgress />
          </Box>
        ) : showPreviewMode && renderPreview ? (
          /* Preview mode */
          <Paper 
            variant="outlined" 
            sx={{ 
              p: spacing * 2, 
              backgroundColor: alpha(theme.palette.primary?.main || '#1976D2', 0.02) 
            }}
          >
            {renderPreview(formData)}
          </Paper>
        ) : (
          /* Form content */
          <Box>
            {React.Children.map(children, child => {
              if (React.isValidElement(child)) {
                return React.cloneElement(child, {
                  formData,
                  setFormData,
                  errors,
                  mode,
                  clinicalContext: enhancedContext,
                  department: enhancedContext.department
                });
              }
              return child;
            })}
          </Box>
        )}
      </DialogContent>
      
      <Divider />
      
      <DialogActions sx={{ p: spacing, gap: 1 }}>
        {/* Custom actions */}
        {customActions}
        
        {/* Preview toggle */}
        {showPreview && renderPreview && mode !== 'view' && (
          <Button
            startIcon={<PreviewIcon />}
            onClick={() => setShowPreviewMode(!showPreviewMode)}
            sx={{ mr: 'auto' }}
          >
            {showPreviewMode ? 'Edit' : 'Preview'}
          </Button>
        )}
        
        {/* Stepper navigation */}
        {showStepper && steps.length > 0 && (
          <>
            <Button
              disabled={activeStep === 0}
              onClick={() => setActiveStep(prev => prev - 1)}
              startIcon={<BackIcon />}
            >
              Back
            </Button>
            <Button
              disabled={activeStep === steps.length - 1}
              onClick={() => setActiveStep(prev => prev + 1)}
              endIcon={<ForwardIcon />}
            >
              Next
            </Button>
          </>
        )}
        
        {/* Cancel button */}
        {showCancel && mode !== 'view' && (
          <Button onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
        )}
        
        {/* Save button */}
        {mode !== 'view' && (
          <Button
            variant="contained"
            color={modeConfig.color}
            onClick={handleSave}
            disabled={isSubmitting || loading || (!hasChanges && mode === 'edit')}
            startIcon={isSubmitting ? <CircularProgress size={20} /> : modeConfig.icon}
            sx={{
              minWidth: 100,
              transition: `all ${animation.duration}ms ${animation.easing}`,
              ...(urgency === 'urgent' && {
                animation: hasChanges ? 'pulseButton 2s infinite' : 'none',
                '@keyframes pulseButton': {
                  '0%': { transform: 'scale(1)' },
                  '50%': { transform: 'scale(1.05)' },
                  '100%': { transform: 'scale(1)' }
                }
              })
            }}
          >
            {isSubmitting ? 'Saving...' : modeConfig.label}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default EnhancedBaseResourceDialog;