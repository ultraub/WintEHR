/**
 * ClinicalAppBar Component
 * Unified app bar for clinical workspace with integrated navigation
 * Combines functionality from multiple app bars into single component
 */
import React, { useState, useContext } from 'react';
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
  Chip,
  Stack,
  useTheme,
  useMediaQuery,
  alpha,
  LinearProgress
} from '@mui/material';
import {
  Menu as MenuIcon,
  Notifications as NotificationsIcon,
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
  Settings as SettingsIcon,
  Person as PersonIcon,
  ExitToApp as LogoutIcon,
  Print as PrintIcon,
  Share as ShareIcon,
  Home as HomeIcon,
  LocalHospital as HospitalIcon,
  AccessTime as ClockIcon,
  Warning as AlertIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useClinicalWorkflow } from '../../../contexts/ClinicalWorkflowContext';

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
  
  // Get critical alerts count
  const criticalAlerts = patient?.alerts?.filter(a => a.severity === 'critical').length || 0;
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

  const handlePrint = () => {
    window.print();
  };

  const handleShare = () => {
    // Implementation for sharing patient data
    console.log('Share patient data');
  };

  const getShiftColor = () => {
    switch (shift) {
      case 'Day': return theme.palette.primary.main;
      case 'Evening': return theme.palette.warning.main;
      case 'Night': return theme.palette.info.main;
      default: return theme.palette.grey[500];
    }
  };

  return (
    <>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          backgroundColor: '#2979FF',  // Clean blue matching older design
          backgroundImage: 'none',
          borderBottom: 'none',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          zIndex: theme.zIndex.drawer + 1,
          height: 56
        }}
      >
        {loading && <LinearProgress sx={{ position: 'absolute', top: 0, width: '100%' }} />}
        
        <Toolbar sx={{ 
          px: { xs: 1, sm: 2 }, 
          minHeight: '56px !important',
          height: 56
        }}>
          {/* Left Section */}
          <Stack direction="row" spacing={1} alignItems="center" sx={{ flexGrow: 0 }}>
            {!isMobile && (
              <>
                <Typography
                  variant="h6"
                  component="div"
                  sx={{
                    fontWeight: 600,
                    color: '#FFFFFF',
                    mr: 2
                  }}
                >
                  WintEHR
                </Typography>
                
                <Divider orientation="vertical" flexItem sx={{ mx: 2, backgroundColor: 'rgba(255,255,255,0.3)' }} />
                
                <Chip
                  label={department}
                  size="small"
                  sx={{
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    color: '#FFFFFF',
                    fontWeight: 600,
                    borderRadius: '4px',
                    border: '1px solid rgba(255,255,255,0.3)'
                  }}
                />
                
                <Chip
                  label={shift}
                  size="small"
                  sx={{
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    color: '#FFFFFF',
                    fontWeight: 600,
                    borderRadius: '4px',
                    border: '1px solid rgba(255,255,255,0.3)'
                  }}
                />
              </>
            )}
          </Stack>

          {/* Center Section - Patient Info */}
          <Box sx={{ flexGrow: 1, mx: 2 }}>
            {patient && (
              <Stack
                direction="row"
                spacing={2}
                alignItems="center"
                justifyContent="center"
              >
                {criticalAlerts > 0 && (
                  <Chip
                    icon={<AlertIcon />}
                    label={`${criticalAlerts} Critical Alert${criticalAlerts > 1 ? 's' : ''}`}
                    color="error"
                    size="small"
                    sx={{ 
                      fontWeight: 600,
                      borderRadius: '4px',  // Professional medical UI
                      animation: 'pulse 2s infinite'  // Draw attention to critical alerts
                    }}
                  />
                )}
                
                {!isMobile && (
                  <>
                    <Typography variant="body1" sx={{ fontWeight: 600, color: '#FFFFFF' }}>
                      {patient.name?.[0]?.given?.join(' ')} {patient.name?.[0]?.family}
                    </Typography>
                    
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                      MRN: {patient.identifier?.[0]?.value} • {patient.age}y {patient.gender}
                    </Typography>
                  </>
                )}
              </Stack>
            )}
          </Box>

          {/* Right Section - Actions */}
          <Stack direction="row" spacing={1} alignItems="center">
            {/* Print */}
            {patient && (
              <Tooltip title="Print">
                <IconButton
                  onClick={handlePrint}
                  sx={{ 
                    display: { xs: 'none', sm: 'inline-flex' },
                    color: '#FFFFFF'
                  }}
                >
                  <PrintIcon />
                </IconButton>
              </Tooltip>
            )}

            {/* Share */}
            {patient && (
              <Tooltip title="Share">
                <IconButton
                  onClick={handleShare}
                  sx={{ 
                    display: { xs: 'none', sm: 'inline-flex' },
                    color: '#FFFFFF'
                  }}
                >
                  <ShareIcon />
                </IconButton>
              </Tooltip>
            )}

            {/* Notifications */}
            <Tooltip title="Notifications">
              <IconButton
                onClick={handleNotificationOpen}
                sx={{ color: '#FFFFFF' }}
              >
                <Badge badgeContent={unreadNotifications} color="error">
                  <NotificationsIcon />
                </Badge>
              </IconButton>
            </Tooltip>

            {/* Theme Toggle */}
            <Tooltip title={isDarkMode ? 'Light Mode' : 'Dark Mode'}>
              <IconButton
                onClick={onThemeToggle}
                sx={{ color: '#FFFFFF' }}
              >
                {isDarkMode ? <LightModeIcon /> : <DarkModeIcon />}
              </IconButton>
            </Tooltip>

            {/* User Menu */}
            <Tooltip title="Account">
              <IconButton
                onClick={handleUserMenuOpen}
                size="small"
                sx={{ ml: 1 }}
              >
                <Avatar
                  sx={{
                    width: 32,
                    height: 32,
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    border: '2px solid #FFFFFF',
                    color: '#FFFFFF'
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