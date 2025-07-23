/**
 * EnhancedClinicalLayout Component
 * Improved clinical workspace layout with integrated navigation
 * Now uses horizontal tab navigation matching older design
 */
import React, { useState, useContext } from 'react';
import {
  Box,
  useTheme,
  useMediaQuery,
  CssBaseline,
  Drawer,
  IconButton
} from '@mui/material';
import { Menu as MenuIcon } from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import ClinicalAppBar from '../navigation/ClinicalAppBar';
import ClinicalTabs from '../navigation/ClinicalTabs';
import ClinicalBreadcrumbs from '../navigation/ClinicalBreadcrumbs';
import EnhancedPatientHeaderV2 from '../workspace/EnhancedPatientHeaderV2';
import { useClinicalWorkflow } from '../../../contexts/ClinicalWorkflowContext';
import { useAuth } from '../../../contexts/AuthContext';
import { usePatientData } from '../../../hooks/usePatientData';
import { useResponsive } from '../../../hooks/useResponsive';
import { MedicalThemeContext } from '../../../App';

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
  department = 'Emergency',
  shift = 'Day'
}) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { patientId } = useParams();
  const { user } = useAuth();
  const { currentMode, onModeChange } = React.useContext(MedicalThemeContext);
  const isDarkMode = currentMode === 'dark';
  const toggleTheme = () => onModeChange(isDarkMode ? 'light' : 'dark');
  const { isMobile, isTablet, isDesktop, patterns } = useResponsive();
  
  const [bookmarked, setBookmarked] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  
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
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <CssBaseline />
      
      {/* App Bar */}
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
      
      {/* Breadcrumbs - hide on mobile */}
      {!isMobile && (
        <ClinicalBreadcrumbs
          patient={patient}
          activeModule={MODULES[activeModule]}
          subContext={subContext}
          onBookmark={handleBookmark}
          bookmarked={bookmarked}
        />
      )}
      
      {/* Enhanced Patient Header - responsive sizing */}
      {patient && (
        <Box sx={{ px: { xs: 1, sm: 2, md: 3 } }}>
          <EnhancedPatientHeaderV2
            patientId={patient.id}
            onPrint={() => window.print()}
            onNavigateToTab={handleModuleChange}
            dataLoading={loading}
          />
        </Box>
      )}
      
      {/* Tab Navigation - horizontal scrollable on mobile */}
      <Box sx={{ 
        borderBottom: 1, 
        borderColor: 'divider',
        position: 'sticky',
        top: { xs: 56, sm: 64 }, // Account for app bar height
        backgroundColor: 'background.paper',
        zIndex: theme.zIndex.appBar - 1,
      }}>
        <ClinicalTabs
          activeTab={activeModule}
          onTabChange={handleModuleChange}
          variant={isMobile ? "scrollable" : "fullWidth"}
          scrollButtons={isMobile ? "auto" : false}
          showIcons={!isMobile}
        />
      </Box>
      
      {/* Main Layout Container */}
      <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        
        {/* Main Content Area */}
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          
          {/* Content Area - responsive padding */}
          <Box
            sx={{
              flexGrow: 1,
              overflow: 'auto',
              backgroundColor: theme.palette.mode === 'dark' 
                ? theme.palette.background.default 
                : theme.palette.grey[50], // Clean light gray background
              p: {
                xs: 1,      // 8px on mobile
                sm: 2,      // 16px on tablet
                md: 3,      // 24px on desktop
              },
              minHeight: 0, // Important for flexbox overflow to work properly
            }}
          >
            {/* Pass enhanced props to children */}
            {React.cloneElement(children, {
              patient,
              loading,
              patientData: {
                conditions,
                medications,
                allergies,
                vitals,
                lastEncounter,
                // Additional computed data from hook
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
              error
            })}
          </Box>
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