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
  Button,
  Typography,
  useTheme,
  useMediaQuery,
  Fab,
  SpeedDial,
  SpeedDialIcon,
  SpeedDialAction,
  Snackbar
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
  Psychology as CDSIcon,
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
import CDSAlertsPanel from './cds/CDSAlertsPanel';

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
  const { currentPatient, setCurrentPatient, isLoading: isGlobalLoading } = useFHIRResource();
  
  // State
  const [activeTab, setActiveTab] = useState('summary');
  const [customLayout, setCustomLayout] = useState(null);
  const [isLayoutBuilderOpen, setIsLayoutBuilderOpen] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [speedDialOpen, setSpeedDialOpen] = useState(false);
  const [settingsAnchor, setSettingsAnchor] = useState(null);
  const [tabNotifications, setTabNotifications] = useState({});
  const [newNoteDialogOpen, setNewNoteDialogOpen] = useState(false);
  const [newOrderDialogOpen, setNewOrderDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });

  // Load patient data
  useEffect(() => {
    const loadPatient = async () => {
      if (patientId && (!currentPatient || currentPatient.id !== patientId)) {
        try {
          setLoadError(null);
          await setCurrentPatient(patientId);
        } catch (error) {
          console.error('Failed to load patient:', error);
          setLoadError(error.message || 'Failed to load patient');
        } finally {
          setIsInitialLoad(false);
        }
      } else if (currentPatient && currentPatient.id === patientId) {
        setIsInitialLoad(false);
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
    // Add print-specific styles temporarily
    const style = document.createElement('style');
    style.innerHTML = `
      @media print {
        /* Hide navigation and controls during print */
        .MuiSpeedDial-root,
        .MuiTabs-root,
        .MuiIconButton-root,
        .MuiButton-root:not(.print-show) {
          display: none !important;
        }
        
        /* Ensure content fills the page */
        body { margin: 0; }
        .MuiBox-root { overflow: visible !important; }
        
        /* Show patient header clearly */
        .MuiPaper-root { box-shadow: none !important; }
      }
    `;
    document.head.appendChild(style);
    
    // Print and remove styles
    window.print();
    setTimeout(() => style.remove(), 100);
  };

  // Handle refresh
  const handleRefresh = async () => {
    if (currentPatient) {
      try {
        // Refresh patient data without full page reload
        await setCurrentPatient(patientId);
        // Show success feedback
        setSnackbar({ open: true, message: 'Patient data refreshed successfully' });
      } catch (error) {
        console.error('Failed to refresh patient data:', error);
        setSnackbar({ open: true, message: 'Failed to refresh data. Reloading page...' });
        // Fallback to page reload after a short delay
        setTimeout(() => window.location.reload(), 1500);
      }
    } else {
      window.location.reload();
    }
  };

  // Speed dial actions
  const speedDialActions = [
    { icon: <AddIcon />, name: 'New Note', onClick: () => {
      setActiveTab('documentation');
      setNewNoteDialogOpen(true);
    }},
    { icon: <OrdersIcon />, name: 'New Order', onClick: () => {
      setActiveTab('orders');
      setNewOrderDialogOpen(true);
    }},
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
  if (isInitialLoad) {
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
      backgroundColor: 'background.default',
      overflow: 'hidden'
    }}>
      {/* Enhanced Patient Header */}
      <EnhancedPatientHeader 
        patientId={patientId} 
        onPrint={handlePrint}
        onNavigateToTab={handleTabChange}
      />

      {/* CDS Alerts Panel - Enhanced with Multiple Presentation Modes */}
      <Box sx={{ px: 2, pt: 1, flexShrink: 0 }}>
        <CDSAlertsPanel 
          patientId={patientId}
          hook="patient-view"
          compact={true}
          maxAlerts={3}
          autoRefresh={false}
          useEnhancedHooks={true}
          debugMode={false}
          onAlertAction={(alert, action, suggestion) => {
            // Handle different actions
            if (action === 'accept' && suggestion) {
              // Could trigger FHIR resource creation, navigation, etc.
              console.debug('Accepting CDS suggestion:', suggestion);
            } else if (action === 'reject') {
              console.debug('Rejecting CDS alert:', alert.summary);
            } else if (action === 'dismiss') {
              console.debug('Dismissing CDS alert:', alert.summary);
            }
          }}
        />
      </Box>

      {/* Tab Navigation or Custom Layout Toggle */}
      {!customLayout ? (
        <Paper 
          elevation={0} 
          sx={{ 
            borderBottom: 1, 
            borderColor: 'divider',
            backgroundColor: 'background.paper'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', px: 1 }}>
            <Tabs
              value={activeTab}
              onChange={handleTabChange}
              variant={isMobile ? 'scrollable' : isTablet ? 'scrollable' : 'standard'}
              scrollButtons={isTablet ? 'auto' : false}
              allowScrollButtonsMobile
              sx={{ 
                flex: 1,
                '& .MuiTab-root': {
                  minHeight: 48,
                  py: 1
                }
              }}
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
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {React.cloneElement(tab.icon, { fontSize: 'small' })}
                        {!isMobile && (
                          <Typography variant="caption" sx={{ fontWeight: 500 }}>
                            {tab.label}
                          </Typography>
                        )}
                      </Box>
                    </Badge>
                  }
                />
              ))}
            </Tabs>

            {/* Settings Menu */}
            <Tooltip title="Workspace Settings">
              <IconButton
                onClick={(e) => setSettingsAnchor(e.currentTarget)}
                size="small"
                sx={{ ml: 0.5 }}
              >
                <SettingsIcon fontSize="small" />
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
                    newNoteDialogOpen={tab.id === 'documentation' ? newNoteDialogOpen : false}
                    onNewNoteDialogClose={() => setNewNoteDialogOpen(false)}
                    newOrderDialogOpen={tab.id === 'orders' ? newOrderDialogOpen : false}
                    onNewOrderDialogClose={() => setNewOrderDialogOpen(false)}
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
          setSettingsAnchor(null);
          // Store current tab preference
          if (currentPatient) {
            localStorage.setItem(`workspace-tab-${currentPatient.id}`, activeTab);
          }
          // Show feedback
          setSnackbar({ open: true, message: 'Preferences saved! Your current tab will be remembered for this patient.' });
        }}>
          <SettingsIcon sx={{ mr: 1 }} />
          Save Preferences
        </MenuItem>
      </Menu>

      {/* Layout Builder Dialog */}
      <LayoutBuilder
        open={isLayoutBuilderOpen}
        onClose={() => setIsLayoutBuilderOpen(false)}
        onSelectLayout={handleLayoutSelect}
        patientId={patientId}
      />

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ open: false, message: '' })}
        message={snackbar.message}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
};

export default ClinicalWorkspaceV3;