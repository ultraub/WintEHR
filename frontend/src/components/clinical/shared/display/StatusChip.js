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
} from '../../../../themes/clinicalThemeUtils';

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
    // Clean solid color styling using theme palette
    const solidColorMap = {
      active: theme.palette.success.main,
      completed: theme.palette.primary.main,
      pending: theme.palette.warning.main,
      cancelled: theme.palette.error.main,
      'in-progress': theme.palette.primary.dark,
      draft: theme.palette.grey[500],
      inactive: theme.palette.grey[600]
    };
    
    const backgroundColor = solidColorMap[status?.toLowerCase()] || theme.palette.grey[500];
    
    chipProps.sx = {
      backgroundColor: backgroundColor,
      color: theme.palette.common.white,
      border: 'none',
      fontWeight: 500,
      fontSize: size === 'small' ? '0.75rem' : '0.875rem',
      height: size === 'small' ? '24px' : '32px',
      '& .MuiChip-icon': {
        color: theme.palette.common.white,
        fontSize: size === 'small' ? '16px' : '20px'
      },
      '& .MuiChip-deleteIcon': {
        color: theme.palette.common.white
      },
      transition: `all ${hoverAnimation.duration}ms ${hoverAnimation.easing}`,
      '&:hover': {
        backgroundColor: backgroundColor,
        filter: 'brightness(0.9)'
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
      ...props.sx
    };
  } else {
    // Use standard MUI chip colors
    chipProps.color = getChipColor();
  }

  return <Chip {...chipProps} />;
};

export default React.memo(StatusChip);