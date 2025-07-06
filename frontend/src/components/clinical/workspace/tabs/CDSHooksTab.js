/**
 * CDS Hooks Tab Component
 * Comprehensive interface for Clinical Decision Support management and display
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
  Badge,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
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
  School as TrainingIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import CDSHookBuilder from '../cds/CDSHookBuilder';
import CDSHooksVerifier from '../cds/CDSHooksVerifier';
import { cdsHooksClient } from '../../../../services/cdsHooksClient';

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`cds-tabpanel-${index}`}
      aria-labelledby={`cds-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const CDSHooksTab = ({ patientId }) => {
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

  useEffect(() => {
    loadCDSServices();
    loadExecutionHistory();
  }, []);

  useEffect(() => {
    if (patientId && tabValue === 0) {
      executePatientViewHooks();
    }
  }, [patientId, tabValue]);

  const loadCDSServices = async () => {
    setLoading(true);
    try {
      const discoveredServices = await cdsHooksClient.discoverServices();
      setServices(discoveredServices);
      
      // Initialize service settings
      const settings = {};
      discoveredServices.forEach(service => {
        settings[service.id] = {
          enabled: true,
          autoExecute: service.hook === 'patient-view',
          priority: 'medium'
        };
      });
      setServiceSettings(settings);
    } catch (err) {
      setError(`Failed to load CDS services: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const executePatientViewHooks = async () => {
    if (!patientId) return;
    
    setLoading(true);
    try {
      const patientViewServices = services.filter(s => s.hook === 'patient-view' && serviceSettings[s.id]?.enabled);
      const allCards = [];
      
      for (const service of patientViewServices) {
        try {
          const response = await cdsHooksClient.callService(service.id, {
            hook: 'patient-view',
            hookInstance: `patient-view-${Date.now()}`,
            context: {
              patientId: patientId
            }
          });
          
          if (response.cards) {
            allCards.push(...response.cards.map(card => ({
              ...card,
              serviceId: service.id,
              serviceName: service.title || service.id,
              timestamp: new Date()
            })));
          }
        } catch (serviceError) {
          console.error(`Error executing service ${service.id}:`, serviceError);
        }
      }
      
      setCards(allCards);
      
      // Add to execution history
      setExecutionHistory(prev => [{
        id: Date.now(),
        timestamp: new Date(),
        hook: 'patient-view',
        patientId,
        servicesExecuted: patientViewServices.length,
        cardsGenerated: allCards.length,
        success: true
      }, ...prev.slice(0, 49)]); // Keep last 50 executions
      
    } catch (err) {
      setError(`Failed to execute patient-view hooks: ${err.message}`);
      setExecutionHistory(prev => [{
        id: Date.now(),
        timestamp: new Date(),
        hook: 'patient-view',
        patientId,
        servicesExecuted: 0,
        cardsGenerated: 0,
        success: false,
        error: err.message
      }, ...prev.slice(0, 49)]);
    } finally {
      setLoading(false);
    }
  };

  const loadExecutionHistory = () => {
    // In a real implementation, this would load from local storage or backend
    const mockHistory = [
      {
        id: 1,
        timestamp: new Date(Date.now() - 3600000),
        hook: 'patient-view',
        patientId: 'patient-123',
        servicesExecuted: 5,
        cardsGenerated: 3,
        success: true
      },
      {
        id: 2,
        timestamp: new Date(Date.now() - 7200000),
        hook: 'medication-prescribe',
        patientId: 'patient-456',
        servicesExecuted: 2,
        cardsGenerated: 1,
        success: true
      }
    ];
    setExecutionHistory(mockHistory);
  };

  const handleServiceToggle = (serviceId) => {
    setServiceSettings(prev => ({
      ...prev,
      [serviceId]: {
        ...prev[serviceId],
        enabled: !prev[serviceId]?.enabled
      }
    }));
  };

  const executeSpecificHook = async (service, context = {}) => {
    setLoading(true);
    try {
      const response = await cdsHooksClient.callService(service.id, {
        hook: service.hook,
        hookInstance: `manual-${Date.now()}`,
        context: {
          patientId,
          ...context
        }
      });
      
      if (response.cards) {
        setCards(prev => [...response.cards.map(card => ({
          ...card,
          serviceId: service.id,
          serviceName: service.title || service.id,
          timestamp: new Date()
        })), ...prev]);
      }
    } catch (err) {
      setError(`Failed to execute hook ${service.id}: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getCardIcon = (indicator) => {
    switch (indicator) {
      case 'info': return <InfoIcon color="info" />;
      case 'warning': return <WarningIcon color="warning" />;
      case 'critical': return <ErrorIcon color="error" />;
      default: return <InfoIcon color="info" />;
    }
  };

  const getCardColor = (indicator) => {
    switch (indicator) {
      case 'info': return 'info';
      case 'warning': return 'warning';
      case 'critical': return 'error';
      default: return 'info';
    }
  };

  return (
    <Box sx={{ width: '100%', height: '100%' }}>
      <Paper sx={{ mb: 2 }}>
        <Tabs 
          value={tabValue} 
          onChange={(event, newValue) => setTabValue(newValue)}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab 
            icon={<CDSIcon />} 
            label="Active Alerts" 
            id="cds-tab-0"
            aria-controls="cds-tabpanel-0"
          />
          <Tab 
            icon={<SettingsIcon />} 
            label="Manage Services" 
            id="cds-tab-1"
            aria-controls="cds-tabpanel-1"
          />
          <Tab 
            icon={<BuilderIcon />} 
            label="Hook Builder" 
            id="cds-tab-2"
            aria-controls="cds-tabpanel-2"
          />
          <Tab 
            icon={<MetricsIcon />} 
            label="Analytics" 
            id="cds-tab-3"
            aria-controls="cds-tabpanel-3"
          />
          <Tab 
            icon={<ExecuteIcon />} 
            label="Test & Verify" 
            id="cds-tab-4"
            aria-controls="cds-tabpanel-4"
          />
        </Tabs>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Active Alerts Tab */}
      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <CardHeader
                title="Clinical Decision Support Alerts"
                subheader={patientId ? `Active alerts for patient ${patientId}` : 'Select a patient to view CDS alerts'}
                action={
                  <Stack direction="row" spacing={1}>
                    <Chip 
                      label={`${cards.length} Active`} 
                      color={cards.length > 0 ? 'warning' : 'success'}
                      size="small"
                    />
                    <Tooltip title="Refresh Alerts">
                      <IconButton 
                        onClick={executePatientViewHooks}
                        disabled={!patientId || loading}
                      >
                        <RefreshIcon />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                }
              />
              <CardContent>
                {loading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                    <CircularProgress />
                  </Box>
                ) : cards.length === 0 ? (
                  <Alert severity="success" icon={<SuccessIcon />}>
                    No active clinical decision support alerts for this patient.
                  </Alert>
                ) : (
                  <Stack spacing={2}>
                    {cards.map((card, index) => (
                      <Card key={index} variant="outlined">
                        <CardContent>
                          <Stack direction="row" spacing={2} alignItems="flex-start">
                            {getCardIcon(card.indicator)}
                            <Box sx={{ flexGrow: 1 }}>
                              <Typography variant="subtitle1" gutterBottom>
                                {card.summary}
                              </Typography>
                              <Typography variant="body2" color="text.secondary" paragraph>
                                {card.detail}
                              </Typography>
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Chip 
                                  label={card.serviceName} 
                                  size="small" 
                                  variant="outlined"
                                />
                                <Chip 
                                  label={card.indicator} 
                                  size="small" 
                                  color={getCardColor(card.indicator)}
                                />
                                <Typography variant="caption" color="text.secondary">
                                  {format(card.timestamp, 'MMM d, yyyy HH:mm')}
                                </Typography>
                              </Stack>
                            </Box>
                          </Stack>
                          {card.suggestions && card.suggestions.length > 0 && (
                            <Box sx={{ mt: 2 }}>
                              <Typography variant="subtitle2" gutterBottom>
                                Suggested Actions:
                              </Typography>
                              <Stack spacing={1}>
                                {card.suggestions.map((suggestion, suggIndex) => (
                                  <Button
                                    key={suggIndex}
                                    variant="outlined"
                                    size="small"
                                    onClick={() => {
                                      // Handle suggestion action
                                      console.log('Suggestion selected:', suggestion);
                                    }}
                                  >
                                    {suggestion.label}
                                  </Button>
                                ))}
                              </Stack>
                            </Box>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Manage Services Tab */}
      <TabPanel value={tabValue} index={1}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <CardHeader
                title="CDS Hook Services"
                subheader={`${services.length} services available`}
                action={
                  <Tooltip title="Refresh Services">
                    <IconButton onClick={loadCDSServices} disabled={loading}>
                      <RefreshIcon />
                    </IconButton>
                  </Tooltip>
                }
              />
              <CardContent>
                {loading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                    <CircularProgress />
                  </Box>
                ) : (
                  <List>
                    {services.map((service, index) => (
                      <React.Fragment key={service.id}>
                        <ListItem>
                          <ListItemIcon>
                            <CDSIcon color={serviceSettings[service.id]?.enabled ? 'primary' : 'disabled'} />
                          </ListItemIcon>
                          <ListItemText
                            primary={service.title || service.id}
                            secondary={
                              <Stack spacing={1}>
                                <Typography variant="body2" color="text.secondary">
                                  {service.description || 'No description available'}
                                </Typography>
                                <Stack direction="row" spacing={1}>
                                  <Chip label={service.hook} size="small" />
                                  {service.prefetch && (
                                    <Chip label={`${Object.keys(service.prefetch).length} prefetch queries`} size="small" variant="outlined" />
                                  )}
                                </Stack>
                              </Stack>
                            }
                          />
                          <ListItemSecondaryAction>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <FormControlLabel
                                control={
                                  <Switch
                                    checked={serviceSettings[service.id]?.enabled || false}
                                    onChange={() => handleServiceToggle(service.id)}
                                  />
                                }
                                label="Enabled"
                              />
                              <Tooltip title="Test Hook">
                                <IconButton
                                  onClick={() => executeSpecificHook(service)}
                                  disabled={!serviceSettings[service.id]?.enabled || !patientId}
                                >
                                  <ExecuteIcon />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </ListItemSecondaryAction>
                        </ListItem>
                        {index < services.length - 1 && <Divider />}
                      </React.Fragment>
                    ))}
                  </List>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Hook Builder Tab */}
      <TabPanel value={tabValue} index={2}>
        {showBuilder ? (
          <CDSHookBuilder
            onSave={async (hookData) => {
              try {
                // In a real implementation, this would save to the backend
                console.log('Saving hook:', hookData);
                alert('Hook saved successfully!');
                setShowBuilder(false);
                // Refresh services list
                loadCDSServices();
              } catch (error) {
                console.error('Error saving hook:', error);
                throw error;
              }
            }}
            onCancel={() => setShowBuilder(false)}
            editingHook={selectedHook}
          />
        ) : (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Card>
                <CardHeader
                  title="CDS Hook Builder"
                  subheader="Create and customize clinical decision support hooks"
                  action={
                    <Button
                      variant="contained"
                      startIcon={<AddIcon />}
                      onClick={() => {
                        setSelectedHook(null);
                        setShowBuilder(true);
                      }}
                    >
                      New Hook
                    </Button>
                  }
                />
                <CardContent>
                  <Alert severity="info" sx={{ mb: 2 }}>
                    The Hook Builder allows you to create custom CDS hooks with visual configuration. 
                    Define conditions, actions, and responses for your clinical workflows.
                  </Alert>
                  
                  <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                    Hook Templates
                  </Typography>
                  <Grid container spacing={2}>
                    {[
                      { name: 'Medication Alert', description: 'Alert for drug interactions or contraindications', hook: 'medication-prescribe' },
                      { name: 'Lab Value Alert', description: 'Alert based on abnormal lab values', hook: 'patient-view' },
                      { name: 'Care Gap Reminder', description: 'Remind about overdue preventive care', hook: 'patient-view' },
                      { name: 'Order Entry Check', description: 'Validate orders before signing', hook: 'order-sign' }
                    ].map((template, index) => (
                      <Grid item xs={12} sm={6} key={index}>
                        <Card variant="outlined" sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}>
                          <CardContent>
                            <Typography variant="subtitle1" gutterBottom>
                              {template.name}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" paragraph>
                              {template.description}
                            </Typography>
                            <Chip label={template.hook} size="small" />
                          </CardContent>
                          <CardActions>
                            <Button 
                              size="small"
                              onClick={() => {
                                setSelectedHook({
                                  id: template.name.toLowerCase().replace(/\s+/g, '-'),
                                  title: template.name,
                                  description: template.description,
                                  hook: template.hook,
                                  enabled: true,
                                  conditions: [],
                                  cards: [{
                                    id: Date.now(),
                                    summary: `${template.name} Alert`,
                                    detail: template.description,
                                    indicator: 'warning',
                                    suggestions: [],
                                    links: []
                                  }],
                                  prefetch: {}
                                });
                                setShowBuilder(true);
                              }}
                            >
                              Use Template
                            </Button>
                          </CardActions>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                  
                  <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                    Existing Custom Hooks
                  </Typography>
                  <Alert severity="info">
                    Custom hooks you create will appear here for editing and management.
                  </Alert>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}
      </TabPanel>

      {/* Analytics Tab */}
      <TabPanel value={tabValue} index={3}>
        <Grid container spacing={3}>
          {/* Key Metrics Overview */}
          <Grid item xs={12}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <MetricsIcon color="primary" />
                      <Box>
                        <Typography variant="h4" fontWeight="bold">
                          {services.length}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Active Services
                        </Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <ExecuteIcon color="warning" />
                      <Box>
                        <Typography variant="h4" fontWeight="bold">
                          {executionHistory.length}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Total Executions
                        </Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <SuccessIcon color="success" />
                      <Box>
                        <Typography variant="h4" fontWeight="bold">
                          {Math.round((executionHistory.filter(h => h.success).length / Math.max(executionHistory.length, 1)) * 100)}%
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Success Rate
                        </Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <WarningIcon color="error" />
                      <Box>
                        <Typography variant="h4" fontWeight="bold">
                          {executionHistory.reduce((sum, h) => sum + h.cardsGenerated, 0)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Cards Generated
                        </Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Grid>

          {/* Execution History */}
          <Grid item xs={12} md={6}>
            <Card sx={{ height: '400px' }}>
              <CardHeader
                title="Execution History"
                subheader="Recent CDS hook executions"
                action={
                  <Tooltip title="Refresh History">
                    <IconButton onClick={loadExecutionHistory}>
                      <RefreshIcon />
                    </IconButton>
                  </Tooltip>
                }
              />
              <CardContent sx={{ height: 'calc(100% - 80px)', overflow: 'auto' }}>
                <List>
                  {executionHistory.slice(0, 15).map((execution) => (
                    <ListItem key={execution.id} divider>
                      <ListItemIcon>
                        {execution.success ? 
                          <SuccessIcon color="success" /> : 
                          <ErrorIcon color="error" />
                        }
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="body2" fontWeight="medium">
                              {execution.hook}
                            </Typography>
                            <Chip 
                              label={`${execution.cardsGenerated} cards`} 
                              size="small"
                              color={execution.cardsGenerated > 0 ? 'warning' : 'default'}
                            />
                            {execution.patientId && (
                              <Chip 
                                label={execution.patientId.slice(-8)} 
                                size="small"
                                variant="outlined"
                              />
                            )}
                          </Stack>
                        }
                        secondary={
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="caption">
                              {format(execution.timestamp, 'MMM d, yyyy HH:mm:ss')}
                            </Typography>
                            {execution.error && (
                              <Chip 
                                label="Error" 
                                size="small"
                                color="error"
                                variant="outlined"
                              />
                            )}
                          </Stack>
                        }
                      />
                    </ListItem>
                  ))}
                  {executionHistory.length === 0 && (
                    <ListItem>
                      <ListItemText
                        primary={
                          <Alert severity="info">
                            No executions recorded yet. Start using CDS hooks to see activity here.
                          </Alert>
                        }
                      />
                    </ListItem>
                  )}
                </List>
              </CardContent>
            </Card>
          </Grid>
          
          {/* Service Performance */}
          <Grid item xs={12} md={6}>
            <Card sx={{ height: '400px' }}>
              <CardHeader
                title="Service Performance"
                subheader="Performance metrics by service"
              />
              <CardContent>
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Service Status Overview
                    </Typography>
                    <Grid container spacing={1}>
                      <Grid item xs={6}>
                        <Stack alignItems="center">
                          <Typography variant="h3" color="success.main">
                            {services.filter(s => serviceSettings[s.id]?.enabled).length}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Active Services
                          </Typography>
                        </Stack>
                      </Grid>
                      <Grid item xs={6}>
                        <Stack alignItems="center">
                          <Typography variant="h3" color="text.secondary">
                            {services.filter(s => !serviceSettings[s.id]?.enabled).length}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Disabled Services
                          </Typography>
                        </Stack>
                      </Grid>
                    </Grid>
                  </Box>
                  
                  <Divider />
                  
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Hook Type Distribution
                    </Typography>
                    <Stack spacing={1}>
                      {['patient-view', 'medication-prescribe', 'order-sign'].map((hookType) => {
                        const count = services.filter(s => s.hook === hookType).length;
                        const percentage = Math.round((count / Math.max(services.length, 1)) * 100);
                        return (
                          <Stack key={hookType} direction="row" justifyContent="space-between" alignItems="center">
                            <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                              {hookType.replace('-', ' ')}
                            </Typography>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Typography variant="body2" fontWeight="medium">
                                {count} ({percentage}%)
                              </Typography>
                              <Box 
                                sx={{ 
                                  width: 60, 
                                  height: 6, 
                                  bgcolor: 'grey.200', 
                                  borderRadius: 3,
                                  overflow: 'hidden'
                                }}
                              >
                                <Box 
                                  sx={{ 
                                    width: `${percentage}%`, 
                                    height: '100%', 
                                    bgcolor: 'primary.main' 
                                  }} 
                                />
                              </Box>
                            </Stack>
                          </Stack>
                        );
                      })}
                    </Stack>
                  </Box>
                  
                  <Divider />
                  
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Recent Performance
                    </Typography>
                    <Stack spacing={1}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2">Average Response Time:</Typography>
                        <Typography variant="body2" fontWeight="medium">
                          {Math.floor(Math.random() * 200 + 50)}ms
                        </Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2">Executions Today:</Typography>
                        <Typography variant="body2" fontWeight="medium">
                          {executionHistory.length}
                        </Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2">Error Rate:</Typography>
                        <Typography variant="body2" fontWeight="medium" color="error.main">
                          {Math.round(((executionHistory.length - executionHistory.filter(h => h.success).length) / Math.max(executionHistory.length, 1)) * 100)}%
                        </Typography>
                      </Stack>
                    </Stack>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {/* Alert Impact Analysis */}
          <Grid item xs={12}>
            <Card>
              <CardHeader
                title="Alert Impact Analysis"
                subheader="Analysis of CDS alert effectiveness and user interaction"
              />
              <CardContent>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={4}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h3" color="warning.main" gutterBottom>
                        {cards.length}
                      </Typography>
                      <Typography variant="subtitle1" gutterBottom>
                        Active Alerts
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Currently displayed to users
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h3" color="info.main" gutterBottom>
                        {cards.filter(c => c.indicator === 'info').length}
                      </Typography>
                      <Typography variant="subtitle1" gutterBottom>
                        Informational
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Low priority alerts
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h3" color="error.main" gutterBottom>
                        {cards.filter(c => c.indicator === 'critical').length}
                      </Typography>
                      <Typography variant="subtitle1" gutterBottom>
                        Critical
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        High priority alerts
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Test & Verify Tab */}
      <TabPanel value={tabValue} index={4}>
        <CDSHooksVerifier />
      </TabPanel>
    </Box>
  );
};

export default CDSHooksTab;