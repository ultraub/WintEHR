import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  Typography,
  Box,
  Chip,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Paper,
  Alert,
  CircularProgress,
  Autocomplete,
  Card,
  CardContent,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  FormControlLabel,
  Switch,
  Tooltip,
  Fade,
  Zoom,
  Skeleton,
  InputAdornment,
  Radio,
  RadioGroup,
  Rating,
} from '@mui/material';
import {
  Close as CloseIcon,
  Search as SearchIcon,
  LocalHospital as ProcedureIcon,
  Event as EventIcon,
  LocationOn as LocationIcon,
  Person as PersonIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Info as InfoIcon,
  Schedule as ScheduleIcon,
  Description as DescriptionIcon,
  Assignment as AssignmentIcon,
  CalendarToday as CalendarIcon,
  Healing as HealingIcon,
  MedicalServices as MedicalIcon,
  Science as ScienceIcon,
  Biotech as BiotechIcon,
  MonitorHeart as MonitorIcon,
  Vaccines as VaccinesIcon,
  Psychology as PsychologyIcon,
  TrendingUp as TrendingUpIcon,
  AccessTime as AccessTimeIcon,
  AttachMoney as CostIcon,
  VerifiedUser as VerifiedIcon,
  LocalOffer as CategoryIcon,
} from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, differenceInMinutes, addMinutes, isAfter, isBefore } from 'date-fns';
import { debounce } from 'lodash';

import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import { useClinical as useClinicalContext } from '../../../../contexts/ClinicalContext';
import { useClinicalWorkflow } from '../../../../contexts/ClinicalWorkflowContext';
import { CLINICAL_EVENTS } from '../../../../constants/clinicalEvents';
import { fhirClient } from '../../../../core/fhir/services/fhirClient';
import cdsClinicalDataService from '../../../../services/cdsClinicalDataService';

const searchProcedures = async (query) => {
  try {
    // Search for procedures in the system by status
    const searchParams = {
      _count: 100,
      _sort: '-date',
      status: 'completed,in-progress,preparation'
    };
    
    if (query) {
      // Add text search if query provided
      searchParams._text = query;
    }
    
    const bundle = await fhirClient.search('Procedure', searchParams);
    const procedures = bundle.entry?.map(entry => entry.resource) || [];
    
    // Extract unique procedure codes and names
    const procedureMap = new Map();
    
    procedures.forEach(proc => {
      if (proc.code?.coding) {
        proc.code.coding.forEach(coding => {
          const key = coding.code || coding.display;
          if (key && !procedureMap.has(key)) {
            procedureMap.set(key, {
              code: coding.code,
              display: coding.display || proc.code.text || 'Unknown Procedure',
              system: coding.system
            });
          }
        });
      }
    });
    
    // Convert to array and filter by query if provided
    let results = Array.from(procedureMap.values());
    
    if (query) {
      const searchTerm = query.toLowerCase();
      results = results.filter(item => 
        item.display?.toLowerCase().includes(searchTerm) ||
        item.code?.toLowerCase().includes(searchTerm)
      );
    }
    
    return results.slice(0, 20); // Limit results
  } catch (error) {
    console.error('Error searching procedures:', error);
    return [];
  }
};

// Procedure status options
const PROCEDURE_STATUS_OPTIONS = [
  { value: 'preparation', label: 'Preparation', color: 'info' },
  { value: 'in-progress', label: 'In Progress', color: 'warning' },
  { value: 'completed', label: 'Completed', color: 'success' },
  { value: 'on-hold', label: 'On Hold', color: 'default' },
  { value: 'stopped', label: 'Stopped', color: 'error' },
  { value: 'entered-in-error', label: 'Entered in Error', color: 'error' },
  { value: 'unknown', label: 'Unknown', color: 'default' },
];

// Common procedure categories
const PROCEDURE_CATEGORIES = [
  { id: 'diagnostic', name: 'Diagnostic', icon: <ScienceIcon />, color: '#2196F3' },
  { id: 'surgical', name: 'Surgical', icon: <HealingIcon />, color: '#F44336' },
  { id: 'therapeutic', name: 'Therapeutic', icon: <MedicalIcon />, color: '#4CAF50' },
  { id: 'counseling', name: 'Counseling', icon: <PsychologyIcon />, color: '#9C27B0' },
  { id: 'imaging', name: 'Imaging', icon: <MonitorIcon />, color: '#FF9800' },
  { id: 'laboratory', name: 'Laboratory', icon: <BiotechIcon />, color: '#00BCD4' },
];

// Common outcome options
const OUTCOME_OPTIONS = [
  { value: 'successful', label: 'Successful', severity: 'success' },
  { value: 'partially-successful', label: 'Partially Successful', severity: 'warning' },
  { value: 'unsuccessful', label: 'Unsuccessful', severity: 'error' },
  { value: 'complications', label: 'Complications', severity: 'error' },
];

// Risk levels
const RISK_LEVELS = [
  { value: 'low', label: 'Low Risk', color: 'success' },
  { value: 'moderate', label: 'Moderate Risk', color: 'warning' },
  { value: 'high', label: 'High Risk', color: 'error' },
];

