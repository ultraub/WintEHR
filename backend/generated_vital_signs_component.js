import React from 'react';
import { Box, Card, CardContent, Typography, CircularProgress, Alert } from '@mui/material';
import { usePatientResources } from '../../../hooks/useFHIRResources';
import { formatDate, formatValue } from '../../../utils/formatters';

const VitalSignsSummary = () => {
  const { resources: vitalSigns, loading, error } = usePatientResources(
    'Observation',
    {
      params: {
        category: 'vital-signs',
        status: 'final',
        _sort: '-date',
        _count: 1
      },
      enabled: true
    }
  );

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={2}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error">
        Error loading vital signs: {error.message}
      </Alert>
    );
  }

  const latestVitals = vitalSigns?.[0];

  if (!latestVitals) {
    return (
      <Alert severity="info">
        No recent vital signs available
      </Alert>
    );
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Latest Vital Signs
        </Typography>
        
        <Box mt={2}>
          <Typography variant="subtitle2" color="textSecondary">
            Recorded on: {formatDate(latestVitals.effectiveDateTime)}
          </Typography>

          <Box mt={1}>
            {latestVitals.component?.map((component, index) => (
              <Box key={index} display="flex" alignItems="center" mt={1}>
                <Typography variant="body2" color="textSecondary" sx={{minWidth: 200}}>
                  {component.code?.coding?.[0]?.display || 'Unknown Measurement'}:
                </Typography>
                <Typography variant="body1">
                  {formatValue(component.valueQuantity?.value)} {component.valueQuantity?.unit}
                </Typography>
              </Box>
            ))}

            {/* Handle non-component observations */}
            {!latestVitals.component && (
              <Box display="flex" alignItems="center" mt={1}>
                <Typography variant="body2" color="textSecondary" sx={{minWidth: 200}}>
                  {latestVitals.code?.coding?.[0]?.display || 'Unknown Measurement'}:
                </Typography>
                <Typography variant="body1">
                  {formatValue(latestVitals.valueQuantity?.value)} {latestVitals.valueQuantity?.unit}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>

        {latestVitals.note && (
          <Box mt={2}>
            <Typography variant="body2" color="textSecondary">
              Notes: {latestVitals.note[0]?.text}
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default VitalSignsSummary;