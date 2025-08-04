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
  ToggleButton,
  ToggleButtonGroup,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Close as CloseIcon,
  Search as SearchIcon,
  Science as ObservationIcon,
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
  Biotech as LabIcon,
  MonitorHeart as VitalIcon,
  Psychology as SocialIcon,
  MedicalServices as ExamIcon,
  CameraAlt as ImagingIcon,
  LocalPharmacy as PharmacyIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Remove as NormalIcon,
  ArrowUpward as HighIcon,
  ArrowDownward as LowIcon,
  Error as CriticalIcon,
  VerifiedUser as VerifiedIcon,
  Speed as SpeedIcon,
} from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, differenceInMinutes, parseISO } from 'date-fns';
import { debounce } from 'lodash';

import { useFHIRClient } from '../../../../contexts/FHIRContext';
import { useClinical as useClinicalContext } from '../../../../contexts/ClinicalContext';
import { useClinicalWorkflow } from '../../../../contexts/ClinicalWorkflowContext';
import { CLINICAL_EVENTS } from '../../../../constants/clinicalEvents';
import { fhirClient } from '../../../../core/fhir/services/fhirClient';
import cdsClinicalDataService from '../../../../services/cdsClinicalDataService';
import { useDialogSave, useDialogValidation, VALIDATION_RULES } from './utils/dialogHelpers';

const searchObservations = async (query) => {
  try {
    const catalog = await cdsClinicalDataService.getLabCatalog();
    const searchTerm = query.toLowerCase();
    return catalog.filter(item => 
      item.display?.toLowerCase().includes(searchTerm) ||
      item.code?.toLowerCase().includes(searchTerm)
    );
  } catch (error) {
    console.error('Error searching observations:', error);
    return [];
  }
};

// Observation status options
const OBSERVATION_STATUS_OPTIONS = [
  { value: 'registered', label: 'Registered', color: 'default' },
  { value: 'preliminary', label: 'Preliminary', color: 'info' },
  { value: 'final', label: 'Final', color: 'success' },
  { value: 'amended', label: 'Amended', color: 'warning' },
  { value: 'corrected', label: 'Corrected', color: 'warning' },
  { value: 'cancelled', label: 'Cancelled', color: 'error' },
  { value: 'entered-in-error', label: 'Entered in Error', color: 'error' },
  { value: 'unknown', label: 'Unknown', color: 'default' },
];

// Common observation categories
const OBSERVATION_CATEGORIES = [
  { id: 'vital-signs', name: 'Vital Signs', icon: <VitalIcon />, color: 'error' },
  { id: 'laboratory', name: 'Laboratory', icon: <LabIcon />, color: 'primary' },
  { id: 'imaging', name: 'Imaging', icon: <ImagingIcon />, color: 'secondary' },
  { id: 'procedure', name: 'Procedure', icon: <ExamIcon />, color: 'success' },
  { id: 'survey', name: 'Survey', icon: <AssignmentIcon />, color: 'warning' },
  { id: 'exam', name: 'Exam', icon: <ExamIcon />, color: 'info' },
  { id: 'therapy', name: 'Therapy', icon: <PharmacyIcon />, color: 'primary' },
  { id: 'social-history', name: 'Social History', icon: <SocialIcon />, color: 'grey' },
];

// Common vital signs with normal ranges
const VITAL_SIGNS = [
  { 
    code: '8480-6', 
    display: 'Systolic Blood Pressure', 
    unit: 'mmHg',
    normalRange: { low: 90, high: 140 },
    criticalLow: 70,
    criticalHigh: 180
  },
  { 
    code: '8462-4', 
    display: 'Diastolic Blood Pressure', 
    unit: 'mmHg',
    normalRange: { low: 60, high: 90 },
    criticalLow: 40,
    criticalHigh: 120
  },
  { 
    code: '8310-5', 
    display: 'Body Temperature', 
    unit: '°F',
    normalRange: { low: 97.0, high: 99.0 },
    criticalLow: 95.0,
    criticalHigh: 103.0
  },
  { 
    code: '8867-4', 
    display: 'Heart Rate', 
    unit: 'bpm',
    normalRange: { low: 60, high: 100 },
    criticalLow: 40,
    criticalHigh: 150
  },
  { 
    code: '9279-1', 
    display: 'Respiratory Rate', 
    unit: 'breaths/min',
    normalRange: { low: 12, high: 20 },
    criticalLow: 8,
    criticalHigh: 30
  },
  { 
    code: '2708-6', 
    display: 'Oxygen Saturation', 
    unit: '%',
    normalRange: { low: 95, high: 100 },
    criticalLow: 88,
    criticalHigh: null
  },
];

// Interpretation flags
const INTERPRETATION_FLAGS = [
  { value: 'N', label: 'Normal', icon: <NormalIcon />, color: 'success' },
  { value: 'H', label: 'High', icon: <HighIcon />, color: 'warning' },
  { value: 'L', label: 'Low', icon: <LowIcon />, color: 'warning' },
  { value: 'HH', label: 'Critical High', icon: <CriticalIcon />, color: 'error' },
  { value: 'LL', label: 'Critical Low', icon: <CriticalIcon />, color: 'error' },
  { value: 'A', label: 'Abnormal', icon: <WarningIcon />, color: 'warning' },
];

