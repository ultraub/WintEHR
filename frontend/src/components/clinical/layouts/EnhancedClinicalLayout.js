/**
 * EnhancedClinicalLayout Component
 * Improved clinical workspace layout with integrated navigation
 * Now uses horizontal tab navigation matching older design
 */
import React from 'react';
import {
  Box,
  useTheme,
  CssBaseline
} from '@mui/material';
import { useParams } from 'react-router-dom';
import ClinicalTabs from '../navigation/ClinicalTabs';
import CollapsiblePatientHeaderOptimized from '../workspace/CollapsiblePatientHeaderOptimized';
import { useClinicalWorkflow } from '../../../contexts/ClinicalWorkflowContext';
import { usePatientData } from '../../../hooks/usePatientData';
import { useResponsive } from '../../../hooks/useResponsive';
import { Z_INDEX } from '../theme/clinicalThemeConstants';
import { decodeFhirId } from '../../../core/navigation/navigationUtils';

const EnhancedClinicalLayout = ({
  children,
  activeModule = 'summary',
  onModuleChange,
  subContext = null,
  department = 'Clinic',
  shift = 'Day',
  navigationContext = {}
}) => {
  const theme = useTheme();
  // Route param is URL-encoded; an un-decoded id creates a second patient
  // compartment in the FHIR cache (split-brain with pages that decode).
  const { id: rawPatientId } = useParams();
  const patientId = rawPatientId ? decodeFhirId(rawPatientId).toLowerCase() : rawPatientId;
  const { isMobile, isTablet, isDesktop } = useResponsive();
  
  // The element that actually scrolls is the app shell's content box, an
  // ancestor of this layout. The patient header collapses as it scrolls, and
  // it was listening on this layout's own <main>, which never scrolls, so the
  // header never collapsed. Resolved in a layout effect so it is set before
  // the header's own (passive) effect attaches its listener.
  const mainRef = React.useRef(null);
  const scrollContainerRef = React.useRef(null);
  React.useLayoutEffect(() => {
    let node = mainRef.current?.parentElement;
    while (node && node !== document.body) {
      const overflowY = window.getComputedStyle(node).overflowY;
      if (overflowY === 'auto' || overflowY === 'scroll') break;
      node = node.parentElement;
    }
    scrollContainerRef.current = node && node !== document.body ? node : null;
  }, []);
  
  const { publish } = useClinicalWorkflow();
  
  // Use the centralized patient data hook
  const {
    patient,
    loading,
    conditions,
    medications,
    allergies,
    vitals,
    lastEncounter,
    activeConditions,
    activeMedications,
    criticalAllergies,
    latestVitals,
    encounterCount,
    conditionCount,
    medicationCount,
    allergyCount,
    error,
    refreshPatientData
  } = usePatientData(patientId);

  // Handle module navigation
  const handleModuleChange = (moduleId) => {
    if (onModuleChange) {
      onModuleChange(moduleId);
      // Back to the top of the new tab. The shell's content box scrolls, not
      // the window, so window.scrollTo did nothing here.
      (scrollContainerRef.current || window).scrollTo({ top: 0 });

      // Publish navigation event
      publish('navigation.module.changed', {
        module: moduleId,
        patientId,
        timestamp: new Date().toISOString()
      });
    }
  };

  return (
    <Box sx={{ minHeight: '100%' }}>
      <CssBaseline />

      {/* The app shell (LayoutV3, rail mode) supplies the app bar, navigation
          and account menu. There is no breadcrumb: the patient header
          directly below already names the patient. */}
      {/* Main content — natural page scroll, no overflow constraints */}
      <Box
        component="main"
        ref={mainRef}
        sx={{
          backgroundColor: theme.palette.mode === 'dark'
            ? theme.palette.background.default
            : theme.palette.grey[50],
          backgroundImage: theme.palette.mode === 'dark'
            ? 'linear-gradient(180deg, rgba(99,102,241,0.14) 0%, rgba(99,102,241,0.05) 200px, transparent 500px)'
            : 'linear-gradient(180deg, rgba(99,102,241,0.10) 0%, rgba(99,102,241,0.03) 200px, transparent 500px)',
          minHeight: '100%',
        }}
      >
        {/* Sticky combined header: patient info + tabs stick together below the fixed AppBar */}
        {(patient || loading) && (
          <Box sx={{
            position: 'sticky',
            // The shell's content area is the scroll container, so the header
            // sticks to its top edge.
            top: 0,
            zIndex: Z_INDEX.appBar - 1,
            backgroundColor: theme.palette.mode === 'dark'
              ? 'rgba(30, 41, 59, 0.88)'
              : 'rgba(255, 255, 255, 0.82)',
            backdropFilter: 'saturate(180%) blur(20px)',
            WebkitBackdropFilter: 'saturate(180%) blur(20px)',
          }}>
            <CollapsiblePatientHeaderOptimized
              patientId={patient?.id || patientId}
              onPrint={() => window.print()}
              onNavigateToTab={handleModuleChange}
              dataLoading={loading}
              scrollContainerRef={scrollContainerRef}
            />
            <ClinicalTabs
              activeTab={activeModule}
              onTabChange={handleModuleChange}
              variant={isMobile ? "scrollable" : "fullWidth"}
              scrollButtons={isMobile ? "auto" : false}
              showIcons={!isMobile}
            />
          </Box>
        )}

        {/* Tab content — renders at natural height, page scrolls.
            Keyed by patient, NOT by tab (R29): switching tabs must keep the
            workspace and every visited tab's state mounted, while switching
            patients must remount everything for a clean reset. The route
            param `:id` changes without unmounting this layout, so this key
            is the single boundary that forces the per-patient reset —
            ClinicalWorkspaceEnhanced no longer keys tab content itself. */}
        <Box
          key={patientId}
          sx={{
            p: {
              xs: 1,
              sm: 2,
              md: 3,
            },
            animation: 'fadeIn 150ms cubic-bezier(0.2, 0.8, 0.2, 1)',
            '@keyframes fadeIn': {
              '0%': { opacity: 0, transform: 'translateY(4px)' },
              '100%': { opacity: 1, transform: 'translateY(0)' }
            }
          }}
        >
          {React.cloneElement(children, {
            patient,
            loading,
            patientData: {
              conditions,
              medications,
              allergies,
              vitals,
              lastEncounter,
              activeConditions,
              activeMedications,
              criticalAllergies,
              latestVitals,
              encounterCount,
              conditionCount,
              medicationCount,
              allergyCount
            },
            isMobile,
            isTablet,
            isDesktop,
            density: isMobile ? 'compact' : isTablet ? 'comfortable' : 'comfortable',
            activeModule,
            onModuleChange: handleModuleChange,
            onRefresh: refreshPatientData,
            error,
            scrollContainerRef
          })}
        </Box>
      </Box>
    </Box>
  );
};

export default EnhancedClinicalLayout;