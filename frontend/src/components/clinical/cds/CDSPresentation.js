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
  TextField
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
  Launch as LaunchIcon
} from '@mui/icons-material';

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
    // Persist dismissed alerts in sessionStorage for the current browser session
    if (!patientId) return new Set();
    const sessionKey = `cds-dismissed-alerts-${patientId}`;
    try {
      const stored = sessionStorage.getItem(sessionKey);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch (e) {
      return new Set();
    }
  });

  // Modal mode state hooks - must be at top level
  const [acknowledgmentReason, setAcknowledgmentReason] = useState('');
  const [showReasonDialog, setShowReasonDialog] = useState(false);
  const [currentAlertForAck, setCurrentAlertForAck] = useState(null);

  // Handle alert dismissal
  const handleDismissAlert = (alert, reason = '') => {
    const alertId = alert.uuid || alert.id || `${alert.serviceId}-${alert.summary}`;
    setDismissedAlerts(prev => {
      const newDismissed = new Set([...prev, alertId]);
      
      // Persist to sessionStorage
      if (patientId) {
        const sessionKey = `cds-dismissed-alerts-${patientId}`;
        try {
          sessionStorage.setItem(sessionKey, JSON.stringify([...newDismissed]));
        } catch (e) {
          // Ignore storage errors
        }
      }
      
      return newDismissed;
    });
    
    // Call parent onAlertAction callback
    if (onAlertAction) {
      onAlertAction(alertId, 'dismiss', reason);
    }
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

  const handleAlertAction = (alert, action, suggestion = null) => {
    const alertKey = `${alert.serviceId}-${alert.summary}`;
    
    if (action === 'dismiss') {
      setDismissedAlerts(prev => {
        const newSet = new Set([...prev, alertKey]);
        // Save to sessionStorage if patientId is provided
        if (patientId) {
          const sessionKey = `cds-dismissed-alerts-${patientId}`;
          try {
            sessionStorage.setItem(sessionKey, JSON.stringify([...newSet]));
          } catch (e) {
            
          }
        }
        return newSet;
      });
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
        key={index}
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
    const alertKey = `${alert.serviceId}-${alert.summary}`;
    if (dismissedAlerts.has(alertKey)) return null;

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

  const visibleAlerts = alerts.filter(alert => 
    !dismissedAlerts.has(`${alert.serviceId}-${alert.summary}`)
  ).slice(0, maxAlerts);

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
              key={index}
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
        {visibleAlerts.map((alert, index) => (
          <Snackbar
            key={index}
            open={open}
            autoHideDuration={autoHide ? hideDelay : null}
            onClose={() => setOpen(false)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            TransitionComponent={Slide}
          >
            <Alert severity={getSeverityColor(alert.indicator)}>
              {renderAlert(alert, true).content}
            </Alert>
          </Snackbar>
        ))}
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
                <Card key={index} variant="outlined">
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
                  <Card key={index} variant="outlined" sx={{ border: '2px solid', borderColor: 'error.main' }}>
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
                key={index}
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
                  key={index}
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
            key={index}
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
              <Typography key={index} variant="body2" color="text.secondary" sx={{ mt: 1 }}>
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
    </Stack>
  );
};

export default CDSPresentation;