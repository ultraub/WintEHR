/**
 * EnhancedClinicalLayout Component
 * Improved clinical workspace layout with integrated navigation
 * Consolidates multiple layout components and removes duplication
 */
import React, { useState, useContext, useEffect } from 'react';
import {
  Box,
  useTheme,
  useMediaQuery,
  CssBaseline
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import ClinicalAppBar from '../navigation/ClinicalAppBar';
import ClinicalSidebar from '../navigation/ClinicalSidebar';
import ClinicalBreadcrumbs from '../navigation/ClinicalBreadcrumbs';
import CompactPatientHeader from '../ui/CompactPatientHeader';
import { useClinicalWorkflow } from '../../../contexts/ClinicalWorkflowContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useFHIRResource } from '../../../contexts/FHIRResourceContext';

// Module configuration
const MODULES = {
  summary: { id: 'summary', label: 'Summary', index: 0 },
  chart: { id: 'chart', label: 'Chart Review', index: 1 },
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
  const { user, isDarkMode, toggleTheme } = useAuth();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.down('lg'));
  
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Sync sidebar state when transitioning between mobile and desktop
  useEffect(() => {
    if (!isMobile) {
      // When switching to desktop, always show sidebar
      setSidebarOpen(true);
    }
    // When switching to mobile, sidebar starts closed (handled by default state)
  }, [isMobile]);
  const [patientData, setPatientData] = useState({
    conditions: [],
    medications: [],
    allergies: [],
    vitals: {},
    lastEncounter: null
  });
  const [bookmarked, setBookmarked] = useState(false);
  
  const { publish } = useClinicalWorkflow();
  const { 
    currentPatient,
    setCurrentPatient,
    getResourcesByType,
    isLoading: fhirLoading
  } = useFHIRResource();

  // Load patient data through context
  useEffect(() => {
    if (patientId && (!currentPatient || currentPatient.id !== patientId)) {
      setCurrentPatient(patientId);
    }
  }, [patientId, currentPatient, setCurrentPatient]);

  // Update local state when patient changes
  useEffect(() => {
    if (currentPatient) {
      setPatient(currentPatient);
      
      // Get resources from context
      const conditions = getResourcesByType('Condition') || [];
      const medications = getResourcesByType('MedicationRequest') || [];
      const allergies = getResourcesByType('AllergyIntolerance') || [];
      const encounters = getResourcesByType('Encounter') || [];
      
      // Sort encounters by date
      const sortedEncounters = [...encounters].sort((a, b) => {
        const dateA = a.period?.start ? new Date(a.period.start) : new Date(0);
        const dateB = b.period?.start ? new Date(b.period.start) : new Date(0);
        return dateB - dateA;
      });
      
      setPatientData({
        conditions,
        medications,
        allergies,
        vitals: {}, // Would be extracted from Observations
        lastEncounter: sortedEncounters[0] || null
      });
    }
  }, [currentPatient, getResourcesByType]);

  // Combined loading state
  useEffect(() => {
    setLoading(fhirLoading);
  }, [fhirLoading]);

  // Handle sidebar toggle
  const handleSidebarToggle = () => {
    if (isMobile) {
      setSidebarOpen(!sidebarOpen);
    } else {
      setSidebarCollapsed(!sidebarCollapsed);
    }
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

  // Calculate layout dimensions - Optimized for screen real estate
  const sidebarWidth = sidebarCollapsed ? 56 : 220;  // Reduced from 72/280 to 56/220
  const appBarHeight = 56;  // Fixed height from our AppBar updates
  const breadcrumbHeight = 40;  // Reduced from 48px
  const patientHeaderHeight = patient ? 80 : 0;  // Fixed 80px from CompactPatientHeader

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <CssBaseline />
      
      {/* App Bar */}
      <ClinicalAppBar
        onMenuToggle={handleSidebarToggle}
        onThemeToggle={toggleTheme}
        isDarkMode={isDarkMode}
        patient={patient}
        loading={loading}
        user={user}
        department={department}
        shift={shift}
      />
      
      {/* Main Layout Container */}
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        {/* Sidebar Navigation */}
        <ClinicalSidebar
          open={sidebarOpen}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          onClose={() => setSidebarOpen(false)}
          activeTab={activeModule}
          onTabChange={handleModuleChange}
          patient={patient}
          variant={isMobile ? 'temporary' : 'permanent'}
        />
        
        {/* Main Content Area */}
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            width: `calc(100% - ${sidebarOpen && !isMobile ? sidebarWidth : 0}px)`,
            ml: sidebarOpen && !isMobile ? `${sidebarWidth}px` : 0,
            transition: theme.transitions.create(['margin', 'width'], {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.enteringScreen
            })
          }}
      >
        {/* No spacer needed - AppBar is not fixed */}
        
        {/* Header Section with proper flex shrink */}
        <Box sx={{ flexShrink: 0 }}>
          {/* Breadcrumbs */}
          <ClinicalBreadcrumbs
            patient={patient}
            activeModule={MODULES[activeModule]}
            subContext={subContext}
            onBookmark={handleBookmark}
            bookmarked={bookmarked}
          />
          
          {/* Patient Header */}
          {patient && (
            <CompactPatientHeader
              patient={patient}
              alerts={patient.alerts || []}
              vitals={patientData.vitals}
              conditions={patientData.conditions}
              medications={patientData.medications}
              allergies={patientData.allergies}
              lastEncounter={patientData.lastEncounter}
              onNavigateToTab={handleModuleChange}
            />
          )}
        </Box>
        
        {/* Content Area */}
        <Box
          sx={{
            flexGrow: 1,
            overflow: 'auto',
            backgroundColor: theme.palette.background.default,
            p: isMobile ? 0.5 : 1.5,  // Slightly increased desktop padding for readability
            minHeight: 0,  // Important for flexbox overflow to work properly
            // Add subtle background pattern for professional medical UI
            backgroundImage: theme.palette.mode === 'light' 
              ? 'radial-gradient(circle at 100% 50%, transparent 20%, rgba(255,255,255,0.3) 21%, rgba(255,255,255,0.3) 34%, transparent 35%, transparent), linear-gradient(0deg, transparent 24%, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.05) 26%, transparent 27%, transparent 74%, rgba(255,255,255,0.05) 75%, rgba(255,255,255,0.05) 76%, transparent 77%, transparent)'
              : 'none',
            backgroundSize: '20px 20px'
          }}
        >
          {/* Pass enhanced props to children */}
          {React.cloneElement(children, {
            patient,
            loading,
            patientData,
            isMobile,
            isTablet,
            density: sidebarCollapsed ? 'compact' : 'comfortable',
            activeModule,
            onModuleChange: handleModuleChange
          })}
        </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default EnhancedClinicalLayout;