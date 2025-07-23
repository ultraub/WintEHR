/**
 * Enhanced Timeline Tab with D3.js Visualization
 * Advanced multi-track timeline with zoom/pan capabilities
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
  FormGroup,
  FormControlLabel,
  Checkbox,
  Collapse,
  Badge,
  CircularProgress,
  Slider,
  Menu,
  ListItemIcon,
  ListItemText,
  ButtonGroup
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
  Download as DownloadIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon
} from '@mui/icons-material';
import { format, parseISO, isWithinInterval, subDays, subMonths, subYears, startOfDay, endOfDay, differenceInDays, addDays, eachDayOfInterval } from 'date-fns';
import * as d3 from 'd3';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import { useNavigate } from 'react-router-dom';
import { useDebounce } from '../../../../hooks/useDebounce';
import { printDocument } from '../../../../core/export/printUtils';
import { getMedicationName, getMedicationDosageDisplay } from '../../../../core/fhir/utils/medicationDisplayUtils';
import { useClinicalWorkflow, CLINICAL_EVENTS } from '../../../../contexts/ClinicalWorkflowContext';
import { resourceBelongsToPatient } from '../../../../utils/fhirReferenceUtils';

// Import UI components
import ClinicalCard from '../../ui/ClinicalCard';
import MetricsBar from '../../ui/MetricsBar';
import ResourceTimeline from '../../ui/ResourceTimeline';
import SmartTable from '../../ui/SmartTable';
import TrendSparkline from '../../ui/TrendSparkline';
import { ContextualFAB } from '../../ui/QuickActionFAB';
import { useThemeDensity, densityConfigs } from '../../../../hooks/useThemeDensity';
import DensityControl from '../../ui/DensityControl';

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

// Enhanced D3 Timeline Component
const EnhancedD3Timeline = ({ events, dateRange, zoom, density, onEventClick, hoveredEvent, onEventHover }) => {
  const theme = useTheme();
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const tooltipRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [currentTransform, setCurrentTransform] = useState(d3.zoomIdentity);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Constants
  const MARGIN = { top: 60, right: 40, bottom: 40, left: 180 };
  const TRACK_HEIGHT = 50;
  const TRACK_PADDING = 10;
  const EVENT_RADIUS = density === 'compact' ? 4 : 6;
  const MIN_ZOOM = 0.1;
  const MAX_ZOOM = 50;

  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width } = containerRef.current.getBoundingClientRect();
        const trackCount = Object.keys(tracks).length;
        const height = trackCount * (TRACK_HEIGHT + TRACK_PADDING) + MARGIN.top + MARGIN.bottom + 100;
        setDimensions({ width, height });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Group events by track
  const trackData = useMemo(() => {
    const grouped = {};
    Object.keys(tracks).forEach(trackId => {
      grouped[trackId] = [];
    });

    events.forEach(event => {
      const eventType = eventTypes[event.resourceType];
      if (eventType && eventType.track && grouped[eventType.track]) {
        const eventDate = getEventDate(event);
        if (eventDate) {
          grouped[eventType.track].push({
            ...event,
            _date: new Date(eventDate)
          });
        }
      }
    });

    // Sort events within each track by date
    Object.keys(grouped).forEach(trackId => {
      grouped[trackId].sort((a, b) => a._date - b._date);
    });

    return grouped;
  }, [events]);

  // D3 Timeline Rendering
  useEffect(() => {
    if (!dimensions.width || !dimensions.height || events.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = dimensions.width - MARGIN.left - MARGIN.right;
    const trackCount = Object.keys(tracks).length;
    const chartHeight = trackCount * (TRACK_HEIGHT + TRACK_PADDING);

    // Create scales
    const xScale = d3.scaleTime()
      .domain([dateRange.start, dateRange.end])
      .range([0, width]);

    // Create zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([MIN_ZOOM, MAX_ZOOM])
      .translateExtent([[-width, -chartHeight], [width * 2, chartHeight * 2]])
      .on('zoom', (event) => {
        setCurrentTransform(event.transform);
        chartGroup.attr('transform', event.transform);
        
        // Update x-axis
        const newXScale = event.transform.rescaleX(xScale);
        xAxisGroup.call(xAxis.scale(newXScale));
        
        // Update grid lines
        updateGridLines(newXScale);
        
        // Update today line position
        updateTodayLine(newXScale);
      });

    // Apply initial zoom
    svg.call(zoom);
    if (zoom) {
      svg.call(zoom.transform, d3.zoomIdentity.scale(zoom));
    }

    // Create main groups
    const mainGroup = svg.append('g')
      .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    const chartGroup = mainGroup.append('g')
      .attr('class', 'chart-group');

    // Create x-axis
    const xAxis = d3.axisBottom(xScale)
      .tickFormat(d => {
        const range = dateRange.end - dateRange.start;
        const days = range / (1000 * 60 * 60 * 24);
        if (days <= 7) return format(d, 'MMM d h:mm a');
        if (days <= 90) return format(d, 'MMM d');
        return format(d, 'MMM yyyy');
      })
      .ticks(10);

    const xAxisGroup = mainGroup.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${chartHeight})`)
      .call(xAxis);

    // Style axis
    xAxisGroup.selectAll('text')
      .style('fill', theme.palette.text.secondary)
      .style('font-size', '12px');
    xAxisGroup.selectAll('line, path')
      .style('stroke', theme.palette.divider);

    // Create grid
    const gridGroup = chartGroup.append('g')
      .attr('class', 'grid');

    const updateGridLines = (scale) => {
      const ticks = scale.ticks(10);
      
      const gridLines = gridGroup.selectAll('.grid-line')
        .data(ticks);
      
      gridLines.enter()
        .append('line')
        .attr('class', 'grid-line')
        .merge(gridLines)
        .attr('x1', d => scale(d))
        .attr('x2', d => scale(d))
        .attr('y1', -10)
        .attr('y2', chartHeight + 10)
        .style('stroke', theme.palette.divider)
        .style('stroke-opacity', 0.3)
        .style('stroke-dasharray', '2,2');
      
      gridLines.exit().remove();
    };

    updateGridLines(xScale);

    // Create track backgrounds and labels
    const trackGroups = chartGroup.selectAll('.track')
      .data(Object.entries(tracks))
      .enter().append('g')
      .attr('class', 'track')
      .attr('transform', (d, i) => `translate(0,${i * (TRACK_HEIGHT + TRACK_PADDING)})`);

    // Track backgrounds
    trackGroups.append('rect')
      .attr('x', -MARGIN.left)
      .attr('y', 0)
      .attr('width', width + MARGIN.left + MARGIN.right)
      .attr('height', TRACK_HEIGHT)
      .style('fill', (d, i) => i % 2 === 0 ? theme.palette.background.paper : alpha(theme.palette.action.hover, 0.04))
      .style('stroke', theme.palette.divider)
      .style('stroke-width', 1);

    // Track labels
    const labelGroup = mainGroup.append('g')
      .attr('class', 'track-labels');

    labelGroup.selectAll('.track-label')
      .data(Object.entries(tracks))
      .enter().append('g')
      .attr('class', 'track-label')
      .attr('transform', (d, i) => `translate(0,${i * (TRACK_HEIGHT + TRACK_PADDING)})`);

    labelGroup.selectAll('.track-label')
      .append('rect')
      .attr('x', -MARGIN.left)
      .attr('y', 0)
      .attr('width', MARGIN.left - 10)
      .attr('height', TRACK_HEIGHT)
      .style('fill', theme.palette.background.paper)
      .style('stroke', theme.palette.divider);

    labelGroup.selectAll('.track-label')
      .append('text')
      .attr('x', -10)
      .attr('y', TRACK_HEIGHT / 2)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .style('fill', theme.palette.text.primary)
      .style('font-size', '14px')
      .style('font-weight', 500)
      .text(d => d[1].label);

    // Add event counts
    labelGroup.selectAll('.track-label')
      .append('text')
      .attr('x', -MARGIN.left + 10)
      .attr('y', TRACK_HEIGHT / 2)
      .attr('dominant-baseline', 'middle')
      .style('fill', theme.palette.text.secondary)
      .style('font-size', '12px')
      .style('font-weight', 400)
      .text(d => {
        const count = trackData[d[0]]?.length || 0;
        return count > 0 ? `(${count})` : '';
      });

    // Create events
    Object.entries(trackData).forEach(([trackId, trackEvents]) => {
      const trackIndex = Object.keys(tracks).indexOf(trackId);
      const trackY = trackIndex * (TRACK_HEIGHT + TRACK_PADDING) + TRACK_HEIGHT / 2;

      const eventGroups = chartGroup.selectAll(`.event-${trackId}`)
        .data(trackEvents)
        .enter().append('g')
        .attr('class', `event event-${trackId}`)
        .attr('transform', d => `translate(${xScale(d._date)},${trackY})`)
        .style('cursor', 'pointer')
        .on('click', function(event, d) {
          event.stopPropagation();
          if (onEventClick) onEventClick(d);
        })
        .on('mouseenter', function(event, d) {
          if (onEventHover) onEventHover(d);
          
          // Show tooltip
          const tooltip = d3.select(tooltipRef.current);
          const eventType = eventTypes[d.resourceType];
          
          tooltip.style('display', 'block')
            .style('left', `${event.pageX + 10}px`)
            .style('top', `${event.pageY - 10}px`);
          
          const content = `
            <div style="font-weight: 500; margin-bottom: 4px;">
              ${eventType?.label || d.resourceType}
            </div>
            <div style="font-size: 12px; color: ${theme.palette.text.secondary};">
              ${format(d._date, 'MMM d, yyyy h:mm a')}
            </div>
            <div style="margin-top: 4px;">
              ${getEventTitle(d)}
            </div>
          `;
          
          tooltip.html(`
            <div style="padding: 12px; background: ${theme.palette.background.paper}; 
                 border: 1px solid ${theme.palette.divider}; border-radius: 4px;
                 box-shadow: ${theme.shadows[4]}; max-width: 300px;">
              ${content}
            </div>
          `);
          
          // Highlight event
          d3.select(this).select('.event-circle')
            .transition()
            .duration(200)
            .attr('r', EVENT_RADIUS + 3)
            .style('stroke-width', 3);
        })
        .on('mouseleave', function(event, d) {
          if (onEventHover) onEventHover(null);
          
          // Hide tooltip
          d3.select(tooltipRef.current).style('display', 'none');
          
          // Remove highlight
          d3.select(this).select('.event-circle')
            .transition()
            .duration(200)
            .attr('r', EVENT_RADIUS)
            .style('stroke-width', 2);
        });

      // Event circles
      eventGroups.append('circle')
        .attr('class', 'event-circle')
        .attr('r', EVENT_RADIUS)
        .style('fill', d => {
          const eventType = eventTypes[d.resourceType];
          return theme.palette[eventType?.color || 'primary'].main;
        })
        .style('stroke', theme.palette.background.paper)
        .style('stroke-width', 2);

      // Selected event highlight
      eventGroups.filter(d => d.id === hoveredEvent)
        .append('circle')
        .attr('class', 'selection-ring')
        .attr('r', EVENT_RADIUS + 4)
        .style('fill', 'none')
        .style('stroke', theme.palette.primary.main)
        .style('stroke-width', 2)
        .style('stroke-dasharray', '4,2');

      // Event connections (for related events)
      // This could be enhanced to show relationships between events
    });

    // Today line
    const updateTodayLine = (scale) => {
      const today = new Date();
      if (today >= dateRange.start && today <= dateRange.end) {
        let todayLine = chartGroup.select('.today-line');
        
        if (todayLine.empty()) {
          todayLine = chartGroup.append('line')
            .attr('class', 'today-line')
            .style('stroke', theme.palette.error.main)
            .style('stroke-width', 2)
            .style('stroke-dasharray', '4,4');
        }
        
        todayLine
          .attr('x1', scale(today))
          .attr('x2', scale(today))
          .attr('y1', -20)
          .attr('y2', chartHeight + 20);
        
        let todayLabel = chartGroup.select('.today-label');
        
        if (todayLabel.empty()) {
          todayLabel = chartGroup.append('text')
            .attr('class', 'today-label')
            .attr('text-anchor', 'middle')
            .style('fill', theme.palette.error.main)
            .style('font-size', '12px')
            .style('font-weight', 500)
            .text('Today');
        }
        
        todayLabel
          .attr('x', scale(today))
          .attr('y', -25);
      }
    };

    updateTodayLine(xScale);

    // Helper function for event titles
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
        case 'Procedure':
          return event.code?.text || event.code?.coding?.[0]?.display || 'Procedure';
        case 'Immunization':
          return event.vaccineCode?.text || event.vaccineCode?.coding?.[0]?.display || 'Immunization';
        case 'AllergyIntolerance':
          return event.code?.text || event.code?.coding?.[0]?.display || 'Allergy';
        case 'WorkflowEvent':
          return event.data?.message || event.eventType || 'Workflow Event';
        default:
          return event.code?.text || event.code?.coding?.[0]?.display || event.resourceType;
      }
    }

  }, [dimensions, events, trackData, dateRange, theme, onEventClick, onEventHover, hoveredEvent, density, zoom]);

  // Control functions
  const handleZoomIn = () => {
    const svg = d3.select(svgRef.current);
    svg.transition().duration(750).call(
      d3.zoom().scaleBy,
      1.5
    );
  };

  const handleZoomOut = () => {
    const svg = d3.select(svgRef.current);
    svg.transition().duration(750).call(
      d3.zoom().scaleBy,
      0.75
    );
  };

  const handleReset = () => {
    const svg = d3.select(svgRef.current);
    svg.transition().duration(750).call(
      d3.zoom().transform,
      d3.zoomIdentity
    );
  };

  const handleExportPNG = () => {
    const svgElement = svgRef.current;
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    
    img.onload = () => {
      ctx.fillStyle = theme.palette.background.paper;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `timeline-${format(new Date(), 'yyyy-MM-dd')}.png`;
        a.click();
        URL.revokeObjectURL(url);
      });
    };
    
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      containerRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setIsFullscreen(!isFullscreen);
  };

  return (
    <Paper
      ref={containerRef}
      elevation={0}
      sx={{
        position: 'relative',
        height: isFullscreen ? '100vh' : dimensions.height,
        border: 1,
        borderColor: 'divider',
        overflow: 'hidden',
        bgcolor: 'background.paper'
      }}
    >
      {/* Controls */}
      <Box
        sx={{
          position: 'absolute',
          top: 8,
          right: 8,
          zIndex: 10,
          display: 'flex',
          gap: 1,
          bgcolor: alpha(theme.palette.background.paper, 0.9),
          borderRadius: 1,
          p: 0.5,
          border: 1,
          borderColor: 'divider'
        }}
      >
        <ButtonGroup size="small" variant="outlined">
          <Tooltip title="Zoom In">
            <Button onClick={handleZoomIn}>
              <ZoomInIcon fontSize="small" />
            </Button>
          </Tooltip>
          <Tooltip title="Zoom Out">
            <Button onClick={handleZoomOut}>
              <ZoomOutIcon fontSize="small" />
            </Button>
          </Tooltip>
          <Tooltip title="Reset View">
            <Button onClick={handleReset}>
              <RefreshIcon fontSize="small" />
            </Button>
          </Tooltip>
        </ButtonGroup>
        
        <Tooltip title="Export as PNG">
          <IconButton size="small" onClick={handleExportPNG}>
            <DownloadIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        
        <Tooltip title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
          <IconButton size="small" onClick={toggleFullscreen}>
            {isFullscreen ? <FullscreenExitIcon fontSize="small" /> : <FullscreenIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Box>

      {/* Zoom indicator */}
      <Chip
        label={`${Math.round(currentTransform.k * 100)}%`}
        size="small"
        sx={{
          position: 'absolute',
          bottom: 8,
          right: 8,
          zIndex: 10
        }}
      />

      {/* SVG Container */}
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        style={{ cursor: 'move' }}
      />

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        style={{
          position: 'fixed',
          display: 'none',
          pointerEvents: 'none',
          zIndex: 1000
        }}
      />
    </Paper>
  );
};

