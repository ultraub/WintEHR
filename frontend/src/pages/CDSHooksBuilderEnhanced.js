import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Switch,
  FormControlLabel,
  Tooltip,
  Divider,
  Autocomplete,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Stack,
  Badge,
  Tab,
  Tabs,
  Snackbar,
  InputAdornment,
  ToggleButton,
  ToggleButtonGroup,
  ListItemSecondaryAction,
  FormGroup,
  Checkbox,
  Radio,
  RadioGroup,
  FormLabel,
  LinearProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Code as CodeIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Settings as SettingsIcon,
  Help as HelpIcon,
  ExpandMore as ExpandMoreIcon,
  Webhook as WebhookIcon,
  Rule as RuleIcon,
  Notifications as NotificationIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  ContentCopy as CopyIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Science as ScienceIcon,
  LocalPharmacy as PharmacyIcon,
  Assessment as AssessmentIcon,
  Favorite as FavoriteIcon,
  AutoAwesome as AutoAwesomeIcon,
  Speed as SpeedIcon,
  Psychology as PsychologyIcon,
  Build as BuildIcon,
  Preview as PreviewIcon,
  Timeline as TimelineIcon,
  Link as LinkIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import api from '../services/api';
import axios from 'axios';

// Placeholder - will be loaded from API
const LAB_TEST_OPTIONS_DEFAULT = [
  // Basic Metabolic Panel
  { code: '2339-0', display: 'Glucose', unit: 'mg/dL', category: 'Chemistry', normalRange: { min: 70, max: 100 } },
  { code: '2823-3', display: 'Potassium', unit: 'mmol/L', category: 'Chemistry', normalRange: { min: 3.5, max: 5.1 } },
  { code: '2951-2', display: 'Sodium', unit: 'mmol/L', category: 'Chemistry', normalRange: { min: 136, max: 145 } },
  { code: '2160-0', display: 'Creatinine', unit: 'mg/dL', category: 'Chemistry', normalRange: { min: 0.7, max: 1.3 } },
  { code: '3094-0', display: 'BUN (Blood Urea Nitrogen)', unit: 'mg/dL', category: 'Chemistry', normalRange: { min: 7, max: 20 } },
  
  // Complete Blood Count
  { code: '26464-8', display: 'WBC Count', unit: '10*3/uL', category: 'Hematology', normalRange: { min: 4.5, max: 11.0 } },
  { code: '718-7', display: 'Hemoglobin', unit: 'g/dL', category: 'Hematology', normalRange: { min: 12.0, max: 17.5 } },
  { code: '787-2', display: 'MCV', unit: 'fL', category: 'Hematology', normalRange: { min: 80, max: 100 } },
  { code: '777-3', display: 'Platelet Count', unit: '10*3/uL', category: 'Hematology', normalRange: { min: 150, max: 400 } },
  
  // Lipid Panel
  { code: '2093-3', display: 'Total Cholesterol', unit: 'mg/dL', category: 'Lipids', normalRange: { max: 200 } },
  { code: '2085-9', display: 'HDL Cholesterol', unit: 'mg/dL', category: 'Lipids', normalRange: { min: 40 } },
  { code: '13457-7', display: 'LDL Cholesterol (calculated)', unit: 'mg/dL', category: 'Lipids', normalRange: { max: 100 } },
  { code: '2571-8', display: 'Triglycerides', unit: 'mg/dL', category: 'Lipids', normalRange: { max: 150 } },
  
  // Liver Function
  { code: '1742-6', display: 'ALT', unit: 'U/L', category: 'Liver', normalRange: { min: 7, max: 56 } },
  { code: '1920-8', display: 'AST', unit: 'U/L', category: 'Liver', normalRange: { min: 10, max: 40 } },
  { code: '1975-2', display: 'Total Bilirubin', unit: 'mg/dL', category: 'Liver', normalRange: { min: 0.3, max: 1.2 } },
  
  // Cardiac Markers
  { code: '2157-6', display: 'CK (Creatine Kinase)', unit: 'U/L', category: 'Cardiac', normalRange: { min: 30, max: 200 } },
  { code: '13969-1', display: 'CK-MB', unit: 'ng/mL', category: 'Cardiac', normalRange: { max: 6.3 } },
  { code: '10839-9', display: 'Troponin I', unit: 'ng/mL', category: 'Cardiac', normalRange: { max: 0.04 } },
  { code: '33762-6', display: 'NT-proBNP', unit: 'pg/mL', category: 'Cardiac', normalRange: { max: 125 } },
  
  // Diabetes
  { code: '4548-4', display: 'Hemoglobin A1c', unit: '%', category: 'Diabetes', normalRange: { max: 5.7 } },
  { code: '2345-7', display: 'Glucose (fasting)', unit: 'mg/dL', category: 'Diabetes', normalRange: { min: 70, max: 100 } },
  
  // Thyroid
  { code: '3016-3', display: 'TSH', unit: 'mIU/L', category: 'Thyroid', normalRange: { min: 0.4, max: 4.0 } },
  { code: '3053-6', display: 'Free T4', unit: 'ng/dL', category: 'Thyroid', normalRange: { min: 0.9, max: 1.7 } },
  { code: '3051-0', display: 'Free T3', unit: 'pg/mL', category: 'Thyroid', normalRange: { min: 2.3, max: 4.2 } },
];

// Placeholder - will be loaded from API
const MEDICATION_OPTIONS_DEFAULT = [
  // Cardiovascular
  { code: '1000001', display: 'Lisinopril 10mg', category: 'ACE Inhibitor', rxnorm: '29046' },
  { code: '1000002', display: 'Metoprolol 50mg', category: 'Beta Blocker', rxnorm: '866426' },
  { code: '1000003', display: 'Amlodipine 5mg', category: 'Calcium Channel Blocker', rxnorm: '197361' },
  { code: '1000004', display: 'Atorvastatin 20mg', category: 'Statin', rxnorm: '617312' },
  { code: '1000005', display: 'Aspirin 81mg', category: 'Antiplatelet', rxnorm: '243670' },
  
  // Diabetes
  { code: '1000006', display: 'Metformin 500mg', category: 'Antidiabetic', rxnorm: '860974' },
  { code: '1000007', display: 'Glipizide 5mg', category: 'Sulfonylurea', rxnorm: '310490' },
  { code: '1000008', display: 'Insulin Glargine', category: 'Insulin', rxnorm: '285018' },
  
  // Respiratory
  { code: '1000009', display: 'Albuterol Inhaler', category: 'Bronchodilator', rxnorm: '745679' },
  { code: '1000010', display: 'Fluticasone/Salmeterol', category: 'Inhaled Corticosteroid', rxnorm: '896185' },
  
  // Pain/Inflammation
  { code: '1000011', display: 'Ibuprofen 400mg', category: 'NSAID', rxnorm: '197805' },
  { code: '1000012', display: 'Acetaminophen 500mg', category: 'Analgesic', rxnorm: '198440' },
  { code: '1000013', display: 'Prednisone 10mg', category: 'Corticosteroid', rxnorm: '312615' },
];

// Placeholder - will be loaded from API
const VITAL_SIGN_OPTIONS_DEFAULT = [
  { code: '8480-6', display: 'Systolic Blood Pressure', unit: 'mmHg', category: 'Blood Pressure', normalRange: { min: 90, max: 120 } },
  { code: '8462-4', display: 'Diastolic Blood Pressure', unit: 'mmHg', category: 'Blood Pressure', normalRange: { min: 60, max: 80 } },
  { code: '8867-4', display: 'Heart Rate', unit: 'bpm', category: 'Pulse', normalRange: { min: 60, max: 100 } },
  { code: '9279-1', display: 'Respiratory Rate', unit: 'breaths/min', category: 'Respiration', normalRange: { min: 12, max: 20 } },
  { code: '8310-5', display: 'Body Temperature', unit: '°F', category: 'Temperature', normalRange: { min: 97.8, max: 99.1 } },
  { code: '2708-6', display: 'Oxygen Saturation', unit: '%', category: 'Oxygenation', normalRange: { min: 95, max: 100 } },
  { code: '39156-5', display: 'BMI', unit: 'kg/m²', category: 'Body Composition', normalRange: { min: 18.5, max: 24.9 } },
];

