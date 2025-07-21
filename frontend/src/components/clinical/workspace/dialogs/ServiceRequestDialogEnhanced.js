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
  Badge,
} from '@mui/material';
import {
  Close as CloseIcon,
  Search as SearchIcon,
  Assignment as ServiceIcon,
  Event as EventIcon,
  LocationOn as LocationIcon,
  Person as PersonIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Info as InfoIcon,
  Schedule as ScheduleIcon,
  Description as DescriptionIcon,
  CalendarToday as CalendarIcon,
  Biotech as LabIcon,
  LocalHospital as HospitalIcon,
  Science as DiagnosticIcon,
  CameraAlt as ImagingIcon,
  Healing as TherapyIcon,
  MedicalServices as ConsultIcon,
  LocalPharmacy as PharmacyIcon,
  TrendingUp as TrendingUpIcon,
  AccessTime as UrgentIcon,
  Timer as RoutineIcon,
  Bolt as StatIcon,
  VerifiedUser as VerifiedIcon,
  AttachMoney as CostIcon,
  Security as InsuranceIcon,
  Flag as PriorityIcon,
} from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, addDays, differenceInHours } from 'date-fns';
import { debounce } from 'lodash';

import { useFHIRClient } from '../../../../contexts/FHIRContext';
import { useClinical as useClinicalContext } from '../../../../contexts/ClinicalContext';
import { useClinicalWorkflow } from '../../../../contexts/ClinicalWorkflowContext';
import { CLINICAL_EVENTS } from '../../../../constants/clinicalEvents';
import { fhirClient } from '../../../../core/fhir/services/fhirClient';
import cdsClinicalDataService from '../../../../services/cdsClinicalDataService';

const searchServiceRequests = async (query) => {
  try {
    // Search for services from existing ServiceRequest resources
    const searchParams = {
      _count: 100,
      _sort: '-authored'
    };
    
    if (query) {
      searchParams._text = query;
    }
    
    const bundle = await fhirClient.search('ServiceRequest', searchParams);
    const requests = bundle.entry?.map(entry => entry.resource) || [];
    
    // Extract unique services
    const serviceMap = new Map();
    
    requests.forEach(request => {
      if (request.code?.coding) {
        request.code.coding.forEach(coding => {
          const key = coding.code || coding.display;
          if (key && !serviceMap.has(key)) {
            serviceMap.set(key, {
              code: coding.code,
              display: coding.display || request.code.text || 'Unknown Service',
              system: coding.system
            });
          }
        });
      }
    });
    
    // Add common service requests if search is empty or general
    if (!query || query.length < 3) {
      const commonServices = [
        { code: '387713003', display: 'Surgical procedure', system: 'http://snomed.info/sct' },
        { code: '363679005', display: 'Imaging', system: 'http://snomed.info/sct' },
        { code: '409073007', display: 'Education', system: 'http://snomed.info/sct' },
        { code: '386053000', display: 'Evaluation procedure', system: 'http://snomed.info/sct' },
        { code: '108252007', display: 'Laboratory procedure', system: 'http://snomed.info/sct' },
        { code: '71388002', display: 'Procedure', system: 'http://snomed.info/sct' }
      ];
      
      commonServices.forEach(service => {
        if (!serviceMap.has(service.code)) {
          serviceMap.set(service.code, service);
        }
      });
    }
    
    // Also search lab catalog since lab tests are often ordered as service requests
    try {
      const labTests = await cdsClinicalDataService.getLabCatalog(query, null, 10);
      labTests.forEach(test => {
        if (!serviceMap.has(test.code)) {
          serviceMap.set(test.code, {
            code: test.code,
            display: test.display || test.name,
            system: test.system || 'http://loinc.org'
          });
        }
      });
    } catch (error) {
      // Ignore errors from lab catalog
    }
    
    // Convert to array and filter by query if provided
    let results = Array.from(serviceMap.values());
    
    if (query) {
      const searchTerm = query.toLowerCase();
      results = results.filter(item => 
        item.display?.toLowerCase().includes(searchTerm) ||
        item.code?.toLowerCase().includes(searchTerm)
      );
    }
    
    return results.slice(0, 20); // Limit results
  } catch (error) {
    console.error('Error searching service requests:', error);
    return [];
  }
};

// Service request status options
const SERVICE_STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft', color: 'default' },
  { value: 'active', label: 'Active', color: 'primary' },
  { value: 'on-hold', label: 'On Hold', color: 'warning' },
  { value: 'revoked', label: 'Revoked', color: 'error' },
  { value: 'completed', label: 'Completed', color: 'success' },
  { value: 'entered-in-error', label: 'Entered in Error', color: 'error' },
  { value: 'unknown', label: 'Unknown', color: 'default' },
];

