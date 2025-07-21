/**
 * Enhanced Query Playground Component for FHIR Explorer v4
 * 
 * Advanced query testing environment with live execution
 * Includes syntax highlighting, auto-complete, and performance insights
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Alert,
  Button,
  Grid,
  Card,
  CardContent,
  TextField,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Autocomplete,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  CircularProgress,
  Badge
} from '@mui/material';
import {
  Code as CodeIcon,
  PlayArrow as PlayIcon,
  Save as SaveIcon,
  Share as ShareIcon,
  History as HistoryIcon,
  Speed as SpeedIcon,
  ContentCopy as CopyIcon,
  Clear as ClearIcon,
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Download as DownloadIcon,
  Lightbulb as LightbulbIcon,
  Timer as TimerIcon
} from '@mui/icons-material';
import { alpha } from '@mui/material/styles';

// FHIR query templates
const QUERY_TEMPLATES = {
  basic: {
    label: 'Basic Queries',
    queries: [
      { name: 'All Patients', query: '/Patient' },
      { name: 'Patient by ID', query: '/Patient/[id]' },
      { name: 'Recent Observations', query: '/Observation?_sort=-date&_count=10' },
      { name: 'Active Conditions', query: '/Condition?clinical-status=active' },
      { name: 'Current Medications', query: '/MedicationRequest?status=active' }
    ]
  },
  advanced: {
    label: 'Advanced Queries',
    queries: [
      { name: 'Patient with Includes', query: '/Patient?_include=Patient:general-practitioner' },
      { name: 'Observations by Code', query: '/Observation?code=http://loinc.org|1234-5' },
      { name: 'Chained Search', query: '/Observation?patient.name=Smith' },
      { name: 'Reverse Include', query: '/Patient?_revinclude=Observation:patient' },
      { name: 'Has Parameter', query: '/Patient?_has:Observation:patient:code=1234-5' }
    ]
  },
  operations: {
    label: 'FHIR Operations',
    queries: [
      { name: 'Patient Everything', query: '/Patient/[id]/$everything' },
      { name: 'Validate Resource', query: '/[ResourceType]/$validate' },
      { name: 'Capability Statement', query: '/metadata' }
    ]
  }
};

// FHIR resource types for autocomplete
const RESOURCE_TYPES = [
  'Patient', 'Observation', 'Condition', 'MedicationRequest', 'Encounter',
  'DiagnosticReport', 'Procedure', 'Immunization', 'AllergyIntolerance',
  'CarePlan', 'CareTeam', 'Goal', 'ServiceRequest', 'Practitioner',
  'Organization', 'Location', 'Device', 'Specimen', 'DocumentReference'
];

// Search parameters by resource type
const SEARCH_PARAMETERS = {
  Patient: ['_id', '_lastUpdated', 'identifier', 'name', 'family', 'given', 'birthdate', 'gender', 'address', 'telecom'],
  Observation: ['_id', '_lastUpdated', 'status', 'category', 'code', 'subject', 'patient', 'encounter', 'date', 'value-quantity'],
  Condition: ['_id', '_lastUpdated', 'clinical-status', 'verification-status', 'category', 'severity', 'code', 'subject', 'patient'],
  MedicationRequest: ['_id', '_lastUpdated', 'status', 'intent', 'priority', 'medication', 'subject', 'patient', 'encounter', 'authored-on']
};

function QueryPlayground({ onNavigate, useFHIRData, useQueryHistory }) {
  const fhirData = useFHIRData?.() || null;
  const queryHistory = useQueryHistory?.() || null;

  // State
  const [query, setQuery] = useState('/Patient?_count=10');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [executing, setExecuting] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [executionTime, setExecutionTime] = useState(null);
  const [selectedResourceType, setSelectedResourceType] = useState('Patient');
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Parse query to extract resource type and parameters
  const parsedQuery = useMemo(() => {
    try {
      const match = query.match(/^\/([A-Z][a-zA-Z]+)(\?.*)?$/);
      if (match) {
        const resourceType = match[1];
        const params = match[2] ? new URLSearchParams(match[2].substring(1)) : new URLSearchParams();
        return { resourceType, params, valid: true };
      }
      return { valid: false };
    } catch (err) {
      return { valid: false };
    }
  }, [query]);

  // Execute query
  const executeQuery = useCallback(async () => {
    if (!fhirData || !fhirData.searchResources) {
      setError('FHIR data service not available');
      return;
    }

    setExecuting(true);
    setError(null);
    setResults(null);
    
    const startTime = performance.now();

    try {
      let result;
      
      // Parse the query URL to determine the type of operation
      const match = query.match(/^\/([A-Z][a-zA-Z]+)(\/[^?$]+)?(\$[^?]+)?(\?.*)?$/);
      if (!match) {
        throw new Error('Invalid query format. Expected format: /ResourceType or /ResourceType?param=value');
      }
      
      const resourceType = match[1];
      const resourceId = match[2]?.substring(1); // Remove leading slash
      const operation = match[3];
      const queryString = match[4];
      
      // Handle different query types
      if (operation === '/$everything' && resourceId) {
        // Patient/$everything operation
        if (fhirData.fetchPatientEverything && resourceType === 'Patient') {
          result = await fhirData.fetchPatientEverything(resourceId);
          // Convert to expected format
          result = {
            data: result.bundle || { 
              resourceType: 'Bundle', 
              entry: result.resources?.map(r => ({ resource: r })) || [],
              total: result.total || 0
            }
          };
        } else {
          throw new Error(`$everything operation is only supported for Patient resources`);
        }
      } else if (operation === '/$validate') {
        throw new Error('$validate operation is not yet implemented');
      } else if (operation || query === '/metadata') {
        throw new Error(`Operation ${operation || 'metadata'} is not yet implemented`);
      } else if (resourceId && !operation && !queryString) {
        // Single resource fetch: /Patient/123
        if (fhirData.fetchResource) {
          const resource = await fhirData.fetchResource(resourceType, resourceId);
          result = {
            data: {
              resourceType: 'Bundle',
              type: 'searchset',
              total: 1,
              entry: [{ resource }]
            }
          };
        } else {
          throw new Error('Single resource fetch not available');
        }
      } else {
        // Search query: /Patient?name=Smith
        const params = queryString ? Object.fromEntries(new URLSearchParams(queryString.substring(1))) : {};
        const searchResult = await fhirData.searchResources(resourceType, params);
        
        // Ensure standardized format
        if (searchResult.bundle) {
          result = { data: searchResult.bundle };
        } else if (searchResult.resources) {
          result = {
            data: {
              resourceType: 'Bundle',
              type: 'searchset',
              total: searchResult.total || searchResult.resources.length,
              entry: searchResult.resources.map(r => ({ resource: r }))
            }
          };
        } else {
          // Fallback for unexpected formats
          result = { data: searchResult };
        }
      }
      
      const endTime = performance.now();
      setExecutionTime(Math.round(endTime - startTime));
      
      setResults(result);
      
      // Add to query history
      if (queryHistory && queryHistory.addToHistory) {
        queryHistory.addToHistory({
          query,
          resultCount: result.data?.entry?.length || 0,
          totalCount: result.data?.total || 0,
          executionTime: Math.round(endTime - startTime),
          resourceType: parsedQuery.resourceType
        });
      }
    } catch (err) {
      setError(err.message || 'Query execution failed');
    } finally {
      setExecuting(false);
    }
  }, [query, fhirData, queryHistory, parsedQuery]);

  // Apply template
  const applyTemplate = useCallback((template) => {
    setQuery(template.query);
    setSelectedTemplate(template.name);
  }, []);

  // Get query suggestions
  const getQuerySuggestions = useMemo(() => {
    if (!parsedQuery.valid || !parsedQuery.resourceType) return [];

    const suggestions = [];
    const params = SEARCH_PARAMETERS[parsedQuery.resourceType] || [];
    
    params.forEach(param => {
      if (!parsedQuery.params.has(param)) {
        suggestions.push({
          label: `Add ${param} parameter`,
          value: `${query}${query.includes('?') ? '&' : '?'}${param}=`
        });
      }
    });

    // Common modifiers
    if (!parsedQuery.params.has('_count')) {
      suggestions.push({
        label: 'Limit results (_count)',
        value: `${query}${query.includes('?') ? '&' : '?'}_count=10`
      });
    }
    
    if (!parsedQuery.params.has('_sort')) {
      suggestions.push({
        label: 'Sort results (_sort)',
        value: `${query}${query.includes('?') ? '&' : '?'}_sort=-_lastUpdated`
      });
    }

    return suggestions;
  }, [query, parsedQuery]);

  // Export results
  const exportResults = useCallback(() => {
    if (!results) return;

    const data = JSON.stringify(results.data, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fhir-query-results-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [results]);

  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>
        Query Playground
      </Typography>

      <Grid container spacing={3}>
        {/* Query Editor Section */}
        <Grid item xs={12} lg={8}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ flex: 1 }}>
                Query Editor
              </Typography>
              <Chip
                icon={parsedQuery.valid ? <CheckCircleIcon /> : <ErrorIcon />}
                label={parsedQuery.valid ? 'Valid Query' : 'Invalid Query'}
                color={parsedQuery.valid ? 'success' : 'error'}
                size="small"
              />
            </Box>

            {/* Query Input */}
            <TextField
              fullWidth
              multiline
              rows={3}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter FHIR query (e.g., /Patient?name=Smith)"
              sx={{
                mb: 2,
                '& .MuiInputBase-input': {
                  fontFamily: 'monospace',
                  fontSize: '14px'
                }
              }}
            />

            {/* Query Actions */}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                startIcon={executing ? <CircularProgress size={20} /> : <PlayIcon />}
                onClick={executeQuery}
                disabled={!parsedQuery.valid || executing}
              >
                {executing ? 'Executing...' : 'Execute Query'}
              </Button>
              
              <Button
                variant="outlined"
                startIcon={<ClearIcon />}
                onClick={() => {
                  setQuery('');
                  setResults(null);
                  setError(null);
                }}
              >
                Clear
              </Button>

              <Button
                variant="outlined"
                startIcon={<SaveIcon />}
                disabled={!parsedQuery.valid}
                onClick={() => {
                  if (queryHistory && queryHistory.saveQuery) {
                    queryHistory.saveQuery({
                      query,
                      name: `Query - ${new Date().toLocaleString()}`,
                      resourceType: parsedQuery.resourceType
                    });
                  }
                }}
              >
                Save
              </Button>

              <Button
                variant="outlined"
                startIcon={<CopyIcon />}
                onClick={() => navigator.clipboard.writeText(query)}
              >
                Copy
              </Button>
            </Box>

            {/* Query Suggestions */}
            {showSuggestions && getQuerySuggestions.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  <LightbulbIcon sx={{ fontSize: 16, mr: 1, verticalAlign: 'middle' }} />
                  Suggestions
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {getQuerySuggestions.slice(0, 3).map((suggestion, index) => (
                    <Chip
                      key={index}
                      label={suggestion.label}
                      size="small"
                      onClick={() => setQuery(suggestion.value)}
                      clickable
                    />
                  ))}
                </Box>
              </Box>
            )}
          </Paper>

          {/* Results Section */}
          {(results || error) && (
            <Paper sx={{ p: 3 }}>
              {error ? (
                <Alert severity="error" sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>Query Error</Typography>
                  {error}
                </Alert>
              ) : results && (
                <>
                  {/* Results Header */}
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6" sx={{ flex: 1 }}>
                      Results
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                      {executionTime && (
                        <Chip
                          icon={<TimerIcon />}
                          label={`${executionTime}ms`}
                          size="small"
                          color="primary"
                        />
                      )}
                      <Chip
                        label={`${results.data?.entry?.length || 0} returned`}
                        size="small"
                        color="secondary"
                      />
                      {results.data?.total && results.data.total !== (results.data?.entry?.length || 0) && (
                        <Chip
                          label={`${results.data.total} total`}
                          size="small"
                          color="info"
                        />
                      )}
                      <IconButton size="small" onClick={exportResults}>
                        <DownloadIcon />
                      </IconButton>
                    </Box>
                  </Box>

                  {/* Results Display */}
                  <Box
                    sx={{
                      maxHeight: 400,
                      overflow: 'auto',
                      bgcolor: 'background.surface',
                      borderRadius: 1,
                      p: 2
                    }}
                  >
                    <pre style={{ margin: 0, fontSize: '12px' }}>
                      {JSON.stringify(results.data, null, 2)}
                    </pre>
                  </Box>

                  {/* Performance Insights */}
                  {executionTime > 1000 && (
                    <Alert severity="warning" sx={{ mt: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Performance Tip
                      </Typography>
                      This query took over 1 second. Consider:
                      <ul style={{ margin: '8px 0' }}>
                        <li>Adding _count parameter to limit results</li>
                        <li>Using more specific search criteria</li>
                        <li>Adding indexes for frequently searched fields</li>
                      </ul>
                    </Alert>
                  )}
                </>
              )}
            </Paper>
          )}
        </Grid>

        {/* Templates and History Section */}
        <Grid item xs={12} lg={4}>
          {/* Query Templates */}
          <Paper sx={{ p: 2, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Query Templates
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            {Object.entries(QUERY_TEMPLATES).map(([key, category]) => (
              <Accordion key={key} defaultExpanded={key === 'basic'}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle2">{category.label}</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <List dense>
                    {category.queries.map((template, index) => (
                      <ListItem
                        key={index}
                        button
                        onClick={() => applyTemplate(template)}
                        selected={selectedTemplate === template.name}
                      >
                        <ListItemText
                          primary={template.name}
                          secondary={template.query}
                          secondaryTypographyProps={{
                            style: { fontFamily: 'monospace', fontSize: '11px' }
                          }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </AccordionDetails>
              </Accordion>
            ))}
          </Paper>

          {/* Query History */}
          {queryHistory && queryHistory.queryHistory && (
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Recent Queries
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              {queryHistory.queryHistory.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No query history yet
                </Typography>
              ) : (
                <List dense>
                  {queryHistory.queryHistory.slice(0, 5).map((item, index) => (
                    <ListItem
                      key={index}
                      button
                      onClick={() => setQuery(item.query)}
                    >
                      <ListItemText
                        primary={item.query}
                        secondary={`${item.resultCount} returned${item.totalCount && item.totalCount !== item.resultCount ? ` (${item.totalCount} total)` : ''} • ${item.executionTime}ms`}
                        primaryTypographyProps={{
                          style: { fontFamily: 'monospace', fontSize: '12px' }
                        }}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Paper>
          )}
        </Grid>
      </Grid>
    </Box>
  );
}

export default QueryPlayground;