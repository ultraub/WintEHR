/**
 * Results Tab Component
 * Display lab results and diagnostic test results
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  Science as LabIcon,  Assessment as DiagnosticIcon,
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
  LocationOn as LocationIcon
} from '@mui/icons-material';
import { format, parseISO, isWithinInterval, subDays, subMonths, formatDistanceToNow } from 'date-fns';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import { usePaginatedObservations, usePaginatedDiagnosticReports } from '../../../../hooks/usePaginatedObservations';
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
import QuickResultNote from '../../results/QuickResultNote';
import CriticalValueAlert from '../../results/CriticalValueAlert';
import ResultAcknowledgmentPanel from '../../results/ResultAcknowledgmentPanel';
import ResultTrendAnalysis from '../../results/ResultTrendAnalysis';
import LabCareRecommendations from '../../results/LabCareRecommendations';
import LabMonitoringDashboard from '../../results/LabMonitoringDashboard';
import AdvancedLabValueFilter from './components/AdvancedLabValueFilter';
import ProviderAccountabilityPanel from '../../results/ProviderAccountabilityPanel';
import OrderContextPanel from '../../results/OrderContextPanel';
import FacilityResultManager from '../../results/FacilityResultManager';
import { resultsManagementService } from '../../../../services/resultsManagementService';
import { labToCareIntegrationService } from '../../../../services/labToCareIntegrationService';
import { criticalValueDetectionService } from '../../../../services/criticalValueDetectionService';
import { providerAccountabilityService } from '../../../../services/providerAccountabilityService';
import { fhirClient } from '../../../../core/fhir/services/fhirClient';

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
  if (!observation.status) return { icon: <PendingIcon />, color: 'default' };
  
  switch (observation.status) {
    case 'final':
      // First check for explicit interpretation using resilient utility
      const interpretation = getObservationInterpretation(observation);
      if (interpretation === 'H' || interpretation === 'HH') {
        return { icon: <HighIcon />, color: 'error', label: 'High' };
      } else if (interpretation === 'L' || interpretation === 'LL') {
        return { icon: <LowIcon />, color: 'error', label: 'Low' };
      } else if (interpretation === 'A' || interpretation === 'AA') {
        return { icon: <AbnormalIcon />, color: 'warning', label: 'Abnormal' };
      } else if (interpretation === 'N') {
        return { icon: <NormalIcon />, color: 'success', label: 'Normal' };
      }
      
      // If no interpretation, calculate based on reference range
      if (observation.valueQuantity?.value && observation.referenceRange?.[0]) {
        const value = observation.valueQuantity.value;
        const range = observation.referenceRange[0];
        
        if (range.low?.value && value < range.low.value) {
          return { icon: <LowIcon />, color: 'error', label: 'Low' };
        } else if (range.high?.value && value > range.high.value) {
          return { icon: <HighIcon />, color: 'error', label: 'High' };
        } else if (range.low?.value && range.high?.value) {
          return { icon: <NormalIcon />, color: 'success', label: 'Normal' };
        }
      }
      
      // Only show "Normal" if we can't determine the status
      return { icon: <NormalRangeIcon />, color: 'default', label: '' };
    case 'preliminary':
      return { icon: <PendingIcon />, color: 'warning', label: 'Preliminary' };
    case 'entered-in-error':
      return { icon: <AbnormalIcon />, color: 'error', label: 'Error' };
    default:
      return { icon: <PendingIcon />, color: 'default', label: observation.status };
  }
};

// Result Row Component for Table View
const ResultRow = ({ observation, onClick, selected, onSelectResult, isSelected, onShowTrend }) => {
  const theme = useTheme();
  const status = getResultStatus(observation);
  const date = observation.effectiveDateTime || observation.issued;
  
  const getValue = () => {
    // Handle blood pressure with components
    if (observation.component && observation.component.length > 0) {
      const systolic = observation.component?.find(c => 
        c.code?.coding?.some(coding => 
          coding?.code === '8480-6' || coding?.display?.toLowerCase()?.includes('systolic')
        )
      );
      const diastolic = observation.component?.find(c => 
        c.code?.coding?.some(coding => 
          coding?.code === '8462-4' || coding?.display?.toLowerCase()?.includes('diastolic')
        )
      );
      
      if (systolic?.valueQuantity?.value && diastolic?.valueQuantity?.value) {
        return `${systolic.valueQuantity.value}/${diastolic.valueQuantity.value} ${systolic.valueQuantity.unit || 'mmHg'}`;
      }
    }
    
    // Handle regular values
    if (observation.valueQuantity) {
      return `${observation.valueQuantity.value} ${observation.valueQuantity.unit || ''}`;
    } else if (observation.valueString) {
      return observation.valueString;
    } else if (observation.valueCodeableConcept) {
      return getCodeableConceptDisplay(observation.valueCodeableConcept);
    }
    return 'Result pending';
  };

  const getReference = () => {
    if (observation.referenceRange?.[0]) {
      const range = observation.referenceRange[0];
      if (range.low && range.high) {
        return `${range.low.value}-${range.high.value} ${range.low.unit || ''}`;
      } else if (range.text) {
        return range.text;
      }
    }
    return '';
  };

  return (
    <TableRow 
      hover 
      onClick={onClick}
      selected={selected}
      sx={{ cursor: 'pointer' }}
    >
      <TableCell padding="checkbox">
        <Checkbox
          checked={isSelected || false}
          onClick={(e) => {
            e.stopPropagation();
            onSelectResult(observation.id);
          }}
        />
      </TableCell>
      <TableCell>
        <Stack direction="row" spacing={1} alignItems="center">
          {status.icon}
          <Typography variant="body2">
            {getResourceDisplayText(observation)}
          </Typography>
        </Stack>
      </TableCell>
      <TableCell>
        <Typography variant="body2" fontWeight={status.label !== 'Normal' ? 'bold' : 'normal'}>
          {getValue()}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="caption" color="text.secondary">
          {getReference()}
        </Typography>
      </TableCell>
      <TableCell>
        {status.label && (
          <Chip 
            label={status.label} 
            size="small" 
            color={status.color}
            sx={{ fontWeight: 'bold' }}
          />
        )}
      </TableCell>
      <TableCell>
        <Typography variant="caption">
          {date ? format(parseISO(date), 'MMM d, yyyy h:mm a') : 'No date'}
        </Typography>
      </TableCell>
      <TableCell>
        <Stack direction="row" spacing={1}>
          <QuickResultNote
            result={observation}
            patientId={getReferenceId(observation.subject?.reference)}
            variant="button"
            onNoteCreated={(data) => {
              // Could add refresh logic here
            }}
          />
          {/* Add trend button for lab results with LOINC codes */}
          {observation.code?.coding?.some(c => c.system === 'http://loinc.org') && (
            <Tooltip title="View Trends">
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  const loincCode = observation.code?.coding?.find(c => c?.system === 'http://loinc.org')?.code;
                  if (loincCode && onShowTrend) {
                    onShowTrend(observation);
                  }
                }}
              >
                <TrendingUpIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      </TableCell>
    </TableRow>
  );
};

