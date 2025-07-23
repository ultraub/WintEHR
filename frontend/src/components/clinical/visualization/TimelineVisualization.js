/**
 * Timeline Visualization Component
 * Modern multi-track timeline visualization using D3.js
 * 
 * Features:
 * - Multi-track horizontal timeline with lanes for different resource types
 * - Smooth zoom and pan with mouse/touch support
 * - Virtual rendering for performance with 1000+ events
 * - Interactive tooltips and click navigation
 * - Export functionality (PNG/SVG)
 * - Mobile responsive design
 * 
 * @module TimelineVisualization
 */

import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { 
  Box, 
  Paper, 
  IconButton, 
  Tooltip, 
  ButtonGroup,
  Button,
  Typography,
  Chip,
  useTheme,
  alpha,
  CircularProgress,
  Snackbar,
  Alert
} from '@mui/material';
import {
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  CenterFocusStrong as FitIcon,
  Download as DownloadIcon,
  FilterList as FilterIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
  NavigateBefore as PanLeftIcon,
  NavigateNext as PanRightIcon,
  Today as TodayIcon
} from '@mui/icons-material';
import { format, parseISO, differenceInDays, startOfDay, endOfDay } from 'date-fns';
import { throttle, performanceMonitor } from '../performance/optimizations';

// Track configuration with clinical colors
const TRACKS = {
  encounters: { 
    label: 'Clinical Encounters', 
    color: '#1976d2', // Primary blue
    height: 60,
    priority: 1 
  },
  conditions: { 
    label: 'Conditions & Diagnoses', 
    color: '#ff9800', // Warning orange
    height: 60,
    priority: 2 
  },
  medications: { 
    label: 'Medications', 
    color: '#9c27b0', // Secondary purple
    height: 60,
    priority: 3 
  },
  labs: { 
    label: 'Lab Results', 
    color: '#2196f3', // Info blue
    height: 60,
    priority: 4 
  },
  procedures: { 
    label: 'Procedures', 
    color: '#00bcd4', // Cyan
    height: 60,
    priority: 5 
  },
  immunizations: { 
    label: 'Immunizations', 
    color: '#4caf50', // Success green
    height: 60,
    priority: 6 
  },
  imaging: { 
    label: 'Imaging Studies', 
    color: '#795548', // Brown
    height: 60,
    priority: 7 
  },
  documents: { 
    label: 'Clinical Documents', 
    color: '#607d8b', // Blue grey
    height: 60,
    priority: 8 
  }
};

// Event shape configurations
const EVENT_SHAPES = {
  circle: (selection, size) => {
    return selection
      .append('circle')
      .attr('r', size / 2);
  },
  diamond: (selection, size) => {
    const s = size / 2;
    return selection
      .append('path')
      .attr('d', `M0,-${s} L${s},0 L0,${s} L-${s},0 Z`);
  },
  square: (selection, size) => {
    return selection
      .append('rect')
      .attr('x', -size / 2)
      .attr('y', -size / 2)
      .attr('width', size)
      .attr('height', size);
  },
  triangle: (selection, size) => {
    const s = size / 2;
    return selection
      .append('path')
      .attr('d', `M0,-${s} L${s},${s} L-${s},${s} Z`);
  }
};

