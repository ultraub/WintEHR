/**
 * LayoutV3 Component
 * Modern application layout with improved navigation, search, and workflow support
 */
import React, { useState, useContext, useMemo } from 'react';
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
  Menu,
  MenuItem,
  Chip,
  Avatar,
  Badge,
  InputBase,
  Paper,
  Tooltip,
  Stack,
  Card,
  CardContent,
  Collapse,
  ListSubheader,
  alpha,
  Breadcrumbs,
  Link,
  Button,
  Fab,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon
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
  AccountCircle as AccountCircleIcon,
  Logout as LogoutIcon,
  Security as SecurityIcon,
  Search as SearchIcon,
  Notifications as NotificationsIcon,
  Settings as SettingsIcon,
  Help as HelpIcon,
  ExpandLess,
  ExpandMore,
  Home as HomeIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Assignment as AssignmentIcon,
  Timeline as TimelineIcon,
  Groups as GroupsIcon,
  MedicalServices as MedicalIcon,
  Analytics as AnalyticsIcon,
  CloudUpload as UploadIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  DashboardCustomize as DashboardCustomizeIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { MedicalThemeContext } from '../App';
import NotificationBell from './NotificationBell';
import ThemeSwitcher from './theme/ThemeSwitcher';
import SearchBar from './SearchBar';

const drawerWidth = 280;

