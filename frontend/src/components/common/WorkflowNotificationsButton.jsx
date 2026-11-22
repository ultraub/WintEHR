/**
 * WorkflowNotificationsButton
 * The app-bar bell. Shows the notifications held by ClinicalWorkflowContext
 * (order events, critical results, etc.), so it works on every page, not
 * only inside a chart. Moved here from the chart's own app bar when the chart
 * joined the shared shell.
 */
import React, { useState } from 'react';
import {
  Badge, Box, Button, Divider, IconButton, ListItemText, Menu, MenuItem, Tooltip, Typography,
} from '@mui/material';
import { NotificationsNone as BellIcon } from '@mui/icons-material';
import { format, isValid } from 'date-fns';
import { useClinicalWorkflow } from '../../contexts/ClinicalWorkflowContext';

const formatTime = (timestamp) => {
  const date = new Date(timestamp);
  return isValid(date) ? format(date, 'h:mm a') : '';
};

const WorkflowNotificationsButton = () => {
  const [anchorEl, setAnchorEl] = useState(null);
  const { notifications = [], clearAllNotifications, markNotificationRead } = useClinicalWorkflow();
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <>
      <Tooltip title="Notifications">
        <IconButton
          color="inherit"
          onClick={(event) => setAnchorEl(event.currentTarget)}
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        >
          <Badge badgeContent={unread} color="error">
            <BellIcon />
          </Badge>
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        PaperProps={{ sx: { width: 360, maxHeight: 420 } }}
      >
        <Box sx={{ px: 2, py: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Notifications</Typography>
          {notifications.length > 0 && (
            <Button size="small" onClick={clearAllNotifications}>Clear all</Button>
          )}
        </Box>
        <Divider />
        {notifications.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">No notifications</Typography>
          </Box>
        ) : (
          <Box sx={{ maxHeight: 320, overflow: 'auto' }}>
            {notifications.map((notification, index) => (
              <MenuItem
                key={notification.id || index}
                onClick={() => markNotificationRead(notification.id)}
                sx={{ py: 1.25, whiteSpace: 'normal', backgroundColor: notification.read ? 'transparent' : 'action.hover' }}
              >
                <ListItemText
                  primary={notification.title || notification.message || 'Notification'}
                  secondary={[notification.title ? notification.message : null, formatTime(notification.timestamp)]
                    .filter(Boolean)
                    .join(' · ')}
                  primaryTypographyProps={{ variant: 'body2', fontWeight: notification.read ? 400 : 600 }}
                  secondaryTypographyProps={{ variant: 'caption' }}
                />
              </MenuItem>
            ))}
          </Box>
        )}
      </Menu>
    </>
  );
};

export default WorkflowNotificationsButton;
