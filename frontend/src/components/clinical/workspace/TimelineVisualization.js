/**
 * Timeline Visualization Component
 * A responsive, performant timeline visualization for clinical events
 * Designed to fit properly on screen with mobile support
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  useTheme,
  useMediaQuery,
  alpha,
  Paper,
  Stack,
  Button,
  Zoom
} from '@mui/material';
import {
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  FitScreen as FitScreenIcon,
  NavigateBefore as PrevIcon,
  NavigateNext as NextIcon,
  LocalHospital as EncounterIcon,
  MedicalServices as ConditionIcon,
  Medication as MedicationIcon,
  Science as ObservationIcon,
  Healing as ProcedureIcon,
  Warning as AllergyIcon,
  Vaccines as ImmunizationIcon,
  Description as ReportIcon,
  Assignment as CarePlanIcon,
  Flag as GoalIcon,
  Circle as DefaultIcon
} from '@mui/icons-material';
import { format, parseISO, differenceInDays, addDays, startOfDay, endOfDay } from 'date-fns';

// Event type configuration
const eventTypeConfig = {
  Encounter: { color: '#2196f3', label: 'Visit', icon: EncounterIcon },
  Condition: { color: '#f44336', label: 'Condition', icon: ConditionIcon },
  MedicationRequest: { color: '#4caf50', label: 'Medication', icon: MedicationIcon },
  Observation: { color: '#ff9800', label: 'Lab/Vital', icon: ObservationIcon },
  Procedure: { color: '#9c27b0', label: 'Procedure', icon: ProcedureIcon },
  AllergyIntolerance: { color: '#ff5722', label: 'Allergy', icon: AllergyIcon },
  Immunization: { color: '#00bcd4', label: 'Vaccine', icon: ImmunizationIcon },
  DiagnosticReport: { color: '#3f51b5', label: 'Report', icon: ReportIcon },
  CarePlan: { color: '#009688', label: 'Care Plan', icon: CarePlanIcon },
  Goal: { color: '#795548', label: 'Goal', icon: GoalIcon }
};

const TimelineVisualization = ({
  events = [],
  height = 400,
  onEventClick,
  selectedEventId,
  density = 'comfortable'
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(800);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState(0);
  const [hoveredEvent, setHoveredEvent] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, offset: 0 });

  // Update container width on resize
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Calculate timeline bounds
  const timelineBounds = useMemo(() => {
    if (!events.length) return null;

    const dates = events
      .map(e => e.date || e.effectiveDateTime || e.period?.start)
      .filter(Boolean)
      .map(d => new Date(d));

    if (!dates.length) return null;

    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));

    // Add padding
    return {
      start: startOfDay(addDays(minDate, -7)),
      end: endOfDay(addDays(maxDate, 7))
    };
  }, [events]);

  // Group events by track (resource type)
  const eventsByTrack = useMemo(() => {
    const tracks = {};
    
    events.forEach(event => {
      const type = event.resourceType || 'Unknown';
      if (!tracks[type]) {
        tracks[type] = [];
      }
      tracks[type].push(event);
    });

    // Sort tracks by event count
    return Object.entries(tracks)
      .sort(([, a], [, b]) => b.length - a.length)
      .reduce((acc, [type, events]) => {
        acc[type] = events.sort((a, b) => {
          const dateA = new Date(a.date || a.effectiveDateTime || a.period?.start);
          const dateB = new Date(b.date || b.effectiveDateTime || b.period?.start);
          return dateA - dateB;
        });
        return acc;
      }, {});
  }, [events]);

  // Calculate positions
  const getEventPosition = (date) => {
    if (!timelineBounds) return 0;

    const totalDays = differenceInDays(timelineBounds.end, timelineBounds.start);
    const eventDays = differenceInDays(new Date(date), timelineBounds.start);
    const percentage = eventDays / totalDays;

    return percentage * containerWidth * zoom;
  };

  // Handle zoom
  const handleZoom = (direction) => {
    const newZoom = direction === 'in' 
      ? Math.min(zoom * 1.2, 5) 
      : Math.max(zoom / 1.2, 0.5);
    setZoom(newZoom);
  };

  const handleFitScreen = () => {
    setZoom(1);
    setPanOffset(0);
  };

  // Handle drag to pan
  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX,
      offset: panOffset
    });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    
    const deltaX = e.clientX - dragStart.x;
    setPanOffset(dragStart.offset + deltaX);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Track height based on density
  const trackHeight = density === 'compact' ? 40 : density === 'comfortable' ? 60 : 80;
  const eventSize = density === 'compact' ? 24 : density === 'comfortable' ? 32 : 40;

  if (!events.length || !timelineBounds) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="text.secondary">
          No timeline events to display
        </Typography>
      </Paper>
    );
  }

  // Mobile view - vertical timeline
  if (isMobile) {
    return (
      <Box sx={{ p: 2 }}>
        {Object.entries(eventsByTrack).map(([type, trackEvents]) => {
          const config = eventTypeConfig[type] || { color: '#666', label: type, icon: DefaultIcon };
          const MobileIcon = config.icon;
          
          return (
            <Box key={type} sx={{ mb: 3 }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <MobileIcon sx={{ fontSize: 24, color: config.color }} />
                <Typography variant="subtitle2">
                  {config.label} ({trackEvents.length})
                </Typography>
              </Stack>
              <Stack spacing={1}>
                {trackEvents.map((event, idx) => (
                  <Paper
                    key={`${event.id}-${idx}`}
                    sx={{
                      p: 1.5,
                      cursor: 'pointer',
                      borderLeft: 3,
                      borderLeftColor: config.color,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      '&:hover': { bgcolor: 'action.hover' }
                    }}
                    onClick={() => onEventClick?.(event)}
                  >
                    <Box
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: 1,
                        bgcolor: alpha(config.color, 0.1),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      <MobileIcon sx={{ fontSize: 18, color: config.color }} />
                    </Box>
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography variant="body2" noWrap>
                        {event.title || event.code?.text || 'Untitled'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {format(parseISO(event.date || event.effectiveDateTime), 'MMM d, yyyy')}
                      </Typography>
                    </Box>
                  </Paper>
                ))}
              </Stack>
            </Box>
          );
        })}
      </Box>
    );
  }

  // Desktop view - horizontal timeline
  const totalHeight = Object.keys(eventsByTrack).length * trackHeight + 100;

  return (
    <Box sx={{ position: 'relative', height: Math.min(height, totalHeight) }}>
      {/* Controls */}
      <Paper
        sx={{
          position: 'absolute',
          top: 8,
          right: 8,
          zIndex: 10,
          p: 1
        }}
      >
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="Zoom In">
            <IconButton size="small" onClick={() => handleZoom('in')}>
              <ZoomInIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Zoom Out">
            <IconButton size="small" onClick={() => handleZoom('out')}>
              <ZoomOutIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Fit to Screen">
            <IconButton size="small" onClick={handleFitScreen}>
              <FitScreenIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Paper>

      {/* Timeline Container */}
      <Box
        ref={containerRef}
        sx={{
          height: '100%',
          overflow: 'hidden',
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none',
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
          borderRadius: 1
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Timeline content */}
        <Box
          sx={{
            position: 'relative',
            width: containerWidth * zoom,
            height: totalHeight,
            transform: `translateX(${panOffset}px)`
          }}
        >
          {/* Date axis */}
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 40,
              borderBottom: 1,
              borderColor: 'divider',
              bgcolor: 'background.default'
            }}
          >
            {/* Date markers */}
            {Array.from({ length: Math.ceil(differenceInDays(timelineBounds.end, timelineBounds.start) / 30) + 1 }).map((_, i) => {
              const date = addDays(timelineBounds.start, i * 30);
              const x = getEventPosition(date);
              
              return (
                <Box
                  key={i}
                  sx={{
                    position: 'absolute',
                    left: x,
                    top: 0,
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    px: 1
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    {format(date, 'MMM yyyy')}
                  </Typography>
                </Box>
              );
            })}
          </Box>

          {/* Tracks */}
          {Object.entries(eventsByTrack).map(([type, trackEvents], trackIndex) => {
            const y = 40 + trackIndex * trackHeight;
            const config = eventTypeConfig[type] || { color: '#666', label: type, icon: DefaultIcon };
            const TrackIcon = config.icon;

            return (
              <Box
                key={type}
                sx={{
                  position: 'absolute',
                  top: y,
                  left: 0,
                  right: 0,
                  height: trackHeight,
                  borderBottom: 1,
                  borderColor: 'divider'
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
                  <Stack direction="row" spacing={1} alignItems="center">
                    <TrackIcon 
                      sx={{ 
                        fontSize: 20,
                        color: config.color
                      }} 
                    />
                    <Typography variant="body2" noWrap>
                      {config.label}
                    </Typography>
                    <Chip
                      label={trackEvents.length}
                      size="small"
                      sx={{ 
                        ml: 0.5, 
                        height: 20,
                        bgcolor: alpha(config.color, 0.1),
                        color: config.color,
                        fontWeight: 600
                      }}
                    />
                  </Stack>
                </Box>

                {/* Events */}
                {trackEvents.map((event, idx) => {
                  const eventDate = event.date || event.effectiveDateTime || event.period?.start;
                  if (!eventDate) return null;

                  const x = getEventPosition(eventDate);
                  const isHovered = hoveredEvent === event.id;
                  const isSelected = selectedEventId === event.id;
                  const EventIcon = config.icon || DefaultIcon;

                  return (
                    <Tooltip
                      key={`${event.id}-${idx}`}
                      title={
                        <Box>
                          <Typography variant="subtitle2">
                            {event.title || event.code?.text || 'Event'}
                          </Typography>
                          <Typography variant="caption">
                            {format(parseISO(eventDate), 'MMM d, yyyy h:mm a')}
                          </Typography>
                        </Box>
                      }
                      placement="top"
                    >
                      <Box
                        sx={{
                          position: 'absolute',
                          left: x + 150 - eventSize / 2,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          width: eventSize,
                          height: eventSize,
                          borderRadius: 1,
                          background: `linear-gradient(135deg, ${alpha(config.color, 0.1)} 0%, ${alpha(config.color, 0.2)} 100%)`,
                          border: 2,
                          borderColor: config.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          zIndex: isHovered || isSelected ? 10 : 1,
                          boxShadow: isHovered || isSelected ? theme.shadows[4] : theme.shadows[1],
                          transform: isHovered || isSelected ? 'translateY(-50%) scale(1.2)' : 'translateY(-50%)',
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            transform: 'translateY(-50%) scale(1.3)',
                            boxShadow: theme.shadows[6],
                            background: `linear-gradient(135deg, ${alpha(config.color, 0.2)} 0%, ${alpha(config.color, 0.3)} 100%)`,
                          }
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick?.(event);
                        }}
                        onMouseEnter={() => setHoveredEvent(event.id)}
                        onMouseLeave={() => setHoveredEvent(null)}
                      >
                        <EventIcon 
                          sx={{ 
                            fontSize: eventSize * 0.6,
                            color: config.color,
                            transition: 'transform 0.2s ease',
                            transform: isHovered ? 'rotate(12deg)' : 'rotate(0deg)'
                          }} 
                        />
                      </Box>
                    </Tooltip>
                  );
                })}
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
};

export default TimelineVisualization;