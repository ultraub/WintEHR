/**
 * Visual Query Builder Component for FHIR Explorer v4
 * 
 * Intuitive drag-and-drop interface for building FHIR queries
 * Transforms complex query construction into visual components
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Button,
  Chip,
  Card,
  CardContent,
  CardHeader,
  Divider,
  IconButton,
  Tooltip,
  TextField,
  Autocomplete,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Switch,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  PlayArrow as RunIcon,
  Code as CodeIcon,
  Save as SaveIcon,
  Clear as ClearIcon,
  DragIndicator as DragIcon,
  ExpandMore as ExpandMoreIcon,
  FilterList as FilterIcon,
  Link as LinkIcon,
  Lightbulb as LightbulbIcon,
  ContentCopy as CopyIcon,
  Build as BuildIcon
} from '@mui/icons-material';

// FHIR Resource definitions with search parameters
const FHIR_RESOURCES = {
  Patient: {
    name: 'Patient',
    description: 'Individual receiving healthcare',
    searchParams: ['identifier', 'name', 'family', 'given', 'birthdate', 'gender', 'address', 'phone', 'email'],
    includes: ['Patient:general-practitioner', 'Patient:organization'],
    revIncludes: ['Observation:patient', 'Condition:patient', 'MedicationRequest:patient', 'Encounter:patient']
  },
  Observation: {
    name: 'Observation',
    description: 'Clinical observations and measurements',
    searchParams: ['patient', 'code', 'date', 'category', 'value-quantity', 'component-code', 'status'],
    includes: ['Observation:patient', 'Observation:performer', 'Observation:encounter'],
    revIncludes: []
  },
  Condition: {
    name: 'Condition',
    description: 'Patient conditions and diagnoses',
    searchParams: ['patient', 'code', 'category', 'clinical-status', 'verification-status', 'onset-date', 'recorded-date'],
    includes: ['Condition:patient', 'Condition:asserter', 'Condition:encounter'],
    revIncludes: ['Observation:focus', 'CarePlan:condition']
  },
  MedicationRequest: {
    name: 'MedicationRequest',
    description: 'Medication prescriptions and orders',
    searchParams: ['patient', 'medication', 'status', 'intent', 'authoredon', 'category', 'priority'],
    includes: ['MedicationRequest:patient', 'MedicationRequest:medication', 'MedicationRequest:requester'],
    revIncludes: ['MedicationDispense:prescription']
  },
  Encounter: {
    name: 'Encounter',
    description: 'Healthcare encounters and visits',
    searchParams: ['patient', 'class', 'type', 'status', 'date', 'participant', 'location'],
    includes: ['Encounter:patient', 'Encounter:participant', 'Encounter:location'],
    revIncludes: ['Observation:encounter', 'Condition:encounter', 'Procedure:encounter']
  }
};

// Search parameter operators
const SEARCH_OPERATORS = {
  string: ['', ':exact', ':contains'],
  date: ['', 'eq', 'ne', 'gt', 'ge', 'lt', 'le', 'sa', 'eb', 'ap'],
  number: ['', 'eq', 'ne', 'gt', 'ge', 'lt', 'le'],
  token: ['', ':not', ':text', ':in', ':not-in'],
  reference: ['', ':identifier', ':type']
};

function VisualQueryBuilder({ onNavigate, onExecuteQuery, useFHIRData, useQueryHistory }) {
  const [query, setQuery] = useState({
    resourceType: '',
    searchParams: [],
    includes: [],
    revIncludes: [],
    count: 20,
    sort: '',
    summary: false
  });
  
  const [generatedUrl, setGeneratedUrl] = useState('');
  const [showQueryDialog, setShowQueryDialog] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [results, setResults] = useState(null);
  
  // Initialize hooks at the top level
  const fhirDataHook = useFHIRData || (() => ({ searchResources: () => Promise.resolve([]) }));
  const queryHistoryHook = useQueryHistory || (() => ({ saveQuery: () => {} }));
  
  const { searchResources } = fhirDataHook();
  const { saveQuery } = queryHistoryHook();

  // Generate FHIR query URL from visual components
  const generateQueryUrl = useCallback(() => {
    if (!query.resourceType) return '';

    const params = new URLSearchParams();
    
    // Add search parameters
    query.searchParams.forEach(param => {
      if (param.value) {
        const key = param.operator ? `${param.name}${param.operator}` : param.name;
        params.append(key, param.value);
      }
    });

    // Add includes
    query.includes.forEach(include => {
      params.append('_include', include);
    });

    // Add reverse includes
    query.revIncludes.forEach(revInclude => {
      params.append('_revinclude', revInclude);
    });

    // Add other parameters
    if (query.count !== 20) params.append('_count', query.count);
    if (query.sort) params.append('_sort', query.sort);
    if (query.summary) params.append('_summary', 'true');

    const queryString = params.toString();
    return `/${query.resourceType}${queryString ? `?${queryString}` : ''}`;
  }, [query]);

  // Update generated URL when query changes
  useEffect(() => {
    setGeneratedUrl(generateQueryUrl());
  }, [generateQueryUrl]);

  // Add search parameter
  const addSearchParam = () => {
    const availableParams = FHIR_RESOURCES[query.resourceType]?.searchParams || [];
    if (availableParams.length === 0) return;

    setQuery(prev => ({
      ...prev,
      searchParams: [...prev.searchParams, {
        id: Date.now(),
        name: availableParams[0],
        operator: '',
        value: ''
      }]
    }));
  };

  // Remove search parameter
  const removeSearchParam = (id) => {
    setQuery(prev => ({
      ...prev,
      searchParams: prev.searchParams.filter(param => param.id !== id)
    }));
  };

  // Update search parameter
  const updateSearchParam = (id, field, value) => {
    setQuery(prev => ({
      ...prev,
      searchParams: prev.searchParams.map(param =>
        param.id === id ? { ...param, [field]: value } : param
      )
    }));
  };

  // Execute the built query
  const executeQuery = async () => {
    if (!query.resourceType || !generatedUrl) return;

    setIsExecuting(true);
    try {
      const response = await searchResources(query.resourceType, query.searchParams.reduce((acc, param) => {
        if (param.value) {
          const key = param.operator ? `${param.name}${param.operator}` : param.name;
          acc[key] = param.value;
        }
        return acc;
      }, {}));
      
      setResults(response);
      
      // Save successful query to history
      saveQuery({
        name: `${query.resourceType} Query`,
        url: generatedUrl,
        resourceType: query.resourceType,
        timestamp: new Date(),
        resultCount: response.length
      });

      if (onExecuteQuery) {
        onExecuteQuery(response, generatedUrl);
      }
    } catch (error) {
      console.error('Query execution failed:', error);
      setResults({ error: error.message });
    } finally {
      setIsExecuting(false);
    }
  };

  // Clear query
  const clearQuery = () => {
    setQuery({
      resourceType: '',
      searchParams: [],
      includes: [],
      revIncludes: [],
      count: 20,
      sort: '',
      summary: false
    });
    setResults(null);
  };

  // Copy query URL to clipboard
  const copyQueryUrl = async () => {
    try {
      await navigator.clipboard.writeText(generatedUrl);
    } catch (error) {
      console.error('Failed to copy URL:', error);
    }
  };

  // Generate parameter suggestions based on resource type
  const generateSuggestions = (resourceType) => {
    const resource = FHIR_RESOURCES[resourceType];
    if (!resource) return [];

    const suggestions = [
      {
        type: 'Common Pattern',
        title: 'Find active patients',
        params: [{ name: 'active', value: 'true' }]
      },
      {
        type: 'Common Pattern',
        title: 'Recent observations',
        params: [{ name: 'date', operator: 'ge', value: '2024-01-01' }]
      },
      {
        type: 'Performance',
        title: 'Limit results for faster queries',
        params: [{ name: '_count', value: '10' }]
      }
    ];

    return suggestions.filter(s => 
      s.params.every(p => resource.searchParams.includes(p.name) || p.name.startsWith('_'))
    );
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <BuildIcon color="primary" />
          Visual Query Builder
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<ClearIcon />}
            onClick={clearQuery}
            disabled={!query.resourceType}
          >
            Clear
          </Button>
          <Button
            variant="outlined"
            startIcon={<CodeIcon />}
            onClick={() => setShowQueryDialog(true)}
            disabled={!generatedUrl}
          >
            View Query
          </Button>
          <Button
            variant="contained"
            startIcon={<RunIcon />}
            onClick={executeQuery}
            disabled={!query.resourceType || isExecuting}
          >
            {isExecuting ? 'Running...' : 'Execute Query'}
          </Button>
        </Stack>
      </Box>

      <Grid container spacing={3}>
        {/* Query Builder Panel */}
        <Grid item xs={12} lg={8}>
          <Paper sx={{ p: 3 }}>
            {/* Resource Type Selection */}
            <Card sx={{ mb: 3 }}>
              <CardHeader title="1. Select Resource Type" />
              <CardContent>
                <FormControl fullWidth>
                  <InputLabel>FHIR Resource Type</InputLabel>
                  <Select
                    value={query.resourceType}
                    label="FHIR Resource Type"
                    onChange={(e) => {
                      const resourceType = e.target.value;
                      setQuery(prev => ({
                        ...prev,
                        resourceType,
                        searchParams: [],
                        includes: [],
                        revIncludes: []
                      }));
                      setSuggestions(generateSuggestions(resourceType));
                    }}
                  >
                    {Object.values(FHIR_RESOURCES).map(resource => (
                      <MenuItem key={resource.name} value={resource.name}>
                        <Box>
                          <Typography variant="body1">{resource.name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {resource.description}
                          </Typography>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </CardContent>
            </Card>

            {/* Search Parameters */}
            {query.resourceType && (
              <Card sx={{ mb: 3 }}>
                <CardHeader 
                  title="2. Add Search Parameters"
                  action={
                    <Button
                      startIcon={<AddIcon />}
                      onClick={addSearchParam}
                      disabled={!FHIR_RESOURCES[query.resourceType]?.searchParams.length}
                    >
                      Add Parameter
                    </Button>
                  }
                />
                <CardContent>
                  {query.searchParams.length === 0 ? (
                    <Alert severity="info">
                      Add search parameters to filter results. Click "Add Parameter" to get started.
                    </Alert>
                  ) : (
                    <Stack spacing={2}>
                      {query.searchParams.map(param => (
                        <Paper key={param.id} sx={{ p: 2, bgcolor: 'grey.50' }}>
                          <Grid container spacing={2} alignItems="center">
                            <Grid item xs={12} sm={3}>
                              <FormControl fullWidth size="small">
                                <InputLabel>Parameter</InputLabel>
                                <Select
                                  value={param.name}
                                  label="Parameter"
                                  onChange={(e) => updateSearchParam(param.id, 'name', e.target.value)}
                                >
                                  {FHIR_RESOURCES[query.resourceType]?.searchParams.map(p => (
                                    <MenuItem key={p} value={p}>{p}</MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                            </Grid>
                            <Grid item xs={12} sm={2}>
                              <FormControl fullWidth size="small">
                                <InputLabel>Operator</InputLabel>
                                <Select
                                  value={param.operator}
                                  label="Operator"
                                  onChange={(e) => updateSearchParam(param.id, 'operator', e.target.value)}
                                >
                                  {(SEARCH_OPERATORS.string || []).map(op => (
                                    <MenuItem key={op} value={op}>
                                      {op || 'default'}
                                    </MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                              <TextField
                                fullWidth
                                size="small"
                                label="Value"
                                value={param.value}
                                onChange={(e) => updateSearchParam(param.id, 'value', e.target.value)}
                                placeholder="Enter search value..."
                              />
                            </Grid>
                            <Grid item xs={12} sm={1}>
                              <IconButton
                                color="error"
                                onClick={() => removeSearchParam(param.id)}
                                size="small"
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Grid>
                          </Grid>
                        </Paper>
                      ))}
                    </Stack>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Advanced Options */}
            {query.resourceType && (
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="h6">3. Advanced Options (Optional)</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={3}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        type="number"
                        label="Result Count"
                        value={query.count}
                        onChange={(e) => setQuery(prev => ({ ...prev, count: parseInt(e.target.value) || 20 }))}
                        inputProps={{ min: 1, max: 1000 }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={query.summary}
                            onChange={(e) => setQuery(prev => ({ ...prev, summary: e.target.checked }))}
                          />
                        }
                        label="Summary Only"
                      />
                    </Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>
            )}
          </Paper>
        </Grid>

        {/* Suggestions and Preview Panel */}
        <Grid item xs={12} lg={4}>
          {/* Query Preview */}
          {generatedUrl && (
            <Card sx={{ mb: 3 }}>
              <CardHeader title="Query Preview" />
              <CardContent>
                <Paper sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
                  <Typography variant="body2" fontFamily="monospace" sx={{ wordBreak: 'break-all' }}>
                    {generatedUrl}
                  </Typography>
                </Paper>
                <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                  <Button
                    size="small"
                    startIcon={<CopyIcon />}
                    onClick={copyQueryUrl}
                  >
                    Copy URL
                  </Button>
                </Box>
              </CardContent>
            </Card>
          )}

          {/* Smart Suggestions */}
          {suggestions.length > 0 && (
            <Card sx={{ mb: 3 }}>
              <CardHeader 
                title="Smart Suggestions" 
                avatar={<LightbulbIcon color="warning" />}
              />
              <CardContent>
                <Stack spacing={2}>
                  {suggestions.map((suggestion, index) => (
                    <Paper key={index} sx={{ p: 2, bgcolor: 'primary.50' }}>
                      <Typography variant="subtitle2" color="primary">
                        {suggestion.type}
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        {suggestion.title}
                      </Typography>
                      <Button
                        size="small"
                        onClick={() => {
                          suggestion.params.forEach(param => {
                            const newParam = {
                              id: Date.now() + Math.random(),
                              name: param.name,
                              operator: param.operator || '',
                              value: param.value
                            };
                            setQuery(prev => ({
                              ...prev,
                              searchParams: [...prev.searchParams, newParam]
                            }));
                          });
                        }}
                      >
                        Apply
                      </Button>
                    </Paper>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          )}

          {/* Results Summary */}
          {results && (
            <Card>
              <CardHeader title="Results" />
              <CardContent>
                {results.error ? (
                  <Alert severity="error">
                    Query failed: {results.error}
                  </Alert>
                ) : (
                  <Alert severity="success">
                    Found {results.length} resources
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>

      {/* Query Details Dialog */}
      <Dialog open={showQueryDialog} onClose={() => setShowQueryDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Generated FHIR Query</DialogTitle>
        <DialogContent>
          <Paper sx={{ p: 2, bgcolor: 'grey.100', fontFamily: 'monospace', mb: 2 }}>
            <Typography variant="body2">{generatedUrl}</Typography>
          </Paper>
          <Typography variant="body2" color="text.secondary">
            This query can be executed against any FHIR R4 compliant server. 
            The URL follows standard FHIR search conventions and includes all the parameters 
            you've configured visually.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowQueryDialog(false)}>Close</Button>
          <Button onClick={copyQueryUrl} variant="contained">Copy URL</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default VisualQueryBuilder;