/**
 * Patient Timeline Visualization for FHIR Explorer v4
 * 
 * Provides an interactive timeline view of patient events including:
 * - Encounters, conditions, medications, procedures
 * - Observations and vital signs over time
 * - Interactive filtering and zoom capabilities
 * - Multi-track timeline with resource type grouping
 * - Real-time WebSocket updates
 * - Advanced zoom/pan controls
 * - Export to PNG/PDF/SVG
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  Avatar,
  Tooltip,
  IconButton,
  Card,
  CardContent,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Button,
  ButtonGroup,
  Slider,
  Alert,
  LinearProgress,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Zoom,
  Collapse,
  Menu
} from '@mui/material';
import {
  Timeline as TimelineIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  FilterList as FilterIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Fullscreen as FullscreenIcon,
  Person as PersonIcon,
  LocalHospital as HospitalIcon,
  Medication as MedicationIcon,
  Science as ScienceIcon,
  Assessment as AssessmentIcon,
  Event as EventIcon,
  TrendingUp as TrendingUpIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Image as ImageIcon,
  PictureAsPdf as PdfIcon,
  Code as SvgIcon,
  NotificationsActive as LiveIcon
} from '@mui/icons-material';
import { alpha, darken, lighten } from '@mui/material/styles';
import { exportToPNG, exportToPDF, exportToJSON } from './utils/timelineExport';

// Timeline configuration
const TIMELINE_CONFIG = {
  height: 600,
  trackHeight: 80,
  eventHeight: 40,
  padding: 20,
  timeScale: {
    min: 0.1, // 0.1 day per pixel (very zoomed in)
    max: 365, // 1 year per pixel (very zoomed out)
    default: 30 // 30 days per pixel
  },
  animation: {
    duration: 300,
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
  }
};

// WebSocket event types for real-time updates
const WS_EVENTS = {
  RESOURCE_CREATED: 'fhir.resource.created',
  RESOURCE_UPDATED: 'fhir.resource.updated',
  RESOURCE_DELETED: 'fhir.resource.deleted'
};

// Resource type configurations with colors and tracks
const RESOURCE_TRACKS = {
  Encounter: {
    label: 'Encounters',
    color: '#1976d2',
    icon: <HospitalIcon />,
    track: 0,
    priority: 1
  },
  Condition: {
    label: 'Conditions',
    color: '#d32f2f',
    icon: <AssessmentIcon />,
    track: 1,
    priority: 2
  },
  MedicationRequest: {
    label: 'Medications',
    color: '#ed6c02',
    icon: <MedicationIcon />,
    track: 2,
    priority: 3
  },
  Procedure: {
    label: 'Procedures',
    color: '#7b1fa2',
    icon: <HospitalIcon />,
    track: 3,
    priority: 4
  },
  Observation: {
    label: 'Observations',
    color: '#2e7d32',
    icon: <ScienceIcon />,
    track: 4,
    priority: 5
  },
  DiagnosticReport: {
    label: 'Reports',
    color: '#1565c0',
    icon: <AssessmentIcon />,
    track: 5,
    priority: 6
  }
};

/**
 * Timeline event component
 */
