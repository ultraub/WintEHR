import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Tab,
  Tabs,
  IconButton,
  Tooltip,
  Divider,
  Switch,
  FormControlLabel,
  Autocomplete,
  Stack,
  Badge,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  FormGroup,
  Checkbox,
  Radio,
  RadioGroup,
  Slider,
  ToggleButton,
  ToggleButtonGroup,
  Snackbar,
  LinearProgress,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Search as SearchIcon,
  Code as CodeIcon,
  Api as ApiIcon,
  Description as DescriptionIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  Send as SendIcon,
  Clear as ClearIcon,
  Link as LinkIcon,
  History as HistoryIcon,
  Build as BuildIcon,
  Visibility as VisibilityIcon,
  Download as DownloadIcon,
  FilterList as FilterIcon,
  Help as HelpIcon,
  PlayArrow as PlayIcon,
  Save as SaveIcon,
  Share as ShareIcon,
  Favorite as FavoriteIcon,
  School as SchoolIcon,
  Person as PersonIcon,
  LocalHospital as HospitalIcon,
  Science as ScienceIcon,
  Medication as MedicationIcon,
  Assessment as AssessmentIcon,
  Event as EventIcon,
  LocationOn as LocationIcon,
  TipsAndUpdates as TipsIcon,
  AutoAwesome as AutoAwesomeIcon,
  ArrowBack as ArrowBackIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import json from 'react-syntax-highlighter/dist/esm/languages/hljs/json';
import bash from 'react-syntax-highlighter/dist/esm/languages/hljs/bash';
import { docco } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import api from '../services/api';

SyntaxHighlighter.registerLanguage('json', json);
SyntaxHighlighter.registerLanguage('bash', bash);

// Resource icons mapping
const RESOURCE_ICONS = {
  Patient: <PersonIcon />,
  Encounter: <EventIcon />,
  Observation: <ScienceIcon />,
  Condition: <HospitalIcon />,
  MedicationRequest: <MedicationIcon />,
  Practitioner: <PersonIcon />,
  Organization: <HospitalIcon />,
  Location: <LocationIcon />,
  DiagnosticReport: <AssessmentIcon />,
  ImagingStudy: <AssessmentIcon />,
};

const FHIR_RESOURCES = [
  'Patient',
  'Encounter',
  'Observation',
  'Condition',
  'MedicationRequest',
  'Practitioner',
  'Organization',
  'Location',
  'DiagnosticReport',
  'ImagingStudy',
  'Procedure',
  'AllergyIntolerance',
  'CarePlan',
  'Immunization',
];

// Enhanced search parameters with better organization
const SEARCH_PARAMETERS = {
  Patient: {
    basic: [
      { name: 'family', type: 'string', description: 'Family name', category: 'Name' },
      { name: 'given', type: 'string', description: 'Given name', category: 'Name' },
      { name: 'name', type: 'string', description: 'Any part of name', category: 'Name' },
      { name: 'birthdate', type: 'date', description: 'Date of birth', category: 'Demographics' },
      { name: 'gender', type: 'token', description: 'Gender', options: ['male', 'female', 'other', 'unknown'], category: 'Demographics' },
      { name: 'identifier', type: 'token', description: 'Business identifier (MRN)', category: 'Identifiers' },
    ],
    advanced: [
      { name: '_id', type: 'token', description: 'Resource ID', category: 'Technical' },
      { name: 'address', type: 'string', description: 'Address', category: 'Contact' },
      { name: 'address-city', type: 'string', description: 'City', category: 'Contact' },
      { name: 'address-state', type: 'string', description: 'State', category: 'Contact' },
      { name: 'phone', type: 'token', description: 'Phone number', category: 'Contact' },
      { name: 'email', type: 'token', description: 'Email address', category: 'Contact' },
      { name: 'deceased', type: 'token', description: 'Deceased status', options: ['true', 'false'], category: 'Status' },
      { name: 'active', type: 'token', description: 'Active status', options: ['true', 'false'], category: 'Status' },
      { name: '_lastUpdated', type: 'date', description: 'Last updated', category: 'Technical' },
    ]
  },
  Observation: {
    basic: [
      { name: 'code', type: 'token', description: 'LOINC code or display text', category: 'What', placeholder: 'e.g., 8480-6 or blood pressure' },
      { name: 'category', type: 'token', description: 'Category', options: ['vital-signs', 'laboratory', 'imaging', 'procedure', 'survey', 'exam', 'therapy'], category: 'What' },
      { name: 'patient', type: 'reference', description: 'Patient ID', category: 'Who', placeholder: 'Patient/123' },
      { name: 'date', type: 'date', description: 'Observation date', category: 'When' },
      { name: 'value-quantity', type: 'quantity', description: 'Numeric value', category: 'Value', placeholder: 'e.g., gt100 or 80|mg' },
    ],
    advanced: [
      { name: 'status', type: 'token', description: 'Status', options: ['final', 'preliminary', 'registered', 'cancelled'], category: 'Status' },
      { name: 'value-string', type: 'string', description: 'String value', category: 'Value' },
      { name: 'value-concept', type: 'token', description: 'Coded value', category: 'Value' },
      { name: 'component-code', type: 'token', description: 'Component code', category: 'Components' },
      { name: 'component-value-quantity', type: 'quantity', description: 'Component numeric value', category: 'Components' },
      { name: 'encounter', type: 'reference', description: 'Encounter ID', category: 'Context' },
      { name: 'performer', type: 'reference', description: 'Who performed', category: 'Who' },
      { name: '_include', type: 'special', description: 'Include related resources', options: ['Observation:patient', 'Observation:encounter', 'Observation:performer'], category: 'Special' },
    ]
  },
  Condition: {
    basic: [
      { name: 'code', type: 'token', description: 'Condition code (SNOMED CT)', category: 'What', placeholder: 'e.g., 38341003' },
      { name: 'patient', type: 'reference', description: 'Patient ID', category: 'Who' },
      { name: 'clinical-status', type: 'token', description: 'Clinical status', options: ['active', 'recurrence', 'relapse', 'inactive', 'remission', 'resolved'], category: 'Status' },
      { name: 'onset-date', type: 'date', description: 'Date of onset', category: 'When' },
    ],
    advanced: [
      { name: 'verification-status', type: 'token', description: 'Verification status', options: ['unconfirmed', 'provisional', 'differential', 'confirmed', 'refuted'], category: 'Status' },
      { name: 'severity', type: 'token', description: 'Severity', options: ['mild', 'moderate', 'severe'], category: 'Severity' },
      { name: 'encounter', type: 'reference', description: 'Encounter ID', category: 'Context' },
      { name: 'recorded-date', type: 'date', description: 'Date recorded', category: 'When' },
      { name: 'abatement-date', type: 'date', description: 'Date resolved', category: 'When' },
    ]
  },
  Encounter: {
    basic: [
      { name: 'patient', type: 'reference', description: 'Patient ID', category: 'Who' },
      { name: 'status', type: 'token', description: 'Status', options: ['planned', 'arrived', 'triaged', 'in-progress', 'onleave', 'finished', 'cancelled'], category: 'Status' },
      { name: 'class', type: 'token', description: 'Class', options: ['AMB', 'EMER', 'FLD', 'HH', 'IMP', 'ACUTE', 'NONAC', 'OBSENC', 'SS', 'VR'], category: 'Type' },
      { name: 'date', type: 'date', description: 'Encounter date', category: 'When' },
    ],
    advanced: [
      { name: 'type', type: 'token', description: 'Encounter type', category: 'Type' },
      { name: 'participant', type: 'reference', description: 'Participant (Practitioner)', category: 'Who' },
      { name: 'location', type: 'reference', description: 'Location', category: 'Where' },
      { name: 'service-provider', type: 'reference', description: 'Organization', category: 'Who' },
      { name: 'reason-code', type: 'token', description: 'Reason for visit', category: 'Why' },
      { name: 'length', type: 'quantity', description: 'Length of stay', category: 'Duration' },
    ]
  },
  MedicationRequest: {
    basic: [
      { name: 'patient', type: 'reference', description: 'Patient ID', category: 'Who' },
      { name: 'status', type: 'token', description: 'Status', options: ['active', 'on-hold', 'cancelled', 'completed', 'entered-in-error', 'stopped', 'draft'], category: 'Status' },
      { name: 'medication', type: 'token', description: 'Medication code (RxNorm)', category: 'What' },
      { name: 'authoredon', type: 'date', description: 'Prescribed date', category: 'When' },
    ],
    advanced: [
      { name: 'intent', type: 'token', description: 'Intent', options: ['proposal', 'plan', 'order', 'instance-order'], category: 'Intent' },
      { name: 'requester', type: 'reference', description: 'Prescriber', category: 'Who' },
      { name: 'encounter', type: 'reference', description: 'Encounter', category: 'Context' },
      { name: 'priority', type: 'token', description: 'Priority', options: ['routine', 'urgent', 'asap', 'stat'], category: 'Priority' },
    ]
  },
};

