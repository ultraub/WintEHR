/**
 * ClinicalWorkspaceV2 Component
 * Redesigned clinical workspace with workflow-based navigation and flexible layouts
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  Button,
  IconButton,
  Tooltip,
  Fab,
  Zoom,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  Search as SearchIcon,
  KeyboardCommandKey as CommandIcon,
  Help as HelpIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon
} from '@mui/icons-material';

// Contexts
import { useWorkflow } from '../../contexts/WorkflowContext';
import { useFHIRResource } from '../../contexts/FHIRResourceContext';
import { useClinical } from '../../contexts/ClinicalContext';
import { useAuth } from '../../contexts/AuthContext';

// Workspace Components
import WorkspaceLayoutManager from './workspace/WorkspaceLayoutManager';
import WorkflowModeSelector, { WorkflowQuickAccess } from './workspace/WorkflowModeSelector';
import CommandPalette from './workspace/CommandPalette';
import PatientHeader from './PatientHeader';
// import CDSAlerts from '../CDSAlerts';

// Panel Components (to be created)
import ChartReviewMode from './workspace/modes/ChartReviewMode';
import DocumentationMode from './workspace/modes/DocumentationMode';
import OrdersMode from './workspace/modes/OrdersMode';
import ResultsReviewMode from './workspace/modes/ResultsReviewMode';
import CarePlanningMode from './workspace/modes/CarePlanningMode';
import PopulationHealthMode from './workspace/modes/PopulationHealthMode';

// Utilities
import { decodeFhirId } from '../../utils/navigationUtils';
// TODO: Re-enable when CDS hooks endpoint is implemented
// import { cdsHooksClient } from '../../services/cdsHooksClient';

const ClinicalWorkspaceV2 = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  // Route params
  const { id: encodedPatientId } = useParams();
  const patientId = decodeFhirId(encodedPatientId);
  
  // Contexts
  const { currentUser } = useAuth();
  const { currentPatient, setCurrentPatient } = useFHIRResource();
  const { 
    loadEncounter: loadEncounterFromContext,
    currentEncounter,
    setCurrentEncounter
  } = useClinical();
  const { 
    currentMode, 
    changeWorkflowMode, 
    isLoadingResources,
    resourceErrors,
    clinicalContext,
    setActiveEncounter
  } = useWorkflow();
  
  // Local state
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [initLoading, setInitLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // Handle URL parameters for mode and encounter
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const mode = searchParams.get('mode');
    const encounterId = searchParams.get('encounter');
    
    if (mode) {
      changeWorkflowMode(mode);
    }
    
    if (encounterId && (!currentEncounter || currentEncounter.id !== encounterId)) {
      loadEncounterFromContext(encounterId);
    }
  }, [location.search, changeWorkflowMode, currentEncounter, loadEncounterFromContext]);

  // Load patient data
  useEffect(() => {
    const loadPatientData = async () => {
      console.log('Loading patient data for:', patientId, 'Current patient:', currentPatient);
      if (patientId && (!currentPatient || currentPatient.id !== patientId)) {
        try {
          setLoadError(null);
          console.log('Fetching patient resource:', patientId);
          // Use setCurrentPatient to properly set the patient context
          await setCurrentPatient(patientId);
          console.log('Patient set as current');
        } catch (error) {
          console.error('Failed to load patient:', error);
          setLoadError(error.message || 'Failed to load patient');
        }
      }
    };
    loadPatientData();
  }, [patientId, setCurrentPatient]); // Remove currentPatient from deps to avoid infinite loop

  // Initialize workspace
  useEffect(() => {
    const initializeWorkspace = async () => {
      if (!currentPatient) return;

      console.log('Initializing workspace for patient:', currentPatient.id);
      setInitLoading(true);
      try {
        // Workspace is ready, no CDS hooks for now
        await new Promise(resolve => setTimeout(resolve, 100)); // Small delay to ensure state updates
      } catch (error) {
        console.error('Error initializing workspace:', error);
      } finally {
        setInitLoading(false);
        console.log('Workspace initialization complete');
      }
    };

    initializeWorkspace();
  }, [currentPatient?.id]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Command palette (Cmd/Ctrl + K)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
      
      // Workflow mode shortcuts (Cmd/Ctrl + 1-6)
      if ((e.metaKey || e.ctrlKey) && e.key >= '1' && e.key <= '6') {
        e.preventDefault();
        const modeIndex = parseInt(e.key) - 1;
        const modes = ['chart-review', 'encounter-documentation', 'orders-management', 
                      'results-review', 'care-planning', 'population-health'];
        if (modes[modeIndex]) {
          changeWorkflowMode(modes[modeIndex]);
        }
      }
      
      // Toggle fullscreen (F11)
      if (e.key === 'F11') {
        e.preventDefault();
        setIsFullscreen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [changeWorkflowMode]);

  // Handle layout change
  const handleLayoutChange = useCallback((newLayout) => {
    // Could persist layout preference per workflow mode
    localStorage.setItem(`workspace-layout-${currentMode?.id}`, newLayout);
  }, [currentMode]);

  // Render workflow mode content
  const renderWorkflowContent = () => {
    console.log('Rendering workflow content, currentMode:', currentMode);
    if (!currentMode) {
      return (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary">
            Select a workflow mode to begin
          </Typography>
        </Box>
      );
    }

    // Map workflow modes to their components
    const modeComponents = {
      'chart-review': <ChartReviewMode />,
      'encounter-documentation': <DocumentationMode />,
      'orders-management': <OrdersMode />,
      'results-review': <ResultsReviewMode />,
      'care-planning': <CarePlanningMode />,
      'population-health': <PopulationHealthMode />
    };

    const ModeComponent = modeComponents[currentMode.id];
    
    if (!ModeComponent) {
      return (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="error">
            Workflow mode not implemented: {currentMode.name}
          </Typography>
        </Box>
      );
    }

    return ModeComponent;
  };

  // Error state
  if (loadError) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert 
          severity="error" 
          action={
            <Button color="inherit" size="small" onClick={() => navigate('/patients')}>
              Back to Patients
            </Button>
          }
        >
          {loadError}
        </Alert>
      </Box>
    );
  }

  // No patient selected
  if (!currentPatient && !initLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert 
          severity="info" 
          action={
            <Button color="inherit" size="small" onClick={() => navigate('/patients')}>
              Select Patient
            </Button>
          }
        >
          No patient selected. Please select a patient to access the clinical workspace.
        </Alert>
      </Box>
    );
  }

  // Loading state
  if (initLoading) {
    console.log('ClinicalWorkspaceV2: Still in initLoading state', {
      currentPatient,
      patientId,
      initLoading
    });
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      position: isFullscreen ? 'fixed' : 'relative',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: isFullscreen ? theme.zIndex.modal : 'auto',
      backgroundColor: 'background.default'
    }}>
      {/* Patient Header */}
      <PatientHeader showEncounterInfo={true} />

      {/* Workflow Mode Selector */}
      <Paper 
        elevation={0} 
        sx={{ 
          px: 2, 
          py: 1, 
          borderBottom: 1, 
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          gap: 2
        }}
      >
        <Box sx={{ flex: 1 }}>
          <WorkflowModeSelector onModeChange={(mode) => {
            // Update URL with new mode
            const searchParams = new URLSearchParams(location.search);
            searchParams.set('mode', mode);
            navigate(`${location.pathname}?${searchParams.toString()}`, { replace: true });
          }} />
        </Box>
        
        {!isMobile && <WorkflowQuickAccess />}
        
        <Tooltip title="Toggle Fullscreen">
          <IconButton onClick={() => setIsFullscreen(!isFullscreen)}>
            {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
          </IconButton>
        </Tooltip>
      </Paper>

      {/* CDS Alerts - TODO: Implement CDSAlerts component */}
      {/* <Box sx={{ px: 2, pt: 1 }}>
        <CDSAlerts hook="patient-view" patientId={currentPatient?.id} />
      </Box> */}

      {/* Main Workspace Content */}
      <Box sx={{ flex: 1, overflow: 'hidden', p: 2 }}>
        <WorkspaceLayoutManager
          layout={currentMode?.layout || 'single'}
          onLayoutChange={handleLayoutChange}
          persistKey={`workspace-${currentMode?.id}`}
        >
          {renderWorkflowContent()}
        </WorkspaceLayoutManager>
      </Box>

      {/* Loading Overlay */}
      {isLoadingResources && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: theme.zIndex.modal - 1
          }}
        >
          <Paper elevation={3} sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
            <CircularProgress />
            <Typography>Loading clinical data...</Typography>
          </Paper>
        </Box>
      )}

      {/* Floating Action Buttons */}
      <Box sx={{ position: 'fixed', bottom: 24, right: 24, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Zoom in={true} timeout={300}>
          <Fab
            color="primary"
            onClick={() => setCommandPaletteOpen(true)}
            sx={{ boxShadow: 3 }}
          >
            <CommandIcon />
          </Fab>
        </Zoom>
        
        <Zoom in={true} timeout={400}>
          <Fab
            size="small"
            color="default"
            onClick={() => window.open('/help/clinical-workspace', '_blank')}
          >
            <HelpIcon />
          </Fab>
        </Zoom>
      </Box>

      {/* Command Palette */}
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />

      {/* Resource Error Notifications */}
      {Object.entries(resourceErrors).length > 0 && (
        <Box sx={{ position: 'fixed', bottom: 24, left: 24, maxWidth: 400 }}>
          {Object.entries(resourceErrors).map(([resourceType, error]) => (
            <Alert 
              key={resourceType} 
              severity="error" 
              onClose={() => {}}
              sx={{ mb: 1 }}
            >
              Failed to load {resourceType}: {error}
            </Alert>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default ClinicalWorkspaceV2;