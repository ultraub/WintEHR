/**
 * Encounters Tab Component
 * Display and manage patient encounters
 */
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
  InputAdornment,
  Alert,
  Badge,
  Grid,
  ToggleButton,
  ToggleButtonGroup,
  Skeleton
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
  Science as LabIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { parseISO, isWithinInterval, subMonths } from 'date-fns';
import { formatClinicalDate } from '../../../../core/fhir/utils/dateFormatUtils';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import { navigateToTab, TAB_IDS } from '../../utils/navigationHelper';
import EncounterSummaryDialogEnhanced from '../dialogs/EncounterSummaryDialogEnhanced';
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
import { ClinicalResourceCard } from '../../shared/cards';
import { ResourceTimeline } from '../../shared/display';
import { SmartTable } from '../../shared/tables';
import { ContextualFAB } from '../../shared/layout';
import { ViewControls, useDensity } from '../../shared/layout';
import { MetricsBar } from '../../shared/display';
import { motion, AnimatePresence } from 'framer-motion';
import CollapsibleFilterPanel from '../CollapsibleFilterPanel';
import EncounterCard from '../cards/EncounterCard';

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



const EncountersTab = ({
  patientId,
  onNotificationUpdate,
  department = 'general',
  onNavigateToTab // Cross-tab navigation support
}) => {
  const { getPatientResources, isLoading, currentPatient, resources, searchResources } = useFHIRResource();
  const { subscribe } = useClinicalWorkflow();
  
  const [viewMode, setViewMode] = useState('cards'); // 'cards', 'timeline', or 'table'
  const [filterType, setFilterType] = useState('all');
  const [filterPeriod, setFilterPeriod] = useState('all'); // all, 1m, 3m, 6m, 1y
  const [searchTerm, setSearchTerm] = useState('');
  const scrollContainerRef = useRef(null);
  const [selectedEncounter, setSelectedEncounter] = useState(null);
  const [density, setDensity] = useDensity('comfortable');
  const { enqueueSnackbar } = useSnackbar();
  const [summaryDialogOpen, setSummaryDialogOpen] = useState(false);
  const [encounterCreationDialogOpen, setEncounterCreationDialogOpen] = useState(false);
  const [editEncounterDialogOpen, setEditEncounterDialogOpen] = useState(false);
  const [selectedEncounterForEdit, setSelectedEncounterForEdit] = useState(null);
  const [noteEditorOpen, setNoteEditorOpen] = useState(false);
  const [selectedEncounterForNote, setSelectedEncounterForNote] = useState(null);

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
    enqueueSnackbar('Encounter created successfully', { variant: 'success' });
    
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

  const handleExportEncounters = (exportFormat) => {
    exportClinicalData({
      patient: currentPatient,
      data: filteredEncounters,
      columns: EXPORT_COLUMNS.encounters,
      format: exportFormat,
      title: 'Encounter_History',
      formatForPrint: (data) => {
        let html = '<h2>Encounter History</h2>';
        data.forEach(encounter => {
          const startDate = formatClinicalDate(encounter.actualPeriod?.start || encounter.period?.start, 'withTime', 'Unknown');
          const endDate = formatClinicalDate(encounter.actualPeriod?.end || encounter.period?.end, 'withTime', 'Ongoing');
          
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
  

  // Get encounters - memoized to prevent dependency issues
  const encounters = useMemo(() => {
    return getPatientResources(patientId, 'Encounter') || [];
  }, [patientId, getPatientResources]);

  // Load encounters function
  const loadEncounters = useCallback(async () => {
    if (patientId && !isLoading) {
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
  }, [patientId, searchResources, isLoading]);

  // Load encounters if not available in relationships
  useEffect(() => {
    if (encounters.length === 0) {
      loadEncounters();
    }
  }, [encounters.length, loadEncounters]);


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

  // Handle card expansion toggle

  // Use context's isLoading state - this properly reflects when data is actually loading
  if (isLoading) {
    // Skeleton rows instead of a centered spinner: the layout doesn't jump
    // when data lands, and the user sees the shape of what's coming.
    return (
      <Box sx={{ p: 2 }}>
        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          {[0, 1, 2, 3].map(i => (
            <Skeleton key={i} variant="rounded" width="25%" height={72} />
          ))}
        </Stack>
        <Stack spacing={1.5}>
          {[0, 1, 2, 3, 4].map(i => (
            <Skeleton key={i} variant="rounded" height={88} />
          ))}
        </Stack>
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
      <Box>
      {/* Compact Header */}
      <Box sx={{ px: 2, pt: 1.5, pb: 0 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
          {/* Inline Statistics */}
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" color="text.secondary">
              {encounterStats.total} total visits
            </Typography>
            {encounterStats.inProgress > 0 && (
              <Chip
                label={`${encounterStats.inProgress} in progress`}
                size="small"
                color="warning"
                icon={<TimeIcon fontSize="small" />}
                sx={{ borderRadius: '4px' }}
              />
            )}
            {encounterStats.emergency > 0 && (
              <Chip
                label={`${encounterStats.emergency} emergency`}
                size="small"
                color="error"
                icon={<EmergencyIcon fontSize="small" />}
                sx={{ borderRadius: '4px' }}
              />
            )}
          </Stack>
          
          {/* Quick Actions */}
          <Stack direction="row" spacing={1}>
            <IconButton
              size="small"
              onClick={handleNewEncounter}
              title="New Encounter"
            >
              <AddIcon />
            </IconButton>
            <IconButton
              size="small"
              onClick={handlePrintEncounters}
              title="Print"
            >
              <PrintIcon />
            </IconButton>
          </Stack>
        </Stack>

        {/* Collapsible Filter Panel */}
        <Box>
          <CollapsibleFilterPanel
            searchQuery={searchTerm}
            onSearchChange={setSearchTerm}
            dateRange={filterPeriod}
            onDateRangeChange={setFilterPeriod}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            searchPlaceholder="Search encounters..."
            dateRangeOptions={[
              { value: 'all', label: 'All Time' },
              { value: '1m', label: 'Last Month' },
              { value: '3m', label: 'Last 3 Months' },
              { value: '6m', label: 'Last 6 Months' },
              { value: '1y', label: 'Last Year' }
            ]}
            viewModeOptions={[
              { value: 'cards', label: 'Cards', icon: <CalendarIcon /> },
              { value: 'timeline', label: 'Timeline', icon: <TimeIcon /> },
              { value: 'table', label: 'Table', icon: <AssignmentIcon /> }
            ]}
            showCategories={false}
            showInactiveToggle={false}
            onRefresh={loadEncounters}
            onExport={() => handleExportEncounters('csv')}
            scrollContainerRef={scrollContainerRef}
          >
            {/* Custom filter for encounter type */}
            <Stack direction="row" spacing={2} alignItems="center">
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
              
              <ViewControls
                density={density}
                onDensityChange={setDensity}
                showViewMode={false}
                size="small"
              />
            </Stack>
          </CollapsibleFilterPanel>
        </Box>
      </Box>

      {/* Main Content Area */}
      <Box sx={{ p: 3 }}>
        {sortedEncounters.length === 0 ? (
          <Alert severity="info" sx={{ mt: 2 }}>
            No encounters found matching your criteria
          </Alert>
        ) : viewMode === 'timeline' ? (
          <Box sx={{ p: 2, height: 'calc(100% - 16px)' }}>
            <ResourceTimeline
              resources={sortedEncounters.map(enc => ({
                ...enc,
                date: enc.actualPeriod?.start || enc.period?.start || enc.meta?.lastUpdated,
                title: getEncounterTypeLabel(enc),
                severity: getEncounterClass(enc) === 'EMER' ? 'critical' : 
                         getEncounterClass(enc) === 'IMP' ? 'high' : 'normal'
              }))}
              onResourceClick={(resource) => handleViewEncounterDetails(resource)}
              height="100%"
              showLegend
              showControls
              enableZoom
              groupByType={false}
              colorByType={false}
              colorBySeverity={true}
              dateRange={filterPeriod !== 'all' ? {
                start: filterPeriod === '1m' ? subMonths(new Date(), 1) :
                       filterPeriod === '3m' ? subMonths(new Date(), 3) :
                       filterPeriod === '6m' ? subMonths(new Date(), 6) :
                       subMonths(new Date(), 12),
                end: new Date()
              } : undefined}
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
                    patientId={patientId}
                    onViewDetails={handleViewEncounterDetails}
                    elevation={0}
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
                    formatClinicalDate(value, 'withTime') :
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

      {/* Enhanced Encounter Summary Dialog */}
      <EncounterSummaryDialogEnhanced
        open={summaryDialogOpen}
        onClose={handleCloseSummaryDialog}
        encounter={selectedEncounter}
        patientId={patientId}
      />

      {/* Encounter Signing Dialog */}

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
            <Box sx={{ p: 2, bgcolor: 'background.paper' }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                Current Encounter: {getEncounterTypeLabel(selectedEncounterForEdit)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Status: {getEncounterStatus(selectedEncounterForEdit)}
              </Typography>
              {(selectedEncounterForEdit.actualPeriod?.start || selectedEncounterForEdit.period?.start) && (
                <Typography variant="body2" color="text.secondary">
                  Date: {formatClinicalDate(selectedEncounterForEdit.actualPeriod?.start || selectedEncounterForEdit.period.start, 'withTime')}
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

      {/* Dialogs are rendered above (lines 934-965), not duplicated here */}



      {/* Snackbar for notifications */}
    </>
  );
};

export default React.memo(EncountersTab);