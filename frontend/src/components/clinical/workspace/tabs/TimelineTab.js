/**
 * Timeline Tab Component
 * Chronological view of all patient events
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Stack,
  Chip,
  Button,
  IconButton,
  TextField,
  InputAdornment,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  CardActions,
  Collapse,
  FormGroup,
  FormControlLabel,
  Checkbox,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  useTheme,
  alpha
} from '@mui/material';
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineOppositeContent
} from '@mui/lab';
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
  CreditCard as InsuranceIcon
} from '@mui/icons-material';
import { format, parseISO, isWithinInterval, subDays, subMonths, subYears, startOfDay, endOfDay } from 'date-fns';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import { useNavigate } from 'react-router-dom';
import { useDebounce } from '../../../../hooks/useDebounce';
import { printDocument } from '../../../../utils/printUtils';
import { useClinicalWorkflow, CLINICAL_EVENTS } from '../../../../contexts/ClinicalWorkflowContext';

// Event type configuration
const eventTypes = {
  'Encounter': { icon: <EncounterIcon />, color: 'primary', label: 'Visit' },
  'MedicationRequest': { icon: <MedicationIcon />, color: 'secondary', label: 'Medication' },
  'MedicationStatement': { icon: <MedicationIcon />, color: 'secondary', label: 'Medication' },
  'Observation': { icon: <LabIcon />, color: 'info', label: 'Lab Result' },
  'Condition': { icon: <ConditionIcon />, color: 'warning', label: 'Diagnosis' },
  'AllergyIntolerance': { icon: <AllergyIcon />, color: 'error', label: 'Allergy' },
  'Immunization': { icon: <ImmunizationIcon />, color: 'success', label: 'Immunization' },
  'Procedure': { icon: <ProcedureIcon />, color: 'info', label: 'Procedure' },
  'DiagnosticReport': { icon: <LabIcon />, color: 'info', label: 'Report' },
  'ImagingStudy': { icon: <ImagingIcon />, color: 'secondary', label: 'Imaging' },
  'DocumentReference': { icon: <NoteIcon />, color: 'inherit', label: 'Note' },
  'CarePlan': { icon: <PlanIcon />, color: 'primary', label: 'Care Plan' },
  'CareTeam': { icon: <TeamIcon />, color: 'primary', label: 'Care Team' },
  'Coverage': { icon: <InsuranceIcon />, color: 'inherit', label: 'Insurance' },
  'Goal': { icon: <GoalIcon />, color: 'primary', label: 'Goal' },
  'WorkflowEvent': { icon: <EventIcon />, color: 'info', label: 'Workflow Event' }
};

// Get event date
const getEventDate = (event) => {
  // Try different date fields based on resource type
  switch (event.resourceType) {
    case 'Procedure':
      return event.performedDateTime || 
             event.performedPeriod?.start || 
             event.performedPeriod?.end ||
             event.occurrenceDateTime ||
             event.occurrencePeriod?.start ||
             event.date ||
             event.recordedDate ||
             null; // Don't fall back to meta.lastUpdated for procedures
             
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
             
    case 'AllergyIntolerance':
      return event.onsetDateTime ||
             event.onsetPeriod?.start ||
             event.recordedDate ||
             event.assertedDate ||
             null;
             
    case 'Immunization':
      return event.occurrenceDateTime ||
             event.occurrenceString ||
             event.date ||
             null;
             
    case 'DiagnosticReport':
      return event.effectiveDateTime ||
             event.effectivePeriod?.start ||
             event.issued ||
             null;
             
    case 'ImagingStudy':
      return event.started ||
             event.date ||
             null;
             
    case 'DocumentReference':
      return event.date ||
             event.created ||
             event.indexed ||
             null;
             
    case 'CarePlan':
      return event.period?.start ||
             event.created ||
             event.date ||
             null;
             
    case 'Goal':
      return event.startDate ||
             event.target?.[0]?.dueDate ||
             event.statusDate ||
             null;
             
    case 'WorkflowEvent':
      return event.date || event.data?.timestamp || null;
             
    default:
      // Generic fallback for other resource types
      return event.effectiveDateTime || 
             event.authoredOn || 
             event.dateTime ||
             event.date ||
             event.period?.start ||
             event.recordedDate ||
             null; // Avoid using meta.lastUpdated as it's not a clinical date
  }
};

// Timeline Event Component
const TimelineEvent = ({ event, position, isFirst, isLast }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [hover, setHover] = useState(false);
  
  const eventType = eventTypes[event.resourceType] || { 
    icon: <EventIcon />, 
    color: 'inherit', 
    label: event.resourceType 
  };
  
  const eventDate = getEventDate(event);
  
  const getEventTitle = () => {
    switch (event.resourceType) {
      case 'Encounter':
        return event.type?.[0]?.text || event.type?.[0]?.coding?.[0]?.display || 'Encounter';
      case 'MedicationRequest':
        return event.medicationCodeableConcept?.text || 
               event.medicationCodeableConcept?.coding?.[0]?.display ||
               'Medication';
      case 'Observation':
        return event.code?.text || event.code?.coding?.[0]?.display || 'Observation';
      case 'Condition':
        return event.code?.text || event.code?.coding?.[0]?.display || 'Condition';
      case 'AllergyIntolerance':
        return event.code?.text || event.code?.coding?.[0]?.display || 'Allergy';
      case 'Immunization':
        return event.vaccineCode?.text || event.vaccineCode?.coding?.[0]?.display || 'Immunization';
      case 'ImagingStudy':
        return event.description || 'Imaging Study';
      case 'DocumentReference':
        return event.type?.text || event.type?.coding?.[0]?.display || 'Document';
      case 'Goal':
        return event.description?.text || 'Goal';
      case 'WorkflowEvent':
        // Return a descriptive title based on event type
        switch (event.eventType) {
          case CLINICAL_EVENTS.ORDER_PLACED:
            return 'Order Placed';
          case CLINICAL_EVENTS.RESULT_RECEIVED:
            return 'Result Received';
          case CLINICAL_EVENTS.MEDICATION_DISPENSED:
            return 'Medication Dispensed';
          case CLINICAL_EVENTS.DOCUMENTATION_CREATED:
            return event.data?.isUpdate ? 'Note Updated' : 'Note Created';
          case CLINICAL_EVENTS.PROBLEM_ADDED:
            return 'Problem Added';
          case CLINICAL_EVENTS.CRITICAL_ALERT:
            return 'Critical Alert';
          case CLINICAL_EVENTS.WORKFLOW_NOTIFICATION:
            return 'Workflow Update';
          default:
            return event.eventType;
        }
      default:
        return event.resourceType;
    }
  };

  const getEventSubtitle = () => {
    switch (event.resourceType) {
      case 'Encounter':
        const provider = event.participant?.find(p => 
          p.type?.[0]?.coding?.[0]?.code === 'ATND'
        )?.individual?.display;
        return provider || event.status;
      case 'MedicationRequest':
        return event.dosageInstruction?.[0]?.text || event.status;
      case 'Observation':
        return event.valueQuantity ? 
          `${event.valueQuantity.value} ${event.valueQuantity.unit}` :
          event.valueString || 'Result pending';
      case 'Condition':
        return event.severity?.text || event.clinicalStatus?.coding?.[0]?.code || 'Active';
      case 'AllergyIntolerance':
        return event.criticality || 'Documented';
      case 'Immunization':
        return event.status || 'Completed';
      case 'WorkflowEvent':
        // Return event-specific subtitle
        if (event.data?.message) {
          return event.data.message;
        }
        switch (event.eventType) {
          case CLINICAL_EVENTS.ORDER_PLACED:
            return event.data?.orderType || 'Order';
          case CLINICAL_EVENTS.MEDICATION_DISPENSED:
            return event.data?.medicationName || 'Medication';
          case CLINICAL_EVENTS.DOCUMENTATION_CREATED:
            return event.data?.noteType || 'Document';
          case CLINICAL_EVENTS.WORKFLOW_NOTIFICATION:
            return `${event.data?.workflowType}: ${event.data?.step}`;
          default:
            return event.data?.description || '';
        }
      default:
        return '';
    }
  };

  const handleClick = () => {
    // Navigate to appropriate tab in clinical workspace based on resource type
    const resourceTypeToTab = {
      'Encounter': 'encounters',
      'MedicationRequest': 'chart',  // Medications are in Chart Review tab
      'MedicationStatement': 'chart',
      'Observation': 'results',
      'Condition': 'chart',  // Conditions are in Chart Review tab
      'AllergyIntolerance': 'chart',  // Allergies are in Chart Review tab
      'Immunization': 'chart',  // Immunizations could be in Chart Review
      'ImagingStudy': 'imaging',
      'DocumentReference': 'documentation',
      'Goal': 'careplan',
      'CarePlan': 'careplan',
      'CareTeam': 'careplan',
      'Procedure': 'chart',
      'DiagnosticReport': 'results'
    };
    
    const tab = resourceTypeToTab[event.resourceType];
    const patientId = event.subject?.reference?.split('/')[1];
    
    if (tab && patientId) {
      // Navigate to clinical workspace with the specific tab selected
      navigate(`/clinical/${patientId}?tab=${tab}&resourceId=${event.id}&resourceType=${event.resourceType}`);
    }
  };

  const subtitle = getEventSubtitle();

  return (
    <TimelineItem>
      <TimelineOppositeContent 
        sx={{ 
          flex: '0 0 140px',
          textAlign: 'right',
          pr: 2
        }}
      >
        <Typography 
          variant="body2" 
          sx={{ 
            fontWeight: 500,
            color: hover ? 'primary.main' : 'text.primary'
          }}
        >
          {eventDate ? format(parseISO(eventDate), 'MMM d, yyyy') : 'No date'}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {eventDate ? format(parseISO(eventDate), 'h:mm a') : ''}
        </Typography>
      </TimelineOppositeContent>
      
      <TimelineSeparator>
        <TimelineConnector 
          sx={{ 
            visibility: isFirst ? 'hidden' : 'visible',
            bgcolor: theme.palette.divider ? alpha(theme.palette.divider, 0.5) : 'rgba(0,0,0,0.12)'
          }} 
        />
        <Tooltip title={`View ${eventType.label} details`} placement="left">
          <TimelineDot 
            color={eventType.color === 'inherit' ? 'grey' : eventType.color} 
            sx={{ 
              cursor: 'pointer',
              transition: 'all 0.2s',
              '&:hover': {
                transform: 'scale(1.2)',
                boxShadow: theme.shadows[4]
              }
            }}
            onClick={handleClick}
          >
            {eventType.icon}
          </TimelineDot>
        </Tooltip>
        <TimelineConnector 
          sx={{ 
            visibility: isLast ? 'hidden' : 'visible',
            bgcolor: theme.palette.divider ? alpha(theme.palette.divider, 0.5) : 'rgba(0,0,0,0.12)'
          }} 
        />
      </TimelineSeparator>
      
      <TimelineContent sx={{ py: 2, px: 2 }}>
        <Paper
          elevation={hover ? 3 : 1}
          sx={{ 
            p: 2,
            cursor: 'pointer',
            transition: 'all 0.2s',
            '&:hover': {
              transform: 'translateX(4px)',
              boxShadow: theme.shadows[3]
            }
          }}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          onClick={handleClick}
        >
          <Stack spacing={0.5}>
            <Typography 
              variant="subtitle1" 
              sx={{ 
                fontWeight: 600,
                color: hover ? 'primary.main' : 'text.primary'
              }}
            >
              {getEventTitle()}
            </Typography>
            
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip 
                label={eventType.label} 
                size="small" 
                color={eventType.color === 'inherit' ? 'default' : eventType.color}
                sx={{ height: 20 }}
              />
              {subtitle && (
                <Typography variant="caption" color="text.secondary">
                  • {subtitle}
                </Typography>
              )}
            </Stack>
          </Stack>
        </Paper>
      </TimelineContent>
    </TimelineItem>
  );
};

const TimelineTab = ({ patientId, onNotificationUpdate }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { getPatientResources, isLoading, currentPatient } = useFHIRResource();
  const { subscribe, notifications } = useClinicalWorkflow();
  
  const [viewMode, setViewMode] = useState('timeline'); // 'timeline' or 'compact'
  const [filterPeriod, setFilterPeriod] = useState('all');
  const [selectedTypes, setSelectedTypes] = useState(new Set(Object.keys(eventTypes)));
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300); // 300ms delay
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20); // Start with 20 items
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [workflowEvents, setWorkflowEvents] = useState([]);

  useEffect(() => {
    setLoading(false);
  }, []);

  // Subscribe to all clinical workflow events
  useEffect(() => {
    const unsubscribers = [];
    
    // Subscribe to all event types
    Object.values(CLINICAL_EVENTS).forEach(eventType => {
      const unsubscribe = subscribe(eventType, (eventData) => {
        // Add the event to our workflow events
        const workflowEvent = {
          id: `workflow-${Date.now()}-${Math.random()}`,
          resourceType: 'WorkflowEvent',
          eventType: eventType,
          date: eventData.timestamp || new Date().toISOString(),
          data: eventData,
          patientId: eventData.patientId
        };
        
        // Only add events for the current patient
        if (eventData.patientId === patientId) {
          setWorkflowEvents(prev => [...prev, workflowEvent]);
        }
      });
      
      unsubscribers.push(unsubscribe);
    });
    
    // Cleanup subscriptions on unmount
    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, [subscribe, patientId]);

  // Memoized collection of all events to prevent recalculation on every render
  const allEvents = useMemo(() => {
    const events = [];
    const seenIds = new Set(); // Track unique IDs to prevent duplicates
    
    // Add all resource types
    Object.keys(eventTypes).forEach(resourceType => {
      if (resourceType === 'WorkflowEvent') {
        // Add workflow events from state
        workflowEvents.forEach(event => {
          const uniqueKey = `${event.resourceType}-${event.id}`;
          if (!seenIds.has(uniqueKey)) {
            seenIds.add(uniqueKey);
            events.push(event);
          }
        });
      } else {
        // Add FHIR resources
        const resources = getPatientResources(patientId, resourceType) || [];
        resources.forEach(resource => {
          const uniqueKey = `${resource.resourceType}-${resource.id}`;
          if (!seenIds.has(uniqueKey)) {
            seenIds.add(uniqueKey);
            events.push(resource);
          }
        });
      }
    });

    return events;
  }, [patientId, getPatientResources, workflowEvents]); // Recalculate when patientId, resources, or workflow events update

  // Optimized search function that doesn't use JSON.stringify
  const isEventMatchingSearch = useCallback((event, term) => {
    if (!term) return true;
    const lowerTerm = term.toLowerCase();
    
    // Search in specific fields instead of entire JSON
    const searchableFields = [
      event.code?.text,
      event.code?.coding?.[0]?.display,
      event.type?.[0]?.text,
      event.type?.[0]?.coding?.[0]?.display,
      event.medicationCodeableConcept?.text,
      event.medicationCodeableConcept?.coding?.[0]?.display,
      event.vaccineCode?.text,
      event.vaccineCode?.coding?.[0]?.display,
      event.description,
      event.resourceType,
      // WorkflowEvent fields
      event.eventType,
      event.data?.message,
      event.data?.noteType,
      event.data?.medicationName,
      event.data?.workflowType
    ];
    
    return searchableFields.some(field => 
      field && field.toLowerCase().includes(lowerTerm)
    );
  }, []);

  // Memoized filtering and sorting to prevent recalculation
  const filteredEvents = useMemo(() => {
    return allEvents.filter(event => {
      // Type filter
      if (!selectedTypes.has(event.resourceType)) {
        return false;
      }

      // Period filter
      if (filterPeriod !== 'all') {
        const eventDate = getEventDate(event);
        if (!eventDate) {
          // Exclude events without dates when filtering by period
          return false;
        }
        
        const date = parseISO(eventDate);
        const periodMap = {
          '7d': subDays(new Date(), 7),
          '30d': subDays(new Date(), 30),
          '90d': subDays(new Date(), 90),
          '6m': subMonths(new Date(), 6),
          '1y': subYears(new Date(), 1),
          '5y': subYears(new Date(), 5)
        };
        if (!isWithinInterval(date, {
          start: periodMap[filterPeriod],
          end: new Date()
        })) {
          return false;
        }
      }

      // Optimized search filter with debounced search term
      return isEventMatchingSearch(event, debouncedSearchTerm);
    });
  }, [allEvents, selectedTypes, filterPeriod, debouncedSearchTerm, isEventMatchingSearch]);

  // Memoized sorting to prevent recalculation
  const sortedEvents = useMemo(() => {
    return [...filteredEvents].sort((a, b) => {
      const dateA = getEventDate(a);
      const dateB = getEventDate(b);
      
      // Handle cases where one or both dates are null
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1; // Put items without dates at the end
      if (!dateB) return -1; // Put items without dates at the end
      
      return new Date(dateB) - new Date(dateA);
    });
  }, [filteredEvents]);

  const handleTypeToggle = (type) => {
    const newTypes = new Set(selectedTypes);
    if (newTypes.has(type)) {
      newTypes.delete(type);
    } else {
      newTypes.add(type);
    }
    setSelectedTypes(newTypes);
  };

  const selectAllTypes = () => {
    setSelectedTypes(new Set(Object.keys(eventTypes)));
  };

  const deselectAllTypes = () => {
    setSelectedTypes(new Set());
  };

  const handlePrintTimeline = () => {
    const patientInfo = {
      name: currentPatient ? 
        `${currentPatient.name?.[0]?.given?.join(' ') || ''} ${currentPatient.name?.[0]?.family || ''}`.trim() : 
        'Unknown Patient',
      mrn: currentPatient?.identifier?.find(id => id.type?.coding?.[0]?.code === 'MR')?.value || currentPatient?.id,
      birthDate: currentPatient?.birthDate,
      gender: currentPatient?.gender,
      phone: currentPatient?.telecom?.find(t => t.system === 'phone')?.value
    };
    
    let content = '<h2>Clinical Timeline</h2>';
    content += `<p>Showing ${sortedEvents.length} events${filterPeriod !== 'all' ? ` from the last ${filterPeriod}` : ''}</p>`;
    
    // Group events by date
    const eventsByDate = {};
    sortedEvents.forEach(event => {
      const eventDate = getEventDate(event);
      const dateKey = eventDate ? format(parseISO(eventDate), 'MMMM d, yyyy') : 'Unknown Date';
      if (!eventsByDate[dateKey]) eventsByDate[dateKey] = [];
      eventsByDate[dateKey].push(event);
    });
    
    // Generate content for each date
    Object.entries(eventsByDate).forEach(([date, events]) => {
      content += `<h3>${date}</h3>`;
      content += '<table class="avoid-break">';
      content += '<thead><tr><th>Time</th><th>Type</th><th>Event</th><th>Details</th></tr></thead>';
      content += '<tbody>';
      
      events.forEach(event => {
        const eventType = eventTypes[event.resourceType] || { label: event.resourceType };
        const eventDate = getEventDate(event);
        const time = eventDate ? format(parseISO(eventDate), 'h:mm a') : '';
        
        let title = '';
        let details = '';
        
        switch (event.resourceType) {
          case 'Encounter':
            title = event.type?.[0]?.text || event.type?.[0]?.coding?.[0]?.display || 'Encounter';
            details = event.participant?.find(p => p.type?.[0]?.coding?.[0]?.code === 'ATND')?.individual?.display || '';
            break;
          case 'MedicationRequest':
            title = event.medicationCodeableConcept?.text || event.medicationCodeableConcept?.coding?.[0]?.display || 'Medication';
            details = event.dosageInstruction?.[0]?.text || '';
            break;
          case 'Observation':
            title = event.code?.text || event.code?.coding?.[0]?.display || 'Observation';
            details = event.valueQuantity ? `${event.valueQuantity.value} ${event.valueQuantity.unit}` : event.valueString || '';
            break;
          case 'Condition':
            title = event.code?.text || event.code?.coding?.[0]?.display || 'Condition';
            details = event.clinicalStatus?.coding?.[0]?.code || '';
            break;
          case 'AllergyIntolerance':
            title = event.code?.text || event.code?.coding?.[0]?.display || 'Allergy';
            details = event.criticality || '';
            break;
          case 'Goal':
            title = event.description?.text || 'Goal';
            details = event.lifecycleStatus || '';
            break;
          default:
            title = event.resourceType;
            details = '';
        }
        
        content += '<tr>';
        content += `<td>${time}</td>`;
        content += `<td>${eventType.label}</td>`;
        content += `<td>${title}</td>`;
        content += `<td>${details}</td>`;
        content += '</tr>';
      });
      
      content += '</tbody></table>';
    });
    
    printDocument({
      title: 'Clinical Timeline',
      patient: patientInfo,
      content
    });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight="bold">
          Clinical Timeline
        </Typography>
        <Stack direction="row" spacing={2}>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(e, newMode) => newMode && setViewMode(newMode)}
            size="small"
          >
            <ToggleButton value="timeline">
              <TimelineIcon />
            </ToggleButton>
            <ToggleButton value="compact">
              <DateRangeIcon />
            </ToggleButton>
          </ToggleButtonGroup>
          <Button
            variant="outlined"
            startIcon={<PrintIcon />}
            onClick={handlePrintTimeline}
          >
            Print
          </Button>
        </Stack>
      </Stack>

      {/* Summary */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <TodayIcon color="action" />
          <Typography variant="body1">
            Showing {sortedEvents.length} events
            {filterPeriod !== 'all' && ` from the last ${filterPeriod}`}
          </Typography>
          <Chip 
            label={`${allEvents.length} total events`} 
            size="small" 
            color="primary"
          />
        </Stack>
      </Paper>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              placeholder="Search events..."
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
              <InputLabel>Time Period</InputLabel>
              <Select
                value={filterPeriod}
                onChange={(e) => setFilterPeriod(e.target.value)}
                label="Time Period"
              >
                <MenuItem value="all">All Time</MenuItem>
                <MenuItem value="7d">Last 7 Days</MenuItem>
                <MenuItem value="30d">Last 30 Days</MenuItem>
                <MenuItem value="90d">Last 90 Days</MenuItem>
                <MenuItem value="6m">Last 6 Months</MenuItem>
                <MenuItem value="1y">Last Year</MenuItem>
                <MenuItem value="5y">Last 5 Years</MenuItem>
              </Select>
            </FormControl>

            <Button
              variant="outlined"
              startIcon={showFilters ? <ExpandLessIcon /> : <FilterIcon />}
              onClick={() => setShowFilters(!showFilters)}
            >
              Event Types ({selectedTypes.size})
            </Button>
          </Stack>

          <Collapse in={showFilters}>
            <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="subtitle2">Filter by Event Type</Typography>
                <Stack direction="row" spacing={1}>
                  <Button size="small" onClick={selectAllTypes}>Select All</Button>
                  <Button size="small" onClick={deselectAllTypes}>Clear All</Button>
                </Stack>
              </Stack>
              <FormGroup row>
                {Object.entries(eventTypes).map(([type, config]) => (
                  <FormControlLabel
                    key={type}
                    control={
                      <Checkbox
                        checked={selectedTypes.has(type)}
                        onChange={() => handleTypeToggle(type)}
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

      {/* Timeline Display */}
      {sortedEvents.length === 0 ? (
        <Alert severity="info">
          No events found matching your criteria
        </Alert>
      ) : viewMode === 'timeline' ? (
        <Box sx={{ 
          position: 'relative',
          '&::before': {
            content: '""',
            position: 'absolute',
            left: '140px',
            top: 0,
            bottom: 0,
            width: '2px',
            bgcolor: theme.palette.divider ? alpha(theme.palette.divider, 0.3) : 'rgba(0,0,0,0.08)',
            zIndex: 0
          }
        }}>
          <Timeline position="right">
            {sortedEvents.slice(0, visibleCount).map((event, index) => (
              <TimelineEvent 
                key={`${event.resourceType}-${event.id}-${index}`} 
                event={event}
                isFirst={index === 0}
                isLast={index === Math.min(visibleCount, sortedEvents.length) - 1}
              />
            ))}
          </Timeline>
          
          {/* Load More Button */}
          {visibleCount < sortedEvents.length && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
              <Button 
                variant="outlined" 
                onClick={() => {
                  setIsLoadingMore(true);
                  // Simulate async loading with setTimeout to prevent UI blocking
                  setTimeout(() => {
                    setVisibleCount(prev => Math.min(prev + 20, sortedEvents.length));
                    setIsLoadingMore(false);
                  }, 100);
                }}
                disabled={isLoadingMore}
                startIcon={isLoadingMore ? <CircularProgress size={16} /> : null}
              >
                {isLoadingMore ? 'Loading...' : `Load More (${sortedEvents.length - visibleCount} remaining)`}
              </Button>
            </Box>
          )}
        </Box>
      ) : (
        // Compact view
        <Stack spacing={1}>
          {sortedEvents.map((event, index) => {
            const eventType = eventTypes[event.resourceType];
            const eventDate = getEventDate(event);
            
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
              'Goal': 'careplan',
              'CarePlan': 'careplan',
              'CareTeam': 'careplan',
              'Procedure': 'chart',
              'DiagnosticReport': 'results'
            };
            
            const tab = resourceTypeToTab[event.resourceType];
            const patientId = event.subject?.reference?.split('/')[1];
            const handleNavigate = () => {
              if (tab && patientId) {
                navigate(`/clinical/${patientId}?tab=${tab}&resourceId=${event.id}&resourceType=${event.resourceType}`);
              }
            };
            
            const getTitle = () => {
              switch (event.resourceType) {
                case 'Encounter':
                  return event.type?.[0]?.text || event.type?.[0]?.coding?.[0]?.display || 'Encounter';
                case 'MedicationRequest':
                  return event.medicationCodeableConcept?.text || 
                         event.medicationCodeableConcept?.coding?.[0]?.display || 'Medication';
                case 'Observation':
                  return event.code?.text || event.code?.coding?.[0]?.display || 'Observation';
                case 'Condition':
                  return event.code?.text || event.code?.coding?.[0]?.display || 'Condition';
                case 'AllergyIntolerance':
                  return event.code?.text || event.code?.coding?.[0]?.display || 'Allergy';
                case 'Immunization':
                  return event.vaccineCode?.text || event.vaccineCode?.coding?.[0]?.display || 'Immunization';
                case 'ImagingStudy':
                  return event.description || 'Imaging Study';
                case 'DocumentReference':
                  return event.type?.text || event.type?.coding?.[0]?.display || 'Document';
                case 'Goal':
                  return event.description?.text || 'Goal';
                default:
                  return event.resourceType;
              }
            };
            
            return (
              <Paper 
                key={`${event.resourceType}-${event.id}-${index}`} 
                sx={{ 
                  p: 1.5,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': {
                    boxShadow: theme.shadows[2],
                    bgcolor: theme.palette.primary?.main ? alpha(theme.palette.primary.main, 0.02) : 'rgba(25,118,210,0.02)'
                  }
                }}
                onClick={handleNavigate}
              >
                <Stack direction="row" spacing={2} alignItems="center">
                  <Box 
                    sx={{ 
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      bgcolor: eventType?.color && eventType.color !== 'inherit' && theme.palette[eventType.color] && theme.palette[eventType.color].main
                        ? alpha(theme.palette[eventType.color].main, 0.1)
                        : alpha(theme.palette.grey[300], 0.1),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: eventType?.color && eventType.color !== 'inherit' && theme.palette[eventType.color] && theme.palette[eventType.color].main
                        ? theme.palette[eventType.color].main
                        : theme.palette.grey[700]
                    }}
                  >
                    {eventType?.icon}
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" fontWeight={500}>
                      {getTitle()}
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="caption" color="text.secondary">
                        {eventDate ? format(parseISO(eventDate), 'MMM d, yyyy') : 'No date'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">•</Typography>
                      <Chip 
                        label={eventType?.label} 
                        size="small" 
                        sx={{ height: 16, fontSize: '0.7rem' }}
                      />
                    </Stack>
                  </Box>
                  <IconButton size="small">
                    <ExpandMoreIcon />
                  </IconButton>
                </Stack>
              </Paper>
            );
          })}
        </Stack>
      )}
    </Box>
  );
};


export default TimelineTab;