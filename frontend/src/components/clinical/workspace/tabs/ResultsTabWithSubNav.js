/**
 * Results Tab with Sub-navigation
 * Clean professional medical UI with tab-based sub-navigation
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  InputAdornment,
  IconButton,
  Button,
  Stack,
  Chip,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  CircularProgress,
  Alert,
  Badge,
  Tooltip,
  useTheme,
  alpha
} from '@mui/material';
import {
  Search as SearchIcon,
  Print as PrintIcon,
  Download as DownloadIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Remove as NormalIcon,
  Warning as AbnormalIcon,
  Science as LabIcon,
  FitnessCenter as VitalIcon,
  Description as ReportIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { format, parseISO, subDays } from 'date-fns';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import { fhirClient } from '../../../../core/fhir/services/fhirClient';
import { 
  getObservationInterpretation,
  getResourceDisplayText
} from '../../../../core/fhir/utils/fhirFieldUtils';
import VitalSignsChart from '../../charts/VitalSignsChart';
import LabTrends from '../../charts/LabTrends';

// Reference ranges for common tests
const REFERENCE_RANGES = {
  '2339-0': { low: 70, high: 100, unit: 'mg/dL' },     // Glucose
  '38483-4': { low: 0.6, high: 1.2, unit: 'mg/dL' },  // Creatinine
  '2947-0': { low: 136, high: 145, unit: 'mmol/L' },   // Sodium
  '6298-4': { low: 3.5, high: 5.0, unit: 'mmol/L' },  // Potassium
  '2069-3': { low: 98, high: 107, unit: 'mmol/L' },    // Chloride
  '20565-8': { low: 22, high: 29, unit: 'mmol/L' },    // CO2
  '4548-4': { low: 4.0, high: 5.6, unit: '%' },        // Hemoglobin A1c
};

const enhanceObservationWithReferenceRange = (observation) => {
  if (observation.referenceRange?.length > 0) return observation;
  
  const loincCode = observation.code?.coding?.[0]?.code;
  const refRange = REFERENCE_RANGES[loincCode];
  
  if (refRange) {
    return {
      ...observation,
      referenceRange: [{
        low: { value: refRange.low, unit: refRange.unit },
        high: { value: refRange.high, unit: refRange.unit },
        text: `${refRange.low}-${refRange.high} ${refRange.unit}`
      }]
    };
  }
  
  return observation;
};

const getResultStatus = (observation) => {
  const interpretation = getObservationInterpretation(observation);
  if (!interpretation) return { color: 'default', label: 'Normal' };
  
  const code = interpretation.coding?.[0]?.code;
  
  switch (code) {
    case 'H':
    case 'HH':
      return { color: 'error', label: 'High', icon: <TrendingUpIcon fontSize="small" /> };
    case 'L':
    case 'LL':
      return { color: 'error', label: 'Low', icon: <TrendingDownIcon fontSize="small" /> };
    case 'A':
    case 'AA':
      return { color: 'warning', label: 'Abnormal', icon: <AbnormalIcon fontSize="small" /> };
    default:
      return { color: 'success', label: 'Normal', icon: <NormalIcon fontSize="small" /> };
  }
};

const ResultsTabWithSubNav = ({ patientId }) => {
  const theme = useTheme();
  const { currentPatient } = useFHIRResource();
  
  // States
  const [currentTab, setCurrentTab] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPeriod, setFilterPeriod] = useState('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Data state
  const [data, setData] = useState({
    labResults: [],
    vitalSigns: [],
    diagnosticReports: []
  });
  
  // Fetch all data
  const fetchData = useCallback(async () => {
    if (!patientId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const [labRes, vitalRes, diagRes] = await Promise.all([
        fhirClient.search('Observation', {
          patient: `Patient/${patientId}`,
          category: 'laboratory',
          _sort: '-date',
          _count: 100
        }),
        fhirClient.search('Observation', {
          patient: `Patient/${patientId}`,
          category: 'vital-signs',
          _sort: '-date',
          _count: 50
        }),
        fhirClient.search('DiagnosticReport', {
          patient: `Patient/${patientId}`,
          _sort: '-date',
          _count: 50
        })
      ]);
      
      setData({
        labResults: (labRes.resources || []).map(enhanceObservationWithReferenceRange),
        vitalSigns: vitalRes.resources || [],
        diagnosticReports: diagRes.resources || []
      });
    } catch (err) {
      setError('Failed to load results');
    } finally {
      setLoading(false);
    }
  }, [patientId]);
  
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  // Get current data based on tab
  const getCurrentData = () => {
    switch (currentTab) {
      case 0: return data.labResults;
      case 1: return data.vitalSigns;
      case 2: return data.diagnosticReports;
      default: return [];
    }
  };
  
  // Apply filters
  const filteredData = useMemo(() => {
    let filtered = getCurrentData();
    
    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(item => {
        const display = getResourceDisplayText(item).toLowerCase();
        return display.includes(search);
      });
    }
    
    // Date filter
    if (filterPeriod !== 'all') {
      const now = new Date();
      let startDate = now;
      
      const periods = {
        '7d': 7,
        '30d': 30,
        '90d': 90
      };
      
      if (periods[filterPeriod]) {
        startDate = subDays(now, periods[filterPeriod]);
        filtered = filtered.filter(item => {
          const date = item.effectiveDateTime || item.issued;
          return date && new Date(date) >= startDate;
        });
      }
    }
    
    return filtered;
  }, [currentTab, searchTerm, filterPeriod, data]);
  
  // Pagination
  const paginatedData = filteredData.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );
  
  // Handlers
  const handleTabChange = (event, newValue) => {
    setCurrentTab(newValue);
    setPage(0);
  };
  
  const handlePrint = () => {
    window.print();
  };
  
  const handleExport = () => {
    // Export functionality
  };
  
  // Render lab results table
  const renderLabResults = () => (
    <Box sx={{ p: 2 }}>
      {/* Lab Trends Chart */}
      <Paper sx={{ p: 3, mb: 3, borderRadius: 2, boxShadow: 1 }}>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: theme.palette.text.primary }}>
          Lab Trends
        </Typography>
        <LabTrends patientId={patientId} height={350} />
      </Paper>
      
      {/* Lab Results Table */}
      <Paper sx={{ p: 3, borderRadius: 2, boxShadow: 1 }}>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: theme.palette.text.primary }}>
          Recent Lab Results
        </Typography>
        <TableContainer component={Box} sx={{ boxShadow: 'none' }}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: theme.palette.action.hover }}>
                <TableCell sx={{ fontWeight: 600 }}>Test Name</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>Result</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>Reference Range</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {paginatedData.map((result) => {
            const status = getResultStatus(result);
            const value = result.valueQuantity ? 
              `${result.valueQuantity.value} ${result.valueQuantity.unit || ''}` :
              result.valueString || 'Pending';
            const reference = result.referenceRange?.[0]?.text || '-';
            const date = result.effectiveDateTime || result.issued;
            
            return (
              <TableRow key={result.id} hover>
                <TableCell>
                  <Typography variant="body2" fontWeight={500}>
                    {getResourceDisplayText(result)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography 
                      variant="body2" 
                      fontWeight={status.label !== 'Normal' ? 600 : 400}
                      color={status.label !== 'Normal' ? status.color + '.main' : 'inherit'}
                    >
                      {value}
                    </Typography>
                    {status.icon}
                  </Stack>
                </TableCell>
                <TableCell>
                  <Typography variant="caption" color="text.secondary">
                    {reference}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip 
                    label={status.label} 
                    size="small" 
                    color={status.color}
                    sx={{ 
                      fontWeight: 500,
                      borderRadius: '4px'
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary">
                    {date ? format(parseISO(date), 'MMM d, yyyy h:mm a') : '-'}
                  </Typography>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
      </Paper>
    </Box>
  );
  
  // Render vital signs table
  const renderVitalSigns = () => (
    <Box sx={{ p: 2 }}>
      {/* Vital Signs Chart */}
      <Paper sx={{ p: 3, mb: 3, borderRadius: 2, boxShadow: 1 }}>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: theme.palette.text.primary }}>
          Vital Signs Trends
        </Typography>
        <VitalSignsChart 
          patientId={patientId} 
          vitalSigns={data.vitalSigns} 
          selectedVitalType="bloodPressure" 
          height={350} 
        />
      </Paper>
      
      {/* Recent Vital Signs Table */}
      <Paper sx={{ p: 3, borderRadius: 2, boxShadow: 1 }}>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: theme.palette.text.primary }}>
          Recent Vital Signs
        </Typography>
        <TableContainer component={Box} sx={{ boxShadow: 'none' }}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: theme.palette.action.hover }}>
                <TableCell sx={{ fontWeight: 600 }}>Vital Sign</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Value</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Date/Time</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedData.map((vital) => (
                <TableRow key={vital.id} hover>
                  <TableCell>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <VitalIcon fontSize="small" color="primary" />
                      <Typography variant="body2" fontWeight={500}>
                        {getResourceDisplayText(vital)}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>
                      {vital.valueQuantity ? 
                        `${vital.valueQuantity.value} ${vital.valueQuantity.unit || ''}` :
                        vital.valueString || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {vital.effectiveDateTime ? 
                        format(parseISO(vital.effectiveDateTime), 'MMM d, yyyy h:mm a') : '-'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
  
  // Render diagnostic reports table
  const renderDiagnosticReports = () => (
    <TableContainer component={Paper} sx={{ boxShadow: 'none' }}>
      <Table>
        <TableHead>
          <TableRow sx={{ backgroundColor: theme.palette.action.hover }}>
            <TableCell sx={{ fontWeight: 600 }}>Report</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>Category</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {paginatedData.map((report) => (
            <TableRow key={report.id} hover>
              <TableCell>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <ReportIcon fontSize="small" color="action" />
                  <Typography variant="body2" fontWeight={500}>
                    {report.code?.text || report.code?.coding?.[0]?.display || 'Report'}
                  </Typography>
                </Stack>
              </TableCell>
              <TableCell>
                <Typography variant="body2">
                  {report.category?.[0]?.text || 
                   report.category?.[0]?.coding?.[0]?.display || '-'}
                </Typography>
              </TableCell>
              <TableCell>
                <Chip 
                  label={report.status || 'Unknown'} 
                  size="small"
                  color={report.status === 'final' ? 'success' : 'default'}
                  sx={{ borderRadius: '4px' }}
                />
              </TableCell>
              <TableCell>
                <Typography variant="body2" color="text.secondary">
                  {report.effectiveDateTime ? 
                    format(parseISO(report.effectiveDateTime), 'MMM d, yyyy') : '-'}
                </Typography>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
  
  if (loading && data.labResults.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }
  
  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }
  
  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: theme.palette.background.default }}>
      {/* Header */}
      <Box sx={{ backgroundColor: theme.palette.background.paper, borderBottom: `1px solid ${theme.palette.divider}`, p: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={3} alignItems="center">
            <TextField
              size="small"
              placeholder="Search results..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
              sx={{ 
                minWidth: 250,
                backgroundColor: theme.palette.action.hover,
                '& .MuiOutlinedInput-root': {
                  borderRadius: '4px'
                }
              }}
            />
            
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Time Period</InputLabel>
              <Select
                value={filterPeriod}
                onChange={(e) => setFilterPeriod(e.target.value)}
                label="Time Period"
                sx={{ backgroundColor: theme.palette.background.paper }}
              >
                <MenuItem value="all">All Time</MenuItem>
                <MenuItem value="7d">Last 7 Days</MenuItem>
                <MenuItem value="30d">Last 30 Days</MenuItem>
                <MenuItem value="90d">Last 90 Days</MenuItem>
              </Select>
            </FormControl>
          </Stack>
          
          <Stack direction="row" spacing={1}>
            <Tooltip title="Refresh">
              <IconButton onClick={fetchData} size="small">
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <Button
              size="small"
              startIcon={<PrintIcon />}
              onClick={handlePrint}
            >
              Print
            </Button>
            <Button
              size="small"
              startIcon={<DownloadIcon />}
              onClick={handleExport}
              variant="contained"
            >
              Export
            </Button>
          </Stack>
        </Stack>
      </Box>
      
      {/* Tabs */}
      <Box sx={{ backgroundColor: theme.palette.background.paper, borderBottom: `1px solid ${theme.palette.divider}` }}>
        <Tabs 
          value={currentTab} 
          onChange={handleTabChange}
          sx={{
            '& .MuiTabs-indicator': {
              backgroundColor: theme.palette.primary.main,
              height: 3
            },
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 500,
              color: theme.palette.text.secondary,
              '&.Mui-selected': {
                color: theme.palette.primary.main,
                fontWeight: 600
              }
            }
          }}
        >
          <Tab 
            label={
              <Stack direction="row" spacing={1} alignItems="center">
                <LabIcon />
                <span>Lab Results</span>
                <Chip 
                  label={data.labResults.length} 
                  size="small" 
                  sx={{ height: 20, fontSize: '0.75rem' }}
                />
              </Stack>
            } 
          />
          <Tab 
            label={
              <Stack direction="row" spacing={1} alignItems="center">
                <VitalIcon />
                <span>Vital Signs</span>
                <Chip 
                  label={data.vitalSigns.length} 
                  size="small" 
                  sx={{ height: 20, fontSize: '0.75rem' }}
                />
              </Stack>
            } 
          />
          <Tab 
            label={
              <Stack direction="row" spacing={1} alignItems="center">
                <ReportIcon />
                <span>Diagnostic Reports</span>
                <Chip 
                  label={data.diagnosticReports.length} 
                  size="small" 
                  sx={{ height: 20, fontSize: '0.75rem' }}
                />
              </Stack>
            } 
          />
        </Tabs>
      </Box>
      
      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'auto', backgroundColor: theme.palette.background.default }}>
        {currentTab === 0 && renderLabResults()}
        {currentTab === 1 && renderVitalSigns()}
        {currentTab === 2 && renderDiagnosticReports()}
        
        {filteredData.length > 0 && currentTab === 2 && (
          <TablePagination
            component="div"
            count={filteredData.length}
            page={page}
            onPageChange={(e, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            sx={{ borderTop: `1px solid ${theme.palette.divider}`, backgroundColor: theme.palette.background.paper }}
          />
        )}
      </Box>
    </Box>
  );
};

export default ResultsTabWithSubNav;