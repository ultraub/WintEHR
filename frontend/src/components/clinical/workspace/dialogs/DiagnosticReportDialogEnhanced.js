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
  Checkbox,
  Tooltip,
  Fade,
  Zoom,
  Skeleton,
  InputAdornment,
  Radio,
  RadioGroup,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Close as CloseIcon,
  Search as SearchIcon,
  Description as ReportIcon,
  Event as EventIcon,
  LocationOn as LocationIcon,
  Person as PersonIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Info as InfoIcon,
  Schedule as ScheduleIcon,
  Assignment as AssignmentIcon,
  CalendarToday as CalendarIcon,
  Biotech as LabIcon,
  LocalHospital as HospitalIcon,
  Science as ScienceIcon,
  Psychology as PsychologyIcon,
  CameraAlt as ImagingIcon,
  Healing as PathologyIcon,
  MedicalServices as MedicalIcon,
  TrendingUp as TrendingUpIcon,
  AttachFile as AttachmentIcon,
  VerifiedUser as VerifiedIcon,
  AddCircle as AddIcon,
  RemoveCircle as RemoveIcon,
  ExpandMore as ExpandMoreIcon,
  Print as PrintIcon,
  Share as ShareIcon,
  CloudUpload as UploadIcon,
} from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, differenceInDays, parseISO } from 'date-fns';
import { debounce } from 'lodash';

import { useFHIRClient } from '../../../contexts/FHIRContext';
import { useClinical as useClinicalContext } from '../../../contexts/ClinicalContext';
import { useClinicalWorkflow } from '../../../contexts/ClinicalWorkflowContext';
import { CLINICAL_EVENTS } from '../../../constants/clinicalEvents';
import fhirService from '../../../services/fhirService';
import cdsClinicalDataService from '../../../services/cdsClinicalDataService';

const searchDiagnosticReports = async (query) => {
  try {
    const catalog = await cdsClinicalDataService.getClinicalCatalog('diagnostic-reports');
    const searchTerm = query.toLowerCase();
    return catalog.filter(item => 
      item.display?.toLowerCase().includes(searchTerm) ||
      item.code?.toLowerCase().includes(searchTerm)
    );
  } catch (error) {
    console.error('Error searching diagnostic reports:', error);
    return [];
  }
};

// Report status options
const REPORT_STATUS_OPTIONS = [
  { value: 'registered', label: 'Registered', color: 'default' },
  { value: 'partial', label: 'Partial', color: 'info' },
  { value: 'preliminary', label: 'Preliminary', color: 'warning' },
  { value: 'final', label: 'Final', color: 'success' },
  { value: 'amended', label: 'Amended', color: 'warning' },
  { value: 'corrected', label: 'Corrected', color: 'warning' },
  { value: 'appended', label: 'Appended', color: 'info' },
  { value: 'cancelled', label: 'Cancelled', color: 'error' },
  { value: 'entered-in-error', label: 'Entered in Error', color: 'error' },
  { value: 'unknown', label: 'Unknown', color: 'default' },
];

// Common report categories
const REPORT_CATEGORIES = [
  { id: 'LAB', name: 'Laboratory', icon: <LabIcon />, color: '#2196F3' },
  { id: 'RAD', name: 'Radiology', icon: <ImagingIcon />, color: '#9C27B0' },
  { id: 'PATH', name: 'Pathology', icon: <PathologyIcon />, color: '#F44336' },
  { id: 'MB', name: 'Microbiology', icon: <ScienceIcon />, color: '#4CAF50' },
  { id: 'SP', name: 'Surgical Pathology', icon: <MedicalIcon />, color: '#FF9800' },
  { id: 'CP', name: 'Clinical Pathology', icon: <HospitalIcon />, color: '#00BCD4' },
  { id: 'OTH', name: 'Other', icon: <AssignmentIcon />, color: '#607D8B' },
];

