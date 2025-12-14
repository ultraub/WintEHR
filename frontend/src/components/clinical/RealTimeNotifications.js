/**
 * Real-time notifications component for clinical updates
 */

import React, { useState } from 'react';
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
import { formatDistanceToNow } from 'date-fns';

const RealTimeNotifications = () => {
  useClinical(); // Context hook for future integration
  const [anchorEl, setAnchorEl] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Critical events would need to be handled by polling or parent component

  // Updates would need to be handled by polling or parent component

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
            </Typography>
          </Box>

          <Alert severity="info" sx={{ m: 2 }}>
            Refresh to check for new notifications.
          </Alert>

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