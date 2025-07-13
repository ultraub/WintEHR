/**
 * Prefetch Query Builder Component
 * Visual interface for building FHIR queries to prefetch data for CDS hooks
 */
import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Grid,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip,
  Card,
  CardContent,
  CardActions,
  Divider,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  Code as CodeIcon,
  ContentCopy as CopyIcon,
  PlayArrow as TestIcon,
  Search as SearchIcon,
  FilterList as FilterIcon
} from '@mui/icons-material';
import { fhirClient } from '../../../../services/fhirClient';

const COMMON_RESOURCES = [
  'Patient',
  'Condition',
  'MedicationRequest',
  'MedicationStatement',
  'Observation',
  'AllergyIntolerance',
  'Procedure',
  'Immunization',
  'DiagnosticReport',
  'ServiceRequest',
  'Encounter',
  'CarePlan'
];

const COMMON_QUERIES = [
  {
    name: 'Active Conditions',
    resource: 'Condition',
    params: { 'clinical-status': 'active' },
    description: 'All active conditions for the patient'
  },
  {
    name: 'Current Medications',
    resource: 'MedicationRequest',
    params: { status: 'active' },
    description: 'Active medication requests'
  },
  {
    name: 'Recent Vitals',
    resource: 'Observation',
    params: { 
      category: 'vital-signs',
      _sort: '-date',
      _count: '10'
    },
    description: 'Last 10 vital sign observations'
  },
  {
    name: 'Lab Results',
    resource: 'Observation',
    params: { 
      category: 'laboratory',
      _sort: '-date',
      _count: '20'
    },
    description: 'Recent laboratory results'
  },
  {
    name: 'Allergies',
    resource: 'AllergyIntolerance',
    params: { 'clinical-status': 'active' },
    description: 'Active allergies and intolerances'
  }
];

const SEARCH_MODIFIERS = [
  { value: '', label: 'Equals (default)' },
  { value: ':exact', label: 'Exact match' },
  { value: ':contains', label: 'Contains' },
  { value: ':above', label: 'Above (hierarchical)' },
  { value: ':below', label: 'Below (hierarchical)' },
  { value: ':not', label: 'Not equals' },
  { value: ':missing', label: 'Missing (true/false)' }
];

