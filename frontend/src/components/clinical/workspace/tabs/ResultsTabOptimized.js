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
  ToggleButton,
  ToggleButtonGroup,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
  alpha,
  Checkbox,
  FormControlLabel
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
  ShowChart as TrendsIcon,
  Refresh as RefreshIcon,
  Assignment as OrderIcon
} from '@mui/icons-material';
import { parseISO, isWithinInterval, subDays, subMonths, formatDistanceToNow } from 'date-fns';
import { formatClinicalDate } from '../../../../core/fhir/utils/dateFormatUtils';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import { navigateToTab, TAB_IDS } from '../../utils/navigationHelper';
import VitalsOverview from '../../charts/VitalsOverview';
import LabTrendsChart from '../../charts/LabTrendsChart';
import { printDocument, formatLabResultsForPrint } from '../../../../core/export/printUtils';
import { useClinicalWorkflow, CLINICAL_EVENTS } from '../../../../contexts/ClinicalWorkflowContext';
import websocketService from '../../../../services/websocket';
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

// Detect critical values by comparing value to referenceRange
// Returns { isCritical, isAbnormal, direction } or null if no comparison possible
const detectCriticalFromReferenceRange = (observation) => {
  const value = observation.valueQuantity?.value;
  if (value === undefined || value === null) return null;

  const refRange = observation.referenceRange?.[0];
  if (!refRange) return null;

  const low = refRange.low?.value;
  const high = refRange.high?.value;

  // Calculate critical thresholds (typically 20% beyond normal range)
  const criticalMargin = 0.2;
  const normalRange = high && low ? high - low : 0;
  const criticalLow = low !== undefined ? low - (normalRange * criticalMargin) : undefined;
  const criticalHigh = high !== undefined ? high + (normalRange * criticalMargin) : undefined;

  if (criticalLow !== undefined && value < criticalLow) {
    return { isCritical: true, isAbnormal: true, direction: 'low' };
  }
  if (criticalHigh !== undefined && value > criticalHigh) {
    return { isCritical: true, isAbnormal: true, direction: 'high' };
  }
  if (low !== undefined && value < low) {
    return { isCritical: false, isAbnormal: true, direction: 'low' };
  }
  if (high !== undefined && value > high) {
    return { isCritical: false, isAbnormal: true, direction: 'high' };
  }
  return { isCritical: false, isAbnormal: false, direction: null };
};

// Get result status icon and color
const getResultStatus = (observation) => {
  const interpretation = getObservationInterpretation(observation);

  // First check explicit interpretation codes
  if (interpretation) {
    const code = interpretation.coding?.[0]?.code;

    switch (code) {
      case 'HH': // Critical high
        return { icon: <HighIcon color="error" />, color: 'error', label: 'Critical High', isCritical: true };
      case 'LL': // Critical low
        return { icon: <LowIcon color="error" />, color: 'error', label: 'Critical Low', isCritical: true };
      case 'H':
      case 'HU':
        return { icon: <HighIcon color="error" />, color: 'error', label: 'High', isCritical: false };
      case 'L':
      case 'LU':
        return { icon: <LowIcon color="error" />, color: 'error', label: 'Low', isCritical: false };
      case 'A':
      case 'AA':
        return { icon: <AbnormalIcon color="warning" />, color: 'warning', label: 'Abnormal', isCritical: code === 'AA' };
      case 'N':
        return { icon: <NormalIcon color="success" />, color: 'success', label: 'Normal', isCritical: false };
      default:
        break;
    }
  }

  // Fallback: detect critical values from referenceRange
  const detection = detectCriticalFromReferenceRange(observation);
  if (detection) {
    if (detection.isCritical) {
      return detection.direction === 'high'
        ? { icon: <HighIcon color="error" />, color: 'error', label: 'Critical High', isCritical: true }
        : { icon: <LowIcon color="error" />, color: 'error', label: 'Critical Low', isCritical: true };
    }
    if (detection.isAbnormal) {
      return detection.direction === 'high'
        ? { icon: <HighIcon color="error" />, color: 'error', label: 'High', isCritical: false }
        : { icon: <LowIcon color="error" />, color: 'error', label: 'Low', isCritical: false };
    }
  }

  return { icon: <NormalRangeIcon />, color: 'default', label: 'Normal', isCritical: false };
};

