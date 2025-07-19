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
  Snackbar
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

// Tab Loading Component
const TabLoadingFallback = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
    <CircularProgress />
  </Box>
);

// Tab Configuration - matching the sidebar navigation
const TAB_CONFIG = [
  { id: 'summary', label: 'Summary', icon: DashboardIcon, component: SummaryTab },
  { id: 'chart', label: 'Chart Review', icon: ChartIcon, component: ChartReviewTab },
  { id: 'encounters', label: 'Encounters', icon: EncountersIcon, component: EncountersTab },
  { id: 'results', label: 'Results', icon: ResultsIcon, component: ResultsTab },
  { id: 'orders', label: 'Orders', icon: OrdersIcon, component: OrdersTab },
  { id: 'pharmacy', label: 'Pharmacy', icon: PharmacyIcon, component: PharmacyTab },
  { id: 'imaging', label: 'Imaging', icon: ImagingIcon, component: ImagingTab },
  { id: 'documentation', label: 'Documentation', icon: DocumentationIcon, component: DocumentationTab },
  { id: 'care-plan', label: 'Care Plan', icon: CarePlanIcon, component: CarePlanTab },
  { id: 'timeline', label: 'Timeline', icon: TimelineIcon, component: TimelineTab }
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
  const [activeTab, setActiveTab] = useState(activeModule);
  const [loadError, setLoadError] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });

  // Sync active tab with parent module
  useEffect(() => {
    const tab = TAB_CONFIG.find(t => t.id === activeModule);
    if (tab) {
      setActiveTab(activeModule);
    }
  }, [activeModule]);

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
    setActiveTab(newTab);
    if (onModuleChange) {
      const tabIndex = TAB_CONFIG.findIndex(t => t.id === newTab);
      onModuleChange(tabIndex);
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

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Tab Content */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        <Suspense fallback={<TabLoadingFallback />}>
          {TAB_CONFIG.map((tab) => {
            const TabComponent = tab.component;
            const isActive = activeTab === tab.id;
            
            // Only render active tab to improve performance
            if (!isActive) return null;
            
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
                />
              </Box>
            );
          })}
        </Suspense>
      </Box>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ open: false, message: '' })}
        message={snackbar.message}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
};

export default ClinicalWorkspaceEnhanced;