// Common lab panels
const COMMON_PANELS = [
  { 
    code: '24323-8', 
    display: 'Comprehensive Metabolic Panel',
    category: 'LAB',
    components: ['Glucose', 'BUN', 'Creatinine', 'eGFR', 'Sodium', 'Potassium', 'Chloride', 'CO2', 'Calcium', 'Total Protein', 'Albumin', 'Bilirubin', 'ALT', 'AST', 'Alk Phos']
  },
  { 
    code: '51990-0', 
    display: 'Basic Metabolic Panel',
    category: 'LAB',
    components: ['Glucose', 'BUN', 'Creatinine', 'eGFR', 'Sodium', 'Potassium', 'Chloride', 'CO2', 'Calcium']
  },
  { 
    code: '58410-2', 
    display: 'Complete Blood Count with Differential',
    category: 'LAB',
    components: ['WBC', 'RBC', 'Hemoglobin', 'Hematocrit', 'MCV', 'MCH', 'MCHC', 'RDW', 'Platelets', 'Neutrophils', 'Lymphocytes', 'Monocytes', 'Eosinophils', 'Basophils']
  },
  { 
    code: '57698-3', 
    display: 'Lipid Panel',
    category: 'LAB',
    components: ['Total Cholesterol', 'Triglycerides', 'HDL Cholesterol', 'LDL Cholesterol', 'Non-HDL Cholesterol']
  },
  { 
    code: '24362-6', 
    display: 'Liver Function Tests',
    category: 'LAB',
    components: ['ALT', 'AST', 'Alk Phos', 'Total Bilirubin', 'Direct Bilirubin', 'Total Protein', 'Albumin']
  },
];

