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

const StatusChip = ({ 
  status, 
  variant = 'clinical', 
  size = 'small', 
  showIcon = true,
  ...props 
}) => {
  const theme = useTheme();

  // Get status configuration
  const getStatusConfig = (status) => {
    const normalizedStatus = status?.toLowerCase();
    
    const statusConfigs = {
      active: {
        color: theme.clinical?.status?.active || theme.palette.success.main,
        icon: <ActiveIcon />,
        label: 'Active'
      },
      inactive: {
        color: theme.clinical?.status?.inactive || theme.palette.grey[500],
        icon: <InactiveIcon />,
        label: 'Inactive'
      },
      pending: {
        color: theme.clinical?.status?.pending || theme.palette.warning.main,
        icon: <PendingIcon />,
        label: 'Pending'
      },
      completed: {
        color: theme.clinical?.status?.completed || theme.palette.info.main,
        icon: <CompletedIcon />,
        label: 'Completed'
      },
      cancelled: {
        color: theme.clinical?.status?.cancelled || theme.palette.error.main,
        icon: <CancelledIcon />,
        label: 'Cancelled'
      },
      draft: {
        color: theme.clinical?.status?.draft || theme.palette.grey[600],
        icon: <DraftIcon />,
        label: 'Draft'
      },
      'in-progress': {
        color: theme.clinical?.status?.inProgress || theme.palette.primary.main,
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
    // Custom styling for clinical variant
    chipProps.sx = {
      backgroundColor: `${statusConfig.color}20`,
      color: statusConfig.color,
      borderColor: `${statusConfig.color}40`,
      border: 1,
      fontWeight: 500,
      '& .MuiChip-icon': {
        color: statusConfig.color
      },
      '& .MuiChip-deleteIcon': {
        color: statusConfig.color
      },
      transition: theme.animations?.duration?.short ? 
        `all ${theme.animations.duration.short}ms ${theme.animations.easing.easeInOut}` : 
        'all 0.25s ease-in-out',
      '&:hover': {
        backgroundColor: `${statusConfig.color}30`,
        transform: 'translateY(-1px)',
        boxShadow: `0 2px 4px ${statusConfig.color}40`
      },
      ...props.sx
    };
  } else {
    // Use standard MUI chip colors
    chipProps.color = getChipColor();
  }

  return <Chip {...chipProps} />;
};

export default StatusChip;