const TimelineVisualization = ({ 
  events = [], 
  dateRange,
  selectedTypes = new Set(),
  onEventClick,
  onDateRangeChange,
  density = 'comfortable',
  height = 600
}) => {
  const theme = useTheme();
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const tooltipRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [zoom, setZoom] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  
  // Performance tracking
  const renderFrameRef = useRef(0);
  const lastRenderTime = useRef(Date.now());
  
  // Calculate dimensions
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width } = containerRef.current.getBoundingClientRect();
        setDimensions({ width, height });
      }
    };
    
    updateDimensions();
    const throttledUpdate = throttle(updateDimensions, 100);
    window.addEventListener('resize', throttledUpdate);
    
    return () => window.removeEventListener('resize', throttledUpdate);
  }, [height]);
  
  // Process events into tracks
  const processedData = useMemo(() => {
    performanceMonitor.mark('process-data-start');
    
    const trackData = {};
    Object.keys(TRACKS).forEach(track => {
      trackData[track] = [];
    });
    
    // Map resource types to tracks
    const resourceTypeToTrack = {
      'Encounter': 'encounters',
      'Condition': 'conditions',
      'AllergyIntolerance': 'conditions',
      'MedicationRequest': 'medications',
      'MedicationStatement': 'medications',
      'Observation': 'labs',
      'DiagnosticReport': 'labs',
      'Procedure': 'procedures',
      'Immunization': 'immunizations',
      'ImagingStudy': 'imaging',
      'DocumentReference': 'documents',
      'CarePlan': 'documents',
      'Goal': 'documents'
    };
    
    // Filter and categorize events
    events.forEach(event => {
      if (!selectedTypes.has(event.resourceType)) return;
      
      const track = resourceTypeToTrack[event.resourceType];
      if (!track || !trackData[track]) return;
      
      const date = getEventDate(event);
      if (!date) return;
      
      const parsedDate = parseISO(date);
      if (parsedDate < dateRange.start || parsedDate > dateRange.end) return;
      
      trackData[track].push({
        ...event,
        date: parsedDate,
        track
      });
    });
    
    // Sort events within each track by date
    Object.keys(trackData).forEach(track => {
      trackData[track].sort((a, b) => a.date - b.date);
    });
    
    performanceMonitor.mark('process-data-end');
    performanceMonitor.measure('Data Processing', 'process-data-start', 'process-data-end');
    
    return trackData;
  }, [events, selectedTypes, dateRange]);
  
  // Create D3 visualization
  useEffect(() => {
    if (!svgRef.current || !dimensions.width) return;
    
    performanceMonitor.mark('render-start');
    
    try {
      // Clear previous content and remove event listeners
      const svg = d3.select(svgRef.current);
      svg.selectAll('*').remove();
      svg.on('.zoom', null); // Remove previous zoom listeners
    
    const svg = d3.select(svgRef.current)
      .attr('width', dimensions.width)
      .attr('height', dimensions.height);
    
    // Create main group for zoom/pan
    const mainGroup = svg.append('g')
      .attr('class', 'main-group');
    
    // Set up scales
    const margin = { top: 40, right: 20, bottom: 40, left: 150 };
    const innerWidth = dimensions.width - margin.left - margin.right;
    const innerHeight = dimensions.height - margin.top - margin.bottom;
    
    const xScale = d3.scaleTime()
      .domain([dateRange.start, dateRange.end])
      .range([0, innerWidth]);
    
    // Create zoom behavior
    const zoomBehavior = d3.zoom()
      .scaleExtent([0.5, 10])
      .extent([[0, 0], [dimensions.width, dimensions.height]])
      .on('zoom', (event) => {
        const transform = event.transform;
        mainGroup.attr('transform', transform);
        
        // Update x-axis
        const newXScale = transform.rescaleX(xScale);
        xAxisGroup.call(xAxis.scale(newXScale));
        
        // Track performance
        const now = Date.now();
        const fps = 1000 / (now - lastRenderTime.current);
        lastRenderTime.current = now;
        renderFrameRef.current++;
        
        if (renderFrameRef.current % 60 === 0) {
          console.log(`Timeline FPS: ${fps.toFixed(1)}`);
        }
      });
    
    svg.call(zoomBehavior);
    setZoom(zoomBehavior);
    
    // Create axes
    const xAxis = d3.axisBottom(xScale)
      .tickFormat(d => {
        const days = differenceInDays(dateRange.end, dateRange.start);
        if (days > 365) return format(d, 'MMM yyyy');
        if (days > 90) return format(d, 'MMM d');
        if (days > 7) return format(d, 'MMM d');
        return format(d, 'MMM d HH:mm');
      });
    
    const xAxisGroup = mainGroup.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(${margin.left}, ${dimensions.height - margin.bottom})`)
      .call(xAxis);
    
    // Style axis
    xAxisGroup.selectAll('text')
      .style('fill', theme.palette.text.secondary)
      .style('font-size', '12px');
    
    xAxisGroup.selectAll('line, path')
      .style('stroke', theme.palette.divider);
    
    // Create tracks
    const trackGroups = mainGroup.append('g')
      .attr('class', 'tracks')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);
    
    let yOffset = 0;
    
    Object.entries(TRACKS).forEach(([trackId, trackConfig]) => {
      const trackEvents = processedData[trackId] || [];
      
      // Track background
      const trackGroup = trackGroups.append('g')
        .attr('class', `track track-${trackId}`)
        .attr('transform', `translate(0, ${yOffset})`);
      
      // Track background rect
      trackGroup.append('rect')
        .attr('class', 'track-background')
        .attr('width', innerWidth)
        .attr('height', trackConfig.height)
        .attr('fill', alpha(trackConfig.color, 0.05))
        .attr('stroke', theme.palette.divider)
        .attr('stroke-width', 1);
      
      // Track label
      trackGroup.append('text')
        .attr('class', 'track-label')
        .attr('x', -10)
        .attr('y', trackConfig.height / 2)
        .attr('text-anchor', 'end')
        .attr('dominant-baseline', 'middle')
        .style('fill', theme.palette.text.primary)
        .style('font-size', '14px')
        .style('font-weight', 500)
        .text(trackConfig.label);
      
      // Track event count
      if (trackEvents.length > 0) {
        trackGroup.append('text')
          .attr('class', 'track-count')
          .attr('x', innerWidth + 10)
          .attr('y', trackConfig.height / 2)
          .attr('text-anchor', 'start')
          .attr('dominant-baseline', 'middle')
          .style('fill', theme.palette.text.secondary)
          .style('font-size', '12px')
          .text(`(${trackEvents.length})`);
      }
      
      // Render events with virtualization
      const visibleEvents = getVisibleEvents(trackEvents, xScale, innerWidth);
      
      const eventGroups = trackGroup.selectAll('.event')
        .data(visibleEvents)
        .enter()
        .append('g')
        .attr('class', 'event')
        .attr('transform', d => `translate(${xScale(d.date)}, ${trackConfig.height / 2})`);
      
      // Add event shapes based on type
      eventGroups.each(function(d) {
        const group = d3.select(this);
        const size = density === 'compact' ? 12 : density === 'comfortable' ? 16 : 20;
        const shape = getEventShape(d.resourceType);
        
        EVENT_SHAPES[shape](group, size)
          .attr('fill', trackConfig.color)
          .attr('stroke', '#fff')
          .attr('stroke-width', 2)
          .attr('cursor', 'pointer')
          .on('click', (event) => {
            event.stopPropagation();
            onEventClick?.(d);
          })
          .on('mouseenter', function(event) {
            d3.select(this)
              .transition()
              .duration(200)
              .attr('transform', 'scale(1.2)');
            
            showTooltip(event, d);
          })
          .on('mouseleave', function() {
            d3.select(this)
              .transition()
              .duration(200)
              .attr('transform', 'scale(1)');
            
            hideTooltip();
          });
      });
      
      yOffset += trackConfig.height;
    });
    
    // Add current time indicator
    const now = new Date();
    if (now >= dateRange.start && now <= dateRange.end) {
      mainGroup.append('line')
        .attr('class', 'now-indicator')
        .attr('x1', margin.left + xScale(now))
        .attr('y1', margin.top)
        .attr('x2', margin.left + xScale(now))
        .attr('y2', dimensions.height - margin.bottom)
        .attr('stroke', theme.palette.error.main)
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '5,5');
      
      mainGroup.append('text')
        .attr('x', margin.left + xScale(now))
        .attr('y', margin.top - 10)
        .attr('text-anchor', 'middle')
        .style('fill', theme.palette.error.main)
        .style('font-size', '12px')
        .style('font-weight', 500)
        .text('Now');
    }
    
    performanceMonitor.mark('render-end');
    performanceMonitor.measure('Timeline Render', 'render-start', 'render-end');
    
  }, [dimensions, processedData, dateRange, density, theme, onEventClick]);
  
  // Virtualization helper
  const getVisibleEvents = useCallback((events, xScale, width) => {
    const [minX, maxX] = xScale.range();
    const buffer = 50; // Render events slightly outside viewport
    
    return events.filter(event => {
      const x = xScale(event.date);
      return x >= (minX - buffer) && x <= (maxX + buffer);
    });
  }, []);
  
  // Get event shape based on type
  const getEventShape = (resourceType) => {
    const shapeMap = {
      'Encounter': 'circle',
      'Condition': 'diamond',
      'MedicationRequest': 'square',
      'Observation': 'circle',
      'Procedure': 'triangle',
      'Immunization': 'square',
      'ImagingStudy': 'diamond',
      'DocumentReference': 'square'
    };
    return shapeMap[resourceType] || 'circle';
  };
  
  // Tooltip functions
  const showTooltip = (event, data) => {
    if (!tooltipRef.current) return;
    
    const tooltip = d3.select(tooltipRef.current);
    const title = getEventTitle(data);
    const subtitle = getEventSubtitle(data);
    const date = format(data.date, 'MMM d, yyyy h:mm a');
    
    tooltip
      .style('opacity', 1)
      .style('left', `${event.pageX + 10}px`)
      .style('top', `${event.pageY - 10}px`)
      .html(`
        <div style="padding: 8px; background: ${theme.palette.background.paper}; 
             border: 1px solid ${theme.palette.divider}; border-radius: 4px;
             box-shadow: ${theme.shadows[2]};">
          <strong style="color: ${theme.palette.text.primary}">${title}</strong><br/>
          <span style="color: ${theme.palette.text.secondary}">${subtitle}</span><br/>
          <span style="color: ${theme.palette.text.secondary}; font-size: 12px">${date}</span>
        </div>
      `);
  };
  
  const hideTooltip = () => {
    if (!tooltipRef.current) return;
    d3.select(tooltipRef.current).style('opacity', 0);
  };
  
  // Control functions
  const handleZoomIn = () => {
    if (!zoom || !svgRef.current) return;
    d3.select(svgRef.current)
      .transition()
      .duration(350)
      .call(zoom.scaleBy, 1.3);
  };
  
  const handleZoomOut = () => {
    if (!zoom || !svgRef.current) return;
    d3.select(svgRef.current)
      .transition()
      .duration(350)
      .call(zoom.scaleBy, 0.7);
  };
  
  const handleZoomReset = () => {
    if (!zoom || !svgRef.current) return;
    d3.select(svgRef.current)
      .transition()
      .duration(350)
      .call(zoom.transform, d3.zoomIdentity);
  };
  
  const handlePanToToday = () => {
    if (!zoom || !svgRef.current) return;
    
    const now = new Date();
    if (now < dateRange.start || now > dateRange.end) {
      setSnackbar({
        open: true,
        message: 'Current date is outside the visible range',
        severity: 'info'
      });
      return;
    }
    
    // Calculate pan offset to center today
    const xScale = d3.scaleTime()
      .domain([dateRange.start, dateRange.end])
      .range([0, dimensions.width - 170]);
    
    const todayX = xScale(now);
    const centerX = (dimensions.width - 170) / 2;
    const panX = centerX - todayX;
    
    d3.select(svgRef.current)
      .transition()
      .duration(750)
      .call(zoom.translateBy, panX, 0);
  };
  
  const handleExport = async (format = 'png') => {
    setLoading(true);
    
    try {
      const svg = svgRef.current;
      const svgData = new XMLSerializer().serializeToString(svg);
      
      if (format === 'svg') {
        // Export as SVG
        const blob = new Blob([svgData], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `timeline-${Date.now()}.svg`;
        link.click();
        URL.revokeObjectURL(url);
      } else {
        // Export as PNG
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
            const link = document.createElement('a');
            link.href = url;
            link.download = `timeline-${Date.now()}.png`;
            link.click();
            URL.revokeObjectURL(url);
          });
        };
        
        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
      }
      
      setSnackbar({
        open: true,
        message: `Timeline exported as ${format.toUpperCase()}`,
        severity: 'success'
      });
    } catch (error) {
      console.error('Export error:', error);
      setSnackbar({
        open: true,
        message: 'Failed to export timeline',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };
  
  const toggleFullscreen = () => {
    if (!isFullscreen) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
    setIsFullscreen(!isFullscreen);
  };
  
  return (
    <Box ref={containerRef} sx={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Controls */}
      <Paper 
        sx={{ 
          position: 'absolute', 
          top: 16, 
          right: 16, 
          zIndex: 10,
          p: 1,
          display: 'flex',
          gap: 1,
          alignItems: 'center'
        }}
        elevation={3}
      >
        <ButtonGroup size="small" variant="contained">
          <Tooltip title="Zoom In">
            <Button onClick={handleZoomIn}>
              <ZoomInIcon />
            </Button>
          </Tooltip>
          <Tooltip title="Zoom Out">
            <Button onClick={handleZoomOut}>
              <ZoomOutIcon />
            </Button>
          </Tooltip>
          <Tooltip title="Reset Zoom">
            <Button onClick={handleZoomReset}>
              <FitIcon />
            </Button>
          </Tooltip>
        </ButtonGroup>
        
        <ButtonGroup size="small" variant="outlined">
          <Tooltip title="Go to Today">
            <Button onClick={handlePanToToday}>
              <TodayIcon />
            </Button>
          </Tooltip>
        </ButtonGroup>
        
        <ButtonGroup size="small" variant="outlined">
          <Tooltip title="Export as PNG">
            <Button onClick={() => handleExport('png')} disabled={loading}>
              <DownloadIcon />
            </Button>
          </Tooltip>
          <Tooltip title="Export as SVG">
            <Button onClick={() => handleExport('svg')} disabled={loading}>
              SVG
            </Button>
          </Tooltip>
        </ButtonGroup>
        
        <Tooltip title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
          <IconButton onClick={toggleFullscreen} size="small">
            {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
          </IconButton>
        </Tooltip>
      </Paper>
      
      {/* Loading overlay */}
      {loading && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: alpha(theme.palette.background.paper, 0.8),
            zIndex: 20
          }}
        >
          <CircularProgress />
        </Box>
      )}
      
      {/* SVG Container */}
      <svg ref={svgRef} style={{ width: '100%', height: '100%' }} />
      
      {/* Tooltip */}
      <div 
        ref={tooltipRef}
        style={{
          position: 'fixed',
          opacity: 0,
          pointerEvents: 'none',
          transition: 'opacity 0.2s',
          zIndex: 1000
        }}
      />
      
      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

// Helper functions
const getEventDate = (event) => {
  switch (event.resourceType) {
    case 'Procedure':
      return event.performedDateTime || 
             event.performedPeriod?.start || 
             event.performedPeriod?.end ||
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
};

const getEventTitle = (event) => {
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
    case 'Procedure':
      return event.code?.text || event.code?.coding?.[0]?.display || 'Procedure';
    case 'Immunization':
      return event.vaccineCode?.text || event.vaccineCode?.coding?.[0]?.display || 'Immunization';
    case 'ImagingStudy':
      return event.description || 'Imaging Study';
    case 'DocumentReference':
      return event.type?.text || event.type?.coding?.[0]?.display || 'Document';
    default:
      return event.resourceType;
  }
};

const getEventSubtitle = (event) => {
  switch (event.resourceType) {
    case 'Encounter':
      return event.status || '';
    case 'MedicationRequest':
      return event.status || '';
    case 'Observation':
      return event.valueQuantity ? 
        `${event.valueQuantity.value} ${event.valueQuantity.unit}` :
        event.valueString || '';
    case 'Condition':
      return event.clinicalStatus?.coding?.[0]?.code || '';
    case 'Procedure':
      return event.status || '';
    default:
      return '';
  }
};

export default React.memo(TimelineVisualization);