/**
 * DesignSystemShowcase Component
 * Comprehensive demonstration of the enhanced clinical design system
 */
import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Typography,
  Button,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Divider,
  Paper,
  Alert,
  useTheme
} from '@mui/material';
import {
  LocalHospital as HospitalIcon,
  TrendingUp as TrendingUpIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon,
  Medication as MedicationIcon,
  Assignment as AssignmentIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import ClinicalLayout from '../layouts/ClinicalLayout';
import ClinicalCard from '../common/ClinicalCard';
import ClinicalDataTable from '../common/ClinicalDataTable';
import MetricCard from '../common/MetricCard';
import StatusChip from '../common/StatusChip';
import { createMedicalTheme, themePresets } from '../../../themes/medicalTheme';
import { ThemeProvider } from '@mui/material/styles';

const DesignSystemShowcase = () => {
  const [currentTheme, setCurrentTheme] = useState('professional');
  const [currentMode, setCurrentMode] = useState('light');
  const [selectedDepartment, setSelectedDepartment] = useState('cardiology');
  const [urgencyMode, setUrgencyMode] = useState(false);
  const [showAnimations, setShowAnimations] = useState(true);
  const [shiftMode, setShiftMode] = useState('day');
  
  // Create theme with current settings
  const theme = createMedicalTheme(currentTheme, currentMode);
  
  // Sample data for demonstrations
  const samplePatient = {
    id: 'P001',
    name: 'John Doe',
    birthDate: '1985-03-15',
    status: 'active'
  };
  
  const sampleMetrics = [
    {
      title: 'Active Patients',
      value: 156,
      trend: 'up',
      trendValue: 12,
      icon: <PersonIcon />,
      color: 'success',
      severity: 'normal'
    },
    {
      title: 'Pending Orders',
      value: 23,
      trend: 'down',
      trendValue: -5,
      icon: <AssignmentIcon />,
      color: 'warning',
      severity: 'moderate'
    },
    {
      title: 'Critical Alerts',
      value: 4,
      trend: 'up',
      trendValue: 2,
      icon: <WarningIcon />,
      color: 'error',
      severity: 'critical'
    },
    {
      title: 'Medications',
      value: 89,
      trend: 'flat',
      icon: <MedicationIcon />,
      color: 'info',
      severity: 'mild'
    }
  ];
  
  const sampleTableData = [
    {
      id: 1,
      patient: 'Alice Johnson',
      test: 'Hemoglobin A1c',
      value: 9.2,
      unit: '%',
      status: 'pending',
      date: '2024-01-17',
      severity: 'severe'
    },
    {
      id: 2,
      patient: 'Bob Smith',
      test: 'Blood Pressure',
      value: 140,
      unit: 'mmHg',
      status: 'completed',
      date: '2024-01-16',
      severity: 'moderate'
    },
    {
      id: 3,
      patient: 'Carol Davis',
      test: 'Cholesterol',
      value: 180,
      unit: 'mg/dL',
      status: 'active',
      date: '2024-01-15',
      severity: 'mild'
    },
    {
      id: 4,
      patient: 'David Wilson',
      test: 'Glucose',
      value: 95,
      unit: 'mg/dL',
      status: 'completed',
      date: '2024-01-14',
      severity: 'normal'
    }
  ];
  
  const tableColumns = [
    { key: 'patient', label: 'Patient', sortable: true },
    { key: 'test', label: 'Test', sortable: true },
    { 
      key: 'value', 
      label: 'Result', 
      type: 'severity',
      severityRules: {
        critical: { min: 11, max: 100 },
        severe: { min: 9, max: 10.9 },
        moderate: { min: 7, max: 8.9 },
        mild: { min: 5.7, max: 6.9 },
        normal: { min: 0, max: 5.6 }
      }
    },
    { key: 'status', label: 'Status', type: 'status' },
    { key: 'date', label: 'Date', type: 'date' },
    { 
      key: 'actions', 
      label: 'Actions', 
      type: 'action',
      actions: [
        { type: 'edit', icon: <EditIcon />, color: 'primary' },
        { type: 'delete', icon: <DeleteIcon />, color: 'error' }
      ]
    }
  ];
  
  const handleThemeChange = (newTheme, options = {}) => {
    setCurrentTheme(newTheme);
    if (options.department) {
      setSelectedDepartment(options.department);
    }
  };
  
  const handleModeChange = (newMode) => {
    setCurrentMode(newMode);
  };
  
  // Auto-update shift mode based on time
  useEffect(() => {
    const updateShiftMode = () => {
      const hour = new Date().getHours();
      if (hour >= 6 && hour < 18) {
        setShiftMode('day');
      } else if (hour >= 18 && hour < 22) {
        setShiftMode('evening');
      } else {
        setShiftMode('night');
      }
    };
    
    updateShiftMode();
    const interval = setInterval(updateShiftMode, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, []);
  
  return (
    <ThemeProvider theme={theme}>
      <ClinicalLayout
        title="WintEHR Design System Showcase"
        subtitle="Enhanced Clinical Interface Demonstration"
        department={selectedDepartment}
        urgency={urgencyMode ? 'urgent' : 'normal'}
        patientContext={samplePatient}
        currentTheme={currentTheme}
        currentMode={currentMode}
        onThemeChange={handleThemeChange}
        onModeChange={handleModeChange}
        showPatientInfo={true}
        showDepartmentInfo={true}
        showTimeInfo={true}
      >
        <Stack spacing={4}>
          {/* Control Panel */}
          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h5" gutterBottom>
              Design System Controls
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Theme</InputLabel>
                  <Select
                    value={currentTheme}
                    label="Theme"
                    onChange={(e) => setCurrentTheme(e.target.value)}
                  >
                    {Object.entries(themePresets).map(([key, preset]) => (
                      <MenuItem key={key} value={key}>
                        {preset.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Department</InputLabel>
                  <Select
                    value={selectedDepartment}
                    label="Department"
                    onChange={(e) => setSelectedDepartment(e.target.value)}
                  >
                    <MenuItem value="general">General</MenuItem>
                    <MenuItem value="emergency">Emergency</MenuItem>
                    <MenuItem value="cardiology">Cardiology</MenuItem>
                    <MenuItem value="pediatrics">Pediatrics</MenuItem>
                    <MenuItem value="oncology">Oncology</MenuItem>
                    <MenuItem value="neurology">Neurology</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <FormControlLabel
                    control={
                      <Switch
                        checked={urgencyMode}
                        onChange={(e) => setUrgencyMode(e.target.checked)}
                      />
                    }
                    label="Urgent Mode"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={showAnimations}
                        onChange={(e) => setShowAnimations(e.target.checked)}
                      />
                    }
                    label="Animations"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={currentMode === 'dark'}
                        onChange={(e) => setCurrentMode(e.target.checked ? 'dark' : 'light')}
                      />
                    }
                    label="Dark Mode"
                  />
                </Stack>
              </Grid>
            </Grid>
          </Paper>
          
          {/* Metrics Dashboard */}
          <Box>
            <Typography variant="h5" gutterBottom>
              Clinical Metrics Dashboard
            </Typography>
            <Grid container spacing={3}>
              {sampleMetrics.map((metric, index) => (
                <Grid item xs={12} sm={6} md={3} key={index}>
                  <MetricCard
                    title={metric.title}
                    value={metric.value}
                    trend={metric.trend}
                    trendValue={metric.trendValue}
                    icon={metric.icon}
                    color={metric.color}
                    severity={metric.severity}
                    variant="clinical"
                    department={selectedDepartment}
                    urgency={urgencyMode ? 'urgent' : 'normal'}
                    onClick={() => console.log('Metric clicked:', metric.title)}
                  />
                </Grid>
              ))}
            </Grid>
          </Box>
          
          {/* Status Chips Showcase */}
          <Box>
            <Typography variant="h5" gutterBottom>
              Status Indicators
            </Typography>
            <Stack direction="row" spacing={2} flexWrap="wrap" gap={1}>
              {['active', 'pending', 'completed', 'cancelled', 'in-progress', 'draft'].map((status) => (
                <StatusChip
                  key={status}
                  status={status}
                  variant="clinical"
                  department={selectedDepartment}
                  urgency={urgencyMode ? 'urgent' : 'normal'}
                />
              ))}
            </Stack>
          </Box>
          
          {/* Clinical Cards */}
          <Box>
            <Typography variant="h5" gutterBottom>
              Clinical Information Cards
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <ClinicalCard
                  title="Patient Assessment"
                  subtitle="Comprehensive evaluation completed"
                  status="completed"
                  severity="normal"
                  department={selectedDepartment}
                  urgent={urgencyMode}
                  expandable={true}
                  icon={<CheckCircleIcon />}
                  timestamp={new Date().toISOString()}
                >
                  <Typography variant="body2" color="text.secondary">
                    Patient shows stable vital signs with no acute distress. 
                    Recommended for routine follow-up in 3 months.
                  </Typography>
                </ClinicalCard>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <ClinicalCard
                  title="Critical Lab Results"
                  subtitle="Requires immediate attention"
                  status="pending"
                  severity="critical"
                  priority="urgent"
                  department={selectedDepartment}
                  urgent={true}
                  icon={<WarningIcon />}
                  timestamp={new Date().toISOString()}
                  actions={
                    <Button variant="contained" color="error" size="small">
                      Review Now
                    </Button>
                  }
                >
                  <Alert severity="error" sx={{ mb: 2 }}>
                    Hemoglobin A1c: 12.5% (Critical High)
                  </Alert>
                  <Typography variant="body2" color="text.secondary">
                    Patient requires immediate intervention for diabetes management.
                  </Typography>
                </ClinicalCard>
              </Grid>
            </Grid>
          </Box>
          
          {/* Clinical Data Table */}
          <Box>
            <Typography variant="h5" gutterBottom>
              Clinical Data Table
            </Typography>
            <ClinicalDataTable
              data={sampleTableData}
              columns={tableColumns}
              department={selectedDepartment}
              urgency={urgencyMode ? 'urgent' : 'normal'}
              showSeverityIndicators={true}
              showStatusChips={true}
              showTrendIndicators={true}
              onRowClick={(row) => console.log('Row clicked:', row)}
              onRowAction={(row, action) => console.log('Action:', action, 'on row:', row)}
            />
          </Box>
          
          {/* Theme Information */}
          <Paper elevation={1} sx={{ p: 3, mt: 4 }}>
            <Typography variant="h6" gutterBottom>
              Current Theme Configuration
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Typography variant="body2" color="text.secondary">
                  <strong>Theme:</strong> {themePresets[currentTheme]?.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>Mode:</strong> {currentMode.charAt(0).toUpperCase() + currentMode.slice(1)}
                </Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="body2" color="text.secondary">
                  <strong>Department:</strong> {selectedDepartment.charAt(0).toUpperCase() + selectedDepartment.slice(1)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>Shift:</strong> {shiftMode.charAt(0).toUpperCase() + shiftMode.slice(1)}
                </Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="body2" color="text.secondary">
                  <strong>Urgency:</strong> {urgencyMode ? 'Urgent' : 'Normal'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>Animations:</strong> {showAnimations ? 'Enabled' : 'Disabled'}
                </Typography>
              </Grid>
            </Grid>
          </Paper>
        </Stack>
      </ClinicalLayout>
    </ThemeProvider>
  );
};

export default DesignSystemShowcase;