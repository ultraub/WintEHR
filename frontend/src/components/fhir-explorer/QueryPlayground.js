/**
 * FHIR Explorer - Interactive Query Playground
 * 
 * A sandbox environment for experimenting with FHIR queries
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Tabs,
  Tab,
  Grid,
  Card,
  CardContent,
  Alert,
  Chip,
  IconButton,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Divider
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Refresh as RefreshIcon,
  Save as SaveIcon,
  Share as ShareIcon,
  ContentCopy as CopyIcon,
  History as HistoryIcon,
  Speed as SpeedIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  Timeline as TimelineIcon,
  TableChart as TableIcon,
  Code as CodeIcon,
  Visibility as VisibilityIcon
} from '@mui/icons-material';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import json from 'react-syntax-highlighter/dist/esm/languages/hljs/json';
import { docco, github } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import api from '../../services/api';

SyntaxHighlighter.registerLanguage('json', json);

// Sample Queries for Quick Start
const SAMPLE_QUERIES = {
  beginner: [
    {
      name: 'Find All Patients',
      query: '/fhir/R4/Patient?_count=10',
      description: 'Retrieve first 10 patients',
      tags: ['basic', 'patient']
    },
    {
      name: 'Patient by Name',
      query: '/fhir/R4/Patient?name=Smith',
      description: 'Search patients with name containing "Smith"',
      tags: ['basic', 'search']
    },
    {
      name: 'Patient Demographics',
      query: '/fhir/R4/Patient?gender=female&_count=5',
      description: 'Find female patients',
      tags: ['basic', 'filter']
    }
  ],
  intermediate: [
    {
      name: 'Patient Vital Signs',
      query: '/fhir/R4/Observation?category=vital-signs&_count=20&_sort=-date',
      description: 'Recent vital signs, sorted by date',
      tags: ['clinical', 'vital-signs']
    },
    {
      name: 'Lab Results with Values',
      query: '/fhir/R4/Observation?category=laboratory&value-quantity=gt100',
      description: 'Lab results with values greater than 100',
      tags: ['clinical', 'laboratory']
    },
    {
      name: 'Active Medications',
      query: '/fhir/R4/MedicationRequest?status=active&_include=MedicationRequest:medication',
      description: 'Active prescriptions with medication details',
      tags: ['clinical', 'medications', 'include']
    }
  ],
  advanced: [
    {
      name: 'Complex Patient Query',
      query: '/fhir/R4/Patient?_has:Observation:patient:code=29463-7&_has:Condition:patient:code=E11.9',
      description: 'Patients with specific observation and condition',
      tags: ['advanced', 'has', 'chaining']
    },
    {
      name: 'Encounter with Observations',
      query: '/fhir/R4/Encounter?_include=Encounter:patient&_revinclude=Observation:encounter',
      description: 'Encounters with patient data and related observations',
      tags: ['advanced', 'include', 'revinclude']
    }
  ]
};

// Query Performance Analyzer
const QueryPerformanceAnalyzer = ({ query, executionTime, resultCount }) => {
  const analyzePerformance = () => {
    const analysis = {
      speed: 'good',
      efficiency: 'good',
      recommendations: []
    };

    // Analyze execution time
    if (executionTime > 2000) {
      analysis.speed = 'slow';
      analysis.recommendations.push('Consider adding more specific filters to reduce result set');
    } else if (executionTime > 1000) {
      analysis.speed = 'moderate';
      analysis.recommendations.push('Query performance could be improved with better indexing');
    }

    // Analyze result count
    if (resultCount > 1000) {
      analysis.efficiency = 'poor';
      analysis.recommendations.push('Large result set - consider using _count parameter to limit results');
    } else if (resultCount > 100) {
      analysis.efficiency = 'moderate';
      analysis.recommendations.push('Consider pagination for better user experience');
    }

    // Analyze query structure
    if (!query.includes('_count')) {
      analysis.recommendations.push('Add _count parameter to limit results');
    }

    if (query.includes('?') && !query.includes('&')) {
      analysis.recommendations.push('Single parameter query - consider adding more filters for specificity');
    }

    return analysis;
  };

  const analysis = analyzePerformance();

  const getSpeedColor = (speed) => {
    switch (speed) {
      case 'good': return 'success';
      case 'moderate': return 'warning';
      case 'slow': return 'error';
      default: return 'info';
    }
  };

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          <SpeedIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Performance Analysis
        </Typography>
        
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={4}>
            <Chip 
              label={`Speed: ${analysis.speed}`}
              color={getSpeedColor(analysis.speed)}
              icon={<SpeedIcon />}
            />
          </Grid>
          <Grid item xs={4}>
            <Chip 
              label={`${executionTime}ms`}
              variant="outlined"
            />
          </Grid>
          <Grid item xs={4}>
            <Chip 
              label={`${resultCount} results`}
              variant="outlined"
            />
          </Grid>
        </Grid>

        {analysis.recommendations.length > 0 && (
          <Alert severity="info">
            <Typography variant="subtitle2" gutterBottom>
              Optimization Suggestions:
            </Typography>
            <List dense>
              {analysis.recommendations.map((rec, index) => (
                <ListItem key={index}>
                  <ListItemIcon>
                    <InfoIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary={rec} />
                </ListItem>
              ))}
            </List>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

// Result Visualizer Component
const ResultVisualizer = ({ results, viewMode, onViewModeChange }) => {
  if (!results) return null;

  const renderTableView = () => {
    if (!results.entry || results.entry.length === 0) {
      return <Typography>No results to display</Typography>;
    }

    const sampleResource = results.entry[0].resource;
    const columns = Object.keys(sampleResource).slice(0, 6); // Limit columns for readability

    return (
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              {columns.map((col) => (
                <TableCell key={col}>
                  <Typography variant="subtitle2">{col}</Typography>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {results.entry.slice(0, 10).map((entry, index) => (
              <TableRow key={index}>
                {columns.map((col) => (
                  <TableCell key={col}>
                    <Typography variant="body2">
                      {typeof entry.resource[col] === 'object' 
                        ? JSON.stringify(entry.resource[col]).substring(0, 50) + '...'
                        : String(entry.resource[col] || '-')
                      }
                    </Typography>
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  const renderSummaryView = () => {
    if (!results.entry) {
      return <Typography>No data to summarize</Typography>;
    }

    const resourceTypes = {};
    results.entry.forEach(entry => {
      const type = entry.resource.resourceType;
      resourceTypes[type] = (resourceTypes[type] || 0) + 1;
    });

    return (
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Resource Distribution
              </Typography>
              {Object.entries(resourceTypes).map(([type, count]) => (
                <Box key={type} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography>{type}</Typography>
                  <Chip label={count} size="small" />
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Query Statistics
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemText 
                    primary="Total Results" 
                    secondary={results.total || 0} 
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="Returned" 
                    secondary={results.entry?.length || 0} 
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="Bundle Type" 
                    secondary={results.type || 'searchset'} 
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  };

  const renderJSONView = () => (
    <SyntaxHighlighter 
      language="json" 
      style={github}
      customStyle={{ 
        maxHeight: '500px', 
        overflow: 'auto',
        fontSize: '0.875rem'
      }}
    >
      {JSON.stringify(results, null, 2)}
    </SyntaxHighlighter>
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          Results ({results.total || 0} found)
        </Typography>
        
        <Tabs value={viewMode} onChange={(e, value) => onViewModeChange(value)}>
          <Tab label="Summary" value="summary" icon={<TimelineIcon />} iconPosition="start" />
          <Tab label="Table" value="table" icon={<TableIcon />} iconPosition="start" />
          <Tab label="JSON" value="json" icon={<CodeIcon />} iconPosition="start" />
        </Tabs>
      </Box>

      <Box>
        {viewMode === 'summary' && renderSummaryView()}
        {viewMode === 'table' && renderTableView()}
        {viewMode === 'json' && renderJSONView()}
      </Box>
    </Box>
  );
};

// Main Query Playground Component
export const QueryPlayground = () => {
  const [query, setQuery] = useState('/fhir/R4/Patient?_count=10');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [executionTime, setExecutionTime] = useState(0);
  const [queryHistory, setQueryHistory] = useState([]);
  const [selectedSample, setSelectedSample] = useState('');
  const [viewMode, setViewMode] = useState('summary');
  const [activeTab, setActiveTab] = useState(0);

  const executeQuery = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    const startTime = Date.now();

    try {
      // Ensure query starts with proper path
      let normalizedQuery = query;
      if (!normalizedQuery.startsWith('/fhir/R4/')) {
        normalizedQuery = '/fhir/R4/' + normalizedQuery.replace(/^\/+/, '');
      }
      
      const response = await api.get(normalizedQuery);
      const endTime = Date.now();
      
      setResults(response.data);
      setExecutionTime(endTime - startTime);
      
      // Add to history
      const historyEntry = {
        query: normalizedQuery,
        timestamp: new Date(),
        resultCount: response.data.total || 0,
        executionTime: endTime - startTime
      };
      setQueryHistory(prev => [historyEntry, ...prev.slice(0, 9)]); // Keep last 10
      
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Query execution failed');
    } finally {
      setLoading(false);
    }
  };

  const loadSampleQuery = (sampleQuery) => {
    setQuery(sampleQuery.query);
    setSelectedSample(sampleQuery.name);
  };

  const copyQuery = () => {
    navigator.clipboard.writeText(query);
  };

  const saveQuery = () => {
    // Implementation for saving queries
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        FHIR Query Playground 🧪
      </Typography>
      
      <Grid container spacing={3}>
        {/* Left Panel - Query Builder */}
        <Grid item xs={12} lg={5}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Query Builder
            </Typography>
            
            {/* Sample Queries */}
            <Accordion sx={{ mb: 2 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography>Sample Queries</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Tabs 
                  value={activeTab} 
                  onChange={(e, value) => setActiveTab(value)}
                  sx={{ mb: 2 }}
                >
                  <Tab label="Beginner" />
                  <Tab label="Intermediate" />
                  <Tab label="Advanced" />
                </Tabs>
                
                {Object.entries(SAMPLE_QUERIES).map(([level, queries], levelIndex) => (
                  <Box key={level} hidden={activeTab !== levelIndex}>
                    {queries.map((sample, index) => (
                      <Card 
                        key={index} 
                        sx={{ 
                          mb: 1, 
                          cursor: 'pointer',
                          '&:hover': { bgcolor: 'action.hover' }
                        }}
                        onClick={() => loadSampleQuery(sample)}
                      >
                        <CardContent sx={{ py: 1 }}>
                          <Typography variant="subtitle2">{sample.name}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {sample.description}
                          </Typography>
                          <Box sx={{ mt: 1 }}>
                            {sample.tags.map(tag => (
                              <Chip 
                                key={tag} 
                                label={tag} 
                                size="small" 
                                sx={{ mr: 0.5 }}
                              />
                            ))}
                          </Box>
                        </CardContent>
                      </Card>
                    ))}
                  </Box>
                ))}
              </AccordionDetails>
            </Accordion>

            {/* Query Input */}
            <TextField
              label="FHIR Query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              fullWidth
              multiline
              rows={3}
              placeholder="/fhir/R4/Patient?name=Smith&_count=10"
              sx={{ mb: 2 }}
              helperText="Enter a FHIR query URL (starting with /fhir/R4/...)"
            />

            {/* Actions */}
            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
              <Button
                variant="contained"
                onClick={executeQuery}
                disabled={loading || !query.trim()}
                startIcon={loading ? <CircularProgress size={20} /> : <PlayIcon />}
              >
                {loading ? 'Executing...' : 'Execute'}
              </Button>
              
              <Tooltip title="Copy query">
                <IconButton onClick={copyQuery}>
                  <CopyIcon />
                </IconButton>
              </Tooltip>
              
              <Tooltip title="Save query">
                <IconButton onClick={saveQuery}>
                  <SaveIcon />
                </IconButton>
              </Tooltip>
            </Stack>

            {/* Error Display */}
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                <Typography variant="subtitle2">Query Error:</Typography>
                <Typography variant="body2">{error}</Typography>
              </Alert>
            )}

            {/* Performance Analysis */}
            {results && !loading && (
              <QueryPerformanceAnalyzer
                query={query}
                executionTime={executionTime}
                resultCount={results.total || 0}
              />
            )}

            {/* Query History */}
            {queryHistory.length > 0 && (
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography>
                    <HistoryIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Query History ({queryHistory.length})
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <List dense>
                    {queryHistory.map((item, index) => (
                      <ListItem 
                        key={index}
                        button
                        onClick={() => setQuery(item.query)}
                      >
                        <ListItemText
                          primary={item.query.substring(0, 50) + '...'}
                          secondary={`${item.resultCount} results • ${item.executionTime}ms • ${item.timestamp.toLocaleTimeString()}`}
                        />
                      </ListItem>
                    ))}
                  </List>
                </AccordionDetails>
              </Accordion>
            )}
          </Paper>
        </Grid>

        {/* Right Panel - Results */}
        <Grid item xs={12} lg={7}>
          <Paper sx={{ p: 3 }}>
            {loading && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            )}

            {!loading && !results && (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <VisibilityIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary">
                  Execute a query to see results
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Use the sample queries or write your own FHIR query
                </Typography>
              </Box>
            )}

            {!loading && results && (
              <ResultVisualizer
                results={results}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
              />
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default QueryPlayground;