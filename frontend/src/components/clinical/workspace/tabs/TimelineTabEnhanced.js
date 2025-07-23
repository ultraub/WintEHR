/**
 * Enhanced Timeline Tab Component
 * Part of the Clinical UI Improvements Initiative
 * 
 * Improvements:
 * - Multi-track timeline visualization with lanes for different resource types
 * - Interactive zooming and panning
 * - Better visual design with clinical color coding
 * - Density controls for different view modes
 * - Integrated with new UI components
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
  Avatar
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
  Circle as DotIcon
} from '@mui/icons-material';
import { format, parseISO, isWithinInterval, subDays, subMonths, subYears, startOfDay, endOfDay, differenceInDays, addDays, eachDayOfInterval } from 'date-fns';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import { useNavigate } from 'react-router-dom';
import { useDebounce } from '../../../../hooks/useDebounce';
import { printDocument } from '../../../../core/export/printUtils';
import { getMedicationName, getMedicationDosageDisplay } from '../../../../core/fhir/utils/medicationDisplayUtils';
import { useClinicalWorkflow, CLINICAL_EVENTS } from '../../../../contexts/ClinicalWorkflowContext';
import { resourceBelongsToPatient } from '../../../../utils/fhirReferenceUtils';
import { motion, AnimatePresence } from 'framer-motion';

// Import new UI components
import ClinicalCard from '../../ui/ClinicalCard';
import MetricsBar from '../../ui/MetricsBar';
import ResourceTimeline from '../../ui/ResourceTimeline';
import SmartTable from '../../ui/SmartTable';
import TrendSparkline from '../../ui/TrendSparkline';
import { ContextualFAB } from '../../ui/QuickActionFAB';
import { useThemeDensity, densityConfigs } from '../../../../hooks/useThemeDensity';
import DensityControl from '../../ui/DensityControl';
import TimelineVisualization from '../TimelineVisualization';
import TimelineSkeleton from '../TimelineSkeleton';

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

// Track definitions
const tracks = {
  encounters: { label: 'Encounters', color: 'primary' },
  conditions: { label: 'Conditions & Allergies', color: 'warning' },
  medications: { label: 'Medications', color: 'secondary' },
  labs: { label: 'Labs & Diagnostics', color: 'info' },
  procedures: { label: 'Procedures', color: 'info' },
  immunizations: { label: 'Immunizations', color: 'success' },
  imaging: { label: 'Imaging', color: 'secondary' },
  care: { label: 'Care Plans & Goals', color: 'primary' },
  documents: { label: 'Documents', color: 'inherit' },
  workflow: { label: 'Workflow Events', color: 'info' },
  administrative: { label: 'Administrative', color: 'inherit' }
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

// Enhanced timeline event component
const EnhancedTimelineEvent = ({ event, onClick, density, isHovered, onHover }) => {
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

  const densityConfig = densityConfigs[density];
  
  return (
    <Tooltip 
      title={
        <Box>
          <Typography variant="subtitle2">{getEventTitle()}</Typography>
          <Typography variant="caption">
            {getEventDate(event) ? format(parseISO(getEventDate(event)), 'MMM d, yyyy h:mm a') : 'No date'}
          </Typography>
        </Box>
      }
      placement="top"
    >
      <Box
        onClick={() => onClick(event)}
        onMouseEnter={() => onHover(event.id)}
        onMouseLeave={() => onHover(null)}
        sx={{
          cursor: 'pointer',
          transition: 'all 0.2s',
          transform: isHovered ? 'scale(1.1)' : 'scale(1)',
          opacity: isHovered ? 1 : 0.8,
          zIndex: isHovered ? 10 : 1
        }}
      >
        <Avatar
          sx={{
            width: densityConfig.iconSize === 'small' ? 24 : densityConfig.iconSize === 'medium' ? 32 : 40,
            height: densityConfig.iconSize === 'small' ? 24 : densityConfig.iconSize === 'medium' ? 32 : 40,
            bgcolor: eventType.color === 'inherit' ? 'grey.300' : `${eventType.color}.main`,
            boxShadow: isHovered ? theme.shadows[4] : theme.shadows[1]
          }}
        >
          {React.cloneElement(eventType.icon, { 
            fontSize: densityConfig.iconSize 
          })}
        </Avatar>
      </Box>
    </Tooltip>
  );
};

// Multi-track timeline component
const MultiTrackTimeline = ({ events, dateRange, zoom, density, onEventClick, hoveredEvent, onEventHover }) => {
  const theme = useTheme();
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });
  
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({ width, height });
      }
    };
    
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);
  
  // Group events by track
  const eventsByTrack = useMemo(() => {
    const grouped = {};
    Object.keys(tracks).forEach(track => {
      grouped[track] = [];
    });
    
    events.forEach(event => {
      const eventType = eventTypes[event.resourceType];
      if (eventType?.track && grouped[eventType.track]) {
        grouped[eventType.track].push(event);
      }
    });
    
    return grouped;
  }, [events]);
  
  // Calculate timeline scale
  const timeScale = useMemo(() => {
    const startTime = dateRange.start.getTime();
    const endTime = dateRange.end.getTime();
    const duration = endTime - startTime;
    const pixelsPerMs = (dimensions.width - 150) / duration; // 150px for track labels
    
    return (date) => {
      const time = new Date(date).getTime();
      const offset = (time - startTime) * pixelsPerMs;
      return 150 + offset; // Add label width
    };
  }, [dateRange, dimensions.width]);
  
  // Calculate date markers
  const dateMarkers = useMemo(() => {
    const days = differenceInDays(dateRange.end, dateRange.start);
    const interval = days > 365 ? 'month' : days > 90 ? 'week' : days > 7 ? 'day' : 'hour';
    
    const markers = [];
    let current = startOfDay(dateRange.start);
    
    while (current <= dateRange.end) {
      markers.push({
        date: current,
        label: format(current, interval === 'month' ? 'MMM yyyy' : interval === 'week' ? 'MMM d' : 'MMM d'),
        x: timeScale(current)
      });
      
      current = interval === 'month' ? addDays(current, 30) :
                interval === 'week' ? addDays(current, 7) :
                interval === 'day' ? addDays(current, 1) :
                addDays(current, 1/24);
    }
    
    return markers;
  }, [dateRange, timeScale]);
  
  const trackHeight = density === 'compact' ? 40 : density === 'comfortable' ? 60 : 80;
  const eventSize = density === 'compact' ? 24 : density === 'comfortable' ? 32 : 40;
  
  return (
    <Box 
      ref={containerRef}
      sx={{ 
        position: 'relative',
        width: '100%',
        height: Object.keys(tracks).length * trackHeight + 100,
        overflow: 'hidden',
        bgcolor: 'background.paper',
        borderRadius: 0,
        border: 1,
        borderColor: 'divider'
      }}
    >
      {/* Date markers */}
      <Box sx={{ 
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 40,
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'background.default'
      }}>
        {dateMarkers.map((marker, idx) => (
          <Box
            key={idx}
            sx={{
              position: 'absolute',
              left: marker.x,
              top: 0,
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              px: 1
            }}
          >
            <Typography variant="caption" color="text.secondary">
              {marker.label}
            </Typography>
          </Box>
        ))}
      </Box>
      
      {/* Tracks */}
      {Object.entries(tracks).map(([trackId, track], trackIndex) => {
        const trackEvents = eventsByTrack[trackId] || [];
        const y = 40 + trackIndex * trackHeight;
        
        return (
          <Box
            key={trackId}
            sx={{
              position: 'absolute',
              top: y,
              left: 0,
              right: 0,
              height: trackHeight,
              borderBottom: 1,
              borderColor: 'divider',
              '&:hover': {
                bgcolor: alpha(theme.palette.primary.main, 0.02)
              }
            }}
          >
            {/* Track label */}
            <Box
              sx={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: 150,
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                px: 2,
                bgcolor: 'background.paper',
                borderRight: 1,
                borderColor: 'divider',
                zIndex: 5
              }}
            >
              <Typography variant="body2" fontWeight={500}>
                {track.label}
              </Typography>
              {trackEvents.length > 0 && (
                <Chip 
                  label={trackEvents.length} 
                  size="small" 
                  sx={{ ml: 1, height: 20 }}
                />
              )}
            </Box>
            
            {/* Track events */}
            {trackEvents.map((event, idx) => {
              const eventDate = getEventDate(event);
              if (!eventDate) return null;
              
              const x = timeScale(eventDate);
              const isHovered = hoveredEvent === event.id;
              
              return (
                <Box
                  key={`${event.id}-${idx}`}
                  sx={{
                    position: 'absolute',
                    left: x - eventSize / 2,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    zIndex: isHovered ? 10 : 1
                  }}
                >
                  <EnhancedTimelineEvent
                    event={event}
                    onClick={onEventClick}
                    density={density}
                    isHovered={isHovered}
                    onHover={onEventHover}
                  />
                </Box>
              );
            })}
          </Box>
        );
      })}
      
      {/* Current time indicator */}
      <Box
        sx={{
          position: 'absolute',
          left: timeScale(new Date()),
          top: 40,
          bottom: 0,
          width: 2,
          bgcolor: 'error.main',
          zIndex: 3,
          '&::before': {
            content: '""',
            position: 'absolute',
            top: -5,
            left: -4,
            width: 10,
            height: 10,
            borderRadius: '50%',
            bgcolor: 'error.main'
          }
        }}
      />
    </Box>
  );
};

