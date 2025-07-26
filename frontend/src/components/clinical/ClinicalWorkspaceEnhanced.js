/**
 * ClinicalWorkspaceEnhanced Component
 * Enhanced version of ClinicalWorkspaceV3 that works with the new navigation system
 * Removes duplicate headers and integrates with EnhancedClinicalLayout
 */
import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  CircularProgress,
  Alert,
  AlertTitle,
  Button,
  useTheme,
  Snackbar,
  Chip,
  alpha,
  Typography
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Assignment as ChartIcon,
  EventNote as EncountersIcon,
  Science as ResultsIcon,
  LocalPharmacy as PharmacyIcon,
  Description as DocumentationIcon,
  Assignment as CarePlanIcon,
  Assignment as OrdersIcon,
  Timeline as TimelineIcon,
  Image as ImagingIcon,
  ChevronLeft as ChevronLeftIcon
} from '@mui/icons-material';

// Contexts
import { useFHIRResource } from '../../contexts/FHIRResourceContext';
import { useAuth } from '../../contexts/AuthContext';
import { decodeFhirId } from '../../core/navigation/navigationUtils';
import { useClinicalWorkflow } from '../../contexts/ClinicalWorkflowContext';
import { usePatientCDSAlerts } from '../../contexts/CDSContext';
import TabErrorBoundary from './workspace/TabErrorBoundary';
import { useKeyboardNavigation } from '../../hooks/useKeyboardNavigation';
import KeyboardShortcutsDialog from './shared/dialogs/KeyboardShortcutsDialog';
import CDSPresentation, { PRESENTATION_MODES } from './cds/CDSPresentation';

// Tab Components - Lazy Loaded for Performance with webpack magic comments
// Using optimized/enhanced versions where available
const SummaryTab = React.lazy(() => import(
  /* webpackChunkName: "clinical-summary" */
  './workspace/tabs/SummaryTab'
));
const ChartReviewTab = React.lazy(() => import(
  /* webpackChunkName: "clinical-chart-review" */
  './workspace/tabs/ChartReviewTabOptimized'
));
const EncountersTab = React.lazy(() => import(
  /* webpackChunkName: "clinical-encounters" */
  './workspace/tabs/EncountersTab'
));
const ResultsTab = React.lazy(() => import(
  /* webpackChunkName: "clinical-results" */
  './workspace/tabs/ResultsTabOptimized'
));
const OrdersTab = React.lazy(() => import(
  /* webpackChunkName: "clinical-orders" */
  './workspace/tabs/EnhancedOrdersTab'
));
const PharmacyTab = React.lazy(() => import(
  /* webpackChunkName: "clinical-pharmacy" */
  './workspace/tabs/PharmacyTab'
));
const DocumentationTab = React.lazy(() => import(
  /* webpackChunkName: "clinical-documentation" */
  './workspace/tabs/DocumentationTabEnhanced'
));
const CarePlanTab = React.lazy(() => import(
  /* webpackChunkName: "clinical-care-plan" */
  './workspace/tabs/CarePlanTabEnhanced'
));
const TimelineTab = React.lazy(() => import(
  /* webpackChunkName: "clinical-timeline" */
  './workspace/tabs/TimelineTabEnhanced'
));
const ImagingTab = React.lazy(() => import(
  /* webpackChunkName: "clinical-imaging" */
  './workspace/tabs/ImagingTab'
));

// Tab Loading Component
const TabLoadingFallback = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
    <CircularProgress />
  </Box>
);

