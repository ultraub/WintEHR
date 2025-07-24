/**
 * Optimized Results Tab Component
 * Fixed issues:
 * 1. Eliminated repeated requests by consolidating data fetching
 * 2. Proper bundle handling for all data
 * 3. Single source of truth for each data type
 */
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Chip,
  Stack,
  Button,
  IconButton,
  Tooltip,
  Divider,
  Card,
  CardContent,
  CardActions,
  TextField,
  InputAdornment,
  Menu,
  MenuItem,
  FormControl,
  Select,
  InputLabel,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Tabs,
  Tab,
  Badge,
  LinearProgress,
  ToggleButton,
  ToggleButtonGroup,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
  alpha,
  Checkbox,
  FormControlLabel,
  Snackbar
} from '@mui/material';
import {
  Science as LabIcon,  
  Assessment as DiagnosticIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Warning as AbnormalIcon,
  CheckCircle as NormalIcon,
  Schedule as PendingIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  GetApp as DownloadIcon,
  Visibility as ViewIcon,
  Print as PrintIcon,
  CalendarMonth as DateIcon,
  AccessTime as TimeIcon,
  ArrowUpward as HighIcon,
  ArrowDownward as LowIcon,
  Remove as NormalRangeIcon,
  Assessment as AssessmentIcon,
  Close as CloseIcon,
  CheckCircle,
  Timeline as TimelineIcon,
  Person as PersonIcon,
  LocationOn as LocationIcon,
  TableChart as TableIcon,
  ViewModule as CardsIcon,
  ShowChart as TrendsIcon
} from '@mui/icons-material';
import { format, parseISO, isWithinInterval, subDays, subMonths, formatDistanceToNow } from 'date-fns';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import { useNavigate } from 'react-router-dom';
import VitalsOverview from '../../charts/VitalsOverview';
import LabTrendsChart from '../../charts/LabTrendsChart';
import { printDocument, formatLabResultsForPrint } from '../../../../core/export/printUtils';
import { useClinicalWorkflow, CLINICAL_EVENTS } from '../../../../contexts/ClinicalWorkflowContext';
import { 
  getObservationCategory, 
  getObservationInterpretation, 
  getObservationInterpretationDisplay,
  isObservationLaboratory,
  getResourceDisplayText,
  getCodeableConceptDisplay,
  getReferenceId 
} from '../../../../core/fhir/utils/fhirFieldUtils';
import { fhirClient } from '../../../../core/fhir/services/fhirClient';
import CollapsibleFilterPanel from '../CollapsibleFilterPanel';
import ClinicalTabHeader from '../ClinicalTabHeader';
import { 
  ClinicalFilterPanel,
  ClinicalLoadingState,
  ClinicalEmptyState,
  ClinicalDataGrid,
  ObservationCardTemplate,
  ClinicalSummaryCard
} from '../../shared';

// Reference ranges for common lab tests (based on LOINC codes)
const REFERENCE_RANGES = {
  '2339-0': { low: 70, high: 100, unit: 'mg/dL' },     // Glucose
  '38483-4': { low: 0.6, high: 1.2, unit: 'mg/dL' },  // Creatinine
  '2947-0': { low: 136, high: 145, unit: 'mmol/L' },   // Sodium
  '6298-4': { low: 3.5, high: 5.0, unit: 'mmol/L' },  // Potassium
  '2069-3': { low: 98, high: 107, unit: 'mmol/L' },    // Chloride
  '20565-8': { low: 22, high: 29, unit: 'mmol/L' },    // CO2
  '4548-4': { low: 4.0, high: 5.6, unit: '%' },        // Hemoglobin A1c
  '49765-1': { low: 8.5, high: 10.5, unit: 'mg/dL' },  // Calcium
  '6299-2': { low: 7, high: 20, unit: 'mg/dL' }        // Urea Nitrogen
};

