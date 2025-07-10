```jsx
import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  CircularProgress,
  Alert
} from '@mui/material';
import { usePatientResources } from '../../../hooks/useFHIRResources';
import { useFHIRClient } from '../../../contexts/FHIRClientContext';
import { format } from 'date-fns';

const HypertensionPatientGrid = () => {
  const { patientId } = useFHIRClient();

  // Get active hypertension conditions
  const { resources: conditions, loading: conditionsLoading, error: conditionsError } = 
    usePatientResources(patientId, 'Condition', {
      params: {
        code: 'I10-I16',
        status: 'active'
      },
      enabled: !!patientId
    });

  // Get related blood pressure readings
  const { resources: bpReadings, loading: bpLoading, error: bpError } =
    usePatientResources(patientId, 'Observation', {
      params: {
        code: '85354-9', // Blood pressure panel
        _sort: '-date',
        _count: 5
      },
      enabled: !!patientId
    });

  // Get current antihypertensive medications
  const { resources: medications, loading: medsLoading, error: medsError } =
    usePatientResources(patientId, 'MedicationRequest', {
      params: {
        category: 'antihypertensive',
        status: 'active'
      },
      enabled: !!patientId
    });

  if (!patientId) {
    return <Alert severity="warning">No patient selected</Alert>;
  }

  if (conditionsError || bpError || medsError) {
    return <Alert severity="error">Error loading patient data</Alert>;
  }

  const isLoading = conditionsLoading || bpLoading || medsLoading;

  return (
    <Box sx={{ p: 2 }}>
      <Grid container spacing={2}>
        
        {/* Hypertension Diagnosis */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Hypertension Status
              </Typography>
              {isLoading ? (
                <CircularProgress size={20} />
              ) : (
                conditions?.map(condition => (
                  <Typography key={condition.id}>
                    {condition.code?.coding?.[0]?.display || 'Unspecified HTN'}
                    {condition.onsetDateTime && 
                      ` (Onset: ${format(new Date(condition.onsetDateTime), 'MM/dd/yyyy')})`
                    }
                  </Typography>
                ))
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Blood Pressure Readings */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent BP Readings
              </Typography>
              {isLoading ? (
                <CircularProgress size={20} />
              ) : (
                bpReadings?.map(reading => (
                  <Typography key={reading.id}>
                    {format(new Date(reading.effectiveDateTime), 'MM/dd/yyyy HH:mm')}: 
                    {reading.component?.map(comp => comp.valueQuantity?.value).join('/')} mmHg
                  </Typography>
                ))
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Medications */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Current Medications
              </Typography>
              {isLoading ? (
                <CircularProgress size={20} />
              ) : (
                medications?.map(med => (
                  <Typography key={me