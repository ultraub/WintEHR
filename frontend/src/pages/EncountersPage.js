import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Button,
  Stack,
  Chip,
  Alert,
  CircularProgress,
  TextField,
  InputAdornment,
  IconButton,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Autocomplete,
  Tooltip,
  Skeleton,
  Card,
  CardContent
} from '@mui/material';
import {
  EventNote as EncounterIcon,
  Add as AddIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Clear as ClearIcon,
  OpenInNew as OpenChartIcon,
  Summarize as SummaryIcon,
  LocalHospital as InProgressIcon,
  CheckCircle as FinishedIcon,
  Cancel as CancelledIcon,
  Schedule as PlannedIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { format, isToday, parseISO } from 'date-fns';
import { fhirClient } from '../core/fhir/services/fhirClient';
import { debounce } from 'lodash';

// --- Constants ---

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'planned', label: 'Planned' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'finished', label: 'Finished' },
  { value: 'cancelled', label: 'Cancelled' }
];

const ENCOUNTER_CLASS_OPTIONS = [
  { code: 'AMB', display: 'Ambulatory', system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode' },
  { code: 'IMP', display: 'Inpatient', system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode' },
  { code: 'EMER', display: 'Emergency', system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode' },
  { code: 'VR', display: 'Telehealth', system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode' }
];

const ROWS_PER_PAGE_OPTIONS = [10, 25, 50];

// --- Helper functions ---

const getStatusChipProps = (status) => {
  switch (status) {
    case 'in-progress':
      return { label: 'In Progress', color: 'primary', icon: <InProgressIcon fontSize="small" /> };
    case 'finished':
      return { label: 'Finished', color: 'success', icon: <FinishedIcon fontSize="small" /> };
    case 'cancelled':
      return { label: 'Cancelled', color: 'error', icon: <CancelledIcon fontSize="small" /> };
    case 'planned':
      return { label: 'Planned', color: 'info', icon: <PlannedIcon fontSize="small" /> };
    default:
      return { label: status || 'Unknown', color: 'default', icon: null };
  }
};

const extractPatientId = (encounter) => {
  const ref = encounter?.subject?.reference || '';
  return ref.replace('Patient/', '').replace('urn:uuid:', '');
};

const extractPatientDisplay = (encounter, patientMap) => {
  // First try the display field on the encounter itself
  if (encounter?.subject?.display) return encounter.subject.display;
  // Then try the resolved patient map (from _include)
  const patientId = extractPatientId(encounter);
  if (patientId && patientMap && patientMap[patientId]) {
    return patientMap[patientId];
  }
  return 'Unknown Patient';
};

const extractEncounterType = (encounter) => {
  if (encounter?.type?.length > 0) {
    const coding = encounter.type[0]?.coding?.[0];
    return coding?.display || encounter.type[0]?.text || 'Unknown';
  }
  const classDisplay = encounter?.class?.display || encounter?.class?.code;
  if (classDisplay) {
    const found = ENCOUNTER_CLASS_OPTIONS.find(
      (opt) => opt.code === classDisplay || opt.display.toLowerCase() === classDisplay.toLowerCase()
    );
    return found ? found.display : classDisplay;
  }
  return 'Office Visit';
};

const extractProvider = (encounter) => {
  if (encounter?.participant?.length > 0) {
    for (const p of encounter.participant) {
      const display = p.individual?.display;
      if (display) return display;
    }
  }
  return '--';
};

const extractReasonForVisit = (encounter) => {
  if (encounter?.reasonCode?.length > 0) {
    const coding = encounter.reasonCode[0]?.coding?.[0];
    return coding?.display || encounter.reasonCode[0]?.text || '--';
  }
  return '--';
};

const formatEncounterDate = (encounter) => {
  const start = encounter?.period?.start;
  if (!start) return '--';
  try {
    return format(parseISO(start), 'MMM dd, yyyy h:mm a');
  } catch {
    return start;
  }
};

// --- New Encounter Dialog ---

const NewEncounterDialog = ({ open, onClose, onCreated }) => {
  const [patientSearch, setPatientSearch] = useState('');
  const [patientOptions, setPatientOptions] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [encounterClass, setEncounterClass] = useState('AMB');
  const [encounterType, setEncounterType] = useState('Office Visit');
  const [reasonForVisit, setReasonForVisit] = useState('');
  const [providerName, setProviderName] = useState('');
  const [saving, setSaving] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [dialogError, setDialogError] = useState(null);

  // Debounced patient search
  const searchPatients = useCallback(
    debounce(async (query) => {
      if (!query || query.length < 2) {
        setPatientOptions([]);
        return;
      }
      setSearchLoading(true);
      try {
        const params = { _count: 10, _sort: 'name' };
        if (/^\d+$/.test(query)) {
          params.identifier = query;
        } else {
          params.name = query;
        }
        const result = await fhirClient.search('Patient', params);
        const options = (result.resources || []).map((pt) => {
          const name = pt.name?.[0] || {};
          const display = `${name.family || ''}, ${(name.given || []).join(' ')}`.trim();
          const mrn = pt.identifier?.find(
            (id) => id.type?.coding?.[0]?.code === 'MR' || id.system?.includes('mrn')
          )?.value || '';
          return {
            id: pt.id,
            display: display || `Patient/${pt.id}`,
            mrn,
            birthDate: pt.birthDate,
            gender: pt.gender
          };
        });
        setPatientOptions(options);
      } catch (err) {
        console.error('Patient search failed:', err);
        setPatientOptions([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300),
    []
  );

  useEffect(() => {
    searchPatients(patientSearch);
  }, [patientSearch, searchPatients]);

  const resetForm = () => {
    setPatientSearch('');
    setPatientOptions([]);
    setSelectedPatient(null);
    setEncounterClass('AMB');
    setEncounterType('Office Visit');
    setReasonForVisit('');
    setProviderName('');
    setDialogError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleCreate = async () => {
    if (!selectedPatient) {
      setDialogError('Please select a patient.');
      return;
    }

    setSaving(true);
    setDialogError(null);

    try {
      const classOption = ENCOUNTER_CLASS_OPTIONS.find((opt) => opt.code === encounterClass);
      const encounterResource = {
        resourceType: 'Encounter',
        status: 'in-progress',
        class: {
          system: classOption?.system || 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
          code: classOption?.code || encounterClass,
          display: classOption?.display || encounterClass
        },
        type: [{ text: encounterType || 'Office Visit' }],
        subject: {
          reference: `Patient/${selectedPatient.id}`,
          display: selectedPatient.display
        },
        participant: providerName
          ? [{ individual: { display: providerName } }]
          : [],
        period: { start: new Date().toISOString() },
        reasonCode: reasonForVisit
          ? [{ text: reasonForVisit }]
          : []
      };

      const created = await fhirClient.create('Encounter', encounterResource);
      handleClose();
      if (onCreated) onCreated(created);
    } catch (err) {
      console.error('Failed to create encounter:', err);
      setDialogError('Failed to create encounter. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 0 } }}
      aria-labelledby="new-encounter-dialog-title"
    >
      <DialogTitle id="new-encounter-dialog-title" sx={{ pb: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <EncounterIcon color="primary" />
          <Typography variant="h6" component="span">New Encounter</Typography>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          {dialogError && (
            <Alert severity="error" onClose={() => setDialogError(null)}>
              {dialogError}
            </Alert>
          )}

          {/* Patient Search */}
          <Autocomplete
            options={patientOptions}
            getOptionLabel={(option) =>
              option.display + (option.mrn ? ` (MRN: ${option.mrn})` : '')
            }
            loading={searchLoading}
            value={selectedPatient}
            onChange={(_, newValue) => setSelectedPatient(newValue)}
            onInputChange={(_, newInputValue) => setPatientSearch(newInputValue)}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            noOptionsText={
              patientSearch.length < 2
                ? 'Type at least 2 characters to search'
                : 'No patients found'
            }
            renderOption={(props, option) => (
              <li {...props} key={option.id}>
                <Stack>
                  <Typography variant="body2">{option.display}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {option.mrn ? `MRN: ${option.mrn}` : ''}{' '}
                    {option.birthDate ? `DOB: ${option.birthDate}` : ''}{' '}
                    {option.gender || ''}
                  </Typography>
                </Stack>
              </li>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Patient"
                placeholder="Search by name or MRN..."
                required
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {searchLoading ? <CircularProgress size={18} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  )
                }}
              />
            )}
          />

          {/* Encounter Class */}
          <FormControl fullWidth>
            <InputLabel id="encounter-class-label">Encounter Type</InputLabel>
            <Select
              labelId="encounter-class-label"
              value={encounterClass}
              label="Encounter Type"
              onChange={(e) => setEncounterClass(e.target.value)}
            >
              {ENCOUNTER_CLASS_OPTIONS.map((opt) => (
                <MenuItem key={opt.code} value={opt.code}>
                  {opt.display}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Visit Type */}
          <TextField
            label="Visit Type"
            value={encounterType}
            onChange={(e) => setEncounterType(e.target.value)}
            placeholder="e.g., Office Visit, Follow-up, Annual Physical"
            fullWidth
          />

          {/* Reason for Visit */}
          <TextField
            label="Reason for Visit"
            value={reasonForVisit}
            onChange={(e) => setReasonForVisit(e.target.value)}
            placeholder="e.g., Routine checkup, Chest pain evaluation"
            fullWidth
            multiline
            minRows={2}
          />

          {/* Provider */}
          <TextField
            label="Provider"
            value={providerName}
            onChange={(e) => setProviderName(e.target.value)}
            placeholder="e.g., Dr. Smith"
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleCreate}
          disabled={saving || !selectedPatient}
          startIcon={saving ? <CircularProgress size={18} /> : <AddIcon />}
        >
          {saving ? 'Creating...' : 'Start Encounter'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// --- Encounter Summary Dialog ---

const EncounterSummaryDialog = ({ open, onClose, encounter, patientMap }) => {
  if (!encounter) return null;

  const statusProps = getStatusChipProps(encounter.status);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 0 } }}
      aria-labelledby="encounter-summary-dialog-title"
    >
      <DialogTitle id="encounter-summary-dialog-title">
        <Stack direction="row" spacing={1} alignItems="center">
          <SummaryIcon color="primary" />
          <Typography variant="h6" component="span">Encounter Summary</Typography>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Box>
            <Typography variant="caption" color="text.secondary">Patient</Typography>
            <Typography variant="body1">{extractPatientDisplay(encounter, patientMap)}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Status</Typography>
            <Box sx={{ mt: 0.5 }}>
              <Chip
                label={statusProps.label}
                color={statusProps.color}
                size="small"
                icon={statusProps.icon}
                sx={{ borderRadius: 0 }}
              />
            </Box>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Encounter Type</Typography>
            <Typography variant="body1">{extractEncounterType(encounter)}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Date / Time</Typography>
            <Typography variant="body1">{formatEncounterDate(encounter)}</Typography>
          </Box>
          {encounter.period?.end && (
            <Box>
              <Typography variant="caption" color="text.secondary">End Time</Typography>
              <Typography variant="body1">
                {format(parseISO(encounter.period.end), 'MMM dd, yyyy h:mm a')}
              </Typography>
            </Box>
          )}
          <Box>
            <Typography variant="caption" color="text.secondary">Provider</Typography>
            <Typography variant="body1">{extractProvider(encounter)}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Reason for Visit</Typography>
            <Typography variant="body1">{extractReasonForVisit(encounter)}</Typography>
          </Box>
          {encounter.class && (
            <Box>
              <Typography variant="caption" color="text.secondary">Class</Typography>
              <Typography variant="body1">
                {encounter.class.display || encounter.class.code || '--'}
              </Typography>
            </Box>
          )}
          <Box>
            <Typography variant="caption" color="text.secondary">FHIR Resource ID</Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
              Encounter/{encounter.id}
            </Typography>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

// --- Summary Stats ---

const SummaryStats = ({ encounters, total, loading }) => {
  if (loading) {
    return (
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        {[0, 1, 2].map((i) => (
          <Card key={i} sx={{ flex: 1, borderRadius: 0 }}>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Skeleton variant="text" width={80} />
              <Skeleton variant="text" width={40} height={32} />
            </CardContent>
          </Card>
        ))}
      </Stack>
    );
  }

  const inProgressCount = encounters.filter((e) => e.status === 'in-progress').length;
  const completedTodayCount = encounters.filter((e) => {
    if (e.status !== 'finished') return false;
    const end = e.period?.end;
    if (!end) return false;
    try {
      return isToday(parseISO(end));
    } catch {
      return false;
    }
  }).length;

  const stats = [
    { label: 'Total Encounters', value: total, color: 'text.primary' },
    { label: 'In Progress', value: inProgressCount, color: 'primary.main' },
    { label: 'Completed Today', value: completedTodayCount, color: 'success.main' }
  ];

  return (
    <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
      {stats.map((stat) => (
        <Card key={stat.label} sx={{ flex: 1, borderRadius: 0 }}>
          <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Typography variant="caption" color="text.secondary">
              {stat.label}
            </Typography>
            <Typography variant="h5" sx={{ color: stat.color, fontWeight: 600 }}>
              {stat.value}
            </Typography>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
};

// --- Main Page Component ---

const EncountersPage = () => {
  const navigate = useNavigate();

  // Data state
  const [encounters, setEncounters] = useState([]);
  const [patientMap, setPatientMap] = useState({}); // patientId -> display name
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter state
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Dialog state
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [summaryDialogOpen, setSummaryDialogOpen] = useState(false);
  const [selectedEncounter, setSelectedEncounter] = useState(null);

  // Refreshing indicator
  const [refreshing, setRefreshing] = useState(false);

  // Debounced search input
  const debouncedSetSearch = useCallback(
    debounce((value) => {
      setDebouncedSearch(value);
      setPage(0);
    }, 400),
    []
  );

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    debouncedSetSearch(e.target.value);
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setDebouncedSearch('');
    setPage(0);
  };

  // Fetch encounters
  const fetchEncounters = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const params = {
        _sort: '-date',
        _count: rowsPerPage,
        _offset: page * rowsPerPage,
        _total: 'accurate',
        _include: 'Encounter:subject'
      };

      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }

      if (debouncedSearch.length >= 2) {
        params['subject:Patient.name'] = debouncedSearch;
      }

      const result = await fhirClient.search('Encounter', params);

      // Separate Encounter resources from included Patient resources
      const allResources = result.resources || [];
      const encounterResources = allResources.filter(
        (r) => r.resourceType === 'Encounter'
      );
      const patientResources = allResources.filter(
        (r) => r.resourceType === 'Patient'
      );

      // Also check bundle entries for included patients (search.mode === 'include')
      // in case the fhirClient pre-filtered resources
      if (result.bundle?.entry) {
        for (const entry of result.bundle.entry) {
          if (
            entry.resource?.resourceType === 'Patient' &&
            entry.search?.mode === 'include' &&
            !patientResources.find((p) => p.id === entry.resource.id)
          ) {
            patientResources.push(entry.resource);
          }
        }
      }

      // Build patient display name map
      const newPatientMap = {};
      for (const pt of patientResources) {
        if (pt.id) {
          const name = pt.name?.[0] || {};
          const given = (name.given || []).join(' ');
          const family = name.family || '';
          const display = family && given
            ? `${family}, ${given}`
            : family || given || `Patient/${pt.id}`;
          newPatientMap[pt.id] = display;
        }
      }

      setPatientMap(newPatientMap);
      setEncounters(encounterResources);
      setTotal(result.total || 0);
    } catch (err) {
      console.error('Failed to fetch encounters:', err);
      setError('Failed to load encounters. The FHIR server may be unavailable.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, debouncedSearch, page, rowsPerPage]);

  // Initial load and filter/page changes
  useEffect(() => {
    fetchEncounters();
  }, [fetchEncounters]);

  // Filter change resets page
  const handleStatusFilterChange = (e) => {
    setStatusFilter(e.target.value);
    setPage(0);
  };

  const handlePageChange = (_, newPage) => {
    setPage(newPage);
  };

  const handleRowsPerPageChange = (e) => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0);
  };

  const handleRefresh = () => {
    fetchEncounters(true);
  };

  const handleEncounterCreated = () => {
    fetchEncounters(true);
  };

  const handleOpenChart = (encounter) => {
    const patientId = extractPatientId(encounter);
    if (patientId) {
      navigate(`/patients/${encodeURIComponent(patientId)}/clinical`);
    }
  };

  const handleViewSummary = (encounter) => {
    setSelectedEncounter(encounter);
    setSummaryDialogOpen(true);
  };

  // --- Render ---

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
      {/* Page Header */}
      <Stack
        direction="row"
        spacing={2}
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 2 }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <EncounterIcon color="primary" sx={{ fontSize: 32 }} />
          <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
            Encounters
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Refresh encounters">
            <IconButton
              onClick={handleRefresh}
              disabled={refreshing}
              aria-label="Refresh encounters"
            >
              {refreshing ? <CircularProgress size={22} /> : <RefreshIcon />}
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setNewDialogOpen(true)}
            sx={{ borderRadius: 0 }}
          >
            New Encounter
          </Button>
        </Stack>
      </Stack>

      {/* Educational Info Banner */}
      <Alert
        severity="info"
        icon={<InfoIcon />}
        sx={{ mb: 2, borderRadius: 0 }}
      >
        Encounters are loaded from Synthea synthetic patient data stored in HAPI FHIR.
        This is an educational tool -- never use with real patient data.
      </Alert>

      {/* Summary Stats */}
      <SummaryStats encounters={encounters} total={total} loading={loading} />

      {/* Filter Bar */}
      <Paper
        variant="outlined"
        sx={{ p: 2, mb: 2, borderRadius: 0, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}
      >
        <TextField
          size="small"
          placeholder="Search by patient name..."
          value={searchTerm}
          onChange={handleSearchChange}
          sx={{ minWidth: 260 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" fontSize="small" />
              </InputAdornment>
            ),
            endAdornment: searchTerm ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={handleClearSearch} aria-label="Clear search">
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : null
          }}
          aria-label="Search encounters by patient name"
        />

        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel id="status-filter-label">Status</InputLabel>
          <Select
            labelId="status-filter-label"
            value={statusFilter}
            label="Status"
            onChange={handleStatusFilterChange}
          >
            {STATUS_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {(statusFilter !== 'all' || debouncedSearch) && (
          <Button
            size="small"
            onClick={() => {
              setStatusFilter('all');
              handleClearSearch();
            }}
            startIcon={<ClearIcon />}
          >
            Clear Filters
          </Button>
        )}
      </Paper>

      {/* Error State */}
      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 0 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Encounters Table */}
      <Paper variant="outlined" sx={{ borderRadius: 0 }}>
        <TableContainer>
          <Table size="small" aria-label="Encounters table">
            <TableHead>
              <TableRow sx={{ '& th': { fontWeight: 600, backgroundColor: 'grey.50' } }}>
                <TableCell>Patient</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Date / Time</TableCell>
                <TableCell>Provider</TableCell>
                <TableCell>Reason</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                // Loading skeletons
                Array.from({ length: 5 }).map((_, idx) => (
                  <TableRow key={`skeleton-${idx}`}>
                    {Array.from({ length: 7 }).map((__, cIdx) => (
                      <TableCell key={cIdx}>
                        <Skeleton variant="text" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : encounters.length === 0 ? (
                // Empty state
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                    <Stack spacing={1} alignItems="center">
                      <EncounterIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
                      <Typography variant="body1" color="text.secondary">
                        No encounters found
                      </Typography>
                      <Typography variant="body2" color="text.disabled">
                        {debouncedSearch || statusFilter !== 'all'
                          ? 'Try adjusting your search or filters.'
                          : 'Create a new encounter to get started.'}
                      </Typography>
                    </Stack>
                  </TableCell>
                </TableRow>
              ) : (
                // Data rows
                encounters.map((encounter) => {
                  const statusProps = getStatusChipProps(encounter.status);
                  const patientId = extractPatientId(encounter);

                  return (
                    <TableRow
                      key={encounter.id}
                      hover
                      sx={{ '&:last-child td': { borderBottom: 0 } }}
                    >
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {extractPatientDisplay(encounter, patientMap)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {extractEncounterType(encounter)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={statusProps.label}
                          color={statusProps.color}
                          size="small"
                          icon={statusProps.icon}
                          sx={{ borderRadius: 0 }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatEncounterDate(encounter)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {extractProvider(encounter)}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ maxWidth: 200 }}>
                        <Typography variant="body2" noWrap title={extractReasonForVisit(encounter)}>
                          {extractReasonForVisit(encounter)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <Tooltip title="Open patient chart">
                            <span>
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => handleOpenChart(encounter)}
                                disabled={!patientId}
                                aria-label={`Open chart for ${extractPatientDisplay(encounter, patientMap)}`}
                              >
                                <OpenChartIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title="View encounter summary">
                            <IconButton
                              size="small"
                              onClick={() => handleViewSummary(encounter)}
                              aria-label={`View summary for encounter ${encounter.id}`}
                            >
                              <SummaryIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        {!loading && encounters.length > 0 && (
          <TablePagination
            component="div"
            count={total}
            page={page}
            onPageChange={handlePageChange}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleRowsPerPageChange}
            rowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
            sx={{ borderTop: 1, borderColor: 'divider' }}
          />
        )}
      </Paper>

      {/* New Encounter Dialog */}
      <NewEncounterDialog
        open={newDialogOpen}
        onClose={() => setNewDialogOpen(false)}
        onCreated={handleEncounterCreated}
      />

      {/* Encounter Summary Dialog */}
      <EncounterSummaryDialog
        open={summaryDialogOpen}
        onClose={() => {
          setSummaryDialogOpen(false);
          setSelectedEncounter(null);
        }}
        encounter={selectedEncounter}
        patientMap={patientMap}
      />
    </Box>
  );
};

export default EncountersPage;
