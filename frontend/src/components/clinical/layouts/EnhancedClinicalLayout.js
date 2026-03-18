/**
 * EnhancedClinicalLayout Component
 * Improved clinical workspace layout with integrated navigation
 * Now uses horizontal tab navigation matching older design
 */
import React, { useState } from 'react';
import {
  Box,
  useTheme,
  CssBaseline,
  Drawer
} from '@mui/material';
import { useParams } from 'react-router-dom';
import ClinicalAppBar from '../navigation/ClinicalAppBar';
import ClinicalTabs from '../navigation/ClinicalTabs';
import ClinicalBreadcrumbs from '../navigation/ClinicalBreadcrumbs';
import CollapsiblePatientHeaderOptimized from '../workspace/CollapsiblePatientHeaderOptimized';
import { useClinicalWorkflow } from '../../../contexts/ClinicalWorkflowContext';
import { useAuth } from '../../../contexts/AuthContext';
import { usePatientData } from '../../../hooks/usePatientData';
import { useResponsive } from '../../../hooks/useResponsive';
import { MedicalThemeContext } from '../../../App';
import { LAYOUT_HEIGHTS, Z_INDEX } from '../theme/clinicalThemeConstants';

// Module configuration
const MODULES = {
  summary: { id: 'summary', label: 'Summary', index: 0 },
  'chart-review': { id: 'chart-review', label: 'Chart Review', index: 1 },
  encounters: { id: 'encounters', label: 'Encounters', index: 2 },
  results: { id: 'results', label: 'Results', index: 3 },
  orders: { id: 'orders', label: 'Orders', index: 4 },
  pharmacy: { id: 'pharmacy', label: 'Pharmacy', index: 5 },
  imaging: { id: 'imaging', label: 'Imaging', index: 6 },
  documentation: { id: 'documentation', label: 'Documentation', index: 7 },
  'care-plan': { id: 'care-plan', label: 'Care Plan', index: 8 },
  timeline: { id: 'timeline', label: 'Timeline', index: 9 }
};

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
  const { id: patientId } = useParams();
  const { user } = useAuth();
  const { currentMode, onModeChange } = React.useContext(MedicalThemeContext);
  const isDarkMode = currentMode === 'dark';
  const toggleTheme = () => onModeChange(isDarkMode ? 'light' : 'dark');
  const { isMobile, isTablet, isDesktop } = useResponsive();
  
  const [bookmarked, setBookmarked] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const scrollContainerRef = React.useRef(null);
  
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

  // Handle menu toggle for mobile drawer
  const handleMenuToggle = () => {
    setMobileDrawerOpen(!mobileDrawerOpen);
  };

  // Handle module navigation
  const handleModuleChange = (moduleId) => {
    if (onModuleChange) {
      onModuleChange(moduleId);
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // Publish navigation event
      publish('navigation.module.changed', {
        module: moduleId,
        patientId,
        timestamp: new Date().toISOString()
      });
    }
  };

  // Handle bookmark
  const handleBookmark = () => {
    setBookmarked(!bookmarked);
    // Would save to user preferences
  };

  return (
    <Box sx={{ minHeight: '100vh' }}>
      <CssBaseline />

      {/* Fixed AppBar */}
      <ClinicalAppBar
        onMenuToggle={handleMenuToggle}
        onThemeToggle={toggleTheme}
        isDarkMode={isDarkMode}
        patient={patient}
        loading={loading}
        user={user}
        department={department}
        shift={shift}
      />

      {/* Spacer that pushes content below the fixed AppBar */}
      <Box sx={{ height: LAYOUT_HEIGHTS.appBar }} />

      {/* Breadcrumbs - in normal flow, scrolls away naturally */}
      {!isMobile && (
        <ClinicalBreadcrumbs
          patient={patient}
          activeModule={MODULES[activeModule]}
          subContext={subContext}
          onBookmark={handleBookmark}
          bookmarked={bookmarked}
          navigationContext={navigationContext}
        />
      )}

      {/* Main content — natural page scroll, no overflow constraints */}
      <Box
        component="main"
        ref={scrollContainerRef}
        sx={{
          backgroundColor: theme.palette.mode === 'dark'
            ? theme.palette.background.default
            : theme.palette.grey[50],
          backgroundImage: theme.palette.mode === 'dark'
            ? 'linear-gradient(180deg, rgba(99,102,241,0.14) 0%, rgba(99,102,241,0.05) 200px, transparent 500px)'
            : 'linear-gradient(180deg, rgba(99,102,241,0.10) 0%, rgba(99,102,241,0.03) 200px, transparent 500px)',
          minHeight: `calc(100vh - ${LAYOUT_HEIGHTS.appBar}px)`,
        }}
      >
        {/* Sticky combined header: patient info + tabs stick together below the fixed AppBar */}
        {(patient || loading) && (
          <Box sx={{
            position: 'sticky',
            top: LAYOUT_HEIGHTS.appBar,
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

        {/* Tab content — renders at natural height, page scrolls */}
        <Box
          key={activeModule}
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

      {/* Mobile Navigation Drawer */}
      {isMobile && (
        <Drawer
          anchor="bottom"
          open={mobileDrawerOpen}
          onClose={() => setMobileDrawerOpen(false)}
          sx={{
            '& .MuiDrawer-paper': {
              maxHeight: '60vh',
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
            },
          }}
        >
          <Box sx={{ p: 2 }}>
            <Box sx={{
              width: 40,
              height: 4,
              backgroundColor: 'grey.300',
              borderRadius: 2,
              mx: 'auto',
              mb: 2
            }} />
            <ClinicalTabs
              activeTab={activeModule}
              onTabChange={(moduleId) => {
                handleModuleChange(moduleId);
                setMobileDrawerOpen(false);
              }}
              variant="fullWidth"
              orientation="vertical"
              showIcons={true}
            />
          </Box>
        </Drawer>
      )}
    </Box>
  );
};

export default EnhancedClinicalLayout;