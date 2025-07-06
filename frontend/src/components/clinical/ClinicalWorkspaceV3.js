/**
 * ClinicalWorkspaceV3 Component
 * Modern tab-based clinical workspace with customizable layouts
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Tabs,
  Tab,
  Badge,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  CircularProgress,
  Alert,
  useTheme,
  useMediaQuery,
  Fab,
  SpeedDial,
  SpeedDialIcon,
  SpeedDialAction
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Assignment as ChartIcon,
  EventNote as EncountersIcon,
  Science as ResultsIcon,
  LocalPharmacy as OrdersIcon,
  Description as DocumentationIcon,
  Assignment as CarePlanIcon,
  Timeline as TimelineIcon,
  ViewModule as LayoutIcon,
  Add as AddIcon,
  Print as PrintIcon,
  Settings as SettingsIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';

// Contexts
import { useFHIRResource } from '../../contexts/FHIRResourceContext';
import { useAuth } from '../../contexts/AuthContext';
import { decodeFhirId } from '../../utils/navigationUtils';

// Components
import EnhancedPatientHeader from './workspace/EnhancedPatientHeader';
import WorkspaceContent from './workspace/WorkspaceContent';
import LayoutBuilder from './workspace/LayoutBuilder';

// Tab Components
import SummaryTab from './workspace/tabs/SummaryTab';
import ChartReviewTab from './workspace/tabs/ChartReviewTab';
import EncountersTab from './workspace/tabs/EncountersTab';
import ResultsTab from './workspace/tabs/ResultsTab';
import OrdersTab from './workspace/tabs/OrdersTab';
import DocumentationTab from './workspace/tabs/DocumentationTab';
import CarePlanTab from './workspace/tabs/CarePlanTab';
import TimelineTab from './workspace/tabs/TimelineTab';

// Tab Configuration
const TAB_CONFIG = [
  { id: 'summary', label: 'Summary', icon: <DashboardIcon />, component: SummaryTab },
  { id: 'chart', label: 'Chart Review', icon: <ChartIcon />, component: ChartReviewTab },
  { id: 'encounters', label: 'Encounters', icon: <EncountersIcon />, component: EncountersTab },
  { id: 'results', label: 'Results', icon: <ResultsIcon />, component: ResultsTab },
  { id: 'orders', label: 'Orders', icon: <OrdersIcon />, component: OrdersTab },
  { id: 'documentation', label: 'Documentation', icon: <DocumentationIcon />, component: DocumentationTab },
  { id: 'careplan', label: 'Care Plan', icon: <CarePlanIcon />, component: CarePlanTab },
  { id: 'timeline', label: 'Timeline', icon: <TimelineIcon />, component: TimelineTab }
];

const ClinicalWorkspaceV3 = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.down('lg'));
  
  // Route params
  const { id: encodedPatientId } = useParams();
  const patientId = decodeFhirId(encodedPatientId);
  
  // Contexts
  const { currentUser } = useAuth();
  const { currentPatient, setCurrentPatient } = useFHIRResource();
  
  // State
  const [activeTab, setActiveTab] = useState('summary');
  const [customLayout, setCustomLayout] = useState(null);
  const [isLayoutBuilderOpen, setIsLayoutBuilderOpen] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [speedDialOpen, setSpeedDialOpen] = useState(false);
  const [settingsAnchor, setSettingsAnchor] = useState(null);
  const [tabNotifications, setTabNotifications] = useState({});

  // Load patient data
  useEffect(() => {
    const loadPatient = async () => {
      if (patientId && (!currentPatient || currentPatient.id !== patientId)) {
        try {
          setIsLoading(true);
          setLoadError(null);
          await setCurrentPatient(patientId);
        } catch (error) {
          console.error('Failed to load patient:', error);
          setLoadError(error.message || 'Failed to load patient');
        } finally {
          setIsLoading(false);
        }
      } else if (currentPatient && currentPatient.id === patientId) {
        setIsLoading(false);
      }
    };
    loadPatient();
  }, [patientId, currentPatient, setCurrentPatient]);

  // Handle URL parameters for tab
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const tab = searchParams.get('tab');
    if (tab && TAB_CONFIG.find(t => t.id === tab)) {
      setActiveTab(tab);
    }
  }, [location.search]);

  // Load saved preferences
  useEffect(() => {
    if (currentPatient) {
      const savedTab = localStorage.getItem(`workspace-tab-${currentPatient.id}`);
      if (savedTab && TAB_CONFIG.find(t => t.id === savedTab)) {
        setActiveTab(savedTab);
      }
    }
  }, [currentPatient]);

  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    
    // Update URL
    const searchParams = new URLSearchParams(location.search);
    searchParams.set('tab', newValue);
    navigate(`${location.pathname}?${searchParams.toString()}`, { replace: true });
    
    // Save preference
    if (currentPatient) {
      localStorage.setItem(`workspace-tab-${currentPatient.id}`, newValue);
    }

    // Clear notification for this tab
    setTabNotifications(prev => ({ ...prev, [newValue]: 0 }));
  };

  // Handle custom layout selection
  const handleLayoutSelect = (layout) => {
    setCustomLayout(layout);
    setIsLayoutBuilderOpen(false);
  };

  // Handle print
  const handlePrint = () => {
    window.print();
  };

  // Handle refresh
  const handleRefresh = () => {
    window.location.reload();
  };

  // Speed dial actions
  const speedDialActions = [
    { icon: <AddIcon />, name: 'New Note', onClick: () => navigate(`/patients/${patientId}/documentation/new`) },
    { icon: <OrdersIcon />, name: 'New Order', onClick: () => navigate(`/patients/${patientId}/orders/new`) },
    { icon: <LayoutIcon />, name: 'Customize Layout', onClick: () => setIsLayoutBuilderOpen(true) },
    { icon: <PrintIcon />, name: 'Print', onClick: handlePrint },
    { icon: <RefreshIcon />, name: 'Refresh', onClick: handleRefresh }
  ];

  // Tab notification handler (called by child components)
  const updateTabNotification = useCallback((tabId, count) => {
    setTabNotifications(prev => ({ ...prev, [tabId]: count }));
  }, []);

  // Error state
  if (loadError) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert 
          severity="error" 
          action={
            <Button onClick={() => navigate('/patients')}>
              Back to Patients
            </Button>
          }
        >
          {loadError}
        </Alert>
      </Box>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  // No patient state
  if (!currentPatient) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">
          No patient selected. Please select a patient to access the clinical workspace.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      backgroundColor: 'background.default'
    }}>
      {/* Enhanced Patient Header */}
      <EnhancedPatientHeader 
        patientId={patientId} 
        onPrint={handlePrint}
      />

      {/* Tab Navigation or Custom Layout Toggle */}
      {!customLayout ? (
        <Paper 
          elevation={0} 
          sx={{ 
            borderBottom: 1, 
            borderColor: 'divider',
            position: 'sticky',
            top: 0,
            zIndex: theme.zIndex.appBar - 1,
            backgroundColor: 'background.paper'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', px: 2 }}>
            <Tabs
              value={activeTab}
              onChange={handleTabChange}
              variant={isMobile ? 'scrollable' : isTablet ? 'scrollable' : 'standard'}
              scrollButtons={isTablet ? 'auto' : false}
              allowScrollButtonsMobile
              sx={{ flex: 1 }}
            >
              {TAB_CONFIG.map((tab) => (
                <Tab
                  key={tab.id}
                  value={tab.id}
                  label={
                    <Badge 
                      badgeContent={tabNotifications[tab.id] || 0} 
                      color="error"
                      max={99}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {tab.icon}
                        {!isMobile && tab.label}
                      </Box>
                    </Badge>
                  }
                  sx={{ minHeight: 64 }}
                />
              ))}
            </Tabs>

            {/* Settings Menu */}
            <Tooltip title="Workspace Settings">
              <IconButton
                onClick={(e) => setSettingsAnchor(e.currentTarget)}
                sx={{ ml: 1 }}
              >
                <SettingsIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Paper>
      ) : (
        <Paper 
          elevation={0} 
          sx={{ 
            p: 2, 
            borderBottom: 1, 
            borderColor: 'divider',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <Typography variant="h6">
            Custom Layout: {customLayout.name}
          </Typography>
          <Button
            variant="outlined"
            onClick={() => setCustomLayout(null)}
          >
            Back to Tabs
          </Button>
        </Paper>
      )}

      {/* Main Content Area */}
      <Box sx={{ flex: 1, overflow: 'auto', position: 'relative' }}>
        {customLayout ? (
          <WorkspaceContent 
            layout={customLayout} 
            patientId={patientId}
          />
        ) : (
          <Box sx={{ height: '100%' }}>
            {TAB_CONFIG.map((tab) => (
              <Box
                key={tab.id}
                role="tabpanel"
                hidden={activeTab !== tab.id}
                sx={{ height: '100%' }}
              >
                {activeTab === tab.id && (
                  <tab.component 
                    patientId={patientId}
                    onNotificationUpdate={(count) => updateTabNotification(tab.id, count)}
                  />
                )}
              </Box>
            ))}
          </Box>
        )}
      </Box>

      {/* Floating Action Button / Speed Dial */}
      <SpeedDial
        ariaLabel="Clinical actions"
        sx={{ position: 'absolute', bottom: 16, right: 16 }}
        icon={<SpeedDialIcon />}
        onClose={() => setSpeedDialOpen(false)}
        onOpen={() => setSpeedDialOpen(true)}
        open={speedDialOpen}
      >
        {speedDialActions.map((action) => (
          <SpeedDialAction
            key={action.name}
            icon={action.icon}
            tooltipTitle={action.name}
            tooltipOpen
            onClick={() => {
              action.onClick();
              setSpeedDialOpen(false);
            }}
          />
        ))}
      </SpeedDial>

      {/* Settings Menu */}
      <Menu
        anchorEl={settingsAnchor}
        open={Boolean(settingsAnchor)}
        onClose={() => setSettingsAnchor(null)}
      >
        <MenuItem onClick={() => {
          setIsLayoutBuilderOpen(true);
          setSettingsAnchor(null);
        }}>
          <LayoutIcon sx={{ mr: 1 }} />
          Customize Layout
        </MenuItem>
        <MenuItem onClick={() => {
          // TODO: Implement preferences dialog
          setSettingsAnchor(null);
        }}>
          <SettingsIcon sx={{ mr: 1 }} />
          Preferences
        </MenuItem>
      </Menu>

      {/* Layout Builder Dialog */}
      <LayoutBuilder
        open={isLayoutBuilderOpen}
        onClose={() => setIsLayoutBuilderOpen(false)}
        onSelectLayout={handleLayoutSelect}
        patientId={patientId}
      />
    </Box>
  );
};

export default ClinicalWorkspaceV3;