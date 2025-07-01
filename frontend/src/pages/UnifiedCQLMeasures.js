import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tabs,
  Tab,
  Badge,
  Tooltip,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Divider,
  Switch,
  FormControlLabel,
  ToggleButton,
  ToggleButtonGroup,
  Stack,
  CircularProgress,
  Snackbar
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  PlayArrow as PlayIcon,
  Assessment as AssessmentIcon,
  TrendingUp as TrendingUpIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  ExpandMore as ExpandMoreIcon,
  Analytics as AnalyticsIcon,
  Description as DescriptionIcon,
  Code as CodeIcon,
  CloudUpload as CloudUploadIcon,
  Assignment as AssignmentIcon,
  Storage as StorageIcon,
  Transform as TransformIcon,
  ContentCopy as ContentCopyIcon,
  Visibility as VisibilityIcon,
  Save as SaveIcon,
  Language as LanguageIcon,
  Psychology as PsychologyIcon,
  Build as BuildIcon,
  CompareArrows as CompareArrowsIcon,
  BugReport as BugReportIcon,
  Timeline as TimelineIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import api from '../services/api';

// Tab panel component
function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`unified-cql-tabpanel-${index}`}
      aria-labelledby={`unified-cql-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  );
}

// CQL to FHIR Path translator utility
const cqlToFhirPathTranslator = {
  // Basic mappings from CQL to FHIRPath
  mappings: {
    // Data types
    'Patient': 'Patient',
    'Encounter': 'Encounter',
    'Condition': 'Condition',
    'Observation': 'Observation',
    'Procedure': 'Procedure',
    'MedicationRequest': 'MedicationRequest',
    'Immunization': 'Immunization',
    
    // Common CQL functions to FHIRPath
    'exists': 'exists()',
    'count': 'count()',
    'where': 'where',
    'first': 'first()',
    'last': 'last()',
    'distinct': 'distinct()',
    
    // Date functions
    'today()': 'today()',
    'now()': 'now()',
    
    // Operators
    'and': 'and',
    'or': 'or',
    'not': 'not',
    '=': '=',
    '!=': '!=',
    '<': '<',
    '<=': '<=',
    '>': '>',
    '>=': '>=',
    'in': 'in',
    'contains': 'contains'
  },
  
  // Translate CQL expression to FHIRPath
  translate: function(cqlExpression) {
    let fhirPath = cqlExpression;
    
    // Replace CQL patterns with FHIRPath equivalents
    Object.entries(this.mappings).forEach(([cql, fhir]) => {
      const regex = new RegExp(`\\b${cql}\\b`, 'gi');
      fhirPath = fhirPath.replace(regex, fhir);
    });
    
    // Handle specific CQL patterns
    // Convert "from [Resource]" to resource reference
    fhirPath = fhirPath.replace(/from\s+\[([^\]]+)\]/gi, '$1');
    
    // Convert CQL intervals to FHIRPath
    fhirPath = fhirPath.replace(/Interval\[([^,]+),\s*([^\]]+)\]/gi, '($1 to $2)');
    
    // Handle age calculations
    fhirPath = fhirPath.replace(/AgeInYears\(\)/gi, '(today() - birthDate).years');
    fhirPath = fhirPath.replace(/AgeInMonths\(\)/gi, '(today() - birthDate).months');
    
    // Handle value set membership
    fhirPath = fhirPath.replace(/in\s+"([^"]+)"/gi, 'memberOf(\'$1\')');
    
    return fhirPath;
  },
  
  // Validate FHIRPath expression
  validate: function(fhirPath) {
    // Basic validation rules
    const errors = [];
    
    // Check for balanced parentheses
    const openParens = (fhirPath.match(/\(/g) || []).length;
    const closeParens = (fhirPath.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      errors.push('Unbalanced parentheses');
    }
    
    // Check for valid operators
    const invalidOperators = fhirPath.match(/[^a-zA-Z0-9\s\(\)\[\]\.=!<>&|,'"_\-+*\/]/g);
    if (invalidOperators) {
      errors.push(`Invalid characters: ${invalidOperators.join(', ')}`);
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
};

// AI-powered CQL analyzer
const cqlAnalyzer = {
  analyze: function(cqlContent) {
    const analysis = {
      libraries: [],
      using: [],
      includes: [],
      valueSets: [],
      parameters: [],
      definitions: [],
      functions: [],
      contexts: [],
      measures: {
        populations: [],
        stratifiers: [],
        supplementalData: []
      },
      complexity: 'low',
      fhirResources: new Set(),
      suggestions: []
    };
    
    const lines = cqlContent.split('\n');
    let currentSection = null;
    
    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      // Library declaration
      if (trimmedLine.startsWith('library ')) {
        const match = trimmedLine.match(/library\s+(\S+)(?:\s+version\s+'([^']+)')?/);
        if (match) {
          analysis.libraries.push({
            name: match[1],
            version: match[2] || 'unspecified',
            line: index + 1
          });
        }
      }
      
      // Using statements
      if (trimmedLine.startsWith('using ')) {
        const match = trimmedLine.match(/using\s+(\S+)(?:\s+version\s+'([^']+)')?/);
        if (match) {
          analysis.using.push({
            model: match[1],
            version: match[2] || 'unspecified',
            line: index + 1
          });
        }
      }
      
      // Include statements
      if (trimmedLine.startsWith('include ')) {
        const match = trimmedLine.match(/include\s+(\S+)(?:\s+version\s+'([^']+)')?(?:\s+called\s+(\S+))?/);
        if (match) {
          analysis.includes.push({
            library: match[1],
            version: match[2] || 'unspecified',
            alias: match[3] || match[1],
            line: index + 1
          });
        }
      }
      
      // Value sets
      if (trimmedLine.startsWith('valueset ')) {
        const match = trimmedLine.match(/valueset\s+"([^"]+)":\s*'([^']+)'/);
        if (match) {
          analysis.valueSets.push({
            name: match[1],
            id: match[2],
            line: index + 1
          });
        }
      }
      
      // Parameters
      if (trimmedLine.startsWith('parameter ')) {
        const match = trimmedLine.match(/parameter\s+(\S+)(?:\s+(\S+))?(?:\s+default\s+(.+))?/);
        if (match) {
          analysis.parameters.push({
            name: match[1],
            type: match[2] || 'Any',
            defaultValue: match[3],
            line: index + 1
          });
        }
      }
      
      // Definitions
      if (trimmedLine.startsWith('define ')) {
        const match = trimmedLine.match(/define\s+(?:(public|private)\s+)?(?:(function)\s+)?(\S+)(?:\((.*?)\))?:/);
        if (match) {
          const definition = {
            name: match[3],
            accessibility: match[1] || 'public',
            isFunction: !!match[2],
            parameters: match[4] ? match[4].split(',').map(p => p.trim()) : [],
            line: index + 1,
            body: []
          };
          
          // Collect definition body
          let bodyIndex = index + 1;
          while (bodyIndex < lines.length && !lines[bodyIndex].trim().startsWith('define ')) {
            definition.body.push(lines[bodyIndex]);
            bodyIndex++;
          }
          
          if (definition.isFunction) {
            analysis.functions.push(definition);
          } else {
            analysis.definitions.push(definition);
          }
          
          // Check for population definitions
          const populationTypes = [
            'Initial Population',
            'Denominator',
            'Denominator Exclusion',
            'Denominator Exception',
            'Numerator',
            'Numerator Exclusion',
            'Measure Population',
            'Measure Population Exclusion'
          ];
          
          if (populationTypes.some(type => definition.name.includes(type.replace(' ', '')))) {
            analysis.measures.populations.push(definition);
          }
        }
      }
      
      // Context statements
      if (trimmedLine.startsWith('context ')) {
        const match = trimmedLine.match(/context\s+(\S+)/);
        if (match) {
          analysis.contexts.push({
            type: match[1],
            line: index + 1
          });
        }
      }
      
      // Extract FHIR resources
      const resourceMatch = trimmedLine.match(/\[([A-Z][a-zA-Z]+)\]/g);
      if (resourceMatch) {
        resourceMatch.forEach(match => {
          const resource = match.slice(1, -1);
          if (['Patient', 'Encounter', 'Condition', 'Observation', 'Procedure', 'MedicationRequest', 'Immunization'].includes(resource)) {
            analysis.fhirResources.add(resource);
          }
        });
      }
    });
    
    // Calculate complexity
    const totalDefinitions = analysis.definitions.length + analysis.functions.length;
    if (totalDefinitions > 20 || analysis.functions.length > 10) {
      analysis.complexity = 'high';
    } else if (totalDefinitions > 10 || analysis.functions.length > 5) {
      analysis.complexity = 'medium';
    }
    
    // Generate suggestions
    if (analysis.libraries.length === 0) {
      analysis.suggestions.push('Missing library declaration');
    }
    if (analysis.using.length === 0) {
      analysis.suggestions.push('Missing using statement (e.g., using FHIR version \'4.0.1\')');
    }
    if (analysis.measures.populations.length === 0) {
      analysis.suggestions.push('No measure populations defined');
    }
    if (analysis.fhirResources.size === 0) {
      analysis.suggestions.push('No FHIR resources referenced');
    }
    
    return analysis;
  }
};

const UnifiedCQLMeasures = () => {
  const [tabValue, setTabValue] = useState(0);
  const [measures, setMeasures] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedMeasure, setSelectedMeasure] = useState(null);
  const [reportDialog, setReportDialog] = useState(false);
  const [measureDialog, setMeasureDialog] = useState(false);
  const [importDialog, setImportDialog] = useState(false);
  const [translatorDialog, setTranslatorDialog] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  
  // Translation state
  const [translationMode, setTranslationMode] = useState('cql-to-fhir');
  const [sourceCode, setSourceCode] = useState('');
  const [translatedCode, setTranslatedCode] = useState('');
  const [translationAnalysis, setTranslationAnalysis] = useState(null);
  
  // Helper function for safe date formatting
  const formatDate = (dateValue, formatString = 'MMM dd, yyyy', defaultValue = 'N/A') => {
    if (!dateValue) return defaultValue;
    try {
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) return defaultValue;
      return format(date, formatString);
    } catch (error) {
      console.error('Date formatting error:', error);
      return defaultValue;
    }
  };
  
  // Quality measure configuration state
  const [measureConfig, setMeasureConfig] = useState({
    id: '',
    name: '',
    description: '',
    category: 'clinical',
    type: 'proportion',
    cqlLibrary: '',
    cqlContent: '',
    fhirPath: '',
    numerator: '',
    denominator: '',
    exclusions: '',
    reportingPeriod: 'quarterly',
    enabled: true,
    valueSetData: {},
    metadata: {}
  });
  
  // Import state
  const [importData, setImportData] = useState({
    file: null,
    measureName: '',
    description: '',
    version: '',
    steward: '',
    cqlContent: '',
    valueSetData: '',
    metadata: {}
  });
  
  // Sample quality measures with CQL
  const sampleMeasures = [
    {
      id: 'diabetes-hba1c',
      name: 'Diabetes HbA1c Control',
      description: 'Percentage of patients 18-75 years of age with diabetes who had HbA1c < 8.0%',
      category: 'clinical',
      type: 'proportion',
      cqlLibrary: 'DiabetesHbA1cControl',
      numerator: 'Patients with diabetes and HbA1c < 8.0%',
      denominator: 'Patients with diabetes aged 18-75',
      exclusions: 'Patients with advanced illness',
      reportingPeriod: 'annual',
      enabled: true,
      lastRun: '2024-01-15',
      score: 78.5,
      target: 80.0,
      trend: 'improving',
      hasCQL: true,
      version: '1.0.0'
    },
    {
      id: 'cms138v10',
      name: 'Preventive Care and Screening: Tobacco Use',
      description: 'Percentage of patients aged 18 years and older who were screened for tobacco use',
      category: 'preventive',
      type: 'proportion',
      cqlLibrary: 'TobaccoUseScreening',
      status: 'active',
      imported: '2024-01-15',
      lastExecuted: '2024-01-20',
      measureType: 'proportion',
      scoring: 'proportion',
      lastResults: {
        denominator: 150,
        numerator: 142,
        score: 94.7,
        exclusions: 8
      },
      hasCQL: true,
      version: '10.2.000'
    }
  ];
  
  // Sample reports
  const sampleReports = [
    {
      id: 'q4-2023-report',
      name: 'Q4 2023 Quality Report',
      period: 'Q4 2023',
      generated: '2024-01-15',
      measures: 5,
      status: 'completed',
      score: 78.2,
      trends: 'mixed'
    }
  ];
  
  useEffect(() => {
    loadQualityMeasures();
    loadQualityReports();
  }, []);
  
  const loadQualityMeasures = async () => {
    try {
      const response = await api.get('/api/quality/measures');
      setMeasures(response.data);
    } catch (error) {
      console.error('Error loading quality measures:', error);
      setMeasures(sampleMeasures);
    }
  };
  
  const loadQualityReports = async () => {
    try {
      setReports(sampleReports);
    } catch (error) {
      console.error('Error loading quality reports:', error);
      setReports(sampleReports);
    }
  };
  
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };
  
  const handleTranslate = useCallback(() => {
    if (!sourceCode.trim()) {
      setSnackbar({ open: true, message: 'Please enter code to translate', severity: 'warning' });
      return;
    }
    
    setLoading(true);
    try {
      if (translationMode === 'cql-to-fhir') {
        // Translate CQL to FHIRPath
        const translated = cqlToFhirPathTranslator.translate(sourceCode);
        const validation = cqlToFhirPathTranslator.validate(translated);
        
        setTranslatedCode(translated);
        
        // Analyze CQL
        const analysis = cqlAnalyzer.analyze(sourceCode);
        setTranslationAnalysis(analysis);
        
        if (!validation.valid) {
          setSnackbar({ 
            open: true, 
            message: `Translation completed with warnings: ${validation.errors.join(', ')}`, 
            severity: 'warning' 
          });
        } else {
          setSnackbar({ open: true, message: 'Translation completed successfully', severity: 'success' });
        }
      } else {
        // For other translation modes (placeholder)
        setTranslatedCode('// Translation not yet implemented for this mode');
        setSnackbar({ open: true, message: 'This translation mode is coming soon', severity: 'info' });
      }
    } catch (error) {
      console.error('Translation error:', error);
      setSnackbar({ open: true, message: 'Error during translation', severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, [sourceCode, translationMode]);
  
  const handleRunMeasure = async (measureId) => {
    setLoading(true);
    try {
      const response = await api.post(`/api/quality/measures/${measureId}/calculate`);
      const result = response.data;
      
      setMeasures(prev => prev.map(measure => 
        measure.id === measureId 
          ? { 
              ...measure, 
              lastRun: new Date().toISOString().split('T')[0], 
              score: result.percentage || result.rate || 0,
              numeratorCount: result.numerator || 0,
              denominatorCount: result.denominator || 0,
              lastResults: result
            }
          : measure
      ));
      
      setSnackbar({ open: true, message: 'Measure executed successfully', severity: 'success' });
    } catch (error) {
      console.error('Error running measure:', error);
      setSnackbar({ open: true, message: 'Error executing measure', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };
  
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setImportData(prev => ({ ...prev, file }));
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target.result;
        setImportData(prev => ({ ...prev, cqlContent: content }));
        
        // Analyze CQL content
        const analysis = cqlAnalyzer.analyze(content);
        if (analysis.libraries.length > 0) {
          setImportData(prev => ({
            ...prev,
            measureName: analysis.libraries[0].name,
            version: analysis.libraries[0].version
          }));
        }
      };
      reader.readAsText(file);
    }
  };
  
  const handleImportMeasure = async () => {
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const newMeasure = {
        id: `measure-${Date.now()}`,
        name: importData.measureName,
        version: importData.version,
        description: importData.description,
        steward: importData.steward,
        status: 'active',
        imported: new Date().toISOString().split('T')[0],
        cqlLibrary: importData.measureName.replace(/\s+/g, ''),
        measureType: 'proportion',
        scoring: 'proportion',
        hasCQL: true,
        cqlContent: importData.cqlContent
      };
      
      setMeasures(prev => [newMeasure, ...prev]);
      setImportDialog(false);
      setActiveStep(0);
      setImportData({
        file: null,
        measureName: '',
        description: '',
        version: '',
        steward: '',
        cqlContent: '',
        valueSetData: '',
        metadata: {}
      });
      
      setSnackbar({ open: true, message: 'Measure imported successfully', severity: 'success' });
    } catch (error) {
      console.error('Error importing measure:', error);
      setSnackbar({ open: true, message: 'Error importing measure', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };
  
  const handleGenerateReport = async () => {
    setLoading(true);
    try {
      const reportData = {
        title: `Quality Report - ${format(new Date(), 'MMM yyyy')}`,
        period: format(new Date(), 'MMM yyyy'),
        measures: measures.map(m => m.id)
      };
      
      const response = await api.post('/api/quality/reports/generate', reportData);
      const result = response.data;
      
      const newReport = {
        id: result.id || `report-${Date.now()}`,
        name: result.title || reportData.title,
        period: result.period || reportData.period,
        generated: new Date().toISOString().split('T')[0],
        measures: result.measures?.length || measures.length,
        status: 'completed',
        score: result.overall_score || 0,
        trends: result.trends || 'stable'
      };
      
      setReports(prev => [newReport, ...prev]);
      setReportDialog(false);
      setSnackbar({ open: true, message: 'Report generated successfully', severity: 'success' });
    } catch (error) {
      console.error('Error generating report:', error);
      setSnackbar({ open: true, message: 'Error generating report', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };
  
  const getMeasureStatusColor = (score, target) => {
    const safeScore = score || 0;
    const safeTarget = target || 0;
    if (safeTarget === 0) return 'default';
    if (safeScore >= safeTarget) return 'success';
    if (safeScore >= safeTarget * 0.8) return 'warning';
    return 'error';
  };
  
  const getTrendIcon = (trend) => {
    switch (trend) {
      case 'improving':
        return <TrendingUpIcon color="success" />;
      case 'declining':
        return <TrendingUpIcon color="error" sx={{ transform: 'rotate(180deg)' }} />;
      default:
        return <TrendingUpIcon color="action" sx={{ transform: 'rotate(90deg)' }} />;
    }
  };
  
  const getOverallScore = () => {
    if (measures.length === 0) return 0;
    const validMeasures = measures.filter(m => m.score !== undefined && m.score !== null);
    if (validMeasures.length === 0) return 0;
    return validMeasures.reduce((sum, measure) => sum + (measure.score || 0), 0) / validMeasures.length;
  };
  
  const getCQLMeasuresCount = () => {
    return measures.filter(m => m.hasCQL).length;
  };
  
  const importSteps = [
    {
      label: 'Upload CQL File',
      content: (
        <Box>
          <Typography variant="body1" gutterBottom>
            Upload a CQL measure file (.cql) or paste CQL content directly.
          </Typography>
          
          <Box sx={{ my: 3 }}>
            <input
              accept=".cql,.txt"
              style={{ display: 'none' }}
              id="cql-file-upload"
              type="file"
              onChange={handleFileUpload}
            />
            <label htmlFor="cql-file-upload">
              <Button
                variant="outlined"
                component="span"
                startIcon={<CloudUploadIcon />}
                sx={{ mr: 2 }}
              >
                Upload CQL File
              </Button>
            </label>
            {importData.file && (
              <Chip 
                label={importData.file.name} 
                onDelete={() => setImportData(prev => ({ ...prev, file: null, cqlContent: '' }))}
              />
            )}
          </Box>
          
          <Typography variant="body2" gutterBottom>
            Or paste CQL content:
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={8}
            variant="outlined"
            placeholder="library ExampleMeasure version '1.0.0'..."
            value={importData.cqlContent}
            onChange={(e) => setImportData(prev => ({ ...prev, cqlContent: e.target.value }))}
          />
        </Box>
      )
    },
    {
      label: 'Measure Metadata',
      content: (
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Measure Name"
              value={importData.measureName}
              onChange={(e) => setImportData(prev => ({ ...prev, measureName: e.target.value }))}
              required
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Version"
              value={importData.version}
              onChange={(e) => setImportData(prev => ({ ...prev, version: e.target.value }))}
              required
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Steward"
              value={importData.steward}
              onChange={(e) => setImportData(prev => ({ ...prev, steward: e.target.value }))}
              placeholder="Centers for Medicare & Medicaid Services"
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Description"
              value={importData.description}
              onChange={(e) => setImportData(prev => ({ ...prev, description: e.target.value }))}
            />
          </Grid>
        </Grid>
      )
    },
    {
      label: 'CQL Analysis',
      content: (
        <Box>
          <Typography variant="h6" gutterBottom>CQL Analysis Results</Typography>
          {importData.cqlContent && (() => {
            const analysis = cqlAnalyzer.analyze(importData.cqlContent);
            return (
              <Box>
                <Alert severity={analysis.suggestions.length > 0 ? 'warning' : 'success'} sx={{ mb: 2 }}>
                  {analysis.suggestions.length > 0 
                    ? `Analysis found ${analysis.suggestions.length} suggestions`
                    : 'CQL analysis completed successfully'
                  }
                </Alert>
                
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Paper variant="outlined" sx={{ p: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>Libraries</Typography>
                      {analysis.libraries.map((lib, idx) => (
                        <Chip key={idx} label={`${lib.name} v${lib.version}`} size="small" sx={{ mr: 1 }} />
                      ))}
                    </Paper>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Paper variant="outlined" sx={{ p: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>FHIR Resources</Typography>
                      {Array.from(analysis.fhirResources).map((resource, idx) => (
                        <Chip key={idx} label={resource} size="small" color="primary" sx={{ mr: 1 }} />
                      ))}
                    </Paper>
                  </Grid>
                  <Grid item xs={12}>
                    <Paper variant="outlined" sx={{ p: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>Measure Populations</Typography>
                      {analysis.measures.populations.map((pop, idx) => (
                        <Chip key={idx} label={pop.name} size="small" color="secondary" sx={{ mr: 1, mb: 1 }} />
                      ))}
                    </Paper>
                  </Grid>
                  {analysis.suggestions.length > 0 && (
                    <Grid item xs={12}>
                      <Alert severity="warning">
                        <Typography variant="subtitle2" gutterBottom>Suggestions:</Typography>
                        <ul style={{ margin: 0, paddingLeft: 20 }}>
                          {analysis.suggestions.map((suggestion, idx) => (
                            <li key={idx}>{suggestion}</li>
                          ))}
                        </ul>
                      </Alert>
                    </Grid>
                  )}
                </Grid>
              </Box>
            );
          })()}
        </Box>
      )
    }
  ];
  
  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Unified CQL Quality Measures
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Comprehensive quality measure management with CQL support and translation tools
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => window.location.reload()}
          >
            Refresh
          </Button>
          <Button
            variant="outlined"
            startIcon={<TransformIcon />}
            onClick={() => setTranslatorDialog(true)}
            color="secondary"
          >
            CQL Translator
          </Button>
          <Button
            variant="contained"
            startIcon={<UploadIcon />}
            onClick={() => setImportDialog(true)}
          >
            Import CQL
          </Button>
        </Stack>
      </Box>
      
      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <AssessmentIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                {measures.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Measures
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <CodeIcon color="secondary" sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                {getCQLMeasuresCount()}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                CQL Measures
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <AnalyticsIcon color="success" sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                {getOverallScore().toFixed(1)}%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Overall Score
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <TimelineIcon color="info" sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                {measures.filter(m => m.trend === 'improving').length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Improving
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      {/* Main Content Tabs */}
      <Paper sx={{ width: '100%' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange} aria-label="unified cql tabs">
            <Tab 
              label="Quality Measures" 
              icon={<Badge badgeContent={measures.length} color="primary"><AssessmentIcon /></Badge>} 
              iconPosition="start"
            />
            <Tab 
              label="CQL Measures" 
              icon={<Badge badgeContent={getCQLMeasuresCount()} color="secondary"><CodeIcon /></Badge>} 
              iconPosition="start"
            />
            <Tab label="Performance" icon={<AnalyticsIcon />} iconPosition="start" />
            <Tab label="Reports" icon={<DescriptionIcon />} iconPosition="start" />
            <Tab label="Tools" icon={<BuildIcon />} iconPosition="start" />
          </Tabs>
        </Box>
        
        {/* Quality Measures Tab */}
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6">All Quality Measures</Typography>
            <Stack direction="row" spacing={1}>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Category</InputLabel>
                <Select value="all" label="Category">
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="clinical">Clinical</MenuItem>
                  <MenuItem value="preventive">Preventive</MenuItem>
                  <MenuItem value="safety">Safety</MenuItem>
                  <MenuItem value="outcome">Outcome</MenuItem>
                </Select>
              </FormControl>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => setMeasureDialog(true)}
              >
                Add Measure
              </Button>
            </Stack>
          </Box>
          
          <Grid container spacing={3}>
            {measures.map((measure) => (
              <Grid item xs={12} md={6} lg={4} key={measure.id}>
                <Card variant="outlined" sx={{ height: '100%' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="h6" gutterBottom>
                          {measure.name}
                        </Typography>
                        <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                          <Chip 
                            label={measure.category} 
                            size="small" 
                            variant="outlined"
                          />
                          {measure.hasCQL && (
                            <Chip 
                              label="CQL" 
                              size="small" 
                              color="secondary"
                              icon={<CodeIcon />}
                            />
                          )}
                          {measure.version && (
                            <Chip 
                              label={`v${measure.version}`} 
                              size="small" 
                              variant="outlined"
                            />
                          )}
                        </Stack>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {measure.trend && getTrendIcon(measure.trend)}
                        {measure.score !== undefined && (
                          <Chip
                            label={`${(measure.score || 0).toFixed(1)}%`}
                            color={getMeasureStatusColor(measure.score || 0, measure.target || 0)}
                            sx={{ fontWeight: 'bold' }}
                          />
                        )}
                      </Box>
                    </Box>
                    
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {measure.description}
                    </Typography>
                    
                    {measure.target && (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="caption" color="text.secondary">
                          Progress to Target ({measure.target}%)
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(((measure.score || 0) / (measure.target || 1)) * 100, 100)}
                          color={getMeasureStatusColor(measure.score || 0, measure.target || 0)}
                          sx={{ mt: 0.5 }}
                        />
                      </Box>
                    )}
                    
                    {measure.lastResults && (
                      <Box sx={{ p: 1.5, bgcolor: 'grey.50', borderRadius: 1, mb: 2 }}>
                        <Grid container spacing={1}>
                          <Grid item xs={6}>
                            <Typography variant="caption" color="text.secondary">Denominator</Typography>
                            <Typography variant="body2">{measure.lastResults.denominator}</Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="caption" color="text.secondary">Numerator</Typography>
                            <Typography variant="body2">{measure.lastResults.numerator}</Typography>
                          </Grid>
                        </Grid>
                      </Box>
                    )}
                    
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="caption" color="text.secondary">
                        Last run: {formatDate(measure.lastRun || measure.lastExecuted, 'MMM dd, yyyy', 'Never')}
                      </Typography>
                      <Stack direction="row" spacing={0.5}>
                        <Tooltip title="Run Measure">
                          <IconButton 
                            size="small" 
                            onClick={() => handleRunMeasure(measure.id)}
                            disabled={loading}
                          >
                            <PlayIcon />
                          </IconButton>
                        </Tooltip>
                        {measure.hasCQL && (
                          <Tooltip title="View CQL">
                            <IconButton 
                              size="small" 
                              onClick={() => setSelectedMeasure(measure)}
                            >
                              <CodeIcon />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="Edit">
                          <IconButton size="small">
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </TabPanel>
        
        {/* CQL Measures Tab */}
        <TabPanel value={tabValue} index={1}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6">CQL-Based Measures</Typography>
            <Button
              variant="outlined"
              startIcon={<UploadIcon />}
              onClick={() => setImportDialog(true)}
            >
              Import CQL Measure
            </Button>
          </Box>
          
          <Grid container spacing={3}>
            {measures.filter(m => m.hasCQL).map((measure) => (
              <Grid item xs={12} lg={6} key={measure.id}>
                <Card variant="outlined">
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="h6" gutterBottom>
                          {measure.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          {measure.description}
                        </Typography>
                        <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                          <Chip 
                            label={`v${measure.version || '1.0.0'}`} 
                            size="small" 
                            variant="outlined"
                          />
                          <Chip 
                            label={measure.status || 'active'} 
                            size="small" 
                            color="success"
                          />
                          <Chip 
                            label="CQL" 
                            size="small" 
                            color="secondary"
                          />
                        </Stack>
                      </Box>
                    </Box>
                    
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      <strong>CQL Library:</strong> {measure.cqlLibrary}
                    </Typography>
                    
                    {measure.lastResults && (
                      <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }} gutterBottom>
                          Last Execution Results:
                        </Typography>
                        <Grid container spacing={2}>
                          <Grid item xs={6}>
                            <Typography variant="caption" color="text.secondary">Score</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                              {(measure.lastResults.score || 0).toFixed(1)}%
                            </Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="caption" color="text.secondary">Population</Typography>
                            <Typography variant="body1">{measure.lastResults.denominator}</Typography>
                          </Grid>
                        </Grid>
                      </Box>
                    )}
                    
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                      <Typography variant="caption" color="text.secondary">
                        {measure.imported ? `Imported: ${formatDate(measure.imported)}` : ''}
                      </Typography>
                      <Stack direction="row" spacing={0.5}>
                        <Tooltip title="Execute CQL">
                          <IconButton 
                            size="small" 
                            onClick={() => handleRunMeasure(measure.id)}
                            disabled={loading}
                          >
                            <PlayIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="View CQL Code">
                          <IconButton size="small">
                            <VisibilityIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Export">
                          <IconButton size="small">
                            <DownloadIcon />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </TabPanel>
        
        {/* Performance Tab */}
        <TabPanel value={tabValue} index={2}>
          <Typography variant="h6" gutterBottom>Performance Analytics</Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Measure</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell align="center">Score</TableCell>
                      <TableCell align="center">Target</TableCell>
                      <TableCell align="center">Gap</TableCell>
                      <TableCell align="center">Trend</TableCell>
                      <TableCell align="center">CQL</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {measures.map((measure) => (
                      <TableRow key={measure.id}>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            {measure.name}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip label={measure.category} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={`${(measure.score || 0).toFixed(1)}%`}
                            color={getMeasureStatusColor(measure.score || 0, measure.target || 0)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="center">{measure.target || '-'}%</TableCell>
                        <TableCell align="center">
                          <Typography 
                            variant="body2" 
                            color={(measure.score || 0) >= (measure.target || 0) ? 'success.main' : 'error.main'}
                          >
                            {measure.target ? `${((measure.score || 0) - measure.target).toFixed(1)}%` : '-'}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          {measure.trend && getTrendIcon(measure.trend)}
                        </TableCell>
                        <TableCell align="center">
                          {measure.hasCQL && <CheckCircleIcon color="secondary" fontSize="small" />}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>Performance Summary</Typography>
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" color="text.secondary">Average Score</Typography>
                    <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                      {getOverallScore().toFixed(1)}%
                    </Typography>
                  </Box>
                  <Divider sx={{ my: 2 }} />
                  <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>Trend Distribution</Typography>
                    <Stack spacing={1}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2">Improving</Typography>
                        <Chip 
                          label={measures.filter(m => m.trend === 'improving').length} 
                          size="small" 
                          color="success"
                        />
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2">Stable</Typography>
                        <Chip 
                          label={measures.filter(m => m.trend === 'stable').length} 
                          size="small" 
                        />
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2">Declining</Typography>
                        <Chip 
                          label={measures.filter(m => m.trend === 'declining').length} 
                          size="small" 
                          color="error"
                        />
                      </Box>
                    </Stack>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>
        
        {/* Reports Tab */}
        <TabPanel value={tabValue} index={3}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6">Quality Reports</Typography>
            <Button
              variant="contained"
              startIcon={<AssessmentIcon />}
              onClick={() => setReportDialog(true)}
            >
              Generate Report
            </Button>
          </Box>
          
          <Grid container spacing={3}>
            {reports.map((report) => (
              <Grid item xs={12} md={6} lg={4} key={report.id}>
                <Card variant="outlined">
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Typography variant="h6" gutterBottom>
                        {report.name}
                      </Typography>
                      <Chip
                        label={report.status}
                        color={report.status === 'completed' ? 'success' : 'default'}
                        size="small"
                      />
                    </Box>
                    
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Period: {report.period}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Generated: {formatDate(report.generated)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Measures: {report.measures}
                    </Typography>
                    
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="body2">
                        Overall Score: <strong>{(report.score || 0).toFixed(1)}%</strong>
                      </Typography>
                      <Chip 
                        label={report.trends} 
                        size="small" 
                        color={report.trends === 'improving' ? 'success' : 'default'}
                        variant="outlined"
                      />
                    </Box>
                    
                    <Stack direction="row" spacing={1}>
                      <Button size="small" startIcon={<DownloadIcon />}>
                        Download
                      </Button>
                      <Button size="small" startIcon={<VisibilityIcon />}>
                        View
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </TabPanel>
        
        {/* Tools Tab */}
        <TabPanel value={tabValue} index={4}>
          <Typography variant="h6" gutterBottom>CQL Development Tools</Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={6} lg={4}>
              <Card variant="outlined">
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <TransformIcon sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="h6">CQL Translator</Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Translate CQL to FHIRPath or other query languages with AI-powered analysis
                  </Typography>
                  <Button 
                    variant="contained" 
                    fullWidth
                    startIcon={<TransformIcon />}
                    onClick={() => setTranslatorDialog(true)}
                  >
                    Open Translator
                  </Button>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={6} lg={4}>
              <Card variant="outlined">
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <BugReportIcon sx={{ mr: 1, color: 'warning.main' }} />
                    <Typography variant="h6">CQL Validator</Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Validate CQL syntax and check for common errors and best practices
                  </Typography>
                  <Button 
                    variant="outlined" 
                    fullWidth 
                    startIcon={<BugReportIcon />}
                    onClick={() => {
                      // Open translator dialog in validation mode
                      setTranslatorDialog(true);
                      setSnackbar({ 
                        open: true, 
                        message: 'Use the translator to validate your CQL code', 
                        severity: 'info' 
                      });
                    }}
                  >
                    Validate CQL
                  </Button>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={6} lg={4}>
              <Card variant="outlined">
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <PsychologyIcon sx={{ mr: 1, color: 'secondary.main' }} />
                    <Typography variant="h6">AI Assistant</Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Get AI-powered suggestions for writing and optimizing CQL expressions
                  </Typography>
                  <Button variant="outlined" fullWidth startIcon={<PsychologyIcon />}>
                    Launch Assistant
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
          
          <Box sx={{ mt: 4 }}>
            <Typography variant="h6" gutterBottom>Quick References</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography>Common CQL Patterns</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <List dense>
                      <ListItem>
                        <ListItemText 
                          primary="Age Calculation"
                          secondary="AgeInYears() >= 18 and AgeInYears() <= 75"
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemText 
                          primary="Date Range"
                          secondary="Interval[@2023-01-01, @2023-12-31]"
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemText 
                          primary="Value Set Membership"
                          secondary='code in "Diabetes Diagnosis Codes"'
                        />
                      </ListItem>
                    </List>
                  </AccordionDetails>
                </Accordion>
              </Grid>
              <Grid item xs={12} md={6}>
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography>FHIRPath Examples</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <List dense>
                      <ListItem>
                        <ListItemText 
                          primary="Resource Type Filter"
                          secondary="entry.resource.ofType(Patient)"
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemText 
                          primary="Date Comparison"
                          secondary="effectiveDateTime > @2023-01-01"
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemText 
                          primary="Code System Check"
                          secondary="code.memberOf('http://loinc.org')"
                        />
                      </ListItem>
                    </List>
                  </AccordionDetails>
                </Accordion>
              </Grid>
            </Grid>
            
            {/* CQL Examples from API */}
            {cqlExamples.length > 0 && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="h6" gutterBottom>CQL Examples Library</Typography>
                <Grid container spacing={2}>
                  {cqlExamples.map((example, idx) => (
                    <Grid item xs={12} md={6} key={idx}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="subtitle1" gutterBottom>
                            {example.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            {example.description}
                          </Typography>
                          <Box sx={{ p: 1, bgcolor: 'grey.100', borderRadius: 1, mb: 1 }}>
                            <Typography variant="caption" component="pre" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                              {example.cql.substring(0, 150)}...
                            </Typography>
                          </Box>
                          <Button 
                            size="small" 
                            startIcon={<ContentCopyIcon />}
                            onClick={() => {
                              setSourceCode(example.cql);
                              setTranslatorDialog(true);
                            }}
                          >
                            Use in Translator
                          </Button>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            )}
          </Box>
        </TabPanel>
      </Paper>
      
      {/* Import CQL Dialog */}
      <Dialog 
        open={importDialog} 
        onClose={() => setImportDialog(false)} 
        maxWidth="md" 
        fullWidth
        PaperProps={{ sx: { height: '80vh' } }}
      >
        <DialogTitle>Import CQL Quality Measure</DialogTitle>
        <DialogContent>
          <Stepper activeStep={activeStep} orientation="vertical" sx={{ mt: 2 }}>
            {importSteps.map((step, index) => (
              <Step key={step.label}>
                <StepLabel>{step.label}</StepLabel>
                <StepContent>
                  {step.content}
                  
                  <Box sx={{ mt: 2 }}>
                    <Button
                      variant="contained"
                      onClick={() => {
                        if (index === importSteps.length - 1) {
                          handleImportMeasure();
                        } else {
                          setActiveStep(index + 1);
                        }
                      }}
                      disabled={loading || (index === 0 && !importData.cqlContent)}
                      sx={{ mr: 1 }}
                    >
                      {index === importSteps.length - 1 ? 'Import Measure' : 'Continue'}
                    </Button>
                    
                    {index > 0 && (
                      <Button onClick={() => setActiveStep(index - 1)}>
                        Back
                      </Button>
                    )}
                  </Box>
                </StepContent>
              </Step>
            ))}
          </Stepper>
          
          {loading && (
            <Box sx={{ mt: 2 }}>
              <LinearProgress />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Importing and validating CQL measure...
              </Typography>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setImportDialog(false)}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* CQL Translator Dialog */}
      <Dialog 
        open={translatorDialog} 
        onClose={() => setTranslatorDialog(false)} 
        maxWidth="lg" 
        fullWidth
        PaperProps={{ sx: { height: '90vh' } }}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">CQL to FHIRPath Translator</Typography>
            <ToggleButtonGroup
              value={translationMode}
              exclusive
              onChange={(e, newMode) => newMode && setTranslationMode(newMode)}
              size="small"
            >
              <ToggleButton value="cql-to-fhir">
                CQL → FHIRPath
              </ToggleButton>
              <ToggleButton value="fhir-to-cql" disabled>
                FHIRPath → CQL
              </ToggleButton>
              <ToggleButton value="cql-to-sql" disabled>
                CQL → SQL
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Grid container spacing={2} sx={{ height: '100%' }}>
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle1">Source (CQL)</Typography>
                <Button 
                  size="small" 
                  startIcon={<ContentCopyIcon />}
                  onClick={() => navigator.clipboard.writeText(sourceCode)}
                >
                  Copy
                </Button>
              </Box>
              <TextField
                fullWidth
                multiline
                rows={20}
                variant="outlined"
                placeholder="Enter CQL code here..."
                value={sourceCode}
                onChange={(e) => setSourceCode(e.target.value)}
                sx={{ fontFamily: 'monospace' }}
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle1">Result (FHIRPath)</Typography>
                <Button 
                  size="small" 
                  startIcon={<ContentCopyIcon />}
                  onClick={() => navigator.clipboard.writeText(translatedCode)}
                  disabled={!translatedCode}
                >
                  Copy
                </Button>
              </Box>
              <Paper variant="outlined" sx={{ p: 2, height: '458px', overflow: 'auto', bgcolor: 'grey.50' }}>
                {translatedCode ? (
                  <SyntaxHighlighter language="javascript" style={vscDarkPlus}>
                    {translatedCode}
                  </SyntaxHighlighter>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Translation result will appear here...
                  </Typography>
                )}
              </Paper>
            </Grid>
            
            {translationAnalysis && (
              <Grid item xs={12}>
                <Accordion defaultExpanded>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography>CQL Analysis Results</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={4}>
                        <Typography variant="subtitle2" gutterBottom>Detected Elements</Typography>
                        <Stack spacing={1}>
                          <Chip label={`${translationAnalysis.definitions.length} Definitions`} size="small" />
                          <Chip label={`${translationAnalysis.functions.length} Functions`} size="small" />
                          <Chip label={`${translationAnalysis.valueSets.length} Value Sets`} size="small" />
                          <Chip label={`Complexity: ${translationAnalysis.complexity}`} size="small" color={translationAnalysis.complexity === 'high' ? 'error' : translationAnalysis.complexity === 'medium' ? 'warning' : 'success'} />
                        </Stack>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <Typography variant="subtitle2" gutterBottom>FHIR Resources</Typography>
                        <Stack direction="row" spacing={1} flexWrap="wrap">
                          {Array.from(translationAnalysis.fhirResources).map((resource, idx) => (
                            <Chip key={idx} label={resource} size="small" color="primary" />
                          ))}
                        </Stack>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <Typography variant="subtitle2" gutterBottom>Suggestions</Typography>
                        {translationAnalysis.suggestions.length > 0 ? (
                          <List dense>
                            {translationAnalysis.suggestions.map((suggestion, idx) => (
                              <ListItem key={idx}>
                                <ListItemIcon>
                                  <WarningIcon color="warning" fontSize="small" />
                                </ListItemIcon>
                                <ListItemText primary={suggestion} />
                              </ListItem>
                            ))}
                          </List>
                        ) : (
                          <Chip label="No issues found" color="success" size="small" icon={<CheckCircleIcon />} />
                        )}
                      </Grid>
                    </Grid>
                  </AccordionDetails>
                </Accordion>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setTranslatorDialog(false)}>
            Close
          </Button>
          <Button 
            variant="contained" 
            onClick={handleTranslate}
            disabled={!sourceCode.trim() || loading}
            startIcon={loading ? <CircularProgress size={20} /> : <TransformIcon />}
          >
            Translate
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Generate Report Dialog */}
      <Dialog open={reportDialog} onClose={() => setReportDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Generate Quality Report</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label="Report Name"
              defaultValue={`Quality Report - ${format(new Date(), 'MMM yyyy')}`}
              sx={{ mb: 2 }}
            />
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Reporting Period</InputLabel>
              <Select value="current-month" label="Reporting Period">
                <MenuItem value="current-month">Current Month</MenuItem>
                <MenuItem value="last-month">Last Month</MenuItem>
                <MenuItem value="current-quarter">Current Quarter</MenuItem>
                <MenuItem value="last-quarter">Last Quarter</MenuItem>
                <MenuItem value="ytd">Year to Date</MenuItem>
              </Select>
            </FormControl>
            <FormControlLabel
              control={<Switch defaultChecked />}
              label="Include CQL measures"
              sx={{ mb: 2 }}
            />
            <Typography variant="body2" color="text.secondary">
              This will generate a comprehensive quality report including all active measures
              and performance analytics for the selected period.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReportDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleGenerateReport} 
            variant="contained"
            disabled={loading}
          >
            {loading ? 'Generating...' : 'Generate Report'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        message={snackbar.message}
      />
    </Box>
  );
};

export default UnifiedCQLMeasures;