/**
 * ClinicalWorkspaceEnhanced Component
 * Enhanced version of ClinicalWorkspaceV3 that works with the new navigation system
 * Removes duplicate headers and integrates with EnhancedClinicalLayout
 */
import React, { useState, useEffect, useCallback, Suspense, useMemo } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Stack,
  CircularProgress,
  Alert,
  AlertTitle,
  Button,
  Typography,
  useTheme,
  useMediaQuery,
  Snackbar,
  Chip,
  alpha
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
  Image as ImagingIcon
} from '@mui/icons-material';

// Contexts
import { useFHIRResource } from '../../contexts/FHIRResourceContext';
import { useAuth } from '../../contexts/AuthContext';
import { decodeFhirId } from '../../core/navigation/navigationUtils';
import { useClinicalWorkflow } from '../../contexts/ClinicalWorkflowContext';
import TabErrorBoundary from './workspace/TabErrorBoundary';
import { useKeyboardNavigation } from '../../hooks/useKeyboardNavigation';
import KeyboardShortcutsDialog from './ui/KeyboardShortcutsDialog';

// Tab Components - Lazy Loaded for Performance
// Using optimized/enhanced versions where available
const SummaryTab = React.lazy(() => import('./workspace/tabs/SummaryTab'));
const ChartReviewTab = React.lazy(() => import('./workspace/tabs/ChartReviewTabOptimized'));
const EncountersTab = React.lazy(() => import('./workspace/tabs/EncountersTab'));
const ResultsTab = React.lazy(() => import('./workspace/tabs/ResultsTabOptimized'));
const OrdersTab = React.lazy(() => import('./workspace/tabs/EnhancedOrdersTab'));
const PharmacyTab = React.lazy(() => import('./workspace/tabs/PharmacyTab'));
const DocumentationTab = React.lazy(() => import('./workspace/tabs/DocumentationTabEnhanced'));
const CarePlanTab = React.lazy(() => import('./workspace/tabs/CarePlanTabEnhanced'));
const TimelineTab = React.lazy(() => import('./workspace/tabs/TimelineTabEnhanced'));
const ImagingTab = React.lazy(() => import('./workspace/tabs/ImagingTab'));

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
  onModuleChange
}) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Route params
  const { id: encodedPatientId } = useParams();
  const patientId = decodeFhirId(encodedPatientId).toLowerCase();
  
  // Contexts
  const { currentUser } = useAuth();
  const { publish } = useClinicalWorkflow();
  const { 
    currentPatient, 
    setCurrentPatient, 
    isLoading: isGlobalLoading
  } = useFHIRResource();
  
  // State
  const [loadError, setLoadError] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  
  // Use parent's activeModule directly instead of maintaining separate state
  const activeTab = activeModule;

  // Load patient data if not provided by parent
  useEffect(() => {
    const loadPatient = async () => {
      if (!patient && patientId && (!currentPatient || currentPatient.id !== patientId)) {
        try {
          setLoadError(null);
          await setCurrentPatient(patientId);
        } catch (error) {
          setLoadError(error.message || 'Failed to load patient');
        }
      }
    };
    
    if (!patient) {
      loadPatient();
    }
  }, [patientId, patient, currentPatient?.id, setCurrentPatient]);

  // Use provided patient or fallback to context patient
  const activePatient = patient || currentPatient;
  const isLoading = parentLoading || isGlobalLoading;

  // Get the active tab configuration
  const activeTabConfig = TAB_CONFIG.find(tab => tab.id === activeTab);

  // Handle tab change notification to parent
  const handleTabChange = useCallback((newTab) => {
    if (onModuleChange) {
      // Find the tab config
      const tabConfig = TAB_CONFIG.find(t => t.id === newTab);
      if (tabConfig) {
        // Call parent's onModuleChange with the tab id (not index)
        onModuleChange(newTab);
      }
    }
    
    // Publish tab change event
    publish('clinical.tab.changed', {
      tab: newTab,
      patientId: activePatient?.id,
      timestamp: new Date().toISOString()
    });
  }, [onModuleChange, publish, activePatient?.id]);

  // Handle refresh
  const handleRefresh = async () => {
    if (activePatient) {
      try {
        await setCurrentPatient(patientId);
        setSnackbar({ open: true, message: 'Patient data refreshed successfully' });
      } catch (error) {
        setSnackbar({ open: true, message: 'Failed to refresh data' });
      }
    }
  };

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
    }
  }, [activeTab, publish, handleRefresh]);

  // Set up keyboard navigation
  const { shortcuts } = useKeyboardNavigation({
    activeTab,
    onTabChange: handleTabChange,
    onAction: handleKeyboardAction,
    onDensityChange: (newDensity) => {
      // This would be handled by parent component if density control is needed
      publish('clinical.view.density_change', { density: newDensity, timestamp: new Date().toISOString() });
    },
    enabled: true
  });

  // Loading state
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  // Error state
  if (loadError) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          <AlertTitle>Error Loading Patient</AlertTitle>
          {loadError}
          <Box sx={{ mt: 2 }}>
            <Button onClick={() => window.location.reload()}>
              Reload Page
            </Button>
          </Box>
        </Alert>
      </Box>
    );
  }

  // No patient state
  if (!activePatient) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">
          <AlertTitle>No Patient Selected</AlertTitle>
          Please select a patient from the patient list.
          <Box sx={{ mt: 2 }}>
            <Button onClick={() => navigate('/patients')}>
              Go to Patient List
            </Button>
          </Box>
        </Alert>
      </Box>
    );
  }

  // Add console log to verify enhanced version is loading
  console.log('ClinicalWorkspaceEnhanced: Loading - this is the enhanced version');
  console.log('ClinicalWorkspaceEnhanced: activeModule =', activeModule, 'activeTab =', activeTab);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Enhanced Version Indicator - Remove after verification */}
      <Box 
        sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          p: 1,
          backgroundColor: alpha(theme.palette.success.main, 0.1),
          borderBottom: 1,
          borderColor: 'divider'
        }}
      >
        <Chip 
          label="Enhanced Clinical Workspace v2 - Different from V3" 
          color="success" 
          size="small"
          sx={{ fontWeight: 600 }}
        />
      </Box>
      
      {/* Tab Content - no extra spacing */}
      <Box 
        sx={{ flex: 1, overflow: 'auto', pt: 0 }}
        role="main"
        tabIndex={-1}
        aria-label={`${activeTabConfig?.label || 'Clinical'} content`}
      >
        <TabErrorBoundary onReset={handleRefresh}>
          <Suspense fallback={<TabLoadingFallback />}>
            {TAB_CONFIG.map((tab) => {
              const TabComponent = tab.component;
              const isActive = activeTab === tab.id;
              
              // Only render active tab to improve performance
              if (!isActive) return null;
              
              console.log(`Rendering tab: ${tab.id}, Component name: ${TabComponent.name || 'Unknown'}, Active: ${isActive}, TabComponent:`, TabComponent);
              
              return (
                <Box
                  key={tab.id}
                  sx={{
                    display: isActive ? 'block' : 'none',
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
                  />
                </Box>
              );
            })}
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