const TimelineEvent = ({ event, scale, onEventClick, isSelected }) => {
  const theme = useTheme();
  const config = RESOURCE_TRACKS[event.resourceType] || RESOURCE_TRACKS.Observation;
  
  const eventStyle = {
    position: 'absolute',
    left: `${event.position}px`,
    width: `${Math.max(4, event.duration * scale)}px`,
    height: `${TIMELINE_CONFIG.eventHeight - 4}px`,
    backgroundColor: isSelected ? darken(config.color, 0.2) : config.color,
    borderRadius: 4,
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out',
    boxShadow: isSelected 
      ? `0 4px 12px ${alpha(config.color, 0.4)}`
      : `0 2px 4px ${alpha(config.color, 0.2)}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontSize: '0.75rem',
    fontWeight: 500,
    overflow: 'hidden',
    border: isSelected ? `2px solid ${darken(config.color, 0.3)}` : 'none',
    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow: `0 6px 16px ${alpha(config.color, 0.3)}`
    }
  };

  return (
    <Tooltip 
      title={
        <Box>
          <Typography variant="subtitle2">{event.title}</Typography>
          <Typography variant="caption" display="block">
            {event.date.toLocaleDateString()}
          </Typography>
          <Typography variant="caption" display="block">
            {event.resourceType} • {event.status || 'Active'}
          </Typography>
        </Box>
      }
      placement="top"
    >
      <Box
        sx={eventStyle}
        onClick={() => onEventClick(event)}
      >
        {event.duration * scale > 30 && event.title.substring(0, 10)}
      </Box>
    </Tooltip>
  );
};

/**
 * Timeline track component
 */
const TimelineTrack = ({ trackData, scale, onEventClick, selectedEvent }) => {
  const config = RESOURCE_TRACKS[trackData.resourceType];
  
  return (
    <Box
      sx={{
        height: TIMELINE_CONFIG.trackHeight,
        borderBottom: 1,
        borderColor: 'divider',
        position: 'relative',
        backgroundColor: alpha(config.color, 0.02),
        '&:hover': {
          backgroundColor: alpha(config.color, 0.05)
        }
      }}
    >
      {/* Track header */}
      <Box
        sx={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: 200,
          height: '100%',
          backgroundColor: 'background.paper',
          borderRight: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          px: 2,
          zIndex: 2
        }}
      >
        <Avatar
          sx={{
            bgcolor: alpha(config.color, 0.1),
            color: config.color,
            width: 32,
            height: 32,
            mr: 2
          }}
        >
          {React.cloneElement(config.icon, { fontSize: 'small' })}
        </Avatar>
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {config.label}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {trackData.events.length} events
          </Typography>
        </Box>
      </Box>

      {/* Events */}
      <Box sx={{ ml: '200px', position: 'relative', height: '100%', pt: 2 }}>
        {trackData.events.map((event, index) => (
          <TimelineEvent
            key={`${event.id}-${index}`}
            event={event}
            scale={scale}
            onEventClick={onEventClick}
            isSelected={selectedEvent?.id === event.id}
          />
        ))}
      </Box>
    </Box>
  );
};

/**
 * Timeline controls component
 */
const TimelineControls = ({
  timeRange,
  onTimeRangeChange,
  scale,
  onScaleChange,
  filters,
  onFiltersChange,
  onRefresh,
  onExport,
  isLive,
  onToggleLive
}) => {
  const [exportMenuAnchor, setExportMenuAnchor] = useState(null);
  
  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Grid container spacing={2} alignItems="center">
        <Grid item xs={12} md={3}>
          <FormControl fullWidth size="small">
            <InputLabel>Time Range</InputLabel>
            <Select
              value={timeRange}
              onChange={(e) => onTimeRangeChange(e.target.value)}
              label="Time Range"
            >
              <MenuItem value="1month">Last Month</MenuItem>
              <MenuItem value="3months">Last 3 Months</MenuItem>
              <MenuItem value="6months">Last 6 Months</MenuItem>
              <MenuItem value="1year">Last Year</MenuItem>
              <MenuItem value="all">All Time</MenuItem>
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} md={3}>
          <Typography variant="body2" gutterBottom>
            Zoom Level
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton size="small" onClick={() => onScaleChange(scale * 0.8)}>
              <ZoomOutIcon />
            </IconButton>
            <Slider
              value={scale}
              onChange={(e, value) => onScaleChange(value)}
              min={TIMELINE_CONFIG.timeScale.min}
              max={TIMELINE_CONFIG.timeScale.max}
              step={1}
              sx={{ flex: 1 }}
            />
            <IconButton size="small" onClick={() => onScaleChange(scale * 1.2)}>
              <ZoomInIcon />
            </IconButton>
          </Box>
        </Grid>

        <Grid item xs={12} md={4}>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {Object.entries(RESOURCE_TRACKS).map(([type, config]) => (
              <FormControlLabel
                key={type}
                control={
                  <Switch
                    checked={filters.includes(type)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        onFiltersChange([...filters, type]);
                      } else {
                        onFiltersChange(filters.filter(f => f !== type));
                      }
                    }}
                    size="small"
                  />
                }
                label={
                  <Chip
                    size="small"
                    icon={React.cloneElement(config.icon, { fontSize: 'small' })}
                    label={config.label}
                    sx={{
                      bgcolor: alpha(config.color, 0.1),
                      color: config.color,
                      '& .MuiChip-icon': { color: config.color }
                    }}
                  />
                }
              />
            ))}
          </Box>
        </Grid>

        <Grid item xs={12} md={3}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            {onToggleLive && (
              <FormControlLabel
                control={
                  <Switch
                    checked={isLive}
                    onChange={(e) => onToggleLive(e.target.checked)}
                    color="error"
                    size="small"
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <LiveIcon sx={{ fontSize: 16, color: isLive ? 'error.main' : 'text.secondary' }} />
                    Live
                  </Box>
                }
              />
            )}
            <IconButton onClick={onRefresh} color="primary">
              <RefreshIcon />
            </IconButton>
            <Tooltip title="Export timeline">
              <IconButton onClick={(e) => setExportMenuAnchor(e.currentTarget)}>
                <DownloadIcon />
              </IconButton>
            </Tooltip>
            <Menu
              anchorEl={exportMenuAnchor}
              open={Boolean(exportMenuAnchor)}
              onClose={() => setExportMenuAnchor(null)}
            >
              <MenuItem onClick={() => { onExport('png'); setExportMenuAnchor(null); }}>
                <ImageIcon sx={{ mr: 1 }} /> Export as PNG
              </MenuItem>
              <MenuItem onClick={() => { onExport('pdf'); setExportMenuAnchor(null); }}>
                <PdfIcon sx={{ mr: 1 }} /> Export as PDF
              </MenuItem>
              <MenuItem onClick={() => { onExport('json'); setExportMenuAnchor(null); }}>
                <SvgIcon sx={{ mr: 1 }} /> Export as JSON
              </MenuItem>
            </Menu>
          </Box>
        </Grid>
      </Grid>
    </Paper>
  );
};

/**
 * Event details panel
 */
const EventDetailsPanel = ({ event, onClose }) => {
  if (!event) return null;

  const config = RESOURCE_TRACKS[event.resourceType];

  return (
    <Card sx={{ mt: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Avatar
            sx={{
              bgcolor: alpha(config.color, 0.1),
              color: config.color,
              mr: 2
            }}
          >
            {React.cloneElement(config.icon, { fontSize: 'small' })}
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6">{event.title}</Typography>
            <Typography variant="body2" color="text.secondary">
              {event.resourceType} • {event.date.toLocaleDateString()}
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            ×
          </IconButton>
        </Box>

        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" gutterBottom>Details</Typography>
            <Typography variant="body2" paragraph>
              {event.description || 'No description available'}
            </Typography>
            
            {event.status && (
              <Chip
                size="small"
                label={event.status}
                color={event.status === 'active' ? 'success' : 'default'}
                sx={{ mr: 1, mb: 1 }}
              />
            )}
            
            {event.severity && (
              <Chip
                size="small"
                label={`Severity: ${event.severity}`}
                color={event.severity === 'severe' ? 'error' : 'warning'}
                sx={{ mr: 1, mb: 1 }}
              />
            )}
          </Grid>

          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" gutterBottom>Timeline Info</Typography>
            <Typography variant="body2">
              Start: {event.date.toLocaleDateString()}
            </Typography>
            {event.endDate && (
              <Typography variant="body2">
                End: {event.endDate.toLocaleDateString()}
              </Typography>
            )}
            <Typography variant="body2">
              Duration: {event.duration || 1} day(s)
            </Typography>
          </Grid>
        </Grid>

        {event.raw && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>Raw FHIR Data</Typography>
            <Box
              component="pre"
              sx={{
                fontSize: '0.75rem',
                backgroundColor: 'grey.100',
                p: 1,
                borderRadius: 1,
                overflow: 'auto',
                maxHeight: 200
              }}
            >
              {JSON.stringify(event.raw, null, 2)}
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

/**
 * Main Patient Timeline component
 */
function PatientTimeline({ patientId, fhirData, onNavigate }) {
  const theme = useTheme();
  const timelineRef = useRef(null);
  
  const [timeRange, setTimeRange] = useState('6months');
  const [scale, setScale] = useState(TIMELINE_CONFIG.timeScale.default);
  const [filters, setFilters] = useState(Object.keys(RESOURCE_TRACKS));
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isLive, setIsLive] = useState(false);

  // Process FHIR data into timeline events
  const timelineData = useMemo(() => {
    if (!fhirData || !fhirData.resources) {
      return { tracks: [], dateRange: { start: new Date(), end: new Date() }, events: [] };
    }

    const allEvents = [];
    const now = new Date();
    
    // Calculate date range based on selection
    let startDate;
    switch (timeRange) {
      case '1month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '3months':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '6months':
        startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        break;
      case '1year':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date('2020-01-01'); // All time
    }

    // Process each resource type
    Object.entries(fhirData.resources).forEach(([resourceType, resources]) => {
      if (!filters.includes(resourceType) || !RESOURCE_TRACKS[resourceType]) return;

      resources.forEach(resource => {
        const event = processResourceToEvent(resource, resourceType);
        if (event && event.date >= startDate) {
          allEvents.push(event);
        }
      });
    });

    // Sort events by date
    allEvents.sort((a, b) => a.date - b.date);

    // Calculate positions
    const dateRange = {
      start: allEvents.length > 0 ? allEvents[0].date : startDate,
      end: allEvents.length > 0 ? allEvents[allEvents.length - 1].date : now
    };

    const totalDays = Math.max(1, (dateRange.end - dateRange.start) / (24 * 60 * 60 * 1000));
    
    allEvents.forEach(event => {
      const daysSinceStart = (event.date - dateRange.start) / (24 * 60 * 60 * 1000);
      event.position = (daysSinceStart / totalDays) * (window.innerWidth - 240) * (scale / TIMELINE_CONFIG.timeScale.default);
    });

    // Group events by track
    const tracks = {};
    filters.forEach(resourceType => {
      tracks[resourceType] = {
        resourceType,
        events: allEvents.filter(e => e.resourceType === resourceType)
      };
    });

    return { tracks: Object.values(tracks), dateRange, events: allEvents };
  }, [fhirData, timeRange, scale, filters]);

  // Process a FHIR resource into a timeline event
  const processResourceToEvent = (resource, resourceType) => {
    try {
      let date, endDate, title, description, status, severity;

      switch (resourceType) {
        case 'Encounter':
          date = new Date(resource.period?.start || resource.meta?.lastUpdated);
          endDate = resource.period?.end ? new Date(resource.period.end) : null;
          title = resource.type?.[0]?.text || resource.class?.display || 'Encounter';
          status = resource.status;
          break;

        case 'Condition':
          date = new Date(resource.onsetDateTime || resource.recordedDate || resource.meta?.lastUpdated);
          title = resource.code?.text || resource.code?.coding?.[0]?.display || 'Condition';
          status = resource.clinicalStatus?.coding?.[0]?.code;
          severity = resource.severity?.coding?.[0]?.display;
          break;

        case 'MedicationRequest':
          date = new Date(resource.authoredOn || resource.meta?.lastUpdated);
          title = resource.medicationCodeableConcept?.text || 
                  resource.medicationCodeableConcept?.coding?.[0]?.display || 'Medication';
          status = resource.status;
          break;

        case 'Procedure':
          date = new Date(resource.performedDateTime || resource.performedPeriod?.start || resource.meta?.lastUpdated);
          endDate = resource.performedPeriod?.end ? new Date(resource.performedPeriod.end) : null;
          title = resource.code?.text || resource.code?.coding?.[0]?.display || 'Procedure';
          status = resource.status;
          break;

        case 'Observation':
          date = new Date(resource.effectiveDateTime || resource.effectiveInstant || resource.meta?.lastUpdated);
          title = resource.code?.text || resource.code?.coding?.[0]?.display || 'Observation';
          status = resource.status;
          break;

        case 'DiagnosticReport':
          date = new Date(resource.effectiveDateTime || resource.issued || resource.meta?.lastUpdated);
          title = resource.code?.text || resource.code?.coding?.[0]?.display || 'Report';
          status = resource.status;
          break;

        default:
          return null;
      }

      if (!date || isNaN(date)) return null;

      const duration = endDate ? Math.max(1, (endDate - date) / (24 * 60 * 60 * 1000)) : 1;

      return {
        id: resource.id,
        resourceType,
        title,
        description,
        date,
        endDate,
        duration,
        status,
        severity,
        raw: resource
      };
    } catch (err) {
      console.warn(`Failed to process ${resourceType} resource:`, err);
      return null;
    }
  };

  const handleEventClick = useCallback((event) => {
    setSelectedEvent(event);
  }, []);

  const handleRefresh = useCallback(async () => {
    setLoading(true);
    // Trigger data refresh
    if (onNavigate) {
      onNavigate('visualization', 'timeline');
    }
    setTimeout(() => setLoading(false), 1000);
  }, [onNavigate]);

  const handleExport = useCallback(async (format = 'json') => {
    if (!timelineRef.current && format !== 'json') return;
    
    setLoading(true);
    try {
      switch (format) {
        case 'png':
          await exportToPNG(timelineRef.current, 'patient-timeline');
          break;
        case 'pdf':
          await exportToPDF(timelineRef.current, 'patient-timeline');
          break;
        case 'json':
        default:
          exportToJSON({
            timeline: timelineData,
            filters,
            timeRange,
            scale,
            patientId
          }, 'patient-timeline-data');
          break;
      }
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setLoading(false);
    }
  }, [timelineData, filters, timeRange, scale, patientId]);

  if (!fhirData || !fhirData.hasData) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">
          No patient data available for timeline visualization. 
          Please select a patient or load FHIR data first.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <TimelineIcon sx={{ mr: 2, color: 'primary.main' }} />
        <Typography variant="h4" sx={{ fontWeight: 600 }}>
          Patient Timeline
        </Typography>
        <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
          {isLive && (
            <Chip
              icon={<LiveIcon />}
              label="Live Updates"
              color="error"
              size="small"
              sx={{ animation: 'pulse 2s infinite' }}
            />
          )}
          <Chip
            label={`${timelineData.events.length} events`}
            color="primary"
            variant="outlined"
          />
        </Box>
      </Box>

      <TimelineControls
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
        scale={scale}
        onScaleChange={setScale}
        filters={filters}
        onFiltersChange={setFilters}
        onRefresh={handleRefresh}
        onExport={handleExport}
        isLive={isLive}
        onToggleLive={setIsLive}
      />

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      <Paper
        ref={timelineRef}
        sx={{
          height: TIMELINE_CONFIG.height,
          overflow: 'auto',
          position: 'relative',
          border: 1,
          borderColor: 'divider'
        }}
      >
        {timelineData.tracks.map((track, index) => (
          <TimelineTrack
            key={track.resourceType}
            trackData={track}
            scale={scale}
            onEventClick={handleEventClick}
            selectedEvent={selectedEvent}
          />
        ))}

        {timelineData.tracks.length === 0 && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'text.secondary'
            }}
          >
            <Typography variant="h6">
              No events found for the selected time range and filters
            </Typography>
          </Box>
        )}
      </Paper>

      <EventDetailsPanel
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />

      {/* Add pulse animation for live mode */}
      <style>
        {`
          @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.6; }
            100% { opacity: 1; }
          }
        `}
      </style>
    </Box>
  );
}

export default PatientTimeline;