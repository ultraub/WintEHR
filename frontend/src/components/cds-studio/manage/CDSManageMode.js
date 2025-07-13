/**
 * CDS Manage Mode - Comprehensive CDS hooks management, services, and history
 * Consolidated interface combining hook management, service discovery, and execution tracking
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
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ContentCopy as DuplicateIcon,
  MoreVert as MoreIcon,
  Analytics as AnalyticsIcon,
  Group as TeamIcon,
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

const CDSManageMode = () => {
  const { actions } = useCDSStudio();
  const [tabValue, setTabValue] = useState(0);
  const [hooks, setHooks] = useState([]);
  const [services, setServices] = useState([]);
  const [executionHistory, setExecutionHistory] = useState([]);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedHook, setSelectedHook] = useState(null);
  const [serviceSettings, setServiceSettings] = useState({});
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
    loadHooks();
    loadCDSServices();
    loadExecutionHistory();
  }, []);

  const loadHooks = async () => {
    try {
      setLoading(true);
      const response = await cdsHooksService.listCustomHooks();
      setHooks(response.data || []);
    } catch (error) {
      console.error('Failed to load hooks:', error);
      setSnackbar({
        open: true,
        message: `Failed to load hooks: ${error.message}`,
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadCDSServices = async () => {
    try {
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

  const handleEdit = (hook) => {
    // The hook should already be in frontend format from listCustomHooks
    // But ensure it has the required _meta structure for editing
    const editableHook = {
      ...hook,
      _meta: {
        created: hook._meta?.created || (hook.created_at ? new Date(hook.created_at) : new Date()),
        modified: hook._meta?.modified || (hook.updated_at ? new Date(hook.updated_at) : new Date()),
        version: hook._meta?.version || 1,
        author: hook._meta?.author || 'Current User'
      }
    };
    
    actions.setCurrentHook(editableHook);
    
    // Switch to build mode
    if (actions.switchMode) {
      actions.switchMode('build');
    }
  };

  const handleDelete = async (hookId) => {
    if (window.confirm('Are you sure you want to delete this hook?')) {
      try {
        await cdsHooksService.deleteHook(hookId);
        await loadHooks();
      } catch (error) {
        
      }
    }
  };

  const handleDuplicate = async (hook) => {
    const duplicate = {
      ...hook,
      id: undefined,
      title: `${hook.title} (Copy)`,
      _meta: {
        ...hook._meta,
        created: new Date(),
        modified: new Date()
      }
    };
    
    try {
      await cdsHooksService.createHook(duplicate);
      await loadHooks();
      setSnackbar({
        open: true,
        message: 'Hook duplicated successfully',
        severity: 'success'
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: `Failed to duplicate hook: ${error.message}`,
        severity: 'error'
      });
    }
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

  const clearExecutionHistory = () => {
    setExecutionHistory([]);
    localStorage.removeItem('cds_execution_history');
  };

  const clearAllCards = () => {
    setCards([]);
  };

  const exportHooksConfiguration = async () => {
    try {
      const response = await cdsHooksService.listCustomHooks();
      const config = {
        timestamp: new Date().toISOString(),
        hooks: response.data || [],
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

  const filteredHooks = hooks.filter(hook => 
    hook.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    hook.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: hooks.length,
    byType: hooks.reduce((acc, hook) => {
      acc[hook.hook] = (acc[hook.hook] || 0) + 1;
      return acc;
    }, {}),
    active: hooks.filter(h => h.enabled !== false).length
  };

  // Helper functions for rendering tabs
  const renderHooksTab = () => (
    <Box>
      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Total Hooks
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
                Active Hooks
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
                Hook Types
              </Typography>
              <Typography variant="h4">
                {Object.keys(stats.byType).length}
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
                {services.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Search and Actions */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <TextField
          placeholder="Search hooks..."
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
            onClick={exportHooksConfiguration}
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
                conditions: [],
                cards: [],
                prefetch: {}
              });
            }}
          >
            New Hook
          </Button>
        </Stack>
      </Box>

      {/* Hooks Table */}
      {loading ? (
        <Alert severity="info">Loading hooks...</Alert>
      ) : filteredHooks.length === 0 ? (
        <Alert severity="warning">
          {searchTerm ? `No hooks found matching "${searchTerm}"` : 'No hooks created yet'}
        </Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Hook Type</TableCell>
                <TableCell>Conditions</TableCell>
                <TableCell>Cards</TableCell>
                <TableCell>Modified</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredHooks.map(hook => (
                <TableRow key={hook.id}>
                  <TableCell>
                    <Typography variant="subtitle2">{hook.title}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {hook.description}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={hook.hook} size="small" />
                  </TableCell>
                  <TableCell>{hook.conditions?.length || 0}</TableCell>
                  <TableCell>{hook.cards?.length || 0}</TableCell>
                  <TableCell>
                    {new Date(hook._meta?.modified || Date.now()).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={hook.enabled !== false ? 'Active' : 'Inactive'}
                      color={hook.enabled !== false ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Tooltip title="Test">
                        <IconButton size="small" onClick={() => executeTestHook(hook.id)}>
                          <TestIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => handleEdit(hook)}>
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Duplicate">
                        <IconButton size="small" onClick={() => handleDuplicate(hook)}>
                          <DuplicateIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" onClick={() => handleDelete(hook.id)} color="error">
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
                    // Switch to build mode would be handled by parent
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
            label="Hooks"
            id="manage-tab-0"
            aria-controls="manage-tabpanel-0"
          />
          <Tab
            icon={<WebhookIcon />}
            label="Services"
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
          {renderHooksTab()}
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          {renderServicesTab()}
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
        <MenuItem onClick={() => setAnchorEl(null)}>Export Hook</MenuItem>
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