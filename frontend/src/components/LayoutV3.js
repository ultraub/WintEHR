/**
 * LayoutV3 Component
 * Modern application layout with improved navigation, search, and workflow support
 */
import React, { useState, useContext } from 'react';
import { useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
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
  Tooltip,
  Stack,
  Card,
  CardContent,
  Collapse,
  ListSubheader,
  Breadcrumbs,
  Link,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  LocalPharmacy as PharmacyIcon,
  TrendingUp as TrendingUpIcon,
  Api as ApiIcon,
  Webhook as WebhookIcon,
  Assessment as AssessmentIcon,
  AccountCircle as AccountCircleIcon,
  Logout as LogoutIcon,
  Security as SecurityIcon,
  Settings as SettingsIcon,
  Help as HelpIcon,
  ExpandLess,
  ExpandMore,
  Home as HomeIcon,
  Timeline as TimelineIcon,
  MedicalServices as MedicalIcon,
  Analytics as AnalyticsIcon,
  CalendarMonth as ScheduleIcon,
  Assignment as EncountersIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { MedicalThemeContext } from '../App';
import NotificationBell from './NotificationBell';
import QuickThemeToggle from './theme/QuickThemeToggle';
import SearchBar from './SearchBar';
import TransitionWrapper from './transitions/TransitionWrapper';

const drawerWidth = 280;

// Enhanced navigation structure with categories and workflows
const navigationConfig = {
  clinical: {
    title: 'Clinical Workflows',
    icon: <MedicalIcon />,
    items: [
      { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard', description: 'Overview & quick actions' },
      { text: 'Schedule', icon: <ScheduleIcon />, path: '/schedule', description: 'Appointments & scheduling' },
      { text: 'Patients', icon: <PeopleIcon />, path: '/patients', description: 'Patient management' },
      { text: 'Encounters', icon: <EncountersIcon />, path: '/encounters', description: 'Visit management' },
      { text: 'Pharmacy', icon: <PharmacyIcon />, path: '/pharmacy', description: 'Pharmacy workflow & dispensing' }
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
      { text: 'FHIR Explorer', icon: <ApiIcon />, path: '/fhir-explorer', description: 'FHIR resource exploration & queries' },
      { text: 'CDS Studio', icon: <WebhookIcon />, path: '/cds-studio', description: 'Clinical decision support studio' }
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

const NavigationSection = ({ section, sectionKey, isOpen, onToggle, selectedPath, onNavigate }) => {
  return (
    <Box>
      <ListSubheader
        component="div"
        sx={{
          bgcolor: 'transparent',
          color: '#A9A3C0',
          fontWeight: 600,
          fontSize: '0.7rem',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          py: 1
        }}
      >
        <ListItemButton
          onClick={() => onToggle(sectionKey)}
          sx={{
            borderRadius: 1,
            color: '#A9A3C0',
            '&:hover': { bgcolor: 'rgba(99, 102, 241, 0.12)' },
            '& .MuiListItemIcon-root': { color: '#A9A3C0' },
          }}
        >
          <ListItemIcon sx={{ minWidth: 36, color: '#A9A3C0' }}>
            {section.icon}
          </ListItemIcon>
          <ListItemText
            primary={section.title}
            primaryTypographyProps={{
              fontSize: '0.7rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: '#A9A3C0',
            }}
          />
          {isOpen ? <ExpandLess sx={{ color: '#A9A3C0' }} /> : <ExpandMore sx={{ color: '#A9A3C0' }} />}
        </ListItemButton>
      </ListSubheader>

      <Collapse in={isOpen} timeout="auto" unmountOnExit>
        <List dense sx={{ pl: 1 }}>
          {section.items.map((item) => {
            const isActive = selectedPath === item.path;
            return (
              <ListItem key={item.path} disablePadding>
                <ListItemButton
                  onClick={() => onNavigate(item.path)}
                  selected={isActive}
                  sx={{
                    borderRadius: '6px',
                    mb: 0.5,
                    color: '#EDEAF5',
                    borderLeft: isActive ? '3px solid #6366F1' : '3px solid transparent',
                    '& .MuiListItemIcon-root': { color: '#9E98BA' },
                    transition: 'all 0.15s ease',
                    '&:hover': {
                      bgcolor: 'rgba(99, 102, 241, 0.12)',
                      color: '#EDEAF5',
                      '& .MuiListItemIcon-root': { color: '#EDEAF5' },
                    },
                    '&.Mui-selected': {
                      bgcolor: 'rgba(99, 102, 241, 0.14)',
                      color: '#B4BEFD',
                      boxShadow: 'inset 0 0 20px rgba(99, 102, 241, 0.08), 0 0 12px rgba(99, 102, 241, 0.06)',
                      '& .MuiListItemIcon-root': { color: '#B4BEFD' },
                      '&:hover': {
                        bgcolor: 'rgba(99, 102, 241, 0.20)',
                      },
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.text}
                    secondary={item.description}
                    primaryTypographyProps={{ fontSize: '0.875rem', color: 'inherit' }}
                    secondaryTypographyProps={{ fontSize: '0.75rem', color: '#A9A3C0' }}
                  />
                  {item.badge && (
                    <Chip
                      label={item.badge}
                      size="small"
                      sx={{ ml: 1, height: 20, bgcolor: '#6366F1', color: '#FAFAF9' }}
                    />
                  )}
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      </Collapse>
    </Box>
  );
};

const UserProfile = ({ user, onLogout, onProfileClick }) => {
  return (
    <Card sx={{ m: 2, mt: 'auto', bgcolor: 'rgba(0, 0, 0, 0.15)', backgroundImage: 'none', boxShadow: 'none', borderRadius: 2, border: 'none' }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Avatar sx={{ bgcolor: '#6366F1', border: '2px solid #6366F1' }}>
            {user?.name?.[0] || 'U'}
          </Avatar>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" noWrap sx={{ color: '#EDEAF5' }}>
              {user?.name || 'User'}
            </Typography>
            <Typography variant="caption" noWrap sx={{ color: '#A9A3C0' }}>
              {user?.role || 'Clinician'}
            </Typography>
          </Box>
          <IconButton size="small" onClick={onLogout} sx={{ color: '#A9A3C0', '&:hover': { color: '#F0EFF4', bgcolor: 'rgba(99, 102, 241, 0.12)' } }}>
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
        component={RouterLink}
        to="/dashboard"
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
            component={RouterLink}
            to={href}
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
  // MedicalThemeContext available via useContext if needed
  useContext(MedicalThemeContext);

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

  const drawer = (
    <Box sx={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'linear-gradient(180deg, #1A1735 0%, #252244 45%, #1F1D2B 100%)',
      '& .MuiList-root': { bgcolor: 'transparent' },
      '& .MuiListSubheader-root': { bgcolor: 'transparent' },
      /* Scrollbar styling */
      '& ::-webkit-scrollbar': { width: 6 },
      '& ::-webkit-scrollbar-track': { bgcolor: 'transparent' },
      '& ::-webkit-scrollbar-thumb': { bgcolor: '#44403C', borderRadius: 3 },
      '& ::-webkit-scrollbar-thumb:hover': { bgcolor: '#57534E' },
    }}>
      {/* Logo/Brand */}
      <Box sx={{ p: 2, borderBottom: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box
          component="img"
          src="/wintehr-logo-icon.png"
          alt="WintEHR"
          sx={{ width: 56, height: 56, objectFit: 'contain', filter: 'brightness(0) invert(1)' }}
        />
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#FAFAF9', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            WintEHR
          </Typography>
          <Typography variant="caption" sx={{ color: '#A9A3C0', letterSpacing: '0.02em', fontSize: '0.7rem' }}>
            FHIR-Native Clinical Platform
          </Typography>
        </Box>
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
          bgcolor: theme.palette.mode === 'dark'
            ? 'rgba(30, 41, 59, 0.78)'
            : 'rgba(243, 241, 255, 0.82)',
          color: 'text.primary',
          boxShadow: 'none',
          backdropFilter: 'saturate(180%) blur(20px)',
          WebkitBackdropFilter: 'saturate(180%) blur(20px)',
          borderBottom: '0.5px solid',
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
            <QuickThemeToggle 
              showLabel={false}
              size="medium"
              position="header"
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
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
              background: 'linear-gradient(180deg, #1A1735 0%, #252244 45%, #1F1D2B 100%)',
              borderRight: '1px solid rgba(99, 102, 241, 0.15)',
            }
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
              background: 'linear-gradient(180deg, #1A1735 0%, #252244 45%, #1F1D2B 100%)',
              borderRight: '1px solid rgba(99, 102, 241, 0.15)',
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
        <Box sx={{
          flexGrow: 1,
          overflow: 'auto',
          p: { xs: 2, sm: 2.5, md: 3 },
          backgroundImage: theme.palette.mode === 'dark'
            ? 'linear-gradient(180deg, rgba(99,102,241,0.14) 0%, rgba(99,102,241,0.05) 200px, transparent 500px)'
            : 'linear-gradient(180deg, rgba(99,102,241,0.10) 0%, rgba(99,102,241,0.03) 200px, transparent 500px)',
        }}>
          <BreadcrumbNavigation location={location} />
          <TransitionWrapper transition="fade" duration={300}>
            {children}
          </TransitionWrapper>
        </Box>
      </Box>

    </Box>
  );
}

export default LayoutV3;