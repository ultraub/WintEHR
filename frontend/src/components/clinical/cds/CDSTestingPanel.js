/**
 * CDS Testing Panel
 * Component for testing different CDS hooks and presentation modes
 */
import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TextField,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Stack,
  Alert,
  Card,
  CardContent,
  CardActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Switch,
  FormControlLabel,
  Divider
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  PlayArrow as PlayIcon,
  Psychology as CDSIcon,
  Settings as SettingsIcon,
  TestTube as TestIcon,
  Visibility as ViewIcon,
  Download as DownloadIcon,
  Upload as UploadIcon
} from '@mui/icons-material';

import CDSHookManager, { WORKFLOW_TRIGGERS, HOOK_PRESENTATION_CONFIG } from './CDSHookManager';
import CDSPresentation, { PRESENTATION_MODES } from './CDSPresentation';
import { cdsHooksClient } from '../../../services/cdsHooksClient';

const CDSTestingPanel = ({ patientId, onClose }) => {
  const [selectedHook, setSelectedHook] = useState('patient-view');
  const [selectedPresentation, setSelectedPresentation] = useState(PRESENTATION_MODES.INLINE);
  const [availableServices, setAvailableServices] = useState([]);
  const [testContext, setTestContext] = useState('{}');
  const [testResults, setTestResults] = useState(null);
  const [hookConfigs, setHookConfigs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [debugMode, setDebugMode] = useState(true);

  // Load available services on mount
  useEffect(() => {
    const loadServices = async () => {
      try {
        const services = await cdsHooksClient.discoverServices();
        setAvailableServices(services);
        
        // Load hook configurations
        const response = await cdsHooksClient.httpClient.get('/hooks');
        setHookConfigs(response.data);
      } catch (err) {
        console.error('Error loading CDS services:', err);
        setError('Failed to load CDS services');
      }
    };
    
    loadServices();
  }, []);

  // Test a specific hook
  const testHook = async () => {
    if (!patientId) {
      setError('No patient selected');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      let context;
      try {
        context = JSON.parse(testContext);
      } catch (e) {
        context = { patientId, userId: 'test-user' };
      }

      // Add required context fields
      context.patientId = patientId;
      if (!context.userId) context.userId = 'test-user';

      const response = await cdsHooksClient.httpClient.post(`/hooks/test/${selectedHook}`, context);
      setTestResults(response.data);
    } catch (err) {
      console.error('Error testing hook:', err);
      setError(`Test failed: ${err.response?.data?.detail || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Fire hooks for different workflow points
  const triggerWorkflow = async (trigger) => {
    if (!patientId) {
      setError('No patient selected');
      return;
    }

    setLoading(true);
    try {
      const hookType = WORKFLOW_TRIGGERS[trigger];
      let alerts = [];
      
      switch (hookType) {
        case 'patient-view':
          alerts = await cdsHooksClient.firePatientView(patientId, 'test-user');
          break;
        case 'medication-prescribe':
          alerts = await cdsHooksClient.fireMedicationPrescribe(patientId, 'test-user', []);
          break;
        case 'order-sign':
          alerts = await cdsHooksClient.fireOrderSign(patientId, 'test-user', []);
          break;
        default:
          if (debugMode) console.log(`Triggering ${trigger} -> ${hookType}`);
      }
      
      setTestResults({
        hook_id: `workflow-${trigger}`,
        test_context: { trigger, patientId },
        cards: alerts,
        cards_count: alerts.length,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      setError(`Failed to trigger ${trigger}: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Toggle hook enabled status
  const toggleHook = async (hookId, enabled) => {
    try {
      await cdsHooksClient.httpClient.patch(`/hooks/${hookId}/toggle?enabled=${enabled}`);
      
      // Refresh hook configs
      const response = await cdsHooksClient.httpClient.get('/hooks');
      setHookConfigs(response.data);
    } catch (err) {
      setError(`Failed to toggle hook: ${err.message}`);
    }
  };

  // Backup hooks
  const backupHooks = async () => {
    try {
      const response = await cdsHooksClient.httpClient.get('/hooks/backup');
      const dataStr = JSON.stringify(response.data, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cds-hooks-backup-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(`Failed to backup hooks: ${err.message}`);
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <CDSIcon color="primary" />
          <Typography variant="h4">CDS Hooks Testing Panel</Typography>
          <Chip label={`Patient: ${patientId || 'None'}`} color={patientId ? 'success' : 'warning'} />
        </Stack>
        {onClose && (
          <Button variant="outlined" onClick={onClose}>
            Close
          </Button>
        )}
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Hook Testing Section */}
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">
            <TestIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Hook Testing
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={3}>
            <Stack direction="row" spacing={2} alignItems="center">
              <FormControl sx={{ minWidth: 200 }}>
                <InputLabel>Select Hook</InputLabel>
                <Select
                  value={selectedHook}
                  onChange={(e) => setSelectedHook(e.target.value)}
                  label="Select Hook"
                >
                  {availableServices.map(service => (
                    <MenuItem key={service.id} value={service.id}>
                      {service.title || service.id} ({service.hook})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              <FormControl sx={{ minWidth: 200 }}>
                <InputLabel>Presentation Mode</InputLabel>
                <Select
                  value={selectedPresentation}
                  onChange={(e) => setSelectedPresentation(e.target.value)}
                  label="Presentation Mode"
                >
                  {Object.entries(PRESENTATION_MODES).map(([key, value]) => (
                    <MenuItem key={value} value={value}>
                      {key.replace('_', ' ')}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              <FormControlLabel
                control={
                  <Switch
                    checked={debugMode}
                    onChange={(e) => setDebugMode(e.target.checked)}
                  />
                }
                label="Debug Mode"
              />
            </Stack>

            <TextField
              label="Test Context (JSON)"
              multiline
              rows={4}
              value={testContext}
              onChange={(e) => setTestContext(e.target.value)}
              placeholder='{"patientId": "123", "userId": "test-user"}'
              fullWidth
            />

            <Stack direction="row" spacing={2}>
              <Button
                variant="contained"
                startIcon={<PlayIcon />}
                onClick={testHook}
                disabled={loading || !patientId}
              >
                Test Hook
              </Button>
              
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={backupHooks}
              >
                Backup Hooks
              </Button>
            </Stack>
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* Workflow Triggers */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">
            <SettingsIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Workflow Triggers
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Test hooks at different clinical workflow points:
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {Object.entries(WORKFLOW_TRIGGERS).map(([trigger, hookType]) => (
                <Button
                  key={trigger}
                  variant="outlined"
                  size="small"
                  onClick={() => triggerWorkflow(trigger)}
                  disabled={loading || !patientId}
                >
                  {trigger.replace('_', ' ')} ({hookType})
                </Button>
              ))}
            </Stack>
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* Hook Configuration Management */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">
            <ViewIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Hook Management
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Hook ID</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Title</TableCell>
                  <TableCell>Enabled</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {hookConfigs.map((hook) => (
                  <TableRow key={hook.id}>
                    <TableCell>{hook.id}</TableCell>
                    <TableCell>
                      <Chip label={hook.hook} size="small" />
                    </TableCell>
                    <TableCell>{hook.title || hook.description}</TableCell>
                    <TableCell>
                      <Switch
                        checked={hook.enabled}
                        onChange={(e) => toggleHook(hook.id, e.target.checked)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        onClick={() => {
                          setSelectedHook(hook.id);
                          testHook();
                        }}
                      >
                        Test
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </AccordionDetails>
      </Accordion>

      {/* Test Results */}
      {testResults && (
        <Accordion defaultExpanded={!!testResults}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">
              Test Results ({testResults.cards_count} cards)
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                Hook: {testResults.hook_id} | Time: {new Date(testResults.timestamp).toLocaleString()}
              </Typography>
              
              {testResults.cards && testResults.cards.length > 0 ? (
                <Stack spacing={2}>
                  <Typography variant="subtitle1">Cards Preview:</Typography>
                  <CDSPresentation
                    alerts={testResults.cards}
                    mode={selectedPresentation}
                    onAlertAction={(alert, action, suggestion) => {
                      console.log('Test Alert Action:', { alert, action, suggestion });
                    }}
                  />
                  
                  <Divider />
                  
                  <Typography variant="subtitle1">Raw Data:</Typography>
                  <Paper variant="outlined" sx={{ p: 2, maxHeight: 400, overflow: 'auto' }}>
                    <pre style={{ margin: 0, fontSize: '12px' }}>
                      {JSON.stringify(testResults, null, 2)}
                    </pre>
                  </Paper>
                </Stack>
              ) : (
                <Alert severity="info">
                  No cards returned from this hook test.
                </Alert>
              )}
            </Stack>
          </AccordionDetails>
        </Accordion>
      )}

      {/* Live Hook Manager */}
      {patientId && (
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">
              Live CDS Hook Manager
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <CDSHookManager
              patientId={patientId}
              userId="test-user"
              currentHook="patient-view"
              debugMode={debugMode}
              onHookFired={(hookType, alerts) => {
                if (debugMode) console.log(`🔥 Hook fired: ${hookType}`, alerts);
              }}
              onAlertAction={(alert, action, suggestion) => {
                if (debugMode) console.log('🎯 Live Alert Action:', { alert, action, suggestion });
              }}
            />
          </AccordionDetails>
        </Accordion>
      )}
    </Box>
  );
};

export default CDSTestingPanel;