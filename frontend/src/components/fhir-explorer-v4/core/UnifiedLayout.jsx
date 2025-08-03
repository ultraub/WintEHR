/**
 * Unified Layout Component for FHIR Explorer v4
 * 
 * Provides consistent navigation, theming, and responsive layout
 * for all views and modes in the application.
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Divider,
  Badge,
  Avatar,
  Menu,
  MenuItem,
  Tooltip,
  Chip,
  useMediaQuery,
  useTheme,
  Collapse,
  Paper,
  Breadcrumbs,
  Link,
  LinearProgress
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  Explore as ExploreIcon,
  Build as BuildIcon,
  Visibility as VisibilityIcon,
  Work as WorkspaceIcon,
  Lightbulb as LightbulbIcon,
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
  Settings as SettingsIcon,
  Help as HelpIcon,
  Person as PersonIcon,
  Notifications as NotificationsIcon,
  Search as SearchIcon,
  ExpandMore,
  ExpandLess,
  FiberManualRecord,
  Memory as MemoryIcon,
  Share as ShareIcon,
  Code as CodeIcon,
  Timeline as TimelineIcon,
  Hub as HubIcon,
  Schema as SchemaIcon,
  Chat as ChatIcon,
  Playground as PlaygroundIcon,
  BarChart as ChartIcon,
  AccountTree as NetworkIcon,
  Storage as DataIcon
} from '@mui/icons-material';
import { alpha } from '@mui/material/styles';

// Import mode constants
import { APP_MODES, DISCOVERY_VIEWS, QUERY_VIEWS, VISUALIZATION_VIEWS } from '../constants/appConstants';

// Import QuickThemeToggle
import QuickThemeToggle from '../../theme/QuickThemeToggle';

// Navigation structure with icons and descriptions
const NAVIGATION_STRUCTURE = {
  [APP_MODES.DASHBOARD]: {
    label: 'Dashboard',
    icon: <DashboardIcon />,
    description: 'Overview and quick access',
    color: '#1976d2'
  },
  [APP_MODES.DISCOVERY]: {
    label: 'Discovery',
    icon: <ExploreIcon />,
    description: 'Explore FHIR resources and schemas',
    color: '#388e3c',
    views: {
      [DISCOVERY_VIEWS.CATALOG]: {
        label: 'Resource Catalog',
        icon: <DataIcon />,
        description: 'Browse all FHIR resource types'
      },
      [DISCOVERY_VIEWS.SCHEMA]: {
        label: 'Schema Explorer',
        icon: <SchemaIcon />,
        description: 'Interactive FHIR documentation'
      },
      [DISCOVERY_VIEWS.RELATIONSHIPS]: {
        label: 'Relationships',
        icon: <HubIcon />,
        description: 'Resource relationship maps'
      }
    }
  },
  [APP_MODES.QUERY_BUILDING]: {
    label: 'Query Builder',
    icon: <BuildIcon />,
    description: 'Build and test FHIR queries',
    color: '#f57c00',
    views: {
      [QUERY_VIEWS.STUDIO]: {
        label: 'Query Studio',
        icon: <CodeIcon />,
        description: 'Unified query building experience'
      },
      [QUERY_VIEWS.NATURAL_LANGUAGE]: {
        label: 'Natural Language',
        icon: <ChatIcon />,
        description: 'Query in plain English'
      },
      [QUERY_VIEWS.WORKSPACE]: {
        label: 'Workspace',
        icon: <WorkspaceIcon />,
        description: 'Save and manage queries'
      }
    }
  },
  [APP_MODES.VISUALIZATION]: {
    label: 'Visualization',
    icon: <VisibilityIcon />,
    description: 'Charts and data visualization',
    color: '#7b1fa2',
    views: {
      [VISUALIZATION_VIEWS.CHARTS]: {
        label: 'Data Charts',
        icon: <ChartIcon />,
        description: 'Statistical visualizations'
      },
      [VISUALIZATION_VIEWS.TIMELINE]: {
        label: 'Patient Timeline',
        icon: <TimelineIcon />,
        description: 'Patient journey visualization'
      },
      [VISUALIZATION_VIEWS.NETWORK]: {
        label: 'Network Diagram',
        icon: <NetworkIcon />,
        description: 'Resource relationship networks'
      },
    }
  }
};

const DRAWER_WIDTH = 280;
const MINI_DRAWER_WIDTH = 64;

/**
 * Header with search, notifications, and user menu
 */
