/**
 * Improved Timeline Tab Component
 * Part of the Clinical UI Improvements Initiative
 * 
 * Major Improvements:
 * - Fixed date range persistence issues
 * - Added ability to show/hide inactive resources (historical view)
 * - Enhanced resource detail viewing with modal dialog
 * - Better state management for filters
 * - Improved timeline visualization with interactive details
 * - Fixed timeframe selector to properly persist selections
 * 
 * Date: 2025-07-31
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Stack,
  Button,
  IconButton,
  Chip,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  InputAdornment,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  useTheme,
  alpha,
  Snackbar,
  Paper,
  useMediaQuery,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Collapse,
  Badge,
  Slider,
  CircularProgress,
  Skeleton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Menu,
  Switch
} from '@mui/material';
import {
  CalendarMonth as CalendarIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  LocalHospital as EncounterIcon,
  Medication as MedicationIcon,
  Science as LabIcon,
  Assignment as ConditionIcon,
  Warning as AllergyIcon,
  Vaccines as ImmunizationIcon,
  Image as ImagingIcon,
  Assessment as VitalIcon,
  Flag as GoalIcon,
  Notes as NoteIcon,
  Print as PrintIcon,
  Timeline as TimelineIcon,
  Today as TodayIcon,
  DateRange as DateRangeIcon,
  Event as EventIcon,
  MedicalServices as ProcedureIcon,
  Description as PlanIcon,
  Group as TeamIcon,
  CreditCard as InsuranceIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  Refresh as RefreshIcon,
  ViewWeek as MultiTrackIcon,
  ViewStream as SingleTrackIcon,
  ViewList as ListViewIcon,
  NavigateBefore as PrevIcon,
  NavigateNext as NextIcon,
  MoreVert as MoreIcon,
  Circle as DotIcon,
  Close as CloseIcon,
  ViewWeek,
  History as HistoryIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon
} from '@mui/icons-material';
import { format, parseISO, isWithinInterval, subDays, subMonths, subYears, startOfDay, endOfDay, differenceInDays, addDays, eachDayOfInterval } from 'date-fns';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import { printDocument } from '../../../../core/export/printUtils';
import { getMedicationName, getMedicationDosageDisplay } from '../../../../core/fhir/utils/medicationDisplayUtils';
import { useClinicalWorkflow, CLINICAL_EVENTS } from '../../../../contexts/ClinicalWorkflowContext';
import { resourceBelongsToPatient } from '../../../../utils/fhirReferenceUtils';
// Import shared clinical components
import { 
  ClinicalResourceCard,
  ClinicalSummaryCard,
  ClinicalFilterPanel,
  ClinicalDataGrid,
  ClinicalEmptyState,
  ClinicalLoadingState
} from '../../shared';
// Import the actual ResourceTimeline component
import { ResourceTimeline } from '../../shared/display';

// Enhanced event type configuration with track assignment
const eventTypes = {
  'Encounter': { 
    icon: <EncounterIcon />, 
    color: 'primary', 
    label: 'Visit',
    track: 'encounters',
    priority: 1
  },
  'MedicationRequest': { 
    icon: <MedicationIcon />, 
    color: 'secondary', 
    label: 'Medication',
    track: 'medications',
    priority: 2
  },
  'MedicationStatement': { 
    icon: <MedicationIcon />, 
    color: 'secondary', 
    label: 'Medication',
    track: 'medications',
    priority: 2
  },
  'Observation': { 
    icon: <LabIcon />, 
    color: 'info', 
    label: 'Lab Result',
    track: 'labs',
    priority: 3
  },
  'Condition': { 
    icon: <ConditionIcon />, 
    color: 'warning', 
    label: 'Diagnosis',
    track: 'conditions',
    priority: 1
  },
  'AllergyIntolerance': { 
    icon: <AllergyIcon />, 
    color: 'error', 
    label: 'Allergy',
    track: 'conditions',
    priority: 1
  },
  'Immunization': { 
    icon: <ImmunizationIcon />, 
    color: 'success', 
    label: 'Immunization',
    track: 'immunizations',
    priority: 4
  },
  'Procedure': { 
    icon: <ProcedureIcon />, 
    color: 'info', 
    label: 'Procedure',
    track: 'procedures',
    priority: 2
  },
  'DiagnosticReport': { 
    icon: <LabIcon />, 
    color: 'info', 
    label: 'Report',
    track: 'labs',
    priority: 3
  },
  'ImagingStudy': { 
    icon: <ImagingIcon />, 
    color: 'secondary', 
    label: 'Imaging',
    track: 'imaging',
    priority: 3
  },
  'DocumentReference': { 
    icon: <NoteIcon />, 
    color: 'inherit', 
    label: 'Note',
    track: 'documents',
    priority: 5
  },
  'CarePlan': { 
    icon: <PlanIcon />, 
    color: 'primary', 
    label: 'Care Plan',
    track: 'care',
    priority: 1
  },
  'CareTeam': { 
    icon: <TeamIcon />, 
    color: 'primary', 
    label: 'Care Team',
    track: 'care',
    priority: 1
  },
  'Coverage': { 
    icon: <InsuranceIcon />, 
    color: 'inherit', 
    label: 'Insurance',
    track: 'administrative',
    priority: 6
  },
  'Goal': { 
    icon: <GoalIcon />, 
    color: 'primary', 
    label: 'Goal',
    track: 'care',
    priority: 1
  },
  'WorkflowEvent': { 
    icon: <EventIcon />, 
    color: 'info', 
    label: 'Workflow Event',
    track: 'workflow',
    priority: 4
  }
};

// Get event date helper
const getEventDate = (event) => {
  switch (event.resourceType) {
    case 'Procedure':
      return event.performedDateTime || 
             event.performedPeriod?.start || 
             event.performedPeriod?.end ||
             event.occurrenceDateTime ||
             event.occurrencePeriod?.start ||
             event.date ||
             event.recordedDate ||
             null;
             
    case 'Observation':
      return event.effectiveDateTime || 
             event.effectivePeriod?.start ||
             event.issued ||
             event.date ||
             null;
             
    case 'MedicationRequest':
      return event.authoredOn || 
             event.dosageInstruction?.[0]?.timing?.event?.[0] ||
             event.dispenseRequest?.validityPeriod?.start ||
             null;
             
    case 'Condition':
      return event.onsetDateTime || 
             event.onsetPeriod?.start ||
             event.recordedDate ||
             event.dateRecorded ||
             null;
             
    case 'Encounter':
      return event.period?.start || 
             event.period?.end ||
             event.date ||
             null;
             
    case 'WorkflowEvent':
      return event.date || event.data?.timestamp || null;
             
    default:
      return event.effectiveDateTime || 
             event.authoredOn || 
             event.dateTime ||
             event.date ||
             event.period?.start ||
             event.recordedDate ||
             null;
  }
};

// Date range presets
const dateRangePresets = [
  { label: 'Last Week', getValue: () => ({ start: subDays(new Date(), 7), end: new Date() }) },
  { label: 'Last Month', getValue: () => ({ start: subMonths(new Date(), 1), end: new Date() }) },
  { label: 'Last 3 Months', getValue: () => ({ start: subMonths(new Date(), 3), end: new Date() }) },
  { label: 'Last Year', getValue: () => ({ start: subYears(new Date(), 1), end: new Date() }) },
  { label: 'All Time', getValue: () => ({ start: null, end: null }) }
];

// Helper to check if a resource is inactive/historical
const isResourceInactive = (resource) => {
  // Check various status fields used by different resource types
  const status = resource.status || 
                 resource.clinicalStatus?.coding?.[0]?.code || 
                 resource.verificationStatus?.coding?.[0]?.code;
  
  return status && ['inactive', 'resolved', 'completed', 'stopped', 'entered-in-error', 'cancelled', 'ended'].includes(status);
};

// Enhanced Timeline Event Card
const TimelineEventCard = ({ event, onClick, isAlternate }) => {
  const theme = useTheme();
  const eventType = eventTypes[event.resourceType] || { 
    icon: <EventIcon />, 
    color: 'inherit', 
    label: event.resourceType 
  };
  
  const getEventTitle = () => {
    switch (event.resourceType) {
      case 'Encounter':
        return event.type?.[0]?.text || event.type?.[0]?.coding?.[0]?.display || 'Encounter';
      case 'MedicationRequest':
        return getMedicationName(event);
      case 'Observation':
        return event.code?.text || event.code?.coding?.[0]?.display || 'Observation';
      case 'Condition':
        return event.code?.text || event.code?.coding?.[0]?.display || 'Condition';
      case 'WorkflowEvent':
        return event.data?.message || event.eventType || 'Workflow Event';
      default:
        return event.resourceType;
    }
  };

  const eventDate = getEventDate(event);
  const dateStr = eventDate ? format(parseISO(eventDate), 'MMM d, yyyy h:mm a') : 'No date';
  const isInactive = isResourceInactive(event);
  
  // Determine severity based on event type and status
  const getSeverity = () => {
    if (isInactive) return 'low';
    if (event.resourceType === 'AllergyIntolerance') return 'critical';
    if (event.resourceType === 'Condition') return 'high';
    if (event.resourceType === 'MedicationRequest') return 'moderate';
    return 'low';
  };
  
  return (
    <ClinicalResourceCard
      title={getEventTitle()}
      severity={getSeverity()}
      status={eventType.label}
      statusColor={eventType.color === 'inherit' ? 'default' : eventType.color}
      icon={eventType.icon}
      details={[
        { label: 'Date', value: dateStr },
        { label: 'Type', value: eventType.label },
        { label: 'Status', value: isInactive ? 'Historical' : 'Active' }
      ]}
      onEdit={() => onClick(event)}
      isAlternate={isAlternate}
      sx={{
        opacity: isInactive ? 0.7 : 1,
        borderLeft: isInactive ? `4px solid ${theme.palette.grey[400]}` : undefined
      }}
    />
  );
};

const TimelineTabImproved = ({ patientId, patient, onNavigateToTab }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  
  const { 
    resources, 
    searchResources,
    isResourceLoading, 
    currentPatient
  } = useFHIRResource();
  const { subscribe, notifications } = useClinicalWorkflow();
  
  // State
  const [viewMode, setViewMode] = useState('cards'); // 'cards', 'list', 'timeline'
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState(() => {
    // Initialize with last year as default
    const end = new Date();
    const start = subYears(end, 1);
    return { start, end };
  });
  const [selectedPreset, setSelectedPreset] = useState('Last Year');
  const [selectedTypes, setSelectedTypes] = useState(new Set(Object.keys(eventTypes).filter(type => type !== 'WorkflowEvent')));
  const [showFilters, setShowFilters] = useState(false);
  const [showInactiveResources, setShowInactiveResources] = useState(true); // Show historical by default
  const [workflowEvents, setWorkflowEvents] = useState([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [hasLoadedInitialData, setHasLoadedInitialData] = useState(false);
  const [loadingError, setLoadingError] = useState(null);
  const [selectedResult, setSelectedResult] = useState(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [timelineDensity, setTimelineDensity] = useState('normal'); // 'compact', 'normal', 'comfortable'
  const [filterAnchor, setFilterAnchor] = useState(null);
  
  // Use ref to track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  // Load timeline data - fetch 50 of each selected resource type
  useEffect(() => {
    const loadData = async () => {
      if (!patientId || !dateRange.start) return;
      
      try {
        setLoadingError(null);
        
        // Build search parameters for each resource type
        const promises = Array.from(selectedTypes).map(async (resourceType) => {
          if (resourceType === 'WorkflowEvent') {
            return; // Skip workflow events as they're handled separately
          }
          
          const params = {
            patient: patientId,
            _count: 50, // Load 50 of each resource type
            _sort: '-date' // Sort by most recent first
          };
          
          // Add date range filters if specified
          // Note: Different resource types use different date parameters
          const dateParam = (() => {
            switch (resourceType) {
              case 'Condition':
                return 'recorded-date';
              case 'MedicationRequest':
                return 'authored';
              case 'Observation':
                return 'date';
              case 'Procedure':
                return 'performed';
              case 'Encounter':
                return 'date';
              case 'Immunization':
                return 'date';
              case 'DocumentReference':
                return 'date';
              case 'DiagnosticReport':
                return 'date';
              case 'AllergyIntolerance':
                return 'date';
              default:
                return 'date';
            }
          })();
          
          if (dateRange.start && dateRange.end) {
            params[dateParam] = `ge${dateRange.start.toISOString().split('T')[0]}&${dateParam}=le${dateRange.end.toISOString().split('T')[0]}`;
          } else if (dateRange.start) {
            params[dateParam] = `ge${dateRange.start.toISOString().split('T')[0]}`;
          } else if (dateRange.end) {
            params[dateParam] = `le${dateRange.end.toISOString().split('T')[0]}`;
          }
          
          // Resource-specific sort parameters
          switch (resourceType) {
            case 'Condition':
              params._sort = '-recorded-date';
              break;
            case 'MedicationRequest':
              params._sort = '-authored';
              break;
            case 'Observation':
              params._sort = '-effective-date';
              break;
            case 'Procedure':
              params._sort = '-performed-date';
              break;
            case 'Encounter':
              params._sort = '-period-start';
              break;
            case 'Immunization':
              params._sort = '-occurrence-date';
              break;
            case 'DocumentReference':
              params._sort = '-date';
              break;
            case 'DiagnosticReport':
              params._sort = '-effective-date';
              break;
            default:
              // Use generic date sort
              break;
          }
          
          try {
            await searchResources(resourceType, params, !hasLoadedInitialData);
          } catch (error) {
            console.error(`Timeline: Error loading ${resourceType}:`, error);
            // Continue loading other resource types even if one fails
          }
        });
        
        // Wait for all searches to complete
        await Promise.all(promises);
        
        if (isMountedRef.current) {
          setHasLoadedInitialData(true);
        }
      } catch (error) {
        console.error('Timeline: Error loading data', error);
        if (isMountedRef.current) {
          setLoadingError(error.message || 'Failed to load timeline data');
          setSnackbar({
            open: true,
            message: `Error loading timeline data: ${error.message || 'Unknown error'}`,
            severity: 'error'
          });
        }
      }
    };
    
    // Load data when component mounts, patient changes, or filters change
    loadData();
  }, [patientId, selectedTypes, dateRange.start, dateRange.end, searchResources, hasLoadedInitialData]);
  
  // Subscribe to workflow events
  useEffect(() => {
    const unsubscribers = [];
    
    Object.values(CLINICAL_EVENTS).forEach(eventType => {
      const unsubscribe = subscribe(eventType, (eventData) => {
        if (eventData.patientId === patientId) {
          const workflowEvent = {
            id: `workflow-${Date.now()}-${Math.random()}`,
            resourceType: 'WorkflowEvent',
            eventType: eventType,
            date: eventData.timestamp || new Date().toISOString(),
            data: eventData,
            patientId: eventData.patientId
          };
          
          setWorkflowEvents(prev => [...prev, workflowEvent]);
        }
      });
      
      unsubscribers.push(unsubscribe);
    });
    
    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, [subscribe, patientId]);
  
  // Collect all events
  const allEvents = useMemo(() => {
    const events = [];
    const seenIds = new Set();
    
    // Add FHIR resources
    selectedTypes.forEach(resourceType => {
      if (resourceType === 'WorkflowEvent') {
        workflowEvents.forEach(event => {
          const uniqueKey = `${event.resourceType}-${event.id}`;
          if (!seenIds.has(uniqueKey)) {
            seenIds.add(uniqueKey);
            events.push(event);
          }
        });
      } else if (resources && resources[resourceType]) {
        const resourceTypeData = resources[resourceType] || {};
        const patientResources = Array.isArray(resourceTypeData) 
          ? resourceTypeData.filter(r => resourceBelongsToPatient(r, patientId))
          : Object.values(resourceTypeData).filter(r => resourceBelongsToPatient(r, patientId));
        
        patientResources.forEach(resource => {
          const uniqueKey = `${resource.resourceType}-${resource.id}`;
          if (!seenIds.has(uniqueKey)) {
            seenIds.add(uniqueKey);
            events.push(resource);
          }
        });
      }
    });
    
    return events;
  }, [patientId, resources, workflowEvents, selectedTypes]);
  
  // Filter events
  const filteredEvents = useMemo(() => {
    return allEvents.filter(event => {
      // Date filter
      const eventDate = getEventDate(event);
      if (!eventDate) return false;
      
      const date = new Date(eventDate);
      // Use date boundaries for proper filtering
      const startOfRangeDay = dateRange.start ? startOfDay(dateRange.start) : null;
      const endOfRangeDay = dateRange.end ? endOfDay(dateRange.end) : null;
      
      if (startOfRangeDay && date < startOfRangeDay) return false;
      if (endOfRangeDay && date > endOfRangeDay) return false;
      
      // Status filter - filter out inactive if requested
      if (!showInactiveResources && isResourceInactive(event)) {
        return false;
      }
      
      // Search filter
      if (searchQuery) {
        const searchLower = searchQuery.toLowerCase();
        const searchableText = JSON.stringify(event).toLowerCase();
        if (!searchableText.includes(searchLower)) {
          return false;
        }
      }
      
      return true;
    });
  }, [allEvents, dateRange, searchQuery, showInactiveResources]);
  
  // Sort events by date and prepare for visualization
  const sortedEvents = useMemo(() => {
    return [...filteredEvents]
      .map(event => ({
        ...event,
        title: getEventTitle(event),
        date: getEventDate(event),
        display: getEventTitle(event) // Add display field for ResourceTimeline
      }))
      .sort((a, b) => {
        const dateA = a.date;
        const dateB = b.date;
        
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;
        
        return new Date(dateB) - new Date(dateA);
      });
  }, [filteredEvents]);
  
  // Prepare resources for timeline component with proper format
  const timelineResources = useMemo(() => {
    return sortedEvents.filter(event => event.date); // Only include events with dates
  }, [sortedEvents]);
  
  // Calculate summary metrics
  const summaryMetrics = useMemo(() => {
    const byType = {};
    const activeCount = sortedEvents.filter(e => !isResourceInactive(e)).length;
    const historicalCount = sortedEvents.filter(e => isResourceInactive(e)).length;
    
    sortedEvents.forEach(event => {
      byType[event.resourceType] = (byType[event.resourceType] || 0) + 1;
    });
    
    // Get top event types
    const topTypes = Object.entries(byType)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([type, count]) => {
        const config = eventTypes[type];
        return {
          type,
          count,
          config: config || { label: type, color: 'default', icon: <EventIcon /> }
        };
      });
    
    // Add active/historical summary
    return [
      {
        type: 'active',
        count: activeCount,
        config: { label: 'Active', color: 'success', icon: <VisibilityIcon /> }
      },
      {
        type: 'historical',
        count: historicalCount,
        config: { label: 'Historical', color: 'default', icon: <HistoryIcon /> }
      },
      ...topTypes
    ];
  }, [sortedEvents]);
  
  // Handlers
  const handleDateRangeChange = useCallback((newRange) => {
    setDateRange(newRange);
    // Clear preset if it's a custom range
    const isPreset = dateRangePresets.some(preset => {
      const presetRange = preset.getValue();
      return presetRange.start?.getTime() === newRange.start?.getTime() &&
             presetRange.end?.getTime() === newRange.end?.getTime();
    });
    if (!isPreset) {
      setSelectedPreset(null);
    }
  }, []);
  
  const handlePresetClick = useCallback((preset) => {
    const range = preset.getValue();
    setDateRange(range);
    setSelectedPreset(preset.label);
  }, []);
  
  function getEventTitle(event) {
    switch (event.resourceType) {
      case 'Encounter':
        return event.type?.[0]?.text || event.type?.[0]?.coding?.[0]?.display || 'Encounter';
      case 'MedicationRequest':
        return getMedicationName(event);
      case 'Observation':
        return event.code?.text || event.code?.coding?.[0]?.display || 'Observation';
      case 'Condition':
        return event.code?.text || event.code?.coding?.[0]?.display || 'Condition';
      case 'WorkflowEvent':
        return event.data?.message || event.eventType || 'Workflow Event';
      default:
        return event.resourceType;
    }
  }
  
  function handleEventClick(event) {
    // Show the details dialog
    setSelectedResult(event);
    setDetailsDialogOpen(true);
  }
  
  function handleNavigateFromDialog() {
    if (!selectedResult || !onNavigateToTab) return;
    
    const resourceTypeToTab = {
      'Encounter': 'encounters',
      'MedicationRequest': 'chart-review',
      'MedicationStatement': 'medications',
      'Observation': 'results',
      'Condition': 'chart-review',
      'AllergyIntolerance': 'chart-review',
      'Immunization': 'chart-review',
      'ImagingStudy': 'imaging',
      'DocumentReference': 'documentation',
      'Goal': 'care-plan',
      'CarePlan': 'care-plan',
      'CareTeam': 'care-plan',
      'Procedure': 'chart-review',
      'DiagnosticReport': 'results'
    };
    
    const tab = resourceTypeToTab[selectedResult.resourceType] || 'summary';
    onNavigateToTab(tab, {
      resourceId: selectedResult.id,
      resourceType: selectedResult.resourceType
    });
    setDetailsDialogOpen(false);
  }
  
  function handlePrintTimeline() {
    const patientInfo = {
      name: patient ? 
        `${patient.name?.[0]?.given?.join(' ') || ''} ${patient.name?.[0]?.family || ''}`.trim() : 
        'Unknown Patient',
      mrn: patient?.identifier?.find(id => id.type?.coding?.[0]?.code === 'MR')?.value || patient?.id,
      birthDate: patient?.birthDate,
      gender: patient?.gender
    };
    
    let content = '<h2>Clinical Timeline</h2>';
    content += `<p>Period: ${dateRange.start ? format(dateRange.start, 'MMM d, yyyy') : 'N/A'} - ${dateRange.end ? format(dateRange.end, 'MMM d, yyyy') : 'N/A'}</p>`;
    content += `<p>Total Events: ${sortedEvents.length} (Active: ${sortedEvents.filter(e => !isResourceInactive(e)).length}, Historical: ${sortedEvents.filter(e => isResourceInactive(e)).length})</p>`;
    
    // Group by event type for printing
    const eventsByType = {};
    sortedEvents.forEach(event => {
      const type = event.resourceType;
      if (!eventsByType[type]) {
        eventsByType[type] = [];
      }
      eventsByType[type].push(event);
    });
    
    Object.entries(eventsByType).forEach(([type, events]) => {
      const config = eventTypes[type];
      content += `<h3>${config?.label || type} (${events.length})</h3>`;
      content += '<ul>';
      
      events.forEach(event => {
        const date = getEventDate(event);
        const dateStr = date ? format(parseISO(date), 'MMM d, yyyy h:mm a') : 'No date';
        const title = getEventTitle(event);
        const status = isResourceInactive(event) ? ' [Historical]' : '';
        content += `<li><strong>${dateStr}</strong> - ${title}${status}</li>`;
      });
      
      content += '</ul>';
    });
    
    printDocument({
      title: 'Clinical Timeline',
      patient: patientInfo,
      content
    });
  }
  
  // Handle type toggle
  const handleTypeToggle = (type) => {
    setSelectedTypes(prev => {
      const newTypes = new Set(prev);
      if (prev.has(type)) {
        newTypes.delete(type);
      } else {
        newTypes.add(type);
      }
      return newTypes;
    });
  };
  
  // Use isResourceLoading from context
  const loading = isResourceLoading('Patient') || isResourceLoading('Observation') || isResourceLoading('Encounter') || !resources;
  
  if ((loading && !hasLoadedInitialData) || !resources) {
    return (
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', p: 2 }}>
        <ClinicalLoadingState.SummaryCard count={4} />
        <Box sx={{ mt: 2 }}>
          <ClinicalLoadingState.Filter />
        </Box>
        <Box sx={{ mt: 2 }}>
          <ClinicalLoadingState.ResourceCard count={5} />
        </Box>
      </Box>
    );
  }
  
  if (loadingError) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          {loadingError}
          <Button onClick={() => window.location.reload()} sx={{ ml: 2 }}>
            Reload
          </Button>
        </Alert>
      </Box>
    );
  }
  
  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Summary Cards */}
      <Box sx={{ mb: 1.5, px: isMobile ? 1 : 0 }}>
        <Stack 
          direction="row" 
          spacing={isMobile ? 0.5 : 1} 
          sx={{ 
            overflowX: 'auto', 
            pb: 0.5,
            '& > *': {
              minWidth: isMobile ? '100px' : '120px'
            }
          }}
        >
          {summaryMetrics.slice(0, 5).map(({ type, count, config }) => (
            <ClinicalSummaryCard
              key={type}
              title={config.label}
              value={count}
              severity={type === 'active' ? 'success' : 'normal'}
              icon={config.icon}
              sx={{ height: 64 }}
            />
          ))}
        </Stack>
      </Box>
      
      {/* Clinical Filter Panel */}
      <ClinicalFilterPanel
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        dateRange={dateRange}
        onDateRangeChange={handleDateRangeChange}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        viewModes={[
          { value: 'cards', label: 'Cards', icon: <ViewWeek /> },
          { value: 'list', label: 'List', icon: <ListViewIcon /> },
          { value: 'timeline', label: 'Timeline', icon: <TimelineIcon /> }
        ]}
        onRefresh={async () => {
          try {
            setHasLoadedInitialData(false);
            setLoadingError(null);
            
            // Refresh data by re-running searches for each selected type
            const promises = Array.from(selectedTypes).map(async (resourceType) => {
              if (resourceType === 'WorkflowEvent') return;
              
              const params = {
                patient: patientId,
                _count: 50,
                _sort: '-date'
              };
              
              // Add date range filters - use resource-specific date parameters
              const dateParam = (() => {
                switch (resourceType) {
                  case 'Condition':
                    return 'recorded-date';
                  case 'MedicationRequest':
                    return 'authored';
                  case 'Observation':
                    return 'date';
                  case 'Procedure':
                    return 'performed';
                  case 'Encounter':
                    return 'date';
                  case 'Immunization':
                    return 'date';
                  case 'DocumentReference':
                    return 'date';
                  case 'DiagnosticReport':
                    return 'date';
                  case 'AllergyIntolerance':
                    return 'date';
                  default:
                    return 'date';
                }
              })();
              
              if (dateRange.start && dateRange.end) {
                params[dateParam] = `ge${dateRange.start.toISOString().split('T')[0]}&${dateParam}=le${dateRange.end.toISOString().split('T')[0]}`;
              } else if (dateRange.start) {
                params[dateParam] = `ge${dateRange.start.toISOString().split('T')[0]}`;
              } else if (dateRange.end) {
                params[dateParam] = `le${dateRange.end.toISOString().split('T')[0]}`;
              }
              
              try {
                await searchResources(resourceType, params, true);
              } catch (error) {
                console.error(`Timeline: Error refreshing ${resourceType}:`, error);
              }
            });
            
            await Promise.all(promises);
            setHasLoadedInitialData(true);
            setSnackbar({
              open: true,
              message: 'Timeline refreshed successfully',
              severity: 'success'
            });
          } catch (error) {
            console.error('Timeline: Refresh failed', error);
            setLoadingError(error.message || 'Failed to refresh timeline data');
          }
        }}
        additionalFilters={
          <Stack direction="row" spacing={0.5}>
            {dateRangePresets.slice(0, 3).map(preset => (
              <Button
                key={preset.label}
                size="small"
                variant={selectedPreset === preset.label ? 'contained' : 'outlined'}
                onClick={() => handlePresetClick(preset)}
                sx={{ borderRadius: 0, minWidth: 'auto', fontSize: '0.75rem' }}
              >
                {preset.label}
              </Button>
            ))}
          </Stack>
        }
        customFilters={
          <>
            <FormControlLabel
              control={
                <Switch
                  checked={showInactiveResources}
                  onChange={(e) => setShowInactiveResources(e.target.checked)}
                  size="small"
                  color="primary"
                />
              }
              label={
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  {showInactiveResources ? <VisibilityIcon fontSize="small" /> : <VisibilityOffIcon fontSize="small" />}
                  <Typography variant="body2">Historical</Typography>
                </Stack>
              }
              sx={{ ml: 1, mr: 1 }}
            />
            <Button
              variant="outlined"
              startIcon={showFilters ? <ExpandLessIcon /> : <FilterIcon />}
              onClick={() => setShowFilters(!showFilters)}
              sx={{ borderRadius: 0 }}
            >
              Event Types ({selectedTypes.size})
            </Button>
            {viewMode === 'timeline' && (
              <ToggleButtonGroup
                value={timelineDensity}
                exclusive
                onChange={(e, value) => value && setTimelineDensity(value)}
                size="small"
                sx={{ borderRadius: 0 }}
              >
                <ToggleButton value="compact" sx={{ borderRadius: 0 }}>
                  <Tooltip title="Compact View">
                    <SingleTrackIcon />
                  </Tooltip>
                </ToggleButton>
                <ToggleButton value="normal" sx={{ borderRadius: 0 }}>
                  <Tooltip title="Normal View">
                    <ViewWeek />
                  </Tooltip>
                </ToggleButton>
                <ToggleButton value="comfortable" sx={{ borderRadius: 0 }}>
                  <Tooltip title="Comfortable View">
                    <ListViewIcon />
                  </Tooltip>
                </ToggleButton>
              </ToggleButtonGroup>
            )}
            <IconButton onClick={handlePrintTimeline}>
              <PrintIcon />
            </IconButton>
          </>
        }
      />
      
      {/* Event type filters */}
      <Collapse in={showFilters}>
        <Box sx={{ px: 2, py: 1, bgcolor: 'background.default', borderRadius: 0, mb: 1 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="caption" sx={{ fontWeight: 600 }}>Event Types</Typography>
            <Stack direction="row" spacing={0.5}>
              <Button 
                size="small" 
                onClick={() => {
                  setSelectedTypes(new Set(Object.keys(eventTypes)));
                  setShowInactiveResources(true);
                }}
                sx={{ borderRadius: 0, py: 0.5, fontSize: '0.75rem' }}
              >
                All
              </Button>
              <Button 
                size="small" 
                onClick={() => {
                  setSelectedTypes(new Set(['Condition', 'MedicationRequest', 'AllergyIntolerance']));
                  setShowInactiveResources(false);
                }}
                sx={{ borderRadius: 0, py: 0.5, fontSize: '0.75rem' }}
              >
                Active Only
              </Button>
              <Button 
                size="small" 
                onClick={() => setSelectedTypes(new Set())}
                sx={{ borderRadius: 0, py: 0.5, fontSize: '0.75rem' }}
              >
                None
              </Button>
            </Stack>
          </Stack>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {Object.entries(eventTypes).map(([type, config]) => (
              <Chip
                key={type}
                label={
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    {React.cloneElement(config.icon, { sx: { fontSize: 16 } })}
                    <span>{config.label}</span>
                  </Stack>
                }
                onClick={() => handleTypeToggle(type)}
                sx={{ 
                  borderRadius: '4px',
                  bgcolor: selectedTypes.has(type) ? 
                    alpha(
                      config.color === 'inherit' ? 
                        theme.palette.grey[500] : 
                        (theme.palette[config.color]?.main || theme.palette.grey[500]),
                      0.1
                    ) : 
                    'transparent',
                  borderColor: selectedTypes.has(type) ? 
                    (config.color === 'inherit' ? 
                      theme.palette.grey[500] : 
                      (theme.palette[config.color]?.main || theme.palette.grey[500])
                    ) : 
                    theme.palette.divider,
                  borderWidth: 1,
                  borderStyle: 'solid',
                  '&:hover': {
                    bgcolor: alpha(
                      config.color === 'inherit' ? 
                        theme.palette.grey[500] : 
                        (theme.palette[config.color]?.main || theme.palette.grey[500]),
                      0.2
                    )
                  }
                }}
                size="small"
              />
            ))}
          </Box>
        </Box>
      </Collapse>
      
      {/* Content Area */}
      <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {sortedEvents.length === 0 ? (
          <ClinicalEmptyState
            title="No events found"
            message={
              showInactiveResources 
                ? "Try adjusting your date range or event type filters"
                : "Try showing historical events or adjusting your filters"
            }
            actions={[
              { 
                label: 'Clear Filters', 
                onClick: () => {
                  setSearchQuery('');
                  setSelectedTypes(new Set(Object.keys(eventTypes)));
                  setShowInactiveResources(true);
                }
              },
              !showInactiveResources && {
                label: 'Show Historical',
                onClick: () => setShowInactiveResources(true)
              }
            ].filter(Boolean)}
          />
        ) : viewMode === 'cards' ? (
          // Cards view
          <Box sx={{ p: isMobile ? 1 : 2 }}>
            <Stack spacing={isMobile ? 1 : 2}>
              {sortedEvents.map((event, index) => (
                <TimelineEventCard
                  key={`${event.id}-${index}`}
                  event={event}
                  onClick={handleEventClick}
                  isAlternate={index % 2 === 1}
                />
              ))}
            </Stack>
          </Box>
        ) : viewMode === 'list' ? (
          // List view using ClinicalDataGrid
          <ClinicalDataGrid
            columns={[
              {
                field: 'date',
                headerName: 'Date',
                width: 180,
                valueGetter: (params) => {
                  const date = getEventDate(params.row);
                  return date ? format(parseISO(date), 'MMM d, yyyy h:mm a') : 'No date';
                }
              },
              {
                field: 'type',
                headerName: 'Type',
                width: 150,
                renderCell: (params) => {
                  const config = eventTypes[params.row.resourceType];
                  const isInactive = isResourceInactive(params.row);
                  return (
                    <Stack direction="row" spacing={1} alignItems="center">
                      {config?.icon}
                      <Chip 
                        label={config?.label || params.row.resourceType} 
                        size="small"
                        sx={{ 
                          borderRadius: '4px',
                          opacity: isInactive ? 0.7 : 1
                        }}
                      />
                    </Stack>
                  );
                }
              },
              {
                field: 'title',
                headerName: 'Event',
                flex: 1,
                valueGetter: (params) => getEventTitle(params.row)
              },
              {
                field: 'status',
                headerName: 'Status',
                width: 100,
                renderCell: (params) => {
                  const isInactive = isResourceInactive(params.row);
                  return (
                    <Chip
                      label={isInactive ? 'Historical' : 'Active'}
                      size="small"
                      color={isInactive ? 'default' : 'success'}
                      sx={{ borderRadius: '4px' }}
                    />
                  );
                }
              }
            ]}
            rows={sortedEvents.map((event, index) => ({ ...event, id: event.id || index }))}
            onRowClick={(params) => handleEventClick(params.row)}
            sortModel={[{ field: 'date', sort: 'desc' }]}
            sx={{
              '& .MuiDataGrid-cell': {
                borderRadius: 0
              },
              '& .MuiDataGrid-columnHeader': {
                borderRadius: 0
              }
            }}
          />
        ) : (
          // Timeline view - using actual ResourceTimeline component
          <Box sx={{ height: '100%', p: 1 }}>
            <ResourceTimeline
              resources={timelineResources}
              height={timelineDensity === 'compact' ? 300 : timelineDensity === 'comfortable' ? 500 : 400}
              loading={loading && !hasLoadedInitialData}
              onResourceClick={handleEventClick}
              onRangeSelect={(range) => {
                handleDateRangeChange({ start: new Date(range.start), end: new Date(range.end) });
              }}
              showLegend={true}
              showControls={false} // We're using our own controls
              groupBy="resourceType"
              initialTimeRange={dateRange.start && dateRange.end ? 
                Math.ceil((dateRange.end - dateRange.start) / (1000 * 60 * 60 * 24)) : 
                365
              }
              highlightToday={true}
              animate={true}
              sx={{ 
                borderRadius: 0,
                '& .MuiPaper-root': {
                  borderRadius: 0
                }
              }}
            />
          </Box>
        )}
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
          Event Details
          <IconButton
            onClick={() => setDetailsDialogOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {selectedResult && (
            <Box>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={2}>
                <Box>
                  <Typography variant="h6" gutterBottom>
                    {getEventTitle(selectedResult)}
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip 
                      label={eventTypes[selectedResult.resourceType]?.label || selectedResult.resourceType}
                      color={eventTypes[selectedResult.resourceType]?.color || 'default'}
                      size="small"
                      icon={eventTypes[selectedResult.resourceType]?.icon}
                    />
                    {selectedResult.status && (
                      <Chip 
                        label={selectedResult.status}
                        size="small"
                        variant="outlined"
                      />
                    )}
                    {isResourceInactive(selectedResult) && (
                      <Chip 
                        label="Historical"
                        size="small"
                        color="default"
                        icon={<HistoryIcon />}
                      />
                    )}
                  </Stack>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {getEventDate(selectedResult) ? format(parseISO(getEventDate(selectedResult)), 'PPP') : 'No date'}
                </Typography>
              </Stack>
              
              <Divider sx={{ my: 2 }} />
              
              {/* Resource-specific display */}
              {selectedResult.resourceType === 'Condition' && (
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">Condition</Typography>
                    <Typography variant="body1">
                      {selectedResult.code?.text || selectedResult.code?.coding?.[0]?.display || 'Unknown condition'}
                    </Typography>
                  </Box>
                  {selectedResult.clinicalStatus && (
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">Clinical Status</Typography>
                      <Typography variant="body1">
                        {selectedResult.clinicalStatus.coding?.[0]?.code}
                      </Typography>
                    </Box>
                  )}
                  {selectedResult.severity && (
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">Severity</Typography>
                      <Typography variant="body1">
                        {selectedResult.severity.text || selectedResult.severity.coding?.[0]?.display}
                      </Typography>
                    </Box>
                  )}
                  {selectedResult.note?.[0]?.text && (
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">Notes</Typography>
                      <Typography variant="body1">
                        {selectedResult.note[0].text}
                      </Typography>
                    </Box>
                  )}
                </Stack>
              )}
              
              {selectedResult.resourceType === 'MedicationRequest' && (
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">Medication</Typography>
                    <Typography variant="body1">
                      {getMedicationName(selectedResult)}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">Dosage</Typography>
                    <Typography variant="body1">
                      {getMedicationDosageDisplay(selectedResult)}
                    </Typography>
                  </Box>
                  {selectedResult.status && (
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">Status</Typography>
                      <Typography variant="body1">
                        {selectedResult.status}
                      </Typography>
                    </Box>
                  )}
                  {selectedResult.reasonCode?.[0] && (
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">Reason</Typography>
                      <Typography variant="body1">
                        {selectedResult.reasonCode[0].text || selectedResult.reasonCode[0].coding?.[0]?.display}
                      </Typography>
                    </Box>
                  )}
                </Stack>
              )}
              
              {selectedResult.resourceType === 'Observation' && (
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">Observation</Typography>
                    <Typography variant="body1">
                      {selectedResult.code?.text || selectedResult.code?.coding?.[0]?.display || 'Unknown observation'}
                    </Typography>
                  </Box>
                  {selectedResult.valueQuantity && (
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">Value</Typography>
                      <Typography variant="body1">
                        {selectedResult.valueQuantity.value} {selectedResult.valueQuantity.unit}
                      </Typography>
                    </Box>
                  )}
                  {selectedResult.interpretation?.[0] && (
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">Interpretation</Typography>
                      <Typography variant="body1">
                        {selectedResult.interpretation[0].text || selectedResult.interpretation[0].coding?.[0]?.display}
                      </Typography>
                    </Box>
                  )}
                  {selectedResult.referenceRange?.[0] && (
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">Reference Range</Typography>
                      <Typography variant="body1">
                        {selectedResult.referenceRange[0].low?.value} - {selectedResult.referenceRange[0].high?.value} {selectedResult.referenceRange[0].low?.unit}
                      </Typography>
                    </Box>
                  )}
                </Stack>
              )}
              
              {selectedResult.resourceType === 'Encounter' && (
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">Encounter Type</Typography>
                    <Typography variant="body1">
                      {selectedResult.type?.[0]?.text || selectedResult.type?.[0]?.coding?.[0]?.display || 'Unknown type'}
                    </Typography>
                  </Box>
                  {selectedResult.period && (
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">Period</Typography>
                      <Typography variant="body1">
                        {selectedResult.period.start && format(parseISO(selectedResult.period.start), 'PPP')}
                        {selectedResult.period.end && ` - ${format(parseISO(selectedResult.period.end), 'PPP')}`}
                      </Typography>
                    </Box>
                  )}
                  {selectedResult.reasonCode?.[0] && (
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">Reason</Typography>
                      <Typography variant="body1">
                        {selectedResult.reasonCode[0].text || selectedResult.reasonCode[0].coding?.[0]?.display}
                      </Typography>
                    </Box>
                  )}
                </Stack>
              )}
              
              {/* JSON View Toggle */}
              <Box mt={3}>
                <Button
                  size="small"
                  onClick={() => setSelectedResult({ ...selectedResult, _showJson: !selectedResult._showJson })}
                  sx={{ borderRadius: 0 }}
                >
                  {selectedResult._showJson ? 'Hide' : 'Show'} Raw FHIR Resource
                </Button>
              </Box>
              
              {/* Collapsible full JSON view */}
              <Collapse in={selectedResult._showJson}>
                <Box mt={2}>
                  <Typography variant="caption" color="text.secondary" gutterBottom>
                    Raw FHIR Resource:
                  </Typography>
                  <pre style={{ 
                    whiteSpace: 'pre-wrap', 
                    fontSize: '0.75rem',
                    backgroundColor: theme.palette.grey[100],
                    padding: theme.spacing(1),
                    borderRadius: theme.shape.borderRadius,
                    overflow: 'auto',
                    maxHeight: 300
                  }}>
                    {JSON.stringify(selectedResult, null, 2)}
                  </pre>
                </Box>
              </Collapse>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {onNavigateToTab && selectedResult && (
            <Button 
              onClick={handleNavigateFromDialog}
              sx={{ borderRadius: 0 }}
              variant="contained"
            >
              View in {selectedResult ? ({
                'Encounter': 'Encounters',
                'MedicationRequest': 'Chart Review',
                'MedicationStatement': 'Medications',
                'Observation': 'Results',
                'Condition': 'Chart Review',
                'AllergyIntolerance': 'Chart Review',
                'Immunization': 'Chart Review',
                'ImagingStudy': 'Imaging',
                'DocumentReference': 'Documentation',
                'Goal': 'Care Plan',
                'CarePlan': 'Care Plan',
                'CareTeam': 'Care Plan',
                'Procedure': 'Chart Review',
                'DiagnosticReport': 'Results'
              }[selectedResult.resourceType] || 'Details') : 'Details'}
            </Button>
          )}
          <Button onClick={() => setDetailsDialogOpen(false)} sx={{ borderRadius: 0 }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Snackbar */}
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

export default React.memo(TimelineTabImproved);