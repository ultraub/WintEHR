/**
 * AppointmentsTab Component
 * Shows patient appointments within the clinical workspace
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Button,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  CircularProgress,
  Tooltip,
  Stack
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Cancel as CancelIcon,
  Schedule as ScheduleIcon,
  Event as EventIcon,
  Person as PersonIcon,
  LocationOn as LocationIcon,
  AccessTime as TimeIcon
} from '@mui/icons-material';
import { format, parseISO, isToday, isFuture, isPast } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useAppointments } from '../../../contexts/AppointmentContext';
import { useClinical } from '../../../contexts/ClinicalContext';

function AppointmentsTab() {
  const navigate = useNavigate();
  const { currentPatient } = useClinical();
  const {
    appointments,
    loading,
    error,
    getAppointmentsByPatient,
    cancelAppointment,
    clearError,
    APPOINTMENT_STATUS
  } = useAppointments();

  const [patientAppointments, setPatientAppointments] = useState([]);

  useEffect(() => {
    if (currentPatient?.id) {
      loadPatientAppointments();
    }
  }, [currentPatient?.id]);

  const loadPatientAppointments = async () => {
    try {
      const result = await getAppointmentsByPatient(currentPatient.id);
      if (result?.appointments) {
        setPatientAppointments(result.appointments);
      }
    } catch (error) {
      
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case APPOINTMENT_STATUS.BOOKED: return 'primary';
      case APPOINTMENT_STATUS.ARRIVED: return 'info';
      case APPOINTMENT_STATUS.FULFILLED: return 'success';
      case APPOINTMENT_STATUS.CANCELLED: return 'error';
      case APPOINTMENT_STATUS.NOSHOW: return 'warning';
      default: return 'default';
    }
  };

  const getAppointmentIcon = (status, startDate) => {
    const appointmentDate = parseISO(startDate);
    
    if (isToday(appointmentDate)) {
      return <EventIcon color="primary" />;
    } else if (isFuture(appointmentDate)) {
      return <ScheduleIcon color="action" />;
    } else {
      return <EventIcon color="disabled" />;
    }
  };

  const getPractitionerName = (appointment) => {
    const practitioner = appointment.participant?.find(p => 
      p.actor?.reference?.startsWith('Practitioner/')
    );
    return practitioner?.actor?.display || 'Unknown Practitioner';
  };

  const getLocationName = (appointment) => {
    const location = appointment.participant?.find(p => 
      p.actor?.reference?.startsWith('Location/')
    );
    return location?.actor?.display || 'No location specified';
  };

  const handleCancelAppointment = async (appointment) => {
    if (window.confirm('Are you sure you want to cancel this appointment?')) {
      try {
        await cancelAppointment(appointment.id, 'Cancelled from clinical workspace');
        await loadPatientAppointments(); // Refresh the list
      } catch (error) {
        
      }
    }
  };

  const handleScheduleNew = () => {
    navigate(`/schedule?patient=${currentPatient.id}`);
  };

  const handleEditAppointment = (appointment) => {
    navigate(`/schedule?edit=${appointment.id}`);
  };

  const todayAppointments = patientAppointments.filter(apt => 
    isToday(parseISO(apt.start))
  );
  
  const upcomingAppointments = patientAppointments.filter(apt => 
    isFuture(parseISO(apt.start)) && !isToday(parseISO(apt.start))
  );
  
  const pastAppointments = patientAppointments.filter(apt => 
    isPast(parseISO(apt.start)) && !isToday(parseISO(apt.start))
  );

  if (!currentPatient) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
        <Typography color="textSecondary">
          Select a patient to view appointments
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">
          Appointments for {currentPatient.name?.[0]?.given?.[0]} {currentPatient.name?.[0]?.family}
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleScheduleNew}
        >
          Schedule Appointment
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={clearError}>
          {error}
        </Alert>
      )}

      {loading && (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      )}

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1}>
                <EventIcon color="primary" />
                <Typography variant="h6">Today</Typography>
              </Box>
              <Typography variant="h4" color="primary">
                {todayAppointments.length}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {todayAppointments.length === 1 ? 'Appointment' : 'Appointments'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1}>
                <ScheduleIcon color="action" />
                <Typography variant="h6">Upcoming</Typography>
              </Box>
              <Typography variant="h4" color="text.primary">
                {upcomingAppointments.length}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Future appointments
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1}>
                <EventIcon color="disabled" />
                <Typography variant="h6">Past</Typography>
              </Box>
              <Typography variant="h4" color="text.primary">
                {pastAppointments.length}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Previous appointments
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Today's Appointments */}
      {todayAppointments.length > 0 && (
        <Paper sx={{ mb: 3 }}>
          <Box p={2}>
            <Typography variant="h6" gutterBottom>
              Today's Appointments
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Time</TableCell>
                    <TableCell>Practitioner</TableCell>
                    <TableCell>Location</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {todayAppointments.map((appointment) => (
                    <TableRow key={appointment.id}>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <TimeIcon fontSize="small" />
                          {format(parseISO(appointment.start), 'HH:mm')} - 
                          {format(parseISO(appointment.end), 'HH:mm')}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <PersonIcon fontSize="small" />
                          {getPractitionerName(appointment)}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <LocationIcon fontSize="small" />
                          {getLocationName(appointment)}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={appointment.status}
                          color={getStatusColor(appointment.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1}>
                          <Tooltip title="Edit appointment">
                            <IconButton
                              size="small"
                              onClick={() => handleEditAppointment(appointment)}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Cancel appointment">
                            <IconButton
                              size="small"
                              onClick={() => handleCancelAppointment(appointment)}
                              disabled={appointment.status === APPOINTMENT_STATUS.CANCELLED}
                            >
                              <CancelIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </Paper>
      )}

      {/* All Appointments */}
      <Paper>
        <Box p={2}>
          <Typography variant="h6" gutterBottom>
            All Appointments ({patientAppointments.length} total)
          </Typography>
          
          {patientAppointments.length === 0 ? (
            <Box textAlign="center" py={4}>
              <Typography color="textSecondary" gutterBottom>
                No appointments found for this patient
              </Typography>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={handleScheduleNew}
              >
                Schedule First Appointment
              </Button>
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Date & Time</TableCell>
                    <TableCell>Practitioner</TableCell>
                    <TableCell>Location</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Reason</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {patientAppointments
                    .sort((a, b) => new Date(b.start) - new Date(a.start))
                    .map((appointment) => (
                    <TableRow key={appointment.id}>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          {getAppointmentIcon(appointment.status, appointment.start)}
                          <Box>
                            <Typography variant="body2">
                              {format(parseISO(appointment.start), 'MMM dd, yyyy')}
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                              {format(parseISO(appointment.start), 'HH:mm')} - 
                              {format(parseISO(appointment.end), 'HH:mm')}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
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
                        {appointment.reasonCode?.[0]?.text || appointment.description || 'No reason specified'}
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1}>
                          <Tooltip title="Edit appointment">
                            <IconButton
                              size="small"
                              onClick={() => handleEditAppointment(appointment)}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Cancel appointment">
                            <IconButton
                              size="small"
                              onClick={() => handleCancelAppointment(appointment)}
                              disabled={appointment.status === APPOINTMENT_STATUS.CANCELLED}
                            >
                              <CancelIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      </Paper>
    </Box>
  );
}

export default AppointmentsTab;