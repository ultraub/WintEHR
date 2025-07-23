/**
 * Encounters Tab Component
 * Display and manage patient encounters
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  Stack,
  Button,
  IconButton,
  Tooltip,
  Divider,
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
  Snackbar,
  Badge,
  Grid,
  ToggleButton,
  ToggleButtonGroup,
  Collapse
} from '@mui/material';
import {
  LocalHospital as HospitalIcon,
  MedicalServices as ClinicIcon,
  LocalHospital as EmergencyIcon,
  Home as HomeIcon,
  Add as AddIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Description as NotesIcon,
  Print as PrintIcon,
  CalendarMonth as CalendarIcon,
  AccessTime as TimeIcon,
  Draw as SignIcon,
  Assignment as AssignmentIcon,
  Science as LabIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import { format, parseISO, isWithinInterval, subMonths } from 'date-fns';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import EncounterSummaryDialog from '../dialogs/EncounterSummaryDialog';
import EncounterSigningDialog from '../dialogs/EncounterSigningDialog';
import EncounterCreationDialog from '../dialogs/EncounterCreationDialog';
import EnhancedNoteEditor from '../dialogs/EnhancedNoteEditor';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import { printDocument, formatEncountersForPrint } from '../../../../core/export/printUtils';
import { exportClinicalData, EXPORT_COLUMNS } from '../../../../core/export/exportUtils';
import { GetApp as ExportIcon } from '@mui/icons-material';
import { useClinicalWorkflow, CLINICAL_EVENTS } from '../../../../contexts/ClinicalWorkflowContext';
import { getEncounterClass, getCodeableConceptDisplay, getEncounterStatus } from '../../../../core/fhir/utils/fhirFieldUtils';
import EnhancedProviderDisplay from '../components/EnhancedProviderDisplay';
import ClinicalCard from '../../ui/ClinicalCard';
import ResourceTimeline from '../../ui/ResourceTimeline';
import SmartTable from '../../ui/SmartTable';
import { ContextualFAB } from '../../ui/QuickActionFAB';
import { ViewControls, useDensity } from '../../ui/DensityControl';
import MetricsBar from '../../ui/MetricsBar';
import { motion, AnimatePresence } from 'framer-motion';

// Get encounter icon based on class
const getEncounterIcon = (encounter) => {
  // Use resilient utility to get encounter class
  const classCode = getEncounterClass(encounter);
    
  switch (classCode) {
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
  // Try to get type first, then fallback to class
  const typeDisplay = encounter.type?.[0] ? getCodeableConceptDisplay(encounter.type[0]) : null;
  if (typeDisplay && typeDisplay !== 'Unknown') {
    return typeDisplay;
  }
  
  // Fallback to class display
  const classCode = getEncounterClass(encounter);
  switch (classCode) {
    case 'AMB': return 'Ambulatory';
    case 'IMP': return 'Inpatient';
    case 'EMER': return 'Emergency';
    case 'HH': return 'Home Health';
    default: return 'Encounter';
  }
};

// Enhanced Encounter Card Component with new UI components
const EncounterCard = ({ encounter, onViewDetails, onEdit, onSign, onAddNote, density = 'comfortable', expanded = false, onToggleExpand }) => {
  const [localExpanded, setLocalExpanded] = useState(expanded);
  
  const handleToggleExpand = () => {
    const newExpanded = !localExpanded;
    setLocalExpanded(newExpanded);
    onToggleExpand?.(encounter.id, newExpanded);
  };


  const getEncounterSeverity = (encounter) => {
    const classCode = getEncounterClass(encounter);
    if (classCode === 'EMER') return 'critical';
    if (classCode === 'IMP' || classCode === 'ACUTE') return 'high';
    if (getEncounterStatus(encounter) === 'in-progress') return 'moderate';
    return 'normal';
  };

  const period = encounter.actualPeriod || encounter.period || {};
  const startDate = period.start ? parseISO(period.start) : null;
  const endDate = period.end ? parseISO(period.end) : null;
  const duration = startDate && endDate ? 
    Math.round((endDate - startDate) / (1000 * 60)) : null;

  // Calculate metrics for the encounter
  const encounterMetrics = [
    {
      label: 'Duration',
      value: duration ? `${duration} min` : 'Ongoing',
      color: duration && duration > 120 ? 'warning' : 'default'
    },
    {
      label: 'Notes',
      value: encounter.extension?.filter(ext => ext.url === 'notes')?.length || 0,
      icon: <NotesIcon fontSize="small" />
    },
    {
      label: 'Orders',
      value: encounter.extension?.filter(ext => ext.url === 'orders')?.length || 0,
      icon: <AssignmentIcon fontSize="small" />
    }
  ];

  // Get related resources (mock for now - should come from relationships)
  const relatedResources = {
    notes: [],
    orders: [],
    results: []
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <ClinicalCard
        severity={getEncounterSeverity(encounter)}
        title={
          <Stack direction="row" spacing={1} alignItems="center">
            {getEncounterIcon(encounter)}
            <Typography variant={density === 'compact' ? 'body1' : 'h6'}>
              {getEncounterTypeLabel(encounter)}
            </Typography>
          </Stack>
        }
        subtitle={
          startDate && (
            <Stack direction="row" spacing={2} alignItems="center">
              <Typography variant="body2">
                {format(startDate, 'MMM d, yyyy h:mm a')}
              </Typography>
              {duration && (
                <Chip 
                  label={`${duration} min`} 
                  size="small" 
                  variant="outlined"
                />
              )}
            </Stack>
          )
        }
        status={getEncounterStatus(encounter)}
        expandable
        expanded={localExpanded}
        onToggleExpand={handleToggleExpand}
        metrics={density !== 'compact' ? encounterMetrics : undefined}
        actions={[
          {
            label: 'View Summary',
            icon: <NotesIcon />,
            onClick: onViewDetails
          },
          {
            label: 'Edit',
            icon: <EditIcon />,
            onClick: onEdit
          },
          ...(getEncounterStatus(encounter) === 'in-progress' ? [{
            label: 'Sign & Close',
            icon: <SignIcon />,
            onClick: onSign,
            variant: 'contained',
            color: 'primary'
          }] : [])
        ]}
        sx={{ mb: density === 'compact' ? 1 : 2 }}
      >
        <Stack spacing={2}>
          {encounter.participant && (
            <Box>
              <Typography variant="caption" color="text.secondary" gutterBottom>
                Providers
              </Typography>
              <EnhancedProviderDisplay
                participants={encounter.participant}
                encounter={encounter}
                mode={density === 'compact' ? 'compact' : 'detailed'}
              />
            </Box>
          )}

          {(encounter.reasonCode || encounter.reason) && (
            <Box>
              <Typography variant="caption" color="text.secondary" gutterBottom>
                Reason for visit
              </Typography>
              <Stack direction="row" spacing={0.5} flexWrap="wrap">
                {(encounter.reasonCode || encounter.reason || []).map((reason, idx) => (
                  <Chip 
                    key={idx}
                    label={reason.text || 
                           reason.coding?.[0]?.display || 
                           'Encounter'} 
                    size="small"
                    variant="outlined"
                  />
                ))}
              </Stack>
            </Box>
          )}

          <Collapse in={localExpanded}>
            <Box sx={{ pt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Related Resources
              </Typography>
              <Grid container spacing={1}>
                <Grid item xs={12} md={4}>
                  <Paper variant="outlined" sx={{ p: 1.5 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="caption" color="text.secondary">
                        Clinical Notes
                      </Typography>
                      <Badge badgeContent={relatedResources.notes.length} color="primary">
                        <NotesIcon fontSize="small" color="action" />
                      </Badge>
                    </Stack>
                    <Button
                      size="small"
                      fullWidth
                      sx={{ mt: 1 }}
                      onClick={() => onAddNote?.(encounter)}
                    >
                      Add Note
                    </Button>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Paper variant="outlined" sx={{ p: 1.5 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="caption" color="text.secondary">
                        Orders
                      </Typography>
                      <Badge badgeContent={relatedResources.orders.length} color="secondary">
                        <AssignmentIcon fontSize="small" color="action" />
                      </Badge>
                    </Stack>
                    <Button
                      size="small"
                      fullWidth
                      sx={{ mt: 1 }}
                      disabled
                    >
                      View Orders
                    </Button>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Paper variant="outlined" sx={{ p: 1.5 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="caption" color="text.secondary">
                        Results
                      </Typography>
                      <Badge badgeContent={relatedResources.results.length} color="info">
                        <LabIcon fontSize="small" color="action" />
                      </Badge>
                    </Stack>
                    <Button
                      size="small"
                      fullWidth
                      sx={{ mt: 1 }}
                      disabled
                    >
                      View Results
                    </Button>
                  </Paper>
                </Grid>
              </Grid>
            </Box>
          </Collapse>
        </Stack>
      </ClinicalCard>
    </motion.div>
  );
};

const EncountersTab = ({ patientId, onNotificationUpdate, department = 'general' }) => {
  const { getPatientResources, isLoading, currentPatient, resources, searchResources } = useFHIRResource();
  const { publish, subscribe } = useClinicalWorkflow();
  
  const [viewMode, setViewMode] = useState('timeline'); // 'cards', 'timeline', or 'table'
  const [filterType, setFilterType] = useState('all');
  const [filterPeriod, setFilterPeriod] = useState('all'); // all, 1m, 3m, 6m, 1y
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEncounter, setSelectedEncounter] = useState(null);
  const [expandedCards, setExpandedCards] = useState(new Set());
  const [density, setDensity] = useDensity('comfortable');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [summaryDialogOpen, setSummaryDialogOpen] = useState(false);
  const [signingDialogOpen, setSigningDialogOpen] = useState(false);
  const [newEncounterDialogOpen, setNewEncounterDialogOpen] = useState(false);
  const [encounterCreationDialogOpen, setEncounterCreationDialogOpen] = useState(false);
  const [editEncounterDialogOpen, setEditEncounterDialogOpen] = useState(false);
  const [selectedEncounterForEdit, setSelectedEncounterForEdit] = useState(null);
  const [exportAnchorEl, setExportAnchorEl] = useState(null);
  const [noteEditorOpen, setNoteEditorOpen] = useState(false);
  const [selectedEncounterForNote, setSelectedEncounterForNote] = useState(null);
  const [newEncounterData, setNewEncounterData] = useState({
    type: 'AMB',
    reasonForVisit: '',
    provider: '',
    startDate: new Date().toISOString().split('T')[0],
    startTime: new Date().toTimeString().split(' ')[0].slice(0, 5)
  });

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

  // Handle adding note to encounter
  const handleAddNoteToEncounter = (encounter) => {
    setSelectedEncounterForNote(encounter);
    setNoteEditorOpen(true);
  };

  // Handle closing note editor
  const handleCloseNoteEditor = () => {
    setNoteEditorOpen(false);
    setSelectedEncounterForNote(null);
  };

  // Handle edit encounter
  const handleEditEncounter = (encounter) => {
    setSelectedEncounterForEdit(encounter);
    setEditEncounterDialogOpen(true);
  };

  const handleCloseEditEncounter = () => {
    setEditEncounterDialogOpen(false);
    setSelectedEncounterForEdit(null);
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
          const startDate = encounter.actualPeriod?.start || encounter.period?.start ? 
            format(parseISO(encounter.actualPeriod?.start || encounter.period.start), 'MMM d, yyyy h:mm a') : 'Unknown';
          const endDate = encounter.actualPeriod?.end || encounter.period?.end ? 
            format(parseISO(encounter.actualPeriod?.end || encounter.period.end), 'MMM d, yyyy h:mm a') : 'Ongoing';
          
          html += `
            <div class="section">
              <h3>${getEncounterTypeLabel(encounter)}</h3>
              <p><strong>Status:</strong> ${getEncounterStatus(encounter)}</p>
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

  // Get encounters - memoized to prevent dependency issues
  const encounters = useMemo(() => {
    return getPatientResources(patientId, 'Encounter') || [];
  }, [patientId, getPatientResources]);

  // Load encounters if not available in relationships
  useEffect(() => {
    const loadEncounters = async () => {
      if (encounters.length === 0 && patientId && !isLoading) {
        try {
          await searchResources('Encounter', {
            patient: patientId,
            _sort: '-date',
            _count: 100
          });
        } catch (error) {
          // Failed to load encounters
        }
      }
    };
    
    loadEncounters();
  }, [patientId, encounters.length, searchResources, isLoading]);

  // Get all clinical resources for timeline
  const allClinicalResources = useMemo(() => {
    const resourceTypes = ['Observation', 'MedicationRequest', 'Procedure', 'DiagnosticReport'];
    const allResources = [];
    
    // Add encounters
    encounters.forEach(enc => {
      allResources.push({
        ...enc,
        resourceType: 'Encounter',
        date: enc.actualPeriod?.start || enc.period?.start || enc.meta?.lastUpdated
      });
    });
    
    // Add other clinical resources that reference encounters
    resourceTypes.forEach(type => {
      const typeResources = getPatientResources(patientId, type) || [];
      
      typeResources.forEach(resource => {
        if (resource.encounter?.reference || resource.context?.reference) {
          allResources.push({
            ...resource,
            resourceType: type,
            date: resource.effectiveDateTime || 
                  resource.authoredOn || 
                  resource.performedDateTime || 
                  resource.issued ||
                  resource.meta?.lastUpdated
          });
        }
      });
    });
    
    return allResources.sort((a, b) => 
      new Date(b.date || 0) - new Date(a.date || 0)
    );
  }, [encounters, patientId, getPatientResources]);

  // Filter encounters - memoized for performance
  const filteredEncounters = useMemo(() => {
    return encounters.filter(encounter => {
      // Type filter - use resilient utility
      const matchesType = filterType === 'all' || 
        getEncounterClass(encounter) === filterType;

      // Period filter
      let matchesPeriod = true;
      if (filterPeriod !== 'all' && (encounter.actualPeriod?.start || encounter.period?.start)) {
        const startDate = parseISO(encounter.actualPeriod?.start || encounter.period.start);
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
  }, [encounters, filterType, filterPeriod, searchTerm]);

  // Sort by date descending - memoized for performance
  const sortedEncounters = useMemo(() => {
    const sorted = [...filteredEncounters].sort((a, b) => {
      const dateA = new Date(a.actualPeriod?.start || a.period?.start || 0);
      const dateB = new Date(b.actualPeriod?.start || b.period?.start || 0);
      return dateB - dateA;
    });
    
    // Transform data to match SmartTable expectations
    const transformed = sorted.map(encounter => ({
      ...encounter,
      // Add computed fields that SmartTable can access via column.field
      date: encounter.actualPeriod?.start || encounter.period?.start || null,
      reason: encounter.reasonCode?.[0]?.text || 
              encounter.reasonCode?.[0]?.coding?.[0]?.display || 
              encounter.type?.[0]?.text ||
              encounter.type?.[0]?.coding?.[0]?.display ||
              null,
      type: getEncounterTypeLabel(encounter),
      status: getEncounterStatus(encounter),
      provider: encounter.participant || []
    }));
    
    // Temporary debug log
    if (transformed.length > 0) {
      console.log('EncountersTab: transformed encounter sample:', transformed[0]);
      console.log('EncountersTab: total encounters:', transformed.length);
      console.log('EncountersTab: encounter keys:', Object.keys(sorted[0]));
      // Log all properties that might contain date/time info
      console.log('EncountersTab: checking date properties:', {
        period: sorted[0].period,
        date: sorted[0].date,
        effectiveDateTime: sorted[0].effectiveDateTime,
        authoredOn: sorted[0].authoredOn,
        created: sorted[0].created,
        recordedDate: sorted[0].recordedDate
      });
      // Log all properties that might contain reason info
      console.log('EncountersTab: checking reason properties:', {
        reasonCode: sorted[0].reasonCode,
        reason: sorted[0].reason,
        reasonReference: sorted[0].reasonReference,
        diagnosis: sorted[0].diagnosis,
        type: sorted[0].type
      });
    }
    
    return transformed;
  }, [filteredEncounters]);

  // Memoize encounter statistics to avoid recalculating on every render
  const encounterStats = useMemo(() => {
    const stats = {
      total: sortedEncounters.length,
      completed: encounters.filter(e => getEncounterStatus(e) === 'finished').length,
      inProgress: encounters.filter(e => getEncounterStatus(e) === 'in-progress').length,
      emergency: encounters.filter(e => getEncounterClass(e) === 'EMER').length,
      inpatient: encounters.filter(e => getEncounterClass(e) === 'IMP').length,
      ambulatory: encounters.filter(e => getEncounterClass(e) === 'AMB').length
    };
    return stats;
  }, [encounters, sortedEncounters]);

  // Prepare metrics for MetricsBar
  const encounterMetrics = useMemo(() => [
    {
      label: 'Total Visits',
      value: encounterStats.total,
      icon: <CalendarIcon />,
      color: 'primary',
      severity: 'normal'
    },
    {
      label: 'In Progress',
      value: encounterStats.inProgress,
      icon: <TimeIcon />,
      color: encounterStats.inProgress > 0 ? 'warning' : 'default',
      severity: encounterStats.inProgress > 0 ? 'moderate' : 'normal'
    },
    {
      label: 'Emergency',
      value: encounterStats.emergency,
      icon: <EmergencyIcon />,
      color: encounterStats.emergency > 0 ? 'error' : 'default',
      severity: encounterStats.emergency > 0 ? 'high' : 'normal'
    },
    {
      label: 'Completed',
      value: encounterStats.completed,
      icon: <CheckCircleIcon />,
      color: 'success',
      severity: 'normal',
      progress: (encounterStats.completed / Math.max(encounterStats.total, 1)) * 100
    }
  ], [encounterStats]);

  // Handle card expansion toggle
  const handleToggleCardExpand = useCallback((encounterId, expanded) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (expanded) {
        newSet.add(encounterId);
      } else {
        newSet.delete(encounterId);
      }
      return newSet;
    });
  }, []);

  // Use context's isLoading state - this properly reflects when data is actually loading
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 4 }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }} variant="body1" color="text.secondary">
          Loading encounters...
        </Typography>
      </Box>
    );
  }

  // Handle case where patient data might not be loaded yet
  if (!currentPatient) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="info">
          No patient selected. Please select a patient to view encounters.
        </Alert>
      </Box>
    );
  }


  return (
    <>
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Box>
            <Typography variant="h5" fontWeight="bold">
              Encounter History
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {encounterStats.total} total visits • {encounterStats.inProgress} in progress
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <ViewControls
              density={density}
              onDensityChange={setDensity}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              showViewMode
              availableViews={['timeline', 'cards', 'table']}
              size="small"
            />
            <Button
              variant="outlined"
              size="small"
              startIcon={<PrintIcon />}
              onClick={handlePrintEncounters}
            >
              Print
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<ExportIcon />}
              onClick={(e) => setExportAnchorEl(e.currentTarget)}
            >
              Export
            </Button>
          </Stack>
        </Stack>

        {/* Metrics Bar */}
        <MetricsBar 
          metrics={encounterMetrics} 
          density={density}
          animate
        />

        {/* Quick Filters */}
        <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
          <TextField
            placeholder="Search encounters..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="small"
            sx={{ width: 300 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              )
            }}
          />
          
          <ToggleButtonGroup
            value={filterType}
            exclusive
            onChange={(e, value) => value && setFilterType(value)}
            size="small"
          >
            <ToggleButton value="all">
              All Types
            </ToggleButton>
            <ToggleButton value="AMB">
              <ClinicIcon fontSize="small" sx={{ mr: 0.5 }} />
              Ambulatory
            </ToggleButton>
            <ToggleButton value="IMP">
              <HospitalIcon fontSize="small" sx={{ mr: 0.5 }} />
              Inpatient
            </ToggleButton>
            <ToggleButton value="EMER">
              <EmergencyIcon fontSize="small" sx={{ mr: 0.5 }} />
              Emergency
            </ToggleButton>
          </ToggleButtonGroup>

          <ToggleButtonGroup
            value={filterPeriod}
            exclusive
            onChange={(e, value) => value && setFilterPeriod(value)}
            size="small"
          >
            <ToggleButton value="1m">1M</ToggleButton>
            <ToggleButton value="3m">3M</ToggleButton>
            <ToggleButton value="6m">6M</ToggleButton>
            <ToggleButton value="1y">1Y</ToggleButton>
            <ToggleButton value="all">All</ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      </Box>

      {/* Main Content Area */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
        {sortedEncounters.length === 0 ? (
          <Alert severity="info" sx={{ mt: 2 }}>
            No encounters found matching your criteria
          </Alert>
        ) : viewMode === 'timeline' ? (
          <Box sx={{ height: 'calc(100% - 16px)' }}>
            <ResourceTimeline
              resources={allClinicalResources.filter(r => {
                // Apply same filters to timeline resources
                if (r.resourceType === 'Encounter') {
                  const enc = filteredEncounters.find(e => e.id === r.id);
                  return !!enc;
                }
                // For other resources, check if they belong to filtered encounters
                const encRef = r.encounter?.reference || r.context?.reference;
                if (encRef) {
                  const encId = encRef.split('/').pop();
                  return filteredEncounters.some(e => e.id === encId);
                }
                return false;
              })}
              onResourceClick={(resource) => {
                if (resource.resourceType === 'Encounter') {
                  handleViewEncounterDetails(resource);
                }
              }}
              height={600}
              showLegend
              showRangeSelector
              enableZoom
              groupByType
            />
          </Box>
        ) : viewMode === 'cards' ? (
          <Box>
            <AnimatePresence>
              {sortedEncounters.map((encounter, index) => (
                <motion.div
                  key={encounter.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                >
                  <EncounterCard
                    encounter={encounter}
                    onViewDetails={() => handleViewEncounterDetails(encounter)}
                    onEdit={() => handleEditEncounter(encounter)}
                    onSign={() => handleSignEncounter(encounter)}
                    onAddNote={handleAddNoteToEncounter}
                    density={density}
                    expanded={expandedCards.has(encounter.id)}
                    onToggleExpand={handleToggleCardExpand}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </Box>
        ) : (
          // Table view
          <SmartTable
            columns={[
              {
                field: 'type',
                headerName: 'Type',
                type: 'custom',
                renderCell: (value, row) => (
                  <Stack direction="row" spacing={1} alignItems="center">
                    {getEncounterIcon(row)}
                    <Typography variant="body2">
                      {getEncounterTypeLabel(row)}
                    </Typography>
                  </Stack>
                )
              },
              {
                field: 'date',
                headerName: 'Date',
                type: 'custom',
                renderCell: (value, row) => (
                  value ? 
                    format(parseISO(value), 'MMM d, yyyy h:mm a') : 
                    'N/A'
                )
              },
              {
                field: 'status',
                headerName: 'Status',
                type: 'custom',
                renderCell: (value, row) => (
                  <Chip
                    label={getEncounterStatus(row)}
                    size="small"
                    color={
                      getEncounterStatus(row) === 'finished' ? 'success' :
                      getEncounterStatus(row) === 'in-progress' ? 'warning' :
                      'default'
                    }
                  />
                )
              },
              {
                field: 'provider',
                headerName: 'Provider',
                type: 'custom',
                renderCell: (value, row) => (
                  <EnhancedProviderDisplay
                    participants={row.participant}
                    encounter={row}
                    mode="compact"
                    showIcon={false}
                  />
                )
              },
              {
                field: 'reason',
                headerName: 'Reason',
                type: 'custom',
                renderCell: (value, row) => (
                  <Typography variant="body2" noWrap>
                    {value || '-'}
                  </Typography>
                )
              },
              {
                field: 'actions',
                headerName: 'Actions',
                align: 'right',
                type: 'custom',
                renderCell: (value, row) => (
                  <Stack direction="row" spacing={1}>
                    <IconButton
                      size="small"
                      onClick={() => handleViewEncounterDetails(row)}
                      title="View details"
                    >
                      <NotesIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleEditEncounter(row)}
                      title="Edit"
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                )
              }
            ]}
            data={sortedEncounters}
            density={density}
            sortable
            filterable
            onRowClick={(row) => handleViewEncounterDetails(row)}
            emptyMessage="No encounters found"
          />
        )}
      </Box>

      {/* Floating Action Button */}
      <ContextualFAB
        currentModule="encounters"
        primaryAction={{
          icon: <AddIcon />,
          onClick: handleNewEncounter
        }}
        actions={[
          {
            icon: <CalendarIcon />,
            name: 'Schedule Appointment',
            onClick: handleNewEncounter
          },
          {
            icon: <NotesIcon />,
            name: 'Add Clinical Note',
            onClick: () => selectedEncounter && handleAddNoteToEncounter(selectedEncounter)
          },
          {
            icon: <PrintIcon />,
            name: 'Print History',
            onClick: handlePrintEncounters
          }
        ]}
        position="bottom-right"
        color="primary"
      />

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

      {/* Encounter Summary Dialog */}
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
        onEncounterSigned={handleEncounterSigned}
      />

      {/* New Encounter Creation Dialog */}
      <EncounterCreationDialog
        open={encounterCreationDialogOpen}
        onClose={() => setEncounterCreationDialogOpen(false)}
        patientId={patientId}
        onEncounterCreated={handleEncounterCreated}
      />

      {/* Note Editor Dialog */}
      <EnhancedNoteEditor
        open={noteEditorOpen}
        onClose={handleCloseNoteEditor}
        patientId={patientId}
        encounterId={selectedEncounterForNote?.id}
        encounterDisplay={selectedEncounterForNote ? getEncounterTypeLabel(selectedEncounterForNote) : ''}
      />

      {/* Edit Encounter Dialog */}
      <Dialog
        open={editEncounterDialogOpen}
        onClose={handleCloseEditEncounter}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Encounter</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Note: Encounter editing is currently limited. You can create a new encounter or update the status of existing encounters through the signing process.
          </Typography>
          {selectedEncounterForEdit && (
            <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 0 }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                Current Encounter: {getEncounterTypeLabel(selectedEncounterForEdit)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Status: {getEncounterStatus(selectedEncounterForEdit)}
              </Typography>
              {(selectedEncounterForEdit.actualPeriod?.start || selectedEncounterForEdit.period?.start) && (
                <Typography variant="body2" color="text.secondary">
                  Date: {format(parseISO(selectedEncounterForEdit.actualPeriod?.start || selectedEncounterForEdit.period.start), 'MMM d, yyyy h:mm a')}
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseEditEncounter}>
            Close
          </Button>
          <Button 
            variant="contained" 
            onClick={() => {
              handleCloseEditEncounter();
              setEncounterCreationDialogOpen(true);
            }}
          >
            Create New Encounter
          </Button>
        </DialogActions>
      </Dialog>

      </Box>

      {/* Dialogs */}
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

      {/* Enhanced Note Editor for Encounter Notes */}
      <EnhancedNoteEditor
        open={noteEditorOpen}
        onClose={handleCloseNoteEditor}
        note={null}
        patientId={patientId}
        encounter={selectedEncounterForNote}
        defaultTemplate={null}
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

      {/* Edit Encounter Dialog */}
      <Dialog
        open={editEncounterDialogOpen}
        onClose={handleCloseEditEncounter}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Edit Encounter</DialogTitle>
        <DialogContent>
          {selectedEncounterForEdit && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body1" sx={{ mb: 2 }}>
                Encounter editing functionality is being enhanced. For now, encounter details can be viewed but not directly edited.
              </Typography>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                Current Encounter: {getEncounterTypeLabel(selectedEncounterForEdit)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Status: {getEncounterStatus(selectedEncounterForEdit)}
              </Typography>
              {(selectedEncounterForEdit.actualPeriod?.start || selectedEncounterForEdit.period?.start) && (
                <Typography variant="body2" color="text.secondary">
                  Date: {format(parseISO(selectedEncounterForEdit.actualPeriod?.start || selectedEncounterForEdit.period.start), 'MMM d, yyyy h:mm a')}
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseEditEncounter}>
            Close
          </Button>
          <Button 
            variant="contained" 
            onClick={() => {
              handleCloseEditEncounter();
              setEncounterCreationDialogOpen(true);
            }}
          >
            Create New Encounter
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
    </>
  );
};

export default React.memo(EncountersTab);