// Placeholder - will be loaded from API
const DIAGNOSIS_OPTIONS_DEFAULT = [];

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`cds-tabpanel-${index}`}
      aria-labelledby={`cds-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const CDSHooksBuilderEnhanced = () => {
  const [hooks, setHooks] = useState([]);
  const [selectedHook, setSelectedHook] = useState(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [testResults, setTestResults] = useState(null);
  const [tabValue, setTabValue] = useState(0);
  const [templates, setTemplates] = useState([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [dataSummary, setDataSummary] = useState(null);
  
  // State for lab test selector
  const [labSearchTerm, setLabSearchTerm] = useState('');
  const [labSelectedCategory, setLabSelectedCategory] = useState('all');
  
  // State for medication selector
  const [medSearchTerm, setMedSearchTerm] = useState('');
  const [selectedMedCategory, setSelectedMedCategory] = useState('all');
  
  // State for diagnosis selector
  const [diagSearchTerm, setDiagSearchTerm] = useState('');
  const [diagnosisOptions, setDiagnosisOptions] = useState([]);
  const [loadingDiagnoses, setLoadingDiagnoses] = useState(false);
  
  // State for lab tests and medications
  const [labTestOptions, setLabTestOptions] = useState([]);
  const [medicationOptions, setMedicationOptions] = useState([]);
  const [vitalSignOptions, setVitalSignOptions] = useState([]);
  const [loadingClinicalData, setLoadingClinicalData] = useState(false);

  // Hook configuration state
  const [hookConfig, setHookConfig] = useState({
    id: '',
    title: '',
    description: '',
    hook: 'patient-view',
    priority: 1,
    enabled: true,
    conditions: [],
    actions: [],
    fhirVersion: '4.0.1',
    prefetch: {},
    category: 'clinical',
  });

  // Available hook types and triggers
  const hookTypes = [
    {
      value: 'patient-view',
      label: 'Patient View',
      description: 'Triggered when a patient chart is opened',
      context: ['patientId', 'userId', 'encounterId'],
      icon: <AssessmentIcon />,
    },
    {
      value: 'medication-prescribe',
      label: 'Medication Prescribe',
      description: 'Triggered when prescribing medications',
      context: ['patientId', 'userId', 'encounterId', 'medications'],
      icon: <PharmacyIcon />,
    },
    {
      value: 'order-select',
      label: 'Order Select',
      description: 'Triggered when selecting diagnostic orders',
      context: ['patientId', 'userId', 'encounterId', 'selections'],
      icon: <ScienceIcon />,
    },
    {
      value: 'order-sign',
      label: 'Order Sign',
      description: 'Triggered when signing orders',
      context: ['patientId', 'userId', 'encounterId', 'draftOrders'],
      icon: <CheckCircleIcon />,
    }
  ];

  // Enhanced condition types
  const conditionTypes = [
    {
      value: 'patient-age',
      label: 'Patient Age',
      description: 'Check patient age against criteria',
      parameters: ['operator', 'value', 'unit'],
      category: 'Demographics',
      icon: <TimelineIcon />,
    },
    {
      value: 'patient-gender',
      label: 'Patient Gender',
      description: 'Check patient gender',
      parameters: ['value'],
      category: 'Demographics',
    },
    {
      value: 'diagnosis-code',
      label: 'Diagnosis Code',
      description: 'Check for specific ICD-10 codes',
      parameters: ['codes', 'operator', 'timeframe'],
      category: 'Clinical',
      hasSearch: true,
    },
    {
      value: 'medication-active',
      label: 'Active Medication',
      description: 'Check for active medications',
      parameters: ['medications', 'operator', 'interactions'],
      category: 'Medications',
      hasSearch: true,
    },
    {
      value: 'lab-value',
      label: 'Laboratory Value',
      description: 'Check specific lab results against thresholds',
      parameters: ['labTest', 'operator', 'value', 'unit', 'timeframe'],
      category: 'Laboratory',
      hasSearch: true,
    },
    {
      value: 'vital-sign',
      label: 'Vital Sign',
      description: 'Check vital signs against normal ranges',
      parameters: ['type', 'operator', 'value', 'timeframe'],
      category: 'Vitals',
      hasSearch: true,
    },
    {
      value: 'risk-score',
      label: 'Risk Score',
      description: 'Calculate and check risk scores',
      parameters: ['scoreType', 'operator', 'value'],
      category: 'Risk Assessment',
    },
    {
      value: 'care-gap',
      label: 'Care Gap',
      description: 'Identify gaps in care',
      parameters: ['gapType', 'timeframe'],
      category: 'Quality',
    },
    {
      value: 'lab-missing',
      label: 'Missing Lab Test',
      description: 'Check if a lab test has not been performed within a timeframe',
      parameters: ['labTest', 'timeframe'],
      category: 'Laboratory',
      hasSearch: true,
    },
    {
      value: 'medication-missing',
      label: 'Missing Medication',
      description: 'Check if patient is NOT on specific medications',
      parameters: ['medications'],
      category: 'Medications',
      hasSearch: true,
    },
  ];

  // Enhanced action types
  const actionTypes = [
    {
      value: 'info-card',
      label: 'Information Card',
      description: 'Display informational message',
      parameters: ['summary', 'detail', 'indicator', 'source', 'links'],
      icon: <NotificationIcon color="info" />,
    },
    {
      value: 'warning-card',
      label: 'Warning Card',
      description: 'Display warning message',
      parameters: ['summary', 'detail', 'indicator', 'source', 'links'],
      icon: <WarningIcon color="warning" />,
    },
    {
      value: 'critical-card',
      label: 'Critical Alert',
      description: 'Display critical alert',
      parameters: ['summary', 'detail', 'indicator', 'source', 'links', 'overrideRequired'],
      icon: <ErrorIcon color="error" />,
    },
    {
      value: 'suggestion',
      label: 'Suggestion',
      description: 'Provide actionable suggestion with FHIR resource',
      parameters: ['label', 'description', 'resource', 'type', 'isRecommended'],
      icon: <AutoAwesomeIcon />,
    },
    {
      value: 'link',
      label: 'External Link',
      description: 'Link to external resource',
      parameters: ['label', 'url', 'type', 'appContext'],
      icon: <LinkIcon />,
    },
    {
      value: 'create-resource',
      label: 'Create Resource',
      description: 'Suggest creating a new FHIR resource',
      parameters: ['resourceType', 'prefillData', 'reason'],
      icon: <AddIcon />,
    },
  ];

  // Common templates
  const hookTemplates = [
    {
      name: 'Drug-Drug Interaction Alert',
      category: 'safety',
      hook: 'medication-prescribe',
      description: 'Alert for potential drug interactions',
      conditions: [
        {
          type: 'medication-active',
          parameters: { operator: 'contains', interactions: true }
        }
      ],
      actions: [
        {
          type: 'warning-card',
          parameters: {
            summary: 'Potential Drug Interaction',
            indicator: 'warning'
          }
        }
      ]
    },
    {
      name: 'Diabetes Care Gap - A1C',
      category: 'quality',
      hook: 'patient-view',
      description: 'Identify missing diabetes A1C screenings',
      conditions: [
        {
          type: 'diagnosis-code',
          parameters: { codes: '44054006', operator: 'in' }  // SNOMED for Type 2 diabetes
        },
        {
          type: 'lab-missing',
          parameters: { labTest: '4548-4', timeframe: 90 }  // A1C test missing in 90 days
        }
      ],
      actions: [
        {
          type: 'suggestion',
          parameters: {
            label: 'Order HbA1c Test',
            description: 'Patient with diabetes is due for quarterly A1C monitoring (last >90 days ago)'
          }
        }
      ]
    },
    {
      name: 'Kidney Monitoring for Diabetes',
      category: 'quality',
      hook: 'patient-view',
      description: 'Monitor kidney function in diabetic patients',
      conditions: [
        {
          type: 'diagnosis-code',
          parameters: { codes: '44054006', operator: 'in' }  // Type 2 diabetes
        },
        {
          type: 'lab-missing',
          parameters: { labTest: '33914-3', timeframe: 365 }  // eGFR missing in 1 year
        }
      ],
      actions: [
        {
          type: 'info-card',
          parameters: {
            summary: 'Annual Kidney Function Screening Due',
            detail: 'Patient with diabetes needs annual kidney function monitoring (eGFR)',
            indicator: 'info',
            source: 'ADA Standards of Care'
          }
        }
      ]
    },
    {
      name: 'Hypertension Management',
      category: 'clinical',
      hook: 'patient-view',
      description: 'Blood pressure control recommendations',
      conditions: [
        {
          type: 'diagnosis-code',
          parameters: { codes: '38341003', operator: 'in' }  // SNOMED for Hypertension
        },
        {
          type: 'vital-sign',
          parameters: { type: '8480-6', operator: 'gt', value: 140 }
        }
      ],
      actions: [
        {
          type: 'warning-card',
          parameters: {
            summary: 'Elevated Blood Pressure',
            detail: 'Consider medication adjustment'
          }
        }
      ]
    },
  ];

  const fetchHooks = async () => {
    try {
      const response = await api.get('/cds-hooks/hooks');
      setHooks(response.data || []);
    } catch (error) {
      console.error('Error fetching CDS hooks:', error);
      setSnackbar({ open: true, message: 'Failed to fetch CDS hooks', severity: 'error' });
    }
  };

  const fetchDiagnosisCodes = async () => {
    try {
      setLoadingDiagnoses(true);
      const response = await api.get('/api/patient-data/conditions', { params: { limit: 200 } });
      // Map the response to match our expected format
      const codes = response.data.map(item => ({
        code: item.code,
        display: item.display,
        category: 'SNOMED CT',
        count: item.count,
        active_count: item.active_count,
        avg_duration_days: item.avg_duration_days
      }));
      setDiagnosisOptions(codes);
    } catch (error) {
      console.error('Error fetching diagnosis codes:', error);
      // Use some common SNOMED codes as fallback
      setDiagnosisOptions([
        { code: '38341003', display: 'Hypertension', category: 'SNOMED CT' },
        { code: '44054006', display: 'Diabetes mellitus type 2', category: 'SNOMED CT' },
        { code: '73595000', display: 'Stress', category: 'SNOMED CT' },
        { code: '195967001', display: 'Asthma', category: 'SNOMED CT' },
        { code: '53741008', display: 'Coronary artery disease', category: 'SNOMED CT' },
        { code: '49436004', display: 'Atrial fibrillation', category: 'SNOMED CT' },
        { code: '84114007', display: 'Heart failure', category: 'SNOMED CT' },
        { code: '13645005', display: 'COPD', category: 'SNOMED CT' },
        { code: '233604007', display: 'Pneumonia', category: 'SNOMED CT' },
        { code: '35489007', display: 'Depression', category: 'SNOMED CT' },
      ]);
    } finally {
      setLoadingDiagnoses(false);
    }
  };

  const fetchClinicalData = async () => {
    try {
      setLoadingClinicalData(true);
      
      // Fetch actual patient data using the new endpoints
      const [labTests, medications, vitalSigns] = await Promise.all([
        api.get('/api/patient-data/lab-tests', { params: { limit: 200 } }),
        api.get('/api/patient-data/medications', { params: { limit: 200 } }),
        api.get('/api/patient-data/vital-signs', { params: { limit: 50 } })
      ]);
      
      // Set lab tests - already in the correct format
      if (labTests.data?.length > 0) {
        setLabTestOptions(labTests.data);
      } else {
        setLabTestOptions(LAB_TEST_OPTIONS_DEFAULT);
      }
      
      // Set medications - already in the correct format
      if (medications.data?.length > 0) {
        setMedicationOptions(medications.data);
      } else {
        setMedicationOptions(MEDICATION_OPTIONS_DEFAULT);
      }
      
      // Set vital signs - already in the correct format
      if (vitalSigns.data?.length > 0) {
        setVitalSignOptions(vitalSigns.data);
      } else {
        setVitalSignOptions(VITAL_SIGN_OPTIONS_DEFAULT);
      }
      
    } catch (error) {
      console.error('Error fetching clinical data:', error);
      // Use defaults on error
      setLabTestOptions(LAB_TEST_OPTIONS_DEFAULT);
      setMedicationOptions(MEDICATION_OPTIONS_DEFAULT);
      setVitalSignOptions(VITAL_SIGN_OPTIONS_DEFAULT);
    } finally {
      setLoadingClinicalData(false);
    }
  };

  const fetchDataSummary = async () => {
    try {
      const response = await api.get('/api/actual-data/summary');
      setDataSummary(response.data);
    } catch (error) {
      console.error('Error fetching data summary:', error);
    }
  };

  useEffect(() => {
    fetchHooks();
    fetchDiagnosisCodes();
    fetchClinicalData();
    fetchDataSummary();
    setTemplates(hookTemplates);
  }, []);

  const handleCreateHook = () => {
    setHookConfig({
      id: '',
      title: '',
      description: '',
      hook: 'patient-view',
      priority: 1,
      enabled: true,
      conditions: [],
      actions: [],
      fhirVersion: '4.0.1',
      prefetch: {},
      category: 'clinical',
    });
    setSelectedHook(null);
    setActiveStep(0);
    setBuilderOpen(true);
  };

  const handleEditHook = (hook) => {
    setHookConfig(hook);
    setSelectedHook(hook);
    setActiveStep(0);
    setBuilderOpen(true);
  };

  const handleUseTemplate = (template) => {
    // Create a fresh hook config from template
    const newHookConfig = {
      id: '', // Empty ID for new hook
      title: template.name || '',
      description: template.description || '',
      hook: template.hook || 'patient-view',
      priority: 1,
      enabled: true,
      conditions: template.conditions.map(c => ({ ...c, id: Date.now() + Math.random() })),
      actions: template.actions.map(a => ({ ...a, id: Date.now() + Math.random() })),
      fhirVersion: '4.0.1',
      prefetch: {},
      category: template.category || 'clinical',
    };
    setHookConfig(newHookConfig);
    setSelectedHook(null); // Clear selected hook since this is a new one
    setActiveStep(0);
    setBuilderOpen(true);
  };

  const handleSaveHook = async () => {
    try {
      setLoading(true);
      let response;
      
      // Generate ID if not provided
      const hookToSave = {
        ...hookConfig,
        id: hookConfig.id || `hook-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      };
      
      console.log('Saving hook:', hookToSave);
      console.log('Selected hook:', selectedHook);
      
      // Check if this is an existing hook by looking it up in the hooks list
      const isExistingHook = hooks.some(h => h.id === hookToSave.id);
      
      if (isExistingHook) {
        const url = `/cds-hooks/hooks/${hookToSave.id}`;
        console.log('Updating existing hook at:', url);
        response = await api.put(url, hookToSave);
      } else {
        const url = '/cds-hooks/hooks';
        console.log('Creating new hook at:', url);
        response = await api.post(url, hookToSave);
      }
      
      await fetchHooks();
      setBuilderOpen(false);
      setSelectedHook(null);
      setSnackbar({ 
        open: true, 
        message: `Hook ${selectedHook ? 'updated' : 'created'} successfully`, 
        severity: 'success' 
      });
    } catch (error) {
      console.error('Error saving CDS hook:', error);
      console.error('Error response:', error.response);
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to save CDS hook';
      setSnackbar({ open: true, message: errorMessage, severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteHook = async (hookId) => {
    if (window.confirm('Are you sure you want to delete this hook?')) {
      try {
        await api.delete(`/cds-hooks/hooks/${hookId}`);
        await fetchHooks();
        setSnackbar({ open: true, message: 'Hook deleted successfully', severity: 'success' });
      } catch (error) {
        console.error('Error deleting CDS hook:', error);
        setSnackbar({ open: true, message: 'Failed to delete hook', severity: 'error' });
      }
    }
  };

  const handleTestHook = async (hook) => {
    setSelectedHook(hook);
    setTestDialogOpen(true);
    try {
      setLoading(true);
      const testUrl = `/cds-hooks/hooks/${hook.id}/test`;
      console.log('Testing hook at:', testUrl);
      console.log('Hook ID:', hook.id);
      const response = await api.post(testUrl, {
        patientId: '1',
        userId: 'test-user',
        encounterId: '1'
      });
      setTestResults(response.data);
    } catch (error) {
      console.error('Error testing CDS hook:', error);
      console.error('Error response:', error.response);
      setTestResults({ error: error.response?.data?.detail || error.message });
    } finally {
      setLoading(false);
    }
  };

  const addCondition = () => {
    setHookConfig(prev => ({
      ...prev,
      conditions: [...prev.conditions, {
        id: Date.now().toString(),
        type: 'patient-age',
        parameters: {},
        logic: prev.conditions.length > 0 ? 'AND' : null
      }]
    }));
  };

  const updateCondition = (conditionId, updates) => {
    setHookConfig(prev => ({
      ...prev,
      conditions: prev.conditions.map(cond =>
        cond.id === conditionId ? { ...cond, ...updates } : cond
      )
    }));
  };

  const removeCondition = (conditionId) => {
    setHookConfig(prev => ({
      ...prev,
      conditions: prev.conditions.filter(cond => cond.id !== conditionId)
    }));
  };

  const addAction = () => {
    setHookConfig(prev => ({
      ...prev,
      actions: [...prev.actions, {
        id: Date.now().toString(),
        type: 'info-card',
        parameters: {}
      }]
    }));
  };

  const updateAction = (actionId, updates) => {
    setHookConfig(prev => ({
      ...prev,
      actions: prev.actions.map(action =>
        action.id === actionId ? { ...action, ...updates } : action
      )
    }));
  };

  const removeAction = (actionId) => {
    setHookConfig(prev => ({
      ...prev,
      actions: prev.actions.filter(action => action.id !== actionId)
    }));
  };

  const renderLabTestSelector = (condition) => {
    const categories = ['all', ...new Set(labTestOptions.map(test => test.category))];
    const filteredTests = labTestOptions.filter(test => {
      const matchesSearch = test.display.toLowerCase().includes(labSearchTerm.toLowerCase()) ||
                           test.code.includes(labSearchTerm);
      const matchesCategory = labSelectedCategory === 'all' || test.category === labSelectedCategory;
      return matchesSearch && matchesCategory;
    });

    return (
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search lab tests..."
            value={labSearchTerm}
            onChange={(e) => setLabSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
        </Grid>
        <Grid item xs={12}>
          <FormControl size="small">
            <Select
              value={labSelectedCategory}
              onChange={(e) => setLabSelectedCategory(e.target.value)}
              displayEmpty
            >
              {categories.map(cat => (
                <MenuItem key={cat} value={cat}>
                  {cat === 'all' ? 'All Categories' : cat}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12}>
          {loadingClinicalData ? (
            <Box display="flex" alignItems="center" gap={2} p={2}>
              <CircularProgress size={20} />
              <Typography variant="body2">Loading lab tests...</Typography>
            </Box>
          ) : (
            <Autocomplete
              options={filteredTests}
              getOptionLabel={(option) => `${option.display} (${option.code})`}
              value={labTestOptions.find(test => test.code === condition.parameters.labTest) || null}
              onChange={(e, newValue) => {
                updateCondition(condition.id, {
                  parameters: { 
                    ...condition.parameters, 
                    code: newValue?.code || '',  // Backend expects 'code'
                    labTest: newValue?.code || '',  // Keep for display
                    unit: newValue?.unit || ''
                  }
                });
              }}
              renderOption={(props, option) => (
                <Box component="li" {...props}>
                  <Box sx={{ width: '100%' }}>
                    <Typography variant="body2">{option.display}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {option.code} | {option.category} | Used {option.count || 0} times
                      {option.unit && ` | Unit: ${option.unit}`}
                    </Typography>
                    {(option.min_value !== null || option.max_value !== null) && (
                      <Typography variant="caption" color="primary" display="block">
                        Range: {option.min_value !== null ? option.min_value.toFixed(2) : '?'} - {option.max_value !== null ? option.max_value.toFixed(2) : '?'}
                        {option.avg_value !== null && ` | Avg: ${option.avg_value.toFixed(2)}`}
                      </Typography>
                    )}
                  </Box>
                </Box>
              )}
              renderInput={(params) => (
                <TextField {...params} label="Select Lab Test" required />
              )}
            />
          )}
        </Grid>
      </Grid>
    );
  };

  const renderMedicationSelector = (condition) => {
    const categories = ['all', ...new Set(medicationOptions.map(med => med.category).filter(Boolean))];
    
    const filteredMeds = medicationOptions.filter(med => {
      const matchesSearch = (med.display || '').toLowerCase().includes(medSearchTerm.toLowerCase()) ||
                           (med.category || '').toLowerCase().includes(medSearchTerm.toLowerCase());
      const matchesCategory = selectedMedCategory === 'all' || med.category === selectedMedCategory;
      return matchesSearch && matchesCategory;
    });

    return (
      <Grid container spacing={2}>
        <Grid item xs={12} md={8}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search medications by name or class..."
            value={medSearchTerm}
            onChange={(e) => setMedSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <FormControl fullWidth size="small">
            <Select
              value={selectedMedCategory}
              onChange={(e) => setSelectedMedCategory(e.target.value)}
              displayEmpty
            >
              {categories.map(cat => (
                <MenuItem key={cat} value={cat}>
                  {cat === 'all' ? 'All Drug Classes' : cat}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12}>
          <Autocomplete
            multiple
            options={filteredMeds}
            getOptionLabel={(option) => option.display}
            value={medicationOptions.filter(med => 
              condition.parameters.medications?.includes(med.code)
            )}
            onChange={(e, newValue) => {
              updateCondition(condition.id, {
                parameters: { 
                  ...condition.parameters, 
                  medications: newValue.map(v => v.code)
                }
              });
            }}
            renderOption={(props, option) => (
              <Box component="li" {...props}>
                <Box sx={{ width: '100%' }}>
                  <Typography variant="body2">{option.display}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {option.category} | Prescribed {option.count || 0} times
                  </Typography>
                  {(option.common_dosages?.length > 0 || option.common_routes?.length > 0) && (
                    <Typography variant="caption" color="primary" display="block">
                      {option.common_dosages?.length > 0 && `Dosages: ${option.common_dosages.slice(0, 2).join(', ')}`}
                      {option.common_routes?.length > 0 && ` | Routes: ${option.common_routes.join(', ')}`}
                    </Typography>
                  )}
                </Box>
              </Box>
            )}
            renderInput={(params) => (
              <TextField 
                {...params} 
                label="Select Medications" 
                required
                helperText={condition.parameters.medications?.length > 0 ? 
                  `${condition.parameters.medications.length} medication(s) selected` : 
                  'Start typing to search medications'
                }
              />
            )}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip
                  variant="outlined"
                  label={option.display}
                  size="small"
                  color="primary"
                  {...getTagProps({ index })}
                />
              ))
            }
          />
        </Grid>
        <Grid item xs={12}>
          <FormControl component="fieldset">
            <FormLabel component="legend">Condition Options</FormLabel>
            <FormGroup row>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={condition.parameters.interactions || false}
                    onChange={(e) => updateCondition(condition.id, {
                      parameters: { ...condition.parameters, interactions: e.target.checked }
                    })}
                  />
                }
                label="Check for drug interactions"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={condition.parameters.checkAllergies || false}
                    onChange={(e) => updateCondition(condition.id, {
                      parameters: { ...condition.parameters, checkAllergies: e.target.checked }
                    })}
                  />
                }
                label="Check for allergies"
              />
            </FormGroup>
          </FormControl>
        </Grid>
      </Grid>
    );
  };

  const renderDiagnosisSelector = (condition) => {
    const filteredDiagnoses = diagnosisOptions.filter(diag =>
      diag.display.toLowerCase().includes(diagSearchTerm.toLowerCase()) ||
      diag.code.toLowerCase().includes(diagSearchTerm.toLowerCase())
    );

    return (
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search diagnoses..."
            value={diagSearchTerm}
            onChange={(e) => setDiagSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
        </Grid>
        <Grid item xs={12}>
          <Autocomplete
            multiple
            options={filteredDiagnoses}
            getOptionLabel={(option) => `${option.code} - ${option.display}`}
            value={diagnosisOptions.filter(diag => 
              condition.parameters.codes?.split(',').map(c => c.trim()).includes(diag.code)
            )}
            onChange={(e, newValue) => {
              updateCondition(condition.id, {
                parameters: { 
                  ...condition.parameters, 
                  codes: newValue.map(v => v.code).join(', ')
                }
              });
            }}
            renderOption={(props, option) => (
              <Box component="li" {...props}>
                <Box sx={{ width: '100%' }}>
                  <Typography variant="body2">
                    <strong>{option.code}</strong> - {option.display}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {option.category} | Diagnosed {option.count || 0} times
                    {option.active_count !== undefined && ` | ${option.active_count} active cases`}
                  </Typography>
                  {option.avg_duration_days && (
                    <Typography variant="caption" color="primary" display="block">
                      Avg duration: {option.avg_duration_days} days
                    </Typography>
                  )}
                </Box>
              </Box>
            )}
            renderInput={(params) => (
              <TextField {...params} label="Select Diagnoses" />
            )}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip
                  variant="outlined"
                  label={option.code}
                  size="small"
                  {...getTagProps({ index })}
                />
              ))
            }
          />
        </Grid>
      </Grid>
    );
  };

  const renderConditionBuilder = (condition, index) => {
    const conditionType = conditionTypes.find(t => t.value === condition.type);
    
    return (
      <Card key={condition.id} variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box display="flex" alignItems="center" gap={1}>
              {conditionType?.icon}
              <Typography variant="h6">
                {index > 0 && (
                  <Chip 
                    label={condition.logic || 'AND'} 
                    size="small" 
                    color="primary" 
                    sx={{ mr: 1 }}
                    onClick={() => {
                      updateCondition(condition.id, {
                        logic: condition.logic === 'AND' ? 'OR' : 'AND'
                      });
                    }}
                  />
                )}
                Condition {index + 1}
              </Typography>
            </Box>
            <IconButton onClick={() => removeCondition(condition.id)} color="error">
              <DeleteIcon />
            </IconButton>
          </Box>
          
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Condition Type</InputLabel>
                <Select
                  value={condition.type}
                  onChange={(e) => updateCondition(condition.id, { type: e.target.value, parameters: {} })}
                  label="Condition Type"
                >
                  {conditionTypes.map(type => (
                    <MenuItem key={type.value} value={type.value}>
                      <Box display="flex" alignItems="center" gap={1}>
                        {type.icon}
                        {type.label}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            {conditionType && (
              <Grid item xs={12} md={8}>
                <Grid container spacing={2}>
                  {/* Special handling for lab tests */}
                  {(condition.type === 'lab-value' || condition.type === 'lab-missing') && conditionType.parameters.includes('labTest') && (
                    <Grid item xs={12}>
                      {renderLabTestSelector(condition)}
                    </Grid>
                  )}
                  
                  {/* Special handling for medications */}
                  {(condition.type === 'medication-active' || condition.type === 'medication-missing') && conditionType.parameters.includes('medications') && (
                    <Grid item xs={12}>
                      {renderMedicationSelector(condition)}
                    </Grid>
                  )}
                  
                  {/* Special handling for diagnoses */}
                  {condition.type === 'diagnosis-code' && conditionType.parameters.includes('codes') && (
                    <Grid item xs={12}>
                      {renderDiagnosisSelector(condition)}
                    </Grid>
                  )}
                  
                  {/* Vital signs selector */}
                  {condition.type === 'vital-sign' && conditionType.parameters.includes('type') && (
                    <>
                      <Grid item xs={12} md={6}>
                        <FormControl fullWidth>
                          <InputLabel>Vital Sign Type</InputLabel>
                          <Select
                            value={condition.parameters.type || ''}
                            onChange={(e) => {
                              const selectedVital = vitalSignOptions.find(v => v.code === e.target.value);
                              updateCondition(condition.id, {
                                parameters: { 
                                  ...condition.parameters, 
                                  type: e.target.value,
                                  unit: selectedVital?.unit || '',
                                  // Reset component if changing from/to blood pressure
                                  component: e.target.value === '85354-9' ? 'systolic' : undefined
                                }
                              });
                            }}
                            label="Vital Sign Type"
                            renderValue={(selected) => {
                              const vital = vitalSignOptions.find(v => v.code === selected);
                              return vital ? `${vital.display} (${vital.count || 0} records)` : selected;
                            }}
                          >
                            <MenuItem value="85354-9">Blood Pressure</MenuItem>
                            {vitalSignOptions.map(vital => (
                              <MenuItem key={vital.code} value={vital.code}>
                                <Box>
                                  <Typography variant="body2">{vital.display}</Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {vital.count || 0} records | Unit: {vital.unit}
                                    {(vital.min_value !== null && vital.max_value !== null) && 
                                      ` | Range: ${vital.min_value.toFixed(1)}-${vital.max_value.toFixed(1)}`
                                    }
                                  </Typography>
                                </Box>
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                      
                      {/* Blood pressure component selector */}
                      {condition.parameters.type === '85354-9' && (
                        <Grid item xs={12} md={3}>
                          <FormControl fullWidth>
                            <InputLabel>Component</InputLabel>
                            <Select
                              value={condition.parameters.component || 'systolic'}
                              onChange={(e) => updateCondition(condition.id, {
                                parameters: { ...condition.parameters, component: e.target.value }
                              })}
                              label="Component"
                            >
                              <MenuItem value="systolic">Systolic</MenuItem>
                              <MenuItem value="diastolic">Diastolic</MenuItem>
                            </Select>
                          </FormControl>
                        </Grid>
                      )}
                    </>
                  )}
                  
                  {/* Standard fields */}
                  {conditionType.parameters.includes('operator') && 
                   !['medication-active', 'diagnosis-code', 'lab-missing', 'medication-missing'].includes(condition.type) && (
                    <Grid item xs={12} md={3}>
                      <FormControl fullWidth>
                        <InputLabel>Operator</InputLabel>
                        <Select
                          value={condition.parameters.operator || ''}
                          onChange={(e) => updateCondition(condition.id, {
                            parameters: { ...condition.parameters, operator: e.target.value }
                          })}
                          label="Operator"
                        >
                          <MenuItem value="eq">Equals</MenuItem>
                          <MenuItem value="ne">Not Equals</MenuItem>
                          <MenuItem value="gt">Greater Than</MenuItem>
                          <MenuItem value="ge">Greater or Equal</MenuItem>
                          <MenuItem value="lt">Less Than</MenuItem>
                          <MenuItem value="le">Less or Equal</MenuItem>
                          <MenuItem value="contains">Contains</MenuItem>
                          <MenuItem value="missing">Is Missing</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                  )}
                  
                  {conditionType.parameters.includes('value') && (
                    <Grid item xs={12} md={3}>
                      <TextField
                        fullWidth
                        label="Value"
                        value={condition.parameters.value || ''}
                        onChange={(e) => updateCondition(condition.id, {
                          parameters: { ...condition.parameters, value: e.target.value }
                        })}
                        type={['patient-age', 'lab-value', 'vital-sign'].includes(condition.type) ? 'number' : 'text'}
                      />
                    </Grid>
                  )}
                  
                  {conditionType.parameters.includes('unit') && (
                    <Grid item xs={12} md={2}>
                      <TextField
                        fullWidth
                        label="Unit"
                        value={condition.parameters.unit || ''}
                        onChange={(e) => updateCondition(condition.id, {
                          parameters: { ...condition.parameters, unit: e.target.value }
                        })}
                        disabled={condition.type === 'vital-sign'}
                      />
                    </Grid>
                  )}
                  
                  {conditionType.parameters.includes('timeframe') && (
                    <Grid item xs={12} md={3}>
                      <TextField
                        fullWidth
                        label="Timeframe (days)"
                        type="number"
                        value={condition.parameters.timeframe || ''}
                        onChange={(e) => updateCondition(condition.id, {
                          parameters: { ...condition.parameters, timeframe: e.target.value }
                        })}
                        helperText="How far back to look"
                      />
                    </Grid>
                  )}
                </Grid>
              </Grid>
            )}
          </Grid>
          
          {conditionType && (
            <Alert severity="info" sx={{ mt: 2 }}>
              {conditionType.description}
            </Alert>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderActionBuilder = (action, index) => {
    const actionType = actionTypes.find(t => t.value === action.type);
    
    return (
      <Card key={action.id} variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box display="flex" alignItems="center" gap={1}>
              {actionType?.icon}
              <Typography variant="h6">Action {index + 1}</Typography>
            </Box>
            <IconButton onClick={() => removeAction(action.id)} color="error">
              <DeleteIcon />
            </IconButton>
          </Box>
          
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Action Type</InputLabel>
                <Select
                  value={action.type}
                  onChange={(e) => updateAction(action.id, { type: e.target.value, parameters: {} })}
                  label="Action Type"
                >
                  {actionTypes.map(type => (
                    <MenuItem key={type.value} value={type.value}>
                      <Box display="flex" alignItems="center" gap={1}>
                        {type.icon}
                        {type.label}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            {actionType && (
              <Grid item xs={12} md={8}>
                <Grid container spacing={2}>
                  {actionType.parameters.includes('summary') && (
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Summary"
                        value={action.parameters.summary || ''}
                        onChange={(e) => updateAction(action.id, {
                          parameters: { ...action.parameters, summary: e.target.value }
                        })}
                        required
                      />
                    </Grid>
                  )}
                  
                  {actionType.parameters.includes('detail') && (
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        multiline
                        rows={3}
                        label="Detail"
                        value={action.parameters.detail || ''}
                        onChange={(e) => updateAction(action.id, {
                          parameters: { ...action.parameters, detail: e.target.value }
                        })}
                        helperText="Detailed explanation or recommendation"
                      />
                    </Grid>
                  )}
                  
                  {actionType.parameters.includes('indicator') && (
                    <Grid item xs={12} md={4}>
                      <FormControl fullWidth>
                        <InputLabel>Indicator</InputLabel>
                        <Select
                          value={action.parameters.indicator || ''}
                          onChange={(e) => updateAction(action.id, {
                            parameters: { ...action.parameters, indicator: e.target.value }
                          })}
                          label="Indicator"
                        >
                          <MenuItem value="info">Info</MenuItem>
                          <MenuItem value="warning">Warning</MenuItem>
                          <MenuItem value="critical">Critical</MenuItem>
                          <MenuItem value="success">Success</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                  )}
                  
                  {actionType.parameters.includes('source') && (
                    <Grid item xs={12} md={8}>
                      <TextField
                        fullWidth
                        label="Source"
                        value={action.parameters.source || ''}
                        onChange={(e) => updateAction(action.id, {
                          parameters: { ...action.parameters, source: e.target.value }
                        })}
                        placeholder="e.g., Clinical Guidelines, Evidence-based Medicine"
                      />
                    </Grid>
                  )}
                  
                  {actionType.parameters.includes('label') && (
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Label"
                        value={action.parameters.label || ''}
                        onChange={(e) => updateAction(action.id, {
                          parameters: { ...action.parameters, label: e.target.value }
                        })}
                      />
                    </Grid>
                  )}
                  
                  {actionType.parameters.includes('url') && (
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="URL"
                        value={action.parameters.url || ''}
                        onChange={(e) => updateAction(action.id, {
                          parameters: { ...action.parameters, url: e.target.value }
                        })}
                      />
                    </Grid>
                  )}
                  
                  {actionType.parameters.includes('isRecommended') && (
                    <Grid item xs={12}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={action.parameters.isRecommended || false}
                            onChange={(e) => updateAction(action.id, {
                              parameters: { ...action.parameters, isRecommended: e.target.checked }
                            })}
                          />
                        }
                        label="Mark as recommended action"
                      />
                    </Grid>
                  )}
                  
                  {actionType.parameters.includes('overrideRequired') && (
                    <Grid item xs={12}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={action.parameters.overrideRequired || false}
                            onChange={(e) => updateAction(action.id, {
                              parameters: { ...action.parameters, overrideRequired: e.target.checked }
                            })}
                          />
                        }
                        label="Require override reason"
                      />
                    </Grid>
                  )}
                </Grid>
              </Grid>
            )}
          </Grid>
          
          {actionType && (
            <Alert severity="info" sx={{ mt: 2 }}>
              {actionType.description}
            </Alert>
          )}
        </CardContent>
      </Card>
    );
  };

  const steps = [
    {
      label: 'Basic Information',
      content: (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Hook ID"
              value={hookConfig.id}
              onChange={(e) => setHookConfig(prev => ({ ...prev, id: e.target.value }))}
              placeholder="unique-hook-id"
              required
              helperText="Unique identifier for this hook"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Title"
              value={hookConfig.title}
              onChange={(e) => setHookConfig(prev => ({ ...prev, title: e.target.value }))}
              required
              helperText="Display name for the hook"
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Description"
              value={hookConfig.description}
              onChange={(e) => setHookConfig(prev => ({ ...prev, description: e.target.value }))}
              helperText="Detailed description of what this hook does"
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>Hook Type</InputLabel>
              <Select
                value={hookConfig.hook}
                onChange={(e) => setHookConfig(prev => ({ ...prev, hook: e.target.value }))}
                label="Hook Type"
              >
                {hookTypes.map(type => (
                  <MenuItem key={type.value} value={type.value}>
                    <Box display="flex" alignItems="center" gap={1}>
                      {type.icon}
                      {type.label}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                value={hookConfig.category || 'clinical'}
                onChange={(e) => setHookConfig(prev => ({ ...prev, category: e.target.value }))}
                label="Category"
              >
                <MenuItem value="clinical">Clinical</MenuItem>
                <MenuItem value="safety">Safety</MenuItem>
                <MenuItem value="quality">Quality</MenuItem>
                <MenuItem value="efficiency">Efficiency</MenuItem>
                <MenuItem value="research">Research</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              type="number"
              label="Priority"
              value={hookConfig.priority}
              onChange={(e) => setHookConfig(prev => ({ ...prev, priority: parseInt(e.target.value) }))}
              InputProps={{ inputProps: { min: 1, max: 10 } }}
              helperText="1 (highest) to 10 (lowest)"
            />
          </Grid>
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={hookConfig.enabled}
                  onChange={(e) => setHookConfig(prev => ({ ...prev, enabled: e.target.checked }))}
                />
              }
              label="Enabled"
            />
          </Grid>
        </Grid>
      )
    },
    {
      label: 'Conditions',
      content: (
        <Box>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">Define Conditions</Typography>
            <Button startIcon={<AddIcon />} onClick={addCondition} variant="outlined">
              Add Condition
            </Button>
          </Box>
          
          {hookConfig.conditions.length === 0 ? (
            <Alert severity="info">
              No conditions defined. The hook will trigger for all contexts.
            </Alert>
          ) : (
            hookConfig.conditions.map((condition, index) => 
              renderConditionBuilder(condition, index)
            )
          )}
        </Box>
      )
    },
    {
      label: 'Actions',
      content: (
        <Box>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">Define Actions</Typography>
            <Button startIcon={<AddIcon />} onClick={addAction} variant="outlined">
              Add Action
            </Button>
          </Box>
          
          {hookConfig.actions.length === 0 ? (
            <Alert severity="warning">
              No actions defined. Add at least one action for the hook to be useful.
            </Alert>
          ) : (
            hookConfig.actions.map((action, index) => 
              renderActionBuilder(action, index)
            )
          )}
        </Box>
      )
    },
    {
      label: 'Review & Test',
      content: (
        <Box>
          <Typography variant="h6" gutterBottom>Review Configuration</Typography>
          
          <Card variant="outlined" sx={{ mb: 3, p: 2, bgcolor: 'grey.50' }}>
            <Typography variant="subtitle2" gutterBottom color="primary">
              Hook Summary
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="body2"><strong>ID:</strong> {hookConfig.id}</Typography>
                <Typography variant="body2"><strong>Title:</strong> {hookConfig.title}</Typography>
                <Typography variant="body2"><strong>Type:</strong> {hookConfig.hook}</Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="body2"><strong>Category:</strong> {hookConfig.category}</Typography>
                <Typography variant="body2"><strong>Priority:</strong> {hookConfig.priority}</Typography>
                <Typography variant="body2"><strong>Status:</strong> {hookConfig.enabled ? 'Enabled' : 'Disabled'}</Typography>
              </Grid>
            </Grid>
          </Card>
          
          <Typography variant="subtitle2" gutterBottom>
            Conditions ({hookConfig.conditions.length})
          </Typography>
          <List dense>
            {hookConfig.conditions.map((condition, index) => {
              const condType = conditionTypes.find(t => t.value === condition.type);
              return (
                <ListItem key={condition.id}>
                  <ListItemIcon>{condType?.icon}</ListItemIcon>
                  <ListItemText
                    primary={`${index > 0 ? condition.logic + ' ' : ''}${condType?.label}`}
                    secondary={JSON.stringify(condition.parameters)}
                  />
                </ListItem>
              );
            })}
          </List>
          
          <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
            Actions ({hookConfig.actions.length})
          </Typography>
          <List dense>
            {hookConfig.actions.map((action) => {
              const actType = actionTypes.find(t => t.value === action.type);
              return (
                <ListItem key={action.id}>
                  <ListItemIcon>{actType?.icon}</ListItemIcon>
                  <ListItemText
                    primary={actType?.label}
                    secondary={action.parameters.summary || action.parameters.label || actType?.description}
                  />
                </ListItem>
              );
            })}
          </List>
          
          <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<PlayIcon />}
              onClick={() => {
                if (!hookConfig.id) {
                  setSnackbar({ 
                    open: true, 
                    message: 'Please save the hook before testing', 
                    severity: 'warning' 
                  });
                } else {
                  handleTestHook(hookConfig);
                }
              }}
            >
              Test Hook
            </Button>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={handleSaveHook}
              disabled={loading || !hookConfig.title}
            >
              {hooks.some(h => h.id === hookConfig.id) ? 'Update Hook' : 'Create Hook'}
            </Button>
          </Box>
        </Box>
      )
    }
  ];

  const filteredHooks = hooks.filter(hook => {
    const matchesSearch = hook.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         hook.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         hook.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === 'all' || hook.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" gutterBottom>
            CDS Hooks Builder
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Create and manage clinical decision support hooks using actual patient data for enhanced clinical relevance
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreateHook}
          size="large"
        >
          Create New Hook
        </Button>
      </Box>

      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
          <Tab label="Active Hooks" icon={<Badge badgeContent={hooks.filter(h => h.enabled).length} color="primary"><RuleIcon /></Badge>} />
          <Tab label="Data Overview" icon={<AssessmentIcon />} />
          <Tab label="Templates" icon={<AutoAwesomeIcon />} />
          <Tab label="Test Console" icon={<PreviewIcon />} />
          <Tab label="Documentation" icon={<HelpIcon />} />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <Box sx={{ mb: 3 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  placeholder="Search hooks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    label="Category"
                  >
                    <MenuItem value="all">All Categories</MenuItem>
                    <MenuItem value="clinical">Clinical</MenuItem>
                    <MenuItem value="safety">Safety</MenuItem>
                    <MenuItem value="quality">Quality</MenuItem>
                    <MenuItem value="efficiency">Efficiency</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Box>

          {filteredHooks.length === 0 ? (
            <Alert severity="info">
              No hooks found. Create your first CDS hook to get started.
            </Alert>
          ) : (
            <Grid container spacing={2}>
              {filteredHooks.map((hook) => (
                <Grid item xs={12} md={6} key={hook.id}>
                  <Card>
                    <CardContent>
                      <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                        <Box>
                          <Typography variant="h6">{hook.title}</Typography>
                          <Typography variant="body2" color="text.secondary" paragraph>
                            {hook.description}
                          </Typography>
                          <Stack direction="row" spacing={1}>
                            <Chip 
                              label={hook.hook} 
                              size="small" 
                              color="primary" 
                              variant="outlined"
                              icon={hookTypes.find(h => h.value === hook.hook)?.icon}
                            />
                            <Chip 
                              label={hook.category || 'clinical'} 
                              size="small" 
                              variant="outlined"
                            />
                            <Chip 
                              label={hook.enabled ? 'Enabled' : 'Disabled'} 
                              size="small" 
                              color={hook.enabled ? 'success' : 'default'}
                            />
                            <Chip 
                              label={`Priority: ${hook.priority}`} 
                              size="small" 
                              variant="outlined"
                            />
                          </Stack>
                        </Box>
                        <Box>
                          <IconButton onClick={() => handleEditHook(hook)}>
                            <EditIcon />
                          </IconButton>
                          <IconButton onClick={() => handleTestHook(hook)}>
                            <PlayIcon />
                          </IconButton>
                          <IconButton onClick={() => handleDeleteHook(hook.id)} color="error">
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Typography variant="h6" gutterBottom>
            Available Clinical Data Overview
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            This overview shows the actual clinical data available in your system for creating CDS hooks
          </Typography>
          
          {dataSummary ? (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Box display="flex" alignItems="center" gap={2} mb={2}>
                      <ScienceIcon color="primary" />
                      <Typography variant="h6">Laboratory Tests</Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Actual lab tests performed on patients
                    </Typography>
                    <Box display="flex" justifyContent="space-between" mt={2}>
                      <Box>
                        <Typography variant="h4" color="primary">
                          {dataSummary.lab_tests?.distinct_tests || 0}
                        </Typography>
                        <Typography variant="caption">Distinct Tests</Typography>
                      </Box>
                      <Box>
                        <Typography variant="h4" color="secondary">
                          {dataSummary.lab_tests?.total_observations || 0}
                        </Typography>
                        <Typography variant="caption">Total Results</Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Box display="flex" alignItems="center" gap={2} mb={2}>
                      <FavoriteIcon color="error" />
                      <Typography variant="h6">Vital Signs</Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Vital signs recorded for patients
                    </Typography>
                    <Box display="flex" justifyContent="space-between" mt={2}>
                      <Box>
                        <Typography variant="h4" color="primary">
                          {dataSummary.vital_signs?.distinct_vitals || 0}
                        </Typography>
                        <Typography variant="caption">Distinct Vitals</Typography>
                      </Box>
                      <Box>
                        <Typography variant="h4" color="secondary">
                          {dataSummary.vital_signs?.total_observations || 0}
                        </Typography>
                        <Typography variant="caption">Total Records</Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Box display="flex" alignItems="center" gap={2} mb={2}>
                      <PharmacyIcon color="success" />
                      <Typography variant="h6">Medications</Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Medications prescribed to patients
                    </Typography>
                    <Box display="flex" justifyContent="space-between" mt={2}>
                      <Box>
                        <Typography variant="h4" color="primary">
                          {dataSummary.medications?.distinct_medications || 0}
                        </Typography>
                        <Typography variant="caption">Distinct Meds</Typography>
                      </Box>
                      <Box>
                        <Typography variant="h4" color="secondary">
                          {dataSummary.medications?.total_prescriptions || 0}
                        </Typography>
                        <Typography variant="caption">Total Prescriptions</Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Box display="flex" alignItems="center" gap={2} mb={2}>
                      <AssessmentIcon color="warning" />
                      <Typography variant="h6">Conditions</Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Medical conditions diagnosed for patients
                    </Typography>
                    <Box display="flex" justifyContent="space-between" mt={2}>
                      <Box>
                        <Typography variant="h4" color="primary">
                          {dataSummary.conditions?.distinct_conditions || 0}
                        </Typography>
                        <Typography variant="caption">Distinct Conditions</Typography>
                      </Box>
                      <Box>
                        <Typography variant="h4" color="secondary">
                          {dataSummary.conditions?.total_diagnoses || 0}
                        </Typography>
                        <Typography variant="caption">Total Diagnoses</Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          ) : (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          )}

          <Alert severity="success" sx={{ mt: 3 }}>
            <Typography variant="body2">
              <strong>Real Data Integration:</strong> This CDS Hooks Builder is powered by actual patient data from your EMR system. 
              All lab tests, medications, vital signs, and conditions shown are based on real clinical data that has been recorded for patients.
              This ensures your CDS rules are relevant to your actual patient population and clinical workflows.
            </Typography>
          </Alert>
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Typography variant="h6" gutterBottom>
            Hook Templates
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Start with a pre-configured template and customize it to your needs
          </Typography>
          
          <Grid container spacing={2}>
            {templates.map((template, index) => (
              <Grid item xs={12} md={4} key={index}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      {template.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" paragraph>
                      {template.description}
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                      <Chip label={template.category} size="small" />
                      <Chip label={template.hook} size="small" variant="outlined" />
                    </Stack>
                    <Button
                      fullWidth
                      variant="outlined"
                      onClick={() => handleUseTemplate(template)}
                    >
                      Use Template
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <Typography variant="h6" gutterBottom>
            Test Console
          </Typography>
          <Alert severity="info" sx={{ mb: 2 }}>
            Test your hooks with sample patient data to see how they behave
          </Alert>
          
          {/* Test console implementation would go here */}
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary">
              Select a hook from the Active Hooks tab and click the test button to see results here
            </Typography>
          </Box>
        </TabPanel>

        <TabPanel value={tabValue} index={4}>
          <Typography variant="h6" gutterBottom>
            CDS Hooks Documentation
          </Typography>
          
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">Hook Types</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                {hookTypes.map((type) => (
                  <Grid item xs={12} md={6} key={type.value}>
                    <Card variant="outlined">
                      <CardContent>
                        <Box display="flex" alignItems="center" gap={1} mb={1}>
                          {type.icon}
                          <Typography variant="h6">{type.label}</Typography>
                        </Box>
                        <Typography variant="body2" paragraph>
                          {type.description}
                        </Typography>
                        <Typography variant="subtitle2">Context:</Typography>
                        <Stack direction="row" spacing={0.5}>
                          {type.context.map(ctx => (
                            <Chip key={ctx} label={ctx} size="small" variant="outlined" />
                          ))}
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">Condition Types</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                {conditionTypes.map((type) => (
                  <Grid item xs={12} md={6} key={type.value}>
                    <Card variant="outlined">
                      <CardContent>
                        <Box display="flex" alignItems="center" gap={1} mb={1}>
                          {type.icon}
                          <Typography variant="subtitle1">{type.label}</Typography>
                        </Box>
                        <Typography variant="body2" paragraph>
                          {type.description}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Category: {type.category}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">Best Practices</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <List>
                <ListItem>
                  <ListItemText
                    primary="Use specific conditions"
                    secondary="The more specific your conditions, the more targeted your alerts will be"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Provide actionable guidance"
                    secondary="Include clear recommendations and next steps in your actions"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Test thoroughly"
                    secondary="Use the test console to validate your hooks with different scenarios"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Monitor performance"
                    secondary="Review hook analytics to ensure they're providing value without alert fatigue"
                  />
                </ListItem>
              </List>
            </AccordionDetails>
          </Accordion>
        </TabPanel>
      </Paper>

      {/* Builder Dialog */}
      <Dialog open={builderOpen} onClose={() => setBuilderOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          {selectedHook ? 'Edit CDS Hook' : 'Create New CDS Hook'}
        </DialogTitle>
        <DialogContent>
          <Stepper activeStep={activeStep} sx={{ pt: 3, pb: 5 }}>
            {steps.map((step, index) => (
              <Step key={step.label}>
                <StepLabel>{step.label}</StepLabel>
              </Step>
            ))}
          </Stepper>
          {steps[activeStep].content}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBuilderOpen(false)}>Cancel</Button>
          {activeStep > 0 && (
            <Button onClick={() => setActiveStep(prev => prev - 1)}>Back</Button>
          )}
          {activeStep < steps.length - 1 && (
            <Button 
              variant="contained" 
              onClick={() => setActiveStep(prev => prev + 1)}
              disabled={activeStep === 0 && (!hookConfig.id || !hookConfig.title)}
            >
              Next
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Test Results Dialog */}
      <Dialog open={testDialogOpen} onClose={() => setTestDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Test Results</DialogTitle>
        <DialogContent>
          {loading ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          ) : testResults ? (
            <Box>
              {testResults.error ? (
                <Alert severity="error">{testResults.error}</Alert>
              ) : (
                <>
                  <Typography variant="subtitle2" gutterBottom>
                    Cards Generated: {testResults.cards?.length || 0}
                  </Typography>
                  {testResults.cards?.map((card, index) => (
                    <Card key={index} variant="outlined" sx={{ mb: 2 }}>
                      <CardContent>
                        <Box display="flex" alignItems="center" gap={1} mb={1}>
                          {card.indicator === 'warning' && <WarningIcon color="warning" />}
                          {card.indicator === 'critical' && <ErrorIcon color="error" />}
                          {card.indicator === 'info' && <NotificationIcon color="info" />}
                          <Typography variant="h6">{card.summary}</Typography>
                        </Box>
                        <Typography variant="body2" paragraph>
                          {card.detail}
                        </Typography>
                        {card.source && (
                          <Typography variant="caption" color="text.secondary">
                            Source: {card.source.label}
                          </Typography>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </>
              )}
            </Box>
          ) : (
            <Typography>No test results available</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTestDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        message={snackbar.message}
      />
    </Box>
  );
};

export default CDSHooksBuilderEnhanced;