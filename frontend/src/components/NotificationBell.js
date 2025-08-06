import React, { useState } from 'react';
import {
  IconButton,
  Menu,
  MenuItem,
  Typography,
  Box,
  Divider,
  Button,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Chip
} from '@mui/material';
import SafeBadge from './common/SafeBadge';
import {
  Notifications as NotificationsIcon,
  NotificationsNone as NotificationsNoneIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as SuccessIcon,
  MarkEmailRead as MarkReadIcon
} from '@mui/icons-material';
import { useNotifications } from '../hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';

const NotificationBell = () => {
  const [anchorEl, setAnchorEl] = useState(null);
  const { count, notifications, loading, fetchNotifications, markAsRead, markAllAsRead } = useNotifications();
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  const handleClick = async (event) => {
    setAnchorEl(event.currentTarget);
    
    // Fetch notifications when menu opens
    if (!notifications.length && !loadingNotifications) {
      setLoadingNotifications(true);
      await fetchNotifications();
      setLoadingNotifications(false);
    }
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleMarkAsRead = async (notificationId, event) => {
    event.stopPropagation();
    await markAsRead(notificationId);
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
  };

  const getNotificationIcon = (category) => {
    switch (category) {
      case 'alert':
        return <ErrorIcon color="error" />;
      case 'warning':
        return <WarningIcon color="warning" />;
      case 'success':
        return <SuccessIcon color="success" />;
      default:
        return <InfoIcon color="info" />;
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent':
        return 'error';
      case 'asap':
        return 'warning';
      case 'routine':
      default:
        return 'default';
    }
  };

  const formatNotificationTime = (sent) => {
    if (!sent) return '';
    try {
      return formatDistanceToNow(new Date(sent), { addSuffix: true });
    } catch {
      return '';
    }
  };

  const renderNotification = (notification) => {
    const isRead = notification._isRead || false;
    const category = notification.category?.[0]?.coding?.[0]?.code || 'notification';
    const priority = notification.priority || 'routine';
    const message = notification.payload?.[0]?.contentString || 'No message';
    const sent = notification.sent;

    return (
      <ListItem
        key={notification.id}
        alignItems="flex-start"
        sx={{
          bgcolor: isRead ? 'transparent' : 'action.hover',
          cursor: 'pointer',
          '&:hover': {
            bgcolor: 'action.selected'
          }
        }}
        onClick={(e) => {
          if (!isRead) {
            handleMarkAsRead(notification.id, e);
          }
          // TODO: Navigate to relevant resource
          handleClose();
        }}
      >
        <ListItemAvatar>
          <Avatar sx={{ bgcolor: 'transparent' }}>
            {getNotificationIcon(category)}
          </Avatar>
        </ListItemAvatar>
        <ListItemText
          primary={
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="body2" sx={{ fontWeight: isRead ? 'normal' : 'bold' }}>
                {message}
              </Typography>
              {priority !== 'routine' && (
                <Chip
                  label={priority}
                  size="small"
                  color={getPriorityColor(priority)}
                  sx={{ height: 20 }}
                />
              )}
            </Box>
          }
          secondary={
            <Typography variant="caption" color="text.secondary">
              {formatNotificationTime(sent)}
            </Typography>
          }
        />
        {!isRead && (
          <IconButton
            edge="end"
            size="small"
            onClick={(e) => handleMarkAsRead(notification.id, e)}
            sx={{ ml: 1 }}
          >
            <MarkReadIcon fontSize="small" />
          </IconButton>
        )}
      </ListItem>
    );
  };

  return (
    <>
      <IconButton
        color="inherit"
        onClick={handleClick}
        aria-label={`${count} notifications`}
      >
        <SafeBadge badgeContent={count} color="error">
          {count > 0 ? <NotificationsIcon /> : <NotificationsNoneIcon />}
        </SafeBadge>
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        PaperProps={{
          sx: {
            width: 400,
            maxHeight: 500
          }
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Notifications</Typography>
          {count > 0 && (
            <Button size="small" onClick={handleMarkAllAsRead}>
              Mark all as read
            </Button>
          )}
        </Box>
        
        <Divider />
        
        {loadingNotifications ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress size={24} />
          </Box>
        ) : notifications.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <NotificationsNoneIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
            <Typography color="text.secondary">
              No notifications
            </Typography>
          </Box>
        ) : (
          <List sx={{ p: 0, maxHeight: 400, overflow: 'auto' }}>
            {notifications.map(renderNotification)}
          </List>
        )}
        
        <Divider />
        
        <Box sx={{ p: 1 }}>
          <Button fullWidth size="small" onClick={handleClose}>
            View All Notifications
          </Button>
        </Box>
      </Menu>
    </>
  );
};

export default NotificationBell;