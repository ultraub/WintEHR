import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  Chip,
  List,
  ListItem,
  ListItemText,
  Divider,
  Alert,
  CircularProgress,
  Tab,
  Tabs
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  LocalHospital as HospitalIcon,
  Timeline as TimelineIcon,
  Science as ScienceIcon,
  Description as DescriptionIcon
} from '@mui/icons-material';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { format, parseISO, differenceInDays } from 'date-fns';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`summary-tabpanel-${index}`}
      aria-labelledby={`summary-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  );
}

const PatientSummary = ({ patient, encounters, conditions, medications, observations }) => {
  const [tabValue, setTabValue] = useState(0);
  const [vitalsData, setVitalsData] = useState(null);
  const [medicalSummary, setMedicalSummary] = useState(null);

  useEffect(() => {
    if (observations && encounters) {
      generateVitalsData();
      generateMedicalSummary();
    }
  }, [observations, encounters, conditions, medications]);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const generateVitalsData = () => {
    // Filter vital signs from observations
    const vitals = observations.filter(obs => obs.observation_type === 'vital-signs');
    
    // Group by vital type with better pattern matching
    const vitalTypes = {
      'Blood Pressure': [],
      'Heart Rate': [],
      'Temperature': [],
      'Weight': [],
      'Height': [],
      'Oxygen Saturation': [],
      'Respiratory Rate': [],
      'BMI': []
    };

    vitals.forEach(vital => {
      const vitalName = vital.display.toLowerCase();
      const date = parseISO(vital.observation_date);
      
      // Enhanced pattern matching for different vital sign formats
      if (vitalName.includes('blood pressure') || vitalName.includes('bp') || vitalName.includes('systolic') || vitalName.includes('diastolic')) {
        if (typeof vital.value === 'string' && vital.value.includes('/')) {
          const [systolic, diastolic] = vital.value.split('/').map(Number);
          if (!isNaN(systolic) && !isNaN(diastolic)) {
            vitalTypes['Blood Pressure'].push({
              date,
              systolic,
              diastolic,
              label: format(date, 'MM/dd'),
              isAbnormal: systolic > 140 || systolic < 90 || diastolic > 90 || diastolic < 60
            });
          }
        }
      } else if (vitalName.includes('heart rate') || vitalName.includes('pulse') || vitalName.includes('hr')) {
        const value = parseFloat(vital.value);
        if (!isNaN(value)) {
          vitalTypes['Heart Rate'].push({
            date,
            value,
            label: format(date, 'MM/dd'),
            isAbnormal: value > 100 || value < 60
          });
        }
      } else if (vitalName.includes('temperature') || vitalName.includes('temp')) {
        const value = parseFloat(vital.value);
        if (!isNaN(value)) {
          vitalTypes['Temperature'].push({
            date,
            value,
            label: format(date, 'MM/dd'),
            isAbnormal: value > 99.5 || value < 97.0
          });
        }
      } else if (vitalName.includes('weight') || vitalName.includes('wt')) {
        const value = parseFloat(vital.value);
        if (!isNaN(value)) {
          vitalTypes['Weight'].push({
            date,
            value,
            label: format(date, 'MM/dd'),
            isAbnormal: false // Would need patient-specific normal ranges
          });
        }
      } else if (vitalName.includes('height') || vitalName.includes('ht')) {
        const value = parseFloat(vital.value);
        if (!isNaN(value)) {
          vitalTypes['Height'].push({
            date,
            value,
            label: format(date, 'MM/dd'),
            isAbnormal: false
          });
        }
      } else if (vitalName.includes('oxygen') || vitalName.includes('o2') || vitalName.includes('spo2') || vitalName.includes('sat')) {
        const value = parseFloat(vital.value);
        if (!isNaN(value)) {
          vitalTypes['Oxygen Saturation'].push({
            date,
            value,
            label: format(date, 'MM/dd'),
            isAbnormal: value < 95
          });
        }
      } else if (vitalName.includes('respiratory') || vitalName.includes('breath') || vitalName.includes('rr')) {
        const value = parseFloat(vital.value);
        if (!isNaN(value)) {
          vitalTypes['Respiratory Rate'].push({
            date,
            value,
            label: format(date, 'MM/dd'),
            isAbnormal: value > 20 || value < 12
          });
        }
      } else if (vitalName.includes('bmi') || vitalName.includes('body mass')) {
        const value = parseFloat(vital.value);
        if (!isNaN(value)) {
          vitalTypes['BMI'].push({
            date,
            value,
            label: format(date, 'MM/dd'),
            isAbnormal: value > 30 || value < 18.5
          });
        }
      }
    });

    // Sort by date and prepare chart data
    Object.keys(vitalTypes).forEach(type => {
      vitalTypes[type].sort((a, b) => a.date - b.date);
    });

    setVitalsData(vitalTypes);
  };

  const generateMedicalSummary = () => {
    // Separate medical conditions from social history
    const socialHistoryTerms = [
      'education', 'employment', 'social', 'housing', 'stress', 'isolation',
      'tobacco', 'alcohol', 'substance', 'exercise', 'diet', 'nutrition',
      'income', 'transportation', 'marital', 'living', 'lifestyle',
      'activity', 'occupation', 'school', 'work', 'job', 'unemployed',
      'disability', 'veteran', 'immigrant', 'language', 'homeless',
      'full-time', 'part-time', 'retired', 'student', 'not in labor force',
      'risk activity', 'partner abuse', 'victim', 'unemployed', 'labor force',
      'educated', 'high school', 'college', 'limited social contact',
      'social isolation', 'drinking behavior', 'smoking', 'never smoked'
    ];
    
    const allActiveConditions = conditions.filter(cond => 
      cond.clinical_status?.toLowerCase() === 'active'
    );
    
    // Medical condition exclusion terms
    const medicalExclusionTerms = [
      'disease', 'disorder', 'syndrome', 'injury', 'fracture', 'cancer',
      'infection', 'failure', 'stenosis', 'hypertension', 'diabetes',
      'asthma', 'copd', 'pneumonia', 'arthritis', 'pain'
    ];
    
    // Common SNOMED codes for social history
    const socialHistorySnomedCodes = [
      '160903007', // Full-time employment
      '160904001', // Part-time employment  
      '423315002', // Limited social contact
      '105531004', // Housing unsatisfactory
      '73438004',  // Unemployed
      '422979000', // Social isolation
      '224362002', // Educated to high school level
      '160906009', // Retired
      '224363007', // Not in labor force
      '428024001', // Clinical finding absent (for "never smoked", etc)
    ];
    
    // Filter conditions into medical and social
    const activeConditions = allActiveConditions.filter(cond => {
      const desc = (cond.description || '').toLowerCase();
      // If it contains medical terms, it's definitely medical
      if (medicalExclusionTerms.some(term => desc.includes(term))) {
        return true;
      }
      // Check if it's a social history SNOMED code
      if (cond.snomed_code && socialHistorySnomedCodes.includes(cond.snomed_code)) {
        return false;
      }
      // Otherwise, check if it's social history by description
      return !socialHistoryTerms.some(term => desc.includes(term));
    });
    
    const socialHistory = allActiveConditions.filter(cond => {
      const desc = (cond.description || '').toLowerCase();
      // If it contains medical terms, it's not social history
      if (medicalExclusionTerms.some(term => desc.includes(term))) {
        return false;
      }
      // Check SNOMED codes first
      if (cond.snomed_code && socialHistorySnomedCodes.includes(cond.snomed_code)) {
        return true;
      }
      // Check if it matches social history terms
      return socialHistoryTerms.some(term => desc.includes(term));
    });

    // Recent encounters (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const recentEncounters = encounters.filter(enc => 
      parseISO(enc.encounter_date) >= sixMonthsAgo
    ).sort((a, b) => parseISO(b.encounter_date) - parseISO(a.encounter_date));

    // Active medications
    const activeMedications = medications.filter(med => 
      med.status?.toLowerCase() === 'active'
    );

    // Recent lab results (last 30 days) and all labs for trending
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const allLabs = observations.filter(obs => obs.observation_type === 'laboratory');
    const recentLabs = allLabs.filter(obs => 
      parseISO(obs.observation_date) >= thirtyDaysAgo
    ).sort((a, b) => parseISO(b.observation_date) - parseISO(a.observation_date));

    // Group labs by type for trending
    const labTrends = {};
    allLabs.forEach(lab => {
      const labName = lab.display;
      if (!labTrends[labName]) {
        labTrends[labName] = [];
      }
      const value = parseFloat(lab.value);
      if (!isNaN(value)) {
        labTrends[labName].push({
          date: parseISO(lab.observation_date),
          value,
          label: format(parseISO(lab.observation_date), 'MM/dd'),
          isAbnormal: checkLabAbnormal(labName, value)
        });
      }
    });

    // Sort lab trends by date
    Object.keys(labTrends).forEach(labName => {
      labTrends[labName].sort((a, b) => a.date - b.date);
    });

    // Identify critical values and alerts
    const alerts = [];
    
    // Check for abnormal vital signs
    if (vitalsData) {
      Object.entries(vitalsData).forEach(([vitalType, data]) => {
        if (data.length > 0) {
          const latest = data[data.length - 1];
          if (latest.isAbnormal) {
            let message = '';
            if (vitalType === 'Blood Pressure') {
              message = `Abnormal Blood Pressure: ${latest.systolic}/${latest.diastolic} mmHg`;
            } else {
              message = `Abnormal ${vitalType}: ${latest.value}`;
            }
            alerts.push({
              type: 'warning',
              message,
              date: latest.date.toISOString()
            });
          }
        }
      });
    }
    
    // Check for abnormal lab values with comprehensive ranges
    recentLabs.forEach(lab => {
      const value = parseFloat(lab.value);
      if (!isNaN(value)) {
        const abnormalInfo = getLabAbnormalInfo(lab.display, value);
        if (abnormalInfo) {
          alerts.push({
            type: abnormalInfo.severity,
            message: abnormalInfo.message,
            date: lab.observation_date
          });
        }
      }
    });

    // Check medication adherence gaps
    activeMedications.forEach(med => {
      const daysSinceStart = differenceInDays(new Date(), parseISO(med.start_date));
      if (daysSinceStart > 90 && !recentEncounters.length) {
        alerts.push({
          type: 'info',
          message: `Medication follow-up due: ${med.medication_name}`,
          date: new Date().toISOString()
        });
      }
    });

    // Check for drug interactions (simplified)
    const drugInteractions = checkDrugInteractions(activeMedications);
    drugInteractions.forEach(interaction => {
      alerts.push({
        type: 'warning',
        message: `Potential drug interaction: ${interaction}`,
        date: new Date().toISOString()
      });
    });

    setMedicalSummary({
      activeConditions,
      socialHistory,
      recentEncounters,
      activeMedications,
      recentLabs,
      labTrends,
      alerts: alerts.slice(0, 8) // Show top 8 alerts
    });
  };

  const checkLabAbnormal = (labName, value) => {
    const name = labName.toLowerCase();
    if (name.includes('hemoglobin') || name.includes('hgb')) {
      return value < 12.0 || value > 16.0;
    }
    if (name.includes('hematocrit') || name.includes('hct')) {
      return value < 36.0 || value > 46.0;
    }
    if (name.includes('glucose')) {
      return value < 70 || value > 140;
    }
    if (name.includes('a1c') || name.includes('hemoglobin a1c')) {
      return value > 7.0;
    }
    if (name.includes('creatinine')) {
      return value > 1.3;
    }
    if (name.includes('ldl')) {
      return value > 100;
    }
    if (name.includes('hdl')) {
      return value < 40;
    }
    if (name.includes('triglycerides')) {
      return value > 150;
    }
    if (name.includes('cholesterol') && !name.includes('ldl') && !name.includes('hdl')) {
      return value > 200;
    }
    if (name.includes('sodium')) {
      return value < 136 || value > 145;
    }
    if (name.includes('potassium')) {
      return value < 3.5 || value > 5.0;
    }
    if (name.includes('white blood cell') || name.includes('wbc')) {
      return value < 4.5 || value > 11.0;
    }
    if (name.includes('platelet')) {
      return value < 150 || value > 450;
    }
    return false;
  };

  const getLabAbnormalInfo = (labName, value) => {
    const name = labName.toLowerCase();
    
    if (name.includes('a1c') && value > 7.0) {
      return {
        severity: value > 9.0 ? 'error' : 'warning',
        message: `Elevated HbA1c: ${value}% (Target <7%)`
      };
    }
    if (name.includes('glucose') && (value > 140 || value < 70)) {
      return {
        severity: value > 250 || value < 50 ? 'error' : 'warning',
        message: `Abnormal Glucose: ${value} mg/dL (Normal: 70-140)`
      };
    }
    if (name.includes('creatinine') && value > 1.3) {
      return {
        severity: value > 2.0 ? 'error' : 'warning',
        message: `Elevated Creatinine: ${value} mg/dL (Normal: 0.6-1.2)`
      };
    }
    if (name.includes('ldl') && value > 100) {
      return {
        severity: value > 160 ? 'warning' : 'info',
        message: `LDL above target: ${value} mg/dL (Target <100)`
      };
    }
    if (name.includes('hemoglobin') && (value < 12.0 || value > 16.0)) {
      return {
        severity: value < 8.0 || value > 18.0 ? 'error' : 'warning',
        message: `Abnormal Hemoglobin: ${value} g/dL (Normal: 12-16)`
      };
    }
    if (name.includes('potassium') && (value < 3.5 || value > 5.0)) {
      return {
        severity: value < 3.0 || value > 5.5 ? 'error' : 'warning',
        message: `Abnormal Potassium: ${value} mmol/L (Normal: 3.5-5.0)`
      };
    }
    if (name.includes('sodium') && (value < 136 || value > 145)) {
      return {
        severity: value < 130 || value > 150 ? 'error' : 'warning',
        message: `Abnormal Sodium: ${value} mmol/L (Normal: 136-145)`
      };
    }
    
    return null;
  };

  const checkDrugInteractions = (medications) => {
    const interactions = [];
    const drugList = medications.map(med => med.medication_name.toLowerCase());
    
    // Simple interaction checking
    if (drugList.includes('warfarin') && drugList.some(drug => drug.includes('aspirin'))) {
      interactions.push('Warfarin + Aspirin (increased bleeding risk)');
    }
    if (drugList.some(drug => drug.includes('ace inhibitor')) && drugList.includes('potassium')) {
      interactions.push('ACE Inhibitor + Potassium (hyperkalemia risk)');
    }
    if (drugList.includes('metformin') && drugList.some(drug => drug.includes('contrast'))) {
      interactions.push('Metformin + Contrast (lactic acidosis risk)');
    }
    
    return interactions;
  };

  const createVitalChart = (vitalType, data) => {
    if (!data || data.length === 0) return null;

    const chartData = {
      labels: data.map(d => d.label),
      datasets: vitalType === 'Blood Pressure' ? [
        {
          label: 'Systolic',
          data: data.map(d => d.systolic),
          borderColor: data.some(d => d.isAbnormal) ? 'rgb(255, 152, 0)' : 'rgb(0, 188, 212)',
          backgroundColor: data.some(d => d.isAbnormal) ? 'rgba(255, 152, 0, 0.1)' : 'rgba(0, 188, 212, 0.1)',
          tension: 0.3,
          fill: false,
          pointBackgroundColor: data.map(d => d.isAbnormal ? 'rgb(255, 152, 0)' : 'rgb(0, 188, 212)'),
          pointRadius: data.map(d => d.isAbnormal ? 6 : 4)
        },
        {
          label: 'Diastolic', 
          data: data.map(d => d.diastolic),
          borderColor: data.some(d => d.isAbnormal) ? 'rgb(255, 152, 0)' : 'rgb(38, 198, 218)',
          backgroundColor: data.some(d => d.isAbnormal) ? 'rgba(255, 152, 0, 0.1)' : 'rgba(38, 198, 218, 0.1)',
          tension: 0.3,
          fill: false,
          pointBackgroundColor: data.map(d => d.isAbnormal ? 'rgb(255, 152, 0)' : 'rgb(38, 198, 218)'),
          pointRadius: data.map(d => d.isAbnormal ? 6 : 4)
        }
      ] : [
        {
          label: vitalType,
          data: data.map(d => d.value),
          borderColor: data.some(d => d.isAbnormal) ? 'rgb(255, 152, 0)' : 'rgb(75, 192, 192)',
          backgroundColor: data.some(d => d.isAbnormal) ? 'rgba(255, 152, 0, 0.1)' : 'rgba(75, 192, 192, 0.1)',
          tension: 0.3,
          fill: true,
          pointBackgroundColor: data.map(d => d.isAbnormal ? 'rgb(255, 152, 0)' : 'rgb(75, 192, 192)'),
          pointRadius: data.map(d => d.isAbnormal ? 6 : 4)
        }
      ]
    };

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
        },
        title: {
          display: true,
          text: `${vitalType} Trend`
        }
      },
      scales: {
        y: {
          beginAtZero: vitalType !== 'Temperature',
          title: {
            display: true,
            text: getVitalUnit(vitalType)
          }
        }
      }
    };

    return (
      <Box sx={{ height: 200, mt: 1 }}>
        <Line data={chartData} options={options} />
      </Box>
    );
  };

  const getVitalUnit = (vitalType) => {
    const units = {
      'Blood Pressure': 'mmHg',
      'Heart Rate': 'bpm',
      'Temperature': '°F',
      'Weight': 'lbs',
      'Height': 'in',
      'Oxygen Saturation': '%'
    };
    return units[vitalType] || '';
  };

  const createLabChart = (labName, data) => {
    if (!data || data.length === 0) return null;

    const chartData = {
      labels: data.map(d => d.label),
      datasets: [{
        label: labName,
        data: data.map(d => d.value),
        borderColor: data.some(d => d.isAbnormal) ? 'rgb(255, 152, 0)' : 'rgb(255, 107, 107)',
        backgroundColor: data.some(d => d.isAbnormal) ? 'rgba(255, 152, 0, 0.1)' : 'rgba(255, 107, 107, 0.1)',
        tension: 0.3,
        fill: true,
        pointBackgroundColor: data.map(d => d.isAbnormal ? 'rgb(255, 152, 0)' : 'rgb(255, 107, 107)'),
        pointBorderColor: data.map(d => d.isAbnormal ? 'rgb(255, 152, 0)' : 'rgb(255, 107, 107)'),
        pointRadius: data.map(d => d.isAbnormal ? 6 : 4),
        pointHoverRadius: data.map(d => d.isAbnormal ? 8 : 6)
      }]
    };

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
        },
        title: {
          display: true,
          text: `${labName} Trend`
        },
        tooltip: {
          callbacks: {
            afterLabel: function(context) {
              const point = data[context.dataIndex];
              return point.isAbnormal ? 'Abnormal' : 'Normal';
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: false,
          title: {
            display: true,
            text: medicalSummary.recentLabs.find(lab => lab.display === labName)?.unit || 'Value'
          }
        }
      }
    };

    return (
      <Box sx={{ height: 200, mt: 1 }}>
        <Line data={chartData} options={options} />
      </Box>
    );
  };

  const getAlertIcon = (type) => {
    switch (type) {
      case 'warning': return <WarningIcon color="warning" />;
      case 'error': return <WarningIcon color="error" />;
      default: return <CheckCircleIcon color="info" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'active': return 'success';
      case 'completed': return 'default';
      case 'stopped': return 'error';
      case 'inactive': return 'warning';
      default: return 'default';
    }
  };

  if (!medicalSummary) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Medical Alerts */}
      {medicalSummary.alerts.length > 0 && (
        <Card sx={{ mb: 3, borderLeft: 4, borderLeftColor: 'warning.main' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <WarningIcon color="warning" />
              Clinical Alerts & Reminders
            </Typography>
            <List dense>
              {medicalSummary.alerts.map((alert, index) => (
                <ListItem key={index} sx={{ px: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                    {getAlertIcon(alert.type)}
                    <ListItemText
                      primary={alert.message}
                      secondary={format(parseISO(alert.date), 'MMM dd, yyyy')}
                    />
                  </Box>
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      )}

      {/* Summary Tabs */}
      <Paper sx={{ width: '100%' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange} aria-label="patient summary tabs">
            <Tab label="Clinical Overview" />
            <Tab label="Vital Trends" />
            <Tab label="Lab Trends" />
            <Tab label="Care Timeline" />
            <Tab label="Social History" />
            <Tab label="Notes" />
          </Tabs>
        </Box>

        {/* Clinical Overview Tab */}
        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            {/* Active Conditions */}
            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <HospitalIcon color="primary" />
                    Active Conditions ({medicalSummary.activeConditions.length})
                  </Typography>
                  <List dense>
                    {medicalSummary.activeConditions.slice(0, 5).map((condition) => (
                      <ListItem key={condition.id} sx={{ px: 0 }}>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body1">{condition.description}</Typography>
                              {(condition.icd10_code?.trim() || condition.snomed_code?.trim()) && (
                                <Chip 
                                  label={condition.icd10_code?.trim() || `SNOMED: ${condition.snomed_code}`} 
                                  size="small" 
                                  variant="outlined"
                                />
                              )}
                            </Box>
                          }
                          secondary={`Since ${format(parseISO(condition.onset_date), 'MMM yyyy')}`}
                        />
                      </ListItem>
                    ))}
                    {medicalSummary.activeConditions.length === 0 && (
                      <Typography variant="body2" color="text.secondary">
                        No active conditions recorded
                      </Typography>
                    )}
                  </List>
                </CardContent>
              </Card>
            </Grid>

            {/* Current Medications */}
            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Current Medications ({medicalSummary.activeMedications.length})
                  </Typography>
                  <List dense>
                    {medicalSummary.activeMedications.slice(0, 5).map((medication) => (
                      <ListItem key={medication.id} sx={{ px: 0 }}>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                                {medication.medication_name}
                              </Typography>
                              <Chip 
                                label={medication.status} 
                                color={getStatusColor(medication.status)}
                                size="small"
                              />
                            </Box>
                          }
                          secondary={
                            [medication.dosage, medication.frequency]
                              .filter(Boolean)
                              .join(', ') || 'Dosage information not available'
                          }
                        />
                      </ListItem>
                    ))}
                    {medicalSummary.activeMedications.length === 0 && (
                      <Typography variant="body2" color="text.secondary">
                        No active medications recorded
                      </Typography>
                    )}
                  </List>
                </CardContent>
              </Card>
            </Grid>

            {/* Recent Lab Results */}
            <Grid item xs={12}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Recent Lab Results (Last 30 Days)
                  </Typography>
                  {medicalSummary.recentLabs.length > 0 ? (
                    <Grid container spacing={2}>
                      {medicalSummary.recentLabs.slice(0, 6).map((lab) => (
                        <Grid item xs={6} sm={4} md={2} key={lab.id}>
                          <Box sx={{ 
                            p: 2, 
                            border: 1, 
                            borderColor: checkLabAbnormal(lab.display, parseFloat(lab.value)) ? 'warning.main' : 'divider', 
                            borderRadius: 1,
                            textAlign: 'center',
                            bgcolor: checkLabAbnormal(lab.display, parseFloat(lab.value)) ? 'warning.light' : 'transparent',
                            position: 'relative'
                          }}>
                            {checkLabAbnormal(lab.display, parseFloat(lab.value)) && (
                              <WarningIcon 
                                color="warning" 
                                fontSize="small" 
                                sx={{ position: 'absolute', top: 4, right: 4 }}
                              />
                            )}
                            <Typography variant="body2" color="text.secondary" noWrap>
                              {lab.display}
                            </Typography>
                            <Typography variant="h6" sx={{ 
                              fontWeight: 'bold',
                              color: checkLabAbnormal(lab.display, parseFloat(lab.value)) ? 'warning.dark' : 'inherit'
                            }}>
                              {lab.value}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {lab.unit}
                            </Typography>
                            <Typography variant="caption" display="block" color="text.secondary">
                              {format(parseISO(lab.observation_date), 'MM/dd')}
                            </Typography>
                            {checkLabAbnormal(lab.display, parseFloat(lab.value)) && (
                              <Chip 
                                label="Abnormal" 
                                color="warning" 
                                size="small" 
                                sx={{ mt: 0.5, fontSize: '0.6rem', height: '16px' }}
                              />
                            )}
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No recent lab results available
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Social History Summary */}
            <Grid item xs={12}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ScienceIcon color="primary" />
                    Social History Summary
                  </Typography>
                  {medicalSummary.socialHistory && medicalSummary.socialHistory.length > 0 ? (
                    <Grid container spacing={2}>
                      {medicalSummary.socialHistory.slice(0, 6).map((item) => (
                        <Grid item xs={12} sm={6} md={4} key={item.id}>
                          <Box sx={{ 
                            p: 2, 
                            border: 1, 
                            borderColor: 'divider', 
                            borderRadius: 1,
                            bgcolor: 'background.paper'
                          }}>
                            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                              {item.description}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Since {format(parseISO(item.onset_date), 'MMM yyyy')}
                            </Typography>
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No social history recorded
                    </Typography>
                  )}
                  {medicalSummary.socialHistory && medicalSummary.socialHistory.length > 6 && (
                    <Box sx={{ mt: 2, textAlign: 'center' }}>
                      <Typography variant="caption" color="text.secondary">
                        View all {medicalSummary.socialHistory.length} items in the Social History tab
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Vital Trends Tab */}
        <TabPanel value={tabValue} index={1}>
          {vitalsData ? (
            <Grid container spacing={3}>
              {Object.entries(vitalsData).map(([vitalType, data]) => 
                data.length > 0 && (
                  <Grid item xs={12} md={6} key={vitalType}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <TrendingUpIcon color="primary" />
                          {vitalType}
                          {data.some(d => d.isAbnormal) && (
                            <WarningIcon color="warning" fontSize="small" />
                          )}
                        </Typography>
                        {createVitalChart(vitalType, data)}
                        {data.length > 0 && (
                          <Box sx={{ mt: 1 }}>
                            <Typography variant="caption" color="text.secondary" display="block">
                              Latest: {vitalType === 'Blood Pressure' 
                                ? `${data[data.length - 1].systolic}/${data[data.length - 1].diastolic}` 
                                : data[data.length - 1].value} {getVitalUnit(vitalType)}
                              {data[data.length - 1].isAbnormal && (
                                <Chip 
                                  label="Abnormal" 
                                  color="warning" 
                                  size="small" 
                                  sx={{ ml: 1, fontSize: '0.6rem', height: '16px' }}
                                />
                              )}
                            </Typography>
                          </Box>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                )
              )}
              {Object.values(vitalsData).every(data => data.length === 0) && (
                <Grid item xs={12}>
                  <Alert severity="info">
                    No vital signs data available for trending analysis
                  </Alert>
                </Grid>
              )}
            </Grid>
          ) : (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
              <CircularProgress />
            </Box>
          )}
        </TabPanel>

        {/* Lab Trends Tab */}
        <TabPanel value={tabValue} index={2}>
          {medicalSummary.labTrends && Object.keys(medicalSummary.labTrends).length > 0 ? (
            <Grid container spacing={3}>
              {Object.entries(medicalSummary.labTrends).map(([labName, data]) => 
                data.length > 1 && (
                  <Grid item xs={12} md={6} key={labName}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <ScienceIcon color="primary" />
                          {labName}
                          {data.some(d => d.isAbnormal) && (
                            <WarningIcon color="warning" fontSize="small" />
                          )}
                        </Typography>
                        {createLabChart(labName, data)}
                        {data.length > 0 && (
                          <Box sx={{ mt: 1 }}>
                            <Typography variant="caption" color="text.secondary" display="block">
                              Latest: {data[data.length - 1].value} 
                              {medicalSummary.recentLabs.find(lab => lab.display === labName)?.unit || ''}
                              {data[data.length - 1].isAbnormal && (
                                <Chip 
                                  label="Abnormal" 
                                  color="warning" 
                                  size="small" 
                                  sx={{ ml: 1, fontSize: '0.6rem', height: '16px' }}
                                />
                              )}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Trend: {data.length} values over {Math.round((data[data.length - 1].date - data[0].date) / (1000 * 60 * 60 * 24))} days
                            </Typography>
                          </Box>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                )
              )}
              {Object.values(medicalSummary.labTrends).every(data => data.length <= 1) && (
                <Grid item xs={12}>
                  <Alert severity="info">
                    No lab trends available (need multiple values over time for trending analysis)
                  </Alert>
                </Grid>
              )}
            </Grid>
          ) : (
            <Alert severity="info">
              No laboratory data available for trending analysis
            </Alert>
          )}
        </TabPanel>

        {/* Care Timeline Tab */}
        <TabPanel value={tabValue} index={3}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TimelineIcon color="primary" />
                Recent Care Timeline
              </Typography>
              <List>
                {medicalSummary.recentEncounters.map((encounter, index) => (
                  <React.Fragment key={encounter.id}>
                    <ListItem alignItems="flex-start" sx={{ px: 0 }}>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                              {encounter.encounter_type}
                            </Typography>
                            <Chip label={encounter.status} color="success" size="small" />
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              {format(parseISO(encounter.encounter_date), 'MMM dd, yyyy - h:mm a')}
                            </Typography>
                            <Typography variant="body2" sx={{ mt: 1 }}>
                              <strong>Chief Complaint:</strong> {encounter.chief_complaint}
                            </Typography>
                            {encounter.notes && (
                              <Typography variant="body2" sx={{ mt: 1 }}>
                                <strong>Notes:</strong> {encounter.notes.substring(0, 200)}
                                {encounter.notes.length > 200 && '...'}
                              </Typography>
                            )}
                          </Box>
                        }
                      />
                    </ListItem>
                    {index < medicalSummary.recentEncounters.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
                {medicalSummary.recentEncounters.length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    No recent encounters recorded
                  </Typography>
                )}
              </List>
            </CardContent>
          </Card>
        </TabPanel>

        {/* Social History Tab */}
        <TabPanel value={tabValue} index={4}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ScienceIcon color="primary" />
                Social History
              </Typography>
              {medicalSummary.socialHistory && medicalSummary.socialHistory.length > 0 ? (
                <List>
                  {medicalSummary.socialHistory.map((item, index) => (
                    <React.Fragment key={item.id}>
                      <ListItem alignItems="flex-start" sx={{ px: 0 }}>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                                {item.description}
                              </Typography>
                              {(item.icd10_code?.trim() || item.snomed_code?.trim()) && (
                                <Chip 
                                  label={item.icd10_code?.trim() || `SNOMED: ${item.snomed_code}`} 
                                  size="small" 
                                  variant="outlined"
                                  color="secondary"
                                />
                              )}
                            </Box>
                          }
                          secondary={
                            <Box>
                              <Typography variant="body2" color="text.secondary">
                                Status: {item.clinical_status}
                              </Typography>
                              {item.onset_date && (
                                <Typography variant="body2" color="text.secondary">
                                  Since: {format(parseISO(item.onset_date), 'MMM dd, yyyy')}
                                </Typography>
                              )}
                            </Box>
                          }
                        />
                      </ListItem>
                      {index < medicalSummary.socialHistory.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No social history recorded
                </Typography>
              )}
            </CardContent>
          </Card>
        </TabPanel>

        {/* Notes Tab */}
        <TabPanel value={tabValue} index={5}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <DescriptionIcon color="primary" />
                Clinical Notes
              </Typography>
              {encounters && encounters.length > 0 ? (
                <List>
                  {encounters
                    .filter(enc => enc.notes && enc.notes.trim() !== '')
                    .sort((a, b) => parseISO(b.encounter_date) - parseISO(a.encounter_date))
                    .map((encounter, index, filteredArray) => (
                      <React.Fragment key={encounter.id}>
                        <ListItem alignItems="flex-start" sx={{ px: 0 }}>
                          <ListItemText
                            primary={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                                  {format(parseISO(encounter.encounter_date), 'MMM dd, yyyy')}
                                </Typography>
                                <Chip 
                                  label={encounter.encounter_type} 
                                  size="small" 
                                  color="primary"
                                  variant="outlined"
                                />
                              </Box>
                            }
                            secondary={
                              <Box>
                                <Typography variant="body2" sx={{ mb: 1 }}>
                                  <strong>Chief Complaint:</strong> {encounter.chief_complaint}
                                </Typography>
                                <Paper elevation={0} sx={{ p: 2, bgcolor: 'grey.50' }}>
                                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                                    {encounter.notes}
                                  </Typography>
                                </Paper>
                              </Box>
                            }
                          />
                        </ListItem>
                        {index < filteredArray.length - 1 && <Divider sx={{ my: 2 }} />}
                      </React.Fragment>
                    ))}
                  {encounters.filter(enc => enc.notes && enc.notes.trim() !== '').length === 0 && (
                    <Typography variant="body2" color="text.secondary">
                      No clinical notes recorded
                    </Typography>
                  )}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No encounters recorded
                </Typography>
              )}
            </CardContent>
          </Card>
        </TabPanel>
      </Paper>
    </Box>
  );
};

export default PatientSummary;