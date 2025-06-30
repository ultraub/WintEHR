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
} from '@mui/icons-material';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import json from 'react-syntax-highlighter/dist/esm/languages/hljs/json';
import bash from 'react-syntax-highlighter/dist/esm/languages/hljs/bash';
import { docco } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import api from '../services/api';
import axios from 'axios';

SyntaxHighlighter.registerLanguage('json', json);
SyntaxHighlighter.registerLanguage('bash', bash);

const FHIR_RESOURCES = [
  'Patient',
  'Encounter',
  'Observation',
  'Condition',
  'MedicationRequest',
  'Practitioner',
  'Organization',
  'Location'
];

// Common search parameters by resource type
const SEARCH_PARAMETERS = {
  Patient: [
    { name: '_id', type: 'token', description: 'Resource ID' },
    { name: 'identifier', type: 'token', description: 'Business identifier' },
    { name: 'family', type: 'string', description: 'Family name' },
    { name: 'given', type: 'string', description: 'Given name' },
    { name: 'birthdate', type: 'date', description: 'Date of birth' },
    { name: 'gender', type: 'token', description: 'Gender', options: ['male', 'female', 'other', 'unknown'] },
    { name: 'address', type: 'string', description: 'Address' },
    { name: '_count', type: 'number', description: 'Number of results per page' },
    { name: '_offset', type: 'number', description: 'Offset for pagination' },
  ],
  Observation: [
    { name: '_id', type: 'token', description: 'Resource ID' },
    { name: 'patient', type: 'reference', description: 'Patient reference' },
    { name: 'subject', type: 'reference', description: 'Subject reference' },
    { name: 'category', type: 'token', description: 'Category', options: ['vital-signs', 'laboratory'] },
    { name: 'code', type: 'token', description: 'LOINC code' },
    { name: 'value-quantity', type: 'quantity', description: 'Numeric value' },
    { name: 'date', type: 'date', description: 'Observation date' },
    { name: 'status', type: 'token', description: 'Status', options: ['final', 'preliminary', 'registered'] },
    { name: '_include', type: 'special', description: 'Include related resources' },
    { name: '_revinclude', type: 'special', description: 'Include resources that reference this' },
  ],
  Encounter: [
    { name: '_id', type: 'token', description: 'Resource ID' },
    { name: 'patient', type: 'reference', description: 'Patient reference' },
    { name: 'subject', type: 'reference', description: 'Subject reference' },
    { name: 'status', type: 'token', description: 'Status', options: ['planned', 'arrived', 'in-progress', 'finished', 'cancelled'] },
    { name: 'class', type: 'token', description: 'Class', options: ['AMB', 'EMER', 'IMP', 'ACUTE', 'SS'] },
    { name: 'type', type: 'token', description: 'Encounter type' },
    { name: 'date', type: 'date', description: 'Encounter date' },
  ],
  Condition: [
    { name: '_id', type: 'token', description: 'Resource ID' },
    { name: 'patient', type: 'reference', description: 'Patient reference' },
    { name: 'subject', type: 'reference', description: 'Subject reference' },
    { name: 'code', type: 'token', description: 'Condition code' },
    { name: 'clinical-status', type: 'token', description: 'Clinical status', options: ['active', 'recurrence', 'relapse', 'inactive', 'remission', 'resolved'] },
    { name: 'verification-status', type: 'token', description: 'Verification status', options: ['unconfirmed', 'provisional', 'differential', 'confirmed', 'refuted'] },
    { name: 'onset-date', type: 'date', description: 'Onset date' },
  ],
  MedicationRequest: [
    { name: '_id', type: 'token', description: 'Resource ID' },
    { name: 'patient', type: 'reference', description: 'Patient reference' },
    { name: 'subject', type: 'reference', description: 'Subject reference' },
    { name: 'status', type: 'token', description: 'Status', options: ['active', 'on-hold', 'cancelled', 'completed', 'stopped'] },
    { name: 'intent', type: 'token', description: 'Intent', options: ['proposal', 'plan', 'order', 'instance-order'] },
    { name: 'authoredon', type: 'date', description: 'Authored on date' },
  ],
};

