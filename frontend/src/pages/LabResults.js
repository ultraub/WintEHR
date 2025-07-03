import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Button,
  CircularProgress,
  Alert,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TablePagination,
  Tooltip,
} from '@mui/material';
import {
  Search as SearchIcon,
  Visibility as ViewIcon,
  Flag as FlagIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  FilterList as FilterIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { fhirClient } from '../services/fhirClient';

function LabResults() {
  const [labResults, setLabResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const navigate = useNavigate();

  useEffect(() => {
    fetchLabResults();
  }, []);

  const fetchLabResults = async () => {
    try {
      setLoading(true);
      
      // Search for laboratory observations
      const result = await fhirClient.search('Observation', {
        category: 'laboratory',
        _sort: '-date',
        _count: 100,
        _include: 'Observation:patient'
      });
      
      // Transform FHIR observations to expected format
      const transformedResults = await Promise.all(result.resources.map(async (obs) => {
        const patientId = fhirClient.extractId(obs.subject);
        const abnormal = obs.interpretation?.[0]?.coding?.[0]?.code !== 'N';
        const critical = obs.interpretation?.[0]?.coding?.[0]?.code === 'HH' || 
                        obs.interpretation?.[0]?.coding?.[0]?.code === 'LL';
        
        // Fetch patient info
        let patientInfo = { name: 'Unknown Patient' };
        try {
          const patient = await fhirClient.read('Patient', patientId);
          const name = patient.name?.[0] || {};
          patientInfo.name = `${name.given?.join(' ') || ''} ${name.family || ''}`.trim();
        } catch (err) {
          console.error('Error fetching patient info:', err);
        }
        
        return {
          id: obs.id,
          patient_name: patientInfo.name,
          patient_id: patientId,
          test_name: obs.code?.text || obs.code?.coding?.[0]?.display || 'Lab Test',
          value: obs.valueQuantity ? 
            `${obs.valueQuantity.value} ${obs.valueQuantity.unit}` : 
            obs.valueString || 'N/A',
          reference_range: obs.referenceRange?.[0]?.text || '-',
          status: obs.status,
          collection_date: obs.effectiveDateTime || obs.effectivePeriod?.start,
          interpretation: obs.interpretation?.[0]?.text || 
                          obs.interpretation?.[0]?.coding?.[0]?.display || 
                          'Normal',
          abnormal,
          critical,
          reviewed: false // Would need extension to track this
        };
      }));
      
      setLabResults(transformedResults);
      setError(null);
    } catch (err) {
      console.error('Error fetching lab results:', err);
      setError('Failed to load lab results');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleViewResult = (result) => {
    navigate(`/patients/${result.patient_id}`, { 
      state: { tab: 'lab-results', resultId: result.id } 
    });
  };

  const filteredResults = labResults.filter(result => {
    const matchesSearch = result.patient_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         result.test_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'abnormal' && result.abnormal) ||
                         (statusFilter === 'critical' && result.critical) ||
                         (statusFilter === 'normal' && !result.abnormal);
    
    return matchesSearch && matchesStatus;
  });

  const paginatedResults = filteredResults.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">
          Lab Results
        </Typography>
        <Box display="flex" gap={2}>
          <TextField
            size="small"
            placeholder="Search patient or test..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{ width: 300 }}
          />
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              label="Status"
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="all">All Results</MenuItem>
              <MenuItem value="normal">Normal</MenuItem>
              <MenuItem value="abnormal">Abnormal</MenuItem>
              <MenuItem value="critical">Critical</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Patient</TableCell>
                <TableCell>Test Name</TableCell>
                <TableCell>Value</TableCell>
                <TableCell>Reference Range</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedResults.map((result) => (
                <TableRow key={result.id} hover>
                  <TableCell>{result.patient_name}</TableCell>
                  <TableCell>{result.test_name}</TableCell>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      {result.critical && (
                        <Tooltip title="Critical value">
                          <WarningIcon color="error" fontSize="small" />
                        </Tooltip>
                      )}
                      {result.value}
                    </Box>
                  </TableCell>
                  <TableCell>{result.reference_range}</TableCell>
                  <TableCell>
                    {format(new Date(result.collection_date), 'MM/dd/yyyy')}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={result.interpretation}
                      size="small"
                      color={result.critical ? 'error' : result.abnormal ? 'warning' : 'success'}
                      icon={result.critical ? <WarningIcon /> : result.abnormal ? <FlagIcon /> : <CheckIcon />}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="View in patient chart">
                      <IconButton
                        size="small"
                        onClick={() => handleViewResult(result)}
                      >
                        <ViewIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={filteredResults.length}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[10, 25, 50, 100]}
        />
      </Paper>
    </Box>
  );
}

export default LabResults;
