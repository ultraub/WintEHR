/**
 * Drug Safety Indicator Component
 * Real-time drug safety status indicator with expandable details
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Chip,
  IconButton,
  Tooltip,
  Badge,
  CircularProgress,
  Popover,
  Paper,
  Typography,
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider
} from '@mui/material';
import {
  Security as SafetyIcon,
  CheckCircle as SafeIcon,
  Warning as WarningIcon,
  Error as DangerIcon,
  Info as InfoIcon,
  Refresh as RefreshIcon,
  Visibility as ViewIcon
} from '@mui/icons-material';

const SEVERITY_CONFIG = {
  none: {
    color: 'success',
    icon: <SafeIcon />,
    label: 'Safe',
    badgeColor: 'success'
  },
  low: {
    color: 'info',
    icon: <InfoIcon />,
    label: 'Low Risk',
    badgeColor: 'info'
  },
  moderate: {
    color: 'warning',
    icon: <WarningIcon />,
    label: 'Moderate Risk',
    badgeColor: 'warning'
  },
  high: {
    color: 'error',
    icon: <DangerIcon />,
    label: 'High Risk',
    badgeColor: 'error'
  },
  critical: {
    color: 'error',
    icon: <DangerIcon />,
    label: 'Critical Risk',
    badgeColor: 'error',
    pulse: true
  }
};

const DrugSafetyIndicator = ({
  safetyData,
  loading = false,
  onRefresh,
  onViewDetails,
  size = 'medium',
  showLabel = true,
  expandable = true,
  autoRefresh = false,
  refreshInterval = 60000 // 1 minute
}) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [expanded, setExpanded] = useState(false);

  // Auto-refresh functionality
  useEffect(() => {
    if (autoRefresh && onRefresh && refreshInterval > 0) {
      const timer = setInterval(() => {
        onRefresh();
      }, refreshInterval);

      return () => clearInterval(timer);
    }
  }, [autoRefresh, onRefresh, refreshInterval]);

  const getSeverity = () => {
    if (!safetyData) return 'none';
    
    const score = safetyData.overall_risk_score || 0;
    if (score >= 7) return 'critical';
    if (score >= 5) return 'high';
    if (score >= 3) return 'moderate';
    if (score > 0) return 'low';
    return 'none';
  };

  const severity = getSeverity();
  const config = SEVERITY_CONFIG[severity];
  const alertCount = safetyData?.total_alerts || 0;

  const handleClick = (event) => {
    if (expandable) {
      setAnchorEl(event.currentTarget);
      setExpanded(true);
    } else if (onViewDetails) {
      onViewDetails();
    }
  };

  const handleClose = () => {
    setAnchorEl(null);
    setExpanded(false);
  };

  const getAlertSummary = () => {
    if (!safetyData) return [];
    
    const summary = [];
    
    if (safetyData.interactions?.length > 0) {
      summary.push({
        type: 'Drug Interactions',
        count: safetyData.interactions.length,
        critical: safetyData.interactions.filter(i => 
          i.severity === 'contraindicated' || i.severity === 'major'
        ).length
      });
    }
    
    if (safetyData.allergy_alerts?.length > 0) {
      summary.push({
        type: 'Allergy Alerts',
        count: safetyData.allergy_alerts.length,
        critical: safetyData.allergy_alerts.filter(a => a.reaction_type === 'direct').length
      });
    }
    
    if (safetyData.contraindications?.length > 0) {
      summary.push({
        type: 'Contraindications',
        count: safetyData.contraindications.length,
        critical: safetyData.contraindications.filter(c => c.contraindication_type === 'absolute').length
      });
    }
    
    if (safetyData.duplicate_therapy?.length > 0) {
      summary.push({
        type: 'Duplicate Therapy',
        count: safetyData.duplicate_therapy.length,
        critical: 0
      });
    }
    
    if (safetyData.dosage_alerts?.length > 0) {
      summary.push({
        type: 'Dosage Alerts',
        count: safetyData.dosage_alerts.length,
        critical: safetyData.dosage_alerts.filter(d => d.issue_type === 'overdose').length
      });
    }
    
    return summary;
  };

  const renderIndicator = () => {
    if (loading) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CircularProgress size={20} />
          {showLabel && (
            <Typography variant="body2" color="text.secondary">
              Checking safety...
            </Typography>
          )}
        </Box>
      );
    }

    const indicator = (
      <Chip
        icon={config.icon}
        label={showLabel ? config.label : undefined}
        color={config.color}
        size={size}
        onClick={handleClick}
        sx={{
          cursor: expandable || onViewDetails ? 'pointer' : 'default',
          ...(config.pulse && {
            animation: 'pulse 2s infinite',
            '@keyframes pulse': {
              '0%': { boxShadow: '0 0 0 0 rgba(211, 47, 47, 0.7)' },
              '70%': { boxShadow: '0 0 0 10px rgba(211, 47, 47, 0)' },
              '100%': { boxShadow: '0 0 0 0 rgba(211, 47, 47, 0)' }
            }
          })
        }}
      />
    );

    if (alertCount > 0) {
      return (
        <Badge badgeContent={alertCount} color={config.badgeColor}>
          {indicator}
        </Badge>
      );
    }

    return indicator;
  };

  return (
    <>
      <Tooltip title={`Drug Safety: ${config.label}${alertCount > 0 ? ` (${alertCount} alerts)` : ''}`}>
        {renderIndicator()}
      </Tooltip>

      {expandable && (
        <Popover
          open={expanded}
          anchorEl={anchorEl}
          onClose={handleClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'left',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'left',
          }}
        >
          <Paper sx={{ p: 2, minWidth: 300, maxWidth: 400 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SafetyIcon color="primary" />
                <Typography variant="h6">
                  Drug Safety Summary
                </Typography>
              </Box>
              {onRefresh && (
                <Tooltip title="Refresh">
                  <IconButton size="small" onClick={onRefresh}>
                    <RefreshIcon />
                  </IconButton>
                </Tooltip>
              )}
            </Box>

            {safetyData ? (
              <>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Risk Score
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="h4" color={config.color}>
                      {safetyData.overall_risk_score?.toFixed(1) || '0.0'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      / 10
                    </Typography>
                  </Box>
                </Box>

                <Divider sx={{ my: 1 }} />

                <List dense>
                  {getAlertSummary().map((item, index) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        {item.critical > 0 ? <DangerIcon color="error" /> : <WarningIcon color="warning" />}
                      </ListItemIcon>
                      <ListItemText
                        primary={item.type}
                        secondary={`${item.count} alert${item.count !== 1 ? 's' : ''}${
                          item.critical > 0 ? ` (${item.critical} critical)` : ''
                        }`}
                      />
                    </ListItem>
                  ))}
                </List>

                {safetyData.recommendations?.length > 0 && (
                  <>
                    <Divider sx={{ my: 1 }} />
                    <Typography variant="subtitle2" gutterBottom>
                      Key Recommendations
                    </Typography>
                    <Box sx={{ maxHeight: 120, overflow: 'auto' }}>
                      {safetyData.recommendations.slice(0, 3).map((rec, index) => (
                        <Typography key={index} variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                          • {rec}
                        </Typography>
                      ))}
                    </Box>
                  </>
                )}

                {onViewDetails && (
                  <Box sx={{ mt: 2 }}>
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<ViewIcon />}
                      onClick={() => {
                        handleClose();
                        onViewDetails();
                      }}
                    >
                      View Full Details
                    </Button>
                  </Box>
                )}
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No safety data available
              </Typography>
            )}
          </Paper>
        </Popover>
      )}
    </>
  );
};

export default DrugSafetyIndicator;