const ResultsTabOptimized = ({
  patientId,
  onNavigateToTab // Cross-tab navigation support
}) => {
  const theme = useTheme();
  const { currentPatient } = useFHIRResource();
  const { publish, subscribe } = useClinicalWorkflow();
  
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

  // Critical value alert state
  const [criticalAlertDialog, setCriticalAlertDialog] = useState({
    open: false,
    observation: null
  });

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

  // Real-time updates subscription
  useEffect(() => {
    if (!patientId) return;

    // Setting up real-time subscriptions for patient

    const subscriptions = [];

    // Subscribe to result-related events
    const resultEvents = [
      CLINICAL_EVENTS.RESULT_AVAILABLE,
      CLINICAL_EVENTS.CRITICAL_VALUE_ALERT,
      CLINICAL_EVENTS.RESULT_ACKNOWLEDGED,
      CLINICAL_EVENTS.OBSERVATION_RECORDED,
      CLINICAL_EVENTS.VITAL_SIGNS_RECORDED
    ];

    resultEvents.forEach(eventType => {
      const unsubscribe = subscribe(eventType, (event) => {
        // Result event received
        
        // Handle update if the event is for the current patient
        if (event.patientId === patientId) {
          // Updating results for event
          handleResultUpdate(eventType, event);
        }
      });
      subscriptions.push(unsubscribe);
    });

    return () => {
      // Cleaning up subscriptions
      subscriptions.forEach(unsub => unsub());
    };
  }, [patientId, subscribe]);

  // Ref to track WebSocket subscription ID for proper cleanup
  const wsSubscriptionIdRef = useRef(null);

  // WebSocket patient room subscription for multi-user sync
  useEffect(() => {
    if (!patientId || !websocketService.isConnected) return;

    // Setting up WebSocket patient room subscription

    const setupPatientSubscription = async () => {
      try {
        // Subscribe to patient room for result-related resources
        const resourceTypes = [
          'Observation',
          'DiagnosticReport'
        ];

        const subscriptionId = await websocketService.subscribeToPatient(patientId, resourceTypes);
        wsSubscriptionIdRef.current = subscriptionId;
        // Successfully subscribed to patient room
      } catch (error) {
        // Failed to subscribe to patient room
      }
    };

    setupPatientSubscription();

    return () => {
      if (wsSubscriptionIdRef.current) {
        // Unsubscribing from patient room
        websocketService.unsubscribeFromPatient(wsSubscriptionIdRef.current);
        wsSubscriptionIdRef.current = null;
      }
    };
  }, [patientId]);

  // Handle incremental result updates
  const handleResultUpdate = useCallback((eventType, eventData) => {
    // Handling result update
    
    // Extract the result from the event data
    const result = eventData.result || eventData.observation || eventData.resource;
    
    if (!result) {
      // No result in event data
      return;
    }

    // Determine resource type and update appropriate state
    if (result.resourceType === 'Observation') {
      const category = getObservationCategory(result);
      
      if (category === 'laboratory') {
        // Update lab observations
        setAllData(prev => ({
          ...prev,
          labObservations: updateResultsList(prev.labObservations, result, eventType)
        }));
      } else if (category === 'vital-signs') {
        // Update vital observations
        setAllData(prev => ({
          ...prev,
          vitalObservations: updateResultsList(prev.vitalObservations, result, eventType)
        }));
      }
      
      // Show notification for critical values
      if (eventType === CLINICAL_EVENTS.CRITICAL_VALUE_ALERT) {
        showCriticalValueAlert(result);
      }
    } else if (result.resourceType === 'DiagnosticReport') {
      // Update diagnostic reports
      setAllData(prev => ({
        ...prev,
        diagnosticReports: updateResultsList(prev.diagnosticReports, result, eventType)
      }));
    }
  }, []);

  // Helper function to update results list
  const updateResultsList = (list, newResult, eventType) => {
    // For new results, add to beginning
    if (eventType === CLINICAL_EVENTS.RESULT_AVAILABLE || 
        eventType === CLINICAL_EVENTS.OBSERVATION_RECORDED ||
        eventType === CLINICAL_EVENTS.VITAL_SIGNS_RECORDED) {
      // Check if already exists
      const exists = list.some(item => item.id === newResult.id);
      if (!exists) {
        return [enhanceObservationWithReferenceRange(newResult), ...list];
      }
    }
    
    // For updates, replace existing
    return list.map(item => 
      item.id === newResult.id ? enhanceObservationWithReferenceRange(newResult) : item
    );
  };

  // Show critical value alert dialog
  const showCriticalValueAlert = useCallback((observation) => {
    setCriticalAlertDialog({
      open: true,
      observation
    });
  }, []);

  // Handle critical alert acknowledgment
  const handleCriticalAlertAcknowledge = useCallback(() => {
    const observation = criticalAlertDialog.observation;
    if (observation) {
      // Publish acknowledgment event for audit trail
      publish(CLINICAL_EVENTS.RESULT_ACKNOWLEDGED, {
        observationId: observation.id,
        patientId: patientId,
        acknowledgedAt: new Date().toISOString(),
        critical: true
      });
    }
    setCriticalAlertDialog({ open: false, observation: null });
  }, [criticalAlertDialog.observation, patientId, publish]);

  // Get formatted critical value details
  const getCriticalValueDetails = useCallback((observation) => {
    if (!observation) return {};

    const value = observation.valueQuantity?.value;
    const unit = observation.valueQuantity?.unit || '';
    const code = observation.code?.text || observation.code?.coding?.[0]?.display || 'Unknown Test';
    const refRange = observation.referenceRange?.[0];
    const low = refRange?.low?.value;
    const high = refRange?.high?.value;

    return {
      testName: code,
      value: value !== undefined ? `${value} ${unit}` : observation.valueString || 'Unknown',
      referenceRange: low !== undefined && high !== undefined ? `${low} - ${high} ${unit}` : 'Not available',
      effectiveDate: observation.effectiveDateTime ? formatClinicalDate(observation.effectiveDateTime) : 'Unknown',
      status: getResultStatus(observation)
    };
  }, []);

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
        <Box sx={{ p: { xs: 0.5, sm: 1 } }}>
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
        <Grid container spacing={1} sx={{ p: { xs: 0.5, sm: 1 } }}>
          {paginatedData.map((item, index) => (
            <Grid item xs={12} md={6} key={item.id}>
              <ObservationCardTemplate
                observation={item}
                onEdit={() => handleViewDetails(item)}
                onMore={() => handleViewDetails(item)}
                isAlternate={index % 2 === 1}
                customActions={
                  item.basedOn?.[0]?.reference && onNavigateToTab ? (
                    <Tooltip title="View Related Order">
                      <IconButton
                        size="small"
                        onClick={() => {
                          const orderId = item.basedOn[0].reference.split('/')[1];
                          navigateToTab(onNavigateToTab, TAB_IDS.ORDERS, {
                            resourceId: orderId,
                            resourceType: 'ServiceRequest',
                            action: 'highlight'
                          });
                        }}
                      >
                        <OrderIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  ) : null
                }
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
              
              // Format reference range from low/high values
              const refRange = item.referenceRange?.[0];
              const reference = refRange ? 
                (refRange.text || 
                 (refRange.low || refRange.high ? 
                  `${refRange.low?.value || ''} - ${refRange.high?.value || ''} ${refRange.low?.unit || refRange.high?.unit || ''}`.trim() : 
                  '-')) :
                '-';
              
              const date = item.effectiveDateTime || item.issued;
              
              return (
                <TableRow 
                  key={item.id} 
                  hover
                  sx={{ 
                    bgcolor: index % 2 === 1 ? 
                      (theme.palette.mode === 'dark' ? alpha(theme.palette.action.hover, 0.5) : 'action.hover') : 
                      'background.paper',
                    '&:hover': {
                      bgcolor: theme.palette.mode === 'dark' ? 
                        alpha(theme.palette.action.selected, 0.8) : 
                        'action.selected'
                    },
                    '& .MuiTableCell-root': {
                      py: 0.75
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
                          borderRadius: 0,
                          height: 22
                        }}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">
                      {date ? formatClinicalDate(date, 'withTime') : 'No date'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5}>
                      <Tooltip title="View Details">
                        <IconButton size="small" onClick={() => handleViewDetails(item)}>
                          <ViewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {/* Navigate to related order if exists */}
                      {item.basedOn?.[0]?.reference && onNavigateToTab && (
                        <Tooltip title="View Related Order">
                          <IconButton
                            size="small"
                            onClick={() => {
                              const orderId = item.basedOn[0].reference.split('/')[1];
                              navigateToTab(onNavigateToTab, TAB_IDS.ORDERS, {
                                resourceId: orderId,
                                resourceType: 'ServiceRequest',
                                action: 'highlight'
                              });
                            }}
                          >
                            <OrderIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Stack>
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
      {/* Ultra-Compact Header with inline stats */}
      <Box sx={{ px: 1, pt: 0.75, pb: 0 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
          {/* Inline Statistics */}
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" color="text.secondary">
              {allData.labObservations.length + allData.vitalObservations.length + allData.diagnosticReports.length} total results
            </Typography>
            {allData.labObservations.filter(obs => getResultStatus(obs).label === 'High' || getResultStatus(obs).label === 'Low').length > 0 && (
              <Chip
                label={`${allData.labObservations.filter(obs => getResultStatus(obs).label !== 'Normal').length} abnormal`}
                size="small"
                color="warning"
                icon={<AbnormalIcon fontSize="small" />}
                sx={{ borderRadius: 0, height: 24 }}
              />
            )}
            {filterPeriod !== 'all' && (
              <Chip
                label={filterPeriod}
                size="small"
                variant="outlined"
                onDelete={() => setFilterPeriod('all')}
                sx={{ borderRadius: 0, height: 24 }}
              />
            )}
          </Stack>
          
          {/* Quick Actions with View Toggle */}
          <Stack direction="row" spacing={1} alignItems="center">
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={(e, value) => value && setViewMode(value)}
              size="small"
            >
              <ToggleButton value="table" title="Table View">
                <TableIcon fontSize="small" />
              </ToggleButton>
              <ToggleButton value="cards" title="Card View">
                <CardsIcon fontSize="small" />
              </ToggleButton>
              <ToggleButton value="trends" title="Trends View">
                <Tooltip title="View lab trends and vital sign graphs">
                  <TrendsIcon fontSize="small" />
                </Tooltip>
              </ToggleButton>
            </ToggleButtonGroup>
            <Divider orientation="vertical" flexItem />
            <IconButton
              size="small"
              onClick={() => {/* Add print handler */}}
              title="Print"
            >
              <PrintIcon />
            </IconButton>
            <IconButton
              size="small"
              onClick={fetchAllData}
              title="Refresh"
            >
              <RefreshIcon />
            </IconButton>
          </Stack>
        </Stack>
      </Box>
      
      {/* Filter Panel */}
      <Box sx={{ px: 2 }}>
        <ClinicalFilterPanel
          searchQuery={searchTerm}
          onSearchChange={setSearchTerm}
          dateRange={filterPeriod}
          onDateRangeChange={setFilterPeriod}
          onRefresh={fetchAllData}
          scrollContainerRef={scrollContainerRef}
          compact
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
      </Box>
      
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

      {/* Critical Value Alert Dialog */}
      <Dialog
        open={criticalAlertDialog.open}
        onClose={handleCriticalAlertAcknowledge}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderLeft: '6px solid',
            borderColor: 'error.main',
            boxShadow: theme.shadows[20]
          }
        }}
      >
        <DialogTitle
          sx={{
            bgcolor: alpha(theme.palette.error.main, 0.1),
            display: 'flex',
            alignItems: 'center',
            gap: 1
          }}
        >
          <AbnormalIcon color="error" sx={{ fontSize: 28 }} />
          <Typography variant="h6" component="span" color="error.main" fontWeight="bold">
            CRITICAL VALUE ALERT
          </Typography>
          <IconButton
            aria-label="close"
            onClick={handleCriticalAlertAcknowledge}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {criticalAlertDialog.observation && (() => {
            const details = getCriticalValueDetails(criticalAlertDialog.observation);
            return (
              <Box>
                <Alert severity="error" sx={{ mb: 3 }}>
                  <Typography variant="body1" fontWeight="medium">
                    Immediate action may be required!
                  </Typography>
                </Alert>

                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Test Name
                    </Typography>
                    <Typography variant="h6" fontWeight="medium">
                      {details.testName}
                    </Typography>
                  </Grid>

                  <Grid item xs={6}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Result Value
                    </Typography>
                    <Typography
                      variant="h5"
                      color="error.main"
                      fontWeight="bold"
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                    >
                      {details.status?.icon}
                      {details.value}
                    </Typography>
                  </Grid>

                  <Grid item xs={6}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Reference Range
                    </Typography>
                    <Typography variant="body1">
                      {details.referenceRange}
                    </Typography>
                  </Grid>

                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Result Date/Time
                    </Typography>
                    <Typography variant="body1">
                      {details.effectiveDate}
                    </Typography>
                  </Grid>

                  {currentPatient && (
                    <Grid item xs={12}>
                      <Divider sx={{ my: 1 }} />
                      <Typography variant="subtitle2" color="text.secondary">
                        Patient
                      </Typography>
                      <Typography variant="body1">
                        {currentPatient.name?.[0]?.text ||
                          `${currentPatient.name?.[0]?.given?.join(' ')} ${currentPatient.name?.[0]?.family}` ||
                          'Unknown Patient'}
                      </Typography>
                    </Grid>
                  )}
                </Grid>
              </Box>
            );
          })()}
        </DialogContent>
        <DialogActions sx={{ p: 2, bgcolor: alpha(theme.palette.error.main, 0.05) }}>
          <Button
            onClick={() => {
              handleCriticalAlertAcknowledge();
              // Navigate to result details
              if (criticalAlertDialog.observation) {
                setSelectedResult(criticalAlertDialog.observation);
                setDetailsDialogOpen(true);
              }
            }}
            color="inherit"
          >
            View Details
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleCriticalAlertAcknowledge}
            startIcon={<CheckCircle />}
          >
            Acknowledge Alert
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default React.memo(ResultsTabOptimized);