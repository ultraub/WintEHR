/**
 * EnhancedClinicalLayout Component
 * Improved clinical workspace layout with integrated navigation
 * Now uses horizontal tab navigation matching older design
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
import ClinicalTabs from '../navigation/ClinicalTabs';
import ClinicalBreadcrumbs from '../navigation/ClinicalBreadcrumbs';
import CompactPatientHeader from '../ui/CompactPatientHeader';
import { useClinicalWorkflow } from '../../../contexts/ClinicalWorkflowContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useFHIRResource } from '../../../contexts/FHIRResourceContext';
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
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.down('lg'));
  
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

  // Handle menu toggle - now just for mobile drawer if needed
  const handleMenuToggle = () => {
    // Could be used for mobile menu in future
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
      
      {/* Main Layout Container */}
      <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        {/* Tab Navigation */}
        <ClinicalTabs
          activeTab={activeModule}
          onTabChange={handleModuleChange}
          variant="scrollable"
          showIcons={!isMobile}
        />
        
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
          {/* Header Section */}
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
              backgroundColor: '#FAFBFC', // Clean light gray background matching older design
              p: isMobile ? 1 : 2,
              minHeight: 0, // Important for flexbox overflow to work properly
            }}
          >
            {/* Pass enhanced props to children */}
            {React.cloneElement(children, {
              patient,
              loading,
              patientData,
              isMobile,
              isTablet,
              density: isMobile ? 'compact' : 'comfortable',
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