/**
 * CDS Alerts Panel Component
 * Displays CDS Hooks alerts in various parts of the EMR workflow
 * Enhanced with multiple presentation modes and workflow support
 */
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Alert,
  Button,
  IconButton,
  Collapse,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Badge,
  Tooltip
} from '@mui/material';
import {
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Psychology as CDSIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Close as CloseIcon,
  CheckCircle as AcceptIcon,
  CheckCircle,
  Cancel as RejectIcon,
  Lightbulb as SuggestionIcon
} from '@mui/icons-material';
import { cdsHooksClient } from '../../../services/cdsHooksClient';
import CDSHookManager, { WORKFLOW_TRIGGERS } from './CDSHookManager';
import CDSPresentation, { PRESENTATION_MODES } from './CDSPresentation';
import CDSDocumentationPrompts from './CDSDocumentationPrompts';
import { cdsLogger } from '../../../config/logging';
import { useClinicalWorkflow } from '../../../contexts/ClinicalWorkflowContext';

const CDSAlertsPanel = ({ 
  patientId, 
  hook = 'patient-view',
  context = {},
  compact = false,
  maxAlerts = 5,
  autoRefresh = false,
  onAlertAction = null,
  presentationMode = null, // Override presentation mode
  workflowPoint = null,    // Specify workflow point for enhanced hook firing
  debugMode = false,        // Enable debug logging
  useEnhancedHooks = true   // Use new CDSHookManager vs legacy implementation
}) => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(!compact);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [dismissedAlerts, setDismissedAlerts] = useState(() => {
    // Persist dismissed alerts in sessionStorage for the current browser session
    const sessionKey = `cds-dismissed-alerts-${patientId}`;
    try {
      const stored = sessionStorage.getItem(sessionKey);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch (e) {
      return new Set();
    }
  });
  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState(() => {
    // Only persist acknowledged alerts for the current browser session, not across sessions
    return new Set();
  });
  const [showDocumentationPrompts, setShowDocumentationPrompts] = useState(true);
  const { publish } = useClinicalWorkflow();
  const isMountedRef = useRef(true);
  const lastFetchRef = useRef(null);
  const contextRef = useRef(context);
  const lastPatientIdRef = useRef(patientId);
  const compactRef = useRef(null);
  const dismissedAlertsRef = useRef(dismissedAlerts);

  // Update context ref when context changes
  useEffect(() => {
    contextRef.current = context;
  }, [context]);

  // Update dismissedAlerts ref when it changes
  useEffect(() => {
    dismissedAlertsRef.current = dismissedAlerts;
  }, [dismissedAlerts]);

  const loadCDSAlerts = useCallback(async () => {
    if (!patientId) {
      cdsLogger.debug('No patient ID - skipping CDS fetch');
      setLoading(false);
      return;
    }
    
    cdsLogger.info(`Loading CDS alerts for patient ${patientId} with hook ${hook}`);
    setLoading(true);
    
    try {
      let cdsResults = [];
      
      if (hook === 'patient-view') {
        cdsResults = await cdsHooksClient.firePatientView(patientId, 'current-user');
      } else if (hook === 'medication-prescribe') {
        cdsResults = await cdsHooksClient.fireMedicationPrescribe(patientId, 'current-user', contextRef.current.medications);
      } else if (hook === 'order-sign') {
        cdsResults = await cdsHooksClient.fireOrderSign(patientId, 'current-user', contextRef.current.orders);
      }
      
      cdsLogger.debug(`Received ${cdsResults.length} CDS results:`, cdsResults);
      
      // Filter out dismissed alerts and ensure uniqueness
      const uniqueAlerts = [];
      const seenKeys = new Set();
      
      for (const alert of cdsResults) {
        // Handle both old format (serviceId) and new format (service context)
        const serviceId = alert.serviceId || 'unknown-service';
        // Use stable key based on service ID and summary for session-based dismissal
        const alertKey = `${serviceId}-${alert.summary}`;
        
        cdsLogger.debug(`Processing alert: ${alertKey}`, { 
          dismissed: dismissedAlertsRef.current.has(alertKey), 
          seen: seenKeys.has(alertKey) 
        });
        
        if (!dismissedAlertsRef.current.has(alertKey) && !seenKeys.has(alertKey)) {
          seenKeys.add(alertKey);
          // Ensure alert has required fields for display
          const processedAlert = {
            ...alert,
            serviceId,
            uuid: alert.uuid || alertKey, // Use stable key as UUID fallback
            indicator: alert.indicator || 'info',
            source: alert.source || { label: alert.serviceTitle || 'CDS Service' }
          };
          uniqueAlerts.push(processedAlert);
          cdsLogger.debug(`Added alert: ${alertKey}`);
        } else {
          cdsLogger.debug(`Skipped alert: ${alertKey}`);
        }
      }
      
      cdsLogger.info(`Filtered to ${uniqueAlerts.length} unique alerts from ${cdsResults.length} results`);
      setAlerts(uniqueAlerts);
    } catch (error) {
      cdsLogger.error('Error loading CDS alerts:', error);
      setAlerts([]);
    } finally {
      setLoading(false);
      cdsLogger.debug('CDS alert loading complete');
    }
  }, [patientId, hook]); // Removed dismissedAlerts to prevent re-creation

  // Load CDS alerts on mount and when dependencies change
  useEffect(() => {
    if (patientId) {
      // Clear alerts and reset dismissal state if patient changed
      if (lastPatientIdRef.current !== patientId) {
        cdsLogger.info(`Patient changed from ${lastPatientIdRef.current} to ${patientId}, resetting CDS state`);
        setAlerts([]);
        // Load dismissed alerts from sessionStorage for the new patient
        const sessionKey = `cds-dismissed-alerts-${patientId}`;
        try {
          const stored = sessionStorage.getItem(sessionKey);
          setDismissedAlerts(stored ? new Set(JSON.parse(stored)) : new Set());
        } catch (e) {
          setDismissedAlerts(new Set());
        }
        setAcknowledgedAlerts(new Set());
        lastPatientIdRef.current = patientId;
      }
      loadCDSAlerts();
    } else {
      setLoading(false);
      setAlerts([]);
    }
  }, [patientId, hook, loadCDSAlerts]);

  // Auto-refresh if enabled
  useEffect(() => {
    if (autoRefresh && patientId) {
      const interval = setInterval(() => {
        loadCDSAlerts();
      }, 60000); // Every minute
      return () => clearInterval(interval);
    }
  }, [autoRefresh, patientId, loadCDSAlerts]);

  // No longer persisting alerts to session storage - they reset each session

  // Handle click outside compact popup
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (compact && expanded && compactRef.current && !compactRef.current.contains(event.target)) {
        setExpanded(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [compact, expanded]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleCreateNoteFromPrompt = useCallback(async (noteData) => {
    try {
      // Publish workflow event for note creation
      await publish('CDS_DOCUMENTATION_NOTE_REQUESTED', {
        patientId,
        template: noteData.template,
        content: noteData.content,
        title: noteData.title,
        linkedAlerts: noteData.linkedAlerts,
        context: noteData.context,
        source: 'cds-alert'
      });
      
      cdsLogger.info('CDS documentation note creation requested', { 
        patientId, 
        template: noteData.template,
        linkedAlerts: noteData.linkedAlerts 
      });
    } catch (error) {
      cdsLogger.error('Error creating note from CDS prompt:', error);
    }
  }, [patientId, publish]);

  const getSeverityIcon = (indicator) => {
    switch (indicator) {
      case 'critical':
        return <ErrorIcon color="error" />;
      case 'warning':
        return <WarningIcon color="warning" />;
      case 'info':
        return <InfoIcon color="info" />;
      default:
        return <SuggestionIcon color="primary" />;
    }
  };

  const getSeverityColor = (indicator) => {
    switch (indicator) {
      case 'critical':
        return 'error';
      case 'warning':
        return 'warning';
      case 'info':
        return 'info';
      default:
        return 'primary';
    }
  };

  const handleAlertAction = (alert, action, suggestion = null) => {
    const alertKey = `${alert.serviceId}-${alert.summary}`;
    
    if (action === 'dismiss') {
      setDismissedAlerts(prev => {
        const newSet = new Set([...prev, alertKey]);
        // Save to sessionStorage
        const sessionKey = `cds-dismissed-alerts-${patientId}`;
        try {
          sessionStorage.setItem(sessionKey, JSON.stringify([...newSet]));
        } catch (e) {
          
        }
        return newSet;
      });
      setAlerts(prev => prev.filter(a => 
        `${a.serviceId}-${a.summary}` !== alertKey
      ));
    } else if (action === 'acknowledge') {
      setAcknowledgedAlerts(prev => new Set([...prev, alertKey]));
      // Don't remove the alert, just mark it as acknowledged
    } else if (action === 'accept' && suggestion) {
      cdsLogger.info('Accepting CDS suggestion:', { suggestionId: suggestion.uuid, label: suggestion.label });
      // TODO: Implement suggestion action execution
      // This would typically create/update FHIR resources based on suggestion.actions
    } else if (action === 'reject' && suggestion) {
      cdsLogger.info('Rejecting CDS suggestion:', { suggestionId: suggestion.uuid, label: suggestion.label });
    }
    
    // Send feedback to CDS service if we have a serviceId
    if (alert.serviceId && alert.serviceId !== 'unknown-service') {
      const feedback = {
        feedback: [{
          card: alert.uuid,
          outcome: action === 'accept' ? 'accepted' : action === 'reject' ? 'overridden' : 'ignored',
          ...(action === 'accept' && suggestion ? {
            acceptedSuggestions: [{ id: suggestion.uuid }]
          } : {}),
          ...(action === 'reject' ? {
            overrideReasons: [{ reason: { code: 'user-preference', display: 'User preference' } }]
          } : {})
        }]
      };
      
      // Send feedback asynchronously (don't block UI)
      cdsHooksClient.httpClient.post(`/cds-services/${alert.serviceId}/feedback`, feedback)
        .catch(err => {
          // Silently handle feedback errors to not disrupt user experience
        });
    }
    
    if (onAlertAction) {
      onAlertAction(alert, action, suggestion);
    }
  };

  const filteredAlerts = useMemo(() => {
    return alerts.slice(0, maxAlerts);
  }, [alerts, maxAlerts]);

  const criticalCount = alerts.filter(a => a.indicator === 'critical').length;
  const warningCount = alerts.filter(a => a.indicator === 'warning').length;
  const acknowledgedCount = alerts.filter(a => 
    acknowledgedAlerts.has(`${a.serviceId}-${a.summary}`)
  ).length;
  const activeCount = alerts.length - acknowledgedCount;

  // Don't show loading spinner - just return null to hide the component
  if (loading && alerts.length === 0) {
    return null;
  }

  if (alerts.length === 0 && !loading) {
    // Don't show anything if there are no alerts
    return null;
  }

  // Determine presentation mode based on props and context
  const determinedPresentationMode = presentationMode || 
    (compact ? PRESENTATION_MODES.COMPACT : PRESENTATION_MODES.INLINE);

  // Use enhanced hook manager if enabled
  if (useEnhancedHooks) {
    return (
      <CDSHookManager
        patientId={patientId}
        userId="current-user"
        currentHook={hook}
        context={context}
        onAlertAction={onAlertAction}
        debugMode={debugMode}
        disabled={!patientId}
      />
    );
  }

  if (compact) {
    return (
      <Box ref={compactRef} sx={{ position: 'relative' }}>
        <Tooltip title={`${alerts.length} CDS alerts (${criticalCount} critical, ${warningCount} warnings)`}>
          <Badge 
            badgeContent={criticalCount > 0 ? criticalCount : warningCount} 
            color={criticalCount > 0 ? "error" : "warning"}
            variant="dot"
          >
            <IconButton 
              size="small" 
              onClick={() => setExpanded(!expanded)}
              color={criticalCount > 0 ? "error" : warningCount > 0 ? "warning" : "default"}
            >
              <CDSIcon />
            </IconButton>
          </Badge>
        </Tooltip>
        
        {/* Compact mode expanded content */}
        {expanded && (
          <Paper 
            sx={{ 
              position: 'absolute', 
              top: '100%', 
              left: 0,
              right: 0,
              zIndex: 1000,
              maxWidth: 400,
              mt: 1,
              p: 2
            }}
            elevation={3}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Typography variant="subtitle2">
                CDS Alerts
              </Typography>
              <IconButton size="small" onClick={() => setExpanded(false)}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Stack>
            
            {filteredAlerts.map((alert, index) => (
              <Alert
                key={`${alert.serviceId}-${index}`}
                severity={getSeverityColor(alert.indicator)}
                sx={{ 
                  mb: 1,
                  opacity: acknowledgedAlerts.has(`${alert.serviceId}-${alert.summary}`) ? 0.7 : 1
                }}
                icon={acknowledgedAlerts.has(`${alert.serviceId}-${alert.summary}`) ? 
                  <CheckCircle fontSize="inherit" /> : undefined}
                action={
                  <Stack direction="row" spacing={1}>
                    {alert.suggestions && alert.suggestions.length > 0 && (
                      <Button 
                        size="small" 
                        variant="outlined"
                        onClick={() => setSelectedAlert(alert)}
                      >
                        Actions
                      </Button>
                    )}
                    {!acknowledgedAlerts.has(`${alert.serviceId}-${alert.summary}`) && (
                      <Tooltip title="Acknowledge">
                        <IconButton
                          size="small"
                          onClick={() => handleAlertAction(alert, 'acknowledge')}
                        >
                          <CheckCircle fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title="Dismiss">
                      <IconButton
                        size="small"
                        onClick={() => handleAlertAction(alert, 'dismiss')}
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                }
              >
                <Typography variant="body2" gutterBottom>
                  {alert.summary}
                </Typography>
                {alert.detail && (
                  <Typography variant="caption">
                    {alert.detail}
                  </Typography>
                )}
              </Alert>
            ))}
          </Paper>
        )}
      </Box>
    );
  }

  return (
    <Paper sx={{ mb: 2 }} elevation={1}>
      <Box sx={{ p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={2} alignItems="center">
            <CDSIcon color="primary" />
            <Typography variant="h6">
              Clinical Decision Support
            </Typography>
            {alerts.length > 0 && (
              <>
                <Chip 
                  label={`${activeCount} active`}
                  size="small"
                  color={criticalCount > 0 ? "error" : warningCount > 0 ? "warning" : "info"}
                />
                {acknowledgedCount > 0 && (
                  <Chip 
                    label={`${acknowledgedCount} acknowledged`}
                    size="small"
                    variant="outlined"
                    color="default"
                    icon={<CheckCircle fontSize="small" />}
                  />
                )}
              </>
            )}
          </Stack>
          <IconButton onClick={() => setExpanded(!expanded)}>
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Stack>

        <Collapse in={expanded}>
          <Box sx={{ mt: 2 }}>
            {filteredAlerts.map((alert, index) => (
              <Alert
                key={`${alert.serviceId}-${index}`}
                severity={getSeverityColor(alert.indicator)}
                sx={{ 
                  mb: 1,
                  opacity: acknowledgedAlerts.has(`${alert.serviceId}-${alert.summary}`) ? 0.7 : 1,
                  position: 'relative'
                }}
                icon={acknowledgedAlerts.has(`${alert.serviceId}-${alert.summary}`) ? 
                  <CheckCircle fontSize="inherit" /> : undefined}
                action={
                  <Stack direction="row" spacing={1}>
                    {alert.suggestions && alert.suggestions.length > 0 && (
                      <Button 
                        size="small" 
                        variant="outlined"
                        onClick={() => setSelectedAlert(alert)}
                      >
                        View Actions
                      </Button>
                    )}
                    {!acknowledgedAlerts.has(`${alert.serviceId}-${alert.summary}`) && (
                      <Tooltip title="Acknowledge">
                        <IconButton
                          size="small"
                          onClick={() => handleAlertAction(alert, 'acknowledge')}
                        >
                          <CheckCircle fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title="Dismiss">
                      <IconButton
                        size="small"
                        onClick={() => handleAlertAction(alert, 'dismiss')}
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                }
              >
                <Typography variant="subtitle2" gutterBottom>
                  {alert.summary}
                </Typography>
                {alert.detail && (
                  <Typography variant="body2">
                    {alert.detail}
                  </Typography>
                )}
                {alert.source && (
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                    Source: {alert.source.label || alert.serviceTitle}
                  </Typography>
                )}
              </Alert>
            ))}

            {/* Documentation Prompts Section */}
            {showDocumentationPrompts && alerts.length > 0 && (
              <Box sx={{ mt: 3 }}>
                <CDSDocumentationPrompts
                  cdsAlerts={alerts}
                  patientId={patientId}
                  encounterId={context.encounterId}
                  onCreateNote={handleCreateNoteFromPrompt}
                />
              </Box>
            )}

            <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
              {alerts.length > maxAlerts && (
                <Button 
                  variant="text" 
                  size="small" 
                  onClick={() => setExpanded(true)}
                >
                  Show {alerts.length - maxAlerts} more alerts
                </Button>
              )}
              {acknowledgedCount > 0 && (
                <Button 
                  variant="text" 
                  size="small" 
                  onClick={() => {
                    setAcknowledgedAlerts(new Set());
                  }}
                >
                  Clear Acknowledged
                </Button>
              )}
              <Button 
                variant="text" 
                size="small" 
                onClick={() => setShowDocumentationPrompts(!showDocumentationPrompts)}
              >
                {showDocumentationPrompts ? 'Hide' : 'Show'} Documentation Prompts
              </Button>
            </Stack>
          </Box>
        </Collapse>
      </Box>

      {/* Alert Details Dialog */}
      <Dialog 
        open={!!selectedAlert} 
        onClose={() => setSelectedAlert(null)}
        maxWidth="md"
        fullWidth
      >
        {selectedAlert && (
          <>
            <DialogTitle>
              <Stack direction="row" spacing={2} alignItems="center">
                {getSeverityIcon(selectedAlert.indicator)}
                <Typography variant="h6">
                  {selectedAlert.summary}
                </Typography>
              </Stack>
            </DialogTitle>
            <DialogContent>
              <Typography variant="body1" gutterBottom>
                {selectedAlert.detail}
              </Typography>

              {selectedAlert.suggestions && selectedAlert.suggestions.length > 0 && (
                <>
                  <Typography variant="h6" sx={{ mt: 3, mb: 2 }}>
                    Suggested Actions:
                  </Typography>
                  <List>
                    {selectedAlert.suggestions.map((suggestion, index) => (
                      <ListItem key={index} sx={{ pl: 0 }}>
                        <ListItemIcon>
                          <SuggestionIcon color="primary" />
                        </ListItemIcon>
                        <ListItemText
                          primary={suggestion.label}
                          secondary={suggestion.description || (
                            suggestion.actions && suggestion.actions.length > 0 
                              ? suggestion.actions[0].description 
                              : 'No description available'
                          )}
                        />
                        <Stack direction="row" spacing={1}>
                          <Button
                            size="small"
                            variant="contained"
                            color="primary"
                            startIcon={<AcceptIcon />}
                            onClick={() => {
                              handleAlertAction(selectedAlert, 'accept', suggestion);
                              setSelectedAlert(null);
                            }}
                          >
                            Accept
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<RejectIcon />}
                            onClick={() => {
                              handleAlertAction(selectedAlert, 'reject', suggestion);
                              setSelectedAlert(null);
                            }}
                          >
                            Reject
                          </Button>
                        </Stack>
                      </ListItem>
                    ))}
                  </List>
                </>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSelectedAlert(null)}>
                Close
              </Button>
              <Button 
                variant="outlined"
                onClick={() => {
                  handleAlertAction(selectedAlert, 'dismiss');
                  setSelectedAlert(null);
                }}
              >
                Dismiss Alert
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Paper>
  );
};

export default CDSAlertsPanel;