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
  alpha,
  Snackbar
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
  Person as ProviderIcon,
  Draw as SignIcon
} from '@mui/icons-material';
import { format, parseISO, isWithinInterval, subMonths } from 'date-fns';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import { useNavigate } from 'react-router-dom';
import EncounterSummaryDialog from '../dialogs/EncounterSummaryDialog';
import EncounterSigningDialog from '../dialogs/EncounterSigningDialog';
import EncounterCreationDialog from '../dialogs/EncounterCreationDialog';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import { printDocument, formatEncountersForPrint } from '../../../../utils/printUtils';
import { exportClinicalData, EXPORT_COLUMNS } from '../../../../utils/exportUtils';
import { GetApp as ExportIcon } from '@mui/icons-material';
import { useClinicalWorkflow, CLINICAL_EVENTS } from '../../../../contexts/ClinicalWorkflowContext';

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
const EncounterCard = ({ encounter, onViewDetails, onEdit, onSign }) => {
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
        {encounter.status === 'in-progress' && (
          <Button 
            size="small" 
            variant="contained"
            color="primary"
            startIcon={<SignIcon />}
            onClick={onSign}
          >
            Sign & Close
          </Button>
        )}
      </CardActions>

    </Card>
  );
};

const EncountersTab = ({ patientId, onNotificationUpdate }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { getPatientResources, isLoading, currentPatient } = useFHIRResource();
  const { publish, subscribe } = useClinicalWorkflow();
  
  const [viewMode, setViewMode] = useState('cards'); // 'cards' or 'timeline'
  const [filterType, setFilterType] = useState('all');
  const [filterPeriod, setFilterPeriod] = useState('all'); // all, 1m, 3m, 6m, 1y
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedEncounter, setSelectedEncounter] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [summaryDialogOpen, setSummaryDialogOpen] = useState(false);
  const [signingDialogOpen, setSigningDialogOpen] = useState(false);
  const [newEncounterDialogOpen, setNewEncounterDialogOpen] = useState(false);
  const [encounterCreationDialogOpen, setEncounterCreationDialogOpen] = useState(false);
  const [exportAnchorEl, setExportAnchorEl] = useState(null);
  const [newEncounterData, setNewEncounterData] = useState({
    type: 'AMB',
    reasonForVisit: '',
    provider: '',
    startDate: new Date().toISOString().split('T')[0],
    startTime: new Date().toTimeString().split(' ')[0].slice(0, 5)
  });

  useEffect(() => {
    setLoading(false);
  }, []);

  // Subscribe to encounter-related events
  useEffect(() => {
    const unsubscribers = [];

    // Subscribe to encounter updates from other modules
    unsubscribers.push(
      subscribe(CLINICAL_EVENTS.ORDER_PLACED, (data) => {
        if (data.encounterId) {
          // Refresh encounters when an order is placed in an encounter
          window.dispatchEvent(new CustomEvent('fhir-resources-updated', { 
            detail: { patientId } 
          }));
        }
      })
    );

    unsubscribers.push(
      subscribe(CLINICAL_EVENTS.RESULT_RECEIVED, (data) => {
        if (data.encounterId) {
          // Refresh encounters when results are received for an encounter
          window.dispatchEvent(new CustomEvent('fhir-resources-updated', { 
            detail: { patientId } 
          }));
        }
      })
    );

    // Cleanup subscriptions
    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, [patientId, subscribe]);

  // Handle encounter selection for summary dialog
  const handleViewEncounterDetails = (encounter) => {
    setSelectedEncounter(encounter);
    setSummaryDialogOpen(true);
  };

  const handleCloseSummaryDialog = () => {
    setSummaryDialogOpen(false);
    setSelectedEncounter(null);
  };

  const handleSignEncounter = (encounter) => {
    setSelectedEncounter(encounter);
    setSigningDialogOpen(true);
  };

  const handleCloseSigningDialog = () => {
    setSigningDialogOpen(false);
    setSelectedEncounter(null);
  };

  const handleEncounterSigned = (signedEncounter) => {
    setSnackbar({
      open: true,
      message: 'Encounter signed successfully',
      severity: 'success'
    });
    
    // Refresh encounter data
    window.dispatchEvent(new CustomEvent('fhir-resources-updated', { 
      detail: { patientId } 
    }));
  };

  const handleNewEncounter = () => {
    setEncounterCreationDialogOpen(true);
  };

  const handleEncounterCreated = (newEncounter) => {
    setSnackbar({
      open: true,
      message: 'Encounter created successfully',
      severity: 'success'
    });
    
    // Refresh encounter data
    window.dispatchEvent(new CustomEvent('fhir-resources-updated', { 
      detail: { patientId } 
    }));
  };

  const handlePrintEncounters = () => {
    const patientInfo = {
      name: currentPatient ? 
        `${currentPatient.name?.[0]?.given?.join(' ') || ''} ${currentPatient.name?.[0]?.family || ''}`.trim() : 
        'Unknown Patient',
      mrn: currentPatient?.identifier?.find(id => id.type?.coding?.[0]?.code === 'MR')?.value || currentPatient?.id,
      birthDate: currentPatient?.birthDate,
      gender: currentPatient?.gender,
      phone: currentPatient?.telecom?.find(t => t.system === 'phone')?.value
    };
    
    const content = formatEncountersForPrint(sortedEncounters);
    
    printDocument({
      title: 'Patient Encounters',
      patient: patientInfo,
      content
    });
  };

  const handleExportEncounters = (format) => {
    exportClinicalData({
      patient: currentPatient,
      data: filteredEncounters,
      columns: EXPORT_COLUMNS.encounters,
      format,
      title: 'Encounter_History',
      formatForPrint: (data) => {
        let html = '<h2>Encounter History</h2>';
        data.forEach(encounter => {
          const startDate = encounter.period?.start ? format(parseISO(encounter.period.start), 'MMM d, yyyy h:mm a') : 'Unknown';
          const endDate = encounter.period?.end ? format(parseISO(encounter.period.end), 'MMM d, yyyy h:mm a') : 'Ongoing';
          
          html += `
            <div class="section">
              <h3>${getEncounterTypeLabel(encounter)}</h3>
              <p><strong>Status:</strong> ${encounter.status}</p>
              <p><strong>Start:</strong> ${startDate}</p>
              <p><strong>End:</strong> ${endDate}</p>
              ${encounter.participant?.[0]?.individual?.display ? 
                `<p><strong>Provider:</strong> ${encounter.participant[0].individual.display}</p>` : ''}
              ${encounter.location?.[0]?.location?.display ? 
                `<p><strong>Location:</strong> ${encounter.location[0].location.display}</p>` : ''}
              ${encounter.reasonCode?.[0]?.text ? 
                `<p><strong>Reason:</strong> ${encounter.reasonCode[0].text}</p>` : ''}
            </div>
          `;
        });
        return html;
      }
    });
  };
  
  const handleCreateEncounter = async () => {
    try {
      // Create FHIR Encounter resource
      const encounter = {
        resourceType: 'Encounter',
        status: 'in-progress',
        class: {
          system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
          code: newEncounterData.type,
          display: newEncounterData.type === 'AMB' ? 'ambulatory' : 
                  newEncounterData.type === 'IMP' ? 'inpatient' : 
                  newEncounterData.type === 'EMER' ? 'emergency' : 'ambulatory'
        },
        type: [{
          text: 'Office Visit'
        }],
        subject: {
          reference: `Patient/${patientId}`
        },
        period: {
          start: `${newEncounterData.startDate}T${newEncounterData.startTime}:00`
        },
        reasonCode: newEncounterData.reasonForVisit ? [{
          text: newEncounterData.reasonForVisit
        }] : [],
        participant: newEncounterData.provider ? [{
          type: [{
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
              code: 'ATND',
              display: 'attender'
            }]
          }],
          individual: {
            display: newEncounterData.provider
          }
        }] : []
      };

      const response = await fetch('/fhir/R4/Encounter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(encounter)
      });

      if (response.ok) {
        const savedEncounter = await response.json();
        
        // Publish encounter created event
        await publish(CLINICAL_EVENTS.ENCOUNTER_CREATED, {
          encounterId: savedEncounter.id,
          patientId,
          type: newEncounterData.type,
          reasonForVisit: newEncounterData.reasonForVisit,
          provider: newEncounterData.provider,
          timestamp: new Date().toISOString()
        });
        
        // Refresh patient resources to show new encounter
        window.dispatchEvent(new CustomEvent('fhir-resources-updated', { 
          detail: { patientId } 
        }));
        
        setNewEncounterDialogOpen(false);
        setNewEncounterData({
          type: 'AMB',
          reasonForVisit: '',
          provider: '',
          startDate: new Date().toISOString().split('T')[0],
          startTime: new Date().toTimeString().split(' ')[0].slice(0, 5)
        });

        setSnackbar({
          open: true,
          message: 'New encounter created successfully',
          severity: 'success'
        });
      } else {
        throw new Error(`Failed to create encounter: ${response.statusText}`);
        setSnackbar({
          open: true,
          message: 'Failed to create encounter',
          severity: 'error'
        });
      }
    } catch (error) {
      // Handle error
      setSnackbar({
        open: true,
        message: 'Failed to create encounter: ' + error.message,
        severity: 'error'
      });
    }
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
          onClick={handleNewEncounter}
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
          <Button
            variant="outlined"
            startIcon={<PrintIcon />}
            onClick={handlePrintEncounters}
          >
            Print
          </Button>
          <Button
            variant="outlined"
            startIcon={<ExportIcon />}
            onClick={(e) => setExportAnchorEl(e.currentTarget)}
          >
            Export
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
              onSign={() => handleSignEncounter(encounter)}
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
      {/* Export Menu */}
      <Menu
        anchorEl={exportAnchorEl}
        open={Boolean(exportAnchorEl)}
        onClose={() => setExportAnchorEl(null)}
      >
        <MenuItem onClick={() => { handleExportEncounters('csv'); setExportAnchorEl(null); }}>
          Export as CSV
        </MenuItem>
        <MenuItem onClick={() => { handleExportEncounters('json'); setExportAnchorEl(null); }}>
          Export as JSON
        </MenuItem>
        <MenuItem onClick={() => { handleExportEncounters('pdf'); setExportAnchorEl(null); }}>
          Export as PDF
        </MenuItem>
      </Menu>

      <EncounterSummaryDialog
        open={summaryDialogOpen}
        onClose={handleCloseSummaryDialog}
        encounter={selectedEncounter}
        patientId={patientId}
      />

      {/* Encounter Signing Dialog */}
      <EncounterSigningDialog
        open={signingDialogOpen}
        onClose={handleCloseSigningDialog}
        encounter={selectedEncounter}
        patientId={patientId}
        onEncounterSigned={handleEncounterSigned}
      />

      {/* Enhanced Encounter Creation Dialog */}
      <EncounterCreationDialog
        open={encounterCreationDialogOpen}
        onClose={() => setEncounterCreationDialogOpen(false)}
        patientId={patientId}
        onEncounterCreated={handleEncounterCreated}
      />

      {/* New Encounter Dialog */}
      <Dialog open={newEncounterDialogOpen} onClose={() => setNewEncounterDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New Encounter</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Encounter Type</InputLabel>
              <Select
                value={newEncounterData.type}
                onChange={(e) => setNewEncounterData({ ...newEncounterData, type: e.target.value })}
                label="Encounter Type"
              >
                <MenuItem value="AMB">Ambulatory (Office Visit)</MenuItem>
                <MenuItem value="IMP">Inpatient</MenuItem>
                <MenuItem value="EMER">Emergency</MenuItem>
                <MenuItem value="HH">Home Health</MenuItem>
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="Reason for Visit"
              value={newEncounterData.reasonForVisit}
              onChange={(e) => setNewEncounterData({ ...newEncounterData, reasonForVisit: e.target.value })}
              multiline
              rows={2}
            />

            <TextField
              fullWidth
              label="Provider"
              value={newEncounterData.provider}
              onChange={(e) => setNewEncounterData({ ...newEncounterData, provider: e.target.value })}
              placeholder="Enter provider name"
            />

            <Stack direction="row" spacing={2}>
              <TextField
                label="Date"
                type="date"
                value={newEncounterData.startDate}
                onChange={(e) => setNewEncounterData({ ...newEncounterData, startDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <TextField
                label="Time"
                type="time"
                value={newEncounterData.startTime}
                onChange={(e) => setNewEncounterData({ ...newEncounterData, startTime: e.target.value })}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewEncounterDialogOpen(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleCreateEncounter}
            disabled={!newEncounterData.reasonForVisit.trim()}
          >
            Create Encounter
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
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

export default EncountersTab;