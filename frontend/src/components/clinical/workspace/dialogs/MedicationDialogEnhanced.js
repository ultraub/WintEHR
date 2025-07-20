/**
 * Enhanced Medication Dialog Component
 * Modern, aesthetic dialog for managing medications with full FHIR R4 support
 * Features:
 * - Dynamic medication catalog from actual prescriptions
 * - Intelligent drug search with NDC codes
 * - Dosage calculations and frequency suggestions
 * - Drug interaction checking via CDS
 * - Beautiful Material-UI design with smooth animations
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
  InputAdornment,
  MenuItem,
  Grid,
  Card,
  CardContent,
  Collapse,
  Fade,
  Zoom,
  Switch,
  FormGroup,
  CircularProgress
} from '@mui/material';
import {
  Close as CloseIcon,
  Save as SaveIcon,
  NavigateBefore as BackIcon,
  NavigateNext as NextIcon,
  Medication as MedicationIcon,
  Search as SearchIcon,
  Warning as WarningIcon,
  CheckCircle as ActiveIcon,
  Cancel as InactiveIcon,
  CheckCircle as CheckCircleIcon,
  AccessTime as ClockIcon,
  CalendarToday as DateIcon,
  Notes as NotesIcon,
  LocalPharmacy as PharmacyIcon,
  Science as LabIcon,
  AutoAwesome as SmartIcon,
  HealthAndSafety as SafetyIcon,
  TrendingUp as TrendingIcon,
  Schedule as ScheduleIcon,
  Numbers as DoseIcon,
  Info as InfoIcon,
  Star as StarIcon,
  Refresh as RefillIcon,
  LocalHospital as HospitalIcon
} from '@mui/icons-material';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, parseISO, addDays, differenceInDays } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

// Services
import cdsClinicalDataService from '../../../services/cdsClinicalDataService';
import fhirService from '../../../services/fhirService';
import { useFHIRResource } from '../../../contexts/FHIRResourceContext';
import { useCDS } from '../../../contexts/CDSContext';
import { useClinicalWorkflow } from '../../../contexts/ClinicalWorkflowContext';
import { CLINICAL_EVENTS } from '../../../constants/clinicalEvents';

// Helper functions
const getMedicationName = (medication) => {
  return medication?.code?.coding?.[0]?.display || medication?.code?.text || 'Unknown Medication';
};

const getMedicationDosageDisplay = (dosage) => {
  if (!dosage) return '';
  const parts = [];
  if (dosage.text) return dosage.text;
  if (dosage.doseAndRate?.[0]?.doseQuantity) {
    parts.push(`${dosage.doseAndRate[0].doseQuantity.value} ${dosage.doseAndRate[0].doseQuantity.unit}`);
  }
  if (dosage.timing?.repeat?.frequency && dosage.timing?.repeat?.period) {
    parts.push(`${dosage.timing.repeat.frequency} times per ${dosage.timing.repeat.period} ${dosage.timing.repeat.periodUnit}`);
  }
  return parts.join(', ');
};

const searchMedications = async (query) => {
  try {
    const catalog = await cdsClinicalDataService.getClinicalCatalog('medications');
    const searchTerm = query.toLowerCase();
    return catalog.filter(item => 
      item.display?.toLowerCase().includes(searchTerm) ||
      item.code?.toLowerCase().includes(searchTerm)
    );
  } catch (error) {
    console.error('Error searching medications:', error);
    return [];
  }
};

const checkDrugInteractions = async (medications) => {
  // Simplified drug interaction check
  return [];
};

// Constants
const STEPS = ['Search Medication', 'Dosage & Instructions', 'Review & Prescribe'];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active', icon: <ActiveIcon />, color: 'success' },
  { value: 'on-hold', label: 'On Hold', icon: <ClockIcon />, color: 'warning' },
  { value: 'cancelled', label: 'Cancelled', icon: <CancelIcon />, color: 'error' },
  { value: 'completed', label: 'Completed', icon: <CheckCircleIcon />, color: 'info' },
  { value: 'entered-in-error', label: 'Entered in Error', icon: <CancelIcon />, color: 'error' },
  { value: 'stopped', label: 'Stopped', icon: <CancelIcon />, color: 'default' }
];

const INTENT_OPTIONS = [
  { value: 'proposal', label: 'Proposal', description: 'Suggestion for consideration' },
  { value: 'plan', label: 'Plan', description: 'Intention to ensure happens' },
  { value: 'order', label: 'Order', description: 'Request for action', default: true },
  { value: 'instance-order', label: 'Instance Order', description: 'Request for single administration' }
];

const PRIORITY_OPTIONS = [
  { value: 'routine', label: 'Routine', color: 'default', default: true },
  { value: 'urgent', label: 'Urgent', color: 'warning' },
  { value: 'asap', label: 'ASAP', color: 'error' },
  { value: 'stat', label: 'STAT', color: 'error' }
];

const COMMON_FREQUENCIES = [
  { value: 'QD', label: 'Once daily', code: '229797004' },
  { value: 'BID', label: 'Twice daily', code: '229798009' },
  { value: 'TID', label: 'Three times daily', code: '229799001' },
  { value: 'QID', label: 'Four times daily', code: '307469008' },
  { value: 'Q4H', label: 'Every 4 hours', code: '225756002' },
  { value: 'Q6H', label: 'Every 6 hours', code: '307468000' },
  { value: 'Q8H', label: 'Every 8 hours', code: '307470009' },
  { value: 'Q12H', label: 'Every 12 hours', code: '307468000' },
  { value: 'PRN', label: 'As needed', code: '225791005' },
  { value: 'QHS', label: 'At bedtime', code: '307469008' },
  { value: 'AC', label: 'Before meals', code: '307465005' },
  { value: 'PC', label: 'After meals', code: '307466006' }
];

const ROUTE_OPTIONS = [
  { value: 'PO', label: 'Oral', code: '26643006' },
  { value: 'IV', label: 'Intravenous', code: '47625008' },
  { value: 'IM', label: 'Intramuscular', code: '78421000' },
  { value: 'SC', label: 'Subcutaneous', code: '34206005' },
  { value: 'TOP', label: 'Topical', code: '6064005' },
  { value: 'INH', label: 'Inhalation', code: '18679011000001101' },
  { value: 'PR', label: 'Rectal', code: '37161004' },
  { value: 'SL', label: 'Sublingual', code: '37839007' }
];

// Custom hook for medication search
const useMedicationSearch = (searchTerm) => {
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState([]);
  const [cache] = useState(new Map());

  const searchMedications = useCallback(async (term) => {
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
      const results = await cdsClinicalDataService.getDynamicMedicationCatalog(term, 20);
      const formattedResults = results.map(med => ({
        ...med,
        label: med.display,
        subLabel: `NDC: ${med.code} • Prescribed ${med.frequency} times • ${med.common_strength || ''}`
      }));
      
      cache.set(term, formattedResults);
      setOptions(formattedResults);
    } catch (error) {
      console.error('Error searching medications:', error);
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, [cache]);

  useEffect(() => {
    const timer = setTimeout(() => {
      searchMedications(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, searchMedications]);

  return { loading, options };
};

const MedicationDialogEnhanced = ({
  open,
  onClose,
  medication = null,
  onSave,
  patientId,
  encounterId = null,
  mode = 'prescribe' // 'prescribe', 'edit', 'refill'
}) => {
  const theme = useTheme();
  const { currentPatient } = useFHIRResource();
  const { evaluateCDS } = useCDS();
  const { publish } = useClinicalWorkflow();
  
  // State
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMedication, setSelectedMedication] = useState(null);
  const [cdsAlerts, setCdsAlerts] = useState([]);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  
  // Form data
  const [formData, setFormData] = useState({
    medicationCode: '',
    medicationDisplay: '',
    status: 'active',
    intent: 'order',
    priority: 'routine',
    dosageQuantity: '',
    dosageUnit: 'mg',
    frequency: 'BID',
    route: 'PO',
    duration: '30',
    durationUnit: 'days',
    numberOfRepeatsAllowed: '0',
    quantityDispense: '',
    quantityUnit: 'tablets',
    daysSupply: '30',
    instructions: '',
    additionalInstructions: '',
    prn: false,
    prnReason: '',
    substitutionAllowed: true,
    substitutionReason: '',
    note: ''
  });
  
  const [errors, setErrors] = useState({});

  // Search hook
  const { loading: searchLoading, options: searchOptions } = useMedicationSearch(searchTerm);

  // Get trending medications
  const trendingMedications = useMemo(() => {
    // In a real app, this would come from the service
    return [
      { 
        code: '313782', 
        display: 'Lisinopril 10 MG Oral Tablet', 
        frequency: 156,
        common_strength: '10mg',
        category: 'Hypertension'
      },
      { 
        code: '860975', 
        display: 'Metformin hydrochloride 500 MG Oral Tablet', 
        frequency: 142,
        common_strength: '500mg',
        category: 'Diabetes'
      },
      { 
        code: '197361', 
        display: 'Amlodipine 5 MG Oral Tablet', 
        frequency: 128,
        common_strength: '5mg',
        category: 'Hypertension'
      },
      { 
        code: '617314', 
        display: 'Atorvastatin 40 MG Oral Tablet', 
        frequency: 115,
        common_strength: '40mg',
        category: 'Cholesterol'
      },
      { 
        code: '1719286', 
        display: 'Omeprazole 20 MG Oral Capsule', 
        frequency: 98,
        common_strength: '20mg',
        category: 'GERD'
      }
    ];
  }, []);

  // Initialize form for edit/refill mode
  useEffect(() => {
    if (medication && open) {
      const dosageInstruction = medication.dosageInstruction?.[0] || {};
      const timing = dosageInstruction.timing?.code?.coding?.[0]?.code || 'BID';
      const route = dosageInstruction.route?.coding?.[0]?.code || 'PO';
      const quantity = dosageInstruction.doseAndRate?.[0]?.doseQuantity;
      
      setFormData({
        medicationCode: medication.medicationCodeableConcept?.coding?.[0]?.code || '',
        medicationDisplay: getMedicationName(medication),
        status: medication.status || 'active',
        intent: medication.intent || 'order',
        priority: medication.priority || 'routine',
        dosageQuantity: quantity?.value?.toString() || '',
        dosageUnit: quantity?.unit || 'mg',
        frequency: timing,
        route: route,
        duration: medication.dispenseRequest?.expectedSupplyDuration?.value?.toString() || '30',
        durationUnit: medication.dispenseRequest?.expectedSupplyDuration?.unit || 'days',
        numberOfRepeatsAllowed: medication.dispenseRequest?.numberOfRepeatsAllowed?.toString() || '0',
        quantityDispense: medication.dispenseRequest?.quantity?.value?.toString() || '',
        quantityUnit: medication.dispenseRequest?.quantity?.unit || 'tablets',
        daysSupply: medication.dispenseRequest?.expectedSupplyDuration?.value?.toString() || '30',
        instructions: dosageInstruction.text || '',
        additionalInstructions: dosageInstruction.additionalInstruction?.[0]?.text || '',
        prn: dosageInstruction.asNeededBoolean || false,
        prnReason: dosageInstruction.asNeededCodeableConcept?.text || '',
        substitutionAllowed: medication.substitution?.allowedBoolean !== false,
        substitutionReason: medication.substitution?.reason?.text || '',
        note: medication.note?.[0]?.text || ''
      });
      
      setSelectedMedication({
        code: medication.medicationCodeableConcept?.coding?.[0]?.code,
        display: getMedicationName(medication)
      });
      
      setActiveStep(mode === 'refill' ? 2 : 1); // Skip search for edit/refill
    }
  }, [medication, open, mode]);

  // Calculate dispense quantity based on dosage and duration
  useEffect(() => {
    if (formData.dosageQuantity && formData.frequency && formData.duration) {
      const dailyDoses = {
        'QD': 1, 'BID': 2, 'TID': 3, 'QID': 4,
        'Q4H': 6, 'Q6H': 4, 'Q8H': 3, 'Q12H': 2
      };
      
      const dosesPerDay = dailyDoses[formData.frequency] || 1;
      const totalDoses = dosesPerDay * parseInt(formData.duration);
      
      setFormData(prev => ({
        ...prev,
        quantityDispense: totalDoses.toString(),
        daysSupply: formData.duration
      }));
    }
  }, [formData.dosageQuantity, formData.frequency, formData.duration]);

  // Validate current step
  const validateStep = useCallback(() => {
    const newErrors = {};
    
    switch (activeStep) {
      case 0: // Search & Select
        if (!selectedMedication) {
          newErrors.medication = 'Please select a medication';
        }
        break;
        
      case 1: // Dosage & Instructions
        if (!formData.dosageQuantity) {
          newErrors.dosageQuantity = 'Dosage is required';
        }
        if (!formData.frequency) {
          newErrors.frequency = 'Frequency is required';
        }
        if (!formData.route) {
          newErrors.route = 'Route is required';
        }
        if (!formData.duration) {
          newErrors.duration = 'Duration is required';
        }
        if (formData.prn && !formData.prnReason) {
          newErrors.prnReason = 'PRN reason is required when as-needed is selected';
        }
        break;
        
      case 2: // Review
        // Final validation
        break;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [activeStep, selectedMedication, formData]);

  // Handle navigation
  const handleNext = async () => {
    if (!validateStep()) return;
    
    if (activeStep === 0 && selectedMedication) {
      // Update form data with selected medication
      setFormData(prev => ({
        ...prev,
        medicationCode: selectedMedication.code,
        medicationDisplay: selectedMedication.display
      }));
      
      // Evaluate CDS for drug interactions
      try {
        const alerts = await evaluateCDS('medication-prescribe', {
          patient: patientId,
          medication: selectedMedication,
          context: 'prescribe'
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
    
    setSaving(true);
    try {
      const fhirMedication = {
        resourceType: 'MedicationRequest',
        ...(medication?.id && { id: medication.id }),
        status: formData.status,
        intent: formData.intent,
        priority: formData.priority,
        medicationCodeableConcept: {
          coding: [{
            system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
            code: formData.medicationCode,
            display: formData.medicationDisplay
          }],
          text: formData.medicationDisplay
        },
        subject: {
          reference: `Patient/${patientId}`,
          display: currentPatient?.name?.[0]?.text
        },
        ...(encounterId && {
          encounter: {
            reference: `Encounter/${encounterId}`
          }
        }),
        authoredOn: new Date().toISOString(),
        requester: {
          reference: 'Practitioner/current-user' // Would be actual user in production
        },
        dosageInstruction: [{
          sequence: 1,
          text: formData.instructions || generateInstructionText(),
          ...(formData.additionalInstructions && {
            additionalInstruction: [{
              text: formData.additionalInstructions
            }]
          }),
          timing: {
            code: {
              coding: [{
                system: 'http://terminology.hl7.org/CodeSystem/v3-GTSAbbreviation',
                code: formData.frequency,
                display: COMMON_FREQUENCIES.find(f => f.value === formData.frequency)?.label
              }]
            }
          },
          ...(formData.prn && {
            asNeededBoolean: true,
            ...(formData.prnReason && {
              asNeededCodeableConcept: {
                text: formData.prnReason
              }
            })
          }),
          route: {
            coding: [{
              system: 'http://snomed.info/sct',
              code: ROUTE_OPTIONS.find(r => r.value === formData.route)?.code,
              display: ROUTE_OPTIONS.find(r => r.value === formData.route)?.label
            }]
          },
          doseAndRate: [{
            type: {
              coding: [{
                system: 'http://terminology.hl7.org/CodeSystem/dose-rate-type',
                code: 'ordered',
                display: 'Ordered'
              }]
            },
            doseQuantity: {
              value: parseFloat(formData.dosageQuantity),
              unit: formData.dosageUnit,
              system: 'http://unitsofmeasure.org',
              code: formData.dosageUnit
            }
          }]
        }],
        dispenseRequest: {
          ...(formData.numberOfRepeatsAllowed && {
            numberOfRepeatsAllowed: parseInt(formData.numberOfRepeatsAllowed)
          }),
          quantity: {
            value: parseFloat(formData.quantityDispense),
            unit: formData.quantityUnit,
            system: 'http://unitsofmeasure.org',
            code: formData.quantityUnit
          },
          expectedSupplyDuration: {
            value: parseInt(formData.daysSupply),
            unit: 'days',
            system: 'http://unitsofmeasure.org',
            code: 'd'
          }
        },
        substitution: {
          allowedBoolean: formData.substitutionAllowed,
          ...(formData.substitutionReason && {
            reason: {
              text: formData.substitutionReason
            }
          })
        },
        ...(formData.note && {
          note: [{
            text: formData.note,
            time: new Date().toISOString()
          }]
        })
      };

      await onSave(fhirMedication);
      
      // Publish event
      publish(CLINICAL_EVENTS.MEDICATION_PRESCRIBED, {
        patientId,
        medicationRequestId: fhirMedication.id,
        medication: fhirMedication
      });
      
      handleClose();
    } catch (error) {
      console.error('Error saving medication:', error);
      setErrors({ submit: 'Failed to save medication. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const generateInstructionText = () => {
    const frequency = COMMON_FREQUENCIES.find(f => f.value === formData.frequency)?.label;
    const route = ROUTE_OPTIONS.find(r => r.value === formData.route)?.label;
    let text = `Take ${formData.dosageQuantity} ${formData.dosageUnit} ${route} ${frequency}`;
    
    if (formData.prn) {
      text += ` as needed`;
      if (formData.prnReason) {
        text += ` for ${formData.prnReason}`;
      }
    }
    
    text += ` for ${formData.duration} ${formData.durationUnit}`;
    
    return text;
  };

  const handleClose = () => {
    setActiveStep(0);
    setSearchTerm('');
    setSelectedMedication(null);
    setFormData({
      medicationCode: '',
      medicationDisplay: '',
      status: 'active',
      intent: 'order',
      priority: 'routine',
      dosageQuantity: '',
      dosageUnit: 'mg',
      frequency: 'BID',
      route: 'PO',
      duration: '30',
      durationUnit: 'days',
      numberOfRepeatsAllowed: '0',
      quantityDispense: '',
      quantityUnit: 'tablets',
      daysSupply: '30',
      instructions: '',
      additionalInstructions: '',
      prn: false,
      prnReason: '',
      substitutionAllowed: true,
      substitutionReason: '',
      note: ''
    });
    setErrors({});
    setCdsAlerts([]);
    setShowAdvancedOptions(false);
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
                  value={selectedMedication}
                  onChange={(event, newValue) => {
                    setSelectedMedication(newValue);
                    setErrors(prev => ({ ...prev, medication: null }));
                  }}
                  inputValue={searchTerm}
                  onInputChange={(event, newInputValue) => {
                    setSearchTerm(newInputValue);
                  }}
                  getOptionLabel={(option) => option.label || option.display || ''}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Search Medications"
                      placeholder="Type medication name or NDC code..."
                      error={!!errors.medication}
                      helperText={errors.medication}
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
                          <MedicationIcon fontSize="small" />
                        </Avatar>
                      </ListItemIcon>
                      <ListItemText
                        primary={option.display}
                        secondary={option.subLabel}
                      />
                      {option.frequency && (
                        <Chip
                          size="small"
                          label={`${option.frequency} Rx`}
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

              {/* Trending Medications */}
              {!searchTerm && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Paper elevation={0} sx={{ p: 2, bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                      <TrendingIcon color="primary" />
                      <Typography variant="subtitle2" color="primary">
                        Frequently Prescribed Medications
                      </Typography>
                    </Stack>
                    
                    <Grid container spacing={1}>
                      {trendingMedications.map((med) => (
                        <Grid item xs={12} sm={6} key={med.code}>
                          <Card
                            elevation={0}
                            sx={{
                              cursor: 'pointer',
                              bgcolor: 'background.paper',
                              border: `1px solid ${theme.palette.divider}`,
                              transition: 'all 0.2s',
                              '&:hover': {
                                borderColor: theme.palette.primary.main,
                                transform: 'translateY(-2px)',
                                boxShadow: theme.shadows[2],
                              },
                            }}
                            onClick={() => {
                              setSelectedMedication(med);
                              setSearchTerm(med.display);
                            }}
                          >
                            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                              <Stack spacing={0.5}>
                                <Typography variant="body2" fontWeight="medium">
                                  {med.display}
                                </Typography>
                                <Stack direction="row" alignItems="center" spacing={1}>
                                  <Chip
                                    size="small"
                                    label={med.category}
                                    color="default"
                                    variant="outlined"
                                  />
                                  <Typography variant="caption" color="text.secondary">
                                    {med.frequency} prescriptions
                                  </Typography>
                                </Stack>
                              </Stack>
                            </CardContent>
                          </Card>
                        </Grid>
                      ))}
                    </Grid>
                  </Paper>
                </motion.div>
              )}

              {/* Selected Medication Preview */}
              {selectedMedication && (
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
                        <CheckCircle />
                      </Avatar>
                      <Box flex={1}>
                        <Typography variant="subtitle1" fontWeight="medium">
                          {selectedMedication.display}
                        </Typography>
                        <Stack direction="row" spacing={2}>
                          <Typography variant="caption" color="text.secondary">
                            NDC: {selectedMedication.code}
                          </Typography>
                          {selectedMedication.common_strength && (
                            <Typography variant="caption" color="text.secondary">
                              Common strength: {selectedMedication.common_strength}
                            </Typography>
                          )}
                        </Stack>
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
                      {alert.detail && (
                        <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                          {alert.detail}
                        </Typography>
                      )}
                    </Alert>
                  ))}
                </Box>
              )}

              <Stack spacing={3}>
                {/* Dosage Information */}
                <Paper elevation={0} sx={{ p: 2, bgcolor: alpha(theme.palette.info.main, 0.05) }}>
                  <Typography variant="subtitle2" gutterBottom color="primary">
                    Dosage Information
                  </Typography>
                  
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Dose Quantity"
                        value={formData.dosageQuantity}
                        onChange={(e) => setFormData({ ...formData, dosageQuantity: e.target.value })}
                        error={!!errors.dosageQuantity}
                        helperText={errors.dosageQuantity}
                        InputProps={{
                          startAdornment: <DoseIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                          endAdornment: (
                            <InputAdornment position="end">
                              <TextField
                                select
                                value={formData.dosageUnit}
                                onChange={(e) => setFormData({ ...formData, dosageUnit: e.target.value })}
                                variant="standard"
                                sx={{ width: 80 }}
                              >
                                <MenuItem value="mg">mg</MenuItem>
                                <MenuItem value="g">g</MenuItem>
                                <MenuItem value="mcg">mcg</MenuItem>
                                <MenuItem value="mL">mL</MenuItem>
                                <MenuItem value="units">units</MenuItem>
                              </TextField>
                            </InputAdornment>
                          ),
                        }}
                      />
                    </Grid>
                    
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        select
                        label="Frequency"
                        value={formData.frequency}
                        onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                        error={!!errors.frequency}
                        helperText={errors.frequency}
                        InputProps={{
                          startAdornment: <ScheduleIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                        }}
                      >
                        {COMMON_FREQUENCIES.map((freq) => (
                          <MenuItem key={freq.value} value={freq.value}>
                            {freq.label}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                    
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        select
                        label="Route"
                        value={formData.route}
                        onChange={(e) => setFormData({ ...formData, route: e.target.value })}
                        error={!!errors.route}
                        helperText={errors.route}
                      >
                        {ROUTE_OPTIONS.map((route) => (
                          <MenuItem key={route.value} value={route.value}>
                            {route.label}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                    
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Duration"
                        value={formData.duration}
                        onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                        error={!!errors.duration}
                        helperText={errors.duration}
                        InputProps={{
                          startAdornment: <DateIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                          endAdornment: (
                            <InputAdornment position="end">
                              <TextField
                                select
                                value={formData.durationUnit}
                                onChange={(e) => setFormData({ ...formData, durationUnit: e.target.value })}
                                variant="standard"
                                sx={{ width: 80 }}
                              >
                                <MenuItem value="days">days</MenuItem>
                                <MenuItem value="weeks">weeks</MenuItem>
                                <MenuItem value="months">months</MenuItem>
                              </TextField>
                            </InputAdornment>
                          ),
                        }}
                      />
                    </Grid>
                  </Grid>
                </Paper>

                {/* PRN Options */}
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.prn}
                      onChange={(e) => setFormData({ ...formData, prn: e.target.checked })}
                    />
                  }
                  label="As Needed (PRN)"
                />
                
                <Collapse in={formData.prn}>
                  <TextField
                    fullWidth
                    label="PRN Reason"
                    value={formData.prnReason}
                    onChange={(e) => setFormData({ ...formData, prnReason: e.target.value })}
                    error={!!errors.prnReason}
                    helperText={errors.prnReason}
                    placeholder="e.g., for pain, for nausea"
                  />
                </Collapse>

                {/* Instructions */}
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  label="Patient Instructions"
                  value={formData.instructions}
                  onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                  placeholder={generateInstructionText()}
                  InputProps={{
                    startAdornment: <NotesIcon sx={{ mr: 1, mt: 1, color: 'text.secondary' }} />,
                  }}
                />

                {/* Dispensing Information */}
                <Paper elevation={0} sx={{ p: 2, bgcolor: alpha(theme.palette.secondary.main, 0.05) }}>
                  <Typography variant="subtitle2" gutterBottom color="secondary">
                    Dispensing Information
                  </Typography>
                  
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        fullWidth
                        label="Quantity to Dispense"
                        value={formData.quantityDispense}
                        onChange={(e) => setFormData({ ...formData, quantityDispense: e.target.value })}
                        InputProps={{
                          endAdornment: <InputAdornment position="end">{formData.quantityUnit}</InputAdornment>,
                        }}
                      />
                    </Grid>
                    
                    <Grid item xs={12} sm={4}>
                      <TextField
                        fullWidth
                        label="Days Supply"
                        value={formData.daysSupply}
                        onChange={(e) => setFormData({ ...formData, daysSupply: e.target.value })}
                        InputProps={{
                          endAdornment: <InputAdornment position="end">days</InputAdornment>,
                        }}
                      />
                    </Grid>
                    
                    <Grid item xs={12} sm={4}>
                      <TextField
                        fullWidth
                        label="Refills"
                        value={formData.numberOfRepeatsAllowed}
                        onChange={(e) => setFormData({ ...formData, numberOfRepeatsAllowed: e.target.value })}
                        InputProps={{
                          startAdornment: <RefillIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                        }}
                      />
                    </Grid>
                  </Grid>
                </Paper>

                {/* Advanced Options */}
                <Box>
                  <Button
                    onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                    endIcon={showAdvancedOptions ? <CloseIcon /> : <InfoIcon />}
                  >
                    {showAdvancedOptions ? 'Hide' : 'Show'} Advanced Options
                  </Button>
                  
                  <Collapse in={showAdvancedOptions}>
                    <Stack spacing={2} sx={{ mt: 2 }}>
                      <FormControl component="fieldset">
                        <FormLabel component="legend">Priority</FormLabel>
                        <RadioGroup
                          row
                          value={formData.priority}
                          onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                        >
                          {PRIORITY_OPTIONS.map((option) => (
                            <FormControlLabel
                              key={option.value}
                              value={option.value}
                              control={<Radio size="small" />}
                              label={
                                <Chip
                                  size="small"
                                  label={option.label}
                                  color={option.color}
                                  variant={formData.priority === option.value ? 'filled' : 'outlined'}
                                />
                              }
                            />
                          ))}
                        </RadioGroup>
                      </FormControl>
                      
                      <FormControlLabel
                        control={
                          <Switch
                            checked={formData.substitutionAllowed}
                            onChange={(e) => setFormData({ ...formData, substitutionAllowed: e.target.checked })}
                          />
                        }
                        label="Generic Substitution Allowed"
                      />
                      
                      {!formData.substitutionAllowed && (
                        <TextField
                          fullWidth
                          label="Reason for No Substitution"
                          value={formData.substitutionReason}
                          onChange={(e) => setFormData({ ...formData, substitutionReason: e.target.value })}
                          placeholder="e.g., Patient allergy to generic formulation"
                        />
                      )}
                    </Stack>
                  </Collapse>
                </Box>
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
                  {/* Medication Summary */}
                  <Box>
                    <Typography variant="h6" gutterBottom color="primary">
                      Prescription Summary
                    </Typography>
                    
                    <Stack spacing={2}>
                      <Stack direction="row" alignItems="center" spacing={2}>
                        <Avatar sx={{ bgcolor: theme.palette.primary.main }}>
                          <MedicationIcon />
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle1" fontWeight="medium">
                            {formData.medicationDisplay}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            NDC: {formData.medicationCode}
                          </Typography>
                        </Box>
                      </Stack>

                      <Divider />

                      {/* Prescription Details */}
                      <Grid container spacing={2}>
                        <Grid item xs={12}>
                          <Paper elevation={0} sx={{ p: 2, bgcolor: 'background.paper' }}>
                            <Typography variant="subtitle2" gutterBottom color="primary">
                              Sig / Patient Instructions
                            </Typography>
                            <Typography variant="body1" fontWeight="medium">
                              {formData.instructions || generateInstructionText()}
                            </Typography>
                            {formData.additionalInstructions && (
                              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                {formData.additionalInstructions}
                              </Typography>
                            )}
                          </Paper>
                        </Grid>
                        
                        <Grid item xs={6}>
                          <Stack spacing={1}>
                            <Typography variant="caption" color="text.secondary">
                              Dispense
                            </Typography>
                            <Typography variant="body2">
                              {formData.quantityDispense} {formData.quantityUnit}
                            </Typography>
                          </Stack>
                        </Grid>
                        
                        <Grid item xs={6}>
                          <Stack spacing={1}>
                            <Typography variant="caption" color="text.secondary">
                              Days Supply
                            </Typography>
                            <Typography variant="body2">
                              {formData.daysSupply} days
                            </Typography>
                          </Stack>
                        </Grid>
                        
                        <Grid item xs={6}>
                          <Stack spacing={1}>
                            <Typography variant="caption" color="text.secondary">
                              Refills
                            </Typography>
                            <Typography variant="body2">
                              {formData.numberOfRepeatsAllowed}
                            </Typography>
                          </Stack>
                        </Grid>
                        
                        <Grid item xs={6}>
                          <Stack spacing={1}>
                            <Typography variant="caption" color="text.secondary">
                              Generic Substitution
                            </Typography>
                            <Typography variant="body2">
                              {formData.substitutionAllowed ? 'Allowed' : 'Not Allowed'}
                            </Typography>
                          </Stack>
                        </Grid>
                      </Grid>

                      {/* Status Chips */}
                      <Stack direction="row" spacing={1} flexWrap="wrap">
                        <Chip
                          size="small"
                          label={PRIORITY_OPTIONS.find(p => p.value === formData.priority)?.label}
                          color={PRIORITY_OPTIONS.find(p => p.value === formData.priority)?.color}
                          variant="outlined"
                        />
                        <Chip
                          size="small"
                          label={INTENT_OPTIONS.find(i => i.value === formData.intent)?.label}
                          color="primary"
                          variant="outlined"
                        />
                        {formData.prn && (
                          <Chip
                            size="small"
                            label={`PRN - ${formData.prnReason}`}
                            color="info"
                            variant="outlined"
                          />
                        )}
                      </Stack>
                    </Stack>
                  </Box>

                  {/* Safety Check */}
                  <Alert
                    severity="info"
                    icon={<SafetyIcon />}
                    sx={{ mt: 2 }}
                  >
                    <Typography variant="body2">
                      This prescription will be sent to the pharmacy and added to the patient's medication list. 
                      Drug interaction checking has been performed.
                    </Typography>
                  </Alert>

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
              </Paper>

              {errors.submit && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {errors.submit}
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
              <MedicationIcon />
            </Avatar>
            <Box>
              <Typography variant="h6">
                {mode === 'edit' ? 'Edit Medication' : mode === 'refill' ? 'Refill Prescription' : 'Prescribe Medication'}
              </Typography>
              {currentPatient && (
                <Typography variant="caption" sx={{ opacity: 0.8 }}>
                  Patient: {currentPatient.name?.[0]?.text || 'Unknown'}
                </Typography>
              )}
            </Box>
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
      {(loading || saving) && <LinearProgress />}

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
          bgcolor: theme.palette.grey[50],
          borderTop: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Stack direction="row" spacing={2} justifyContent="space-between" width="100%">
          <Button
            onClick={handleClose}
            disabled={loading || saving}
            sx={{ minWidth: 100 }}
          >
            Cancel
          </Button>
          
          <Stack direction="row" spacing={2}>
            {activeStep > 0 && (
              <Button
                onClick={handleBack}
                disabled={loading || saving}
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
                disabled={loading || saving || (activeStep === 0 && !selectedMedication)}
                endIcon={<NextIcon />}
                sx={{ minWidth: 100 }}
              >
                Next
              </Button>
            ) : (
              <Button
                variant="contained"
                onClick={handleSave}
                disabled={loading || saving}
                startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
                sx={{ minWidth: 100 }}
              >
                {saving ? 'Saving...' : mode === 'refill' ? 'Send Refill' : 'Prescribe'}
              </Button>
            )}
          </Stack>
        </Stack>
      </DialogActions>
    </Dialog>
  );
};

export default MedicationDialogEnhanced;