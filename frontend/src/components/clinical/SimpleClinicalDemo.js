/**
 * SimpleClinicalDemo Component
 * A simplified clinical workspace demo that doesn't require authentication
 */
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Alert,
  CircularProgress,
  Paper,
  Tabs,
  Tab,
  AppBar,
  Toolbar,
  IconButton,
  Button,
  Chip,
  Stack,
  Card,
  CardContent,
  Divider
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  Assignment as ChartIcon,
  EventNote as EncountersIcon,
  Science as ResultsIcon,
  LocalPharmacy as PharmacyIcon,
  Image as ImagingIcon,
  Refresh as RefreshIcon,
  Assignment
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';

// Import the tab components
import SummaryTab from './workspace/tabs/SummaryTab';
import ChartReviewTab from './workspace/tabs/ChartReviewTab';
import EncountersTab from './workspace/tabs/EncountersTab';
import ResultsTab from './workspace/tabs/ResultsTab';
import OrdersTab from './workspace/tabs/OrdersTab';
import PharmacyTab from './workspace/tabs/PharmacyTab';
import ImagingTab from './workspace/tabs/ImagingTab';

const SimpleClinicalDemo = () => {
  const { id: urlPatientId } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Tab configuration
  const tabs = [
    { label: 'Summary', icon: <DashboardIcon />, component: SummaryTab },
    { label: 'Chart Review', icon: <ChartIcon />, component: ChartReviewTab },
    { label: 'Encounters', icon: <EncountersIcon />, component: EncountersTab },
    { label: 'Results', icon: <ResultsIcon />, component: ResultsTab },
    { label: 'Orders', icon: <Assignment />, component: OrdersTab },
    { label: 'Pharmacy', icon: <PharmacyIcon />, component: PharmacyTab },
    { label: 'Imaging', icon: <ImagingIcon />, component: ImagingTab }
  ];

  // Load patient data
  useEffect(() => {
    const loadPatient = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // First try to use the URL patient ID
        let response = await fetch(`/api/fhir/R4/Patient/${urlPatientId}`);
        
        // If not found, get the first patient from the database
        if (!response.ok) {
          response = await fetch('/api/fhir/R4/Patient?_count=1');
          const bundle = await response.json();
          
          if (bundle.entry && bundle.entry.length > 0) {
            const firstPatient = bundle.entry[0].resource;
            setPatient(firstPatient);
            
            // Redirect to the correct patient ID
            if (firstPatient.id !== urlPatientId) {
              navigate(`/clinical-demo/${firstPatient.id}`, { replace: true });
            }
          } else {
            throw new Error('No patients found in database');
          }
        } else {
          const patientData = await response.json();
          setPatient(patientData);
        }
      } catch (err) {
        console.error('Failed to load patient:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadPatient();
  }, [urlPatientId, navigate]);

  // Format patient name
  const getPatientName = () => {
    if (!patient || !patient.name || patient.name.length === 0) return 'Unknown Patient';
    const name = patient.name[0];
    return `${name.given?.join(' ') || ''} ${name.family || ''}`.trim();
  };

  // Format patient demographics
  const getPatientDemographics = () => {
    if (!patient) return '';
    const parts = [];
    
    if (patient.gender) {
      parts.push(patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1));
    }
    
    if (patient.birthDate) {
      const age = new Date().getFullYear() - new Date(patient.birthDate).getFullYear();
      parts.push(`${age} years old`);
      parts.push(`DOB: ${new Date(patient.birthDate).toLocaleDateString()}`);
    }
    
    return parts.join(' • ');
  };

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          <Typography>Failed to load patient: {error}</Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Make sure you have loaded patient data using ./load-patients.sh
          </Typography>
        </Alert>
      </Box>
    );
  }

  const ActiveTabComponent = tabs[activeTab]?.component || SummaryTab;

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Demo Warning Banner */}
      <Alert 
        severity="warning" 
        sx={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          zIndex: 9999,
          borderRadius: 0
        }}
      >
        <Typography variant="body2">
          Demo Mode: This is a simplified view for testing the clinical workspace. 
          Authentication is bypassed. {patient && `Testing with: ${getPatientName()}`}
        </Typography>
      </Alert>

      {/* App Bar */}
      <AppBar position="fixed" sx={{ mt: 6, zIndex: 1200 }}>
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            aria-label="menu"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            WintEHR Clinical
          </Typography>
          <Button color="inherit" onClick={() => navigate('/login')}>
            Exit Demo
          </Button>
        </Toolbar>
      </AppBar>

      {/* Sidebar */}
      {sidebarOpen && (
        <Paper
          sx={{
            width: 240,
            mt: '112px', // Account for warning banner (48px) + app bar (64px)
            height: 'calc(100vh - 112px)',
            position: 'fixed',
            left: 0,
            overflow: 'auto',
            borderRadius: 0,
            borderRight: 1,
            borderColor: 'divider'
          }}
        >
          <Box sx={{ p: 2 }}>
            {tabs.map((tab, index) => (
              <Button
                key={index}
                fullWidth
                startIcon={tab.icon}
                onClick={() => setActiveTab(index)}
                sx={{
                  justifyContent: 'flex-start',
                  mb: 1,
                  backgroundColor: activeTab === index ? 'action.selected' : 'transparent'
                }}
              >
                {tab.label}
              </Button>
            ))}
          </Box>
        </Paper>
      )}

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          ml: sidebarOpen ? '240px' : 0,
          mt: '112px', // Account for warning banner + app bar
          p: 3,
          height: 'calc(100vh - 112px)',
          overflow: 'auto'
        }}
      >
        {/* Patient Header */}
        {patient && !loading && (
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h5" gutterBottom>
                    {getPatientName()}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {getPatientDemographics()}
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                    <Chip label={`MRN: ${patient.id}`} size="small" />
                    {patient.identifier?.map((id, index) => (
                      <Chip 
                        key={index} 
                        label={`${id.system?.split('/').pop() || 'ID'}: ${id.value}`} 
                        size="small" 
                      />
                    ))}
                  </Stack>
                </Box>
                <IconButton onClick={() => window.location.reload()}>
                  <RefreshIcon />
                </IconButton>
              </Stack>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Paper sx={{ mb: 3 }}>
          <Tabs
            value={activeTab}
            onChange={(e, newValue) => setActiveTab(newValue)}
            variant="scrollable"
            scrollButtons="auto"
          >
            {tabs.map((tab, index) => (
              <Tab key={index} label={tab.label} icon={tab.icon} />
            ))}
          </Tabs>
        </Paper>

        {/* Tab Content */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box>
            <ActiveTabComponent patient={patient} />
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default SimpleClinicalDemo;