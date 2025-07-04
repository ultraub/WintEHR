/**
 * Clinical Workspace Component
 * Main container for clinical workflows with tabbed navigation
 */
import React, { useState, useEffect } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import {
  Box,
  Paper,
  Tabs,
  Tab,
  Typography,
  CircularProgress,
  Alert,
  Button
} from '@mui/material';
import {
  Description as DocumentationIcon,
  LocalPharmacy as OrdersIcon,
  Assessment as ResultsIcon,
  Dashboard as OverviewIcon,
  Inbox as InboxIcon,
  Assignment as TasksIcon,
  Timeline as TrendsIcon,
  Event as AppointmentsIcon
} from '@mui/icons-material';
import { useClinical } from '../../contexts/ClinicalContext';
import { useDocumentation } from '../../contexts/DocumentationContext';
import { useOrders } from '../../contexts/OrderContext';
import { useTask } from '../../contexts/TaskContext';
import { useAuth } from '../../contexts/AuthContext';
import { useInbox } from '../../contexts/InboxContext';
import PatientHeader from './PatientHeader';
import PatientOverview from './PatientOverview';
import DocumentationTab from './documentation/DocumentationTab';
import OrdersTab from './orders/OrdersTab';
import ResultsTab from './results/ResultsTab';
import InboxTab from './inbox/InboxTab';
import TasksTab from './tasks/TasksTab';
import TrendsTab from './trends/TrendsTab';
import AppointmentsTab from './appointments/AppointmentsTab';
import cdsHooksService from '../../services/cdsHooks';
import CDSAlerts from '../CDSAlerts';
import api from '../../services/api';


