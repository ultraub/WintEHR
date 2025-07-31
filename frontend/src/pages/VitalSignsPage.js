import React from 'react';
import { useParams } from 'react-router-dom';
import { Box, Typography, Paper } from '@mui/material';
import VitalSignsFlowsheet from '../components/clinical/vitals/VitalSignsFlowsheet';

function VitalSignsPage() {
  const { patientId } = useParams();

  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Vital Signs
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Comprehensive vital signs tracking and trending for patient care.
        </Typography>
      </Paper>
      
      <VitalSignsFlowsheet 
        patientId={patientId}
        height="calc(100vh - 220px)"
      />
    </Box>
  );
}

export default VitalSignsPage;