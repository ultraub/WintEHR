/**
 * WebSocket Status Indicator Component
 * Shows real-time connection status with reconnection feedback
 */
import React from 'react';
import {
  Chip,
  CircularProgress,
  Tooltip,
  useTheme,
  alpha
} from '@mui/material';
import {
  WifiOff as DisconnectedIcon,
  Wifi as ConnectedIcon,
  Refresh as ReconnectingIcon
} from '@mui/icons-material';
import { useClinicalWorkflow } from '../../contexts/ClinicalWorkflowContext';

const WebSocketStatus = ({ size = 'small', showLabel = true }) => {
  const theme = useTheme();
  const { wsConnected, wsReconnecting } = useClinicalWorkflow();
  
  // Determine status
  const getStatus = () => {
    if (wsConnected) {
      return {
        icon: <ConnectedIcon fontSize={size} />,
        label: 'Connected',
        color: 'success',
        tooltip: 'Real-time updates active'
      };
    }
    
    if (wsReconnecting) {
      return {
        icon: <CircularProgress size={size === 'small' ? 16 : 20} thickness={4} />,
        label: 'Reconnecting',
        color: 'warning',
        tooltip: 'Attempting to reconnect...'
      };
    }
    
    return {
      icon: <DisconnectedIcon fontSize={size} />,
      label: 'Disconnected',
      color: 'error',
      tooltip: 'Real-time updates unavailable'
    };
  };
  
  const status = getStatus();
  
  return (
    <Tooltip title={status.tooltip} arrow>
      <Chip
        icon={status.icon}
        label={showLabel ? status.label : null}
        size={size}
        color={status.color}
        variant="outlined"
        sx={{
          borderWidth: 2,
          backgroundColor: alpha(theme.palette[status.color].main, 0.1),
          '& .MuiChip-icon': {
            color: theme.palette[status.color].main
          }
        }}
      />
    </Tooltip>
  );
};

export default WebSocketStatus;