const TabPanel = ({ children, value, index, ...other }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`clinical-tabpanel-${index}`}
      aria-labelledby={`clinical-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ py: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
};

const ClinicalWorkspace = () => {
  const { patientId } = useParams();
  const location = useLocation();
  const { currentPatient, loadPatient: loadPatientFromContext, loadEncounter: loadEncounterFromContext, workspaceMode, setWorkspaceMode, isLoading, currentEncounter, setCurrentEncounter } = useClinical();
  const { loadRecentNotes, loadNoteTemplates } = useDocumentation();
  const { loadActiveOrders, loadOrderSets } = useOrders();
  const { loadTasks, loadTaskStats } = useTask();
  const { loadInboxItems, loadInboxStats } = useInbox();
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState(0); // Start on Overview tab by default
  const [initLoading, setInitLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // Map workspace modes to tab indices
  const workspaceModeToTab = {
    'overview': 0,
    'documentation': 1,
    'orders': 2,
    'results': 3,
    'trends': 4,
    'appointments': 5,
    'inbox': 6,
    'tasks': 7
  };

  const tabToWorkspaceMode = ['overview', 'documentation', 'orders', 'results', 'trends', 'appointments', 'inbox', 'tasks'];

  // Handle URL parameters for mode and encounter context
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const mode = searchParams.get('mode');
    const encounterId = searchParams.get('encounter');
    
    if (mode && workspaceModeToTab[mode] !== undefined) {
      setActiveTab(workspaceModeToTab[mode]);
      setWorkspaceMode(mode);
    }
    
    // Load encounter if specified in URL
    if (encounterId && (!currentEncounter || currentEncounter.id !== encounterId)) {
      loadEncounterFromContext(encounterId);
    }
  }, [location.search]);

  // Load patient data if navigating directly to this page
  useEffect(() => {
    const loadPatientData = async () => {
      if (patientId && (!currentPatient || currentPatient.id !== patientId)) {
        try {
          setLoadError(null);
          await loadPatientFromContext(patientId);
        } catch (error) {
          console.error('Failed to load patient:', error);
          setLoadError(error.message || 'Failed to load patient');
        }
      }
    };
    loadPatientData();
  }, [patientId, currentPatient, loadPatientFromContext]);

  // Initialize data when patient is loaded
  useEffect(() => {
    const initializeWorkspace = async () => {
      if (!currentPatient) return;

      setInitLoading(true);
      try {
        // Load initial data for all tabs
        await Promise.all([
          loadRecentNotes(currentPatient.id),
          loadNoteTemplates(),
          loadActiveOrders(currentPatient.id),
          loadOrderSets(),
          loadInboxItems({ patient_id: currentPatient.id }),
          loadInboxStats(),
          loadTasks({ patient_id: currentPatient.id }),
          loadTaskStats()
        ]);

        // Fire patient-view CDS hook only once per patient
        const userId = currentUser?.id || 'demo-user';
        await cdsHooksService.firePatientView(
          currentPatient.id,
          userId,
          null // Don't include encounter ID to prevent re-firing on encounter changes
        );
      } catch (error) {
        console.error('Error initializing workspace:', error);
      } finally {
        setInitLoading(false);
      }
    };

    initializeWorkspace();
  }, [currentPatient?.id, currentUser?.id]); // Remove currentEncounter?.id to prevent re-firing on encounter change

  // Sync tab with workspace mode
  useEffect(() => {
    setActiveTab(workspaceModeToTab[workspaceMode] || 0);
  }, [workspaceMode]);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    setWorkspaceMode(tabToWorkspaceMode[newValue]);
  };

  if (loadError) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" action={
          <Button color="inherit" size="small" onClick={() => window.location.href = '/patients'}>
            Back to Patients
          </Button>
        }>
          {loadError}
        </Alert>
      </Box>
    );
  }

  if (!currentPatient) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info" action={
          <Button color="inherit" size="small" onClick={() => window.location.href = '/patients'}>
            Select Patient
          </Button>
        }>
          No patient selected. Please select a patient to access the clinical workspace.
        </Alert>
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Patient Header */}
      <PatientHeader showEncounterInfo={true} />

      {/* CDS Alerts */}
      <Box sx={{ px: 2, pt: 2 }}>
        <CDSAlerts hook="patient-view" patientId={currentPatient?.id} />
      </Box>

      {/* Workspace Content */}
      <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            aria-label="clinical workspace tabs"
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab 
              icon={<OverviewIcon />} 
              label="Overview" 
              iconPosition="start"
            />
            <Tab 
              icon={<DocumentationIcon />} 
              label="Documentation" 
              iconPosition="start"
            />
            <Tab 
              icon={<OrdersIcon />} 
              label="Orders" 
              iconPosition="start"
            />
            <Tab 
              icon={<ResultsIcon />} 
              label="Results" 
              iconPosition="start"
            />
            <Tab 
              icon={<TrendsIcon />} 
              label="Trends" 
              iconPosition="start"
            />
            <Tab 
              icon={<AppointmentsIcon />} 
              label="Appointments" 
              iconPosition="start"
            />
            <Tab 
              icon={<InboxIcon />} 
              label="Inbox" 
              iconPosition="start"
            />
            <Tab 
              icon={<TasksIcon />} 
              label="Tasks" 
              iconPosition="start"
            />
          </Tabs>
        </Box>

        <Box sx={{ flex: 1, overflow: 'auto' }}>
          <TabPanel value={activeTab} index={0}>
            <PatientOverview />
          </TabPanel>
          
          <TabPanel value={activeTab} index={1}>
            <DocumentationTab />
          </TabPanel>
          
          <TabPanel value={activeTab} index={2}>
            <OrdersTab />
          </TabPanel>
          
          <TabPanel value={activeTab} index={3}>
            <ResultsTab />
          </TabPanel>
          
          <TabPanel value={activeTab} index={4}>
            <TrendsTab />
          </TabPanel>
          
          <TabPanel value={activeTab} index={5}>
            <AppointmentsTab />
          </TabPanel>
          
          <TabPanel value={activeTab} index={6}>
            <InboxTab />
          </TabPanel>
          
          <TabPanel value={activeTab} index={7}>
            <TasksTab />
          </TabPanel>
        </Box>
      </Paper>
    </Box>
  );
};

export default ClinicalWorkspace;