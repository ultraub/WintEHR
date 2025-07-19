/**
 * ClinicalSidebar Component
 * Collapsible navigation sidebar for clinical workspace
 * Provides quick access to modules and patient context
 */
import React, { useState, useContext } from 'react';
import {
  Drawer,
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Typography,
  Divider,
  Collapse,
  Badge,
  Avatar,
  Tooltip,
  useTheme,
  useMediaQuery,
  alpha
} from '@mui/material';
import {
  Dashboard as SummaryIcon,
  Assignment as ChartReviewIcon,
  Event as EncountersIcon,
  Science as ResultsIcon,
  LocalPharmacy as OrdersIcon,
  Medication as PharmacyIcon,
  CameraAlt as ImagingIcon,
  Description as DocumentationIcon,
  AccountTree as CarePlanIcon,
  Timeline as TimelineIcon,
  ChevronLeft as CollapseIcon,
  ChevronRight as ExpandIcon,
  Person as PatientIcon,
  Notifications as AlertsIcon,
  History as RecentIcon,
  Favorite as FavoritesIcon,
  Settings as SettingsIcon,
  Help as HelpIcon,
  ExpandLess,
  ExpandMore
} from '@mui/icons-material';
import { useClinicalWorkflow } from '../../../contexts/ClinicalWorkflowContext';
import { format } from 'date-fns';

// Sidebar width constants
const SIDEBAR_WIDTH = 280;
const SIDEBAR_COLLAPSED_WIDTH = 72;

// Navigation items configuration
const NAVIGATION_ITEMS = [
  {
    id: 'summary',
    label: 'Summary',
    icon: SummaryIcon,
    badge: null,
    description: 'Patient overview and key metrics'
  },
  {
    id: 'chart-review',
    label: 'Chart Review',
    icon: ChartReviewIcon,
    badge: null,
    description: 'Problems, medications, allergies, vitals'
  },
  {
    id: 'encounters',
    label: 'Encounters',
    icon: EncountersIcon,
    badge: null,
    description: 'Visit history and notes'
  },
  {
    id: 'results',
    label: 'Results',
    icon: ResultsIcon,
    badge: 'new',
    description: 'Lab results and reports'
  },
  {
    id: 'orders',
    label: 'Orders',
    icon: OrdersIcon,
    badge: 3,
    description: 'Active and pending orders'
  },
  {
    id: 'pharmacy',
    label: 'Pharmacy',
    icon: PharmacyIcon,
    badge: null,
    description: 'Medication management'
  },
  {
    id: 'imaging',
    label: 'Imaging',
    icon: ImagingIcon,
    badge: 2,
    description: 'Radiology and DICOM viewer'
  },
  {
    id: 'documentation',
    label: 'Documentation',
    icon: DocumentationIcon,
    badge: null,
    description: 'Clinical notes and forms'
  },
  {
    id: 'care-plan',
    label: 'Care Plan',
    icon: CarePlanIcon,
    badge: null,
    description: 'Treatment plans and goals'
  },
  {
    id: 'timeline',
    label: 'Timeline',
    icon: TimelineIcon,
    badge: null,
    description: 'Clinical history timeline'
  }
];

