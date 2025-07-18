/**
 * ClinicalWorkspaceV3 Component
 * Modern tab-based clinical workspace with customizable layouts
 */
import React, { useState, useEffect, useCallback, Suspense, useMemo, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  CircularProgress,
  Alert,
  AlertTitle,
  Button,
  Typography,
  Stack,
  useTheme,
  useMediaQuery,
  Fab,
  SpeedDial,
  SpeedDialIcon,
  SpeedDialAction,
  Snackbar
} from '@mui/material';
import SafeBadge from '../common/SafeBadge';
import {
  Dashboard as DashboardIcon,
  Assignment as ChartIcon,
  EventNote as EncountersIcon,
  Science as ResultsIcon,
  LocalPharmacy as PharmacyIcon,
  Description as DocumentationIcon,
  Assignment as CarePlanIcon,
  Assignment,
  Assignment as OrdersIcon,
  Timeline as TimelineIcon,
  Image as ImagingIcon,
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
import { decodeFhirId } from '../../core/navigation/navigationUtils';

// Components
import EnhancedPatientHeader from './workspace/EnhancedPatientHeader';
import WorkspaceContent from './workspace/WorkspaceContent';
import { usePatientCDSAlerts } from '../../contexts/CDSContext';
import ClinicalLayout from './layouts/ClinicalLayout';
import { getClinicalContext } from '../../themes/clinicalThemeUtils';

// Lazy-loaded Components
const LayoutBuilder = React.lazy(() => import('./workspace/LayoutBuilder'));
const CDSPresentation = React.lazy(() => import('./cds/CDSPresentation'));

// Tab Components - Lazy Loaded for Performance
const SummaryTab = React.lazy(() => import('./workspace/tabs/SummaryTab'));
const ChartReviewTab = React.lazy(() => import('./workspace/tabs/ChartReviewTab'));
const EncountersTab = React.lazy(() => import('./workspace/tabs/EncountersTab'));
const ResultsTab = React.lazy(() => import('./workspace/tabs/ResultsTab'));
const OrdersTab = React.lazy(() => import('./workspace/tabs/OrdersTab'));
const PharmacyTab = React.lazy(() => import('./workspace/tabs/PharmacyTab'));
const DocumentationTab = React.lazy(() => import('./workspace/tabs/DocumentationTab'));
const CarePlanTab = React.lazy(() => import('./workspace/tabs/CarePlanTab'));
const TimelineTab = React.lazy(() => import('./workspace/tabs/TimelineTab'));
const ImagingTab = React.lazy(() => import('./workspace/tabs/ImagingTab'));

// Tab Loading Component with Skeleton
const TabLoadingFallback = () => (
  <Box sx={{ p: 3 }}>
    <Stack spacing={3}>
      {/* Header Skeleton */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ width: 200, height: 32, bgcolor: 'grey.200', borderRadius: 1 }} />
        <Box sx={{ width: 120, height: 36, bgcolor: 'grey.200', borderRadius: 1 }} />
      </Box>
      
      {/* Filter Bar Skeleton */}
      <Box sx={{ display: 'flex', gap: 2 }}>
        <Box sx={{ width: 200, height: 40, bgcolor: 'grey.200', borderRadius: 1 }} />
        <Box sx={{ width: 120, height: 40, bgcolor: 'grey.200', borderRadius: 1 }} />
        <Box sx={{ width: 100, height: 40, bgcolor: 'grey.200', borderRadius: 1 }} />
      </Box>
      
      {/* Content List Skeleton */}
      <Stack spacing={1}>
        {Array.from({ length: 5 }, (_, index) => (
          <Box key={`skeleton-${index}`} sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1 }}>
            <Box sx={{ width: 40, height: 40, bgcolor: 'grey.200', borderRadius: '50%' }} />
            <Box sx={{ flex: 1 }}>
              <Box sx={{ width: '60%', height: 20, bgcolor: 'grey.200', borderRadius: 1, mb: 0.5 }} />
              <Box sx={{ width: '40%', height: 16, bgcolor: 'grey.200', borderRadius: 1 }} />
            </Box>
            <Box sx={{ width: 80, height: 24, bgcolor: 'grey.200', borderRadius: 1 }} />
          </Box>
        ))}
      </Stack>
    </Stack>
  </Box>
);

