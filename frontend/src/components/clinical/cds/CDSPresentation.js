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
  InputLabel,
  Popover
} from '@mui/material';
import {
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Close as CloseIcon,
  CheckCircle as AcceptIcon,
  CheckCircle as CheckCircleIcon,
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
  
  // State for tracking acknowledged alerts in modal mode
  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState(new Set());
  
  // State for compact mode popover
  const [anchorEl, setAnchorEl] = useState(null);
  
  // State for sidebar minimized
  const [sidebarMinimized, setSidebarMinimized] = useState(false);

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
      <Box sx={{ 
        position: 'sticky', 
        top: 0, 
        zIndex: 1200,
        width: '100%'
      }}>
        {criticalAlerts.map((alert, index) => {
          const { content, actions } = renderAlert(alert);
          return (
            <Alert
              key={`critical-${alert.summary}-${index}`}
              severity="error"
              action={actions}
              sx={{ 
                borderRadius: 0,
                boxShadow: 2
              }}
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
    // Stack toasts vertically with proper spacing
    return (
      <Box sx={{ 
        position: 'fixed', 
        bottom: 16, 
        right: 16, 
        zIndex: 1400,
        display: 'flex',
        flexDirection: 'column-reverse',
        gap: 1,
        maxWidth: 400
      }}>
        {visibleAlerts.map((alert, index) => {
          const alertKey = `${alert.serviceId}-${alert.summary}`;
          const isVisible = !dismissedAlerts.has(alertKey) && !isAlertSnoozed(alert);
          
          if (!isVisible) return null;
          
          const { content, actions } = renderAlert(alert, true);
          return (
            <Slide 
              key={`toast-${alert.summary}-${index}`}
              direction="left" 
              in={isVisible}
              timeout={300}
            >
              <Alert 
                severity={getSeverityColor(alert.indicator)}
                onClose={() => handleAlertAction(alert, 'dismiss')}
                sx={{ 
                  boxShadow: 3,
                  '& .MuiAlert-action': {
                    alignItems: 'flex-start'
                  }
                }}
              >
                {content}
              </Alert>
            </Slide>
          );
        })}
      </Box>
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
      const alertId = alert.uuid || alert.id || `${alert.serviceId}-${alert.summary}`;
      
      if (alert.displayBehavior?.reasonRequired) {
        setCurrentAlertForAck(alert);
        setShowReasonDialog(true);
      } else {
        // Mark as acknowledged
        setAcknowledgedAlerts(prev => new Set([...prev, alertId]));
        handleDismissAlert(alert);
        
        // Check if all alerts have been dismissed (for non-reason required case)
        const remainingAlerts = alerts.filter(a => {
          const aId = a.uuid || a.id || `${a.serviceId}-${a.summary}`;
          return aId !== alertId && !dismissedAlerts.has(aId) && !isAlertSnoozed(a) && !acknowledgedAlerts.has(aId);
        });
        
        // Close the modal if no alerts remain
        if (remainingAlerts.length === 0) {
          setOpen(false);
        }
      }
    };

    const handleConfirmAcknowledgment = () => {
      if (currentAlertForAck) {
        const alertId = currentAlertForAck.uuid || currentAlertForAck.id || 
                       `${currentAlertForAck.serviceId}-${currentAlertForAck.summary}`;
        
        // Mark as acknowledged
        setAcknowledgedAlerts(prev => new Set([...prev, alertId]));
        handleDismissAlert(currentAlertForAck, acknowledgmentReason);
        setCurrentAlertForAck(null);
        setAcknowledgmentReason('');
        setShowReasonDialog(false);
        
        // Check if all alerts have been dismissed
        const remainingAlerts = alerts.filter(alert => {
          const aId = alert.uuid || alert.id || `${alert.serviceId}-${alert.summary}`;
          return aId !== alertId && !dismissedAlerts.has(aId) && !isAlertSnoozed(alert) && !acknowledgedAlerts.has(aId);
        });
        
        // Close the modal if no alerts remain
        if (remainingAlerts.length === 0) {
          setOpen(false);
        }
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
                const alertId = alert.uuid || alert.id || `${alert.serviceId}-${alert.summary}`;
                const isAcknowledged = acknowledgedAlerts.has(alertId);
                const { content, actions } = renderAlert(alert);
                
                return (
                  <Card 
                    key={`critical-dialog-${alert.summary}-${index}`} 
                    variant="outlined" 
                    sx={{ 
                      border: '2px solid', 
                      borderColor: isAcknowledged ? 'success.main' : 'error.main',
                      opacity: isAcknowledged ? 0.7 : 1,
                      bgcolor: isAcknowledged ? 'success.light' : 'transparent'
                    }}
                  >
                    <CardContent>
                      <Stack direction="row" spacing={1} alignItems="flex-start">
                        {isAcknowledged ? (
                          <CheckCircleIcon color="success" />
                        ) : (
                          getSeverityIcon(alert.indicator)
                        )}
                        <Box sx={{ flex: 1 }}>
                          {content}
                          {isAcknowledged && (
                            <Chip 
                              label="Acknowledged" 
                              size="small" 
                              color="success" 
                              sx={{ mt: 1 }}
                              icon={<CheckCircleIcon />}
                            />
                          )}
                        </Box>
                      </Stack>
                    </CardContent>
                    {!isAcknowledged && (
                      <CardActions>
                        <Button 
                          variant="contained" 
                          color="primary"
                          fullWidth
                          onClick={() => handleAcknowledge(alert)}
                        >
                          Acknowledge & Continue
                        </Button>
                      </CardActions>
                    )}
                  </Card>
                );
              })}
            </Stack>
          </DialogContent>
          {visibleAlerts.every(alert => {
            const alertId = alert.uuid || alert.id || `${alert.serviceId}-${alert.summary}`;
            return acknowledgedAlerts.has(alertId);
          }) && (
            <DialogActions>
              <Button 
                variant="contained" 
                color="success"
                onClick={() => setOpen(false)}
              >
                All Alerts Acknowledged - Continue
              </Button>
            </DialogActions>
          )}
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

  // Compact mode - Icon with badge that opens a popover
  if (mode === PRESENTATION_MODES.COMPACT) {
    const criticalCount = visibleAlerts.filter(a => a.indicator === 'critical').length;
    const warningCount = visibleAlerts.filter(a => a.indicator === 'warning').length;
    const infoCount = visibleAlerts.filter(a => a.indicator === 'info').length;
    const totalCount = visibleAlerts.length;

    return (
      <>
        <Tooltip title={`${totalCount} CDS alert${totalCount > 1 ? 's' : ''}`}>
          <Badge 
            badgeContent={totalCount} 
            color={criticalCount > 0 ? "error" : warningCount > 0 ? "warning" : "info"}
          >
            <IconButton 
              size="small" 
              color={criticalCount > 0 ? "error" : warningCount > 0 ? "warning" : "info"}
              onClick={(e) => setAnchorEl(e.currentTarget)}
              sx={{ 
                animation: criticalCount > 0 ? 'pulse 2s infinite' : 'none',
                '@keyframes pulse': {
                  '0%': { opacity: 1 },
                  '50%': { opacity: 0.5 },
                  '100%': { opacity: 1 }
                }
              }}
            >
              {getSeverityIcon(criticalCount > 0 ? 'critical' : warningCount > 0 ? 'warning' : 'info')}
            </IconButton>
          </Badge>
        </Tooltip>
        <Popover
          open={Boolean(anchorEl)}
          anchorEl={anchorEl}
          onClose={() => setAnchorEl(null)}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
          PaperProps={{
            sx: { maxWidth: 400, maxHeight: 600 }
          }}
        >
          <Box sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              CDS Alerts ({totalCount})
            </Typography>
            <Stack spacing={1} sx={{ maxHeight: 500, overflow: 'auto' }}>
              {visibleAlerts.map((alert, index) => {
                const { content, actions } = renderAlert(alert);
                return (
                  <Alert
                    key={`compact-${alert.summary}-${index}`}
                    severity={getSeverityColor(alert.indicator)}
                    action={actions}
                  >
                    {content}
                  </Alert>
                );
              })}
            </Stack>
          </Box>
        </Popover>
      </>
    );
  }

  // Card mode - Rich card display
  if (mode === PRESENTATION_MODES.CARD) {
    return (
      <Stack spacing={2}>
        {visibleAlerts.map((alert, index) => {
          const { content, actions } = renderAlert(alert);
          const alertKey = `${alert.serviceId}-${alert.summary}`;
          
          return (
            <Card 
              key={`card-${alert.summary}-${index}`}
              elevation={3}
              sx={{
                borderLeft: 4,
                borderLeftColor: getSeverityColor(alert.indicator) + '.main',
                transition: 'all 0.3s ease',
                '&:hover': {
                  elevation: 6,
                  transform: 'translateY(-2px)'
                }
              }}
            >
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="flex-start">
                  <Box sx={{ pt: 0.5 }}>
                    {getSeverityIcon(alert.indicator)}
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    {content}
                    {alert.source && (
                      <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                        <Chip
                          label={alert.source.label}
                          size="small"
                          variant="outlined"
                          icon={alert.source.icon ? 
                            <img src={alert.source.icon} alt="" width={16} height={16} /> : 
                            null
                          }
                        />
                        <Chip
                          label={new Date(alert.timestamp).toLocaleTimeString()}
                          size="small"
                          variant="outlined"
                          icon={<ScheduleIcon />}
                        />
                      </Stack>
                    )}
                  </Box>
                </Stack>
              </CardContent>
              {actions && (
                <CardActions sx={{ px: 2, pb: 2 }}>
                  {actions}
                </CardActions>
              )}
            </Card>
          );
        })}
      </Stack>
    );
  }

  // Sidebar mode - Fixed side panel
  if (mode === PRESENTATION_MODES.SIDEBAR) {
    // Show minimized version
    if (sidebarMinimized) {
      return (
        <Paper
          elevation={3}
          sx={{
            position: 'fixed',
            right: 8,
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 1100,
            borderRadius: 2
          }}
        >
          <Tooltip title={`${visibleAlerts.length} CDS Alerts - Click to expand`}>
            <IconButton
              onClick={() => setSidebarMinimized(false)}
              color={visibleAlerts.some(a => a.indicator === 'critical') ? 'error' : 
                     visibleAlerts.some(a => a.indicator === 'warning') ? 'warning' : 'info'}
              sx={{ p: 2 }}
            >
              <Badge badgeContent={visibleAlerts.length} color="error">
                {getSeverityIcon(visibleAlerts[0]?.indicator || 'info')}
              </Badge>
            </IconButton>
          </Tooltip>
        </Paper>
      );
    }
    
    // Show full sidebar
    return (
      <Paper
        elevation={3}
        sx={{
          position: 'fixed',
          right: 0,
          top: '64px', // Below app bar
          bottom: 0,
          width: 350,
          zIndex: 1100,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          borderLeft: 2,
          borderLeftColor: 'divider'
        }}
      >
        <Box sx={{ 
          p: 2, 
          borderBottom: 1, 
          borderBottomColor: 'divider',
          bgcolor: 'background.paper'
        }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">
              CDS Alerts ({visibleAlerts.length})
            </Typography>
            <Tooltip title="Minimize sidebar">
              <IconButton 
                size="small" 
                onClick={() => setSidebarMinimized(true)}
              >
                <CloseIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>
        <Box sx={{ 
          flex: 1, 
          overflow: 'auto',
          p: 2
        }}>
          <Stack spacing={2}>
            {visibleAlerts.map((alert, index) => {
              const { content, actions } = renderAlert(alert);
              return (
                <Card
                  key={`sidebar-${alert.summary}-${index}`}
                  variant="outlined"
                  sx={{
                    borderColor: getSeverityColor(alert.indicator) + '.main'
                  }}
                >
                  <CardContent sx={{ pb: 1 }}>
                    <Stack direction="row" spacing={1} alignItems="flex-start">
                      {getSeverityIcon(alert.indicator)}
                      <Box sx={{ flex: 1 }}>
                        {content}
                      </Box>
                    </Stack>
                  </CardContent>
                  {actions && (
                    <CardActions sx={{ pt: 0 }}>
                      <Box sx={{ width: '100%' }}>
                        {actions}
                      </Box>
                    </CardActions>
                  )}
                </Card>
              );
            })}
          </Stack>
        </Box>
      </Paper>
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