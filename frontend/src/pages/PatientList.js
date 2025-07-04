import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClinical } from '../contexts/ClinicalContext';
import { useAuth } from '../contexts/AuthContext';
import {
  Box,
  Paper,
  Typography,
  TextField,
  InputAdornment,
  IconButton,
  Chip,
  CircularProgress,
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Badge,
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  People as PeopleIcon,
  PersonSearch as PersonSearchIcon,
} from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import { format } from 'date-fns';
import { fhirClient } from '../services/fhirClient';
import api from '../services/api';
import PatientForm from '../components/PatientForm';

function PatientList() {
  const navigate = useNavigate();
  const { loadPatient } = useClinical();
  const { user } = useAuth();
  const [patients, setPatients] = useState([]);
  const [allPatients, setAllPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [openNewPatient, setOpenNewPatient] = useState(false);
  const [activeTab, setActiveTab] = useState(1); // 0: My Patients, 1: All Patients - Default to All Patients
  const [myPatientsCount, setMyPatientsCount] = useState(0);

  const columns = [
    {
      field: 'mrn',
      headerName: 'MRN',
      width: 120,
      renderCell: (params) => (
        <Chip label={params.value} size="small" color="primary" variant="outlined" />
      ),
    },
    {
      field: 'name',
      headerName: 'Name',
      width: 200,
      valueGetter: (params) => `${params.row.last_name}, ${params.row.first_name}`,
    },
    {
      field: 'date_of_birth',
      headerName: 'Date of Birth',
      width: 130,
      valueFormatter: (params) => params.value ? format(new Date(params.value), 'MM/dd/yyyy') : '',
    },
    {
      field: 'age',
      headerName: 'Age',
      width: 80,
      valueGetter: (params) => {
        if (!params.row.date_of_birth) return '';
        const age = Math.floor((new Date() - new Date(params.row.date_of_birth)) / 31536000000);
        return age;
      },
    },
    {
      field: 'gender',
      headerName: 'Gender',
      width: 100,
    },
    {
      field: 'phone',
      headerName: 'Phone',
      width: 140,
    },
    {
      field: 'insurance_name',
      headerName: 'Insurance',
      width: 180,
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 160,
      sortable: false,
      renderCell: (params) => (
        <Button
          variant="contained"
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/patients/${params.row.id}`);
          }}
        >
          View
        </Button>
      ),
    },
  ];

  useEffect(() => {
    if (activeTab === 0) {
      fetchMyPatients();
    } else {
      fetchAllPatients();
    }
  }, [searchTerm, activeTab]);

  const fetchMyPatients = async () => {
    try {
      setLoading(true);
      // For now, use the same as all patients but filter by provider
      // In a real implementation, this would use FHIR search with practitioner parameter
      const searchParams = {
        _count: 100,
        _sort: '-_lastUpdated'
      };
      
      if (searchTerm) {
        // FHIR search supports name parameter for patient names
        searchParams.name = searchTerm;
      }
      
      const result = await fhirClient.searchPatients(searchParams);
      
      // Transform FHIR patients to expected format
      const transformedPatients = await Promise.all(result.resources.map(async (fhirPatient) => {
        const name = fhirPatient.name?.[0] || {};
        const telecom = fhirPatient.telecom || [];
        const phone = telecom.find(t => t.system === 'phone')?.value;
        const mrn = fhirPatient.identifier?.find(id => 
          id.type?.coding?.[0]?.code === 'MR' || 
          id.system?.includes('mrn')
        )?.value || fhirPatient.identifier?.[0]?.value || '';
        
        // Fetch insurance/coverage information
        let insuranceName = '';
        try {
          const coverageResult = await fhirClient.getActiveCoverage(fhirPatient.id);
          if (coverageResult.resources && coverageResult.resources.length > 0) {
            const coverage = coverageResult.resources[0];
            // Extract payer name from coverage
            if (coverage.payor && coverage.payor.length > 0) {
              const payorRef = coverage.payor[0].reference;
              if (payorRef) {
                const payorId = payorRef.split('/').pop();
                try {
                  const payorResult = await fhirClient.read('Organization', payorId);
                  insuranceName = payorResult.name || '';
                } catch (e) {
                  // If organization fetch fails, try to get name from display
                  insuranceName = coverage.payor[0].display || '';
                }
              }
            }
          }
        } catch (e) {
          // Coverage fetch failed, insurance will remain empty
          console.debug('No coverage found for patient:', fhirPatient.id);
        }
        
        return {
          id: fhirPatient.id,
          mrn: mrn,
          first_name: name.given?.join(' ') || '',
          last_name: name.family || '',
          date_of_birth: fhirPatient.birthDate,
          gender: fhirPatient.gender,
          phone: phone || '',
          insurance_name: insuranceName
        };
      }));
      
      setPatients(transformedPatients);
      setMyPatientsCount(transformedPatients.length);
      setError(null);
    } catch (err) {
      console.error('Error fetching my patients:', err);
      setError('Failed to load your patients');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllPatients = async () => {
    try {
      setLoading(true);
      const searchParams = {
        _count: 100,
        _sort: '-_lastUpdated'
      };
      
      if (searchTerm) {
        // FHIR search supports name parameter for patient names
        searchParams.name = searchTerm;
      }
      
      const result = await fhirClient.searchPatients(searchParams);
      
      // Transform FHIR patients to expected format
      const transformedPatients = await Promise.all(result.resources.map(async (fhirPatient) => {
        const name = fhirPatient.name?.[0] || {};
        const telecom = fhirPatient.telecom || [];
        const phone = telecom.find(t => t.system === 'phone')?.value;
        const mrn = fhirPatient.identifier?.find(id => 
          id.type?.coding?.[0]?.code === 'MR' || 
          id.system?.includes('mrn')
        )?.value || fhirPatient.identifier?.[0]?.value || '';
        
        // Fetch insurance/coverage information
        let insuranceName = '';
        try {
          const coverageResult = await fhirClient.getActiveCoverage(fhirPatient.id);
          if (coverageResult.resources && coverageResult.resources.length > 0) {
            const coverage = coverageResult.resources[0];
            // Extract payer name from coverage
            if (coverage.payor && coverage.payor.length > 0) {
              const payorRef = coverage.payor[0].reference;
              if (payorRef) {
                const payorId = payorRef.split('/').pop();
                try {
                  const payorResult = await fhirClient.read('Organization', payorId);
                  insuranceName = payorResult.name || '';
                } catch (e) {
                  // If organization fetch fails, try to get name from display
                  insuranceName = coverage.payor[0].display || '';
                }
              }
            }
          }
        } catch (e) {
          // Coverage fetch failed, insurance will remain empty
          console.debug('No coverage found for patient:', fhirPatient.id);
        }
        
        return {
          id: fhirPatient.id,
          mrn: mrn,
          first_name: name.given?.join(' ') || '',
          last_name: name.family || '',
          date_of_birth: fhirPatient.birthDate,
          gender: fhirPatient.gender,
          phone: phone || '',
          insurance_name: insuranceName
        };
      }));
      
      setAllPatients(transformedPatients);
      setError(null);
    } catch (err) {
      console.error('Error fetching all patients:', err);
      setError('Failed to load patient directory');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    setSearchTerm(''); // Clear search when switching tabs
  };

  const currentPatients = activeTab === 0 ? patients : allPatients;

  const handleCreatePatient = async (patientData) => {
    try {
      // Transform to FHIR Patient resource
      const fhirPatient = {
        resourceType: 'Patient',
        identifier: [
          {
            type: {
              coding: [{
                system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
                code: 'MR'
              }]
            },
            value: patientData.mrn
          }
        ],
        name: [{
          use: 'official',
          family: patientData.last_name,
          given: patientData.first_name ? [patientData.first_name] : []
        }],
        birthDate: patientData.date_of_birth,
        gender: patientData.gender?.toLowerCase(),
        telecom: []
      };
      
      if (patientData.phone) {
        fhirPatient.telecom.push({
          system: 'phone',
          value: patientData.phone,
          use: 'home'
        });
      }
      
      if (patientData.email) {
        fhirPatient.telecom.push({
          system: 'email',
          value: patientData.email
        });
      }
      
      if (patientData.address || patientData.city || patientData.state || patientData.zip_code) {
        fhirPatient.address = [{
          use: 'home',
          line: patientData.address ? [patientData.address] : [],
          city: patientData.city,
          state: patientData.state,
          postalCode: patientData.zip_code
        }];
      }
      
      const result = await fhirClient.create('Patient', fhirPatient);
      setOpenNewPatient(false);
      if (activeTab === 0) {
        fetchMyPatients();
      } else {
        fetchAllPatients();
      }
      navigate(`/patients/${result.id}`);
    } catch (err) {
      console.error('Error creating patient:', err);
      setError('Failed to create patient');
    }
  };

  const handleRefresh = () => {
    if (activeTab === 0) {
      fetchMyPatients();
    } else {
      fetchAllPatients();
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Patients</Typography>
        <Box>
          <IconButton onClick={handleRefresh} sx={{ mr: 1 }}>
            <RefreshIcon />
          </IconButton>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOpenNewPatient(true)}
          >
            New Patient
          </Button>
        </Box>
      </Box>

      {/* Tabs for My Patients vs All Patients */}
      <Paper sx={{ mb: 2 }}>
        <Tabs 
          value={activeTab} 
          onChange={handleTabChange}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab 
            icon={<PeopleIcon />} 
            label={
              <Badge badgeContent={myPatientsCount} color="primary">
                My Patients
              </Badge>
            }
            iconPosition="start"
          />
          <Tab 
            icon={<PersonSearchIcon />} 
            label="Patient Directory" 
            iconPosition="start"
          />
        </Tabs>
        
        <Box sx={{ p: 2 }}>
          <TextField
            fullWidth
            placeholder={
              activeTab === 0 
                ? "Search your patients by name or MRN..." 
                : "Search all patients by name or MRN..."
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
        </Box>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={currentPatients}
          columns={columns}
          initialState={{
            pagination: {
              paginationModel: { pageSize: 10 },
            },
          }}
          pageSizeOptions={[10, 25, 50]}
          disableRowSelectionOnClick
          loading={loading}
          onRowClick={(params) => {
            navigate(`/patients/${params.row.id}`);
          }}
          sx={{
            '& .MuiDataGrid-row:hover': {
              cursor: 'pointer',
              backgroundColor: 'rgba(233, 30, 99, 0.04)',
            },
          }}
        />
      </Paper>

      <Dialog
        open={openNewPatient}
        onClose={() => setOpenNewPatient(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>New Patient Registration</DialogTitle>
        <DialogContent>
          <PatientForm
            onSubmit={handleCreatePatient}
            onCancel={() => setOpenNewPatient(false)}
          />
        </DialogContent>
      </Dialog>
    </Box>
  );
}

export default PatientList;