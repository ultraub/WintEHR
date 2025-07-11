import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  CircularProgress,
  Alert
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { usePatientResources } from '../../../hooks/useFHIRResources';
import { formatDate } from '../../../utils/dateUtils';

const HypertensionPatientGrid = () => {
  // Get active patients with hypertension conditions
  const { resources: patients, loading, error } = usePatientResources(
    null,
    'Patient',
    {
      params: {
        _has: 'Condition:patient:code=I10-I16',
        'active': true,
        _include: ['Patient:condition']
      }
    }
  );

  const columns = [
    {
      field: 'name',
      headerName: 'Patient Name',
      flex: 1,
      valueGetter: (params) => {
        const name = params.row.name?.[0];
        return name ? `${name.given?.[0] || ''} ${name.family || ''}` : 'N/A';
      }
    },
    {
      field: 'birthDate',
      headerName: 'Date of Birth',
      flex: 1,
      valueGetter: (params) => formatDate(params.row.birthDate)
    },
    {
      field: 'gender',
      headerName: 'Gender',
      flex: 1,
      valueFormatter: (params) => params.value?.charAt(0).toUpperCase() + params.value?.slice(1)
    },
    {
      field: 'identifier',
      headerName: 'MRN',
      flex: 1,
      valueGetter: (params) => {
        const mrn = params.row.identifier?.find(id => id.system === 'urn:mrn');
        return mrn?.value || 'N/A';
      }
    }
  ];

  if (error) {
    return (
      <Alert severity="error">
        Error loading patient data: {error.message}
      </Alert>
    );
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Hypertension Patients
        </Typography>
        
        <Box sx={{ height: 400, width: '100%' }}>
          {loading ? (
            <Box display="flex" justifyContent="center" alignItems="center" height="100%">
              <CircularProgress />
            </Box>
          ) : (
            <DataGrid
              rows={patients || []}
              columns={columns}
              pageSize={10}
              rowsPerPageOptions={[10]}
              getRowId={(row) => row.id || Math.random().toString()}
              disableSelectionOnClick
              loading={loading}
              density="compact"
              sx={{
                '& .MuiDataGrid-cell': {
                  fontSize: '0.875rem',
                },
              }}
            />
          )}
        </Box>

        <Typography variant="caption" color="textSecondary" sx={{ mt: 2, display: 'block' }}>
          {patients?.length || 0} patients found
        </Typography>
      </CardContent>
    </Card>
  );
};

export default HypertensionPatientGrid;