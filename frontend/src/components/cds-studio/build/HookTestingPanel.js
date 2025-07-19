/**
 * Hook Testing Panel - Test CDS hooks with mock patients
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Alert,
  Chip,
  Stack,
  Card,
  CardContent,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  PlayArrow as TestIcon,
  Close as CloseIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  BugReport as DebugIcon,
  ContentCopy as CopyIcon
} from '@mui/icons-material';
import { useCDSStudio } from '../../../pages/CDSHooksStudio';
import { usePatientSearch } from '../../../hooks/usePatientSearch';

const HookTestingPanel = ({ open, onClose, hook }) => {
  const { actions } = useCDSStudio();
  const { patients, loading: patientsLoading, searchPatients } = usePatientSearch();
  const [selectedPatient, setSelectedPatient] = useState('');
  const [testResults, setTestResults] = useState(null);
  const [testing, setTesting] = useState(false);
  const [debugMode, setDebugMode] = useState(false);

  useEffect(() => {
    if (open && patients.length === 0) {
      searchPatients('');
    }
  }, [open, patients, searchPatients]);

  const runTest = async () => {
    if (!selectedPatient) return;

    setTesting(true);
    setTestResults(null);

    try {
      const result = await actions.testHook(selectedPatient);
      setTestResults(result);
    } catch (error) {
      setTestResults({
        success: false,
        error: error.message
      });
    } finally {
      setTesting(false);
    }
  };

  const copyDebugInfo = () => {
    const debugData = {
      hook: hook,
      patient: selectedPatient,
      results: testResults,
      timestamp: new Date().toISOString()
    };
    navigator.clipboard.writeText(JSON.stringify(debugData, null, 2));
  };

  const renderCardResult = (card) => {
    const indicatorIcons = {
      info: <InfoIcon color="info" />,
      warning: <WarningIcon color="warning" />,
      critical: <ErrorIcon color="error" />,
      success: <SuccessIcon color="success" />
    };

    return (
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Box display="flex" alignItems="center" gap={1} mb={1}>
            {indicatorIcons[card.indicator]}
            <Typography variant="subtitle1">{card.summary}</Typography>
          </Box>
          {card.detail && (
            <Typography variant="body2" color="text.secondary">
              {card.detail}
            </Typography>
          )}
          {card.source?.label && (
            <Typography variant="caption" color="text.secondary" display="block" mt={1}>
              Source: {card.source.label}
            </Typography>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Test Hook: {hook.title}</Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        {/* Patient Selection */}
        <Box mb={3}>
          <FormControl fullWidth>
            <InputLabel>Select Test Patient</InputLabel>
            <Select
              value={selectedPatient}
              onChange={(e) => setSelectedPatient(e.target.value)}
              label="Select Test Patient"
              disabled={patientsLoading}
            >
              {patientsLoading ? (
                <MenuItem disabled>
                  <CircularProgress size={20} />
                </MenuItem>
              ) : (
                patients.map(patient => (
                  <MenuItem key={patient.id} value={patient.id}>
                    <Box>
                      <Typography variant="body1">
                        {patient.name?.[0]?.family}, {patient.name?.[0]?.given?.join(' ')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {patient.gender} | {new Date().getFullYear() - new Date(patient.birthDate).getFullYear()} years
                      </Typography>
                    </Box>
                  </MenuItem>
                ))
              )}
            </Select>
          </FormControl>
        </Box>

        {/* Test Options */}
        <Stack direction="row" spacing={2} mb={3}>
          <Button
            variant="contained"
            startIcon={<TestIcon />}
            onClick={runTest}
            disabled={!selectedPatient || testing}
          >
            {testing ? 'Testing...' : 'Run Test'}
          </Button>
          
          <Tooltip title="Show debug information">
            <IconButton 
              onClick={() => setDebugMode(!debugMode)}
              color={debugMode ? 'primary' : 'default'}
            >
              <DebugIcon />
            </IconButton>
          </Tooltip>
        </Stack>

        {/* Test Results */}
        {testResults && (
          <Box>
            <Alert 
              severity={testResults.success ? 'success' : 'error'} 
              sx={{ mb: 2 }}
              action={
                debugMode && (
                  <IconButton size="small" onClick={copyDebugInfo}>
                    <CopyIcon />
                  </IconButton>
                )
              }
            >
              {testResults.success ? 'Hook executed successfully' : testResults.error}
            </Alert>

            {testResults.success && testResults.result && (
              <>
                <Typography variant="h6" gutterBottom>
                  Results
                </Typography>

                {/* Execution Summary */}
                <Card sx={{ mb: 2 }}>
                  <CardContent>
                    <Stack direction="row" spacing={2}>
                      <Chip 
                        label={`${testResults.result.cards?.length || 0} cards generated`}
                        color="primary"
                      />
                      <Chip 
                        label={`Executed in ${testResults.result.executionTime || 0}ms`}
                      />
                    </Stack>
                  </CardContent>
                </Card>

                {/* Generated Cards */}
                {testResults.result.cards?.length > 0 && (
                  <Box mb={3}>
                    <Typography variant="subtitle1" gutterBottom>
                      Generated Cards
                    </Typography>
                    {testResults.result.cards.map((card, index) => (
                      <Box key={index}>
                        {renderCardResult(card)}
                      </Box>
                    ))}
                  </Box>
                )}

                {/* Debug Information */}
                {debugMode && (
                  <Box>
                    <Typography variant="subtitle1" gutterBottom>
                      Debug Information
                    </Typography>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle2" gutterBottom>
                          Context Data
                        </Typography>
                        <pre style={{ 
                          overflow: 'auto', 
                          fontSize: '0.875rem',
                          backgroundColor: '#f5f5f5',
                          padding: '8px',
                          borderRadius: '4px'
                        }}>
                          {JSON.stringify(testResults.result.context, null, 2)}
                        </pre>

                        <Divider sx={{ my: 2 }} />

                        <Typography variant="subtitle2" gutterBottom>
                          Prefetch Data
                        </Typography>
                        <pre style={{ 
                          overflow: 'auto', 
                          fontSize: '0.875rem',
                          backgroundColor: '#f5f5f5',
                          padding: '8px',
                          borderRadius: '4px'
                        }}>
                          {JSON.stringify(testResults.result.prefetch, null, 2)}
                        </pre>
                      </CardContent>
                    </Card>
                  </Box>
                )}
              </>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default HookTestingPanel;