// Add reference ranges to observations if missing
const enhanceObservationWithReferenceRange = (observation) => {
  if (observation.referenceRange && observation.referenceRange.length > 0) {
    return observation; // Already has reference range
  }
  
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

// Get result status icon and color
const getResultStatus = (observation) => {
  const interpretation = getObservationInterpretation(observation);
  
  if (!interpretation) {
    return { icon: <NormalRangeIcon />, color: 'default', label: 'Normal' };
  }
  
  const code = interpretation.coding?.[0]?.code;
  
  switch (code) {
    case 'H':
    case 'HH':
    case 'HU':
      return { icon: <HighIcon color="error" />, color: 'error', label: 'High' };
    case 'L':
    case 'LL':
    case 'LU':
      return { icon: <LowIcon color="error" />, color: 'error', label: 'Low' };
    case 'A':
    case 'AA':
      return { icon: <AbnormalIcon color="warning" />, color: 'warning', label: 'Abnormal' };
    case 'N':
      return { icon: <NormalIcon color="success" />, color: 'success', label: 'Normal' };
    default:
      return { icon: <NormalRangeIcon />, color: 'default', label: 'Normal' };
  }
};

const ResultsTabOptimized = ({ patientId }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { currentPatient } = useFHIRResource();
  const { publish } = useClinicalWorkflow();
  
  const [tabValue, setTabValue] = useState(0);
  const [viewMode, setViewMode] = useState('table'); // 'table', 'cards', or 'trends'
  const [filterPeriod, setFilterPeriod] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const scrollContainerRef = useRef(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedResult, setSelectedResult] = useState(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  
  // Single consolidated state for all data
  const [allData, setAllData] = useState({
    labObservations: [],
    vitalObservations: [],
    diagnosticReports: [],
    loading: false,
    error: null,
    lastFetch: null
  });

  // Fetch all data once
  const fetchAllData = useCallback(async () => {
    if (!patientId) return;
    
    setAllData(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      // Fetch all data in parallel
      const [labResults, vitalResults, diagnosticResults] = await Promise.all([
        // Lab observations
        fhirClient.search('Observation', {
          patient: `Patient/${patientId}`,
          category: 'laboratory',
          _sort: '-date',
          _count: 100 // Reasonable limit for initial load
        }),
        // Vital signs
        fhirClient.search('Observation', {
          patient: `Patient/${patientId}`,
          category: 'vital-signs',
          _sort: '-date',
          _count: 50 // Vital signs are more limited
        }),
        // Diagnostic reports
        fhirClient.search('DiagnosticReport', {
          patient: `Patient/${patientId}`,
          _sort: '-date',
          _count: 50 // Reasonable limit for reports
        })
      ]);

      // Process bundles and extract entries
      // Check if response is standardized or raw bundle
      const labEntries = labResults.resources || labResults.entry?.map(e => e.resource) || [];
      const vitalEntries = vitalResults.resources || vitalResults.entry?.map(e => e.resource) || [];
      const diagnosticEntries = diagnosticResults.resources || diagnosticResults.entry?.map(e => e.resource) || [];
      
      const labObservations = labEntries.map(resource => enhanceObservationWithReferenceRange(resource));
      const vitalObservations = vitalEntries;
      const diagnosticReports = diagnosticEntries;

      // Diagnostic logging to help identify the issue
      if (labObservations.length > 0) {
        const dates = labObservations.map(obs => obs.effectiveDateTime || obs.issued).filter(Boolean);
        console.log('Results Tab - Lab observations loaded:', {
          count: labObservations.length,
          dateRange: dates.length > 0 ? {
            earliest: dates.sort()[0],
            latest: dates.sort()[dates.length - 1]
          } : 'No dates found',
          sampleObservation: labObservations[0]
        });
      }

      setAllData({
        labObservations,
        vitalObservations,
        diagnosticReports,
        loading: false,
        error: null,
        lastFetch: new Date()
      });
      
    } catch (error) {
      // Error fetching results data - displaying user-friendly error message
      setAllData(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Failed to load results'
      }));
    }
  }, [patientId]);

  // Fetch data on mount and when patient changes
  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Apply filters to data
  const filteredData = useMemo(() => {
    let data = [];
    
    // Select data based on current tab
    if (tabValue === 0) {
      data = allData.labObservations;
    } else if (tabValue === 1) {
      data = allData.vitalObservations;
    } else if (tabValue === 2) {
      data = allData.diagnosticReports;
    }

    // Apply date filter
    if (filterPeriod !== 'all') {
      const now = new Date();
      let startDate = now;
      
      switch (filterPeriod) {
        case '24h':
          startDate = subDays(now, 1);
          break;
        case '7d':
          startDate = subDays(now, 7);
          break;
        case '30d':
          startDate = subDays(now, 30);
          break;
        case '90d':
          startDate = subDays(now, 90);
          break;
      }
      
      data = data.filter(item => {
        const itemDate = item.effectiveDateTime || item.issued;
        if (!itemDate) return false;
        try {
          return isWithinInterval(parseISO(itemDate), { start: startDate, end: now });
        } catch {
          return false;
        }
      });
    }

    // Apply status filter
    if (filterStatus !== 'all' && tabValue < 2) { // Only for observations
      data = data.filter(obs => {
        const status = getResultStatus(obs);
        switch (filterStatus) {
          case 'abnormal':
            return status.color === 'error' || status.color === 'warning';
          case 'normal':
            return status.color === 'success' || status.color === 'default';
          default:
            return true;
        }
      });
    }

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      data = data.filter(item => {
        const display = getResourceDisplayText(item).toLowerCase();
        const code = item.code?.coding?.[0]?.code || '';
        return display.includes(searchLower) || code.includes(searchLower);
      });
    }

    return data;
  }, [allData, tabValue, filterPeriod, filterStatus, searchTerm]);

  // Paginated data
  const paginatedData = useMemo(() => {
    const start = page * rowsPerPage;
    const end = start + rowsPerPage;
    return filteredData.slice(start, end);
  }, [filteredData, page, rowsPerPage]);

  // Handlers
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
    setPage(0);
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleViewDetails = (result) => {
    setSelectedResult(result);
    setDetailsDialogOpen(true);
  };

  // Render content based on view mode
  const renderContent = () => {
    if (allData.loading) {
      return (
        <Box sx={{ p: 2 }}>
          {viewMode === 'cards' ? (
            <Grid container spacing={2}>
              {[1, 2, 3, 4].map((i) => (
                <Grid item xs={12} md={6} key={i}>
                  <ClinicalLoadingState.ResourceCard />
                </Grid>
              ))}
            </Grid>
          ) : (
            <ClinicalLoadingState.Table rows={5} columns={6} />
          )}
        </Box>
      );
    }

    if (allData.error) {
      return (
        <ClinicalEmptyState
          title="Unable to load results"
          message={allData.error}
          severity="error"
          actions={[
            { label: 'Retry', onClick: fetchAllData }
          ]}
        />
      );
    }

    if (viewMode === 'trends' && tabValue < 2) {
      // Show trends view for observations
      const observations = tabValue === 0 ? allData.labObservations : allData.vitalObservations;
      return (
        <Box sx={{ p: 2 }}>
          {tabValue === 0 ? (
            <LabTrendsChart patientId={patientId} observations={observations} />
          ) : (
            <VitalsOverview patientId={patientId} observations={observations} />
          )}
        </Box>
      );
    }

    if (viewMode === 'cards') {
      // Card view using ObservationCardTemplate
      return (
        <Grid container spacing={2} sx={{ p: 2 }}>
          {paginatedData.map((item, index) => (
            <Grid item xs={12} md={6} key={item.id}>
              <ObservationCardTemplate
                observation={item}
                onEdit={() => handleViewDetails(item)}
                onMore={() => handleViewDetails(item)}
                isAlternate={index % 2 === 1}
              />
            </Grid>
          ))}
        </Grid>
      );
    }

    // Empty state
    if (filteredData.length === 0) {
      return (
        <ClinicalEmptyState
          title={searchTerm || filterPeriod !== 'all' || filterStatus !== 'all' ? 
            'No results match your filters' : 'No results available'}
          message={searchTerm || filterPeriod !== 'all' || filterStatus !== 'all' ?
            'Try adjusting your search criteria or clearing filters' :
            'No test results found for this patient'}
          actions={[
            ...(searchTerm || filterPeriod !== 'all' || filterStatus !== 'all' ? [
              { 
                label: 'Clear Filters', 
                onClick: () => {
                  setSearchTerm('');
                  setFilterPeriod('all');
                  setFilterStatus('all');
                }
              }
            ] : [])
          ]}
        />
      );
    }

    // Default table view
    return (
      <TableContainer sx={{ borderRadius: 0 }}>
        <Table sx={{ '& .MuiTableCell-root': { borderRadius: 0 } }}>
          <TableHead>
            <TableRow>
              <TableCell>Test Name</TableCell>
              <TableCell>Result</TableCell>
              <TableCell>Reference Range</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedData.map((item, index) => {
              const status = getResultStatus(item);
              const value = item.valueQuantity ? 
                `${item.valueQuantity.value} ${item.valueQuantity.unit || ''}` :
                item.valueString || 'Pending';
              const reference = item.referenceRange?.[0]?.text || '-';
              const date = item.effectiveDateTime || item.issued;
              
              return (
                <TableRow 
                  key={item.id} 
                  hover
                  sx={{ 
                    bgcolor: index % 2 === 1 ? 'action.hover' : 'background.paper',
                    '&:hover': {
                      bgcolor: 'action.selected'
                    }
                  }}
                >
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      {status.icon}
                      <Typography variant="body2">
                        {getResourceDisplayText(item)}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={status.label !== 'Normal' ? 'bold' : 'normal'}>
                      {value}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {reference}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {status.label && (
                      <Chip 
                        label={status.label} 
                        size="small" 
                        color={status.color}
                        sx={{ 
                          fontWeight: 'bold',
                          borderRadius: '4px'
                        }}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">
                      {date ? format(parseISO(date), 'MMM d, yyyy h:mm a') : 'No date'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => handleViewDetails(item)}>
                      <ViewIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={filteredData.length}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </TableContainer>
    );
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }} ref={scrollContainerRef}>
      {/* Header */}
      <ClinicalTabHeader
        title="Results"
        subtitle={`${allData.labObservations.length + allData.vitalObservations.length + allData.diagnosticReports.length} total results`}
        icon={AssessmentIcon}
        onPrint={() => {/* Add print handler */}}
        onExport={() => {/* Add export handler */}}
        onRefresh={fetchAllData}
        dense={false}
      >
        {/* Clinical Filter Panel */}
        <ClinicalFilterPanel
          searchQuery={searchTerm}
          onSearchChange={setSearchTerm}
          dateRange={filterPeriod}
          onDateRangeChange={setFilterPeriod}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onRefresh={fetchAllData}
          scrollContainerRef={scrollContainerRef}
        >
          {/* Additional custom filter for Status when showing observations */}
          {tabValue < 2 && (
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                label="Status"
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="abnormal">Abnormal</MenuItem>
                <MenuItem value="normal">Normal</MenuItem>
              </Select>
            </FormControl>
          )}
        </ClinicalFilterPanel>
      </ClinicalTabHeader>
      
      {/* Tabs */}
      <Tabs value={tabValue} onChange={handleTabChange} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tab 
          label={
            <Badge badgeContent={allData.labObservations.length} color="primary">
              Lab Results
            </Badge>
          } 
        />
        <Tab 
          label={
            <Badge badgeContent={allData.vitalObservations.length} color="primary">
              Vital Signs
            </Badge>
          } 
        />
        <Tab 
          label={
            <Badge badgeContent={allData.diagnosticReports.length} color="primary">
              Diagnostic Reports
            </Badge>
          } 
        />
      </Tabs>
      
      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {renderContent()}
      </Box>
      
      {/* Details Dialog */}
      <Dialog
        open={detailsDialogOpen}
        onClose={() => setDetailsDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 0 } }}
      >
        <DialogTitle>
          Result Details
          <IconButton
            aria-label="close"
            onClick={() => setDetailsDialogOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {selectedResult && (
            <Box>
              <Typography variant="h6" gutterBottom>
                {getResourceDisplayText(selectedResult)}
              </Typography>
              {/* Add detailed result view here */}
              <pre>{JSON.stringify(selectedResult, null, 2)}</pre>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ResultsTabOptimized;