// Main Timeline Tab Component
const TimelineTabEnhanced = ({ patientId, patient, density: propDensity }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [themeDensity] = useThemeDensity();
  const density = propDensity || themeDensity;
  
  const { 
    resources, 
    fetchPatientEverything,
    isResourceLoading, 
    currentPatient
  } = useFHIRResource();
  const { subscribe, notifications } = useClinicalWorkflow();
  
  // State
  const [viewMode, setViewMode] = useState('multi-track');
  const [filterPeriod, setFilterPeriod] = useState('1y');
  const [selectedTypes, setSelectedTypes] = useState(new Set(Object.keys(eventTypes)));
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [hoveredEvent, setHoveredEvent] = useState(null);
  const [workflowEvents, setWorkflowEvents] = useState([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  
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
      
      setLoading(true);
      try {
        await fetchPatientEverything(patientId, {
          types: Array.from(selectedTypes),
          count: 500,
          since: dateRange.start.toISOString().split('T')[0]
        });
      } catch (error) {
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
  }, [patientId, selectedTypes, dateRange, fetchPatientEverything]);
  
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
          if (!seenIds.has(uniqueKey) && resourceBelongsToPatient(event, patientId)) {
            seenIds.add(uniqueKey);
            events.push(event);
          }
        });
      } else {
        const resourcesOfType = resources[`${resourceType.toLowerCase()}s`] || 
                               resources[resourceType] || 
                               [];
        resourcesOfType.forEach(resource => {
          const uniqueKey = `${resource.resourceType}-${resource.id}`;
          if (!seenIds.has(uniqueKey) && resourceBelongsToPatient(resource, patientId)) {
            seenIds.add(uniqueKey);
            events.push(resource);
          }
        });
      }
    });
    
    return events;
  }, [resources, selectedTypes, workflowEvents, patientId]);
  
  // Filter events
  const filteredEvents = useMemo(() => {
    return allEvents.filter(event => {
      const eventDate = getEventDate(event);
      if (!eventDate) return false;
      
      const date = new Date(eventDate);
      if (!isWithinInterval(date, { start: dateRange.start, end: dateRange.end })) {
        return false;
      }
      
      if (debouncedSearchTerm) {
        const searchLower = debouncedSearchTerm.toLowerCase();
        const eventType = eventTypes[event.resourceType];
        
        const searchFields = [
          event.resourceType,
          eventType?.label,
          event.code?.text,
          event.code?.coding?.[0]?.display,
          event.display,
          event.type?.[0]?.text,
          event.type?.[0]?.coding?.[0]?.display,
          event.vaccineCode?.text,
          event.vaccineCode?.coding?.[0]?.display,
          event.status
        ].filter(Boolean).map(s => s.toLowerCase());
        
        return searchFields.some(field => field.includes(searchLower));
      }
      
      return true;
    });
  }, [allEvents, dateRange, debouncedSearchTerm]);
  
  // Sort events by date
  const sortedEvents = useMemo(() => {
    return [...filteredEvents].sort((a, b) => {
      const dateA = getEventDate(a);
      const dateB = getEventDate(b);
      if (!dateA || !dateB) return 0;
      return new Date(dateB) - new Date(dateA);
    });
  }, [filteredEvents]);
  
  // Calculate metrics
  const metrics = useMemo(() => {
    const totalEvents = sortedEvents.length;
    const eventsByType = {};
    const eventsByTrack = {};
    
    sortedEvents.forEach(event => {
      const eventType = eventTypes[event.resourceType];
      
      // Count by type
      eventsByType[event.resourceType] = (eventsByType[event.resourceType] || 0) + 1;
      
      // Count by track
      if (eventType?.track) {
        eventsByTrack[eventType.track] = (eventsByTrack[eventType.track] || 0) + 1;
      }
    });
    
    const topTypes = Object.entries(eventsByType)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([type, count]) => ({
        label: eventTypes[type]?.label || type,
        value: count
      }));
    
    const recentDays = differenceInDays(dateRange.end, dateRange.start);
    const eventsPerDay = recentDays > 0 ? (totalEvents / recentDays).toFixed(1) : 0;
    
    return [
      { 
        label: 'Total Events', 
        value: totalEvents, 
        trend: 'stable',
        icon: <EventIcon />
      },
      { 
        label: 'Time Period', 
        value: `${recentDays} days`, 
        subtitle: `${eventsPerDay} events/day`,
        icon: <DateRangeIcon />
      },
      { 
        label: 'Resource Types', 
        value: Object.keys(eventsByType).length, 
        subtitle: `${Object.keys(eventsByTrack).length} tracks`,
        icon: <FilterIcon />
      },
      { 
        label: 'Most Common', 
        value: topTypes[0]?.label || 'None', 
        subtitle: topTypes[0] ? `${topTypes[0].value} events` : '',
        icon: <TodayIcon />
      }
    ];
  }, [sortedEvents, dateRange]);
  
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
        setLoading(true);
        await fetchPatientEverything(patientId, {
          types: Array.from(selectedTypes),
          count: 500,
          since: dateRange.start.toISOString().split('T')[0],
          forceRefresh: true
        }).finally(() => setLoading(false));
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
    
    printDocument({
      title: 'Clinical Timeline',
      patient: patientInfo,
      content
    });
  }
  
  function handleEventClick(event) {
    const resourceTypeToTab = {
      'Encounter': 'encounters',
      'MedicationRequest': 'chart-review',
      'MedicationStatement': 'chart-review',
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
    
    const tab = resourceTypeToTab[event.resourceType];
    const patientId = event.subject?.reference?.split('/')[1] || event.patient?.reference?.split('/')[1];
    
    if (tab && patientId) {
      navigate(`/clinical/${patientId}?tab=${tab}&resourceId=${event.id}&resourceType=${event.resourceType}`);
    }
  }
  
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <CircularProgress />
      </Box>
    );
  }
  
  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Metrics Bar */}
      <MetricsBar metrics={metrics} density={density} />
      
      {/* Controls */}
      <Paper sx={{ p: 2, mb: 2 }}>
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
                onChange={(e) => setFilterPeriod(e.target.value)}
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
          
          {/* Event type filters */}
          <Collapse in={showFilters}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Event Types
              </Typography>
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
                        size="small"
                      />
                    }
                    label={
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        {config.icon}
                        <Typography variant="body2">{config.label}</Typography>
                      </Stack>
                    }
                  />
                ))}
              </FormGroup>
            </Paper>
          </Collapse>
        </Stack>
      </Paper>
      
      {/* Timeline View */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {sortedEvents.length === 0 ? (
          <Alert severity="info">
            No events found in the selected time period
          </Alert>
        ) : viewMode === 'multi-track' ? (
          <EnhancedD3Timeline
            events={sortedEvents}
            dateRange={dateRange}
            zoom={zoom}
            density={density}
            onEventClick={handleEventClick}
            hoveredEvent={hoveredEvent}
            onEventHover={setHoveredEvent}
          />
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
              onItemClick={(item) => handleEventClick(item.resource)}
              onScroll={(scrollRatio) => console.log('Scroll:', scrollRatio)}
            />
          </Box>
        ) : (
          <SmartTable
            columns={[
              { field: 'date', header: 'Date', sortable: true },
              { field: 'type', header: 'Type', sortable: true },
              { field: 'title', header: 'Event', sortable: true },
              { field: 'status', header: 'Status' }
            ]}
            data={sortedEvents.map(event => ({
              id: event.id,
              date: format(new Date(getEventDate(event) || Date.now()), 'MMM d, yyyy h:mm a'),
              type: eventTypes[event.resourceType]?.label || event.resourceType,
              title: getEventTitle(event),
              status: event.status || '-',
              _resource: event
            }))}
            onRowClick={(row) => handleEventClick(row._resource)}
            density={density}
          />
        )}
      </Box>
      
      {/* FAB for quick actions */}
      <ContextualFAB actions={quickActions} />
      
      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        message={snackbar.message}
        severity={snackbar.severity}
      />
    </Box>
  );
};

// Helper function
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
    case 'Procedure':
      return event.code?.text || event.code?.coding?.[0]?.display || 'Procedure';
    case 'Immunization':
      return event.vaccineCode?.text || event.vaccineCode?.coding?.[0]?.display || 'Immunization';
    case 'AllergyIntolerance':
      return event.code?.text || event.code?.coding?.[0]?.display || 'Allergy';
    case 'WorkflowEvent':
      return event.data?.message || event.eventType || 'Workflow Event';
    default:
      return event.code?.text || event.code?.coding?.[0]?.display || event.resourceType;
  }
}

export default TimelineTabEnhanced;