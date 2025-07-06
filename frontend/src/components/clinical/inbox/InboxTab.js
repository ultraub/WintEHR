/**
 * Inbox Tab Component
 * Clinical notifications and alerts management
 */
import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemButton,
  Button,
  IconButton,
  Chip,
  Alert,
  Badge,
  Card,
  CardContent,
  Divider,
  Menu,
  MenuItem
} from '@mui/material';
import {
  Inbox as InboxIcon,
  Email as EmailIcon,
  NotificationsActive as AlertIcon,
  Assignment as TaskIcon,
  MoreVert as MoreIcon,
  MarkEmailRead as MarkReadIcon,
  Delete as DeleteIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import { useInbox } from '../../../contexts/InboxContext';
import { useClinical } from '../../../contexts/ClinicalContext';

const InboxTab = () => {
  const { messages: inboxItems, stats: inboxStats, loadInboxItems, loadInboxStats, markInboxItemRead } = useInbox();
  const { currentPatient } = useClinical();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    if (currentPatient?.id) {
      loadInboxItems({ patient_id: currentPatient.id });
      loadInboxStats();
    }
  }, [currentPatient?.id, loadInboxItems, loadInboxStats]);

  const handleMarkAsRead = async (itemId) => {
    try {
      await markInboxItemRead(itemId);
    } catch (error) {
      console.error('Error marking item as read:', error);
    }
  };

  const handleDeleteItem = async (itemId) => {
    try {
      // For now, just mark as completed since FHIR doesn't support delete
      await markInboxItemRead(itemId);
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  const getItemIcon = (category, priority) => {
    if (priority === 'urgent') {
      return <ErrorIcon color="error" />;
    }
    
    switch (category) {
      case 'alert':
        return <AlertIcon color="warning" />;
      case 'task':
        return <TaskIcon color="primary" />;
      case 'notification':
        return <InfoIcon color="info" />;
      default:
        return <EmailIcon />;
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent':
        return 'error';
      case 'high':
        return 'warning';
      case 'medium':
        return 'info';
      case 'low':
        return 'default';
      default:
        return 'default';
    }
  };

  const filteredItems = inboxItems?.filter(item => 
    selectedCategory === 'all' || item.category === selectedCategory
  ) || [];

  const handleMenuClick = (event, item) => {
    setAnchorEl(event.currentTarget);
    setSelectedItem(item);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedItem(null);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Clinical Inbox
      </Typography>

      <Grid container spacing={3}>
        {/* Inbox Stats */}
        <Grid item xs={12}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="primary">
                    {inboxStats?.total || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Items
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="error">
                    {inboxStats?.unread || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Unread
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="warning">
                    {(inboxStats?.priority?.urgent || 0) + (inboxStats?.priority?.stat || 0)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Urgent/Stat
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="info">
                    {inboxStats?.category?.alert || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Alerts
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Grid>

        {/* Category Filter */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip
                label="All"
                variant={selectedCategory === 'all' ? 'filled' : 'outlined'}
                onClick={() => setSelectedCategory('all')}
                color="primary"
              />
              <Chip
                label="Alerts"
                variant={selectedCategory === 'alert' ? 'filled' : 'outlined'}
                onClick={() => setSelectedCategory('alert')}
                color="warning"
              />
              <Chip
                label="Tasks"
                variant={selectedCategory === 'task' ? 'filled' : 'outlined'}
                onClick={() => setSelectedCategory('task')}
                color="info"
              />
              <Chip
                label="Notifications"
                variant={selectedCategory === 'notification' ? 'filled' : 'outlined'}
                onClick={() => setSelectedCategory('notification')}
                color="default"
              />
            </Box>
          </Paper>
        </Grid>

        {/* Inbox Items */}
        <Grid item xs={12}>
          <Paper>
            {filteredItems.length > 0 ? (
              <List>
                {filteredItems.map((item, index) => (
                  <React.Fragment key={item.id || index}>
                    <ListItem
                      sx={{
                        bgcolor: !item.isRead ? 'action.hover' : 'transparent',
                        borderLeft: item.priority === 'urgent' || item.priority === 'stat' ? '4px solid red' : 'none'
                      }}
                    >
                      <ListItemIcon>
                        {getItemIcon(item.category, item.priority)}
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography 
                              variant="subtitle1" 
                              sx={{ 
                                fontWeight: !item.isRead ? 'bold' : 'normal' 
                              }}
                            >
                              {item.topic || 'Clinical Message'}
                            </Typography>
                            <Chip 
                              label={item.priority} 
                              size="small" 
                              color={getPriorityColor(item.priority)}
                            />
                            {item.category === 'alert' && (
                              <Chip label="Action Required" size="small" color="error" />
                            )}
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              {item.payload?.[0]?.content || item.note || 'No message content'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {item.sent ? new Date(item.sent).toLocaleString() : 'Unknown time'}
                            </Typography>
                          </Box>
                        }
                      />
                      <IconButton 
                        onClick={(e) => handleMenuClick(e, item)}
                        size="small"
                      >
                        <MoreIcon />
                      </IconButton>
                    </ListItem>
                    {index < filteredItems.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            ) : (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <InboxIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No items in {selectedCategory === 'all' ? 'inbox' : selectedCategory}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedCategory === 'all' 
                    ? 'Your clinical inbox is empty.'
                    : `No ${selectedCategory} items found.`
                  }
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => {
          handleMarkAsRead(selectedItem?.id);
          handleMenuClose();
        }}>
          <MarkReadIcon sx={{ mr: 1 }} />
          Mark as Read
        </MenuItem>
        <MenuItem onClick={() => {
          handleDeleteItem(selectedItem?.id);
          handleMenuClose();
        }}>
          <DeleteIcon sx={{ mr: 1 }} />
          Delete
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default InboxTab;