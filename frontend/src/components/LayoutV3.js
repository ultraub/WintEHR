/**
 * LayoutV3 Component
 * Modern application layout with improved navigation, search, and workflow support
 */
import React, { useState, useContext, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, Link as RouterLink, Navigate } from 'react-router-dom';
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  Button,
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
  Api as ApiIcon,
  AccountCircle as AccountCircleIcon,
  Logout as LogoutIcon,
  Security as SecurityIcon,
  Settings as SettingsIcon,
  ExpandLess,
  ExpandMore,
  Home as HomeIcon,
  Assignment as EncountersIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { shellPalette } from '../themes/shellPalette';
import { auroraFor, useAuroraPalette, avatarInk } from '../themes/auroraPalette';
import { createMedicalTheme } from '../themes/medicalTheme';
import { ThemeProvider, alpha } from '@mui/material/styles';
import { keyframes } from '@mui/system';
import { useEffectiveNavigation } from './useEffectiveNavigation';
import { MedicalThemeContext } from '../App';
import QuickThemeToggle from './theme/QuickThemeToggle';
import SearchBar from './SearchBar';
import WebSocketStatus from './common/WebSocketStatus';
import WorkflowNotificationsButton from './common/WorkflowNotificationsButton';
import CommandPalette, { isPaletteShortcut } from './common/CommandPalette';
import TransitionWrapper from './transitions/TransitionWrapper';

const drawerWidth = 280;
const railWidth = 64;

const groundDrift = keyframes`
  from { background-position: 0 0; }
  to { background-position: 1200px 0; }
`;

// Two faint wave bands, tiled down the deep ground.
const groundWaves = (stroke) => `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='440' viewBox='0 0 1200 440' fill='none' stroke='${stroke}' stroke-width='54'>`
  + "<path d='M-60 150 C 180 30, 420 270, 600 150 S 1020 30, 1260 150'/>"
  + "<path d='M-60 370 C 180 250, 420 490, 600 370 S 1020 250, 1260 370'/>"
  + '</svg>'
)}")`;

// Navigation structure derives from navigationRegistry: core seed + pages
// contributed by enabled modules (docs/MODULES.md), minus what the Command
// Center's navigation policy hides for this user (useEffectiveNavigation).
// Do not hardcode nav items here — module items and their routes come from
// ONE manifest entry.

