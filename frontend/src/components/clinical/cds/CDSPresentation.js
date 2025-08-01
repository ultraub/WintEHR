/**
 * CDS Presentation Component
 * Handles different presentation modes for CDS cards according to CDS Hooks spec
 */
import React, { useState } from 'react';
import {
  Box,
  Paper,
  Alert,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Slide,
  Drawer,
  Typography,
  Stack,
  Chip,
  Badge,
  Tooltip,
  Card,
  CardContent,
  CardActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from '@mui/material';
import {
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Close as CloseIcon,
  CheckCircle as AcceptIcon,
  Cancel as RejectIcon,
  Lightbulb as SuggestionIcon,
  Link as LinkIcon,
  Launch as LaunchIcon,
  Snooze as SnoozeIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';
import { cdsFeedbackService } from '../../../services/cdsFeedbackService';
import { cdsActionExecutor } from '../../../services/cdsActionExecutor';
import { cdsAlertPersistence } from '../../../services/cdsAlertPersistenceService';

// Presentation modes according to CDS Hooks best practices
export const PRESENTATION_MODES = {
  BANNER: 'banner',           // Top banner (for critical alerts)
  SIDEBAR: 'sidebar',         // Side panel
  INLINE: 'inline',           // Inline with content
  POPUP: 'popup',            // Modal dialog
  MODAL: 'modal',            // Hard-stop modal (blocking)
  TOAST: 'toast',            // Toast notification
  CARD: 'card',              // Card format
  COMPACT: 'compact',        // Minimal icon
  DRAWER: 'drawer'           // Slide-out drawer
};

// Predefined override reason codes
export const OVERRIDE_REASONS = {
  PATIENT_PREFERENCE: {
    code: 'patient-preference',
    system: 'https://winterhr.com/cds-hooks/override-reasons',
    display: 'Patient preference or contraindication'
  },
  CLINICAL_JUDGMENT: {
    code: 'clinical-judgment',
    system: 'https://winterhr.com/cds-hooks/override-reasons',
    display: 'Clinical judgment based on patient context'
  },
  ALTERNATIVE_TREATMENT: {
    code: 'alternative-treatment',
    system: 'https://winterhr.com/cds-hooks/override-reasons',
    display: 'Alternative treatment selected'
  },
  RISK_BENEFIT: {
    code: 'risk-benefit',
    system: 'https://winterhr.com/cds-hooks/override-reasons',
    display: 'Risk-benefit analysis favors override'
  },
  FALSE_POSITIVE: {
    code: 'false-positive',
    system: 'https://winterhr.com/cds-hooks/override-reasons',
    display: 'Alert appears to be false positive'
  },
  NOT_APPLICABLE: {
    code: 'not-applicable',
    system: 'https://winterhr.com/cds-hooks/override-reasons',
    display: 'Alert not applicable to this patient'
  },
  EMERGENCY: {
    code: 'emergency',
    system: 'https://winterhr.com/cds-hooks/override-reasons',
    display: 'Emergency situation requires override'
  },
  OTHER: {
    code: 'other',
    system: 'https://winterhr.com/cds-hooks/override-reasons',
    display: 'Other reason (see comments)'
  }
};

const CDSPresentation = ({ 
  alerts = [], 
  mode = PRESENTATION_MODES.INLINE,
  position = 'top',
  onAlertAction,
  autoHide = false,
  hideDelay = 5000,
  maxAlerts = 5,
  allowInteraction = true,
  patientId = null
}) => {
  const [open, setOpen] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [dismissedAlerts, setDismissedAlerts] = useState(() => {
    // Use persistent storage for dismissed alerts
    if (!patientId) return new Set();
    return cdsAlertPersistence.getDismissedAlerts(patientId);
  });

  // Modal mode state hooks - must be at top level
  const [acknowledgmentReason, setAcknowledgmentReason] = useState('');
  const [showReasonDialog, setShowReasonDialog] = useState(false);
  const [currentAlertForAck, setCurrentAlertForAck] = useState(null);
  
  // Override reason dialog state
  const [showOverrideDialog, setShowOverrideDialog] = useState(false);
  const [currentOverride, setCurrentOverride] = useState(null);
  const [overrideReasonCode, setOverrideReasonCode] = useState('');
  const [overrideUserComment, setOverrideUserComment] = useState('');
  
  // Snooze functionality state
  const [snoozedAlerts, setSnoozedAlerts] = useState(() => {
    // Use persistent storage for snoozed alerts
    if (!patientId) return new Map();
    const persistedSnoozes = cdsAlertPersistence.getSnoozedAlerts(patientId);
    
    // Convert to the expected format for backward compatibility
    const snoozedMap = new Map();
    persistedSnoozes.forEach((snoozeUntil, alertId) => {
      // Generate the key format expected by isAlertSnoozed
      const alertKey = alertId.includes('-') ? alertId : alertId;
      snoozedMap.set(alertKey, new Date(snoozeUntil));
    });
    
    return snoozedMap;
  });
  const [showSnoozeDialog, setShowSnoozeDialog] = useState(false);
  const [alertToSnooze, setAlertToSnooze] = useState(null);
  const [snoozeDuration, setSnoozeDuration] = useState(60); // Default 60 minutes

  // Handle alert dismissal
  const handleDismissAlert = (alert, reason = '', permanent = false) => {
    const alertId = alert.uuid || alert.id || `${alert.serviceId}-${alert.summary}`;
    
    // Update local state
    setDismissedAlerts(prev => new Set([...prev, alertId]));
    
    // Persist dismissal
    if (patientId) {
      cdsAlertPersistence.dismissAlert(patientId, alertId, reason, permanent);
    }
    
    // Send feedback to CDS service
    if (alert.uuid && alert.serviceId) {
      cdsFeedbackService.sendFeedback({
        serviceId: alert.serviceId,
        cardUuid: alert.uuid,
        outcome: 'overridden',
        overrideReason: {
          code: 'user-override',
          system: 'https://winterhr.com/cds-hooks/override-reasons',
          display: reason || 'Alert dismissed by user'
        }
      });
    }
    
    // Call parent onAlertAction callback
    if (onAlertAction) {
      onAlertAction(alertId, 'dismiss', reason);
    }
  };

  // Handle alert snooze
  const handleSnoozeAlert = (alert, durationMinutes) => {
    const alertId = alert.uuid || alert.id || `${alert.serviceId}-${alert.summary}`;
    const alertKey = `${alert.serviceId}-${alert.summary}`;
    const snoozeUntil = new Date(Date.now() + durationMinutes * 60 * 1000);
    
    // Update local state
    setSnoozedAlerts(prev => {
      const newSnoozed = new Map(prev);
      newSnoozed.set(alertKey, snoozeUntil);
      return newSnoozed;
    });
    
    // Persist snooze
    if (patientId) {
      cdsAlertPersistence.snoozeAlert(patientId, alertId, durationMinutes);
    }
    
    // Send feedback to CDS service
    if (alert.uuid && alert.serviceId) {
      cdsFeedbackService.sendFeedback({
        serviceId: alert.serviceId,
        cardUuid: alert.uuid,
        outcome: 'overridden',
        overrideReason: {
          code: 'snoozed',
          system: 'https://winterhr.com/cds-hooks/override-reasons',
          display: `Alert snoozed for ${durationMinutes} minutes`
        }
      });
    }
    
    // Call parent callback
    if (onAlertAction) {
      onAlertAction(alertId, 'snooze', { durationMinutes, snoozeUntil });
    }
  };

  // Check if alert is snoozed
  const isAlertSnoozed = (alert) => {
    const alertKey = `${alert.serviceId}-${alert.summary}`;
    const snoozeUntil = snoozedAlerts.get(alertKey);
    
    if (snoozeUntil && snoozeUntil > new Date()) {
      return true;
    }
    
    // Remove expired snooze
    if (snoozeUntil) {
      setSnoozedAlerts(prev => {
        const newSnoozed = new Map(prev);
        newSnoozed.delete(alertKey);
        return newSnoozed;
      });
    }
    
    return false;
  };

  const getSeverityIcon = (indicator) => {
    switch (indicator) {
      case 'critical': return <ErrorIcon color="error" />;
      case 'warning': return <WarningIcon color="warning" />;
      case 'info': return <InfoIcon color="info" />;
      default: return <SuggestionIcon color="primary" />;
    }
  };

  const getSeverityColor = (indicator) => {
    switch (indicator) {
      case 'critical': return 'error';
      case 'warning': return 'warning';
      case 'info': return 'info';
      default: return 'primary';
    }
  };

  const handleAlertAction = async (alert, action, suggestion = null) => {
    const alertKey = `${alert.serviceId}-${alert.summary}`;
    
    if (action === 'dismiss') {
      // Check displayBehavior configuration for override requirements
      const requiresAcknowledgment = alert.displayBehavior?.acknowledgmentRequired || false;
      const requiresReason = alert.displayBehavior?.reasonRequired || false;
      
      // Also check card-level configuration for backward compatibility
      const cardRequiresOverride = alert.overrideReasonRequired || false;
      
      if ((requiresAcknowledgment || requiresReason || cardRequiresOverride) && !currentOverride) {
        setCurrentOverride({ 
          alert, 
          suggestion,
          requiresReason: requiresReason || cardRequiresOverride
        });
        setShowOverrideDialog(true);
        return;
      }
      
      setDismissedAlerts(prev => {
        const newSet = new Set([...prev, alertKey]);
        // Save to sessionStorage if patientId is provided
        if (patientId) {
          const sessionKey = `cds-dismissed-alerts-${patientId}`;
          try {
            sessionStorage.setItem(sessionKey, JSON.stringify([...newSet]));
          } catch (e) {
            // Ignore storage errors
          }
        }
        return newSet;
      });
      
      // Send override feedback for dismissals
      if (alert.serviceId && alert.uuid) {
        await cdsFeedbackService.sendOverrideFeedback(
          alert.serviceId,
          alert.uuid,
          'clinical-judgment',
          'Alert dismissed by user'
        );
      }
    } else if (action === 'accept' && suggestion) {
      try {
        // Execute the suggestion actions
        const executionResult = await cdsActionExecutor.executeSuggestion(alert, suggestion);
        
        if (executionResult.success) {
          // Show success notification if available
          if (window.showNotification) {
            window.showNotification('CDS suggestion accepted and executed successfully', 'success');
          }
          
          // Dismiss the alert after successful execution
          setDismissedAlerts(prev => {
            const newSet = new Set([...prev, alertKey]);
            if (patientId) {
              const sessionKey = `cds-dismissed-alerts-${patientId}`;
              try {
                sessionStorage.setItem(sessionKey, JSON.stringify([...newSet]));
              } catch (e) {
                // Ignore storage errors
              }
            }
            return newSet;
          });
        } else {
          // Show error notification if available
          if (window.showNotification) {
            window.showNotification('Some actions failed to execute. Check console for details.', 'error');
          }
        }
      } catch (error) {
        console.error('Failed to execute CDS suggestion:', error);
        if (window.showNotification) {
          window.showNotification('Failed to execute CDS suggestion', 'error');
        }
      }
    } else if (action === 'reject' && suggestion) {
      // Send override feedback for rejection
      if (alert.serviceId && alert.uuid) {
        await cdsFeedbackService.sendOverrideFeedback(
          alert.serviceId,
          alert.uuid,
          'clinical-judgment',
          `Suggestion "${suggestion.label}" rejected by user`
        );
      }
    }
    
    if (onAlertAction) {
      onAlertAction(alert, action, suggestion);
    }
    
    if (action === 'accept' || action === 'reject') {
      setSelectedAlert(null);
    }
  };

  const renderSuggestionButton = (suggestion, alert) => (
    <Button
      key={suggestion.uuid}
      size="small"
      variant="outlined"
      startIcon={<SuggestionIcon />}
      onClick={() => setSelectedAlert({ alert, suggestion })}
    >
      {suggestion.label}
    </Button>
  );

  const renderLinks = (links) => 
    links?.map((link, index) => (
      <Button
        key={`link-${link.label}-${link.url || ''}-${index}`}
        size="small"
        variant="text"
        startIcon={link.type === 'smart' ? <LaunchIcon /> : <LinkIcon />}
        onClick={() => {
          if (link.type === 'smart') {
            // Handle SMART app launch
            // Handle SMART app launch
          } else {
            window.open(link.url, '_blank');
          }
        }}
      >
        {link.label}
      </Button>
    ));

  const renderAlert = (alert, compact = false) => {
    const content = (
      <>
        <Typography variant={compact ? "caption" : "subtitle2"} gutterBottom>
          {alert.summary}
        </Typography>
        {!compact && alert.detail && (
          <Typography variant="body2" sx={{ mb: 1 }}>
            {alert.detail}
          </Typography>
        )}
        {!compact && alert.source && (
          <Typography variant="caption" color="text.secondary">
            Source: {alert.source.label}
          </Typography>
        )}
      </>
    );

    const actions = allowInteraction ? (
      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
        {alert.suggestions?.map(suggestion => 
          renderSuggestionButton(suggestion, alert)
        )}
        {renderLinks(alert.links)}
        {!compact && alert.indicator !== 'critical' && (
          <Tooltip title="Snooze alert">
            <IconButton
              size="small"
              onClick={() => {
                setAlertToSnooze(alert);
                setShowSnoozeDialog(true);
              }}
            >
              <SnoozeIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {!compact && (
          <IconButton
            size="small"
            onClick={() => handleAlertAction(alert, 'dismiss')}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        )}
      </Stack>
    ) : null;

    return { content, actions };
  };

  const visibleAlerts = alerts.filter(alert => {
    const alertKey = `${alert.serviceId}-${alert.summary}`;
    return !dismissedAlerts.has(alertKey) && !isAlertSnoozed(alert);
  }).slice(0, maxAlerts);

  if (visibleAlerts.length === 0) return null;

  // Banner mode - Critical alerts at top
  if (mode === PRESENTATION_MODES.BANNER) {
    const criticalAlerts = visibleAlerts.filter(a => a.indicator === 'critical');
    if (criticalAlerts.length === 0) return null;

    return (
      <Box sx={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1300 }}>
        {criticalAlerts.map((alert, index) => {
          const { content, actions } = renderAlert(alert);
          return (
            <Alert
              key={`critical-${alert.summary}-${index}`}
              severity="error"
              action={actions}
              sx={{ borderRadius: 0 }}
            >
              {content}
            </Alert>
          );
        })}
      </Box>
    );
  }

  // Toast mode - Auto-hiding notifications
  if (mode === PRESENTATION_MODES.TOAST) {
    return (
      <>
        {visibleAlerts.map((alert, index) => {
          const { content } = renderAlert(alert, true);
          return (
            <Snackbar
              key={`toast-${alert.summary}-${index}`}
              open={open}
              autoHideDuration={autoHide ? hideDelay : null}
              onClose={() => setOpen(false)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              TransitionComponent={Slide}
            >
              <Alert severity={getSeverityColor(alert.indicator)}>
                {content}
              </Alert>
            </Snackbar>
          );
        })}
      </>
    );
  }

  // Popup mode - Modal dialog
  if (mode === PRESENTATION_MODES.POPUP) {
    return (
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Clinical Decision Support
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            {visibleAlerts.map((alert, index) => {
              const { content, actions } = renderAlert(alert);
              return (
                <Card key={`dialog-${alert.summary}-${index}`} variant="outlined">
                  <CardContent>
                    <Stack direction="row" spacing={1} alignItems="flex-start">
                      {getSeverityIcon(alert.indicator)}
                      <Box sx={{ flex: 1 }}>
                        {content}
                      </Box>
                    </Stack>
                  </CardContent>
                  {actions && <CardActions>{actions}</CardActions>}
                </Card>
              );
            })}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    );
  }

  // Modal mode - Hard-stop blocking modal with acknowledgment
  if (mode === PRESENTATION_MODES.MODAL) {
    const handleAcknowledge = (alert) => {
      if (alert.displayBehavior?.acknowledgmentRequired) {
        setCurrentAlertForAck(alert);
        setShowReasonDialog(true);
      } else {
        handleDismissAlert(alert);
      }
    };

    const handleConfirmAcknowledgment = () => {
      if (currentAlertForAck) {
        handleDismissAlert(currentAlertForAck, acknowledgmentReason);
        setCurrentAlertForAck(null);
        setAcknowledgmentReason('');
        setShowReasonDialog(false);
      }
    };

    return (
      <>
        <Dialog 
          open={open} 
          onClose={null} // No close on click outside - hard stop
          maxWidth="md" 
          fullWidth
          disableEscapeKeyDown // Prevent ESC key closing
        >
          <DialogTitle sx={{ bgcolor: 'error.main', color: 'white' }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <ErrorIcon />
              <Typography variant="h6">Critical Alert - Action Required</Typography>
            </Stack>
          </DialogTitle>
          <DialogContent>
            <Alert severity="error" sx={{ mb: 2 }}>
              This is a critical alert that requires your immediate attention before continuing.
            </Alert>
            <Stack spacing={2}>
              {visibleAlerts.map((alert, index) => {
                const { content, actions } = renderAlert(alert);
                return (
                  <Card key={`critical-dialog-${alert.summary}-${index}`} variant="outlined" sx={{ border: '2px solid', borderColor: 'error.main' }}>
                    <CardContent>
                      <Stack direction="row" spacing={1} alignItems="flex-start">
                        {getSeverityIcon(alert.indicator)}
                        <Box sx={{ flex: 1 }}>
                          {content}
                        </Box>
                      </Stack>
                    </CardContent>
                    {actions && <CardActions>{actions}</CardActions>}
                  </Card>
                );
              })}
            </Stack>
          </DialogContent>
          <DialogActions>
            {visibleAlerts.map((alert, index) => (
              <Button 
                key={`ack-button-${alert.summary}-${index}`}
                variant="contained" 
                color="primary"
                onClick={() => handleAcknowledge(alert)}
              >
                Acknowledge & Continue
              </Button>
            ))}
          </DialogActions>
        </Dialog>

        {/* Acknowledgment Reason Dialog */}
        <Dialog open={showReasonDialog} onClose={null} maxWidth="sm" fullWidth>
          <DialogTitle>Acknowledgment Required</DialogTitle>
          <DialogContent>
            <Typography variant="body1" gutterBottom>
              Please provide a reason for overriding this alert:
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={3}
              value={acknowledgmentReason}
              onChange={(e) => setAcknowledgmentReason(e.target.value)}
              placeholder="Enter reason for override..."
              variant="outlined"
              sx={{ mt: 2 }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowReasonDialog(false)}>Cancel</Button>
            <Button 
              variant="contained" 
              onClick={handleConfirmAcknowledgment}
              disabled={!acknowledgmentReason.trim()}
            >
              Confirm Override
            </Button>
          </DialogActions>
        </Dialog>
      </>
    );
  }

  // Drawer mode - Slide-out panel
  if (mode === PRESENTATION_MODES.DRAWER) {
    return (
      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        PaperProps={{ sx: { width: 400 } }}
      >
        <Box sx={{ p: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="h6">CDS Alerts</Typography>
            <IconButton onClick={() => setOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Stack>
          <Stack spacing={2}>
            {visibleAlerts.map((alert, index) => {
              const { content, actions } = renderAlert(alert);
              return (
                <Alert
                  key={`standard-${alert.summary}-${index}`}
                  severity={getSeverityColor(alert.indicator)}
                  action={actions}
                >
                  {content}
                </Alert>
              );
            })}
          </Stack>
        </Box>
      </Drawer>
    );
  }

  // Compact mode - Just icon with badge
  if (mode === PRESENTATION_MODES.COMPACT) {
    const criticalCount = visibleAlerts.filter(a => a.indicator === 'critical').length;
    const warningCount = visibleAlerts.filter(a => a.indicator === 'warning').length;

    return (
      <Tooltip title={`${visibleAlerts.length} CDS alerts`}>
        <Badge 
          badgeContent={criticalCount || warningCount} 
          color={criticalCount > 0 ? "error" : "warning"}
        >
          <IconButton 
            size="small" 
            color={criticalCount > 0 ? "error" : "warning"}
            onClick={() => setOpen(!open)}
          >
            {getSeverityIcon(visibleAlerts[0]?.indicator || 'info')}
          </IconButton>
        </Badge>
      </Tooltip>
    );
  }

  // Default inline mode
  return (
    <Stack spacing={1}>
      {visibleAlerts.map((alert, index) => {
        const { content, actions } = renderAlert(alert);
        return (
          <Alert
            key={`inline-${alert.summary}-${index}`}
            severity={getSeverityColor(alert.indicator)}
            action={actions}
          >
            {content}
          </Alert>
        );
      })}

      {/* Suggestion Detail Dialog */}
      {selectedAlert && (
        <Dialog
          open={!!selectedAlert}
          onClose={() => setSelectedAlert(null)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            {selectedAlert.suggestion.label}
          </DialogTitle>
          <DialogContent>
            <Typography variant="body1">
              {selectedAlert.suggestion.description || 'No description available'}
            </Typography>
            {selectedAlert.suggestion.actions?.map((action, index) => (
              <Typography key={`action-${action.description?.substring(0, 20) || ''}-${index}`} variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {action.description}
              </Typography>
            ))}
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => handleAlertAction(selectedAlert.alert, 'reject', selectedAlert.suggestion)}
            >
              Reject
            </Button>
            <Button
              variant="contained"
              onClick={() => handleAlertAction(selectedAlert.alert, 'accept', selectedAlert.suggestion)}
            >
              Accept
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Override Reason Dialog */}
      {showOverrideDialog && currentOverride && (
        <Dialog open={showOverrideDialog} onClose={() => setShowOverrideDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>
            {currentOverride.requiresReason ? 'Override Clinical Alert' : 'Acknowledge Alert'}
          </DialogTitle>
          <DialogContent>
            <Typography variant="body1" gutterBottom>
              {currentOverride.requiresReason 
                ? `You are overriding a ${currentOverride.alert.indicator} alert. Please provide a reason:`
                : `Please acknowledge this ${currentOverride.alert.indicator} alert before continuing.`
              }
            </Typography>
            
            <Alert severity={getSeverityColor(currentOverride.alert.indicator)} sx={{ my: 2 }}>
              <Typography variant="subtitle2">{currentOverride.alert.summary}</Typography>
              {currentOverride.alert.detail && (
                <Typography variant="body2">{currentOverride.alert.detail}</Typography>
              )}
            </Alert>

            {currentOverride.requiresReason && (
              <>
                <FormControl fullWidth sx={{ mt: 2 }}>
                  <InputLabel>Override Reason</InputLabel>
                  <Select
                    value={overrideReasonCode}
                    onChange={(e) => setOverrideReasonCode(e.target.value)}
                    label="Override Reason"
                  >
                    {Object.entries(OVERRIDE_REASONS).map(([key, reason]) => (
                      <MenuItem key={key} value={reason.code}>
                        {reason.display}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  value={overrideUserComment}
                  onChange={(e) => setOverrideUserComment(e.target.value)}
                  placeholder="Additional comments (optional, required for 'Other' reason)..."
                  label="Comments"
                  variant="outlined"
                  sx={{ mt: 2 }}
                />
              </>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => {
              setShowOverrideDialog(false);
              setCurrentOverride(null);
              setOverrideReasonCode('');
              setOverrideUserComment('');
            }}>
              Cancel
            </Button>
            <Button 
              variant="contained" 
              color="primary"
              onClick={async () => {
                const alert = currentOverride.alert;
                const alertKey = `${alert.serviceId}-${alert.summary}`;
                
                if (currentOverride.requiresReason) {
                  // Validate reason is provided
                  if (!overrideReasonCode || (overrideReasonCode === 'other' && !overrideUserComment.trim())) {
                    return;
                  }
                  
                  // Send override feedback with reason
                  if (alert.serviceId && alert.uuid) {
                    await cdsFeedbackService.sendFeedback({
                      serviceId: alert.serviceId,
                      cardUuid: alert.uuid,
                      outcome: 'overridden',
                      overrideReason: OVERRIDE_REASONS[Object.keys(OVERRIDE_REASONS).find(key => 
                        OVERRIDE_REASONS[key].code === overrideReasonCode
                      )],
                      userComment: overrideUserComment
                    });
                  }
                  
                  // Dismiss the alert with reason
                  handleDismissAlert(alert, `${overrideReasonCode}: ${overrideUserComment}`);
                } else {
                  // Just acknowledgment required
                  if (alert.serviceId && alert.uuid) {
                    await cdsFeedbackService.sendFeedback({
                      serviceId: alert.serviceId,
                      cardUuid: alert.uuid,
                      outcome: 'acknowledged',
                      userComment: 'Alert acknowledged by user'
                    });
                  }
                  
                  // Dismiss the alert
                  handleDismissAlert(alert, 'Acknowledged');
                }
                
                // Close dialog
                setShowOverrideDialog(false);
                setCurrentOverride(null);
                setOverrideReasonCode('');
                setOverrideUserComment('');
              }}
              disabled={currentOverride.requiresReason && (!overrideReasonCode || (overrideReasonCode === 'other' && !overrideUserComment.trim()))}
            >
              {currentOverride.requiresReason ? 'Override Alert' : 'Acknowledge'}
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Snooze Dialog */}
      {showSnoozeDialog && alertToSnooze && (
        <Dialog open={showSnoozeDialog} onClose={() => setShowSnoozeDialog(false)} maxWidth="xs" fullWidth>
          <DialogTitle>
            <Stack direction="row" alignItems="center" spacing={1}>
              <SnoozeIcon color="primary" />
              <Typography>Snooze Alert</Typography>
            </Stack>
          </DialogTitle>
          <DialogContent>
            <Typography variant="body2" gutterBottom>
              How long would you like to snooze this alert?
            </Typography>
            
            <Alert severity={getSeverityColor(alertToSnooze.indicator)} sx={{ my: 2 }}>
              <Typography variant="subtitle2">{alertToSnooze.summary}</Typography>
            </Alert>

            <FormControl fullWidth sx={{ mt: 2 }}>
              <InputLabel>Snooze Duration</InputLabel>
              <Select
                value={snoozeDuration}
                onChange={(e) => setSnoozeDuration(e.target.value)}
                label="Snooze Duration"
              >
                <MenuItem value={15}>15 minutes</MenuItem>
                <MenuItem value={30}>30 minutes</MenuItem>
                <MenuItem value={60}>1 hour</MenuItem>
                <MenuItem value={120}>2 hours</MenuItem>
                <MenuItem value={240}>4 hours</MenuItem>
                <MenuItem value={480}>8 hours</MenuItem>
                <MenuItem value={1440}>24 hours</MenuItem>
              </Select>
            </FormControl>

            {snoozedAlerts.size > 0 && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
                You have {snoozedAlerts.size} snoozed alert{snoozedAlerts.size > 1 ? 's' : ''}.
              </Typography>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => {
              setShowSnoozeDialog(false);
              setAlertToSnooze(null);
            }}>
              Cancel
            </Button>
            <Button 
              variant="contained" 
              color="primary"
              startIcon={<ScheduleIcon />}
              onClick={() => {
                handleSnoozeAlert(alertToSnooze, snoozeDuration);
                setShowSnoozeDialog(false);
                setAlertToSnooze(null);
                
                // Show notification if available
                if (window.showNotification) {
                  const duration = snoozeDuration < 60 
                    ? `${snoozeDuration} minutes` 
                    : `${snoozeDuration / 60} hour${snoozeDuration > 60 ? 's' : ''}`;
                  window.showNotification(`Alert snoozed for ${duration}`, 'info');
                }
              }}
            >
              Snooze
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Stack>
  );
};

export default CDSPresentation;