// Common value sets for autocomplete
const VALUE_SETS = {
  'observation-codes': [
    { code: '8480-6', display: 'Systolic blood pressure', system: 'http://loinc.org' },
    { code: '8462-4', display: 'Diastolic blood pressure', system: 'http://loinc.org' },
    { code: '8310-5', display: 'Body temperature', system: 'http://loinc.org' },
    { code: '8867-4', display: 'Heart rate', system: 'http://loinc.org' },
    { code: '9279-1', display: 'Respiratory rate', system: 'http://loinc.org' },
    { code: '2708-6', display: 'Oxygen saturation', system: 'http://loinc.org' },
    { code: '29463-7', display: 'Body weight', system: 'http://loinc.org' },
    { code: '8302-2', display: 'Body height', system: 'http://loinc.org' },
    { code: '39156-5', display: 'Body mass index', system: 'http://loinc.org' },
  ],
  'condition-codes': [
    { code: '38341003', display: 'Hypertension', system: 'http://snomed.info/sct' },
    { code: '44054006', display: 'Type 2 diabetes', system: 'http://snomed.info/sct' },
    { code: '13645005', display: 'COPD', system: 'http://snomed.info/sct' },
    { code: '195967001', display: 'Asthma', system: 'http://snomed.info/sct' },
    { code: '53741008', display: 'Coronary artery disease', system: 'http://snomed.info/sct' },
  ],
};