const AppHeader = ({ 
  onMenuToggle, 
  isMobile,
  dataLoading,
  showDrawerToggle = false
}) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [notificationsAnchor, setNotificationsAnchor] = useState(null);

  const handleUserMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setAnchorEl(null);
  };

  const handleNotificationsOpen = (event) => {
    setNotificationsAnchor(event.currentTarget);
  };

  const handleNotificationsClose = () => {
    setNotificationsAnchor(null);
  };

  return (
    <AppBar 
      position="fixed" 
      elevation={0}
      sx={{
        zIndex: (theme) => theme.zIndex.drawer + 1,
        bgcolor: 'background.paper',
        borderBottom: 1,
        borderColor: 'divider',
        backdropFilter: 'blur(8px)',
        backgroundColor: (theme) => alpha(theme.palette.background.paper, 0.8)
      }}
    >
      {dataLoading && (
        <LinearProgress 
          sx={{ 
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 1
          }} 
        />
      )}
      
      <Toolbar sx={{ px: { xs: 1, sm: 3 } }}>
        {/* Menu toggle for mobile */}
        {isMobile && (
          <IconButton
            edge="start"
            onClick={onMenuToggle}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
        )}

        {/* Logo and title */}
        <Box sx={{ display: 'flex', alignItems: 'center', mr: 3 }}>
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: '8px',
              background: 'linear-gradient(45deg, #1976d2, #42a5f5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mr: 2
            }}
          >
            <MemoryIcon sx={{ color: 'white', fontSize: 20 }} />
          </Box>
          <Typography 
            variant="h6" 
            sx={{ 
              fontWeight: 700,
              color: 'text.primary',
              display: { xs: 'none', sm: 'block' }
            }}
          >
            FHIR Explorer
          </Typography>
          <Chip 
            label="v4"
            size="small"
            color="primary"
            sx={{ 
              ml: 1,
              height: 20,
              '& .MuiChip-label': { fontSize: '0.7rem', px: 1 }
            }}
          />
        </Box>

        {/* Spacer */}
        <Box sx={{ flexGrow: 1 }} />

        {/* Actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* Desktop drawer toggle button */}
          {!isMobile && showDrawerToggle && (
            <Tooltip title="Toggle Navigation">
              <IconButton onClick={onMenuToggle} color="inherit">
                <MenuIcon />
              </IconButton>
            </Tooltip>
          )}

          {/* Theme toggle */}
          <QuickThemeToggle 
            showLabel={false}
            size="medium"
            position="header"
          />

          {/* Notifications */}
          <Tooltip title="Notifications">
            <IconButton onClick={handleNotificationsOpen} color="inherit">
              <Badge badgeContent={3} color="error">
                <NotificationsIcon />
              </Badge>
            </IconButton>
          </Tooltip>

          {/* User menu */}
          <Tooltip title="User menu">
            <IconButton onClick={handleUserMenuOpen} sx={{ ml: 1 }}>
              <Avatar 
                sx={{ 
                  width: 32, 
                  height: 32,
                  bgcolor: 'primary.main'
                }}
              >
                <PersonIcon fontSize="small" />
              </Avatar>
            </IconButton>
          </Tooltip>
        </Box>

        {/* User menu dropdown */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleUserMenuClose}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        >
          <MenuItem onClick={handleUserMenuClose}>
            <ListItemIcon><PersonIcon /></ListItemIcon>
            Profile
          </MenuItem>
          <MenuItem onClick={handleUserMenuClose}>
            <ListItemIcon><SettingsIcon /></ListItemIcon>
            Settings
          </MenuItem>
          <Divider />
          <MenuItem onClick={handleUserMenuClose}>
            <ListItemIcon><HelpIcon /></ListItemIcon>
            Help & Support
          </MenuItem>
        </Menu>

        {/* Notifications dropdown */}
        <Menu
          anchorEl={notificationsAnchor}
          open={Boolean(notificationsAnchor)}
          onClose={handleNotificationsClose}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          PaperProps={{ sx: { width: 320, maxHeight: 400 } }}
        >
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="h6">Notifications</Typography>
          </Box>
          <MenuItem>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                New data available
              </Typography>
              <Typography variant="caption" color="text.secondary">
                5 new patients added to the system
              </Typography>
            </Box>
          </MenuItem>
          <MenuItem>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                Query optimization tip
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Consider using _include for better performance
              </Typography>
            </Box>
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
};

/**
 * Navigation drawer with modes and views
 */
