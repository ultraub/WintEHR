/**
 * Real-time order status component
 * Shows live updates for order status changes
 */

import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Chip,
  LinearProgress,
  Fade
} from '@mui/material';
import {
  CheckCircle as CompletedIcon,
  Schedule as PendingIcon,
  PlayArrow as ActiveIcon,
  Cancel as CancelledIcon
} from '@mui/icons-material';
import { useWebSocket } from '../../../hooks/useWebSocket';

const RealTimeOrderStatus = ({ orderId, initialStatus }) => {
  const [status, setStatus] = useState(initialStatus);
  const [isUpdating, setIsUpdating] = useState(false);

  // Subscribe to ServiceRequest updates
  const { lastUpdate } = useWebSocket({
    resourceTypes: ['ServiceRequest'],
    enabled: !!orderId
  });

  useEffect(() => {
    if (
      lastUpdate &&
      lastUpdate.resourceType === 'ServiceRequest' &&
      lastUpdate.resourceId === orderId
    ) {
      setIsUpdating(true);
      
      // Update status from the resource
      const newStatus = lastUpdate.resource?.status;
      if (newStatus) {
        setTimeout(() => {
          setStatus(newStatus);
          setIsUpdating(false);
        }, 500); // Small delay for visual feedback
      }
    }
  }, [lastUpdate, orderId]);

  const getStatusIcon = () => {
    switch (status) {
      case 'completed':
        return <CompletedIcon fontSize="small" />;
      case 'active':
      case 'in-progress':
        return <ActiveIcon fontSize="small" />;
      case 'cancelled':
      case 'revoked':
        return <CancelledIcon fontSize="small" />;
      default:
        return <PendingIcon fontSize="small" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'active':
      case 'in-progress':
        return 'primary';
      case 'cancelled':
      case 'revoked':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Box sx={{ position: 'relative' }}>
      <Fade in={isUpdating}>
        <LinearProgress
          sx={{
            position: 'absolute',
            top: -4,
            left: 0,
            right: 0,
            height: 2
          }}
        />
      </Fade>
      
      <Chip
        icon={getStatusIcon()}
        label={status}
        color={getStatusColor()}
        size="small"
        sx={{
          transition: 'all 0.3s ease',
          ...(isUpdating && {
            animation: 'pulse 1s ease-in-out'
          })
        }}
      />
      
      <style>
        {`
          @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
          }
        `}
      </style>
    </Box>
  );
};

export default RealTimeOrderStatus;