/**
 * CDS Hooks Verifier Component
 * Tool for testing and verifying CDS hooks with specific patients
 */
import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Chip,
  Stack,
  IconButton,
  Tooltip,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
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
  useTheme
} from '@mui/material';
import {
  PlayArrow as TestIcon,
  BugReport as DebugIcon,
  Refresh as RefreshIcon,
  Person as PatientIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Timeline as TimelineIcon,
  ExpandMore as ExpandMoreIcon,
  Visibility as ViewIcon,
  Code as CodeIcon,
  Psychology as CDSIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { cdsHooksClient } from '../../../../services/cdsHooksClient';
import { fhirClient } from '../../../../services/fhirClient';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import { cdsHooksTester } from '../../../../utils/cdsHooksTester';

const CDSHooksVerifier = () => {
  const theme = useTheme();
  const { searchResources } = useFHIRResource();
  
  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState([]);
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState('');
  const [selectedService, setSelectedService] = useState('');
  const [hookType, setHookType] = useState('patient-view');
  const [testResults, setTestResults] = useState([]);
  const [debugInfo, setDebugInfo] = useState(null);
  const [showDebugDialog, setShowDebugDialog] = useState(false);

  useEffect(() => {
    loadServices();
    loadPatients();
  }, []);

  const loadServices = async () => {
    try {
      const discoveredServices = await cdsHooksClient.discoverServices();
      setServices(discoveredServices);
    } catch (error) {
      
    }
  };

  const loadPatients = async () => {
    try {
      const result = await searchResources('Patient', { _count: 50 });
      setPatients(result.resources || []);
    } catch (error) {
      
    }
  };

  const getPatientDisplay = (patient) => {
    const name = patient.name?.[0];
    const fullName = name ? `${name.given?.join(' ') || ''} ${name.family || ''}`.trim() : 'Unknown Patient';
    return `${fullName} (${patient.id})`;
  };

  const executeHookTest = async () => {
    if (!selectedPatient || !selectedService) {
      alert('Please select both a patient and a service');
      return;
    }

    setLoading(true);
    try {
      const startTime = Date.now();
      
      // Build context based on hook type
      let context = {
        hook: hookType,
        hookInstance: `verification-${Date.now()}`,
        context: {
          patientId: selectedPatient
        }
      };

      // Add additional context for specific hook types
      if (hookType === 'medication-prescribe') {
        // Get patient's current medications for context
        const medications = await searchResources('MedicationRequest', { 
          patient: selectedPatient, 
          _count: 10 
        });
        context.context.medications = {
          new: [], // Would be populated with new prescription
          current: medications.resources || []
        };
      }

      // Execute the hook
      const response = await cdsHooksClient.callService(selectedService, context);
      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // Get patient and service details for display
      const patient = patients.find(p => p.id === selectedPatient);
      const service = services.find(s => s.id === selectedService);

      const testResult = {
        id: Date.now(),
        timestamp: new Date(),
        patient: patient,
        service: service,
        hookType,
        context,
        response,
        executionTime,
        success: true
      };

      setTestResults(prev => [testResult, ...prev.slice(0, 9)]);
      
      
    } catch (error) {
      
      
      const testResult = {
        id: Date.now(),
        timestamp: new Date(),
        patient: patients.find(p => p.id === selectedPatient),
        service: services.find(s => s.id === selectedService),
        hookType,
        context: { patientId: selectedPatient },
        error: error.message,
        success: false,
        executionTime: 0
      };

      setTestResults(prev => [testResult, ...prev.slice(0, 9)]);
    } finally {
      setLoading(false);
    }
  };

  const testAllPatientViewHooks = async () => {
    if (!selectedPatient) {
      alert('Please select a patient');
      return;
    }

    setLoading(true);
    try {
      const patientViewServices = services.filter(s => s.hook === 'patient-view');
      const patient = patients.find(p => p.id === selectedPatient);
      
      for (const service of patientViewServices) {
        try {
          const startTime = Date.now();
          const context = {
            hook: 'patient-view',
            hookInstance: `batch-verification-${Date.now()}`,
            context: {
              patientId: selectedPatient
            }
          };

          const response = await cdsHooksClient.callService(service.id, context);
          const endTime = Date.now();

          const testResult = {
            id: `${Date.now()}-${service.id}`,
            timestamp: new Date(),
            patient,
            service,
            hookType: 'patient-view',
            context,
            response,
            executionTime: endTime - startTime,
            success: true
          };

          setTestResults(prev => [testResult, ...prev]);
        } catch (error) {
          const testResult = {
            id: `${Date.now()}-${service.id}`,
            timestamp: new Date(),
            patient,
            service,
            hookType: 'patient-view',
            error: error.message,
            success: false,
            executionTime: 0
          };

          setTestResults(prev => [testResult, ...prev]);
        }
      }
    } catch (error) {
      
    } finally {
      setLoading(false);
    }
  };

  const runComprehensiveTest = async () => {
    setLoading(true);
    try {
      const results = await cdsHooksTester.runTestSuite();
      
      if (results) {
        alert(`Test suite completed!\n\nTotal tests: ${results.totalTests}\nSuccessful: ${results.successful}\nFailed: ${results.failed}\nCards generated: ${results.totalCards}\n\nCheck browser console for detailed results.`);
      } else {
        alert('Test suite failed. Check browser console for details.');
      }
    } catch (error) {
      
      alert(`Test failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const viewDebugInfo = (result) => {
    setDebugInfo(result);
    setShowDebugDialog(true);
  };

  const getAlertSeverity = (indicator) => {
    switch (indicator) {
      case 'critical': return 'error';
      case 'warning': return 'warning';
      case 'info': return 'info';
      default: return 'info';
    }
  };

  const getResultIcon = (result) => {
    if (!result.success) return <ErrorIcon color="error" />;
    if (result.response?.cards?.length > 0) return <WarningIcon color="warning" />;
    return <SuccessIcon color="success" />;
  };

  const filteredServices = services.filter(s => s.hook === hookType);

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
        <DebugIcon color="primary" />
        <Typography variant="h5" fontWeight="bold">
          CDS Hooks Verifier
        </Typography>
      </Stack>

      {/* Test Configuration */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Test Configuration
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel>Hook Type</InputLabel>
              <Select
                value={hookType}
                label="Hook Type"
                onChange={(e) => {
                  setHookType(e.target.value);
                  setSelectedService('');
                }}
              >
                <MenuItem value="patient-view">Patient View</MenuItem>
                <MenuItem value="medication-prescribe">Medication Prescribe</MenuItem>
                <MenuItem value="order-sign">Order Sign</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>Patient</InputLabel>
              <Select
                value={selectedPatient}
                label="Patient"
                onChange={(e) => setSelectedPatient(e.target.value)}
              >
                {patients.map((patient) => (
                  <MenuItem key={patient.id} value={patient.id}>
                    {getPatientDisplay(patient)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel>Service</InputLabel>
              <Select
                value={selectedService}
                label="Service"
                onChange={(e) => setSelectedService(e.target.value)}
                disabled={filteredServices.length === 0}
              >
                {filteredServices.map((service) => (
                  <MenuItem key={service.id} value={service.id}>
                    {service.title || service.id}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            <Stack spacing={1}>
              <Button
                variant="contained"
                startIcon={<TestIcon />}
                onClick={executeHookTest}
                disabled={loading || !selectedPatient || !selectedService}
                fullWidth
              >
                {loading ? 'Testing...' : 'Test Hook'}
              </Button>
              {hookType === 'patient-view' && (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={testAllPatientViewHooks}
                  disabled={loading || !selectedPatient}
                  fullWidth
                >
                  Test All
                </Button>
              )}
              <Button
                variant="contained"
                color="secondary"
                size="small"
                onClick={runComprehensiveTest}
                disabled={loading}
                fullWidth
                sx={{ mt: 1 }}
              >
                Run Full Test Suite
              </Button>
            </Stack>
          </Grid>
        </Grid>

        {/* Service Info */}
        {selectedService && (
          <Box sx={{ mt: 2 }}>
            <Alert severity="info">
              <Typography variant="subtitle2" gutterBottom>
                Service Information
              </Typography>
              {(() => {
                const service = services.find(s => s.id === selectedService);
                return (
                  <Typography variant="body2">
                    <strong>ID:</strong> {service?.id}<br />
                    <strong>Title:</strong> {service?.title || 'Not specified'}<br />
                    <strong>Description:</strong> {service?.description || 'Not specified'}<br />
                    <strong>Hook:</strong> {service?.hook}
                  </Typography>
                );
              })()}
            </Alert>
          </Box>
        )}
      </Paper>

      {/* Test Results */}
      <Paper sx={{ p: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="h6">
            Test Results ({testResults.length})
          </Typography>
          <Stack direction="row" spacing={1}>
            <Chip 
              label={`${testResults.filter(r => r.success).length} Successful`}
              color="success"
              size="small"
            />
            <Chip 
              label={`${testResults.filter(r => !r.success).length} Failed`}
              color="error"
              size="small"
            />
            <Chip 
              label={`${testResults.filter(r => r.response?.cards?.length > 0).length} With Alerts`}
              color="warning"
              size="small"
            />
          </Stack>
        </Stack>

        {testResults.length === 0 ? (
          <Alert severity="info">
            No test results yet. Select a patient and service, then click "Test Hook" to verify CDS functionality.
          </Alert>
        ) : (
          <List>
            {testResults.map((result, index) => (
              <React.Fragment key={result.id}>
                <ListItem sx={{ flexDirection: 'column', alignItems: 'stretch' }}>
                  <Stack direction="row" spacing={2} alignItems="center" sx={{ width: '100%', mb: 1 }}>
                    <ListItemIcon sx={{ minWidth: 'auto' }}>
                      {getResultIcon(result)}
                    </ListItemIcon>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="subtitle2">
                        {result.service?.title || result.service?.id} → {getPatientDisplay(result.patient)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {format(result.timestamp, 'MMM d, yyyy HH:mm:ss')} • {result.executionTime}ms
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1}>
                      <Chip 
                        label={result.hookType} 
                        size="small" 
                        variant="outlined"
                      />
                      {result.success && result.response?.cards?.length > 0 && (
                        <Chip 
                          label={`${result.response.cards.length} cards`}
                          size="small"
                          color="warning"
                        />
                      )}
                      <Tooltip title="View Debug Info">
                        <IconButton size="small" onClick={() => viewDebugInfo(result)}>
                          <CodeIcon />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Stack>

                  {/* Show cards if any */}
                  {result.success && result.response?.cards?.length > 0 && (
                    <Box sx={{ ml: 4, mt: 1 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Generated Cards:
                      </Typography>
                      {result.response.cards.map((card, cardIndex) => (
                        <Alert 
                          key={cardIndex}
                          severity={getAlertSeverity(card.indicator)}
                          sx={{ mb: 1 }}
                        >
                          <Typography variant="subtitle2" gutterBottom>
                            {card.summary}
                          </Typography>
                          <Typography variant="body2">
                            {card.detail}
                          </Typography>
                        </Alert>
                      ))}
                    </Box>
                  )}

                  {/* Show error if failed */}
                  {!result.success && (
                    <Box sx={{ ml: 4, mt: 1 }}>
                      <Alert severity="error">
                        <Typography variant="subtitle2">Execution Failed</Typography>
                        <Typography variant="body2">{result.error}</Typography>
                      </Alert>
                    </Box>
                  )}
                </ListItem>
                {index < testResults.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        )}
      </Paper>

      {/* Debug Dialog */}
      <Dialog 
        open={showDebugDialog} 
        onClose={() => setShowDebugDialog(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" spacing={2} alignItems="center">
            <CodeIcon />
            <Typography variant="h6">Debug Information</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          {debugInfo && (
            <Box>
              <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle1">Test Summary</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">Patient:</Typography>
                      <Typography variant="body1">{getPatientDisplay(debugInfo.patient)}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">Service:</Typography>
                      <Typography variant="body1">{debugInfo.service?.title || debugInfo.service?.id}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">Hook Type:</Typography>
                      <Typography variant="body1">{debugInfo.hookType}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">Execution Time:</Typography>
                      <Typography variant="body1">{debugInfo.executionTime}ms</Typography>
                    </Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>

              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle1">Request Context</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <TextField
                    multiline
                    fullWidth
                    rows={10}
                    value={JSON.stringify(debugInfo.context, null, 2)}
                    variant="outlined"
                    InputProps={{ readOnly: true }}
                  />
                </AccordionDetails>
              </Accordion>

              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle1">Response</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <TextField
                    multiline
                    fullWidth
                    rows={15}
                    value={JSON.stringify(debugInfo.response || { error: debugInfo.error }, null, 2)}
                    variant="outlined"
                    InputProps={{ readOnly: true }}
                  />
                </AccordionDetails>
              </Accordion>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDebugDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CDSHooksVerifier;