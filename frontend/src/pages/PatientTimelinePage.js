/**
 * Patient Timeline Page
 * Displays comprehensive timeline view of patient's FHIR resources
 */
import React from 'react';
import { useParams } from 'react-router-dom';
import { Box, Typography, Paper } from '@mui/material';
import FHIRResourceTimeline from '../components/clinical/timeline/FHIRResourceTimeline';
import { decodeFhirId } from '../core/navigation/navigationUtils';

const PatientTimelinePage = () => {
  const { id: encodedPatientId } = useParams();
  const patientId = decodeFhirId(encodedPatientId).toLowerCase();

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Patient Timeline
      </Typography>
      
      <Paper sx={{ height: 'calc(100vh - 200px)', overflow: 'hidden' }}>
        <FHIRResourceTimeline patientId={patientId} height="100%" />
      </Paper>
    </Box>
  );
};

export default PatientTimelinePage;