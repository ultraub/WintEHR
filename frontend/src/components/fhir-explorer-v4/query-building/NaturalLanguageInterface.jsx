/**
 * Natural Language Interface Component for FHIR Explorer v4
 * 
 * Converts natural language requests into FHIR queries
 * Makes FHIR accessible to healthcare professionals
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Button,
  TextField,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Stack,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  IconButton,
  Tooltip,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  Chat as ChatIcon,
  Send as SendIcon,
  Lightbulb as LightbulbIcon,
  Code as CodeIcon,
  PlayArrow as RunIcon,
  Clear as ClearIcon,
  History as HistoryIcon,
  Mic as MicIcon,
  ExpandMore as ExpandMoreIcon,
  ContentCopy as CopyIcon,
  Psychology as PsychologyIcon,
  AutoAwesome as AutoAwesomeIcon,
  QuestionAnswer as QuestionIcon,
  LocalHospital as MedicalIcon,
  Science as LabIcon,
  Medication as MedicationIcon
} from '@mui/icons-material';

// Import enhanced natural language processor
import { processNaturalLanguage, getMedicalTerms } from './utils/naturalLanguageProcessor';

// Natural language patterns and their FHIR query translations
const QUERY_PATTERNS = [
  {
    pattern: /find (all )?patients?( who are)?( aged| age)? (\d+)(-(\d+))?( years old)?/i,
    template: (match) => ({
      resourceType: 'Patient',
      query: match[6] ? 
        `/Patient?birthdate=ge${new Date().getFullYear() - parseInt(match[6])}&birthdate=le${new Date().getFullYear() - parseInt(match[4])}` :
        `/Patient?birthdate=le${new Date().getFullYear() - parseInt(match[4])}`,
      description: `Patients aged ${match[4]}${match[6] ? `-${match[6]}` : '+'} years`,
      confidence: 0.9
    })
  },
  {
    pattern: /find (all )?patients? with (.+?)( condition| diagnosis)?$/i,
    template: (match) => ({
      resourceType: 'Condition',
      query: `/Condition?code:text=${encodeURIComponent(match[2])}`,
      description: `Patients with ${match[2]} condition`,
      confidence: 0.8,
      suggestion: 'You might also want to search for related observations or medications'
    })
  },
  {
    pattern: /show (me )?(all )?lab results? for (.+)/i,
    template: (match) => ({
      resourceType: 'Observation',
      query: `/Observation?category=laboratory&patient.name=${encodeURIComponent(match[3])}`,
      description: `Laboratory results for ${match[3]}`,
      confidence: 0.85
    })
  },
  {
    pattern: /recent (.+?) observations?( in the last (\d+) (days?|weeks?|months?))?/i,
    template: (match) => {
      const timeMap = { day: 1, week: 7, month: 30 };
      const days = match[3] ? parseInt(match[3]) * (timeMap[match[4].replace('s', '')] || 1) : 30;
      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      return ({
        resourceType: 'Observation',
        query: `/Observation?code:text=${encodeURIComponent(match[1])}&date=ge${cutoffDate}`,
        description: `Recent ${match[1]} observations (last ${days} days)`,
        confidence: 0.9
      });
    }
  },
  {
    pattern: /medications? (for|prescribed to) (.+)/i,
    template: (match) => ({
      resourceType: 'MedicationRequest',
      query: `/MedicationRequest?patient.name=${encodeURIComponent(match[2])}`,
      description: `Medications for ${match[2]}`,
      confidence: 0.85
    })
  },
  {
    pattern: /encounters? (for|with) (.+?)( in (\d{4}))?/i,
    template: (match) => ({
      resourceType: 'Encounter',
      query: match[4] ? 
        `/Encounter?patient.name=${encodeURIComponent(match[2])}&date=ge${match[4]}-01-01&date=le${match[4]}-12-31` :
        `/Encounter?patient.name=${encodeURIComponent(match[2])}`,
      description: `Encounters for ${match[2]}${match[4] ? ` in ${match[4]}` : ''}`,
      confidence: 0.8
    })
  },
  {
    pattern: /patients? with (.+?) between (.+?) and (.+)/i,
    template: (match) => ({
      resourceType: 'Observation',
      query: `/Observation?code:text=${encodeURIComponent(match[1])}&value-quantity=ge${match[2]}&value-quantity=le${match[3]}`,
      description: `Patients with ${match[1]} between ${match[2]} and ${match[3]}`,
      confidence: 0.85
    })
  }
];

// Common healthcare examples with categories
const EXAMPLE_QUERIES = {
  clinical: {
    title: 'Clinical Queries',
    icon: MedicalIcon,
    examples: [
      "Show patients with diabetes",
      "Find patients with hypertension and diabetes",
      "Active conditions for John Smith",
      "Patients with uncontrolled A1C over 8"
    ]
  },
  laboratory: {
    title: 'Lab Results',
    icon: LabIcon,
    examples: [
      "Recent glucose results above 200",
      "A1C results in the last 6 months",
      "Abnormal creatinine levels",
      "Blood pressure readings today"
    ]
  },
  medications: {
    title: 'Medications',
    icon: MedicationIcon,
    examples: [
      "Active medications for Mary Johnson",
      "Patients on metformin",
      "Recent insulin prescriptions",
      "Medications prescribed yesterday"
    ]
  }
};

// Follow-up suggestions based on query type
const FOLLOW_UP_SUGGESTIONS = {
  Patient: [
    "Find their medical conditions",
    "Show their recent observations", 
    "List their medications",
    "View their encounters"
  ],
  Condition: [
    "Show related observations",
    "Find prescribed medications",
    "View care plans",
    "Check for procedures"
  ],
  Observation: [
    "Compare with reference ranges",
    "Show trending over time",
    "Find related conditions",
    "Check for alerts"
  ],
  MedicationRequest: [
    "Check for interactions",
    "View dispensing history",
    "Find related conditions",
    "Show dosage changes"
  ],
  Encounter: [
    "View encounter details",
    "Find related observations",
    "Show procedures performed",
    "Check diagnoses"
  ]
};

function NaturalLanguageInterface({ onNavigate, onExecuteQuery, useFHIRData, useQueryHistory }) {
  const [input, setInput] = useState('');
  const [conversation, setConversation] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentQuery, setCurrentQuery] = useState(null);
  const [showQueryDialog, setShowQueryDialog] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);

  // Initialize hooks at the top level
  const fhirDataHook = useFHIRData || (() => ({ searchResources: () => Promise.resolve([]) }));
  const queryHistoryHook = useQueryHistory || (() => ({ saveQuery: () => {} }));
  
  const { searchResources } = fhirDataHook();
  const { saveQuery } = queryHistoryHook();

  // Enhanced natural language processing
  const processNaturalLanguageQuery = useCallback((text) => {
    // Use the enhanced processor
    const result = processNaturalLanguage(text);
    
    // Convert to FHIR query URL
    const params = new URLSearchParams();
    result.query.parameters.forEach(param => {
      const key = param.operator ? `${param.name}:${param.operator}` : param.name;
      params.append(key, param.value);
    });
    
    result.query.includes.forEach(include => {
      params.append('_include', include);
    });
    
    if (result.query.sort) {
      params.append('_sort', result.query.sort);
    }
    
    if (result.query.count !== 20) {
      params.append('_count', result.query.count);
    }
    
    const queryUrl = `/${result.query.resourceType}?${params.toString()}`;
    
    return {
      resourceType: result.query.resourceType,
      query: queryUrl,
      description: result.interpretation,
      confidence: result.confidence,
      suggestions: result.suggestions,
      parameters: result.query.parameters
    };
  }, []);

  // Handle user input submission
  const handleSubmit = async () => {
    if (!input.trim()) return;

    setIsProcessing(true);
    const userMessage = { type: 'user', content: input, timestamp: new Date() };
    
    try {
      // Process the natural language
      const queryResult = processNaturalLanguageQuery(input);
      
      // Add user message and AI response to conversation
      const aiMessage = {
        type: 'ai',
        content: queryResult.confidence > 0.7 ? 
          `I understand you want to ${queryResult.description.toLowerCase()}. Let me convert that to a FHIR query.` :
          `I interpreted your request as: ${queryResult.description}. Let me know if this isn't quite right.`,
        query: queryResult,
        timestamp: new Date()
      };
      
      setConversation(prev => [...prev, userMessage, aiMessage]);
      setCurrentQuery(queryResult);
      
      // Set suggestions based on query result
      if (queryResult.suggestions && queryResult.suggestions.length > 0) {
        setSuggestions(queryResult.suggestions.map(s => s.text));
      } else {
        setSuggestions(FOLLOW_UP_SUGGESTIONS[queryResult.resourceType] || []);
      }
      
    } catch (error) {
      const errorMessage = {
        type: 'error',
        content: 'I had trouble understanding that request. Could you try rephrasing it?',
        timestamp: new Date()
      };
      setConversation(prev => [...prev, userMessage, errorMessage]);
    } finally {
      setIsProcessing(false);
      setInput('');
    }
  };

  // Execute the generated FHIR query
  const executeQuery = async (query) => {
    if (!query) return;

    try {
      setIsProcessing(true);
      
      // Parse the query URL to extract resource type and parameters
      const url = new URL(`http://localhost${query.query}`);
      const resourceType = url.pathname.split('/')[1];
      const params = Object.fromEntries(url.searchParams.entries());
      
      const results = await searchResources(resourceType, params);
      
      // Extract count from standardized response
      const resultCount = results.total || (results.resources ? results.resources.length : 0);
      const resources = results.resources || [];
      
      // Save successful query
      saveQuery({
        name: query.description,
        url: query.query,
        naturalLanguage: input,
        resourceType: query.resourceType,
        timestamp: new Date(),
        resultCount: resultCount
      });

      // Add results to conversation
      const resultMessage = {
        type: 'results',
        content: `Found ${resultCount} matching ${resourceType.toLowerCase()} resources.`,
        results: results,
        timestamp: new Date()
      };
      
      setConversation(prev => [...prev, resultMessage]);
      
      if (onExecuteQuery) {
        onExecuteQuery(results, query.query);
      }
      
    } catch (error) {
      const errorMessage = {
        type: 'error',
        content: `Query execution failed: ${error.message}`,
        timestamp: new Date()
      };
      setConversation(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  // Clear conversation
  const clearConversation = () => {
    setConversation([]);
    setCurrentQuery(null);
    setSuggestions([]);
  };

  // Copy query to clipboard
  const copyQuery = (query) => {
    navigator.clipboard.writeText(query);
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <PsychologyIcon color="primary" />
          Natural Language Query Interface
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<ClearIcon />}
            onClick={clearConversation}
            disabled={conversation.length === 0}
          >
            Clear Chat
          </Button>
          {currentQuery && (
            <Button
              variant="outlined"
              startIcon={<CodeIcon />}
              onClick={() => setShowQueryDialog(true)}
            >
              View Query
            </Button>
          )}
        </Stack>
      </Box>

      <Grid container spacing={3}>
        {/* Chat Interface */}
        <Grid item xs={12} lg={8}>
          <Paper sx={{ height: '70vh', display: 'flex', flexDirection: 'column' }}>
            {/* Chat Messages */}
            <Box sx={{ flexGrow: 1, p: 3, overflowY: 'auto' }}>
              {conversation.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 8 }}>
                  <ChatIcon sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    Ask me anything about your FHIR data
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Try: "Find all patients with diabetes" or "Show recent lab results"
                  </Typography>
                </Box>
              ) : (
                <Stack spacing={2}>
                  {conversation.map((message, index) => (
                    <Box key={index} sx={{ display: 'flex', flexDirection: message.type === 'user' ? 'row-reverse' : 'row' }}>
                      <Paper 
                        sx={{ 
                          p: 2, 
                          maxWidth: '80%',
                          bgcolor: message.type === 'user' ? 'primary.main' : 'grey.100',
                          color: message.type === 'user' ? 'white' : 'text.primary'
                        }}
                      >
                        <Typography variant="body1">
                          {message.content}
                        </Typography>
                        
                        {message.query && (
                          <Box sx={{ mt: 2 }}>
                            <Paper sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
                              <Typography variant="subtitle2" gutterBottom>
                                Generated Query:
                              </Typography>
                              <Typography variant="body2" fontFamily="monospace" sx={{ mb: 2, wordBreak: 'break-all' }}>
                                {message.query.query}
                              </Typography>
                              <Box sx={{ display: 'flex', gap: 1 }}>
                                <Button
                                  size="small"
                                  variant="contained"
                                  startIcon={<RunIcon />}
                                  onClick={() => executeQuery(message.query)}
                                >
                                  Execute
                                </Button>
                                <Button
                                  size="small"
                                  startIcon={<CopyIcon />}
                                  onClick={() => copyQuery(message.query.query)}
                                >
                                  Copy
                                </Button>
                              </Box>
                              {message.query.confidence < 0.8 && (
                                <Alert severity="warning" sx={{ mt: 1 }}>
                                  <Typography variant="caption">
                                    Confidence: {Math.round(message.query.confidence * 100)}% - {message.query.suggestion}
                                  </Typography>
                                </Alert>
                              )}
                            </Paper>
                          </Box>
                        )}
                        
                        {message.results && (
                          <Box sx={{ mt: 2 }}>
                            <Alert severity="success">
                              Found {message.results.length} resources
                            </Alert>
                          </Box>
                        )}
                        
                        <Typography variant="caption" sx={{ display: 'block', mt: 1, opacity: 0.7 }}>
                          {message.timestamp.toLocaleTimeString()}
                        </Typography>
                      </Paper>
                    </Box>
                  ))}
                </Stack>
              )}
            </Box>
            
            {/* Input Area */}
            <Box sx={{ p: 3, borderTop: 1, borderColor: 'divider' }}>
              <Stack direction="row" spacing={1}>
                <TextField
                  fullWidth
                  placeholder="Ask me about FHIR data in plain English..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
                  disabled={isProcessing}
                  multiline
                  maxRows={3}
                />
                <IconButton
                  color="primary"
                  onClick={handleSubmit}
                  disabled={!input.trim() || isProcessing}
                  sx={{ alignSelf: 'flex-end' }}
                >
                  {isProcessing ? <CircularProgress size={24} /> : <SendIcon />}
                </IconButton>
              </Stack>
            </Box>
          </Paper>
        </Grid>

        {/* Sidebar */}
        <Grid item xs={12} lg={4}>
          {/* Example Queries */}
          <Card sx={{ mb: 3 }}>
            <CardHeader 
              title="Example Queries" 
              avatar={<LightbulbIcon color="warning" />}
            />
            <CardContent>
              <Stack spacing={2}>
                {Object.entries(EXAMPLE_QUERIES).map(([category, data]) => (
                  <Box key={category}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      {React.createElement(data.icon, { sx: { fontSize: 18, mr: 1, color: 'primary.main' } })}
                      <Typography variant="subtitle2">{data.title}</Typography>
                    </Box>
                    <Stack spacing={0.5}>
                      {data.examples.map((example, index) => (
                        <Chip
                          key={index}
                          label={example}
                          onClick={() => setInput(example)}
                          variant="outlined"
                          size="small"
                          sx={{ justifyContent: 'flex-start', height: 'auto', py: 0.5 }}
                        />
                      ))}
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>

          {/* Follow-up Suggestions */}
          {suggestions.length > 0 && (
            <Card sx={{ mb: 3 }}>
              <CardHeader 
                title="Follow-up Questions" 
                avatar={<QuestionIcon color="info" />}
              />
              <CardContent>
                <Stack spacing={1}>
                  {suggestions.map((suggestion, index) => (
                    <Button
                      key={index}
                      variant="outlined"
                      size="small"
                      startIcon={<AutoAwesomeIcon />}
                      onClick={() => setInput(suggestion)}
                      sx={{ justifyContent: 'flex-start' }}
                    >
                      {suggestion}
                    </Button>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          )}

          {/* Query Patterns Help */}
          <Card>
            <CardHeader title="Supported Query Patterns" />
            <CardContent>
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="body2">Patient Queries</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <List dense>
                    <ListItem>
                      <ListItemText 
                        primary="Age-based searches"
                        secondary="'patients aged 65' or 'patients 30-50 years old'"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary="Condition searches"
                        secondary="'patients with diabetes' or 'find hypertension'"
                      />
                    </ListItem>
                  </List>
                </AccordionDetails>
              </Accordion>
              
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="body2">Clinical Data</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <List dense>
                    <ListItem>
                      <ListItemText 
                        primary="Lab results"
                        secondary="'recent glucose observations' or 'lab results for John'"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary="Value ranges"
                        secondary="'glucose between 100 and 200'"
                      />
                    </ListItem>
                  </List>
                </AccordionDetails>
              </Accordion>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Query Details Dialog */}
      <Dialog open={showQueryDialog} onClose={() => setShowQueryDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Generated FHIR Query Details</DialogTitle>
        <DialogContent>
          {currentQuery && (
            <Box>
              <Typography variant="h6" gutterBottom>Description</Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>{currentQuery.description}</Typography>
              
              <Typography variant="h6" gutterBottom>FHIR Query URL</Typography>
              <Paper sx={{ p: 2, bgcolor: 'grey.100', fontFamily: 'monospace', mb: 2 }}>
                <Typography variant="body2">{currentQuery.query}</Typography>
              </Paper>
              
              <Typography variant="h6" gutterBottom>Confidence</Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                {Math.round(currentQuery.confidence * 100)}% - This query should produce accurate results
              </Typography>
              
              {currentQuery.suggestion && (
                <>
                  <Typography variant="h6" gutterBottom>Suggestion</Typography>
                  <Alert severity="info">
                    {currentQuery.suggestion}
                  </Alert>
                </>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowQueryDialog(false)}>Close</Button>
          {currentQuery && (
            <Button onClick={() => copyQuery(currentQuery.query)} variant="contained">
              Copy Query
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default NaturalLanguageInterface;