// Service request intent options
const INTENT_OPTIONS = [
  { value: 'proposal', label: 'Proposal', description: 'Suggestion made', icon: <InfoIcon /> },
  { value: 'plan', label: 'Plan', description: 'Intention to ensure it happens', icon: <ScheduleIcon /> },
  { value: 'directive', label: 'Directive', description: 'Authorized directive', icon: <VerifiedIcon /> },
  { value: 'order', label: 'Order', description: 'Request to be acted upon', icon: <CheckCircleIcon />, default: true },
  { value: 'original-order', label: 'Original Order', description: 'First authorization', icon: <ServiceIcon /> },
  { value: 'reflex-order', label: 'Reflex Order', description: 'Automatic follow-up', icon: <TrendingUpIcon /> },
  { value: 'filler-order', label: 'Filler Order', description: 'Order for fulfillment', icon: <AssignmentIcon /> },
  { value: 'instance-order', label: 'Instance Order', description: 'Order for specific instance', icon: <EventIcon /> },
];

// Priority options
const PRIORITY_OPTIONS = [
  { value: 'routine', label: 'Routine', color: 'default', icon: <RoutineIcon />, description: 'Normal priority' },
  { value: 'urgent', label: 'Urgent', color: 'warning', icon: <UrgentIcon />, description: 'Higher priority' },
  { value: 'asap', label: 'ASAP', color: 'error', icon: <WarningIcon />, description: 'As soon as possible' },
  { value: 'stat', label: 'STAT', color: 'error', icon: <StatIcon />, description: 'Immediate' },
];

// Common service categories
const SERVICE_CATEGORIES = [
  { id: 'lab', name: 'Laboratory', icon: <LabIcon />, color: '#2196F3' },
  { id: 'imaging', name: 'Imaging', icon: <ImagingIcon />, color: '#9C27B0' },
  { id: 'diagnostic', name: 'Diagnostic', icon: <DiagnosticIcon />, color: '#4CAF50' },
  { id: 'consult', name: 'Consultation', icon: <ConsultIcon />, color: '#FF9800' },
  { id: 'therapy', name: 'Therapy', icon: <TherapyIcon />, color: '#F44336' },
  { id: 'pharmacy', name: 'Pharmacy', icon: <PharmacyIcon />, color: '#00BCD4' },
  { id: 'procedure', name: 'Procedure', icon: <HospitalIcon />, color: '#795548' },
];

// Common service requests
const COMMON_SERVICES = [
  // Laboratory
  { code: 'CBC', display: 'Complete Blood Count', category: 'lab', priority: 'routine' },
  { code: 'CMP', display: 'Comprehensive Metabolic Panel', category: 'lab', priority: 'routine' },
  { code: 'BMP', display: 'Basic Metabolic Panel', category: 'lab', priority: 'routine' },
  { code: 'LIPID', display: 'Lipid Panel', category: 'lab', priority: 'routine' },
  { code: 'HBA1C', display: 'Hemoglobin A1c', category: 'lab', priority: 'routine' },
  { code: 'TSH', display: 'Thyroid Stimulating Hormone', category: 'lab', priority: 'routine' },
  { code: 'UA', display: 'Urinalysis', category: 'lab', priority: 'routine' },
  { code: 'PT/INR', display: 'Prothrombin Time/INR', category: 'lab', priority: 'urgent' },
  
  // Imaging
  { code: 'CXR', display: 'Chest X-Ray', category: 'imaging', priority: 'routine' },
  { code: 'CT-HEAD', display: 'CT Head without Contrast', category: 'imaging', priority: 'urgent' },
  { code: 'CT-CHEST', display: 'CT Chest with Contrast', category: 'imaging', priority: 'routine' },
  { code: 'MRI-BRAIN', display: 'MRI Brain with/without Contrast', category: 'imaging', priority: 'routine' },
  { code: 'US-ABD', display: 'Ultrasound Abdomen', category: 'imaging', priority: 'routine' },
  { code: 'ECHO', display: 'Echocardiogram', category: 'imaging', priority: 'routine' },
  
  // Consultations
  { code: 'CARDIO-CONSULT', display: 'Cardiology Consultation', category: 'consult', priority: 'routine' },
  { code: 'PULM-CONSULT', display: 'Pulmonology Consultation', category: 'consult', priority: 'routine' },
  { code: 'GI-CONSULT', display: 'Gastroenterology Consultation', category: 'consult', priority: 'routine' },
  { code: 'NEURO-CONSULT', display: 'Neurology Consultation', category: 'consult', priority: 'urgent' },
  { code: 'PSYCH-CONSULT', display: 'Psychiatry Consultation', category: 'consult', priority: 'routine' },
];

