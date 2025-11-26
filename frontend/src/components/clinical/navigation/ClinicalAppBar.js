/**
 * ClinicalAppBar Component
 * Unified app bar for clinical workspace with integrated navigation
 * Combines functionality from multiple app bars into single component
 */
import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Box,
  Badge,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Button,
  Stack,
  useTheme,
  useMediaQuery,
  alpha,
  LinearProgress
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  Settings as SettingsIcon,
  Person as PersonIcon,
  ExitToApp as LogoutIcon,
  Home as HomeIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useClinicalWorkflow } from '../../../contexts/ClinicalWorkflowContext';
import QuickThemeToggle from '../../theme/QuickThemeToggle';
import WebSocketStatus from '../../common/WebSocketStatus';
import { LAYOUT_HEIGHTS, Z_INDEX } from '../theme/clinicalThemeConstants';

const ClinicalAppBar = ({
  onMenuToggle,
  onThemeToggle,
  isDarkMode,
  patient,
  loading = false,
  user,
  department = 'Emergency',
  shift = 'Day'
}) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [anchorEl, setAnchorEl] = useState(null);
  const [notificationAnchor, setNotificationAnchor] = useState(null);
  const { notifications, clearNotifications } = useClinicalWorkflow();

  const unreadNotifications = notifications.filter(n => !n.read).length;

  const handleUserMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setAnchorEl(null);
  };

  const handleNotificationOpen = (event) => {
    setNotificationAnchor(event.currentTarget);
  };

  const handleNotificationClose = () => {
    setNotificationAnchor(null);
  };

  const handleLogout = () => {
    handleUserMenuClose();
    navigate('/login');
  };

  return (
    <>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          bgcolor: 'background.paper',
          color: 'text.primary',
          boxShadow: theme.shadows[1],
          borderBottom: 1,
          borderColor: 'divider',
          zIndex: Z_INDEX.appBar,
          height: LAYOUT_HEIGHTS.appBar
        }}
      >
        {loading && <LinearProgress sx={{ position: 'absolute', top: 0, width: '100%' }} />}
        
        <Toolbar sx={{ 
          px: { xs: 2, sm: 3 }, 
          minHeight: `${LAYOUT_HEIGHTS.appBar}px !important`,
          height: LAYOUT_HEIGHTS.appBar
        }}>
          {/* Left Section - Brand and Navigation */}
          <Stack direction="row" spacing={2} alignItems="center" sx={{ flexGrow: 0 }}>
            {/* Back to Dashboard Button */}
            <Tooltip title="Back to Dashboard">
              <IconButton
                onClick={() => navigate('/dashboard')}
                sx={{ 
                  color: 'text.primary',
                  '&:hover': {
                    bgcolor: 'action.hover'
                  }
                }}
              >
                <HomeIcon />
              </IconButton>
            </Tooltip>
            
            <Divider orientation="vertical" flexItem sx={{ height: 32 }} />
            
            {/* App Title and Context */}
            <Box>
              <Typography
                variant="h6"
                component="div"
                sx={{
                  fontWeight: 700,
                  color: 'primary.main',
                  lineHeight: 1.2
                }}
              >
                Clinical Workspace
              </Typography>
              {!isMobile && (
                <Typography variant="caption" color="text.secondary">
                  {department} • {shift} Shift • {format(new Date(), 'MMM d, yyyy')}
                </Typography>
              )}
            </Box>
          </Stack>

          {/* Spacer - simplified without patient info */}
          <Box sx={{ flexGrow: 1 }} />

          {/* Right Section - Actions */}
          <Stack direction="row" spacing={1} alignItems="center">
            {/* WebSocket Status */}
            <WebSocketStatus 
              size="small" 
              showLabel={!isMobile}
            />
            
            <Divider orientation="vertical" flexItem sx={{ height: 24, mx: 1 }} />
            
            {/* Theme Toggle */}
            <QuickThemeToggle 
              showLabel={false}
              size="medium"
              position="header"
            />

            {/* Notifications */}
            <Tooltip title="Notifications">
              <IconButton
                onClick={handleNotificationOpen}
                color="inherit"
              >
                <Badge badgeContent={unreadNotifications} color="error">
                  <NotificationsIcon />
                </Badge>
              </IconButton>
            </Tooltip>

            {/* User Menu */}
            <Tooltip title="Account">
              <IconButton
                onClick={handleUserMenuOpen}
                color="inherit"
              >
                <Avatar
                  sx={{
                    width: 32,
                    height: 32,
                    bgcolor: 'primary.main'
                  }}
                >
                  {user?.name?.[0] || 'U'}
                </Avatar>
              </IconButton>
            </Tooltip>
          </Stack>
        </Toolbar>

        {/* Clinical Context Bar removed to save vertical space - information moved to header */}
      </AppBar>

      {/* User Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleUserMenuClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="subtitle2">{user?.name || 'User'}</Typography>
          <Typography variant="caption" color="text.secondary">
            {user?.email || user?.role || 'Healthcare Provider'}
          </Typography>
        </Box>
        <Divider sx={{ my: 1 }} />
        <MenuItem onClick={handleUserMenuClose}>
          <ListItemIcon>
            <PersonIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Profile</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleUserMenuClose}>
          <ListItemIcon>
            <SettingsIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Settings</ListItemText>
        </MenuItem>
        <Divider sx={{ my: 1 }} />
        <MenuItem onClick={() => navigate('/')}>
          <ListItemIcon>
            <HomeIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Dashboard</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleLogout}>
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Logout</ListItemText>
        </MenuItem>
      </Menu>

      {/* Notifications Menu */}
      <Menu
        anchorEl={notificationAnchor}
        open={Boolean(notificationAnchor)}
        onClose={handleNotificationClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        PaperProps={{
          sx: { width: 360, maxHeight: 400 }
        }}
      >
        <Box sx={{ px: 2, py: 1.5, display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="subtitle1" fontWeight={600}>
            Notifications
          </Typography>
          {unreadNotifications > 0 && (
            <Button size="small" onClick={clearNotifications}>
              Clear All
            </Button>
          )}
        </Box>
        <Divider />
        {notifications.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No new notifications
            </Typography>
          </Box>
        ) : (
          <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
            {notifications.map((notification, index) => (
              <MenuItem
                key={notification.id || index}
                sx={{
                  py: 1.5,
                  backgroundColor: notification.read ? 'transparent' : alpha(theme.palette.primary.main, 0.05)
                }}
              >
                <ListItemText
                  primary={notification.title}
                  secondary={
                    <>
                      <Typography variant="caption" component="div">
                        {notification.message}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {format(new Date(notification.timestamp), 'h:mm a')}
                      </Typography>
                    </>
                  }
                />
              </MenuItem>
            ))}
          </Box>
        )}
      </Menu>
    </>
  );
};

export default ClinicalAppBar;