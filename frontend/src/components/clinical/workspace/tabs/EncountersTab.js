/**
 * Encounters Tab Component
 * Display and manage patient encounters
 */
import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Chip,
  Stack,
  Button,
  IconButton,
  Tooltip,
  Divider,
  Card,
  CardContent,
  CardActions,
  TextField,
  InputAdornment,
  Menu,
  MenuItem,
  FormControl,
  Select,
  InputLabel,
  CircularProgress,
  Alert,
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
  EventNote as EncounterIcon,
  LocalHospital as HospitalIcon,
  MedicalServices as ClinicIcon,
  LocalHospital as EmergencyIcon,
  Home as HomeIcon,
  Add as AddIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  MoreVert as MoreIcon,
  Edit as EditIcon,
  Description as NotesIcon,
  Print as PrintIcon,
  CalendarMonth as CalendarIcon,
  AccessTime as TimeIcon,
  Person as ProviderIcon
} from '@mui/icons-material';
import { format, parseISO, isWithinInterval, subMonths } from 'date-fns';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import { useNavigate } from 'react-router-dom';
import EncounterSummaryDialog from '../dialogs/EncounterSummaryDialog';

// Get encounter icon based on class
const getEncounterIcon = (encounterClass) => {
  switch (encounterClass?.code) {
    case 'IMP':
    case 'ACUTE':
      return <HospitalIcon color="error" />;
    case 'EMER':
      return <EmergencyIcon color="error" />;
    case 'HH':
      return <HomeIcon color="info" />;
    case 'AMB':
    default:
      return <ClinicIcon color="primary" />;
  }
};

// Get encounter type label
const getEncounterTypeLabel = (encounter) => {
  return encounter.type?.[0]?.text || 
         encounter.type?.[0]?.coding?.[0]?.display || 
         encounter.class?.display ||
         'Encounter';
};

// Encounter Card Component
const EncounterCard = ({ encounter, onViewDetails, onEdit }) => {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState(null);

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'finished': return 'success';
      case 'in-progress': return 'warning';
      case 'cancelled': return 'error';
      default: return 'default';
    }
  };

  const period = encounter.period || {};
  const startDate = period.start ? parseISO(period.start) : null;
  const endDate = period.end ? parseISO(period.end) : null;

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box sx={{ flex: 1 }}>
            <Stack direction="row" spacing={2} alignItems="center" mb={1}>
              {getEncounterIcon(encounter.class)}
              <Typography variant="h6">
                {getEncounterTypeLabel(encounter)}
              </Typography>
              <Chip 
                label={encounter.status} 
                size="small" 
                color={getStatusColor(encounter.status)}
              />
            </Stack>

            <Stack spacing={1}>
              {startDate && (
                <Stack direction="row" spacing={1} alignItems="center">
                  <CalendarIcon fontSize="small" color="action" />
                  <Typography variant="body2">
                    {format(startDate, 'MMM d, yyyy')}
                  </Typography>
                  <TimeIcon fontSize="small" color="action" />
                  <Typography variant="body2">
                    {format(startDate, 'h:mm a')}
                    {endDate && ` - ${format(endDate, 'h:mm a')}`}
                  </Typography>
                </Stack>
              )}

              {encounter.participant && (
                <Stack direction="row" spacing={1} alignItems="center">
                  <ProviderIcon fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">
                    {encounter.participant.find(p => 
                      p.type?.[0]?.coding?.[0]?.code === 'ATND'
                    )?.individual?.display || 'No provider recorded'}
                  </Typography>
                </Stack>
              )}

              {encounter.reasonCode && (
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Reason for visit:
                  </Typography>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 0.5 }}>
                    {encounter.reasonCode.map((reason, idx) => (
                      <Chip 
                        key={idx}
                        label={reason.text || reason.coding?.[0]?.display} 
                        size="small"
                        variant="outlined"
                      />
                    ))}
                  </Stack>
                </Box>
              )}
            </Stack>
          </Box>

          <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
            <MoreIcon />
          </IconButton>
        </Stack>
      </CardContent>

      <CardActions>
        <Button 
          size="small" 
          startIcon={<NotesIcon />}
          onClick={onViewDetails}
        >
          View Summary
        </Button>
        <Button 
          size="small" 
          startIcon={<EditIcon />}
          onClick={onEdit}
        >
          Edit
        </Button>
      </CardActions>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => { handleMenuClose(); window.print(); }}>
          <ListItemIcon>
            <PrintIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Print Summary</ListItemText>
        </MenuItem>
      </Menu>
    </Card>
  );
};

