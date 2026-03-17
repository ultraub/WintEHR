import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Chip,
  Alert,
  Stack,
  Grid,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Tooltip,
  Divider,
  ToggleButton,
  ToggleButtonGroup,
  Autocomplete
} from '@mui/material';
import {
  CalendarMonth as ScheduleIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Today as TodayIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  Person as PersonIcon,
  AccessTime as TimeIcon,
  EventAvailable as CheckInIcon,
  EventBusy as NoShowIcon,
  CheckCircle as CompletedIcon,
  Cancel as CancelledIcon,
  Event as BookedIcon,
  Info as InfoIcon,
  ViewDay as DayViewIcon,
  ViewWeek as WeekViewIcon,
  Phone as TelehealthIcon,
  LocalHospital as UrgentIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { format, addDays, subDays, startOfWeek, endOfWeek, eachDayOfInterval, isToday, isSameDay, parseISO } from 'date-fns';
import { fhirClient } from '../core/fhir/services/fhirClient';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TIME_SLOTS = Array.from({ length: 18 }, (_, i) => {
  const hour = Math.floor(i / 2) + 8;
  const minute = (i % 2) * 30;
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
});

const APPOINTMENT_TYPES = [
  { value: 'office-visit', label: 'Office Visit' },
  { value: 'follow-up', label: 'Follow-up' },
  { value: 'physical', label: 'Physical Exam' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'telehealth', label: 'Telehealth' }
];

const DURATIONS = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '60 min' }
];

const STATUS_CONFIG = {
  booked:      { label: 'Booked',     color: 'info',    muiColor: '#1976d2', bgColor: '#e3f2fd', icon: BookedIcon },
  'checked-in': { label: 'Checked In', color: 'warning', muiColor: '#ed6c02', bgColor: '#fff3e0', icon: CheckInIcon },
  fulfilled:   { label: 'Completed',  color: 'success', muiColor: '#2e7d32', bgColor: '#e8f5e9', icon: CompletedIcon },
  cancelled:   { label: 'Cancelled',  color: 'default', muiColor: '#9e9e9e', bgColor: '#f5f5f5', icon: CancelledIcon },
  noshow:      { label: 'No Show',    color: 'error',   muiColor: '#d32f2f', bgColor: '#fbe9e7', icon: NoShowIcon }
};

const TYPE_ICONS = {
  'telehealth': TelehealthIcon,
  'urgent': UrgentIcon
};

