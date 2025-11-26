// Enhanced Immunization Dialog
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
  InputAdornment,
  Radio,
  RadioGroup,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Close as CloseIcon,
  Search as SearchIcon,
  LocalHospital as VaccineIcon,
  Event as EventIcon,
  LocationOn as LocationIcon,
  Person as PersonIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Info as InfoIcon,
  Schedule as ScheduleIcon,
  Description as DescriptionIcon,
  Vaccines as VaccinesIcon,
  VerifiedUser as VerifiedIcon,
  TrendingUp as TrendingUpIcon,
  LocalPharmacy as PharmacyIcon,
  Assignment as AssignmentIcon,
  CalendarToday as CalendarIcon,
  ChildCare as ChildCareIcon,
  Elderly as ElderlyIcon,
  PregnantWoman as PregnantWomanIcon,
  Shield as ShieldIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, differenceInDays, addDays, isAfter, isBefore } from 'date-fns';
import { debounce } from 'lodash';

import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import { useClinical as useClinicalContext } from '../../../../contexts/ClinicalContext';
import { useClinicalWorkflow } from '../../../../contexts/ClinicalWorkflowContext';
import { CLINICAL_EVENTS } from '../../../../constants/clinicalEvents';
import { fhirClient } from '../../../../core/fhir/services/fhirClient';
import cdsClinicalDataService from '../../../../services/cdsClinicalDataService';
import { useDialogSave, useDialogValidation, VALIDATION_RULES } from './utils/dialogHelpers';

const searchImmunizations = async (query) => {
  try {
    // Search for immunizations from existing resources
    const searchParams = {
      _count: 100,
      _sort: '-date'
    };
    
    if (query) {
      searchParams._text = query;
    }
    
    const bundle = await fhirClient.search('Immunization', searchParams);
    const immunizations = bundle.entry?.map(entry => entry.resource) || [];
    
    // Extract unique vaccine codes
    const vaccineMap = new Map();
    
    immunizations.forEach(immunization => {
      if (immunization.vaccineCode?.coding) {
        immunization.vaccineCode.coding.forEach(coding => {
          const key = coding.code || coding.display;
          if (key && !vaccineMap.has(key)) {
            vaccineMap.set(key, {
              code: coding.code,
              display: coding.display || immunization.vaccineCode.text || 'Unknown Vaccine',
              system: coding.system
            });
          }
        });
      }
    });
    
    // Add common vaccines if search is empty or general
    if (!query || query.length < 3) {
      const commonVaccines = [
        { code: '207', display: 'COVID-19, mRNA, LNP-S, PF, 100 mcg/0.5mL dose', system: 'http://hl7.org/fhir/sid/cvx' },
        { code: '208', display: 'COVID-19, mRNA, LNP-S, PF, 30 mcg/0.3mL dose', system: 'http://hl7.org/fhir/sid/cvx' },
        { code: '141', display: 'Influenza, seasonal, injectable', system: 'http://hl7.org/fhir/sid/cvx' },
        { code: '140', display: 'Influenza, seasonal, injectable, preservative free', system: 'http://hl7.org/fhir/sid/cvx' },
        { code: '115', display: 'Tdap', system: 'http://hl7.org/fhir/sid/cvx' },
        { code: '110', display: 'DTaP-Hep B-IPV', system: 'http://hl7.org/fhir/sid/cvx' },
        { code: '120', display: 'DTaP-Hib-IPV', system: 'http://hl7.org/fhir/sid/cvx' },
        { code: '83', display: 'Hep A, ped/adol, 2 dose', system: 'http://hl7.org/fhir/sid/cvx' },
        { code: '133', display: 'Pneumococcal conjugate PCV 13', system: 'http://hl7.org/fhir/sid/cvx' },
        { code: '33', display: 'Pneumococcal polysaccharide PPV23', system: 'http://hl7.org/fhir/sid/cvx' },
        { code: '03', display: 'MMR', system: 'http://hl7.org/fhir/sid/cvx' },
        { code: '119', display: 'Rotavirus, monovalent', system: 'http://hl7.org/fhir/sid/cvx' },
        { code: '116', display: 'Rotavirus, pentavalent', system: 'http://hl7.org/fhir/sid/cvx' },
        { code: '21', display: 'Varicella', system: 'http://hl7.org/fhir/sid/cvx' },
        { code: '121', display: 'Zoster', system: 'http://hl7.org/fhir/sid/cvx' },
        { code: '187', display: 'Zoster recombinant', system: 'http://hl7.org/fhir/sid/cvx' },
        { code: '62', display: 'HPV, quadrivalent', system: 'http://hl7.org/fhir/sid/cvx' },
        { code: '165', display: 'HPV, 9-valent', system: 'http://hl7.org/fhir/sid/cvx' },
        { code: '88', display: 'Influenza, NOS', system: 'http://hl7.org/fhir/sid/cvx' },
        { code: '113', display: 'Td (adult)', system: 'http://hl7.org/fhir/sid/cvx' }
      ];
      
      commonVaccines.forEach(vaccine => {
        if (!vaccineMap.has(vaccine.code)) {
          vaccineMap.set(vaccine.code, vaccine);
        }
      });
    }
    
    // Convert to array and filter by query if provided
    let results = Array.from(vaccineMap.values());
    
    if (query) {
      const searchTerm = query.toLowerCase();
      results = results.filter(item => 
        item.display?.toLowerCase().includes(searchTerm) ||
        item.code?.toLowerCase().includes(searchTerm)
      );
    }
    
    return results.slice(0, 20); // Limit results
  } catch (error) {
    console.error('Error searching immunizations:', error);
    return [];
  }
};