const PrefetchQueryBuilder = ({ queries = {}, onChange }) => {
  const [expandedQuery, setExpandedQuery] = useState(null);
  const [testResults, setTestResults] = useState({});
  const [testing, setTesting] = useState({});

  const addQuery = () => {
    const queryKey = `query${Object.keys(queries).length + 1}`;
    const newQuery = {
      key: queryKey,
      resource: 'Observation',
      params: {},
      description: ''
    };
    onChange({ ...queries, [queryKey]: newQuery });
    setExpandedQuery(queryKey);
  };

  const updateQuery = (key, updates) => {
    onChange({
      ...queries,
      [key]: { ...queries[key], ...updates }
    });
  };

  const removeQuery = (key) => {
    const updated = { ...queries };
    delete updated[key];
    onChange(updated);
  };

  const addParameter = (queryKey) => {
    const query = queries[queryKey];
    if (!query) return;

    const newParam = {
      name: '',
      value: '',
      modifier: ''
    };

    const currentParams = query.params || {};
    const paramKey = `param${Date.now()}`;
    
    updateQuery(queryKey, {
      params: { ...currentParams, [paramKey]: newParam }
    });
  };

  const updateParameter = (queryKey, paramKey, updates) => {
    const query = queries[queryKey];
    if (!query) return;

    const updatedParams = {
      ...query.params,
      [paramKey]: { ...query.params[paramKey], ...updates }
    };

    updateQuery(queryKey, { params: updatedParams });
  };

  const removeParameter = (queryKey, paramKey) => {
    const query = queries[queryKey];
    if (!query) return;

    const updatedParams = { ...query.params };
    delete updatedParams[paramKey];
    
    updateQuery(queryKey, { params: updatedParams });
  };

  const applyTemplate = (template) => {
    const queryKey = `${template.resource.toLowerCase()}Query`;
    const newQuery = {
      key: queryKey,
      resource: template.resource,
      params: template.params,
      description: template.description
    };
    onChange({ ...queries, [queryKey]: newQuery });
    setExpandedQuery(queryKey);
  };

  const buildFhirQuery = (query) => {
    const params = [];
    
    // Add patient parameter automatically
    params.push('patient={{context.patientId}}');
    
    // Add other parameters
    Object.entries(query.params || {}).forEach(([key, param]) => {
      if (typeof param === 'string') {
        params.push(`${key}=${encodeURIComponent(param)}`);
      } else if (param.name && param.value) {
        const paramName = param.name + (param.modifier || '');
        params.push(`${paramName}=${encodeURIComponent(param.value)}`);
      }
    });
    
    return `${query.resource}?${params.join('&')}`;
  };

  const testQuery = async (queryKey) => {
    const query = queries[queryKey];
    if (!query) return;

    setTesting({ ...testing, [queryKey]: true });
    
    try {
      // Build search parameters
      const searchParams = { _count: 5 }; // Limit test results
      
      Object.entries(query.params || {}).forEach(([key, param]) => {
        if (typeof param === 'string') {
          searchParams[key] = param;
        } else if (param.name && param.value) {
          const paramName = param.name + (param.modifier || '');
          searchParams[paramName] = param.value;
        }
      });

      const result = await fhirClient.search(query.resource, searchParams);
      
      setTestResults({
        ...testResults,
        [queryKey]: {
          success: true,
          count: result.total || (result.entry ? result.entry.length : 0),
          sample: result.entry ? result.entry[0] : null
        }
      });
    } catch (error) {
      setTestResults({
        ...testResults,
        [queryKey]: {
          success: false,
          error: error.message
        }
      });
    } finally {
      setTesting({ ...testing, [queryKey]: false });
    }
  };

  return (
    <Paper elevation={1} sx={{ p: 3 }}>
      <Stack spacing={3}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Prefetch Query Builder</Typography>
          <Button 
            startIcon={<AddIcon />} 
            onClick={addQuery}
            variant="outlined"
          >
            Add Query
          </Button>
        </Stack>

        <Alert severity="info">
          Prefetch queries allow the CDS service to receive relevant patient data without making additional requests.
        </Alert>

        {/* Quick Templates */}
        <Box>
          <Typography variant="subtitle2" gutterBottom>Quick Templates</Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {COMMON_QUERIES.map((template, index) => (
              <Chip
                key={index}
                label={template.name}
                onClick={() => applyTemplate(template)}
                clickable
                color="primary"
                variant="outlined"
                size="small"
              />
            ))}
          </Stack>
        </Box>

        <Divider />

        {/* Query List */}
        {Object.keys(queries).length === 0 ? (
          <Alert severity="warning">
            No prefetch queries defined. Add queries to provide data to your CDS hook.
          </Alert>
        ) : (
          Object.entries(queries).map(([key, query]) => (
            <Accordion 
              key={key}
              expanded={expandedQuery === key}
              onChange={() => setExpandedQuery(expandedQuery === key ? null : key)}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Stack direction="row" spacing={2} alignItems="center" sx={{ width: '100%' }}>
                  <SearchIcon color="primary" />
                  <Typography sx={{ flexGrow: 1 }}>
                    {query.description || `${query.resource} Query`}
                  </Typography>
                  <Chip 
                    label={query.resource} 
                    size="small" 
                    color="primary"
                  />
                  {testResults[key] && (
                    <Chip 
                      label={testResults[key].success ? 
                        `${testResults[key].count} results` : 
                        'Error'
                      } 
                      size="small" 
                      color={testResults[key].success ? 'success' : 'error'}
                    />
                  )}
                </Stack>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={2}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <FormControl fullWidth>
                        <InputLabel>Resource Type</InputLabel>
                        <Select
                          value={query.resource}
                          label="Resource Type"
                          onChange={(e) => updateQuery(key, { resource: e.target.value })}
                        >
                          {COMMON_RESOURCES.map(resource => (
                            <MenuItem key={resource} value={resource}>
                              {resource}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Query Description"
                        value={query.description || ''}
                        onChange={(e) => updateQuery(key, { description: e.target.value })}
                        placeholder="e.g., Recent lab results"
                      />
                    </Grid>
                  </Grid>

                  {/* Parameters */}
                  <Box>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                      <Typography variant="subtitle2">Search Parameters</Typography>
                      <Button 
                        size="small" 
                        startIcon={<AddIcon />}
                        onClick={() => addParameter(key)}
                      >
                        Add Parameter
                      </Button>
                    </Stack>

                    {Object.entries(query.params || {}).map(([paramKey, param]) => (
                      <Card key={paramKey} variant="outlined" sx={{ mb: 1 }}>
                        <CardContent>
                          <Grid container spacing={2} alignItems="center">
                            <Grid item xs={12} md={4}>
                              <TextField
                                fullWidth
                                size="small"
                                label="Parameter Name"
                                value={param.name || (typeof param === 'string' ? paramKey : '')}
                                onChange={(e) => updateParameter(key, paramKey, { name: e.target.value })}
                                placeholder="e.g., category, status"
                              />
                            </Grid>
                            <Grid item xs={12} md={3}>
                              <FormControl fullWidth size="small">
                                <InputLabel>Modifier</InputLabel>
                                <Select
                                  value={param.modifier || ''}
                                  label="Modifier"
                                  onChange={(e) => updateParameter(key, paramKey, { modifier: e.target.value })}
                                >
                                  {SEARCH_MODIFIERS.map(mod => (
                                    <MenuItem key={mod.value} value={mod.value}>
                                      {mod.label}
                                    </MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                            </Grid>
                            <Grid item xs={12} md={4}>
                              <TextField
                                fullWidth
                                size="small"
                                label="Value"
                                value={param.value || (typeof param === 'string' ? param : '')}
                                onChange={(e) => updateParameter(key, paramKey, { value: e.target.value })}
                                placeholder="e.g., vital-signs, active"
                              />
                            </Grid>
                            <Grid item xs={12} md={1}>
                              <IconButton 
                                size="small"
                                color="error"
                                onClick={() => removeParameter(key, paramKey)}
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Grid>
                          </Grid>
                        </CardContent>
                      </Card>
                    ))}
                  </Box>

                  {/* Query Preview */}
                  <Card variant="outlined">
                    <CardContent>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="subtitle2">Query Preview</Typography>
                        <Tooltip title="Copy Query">
                          <IconButton 
                            size="small"
                            onClick={() => navigator.clipboard.writeText(buildFhirQuery(query))}
                          >
                            <CopyIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          fontFamily: 'monospace',
                          bgcolor: 'grey.100',
                          p: 1,
                          borderRadius: 1,
                          mt: 1
                        }}
                      >
                        {buildFhirQuery(query)}
                      </Typography>
                    </CardContent>
                    <CardActions>
                      <Button
                        size="small"
                        startIcon={<TestIcon />}
                        onClick={() => testQuery(key)}
                        disabled={testing[key]}
                      >
                        Test Query
                      </Button>
                      <Button
                        size="small"
                        color="error"
                        startIcon={<DeleteIcon />}
                        onClick={() => removeQuery(key)}
                      >
                        Remove Query
                      </Button>
                    </CardActions>
                  </Card>

                  {/* Test Results */}
                  {testResults[key] && (
                    <Alert severity={testResults[key].success ? 'success' : 'error'}>
                      {testResults[key].success ? (
                        <>Query returned {testResults[key].count} results</>
                      ) : (
                        <>Query failed: {testResults[key].error}</>
                      )}
                    </Alert>
                  )}
                </Stack>
              </AccordionDetails>
            </Accordion>
          ))
        )}
      </Stack>
    </Paper>
  );
};

export default PrefetchQueryBuilder;