// Tab Configuration - matching the sidebar navigation
// Note: Using lazy-loaded optimized components defined above
const TAB_CONFIG = [
  { id: 'summary', label: 'Summary', icon: DashboardIcon, component: SummaryTab },
  { id: 'chart-review', label: 'Chart Review', icon: ChartIcon, component: ChartReviewTab }, // Uses ChartReviewTabOptimized
  { id: 'encounters', label: 'Encounters', icon: EncountersIcon, component: EncountersTab },
  { id: 'results', label: 'Results', icon: ResultsIcon, component: ResultsTab }, // Uses ResultsTabOptimized
  { id: 'orders', label: 'Orders', icon: OrdersIcon, component: OrdersTab }, // Uses EnhancedOrdersTab
  { id: 'pharmacy', label: 'Pharmacy', icon: PharmacyIcon, component: PharmacyTab },
  { id: 'imaging', label: 'Imaging', icon: ImagingIcon, component: ImagingTab },
  { id: 'documentation', label: 'Documentation', icon: DocumentationIcon, component: DocumentationTab }, // Uses DocumentationTabEnhanced
  { id: 'care-plan', label: 'Care Plan', icon: CarePlanIcon, component: CarePlanTab }, // Uses CarePlanTabEnhanced
  { id: 'timeline', label: 'Timeline', icon: TimelineIcon, component: TimelineTab } // Uses TimelineTabEnhanced
];