// Enhanced navigation structure with categories and workflows
const navigationConfig = {
  clinical: {
    title: 'Clinical Workflows',
    icon: <MedicalIcon />,
    items: [
      { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard', description: 'Overview & quick actions' },
      { text: 'Patients', icon: <PeopleIcon />, path: '/patients', description: 'Patient management' },
      { text: 'Encounters', icon: <EventNoteIcon />, path: '/encounters', description: 'Visit management' },
      { text: 'Orders & Results', icon: <ScienceIcon />, path: '/lab-results', description: 'Lab & imaging' },
      { text: 'Medications', icon: <PharmacyIcon />, path: '/medications', description: 'Medication management' },
      { text: 'Pharmacy', icon: <PharmacyIcon />, path: '/pharmacy', description: 'Pharmacy workflow & dispensing', badge: 'New' }
    ]
  },
  analytics: {
    title: 'Population Health',
    icon: <AnalyticsIcon />,
    items: [
      { text: 'Population Analytics', icon: <TrendingUpIcon />, path: '/analytics', description: 'Health trends & metrics' },
      { text: 'Quality Measures', icon: <AssessmentIcon />, path: '/quality', description: 'Performance tracking' },
      { text: 'Care Gaps', icon: <TimelineIcon />, path: '/care-gaps', description: 'Preventive care tracking' }
    ]
  },
  tools: {
    title: 'Developer Tools',
    icon: <ApiIcon />,
    items: [
      { text: 'FHIR Explorer', icon: <ApiIcon />, path: '/fhir-explorer', description: 'Browse FHIR resources', badge: 'Enhanced' },
      { text: 'UI Composer', icon: <DashboardCustomizeIcon />, path: '/ui-composer', description: 'Dynamic UI generation', badge: 'Experimental' },
      { text: 'CDS Studio', icon: <WebhookIcon />, path: '/cds-studio', description: 'Clinical decision support studio', badge: 'Enhanced' },
      { text: 'Training Center', icon: <LightbulbIcon />, path: '/training', description: 'Learning & demos' }
    ]
  },
  admin: {
    title: 'Administration',
    icon: <SecurityIcon />,
    items: [
      { text: 'Audit Trail', icon: <SecurityIcon />, path: '/audit-trail', description: 'Security & compliance' },
      { text: 'System Settings', icon: <SettingsIcon />, path: '/settings', description: 'Configuration' }
    ]
  }
};

const quickActions = [
  { name: 'New Patient', icon: <AddIcon />, action: 'newPatient' },
  { name: 'Upload Data', icon: <UploadIcon />, action: 'uploadData' },
  { name: 'Export Report', icon: <DownloadIcon />, action: 'exportReport' },
  { name: 'Refresh Data', icon: <RefreshIcon />, action: 'refreshData' }
];


const NavigationSection = ({ section, sectionKey, isOpen, onToggle, selectedPath, onNavigate }) => {
  return (
    <Box>
      <ListSubheader
        component="div"
        sx={{
          bgcolor: 'transparent',
          color: 'text.secondary',
          fontWeight: 600,
          fontSize: '0.75rem',
          textTransform: 'uppercase',
          letterSpacing: 1,
          py: 1
        }}
      >
        <ListItemButton onClick={() => onToggle(sectionKey)} sx={{ borderRadius: 1 }}>
          <ListItemIcon sx={{ minWidth: 36 }}>
            {section.icon}
          </ListItemIcon>
          <ListItemText primary={section.title} />
          {isOpen ? <ExpandLess /> : <ExpandMore />}
        </ListItemButton>
      </ListSubheader>
      
      <Collapse in={isOpen} timeout="auto" unmountOnExit>
        <List dense sx={{ pl: 1 }}>
          {section.items.map((item) => (
            <ListItem key={item.path} disablePadding>
              <ListItemButton
                onClick={() => onNavigate(item.path)}
                selected={selectedPath === item.path}
                sx={{
                  borderRadius: 1,
                  mb: 0.5,
                  '&.Mui-selected': {
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    '& .MuiListItemIcon-root': {
                      color: 'primary.contrastText'
                    },
                    '&:hover': {
                      bgcolor: 'primary.dark'
                    }
                  }
                }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText 
                  primary={item.text}
                  secondary={item.description}
                  primaryTypographyProps={{ fontSize: '0.875rem' }}
                  secondaryTypographyProps={{ fontSize: '0.75rem' }}
                />
                {item.badge && (
                  <Chip 
                    label={item.badge} 
                    size="small" 
                    color="primary" 
                    sx={{ ml: 1, height: 20 }}
                  />
                )}
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Collapse>
    </Box>
  );
};

const UserProfile = ({ user, onLogout, onProfileClick }) => {
  return (
    <Card sx={{ m: 2, mt: 'auto' }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Avatar sx={{ bgcolor: 'primary.main' }}>
            {user?.name?.[0] || 'U'}
          </Avatar>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" noWrap>
              {user?.name || 'User'}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {user?.role || 'Clinician'}
            </Typography>
          </Box>
          <IconButton size="small" onClick={onLogout}>
            <LogoutIcon fontSize="small" />
          </IconButton>
        </Stack>
      </CardContent>
    </Card>
  );
};

const BreadcrumbNavigation = ({ location }) => {
  const pathSegments = location.pathname.split('/').filter(Boolean);
  
  if (pathSegments.length <= 1) return null;
  
  return (
    <Breadcrumbs sx={{ mb: 2 }}>
      <Link
        underline="hover"
        color="inherit"
        href="/dashboard"
        sx={{ display: 'flex', alignItems: 'center' }}
      >
        <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
        Home
      </Link>
      {pathSegments.map((segment, index) => {
        const isLast = index === pathSegments.length - 1;
        const href = '/' + pathSegments.slice(0, index + 1).join('/');
        const title = segment.charAt(0).toUpperCase() + segment.slice(1).replace('-', ' ');
        
        return isLast ? (
          <Typography color="text.primary" key={segment}>
            {title}
          </Typography>
        ) : (
          <Link
            underline="hover"
            color="inherit"
            href={href}
            key={segment}
          >
            {title}
          </Link>
        );
      })}
    </Breadcrumbs>
  );
};

function LayoutV3({ children }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [openSections, setOpenSections] = useState({
    clinical: true,
    analytics: false,
    tools: false,
    admin: false
  });
  const medicalThemeContext = useContext(MedicalThemeContext);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleNavigation = (path) => {
    navigate(path);
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  const handleSectionToggle = (sectionKey) => {
    setOpenSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
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
  };

  const handleQuickAction = (action) => {
    // Implement quick actions
  };

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Logo/Brand */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main' }}>
          WintEHR
        </Typography>
        <Typography variant="caption" color="text.secondary">
          FHIR-Native Clinical Platform
        </Typography>
      </Box>

      {/* Navigation */}
      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        <List sx={{ px: 1, py: 2 }}>
          {Object.entries(navigationConfig).map(([key, section]) => (
            <NavigationSection
              key={key}
              section={section}
              sectionKey={key}
              isOpen={openSections[key]}
              onToggle={handleSectionToggle}
              selectedPath={location.pathname}
              onNavigate={handleNavigation}
            />
          ))}
        </List>
      </Box>

      {/* User Profile */}
      <UserProfile 
        user={user} 
        onLogout={handleLogout}
        onProfileClick={() => navigate('/profile')}
      />
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      {/* App Bar */}
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          bgcolor: 'background.paper',
          color: 'text.primary',
          boxShadow: theme.shadows[1],
          borderBottom: 1,
          borderColor: 'divider'
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>

          {/* Search Bar */}
          <SearchBar />
          
          <Box sx={{ flexGrow: 1 }} />
          
          {/* Toolbar Actions */}
          <Stack direction="row" spacing={1} alignItems="center">
            <ThemeSwitcher 
              currentTheme={medicalThemeContext?.currentTheme}
              currentMode={medicalThemeContext?.currentMode}
              onThemeChange={medicalThemeContext?.onThemeChange}
              onModeChange={medicalThemeContext?.onModeChange}
            />
            
            <NotificationBell />
            
            <Tooltip title="Help & Support">
              <IconButton color="inherit">
                <HelpIcon />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Account">
              <IconButton onClick={handleProfileMenuOpen} color="inherit">
                <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
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
          <ListItemIcon><AccountCircleIcon /></ListItemIcon>
          Profile
        </MenuItem>
        <MenuItem onClick={() => { navigate('/settings'); handleProfileMenuClose(); }}>
          <ListItemIcon><SettingsIcon /></ListItemIcon>
          Settings
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleLogout}>
          <ListItemIcon><LogoutIcon /></ListItemIcon>
          Logout
        </MenuItem>
      </Menu>

      {/* Navigation Drawer */}
      <Box
        component="nav"
        sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth }
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': { 
              boxSizing: 'border-box', 
              width: drawerWidth,
              borderRight: 1,
              borderColor: 'divider'
            }
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          height: '100vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <Toolbar />
        <Box sx={{ flexGrow: 1, overflow: 'auto', p: 3 }}>
          <BreadcrumbNavigation location={location} />
          {children}
        </Box>
      </Box>

      {/* Quick Actions Speed Dial */}
      <SpeedDial
        ariaLabel="Quick Actions"
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
        icon={<SpeedDialIcon />}
      >
        {quickActions.map((action) => (
          <SpeedDialAction
            key={action.name}
            icon={action.icon}
            tooltipTitle={action.name}
            onClick={() => handleQuickAction(action.action)}
          />
        ))}
      </SpeedDial>
    </Box>
  );
}

export default LayoutV3;