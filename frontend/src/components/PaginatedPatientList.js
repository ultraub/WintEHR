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
  Stack,
  Skeleton,
  useMediaQuery,
  useTheme
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  People as PeopleIcon,
  PersonSearch as PersonSearchIcon,
  Download as DownloadIcon,
  ViewList as ViewListIcon,
  GridView as GridViewIcon
} from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import { format } from 'date-fns';
import { fhirClient } from '../services/fhirClient';
import PatientForm from './PatientForm';
import { getPatientDetailUrl } from '../core/navigation/navigationUtils';
import { debounce } from 'lodash';

function PaginatedPatientList() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  
  // Data state
  const [patients, setPatients] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Pagination state
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(isMobile ? 10 : 25);
  const pageSizeOptions = [10, 25, 50, 100];
  
  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  
  // UI state
  const [openNewPatient, setOpenNewPatient] = useState(false);
  const [activeTab, setActiveTab] = useState(1); // 0: My Patients, 1: All Patients
  const [myPatientsCount, setMyPatientsCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'

  // Responsive columns configuration
  const columns = [
    {
      field: 'mrn',
      headerName: 'MRN',
      flex: isMobile ? 0 : 0.8,
      minWidth: isMobile ? 80 : 120,
      renderCell: (params) => (
        <Chip
          label={params.value || 'N/A'}
          size="small"
          variant="outlined"
          color="primary"
        />
      ),
    },
    {
      field: 'name',
      headerName: 'Name',
      flex: 1.5,
      minWidth: isMobile ? 150 : 200,
      valueGetter: (params) => 
        `${params.row.last_name}, ${params.row.first_name}`,
    },
    ...(!isMobile ? [{
      field: 'date_of_birth',
      headerName: 'Date of Birth',
      flex: 1,
      minWidth: 120,
      renderCell: (params) => {
        if (!params.value) return 'Unknown';
        const birthDate = new Date(params.value);
        const age = new Date().getFullYear() - birthDate.getFullYear();
        return (
          <Box>
            <Typography variant="body2">
              {format(birthDate, 'MM/dd/yyyy')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {age} years
            </Typography>
          </Box>
        );
      },
    }] : []),
    ...(!isTablet ? [{
      field: 'gender',
      headerName: 'Gender',
      flex: 0.6,
      minWidth: 100,
      renderCell: (params) => (
        <Chip
          label={params.value?.charAt(0).toUpperCase() + params.value?.slice(1) || 'Unknown'}
          size="small"
          color={params.value === 'male' ? 'info' : params.value === 'female' ? 'secondary' : 'default'}
        />
      ),
    }] : []),
    ...(!isMobile ? [{
      field: 'phone',
      headerName: 'Phone',
      flex: 1,
      minWidth: 140,
    }] : []),
    ...(!isTablet ? [{
      field: 'insurance_name',
      headerName: 'Insurance',
      flex: 1.2,
      minWidth: 180,
      renderCell: (params) => params.value || 'Not Available',
    }] : []),
    {
      field: 'actions',
      headerName: 'Actions',
      flex: 0.8,
      minWidth: isMobile ? 100 : 120,
      sortable: false,
      renderCell: (params) => (
        <Button
          variant="contained"
          size="small"
          onClick={() => navigate(getPatientDetailUrl(params.row.id))}
          aria-label={`View chart for ${params.row.first_name} ${params.row.last_name}`}
        >
          {isMobile ? 'View' : 'View Chart'}
        </Button>
      ),
    },
  ].filter(Boolean);

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce((term) => {
      setPage(0); // Reset to first page on new search
      fetchPatients(0, pageSize, term);
    }, 500),
    [pageSize]
  );

  const fetchPatients = async (currentPage = page, currentPageSize = pageSize, searchQuery = searchTerm) => {
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
        if (/^\d+$/.test(searchQuery)) {
          searchParams.identifier = searchQuery;
        } else {
          searchParams.name = searchQuery;
        }
      }
      
      const result = await fhirClient.searchPatients(searchParams);
      
      // Extract total count from bundle
      const total = result.total || 0;
      setTotalCount(total);
      
      // Transform FHIR data to table format
      const transformedPatients = await Promise.all((result.entry || []).map(async (entry) => {
        const fhirPatient = entry.resource;
        const name = fhirPatient.name?.[0] || {};
        const mrn = fhirPatient.identifier?.find(id => id.type?.coding?.[0]?.code === 'MR')?.value || '';
        const phone = fhirPatient.telecom?.find(t => t.system === 'phone')?.value || '';
        
        // Try to get insurance information
        let insuranceName = '';
        try {
          const coverageSearchResult = await fhirClient.search('Coverage', {
            patient: fhirPatient.id,
            _count: 1
          });
          
          if (coverageSearchResult.entry?.length > 0) {
            const coverage = coverageSearchResult.entry[0].resource;
            if (coverage.payor?.[0]?.display) {
              insuranceName = coverage.payor[0].display;
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
    } catch (err) {
      setError('Failed to load patients. Please try again.');
      setPatients([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
      setSearchLoading(false);
      setIsRefreshing(false);
    }
  };

  // Initial load
  useEffect(() => {
    if (activeTab === 1) {
      fetchPatients();
    }
  }, [activeTab]);

  // Handle search
  const handleSearchChange = (event) => {
    const value = event.target.value;
    setSearchTerm(value);
    setSearchLoading(true);
    debouncedSearch(value);
  };

  // Handle pagination
  const handlePageChange = (event, newPage) => {
    setPage(newPage);
    fetchPatients(newPage, pageSize);
  };

  const handlePageSizeChange = (event) => {
    const newPageSize = parseInt(event.target.value, 10);
    setPageSize(newPageSize);
    setPage(0);
    fetchPatients(0, newPageSize);
  };

  // Handle refresh
  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchPatients();
  };

  // Handle export
  const handleExport = async () => {
    try {
      // For export, we might want to fetch all patients or implement server-side export
      const allPatientsResult = await fhirClient.searchPatients({
        _count: totalCount,
        _sort: '-_lastUpdated'
      });
      
      // Transform and export logic here
      const csvContent = "data:text/csv;charset=utf-8," 
        + "MRN,First Name,Last Name,Date of Birth,Gender,Phone,Insurance\\n"
        + patients.map(p => 
            `${p.mrn},"${p.first_name}","${p.last_name}",${p.date_of_birth},${p.gender},${p.phone},"${p.insurance_name}"`
          ).join("\\n");
      
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `patients_${format(new Date(), 'yyyy-MM-dd')}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError('Failed to export patient data');
    }
  };

  const handleNewPatientClose = () => {
    setOpenNewPatient(false);
    handleRefresh();
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PeopleIcon /> Patient Registry
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage and search patient records
        </Typography>
      </Box>

      <Paper sx={{ mb: 2, p: 2 }}>
        <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} sx={{ mb: 2 }}>
          <Tab 
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                My Patients
                <Badge badgeContent={myPatientsCount} color="primary" />
              </Box>
            } 
          />
          <Tab 
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                All Patients
                {totalCount > 0 && (
                  <Chip label={totalCount} size="small" color="primary" />
                )}
              </Box>
            } 
          />
        </Tabs>

        <Stack direction="row" spacing={2} alignItems="center">
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Search by name or MRN..."
            value={searchTerm}
            onChange={handleSearchChange}
            aria-label="Search patients by name or MRN"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  {searchLoading ? <CircularProgress size={20} /> : <SearchIcon />}
                </InputAdornment>
              ),
            }}
            inputProps={{
              'aria-describedby': 'patient-search-helper'
            }}
          />
          <Typography id="patient-search-helper" variant="caption" sx={{ display: 'none' }}>
            Search for patients by entering their name or medical record number
          </Typography>
          
          <Stack direction="row" spacing={1}>
            <Tooltip title="Refresh patient list">
              <IconButton 
                onClick={handleRefresh} 
                disabled={isRefreshing}
                aria-label="Refresh patient list"
              >
                <RefreshIcon className={isRefreshing ? 'rotating' : ''} />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Export patient data to CSV">
              <IconButton 
                onClick={handleExport}
                aria-label="Export patient data"
              >
                <DownloadIcon />
              </IconButton>
            </Tooltip>

            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setOpenNewPatient(true)}
              aria-label="Register new patient"
            >
              {isMobile ? 'New' : 'New Patient'}
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        {loading && <LinearProgress />}
        
        <Box sx={{ flexGrow: 1, minHeight: 400 }}>
          {loading ? (
            <Box sx={{ p: 2 }}>
              {/* Skeleton loading for better UX */}
              {Array.from(new Array(pageSize)).map((_, index) => (
                <Box key={index} sx={{ mb: 2 }}>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Skeleton variant="rectangular" width={isMobile ? 60 : 100} height={32} />
                    <Skeleton variant="text" sx={{ flex: 1 }} height={24} />
                    {!isMobile && <Skeleton variant="rectangular" width={120} height={24} />}
                    {!isTablet && <Skeleton variant="rectangular" width={80} height={24} />}
                    <Skeleton variant="rectangular" width={isMobile ? 60 : 100} height={32} />
                  </Stack>
                </Box>
              ))}
            </Box>
          ) : (
            <DataGrid
              rows={patients}
              columns={columns}
              loading={false}
              pageSize={pageSize}
              rowsPerPageOptions={[]}
              checkboxSelection={false}
              disableSelectionOnClick
              disableColumnMenu
              hideFooter
              autoHeight={false}
              sx={{
                '& .MuiDataGrid-cell:hover': {
                  cursor: 'pointer',
                },
                '& .MuiDataGrid-row:hover': {
                  backgroundColor: theme.palette.action.hover,
                },
              }}
              onRowClick={(params) => navigate(getPatientDetailUrl(params.row.id))}
              localeText={{
                noRowsLabel: 'No patients found',
                noResultsOverlayLabel: 'No patients match your search',
              }}
            />
          )}
        </Box>

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
      </Paper>

      <Dialog open={openNewPatient} onClose={handleNewPatientClose} maxWidth="md" fullWidth>
        <DialogTitle>New Patient Registration</DialogTitle>
        <DialogContent>
          <PatientForm onClose={handleNewPatientClose} />
        </DialogContent>
      </Dialog>

      <style jsx>{`
        @keyframes rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .rotating {
          animation: rotate 1s linear infinite;
        }
      `}</style>
    </Box>
  );
}

export default PaginatedPatientList;