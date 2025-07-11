```jsx
import React, { useMemo } from 'react';
import { Box, Card, CardContent, Typography, CircularProgress } from '@mui/material';
import { Alert } from '@mui/material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { usePatientResources } from '../../../hooks/useFHIRResources';
import { format } from 'date-fns';

const BPChart = () => {
  // Get patient ID from context
  const patientId = usePatientContext()?.id;

  // Fetch BP observations
  const { resources: systolicObs, loading: loadingSystolic, error: errorSystolic } = usePatientResources(
    patientId,
    'Observation',
    {
      params: { code: '8480-6', _sort: '-date' },
      enabled: !!patientId
    }
  );

  const { resources: diastolicObs, loading: loadingDiastolic, error: errorDiastolic } = usePatientResources(
    patientId, 
    'Observation',
    {
      params: { code: '8462-4', _sort: '-date' },
      enabled: !!patientId
    }
  );

  // Process data for chart
  const chartData = useMemo(() => {
    if (!systolicObs?.length && !diastolicObs?.length) return [];

    // Combine and sort observations by date
    const allReadings = [...(systolicObs || []), ...(diastolicObs || [])]
      .filter(obs => obs.effectiveDateTime && obs.valueQuantity?.value)
      .reduce((acc, obs) => {
        const date = format(new Date(obs.effectiveDateTime), 'yyyy-MM');
        if (!acc[date]) {
          acc[date] = {};
        }
        
        const isSystemic = obs.code?.coding?.[0]?.code === '8480-6';
        const value = obs.valueQuantity?.value;
        
        if (isSystemic) {
          if (!acc[date].systolic) acc[date].systolic = [];
          acc[date].systolic.push(value);
        } else {
          if (!acc[date].diastolic) acc[date].diastolic = [];
          acc[date].diastolic.push(value);
        }
        
        return acc;
      }, {});

    // Calculate monthly averages
    return Object.entries(allReadings).map(([date, values]) => ({
      date,
      systolic: values.systolic ? 
        Math.round(values.systolic.reduce((a,b) => a+b) / values.systolic.length) : null,
      diastolic: values.diastolic ?
        Math.round(values.diastolic.reduce((a,b) => a+b) / values.diastolic.length) : null
    })).sort((a,b) => a.date.localeCompare(b.date));
  }, [systolicObs, diastolicObs]);

  if (errorSystolic || errorDiastolic) {
    return <Alert severity="error">Error loading blood pressure data</Alert>;
  }

  if (loadingSystolic || loadingDiastolic) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (!chartData.length) {
    return <Alert severity="info">No blood pressure readings available</Alert>;
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Blood Pressure Trends
        </Typography>
        
        <Box height={400}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tickFormatter={(date) => format(new Date(date), 'MMM yyyy')}