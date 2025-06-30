/**
 * Trends Tab Component
 * Displays vitals and lab trends visualization
 */
import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Tabs,
  Tab,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Timeline as TrendsIcon,
  Favorite as VitalsIcon,
  Science as LabIcon
} from '@mui/icons-material';
import { useClinical } from '../../../contexts/ClinicalContext';
import VitalSignsTrends from '../../VitalSignsTrends';
import LabTrends from '../charts/LabTrends';
import VitalsOverview from '../charts/VitalsOverview';
import api from '../../../services/api';

const TabPanel = ({ children, value, index, ...other }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`trends-tabpanel-${index}`}
      aria-labelledby={`trends-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ py: 2 }}>
          {children}
        </Box>
      )}
    </div>
  );
};

const TrendsTab = () => {
  const { currentPatient } = useClinical();
  const [activeTab, setActiveTab] = useState(0);
  const [vitalsData, setVitalsData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentPatient) {
      fetchVitalsData();
    }
  }, [currentPatient]);

  const fetchVitalsData = async () => {
    setLoading(true);
    try {
      // Note: observation_type filter removed as field is null in current dataset
      const response = await api.get(`/api/observations?patient_id=${currentPatient.id}&limit=200`);
      // Filter for vital signs on frontend since observation_type is null
      const vitalsData = response.data.filter(obs => {
        const display = obs.display?.toLowerCase() || '';
        return display.includes('blood pressure') || display.includes('heart rate') || 
               display.includes('temperature') || display.includes('weight') || 
               display.includes('height') || display.includes('oxygen') || 
               display.includes('respiratory') || display.includes('bmi') || 
               display.includes('pulse') || display.includes('bp');
      });
      setVitalsData(vitalsData || []);
    } catch (error) {
      console.error('Error fetching vitals data:', error);
      setVitalsData([]);
    } finally {
      setLoading(false);
    }
  };

  if (!currentPatient) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">
          Please select a patient to view trends data.
        </Alert>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Clinical Trends
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Visualize trends in vital signs and laboratory results over time
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
          <Tab 
            icon={<VitalsIcon />} 
            label="Vital Signs" 
            iconPosition="start"
          />
          <Tab 
            icon={<LabIcon />} 
            label="Laboratory" 
            iconPosition="start"
          />
        </Tabs>
      </Box>

      <TabPanel value={activeTab} index={0}>
        {/* Vital Signs Overview */}
        <VitalsOverview patientId={currentPatient.id} vitalsData={vitalsData} />
      </TabPanel>

      <TabPanel value={activeTab} index={1}>
        {/* Laboratory Trends */}
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Paper sx={{ p: 2 }}>
              <LabTrends patientId={currentPatient.id} height={350} />
            </Paper>
          </Grid>
        </Grid>
      </TabPanel>
    </Box>
  );
};

export default TrendsTab;