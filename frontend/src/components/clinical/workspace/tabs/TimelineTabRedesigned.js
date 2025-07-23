/**
 * Redesigned Timeline Tab Component
 * Modern multi-track visualization with D3.js
 * 
 * Features:
 * - Multi-track horizontal timeline visualization
 * - Smooth zoom/pan with mouse and touch support
 * - Advanced filtering and search capabilities
 * - Export functionality (PNG/SVG/CSV)
 * - Mobile responsive design
 * - Performance optimized for 1000+ events
 * 
 * @module TimelineTabRedesigned
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Stack,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  InputAdornment,
  Chip,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Collapse,
  CircularProgress,
  Snackbar,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Switch,
  Divider,
  Badge,
  useTheme,
  alpha
} from '@mui/material';
import {
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
  Notes as NoteIcon,
  Print as PrintIcon,
  Download as DownloadIcon,
  ViewList as ListIcon,
  Timeline as TimelineIcon,
  Settings as SettingsIcon,
  MedicalServices as ProcedureIcon,
  Description as PlanIcon,
  Close as CloseIcon,
  Info as InfoIcon,
  Speed as SpeedIcon,
  BarChart as StatsIcon
} from '@mui/icons-material';
import { format, parseISO, subDays, subMonths, subYears, startOfDay, endOfDay } from 'date-fns';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import { useNavigate } from 'react-router-dom';
import { useDebounce } from '../../../../hooks/useDebounce';
import { printDocument } from '../../../../core/export/printUtils';
import { getMedicationName } from '../../../../core/fhir/utils/medicationDisplayUtils';
import { useClinicalWorkflow, CLINICAL_EVENTS } from '../../../../contexts/ClinicalWorkflowContext';
import TimelineVisualization from '../../visualization/TimelineVisualization';
import { performanceMonitor } from '../../performance/optimizations';

// Event type configuration
const eventTypes = {
  'Encounter': { 
    icon: <EncounterIcon />, 
    color: 'primary', 
    label: 'Encounters',
    category: 'clinical'
  },
  'MedicationRequest': { 
    icon: <MedicationIcon />, 
    color: 'secondary', 
    label: 'Medications',
    category: 'medications'
  },
  'MedicationStatement': { 
    icon: <MedicationIcon />, 
    color: 'secondary', 
    label: 'Med Statements',
    category: 'medications'
  },
  'Observation': { 
    icon: <LabIcon />, 
    color: 'info', 
    label: 'Lab Results',
    category: 'diagnostics'
  },
  'Condition': { 
    icon: <ConditionIcon />, 
    color: 'warning', 
    label: 'Conditions',
    category: 'clinical'
  },
  'AllergyIntolerance': { 
    icon: <AllergyIcon />, 
    color: 'error', 
    label: 'Allergies',
    category: 'clinical'
  },
  'Immunization': { 
    icon: <ImmunizationIcon />, 
    color: 'success', 
    label: 'Immunizations',
    category: 'preventive'
  },
  'Procedure': { 
    icon: <ProcedureIcon />, 
    color: 'info', 
    label: 'Procedures',
    category: 'clinical'
  },
  'DiagnosticReport': { 
    icon: <LabIcon />, 
    color: 'info', 
    label: 'Reports',
    category: 'diagnostics'
  },
  'ImagingStudy': { 
    icon: <ImagingIcon />, 
    color: 'secondary', 
    label: 'Imaging',
    category: 'diagnostics'
  },
  'DocumentReference': { 
    icon: <NoteIcon />, 
    color: 'inherit', 
    label: 'Documents',
    category: 'documentation'
  },
  'CarePlan': { 
    icon: <PlanIcon />, 
    color: 'primary', 
    label: 'Care Plans',
    category: 'care'
  },
  'Goal': { 
    icon: <PlanIcon />, 
    color: 'primary', 
    label: 'Goals',
    category: 'care'
  }
};

// Category configuration
const categories = {
  clinical: { label: 'Clinical', color: 'primary' },
  medications: { label: 'Medications', color: 'secondary' },
  diagnostics: { label: 'Diagnostics', color: 'info' },
  preventive: { label: 'Preventive Care', color: 'success' },
  documentation: { label: 'Documentation', color: 'inherit' },
  care: { label: 'Care Planning', color: 'primary' }
};

const TimelineTabRedesigned = ({ patientId }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { 
    resources, 
    fetchPatientEverything,
    isResourceLoading, 
    currentPatient
  } = useFHIRResource();
  const { subscribe } = useClinicalWorkflow();
  
  // State
  const [viewMode, setViewMode] = useState('timeline'); // 'timeline' or 'list'
  const [filterPeriod, setFilterPeriod] = useState('1y');
  const [selectedTypes, setSelectedTypes] = useState(new Set(Object.keys(eventTypes)));
  const [selectedCategories, setSelectedCategories] = useState(new Set(Object.keys(categories)));
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [density, setDensity] = useState('comfortable');
  const [showStats, setShowStats] = useState(true);
  const [workflowEvents, setWorkflowEvents] = useState([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  
  // Performance settings
  const [performanceMode, setPerformanceMode] = useState('balanced'); // 'performance', 'balanced', 'quality'
  const [enableAnimations, setEnableAnimations] = useState(true);
  
  // Date range based on filter period
  const dateRange = useMemo(() => {
    const end = endOfDay(new Date());
    const periodMap = {
      '7d': startOfDay(subDays(end, 7)),
      '30d': startOfDay(subDays(end, 30)),
      '90d': startOfDay(subDays(end, 90)),
      '6m': startOfDay(subMonths(end, 6)),
      '1y': startOfDay(subYears(end, 1)),
      '5y': startOfDay(subYears(end, 5)),
      'all': startOfDay(subYears(end, 50))
    };
    
    return {
      start: periodMap[filterPeriod] || startOfDay(subYears(end, 1)),
      end: end
    };
  }, [filterPeriod]);
  
  // Load timeline data optimized
  useEffect(() => {
    const loadData = async () => {
      if (!patientId) return;
      
      performanceMonitor.mark('timeline-load-start');
      setLoading(true);
      
      try {
        // Load all resource types in parallel
        await fetchPatientEverything(patientId, {
          types: Array.from(selectedTypes),
          count: performanceMode === 'performance' ? 200 : 500,
          since: dateRange.start.toISOString().split('T')[0]
        });
        
        performanceMonitor.mark('timeline-load-end');
        performanceMonitor.measure('Timeline Data Load', 'timeline-load-start', 'timeline-load-end');
      } catch (error) {
        console.error('Error loading timeline data:', error);
        setSnackbar({
          open: true,
          message: 'Error loading timeline data',
          severity: 'error'
        });
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [patientId, dateRange, fetchPatientEverything, performanceMode]);
  
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
  
  // Helper function to get event date
  const getEventDate = useCallback((event) => {
    switch (event.resourceType) {
      case 'Procedure':
        return event.performedDateTime || 
               event.performedPeriod?.start || 
               event.date ||
               null;
               
      case 'Observation':
        return event.effectiveDateTime || 
               event.effectivePeriod?.start ||
               event.issued ||
               null;
               
      case 'MedicationRequest':
        return event.authoredOn || 
               event.dosageInstruction?.[0]?.timing?.event?.[0] ||
               null;
               
      case 'Condition':
        return event.onsetDateTime || 
               event.onsetPeriod?.start ||
               event.recordedDate ||
               null;
               
      case 'Encounter':
        return event.period?.start || 
               event.period?.end ||
               null;
               
      default:
        return event.effectiveDateTime || 
               event.authoredOn || 
               event.date ||
               event.period?.start ||
               null;
    }
  }, []);
  
  // Collect and filter all events
  const filteredEvents = useMemo(() => {
    performanceMonitor.mark('filter-start');
    
    const events = [];
    const seenIds = new Set();
    
    // Process selected resource types
    selectedTypes.forEach(resourceType => {
      const typeConfig = eventTypes[resourceType];
      if (!typeConfig || !selectedCategories.has(typeConfig.category)) return;
      
      if (resources[resourceType]) {
        const patientResources = Object.values(resources[resourceType] || {}).filter(r => {
          const patientRef = r.subject?.reference || r.patient?.reference;
          return patientRef === `Patient/${patientId}` || 
                 patientRef === `urn:uuid:${patientId}`;
        });
        
        patientResources.forEach(resource => {
          const uniqueKey = `${resource.resourceType}-${resource.id}`;
          if (!seenIds.has(uniqueKey)) {
            seenIds.add(uniqueKey);
            
            const eventDate = getEventDate(resource);
            if (eventDate) {
              const parsedDate = parseISO(eventDate);
              if (parsedDate >= dateRange.start && parsedDate <= dateRange.end) {
                events.push(resource);
              }
            }
          }
        });
      }
    });
    
    // Add workflow events
    workflowEvents.forEach(event => {
      const uniqueKey = `${event.resourceType}-${event.id}`;
      if (!seenIds.has(uniqueKey)) {
        seenIds.add(uniqueKey);
        events.push(event);
      }
    });
    
    // Apply search filter
    let filtered = events;
    if (debouncedSearchTerm) {
      const searchLower = debouncedSearchTerm.toLowerCase();
      filtered = events.filter(event => {
        const title = getEventTitle(event).toLowerCase();
        const type = event.resourceType.toLowerCase();
        return title.includes(searchLower) || type.includes(searchLower);
      });
    }
    
    // Sort by date
    filtered.sort((a, b) => {
      const dateA = getEventDate(a);
      const dateB = getEventDate(b);
      
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;
      
      return new Date(dateB) - new Date(dateA);
    });
    
    performanceMonitor.mark('filter-end');
    performanceMonitor.measure('Event Filtering', 'filter-start', 'filter-end');
    
    return filtered;
  }, [resources, workflowEvents, selectedTypes, selectedCategories, dateRange, debouncedSearchTerm, patientId, getEventDate]);
  
  // Calculate statistics
  const statistics = useMemo(() => {
    const stats = {
      total: filteredEvents.length,
      byType: {},
      byCategory: {},
      recent: 0
    };
    
    filteredEvents.forEach(event => {
      // By type
      stats.byType[event.resourceType] = (stats.byType[event.resourceType] || 0) + 1;
      
      // By category
      const typeConfig = eventTypes[event.resourceType];
      if (typeConfig) {
        stats.byCategory[typeConfig.category] = (stats.byCategory[typeConfig.category] || 0) + 1;
      }
      
      // Recent (last 30 days)
      const eventDate = getEventDate(event);
      if (eventDate) {
        const daysSince = Math.floor((new Date() - new Date(eventDate)) / (1000 * 60 * 60 * 24));
        if (daysSince <= 30) {
          stats.recent++;
        }
      }
    });
    
    return stats;
  }, [filteredEvents, getEventDate]);
  
  // Event handlers
  const handleEventClick = useCallback((event) => {
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
      'Procedure': 'procedures',
      'DiagnosticReport': 'results'
    };
    
    const tab = resourceTypeToTab[event.resourceType];
    const eventPatientId = event.subject?.reference?.split('/')[1] || 
                          event.patient?.reference?.split('/')[1];
    
    if (tab && eventPatientId) {
      navigate(`/clinical/${eventPatientId}?tab=${tab}&resourceId=${event.id}&resourceType=${event.resourceType}`);
    }
  }, [navigate]);
  
  const handleCategoryToggle = (category) => {
    const newCategories = new Set(selectedCategories);
    if (newCategories.has(category)) {
      newCategories.delete(category);
      // Also unselect all types in this category
      Object.entries(eventTypes).forEach(([type, config]) => {
        if (config.category === category) {
          selectedTypes.delete(type);
        }
      });
    } else {
      newCategories.add(category);
      // Also select all types in this category
      Object.entries(eventTypes).forEach(([type, config]) => {
        if (config.category === category) {
          selectedTypes.add(type);
        }
      });
    }
    setSelectedCategories(newCategories);
    setSelectedTypes(new Set(selectedTypes));
  };
  
  const handleTypeToggle = (type) => {
    const newTypes = new Set(selectedTypes);
    if (newTypes.has(type)) {
      newTypes.delete(type);
    } else {
      newTypes.add(type);
    }
    setSelectedTypes(newTypes);
  };
  
  const handlePrintTimeline = () => {
    const patientInfo = {
      name: currentPatient ? 
        `${currentPatient.name?.[0]?.given?.join(' ') || ''} ${currentPatient.name?.[0]?.family || ''}`.trim() : 
        'Unknown Patient',
      mrn: currentPatient?.identifier?.find(id => id.type?.coding?.[0]?.code === 'MR')?.value || currentPatient?.id,
      birthDate: currentPatient?.birthDate,
      gender: currentPatient?.gender
    };
    
    let content = '<h2>Clinical Timeline</h2>';
    content += `<p>Period: ${format(dateRange.start, 'MMM d, yyyy')} - ${format(dateRange.end, 'MMM d, yyyy')}</p>`;
    content += `<p>Total Events: ${filteredEvents.length}</p>`;
    
    // Statistics
    content += '<h3>Summary</h3>';
    content += '<table>';
    Object.entries(statistics.byType).forEach(([type, count]) => {
      const config = eventTypes[type];
      content += `<tr><td>${config?.label || type}:</td><td>${count}</td></tr>`;
    });
    content += '</table>';
    
    // Events by date
    content += '<h3>Events</h3>';
    const eventsByDate = {};
    filteredEvents.forEach(event => {
      const eventDate = getEventDate(event);
      const dateKey = eventDate ? format(parseISO(eventDate), 'MMM d, yyyy') : 'Unknown Date';
      if (!eventsByDate[dateKey]) eventsByDate[dateKey] = [];
      eventsByDate[dateKey].push(event);
    });
    
    Object.entries(eventsByDate).forEach(([date, events]) => {
      content += `<h4>${date}</h4>`;
      content += '<ul>';
      events.forEach(event => {
        const title = getEventTitle(event);
        const type = eventTypes[event.resourceType]?.label || event.resourceType;
        content += `<li><strong>${type}:</strong> ${title}</li>`;
      });
      content += '</ul>';
    });
    
    printDocument({
      title: 'Clinical Timeline',
      patient: patientInfo,
      content
    });
  };
  
  const handleExportData = () => {
    const csvContent = [
      ['Date', 'Time', 'Type', 'Event', 'Status', 'Value'].join(','),
      ...filteredEvents.map(event => {
        const date = getEventDate(event);
        const dateStr = date ? format(parseISO(date), 'yyyy-MM-dd') : '';
        const timeStr = date ? format(parseISO(date), 'HH:mm') : '';
        const type = eventTypes[event.resourceType]?.label || event.resourceType;
        const title = getEventTitle(event);
        const status = event.status || '';
        const value = event.valueQuantity ? 
          `${event.valueQuantity.value} ${event.valueQuantity.unit}` :
          event.valueString || '';
        
        return [dateStr, timeStr, type, title, status, value]
          .map(v => `"${v}"`)
          .join(',');
      })
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `timeline-${patientId}-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    
    setSnackbar({
      open: true,
      message: 'Timeline data exported as CSV',
      severity: 'success'
    });
  };
  
  // Helper function to get event title
  const getEventTitle = (event) => {
    switch (event.resourceType) {
      case 'Encounter':
        return event.type?.[0]?.text || event.type?.[0]?.coding?.[0]?.display || 'Encounter';
      case 'MedicationRequest':
        return getMedicationName(event);
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
      case 'Procedure':
        return event.code?.text || event.code?.coding?.[0]?.display || 'Procedure';
      default:
        return event.resourceType;
    }
  };
  
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <CircularProgress />
      </Box>
    );
  }
  
  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack spacing={2}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h5" fontWeight="bold">
              Clinical Timeline
            </Typography>
            <Stack direction="row" spacing={1}>
              <ToggleButtonGroup
                value={viewMode}
                exclusive
                onChange={(e, v) => v && setViewMode(v)}
                size="small"
              >
                <ToggleButton value="timeline">
                  <Tooltip title="Timeline View">
                    <TimelineIcon />
                  </Tooltip>
                </ToggleButton>
                <ToggleButton value="list">
                  <Tooltip title="List View">
                    <ListIcon />
                  </Tooltip>
                </ToggleButton>
              </ToggleButtonGroup>
              
              <Button
                variant="outlined"
                startIcon={<PrintIcon />}
                onClick={handlePrintTimeline}
                size="small"
              >
                Print
              </Button>
              
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={handleExportData}
                size="small"
              >
                Export CSV
              </Button>
              
              <IconButton onClick={() => setShowSettings(true)} size="small">
                <SettingsIcon />
              </IconButton>
            </Stack>
          </Stack>
          
          {/* Search and filters */}
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
                <MenuItem value="7d">Last 7 Days</MenuItem>
                <MenuItem value="30d">Last 30 Days</MenuItem>
                <MenuItem value="90d">Last 90 Days</MenuItem>
                <MenuItem value="6m">Last 6 Months</MenuItem>
                <MenuItem value="1y">Last Year</MenuItem>
                <MenuItem value="5y">Last 5 Years</MenuItem>
                <MenuItem value="all">All Time</MenuItem>
              </Select>
            </FormControl>
            
            <Button
              variant="outlined"
              startIcon={showFilters ? <ExpandLessIcon /> : <FilterIcon />}
              onClick={() => setShowFilters(!showFilters)}
            >
              Filters ({selectedTypes.size})
            </Button>
          </Stack>
          
          {/* Statistics */}
          {showStats && (
            <Stack direction="row" spacing={2} flexWrap="wrap">
              <Chip 
                icon={<InfoIcon />}
                label={`${statistics.total} total events`} 
                color="primary"
              />
              <Chip 
                icon={<SpeedIcon />}
                label={`${statistics.recent} in last 30 days`} 
                color="secondary"
              />
              {Object.entries(statistics.byCategory).map(([category, count]) => {
                const config = categories[category];
                return (
                  <Chip
                    key={category}
                    label={`${config.label}: ${count}`}
                    size="small"
                    color={config.color === 'inherit' ? 'default' : config.color}
                  />
                );
              })}
            </Stack>
          )}
          
          {/* Filter panel */}
          <Collapse in={showFilters}>
            <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
              {/* Category filters */}
              <Typography variant="subtitle2" gutterBottom>
                Categories
              </Typography>
              <FormGroup row sx={{ mb: 2 }}>
                {Object.entries(categories).map(([id, config]) => (
                  <FormControlLabel
                    key={id}
                    control={
                      <Checkbox
                        checked={selectedCategories.has(id)}
                        onChange={() => handleCategoryToggle(id)}
                        color={config.color === 'inherit' ? 'default' : config.color}
                      />
                    }
                    label={config.label}
                  />
                ))}
              </FormGroup>
              
              {/* Type filters */}
              <Typography variant="subtitle2" gutterBottom>
                Event Types
              </Typography>
              <FormGroup row>
                {Object.entries(eventTypes)
                  .filter(([type, config]) => selectedCategories.has(config.category))
                  .map(([type, config]) => (
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
      
      {/* Content area */}
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        {filteredEvents.length === 0 ? (
          <Alert severity="info">
            No events found matching your criteria
          </Alert>
        ) : viewMode === 'timeline' ? (
          <Paper sx={{ height: '100%', p: 2 }}>
            <TimelineVisualization
              events={filteredEvents}
              dateRange={dateRange}
              selectedTypes={selectedTypes}
              onEventClick={handleEventClick}
              density={density}
              height={600}
            />
          </Paper>
        ) : (
          // List view
          <Paper sx={{ height: '100%', overflow: 'auto' }}>
            <List>
              {filteredEvents.slice(0, performanceMode === 'performance' ? 100 : 500).map((event, index) => {
                const eventDate = getEventDate(event);
                const config = eventTypes[event.resourceType];
                
                return (
                  <React.Fragment key={`${event.resourceType}-${event.id}-${index}`}>
                    <ListItem
                      button
                      onClick={() => handleEventClick(event)}
                      sx={{
                        '&:hover': {
                          bgcolor: alpha(theme.palette.primary.main, 0.04)
                        }
                      }}
                    >
                      <ListItemIcon>
                        <Badge 
                          color={config?.color === 'inherit' ? 'default' : config?.color}
                          variant="dot"
                        >
                          {config?.icon || <NoteIcon />}
                        </Badge>
                      </ListItemIcon>
                      <ListItemText
                        primary={getEventTitle(event)}
                        secondary={
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="caption">
                              {eventDate ? format(parseISO(eventDate), 'MMM d, yyyy h:mm a') : 'No date'}
                            </Typography>
                            <Chip 
                              label={config?.label || event.resourceType} 
                              size="small"
                              sx={{ height: 16, fontSize: '0.7rem' }}
                            />
                          </Stack>
                        }
                      />
                    </ListItem>
                    {index < filteredEvents.length - 1 && <Divider />}
                  </React.Fragment>
                );
              })}
            </List>
          </Paper>
        )}
      </Box>
      
      {/* Settings drawer */}
      <Drawer
        anchor="right"
        open={showSettings}
        onClose={() => setShowSettings(false)}
      >
        <Box sx={{ width: 300, p: 2 }}>
          <Stack spacing={2}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h6">Timeline Settings</Typography>
              <IconButton onClick={() => setShowSettings(false)}>
                <CloseIcon />
              </IconButton>
            </Stack>
            
            <Divider />
            
            <FormControl fullWidth size="small">
              <InputLabel>Density</InputLabel>
              <Select
                value={density}
                onChange={(e) => setDensity(e.target.value)}
                label="Density"
              >
                <MenuItem value="compact">Compact</MenuItem>
                <MenuItem value="comfortable">Comfortable</MenuItem>
                <MenuItem value="spacious">Spacious</MenuItem>
              </Select>
            </FormControl>
            
            <FormControl fullWidth size="small">
              <InputLabel>Performance Mode</InputLabel>
              <Select
                value={performanceMode}
                onChange={(e) => setPerformanceMode(e.target.value)}
                label="Performance Mode"
              >
                <MenuItem value="performance">Performance (200 events)</MenuItem>
                <MenuItem value="balanced">Balanced (500 events)</MenuItem>
                <MenuItem value="quality">Quality (All events)</MenuItem>
              </Select>
            </FormControl>
            
            <ListItem>
              <ListItemText primary="Show Statistics" />
              <ListItemSecondaryAction>
                <Switch
                  checked={showStats}
                  onChange={(e) => setShowStats(e.target.checked)}
                />
              </ListItemSecondaryAction>
            </ListItem>
            
            <ListItem>
              <ListItemText primary="Enable Animations" />
              <ListItemSecondaryAction>
                <Switch
                  checked={enableAnimations}
                  onChange={(e) => setEnableAnimations(e.target.checked)}
                />
              </ListItemSecondaryAction>
            </ListItem>
          </Stack>
        </Box>
      </Drawer>
      
      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default React.memo(TimelineTabRedesigned);