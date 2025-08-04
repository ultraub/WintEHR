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
  alpha,
  Autocomplete,
  InputAdornment
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
  ContentCopy,
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
  ArrowForward as NextIcon,
  CallMade,
  CallReceived,
  Download
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useCDSStudio } from '../../../pages/CDSHooksStudio';
import { cdsHooksService } from '../../../services/cdsHooksService';
import CDSHookBuilder from '../../clinical/workspace/cds/CDSHookBuilder';
import CardBuilder from '../../clinical/workspace/cds/CardBuilder';
import CDSCardDisplay from '../../clinical/workspace/cds/CDSCardDisplay';
import PrefetchQueryBuilder from '../../clinical/workspace/cds/PrefetchQueryBuilder';
import SuggestionBuilder from '../../clinical/workspace/cds/SuggestionBuilder';
import { cdsClinicalDataService } from '../../../services/cdsClinicalDataService';
import CDSHooksValidator from '../validation/CDSHooksValidator';

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
  'Cards & Actions', 
  'Prefetch Configuration',
  'Review & Test'
];

// Condition type configurations
const CONDITION_TYPES = {
  age: {
    label: 'Age',
    operators: ['equals', 'greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal', 'between'],
    valueType: 'number',
    unit: 'years',
    placeholder: 'Enter age in years'
  },
  gender: {
    label: 'Gender',
    operators: ['equals', 'not_equals'],
    valueType: 'select',
    options: [
      { value: 'male', label: 'Male' },
      { value: 'female', label: 'Female' },
      { value: 'other', label: 'Other' },
      { value: 'unknown', label: 'Unknown' }
    ]
  },
  condition: {
    label: 'Medical Condition',
    operators: ['exists', 'not_exists', 'equals'],
    valueType: 'catalog',
    catalogType: 'conditions',
    placeholder: 'Search for condition...'
  },
  medication: {
    label: 'Medication',
    operators: ['exists', 'not_exists', 'equals'],
    valueType: 'catalog',
    catalogType: 'medications',
    placeholder: 'Search for medication...'
  },
  'lab-value': {
    label: 'Lab Value',
    operators: ['equals', 'not_equals', 'greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal', 'between'],
    valueType: 'lab',
    placeholder: 'Select lab test...'
  },
  'vital-sign': {
    label: 'Vital Sign',
    operators: ['equals', 'not_equals', 'greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal', 'between'],
    valueType: 'vital',
    options: [
      { value: 'systolic_bp', label: 'Systolic Blood Pressure', unit: 'mmHg' },
      { value: 'diastolic_bp', label: 'Diastolic Blood Pressure', unit: 'mmHg' },
      { value: 'heart_rate', label: 'Heart Rate', unit: 'bpm' },
      { value: 'temperature', label: 'Temperature', unit: '°F' },
      { value: 'respiratory_rate', label: 'Respiratory Rate', unit: '/min' },
      { value: 'oxygen_saturation', label: 'Oxygen Saturation', unit: '%' }
    ]
  },
  allergy: {
    label: 'Allergy',
    operators: ['exists', 'not_exists', 'equals'],
    valueType: 'catalog',
    catalogType: 'allergies',
    placeholder: 'Search for allergen...'
  }
};

const OPERATOR_LABELS = {
  equals: 'Equals',
  not_equals: 'Not Equals',
  greater_than: 'Greater Than',
  greater_than_or_equal: 'Greater Than or Equal',
  less_than: 'Less Than',
  less_than_or_equal: 'Less Than or Equal',
  between: 'Between',
  exists: 'Exists',
  not_exists: 'Does Not Exist'
};

