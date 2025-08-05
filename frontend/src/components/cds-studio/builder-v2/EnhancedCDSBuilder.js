/**
 * Enhanced CDS Builder Component
 * Production-focused CDS service builder using WintEHR's proven condition-based approach
 * Integrates with WintEHR's dynamic catalog system and focuses on Clinical Workspace integration
 * 
 * Based on existing CDSHookBuilder but enhanced with:
 * - Dynamic catalog integration via CatalogIntegrationService
 * - Production-ready service generation that complies with CDS Hooks 2.0
 * - Real Clinical Workspace integration
 * - Leverages existing condition builders with catalog data
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
  Grid,
  Alert,
  AlertTitle,
  Divider,
  CircularProgress,
  Snackbar,
  FormControlLabel,
  Switch,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  Badge,
  useTheme
} from '@mui/material';
import {
  Build as BuildIcon,
  Save as SaveIcon,
  PlayArrow as TestIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Error as ErrorIcon,
  CheckCircle as SuccessIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Visibility as PreviewIcon,
  Category as TemplateIcon,
  Timer as TimerIcon,
  Refresh as RefreshIcon,
  Psychology as CDSIcon
} from '@mui/icons-material';

// Import existing proven condition builders
import LabValueConditionBuilder from '../../clinical/workspace/cds/conditions/LabValueConditionBuilder';
import VitalSignConditionBuilder from '../../clinical/workspace/cds/conditions/VitalSignConditionBuilder';
import MedicalConditionBuilder from '../../clinical/workspace/cds/conditions/MedicalConditionBuilder';
import AgeConditionBuilder from '../../clinical/workspace/cds/conditions/AgeConditionBuilder';
import GenderConditionBuilder from '../../clinical/workspace/cds/conditions/GenderConditionBuilder';
import MedicationConditionBuilder from '../../clinical/workspace/cds/conditions/MedicationConditionBuilder';
import CardBuilder from '../../clinical/workspace/cds/CardBuilder';
import SuggestionBuilder from '../../clinical/workspace/cds/SuggestionBuilder';
import DisplayBehaviorConfiguration from '../../clinical/workspace/cds/DisplayBehaviorConfiguration';
import PrefetchQueryBuilder from '../../clinical/workspace/cds/PrefetchQueryBuilder';
import CDSCardDisplay from '../../clinical/workspace/cds/CDSCardDisplay';

// Import services
import { cdsHooksClient } from '../../../services/cdsHooksClient';
import { cdsHooksService } from '../../../services/cdsHooksService';
import { catalogIntegrationService } from '../../../services/CatalogIntegrationService';

// Enhanced hook templates with catalog integration
const ENHANCED_HOOK_TEMPLATES = [
  {
    id: 'drug-interaction-catalog',
    name: 'Drug Interaction Alert (Catalog-Enhanced)',
    description: 'Alert for potential drug interactions using dynamic medication catalog',
    icon: <WarningIcon />,
    hook: 'medication-prescribe',
    template: {
      title: 'Drug Interaction Checker with Catalog Data',
      description: 'Checks for potential drug-drug interactions using WintEHR medication catalog',
      hook: 'medication-prescribe',
      conditions: [
        {
          id: 'med-condition-catalog-1',
          type: 'medication',
          enabled: true,
          useCatalog: true,
          catalogSettings: {
            searchEnabled: true,
            suggestionLimit: 10
          }
        }
      ],
      cards: [
        {
          summary: 'Potential Drug Interaction Detected',
          detail: 'The prescribed medication may interact with the patient\'s current medications based on catalog data.',
          indicator: 'warning',
          source: { label: 'WintEHR Medication Catalog' }
        }
      ]
    }
  },
  {
    id: 'lab-alert-catalog',
    name: 'Lab Value Alert (Reference Range)',
    description: 'Alert for abnormal lab values using dynamic reference ranges',
    icon: <ErrorIcon />,
    hook: 'patient-view',
    template: {
      title: 'Lab Value Alert with Reference Ranges',
      description: 'Alerts when lab values are outside normal ranges from catalog',
      hook: 'patient-view',
      conditions: [
        {
          id: 'lab-condition-catalog-1',
          type: 'lab_value',
          enabled: true,
          useCatalog: true,
          catalogSettings: {
            useReferenceRanges: true,
            categoryFilter: 'chemistry'
          }
        }
      ],
      cards: [
        {
          summary: 'Abnormal Lab Value Detected',
          detail: 'Lab value is outside the normal reference range based on catalog data.',
          indicator: 'critical',
          source: { label: 'WintEHR Lab Catalog' }
        }
      ]
    }
  },
  {
    id: 'condition-screening-catalog',
    name: 'Condition-Based Screening',
    description: 'Screening alerts based on patient conditions from catalog',
    icon: <InfoIcon />,
    hook: 'patient-view',
    template: {
      title: 'Condition-Based Screening Alerts',
      description: 'Provides screening recommendations based on patient conditions',
      hook: 'patient-view',
      conditions: [
        {
          id: 'condition-screening-1',
          type: 'condition',
          enabled: true,
          useCatalog: true,
          catalogSettings: {
            includeInactive: false,
            severityFilter: ['moderate', 'severe']
          }
        }
      ],
      cards: [
        {
          summary: 'Screening Recommendation',
          detail: 'Based on the patient\'s conditions, additional screening may be recommended.',
          indicator: 'info',
          source: { label: 'Clinical Guidelines' }
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

const CONDITION_TYPES = [
  { value: 'age', label: 'Patient Age', description: 'Age-based conditions', catalogIntegration: false },
  { value: 'gender', label: 'Patient Gender', description: 'Gender-based conditions', catalogIntegration: false },
  { value: 'condition', label: 'Medical Condition', description: 'Presence of specific conditions', catalogIntegration: true },
  { value: 'medication', label: 'Current Medication', description: 'Patient on specific medications', catalogIntegration: true },
  { value: 'lab_value', label: 'Lab Value', description: 'Lab results meeting criteria', catalogIntegration: true },
  { value: 'vital_sign', label: 'Vital Sign', description: 'Vital signs meeting criteria', catalogIntegration: true }
];

const EnhancedCDSBuilder = ({ onSave, onCancel, editingHook = null }) => {
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
      defaultMode: 'popup',
      indicatorOverrides: {
        critical: 'modal',
        warning: 'popup',
        info: 'inline'
      },
      acknowledgment: {
        required: false,
        reasonRequired: false
      },
      snooze: {
        enabled: true,
        defaultDuration: 60
      }
    },
    // Enhanced features
    catalogIntegration: {
      enabled: true,
      autoRefresh: false,
      cacheTimeout: 300000 // 5 minutes
    }
  });

  // State management
  const [testResults, setTestResults] = useState(null);
  const [testing, setTesting] = useState(false);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [lastSaved, setLastSaved] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [catalogStats, setCatalogStats] = useState(null);
  const [loadingCatalogStats, setLoadingCatalogStats] = useState(false);
  const [validation, setValidation] = useState({
    basicInfo: { isValid: true, errors: [] },
    conditions: { isValid: true, errors: [] },
    cards: { isValid: true, errors: [] },
    overall: { isValid: true, errors: [] }
  });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const autoSaveTimer = useRef(null);

  // Initialize with editing data or load from draft
  useEffect(() => {
    if (editingHook) {
      const enhancedHookData = {
        ...hookData,
        ...editingHook,
        catalogIntegration: editingHook.catalogIntegration || hookData.catalogIntegration
      };
      setHookData(enhancedHookData);
      validateHook(enhancedHookData);
    } else {
      // Try to load draft from localStorage
      const draftKey = `cds-hook-draft-enhanced`;
      const draft = localStorage.getItem(draftKey);
      if (draft) {
        try {
          const parsedDraft = JSON.parse(draft);
          setHookData(parsedDraft);
          validateHook(parsedDraft);
        } catch (error) {
          console.error('Failed to load draft:', error);
        }
      }
    }
  }, [editingHook]);

  // Load catalog statistics on mount
  useEffect(() => {
    loadCatalogStatistics();
  }, []);

  // Auto-save functionality
  useEffect(() => {
    if (autoSaveEnabled && hookData.title && hookData.id) {
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
      }
      
      autoSaveTimer.current = setTimeout(() => {
        autoSave();
      }, 5000);
    }
    
    return () => {
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
      }
    };
  }, [hookData, autoSaveEnabled]);

  // Load catalog statistics
  const loadCatalogStatistics = async () => {
    setLoadingCatalogStats(true);
    try {
      const stats = await catalogIntegrationService.getCatalogStats();
      setCatalogStats(stats);
    } catch (error) {
      console.error('Failed to load catalog statistics:', error);
    } finally {
      setLoadingCatalogStats(false);
    }
  };

  // Validation function with catalog awareness
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
    
    // Conditions validation with catalog integration checks
    if (data.conditions && data.conditions.length > 0) {
      data.conditions.forEach((condition, index) => {
        if (condition.useCatalog && !condition.catalogCode && !condition.catalogSearch) {
          newValidation.conditions.errors.push(
            `Condition ${index + 1}: Catalog integration enabled but no catalog data selected`
          );
          newValidation.conditions.isValid = false;
        }
      });
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
      const draftKey = `cds-hook-draft-enhanced-${hookData.id}`;
      localStorage.setItem(draftKey, JSON.stringify(hookData));
      setLastSaved(new Date());
      setSnackbar({
        open: true,
        message: 'Draft saved with catalog integration',
        severity: 'success'
      });
    } catch (error) {
      console.error('Auto-save failed:', error);
    } finally {
      setSaving(false);
    }
  }, [hookData, validateHook]);

  // Template selection with catalog integration
  const selectTemplate = (template) => {
    const newHookData = {
      ...hookData,
      ...template.template,
      id: hookData.id || template.template.title.toLowerCase().replace(/\s+/g, '-'),
      catalogIntegration: {
        ...hookData.catalogIntegration,
        enabled: true // Enable catalog integration for templates
      }
    };
    
    setHookData(newHookData);
    setShowTemplates(false);
    validateHook(newHookData);
    
    setSnackbar({
      open: true,
      message: `Template "${template.name}" applied with catalog integration`,
      severity: 'info'
    });
  };

  // Refresh catalog data
  const refreshCatalogs = async () => {
    try {
      const result = await catalogIntegrationService.refreshCatalogs();
      if (result.success) {
        await loadCatalogStatistics();
        setSnackbar({
          open: true,
          message: 'Catalog data refreshed successfully',
          severity: 'success'
        });
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: `Failed to refresh catalogs: ${error.message}`,
        severity: 'error'
      });
    }
  };

  const steps = [
    {
      label: 'Basic Information',
      description: 'Define hook metadata and catalog settings'
    },
    {
      label: 'Catalog-Enhanced Conditions',
      description: 'Set triggering conditions with catalog integration'
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
      description: 'Test and save the production-ready hook'
    }
  ];

  // Navigation handlers
  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  // Condition management with catalog integration
  const addCondition = () => {
    const newCondition = {
      id: Date.now(),
      type: 'age',
      operator: 'gt',
      value: '',
      enabled: true,
      useCatalog: false,
      catalogSettings: {
        searchEnabled: true,
        suggestionLimit: 10,
        autoRefresh: false
      }
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

  // Card management
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

  // Test hook with catalog integration
  const testHook = async () => {
    setTesting(true);
    try {
      const startTime = Date.now();
      
      // Test with catalog-enhanced context
      const testContext = {
        patientId: 'test-patient-123',
        userId: 'test-user',
        catalogIntegration: hookData.catalogIntegration
      };
      
      const result = await cdsHooksService.testHook(hookData, testContext);
      const executionTime = Date.now() - startTime;

      if (result.success) {
        setTestResults({
          success: true,
          cards: result.data.cards || [],
          executionTime: executionTime,
          catalogData: result.data.catalogData || null
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

  // Save hook with catalog integration
  const saveHook = async () => {
    try {
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
      
      // Create production-ready hook data with catalog integration
      const productionHookData = {
        ...hookData,
        // Add metadata for production deployment
        _meta: {
          version: '2.0',
          catalogIntegrationEnabled: hookData.catalogIntegration.enabled,
          created: editingHook?._meta?.created || new Date().toISOString(),
          modified: new Date().toISOString(),
          builtWithWintEHR: true
        }
      };
      
      // Use the cdsHooksService to save
      const isExistingHook = editingHook && editingHook._meta?.created;
      
      try {
        if (isExistingHook) {
          await cdsHooksService.updateHook(hookData.id, productionHookData);
        } else {
          await cdsHooksService.createHook(productionHookData);
        }
      } catch (saveError) {
        if (saveError.message?.includes('404') || saveError.message?.includes('not found')) {
          await cdsHooksService.createHook(productionHookData);
        } else {
          throw saveError;
        }
      }

      const success = await onSave(productionHookData);
      
      if (success !== false) {
        setSnackbar({
          open: true,
          message: 'Production-ready hook saved with catalog integration!',
          severity: 'success'
        });
        
        // Clear draft
        localStorage.removeItem(`cds-hook-draft-enhanced-${hookData.id}`);
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

  // Render enhanced basic info with catalog settings
  const renderEnhancedBasicInfo = () => (
    <Box sx={{ mt: 2 }}>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Alert severity="info" icon={<CDSIcon />}>
            <AlertTitle>Enhanced CDS Builder with Catalog Integration</AlertTitle>
            This builder creates production-ready CDS Hooks 2.0 services that integrate with WintEHR's dynamic catalog system.
          </Alert>
        </Grid>
        
        {/* Catalog Statistics - Temporarily disabled to prevent rendering errors */}
        {false && catalogStats && (
          <Grid item xs={12}>
            <Card variant="outlined">
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="subtitle1">Available Catalog Data</Typography>
                  <IconButton onClick={refreshCatalogs} size="small">
                    <RefreshIcon />
                  </IconButton>
                </Stack>
                <Alert severity="info">
                  Catalog statistics temporarily disabled. Catalog integration is still fully functional.
                </Alert>
              </CardContent>
            </Card>
          </Grid>
        )}

        <Grid item xs={12}>
          <Button
            variant="outlined"
            startIcon={<TemplateIcon />}
            onClick={() => setShowTemplates(true)}
            fullWidth
            sx={{ mb: 2 }}
          >
            Use Catalog-Enhanced Template
          </Button>
        </Grid>
        
        {/* Standard hook fields */}
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Hook ID"
            value={hookData.id}
            onChange={(e) => {
              setHookData(prev => ({ ...prev, id: e.target.value }));
              validateHook({ ...hookData, id: e.target.value });
            }}
            placeholder="my-catalog-enhanced-hook"
            helperText="Unique identifier for this production hook"
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
            placeholder="My Catalog-Enhanced CDS Hook"
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
            placeholder="Describe what this hook does and how it uses catalog data"
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

        {/* Catalog Integration Settings */}
        <Grid item xs={12}>
          <Divider sx={{ my: 2 }} />
          <Typography variant="h6" gutterBottom>Catalog Integration Settings</Typography>
        </Grid>
        <Grid item xs={12} md={6}>
          <FormControlLabel
            control={
              <Switch
                checked={hookData.catalogIntegration.enabled}
                onChange={(e) => setHookData(prev => ({
                  ...prev,
                  catalogIntegration: {
                    ...prev.catalogIntegration,
                    enabled: e.target.checked
                  }
                }))}
              />
            }
            label="Enable Catalog Integration"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <FormControlLabel
            control={
              <Switch
                checked={hookData.catalogIntegration.autoRefresh}
                onChange={(e) => setHookData(prev => ({
                  ...prev,
                  catalogIntegration: {
                    ...prev.catalogIntegration,
                    autoRefresh: e.target.checked
                  }
                }))}
                disabled={!hookData.catalogIntegration.enabled}
              />
            }
            label="Auto-refresh Catalog Data"
          />
        </Grid>
      </Grid>
    </Box>
  );

  // Render catalog-enhanced conditions
  const renderCatalogEnhancedConditions = () => (
    <Box sx={{ mt: 2 }}>
      <Stack spacing={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Catalog-Enhanced Conditions</Typography>
          <Button startIcon={<AddIcon />} onClick={addCondition}>
            Add Condition
          </Button>
        </Stack>
        
        {hookData.catalogIntegration.enabled && (
          <Alert severity="info">
            Catalog integration is enabled. Condition builders will have access to dynamic data from WintEHR catalogs.
          </Alert>
        )}
        
        {(!hookData.conditions || hookData.conditions.length === 0) ? (
          <Alert severity="info">
            No conditions defined. This hook will trigger for all patients.
          </Alert>
        ) : (
          hookData.conditions.map((condition) => (
            <Card key={condition.id} variant="outlined">
              <CardContent>
                <Stack spacing={2}>
                  {/* Condition Type Selector with Catalog Integration Info */}
                  <Stack direction="row" spacing={2} alignItems="center">
                    <FormControl fullWidth>
                      <InputLabel>Condition Type</InputLabel>
                      <Select
                        value={condition.type}
                        label="Condition Type"
                        onChange={(e) => {
                          const conditionType = CONDITION_TYPES.find(t => t.value === e.target.value);
                          updateCondition(condition.id, { 
                            type: e.target.value,
                            useCatalog: conditionType?.catalogIntegration && hookData.catalogIntegration.enabled
                          });
                        }}
                      >
                        {CONDITION_TYPES.map(type => (
                          <MenuItem key={type.value} value={type.value}>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Stack>
                                <Typography>{type.label}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {type.description}
                                </Typography>
                              </Stack>
                              {type.catalogIntegration && (
                                <Chip 
                                  label="Catalog" 
                                  size="small" 
                                  color="primary" 
                                  variant="outlined" 
                                />
                              )}
                            </Stack>
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    
                    {/* Catalog integration toggle for applicable condition types */}
                    {CONDITION_TYPES.find(t => t.value === condition.type)?.catalogIntegration && (
                      <FormControlLabel
                        control={
                          <Switch
                            checked={condition.useCatalog || false}
                            onChange={(e) => updateCondition(condition.id, { useCatalog: e.target.checked })}
                            disabled={!hookData.catalogIntegration.enabled}
                          />
                        }
                        label="Use Catalog"
                      />
                    )}
                  </Stack>

                  {/* Dynamic Condition Builder - Enhanced with catalog integration */}
                  {condition.type === 'lab_value' && (
                    <LabValueConditionBuilder
                      condition={condition}
                      onChange={(updates) => updateCondition(condition.id, updates)}
                      onRemove={() => removeCondition(condition.id)}
                      catalogIntegration={condition.useCatalog ? catalogIntegrationService : null}
                    />
                  )}
                  
                  {condition.type === 'vital_sign' && (
                    <VitalSignConditionBuilder
                      condition={condition}
                      onChange={(updates) => updateCondition(condition.id, updates)}
                      onRemove={() => removeCondition(condition.id)}
                      catalogIntegration={condition.useCatalog ? catalogIntegrationService : null}
                    />
                  )}
                  
                  {condition.type === 'condition' && (
                    <MedicalConditionBuilder
                      condition={condition}
                      onChange={(updates) => updateCondition(condition.id, updates)}
                      onRemove={() => removeCondition(condition.id)}
                      catalogIntegration={condition.useCatalog ? catalogIntegrationService : null}
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
                      catalogIntegration={condition.useCatalog ? catalogIntegrationService : null}
                    />
                  )}

                  {/* Common controls */}
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

  // Use existing render methods for cards, prefetch, display behavior, and test/save
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
        <Typography variant="h6">Test & Save Production-Ready Hook</Typography>
        
        {/* Hook Summary with Catalog Integration Status */}
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
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">Catalog Integration:</Typography>
                <Chip 
                  label={hookData.catalogIntegration.enabled ? 'Enabled' : 'Disabled'}
                  color={hookData.catalogIntegration.enabled ? 'success' : 'default'}
                  size="small"
                />
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">Production Ready:</Typography>
                <Chip 
                  label={validation.overall.isValid ? 'Yes' : 'Pending'}
                  color={validation.overall.isValid ? 'success' : 'warning'}
                  size="small"
                />
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
                  {testResults.catalogData && (
                    <Chip label="Catalog Data Used" color="primary" size="small" />
                  )}
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
            {saving ? 'Saving...' : 'Save Production Hook'}
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
            Enhanced CDS Builder
          </Typography>
          <Chip label="Catalog-Enhanced" color="primary" size="small" />
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
            <PreviewIcon />
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
              {index === 0 && renderEnhancedBasicInfo()}
              {index === 1 && renderCatalogEnhancedConditions()}
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
      
      {/* Enhanced Template Dialog */}
      <Dialog
        open={showTemplates}
        onClose={() => setShowTemplates(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Select a Catalog-Enhanced Template</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {ENHANCED_HOOK_TEMPLATES.map((template) => (
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
                        <Chip label="Catalog-Enhanced" color="primary" size="small" sx={{ mt: 1 }} />
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
        <DialogTitle>
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="h6">Hook Preview</Typography>
            {hookData.catalogIntegration.enabled && (
              <Chip label="Catalog-Enhanced" color="primary" size="small" />
            )}
          </Stack>
        </DialogTitle>
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

export default EnhancedCDSBuilder;