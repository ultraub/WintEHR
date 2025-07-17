/**
 * AI Query Assistant Component for FHIR Explorer v4
 * 
 * Intelligent assistant for FHIR query optimization and guidance
 * Provides real-time suggestions, error detection, and performance tips
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Button,
  Card,
  CardContent,
  CardHeader,
  Stack,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  IconButton
} from '@mui/material';
import {
  Psychology as PsychologyIcon,
  AutoAwesome as AutoAwesomeIcon,
  TipsAndUpdates as TipsIcon,
  Speed as SpeedIcon,
  Security as SecurityIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Lightbulb as LightbulbIcon,
  ExpandMore as ExpandMoreIcon,
  Code as CodeIcon,
  Refresh as RefreshIcon,
  BookmarkBorder as BookmarkIcon
} from '@mui/icons-material';

// AI Analysis Rules for FHIR Queries
const QUERY_ANALYSIS_RULES = {
  performance: [
    {
      id: 'missing_count',
      test: (query) => !query.includes('_count='),
      severity: 'warning',
      message: 'Consider adding _count parameter to limit results',
      suggestion: 'Add ?_count=50 to improve query performance',
      impact: 'medium'
    },
    {
      id: 'too_many_results', 
      test: (query) => {
        const countMatch = query.match(/_count=(\d+)/);
        return countMatch && parseInt(countMatch[1]) > 500;
      },
      severity: 'error',
      message: 'Result count too high - may cause performance issues',
      suggestion: 'Reduce _count to 500 or less for better performance',
      impact: 'high'
    },
    {
      id: 'missing_date_filter',
      test: (query) => query.includes('Observation') && !query.includes('date='),
      severity: 'info',
      message: 'Consider adding date filter for Observation queries',
      suggestion: 'Add date parameter like date=ge2024-01-01 to narrow results',
      impact: 'medium'
    }
  ],
  security: [
    {
      id: 'unfiltered_patient_search',
      test: (query) => query.startsWith('/Patient?') && !query.includes('identifier=') && !query.includes('name='),
      severity: 'warning',
      message: 'Unfiltered patient search may return sensitive data',
      suggestion: 'Add specific search criteria like identifier or name',
      impact: 'medium'
    }
  ],
  syntax: [
    {
      id: 'invalid_parameter',
      test: (query) => /[?&](\w+)=(&|$)/.test(query),
      severity: 'error',
      message: 'Empty parameter values detected',
      suggestion: 'Remove parameters with empty values or provide valid values',
      impact: 'high'
    },
    {
      id: 'encoding_issues',
      test: (query) => /[^a-zA-Z0-9?&=:.-_/]/.test(query) && !/%[0-9A-F]{2}/.test(query),
      severity: 'warning',
      message: 'Special characters should be URL encoded',
      suggestion: 'Use encodeURIComponent() for parameter values with spaces or special characters',
      impact: 'medium'
    }
  ],
  optimization: [
    {
      id: 'inefficient_text_search',
      test: (query) => query.includes(':contains'),
      severity: 'info',
      message: 'Text search with :contains can be slow',
      suggestion: 'Use exact matches or :text modifier when possible',
      impact: 'low'
    },
    {
      id: 'missing_includes',
      test: (query) => query.includes('Patient') && !query.includes('_include'),
      severity: 'info',
      message: 'Consider including related resources',
      suggestion: 'Add _include parameters to fetch related data in one request',
      impact: 'low'
    }
  ]
};

// Smart suggestions based on query patterns
const SMART_SUGGESTIONS = {
  'Patient': [
    { text: 'Add age filter', code: 'birthdate=ge1950-01-01' },
    { text: 'Include general practitioner', code: '_include=Patient:general-practitioner' },
    { text: 'Limit to active patients', code: 'active=true' }
  ],
  'Observation': [
    { text: 'Filter by category', code: 'category=laboratory' },
    { text: 'Recent results only', code: 'date=ge2024-01-01' },
    { text: 'Include patient details', code: '_include=Observation:patient' }
  ],
  'Condition': [
    { text: 'Active conditions only', code: 'clinical-status=active' },
    { text: 'Include patient data', code: '_include=Condition:patient' },
    { text: 'Filter by verification', code: 'verification-status=confirmed' }
  ],
  'MedicationRequest': [
    { text: 'Active prescriptions', code: 'status=active' },
    { text: 'Include medication details', code: '_include=MedicationRequest:medication' },
    { text: 'Recent prescriptions', code: 'authoredon=ge2024-01-01' }
  ]
};

// Query optimization templates
const OPTIMIZATION_TEMPLATES = [
  {
    name: 'Efficient Patient Search',
    description: 'Optimized patient search with common includes',
    template: '/Patient?active=true&_count=50&_include=Patient:general-practitioner',
    benefits: ['Faster response', 'Includes related data', 'Reasonable result size']
  },
  {
    name: 'Recent Lab Results',
    description: 'Laboratory observations with date filtering',
    template: '/Observation?category=laboratory&date=ge2024-01-01&_count=100&_include=Observation:patient',
    benefits: ['Focused on recent data', 'Includes patient context', 'Performance optimized']
  },
  {
    name: 'Active Conditions',
    description: 'Current patient conditions with verification',
    template: '/Condition?clinical-status=active&verification-status=confirmed&_include=Condition:patient',
    benefits: ['Only active conditions', 'Verified diagnoses', 'Patient details included']
  }
];

function AIQueryAssistant({ currentQuery, onSuggestion, onOptimize }) {
  const [analysisResults, setAnalysisResults] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [showOptimizationDialog, setShowOptimizationDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  // Analyze current query for issues and optimizations
  const analyzeQuery = useCallback((query) => {
    if (!query) return null;

    const results = {
      performance: [],
      security: [],
      syntax: [],
      optimization: []
    };

    // Run all analysis rules
    Object.entries(QUERY_ANALYSIS_RULES).forEach(([category, rules]) => {
      rules.forEach(rule => {
        if (rule.test(query)) {
          results[category].push(rule);
        }
      });
    });

    // Calculate overall score
    const totalIssues = Object.values(results).flat().length;
    const highIssues = Object.values(results).flat().filter(r => r.impact === 'high').length;
    const score = Math.max(0, 100 - (highIssues * 30) - (totalIssues * 5));

    return { ...results, score, totalIssues };
  }, []);

  // Generate smart suggestions based on query
  const generateSuggestions = useCallback((query) => {
    if (!query) return [];

    const resourceType = query.match(/\/(\w+)\?/)?.[1];
    if (!resourceType || !SMART_SUGGESTIONS[resourceType]) return [];

    return SMART_SUGGESTIONS[resourceType].filter(suggestion => 
      !query.includes(suggestion.code.split('=')[0])
    );
  }, []);

  // Update analysis when query changes
  useEffect(() => {
    if (currentQuery) {
      const analysis = analyzeQuery(currentQuery);
      setAnalysisResults(analysis);
      setSuggestions(generateSuggestions(currentQuery));
    }
  }, [currentQuery, analyzeQuery, generateSuggestions]);

  // Apply suggestion to query
  const applySuggestion = (suggestion) => {
    if (onSuggestion) {
      const separator = currentQuery.includes('?') ? '&' : '?';
      const optimizedQuery = `${currentQuery}${separator}${suggestion.code}`;
      onSuggestion(optimizedQuery);
    }
  };

  // Apply optimization template
  const applyTemplate = (template) => {
    if (onOptimize) {
      onOptimize(template.template);
    }
    setShowOptimizationDialog(false);
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <PsychologyIcon color="primary" />
          AI Query Assistant
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => {
              if (currentQuery) {
                setAnalysisResults(analyzeQuery(currentQuery));
                setSuggestions(generateSuggestions(currentQuery));
              }
            }}
            disabled={!currentQuery}
          >
            Re-analyze
          </Button>
          <Button
            variant="outlined"
            startIcon={<AutoAwesomeIcon />}
            onClick={() => setShowOptimizationDialog(true)}
          >
            Templates
          </Button>
        </Stack>
      </Box>

      {!currentQuery ? (
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Start building a query to get AI assistance
          </Typography>
          The AI assistant will analyze your FHIR queries and provide:
          <ul>
            <li>Performance optimization suggestions</li>
            <li>Security and best practice recommendations</li>
            <li>Syntax error detection and fixes</li>
            <li>Smart parameter suggestions</li>
          </ul>
        </Alert>
      ) : (
        <Grid container spacing={3}>
          {/* Query Analysis */}
          <Grid item xs={12} lg={8}>
            {analysisResults && (
              <Card sx={{ mb: 3 }}>
                <CardHeader 
                  title="Query Analysis"
                  action={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Typography variant="h6" color={analysisResults.score > 80 ? 'success.main' : analysisResults.score > 60 ? 'warning.main' : 'error.main'}>
                        Score: {analysisResults.score}/100
                      </Typography>
                      <LinearProgress 
                        variant="determinate" 
                        value={analysisResults.score} 
                        sx={{ width: 100, height: 8, borderRadius: 4 }}
                        color={analysisResults.score > 80 ? 'success' : analysisResults.score > 60 ? 'warning' : 'error'}
                      />
                    </Box>
                  }
                />
                <CardContent>
                  {analysisResults.totalIssues === 0 ? (
                    <Alert severity="success" icon={<CheckCircleIcon />}>
                      Excellent! Your query follows FHIR best practices.
                    </Alert>
                  ) : (
                    <Stack spacing={2}>
                      {/* Performance Issues */}
                      {analysisResults.performance.length > 0 && (
                        <Accordion>
                          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <SpeedIcon color="warning" />
                              <Typography>Performance ({analysisResults.performance.length} issues)</Typography>
                            </Box>
                          </AccordionSummary>
                          <AccordionDetails>
                            <List>
                              {analysisResults.performance.map((issue, index) => (
                                <ListItem key={index}>
                                  <ListItemIcon>
                                    <WarningIcon color={issue.severity === 'error' ? 'error' : 'warning'} />
                                  </ListItemIcon>
                                  <ListItemText
                                    primary={issue.message}
                                    secondary={issue.suggestion}
                                  />
                                </ListItem>
                              ))}
                            </List>
                          </AccordionDetails>
                        </Accordion>
                      )}

                      {/* Security Issues */}
                      {analysisResults.security.length > 0 && (
                        <Accordion>
                          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <SecurityIcon color="error" />
                              <Typography>Security ({analysisResults.security.length} issues)</Typography>
                            </Box>
                          </AccordionSummary>
                          <AccordionDetails>
                            <List>
                              {analysisResults.security.map((issue, index) => (
                                <ListItem key={index}>
                                  <ListItemIcon>
                                    <ErrorIcon color="error" />
                                  </ListItemIcon>
                                  <ListItemText
                                    primary={issue.message}
                                    secondary={issue.suggestion}
                                  />
                                </ListItem>
                              ))}
                            </List>
                          </AccordionDetails>
                        </Accordion>
                      )}

                      {/* Syntax Issues */}
                      {analysisResults.syntax.length > 0 && (
                        <Accordion>
                          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <CodeIcon color="error" />
                              <Typography>Syntax ({analysisResults.syntax.length} issues)</Typography>
                            </Box>
                          </AccordionSummary>
                          <AccordionDetails>
                            <List>
                              {analysisResults.syntax.map((issue, index) => (
                                <ListItem key={index}>
                                  <ListItemIcon>
                                    <ErrorIcon color="error" />
                                  </ListItemIcon>
                                  <ListItemText
                                    primary={issue.message}
                                    secondary={issue.suggestion}
                                  />
                                </ListItem>
                              ))}
                            </List>
                          </AccordionDetails>
                        </Accordion>
                      )}

                      {/* Optimization Suggestions */}
                      {analysisResults.optimization.length > 0 && (
                        <Accordion>
                          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <TipsIcon color="info" />
                              <Typography>Optimizations ({analysisResults.optimization.length} suggestions)</Typography>
                            </Box>
                          </AccordionSummary>
                          <AccordionDetails>
                            <List>
                              {analysisResults.optimization.map((issue, index) => (
                                <ListItem key={index}>
                                  <ListItemIcon>
                                    <InfoIcon color="info" />
                                  </ListItemIcon>
                                  <ListItemText
                                    primary={issue.message}
                                    secondary={issue.suggestion}
                                  />
                                </ListItem>
                              ))}
                            </List>
                          </AccordionDetails>
                        </Accordion>
                      )}
                    </Stack>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Current Query Display */}
            <Card>
              <CardHeader title="Current Query" />
              <CardContent>
                <Paper sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
                  <Typography variant="body2" fontFamily="monospace" sx={{ wordBreak: 'break-all' }}>
                    {currentQuery}
                  </Typography>
                </Paper>
              </CardContent>
            </Card>
          </Grid>

          {/* Suggestions Panel */}
          <Grid item xs={12} lg={4}>
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
                        <Typography variant="subtitle2" gutterBottom>
                          {suggestion.text}
                        </Typography>
                        <Typography variant="body2" fontFamily="monospace" sx={{ mb: 1, fontSize: '0.75rem' }}>
                          {suggestion.code}
                        </Typography>
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => applySuggestion(suggestion)}
                        >
                          Apply
                        </Button>
                      </Paper>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            )}

            {/* Best Practices */}
            <Card>
              <CardHeader title="FHIR Best Practices" />
              <CardContent>
                <List dense>
                  <ListItem>
                    <ListItemIcon><CheckCircleIcon color="success" fontSize="small" /></ListItemIcon>
                    <ListItemText 
                      primary="Use _count parameter"
                      secondary="Limit results for better performance"
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon><CheckCircleIcon color="success" fontSize="small" /></ListItemIcon>
                    <ListItemText 
                      primary="Filter by date ranges"
                      secondary="Especially for observations and encounters"
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon><CheckCircleIcon color="success" fontSize="small" /></ListItemIcon>
                    <ListItemText 
                      primary="Use _include parameters"
                      secondary="Fetch related resources efficiently"
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon><CheckCircleIcon color="success" fontSize="small" /></ListItemIcon>
                    <ListItemText 
                      primary="Encode special characters"
                      secondary="Ensure proper URL encoding"
                    />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Optimization Templates Dialog */}
      <Dialog open={showOptimizationDialog} onClose={() => setShowOptimizationDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Query Optimization Templates</DialogTitle>
        <DialogContent>
          <Stack spacing={3}>
            {OPTIMIZATION_TEMPLATES.map((template, index) => (
              <Card key={index} variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>{template.name}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {template.description}
                  </Typography>
                  <Paper sx={{ p: 2, bgcolor: 'grey.50', mb: 2 }}>
                    <Typography variant="body2" fontFamily="monospace">
                      {template.template}
                    </Typography>
                  </Paper>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                    {template.benefits.map((benefit, i) => (
                      <Chip key={i} label={benefit} size="small" color="success" variant="outlined" />
                    ))}
                  </Box>
                  <Button
                    variant="contained"
                    onClick={() => applyTemplate(template)}
                  >
                    Use Template
                  </Button>
                </CardContent>
              </Card>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowOptimizationDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default AIQueryAssistant;