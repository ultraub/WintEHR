/**
 * FHIR Explorer - Redesigned for User Education and Guided Query Building
 * 
 * This redesigned version focuses on:
 * - Progressive learning from basic to advanced concepts
 * - Visual query building with drag-and-drop
 * - Interactive tutorials and guided walkthroughs
 * - Real-time validation and helpful error messages
 * - Visual representation of FHIR relationships
 * - Clinical context and real-world examples
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Alert,
  LinearProgress,
  Breadcrumbs,
  Link,
  Stack,
  Divider,
  Badge,
  Avatar,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Switch,
  FormControlLabel,
  Collapse,
  ButtonGroup,
  CircularProgress,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import {
  School as SchoolIcon,
  Build as BuildIcon,
  Visibility as VisibilityIcon,
  PlayArrow as PlayIcon,
  Help as HelpIcon,
  TipsAndUpdates as TipsIcon,
  AutoAwesome as AutoAwesomeIcon,
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Code as CodeIcon,
  Api as ApiIcon,
  Person as PersonIcon,
  LocalHospital as HospitalIcon,
  Science as ScienceIcon,
  Medication as MedicationIcon,
  Assessment as AssessmentIcon,
  Timeline as TimelineIcon,
  Share as ShareIcon,
  Save as SaveIcon,
  Download as DownloadIcon,
  LightbulbOutlined as LightbulbIcon,
  ArrowForward as ArrowForwardIcon,
  ArrowBack as ArrowBackIcon,
  Close as CloseIcon,
  Add as AddIcon
} from '@mui/icons-material';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import json from 'react-syntax-highlighter/dist/esm/languages/hljs/json';
import { docco } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import api from '../services/api';
import { QueryPlayground } from '../components/fhir-explorer/QueryPlayground';
import { InteractiveTutorial as ImportedTutorial, TUTORIAL_CONTENT } from '../components/fhir-explorer/TutorialSystem';
import { 
  QueryParameter, 
  QueryValidator, 
  QueryURLGenerator, 
  QuickQueryTemplates 
} from '../components/fhir-explorer/QueryBuilderComponents';

SyntaxHighlighter.registerLanguage('json', json);

// Learning Path Configuration
const LEARNING_PATHS = {
  beginner: {
    title: "Getting Started with FHIR",
    description: "Learn FHIR basics through guided examples",
    icon: <SchoolIcon />,
    steps: [
      {
        id: 'intro',
        title: 'What is FHIR?',
        description: 'Understanding healthcare data standards',
        estimated: '5 min'
      },
      {
        id: 'resources',
        title: 'FHIR Resources',
        description: 'Basic building blocks of healthcare data',
        estimated: '10 min'
      },
      {
        id: 'simple-search',
        title: 'Simple Searches',
        description: 'Finding patients and basic data',
        estimated: '15 min'
      },
      {
        id: 'filters',
        title: 'Adding Filters',
        description: 'Refining your searches',
        estimated: '10 min'
      }
    ]
  },
  clinical: {
    title: "Clinical Workflows",
    description: "Real-world healthcare scenarios",
    icon: <HospitalIcon />,
    steps: [
      {
        id: 'patient-chart',
        title: 'Patient Chart Review',
        description: 'Gathering comprehensive patient data',
        estimated: '20 min'
      },
      {
        id: 'lab-results',
        title: 'Lab Results Analysis',
        description: 'Finding and analyzing laboratory data',
        estimated: '15 min'
      },
      {
        id: 'medication-history',
        title: 'Medication History',
        description: 'Tracking patient medications',
        estimated: '15 min'
      },
      {
        id: 'care-coordination',
        title: 'Care Coordination',
        description: 'Multiple provider scenarios',
        estimated: '25 min'
      }
    ]
  },
  advanced: {
    title: "Advanced Techniques",
    description: "Complex queries and optimization",
    icon: <BuildIcon />,
    steps: [
      {
        id: 'chained-params',
        title: 'Chained Parameters',
        description: 'Connecting related resources',
        estimated: '20 min'
      },
      {
        id: 'includes',
        title: 'Resource Includes',
        description: 'Efficient data retrieval',
        estimated: '15 min'
      },
      {
        id: 'custom-queries',
        title: 'Custom Queries',
        description: 'Building from scratch',
        estimated: '30 min'
      },
      {
        id: 'optimization',
        title: 'Query Optimization',
        description: 'Performance best practices',
        estimated: '20 min'
      }
    ]
  }
};

// Resource Type Configuration with Visual Elements
const RESOURCE_TYPES = {
  Patient: {
    icon: <PersonIcon />,
    color: '#2196F3',
    description: 'Individuals receiving healthcare',
    examples: ['Demographics', 'Contact info', 'Identifiers'],
    difficulty: 'beginner'
  },
  Observation: {
    icon: <ScienceIcon />,
    color: '#4CAF50',
    description: 'Measurements and simple assertions',
    examples: ['Vital signs', 'Lab results', 'Assessments'],
    difficulty: 'beginner'
  },
  MedicationRequest: {
    icon: <MedicationIcon />,
    color: '#FF9800',
    description: 'Orders for medications',
    examples: ['Prescriptions', 'Dosages', 'Instructions'],
    difficulty: 'intermediate'
  },
  Condition: {
    icon: <AssessmentIcon />,
    color: '#F44336',
    description: 'Health conditions and diagnoses',
    examples: ['Diagnoses', 'Problems', 'Health concerns'],
    difficulty: 'intermediate'
  },
  Encounter: {
    icon: <HospitalIcon />,
    color: '#9C27B0',
    description: 'Healthcare visits and episodes',
    examples: ['Appointments', 'Hospitalizations', 'Consultations'],
    difficulty: 'intermediate'
  },
  DiagnosticReport: {
    icon: <AssessmentIcon />,
    color: '#607D8B',
    description: 'Clinical report groupings',
    examples: ['Lab panels', 'Imaging reports', 'Pathology'],
    difficulty: 'advanced'
  }
};

// Query Templates with Educational Context
const QUERY_TEMPLATES = {
  'find-patient': {
    title: 'Find a Patient',
    description: 'Learn how to search for patients by name or identifier',
    difficulty: 'beginner',
    category: 'basic',
    template: '/fhir/R4/Patient?name={name}',
    params: [
      { name: 'name', type: 'string', description: 'Patient name (partial matching supported)' }
    ],
    explanation: "This query searches for patients by name. FHIR supports partial matching, so 'John' will find 'John Smith', 'Johnny', etc.",
    tips: [
      "Use partial names for broader search results",
      "Try searching by last name only",
      "Case doesn't matter in name searches"
    ]
  },
  'patient-vitals': {
    title: 'Patient Vital Signs',
    description: 'Find all vital signs for a specific patient',
    difficulty: 'beginner',
    category: 'clinical',
    template: '/fhir/R4/Observation?patient={patient}&category=vital-signs',
    params: [
      { name: 'patient', type: 'reference', description: 'Patient ID or reference' }
    ],
    explanation: "This searches for Observations with category 'vital-signs' for a specific patient. The category parameter filters to only vital signs.",
    tips: [
      "Vital signs include blood pressure, heart rate, temperature",
      "Use date filters to find recent vitals",
      "Sort by date with _sort=date for chronological order"
    ]
  },
  'recent-labs': {
    title: 'Recent Lab Results',
    description: 'Find laboratory results from the last 30 days',
    difficulty: 'intermediate',
    category: 'clinical',
    template: '/fhir/R4/Observation?patient={patient}&category=laboratory&date=ge{date}',
    params: [
      { name: 'patient', type: 'reference', description: 'Patient ID' },
      { name: 'date', type: 'date', description: 'Start date (YYYY-MM-DD)' }
    ],
    explanation: "This uses date filtering with 'ge' (greater than or equal) to find lab results after a specific date.",
    tips: [
      "Date formats: YYYY, YYYY-MM, or YYYY-MM-DD",
      "Use 'le' for 'less than or equal'",
      "Combine multiple date comparisons for date ranges"
    ]
  }
};

function FHIRExplorerRedesigned() {
  // Main state management
  const [currentMode, setCurrentMode] = useState('learning'); // learning, building, testing
  const [currentPath, setCurrentPath] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState(new Set());
  const [queryBuilder, setQueryBuilder] = useState({
    resourceType: '',
    parameters: [],
    includes: [],
    sort: '',
    count: 20
  });
  const [queryResults, setQueryResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [activeTutorial, setActiveTutorial] = useState(null);

  // Learning mode components
  const LearningPathSelector = () => (
    <Grid container spacing={3} sx={{ mb: 4 }}>
      <Grid item xs={12}>
        <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SchoolIcon color="primary" />
          Choose Your Learning Path
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Select a learning path that matches your experience level and goals
        </Typography>
      </Grid>
      
      {Object.entries(LEARNING_PATHS).map(([pathId, path]) => (
        <Grid item xs={12} md={4} key={pathId}>
          <Card 
            sx={{ 
              height: '100%',
              cursor: 'pointer',
              transition: 'transform 0.2s',
              '&:hover': { transform: 'translateY(-4px)' }
            }}
            onClick={() => {
              setCurrentPath(pathId);
              setCurrentStep(0);
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                  {path.icon}
                </Avatar>
                <Box>
                  <Typography variant="h6">{path.title}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {path.steps.length} steps
                  </Typography>
                </Box>
              </Box>
              <Typography variant="body2" sx={{ mb: 2 }}>
                {path.description}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {path.steps.map((step, index) => (
                  <Chip
                    key={step.id}
                    size="small"
                    label={step.estimated}
                    color={completedSteps.has(`${pathId}-${index}`) ? 'success' : 'default'}
                    icon={completedSteps.has(`${pathId}-${index}`) ? <CheckCircleIcon /> : undefined}
                  />
                ))}
              </Box>
            </CardContent>
            <CardActions>
              <Button 
                size="small" 
                color="primary"
                endIcon={<ArrowForwardIcon />}
                onClick={() => setActiveTutorial(`${pathId}-basics`)}
              >
                Start Learning
              </Button>
            </CardActions>
          </Card>
        </Grid>
      ))}
    </Grid>
  );

  const LocalTutorialView = ({ pathId, stepIndex }) => {
    const path = LEARNING_PATHS[pathId];
    
    // Add error handling for undefined path
    if (!path) {
      return (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="h6" color="error">
            Tutorial not found: {pathId}
          </Typography>
          <Button onClick={() => setCurrentPath(null)} sx={{ mt: 2 }}>
            Back to Learning Paths
          </Button>
        </Box>
      );
    }
    
    const step = path.steps[stepIndex];
    
    const handleStepComplete = () => {
      setCompletedSteps(prev => new Set([...prev, `${pathId}-${stepIndex}`]));
      if (stepIndex < path.steps.length - 1) {
        setCurrentStep(stepIndex + 1);
      } else {
        // Path completed
        setCurrentMode('building');
      }
    };

    const renderStepContent = () => {
      switch (step.id) {
        case 'intro':
          return (
            <Box>
              <Typography variant="h6" gutterBottom>
                Welcome to FHIR! 🎉
              </Typography>
              <Typography paragraph>
                FHIR (Fast Healthcare Interoperability Resources) is a standard for 
                exchanging healthcare information electronically. Think of it as a 
                common language that healthcare systems use to talk to each other.
              </Typography>
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="subtitle2">Key Benefits:</Typography>
                <List dense>
                  <ListItem><ListItemText primary="• Standardized healthcare data format" /></ListItem>
                  <ListItem><ListItemText primary="• Easy integration between systems" /></ListItem>
                  <ListItem><ListItemText primary="• Patient-centered data model" /></ListItem>
                </List>
              </Alert>
              <Typography paragraph>
                In this tutorial, you'll learn how to query healthcare data using FHIR. 
                We'll start with simple searches and build up to complex clinical scenarios.
              </Typography>
            </Box>
          );
        
        case 'resources':
          return (
            <Box>
              <Typography variant="h6" gutterBottom>
                Understanding FHIR Resources 📋
              </Typography>
              <Typography paragraph>
                FHIR organizes healthcare data into "Resources" - standardized 
                chunks of information. Each resource type represents a specific 
                aspect of healthcare.
              </Typography>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                {Object.entries(RESOURCE_TYPES).slice(0, 4).map(([type, config]) => (
                  <Grid item xs={12} sm={6} key={type}>
                    <Card variant="outlined">
                      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar sx={{ bgcolor: config.color }}>
                          {config.icon}
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle1">{type}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {config.description}
                          </Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
              <Alert severity="success">
                <Typography variant="body2">
                  💡 <strong>Remember:</strong> Resources are connected! A Patient has 
                  Observations, MedicationRequests, and Conditions associated with them.
                </Typography>
              </Alert>
            </Box>
          );
        
        case 'simple-search':
          return <SimpleSearchTutorial onComplete={handleStepComplete} />;
        
        case 'filters':
          return <FiltersTutorial onComplete={handleStepComplete} />;
        
        case 'resources':
          return <ResourcesTutorial onComplete={handleStepComplete} />;
          
        // Clinical workflow tutorials
        case 'patient-chart':
          return <PatientChartTutorial onComplete={handleStepComplete} />;
          
        case 'lab-results':
          return <LabResultsTutorial onComplete={handleStepComplete} />;
          
        case 'medication-history':
          return <MedicationHistoryTutorial onComplete={handleStepComplete} />;
          
        case 'care-coordination':
          return <CareCoordinationTutorial onComplete={handleStepComplete} />;
          
        // Advanced tutorials
        case 'chained-params':
          return <ChainedParametersTutorial onComplete={handleStepComplete} />;
          
        case 'includes':
          return <ResourceIncludesTutorial onComplete={handleStepComplete} />;
          
        case 'custom-queries':
          return <CustomQueriesTutorial onComplete={handleStepComplete} />;
          
        case 'optimization':
          return <QueryOptimizationTutorial onComplete={handleStepComplete} />;
          
        default:
          return (
            <Box>
              <Typography variant="h6" gutterBottom>
                {step.title}
              </Typography>
              <Typography paragraph color="text.secondary">
                {step.description}
              </Typography>
              <Alert severity="info" sx={{ mb: 2 }}>
                This tutorial content is coming soon. For now, try exploring the other modes!
              </Alert>
              <Button variant="contained" onClick={handleStepComplete}>
                Continue
              </Button>
            </Box>
          );
      }
    };

    return (
      <Box>
        <Breadcrumbs sx={{ mb: 2 }}>
          <Link 
            underline="hover" 
            color="inherit" 
            onClick={() => setCurrentPath(null)}
            sx={{ cursor: 'pointer' }}
          >
            Learning Paths
          </Link>
          <Typography color="text.primary">{path.title}</Typography>
          <Typography color="text.primary">{step.title}</Typography>
        </Breadcrumbs>

        <Paper sx={{ p: 3, mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h5">{step.title}</Typography>
            <Chip label={`Step ${stepIndex + 1} of ${path.steps.length}`} />
          </Box>
          
          <LinearProgress 
            variant="determinate" 
            value={(stepIndex + 1) / path.steps.length * 100} 
            sx={{ mb: 3 }}
          />

          {renderStepContent()}

          <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
            {stepIndex > 0 && (
              <Button
                onClick={() => setCurrentStep(stepIndex - 1)}
                startIcon={<ArrowBackIcon />}
              >
                Previous
              </Button>
            )}
            <Button
              variant="contained"
              onClick={handleStepComplete}
              endIcon={<ArrowForwardIcon />}
            >
              {stepIndex < path.steps.length - 1 ? 'Next' : 'Complete Path'}
            </Button>
          </Box>
        </Paper>
      </Box>
    );
  };

  const SimpleSearchTutorial = ({ onComplete }) => {
    const [demoQuery, setDemoQuery] = useState('');
    const [demoResults, setDemoResults] = useState(null);
    const [demoLoading, setDemoLoading] = useState(false);
    const [tryItQuery, setTryItQuery] = useState('/fhir/R4/Patient?name=');
    const [tryItLoading, setTryItLoading] = useState(false);
    const [tryItResults, setTryItResults] = useState(null);

    const runDemoQuery = async () => {
      setDemoLoading(true);
      try {
        const response = await api.get(`/fhir/R4/Patient?name=Smith&_count=5`);
        setDemoResults(response.data);
        setDemoQuery('/fhir/R4/Patient?name=Smith&_count=5');
      } catch (error) {
        setError('Demo query failed');
      } finally {
        setDemoLoading(false);
      }
    };

    const runTryItQuery = async () => {
      if (!tryItQuery) return;
      setTryItLoading(true);
      try {
        const response = await api.get(tryItQuery);
        setTryItResults(response.data);
      } catch (error) {
        setError('Query failed: ' + error.message);
      } finally {
        setTryItLoading(false);
      }
    };

    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Your First FHIR Search 🔍
        </Typography>
        <Typography paragraph>
          Let's start with finding patients by name. This is one of the most 
          common operations in healthcare systems.
        </Typography>

        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="subtitle2">Query Structure:</Typography>
          <Typography variant="body2" component="div" sx={{ fontFamily: 'monospace', mt: 1 }}>
            /fhir/R4/<strong>Patient</strong>?<strong>name</strong>=<em>Smith</em>&<strong>_count</strong>=<em>5</em>
          </Typography>
          <List dense sx={{ mt: 1 }}>
            <ListItem><ListItemText primary="• Patient = resource type we're searching" /></ListItem>
            <ListItem><ListItemText primary="• name = search parameter" /></ListItem>
            <ListItem><ListItemText primary="• _count = limit results to 5" /></ListItem>
          </List>
        </Alert>

        <Box sx={{ mb: 3 }}>
          <Button
            variant="contained"
            onClick={runDemoQuery}
            disabled={demoLoading}
            startIcon={<PlayIcon />}
            sx={{ mb: 2 }}
          >
            {demoLoading ? 'Running...' : 'Try This Search'}
          </Button>
          
          {demoResults && (
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography>View Results ({demoResults.total} patients found)</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <SyntaxHighlighter language="json" style={docco}>
                  {JSON.stringify(demoResults, null, 2)}
                </SyntaxHighlighter>
              </AccordionDetails>
            </Accordion>
          )}
        </Box>

        <Divider sx={{ my: 3 }} />

        <Typography variant="h6" gutterBottom>
          Try It Yourself! 🚀
        </Typography>
        <Typography paragraph>
          Now build your own query:
        </Typography>
        
        <Box sx={{ mb: 3 }}>
          <TextField
            fullWidth
            label="Your Query"
            value={tryItQuery}
            onChange={(e) => setTryItQuery(e.target.value)}
            helperText="Edit this query to search for different patients"
            sx={{ mb: 2 }}
          />
          <Button
            variant="outlined"
            onClick={runTryItQuery}
            disabled={tryItLoading || !tryItQuery}
            startIcon={<PlayIcon />}
          >
            {tryItLoading ? 'Running...' : 'Run Your Query'}
          </Button>
        </Box>

        {tryItResults && (
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography>
                Your Results ({tryItResults.total} found, {tryItResults.entry?.length || 0} returned)
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <SyntaxHighlighter language="json" style={docco}>
                {JSON.stringify(tryItResults, null, 2)}
              </SyntaxHighlighter>
            </AccordionDetails>
          </Accordion>
        )}

        <Alert severity="success" sx={{ mt: 3 }}>
          <Typography variant="subtitle2">💡 Learning Tips:</Typography>
          <List dense>
            <ListItem><ListItemText primary="• Try searching for just 'S' - see partial matching in action" /></ListItem>
            <ListItem><ListItemText primary="• Add &_count=20 to get more results" /></ListItem>
            <ListItem><ListItemText primary="• Try &given=John to search by first name" /></ListItem>
            <ListItem><ListItemText primary="• Add &_sort=name to sort results alphabetically" /></ListItem>
          </List>
        </Alert>

        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            onClick={onComplete}
            endIcon={<CheckCircleIcon />}
          >
            Complete This Step
          </Button>
        </Box>
      </Box>
    );
  };

  const FiltersTutorial = ({ onComplete }) => {
    const [filterType, setFilterType] = useState('date');
    const [filterResults, setFilterResults] = useState(null);
    const [loading, setLoading] = useState(false);

    const filterExamples = {
      date: {
        title: 'Date Filtering',
        query: '/fhir/R4/Observation?patient=example&date=ge2024-01-01',
        description: 'Find observations after January 1, 2024',
        parameters: [
          { name: 'ge', description: 'Greater than or equal to' },
          { name: 'le', description: 'Less than or equal to' },
          { name: 'eq', description: 'Exactly equal to' }
        ]
      },
      code: {
        title: 'Code Filtering',
        query: '/fhir/R4/Observation?code=http://loinc.org|85354-9',
        description: 'Find blood pressure observations using LOINC code',
        parameters: [
          { name: 'code', description: 'Exact code match' },
          { name: 'code:text', description: 'Search code display text' },
          { name: 'code:in', description: 'Code in a value set' }
        ]
      },
      multiple: {
        title: 'Multiple Parameters',
        query: '/fhir/R4/Observation?patient=example&category=vital-signs&date=ge2024-01-01&_count=10',
        description: 'Combine multiple filters for precise results',
        parameters: [
          { name: 'AND', description: 'All conditions must match' },
          { name: 'OR', description: 'Use comma for OR conditions' },
          { name: 'Chaining', description: 'patient.name for related resources' }
        ]
      }
    };

    const runFilterExample = async () => {
      setLoading(true);
      try {
        // For demo, we'll get recent observations
        const response = await api.get('/fhir/R4/Observation?_count=5&_sort=-date');
        setFilterResults(response.data);
      } catch (error) {
        setError('Filter demo failed');
      } finally {
        setLoading(false);
      }
    };

    const currentExample = filterExamples[filterType];

    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Mastering FHIR Filters 🎯
        </Typography>
        <Typography paragraph>
          Filters help you find exactly what you need from thousands of resources.
          Let's explore the most powerful filtering techniques.
        </Typography>

        <Tabs value={filterType} onChange={(e, v) => setFilterType(v)} sx={{ mb: 3 }}>
          <Tab label="Date Filters" value="date" />
          <Tab label="Code Filters" value="code" />
          <Tab label="Multiple Filters" value="multiple" />
        </Tabs>

        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            {currentExample.title}
          </Typography>
          <Typography paragraph color="text.secondary">
            {currentExample.description}
          </Typography>
          
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
              {currentExample.query}
            </Typography>
          </Alert>

          <Typography variant="subtitle2" gutterBottom>
            Available Modifiers:
          </Typography>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            {currentExample.parameters.map((param) => (
              <Grid item xs={12} sm={4} key={param.name}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle1" color="primary">
                      {param.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {param.description}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Button
            variant="contained"
            onClick={runFilterExample}
            disabled={loading}
            startIcon={<PlayIcon />}
          >
            {loading ? 'Loading...' : 'Try This Filter'}
          </Button>
        </Paper>

        {filterResults && (
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography>
                Filter Results ({filterResults.total} total, {filterResults.entry?.length || 0} shown)
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <SyntaxHighlighter language="json" style={docco}>
                {JSON.stringify(filterResults, null, 2)}
              </SyntaxHighlighter>
            </AccordionDetails>
          </Accordion>
        )}

        <Alert severity="success" sx={{ mt: 3 }}>
          <Typography variant="subtitle2">💡 Pro Tips:</Typography>
          <List dense>
            <ListItem>
              <ListItemText primary="• Date filters work with partial dates: 2024, 2024-01, or 2024-01-15" />
            </ListItem>
            <ListItem>
              <ListItemText primary="• Use comma for OR: ?code=1234,5678" />
            </ListItem>
            <ListItem>
              <ListItemText primary="• Chain parameters: ?patient.name=Smith" />
            </ListItem>
            <ListItem>
              <ListItemText primary="• Combine with _include to get related resources" />
            </ListItem>
          </List>
        </Alert>

        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            onClick={onComplete}
            endIcon={<CheckCircleIcon />}
          >
            Complete This Step
          </Button>
        </Box>
      </Box>
    );
  };

  const ResourcesTutorial = ({ onComplete }) => {
    const [selectedResource, setSelectedResource] = useState('Patient');
    const [showRelationships, setShowRelationships] = useState(false);

    const resourceDetails = {
      Patient: {
        description: 'Central to healthcare - represents individuals receiving care',
        commonFields: ['name', 'birthDate', 'gender', 'address', 'identifier'],
        relatedResources: ['Observation', 'Condition', 'MedicationRequest', 'Encounter'],
        example: {
          resourceType: 'Patient',
          id: 'example',
          name: [{ family: 'Smith', given: ['John'] }],
          birthDate: '1970-01-01',
          gender: 'male'
        }
      },
      Observation: {
        description: 'Measurements and simple assertions - vital signs, lab results, etc.',
        commonFields: ['status', 'code', 'subject', 'effectiveDateTime', 'value'],
        relatedResources: ['Patient', 'Encounter', 'DiagnosticReport'],
        example: {
          resourceType: 'Observation',
          id: 'example',
          status: 'final',
          code: { text: 'Blood Pressure' },
          subject: { reference: 'Patient/example' },
          effectiveDateTime: '2024-01-01T10:00:00Z'
        }
      },
      MedicationRequest: {
        description: 'Orders for medications - prescriptions and administration orders',
        commonFields: ['status', 'intent', 'medication', 'subject', 'dosageInstruction'],
        relatedResources: ['Patient', 'Practitioner', 'MedicationDispense'],
        example: {
          resourceType: 'MedicationRequest',
          id: 'example',
          status: 'active',
          intent: 'order',
          medicationCodeableConcept: { text: 'Aspirin 81mg' },
          subject: { reference: 'Patient/example' }
        }
      }
    };

    const currentResource = resourceDetails[selectedResource];

    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Understanding FHIR Resources 📚
        </Typography>
        <Typography paragraph>
          FHIR Resources are the building blocks of healthcare data. Each resource
          type has a specific purpose and structure. Let's explore the most important ones.
        </Typography>

        <Grid container spacing={2} sx={{ mb: 3 }}>
          {Object.keys(resourceDetails).map((resourceType) => (
            <Grid item xs={12} sm={4} key={resourceType}>
              <Card
                variant={selectedResource === resourceType ? 'outlined' : 'elevation'}
                sx={{
                  cursor: 'pointer',
                  border: selectedResource === resourceType ? 2 : 0,
                  borderColor: 'primary.main'
                }}
                onClick={() => setSelectedResource(resourceType)}
              >
                <CardContent>
                  <Typography variant="h6">{resourceType}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {resourceDetails[resourceType].description.substring(0, 50)}...
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            {selectedResource} Resource
          </Typography>
          <Typography paragraph color="text.secondary">
            {currentResource.description}
          </Typography>

          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Common Fields:
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {currentResource.commonFields.map((field) => (
                <Chip key={field} label={field} size="small" />
              ))}
            </Box>
          </Box>

          <Box sx={{ mb: 3 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={showRelationships}
                  onChange={(e) => setShowRelationships(e.target.checked)}
                />
              }
              label="Show Relationships"
            />
            <Collapse in={showRelationships}>
              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="subtitle2">Related Resources:</Typography>
                {currentResource.relatedResources.map((related) => (
                  <Chip
                    key={related}
                    label={related}
                    size="small"
                    sx={{ m: 0.5 }}
                    onClick={() => setSelectedResource(related)}
                  />
                ))}
              </Alert>
            </Collapse>
          </Box>

          <Typography variant="subtitle2" gutterBottom>
            Example {selectedResource}:
          </Typography>
          <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
            <SyntaxHighlighter language="json" style={docco}>
              {JSON.stringify(currentResource.example, null, 2)}
            </SyntaxHighlighter>
          </Paper>
        </Paper>

        <Alert severity="success">
          <Typography variant="subtitle2">🔗 Key Insight:</Typography>
          <Typography variant="body2">
            Resources are connected through references. A Patient can have many
            Observations, each Observation refers back to the Patient. This creates
            a web of interconnected healthcare data.
          </Typography>
        </Alert>

        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            onClick={onComplete}
            endIcon={<CheckCircleIcon />}
          >
            Complete This Step
          </Button>
        </Box>
      </Box>
    );
  };

  // Clinical Workflow Tutorials
  const PatientChartTutorial = ({ onComplete }) => {
    const [patientId, setPatientId] = useState('');
    const [chartData, setChartData] = useState(null);
    const [loading, setLoading] = useState(false);

    const fetchPatientChart = async () => {
      setLoading(true);
      try {
        // Fetch a sample patient first
        const patientsResponse = await api.get('/fhir/R4/Patient?_count=1');
        if (patientsResponse.data.entry && patientsResponse.data.entry.length > 0) {
          const patient = patientsResponse.data.entry[0].resource;
          setPatientId(patient.id);
          
          // Fetch comprehensive patient data
          const chartResponse = await api.get(
            `/fhir/R4/Patient/${patient.id}/$everything?_count=10`
          );
          setChartData({
            patient,
            bundle: chartResponse.data
          });
        }
      } catch (error) {
        setError('Failed to fetch patient chart');
      } finally {
        setLoading(false);
      }
    };

    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Patient Chart Review 📋
        </Typography>
        <Typography paragraph>
          In clinical practice, you often need to gather all information about a patient.
          FHIR provides powerful ways to retrieve comprehensive patient data.
        </Typography>

        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="subtitle2">The $everything Operation</Typography>
          <Typography variant="body2">
            The $everything operation returns all resources related to a patient:
          </Typography>
          <Typography variant="body2" sx={{ fontFamily: 'monospace', mt: 1 }}>
            /fhir/R4/Patient/[id]/$everything
          </Typography>
        </Alert>

        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Try It: Fetch Complete Patient Chart
          </Typography>
          <Button
            variant="contained"
            onClick={fetchPatientChart}
            disabled={loading}
            startIcon={<PlayIcon />}
          >
            {loading ? 'Loading Chart...' : 'Fetch Patient Chart'}
          </Button>

          {chartData && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle1" gutterBottom>
                Patient: {chartData.patient.name?.[0]?.family}, {chartData.patient.name?.[0]?.given?.[0]}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                ID: {chartData.patient.id} | Gender: {chartData.patient.gender} | 
                Birth Date: {chartData.patient.birthDate}
              </Typography>

              <Typography variant="subtitle2" sx={{ mt: 2 }}>
                Chart Contents:
              </Typography>
              <Grid container spacing={2} sx={{ mt: 1 }}>
                {Object.entries(
                  chartData.bundle.entry?.reduce((acc, entry) => {
                    const type = entry.resource.resourceType;
                    acc[type] = (acc[type] || 0) + 1;
                    return acc;
                  }, {}) || {}
                ).map(([type, count]) => (
                  <Grid item xs={6} sm={4} key={type}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle2">{type}</Typography>
                        <Typography variant="h6">{count}</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}
        </Paper>

        <Alert severity="success">
          <Typography variant="subtitle2">💡 Clinical Tip:</Typography>
          <Typography variant="body2">
            Use $everything for initial patient encounters, but be specific with
            individual queries for ongoing care to improve performance.
          </Typography>
        </Alert>

        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            onClick={onComplete}
            endIcon={<CheckCircleIcon />}
          >
            Complete This Step
          </Button>
        </Box>
      </Box>
    );
  };

  const LabResultsTutorial = ({ onComplete }) => {
    const [labResults, setLabResults] = useState(null);
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState('table');

    const fetchLabResults = async () => {
      setLoading(true);
      try {
        const response = await api.get(
          '/fhir/R4/Observation?category=laboratory&_count=10&_sort=-date'
        );
        setLabResults(response.data);
      } catch (error) {
        setError('Failed to fetch lab results');
      } finally {
        setLoading(false);
      }
    };

    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Lab Results Analysis 🧪
        </Typography>
        <Typography paragraph>
          Laboratory results are crucial for diagnosis and monitoring. Learn how to
          query, filter, and analyze lab data effectively.
        </Typography>

        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Common Lab Queries
          </Typography>
          
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" color="primary">
                    Recent Labs by Category
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', mt: 1 }}>
                    ?category=laboratory&_sort=-date
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" color="primary">
                    Specific Test by LOINC
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', mt: 1 }}>
                    ?code=http://loinc.org|2951-2
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" color="primary">
                    Abnormal Results
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', mt: 1 }}>
                    ?category=laboratory&interpretation=abnormal
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" color="primary">
                    Date Range Query
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', mt: 1 }}>
                    ?date=ge2024-01-01&date=le2024-12-31
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Button
            variant="contained"
            onClick={fetchLabResults}
            disabled={loading}
            startIcon={<PlayIcon />}
            sx={{ mt: 3 }}
          >
            {loading ? 'Loading Results...' : 'Fetch Lab Results'}
          </Button>
        </Paper>

        {labResults && labResults.entry && (
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Lab Results ({labResults.total} total)
            </Typography>
            
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Test Name</TableCell>
                    <TableCell>Value</TableCell>
                    <TableCell>Reference Range</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {labResults.entry.slice(0, 5).map((entry) => {
                    const obs = entry.resource;
                    return (
                      <TableRow key={obs.id}>
                        <TableCell>
                          {obs.code?.text || obs.code?.coding?.[0]?.display}
                        </TableCell>
                        <TableCell>
                          {obs.valueQuantity?.value} {obs.valueQuantity?.unit}
                        </TableCell>
                        <TableCell>
                          {obs.referenceRange?.[0]?.text || 'N/A'}
                        </TableCell>
                        <TableCell>
                          {new Date(obs.effectiveDateTime).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={obs.status} 
                            size="small"
                            color={obs.status === 'final' ? 'success' : 'default'}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}

        <Alert severity="info" sx={{ mt: 3 }}>
          <Typography variant="subtitle2">🔬 Lab Analysis Tips:</Typography>
          <List dense>
            <ListItem>
              <ListItemText primary="• Use LOINC codes for precise test identification" />
            </ListItem>
            <ListItem>
              <ListItemText primary="• Always check reference ranges - they vary by lab" />
            </ListItem>
            <ListItem>
              <ListItemText primary="• Sort by date to see trends over time" />
            </ListItem>
            <ListItem>
              <ListItemText primary="• Use _include=Observation:specimen for specimen details" />
            </ListItem>
          </List>
        </Alert>

        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            onClick={onComplete}
            endIcon={<CheckCircleIcon />}
          >
            Complete This Step
          </Button>
        </Box>
      </Box>
    );
  };

  const MedicationHistoryTutorial = ({ onComplete }) => {
    const [medications, setMedications] = useState(null);
    const [loading, setLoading] = useState(false);
    const [includeDispenses, setIncludeDispenses] = useState(false);

    const fetchMedications = async () => {
      setLoading(true);
      try {
        let query = '/fhir/R4/MedicationRequest?_count=10&_sort=-authoredOn';
        if (includeDispenses) {
          query += '&_include=MedicationRequest:medication';
        }
        const response = await api.get(query);
        setMedications(response.data);
      } catch (error) {
        setError('Failed to fetch medications');
      } finally {
        setLoading(false);
      }
    };

    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Medication History 💊
        </Typography>
        <Typography paragraph>
          Tracking medication history is essential for patient safety. Learn to query
          prescriptions, dispensing records, and medication adherence.
        </Typography>

        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Medication Query Patterns
          </Typography>

          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="subtitle2">Important Relationships:</Typography>
            <Typography variant="body2">
              • MedicationRequest → Prescriptions/Orders<br />
              • MedicationDispense → What was actually given<br />
              • MedicationAdministration → In-hospital administration
            </Typography>
          </Alert>

          <FormControlLabel
            control={
              <Switch
                checked={includeDispenses}
                onChange={(e) => setIncludeDispenses(e.target.checked)}
              />
            }
            label="Include medication details"
            sx={{ mb: 2 }}
          />

          <Button
            variant="contained"
            onClick={fetchMedications}
            disabled={loading}
            startIcon={<PlayIcon />}
          >
            {loading ? 'Loading...' : 'Fetch Medication History'}
          </Button>
        </Paper>

        {medications && medications.entry && (
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Active Medications
            </Typography>
            
            {medications.entry
              .filter(e => e.resource.resourceType === 'MedicationRequest')
              .slice(0, 5)
              .map((entry) => {
                const med = entry.resource;
                return (
                  <Card key={med.id} variant="outlined" sx={{ mb: 2 }}>
                    <CardContent>
                      <Typography variant="subtitle1">
                        {med.medicationCodeableConcept?.text || 
                         med.medicationCodeableConcept?.coding?.[0]?.display ||
                         'Unknown Medication'}
                      </Typography>
                      <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid item xs={12} sm={4}>
                          <Typography variant="body2" color="text.secondary">
                            Status
                          </Typography>
                          <Chip 
                            label={med.status} 
                            size="small"
                            color={med.status === 'active' ? 'success' : 'default'}
                          />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <Typography variant="body2" color="text.secondary">
                            Intent
                          </Typography>
                          <Typography variant="body2">
                            {med.intent}
                          </Typography>
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <Typography variant="body2" color="text.secondary">
                            Authored
                          </Typography>
                          <Typography variant="body2">
                            {new Date(med.authoredOn).toLocaleDateString()}
                          </Typography>
                        </Grid>
                      </Grid>
                      {med.dosageInstruction?.[0] && (
                        <Box sx={{ mt: 2 }}>
                          <Typography variant="body2" color="text.secondary">
                            Instructions
                          </Typography>
                          <Typography variant="body2">
                            {med.dosageInstruction[0].text || 
                             `${med.dosageInstruction[0].doseAndRate?.[0]?.doseQuantity?.value} ${
                               med.dosageInstruction[0].doseAndRate?.[0]?.doseQuantity?.unit
                             }`}
                          </Typography>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
          </Paper>
        )}

        <Alert severity="success" sx={{ mt: 3 }}>
          <Typography variant="subtitle2">💊 Medication Safety Tips:</Typography>
          <List dense>
            <ListItem>
              <ListItemText primary="• Always check both requests and dispenses for complete history" />
            </ListItem>
            <ListItem>
              <ListItemText primary="• Use status filters to find active vs. stopped medications" />
            </ListItem>
            <ListItem>
              <ListItemText primary="• Include reason codes to understand prescribing context" />
            </ListItem>
          </List>
        </Alert>

        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            onClick={onComplete}
            endIcon={<CheckCircleIcon />}
          >
            Complete This Step
          </Button>
        </Box>
      </Box>
    );
  };

  const CareCoordinationTutorial = ({ onComplete }) => {
    const [careTeam, setCareTeam] = useState(null);
    const [loading, setLoading] = useState(false);

    const fetchCareCoordination = async () => {
      setLoading(true);
      try {
        // Fetch care team and related resources
        const response = await api.get(
          '/fhir/R4/CareTeam?_include=CareTeam:participant&_count=5'
        );
        setCareTeam(response.data);
      } catch (error) {
        setError('Failed to fetch care coordination data');
      } finally {
        setLoading(false);
      }
    };

    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Care Coordination 🤝
        </Typography>
        <Typography paragraph>
          Modern healthcare involves multiple providers. Learn how to query and
          understand care team relationships, referrals, and care plans.
        </Typography>

        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Key Resources for Coordination
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle1" color="primary">
                    CareTeam
                  </Typography>
                  <Typography variant="body2">
                    Groups of practitioners involved in patient care
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', mt: 1 }}>
                    /fhir/R4/CareTeam?patient=[id]
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle1" color="primary">
                    CarePlan
                  </Typography>
                  <Typography variant="body2">
                    Structured care activities and goals
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', mt: 1 }}>
                    /fhir/R4/CarePlan?patient=[id]
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle1" color="primary">
                    ServiceRequest
                  </Typography>
                  <Typography variant="body2">
                    Referrals and service orders
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', mt: 1 }}>
                    /fhir/R4/ServiceRequest?intent=order
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle1" color="primary">
                    Communication
                  </Typography>
                  <Typography variant="body2">
                    Provider-to-provider messages
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', mt: 1 }}>
                    /fhir/R4/Communication?recipient=[id]
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Button
            variant="contained"
            onClick={fetchCareCoordination}
            disabled={loading}
            startIcon={<PlayIcon />}
            sx={{ mt: 3 }}
          >
            {loading ? 'Loading...' : 'Explore Care Coordination'}
          </Button>
        </Paper>

        <Alert severity="info">
          <Typography variant="subtitle2">🏥 Coordination Best Practices:</Typography>
          <List dense>
            <ListItem>
              <ListItemText primary="• Use _include to get participant details in one query" />
            </ListItem>
            <ListItem>
              <ListItemText primary="• Check status fields to find active care relationships" />
            </ListItem>
            <ListItem>
              <ListItemText primary="• Link ServiceRequests to track referral completion" />
            </ListItem>
          </List>
        </Alert>

        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            onClick={onComplete}
            endIcon={<CheckCircleIcon />}
          >
            Complete This Step
          </Button>
        </Box>
      </Box>
    );
  };

  // Advanced Tutorials
  const ChainedParametersTutorial = ({ onComplete }) => {
    const [chainExample, setChainExample] = useState('patient-name');
    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(false);

    const chainExamples = {
      'patient-name': {
        title: 'Find Observations by Patient Name',
        query: '/fhir/R4/Observation?patient.name=Smith',
        explanation: 'Instead of finding patient ID first, chain directly to patient name'
      },
      'practitioner-org': {
        title: 'Find Practitioners by Organization Name',
        query: '/fhir/R4/Practitioner?organization.name=General Hospital',
        explanation: 'Chain through organization reference to search by org name'
      },
      'medication-manufacturer': {
        title: 'Find Medication Requests by Manufacturer',
        query: '/fhir/R4/MedicationRequest?medication.manufacturer.name=Pharma Inc',
        explanation: 'Double chaining: request → medication → manufacturer'
      }
    };

    const runChainQuery = async () => {
      setLoading(true);
      try {
        // For demo, we'll use a simpler query
        const response = await api.get('/fhir/R4/Observation?_count=3');
        setResults(response.data);
      } catch (error) {
        setError('Chain query failed');
      } finally {
        setLoading(false);
      }
    };

    const currentExample = chainExamples[chainExample];

    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Chained Parameters 🔗
        </Typography>
        <Typography paragraph>
          Chained parameters let you search through resource relationships without
          multiple queries. This is powerful but requires understanding resource connections.
        </Typography>

        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="subtitle2">Chain Syntax:</Typography>
          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
            ?[parameter].[chainedParameter]=[value]
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            You can chain multiple levels: ?medication.manufacturer.name=value
          </Typography>
        </Alert>

        <Tabs value={chainExample} onChange={(e, v) => setChainExample(v)} sx={{ mb: 3 }}>
          <Tab label="Patient Name" value="patient-name" />
          <Tab label="Organization" value="practitioner-org" />
          <Tab label="Manufacturer" value="medication-manufacturer" />
        </Tabs>

        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            {currentExample.title}
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            {currentExample.explanation}
          </Typography>
          
          <Alert severity="success" sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
              {currentExample.query}
            </Typography>
          </Alert>

          <Button
            variant="contained"
            onClick={runChainQuery}
            disabled={loading}
            startIcon={<PlayIcon />}
          >
            {loading ? 'Running...' : 'Try Chain Query'}
          </Button>
        </Paper>

        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            onClick={onComplete}
            endIcon={<CheckCircleIcon />}
          >
            Complete This Step
          </Button>
        </Box>
      </Box>
    );
  };

  const ResourceIncludesTutorial = ({ onComplete }) => {
    const [includeType, setIncludeType] = useState('forward');
    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(false);

    const includeExamples = {
      forward: {
        title: 'Forward Includes (_include)',
        query: '/fhir/R4/MedicationRequest?_include=MedicationRequest:patient',
        explanation: 'Include the patient referenced by medication requests'
      },
      reverse: {
        title: 'Reverse Includes (_revinclude)',
        query: '/fhir/R4/Patient?_revinclude=Observation:patient',
        explanation: 'Include all observations that reference this patient'
      },
      multiple: {
        title: 'Multiple Includes',
        query: '/fhir/R4/Encounter?_include=Encounter:patient&_include=Encounter:practitioner',
        explanation: 'Include both patient and practitioner in one query'
      }
    };

    const runIncludeQuery = async () => {
      setLoading(true);
      try {
        const response = await api.get('/fhir/R4/Patient?_count=2');
        setResults(response.data);
      } catch (error) {
        setError('Include query failed');
      } finally {
        setLoading(false);
      }
    };

    const currentExample = includeExamples[includeType];

    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Resource Includes 📦
        </Typography>
        <Typography paragraph>
          _include and _revinclude parameters let you fetch related resources in a
          single query, reducing round trips and improving performance.
        </Typography>

        <Tabs value={includeType} onChange={(e, v) => setIncludeType(v)} sx={{ mb: 3 }}>
          <Tab label="Forward Include" value="forward" />
          <Tab label="Reverse Include" value="reverse" />
          <Tab label="Multiple Includes" value="multiple" />
        </Tabs>

        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            {currentExample.title}
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            {currentExample.explanation}
          </Typography>
          
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
              {currentExample.query}
            </Typography>
          </Alert>

          <Typography variant="subtitle2" gutterBottom>
            When to Use:
          </Typography>
          <List dense>
            <ListItem>
              <ListItemText primary="• Displaying patient with recent observations" />
            </ListItem>
            <ListItem>
              <ListItemText primary="• Showing medication requests with prescriber info" />
            </ListItem>
            <ListItem>
              <ListItemText primary="• Building comprehensive views efficiently" />
            </ListItem>
          </List>

          <Button
            variant="contained"
            onClick={runIncludeQuery}
            disabled={loading}
            startIcon={<PlayIcon />}
            sx={{ mt: 2 }}
          >
            {loading ? 'Loading...' : 'Try Include Query'}
          </Button>
        </Paper>

        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            onClick={onComplete}
            endIcon={<CheckCircleIcon />}
          >
            Complete This Step
          </Button>
        </Box>
      </Box>
    );
  };

  const CustomQueriesTutorial = ({ onComplete }) => {
    const [customQuery, setCustomQuery] = useState('/fhir/R4/');
    const [queryExplanation, setQueryExplanation] = useState('');
    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(false);

    const queryTemplates = [
      {
        name: 'Complex Date Range',
        query: '/fhir/R4/Procedure?date=ge2024-01-01&date=le2024-12-31&status=completed',
        explanation: 'Find completed procedures within a date range'
      },
      {
        name: 'Multi-Resource Search',
        query: '/fhir/R4/Patient?_has:Observation:patient:code=http://loinc.org|85354-9',
        explanation: 'Find patients who have blood pressure observations'
      },
      {
        name: 'Composite Search',
        query: '/fhir/R4/Observation?component-code-value-quantity=http://loinc.org|8480-6$gt90',
        explanation: 'Find observations where systolic BP > 90'
      }
    ];

    const runCustomQuery = async () => {
      if (!customQuery) return;
      setLoading(true);
      try {
        const response = await api.get(customQuery);
        setResults(response.data);
      } catch (error) {
        setError(`Query failed: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Custom Query Building 🛠️
        </Typography>
        <Typography paragraph>
          Now combine everything you've learned to build sophisticated queries
          for real-world scenarios.
        </Typography>

        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Query Templates
          </Typography>
          
          <Grid container spacing={2}>
            {queryTemplates.map((template, index) => (
              <Grid item xs={12} key={index}>
                <Card 
                  variant="outlined" 
                  sx={{ cursor: 'pointer' }}
                  onClick={() => {
                    setCustomQuery(template.query);
                    setQueryExplanation(template.explanation);
                  }}
                >
                  <CardContent>
                    <Typography variant="subtitle2" color="primary">
                      {template.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {template.explanation}
                    </Typography>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', mt: 1 }}>
                      {template.query}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Paper>

        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Build Your Query
          </Typography>
          
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Custom Query"
            value={customQuery}
            onChange={(e) => setCustomQuery(e.target.value)}
            helperText={queryExplanation || "Enter your custom FHIR query"}
            sx={{ mb: 2 }}
          />

          <Button
            variant="contained"
            onClick={runCustomQuery}
            disabled={loading || !customQuery}
            startIcon={<PlayIcon />}
          >
            {loading ? 'Running...' : 'Execute Query'}
          </Button>

          {results && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle2">
                Results: {results.total || 0} total, {results.entry?.length || 0} returned
              </Typography>
              <Accordion sx={{ mt: 2 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography>View Raw Response</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <SyntaxHighlighter language="json" style={docco}>
                    {JSON.stringify(results, null, 2)}
                  </SyntaxHighlighter>
                </AccordionDetails>
              </Accordion>
            </Box>
          )}
        </Paper>

        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            onClick={onComplete}
            endIcon={<CheckCircleIcon />}
          >
            Complete This Step
          </Button>
        </Box>
      </Box>
    );
  };

  const QueryOptimizationTutorial = ({ onComplete }) => {
    const [optimizationTopic, setOptimizationTopic] = useState('pagination');

    const optimizationTopics = {
      pagination: {
        title: 'Efficient Pagination',
        content: (
          <Box>
            <Typography variant="body1" paragraph>
              Large result sets require proper pagination for performance.
            </Typography>
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="subtitle2">Pagination Parameters:</Typography>
              <List dense>
                <ListItem>
                  <ListItemText primary="• _count: Number of results per page (default: 20)" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="• _offset: Skip this many results" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="• Bundle.link.relation='next': URL for next page" />
                </ListItem>
              </List>
            </Alert>
            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
              ?_count=50&_offset=100
            </Typography>
          </Box>
        )
      },
      performance: {
        title: 'Query Performance',
        content: (
          <Box>
            <Typography variant="body1" paragraph>
              Optimize queries for speed and efficiency.
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2" color="error">
                      ❌ Inefficient
                    </Typography>
                    <Typography variant="body2">
                      Multiple separate queries for related data
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2" color="success.main">
                      ✅ Efficient
                    </Typography>
                    <Typography variant="body2">
                      Use _include/_revinclude for one query
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>
        )
      },
      caching: {
        title: 'Caching Strategies',
        content: (
          <Box>
            <Typography variant="body1" paragraph>
              Implement smart caching for frequently accessed data.
            </Typography>
            <Alert severity="success" sx={{ mb: 2 }}>
              <Typography variant="subtitle2">Caching Tips:</Typography>
              <List dense>
                <ListItem>
                  <ListItemText primary="• Cache patient demographics (changes rarely)" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="• Don't cache observations (changes frequently)" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="• Use ETags for conditional requests" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="• Implement time-based cache expiration" />
                </ListItem>
              </List>
            </Alert>
          </Box>
        )
      }
    };

    const currentTopic = optimizationTopics[optimizationTopic];

    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Query Optimization ⚡
        </Typography>
        <Typography paragraph>
          Learn best practices for building performant FHIR queries that scale
          with your data.
        </Typography>

        <Tabs 
          value={optimizationTopic} 
          onChange={(e, v) => setOptimizationTopic(v)} 
          sx={{ mb: 3 }}
        >
          <Tab label="Pagination" value="pagination" />
          <Tab label="Performance" value="performance" />
          <Tab label="Caching" value="caching" />
        </Tabs>

        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            {currentTopic.title}
          </Typography>
          {currentTopic.content}
        </Paper>

        <Alert severity="warning">
          <Typography variant="subtitle2">⚠️ Common Pitfalls:</Typography>
          <List dense>
            <ListItem>
              <ListItemText primary="• Requesting too much data (_count=1000)" />
            </ListItem>
            <ListItem>
              <ListItemText primary="• Not using search parameters (downloading everything)" />
            </ListItem>
            <ListItem>
              <ListItemText primary="• Ignoring server hints (OperationOutcome warnings)" />
            </ListItem>
          </List>
        </Alert>

        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            onClick={onComplete}
            endIcon={<CheckCircleIcon />}
          >
            Complete Advanced Training
          </Button>
        </Box>
      </Box>
    );
  };

  // Enhanced Query Builder using imported components
  const EnhancedQueryBuilder = () => {
    const [selectedResourceType, setSelectedResourceType] = useState('');
    const [parameters, setParameters] = useState([]);

    const addParameter = () => {
      const newParam = {
        id: Date.now(),
        name: '',
        value: '',
        modifier: ''
      };
      setParameters([...parameters, newParam]);
    };

    const removeParameter = (paramId) => {
      setParameters(parameters.filter(p => p.id !== paramId));
    };

    const updateParameter = (paramId, updatedParam) => {
      setParameters(parameters.map(p => 
        p.id === paramId ? { ...p, ...updatedParam } : p
      ));
    };

    const handleTemplateSelect = (template) => {
      setSelectedResourceType(template.resourceType || 'Patient');
      setParameters(template.parameters.map((param, index) => ({
        id: Date.now() + index,
        name: param.name,
        value: param.value,
        modifier: param.modifier || ''
      })));
    };

    return (
      <Box>
        <Typography variant="h5" gutterBottom>
          Enhanced Query Builder 🔧
        </Typography>
        
        {/* Resource Type Selection */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            1. Choose a Resource Type
          </Typography>
          <Grid container spacing={2}>
            {Object.entries(RESOURCE_TYPES).map(([type, config]) => (
              <Grid item xs={12} sm={6} md={4} key={type}>
                <Card 
                  variant={selectedResourceType === type ? "outlined" : "elevation"}
                  sx={{ 
                    cursor: 'pointer',
                    border: selectedResourceType === type ? 2 : 0,
                    borderColor: selectedResourceType === type ? 'primary.main' : 'transparent'
                  }}
                  onClick={() => setSelectedResourceType(type)}
                >
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Avatar sx={{ bgcolor: config.color, mx: 'auto', mb: 1 }}>
                      {config.icon}
                    </Avatar>
                    <Typography variant="h6">{type}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {config.description}
                    </Typography>
                    <Chip 
                      size="small" 
                      label={config.difficulty}
                      color={config.difficulty === 'beginner' ? 'success' : 
                             config.difficulty === 'intermediate' ? 'warning' : 'error'}
                      sx={{ mt: 1 }}
                    />
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Paper>

        {/* Quick Templates */}
        {selectedResourceType && (
          <QuickQueryTemplates 
            resourceType={selectedResourceType}
            onSelectTemplate={handleTemplateSelect}
          />
        )}

        {/* Search Parameters */}
        {selectedResourceType && (
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              2. Configure Search Parameters
            </Typography>
            
            {parameters.map((param) => (
              <QueryParameter
                key={param.id}
                parameter={param}
                resourceType={selectedResourceType}
                onChange={(updatedParam) => updateParameter(param.id, updatedParam)}
                onRemove={() => removeParameter(param.id)}
              />
            ))}
            
            <Button 
              variant="outlined" 
              onClick={addParameter} 
              startIcon={<AddIcon />}
              sx={{ mt: 2 }}
            >
              Add Parameter
            </Button>
          </Paper>
        )}

        {/* Query Validation */}
        {selectedResourceType && (
          <Paper sx={{ p: 3, mb: 3 }}>
            <QueryValidator 
              query={{ parameters, resourceType: selectedResourceType }}
              resourceType={selectedResourceType}
            />
          </Paper>
        )}

        {/* Generated Query */}
        {selectedResourceType && (
          <Paper sx={{ p: 3 }}>
            <QueryURLGenerator
              resourceType={selectedResourceType}
              parameters={parameters}
              count={20}
            />
          </Paper>
        )}
      </Box>
    );
  };

  // Query execution
  const executeQuery = async (queryUrl) => {
    if (!queryUrl) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.get(queryUrl);
      setQueryResults(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Query execution failed');
    } finally {
      setLoading(false);
    }
  };

  // Results viewer
  const ResultsViewer = () => {
    if (!queryResults) return null;

    return (
      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          Query Results
        </Typography>
        
        <Box sx={{ mb: 2 }}>
          <Chip label={`${queryResults.total || 0} results`} color="primary" />
          <Chip 
            label={`${queryResults.entry?.length || 0} returned`} 
            variant="outlined" 
            sx={{ ml: 1 }} 
          />
        </Box>

        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography>View Raw JSON Response</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <SyntaxHighlighter 
              language="json" 
              style={docco}
              customStyle={{ maxHeight: '400px', overflow: 'auto' }}
            >
              {JSON.stringify(queryResults, null, 2)}
            </SyntaxHighlighter>
          </AccordionDetails>
        </Accordion>
      </Paper>
    );
  };

  // Main render
  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" gutterBottom>
          FHIR Explorer
        </Typography>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          Learn FHIR through guided exploration and hands-on query building
        </Typography>
        
        {/* Mode Selector */}
        <Tabs 
          value={currentMode} 
          onChange={(e, value) => setCurrentMode(value)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab 
            label="Learning Mode" 
            value="learning" 
            icon={<SchoolIcon />}
            iconPosition="start"
          />
          <Tab 
            label="Query Builder" 
            value="building" 
            icon={<BuildIcon />}
            iconPosition="start"
          />
          <Tab 
            label="Testing Ground" 
            value="testing" 
            icon={<VisibilityIcon />}
            iconPosition="start"
          />
        </Tabs>
      </Box>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Content based on current mode */}
      {currentMode === 'learning' && (
        <>
          {!currentPath && <LearningPathSelector />}
          {currentPath && (
            <LocalTutorialView 
              pathId={currentPath} 
              stepIndex={currentStep} 
            />
          )}
        </>
      )}

      {currentMode === 'building' && <EnhancedQueryBuilder />}

      {currentMode === 'testing' && <QueryPlayground />}

      {/* Results */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <CircularProgress />
        </Box>
      )}
      
      <ResultsViewer />

      {/* Tutorial Modal */}
      {activeTutorial && (
        <ImportedTutorial 
          tutorialId={activeTutorial.split('-')[0] === 'beginner' ? 'fhir-basics' : 
                      activeTutorial.split('-')[0] === 'clinical' ? 'clinical-scenarios' : 
                      'search-fundamentals'}
          onComplete={() => {
            setActiveTutorial(null);
            setCurrentMode('building');
          }}
          onClose={() => setActiveTutorial(null)}
        />
      )}
    </Box>
  );
}

export default FHIRExplorerRedesigned;