// Query templates for non-technical users
const QUERY_TEMPLATES = {
  'Find Patients': {
    description: 'Search for patients by various criteria',
    icon: <PersonIcon />,
    category: 'Basic Searches',
    difficulty: 'beginner',
    steps: [
      {
        label: 'Search by name',
        params: { resource: 'Patient', parameters: { family: '', given: '' } },
        help: 'Enter family name and/or given name. Leave blank to search all.',
        tips: ['Try partial names like "Smi" for Smith', 'Case-insensitive search'],
        examples: { family: 'Smith', given: 'John' }
      },
      {
        label: 'Search by demographics',
        params: { resource: 'Patient', parameters: { gender: '', birthdate: '' } },
        help: 'Select gender and/or birthdate. Use date operators for ranges.',
        tips: ['Use ge/le for date ranges', 'Combine with name for precise results'],
        examples: { gender: 'female', birthdate: 'ge1980-01-01' }
      },
      {
        label: 'Search by identifier',
        params: { resource: 'Patient', parameters: { identifier: '' } },
        help: 'Enter MRN or other identifier',
        tips: ['Exact match only', 'Use system|value for specific systems'],
        examples: { identifier: 'MRN123456' }
      },
      {
        label: 'Active patients only',
        params: { resource: 'Patient', parameters: { active: 'true', _count: '20' } },
        help: 'Find only active patients in the system',
        tips: ['Combine with other filters', 'Use _count to limit results']
      },
    ]
  },
  'Find Lab Results': {
    description: 'Search for laboratory test results',
    icon: <ScienceIcon />,
    category: 'Clinical Data',
    difficulty: 'intermediate',
    steps: [
      {
        label: 'All labs for a patient',
        params: { resource: 'Observation', parameters: { category: 'laboratory', patient: '', _sort: '-date' } },
        help: 'Enter patient ID to see all their lab results',
        tips: ['Results sorted by most recent first', 'Add _count to limit results'],
        examples: { patient: 'Patient/123' }
      },
      {
        label: 'Specific test type',
        params: { resource: 'Observation', parameters: { category: 'laboratory', code: '2708-6', patient: '' } },
        help: 'Search for specific lab tests using LOINC codes',
        tips: ['Use code display text for easier searching', 'Common codes provided below'],
        examples: { code: '2708-6', patient: 'Patient/123' },
        commonCodes: [
          { code: '2708-6', display: 'Oxygen saturation' },
          { code: '2951-2', display: 'Sodium' },
          { code: '2823-3', display: 'Potassium' },
          { code: '2075-0', display: 'Chloride' },
          { code: '2028-9', display: 'CO2' },
          { code: '1751-7', display: 'Albumin' },
          { code: '1742-6', display: 'ALT' },
          { code: '1920-8', display: 'AST' }
        ]
      },
      {
        label: 'Abnormal results only',
        params: { resource: 'Observation', parameters: { category: 'laboratory', interpretation: 'abnormal', _sort: '-date' } },
        help: 'Find only abnormal lab results',
        tips: ['Includes high, low, and critical values', 'Check reference ranges']
      },
      {
        label: 'Results by date range',
        params: { resource: 'Observation', parameters: { category: 'laboratory', date: 'ge2024-01-01', patient: '' } },
        help: 'Filter lab results by date',
        tips: ['Use ge for "after", le for "before"', 'Combine for date ranges'],
        examples: { date: 'ge2024-01-01&date=le2024-12-31' }
      },
    ]
  },
  'Find Vital Signs': {
    description: 'Search for vital sign measurements',
    icon: <AssessmentIcon />,
    category: 'Clinical Data',
    difficulty: 'beginner',
    steps: [
      {
        label: 'Recent vital signs',
        params: { resource: 'Observation', parameters: { category: 'vital-signs', patient: '', _count: '10', _sort: '-date' } },
        help: 'Shows most recent vital signs for a patient',
        tips: ['Includes BP, temp, pulse, etc.', 'Adjust _count for more results'],
        examples: { patient: 'Patient/123' }
      },
      {
        label: 'Blood pressure trends',
        params: { resource: 'Observation', parameters: { category: 'vital-signs', code: '85354-9', patient: '', _sort: 'date' } },
        help: 'Track blood pressure readings over time',
        tips: ['Shows systolic and diastolic', 'Sort by date to see trends'],
        vitalsCode: [
          { code: '85354-9', display: 'Blood pressure panel' },
          { code: '8480-6', display: 'Systolic BP' },
          { code: '8462-4', display: 'Diastolic BP' },
          { code: '8310-5', display: 'Body temperature' },
          { code: '8867-4', display: 'Heart rate' },
          { code: '9279-1', display: 'Respiratory rate' },
          { code: '2708-6', display: 'Oxygen saturation' },
          { code: '29463-7', display: 'Body weight' },
          { code: '8302-2', display: 'Body height' }
        ]
      },
      {
        label: 'Abnormal vital signs',
        params: { resource: 'Observation', parameters: { category: 'vital-signs', 'value-quantity': 'gt120', code: '8480-6' } },
        help: 'Find vital signs outside normal ranges',
        tips: ['Adjust thresholds as needed', 'Use component-value for BP'],
        examples: { 'value-quantity': 'gt140', 'code': '8480-6' }
      },
    ]
  },
  'Active Conditions': {
    description: 'Find active diagnoses and problems',
    icon: <HospitalIcon />,
    category: 'Clinical Data',
    difficulty: 'intermediate',
    steps: [
      {
        label: 'All active conditions',
        params: { resource: 'Condition', parameters: { 'clinical-status': 'active', patient: '' } },
        help: 'List all active conditions for a patient',
        tips: ['Includes chronic and acute conditions', 'Check verification status'],
        examples: { patient: 'Patient/123' }
      },
      {
        label: 'Specific diagnosis',
        params: { resource: 'Condition', parameters: { code: '44054006', 'clinical-status': 'active' } },
        help: 'Search for specific conditions by SNOMED code',
        commonCodes: [
          { code: '44054006', display: 'Type 2 diabetes' },
          { code: '38341003', display: 'Hypertension' },
          { code: '13645005', display: 'COPD' },
          { code: '195967001', display: 'Asthma' },
          { code: '53741008', display: 'Coronary artery disease' },
          { code: '399068003', display: 'Heart failure' },
          { code: '49436004', display: 'Atrial fibrillation' }
        ]
      },
      {
        label: 'Recent diagnoses',
        params: { resource: 'Condition', parameters: { 'onset-date': 'ge2024-01-01', patient: '' } },
        help: 'Find conditions diagnosed recently',
        tips: ['Useful for new problems', 'Combine with encounter']
      },
    ]
  },
  'Current Medications': {
    description: 'Search for active medication orders',
    icon: <MedicationIcon />,
    category: 'Medications',
    difficulty: 'intermediate',
    steps: [
      {
        label: 'Active prescriptions',
        params: { resource: 'MedicationRequest', parameters: { status: 'active', patient: '', _sort: '-authoredon' } },
        help: 'All active medications for a patient',
        tips: ['Sorted by most recent first', 'Check dosage instructions']
      },
      {
        label: 'By medication name',
        params: { resource: 'MedicationRequest', parameters: { medication: 'aspirin', status: 'active' } },
        help: 'Search for specific medications',
        tips: ['Use generic or brand names', 'Partial matching supported']
      },
      {
        label: 'High priority meds',
        params: { resource: 'MedicationRequest', parameters: { priority: 'urgent', status: 'active', patient: '' } },
        help: 'Find urgent or stat medication orders',
        tips: ['Includes stat and urgent orders', 'Check administration times']
      },
    ]
  },
  'Recent Encounters': {
    description: 'Find patient visits and encounters',
    icon: <EventIcon />,
    category: 'Encounters',
    difficulty: 'beginner',
    steps: [
      {
        label: 'All encounters',
        params: { resource: 'Encounter', parameters: { patient: '', _sort: '-date', _count: '10' } },
        help: 'List recent encounters for a patient',
        tips: ['Includes all visit types', 'Most recent first']
      },
      {
        label: 'Emergency visits',
        params: { resource: 'Encounter', parameters: { class: 'EMER', patient: '', _sort: '-date' } },
        help: 'Find emergency department visits',
        encounterClasses: [
          { code: 'AMB', display: 'Ambulatory' },
          { code: 'EMER', display: 'Emergency' },
          { code: 'IMP', display: 'Inpatient' },
          { code: 'ACUTE', display: 'Acute care' },
          { code: 'VR', display: 'Virtual' }
        ]
      },
      {
        label: 'Current admissions',
        params: { resource: 'Encounter', parameters: { status: 'in-progress', class: 'IMP' } },
        help: 'Find patients currently admitted',
        tips: ['Active inpatient stays', 'Check location for unit']
      },
    ]
  },
  'Patient Summary': {
    description: 'Get comprehensive patient information',
    icon: <AutoAwesomeIcon />,
    category: 'Advanced Queries',
    difficulty: 'advanced',
    steps: [
      {
        label: 'Basic patient summary',
        params: { resource: 'Patient', parameters: { _id: '', _revinclude: 'Encounter:patient', _count: '5' } },
        help: 'Patient demographics with recent encounters',
        tips: ['Good starting point', 'Add more _revinclude for details']
      },
      {
        label: 'Clinical summary',
        params: { resource: 'Patient', parameters: { _id: '', _revinclude: ['Condition:patient', 'MedicationRequest:patient', 'AllergyIntolerance:patient'] } },
        help: 'Patient with conditions, meds, and allergies',
        tips: ['Core clinical data', 'May return large datasets']
      },
      {
        label: 'Complete record',
        params: { resource: 'Patient', parameters: { _id: '', _revinclude: '*' } },
        help: 'Everything linked to the patient',
        tips: ['Very large result set', 'Use with caution'],
        warning: 'This query may take time and return extensive data'
      },
    ]
  },
  'Quality Measures': {
    description: 'Population health and quality queries',
    icon: <TipsIcon />,
    category: 'Advanced Queries',
    difficulty: 'advanced',
    steps: [
      {
        label: 'Diabetic patients',
        params: { resource: 'Patient', parameters: { _has: 'Condition:patient:code=44054006' } },
        help: 'Find all patients with diabetes diagnosis',
        tips: ['Use for population health', 'Combine with lab values']
      },
      {
        label: 'Overdue screenings',
        params: { resource: 'Patient', parameters: { _has: 'Observation:patient:code=82810-3', _has: 'Observation:patient:date=lt2023-01-01' } },
        help: 'Patients needing preventive care',
        tips: ['Customize date ranges', 'Add specific screening codes']
      },
      {
        label: 'High-risk patients',
        params: { resource: 'Patient', parameters: { _has: 'Condition:patient:code=38341003,44054006' } },
        help: 'Patients with multiple chronic conditions',
        tips: ['Adjust condition codes', 'Consider risk scores']
      },
    ]
  },
};

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`fhir-tabpanel-${index}`}
      aria-labelledby={`fhir-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

function QueryWizard({ open, onClose, onExecute, initialTemplate }) {
  const [activeStep, setActiveStep] = useState(0);
  const [selectedTemplate, setSelectedTemplate] = useState(initialTemplate || null);
  const [queryParams, setQueryParams] = useState({});
  const [savedQueries, setSavedQueries] = useState(() => {
    const saved = localStorage.getItem('fhir-saved-queries');
    return saved ? JSON.parse(saved) : [];
  });
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterDifficulty, setFilterDifficulty] = useState('all');

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleParamChange = (param, value) => {
    setQueryParams(prev => ({
      ...prev,
      [param]: value
    }));
  };

  const handleExecute = () => {
    if (selectedTemplate && selectedTemplate.steps[activeStep]) {
      const step = selectedTemplate.steps[activeStep];
      const params = {
        ...step.params.parameters,
        ...queryParams
      };
      onExecute(step.params.resource, params);
      onClose();
    }
  };

  const handleSaveQuery = () => {
    const queryName = prompt('Enter a name for this query:');
    if (queryName) {
      const newQuery = {
        name: queryName,
        template: selectedTemplate.name,
        params: queryParams,
        timestamp: new Date().toISOString()
      };
      const updated = [...savedQueries, newQuery];
      setSavedQueries(updated);
      localStorage.setItem('fhir-saved-queries', JSON.stringify(updated));
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <TipsIcon color="primary" />
          Query Wizard
        </Box>
      </DialogTitle>
      <DialogContent>
        {!selectedTemplate ? (
          <Box>
            <Typography variant="h6" gutterBottom>
              Select a query template
            </Typography>
            
            <Box display="flex" gap={2} mb={2}>
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Category</InputLabel>
                <Select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  label="Category"
                >
                  <MenuItem value="all">All Categories</MenuItem>
                  <MenuItem value="Basic Searches">Basic Searches</MenuItem>
                  <MenuItem value="Clinical Data">Clinical Data</MenuItem>
                  <MenuItem value="Medications">Medications</MenuItem>
                  <MenuItem value="Encounters">Encounters</MenuItem>
                  <MenuItem value="Advanced Queries">Advanced Queries</MenuItem>
                </Select>
              </FormControl>
              
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Difficulty</InputLabel>
                <Select
                  value={filterDifficulty}
                  onChange={(e) => setFilterDifficulty(e.target.value)}
                  label="Difficulty"
                >
                  <MenuItem value="all">All Levels</MenuItem>
                  <MenuItem value="beginner">Beginner</MenuItem>
                  <MenuItem value="intermediate">Intermediate</MenuItem>
                  <MenuItem value="advanced">Advanced</MenuItem>
                </Select>
              </FormControl>
            </Box>
            
            <Grid container spacing={2}>
              {Object.entries(QUERY_TEMPLATES)
                .filter(([name, template]) => {
                  const categoryMatch = filterCategory === 'all' || template.category === filterCategory;
                  const difficultyMatch = filterDifficulty === 'all' || template.difficulty === filterDifficulty;
                  return categoryMatch && difficultyMatch;
                })
                .map(([name, template]) => (
                <Grid item xs={12} sm={6} key={name}>
                  <Card 
                    variant="outlined" 
                    sx={{ 
                      cursor: 'pointer', 
                      '&:hover': { boxShadow: 2 },
                      position: 'relative',
                      height: '100%'
                    }}
                    onClick={() => {
                      setSelectedTemplate({ name, ...template });
                      setActiveStep(0);
                    }}
                  >
                    <CardContent>
                      <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                        <Box display="flex" alignItems="center" gap={1} mb={1}>
                          {template.icon}
                          <Typography variant="h6">{name}</Typography>
                        </Box>
                        <Chip 
                          label={template.difficulty} 
                          size="small"
                          color={template.difficulty === 'beginner' ? 'success' : 
                                 template.difficulty === 'intermediate' ? 'warning' : 'error'}
                        />
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        {template.description}
                      </Typography>
                      <Typography variant="caption" color="primary" sx={{ mt: 1, display: 'block' }}>
                        {template.category}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>

            {savedQueries.length > 0 && (
              <>
                <Divider sx={{ my: 3 }} />
                <Typography variant="h6" gutterBottom>
                  Saved Queries
                </Typography>
                <List>
                  {savedQueries.map((query, index) => (
                    <ListItem
                      key={index}
                      onClick={() => {
                        // Load saved query
                        setSelectedTemplate(QUERY_TEMPLATES[query.template]);
                        setQueryParams(query.params);
                      }}
                      sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                    >
                      <ListItemIcon>
                        <FavoriteIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary={query.name}
                        secondary={`${query.template} - ${new Date(query.timestamp).toLocaleDateString()}`}
                      />
                    </ListItem>
                  ))}
                </List>
              </>
            )}
          </Box>
        ) : (
          <Box>
            <Button 
              startIcon={<ArrowBackIcon />} 
              onClick={() => setSelectedTemplate(null)}
              sx={{ mb: 2 }}
            >
              Back to templates
            </Button>
            
            <Typography variant="h6" gutterBottom>
              {selectedTemplate.name}
            </Typography>
            
            <Stepper activeStep={activeStep} orientation="vertical">
              {selectedTemplate.steps.map((step, index) => (
                <Step key={index}>
                  <StepLabel>{step.label}</StepLabel>
                  <StepContent>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      {step.help}
                    </Typography>
                    
                    {step.tips && (
                      <Alert severity="info" sx={{ mt: 1, mb: 2 }}>
                        <Typography variant="subtitle2" gutterBottom>Tips:</Typography>
                        <ul style={{ margin: 0, paddingLeft: 20 }}>
                          {step.tips.map((tip, idx) => (
                            <li key={idx}><Typography variant="body2">{tip}</Typography></li>
                          ))}
                        </ul>
                      </Alert>
                    )}
                    
                    {step.warning && (
                      <Alert severity="warning" sx={{ mb: 2 }}>
                        {step.warning}
                      </Alert>
                    )}
                    
                    <Box sx={{ mt: 2 }}>
                      {Object.entries(step.params.parameters).map(([param, defaultValue]) => {
                        const paramDef = SEARCH_PARAMETERS[step.params.resource]?.basic.find(p => p.name === param) ||
                                        SEARCH_PARAMETERS[step.params.resource]?.advanced.find(p => p.name === param);
                        
                        if (paramDef?.options) {
                          return (
                            <FormControl key={param} fullWidth sx={{ mb: 2 }}>
                              <InputLabel>{paramDef.description}</InputLabel>
                              <Select
                                value={queryParams[param] || defaultValue}
                                onChange={(e) => handleParamChange(param, e.target.value)}
                                label={paramDef.description}
                              >
                                <MenuItem value="">
                                  <em>Any</em>
                                </MenuItem>
                                {paramDef.options.map(opt => (
                                  <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          );
                        }
                        
                        if (paramDef?.type === 'date') {
                          return (
                            <TextField
                              key={param}
                              fullWidth
                              type="date"
                              label={paramDef.description}
                              value={queryParams[param] || defaultValue}
                              onChange={(e) => handleParamChange(param, e.target.value)}
                              InputLabelProps={{ shrink: true }}
                              sx={{ mb: 2 }}
                            />
                          );
                        }
                        
                        return (
                          <Box key={param} sx={{ mb: 2 }}>
                            <TextField
                              fullWidth
                              label={paramDef?.description || param}
                              value={queryParams[param] || defaultValue}
                              onChange={(e) => handleParamChange(param, e.target.value)}
                              placeholder={step.examples?.[param] ? `e.g., ${step.examples[param]}` : paramDef?.placeholder}
                              helperText={paramDef?.help}
                            />
                            {step.examples?.[param] && (
                              <Button
                                size="small"
                                onClick={() => handleParamChange(param, step.examples[param])}
                                sx={{ mt: 0.5 }}
                              >
                                Use example: {step.examples[param]}
                              </Button>
                            )}
                          </Box>
                        );
                      })}
                    </Box>
                    
                    {(step.commonCodes || step.encounterClasses || step.vitalsCode) && (
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="subtitle2" gutterBottom>
                          Common Values:
                        </Typography>
                        <Box display="flex" gap={0.5} flexWrap="wrap">
                          {(step.commonCodes || step.encounterClasses || step.vitalsCode)?.slice(0, 5).map((item) => (
                            <Chip
                              key={item.code}
                              label={`${item.code}: ${item.display}`}
                              size="small"
                              variant="outlined"
                              onClick={() => handleParamChange('code', item.code)}
                              sx={{ cursor: 'pointer' }}
                            />
                          ))}
                        </Box>
                      </Box>
                    )}
                    
                    <Box sx={{ mb: 2 }}>
                      <Button
                        variant="contained"
                        onClick={handleExecute}
                        sx={{ mt: 1, mr: 1 }}
                      >
                        Execute Query
                      </Button>
                      <Button
                        onClick={handleSaveQuery}
                        sx={{ mt: 1, mr: 1 }}
                      >
                        Save Query
                      </Button>
                      {index < selectedTemplate.steps.length - 1 && (
                        <Button
                          onClick={handleNext}
                          sx={{ mt: 1, mr: 1 }}
                        >
                          Next Option
                        </Button>
                      )}
                      {index > 0 && (
                        <Button
                          onClick={handleBack}
                          sx={{ mt: 1 }}
                        >
                          Back
                        </Button>
                      )}
                    </Box>
                  </StepContent>
                </Step>
              ))}
            </Stepper>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

function InteractiveHelp({ param, onExample }) {
  const [open, setOpen] = useState(false);
  
  const examples = {
    string: ['Smith', 'John', 'Mary'],
    date: ['2024-01-01', 'ge2023-01-01', 'lt2024-12-31', 'ge2023-01-01&date=le2023-12-31'],
    token: param.options || ['12345', 'MRN123456'],
    reference: ['Patient/123', 'Practitioner/456'],
    quantity: ['gt100', 'lt50', '80|mg', 'ge120|mm[Hg]'],
  };
  
  const syntaxHelp = {
    string: 'Text search supports partial matching by default. Use :exact modifier for exact match.',
    date: 'Dates support comparison prefixes: eq, gt, ge, lt, le. Combine with & for ranges.',
    token: 'Token searches match exactly. Use system|value for namespaced identifiers.',
    reference: 'References should be ResourceType/id format. Supports chaining with dot notation.',
    quantity: 'Quantities support comparisons and units. Format: [prefix]value[|unit]',
  };
  
  return (
    <>
      <Tooltip title="Show examples and help">
        <IconButton size="small" onClick={() => setOpen(true)}>
          <HelpIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{param.description} - Help</DialogTitle>
        <DialogContent>
          <Typography variant="body2" paragraph>
            <strong>Parameter:</strong> {param.name}
          </Typography>
          <Typography variant="body2" paragraph>
            <strong>Type:</strong> {param.type}
          </Typography>
          {param.placeholder && (
            <Typography variant="body2" paragraph>
              <strong>Format:</strong> {param.placeholder}
            </Typography>
          )}
          
          <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
            Examples:
          </Typography>
          <Box display="flex" gap={1} flexWrap="wrap">
            {examples[param.type]?.map((example, idx) => (
              <Chip
                key={idx}
                label={example}
                onClick={() => {
                  onExample(example);
                  setOpen(false);
                }}
                clickable
                size="small"
                variant="outlined"
              />
            ))}
          </Box>
          
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>Syntax Guide:</Typography>
            <Typography variant="body2">
              {syntaxHelp[param.type] || 'Standard FHIR search parameter syntax applies.'}
            </Typography>
          </Alert>
          
          {param.type === 'string' && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>Search Modifiers:</Typography>
              <Box display="flex" gap={1} flexWrap="wrap">
                <Chip label=":exact" size="small" onClick={() => onExample(`:exact=${examples.string[0]}`)} />
                <Chip label=":contains" size="small" onClick={() => onExample(`:contains=${examples.string[0]}`)} />
                <Chip label=":above" size="small" onClick={() => onExample(`:above=${examples.string[0]}`)} />
                <Chip label=":below" size="small" onClick={() => onExample(`:below=${examples.string[0]}`)} />
              </Box>
            </Box>
          )}
          
          {param.type === 'token' && param.options && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>Valid Values:</Typography>
              <Box display="flex" gap={1} flexWrap="wrap">
                {param.options.map((opt, idx) => (
                  <Chip 
                    key={idx} 
                    label={opt} 
                    size="small" 
                    variant="outlined"
                    onClick={() => {
                      onExample(opt);
                      setOpen(false);
                    }}
                  />
                ))}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function EnhancedQueryParameter({ param, value, onChange, onRemove, availableResources }) {
  const [localValue, setLocalValue] = useState(value || '');
  const [modifier, setModifier] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const handleValueChange = (newValue) => {
    setLocalValue(newValue);
    onChange(param.name, newValue);
  };
  
  const handleExampleClick = (example) => {
    setLocalValue(example);
    onChange(param.name, example);
  };
  
  return (
    <Card variant="outlined" sx={{ p: 2, mb: 1 }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
        <Box display="flex" alignItems="center" gap={1}>
          <Chip 
            label={param.category || 'General'} 
            size="small" 
            color="primary" 
            variant="outlined" 
          />
          <Typography variant="subtitle2">{param.description}</Typography>
          <InteractiveHelp param={param} onExample={handleExampleClick} />
        </Box>
        <IconButton size="small" onClick={() => onRemove(param.name)}>
          <DeleteIcon />
        </IconButton>
      </Box>
      
      <Box display="flex" gap={1} alignItems="center">
        {param.type === 'reference' ? (
          <Autocomplete
            fullWidth
            freeSolo
            options={availableResources || []}
            value={localValue}
            onChange={(e, newValue) => handleValueChange(newValue)}
            renderInput={(params) => (
              <TextField
                {...params}
                size="small"
                placeholder={param.placeholder || `${param.name} reference`}
                helperText="Start typing to search for resources"
              />
            )}
          />
        ) : param.options ? (
          <FormControl fullWidth size="small">
            <Select
              value={localValue}
              onChange={(e) => handleValueChange(e.target.value)}
              displayEmpty
            >
              <MenuItem value="">
                <em>Any</em>
              </MenuItem>
              {param.options.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        ) : param.type === 'date' ? (
          <>
            <FormControl size="small" sx={{ minWidth: 100 }}>
              <Select
                value={modifier}
                onChange={(e) => setModifier(e.target.value)}
                displayEmpty
              >
                <MenuItem value="">Equals</MenuItem>
                <MenuItem value="gt">After</MenuItem>
                <MenuItem value="ge">On or after</MenuItem>
                <MenuItem value="lt">Before</MenuItem>
                <MenuItem value="le">On or before</MenuItem>
              </Select>
            </FormControl>
            <TextField
              size="small"
              type="date"
              value={localValue.replace(/^(gt|ge|lt|le)/, '')}
              onChange={(e) => handleValueChange(modifier + e.target.value)}
              sx={{ flexGrow: 1 }}
              InputLabelProps={{ shrink: true }}
            />
          </>
        ) : param.type === 'quantity' ? (
          <>
            <FormControl size="small" sx={{ minWidth: 100 }}>
              <Select
                value={modifier}
                onChange={(e) => setModifier(e.target.value)}
                displayEmpty
              >
                <MenuItem value="">Equals</MenuItem>
                <MenuItem value="gt">Greater than</MenuItem>
                <MenuItem value="lt">Less than</MenuItem>
                <MenuItem value="ge">≥</MenuItem>
                <MenuItem value="le">≤</MenuItem>
              </Select>
            </FormControl>
            <TextField
              size="small"
              type="number"
              value={localValue.replace(/^(gt|ge|lt|le)/, '').split('|')[0]}
              onChange={(e) => {
                const unit = localValue.includes('|') ? localValue.split('|')[1] : '';
                handleValueChange(modifier + e.target.value + (unit ? `|${unit}` : ''));
              }}
              sx={{ flexGrow: 1 }}
              placeholder="Value"
            />
            <TextField
              size="small"
              value={localValue.includes('|') ? localValue.split('|')[1] : ''}
              onChange={(e) => {
                const val = localValue.replace(/^(gt|ge|lt|le)/, '').split('|')[0];
                handleValueChange(modifier + val + (e.target.value ? `|${e.target.value}` : ''));
              }}
              sx={{ width: 100 }}
              placeholder="Unit"
            />
          </>
        ) : (
          <TextField
            fullWidth
            size="small"
            value={localValue}
            onChange={(e) => handleValueChange(e.target.value)}
            placeholder={param.placeholder || param.description}
          />
        )}
      </Box>
      
      {param.type === 'token' && param.name === 'code' && (
        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Common codes:
          </Typography>
          <Box display="flex" gap={0.5} flexWrap="wrap" sx={{ mt: 0.5 }}>
            {(VALUE_SETS['observation-codes'] || []).slice(0, 5).map((code) => (
              <Chip
                key={code.code}
                label={`${code.code}: ${code.display}`}
                size="small"
                variant="outlined"
                onClick={() => handleValueChange(code.code)}
                sx={{ fontSize: '0.75rem' }}
              />
            ))}
          </Box>
        </Box>
      )}
    </Card>
  );
}

function FHIRExplorerEnhanced() {
  const [selectedResource, setSelectedResource] = useState('Patient');
  const [searchQuery, setSearchQuery] = useState('/fhir/R4/Patient');
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tabValue, setTabValue] = useState(0);
  const [queryParams, setQueryParams] = useState({});
  const [queryHistory, setQueryHistory] = useState(() => {
    const saved = localStorage.getItem('fhir-query-history');
    return saved ? JSON.parse(saved) : [];
  });
  const [userMode, setUserMode] = useState('guided'); // 'guided', 'advanced', 'expert'
  const [showWizard, setShowWizard] = useState(false);
  const [showResults, setShowResults] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [availablePatients, setAvailablePatients] = useState([]);
  const [metadata, setMetadata] = useState(null);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [queryValidation, setQueryValidation] = useState({ valid: true, errors: [], warnings: [] });
  
  // Fetch available patients for reference fields
  useEffect(() => {
    const fetchPatients = async () => {
      try {
        const response = await api.get('/fhir/R4/Patient?_count=100&_elements=id,name');
        const patients = response.data.entry?.map(entry => ({
          id: `Patient/${entry.resource.id}`,
          display: `${entry.resource.name?.[0]?.given?.[0] || ''} ${entry.resource.name?.[0]?.family || ''} (${entry.resource.id})`
        })) || [];
        setAvailablePatients(patients);
      } catch (err) {
        console.error('Error fetching patients:', err);
      }
    };
    fetchPatients();
  }, []);

  // Fetch server metadata
  useEffect(() => {
    const fetchMetadata = async () => {
      setMetadataLoading(true);
      try {
        const response = await api.get('/fhir/R4/metadata');
        setMetadata(response.data);
      } catch (err) {
        console.error('Error fetching metadata:', err);
      } finally {
        setMetadataLoading(false);
      }
    };
    fetchMetadata();
  }, []);

  useEffect(() => {
    // Build query string from params
    const params = new URLSearchParams();
    Object.entries(queryParams).forEach(([key, value]) => {
      if (value) {
        if (Array.isArray(value)) {
          value.forEach(v => params.append(key, v));
        } else {
          params.append(key, value);
        }
      }
    });
    const queryString = params.toString();
    const newQuery = `/fhir/R4/${selectedResource}${queryString ? '?' + queryString : ''}`;
    setSearchQuery(newQuery);
    
    // Validate query in real-time
    validateQuery(newQuery, selectedResource, queryParams);
  }, [selectedResource, queryParams]);

  // Query validation function
  const validateQuery = (query, resource, params) => {
    const errors = [];
    const warnings = [];
    
    // Validate resource type
    if (!FHIR_RESOURCES.includes(resource)) {
      errors.push(`Invalid resource type: ${resource}`);
    }
    
    // Validate parameters
    const validParams = [
      ...(SEARCH_PARAMETERS[resource]?.basic || []).map(p => p.name),
      ...(SEARCH_PARAMETERS[resource]?.advanced || []).map(p => p.name),
      '_count', '_sort', '_include', '_revinclude', '_summary', '_elements'
    ];
    
    Object.keys(params).forEach(param => {
      if (!validParams.includes(param)) {
        warnings.push(`Unknown parameter '${param}' for ${resource}`);
      }
      
      // Validate date formats
      if (param.includes('date') && params[param]) {
        const dateValue = params[param];
        const dateRegex = /^(eq|gt|ge|lt|le)?\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(dateValue)) {
          errors.push(`Invalid date format for '${param}': ${dateValue}`);
        }
      }
      
      // Validate reference formats
      if (param === 'patient' || param === 'subject' || param.includes('reference')) {
        const refValue = params[param];
        if (refValue && !refValue.includes('/')) {
          warnings.push(`Reference '${param}' should be in format 'ResourceType/id'`);
        }
      }
    });
    
    // Check for common mistakes
    if (params._count && (isNaN(params._count) || params._count < 1 || params._count > 1000)) {
      errors.push('_count must be between 1 and 1000');
    }
    
    if (params._include && !params._include.includes(':')) {
      warnings.push('_include should be in format "Resource:parameter"');
    }
    
    setQueryValidation({
      valid: errors.length === 0,
      errors,
      warnings
    });
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const executeQuery = async (resourceOverride, paramsOverride) => {
    setLoading(true);
    setError(null);
    
    let queryUrl = searchQuery;
    if (resourceOverride && paramsOverride) {
      const params = new URLSearchParams();
      Object.entries(paramsOverride).forEach(([key, value]) => {
        if (value) {
          if (Array.isArray(value)) {
            value.forEach(v => params.append(key, v));
          } else {
            params.append(key, value);
          }
        }
      });
      const queryString = params.toString();
      queryUrl = `/fhir/R4/${resourceOverride}${queryString ? '?' + queryString : ''}`;
    }
    
    try {
      const response = await api.get(queryUrl);
      setResponse(response.data);
      
      // Add to history
      const historyEntry = {
        query: queryUrl,
        timestamp: new Date().toISOString(),
        resourceType: resourceOverride || selectedResource,
        resultCount: response.data.total || 1,
        params: paramsOverride || queryParams,
      };
      const updatedHistory = [historyEntry, ...queryHistory.slice(0, 19)];
      setQueryHistory(updatedHistory);
      localStorage.setItem('fhir-query-history', JSON.stringify(updatedHistory));
      
      setSnackbar({
        open: true,
        message: `Query executed successfully. Found ${response.data.total || 1} results.`,
        severity: 'success'
      });
    } catch (err) {
      console.error('Error executing FHIR query:', err);
      setError(err.response?.data?.detail || 'Failed to execute query');
      setSnackbar({
        open: true,
        message: 'Query failed. Check the error message for details.',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddParameter = (param) => {
    setQueryParams(prev => ({
      ...prev,
      [param.name]: ''
    }));
    
    // Show snackbar with help for the parameter
    setSnackbar({
      open: true,
      message: `Added ${param.description}. ${param.placeholder ? `Format: ${param.placeholder}` : ''}`,
      severity: 'info'
    });
  };

  const handleParameterChange = (name, value) => {
    setQueryParams(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleRemoveParameter = (name) => {
    setQueryParams(prev => {
      const newParams = { ...prev };
      delete newParams[name];
      return newParams;
    });
  };

  const handleClearAll = () => {
    setQueryParams({});
    setResponse(null);
    setError(null);
    setSelectedResource('Patient');
  };

  const renderUserModeSelector = () => (
    <ToggleButtonGroup
      value={userMode}
      exclusive
      onChange={(e, newMode) => newMode && setUserMode(newMode)}
      size="small"
      sx={{ mb: 2 }}
    >
      <ToggleButton value="guided" aria-label="guided mode">
        <Tooltip title="Guided mode for beginners">
          <Box display="flex" alignItems="center" gap={0.5}>
            <SchoolIcon fontSize="small" />
            Guided
          </Box>
        </Tooltip>
      </ToggleButton>
      <ToggleButton value="advanced" aria-label="advanced mode">
        <Tooltip title="Advanced mode with visual query builder">
          <Box display="flex" alignItems="center" gap={0.5}>
            <BuildIcon fontSize="small" />
            Advanced
          </Box>
        </Tooltip>
      </ToggleButton>
      <ToggleButton value="expert" aria-label="expert mode">
        <Tooltip title="Expert mode with direct query editing">
          <Box display="flex" alignItems="center" gap={0.5}>
            <CodeIcon fontSize="small" />
            Expert
          </Box>
        </Tooltip>
      </ToggleButton>
    </ToggleButtonGroup>
  );

  const renderQueryBuilder = () => {
    switch (userMode) {
      case 'guided':
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              What would you like to find?
            </Typography>
            <Grid container spacing={2}>
              {Object.entries(QUERY_TEMPLATES).map(([name, template]) => (
                <Grid item xs={12} sm={6} key={name}>
                  <Card 
                    variant="outlined" 
                    sx={{ 
                      cursor: 'pointer',
                      transition: 'all 0.3s',
                      '&:hover': { 
                        boxShadow: 3,
                        transform: 'translateY(-2px)'
                      }
                    }}
                    onClick={() => {
                      setShowWizard(true);
                    }}
                  >
                    <CardContent>
                      <Box display="flex" alignItems="center" gap={1}>
                        {template.icon}
                        <Typography variant="h6">{name}</Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        {template.description}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
            
            <Button
              variant="outlined"
              startIcon={<BuildIcon />}
              onClick={() => setUserMode('advanced')}
              sx={{ mt: 2 }}
            >
              Switch to Advanced Mode
            </Button>
          </Box>
        );
        
      case 'advanced':
        const currentParams = SEARCH_PARAMETERS[selectedResource] || { basic: [], advanced: [] };
        const activeParams = Object.keys(queryParams);
        
        return (
          <Box>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Resource Type</InputLabel>
              <Select
                value={selectedResource}
                onChange={(e) => {
                  setSelectedResource(e.target.value);
                  setQueryParams({});
                }}
                label="Resource Type"
                startAdornment={RESOURCE_ICONS[selectedResource]}
              >
                {FHIR_RESOURCES.map((resource) => (
                  <MenuItem key={resource} value={resource}>
                    <Box display="flex" alignItems="center" gap={1}>
                      {RESOURCE_ICONS[resource]}
                      {resource}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
              Active Search Parameters
            </Typography>
            
            {activeParams.length === 0 && (
              <Alert severity="info" sx={{ mb: 2 }}>
                No search parameters added yet. Add parameters below to build your query.
              </Alert>
            )}
            
            {activeParams.map((paramName) => {
              const paramDef = [...currentParams.basic, ...currentParams.advanced].find(p => p.name === paramName) ||
                              { name: paramName, type: 'string', description: paramName };
              return (
                <EnhancedQueryParameter
                  key={paramName}
                  param={paramDef}
                  value={queryParams[paramName]}
                  onChange={handleParameterChange}
                  onRemove={handleRemoveParameter}
                  availableResources={paramDef.type === 'reference' ? availablePatients : null}
                />
              );
            })}
            
            <Divider sx={{ my: 2 }} />
            
            <Typography variant="subtitle2" gutterBottom>
              Add Search Parameters
            </Typography>
            
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography>Common Parameters</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={1}>
                  {currentParams.basic.map((param) => (
                    <Grid item xs={12} sm={6} md={4} key={param.name}>
                      <Chip
                        label={param.description}
                        onClick={() => handleAddParameter(param)}
                        disabled={activeParams.includes(param.name)}
                        icon={<AddIcon />}
                        variant={activeParams.includes(param.name) ? "filled" : "outlined"}
                        sx={{ width: '100%', justifyContent: 'flex-start' }}
                      />
                    </Grid>
                  ))}
                </Grid>
              </AccordionDetails>
            </Accordion>
            
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography>Advanced Parameters</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={1}>
                  {currentParams.advanced.map((param) => (
                    <Grid item xs={12} sm={6} md={4} key={param.name}>
                      <Chip
                        label={param.description}
                        onClick={() => handleAddParameter(param)}
                        disabled={activeParams.includes(param.name)}
                        icon={<AddIcon />}
                        variant={activeParams.includes(param.name) ? "filled" : "outlined"}
                        sx={{ width: '100%', justifyContent: 'flex-start' }}
                      />
                    </Grid>
                  ))}
                </Grid>
              </AccordionDetails>
            </Accordion>
            
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography>Special Parameters</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={1}>
                  {[
                    { name: '_count', description: 'Results per page' },
                    { name: '_sort', description: 'Sort results' },
                    { name: '_include', description: 'Include references' },
                    { name: '_revinclude', description: 'Include referencing' },
                    { name: '_summary', description: 'Summary mode' },
                  ].map((param) => (
                    <Grid item xs={12} sm={6} md={4} key={param.name}>
                      <Chip
                        label={param.description}
                        onClick={() => handleAddParameter(param)}
                        disabled={activeParams.includes(param.name)}
                        icon={<AddIcon />}
                        variant={activeParams.includes(param.name) ? "filled" : "outlined"}
                        sx={{ width: '100%', justifyContent: 'flex-start' }}
                      />
                    </Grid>
                  ))}
                </Grid>
              </AccordionDetails>
            </Accordion>
          </Box>
        );
        
      case 'expert':
        return (
          <Box>
            <TextField
              fullWidth
              label="FHIR Query URL"
              value={searchQuery}
              onChange={(e) => {
                const newQuery = e.target.value;
                setSearchQuery(newQuery);
                // Extract resource and params for validation
                const match = newQuery.match(/\/fhir\/R4\/([^?/]+)(\?(.*))?/);
                if (match) {
                  const resource = match[1];
                  const queryString = match[3] || '';
                  const params = {};
                  new URLSearchParams(queryString).forEach((value, key) => {
                    if (params[key]) {
                      params[key] = Array.isArray(params[key]) ? [...params[key], value] : [params[key], value];
                    } else {
                      params[key] = value;
                    }
                  });
                  validateQuery(newQuery, resource, params);
                }
              }}
              multiline
              minRows={4}
              maxRows={12}
              placeholder="/fhir/R4/Patient?family=Smith&gender=female&_count=10"
              variant="outlined"
              error={!queryValidation.valid}
              sx={{
                '& .MuiInputBase-root': {
                  fontFamily: 'monospace',
                  fontSize: '14px',
                }
              }}
              helperText={
                <Box>
                  <Typography variant="caption">
                    Enter your FHIR query directly. Press Ctrl+Enter to execute.
                  </Typography>
                  {!queryValidation.valid && (
                    <Typography variant="caption" color="error" display="block">
                      Fix errors before executing query.
                    </Typography>
                  )}
                </Box>
              }
              onKeyDown={(e) => {
                if (e.ctrlKey && e.key === 'Enter' && queryValidation.valid) {
                  executeQuery();
                }
              }}
            />
            
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary" gutterBottom>
                Query Templates:
              </Typography>
              <Box display="flex" gap={1} flexWrap="wrap" sx={{ mt: 1 }}>
                <Chip
                  label="Patient by name"
                  size="small"
                  onClick={() => setSearchQuery('/fhir/R4/Patient?family=&given=')}
                  variant="outlined"
                />
                <Chip
                  label="Recent observations"
                  size="small"
                  onClick={() => setSearchQuery('/fhir/R4/Observation?_sort=-date&_count=10')}
                  variant="outlined"
                />
                <Chip
                  label="Active conditions"
                  size="small"
                  onClick={() => setSearchQuery('/fhir/R4/Condition?clinical-status=active')}
                  variant="outlined"
                />
                <Chip
                  label="With includes"
                  size="small"
                  onClick={() => setSearchQuery('/fhir/R4/Patient?_id=&_revinclude=Observation:patient&_revinclude=Condition:patient')}
                  variant="outlined"
                />
              </Box>
            </Box>
          </Box>
        );
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" gutterBottom>
            FHIR R4 Explorer
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Interactive FHIR API explorer with intuitive query building for all users
          </Typography>
        </Box>
        <Box display="flex" gap={1}>
          <Button
            variant="outlined"
            startIcon={<TipsIcon />}
            onClick={() => setShowWizard(true)}
          >
            Query Wizard
          </Button>
          <Button
            variant="outlined"
            startIcon={<HistoryIcon />}
            onClick={() => setTabValue(2)}
          >
            History
          </Button>
        </Box>
      </Box>

      <Paper sx={{ mb: 3 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange}>
            <Tab label="Query Builder" icon={<BuildIcon />} />
            <Tab label="Results" icon={<VisibilityIcon />} disabled={!response} />
            <Tab label="History" icon={<HistoryIcon />} />
            <Tab label="Documentation" icon={<DescriptionIcon />} />
            <Tab label="Server Metadata" icon={<ApiIcon />} />
            <Tab label="Compliance" icon={<AssessmentIcon />} />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          <Box sx={{ mb: 3 }}>
            {renderUserModeSelector()}
          </Box>
          
          {renderQueryBuilder()}
          
          <Box sx={{ mt: 3, display: 'flex', gap: 1, alignItems: 'center' }}>
            <Button
              variant="contained"
              onClick={() => executeQuery()}
              disabled={loading || !queryValidation.valid}
              startIcon={loading ? <CircularProgress size={20} /> : <SendIcon />}
              size="large"
              color={queryValidation.valid ? "primary" : "error"}
            >
              Execute Query
            </Button>
            <Button
              variant="outlined"
              onClick={handleClearAll}
              startIcon={<ClearIcon />}
            >
              Clear All
            </Button>
            {userMode !== 'guided' && (
              <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                <Chip
                  label={searchQuery}
                  variant="outlined"
                  sx={{ maxWidth: 400, '& .MuiChip-label': { fontFamily: 'monospace', fontSize: '0.875rem' } }}
                />
                <Tooltip title="Copy query URL">
                  <IconButton 
                    size="small"
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.origin + searchQuery);
                      setSnackbar({ open: true, message: 'Query URL copied!', severity: 'success' });
                    }}
                  >
                    <CopyIcon />
                  </IconButton>
                </Tooltip>
              </Box>
            )}
          </Box>
          
          {loading && <LinearProgress sx={{ mt: 2 }} />}
          
          {/* Query Validation Feedback */}
          {userMode !== 'guided' && queryValidation.errors.length > 0 && (
            <Alert severity="error" sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>Query Errors:</Typography>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {queryValidation.errors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </Alert>
          )}
          
          {userMode !== 'guided' && queryValidation.warnings.length > 0 && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>Query Warnings:</Typography>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {queryValidation.warnings.map((warn, idx) => (
                  <li key={idx}>{warn}</li>
                ))}
              </ul>
            </Alert>
          )}
          
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          {response && (
            <Box>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">Query Results</Typography>
                <Box display="flex" gap={1}>
                  <Chip
                    label={`${response.total || 1} results`}
                    color="primary"
                  />
                  <Chip
                    label={`${response.resourceType}`}
                    color="info"
                  />
                  <Tooltip title="Download results">
                    <IconButton
                      onClick={() => {
                        const blob = new Blob([JSON.stringify(response, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `fhir-results-${Date.now()}.json`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      }}
                    >
                      <DownloadIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
              
              {/* Result Analysis */}
              {response.resourceType === 'Bundle' && response.entry && response.entry.length > 0 && (
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={12} md={4}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                          Resource Distribution
                        </Typography>
                        <Box>
                          {(() => {
                            const distribution = response.entry.reduce((acc, entry) => {
                              const type = entry.resource?.resourceType || 'Unknown';
                              acc[type] = (acc[type] || 0) + 1;
                              return acc;
                            }, {});
                            return Object.entries(distribution).map(([type, count]) => (
                              <Box key={type} display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                                <Box display="flex" alignItems="center" gap={1}>
                                  {RESOURCE_ICONS[type] || <ApiIcon fontSize="small" />}
                                  <Typography variant="body2">{type}</Typography>
                                </Box>
                                <Chip label={count} size="small" />
                              </Box>
                            ));
                          })()}
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                  
                  <Grid item xs={12} md={4}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                          Query Performance
                        </Typography>
                        <Box>
                          <Box display="flex" justifyContent="space-between" mb={1}>
                            <Typography variant="body2">Total Results:</Typography>
                            <Typography variant="body2" fontWeight="bold">{response.total || response.entry.length}</Typography>
                          </Box>
                          <Box display="flex" justifyContent="space-between" mb={1}>
                            <Typography variant="body2">Page Size:</Typography>
                            <Typography variant="body2" fontWeight="bold">{response.entry.length}</Typography>
                          </Box>
                          <Box display="flex" justifyContent="space-between" mb={1}>
                            <Typography variant="body2">Bundle Type:</Typography>
                            <Typography variant="body2" fontWeight="bold">{response.type}</Typography>
                          </Box>
                          {response.link && (
                            <Box display="flex" justifyContent="space-between">
                              <Typography variant="body2">Pages:</Typography>
                              <Typography variant="body2" fontWeight="bold">
                                {Math.ceil((response.total || response.entry.length) / response.entry.length)}
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                  
                  <Grid item xs={12} md={4}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                          Data Insights
                        </Typography>
                        {(() => {
                          const insights = [];
                          
                          // Check for Observations
                          const observations = response.entry.filter(e => e.resource?.resourceType === 'Observation');
                          if (observations.length > 0) {
                            const abnormal = observations.filter(e => 
                              e.resource.interpretation?.coding?.[0]?.code?.includes('H') ||
                              e.resource.interpretation?.coding?.[0]?.code?.includes('L') ||
                              e.resource.interpretation?.coding?.[0]?.code?.includes('A')
                            ).length;
                            if (abnormal > 0) {
                              insights.push({ 
                                text: `${abnormal} abnormal results`, 
                                severity: 'warning' 
                              });
                            }
                          }
                          
                          // Check for active conditions
                          const conditions = response.entry.filter(e => 
                            e.resource?.resourceType === 'Condition' && 
                            e.resource.clinicalStatus?.coding?.[0]?.code === 'active'
                          ).length;
                          if (conditions > 0) {
                            insights.push({ 
                              text: `${conditions} active conditions`, 
                              severity: 'info' 
                            });
                          }
                          
                          // Check for medication requests
                          const meds = response.entry.filter(e => 
                            e.resource?.resourceType === 'MedicationRequest' && 
                            e.resource.status === 'active'
                          ).length;
                          if (meds > 0) {
                            insights.push({ 
                              text: `${meds} active medications`, 
                              severity: 'info' 
                            });
                          }
                          
                          if (insights.length === 0) {
                            insights.push({ 
                              text: 'No significant findings', 
                              severity: 'success' 
                            });
                          }
                          
                          return insights.map((insight, idx) => (
                            <Alert key={idx} severity={insight.severity} sx={{ mb: 1 }}>
                              {insight.text}
                            </Alert>
                          ));
                        })()}
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              )}
              
              {response.resourceType === 'Bundle' && response.entry && (
                <>
                  <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Resource Type</TableCell>
                          <TableCell>ID</TableCell>
                          <TableCell>Summary</TableCell>
                          <TableCell>Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {response.entry.map((entry, index) => (
                          <TableRow key={index} hover>
                            <TableCell>
                              <Chip 
                                label={entry.resource?.resourceType} 
                                size="small"
                                icon={RESOURCE_ICONS[entry.resource?.resourceType]}
                              />
                            </TableCell>
                            <TableCell>{entry.resource?.id}</TableCell>
                            <TableCell>
                              {entry.resource?.resourceType === 'Patient' && 
                                `${entry.resource.name?.[0]?.given?.[0]} ${entry.resource.name?.[0]?.family}`}
                              {entry.resource?.resourceType === 'Observation' && 
                                `${entry.resource.code?.text || entry.resource.code?.coding?.[0]?.display}: ${entry.resource.valueQuantity?.value} ${entry.resource.valueQuantity?.unit || ''}`}
                              {entry.resource?.resourceType === 'Condition' && 
                                entry.resource.code?.text}
                              {entry.resource?.resourceType === 'Encounter' && 
                                `${entry.resource.class?.display} - ${entry.resource.status}`}
                            </TableCell>
                            <TableCell>
                              <IconButton
                                size="small"
                                onClick={() => {
                                  setResponse(entry.resource);
                                  setSnackbar({ 
                                    open: true, 
                                    message: 'Viewing single resource', 
                                    severity: 'info' 
                                  });
                                }}
                              >
                                <VisibilityIcon />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  
                  {response.link && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Pagination:
                      </Typography>
                      <Box display="flex" gap={1}>
                        {response.link.map((link, index) => (
                          <Button
                            key={index}
                            variant="outlined"
                            size="small"
                            onClick={() => {
                              setSearchQuery(link.url);
                              executeQuery();
                            }}
                          >
                            {link.relation}
                          </Button>
                        ))}
                      </Box>
                    </Box>
                  )}
                </>
              )}
              
              <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography>Raw JSON Response</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Box sx={{ maxHeight: '600px', overflow: 'auto' }}>
                    <SyntaxHighlighter
                      language="json"
                      style={docco}
                      customStyle={{
                        fontSize: '12px',
                        borderRadius: '4px',
                      }}
                    >
                      {JSON.stringify(response, null, 2)}
                    </SyntaxHighlighter>
                  </Box>
                </AccordionDetails>
              </Accordion>
            </Box>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Typography variant="h6" gutterBottom>
            Query History
          </Typography>
          
          {queryHistory.length === 0 ? (
            <Alert severity="info">
              No query history yet. Execute some queries to see them here.
            </Alert>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Time</TableCell>
                    <TableCell>Resource</TableCell>
                    <TableCell>Query</TableCell>
                    <TableCell>Results</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {queryHistory.map((item, index) => (
                    <TableRow key={index} hover>
                      <TableCell>
                        {new Date(item.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={item.resourceType} 
                          size="small"
                          icon={RESOURCE_ICONS[item.resourceType]}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                          {item.query}
                        </Typography>
                      </TableCell>
                      <TableCell>{item.resultCount}</TableCell>
                      <TableCell>
                        <Button
                          size="small"
                          onClick={() => {
                            setSelectedResource(item.resourceType);
                            setQueryParams(item.params || {});
                            setTabValue(0);
                          }}
                        >
                          Rerun
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          
          {queryHistory.length > 0 && (
            <Button
              variant="outlined"
              onClick={() => {
                setQueryHistory([]);
                localStorage.removeItem('fhir-query-history');
                setSnackbar({ open: true, message: 'History cleared', severity: 'info' });
              }}
              sx={{ mt: 2 }}
            >
              Clear History
            </Button>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <Typography variant="h6" gutterBottom>
            FHIR API Documentation
          </Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom color="primary">
                    Quick Reference
                  </Typography>
                  
                  <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                    Date Searches:
                  </Typography>
                  <Typography variant="body2" component="div">
                    <ul>
                      <li><code>date=2024-01-01</code> - Exact date</li>
                      <li><code>date=gt2024-01-01</code> - After date</li>
                      <li><code>date=ge2024-01-01&date=le2024-12-31</code> - Date range</li>
                    </ul>
                  </Typography>
                  
                  <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                    Quantity Searches:
                  </Typography>
                  <Typography variant="body2" component="div">
                    <ul>
                      <li><code>value-quantity=gt100</code> - Greater than 100</li>
                      <li><code>value-quantity=80|mg</code> - 80 mg exactly</li>
                      <li><code>value-quantity=ge120|mm[Hg]</code> - ≥120 mmHg</li>
                    </ul>
                  </Typography>
                  
                  <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                    Include References:
                  </Typography>
                  <Typography variant="body2" component="div">
                    <ul>
                      <li><code>_include=Observation:patient</code> - Include patient</li>
                      <li><code>_revinclude=Observation:patient</code> - Include patient's observations</li>
                    </ul>
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom color="primary">
                    Common Patterns
                  </Typography>
                  
                  <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                    Patient Search:
                  </Typography>
                  <SyntaxHighlighter language="bash" style={docco}>
{`# By name
/fhir/R4/Patient?family=Smith&given=John

# By identifier (MRN)
/fhir/R4/Patient?identifier=12345

# By demographics
/fhir/R4/Patient?gender=female&birthdate=1980-01-01`}
                  </SyntaxHighlighter>
                  
                  <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                    Observation Search:
                  </Typography>
                  <SyntaxHighlighter language="bash" style={docco}>
{`# Vital signs for patient
/fhir/R4/Observation?category=vital-signs&patient=Patient/123

# Lab results with abnormal values
/fhir/R4/Observation?category=laboratory&value-quantity=gt100

# Recent results sorted by date
/fhir/R4/Observation?_sort=-date&_count=10`}
                  </SyntaxHighlighter>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={tabValue} index={4}>
          <Typography variant="h6" gutterBottom>
            Server Metadata & Capabilities
          </Typography>
          
          {metadataLoading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : metadata ? (
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom color="primary">
                      Server Information
                    </Typography>
                    <TableContainer>
                      <Table size="small">
                        <TableBody>
                          <TableRow>
                            <TableCell component="th" scope="row">FHIR Version</TableCell>
                            <TableCell>
                              <Chip label={metadata.fhirVersion} color="primary" size="small" />
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell component="th" scope="row">Software</TableCell>
                            <TableCell>
                              {metadata.software?.name} v{metadata.software?.version}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell component="th" scope="row">Publisher</TableCell>
                            <TableCell>{metadata.publisher}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell component="th" scope="row">Implementation</TableCell>
                            <TableCell>{metadata.implementation?.description}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell component="th" scope="row">Status</TableCell>
                            <TableCell>
                              <Chip 
                                label={metadata.status} 
                                color={metadata.status === 'active' ? 'success' : 'default'} 
                                size="small" 
                              />
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell component="th" scope="row">Formats Supported</TableCell>
                            <TableCell>
                              {metadata.format?.map((fmt, idx) => (
                                <Chip key={idx} label={fmt} size="small" sx={{ mr: 0.5 }} />
                              ))}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom color="primary">
                      Supported Resources
                    </Typography>
                    <Grid container spacing={2}>
                      {metadata.rest?.[0]?.resource?.map((resource, idx) => (
                        <Grid item xs={12} sm={6} md={4} key={idx}>
                          <Card variant="outlined">
                            <CardContent>
                              <Box display="flex" alignItems="center" gap={1} mb={1}>
                                {RESOURCE_ICONS[resource.type] || <ApiIcon />}
                                <Typography variant="subtitle1" fontWeight="bold">
                                  {resource.type}
                                </Typography>
                              </Box>
                              <Typography variant="body2" color="text.secondary" gutterBottom>
                                Interactions:
                              </Typography>
                              <Box display="flex" gap={0.5} flexWrap="wrap">
                                {resource.interaction?.map((int, iIdx) => (
                                  <Chip 
                                    key={iIdx} 
                                    label={int.code} 
                                    size="small" 
                                    variant="outlined"
                                    color="primary"
                                  />
                                ))}
                              </Box>
                              {resource.searchParam && resource.searchParam.length > 0 && (
                                <>
                                  <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mt: 1 }}>
                                    Search Parameters: {resource.searchParam.length}
                                  </Typography>
                                  <Tooltip title={resource.searchParam.map(p => p.name).join(', ')}>
                                    <Typography variant="caption" color="text.secondary">
                                      Hover to see parameters
                                    </Typography>
                                  </Tooltip>
                                </>
                              )}
                            </CardContent>
                          </Card>
                        </Grid>
                      ))}
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12}>
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography>Raw Capability Statement</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box sx={{ maxHeight: '400px', overflow: 'auto' }}>
                      <SyntaxHighlighter
                        language="json"
                        style={docco}
                        customStyle={{
                          fontSize: '12px',
                          borderRadius: '4px',
                        }}
                      >
                        {JSON.stringify(metadata, null, 2)}
                      </SyntaxHighlighter>
                    </Box>
                  </AccordionDetails>
                </Accordion>
              </Grid>
            </Grid>
          ) : (
            <Alert severity="warning">
              Unable to load server metadata. Check your connection and try again.
            </Alert>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={5}>
          <Typography variant="h6" gutterBottom>
            FHIR Compliance & Standards
          </Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12} lg={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom color="primary">
                    FHIR R4 Compliance
                  </Typography>
                  <List>
                    <ListItem>
                      <ListItemIcon>
                        <CheckCircleIcon color="success" />
                      </ListItemIcon>
                      <ListItemText 
                        primary="RESTful API"
                        secondary="Full REST implementation with GET, POST, PUT, DELETE"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <CheckCircleIcon color="success" />
                      </ListItemIcon>
                      <ListItemText 
                        primary="Search Parameters"
                        secondary="Supports standard search parameters for all resources"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <CheckCircleIcon color="success" />
                      </ListItemIcon>
                      <ListItemText 
                        primary="Chained Queries"
                        secondary="Complex queries with chained parameters (e.g., Patient.name)"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <CheckCircleIcon color="success" />
                      </ListItemIcon>
                      <ListItemText 
                        primary="_include & _revinclude"
                        secondary="Include related resources in search results"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <CheckCircleIcon color="success" />
                      </ListItemIcon>
                      <ListItemText 
                        primary="Modifiers"
                        secondary="Search modifiers like :exact, :contains, :missing"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <CheckCircleIcon color="success" />
                      </ListItemIcon>
                      <ListItemText 
                        primary="Bulk Export"
                        secondary="$export operation for bulk data access"
                      />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} lg={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom color="primary">
                    Query Syntax Reference
                  </Typography>
                  <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                    Comparison Operators:
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Prefix</TableCell>
                          <TableCell>Meaning</TableCell>
                          <TableCell>Example</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        <TableRow>
                          <TableCell><code>eq</code></TableCell>
                          <TableCell>Equal (default)</TableCell>
                          <TableCell><code>date=2024-01-01</code></TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell><code>gt</code></TableCell>
                          <TableCell>Greater than</TableCell>
                          <TableCell><code>date=gt2024-01-01</code></TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell><code>ge</code></TableCell>
                          <TableCell>Greater or equal</TableCell>
                          <TableCell><code>value-quantity=ge100</code></TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell><code>lt</code></TableCell>
                          <TableCell>Less than</TableCell>
                          <TableCell><code>date=lt2024-12-31</code></TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell><code>le</code></TableCell>
                          <TableCell>Less or equal</TableCell>
                          <TableCell><code>value-quantity=le50</code></TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                  
                  <Typography variant="subtitle2" gutterBottom sx={{ mt: 3 }}>
                    Common Modifiers:
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Modifier</TableCell>
                          <TableCell>Description</TableCell>
                          <TableCell>Example</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        <TableRow>
                          <TableCell><code>:exact</code></TableCell>
                          <TableCell>Exact match</TableCell>
                          <TableCell><code>name:exact=Smith</code></TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell><code>:contains</code></TableCell>
                          <TableCell>Contains substring</TableCell>
                          <TableCell><code>name:contains=mit</code></TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell><code>:missing</code></TableCell>
                          <TableCell>Field is missing</TableCell>
                          <TableCell><code>email:missing=true</code></TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell><code>:not</code></TableCell>
                          <TableCell>Not equal</TableCell>
                          <TableCell><code>status:not=active</code></TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom color="primary">
                    Advanced Query Examples
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" gutterBottom>
                        Complex Patient Queries:
                      </Typography>
                      <SyntaxHighlighter language="bash" style={docco}>
{`# Patients with specific condition
/fhir/R4/Patient?_has:Condition:patient:code=44054006

# Active patients with recent encounters
/fhir/R4/Patient?active=true&_has:Encounter:patient:date=ge2024-01-01

# Patients with everything
/fhir/R4/Patient?_id=123&_revinclude=*`}
                      </SyntaxHighlighter>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" gutterBottom>
                        Complex Observation Queries:
                      </Typography>
                      <SyntaxHighlighter language="bash" style={docco}>
{`# Blood pressure readings above threshold
/fhir/R4/Observation?code=85354-9&component-code=8480-6&component-value-quantity=gt140

# Lab results with critical values
/fhir/R4/Observation?category=laboratory&value-quantity=gt500&status=final

# Observations with patient included
/fhir/R4/Observation?patient=Patient/123&_include=Observation:patient`}
                      </SyntaxHighlighter>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>
      </Paper>

      <QueryWizard
        open={showWizard}
        onClose={() => setShowWizard(false)}
        onExecute={(resource, params) => {
          setSelectedResource(resource);
          setQueryParams(params);
          executeQuery(resource, params);
          setTabValue(1);
        }}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        message={snackbar.message}
      />
    </Box>
  );
}

export default FHIRExplorerEnhanced;