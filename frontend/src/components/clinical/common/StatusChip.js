/**
 * StatusChip Component
 * Reusable status indicator with theme-aware colors and consistent styling
 */
import React from 'react';
import { Chip, useTheme } from '@mui/material';
import {
  CheckCircle as ActiveIcon,
  Pause as InactiveIcon,
  Schedule as PendingIcon,
  TaskAlt as CompletedIcon,
  Cancel as CancelledIcon,
  Edit as DraftIcon,
  PlayArrow as InProgressIcon
} from '@mui/icons-material';
import { 
  getClinicalContext, 
  getStatusColor, 
  getClinicalAnimation 
} from '../../../themes/clinicalThemeUtils';

const StatusChip = ({ 
  status, 
  variant = 'clinical', 
  size = 'small', 
  showIcon = true,
  clinicalContext,
  department,
  urgency = 'normal',
  ...props 
}) => {
  const theme = useTheme();
  
  // Get clinical context for enhanced theming
  const context = clinicalContext || getClinicalContext(
    window.location.pathname,
    new Date().getHours(),
    department
  );
  
  // Enhanced clinical context with urgency
  const enhancedContext = {
    ...context,
    urgency
  };

  // Get status configuration
  const getStatusConfig = (status) => {
    const normalizedStatus = status?.toLowerCase();
    
    const statusConfigs = {
      active: {
        color: getStatusColor(theme, 'active', enhancedContext),
        icon: <ActiveIcon />,
        label: 'Active'
      },
      inactive: {
        color: getStatusColor(theme, 'inactive', enhancedContext),
        icon: <InactiveIcon />,
        label: 'Inactive'
      },
      pending: {
        color: getStatusColor(theme, 'pending', enhancedContext),
        icon: <PendingIcon />,
        label: 'Pending'
      },
      completed: {
        color: getStatusColor(theme, 'completed', enhancedContext),
        icon: <CompletedIcon />,
        label: 'Completed'
      },
      cancelled: {
        color: getStatusColor(theme, 'cancelled', enhancedContext),
        icon: <CancelledIcon />,
        label: 'Cancelled'
      },
      draft: {
        color: getStatusColor(theme, 'draft', enhancedContext),
        icon: <DraftIcon />,
        label: 'Draft'
      },
      'in-progress': {
        color: getStatusColor(theme, 'inProgress', enhancedContext),
        icon: <InProgressIcon />,
        label: 'In Progress'
      }
    };

    return statusConfigs[normalizedStatus] || {
      color: theme.palette.grey[500],
      icon: null,
      label: status || 'Unknown'
    };
  };

  const statusConfig = getStatusConfig(status);
  
  // Get clinical animation
  const hoverAnimation = getClinicalAnimation(theme, 'hover', enhancedContext);

  // Get chip color based on variant
  const getChipColor = () => {
    if (variant === 'clinical') {
      return 'default';
    }
    
    // Map clinical status to MUI chip colors
    const normalizedStatus = status?.toLowerCase();
    const colorMapping = {
      active: 'success',
      completed: 'info',
      pending: 'warning',
      cancelled: 'error',
      'in-progress': 'primary'
    };
    
    return colorMapping[normalizedStatus] || 'default';
  };

  const chipProps = {
    size,
    label: statusConfig.label,
    icon: showIcon ? statusConfig.icon : undefined,
    ...props
  };

  if (variant === 'clinical') {
    // Custom styling for clinical variant with dark mode support
    const isDarkMode = theme.palette.mode === 'dark';
    chipProps.sx = {
      backgroundColor: theme.palette.mode === 'dark' 
        ? `${statusConfig.color}30` 
        : `${statusConfig.color}20`,
      color: statusConfig.color,
      borderColor: theme.palette.mode === 'dark'
        ? `${statusConfig.color}50`
        : `${statusConfig.color}40`,
      border: 1,
      fontWeight: 500,
      '& .MuiChip-icon': {
        color: statusConfig.color
      },
      '& .MuiChip-deleteIcon': {
        color: statusConfig.color
      },
      transition: `all ${hoverAnimation.duration}ms ${hoverAnimation.easing}`,
      '&:hover': {
        backgroundColor: theme.palette.mode === 'dark'
          ? `${statusConfig.color}40`
          : `${statusConfig.color}30`,
        transform: hoverAnimation.transform,
        boxShadow: `0 2px 4px ${statusConfig.color}${isDarkMode ? '50' : '40'}`
      },
      // Add urgency indicator
      ...(urgency === 'urgent' && {
        animation: 'pulse 2s infinite',
        '@keyframes pulse': {
          '0%': { opacity: 1 },
          '50%': { opacity: 0.7 },
          '100%': { opacity: 1 }
        }
      }),
      // Add department-specific styling
      ...(enhancedContext.department !== 'general' && {
        borderColor: `${statusConfig.color}60`,
        borderWidth: 2
      }),
      ...props.sx
    };
  } else {
    // Use standard MUI chip colors
    chipProps.color = getChipColor();
  }

  return <Chip {...chipProps} />;
};

export default StatusChip;