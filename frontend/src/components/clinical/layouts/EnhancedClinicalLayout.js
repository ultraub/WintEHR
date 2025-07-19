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
import fhirServiceCompat from '../../../core/fhir/services/fhirService';

const fhirService = fhirServiceCompat;

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
  const [patientData, setPatientData] = useState({
    conditions: [],
    medications: [],
    allergies: [],
    vitals: {},
    lastEncounter: null
  });
  const [bookmarked, setBookmarked] = useState(false);
  
  const { publish } = useClinicalWorkflow();

  // Load patient data
  useEffect(() => {
    if (patientId) {
      loadPatientData();
    }
  }, [patientId]);

  const loadPatientData = async () => {
    setLoading(true);
    try {
      // Load patient resource
      const patientResource = await fhirService.readResource('Patient', patientId);
      setPatient(patientResource);
      
      // Load clinical data bundle
      const bundle = await fhirService.fetchPatientBundle(patientId, false, 'summary');
      
      if (bundle?.entry) {
        const resources = bundle.entry.map(e => e.resource);
        
        // Extract conditions
        const conditions = resources.filter(r => r.resourceType === 'Condition');
        
        // Extract medications
        const medications = resources.filter(r => r.resourceType === 'MedicationRequest');
        
        // Extract allergies
        const allergies = resources.filter(r => r.resourceType === 'AllergyIntolerance');
        
        // Extract last encounter
        const encounters = resources.filter(r => r.resourceType === 'Encounter')
          .sort((a, b) => new Date(b.period?.start) - new Date(a.period?.start));
        
        setPatientData({
          conditions,
          medications,
          allergies,
          vitals: {}, // Would be extracted from Observations
          lastEncounter: encounters[0] || null
        });
      }
    } catch (error) {
      console.error('Failed to load patient data:', error);
    } finally {
      setLoading(false);
    }
  };

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
    const module = MODULES[moduleId];
    if (module && onModuleChange) {
      onModuleChange(module.index);
      
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

  // Calculate layout dimensions
  const sidebarWidth = sidebarCollapsed ? 72 : 280;
  const appBarHeight = isMobile ? 56 : 64;
  const contextBarHeight = isMobile ? 0 : 32;
  const totalHeaderHeight = appBarHeight + contextBarHeight;
  const breadcrumbHeight = 48;
  const patientHeaderHeight = patient ? (isMobile ? 140 : 160) : 0;

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
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
          ml: isMobile ? 0 : `${sidebarWidth}px`,
          transition: theme.transitions.create(['margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen
          })
        }}
      >
        {/* Spacer for fixed app bar */}
        <Box sx={{ height: totalHeaderHeight }} />
        
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
        
        {/* Content Area */}
        <Box
          sx={{
            flexGrow: 1,
            overflow: 'auto',
            backgroundColor: theme.palette.background.default,
            p: isMobile ? 1 : 2
          }}
        >
          {/* Pass enhanced props to children */}
          {React.cloneElement(children, {
            patient,
            loading,
            patientData,
            isMobile,
            isTablet,
            density: sidebarCollapsed ? 'compact' : 'comfortable'
          })}
        </Box>
      </Box>
    </Box>
  );
};

export default EnhancedClinicalLayout;