const EncountersTab = ({ patientId, onNotificationUpdate }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { getPatientResources, isLoading } = useFHIRResource();
  
  const [viewMode, setViewMode] = useState('cards'); // 'cards' or 'timeline'
  const [filterType, setFilterType] = useState('all');
  const [filterPeriod, setFilterPeriod] = useState('all'); // all, 1m, 3m, 6m, 1y
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedEncounter, setSelectedEncounter] = useState(null);
  const [summaryDialogOpen, setSummaryDialogOpen] = useState(false);

  useEffect(() => {
    setLoading(false);
  }, []);

  // Handle encounter selection for summary dialog
  const handleViewEncounterDetails = (encounter) => {
    setSelectedEncounter(encounter);
    setSummaryDialogOpen(true);
  };

  const handleCloseSummaryDialog = () => {
    setSummaryDialogOpen(false);
    setSelectedEncounter(null);
  };

  // Get encounters
  const encounters = getPatientResources(patientId, 'Encounter') || [];

  // Filter encounters
  const filteredEncounters = encounters.filter(encounter => {
    // Type filter
    const matchesType = filterType === 'all' || 
      encounter.class?.code === filterType;

    // Period filter
    let matchesPeriod = true;
    if (filterPeriod !== 'all' && encounter.period?.start) {
      const startDate = parseISO(encounter.period.start);
      const periodMap = {
        '1m': subMonths(new Date(), 1),
        '3m': subMonths(new Date(), 3),
        '6m': subMonths(new Date(), 6),
        '1y': subMonths(new Date(), 12)
      };
      matchesPeriod = isWithinInterval(startDate, {
        start: periodMap[filterPeriod],
        end: new Date()
      });
    }

    // Search filter
    const matchesSearch = !searchTerm || 
      getEncounterTypeLabel(encounter).toLowerCase().includes(searchTerm.toLowerCase()) ||
      encounter.reasonCode?.some(r => 
        (r.text || r.coding?.[0]?.display || '').toLowerCase().includes(searchTerm.toLowerCase())
      );

    return matchesType && matchesPeriod && matchesSearch;
  });

  // Sort by date descending
  const sortedEncounters = [...filteredEncounters].sort((a, b) => {
    const dateA = new Date(a.period?.start || 0);
    const dateB = new Date(b.period?.start || 0);
    return dateB - dateA;
  });

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
          Encounters
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          disabled
        >
          New Encounter
        </Button>
      </Stack>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField
            placeholder="Search encounters..."
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
            <InputLabel>Type</InputLabel>
            <Select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              label="Type"
            >
              <MenuItem value="all">All Types</MenuItem>
              <MenuItem value="AMB">Ambulatory</MenuItem>
              <MenuItem value="IMP">Inpatient</MenuItem>
              <MenuItem value="EMER">Emergency</MenuItem>
              <MenuItem value="HH">Home Health</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Period</InputLabel>
            <Select
              value={filterPeriod}
              onChange={(e) => setFilterPeriod(e.target.value)}
              label="Period"
            >
              <MenuItem value="all">All Time</MenuItem>
              <MenuItem value="1m">Last Month</MenuItem>
              <MenuItem value="3m">Last 3 Months</MenuItem>
              <MenuItem value="6m">Last 6 Months</MenuItem>
              <MenuItem value="1y">Last Year</MenuItem>
            </Select>
          </FormControl>

          <Button
            variant={viewMode === 'cards' ? 'contained' : 'outlined'}
            onClick={() => setViewMode('cards')}
          >
            Cards
          </Button>
          <Button
            variant={viewMode === 'timeline' ? 'contained' : 'outlined'}
            onClick={() => setViewMode('timeline')}
          >
            Timeline
          </Button>
        </Stack>
      </Paper>

      {/* Summary Stats */}
      <Stack direction="row" spacing={2} mb={3}>
        <Chip 
          label={`${sortedEncounters.length} Total Encounters`} 
          color="primary" 
        />
        <Chip 
          label={`${encounters.filter(e => e.status === 'finished').length} Completed`} 
          color="success" 
        />
        <Chip 
          label={`${encounters.filter(e => e.status === 'in-progress').length} In Progress`} 
          color="warning" 
        />
      </Stack>

      {/* Encounters List/Timeline */}
      {sortedEncounters.length === 0 ? (
        <Alert severity="info">
          No encounters found matching your criteria
        </Alert>
      ) : viewMode === 'cards' ? (
        <Box>
          {sortedEncounters.map((encounter) => (
            <EncounterCard
              key={encounter.id}
              encounter={encounter}
              onViewDetails={() => handleViewEncounterDetails(encounter)}
              onEdit={() => {}}
            />
          ))}
        </Box>
      ) : (
        <Timeline position="alternate">
          {sortedEncounters.map((encounter, index) => (
            <TimelineItem key={encounter.id}>
              <TimelineOppositeContent color="text.secondary">
                {encounter.period?.start && 
                  format(parseISO(encounter.period.start), 'MMM d, yyyy')
                }
              </TimelineOppositeContent>
              <TimelineSeparator>
                <TimelineDot color={encounter.status === 'finished' ? 'success' : 'warning'}>
                  {getEncounterIcon(encounter.class)}
                </TimelineDot>
                {index < sortedEncounters.length - 1 && <TimelineConnector />}
              </TimelineSeparator>
              <TimelineContent>
                <Card>
                  <CardContent>
                    <Typography variant="h6">
                      {getEncounterTypeLabel(encounter)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {encounter.participant?.find(p => 
                        p.type?.[0]?.coding?.[0]?.code === 'ATND'
                      )?.individual?.display || 'No provider recorded'}
                    </Typography>
                    <Button 
                      size="small" 
                      onClick={() => handleViewEncounterDetails(encounter)}
                      sx={{ mt: 1 }}
                    >
                      View Details
                    </Button>
                  </CardContent>
                </Card>
              </TimelineContent>
            </TimelineItem>
          ))}
        </Timeline>
      )}

      {/* Encounter Summary Dialog */}
      <EncounterSummaryDialog
        open={summaryDialogOpen}
        onClose={handleCloseSummaryDialog}
        encounter={selectedEncounter}
        patientId={patientId}
      />
    </Box>
  );
};

export default EncountersTab;