const NavigationDrawer = ({ 
  open, 
  currentMode, 
  currentView, 
  onModeChange, 
  onClose,
  isMobile,
  permanent = false 
}) => {
  const [expandedModes, setExpandedModes] = useState({
    [APP_MODES.DISCOVERY]: true,
    [APP_MODES.QUERY_BUILDING]: true,
    [APP_MODES.VISUALIZATION]: true
  });

  const handleModeExpand = (mode) => {
    setExpandedModes(prev => ({
      ...prev,
      [mode]: !prev[mode]
    }));
  };

  const renderNavigationItem = (mode, config) => {
    const isActive = currentMode === mode;
    const hasViews = config.views && Object.keys(config.views).length > 0;
    const isExpanded = expandedModes[mode];

    return (
      <Box key={mode}>
        <ListItemButton
          onClick={() => {
            if (hasViews && !isActive) {
              // If mode has views and isn't active, expand and navigate to first view
              setExpandedModes(prev => ({ ...prev, [mode]: true }));
              const firstView = Object.keys(config.views)[0];
              onModeChange(mode, firstView);
            } else if (hasViews) {
              // If mode is active and has views, toggle expansion
              handleModeExpand(mode);
            } else {
              // Simple mode without views
              onModeChange(mode);
            }
            if (isMobile) onClose?.();
          }}
          sx={{
            py: 1.5,
            px: 2,
            mx: 1,
            mb: 0.5,
            borderRadius: 2,
            backgroundColor: isActive 
              ? alpha(config.color || '#1976d2', 0.1)
              : 'transparent',
            '&:hover': {
              backgroundColor: alpha(config.color || '#1976d2', 0.05)
            }
          }}
        >
          <ListItemIcon sx={{ minWidth: 40 }}>
            {React.cloneElement(config.icon, {
              sx: { 
                color: isActive ? (config.color || 'primary.main') : 'text.secondary',
                fontSize: 24
              }
            })}
          </ListItemIcon>
          <ListItemText
            primary={config.label}
            secondary={!open ? null : config.description}
            primaryTypographyProps={{
              fontWeight: isActive ? 600 : 400,
              color: isActive ? (config.color || 'primary.main') : 'text.primary'
            }}
            secondaryTypographyProps={{
              fontSize: '0.75rem',
              color: 'text.secondary'
            }}
          />
          {hasViews && open && (
            <IconButton 
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleModeExpand(mode);
              }}
            >
              {isExpanded ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          )}
        </ListItemButton>

        {/* Sub-views */}
        {hasViews && open && (
          <Collapse in={isExpanded} timeout="auto">
            <List disablePadding>
              {Object.entries(config.views).map(([viewKey, viewConfig]) => {
                const isViewActive = currentMode === mode && currentView === viewKey;
                return (
                  <ListItemButton
                    key={viewKey}
                    onClick={() => {
                      onModeChange(mode, viewKey);
                      if (isMobile) onClose?.();
                    }}
                    sx={{
                      py: 1,
                      pl: 6,
                      pr: 2,
                      mx: 1,
                      mb: 0.5,
                      borderRadius: 2,
                      backgroundColor: isViewActive 
                        ? alpha(config.color || '#1976d2', 0.08)
                        : 'transparent',
                      '&:hover': {
                        backgroundColor: alpha(config.color || '#1976d2', 0.04)
                      }
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      {React.cloneElement(viewConfig.icon, {
                        sx: { 
                          color: isViewActive ? (config.color || 'primary.main') : 'text.secondary',
                          fontSize: 20
                        }
                      })}
                    </ListItemIcon>
                    <ListItemText
                      primary={viewConfig.label}
                      secondary={viewConfig.description}
                      primaryTypographyProps={{
                        fontSize: '0.875rem',
                        fontWeight: isViewActive ? 500 : 400,
                        color: isViewActive ? (config.color || 'primary.main') : 'text.primary'
                      }}
                      secondaryTypographyProps={{
                        fontSize: '0.7rem',
                        color: 'text.secondary'
                      }}
                    />
                    {isViewActive && (
                      <FiberManualRecord 
                        sx={{ 
                          fontSize: 8, 
                          color: config.color || 'primary.main',
                          ml: 1
                        }} 
                      />
                    )}
                  </ListItemButton>
                );
              })}
            </List>
          </Collapse>
        )}
      </Box>
    );
  };

  const drawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Navigation items */}
      <Box sx={{ flex: 1, pt: 1 }}>
        <List>
          {Object.entries(NAVIGATION_STRUCTURE).map(([mode, config]) => 
            renderNavigationItem(mode, config)
          )}
        </List>
      </Box>

      {/* Bottom actions */}
      {open && (
        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Help">
              <IconButton size="small">
                <HelpIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Settings">
              <IconButton size="small">
                <SettingsIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Share">
              <IconButton size="small">
                <ShareIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      )}
    </Box>
  );

  if (isMobile) {
    return (
      <Drawer
        anchor="left"
        open={open}
        onClose={onClose}
        ModalProps={{ keepMounted: true }}
        PaperProps={{
          sx: {
            width: DRAWER_WIDTH,
            bgcolor: 'background.paper',
            borderRight: 1,
            borderColor: 'divider'
          }
        }}
      >
        {drawerContent}
      </Drawer>
    );
  }

  return (
    <Drawer
      variant="permanent"
      open={open}
      PaperProps={{
        sx: {
          width: open ? DRAWER_WIDTH : MINI_DRAWER_WIDTH,
          transition: (theme) => theme.transitions.create('width', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen
          }),
          overflowX: 'hidden',
          bgcolor: 'background.paper',
          borderRight: 1,
          borderColor: 'divider'
        }
      }}
    >
      <Toolbar /> {/* Spacer for AppBar */}
      {drawerContent}
    </Drawer>
  );
};