const DiagnosticReportDialogEnhanced = ({
  open,
  onClose,
  report = null,
  onSave,
  patientId,
  encounterId,
  mode = 'create', // 'create', 'edit', 'view'
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
  const [selectedReport, setSelectedReport] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [trendingReports, setTrendingReports] = useState([]);
  const [relatedObservations, setRelatedObservations] = useState([]);
  const [selectedObservations, setSelectedObservations] = useState([]);

  // Report details
  const [formData, setFormData] = useState({
    status: 'final',
    category: [],
    effectiveDateTime: new Date(),
    issued: new Date(),
    performer: [],
    resultsInterpreter: [],
    specimen: [],
    result: [], // References to Observations
    imagingStudy: [], // References to ImagingStudy
    media: [], // Attached images/files
    conclusion: '',
    conclusionCode: [],
    presentedForm: [], // PDF or other attachments
  });

  // Load trending reports on mount
  useEffect(() => {
    if (open && !report) {
      loadTrendingReports();
      if (patient) {
        loadRelatedObservations();
      }
    }
  }, [open, report, patient]);

  // Load existing report data
  useEffect(() => {
    if (report) {
      // Parse existing report into form data
      setFormData({
        status: report.status || 'final',
        category: report.category || [],
        effectiveDateTime: report.effectiveDateTime ? new Date(report.effectiveDateTime) : new Date(),
        issued: report.issued ? new Date(report.issued) : new Date(),
        performer: report.performer || [],
        resultsInterpreter: report.resultsInterpreter || [],
        specimen: report.specimen || [],
        result: report.result || [],
        imagingStudy: report.imagingStudy || [],
        media: report.media || [],
        conclusion: report.conclusion || '',
        conclusionCode: report.conclusionCode || [],
        presentedForm: report.presentedForm || [],
      });
      setSelectedReport({
        code: report.code?.coding?.[0]?.code,
        display: report.code?.coding?.[0]?.display,
        system: report.code?.coding?.[0]?.system,
      });
      
      // Load referenced observations
      if (report.result?.length > 0) {
        loadReportObservations(report.result);
      }
      
      setActiveStep(1); // Skip to details if editing
    }
  }, [report]);

  // Load trending reports from recent reports
  const loadTrendingReports = async () => {
    try {
      const recentReports = await fhirService.searchResources('DiagnosticReport', {
        _count: 100,
        _sort: '-date',
        status: 'final',
      });

      // Count report usage
      const reportCount = {};
      recentReports.entry?.forEach(entry => {
        const rep = entry.resource.code?.coding?.[0];
        if (rep) {
          const key = rep.code;
          if (!reportCount[key]) {
            reportCount[key] = {
              ...rep,
              count: 0,
              lastIssued: entry.resource.issued,
              category: entry.resource.category?.[0]?.coding?.[0]?.code,
              turnaroundTime: 0,
            };
          }
          reportCount[key].count++;
          
          // Calculate average turnaround time
          if (entry.resource.effectiveDateTime && entry.resource.issued) {
            const tat = differenceInDays(
              new Date(entry.resource.issued),
              new Date(entry.resource.effectiveDateTime)
            );
            reportCount[key].turnaroundTime = 
              (reportCount[key].turnaroundTime * (reportCount[key].count - 1) + tat) / reportCount[key].count;
          }
        }
      });

      // Sort by frequency and get top 10
      const trending = Object.values(reportCount)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      setTrendingReports(trending);
    } catch (error) {
      console.error('Error loading trending reports:', error);
    }
  };

  // Load related observations for the patient
  const loadRelatedObservations = async () => {
    try {
      const observations = await fhirService.searchResources('Observation', {
        patient: patientId,
        _count: 50,
        _sort: '-date',
        status: 'final,amended,corrected',
      });

      const obs = observations.entry?.map(entry => ({
        id: entry.resource.id,
        code: entry.resource.code?.coding?.[0]?.code,
        display: entry.resource.code?.coding?.[0]?.display || entry.resource.code?.text,
        value: entry.resource.valueQuantity || entry.resource.valueString || entry.resource.valueCodeableConcept,
        effectiveDateTime: entry.resource.effectiveDateTime,
        status: entry.resource.status,
        category: entry.resource.category?.[0]?.coding?.[0]?.code,
      })) || [];

      setRelatedObservations(obs);
    } catch (error) {
      console.error('Error loading related observations:', error);
    }
  };

  // Load observations referenced in the report
  const loadReportObservations = async (references) => {
    try {
      const observationIds = references
        .filter(ref => ref.reference?.startsWith('Observation/'))
        .map(ref => ref.reference.split('/')[1]);
      
      if (observationIds.length === 0) return;
      
      const observations = await Promise.all(
        observationIds.map(id => fhirService.getResource('Observation', id))
      );
      
      setSelectedObservations(observations.filter(Boolean));
    } catch (error) {
      console.error('Error loading report observations:', error);
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
        const results = await searchDiagnosticReports(query);
        // Add common panels to search results
        const panelResults = COMMON_PANELS.filter(panel => 
          panel.display.toLowerCase().includes(query.toLowerCase())
        );
        setSearchResults([...panelResults, ...results].slice(0, 10));
      } catch (error) {
        console.error('Error searching reports:', error);
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

  // Handle report selection
  const handleReportSelect = (report) => {
    setSelectedReport(report);
    setSearchQuery(report.display);
    
    // Auto-populate category based on report type
    if (report.category) {
      setFormData(prev => ({
        ...prev,
        category: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/v2-0074',
            code: report.category,
            display: REPORT_CATEGORIES.find(c => c.id === report.category)?.name,
          }],
        }],
      }));
    }
    
    // If it's a common panel, suggest related observations
    if (report.components) {
      suggestPanelComponents(report);
    }
  };

  // Suggest observations for common panels
  const suggestPanelComponents = (panel) => {
    const suggestions = relatedObservations.filter(obs => 
      panel.components.some(component => 
        obs.display?.toLowerCase().includes(component.toLowerCase())
      )
    );
    
    if (suggestions.length > 0) {
      setAlerts([{
        severity: 'info',
        message: `Found ${suggestions.length} recent observations that may be part of this panel. Select them in the next step.`,
      }]);
    }
  };

  // Toggle observation selection
  const toggleObservationSelection = (observation) => {
    setSelectedObservations(prev => {
      const isSelected = prev.some(obs => obs.id === observation.id);
      if (isSelected) {
        return prev.filter(obs => obs.id !== observation.id);
      } else {
        return [...prev, observation];
      }
    });
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
      case 0: // Report selection
        if (!selectedReport) {
          newErrors.report = 'Please select a report type';
        }
        break;
        
      case 1: // Report details and observations
        if (!formData.status) {
          newErrors.status = 'Status is required';
        }
        if (formData.category.length === 0) {
          newErrors.category = 'At least one category is required';
        }
        if (!formData.effectiveDateTime) {
          newErrors.effectiveDateTime = 'Effective date/time is required';
        }
        break;
        
      case 2: // Conclusion and finalization
        // Optional validation for conclusion
        break;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Build FHIR DiagnosticReport resource
  const buildFHIRResource = () => {
    const resource = {
      resourceType: 'DiagnosticReport',
      status: formData.status,
      code: {
        coding: [{
          system: selectedReport.system || 'http://loinc.org',
          code: selectedReport.code,
          display: selectedReport.display,
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
    
    // Add categories
    if (formData.category.length > 0) {
      resource.category = formData.category;
    }
    
    // Add performer
    if (formData.performer.length > 0) {
      resource.performer = formData.performer.map(p => ({
        display: p,
      }));
    }
    
    // Add results interpreter
    if (formData.resultsInterpreter.length > 0) {
      resource.resultsInterpreter = formData.resultsInterpreter.map(ri => ({
        display: ri,
      }));
    }
    
    // Add observation results
    if (selectedObservations.length > 0) {
      resource.result = selectedObservations.map(obs => ({
        reference: `Observation/${obs.id}`,
        display: obs.code?.coding?.[0]?.display || obs.code?.text,
      }));
    }
    
    // Add conclusion
    if (formData.conclusion) {
      resource.conclusion = formData.conclusion;
    }
    
    // Add conclusion codes
    if (formData.conclusionCode.length > 0) {
      resource.conclusionCode = formData.conclusionCode;
    }
    
    // Add presented form (attachments)
    if (formData.presentedForm.length > 0) {
      resource.presentedForm = formData.presentedForm;
    }
    
    // Preserve existing ID if editing
    if (report?.id) {
      resource.id = report.id;
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
      await publish(CLINICAL_EVENTS.DIAGNOSTIC_REPORT_CREATED, {
        patientId,
        reportId: fhirResource.id,
        reportType: selectedReport.display,
        status: formData.status,
        category: formData.category[0]?.coding?.[0]?.code,
        resultCount: selectedObservations.length,
      });
      
      // Close dialog
      handleClose();
    } catch (error) {
      console.error('Error saving diagnostic report:', error);
      setErrors({ submit: 'Failed to save diagnostic report. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  // Handle dialog close
  const handleClose = () => {
    // Reset form
    setActiveStep(0);
    setSelectedReport(null);
    setSearchQuery('');
    setSearchResults([]);
    setSelectedObservations([]);
    setFormData({
      status: 'final',
      category: [],
      effectiveDateTime: new Date(),
      issued: new Date(),
      performer: [],
      resultsInterpreter: [],
      specimen: [],
      result: [],
      imagingStudy: [],
      media: [],
      conclusion: '',
      conclusionCode: [],
      presentedForm: [],
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
              {/* Report Search */}
              <Box mb={3}>
                <Autocomplete
                  freeSolo
                  options={searchResults}
                  getOptionLabel={(option) => option.display || option}
                  value={selectedReport}
                  onChange={(event, newValue) => {
                    if (typeof newValue === 'object' && newValue !== null) {
                      handleReportSelect(newValue);
                    }
                  }}
                  inputValue={searchQuery}
                  onInputChange={handleSearchChange}
                  loading={searching}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Search Report Types"
                      placeholder="Type report name or LOINC code..."
                      error={!!errors.report}
                      helperText={errors.report}
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
                      <ReportIcon sx={{ mr: 2, color: 'primary.main' }} />
                      <Box>
                        <Typography variant="body1">{option.display}</Typography>
                        {option.code && (
                          <Typography variant="caption" color="text.secondary">
                            {option.system?.includes('loinc') ? 'LOINC' : 'Code'}: {option.code}
                          </Typography>
                        )}
                        {option.components && (
                          <Typography variant="caption" display="block" color="text.secondary">
                            Includes: {option.components.slice(0, 3).join(', ')}...
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  )}
                />
              </Box>

              {/* Report Categories */}
              <Box mb={3}>
                <Typography variant="subtitle2" gutterBottom>
                  Browse by Category
                </Typography>
                <Grid container spacing={1}>
                  {REPORT_CATEGORIES.map((category) => (
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

              {/* Common Lab Panels */}
              <Box mb={3}>
                <Typography variant="subtitle2" gutterBottom>
                  <ScienceIcon sx={{ fontSize: 16, mr: 1, verticalAlign: 'middle' }} />
                  Common Lab Panels
                </Typography>
                <Grid container spacing={2}>
                  {COMMON_PANELS.map((panel) => (
                    <Grid item key={panel.code} xs={12} sm={6}>
                      <Card 
                        variant="outlined" 
                        sx={{ 
                          cursor: 'pointer',
                          '&:hover': { bgcolor: 'action.hover' }
                        }}
                        onClick={() => handleReportSelect(panel)}
                      >
                        <CardContent sx={{ py: 1 }}>
                          <Typography variant="body2" fontWeight="medium">
                            {panel.display}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {panel.components.length} components
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Box>

              {/* Trending Reports */}
              {trendingReports.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    <TrendingUpIcon sx={{ fontSize: 16, mr: 1, verticalAlign: 'middle' }} />
                    Frequently Ordered
                  </Typography>
                  <Grid container spacing={1}>
                    {trendingReports.map((rep) => (
                      <Grid item key={rep.code}>
                        <Chip
                          label={`${rep.display} (${rep.count})`}
                          onClick={() => handleReportSelect(rep)}
                          color="primary"
                          variant="outlined"
                          size="small"
                          icon={REPORT_CATEGORIES.find(c => c.id === rep.category)?.icon}
                        />
                      </Grid>
                    ))}
                  </Grid>
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
                {/* Report Status */}
                <Grid item xs={12}>
                  <FormControl component="fieldset">
                    <Typography variant="subtitle2" gutterBottom>
                      Report Status
                    </Typography>
                    <RadioGroup
                      row
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    >
                      {REPORT_STATUS_OPTIONS.map((option) => (
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
                      multiple
                      value={formData.category.map(c => c.coding?.[0]?.code || '')}
                      onChange={(e) => {
                        const values = e.target.value;
                        setFormData({
                          ...formData,
                          category: values.map(val => ({
                            coding: [{
                              system: 'http://terminology.hl7.org/CodeSystem/v2-0074',
                              code: val,
                              display: REPORT_CATEGORIES.find(c => c.id === val)?.name,
                            }],
                          })),
                        });
                      }}
                      renderValue={(selected) => (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {selected.map((value) => (
                            <Chip
                              key={value}
                              label={REPORT_CATEGORIES.find(c => c.id === value)?.name}
                              size="small"
                            />
                          ))}
                        </Box>
                      )}
                    >
                      {REPORT_CATEGORIES.map((cat) => (
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

                {/* Effective Date/Time */}
                <Grid item xs={12} md={6}>
                  <LocalizationProvider dateAdapter={AdapterDateFns}>
                    <DateTimePicker
                      label="Specimen Collection Date/Time"
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

                {/* Performer */}
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Performed By"
                    value={formData.performer[0] || ''}
                    onChange={(e) => setFormData({ ...formData, performer: [e.target.value] })}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <PersonIcon />
                        </InputAdornment>
                      ),
                    }}
                    placeholder="e.g., Lab Technician Name"
                  />
                </Grid>

                {/* Results Interpreter */}
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Results Interpreted By"
                    value={formData.resultsInterpreter[0] || ''}
                    onChange={(e) => setFormData({ ...formData, resultsInterpreter: [e.target.value] })}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <VerifiedIcon />
                        </InputAdornment>
                      ),
                    }}
                    placeholder="e.g., Dr. Smith"
                  />
                </Grid>

                {/* Related Observations Selection */}
                <Grid item xs={12}>
                  <Typography variant="subtitle2" gutterBottom>
                    Select Observations to Include in Report
                  </Typography>
                  {relatedObservations.length > 0 ? (
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell padding="checkbox"></TableCell>
                            <TableCell>Observation</TableCell>
                            <TableCell>Value</TableCell>
                            <TableCell>Date</TableCell>
                            <TableCell>Status</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {relatedObservations.map((obs) => (
                            <TableRow key={obs.id}>
                              <TableCell padding="checkbox">
                                <Checkbox
                                  checked={selectedObservations.some(selected => selected.id === obs.id)}
                                  onChange={() => toggleObservationSelection(obs)}
                                />
                              </TableCell>
                              <TableCell>{obs.display}</TableCell>
                              <TableCell>
                                {obs.value?.value && obs.value?.unit
                                  ? `${obs.value.value} ${obs.value.unit}`
                                  : obs.value?.text || obs.value || '-'}
                              </TableCell>
                              <TableCell>
                                {obs.effectiveDateTime
                                  ? format(parseISO(obs.effectiveDateTime), 'MM/dd/yyyy')
                                  : '-'}
                              </TableCell>
                              <TableCell>
                                <Chip
                                  label={obs.status}
                                  size="small"
                                  color={obs.status === 'final' ? 'success' : 'default'}
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  ) : (
                    <Alert severity="info">
                      No recent observations found for this patient.
                    </Alert>
                  )}
                  {selectedObservations.length > 0 && (
                    <Typography variant="caption" color="primary" sx={{ mt: 1, display: 'block' }}>
                      {selectedObservations.length} observation(s) selected
                    </Typography>
                  )}
                </Grid>
              </Grid>
            </Box>
          </Fade>
        );

      case 2:
        return (
          <Fade in={true}>
            <Box>
              <Grid container spacing={3}>
                {/* Conclusion */}
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={4}
                    label="Conclusion / Interpretation"
                    value={formData.conclusion}
                    onChange={(e) => setFormData({ ...formData, conclusion: e.target.value })}
                    placeholder="Enter clinical interpretation and conclusions..."
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <DescriptionIcon />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>

                {/* Attachments */}
                <Grid item xs={12}>
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Attachments
                    </Typography>
                    <Button
                      variant="outlined"
                      startIcon={<UploadIcon />}
                      onClick={() => {
                        // In real implementation, would open file picker
                        setAlerts([{
                          severity: 'info',
                          message: 'File upload functionality would be implemented here',
                        }]);
                      }}
                    >
                      Upload Report PDF
                    </Button>
                    {formData.presentedForm.length > 0 && (
                      <List dense>
                        {formData.presentedForm.map((form, index) => (
                          <ListItem key={index}>
                            <ListItemIcon>
                              <AttachmentIcon />
                            </ListItemIcon>
                            <ListItemText
                              primary={form.title || `Attachment ${index + 1}`}
                              secondary={form.contentType}
                            />
                          </ListItem>
                        ))}
                      </List>
                    )}
                  </Box>
                </Grid>

                {/* Review Summary */}
                <Grid item xs={12}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Report Summary
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={12}>
                          <Box display="flex" alignItems="center" mb={2}>
                            <ReportIcon sx={{ mr: 2, color: 'primary.main', fontSize: 32 }} />
                            <Box>
                              <Typography variant="h6">
                                {selectedReport?.display}
                              </Typography>
                              {selectedReport?.code && (
                                <Typography variant="caption" color="text.secondary">
                                  Code: {selectedReport.code}
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
                            label={REPORT_STATUS_OPTIONS.find(opt => opt.value === formData.status)?.label}
                            color={REPORT_STATUS_OPTIONS.find(opt => opt.value === formData.status)?.color}
                            size="small"
                          />
                        </Grid>
                        
                        <Grid item xs={12} md={6}>
                          <Typography variant="subtitle2" color="text.secondary">
                            Categories
                          </Typography>
                          <Box display="flex" gap={0.5}>
                            {formData.category.map((cat, index) => (
                              <Chip
                                key={index}
                                icon={REPORT_CATEGORIES.find(c => c.id === cat.coding?.[0]?.code)?.icon}
                                label={cat.coding?.[0]?.display}
                                size="small"
                              />
                            ))}
                          </Box>
                        </Grid>
                        
                        <Grid item xs={12}>
                          <Typography variant="subtitle2" color="text.secondary">
                            Included Observations
                          </Typography>
                          <Typography variant="body2">
                            {selectedObservations.length} observation(s) included
                          </Typography>
                        </Grid>
                        
                        {formData.conclusion && (
                          <Grid item xs={12}>
                            <Typography variant="subtitle2" color="text.secondary">
                              Conclusion
                            </Typography>
                            <Typography variant="body2">
                              {formData.conclusion}
                            </Typography>
                          </Grid>
                        )}
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
              
              {errors.submit && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {errors.submit}
                </Alert>
              )}
              
              {/* Alerts */}
              {alerts.map((alert, index) => (
                <Alert key={index} severity={alert.severity} sx={{ mt: 2 }}>
                  {alert.message}
                </Alert>
              ))}
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
            <ReportIcon sx={{ mr: 2, color: 'primary.main' }} />
            <Typography variant="h6">
              {report ? 'Edit Diagnostic Report' : 'Create Diagnostic Report'}
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
                selectedReport && (
                  <Typography variant="caption">{selectedReport.display}</Typography>
                )
              }
            >
              Select Report Type
            </StepLabel>
            <StepContent>
              {getStepContent(0)}
              <Box sx={{ mt: 2 }}>
                <Button
                  variant="contained"
                  onClick={handleNext}
                  disabled={!selectedReport}
                  endIcon={<ReportIcon />}
                >
                  Continue
                </Button>
              </Box>
            </StepContent>
          </Step>
          
          <Step>
            <StepLabel>
              Report Details & Observations
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
                  endIcon={<AssignmentIcon />}
                >
                  Continue
                </Button>
              </Box>
            </StepContent>
          </Step>
          
          <Step>
            <StepLabel>
              Conclusion & Review
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
                  {saving ? 'Saving...' : 'Save Report'}
                </Button>
              </Box>
            </StepContent>
          </Step>
        </Stepper>
      </DialogContent>
    </Dialog>
  );
};

export default DiagnosticReportDialogEnhanced;