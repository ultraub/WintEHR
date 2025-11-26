import React, { useState, useMemo, memo, useRef, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Stack,
  Chip,
  IconButton,
  Tooltip,
  ButtonGroup,
  Button,
  Menu,
  MenuItem,
  Checkbox,
  FormControlLabel,
  Divider,
  Skeleton,
  useTheme,
  alpha,
  Zoom
} from '@mui/material';
import {
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  Refresh as RefreshIcon,
  FilterList as FilterListIcon,
  CalendarToday as CalendarIcon,
  Timeline as TimelineIcon,
  Medication as MedicationIcon,
  LocalHospital as HospitalIcon,
  LocalHospital,
  Science as LabIcon,
  Image as ImageIcon,
  Assignment as DocumentIcon,
  MoreVert as MoreVertIcon
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import * as d3 from 'd3';
import { format, startOfDay, endOfDay, subDays, addDays } from 'date-fns';
import { severity as severityTokens } from '../../../../themes/clinicalTheme';

// Resource type configurations
const resourceTypeConfig = {
  Condition: {
    color: '#E91E63',
    icon: <LocalHospital fontSize="small" />,
    label: 'Conditions',
    track: 0
  },
  MedicationRequest: {
    color: '#2196F3',
    icon: <MedicationIcon fontSize="small" />,
    label: 'Medications',
    track: 1
  },
  Observation: {
    color: '#4CAF50',
    icon: <LabIcon fontSize="small" />,
    label: 'Observations',
    track: 2
  },
  Encounter: {
    color: '#FF9800',
    icon: <HospitalIcon fontSize="small" />,
    label: 'Encounters',
    track: 3
  },
  ImagingStudy: {
    color: '#9C27B0',
    icon: <ImageIcon fontSize="small" />,
    label: 'Imaging',
    track: 4
  },
  DocumentReference: {
    color: '#795548',
    icon: <DocumentIcon fontSize="small" />,
    label: 'Documents',
    track: 5
  }
};

// Time range presets
const timeRangePresets = [
  { label: '1 Week', days: 7 },
  { label: '1 Month', days: 30 },
  { label: '3 Months', days: 90 },
  { label: '6 Months', days: 180 },
  { label: '1 Year', days: 365 },
  { label: 'All Time', days: null }
];

const ResourceTimeline = memo(({
  resources = [],
  height = 400,
  loading = false,
  onResourceClick,
  onRangeSelect,
  showLegend = true,
  showControls = true,
  groupBy = 'resourceType',
  initialTimeRange = 90, // days
  highlightToday = true,
  animate = true,
  sx = {},
  // Props that shouldn't be passed to DOM - prefix with _ to indicate intentionally unused
  showRangeSelector: _showRangeSelector,
  enableZoom: _enableZoom,
  groupByType: _groupByType
}) => {
  const theme = useTheme();
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  
  const [selectedTypes, setSelectedTypes] = useState(
    Object.keys(resourceTypeConfig).reduce((acc, type) => ({ ...acc, [type]: true }), {})
  );
  const [timeRange, setTimeRange] = useState(initialTimeRange);
  const [filterAnchor, setFilterAnchor] = useState(null);
  const [hoveredResource, setHoveredResource] = useState(null);
  const [hoveredPosition, setHoveredPosition] = useState({ x: 0, y: 0 });
  const [dimensions, setDimensions] = useState({ width: 0, height: typeof height === 'string' ? 400 : height });

  // Calculate time bounds
  const timeBounds = useMemo(() => {
    const now = new Date();
    const endDate = endOfDay(now);
    const startDate = timeRange ? startOfDay(subDays(now, timeRange)) : null;

    if (!startDate && resources.length > 0) {
      // Find earliest date from resources
      const dates = resources.map(r => new Date(r.date || r.effectiveDateTime || r.authoredOn || r.created));
      return {
        start: d3.min(dates),
        end: endDate
      };
    }

    return { start: startDate, end: endDate };
  }, [resources, timeRange]);

  // Filter resources by selected types and time range
  const filteredResources = useMemo(() => {
    return resources.filter(resource => {
      if (!selectedTypes[resource.resourceType]) return false;
      
      const resourceDate = new Date(
        resource.date || 
        resource.effectiveDateTime || 
        resource.authoredOn || 
        resource.created
      );
      
      if (timeBounds.start && resourceDate < timeBounds.start) return false;
      if (timeBounds.end && resourceDate > timeBounds.end) return false;
      
      return true;
    });
  }, [resources, selectedTypes, timeBounds]);

  // Group resources by type
  const groupedResources = useMemo(() => {
    const groups = {};
    filteredResources.forEach(resource => {
      const type = resource.resourceType;
      if (!groups[type]) groups[type] = [];
      groups[type].push(resource);
    });
    return groups;
  }, [filteredResources]);

  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width, height: containerHeight } = containerRef.current.getBoundingClientRect();
        const actualHeight = typeof height === 'string' && height === '100%' 
          ? containerHeight - 32 // Subtract padding
          : typeof height === 'number' 
          ? height 
          : 400;
        setDimensions({ width: width - 32, height: actualHeight });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [height]);

  // Render D3 timeline
  useEffect(() => {
    if (!svgRef.current || dimensions.width === 0 || loading) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 40, right: 20, bottom: 40, left: 80 };
    const innerWidth = dimensions.width - margin.left - margin.right;
    const innerHeight = dimensions.height - margin.top - margin.bottom;

    // Create scales
    const xScale = d3.scaleTime()
      .domain([timeBounds.start, timeBounds.end])
      .range([0, innerWidth]);

    const trackHeight = 40;
    const trackSpacing = 10;
    const activeTypes = Object.keys(groupedResources);
    
    // Create main group
    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Add time axis
    const xAxis = d3.axisBottom(xScale)
      .ticks(d3.timeDay.every(timeRange > 180 ? 7 : 1))
      .tickFormat(d3.timeFormat('%b %d'));

    g.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis)
      .style('color', theme.palette.text.secondary);

    // Add grid lines
    g.append('g')
      .attr('class', 'grid')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale)
        .ticks(d3.timeDay.every(1))
        .tickSize(-innerHeight)
        .tickFormat('')
      )
      .style('stroke-dasharray', '2,2')
      .style('opacity', 0.3)
      .style('color', theme.palette.divider);

    // Add today line if enabled
    if (highlightToday) {
      const today = new Date();
      g.append('line')
        .attr('class', 'today-line')
        .attr('x1', xScale(today))
        .attr('x2', xScale(today))
        .attr('y1', 0)
        .attr('y2', innerHeight)
        .style('stroke', theme.palette.error.main)
        .style('stroke-width', 2)
        .style('stroke-dasharray', '5,5')
        .style('opacity', 0.5);

      g.append('text')
        .attr('x', xScale(today))
        .attr('y', -10)
        .attr('text-anchor', 'middle')
        .style('fill', theme.palette.error.main)
        .style('font-size', '12px')
        .style('font-weight', 600)
        .text('Today');
    }

    // Render resource tracks
    activeTypes.forEach((type, trackIndex) => {
      const trackY = trackIndex * (trackHeight + trackSpacing);
      const config = resourceTypeConfig[type];
      const trackResources = groupedResources[type] || [];

      // Track background
      g.append('rect')
        .attr('x', 0)
        .attr('y', trackY)
        .attr('width', innerWidth)
        .attr('height', trackHeight)
        .attr('fill', alpha(config.color, 0.05))
        .attr('stroke', alpha(config.color, 0.2))
        .attr('stroke-width', 1)
        .attr('rx', 4);

      // Track label
      g.append('text')
        .attr('x', -10)
        .attr('y', trackY + trackHeight / 2)
        .attr('text-anchor', 'end')
        .attr('dominant-baseline', 'middle')
        .style('fill', config.color)
        .style('font-size', '12px')
        .style('font-weight', 500)
        .text(config.label);

      // Resource items
      const items = g.selectAll(`.resource-item-${type}`)
        .data(trackResources)
        .enter()
        .append('g')
        .attr('class', `resource-item-${type}`)
        .attr('transform', d => {
          const date = new Date(d.date || d.effectiveDateTime || d.authoredOn || d.created);
          return `translate(${xScale(date)},${trackY + trackHeight / 2})`;
        });

      // Resource circles
      items.append('circle')
        .attr('r', 0)
        .attr('fill', config.color)
        .attr('stroke', '#fff')
        .attr('stroke-width', 2)
        .style('cursor', 'pointer')
        .on('click', (_event, d) => {
          if (onResourceClick) {
            onResourceClick(d);
          }
        })
        .on('mouseenter', (event, d) => {
          setHoveredResource(d);
          // Get mouse position relative to the container
          const rect = containerRef.current.getBoundingClientRect();
          setHoveredPosition({
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
          });
          d3.select(event.target)
            .transition()
            .duration(200)
            .attr('r', 8);
        })
        .on('mousemove', (event, d) => {
          // Update position on mouse move
          const rect = containerRef.current.getBoundingClientRect();
          setHoveredPosition({
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
          });
        })
        .on('mouseleave', (event) => {
          setHoveredResource(null);
          d3.select(event.target)
            .transition()
            .duration(200)
            .attr('r', 6);
        })
        .transition()
        .duration(animate ? 500 : 0)
        .delay((_d, i) => animate ? i * 20 : 0)
        .attr('r', 6);

      // Period bars for resources with start/end dates
      trackResources.forEach(resource => {
        if (resource.period?.start && resource.period?.end) {
          const startDate = new Date(resource.period.start);
          const endDate = new Date(resource.period.end);
          
          g.append('rect')
            .attr('x', xScale(startDate))
            .attr('y', trackY + trackHeight / 2 - 4)
            .attr('width', Math.max(2, xScale(endDate) - xScale(startDate)))
            .attr('height', 8)
            .attr('fill', alpha(config.color, 0.3))
            .attr('stroke', config.color)
            .attr('stroke-width', 1)
            .attr('rx', 4)
            .style('cursor', 'pointer')
            .on('click', () => {
              if (onResourceClick) {
                onResourceClick(resource);
              }
            });
        }
      });
    });

    // Add brush for range selection
    if (onRangeSelect) {
      const brush = d3.brushX()
        .extent([[0, 0], [innerWidth, innerHeight]])
        .on('end', (event) => {
          if (!event.selection) return;
          const [x0, x1] = event.selection;
          const startDate = xScale.invert(x0);
          const endDate = xScale.invert(x1);
          onRangeSelect({ start: startDate, end: endDate });
          g.select('.brush').call(brush.clear);
        });

      g.append('g')
        .attr('class', 'brush')
        .call(brush);
    }

  }, [dimensions, filteredResources, groupedResources, timeBounds, theme, animate, highlightToday, onResourceClick, onRangeSelect, loading, timeRange]);

  // Handle type toggle
  const handleTypeToggle = (type) => {
    setSelectedTypes(prev => ({
      ...prev,
      [type]: !prev[type]
    }));
  };

  if (loading) {
    return (
      <Paper sx={{ p: 2, height, ...sx }}>
        <Stack spacing={2} height="100%">
          <Skeleton variant="rectangular" height={40} />
          <Skeleton variant="rectangular" flex={1} />
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 2, height, overflow: 'hidden', ...sx }}>
      <Stack spacing={2} height="100%">
        {/* Controls */}
        {showControls && (
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" spacing={1}>
              {/* Time range selector */}
              <ButtonGroup size="small">
                {timeRangePresets.slice(0, 3).map(preset => (
                  <Button
                    key={preset.label}
                    variant={timeRange === preset.days ? 'contained' : 'outlined'}
                    onClick={() => setTimeRange(preset.days)}
                  >
                    {preset.label}
                  </Button>
                ))}
              </ButtonGroup>

              {/* Filter button */}
              <IconButton 
                size="small"
                onClick={(e) => setFilterAnchor(e.currentTarget)}
              >
                <FilterListIcon />
              </IconButton>

              {/* Refresh button */}
              <IconButton size="small">
                <RefreshIcon />
              </IconButton>
            </Stack>

            {/* Zoom controls */}
            <Stack direction="row" spacing={1}>
              <IconButton size="small">
                <ZoomOutIcon />
              </IconButton>
              <IconButton size="small">
                <ZoomInIcon />
              </IconButton>
            </Stack>
          </Stack>
        )}

        {/* Timeline container */}
        <Box 
          ref={containerRef}
          sx={{ 
            flex: 1, 
            position: 'relative',
            backgroundColor: theme.palette.background.default,
            borderRadius: 1,
            border: `1px solid ${theme.palette.divider}`
          }}
        >
          <svg
            ref={svgRef}
            width={dimensions.width}
            height={dimensions.height - (showControls ? 56 : 0) - (showLegend ? 40 : 0)}
            style={{ display: 'block' }}
          />

          {/* Hover tooltip */}
          <AnimatePresence>
            {hoveredResource && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                style={{
                  position: 'absolute',
                  top: hoveredPosition.y - 10,
                  left: hoveredPosition.x + 10,
                  transform: 'translateY(-100%)',
                  pointerEvents: 'none',
                  zIndex: 1000
                }}
              >
                <Paper
                  elevation={8}
                  sx={{
                    p: 2,
                    maxWidth: 300,
                    backgroundColor: alpha(theme.palette.background.paper, 0.95)
                  }}
                >
                  <Typography variant="subtitle2" gutterBottom>
                    {hoveredResource.resourceType}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {hoveredResource.display || hoveredResource.code?.text || 'No description'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {format(
                      new Date(hoveredResource.date || hoveredResource.effectiveDateTime || hoveredResource.authoredOn || hoveredResource.created),
                      'PPP'
                    )}
                  </Typography>
                </Paper>
              </motion.div>
            )}
          </AnimatePresence>
        </Box>

        {/* Legend */}
        {showLegend && (
          <Stack direction="row" spacing={2} justifyContent="center">
            {Object.entries(resourceTypeConfig).map(([type, config]) => (
              <Stack 
                key={type} 
                direction="row" 
                alignItems="center" 
                spacing={0.5}
                sx={{ 
                  opacity: selectedTypes[type] ? 1 : 0.5,
                  cursor: 'pointer'
                }}
                onClick={() => handleTypeToggle(type)}
              >
                <Box
                  sx={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    backgroundColor: config.color
                  }}
                />
                <Typography variant="caption">
                  {config.label}
                </Typography>
              </Stack>
            ))}
          </Stack>
        )}
      </Stack>

      {/* Filter menu */}
      <Menu
        anchorEl={filterAnchor}
        open={Boolean(filterAnchor)}
        onClose={() => setFilterAnchor(null)}
      >
        <Box sx={{ p: 2, minWidth: 200 }}>
          <Typography variant="subtitle2" gutterBottom>
            Resource Types
          </Typography>
          {Object.entries(resourceTypeConfig).map(([type, config]) => (
            <FormControlLabel
              key={type}
              control={
                <Checkbox
                  checked={selectedTypes[type]}
                  onChange={() => handleTypeToggle(type)}
                  size="small"
                />
              }
              label={
                <Stack direction="row" alignItems="center" spacing={1}>
                  {config.icon}
                  <Typography variant="body2">{config.label}</Typography>
                </Stack>
              }
              sx={{ width: '100%', ml: 0 }}
            />
          ))}
        </Box>
        <Divider />
        <Box sx={{ p: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Time Range
          </Typography>
          {timeRangePresets.map(preset => (
            <MenuItem
              key={preset.label}
              selected={timeRange === preset.days}
              onClick={() => {
                setTimeRange(preset.days);
                setFilterAnchor(null);
              }}
            >
              {preset.label}
            </MenuItem>
          ))}
        </Box>
      </Menu>
    </Paper>
  );
});

ResourceTimeline.displayName = 'ResourceTimeline';

export default ResourceTimeline;