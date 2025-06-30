import React, { useState, useEffect } from 'react';
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
  Alert,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  LinearProgress,
  Tooltip
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  PlayArrow as PlayIcon,
  Upload as UploadIcon,
  Download as DownloadIcon,
  Code as CodeIcon,
  Description as DescriptionIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  ExpandMore as ExpandMoreIcon,
  CloudUpload as CloudUploadIcon,
  Assignment as AssignmentIcon,
  Storage as StorageIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import api from '../services/api';

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`cql-tabpanel-${index}`}
      aria-labelledby={`cql-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  );
}

const CQLMeasures = () => {
  const [tabValue, setTabValue] = useState(0);
  const [measures, setMeasures] = useState([]);
  const [selectedMeasure, setSelectedMeasure] = useState(null);
  const [importDialog, setImportDialog] = useState(false);
  const [executionResults, setExecutionResults] = useState({});
  const [loading, setLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

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

  // Sample CQL measures
  const sampleMeasures = [
    {
      id: 'cms138v10',
      name: 'Preventive Care and Screening: Tobacco Use: Screening and Cessation Intervention',
      version: '10.2.000',
      steward: 'Centers for Medicare & Medicaid Services',
      description: 'Percentage of patients aged 18 years and older who were screened for tobacco use one or more times within 24 months',
      status: 'active',
      imported: '2024-01-15',
      lastExecuted: '2024-01-20',
      cqlLibrary: 'TobaccoUseScreeningAndCessationIntervention',
      measureType: 'proportion',
      scoring: 'proportion',
      populations: {
        initialPopulation: 'Initial Population',
        denominator: 'Denominator',
        numerator: 'Numerator',
        exclusions: 'Denominator Exclusions'
      },
      lastResults: {
        denominator: 150,
        numerator: 142,
        score: 94.7,
        exclusions: 8
      }
    },
    {
      id: 'cms146v10',
      name: 'Appropriate Testing for Children with Pharyngitis',
      version: '10.2.000',
      steward: 'Centers for Medicare & Medicaid Services',
      description: 'Percentage of children 3-18 years of age who were diagnosed with pharyngitis, dispensed an antibiotic and received a group A streptococcus (strep) test',
      status: 'active',
      imported: '2024-01-12',
      lastExecuted: '2024-01-18',
      cqlLibrary: 'AppropriateTesting',
      measureType: 'proportion',
      scoring: 'proportion',
      populations: {
        initialPopulation: 'Initial Population',
        denominator: 'Denominator',
        numerator: 'Numerator'
      },
      lastResults: {
        denominator: 45,
        numerator: 38,
        score: 84.4,
        exclusions: 2
      }
    },
    {
      id: 'cms165v10',
      name: 'Controlling High Blood Pressure',
      version: '10.1.000',
      steward: 'Centers for Medicare & Medicaid Services',
      description: 'Percentage of patients 18-85 years of age who had a diagnosis of hypertension and whose blood pressure was adequately controlled',
      status: 'active',
      imported: '2024-01-10',
      lastExecuted: '2024-01-19',
      cqlLibrary: 'ControllingHighBloodPressure',
      measureType: 'proportion',
      scoring: 'proportion',
      populations: {
        initialPopulation: 'Initial Population',
        denominator: 'Denominator',
        numerator: 'Numerator',
        exclusions: 'Denominator Exclusions'
      },
      lastResults: {
        denominator: 230,
        numerator: 189,
        score: 82.2,
        exclusions: 15
      }
    }
  ];

  useEffect(() => {
    setMeasures(sampleMeasures);
  }, []);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setImportData(prev => ({ ...prev, file }));
      
      // Read file content
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target.result;
        setImportData(prev => ({ ...prev, cqlContent: content }));
        
        // Parse CQL content to extract metadata
        parseCQLContent(content);
      };
      reader.readAsText(file);
    }
  };

  const parseCQLContent = (content) => {
    // Simple CQL parsing to extract metadata
    const lines = content.split('\n');
    let measureName = '';
    let version = '';
    let description = '';
    
    lines.forEach(line => {
      if (line.startsWith('library ')) {
        measureName = line.split(' ')[1].replace(/['"]/g, '');
      }
      if (line.includes('version ')) {
        version = line.split('version ')[1].replace(/['"]/g, '').trim();
      }
      if (line.includes('description ')) {
        description = line.split('description ')[1].replace(/['"]/g, '').trim();
      }
    });
    
    setImportData(prev => ({
      ...prev,
      measureName: measureName || prev.measureName,
      version: version || prev.version,
      description: description || prev.description
    }));
  };

  const handleImportMeasure = async () => {
    setLoading(true);
    try {
      // Simulate CQL measure import
      await new Promise(resolve => setTimeout(resolve, 3000));
      
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
        populations: {
          initialPopulation: 'Initial Population',
          denominator: 'Denominator',
          numerator: 'Numerator'
        }
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
    } catch (error) {
      console.error('Error importing measure:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteMeasure = async (measureId) => {
    setLoading(true);
    try {
      // Simulate CQL execution
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Generate random results
      const denominator = Math.floor(Math.random() * 300) + 50;
      const numerator = Math.floor(Math.random() * denominator);
      const exclusions = Math.floor(Math.random() * 20);
      const score = (numerator / (denominator - exclusions)) * 100;
      
      const results = {
        measureId,
        executedAt: new Date().toISOString(),
        denominator,
        numerator,
        exclusions,
        score,
        status: 'completed'
      };
      
      setExecutionResults(prev => ({ ...prev, [measureId]: results }));
      
      // Update measure with last execution
      setMeasures(prev => prev.map(measure => 
        measure.id === measureId 
          ? { 
              ...measure, 
              lastExecuted: new Date().toISOString().split('T')[0],
              lastResults: results
            }
          : measure
      ));
    } catch (error) {
      console.error('Error executing measure:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMeasure = (measureId) => {
    setMeasures(prev => prev.filter(measure => measure.id !== measureId));
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'success';
      case 'draft': return 'warning';
      case 'retired': return 'error';
      default: return 'default';
    }
  };

  const steps = [
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
      label: 'Value Sets',
      content: (
        <Box>
          <Typography variant="body1" gutterBottom>
            Upload value sets or configure value set references for this measure.
          </Typography>
          
          <Alert severity="info" sx={{ mb: 2 }}>
            Value sets define the specific codes used in the measure logic. 
            You can upload VSAC value sets or configure them manually.
          </Alert>
          
          <TextField
            fullWidth
            multiline
            rows={6}
            label="Value Set Data (JSON/XML)"
            value={importData.valueSetData}
            onChange={(e) => setImportData(prev => ({ ...prev, valueSetData: e.target.value }))}
            placeholder='{"valueSet": {"id": "2.16.840.1.113883.3.526.3.1279", "title": "Tobacco Use Screening"}}'
          />
        </Box>
      )
    },
    {
      label: 'Validation & Import',
      content: (
        <Box>
          <Typography variant="h6" gutterBottom>Import Summary</Typography>
          
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="body2" color="text.secondary">Measure Name</Typography>
                <Typography variant="body1">{importData.measureName || 'Not specified'}</Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="body2" color="text.secondary">Version</Typography>
                <Typography variant="body1">{importData.version || 'Not specified'}</Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary">Description</Typography>
                <Typography variant="body1">{importData.description || 'Not specified'}</Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary">CQL Content Size</Typography>
                <Typography variant="body1">{importData.cqlContent.length} characters</Typography>
              </Grid>
            </Grid>
          </Paper>
          
          {importData.cqlContent && (
            <Alert severity="success" sx={{ mb: 2 }}>
              CQL content validated successfully. Ready to import.
            </Alert>
          )}
          
          {!importData.cqlContent && (
            <Alert severity="error" sx={{ mb: 2 }}>
              CQL content is required to import the measure.
            </Alert>
          )}
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
            QICore CQL Measures
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Import and execute Clinical Quality Language (CQL) measures using QICore profiles
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<UploadIcon />}
          onClick={() => setImportDialog(true)}
          size="large"
        >
          Import CQL Measure
        </Button>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <AssignmentIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                {measures.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                CQL Measures
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <CheckCircleIcon color="success" sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                {measures.filter(m => m.status === 'active').length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Active Measures
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <PlayIcon color="info" sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                {measures.filter(m => m.lastExecuted).length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Recently Executed
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <StorageIcon color="warning" sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                {Math.round(measures.reduce((sum, m) => sum + (m.lastResults?.score || 0), 0) / measures.length) || 0}%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Average Score
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Paper sx={{ width: '100%' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange} aria-label="cql measures tabs">
            <Tab label="Imported Measures" />
            <Tab label="Execution Results" />
            <Tab label="Library Management" />
          </Tabs>
        </Box>

        {/* Imported Measures Tab */}
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6">CQL Quality Measures</Typography>
            <Button
              variant="outlined"
              startIcon={<UploadIcon />}
              onClick={() => setImportDialog(true)}
            >
              Import New Measure
            </Button>
          </Box>

          <Grid container spacing={3}>
            {measures.map((measure) => (
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
                        <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                          <Chip 
                            label={`v${measure.version}`} 
                            size="small" 
                            variant="outlined"
                          />
                          <Chip 
                            label={measure.status} 
                            size="small" 
                            color={getStatusColor(measure.status)}
                          />
                          <Chip 
                            label={measure.measureType} 
                            size="small" 
                            color="primary"
                            variant="outlined"
                          />
                        </Box>
                      </Box>
                    </Box>

                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      <strong>Steward:</strong> {measure.steward}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      <strong>CQL Library:</strong> {measure.cqlLibrary}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      <strong>Imported:</strong> {format(new Date(measure.imported), 'MMM dd, yyyy')}
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
                              {measure.lastResults.score.toFixed(1)}%
                            </Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="caption" color="text.secondary">Denominator</Typography>
                            <Typography variant="body1">{measure.lastResults.denominator}</Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="caption" color="text.secondary">Numerator</Typography>
                            <Typography variant="body1">{measure.lastResults.numerator}</Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="caption" color="text.secondary">Exclusions</Typography>
                            <Typography variant="body1">{measure.lastResults.exclusions || 0}</Typography>
                          </Grid>
                        </Grid>
                      </Box>
                    )}

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                      <Typography variant="caption" color="text.secondary">
                        {measure.lastExecuted ? `Last executed: ${format(new Date(measure.lastExecuted), 'MMM dd, yyyy')}` : 'Not executed'}
                      </Typography>
                      <Box>
                        <Tooltip title="Execute Measure">
                          <IconButton 
                            size="small" 
                            onClick={() => handleExecuteMeasure(measure.id)}
                            disabled={loading}
                          >
                            <PlayIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="View Details">
                          <IconButton size="small" onClick={() => setSelectedMeasure(measure)}>
                            <DescriptionIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete Measure">
                          <IconButton 
                            size="small" 
                            onClick={() => handleDeleteMeasure(measure.id)}
                            color="error"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </TabPanel>

        {/* Execution Results Tab */}
        <TabPanel value={tabValue} index={1}>
          <Typography variant="h6" gutterBottom>Recent Execution Results</Typography>
          
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Measure</TableCell>
                  <TableCell>Executed At</TableCell>
                  <TableCell align="center">Score</TableCell>
                  <TableCell align="center">Denominator</TableCell>
                  <TableCell align="center">Numerator</TableCell>
                  <TableCell align="center">Exclusions</TableCell>
                  <TableCell align="center">Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {measures.filter(m => m.lastResults).map((measure) => (
                  <TableRow key={measure.id}>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {measure.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {measure.id}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      {format(new Date(measure.lastExecuted), 'MMM dd, yyyy h:mm a')}
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={`${measure.lastResults.score.toFixed(1)}%`}
                        color={measure.lastResults.score >= 80 ? 'success' : measure.lastResults.score >= 60 ? 'warning' : 'error'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">{measure.lastResults.denominator}</TableCell>
                    <TableCell align="center">{measure.lastResults.numerator}</TableCell>
                    <TableCell align="center">{measure.lastResults.exclusions || 0}</TableCell>
                    <TableCell align="center">
                      <Chip 
                        label="Completed" 
                        color="success" 
                        size="small" 
                        variant="outlined"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        {/* Library Management Tab */}
        <TabPanel value={tabValue} index={2}>
          <Typography variant="h6" gutterBottom>CQL Library Management</Typography>
          
          <Alert severity="info" sx={{ mb: 3 }}>
            Manage CQL libraries, dependencies, and value sets used by your quality measures.
          </Alert>

          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>CQL Libraries</Typography>
                  <List dense>
                    {measures.map((measure) => (
                      <ListItem key={measure.id}>
                        <ListItemIcon>
                          <CodeIcon color="primary" />
                        </ListItemIcon>
                        <ListItemText
                          primary={measure.cqlLibrary}
                          secondary={`Version ${measure.version} - ${measure.name}`}
                        />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>Value Set Dependencies</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Value sets referenced by imported measures will be listed here.
                    Ensure all required value sets are available for accurate measure calculation.
                  </Typography>
                  <Button
                    variant="outlined"
                    startIcon={<DownloadIcon />}
                    sx={{ mt: 2 }}
                  >
                    Download Value Sets
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>
      </Paper>

      {/* Import Dialog */}
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
            {steps.map((step, index) => (
              <Step key={step.label}>
                <StepLabel>{step.label}</StepLabel>
                <StepContent>
                  {step.content}
                  
                  <Box sx={{ mt: 2 }}>
                    <Button
                      variant="contained"
                      onClick={() => {
                        if (index === steps.length - 1) {
                          handleImportMeasure();
                        } else {
                          setActiveStep(index + 1);
                        }
                      }}
                      disabled={loading || (index === 0 && !importData.cqlContent)}
                      sx={{ mr: 1 }}
                    >
                      {index === steps.length - 1 ? 'Import Measure' : 'Continue'}
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
    </Box>
  );
};

export default CQLMeasures;