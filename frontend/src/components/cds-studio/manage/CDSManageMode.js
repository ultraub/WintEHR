/**
 * CDS Manage Mode - Comprehensive CDS services management and execution history
 * Consolidated interface for managing CDS services that respond to clinical hooks
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardHeader,
  CardActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  Button,
  TextField,
  InputAdornment,
  Stack,
  Alert,
  Tooltip,
  Menu,
  MenuItem,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Switch,
  FormControlLabel,
  CircularProgress,
  Snackbar
} from '@mui/material';
import {
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ContentCopy as DuplicateIcon,
  Analytics as AnalyticsIcon,
  History as HistoryIcon,
  Add as AddIcon,
  Webhook as WebhookIcon,
  PlayArrow as ExecuteIcon,
  Refresh as RefreshIcon,
  ImportExport as ImportExportIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Close as CloseIcon,
  Science as TestIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { cdsHooksService } from '../../../services/cdsHooksService';
import { cdsHooksClient } from '../../../services/cdsHooksClient';
import CDSCardDisplay from '../../clinical/workspace/cds/CDSCardDisplay';
import { useCDSStudio } from '../../../pages/CDSHooksStudio';

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`manage-tabpanel-${index}`}
      aria-labelledby={`manage-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

const CDSManageMode = ({ onEditService, refreshTrigger }) => {
  const { actions } = useCDSStudio();
  const [tabValue, setTabValue] = useState(0);
  const [customServices, setCustomServices] = useState([]); // Our custom CDS services
  const [discoveredServices, setDiscoveredServices] = useState([]); // All available services
  const [executionHistory, setExecutionHistory] = useState([]);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [anchorEl, setAnchorEl] = useState(null);
  const [, setSelectedService] = useState(null);
  const [serviceSettings, setServiceSettings] = useState({});
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [testPatientId, setTestPatientId] = useState('test-patient-123');
  const [, setTestContext] = useState({});
  const [, setDisplayBehavior] = useState({
    displayMode: 'immediate',
    position: 'top',
    maxCards: 10,
    priority: 'critical-first',
    allowDismiss: true,
    groupByService: true,
    animation: true
  });

  useEffect(() => {
    loadCustomServices();
    loadCDSServices();
    loadExecutionHistory();
  }, []);

  // Reload services when refreshTrigger changes (e.g., after saving in build mode)
  useEffect(() => {
    if (refreshTrigger > 0) {
      loadCustomServices();
    }
  }, [refreshTrigger]);

  const loadCustomServices = async () => {
    try {
      setLoading(true);
      const response = await cdsHooksService.listCustomServices();
      console.log('[CDSManageMode] Loaded custom services:', response.data);
      setCustomServices(response.data || []);
    } catch (error) {
      console.error('Failed to load custom services:', error);
      setSnackbar({
        open: true,
        message: `Failed to load custom services: ${error.message}`,
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadCDSServices = async () => {
    try {
      const response = await cdsHooksClient.discoverServices();
      setDiscoveredServices(response || []);
      
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
      setSnackbar({
        open: true,
        message: `Failed to load CDS services: ${error.message}`,
        severity: 'error'
      });
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

  // Removed duplicate handleEdit - using the one below

  const handleEdit = (service) => {
    // Call the parent handler to switch to build mode with this service
    if (onEditService) {
      onEditService(service);
    }
  };

  const handleDelete = async (serviceId) => {
    if (window.confirm('Are you sure you want to delete this service?')) {
      try {
        await cdsHooksService.deleteService(serviceId);
        await loadCustomServices();
        setSnackbar({
          open: true,
          message: 'Service deleted successfully',
          severity: 'success'
        });
      } catch (error) {
        setSnackbar({
          open: true,
          message: `Delete failed: ${error.message}`,
          severity: 'error'
        });
      }
    }
  };

  const handleDuplicate = async (service) => {
    const duplicate = {
      ...service,
      id: undefined,
      title: `${service.title} (Copy)`,
      _meta: {
        ...service._meta,
        created: new Date(),
        modified: new Date()
      }
    };
    
    try {
      await cdsHooksService.createService(duplicate);
      await loadCustomServices();
      setSnackbar({
        open: true,
        message: 'Service duplicated successfully',
        severity: 'success'
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: `Failed to duplicate service: ${error.message}`,
        severity: 'error'
      });
    }
  };

  const executeTestService = async (serviceId, hookType = 'patient-view') => {
    try {
      setLoading(true);
      const startTime = Date.now();
      
      const testRequest = {
        hook: hookType, // The hook that triggers this service
        hookInstance: `test-${Date.now()}`,
        context: {
          patientId: testPatientId,
          userId: 'test-user',
          ...testContext
        }
      };

      const response = await cdsHooksClient.callService(serviceId, testRequest);
      const executionTime = Date.now() - startTime;

      // Save execution history
      const execution = {
        id: Date.now(),
        serviceId,
        hookType,
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
        message: `Service ${serviceId} executed successfully (${executionTime}ms)`,
        severity: 'success'
      });
    } catch (error) {
      const execution = {
        id: Date.now(),
        serviceId,
        hookType,
        timestamp: new Date().toISOString(),
        executionTime: 0,
        success: false,
        error: error.message,
        context: { patientId: testPatientId, ...testContext }
      };
      saveExecutionHistory(execution);

      setSnackbar({
        open: true,
        message: `Service execution failed: ${error.message}`,
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const clearExecutionHistory = () => {
    setExecutionHistory([]);
    localStorage.removeItem('cds_execution_history');
  };

  const clearAllCards = () => {
    setCards([]);
  };

  const exportServicesConfiguration = async () => {
    try {
      const response = await cdsHooksService.listCustomServices();
      const config = {
        timestamp: new Date().toISOString(),
        customServices: response.data || [],
        availableServices: discoveredServices,
        settings: serviceSettings
      };
      
      const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cds-services-config-${format(new Date(), 'yyyy-MM-dd-HHmm')}.json`;
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

  const filteredServices = customServices.filter(service => 
    service.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    service.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: customServices.length,
    byHookType: customServices.reduce((acc, service) => {
      acc[service.hook] = (acc[service.hook] || 0) + 1;
      return acc;
    }, {}),
    active: customServices.filter(s => s.enabled !== false).length
  };

  // Helper functions for rendering tabs
  const renderServicesTab = () => (
    <Box>
      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Total Custom Services
              </Typography>
              <Typography variant="h4">
                {stats.total}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Active Services
              </Typography>
              <Typography variant="h4">
                {stats.active}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Hook Types Covered
              </Typography>
              <Typography variant="h4">
                {Object.keys(stats.byHookType).length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Services
              </Typography>
              <Typography variant="h4">
                {discoveredServices.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Search and Actions */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <TextField
          placeholder="Search services..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ width: 300 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            )
          }}
        />
        
        <Stack direction="row" spacing={2}>
          <Button 
            startIcon={<ImportExportIcon />}
            onClick={exportServicesConfiguration}
            variant="outlined"
          >
            Export Config
          </Button>
          <Button 
            variant="contained" 
            startIcon={<AddIcon />}
            onClick={() => {
              actions.setCurrentHook({
                id: '',
                title: '',
                description: '',
                hook: 'patient-view',
                prefetch: {},
                usageRequirements: '',
                // Legacy fields for migration
                conditions: [],
                cards: [],
                _meta: {
                  created: null,
                  modified: new Date(),
                  version: 0,
                  author: 'Current User'
                }
              });
              // Switch to Build mode
              actions.switchMode('build');
            }}
          >
            New Service
          </Button>
        </Stack>
      </Box>

      {/* Services Table */}
      {loading ? (
        <Alert severity="info">Loading services...</Alert>
      ) : filteredServices.length === 0 ? (
        <Alert severity="warning">
          {searchTerm ? `No services found matching "${searchTerm}"` : 'No custom services created yet'}
        </Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Service Name</TableCell>
                <TableCell>Responds to Hook</TableCell>
                <TableCell>Prefetch Queries</TableCell>
                <TableCell>Usage Requirements</TableCell>
                <TableCell>Modified</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredServices.map(service => (
                <TableRow key={service.id}>
                  <TableCell>
                    <Typography variant="subtitle2">{service.title || service.id}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {service.description}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={service.hook} size="small" />
                  </TableCell>
                  <TableCell>
                    {service.prefetch ? Object.keys(service.prefetch).length : 0}
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">
                      {service.usageRequirements || 'None specified'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {new Date(service._meta?.modified || Date.now()).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={service.enabled !== false ? 'Active' : 'Inactive'}
                      color={service.enabled !== false ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Tooltip title="Test">
                        <IconButton size="small" onClick={() => executeTestService(service.id, service.hook)}>
                          <TestIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => handleEdit(service)}>
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Duplicate">
                        <IconButton size="small" onClick={() => handleDuplicate(service)}>
                          <DuplicateIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" onClick={() => handleDelete(service.id)} color="error">
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );

  const renderDiscoveryTab = () => (
    <Stack spacing={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h6">Available CDS Services</Typography>
        <Stack direction="row" spacing={1}>
          <Button
            startIcon={<RefreshIcon />}
            onClick={loadCDSServices}
            disabled={loading}
          >
            Refresh Services
          </Button>
          <TextField
            placeholder="Test Patient ID"
            value={testPatientId}
            onChange={(e) => setTestPatientId(e.target.value)}
            size="small"
            sx={{ width: 200 }}
          />
        </Stack>
      </Stack>

      {loading && <CircularProgress />}

      <Grid container spacing={2}>
        {discoveredServices.map((service) => (
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
                  onClick={() => executeTestService(service.id, service.hook)}
                  disabled={loading || !serviceSettings[service.id]?.enabled}
                >
                  Test
                </Button>
                <Button
                  size="small"
                  startIcon={<EditIcon />}
                  onClick={() => {
                    setSelectedService(service);
                    // Switch to build mode by calling parent handler
                    if (onEditService) {
                      onEditService(service);
                    }
                  }}
                >
                  Edit
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Generated Cards */}
      {cards.length > 0 && (
        <Paper sx={{ p: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="subtitle1">Generated CDS Cards</Typography>
            <Button
              startIcon={<CloseIcon />}
              onClick={clearAllCards}
              size="small"
            >
              Clear All
            </Button>
          </Stack>
          
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
        </Paper>
      )}
    </Stack>
  );

  const renderHistoryTab = () => (
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
          No execution history yet. Test some services to see the execution details here.
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
                  primary={`${execution.serviceId || execution.hookId} - ${format(new Date(execution.timestamp), 'PPpp')}`}
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
    <Box>
      {/* Main Tabs */}
      <Paper sx={{ width: '100%', mb: 3 }}>
        <Tabs
          value={tabValue}
          onChange={(event, newValue) => setTabValue(newValue)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab
            icon={<AnalyticsIcon />}
            label="Custom Services"
            id="manage-tab-0"
            aria-controls="manage-tabpanel-0"
          />
          <Tab
            icon={<WebhookIcon />}
            label="Discovery"
            id="manage-tab-1"
            aria-controls="manage-tabpanel-1"
          />
          <Tab
            icon={<HistoryIcon />}
            label="History"
            id="manage-tab-2"
            aria-controls="manage-tabpanel-2"
          />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          {renderServicesTab()}
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          {renderDiscoveryTab()}
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          {renderHistoryTab()}
        </TabPanel>
      </Paper>

      {/* More Actions Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem onClick={() => setAnchorEl(null)}>View Analytics</MenuItem>
        <MenuItem onClick={() => setAnchorEl(null)}>Export Service</MenuItem>
        <MenuItem onClick={() => setAnchorEl(null)}>Share</MenuItem>
      </Menu>

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

export default CDSManageMode;