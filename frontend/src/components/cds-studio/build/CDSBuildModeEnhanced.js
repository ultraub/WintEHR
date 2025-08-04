/**
 * Enhanced CDS Build Mode
 * 
 * A comprehensive, user-friendly interface for building CDS Hooks with:
 * - Step-by-step workflow
 * - Visual validation feedback
 * - Auto-save functionality
 * - Template system
 * - Real-time preview
 * 
 * @since 2025-01-27
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Paper,
  Typography,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  Card,
  CardContent,
  CardActions,
  Alert,
  AlertTitle,
  Chip,
  IconButton,
  Tooltip,
  Fade,
  LinearProgress,
  Stack,
  Divider,
  Badge,
  Fab,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  FormControlLabel,
  Checkbox,
  Tab,
  Tabs,
  CircularProgress,
  useTheme,
  alpha
} from '@mui/material';
import {
  Save as SaveIcon,
  Check as CheckIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  Visibility as PreviewIcon,
  Code as CodeIcon,
  PlayArrow as TestIcon,
  Timer as TimerIcon,
  CheckCircle as SuccessIcon,
  RadioButtonUnchecked as PendingIcon,
  RadioButtonUnchecked,
  AutoFixHigh as AutoFixIcon,
  Psychology as SmartIcon,
  Category as TemplateIcon,
  Help as HelpIcon,
  ArrowBack as BackIcon,
  ArrowForward as NextIcon
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useCDSStudio } from '../../../pages/CDSHooksStudio';
import { cdsHooksService } from '../../../services/cdsHooksService';
import CDSHookBuilder from '../../clinical/workspace/cds/CDSHookBuilder';
import CardBuilder from '../../clinical/workspace/cds/CardBuilder';
import CDSCardDisplay from '../../clinical/workspace/cds/CDSCardDisplay';
import DisplayBehaviorConfiguration from '../../clinical/workspace/cds/DisplayBehaviorConfiguration';
import PrefetchQueryBuilder from '../../clinical/workspace/cds/PrefetchQueryBuilder';
import SuggestionBuilder from '../../clinical/workspace/cds/SuggestionBuilder';

// Hook templates for common scenarios
const HOOK_TEMPLATES = [
  {
    id: 'drug-interaction',
    name: 'Drug Interaction Alert',
    description: 'Alert for potential drug interactions',
    icon: <WarningIcon />,
    hook: 'medication-prescribe',
    template: {
      title: 'Drug Interaction Checker',
      description: 'Checks for potential drug-drug interactions when prescribing medications',
      hook: 'medication-prescribe',
      conditions: [
        {
          type: 'medication',
          operator: 'taking',
          medication: null
        }
      ],
      cards: [
        {
          summary: 'Potential Drug Interaction Detected',
          detail: 'The prescribed medication may interact with the patient\'s current medications.',
          indicator: 'warning',
          source: {
            label: 'Drug Interaction Database'
          },
          overrideReasonRequired: true
        }
      ]
    }
  },
  {
    id: 'allergy-alert',
    name: 'Allergy Alert',
    description: 'Alert for medication allergies',
    icon: <ErrorIcon />,
    hook: 'medication-prescribe',
    template: {
      title: 'Allergy Alert System',
      description: 'Alerts when prescribing medications that patient is allergic to',
      hook: 'medication-prescribe',
      conditions: [
        {
          type: 'allergy',
          operator: 'exists',
          allergyType: 'medication'
        }
      ],
      cards: [
        {
          summary: 'Allergy Alert',
          detail: 'Patient has a documented allergy to this medication or medication class.',
          indicator: 'critical',
          source: {
            label: 'Allergy Records'
          },
          overrideReasonRequired: true
        }
      ]
    }
  },
  {
    id: 'lab-critical',
    name: 'Critical Lab Value',
    description: 'Alert for critical lab results',
    icon: <ErrorIcon />,
    hook: 'patient-view',
    template: {
      title: 'Critical Lab Value Monitor',
      description: 'Monitors for critical lab values requiring immediate attention',
      hook: 'patient-view',
      conditions: [
        {
          type: 'lab-value',
          operator: 'critical',
          labTest: null
        }
      ],
      cards: [
        {
          summary: 'Critical Lab Value',
          detail: 'Patient has a critical lab value requiring immediate attention.',
          indicator: 'critical',
          source: {
            label: 'Laboratory System'
          }
        }
      ]
    }
  },
  {
    id: 'preventive-care',
    name: 'Preventive Care Reminder',
    description: 'Reminder for due preventive care',
    icon: <InfoIcon />,
    hook: 'patient-view',
    template: {
      title: 'Preventive Care Reminders',
      description: 'Reminds about due preventive care measures',
      hook: 'patient-view',
      conditions: [
        {
          type: 'age',
          operator: 'gte',
          value: 50
        }
      ],
      cards: [
        {
          summary: 'Preventive Care Due',
          detail: 'Patient is due for preventive care screening.',
          indicator: 'info',
          source: {
            label: 'Clinical Guidelines'
          },
          suggestions: [
            {
              label: 'Order Screening',
              actions: []
            }
          ]
        }
      ]
    }
  }
];

const STEPS = [
  'Basic Information',
  'Conditions',
  'Cards & Actions',
  'Advanced Settings',
  'Review & Test'
];

const CDSBuildModeEnhanced = () => {
  const theme = useTheme();
  const context = useCDSStudio();
  const autoSaveTimer = useRef(null);
  
  // State
  const [activeStep, setActiveStep] = useState(0);
  const [hook, setHook] = useState({
    id: '',
    title: '',
    description: '',
    hook: 'patient-view',
    conditions: [],
    cards: [],
    prefetch: {},
    enabled: true,
    displayBehavior: {
      defaultMode: 'popup',
      acknowledgment: {
        required: false,
        reasonRequired: false
      },
      snooze: {
        enabled: true,
        defaultDuration: 60
      },
      indicatorOverrides: {
        critical: 'modal',
        warning: 'popup',
        info: 'inline'
      }
    },
    _meta: {
      created: null,
      modified: new Date(),
      version: 0,
      author: 'Current User'
    }
  });
  
  const [validation, setValidation] = useState({
    basicInfo: { isValid: true, errors: [] }, // Start as valid to avoid initial errors
    conditions: { isValid: true, errors: [] }, // Conditions are optional
    cards: { isValid: true, errors: [] }, // Start as valid
    advanced: { isValid: true, errors: [] }, // Advanced settings are optional
    overall: { isValid: true, errors: [], warnings: [] }
  });
  
  const [showTemplates, setShowTemplates] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [lastSaved, setLastSaved] = useState(null);
  const [saving, setSaving] = useState(false);
  const [testResults, setTestResults] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  
  // Initialize from context
  useEffect(() => {
    if (context?.currentHook && context.currentHook.id) {
      setHook(context.currentHook);
      // If editing existing hook, validate current state
      validateStep(0, context.currentHook);
      validateStep(1, context.currentHook);
      validateStep(2, context.currentHook);
      validateStep(3, context.currentHook);
    }
  }, [context?.currentHook]);
  
  // Auto-save functionality
  useEffect(() => {
    if (autoSaveEnabled && hook.title) {
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
      }
      
      autoSaveTimer.current = setTimeout(() => {
        autoSave();
      }, 5000); // Auto-save after 5 seconds of inactivity
    }
    
    return () => {
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
      }
    };
  }, [hook, autoSaveEnabled]);
  
  // Validation functions
  const validateStep = useCallback((step, hookData = hook) => {
    const newValidation = { ...validation };
    
    switch (step) {
      case 0: // Basic Information
        const basicErrors = [];
        if (!hookData.title?.trim()) {
          basicErrors.push('Title is required');
        }
        if (!hookData.hook) {
          basicErrors.push('Hook type is required');
        }
        newValidation.basicInfo = {
          isValid: basicErrors.length === 0,
          errors: basicErrors
        };
        break;
        
      case 1: // Conditions (optional)
        const conditionErrors = [];
        hookData.conditions?.forEach((condition, index) => {
          if (condition.type && !condition.operator) {
            conditionErrors.push(`Condition ${index + 1}: Operator is required`);
          }
          if (condition.operator && condition.value === undefined) {
            conditionErrors.push(`Condition ${index + 1}: Value is required`);
          }
        });
        newValidation.conditions = {
          isValid: conditionErrors.length === 0,
          errors: conditionErrors
        };
        break;
        
      case 2: // Cards
        const cardErrors = [];
        if (!hookData.cards || hookData.cards.length === 0) {
          cardErrors.push('At least one card is required');
        } else {
          hookData.cards.forEach((card, index) => {
            if (!card.summary?.trim()) {
              cardErrors.push(`Card ${index + 1}: Summary is required`);
            }
            if (!card.indicator) {
              cardErrors.push(`Card ${index + 1}: Severity indicator is required`);
            }
          });
        }
        newValidation.cards = {
          isValid: cardErrors.length === 0,
          errors: cardErrors
        };
        break;
        
      case 3: // Advanced Settings
        // Advanced settings are optional, so always valid
        newValidation.advanced = {
          isValid: true,
          errors: []
        };
        break;
    }
    
    // Update overall validation
    newValidation.overall = {
      isValid: newValidation.basicInfo.isValid && 
               newValidation.conditions.isValid && 
               newValidation.cards.isValid &&
               (newValidation.advanced?.isValid ?? true),
      errors: [
        ...newValidation.basicInfo.errors,
        ...newValidation.conditions.errors,
        ...newValidation.cards.errors,
        ...(newValidation.advanced?.errors || [])
      ],
      warnings: []
    };
    
    setValidation(newValidation);
    return newValidation;
  }, [hook, validation]);
  
  // Update hook data
  const updateHook = useCallback((updates) => {
    console.log('[CDSBuildModeEnhanced] updateHook called with:', updates);
    const newHook = { ...hook, ...updates };
    
    // Auto-generate ID from title if needed
    if (updates.title && !newHook.id) {
      newHook.id = updates.title
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    }
    
    setHook(newHook);
    
    // Update context
    if (context?.actions) {
      context.actions.updateHook(newHook);
    }
    
    // Validate current step
    validateStep(activeStep, newHook);
  }, [hook, activeStep, context, validateStep]);
  
  // Auto-save function
  const autoSave = useCallback(async () => {
    if (!validation.overall.isValid) return;
    
    setSaving(true);
    try {
      // Save to local storage as draft
      localStorage.setItem(`cds-hook-draft-${hook.id || 'new'}`, JSON.stringify(hook));
      setLastSaved(new Date());
      
      // Don't actually save to server during auto-save to avoid incomplete data
      // This is just for draft protection
    } catch (error) {
      console.error('Auto-save failed:', error);
    } finally {
      setSaving(false);
    }
  }, [hook, validation]);
  
  // Manual save
  const saveHook = useCallback(async () => {
    // Validate all steps
    const step0 = validateStep(0);
    const step1 = validateStep(1);
    const step2 = validateStep(2);
    const step3 = validateStep(3);
    
    if (!step0.overall.isValid) {
      setSnackbar({
        open: true,
        message: 'Please fix validation errors before saving',
        severity: 'error'
      });
      return;
    }
    
    setSaving(true);
    try {
      // First ensure the context has the latest hook data
      context.actions.updateHook(hook);
      
      // Small delay to ensure state propagation
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Use context save which handles all the complexity
      const success = await context.actions.saveHook();
      
      if (success) {
        setSnackbar({
          open: true,
          message: 'Hook saved successfully!',
          severity: 'success'
        });
        setLastSaved(new Date());
        
        // Clear draft
        localStorage.removeItem(`cds-hook-draft-${hook.id || 'new'}`);
        
        // Switch to manage mode after successful save
        setTimeout(() => {
          context.actions.switchMode('manage');
        }, 1500);
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: `Save failed: ${error.message}`,
        severity: 'error'
      });
    } finally {
      setSaving(false);
    }
  }, [hook, context, validateStep]);
  
  // Template selection
  const selectTemplate = (template) => {
    const newHook = {
      ...hook,
      ...template.template,
      id: '', // Clear ID so it generates from new title
      _meta: {
        ...hook._meta,
        template: template.id
      }
    };
    
    updateHook(newHook);
    setShowTemplates(false);
    
    // Validate all steps with template data
    validateStep(0, newHook);
    validateStep(1, newHook);
    validateStep(2, newHook);
  };
  
  // Step navigation
  const handleNext = () => {
    if (activeStep < STEPS.length - 1) {
      setActiveStep(activeStep + 1);
    }
  };
  
  const handleBack = () => {
    if (activeStep > 0) {
      setActiveStep(activeStep - 1);
    }
  };
  
  // Test hook
  const testHook = async () => {
    if (!validation.overall.isValid) {
      setSnackbar({
        open: true,
        message: 'Please fix validation errors before testing',
        severity: 'error'
      });
      return;
    }
    
    try {
      const result = await context.actions.testHook('test-patient-123');
      setTestResults(result);
      setSnackbar({
        open: true,
        message: 'Test completed successfully',
        severity: 'success'
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: `Test failed: ${error.message}`,
        severity: 'error'
      });
    }
  };
  
  // Render step content
  const renderStepContent = (step) => {
    switch (step) {
      case 0: // Basic Information
        return (
          <Box sx={{ mt: 2 }}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Hook Title"
                  value={hook.title}
                  onChange={(e) => updateHook({ title: e.target.value })}
                  error={validation.basicInfo.errors.some(e => e.includes('Title'))}
                  helperText={
                    validation.basicInfo.errors.find(e => e.includes('Title')) ||
                    'A descriptive title for your CDS hook'
                  }
                  required
                  InputProps={{
                    endAdornment: hook.id && (
                      <Tooltip title="Auto-generated ID">
                        <Chip label={`ID: ${hook.id}`} size="small" />
                      </Tooltip>
                    )
                  }}
                />
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Description"
                  value={hook.description}
                  onChange={(e) => updateHook({ description: e.target.value })}
                  multiline
                  rows={3}
                  helperText="Explain what this hook does and when it triggers"
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <FormControl fullWidth required>
                  <InputLabel>Hook Type</InputLabel>
                  <Select
                    value={hook.hook}
                    onChange={(e) => updateHook({ hook: e.target.value })}
                    label="Hook Type"
                  >
                    <MenuItem value="patient-view">Patient View</MenuItem>
                    <MenuItem value="medication-prescribe">Medication Prescribe</MenuItem>
                    <MenuItem value="order-select">Order Select</MenuItem>
                    <MenuItem value="order-sign">Order Sign</MenuItem>
                    <MenuItem value="encounter-start">Encounter Start</MenuItem>
                    <MenuItem value="encounter-discharge">Encounter Discharge</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={hook.enabled}
                      onChange={(e) => updateHook({ enabled: e.target.checked })}
                    />
                  }
                  label="Enabled"
                />
              </Grid>
              
              {/* Template Selection */}
              <Grid item xs={12}>
                <Button
                  variant="outlined"
                  startIcon={<TemplateIcon />}
                  onClick={() => setShowTemplates(true)}
                  fullWidth
                >
                  Use Template
                </Button>
              </Grid>
            </Grid>
          </Box>
        );
        
      case 1: // Conditions
        return (
          <Box sx={{ mt: 2 }}>
            <Alert severity="info" sx={{ mb: 2 }}>
              <AlertTitle>Conditions (Optional)</AlertTitle>
              Define when this hook should trigger. Leave empty to always trigger.
            </Alert>
            
            {/* Simple condition builder */}
            <Stack spacing={2}>
              {hook.conditions?.map((condition, index) => (
                <Card key={condition.id || index} variant="outlined">
                  <CardContent>
                    <Stack spacing={2}>
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={4}>
                          <FormControl fullWidth>
                            <InputLabel>Condition Type</InputLabel>
                            <Select
                              value={condition.type || ''}
                              onChange={(e) => {
                                const newConditions = [...hook.conditions];
                                newConditions[index] = { ...condition, type: e.target.value };
                                updateHook({ conditions: newConditions });
                              }}
                              label="Condition Type"
                            >
                              <MenuItem value="age">Age</MenuItem>
                              <MenuItem value="gender">Gender</MenuItem>
                              <MenuItem value="condition">Medical Condition</MenuItem>
                              <MenuItem value="medication">Medication</MenuItem>
                              <MenuItem value="lab-value">Lab Value</MenuItem>
                              <MenuItem value="vital-sign">Vital Sign</MenuItem>
                              <MenuItem value="allergy">Allergy</MenuItem>
                            </Select>
                          </FormControl>
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <FormControl fullWidth>
                            <InputLabel>Operator</InputLabel>
                            <Select
                              value={condition.operator || ''}
                              onChange={(e) => {
                                const newConditions = [...hook.conditions];
                                newConditions[index] = { ...condition, operator: e.target.value };
                                updateHook({ conditions: newConditions });
                              }}
                              label="Operator"
                            >
                              <MenuItem value="equals">Equals</MenuItem>
                              <MenuItem value="not_equals">Not Equals</MenuItem>
                              <MenuItem value="gt">Greater Than</MenuItem>
                              <MenuItem value="gte">Greater Than or Equal</MenuItem>
                              <MenuItem value="lt">Less Than</MenuItem>
                              <MenuItem value="lte">Less Than or Equal</MenuItem>
                              <MenuItem value="exists">Exists</MenuItem>
                              <MenuItem value="not_exists">Does Not Exist</MenuItem>
                            </Select>
                          </FormControl>
                        </Grid>
                        <Grid item xs={12} md={3}>
                          <TextField
                            fullWidth
                            label="Value"
                            value={condition.value || ''}
                            onChange={(e) => {
                              const newConditions = [...hook.conditions];
                              newConditions[index] = { ...condition, value: e.target.value };
                              updateHook({ conditions: newConditions });
                            }}
                            disabled={condition.operator === 'exists' || condition.operator === 'not_exists'}
                          />
                        </Grid>
                        <Grid item xs={12} md={1}>
                          <IconButton
                            color="error"
                            onClick={() => {
                              const newConditions = hook.conditions.filter((_, i) => i !== index);
                              updateHook({ conditions: newConditions });
                            }}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Grid>
                      </Grid>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
              
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => {
                  updateHook({
                    conditions: [...(hook.conditions || []), {
                      id: `condition-${Date.now()}`,
                      type: '',
                      operator: '',
                      value: '',
                      enabled: true
                    }]
                  });
                }}
              >
                Add Condition
              </Button>
            </Stack>
            
            {validation.conditions.errors.length > 0 && (
              <Alert severity="error" sx={{ mt: 2 }}>
                <AlertTitle>Validation Errors</AlertTitle>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {validation.conditions.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </Alert>
            )}
          </Box>
        );
        
      case 2: // Cards & Actions
        return (
          <Box sx={{ mt: 2 }}>
            <Alert severity="warning" sx={{ mb: 2 }}>
              <AlertTitle>Cards (Required)</AlertTitle>
              At least one card is required. Cards display alerts to users.
            </Alert>
            
            <Stack spacing={2}>
              {hook.cards?.map((card, index) => (
                <CardBuilder
                  key={index}
                  card={card}
                  onChange={(updatedCard) => {
                    const newCards = [...hook.cards];
                    newCards[index] = updatedCard;
                    updateHook({ cards: newCards });
                  }}
                  onRemove={() => {
                    const newCards = hook.cards.filter((_, i) => i !== index);
                    updateHook({ cards: newCards });
                  }}
                />
              ))}
              
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => {
                  updateHook({
                    cards: [...(hook.cards || []), {
                      summary: '',
                      detail: '',
                      indicator: 'info',
                      source: { label: 'CDS System' }
                    }]
                  });
                }}
              >
                Add Card
              </Button>
            </Stack>
            
            {validation.cards.errors.length > 0 && (
              <Alert severity="error" sx={{ mt: 2 }}>
                <AlertTitle>Validation Errors</AlertTitle>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {validation.cards.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </Alert>
            )}
          </Box>
        );
        
      case 3: // Advanced Settings
        return (
          <Box sx={{ mt: 2 }}>
            <Alert severity="info" sx={{ mb: 2 }}>
              <AlertTitle>Advanced Settings (Optional)</AlertTitle>
              Configure display behavior, prefetch queries, and other advanced options.
            </Alert>
            
            <Stack spacing={3}>
              {/* Display Behavior Configuration */}
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Display Behavior
                </Typography>
                <DisplayBehaviorConfiguration
                  config={hook.displayBehavior || {}}
                  onChange={(behavior) => updateHook({ displayBehavior: behavior })}
                />
              </Paper>
              
              {/* Prefetch Query Builder */}
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Prefetch Queries
                </Typography>
                <PrefetchQueryBuilder
                  queries={hook.prefetch || {}}
                  onChange={(prefetch) => updateHook({ prefetch })}
                />
              </Paper>
            </Stack>
          </Box>
        );
        
      case 4: // Review & Test
        return (
          <Box sx={{ mt: 2 }}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Hook Summary
                    </Typography>
                    <Stack spacing={1}>
                      <Typography variant="body2">
                        <strong>Title:</strong> {hook.title || 'Not set'}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Type:</strong> {hook.hook}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Status:</strong> {hook.enabled ? 'Enabled' : 'Disabled'}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Conditions:</strong> {hook.conditions?.length || 0}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Cards:</strong> {hook.cards?.length || 0}
                      </Typography>
                    </Stack>
                  </CardContent>
                  <CardActions>
                    <Button
                      startIcon={<PreviewIcon />}
                      onClick={() => setShowPreview(true)}
                    >
                      Preview
                    </Button>
                    <Button
                      startIcon={<TestIcon />}
                      onClick={testHook}
                    >
                      Test
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Validation Status
                    </Typography>
                    <Stack spacing={1}>
                      <Box display="flex" alignItems="center" gap={1}>
                        {validation.basicInfo.isValid ? <CheckIcon color="success" /> : <ErrorIcon color="error" />}
                        <Typography variant="body2">Basic Information</Typography>
                      </Box>
                      <Box display="flex" alignItems="center" gap={1}>
                        {validation.conditions.isValid ? <CheckIcon color="success" /> : <ErrorIcon color="error" />}
                        <Typography variant="body2">Conditions</Typography>
                      </Box>
                      <Box display="flex" alignItems="center" gap={1}>
                        {validation.cards.isValid ? <CheckIcon color="success" /> : <ErrorIcon color="error" />}
                        <Typography variant="body2">Cards & Actions</Typography>
                      </Box>
                      <Box display="flex" alignItems="center" gap={1}>
                        {(validation.advanced?.isValid ?? true) ? <CheckIcon color="success" /> : <ErrorIcon color="error" />}
                        <Typography variant="body2">Advanced Settings</Typography>
                      </Box>
                    </Stack>
                    
                    {validation.overall.errors.length > 0 && (
                      <Alert severity="error" sx={{ mt: 2 }}>
                        <AlertTitle>Please fix these issues:</AlertTitle>
                        <ul style={{ margin: 0, paddingLeft: 20 }}>
                          {validation.overall.errors.map((error, index) => (
                            <li key={index}>{error}</li>
                          ))}
                        </ul>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              </Grid>
              
              {testResults && (
                <Grid item xs={12}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Test Results
                      </Typography>
                      <pre style={{ overflow: 'auto' }}>
                        {JSON.stringify(testResults, null, 2)}
                      </pre>
                    </CardContent>
                  </Card>
                </Grid>
              )}
            </Grid>
          </Box>
        );
        
      default:
        return null;
    }
  };
  
  // Get step icon based on validation
  const getStepIcon = (step) => {
    const isValid = step === 0 ? validation.basicInfo.isValid :
                   step === 1 ? validation.conditions.isValid :
                   step === 2 ? validation.cards.isValid :
                   step === 3 ? (validation.advanced?.isValid ?? true) :
                   validation.overall.isValid;
    
    if (step < activeStep) {
      return isValid ? <CheckIcon /> : <ErrorIcon />;
    } else if (step === activeStep) {
      return <RadioButtonUnchecked />;
    } else {
      return <PendingIcon />;
    }
  };
  
  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h5">
            {hook.id ? 'Edit CDS Hook' : 'Create New CDS Hook'}
          </Typography>
          
          <Stack direction="row" spacing={2} alignItems="center">
            {/* Auto-save indicator */}
            {autoSaveEnabled && lastSaved && (
              <Fade in>
                <Chip
                  icon={<TimerIcon />}
                  label={`Auto-saved ${new Date(lastSaved).toLocaleTimeString()}`}
                  size="small"
                  color="success"
                  variant="outlined"
                />
              </Fade>
            )}
            
            {/* Save progress */}
            {saving && <CircularProgress size={20} />}
            
            {/* Auto-save toggle */}
            <FormControlLabel
              control={
                <Checkbox
                  checked={autoSaveEnabled}
                  onChange={(e) => setAutoSaveEnabled(e.target.checked)}
                  size="small"
                />
              }
              label="Auto-save"
            />
            
            {/* Action buttons */}
            <Button
              variant="outlined"
              onClick={() => context.actions.switchMode('manage')}
            >
              Cancel
            </Button>
            
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={saveHook}
              disabled={!validation.overall.isValid || saving}
              color={validation.overall.isValid ? 'primary' : 'inherit'}
            >
              Save Hook
            </Button>
          </Stack>
        </Stack>
        
        {/* Validation summary */}
        {validation.overall.errors.length > 0 && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {validation.overall.errors.length} validation error{validation.overall.errors.length !== 1 ? 's' : ''} found
          </Alert>
        )}
      </Paper>
      
      {/* Main content */}
      <Paper sx={{ flexGrow: 1, overflow: 'auto', p: 3 }}>
        <Grid container spacing={3}>
          {/* Stepper */}
          <Grid item xs={12} md={3}>
            <Stepper activeStep={activeStep} orientation="vertical">
              {STEPS.map((label, index) => (
                <Step key={label}>
                  <StepLabel
                    StepIconComponent={() => getStepIcon(index)}
                    onClick={() => setActiveStep(index)}
                    sx={{ cursor: 'pointer' }}
                  >
                    {label}
                  </StepLabel>
                </Step>
              ))}
            </Stepper>
          </Grid>
          
          {/* Step content */}
          <Grid item xs={12} md={9}>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                {renderStepContent(activeStep)}
              </motion.div>
            </AnimatePresence>
            
            {/* Navigation buttons */}
            <Box sx={{ mt: 4, display: 'flex', justifyContent: 'space-between' }}>
              <Button
                startIcon={<BackIcon />}
                onClick={handleBack}
                disabled={activeStep === 0}
              >
                Back
              </Button>
              
              {activeStep < STEPS.length - 1 ? (
                <Button
                  variant="contained"
                  endIcon={<NextIcon />}
                  onClick={handleNext}
                >
                  Next
                </Button>
              ) : (
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<SaveIcon />}
                  onClick={saveHook}
                  disabled={!validation.overall.isValid || saving}
                >
                  Save Hook
                </Button>
              )}
            </Box>
          </Grid>
        </Grid>
      </Paper>
      
      {/* Template Dialog */}
      <Dialog
        open={showTemplates}
        onClose={() => setShowTemplates(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Select a Template</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {HOOK_TEMPLATES.map((template) => (
              <Grid item xs={12} md={6} key={template.id}>
                <Card
                  sx={{
                    cursor: 'pointer',
                    '&:hover': {
                      boxShadow: 4,
                      transform: 'translateY(-2px)',
                      transition: 'all 0.2s'
                    }
                  }}
                  onClick={() => selectTemplate(template)}
                >
                  <CardContent>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Box sx={{ color: theme.palette.primary.main }}>
                        {template.icon}
                      </Box>
                      <Box>
                        <Typography variant="h6">{template.name}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {template.description}
                        </Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowTemplates(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>
      
      {/* Preview Dialog */}
      <Dialog
        open={showPreview}
        onClose={() => setShowPreview(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Hook Preview</DialogTitle>
        <DialogContent>
          <Typography variant="h6" gutterBottom>
            {hook.title}
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            {hook.description}
          </Typography>
          
          <Divider sx={{ my: 2 }} />
          
          <Typography variant="subtitle1" gutterBottom>
            Cards Preview:
          </Typography>
          <Stack spacing={2}>
            {hook.cards?.map((card, index) => (
              <CDSCardDisplay
                key={index}
                card={card}
                displayBehavior={{ presentationMode: 'inline' }}
              />
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPreview(false)}>Close</Button>
        </DialogActions>
      </Dialog>
      
      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default CDSBuildModeEnhanced;