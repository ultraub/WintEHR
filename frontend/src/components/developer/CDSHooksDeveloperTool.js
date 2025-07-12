/**
 * CDS Hooks Developer Tool
 * Centralized, comprehensive interface for CDS Hooks development and testing
 */
import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Tabs,
  Tab,
  Card,
  CardContent,
  CardHeader,
  CardActions,
  Button,
  IconButton,
  Tooltip,
  Alert,
  Chip,
  Stack,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Switch,
  FormControlLabel,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Badge,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  TextField,
  useTheme
} from '@mui/material';
import {
  Psychology as CDSIcon,
  Build as BuilderIcon,
  Analytics as MetricsIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Error as ErrorIcon,
  CheckCircle as SuccessIcon,
  Refresh as RefreshIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as ExecuteIcon,
  ExpandMore as ExpandMoreIcon,
  Timeline as TimelineIcon,
  Settings as SettingsIcon,
  School as TrainingIcon,
  Close as CloseIcon,
  Science as TestIcon,
  ImportExport as ImportExportIcon,
  Webhook as WebhookIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import CDSHookBuilder from '../clinical/workspace/cds/CDSHookBuilder';
import CDSHooksVerifier from '../clinical/workspace/cds/CDSHooksVerifier';
import CDSCardDisplay from '../clinical/workspace/cds/CDSCardDisplay';
import { cdsHooksClient } from '../../services/cdsHooksClient';
import { cdsHooksService } from '../../services/cdsHooksService';

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`cds-dev-tabpanel-${index}`}
      aria-labelledby={`cds-dev-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const CDSHooksDeveloperTool = () => {
  const theme = useTheme();
  const [tabValue, setTabValue] = useState(0);
  const [services, setServices] = useState([]);
  const [hooks, setHooks] = useState([]);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedHook, setSelectedHook] = useState(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [executionHistory, setExecutionHistory] = useState([]);
  const [serviceSettings, setServiceSettings] = useState({});
  const [customHooks, setCustomHooks] = useState([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [testPatientId, setTestPatientId] = useState('test-patient-123');
  const [testContext, setTestContext] = useState({});
  const [displayBehavior, setDisplayBehavior] = useState({
    displayMode: 'immediate',
    position: 'top',
    maxCards: 10,
    priority: 'critical-first',
    allowDismiss: true,
    groupByService: true,
    animation: true
  });

  useEffect(() => {
    loadCDSServices();
    loadExecutionHistory();
    loadCustomHooks();
  }, []);

  const loadCDSServices = async () => {
    try {
      setLoading(true);
      const response = await cdsHooksClient.discoverServices();
      setServices(response || []);
      
      // Initialize settings for each service
      const settings = {};
      response.forEach(service => {
        settings[service.id] = {
          enabled: true,
          autoRefresh: false,
          debug: false
        };
      });
      setServiceSettings(settings);
    } catch (error) {
      setError(`Failed to load CDS services: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadCustomHooks = async () => {
    try {
      const response = await cdsHooksService.listCustomHooks();
      if (response.success) {
        setCustomHooks(response.data || []);
      }
    } catch (error) {
      console.error('Error loading custom hooks:', error);
    }
  };

  const loadExecutionHistory = () => {
    // Load from localStorage or initialize empty
    const history = JSON.parse(localStorage.getItem('cds_execution_history') || '[]');
    setExecutionHistory(history.slice(0, 50)); // Keep last 50 executions
  };

  const saveExecutionHistory = (execution) => {
    const newHistory = [execution, ...executionHistory].slice(0, 50);
    setExecutionHistory(newHistory);
    localStorage.setItem('cds_execution_history', JSON.stringify(newHistory));
  };

  const executeTestHook = async (hookId) => {
    try {
      setLoading(true);
      const startTime = Date.now();
      
      const testRequest = {
        hook: 'patient-view',
        hookInstance: `test-${Date.now()}`,
        context: {
          patientId: testPatientId,
          userId: 'test-user',
          ...testContext
        }
      };

      const response = await cdsHooksClient.callService(hookId, testRequest);
      const executionTime = Date.now() - startTime;

      // Save execution history
      const execution = {
        id: Date.now(),
        hookId,
        timestamp: new Date().toISOString(),
        executionTime,
        success: true,
        cardsGenerated: response.cards?.length || 0,
        context: testRequest.context
      };
      saveExecutionHistory(execution);

      // Display cards
      if (response.cards && response.cards.length > 0) {
        setCards(prevCards => [...response.cards, ...prevCards].slice(0, 50));
      }

      setSnackbar({
        open: true,
        message: `Hook ${hookId} executed successfully (${executionTime}ms)`,
        severity: 'success'
      });
    } catch (error) {
      const execution = {
        id: Date.now(),
        hookId,
        timestamp: new Date().toISOString(),
        executionTime: 0,
        success: false,
        error: error.message,
        context: { patientId: testPatientId, ...testContext }
      };
      saveExecutionHistory(execution);

      setSnackbar({
        open: true,
        message: `Hook execution failed: ${error.message}`,
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteCustomHook = async (hookId) => {
    try {
      await cdsHooksService.deleteHook(hookId);
      await loadCustomHooks();
      setSnackbar({
        open: true,
        message: `Hook ${hookId} deleted successfully`,
        severity: 'success'
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: `Failed to delete hook: ${error.message}`,
        severity: 'error'
      });
    }
  };

  const handleBuilderSave = async (hookData) => {
    try {
      await loadCustomHooks();
      await loadCDSServices();
      setShowBuilder(false);
      setSelectedHook(null);
      setSnackbar({
        open: true,
        message: 'Hook saved successfully',
        severity: 'success'
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: `Failed to save hook: ${error.message}`,
        severity: 'error'
      });
    }
  };

  const clearAllCards = () => {
    setCards([]);
  };

  const clearExecutionHistory = () => {
    setExecutionHistory([]);
    localStorage.removeItem('cds_execution_history');
  };

  const exportHooksConfiguration = async () => {
    try {
      const allHooks = await cdsHooksService.listCustomHooks();
      const config = {
        timestamp: new Date().toISOString(),
        hooks: allHooks.data || [],
        services: services,
        settings: serviceSettings
      };
      
      const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cds-hooks-config-${format(new Date(), 'yyyy-MM-dd-HHmm')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setSnackbar({
        open: true,
        message: 'Configuration exported successfully',
        severity: 'success'
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: `Export failed: ${error.message}`,
        severity: 'error'
      });
    }
  };

  const renderServicesTab = () => (
    <Stack spacing={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h6">Available CDS Services</Typography>
        <Stack direction="row" spacing={1}>
          <Button
            startIcon={<RefreshIcon />}
            onClick={loadCDSServices}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            startIcon={<ImportExportIcon />}
            onClick={exportHooksConfiguration}
            variant="outlined"
          >
            Export Config
          </Button>
        </Stack>
      </Stack>

      {loading && <CircularProgress />}
      
      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Grid container spacing={2}>
        {services.map((service) => (
          <Grid item xs={12} md={6} lg={4} key={service.id}>
            <Card variant="outlined">
              <CardHeader
                title={service.title || service.id}
                subheader={`Hook: ${service.hook}`}
                action={
                  <FormControlLabel
                    control={
                      <Switch
                        checked={serviceSettings[service.id]?.enabled ?? true}
                        onChange={(e) => setServiceSettings(prev => ({
                          ...prev,
                          [service.id]: { ...prev[service.id], enabled: e.target.checked }
                        }))}
                      />
                    }
                    label="Enabled"
                  />
                }
              />
              <CardContent>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {service.description}
                </Typography>
                {service.prefetch && Object.keys(service.prefetch).length > 0 && (
                  <Chip label={`${Object.keys(service.prefetch).length} prefetch queries`} size="small" />
                )}
              </CardContent>
              <CardActions>
                <Button
                  size="small"
                  startIcon={<ExecuteIcon />}
                  onClick={() => executeTestHook(service.id)}
                  disabled={loading || !serviceSettings[service.id]?.enabled}
                >
                  Test
                </Button>
                <Button
                  size="small"
                  startIcon={<EditIcon />}
                  onClick={() => {
                    setSelectedHook(service);
                    setShowBuilder(true);
                  }}
                >
                  Edit
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Stack>
  );

  const renderHooksBuilderTab = () => (
    <Stack spacing={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h6">Custom CDS Hooks</Typography>
        <Button
          startIcon={<AddIcon />}
          variant="contained"
          onClick={() => {
            setSelectedHook(null);
            setShowBuilder(true);
          }}
        >
          Create New Hook
        </Button>
      </Stack>

      {customHooks.length === 0 ? (
        <Alert severity="info">
          No custom hooks created yet. Use the builder to create your first CDS hook.
        </Alert>
      ) : (
        <Grid container spacing={2}>
          {customHooks.map((hook) => (
            <Grid item xs={12} md={6} lg={4} key={hook.id}>
              <Card variant="outlined">
                <CardHeader
                  title={hook.title}
                  subheader={`ID: ${hook.id}`}
                  action={
                    <Chip
                      label={hook.enabled ? 'Enabled' : 'Disabled'}
                      color={hook.enabled ? 'success' : 'default'}
                      size="small"
                    />
                  }
                />
                <CardContent>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Hook: {hook.hook}
                  </Typography>
                  <Typography variant="body2" gutterBottom>
                    {hook.description}
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                    <Chip label={`${hook.conditions?.length || 0} conditions`} size="small" />
                    <Chip label={`${hook.cards?.length || 0} cards`} size="small" />
                  </Stack>
                </CardContent>
                <CardActions>
                  <Button
                    size="small"
                    startIcon={<TestIcon />}
                    onClick={() => executeTestHook(hook.id)}
                    disabled={loading || !hook.enabled}
                  >
                    Test
                  </Button>
                  <Button
                    size="small"
                    startIcon={<EditIcon />}
                    onClick={() => {
                      setSelectedHook(hook);
                      setShowBuilder(true);
                    }}
                  >
                    Edit
                  </Button>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => deleteCustomHook(hook.id)}
                  >
                    <DeleteIcon />
                  </IconButton>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Hook Builder Dialog */}
      <Dialog
        open={showBuilder}
        onClose={() => setShowBuilder(false)}
        maxWidth="xl"
        fullWidth
        PaperProps={{
          sx: { minHeight: '80vh' }
        }}
      >
        <DialogTitle>
          {selectedHook ? 'Edit CDS Hook' : 'Create New CDS Hook'}
        </DialogTitle>
        <DialogContent>
          <CDSHookBuilder
            editingHook={selectedHook}
            onSave={handleBuilderSave}
            onCancel={() => setShowBuilder(false)}
          />
        </DialogContent>
      </Dialog>
    </Stack>
  );

  const renderTestingTab = () => (
    <Stack spacing={3}>
      <Typography variant="h6">CDS Testing Environment</Typography>
      
      {/* Test Configuration */}
      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" gutterBottom>Test Configuration</Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Test Patient ID"
              value={testPatientId}
              onChange={(e) => setTestPatientId(e.target.value)}
              helperText="Patient ID to use for testing hooks"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Additional Context (JSON)"
              multiline
              rows={2}
              value={JSON.stringify(testContext, null, 2)}
              onChange={(e) => {
                try {
                  setTestContext(JSON.parse(e.target.value || '{}'));
                } catch (err) {
                  // Invalid JSON, ignore
                }
              }}
              helperText="Additional context data for hook execution"
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Generated Cards */}
      <Paper sx={{ p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="subtitle1">Generated CDS Cards</Typography>
          <Button
            startIcon={<CloseIcon />}
            onClick={clearAllCards}
            disabled={cards.length === 0}
            size="small"
          >
            Clear All
          </Button>
        </Stack>
        
        {cards.length === 0 ? (
          <Alert severity="info">
            No CDS cards generated yet. Test some hooks to see the results here.
          </Alert>
        ) : (
          <Stack spacing={2}>
            {cards.map((card, index) => (
              <CDSCardDisplay
                key={index}
                card={card}
                displayBehavior={displayBehavior}
                onDismiss={() => setCards(prev => prev.filter((_, i) => i !== index))}
              />
            ))}
          </Stack>
        )}
      </Paper>
    </Stack>
  );

  const renderExecutionHistoryTab = () => (
    <Stack spacing={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h6">Execution History</Typography>
        <Button
          startIcon={<CloseIcon />}
          onClick={clearExecutionHistory}
          disabled={executionHistory.length === 0}
          size="small"
        >
          Clear History
        </Button>
      </Stack>

      {executionHistory.length === 0 ? (
        <Alert severity="info">
          No execution history yet. Test some hooks to see the execution details here.
        </Alert>
      ) : (
        <List>
          {executionHistory.map((execution) => (
            <React.Fragment key={execution.id}>
              <ListItem>
                <ListItemIcon>
                  {execution.success ? (
                    <SuccessIcon color="success" />
                  ) : (
                    <ErrorIcon color="error" />
                  )}
                </ListItemIcon>
                <ListItemText
                  primary={`${execution.hookId} - ${format(new Date(execution.timestamp), 'PPpp')}`}
                  secondary={
                    execution.success
                      ? `Generated ${execution.cardsGenerated} cards in ${execution.executionTime}ms`
                      : `Error: ${execution.error}`
                  }
                />
                <ListItemSecondaryAction>
                  <Chip
                    label={execution.success ? 'Success' : 'Failed'}
                    color={execution.success ? 'success' : 'error'}
                    size="small"
                  />
                </ListItemSecondaryAction>
              </ListItem>
              <Divider />
            </React.Fragment>
          ))}
        </List>
      )}
    </Stack>
  );

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header with CDS Icon */}
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
        <WebhookIcon color="primary" sx={{ fontSize: 32 }} />
        <Box>
          <Typography variant="h5" fontWeight="bold">
            CDS Hooks Developer Tool
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Comprehensive Clinical Decision Support development and testing environment
          </Typography>
        </Box>
      </Stack>

      {/* Main Tabs */}
      <Paper sx={{ width: '100%' }}>
        <Tabs
          value={tabValue}
          onChange={(event, newValue) => setTabValue(newValue)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab
            icon={<WebhookIcon />}
            label="Services"
            id="cds-dev-tab-0"
            aria-controls="cds-dev-tabpanel-0"
          />
          <Tab
            icon={<BuilderIcon />}
            label="Hook Builder"
            id="cds-dev-tab-1"
            aria-controls="cds-dev-tabpanel-1"
          />
          <Tab
            icon={<TestIcon />}
            label="Testing"
            id="cds-dev-tab-2"
            aria-controls="cds-dev-tabpanel-2"
          />
          <Tab
            icon={<TimelineIcon />}
            label="History"
            id="cds-dev-tab-3"
            aria-controls="cds-dev-tabpanel-3"
          />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          {renderServicesTab()}
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          {renderHooksBuilderTab()}
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          {renderTestingTab()}
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          {renderExecutionHistoryTab()}
        </TabPanel>
      </Paper>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default CDSHooksDeveloperTool;