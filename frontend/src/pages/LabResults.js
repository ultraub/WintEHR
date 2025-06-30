import React, { useState, useEffect } from 'react';
import { Box, Paper, Typography, Chip, CircularProgress, Alert } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { format } from 'date-fns';
import api from '../services/api';

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
      const response = await api.get('/api/observations?observation_type=laboratory');
      setObservations(response.data);
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