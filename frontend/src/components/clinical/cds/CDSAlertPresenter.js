/**
 * CDS Alert Presenter Component
 * Unified presentation of CDS alerts with support for different display modes
 * Integrates with dialogs and clinical workflows
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Stack,
  Alert,
  AlertTitle,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Drawer,
  Badge,
  Chip,
  Typography,
  Collapse,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Paper,
  Divider,
  TextField,
  FormControlLabel,
  Checkbox,
  Snackbar,
  Fade,
  Slide,
  Zoom,
  useTheme,
  alpha
} from '@mui/material';
import {
  Warning as WarningIcon,
  Error as CriticalIcon,
  Info as InfoIcon,
  CheckCircle as SuccessIcon,
  Close as CloseIcon,
  Snooze as SnoozeIcon,
  Link as LinkIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Notifications as AlertIcon,
  Block as BlockIcon,
  ThumbUp as AcknowledgeIcon,
  Timer as TimerIcon,
  Launch as LaunchIcon
} from '@mui/icons-material';
import { clinicalCDSService } from '../../../services/clinicalCDSService';
import { format } from 'date-fns';

// Alert presentation modes
export const ALERT_MODES = {
  INLINE: 'inline',
  POPUP: 'popup',
  MODAL: 'modal',
  SIDEBAR: 'sidebar',
  SNACKBAR: 'snackbar'
};

// Alert severity mapping
const SEVERITY_CONFIG = {
  critical: {
    color: 'error',
    icon: CriticalIcon,
    priority: 1
  },
  warning: {
    color: 'warning',
    icon: WarningIcon,
    priority: 2
  },
  info: {
    color: 'info',
    icon: InfoIcon,
    priority: 3
  },
  success: {
    color: 'success',
    icon: SuccessIcon,
    priority: 4
  }
};

const CDSAlertPresenter = ({
  alerts = [],
  mode = ALERT_MODES.INLINE,
  onAction,
  onDismiss,
  onAcknowledge,
  context = {},
  allowSnooze = true,
  allowDismiss = true,
  requireAcknowledgment = false,
  groupByService = true,
  maxVisible = 5,
  position = 'top-right',
  autoHide = false,
  autoHideDelay = 30000,
  showTimestamp = true,
  showSource = true,
  dense = false
}) => {
  const theme = useTheme();
  const [displayedAlerts, setDisplayedAlerts] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedAlerts, setExpandedAlerts] = useState(new Set());
  const [acknowledgments, setAcknowledgments] = useState(new Map());
  const [snoozedAlerts, setSnoozedAlerts] = useState(new Set());
  const [snoozeDialogOpen, setSnoozeDialogOpen] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [snoozeMinutes, setSnoozeMinutes] = useState(60);
  const [acknowledgmentNotes, setAcknowledgmentNotes] = useState('');

  // Process and sort alerts
  useEffect(() => {
    let processed = alerts
      .filter(alert => !snoozedAlerts.has(alert.id))
      .map(alert => clinicalCDSService.formatAlertForDisplay(alert))
      .sort((a, b) => {
        const aSev = SEVERITY_CONFIG[a.indicator] || SEVERITY_CONFIG.info;
        const bSev = SEVERITY_CONFIG[b.indicator] || SEVERITY_CONFIG.info;
        return aSev.priority - bSev.priority;
      });

    // Limit visible alerts in inline mode
    if (mode === ALERT_MODES.INLINE && maxVisible) {
      processed = processed.slice(0, maxVisible);
    }

    setDisplayedAlerts(processed);

    // Auto-show modal/sidebar for critical alerts
    if (processed.some(a => a.indicator === 'critical')) {
      if (mode === ALERT_MODES.MODAL) {
        setModalOpen(true);
      } else if (mode === ALERT_MODES.SIDEBAR) {
        setSidebarOpen(true);
      }
    }
  }, [alerts, snoozedAlerts, mode, maxVisible]);

  // Auto-hide timer
  useEffect(() => {
    if (autoHide && displayedAlerts.length > 0) {
      const timer = setTimeout(() => {
        if (mode === ALERT_MODES.SNACKBAR) {
          setDisplayedAlerts([]);
        } else if (mode === ALERT_MODES.MODAL) {
          setModalOpen(false);
        } else if (mode === ALERT_MODES.SIDEBAR) {
          setSidebarOpen(false);
        }
      }, autoHideDelay);

      return () => clearTimeout(timer);
    }
  }, [autoHide, autoHideDelay, displayedAlerts.length, mode]);

  // Handle alert expansion
  const toggleExpanded = (alertId) => {
    setExpandedAlerts(prev => {
      const next = new Set(prev);
      if (next.has(alertId)) {
        next.delete(alertId);
      } else {
        next.add(alertId);
      }
      return next;
    });
  };

  // Handle acknowledgment
  const handleAcknowledge = (alert) => {
    if (requireAcknowledgment) {
      setSelectedAlert(alert);
      setSnoozeDialogOpen(false);
      // Show acknowledgment dialog
    } else {
      const acknowledgment = {
        timestamp: new Date(),
        notes: '',
        userId: context.userId
      };
      
      setAcknowledgments(prev => new Map(prev).set(alert.id, acknowledgment));
      clinicalCDSService.acknowledgeAlert(alert.id, acknowledgment);
      
      if (onAcknowledge) {
        onAcknowledge(alert, acknowledgment);
      }
    }
  };

  // Handle snooze
  const handleSnooze = (alert) => {
    setSelectedAlert(alert);
    setSnoozeDialogOpen(true);
  };

  const confirmSnooze = () => {
    if (selectedAlert) {
      const duration = snoozeMinutes * 60 * 1000;
      setSnoozedAlerts(prev => new Set(prev).add(selectedAlert.id));
      clinicalCDSService.snoozeAlert(selectedAlert.id, duration);
      
      // Remove after snooze duration
      setTimeout(() => {
        setSnoozedAlerts(prev => {
          const next = new Set(prev);
          next.delete(selectedAlert.id);
          return next;
        });
      }, duration);
    }
    
    setSnoozeDialogOpen(false);
    setSelectedAlert(null);
    setSnoozeMinutes(60);
  };

  // Handle dismiss
  const handleDismiss = (alert) => {
    if (onDismiss) {
      onDismiss(alert);
    }
  };

  // Handle action
  const handleAction = (action, alert) => {
    if (onAction) {
      onAction(action, alert);
    }
    
    // Auto-acknowledge after action
    if (!acknowledgments.has(alert.id)) {
      handleAcknowledge(alert);
    }
  };

  // Render alert content
  const renderAlertContent = (alert, isExpanded = false) => {
    const severity = SEVERITY_CONFIG[alert.indicator] || SEVERITY_CONFIG.info;
    const Icon = severity.icon;
    
    return (
      <Box>
        <Stack direction="row" spacing={1} alignItems="flex-start">
          <Icon color={severity.color} fontSize={dense ? 'small' : 'medium'} />
          <Box sx={{ flex: 1 }}>
            <Typography variant={dense ? 'body2' : 'subtitle2'} gutterBottom>
              {alert.displaySummary}
            </Typography>
            
            <Collapse in={isExpanded}>
              <Typography 
                variant="body2" 
                color="text.secondary" 
                paragraph
                dangerouslySetInnerHTML={{ __html: alert.displayDetail }}
              />
              
              {/* Links */}
              {alert.links?.length > 0 && (
                <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 1 }}>
                  {alert.links.map((link, idx) => (
                    <Chip
                      key={idx}
                      label={link.label}
                      size="small"
                      icon={<LaunchIcon />}
                      onClick={() => window.open(link.url, '_blank')}
                      clickable
                    />
                  ))}
                </Stack>
              )}
              
              {/* Suggestions */}
              {alert.suggestions?.length > 0 && (
                <Stack spacing={1}>
                  <Typography variant="caption" color="text.secondary">
                    Suggested Actions:
                  </Typography>
                  {alert.suggestions.map((suggestion, idx) => (
                    <Button
                      key={idx}
                      size="small"
                      variant="outlined"
                      onClick={() => handleAction(suggestion, alert)}
                    >
                      {suggestion.label}
                    </Button>
                  ))}
                </Stack>
              )}
            </Collapse>
            
            {/* Metadata */}
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
              {showSource && alert.serviceName && (
                <Chip label={alert.serviceName} size="small" variant="outlined" />
              )}
              {showTimestamp && (
                <Typography variant="caption" color="text.secondary">
                  {alert.displayTime}
                </Typography>
              )}
              {acknowledgments.has(alert.id) && (
                <Chip 
                  label="Acknowledged" 
                  size="small" 
                  color="success" 
                  icon={<CheckCircle fontSize="small" />}
                />
              )}
            </Stack>
          </Box>
        </Stack>
      </Box>
    );
  };

  // Render actions
  const renderAlertActions = (alert, isExpanded) => (
    <Stack direction="row" spacing={0.5}>
      <IconButton
        size="small"
        onClick={() => toggleExpanded(alert.id)}
        title={isExpanded ? 'Collapse' : 'Expand'}
      >
        {isExpanded ? <CollapseIcon /> : <ExpandIcon />}
      </IconButton>
      
      {!acknowledgments.has(alert.id) && (
        <IconButton
          size="small"
          onClick={() => handleAcknowledge(alert)}
          title="Acknowledge"
          color="primary"
        >
          <AcknowledgeIcon />
        </IconButton>
      )}
      
      {allowSnooze && !snoozedAlerts.has(alert.id) && (
        <IconButton
          size="small"
          onClick={() => handleSnooze(alert)}
          title="Snooze"
        >
          <SnoozeIcon />
        </IconButton>
      )}
      
      {allowDismiss && (
        <IconButton
          size="small"
          onClick={() => handleDismiss(alert)}
          title="Dismiss"
        >
          <CloseIcon />
        </IconButton>
      )}
    </Stack>
  );

  // Group alerts by service
  const groupAlerts = () => {
    if (!groupByService) return { '': displayedAlerts };
    
    return displayedAlerts.reduce((groups, alert) => {
      const key = alert.serviceName || 'Other';
      if (!groups[key]) groups[key] = [];
      groups[key].push(alert);
      return groups;
    }, {});
  };

  // Render based on mode
  switch (mode) {
    case ALERT_MODES.INLINE:
      return (
        <Stack spacing={dense ? 1 : 2}>
          {displayedAlerts.map(alert => {
            const isExpanded = expandedAlerts.has(alert.id);
            const severity = SEVERITY_CONFIG[alert.indicator] || SEVERITY_CONFIG.info;
            
            return (
              <Alert
                key={alert.id}
                severity={severity.color}
                action={renderAlertActions(alert, isExpanded)}
                sx={{
                  '& .MuiAlert-message': { width: '100%' }
                }}
              >
                {renderAlertContent(alert, isExpanded)}
              </Alert>
            );
          })}
          
          {alerts.length > maxVisible && (
            <Button
              size="small"
              onClick={() => mode === ALERT_MODES.MODAL ? setModalOpen(true) : setSidebarOpen(true)}
            >
              View all {alerts.length} alerts
            </Button>
          )}
        </Stack>
      );

    case ALERT_MODES.POPUP:
      return (
        <Box
          sx={{
            position: 'fixed',
            [position.includes('top') ? 'top' : 'bottom']: 16,
            [position.includes('right') ? 'right' : 'left']: 16,
            maxWidth: 400,
            zIndex: theme.zIndex.snackbar
          }}
        >
          <Stack spacing={1}>
            {displayedAlerts.slice(0, 3).map(alert => (
              <Zoom key={alert.id} in>
                <Paper
                  elevation={6}
                  sx={{
                    p: 2,
                    backgroundColor: alpha(theme.palette.background.paper, 0.98)
                  }}
                >
                  {renderAlertContent(alert)}
                  <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                    {alert.suggestions?.slice(0, 2).map((suggestion, idx) => (
                      <Button
                        key={idx}
                        size="small"
                        variant="contained"
                        onClick={() => handleAction(suggestion, alert)}
                      >
                        {suggestion.label}
                      </Button>
                    ))}
                    <Box sx={{ flex: 1 }} />
                    {renderAlertActions(alert, false)}
                  </Stack>
                </Paper>
              </Zoom>
            ))}
          </Stack>
        </Box>
      );

    case ALERT_MODES.MODAL:
      return (
        <>
          {alerts.length > 0 && !modalOpen && (
            <Badge
              badgeContent={alerts.length}
              color="error"
              sx={{
                position: 'fixed',
                bottom: 16,
                right: 16,
                zIndex: theme.zIndex.fab
              }}
            >
              <IconButton
                color="primary"
                onClick={() => setModalOpen(true)}
                sx={{
                  backgroundColor: theme.palette.primary.main,
                  color: theme.palette.primary.contrastText,
                  '&:hover': {
                    backgroundColor: theme.palette.primary.dark
                  }
                }}
              >
                <AlertIcon />
              </IconButton>
            </Badge>
          )}
          
          <Dialog
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            maxWidth="md"
            fullWidth
            PaperProps={{
              sx: { minHeight: 400 }
            }}
          >
            <DialogTitle>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Typography variant="h6">
                  Clinical Decision Support Alerts ({alerts.length})
                </Typography>
                <IconButton onClick={() => setModalOpen(false)}>
                  <CloseIcon />
                </IconButton>
              </Stack>
            </DialogTitle>
            
            <DialogContent dividers>
              {Object.entries(groupAlerts()).map(([service, serviceAlerts]) => (
                <Box key={service} sx={{ mb: 3 }}>
                  {groupByService && service && (
                    <Typography variant="subtitle2" color="primary" gutterBottom>
                      {service} ({serviceAlerts.length})
                    </Typography>
                  )}
                  
                  <Stack spacing={2}>
                    {serviceAlerts.map(alert => {
                      const isExpanded = expandedAlerts.has(alert.id);
                      
                      return (
                        <Paper key={alert.id} variant="outlined" sx={{ p: 2 }}>
                          <Stack direction="row" spacing={2}>
                            <Box sx={{ flex: 1 }}>
                              {renderAlertContent(alert, isExpanded)}
                            </Box>
                            <Box>
                              {renderAlertActions(alert, isExpanded)}
                            </Box>
                          </Stack>
                        </Paper>
                      );
                    })}
                  </Stack>
                </Box>
              ))}
            </DialogContent>
            
            <DialogActions>
              <Button onClick={() => setModalOpen(false)}>Close</Button>
              {requireAcknowledgment && alerts.some(a => !acknowledgments.has(a.id)) && (
                <Button 
                  variant="contained" 
                  onClick={() => {
                    // Acknowledge all
                    alerts.forEach(alert => {
                      if (!acknowledgments.has(alert.id)) {
                        handleAcknowledge(alert);
                      }
                    });
                  }}
                >
                  Acknowledge All
                </Button>
              )}
            </DialogActions>
          </Dialog>
        </>
      );

    case ALERT_MODES.SIDEBAR:
      return (
        <>
          {alerts.length > 0 && !sidebarOpen && (
            <Badge
              badgeContent={alerts.length}
              color="error"
              sx={{
                position: 'fixed',
                top: '50%',
                right: 0,
                transform: 'translateY(-50%)',
                zIndex: theme.zIndex.drawer - 1
              }}
            >
              <IconButton
                color="primary"
                onClick={() => setSidebarOpen(true)}
                sx={{
                  borderRadius: '4px 0 0 4px',
                  backgroundColor: theme.palette.primary.main,
                  color: theme.palette.primary.contrastText,
                  '&:hover': {
                    backgroundColor: theme.palette.primary.dark
                  }
                }}
              >
                <AlertIcon />
              </IconButton>
            </Badge>
          )}
          
          <Drawer
            anchor="right"
            open={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            PaperProps={{
              sx: { width: 400 }
            }}
          >
            <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                <Typography variant="h6">
                  CDS Alerts ({alerts.length})
                </Typography>
                <IconButton onClick={() => setSidebarOpen(false)}>
                  <CloseIcon />
                </IconButton>
              </Stack>
              
              <Box sx={{ flex: 1, overflow: 'auto' }}>
                {Object.entries(groupAlerts()).map(([service, serviceAlerts]) => (
                  <Box key={service} sx={{ mb: 3 }}>
                    {groupByService && service && (
                      <Typography variant="subtitle2" color="primary" gutterBottom>
                        {service} ({serviceAlerts.length})
                      </Typography>
                    )}
                    
                    <Stack spacing={1}>
                      {serviceAlerts.map(alert => {
                        const isExpanded = expandedAlerts.has(alert.id);
                        
                        return (
                          <Paper key={alert.id} variant="outlined" sx={{ p: 2 }}>
                            {renderAlertContent(alert, isExpanded)}
                            <Box sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end' }}>
                              {renderAlertActions(alert, isExpanded)}
                            </Box>
                          </Paper>
                        );
                      })}
                    </Stack>
                  </Box>
                ))}
              </Box>
            </Box>
          </Drawer>
        </>
      );

    case ALERT_MODES.SNACKBAR:
      const currentAlert = displayedAlerts[0];
      if (!currentAlert) return null;
      
      return (
        <Snackbar
          open={true}
          autoHideDuration={autoHide ? autoHideDelay : null}
          onClose={() => handleDismiss(currentAlert)}
          anchorOrigin={{
            vertical: position.includes('top') ? 'top' : 'bottom',
            horizontal: position.includes('right') ? 'right' : 'left'
          }}
        >
          <Alert
            severity={SEVERITY_CONFIG[currentAlert.indicator]?.color || 'info'}
            action={
              <Stack direction="row" spacing={0.5}>
                {currentAlert.suggestions?.slice(0, 1).map((suggestion, idx) => (
                  <Button
                    key={idx}
                    size="small"
                    color="inherit"
                    onClick={() => handleAction(suggestion, currentAlert)}
                  >
                    {suggestion.label}
                  </Button>
                ))}
                <IconButton
                  size="small"
                  color="inherit"
                  onClick={() => handleDismiss(currentAlert)}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Stack>
            }
          >
            {currentAlert.displaySummary}
          </Alert>
        </Snackbar>
      );

    default:
      return null;
  }
};

export default CDSAlertPresenter;