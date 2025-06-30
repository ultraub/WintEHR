import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Divider,
  useTheme,
  useMediaQuery,
  Badge,
  Menu,
  MenuItem,
  Chip,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  EventNote as EventNoteIcon,
  LocalPharmacy as PharmacyIcon,
  Science as ScienceIcon,
  TrendingUp as TrendingUpIcon,
  Api as ApiIcon,
  Lightbulb as LightbulbIcon,
  Webhook as WebhookIcon,
  Assessment as AssessmentIcon,
  Notifications as NotificationsIcon,
  AccountCircle as AccountCircleIcon,
  Logout as LogoutIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
// import BugReportButton from './BugReportButton';  // Temporarily disabled

const drawerWidth = 240;

const menuItems = [
  { text: 'Dashboard', icon: <DashboardIcon />, emoji: '🏠', path: '/dashboard' },
  { text: 'Patients', icon: <PeopleIcon />, emoji: '👥', path: '/patients' },
  { text: 'Population Analytics', icon: <TrendingUpIcon />, emoji: '📊', path: '/analytics' },
  { divider: true },
  { text: 'FHIR Explorer', icon: <ApiIcon />, emoji: '🔍', path: '/fhir' },
  { text: 'CDS Demo', icon: <LightbulbIcon />, emoji: '💡', path: '/cds-demo' },
  { text: 'CDS Hooks Builder', icon: <WebhookIcon />, emoji: '🎯', path: '/cds-hooks' },
  { text: 'Quality Measures', icon: <AssessmentIcon />, emoji: '✅', path: '/quality' },
  { text: 'CQL Measures', icon: <ScienceIcon />, emoji: '🧪', path: '/cql-measures' },
];

function Layout({ children }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleNavigation = (path) => {
    navigate(path);
    if (isMobile) {
      setMobileOpen(false);
    }
  };

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

  const drawer = (
    <div>
      <Toolbar sx={{ 
        backgroundColor: theme.palette.primary.main,
        color: 'white',
        borderBottom: `1px solid ${theme.palette.primary.dark}`,
      }}>
        <Typography variant="h6" noWrap component="div" sx={{ 
          fontWeight: 700,
          letterSpacing: 0.5,
          fontSize: '1.3rem',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
        }}>
          <Box sx={{ 
            width: 36, 
            height: 36, 
            backgroundColor: 'rgba(255, 255, 255, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(255, 255, 255, 0.3)',
          }}>
            <span style={{ fontSize: '1.4rem' }}>🏥</span>
          </Box>
          MedFlow EMR
        </Typography>
      </Toolbar>
      <Divider />
      <List>
        {menuItems.map((item, index) => {
          if (item.divider) {
            return <Divider key={index} sx={{ my: 1 }} />;
          }
          return (
            <ListItem key={item.text} disablePadding>
              <ListItemButton
                selected={location.pathname === item.path}
                onClick={() => handleNavigation(item.path)}
                sx={{
                  borderRadius: '8px',
                  margin: '4px 12px',
                  transition: 'all 0.2s ease',
                  '&.Mui-selected': {
                    backgroundColor: theme.palette.primary.light + '20',
                    color: theme.palette.primary.dark,
                    borderLeft: `3px solid ${theme.palette.primary.main}`,
                    '& .MuiListItemIcon-root': {
                      color: theme.palette.primary.main,
                    },
                    '&:hover': {
                      backgroundColor: theme.palette.primary.light + '30',
                    },
                  },
                  '&:hover': {
                    backgroundColor: theme.palette.action.hover,
                    transform: 'translateX(2px)',
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    color: location.pathname === item.path ? theme.palette.primary.main : 'inherit',
                    minWidth: 40,
                  }}
                >
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center',
                    fontSize: '1.3rem',
                  }}>
                    {item.emoji}
                  </Box>
                </ListItemIcon>
                <ListItemText 
                  primary={item.text} 
                  primaryTypographyProps={{
                    fontWeight: location.pathname === item.path ? 600 : 400,
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </div>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
          backgroundColor: theme.palette.primary.main,
          color: 'white',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {menuItems.find(item => item.path === location.pathname)?.text || 'EMR'}
          </Typography>
          
          {/* Provider Info */}
          {user && (
            <Chip
              label={user.display_name}
              variant="outlined"
              sx={{ 
                mr: 2, 
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                color: theme.palette.primary.dark,
                fontWeight: 500,
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                },
              }}
            />
          )}
          
          <IconButton color="inherit" sx={{ mx: 1 }}>
            <Badge badgeContent={3} color="error">
              <NotificationsIcon />
            </Badge>
          </IconButton>
          <IconButton color="inherit" onClick={handleProfileMenuOpen}>
            <AccountCircleIcon />
          </IconButton>
          
          {/* Profile Menu */}
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleProfileMenuClose}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          >
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <LogoutIcon fontSize="small" />
              </ListItemIcon>
              Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
      >
        <Drawer
          variant={isMobile ? 'temporary' : 'permanent'}
          open={isMobile ? mobileOpen : true}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
          sx={{
            display: { xs: isMobile ? 'block' : 'none', sm: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
              backgroundColor: '#FAFBFC',
              borderRight: '1px solid #E8ECF0',
            },
          }}
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          minHeight: '100vh',
          backgroundColor: theme.palette.background.default,
          mt: '64px',
        }}
      >
        {children}
      </Box>
      {/* <BugReportButton /> */}
    </Box>
  );
}

export default Layout;