/**
 * CDS Hook Builder Component
 * Visual interface for creating and editing CDS hooks
 * 
 * Enhanced with templates, auto-save, validation feedback, and preview
 * @updated 2025-01-27
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Stack,
  Card,
  CardContent,
  CardActions,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Switch,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  AlertTitle,
  Divider,
  Tooltip,
  CircularProgress,
  Snackbar,
  Badge,
  Tabs,
  Tab,
  LinearProgress,
  useTheme
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Preview as PreviewIcon,
  Code as CodeIcon,
  Build as BuildIcon,
  Psychology as CDSIcon,
  ExpandMore as ExpandMoreIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Error as ErrorIcon,
  CheckCircle as SuccessIcon,
  PlayArrow as TestIcon,
  Timer as TimerIcon,
  Category as TemplateIcon,
  Visibility,
  AutoFixHigh as AutoSaveIcon
} from '@mui/icons-material';
import { cdsHooksClient } from '../../../../services/cdsHooksClient';
import { cdsHooksService } from '../../../../services/cdsHooksService';
import LabValueConditionBuilder from './conditions/LabValueConditionBuilder';
import VitalSignConditionBuilder from './conditions/VitalSignConditionBuilder';
import MedicalConditionBuilder from './conditions/MedicalConditionBuilder';
import AgeConditionBuilder from './conditions/AgeConditionBuilder';
import GenderConditionBuilder from './conditions/GenderConditionBuilder';
import MedicationConditionBuilder from './conditions/MedicationConditionBuilder';
import CardBuilder from './CardBuilder';
import SuggestionBuilder from './SuggestionBuilder';
import DisplayBehaviorConfiguration from './DisplayBehaviorConfiguration';
import PrefetchQueryBuilder from './PrefetchQueryBuilder';
import CDSCardDisplay from './CDSCardDisplay';

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
          id: 'med-condition-1',
          type: 'medication',
          enabled: true
        }
      ],
      cards: [
        {
          summary: 'Potential Drug Interaction Detected',
          detail: 'The prescribed medication may interact with the patient\'s current medications.',
          indicator: 'warning',
          source: { label: 'Drug Interaction Database' },
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
          id: 'allergy-condition-1',
          type: 'allergy',
          enabled: true
        }
      ],
      cards: [
        {
          summary: 'Allergy Alert',
          detail: 'Patient has a documented allergy to this medication or medication class.',
          indicator: 'critical',
          source: { label: 'Allergy Records' },
          overrideReasonRequired: true
        }
      ]
    }
  }
];

const HOOK_TYPES = [
  { value: 'patient-view', label: 'Patient View', description: 'Fired when user is viewing a patient' },
  { value: 'medication-prescribe', label: 'Medication Prescribe', description: 'Fired when prescribing medication' },
  { value: 'order-sign', label: 'Order Sign', description: 'Fired when signing orders' },
  { value: 'order-select', label: 'Order Select', description: 'Fired when selecting orders' }
];

const CARD_INDICATORS = [
  { value: 'info', label: 'Info', color: 'info', icon: <InfoIcon /> },
  { value: 'warning', label: 'Warning', color: 'warning', icon: <WarningIcon /> },
  { value: 'critical', label: 'Critical', color: 'error', icon: <ErrorIcon /> }
];

const CONDITION_TYPES = [
  { value: 'age', label: 'Patient Age', description: 'Age-based conditions' },
  { value: 'gender', label: 'Patient Gender', description: 'Gender-based conditions' },
  { value: 'condition', label: 'Medical Condition', description: 'Presence of specific conditions' },
  { value: 'medication', label: 'Current Medication', description: 'Patient on specific medications' },
  { value: 'lab_value', label: 'Lab Value', description: 'Lab results meeting criteria' },
  { value: 'vital_sign', label: 'Vital Sign', description: 'Vital signs meeting criteria' }
];

const CDSHookBuilder = ({ onSave, onCancel, editingHook = null }) => {
  const theme = useTheme();
  const [activeStep, setActiveStep] = useState(0);
  const [hookData, setHookData] = useState({
    id: '',
    title: '',
    description: '',
    hook: 'patient-view',
    enabled: true,
    conditions: [],
    cards: [],
    prefetch: {},
    displayBehavior: {
      displayMode: 'immediate',
      position: 'top',
      maxCards: 10,
      priority: 'critical-first'
    }
  });
  const [testResults, setTestResults] = useState(null);
  const [testing, setTesting] = useState(false);
  
  // Enhanced features
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [lastSaved, setLastSaved] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [validation, setValidation] = useState({
    basicInfo: { isValid: true, errors: [] },
    conditions: { isValid: true, errors: [] },
    cards: { isValid: true, errors: [] },
    overall: { isValid: true, errors: [] }
  });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const autoSaveTimer = useRef(null);

  // Initialize with editing data
  useEffect(() => {
    console.log('[CDSHookBuilder] editingHook prop:', editingHook);
    if (editingHook) {
      const newHookData = {
        id: editingHook.id || '',
        title: editingHook.title || '',
        description: editingHook.description || '',
        hook: editingHook.hook || 'patient-view',
        enabled: editingHook.enabled !== undefined ? editingHook.enabled : true,
        conditions: editingHook.conditions || [],
        cards: editingHook.cards || [],
        prefetch: editingHook.prefetch || {},
        displayBehavior: editingHook.displayBehavior || {
          displayMode: 'immediate',
          position: 'top',
          maxCards: 10,
          priority: 'critical-first'
        }
      };
      console.log('[CDSHookBuilder] Setting hookData to:', newHookData);
      setHookData(newHookData);
      // Validate initial data
      validateHook(newHookData);
    }
  }, [editingHook]);

  // Auto-save functionality
  useEffect(() => {
    if (autoSaveEnabled && hookData.title && hookData.id) {
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
  }, [hookData, autoSaveEnabled]);

  // Validation function
  const validateHook = useCallback((data = hookData) => {
    const newValidation = {
      basicInfo: { isValid: true, errors: [] },
      conditions: { isValid: true, errors: [] },
      cards: { isValid: true, errors: [] },
      overall: { isValid: true, errors: [] }
    };
    
    // Basic info validation
    if (!data.title?.trim()) {
      newValidation.basicInfo.errors.push('Title is required');
      newValidation.basicInfo.isValid = false;
    }
    if (!data.id?.trim()) {
      newValidation.basicInfo.errors.push('Hook ID is required');
      newValidation.basicInfo.isValid = false;
    }
    
    // Cards validation
    if (!data.cards || data.cards.length === 0) {
      newValidation.cards.errors.push('At least one card is required');
      newValidation.cards.isValid = false;
    } else {
      data.cards.forEach((card, index) => {
        if (!card.summary?.trim()) {
          newValidation.cards.errors.push(`Card ${index + 1}: Summary is required`);
          newValidation.cards.isValid = false;
        }
      });
    }
    
    // Overall validation
    newValidation.overall.isValid = 
      newValidation.basicInfo.isValid && 
      newValidation.conditions.isValid && 
      newValidation.cards.isValid;
    
    newValidation.overall.errors = [
      ...newValidation.basicInfo.errors,
      ...newValidation.conditions.errors,
      ...newValidation.cards.errors
    ];
    
    setValidation(newValidation);
    return newValidation;
  }, [hookData]);

  // Auto-save function
  const autoSave = useCallback(async () => {
    const validation = validateHook();
    if (!validation.overall.isValid) return;
    
    setSaving(true);
    try {
      // Save to local storage as draft
      localStorage.setItem(`cds-hook-draft-${hookData.id}`, JSON.stringify(hookData));
      setLastSaved(new Date());
      setSnackbar({
        open: true,
        message: 'Draft saved',
        severity: 'success'
      });
    } catch (error) {
      console.error('Auto-save failed:', error);
    } finally {
      setSaving(false);
    }
  }, [hookData, validateHook]);

  // Template selection
  const selectTemplate = (template) => {
    const newHookData = {
      ...hookData,
      ...template.template,
      id: hookData.id || template.template.title.toLowerCase().replace(/\s+/g, '-')
    };
    
    setHookData(newHookData);
    setShowTemplates(false);
    validateHook(newHookData);
    
    setSnackbar({
      open: true,
      message: `Template "${template.name}" applied`,
      severity: 'info'
    });
  };

  const steps = [
    {
      label: 'Basic Information',
      description: 'Define hook metadata'
    },
    {
      label: 'Conditions',
      description: 'Set triggering conditions'
    },
    {
      label: 'Cards & Suggestions',
      description: 'Design response cards'
    },
    {
      label: 'Prefetch Queries',
      description: 'Configure data prefetching'
    },
    {
      label: 'Display Behavior',
      description: 'Configure display options'
    },
    {
      label: 'Test & Save',
      description: 'Test and save the hook'
    }
  ];

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const addCondition = () => {
    const newCondition = {
      id: Date.now(),
      type: 'age',
      operator: 'gt',
      value: '',
      enabled: true
    };
    setHookData(prev => ({
      ...prev,
      conditions: [...prev.conditions, newCondition]
    }));
  };

  const updateCondition = (conditionId, updates) => {
    setHookData(prev => ({
      ...prev,
      conditions: prev.conditions.map(cond => 
        cond.id === conditionId ? { ...cond, ...updates } : cond
      )
    }));
  };

  const removeCondition = (conditionId) => {
    setHookData(prev => ({
      ...prev,
      conditions: prev.conditions.filter(cond => cond.id !== conditionId)
    }));
  };

  const addCard = () => {
    const newCard = {
      id: Date.now(),
      summary: '',
      detail: '',
      indicator: 'info',
      suggestions: [],
      links: []
    };
    setHookData(prev => ({
      ...prev,
      cards: [...prev.cards, newCard]
    }));
  };

  const updateCard = (cardId, updates) => {
    setHookData(prev => ({
      ...prev,
      cards: prev.cards.map(card => 
        card.id === cardId ? { ...card, ...updates } : card
      )
    }));
  };

  const removeCard = (cardId) => {
    setHookData(prev => ({
      ...prev,
      cards: prev.cards.filter(card => card.id !== cardId)
    }));
  };

  const testHook = async () => {
    setTesting(true);
    try {
      // Use the cdsHooksService to test the hook
      const startTime = Date.now();
      const result = await cdsHooksService.testHook(hookData, {
        patientId: 'test-patient-123',
        userId: 'test-user'
      });

      const executionTime = Date.now() - startTime;

      if (result.success) {
        setTestResults({
          success: true,
          cards: result.data.cards || [],
          executionTime: executionTime
        });
      } else {
        setTestResults({
          success: false,
          error: result.error || 'Test failed',
          executionTime: executionTime
        });
      }
    } catch (error) {
      setTestResults({
        success: false,
        error: error.message,
        executionTime: 0
      });
    } finally {
      setTesting(false);
    }
  };

  const saveHook = async () => {
    try {
      // Validate before saving
      const validation = validateHook();
      
      if (!validation.overall.isValid) {
        setSnackbar({
          open: true,
          message: 'Please fix validation errors before saving',
          severity: 'error'
        });
        return;
      }

      setSaving(true);
      
      // Log the display behavior being saved
      console.log('[CDSHookBuilder] Saving hook with displayBehavior:', hookData.displayBehavior);
      
      // Use the cdsHooksService to save the hook
      // Check if we're editing an existing hook (has _meta.created)
      const isExistingHook = editingHook && editingHook._meta?.created;
      
      try {
        if (isExistingHook) {
          // Update existing hook
          await cdsHooksService.updateHook(hookData.id, hookData);
        } else {
          // Create new hook
          await cdsHooksService.createHook(hookData);
        }
      } catch (saveError) {
        // If update fails with 404, try creating instead
        if (saveError.message?.includes('404') || saveError.message?.includes('not found')) {
          console.log('Hook not found, creating new one instead');
          await cdsHooksService.createHook(hookData);
        } else {
          throw saveError;
        }
      }

      // Call the parent onSave callback to close the builder and refresh
      const success = await onSave(hookData);
      
      if (success !== false) {
        setSnackbar({
          open: true,
          message: 'Hook saved successfully!',
          severity: 'success'
        });
        
        // Clear draft
        localStorage.removeItem(`cds-hook-draft-${hookData.id}`);
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: `Error saving hook: ${error.message}`,
        severity: 'error'
      });
    } finally {
      setSaving(false);
    }
  };

  const renderBasicInfo = () => (
    <Box sx={{ mt: 2 }}>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Button
            variant="outlined"
            startIcon={<TemplateIcon />}
            onClick={() => setShowTemplates(true)}
            fullWidth
            sx={{ mb: 2 }}
          >
            Use Template
          </Button>
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Hook ID"
            value={hookData.id}
            onChange={(e) => {
              setHookData(prev => ({ ...prev, id: e.target.value }));
              validateHook({ ...hookData, id: e.target.value });
            }}
            placeholder="my-custom-hook"
            helperText="Unique identifier for this hook"
            required
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Title"
            value={hookData.title}
            onChange={(e) => {
              setHookData(prev => ({ ...prev, title: e.target.value }));
              validateHook({ ...hookData, title: e.target.value });
            }}
            placeholder="My Custom CDS Hook"
            required
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Description"
            value={hookData.description}
            onChange={(e) => setHookData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Describe what this hook does and when it triggers"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel>Hook Type</InputLabel>
            <Select
              value={hookData.hook}
              label="Hook Type"
              onChange={(e) => setHookData(prev => ({ ...prev, hook: e.target.value }))}
            >
              {HOOK_TYPES.map(type => (
                <MenuItem key={type.value} value={type.value}>
                  <Box>
                    <Typography variant="body1">{type.label}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {type.description}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={6}>
          <FormControlLabel
            control={
              <Switch
                checked={hookData.enabled}
                onChange={(e) => setHookData(prev => ({ ...prev, enabled: e.target.checked }))}
              />
            }
            label="Enabled"
          />
        </Grid>
      </Grid>
    </Box>
  );

  const renderConditions = () => (
    <Box sx={{ mt: 2 }}>
      <Stack spacing={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Triggering Conditions</Typography>
          <Button startIcon={<AddIcon />} onClick={addCondition}>
            Add Condition
          </Button>
        </Stack>
        
        {(!hookData.conditions || hookData.conditions.length === 0) ? (
          <Alert severity="info">
            No conditions defined. This hook will trigger for all patients.
          </Alert>
        ) : (
          hookData.conditions.map((condition) => (
            <Card key={condition.id} variant="outlined">
              <CardContent>
                <Stack spacing={2}>
                  {/* Condition Type Selector */}
                  <FormControl fullWidth>
                    <InputLabel>Condition Type</InputLabel>
                    <Select
                      value={condition.type}
                      label="Condition Type"
                      onChange={(e) => updateCondition(condition.id, { type: e.target.value })}
                      data-testid="condition-type-select"
                    >
                      {CONDITION_TYPES.map(type => (
                        <MenuItem key={type.value} value={type.value}>
                          <Stack>
                            <Typography>{type.label}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {type.description}
                            </Typography>
                          </Stack>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  {/* Dynamic Condition Builder based on type */}
                  {condition.type === 'lab_value' && (
                    <LabValueConditionBuilder
                      condition={condition}
                      onChange={(updates) => updateCondition(condition.id, updates)}
                      onRemove={() => removeCondition(condition.id)}
                    />
                  )}
                  
                  {condition.type === 'vital_sign' && (
                    <VitalSignConditionBuilder
                      condition={condition}
                      onChange={(updates) => updateCondition(condition.id, updates)}
                      onRemove={() => removeCondition(condition.id)}
                    />
                  )}
                  
                  {condition.type === 'condition' && (
                    <MedicalConditionBuilder
                      condition={condition}
                      onChange={(updates) => updateCondition(condition.id, updates)}
                      onRemove={() => removeCondition(condition.id)}
                    />
                  )}
                  
                  {condition.type === 'age' && (
                    <AgeConditionBuilder
                      condition={condition}
                      onChange={(updates) => updateCondition(condition.id, updates)}
                    />
                  )}
                  
                  {condition.type === 'gender' && (
                    <GenderConditionBuilder
                      condition={condition}
                      onChange={(updates) => updateCondition(condition.id, updates)}
                    />
                  )}
                  
                  {condition.type === 'medication' && (
                    <MedicationConditionBuilder
                      condition={condition}
                      onChange={(updates) => updateCondition(condition.id, updates)}
                    />
                  )}
                  
                  {/* Default builder for other condition types */}
                  {!['lab_value', 'vital_sign', 'condition', 'age', 'gender', 'medication'].includes(condition.type) && (
                    <Grid container spacing={2} alignItems="center">
                      <Grid item xs={12} md={4}>
                        <FormControl fullWidth>
                          <InputLabel>Operator</InputLabel>
                          <Select
                            value={condition.operator}
                            label="Operator"
                            onChange={(e) => updateCondition(condition.id, { operator: e.target.value })}
                            data-testid="operator-select"
                          >
                            <MenuItem value="equals">Equals</MenuItem>
                            <MenuItem value="greater_than">Greater Than</MenuItem>
                            <MenuItem value="less_than">Less Than</MenuItem>
                            <MenuItem value="contains">Contains</MenuItem>
                            <MenuItem value="exists">Exists</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="Value"
                          value={condition.value}
                          onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
                          placeholder="Enter condition value"
                        />
                      </Grid>
                    </Grid>
                  )}

                  {/* Common controls for all condition types */}
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <FormControlLabel
                      control={
                        <Switch
                          checked={condition.enabled}
                          onChange={(e) => updateCondition(condition.id, { enabled: e.target.checked })}
                        />
                      }
                      label="Enabled"
                    />
                    <IconButton 
                      color="error"
                      onClick={() => removeCondition(condition.id)}
                      aria-label="Remove condition"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          ))
        )}
      </Stack>
    </Box>
  );

  const renderCardsAndSuggestions = () => (
    <Box sx={{ mt: 2 }}>
      <Stack spacing={3}>
        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="h6">Response Cards</Typography>
            <Button startIcon={<AddIcon />} onClick={addCard}>
              Add Card
            </Button>
          </Stack>
          
          {hookData.cards.length === 0 ? (
            <Alert severity="warning">
              At least one card must be defined for the hook to provide feedback.
            </Alert>
          ) : (
            hookData.cards.map((card) => (
              <CardBuilder
                key={card.id}
                card={card}
                onChange={(updates) => updateCard(card.id, updates)}
                onRemove={() => removeCard(card.id)}
              />
            ))
          )}
        </Box>

        <Divider />

        <Box>
          <Typography variant="h6" gutterBottom>
            Suggestions
          </Typography>
          <SuggestionBuilder
            suggestions={(hookData.cards || []).reduce((acc, card) => {
              return [...acc, ...(card.suggestions || [])];
            }, [])}
            onChange={(suggestions) => {
              // Distribute suggestions across cards
              if (hookData.cards && hookData.cards.length > 0) {
                updateCard(hookData.cards[0].id, { suggestions });
              }
            }}
          />
        </Box>
      </Stack>
    </Box>
  );

  const renderPrefetchQueries = () => (
    <Box sx={{ mt: 2 }}>
      <PrefetchQueryBuilder
        queries={hookData.prefetch}
        onChange={(prefetch) => setHookData({ ...hookData, prefetch })}
      />
    </Box>
  );

  const renderDisplayBehavior = () => (
    <Box sx={{ mt: 2 }}>
      <DisplayBehaviorConfiguration
        config={hookData.displayBehavior}
        onChange={(displayBehavior) => setHookData({ ...hookData, displayBehavior })}
      />
    </Box>
  );

  const renderTestAndSave = () => (
    <Box sx={{ mt: 2 }}>
      <Stack spacing={3}>
        <Typography variant="h6">Test & Save Hook</Typography>
        
        {/* Hook Summary */}
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle1" gutterBottom>Hook Summary</Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">ID:</Typography>
                <Typography variant="body1">{hookData.id || 'Not set'}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">Type:</Typography>
                <Typography variant="body1">{hookData.hook}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">Conditions:</Typography>
                <Typography variant="body1">{hookData.conditions?.length || 0} defined</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">Cards:</Typography>
                <Typography variant="body1">{hookData.cards?.length || 0} defined</Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Test Results */}
        {testResults && (
          <Card variant="outlined">
            <CardContent>
              <Stack spacing={2}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Typography variant="subtitle1">Test Results</Typography>
                  {testResults.success ? (
                    <Chip label="Success" color="success" icon={<SuccessIcon />} />
                  ) : (
                    <Chip label="Error" color="error" icon={<ErrorIcon />} />
                  )}
                  <Typography variant="caption" color="text.secondary">
                    Execution time: {testResults.executionTime}ms
                  </Typography>
                </Stack>
                
                {testResults.success ? (
                  <Box>
                    <Typography variant="body2" gutterBottom>
                      Generated {testResults.cards.length} card(s):
                    </Typography>
                    {testResults.cards.map((card, index) => (
                      <Alert 
                        key={index}
                        severity={card.indicator === 'critical' ? 'error' : card.indicator === 'warning' ? 'warning' : 'info'}
                        sx={{ mt: 1 }}
                      >
                        <Typography variant="subtitle2">{card.summary}</Typography>
                        <Typography variant="body2">{card.detail}</Typography>
                      </Alert>
                    ))}
                  </Box>
                ) : (
                  <Alert severity="error">
                    Test failed: {testResults.error}
                  </Alert>
                )}
              </Stack>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            startIcon={testing ? <CircularProgress size={20} /> : <TestIcon />}
            onClick={testHook}
            disabled={testing || !hookData.id || hookData.cards.length === 0}
          >
            {testing ? 'Testing...' : 'Test Hook'}
          </Button>
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
            onClick={saveHook}
            disabled={saving || !validation.overall.isValid}
          >
            {saving ? 'Saving...' : 'Save Hook'}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );

  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <BuildIcon color="primary" />
          <Typography variant="h5" fontWeight="bold">
            CDS Hook Builder
          </Typography>
          {hookData.id && (
            <Chip 
              label={editingHook ? 'Editing' : 'New'} 
              color={editingHook ? 'primary' : 'secondary'} 
              size="small" 
            />
          )}
        </Stack>
        
        <Stack direction="row" spacing={2} alignItems="center">
          {/* Validation status */}
          {validation.overall.errors.length > 0 && (
            <Chip
              icon={<WarningIcon />}
              label={`${validation.overall.errors.length} issues`}
              color="warning"
              size="small"
            />
          )}
          
          {/* Auto-save indicator */}
          {autoSaveEnabled && lastSaved && (
            <Chip
              icon={<TimerIcon />}
              label={`Saved ${new Date(lastSaved).toLocaleTimeString()}`}
              color="success"
              variant="outlined"
              size="small"
            />
          )}
          
          {/* Save progress */}
          {saving && <CircularProgress size={20} />}
          
          {/* Preview button */}
          <IconButton onClick={() => setShowPreview(true)} color="primary">
            <Visibility />
          </IconButton>
        </Stack>
      </Stack>
      
      {/* Validation summary */}
      {validation.overall.errors.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <AlertTitle>Please fix the following issues:</AlertTitle>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {validation.overall.errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </Alert>
      )}
      
      {/* Auto-save toggle */}
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <FormControlLabel
          control={
            <Switch
              checked={autoSaveEnabled}
              onChange={(e) => setAutoSaveEnabled(e.target.checked)}
              size="small"
            />
          }
          label="Auto-save"
        />
      </Stack>

      <Stepper activeStep={activeStep} orientation="vertical">
        {steps.map((step, index) => (
          <Step key={step.label}>
            <StepLabel>
              <Typography variant="h6">{step.label}</Typography>
              <Typography variant="body2" color="text.secondary">
                {step.description}
              </Typography>
            </StepLabel>
            <StepContent>
              {index === 0 && renderBasicInfo()}
              {index === 1 && renderConditions()}
              {index === 2 && renderCardsAndSuggestions()}
              {index === 3 && renderPrefetchQueries()}
              {index === 4 && renderDisplayBehavior()}
              {index === 5 && renderTestAndSave()}
              
              <Box sx={{ mb: 2, mt: 2 }}>
                <div>
                  <Button
                    variant="contained"
                    onClick={handleNext}
                    sx={{ mt: 1, mr: 1 }}
                    disabled={index === steps.length - 1}
                  >
                    {index === steps.length - 1 ? 'Finish' : 'Continue'}
                  </Button>
                  <Button
                    disabled={index === 0}
                    onClick={handleBack}
                    sx={{ mt: 1, mr: 1 }}
                  >
                    Back
                  </Button>
                  {index === 0 && onCancel && (
                    <Button
                      onClick={onCancel}
                      sx={{ mt: 1 }}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </Box>
            </StepContent>
          </Step>
        ))}
      </Stepper>
      
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
            {hookData.title || 'Untitled Hook'}
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            {hookData.description || 'No description provided'}
          </Typography>
          
          <Divider sx={{ my: 2 }} />
          
          <Typography variant="subtitle1" gutterBottom>
            Cards Preview:
          </Typography>
          <Stack spacing={2}>
            {hookData.cards?.map((card, index) => (
              <CDSCardDisplay
                key={index}
                card={card}
                displayBehavior={{ presentationMode: 'inline' }}
              />
            )) || <Typography color="text.secondary">No cards defined</Typography>}
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
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Paper>
  );
};

export default CDSHookBuilder;