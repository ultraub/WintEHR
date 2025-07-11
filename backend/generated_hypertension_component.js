import React from 'react';
import { Box, Card, CardContent, Typography, CircularProgress } from '@mui/material';
import { PersonOutline } from '@mui/icons-material';
import { usePatientResources } from '../../../hooks/useFHIRResources';
import { useFHIRClient } from '../../../contexts/FHIRClientContext';

const HypertensionPatientStat = () => {
  const { client } = useFHIRClient();
  const patientId = client?.patient?.id;

  // Query active hypertension conditions
  const { resources: conditions, loading, error } = usePatientResources(
    patientId,
    'Condition',
    {
      params: {
        code: 'I10-I16',
        'clinical-status': 'active',
        _count: 1000
      },
      enabled: !!patientId
    }
  );

  // Handle loading state
  if (loading) {
    return (
      <Card>
        <CardContent sx={{ textAlign: 'center', py: 2 }}>
          <CircularProgress size={20} />
        </CardContent>
      </Card>
    );
  }

  // Handle error state
  if (error) {
    return (
      <Card>
        <CardContent sx={{ textAlign: 'center', py: 2 }}>
          <Typography color="error">
            Error loading hypertension data
          </Typography>
        </CardContent>
      </Card>
    );
  }

  // Count unique patients with hypertension
  const patientCount = conditions?.length || 0;

  return (
    <Card>
      <CardContent sx={{ p: 2 }}>
        <Box display="flex" alignItems="center">
          <PersonOutline sx={{ mr: 1, color: 'primary.main' }} />
          <Box>
            <Typography variant="h4" component="div">
              {patientCount}
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

export default HypertensionPatientStat;