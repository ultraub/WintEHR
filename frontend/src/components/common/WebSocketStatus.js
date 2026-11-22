/**
 * WebSocket Status Indicator Component
 * Shows real-time connection status with reconnection feedback
 */
import React, { useEffect, useState } from 'react';
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
import websocketService from '../../services/websocket';

const WebSocketStatus = ({ size = 'small', showLabel = true }) => {
  const theme = useTheme();
  const { wsConnected, wsReconnecting } = useClinicalWorkflow();
  const { isConfigured } = websocketService.getConnectionState();
  // Red is reserved for a connection that was live in this session and then
  // dropped. Never having connected (no real-time service on this deployment)
  // is a neutral state, not an alarm that sits in the header all day.
  const [everConnected, setEverConnected] = useState(false);
  useEffect(() => {
    if (wsConnected) setEverConnected(true);
  }, [wsConnected]);

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

    if (!isConfigured) {
      return {
        icon: <DisconnectedIcon fontSize={size} />,
        label: 'Not Configured',
        color: 'default',
        tooltip: 'WebSocket URL not configured'
      };
    }

    if (!everConnected) {
      return {
        icon: <DisconnectedIcon fontSize={size} />,
        label: 'Live updates off',
        color: 'default',
        tooltip: 'Real-time updates are unavailable. Refresh to see changes made elsewhere.'
      };
    }

    return {
      icon: <DisconnectedIcon fontSize={size} />,
      label: 'Disconnected',
      color: 'error',
      tooltip: 'Real-time connection lost. Refresh to see changes made elsewhere.'
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
          borderWidth: 1,
          backgroundColor: alpha(
            (theme.palette[status.color]?.main || theme.palette.grey[500]),
            0.1
          ),
          '& .MuiChip-icon': {
            color: theme.palette[status.color]?.main || theme.palette.grey[500]
          }
        }}
      />
    </Tooltip>
  );
};

export default WebSocketStatus;