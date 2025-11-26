/**
 * Enhanced Allergy Dialog Component
 * Modern, aesthetic dialog for managing allergies with full FHIR R4 support
 * Features:
 * - Dynamic allergen catalog from patient data
 * - Reaction severity assessment
 * - Manifestation tracking
 * - Beautiful Material-UI design with intuitive workflow
 * - Clinical decision support integration
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
  MenuItem,
  Grid,
  Card,
  CardContent,
  Fade,
  Zoom,
  Switch,
  FormGroup,
  Checkbox,
  Rating,
  CircularProgress
} from '@mui/material';
import {
  Close as CloseIcon,
  Save as SaveIcon,
  NavigateBefore as BackIcon,
  NavigateNext as NextIcon,
  Warning as AllergyIcon,
  Search as SearchIcon,
  Error as CriticalIcon,
  CheckCircle as ActiveIcon,
  Cancel as InactiveIcon,
  AccessTime as ClockIcon,
  CalendarToday as DateIcon,
  Notes as NotesIcon,
  LocalPharmacy as MedicationIcon,
  Restaurant as FoodIcon,
  Park as EnvironmentalIcon,
  Science as LabIcon,
  AutoAwesome as SmartIcon,
  HealthAndSafety as SafetyIcon,
  TrendingUp as TrendingIcon,
  Verified as VerifiedIcon,
  Report as ReportIcon,
  Face as ManifestationIcon,
  BugReport as BiologicIcon,
  Psychology as UnknownIcon
} from '@mui/icons-material';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, parseISO, differenceInDays } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

// Services
import cdsClinicalDataService from '../../../../services/cdsClinicalDataService';
import { fhirClient } from '../../../../core/fhir/services/fhirClient';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import { useCDS } from '../../../../contexts/CDSContext';
import { useClinicalWorkflow } from '../../../../contexts/ClinicalWorkflowContext';
import { useAuth } from '../../../../contexts/AuthContext';
import { CLINICAL_EVENTS } from '../../../../constants/clinicalEvents';
import { useDialogSave, useDialogValidation, VALIDATION_RULES } from './utils/dialogHelpers';

const searchAllergens = async (query) => {
  try {
    // Search for allergens from existing AllergyIntolerance resources
    const searchParams = {
      _count: 100,
      _sort: '-date'
    };
    
    if (query) {
      searchParams._text = query;
    }
    
    const bundle = await fhirClient.search('AllergyIntolerance', searchParams);
    const allergies = bundle.entry?.map(entry => entry.resource) || [];
    
    // Extract unique allergens
    const allergenMap = new Map();
    
    allergies.forEach(allergy => {
      if (allergy.code?.coding) {
        allergy.code.coding.forEach(coding => {
          const key = coding.code || coding.display;
          if (key && !allergenMap.has(key)) {
            allergenMap.set(key, {
              code: coding.code,
              display: coding.display || allergy.code.text || 'Unknown Allergen',
              system: coding.system
            });
          }
        });
      }
    });
    
    // Add common allergens if search is empty or general
    if (!query || query.length < 3) {
      const commonAllergens = [
        { code: '387406002', display: 'Sulfonamide (substance)', system: 'http://snomed.info/sct' },
        { code: '7980', display: 'Penicillin V', system: 'http://www.nlm.nih.gov/research/umls/rxnorm' },
        { code: '227493005', display: 'Cashew nut', system: 'http://snomed.info/sct' },
        { code: '256349002', display: 'Peanut', system: 'http://snomed.info/sct' },
        { code: '102263004', display: 'Eggs', system: 'http://snomed.info/sct' },
        { code: '3718001', display: 'Cow\'s milk', system: 'http://snomed.info/sct' },
        { code: '111088007', display: 'Latex', system: 'http://snomed.info/sct' },
        { code: '424213003', display: 'Bee venom', system: 'http://snomed.info/sct' },
        { code: '91936005', display: 'Allergy to penicillin', system: 'http://snomed.info/sct' },
        { code: '418689008', display: 'Allergy to grass pollen', system: 'http://snomed.info/sct' }
      ];
      
      commonAllergens.forEach(allergen => {
        if (!allergenMap.has(allergen.code)) {
          allergenMap.set(allergen.code, allergen);
        }
      });
    }
    
    // Convert to array and filter by query if provided
    let results = Array.from(allergenMap.values());
    
    if (query) {
      const searchTerm = query.toLowerCase();
      results = results.filter(item => 
        item.display?.toLowerCase().includes(searchTerm) ||
        item.code?.toLowerCase().includes(searchTerm)
      );
    }
    
    return results.slice(0, 20); // Limit results
  } catch (error) {
    console.error('Error searching allergens:', error);
    return [];
  }
};

// Constants
const STEPS = ['Allergen Selection', 'Reaction Details', 'Review & Save'];

const CLINICAL_STATUS_OPTIONS = [
  { value: 'active', label: 'Active', icon: <ActiveIcon />, color: 'error', default: true },
  { value: 'inactive', label: 'Inactive', icon: <InactiveIcon />, color: 'default' },
  { value: 'resolved', label: 'Resolved', icon: <ActiveIcon />, color: 'success' }
];

const VERIFICATION_STATUS_OPTIONS = [
  { value: 'unconfirmed', label: 'Unconfirmed', icon: <UnknownIcon />, color: 'warning' },
  { value: 'confirmed', label: 'Confirmed', icon: <VerifiedIcon />, color: 'success', default: true },
  { value: 'refuted', label: 'Refuted', icon: <InactiveIcon />, color: 'error' },
  { value: 'entered-in-error', label: 'Entered in Error', icon: <InactiveIcon />, color: 'error' }
];

const CRITICALITY_OPTIONS = [
  { value: 'low', label: 'Low', description: 'Unlikely to cause serious reactions', color: 'info', rating: 1 },
  { value: 'high', label: 'High', description: 'May cause serious or life-threatening reactions', color: 'warning', rating: 2 },
  { value: 'unable-to-assess', label: 'Unable to Assess', description: 'Criticality unknown', color: 'default', rating: 0 }
];

const TYPE_OPTIONS = [
  { value: 'allergy', label: 'Allergy', icon: <AllergyIcon />, description: 'Immune-mediated reaction' },
  { value: 'intolerance', label: 'Intolerance', icon: <ReportIcon />, description: 'Non-immune mediated reaction' }
];

const CATEGORY_OPTIONS = [
  { value: 'food', label: 'Food', icon: <FoodIcon />, color: 'success' },
  { value: 'medication', label: 'Medication', icon: <MedicationIcon />, color: 'primary' },
  { value: 'environment', label: 'Environmental', icon: <EnvironmentalIcon />, color: 'info' },
  { value: 'biologic', label: 'Biologic', icon: <BiologicIcon />, color: 'warning' }
];

const COMMON_MANIFESTATIONS = [
  // Skin
  { value: '39579001', label: 'Rash', category: 'skin' },
  { value: '271807003', label: 'Hives', category: 'skin' },
  { value: '418290006', label: 'Itching', category: 'skin' },
  { value: '267036007', label: 'Swelling', category: 'skin' },
  { value: '271757001', label: 'Flushing', category: 'skin' },
  
  // Respiratory
  { value: '267036007', label: 'Shortness of breath', category: 'respiratory' },
  { value: '49727002', label: 'Cough', category: 'respiratory' },
  { value: '267101005', label: 'Wheezing', category: 'respiratory' },
  { value: '23924001', label: 'Chest tightness', category: 'respiratory' },
  
  // Gastrointestinal
  { value: '422587007', label: 'Nausea', category: 'gi' },
  { value: '422400008', label: 'Vomiting', category: 'gi' },
  { value: '62315008', label: 'Diarrhea', category: 'gi' },
  { value: '21522001', label: 'Abdominal pain', category: 'gi' },
  
  // Cardiovascular
  { value: '39579001', label: 'Anaphylaxis', category: 'severe' },
  { value: '271594007', label: 'Hypotension', category: 'cardiovascular' },
  { value: '3424008', label: 'Tachycardia', category: 'cardiovascular' },
  
  // Other
  { value: '25064002', label: 'Headache', category: 'other' },
  { value: '404640003', label: 'Dizziness', category: 'other' },
  { value: '91175000', label: 'Seizure', category: 'severe' }
];

const SEVERITY_OPTIONS = [
  { value: 'mild', label: 'Mild', color: 'success', description: 'Minimal symptoms, no treatment needed' },
  { value: 'moderate', label: 'Moderate', color: 'warning', description: 'Symptoms require treatment' },
  { value: 'severe', label: 'Severe', color: 'error', description: 'Life-threatening or disabling' }
];

// Custom hook for allergen search
const useAllergenSearch = (searchTerm, category) => {
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState([]);
  const [cache] = useState(new Map());

  const searchAllergens = useCallback(async (term, cat) => {
    if (!term || term.length < 2) {
      setOptions([]);
      return;
    }

    const cacheKey = `${term}-${cat}`;
    if (cache.has(cacheKey)) {
      setOptions(cache.get(cacheKey));
      return;
    }

    setLoading(true);
    try {
      // In a real implementation, this would search based on category
      let results = [];
      
      if (cat === 'medication') {
        results = await cdsClinicalDataService.getDynamicMedicationCatalog(term, 20);
      } else {
        // Mock data for other categories - in production, would have specific catalogs
        results = [
          { code: '762952008', display: 'Peanut', category: 'food' },
          { code: '735029006', display: 'Shellfish', category: 'food' },
          { code: '735215001', display: 'Egg', category: 'food' },
          { code: '764146007', display: 'Penicillin', category: 'medication' },
          { code: '387406002', display: 'Sulfonamides', category: 'medication' },
          { code: '111088007', display: 'Latex', category: 'environment' },
          { code: '256277009', display: 'Pollen', category: 'environment' },
          { code: '264287008', display: 'Bee venom', category: 'biologic' }
        ].filter(item => 
          item.display.toLowerCase().includes(term.toLowerCase()) &&
          (!cat || item.category === cat)
        );
      }
      
      const formattedResults = results.map(item => ({
        ...item,
        label: item.display,
        subLabel: `Category: ${item.category}`
      }));
      
      cache.set(cacheKey, formattedResults);
      setOptions(formattedResults);
    } catch (error) {
      console.error('Error searching allergens:', error);
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, [cache]);

  useEffect(() => {
    const timer = setTimeout(() => {
      searchAllergens(searchTerm, category);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, category, searchAllergens]);

  return { loading, options };
};

const AllergyDialogEnhanced = ({
  open,
  onClose,
  allergy = null,
  onSave,
  patientId,
  encounterId = null
}) => {
  const theme = useTheme();
  const { user } = useAuth();
  const { currentPatient } = useFHIRResource();
  const { evaluateCDS } = useCDS();
  const { publish } = useClinicalWorkflow();

  // Use consistent dialog helpers
  const { saving: isSaving, error: saveError, handleSave: performSave } = useDialogSave(onSave, null);
  const { errors: validationErrors, validateForm, clearErrors } = useDialogValidation();
  
  // State
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAllergen, setSelectedAllergen] = useState(null);
  const [cdsAlerts, setCdsAlerts] = useState([]);
  const [showAllManifestations, setShowAllManifestations] = useState(false);
  
  // Form data
  const [formData, setFormData] = useState({
    code: '',
    display: '',
    clinicalStatus: 'active',
    verificationStatus: 'confirmed',
    type: 'allergy',
    category: '',
    criticality: 'low',
    onsetDateTime: null,
    recordedDate: new Date(),
    recorder: '',
    asserter: '',
    lastOccurrence: null,
    note: '',
    manifestations: [],
    severity: 'mild',
    exposureRoute: '',
    reactionNote: ''
  });
  
  const [errors, setErrors] = useState({}); // Local UI errors only

  // Search hook
  const { loading: searchLoading, options: searchOptions } = useAllergenSearch(searchTerm, formData.category);

  // Common allergens by category
  const commonAllergens = useMemo(() => {
    const allergens = {
      food: [
        { code: '762952008', display: 'Peanut', severity: 'high' },
        { code: '735029006', display: 'Shellfish', severity: 'high' },
        { code: '735215001', display: 'Egg', severity: 'moderate' },
        { code: '734881000', display: 'Milk', severity: 'moderate' },
        { code: '735971005', display: 'Tree nuts', severity: 'high' }
      ],
      medication: [
        { code: '764146007', display: 'Penicillin', severity: 'high' },
        { code: '387406002', display: 'Sulfonamides', severity: 'moderate' },
        { code: '387207008', display: 'Aspirin', severity: 'moderate' },
        { code: '387458008', display: 'NSAIDs', severity: 'moderate' },
        { code: '373270004', display: 'Codeine', severity: 'moderate' }
      ],
      environment: [
        { code: '111088007', display: 'Latex', severity: 'high' },
        { code: '256277009', display: 'Pollen', severity: 'low' },
        { code: '406474002', display: 'Dust mites', severity: 'low' },
        { code: '782576004', display: 'Pet dander', severity: 'low' }
      ],
      biologic: [
        { code: '264287008', display: 'Bee venom', severity: 'high' },
        { code: '288328004', display: 'Wasp venom', severity: 'high' },
        { code: '421961002', display: 'Contrast media', severity: 'moderate' }
      ]
    };
    
    return formData.category ? allergens[formData.category] || [] : [];
  }, [formData.category]);

  // Initialize form for edit mode
  useEffect(() => {
    if (allergy && open) {
      const reaction = allergy.reaction?.[0] || {};
      
      setFormData({
        code: allergy.code?.coding?.[0]?.code || '',
        display: allergy.code?.coding?.[0]?.display || allergy.code?.text || '',
        clinicalStatus: allergy.clinicalStatus?.coding?.[0]?.code || 'active',
        verificationStatus: allergy.verificationStatus?.coding?.[0]?.code || 'confirmed',
        type: allergy.type || 'allergy',
        category: allergy.category?.[0] || '',
        criticality: allergy.criticality || 'low',
        onsetDateTime: allergy.onsetDateTime ? parseISO(allergy.onsetDateTime) : null,
        recordedDate: allergy.recordedDate ? parseISO(allergy.recordedDate) : new Date(),
        recorder: allergy.recorder?.display || '',
        asserter: allergy.asserter?.display || '',
        lastOccurrence: allergy.lastOccurrence ? parseISO(allergy.lastOccurrence) : null,
        note: allergy.note?.[0]?.text || '',
        manifestations: reaction.manifestation?.map(m => m.coding?.[0]?.code) || [],
        severity: reaction.severity || 'mild',
        exposureRoute: reaction.exposureRoute?.coding?.[0]?.display || '',
        reactionNote: reaction.description || ''
      });
      
      setSelectedAllergen({
        code: allergy.code?.coding?.[0]?.code,
        display: allergy.code?.coding?.[0]?.display
      });
      
      setActiveStep(1); // Skip search step in edit mode
    }
  }, [allergy, open]);

  // Validate current step
  const validateStep = useCallback(() => {
    const newErrors = {};
    
    switch (activeStep) {
      case 0: // Allergen Selection
        if (!formData.category) {
          newErrors.category = 'Please select an allergy category';
        }
        if (!selectedAllergen) {
          newErrors.allergen = 'Please select an allergen';
        }
        break;
        
      case 1: // Reaction Details
        if (formData.manifestations.length === 0) {
          newErrors.manifestations = 'Please select at least one manifestation';
        }
        if (!formData.severity) {
          newErrors.severity = 'Please select reaction severity';
        }
        break;
        
      case 2: // Review
        // Final validation
        break;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [activeStep, selectedAllergen, formData]);

  // Handle navigation
  const handleNext = async () => {
    if (!validateStep()) return;
    
    if (activeStep === 0 && selectedAllergen) {
      // Update form data with selected allergen
      setFormData(prev => ({
        ...prev,
        code: selectedAllergen.code,
        display: selectedAllergen.display
      }));
      
      // Evaluate CDS for the selected allergen
      try {
        const alerts = await evaluateCDS('allergy-add', {
          patient: patientId,
          allergen: selectedAllergen,
          category: formData.category
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
      const fhirAllergy = {
        resourceType: 'AllergyIntolerance',
        ...(allergy?.id && { id: allergy.id }),
        clinicalStatus: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical',
            code: formData.clinicalStatus
          }]
        },
        verificationStatus: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification',
            code: formData.verificationStatus
          }]
        },
        type: formData.type,
        category: [formData.category],
        criticality: formData.criticality,
        code: {
          coding: [{
            system: 'http://snomed.info/sct',
            code: formData.code,
            display: formData.display
          }],
          text: formData.display
        },
        patient: {
          reference: `Patient/${patientId}`,
          display: currentPatient?.name?.[0]?.text
        },
        ...(encounterId && {
          encounter: {
            reference: `Encounter/${encounterId}`
          }
        }),
        ...(formData.onsetDateTime && {
          onsetDateTime: formData.onsetDateTime.toISOString()
        }),
        recordedDate: formData.recordedDate.toISOString(),
        recorder: {
          reference: `Practitioner/${user?.id || 'unknown'}`,
          display: user?.name || formData.recorder || 'Unknown Practitioner'
        },
        ...(formData.asserter && {
          asserter: {
            reference: 'Patient/' + patientId,
            display: formData.asserter
          }
        }),
        ...(formData.lastOccurrence && {
          lastOccurrence: formData.lastOccurrence.toISOString()
        }),
        ...(formData.note && {
          note: [{
            text: formData.note
          }]
        }),
        reaction: formData.manifestations.length > 0 ? [{
          ...(formData.manifestations.length > 0 && {
            manifestation: formData.manifestations.map(code => {
              const manifestation = COMMON_MANIFESTATIONS.find(m => m.value === code);
              return {
                coding: [{
                  system: 'http://snomed.info/sct',
                  code: code,
                  display: manifestation?.label || ''
                }]
              };
            })
          }),
          ...(formData.reactionNote && {
            description: formData.reactionNote
          }),
          severity: formData.severity,
          ...(formData.exposureRoute && {
            exposureRoute: {
              coding: [{
                system: 'http://snomed.info/sct',
                display: formData.exposureRoute
              }]
            }
          })
        }] : []
      };

      // Use the consistent save handler
      const success = await performSave(fhirAllergy, `Allergy ${allergy ? 'updated' : 'added'} successfully`);
      
      if (success) {
        // Publish event
        publish(CLINICAL_EVENTS.ALLERGY_ADDED, {
          patientId,
          allergyId: fhirAllergy.id,
          allergy: fhirAllergy
        });
        
        // Close dialog on success
        handleClose();
      }
    } catch (error) {
      console.error('Error preparing allergy data:', error);
      // The performSave function handles its own error display
    }
  };

  const handleClose = () => {
    setActiveStep(0);
    setSearchTerm('');
    setSelectedAllergen(null);
    setFormData({
      code: '',
      display: '',
      clinicalStatus: 'active',
      verificationStatus: 'confirmed',
      type: 'allergy',
      category: '',
      criticality: 'low',
      onsetDateTime: null,
      recordedDate: new Date(),
      recorder: '',
      asserter: '',
      lastOccurrence: null,
      note: '',
      manifestations: [],
      severity: 'mild',
      exposureRoute: '',
      reactionNote: ''
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
              {/* Category Selection */}
              <FormControl component="fieldset" error={!!errors.category} sx={{ mb: 3 }}>
                <FormLabel component="legend" sx={{ mb: 2 }}>
                  Select Allergy Category *
                </FormLabel>
                <Grid container spacing={2}>
                  {CATEGORY_OPTIONS.map((category) => (
                    <Grid item xs={6} sm={3} key={category.value}>
                      <Card
                        elevation={0}
                        sx={{
                          p: 2,
                          cursor: 'pointer',
                          textAlign: 'center',
                          border: `2px solid ${
                            formData.category === category.value
                              ? theme.palette[category.color]?.main || theme.palette.primary.main
                              : theme.palette.divider
                          }`,
                          bgcolor: formData.category === category.value
                            ? alpha(theme.palette[category.color]?.main || theme.palette.primary.main, 0.1)
                            : 'background.paper',
                          transition: 'all 0.2s',
                          '&:hover': {
                            transform: 'translateY(-2px)',
                            boxShadow: theme.shadows[3],
                          },
                        }}
                        onClick={() => {
                          setFormData({ ...formData, category: category.value });
                          setErrors(prev => ({ ...prev, category: null }));
                        }}
                      >
                        <Avatar
                          sx={{
                            width: 48,
                            height: 48,
                            margin: '0 auto',
                            mb: 1,
                            bgcolor: theme.palette[category.color]?.light || theme.palette.primary.light,
                            color: theme.palette[category.color]?.main || theme.palette.primary.main,
                          }}
                        >
                          {category.icon}
                        </Avatar>
                        <Typography variant="body2" fontWeight="medium">
                          {category.label}
                        </Typography>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
                {errors.category && (
                  <Typography variant="caption" color="error" sx={{ mt: 1 }}>
                    {errors.category}
                  </Typography>
                )}
              </FormControl>

              {/* Allergen Search */}
              {formData.category && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Box sx={{ mb: 3 }}>
                    <Autocomplete
                      freeSolo
                      options={searchOptions}
                      loading={searchLoading}
                      value={selectedAllergen}
                      onChange={(event, newValue) => {
                        setSelectedAllergen(newValue);
                        setErrors(prev => ({ ...prev, allergen: null }));
                      }}
                      inputValue={searchTerm}
                      onInputChange={(event, newInputValue) => {
                        setSearchTerm(newInputValue);
                      }}
                      getOptionLabel={(option) => option.label || option.display || ''}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label={`Search ${formData.category} allergens`}
                          placeholder="Type allergen name..."
                          error={!!errors.allergen}
                          helperText={errors.allergen}
                          InputProps={{
                            ...params.InputProps,
                            startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                          }}
                        />
                      )}
                      renderOption={(props, option) => (
                        <ListItem {...props}>
                          <ListItemIcon>
                            <Avatar sx={{ bgcolor: theme.palette.warning.light, width: 36, height: 36 }}>
                              <AllergyIcon fontSize="small" />
                            </Avatar>
                          </ListItemIcon>
                          <ListItemText
                            primary={option.display}
                            secondary={option.subLabel}
                          />
                        </ListItem>
                      )}
                    />
                  </Box>

                  {/* Common Allergens */}
                  {commonAllergens.length > 0 && !searchTerm && (
                    <Paper elevation={0} sx={{ p: 2, bgcolor: alpha(theme.palette.warning.main, 0.05) }}>
                      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                        <TrendingIcon color="warning" />
                        <Typography variant="subtitle2" color="warning.dark">
                          Common {formData.category} allergens
                        </Typography>
                      </Stack>
                      
                      <Stack spacing={1}>
                        {commonAllergens.map((allergen) => (
                          <Paper
                            key={allergen.code}
                            elevation={0}
                            sx={{
                              p: 1.5,
                              cursor: 'pointer',
                              bgcolor: 'background.paper',
                              border: `1px solid ${theme.palette.divider}`,
                              transition: 'all 0.2s',
                              '&:hover': {
                                borderColor: theme.palette.warning.main,
                                transform: 'translateX(4px)',
                                boxShadow: theme.shadows[2],
                              },
                            }}
                            onClick={() => {
                              setSelectedAllergen(allergen);
                              setSearchTerm(allergen.display);
                            }}
                          >
                            <Stack direction="row" alignItems="center" justifyContent="space-between">
                              <Typography variant="body2" fontWeight="medium">
                                {allergen.display}
                              </Typography>
                              {allergen.severity === 'high' && (
                                <Chip
                                  size="small"
                                  label="High Risk"
                                  color="error"
                                  variant="outlined"
                                  icon={<CriticalIcon />}
                                />
                              )}
                            </Stack>
                          </Paper>
                        ))}
                      </Stack>
                    </Paper>
                  )}
                </motion.div>
              )}

              {/* Selected Allergen Preview */}
              {selectedAllergen && (
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
                      bgcolor: alpha(theme.palette.warning.main, 0.05),
                      border: `2px solid ${theme.palette.warning.main}`,
                    }}
                  >
                    <Stack direction="row" alignItems="center" spacing={2}>
                      <Avatar sx={{ bgcolor: theme.palette.warning.main }}>
                        <AllergyIcon />
                      </Avatar>
                      <Box flex={1}>
                        <Typography variant="subtitle1" fontWeight="medium">
                          {selectedAllergen.display}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Category: {formData.category}
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
                {/* Type and Criticality */}
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6}>
                    <FormControl component="fieldset">
                      <FormLabel component="legend" sx={{ mb: 1 }}>
                        Type
                      </FormLabel>
                      <RadioGroup
                        value={formData.type}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      >
                        {TYPE_OPTIONS.map((option) => (
                          <FormControlLabel
                            key={option.value}
                            value={option.value}
                            control={<Radio size="small" />}
                            label={
                              <Stack direction="row" alignItems="center" spacing={0.5}>
                                {option.icon}
                                <Box>
                                  <Typography variant="body2">{option.label}</Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {option.description}
                                  </Typography>
                                </Box>
                              </Stack>
                            }
                          />
                        ))}
                      </RadioGroup>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <FormControl component="fieldset">
                      <FormLabel component="legend" sx={{ mb: 1 }}>
                        Criticality
                      </FormLabel>
                      <Stack spacing={2}>
                        {CRITICALITY_OPTIONS.map((option) => (
                          <Paper
                            key={option.value}
                            elevation={0}
                            sx={{
                              p: 2,
                              cursor: 'pointer',
                              border: `2px solid ${
                                formData.criticality === option.value
                                  ? theme.palette[option.color]?.main || theme.palette.primary.main
                                  : theme.palette.divider
                              }`,
                              bgcolor: formData.criticality === option.value
                                ? alpha(theme.palette[option.color]?.main || theme.palette.primary.main, 0.1)
                                : 'background.paper',
                              transition: 'all 0.2s',
                              '&:hover': {
                                borderColor: theme.palette[option.color]?.main || theme.palette.primary.main,
                              },
                            }}
                            onClick={() => setFormData({ ...formData, criticality: option.value })}
                          >
                            <Stack direction="row" alignItems="center" spacing={2}>
                              <Rating
                                value={option.rating}
                                max={2}
                                readOnly
                                icon={<CriticalIcon fontSize="inherit" />}
                                emptyIcon={<CriticalIcon fontSize="inherit" />}
                                sx={{ color: theme.palette[option.color]?.main || theme.palette.primary.main }}
                              />
                              <Box>
                                <Typography variant="body2" fontWeight="medium">
                                  {option.label}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {option.description}
                                </Typography>
                              </Box>
                            </Stack>
                          </Paper>
                        ))}
                      </Stack>
                    </FormControl>
                  </Grid>
                </Grid>

                <Divider />

                {/* Manifestations */}
                <FormControl component="fieldset" error={!!errors.manifestations}>
                  <FormLabel component="legend" sx={{ mb: 2 }}>
                    Reaction Manifestations *
                  </FormLabel>
                  <Grid container spacing={1}>
                    {COMMON_MANIFESTATIONS.filter(m => 
                      showAllManifestations || ['skin', 'respiratory', 'severe'].includes(m.category)
                    ).map((manifestation) => (
                      <Grid item xs={12} sm={6} md={4} key={manifestation.value}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={formData.manifestations.includes(manifestation.value)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFormData({
                                    ...formData,
                                    manifestations: [...formData.manifestations, manifestation.value]
                                  });
                                } else {
                                  setFormData({
                                    ...formData,
                                    manifestations: formData.manifestations.filter(m => m !== manifestation.value)
                                  });
                                }
                                setErrors(prev => ({ ...prev, manifestations: null }));
                              }}
                              size="small"
                            />
                          }
                          label={
                            <Stack direction="row" alignItems="center" spacing={1}>
                              <ManifestationIcon fontSize="small" color="action" />
                              <Typography variant="body2">{manifestation.label}</Typography>
                              {manifestation.category === 'severe' && (
                                <Chip size="small" label="Severe" color="error" variant="outlined" />
                              )}
                            </Stack>
                          }
                        />
                      </Grid>
                    ))}
                  </Grid>
                  <Button
                    size="small"
                    onClick={() => setShowAllManifestations(!showAllManifestations)}
                    sx={{ mt: 1 }}
                  >
                    {showAllManifestations ? 'Show Less' : 'Show More Manifestations'}
                  </Button>
                  {errors.manifestations && (
                    <Typography variant="caption" color="error" sx={{ mt: 1 }}>
                      {errors.manifestations}
                    </Typography>
                  )}
                </FormControl>

                {/* Severity */}
                <FormControl component="fieldset" error={!!errors.severity}>
                  <FormLabel component="legend" sx={{ mb: 1 }}>
                    Reaction Severity *
                  </FormLabel>
                  <RadioGroup
                    row
                    value={formData.severity}
                    onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                  >
                    {SEVERITY_OPTIONS.map((option) => (
                      <FormControlLabel
                        key={option.value}
                        value={option.value}
                        control={<Radio />}
                        label={
                          <Stack>
                            <Chip
                              label={option.label}
                              color={option.color}
                              variant={formData.severity === option.value ? 'filled' : 'outlined'}
                            />
                            <Typography variant="caption" color="text.secondary">
                              {option.description}
                            </Typography>
                          </Stack>
                        }
                      />
                    ))}
                  </RadioGroup>
                </FormControl>

                {/* Dates */}
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <DatePicker
                        label="Onset Date"
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
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <DatePicker
                        label="Last Occurrence"
                        value={formData.lastOccurrence}
                        onChange={(value) => setFormData({ ...formData, lastOccurrence: value })}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            fullWidth
                            InputProps={{
                              ...params.InputProps,
                              startAdornment: <ClockIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                            }}
                          />
                        )}
                      />
                    </Grid>
                  </Grid>
                </LocalizationProvider>

                {/* Additional Details */}
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Reaction Details"
                  value={formData.reactionNote}
                  onChange={(e) => setFormData({ ...formData, reactionNote: e.target.value })}
                  placeholder="Describe the reaction in detail..."
                  InputProps={{
                    startAdornment: <NotesIcon sx={{ mr: 1, mt: 1, color: 'text.secondary' }} />,
                  }}
                />

                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  label="Additional Notes"
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  placeholder="Any other relevant information..."
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
                  bgcolor: alpha(theme.palette.warning.main, 0.02),
                  border: `1px solid ${theme.palette.divider}`,
                }}
              >
                <Stack spacing={3}>
                  {/* Allergy Summary */}
                  <Box>
                    <Typography variant="h6" gutterBottom color="warning.dark">
                      Allergy Summary
                    </Typography>
                    <Stack spacing={2}>
                      <Stack direction="row" alignItems="center" spacing={2}>
                        <Avatar sx={{ bgcolor: theme.palette.warning.main, width: 48, height: 48 }}>
                          <AllergyIcon />
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle1" fontWeight="medium">
                            {formData.display}
                          </Typography>
                          <Stack direction="row" spacing={2}>
                            <Chip
                              size="small"
                              icon={CATEGORY_OPTIONS.find(c => c.value === formData.category)?.icon}
                              label={CATEGORY_OPTIONS.find(c => c.value === formData.category)?.label}
                              color={CATEGORY_OPTIONS.find(c => c.value === formData.category)?.color}
                              variant="outlined"
                            />
                            <Chip
                              size="small"
                              label={TYPE_OPTIONS.find(t => t.value === formData.type)?.label}
                              variant="outlined"
                            />
                          </Stack>
                        </Box>
                      </Stack>

                      <Divider />

                      {/* Criticality and Status */}
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Rating
                          value={CRITICALITY_OPTIONS.find(c => c.value === formData.criticality)?.rating}
                          max={2}
                          readOnly
                          icon={<CriticalIcon fontSize="inherit" />}
                          emptyIcon={<CriticalIcon fontSize="inherit" />}
                          sx={{ color: theme.palette[CRITICALITY_OPTIONS.find(c => c.value === formData.criticality)?.color]?.main || theme.palette.primary.main }}
                        />
                        <Typography variant="body2">
                          {CRITICALITY_OPTIONS.find(c => c.value === formData.criticality)?.label} Criticality
                        </Typography>
                      </Stack>

                      {/* Manifestations */}
                      <Box>
                        <Typography variant="subtitle2" gutterBottom>
                          Reaction Manifestations
                        </Typography>
                        <Stack direction="row" spacing={1} flexWrap="wrap">
                          {formData.manifestations.map(code => {
                            const manifestation = COMMON_MANIFESTATIONS.find(m => m.value === code);
                            return (
                              <Chip
                                key={code}
                                size="small"
                                icon={<ManifestationIcon />}
                                label={manifestation?.label}
                                color={manifestation?.category === 'severe' ? 'error' : 'default'}
                                variant="outlined"
                                sx={{ mb: 1 }}
                              />
                            );
                          })}
                        </Stack>
                      </Box>

                      {/* Severity */}
                      <Stack direction="row" alignItems="center" spacing={2}>
                        <Typography variant="subtitle2">Reaction Severity:</Typography>
                        <Chip
                          label={SEVERITY_OPTIONS.find(s => s.value === formData.severity)?.label}
                          color={SEVERITY_OPTIONS.find(s => s.value === formData.severity)?.color}
                          variant="filled"
                        />
                      </Stack>

                      {/* Dates */}
                      {(formData.onsetDateTime || formData.lastOccurrence) && (
                        <Stack spacing={1}>
                          {formData.onsetDateTime && (
                            <Typography variant="body2">
                              <DateIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 1 }} />
                              Onset: {format(formData.onsetDateTime, 'PPP')}
                            </Typography>
                          )}
                          {formData.lastOccurrence && (
                            <Typography variant="body2">
                              <ClockIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 1 }} />
                              Last Occurrence: {format(formData.lastOccurrence, 'PPP')}
                            </Typography>
                          )}
                        </Stack>
                      )}

                      {/* Notes */}
                      {(formData.reactionNote || formData.note) && (
                        <Box sx={{ bgcolor: 'background.paper', p: 2, borderRadius: 1 }}>
                          {formData.reactionNote && (
                            <Typography variant="body2" paragraph>
                              <strong>Reaction Details:</strong> {formData.reactionNote}
                            </Typography>
                          )}
                          {formData.note && (
                            <Typography variant="body2">
                              <strong>Additional Notes:</strong> {formData.note}
                            </Typography>
                          )}
                        </Box>
                      )}
                    </Stack>
                  </Box>

                  {/* Safety Warning */}
                  <Alert
                    severity="warning"
                    icon={<SafetyIcon />}
                    sx={{ mt: 2 }}
                  >
                    <Typography variant="body2">
                      This allergy will be added to the patient's allergy list and will trigger alerts during medication prescribing and ordering.
                    </Typography>
                  </Alert>
                </Stack>
              </Paper>

              {saveError && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {saveError}
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
          bgcolor: theme.palette.warning.main,
          color: 'warning.contrastText',
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
              <AllergyIcon />
            </Avatar>
            <Typography variant="h6">
              {allergy ? 'Edit Allergy' : 'Add New Allergy'}
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
                disabled={loading || isSaving || (activeStep === 0 && !selectedAllergen)}
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
                color="warning"
              >
                {isSaving ? 'Saving...' : 'Save Allergy'}
              </Button>
            )}
          </Stack>
        </Stack>
      </DialogActions>
    </Dialog>
  );
};

export default AllergyDialogEnhanced;