/**
 * Breadcrumb navigation
 */
const BreadcrumbNavigation = ({ currentMode, currentView }) => {
  const modeConfig = NAVIGATION_STRUCTURE[currentMode];
  const viewConfig = modeConfig?.views?.[currentView];

  return (
    <Paper 
      elevation={0}
      sx={{ 
        p: 2, 
        mb: 2,
        bgcolor: 'background.surface',
        border: 1,
        borderColor: 'divider'
      }}
    >
      <Breadcrumbs separator="›">
        <Link 
          color="text.secondary" 
          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
        >
          {modeConfig?.icon}
          {modeConfig?.label}
        </Link>
        {viewConfig && (
          <Typography 
            color="text.primary" 
            sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 500 }}
          >
            {viewConfig.icon}
            {viewConfig.label}
          </Typography>
        )}
      </Breadcrumbs>
      
      {viewConfig?.description && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {viewConfig.description}
        </Typography>
      )}
    </Paper>
  );
};

/**
 * Main Unified Layout Component
 */
function UnifiedLayout({ 
  children,
  currentMode,
  currentView,
  onModeChange,
  isMobile,
  fhirData,
  dataLoading,
  autoCollapse = false
}) {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [desktopDrawerOpen, setDesktopDrawerOpen] = useState(true);

  const handleMobileDrawerToggle = useCallback(() => {
    setMobileDrawerOpen(prev => !prev);
  }, []);

  const handleDesktopDrawerToggle = useCallback(() => {
    setDesktopDrawerOpen(prev => !prev);
  }, []);

  // Enhanced mode change handler with auto-collapse support
  const handleModeChange = useCallback((mode, view) => {
    onModeChange(mode, view);
    
    // Auto-collapse desktop drawer when a view is selected (if autoCollapse is enabled and not mobile)
    if (autoCollapse && !isMobile && view) {
      setDesktopDrawerOpen(false);
    }
  }, [onModeChange, autoCollapse, isMobile]);

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      {/* Header */}
      <AppHeader
        onMenuToggle={isMobile ? handleMobileDrawerToggle : handleDesktopDrawerToggle}
        isMobile={isMobile}
        dataLoading={dataLoading}
        showDrawerToggle={true}
      />

      {/* Navigation drawer */}
      <NavigationDrawer
        open={isMobile ? mobileDrawerOpen : desktopDrawerOpen}
        currentMode={currentMode}
        currentView={currentView}
        onModeChange={handleModeChange}
        onClose={() => setMobileDrawerOpen(false)}
        isMobile={isMobile}
      />

      {/* Main content */}
      <Box 
        component="main"
        sx={{
          flexGrow: 1,
          height: '100vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          ml: isMobile ? 0 : (desktopDrawerOpen ? `${DRAWER_WIDTH}px` : `${MINI_DRAWER_WIDTH}px`),
          transition: (theme) => theme.transitions.create('margin-left', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen
          })
        }}
      >
        <Toolbar /> {/* Spacer for AppBar */}
        
        <Box 
          sx={{ 
            flex: 1, 
            overflow: 'auto',
            bgcolor: 'background.default',
            p: { xs: 1, sm: 2, md: 3 }
          }}
          className="fhir-content-scroll"
        >
          {/* Breadcrumb navigation */}
          <BreadcrumbNavigation 
            currentMode={currentMode} 
            currentView={currentView} 
          />
          
          {/* Page content */}
          {children}
        </Box>
      </Box>
    </Box>
  );
}

export default UnifiedLayout;