const ObservationDialogEnhanced = ({
  open,
  onClose,
  observation = null,
  onSave,
  patientId,
  encounterId,
  mode = 'record', // 'record', 'edit', 'quick-vitals'
}) => {
  const theme = useTheme();
  const { patient } = useClinicalContext();
  const { publish } = useClinicalWorkflow();
  const fhirClient = useFHIRClient();
  
  // Use consistent dialog helpers
  const { saving: isSaving, error: saveError, handleSave: performSave } = useDialogSave(onSave, null);
  const { errors: validationErrors, validateForm, clearErrors } = useDialogValidation();

  // Dialog state
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({}); // Local UI errors only
  const [alerts, setAlerts] = useState([]);

  // Form state
  const [selectedObservation, setSelectedObservation] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [trendingObservations, setTrendingObservations] = useState([]);
  const [previousValues, setPreviousValues] = useState([]);

  // Quick vitals mode
  const [quickVitalsMode, setQuickVitalsMode] = useState(mode === 'quick-vitals');
  const [vitalsData, setVitalsData] = useState({});

  // Observation details
  const [formData, setFormData] = useState({
    status: 'final',
    category: '',
    effectiveDateTime: new Date(),
    issued: new Date(),
    performer: '',
    value: {
      type: 'Quantity', // Quantity, CodeableConcept, string, boolean, Range
      quantity: {
        value: '',
        unit: '',
        system: 'http://unitsofmeasure.org',
        code: '',
      },
      codeableConcept: null,
      string: '',
      boolean: null,
      range: {
        low: { value: '', unit: '' },
        high: { value: '', unit: '' },
      },
    },
    interpretation: [],
    note: '',
    method: '',
    bodySite: '',
    device: '',
    referenceRange: [
      {
        low: { value: '', unit: '' },
        high: { value: '', unit: '' },
        type: 'normal',
        text: '',
      },
    ],
    component: [], // For multi-component observations like blood pressure
  });

  // Load trending observations on mount
  useEffect(() => {
    if (open && !observation) {
      loadTrendingObservations();
      if (patient) {
        loadPreviousValues();
      }
    }
  }, [open, observation, patient]);

  // Load existing observation data
  useEffect(() => {
    if (observation) {
      // Parse existing observation into form data
      const valueType = observation.valueQuantity ? 'Quantity' :
                       observation.valueCodeableConcept ? 'CodeableConcept' :
                       observation.valueString ? 'string' :
                       observation.valueBoolean !== undefined ? 'boolean' :
                       observation.valueRange ? 'Range' : 'Quantity';
      
      setFormData({
        status: observation.status || 'final',
        category: observation.category?.[0]?.coding?.[0]?.code || '',
        effectiveDateTime: observation.effectiveDateTime ? new Date(observation.effectiveDateTime) : new Date(),
        issued: observation.issued ? new Date(observation.issued) : new Date(),
        performer: observation.performer?.[0]?.display || '',
        value: {
          type: valueType,
          quantity: observation.valueQuantity || { value: '', unit: '', system: 'http://unitsofmeasure.org', code: '' },
          codeableConcept: observation.valueCodeableConcept || null,
          string: observation.valueString || '',
          boolean: observation.valueBoolean,
          range: observation.valueRange || { low: { value: '', unit: '' }, high: { value: '', unit: '' } },
        },
        interpretation: observation.interpretation || [],
        note: observation.note?.[0]?.text || '',
        method: observation.method?.coding?.[0]?.display || '',
        bodySite: observation.bodySite?.coding?.[0]?.display || '',
        device: observation.device?.display || '',
        referenceRange: observation.referenceRange || [{
          low: { value: '', unit: '' },
          high: { value: '', unit: '' },
          type: 'normal',
          text: '',
        }],
        component: observation.component || [],
      });
      setSelectedObservation({
        code: observation.code?.coding?.[0]?.code,
        display: observation.code?.coding?.[0]?.display,
        system: observation.code?.coding?.[0]?.system,
      });
      setActiveStep(1); // Skip to details if editing
    }
  }, [observation]);

  // Load trending observations from recent observations
  const loadTrendingObservations = async () => {
    try {
      const recentObservations = await fhirClient.search('Observation', {
        _count: 100,
        _sort: '-date',
        status: 'final',
      });

      // Count observation usage
      const observationCount = {};
      recentObservations.entry?.forEach(entry => {
        const obs = entry.resource.code?.coding?.[0];
        if (obs) {
          const key = obs.code;
          if (!observationCount[key]) {
            observationCount[key] = {
              ...obs,
              count: 0,
              lastRecorded: entry.resource.effectiveDateTime,
              category: entry.resource.category?.[0]?.coding?.[0]?.code,
            };
          }
          observationCount[key].count++;
        }
      });

      // Sort by frequency and get top 10
      const trending = Object.values(observationCount)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      setTrendingObservations(trending);
    } catch (error) {
      console.error('Error loading trending observations:', error);
    }
  };

  // Load previous values for the selected observation type
  const loadPreviousValues = async () => {
    if (!selectedObservation?.code) return;
    
    try {
      const previousObs = await fhirClient.search('Observation', {
        patient: patientId,
        code: selectedObservation.code,
        _count: 5,
        _sort: '-date',
      });

      const values = previousObs.entry?.map(entry => ({
        date: entry.resource.effectiveDateTime,
        value: entry.resource.valueQuantity?.value || 
               entry.resource.valueString || 
               entry.resource.valueCodeableConcept?.coding?.[0]?.display,
        unit: entry.resource.valueQuantity?.unit,
        interpretation: entry.resource.interpretation?.[0]?.coding?.[0]?.code,
      })) || [];

      setPreviousValues(values);
    } catch (error) {
      console.error('Error loading previous values:', error);
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
        const results = await searchObservations(query);
        setSearchResults(results.slice(0, 10));
      } catch (error) {
        console.error('Error searching observations:', error);
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

  // Handle observation selection
  const handleObservationSelect = (observation) => {
    setSelectedObservation(observation);
    setSearchQuery(observation.display);
    
    // Auto-populate details based on observation type
    autoPopulateDetails(observation);
    
    // Load previous values
    loadPreviousValues();
    
    // Check for abnormal trends
    checkAbnormalTrends(observation);
  };

  // Auto-populate details based on observation type
  const autoPopulateDetails = (observation) => {
    // Find if it's a vital sign
    const vitalSign = VITAL_SIGNS.find(v => v.code === observation.code);
    if (vitalSign) {
      setFormData(prev => ({
        ...prev,
        category: 'vital-signs',
        value: {
          ...prev.value,
          type: 'Quantity',
          quantity: {
            ...prev.value.quantity,
            unit: vitalSign.unit,
            code: vitalSign.unit,
          },
        },
        referenceRange: [{
          low: { value: vitalSign.normalRange.low, unit: vitalSign.unit },
          high: { value: vitalSign.normalRange.high, unit: vitalSign.unit },
          type: 'normal',
          text: `Normal range: ${vitalSign.normalRange.low}-${vitalSign.normalRange.high} ${vitalSign.unit}`,
        }],
      }));
    } else if (observation.system?.includes('loinc')) {
      // Laboratory observation
      setFormData(prev => ({
        ...prev,
        category: 'laboratory',
      }));
    }
  };

  // Check for abnormal trends
  const checkAbnormalTrends = async (observation) => {
    const newAlerts = [];
    
    // Check if this is a critical observation type
    const vitalSign = VITAL_SIGNS.find(v => v.code === observation.code);
    if (vitalSign) {
      newAlerts.push({
        severity: 'info',
        message: `Recording ${vitalSign.display}. Normal range: ${vitalSign.normalRange.low}-${vitalSign.normalRange.high} ${vitalSign.unit}`,
      });
    }
    
    // Check previous values for trends
    if (previousValues.length > 2) {
      const trend = analyzeTrend(previousValues);
      if (trend.direction === 'increasing' && trend.significant) {
        newAlerts.push({
          severity: 'warning',
          message: `This value has been steadily increasing over the last ${previousValues.length} readings`,
        });
      } else if (trend.direction === 'decreasing' && trend.significant) {
        newAlerts.push({
          severity: 'warning',
          message: `This value has been steadily decreasing over the last ${previousValues.length} readings`,
        });
      }
    }
    
    setAlerts(newAlerts);
  };

  // Analyze trend in values
  const analyzeTrend = (values) => {
    if (values.length < 2) return { direction: 'stable', significant: false };
    
    const numericValues = values
      .filter(v => v.value && !isNaN(v.value))
      .map(v => parseFloat(v.value));
    
    if (numericValues.length < 2) return { direction: 'stable', significant: false };
    
    let increasing = 0;
    let decreasing = 0;
    
    for (let i = 1; i < numericValues.length; i++) {
      if (numericValues[i] > numericValues[i - 1]) increasing++;
      else if (numericValues[i] < numericValues[i - 1]) decreasing++;
    }
    
    const direction = increasing > decreasing ? 'increasing' : 
                     decreasing > increasing ? 'decreasing' : 'stable';
    const significant = Math.max(increasing, decreasing) >= numericValues.length * 0.7;
    
    return { direction, significant };
  };

  // Auto-calculate interpretation based on value and reference range
  const autoCalculateInterpretation = () => {
    if (formData.value.type !== 'Quantity' || !formData.value.quantity.value) return;
    
    const value = parseFloat(formData.value.quantity.value);
    const refRange = formData.referenceRange[0];
    
    if (!refRange.low.value && !refRange.high.value) return;
    
    let interpretation = 'N'; // Normal by default
    
    if (refRange.low.value && value < parseFloat(refRange.low.value)) {
      interpretation = 'L';
    } else if (refRange.high.value && value > parseFloat(refRange.high.value)) {
      interpretation = 'H';
    }
    
    // Check for critical values
    const vitalSign = VITAL_SIGNS.find(v => v.code === selectedObservation?.code);
    if (vitalSign) {
      if (vitalSign.criticalLow && value <= vitalSign.criticalLow) {
        interpretation = 'LL';
      } else if (vitalSign.criticalHigh && value >= vitalSign.criticalHigh) {
        interpretation = 'HH';
      }
    }
    
    setFormData(prev => ({
      ...prev,
      interpretation: [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
          code: interpretation,
          display: INTERPRETATION_FLAGS.find(f => f.value === interpretation)?.label,
        }],
      }],
    }));
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
      case 0: // Observation selection
        if (!quickVitalsMode && !selectedObservation) {
          newErrors.observation = 'Please select an observation type';
        }
        break;
        
      case 1: // Observation details
        if (!formData.status) {
          newErrors.status = 'Status is required';
        }
        if (!formData.effectiveDateTime) {
          newErrors.effectiveDateTime = 'Date/time is required';
        }
        if (formData.value.type === 'Quantity' && !formData.value.quantity.value) {
          newErrors.value = 'Value is required';
        }
        break;
        
      case 2: // Review
        // Final validation
        break;
        
      default:
        // No validation for other steps
        break;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Build FHIR Observation resource
  const buildFHIRResource = (obsType = selectedObservation) => {
    const resource = {
      resourceType: 'Observation',
      status: formData.status,
      code: {
        coding: [{
          system: obsType.system || 'http://loinc.org',
          code: obsType.code,
          display: obsType.display,
        }],
      },
      subject: {
        reference: `Patient/${patientId}`,
        display: patient ? `${patient.name?.[0]?.given?.join(' ')} ${patient.name?.[0]?.family}` : undefined,
      },
      effectiveDateTime: formData.effectiveDateTime.toISOString(),
      issued: formData.issued.toISOString(),
    };
    
    // Add encounter reference if provided
    if (encounterId) {
      resource.encounter = {
        reference: `Encounter/${encounterId}`,
      };
    }
    
    // Add category
    if (formData.category) {
      resource.category = [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: formData.category,
          display: OBSERVATION_CATEGORIES.find(c => c.id === formData.category)?.name,
        }],
      }];
    }
    
    // Add value based on type
    switch (formData.value.type) {
      case 'Quantity':
        if (formData.value.quantity.value) {
          resource.valueQuantity = {
            value: parseFloat(formData.value.quantity.value),
            unit: formData.value.quantity.unit,
            system: formData.value.quantity.system,
            code: formData.value.quantity.code || formData.value.quantity.unit,
          };
        }
        break;
      case 'CodeableConcept':
        if (formData.value.codeableConcept) {
          resource.valueCodeableConcept = formData.value.codeableConcept;
        }
        break;
      case 'string':
        if (formData.value.string) {
          resource.valueString = formData.value.string;
        }
        break;
      case 'boolean':
        if (formData.value.boolean !== null) {
          resource.valueBoolean = formData.value.boolean;
        }
        break;
      case 'Range':
        if (formData.value.range.low.value || formData.value.range.high.value) {
          resource.valueRange = {
            low: formData.value.range.low.value ? {
              value: parseFloat(formData.value.range.low.value),
              unit: formData.value.range.low.unit,
            } : undefined,
            high: formData.value.range.high.value ? {
              value: parseFloat(formData.value.range.high.value),
              unit: formData.value.range.high.unit,
            } : undefined,
          };
        }
        break;
      default:
        // No value for other types
        break;
    }
    
    // Add interpretation
    if (formData.interpretation.length > 0) {
      resource.interpretation = formData.interpretation;
    }
    
    // Add performer
    if (formData.performer) {
      resource.performer = [{
        display: formData.performer,
      }];
    }
    
    // Add reference ranges
    if (formData.referenceRange[0].low.value || formData.referenceRange[0].high.value) {
      resource.referenceRange = formData.referenceRange.map(range => ({
        low: range.low.value ? {
          value: parseFloat(range.low.value),
          unit: range.low.unit,
        } : undefined,
        high: range.high.value ? {
          value: parseFloat(range.high.value),
          unit: range.high.unit,
        } : undefined,
        type: range.type ? {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/referencerange-meaning',
            code: range.type,
          }],
        } : undefined,
        text: range.text,
      }));
    }
    
    // Add method
    if (formData.method) {
      resource.method = {
        coding: [{
          display: formData.method,
        }],
      };
    }
    
    // Add body site
    if (formData.bodySite) {
      resource.bodySite = {
        coding: [{
          display: formData.bodySite,
        }],
      };
    }
    
    // Add device
    if (formData.device) {
      resource.device = {
        display: formData.device,
      };
    }
    
    // Add notes
    if (formData.note) {
      resource.note = [{
        text: formData.note,
        time: new Date().toISOString(),
      }];
    }
    
    // Add components (for multi-component observations)
    if (formData.component.length > 0) {
      resource.component = formData.component;
    }
    
    // Preserve existing ID if editing
    if (observation?.id) {
      resource.id = observation.id;
    }
    
    return resource;
  };

  // Handle save
  const handleSave = async () => {
    if (!validateStep(activeStep)) {
      return;
    }
    
    try {
      if (quickVitalsMode) {
        // Save all vital signs
        const promises = Object.entries(vitalsData).map(async ([code, data]) => {
          if (data.value) {
            const vitalSign = VITAL_SIGNS.find(v => v.code === code);
            const obsResource = buildFHIRResource({
              code,
              display: vitalSign.display,
              system: 'http://loinc.org',
            });
            
            // Override with vital-specific data
            obsResource.valueQuantity = {
              value: parseFloat(data.value),
              unit: vitalSign.unit,
              system: 'http://unitsofmeasure.org',
              code: vitalSign.unit,
            };
            
            await onSave(obsResource);
          }
        });
        
        await Promise.all(promises);
        
        // Publish event for vital signs
        await publish(CLINICAL_EVENTS.VITALS_RECORDED, {
          patientId,
          vitals: vitalsData,
          timestamp: new Date().toISOString(),
        });
        
        // Close dialog
        handleClose();
      } else {
        // Save single observation
        const fhirResource = buildFHIRResource();
        
        // Use the consistent save handler
        const success = await performSave(fhirResource, `Observation ${observation ? 'updated' : 'recorded'} successfully`);
        
        if (success) {
          // Publish clinical event
          await publish(CLINICAL_EVENTS.OBSERVATION_RECORDED, {
            patientId,
            observationId: fhirResource.id,
            observation: selectedObservation.display,
            value: fhirResource.valueQuantity || fhirResource.valueString,
            status: formData.status,
            interpretation: formData.interpretation?.[0]?.coding?.[0]?.code,
          });
          
          // Close dialog
          handleClose();
        }
      }
    } catch (error) {
      console.error('Error preparing observation data:', error);
      // The performSave function handles its own error display
    }
  };

  // Handle dialog close
  const handleClose = () => {
    // Reset form
    setActiveStep(0);
    setSelectedObservation(null);
    setSearchQuery('');
    setSearchResults([]);
    setVitalsData({});
    setFormData({
      status: 'final',
      category: '',
      effectiveDateTime: new Date(),
      issued: new Date(),
      performer: '',
      value: {
        type: 'Quantity',
        quantity: {
          value: '',
          unit: '',
          system: 'http://unitsofmeasure.org',
          code: '',
        },
        codeableConcept: null,
        string: '',
        boolean: null,
        range: {
          low: { value: '', unit: '' },
          high: { value: '', unit: '' },
        },
      },
      interpretation: [],
      note: '',
      method: '',
      bodySite: '',
      device: '',
      referenceRange: [
        {
          low: { value: '', unit: '' },
          high: { value: '', unit: '' },
          type: 'normal',
          text: '',
        },
      ],
      component: [],
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
              {/* Quick Vitals Toggle */}
              <Box mb={3}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={quickVitalsMode}
                      onChange={(e) => {
                        setQuickVitalsMode(e.target.checked);
                        if (e.target.checked) {
                          setActiveStep(1); // Skip to entry
                        }
                      }}
                    />
                  }
                  label="Quick Vital Signs Entry"
                />
              </Box>

              {!quickVitalsMode && (
                <>
                  {/* Observation Search */}
                  <Box mb={3}>
                    <Autocomplete
                      freeSolo
                      options={searchResults}
                      getOptionLabel={(option) => option.display || option}
                      value={selectedObservation}
                      onChange={(event, newValue) => {
                        if (typeof newValue === 'object' && newValue !== null) {
                          handleObservationSelect(newValue);
                        }
                      }}
                      inputValue={searchQuery}
                      onInputChange={handleSearchChange}
                      loading={searching}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Search Observations"
                          placeholder="Type observation name or LOINC code..."
                          error={!!errors.observation}
                          helperText={errors.observation}
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
                          <ObservationIcon sx={{ mr: 2, color: 'primary.main' }} />
                          <Box>
                            <Typography variant="body1">{option.display}</Typography>
                            {option.code && (
                              <Typography variant="caption" color="text.secondary">
                                LOINC: {option.code}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      )}
                    />
                  </Box>

                  {/* Observation Categories */}
                  <Box mb={3}>
                    <Typography variant="subtitle2" gutterBottom>
                      Browse by Category
                    </Typography>
                    <Grid container spacing={1}>
                      {OBSERVATION_CATEGORIES.map((category) => (
                        <Grid item key={category.id}>
                          <Chip
                            icon={category.icon}
                            label={category.name}
                            onClick={() => {
                              setSearchQuery(category.name);
                              debouncedSearch(category.name);
                            }}
                            sx={{
                              bgcolor: alpha(theme.palette[category.color]?.main || theme.palette.grey[500], 0.12),
                              color: theme.palette[category.color]?.main || theme.palette.grey[700],
                              '&:hover': {
                                bgcolor: alpha(theme.palette[category.color]?.main || theme.palette.grey[500], 0.2),
                              },
                            }}
                          />
                        </Grid>
                      ))}
                    </Grid>
                  </Box>

                  {/* Common Vital Signs */}
                  <Box mb={3}>
                    <Typography variant="subtitle2" gutterBottom>
                      <SpeedIcon sx={{ fontSize: 16, mr: 1, verticalAlign: 'middle' }} />
                      Quick Select Vital Signs
                    </Typography>
                    <Grid container spacing={1}>
                      {VITAL_SIGNS.map((vital) => (
                        <Grid item key={vital.code} xs={12} sm={6}>
                          <Card 
                            variant="outlined" 
                            sx={{ 
                              cursor: 'pointer',
                              '&:hover': { bgcolor: 'action.hover' }
                            }}
                            onClick={() => handleObservationSelect({
                              code: vital.code,
                              display: vital.display,
                              system: 'http://loinc.org',
                            })}
                          >
                            <CardContent sx={{ py: 1 }}>
                              <Box display="flex" justifyContent="space-between" alignItems="center">
                                <Typography variant="body2">
                                  {vital.display}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {vital.normalRange.low}-{vital.normalRange.high} {vital.unit}
                                </Typography>
                              </Box>
                            </CardContent>
                          </Card>
                        </Grid>
                      ))}
                    </Grid>
                  </Box>

                  {/* Trending Observations */}
                  {trendingObservations.length > 0 && (
                    <Box>
                      <Typography variant="subtitle2" gutterBottom>
                        <TrendingUpIcon sx={{ fontSize: 16, mr: 1, verticalAlign: 'middle' }} />
                        Frequently Recorded
                      </Typography>
                      <Grid container spacing={1}>
                        {trendingObservations.map((obs) => (
                          <Grid item key={obs.code}>
                            <Chip
                              label={`${obs.display} (${obs.count})`}
                              onClick={() => handleObservationSelect(obs)}
                              color="primary"
                              variant="outlined"
                              size="small"
                              icon={OBSERVATION_CATEGORIES.find(c => c.id === obs.category)?.icon}
                            />
                          </Grid>
                        ))}
                      </Grid>
                    </Box>
                  )}
                </>
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
              {quickVitalsMode ? (
                // Quick Vitals Entry
                <Box>
                  <Typography variant="h6" gutterBottom>
                    Enter Vital Signs
                  </Typography>
                  <Grid container spacing={3}>
                    {VITAL_SIGNS.map((vital) => (
                      <Grid item xs={12} sm={6} key={vital.code}>
                        <Paper variant="outlined" sx={{ p: 2 }}>
                          <Typography variant="subtitle2" gutterBottom>
                            {vital.display}
                          </Typography>
                          <TextField
                            fullWidth
                            type="number"
                            value={vitalsData[vital.code]?.value || ''}
                            onChange={(e) => {
                              const value = e.target.value;
                              setVitalsData(prev => ({
                                ...prev,
                                [vital.code]: { value },
                              }));
                              
                              // Auto-calculate interpretation
                              if (value) {
                                const numValue = parseFloat(value);
                                let interpretation = 'N';
                                if (numValue < vital.normalRange.low) {
                                  interpretation = vital.criticalLow && numValue <= vital.criticalLow ? 'LL' : 'L';
                                } else if (numValue > vital.normalRange.high) {
                                  interpretation = vital.criticalHigh && numValue >= vital.criticalHigh ? 'HH' : 'H';
                                }
                                setVitalsData(prev => ({
                                  ...prev,
                                  [vital.code]: { ...prev[vital.code], interpretation },
                                }));
                              }
                            }}
                            InputProps={{
                              endAdornment: (
                                <InputAdornment position="end">
                                  {vital.unit}
                                </InputAdornment>
                              ),
                            }}
                            helperText={`Normal: ${vital.normalRange.low}-${vital.normalRange.high}`}
                          />
                          {vitalsData[vital.code]?.interpretation && vitalsData[vital.code].interpretation !== 'N' && (
                            <Chip
                              size="small"
                              label={INTERPRETATION_FLAGS.find(f => f.value === vitalsData[vital.code].interpretation)?.label}
                              color={vitalsData[vital.code].interpretation.includes('H') ? 'error' : 'warning'}
                              icon={INTERPRETATION_FLAGS.find(f => f.value === vitalsData[vital.code].interpretation)?.icon}
                              sx={{ mt: 1 }}
                            />
                          )}
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              ) : (
                // Regular Observation Entry
                <Grid container spacing={3}>
                  {/* Observation Status */}
                  <Grid item xs={12}>
                    <FormControl component="fieldset">
                      <Typography variant="subtitle2" gutterBottom>
                        Observation Status
                      </Typography>
                      <RadioGroup
                        row
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      >
                        {OBSERVATION_STATUS_OPTIONS.map((option) => (
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
                  </Grid>

                  {/* Effective Date/Time */}
                  <Grid item xs={12} md={6}>
                    <LocalizationProvider dateAdapter={AdapterDateFns}>
                      <DateTimePicker
                        label="Observation Date/Time"
                        value={formData.effectiveDateTime}
                        onChange={(date) => setFormData({ ...formData, effectiveDateTime: date })}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            fullWidth
                            error={!!errors.effectiveDateTime}
                            helperText={errors.effectiveDateTime}
                            InputProps={{
                              ...params.InputProps,
                              startAdornment: (
                                <InputAdornment position="start">
                                  <EventIcon />
                                </InputAdornment>
                              ),
                            }}
                          />
                        )}
                        maxDate={new Date()}
                      />
                    </LocalizationProvider>
                  </Grid>

                  {/* Category */}
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth>
                      <InputLabel>Category</InputLabel>
                      <Select
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        label="Category"
                      >
                        {OBSERVATION_CATEGORIES.map((cat) => (
                          <MenuItem key={cat.id} value={cat.id}>
                            <Box display="flex" alignItems="center">
                              {cat.icon}
                              <Typography sx={{ ml: 1 }}>{cat.name}</Typography>
                            </Box>
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  {/* Value Type Selection */}
                  <Grid item xs={12}>
                    <ToggleButtonGroup
                      value={formData.value.type}
                      exclusive
                      onChange={(e, newType) => {
                        if (newType) {
                          setFormData({ ...formData, value: { ...formData.value, type: newType } });
                        }
                      }}
                      size="small"
                    >
                      <ToggleButton value="Quantity">Numeric</ToggleButton>
                      <ToggleButton value="CodeableConcept">Coded</ToggleButton>
                      <ToggleButton value="string">Text</ToggleButton>
                      <ToggleButton value="boolean">Yes/No</ToggleButton>
                      <ToggleButton value="Range">Range</ToggleButton>
                    </ToggleButtonGroup>
                  </Grid>

                  {/* Value Entry based on Type */}
                  {formData.value.type === 'Quantity' && (
                    <>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="Value"
                          type="number"
                          value={formData.value.quantity.value}
                          onChange={(e) => {
                            setFormData({
                              ...formData,
                              value: {
                                ...formData.value,
                                quantity: { ...formData.value.quantity, value: e.target.value },
                              },
                            });
                            // Auto-calculate interpretation when value changes
                            setTimeout(autoCalculateInterpretation, 100);
                          }}
                          error={!!errors.value}
                          helperText={errors.value}
                          InputProps={{
                            endAdornment: formData.value.quantity.unit && (
                              <InputAdornment position="end">
                                {formData.value.quantity.unit}
                              </InputAdornment>
                            ),
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="Unit"
                          value={formData.value.quantity.unit}
                          onChange={(e) => setFormData({
                            ...formData,
                            value: {
                              ...formData.value,
                              quantity: { ...formData.value.quantity, unit: e.target.value },
                            },
                          })}
                        />
                      </Grid>
                    </>
                  )}

                  {formData.value.type === 'string' && (
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Text Value"
                        multiline
                        rows={2}
                        value={formData.value.string}
                        onChange={(e) => setFormData({
                          ...formData,
                          value: { ...formData.value, string: e.target.value },
                        })}
                      />
                    </Grid>
                  )}

                  {formData.value.type === 'boolean' && (
                    <Grid item xs={12}>
                      <FormControl component="fieldset">
                        <FormLabel component="legend">Result</FormLabel>
                        <RadioGroup
                          row
                          value={formData.value.boolean === null ? '' : formData.value.boolean.toString()}
                          onChange={(e) => setFormData({
                            ...formData,
                            value: { ...formData.value, boolean: e.target.value === 'true' },
                          })}
                        >
                          <FormControlLabel value="true" control={<Radio />} label="Yes" />
                          <FormControlLabel value="false" control={<Radio />} label="No" />
                        </RadioGroup>
                      </FormControl>
                    </Grid>
                  )}

                  {/* Interpretation */}
                  {formData.interpretation.length > 0 && (
                    <Grid item xs={12}>
                      <Box>
                        <Typography variant="subtitle2" gutterBottom>
                          Interpretation
                        </Typography>
                        <Chip
                          icon={INTERPRETATION_FLAGS.find(f => f.value === formData.interpretation[0]?.coding?.[0]?.code)?.icon}
                          label={INTERPRETATION_FLAGS.find(f => f.value === formData.interpretation[0]?.coding?.[0]?.code)?.label}
                          color={INTERPRETATION_FLAGS.find(f => f.value === formData.interpretation[0]?.coding?.[0]?.code)?.color}
                        />
                      </Box>
                    </Grid>
                  )}

                  {/* Reference Range */}
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" gutterBottom>
                      Reference Range
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <TextField
                          fullWidth
                          label="Low"
                          type="number"
                          size="small"
                          value={formData.referenceRange[0].low.value}
                          onChange={(e) => {
                            const newRange = [...formData.referenceRange];
                            newRange[0].low.value = e.target.value;
                            setFormData({ ...formData, referenceRange: newRange });
                            setTimeout(autoCalculateInterpretation, 100);
                          }}
                          InputProps={{
                            endAdornment: formData.value.quantity.unit && (
                              <InputAdornment position="end">
                                {formData.value.quantity.unit}
                              </InputAdornment>
                            ),
                          }}
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <TextField
                          fullWidth
                          label="High"
                          type="number"
                          size="small"
                          value={formData.referenceRange[0].high.value}
                          onChange={(e) => {
                            const newRange = [...formData.referenceRange];
                            newRange[0].high.value = e.target.value;
                            setFormData({ ...formData, referenceRange: newRange });
                            setTimeout(autoCalculateInterpretation, 100);
                          }}
                          InputProps={{
                            endAdornment: formData.value.quantity.unit && (
                              <InputAdornment position="end">
                                {formData.value.quantity.unit}
                              </InputAdornment>
                            ),
                          }}
                        />
                      </Grid>
                    </Grid>
                  </Grid>

                  {/* Previous Values */}
                  {previousValues.length > 0 && (
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" gutterBottom>
                        Previous Values
                      </Typography>
                      <List dense>
                        {previousValues.map((prev, index) => (
                          <ListItem key={index}>
                            <ListItemText
                              primary={`${prev.value} ${prev.unit || ''}`}
                              secondary={format(parseISO(prev.date), 'PPp')}
                            />
                            {prev.interpretation && (
                              <ListItemSecondaryAction>
                                <Chip
                                  size="small"
                                  icon={INTERPRETATION_FLAGS.find(f => f.value === prev.interpretation)?.icon}
                                  label={prev.interpretation}
                                  color={prev.interpretation.includes('H') ? 'error' : 'warning'}
                                />
                              </ListItemSecondaryAction>
                            )}
                          </ListItem>
                        ))}
                      </List>
                    </Grid>
                  )}

                  {/* Performer */}
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Performed By"
                      value={formData.performer}
                      onChange={(e) => setFormData({ ...formData, performer: e.target.value })}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <PersonIcon />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>

                  {/* Method */}
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Method"
                      value={formData.method}
                      onChange={(e) => setFormData({ ...formData, method: e.target.value })}
                      placeholder="e.g., Automated analyzer"
                    />
                  </Grid>

                  {/* Notes */}
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      multiline
                      rows={3}
                      label="Notes"
                      value={formData.note}
                      onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <DescriptionIcon />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                </Grid>
              )}
            </Box>
          </Fade>
        );

      case 2:
        return (
          <Fade in={true}>
            <Box>
              <Typography variant="h6" gutterBottom>
                Review Observation{quickVitalsMode ? 's' : ''}
              </Typography>
              
              {quickVitalsMode ? (
                // Review multiple vital signs
                <Grid container spacing={2}>
                  {Object.entries(vitalsData).filter(([_, data]) => data.value).map(([code, data]) => {
                    const vital = VITAL_SIGNS.find(v => v.code === code);
                    return (
                      <Grid item xs={12} sm={6} key={code}>
                        <Card variant="outlined">
                          <CardContent>
                            <Typography variant="subtitle2" color="text.secondary">
                              {vital.display}
                            </Typography>
                            <Box display="flex" alignItems="center" gap={1}>
                              <Typography variant="h6">
                                {data.value} {vital.unit}
                              </Typography>
                              {data.interpretation && data.interpretation !== 'N' && (
                                <Chip
                                  size="small"
                                  icon={INTERPRETATION_FLAGS.find(f => f.value === data.interpretation)?.icon}
                                  label={INTERPRETATION_FLAGS.find(f => f.value === data.interpretation)?.label}
                                  color={data.interpretation.includes('H') ? 'error' : 'warning'}
                                />
                              )}
                            </Box>
                            <Typography variant="caption" color="text.secondary">
                              Normal: {vital.normalRange.low}-{vital.normalRange.high} {vital.unit}
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                    );
                  })}
                </Grid>
              ) : (
                // Review single observation
                <Card variant="outlined" sx={{ mb: 3 }}>
                  <CardContent>
                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        <Box display="flex" alignItems="center" mb={2}>
                          <ObservationIcon sx={{ mr: 2, color: 'primary.main', fontSize: 32 }} />
                          <Box>
                            <Typography variant="h6">
                              {selectedObservation?.display}
                            </Typography>
                            {selectedObservation?.code && (
                              <Typography variant="caption" color="text.secondary">
                                LOINC: {selectedObservation.code}
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
                          label={OBSERVATION_STATUS_OPTIONS.find(opt => opt.value === formData.status)?.label}
                          color={OBSERVATION_STATUS_OPTIONS.find(opt => opt.value === formData.status)?.color}
                          size="small"
                        />
                      </Grid>
                      
                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" color="text.secondary">
                          Date/Time
                        </Typography>
                        <Typography variant="body1">
                          {format(formData.effectiveDateTime, 'PPpp')}
                        </Typography>
                      </Grid>
                      
                      <Grid item xs={12}>
                        <Typography variant="subtitle2" color="text.secondary">
                          Value
                        </Typography>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="h5">
                            {formData.value.type === 'Quantity' && `${formData.value.quantity.value} ${formData.value.quantity.unit}`}
                            {formData.value.type === 'string' && formData.value.string}
                            {formData.value.type === 'boolean' && (formData.value.boolean ? 'Yes' : 'No')}
                          </Typography>
                          {formData.interpretation.length > 0 && (
                            <Chip
                              icon={INTERPRETATION_FLAGS.find(f => f.value === formData.interpretation[0]?.coding?.[0]?.code)?.icon}
                              label={INTERPRETATION_FLAGS.find(f => f.value === formData.interpretation[0]?.coding?.[0]?.code)?.label}
                              color={INTERPRETATION_FLAGS.find(f => f.value === formData.interpretation[0]?.coding?.[0]?.code)?.color}
                            />
                          )}
                        </Box>
                        {formData.referenceRange[0].low.value || formData.referenceRange[0].high.value ? (
                          <Typography variant="caption" color="text.secondary">
                            Reference: {formData.referenceRange[0].low.value}-{formData.referenceRange[0].high.value} {formData.value.quantity.unit}
                          </Typography>
                        ) : null}
                      </Grid>
                      
                      {formData.performer && (
                        <Grid item xs={12} md={6}>
                          <Typography variant="subtitle2" color="text.secondary">
                            Performed By
                          </Typography>
                          <Typography variant="body1">
                            {formData.performer}
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
              )}
              
              {(errors.submit || saveError) && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {errors.submit || saveError}
                </Alert>
              )}
              
              <Box display="flex" alignItems="center" justifyContent="center">
                <CheckCircleIcon sx={{ mr: 1, color: 'success.main' }} />
                <Typography variant="body2" color="text.secondary">
                  Ready to save observation{quickVitalsMode ? 's' : ''}
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
            <ObservationIcon sx={{ mr: 2, color: 'primary.main' }} />
            <Typography variant="h6">
              {observation ? 'Edit Observation' : 'Record Observation'}
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
                selectedObservation && (
                  <Typography variant="caption">{selectedObservation.display}</Typography>
                )
              }
            >
              {quickVitalsMode ? 'Quick Vitals Mode' : 'Select Observation'}
            </StepLabel>
            <StepContent>
              {getStepContent(0)}
              <Box sx={{ mt: 2 }}>
                <Button
                  variant="contained"
                  onClick={handleNext}
                  disabled={!quickVitalsMode && !selectedObservation}
                  endIcon={<ObservationIcon />}
                >
                  Continue
                </Button>
              </Box>
            </StepContent>
          </Step>
          
          <Step>
            <StepLabel>
              Enter Values
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
                  disabled={isSaving}
                  color="success"
                  endIcon={isSaving ? <CircularProgress size={20} /> : <CheckCircleIcon />}
                >
                  {isSaving ? 'Saving...' : 'Save Observation'}
                </Button>
              </Box>
            </StepContent>
          </Step>
        </Stepper>
      </DialogContent>
    </Dialog>
  );
};

export default ObservationDialogEnhanced;