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
  LinearProgress,
  Paper
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
import { format, differenceInYears } from 'date-fns';
import { useClinicalWorkflow } from '../../../contexts/ClinicalWorkflowContext';
import QuickThemeToggle from '../../theme/QuickThemeToggle';

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
  
  const calculateAge = (birthDate) => {
    if (!birthDate) return 'Unknown';
    try {
      return differenceInYears(new Date(), new Date(birthDate));
    } catch {
      return 'Unknown';
    }
  };

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
          bgcolor: 'background.paper',
          color: 'text.primary',
          boxShadow: theme.shadows[1],
          borderBottom: 1,
          borderColor: 'divider',
          zIndex: theme.zIndex.drawer + 1,
          height: 64
        }}
      >
        {loading && <LinearProgress sx={{ position: 'absolute', top: 0, width: '100%' }} />}
        
        <Toolbar sx={{ 
          px: { xs: 2, sm: 3 }, 
          minHeight: '64px !important',
          height: 64
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

          {/* Center Section - Patient Info */}
          <Box sx={{ flexGrow: 1, mx: 3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {patient && (
              <Paper
                elevation={0}
                sx={{
                  px: 3,
                  py: 1,
                  bgcolor: alpha(theme.palette.primary.main, 0.05),
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: 1,
                  maxWidth: 600,
                  width: '100%'
                }}
              >
                <Stack
                  direction="row"
                  spacing={2}
                  alignItems="center"
                  justifyContent="space-between"
                >
                  {/* Patient Identity */}
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Avatar
                      sx={{
                        width: 40,
                        height: 40,
                        bgcolor: 'primary.main',
                        fontSize: '1.1rem'
                      }}
                    >
                      {patient.name?.[0]?.given?.[0]?.[0]}{patient.name?.[0]?.family?.[0]}
                    </Avatar>
                    <Box>
                      <Typography variant="body1" sx={{ fontWeight: 600, color: 'text.primary' }}>
                        {patient.name?.[0]?.given?.join(' ')} {patient.name?.[0]?.family}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        MRN: {patient.identifier?.[0]?.value} • {patient.age || calculateAge(patient.birthDate)}y {patient.gender} • DOB: {format(new Date(patient.birthDate), 'MM/dd/yyyy')}
                      </Typography>
                    </Box>
                  </Stack>
                  
                  {/* Critical Info */}
                  <Stack direction="row" spacing={1} alignItems="center">
                    {criticalAlerts > 0 && (
                      <Chip
                        icon={<AlertIcon />}
                        label={`${criticalAlerts} Critical`}
                        color="error"
                        size="small"
                        sx={{ 
                          fontWeight: 600,
                          animation: 'pulse 2s infinite'
                        }}
                      />
                    )}
                    {patient.allergies?.length > 0 && (
                      <Chip
                        icon={<AlertIcon />}
                        label={`${patient.allergies.length} Allergies`}
                        color="warning"
                        size="small"
                        sx={{ fontWeight: 600 }}
                      />
                    )}
                  </Stack>
                </Stack>
              </Paper>
            )}
          </Box>

          {/* Right Section - Actions */}
          <Stack direction="row" spacing={1} alignItems="center">
            {/* Quick Actions for Patient */}
            {patient && !isMobile && (
              <>
                <Tooltip title="Print Patient Summary">
                  <IconButton
                    onClick={handlePrint}
                    color="inherit"
                  >
                    <PrintIcon />
                  </IconButton>
                </Tooltip>

                <Tooltip title="Share Patient Chart">
                  <IconButton
                    onClick={handleShare}
                    color="inherit"
                  >
                    <ShareIcon />
                  </IconButton>
                </Tooltip>
                
                <Divider orientation="vertical" flexItem sx={{ height: 32, mx: 1 }} />
              </>
            )}

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