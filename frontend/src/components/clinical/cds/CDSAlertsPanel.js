/**
 * CDS Alerts Panel Component
 * Displays CDS Hooks alerts in various parts of the EMR workflow
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
  Cancel as RejectIcon,
  Lightbulb as SuggestionIcon
} from '@mui/icons-material';
import { cdsHooksClient } from '../../../services/cdsHooksClient';

const CDSAlertsPanel = ({ 
  patientId, 
  hook = 'patient-view',
  context = {},
  compact = false,
  maxAlerts = 5,
  autoRefresh = false,
  onAlertAction = null
}) => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(!compact);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [dismissedAlerts, setDismissedAlerts] = useState(new Set());
  const isMountedRef = useRef(true);
  const lastFetchRef = useRef(null);
  const contextRef = useRef(context);

  // Update context ref when context changes
  useEffect(() => {
    contextRef.current = context;
  }, [context]);

  const loadCDSAlerts = useCallback(async () => {
    // Prevent duplicate calls within 5 seconds
    const now = Date.now();
    if (lastFetchRef.current && now - lastFetchRef.current < 5000) {
      return;
    }
    lastFetchRef.current = now;
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
      
      // Filter out dismissed alerts
      const activeAlerts = cdsResults.filter(alert => 
        !dismissedAlerts.has(`${alert.serviceId}-${alert.uuid || alert.summary}`)
      );
      
      if (isMountedRef.current) {
        setAlerts(activeAlerts);
      }
    } catch (error) {
      console.error('Error loading CDS alerts:', error);
      if (isMountedRef.current) {
        setAlerts([]);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [patientId, hook, dismissedAlerts]);

  // Load CDS alerts on mount and when dependencies change
  useEffect(() => {
    if (patientId) {
      loadCDSAlerts();
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

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
    const alertKey = `${alert.serviceId}-${alert.uuid || alert.summary}`;
    
    if (action === 'dismiss') {
      setDismissedAlerts(prev => new Set([...prev, alertKey]));
      setAlerts(prev => prev.filter(a => 
        `${a.serviceId}-${a.uuid || a.summary}` !== alertKey
      ));
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

  if (loading && alerts.length === 0) {
    return compact ? (
      <CircularProgress size={20} />
    ) : (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (alerts.length === 0) {
    return compact ? null : (
      <Paper sx={{ p: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <CDSIcon color="action" />
          <Typography variant="body2" color="text.secondary">
            No CDS alerts
          </Typography>
        </Stack>
      </Paper>
    );
  }

  if (compact) {
    return (
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
    );
  }

  return (
    <Paper sx={{ mb: 2 }}>
      <Box sx={{ p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={2} alignItems="center">
            <CDSIcon color="primary" />
            <Typography variant="h6">
              Clinical Decision Support
            </Typography>
            <Chip 
              label={`${alerts.length} active`}
              size="small"
              color={criticalCount > 0 ? "error" : warningCount > 0 ? "warning" : "info"}
            />
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
                sx={{ mb: 1 }}
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
                    <IconButton
                      size="small"
                      onClick={() => handleAlertAction(alert, 'dismiss')}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
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

            {alerts.length > maxAlerts && (
              <Button 
                variant="text" 
                size="small" 
                onClick={() => setExpanded(true)}
              >
                Show {alerts.length - maxAlerts} more alerts
              </Button>
            )}
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
                          secondary={suggestion.description}
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