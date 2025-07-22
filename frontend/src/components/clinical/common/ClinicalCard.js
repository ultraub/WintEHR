/**
 * ClinicalCard Component
 * Enhanced card component with clinical context awareness and interactive features
 */
import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardActions,
  Typography,
  Box,
  IconButton,
  Chip,
  Collapse,
  Stack,
  Divider,
  useTheme,
  alpha,
  Fade,
  Tooltip
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  MoreVert as MoreVertIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Info as InfoIcon,
  Error as ErrorIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';
import { 
  getClinicalContext, 
  getSeverityColor, 
  getClinicalAnimation,
  getClinicalSpacing 
} from '../../../themes/clinicalThemeUtils';
import StatusChip from './StatusChip';

const ClinicalCard = ({
  title,
  subtitle,
  children,
  status,
  severity,
  priority = 'normal',
  department,
  clinicalContext,
  expandable = false,
  expanded: controlledExpanded,
  onExpandChange,
  actions,
  icon,
  timestamp,
  urgent = false,
  showStatusChip = true,
  variant = 'clinical',
  onCardClick,
  headerAction,
  ...props
}) => {
  const theme = useTheme();
  const [internalExpanded, setInternalExpanded] = useState(false);
  
  // Use controlled or internal expansion state
  const isExpanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;
  const setExpanded = onExpandChange || setInternalExpanded;
  
  // Get clinical context
  const context = clinicalContext || getClinicalContext(
    window.location.pathname,
    new Date().getHours(),
    department
  );
  
  // Enhanced context with priority
  const enhancedContext = {
    ...context,
    urgency: urgent ? 'urgent' : priority
  };
  
  // Get clinical styling
  const spacing = getClinicalSpacing(theme, enhancedContext, 'comfortable');
  const animation = getClinicalAnimation(theme, 'hover', enhancedContext);
  
  // Get severity color
  const severityColor = severity ? getSeverityColor(theme, severity, enhancedContext) : null;
  
  // Get priority color
  const getPriorityColor = () => {
    const priorityColors = {
      low: theme.palette.success?.main || '#4caf50',
      normal: theme.palette.info?.main || '#2196f3',
      high: theme.palette.warning?.main || '#ff9800',
      urgent: theme.palette.error?.main || '#f44336'
    };
    return priorityColors[priority] || priorityColors.normal;
  };
  
  // Get status icon
  const getStatusIcon = () => {
    const statusIcons = {
      active: <CheckCircleIcon />,
      pending: <ScheduleIcon />,
      warning: <WarningIcon />,
      error: <ErrorIcon />,
      info: <InfoIcon />
    };
    return statusIcons[status] || <InfoIcon />;
  };
  
  // Get card background based on variant and context
  const getCardBackground = () => {
    if (variant === 'clinical') {
      if (enhancedContext.department !== 'general' && theme.clinical?.departments?.[enhancedContext.department]) {
        return theme.clinical.departments[enhancedContext.department].surface;
      }
      return theme.clinical?.surfaces?.primary || alpha(theme.palette.primary?.main || '#1976D2', 0.05);
    }
    return theme.palette.background.paper;
  };
  
  // Get border color for clinical importance
  const getBorderColor = () => {
    if (urgent) return theme.palette.error?.main || '#f44336';
    if (severityColor) return severityColor;
    if (priority === 'high') return theme.palette.warning?.main || '#ff9800';
    return theme.palette.divider;
  };
  
  const handleExpandClick = () => {
    setExpanded(!isExpanded);
  };
  
  const cardSx = {
    position: 'relative',
    backgroundColor: '#FFFFFF',
    border: '1px solid #E5E7EB',
    borderRadius: '4px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
    transition: `all ${animation.duration}ms ${animation.easing}`,
    cursor: onCardClick ? 'pointer' : 'default',
    '&:hover': onCardClick ? {
      boxShadow: '0 2px 4px rgba(0,0,0,0.06)',
      borderColor: '#D1D5DB'
    } : {},
    // Add severity indicator
    ...(severity && {
      borderLeft: `4px solid ${severityColor}`,
      borderLeftWidth: '4px'
    }),
    // Add urgency indicator
    ...(urgent && {
      borderColor: theme.palette.error?.main || '#f44336',
      backgroundColor: alpha(theme.palette.error?.main || '#f44336', 0.02)
    }),
    // Clean styling for metric variant
    ...(variant === 'metric' && {
      textAlign: 'center',
      minHeight: 120,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      padding: theme.spacing(2)
    }),
    ...props.sx
  };
  
  return (
    <Card sx={cardSx} onClick={onCardClick} {...props}>
      <CardHeader
        avatar={icon && (
          <Box sx={{ 
            color: severityColor || getPriorityColor(),
            display: 'flex',
            alignItems: 'center'
          }}>
            {icon}
          </Box>
        )}
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6" component="div">
              {title}
            </Typography>
            {urgent && (
              <Chip
                size="small"
                label="URGENT"
                color="error"
                sx={{
                  animation: 'pulse 2s infinite',
                  '@keyframes pulse': {
                    '0%': { opacity: 1 },
                    '50%': { opacity: 0.7 },
                    '100%': { opacity: 1 }
                  }
                }}
              />
            )}
          </Box>
        }
        subheader={
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
            {subtitle && (
              <Typography variant="body2" color="text.secondary">
                {subtitle}
              </Typography>
            )}
            {showStatusChip && status && (
              <StatusChip
                status={status}
                variant="clinical"
                size="small"
                department={department}
                urgency={urgent ? 'urgent' : priority}
              />
            )}
            {severity && (
              <Chip
                size="small"
                label={severity.toUpperCase()}
                sx={{
                  backgroundColor: alpha(severityColor, 0.1),
                  color: severityColor,
                  border: `1px solid ${alpha(severityColor, 0.3)}`,
                  fontWeight: 600
                }}
              />
            )}
          </Stack>
        }
        action={
          <Stack direction="row" spacing={0.5} alignItems="center">
            {timestamp && (
              <Tooltip title={`Last updated: ${timestamp}`}>
                <Typography variant="caption" color="text.secondary">
                  {new Date(timestamp).toLocaleTimeString()}
                </Typography>
              </Tooltip>
            )}
            {headerAction}
            {expandable && (
              <IconButton
                onClick={handleExpandClick}
                aria-expanded={isExpanded}
                sx={{
                  transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: theme.transitions.create('transform', {
                    duration: theme.transitions.duration.shortest,
                  }),
                }}
              >
                <ExpandMoreIcon />
              </IconButton>
            )}
            <IconButton size="small">
              <MoreVertIcon />
            </IconButton>
          </Stack>
        }
        sx={{ pb: 0 }}
      />
      
      <CardContent sx={{ pt: spacing / 2 }}>
        {children}
      </CardContent>
      
      {expandable && (
        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
          <CardContent sx={{ pt: 0 }}>
            <Divider sx={{ mb: spacing }} />
            {/* Expandable content would go here */}
            <Typography variant="body2" color="text.secondary">
              Additional clinical details and expanded information...
            </Typography>
          </CardContent>
        </Collapse>
      )}
      
      {actions && (
        <CardActions sx={{ justifyContent: 'flex-end', p: spacing }}>
          {actions}
        </CardActions>
      )}
    </Card>
  );
};

export default ClinicalCard;