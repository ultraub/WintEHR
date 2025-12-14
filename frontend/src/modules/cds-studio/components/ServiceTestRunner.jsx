import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Autocomplete,
  Grid,
  Alert,
  CircularProgress,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider
} from '@mui/material';
import {
  PlayArrow as RunIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Timer as TimerIcon,
  ExpandMore as ExpandIcon
} from '@mui/icons-material';
import cdsStudioApi from '../services/cdsStudioApi';

const ServiceTestRunner = ({ serviceId }) => {
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [userId, setUserId] = useState('Practitioner/example');
  const [encounterId, setEncounterId] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    try {
      setLoadingPatients(true);
      // Fetch patients from FHIR server
      const response = await fetch('/fhir/Patient?_count=50');
      const bundle = await response.json();

      if (bundle.entry) {
        const patientList = bundle.entry.map(entry => ({
          id: entry.resource.id,
          display: formatPatientName(entry.resource)
        }));
        setPatients(patientList);
      }
    } catch (err) {
      console.error('Failed to load patients:', err);
      setError('Failed to load patient list');
    } finally {
      setLoadingPatients(false);
    }
  };

  const formatPatientName = (patient) => {
    if (!patient.name || patient.name.length === 0) {
      return `Patient/${patient.id}`;
    }

    const name = patient.name[0];
    const given = name.given?.join(' ') || '';
    const family = name.family || '';
    const birthDate = patient.birthDate ? ` (${patient.birthDate})` : '';

    return `${given} ${family}${birthDate}`.trim();
  };

  const handleRunTest = async () => {
    if (!selectedPatient) {
      setError('Please select a patient');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setTestResult(null);

      const testRequest = {
        patient_id: `Patient/${selectedPatient.id}`,
        user_id: userId || undefined,
        encounter_id: encounterId || undefined
      };

      const result = await cdsStudioApi.testService(serviceId, testRequest);
      setTestResult(result);
    } catch (err) {
      console.error('Test execution failed:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderTestResults = () => {
    if (!testResult) return null;

    return (
      <Box mt={3}>
        <Card>
          <CardContent>
            <Box display="flex" alignItems="center" gap={2} mb={2}>
              {testResult.success ? (
                <SuccessIcon color="success" fontSize="large" />
              ) : (
                <ErrorIcon color="error" fontSize="large" />
              )}
              <Box>
                <Typography variant="h6">
                  Test {testResult.success ? 'Succeeded' : 'Failed'}
                </Typography>
                <Box display="flex" alignItems="center" gap={1}>
                  <TimerIcon fontSize="small" />
                  <Typography variant="body2" color="text.secondary">
                    Execution time: {testResult.execution_time_ms}ms
                  </Typography>
                </Box>
              </Box>
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* CDS Cards */}
            {testResult.cards && testResult.cards.length > 0 && (
              <Box mb={3}>
                <Typography variant="h6" gutterBottom>
                  CDS Cards ({testResult.cards.length})
                </Typography>
                {testResult.cards.map((card, idx) => (
                  <Card
                    key={idx}
                    variant="outlined"
                    sx={{
                      mb: 2,
                      borderLeft: 4,
                      borderLeftColor: getCardIndicatorColor(card.indicator)
                    }}
                  >
                    <CardContent>
                      <Box display="flex" alignItems="center" gap={1} mb={1}>
                        <Chip
                          label={card.indicator || 'info'}
                          size="small"
                          color={getCardIndicatorColor(card.indicator)}
                        />
                        {card.source && (
                          <Typography variant="caption" color="text.secondary">
                            {card.source.label}
                          </Typography>
                        )}
                      </Box>
                      <Typography variant="h6" gutterBottom>
                        {card.summary}
                      </Typography>
                      {card.detail && (
                        <Typography variant="body2" color="text.secondary">
                          {card.detail}
                        </Typography>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </Box>
            )}

            {testResult.cards && testResult.cards.length === 0 && (
              <Alert severity="info" sx={{ mb: 3 }}>
                No CDS cards returned by the service
              </Alert>
            )}

            {/* Logs */}
            {testResult.logs && testResult.logs.length > 0 && (
              <Accordion>
                <AccordionSummary expandIcon={<ExpandIcon />}>
                  <Typography>Execution Logs ({testResult.logs.length})</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Box
                    sx={{
                      bgcolor: '#f5f5f5',
                      p: 2,
                      borderRadius: 1,
                      fontFamily: 'monospace',
                      fontSize: '0.75rem',
                      maxHeight: 300,
                      overflowY: 'auto'
                    }}
                  >
                    {testResult.logs.map((log, idx) => (
                      <div key={idx}>{log}</div>
                    ))}
                  </Box>
                </AccordionDetails>
              </Accordion>
            )}

            {/* Errors */}
            {testResult.errors && testResult.errors.length > 0 && (
              <Box mt={2}>
                <Typography variant="h6" gutterBottom color="error">
                  Errors ({testResult.errors.length})
                </Typography>
                {testResult.errors.map((err, idx) => (
                  <Alert key={idx} severity="error" sx={{ mb: 1 }}>
                    {err}
                  </Alert>
                ))}
              </Box>
            )}

            {/* Prefetch Data */}
            {testResult.prefetch_data && (
              <Accordion sx={{ mt: 2 }}>
                <AccordionSummary expandIcon={<ExpandIcon />}>
                  <Typography>Prefetch Data</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Box
                    sx={{
                      bgcolor: '#f5f5f5',
                      p: 2,
                      borderRadius: 1,
                      fontFamily: 'monospace',
                      fontSize: '0.75rem',
                      maxHeight: 400,
                      overflowY: 'auto'
                    }}
                  >
                    <pre style={{ margin: 0 }}>
                      {JSON.stringify(testResult.prefetch_data, null, 2)}
                    </pre>
                  </Box>
                </AccordionDetails>
              </Accordion>
            )}
          </CardContent>
        </Card>
      </Box>
    );
  };

  const getCardIndicatorColor = (indicator) => {
    switch (indicator) {
      case 'critical':
        return 'error';
      case 'warning':
        return 'warning';
      case 'info':
        return 'info';
      case 'success':
        return 'success';
      default:
        return 'default';
    }
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Test Service Execution
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Test this CDS service with synthetic patient data before deployment
      </Typography>

      <Card>
        <CardContent>
          <Grid container spacing={2}>
            {/* Patient Selection */}
            <Grid item xs={12}>
              <Autocomplete
                options={patients}
                value={selectedPatient}
                onChange={(event, newValue) => setSelectedPatient(newValue)}
                getOptionLabel={(option) => option.display}
                loading={loadingPatients}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Select Patient *"
                    placeholder="Choose a patient from Synthea data"
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {loadingPatients ? <CircularProgress size={20} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      )
                    }}
                  />
                )}
              />
            </Grid>

            {/* User ID */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="User ID (Practitioner)"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="Practitioner/example"
                size="small"
              />
            </Grid>

            {/* Encounter ID */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Encounter ID (Optional)"
                value={encounterId}
                onChange={(e) => setEncounterId(e.target.value)}
                placeholder="Encounter/123"
                size="small"
              />
            </Grid>

            {/* Run Test Button */}
            <Grid item xs={12}>
              <Button
                variant="contained"
                startIcon={loading ? <CircularProgress size={20} /> : <RunIcon />}
                onClick={handleRunTest}
                disabled={loading || !selectedPatient}
                fullWidth
                size="large"
              >
                {loading ? 'Running Test...' : 'Run Test'}
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Test Results */}
      {renderTestResults()}
    </Box>
  );
};

export default ServiceTestRunner;
