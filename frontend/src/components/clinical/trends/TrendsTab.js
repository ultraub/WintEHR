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
import { fhirClient } from '../../../services/fhirClient';

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
      // Fetch vital signs using FHIR
      const result = await fhirClient.getVitalSigns(currentPatient.id);
      
      // Transform FHIR observations to expected format
      const transformedVitals = result.resources.map(obs => {
        const value = obs.valueQuantity?.value || obs.valueString || '';
        const unit = obs.valueQuantity?.unit || '';
        
        // Handle blood pressure component observations
        if (obs.component && obs.component.length > 0) {
          const systolic = obs.component.find(c => 
            c.code?.coding?.some(coding => 
              coding.code === '8480-6' || coding.display?.toLowerCase().includes('systolic')
            )
          )?.valueQuantity?.value;
          
          const diastolic = obs.component.find(c => 
            c.code?.coding?.some(coding => 
              coding.code === '8462-4' || coding.display?.toLowerCase().includes('diastolic')
            )
          )?.valueQuantity?.value;
          
          if (systolic && diastolic) {
            return {
              id: obs.id,
              patient_id: currentPatient.id,
              observation_date: obs.effectiveDateTime || obs.issued,
              display: obs.code?.text || obs.code?.coding?.[0]?.display || 'Blood Pressure',
              value: `${systolic}/${diastolic}`,
              value_quantity: null,
              unit: 'mmHg',
              status: obs.status
            };
          }
        }
        
        return {
          id: obs.id,
          patient_id: currentPatient.id,
          observation_date: obs.effectiveDateTime || obs.issued,
          display: obs.code?.text || obs.code?.coding?.[0]?.display || 'Unknown',
          value: value.toString(),
          value_quantity: typeof value === 'number' ? value : parseFloat(value),
          unit: unit,
          status: obs.status
        };
      });
      
      setVitalsData(transformedVitals);
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