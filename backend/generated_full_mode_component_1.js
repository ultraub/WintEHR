import React from 'react';
import { Box, Card, CardContent, Typography, CircularProgress } from '@mui/material';
import { PersonOutline } from '@mui/icons-material';
import { usePatientResources } from '../../../hooks/useFHIRResources';
import { useFHIRClient } from '../../../contexts/FHIRClientContext';

const HypertensionPatientCount = () => {
  const { client } = useFHIRClient();
  const patientId = client?.patient?.id;

  // Query active hypertension conditions
  const { resources: conditions, loading, error } = usePatientResources(
    patientId,
    'Condition',
    {
      params: {
        code: 'I10-I16',
        status: 'active',
      },
      enabled: !!patientId
    }
  );

  // Handle loading state
  if (loading) {
    return (
      <Card>
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
      <Card>
        <CardContent>
          <Typography color="error">
            Error loading hypertension data
          </Typography>
        </CardContent>
      </Card>
    );
  }

  // Calculate count of active hypertension conditions
  const count = conditions?.length || 0;

  return (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center">
          <PersonOutline sx={{ fontSize: 40, color: 'primary.main', mr: 2 }} />
          <Box>
            <Typography variant="h4" component="div">
              {count}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Active Hypertension Cases
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default HypertensionPatientCount;