// CDS Alerts Display Component with Display Behavior Support
const CDSAlertsDisplay = ({ patientId, compact = false, maxAlerts = 5 }) => {
  const { alerts, loading } = usePatientCDSAlerts(patientId);
  const [dismissed, setDismissed] = useState(new Set());
  const prevVisibleCountRef = useRef(0);
  
  // Filter out dismissed alerts and limit to maxAlerts - MUST be before early returns
  const visibleAlerts = useMemo(() => {
    return alerts
      .filter(alert => !dismissed.has(alert.uuid))
      .slice(0, maxAlerts);
  }, [alerts, dismissed, maxAlerts]);

  // Group alerts by presentation mode - MUST be before early returns
  const alertsByMode = useMemo(() => {
    const grouped = {};
    visibleAlerts.forEach(alert => {
      const mode = alert.displayBehavior?.presentationMode || 'popup';
      
      if (!grouped[mode]) {
        grouped[mode] = [];
      }
      grouped[mode].push(alert);
    });
    
    // Grouped alerts are now available in 'grouped' object for debugging if needed
    
    return grouped;
  }, [visibleAlerts]);
  
  // Track when visible alerts count changes
  if (visibleAlerts.length !== prevVisibleCountRef.current) {
    // Alert count changed from prevVisibleCountRef.current to visibleAlerts.length
    prevVisibleCountRef.current = visibleAlerts.length;
  }
  
  const handleDismiss = (alertId) => {
    setDismissed(prev => new Set([...prev, alertId]));
  };
  
  // Early returns AFTER all hooks
  if (loading) {
    return null;
  }
  
  if (visibleAlerts.length === 0) {
    return null;
  }


  return (
    <>
      {/* Render alerts by their configured presentation mode */}
      {Object.entries(alertsByMode).map(([mode, modeAlerts]) => (
        <React.Suspense key={mode} fallback={<div>Loading alerts...</div>}>
          <CDSPresentation
            alerts={modeAlerts}
            mode={mode}
            onAlertAction={handleDismiss}
            autoHide={false}
            allowInteraction={true}
            patientId={patientId}
          />
        </React.Suspense>
      ))}

      {/* Fallback for any alerts without displayBehavior - render as simple alerts */}
      {visibleAlerts.filter(alert => !alert.displayBehavior).length > 0 && (
        <Box sx={{ px: 2, pt: 1, pb: compact ? 0.5 : 1, flexShrink: 0 }}>
          <Stack spacing={1}>
            {visibleAlerts.filter(alert => !alert.displayBehavior).map((alert) => (
              <Alert
                key={alert.uuid}
                severity={
                  alert.indicator === 'critical' ? 'error' :
                  alert.indicator === 'warning' ? 'warning' : 'info'
                }
                onClose={() => handleDismiss(alert.uuid)}
                sx={{
                  '& .MuiAlert-message': {
                    width: '100%'
                  }
                }}
              >
                <AlertTitle sx={{ fontWeight: 'medium', fontSize: '0.875rem' }}>
                  {alert.summary}
                </AlertTitle>
                {!compact && alert.detail && (
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    {alert.detail}
                  </Typography>
                )}
                {alert.source?.label && (
                  <Typography variant="caption" sx={{ display: 'block', mt: 0.5, opacity: 0.8 }}>
                    Source: {alert.source.label}
                  </Typography>
                )}
              </Alert>
            ))}
          </Stack>
        </Box>
      )}
    </>
  );
};