// Result Card Component
const ResultCard = ({ observation, onClick }) => {
  const theme = useTheme();
  const status = getResultStatus(observation);
  const date = observation.effectiveDateTime || observation.issued;
  
  return (
    <Card 
      sx={{ 
        mb: 2,
        cursor: 'pointer',
        '&:hover': { boxShadow: 3 }
      }}
      onClick={onClick}
    >
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box sx={{ flex: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center" mb={1}>
              {status.icon}
              <Typography variant="h6">
                {getResourceDisplayText(observation)}
              </Typography>
              {status.label && (
                <Chip 
                  label={status.label} 
                  size="small" 
                  color={status.color}
                />
              )}
            </Stack>
            
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <Typography variant="caption" color="text.secondary">Result</Typography>
                <Typography variant="body1" fontWeight="bold">
                  {observation.valueQuantity ? 
                    `${observation.valueQuantity.value} ${observation.valueQuantity.unit || ''}` :
                    observation.valueString || 'Pending'
                  }
                </Typography>
              </Grid>
              
              {observation.referenceRange?.[0] && (
                <Grid item xs={12} sm={4}>
                  <Typography variant="caption" color="text.secondary">Reference Range</Typography>
                  <Typography variant="body2">
                    {observation.referenceRange[0].low?.value}-{observation.referenceRange[0].high?.value} {observation.referenceRange[0].low?.unit}
                  </Typography>
                </Grid>
              )}
              
              <Grid item xs={12} sm={4}>
                <Typography variant="caption" color="text.secondary">Date</Typography>
                <Typography variant="body2">
                  {date ? format(parseISO(date), 'MMM d, yyyy') : 'No date'}
                </Typography>
              </Grid>
            </Grid>
            
            {observation.note?.[0] && (
              <Box mt={2}>
                <Typography variant="caption" color="text.secondary">Note</Typography>
                <Typography variant="body2">{observation.note[0].text}</Typography>
              </Box>
            )}
          </Box>
        </Stack>
      </CardContent>
      
      <CardActions>
        <Button size="small" startIcon={<ViewIcon />} onClick={(e) => { e.stopPropagation(); onClick(); }}>View Details</Button>
        <QuickResultNote
          result={observation}
          patientId={getReferenceId(observation.subject?.reference)}
          variant="inline"
          onNoteCreated={(data) => {
            // Refresh data or show success message
          }}
        />
      </CardActions>
    </Card>
  );
};

const ResultsTab = ({ patientId, onNotificationUpdate, department = 'general' }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { currentPatient } = useFHIRResource();
  const { publish, createCriticalAlert } = useClinicalWorkflow();
  
  const [tabValue, setTabValue] = useState(0);
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'cards'
  const [filterPeriod, setFilterPeriod] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedResult, setSelectedResult] = useState(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [alertedResults, setAlertedResults] = useState(new Set());
  const [selectedResultIds, setSelectedResultIds] = useState(new Set());
  const [acknowledgingResults, setAcknowledgingResults] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  
  // New state for enhanced results management
  const [criticalAlertOpen, setCriticalAlertOpen] = useState(false);
  const [criticalResult, setCriticalResult] = useState(null);
  const [showAcknowledgmentPanel, setShowAcknowledgmentPanel] = useState(false);
  const [showTrendAnalysis, setShowTrendAnalysis] = useState(false);
  const [selectedTestForTrend, setSelectedTestForTrend] = useState(null);
  const [unacknowledgedCount, setUnacknowledgedCount] = useState(0);
  const [showCareRecommendations, setShowCareRecommendations] = useState(false);
  const [showMonitoringDashboard, setShowMonitoringDashboard] = useState(false);
  const [patientConditions, setPatientConditions] = useState([]);
  const [carePlanId, setCarePlanId] = useState(null);
  
  // Advanced filtering state
  const [advancedFilters, setAdvancedFilters] = useState([]);
  const [filteredByValue, setFilteredByValue] = useState(false);
  const [advancedFilteredResults, setAdvancedFilteredResults] = useState([]);
  
  // Provider filtering state
  const [providerFilter, setProviderFilter] = useState(null);
  const [providerFilteredResults, setProviderFilteredResults] = useState([]);
  const [filteredByProvider, setFilteredByProvider] = useState(false);
  const [showProviderPanel, setShowProviderPanel] = useState(false);
  
  // Facility filtering state
  const [facilityFilter, setFacilityFilter] = useState(null);
  const [facilityFilteredResults, setFacilityFilteredResults] = useState([]);
  const [filteredByFacility, setFilteredByFacility] = useState(false);
  const [showFacilityPanel, setShowFacilityPanel] = useState(false);

  // Calculate date range based on filter period
  const dateRange = useMemo(() => {
    if (filterPeriod === 'all') return null;
    
    const end = new Date();
    let start = new Date();
    
    switch (filterPeriod) {
      case '24h':
        start = subDays(end, 1);
        break;
      case '7d':
        start = subDays(end, 7);
        break;
      case '30d':
        start = subDays(end, 30);
        break;
      case '90d':
        start = subDays(end, 90);
        break;
      default:
        return null;
    }
    
    return { start, end };
  }, [filterPeriod]);
  
  // Use paginated hooks for observations - separate by category (for table views)
  const labObservations = usePaginatedObservations(patientId, {
    category: selectedCategory === 'laboratory' ? 'laboratory' : (selectedCategory === 'all' ? null : undefined),
    pageSize: rowsPerPage,
    dateRange,
    status: filterStatus === 'all' ? null : filterStatus,
    code: searchTerm || null
  });
  
  const vitalObservations = usePaginatedObservations(patientId, {
    category: 'vital-signs',
    pageSize: rowsPerPage,
    dateRange,
    code: searchTerm || null
  });

  // Chart-specific hooks for complete historical data (no pagination limits)
  const labObservationsForCharts = usePaginatedObservations(patientId, {
    category: 'laboratory',
    pageSize: 1000, // Large limit to get all historical data
    dateRange: null, // Get all historical data for trends
    status: null, // Include all statuses for comprehensive trends
    code: null // Get all lab tests for trending
  });
  
  const vitalObservationsForCharts = usePaginatedObservations(patientId, {
    category: 'vital-signs',
    pageSize: 1000, // Large limit to get all historical data
    dateRange: null, // Get all historical data for trends
    code: null // Get all vital signs for trending
  });
  
  // Use paginated hook for diagnostic reports
  const diagnosticReportsData = usePaginatedDiagnosticReports(patientId, {
    pageSize: rowsPerPage,
    status: filterStatus === 'all' ? null : filterStatus
  });
  const diagnosticReports = diagnosticReportsData.reports;
  
  // Get loading state based on active tab (include chart data for trends view)
  const loading = tabValue === 0 ? (
    viewMode === 'trends' ? (labObservations.loading || labObservationsForCharts.loading) : labObservations.loading
  ) : tabValue === 1 ? (
    viewMode === 'trends' ? (vitalObservations.loading || vitalObservationsForCharts.loading) : vitalObservations.loading
  ) : tabValue === 2 ? diagnosticReportsData.loading : false;
  
  // Get current page data based on tab
  const currentPageData = tabValue === 0 ? labObservations : 
                         tabValue === 1 ? vitalObservations :
                         tabValue === 2 ? diagnosticReportsData : null;

  // Enhanced critical value monitoring with detection service
  useEffect(() => {
    let cancelled = false;
    
    const monitorCriticalValues = async () => {
      const currentObservations = tabValue === 0 ? labObservations.observations : 
                                 tabValue === 1 ? vitalObservations.observations : [];
      
      if (currentObservations && currentObservations.length > 0 && !cancelled) {
        try {
          // Check for critical values in current observations
          const criticalAssessments = [];
          
          for (const obs of currentObservations) {
            const assessment = criticalValueDetectionService.isCriticalValue(obs);
            if (assessment.isCritical) {
              criticalAssessments.push({
                observation: obs,
                assessment
              });
            }
          }

          // Create alerts for new critical values
          for (const { observation, assessment } of criticalAssessments) {
            if (!alertedResults.has(observation.id) && !cancelled) {
              await criticalValueDetectionService.createCriticalValueAlert(
                observation,
                assessment,
                patientId,
                publish
              );
              
              // Show critical value alert dialog for immediate priority
              if (assessment.priority === 'immediate' && !criticalAlertOpen && !cancelled) {
                setCriticalResult(observation);
                setCriticalAlertOpen(true);
              }
              
              // Mark as alerted
              if (!cancelled) {
                const newAlertedResults = new Set(alertedResults);
                newAlertedResults.add(observation.id);
                setAlertedResults(newAlertedResults);
              }
            }
          }

          // Check for recent abnormal results (within last 24 hours)
          const oneDayAgo = new Date();
          oneDayAgo.setDate(oneDayAgo.getDate() - 1);
          
          const recentAbnormalResults = currentObservations.filter(obs => {
            // Skip if already alerted
            if (alertedResults.has(obs.id)) return false;
            
            // Check if observation is recent
            const obsDate = obs.effectiveDateTime ? new Date(obs.effectiveDateTime) : null;
            if (!obsDate || obsDate < oneDayAgo) return false;
            
            // Check if observation is abnormal (but not critical - those are handled above)
            const status = getResultStatus(obs);
            const assessment = criticalValueDetectionService.isCriticalValue(obs);
            return (status.color === 'error' || status.color === 'warning') && !assessment.isCritical;
          });
          
          // Publish alerts for abnormal results
          if (recentAbnormalResults.length > 0) {
            const newAlertedResults = new Set(alertedResults);
            
            recentAbnormalResults.forEach(async (result) => {
              const status = getResultStatus(result);
              const testName = getResourceDisplayText(result);
              const value = result.valueQuantity ? 
                `${result.valueQuantity.value} ${result.valueQuantity.unit || ''}` : 
                'N/A';
              
              await createCriticalAlert({
                type: 'abnormal_result',
                severity: status.color === 'error' ? 'high' : 'medium',
                message: `Abnormal ${testName}: ${value} (${status.label})`,
                data: result,
                actions: [
                  { label: 'Review Result', action: 'view', target: result.id },
                  { label: 'Add to Note', action: 'document', target: 'documentation' }
                ]
              });
              
              // Also publish RESULT_RECEIVED event
              await publish(CLINICAL_EVENTS.RESULT_RECEIVED, {
                ...result,
                isAbnormal: true,
                status: status.label,
                patientId,
                timestamp: new Date().toISOString()
              });
              
              // Mark as alerted
              newAlertedResults.add(result.id);
            });
            
            // Update alerted results state
            if (!cancelled) {
              setAlertedResults(newAlertedResults);
            }
          }
        } catch (error) {
          // Error monitoring critical values - alerts may not be generated
        }
      }
    };

    monitorCriticalValues();
    
    // Cleanup function to cancel async operations
    return () => {
      cancelled = true;
    };
  }, [tabValue, labObservations.observations, vitalObservations.observations, patientId, createCriticalAlert, publish, alertedResults, criticalAlertOpen]);

  const handleViewDetails = (result) => {
    setSelectedResult(result);
    setDetailsDialogOpen(true);
  };

  const handleBatchAcknowledge = async () => {
    setAcknowledgingResults(true);
    try {
      // Create acknowledgment notes for each selected result
      const promises = Array.from(selectedResultIds).map(async (resultId) => {
        const currentObservations = tabValue === 0 ? labObservations.observations : 
                                   tabValue === 1 ? vitalObservations.observations : [];
        const result = currentObservations.find(o => o.id === resultId) || 
                      diagnosticReports.find(d => d.id === resultId);
        
        if (result) {
          // Create a note indicating the result has been reviewed
          const note = {
            resourceType: 'DocumentReference',
            status: 'current',
            type: {
              coding: [{
                system: 'http://loinc.org',
                code: '11506-3',
                display: 'Progress note'
              }],
              text: 'Result Acknowledgment'
            },
            subject: {
              reference: `Patient/${patientId}`
            },
            date: new Date().toISOString(),
            author: [{
              display: 'Current User' // In real app, would use auth context
            }],
            content: [{
              attachment: {
                contentType: 'text/plain',
                data: btoa(`Result acknowledged: ${getResourceDisplayText(result)} - ${result.valueQuantity ? `${result.valueQuantity.value} ${result.valueQuantity.unit || ''}` : 'See report'}`)
              }
            }],
            context: {
              related: [{
                reference: `${result.resourceType}/${result.id}`
              }]
            }
          };
          
          const response = await fetch('/fhir/R4/DocumentReference', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(note)
          });
          
          if (!response.ok) {
            throw new Error(`Failed to acknowledge result ${result.id}`);
          }
          
          // Publish acknowledgment event
          await publish(CLINICAL_EVENTS.RESULT_ACKNOWLEDGED, {
            resultId: result.id,
            testName: getResourceDisplayText(result),
            acknowledgedBy: 'Current User',
            timestamp: new Date().toISOString(),
            patientId
          });
        }
      });
      
      await Promise.all(promises);
      
      setSnackbar({
        open: true,
        message: `Successfully acknowledged ${selectedResultIds.size} result(s)`,
        severity: 'success'
      });
      
      // Clear selection
      setSelectedResultIds(new Set());
      
    } catch (error) {
      
      setSnackbar({
        open: true,
        message: 'Failed to acknowledge some results',
        severity: 'error'
      });
    } finally {
      setAcknowledgingResults(false);
    }
  };

  const handleSelectResult = (resultId) => {
    const newSelected = new Set(selectedResultIds);
    if (newSelected.has(resultId)) {
      newSelected.delete(resultId);
    } else {
      newSelected.add(resultId);
    }
    setSelectedResultIds(newSelected);
  };

  const handleSelectAll = (event) => {
    if (event.target.checked) {
      const newSelected = new Set(sortedResults.map(r => r.id));
      setSelectedResultIds(newSelected);
    } else {
      setSelectedResultIds(new Set());
    }
  };

  const handlePrintResults = () => {
    let resultsToprint = [];
    let title = '';
    
    switch (tabValue) {
      case 0: // Lab Results
        resultsToprint = sortedResults;
        title = 'Laboratory Results';
        break;
      case 1: // Vital Signs
        resultsToprint = sortedResults;
        title = 'Vital Signs';
        break;
      case 2: // Diagnostic Reports
        resultsToprint = sortedResults;
        title = 'Diagnostic Reports';
        break;
      default:
        resultsToprint = [];
    }
    
    const patientInfo = {
      name: currentPatient ? 
        `${currentPatient.name?.[0]?.given?.join(' ') || ''} ${currentPatient.name?.[0]?.family || ''}`.trim() : 
        'Unknown Patient',
      mrn: currentPatient?.identifier?.find(id => id.type?.coding?.[0]?.code === 'MR')?.value || currentPatient?.id,
      birthDate: currentPatient?.birthDate,
      gender: currentPatient?.gender,
      phone: currentPatient?.telecom?.find(t => t.system === 'phone')?.value
    };
    
    const content = formatLabResultsForPrint(resultsToprint);
    
    printDocument({
      title,
      patient: patientInfo,
      content
    });
  };

  // Handle critical value acknowledgment
  const handleCriticalValueAcknowledge = async (data) => {
    const newAlertedResults = new Set(alertedResults);
    newAlertedResults.add(criticalResult.id);
    setAlertedResults(newAlertedResults);
    
    // Publish critical value acknowledged event
    await publish(CLINICAL_EVENTS.CRITICAL_VALUE_ACKNOWLEDGED, {
      observationId: criticalResult.id,
      patientId,
      ...data
    });
    
    setSnackbar({
      open: true,
      message: 'Critical value acknowledged and documented',
      severity: 'success'
    });
  };

  // Handle result selection for trend analysis
  const handleShowTrend = (observation) => {
    const loincCode = observation.code?.coding?.find(c => c.system === 'http://loinc.org')?.code;
    if (loincCode) {
      setSelectedTestForTrend(loincCode);
      setShowTrendAnalysis(true);
      
      // NOTE: With server-side pagination, the LabTrendsChart component
      // will need to fetch ALL historical data for this specific test
      // to show complete trends (not just the current page)
    } else {
      setSnackbar({
        open: true,
        message: 'Unable to show trend - no LOINC code found',
        severity: 'warning'
      });
    }
  };

  // Load unacknowledged results count
  useEffect(() => {
    const loadUnacknowledgedCount = async () => {
      try {
        // For demo, we'll use a simple provider ID - in production this would come from auth context
        const providerId = 'current-provider';
        const unacknowledged = await resultsManagementService.getUnacknowledgedResults(providerId, patientId);
        setUnacknowledgedCount(unacknowledged.length);
      } catch (error) {
        // Handle error silently
      }
    };
    
    if (patientId) {
      loadUnacknowledgedCount();
    }
  }, [patientId]); // Only depend on patientId, not observations array

  // Load patient conditions and care plan for lab-to-care integration
  useEffect(() => {
    const loadPatientContext = async () => {
      try {
        // Load active conditions
        const conditionsResponse = await fhirClient.search('Condition', {
          patient: patientId,
          'clinical-status': 'active',
          _count: 100
        });
        setPatientConditions(conditionsResponse.entry?.map(e => e.resource) || []);
        
        // Load active care plan
        const carePlanResponse = await fhirClient.search('CarePlan', {
          patient: patientId,
          status: 'active',
          _sort: '-date',
          _count: 1
        });
        if (carePlanResponse.entry?.[0]) {
          setCarePlanId(carePlanResponse.entry[0].resource.id);
        }
      } catch (error) {
        // Handle error silently
      }
    };
    
    if (patientId) {
      loadPatientContext();
    }
  }, [patientId]);

  // Handle advanced filter changes
  const handleAdvancedFilterChange = (filters) => {
    setAdvancedFilters(filters);
    
    if (filters.length === 0) {
      setFilteredByValue(false);
      setAdvancedFilteredResults([]);
    }
    
    // The actual filtering is now handled by the AdvancedLabValueFilter component
    // Results are passed back via onFilteredResultsChange callback
  };

  // Handle provider filter changes
  const handleProviderFilter = (filter) => {
    setProviderFilter(filter);
    setFilteredByProvider(!!filter);
  };

  const handleProviderResultsUpdate = (results) => {
    setProviderFilteredResults(results);
  };

  // Handle facility filter changes
  const handleFacilityFilter = (filter) => {
    setFacilityFilter(filter);
    setFilteredByFacility(!!filter);
  };

  const handleFacilityResultsUpdate = (results) => {
    setFacilityFilteredResults(results);
  };

  // Enhanced chart data with reference ranges and categorization
  const enhancedChartData = useMemo(() => {
    const labResultsForCharts = [];
    const vitalSignsForCharts = [];
    
    // Process lab observations for charts
    labObservationsForCharts.observations.forEach(o => {
      const enhancedObs = enhanceObservationWithReferenceRange(o);
      labResultsForCharts.push(enhancedObs);
    });
    
    // Process vital observations for charts
    vitalObservationsForCharts.observations.forEach(o => {
      const enhancedObs = enhanceObservationWithReferenceRange(o);
      vitalSignsForCharts.push(enhancedObs);
    });
    
    return { labResultsForCharts, vitalSignsForCharts };
  }, [labObservationsForCharts.observations, vitalObservationsForCharts.observations]);
  
  const { labResultsForCharts, vitalSignsForCharts } = enhancedChartData;

  // Memoized filter function to prevent recalculation
  const filterResults = useCallback((results) => {
    return results.filter(result => {
      // Period filter
      if (filterPeriod !== 'all') {
        const date = result.effectiveDateTime || result.issued || result.started;
        if (date) {
          const resultDate = parseISO(date);
          const periodMap = {
            '7d': subDays(new Date(), 7),
            '30d': subDays(new Date(), 30),
            '3m': subMonths(new Date(), 3),
            '6m': subMonths(new Date(), 6),
            '1y': subMonths(new Date(), 12)
          };
          if (!isWithinInterval(resultDate, {
            start: periodMap[filterPeriod],
            end: new Date()
          })) {
            return false;
          }
        }
      }

      // Status filter
      if (filterStatus !== 'all') {
        const status = getResultStatus(result);
        if (filterStatus === 'abnormal' && status.label === 'Normal') return false;
        if (filterStatus === 'normal' && status.label !== 'Normal') return false;
      }

      // Search filter
      if (searchTerm) {
        const testName = getResourceDisplayText(result);
        if (!testName.toLowerCase().includes(searchTerm.toLowerCase())) {
          return false;
        }
      }

      return true;
    });
  }, [filterPeriod, filterStatus, searchTerm]);

  // Memoized result filtering and sorting with advanced filter support
  const { filteredResults, sortedResults } = useMemo(() => {
    let currentResults;
    
    switch (tabValue) {
      case 0: 
        // Lab Results - Priority: Facility filter > Provider filter > Advanced filter > Regular results
        if (filteredByFacility && facilityFilteredResults.length > 0) {
          currentResults = filterResults(facilityFilteredResults);
        } else if (filteredByFacility) {
          // Facility filter active but no results found
          currentResults = [];
        } else if (filteredByProvider && providerFilteredResults.length > 0) {
          currentResults = filterResults(providerFilteredResults);
        } else if (filteredByProvider) {
          // Provider filter active but no results found
          currentResults = [];
        } else if (filteredByValue && advancedFilteredResults.length > 0) {
          currentResults = filterResults(advancedFilteredResults);
        } else if (filteredByValue && advancedFilters.length > 0) {
          // Advanced filters active but no results found
          currentResults = [];
        } else {
          currentResults = filterResults(labObservations.observations);
        }
        break;
      case 1: 
        // Vital Signs - Support advanced filtering
        if (filteredByValue && advancedFilteredResults.length > 0) {
          currentResults = filterResults(advancedFilteredResults);
        } else if (filteredByValue && advancedFilters.length > 0) {
          // Advanced filters active but no results found
          currentResults = [];
        } else {
          currentResults = filterResults(vitalObservations.observations);
        }
        break;
      case 2: 
        // Diagnostic Reports
        currentResults = diagnosticReports;
        break;
      default: 
        currentResults = [];
    }
    
    const sorted = [...currentResults].sort((a, b) => {
      const dateA = new Date(a.effectiveDateTime || a.issued || a.started || 0);
      const dateB = new Date(b.effectiveDateTime || b.issued || b.started || 0);
      return dateB - dateA;
    });
    
    return { 
      filteredResults: currentResults, 
      sortedResults: sorted 
    };
  }, [tabValue, labObservations.observations, vitalObservations.observations, diagnosticReports, filterResults, filteredByValue, advancedFilteredResults, advancedFilters, filteredByProvider, providerFilteredResults, filteredByFacility, facilityFilteredResults]);

  // Memoized abnormal count calculation
  const abnormalCount = useMemo(() => {
    return labObservations.observations.filter(r => {
      const status = getResultStatus(r);
      return status.label && status.label !== 'Normal';
    }).length;
  }, [labObservations.observations]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header Actions */}
      <Stack direction="row" justifyContent="flex-end" alignItems="center" mb={2}>
        <Stack direction="row" spacing={2}>
          {/* Provider Accountability */}
          <Button
            variant={showProviderPanel ? "contained" : "outlined"}
            onClick={() => setShowProviderPanel(!showProviderPanel)}
            startIcon={<PersonIcon />}
            color={filteredByProvider ? "primary" : "inherit"}
          >
            Providers
            {filteredByProvider && (
              <Chip 
                label="Filtered" 
                size="small" 
                color="primary" 
                sx={{ ml: 1 }} 
              />
            )}
          </Button>

          {/* Facility Management */}
          <Button
            variant={showFacilityPanel ? "contained" : "outlined"}
            onClick={() => setShowFacilityPanel(!showFacilityPanel)}
            startIcon={<LocationIcon />}
            color={filteredByFacility ? "primary" : "inherit"}
          >
            Facilities
            {filteredByFacility && (
              <Chip 
                label="Filtered" 
                size="small" 
                color="primary" 
                sx={{ ml: 1 }} 
              />
            )}
          </Button>
          
          {/* Care Integration Buttons */}
          <Button
            variant={showCareRecommendations ? "contained" : "outlined"}
            onClick={() => setShowCareRecommendations(!showCareRecommendations)}
            startIcon={<AssessmentIcon />}
          >
            Care Recommendations
          </Button>
          
          <Button
            variant={showMonitoringDashboard ? "contained" : "outlined"}
            onClick={() => setShowMonitoringDashboard(!showMonitoringDashboard)}
            startIcon={<TimelineIcon />}
          >
            Monitoring
          </Button>
          
          {/* Acknowledgment Panel Toggle */}
          <Badge badgeContent={unacknowledgedCount} color="warning">
            <Button
              variant={showAcknowledgmentPanel ? "contained" : "outlined"}
              onClick={() => setShowAcknowledgmentPanel(!showAcknowledgmentPanel)}
              startIcon={<CheckCircle />}
            >
              Acknowledgments
            </Button>
          </Badge>
          
          {selectedResultIds.size > 0 && (
            <Button
              variant="contained"
              onClick={handleBatchAcknowledge}
              disabled={acknowledgingResults}
              startIcon={<CheckCircle />}
            >
              Acknowledge ({selectedResultIds.size})
            </Button>
          )}
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(e, newMode) => newMode && setViewMode(newMode)}
            size="small"
          >
            <ToggleButton value="table">Table</ToggleButton>
            <ToggleButton value="cards">Cards</ToggleButton>
            <ToggleButton value="trends">Trends</ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      </Stack>

      {/* Alerts */}
      {abnormalCount > 0 && (
        <Alert 
          severity="warning" 
          sx={{ mb: 3 }}
          action={
            <Button 
              size="small" 
              onClick={() => setFilterStatus('abnormal')}
            >
              View All
            </Button>
          }
        >
          <Typography variant="subtitle2">
            {abnormalCount} abnormal lab results require review
          </Typography>
        </Alert>
      )}

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs 
          value={tabValue} 
          onChange={(e, newValue) => setTabValue(newValue)}
          variant="fullWidth"
        >
          <Tab 
            label="Lab Results" 
            icon={
              <Badge 
                badgeContent={labObservations.loading ? '...' : labObservations.totalCount} 
                color="primary"
              >
                <LabIcon />
              </Badge>
            }
            iconPosition="start"
          />
          <Tab 
            label="Vital Signs" 
            icon={
              <Badge 
                badgeContent={vitalObservations.loading ? '...' : vitalObservations.totalCount} 
                color="primary"
              >
                <DiagnosticIcon />
              </Badge>
            }
            iconPosition="start"
          />
          <Tab 
            label="Reports" 
            icon={
              <Badge 
                badgeContent={diagnosticReportsData.loading ? '...' : diagnosticReportsData.totalCount} 
                color="primary"
              >
                <AssessmentIcon />
              </Badge>
            }
            iconPosition="start"
          />
        </Tabs>
      </Paper>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField
            placeholder="Search tests..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="small"
            sx={{ flex: 1 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              )
            }}
          />
          
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Period</InputLabel>
            <Select
              value={filterPeriod}
              onChange={(e) => setFilterPeriod(e.target.value)}
              label="Period"
            >
              <MenuItem value="all">All Time</MenuItem>
              <MenuItem value="7d">Last 7 Days</MenuItem>
              <MenuItem value="30d">Last 30 Days</MenuItem>
              <MenuItem value="3m">Last 3 Months</MenuItem>
              <MenuItem value="6m">Last 6 Months</MenuItem>
              <MenuItem value="1y">Last Year</MenuItem>
            </Select>
          </FormControl>

          {tabValue === 0 && (
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                label="Status"
              >
                <MenuItem value="all">All Results</MenuItem>
                <MenuItem value="normal">Normal Only</MenuItem>
                <MenuItem value="abnormal">Abnormal Only</MenuItem>
              </Select>
            </FormControl>
          )}

          <Button
            variant="outlined"
            startIcon={<PrintIcon />}
            onClick={handlePrintResults}
          >
            Print Results
          </Button>
        </Stack>
      </Paper>

      {/* Advanced Value Filtering - Show for Lab Results and Vital Signs tabs */}
      {(tabValue === 0 || tabValue === 1) && (
        <AdvancedLabValueFilter
          patientId={patientId}
          observations={tabValue === 0 ? labObservations.observations : vitalObservations.observations}
          currentTab={tabValue}
          onFilterChange={handleAdvancedFilterChange}
          onFilteredResultsChange={(results) => {
            setAdvancedFilteredResults(results);
            setFilteredByValue(results.length > 0);
          }}
          onCriticalValuesFound={(criticalValues) => {
            // Handle critical values found during filtering
            criticalValues.forEach(result => {
              if (!alertedResults.has(result.id)) {
                setCriticalResult(result);
                setCriticalAlertOpen(true);
              }
            });
          }}
          initialFilters={advancedFilters}
          isVisible={true}
        />
      )}

      {/* Show provider filter status */}
      {filteredByProvider && (
        <Alert 
          severity={providerFilteredResults.length > 0 ? "info" : "warning"} 
          sx={{ mb: 2 }}
          action={
            <Button 
              size="small" 
              onClick={() => {
                handleProviderFilter(null);
                handleProviderResultsUpdate([]);
              }}
              color="inherit"
            >
              Clear Provider Filter
            </Button>
          }
        >
          <Typography variant="body2">
            {providerFilteredResults.length > 0 ? (
              <>
                Showing {providerFilteredResults.length} results for provider: 
                <Chip
                  label={`${providerFilter.provider.name} (${providerFilter.type})`}
                  size="small"
                  color="primary"
                  sx={{ ml: 1 }}
                />
              </>
            ) : (
              <>
                No results found for provider: {providerFilter?.provider?.name}. 
                This provider may not have ordered or performed lab tests for this patient.
              </>
            )}
          </Typography>
        </Alert>
      )}

      {/* Show advanced filter status */}
      {filteredByValue && !filteredByProvider && (
        <Alert 
          severity={advancedFilteredResults.length > 0 ? "success" : "warning"} 
          sx={{ mb: 2 }}
          action={
            <Button 
              size="small" 
              onClick={() => handleAdvancedFilterChange([])}
              color="inherit"
            >
              Clear Filters
            </Button>
          }
        >
          <Typography variant="body2">
            {advancedFilteredResults.length > 0 ? (
              <>
                Found {advancedFilteredResults.length} results matching {advancedFilters.length} advanced filter(s):
                {advancedFilters.map((f, i) => (
                  <Chip
                    key={i}
                    label={f.testDisplay + ' ' + (
                      f.operator === 'range' 
                        ? `${f.rangeMin}-${f.rangeMax} ${f.unit}`
                        : `${f.operator} ${f.value} ${f.unit}`
                    )}
                    size="small"
                    color={f.category === 'critical' ? 'error' : 'warning'}
                    sx={{ ml: 1, mb: 0.5 }}
                  />
                ))}
              </>
            ) : (
              <>
                No results found matching {advancedFilters.length} advanced filter(s). 
                Try adjusting the filter criteria or check if the patient has recent {tabValue === 0 ? 'lab results' : 'vital signs'}.
              </>
            )}
          </Typography>
        </Alert>
      )}

      {/* Care Recommendations */}
      {showCareRecommendations && (
        <Box sx={{ mb: 3 }}>
          <LabCareRecommendations
            patientId={patientId}
            observations={labResultsForCharts}
            carePlanId={carePlanId}
            onRecommendationApplied={(recommendation, result) => {
              setSnackbar({
                open: true,
                message: `Recommendation applied: ${recommendation.action}`,
                severity: 'success'
              });
            }}
          />
        </Box>
      )}

      {/* Monitoring Dashboard */}
      {showMonitoringDashboard && (
        <Box sx={{ mb: 3 }}>
          <LabMonitoringDashboard
            patientId={patientId}
            patientConditions={patientConditions}
          />
        </Box>
      )}

      {/* Provider Accountability Panel */}
      {showProviderPanel && (
        <Box sx={{ mb: 3 }}>
          <ProviderAccountabilityPanel
            patientId={patientId}
            onProviderFilter={handleProviderFilter}
            onResultsUpdate={handleProviderResultsUpdate}
            selectedProvider={providerFilter?.provider?.id}
          />
        </Box>
      )}

      {/* Facility Result Manager Panel */}
      {showFacilityPanel && (
        <Box sx={{ mb: 3 }}>
          <FacilityResultManager
            patientId={patientId}
            onFacilityFilter={handleFacilityFilter}
            onResultsUpdate={handleFacilityResultsUpdate}
            selectedFacility={facilityFilter?.facility?.id}
          />
        </Box>
      )}

      {/* Acknowledgment Panel */}
      {showAcknowledgmentPanel && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={4}>
            <ResultAcknowledgmentPanel
              patientId={patientId}
              providerId="current-provider" // In production, get from auth context
              onResultSelect={(result) => {
                setSelectedResult(result);
                setDetailsDialogOpen(true);
              }}
            />
          </Grid>
          <Grid item xs={12} md={8}>
            {/* Main content area shifts when panel is open */}
          </Grid>
        </Grid>
      )}

      {/* Results Display */}
      {sortedResults.length === 0 ? (
        <Alert severity="info">
          No results found matching your criteria
        </Alert>
      ) : viewMode === 'trends' && tabValue === 0 ? (
        // Lab Trends View
        <LabTrendsChart 
          patientId={patientId}
          observations={labResultsForCharts}
          height={500}
        />
      ) : viewMode === 'table' && tabValue !== 1 ? (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={selectedResultIds.size > 0 && selectedResultIds.size < sortedResults.length}
                    checked={sortedResults.length > 0 && selectedResultIds.size === sortedResults.length}
                    onChange={handleSelectAll}
                  />
                </TableCell>
                <TableCell>Test Name</TableCell>
                <TableCell>Result</TableCell>
                <TableCell>Reference Range</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedResults
                .map((result) => (
                  <ResultRow
                    key={result.id}
                    observation={result}
                    onClick={() => handleViewDetails(result)}
                    selected={selectedResult?.id === result.id}
                    onSelectResult={handleSelectResult}
                    isSelected={selectedResultIds.has(result.id)}
                    onShowTrend={handleShowTrend}
                  />
                ))
              }
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={labObservations.totalCount}
            page={labObservations.currentPage}
            onPageChange={(e, newPage) => labObservations.goToPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              labObservations.goToPage(0);
            }}
          />
        </TableContainer>
      ) : tabValue === 1 ? (
        // Vital Signs
        <Box>
          {sortedResults.length === 0 ? (
            <Alert severity="info">
              No vital signs recorded for this patient
            </Alert>
          ) : viewMode === 'trends' ? (
            <VitalsOverview 
              patientId={patientId} 
              vitalsData={vitalSignsForCharts}
              compact={false}
            />
          ) : viewMode === 'table' ? (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Vital Sign</TableCell>
                    <TableCell>Value</TableCell>
                    <TableCell>Reference Range</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedResults
                    .map((result) => (
                      <ResultRow
                        key={result.id}
                        observation={result}
                        onClick={() => handleViewDetails(result)}
                        selected={selectedResult?.id === result.id}
                        onShowTrend={handleShowTrend}
                      />
                    ))
                  }
                </TableBody>
              </Table>
              <TablePagination
                component="div"
                count={vitalObservations.totalCount}
                page={vitalObservations.currentPage}
                onPageChange={(e, newPage) => vitalObservations.goToPage(newPage)}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={(e) => {
                  setRowsPerPage(parseInt(e.target.value, 10));
                  vitalObservations.goToPage(0);
                }}
              />
            </TableContainer>
          ) : (
            // Card View for vital signs
            <Box>
              {sortedResults.map((result) => (
                <ResultCard
                  key={result.id}
                  observation={result}
                  onClick={() => {}}
                />
              ))}
            </Box>
          )}
        </Box>
      ) : tabValue === 2 ? (
        // Diagnostic Reports
        viewMode === 'table' ? (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Report Type</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Performer</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedResults.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell>
                      <Typography variant="subtitle2">
                        {getResourceDisplayText(report)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={report.status || 'final'} 
                        size="small"
                        color={report.status === 'final' ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell>
                      {report.performer?.[0]?.display || 'Unknown'}
                    </TableCell>
                    <TableCell>
                      {report.effectiveDateTime || report.issued ? 
                        format(parseISO(report.effectiveDateTime || report.issued), 'MMM d, yyyy') : 
                        'No date'}
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1}>
                        <Button size="small" startIcon={<ViewIcon />} onClick={() => handleViewDetails(report)}>
                          View
                        </Button>
                        <QuickResultNote
                          result={report}
                          patientId={getReferenceId(report.subject?.reference)}
                          variant="button"
                          onNoteCreated={(data) => {
                          }}
                        />
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Alert severity="info">
            Trends view is not available for diagnostic reports. Please use table or cards view.
          </Alert>
        )
      ) : (
        // Default Card View (should not reach here)
        <Box>
          {sortedResults.map((result) => (
            <ResultCard
              key={result.id}
              observation={result}
              onClick={() => {}}
            />
          ))}
        </Box>
      )}
      {/* Result Details Dialog */}
      <Dialog open={detailsDialogOpen} onClose={() => setDetailsDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Result Details</Typography>
            <IconButton onClick={() => setDetailsDialogOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {selectedResult && (
            <Stack spacing={3}>
              {/* Test Information */}
              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>Test Name</Typography>
                <Typography variant="h6">
                  {getResourceDisplayText(selectedResult)}
                </Typography>
                {selectedResult?.code?.coding?.[0]?.code && (
                  <Typography variant="caption" color="text.secondary">
                    LOINC: {selectedResult?.code?.coding?.[0]?.code}
                  </Typography>
                )}
              </Box>

              {/* Result Value and Status */}
              <Grid container spacing={3}>
                <Grid item xs={12} md={4}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>Result</Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    {getResultStatus(selectedResult).icon}
                    <Typography variant="h5" fontWeight="bold">
                      {selectedResult.valueQuantity ? 
                        `${selectedResult.valueQuantity.value} ${selectedResult.valueQuantity.unit || ''}` :
                        selectedResult.valueString || 
                        getCodeableConceptDisplay(selectedResult.valueCodeableConcept) ||
                        'No value recorded'
                      }
                    </Typography>
                  </Stack>
                  {getResultStatus(selectedResult).label && (
                    <Chip 
                      label={getResultStatus(selectedResult).label} 
                      color={getResultStatus(selectedResult).color} 
                      size="small" 
                      sx={{ mt: 1 }}
                    />
                  )}
                </Grid>

                {selectedResult.referenceRange?.[0] && (
                  <Grid item xs={12} md={4}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>Reference Range</Typography>
                    <Typography variant="body1">
                      {selectedResult.referenceRange[0].text || 
                       `${selectedResult.referenceRange[0].low?.value || ''} - ${selectedResult.referenceRange[0].high?.value || ''} ${selectedResult.referenceRange[0].low?.unit || ''}`}
                    </Typography>
                  </Grid>
                )}

                <Grid item xs={12} md={4}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>Status</Typography>
                  <Typography variant="body1">
                    {selectedResult.status || 'Unknown'}
                  </Typography>
                </Grid>
              </Grid>

              {/* Date and Performer */}
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>Date Performed</Typography>
                  <Typography variant="body1">
                    {selectedResult.effectiveDateTime || selectedResult.issued ? 
                      format(parseISO(selectedResult.effectiveDateTime || selectedResult.issued), 'MMMM d, yyyy h:mm a') : 
                      'No date recorded'}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>Performer</Typography>
                  <Typography variant="body1">
                    {selectedResult.performer?.[0]?.display || 'Not specified'}
                  </Typography>
                </Grid>
              </Grid>

              {/* Components (for panel results) */}
              {selectedResult.component && selectedResult.component.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>Components</Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Component</TableCell>
                          <TableCell>Value</TableCell>
                          <TableCell>Reference Range</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {selectedResult.component.map((comp, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              {getResourceDisplayText(comp)}
                            </TableCell>
                            <TableCell>
                              {comp.valueQuantity ? 
                                `${comp.valueQuantity.value} ${comp.valueQuantity.unit || ''}` :
                                comp.valueString || 'N/A'
                              }
                            </TableCell>
                            <TableCell>
                              {comp.referenceRange?.[0] ? 
                                `${comp.referenceRange[0].low?.value || ''} - ${comp.referenceRange[0].high?.value || ''} ${comp.referenceRange[0].low?.unit || ''}` :
                                '-'
                              }
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}

              {/* Notes */}
              {selectedResult.note && selectedResult.note.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>Notes</Typography>
                  {selectedResult.note.map((note, index) => (
                    <Alert key={index} severity="info" sx={{ mt: 1 }}>
                      <Typography variant="body2">{note.text}</Typography>
                      {note.time && (
                        <Typography variant="caption" color="text.secondary">
                          {format(parseISO(note.time), 'MMM d, yyyy h:mm a')}
                        </Typography>
                      )}
                    </Alert>
                  ))}
                </Box>
              )}

              {/* Interpretation */}
              {selectedResult.interpretation && selectedResult.interpretation.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>Interpretation</Typography>
                  {selectedResult.interpretation.map((interp, index) => (
                    <Typography key={index} variant="body2">
                      {getCodeableConceptDisplay(interp)}
                    </Typography>
                  ))}
                </Box>
              )}

              {/* Method */}
              {selectedResult.method && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>Method</Typography>
                  <Typography variant="body2">
                    {getCodeableConceptDisplay(selectedResult.method)}
                  </Typography>
                </Box>
              )}

              {/* Specimen */}
              {selectedResult.specimen && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>Specimen</Typography>
                  <Typography variant="body2">
                    {selectedResult.specimen.display || 'Specimen information not available'}
                  </Typography>
                </Box>
              )}

              {/* Order Context */}
              <OrderContextPanel 
                observation={selectedResult} 
                onOrderSelect={(order) => {
                  // Could open order details in a separate dialog
                }}
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => {
              if (selectedResult) {
                const patientInfo = {
                  name: currentPatient ? 
                    `${currentPatient.name?.[0]?.given?.join(' ') || ''} ${currentPatient.name?.[0]?.family || ''}`.trim() : 
                    'Unknown Patient',
                  mrn: currentPatient?.identifier?.find(id => id.type?.coding?.[0]?.code === 'MR')?.value || currentPatient?.id,
                  birthDate: currentPatient?.birthDate,
                  gender: currentPatient?.gender,
                  phone: currentPatient?.telecom?.find(t => t.system === 'phone')?.value
                };
                
                printDocument({
                  title: 'Lab Result Details',
                  patient: patientInfo,
                  content: formatLabResultsForPrint([selectedResult])
                });
              }
            }} 
            startIcon={<PrintIcon />}
          >
            Print
          </Button>
          <Button onClick={() => setDetailsDialogOpen(false)} variant="contained">
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Critical Value Alert */}
      <CriticalValueAlert
        open={criticalAlertOpen}
        onClose={() => {
          setCriticalAlertOpen(false);
          setCriticalResult(null);
        }}
        observation={criticalResult}
        patient={currentPatient}
        provider={{ id: 'current-provider', display: 'Current Provider' }} // In production, get from auth
        onAcknowledge={handleCriticalValueAcknowledge}
      />

      {/* Result Trend Analysis Dialog */}
      <Dialog
        open={showTrendAnalysis}
        onClose={() => {
          setShowTrendAnalysis(false);
          setSelectedTestForTrend(null);
        }}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          Lab Result Trends
          <IconButton
            onClick={() => {
              setShowTrendAnalysis(false);
              setSelectedTestForTrend(null);
            }}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <ResultTrendAnalysis
            patientId={patientId}
            initialTestCode={selectedTestForTrend}
          />
        </DialogContent>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default React.memo(ResultsTab);