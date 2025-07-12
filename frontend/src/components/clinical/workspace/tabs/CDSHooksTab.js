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
  Close as CloseIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import CDSHookBuilder from '../cds/CDSHookBuilder';
import CDSHooksVerifier from '../cds/CDSHooksVerifier';
import CDSCardDisplay from '../cds/CDSCardDisplay';
import { cdsHooksClient } from '../../../../services/cdsHooksClient';
import { cdsHooksService } from '../../../../services/cdsHooksService';
import { fhirClient } from '../../../../services/fhirClient';
import { useNavigate } from 'react-router-dom';
import { useClinicalWorkflow, CLINICAL_EVENTS } from '../../../../contexts/ClinicalWorkflowContext';

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
  const navigate = useNavigate();
  const { publish, subscribe } = useClinicalWorkflow();
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

  useEffect(() => {
    if (patientId && tabValue === 0) {
      executePatientViewHooks();
    }
  }, [patientId, tabValue]);

  // Subscribe to CDS-relevant events
  useEffect(() => {
    const unsubscribers = [];

    // Subscribe to medication events for drug-drug interaction checks
    unsubscribers.push(
      subscribe(CLINICAL_EVENTS.MEDICATION_STATUS_CHANGED, async (data) => {
        if (data.patientId === patientId) {
          // Re-execute medication-related hooks
          const medicationServices = services.filter(s => 
            (s.hook === 'medication-prescribe' || s.hook === 'order-sign') && 
            serviceSettings[s.id]?.enabled
          );
          
          if (medicationServices.length > 0) {
            await executeHooksForServices(medicationServices, 'medication-update');
          }
        }
      })
    );

    // Subscribe to order events for order-sign hooks
    unsubscribers.push(
      subscribe(CLINICAL_EVENTS.ORDER_PLACED, async (data) => {
        if (data.patientId === patientId) {
          // Execute order-sign hooks
          const orderServices = services.filter(s => 
            s.hook === 'order-sign' && serviceSettings[s.id]?.enabled
          );
          
          if (orderServices.length > 0) {
            await executeHooksForServices(orderServices, 'order-sign');
          }
        }
      })
    );

    // Cleanup subscriptions
    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, [patientId, services, serviceSettings, subscribe]);

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

  const executeHooksForServices = async (servicesToExecute, context) => {
    setLoading(true);
    const startTime = Date.now();
    const allCards = [];
    
    try {
      for (const service of servicesToExecute) {
        try {
          const response = await cdsHooksClient.callService(service.id, {
            hook: service.hook,
            hookInstance: `${service.hook}-${Date.now()}`,
            context: { patientId }
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
          // Continue with other services
        }
      }
      
      if (allCards.length > 0) {
        // Filter out duplicate cards based on summary and serviceId
        setCards(prevCards => {
          const existingCardKeys = new Set(
            prevCards.map(card => `${card.serviceId}-${card.summary}`)
          );
          
          const newCards = allCards.filter(card => 
            !existingCardKeys.has(`${card.serviceId}-${card.summary}`)
          );
          
          // Add new cards at the beginning, limit to most recent 50
          return [...newCards, ...prevCards].slice(0, 50);
        });
        
        // Publish CDS alerts
        await publish(CLINICAL_EVENTS.CDS_ALERT_TRIGGERED, {
          patientId,
          alertCount: allCards.length,
          context,
          alerts: allCards.map(card => ({
            summary: card.summary,
            indicator: card.indicator,
            source: card.serviceName
          })),
          timestamp: new Date().toISOString()
        });
      }
      
      // Update execution history
      const newExecution = {
        id: Date.now(),
        timestamp: new Date(),
        hook: context,
        patientId,
        servicesExecuted: servicesToExecute.length,
        cardsGenerated: allCards.length,
        success: true,
        responseTime: Date.now() - startTime
      };
      
      setExecutionHistory(prev => [newExecution, ...prev].slice(0, 50));
    } catch (err) {
      setError(`Failed to execute hooks: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const executePatientViewHooks = async () => {
    if (!patientId) return;
    
    setLoading(true);
    const startTime = Date.now();
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
          // Error executing service - add to results with error status
        }
      }
      
      // Apply deduplication logic like in executeHooksForServices
      setCards(prevCards => {
        const existingCardKeys = new Set(
          prevCards.map(card => `${card.serviceId}-${card.summary}`)
        );
        
        const newCards = allCards.filter(card => 
          !existingCardKeys.has(`${card.serviceId}-${card.summary}`)
        );
        
        // Replace with new cards (since this is a refresh)
        return allCards;
      });
      
      // Publish CDS alerts triggered event if we have cards
      if (allCards.length > 0) {
        await publish(CLINICAL_EVENTS.CDS_ALERT_TRIGGERED, {
          patientId,
          alertCount: allCards.length,
          alerts: allCards.map(card => ({
            summary: card.summary,
            indicator: card.indicator,
            source: card.serviceName
          })),
          timestamp: new Date().toISOString()
        });
      }
      
      // Add to execution history
      const newExecution = {
        id: Date.now(),
        timestamp: new Date(),
        hook: 'patient-view',
        patientId,
        servicesExecuted: patientViewServices.length,
        cardsGenerated: allCards.length,
        success: true,
        responseTime: Date.now() - startTime
      };
      const updatedHistory = [newExecution, ...executionHistory].slice(0, 50);
      setExecutionHistory(updatedHistory);
      saveExecutionHistory(updatedHistory);
      
    } catch (err) {
      setError(`Failed to execute patient-view hooks: ${err.message}`);
      const failedExecution = {
        id: Date.now(),
        timestamp: new Date(),
        hook: 'patient-view',
        patientId,
        servicesExecuted: 0,
        cardsGenerated: 0,
        success: false,
        error: err.message,
        responseTime: Date.now() - startTime
      };
      const updatedHistory = [failedExecution, ...executionHistory].slice(0, 50);
      setExecutionHistory(updatedHistory);
      saveExecutionHistory(updatedHistory);
    } finally {
      setLoading(false);
    }
  };

  const loadExecutionHistory = async () => {
    try {
      // Load from localStorage for persistence
      const storedHistory = localStorage.getItem('cds-execution-history');
      if (storedHistory) {
        const parsed = JSON.parse(storedHistory);
        // Convert string timestamps back to Date objects
        const history = parsed.map(entry => ({
          ...entry,
          timestamp: new Date(entry.timestamp)
        }));
        setExecutionHistory(history);
      } else {
        // Initialize with empty history
        setExecutionHistory([]);
      }
    } catch (error) {
      // Failed to load history - start fresh
      setExecutionHistory([]);
    }
  };

  const loadCustomHooks = async () => {
    try {
      const result = await cdsHooksService.listCustomHooks();
      if (result.success) {
        setCustomHooks(result.data);
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: `Failed to load custom hooks: ${error.message}`,
        severity: 'error'
      });
      setCustomHooks([]);
    }
  };

  // Save execution history to localStorage
  const saveExecutionHistory = (history) => {
    try {
      localStorage.setItem('cds-execution-history', JSON.stringify(history));
    } catch (error) {
      // Failed to save to localStorage - non-critical error
      console.warn('Failed to save execution history to localStorage:', error);
    }
  };

  // Calculate average response time from execution history
  const calculateAverageResponseTime = () => {
    const recentExecutions = executionHistory.filter(h => h.responseTime).slice(0, 20);
    if (recentExecutions.length === 0) return 0;
    const sum = recentExecutions.reduce((acc, h) => acc + h.responseTime, 0);
    return Math.round(sum / recentExecutions.length);
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
        const newCards = response.cards.map(card => ({
          ...card,
          serviceId: service.id,
          serviceName: service.title || service.id,
          timestamp: new Date()
        }));
        
        // Apply deduplication
        setCards(prevCards => {
          const existingCardKeys = new Set(
            prevCards.map(card => `${card.serviceId}-${card.summary}`)
          );
          
          const uniqueNewCards = newCards.filter(card => 
            !existingCardKeys.has(`${card.serviceId}-${card.summary}`)
          );
          
          // Add new unique cards at the beginning, limit to 50
          return [...uniqueNewCards, ...prevCards].slice(0, 50);
        });
      }
    } catch (err) {
      setError(`Failed to execute hook ${service.id}: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDismissCard = (cardIndex) => {
    setCards(prevCards => prevCards.filter((_, index) => index !== cardIndex));
    setSnackbar({
      open: true,
      message: 'Alert dismissed',
      severity: 'info'
    });
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
      default: return 'default';
    }
  };

  const handleSuggestionAction = async (suggestion, card) => {
    try {
      // Handle different types of CDS suggestions
      if (suggestion.actions && suggestion.actions.length > 0) {
        for (const action of suggestion.actions) {
          switch (action.type) {
            case 'create':
              // Create a new FHIR resource
              if (action.resource) {
                const resourceType = action.resource.resourceType;
                await fhirClient.create(resourceType, action.resource);
                setError(`Created new ${resourceType}`);
              }
              break;
              
            case 'update':
              // Update an existing FHIR resource
              if (action.resource && action.resource.id) {
                const resourceType = action.resource.resourceType;
                await fhirClient.update(resourceType, action.resource.id, action.resource);
                setError(`Updated ${resourceType}`);
              }
              break;
              
            case 'delete':
              // Delete a FHIR resource
              if (action.resource && action.resource.id) {
                const resourceType = action.resource.resourceType;
                await fhirClient.delete(resourceType, action.resource.id);
                setError(`Deleted ${resourceType}`);
              }
              break;
              
            default:
              
          }
        }
      }
      
      // Handle navigation suggestions (links)
      if (suggestion.links && suggestion.links.length > 0) {
        const link = suggestion.links[0];
        if (link.type === 'absolute') {
          window.open(link.url, '_blank');
        } else if (link.type === 'smart') {
          // Handle SMART app links
          navigate(link.url);
        }
      }
      
      // Handle resource creation/update/delete arrays
      if (suggestion.create && suggestion.create.length > 0) {
        for (const resource of suggestion.create) {
          await fhirClient.create(resource.resourceType, resource);
        }
        setError(`Created ${suggestion.create.length} resource(s)`);
      }
      
      if (suggestion.update && suggestion.update.length > 0) {
        for (const resource of suggestion.update) {
          await fhirClient.update(resource.resourceType, resource.id, resource);
        }
        setError(`Updated ${suggestion.update.length} resource(s)`);
      }
      
      if (suggestion.delete && suggestion.delete.length > 0) {
        for (const resourceRef of suggestion.delete) {
          const [resourceType, resourceId] = resourceRef.split('/');
          await fhirClient.delete(resourceType, resourceId);
        }
        setError(`Deleted ${suggestion.delete.length} resource(s)`);
      }
      
      // Refresh patient data after actions
      if (patientId) {
        await fhirClient.refreshPatientResources(patientId);
      }
      
      // Send feedback to CDS service
      if (card.serviceId && suggestion.uuid) {
        try {
          await cdsHooksClient.sendFeedback(card.serviceId, {
            card: card.uuid || card.summary,
            outcome: 'accepted',
            acceptedSuggestions: [{ id: suggestion.uuid }]
          });
        } catch (feedbackError) {
          setSnackbar({
            open: true,
            message: `Failed to send feedback: ${feedbackError.message}`,
            severity: 'error'
          });
        }
      }
      
      // Show success message
      setError(null);
      // Refresh hooks to see updated results
      if (tabValue === 0) {
        await executePatientViewHooks();
      }
      
    } catch (error) {
      
      setError(`Failed to execute action: ${error.message}`);
    }
  };

  const handleDeleteHook = async (hookId) => {
    if (window.confirm('Are you sure you want to delete this hook? This action cannot be undone.')) {
      try {
        await cdsHooksService.deleteHook(hookId);
        
        // Refresh the custom hooks list
        await loadCustomHooks();
        
        // Refresh services list to remove deleted hook
        await loadCDSServices();
        
      } catch (error) {
        
        setSnackbar({
          open: true,
          message: `Failed to delete hook: ${error.message}`,
          severity: 'error'
        });
      }
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
                    {cards.length > 0 && (
                      <Button
                        size="small"
                        onClick={() => {
                          setCards([]);
                          setSnackbar({
                            open: true,
                            message: 'All alerts cleared',
                            severity: 'info'
                          });
                        }}
                        disabled={loading}
                      >
                        Clear All
                      </Button>
                    )}
                    <Tooltip title="Refresh Alerts">
                      <IconButton 
                        onClick={() => {
                          setCards([]); // Clear existing cards before refresh
                          executePatientViewHooks();
                        }}
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
                  <CDSCardDisplay
                    cards={cards}
                    displayBehavior={displayBehavior}
                    onDismiss={(card, index) => handleDismissCard(index)}
                    onAction={handleSuggestionAction}
                    patientName={patientId}
                  />
                )}
              </CardContent>
            </Card>
          </Grid>
          
          {/* Display Settings */}
          <Grid item xs={12}>
            <Card>
              <CardHeader
                title="Display Settings"
                subheader="Configure how CDS alerts are displayed"
                avatar={<SettingsIcon />}
              />
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <FormControl fullWidth>
                      <InputLabel>Display Position</InputLabel>
                      <Select
                        value={displayBehavior.position}
                        label="Display Position"
                        onChange={(e) => setDisplayBehavior({ ...displayBehavior, position: e.target.value })}
                      >
                        <MenuItem value="top">Top (Inline)</MenuItem>
                        <MenuItem value="modal">Modal Dialog</MenuItem>
                        <MenuItem value="right">Right Sidebar</MenuItem>
                        <MenuItem value="bottom">Bottom Panel</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <FormControl fullWidth>
                      <InputLabel>Display Mode</InputLabel>
                      <Select
                        value={displayBehavior.displayMode}
                        label="Display Mode"
                        onChange={(e) => setDisplayBehavior({ ...displayBehavior, displayMode: e.target.value })}
                      >
                        <MenuItem value="immediate">Show Immediately</MenuItem>
                        <MenuItem value="user-action">On User Action</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <FormControl fullWidth>
                      <InputLabel>Priority</InputLabel>
                      <Select
                        value={displayBehavior.priority}
                        label="Priority"
                        onChange={(e) => setDisplayBehavior({ ...displayBehavior, priority: e.target.value })}
                      >
                        <MenuItem value="critical-first">Critical First</MenuItem>
                        <MenuItem value="newest-first">Newest First</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12}>
                    <Stack direction="row" spacing={2}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={displayBehavior.groupByService}
                            onChange={(e) => setDisplayBehavior({ ...displayBehavior, groupByService: e.target.checked })}
                          />
                        }
                        label="Group by Service"
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            checked={displayBehavior.animation}
                            onChange={(e) => setDisplayBehavior({ ...displayBehavior, animation: e.target.checked })}
                          />
                        }
                        label="Enable Animations"
                      />
                    </Stack>
                  </Grid>
                </Grid>
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
                // The actual saving is handled by CDSHookBuilder using cdsHooksService
                // This callback is just for cleanup and refresh
                setShowBuilder(false);
                
                // Refresh both services and custom hooks lists
                await Promise.all([
                  loadCDSServices(),
                  loadCustomHooks()
                ]);
                
                // Show success message
                setError(null);
              } catch (error) {
                // Handle error - the actual error will be shown by CDSHookBuilder
                
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
                    Existing Custom Hooks ({customHooks.length})
                  </Typography>
                  {customHooks.length === 0 ? (
                    <Alert severity="info">
                      No custom hooks created yet. Create your first hook using the templates above or the "New Hook" button.
                    </Alert>
                  ) : (
                    <Grid container spacing={2}>
                      {customHooks.map((hook) => (
                        <Grid item xs={12} sm={6} md={4} key={hook.id}>
                          <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                            <CardContent sx={{ flexGrow: 1 }}>
                              <Stack spacing={1}>
                                <Typography variant="subtitle1" fontWeight="bold">
                                  {hook.title}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  {hook.description || 'No description'}
                                </Typography>
                                <Stack direction="row" spacing={1}>
                                  <Chip label={hook.hook} size="small" color="primary" />
                                  <Chip 
                                    label={hook.enabled ? 'Enabled' : 'Disabled'} 
                                    size="small" 
                                    color={hook.enabled ? 'success' : 'default'} 
                                  />
                                </Stack>
                                <Typography variant="caption" color="text.secondary">
                                  {hook.conditions.length} conditions, {hook.cards.length} cards
                                </Typography>
                              </Stack>
                            </CardContent>
                            <CardActions>
                              <Button 
                                size="small"
                                onClick={() => {
                                  setSelectedHook(hook);
                                  setShowBuilder(true);
                                }}
                              >
                                Edit
                              </Button>
                              <Button 
                                size="small"
                                color="error"
                                onClick={() => handleDeleteHook(hook.id)}
                              >
                                Delete
                              </Button>
                            </CardActions>
                          </Card>
                        </Grid>
                      ))}
                    </Grid>
                  )}
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
                          {calculateAverageResponseTime()}ms
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

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default CDSHooksTab;