// ---------------------------------------------------------------------------
// Helper: format a time string for display (e.g. "08:00" -> "8:00 AM")
// ---------------------------------------------------------------------------
function formatTimeDisplay(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayHour}:${m.toString().padStart(2, '0')} ${suffix}`;
}

// ---------------------------------------------------------------------------
// Helper: compute the slot span for an appointment's duration
// ---------------------------------------------------------------------------
function durationToSlots(minutes) {
  return Math.max(1, Math.round(minutes / 30));
}

// ---------------------------------------------------------------------------
// Sub-component: StatusChip
// ---------------------------------------------------------------------------
function StatusChip({ status, size = 'small' }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.booked;
  return (
    <Chip
      label={cfg.label}
      color={cfg.color}
      size={size}
      sx={{ fontWeight: 600, borderRadius: 0 }}
    />
  );
}

// ---------------------------------------------------------------------------
// Sub-component: TodaysSummary
// ---------------------------------------------------------------------------
function TodaysSummary({ appointments }) {
  const stats = useMemo(() => {
    const total = appointments.length;
    const checkedIn = appointments.filter(a => a.status === 'checked-in').length;
    const completed = appointments.filter(a => a.status === 'fulfilled').length;
    const noShows = appointments.filter(a => a.status === 'noshow').length;
    const cancelled = appointments.filter(a => a.status === 'cancelled').length;
    const booked = appointments.filter(a => a.status === 'booked').length;
    return { total, checkedIn, completed, noShows, cancelled, booked };
  }, [appointments]);

  const cards = [
    { label: 'Total',      value: stats.total,     color: '#1976d2', bgColor: '#e3f2fd' },
    { label: 'Booked',     value: stats.booked,    color: '#1976d2', bgColor: '#e3f2fd' },
    { label: 'Checked In', value: stats.checkedIn, color: '#ed6c02', bgColor: '#fff3e0' },
    { label: 'Completed',  value: stats.completed, color: '#2e7d32', bgColor: '#e8f5e9' },
    { label: 'No Shows',   value: stats.noShows,   color: '#d32f2f', bgColor: '#fbe9e7' }
  ];

  return (
    <Grid container spacing={1.5}>
      {cards.map((c) => (
        <Grid item xs={6} sm={4} md key={c.label}>
          <Card
            sx={{
              borderRadius: 0,
              borderLeft: `4px solid ${c.color}`,
              bgcolor: c.bgColor
            }}
            elevation={0}
          >
            <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="h5" sx={{ fontWeight: 700, color: c.color }}>
                {c.value}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {c.label}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: AppointmentCard
// ---------------------------------------------------------------------------
function AppointmentCard({ appointment, onStatusChange }) {
  const cfg = STATUS_CONFIG[appointment.status] || STATUS_CONFIG.booked;
  const TypeIcon = TYPE_ICONS[appointment.appointmentType] || null;

  return (
    <Paper
      elevation={0}
      sx={{
        p: 1,
        borderRadius: 0,
        borderLeft: `3px solid ${cfg.muiColor}`,
        bgcolor: cfg.bgColor,
        cursor: 'default',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        overflow: 'hidden',
        '&:hover': { boxShadow: 2 }
      }}
    >
      <Box>
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.25 }}>
          <PersonIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
          <Typography
            variant="body2"
            sx={{ fontWeight: 600, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            title={appointment.patientName}
          >
            {appointment.patientName}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <TimeIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
          <Typography variant="caption" color="text.secondary">
            {formatTimeDisplay(appointment.startTime)}
            {' - '}
            {appointment.duration}m
          </Typography>
          {TypeIcon && (
            <Tooltip title={appointment.appointmentType}>
              <TypeIcon sx={{ fontSize: 14, color: cfg.muiColor }} />
            </Tooltip>
          )}
        </Stack>
        {appointment.reason && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {appointment.reason}
          </Typography>
        )}
      </Box>
      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.5 }}>
        <StatusChip status={appointment.status} />
        {appointment.status === 'booked' && (
          <Tooltip title="Check in patient">
            <IconButton
              size="small"
              onClick={(e) => { e.stopPropagation(); onStatusChange(appointment.id, 'checked-in'); }}
              aria-label={`Check in ${appointment.patientName}`}
              sx={{ p: 0.25 }}
            >
              <CheckInIcon sx={{ fontSize: 16, color: '#ed6c02' }} />
            </IconButton>
          </Tooltip>
        )}
        {appointment.status === 'checked-in' && (
          <Tooltip title="Mark completed">
            <IconButton
              size="small"
              onClick={(e) => { e.stopPropagation(); onStatusChange(appointment.id, 'fulfilled'); }}
              aria-label={`Mark ${appointment.patientName} completed`}
              sx={{ p: 0.25 }}
            >
              <CompletedIcon sx={{ fontSize: 16, color: '#2e7d32' }} />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
    </Paper>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: DailyScheduleView
// ---------------------------------------------------------------------------
function DailyScheduleView({ appointments, onStatusChange }) {
  const appointmentsBySlot = useMemo(() => {
    const map = {};
    TIME_SLOTS.forEach(slot => { map[slot] = []; });
    appointments.forEach(appt => {
      const slot = appt.startTime;
      if (map[slot]) {
        map[slot].push(appt);
      } else {
        // Find closest slot
        const closest = TIME_SLOTS.reduce((prev, curr) =>
          Math.abs(curr.localeCompare(slot)) < Math.abs(prev.localeCompare(slot)) ? curr : prev
        );
        if (map[closest]) map[closest].push(appt);
      }
    });
    return map;
  }, [appointments]);

  return (
    <Paper elevation={0} sx={{ borderRadius: 0, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
      {/* Header */}
      <Box sx={{ px: 2, py: 1, bgcolor: 'grey.50', borderBottom: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <ScheduleIcon fontSize="small" color="primary" />
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Daily Schedule
          </Typography>
          <Typography variant="caption" color="text.secondary">
            8:00 AM - 5:00 PM
          </Typography>
        </Stack>
      </Box>

      {/* Time grid */}
      <Box
        role="grid"
        aria-label="Daily schedule time grid"
        sx={{ maxHeight: 'calc(100vh - 380px)', overflowY: 'auto' }}
      >
        {TIME_SLOTS.map((slot, idx) => {
          const slotAppointments = appointmentsBySlot[slot] || [];
          const isHourBoundary = slot.endsWith(':00');

          return (
            <Box
              key={slot}
              role="row"
              aria-label={`Time slot ${formatTimeDisplay(slot)}`}
              sx={{
                display: 'flex',
                minHeight: 56,
                borderBottom: '1px solid',
                borderColor: isHourBoundary ? 'divider' : 'grey.100',
                bgcolor: idx % 2 === 0 ? 'background.paper' : 'grey.50',
                '&:hover': { bgcolor: 'action.hover' }
              }}
            >
              {/* Time label */}
              <Box
                sx={{
                  width: 80,
                  minWidth: 80,
                  px: 1.5,
                  py: 1,
                  display: 'flex',
                  alignItems: 'flex-start',
                  borderRight: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'grey.50'
                }}
              >
                <Typography
                  variant="caption"
                  sx={{ fontWeight: isHourBoundary ? 600 : 400, color: isHourBoundary ? 'text.primary' : 'text.secondary' }}
                >
                  {formatTimeDisplay(slot)}
                </Typography>
              </Box>

              {/* Appointments */}
              <Box
                role="gridcell"
                sx={{ flex: 1, p: 0.5, display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'flex-start' }}
              >
                {slotAppointments.map(appt => (
                  <Box key={appt.id} sx={{ width: slotAppointments.length > 1 ? 'calc(50% - 4px)' : '100%' }}>
                    <AppointmentCard appointment={appt} onStatusChange={onStatusChange} />
                  </Box>
                ))}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: WeeklyScheduleView
// ---------------------------------------------------------------------------
function WeeklyScheduleView({ selectedDate, appointments, onStatusChange, onDateClick }) {
  const weekDays = useMemo(() => {
    const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const end = endOfWeek(selectedDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end }).slice(0, 5); // Mon-Fri
  }, [selectedDate]);

  const appointmentsByDay = useMemo(() => {
    const map = {};
    weekDays.forEach(day => {
      const key = format(day, 'yyyy-MM-dd');
      map[key] = appointments.filter(a => a.date === key);
    });
    return map;
  }, [weekDays, appointments]);

  return (
    <Paper elevation={0} sx={{ borderRadius: 0, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
      <Grid container>
        {weekDays.map((day) => {
          const key = format(day, 'yyyy-MM-dd');
          const dayAppointments = appointmentsByDay[key] || [];
          const today = isToday(day);

          return (
            <Grid
              item
              xs={12}
              sm={6}
              md
              key={key}
              sx={{ borderRight: '1px solid', borderColor: 'divider', '&:last-child': { borderRight: 0 } }}
            >
              {/* Day header */}
              <Box
                onClick={() => onDateClick(day)}
                sx={{
                  px: 1.5,
                  py: 1,
                  bgcolor: today ? 'primary.main' : 'grey.50',
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  cursor: 'pointer',
                  '&:hover': { bgcolor: today ? 'primary.dark' : 'grey.100' }
                }}
              >
                <Typography
                  variant="subtitle2"
                  sx={{ fontWeight: 600, color: today ? 'primary.contrastText' : 'text.primary' }}
                >
                  {format(day, 'EEE')}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: today ? 'primary.contrastText' : 'text.secondary' }}
                >
                  {format(day, 'MMM d')}
                </Typography>
                <Chip
                  label={dayAppointments.length}
                  size="small"
                  sx={{
                    ml: 1,
                    height: 18,
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    borderRadius: 0,
                    bgcolor: today ? 'rgba(255,255,255,0.2)' : 'grey.200',
                    color: today ? 'primary.contrastText' : 'text.secondary'
                  }}
                />
              </Box>

              {/* Day appointments */}
              <Box sx={{ p: 0.5, minHeight: 200, maxHeight: 'calc(100vh - 380px)', overflowY: 'auto' }}>
                {dayAppointments.length === 0 && (
                  <Typography variant="caption" color="text.disabled" sx={{ display: 'block', textAlign: 'center', mt: 4 }}>
                    No appointments
                  </Typography>
                )}
                <Stack spacing={0.5}>
                  {dayAppointments
                    .sort((a, b) => a.startTime.localeCompare(b.startTime))
                    .map(appt => (
                      <AppointmentCard key={appt.id} appointment={appt} onStatusChange={onStatusChange} />
                    ))}
                </Stack>
              </Box>
            </Grid>
          );
        })}
      </Grid>
    </Paper>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: NewAppointmentDialog
// ---------------------------------------------------------------------------
function NewAppointmentDialog({ open, onClose, onSave, providers, selectedDate }) {
  const [formData, setFormData] = useState({
    patientSearch: '',
    patientId: '',
    patientName: '',
    providerId: '',
    providerName: '',
    appointmentType: 'office-visit',
    date: selectedDate,
    startTime: '09:00',
    duration: 30,
    reason: ''
  });
  const [patientOptions, setPatientOptions] = useState([]);
  const [patientLoading, setPatientLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setFormData(prev => ({
        ...prev,
        patientSearch: '',
        patientId: '',
        patientName: '',
        appointmentType: 'office-visit',
        date: selectedDate,
        startTime: '09:00',
        duration: 30,
        reason: ''
      }));
      setPatientOptions([]);
      setFormError(null);
    }
  }, [open, selectedDate]);

  // Patient search with debounce
  const searchPatients = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setPatientOptions([]);
      return;
    }
    setPatientLoading(true);
    try {
      const data = await fhirClient.search('Patient', { name: query, _count: 10 });
      const patientResources = data.resources || (data.entry || []).map(e => e.resource);
      const patients = patientResources.map(r => {
        const name = r.name?.[0];
        const display = name
          ? `${name.family || ''}, ${(name.given || []).join(' ')}`.trim()
          : `Patient/${r.id}`;
        return { id: r.id, display };
      });
      setPatientOptions(patients);
    } catch (err) {
      console.error('Patient search failed:', err);
    } finally {
      setPatientLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      searchPatients(formData.patientSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [formData.patientSearch, searchPatients]);

  const handleChange = (field) => (e) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
    setFormError(null);
  };

  const handleSave = async () => {
    // Validation
    if (!formData.patientId) {
      setFormError('Please select a patient.');
      return;
    }
    if (!formData.providerId) {
      setFormError('Please select a provider.');
      return;
    }
    if (!formData.startTime) {
      setFormError('Please select a time.');
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        patientId: formData.patientId,
        patientName: formData.patientName,
        providerId: formData.providerId,
        providerName: formData.providerName,
        appointmentType: formData.appointmentType,
        date: format(formData.date, 'yyyy-MM-dd'),
        startTime: formData.startTime,
        duration: formData.duration,
        reason: formData.reason,
        status: 'booked'
      };
      await onSave(payload);
      onClose();
    } catch (err) {
      console.error('Failed to save appointment:', err);
      setFormError(err.message || 'Failed to save appointment. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 0 } }}>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <AddIcon color="primary" />
          <Typography variant="h6">New Appointment</Typography>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          {formError && <Alert severity="error" sx={{ borderRadius: 0 }}>{formError}</Alert>}

          {/* Patient search */}
          <Autocomplete
            freeSolo
            options={patientOptions}
            getOptionLabel={(option) => typeof option === 'string' ? option : option.display}
            loading={patientLoading}
            inputValue={formData.patientSearch}
            onInputChange={(_, value) => {
              setFormData(prev => ({ ...prev, patientSearch: value }));
            }}
            onChange={(_, value) => {
              if (value && typeof value !== 'string') {
                setFormData(prev => ({
                  ...prev,
                  patientId: value.id,
                  patientName: value.display,
                  patientSearch: value.display
                }));
              }
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Patient"
                placeholder="Search by patient name..."
                required
                InputProps={{
                  ...params.InputProps,
                  startAdornment: <PersonIcon sx={{ mr: 1, color: 'text.secondary' }} />
                }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0 } }}
              />
            )}
          />

          {/* Provider select */}
          <FormControl fullWidth required>
            <InputLabel id="provider-label">Provider</InputLabel>
            <Select
              labelId="provider-label"
              value={formData.providerId}
              label="Provider"
              onChange={(e) => {
                const prov = providers.find(p => p.id === e.target.value);
                setFormData(prev => ({
                  ...prev,
                  providerId: e.target.value,
                  providerName: prov ? prov.display : ''
                }));
              }}
              sx={{ borderRadius: 0 }}
            >
              {providers.map(p => (
                <MenuItem key={p.id} value={p.id}>{p.display}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Appointment type */}
          <FormControl fullWidth>
            <InputLabel id="type-label">Appointment Type</InputLabel>
            <Select
              labelId="type-label"
              value={formData.appointmentType}
              label="Appointment Type"
              onChange={handleChange('appointmentType')}
              sx={{ borderRadius: 0 }}
            >
              {APPOINTMENT_TYPES.map(t => (
                <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Date and time row */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <DatePicker
              label="Date"
              value={formData.date}
              onChange={(newDate) => {
                if (newDate) setFormData(prev => ({ ...prev, date: newDate }));
              }}
              slotProps={{
                textField: {
                  fullWidth: true,
                  required: true,
                  sx: { '& .MuiOutlinedInput-root': { borderRadius: 0 } }
                }
              }}
            />
            <FormControl fullWidth required>
              <InputLabel id="time-label">Time</InputLabel>
              <Select
                labelId="time-label"
                value={formData.startTime}
                label="Time"
                onChange={handleChange('startTime')}
                sx={{ borderRadius: 0 }}
              >
                {TIME_SLOTS.map(slot => (
                  <MenuItem key={slot} value={slot}>{formatTimeDisplay(slot)}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          {/* Duration */}
          <FormControl fullWidth>
            <InputLabel id="duration-label">Duration</InputLabel>
            <Select
              labelId="duration-label"
              value={formData.duration}
              label="Duration"
              onChange={handleChange('duration')}
              sx={{ borderRadius: 0 }}
            >
              {DURATIONS.map(d => (
                <MenuItem key={d.value} value={d.value}>{d.label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Reason */}
          <TextField
            label="Reason for Visit"
            value={formData.reason}
            onChange={handleChange('reason')}
            multiline
            rows={2}
            fullWidth
            placeholder="Brief description of reason for visit..."
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0 } }}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose} sx={{ borderRadius: 0 }}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving}
          startIcon={saving ? <CircularProgress size={16} /> : <AddIcon />}
          sx={{ borderRadius: 0 }}
        >
          {saving ? 'Booking...' : 'Book Appointment'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main Page Component: Schedule
// ---------------------------------------------------------------------------
const Schedule = () => {
  // State
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('day');
  const [appointments, setAppointments] = useState([]);
  const [providers, setProviders] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch providers on mount
  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const bundle = await fhirClient.search('Practitioner', { _count: 50, active: true });
        const pracResources = bundle.resources || (bundle.entry || []).map(e => e.resource);
        const pracs = pracResources.map(r => {
          const name = r.name?.[0];
          const display = name
            ? `${(name.prefix || []).join(' ')} ${(name.given || []).join(' ')} ${name.family || ''}`.trim()
            : `Practitioner/${r.id}`;
          return { id: r.id, display };
        });
        setProviders(pracs);
      } catch (err) {
        console.error('Failed to fetch providers:', err);
      }
    };
    fetchProviders();
  }, []);

  // Fetch appointments when date or view changes
  const fetchAppointments = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const params = { _sort: 'date', _count: 100 };
      if (viewMode === 'week') {
        const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
        const end = endOfWeek(selectedDate, { weekStartsOn: 1 });
        params.date = [`ge${format(start, 'yyyy-MM-dd')}`, `le${format(end, 'yyyy-MM-dd')}`];
      } else {
        params.date = format(selectedDate, 'yyyy-MM-dd');
      }
      if (selectedProvider !== 'all') {
        params.actor = `Practitioner/${selectedProvider}`;
      }

      const bundle = await fhirClient.search('Appointment', params);
      const apptResources = bundle.resources || (bundle.entry || []).map(e => e.resource);
      const entries = apptResources.map(r => {
        // Flatten FHIR Appointment to the shape the UI expects
        const patientParticipant = r.participant?.find(p => p.actor?.reference?.startsWith('Patient/'));
        const practitionerParticipant = r.participant?.find(p => p.actor?.reference?.startsWith('Practitioner/'));
        return {
          id: r.id,
          status: r.status,
          start: r.start,
          end: r.end,
          appointmentType: r.appointmentType?.coding?.[0]?.code || r.appointmentType?.text || 'ROUTINE',
          reason: r.reasonCode?.[0]?.text || '',
          patientId: patientParticipant?.actor?.reference?.replace('Patient/', '') || '',
          patientName: patientParticipant?.actor?.display || 'Unknown Patient',
          providerId: practitionerParticipant?.actor?.reference?.replace('Practitioner/', '') || '',
          providerName: practitionerParticipant?.actor?.display || 'Unknown Provider',
        };
      });
      setAppointments(entries);
    } catch (err) {
      console.error('Error fetching appointments:', err);
      setError(err.message);
      setAppointments([]);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedDate, viewMode, selectedProvider]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  // Filter appointments by selected provider (client-side fallback)
  const filteredAppointments = useMemo(() => {
    if (selectedProvider === 'all') return appointments;
    return appointments.filter(a => a.providerId === selectedProvider);
  }, [appointments, selectedProvider]);

  // Handlers
  const handlePrevDay = () => {
    setSelectedDate(prev => viewMode === 'week' ? subDays(prev, 7) : subDays(prev, 1));
  };

  const handleNextDay = () => {
    setSelectedDate(prev => viewMode === 'week' ? addDays(prev, 7) : addDays(prev, 1));
  };

  const handleToday = () => {
    setSelectedDate(new Date());
  };

  const handleViewChange = (_, newView) => {
    if (newView) setViewMode(newView);
  };

  const handleStatusChange = async (appointmentId, newStatus) => {
    try {
      // Read current appointment, update status, write back
      const current = await fhirClient.read('Appointment', appointmentId);
      current.status = newStatus;
      await fhirClient.update('Appointment', appointmentId, current);
      setAppointments(prev =>
        prev.map(a => a.id === appointmentId ? { ...a, status: newStatus } : a)
      );
    } catch (err) {
      console.error('Status update failed:', err);
      // Optimistic update for educational demo
      setAppointments(prev =>
        prev.map(a => a.id === appointmentId ? { ...a, status: newStatus } : a)
      );
    }
  };

  const handleSaveAppointment = async (payload) => {
    try {
      // Build ISO start/end from date + time + duration
      const startDateTime = `${payload.date}T${payload.startTime}:00`;
      const startDate = new Date(startDateTime);
      const endDate = new Date(startDate.getTime() + (payload.duration || 30) * 60000);

      // Build participant list — only include practitioner if selected
      const participants = [
        {
          actor: { reference: `Patient/${payload.patientId}`, display: payload.patientName || '' },
          status: 'accepted'
        }
      ];
      if (payload.providerId) {
        participants.push({
          actor: { reference: `Practitioner/${payload.providerId}`, display: payload.providerName || '' },
          status: 'accepted'
        });
      }

      // Build FHIR Appointment resource
      const fhirAppointment = {
        resourceType: 'Appointment',
        status: 'booked',
        appointmentType: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/v2-0276',
            code: payload.appointmentType || 'ROUTINE',
            display: payload.appointmentType || 'Routine'
          }]
        },
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        participant: participants,
        ...(payload.reason ? { reasonCode: [{ text: payload.reason }] } : {})
      };

      const saved = await fhirClient.create('Appointment', fhirAppointment);
      // Refresh list to get the server-assigned data
      fetchAppointments(true);
    } catch (err) {
      console.error('Failed to create appointment:', err);
      setError('Failed to book appointment: ' + err.message);
    }
  };

  const handleWeekDayClick = (day) => {
    setSelectedDate(day);
    setViewMode('day');
  };

  // Date display
  const dateDisplay = useMemo(() => {
    if (viewMode === 'week') {
      const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
      const end = addDays(start, 4); // Mon-Fri
      return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
    }
    return format(selectedDate, 'EEEE, MMMM d, yyyy');
  }, [selectedDate, viewMode]);

  const isTodaySelected = isToday(selectedDate);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Page header */}
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <ScheduleIcon color="primary" sx={{ fontSize: 32 }} />
        <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
          Provider Schedule
        </Typography>
      </Stack>

      {/* Educational banner */}
      <Alert severity="info" icon={<InfoIcon />} sx={{ mb: 2, borderRadius: 0 }}>
        Educational scheduling system using FHIR Appointment resources.
        Appointments are managed through the scheduling API and stored as FHIR resources in HAPI FHIR.
      </Alert>

      {/* Toolbar: date navigation, view toggle, provider filter, actions */}
      <Paper elevation={0} sx={{ mb: 2, p: 1.5, borderRadius: 0, border: '1px solid', borderColor: 'divider' }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          alignItems={{ xs: 'stretch', md: 'center' }}
          justifyContent="space-between"
        >
          {/* Left: date navigation */}
          <Stack direction="row" spacing={1} alignItems="center">
            <IconButton onClick={handlePrevDay} size="small" aria-label="Previous">
              <ChevronLeftIcon />
            </IconButton>
            <Button
              variant={isTodaySelected ? 'contained' : 'outlined'}
              size="small"
              onClick={handleToday}
              startIcon={<TodayIcon />}
              sx={{ borderRadius: 0, minWidth: 90 }}
            >
              Today
            </Button>
            <IconButton onClick={handleNextDay} size="small" aria-label="Next">
              <ChevronRightIcon />
            </IconButton>
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 600, minWidth: 200 }}>
              {dateDisplay}
            </Typography>
          </Stack>

          {/* Center: view toggle */}
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={handleViewChange}
            size="small"
            aria-label="Schedule view mode"
          >
            <ToggleButton value="day" aria-label="Day view" sx={{ borderRadius: 0, px: 2 }}>
              <DayViewIcon sx={{ mr: 0.5, fontSize: 18 }} /> Day
            </ToggleButton>
            <ToggleButton value="week" aria-label="Week view" sx={{ borderRadius: 0, px: 2 }}>
              <WeekViewIcon sx={{ mr: 0.5, fontSize: 18 }} /> Week
            </ToggleButton>
          </ToggleButtonGroup>

          {/* Right: provider filter + actions */}
          <Stack direction="row" spacing={1} alignItems="center">
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel id="provider-filter-label">Provider</InputLabel>
              <Select
                labelId="provider-filter-label"
                value={selectedProvider}
                label="Provider"
                onChange={(e) => setSelectedProvider(e.target.value)}
                sx={{ borderRadius: 0 }}
              >
                <MenuItem value="all">All Providers</MenuItem>
                {providers.map(p => (
                  <MenuItem key={p.id} value={p.id}>{p.display}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Tooltip title="Refresh">
              <IconButton
                onClick={() => fetchAppointments(true)}
                disabled={isRefreshing}
                size="small"
                aria-label="Refresh appointments"
              >
                {isRefreshing ? <CircularProgress size={18} /> : <RefreshIcon />}
              </IconButton>
            </Tooltip>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setDialogOpen(true)}
              sx={{ borderRadius: 0, whiteSpace: 'nowrap' }}
            >
              New Appointment
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {/* Summary cards */}
      <Box sx={{ mb: 2 }}>
        <TodaysSummary appointments={filteredAppointments} />
      </Box>

      {/* Main content */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
          <Stack spacing={2} alignItems="center">
            <CircularProgress />
            <Typography color="text.secondary">Loading schedule...</Typography>
          </Stack>
        </Box>
      ) : error ? (
        <Alert
          severity="warning"
          sx={{ borderRadius: 0 }}
          action={
            <Button color="inherit" size="small" onClick={() => fetchAppointments()}>
              Retry
            </Button>
          }
        >
          {error.includes('404')
            ? 'The scheduling API endpoint is not yet available. Showing empty schedule. You can still create appointments locally for demonstration.'
            : `Failed to load appointments: ${error}`}
        </Alert>
      ) : filteredAppointments.length === 0 && !loading ? (
        <Box>
          {viewMode === 'day' ? (
            <DailyScheduleView appointments={[]} onStatusChange={handleStatusChange} />
          ) : (
            <WeeklyScheduleView
              selectedDate={selectedDate}
              appointments={[]}
              onStatusChange={handleStatusChange}
              onDateClick={handleWeekDayClick}
            />
          )}
          <Alert severity="info" sx={{ mt: 2, borderRadius: 0 }}>
            No appointments scheduled for this {viewMode === 'week' ? 'week' : 'date'}.
            Click "New Appointment" to book one.
          </Alert>
        </Box>
      ) : (
        viewMode === 'day' ? (
          <DailyScheduleView appointments={filteredAppointments} onStatusChange={handleStatusChange} />
        ) : (
          <WeeklyScheduleView
            selectedDate={selectedDate}
            appointments={filteredAppointments}
            onStatusChange={handleStatusChange}
            onDateClick={handleWeekDayClick}
          />
        )
      )}

      {/* New Appointment Dialog */}
      <NewAppointmentDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={handleSaveAppointment}
        providers={providers}
        selectedDate={selectedDate}
      />
    </Box>
  );
};

export default Schedule;
