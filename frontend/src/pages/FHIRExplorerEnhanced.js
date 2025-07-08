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
    steps: [
      {
        label: 'Search by name',
        params: { resource: 'Patient', parameters: { family: '', given: '' } },
        help: 'Enter family name and/or given name'
      },
      {
        label: 'Search by demographics',
        params: { resource: 'Patient', parameters: { gender: '', birthdate: '' } },
        help: 'Select gender and/or birthdate'
      },
      {
        label: 'Search by identifier',
        params: { resource: 'Patient', parameters: { identifier: '' } },
        help: 'Enter MRN or other identifier'
      },
    ]
  },
  'Find Lab Results': {
    description: 'Search for laboratory test results',
    icon: <ScienceIcon />,
    steps: [
      {
        label: 'Select patient',
        params: { resource: 'Observation', parameters: { category: 'laboratory', patient: '' } },
        help: 'Enter patient ID or search for patient first'
      },
      {
        label: 'Filter by test type',
        params: { resource: 'Observation', parameters: { category: 'laboratory', code: '' } },
        help: 'Select or enter LOINC code for specific test'
      },
      {
        label: 'Filter by date range',
        params: { resource: 'Observation', parameters: { category: 'laboratory', date: 'ge2024-01-01' } },
        help: 'Select date range for results'
      },
    ]
  },
  'Find Vital Signs': {
    description: 'Search for vital sign measurements',
    icon: <AssessmentIcon />,
    steps: [
      {
        label: 'Recent vital signs for patient',
        params: { resource: 'Observation', parameters: { category: 'vital-signs', patient: '', _count: '10', _sort: '-date' } },
        help: 'Shows most recent vital signs'
      },
      {
        label: 'Specific vital sign over time',
        params: { resource: 'Observation', parameters: { category: 'vital-signs', code: '8480-6', patient: '' } },
        help: 'Track blood pressure or other vital sign'
      },
    ]
  },
  'Patient Summary': {
    description: 'Get comprehensive patient information',
    icon: <AutoAwesomeIcon />,
    steps: [
      {
        label: 'Patient with recent encounters',
        params: { resource: 'Patient', parameters: { _id: '', _revinclude: 'Encounter:patient' } },
        help: 'Patient data with their encounters'
      },
      {
        label: 'Patient with conditions',
        params: { resource: 'Patient', parameters: { _id: '', _revinclude: 'Condition:patient' } },
        help: 'Patient data with their conditions'
      },
      {
        label: 'Patient with everything',
        params: { resource: 'Patient', parameters: { _id: '', _revinclude: ['Encounter:patient', 'Condition:patient', 'Observation:patient'] } },
        help: 'Complete patient record'
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

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleReset = () => {
    setActiveStep(0);
    setQueryParams({});
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
            <Grid container spacing={2}>
              {Object.entries(QUERY_TEMPLATES).map(([name, template]) => (
                <Grid item xs={12} sm={6} key={name}>
                  <Card 
                    variant="outlined" 
                    sx={{ cursor: 'pointer', '&:hover': { boxShadow: 2 } }}
                    onClick={() => {
                      setSelectedTemplate({ name, ...template });
                      setActiveStep(0);
                    }}
                  >
                    <CardContent>
                      <Box display="flex" alignItems="center" gap={1} mb={1}>
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
                      button
                      onClick={() => {
                        // Load saved query
                        setSelectedTemplate(QUERY_TEMPLATES[query.template]);
                        setQueryParams(query.params);
                      }}
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
                          <TextField
                            key={param}
                            fullWidth
                            label={paramDef?.description || param}
                            value={queryParams[param] || defaultValue}
                            onChange={(e) => handleParamChange(param, e.target.value)}
                            placeholder={paramDef?.placeholder}
                            helperText={paramDef?.help}
                            sx={{ mb: 2 }}
                          />
                        );
                      })}
                    </Box>
                    
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
          
          {param.type === 'date' && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Date searches support prefixes: eq (equals), gt (greater than), ge (greater or equal), 
              lt (less than), le (less or equal). Combine with & for ranges.
            </Alert>
          )}
          
          {param.type === 'quantity' && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Quantity searches: use prefixes (gt, lt, ge, le) or specify value|unit format. 
              Examples: gt100, 80|mg, ge120|mm[Hg]
            </Alert>
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
    setSearchQuery(`/fhir/R4/${selectedResource}${queryString ? '?' + queryString : ''}`);
  }, [selectedResource, queryParams]);

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
              onChange={(e) => setSearchQuery(e.target.value)}
              multiline
              minRows={4}
              maxRows={12}
              placeholder="/fhir/R4/Patient?family=Smith&gender=female&_count=10"
              variant="outlined"
              sx={{
                '& .MuiInputBase-root': {
                  fontFamily: 'monospace',
                  fontSize: '14px',
                }
              }}
              helperText="Enter your FHIR query directly. Press Ctrl+Enter to execute."
              onKeyDown={(e) => {
                if (e.ctrlKey && e.key === 'Enter') {
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
              disabled={loading}
              startIcon={loading ? <CircularProgress size={20} /> : <SendIcon />}
              size="large"
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