// Vaccine status options
const VACCINE_STATUS_OPTIONS = [
  { value: 'completed', label: 'Completed', color: 'success' },
  { value: 'entered-in-error', label: 'Entered in Error', color: 'error' },
  { value: 'not-done', label: 'Not Done', color: 'warning' },
];

// Common vaccine categories
const VACCINE_CATEGORIES = [
  { id: 'routine', name: 'Routine', icon: <ChildCareIcon />, color: 'success' },
  { id: 'flu', name: 'Influenza', icon: <VaccinesIcon />, color: 'primary' },
  { id: 'covid', name: 'COVID-19', icon: <ShieldIcon />, color: 'secondary' },
  { id: 'travel', name: 'Travel', icon: <LocationIcon />, color: 'warning' },
  { id: 'occupational', name: 'Occupational', icon: <PersonIcon />, color: 'info' },
  { id: 'pregnancy', name: 'Pregnancy', icon: <PregnantWomanIcon />, color: 'error' },
];

// Common reaction types
const REACTION_TYPES = [
  { value: 'soreness', label: 'Injection Site Soreness' },
  { value: 'redness', label: 'Injection Site Redness' },
  { value: 'swelling', label: 'Injection Site Swelling' },
  { value: 'fever', label: 'Fever' },
  { value: 'fatigue', label: 'Fatigue' },
  { value: 'headache', label: 'Headache' },
  { value: 'nausea', label: 'Nausea' },
  { value: 'rash', label: 'Rash' },
  { value: 'allergic', label: 'Allergic Reaction' },
  { value: 'anaphylaxis', label: 'Anaphylaxis', severity: 'high' },
];

