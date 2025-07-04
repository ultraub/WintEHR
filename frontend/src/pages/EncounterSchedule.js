import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Alert,
  Tabs,
  Tab,
  FormHelperText,
  Autocomplete,
  Stack,
  Fab,
  Tooltip
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Cancel as CancelIcon,
  Schedule as ScheduleIcon,
  EventAvailable as EventAvailableIcon,
  Person as PersonIcon,
  LocationOn as LocationIcon,
  CalendarToday as CalendarIcon,
  AccessTime as TimeIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider, DateTimePicker } from '@mui/x-date-pickers';
import { format, addMinutes, isAfter, isBefore } from 'date-fns';
import { useAppointments, APPOINTMENT_STATUS, PARTICIPANT_STATUS } from '../contexts/AppointmentContext';
import { useFHIR } from '../hooks/useFHIR';

function TabPanel(props) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`appointment-tabpanel-${index}`}
      aria-labelledby={`appointment-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

function EncounterSchedule() {
  const navigate = useNavigate();
  const {
    appointments,
    loading,
    error,
    fetchAppointments,
    createAppointment,
    updateAppointment,
    cancelAppointment,
    rescheduleAppointment,
    clearError,
    APPOINTMENT_STATUS: STATUS
  } = useAppointments();

  const { searchPatients, searchPractitioners, searchLocations } = useFHIR();

  const [tabValue, setTabValue] = useState(0);
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState('create'); // 'create', 'edit', 'reschedule'
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [formData, setFormData] = useState({
    status: STATUS.BOOKED,
    start: new Date(),
    end: addMinutes(new Date(), 30),
    description: '',
    patient: null,
    practitioner: null,
    location: null,
    priority: 5,
    appointmentType: '',
    serviceType: '',
    reasonCode: '',
    comment: ''
  });

  const [patients, setPatients] = useState([]);
  const [practitioners, setPractitioners] = useState([]);
  const [locations, setLocations] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    fetchAppointments();
    loadReferenceData();
  }, []);

  const loadReferenceData = async () => {
    setSearchLoading(true);
    try {
      const [patientsRes, practitionersRes, locationsRes] = await Promise.all([
        searchPatients({ _count: 100 }),
        searchPractitioners({ _count: 100 }),
        searchLocations({ _count: 100 })
      ]);
      
      setPatients(patientsRes.data.entry?.map(e => e.resource) || []);
      setPractitioners(practitionersRes.data.entry?.map(e => e.resource) || []);
      setLocations(locationsRes.data.entry?.map(e => e.resource) || []);
    } catch (error) {
      console.error('Error loading reference data:', error);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleOpenDialog = (mode, appointment = null) => {
    setDialogMode(mode);
    setSelectedAppointment(appointment);
    
    if (appointment) {
      // Extract participant data
      const patient = appointment.participant?.find(p => p.actor?.reference?.startsWith('Patient/'));
      const practitioner = appointment.participant?.find(p => p.actor?.reference?.startsWith('Practitioner/'));
      const location = appointment.participant?.find(p => p.actor?.reference?.startsWith('Location/'));
      
      setFormData({
        status: appointment.status || STATUS.BOOKED,
        start: new Date(appointment.start),
        end: new Date(appointment.end),
        description: appointment.description || '',
        patient: patient ? patients.find(p => p.id === patient.actor.reference.split('/')[1]) : null,
        practitioner: practitioner ? practitioners.find(p => p.id === practitioner.actor.reference.split('/')[1]) : null,
        location: location ? locations.find(l => l.id === location.actor.reference.split('/')[1]) : null,
        priority: appointment.priority || 5,
        appointmentType: appointment.appointmentType?.text || '',
        serviceType: appointment.serviceType?.[0]?.text || '',
        reasonCode: appointment.reasonCode?.[0]?.text || '',
        comment: appointment.comment || ''
      });
    } else {
      setFormData({
        status: STATUS.BOOKED,
        start: new Date(),
        end: addMinutes(new Date(), 30),
        description: '',
        patient: null,
        practitioner: null,
        location: null,
        priority: 5,
        appointmentType: '',
        serviceType: '',
        reasonCode: '',
        comment: ''
      });
    }
    
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedAppointment(null);
    clearError();
  };

  const handleFormChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Auto-adjust end time when start time changes
    if (field === 'start' && value) {
      setFormData(prev => ({
        ...prev,
        end: addMinutes(value, 30)
      }));
    }
  };

  const validateForm = () => {
    const errors = [];
    
    if (!formData.start) errors.push('Start time is required');
    if (!formData.end) errors.push('End time is required');
    if (!formData.patient) errors.push('Patient is required');
    if (!formData.practitioner) errors.push('Practitioner is required');
    
    if (formData.start && formData.end && !isAfter(formData.end, formData.start)) {
      errors.push('End time must be after start time');
    }
    
    return errors;
  };

  const handleSubmit = async () => {
    const errors = validateForm();
    if (errors.length > 0) {
      alert(errors.join('\n'));
      return;
    }

    try {
      const appointmentData = {
        status: formData.status,
        start: formData.start.toISOString(),
        end: formData.end.toISOString(),
        description: formData.description,
        priority: formData.priority,
        comment: formData.comment,
        participant: [
          {
            actor: {
              reference: `Patient/${formData.patient.id}`,
              display: `${formData.patient.name?.[0]?.given?.[0]} ${formData.patient.name?.[0]?.family}`
            },
            status: PARTICIPANT_STATUS.ACCEPTED,
            required: 'required'
          },
          {
            actor: {
              reference: `Practitioner/${formData.practitioner.id}`,
              display: `${formData.practitioner.name?.[0]?.given?.[0]} ${formData.practitioner.name?.[0]?.family}`
            },
            status: PARTICIPANT_STATUS.ACCEPTED,
            required: 'required'
          }
        ]
      };

      if (formData.location) {
        appointmentData.participant.push({
          actor: {
            reference: `Location/${formData.location.id}`,
            display: formData.location.name
          },
          status: PARTICIPANT_STATUS.ACCEPTED,
          required: 'information-only'
        });
      }

      if (formData.appointmentType) {
        appointmentData.appointmentType = { text: formData.appointmentType };
      }

      if (formData.serviceType) {
        appointmentData.serviceType = [{ text: formData.serviceType }];
      }

      if (formData.reasonCode) {
        appointmentData.reasonCode = [{ text: formData.reasonCode }];
      }

      if (dialogMode === 'create') {
        await createAppointment(appointmentData);
      } else if (dialogMode === 'edit') {
        await updateAppointment(selectedAppointment.id, appointmentData);
      } else if (dialogMode === 'reschedule') {
        await rescheduleAppointment(selectedAppointment.id, formData.start.toISOString(), formData.end.toISOString());
      }

      handleCloseDialog();
      fetchAppointments(); // Refresh the list
    } catch (error) {
      console.error('Error saving appointment:', error);
    }
  };

  const handleCancelAppointment = async (appointment) => {
    if (window.confirm('Are you sure you want to cancel this appointment?')) {
      try {
        await cancelAppointment(appointment.id, 'Cancelled by user');
        fetchAppointments();
      } catch (error) {
        console.error('Error cancelling appointment:', error);
      }
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case STATUS.BOOKED: return 'primary';
      case STATUS.ARRIVED: return 'info';
      case STATUS.FULFILLED: return 'success';
      case STATUS.CANCELLED: return 'error';
      case STATUS.NOSHOW: return 'warning';
      default: return 'default';
    }
  };

  const getPatientName = (appointment) => {
    const patient = appointment.participant?.find(p => p.actor?.reference?.startsWith('Patient/'));
    return patient?.actor?.display || 'Unknown Patient';
  };

  const getPractitionerName = (appointment) => {
    const practitioner = appointment.participant?.find(p => p.actor?.reference?.startsWith('Practitioner/'));
    return practitioner?.actor?.display || 'Unknown Practitioner';
  };

  const getLocationName = (appointment) => {
    const location = appointment.participant?.find(p => p.actor?.reference?.startsWith('Location/'));
    return location?.actor?.display || 'No location';
  };

  const todayAppointments = appointments.filter(apt => {
    const today = new Date();
    const aptDate = new Date(apt.start);
    return aptDate.toDateString() === today.toDateString();
  });

  const upcomingAppointments = appointments.filter(apt => {
    const today = new Date();
    const aptDate = new Date(apt.start);
    return aptDate > today;
  });

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4">
            Appointment Scheduling
          </Typography>
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/dashboard')}
          >
            Back to Dashboard
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={clearError}>
            {error}
          </Alert>
        )}

        <Paper>
          <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
            <Tab label="Today's Appointments" icon={<CalendarIcon />} />
            <Tab label="All Appointments" icon={<ScheduleIcon />} />
            <Tab label="Calendar View" icon={<EventAvailableIcon />} />
          </Tabs>

          <TabPanel value={tabValue} index={0}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Today's Schedule ({todayAppointments.length} appointments)
                </Typography>
                {todayAppointments.length === 0 ? (
                  <Box textAlign="center" py={4}>
                    <Typography color="textSecondary">
                      No appointments scheduled for today
                    </Typography>
                  </Box>
                ) : (
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Time</TableCell>
                          <TableCell>Patient</TableCell>
                          <TableCell>Practitioner</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {todayAppointments.map((appointment) => (
                          <TableRow key={appointment.id}>
                            <TableCell>
                              {format(new Date(appointment.start), 'HH:mm')} - 
                              {format(new Date(appointment.end), 'HH:mm')}
                            </TableCell>
                            <TableCell>{getPatientName(appointment)}</TableCell>
                            <TableCell>{getPractitionerName(appointment)}</TableCell>
                            <TableCell>
                              <Chip
                                label={appointment.status}
                                color={getStatusColor(appointment.status)}
                                size="small"
                              />
                            </TableCell>
                            <TableCell>
                              <IconButton
                                size="small"
                                onClick={() => handleOpenDialog('edit', appointment)}
                              >
                                <EditIcon />
                              </IconButton>
                              <IconButton
                                size="small"
                                onClick={() => handleCancelAppointment(appointment)}
                                disabled={appointment.status === STATUS.CANCELLED}
                              >
                                <CancelIcon />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Grid>
            </Grid>
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  All Appointments ({appointments.length} total)
                </Typography>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Date & Time</TableCell>
                        <TableCell>Patient</TableCell>
                        <TableCell>Practitioner</TableCell>
                        <TableCell>Location</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {appointments.map((appointment) => (
                        <TableRow key={appointment.id}>
                          <TableCell>
                            <Box>
                              <Typography variant="body2">
                                {format(new Date(appointment.start), 'MMM dd, yyyy')}
                              </Typography>
                              <Typography variant="caption" color="textSecondary">
                                {format(new Date(appointment.start), 'HH:mm')} - 
                                {format(new Date(appointment.end), 'HH:mm')}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>{getPatientName(appointment)}</TableCell>
                          <TableCell>{getPractitionerName(appointment)}</TableCell>
                          <TableCell>{getLocationName(appointment)}</TableCell>
                          <TableCell>
                            <Chip
                              label={appointment.status}
                              color={getStatusColor(appointment.status)}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <IconButton
                              size="small"
                              onClick={() => handleOpenDialog('edit', appointment)}
                            >
                              <EditIcon />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => handleOpenDialog('reschedule', appointment)}
                            >
                              <ScheduleIcon />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => handleCancelAppointment(appointment)}
                              disabled={appointment.status === STATUS.CANCELLED}
                            >
                              <CancelIcon />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>
            </Grid>
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            <Box textAlign="center" py={8}>
              <Typography variant="h6" color="textSecondary">
                Calendar view coming soon...
              </Typography>
              <Typography variant="body2" color="textSecondary">
                This will show a full calendar interface for appointment management
              </Typography>
            </Box>
          </TabPanel>
        </Paper>

        {/* Floating Action Button */}
        <Tooltip title="Schedule New Appointment">
          <Fab
            color="primary"
            sx={{ position: 'fixed', bottom: 16, right: 16 }}
            onClick={() => handleOpenDialog('create')}
          >
            <AddIcon />
          </Fab>
        </Tooltip>

        {/* Appointment Dialog */}
        <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
          <DialogTitle>
            {dialogMode === 'create' ? 'Schedule New Appointment' :
             dialogMode === 'edit' ? 'Edit Appointment' :
             'Reschedule Appointment'}
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={3} sx={{ mt: 1 }}>
              <Grid item xs={12} md={6}>
                <DateTimePicker
                  label="Start Time"
                  value={formData.start}
                  onChange={(value) => handleFormChange('start', value)}
                  renderInput={(params) => <TextField {...params} fullWidth />}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <DateTimePicker
                  label="End Time"
                  value={formData.end}
                  onChange={(value) => handleFormChange('end', value)}
                  renderInput={(params) => <TextField {...params} fullWidth />}
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Autocomplete
                  options={patients}
                  getOptionLabel={(option) => 
                    `${option.name?.[0]?.given?.[0]} ${option.name?.[0]?.family} (${option.id})`
                  }
                  value={formData.patient}
                  onChange={(event, value) => handleFormChange('patient', value)}
                  renderInput={(params) => (
                    <TextField {...params} label="Patient" required />
                  )}
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Autocomplete
                  options={practitioners}
                  getOptionLabel={(option) => 
                    `${option.name?.[0]?.given?.[0]} ${option.name?.[0]?.family} - ${option.qualification?.[0]?.code?.text || 'Practitioner'}`
                  }
                  value={formData.practitioner}
                  onChange={(event, value) => handleFormChange('practitioner', value)}
                  renderInput={(params) => (
                    <TextField {...params} label="Practitioner" required />
                  )}
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Autocomplete
                  options={locations}
                  getOptionLabel={(option) => option.name || option.id}
                  value={formData.location}
                  onChange={(event, value) => handleFormChange('location', value)}
                  renderInput={(params) => (
                    <TextField {...params} label="Location" />
                  )}
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={formData.status}
                    onChange={(e) => handleFormChange('status', e.target.value)}
                  >
                    {Object.values(STATUS).map((status) => (
                      <MenuItem key={status} value={status}>
                        {status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ')}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  label="Appointment Type"
                  value={formData.appointmentType}
                  onChange={(e) => handleFormChange('appointmentType', e.target.value)}
                  fullWidth
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  label="Service Type"
                  value={formData.serviceType}
                  onChange={(e) => handleFormChange('serviceType', e.target.value)}
                  fullWidth
                />
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  label="Reason for Appointment"
                  value={formData.reasonCode}
                  onChange={(e) => handleFormChange('reasonCode', e.target.value)}
                  fullWidth
                />
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  label="Description"
                  value={formData.description}
                  onChange={(e) => handleFormChange('description', e.target.value)}
                  multiline
                  rows={3}
                  fullWidth
                />
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  label="Comments"
                  value={formData.comment}
                  onChange={(e) => handleFormChange('comment', e.target.value)}
                  multiline
                  rows={2}
                  fullWidth
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button 
              onClick={handleSubmit} 
              variant="contained" 
              disabled={loading}
            >
              {dialogMode === 'create' ? 'Schedule' :
               dialogMode === 'edit' ? 'Update' :
               'Reschedule'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
}

export default EncounterSchedule;