const ClinicalWorkspaceEnhanced = ({ 
  patient,
  loading: parentLoading,
  patientData,
  isMobile,
  isTablet,
  density = 'comfortable',
  activeModule = 'summary',
  onModuleChange,
  onRefresh,
  error: parentError,
  scrollContainerRef,
  navigationContext = {},
  onNavigateToTab
}) => {
  const theme = useTheme();
  const navigate = useNavigate();
  
  // Route params - still needed for CDS alerts and direct navigation
  const { id: encodedPatientId } = useParams();
  const decodedPatientId = encodedPatientId ? decodeFhirId(encodedPatientId) : null;
  const patientId = patient?.id || decodedPatientId;
  
  // Contexts
  const { currentUser } = useAuth();
  const { publish } = useClinicalWorkflow();
  
  // State
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  
  // Use parent's activeModule directly
  const activeTab = activeModule;
  
  // CDS Alerts
  const { alerts: cdsAlerts } = usePatientCDSAlerts(patientId);

  // Use parent-provided data
  const activePatient = patient;
  const isLoading = parentLoading;
  const loadError = parentError;

  // Get the active tab configuration
  const activeTabConfig = TAB_CONFIG.find(tab => tab.id === activeTab);

  // Handle tab change notification to parent
  const handleTabChange = useCallback((newTab, params = {}) => {
    if (onNavigateToTab) {
      // Use the onNavigateToTab prop from wrapper
      onNavigateToTab(newTab, params);
    } else if (onModuleChange) {
      // Fallback to onModuleChange for backward compatibility
      const tabConfig = TAB_CONFIG.find(t => t.id === newTab);
      if (tabConfig) {
        onModuleChange(newTab);
      }
    }
    
    // Publish tab change event with navigation context
    publish('clinical.tab.changed', {
      tab: newTab,
      patientId: activePatient?.id,
      timestamp: new Date().toISOString(),
      navigationContext: params
    });
  }, [onNavigateToTab, onModuleChange, publish, activePatient?.id]);

  // Handle refresh - delegate to parent
  const handleRefresh = useCallback(async () => {
    if (onRefresh && activePatient) {
      try {
        await onRefresh();
        setSnackbar({ open: true, message: 'Patient data refreshed successfully' });
      } catch (error) {
        setSnackbar({ open: true, message: 'Failed to refresh data' });
      }
    }
  }, [activePatient, onRefresh]);

  // Handle keyboard navigation actions
  const handleKeyboardAction = useCallback((action) => {
    switch (action) {
      case 'new':
        // Context-aware new action - would open appropriate dialog
        publish('clinical.action.new', { tab: activeTab, timestamp: new Date().toISOString() });
        break;
      case 'search':
        // Focus search in current tab
        const searchInput = document.querySelector('input[type="search"], input[placeholder*="Search"]');
        if (searchInput) searchInput.focus();
        break;
      case 'refresh':
        handleRefresh();
        break;
      case 'print':
        // Trigger print in current tab
        publish('clinical.action.print', { tab: activeTab, timestamp: new Date().toISOString() });
        break;
      case 'help':
        setShowKeyboardHelp(true);
        break;
      case 'escape':
        setShowKeyboardHelp(false);
        break;
      default:
        // Unknown action - ignore
        break;
    }
  }, [activeTab, publish, handleRefresh]);

  // Set up keyboard navigation
  useKeyboardNavigation({
    activeTab,
    onTabChange: handleTabChange,
    onAction: handleKeyboardAction,
    onDensityChange: (newDensity) => {
      // This would be handled by parent component if density control is needed
      publish('clinical.view.density_change', { density: newDensity, timestamp: new Date().toISOString() });
    },
    enabled: true
  });

  // Loading state - show spinner while patient is being loaded
  if (isLoading || (!activePatient && patientId)) {
    // If we have a patient ID in the URL but no patient loaded yet, show loading
    if (patientId) {
      return (
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column',
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh',
          gap: 2
        }}>
          <CircularProgress size={48} />
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary">
              Loading Patient Data...
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Patient ID: {patientId}
            </Typography>
          </Box>
        </Box>
      );
    }
    
    // No patient ID provided
    if (!patientId) {
      return (
        <Box sx={{ p: 3 }}>
          <Alert severity="warning">
            <AlertTitle>No Patient ID Provided</AlertTitle>
            Please navigate from the patient list or provide a valid patient ID.
            <Box sx={{ mt: 2 }}>
              <Button 
                variant="contained" 
                onClick={() => navigate('/patients')}
                startIcon={<ChevronLeftIcon />}
              >
                Go to Patient List
              </Button>
            </Box>
          </Alert>
        </Box>
      );
    }
  }

  // Error state
  if (loadError) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          <AlertTitle>Error Loading Patient</AlertTitle>
          {loadError}
          <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
            <Button 
              variant="contained" 
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
            <Button 
              variant="outlined"
              onClick={() => navigate('/patients')}
              startIcon={<ChevronLeftIcon />}
            >
              Back to Patient List
            </Button>
          </Box>
        </Alert>
      </Box>
    );
  }

  // Verify enhanced version is loading - enhanced version with fixes v2
  // activeModule and activeTab should be synchronized

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* CDS Alerts - Clean professional display */}
      {cdsAlerts && cdsAlerts.length > 0 && (
        <Box sx={{ 
          px: 2, 
          pt: 2,
          pb: 0,
          backgroundColor: theme.palette.background.default
        }}>
          <CDSPresentation
            alerts={cdsAlerts}
            mode={PRESENTATION_MODES.INLINE}
            patientId={patientId}
            maxAlerts={3}
            allowInteraction={true}
            onAlertAction={(alertId, action, data) => {
              console.log('CDS Alert Action:', { alertId, action, data });
              // Alert has been dismissed/snoozed, persistence is handled by CDSPresentation
              if (action === 'dismiss' || action === 'snooze') {
                // Optionally refresh alerts or update local state
              }
            }}
          />
        </Box>
      )}
      
      {/* Tab Content - no extra spacing */}
      <Box 
        sx={{ flex: 1, overflow: 'auto', pt: 0 }}
        role="main"
        tabIndex={-1}
        aria-label={`${activeTabConfig?.label || 'Clinical'} content`}
      >
        <TabErrorBoundary onReset={handleRefresh}>
          <Suspense fallback={<TabLoadingFallback />}>
            {(() => {
              // Only render the active tab component for better performance
              const activeTabConfig = TAB_CONFIG.find(tab => tab.id === activeTab);
              if (!activeTabConfig) return null;
              
              const TabComponent = activeTabConfig.component;
              
              return (
                <Box
                  key={activeTabConfig.id}
                  sx={{
                    height: '100%'
                  }}
                >
                  <TabComponent
                    patientId={activePatient.id}
                    patient={activePatient}
                    patientData={patientData}
                    density={density}
                    isMobile={isMobile}
                    isTablet={isTablet}
                    onRefresh={handleRefresh}
                    onNavigateToTab={handleTabChange}
                    department={currentUser?.department || 'general'}
                    scrollContainerRef={scrollContainerRef}
                    navigationContext={navigationContext}
                  />
                </Box>
              );
            })()}
          </Suspense>
        </TabErrorBoundary>
      </Box>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ open: false, message: '' })}
        message={snackbar.message}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
      
      {/* Keyboard shortcuts help dialog */}
      <KeyboardShortcutsDialog
        open={showKeyboardHelp}
        onClose={() => setShowKeyboardHelp(false)}
      />
    </Box>
  );
};

export default ClinicalWorkspaceEnhanced;