// Search modifiers
const SEARCH_MODIFIERS = {
  string: [
    { value: '', label: 'Default (contains)' },
    { value: ':exact', label: 'Exact match' },
    { value: ':contains', label: 'Contains' },
    { value: ':text', label: 'Text search' },
  ],
  token: [
    { value: '', label: 'Default' },
    { value: ':text', label: 'Text search' },
  ],
  date: [
    { value: '', label: 'Equals' },
    { value: 'gt', label: 'Greater than', prefix: true },
    { value: 'ge', label: 'Greater or equal', prefix: true },
    { value: 'lt', label: 'Less than', prefix: true },
    { value: 'le', label: 'Less or equal', prefix: true },
  ],
  quantity: [
    { value: '', label: 'Equals' },
    { value: 'gt', label: 'Greater than', prefix: true },
    { value: 'lt', label: 'Less than', prefix: true },
    { value: ':missing', label: 'Is missing', special: true },
    { value: ':above', label: 'Above value' },
    { value: ':below', label: 'Below value' },
  ],
};

const EXAMPLE_QUERIES = {
  Patient: [
    { label: 'All patients', url: '/fhir/R4/Patient' },
    { label: 'Search by name', url: '/fhir/R4/Patient?family=Smith' },
    { label: 'With pagination', url: '/fhir/R4/Patient?_count=10&_offset=0' },
    { label: 'Born in 1980s', url: '/fhir/R4/Patient?birthdate=ge1980-01-01&birthdate=lt1990-01-01' },
  ],
  Observation: [
    { label: 'All observations', url: '/fhir/R4/Observation' },
    { label: 'Vital signs only', url: '/fhir/R4/Observation?category=vital-signs' },
    { label: 'Lab results > 100', url: '/fhir/R4/Observation?category=laboratory&value-quantity=gt100' },
    { label: 'With patient included', url: '/fhir/R4/Observation?_include=Observation:subject' },
    { label: 'Missing values', url: '/fhir/R4/Observation?value-quantity:missing=true' },
  ],
  Encounter: [
    { label: 'All encounters', url: '/fhir/R4/Encounter' },
    { label: 'Finished encounters', url: '/fhir/R4/Encounter?status=finished' },
    { label: 'Emergency visits', url: '/fhir/R4/Encounter?class=EMER' },
  ],
  '_revinclude': [
    { label: 'Patient with observations', url: '/fhir/R4/Patient?_id=123&_revinclude=Observation:patient' },
    { label: 'Patient with all references', url: '/fhir/R4/Patient?_id=123&_revinclude=Observation:patient&_revinclude=Encounter:patient' },
  ],
  'Chained': [
    { label: 'Observations for patient Smith', url: '/fhir/R4/Observation?subject.family=Smith' },
    { label: 'Encounters for female patients', url: '/fhir/R4/Encounter?subject.gender=female' },
  ],
  'Bulk Export': [
    { label: 'Export all data', url: '/fhir/R4/$export' },
    { label: 'Export patient data', url: '/fhir/R4/Patient/$export' },
  ],
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

function QueryParameter({ param, value, onChange, onRemove }) {
  const [modifier, setModifier] = useState('');
  const [paramValue, setParamValue] = useState(value || '');

  const modifiers = SEARCH_MODIFIERS[param.type] || [];

  const handleValueChange = (newValue) => {
    setParamValue(newValue);
    const fullValue = modifier ? `${modifier}${newValue}` : newValue;
    onChange(param.name, fullValue);
  };

  const handleModifierChange = (newModifier) => {
    setModifier(newModifier);
    if (newModifier && modifiers.find(m => m.value === newModifier)?.prefix) {
      onChange(param.name, `${newModifier}${paramValue}`);
    } else if (newModifier) {
      onChange(param.name + newModifier, paramValue);
    } else {
      onChange(param.name, paramValue);
    }
  };

  return (
    <Box sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
      <Typography sx={{ minWidth: 120 }}>{param.name}:</Typography>
      
      {modifiers.length > 0 && (
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <Select
            value={modifier}
            onChange={(e) => handleModifierChange(e.target.value)}
            displayEmpty
          >
            {modifiers.map((mod) => (
              <MenuItem key={mod.value} value={mod.value}>
                {mod.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}

      {param.options ? (
        <FormControl size="small" sx={{ flexGrow: 1 }}>
          <Select
            value={paramValue}
            onChange={(e) => handleValueChange(e.target.value)}
            displayEmpty
          >
            <MenuItem value="">
              <em>None</em>
            </MenuItem>
            {param.options.map((option) => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      ) : (
        <TextField
          size="small"
          value={paramValue}
          onChange={(e) => handleValueChange(e.target.value)}
          placeholder={param.description}
          sx={{ flexGrow: 1 }}
        />
      )}
      
      <IconButton size="small" onClick={() => onRemove(param.name)}>
        <DeleteIcon />
      </IconButton>
    </Box>
  );
}

function FHIRExplorer() {
  const [selectedResource, setSelectedResource] = useState('Patient');
  const [searchQuery, setSearchQuery] = useState('/fhir/R4/Patient');
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tabValue, setTabValue] = useState(0);
  const [capabilityStatement, setCapabilityStatement] = useState(null);
  const [queryParams, setQueryParams] = useState({});
  const [queryHistory, setQueryHistory] = useState([]);
  const [showQueryBuilder, setShowQueryBuilder] = useState(true);
  const [responseFormat, setResponseFormat] = useState('pretty'); // pretty, raw, table

  useEffect(() => {
    // Build query string from params
    const params = new URLSearchParams();
    Object.entries(queryParams).forEach(([key, value]) => {
      if (value) {
        params.append(key, value);
      }
    });
    const queryString = params.toString();
    setSearchQuery(`/fhir/R4/${selectedResource}${queryString ? '?' + queryString : ''}`);
  }, [selectedResource, queryParams]);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
    if (newValue === 1 && !capabilityStatement) {
      fetchCapabilityStatement();
    }
  };

  const fetchCapabilityStatement = async () => {
    try {
      const response = await axios.get('/fhir/R4/metadata');
      setCapabilityStatement(response.data);
    } catch (err) {
      console.error('Error fetching capability statement:', err);
      setError('Failed to fetch capability statement');
    }
  };

  const executeQuery = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(searchQuery);
      setResponse(response.data);
      
      // Add to history
      setQueryHistory(prev => [{
        query: searchQuery,
        timestamp: new Date().toISOString(),
        resourceType: selectedResource,
        resultCount: response.data.total || 1,
      }, ...prev.slice(0, 9)]);
    } catch (err) {
      console.error('Error executing FHIR query:', err);
      setError(err.response?.data?.detail || 'Failed to execute query');
    } finally {
      setLoading(false);
    }
  };

  const handleExampleQuery = (exampleUrl) => {
    // Parse the example URL
    const url = new URL(exampleUrl, window.location.origin);
    const pathParts = url.pathname.split('/');
    const resource = pathParts[pathParts.length - 1];
    
    if (resource.includes('$')) {
      // Special endpoint like $export
      setSearchQuery(exampleUrl);
      setSelectedResource('');
      setQueryParams({});
    } else {
      setSelectedResource(resource);
      const params = {};
      url.searchParams.forEach((value, key) => {
        params[key] = value;
      });
      setQueryParams(params);
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

  const handleCopyQuery = () => {
    navigator.clipboard.writeText(window.location.origin + searchQuery);
  };

  const handleDownloadResponse = () => {
    if (response) {
      const blob = new Blob([JSON.stringify(response, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fhir-response-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const renderResourceSummary = (resource) => {
    if (!resource) return null;
    
    switch (resource.resourceType) {
      case 'Patient':
        return `${resource.name?.[0]?.given?.[0]} ${resource.name?.[0]?.family} (${resource.gender}, ${resource.birthDate})`;
      case 'Observation':
        return `${resource.code?.text || resource.code?.coding?.[0]?.display}: ${resource.valueQuantity?.value} ${resource.valueQuantity?.unit || ''}`;
      case 'Encounter':
        return `${resource.type?.[0]?.text || resource.class?.display} - ${resource.status}`;
      case 'Condition':
        return `${resource.code?.text || resource.code?.coding?.[0]?.display} - ${resource.clinicalStatus?.coding?.[0]?.code}`;
      default:
        return resource.id;
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        FHIR R4 Explorer
      </Typography>
      
      <Typography variant="body1" color="text.secondary" paragraph>
        Interactive FHIR API explorer with query builder, visualization, and comprehensive documentation.
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="Query Builder" icon={<BuildIcon />} />
          <Tab label="Capability Statement" icon={<DescriptionIcon />} />
          <Tab label="Documentation" icon={<CodeIcon />} />
          <Tab label="Examples" icon={<VisibilityIcon />} />
        </Tabs>
      </Box>

      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={3}>
          {/* Query Builder Panel */}
          <Grid item xs={12} lg={5}>
            <Paper sx={{ p: 2, height: '100%' }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">Query Builder</Typography>
                <FormControlLabel
                  control={
                    <Switch
                      checked={showQueryBuilder}
                      onChange={(e) => setShowQueryBuilder(e.target.checked)}
                    />
                  }
                  label="Visual Mode"
                />
              </Box>
              
              {showQueryBuilder ? (
                <>
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>Resource Type</InputLabel>
                    <Select
                      value={selectedResource}
                      onChange={(e) => {
                        setSelectedResource(e.target.value);
                        setQueryParams({});
                      }}
                      label="Resource Type"
                    >
                      {FHIR_RESOURCES.map((resource) => (
                        <MenuItem key={resource} value={resource}>
                          {resource}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <Divider sx={{ my: 2 }} />

                  <Typography variant="subtitle2" gutterBottom>
                    Search Parameters
                  </Typography>

                  {Object.entries(queryParams).map(([key, value]) => {
                    const paramDef = SEARCH_PARAMETERS[selectedResource]?.find(p => p.name === key) || 
                                     { name: key, type: 'string', description: key };
                    return (
                      <QueryParameter
                        key={key}
                        param={paramDef}
                        value={value}
                        onChange={handleParameterChange}
                        onRemove={handleRemoveParameter}
                      />
                    );
                  })}

                  <FormControl fullWidth sx={{ mt: 2 }}>
                    <Autocomplete
                      options={SEARCH_PARAMETERS[selectedResource] || []}
                      getOptionLabel={(option) => `${option.name} - ${option.description}`}
                      renderInput={(params) => (
                        <TextField {...params} label="Add parameter" size="small" />
                      )}
                      onChange={(e, value) => {
                        if (value) {
                          handleAddParameter(value);
                        }
                      }}
                      isOptionEqualToValue={(option, value) => option.name === value.name}
                    />
                  </FormControl>
                </>
              ) : (
                <Box>
                  <TextField
                    fullWidth
                    label="FHIR Query"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    multiline
                    minRows={3}
                    maxRows={12}
                    placeholder="/fhir/R4/Patient?family=Smith&gender=female&_count=10"
                    variant="outlined"
                    sx={{
                      '& .MuiInputBase-root': {
                        fontFamily: 'monospace',
                        fontSize: '14px',
                      }
                    }}
                    helperText="Enter your FHIR query. Supports all FHIR endpoints and parameters. Press Ctrl+Enter to execute."
                    onKeyDown={(e) => {
                      if (e.ctrlKey && e.key === 'Enter') {
                        executeQuery();
                      }
                    }}
                  />
                  <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Typography variant="caption" color="text.secondary">
                      Quick templates:
                    </Typography>
                    <Chip
                      label="Patient search"
                      size="small"
                      onClick={() => setSearchQuery('/fhir/R4/Patient?')}
                      variant="outlined"
                    />
                    <Chip
                      label="Observation search"
                      size="small"
                      onClick={() => setSearchQuery('/fhir/R4/Observation?')}
                      variant="outlined"
                    />
                    <Chip
                      label="With _include"
                      size="small"
                      onClick={() => setSearchQuery(searchQuery + '&_include=')}
                      variant="outlined"
                    />
                    <Chip
                      label="With _revinclude"
                      size="small"
                      onClick={() => setSearchQuery(searchQuery + '&_revinclude=')}
                      variant="outlined"
                    />
                  </Box>
                </Box>
              )}

              <Box sx={{ mt: 3, display: 'flex', gap: 1 }}>
                <Button
                  fullWidth
                  variant="contained"
                  onClick={executeQuery}
                  disabled={loading}
                  startIcon={loading ? <CircularProgress size={20} /> : <SendIcon />}
                >
                  Execute Query
                </Button>
                <Tooltip title="Copy URL">
                  <IconButton onClick={handleCopyQuery}>
                    <CopyIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Clear">
                  <IconButton onClick={() => {
                    setQueryParams({});
                    setResponse(null);
                    setError(null);
                  }}>
                    <ClearIcon />
                  </IconButton>
                </Tooltip>
              </Box>

              {/* Query History */}
              {queryHistory.length > 0 && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" gutterBottom>
                    Recent Queries
                  </Typography>
                  <List dense>
                    {queryHistory.slice(0, 5).map((item, index) => (
                      <ListItem
                        key={index}
                        button
                        onClick={() => handleExampleQuery(item.query)}
                      >
                        <ListItemIcon>
                          <HistoryIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText
                          primary={item.query}
                          secondary={`${item.resultCount} results - ${new Date(item.timestamp).toLocaleTimeString()}`}
                        />
                      </ListItem>
                    ))}
                  </List>
                </>
              )}
            </Paper>
          </Grid>

          {/* Response Display */}
          <Grid item xs={12} lg={7}>
            <Paper sx={{ p: 2, height: '100%', minHeight: 600 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">Response</Typography>
                {response && (
                  <Box display="flex" gap={1}>
                    <Chip
                      label={`${response.total || 1} results`}
                      color="primary"
                      size="small"
                    />
                    <Chip
                      label={`${JSON.stringify(response).length} bytes`}
                      color="info"
                      size="small"
                    />
                    <Tooltip title="Download JSON">
                      <IconButton size="small" onClick={handleDownloadResponse}>
                        <DownloadIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                )}
              </Box>
              
              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}

              {response && (
                <Box>
                  {response.resourceType === 'Bundle' && response.entry && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Bundle Summary
                      </Typography>
                      <TableContainer component={Paper} variant="outlined">
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Type</TableCell>
                              <TableCell>ID</TableCell>
                              <TableCell>Summary</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {response.entry.slice(0, 10).map((entry, index) => (
                              <TableRow key={index}>
                                <TableCell>{entry.resource?.resourceType}</TableCell>
                                <TableCell>{entry.resource?.id}</TableCell>
                                <TableCell>{renderResourceSummary(entry.resource)}</TableCell>
                              </TableRow>
                            ))}
                            {response.entry.length > 10 && (
                              <TableRow>
                                <TableCell colSpan={3} align="center">
                                  <Typography variant="caption" color="text.secondary">
                                    ... and {response.entry.length - 10} more
                                  </Typography>
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </TableContainer>
                      
                      {response.link && (
                        <Box sx={{ mt: 2 }}>
                          <Typography variant="subtitle2" gutterBottom>
                            Navigation Links
                          </Typography>
                          <Box display="flex" gap={1} flexWrap="wrap">
                            {response.link.map((link, index) => (
                              <Chip
                                key={index}
                                label={link.relation}
                                onClick={() => handleExampleQuery(link.url)}
                                icon={<LinkIcon />}
                                variant="outlined"
                                size="small"
                                clickable
                              />
                            ))}
                          </Box>
                        </Box>
                      )}
                    </Box>
                  )}
                  
                  <Box sx={{ maxHeight: '500px', overflow: 'auto' }}>
                    <SyntaxHighlighter
                      language="json"
                      style={docco}
                      customStyle={{
                        fontSize: '12px',
                        borderRadius: '4px',
                        margin: 0,
                      }}
                    >
                      {JSON.stringify(response, null, 2)}
                    </SyntaxHighlighter>
                  </Box>
                </Box>
              )}

              {!response && !error && !loading && (
                <Box
                  display="flex"
                  flexDirection="column"
                  alignItems="center"
                  justifyContent="center"
                  minHeight="400px"
                  color="text.secondary"
                >
                  <ApiIcon sx={{ fontSize: 64, mb: 2 }} />
                  <Typography>Execute a query to see the FHIR response</Typography>
                  <Typography variant="caption" sx={{ mt: 1 }}>
                    Use the query builder or enter a custom endpoint
                  </Typography>
                </Box>
              )}
            </Paper>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            FHIR Capability Statement
          </Typography>
          
          {capabilityStatement ? (
            <Box>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={4}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" color="primary">
                        FHIR Version
                      </Typography>
                      <Typography variant="h4">
                        {capabilityStatement.fhirVersion}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" color="primary">
                        Status
                      </Typography>
                      <Typography variant="h4">
                        {capabilityStatement.status}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" color="primary">
                        Resources
                      </Typography>
                      <Typography variant="h4">
                        {capabilityStatement.rest?.[0]?.resource?.length || 0}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                Supported Resources
              </Typography>
              
              {capabilityStatement.rest?.[0]?.resource?.map((resource, index) => (
                <Accordion key={index}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="h6">{resource.type}</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" gutterBottom>
                          Supported Interactions
                        </Typography>
                        {resource.interaction?.map((interaction, idx) => (
                          <Chip
                            key={idx}
                            label={interaction.code}
                            size="small"
                            sx={{ mr: 1, mb: 1 }}
                            color="primary"
                            variant="outlined"
                          />
                        ))}
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" gutterBottom>
                          Search Parameters
                        </Typography>
                        {resource.searchParam?.map((param, idx) => (
                          <Chip
                            key={idx}
                            label={`${param.name} (${param.type})`}
                            size="small"
                            variant="outlined"
                            sx={{ mr: 1, mb: 1 }}
                          />
                        ))}
                      </Grid>
                    </Grid>
                  </AccordionDetails>
                </Accordion>
              ))}

              <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                Advanced Features
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle1" gutterBottom>
                        Search Modifiers
                      </Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap">
                        <Chip label=":exact" size="small" />
                        <Chip label=":contains" size="small" />
                        <Chip label=":missing" size="small" />
                        <Chip label=":above" size="small" />
                        <Chip label=":below" size="small" />
                        <Chip label=":text" size="small" />
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle1" gutterBottom>
                        Special Parameters
                      </Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap">
                        <Chip label="_include" size="small" />
                        <Chip label="_revinclude" size="small" />
                        <Chip label="_count" size="small" />
                        <Chip label="_offset" size="small" />
                        <Chip label="_sort" size="small" />
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          ) : (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          )}
        </Paper>
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            FHIR R4 API Documentation
          </Typography>
          
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">Overview</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography paragraph>
                This EMR system implements a comprehensive FHIR R4 API that supports healthcare data 
                interoperability. The API follows the HL7 FHIR R4 specification and includes advanced 
                features for searching, filtering, and bulk data operations.
              </Typography>
              <Typography paragraph>
                Base URL: <code>{window.location.origin}/fhir/R4</code>
              </Typography>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">Authentication</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography paragraph>
                The FHIR API uses the same authentication as the main application. Include your 
                session token in the Authorization header:
              </Typography>
              <SyntaxHighlighter language="bash" style={docco}>
                {`Authorization: Bearer <your-token>`}
              </SyntaxHighlighter>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">Search Parameters</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="subtitle1" gutterBottom>Common Parameters</Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Parameter</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Description</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell><code>_id</code></TableCell>
                      <TableCell>token</TableCell>
                      <TableCell>Resource ID</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><code>_lastUpdated</code></TableCell>
                      <TableCell>date</TableCell>
                      <TableCell>Last update timestamp</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><code>_count</code></TableCell>
                      <TableCell>number</TableCell>
                      <TableCell>Number of results per page (max 1000)</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><code>_offset</code></TableCell>
                      <TableCell>number</TableCell>
                      <TableCell>Skip N results for pagination</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><code>_include</code></TableCell>
                      <TableCell>string</TableCell>
                      <TableCell>Include referenced resources</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><code>_revinclude</code></TableCell>
                      <TableCell>string</TableCell>
                      <TableCell>Include resources that reference this</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>

              <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>Search Modifiers</Typography>
              <Typography paragraph>
                Modifiers change how search parameters are interpreted:
              </Typography>
              <ul>
                <li><code>:exact</code> - Exact string match (case-sensitive)</li>
                <li><code>:contains</code> - String contains value</li>
                <li><code>:missing</code> - Parameter is missing (true) or present (false)</li>
                <li><code>:above</code> - Value is above the given number</li>
                <li><code>:below</code> - Value is below the given number</li>
                <li><code>:text</code> - Search in the text/display fields</li>
              </ul>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">Advanced Features</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="subtitle1" gutterBottom>Chained Queries</Typography>
              <Typography paragraph>
                Search through references using dot notation:
              </Typography>
              <SyntaxHighlighter language="bash" style={docco}>
{`# Find observations for patients with last name Smith
GET /fhir/R4/Observation?subject.family=Smith

# Find encounters for male patients
GET /fhir/R4/Encounter?subject.gender=male`}
              </SyntaxHighlighter>

              <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>_revinclude Parameter</Typography>
              <Typography paragraph>
                Include resources that reference the searched resource:
              </Typography>
              <SyntaxHighlighter language="bash" style={docco}>
{`# Get patient with all their observations
GET /fhir/R4/Patient?_id=123&_revinclude=Observation:patient

# Get patient with all references
GET /fhir/R4/Patient?_id=123&_revinclude=Observation:patient&_revinclude=Encounter:patient`}
              </SyntaxHighlighter>

              <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>Batch and Transaction</Typography>
              <Typography paragraph>
                Execute multiple operations in a single request:
              </Typography>
              <SyntaxHighlighter language="json" style={docco}>
{`POST /fhir/R4
{
  "resourceType": "Bundle",
  "type": "batch", // or "transaction"
  "entry": [
    {
      "resource": { /* Patient resource */ },
      "request": { "method": "POST", "url": "Patient" }
    },
    {
      "request": { "method": "GET", "url": "Patient/123" }
    }
  ]
}`}
              </SyntaxHighlighter>

              <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>Bulk Export</Typography>
              <Typography paragraph>
                Export large datasets asynchronously:
              </Typography>
              <SyntaxHighlighter language="bash" style={docco}>
{`# System-wide export
GET /fhir/R4/$export

# Patient compartment export
GET /fhir/R4/Patient/$export

# Check export status
GET /fhir/R4/$export-status/{job-id}`}
              </SyntaxHighlighter>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">Error Handling</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography paragraph>
                Errors are returned as OperationOutcome resources:
              </Typography>
              <SyntaxHighlighter language="json" style={docco}>
{`{
  "resourceType": "OperationOutcome",
  "issue": [{
    "severity": "error",
    "code": "not-found",
    "diagnostics": "Resource Patient/999 not found"
  }]
}`}
              </SyntaxHighlighter>
            </AccordionDetails>
          </Accordion>
        </Paper>
      </TabPanel>

      <TabPanel value={tabValue} index={3}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Example Queries
          </Typography>
          
          {Object.entries(EXAMPLE_QUERIES).map(([category, examples]) => (
            <Accordion key={category} defaultExpanded={category === selectedResource}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">{category}</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  {examples.map((example, index) => (
                    <Grid item xs={12} md={6} key={index}>
                      <Card 
                        variant="outlined" 
                        sx={{ 
                          cursor: 'pointer',
                          '&:hover': { boxShadow: 2 }
                        }}
                        onClick={() => handleExampleQuery(example.url)}
                      >
                        <CardContent>
                          <Typography variant="subtitle2" color="primary">
                            {example.label}
                          </Typography>
                          <Typography variant="caption" component="div" sx={{ mt: 1 }}>
                            <code>{example.url}</code>
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </AccordionDetails>
            </Accordion>
          ))}
        </Paper>
      </TabPanel>
    </Box>
  );
}

export default FHIRExplorer;