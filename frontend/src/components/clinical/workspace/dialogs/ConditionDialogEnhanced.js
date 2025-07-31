/**
 * Enhanced Condition Dialog Component
 * Modern, aesthetic dialog for managing conditions with full FHIR R4 support
 * Features:
 * - Dynamic condition catalog from patient data
 * - Intelligent search with ICD-10 codes
 * - Beautiful Material-UI design with smooth animations
 * - Clinical context awareness
 * - Smart defaults and suggestions
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Alert,
  Stepper,
  Step,
  StepLabel,
  IconButton,
  Chip,
  Stack,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Collapse,
  Fade,
  Zoom,
  Paper,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Avatar,
  Tooltip,
  LinearProgress,
  useTheme,
  alpha,
  Autocomplete,
  createFilterOptions,
  MenuItem,
  CircularProgress
} from '@mui/material';
import {
  Close as CloseIcon,
  Save as SaveIcon,
  Preview as PreviewIcon,
  NavigateBefore as BackIcon,
  NavigateNext as NextIcon,
  LocalHospital as ConditionIcon,
  CheckCircle as CheckCircleIcon,
  Search as SearchIcon,
  Lightbulb as SuggestionIcon,
  TrendingUp as TrendingIcon,
  Warning as WarningIcon,
  Cancel as InactiveIcon,
  Help as UnknownIcon,
  AccessTime as ClockIcon,
  CalendarToday as DateIcon,
  Notes as NotesIcon,
  Verified as VerifiedIcon,
  Psychology as DiagnosisIcon,
  Category as CategoryIcon,
  AutoAwesome as SmartIcon,
  HealthAndSafety as SafetyIcon
} from '@mui/icons-material';
import { DateTimePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, parseISO, differenceInDays } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

// Services
import cdsClinicalDataService from '../../../../services/cdsClinicalDataService';
import { fhirClient } from '../../../../core/fhir/services/fhirClient';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import { useCDS } from '../../../../contexts/CDSContext';
import { useClinicalWorkflow } from '../../../../contexts/ClinicalWorkflowContext';
import { CLINICAL_EVENTS } from '../../../../constants/clinicalEvents';
import { useDialogSave, useDialogValidation, VALIDATION_RULES } from './utils/dialogHelpers';

// Helper function for searching conditions
const searchConditions = async (query) => {
  try {
    const catalog = await cdsClinicalDataService.getDynamicConditionCatalog();
    const searchTerm = query.toLowerCase();
    return catalog.filter(item => 
      item.display?.toLowerCase().includes(searchTerm) ||
      item.code?.toLowerCase().includes(searchTerm)
    );
  } catch (error) {
    console.error('Error searching conditions:', error);
    return [];
  }
};

// Constants
const STEPS = ['Search & Select', 'Clinical Details', 'Review & Save'];

const CLINICAL_STATUS_OPTIONS = [
  { value: 'active', label: 'Active', icon: <CheckCircleIcon />, color: 'success' },
  { value: 'recurrence', label: 'Recurrence', icon: <TrendingIcon />, color: 'warning' },
  { value: 'relapse', label: 'Relapse', icon: <WarningIcon />, color: 'warning' },
  { value: 'inactive', label: 'Inactive', icon: <InactiveIcon />, color: 'default' },
  { value: 'remission', label: 'Remission', icon: <CheckCircleIcon />, color: 'info' },
  { value: 'resolved', label: 'Resolved', icon: <CheckCircleIcon />, color: 'success' }
];

const VERIFICATION_STATUS_OPTIONS = [
  { value: 'unconfirmed', label: 'Unconfirmed', icon: <UnknownIcon />, color: 'warning' },
  { value: 'provisional', label: 'Provisional', icon: <ClockIcon />, color: 'info' },
  { value: 'differential', label: 'Differential', icon: <DiagnosisIcon />, color: 'info' },
  { value: 'confirmed', label: 'Confirmed', icon: <VerifiedIcon />, color: 'success' },
  { value: 'refuted', label: 'Refuted', icon: <InactiveIcon />, color: 'error' },
  { value: 'entered-in-error', label: 'Entered in Error', icon: <InactiveIcon />, color: 'error' }
];

const SEVERITY_OPTIONS = [
  { value: 'mild', label: 'Mild', color: 'info' },
  { value: 'moderate', label: 'Moderate', color: 'warning' },
  { value: 'severe', label: 'Severe', color: 'error' }
];

const CATEGORY_OPTIONS = [
  { value: 'problem-list-item', label: 'Problem List Item', icon: <CategoryIcon /> },
  { value: 'encounter-diagnosis', label: 'Encounter Diagnosis', icon: <ConditionIcon /> }
];

// Custom hook for condition search
const useConditionSearch = (searchTerm) => {
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState([]);
  const [cache] = useState(new Map());

  const searchConditions = useCallback(async (term) => {
    if (!term || term.length < 2) {
      setOptions([]);
      return;
    }

    // Check cache first
    if (cache.has(term)) {
      setOptions(cache.get(term));
      return;
    }

    setLoading(true);
    try {
      const results = await cdsClinicalDataService.getDynamicConditionCatalog(term, 20);
      const formattedResults = results.map(condition => ({
        ...condition,
        code: condition.icd10_code || condition.code || condition.id,
        display: condition.display_name || condition.display || condition.name || 'Unknown condition',
        label: `${condition.display_name || condition.display || condition.name || 'Unknown condition'} (${condition.icd10_code || condition.code || condition.id})`,
        subLabel: `ICD-10: ${condition.icd10_code || condition.code || condition.id} • ${condition.usage_count ? `Used ${condition.usage_count} times` : 'New'}`
      }));
      
      cache.set(term, formattedResults);
      setOptions(formattedResults);
    } catch (error) {
      console.error('Error searching conditions:', error);
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, [cache]);

  useEffect(() => {
    const timer = setTimeout(() => {
      searchConditions(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, searchConditions]);

  return { loading, options };
};

const ConditionDialogEnhanced = ({
  open,
  onClose,
  condition = null,
  onSave,
  onSaved, // Support both prop names for compatibility
  patientId,
  encounterId = null
}) => {
  const theme = useTheme();
  const { currentPatient } = useFHIRResource();
  const { evaluateCDS } = useCDS();
  const { publish } = useClinicalWorkflow();
  
  // State
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCondition, setSelectedCondition] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(true);
  
  // Use consistent dialog helpers
  const saveHandler = onSave || onSaved; // Support both prop names
  const { saving: isSaving, error: saveError, handleSave: performSave } = useDialogSave(saveHandler, null);
  const { errors: validationErrors, validateForm, clearErrors } = useDialogValidation();
  const [cdsAlerts, setCdsAlerts] = useState([]);
  
  // Form data
  const [formData, setFormData] = useState({
    code: '',
    display: '',
    clinicalStatus: 'active',
    verificationStatus: 'confirmed',
    severity: '',
    category: 'problem-list-item',
    onsetDateTime: null,
    abatementDateTime: null,
    note: '',
    bodySite: '',
    stage: ''
  });
  
  const [errors, setErrors] = useState({});

  // Search hook
  const { loading: searchLoading, options: searchOptions } = useConditionSearch(searchTerm);

  // Initialize form for edit mode
  useEffect(() => {
    if (condition && open) {
      setFormData({
        code: condition.code?.coding?.[0]?.code || '',
        display: condition.code?.coding?.[0]?.display || condition.code?.text || '',
        clinicalStatus: condition.clinicalStatus?.coding?.[0]?.code || 'active',
        verificationStatus: condition.verificationStatus?.coding?.[0]?.code || 'confirmed',
        severity: condition.severity?.coding?.[0]?.code || '',
        category: condition.category?.[0]?.coding?.[0]?.code || 'problem-list-item',
        onsetDateTime: condition.onsetDateTime ? parseISO(condition.onsetDateTime) : null,
        abatementDateTime: condition.abatementDateTime ? parseISO(condition.abatementDateTime) : null,
        note: condition.note?.[0]?.text || '',
        bodySite: condition.bodySite?.[0]?.text || '',
        stage: condition.stage?.summary?.text || ''
      });
      setSelectedCondition({
        code: condition.code?.coding?.[0]?.code,
        display: condition.code?.coding?.[0]?.display
      });
      setActiveStep(1); // Skip search step in edit mode
    }
  }, [condition, open]);

  // Get trending conditions
  const [trendingConditions, setTrendingConditions] = useState([]);
  
  useEffect(() => {
    // Fetch trending conditions on dialog open
    const fetchTrending = async () => {
      try {
        const results = await cdsClinicalDataService.getDynamicConditionCatalog(null, 5);
        const formatted = results.map(condition => ({
          code: condition.icd10_code || condition.code || condition.id,
          display: condition.display_name || condition.display || condition.name,
          frequency: condition.usage_count || 0
        }));
        setTrendingConditions(formatted);
      } catch (error) {
        console.error('Error fetching trending conditions:', error);
        // Use fallback data
        setTrendingConditions([
          { code: 'I10', display: 'Essential (primary) hypertension', frequency: 45 },
          { code: 'E11.9', display: 'Type 2 diabetes mellitus without complications', frequency: 38 }
        ]);
      }
    };
    
    if (open && !condition) { // Only fetch for new conditions
      fetchTrending();
    }
  }, [open, condition]);

  // Validate current step
  const validateStep = useCallback(() => {
    const newErrors = {};
    
    switch (activeStep) {
      case 0: // Search & Select
        if (!selectedCondition) {
          newErrors.condition = 'Please select a condition';
        }
        break;
        
      case 1: // Clinical Details
        if (!formData.clinicalStatus) {
          newErrors.clinicalStatus = 'Clinical status is required';
        }
        if (!formData.verificationStatus) {
          newErrors.verificationStatus = 'Verification status is required';
        }
        if (!formData.category) {
          newErrors.category = 'Category is required';
        }
        break;
        
      case 2: // Review
        // Final validation
        break;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [activeStep, selectedCondition, formData]);

  // Handle navigation
  const handleNext = async () => {
    if (!validateStep()) return;
    
    if (activeStep === 0 && selectedCondition) {
      // Update form data with selected condition
      setFormData(prev => ({
        ...prev,
        code: selectedCondition.code,
        display: selectedCondition.display
      }));
      
      // Evaluate CDS for the selected condition
      try {
        const alerts = await evaluateCDS('condition-select', {
          patient: patientId,
          condition: selectedCondition
        });
        setCdsAlerts(alerts);
      } catch (error) {
        console.error('CDS evaluation error:', error);
      }
    }
    
    setActiveStep(prev => prev + 1);
  };

  const handleBack = () => {
    setActiveStep(prev => prev - 1);
  };

  // Handle save
  const handleSave = async () => {
    if (!validateStep()) return;
    
    try {
      const fhirCondition = {
        resourceType: 'Condition',
        ...(condition?.id && { id: condition.id }),
        subject: {
          reference: `Patient/${patientId}`
        },
        ...(encounterId && {
          encounter: {
            reference: `Encounter/${encounterId}`
          }
        }),
        code: {
          coding: [{
            system: 'http://hl7.org/fhir/sid/icd-10',
            code: formData.code,
            display: formData.display
          }],
          text: formData.display
        },
        clinicalStatus: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
            code: formData.clinicalStatus
          }]
        },
        verificationStatus: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
            code: formData.verificationStatus
          }]
        },
        category: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/condition-category',
            code: formData.category
          }]
        }],
        ...(formData.severity && {
          severity: {
            coding: [{
              system: 'http://snomed.info/sct',
              code: formData.severity
            }]
          }
        }),
        ...(formData.onsetDateTime && {
          onsetDateTime: formData.onsetDateTime.toISOString()
        }),
        ...(formData.abatementDateTime && {
          abatementDateTime: formData.abatementDateTime.toISOString()
        }),
        ...(formData.note && {
          note: [{
            text: formData.note
          }]
        }),
        ...(formData.bodySite && {
          bodySite: [{
            text: formData.bodySite
          }]
        }),
        ...(formData.stage && {
          stage: [{
            summary: {
              text: formData.stage
            }
          }]
        }),
        recordedDate: new Date().toISOString(),
        recorder: {
          reference: 'Practitioner/current-user' // Would be actual user in production
        }
      };

      // Use the consistent save handler
      const success = await performSave(fhirCondition, `Condition ${condition ? 'updated' : 'added'} successfully`);
      
      if (success) {
        // Publish event
        publish(CLINICAL_EVENTS.CONDITION_ADDED, {
          patientId,
          conditionId: fhirCondition.id,
          condition: fhirCondition
        });
        
        // Close dialog on success
        handleClose();
      }
    } catch (error) {
      console.error('Error preparing condition data:', error);
      // The performSave function handles its own error display
    }
  };

  const handleClose = () => {
    setActiveStep(0);
    setSearchTerm('');
    setSelectedCondition(null);
    setFormData({
      code: '',
      display: '',
      clinicalStatus: 'active',
      verificationStatus: 'confirmed',
      severity: '',
      category: 'problem-list-item',
      onsetDateTime: null,
      abatementDateTime: null,
      note: '',
      bodySite: '',
      stage: ''
    });
    setErrors({});
    setCdsAlerts([]);
    onClose();
  };

  // Render step content
  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <Fade in timeout={300}>
            <Box>
              {/* Search Input */}
              <Box sx={{ mb: 3 }}>
                <Autocomplete
                  freeSolo
                  options={searchOptions}
                  loading={searchLoading}
                  value={selectedCondition}
                  onChange={(event, newValue) => {
                    setSelectedCondition(newValue);
                    setErrors(prev => ({ ...prev, condition: null }));
                  }}
                  inputValue={searchTerm}
                  onInputChange={(event, newInputValue) => {
                    setSearchTerm(newInputValue);
                  }}
                  getOptionLabel={(option) => option.label || option.display || ''}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Search Conditions"
                      placeholder="Type condition name or ICD-10 code..."
                      error={!!errors.condition}
                      helperText={errors.condition}
                      InputProps={{
                        ...params.InputProps,
                        startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                      }}
                    />
                  )}
                  renderOption={(props, option) => (
                    <ListItem {...props}>
                      <ListItemIcon>
                        <Avatar sx={{ bgcolor: theme.palette.primary.light, width: 36, height: 36 }}>
                          <ConditionIcon fontSize="small" />
                        </Avatar>
                      </ListItemIcon>
                      <ListItemText
                        primary={option.display}
                        secondary={option.subLabel}
                      />
                      {option.frequency && (
                        <Chip
                          size="small"
                          label={`${option.frequency} uses`}
                          color="primary"
                          variant="outlined"
                        />
                      )}
                    </ListItem>
                  )}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '&.Mui-focused': {
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: theme.palette.primary.main,
                          borderWidth: 2,
                        },
                      },
                    },
                  }}
                />
              </Box>

              {/* Trending Conditions */}
              {showSuggestions && !searchTerm && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Paper elevation={0} sx={{ p: 2, bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                      <TrendingIcon color="primary" />
                      <Typography variant="subtitle2" color="primary">
                        Frequently Used Conditions
                      </Typography>
                    </Stack>
                    
                    <Stack spacing={1}>
                      {trendingConditions.map((condition) => (
                        <Paper
                          key={condition.code}
                          elevation={0}
                          sx={{
                            p: 1.5,
                            cursor: 'pointer',
                            bgcolor: 'background.paper',
                            border: `1px solid ${theme.palette.divider}`,
                            transition: 'all 0.2s',
                            '&:hover': {
                              borderColor: theme.palette.primary.main,
                              transform: 'translateX(4px)',
                              boxShadow: theme.shadows[2],
                            },
                          }}
                          onClick={() => {
                            setSelectedCondition(condition);
                            setSearchTerm(condition.display);
                          }}
                        >
                          <Stack direction="row" alignItems="center" justifyContent="space-between">
                            <Box>
                              <Typography variant="body2" fontWeight="medium">
                                {condition.display}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                ICD-10: {condition.code}
                              </Typography>
                            </Box>
                            <Chip
                              size="small"
                              label={`${condition.frequency} uses`}
                              color="primary"
                              variant="outlined"
                            />
                          </Stack>
                        </Paper>
                      ))}
                    </Stack>
                  </Paper>
                </motion.div>
              )}

              {/* Selected Condition Preview */}
              {selectedCondition && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <Paper
                    elevation={2}
                    sx={{
                      mt: 3,
                      p: 2,
                      bgcolor: alpha(theme.palette.success.main, 0.05),
                      border: `2px solid ${theme.palette.success.main}`,
                    }}
                  >
                    <Stack direction="row" alignItems="center" spacing={2}>
                      <Avatar sx={{ bgcolor: theme.palette.success.main }}>
                        <CheckCircleIcon />
                      </Avatar>
                      <Box flex={1}>
                        <Typography variant="subtitle1" fontWeight="medium">
                          {selectedCondition.display}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          ICD-10: {selectedCondition.code}
                        </Typography>
                      </Box>
                    </Stack>
                  </Paper>
                </motion.div>
              )}
            </Box>
          </Fade>
        );

      case 1:
        return (
          <Fade in timeout={300}>
            <Box>
              {/* CDS Alerts */}
              {cdsAlerts.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  {cdsAlerts.map((alert, index) => (
                    <Alert
                      key={index}
                      severity={alert.indicator}
                      icon={<SmartIcon />}
                      sx={{ mb: 1 }}
                    >
                      <Typography variant="body2">{alert.summary}</Typography>
                    </Alert>
                  ))}
                </Box>
              )}

              <Stack spacing={3}>
                {/* Clinical Status */}
                <FormControl component="fieldset" error={!!errors.clinicalStatus}>
                  <FormLabel component="legend" sx={{ mb: 1 }}>
                    Clinical Status *
                  </FormLabel>
                  <RadioGroup
                    row
                    value={formData.clinicalStatus}
                    onChange={(e) => setFormData({ ...formData, clinicalStatus: e.target.value })}
                  >
                    {CLINICAL_STATUS_OPTIONS.map((option) => (
                      <FormControlLabel
                        key={option.value}
                        value={option.value}
                        control={<Radio />}
                        label={
                          <Stack direction="row" alignItems="center" spacing={0.5}>
                            <Box sx={{ color: `${option.color}.main` }}>
                              {option.icon}
                            </Box>
                            <Typography variant="body2">{option.label}</Typography>
                          </Stack>
                        }
                      />
                    ))}
                  </RadioGroup>
                </FormControl>

                {/* Verification Status - Horizontal Grid Layout */}
                <FormControl component="fieldset" error={!!errors.verificationStatus}>
                  <FormLabel component="legend" sx={{ mb: 1 }}>
                    Verification Status *
                  </FormLabel>
                  <RadioGroup
                    value={formData.verificationStatus}
                    onChange={(e) => setFormData({ ...formData, verificationStatus: e.target.value })}
                    sx={{ display: 'block' }}
                  >
                    <Grid container spacing={1}>
                      {VERIFICATION_STATUS_OPTIONS.map((option) => (
                        <Grid item xs={12} sm={6} md={4} key={option.value}>
                          <FormControlLabel
                            value={option.value}
                            control={<Radio size="small" />}
                            label={
                              <Stack direction="row" alignItems="center" spacing={0.5}>
                                <Box sx={{ color: `${option.color}.main`, display: 'flex', alignItems: 'center' }}>
                                  {option.icon}
                                </Box>
                                <Typography variant="body2" noWrap>{option.label}</Typography>
                              </Stack>
                            }
                            sx={{ 
                              width: '100%', 
                              m: 0,
                              '& .MuiFormControlLabel-label': {
                                width: '100%'
                              }
                            }}
                          />
                        </Grid>
                      ))}
                    </Grid>
                  </RadioGroup>
                </FormControl>

                <Divider />

                {/* Dates and Severity */}
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <LocalizationProvider dateAdapter={AdapterDateFns}>
                    <DateTimePicker
                      label="Onset Date/Time"
                      value={formData.onsetDateTime}
                      onChange={(value) => setFormData({ ...formData, onsetDateTime: value })}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          fullWidth
                          InputProps={{
                            ...params.InputProps,
                            startAdornment: <DateIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                          }}
                        />
                      )}
                    />
                  </LocalizationProvider>

                  <FormControl fullWidth>
                    <TextField
                      select
                      label="Severity"
                      value={formData.severity}
                      onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                      SelectProps={{
                        native: false,
                      }}
                    >
                      <MenuItem value="">None</MenuItem>
                      {SEVERITY_OPTIONS.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <Chip
                              size="small"
                              label={option.label}
                              color={option.color}
                              variant="outlined"
                            />
                          </Stack>
                        </MenuItem>
                      ))}
                    </TextField>
                  </FormControl>
                </Stack>

                {/* Category */}
                <FormControl component="fieldset" error={!!errors.category}>
                  <FormLabel component="legend" sx={{ mb: 1 }}>
                    Category *
                  </FormLabel>
                  <RadioGroup
                    row
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  >
                    {CATEGORY_OPTIONS.map((option) => (
                      <FormControlLabel
                        key={option.value}
                        value={option.value}
                        control={<Radio />}
                        label={
                          <Stack direction="row" alignItems="center" spacing={0.5}>
                            {option.icon}
                            <Typography variant="body2">{option.label}</Typography>
                          </Stack>
                        }
                      />
                    ))}
                  </RadioGroup>
                </FormControl>

                {/* Additional Details */}
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Clinical Notes"
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  placeholder="Add any relevant clinical notes..."
                  InputProps={{
                    startAdornment: <NotesIcon sx={{ mr: 1, mt: 1, color: 'text.secondary' }} />,
                  }}
                />

                {/* Body Site */}
                <TextField
                  fullWidth
                  label="Body Site (Optional)"
                  value={formData.bodySite}
                  onChange={(e) => setFormData({ ...formData, bodySite: e.target.value })}
                  placeholder="e.g., Left knee, Right lung"
                />
              </Stack>
            </Box>
          </Fade>
        );

      case 2:
        return (
          <Fade in timeout={300}>
            <Box>
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  bgcolor: alpha(theme.palette.primary.main, 0.02),
                  border: `1px solid ${theme.palette.divider}`,
                }}
              >
                <Stack spacing={3}>
                  {/* Condition Summary */}
                  <Box>
                    <Typography variant="h6" gutterBottom color="primary">
                      Condition Summary
                    </Typography>
                    <Stack spacing={2}>
                      <Stack direction="row" alignItems="center" spacing={2}>
                        <Avatar sx={{ bgcolor: theme.palette.primary.main }}>
                          <ConditionIcon />
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle1" fontWeight="medium">
                            {formData.display}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            ICD-10: {formData.code}
                          </Typography>
                        </Box>
                      </Stack>

                      <Divider />

                      {/* Status Summary */}
                      <Stack direction="row" spacing={2} flexWrap="wrap">
                        <Chip
                          icon={CLINICAL_STATUS_OPTIONS.find(s => s.value === formData.clinicalStatus)?.icon}
                          label={CLINICAL_STATUS_OPTIONS.find(s => s.value === formData.clinicalStatus)?.label}
                          color={CLINICAL_STATUS_OPTIONS.find(s => s.value === formData.clinicalStatus)?.color}
                          variant="outlined"
                        />
                        <Chip
                          icon={VERIFICATION_STATUS_OPTIONS.find(s => s.value === formData.verificationStatus)?.icon}
                          label={VERIFICATION_STATUS_OPTIONS.find(s => s.value === formData.verificationStatus)?.label}
                          color={VERIFICATION_STATUS_OPTIONS.find(s => s.value === formData.verificationStatus)?.color}
                          variant="outlined"
                        />
                        {formData.severity && (
                          <Chip
                            label={SEVERITY_OPTIONS.find(s => s.value === formData.severity)?.label}
                            color={SEVERITY_OPTIONS.find(s => s.value === formData.severity)?.color}
                            variant="outlined"
                            size="small"
                          />
                        )}
                      </Stack>

                      {/* Dates */}
                      {formData.onsetDateTime && (
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <DateIcon fontSize="small" color="action" />
                          <Typography variant="body2">
                            Onset: {format(formData.onsetDateTime, 'PPp')}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            ({differenceInDays(new Date(), formData.onsetDateTime)} days ago)
                          </Typography>
                        </Stack>
                      )}

                      {/* Notes */}
                      {formData.note && (
                        <Box sx={{ bgcolor: 'background.paper', p: 2, borderRadius: 1 }}>
                          <Stack direction="row" alignItems="flex-start" spacing={1}>
                            <NotesIcon fontSize="small" color="action" />
                            <Typography variant="body2" color="text.secondary">
                              {formData.note}
                            </Typography>
                          </Stack>
                        </Box>
                      )}
                    </Stack>
                  </Box>

                  {/* Safety Check */}
                  <Alert
                    severity="info"
                    icon={<SafetyIcon />}
                    sx={{ mt: 2 }}
                  >
                    <Typography variant="body2">
                      This condition will be added to the patient's problem list and may trigger clinical decision support alerts.
                    </Typography>
                  </Alert>
                </Stack>
              </Paper>

              {(errors.submit || saveError) && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {errors.submit || saveError}
                </Alert>
              )}
            </Box>
          </Fade>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      TransitionComponent={Zoom}
      PaperProps={{
        elevation: 8,
        sx: {
          borderRadius: 2,
          overflow: 'visible',
        },
      }}
    >
      {/* Dialog Title */}
      <DialogTitle
        sx={{
          bgcolor: theme.palette.primary.main,
          color: 'primary.contrastText',
          py: 2,
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={2}>
            <Avatar
              sx={{
                bgcolor: alpha(theme.palette.common.white, 0.2),
                color: 'inherit',
              }}
            >
              <ConditionIcon />
            </Avatar>
            <Typography variant="h6">
              {condition ? 'Edit Condition' : 'Add New Condition'}
            </Typography>
          </Stack>
          <IconButton
            edge="end"
            color="inherit"
            onClick={handleClose}
            sx={{
              '&:hover': {
                bgcolor: alpha(theme.palette.common.white, 0.1),
              },
            }}
          >
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      {/* Progress Indicator */}
      {(loading || isSaving) && <LinearProgress />}

      {/* Stepper */}
      <Box sx={{ px: 3, pt: 3, pb: 1 }}>
        <Stepper activeStep={activeStep}>
          {STEPS.map((label, index) => (
            <Step key={label}>
              <StepLabel
                sx={{
                  '& .MuiStepLabel-label': {
                    typography: 'body2',
                  },
                }}
              >
                {label}
              </StepLabel>
            </Step>
          ))}
        </Stepper>
      </Box>

      {/* Dialog Content */}
      <DialogContent sx={{ px: 3, py: 2, minHeight: 400 }}>
        <AnimatePresence mode="wait">
          {renderStepContent()}
        </AnimatePresence>
      </DialogContent>

      {/* Dialog Actions */}
      <DialogActions
        sx={{
          px: 3,
          py: 2,
          bgcolor: theme.palette.mode === 'dark' ? theme.palette.grey[900] : theme.palette.grey[50],
          borderTop: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Stack direction="row" spacing={2} justifyContent="space-between" width="100%">
          <Button
            onClick={handleClose}
            disabled={loading || isSaving}
            sx={{ minWidth: 100 }}
          >
            Cancel
          </Button>
          
          <Stack direction="row" spacing={2}>
            {activeStep > 0 && (
              <Button
                onClick={handleBack}
                disabled={loading || isSaving}
                startIcon={<BackIcon />}
                sx={{ minWidth: 100 }}
              >
                Back
              </Button>
            )}
            
            {activeStep < STEPS.length - 1 ? (
              <Button
                variant="contained"
                onClick={handleNext}
                disabled={loading || isSaving || (activeStep === 0 && !selectedCondition)}
                endIcon={<NextIcon />}
                sx={{ minWidth: 100 }}
              >
                Next
              </Button>
            ) : (
              <Button
                variant="contained"
                onClick={handleSave}
                disabled={loading || isSaving}
                startIcon={isSaving ? <CircularProgress size={20} /> : <SaveIcon />}
                sx={{ minWidth: 100 }}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            )}
          </Stack>
        </Stack>
      </DialogActions>
    </Dialog>
  );
};

export default ConditionDialogEnhanced;