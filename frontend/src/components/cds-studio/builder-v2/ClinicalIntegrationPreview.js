/**
 * Clinical Integration Preview
 * Shows how CDS services integrate into real clinical workflows
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  ButtonGroup,
  IconButton,
  Card,
  CardContent,
  CardActions,
  Stack,
  Chip,
  Avatar,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemButton,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tabs,
  Tab,
  Grid,
  Badge,
  Tooltip,
  AppBar,
  Toolbar
} from '@mui/material';
import {
  Visibility as PreviewIcon,
  VisibilityOff as HideIcon,
  Smartphone as MobileIcon,
  Computer as DesktopIcon,
  Tablet as TabletIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Error as ErrorIcon,
  Person as PatientIcon,
  LocalHospital as HospitalIcon,
  MedicalServices as MedicalIcon,
  Assignment as OrderIcon,
  Timeline as VitalsIcon,
  Medication as MedicationIcon,
  Schedule as ScheduleIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';

// Mock patient data for preview
const MOCK_PATIENT = {
  id: 'patient-123',
  name: 'John Doe',
  age: 67,
  gender: 'Male',
  mrn: 'MRN-456789',
  conditions: [
    { code: '44054006', display: 'Diabetes mellitus', status: 'active' },
    { code: '38341003', display: 'Essential hypertension', status: 'active' }
  ],
  allergies: [
    { code: 'penicillin', display: 'Penicillin allergy', severity: 'high' }
  ],
  vitals: {
    bloodPressure: '142/90 mmHg',
    heartRate: '78 bpm',
    temperature: '98.6°F',
    weight: '185 lbs'
  }
};

// Clinical workflow scenarios
const CLINICAL_SCENARIOS = {
  'patient-view': {
    title: 'Patient Chart Review',
    description: 'Viewing patient summary and chart',
    icon: <PatientIcon />,
    mockUI: 'PatientSummary',
    hookTrigger: 'Opening patient chart'
  },
  'medication-prescribe': {
    title: 'Medication Prescribing',
    description: 'Prescribing new medications',
    icon: <MedicationIcon />,
    mockUI: 'PrescribingInterface',
    hookTrigger: 'Adding medication to order'
  },
  'order-sign': {
    title: 'Order Signing',
    description: 'Signing and finalizing orders',
    icon: <OrderIcon />,
    mockUI: 'OrderSigningDialog',
    hookTrigger: 'Signing orders for patient'
  },
  'order-select': {
    title: 'Order Selection',
    description: 'Selecting orders from catalog',
    icon: <MedicalIcon />,
    mockUI: 'OrderCatalog',
    hookTrigger: 'Selecting lab tests/procedures'
  }
};

// Mock CDS cards for preview
const MOCK_CDS_CARDS = [
  {
    uuid: 'card-1',
    summary: 'Diabetes screening reminder',
    indicator: 'info',
    detail: 'Patient is 67 years old and due for diabetes screening. Consider ordering A1C test.',
    source: { label: 'Diabetes Care Guidelines' }
  },
  {
    uuid: 'card-2',
    summary: 'Drug interaction warning',
    indicator: 'warning',
    detail: 'Potential interaction between prescribed medication and existing therapy.',
    source: { label: 'Drug Interaction Database' }
  },
  {
    uuid: 'card-3',
    summary: 'Critical lab value',
    indicator: 'critical',
    detail: 'Patient creatinine level indicates possible kidney function decline.',
    source: { label: 'Lab Alert System' }
  }
];

const ClinicalIntegrationPreview = ({
  service,
  perspectiveMode = 'consumer',
  previewMode = 'desktop',
  onPreviewModeChange
}) => {
  const [selectedScenario, setSelectedScenario] = useState('patient-view');
  const [showCDSCards, setShowCDSCards] = useState(true);
  const [selectedCard, setSelectedCard] = useState(null);
  const [simulationRunning, setSimulationRunning] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  // Get current scenario
  const currentScenario = CLINICAL_SCENARIOS[selectedScenario] || CLINICAL_SCENARIOS['patient-view'];

  // Simulate CDS hook execution
  const simulateHookExecution = useCallback(async () => {
    setSimulationRunning(true);
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setSimulationRunning(false);
    setShowCDSCards(true);
  }, []);

  // Get responsive styles based on preview mode
  const getPreviewStyles = () => {
    switch (previewMode) {
      case 'mobile':
        return {
          width: 375,
          height: 667,
          border: '8px solid #333',
          borderRadius: '25px',
          backgroundColor: '#000'
        };
      case 'tablet':
        return {
          width: 768,
          height: 1024,
          border: '4px solid #666',
          borderRadius: '15px',
          backgroundColor: '#333'
        };
      case 'desktop':
      default:
        return {
          width: '100%',
          height: '100%',
          border: 'none',
          borderRadius: 0,
          backgroundColor: 'transparent'
        };
    }
  };

  // Render mock clinical interface
  const renderMockClinicalInterface = () => {
    const styles = getPreviewStyles();
    
    return (
      <Box
        sx={{
          ...styles,
          mx: 'auto',
          overflow: 'hidden',
          position: 'relative'
        }}
      >
        <Box
          sx={{
            width: '100%',
            height: '100%',
            backgroundColor: 'background.default',
            borderRadius: previewMode === 'desktop' ? 0 : '15px',
            overflow: 'hidden'
          }}
        >
          {/* Mock EHR Header */}
          <AppBar position="static" color="primary" elevation={0}>
            <Toolbar variant="dense">
              <Typography variant="h6" sx={{ flexGrow: 1, fontSize: '1rem' }}>
                WintEHR - {currentScenario.title}
              </Typography>
              <Chip 
                label={MOCK_PATIENT.name}
                size="small"
                color="secondary"
                avatar={<Avatar sx={{ width: 24, height: 24 }}>{MOCK_PATIENT.name[0]}</Avatar>}
              />
            </Toolbar>
          </AppBar>

          {/* Patient header */}
          <Paper sx={{ p: 2, borderRadius: 0 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item>
                <Avatar sx={{ width: 48, height: 48, bgcolor: 'primary.main' }}>
                  {MOCK_PATIENT.name.split(' ').map(n => n[0]).join('')}
                </Avatar>
              </Grid>
              <Grid item xs>
                <Typography variant="h6">{MOCK_PATIENT.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {MOCK_PATIENT.age} years old • {MOCK_PATIENT.gender} • MRN: {MOCK_PATIENT.mrn}
                </Typography>
              </Grid>
              <Grid item>
                <Stack direction="row" spacing={1}>
                  <Chip label="Diabetes" color="warning" size="small" />
                  <Chip label="Hypertension" color="error" size="small" />
                </Stack>
              </Grid>
            </Grid>
          </Paper>

          {/* CDS Alert Banner */}
          {showCDSCards && (
            <Box sx={{ p: 1, backgroundColor: 'warning.light', borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                Clinical Decision Support Alerts
              </Typography>
              <Stack spacing={1}>
                {MOCK_CDS_CARDS.map((card) => (
                  <Alert
                    key={card.uuid}
                    severity={card.indicator === 'critical' ? 'error' : card.indicator}
                    action={
                      <Button size="small" onClick={() => setSelectedCard(card)}>
                        Review
                      </Button>
                    }
                    sx={{ fontSize: '0.875rem' }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                      {card.summary}
                    </Typography>
                  </Alert>
                ))}
              </Stack>
            </Box>
          )}

          {/* Mock clinical content based on scenario */}
          <Box sx={{ p: 2, height: 'calc(100% - 200px)', overflow: 'auto' }}>
            {renderScenarioContent()}
          </Box>

          {/* Hook trigger button */}
          <Box
            sx={{
              position: 'absolute',
              bottom: 16,
              right: 16,
              zIndex: 1000
            }}
          >
            <Tooltip title={`Trigger ${service.metadata?.hook || 'CDS Hook'}`}>
              <Button
                variant="contained"
                color="primary"
                onClick={simulateHookExecution}
                disabled={simulationRunning}
                startIcon={simulationRunning ? <RefreshIcon className="spin" /> : currentScenario.icon}
                size={previewMode === 'mobile' ? 'small' : 'medium'}
              >
                {simulationRunning ? 'Executing...' : 'Trigger Hook'}
              </Button>
            </Tooltip>
          </Box>
        </Box>
      </Box>
    );
  };

  // Render scenario-specific content
  const renderScenarioContent = () => {
    switch (selectedScenario) {
      case 'patient-view':
        return (
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Vital Signs</Typography>
                  <List dense>
                    <ListItem>
                      <ListItemText 
                        primary="Blood Pressure" 
                        secondary={MOCK_PATIENT.vitals.bloodPressure}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary="Heart Rate" 
                        secondary={MOCK_PATIENT.vitals.heartRate}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary="Weight" 
                        secondary={MOCK_PATIENT.vitals.weight}
                      />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Active Conditions</Typography>
                  <List dense>
                    {MOCK_PATIENT.conditions.map((condition, index) => (
                      <ListItem key={index}>
                        <ListItemText 
                          primary={condition.display}
                          secondary={`Status: ${condition.status}`}
                        />
                        <Chip 
                          label={condition.status} 
                          size="small" 
                          color={condition.status === 'active' ? 'error' : 'default'}
                        />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        );

      case 'medication-prescribe':
        return (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>New Prescription</Typography>
              <Stack spacing={2}>
                <TextField
                  label="Medication"
                  value="Metformin 500mg"
                  fullWidth
                  size="small"
                />
                <TextField
                  label="Dosage"
                  value="500mg twice daily"
                  fullWidth
                  size="small"
                />
                <TextField
                  label="Duration"
                  value="30 days"
                  fullWidth
                  size="small"
                />
              </Stack>
            </CardContent>
            <CardActions>
              <Button variant="contained" color="primary">
                Add to Order Set
              </Button>
            </CardActions>
          </Card>
        );

      case 'order-sign':
        return (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Orders to Sign</Typography>
              <List>
                <ListItem>
                  <ListItemIcon>
                    <MedicalIcon />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Hemoglobin A1c"
                    secondary="Lab order - Due for diabetes monitoring"
                  />
                  <Button size="small" variant="outlined">Sign</Button>
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <MedicationIcon />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Metformin 500mg BID"
                    secondary="Medication order - Diabetes management"
                  />
                  <Button size="small" variant="outlined">Sign</Button>
                </ListItem>
              </List>
            </CardContent>
          </Card>
        );

      default:
        return (
          <Typography variant="body1" color="text.secondary">
            Mock clinical interface for {currentScenario.title}
          </Typography>
        );
    }
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Preview Controls */}
      <Paper sx={{ p: 2, borderRadius: 0 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Clinical Scenario</InputLabel>
              <Select
                value={selectedScenario}
                onChange={(e) => setSelectedScenario(e.target.value)}
                label="Clinical Scenario"
              >
                {Object.entries(CLINICAL_SCENARIOS).map(([key, scenario]) => (
                  <MenuItem key={key} value={key}>
                    <Box display="flex" alignItems="center">
                      {scenario.icon}
                      <Box sx={{ ml: 1 }}>
                        <Typography variant="body2">{scenario.title}</Typography>
                      </Box>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={4}>
            <ButtonGroup size="small" fullWidth>
              <Button
                variant={previewMode === 'desktop' ? 'contained' : 'outlined'}
                onClick={() => onPreviewModeChange('desktop')}
                startIcon={<DesktopIcon />}
              >
                Desktop
              </Button>
              <Button
                variant={previewMode === 'tablet' ? 'contained' : 'outlined'}
                onClick={() => onPreviewModeChange('tablet')}
                startIcon={<TabletIcon />}
              >
                Tablet
              </Button>
              <Button
                variant={previewMode === 'mobile' ? 'contained' : 'outlined'}
                onClick={() => onPreviewModeChange('mobile')}
                startIcon={<MobileIcon />}
              >
                Mobile
              </Button>
            </ButtonGroup>
          </Grid>

          <Grid item xs={12} md={4}>
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button
                variant="outlined"
                size="small"
                startIcon={showCDSCards ? <HideIcon /> : <PreviewIcon />}
                onClick={() => setShowCDSCards(!showCDSCards)}
              >
                {showCDSCards ? 'Hide' : 'Show'} Alerts
              </Button>
              <Button
                variant="contained"
                size="small"
                startIcon={<RefreshIcon />}
                onClick={simulateHookExecution}
                disabled={simulationRunning}
              >
                Test Hook
              </Button>
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      {/* Main Preview Area */}
      <Box
        sx={{
          flex: 1,
          backgroundColor: 'grey.100',
          p: 2,
          overflow: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {renderMockClinicalInterface()}
      </Box>

      {/* CDS Card Detail Dialog */}
      <Dialog
        open={!!selectedCard}
        onClose={() => setSelectedCard(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          CDS Alert Details
        </DialogTitle>
        <DialogContent>
          {selectedCard && (
            <Stack spacing={2}>
              <Alert severity={selectedCard.indicator === 'critical' ? 'error' : selectedCard.indicator}>
                <Typography variant="h6" gutterBottom>
                  {selectedCard.summary}
                </Typography>
                <Typography variant="body2">
                  {selectedCard.detail}
                </Typography>
              </Alert>
              <Typography variant="body2" color="text.secondary">
                Source: {selectedCard.source.label}
              </Typography>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedCard(null)}>Close</Button>
          <Button variant="contained" color="primary">
            Accept Recommendation
          </Button>
        </DialogActions>
      </Dialog>

      {/* Spinning animation for refresh icon */}
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .spin {
            animation: spin 1s linear infinite;
          }
        `}
      </style>
    </Box>
  );
};

export default ClinicalIntegrationPreview;