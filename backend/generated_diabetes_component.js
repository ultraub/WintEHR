import React from 'react';
import { Box, Card, CardContent, Typography, CircularProgress } from '@mui/material';
import { PeopleAlt as PeopleIcon } from '@mui/icons-material';
import { usePatientResources } from '../../../hooks/useFHIRResources';
import { useFHIRClient } from '../../../contexts/FHIRClientContext';

const DiabetesPatientCount = () => {
  const { client } = useFHIRClient();
  const patientId = client?.patient?.id;

  // Query conditions with diabetes filter (E11.* codes)
  const { resources: conditions, loading, error } = usePatientResources(
    patientId,
    'Condition',
    {
      params: { code: 'E11' },
      enabled: !!patientId
    }
  );

  // Handle loading state
  if (loading) {
    return (
      <Card elevation={2}>
        <CardContent>
          <Box display="flex" alignItems="center" justifyContent="center" p={2}>
            <CircularProgress size={24} />
          </Box>
        </CardContent>
      </Card>
    );
  }

  // Handle error state
  if (error) {
    return (
      <Card elevation={2}>
        <CardContent>
          <Typography color="error" variant="body2">
            Error loading diabetes patient count
          </Typography>
        </CardContent>
      </Card>
    );
  }

  // Calculate count of unique patients with diabetes
  const diabetesCount = conditions?.length || 0;

  return (
    <Card elevation={2}>
      <CardContent>
        <Box display="flex" alignItems="center" gap={2}>
          <PeopleIcon color="primary" />
          <Box>
            <Typography variant="h4" component="div">
              {diabetesCount}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Patients with Diabetes
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default DiabetesPatientCount;