const ProcedureDialogEnhanced = ({
  open,
  onClose,
  procedure = null,
  onSave,
  patientId,
  encounterId,
  mode = 'schedule', // 'schedule', 'edit', 'document'
}) => {
  const { patient } = useClinicalContext();
  const { publish } = useClinicalWorkflow();
  // FHIRClient is imported directly, not from hook

  // Dialog state
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [alerts, setAlerts] = useState([]);

  // Form state
  const [selectedProcedure, setSelectedProcedure] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [trendingProcedures, setTrendingProcedures] = useState([]);
  const [relatedProcedures, setRelatedProcedures] = useState([]);

  // Procedure details
  const [formData, setFormData] = useState({
    status: 'preparation',
    category: '',
    performedDateTime: null,
    performedPeriod: {
      start: null,
      end: null,
    },
    performer: {
      actor: '',
      role: '',
    },
    location: '',
    reasonCode: '',
    reasonReference: null,
    bodySite: '',
    outcome: '',
    complication: {
      hasComplication: false,
      type: '',
      notes: '',
    },
    followUp: '',
    note: '',
    usedCode: [],
    usedReference: [],
    report: [],
    focalDevice: {
      hasFocalDevice: false,
      action: '',
      manipulated: '',
    },
  });

  // Load trending procedures on mount
  useEffect(() => {
    if (open && !procedure) {
      loadTrendingProcedures();
      if (patient) {
        loadRelatedProcedures();
      }
    }
  }, [open, procedure, patient]);

  // Load existing procedure data
  useEffect(() => {
    if (procedure) {
      // Parse existing procedure into form data
      setFormData({
        status: procedure.status || 'preparation',
        category: procedure.category?.[0]?.coding?.[0]?.code || '',
        performedDateTime: procedure.performedDateTime ? new Date(procedure.performedDateTime) : null,
        performedPeriod: {
          start: procedure.performedPeriod?.start ? new Date(procedure.performedPeriod.start) : null,
          end: procedure.performedPeriod?.end ? new Date(procedure.performedPeriod.end) : null,
        },
        performer: {
          actor: procedure.performer?.[0]?.actor?.display || '',
          role: procedure.performer?.[0]?.function?.coding?.[0]?.display || '',
        },
        location: procedure.location?.display || '',
        reasonCode: procedure.reasonCode?.[0]?.coding?.[0]?.code || '',
        reasonReference: procedure.reasonReference?.[0] || null,
        bodySite: procedure.bodySite?.[0]?.coding?.[0]?.display || '',
        outcome: procedure.outcome?.coding?.[0]?.code || '',
        complication: {
          hasComplication: !!procedure.complication?.length,
          type: procedure.complication?.[0]?.coding?.[0]?.code || '',
          notes: procedure.complication?.[0]?.coding?.[0]?.display || '',
        },
        followUp: procedure.followUp?.[0]?.text || '',
        note: procedure.note?.[0]?.text || '',
        usedCode: procedure.usedCode || [],
        usedReference: procedure.usedReference || [],
        report: procedure.report || [],
        focalDevice: {
          hasFocalDevice: !!procedure.focalDevice?.length,
          action: procedure.focalDevice?.[0]?.action?.coding?.[0]?.code || '',
          manipulated: procedure.focalDevice?.[0]?.manipulated?.display || '',
        },
      });
      setSelectedProcedure({
        code: procedure.code?.coding?.[0]?.code,
        display: procedure.code?.coding?.[0]?.display,
        system: procedure.code?.coding?.[0]?.system,
      });
      setActiveStep(1); // Skip to details if editing
    }
  }, [procedure]);

  // Load trending procedures from recent procedures
  const loadTrendingProcedures = async () => {
    try {
      const recentProcedures = await fhirClient.search('Procedure', {
        _count: 100,
        _sort: '-date',
        status: 'completed',
      });

      // Count procedure usage
      const procedureCount = {};
      recentProcedures.entry?.forEach(entry => {
        const proc = entry.resource.code?.coding?.[0];
        if (proc) {
          const key = proc.code;
          if (!procedureCount[key]) {
            procedureCount[key] = {
              ...proc,
              count: 0,
              lastPerformed: entry.resource.performedDateTime || entry.resource.performedPeriod?.start,
              averageDuration: 0,
              outcomes: [],
            };
          }
          procedureCount[key].count++;
          
          // Track outcomes
          if (entry.resource.outcome) {
            procedureCount[key].outcomes.push(entry.resource.outcome.coding?.[0]?.code);
          }
          
          // Calculate average duration if period is available
          if (entry.resource.performedPeriod?.start && entry.resource.performedPeriod?.end) {
            const duration = differenceInMinutes(
              new Date(entry.resource.performedPeriod.end),
              new Date(entry.resource.performedPeriod.start)
            );
            procedureCount[key].averageDuration = 
              (procedureCount[key].averageDuration * (procedureCount[key].count - 1) + duration) / procedureCount[key].count;
          }
        }
      });

      // Sort by frequency and get top 10
      const trending = Object.values(procedureCount)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      setTrendingProcedures(trending);
    } catch (error) {
      console.error('Error loading trending procedures:', error);
    }
  };

  // Load related procedures based on patient conditions
  const loadRelatedProcedures = async () => {
    try {
      // Get patient's active conditions
      const conditions = await fhirClient.search('Condition', {
        patient: patientId,
        clinical_status: 'active',
        _count: 10,
      });

      // Get procedures commonly associated with these conditions
      const related = [];
      
      // Simple mapping of conditions to common procedures
      conditions.entry?.forEach(entry => {
        const condition = entry.resource;
        const conditionCode = condition.code?.coding?.[0]?.code;
        
        // Example mappings (in real system, this would come from a knowledge base)
        if (conditionCode?.includes('diabetes')) {
          related.push({
            code: '38266-7',
            display: 'HbA1c measurement',
            system: 'http://loinc.org',
            reason: 'Diabetes monitoring',
          });
          related.push({
            code: '230141009',
            display: 'Diabetic foot examination',
            system: 'http://snomed.info/sct',
            reason: 'Diabetes complication screening',
          });
        }
        
        if (conditionCode?.includes('hypertension')) {
          related.push({
            code: '75367002',
            display: 'Blood pressure measurement',
            system: 'http://snomed.info/sct',
            reason: 'Hypertension monitoring',
          });
        }
      });
      
      setRelatedProcedures(related);
    } catch (error) {
      console.error('Error loading related procedures:', error);
    }
  };

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce(async (query) => {
      if (!query || query.length < 2) {
        setSearchResults([]);
        return;
      }

      setSearching(true);
      try {
        const results = await searchProcedures(query);
        setSearchResults(results.slice(0, 10));
      } catch (error) {
        console.error('Error searching procedures:', error);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300),
    []
  );

  // Handle search query change
  const handleSearchChange = (event, value) => {
    setSearchQuery(value);
    debouncedSearch(value);
  };

  // Handle procedure selection
  const handleProcedureSelect = (procedure) => {
    setSelectedProcedure(procedure);
    setSearchQuery(procedure.display);
    
    // Auto-populate category based on procedure type
    autoPopulateCategory(procedure);
    
    // Check for contraindications
    checkContraindications(procedure);
  };

  // Auto-populate category based on procedure
  const autoPopulateCategory = (procedure) => {
    // Simple heuristic based on procedure name/code
    const display = procedure.display?.toLowerCase() || '';
    
    if (display.includes('imaging') || display.includes('x-ray') || display.includes('mri') || display.includes('ct')) {
      setFormData(prev => ({ ...prev, category: 'imaging' }));
    } else if (display.includes('surgery') || display.includes('excision') || display.includes('repair')) {
      setFormData(prev => ({ ...prev, category: 'surgical' }));
    } else if (display.includes('lab') || display.includes('test') || display.includes('analysis')) {
      setFormData(prev => ({ ...prev, category: 'laboratory' }));
    } else if (display.includes('counsel') || display.includes('therapy') || display.includes('education')) {
      setFormData(prev => ({ ...prev, category: 'counseling' }));
    } else if (display.includes('diagnostic') || display.includes('examination') || display.includes('assessment')) {
      setFormData(prev => ({ ...prev, category: 'diagnostic' }));
    } else {
      setFormData(prev => ({ ...prev, category: 'therapeutic' }));
    }
  };

  // Check for contraindications based on patient data
  const checkContraindications = async (procedure) => {
    const newAlerts = [];
    
    // Check for recent similar procedures
    try {
      const recentProcedures = await fhirClient.search('Procedure', {
        patient: patientId,
        code: procedure.code,
        _count: 5,
        _sort: '-date',
      });
      
      if (recentProcedures.entry?.length > 0) {
        const lastProcedure = recentProcedures.entry[0].resource;
        const daysSinceLastProcedure = differenceInMinutes(
          new Date(),
          new Date(lastProcedure.performedDateTime || lastProcedure.performedPeriod?.end)
        ) / (60 * 24);
        
        if (daysSinceLastProcedure < 30) {
          newAlerts.push({
            severity: 'warning',
            message: `This procedure was performed ${Math.round(daysSinceLastProcedure)} days ago. Consider if repeat is necessary.`,
          });
        }
      }
    } catch (error) {
      console.error('Error checking recent procedures:', error);
    }
    
    // Check for active conditions that might affect procedure
    try {
      const conditions = await fhirClient.search('Condition', {
        patient: patientId,
        clinical_status: 'active',
        _count: 10,
      });
      
      conditions.entry?.forEach(entry => {
        const condition = entry.resource;
        // Simple checks - in real system would use clinical rules engine
        if (condition.code?.coding?.[0]?.display?.toLowerCase().includes('bleeding')) {
          if (formData.category === 'surgical') {
            newAlerts.push({
              severity: 'error',
              message: 'Patient has active bleeding disorder - surgical procedures require special precautions',
            });
          }
        }
      });
    } catch (error) {
      console.error('Error checking conditions:', error);
    }
    
    setAlerts(newAlerts);
  };

  // Handle step navigation
  const handleNext = () => {
    if (validateStep(activeStep)) {
      setActiveStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  // Validate current step
  const validateStep = (step) => {
    const newErrors = {};
    
    switch (step) {
      case 0: // Procedure selection
        if (!selectedProcedure) {
          newErrors.procedure = 'Please select a procedure';
        }
        break;
        
      case 1: // Procedure details
        if (!formData.status) {
          newErrors.status = 'Status is required';
        }
        if (!formData.category) {
          newErrors.category = 'Category is required';
        }
        if (formData.status === 'completed' || formData.status === 'in-progress') {
          if (!formData.performedDateTime && !formData.performedPeriod.start) {
            newErrors.performed = 'Performed date/time is required for this status';
          }
        }
        if (!formData.performer.actor) {
          newErrors.performer = 'Performer is required';
        }
        break;
        
      case 2: // Review
        // Final validation
        break;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Build FHIR Procedure resource
  const buildFHIRResource = () => {
    const resource = {
      resourceType: 'Procedure',
      status: formData.status,
      code: {
        coding: [{
          system: selectedProcedure.system || 'http://snomed.info/sct',
          code: selectedProcedure.code,
          display: selectedProcedure.display,
        }],
      },
      subject: {
        reference: `Patient/${patientId}`,
        display: patient ? `${patient.name?.[0]?.given?.join(' ')} ${patient.name?.[0]?.family}` : undefined,
      },
    };
    
    // Add encounter reference if provided
    if (encounterId) {
      resource.encounter = {
        reference: `Encounter/${encounterId}`,
      };
    }
    
    // Add category
    if (formData.category) {
      resource.category = {
        coding: [{
          system: 'http://snomed.info/sct',
          code: formData.category,
          display: PROCEDURE_CATEGORIES.find(c => c.id === formData.category)?.name,
        }],
      };
    }
    
    // Add performed date/time or period
    if (formData.performedDateTime) {
      resource.performedDateTime = formData.performedDateTime.toISOString();
    } else if (formData.performedPeriod.start) {
      resource.performedPeriod = {
        start: formData.performedPeriod.start.toISOString(),
      };
      if (formData.performedPeriod.end) {
        resource.performedPeriod.end = formData.performedPeriod.end.toISOString();
      }
    }
    
    // Add performer
    if (formData.performer.actor) {
      resource.performer = [{
        actor: {
          display: formData.performer.actor,
        },
      }];
      if (formData.performer.role) {
        resource.performer[0].function = {
          coding: [{
            display: formData.performer.role,
          }],
        };
      }
    }
    
    // Add location
    if (formData.location) {
      resource.location = {
        display: formData.location,
      };
    }
    
    // Add reason code
    if (formData.reasonCode) {
      resource.reasonCode = [{
        coding: [{
          system: 'http://snomed.info/sct',
          code: formData.reasonCode,
        }],
      }];
    }
    
    // Add body site
    if (formData.bodySite) {
      resource.bodySite = [{
        coding: [{
          display: formData.bodySite,
        }],
      }];
    }
    
    // Add outcome
    if (formData.outcome) {
      resource.outcome = {
        coding: [{
          system: 'http://snomed.info/sct',
          code: formData.outcome,
          display: OUTCOME_OPTIONS.find(o => o.value === formData.outcome)?.label,
        }],
      };
    }
    
    // Add complication if present
    if (formData.complication.hasComplication && formData.complication.type) {
      resource.complication = [{
        coding: [{
          system: 'http://snomed.info/sct',
          code: formData.complication.type,
          display: formData.complication.notes,
        }],
      }];
    }
    
    // Add follow up
    if (formData.followUp) {
      resource.followUp = [{
        text: formData.followUp,
      }];
    }
    
    // Add focal device if present
    if (formData.focalDevice.hasFocalDevice) {
      resource.focalDevice = [{
        action: {
          coding: [{
            code: formData.focalDevice.action,
          }],
        },
      }];
      if (formData.focalDevice.manipulated) {
        resource.focalDevice[0].manipulated = {
          display: formData.focalDevice.manipulated,
        };
      }
    }
    
    // Add notes
    if (formData.note) {
      resource.note = [{
        text: formData.note,
        time: new Date().toISOString(),
      }];
    }
    
    // Preserve existing ID if editing
    if (procedure?.id) {
      resource.id = procedure.id;
    }
    
    return resource;
  };

  // Handle save
  const handleSave = async () => {
    if (!validateStep(activeStep)) {
      return;
    }
    
    setSaving(true);
    try {
      const fhirResource = buildFHIRResource();
      
      // Call the parent's save handler
      await onSave(fhirResource);
      
      // Publish clinical event
      await publish(CLINICAL_EVENTS.PROCEDURE_PERFORMED, {
        patientId,
        procedureId: fhirResource.id,
        procedure: selectedProcedure.display,
        status: formData.status,
        category: formData.category,
      });
      
      // Close dialog
      handleClose();
    } catch (error) {
      console.error('Error saving procedure:', error);
      setErrors({ submit: 'Failed to save procedure. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  // Handle dialog close
  const handleClose = () => {
    // Reset form
    setActiveStep(0);
    setSelectedProcedure(null);
    setSearchQuery('');
    setSearchResults([]);
    setFormData({
      status: 'preparation',
      category: '',
      performedDateTime: null,
      performedPeriod: {
        start: null,
        end: null,
      },
      performer: {
        actor: '',
        role: '',
      },
      location: '',
      reasonCode: '',
      reasonReference: null,
      bodySite: '',
      outcome: '',
      complication: {
        hasComplication: false,
        type: '',
        notes: '',
      },
      followUp: '',
      note: '',
      usedCode: [],
      usedReference: [],
      report: [],
      focalDevice: {
        hasFocalDevice: false,
        action: '',
        manipulated: '',
      },
    });
    setErrors({});
    setAlerts([]);
    onClose();
  };

  // Get step content
  const getStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <Fade in={true}>
            <Box>
              {/* Procedure Search */}
              <Box mb={3}>
                <Autocomplete
                  freeSolo
                  options={searchResults}
                  getOptionLabel={(option) => option.display || option}
                  value={selectedProcedure}
                  onChange={(event, newValue) => {
                    if (typeof newValue === 'object' && newValue !== null) {
                      handleProcedureSelect(newValue);
                    }
                  }}
                  inputValue={searchQuery}
                  onInputChange={handleSearchChange}
                  loading={searching}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Search Procedures"
                      placeholder="Type procedure name or CPT/SNOMED code..."
                      error={!!errors.procedure}
                      helperText={errors.procedure}
                      InputProps={{
                        ...params.InputProps,
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon />
                          </InputAdornment>
                        ),
                      }}
                    />
                  )}
                  renderOption={(props, option) => (
                    <Box component="li" {...props}>
                      <ProcedureIcon sx={{ mr: 2, color: 'primary.main' }} />
                      <Box>
                        <Typography variant="body1">{option.display}</Typography>
                        {option.code && (
                          <Typography variant="caption" color="text.secondary">
                            {option.system?.includes('cpt') ? 'CPT' : 'SNOMED'}: {option.code}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  )}
                />
              </Box>

              {/* Procedure Categories */}
              <Box mb={3}>
                <Typography variant="subtitle2" gutterBottom>
                  Browse by Category
                </Typography>
                <Grid container spacing={1}>
                  {PROCEDURE_CATEGORIES.map((category) => (
                    <Grid item key={category.id}>
                      <Chip
                        icon={category.icon}
                        label={category.name}
                        onClick={() => {
                          setSearchQuery(category.name);
                          debouncedSearch(category.name);
                        }}
                        sx={{
                          bgcolor: category.color + '20',
                          color: category.color,
                          '&:hover': {
                            bgcolor: category.color + '30',
                          },
                        }}
                      />
                    </Grid>
                  ))}
                </Grid>
              </Box>

              {/* Trending Procedures */}
              {trendingProcedures.length > 0 && (
                <Box mb={3}>
                  <Typography variant="subtitle2" gutterBottom>
                    <TrendingUpIcon sx={{ fontSize: 16, mr: 1, verticalAlign: 'middle' }} />
                    Frequently Performed
                  </Typography>
                  <Grid container spacing={1}>
                    {trendingProcedures.map((proc) => (
                      <Grid item key={proc.code} xs={12} sm={6}>
                        <Card 
                          variant="outlined" 
                          sx={{ 
                            cursor: 'pointer',
                            '&:hover': { bgcolor: 'action.hover' }
                          }}
                          onClick={() => handleProcedureSelect(proc)}
                        >
                          <CardContent sx={{ py: 1 }}>
                            <Box display="flex" justifyContent="space-between" alignItems="center">
                              <Box flex={1}>
                                <Typography variant="body2" noWrap>
                                  {proc.display}
                                </Typography>
                                <Box display="flex" alignItems="center" gap={1}>
                                  <Chip 
                                    label={`${proc.count} times`} 
                                    size="small" 
                                    variant="outlined"
                                  />
                                  {proc.averageDuration > 0 && (
                                    <Typography variant="caption" color="text.secondary">
                                      Avg: {Math.round(proc.averageDuration)} min
                                    </Typography>
                                  )}
                                </Box>
                              </Box>
                              <ProcedureIcon color="action" />
                            </Box>
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              )}

              {/* Related Procedures based on conditions */}
              {relatedProcedures.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    <InfoIcon sx={{ fontSize: 16, mr: 1, verticalAlign: 'middle' }} />
                    Recommended Based on Conditions
                  </Typography>
                  <List dense>
                    {relatedProcedures.map((proc, index) => (
                      <ListItem 
                        key={index}
                        button
                        onClick={() => handleProcedureSelect(proc)}
                      >
                        <ListItemIcon>
                          <MedicalIcon color="primary" />
                        </ListItemIcon>
                        <ListItemText
                          primary={proc.display}
                          secondary={proc.reason}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}

              {/* Alerts */}
              {alerts.map((alert, index) => (
                <Alert key={index} severity={alert.severity} sx={{ mb: 2 }}>
                  {alert.message}
                </Alert>
              ))}
            </Box>
          </Fade>
        );

      case 1:
        return (
          <Fade in={true}>
            <Box>
              <Grid container spacing={3}>
                {/* Procedure Status */}
                <Grid item xs={12}>
                  <FormControl component="fieldset">
                    <Typography variant="subtitle2" gutterBottom>
                      Procedure Status
                    </Typography>
                    <RadioGroup
                      row
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    >
                      {PROCEDURE_STATUS_OPTIONS.map((option) => (
                        <FormControlLabel
                          key={option.value}
                          value={option.value}
                          control={<Radio />}
                          label={
                            <Chip
                              label={option.label}
                              color={option.color}
                              size="small"
                              variant={formData.status === option.value ? 'filled' : 'outlined'}
                            />
                          }
                        />
                      ))}
                    </RadioGroup>
                  </FormControl>
                  {errors.status && (
                    <FormHelperText error>{errors.status}</FormHelperText>
                  )}
                </Grid>

                {/* Category */}
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth error={!!errors.category}>
                    <InputLabel>Category</InputLabel>
                    <Select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      label="Category"
                      startAdornment={
                        formData.category && (
                          <InputAdornment position="start">
                            {PROCEDURE_CATEGORIES.find(c => c.id === formData.category)?.icon}
                          </InputAdornment>
                        )
                      }
                    >
                      {PROCEDURE_CATEGORIES.map((cat) => (
                        <MenuItem key={cat.id} value={cat.id}>
                          <Box display="flex" alignItems="center">
                            {cat.icon}
                            <Typography sx={{ ml: 1 }}>{cat.name}</Typography>
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                    {errors.category && (
                      <FormHelperText>{errors.category}</FormHelperText>
                    )}
                  </FormControl>
                </Grid>

                {/* Performed Date/Time */}
                {(formData.status === 'completed' || formData.status === 'in-progress') && (
                  <>
                    <Grid item xs={12}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={!!formData.performedPeriod.start}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({
                                  ...formData,
                                  performedDateTime: null,
                                  performedPeriod: { start: new Date(), end: null },
                                });
                              } else {
                                setFormData({
                                  ...formData,
                                  performedDateTime: new Date(),
                                  performedPeriod: { start: null, end: null },
                                });
                              }
                            }}
                          />
                        }
                        label="Procedure took place over a period"
                      />
                    </Grid>
                    
                    {formData.performedPeriod.start ? (
                      <>
                        <Grid item xs={12} md={6}>
                          <LocalizationProvider dateAdapter={AdapterDateFns}>
                            <DateTimePicker
                              label="Start Date/Time"
                              value={formData.performedPeriod.start}
                              onChange={(date) => setFormData({
                                ...formData,
                                performedPeriod: { ...formData.performedPeriod, start: date }
                              })}
                              renderInput={(params) => (
                                <TextField
                                  {...params}
                                  fullWidth
                                  error={!!errors.performed}
                                  helperText={errors.performed}
                                />
                              )}
                              maxDate={new Date()}
                            />
                          </LocalizationProvider>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <LocalizationProvider dateAdapter={AdapterDateFns}>
                            <DateTimePicker
                              label="End Date/Time"
                              value={formData.performedPeriod.end}
                              onChange={(date) => setFormData({
                                ...formData,
                                performedPeriod: { ...formData.performedPeriod, end: date }
                              })}
                              renderInput={(params) => (
                                <TextField {...params} fullWidth />
                              )}
                              minDate={formData.performedPeriod.start}
                              maxDate={new Date()}
                            />
                          </LocalizationProvider>
                        </Grid>
                        {formData.performedPeriod.start && formData.performedPeriod.end && (
                          <Grid item xs={12}>
                            <Alert severity="info">
                              Duration: {differenceInMinutes(
                                formData.performedPeriod.end,
                                formData.performedPeriod.start
                              )} minutes
                            </Alert>
                          </Grid>
                        )}
                      </>
                    ) : (
                      <Grid item xs={12} md={6}>
                        <LocalizationProvider dateAdapter={AdapterDateFns}>
                          <DateTimePicker
                            label="Performed Date/Time"
                            value={formData.performedDateTime}
                            onChange={(date) => setFormData({ ...formData, performedDateTime: date })}
                            renderInput={(params) => (
                              <TextField
                                {...params}
                                fullWidth
                                error={!!errors.performed}
                                helperText={errors.performed}
                              />
                            )}
                            maxDate={new Date()}
                          />
                        </LocalizationProvider>
                      </Grid>
                    )}
                  </>
                )}

                {/* Performer */}
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Performed By"
                    value={formData.performer.actor}
                    onChange={(e) => setFormData({
                      ...formData,
                      performer: { ...formData.performer, actor: e.target.value }
                    })}
                    error={!!errors.performer}
                    helperText={errors.performer}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <PersonIcon />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>

                {/* Role */}
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Role"
                    value={formData.performer.role}
                    onChange={(e) => setFormData({
                      ...formData,
                      performer: { ...formData.performer, role: e.target.value }
                    })}
                    placeholder="e.g., Primary Surgeon, Anesthesiologist"
                  />
                </Grid>

                {/* Location */}
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Location"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <LocationIcon />
                        </InputAdornment>
                      ),
                    }}
                    placeholder="e.g., Operating Room 3, Radiology Suite"
                  />
                </Grid>

                {/* Body Site */}
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Body Site"
                    value={formData.bodySite}
                    onChange={(e) => setFormData({ ...formData, bodySite: e.target.value })}
                    placeholder="e.g., Left knee, Right upper arm"
                  />
                </Grid>

                {/* Outcome (if completed) */}
                {formData.status === 'completed' && (
                  <Grid item xs={12}>
                    <FormControl fullWidth>
                      <InputLabel>Outcome</InputLabel>
                      <Select
                        value={formData.outcome}
                        onChange={(e) => setFormData({ ...formData, outcome: e.target.value })}
                        label="Outcome"
                      >
                        {OUTCOME_OPTIONS.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            <Box display="flex" alignItems="center">
                              <CheckCircleIcon 
                                sx={{ 
                                  mr: 1,
                                  color: 
                                    option.severity === 'success' ? 'success.main' :
                                    option.severity === 'warning' ? 'warning.main' :
                                    'error.main'
                                }} 
                              />
                              {option.label}
                            </Box>
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                )}

                {/* Complications */}
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.complication.hasComplication}
                        onChange={(e) => setFormData({
                          ...formData,
                          complication: { ...formData.complication, hasComplication: e.target.checked }
                        })}
                      />
                    }
                    label="Complications occurred"
                  />
                </Grid>

                {formData.complication.hasComplication && (
                  <>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Complication Type"
                        value={formData.complication.type}
                        onChange={(e) => setFormData({
                          ...formData,
                          complication: { ...formData.complication, type: e.target.value }
                        })}
                        placeholder="e.g., Hemorrhage, Infection"
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        multiline
                        rows={2}
                        label="Complication Details"
                        value={formData.complication.notes}
                        onChange={(e) => setFormData({
                          ...formData,
                          complication: { ...formData.complication, notes: e.target.value }
                        })}
                      />
                    </Grid>
                  </>
                )}

                {/* Follow Up */}
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Follow Up Instructions"
                    value={formData.followUp}
                    onChange={(e) => setFormData({ ...formData, followUp: e.target.value })}
                    multiline
                    rows={2}
                    placeholder="e.g., Return in 2 weeks for suture removal"
                  />
                </Grid>

                {/* Focal Device (for surgical procedures) */}
                {formData.category === 'surgical' && (
                  <Grid item xs={12}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={formData.focalDevice.hasFocalDevice}
                          onChange={(e) => setFormData({
                            ...formData,
                            focalDevice: { ...formData.focalDevice, hasFocalDevice: e.target.checked }
                          })}
                        />
                      }
                      label="Device/Implant used"
                    />
                  </Grid>
                )}

                {formData.focalDevice.hasFocalDevice && (
                  <>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Device Action"
                        value={formData.focalDevice.action}
                        onChange={(e) => setFormData({
                          ...formData,
                          focalDevice: { ...formData.focalDevice, action: e.target.value }
                        })}
                        placeholder="e.g., Implanted, Removed"
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Device Name"
                        value={formData.focalDevice.manipulated}
                        onChange={(e) => setFormData({
                          ...formData,
                          focalDevice: { ...formData.focalDevice, manipulated: e.target.value }
                        })}
                        placeholder="e.g., Cardiac pacemaker, Hip prosthesis"
                      />
                    </Grid>
                  </>
                )}

                {/* Notes */}
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Procedure Notes"
                    value={formData.note}
                    onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <DescriptionIcon />
                        </InputAdornment>
                      ),
                    }}
                    placeholder="Additional details about the procedure..."
                  />
                </Grid>
              </Grid>
            </Box>
          </Fade>
        );

      case 2:
        return (
          <Fade in={true}>
            <Box>
              <Typography variant="h6" gutterBottom>
                Review Procedure Record
              </Typography>
              
              <Card variant="outlined" sx={{ mb: 3 }}>
                <CardContent>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <Box display="flex" alignItems="center" mb={2}>
                        <ProcedureIcon sx={{ mr: 2, color: 'primary.main', fontSize: 32 }} />
                        <Box>
                          <Typography variant="h6">
                            {selectedProcedure?.display}
                          </Typography>
                          {selectedProcedure?.code && (
                            <Typography variant="caption" color="text.secondary">
                              Code: {selectedProcedure.code}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </Grid>
                    
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" color="text.secondary">
                        Status
                      </Typography>
                      <Chip
                        label={PROCEDURE_STATUS_OPTIONS.find(opt => opt.value === formData.status)?.label}
                        color={PROCEDURE_STATUS_OPTIONS.find(opt => opt.value === formData.status)?.color}
                        size="small"
                      />
                    </Grid>
                    
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" color="text.secondary">
                        Category
                      </Typography>
                      <Box display="flex" alignItems="center">
                        {PROCEDURE_CATEGORIES.find(c => c.id === formData.category)?.icon}
                        <Typography variant="body1" sx={{ ml: 1 }}>
                          {PROCEDURE_CATEGORIES.find(c => c.id === formData.category)?.name}
                        </Typography>
                      </Box>
                    </Grid>
                    
                    {formData.performedDateTime && (
                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" color="text.secondary">
                          Performed Date/Time
                        </Typography>
                        <Typography variant="body1">
                          {format(formData.performedDateTime, 'PPpp')}
                        </Typography>
                      </Grid>
                    )}
                    
                    {formData.performedPeriod.start && (
                      <Grid item xs={12}>
                        <Typography variant="subtitle2" color="text.secondary">
                          Performed Period
                        </Typography>
                        <Typography variant="body1">
                          {format(formData.performedPeriod.start, 'PPpp')}
                          {formData.performedPeriod.end && (
                            <> to {format(formData.performedPeriod.end, 'PPpp')} 
                            ({differenceInMinutes(formData.performedPeriod.end, formData.performedPeriod.start)} minutes)</>                          )}
                        </Typography>
                      </Grid>
                    )}
                    
                    {formData.performer.actor && (
                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" color="text.secondary">
                          Performed By
                        </Typography>
                        <Typography variant="body1">
                          {formData.performer.actor}
                          {formData.performer.role && ` (${formData.performer.role})`}
                        </Typography>
                      </Grid>
                    )}
                    
                    {formData.location && (
                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" color="text.secondary">
                          Location
                        </Typography>
                        <Typography variant="body1">
                          {formData.location}
                        </Typography>
                      </Grid>
                    )}
                    
                    {formData.outcome && (
                      <Grid item xs={12}>
                        <Typography variant="subtitle2" color="text.secondary">
                          Outcome
                        </Typography>
                        <Chip
                          icon={<CheckCircleIcon />}
                          label={OUTCOME_OPTIONS.find(o => o.value === formData.outcome)?.label}
                          color={
                            formData.outcome === 'successful' ? 'success' :
                            formData.outcome === 'partially-successful' ? 'warning' :
                            'error'
                          }
                          size="small"
                        />
                      </Grid>
                    )}
                    
                    {formData.complication.hasComplication && (
                      <Grid item xs={12}>
                        <Alert severity="error">
                          <Typography variant="subtitle2">
                            Complication: {formData.complication.type}
                          </Typography>
                          {formData.complication.notes && (
                            <Typography variant="body2" sx={{ mt: 1 }}>
                              {formData.complication.notes}
                            </Typography>
                          )}
                        </Alert>
                      </Grid>
                    )}
                    
                    {formData.followUp && (
                      <Grid item xs={12}>
                        <Typography variant="subtitle2" color="text.secondary">
                          Follow Up Instructions
                        </Typography>
                        <Typography variant="body1">
                          {formData.followUp}
                        </Typography>
                      </Grid>
                    )}
                    
                    {formData.note && (
                      <Grid item xs={12}>
                        <Typography variant="subtitle2" color="text.secondary">
                          Notes
                        </Typography>
                        <Typography variant="body1">
                          {formData.note}
                        </Typography>
                      </Grid>
                    )}
                  </Grid>
                </CardContent>
              </Card>
              
              {errors.submit && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {errors.submit}
                </Alert>
              )}
              
              <Box display="flex" alignItems="center" justifyContent="center">
                <CheckCircleIcon sx={{ mr: 1, color: 'success.main' }} />
                <Typography variant="body2" color="text.secondary">
                  Ready to save procedure record
                </Typography>
              </Box>
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
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center">
            <ProcedureIcon sx={{ mr: 2, color: 'primary.main' }} />
            <Typography variant="h6">
              {procedure ? 'Edit Procedure' : 'Document Procedure'}
            </Typography>
          </Box>
          <IconButton onClick={handleClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Stepper activeStep={activeStep} orientation="vertical">
          <Step>
            <StepLabel
              optional={
                selectedProcedure && (
                  <Typography variant="caption">{selectedProcedure.display}</Typography>
                )
              }
            >
              Select Procedure
            </StepLabel>
            <StepContent>
              {getStepContent(0)}
              <Box sx={{ mt: 2 }}>
                <Button
                  variant="contained"
                  onClick={handleNext}
                  disabled={!selectedProcedure}
                  endIcon={<ProcedureIcon />}
                >
                  Continue
                </Button>
              </Box>
            </StepContent>
          </Step>
          
          <Step>
            <StepLabel>
              Procedure Details
            </StepLabel>
            <StepContent>
              {getStepContent(1)}
              <Box sx={{ mt: 2 }}>
                <Button onClick={handleBack} sx={{ mr: 1 }}>
                  Back
                </Button>
                <Button
                  variant="contained"
                  onClick={handleNext}
                  endIcon={<VerifiedIcon />}
                >
                  Continue
                </Button>
              </Box>
            </StepContent>
          </Step>
          
          <Step>
            <StepLabel>
              Review & Save
            </StepLabel>
            <StepContent>
              {getStepContent(2)}
              <Box sx={{ mt: 2 }}>
                <Button onClick={handleBack} sx={{ mr: 1 }}>
                  Back
                </Button>
                <Button
                  variant="contained"
                  onClick={handleSave}
                  disabled={saving}
                  color="success"
                  endIcon={saving ? <CircularProgress size={20} /> : <CheckCircleIcon />}
                >
                  {saving ? 'Saving...' : 'Save Procedure'}
                </Button>
              </Box>
            </StepContent>
          </Step>
        </Stepper>
      </DialogContent>
    </Dialog>
  );
};

export default ProcedureDialogEnhanced;