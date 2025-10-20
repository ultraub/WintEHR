/**
 * Service Tester Component
 *
 * Provides interface for testing visual CDS services with synthetic patients.
 * Shows service execution results, cards generated, and performance metrics.
 * Helps developers validate service logic before deployment.
 */

import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Stack,
  Alert,
  CircularProgress,
  Divider,
  Grid,
  Chip,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Autocomplete
} from '@mui/material';
import {
  PlayArrow as RunIcon,
  ExpandMore as ExpandIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Speed as PerformanceIcon,
  Code as CodeIcon
} from '@mui/icons-material';

import CDSCard from '../../../../components/clinical/cds/CDSCard';
import axios from 'axios';

/**
 * Service Tester Component
 */
const ServiceTester = ({ serviceId, serviceName, serviceConfig }) => {
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientSearchTerm, setPatientSearchTerm] = useState('');
  const [patientOptions, setPatientOptions] = useState([]);
  const [patientSearchLoading, setPatientSearchLoading] = useState(false);

  const [testResults, setTestResults] = useState(null);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState(null);

  const [additionalContext, setAdditionalContext] = useState('{}');

  // Search for patients
  const handlePatientSearch = async (searchTerm) => {
    if (!searchTerm || searchTerm.length < 2) {
      setPatientOptions([]);
      return;
    }

    setPatientSearchLoading(true);

    try {
      const response = await axios.get('/fhir/R4/Patient', {
        params: {
          name: searchTerm,
          _count: 10
        }
      });

      const patients = response.data.entry?.map(entry => ({
        id: entry.resource.id,
        name: entry.resource.name?.[0]
          ? `${entry.resource.name[0].given?.join(' ')} ${entry.resource.name[0].family}`
          : 'Unknown',
        birthDate: entry.resource.birthDate,
        gender: entry.resource.gender,
        resource: entry.resource
      })) || [];

      setPatientOptions(patients);
    } catch (err) {
      console.error('Error searching patients:', err);
      setError('Failed to search for patients');
    } finally {
      setPatientSearchLoading(false);
    }
  };

  // Execute service test
  const handleRunTest = async () => {
    if (!selectedPatient) {
      setError('Please select a patient');
      return;
    }

    setTesting(true);
    setError(null);
    setTestResults(null);

    try {
      // Parse additional context
      let contextData = {};
      if (additionalContext.trim()) {
        try {
          contextData = JSON.parse(additionalContext);
        } catch (e) {
          setError('Invalid JSON in additional context');
          setTesting(false);
          return;
        }
      }

      // Call test endpoint
      const response = await axios.post(
        `/api/cds-visual-builder/services/${serviceId}/test`,
        {
          patient_id: selectedPatient.id,
          context: contextData
        }
      );

      setTestResults(response.data);
    } catch (err) {
      console.error('Error testing service:', err);
      setError(err.response?.data?.detail || 'Failed to test service');
    } finally {
      setTesting(false);
    }
  };

  return (
    <Box>
      {/* Header */}
      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center" mb={2}>
          <Typography variant="h5">Test Service</Typography>
          <Chip label={serviceName} color="primary" />
        </Stack>
        <Typography variant="body2" color="text.secondary">
          Test your CDS service with synthetic patient data to validate logic and see generated cards
        </Typography>
      </Paper>

      {/* Patient Selection */}
      <Paper elevation={1} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          1. Select Test Patient
        </Typography>
        <Autocomplete
          options={patientOptions}
          getOptionLabel={(option) => `${option.name} (${option.birthDate})`}
          loading={patientSearchLoading}
          value={selectedPatient}
          onChange={(event, newValue) => setSelectedPatient(newValue)}
          onInputChange={(event, newInputValue) => {
            setPatientSearchTerm(newInputValue);
            handlePatientSearch(newInputValue);
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Search patients by name"
              placeholder="Type to search..."
              helperText="Search for synthetic patients (e.g., 'Smith', 'John')"
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {patientSearchLoading ? <CircularProgress size={20} /> : null}
                    {params.InputProps.endAdornment}
                  </>
                )
              }}
            />
          )}
          renderOption={(props, option) => (
            <li {...props}>
              <Box>
                <Typography variant="body1">{option.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  DOB: {option.birthDate} | Gender: {option.gender}
                </Typography>
              </Box>
            </li>
          )}
        />

        {selectedPatient && (
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              <strong>Selected Patient:</strong> {selectedPatient.name}
              <br />
              <strong>ID:</strong> {selectedPatient.id}
              <br />
              <strong>Birth Date:</strong> {selectedPatient.birthDate}
              <br />
              <strong>Gender:</strong> {selectedPatient.gender}
            </Typography>
          </Alert>
        )}
      </Paper>

      {/* Additional Context (Optional) */}
      <Paper elevation={1} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          2. Additional Context (Optional)
        </Typography>
        <TextField
          fullWidth
          multiline
          rows={4}
          label="Additional context JSON"
          value={additionalContext}
          onChange={(e) => setAdditionalContext(e.target.value)}
          placeholder='{"userId": "Practitioner/123"}'
          helperText="Provide additional CDS Hooks context as JSON (optional)"
        />
      </Paper>

      {/* Run Test Button */}
      <Box sx={{ mb: 3 }}>
        <Button
          variant="contained"
          size="large"
          startIcon={testing ? <CircularProgress size={20} color="inherit" /> : <RunIcon />}
          onClick={handleRunTest}
          disabled={!selectedPatient || testing}
          fullWidth
        >
          {testing ? 'Running Test...' : 'Run Service Test'}
        </Button>
      </Box>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Test Results */}
      {testResults && (
        <Box>
          {/* Execution Summary */}
          <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
            <Stack direction="row" spacing={2} alignItems="center" mb={2}>
              <Typography variant="h6">Execution Results</Typography>
              {testResults.executed ? (
                <Chip icon={<SuccessIcon />} label="Success" color="success" />
              ) : (
                <Chip icon={<ErrorIcon />} label="Failed" color="error" />
              )}
            </Stack>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary">
                    Cards Generated
                  </Typography>
                  <Typography variant="h4">
                    {testResults.cards?.length || 0}
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <PerformanceIcon color="action" sx={{ fontSize: 40 }} />
                  <Typography variant="caption" color="text.secondary" display="block">
                    Execution Time
                  </Typography>
                  <Typography variant="h6">
                    {testResults.execution_time_ms?.toFixed(2)} ms
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary">
                    Errors
                  </Typography>
                  <Typography variant="h4" color="error.main">
                    {testResults.errors?.length || 0}
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary">
                    Warnings
                  </Typography>
                  <Typography variant="h4" color="warning.main">
                    {testResults.warnings?.length || 0}
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Paper>

          {/* Errors */}
          {testResults.errors && testResults.errors.length > 0 && (
            <Alert severity="error" sx={{ mb: 3 }}>
              <Typography variant="body2" gutterBottom>
                <strong>Errors encountered during execution:</strong>
              </Typography>
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                {testResults.errors.map((error, index) => (
                  <li key={index}>
                    <Typography variant="caption">{error}</Typography>
                  </li>
                ))}
              </ul>
            </Alert>
          )}

          {/* Warnings */}
          {testResults.warnings && testResults.warnings.length > 0 && (
            <Alert severity="warning" sx={{ mb: 3 }}>
              <Typography variant="body2" gutterBottom>
                <strong>Warnings:</strong>
              </Typography>
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                {testResults.warnings.map((warning, index) => (
                  <li key={index}>
                    <Typography variant="caption">{warning}</Typography>
                  </li>
                ))}
              </ul>
            </Alert>
          )}

          {/* Generated Cards */}
          {testResults.cards && testResults.cards.length > 0 && (
            <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Generated CDS Cards ({testResults.cards.length})
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <Stack spacing={2}>
                {testResults.cards.map((card, index) => (
                  <Box key={index}>
                    <Typography variant="subtitle2" gutterBottom>
                      Card {index + 1}
                    </Typography>
                    <CDSCard
                      card={card}
                      serviceId={serviceId}
                      onAcceptSuggestion={(suggestionId) => {
                        console.log('Suggestion accepted:', suggestionId);
                      }}
                      onDismiss={() => {
                        console.log('Card dismissed');
                      }}
                    />
                  </Box>
                ))}
              </Stack>
            </Paper>
          )}

          {/* No Cards Generated */}
          {(!testResults.cards || testResults.cards.length === 0) && (
            <Alert severity="info" sx={{ mb: 3 }}>
              <Typography variant="body2">
                No cards generated. This may indicate:
              </Typography>
              <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
                <li>Service conditions were not met for this patient</li>
                <li>Patient data doesn't match the configured criteria</li>
                <li>Service logic needs adjustment</li>
              </ul>
            </Alert>
          )}

          {/* Raw Response (Collapsible) */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Stack direction="row" spacing={1} alignItems="center">
                <CodeIcon />
                <Typography>Raw Test Response</Typography>
              </Stack>
            </AccordionSummary>
            <AccordionDetails>
              <Box
                component="pre"
                sx={{
                  p: 2,
                  bgcolor: 'grey.100',
                  borderRadius: 1,
                  overflow: 'auto',
                  fontSize: '0.875rem'
                }}
              >
                {JSON.stringify(testResults, null, 2)}
              </Box>
            </AccordionDetails>
          </Accordion>
        </Box>
      )}

      {/* Help Text */}
      {!testResults && !testing && (
        <Alert severity="info">
          <Typography variant="body2">
            <strong>Testing Tips:</strong>
          </Typography>
          <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
            <li>Select a synthetic patient from the Synthea dataset</li>
            <li>Service will be executed with the patient's actual FHIR data</li>
            <li>Review generated cards to validate service logic</li>
            <li>Check execution time and any errors/warnings</li>
            <li>Test with multiple patients to ensure robustness</li>
          </ul>
        </Alert>
      )}
    </Box>
  );
};

export default ServiceTester;
