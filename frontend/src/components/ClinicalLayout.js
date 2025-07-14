/**
 * ClinicalLayout Component
 * Minimal layout for clinical workspace with maximum screen real estate
 */
import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AppBar,
  Box,
  IconButton,
  Toolbar,
  Typography,
  useTheme,
  Menu,
  MenuItem,
  Avatar,
  Stack,
  Tooltip,
  ListItemIcon,
  Divider,
  alpha
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  AccountCircle as AccountCircleIcon,
  Logout as LogoutIcon,
  Settings as SettingsIcon,
  Help as HelpIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { MedicalThemeContext } from '../App';
import NotificationBell from './NotificationBell';
import ThemeSwitcher from './theme/ThemeSwitcher';

function ClinicalLayout({ children }) {
  const theme = useTheme();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [anchorEl, setAnchorEl] = useState(null);
  const medicalThemeContext = useContext(MedicalThemeContext);

  const handleProfileMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    await logout();
    handleProfileMenuClose();
    navigate('/login');
  };

  const handleBack = () => {
    navigate('/patients');
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Minimal App Bar */}
      <AppBar 
        position="static" 
        elevation={0}
        sx={{
          bgcolor: theme.palette.mode === 'dark' ? 'background.paper' : 'primary.main',
          color: theme.palette.mode === 'dark' ? 'text.primary' : 'primary.contrastText',
          borderBottom: 1,
          borderColor: 'divider',
          height: 48
        }}
      >
        <Toolbar variant="dense" sx={{ minHeight: 48, px: 1 }}>
          {/* Back Button */}
          <Tooltip title="Back to Patient List">
            <IconButton 
              color="inherit" 
              onClick={handleBack}
              size="small"
              sx={{ mr: 1 }}
            >
              <BackIcon />
            </IconButton>
          </Tooltip>

          {/* App Name */}
          <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600 }}>
            WintEHR
          </Typography>
          
          <Box sx={{ flexGrow: 1 }} />
          
          {/* Toolbar Actions */}
          <Stack direction="row" spacing={0.5} alignItems="center">
            <ThemeSwitcher 
              currentTheme={medicalThemeContext?.currentTheme}
              currentMode={medicalThemeContext?.currentMode}
              onThemeChange={medicalThemeContext?.onThemeChange}
              onModeChange={medicalThemeContext?.onModeChange}
              compact
            />
            
            <NotificationBell size="small" />
            
            <Tooltip title="Help">
              <IconButton color="inherit" size="small">
                <HelpIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Account">
              <IconButton onClick={handleProfileMenuOpen} color="inherit" size="small">
                <Avatar sx={{ width: 28, height: 28, bgcolor: alpha(theme.palette.common.white, 0.2) }}>
                  {user?.name?.[0] || 'U'}
                </Avatar>
              </IconButton>
            </Tooltip>
          </Stack>
        </Toolbar>
      </AppBar>

      {/* Profile Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleProfileMenuClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem onClick={() => { navigate('/profile'); handleProfileMenuClose(); }}>
          <ListItemIcon><AccountCircleIcon fontSize="small" /></ListItemIcon>
          Profile
        </MenuItem>
        <MenuItem onClick={() => { navigate('/settings'); handleProfileMenuClose(); }}>
          <ListItemIcon><SettingsIcon fontSize="small" /></ListItemIcon>
          Settings
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleLogout}>
          <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
          Logout
        </MenuItem>
      </Menu>

      {/* Main Content - No padding */}
      <Box sx={{ flexGrow: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {children}
      </Box>
    </Box>
  );
}

export default ClinicalLayout;