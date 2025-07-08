import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  TextField,
  InputAdornment,
  IconButton,
  Chip,
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  Tabs,
  Tab,
  Badge,
  Tooltip,
  CircularProgress,
  TablePagination,
  LinearProgress,
  Stack
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  People as PeopleIcon,
  PersonSearch as PersonSearchIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import { format } from 'date-fns';
import { fhirClient } from '../services/fhirClient';
import PatientForm from '../components/PatientForm';
import { getPatientDetailUrl } from '../utils/navigationUtils';
import { debounce } from 'lodash';

function PatientList() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [allPatients, setAllPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [openNewPatient, setOpenNewPatient] = useState(false);
  const [activeTab, setActiveTab] = useState(1); // 0: My Patients, 1: All Patients - Default to All Patients
  const [myPatientsCount, setMyPatientsCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Pagination state
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [searchLoading, setSearchLoading] = useState(false);
  const pageSizeOptions = [10, 25, 50, 100];

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
            navigate(getPatientDetailUrl(params.row.id));
          }}
        >
          View
        </Button>
      ),
    },
  ];

  // Initial load effect
  useEffect(() => {
    if (activeTab === 0) {
      fetchMyPatients();
    } else {
      fetchAllPatients(0, pageSize, '');
    }
  }, [activeTab]);
  
  // Separate effect for handling page/pageSize changes
  useEffect(() => {
    if (activeTab === 1) {
      fetchAllPatients(page, pageSize, searchTerm);
    }
  }, [page, pageSize]);

  const fetchMyPatients = async () => {
    try {
      setLoading(true);
      // For now, use the same as all patients but filter by provider
      // In a real implementation, this would use FHIR search with practitioner parameter
      const searchParams = {
        _count: 100,
        _sort: '-_lastUpdated'
      };
      
      if (searchTerm && searchTerm.length >= 2) {
        // FHIR search supports name parameter for patient names
        // Also search by identifier (MRN) if the search term looks like it could be an MRN
        if (/^\d+$/.test(searchTerm)) {
          // Numeric search term - search by identifier
          searchParams.identifier = searchTerm;
        } else {
          // Text search term - search by name
          searchParams.name = searchTerm;
        }
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
      setError('Failed to load your patients');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllPatients = async (currentPage = page, currentPageSize = pageSize, searchQuery = searchTerm) => {
    try {
      setLoading(true);
      setError(null);
      
      const searchParams = {
        _count: currentPageSize,
        _offset: currentPage * currentPageSize,
        _sort: '-_lastUpdated',
        _total: 'accurate' // Request total count
      };
      
      if (searchQuery && searchQuery.length >= 2) {
        // FHIR search supports name parameter for patient names
        // Also search by identifier (MRN) if the search term looks like it could be an MRN
        if (/^\d+$/.test(searchQuery)) {
          // Numeric search term - search by identifier
          searchParams.identifier = searchQuery;
        } else {
          // Text search term - search by name
          searchParams.name = searchQuery;
        }
      }
      
      const result = await fhirClient.searchPatients(searchParams);
      
      // Extract total count from bundle
      const total = result.total || 0;
      setTotalCount(total);
      
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
      setError('Failed to load patient directory');
    } finally {
      setLoading(false);
      setSearchLoading(false);
      setIsRefreshing(false);
    }
  };

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce((term) => {
      setPage(0); // Reset to first page on new search
      fetchAllPatients(0, pageSize, term);
    }, 500),
    [pageSize]
  );

  const handleSearchChange = (event) => {
    const value = event.target.value;
    setSearchTerm(value);
    setSearchLoading(true);
    debouncedSearch(value);
  };

  const handlePageChange = (event, newPage) => {
    setPage(newPage);
    fetchAllPatients(newPage, pageSize);
  };

  const handlePageSizeChange = (event) => {
    const newPageSize = parseInt(event.target.value, 10);
    setPageSize(newPageSize);
    setPage(0);
    fetchAllPatients(0, newPageSize);
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    setSearchTerm(''); // Clear search when switching tabs
    setPage(0); // Reset pagination
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
      navigate(getPatientDetailUrl(result.id));
    } catch (err) {
      setError('Failed to create patient');
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (activeTab === 0) {
        await fetchMyPatients();
      } else {
        await fetchAllPatients();
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Patients</Typography>
        <Box>
          <Tooltip title="Export patient list">
            <IconButton 
              onClick={() => {
                const data = currentPatients.map(p => ({
                  MRN: p.mrn,
                  Name: `${p.last_name}, ${p.first_name}`,
                  'Date of Birth': p.date_of_birth,
                  Gender: p.gender,
                  Phone: p.phone,
                  Insurance: p.insurance_name
                }));
                const csv = [
                  Object.keys(data[0]).join(','),
                  ...data.map(row => Object.values(row).map(v => `"${v || ''}"`).join(','))
                ].join('\n');
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `patient-list-${new Date().toISOString().split('T')[0]}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              sx={{ mr: 1 }}
            >
              <DownloadIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Refresh patient list">
            <IconButton 
              onClick={handleRefresh} 
              sx={{ mr: 1 }}
              disabled={isRefreshing}
            >
              <RefreshIcon sx={{ 
                animation: isRefreshing ? 'spin 1s linear infinite' : 'none',
                '@keyframes spin': {
                  '0%': { transform: 'rotate(0deg)' },
                  '100%': { transform: 'rotate(360deg)' }
                }
              }} />
            </IconButton>
          </Tooltip>
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
            onChange={handleSearchChange}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  {searchLoading ? <CircularProgress size={20} /> : <SearchIcon />}
                </InputAdornment>
              ),
              endAdornment: searchTerm && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => { 
                    setSearchTerm(''); 
                    setPage(0);
                    fetchAllPatients(0, pageSize, ''); 
                  }}>
                    ×
                  </IconButton>
                </InputAdornment>
              ),
            }}
            helperText={
              searchTerm && searchTerm.length === 1 
                ? "Type at least 2 characters to search" 
                : ""
            }
          />
        </Box>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        {loading && <LinearProgress />}
        
        <Box sx={{ flexGrow: 1, height: 500 }}>
          <DataGrid
            rows={currentPatients}
            columns={columns}
            pageSize={pageSize}
            rowsPerPageOptions={[]}
            checkboxSelection={false}
            disableSelectionOnClick
            disableColumnMenu
            hideFooter
            loading={loading}
            onRowClick={(params) => {
              navigate(getPatientDetailUrl(params.row.id));
            }}
            sx={{
              '& .MuiDataGrid-row:hover': {
                cursor: 'pointer',
                backgroundColor: 'rgba(233, 30, 99, 0.04)',
              },
            }}
          />
        </Box>

        {activeTab === 1 && (
          <TablePagination
            component="div"
            count={totalCount}
            page={page}
            onPageChange={handlePageChange}
            rowsPerPage={pageSize}
            onRowsPerPageChange={handlePageSizeChange}
            rowsPerPageOptions={pageSizeOptions}
            showFirstButton
            showLastButton
          />
        )}
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