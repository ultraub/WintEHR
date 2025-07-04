import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  IconButton,
  Button,
  Chip,
  CircularProgress,
  Alert,
  Divider,
  Stack,
  Tooltip,
  Avatar,
  Paper,
  Tabs,
  Tab,
  Badge
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  MarkEmailRead as MarkReadIcon,
  MarkEmailUnread as MarkUnreadIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  DoneAll as DoneAllIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as SuccessIcon,
  Person as PersonIcon,
  LocalHospital as PatientIcon
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import { useNotifications } from '../hooks/useNotifications';

const NotificationPage = () => {
  const {
    notifications,
    loading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    refetch
  } = useNotifications();

  const [tabValue, setTabValue] = useState(0);
  const [filteredNotifications, setFilteredNotifications] = useState([]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    // Filter notifications based on tab
    if (tabValue === 0) {
      // All notifications
      setFilteredNotifications(notifications);
    } else if (tabValue === 1) {
      // Unread only
      setFilteredNotifications(
        notifications.filter(n => 
          n.extension?.some(ext => 
            ext.url === 'http://medgenemr.com/fhir/StructureDefinition/notification-read' &&
            ext.valueBoolean === false
          )
        )
      );
    }
  }, [notifications, tabValue]);

  const getNotificationIcon = (category, priority) => {
    if (priority === 'urgent' || priority === 'stat') {
      return <ErrorIcon color="error" />;
    }
    
    switch (category) {
      case 'alert':
        return <WarningIcon color="warning" />;
      case 'notification':
        return <InfoIcon color="info" />;
      case 'reminder':
        return <NotificationsIcon color="primary" />;
      default:
        return <InfoIcon color="action" />;
    }
  };

  const getPriorityChip = (priority) => {
    const config = {
      stat: { label: 'STAT', color: 'error' },
      urgent: { label: 'Urgent', color: 'error' },
      asap: { label: 'ASAP', color: 'warning' },
      routine: { label: 'Routine', color: 'default' }
    };

    const { label, color } = config[priority] || config.routine;
    return <Chip label={label} size="small" color={color} />;
  };

  const getNotificationTitle = (notification) => {
    // Extract subject from note field
    return notification.note?.[0]?.text || 'Notification';
  };

  const getNotificationMessage = (notification) => {
    // Extract message from payload
    return notification.payload?.[0]?.contentString || '';
  };

  const isNotificationRead = (notification) => {
    return notification.extension?.some(ext => 
      ext.url === 'http://medgenemr.com/fhir/StructureDefinition/notification-read' &&
      ext.valueBoolean === true
    );
  };

  const handleMarkAsRead = async (notification) => {
    if (!isNotificationRead(notification)) {
      await markAsRead(notification.id);
    }
  };

  const handleMarkAllAsRead = async () => {
    const confirmed = window.confirm('Mark all notifications as read?');
    if (confirmed) {
      await markAllAsRead();
    }
  };

  const getRelativeTime = (dateString) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return 'Recently';
    }
  };

  if (loading && notifications.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  const unreadCount = notifications.filter(n => !isNotificationRead(n)).length;

  return (
    <Box>
      <Box mb={3} display="flex" justifyContent="space-between" alignItems="center">
        <Typography variant="h4" component="h1" color="primary">
          <NotificationsIcon sx={{ mr: 1, verticalAlign: 'bottom' }} />
          Notifications Center
        </Typography>
        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={refetch}
          >
            Refresh
          </Button>
          {unreadCount > 0 && (
            <Button
              variant="contained"
              startIcon={<DoneAllIcon />}
              onClick={handleMarkAllAsRead}
              color="primary"
            >
              Mark All Read ({unreadCount})
            </Button>
          )}
        </Stack>
      </Box>

      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={tabValue}
          onChange={(e, newValue) => setTabValue(newValue)}
          indicatorColor="primary"
          textColor="primary"
        >
          <Tab 
            label={
              <Badge badgeContent={notifications.length} color="default">
                All Notifications
              </Badge>
            } 
          />
          <Tab 
            label={
              <Badge badgeContent={unreadCount} color="error">
                Unread
              </Badge>
            } 
          />
        </Tabs>
      </Paper>

      {filteredNotifications.length === 0 ? (
        <Card>
          <CardContent>
            <Box textAlign="center" py={4}>
              <NotificationsIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                {tabValue === 0 ? 'No notifications' : 'No unread notifications'}
              </Typography>
              <Typography variant="body2" color="text.secondary" mt={1}>
                {tabValue === 0 
                  ? 'You\'re all caught up!' 
                  : 'All notifications have been read'}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      ) : (
        <List sx={{ bgcolor: 'background.paper' }}>
          {filteredNotifications.map((notification, index) => {
            const isRead = isNotificationRead(notification);
            const category = notification.category?.[0]?.coding?.[0]?.code || 'notification';
            const priority = notification.priority || 'routine';
            const title = getNotificationTitle(notification);
            const message = getNotificationMessage(notification);
            const sentTime = notification.sent;

            return (
              <React.Fragment key={notification.id || notification._id}>
                <ListItem
                  alignItems="flex-start"
                  sx={{
                    bgcolor: isRead ? 'transparent' : 'action.hover',
                    '&:hover': {
                      bgcolor: 'action.selected'
                    }
                  }}
                >
                  <ListItemIcon sx={{ mt: 1 }}>
                    {getNotificationIcon(category, priority)}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography
                          variant="subtitle1"
                          component="span"
                          fontWeight={isRead ? 'normal' : 'bold'}
                        >
                          {title}
                        </Typography>
                        {getPriorityChip(priority)}
                      </Box>
                    }
                    secondary={
                      <>
                        <Typography
                          component="span"
                          variant="body2"
                          color="text.primary"
                          sx={{ display: 'block', mt: 0.5 }}
                        >
                          {message}
                        </Typography>
                        <Typography
                          component="span"
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: 'block', mt: 1 }}
                        >
                          {getRelativeTime(sentTime)}
                          {notification.subject?.reference && (
                            <>
                              {' • '}
                              <Chip
                                icon={<PatientIcon />}
                                label="Patient"
                                size="small"
                                variant="outlined"
                                sx={{ height: 20 }}
                              />
                            </>
                          )}
                        </Typography>
                      </>
                    }
                  />
                  <ListItemSecondaryAction>
                    <Tooltip title={isRead ? "Mark as unread" : "Mark as read"}>
                      <IconButton
                        edge="end"
                        onClick={() => handleMarkAsRead(notification)}
                        disabled={isRead}
                      >
                        {isRead ? <MarkReadIcon /> : <MarkUnreadIcon color="primary" />}
                      </IconButton>
                    </Tooltip>
                  </ListItemSecondaryAction>
                </ListItem>
                {index < filteredNotifications.length - 1 && <Divider component="li" />}
              </React.Fragment>
            );
          })}
        </List>
      )}
    </Box>
  );
};

export default NotificationPage;