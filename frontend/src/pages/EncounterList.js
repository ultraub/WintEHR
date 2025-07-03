import React, { useState, useEffect } from 'react';
import { Box, Paper, Typography, Chip, CircularProgress, Alert } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { format } from 'date-fns';
import { fhirClient } from '../services/fhirClient';

function EncounterList() {
  const [encounters, setEncounters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const columns = [
    {
      field: 'encounter_date',
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
      field: 'encounter_type',
      headerName: 'Type',
      width: 130,
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 100,
      renderCell: (params) => (
        <Chip label={params.value} color="success" size="small" />
      ),
    },
    {
      field: 'provider_name',
      headerName: 'Provider',
      width: 180,
      valueGetter: (params) => `Dr. ${params.row.provider?.last_name}` || 'Unknown',
    },
    {
      field: 'chief_complaint',
      headerName: 'Chief Complaint',
      width: 300,
    },
  ];

  useEffect(() => {
    fetchEncounters();
  }, []);

  const fetchEncounters = async () => {
    try {
      setLoading(true);
      
      // Search for all encounters with patient includes
      const result = await fhirClient.search('Encounter', {
        _sort: '-date',
        _count: 100,
        _include: 'Encounter:patient'
      });
      
      // Transform FHIR encounters to expected format
      const transformedEncounters = await Promise.all(result.resources.map(async (enc) => {
        const type = enc.type?.[0];
        const period = enc.period || {};
        const patientId = fhirClient.extractId(enc.subject);
        
        // Fetch patient info
        let patientInfo = { first_name: 'Unknown', last_name: 'Patient' };
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
        
        return {
          id: enc.id,
          encounter_date: period.start || enc.date,
          patient: patientInfo,
          encounter_type: type?.text || type?.coding?.[0]?.display || 'Unknown',
          status: enc.status,
          provider_name: enc.participant?.find(p => 
            p.type?.[0]?.coding?.[0]?.code === 'ATND'
          )?.individual?.display || 'Unknown Provider',
          chief_complaint: enc.reasonCode?.[0]?.text || enc.reasonReference?.[0]?.display || ''
        };
      }));
      
      setEncounters(transformedEncounters);
      setError(null);
    } catch (err) {
      console.error('Error fetching encounters:', err);
      setError('Failed to load encounters');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Encounters
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={encounters}
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

export default EncounterList;