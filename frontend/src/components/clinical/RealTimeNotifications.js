/**
 * Real-time notifications component for clinical updates
 */

import React, { useState, useEffect } from 'react';
import {
  IconButton,
  Popover,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Typography,
  Box,
  Chip,
  Divider,
  Alert
} from '@mui/material';
import SafeBadge from '../common/SafeBadge';
import {
  Notifications as NotificationsIcon,
  Science as LabIcon,
  MedicalServices as MedicalIcon,
  Assignment as OrderIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon
} from '@mui/icons-material';
import { useClinical } from '../../contexts/ClinicalContext';
import { useClinicalEvents } from '../../hooks/useWebSocket';
import { formatDistanceToNow } from 'date-fns';

const RealTimeNotifications = () => {
  const { wsConnected, realTimeUpdates } = useClinical();
  const [anchorEl, setAnchorEl] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Subscribe to critical clinical events
  useClinicalEvents('critical_result', (event) => {
    const notification = {
      id: Date.now(),
      type: 'critical',
      title: 'Critical Result',
      message: event.details.message || 'New critical result available',
      resourceType: event.resourceType,
      patientId: event.patientId,
      timestamp: new Date(),
      read: false,
      priority: 'high'
    };
    
    setNotifications(prev => [notification, ...prev].slice(0, 50));
    setUnreadCount(prev => prev + 1);
  });

  // Process real-time updates into notifications
  useEffect(() => {
    if (realTimeUpdates.length > 0) {
      const latestUpdate = realTimeUpdates[realTimeUpdates.length - 1];
      
      // Create notification based on update type
      let notification = null;
      
      switch (latestUpdate.resourceType) {
        case 'Observation':
          if (latestUpdate.resource?.category?.[0]?.coding?.[0]?.code === 'laboratory') {
            notification = {
              id: Date.now(),
              type: 'lab',
              title: 'New Lab Result',
              message: `${latestUpdate.resource.code?.text || 'Lab result'} available`,
              resourceType: 'Observation',
              resourceId: latestUpdate.resourceId,
              patientId: latestUpdate.patientId,
              timestamp: latestUpdate.timestamp,
              read: false,
              priority: 'normal'
            };
          }
          break;
          
        case 'DiagnosticReport':
          notification = {
            id: Date.now(),
            type: 'report',
            title: 'New Diagnostic Report',
            message: `${latestUpdate.resource.code?.text || 'Diagnostic report'} ready`,
            resourceType: 'DiagnosticReport',
            resourceId: latestUpdate.resourceId,
            patientId: latestUpdate.patientId,
            timestamp: latestUpdate.timestamp,
            read: false,
            priority: 'normal'
          };
          break;
          
        case 'ServiceRequest':
          notification = {
            id: Date.now(),
            type: 'order',
            title: latestUpdate.action === 'created' ? 'New Order' : 'Order Updated',
            message: `${latestUpdate.resource.code?.text || 'Order'} ${latestUpdate.action}`,
            resourceType: 'ServiceRequest',
            resourceId: latestUpdate.resourceId,
            patientId: latestUpdate.patientId,
            timestamp: latestUpdate.timestamp,
            read: false,
            priority: 'normal'
          };
          break;
      }
      
      if (notification) {
        setNotifications(prev => [notification, ...prev].slice(0, 50));
        setUnreadCount(prev => prev + 1);
      }
    }
  }, [realTimeUpdates]);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
    // Mark all as read
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const getIcon = (type) => {
    switch (type) {
      case 'lab':
        return <LabIcon color="primary" />;
      case 'report':
        return <MedicalIcon color="primary" />;
      case 'order':
        return <OrderIcon color="primary" />;
      case 'critical':
        return <WarningIcon color="error" />;
      default:
        return <CheckIcon color="success" />;
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high':
        return 'error';
      case 'normal':
        return 'primary';
      default:
        return 'default';
    }
  };

  const open = Boolean(anchorEl);

  return (
    <>
      <IconButton
        color="inherit"
        onClick={handleClick}
        sx={{ position: 'relative' }}
      >
        <SafeBadge badgeContent={unreadCount} color="error">
          <NotificationsIcon />
        </SafeBadge>
        {wsConnected && (
          <Box
            sx={{
              position: 'absolute',
              bottom: 4,
              right: 4,
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: 'success.main',
              border: '2px solid white'
            }}
          />
        )}
      </IconButton>

      <Popover
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
      >
        <Box sx={{ width: 400, maxHeight: 600 }}>
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="h6" component="div">
              Notifications
              {wsConnected && (
                <Chip
                  label="Live"
                  size="small"
                  color="success"
                  sx={{ ml: 2 }}
                />
              )}
            </Typography>
          </Box>

          {!wsConnected && (
            <Alert severity="warning" sx={{ m: 2 }}>
              Real-time updates disconnected
            </Alert>
          )}

          <List sx={{ maxHeight: 500, overflow: 'auto' }}>
            {notifications.length === 0 ? (
              <ListItem>
                <ListItemText
                  primary="No notifications"
                  secondary="Real-time updates will appear here"
                />
              </ListItem>
            ) : (
              notifications.map((notification, index) => (
                <React.Fragment key={notification.id}>
                  {index > 0 && <Divider />}
                  <ListItem
                    sx={{
                      backgroundColor: notification.read ? 'transparent' : 'action.hover'
                    }}
                  >
                    <ListItemIcon>
                      {getIcon(notification.type)}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="subtitle2">
                            {notification.title}
                          </Typography>
                          <Chip
                            label={notification.priority}
                            size="small"
                            color={getPriorityColor(notification.priority)}
                            sx={{ height: 20 }}
                          />
                        </Box>
                      }
                      secondary={
                        <>
                          <Typography
                            component="span"
                            variant="body2"
                            color="text.primary"
                          >
                            {notification.message}
                          </Typography>
                          <br />
                          <Typography
                            component="span"
                            variant="caption"
                            color="text.secondary"
                          >
                            {formatDistanceToNow(notification.timestamp, { addSuffix: true })}
                          </Typography>
                        </>
                      }
                    />
                  </ListItem>
                </React.Fragment>
              ))
            )}
          </List>
        </Box>
      </Popover>
    </>
  );
};

export default RealTimeNotifications;