const ClinicalSidebar = ({
  open,
  collapsed,
  onToggleCollapse,
  onClose,
  activeTab,
  onTabChange,
  patient,
  variant = 'permanent', // 'permanent', 'persistent', 'temporary'
  anchor = 'left'
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [patientSectionOpen, setPatientSectionOpen] = useState(true);
  const [recentPatientsOpen, setRecentPatientsOpen] = useState(false);
  const { notifications } = useClinicalWorkflow();

  // Get notification counts for badges
  const getNotificationCount = (moduleId) => {
    return notifications.filter(n => n.module === moduleId && !n.read).length;
  };

  // Update navigation items with dynamic badges
  const navItemsWithBadges = NAVIGATION_ITEMS.map(item => ({
    ...item,
    badge: getNotificationCount(item.id) || item.badge
  }));

  const handleNavClick = (itemId) => {
    onTabChange(itemId);
    if (isMobile) {
      onClose();
    }
  };

  const sidebarContent = (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: theme.palette.background.paper
      }}
    >
      {/* Sidebar Header */}
      <Box
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: 1,
          borderColor: 'divider'
        }}
      >
        {!collapsed && (
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Clinical Modules
          </Typography>
        )}
        <IconButton
          onClick={onToggleCollapse}
          size="small"
          sx={{ ml: collapsed ? 'auto' : 0 }}
        >
          {collapsed ? <ExpandIcon /> : <CollapseIcon />}
        </IconButton>
      </Box>

      {/* Patient Context Section */}
      {patient && (
        <>
          <ListItem>
            <ListItemButton
              onClick={() => setPatientSectionOpen(!patientSectionOpen)}
              sx={{ py: collapsed ? 1 : 1.5 }}
            >
              <ListItemIcon>
                <Avatar
                  sx={{
                    width: collapsed ? 32 : 40,
                    height: collapsed ? 32 : 40,
                    backgroundColor: alpha(theme.palette.primary.main, 0.1),
                    color: theme.palette.primary.main
                  }}
                >
                  {patient.name?.[0]?.given?.[0]?.[0]}
                  {patient.name?.[0]?.family?.[0]}
                </Avatar>
              </ListItemIcon>
              {!collapsed && (
                <>
                  <ListItemText
                    primary={
                      <Typography variant="body2" fontWeight={600}>
                        {patient.name?.[0]?.given?.join(' ')} {patient.name?.[0]?.family}
                      </Typography>
                    }
                    secondary={
                      <Typography variant="caption" color="text.secondary">
                        MRN: {patient.identifier?.[0]?.value}
                      </Typography>
                    }
                  />
                  {patientSectionOpen ? <ExpandLess /> : <ExpandMore />}
                </>
              )}
            </ListItemButton>
          </ListItem>
          
          {!collapsed && (
            <Collapse in={patientSectionOpen}>
              <Box sx={{ px: 2, pb: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  Age: {patient.age || 'Unknown'} • {patient.gender}
                </Typography>
                <Box sx={{ mt: 1 }}>
                  <Tooltip title="View all alerts">
                    <Badge badgeContent={5} color="error">
                      <IconButton size="small">
                        <AlertsIcon fontSize="small" />
                      </IconButton>
                    </Badge>
                  </Tooltip>
                </Box>
              </Box>
            </Collapse>
          )}
          
          <Divider />
        </>
      )}

      {/* Main Navigation */}
      <List sx={{ flex: 1, overflow: 'auto', py: 1 }}>
        {navItemsWithBadges.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          
          return (
            <ListItem key={item.id} disablePadding sx={{ px: 1 }}>
              <Tooltip
                title={collapsed ? item.label : ''}
                placement="right"
                arrow
              >
                <ListItemButton
                  onClick={() => handleNavClick(item.id)}
                  selected={isActive}
                  sx={{
                    borderRadius: 1,
                    my: 0.5,
                    ...(isActive && {
                      backgroundColor: alpha(theme.palette.primary.main, 0.12),
                      '&:hover': {
                        backgroundColor: alpha(theme.palette.primary.main, 0.18)
                      }
                    })
                  }}
                >
                  <ListItemIcon sx={{ minWidth: collapsed ? 0 : 56 }}>
                    <Badge
                      badgeContent={
                        typeof item.badge === 'number' ? item.badge :
                        item.badge === 'new' ? '•' : 0
                      }
                      color={item.badge === 'new' ? 'primary' : 'error'}
                      variant={item.badge === 'new' ? 'dot' : 'standard'}
                    >
                      <Icon color={isActive ? 'primary' : 'inherit'} />
                    </Badge>
                  </ListItemIcon>
                  {!collapsed && (
                    <ListItemText
                      primary={item.label}
                      secondary={item.description}
                      primaryTypographyProps={{
                        variant: 'body2',
                        fontWeight: isActive ? 600 : 400
                      }}
                      secondaryTypographyProps={{
                        variant: 'caption',
                        sx: { 
                          display: 'block',
                          mt: 0.5,
                          lineHeight: 1.2
                        }
                      }}
                    />
                  )}
                </ListItemButton>
              </Tooltip>
            </ListItem>
          );
        })}
      </List>

      <Divider />

      {/* Quick Actions */}
      <List sx={{ py: 1 }}>
        <ListItem disablePadding sx={{ px: 1 }}>
          <Tooltip title={collapsed ? 'Recent Patients' : ''} placement="right">
            <ListItemButton
              onClick={() => !collapsed && setRecentPatientsOpen(!recentPatientsOpen)}
              sx={{ borderRadius: 1 }}
            >
              <ListItemIcon sx={{ minWidth: collapsed ? 0 : 56 }}>
                <RecentIcon />
              </ListItemIcon>
              {!collapsed && (
                <>
                  <ListItemText primary="Recent Patients" />
                  {recentPatientsOpen ? <ExpandLess /> : <ExpandMore />}
                </>
              )}
            </ListItemButton>
          </Tooltip>
        </ListItem>
        
        {!collapsed && (
          <Collapse in={recentPatientsOpen}>
            <List dense sx={{ pl: 4 }}>
              {/* Mock recent patients - would be populated from context */}
              <ListItemButton sx={{ borderRadius: 1 }}>
                <ListItemText 
                  primary="John Smith"
                  secondary="Seen 2h ago"
                />
              </ListItemButton>
              <ListItemButton sx={{ borderRadius: 1 }}>
                <ListItemText 
                  primary="Jane Doe"
                  secondary="Seen yesterday"
                />
              </ListItemButton>
            </List>
          </Collapse>
        )}

        <ListItem disablePadding sx={{ px: 1 }}>
          <Tooltip title={collapsed ? 'Favorites' : ''} placement="right">
            <ListItemButton sx={{ borderRadius: 1 }}>
              <ListItemIcon sx={{ minWidth: collapsed ? 0 : 56 }}>
                <FavoritesIcon />
              </ListItemIcon>
              {!collapsed && <ListItemText primary="Favorites" />}
            </ListItemButton>
          </Tooltip>
        </ListItem>
      </List>

      <Divider />

      {/* Bottom Actions */}
      <List sx={{ py: 1 }}>
        <ListItem disablePadding sx={{ px: 1 }}>
          <Tooltip title={collapsed ? 'Settings' : ''} placement="right">
            <ListItemButton sx={{ borderRadius: 1 }}>
              <ListItemIcon sx={{ minWidth: collapsed ? 0 : 56 }}>
                <SettingsIcon />
              </ListItemIcon>
              {!collapsed && <ListItemText primary="Settings" />}
            </ListItemButton>
          </Tooltip>
        </ListItem>
        
        <ListItem disablePadding sx={{ px: 1 }}>
          <Tooltip title={collapsed ? 'Help' : ''} placement="right">
            <ListItemButton sx={{ borderRadius: 1 }}>
              <ListItemIcon sx={{ minWidth: collapsed ? 0 : 56 }}>
                <HelpIcon />
              </ListItemIcon>
              {!collapsed && <ListItemText primary="Help" />}
            </ListItemButton>
          </Tooltip>
        </ListItem>
      </List>
    </Box>
  );

  // For mobile, use temporary drawer
  if (isMobile && variant === 'permanent') {
    return (
      <Drawer
        anchor={anchor}
        open={open}
        onClose={onClose}
        sx={{
          '& .MuiDrawer-paper': {
            width: SIDEBAR_WIDTH,
            boxSizing: 'border-box'
          }
        }}
      >
        {sidebarContent}
      </Drawer>
    );
  }

  // For desktop, use permanent/persistent drawer
  return (
    <Drawer
      variant={variant}
      anchor={anchor}
      open={open}
      onClose={onClose}
      sx={{
        width: collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH,
          boxSizing: 'border-box',
          transition: theme.transitions.create('width', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen
          })
        }
      }}
    >
      {sidebarContent}
    </Drawer>
  );
};

export default ClinicalSidebar;