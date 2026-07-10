/**
 * ClinicalWorkspaceEnhanced Component
 * Enhanced version of ClinicalWorkspaceV3 that works with the new navigation system
 * Removes duplicate headers and integrates with EnhancedClinicalLayout
 */
import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  CircularProgress,
  Alert,
  AlertTitle,
  Button,
  Typography
} from '@mui/material';
import {
  ChevronLeft as ChevronLeftIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';

// Contexts
import { useAuth } from '../../contexts/AuthContext';
import { decodeFhirId } from '../../core/navigation/navigationUtils';
import { useClinicalWorkflow } from '../../contexts/ClinicalWorkflowContext';
import { usePatientCDSAlerts } from '../../contexts/CDSHooksContext';
import TabErrorBoundary from './workspace/TabErrorBoundary';
import { useKeyboardNavigation } from '../../hooks/useKeyboardNavigation';
import KeyboardShortcutsDialog from './shared/dialogs/KeyboardShortcutsDialog';
import CDSPresentation, { PRESENTATION_MODES } from './cds/CDSPresentation';
import { buildTabContentConfig } from './workspace/clinicalTabRegistry';

// Tab Loading Component
const TabLoadingFallback = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
    <CircularProgress />
  </Box>
);

// Tab content config — lazy-loaded components, ordered by the single
// source of truth in `clinicalTabRegistry`. Adding a tab is one entry
// there; this file picks it up automatically.
const TAB_CONFIG = buildTabContentConfig();

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
  const navigate = useNavigate();
  
  // Route params - still needed for CDS alerts and direct navigation
  const { id: encodedPatientId } = useParams();
  const decodedPatientId = encodedPatientId ? decodeFhirId(encodedPatientId) : null;
  const patientId = patient?.id || decodedPatientId;
  
  // Contexts
  const { currentUser } = useAuth();
  const { publish } = useClinicalWorkflow();
  
  // State
  const { enqueueSnackbar } = useSnackbar();
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  
  // Use parent's activeModule directly
  const activeTab = activeModule;

  // Retain visited tabs mounted-but-hidden (R29). Switching tabs within the
  // same patient must NOT remount previously-visited tabs — their filters,
  // pagination and scroll position must survive leaving and returning. We
  // track which tabs have been activated and keep them mounted, toggling
  // visibility with CSS `display` instead of unmounting. Tabs still lazy-load
  // on FIRST activation (never all at once on patient open), preserving the
  // lazy-chunk win from #200. The whole component remounts on patient change
  // (its parent, EnhancedClinicalLayout, keys the content container by patient
  // id), which re-runs this initializer — so visited state never leaks across
  // patients.
  const [visitedTabs, setVisitedTabs] = useState(() => new Set([activeTab]));
  useEffect(() => {
    setVisitedTabs(prev => (prev.has(activeTab) ? prev : new Set(prev).add(activeTab)));
  }, [activeTab]);

  // CDS Alerts — show dialog once per patient, then stay dismissed after close
  const { alerts: cdsAlerts } = usePatientCDSAlerts(patientId);
  const [cdsDialogDismissed, setCdsDialogDismissed] = useState(false);
  const prevPatientRef = React.useRef(patientId);

  // Reset dismissed state when patient changes
  React.useEffect(() => {
    if (patientId !== prevPatientRef.current) {
      prevPatientRef.current = patientId;
      setCdsDialogDismissed(false);
    }
  }, [patientId]);

  // Use parent-provided data
  const activePatient = patient;
  const isLoading = parentLoading;
  const loadError = parentError;

  // Enable FHIR debug mode
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      window.__FHIR_DEBUG__ = true;
      console.log('[ClinicalWorkspace] FHIR Debug mode enabled');
    }
  }, []);

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
        enqueueSnackbar('Patient data refreshed successfully', { variant: 'success' });
      } catch (error) {
        enqueueSnackbar('Failed to refresh data', { variant: 'error' });
      }
    }
  }, [activePatient, onRefresh, enqueueSnackbar]);

  // Handle keyboard navigation actions
  const handleKeyboardAction = useCallback((action) => {
    switch (action) {
      case 'new':
        // Context-aware new action - would open appropriate dialog
        publish('clinical.action.new', { tab: activeTab, timestamp: new Date().toISOString() });
        break;
      case 'search':
        // Focus search in the ACTIVE tab. Inactive tabs stay mounted-but-hidden
        // (R29), so scope the query to the active tab's container — an unscoped
        // query could grab a hidden tab's search box.
        const searchInput = document.querySelector(
          '[data-tab-active="true"] input[type="search"], [data-tab-active="true"] input[placeholder*="Search"]'
        );
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
          height: '100%',
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
      {/* CDS Alerts — group by each alert's configured presentation mode
          and render one CDSPresentation per mode. Previously this was
          hardcoded to POPUP, which silently ignored every service's
          displayBehavior config and made the wizard's Display Mode picker
          a no-op. Each alert's `displayBehavior.presentationMode` comes
          from CDSContext (set when the alert is created from the hook
          response, based on hookConfigurations). Falls back to POPUP for
          alerts that didn't get a mode assigned. */}
      {cdsAlerts && cdsAlerts.length > 0 && !cdsDialogDismissed && (() => {
        const alertsByMode = {};
        cdsAlerts.forEach(alert => {
          const mode = alert.displayBehavior?.presentationMode || PRESENTATION_MODES.POPUP;
          if (!alertsByMode[mode]) alertsByMode[mode] = [];
          alertsByMode[mode].push(alert);
        });
        return Object.entries(alertsByMode).map(([mode, alerts]) => (
          <CDSPresentation
            key={mode}
            alerts={alerts}
            mode={mode}
            patientId={patientId}
            allowInteraction={true}
            onAlertAction={(alertId, action, data) => {
              if (action === 'dismiss' || action === 'close') {
                // Close the popup-style host once user dismisses; other
                // modes (sidebar/banner/toast) stay independent.
                if (mode === PRESENTATION_MODES.POPUP || mode === PRESENTATION_MODES.MODAL) {
                  setCdsDialogDismissed(true);
                }
              }
            }}
            onClose={() => {
              if (mode === PRESENTATION_MODES.POPUP || mode === PRESENTATION_MODES.MODAL) {
                setCdsDialogDismissed(true);
              }
            }}
          />
        ));
      })()}
      
      {/* Tab Content - no extra spacing */}
      <Box 
        sx={{ flex: 1, overflow: 'auto', pt: 0 }}
        role="main"
        tabIndex={-1}
        aria-label={`${activeTabConfig?.label || 'Clinical'} content`}
      >
        <TabErrorBoundary onReset={handleRefresh}>
          {/* Render every VISITED tab (plus the current one), keeping them all
              mounted and toggling visibility with `display`. Only-active would
              remount on each switch and reset the tab's state; rendering the
              full registry eagerly would defeat lazy loading. Gating on
              `visitedTabs` gives us both: a tab's chunk loads (via its own
              Suspense boundary) on first activation, then stays mounted.
              List key is the stable tab id — patient scoping lives entirely on
              the parent's `key={patientId}`, so no patient id is needed here. */}
          {activePatient && TAB_CONFIG
            .filter(tab => tab.id === activeTab || visitedTabs.has(tab.id))
            .map(tab => {
              const TabComponent = tab.component;
              const isActive = tab.id === activeTab;
              return (
                <Box
                  key={tab.id}
                  data-tab-active={isActive ? 'true' : undefined}
                  sx={{
                    height: '100%',
                    display: isActive ? 'block' : 'none'
                  }}
                >
                  <Suspense fallback={<TabLoadingFallback />}>
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
                  </Suspense>
                </Box>
              );
            })}
        </TabErrorBoundary>
      </Box>

      {/* Keyboard shortcuts help dialog */}
      <KeyboardShortcutsDialog
        open={showKeyboardHelp}
        onClose={() => setShowKeyboardHelp(false)}
      />
    </Box>
  );
};

export default ClinicalWorkspaceEnhanced;