const ImmunizationDialogEnhanced = ({
  open,
  onClose,
  immunization = null,
  onSave,
  patientId,
  encounterId,
  mode = 'administer', // 'administer', 'edit', 'history'
}) => {
  const theme = useTheme();
  const { patient } = useClinicalContext();
  const { publish } = useClinicalWorkflow();
  const { resources } = useFHIRResource();
  
  // Use consistent dialog helpers
  const { saving: isSaving, error: saveError, handleSave: performSave } = useDialogSave(onSave, null);
  const { errors: validationErrors, validateForm, clearErrors } = useDialogValidation();

  // Dialog state
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({}); // Local UI errors only
  const [alerts, setAlerts] = useState([]);

  // Form state
  const [selectedVaccine, setSelectedVaccine] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [trendingVaccines, setTrendingVaccines] = useState([]);
  const [vaccineSchedule, setVaccineSchedule] = useState([]);

  // Immunization details
  const [formData, setFormData] = useState({
    status: 'completed',
    occurrence: new Date(),
    lotNumber: '',
    expirationDate: null,
    site: '',
    route: '',
    doseQuantity: '',
    performer: '',
    location: '',
    note: '',
    reasonCode: '',
    reasonNotGiven: '',
    reaction: {
      hasReaction: false,
      type: '',
      severity: 'mild',
      date: new Date(),
      notes: '',
    },
    protocolApplied: {
      series: '',
      doseNumber: 1,
      seriesDoses: 1,
    },
  });

  // Load trending vaccines on mount
  useEffect(() => {
    if (open && !immunization) {
      loadTrendingVaccines();
      loadVaccineSchedule();
    }
  }, [open, immunization]);

  // Load existing immunization data
  useEffect(() => {
    if (immunization) {
      // Parse existing immunization into form data
      setFormData({
        status: immunization.status || 'completed',
        occurrence: immunization.occurrenceDateTime ? new Date(immunization.occurrenceDateTime) : new Date(),
        lotNumber: immunization.lotNumber || '',
        expirationDate: immunization.expirationDate ? new Date(immunization.expirationDate) : null,
        site: immunization.site?.coding?.[0]?.code || '',
        route: immunization.route?.coding?.[0]?.code || '',
        doseQuantity: immunization.doseQuantity?.value || '',
        performer: immunization.performer?.[0]?.actor?.display || '',
        location: immunization.location?.display || '',
        note: immunization.note?.[0]?.text || '',
        reasonCode: immunization.reasonCode?.[0]?.coding?.[0]?.code || '',
        reasonNotGiven: immunization.statusReason?.coding?.[0]?.code || '',
        reaction: {
          hasReaction: !!immunization.reaction?.length,
          type: immunization.reaction?.[0]?.detail?.coding?.[0]?.code || '',
          severity: immunization.reaction?.[0]?.severity || 'mild',
          date: immunization.reaction?.[0]?.date ? new Date(immunization.reaction[0].date) : new Date(),
          notes: immunization.reaction?.[0]?.detail?.text || '',
        },
        protocolApplied: {
          series: immunization.protocolApplied?.[0]?.series || '',
          doseNumber: immunization.protocolApplied?.[0]?.doseNumberPositiveInt || 1,
          seriesDoses: immunization.protocolApplied?.[0]?.seriesDosesPositiveInt || 1,
        },
      });
      setSelectedVaccine({
        code: immunization.vaccineCode?.coding?.[0]?.code,
        display: immunization.vaccineCode?.coding?.[0]?.display,
        system: immunization.vaccineCode?.coding?.[0]?.system,
      });
      setActiveStep(1); // Skip to details if editing
    }
  }, [immunization]);

  // Load trending vaccines from recent immunizations
  const loadTrendingVaccines = async () => {
    try {
      const recentImmunizations = await fhirClient.search('Immunization', {
        _count: 100,
        _sort: '-date',
      });

      // Count vaccine usage
      const vaccineCount = {};
      recentImmunizations.entry?.forEach(entry => {
        const vaccine = entry.resource.vaccineCode?.coding?.[0];
        if (vaccine) {
          const key = vaccine.code;
          if (!vaccineCount[key]) {
            vaccineCount[key] = {
              ...vaccine,
              count: 0,
              lastUsed: entry.resource.occurrenceDateTime,
            };
          }
          vaccineCount[key].count++;
        }
      });

      // Sort by frequency and get top 10
      const trending = Object.values(vaccineCount)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      setTrendingVaccines(trending);
    } catch (error) {
      console.error('Error loading trending vaccines:', error);
    }
  };

  // Load recommended vaccine schedule based on patient age
  const loadVaccineSchedule = async () => {
    try {
      // Calculate patient age
      const birthDate = new Date(patient.birthDate);
      const ageInYears = differenceInDays(new Date(), birthDate) / 365.25;
      
      // Get immunization history
      const immunizationHistory = await fhirClient.search('Immunization', {
        patient: patientId,
        _sort: '-date',
      });

      // Simple schedule recommendations based on age
      const schedule = [];
      
      if (ageInYears >= 65) {
        schedule.push({
          vaccine: 'Influenza',
          status: 'due',
          dueDate: new Date(new Date().getFullYear(), 9, 1), // October 1st
          priority: 'high',
        });
        schedule.push({
          vaccine: 'Pneumococcal',
          status: 'due',
          priority: 'high',
        });
      }
      
      // COVID-19 booster for all adults
      if (ageInYears >= 18) {
        schedule.push({
          vaccine: 'COVID-19 Booster',
          status: 'recommended',
          priority: 'medium',
        });
      }
      
      // Tdap every 10 years
      schedule.push({
        vaccine: 'Tdap',
        status: 'check_history',
        interval: '10 years',
        priority: 'medium',
      });

      setVaccineSchedule(schedule);
    } catch (error) {
      console.error('Error loading vaccine schedule:', error);
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
        const results = await searchImmunizations(query);
        setSearchResults(results.slice(0, 10));
      } catch (error) {
        console.error('Error searching vaccines:', error);
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

  // Handle vaccine selection
  const handleVaccineSelect = (vaccine) => {
    setSelectedVaccine(vaccine);
    setSearchQuery(vaccine.display);
    
    // Check for contraindications
    checkContraindications(vaccine);
  };

  // Check for contraindications based on patient data
  const checkContraindications = async (vaccine) => {
    const newAlerts = [];
    
    // Check allergies
    try {
      const allergies = await fhirClient.search('AllergyIntolerance', {
        patient: patientId,
        clinical_status: 'active',
      });
      
      allergies.entry?.forEach(entry => {
        const allergy = entry.resource;
        // Simple check - in real system would use proper terminology matching
        if (vaccine.display?.toLowerCase().includes('egg') && 
            allergy.code?.coding?.some(c => c.display?.toLowerCase().includes('egg'))) {
          newAlerts.push({
            severity: 'warning',
            message: `Patient has egg allergy - some vaccines are contraindicated`,
          });
        }
      });
    } catch (error) {
      console.error('Error checking allergies:', error);
    }
    
    // Check pregnancy status for live vaccines
    if (patient.gender === 'female') {
      // In real system, would check for active pregnancy condition
      if (vaccine.display?.toLowerCase().includes('mmr') || 
          vaccine.display?.toLowerCase().includes('varicella')) {
        newAlerts.push({
          severity: 'info',
          message: 'Live vaccines are contraindicated during pregnancy',
        });
      }
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
      case 0: // Vaccine selection
        if (!selectedVaccine) {
          newErrors.vaccine = 'Please select a vaccine';
        }
        break;
        
      case 1: // Administration details
        if (!formData.occurrence) {
          newErrors.occurrence = 'Administration date is required';
        }
        if (formData.status === 'not-done' && !formData.reasonNotGiven) {
          newErrors.reasonNotGiven = 'Please provide reason vaccine was not given';
        }
        if (formData.lotNumber && !formData.expirationDate) {
          newErrors.expirationDate = 'Expiration date required when lot number is provided';
        }
        break;
        
      case 2: // Review
        // Final validation
        break;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Build FHIR Immunization resource
  const buildFHIRResource = () => {
    const resource = {
      resourceType: 'Immunization',
      status: formData.status,
      vaccineCode: {
        coding: [{
          system: selectedVaccine.system || 'http://hl7.org/fhir/sid/cvx',
          code: selectedVaccine.code,
          display: selectedVaccine.display,
        }],
      },
      patient: {
        reference: `Patient/${patientId}`,
        display: patient ? `${patient.name?.[0]?.given?.join(' ')} ${patient.name?.[0]?.family}` : undefined,
      },
      occurrenceDateTime: formData.occurrence.toISOString(),
      recorded: new Date().toISOString(),
    };
    
    // Add encounter reference if provided
    if (encounterId) {
      resource.encounter = {
        reference: `Encounter/${encounterId}`,
      };
    }
    
    // Add lot number and expiration
    if (formData.lotNumber) {
      resource.lotNumber = formData.lotNumber;
    }
    if (formData.expirationDate) {
      resource.expirationDate = formData.expirationDate.toISOString().split('T')[0];
    }
    
    // Add administration details
    if (formData.site) {
      resource.site = {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v3-ActSite',
          code: formData.site,
        }],
      };
    }
    if (formData.route) {
      resource.route = {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v3-RouteOfAdministration',
          code: formData.route,
        }],
      };
    }
    if (formData.doseQuantity) {
      resource.doseQuantity = {
        value: parseFloat(formData.doseQuantity),
        unit: 'mL',
        system: 'http://unitsofmeasure.org',
        code: 'mL',
      };
    }
    
    // Add performer
    if (formData.performer) {
      resource.performer = [{
        actor: {
          display: formData.performer,
        },
      }];
    }
    
    // Add location
    if (formData.location) {
      resource.location = {
        display: formData.location,
      };
    }
    
    // Add reason codes
    if (formData.reasonCode) {
      resource.reasonCode = [{
        coding: [{
          system: 'http://snomed.info/sct',
          code: formData.reasonCode,
        }],
      }];
    }
    
    // Add reason not given
    if (formData.status === 'not-done' && formData.reasonNotGiven) {
      resource.statusReason = {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v3-ActReason',
          code: formData.reasonNotGiven,
        }],
      };
    }
    
    // Add reaction if present
    if (formData.reaction.hasReaction) {
      resource.reaction = [{
        date: formData.reaction.date.toISOString().split('T')[0],
        detail: {
          coding: [{
            system: 'http://snomed.info/sct',
            code: formData.reaction.type,
          }],
          text: formData.reaction.notes,
        },
        severity: formData.reaction.severity,
      }];
    }
    
    // Add protocol applied
    if (formData.protocolApplied.series || formData.protocolApplied.doseNumber > 1) {
      resource.protocolApplied = [{
        series: formData.protocolApplied.series,
        doseNumberPositiveInt: formData.protocolApplied.doseNumber,
        seriesDosesPositiveInt: formData.protocolApplied.seriesDoses,
      }];
    }
    
    // Add notes
    if (formData.note) {
      resource.note = [{
        text: formData.note,
        time: new Date().toISOString(),
      }];
    }
    
    // Preserve existing ID if editing
    if (immunization?.id) {
      resource.id = immunization.id;
    }
    
    return resource;
  };

  // Handle save
  const handleSave = async () => {
    if (!validateStep(activeStep)) {
      return;
    }
    
    try {
      const fhirResource = buildFHIRResource();
      
      // Use the consistent save handler
      const success = await performSave(fhirResource, `Immunization ${immunization ? 'updated' : 'recorded'} successfully`);
      
      if (success) {
        // Publish clinical event
        await publish(CLINICAL_EVENTS.IMMUNIZATION_ADMINISTERED, {
          patientId,
          immunizationId: fhirResource.id,
          vaccine: selectedVaccine.display,
          status: formData.status,
        });
        
        // Close dialog
        handleClose();
      }
    } catch (error) {
      console.error('Error preparing immunization data:', error);
      // The performSave function handles its own error display
    }
  };

  // Handle dialog close
  const handleClose = () => {
    // Reset form
    setActiveStep(0);
    setSelectedVaccine(null);
    setSearchQuery('');
    setSearchResults([]);
    setFormData({
      status: 'completed',
      occurrence: new Date(),
      lotNumber: '',
      expirationDate: null,
      site: '',
      route: '',
      doseQuantity: '',
      performer: '',
      location: '',
      note: '',
      reasonCode: '',
      reasonNotGiven: '',
      reaction: {
        hasReaction: false,
        type: '',
        severity: 'mild',
        date: new Date(),
        notes: '',
      },
      protocolApplied: {
        series: '',
        doseNumber: 1,
        seriesDoses: 1,
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
              {/* Vaccine Search */}
              <Box mb={3}>
                <Autocomplete
                  freeSolo
                  options={searchResults}
                  getOptionLabel={(option) => option.display || option}
                  value={selectedVaccine}
                  onChange={(event, newValue) => {
                    if (typeof newValue === 'object' && newValue !== null) {
                      handleVaccineSelect(newValue);
                    }
                  }}
                  inputValue={searchQuery}
                  onInputChange={handleSearchChange}
                  loading={searching}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Search Vaccines"
                      placeholder="Type vaccine name or CVX code..."
                      error={!!errors.vaccine}
                      helperText={errors.vaccine}
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
                      <VaccineIcon sx={{ mr: 2, color: 'primary.main' }} />
                      <Box>
                        <Typography variant="body1">{option.display}</Typography>
                        {option.code && (
                          <Typography variant="caption" color="text.secondary">
                            CVX: {option.code}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  )}
                />
              </Box>

              {/* Vaccine Categories */}
              <Box mb={3}>
                <Typography variant="subtitle2" gutterBottom>
                  Browse by Category
                </Typography>
                <Grid container spacing={1}>
                  {VACCINE_CATEGORIES.map((category) => (
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

              {/* Trending Vaccines */}
              {trendingVaccines.length > 0 && (
                <Box mb={3}>
                  <Typography variant="subtitle2" gutterBottom>
                    <TrendingUpIcon sx={{ fontSize: 16, mr: 1, verticalAlign: 'middle' }} />
                    Frequently Administered
                  </Typography>
                  <Grid container spacing={1}>
                    {trendingVaccines.map((vaccine) => (
                      <Grid item key={vaccine.code}>
                        <Chip
                          label={`${vaccine.display} (${vaccine.count})`}
                          onClick={() => handleVaccineSelect(vaccine)}
                          color="primary"
                          variant="outlined"
                          size="small"
                        />
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              )}

              {/* Vaccine Schedule Recommendations */}
              {vaccineSchedule.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    <ScheduleIcon sx={{ fontSize: 16, mr: 1, verticalAlign: 'middle' }} />
                    Recommended Schedule
                  </Typography>
                  <List dense>
                    {vaccineSchedule.map((item, index) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          <VaccineIcon 
                            color={item.priority === 'high' ? 'error' : 'primary'}
                          />
                        </ListItemIcon>
                        <ListItemText
                          primary={item.vaccine}
                          secondary={item.status === 'due' ? `Due: ${format(item.dueDate || new Date(), 'MMM d, yyyy')}` : item.interval}
                        />
                        <ListItemSecondaryAction>
                          <Chip
                            label={item.status}
                            size="small"
                            color={item.priority === 'high' ? 'error' : 'primary'}
                            variant="outlined"
                          />
                        </ListItemSecondaryAction>
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
                {/* Administration Status */}
                <Grid item xs={12}>
                  <FormControl component="fieldset">
                    <Typography variant="subtitle2" gutterBottom>
                      Administration Status
                    </Typography>
                    <RadioGroup
                      row
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    >
                      {VACCINE_STATUS_OPTIONS.map((option) => (
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

                {/* Administration Date */}
                <Grid item xs={12} md={6}>
                  <LocalizationProvider dateAdapter={AdapterDateFns}>
                    <DatePicker
                      label="Administration Date"
                      value={formData.occurrence}
                      onChange={(date) => setFormData({ ...formData, occurrence: date })}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          fullWidth
                          error={!!errors.occurrence}
                          helperText={errors.occurrence}
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

                {/* Lot Number */}
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Lot Number"
                    value={formData.lotNumber}
                    onChange={(e) => setFormData({ ...formData, lotNumber: e.target.value })}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <AssignmentIcon />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>

                {/* Expiration Date */}
                {formData.lotNumber && (
                  <Grid item xs={12} md={6}>
                    <LocalizationProvider dateAdapter={AdapterDateFns}>
                      <DatePicker
                        label="Expiration Date"
                        value={formData.expirationDate}
                        onChange={(date) => setFormData({ ...formData, expirationDate: date })}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            fullWidth
                            error={!!errors.expirationDate}
                            helperText={errors.expirationDate}
                          />
                        )}
                        minDate={new Date()}
                      />
                    </LocalizationProvider>
                  </Grid>
                )}

                {/* Dose Information */}
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Dose Quantity (mL)"
                    type="number"
                    value={formData.doseQuantity}
                    onChange={(e) => setFormData({ ...formData, doseQuantity: e.target.value })}
                    inputProps={{ step: 0.1, min: 0 }}
                  />
                </Grid>

                {/* Administration Site */}
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Administration Site</InputLabel>
                    <Select
                      value={formData.site}
                      onChange={(e) => setFormData({ ...formData, site: e.target.value })}
                      label="Administration Site"
                    >
                      <MenuItem value="LA">Left Arm</MenuItem>
                      <MenuItem value="RA">Right Arm</MenuItem>
                      <MenuItem value="LT">Left Thigh</MenuItem>
                      <MenuItem value="RT">Right Thigh</MenuItem>
                      <MenuItem value="LD">Left Deltoid</MenuItem>
                      <MenuItem value="RD">Right Deltoid</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                {/* Route */}
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Route</InputLabel>
                    <Select
                      value={formData.route}
                      onChange={(e) => setFormData({ ...formData, route: e.target.value })}
                      label="Route"
                    >
                      <MenuItem value="IM">Intramuscular</MenuItem>
                      <MenuItem value="SC">Subcutaneous</MenuItem>
                      <MenuItem value="PO">Oral</MenuItem>
                      <MenuItem value="IN">Intranasal</MenuItem>
                      <MenuItem value="ID">Intradermal</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                {/* Performer */}
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Administered By"
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
                  />
                </Grid>

                {/* Series Information */}
                <Grid item xs={12}>
                  <Typography variant="subtitle2" gutterBottom>
                    Series Information (if applicable)
                  </Typography>
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Series Name"
                    value={formData.protocolApplied.series}
                    onChange={(e) => setFormData({
                      ...formData,
                      protocolApplied: { ...formData.protocolApplied, series: e.target.value }
                    })}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Dose Number"
                    type="number"
                    value={formData.protocolApplied.doseNumber}
                    onChange={(e) => setFormData({
                      ...formData,
                      protocolApplied: { ...formData.protocolApplied, doseNumber: parseInt(e.target.value) || 1 }
                    })}
                    inputProps={{ min: 1 }}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Total Doses in Series"
                    type="number"
                    value={formData.protocolApplied.seriesDoses}
                    onChange={(e) => setFormData({
                      ...formData,
                      protocolApplied: { ...formData.protocolApplied, seriesDoses: parseInt(e.target.value) || 1 }
                    })}
                    inputProps={{ min: 1 }}
                  />
                </Grid>

                {/* Reaction Information */}
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.reaction.hasReaction}
                        onChange={(e) => setFormData({
                          ...formData,
                          reaction: { ...formData.reaction, hasReaction: e.target.checked }
                        })}
                      />
                    }
                    label="Patient had a reaction"
                  />
                </Grid>

                {formData.reaction.hasReaction && (
                  <>
                    <Grid item xs={12} md={6}>
                      <FormControl fullWidth>
                        <InputLabel>Reaction Type</InputLabel>
                        <Select
                          value={formData.reaction.type}
                          onChange={(e) => setFormData({
                            ...formData,
                            reaction: { ...formData.reaction, type: e.target.value }
                          })}
                          label="Reaction Type"
                        >
                          {REACTION_TYPES.map((type) => (
                            <MenuItem key={type.value} value={type.value}>
                              {type.label}
                              {type.severity === 'high' && (
                                <WarningIcon sx={{ ml: 1, fontSize: 16, color: 'error.main' }} />
                              )}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <FormControl fullWidth>
                        <InputLabel>Severity</InputLabel>
                        <Select
                          value={formData.reaction.severity}
                          onChange={(e) => setFormData({
                            ...formData,
                            reaction: { ...formData.reaction, severity: e.target.value }
                          })}
                          label="Severity"
                        >
                          <MenuItem value="mild">Mild</MenuItem>
                          <MenuItem value="moderate">Moderate</MenuItem>
                          <MenuItem value="severe">Severe</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        multiline
                        rows={2}
                        label="Reaction Notes"
                        value={formData.reaction.notes}
                        onChange={(e) => setFormData({
                          ...formData,
                          reaction: { ...formData.reaction, notes: e.target.value }
                        })}
                      />
                    </Grid>
                  </>
                )}

                {/* Reason Not Given (if not done) */}
                {formData.status === 'not-done' && (
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Reason Not Given"
                      value={formData.reasonNotGiven}
                      onChange={(e) => setFormData({ ...formData, reasonNotGiven: e.target.value })}
                      error={!!errors.reasonNotGiven}
                      helperText={errors.reasonNotGiven}
                      required
                    />
                  </Grid>
                )}

                {/* Notes */}
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Additional Notes"
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
            </Box>
          </Fade>
        );

      case 2:
        return (
          <Fade in={true}>
            <Box>
              <Typography variant="h6" gutterBottom>
                Review Immunization Record
              </Typography>
              
              <Card variant="outlined" sx={{ mb: 3 }}>
                <CardContent>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <Box display="flex" alignItems="center" mb={2}>
                        <VaccineIcon sx={{ mr: 2, color: 'primary.main', fontSize: 32 }} />
                        <Box>
                          <Typography variant="h6">
                            {selectedVaccine?.display}
                          </Typography>
                          {selectedVaccine?.code && (
                            <Typography variant="caption" color="text.secondary">
                              CVX Code: {selectedVaccine.code}
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
                        label={VACCINE_STATUS_OPTIONS.find(opt => opt.value === formData.status)?.label}
                        color={VACCINE_STATUS_OPTIONS.find(opt => opt.value === formData.status)?.color}
                        size="small"
                      />
                    </Grid>
                    
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" color="text.secondary">
                        Administration Date
                      </Typography>
                      <Typography variant="body1">
                        {format(formData.occurrence, 'MMMM d, yyyy')}
                      </Typography>
                    </Grid>
                    
                    {formData.lotNumber && (
                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" color="text.secondary">
                          Lot Number
                        </Typography>
                        <Typography variant="body1">
                          {formData.lotNumber}
                        </Typography>
                      </Grid>
                    )}
                    
                    {formData.expirationDate && (
                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" color="text.secondary">
                          Expiration Date
                        </Typography>
                        <Typography variant="body1">
                          {format(formData.expirationDate, 'MMMM d, yyyy')}
                        </Typography>
                      </Grid>
                    )}
                    
                    {formData.site && (
                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" color="text.secondary">
                          Administration Site
                        </Typography>
                        <Typography variant="body1">
                          {formData.site}
                        </Typography>
                      </Grid>
                    )}
                    
                    {formData.route && (
                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" color="text.secondary">
                          Route
                        </Typography>
                        <Typography variant="body1">
                          {formData.route}
                        </Typography>
                      </Grid>
                    )}
                    
                    {formData.performer && (
                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" color="text.secondary">
                          Administered By
                        </Typography>
                        <Typography variant="body1">
                          {formData.performer}
                        </Typography>
                      </Grid>
                    )}
                    
                    {formData.protocolApplied.series && (
                      <Grid item xs={12}>
                        <Typography variant="subtitle2" color="text.secondary">
                          Series Information
                        </Typography>
                        <Typography variant="body1">
                          {formData.protocolApplied.series} - Dose {formData.protocolApplied.doseNumber} of {formData.protocolApplied.seriesDoses}
                        </Typography>
                      </Grid>
                    )}
                    
                    {formData.reaction.hasReaction && (
                      <Grid item xs={12}>
                        <Alert severity={formData.reaction.severity === 'severe' ? 'error' : 'warning'}>
                          <Typography variant="subtitle2">
                            Reaction Reported
                          </Typography>
                          <Typography variant="body2">
                            {REACTION_TYPES.find(t => t.value === formData.reaction.type)?.label} - 
                            {formData.reaction.severity} severity
                          </Typography>
                          {formData.reaction.notes && (
                            <Typography variant="body2" sx={{ mt: 1 }}>
                              {formData.reaction.notes}
                            </Typography>
                          )}
                        </Alert>
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
              
              {(errors.submit || saveError) && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {errors.submit || saveError}
                </Alert>
              )}
              
              <Box display="flex" alignItems="center" justifyContent="center">
                <CheckCircleIcon sx={{ mr: 1, color: 'success.main' }} />
                <Typography variant="body2" color="text.secondary">
                  Ready to save immunization record
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
            <VaccineIcon sx={{ mr: 2, color: 'primary.main' }} />
            <Typography variant="h6">
              {immunization ? 'Edit Immunization' : 'Administer Vaccine'}
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
                selectedVaccine && (
                  <Typography variant="caption">{selectedVaccine.display}</Typography>
                )
              }
            >
              Select Vaccine
            </StepLabel>
            <StepContent>
              {getStepContent(0)}
              <Box sx={{ mt: 2 }}>
                <Button
                  variant="contained"
                  onClick={handleNext}
                  disabled={!selectedVaccine}
                  endIcon={<VaccineIcon />}
                >
                  Continue
                </Button>
              </Box>
            </StepContent>
          </Step>
          
          <Step>
            <StepLabel>
              Administration Details
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
                  {isSaving ? 'Saving...' : 'Save Immunization'}
                </Button>
              </Box>
            </StepContent>
          </Step>
        </Stepper>
      </DialogContent>
    </Dialog>
  );
};

export default ImmunizationDialogEnhanced;