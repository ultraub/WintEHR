import React, { useState, useEffect } from 'react';
import { Box, Paper, Typography, Chip, CircularProgress, Alert } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { format } from 'date-fns';
import { fhirClient } from '../services/fhirClient';

function LabResults() {
  const [observations, setObservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const columns = [
    {
      field: 'observation_date',
      headerName: 'Date',
      width: 150,
      valueFormatter: (params) => format(new Date(params.value), 'MM/dd/yyyy'),
    },
    {
      field: 'patient_name',
      headerName: 'Patient',
      width: 200,
      valueGetter: (params) => `${params.row.patient?.last_name}, ${params.row.patient?.first_name}` || 'Unknown',
    },
    {
      field: 'display',
      headerName: 'Test',
      width: 200,
    },
    {
      field: 'value',
      headerName: 'Value',
      width: 100,
    },
    {
      field: 'unit',
      headerName: 'Unit',
      width: 80,
    },
    {
      field: 'interpretation',
      headerName: 'Result',
      width: 100,
      renderCell: (params) => {
        const color = params.value === 'Normal' ? 'success' : 
                     params.value === 'High' ? 'error' : 
                     params.value === 'Low' ? 'warning' : 'default';
        return <Chip label={params.value} color={color} size="small" />;
      },
    },
    {
      field: 'reference_range',
      headerName: 'Reference Range',
      width: 150,
      valueGetter: (params) => {
        const { reference_range_low, reference_range_high } = params.row;
        if (reference_range_low && reference_range_high) {
          return `${reference_range_low} - ${reference_range_high}`;
        }
        return '';
      },
    },
  ];

  useEffect(() => {
    fetchLabResults();
  }, []);

  const fetchLabResults = async () => {
    try {
      setLoading(true);
      // Search for all lab results across all patients
      const searchParams = {
        category: 'laboratory',
        _sort: '-date',
        _count: 100,
        _include: 'Observation:patient'
      };
      
      const result = await fhirClient.search('Observation', searchParams);
      
      // Transform FHIR observations to expected format
      const transformedObservations = await Promise.all(result.resources.map(async (obs) => {
        // Extract patient info from the included resources or fetch separately
        let patientInfo = { first_name: 'Unknown', last_name: 'Patient' };
        
        if (obs.subject?.reference) {
          const patientId = fhirClient.extractId(obs.subject);
          try {
            const patient = await fhirClient.read('Patient', patientId);
            const name = patient.name?.[0] || {};
            patientInfo = {
              first_name: name.given?.join(' ') || '',
              last_name: name.family || ''
            };
          } catch (err) {
            console.error('Error fetching patient info:', err);
          }
        }
        
        // Determine interpretation based on reference range
        let interpretation = 'Normal';
        if (obs.interpretation?.[0]?.coding?.[0]?.code) {
          const code = obs.interpretation[0].coding[0].code;
          if (code === 'H' || code === 'HH') interpretation = 'High';
          else if (code === 'L' || code === 'LL') interpretation = 'Low';
          else if (code === 'A') interpretation = 'Abnormal';
        }
        
        return {
          id: obs.id,
          observation_date: obs.effectiveDateTime || obs.issued,
          patient: patientInfo,
          display: obs.code?.text || obs.code?.coding?.[0]?.display || 'Unknown',
          value: obs.valueQuantity?.value || obs.valueString || '',
          unit: obs.valueQuantity?.unit || '',
          interpretation: interpretation,
          reference_range_low: obs.referenceRange?.[0]?.low?.value,
          reference_range_high: obs.referenceRange?.[0]?.high?.value,
          status: obs.status
        };
      }));
      
      setObservations(transformedObservations);
      setError(null);
    } catch (err) {
      console.error('Error fetching lab results:', err);
      setError('Failed to load lab results');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Lab Results
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={observations}
          columns={columns}
          pageSize={25}
          rowsPerPageOptions={[10, 25, 50]}
          disableSelectionOnClick
          loading={loading}
        />
      </Paper>
    </Box>
  );
}

export default LabResults;