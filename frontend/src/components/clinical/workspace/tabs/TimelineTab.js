/**
 * Timeline Tab Component
 * Chronological view of all patient events
 */
import React, { useState, useEffect } from 'react';
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
  Event as EventIcon
} from '@mui/icons-material';
import { format, parseISO, isWithinInterval, subDays, subMonths, subYears, startOfDay, endOfDay } from 'date-fns';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import { useNavigate } from 'react-router-dom';

// Event type configuration
const eventTypes = {
  'Encounter': { icon: <EncounterIcon />, color: 'primary', label: 'Visit' },
  'MedicationRequest': { icon: <MedicationIcon />, color: 'secondary', label: 'Medication' },
  'Observation': { icon: <LabIcon />, color: 'info', label: 'Lab Result' },
  'Condition': { icon: <ConditionIcon />, color: 'warning', label: 'Diagnosis' },
  'AllergyIntolerance': { icon: <AllergyIcon />, color: 'error', label: 'Allergy' },
  'Immunization': { icon: <ImmunizationIcon />, color: 'success', label: 'Immunization' },
  'ImagingStudy': { icon: <ImagingIcon />, color: 'secondary', label: 'Imaging' },
  'DocumentReference': { icon: <NoteIcon />, color: 'default', label: 'Note' },
  'Goal': { icon: <GoalIcon />, color: 'primary', label: 'Goal' }
};

// Get event date
const getEventDate = (event) => {
  // Try different date fields based on resource type
  return event.effectiveDateTime || 
         event.authoredOn || 
         event.dateTime ||
         event.occurrenceDateTime ||
         event.date ||
         event.period?.start ||
         event.recordedDate ||
         event.meta?.lastUpdated ||
         null;
};

// Timeline Event Component
const TimelineEvent = ({ event, position, isFirst, isLast }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [hover, setHover] = useState(false);
  
  const eventType = eventTypes[event.resourceType] || { 
    icon: <EventIcon />, 
    color: 'default', 
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
      default:
        return '';
    }
  };

  const handleClick = () => {
    // Navigate to appropriate detail view based on resource type
    const resourceTypeToPath = {
      'Encounter': 'encounters',
      'MedicationRequest': 'medications',
      'Observation': 'results',
      'Condition': 'problems',
      'AllergyIntolerance': 'allergies',
      'Immunization': 'immunizations',
      'ImagingStudy': 'imaging',
      'DocumentReference': 'notes',
      'Goal': 'goals'
    };
    
    const path = resourceTypeToPath[event.resourceType];
    if (path) {
      navigate(`/patients/${event.subject?.reference?.split('/')[1]}/${path}/${event.id}`);
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
            bgcolor: alpha(theme.palette.divider, 0.5)
          }} 
        />
        <Tooltip title={`View ${eventType.label} details`} placement="left">
          <TimelineDot 
            color={eventType.color} 
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
            bgcolor: alpha(theme.palette.divider, 0.5)
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
                color={eventType.color}
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
  const { getPatientResources, isLoading } = useFHIRResource();
  
  const [viewMode, setViewMode] = useState('timeline'); // 'timeline' or 'compact'
  const [filterPeriod, setFilterPeriod] = useState('all');
  const [selectedTypes, setSelectedTypes] = useState(new Set(Object.keys(eventTypes)));
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    setLoading(false);
  }, []);

  // Collect all events from different resource types
  const collectAllEvents = () => {
    const events = [];
    
    // Add all resource types
    Object.keys(eventTypes).forEach(resourceType => {
      const resources = getPatientResources(patientId, resourceType) || [];
      events.push(...resources);
    });

    // Also add vital signs as separate events
    const observations = getPatientResources(patientId, 'Observation') || [];
    const vitalSigns = observations.filter(o => 
      o.category?.[0]?.coding?.[0]?.code === 'vital-signs'
    );
    events.push(...vitalSigns);

    return events;
  };

  const allEvents = collectAllEvents();

  // Filter events
  const filteredEvents = allEvents.filter(event => {
    // Type filter
    if (!selectedTypes.has(event.resourceType)) {
      return false;
    }

    // Period filter
    if (filterPeriod !== 'all') {
      const eventDate = getEventDate(event);
      if (eventDate) {
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
    }

    // Search filter
    if (searchTerm) {
      const searchableText = JSON.stringify(event).toLowerCase();
      if (!searchableText.includes(searchTerm.toLowerCase())) {
        return false;
      }
    }

    return true;
  });

  // Sort events by date
  const sortedEvents = [...filteredEvents].sort((a, b) => {
    const dateA = getEventDate(a);
    const dateB = getEventDate(b);
    if (!dateA || !dateB) return 0;
    return new Date(dateB) - new Date(dateA);
  });

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
                        color={config.color}
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
            bgcolor: alpha(theme.palette.divider, 0.3),
            zIndex: 0
          }
        }}>
          <Timeline position="right">
            {sortedEvents.map((event, index) => (
              <TimelineEvent 
                key={`${event.resourceType}-${event.id}`} 
                event={event}
                isFirst={index === 0}
                isLast={index === sortedEvents.length - 1}
              />
            ))}
          </Timeline>
        </Box>
      ) : (
        // Compact view
        <Stack spacing={1}>
          {sortedEvents.map((event) => {
            const eventType = eventTypes[event.resourceType];
            const eventDate = getEventDate(event);
            
            const resourceTypeToPath = {
              'Encounter': 'encounters',
              'MedicationRequest': 'medications',
              'Observation': 'results',
              'Condition': 'problems',
              'AllergyIntolerance': 'allergies',
              'Immunization': 'immunizations',
              'ImagingStudy': 'imaging',
              'DocumentReference': 'notes',
              'Goal': 'goals'
            };
            
            const path = resourceTypeToPath[event.resourceType];
            const handleNavigate = () => {
              if (path) {
                navigate(`/patients/${event.subject?.reference?.split('/')[1]}/${path}/${event.id}`);
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
                key={`${event.resourceType}-${event.id}`} 
                sx={{ 
                  p: 1.5,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': {
                    boxShadow: theme.shadows[2],
                    bgcolor: alpha(theme.palette.primary.main, 0.02)
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
                      bgcolor: alpha(theme.palette[eventType?.color || 'default'].main, 0.1),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: theme.palette[eventType?.color || 'default'].main
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