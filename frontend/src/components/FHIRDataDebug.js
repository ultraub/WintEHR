import React, { useEffect, useState } from 'react';
import { Box, Paper, Typography, CircularProgress, Alert } from '@mui/material';
import { fhirClient } from '../services/fhirClient';

const FHIRDataDebug = ({ patientId }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const debugData = async () => {
      if (!patientId) return;

      try {
        // Get conditions to check data structure
        const conditions = await fhirClient.search('Condition', { 
          patient: patientId,
          _count: 2 
        });
        
        // Get allergies to check data structure
        const allergies = await fhirClient.search('AllergyIntolerance', { 
          patient: patientId,
          _count: 2 
        });

        setData({
          conditions: conditions.resources || [],
          allergies: allergies.resources || []
        });

        // Log the raw data
        console.log('DEBUG - Raw Conditions:', conditions.resources);
        console.log('DEBUG - Raw Allergies:', allergies.resources);
        
        // Check for problematic fields
        conditions.resources?.forEach((cond, idx) => {
          console.log(`Condition ${idx}:`, {
            id: cond.id,
            code: cond.code,
            category: cond.category,
            severity: cond.severity,
            'category type': typeof cond.category,
            'severity type': typeof cond.severity,
            'has coding in category': cond.category?.[0]?.coding ? 'yes' : 'no'
          });
        });

        allergies.resources?.forEach((allergy, idx) => {
          console.log(`Allergy ${idx}:`, {
            id: allergy.id,
            code: allergy.code,
            type: allergy.type,
            category: allergy.category,
            criticality: allergy.criticality,
            'type type': typeof allergy.type,
            'category type': typeof allergy.category,
            'criticality type': typeof allergy.criticality
          });
        });

      } catch (err) {
        console.error('Debug error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    debugData();
  }, [patientId]);

  if (loading) return <CircularProgress />;
  if (error) return <Alert severity="error">Error: {error}</Alert>;

  return (
    <Paper sx={{ p: 2, m: 2, backgroundColor: '#f5f5f5' }}>
      <Typography variant="h6" gutterBottom>FHIR Data Debug</Typography>
      
      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle2">Conditions ({data.conditions.length}):</Typography>
        {data.conditions.map((cond, idx) => (
          <Box key={idx} sx={{ ml: 2, mt: 1 }}>
            <Typography variant="body2">
              - {cond.code?.text || 'No text'} 
              {cond.category && ' | Category: ' + JSON.stringify(cond.category)}
              {cond.severity && ' | Severity: ' + JSON.stringify(cond.severity)}
            </Typography>
          </Box>
        ))}
      </Box>

      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle2">Allergies ({data.allergies.length}):</Typography>
        {data.allergies.map((allergy, idx) => (
          <Box key={idx} sx={{ ml: 2, mt: 1 }}>
            <Typography variant="body2">
              - {allergy.code?.text || 'No text'}
              {allergy.type && ' | Type: ' + JSON.stringify(allergy.type)}
              {allergy.category && ' | Category: ' + JSON.stringify(allergy.category)}
            </Typography>
          </Box>
        ))}
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
        Check browser console for detailed debug information
      </Typography>
    </Paper>
  );
};

export default FHIRDataDebug;