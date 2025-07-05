import React, { useState, useEffect, useCallback } from 'react';
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
  CardActions,
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
  ListItemButton,
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
  Snackbar,
  ToggleButton,
  ToggleButtonGroup,
  LinearProgress,
  Breadcrumbs,
  Link,
  FormGroup,
  Checkbox,
  Radio,
  RadioGroup,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Menu,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  Collapse,
  Drawer,
  useTheme,
  useMediaQuery,
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
  Save as SaveIcon,
  Share as ShareIcon,
  Timeline as TimelineIcon,
  LocalHospital as HospitalIcon,
  Person as PersonIcon,
  Science as ScienceIcon,
  Medication as MedicationIcon,
  Assignment as AssignmentIcon,
  Business as BusinessIcon,
  LocationOn as LocationIcon,
  EventNote as EventNoteIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  ErrorOutline as ErrorIcon,
  Info as InfoIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Stop as StopIcon,
  RestartAlt as RestartIcon,
  School as SchoolIcon,
  Psychology as PsychologyIcon,
  QueryStats as QueryStatsIcon,
  DataObject as DataObjectIcon,
  ManageSearch as ManageSearchIcon,
  Insights as InsightsIcon,
  Terminal as TerminalIcon,
  TipsAndUpdates as TipsIcon,
  AutoFixHigh as AutoFixIcon,
  Groups as GroupsIcon,
  Biotech as BiotechIcon,
  MonitorHeart as MonitorHeartIcon,
  Vaccines as VaccinesIcon,
  MedicalServices as MedicalServicesIcon,
  Task as TaskIcon,
  CalendarMonth as CalendarIcon,
  AccountTree as AccountTreeIcon,
  Hub as HubIcon,
  Compare as CompareIcon,
  BarChart as BarChartIcon,
  Storage as StorageIcon,
  CloudDownload as CloudDownloadIcon,
  CloudUpload as CloudUploadIcon,
  Sync as SyncIcon,
  Security as SecurityIcon,
  Speed as SpeedIcon,
  BugReport as BugReportIcon,
  Help as HelpIcon,
  BookmarkAdd as BookmarkIcon,
  BookmarkAdded as BookmarkedIcon,
  Favorite as FavoriteIcon,
  FavoriteBorder as FavoriteBorderIcon,
  NavigateNext as NavigateNextIcon,
  NavigateBefore as NavigateBeforeIcon,
  FirstPage as FirstPageIcon,
  LastPage as LastPageIcon,
  MoreVert as MoreVertIcon,
  Settings as SettingsIcon,
  Tune as TuneIcon,
  ViewList as ViewListIcon,
  ViewModule as ViewModuleIcon,
  TableChart as TableChartIcon,
  PieChart as PieChartIcon,
  ShowChart as ShowChartIcon,
  ScatterPlot as ScatterPlotIcon,
  Functions as FunctionsIcon,
  Calculate as CalculateIcon,
  Rule as RuleIcon,
  Schema as SchemaIcon,
  DataArray as DataArrayIcon,
  DataUsage as DataUsageIcon,
  Analytics as AnalyticsIcon,
  Assessment as AssessmentIcon,
  Leaderboard as LeaderboardIcon,
} from '@mui/icons-material';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import json from 'react-syntax-highlighter/dist/esm/languages/hljs/json';
import bash from 'react-syntax-highlighter/dist/esm/languages/hljs/bash';
import xml from 'react-syntax-highlighter/dist/esm/languages/hljs/xml';
import { docco, vs2015, atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { fhirClient } from '../services/fhirClient';
import { emrClient } from '../services/emrClient';

// Register syntax highlighting languages
SyntaxHighlighter.registerLanguage('json', json);
SyntaxHighlighter.registerLanguage('bash', bash);
SyntaxHighlighter.registerLanguage('xml', xml);

// Comprehensive FHIR Resources with icons and descriptions
const FHIR_RESOURCES = [
  // Core Clinical Resources
  { name: 'Patient', icon: <PersonIcon />, category: 'Clinical', description: 'Demographics and patient information' },
  { name: 'Practitioner', icon: <GroupsIcon />, category: 'Clinical', description: 'Healthcare providers' },
  { name: 'PractitionerRole', icon: <AssignmentIcon />, category: 'Clinical', description: 'Provider roles and specialties' },
  { name: 'Organization', icon: <BusinessIcon />, category: 'Clinical', description: 'Healthcare organizations' },
  { name: 'Location', icon: <LocationIcon />, category: 'Clinical', description: 'Physical locations' },
  
  // Clinical Data
  { name: 'Observation', icon: <ScienceIcon />, category: 'Clinical Data', description: 'Vital signs, lab results, measurements' },
  { name: 'Condition', icon: <MonitorHeartIcon />, category: 'Clinical Data', description: 'Diagnoses, problems, health concerns' },
  { name: 'Procedure', icon: <MedicalServicesIcon />, category: 'Clinical Data', description: 'Procedures performed' },
  { name: 'MedicationRequest', icon: <MedicationIcon />, category: 'Clinical Data', description: 'Medication orders and prescriptions' },
  { name: 'MedicationStatement', icon: <MedicationIcon />, category: 'Clinical Data', description: 'Medication usage records' },
  { name: 'Immunization', icon: <VaccinesIcon />, category: 'Clinical Data', description: 'Immunization records' },
  { name: 'AllergyIntolerance', icon: <WarningIcon />, category: 'Clinical Data', description: 'Allergies and intolerances' },
  
  // Care Management
  { name: 'Encounter', icon: <EventNoteIcon />, category: 'Care Management', description: 'Clinical visits and admissions' },
  { name: 'EpisodeOfCare', icon: <TimelineIcon />, category: 'Care Management', description: 'Care episodes' },
  { name: 'CarePlan', icon: <AssignmentIcon />, category: 'Care Management', description: 'Care plans and treatment plans' },
  { name: 'CareTeam', icon: <GroupsIcon />, category: 'Care Management', description: 'Care team members' },
  { name: 'Goal', icon: <FunctionsIcon />, category: 'Care Management', description: 'Treatment goals' },
  { name: 'ServiceRequest', icon: <TaskIcon />, category: 'Care Management', description: 'Service orders and referrals' },
  
  // Diagnostics
  { name: 'DiagnosticReport', icon: <BiotechIcon />, category: 'Diagnostics', description: 'Diagnostic reports and results' },
  { name: 'ImagingStudy', icon: <MonitorHeartIcon />, category: 'Diagnostics', description: 'Medical imaging studies' },
  { name: 'Specimen', icon: <ScienceIcon />, category: 'Diagnostics', description: 'Laboratory specimens' },
  
  // Documents & Communication
  { name: 'DocumentReference', icon: <DescriptionIcon />, category: 'Documents', description: 'Clinical documents' },
  { name: 'Communication', icon: <QueryStatsIcon />, category: 'Documents', description: 'Clinical communications' },
  { name: 'Task', icon: <TaskIcon />, category: 'Documents', description: 'Clinical tasks and workflows' },
  
  // Financial
  { name: 'Coverage', icon: <SecurityIcon />, category: 'Financial', description: 'Insurance coverage' },
  { name: 'Claim', icon: <AssignmentIcon />, category: 'Financial', description: 'Insurance claims' },
  { name: 'ExplanationOfBenefit', icon: <DescriptionIcon />, category: 'Financial', description: 'Insurance EOBs' },
  
  // Scheduling
  { name: 'Appointment', icon: <CalendarIcon />, category: 'Scheduling', description: 'Appointments' },
  { name: 'Schedule', icon: <CalendarIcon />, category: 'Scheduling', description: 'Available schedules' },
  { name: 'Slot', icon: <EventNoteIcon />, category: 'Scheduling', description: 'Available time slots' },
];

// Search parameter definitions with improved metadata
const SEARCH_PARAMETERS = {
  common: [
    { name: '_id', type: 'token', description: 'Logical id of resource', category: 'Common' },
    { name: '_lastUpdated', type: 'date', description: 'When resource last changed', category: 'Common' },
    { name: '_tag', type: 'token', description: 'Tags applied to resource', category: 'Common' },
    { name: '_profile', type: 'uri', description: 'Profiles resource conforms to', category: 'Common' },
    { name: '_security', type: 'token', description: 'Security labels', category: 'Common' },
    { name: '_text', type: 'string', description: 'Text search in narrative', category: 'Common' },
    { name: '_content', type: 'string', description: 'Text search entire content', category: 'Common' },
    { name: '_list', type: 'reference', description: 'Part of referenced list', category: 'Common' },
    { name: '_has', type: 'special', description: 'Reverse chaining', category: 'Common' },
  ],
  result: [
    { name: '_sort', type: 'special', description: 'Sort results by field', category: 'Result', example: '_sort=family,-birthdate' },
    { name: '_count', type: 'number', description: 'Number of results per page', category: 'Result', example: '_count=50' },
    { name: '_include', type: 'special', description: 'Include referenced resources', category: 'Result', example: '_include=Patient:organization' },
    { name: '_revinclude', type: 'special', description: 'Include resources that reference this', category: 'Result', example: '_revinclude=Observation:patient' },
    { name: '_summary', type: 'token', description: 'Return summary only', category: 'Result', options: ['true', 'text', 'data', 'count', 'false'] },
    { name: '_elements', type: 'string', description: 'Include only specified elements', category: 'Result', example: '_elements=id,name,birthDate' },
    { name: '_contained', type: 'token', description: 'Include contained resources', category: 'Result', options: ['true', 'false', 'both'] },
    { name: '_containedType', type: 'token', description: 'Contained resource handling', category: 'Result', options: ['container', 'contained'] },
  ],
  Patient: [
    { name: 'identifier', type: 'token', description: 'Business identifier (MRN, SSN, etc)', category: 'Identifiers' },
    { name: 'active', type: 'token', description: 'Whether patient record is active', category: 'Status', options: ['true', 'false'] },
    { name: 'family', type: 'string', description: 'Family/last name', category: 'Demographics' },
    { name: 'given', type: 'string', description: 'Given/first name', category: 'Demographics' },
    { name: 'phonetic', type: 'string', description: 'Phonetic name', category: 'Demographics' },
    { name: 'telecom', type: 'token', description: 'Phone, email, etc', category: 'Contact' },
    { name: 'phone', type: 'token', description: 'Phone number', category: 'Contact' },
    { name: 'email', type: 'token', description: 'Email address', category: 'Contact' },
    { name: 'address', type: 'string', description: 'Address text', category: 'Contact' },
    { name: 'address-city', type: 'string', description: 'City', category: 'Contact' },
    { name: 'address-state', type: 'string', description: 'State', category: 'Contact' },
    { name: 'address-postalcode', type: 'string', description: 'Postal code', category: 'Contact' },
    { name: 'address-country', type: 'string', description: 'Country', category: 'Contact' },
    { name: 'birthdate', type: 'date', description: 'Date of birth', category: 'Demographics' },
    { name: 'death-date', type: 'date', description: 'Date of death', category: 'Demographics' },
    { name: 'deceased', type: 'token', description: 'Patient deceased', category: 'Demographics', options: ['true', 'false'] },
    { name: 'gender', type: 'token', description: 'Gender', category: 'Demographics', options: ['male', 'female', 'other', 'unknown'] },
    { name: 'general-practitioner', type: 'reference', description: 'Primary care provider', category: 'Care' },
    { name: 'organization', type: 'reference', description: 'Managing organization', category: 'Care' },
    { name: 'link', type: 'reference', description: 'Linked patient resources', category: 'Relationships' },
  ],
  Observation: [
    { name: 'status', type: 'token', description: 'Status', category: 'Status', options: ['registered', 'preliminary', 'final', 'amended', 'corrected', 'cancelled', 'entered-in-error'] },
    { name: 'category', type: 'token', description: 'Category', category: 'Classification', options: ['vital-signs', 'laboratory', 'imaging', 'procedure', 'survey', 'exam', 'therapy', 'activity'] },
    { name: 'code', type: 'token', description: 'Observation code (LOINC, SNOMED, etc)', category: 'What' },
    { name: 'subject', type: 'reference', description: 'Who/what observation is about', category: 'Who' },
    { name: 'patient', type: 'reference', description: 'Patient (if subject is patient)', category: 'Who' },
    { name: 'encounter', type: 'reference', description: 'Related encounter', category: 'Context' },
    { name: 'date', type: 'date', description: 'Observation date/time', category: 'When' },
    { name: 'issued', type: 'date', description: 'Date issued', category: 'When' },
    { name: 'performer', type: 'reference', description: 'Who performed observation', category: 'Who' },
    { name: 'value-quantity', type: 'quantity', description: 'Numeric value', category: 'Value' },
    { name: 'value-string', type: 'string', description: 'String value', category: 'Value' },
    { name: 'value-concept', type: 'token', description: 'Coded value', category: 'Value' },
    { name: 'value-date', type: 'date', description: 'Date value', category: 'Value' },
    { name: 'data-absent-reason', type: 'token', description: 'Why value is missing', category: 'Value' },
    { name: 'device', type: 'reference', description: 'Device used', category: 'How' },
    { name: 'method', type: 'token', description: 'How observation made', category: 'How' },
    { name: 'specimen', type: 'reference', description: 'Specimen used', category: 'What' },
    { name: 'component-code', type: 'token', description: 'Component code', category: 'Components' },
    { name: 'component-value-quantity', type: 'quantity', description: 'Component value', category: 'Components' },
    { name: 'combo-code', type: 'token', description: 'Code OR component code', category: 'Combo' },
    { name: 'combo-value-quantity', type: 'quantity', description: 'Value OR component value', category: 'Combo' },
  ],
  Condition: [
    { name: 'clinical-status', type: 'token', description: 'Clinical status', category: 'Status', options: ['active', 'recurrence', 'relapse', 'inactive', 'remission', 'resolved'] },
    { name: 'verification-status', type: 'token', description: 'Verification status', category: 'Status', options: ['unconfirmed', 'provisional', 'differential', 'confirmed', 'refuted', 'entered-in-error'] },
    { name: 'category', type: 'token', description: 'Category', category: 'Classification', options: ['problem-list-item', 'encounter-diagnosis'] },
    { name: 'severity', type: 'token', description: 'Severity', category: 'Classification', options: ['mild', 'moderate', 'severe'] },
    { name: 'code', type: 'token', description: 'Condition code', category: 'What' },
    { name: 'subject', type: 'reference', description: 'Who has condition', category: 'Who' },
    { name: 'patient', type: 'reference', description: 'Patient (if subject is patient)', category: 'Who' },
    { name: 'encounter', type: 'reference', description: 'Related encounter', category: 'Context' },
    { name: 'onset-date', type: 'date', description: 'Date of onset', category: 'When' },
    { name: 'onset-age', type: 'quantity', description: 'Age at onset', category: 'When' },
    { name: 'recorded-date', type: 'date', description: 'Date recorded', category: 'When' },
    { name: 'asserter', type: 'reference', description: 'Who asserted condition', category: 'Who' },
    { name: 'evidence', type: 'token', description: 'Supporting evidence', category: 'Evidence' },
    { name: 'body-site', type: 'token', description: 'Body site affected', category: 'What' },
  ],
  Encounter: [
    { name: 'status', type: 'token', description: 'Status', category: 'Status', options: ['planned', 'arrived', 'triaged', 'in-progress', 'onleave', 'finished', 'cancelled'] },
    { name: 'class', type: 'token', description: 'Classification', category: 'Classification', options: ['IMP', 'AMB', 'OBSENC', 'EMER', 'VR', 'HH'] },
    { name: 'type', type: 'token', description: 'Encounter type', category: 'Classification' },
    { name: 'service-type', type: 'token', description: 'Service type', category: 'Classification' },
    { name: 'priority', type: 'token', description: 'Priority', category: 'Classification' },
    { name: 'subject', type: 'reference', description: 'Subject of encounter', category: 'Who' },
    { name: 'patient', type: 'reference', description: 'Patient (if subject is patient)', category: 'Who' },
    { name: 'episode-of-care', type: 'reference', description: 'Episode of care', category: 'Context' },
    { name: 'date', type: 'date', description: 'Encounter date/period', category: 'When' },
    { name: 'length', type: 'quantity', description: 'Length of encounter', category: 'When' },
    { name: 'reason-code', type: 'token', description: 'Reason for visit', category: 'Why' },
    { name: 'reason-reference', type: 'reference', description: 'Reason reference', category: 'Why' },
    { name: 'diagnosis', type: 'reference', description: 'Related diagnosis', category: 'What' },
    { name: 'participant', type: 'reference', description: 'Participant', category: 'Who' },
    { name: 'practitioner', type: 'reference', description: 'Practitioner', category: 'Who' },
    { name: 'location', type: 'reference', description: 'Location', category: 'Where' },
    { name: 'service-provider', type: 'reference', description: 'Service provider', category: 'Who' },
    { name: 'part-of', type: 'reference', description: 'Part of encounter', category: 'Context' },
  ],
  MedicationRequest: [
    { name: 'status', type: 'token', description: 'Status', category: 'Status', options: ['active', 'on-hold', 'cancelled', 'completed', 'entered-in-error', 'stopped', 'draft', 'unknown'] },
    { name: 'intent', type: 'token', description: 'Intent', category: 'Intent', options: ['proposal', 'plan', 'order', 'original-order', 'reflex-order', 'filler-order', 'instance-order', 'option'] },
    { name: 'priority', type: 'token', description: 'Priority', category: 'Priority', options: ['routine', 'urgent', 'asap', 'stat'] },
    { name: 'medication', type: 'reference', description: 'Medication', category: 'What' },
    { name: 'code', type: 'token', description: 'Medication code', category: 'What' },
    { name: 'subject', type: 'reference', description: 'Subject', category: 'Who' },
    { name: 'patient', type: 'reference', description: 'Patient', category: 'Who' },
    { name: 'encounter', type: 'reference', description: 'Encounter', category: 'Context' },
    { name: 'authoredon', type: 'date', description: 'When authorized', category: 'When' },
    { name: 'requester', type: 'reference', description: 'Who requested', category: 'Who' },
    { name: 'performer', type: 'reference', description: 'Intended performer', category: 'Who' },
    { name: 'intended-dispenser', type: 'reference', description: 'Intended dispenser', category: 'Who' },
  ],
};

// Search modifiers with better organization
const SEARCH_MODIFIERS = {
  string: [
    { value: '', label: 'Default (starts with)', description: 'Case-insensitive, starts with' },
    { value: ':exact', label: 'Exact match', description: 'Case-sensitive, exact match' },
    { value: ':contains', label: 'Contains', description: 'Case-insensitive, contains' },
    { value: ':text', label: 'Text search', description: 'Search display text' },
  ],
  token: [
    { value: '', label: 'Default', description: 'Exact match on system|code' },
    { value: ':text', label: 'Text search', description: 'Search display text' },
    { value: ':not', label: 'Not', description: 'Exclude matches' },
    { value: ':above', label: 'Above', description: 'Subsumes matches' },
    { value: ':below', label: 'Below', description: 'Subsumed by matches' },
    { value: ':in', label: 'In ValueSet', description: 'In specified ValueSet' },
    { value: ':not-in', label: 'Not in ValueSet', description: 'Not in specified ValueSet' },
    { value: ':of-type', label: 'Of type', description: 'Reference of type' },
  ],
  reference: [
    { value: '', label: 'Default', description: 'Reference by id' },
    { value: ':identifier', label: 'By identifier', description: 'Reference by identifier' },
    { value: ':above', label: 'Above', description: 'References above in hierarchy' },
    { value: ':below', label: 'Below', description: 'References below in hierarchy' },
    { value: ':type', label: 'By type', description: 'References of specific type' },
  ],
  date: [
    { value: '', label: 'Equals', description: 'Exact date/time match', prefix: 'eq' },
    { value: '', label: 'Not equals', description: 'Not exact match', prefix: 'ne' },
    { value: '', label: 'Greater than', description: 'After date/time', prefix: 'gt' },
    { value: '', label: 'Less than', description: 'Before date/time', prefix: 'lt' },
    { value: '', label: 'Greater or equal', description: 'On or after date/time', prefix: 'ge' },
    { value: '', label: 'Less or equal', description: 'On or before date/time', prefix: 'le' },
    { value: '', label: 'Starts after', description: 'Period starts after', prefix: 'sa' },
    { value: '', label: 'Ends before', description: 'Period ends before', prefix: 'eb' },
    { value: '', label: 'Approximately', description: 'Approximately equal', prefix: 'ap' },
  ],
  quantity: [
    { value: '', label: 'Equals', description: 'Equal value', prefix: 'eq' },
    { value: '', label: 'Not equals', description: 'Not equal value', prefix: 'ne' },
    { value: '', label: 'Greater than', description: 'Greater than value', prefix: 'gt' },
    { value: '', label: 'Less than', description: 'Less than value', prefix: 'lt' },
    { value: '', label: 'Greater or equal', description: 'Greater or equal value', prefix: 'ge' },
    { value: '', label: 'Less or equal', description: 'Less or equal value', prefix: 'le' },
    { value: '', label: 'Starts after', description: 'Range starts after', prefix: 'sa' },
    { value: '', label: 'Ends before', description: 'Range ends before', prefix: 'eb' },
    { value: '', label: 'Approximately', description: 'Approximately equal', prefix: 'ap' },
  ],
  number: [
    { value: '', label: 'Equals', description: 'Equal value', prefix: 'eq' },
    { value: '', label: 'Not equals', description: 'Not equal value', prefix: 'ne' },
    { value: '', label: 'Greater than', description: 'Greater than value', prefix: 'gt' },
    { value: '', label: 'Less than', description: 'Less than value', prefix: 'lt' },
    { value: '', label: 'Greater or equal', description: 'Greater or equal value', prefix: 'ge' },
    { value: '', label: 'Less or equal', description: 'Less or equal value', prefix: 'le' },
  ],
  uri: [
    { value: '', label: 'Default', description: 'Exact URI match' },
    { value: ':below', label: 'Below', description: 'URIs below in hierarchy' },
    { value: ':above', label: 'Above', description: 'URIs above in hierarchy' },
  ],
};

// Predefined query templates for different use cases
const QUERY_TEMPLATES = {
  'Clinical Queries': [
    {
      name: 'Active Patients',
      description: 'All active patients in the system',
      resource: 'Patient',
      params: { active: 'true', _count: '20', _sort: '-_lastUpdated' },
      tags: ['basic', 'patient'],
    },
    {
      name: 'Recent Vital Signs',
      description: 'Vital signs from last 7 days',
      resource: 'Observation',
      params: { 
        category: 'vital-signs', 
        date: 'ge' + new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        _sort: '-date',
        _include: 'Observation:patient',
      },
      tags: ['vitals', 'recent'],
    },
    {
      name: 'Abnormal Lab Results',
      description: 'Lab results outside reference range',
      resource: 'Observation',
      params: { 
        category: 'laboratory',
        status: 'final',
        _filter: 'value-quantity gt referenceRange.high.value or value-quantity lt referenceRange.low.value',
      },
      tags: ['lab', 'abnormal', 'advanced'],
    },
    {
      name: 'Active Medications',
      description: 'Current active medication orders',
      resource: 'MedicationRequest',
      params: { 
        status: 'active',
        _include: 'MedicationRequest:patient',
        _include: 'MedicationRequest:medication',
        _sort: '-authoredon',
      },
      tags: ['medication', 'active'],
    },
    {
      name: 'Recent Encounters',
      description: 'Encounters from last 30 days',
      resource: 'Encounter', 
      params: {
        date: 'ge' + new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        _include: 'Encounter:patient',
        _include: 'Encounter:practitioner',
        _sort: '-date',
      },
      tags: ['encounter', 'recent'],
    },
    {
      name: 'High Risk Patients',
      description: 'Patients with multiple chronic conditions',
      resource: 'Patient',
      params: {
        _has: 'Condition:patient:clinical-status=active',
        _revinclude: 'Condition:patient',
        _count: '10',
      },
      tags: ['patient', 'risk', 'advanced'],
    },
  ],
  'Quality Measures': [
    {
      name: 'Diabetic Patients',
      description: 'Patients with diabetes diagnosis',
      resource: 'Patient',
      params: {
        _has: 'Condition:patient:code=http://snomed.info/sct|73211009',
        _revinclude: 'Condition:patient',
        _revinclude: 'Observation:patient',
      },
      tags: ['diabetes', 'chronic', 'quality'],
    },
    {
      name: 'Blood Pressure Control',
      description: 'Recent BP measurements for hypertensive patients',
      resource: 'Observation',
      params: {
        code: 'http://loinc.org|85354-9',
        date: 'ge' + new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        'subject:Condition.code': 'http://snomed.info/sct|38341003',
      },
      tags: ['hypertension', 'vitals', 'quality'],
    },
    {
      name: 'Overdue Screenings',
      description: 'Patients missing preventive screenings',
      resource: 'Patient',
      params: {
        '_has:Observation:patient:code': 'http://loinc.org|82810-3',
        '_has:Observation:patient:date': 'lt' + new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      },
      tags: ['screening', 'preventive', 'quality'],
    },
  ],
  'Data Analysis': [
    {
      name: 'Resource Distribution',
      description: 'Count of each resource type',
      resource: 'Bundle',
      params: {
        _type: 'batch',
        _summary: 'count',
      },
      tags: ['analytics', 'admin'],
    },
    {
      name: 'Patient Demographics',
      description: 'Patient age and gender distribution',
      resource: 'Patient',
      params: {
        _summary: 'data',
        _elements: 'birthDate,gender',
        _count: '1000',
      },
      tags: ['demographics', 'analytics'],
    },
    {
      name: 'Observation Trends',
      description: 'Observation values over time',
      resource: 'Observation',
      params: {
        code: '{code}',
        patient: '{patient}',
        date: 'ge{startDate}',
        _sort: 'date',
      },
      tags: ['trends', 'analytics', 'template'],
    },
  ],
  'Administrative': [
    {
      name: 'Provider Directory',
      description: 'All practitioners with roles',
      resource: 'Practitioner',
      params: {
        _include: 'PractitionerRole:practitioner',
        _sort: 'family',
      },
      tags: ['provider', 'admin'],
    },
    {
      name: 'Organization Hierarchy',
      description: 'Organizations with relationships',
      resource: 'Organization',
      params: {
        _include: 'Organization:partof',
        _revinclude: 'Organization:partof',
      },
      tags: ['organization', 'admin', 'hierarchy'],
    },
    {
      name: 'Location Services',
      description: 'Locations with services offered',
      resource: 'Location',
      params: {
        status: 'active',
        _include: 'Location:organization',
      },
      tags: ['location', 'admin'],
    },
  ],
  'Advanced Features': [
    {
      name: 'Batch Bundle',
      description: 'Execute multiple queries in one request',
      resource: 'Bundle',
      customQuery: {
        method: 'POST',
        url: '/fhir/R4/',
        body: {
          resourceType: 'Bundle',
          type: 'batch',
          entry: [
            { request: { method: 'GET', url: 'Patient?_count=5' } },
            { request: { method: 'GET', url: 'Observation?_count=5' } },
            { request: { method: 'GET', url: 'Condition?_count=5' } },
          ],
        },
      },
      tags: ['bundle', 'batch', 'advanced'],
    },
    {
      name: 'Transaction Bundle',
      description: 'Atomic transaction with multiple operations',
      resource: 'Bundle',
      customQuery: {
        method: 'POST',
        url: '/fhir/R4/',
        body: {
          resourceType: 'Bundle',
          type: 'transaction',
          entry: [
            {
              resource: {
                resourceType: 'Patient',
                identifier: [{ system: 'http://example.org/mrn', value: '12345' }],
                name: [{ family: 'Test', given: ['Transaction'] }],
                gender: 'other',
              },
              request: { method: 'POST', url: 'Patient' },
            },
          ],
        },
      },
      tags: ['bundle', 'transaction', 'advanced'],
    },
    {
      name: 'Conditional Create',
      description: 'Create only if not exists',
      resource: 'Patient',
      customQuery: {
        method: 'POST',
        url: '/fhir/R4/Patient',
        headers: { 'If-None-Exist': 'identifier=http://example.org/mrn|12345' },
        body: {
          resourceType: 'Patient',
          identifier: [{ system: 'http://example.org/mrn', value: '12345' }],
          name: [{ family: 'Conditional', given: ['Test'] }],
        },
      },
      tags: ['conditional', 'advanced'],
    },
    {
      name: 'History - Instance',
      description: 'Version history for a specific resource',
      resource: 'Patient',
      customQuery: {
        method: 'GET',
        url: '/fhir/R4/Patient/{id}/_history',
      },
      tags: ['history', 'versioning', 'advanced'],
    },
    {
      name: 'History - Type',
      description: 'History of all resources of a type',
      resource: 'Patient',
      params: {
        _history: 'true',
        _count: '20',
        _since: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
      customUrl: '/fhir/R4/Patient/_history',
      tags: ['history', 'type', 'advanced'],
    },
    {
      name: 'Capability Statement',
      description: 'Server capabilities and supported features',
      resource: 'CapabilityStatement',
      customQuery: {
        method: 'GET',
        url: '/fhir/R4/metadata',
      },
      tags: ['metadata', 'capability', 'advanced'],
    },
  ],
};

// Helper functions
const getResourceIcon = (resourceType) => {
  const resource = FHIR_RESOURCES.find(r => r.name === resourceType);
  return resource?.icon || <DataObjectIcon />;
};

const getResourceDescription = (resourceType) => {
  const resource = FHIR_RESOURCES.find(r => r.name === resourceType);
  return resource?.description || resourceType;
};

const getCategoryColor = (category) => {
  const colors = {
    'Clinical': 'primary',
    'Clinical Data': 'secondary',
    'Care Management': 'info',
    'Diagnostics': 'warning',
    'Documents': 'success',
    'Financial': 'error',
    'Scheduling': 'primary',
  };
  return colors[category] || 'default';
};

// Query builder component for visual query construction
function QueryBuilder({ resource, params, onChange, onExecute }) {
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Get all available parameters for the resource
  const commonParams = SEARCH_PARAMETERS.common || [];
  const resultParams = SEARCH_PARAMETERS.result || [];
  const resourceParams = SEARCH_PARAMETERS[resource] || [];
  const allParams = [...commonParams, ...resultParams, ...resourceParams];
  
  // Get unique categories
  const categories = ['All', ...new Set(allParams.map(p => p.category).filter(Boolean))];
  
  // Filter parameters
  const filteredParams = allParams.filter(param => {
    const matchesCategory = activeCategory === 'All' || param.category === activeCategory;
    const matchesSearch = !searchTerm || 
      param.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      param.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });
  
  const handleAddParam = (param) => {
    onChange({ ...params, [param.name]: '' });
  };
  
  const handleRemoveParam = (paramName) => {
    const newParams = { ...params };
    delete newParams[paramName];
    onChange(newParams);
  };
  
  const handleParamChange = (paramName, value) => {
    onChange({ ...params, [paramName]: value });
  };
  
  return (
    <Box>
      <Box sx={{ mb: 2 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search parameters..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
          }}
        />
      </Box>
      
      <Box sx={{ mb: 2 }}>
        <ToggleButtonGroup
          value={activeCategory}
          exclusive
          onChange={(e, value) => value && setActiveCategory(value)}
          size="small"
          sx={{ flexWrap: 'wrap' }}
        >
          {categories.map(cat => (
            <ToggleButton key={cat} value={cat}>
              {cat}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>
      
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" gutterBottom>
          Active Parameters
        </Typography>
        {Object.keys(params).length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No parameters selected. Add parameters below.
          </Typography>
        ) : (
          <Stack spacing={1}>
            {Object.entries(params).map(([key, value]) => {
              const paramDef = allParams.find(p => p.name === key) || 
                { name: key, type: 'string', description: key };
              return (
                <ParameterEditor
                  key={key}
                  param={paramDef}
                  value={value}
                  onChange={(newValue) => handleParamChange(key, newValue)}
                  onRemove={() => handleRemoveParam(key)}
                />
              );
            })}
          </Stack>
        )}
      </Box>
      
      <Divider sx={{ my: 2 }} />
      
      <Box>
        <Typography variant="subtitle2" gutterBottom>
          Available Parameters
        </Typography>
        <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
          {filteredParams.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No parameters match your search.
            </Typography>
          ) : (
            <List dense>
              {filteredParams.map(param => (
                <ListItemButton
                  key={param.name}
                  onClick={() => handleAddParam(param)}
                  disabled={params.hasOwnProperty(param.name)}
                >
                  <ListItemIcon>
                    <Chip
                      label={param.type}
                      size="small"
                      color={params.hasOwnProperty(param.name) ? 'primary' : 'default'}
                    />
                  </ListItemIcon>
                  <ListItemText
                    primary={param.name}
                    secondary={param.description}
                  />
                  {param.example && (
                    <Typography variant="caption" color="text.secondary">
                      e.g. {param.example}
                    </Typography>
                  )}
                </ListItemButton>
              ))}
            </List>
          )}
        </Box>
      </Box>
      
      <Box sx={{ mt: 3 }}>
        <Button
          fullWidth
          variant="contained"
          onClick={onExecute}
          startIcon={<SendIcon />}
        >
          Execute Query
        </Button>
      </Box>
    </Box>
  );
}

// Parameter editor component
function ParameterEditor({ param, value, onChange, onRemove }) {
  const [modifier, setModifier] = useState('');
  const theme = useTheme();
  
  const modifiers = SEARCH_MODIFIERS[param.type] || [];
  const hasPrefix = modifier && modifiers.find(m => m.prefix === modifier)?.prefix;
  
  const handleValueChange = (newValue) => {
    if (hasPrefix) {
      onChange(`${modifier}${newValue}`);
    } else {
      onChange(newValue);
    }
  };
  
  const handleModifierChange = (newModifier) => {
    setModifier(newModifier);
    if (newModifier && modifiers.find(m => m.prefix === newModifier)?.prefix) {
      onChange(`${newModifier}${value.replace(/^[a-z]+/, '')}`);
    }
  };
  
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
              {param.name}
            </Typography>
            <Chip label={param.type} size="small" />
            <IconButton size="small" onClick={onRemove} sx={{ ml: 1 }}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
          
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            {param.description}
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            {modifiers.length > 0 && param.type !== 'date' && param.type !== 'quantity' && param.type !== 'number' && (
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Modifier</InputLabel>
                <Select
                  value={modifier}
                  onChange={(e) => handleModifierChange(e.target.value)}
                  label="Modifier"
                >
                  <MenuItem value="">None</MenuItem>
                  {modifiers.map(mod => (
                    <MenuItem key={mod.value || mod.prefix} value={mod.value || mod.prefix}>
                      <Box>
                        <Typography variant="body2">{mod.label}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {mod.description}
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            
            {(param.type === 'date' || param.type === 'quantity' || param.type === 'number') && (
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Operator</InputLabel>
                <Select
                  value={modifier}
                  onChange={(e) => handleModifierChange(e.target.value)}
                  label="Operator"
                >
                  {modifiers.map(mod => (
                    <MenuItem key={mod.prefix} value={mod.prefix}>
                      {mod.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            
            {param.options ? (
              <FormControl size="small" sx={{ flexGrow: 1 }}>
                <InputLabel>{param.name}</InputLabel>
                <Select
                  value={value.replace(/^[a-z]+/, '')}
                  onChange={(e) => handleValueChange(e.target.value)}
                  label={param.name}
                >
                  <MenuItem value="">
                    <em>None</em>
                  </MenuItem>
                  {param.options.map(option => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ) : param.type === 'date' ? (
              <TextField
                size="small"
                type="datetime-local"
                value={value.replace(/^[a-z]+/, '')}
                onChange={(e) => handleValueChange(e.target.value)}
                sx={{ flexGrow: 1 }}
                InputLabelProps={{ shrink: true }}
              />
            ) : param.type === 'number' || param.type === 'quantity' ? (
              <TextField
                size="small"
                type="number"
                value={value.replace(/^[a-z]+/, '')}
                onChange={(e) => handleValueChange(e.target.value)}
                placeholder="Enter value"
                sx={{ flexGrow: 1 }}
              />
            ) : param.type === 'reference' ? (
              <TextField
                size="small"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="ResourceType/id or identifier"
                sx={{ flexGrow: 1 }}
                helperText="e.g., Patient/123 or Organization/abc"
              />
            ) : (
              <TextField
                size="small"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={`Enter ${param.name}`}
                sx={{ flexGrow: 1 }}
              />
            )}
          </Box>
          
          {param.example && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Example: {param.example}
            </Typography>
          )}
        </Box>
      </Box>
    </Paper>
  );
}

// Response viewer with multiple display formats
function ResponseViewer({ response, format, onNavigate }) {
  const theme = useTheme();
  const [expandedResources, setExpandedResources] = useState(new Set());
  const [selectedResource, setSelectedResource] = useState(null);
  
  if (!response) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        minHeight={400}
        color="text.secondary"
      >
        <ApiIcon sx={{ fontSize: 64, mb: 2 }} />
        <Typography>No response yet</Typography>
        <Typography variant="caption">Execute a query to see results</Typography>
      </Box>
    );
  }
  
  const toggleExpanded = (id) => {
    const newExpanded = new Set(expandedResources);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedResources(newExpanded);
  };
  
  const renderResourceSummary = (resource) => {
    if (!resource) return 'N/A';
    
    switch (resource.resourceType) {
      case 'Patient':
        const name = resource.name?.[0];
        return `${name?.given?.[0] || ''} ${name?.family || ''} (${resource.gender || 'unknown'}, ${resource.birthDate || 'unknown'})`;
      
      case 'Observation':
        const code = resource.code?.text || resource.code?.coding?.[0]?.display || 'Unknown';
        const value = resource.valueQuantity ? 
          `${resource.valueQuantity.value} ${resource.valueQuantity.unit}` :
          resource.valueString || 'No value';
        return `${code}: ${value}`;
      
      case 'Condition':
        return resource.code?.text || resource.code?.coding?.[0]?.display || 'Unknown condition';
      
      case 'Encounter':
        return `${resource.class?.display || resource.class?.code || 'Unknown'} - ${resource.status}`;
      
      case 'MedicationRequest':
        return resource.medicationCodeableConcept?.text || 
               resource.medicationCodeableConcept?.coding?.[0]?.display || 
               'Unknown medication';
      
      default:
        return resource.id || 'Unknown';
    }
  };
  
  const renderResourceDetails = (resource) => {
    return (
      <Box>
        <Table size="small">
          <TableBody>
            {Object.entries(resource).map(([key, value]) => (
              <TableRow key={key}>
                <TableCell component="th" scope="row" sx={{ fontWeight: 'medium' }}>
                  {key}
                </TableCell>
                <TableCell>
                  {typeof value === 'object' ? (
                    <SyntaxHighlighter
                      language="json"
                      style={vs2015}
                      customStyle={{ fontSize: '12px', margin: 0 }}
                    >
                      {JSON.stringify(value, null, 2)}
                    </SyntaxHighlighter>
                  ) : (
                    String(value)
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    );
  };
  
  if (format === 'table' && response.resourceType === 'Bundle' && response.entry) {
    return (
      <Box>
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell width={50}>#</TableCell>
                <TableCell width={50}>Type</TableCell>
                <TableCell>ID</TableCell>
                <TableCell>Summary</TableCell>
                <TableCell width={100}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {response.entry.map((entry, index) => (
                <React.Fragment key={index}>
                  <TableRow
                    hover
                    onClick={() => toggleExpanded(index)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>
                      <Tooltip title={entry.resource?.resourceType}>
                        {getResourceIcon(entry.resource?.resourceType)}
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        {entry.resource?.id}
                      </Typography>
                    </TableCell>
                    <TableCell>{renderResourceSummary(entry.resource)}</TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedResource(entry.resource);
                        }}
                      >
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(JSON.stringify(entry.resource, null, 2));
                        }}
                      >
                        <CopyIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={5} sx={{ p: 0 }}>
                      <Collapse in={expandedResources.has(index)}>
                        <Box sx={{ p: 2, bgcolor: 'grey.50' }}>
                          {renderResourceDetails(entry.resource)}
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        
        {response.link && (
          <Box sx={{ mt: 2, display: 'flex', gap: 1, justifyContent: 'center' }}>
            {response.link.map((link, index) => (
              <Button
                key={index}
                variant="outlined"
                size="small"
                startIcon={
                  link.relation === 'next' ? <NavigateNextIcon /> :
                  link.relation === 'previous' ? <NavigateBeforeIcon /> :
                  link.relation === 'first' ? <FirstPageIcon /> :
                  link.relation === 'last' ? <LastPageIcon /> :
                  <LinkIcon />
                }
                onClick={() => onNavigate(link.url)}
              >
                {link.relation}
              </Button>
            ))}
          </Box>
        )}
        
        <Dialog
          open={!!selectedResource}
          onClose={() => setSelectedResource(null)}
          maxWidth="lg"
          fullWidth
        >
          <DialogTitle>
            Resource Details: {selectedResource?.resourceType}/{selectedResource?.id}
          </DialogTitle>
          <DialogContent>
            <SyntaxHighlighter
              language="json"
              style={atomOneDark}
              customStyle={{ fontSize: '14px' }}
            >
              {JSON.stringify(selectedResource, null, 2)}
            </SyntaxHighlighter>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSelectedResource(null)}>Close</Button>
            <Button
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(selectedResource, null, 2));
              }}
              startIcon={<CopyIcon />}
            >
              Copy
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    );
  }
  
  if (format === 'summary' && response.resourceType === 'Bundle') {
    const resourceCounts = {};
    response.entry?.forEach(entry => {
      const type = entry.resource?.resourceType || 'Unknown';
      resourceCounts[type] = (resourceCounts[type] || 0) + 1;
    });
    
    return (
      <Box>
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Total Results
                </Typography>
                <Typography variant="h4">
                  {response.total || response.entry?.length || 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Bundle Type
                </Typography>
                <Typography variant="h4">
                  {response.type}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Resource Types
                </Typography>
                <Typography variant="h4">
                  {Object.keys(resourceCounts).length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Bundle Size
                </Typography>
                <Typography variant="h4">
                  {(JSON.stringify(response).length / 1024).toFixed(1)} KB
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
        
        <Typography variant="h6" gutterBottom>
          Resource Distribution
        </Typography>
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Resource Type</TableCell>
                <TableCell align="right">Count</TableCell>
                <TableCell align="right">Percentage</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Object.entries(resourceCounts).map(([type, count]) => (
                <TableRow key={type}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {getResourceIcon(type)}
                      {type}
                    </Box>
                  </TableCell>
                  <TableCell align="right">{count}</TableCell>
                  <TableCell align="right">
                    {((count / response.entry.length) * 100).toFixed(1)}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    );
  }
  
  // Default JSON view
  return (
    <Box>
      <SyntaxHighlighter
        language="json"
        style={theme.palette.mode === 'dark' ? atomOneDark : docco}
        customStyle={{
          fontSize: '14px',
          maxHeight: '600px',
          overflow: 'auto',
        }}
        showLineNumbers
      >
        {JSON.stringify(response, null, 2)}
      </SyntaxHighlighter>
    </Box>
  );
}

// Main FHIR Explorer component
function FHIRExplorer() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  // State management
  const [selectedResource, setSelectedResource] = useState('Patient');
  const [queryParams, setQueryParams] = useState({});
  const [customQuery, setCustomQuery] = useState('');
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tabValue, setTabValue] = useState(0);
  const [queryMode, setQueryMode] = useState('visual'); // visual, text, template
  const [responseFormat, setResponseFormat] = useState('json'); // json, table, summary
  const [queryHistory, setQueryHistory] = useState([]);
  const [savedQueries, setSavedQueries] = useState([]);
  const [showHelp, setShowHelp] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({
    autoExecute: false,
    syntaxTheme: 'docco',
    pageSize: 20,
    includeTotal: true,
    prettyPrint: true,
  });
  const [drawerOpen, setDrawerOpen] = useState(!isMobile);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  
  // Load saved queries from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('fhir-explorer-saved-queries');
    if (saved) {
      setSavedQueries(JSON.parse(saved));
    }
    
    const history = localStorage.getItem('fhir-explorer-history');
    if (history) {
      setQueryHistory(JSON.parse(history).slice(0, 50));
    }
    
    const savedSettings = localStorage.getItem('fhir-explorer-settings');
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }
  }, []);
  
  // Build query URL from parameters
  const buildQueryUrl = useCallback(() => {
    const params = new URLSearchParams();
    
    // Add default pagination if not specified
    if (!queryParams._count && settings.pageSize) {
      params.append('_count', settings.pageSize);
    }
    
    // Add all query parameters
    Object.entries(queryParams).forEach(([key, value]) => {
      if (value) {
        params.append(key, value);
      }
    });
    
    const queryString = params.toString();
    return `/fhir/R4/${selectedResource}${queryString ? '?' + queryString : ''}`;
  }, [selectedResource, queryParams, settings.pageSize]);
  
  // Execute query
  const executeQuery = async (url = null, method = 'GET', body = null, headers = {}) => {
    setLoading(true);
    setError(null);
    
    try {
      const queryUrl = url || (queryMode === 'text' ? customQuery : buildQueryUrl());
      
      const options = {
        method,
        headers: {
          'Content-Type': 'application/fhir+json',
          ...headers,
        },
      };
      
      if (body) {
        options.body = JSON.stringify(body);
      }
      
      const response = await fetch(queryUrl, options);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.issue?.[0]?.diagnostics || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      setResponse(data);
      
      // Add to history
      const historyEntry = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        method,
        url: queryUrl,
        body,
        headers,
        resource: selectedResource,
        params: queryParams,
        responseStatus: response.status,
        responseCount: data.total || (data.entry?.length) || 1,
      };
      
      const newHistory = [historyEntry, ...queryHistory.slice(0, 49)];
      setQueryHistory(newHistory);
      localStorage.setItem('fhir-explorer-history', JSON.stringify(newHistory));
      
      setSnackbar({
        open: true,
        message: `Query executed successfully. ${data.total || data.entry?.length || 1} results.`,
        severity: 'success',
      });
      
    } catch (err) {
      console.error('Query error:', err);
      setError(err.message);
      setSnackbar({
        open: true,
        message: `Query failed: ${err.message}`,
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Handle template selection
  const handleTemplateSelect = (template) => {
    if (template.customQuery) {
      // Handle custom query templates
      const { method, url, body, headers } = template.customQuery;
      executeQuery(url, method, body, headers);
    } else {
      // Handle standard query templates
      setSelectedResource(template.resource);
      setQueryParams(template.params || {});
      if (template.customUrl) {
        setCustomQuery(template.customUrl);
        setQueryMode('text');
      } else {
        setQueryMode('visual');
        if (settings.autoExecute) {
          setTimeout(() => executeQuery(), 100);
        }
      }
    }
  };
  
  // Handle navigation from response links
  const handleNavigate = (url) => {
    // Parse the URL and update state
    try {
      const urlObj = new URL(url, window.location.origin);
      const pathMatch = urlObj.pathname.match(/\/fhir\/R4\/([^\/\?]+)/);
      
      if (pathMatch) {
        const resource = pathMatch[1];
        const params = {};
        urlObj.searchParams.forEach((value, key) => {
          params[key] = value;
        });
        
        setSelectedResource(resource);
        setQueryParams(params);
        setCustomQuery(url);
        
        // Execute the query
        executeQuery(url);
      }
    } catch (err) {
      console.error('Navigation error:', err);
      setError(`Invalid navigation URL: ${url}`);
    }
  };
  
  // Save current query
  const saveQuery = () => {
    const name = prompt('Enter a name for this query:');
    if (name) {
      const query = {
        id: Date.now(),
        name,
        resource: selectedResource,
        params: queryParams,
        customQuery: queryMode === 'text' ? customQuery : null,
        created: new Date().toISOString(),
      };
      
      const newSaved = [...savedQueries, query];
      setSavedQueries(newSaved);
      localStorage.setItem('fhir-explorer-saved-queries', JSON.stringify(newSaved));
      
      setSnackbar({
        open: true,
        message: 'Query saved successfully',
        severity: 'success',
      });
    }
  };
  
  // Delete saved query
  const deleteSavedQuery = (id) => {
    const newSaved = savedQueries.filter(q => q.id !== id);
    setSavedQueries(newSaved);
    localStorage.setItem('fhir-explorer-saved-queries', JSON.stringify(newSaved));
  };
  
  // Export response
  const exportResponse = (format = 'json') => {
    if (!response) return;
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    let content, filename, mimeType;
    
    switch (format) {
      case 'json':
        content = JSON.stringify(response, null, 2);
        filename = `fhir-response-${timestamp}.json`;
        mimeType = 'application/json';
        break;
        
      case 'csv':
        // Simple CSV export for bundle entries
        if (response.resourceType === 'Bundle' && response.entry) {
          const headers = ['ResourceType', 'ID', 'LastUpdated', 'Summary'];
          const rows = response.entry.map(entry => [
            entry.resource?.resourceType || '',
            entry.resource?.id || '',
            entry.resource?.meta?.lastUpdated || '',
            renderResourceSummary(entry.resource),
          ]);
          
          content = [headers, ...rows]
            .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
            .join('\n');
          filename = `fhir-bundle-${timestamp}.csv`;
          mimeType = 'text/csv';
        } else {
          setSnackbar({
            open: true,
            message: 'CSV export is only available for Bundle resources',
            severity: 'warning',
          });
          return;
        }
        break;
        
      case 'ndjson':
        // Export as newline-delimited JSON
        if (response.resourceType === 'Bundle' && response.entry) {
          content = response.entry
            .map(entry => JSON.stringify(entry.resource))
            .join('\n');
          filename = `fhir-bundle-${timestamp}.ndjson`;
          mimeType = 'application/x-ndjson';
        } else {
          content = JSON.stringify(response);
          filename = `fhir-response-${timestamp}.ndjson`;
          mimeType = 'application/x-ndjson';
        }
        break;
        
      default:
        return;
    }
    
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    setSnackbar({
      open: true,
      message: `Response exported as ${format.toUpperCase()}`,
      severity: 'success',
    });
  };
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Ctrl/Cmd + Enter to execute query
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        executeQuery();
      }
      // Ctrl/Cmd + S to save query
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveQuery();
      }
      // Ctrl/Cmd + K to clear
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setQueryParams({});
        setResponse(null);
        setError(null);
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [queryParams, selectedResource, queryMode, customQuery]);
  
  const drawer = (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Resource Types
      </Typography>
      
      {Object.entries(
        FHIR_RESOURCES.reduce((acc, resource) => {
          if (!acc[resource.category]) acc[resource.category] = [];
          acc[resource.category].push(resource);
          return acc;
        }, {})
      ).map(([category, resources]) => (
        <Accordion key={category} defaultExpanded={category === 'Clinical'}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography>{category}</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <List dense>
              {resources.map(resource => (
                <ListItemButton
                  key={resource.name}
                  selected={selectedResource === resource.name}
                  onClick={() => {
                    setSelectedResource(resource.name);
                    setQueryParams({});
                    if (isMobile) setDrawerOpen(false);
                  }}
                >
                  <ListItemIcon>{resource.icon}</ListItemIcon>
                  <ListItemText
                    primary={resource.name}
                    secondary={resource.description}
                  />
                </ListItemButton>
              ))}
            </List>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
  
  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 64px)' }}>
      {/* Side drawer for resource selection */}
      <Drawer
        variant={isMobile ? 'temporary' : 'permanent'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sx={{
          width: 280,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: 280,
            boxSizing: 'border-box',
            position: 'relative',
            height: '100%',
          },
        }}
      >
        {drawer}
      </Drawer>
      
      {/* Main content */}
      <Box sx={{ flexGrow: 1, p: 3, overflow: 'auto' }}>
        {/* Header */}
        <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
          {isMobile && (
            <IconButton onClick={() => setDrawerOpen(true)}>
              <MenuIcon />
            </IconButton>
          )}
          
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {getResourceIcon(selectedResource)}
              FHIR R4 Explorer
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {getResourceDescription(selectedResource)}
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Settings">
              <IconButton onClick={() => setShowSettings(true)}>
                <SettingsIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Help">
              <IconButton onClick={() => setShowHelp(true)}>
                <HelpIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
        
        {/* Main tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
            <Tab label="Query Builder" icon={<BuildIcon />} />
            <Tab label="Query Templates" icon={<BookmarkIcon />} />
            <Tab label="Query History" icon={<HistoryIcon />} />
            <Tab label="Saved Queries" icon={<SaveIcon />} />
          </Tabs>
        </Box>
        
        {/* Tab panels */}
        <Box sx={{ display: tabValue === 0 ? 'block' : 'none' }}>
          <Grid container spacing={3}>
            <Grid item xs={12} lg={5}>
              <Paper sx={{ p: 2, height: 'calc(100vh - 300px)', overflow: 'auto' }}>
                <Box sx={{ mb: 2, display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Typography variant="h6" sx={{ flexGrow: 1 }}>
                    Query Configuration
                  </Typography>
                  <ToggleButtonGroup
                    value={queryMode}
                    exclusive
                    onChange={(e, v) => v && setQueryMode(v)}
                    size="small"
                  >
                    <ToggleButton value="visual">
                      <Tooltip title="Visual Builder">
                        <BuildIcon />
                      </Tooltip>
                    </ToggleButton>
                    <ToggleButton value="text">
                      <Tooltip title="Raw Query">
                        <CodeIcon />
                      </Tooltip>
                    </ToggleButton>
                  </ToggleButtonGroup>
                </Box>
                
                {queryMode === 'visual' ? (
                  <QueryBuilder
                    resource={selectedResource}
                    params={queryParams}
                    onChange={setQueryParams}
                    onExecute={executeQuery}
                  />
                ) : (
                  <Box>
                    <TextField
                      fullWidth
                      multiline
                      rows={10}
                      value={customQuery || buildQueryUrl()}
                      onChange={(e) => setCustomQuery(e.target.value)}
                      placeholder="/fhir/R4/Patient?family=Smith&_include=Patient:organization"
                      sx={{
                        '& .MuiInputBase-root': {
                          fontFamily: 'monospace',
                        },
                      }}
                    />
                    <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                      <Button
                        variant="contained"
                        fullWidth
                        onClick={() => executeQuery(customQuery)}
                        disabled={loading}
                        startIcon={loading ? <CircularProgress size={20} /> : <SendIcon />}
                      >
                        Execute Query
                      </Button>
                      <Tooltip title="Save Query">
                        <IconButton onClick={saveQuery}>
                          <SaveIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                )}
              </Paper>
            </Grid>
            
            <Grid item xs={12} lg={7}>
              <Paper sx={{ p: 2, height: 'calc(100vh - 300px)', overflow: 'hidden' }}>
                <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="h6" sx={{ flexGrow: 1 }}>
                    Response
                  </Typography>
                  
                  {response && (
                    <>
                      <Chip
                        label={`${response.total || response.entry?.length || 1} results`}
                        color="primary"
                        size="small"
                      />
                      <ToggleButtonGroup
                        value={responseFormat}
                        exclusive
                        onChange={(e, v) => v && setResponseFormat(v)}
                        size="small"
                      >
                        <ToggleButton value="json">
                          <Tooltip title="JSON View">
                            <DataObjectIcon />
                          </Tooltip>
                        </ToggleButton>
                        <ToggleButton value="table">
                          <Tooltip title="Table View">
                            <TableChartIcon />
                          </Tooltip>
                        </ToggleButton>
                        <ToggleButton value="summary">
                          <Tooltip title="Summary View">
                            <BarChartIcon />
                          </Tooltip>
                        </ToggleButton>
                      </ToggleButtonGroup>
                      
                      <Tooltip title="Export">
                        <IconButton
                          onClick={(e) => {
                            const menu = document.createElement('div');
                            menu.innerHTML = `
                              <button onclick="exportResponse('json')">JSON</button>
                              <button onclick="exportResponse('csv')">CSV</button>
                              <button onclick="exportResponse('ndjson')">NDJSON</button>
                            `;
                            // Simple export menu - in production, use proper Menu component
                            exportResponse('json');
                          }}
                        >
                          <DownloadIcon />
                        </IconButton>
                      </Tooltip>
                    </>
                  )}
                </Box>
                
                {error && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                  </Alert>
                )}
                
                <Box sx={{ height: 'calc(100% - 60px)', overflow: 'auto' }}>
                  <ResponseViewer
                    response={response}
                    format={responseFormat}
                    onNavigate={handleNavigate}
                  />
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </Box>
        
        <Box sx={{ display: tabValue === 1 ? 'block' : 'none' }}>
          <Grid container spacing={2}>
            {Object.entries(QUERY_TEMPLATES).map(([category, templates]) => (
              <Grid item xs={12} key={category}>
                <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                  {category}
                </Typography>
                <Grid container spacing={2}>
                  {templates.map((template, index) => (
                    <Grid item xs={12} sm={6} md={4} key={index}>
                      <Card
                        sx={{
                          height: '100%',
                          cursor: 'pointer',
                          '&:hover': { boxShadow: 4 },
                        }}
                        onClick={() => handleTemplateSelect(template)}
                      >
                        <CardContent>
                          <Typography variant="h6" gutterBottom>
                            {template.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" paragraph>
                            {template.description}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                            {template.tags.map(tag => (
                              <Chip key={tag} label={tag} size="small" />
                            ))}
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Grid>
            ))}
          </Grid>
        </Box>
        
        <Box sx={{ display: tabValue === 2 ? 'block' : 'none' }}>
          <Typography variant="h6" gutterBottom>
            Query History
          </Typography>
          {queryHistory.length === 0 ? (
            <Typography color="text.secondary">
              No queries in history yet.
            </Typography>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Time</TableCell>
                    <TableCell>Method</TableCell>
                    <TableCell>Resource</TableCell>
                    <TableCell>Query</TableCell>
                    <TableCell>Results</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {queryHistory.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        {new Date(item.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Chip label={item.method} size="small" />
                      </TableCell>
                      <TableCell>{item.resource}</TableCell>
                      <TableCell sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                          {item.url}
                        </Typography>
                      </TableCell>
                      <TableCell>{item.responseCount}</TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => {
                            setSelectedResource(item.resource || '');
                            setQueryParams(item.params || {});
                            setCustomQuery(item.url);
                            executeQuery(item.url, item.method, item.body, item.headers);
                          }}
                        >
                          <RestartIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
        
        <Box sx={{ display: tabValue === 3 ? 'block' : 'none' }}>
          <Typography variant="h6" gutterBottom>
            Saved Queries
          </Typography>
          {savedQueries.length === 0 ? (
            <Typography color="text.secondary">
              No saved queries yet. Save a query from the Query Builder tab.
            </Typography>
          ) : (
            <Grid container spacing={2}>
              {savedQueries.map((query) => (
                <Grid item xs={12} sm={6} md={4} key={query.id}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6">
                        {query.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {query.resource} - {new Date(query.created).toLocaleDateString()}
                      </Typography>
                    </CardContent>
                    <CardActions>
                      <Button
                        size="small"
                        onClick={() => {
                          setSelectedResource(query.resource);
                          setQueryParams(query.params);
                          if (query.customQuery) {
                            setCustomQuery(query.customQuery);
                            setQueryMode('text');
                          } else {
                            setQueryMode('visual');
                          }
                          setTabValue(0);
                        }}
                      >
                        Load
                      </Button>
                      <IconButton
                        size="small"
                        onClick={() => deleteSavedQuery(query.id)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </CardActions>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      </Box>
      
      {/* Settings Dialog */}
      <Dialog open={showSettings} onClose={() => setShowSettings(false)}>
        <DialogTitle>Explorer Settings</DialogTitle>
        <DialogContent>
          <FormGroup>
            <FormControlLabel
              control={
                <Switch
                  checked={settings.autoExecute}
                  onChange={(e) => {
                    const newSettings = { ...settings, autoExecute: e.target.checked };
                    setSettings(newSettings);
                    localStorage.setItem('fhir-explorer-settings', JSON.stringify(newSettings));
                  }}
                />
              }
              label="Auto-execute queries on template selection"
            />
            <TextField
              label="Default page size"
              type="number"
              value={settings.pageSize}
              onChange={(e) => {
                const newSettings = { ...settings, pageSize: parseInt(e.target.value) || 20 };
                setSettings(newSettings);
                localStorage.setItem('fhir-explorer-settings', JSON.stringify(newSettings));
              }}
              sx={{ mt: 2 }}
            />
          </FormGroup>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSettings(false)}>Close</Button>
        </DialogActions>
      </Dialog>
      
      {/* Help Dialog */}
      <Dialog open={showHelp} onClose={() => setShowHelp(false)} maxWidth="md" fullWidth>
        <DialogTitle>FHIR Explorer Help</DialogTitle>
        <DialogContent>
          <Typography variant="h6" gutterBottom>
            Keyboard Shortcuts
          </Typography>
          <Table size="small">
            <TableBody>
              <TableRow>
                <TableCell><kbd>Ctrl</kbd> + <kbd>Enter</kbd></TableCell>
                <TableCell>Execute query</TableCell>
              </TableRow>
              <TableRow>
                <TableCell><kbd>Ctrl</kbd> + <kbd>S</kbd></TableCell>
                <TableCell>Save current query</TableCell>
              </TableRow>
              <TableRow>
                <TableCell><kbd>Ctrl</kbd> + <kbd>K</kbd></TableCell>
                <TableCell>Clear query and results</TableCell>
              </TableRow>
            </TableBody>
          </Table>
          
          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
            Tips
          </Typography>
          <ul>
            <li>Use the visual query builder for easy parameter selection</li>
            <li>Switch to text mode for advanced queries or custom endpoints</li>
            <li>Save frequently used queries for quick access</li>
            <li>Use templates to learn common query patterns</li>
            <li>Export results in various formats for analysis</li>
            <li>Click on bundle navigation links to paginate through results</li>
          </ul>
          
          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
            Advanced Features
          </Typography>
          <ul>
            <li><strong>Chained queries:</strong> Use dot notation like <code>subject.name=Smith</code></li>
            <li><strong>Reverse includes:</strong> Use <code>_revinclude</code> to include referencing resources</li>
            <li><strong>Modifiers:</strong> Use modifiers like <code>:exact</code>, <code>:contains</code>, <code>:missing</code></li>
            <li><strong>Composite searches:</strong> Combine multiple parameters with <code>&</code></li>
            <li><strong>OR logic:</strong> Use comma-separated values like <code>status=active,completed</code></li>
          </ul>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowHelp(false)}>Close</Button>
        </DialogActions>
      </Dialog>
      
      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
      
      {/* Speed dial for quick actions */}
      <SpeedDial
        ariaLabel="Quick actions"
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
        icon={<SpeedDialIcon />}
      >
        <SpeedDialAction
          icon={<SendIcon />}
          tooltipTitle="Execute Query (Ctrl+Enter)"
          onClick={() => executeQuery()}
        />
        <SpeedDialAction
          icon={<SaveIcon />}
          tooltipTitle="Save Query (Ctrl+S)"
          onClick={saveQuery}
        />
        <SpeedDialAction
          icon={<ClearIcon />}
          tooltipTitle="Clear (Ctrl+K)"
          onClick={() => {
            setQueryParams({});
            setResponse(null);
            setError(null);
          }}
        />
        <SpeedDialAction
          icon={<DownloadIcon />}
          tooltipTitle="Export Response"
          onClick={() => response && exportResponse('json')}
        />
      </SpeedDial>
    </Box>
  );
}

export default FHIRExplorer;