const NavigationSection = ({ section, sectionKey, isOpen, onToggle, selectedPath, onNavigate }) => {
  // the phase's accent marks the current page
  const { navAccent } = useAuroraPalette();
  return (
    <Box>
      <ListSubheader
        component="div"
        sx={{
          bgcolor: 'transparent',
          color: shellPalette.textMuted,
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
            color: shellPalette.textMuted,
            '&:hover': { bgcolor: alpha(navAccent, 0.12) },
            '& .MuiListItemIcon-root': { color: shellPalette.textMuted },
          }}
        >
          <ListItemIcon sx={{ minWidth: 36, color: shellPalette.textMuted }}>
            {section.icon}
          </ListItemIcon>
          <ListItemText
            primary={section.title}
            primaryTypographyProps={{
              fontSize: '0.7rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: shellPalette.textMuted,
            }}
          />
          {isOpen ? <ExpandLess sx={{ color: shellPalette.textMuted }} /> : <ExpandMore sx={{ color: shellPalette.textMuted }} />}
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
                    color: shellPalette.textBright,
                    borderLeft: isActive ? `3px solid ${navAccent}` : '3px solid transparent',
                    '& .MuiListItemIcon-root': { color: item.iconColor || shellPalette.iconMuted },
                    transition: 'all 0.15s ease',
                    '&:hover': {
                      bgcolor: alpha(navAccent, 0.12),
                      color: shellPalette.textBright,
                      '& .MuiListItemIcon-root': { color: item.iconColor || shellPalette.textBright },
                    },
                    '&.Mui-selected': {
                      bgcolor: alpha(navAccent, 0.16),
                      color: '#B4BEFD',
                      boxShadow: `inset 0 0 20px ${alpha(navAccent, 0.08)}`,
                      '& .MuiListItemIcon-root': { color: item.iconColor || '#B4BEFD' },
                      '&:hover': {
                        bgcolor: alpha(navAccent, 0.22),
                      },
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.text}
                    primaryTypographyProps={{ fontSize: '0.875rem', color: 'inherit' }}
                  />
                  {item.badge && (
                    <Chip
                      label={item.badge}
                      size="small"
                      sx={{ ml: 1, height: 20, bgcolor: navAccent, color: avatarInk }}
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
  const { navAccent } = useAuroraPalette();
  return (
    <Card sx={{ m: 2, mt: 'auto', bgcolor: 'rgba(0, 0, 0, 0.15)', backgroundImage: 'none', boxShadow: 'none', borderRadius: 2, border: 'none' }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Avatar sx={{ bgcolor: navAccent, border: `2px solid ${navAccent}` }}>
            {user?.name?.[0] || 'U'}
          </Avatar>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" noWrap sx={{ color: shellPalette.textBright }}>
              {user?.name || 'User'}
            </Typography>
            <Typography variant="caption" noWrap sx={{ color: shellPalette.textMuted }}>
              {user?.role || 'Clinician'}
            </Typography>
          </Box>
          <IconButton size="small" onClick={onLogout} sx={{ color: shellPalette.textMuted, '&:hover': { color: shellPalette.textBright, bgcolor: alpha(navAccent, 0.12) } }}>
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
        // a record id in the path is not a name anyone can read
        const looksLikeId = /^[0-9a-f]{8}[0-9a-f-]{12,}$/i.test(decodeURIComponent(segment).replace(/\s/g, '-'));
        const title = looksLikeId
          ? 'Record'
          : segment.charAt(0).toUpperCase() + segment.slice(1).replace('-', ' ');
        
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

/**
 * App shell. Every authenticated route renders inside it.
 *   rail  — the navigation collapses to a 64px icon rail (desktop). Used by
 *           full-width workspaces (patient chart, FHIR Explorer, UI Composer)
 *           that need the horizontal space but should not lose the app's
 *           navigation, search and account menu.
 *   flush — the page owns its own padding and header; the shell adds neither
 *           padding nor its breadcrumb.
 *   ground — 'deep' is for a page that opens with its own hero
 *           (AuroraHero): the shell leaves out its breadcrumb. Every page
 *           sits on the phase's ground either way.
 *
 * The app bar always wears the shell's dark colours, so the navigation and
 * the bar frame every page the same way. Its contents render under a dark
 * theme (see `barTheme`) rather than being restyled one by one.
 */
function LayoutV3({ children, rail = false, flush = false, ground = 'default' }) {
  const navWidth = rail ? railWidth : drawerWidth;
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { config: navigationConfig, ready: navReady, isHiddenPath, landingPath } = useEffectiveNavigation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [openSections, setOpenSections] = useState({
    clinical: true,
    analytics: false,
    tools: false,
    admin: false
  });
  const themeContext = useContext(MedicalThemeContext);
  // The app bar is dark in every theme and mode; rendering its contents
  // under the dark palette gives the search field, toggles and menus the
  // right colours without touching each of them.
  const barThemeName = themeContext?.currentTheme;
  const barTheme = useMemo(() => createMedicalTheme(barThemeName, 'dark'), [barThemeName]);
  const deepGround = ground === 'deep';
  // sunrise, day, sunset or night: the bar, the navigation and a deep
  // page's ground all shift together
  const auroraPalette = auroraFor(theme.phase || (theme.palette.mode === 'dark' ? 'night' : 'day'));

  // Cmd/Ctrl+K opens the command palette from anywhere in the shell.
  const [paletteOpen, setPaletteOpen] = useState(false);
  useEffect(() => {
    const onKeyDown = (event) => {
      if (isPaletteShortcut(event)) {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

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
      background: auroraPalette.navGradient,
      '& .MuiList-root': { bgcolor: 'transparent' },
      '& .MuiListSubheader-root': { bgcolor: 'transparent' },
      /* Scrollbar styling */
      '& ::-webkit-scrollbar': { width: 6 },
      '& ::-webkit-scrollbar-track': { bgcolor: 'transparent' },
      '& ::-webkit-scrollbar-thumb': { bgcolor: shellPalette.scrollbarThumb, borderRadius: 3 },
      '& ::-webkit-scrollbar-thumb:hover': { bgcolor: shellPalette.scrollbarThumbHover },
    }}>
      {/* Logo/Brand */}
      <Box sx={{ p: 2, borderBottom: `1px solid ${shellPalette.divider}`, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box
          component="img"
          src="/wintehr-logo-icon.png"
          alt="WintEHR"
          sx={{ width: 56, height: 56, objectFit: 'contain', filter: 'brightness(0) invert(1)' }}
        />
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: shellPalette.textPrimary, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            WintEHR
          </Typography>
          <Typography variant="caption" sx={{ color: shellPalette.textMuted, letterSpacing: '0.02em', fontSize: '0.7rem' }}>
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

  const railDrawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', background: auroraPalette.navGradient }}>
      <Tooltip title="Home" placement="right">
        <IconButton onClick={() => handleNavigation(landingPath)} aria-label="WintEHR home" sx={{ my: 1.25 }}>
          <Box
            component="img"
            src="/wintehr-logo-icon.png"
            alt=""
            sx={{ width: 32, height: 32, objectFit: 'contain', filter: 'brightness(0) invert(1)' }}
          />
        </IconButton>
      </Tooltip>
      <Box component="nav" aria-label="Main" sx={{ flexGrow: 1, overflowY: 'auto', overflowX: 'hidden', width: '100%' }}>
        {Object.entries(navigationConfig).map(([key, section], sectionIndex) => (
          <Box
            key={key}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              py: 0.75,
              borderTop: sectionIndex === 0 ? 'none' : `1px solid ${shellPalette.divider}`,
            }}
          >
            {section.items.map((item) => {
              const isActive = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
              return (
                <Tooltip key={item.path} title={item.text} placement="right">
                  <IconButton
                    onClick={() => handleNavigation(item.path)}
                    aria-label={item.text}
                    aria-current={isActive ? 'page' : undefined}
                    sx={{
                      my: 0.25,
                      width: 44,
                      height: 44,
                      borderRadius: 1.5,
                      color: isActive ? shellPalette.textPrimary : (item.iconColor || shellPalette.iconMuted),
                      backgroundColor: isActive ? alpha(auroraPalette.navAccent, 0.16) : 'transparent',
                      boxShadow: isActive ? `inset 3px 0 0 ${auroraPalette.navAccent}` : 'none',
                      '&:hover': { backgroundColor: alpha(auroraPalette.navAccent, 0.12), color: shellPalette.textBright },
                      '& svg': { fontSize: 24 },
                    }}
                  >
                    {item.icon}
                  </IconButton>
                </Tooltip>
              );
            })}
          </Box>
        ))}
      </Box>
    </Box>
  );

  // A page the navigation policy hides for this user is not reachable by
  // URL either: once the policy is known, land on the first visible page.
  if (navReady && isHiddenPath(location.pathname)) {
    return <Navigate to={landingPath} replace />;
  }

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      {/* App Bar */}
      <ThemeProvider theme={barTheme}>
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${navWidth}px)` },
          ml: { md: `${navWidth}px` },
          // the phase's bar colour: always dark, and a step apart from the
          // navigation beside it
          bgcolor: auroraPalette.bar,
          backgroundImage: 'none',
          // square: rounded corners let the page background show through
          borderRadius: 0,
          color: shellPalette.textBright,
          boxShadow: 'none',
          borderBottom: '1px solid',
          borderColor: 'transparent'
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

          {/* Visible entry point for the command palette */}
          <Tooltip title="Go to a page or patient">
            <Button
              onClick={() => setPaletteOpen(true)}
              size="small"
              color="inherit"
              aria-label="Open command palette"
              sx={{
                ml: 1,
                display: { xs: 'none', md: 'inline-flex' },
                minWidth: 0,
                px: 1,
                color: 'text.secondary',
                border: '1px solid',
                borderColor: 'divider',
                fontSize: '0.75rem',
                fontFamily: 'inherit',
                textTransform: 'none',
              }}
            >
              {typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform) ? '⌘K' : 'Ctrl K'}
            </Button>
          </Tooltip>
          
          <Box sx={{ flexGrow: 1 }} />
          
          {/* Toolbar Actions */}
          <Stack direction="row" spacing={1} alignItems="center">
            <QuickThemeToggle 
              showLabel={false}
              size="medium"
              position="header"
            />
            
            <WebSocketStatus showLabel={false} />
            <WorkflowNotificationsButton />

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
      </ThemeProvider>

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
        sx={{ width: { md: navWidth }, flexShrink: { md: 0 } }}
      >
        <Drawer
          variant="temporary"
          elevation={0}
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
              background: auroraPalette.navGradient,
              // square: the drawer meets the window edge and the app bar,
              // and rounded corners there show the page behind them
              borderRadius: 0,
              borderRight: `1px solid ${alpha(auroraPalette.navAccent, 0.18)}`,
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
              width: navWidth,
              background: auroraPalette.navGradient,
              // square: the drawer meets the window edge and the app bar,
              // and rounded corners there show the page behind them
              borderRadius: 0,
              borderRight: `1px solid ${alpha(auroraPalette.navAccent, 0.18)}`,
            }
          }}
          open
        >
          {rail ? railDrawer : drawer}
        </Drawer>
      </Box>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${navWidth}px)` },
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
          p: flush ? 0 : { xs: 2, sm: 2.5, md: 3 },
          // Every page sits on the phase's ground. Each phase's text
          // colours are chosen to read on it, so a page needs no special
          // handling; `ground="deep"` only drops the breadcrumb for a page
          // that opens with its own hero.
          backgroundColor: auroraPalette.ground,
          backgroundImage: groundWaves(auroraPalette.wave),
          backgroundSize: '1200px 440px',
          // a daytime breeze: the bands drift slowly across the ground
          ...(auroraPalette.breeze && {
            animation: `${groundDrift} 120s linear infinite`,
            '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
          }),
        }}>
          {!flush && !deepGround && <BreadcrumbNavigation location={location} />}
          <TransitionWrapper transition="fade" duration={150}>
            {children}
          </TransitionWrapper>
        </Box>
      </Box>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        navigationConfig={navigationConfig}
      />
    </Box>
  );
}

export default LayoutV3;