const ServiceRequestDialogEnhanced = ({
  open,
  onClose,
  serviceRequest = null,
  onSave,
  patientId,
  encounterId,
  mode = 'order', // 'order', 'edit', 'view'
}) => {
  const { patient } = useClinicalContext();
  const { publish } = useClinicalWorkflow();
  const fhirClient = useFHIRClient();

  // Dialog state
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [alerts, setAlerts] = useState([]);

  // Form state
  const [selectedService, setSelectedService] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [trendingServices, setTrendingServices] = useState([]);
  const [duplicateCheck, setDuplicateCheck] = useState([]);

  // Service request details
  const [formData, setFormData] = useState({
    status: 'active',
    intent: 'order',
    priority: 'routine',
    category: [],
    doNotPerform: false,
    authoredOn: new Date(),
    requester: '',
    performer: [],
    performerType: '',
    locationReference: '',
    reasonCode: [],
    reasonReference: [],
    insurance: [],
    supportingInfo: [],
    specimen: [],
    bodySite: [],
    note: '',
    patientInstruction: '',
    relevantHistory: [],
    occurrenceDateTime: null,
    occurrencePeriod: {
      start: null,
      end: null,
    },
    occurrenceTiming: {
      repeat: {
        frequency: 1,
        period: 1,
        periodUnit: 'day',
      },
    },
    asNeeded: false,
    asNeededCode: '',
  });

  // Load trending services on mount
  useEffect(() => {
    if (open && !serviceRequest) {
      loadTrendingServices();
      if (patient) {
        checkDuplicateRequests();
      }
    }
  }, [open, serviceRequest, patient]);

  // Load existing service request data
  useEffect(() => {
    if (serviceRequest) {
      // Parse existing service request into form data
      setFormData({
        status: serviceRequest.status || 'active',
        intent: serviceRequest.intent || 'order',
        priority: serviceRequest.priority || 'routine',
        category: serviceRequest.category || [],
        doNotPerform: serviceRequest.doNotPerform || false,
        authoredOn: serviceRequest.authoredOn ? new Date(serviceRequest.authoredOn) : new Date(),
        requester: serviceRequest.requester?.display || '',
        performer: serviceRequest.performer || [],
        performerType: serviceRequest.performerType?.coding?.[0]?.display || '',
        locationReference: serviceRequest.locationReference?.display || '',
        reasonCode: serviceRequest.reasonCode || [],
        reasonReference: serviceRequest.reasonReference || [],
        insurance: serviceRequest.insurance || [],
        supportingInfo: serviceRequest.supportingInfo || [],
        specimen: serviceRequest.specimen || [],
        bodySite: serviceRequest.bodySite || [],
        note: serviceRequest.note?.[0]?.text || '',
        patientInstruction: serviceRequest.patientInstruction || '',
        relevantHistory: serviceRequest.relevantHistory || [],
        occurrenceDateTime: serviceRequest.occurrenceDateTime ? new Date(serviceRequest.occurrenceDateTime) : null,
        occurrencePeriod: {
          start: serviceRequest.occurrencePeriod?.start ? new Date(serviceRequest.occurrencePeriod.start) : null,
          end: serviceRequest.occurrencePeriod?.end ? new Date(serviceRequest.occurrencePeriod.end) : null,
        },
        occurrenceTiming: serviceRequest.occurrenceTiming || {
          repeat: {
            frequency: 1,
            period: 1,
            periodUnit: 'day',
          },
        },
        asNeeded: serviceRequest.asNeededBoolean || false,
        asNeededCode: serviceRequest.asNeededCodeableConcept?.coding?.[0]?.code || '',
      });
      setSelectedService({
        code: serviceRequest.code?.coding?.[0]?.code,
        display: serviceRequest.code?.coding?.[0]?.display,
        system: serviceRequest.code?.coding?.[0]?.system,
      });
      setActiveStep(1); // Skip to details if editing
    }
  }, [serviceRequest]);

  // Load trending services from recent requests
  const loadTrendingServices = async () => {
    try {
      const recentRequests = await fhirClient.search('ServiceRequest', {
        _count: 100,
        _sort: '-authored',
        status: 'active,completed',
      });

      // Count service usage
      const serviceCount = {};
      recentRequests.entry?.forEach(entry => {
        const service = entry.resource.code?.coding?.[0];
        if (service) {
          const key = service.code || service.display;
          if (!serviceCount[key]) {
            serviceCount[key] = {
              ...service,
              count: 0,
              lastOrdered: entry.resource.authoredOn,
              category: entry.resource.category?.[0]?.coding?.[0]?.code,
              avgPriority: [],
            };
          }
          serviceCount[key].count++;
          serviceCount[key].avgPriority.push(entry.resource.priority);
        }
      });

      // Sort by frequency and get top 10
      const trending = Object.values(serviceCount)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      setTrendingServices(trending);
    } catch (error) {
      console.error('Error loading trending services:', error);
    }
  };

  // Check for duplicate service requests
  const checkDuplicateRequests = async () => {
    if (!selectedService) return;
    
    try {
      const recentRequests = await fhirClient.search('ServiceRequest', {
        patient: patientId,
        code: selectedService.code,
        status: 'active,on-hold',
        _count: 5,
      });

      if (recentRequests.entry?.length > 0) {
        const duplicates = recentRequests.entry.map(entry => ({
          id: entry.resource.id,
          authoredOn: entry.resource.authoredOn,
          status: entry.resource.status,
          priority: entry.resource.priority,
          requester: entry.resource.requester?.display,
        }));
        
        setDuplicateCheck(duplicates);
        
        if (duplicates.length > 0) {
          setAlerts([{
            severity: 'warning',
            message: `${duplicates.length} similar active service request(s) found. Please review before creating a duplicate.`,
          }]);
        }
      }
    } catch (error) {
      console.error('Error checking duplicates:', error);
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
        const results = await searchServiceRequests(query);
        // Add common services to search results
        const commonResults = COMMON_SERVICES.filter(service => 
          service.display.toLowerCase().includes(query.toLowerCase()) ||
          service.code.toLowerCase().includes(query.toLowerCase())
        );
        setSearchResults([...commonResults, ...results].slice(0, 15));
      } catch (error) {
        console.error('Error searching services:', error);
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

  // Handle service selection
  const handleServiceSelect = (service) => {
    setSelectedService(service);
    setSearchQuery(service.display);
    
    // Auto-populate category and priority based on service
    if (service.category) {
      setFormData(prev => ({
        ...prev,
        category: [{
          coding: [{
            system: 'http://snomed.info/sct',
            code: service.category,
            display: SERVICE_CATEGORIES.find(c => c.id === service.category)?.name,
          }],
        }],
        priority: service.priority || prev.priority,
      }));
    }
    
    // Check for duplicates
    checkDuplicateRequests();
    
    // Check for clinical guidance
    checkClinicalGuidance(service);
  };

  // Check for clinical guidance based on service
  const checkClinicalGuidance = async (service) => {
    const newAlerts = [];
    
    // Check if service requires fasting
    const fastingServices = ['LIPID', 'GLUCOSE', 'CMP'];
    if (fastingServices.includes(service.code)) {
      newAlerts.push({
        severity: 'info',
        message: 'This test typically requires fasting. Remember to include patient instructions.',
      });
    }
    
    // Check if service has special timing requirements
    if (service.code === 'PT/INR' && patient.medications?.some(med => med.code?.text?.toLowerCase().includes('warfarin'))) {
      newAlerts.push({
        severity: 'warning',
        message: 'Patient is on warfarin. Consider urgent priority for PT/INR monitoring.',
      });
    }
    
    // Check for contrast allergy for imaging
    if (service.display?.toLowerCase().includes('contrast')) {
      try {
        const allergies = await fhirClient.search('AllergyIntolerance', {
          patient: patientId,
          clinical_status: 'active',
        });
        
        const contrastAllergy = allergies.entry?.some(entry => 
          entry.resource.code?.coding?.some(c => 
            c.display?.toLowerCase().includes('contrast') ||
            c.display?.toLowerCase().includes('iodine')
          )
        );
        
        if (contrastAllergy) {
          newAlerts.push({
            severity: 'error',
            message: 'WARNING: Patient has documented contrast/iodine allergy!',
          });
        }
      } catch (error) {
        console.error('Error checking allergies:', error);
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
      case 0: // Service selection
        if (!selectedService) {
          newErrors.service = 'Please select a service';
        }
        break;
        
      case 1: // Service details
        if (!formData.status) {
          newErrors.status = 'Status is required';
        }
        if (!formData.intent) {
          newErrors.intent = 'Intent is required';
        }
        if (!formData.priority) {
          newErrors.priority = 'Priority is required';
        }
        if (!formData.requester) {
          newErrors.requester = 'Requester is required';
        }
        break;
        
      case 2: // Review
        // Final validation
        break;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Build FHIR ServiceRequest resource
  const buildFHIRResource = () => {
    const resource = {
      resourceType: 'ServiceRequest',
      status: formData.status,
      intent: formData.intent,
      priority: formData.priority,
      code: {
        coding: [{
          system: selectedService.system || 'http://snomed.info/sct',
          code: selectedService.code,
          display: selectedService.display,
        }],
      },
      subject: {
        reference: `Patient/${patientId}`,
        display: patient ? `${patient.name?.[0]?.given?.join(' ')} ${patient.name?.[0]?.family}` : undefined,
      },
      authoredOn: formData.authoredOn.toISOString(),
      doNotPerform: formData.doNotPerform,
    };
    
    // Add encounter reference if provided
    if (encounterId) {
      resource.encounter = {
        reference: `Encounter/${encounterId}`,
      };
    }
    
    // Add categories
    if (formData.category.length > 0) {
      resource.category = formData.category;
    }
    
    // Add requester
    if (formData.requester) {
      resource.requester = {
        display: formData.requester,
      };
    }
    
    // Add performer
    if (formData.performer.length > 0) {
      resource.performer = formData.performer.map(p => ({
        display: p,
      }));
    }
    
    // Add location
    if (formData.locationReference) {
      resource.locationReference = [{
        display: formData.locationReference,
      }];
    }
    
    // Add reason codes
    if (formData.reasonCode.length > 0) {
      resource.reasonCode = formData.reasonCode;
    }
    
    // Add occurrence timing
    if (formData.occurrenceDateTime) {
      resource.occurrenceDateTime = formData.occurrenceDateTime.toISOString();
    } else if (formData.occurrencePeriod.start) {
      resource.occurrencePeriod = {
        start: formData.occurrencePeriod.start.toISOString(),
      };
      if (formData.occurrencePeriod.end) {
        resource.occurrencePeriod.end = formData.occurrencePeriod.end.toISOString();
      }
    } else if (formData.occurrenceTiming.repeat.frequency) {
      resource.occurrenceTiming = formData.occurrenceTiming;
    }
    
    // Add as needed
    if (formData.asNeeded) {
      resource.asNeededBoolean = true;
      if (formData.asNeededCode) {
        resource.asNeededCodeableConcept = {
          coding: [{
            code: formData.asNeededCode,
          }],
        };
      }
    }
    
    // Add patient instructions
    if (formData.patientInstruction) {
      resource.patientInstruction = formData.patientInstruction;
    }
    
    // Add notes
    if (formData.note) {
      resource.note = [{
        text: formData.note,
        time: new Date().toISOString(),
      }];
    }
    
    // Preserve existing ID if editing
    if (serviceRequest?.id) {
      resource.id = serviceRequest.id;
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
      await publish(CLINICAL_EVENTS.SERVICE_REQUEST_CREATED, {
        patientId,
        serviceRequestId: fhirResource.id,
        service: selectedService.display,
        priority: formData.priority,
        status: formData.status,
        category: formData.category[0]?.coding?.[0]?.code,
      });
      
      // Close dialog
      handleClose();
    } catch (error) {
      console.error('Error saving service request:', error);
      setErrors({ submit: 'Failed to save service request. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  // Handle dialog close
  const handleClose = () => {
    // Reset form
    setActiveStep(0);
    setSelectedService(null);
    setSearchQuery('');
    setSearchResults([]);
    setDuplicateCheck([]);
    setFormData({
      status: 'active',
      intent: 'order',
      priority: 'routine',
      category: [],
      doNotPerform: false,
      authoredOn: new Date(),
      requester: '',
      performer: [],
      performerType: '',
      locationReference: '',
      reasonCode: [],
      reasonReference: [],
      insurance: [],
      supportingInfo: [],
      specimen: [],
      bodySite: [],
      note: '',
      patientInstruction: '',
      relevantHistory: [],
      occurrenceDateTime: null,
      occurrencePeriod: {
        start: null,
        end: null,
      },
      occurrenceTiming: {
        repeat: {
          frequency: 1,
          period: 1,
          periodUnit: 'day',
        },
      },
      asNeeded: false,
      asNeededCode: '',
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
              {/* Service Search */}
              <Box mb={3}>
                <Autocomplete
                  freeSolo
                  options={searchResults}
                  getOptionLabel={(option) => option.display || option}
                  value={selectedService}
                  onChange={(event, newValue) => {
                    if (typeof newValue === 'object' && newValue !== null) {
                      handleServiceSelect(newValue);
                    }
                  }}
                  inputValue={searchQuery}
                  onInputChange={handleSearchChange}
                  loading={searching}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Search Services"
                      placeholder="Type service name or code..."
                      error={!!errors.service}
                      helperText={errors.service}
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
                      <ServiceIcon sx={{ mr: 2, color: 'primary.main' }} />
                      <Box flex={1}>
                        <Typography variant="body1">{option.display}</Typography>
                        {option.code && (
                          <Typography variant="caption" color="text.secondary">
                            Code: {option.code}
                          </Typography>
                        )}
                      </Box>
                      {option.priority && (
                        <Chip
                          label={option.priority}
                          size="small"
                          color={option.priority === 'urgent' ? 'warning' : 'default'}
                        />
                      )}
                    </Box>
                  )}
                />
              </Box>

              {/* Service Categories */}
              <Box mb={3}>
                <Typography variant="subtitle2" gutterBottom>
                  Browse by Category
                </Typography>
                <Grid container spacing={1}>
                  {SERVICE_CATEGORIES.map((category) => (
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

              {/* Common Services Quick Select */}
              <Box mb={3}>
                <Typography variant="subtitle2" gutterBottom>
                  <TrendingUpIcon sx={{ fontSize: 16, mr: 1, verticalAlign: 'middle' }} />
                  Common Orders
                </Typography>
                <Grid container spacing={1}>
                  {COMMON_SERVICES.slice(0, 8).map((service) => (
                    <Grid item key={service.code} xs={12} sm={6} md={4}>
                      <Card 
                        variant="outlined" 
                        sx={{ 
                          cursor: 'pointer',
                          '&:hover': { bgcolor: 'action.hover' }
                        }}
                        onClick={() => handleServiceSelect(service)}
                      >
                        <CardContent sx={{ py: 1 }}>
                          <Box display="flex" justifyContent="space-between" alignItems="center">
                            <Box>
                              <Typography variant="body2" fontWeight="medium">
                                {service.display}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {SERVICE_CATEGORIES.find(c => c.id === service.category)?.name}
                              </Typography>
                            </Box>
                            {PRIORITY_OPTIONS.find(p => p.value === service.priority)?.icon}
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Box>

              {/* Trending Services */}
              {trendingServices.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    <TrendingUpIcon sx={{ fontSize: 16, mr: 1, verticalAlign: 'middle' }} />
                    Frequently Ordered
                  </Typography>
                  <Grid container spacing={1}>
                    {trendingServices.map((service) => (
                      <Grid item key={service.code || service.display}>
                        <Chip
                          label={`${service.display} (${service.count})`}
                          onClick={() => handleServiceSelect(service)}
                          color="primary"
                          variant="outlined"
                          size="small"
                          icon={SERVICE_CATEGORIES.find(c => c.id === service.category)?.icon}
                        />
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              )}

              {/* Duplicate Check Alert */}
              {duplicateCheck.length > 0 && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Similar Active Orders Found:
                  </Typography>
                  <List dense>
                    {duplicateCheck.map((dup) => (
                      <ListItem key={dup.id}>
                        <ListItemText
                          primary={`Ordered ${format(new Date(dup.authoredOn), 'MM/dd/yyyy')}`}
                          secondary={`By ${dup.requester} - ${dup.status} - ${dup.priority}`}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Alert>
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
                {/* Intent and Priority */}
                <Grid item xs={12}>
                  <Typography variant="subtitle2" gutterBottom>
                    Order Details
                  </Typography>
                </Grid>

                {/* Status */}
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth>
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      label="Status"
                    >
                      {SERVICE_STATUS_OPTIONS.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          <Chip
                            label={option.label}
                            color={option.color}
                            size="small"
                          />
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                {/* Intent */}
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth>
                    <InputLabel>Intent</InputLabel>
                    <Select
                      value={formData.intent}
                      onChange={(e) => setFormData({ ...formData, intent: e.target.value })}
                      label="Intent"
                    >
                      {INTENT_OPTIONS.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          <Box display="flex" alignItems="center">
                            {option.icon}
                            <Box ml={1}>
                              <Typography variant="body2">{option.label}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {option.description}
                              </Typography>
                            </Box>
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                {/* Priority */}
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth error={!!errors.priority}>
                    <Typography variant="subtitle2" gutterBottom>
                      Priority
                    </Typography>
                    <RadioGroup
                      row
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    >
                      {PRIORITY_OPTIONS.map((option) => (
                        <FormControlLabel
                          key={option.value}
                          value={option.value}
                          control={<Radio />}
                          label={
                            <Box display="flex" alignItems="center">
                              {option.icon}
                              <Typography variant="body2" sx={{ ml: 0.5 }}>
                                {option.label}
                              </Typography>
                            </Box>
                          }
                        />
                      ))}
                    </RadioGroup>
                    {errors.priority && (
                      <FormHelperText>{errors.priority}</FormHelperText>
                    )}
                  </FormControl>
                </Grid>

                {/* Do Not Perform */}
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.doNotPerform}
                        onChange={(e) => setFormData({ ...formData, doNotPerform: e.target.checked })}
                        color="error"
                      />
                    }
                    label={
                      <Box display="flex" alignItems="center">
                        <WarningIcon sx={{ mr: 1, color: 'error.main' }} />
                        <Typography color={formData.doNotPerform ? 'error' : 'inherit'}>
                          Do NOT perform this service
                        </Typography>
                      </Box>
                    }
                  />
                </Grid>

                {/* Requester */}
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Ordered By"
                    value={formData.requester}
                    onChange={(e) => setFormData({ ...formData, requester: e.target.value })}
                    error={!!errors.requester}
                    helperText={errors.requester}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <PersonIcon />
                        </InputAdornment>
                      ),
                    }}
                    placeholder="e.g., Dr. Smith"
                  />
                </Grid>

                {/* Performer */}
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Perform At / Assigned To"
                    value={formData.performer[0] || ''}
                    onChange={(e) => setFormData({ ...formData, performer: [e.target.value] })}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <LocationIcon />
                        </InputAdornment>
                      ),
                    }}
                    placeholder="e.g., Main Lab, Radiology Dept"
                  />
                </Grid>

                {/* Timing */}
                <Grid item xs={12}>
                  <Typography variant="subtitle2" gutterBottom>
                    When to Perform
                  </Typography>
                  <RadioGroup
                    value={
                      formData.occurrenceDateTime ? 'specific' :
                      formData.occurrencePeriod.start ? 'period' :
                      'timing'
                    }
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === 'specific') {
                        setFormData({
                          ...formData,
                          occurrenceDateTime: new Date(),
                          occurrencePeriod: { start: null, end: null },
                        });
                      } else if (value === 'period') {
                        setFormData({
                          ...formData,
                          occurrenceDateTime: null,
                          occurrencePeriod: { start: new Date(), end: null },
                        });
                      } else {
                        setFormData({
                          ...formData,
                          occurrenceDateTime: null,
                          occurrencePeriod: { start: null, end: null },
                        });
                      }
                    }}
                  >
                    <FormControlLabel
                      value="specific"
                      control={<Radio />}
                      label="Specific Date/Time"
                    />
                    <FormControlLabel
                      value="period"
                      control={<Radio />}
                      label="During Time Period"
                    />
                    <FormControlLabel
                      value="timing"
                      control={<Radio />}
                      label="Recurring Schedule"
                    />
                  </RadioGroup>
                </Grid>

                {/* Specific Date/Time */}
                {formData.occurrenceDateTime && (
                  <Grid item xs={12} md={6}>
                    <LocalizationProvider dateAdapter={AdapterDateFns}>
                      <DateTimePicker
                        label="Perform On"
                        value={formData.occurrenceDateTime}
                        onChange={(date) => setFormData({ ...formData, occurrenceDateTime: date })}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            fullWidth
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
                        minDate={new Date()}
                      />
                    </LocalizationProvider>
                  </Grid>
                )}

                {/* Time Period */}
                {formData.occurrencePeriod.start && (
                  <>
                    <Grid item xs={12} md={6}>
                      <LocalizationProvider dateAdapter={AdapterDateFns}>
                        <DateTimePicker
                          label="Start Date"
                          value={formData.occurrencePeriod.start}
                          onChange={(date) => setFormData({
                            ...formData,
                            occurrencePeriod: { ...formData.occurrencePeriod, start: date }
                          })}
                          renderInput={(params) => <TextField {...params} fullWidth />}
                          minDate={new Date()}
                        />
                      </LocalizationProvider>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <LocalizationProvider dateAdapter={AdapterDateFns}>
                        <DateTimePicker
                          label="End Date (Optional)"
                          value={formData.occurrencePeriod.end}
                          onChange={(date) => setFormData({
                            ...formData,
                            occurrencePeriod: { ...formData.occurrencePeriod, end: date }
                          })}
                          renderInput={(params) => <TextField {...params} fullWidth />}
                          minDate={formData.occurrencePeriod.start}
                        />
                      </LocalizationProvider>
                    </Grid>
                  </>
                )}

                {/* As Needed */}
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.asNeeded}
                        onChange={(e) => setFormData({ ...formData, asNeeded: e.target.checked })}
                      />
                    }
                    label="As Needed (PRN)"
                  />
                  {formData.asNeeded && (
                    <TextField
                      fullWidth
                      label="As Needed For"
                      value={formData.asNeededCode}
                      onChange={(e) => setFormData({ ...formData, asNeededCode: e.target.value })}
                      placeholder="e.g., Pain, Nausea"
                      sx={{ mt: 2 }}
                    />
                  )}
                </Grid>

                {/* Patient Instructions */}
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                    label="Patient Instructions"
                    value={formData.patientInstruction}
                    onChange={(e) => setFormData({ ...formData, patientInstruction: e.target.value })}
                    placeholder="e.g., Nothing by mouth after midnight..."
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <InfoIcon />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>

                {/* Clinical Notes */}
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Clinical Notes"
                    value={formData.note}
                    onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                    placeholder="Additional clinical information..."
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
                Review Service Request
              </Typography>
              
              <Card variant="outlined" sx={{ mb: 3 }}>
                <CardContent>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <Box display="flex" alignItems="center" mb={2}>
                        <ServiceIcon sx={{ mr: 2, color: 'primary.main', fontSize: 32 }} />
                        <Box flex={1}>
                          <Typography variant="h6">
                            {selectedService?.display}
                          </Typography>
                          {selectedService?.code && (
                            <Typography variant="caption" color="text.secondary">
                              Code: {selectedService.code}
                            </Typography>
                          )}
                        </Box>
                        <Badge
                          badgeContent={formData.priority.toUpperCase()}
                          color={
                            formData.priority === 'stat' || formData.priority === 'asap' ? 'error' :
                            formData.priority === 'urgent' ? 'warning' : 'primary'
                          }
                        />
                      </Box>
                    </Grid>
                    
                    {formData.doNotPerform && (
                      <Grid item xs={12}>
                        <Alert severity="error">
                          <Typography variant="subtitle2">
                            DO NOT PERFORM - This is a negative order
                          </Typography>
                        </Alert>
                      </Grid>
                    )}
                    
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" color="text.secondary">
                        Status
                      </Typography>
                      <Chip
                        label={SERVICE_STATUS_OPTIONS.find(opt => opt.value === formData.status)?.label}
                        color={SERVICE_STATUS_OPTIONS.find(opt => opt.value === formData.status)?.color}
                        size="small"
                      />
                    </Grid>
                    
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" color="text.secondary">
                        Intent
                      </Typography>
                      <Typography variant="body1">
                        {INTENT_OPTIONS.find(opt => opt.value === formData.intent)?.label}
                      </Typography>
                    </Grid>
                    
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" color="text.secondary">
                        Ordered By
                      </Typography>
                      <Typography variant="body1">
                        {formData.requester}
                      </Typography>
                    </Grid>
                    
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" color="text.secondary">
                        Ordered On
                      </Typography>
                      <Typography variant="body1">
                        {format(formData.authoredOn, 'PPpp')}
                      </Typography>
                    </Grid>
                    
                    {formData.performer[0] && (
                      <Grid item xs={12}>
                        <Typography variant="subtitle2" color="text.secondary">
                          Perform At / Assigned To
                        </Typography>
                        <Typography variant="body1">
                          {formData.performer[0]}
                        </Typography>
                      </Grid>
                    )}
                    
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" color="text.secondary">
                        Timing
                      </Typography>
                      <Typography variant="body1">
                        {formData.occurrenceDateTime ? (
                          `Perform on ${format(formData.occurrenceDateTime, 'PPpp')}`
                        ) : formData.occurrencePeriod.start ? (
                          `Between ${format(formData.occurrencePeriod.start, 'PP')}${formData.occurrencePeriod.end ? ` and ${format(formData.occurrencePeriod.end, 'PP')}` : ''}`
                        ) : (
                          'As scheduled'
                        )}
                        {formData.asNeeded && ` - As needed${formData.asNeededCode ? ` for ${formData.asNeededCode}` : ''}`}
                      </Typography>
                    </Grid>
                    
                    {formData.patientInstruction && (
                      <Grid item xs={12}>
                        <Typography variant="subtitle2" color="text.secondary">
                          Patient Instructions
                        </Typography>
                        <Alert severity="info" icon={<InfoIcon />}>
                          {formData.patientInstruction}
                        </Alert>
                      </Grid>
                    )}
                    
                    {formData.note && (
                      <Grid item xs={12}>
                        <Typography variant="subtitle2" color="text.secondary">
                          Clinical Notes
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
                  Ready to create service request
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
            <ServiceIcon sx={{ mr: 2, color: 'primary.main' }} />
            <Typography variant="h6">
              {serviceRequest ? 'Edit Service Request' : 'New Service Request'}
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
                selectedService && (
                  <Typography variant="caption">{selectedService.display}</Typography>
                )
              }
            >
              Select Service
            </StepLabel>
            <StepContent>
              {getStepContent(0)}
              <Box sx={{ mt: 2 }}>
                <Button
                  variant="contained"
                  onClick={handleNext}
                  disabled={!selectedService}
                  endIcon={<ServiceIcon />}
                >
                  Continue
                </Button>
              </Box>
            </StepContent>
          </Step>
          
          <Step>
            <StepLabel>
              Order Details
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
              Review & Submit
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
                  {saving ? 'Creating...' : 'Create Order'}
                </Button>
              </Box>
            </StepContent>
          </Step>
        </Stepper>
      </DialogContent>
    </Dialog>
  );
};

export default ServiceRequestDialogEnhanced;