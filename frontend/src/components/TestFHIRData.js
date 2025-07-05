import React, { useEffect, useState } from 'react';
import { Box, Typography, Paper, CircularProgress, Alert } from '@mui/material';
import { fhirClient } from '../services/fhirClient';

const TestFHIRData = ({ patientId }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!patientId) {
        setError('No patient ID provided');
        setLoading(false);
        return;
      }

      try {
        console.log('Fetching data for patient:', patientId);
        
        // Test fetching patient
        const patient = await fhirClient.read('Patient', patientId);
        console.log('Patient data:', patient);
        
        // Test fetching observations
        const observations = await fhirClient.search('Observation', { 
          patient: patientId,
          _count: 5 
        });
        console.log('Observations:', observations);
        
        // Test fetching conditions
        const conditions = await fhirClient.search('Condition', { 
          patient: patientId 
        });
        console.log('Conditions:', conditions);

        setData({
          patient,
          observations: observations.entry?.map(e => e.resource) || [],
          conditions: conditions.entry?.map(e => e.resource) || [],
          observationCount: observations.total || 0,
          conditionCount: conditions.total || 0
        });
      } catch (err) {
        console.error('Error fetching FHIR data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [patientId]);

  if (loading) return <CircularProgress />;
  if (error) return <Alert severity="error">Error: {error}</Alert>;
  if (!data) return <Alert severity="info">No data available</Alert>;

  return (
    <Paper sx={{ p: 3, m: 2 }}>
      <Typography variant="h6" gutterBottom>FHIR Data Test for Patient: {patientId}</Typography>
      
      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle1">Patient Name:</Typography>
        <Typography>
          {data.patient?.name?.[0]?.given?.join(' ')} {data.patient?.name?.[0]?.family}
        </Typography>
      </Box>

      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle1">Total Observations: {data.observationCount}</Typography>
        {data.observations.slice(0, 3).map((obs, index) => (
          <Typography key={index} variant="body2">
            - {obs.code?.text || obs.code?.coding?.[0]?.display}: 
            {obs.valueQuantity?.value} {obs.valueQuantity?.unit}
          </Typography>
        ))}
      </Box>

      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle1">Total Conditions: {data.conditionCount}</Typography>
        {data.conditions.slice(0, 3).map((cond, index) => (
          <Typography key={index} variant="body2">
            - {cond.code?.text || cond.code?.coding?.[0]?.display}
          </Typography>
        ))}
      </Box>
    </Paper>
  );
};

export default TestFHIRData;