const TimelineTabEnhanced = ({ patientId, patient, density: propDensity }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [themeDensity] = useThemeDensity();
  const density = propDensity || themeDensity;
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  
  const { 
    resources, 
    fetchPatientEverything,
    isResourceLoading, 
    currentPatient
  } = useFHIRResource();
  const { subscribe, notifications } = useClinicalWorkflow();
  
  // State
  const [viewMode, setViewMode] = useState('multi-track'); // 'multi-track', 'single-track', 'list'
  const [filterPeriod, setFilterPeriod] = useState('1y');
  const [selectedTypes, setSelectedTypes] = useState(new Set(Object.keys(eventTypes)));
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [showFilters, setShowFilters] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [hoveredEvent, setHoveredEvent] = useState(null);
  const [workflowEvents, setWorkflowEvents] = useState([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [hasLoadedInitialData, setHasLoadedInitialData] = useState(false);
  const [loadingError, setLoadingError] = useState(null);
  
  // Use ref to track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  // Date range based on filter period
  const dateRange = useMemo(() => {
    const end = new Date();
    const periodMap = {
      '7d': subDays(end, 7),
      '30d': subDays(end, 30),
      '90d': subDays(end, 90),
      '6m': subMonths(end, 6),
      '1y': subYears(end, 1),
      '5y': subYears(end, 5),
      'all': subYears(end, 50)
    };
    
    return {
      start: periodMap[filterPeriod] || subYears(end, 1),
      end: end
    };
  }, [filterPeriod]);
  
  // Load timeline data
  useEffect(() => {
    const loadData = async () => {
      if (!patientId) return;
      
      try {
        setLoadingError(null);
        console.log('Timeline: Starting data load for patient', patientId);
        
        // Start with a smaller count for better performance
        const options = {
          types: Array.from(selectedTypes),
          count: 100 // Reduced from 500
        };
        
        // Only add 'since' parameter if not fetching all data
        if (filterPeriod !== 'all') {
          const periodMap = {
            '7d': subDays(new Date(), 7),
            '30d': subDays(new Date(), 30),
            '90d': subDays(new Date(), 90),
            '6m': subMonths(new Date(), 6),
            '1y': subYears(new Date(), 1),
            '5y': subYears(new Date(), 5)
          };
          const startDate = periodMap[filterPeriod];
          if (startDate) {
            options.since = startDate.toISOString().split('T')[0];
          }
        }
        
        const result = await fetchPatientEverything(patientId, options);
        console.log('Timeline: Data loaded successfully', result);
        
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
    
    // Only load once when component mounts or patient changes
    if (!hasLoadedInitialData) {
      loadData();
    }
  }, [patientId, selectedTypes, filterPeriod, fetchPatientEverything, hasLoadedInitialData]);
  
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
      } else if (resources[resourceType]) {
        const patientResources = Object.values(resources[resourceType] || {}).filter(r => 
          resourceBelongsToPatient(r, patientId)
        );
        
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
      if (date < dateRange.start || date > dateRange.end) {
        return false;
      }
      
      // Search filter
      if (debouncedSearchTerm) {
        const searchLower = debouncedSearchTerm.toLowerCase();
        const searchableText = JSON.stringify(event).toLowerCase();
        if (!searchableText.includes(searchLower)) {
          return false;
        }
      }
      
      return true;
    });
  }, [allEvents, dateRange, debouncedSearchTerm]);
  
  // Sort events by date and prepare for visualization
  const sortedEvents = useMemo(() => {
    return [...filteredEvents]
      .map(event => ({
        ...event,
        title: getEventTitle(event),
        date: getEventDate(event)
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
  
  // Calculate metrics
  const metrics = useMemo(() => {
    const byType = {};
    sortedEvents.forEach(event => {
      byType[event.resourceType] = (byType[event.resourceType] || 0) + 1;
    });
    
    const topTypes = Object.entries(byType)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([type, count]) => {
        const config = eventTypes[type];
        return {
          label: config?.label || type,
          value: count,
          color: config?.color || 'default',
          icon: config?.icon
        };
      });
    
    return topTypes;
  }, [sortedEvents]);
  
  // Quick actions
  const quickActions = [
    {
      icon: <PrintIcon />,
      label: 'Print Timeline',
      onClick: handlePrintTimeline
    },
    {
      icon: <RefreshIcon />,
      label: 'Refresh',
      onClick: async () => {
        try {
          setHasLoadedInitialData(false);
          setLoadingError(null);
          await fetchPatientEverything(patientId, {
            types: Array.from(selectedTypes),
            count: 100,
            forceRefresh: true
          });
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
      }
    }
  ];
  
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
    content += `<p>Period: ${format(dateRange.start, 'MMM d, yyyy')} - ${format(dateRange.end, 'MMM d, yyyy')}</p>`;
    content += `<p>Total Events: ${sortedEvents.length}</p>`;
    
    // Group by track for printing
    const eventsByTrack = {};
    sortedEvents.forEach(event => {
      const eventType = eventTypes[event.resourceType];
      const track = eventType?.track || 'other';
      if (!eventsByTrack[track]) {
        eventsByTrack[track] = [];
      }
      eventsByTrack[track].push(event);
    });
    
    Object.entries(tracks).forEach(([trackId, track]) => {
      const trackEvents = eventsByTrack[trackId];
      if (!trackEvents || trackEvents.length === 0) return;
      
      content += `<h3>${track.label} (${trackEvents.length})</h3>`;
      content += '<ul>';
      
      trackEvents.forEach(event => {
        const date = getEventDate(event);
        const dateStr = date ? format(parseISO(date), 'MMM d, yyyy h:mm a') : 'No date';
        const title = getEventTitle(event);
        content += `<li><strong>${dateStr}</strong> - ${title}</li>`;
      });
      
      content += '</ul>';
    });
    
    printDocument({
      title: 'Clinical Timeline',
      patient: patientInfo,
      content
    });
  }
  
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
    const resourceTypeToTab = {
      'Encounter': 'encounters',
      'MedicationRequest': 'chart',
      'MedicationStatement': 'chart',
      'Observation': 'results',
      'Condition': 'chart',
      'AllergyIntolerance': 'chart',
      'Immunization': 'chart',
      'ImagingStudy': 'imaging',
      'DocumentReference': 'documentation',
      'Goal': 'care-plan',
      'CarePlan': 'care-plan',
      'CareTeam': 'care-plan',
      'Procedure': 'chart',
      'DiagnosticReport': 'results'
    };
    
    const tab = resourceTypeToTab[event.resourceType];
    const patientId = event.subject?.reference?.split('/')[1] || event.patient?.reference?.split('/')[1];
    
    if (tab && patientId) {
      navigate(`/clinical/${patientId}?tab=${tab}&resourceId=${event.id}&resourceType=${event.resourceType}`);
    }
  }
  
  // Use isResourceLoading from context instead of local loading state
  const loading = isResourceLoading('Patient') || isResourceLoading('Observation') || isResourceLoading('Encounter');
  
  if (loading && !hasLoadedInitialData) {
    return (
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Skeleton variant="rectangular" height={80} sx={{ mb: 2 }} />
        <TimelineSkeleton density={density} />
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
      {/* Metrics Bar */}
      <MetricsBar metrics={metrics} density={density} />
      
      {/* Controls */}
      <Paper sx={{ p: isMobile ? 1 : 2, mb: 2 }}>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
            <TextField
              placeholder="Search timeline..."
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
                onChange={(e) => {
                  setFilterPeriod(e.target.value);
                }}
                label="Period"
              >
                <MenuItem value="7d">Last 7 Days</MenuItem>
                <MenuItem value="30d">Last 30 Days</MenuItem>
                <MenuItem value="90d">Last 90 Days</MenuItem>
                <MenuItem value="6m">Last 6 Months</MenuItem>
                <MenuItem value="1y">Last Year</MenuItem>
                <MenuItem value="5y">Last 5 Years</MenuItem>
                <MenuItem value="all">All Time</MenuItem>
              </Select>
            </FormControl>
            
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={(e, v) => v && setViewMode(v)}
              size="small"
            >
              <ToggleButton value="multi-track">
                <Tooltip title="Multi-track View">
                  <MultiTrackIcon />
                </Tooltip>
              </ToggleButton>
              <ToggleButton value="single-track">
                <Tooltip title="Single Track">
                  <SingleTrackIcon />
                </Tooltip>
              </ToggleButton>
              <ToggleButton value="list">
                <Tooltip title="List View">
                  <ListViewIcon />
                </Tooltip>
              </ToggleButton>
            </ToggleButtonGroup>
            
            <DensityControl />
            
            <Button
              variant="outlined"
              startIcon={showFilters ? <ExpandLessIcon /> : <FilterIcon />}
              onClick={() => setShowFilters(!showFilters)}
            >
              Filters ({selectedTypes.size})
            </Button>
          </Stack>
          
          {/* Zoom controls are now integrated in TimelineVisualization component */}
          
          {/* Event type filters */}
          <Collapse in={showFilters}>
            <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 0 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="subtitle2">Event Types</Typography>
                <Stack direction="row" spacing={1}>
                  <Button 
                    size="small" 
                    onClick={() => setSelectedTypes(new Set(Object.keys(eventTypes)))}
                  >
                    Select All
                  </Button>
                  <Button 
                    size="small" 
                    onClick={() => setSelectedTypes(new Set())}
                  >
                    Clear All
                  </Button>
                </Stack>
              </Stack>
              <FormGroup row>
                {Object.entries(eventTypes).map(([type, config]) => (
                  <FormControlLabel
                    key={type}
                    control={
                      <Checkbox
                        checked={selectedTypes.has(type)}
                        onChange={(e) => {
                          const newTypes = new Set(selectedTypes);
                          if (e.target.checked) {
                            newTypes.add(type);
                          } else {
                            newTypes.delete(type);
                          }
                          setSelectedTypes(newTypes);
                        }}
                        color={config.color === 'inherit' ? 'default' : config.color}
                      />
                    }
                    label={
                      <Stack direction="row" spacing={1} alignItems="center">
                        {config.icon}
                        <span>{config.label}</span>
                      </Stack>
                    }
                  />
                ))}
              </FormGroup>
            </Box>
          </Collapse>
        </Stack>
      </Paper>
      
      {/* Content Area */}
      <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {sortedEvents.length === 0 ? (
          <Alert severity="info" sx={{ m: 2 }}>
            No events found in the selected time period
          </Alert>
        ) : viewMode === 'multi-track' ? (
          <Box sx={{ height: '100%', p: isMobile ? 0 : 2 }}>
            <TimelineVisualization
              events={sortedEvents}
              height={isMobile ? 400 : isTablet ? 500 : 600}
              onEventClick={handleEventClick}
              selectedEventId={hoveredEvent}
              density={density}
            />
          </Box>
        ) : viewMode === 'single-track' ? (
          <Box>
            <ResourceTimeline
              resources={sortedEvents.map(event => ({
                id: event.id,
                date: getEventDate(event),
                type: event.resourceType,
                title: getEventTitle(event),
                resource: event
              }))}
              height={400}
              onResourceClick={(resource) => handleEventClick(resource.resource)}
            />
          </Box>
        ) : (
          // List view
          <SmartTable
            columns={[
              {
                id: 'date',
                label: 'Date',
                render: (row) => {
                  const date = getEventDate(row);
                  return date ? format(parseISO(date), 'MMM d, yyyy h:mm a') : 'No date';
                }
              },
              {
                id: 'type',
                label: 'Type',
                render: (row) => {
                  const config = eventTypes[row.resourceType];
                  return (
                    <Stack direction="row" spacing={1} alignItems="center">
                      {config?.icon}
                      <Chip label={config?.label || row.resourceType} size="small" />
                    </Stack>
                  );
                }
              },
              {
                id: 'title',
                label: 'Event',
                render: (row) => getEventTitle(row)
              },
              {
                id: 'track',
                label: 'Category',
                render: (row) => {
                  const eventType = eventTypes[row.resourceType];
                  const track = tracks[eventType?.track];
                  return track ? track.label : 'Other';
                }
              }
            ]}
            data={sortedEvents}
            density={density}
            onRowClick={handleEventClick}
          />
        )}
      </Box>
      
      {/* Contextual FAB */}
      <ContextualFAB
        module="timeline"
        actions={quickActions}
        density={density}
      />
      
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

export default React.memo(TimelineTabEnhanced);