// Tab Configuration
const TAB_CONFIG = [
  { id: 'summary', label: 'Summary', icon: <DashboardIcon />, component: SummaryTab },
  { id: 'chart', label: 'Chart Review', icon: <ChartIcon />, component: ChartReviewTab },
  { id: 'encounters', label: 'Encounters', icon: <EncountersIcon />, component: EncountersTab },
  { id: 'results', label: 'Results', icon: <ResultsIcon />, component: ResultsTab },
  { id: 'orders', label: 'Orders', icon: <Assignment />, component: OrdersTab },
  { id: 'pharmacy', label: 'Pharmacy', icon: <PharmacyIcon />, component: PharmacyTab },
  { id: 'imaging', label: 'Imaging', icon: <ImagingIcon />, component: ImagingTab },
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
  const patientId = decodeFhirId(encodedPatientId).toLowerCase(); // Normalize to lowercase for consistency
  
  // Contexts
  const { currentUser } = useAuth();
  const { 
    currentPatient, 
    setCurrentPatient, 
    isLoading: isGlobalLoading,
    warmPatientCache,
    isCacheWarm
  } = useFHIRResource();
  
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
  
  // Detect department from user role or location
  const department = useMemo(() => {
    const role = currentUser?.role?.toLowerCase();
    const path = location.pathname.toLowerCase();
    
    if (role?.includes('emergency') || path.includes('emergency')) return 'emergency';
    if (role?.includes('cardio') || path.includes('cardio')) return 'cardiology';
    if (role?.includes('pedia') || path.includes('pedia')) return 'pediatrics';
    if (role?.includes('onco') || path.includes('onco')) return 'oncology';
    if (role?.includes('psych') || path.includes('psych')) return 'psychiatry';
    return 'general';
  }, [currentUser, location]);
  
  // Get clinical context
  const clinicalContext = useMemo(() => 
    getClinicalContext(location.pathname, new Date().getHours(), department),
    [location.pathname, department]
  );
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
          setLoadError(error.message || 'Failed to load patient');
        } finally {
          setIsInitialLoad(false);
        }
      } else if (currentPatient && currentPatient.id === patientId) {
        setIsInitialLoad(false);
      }
    };
    loadPatient();
  }, [patientId, currentPatient?.id]); // Remove setCurrentPatient from dependencies to prevent loops

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
    <ClinicalLayout
      patientContext={currentPatient ? {
        id: currentPatient.id,
        name: `${currentPatient.name?.[0]?.given?.[0] || ''} ${currentPatient.name?.[0]?.family || ''}`,
        birthDate: currentPatient.birthDate,
        status: 'active'
      } : null}
      department={department}
      shift={clinicalContext?.shift}
      showPatientInfo={!!currentPatient}
      showDepartmentInfo={true}
      showTimeInfo={true}
      title="Clinical Workspace"
      subtitle={currentPatient ? `Patient: ${currentPatient.id}` : 'No patient selected'}
    >
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'background.default'
      }}>
        {/* Enhanced Patient Header */}
        <EnhancedPatientHeader 
          patientId={patientId} 
          onPrint={handlePrint}
          onNavigateToTab={handleTabChange}
        />

      {/* Spacer for fixed header - adjust based on whether patient details are expanded */}
      <Box sx={{ height: { xs: 100, md: 110 } }} />

      {/* CDS Alerts Display - Using Centralized CDS System */}
      <CDSAlertsDisplay patientId={patientId} compact={true} maxAlerts={3} />

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
                    <SafeBadge 
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
                    </SafeBadge>
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
            {TAB_CONFIG.map((tab, index) => {
              const currentIndex = TAB_CONFIG.findIndex(t => t.id === activeTab);
              
              // Define tabs that should not be pre-rendered due to heavy resource loading
              const resourceHeavyTabs = ['imaging', 'results', 'documentation'];
              
              // Only render active tab and adjacent tabs to reduce DOM size
              // But exclude resource-heavy tabs from pre-rendering to prevent unnecessary API calls
              const isActive = activeTab === tab.id;
              const isAdjacent = Math.abs(index - currentIndex) <= 1;
              const isResourceHeavy = resourceHeavyTabs.includes(tab.id);
              
              const shouldRender = isActive || (isAdjacent && !isResourceHeavy);
              
              return (
                <Box
                  key={tab.id}
                  role="tabpanel"
                  hidden={activeTab !== tab.id}
                  sx={{ 
                    height: '100%',
                    display: activeTab === tab.id ? 'block' : 'none'
                  }}
                >
                  {shouldRender ? (
                    <Suspense fallback={<TabLoadingFallback />}>
                      <tab.component 
                        patientId={patientId}
                        onNotificationUpdate={(count) => updateTabNotification(tab.id, count)}
                        newNoteDialogOpen={tab.id === 'documentation' ? newNoteDialogOpen : false}
                        onNewNoteDialogClose={() => setNewNoteDialogOpen(false)}
                        newOrderDialogOpen={tab.id === 'orders' ? newOrderDialogOpen : false}
                        onNewOrderDialogClose={() => setNewOrderDialogOpen(false)}
                        department={department}
                        clinicalContext={clinicalContext}
                      />
                    </Suspense>
                  ) : null}
                </Box>
              );
            })}
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
      {isLayoutBuilderOpen && (
        <Suspense fallback={
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
            <CircularProgress />
          </Box>
        }>
          <LayoutBuilder
            open={isLayoutBuilderOpen}
            onClose={() => setIsLayoutBuilderOpen(false)}
            onSelectLayout={handleLayoutSelect}
            patientId={patientId}
          />
        </Suspense>
      )}

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ open: false, message: '' })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSnackbar({ open: false, message: '' })} 
          severity="success"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
      </Box>
    </ClinicalLayout>
  );
};

export default ClinicalWorkspaceV3;