// Enhanced Condition Card Component
const ConditionCard = ({ condition, index, onUpdate, onRemove, validation }) => {
  const [catalogOptions, setCatalogOptions] = useState([]);
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const searchTimeoutRef = useRef(null);
  
  const conditionConfig = CONDITION_TYPES[condition.type] || {};
  const hasError = validation?.conditions?.errors?.some(error => error.includes(`Condition ${index + 1}`)) || false;
  
  // Load catalog data when condition type changes
  useEffect(() => {
    if ((conditionConfig.catalogType || conditionConfig.valueType === 'lab') && !initialLoadDone) {
      // Load initial catalog with empty search to show common items
      loadCatalogData('');
      setInitialLoadDone(true);
    }
  }, [condition.type, conditionConfig.catalogType, conditionConfig.valueType, initialLoadDone]);
  
  // Reset initial load when type changes
  useEffect(() => {
    setInitialLoadDone(false);
    setSelectedItem(null);
    setCatalogOptions([]);
  }, [condition.type]);
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);
  
  const loadCatalogData = async (search = '') => {
    if (!conditionConfig.catalogType && conditionConfig.valueType !== 'lab') return;
    
    setLoading(true);
    try {
      let data = [];
      
      // Special handling for lab tests
      if (conditionConfig.valueType === 'lab') {
        data = await cdsClinicalDataService.getLabCatalog(search, null, 30);
      } else {
        switch (conditionConfig.catalogType) {
          case 'conditions':
            data = await cdsClinicalDataService.getDynamicConditionCatalog(search, 30);
            break;
          case 'medications':
            data = await cdsClinicalDataService.getDynamicMedicationCatalog(search, 30);
            break;
          case 'allergies':
            // For now, use medications as allergens
            data = await cdsClinicalDataService.getDynamicMedicationCatalog(search, 30);
            break;
          default:
            data = [];
        }
      }
      
      // Ensure we have proper data format
      const formattedData = Array.isArray(data) ? data : [];
      console.log(`Loaded ${formattedData.length} items for ${conditionConfig.catalogType || 'lab'} catalog with search: '${search}'`);
      setCatalogOptions(formattedData);
      
      // If search returned no results, show a message
      if (search && formattedData.length === 0) {
        console.log('No results found for search:', search);
      }
    } catch (error) {
      console.error('Failed to load catalog data:', error);
      setCatalogOptions([]);
    } finally {
      setLoading(false);
    }
  };
  
  const handleFieldChange = (field, value) => {
    const updated = { ...condition, [field]: value };
    
    // Clear value when operator changes to exists/not_exists
    if (field === 'operator' && (value === 'exists' || value === 'not_exists')) {
      updated.value = '';
      updated.value2 = '';
    }
    
    // Clear operator and value when type changes
    if (field === 'type') {
      updated.operator = '';
      updated.value = '';
      updated.value2 = '';
      setSelectedItem(null);
    }
    
    onUpdate(updated);
  };
  
  const renderValueField = () => {
    const isDisabled = condition.operator === 'exists' || condition.operator === 'not_exists';
    
    if (isDisabled) {
      return null;
    }
    
    const fieldError = hasError && !condition.value;
    
    switch (conditionConfig.valueType) {
      case 'select':
        return (
          <FormControl 
            fullWidth 
            error={fieldError}
          >
            <InputLabel>Value</InputLabel>
            <Select
              value={condition.value || ''}
              onChange={(e) => handleFieldChange('value', e.target.value)}
              label="Value"
            >
              {conditionConfig.options?.map(opt => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        );
        
      case 'catalog':
        return (
          <Autocomplete
            fullWidth
            options={catalogOptions}
            getOptionLabel={(option) => {
              // Handle different catalog response formats
              if (option.display_name) return option.display_name;
              if (option.display) return option.display;
              if (option.name) return option.name;
              if (option.medication_name) return option.medication_name;
              return '';
            }}
            loading={loading}
            value={selectedItem}
            onChange={(event, newValue) => {
              setSelectedItem(newValue);
              handleFieldChange('value', newValue ? (newValue.code || newValue.rxnorm_code || newValue.loinc_code || newValue.id) : '');
              handleFieldChange('valueDisplay', newValue ? (newValue.display || newValue.display_name || newValue.medication_name || newValue.name) : '');
            }}
            onInputChange={(event, newInputValue, reason) => {
              setSearchInput(newInputValue);
              // Only search when user is typing, not when selecting
              if (reason === 'input') {
                // Clear existing timeout
                if (searchTimeoutRef.current) {
                  clearTimeout(searchTimeoutRef.current);
                }
                
                // Set new timeout for debounced search
                searchTimeoutRef.current = setTimeout(() => {
                  // Always search, even with 1 character
                  loadCatalogData(newInputValue);
                }, 300); // 300ms debounce
              }
            }}
            filterOptions={(x) => x} // Disable client-side filtering
            freeSolo={false}
            disableClearable={false}
            autoHighlight
            renderOption={(props, option) => (
              <Box component="li" {...props}>
                <Box>
                  <Typography variant="body2">
                    {option.generic_name || option.test_name || option.display_name || option.display}
                    {option.usage_count > 0 && (
                      <Chip size="small" label={`Used ${option.usage_count}x`} color="primary" sx={{ ml: 1, height: 16 }} />
                    )}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Code: {option.rxnorm_code || option.loinc_code || option.code} | Type: {option.drug_class || option.category || 'general'}
                  </Typography>
                </Box>
              </Box>
            )}
            noOptionsText={loading ? "Loading..." : searchInput ? `No results found for "${searchInput}"` : "Start typing to search"}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Value"
                placeholder={conditionConfig.placeholder}
                error={fieldError}
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {loading ? <CircularProgress color="inherit" size={20} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
          />
        );
        
      case 'lab':
      case 'vital':
        // For lab values and vitals, we need a two-part input
        return (
          <Grid container spacing={2}>
            <Grid item xs={6}>
              {conditionConfig.valueType === 'lab' ? (
                <Autocomplete
                  fullWidth
                  options={catalogOptions}
                  getOptionLabel={(option) => option.display || option.display_name || option.name || ''}
                  loading={loading}
                  value={selectedItem}
                  onChange={(event, newValue) => {
                    setSelectedItem(newValue);
                    handleFieldChange('labTest', newValue ? (newValue.loinc_code || newValue.code || newValue.id) : '');
                    handleFieldChange('labTestDisplay', newValue ? (newValue.display || newValue.display_name || newValue.name) : '');
                  }}
                  onInputChange={(event, newInputValue, reason) => {
                    setSearchInput(newInputValue);
                    // Only search when user is typing, not when selecting
                    if (reason === 'input') {
                      // Clear existing timeout
                      if (searchTimeoutRef.current) {
                        clearTimeout(searchTimeoutRef.current);
                      }
                      
                      // Set new timeout for debounced search
                      searchTimeoutRef.current = setTimeout(() => {
                        // Always search, even with 1 character
                        loadCatalogData(newInputValue);
                      }, 300); // 300ms debounce
                    }
                  }}
                  filterOptions={(x) => x} // Disable client-side filtering
            freeSolo={false}
            disableClearable={false}
            autoHighlight
                  renderOption={(props, option) => (
                    <Box component="li" {...props}>
                      <Box>
                        <Typography variant="body2">
                          {option.test_name}
                          {option.usage_count > 0 && (
                            <Chip size="small" label={`${option.usage_count} tests`} color="primary" sx={{ ml: 1, height: 16 }} />
                          )}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          LOINC: {option.loinc_code} | Type: {option.specimen_type}
                          {option.reference_range && ` | Range: ${option.reference_range.min}-${option.reference_range.max} ${option.reference_range.unit}`}
                        </Typography>
                      </Box>
                    </Box>
                  )}
                  noOptionsText={loading ? "Loading..." : searchInput ? `No lab tests found for "${searchInput}"` : "Start typing to search lab tests"}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Lab Test"
                      placeholder="Search lab tests..."
                      error={fieldError && !condition.labTest}
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {loading ? <CircularProgress color="inherit" size={20} /> : null}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                />
              ) : (
                <FormControl fullWidth error={fieldError && !condition.vitalType}>
                  <InputLabel>Vital Sign</InputLabel>
                  <Select
                    value={condition.vitalType || ''}
                    onChange={(e) => handleFieldChange('vitalType', e.target.value)}
                    label="Vital Sign"
                  >
                    {conditionConfig.options?.map(opt => (
                      <MenuItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Value"
                type="number"
                value={condition.value || ''}
                onChange={(e) => handleFieldChange('value', e.target.value)}
                error={fieldError}
                InputProps={{
                  endAdornment: conditionConfig.valueType === 'vital' && condition.vitalType ? 
                    <InputAdornment position="end">
                      {conditionConfig.options?.find(o => o.value === condition.vitalType)?.unit}
                    </InputAdornment> : undefined
                }}
              />
            </Grid>
            {condition.operator === 'between' && (
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="To Value"
                  type="number"
                  value={condition.value2 || ''}
                  onChange={(e) => handleFieldChange('value2', e.target.value)}
                  error={fieldError && condition.operator === 'between' && !condition.value2}
                />
              </Grid>
            )}
          </Grid>
        );
        
      default:
        return (
          <TextField
            fullWidth
            label="Value"
            type={conditionConfig.valueType === 'number' ? 'number' : 'text'}
            value={condition.value || ''}
            onChange={(e) => handleFieldChange('value', e.target.value)}
            placeholder={conditionConfig.placeholder}
            error={fieldError}
            InputProps={{
              endAdornment: conditionConfig.unit ? 
                <InputAdornment position="end">{conditionConfig.unit}</InputAdornment> : undefined
            }}
          />
        );
    }
  };
  
  return (
    <Card variant="outlined" sx={{ 
      borderColor: hasError ? 'error.main' : undefined,
      borderWidth: hasError ? 2 : 1
    }}>
      <CardContent>
        <Stack spacing={2}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={3}>
              <FormControl 
                fullWidth 
                error={hasError && !condition.type}
              >
                <InputLabel>Condition Type</InputLabel>
                <Select
                  value={condition.type || ''}
                  onChange={(e) => handleFieldChange('type', e.target.value)}
                  label="Condition Type"
                >
                  {Object.entries(CONDITION_TYPES).map(([value, config]) => (
                    <MenuItem key={value} value={value}>
                      {config.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={3}>
              <FormControl 
                fullWidth 
                disabled={!condition.type}
                error={hasError && condition.type && !condition.operator}
              >
                <InputLabel>Operator</InputLabel>
                <Select
                  value={condition.operator || ''}
                  onChange={(e) => handleFieldChange('operator', e.target.value)}
                  label="Operator"
                >
                  {conditionConfig.operators?.map(op => (
                    <MenuItem key={op} value={op}>
                      {OPERATOR_LABELS[op]}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={5}>
              {condition.type && condition.operator && renderValueField()}
            </Grid>
            
            <Grid item xs={12} md={1}>
              <IconButton
                color="error"
                onClick={onRemove}
                sx={{ mt: 1 }}
              >
                <DeleteIcon />
              </IconButton>
            </Grid>
          </Grid>
        </Stack>
      </CardContent>
    </Card>
  );
};

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
    cards: [],
    prefetch: {},
    enabled: true,
    // Legacy field for compatibility
    displayBehavior: null,
    _meta: {
      created: null,
      modified: new Date(),
      version: 0,
      author: 'Current User'
    }
  });
  
  const [validation, setValidation] = useState({
    basicInfo: { isValid: true, errors: [] },
    cards: { isValid: true, errors: [] },
    prefetch: { isValid: true, errors: [] },
    overall: { isValid: true, errors: [], warnings: [] }
  });
  
  const [showTemplates, setShowTemplates] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [lastSaved, setLastSaved] = useState(null);
  const [saving, setSaving] = useState(false);
  const [testResults, setTestResults] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [testPatientId, setTestPatientId] = useState('test-patient-123');
  const [reviewTab, setReviewTab] = useState(0);
  
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
    setValidation(prevValidation => {
      const newValidation = { ...prevValidation };
      
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
          
        case 1: // Cards
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
          
        case 2: // Prefetch Configuration
          // Prefetch configuration is optional, so always valid
          newValidation.prefetch = {
            isValid: true,
            errors: []
          };
          break;
      }
      
      // Update overall validation
      newValidation.overall = {
        isValid: (newValidation.basicInfo?.isValid ?? true) && 
                 (newValidation.cards?.isValid ?? true) &&
                 (newValidation.prefetch?.isValid ?? true),
        errors: [
          ...(newValidation.basicInfo?.errors || []),
          ...(newValidation.cards?.errors || []),
          ...(newValidation.prefetch?.errors || [])
        ],
        warnings: []
      };
      
      return newValidation;
    });
  }, [hook]);
  
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
              
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Usage Requirements"
                  value={hook.usageRequirements || ''}
                  onChange={(e) => updateHook({ usageRequirements: e.target.value })}
                  multiline
                  rows={2}
                  helperText="Optional: Any specific requirements or limitations for using this service"
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
        
      case 1: // Cards & Actions
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
        
      case 2: // Prefetch Configuration
        return (
          <Box sx={{ mt: 2 }}>
            <Alert severity="info" sx={{ mb: 2 }}>
              <AlertTitle>Prefetch Configuration (Optional)</AlertTitle>
              Define FHIR queries to pre-fetch data when your service is invoked. This improves performance by reducing the number of API calls.
            </Alert>
            
            {/* Prefetch Query Builder */}
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Prefetch Queries
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Define queries using FHIR search syntax. Use {`{{context.patientId}}`} for patient context.
              </Typography>
              <PrefetchQueryBuilder
                queries={hook.prefetch || {}}
                onChange={(prefetch) => updateHook({ prefetch })}
              />
            </Paper>
          </Box>
        );
        
      case 3: // Review & Test
        // Generate the hook JSON for display
        const hookJson = {
          id: hook.id || 'generated-from-title',
          hook: hook.hook,
          title: hook.title,
          description: hook.description,
          // Prefetch queries define what FHIR data to retrieve
          prefetch: hook.prefetch || {},
          // Custom configuration (not part of standard CDS Hooks spec)
          _config: {
            // Cards are the alerts/recommendations shown to users
            cards: hook.cards,
            // Whether this hook is active
            enabled: hook.enabled
          }
        };
        
        // Generate a sample request
        const sampleRequest = {
          hook: hook.hook,
          hookInstance: `${Date.now()}`,
          context: {
            userId: 'Practitioner/example',
            patientId: 'Patient/example',
            encounterId: 'Encounter/example'
          },
          prefetch: Object.keys(hook.prefetch || {}).reduce((acc, key) => {
            acc[key] = { resourceType: 'Bundle', entry: [] };
            return acc;
          }, {})
        };
        
        // Generate a sample response
        const sampleResponse = {
          cards: hook.cards?.map((card, idx) => ({
            uuid: `card-${Date.now()}-${idx}`,
            summary: card.summary,
            indicator: card.indicator,
            detail: card.detail,
            source: card.source,
            suggestions: card.suggestions || [],
            overrideReasonRequired: card.overrideReasonRequired || false,
            links: card.links || []
          })) || []
        };
        
        return (
          <Box sx={{ mt: 2 }}>
            <Paper sx={{ p: 1, mb: 2 }}>
              <Tabs value={reviewTab} onChange={(e, v) => setReviewTab(v)} variant="fullWidth" scrollButtons="auto">
                <Tab label="Summary" icon={<InfoIcon />} iconPosition="start" />
                <Tab label="Validation" icon={<SuccessIcon />} iconPosition="start" />
                <Tab label="Hook JSON" icon={<CodeIcon />} iconPosition="start" />
                <Tab label="Sample Request" icon={<CallMade />} iconPosition="start" />
                <Tab label="Sample Response" icon={<CallReceived />} iconPosition="start" />
                <Tab label="Test Hook" icon={<TestIcon />} iconPosition="start" />
              </Tabs>
            </Paper>
            
            {reviewTab === 0 && (
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
                        {validation?.basicInfo?.isValid ? <CheckIcon color="success" /> : <ErrorIcon color="error" />}
                        <Typography variant="body2">Basic Information</Typography>
                      </Box>
                      <Box display="flex" alignItems="center" gap={1}>
                        {validation?.cards?.isValid ? <CheckIcon color="success" /> : <ErrorIcon color="error" />}
                        <Typography variant="body2">Cards & Actions</Typography>
                      </Box>
                      <Box display="flex" alignItems="center" gap={1}>
                        {validation?.prefetch?.isValid ? <CheckIcon color="success" /> : <ErrorIcon color="error" />}
                        <Typography variant="body2">Prefetch Configuration</Typography>
                      </Box>
                      <Box display="flex" alignItems="center" gap={1}>
                        {validation?.overall?.isValid ? <CheckIcon color="success" /> : <ErrorIcon color="error" />}
                        <Typography variant="body2">Overall Status</Typography>
                      </Box>
                    </Stack>
                    
                    {validation?.overall?.errors?.length > 0 && (
                      <Alert severity="error" sx={{ mt: 2 }}>
                        <AlertTitle>Please fix these issues:</AlertTitle>
                        <ul style={{ margin: 0, paddingLeft: 20 }}>
                          {validation?.overall?.errors?.map((error, index) => (
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
            )}
            
            {reviewTab === 1 && (
              <Box>
                <CDSHooksValidator 
                  service={hookJson}
                  onValidationComplete={(result) => {
                    // Store validation result if needed
                    console.log('Validation result:', result);
                  }}
                />
              </Box>
            )}
            
            {reviewTab === 2 && (
              <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                <Stack spacing={2}>
                  <Typography variant="h6">Hook Configuration JSON</Typography>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    This is how your CDS Hook is stored and configured in the system.
                  </Typography>
                  <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
                    <Chip label="CDS Hooks 1.0 Spec" size="small" color="primary" />
                    <Chip label={`Hook Type: ${hook.hook}`} size="small" />
                    <Chip label={`${hook.cards?.length || 0} Cards`} size="small" />
                  </Stack>
                  <Box
                    component="pre"
                    sx={{
                      p: 2,
                      bgcolor: 'grey.900',
                      color: 'grey.50',
                      borderRadius: 1,
                      overflow: 'auto',
                      fontSize: '0.875rem',
                      fontFamily: 'monospace'
                    }}
                  >
                    {JSON.stringify(hookJson, null, 2)}
                  </Box>
                  <Stack direction="row" spacing={2}>
                    <Button
                      variant="outlined"
                      startIcon={<ContentCopy />}
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(hookJson, null, 2));
                        setSnackbar({
                          open: true,
                          message: 'Hook JSON copied to clipboard',
                          severity: 'success'
                        });
                      }}
                    >
                      Copy JSON
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<Download />}
                      onClick={() => {
                        const blob = new Blob([JSON.stringify(hookJson, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${hook.id || 'cds-hook'}.json`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        setSnackbar({
                          open: true,
                          message: 'Hook JSON downloaded',
                          severity: 'success'
                        });
                      }}
                    >
                      Download JSON
                    </Button>
                  </Stack>
                </Stack>
              </Paper>
            )}
            
            {reviewTab === 3 && (
              <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                <Stack spacing={2}>
                  <Typography variant="h6">Sample CDS Request</Typography>
                  <Typography variant="body2" color="text.secondary">
                    This is an example of what the EHR sends to your CDS service when the hook is triggered.
                  </Typography>
                  <Stack spacing={2} sx={{ mb: 2 }}>
                    <Alert severity="info">
                      The actual request will include real patient data and prefetched FHIR resources based on your configuration.
                    </Alert>
                    <Paper variant="outlined" sx={{ p: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>Key Request Fields:</Typography>
                      <Typography variant="body2" component="div">
                        • <strong>hook</strong>: The hook type that triggered this request<br/>
                        • <strong>hookInstance</strong>: Unique identifier for this specific invocation<br/>
                        • <strong>context</strong>: FHIR resources relevant to the hook (patient, user, etc.)<br/>
                        • <strong>prefetch</strong>: Pre-fetched FHIR data based on your queries
                      </Typography>
                    </Paper>
                  </Stack>
                  <Box
                    component="pre"
                    sx={{
                      p: 2,
                      bgcolor: 'grey.900',
                      color: 'grey.50',
                      borderRadius: 1,
                      overflow: 'auto',
                      fontSize: '0.875rem',
                      fontFamily: 'monospace'
                    }}
                  >
                    {JSON.stringify(sampleRequest, null, 2)}
                  </Box>
                  <Button
                    variant="outlined"
                    startIcon={<ContentCopy />}
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(sampleRequest, null, 2));
                      setSnackbar({
                        open: true,
                        message: 'Sample request copied to clipboard',
                        severity: 'success'
                      });
                    }}
                  >
                    Copy Request
                  </Button>
                </Stack>
              </Paper>
            )}
            
            {reviewTab === 4 && (
              <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                <Stack spacing={2}>
                  <Typography variant="h6">Sample CDS Response</Typography>
                  <Typography variant="body2" color="text.secondary">
                    This is what your CDS service returns to the EHR, containing cards to display to the user.
                  </Typography>
                  <Stack spacing={2} sx={{ mb: 2 }}>
                    <Alert severity="info">
                      Each card includes a unique UUID, summary, severity indicator, and optional suggestions or links.
                    </Alert>
                    <Paper variant="outlined" sx={{ p: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>Card Indicators:</Typography>
                      <Stack spacing={1}>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Chip label="critical" size="small" color="error" />
                          <Typography variant="body2">Urgent, requires immediate attention</Typography>
                        </Box>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Chip label="warning" size="small" color="warning" />
                          <Typography variant="body2">Important, should be addressed</Typography>
                        </Box>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Chip label="info" size="small" color="info" />
                          <Typography variant="body2">Informational, good to know</Typography>
                        </Box>
                      </Stack>
                    </Paper>
                  </Stack>
                  <Box
                    component="pre"
                    sx={{
                      p: 2,
                      bgcolor: 'grey.900',
                      color: 'grey.50',
                      borderRadius: 1,
                      overflow: 'auto',
                      fontSize: '0.875rem',
                      fontFamily: 'monospace'
                    }}
                  >
                    {JSON.stringify(sampleResponse, null, 2)}
                  </Box>
                  <Button
                    variant="outlined"
                    startIcon={<ContentCopy />}
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(sampleResponse, null, 2));
                      setSnackbar({
                        open: true,
                        message: 'Sample response copied to clipboard',
                        severity: 'success'
                      });
                    }}
                  >
                    Copy Response
                  </Button>
                </Stack>
              </Paper>
            )}
            
            {reviewTab === 5 && (
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Test Your Hook
                      </Typography>
                      <Typography variant="body2" color="text.secondary" paragraph>
                        Test your hook with a sample patient to see how it works in practice.
                      </Typography>
                      <TextField
                        label="Test Patient ID"
                        value={testPatientId}
                        onChange={(e) => setTestPatientId(e.target.value)}
                        fullWidth
                        sx={{ mb: 2 }}
                        helperText="Enter a patient ID to test with"
                      />
                      <Button
                        variant="contained"
                        startIcon={<TestIcon />}
                        onClick={testHook}
                        disabled={!validation.overall.isValid}
                        fullWidth
                      >
                        Run Test
                      </Button>
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
                        <Box
                          component="pre"
                          sx={{
                            p: 2,
                            bgcolor: 'grey.100',
                            borderRadius: 1,
                            overflow: 'auto',
                            fontSize: '0.875rem'
                          }}
                        >
                          {JSON.stringify(testResults, null, 2)}
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                )}
              </Grid>
            )}
          </Box>
        );
        
      default:
        return null;
    }
  };
  
  // Get step icon based on validation
  const getStepIcon = (step) => {
    // Ensure validation object exists with proper structure
    if (!validation) {
      return <RadioButtonUnchecked />;
    }
    
    const isValid = step === 0 ? validation?.basicInfo?.isValid ?? true :
                   step === 1 ? validation?.cards?.isValid ?? true :
                   step === 2 ? validation?.prefetch?.isValid ?? true :
                   step === 3 ? validation?.overall?.isValid ?? true :
                   true;
    
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
                // Display behavior removed - client-specific
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