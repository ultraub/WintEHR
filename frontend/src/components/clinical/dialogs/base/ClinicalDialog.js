/**
 * ClinicalDialog Component
 * Enhanced base dialog for all clinical CRUD operations
 * Provides consistent UX, keyboard navigation, and clinical safety features
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  IconButton,
  Button,
  Stack,
  Stepper,
  Step,
  StepLabel,
  Alert,
  AlertTitle,
  Collapse,
  LinearProgress,
  Chip,
  Tooltip,
  useTheme,
  useMediaQuery,
  alpha,
  Fade,
  Zoom
} from '@mui/material';
import {
  Close as CloseIcon,
  Save as SaveIcon,
  SaveAlt as DraftIcon,
  Preview as PreviewIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  KeyboardVoice as VoiceIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  Help as HelpIcon,
  CheckCircle as ValidIcon,
  Error as ErrorIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon
} from '@mui/icons-material';
import { useHotkeys } from 'react-hotkeys-hook';
import { useClinicalTheme } from '../../../../themes/clinicalThemeProvider';

// Dialog size presets
const SIZE_PRESETS = {
  compact: { width: 480, maxHeight: '60vh' },
  standard: { width: 600, maxHeight: '80vh' },
  large: { width: 800, maxHeight: '90vh' },
  full: { width: '90vw', maxHeight: '90vh' },
  responsive: { width: '100%', maxWidth: 600, maxHeight: '80vh' }
};

// Validation states
const VALIDATION_STATES = {
  IDLE: 'idle',
  VALIDATING: 'validating',
  VALID: 'valid',
  INVALID: 'invalid',
  WARNING: 'warning'
};

const ClinicalDialog = ({
  open,
  onClose,
  title,
  subtitle,
  mode = 'create', // create, edit, view, delete, workflow
  size = 'responsive',
  resource,
  resourceType,
  children,
  onSave,
  onSaveAsDraft,
  onValidate,
  onPreview,
  clinicalContext,
  showProgress = false,
  currentStep = 0,
  totalSteps = 1,
  steps = [],
  alerts = [],
  warnings = [],
  loading = false,
  saving = false,
  disabled = false,
  hideActions = false,
  customActions,
  enableKeyboardShortcuts = true,
  enableVoiceInput = false,
  enableUndo = true,
  autoSaveDraft = true,
  autoSaveInterval = 30000, // 30 seconds
  maxWidth,
  fullScreen = false,
  disableBackdropClick = false,
  showHelp = true,
  helpContent,
  ...props
}) => {
  const theme = useTheme();
  const { getClinicalColor } = useClinicalTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  
  const [validationState, setValidationState] = useState(VALIDATION_STATES.IDLE);
  const [validationErrors, setValidationErrors] = useState([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showHelperPanel, setShowHelperPanel] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  const formRef = useRef(null);
  const autoSaveTimerRef = useRef(null);

  // Determine dialog size
  const dialogSize = SIZE_PRESETS[size] || SIZE_PRESETS.responsive;
  const isFullScreen = fullScreen || (isMobile && size !== 'compact');

  // Auto-save draft functionality
  useEffect(() => {
    if (autoSaveDraft && isDirty && onSaveAsDraft) {
      autoSaveTimerRef.current = setTimeout(() => {
        handleSaveAsDraft(true);
      }, autoSaveInterval);

      return () => {
        if (autoSaveTimerRef.current) {
          clearTimeout(autoSaveTimerRef.current);
        }
      };
    }
  }, [isDirty, autoSaveDraft, autoSaveInterval]);

  // Keyboard shortcuts
  useHotkeys('ctrl+s, cmd+s', (e) => {
    e.preventDefault();
    if (enableKeyboardShortcuts && !disabled) {
      handleSave();
    }
  }, { enabled: open });

  useHotkeys('ctrl+enter, cmd+enter', (e) => {
    e.preventDefault();
    if (enableKeyboardShortcuts && !disabled) {
      handleSave();
    }
  }, { enabled: open });

  useHotkeys('escape', () => {
    if (enableKeyboardShortcuts && !disableBackdropClick) {
      handleClose();
    }
  }, { enabled: open });

  useHotkeys('ctrl+z, cmd+z', (e) => {
    e.preventDefault();
    if (enableKeyboardShortcuts && enableUndo) {
      handleUndo();
    }
  }, { enabled: open });

  useHotkeys('ctrl+shift+z, cmd+shift+z', (e) => {
    e.preventDefault();
    if (enableKeyboardShortcuts && enableUndo) {
      handleRedo();
    }
  }, { enabled: open });

  // Validation
  const performValidation = useCallback(async () => {
    if (!onValidate) return true;

    setValidationState(VALIDATION_STATES.VALIDATING);
    try {
      const result = await onValidate(resource);
      if (result.valid) {
        setValidationState(VALIDATION_STATES.VALID);
        setValidationErrors([]);
        return true;
      } else {
        setValidationState(result.warnings ? VALIDATION_STATES.WARNING : VALIDATION_STATES.INVALID);
        setValidationErrors(result.errors || []);
        return result.warnings ? true : false;
      }
    } catch (error) {
      setValidationState(VALIDATION_STATES.INVALID);
      setValidationErrors([{ field: 'general', message: 'Validation failed' }]);
      return false;
    }
  }, [resource, onValidate]);

  // Handlers
  const handleSave = async () => {
    if (disabled || saving) return;

    const isValid = await performValidation();
    if (!isValid && validationState === VALIDATION_STATES.INVALID) {
      return;
    }

    onSave?.(resource);
  };

  const handleSaveAsDraft = async (silent = false) => {
    if (disabled || !onSaveAsDraft) return;
    
    const result = await onSaveAsDraft(resource);
    if (!silent && result.success) {
      // Show brief success message
    }
  };

  const handleClose = () => {
    if (isDirty && !disableBackdropClick) {
      // Show confirmation dialog
      if (window.confirm('You have unsaved changes. Are you sure you want to close?')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      // Restore previous state
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      // Restore next state
    }
  };

  // Render validation status
  const renderValidationStatus = () => {
    if (validationState === VALIDATION_STATES.IDLE) return null;

    const configs = {
      [VALIDATION_STATES.VALIDATING]: {
        severity: 'info',
        icon: <CircularProgress size={16} />,
        message: 'Validating...'
      },
      [VALIDATION_STATES.VALID]: {
        severity: 'success',
        icon: <ValidIcon />,
        message: 'All checks passed'
      },
      [VALIDATION_STATES.WARNING]: {
        severity: 'warning',
        icon: <WarningIcon />,
        message: 'Warnings found but you can proceed'
      },
      [VALIDATION_STATES.INVALID]: {
        severity: 'error',
        icon: <ErrorIcon />,
        message: 'Please fix errors before saving'
      }
    };

    const config = configs[validationState];
    if (!config) return null;

    return (
      <Alert 
        severity={config.severity}
        icon={config.icon}
        sx={{ mb: 2 }}
        action={
          validationErrors.length > 0 && (
            <Button size="small" onClick={() => setShowHelperPanel(true)}>
              View Details
            </Button>
          )
        }
      >
        {config.message}
      </Alert>
    );
  };

  // Render clinical alerts
  const renderClinicalAlerts = () => {
    if (!alerts.length && !warnings.length) return null;

    return (
      <Stack spacing={1} sx={{ mb: 2 }}>
        {alerts.map((alert, index) => (
          <Alert 
            key={`alert-${index}`}
            severity="error"
            onClose={alert.dismissible ? () => {} : undefined}
          >
            <AlertTitle>{alert.title}</AlertTitle>
            {alert.message}
          </Alert>
        ))}
        {warnings.map((warning, index) => (
          <Alert 
            key={`warning-${index}`}
            severity="warning"
            onClose={warning.dismissible ? () => {} : undefined}
          >
            <AlertTitle>{warning.title}</AlertTitle>
            {warning.message}
          </Alert>
        ))}
      </Stack>
    );
  };

  return (
    <Dialog
      open={open}
      onClose={disableBackdropClick ? undefined : handleClose}
      fullScreen={isFullScreen}
      maxWidth={maxWidth || false}
      fullWidth
      PaperProps={{
        sx: {
          ...(!isFullScreen && dialogSize),
          borderRadius: isFullScreen ? 0 : 2,
          overflow: 'hidden'
        }
      }}
      {...props}
    >
      {/* Header */}
      <DialogTitle
        sx={{
          backgroundColor: mode === 'delete' 
            ? alpha(theme.palette.error.main, 0.08)
            : alpha(theme.palette.primary.main, 0.04),
          borderBottom: 1,
          borderColor: 'divider',
          pb: showProgress ? 0 : 2
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography variant="h6" component="div">
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
          
          <Stack direction="row" spacing={0.5}>
            {enableUndo && (
              <>
                <IconButton
                  size="small"
                  onClick={handleUndo}
                  disabled={historyIndex <= 0}
                >
                  <UndoIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={handleRedo}
                  disabled={historyIndex >= history.length - 1}
                >
                  <RedoIcon fontSize="small" />
                </IconButton>
              </>
            )}
            
            {showHelp && (
              <IconButton
                size="small"
                onClick={() => setShowHelperPanel(!showHelperPanel)}
              >
                <HelpIcon fontSize="small" />
              </IconButton>
            )}
            
            <IconButton
              size="small"
              onClick={handleClose}
              sx={{ ml: 1 }}
            >
              <CloseIcon />
            </IconButton>
          </Stack>
        </Stack>

        {/* Progress indicator for multi-step */}
        {showProgress && totalSteps > 1 && (
          <Box sx={{ mt: 2 }}>
            {steps.length > 0 ? (
              <Stepper activeStep={currentStep} alternativeLabel={!isMobile}>
                {steps.map((step, index) => (
                  <Step key={step.label || index}>
                    <StepLabel>{step.label}</StepLabel>
                  </Step>
                ))}
              </Stepper>
            ) : (
              <LinearProgress
                variant="determinate"
                value={(currentStep / totalSteps) * 100}
                sx={{ height: 8, borderRadius: 1 }}
              />
            )}
          </Box>
        )}
      </DialogTitle>

      {/* Content */}
      <DialogContent
        ref={formRef}
        sx={{
          p: { xs: 2, sm: 3 },
          position: 'relative',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {loading ? (
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            minHeight: 200 
          }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {renderClinicalAlerts()}
            {renderValidationStatus()}
            
            <Box sx={{ flex: 1, overflow: 'auto' }}>
              {children}
            </Box>

            {/* Helper panel */}
            <Collapse in={showHelperPanel}>
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  width: 300,
                  height: '100%',
                  backgroundColor: alpha(theme.palette.background.paper, 0.98),
                  borderLeft: 1,
                  borderColor: 'divider',
                  p: 2,
                  overflow: 'auto'
                }}
              >
                <Typography variant="h6" gutterBottom>
                  Help & Guidance
                </Typography>
                {helpContent || (
                  <Typography variant="body2" color="text.secondary">
                    Context-sensitive help will appear here
                  </Typography>
                )}
              </Box>
            </Collapse>
          </>
        )}
      </DialogContent>

      {/* Actions */}
      {!hideActions && (
        <DialogActions
          sx={{
            backgroundColor: alpha(theme.palette.background.default, 0.5),
            borderTop: 1,
            borderColor: 'divider',
            px: 3,
            py: 2
          }}
        >
          {customActions || (
            <>
              <Button
                onClick={handleClose}
                disabled={saving}
              >
                Cancel
              </Button>
              
              <Box sx={{ flex: 1 }} />
              
              {onSaveAsDraft && mode !== 'view' && (
                <Button
                  startIcon={<DraftIcon />}
                  onClick={() => handleSaveAsDraft(false)}
                  disabled={disabled || saving || !isDirty}
                >
                  Save Draft
                </Button>
              )}
              
              {onPreview && (
                <Button
                  startIcon={<PreviewIcon />}
                  onClick={() => onPreview(resource)}
                  disabled={disabled || saving}
                >
                  Preview
                </Button>
              )}
              
              <Button
                variant="contained"
                startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
                onClick={handleSave}
                disabled={disabled || saving || validationState === VALIDATION_STATES.INVALID}
                color={mode === 'delete' ? 'error' : 'primary'}
              >
                {mode === 'delete' ? 'Delete' : saving ? 'Saving...' : 'Save'}
              </Button>
            </>
          )}
        </DialogActions>
      )}
    </Dialog>
  );
};

export default ClinicalDialog;