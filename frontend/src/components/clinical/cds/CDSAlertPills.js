/**
 * CDS Alert Pills Component
 * Displays CDS alerts as compact pills in the clinical workspace header
 * Provides quick visibility without taking up workspace space
 */

import React, { useState, useMemo } from 'react';
import {
  Box,
  Chip,
  Stack,
  IconButton,
  Badge,
  Tooltip,
  Popover,
  Typography,
  Button,
  useTheme,
  alpha,
  Collapse,
  Paper
} from '@mui/material';
import {
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Notifications as NotificationsIcon,
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon
} from '@mui/icons-material';
import { useCDS } from '../../../contexts/CDSContext';

const CDSAlertPills = ({ maxVisible = 3, hookType = 'patient-view' }) => {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState(null);
  const [expandedCard, setExpandedCard] = useState(null);
  const { getAlerts } = useCDS();
  
  // Get alerts from CDSContext
  const alerts = getAlerts(hookType) || [];
  
  // Group alerts by severity
  const alertGroups = useMemo(() => {
    const groups = {
      critical: [],
      warning: [],
      info: []
    };
    
    alerts.forEach(alert => {
      const severity = alert.indicator || 'info';
      if (groups[severity]) {
        groups[severity].push(alert);
      }
    });
    
    return groups;
  }, [alerts]);
  
  // Calculate total counts
  const criticalCount = alertGroups.critical.length;
  const warningCount = alertGroups.warning.length;
  const infoCount = alertGroups.info.length;
  const totalCount = criticalCount + warningCount + infoCount;
  
  // Create pills for display
  const pills = useMemo(() => {
    const result = [];
    
    // Add critical pill if there are critical alerts
    if (criticalCount > 0) {
      result.push({
        id: 'critical',
        severity: 'critical',
        count: criticalCount,
        label: criticalCount === 1 ? 'Critical Alert' : `${criticalCount} Critical`,
        icon: <ErrorIcon sx={{ fontSize: 16 }} />,
        color: 'error'
      });
    }
    
    // Add warning pill if there are warnings
    if (warningCount > 0) {
      result.push({
        id: 'warning',
        severity: 'warning',
        count: warningCount,
        label: warningCount === 1 ? 'Warning' : `${warningCount} Warnings`,
        icon: <WarningIcon sx={{ fontSize: 16 }} />,
        color: 'warning'
      });
    }
    
    // Add info pill if there are info alerts
    if (infoCount > 0) {
      result.push({
        id: 'info',
        severity: 'info',
        count: infoCount,
        label: `${infoCount} Info`,
        icon: <InfoIcon sx={{ fontSize: 16 }} />,
        color: 'info'
      });
    }
    
    return result;
  }, [criticalCount, warningCount, infoCount]);
  
  const handlePillClick = (event) => {
    setAnchorEl(event.currentTarget);
  };
  
  const handleClose = () => {
    setAnchorEl(null);
    setExpandedCard(null);
  };
  
  // Don't render if no alerts
  if (totalCount === 0) {
    return null;
  }
  
  const open = Boolean(anchorEl);
  const id = open ? 'cds-alerts-popover' : undefined;
  
  return (
    <>
      {/* Compact Pills Display */}
      <Stack direction="row" spacing={0.5} alignItems="center">
        {/* Show individual pills for critical and warning */}
        {pills.slice(0, maxVisible).map((pill) => (
          <Tooltip key={pill.id} title={`Click to view ${pill.label.toLowerCase()}`}>
            <Chip
              icon={pill.icon}
              label={pill.label}
              color={pill.color}
              size="small"
              onClick={handlePillClick}
              sx={{
                height: 24,
                fontWeight: 600,
                cursor: 'pointer',
                '& .MuiChip-icon': {
                  fontSize: 16,
                  marginLeft: '6px'
                },
                '& .MuiChip-label': {
                  px: 0.75,
                  fontSize: '0.75rem'
                },
                ...(pill.severity === 'critical' && {
                  animation: 'pulse 2s infinite',
                  '@keyframes pulse': {
                    '0%': {
                      boxShadow: `0 0 0 0 ${alpha(theme.palette.error.main, 0.4)}`
                    },
                    '70%': {
                      boxShadow: `0 0 0 6px ${alpha(theme.palette.error.main, 0)}`
                    },
                    '100%': {
                      boxShadow: `0 0 0 0 ${alpha(theme.palette.error.main, 0)}`
                    }
                  }
                })
              }}
            />
          </Tooltip>
        ))}
        
        {/* Summary badge if there are many alerts */}
        {totalCount > maxVisible && (
          <Tooltip title="View all CDS alerts">
            <IconButton
              size="small"
              onClick={handlePillClick}
              sx={{
                width: 28,
                height: 28,
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                '&:hover': {
                  bgcolor: alpha(theme.palette.primary.main, 0.2)
                }
              }}
            >
              <Badge
                badgeContent={totalCount}
                color={criticalCount > 0 ? "error" : warningCount > 0 ? "warning" : "info"}
                max={99}
              >
                <NotificationsIcon sx={{ fontSize: 18 }} />
              </Badge>
            </IconButton>
          </Tooltip>
        )}
      </Stack>
      
      {/* Popover with Alert Details */}
      <Popover
        id={id}
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        PaperProps={{
          sx: {
            width: 400,
            maxHeight: '80vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }
        }}
      >
        {/* Header */}
        <Box
          sx={{
            px: 2,
            py: 1.5,
            borderBottom: 1,
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            bgcolor: 'background.paper'
          }}
        >
          <Typography variant="subtitle1" fontWeight={600}>
            Clinical Decision Support Alerts
          </Typography>
          <IconButton size="small" onClick={handleClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
        
        {/* Alert Summary */}
        <Box sx={{ px: 2, py: 1, borderBottom: 1, borderColor: 'divider' }}>
          <Stack direction="row" spacing={2}>
            {criticalCount > 0 && (
              <Stack direction="row" spacing={0.5} alignItems="center">
                <ErrorIcon color="error" sx={{ fontSize: 18 }} />
                <Typography variant="body2" color="error" fontWeight={600}>
                  {criticalCount} Critical
                </Typography>
              </Stack>
            )}
            {warningCount > 0 && (
              <Stack direction="row" spacing={0.5} alignItems="center">
                <WarningIcon color="warning" sx={{ fontSize: 18 }} />
                <Typography variant="body2" color="warning.main" fontWeight={600}>
                  {warningCount} Warning{warningCount > 1 ? 's' : ''}
                </Typography>
              </Stack>
            )}
            {infoCount > 0 && (
              <Stack direction="row" spacing={0.5} alignItems="center">
                <InfoIcon color="info" sx={{ fontSize: 18 }} />
                <Typography variant="body2" color="info.main" fontWeight={600}>
                  {infoCount} Info
                </Typography>
              </Stack>
            )}
          </Stack>
        </Box>
        
        {/* Alert List */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          <Stack spacing={1.5}>
            {/* Critical alerts first */}
            {alertGroups.critical.map((alert) => (
              <Paper
                key={alert.uuid}
                elevation={0}
                sx={{
                  p: 1.5,
                  border: 1,
                  borderColor: 'error.main',
                  borderRadius: 1,
                  bgcolor: alpha(theme.palette.error.main, 0.05)
                }}
              >
                <Stack spacing={1}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <ErrorIcon color="error" sx={{ fontSize: 20 }} />
                    <Typography variant="subtitle2" fontWeight={600} sx={{ flex: 1 }}>
                      {alert.summary}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() => setExpandedCard(expandedCard === alert.uuid ? null : alert.uuid)}
                    >
                      {expandedCard === alert.uuid ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  </Stack>
                  
                  <Collapse in={expandedCard === alert.uuid}>
                    <Box sx={{ pt: 1 }}>
                      {alert.detail && (
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          {alert.detail}
                        </Typography>
                      )}
                      {alert.suggestions && alert.suggestions.length > 0 && (
                        <Stack spacing={0.5} sx={{ mt: 1 }}>
                          {alert.suggestions.map((suggestion) => (
                            <Button
                              key={suggestion.uuid}
                              size="small"
                              variant="outlined"
                              color="primary"
                              fullWidth
                              sx={{ justifyContent: 'flex-start' }}
                            >
                              {suggestion.label}
                            </Button>
                          ))}
                        </Stack>
                      )}
                    </Box>
                  </Collapse>
                </Stack>
              </Paper>
            ))}
            
            {/* Warning alerts */}
            {alertGroups.warning.map((alert) => (
              <Paper
                key={alert.uuid}
                elevation={0}
                sx={{
                  p: 1.5,
                  border: 1,
                  borderColor: 'warning.main',
                  borderRadius: 1,
                  bgcolor: alpha(theme.palette.warning.main, 0.05)
                }}
              >
                <Stack spacing={1}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <WarningIcon color="warning" sx={{ fontSize: 20 }} />
                    <Typography variant="subtitle2" fontWeight={600} sx={{ flex: 1 }}>
                      {alert.summary}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() => setExpandedCard(expandedCard === alert.uuid ? null : alert.uuid)}
                    >
                      {expandedCard === alert.uuid ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  </Stack>
                  
                  <Collapse in={expandedCard === alert.uuid}>
                    <Box sx={{ pt: 1 }}>
                      {alert.detail && (
                        <Typography variant="body2" color="text.secondary">
                          {alert.detail}
                        </Typography>
                      )}
                    </Box>
                  </Collapse>
                </Stack>
              </Paper>
            ))}
            
            {/* Info alerts */}
            {alertGroups.info.map((alert) => (
              <Paper
                key={alert.uuid}
                elevation={0}
                sx={{
                  p: 1.5,
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1
                }}
              >
                <Stack direction="row" alignItems="center" spacing={1}>
                  <InfoIcon color="info" sx={{ fontSize: 20 }} />
                  <Typography variant="subtitle2" sx={{ flex: 1 }}>
                    {alert.summary}
                  </Typography>
                </Stack>
              </Paper>
            ))}
          </Stack>
        </Box>
        
        {/* Footer Actions */}
        <Box
          sx={{
            px: 2,
            py: 1.5,
            borderTop: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper'
          }}
        >
          <Button
            fullWidth
            variant="outlined"
            onClick={() => {
              handleClose();
              // Navigate to full CDS view
              window.location.href = '#cds-alerts';
            }}
          >
            View All Details
          </Button>
        </Box>
      </Popover>
    </>
  );
};

export default CDSAlertPills;