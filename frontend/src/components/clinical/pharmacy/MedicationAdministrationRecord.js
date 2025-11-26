/**
 * Medication Administration Record (MAR) Component
 * Complete MAR interface for medication administration tracking
 * Part of Phase 2 Implementation: MedicationAdministration Integration
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Chip,
  Stack,
  Alert,
  AlertTitle,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Card,
  CardContent,
  CardHeader,
  Badge,
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  Medication as MedicationIcon,
  CheckCircle as AdministerIcon,
  Cancel as MissedIcon,
  Schedule as PendingIcon,
  Warning as AlertIcon,
  AccessTime as TimeIcon,
  Assessment as MetricsIcon,
  ExpandMore as ExpandMoreIcon,
  Print as PrintIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { format, isToday, isAfter } from 'date-fns';
import { useMedicationAdministrationRecord, useMedicationAdministrationMetrics } from '../../../hooks/useMedicationAdministration';
import { getMedicationName } from '../../../core/fhir/utils/medicationDisplayUtils';

const ADMINISTRATION_STATUSES = {
  completed: { 
    label: 'Administered', 
    color: 'success', 
    icon: <AdministerIcon />,
    bgColor: '#e8f5e8'
  },
  'not-done': { 
    label: 'Missed', 
    color: 'error', 
    icon: <MissedIcon />,
    bgColor: '#ffeaea'
  },
  pending: { 
    label: 'Pending', 
    color: 'warning', 
    icon: <PendingIcon />,
    bgColor: '#fff3e0'
  },
  overdue: { 
    label: 'Overdue', 
    color: 'error', 
    icon: <AlertIcon />,
    bgColor: '#ffebee'
  }
};

const MISSED_DOSE_REASONS = [
  { code: 'patient-refusal', display: 'Patient Refusal' },
  { code: 'patient-unavailable', display: 'Patient Unavailable' },
  { code: 'medication-unavailable', display: 'Medication Unavailable' },
  { code: 'medical-precaution', display: 'Medical Precaution' },
  { code: 'contraindication', display: 'Contraindication' },
  { code: 'other', display: 'Other' }
];

const MedicationAdministrationRecord = ({ 
  patientId, 
  encounterId = null, 
  date = new Date(),
  onAdministrationComplete = () => {},
  currentUser = null 
}) => {
  const [selectedDate, setSelectedDate] = useState(date);
  const [administrationDialogOpen, setAdministrationDialogOpen] = useState(false);
  const [missedDoseDialogOpen, setMissedDoseDialogOpen] = useState(false);
  const [selectedMedication, setSelectedMedication] = useState(null);
  const [selectedScheduledTime, setSelectedScheduledTime] = useState(null);
  const [expandedSections, setExpandedSections] = useState({
    mar: true,
    metrics: false,
    history: false
  });

  const { 
    marData, 
    loading: marLoading, 
    error: marError, 
    refreshMAR,
    recordMARAdministration,
    recordMARMissedDose 
  } = useMedicationAdministrationRecord(patientId, encounterId, selectedDate);

  const { 
    metrics, 
    loading: metricsLoading, 
    refreshMetrics 
  } = useMedicationAdministrationMetrics(patientId, 7);

  const [administrationData, setAdministrationData] = useState({
    effectiveDateTime: '',
    notes: '',
    performer: currentUser ? [{
      actor: {
        reference: `Practitioner/${currentUser.id}`,
        display: currentUser.name || 'Current User'
      }
    }] : []
  });

  const [missedDoseData, setMissedDoseData] = useState({
    reason: '',
    notes: ''
  });

  useEffect(() => {
    setSelectedDate(date);
  }, [date]);

  const handleDateChange = (newDate) => {
    setSelectedDate(newDate);
  };

  const getDoseStatus = (medication, scheduledDose) => {
    const scheduledTime = new Date(scheduledDose.time);
    const now = new Date();
    
    // Check if there's an administration record for this dose
    const administration = medication.administrations.find(admin => {
      const adminTime = new Date(admin.effectiveDateTime);
      const timeDiff = Math.abs(adminTime.getTime() - scheduledTime.getTime());
      return timeDiff < 60 * 60 * 1000; // Within 1 hour
    });

    if (administration) {
      return administration.status === 'completed' ? 'completed' : 'not-done';
    }

    // Check if dose is overdue (more than 1 hour past scheduled time)
    if (isToday(selectedDate) && isAfter(now, new Date(scheduledTime.getTime() + 60 * 60 * 1000))) {
      return 'overdue';
    }

    return 'pending';
  };

  const handleAdministerMedication = (medication, scheduledDose) => {
    setSelectedMedication(medication);
    setSelectedScheduledTime(scheduledDose);
    setAdministrationData({
      effectiveDateTime: new Date().toISOString().slice(0, 16), // Current time for datetime-local input
      notes: '',
      performer: currentUser ? [{
        actor: {
          reference: `Practitioner/${currentUser.id}`,
          display: currentUser.name || 'Current User'
        }
      }] : []
    });
    setAdministrationDialogOpen(true);
  };

  const handleMissedDose = (medication, scheduledDose) => {
    setSelectedMedication(medication);
    setSelectedScheduledTime(scheduledDose);
    setMissedDoseData({
      reason: '',
      notes: ''
    });
    setMissedDoseDialogOpen(true);
  };

  const confirmAdministration = async () => {
    try {
      const dosageInstruction = selectedScheduledTime.instruction;
      
      const administrationRecord = {
        medicationCodeableConcept: selectedMedication.medicationRequest.medicationCodeableConcept,
        effectiveDateTime: administrationData.effectiveDateTime,
        performer: administrationData.performer,
        dosage: {
          text: dosageInstruction?.text,
          timing: dosageInstruction?.timing,
          route: dosageInstruction?.route,
          dose: dosageInstruction?.doseAndRate?.[0]?.doseQuantity
        },
        note: administrationData.notes ? [{
          text: administrationData.notes,
          time: new Date().toISOString()
        }] : []
      };

      await recordMARAdministration(
        selectedMedication.medicationRequest.id,
        selectedScheduledTime.time,
        administrationRecord
      );

      setAdministrationDialogOpen(false);
      onAdministrationComplete('administered', selectedMedication.medicationRequest.id);
    } catch (error) {
      // Error recording administration - user will need to retry
    }
  };

  const confirmMissedDose = async () => {
    try {
      await recordMARMissedDose(
        selectedMedication.medicationRequest.id,
        selectedScheduledTime.time,
        missedDoseData.reason
      );

      setMissedDoseDialogOpen(false);
      onAdministrationComplete('missed', selectedMedication.medicationRequest.id);
    } catch (error) {
      // Error recording missed dose - user will need to retry
    }
  };

  const getMedicationSummaryColor = (medication) => {
    const { administered, missed, pending } = medication.summary;
    if (missed > 0) return 'error';
    if (pending > 0) return 'warning';
    return 'success';
  };

  const calculateAdherenceRate = () => {
    if (!marData || marData.summary.totalScheduled === 0) return 0;
    return Math.round((marData.summary.administered / marData.summary.totalScheduled) * 100);
  };

  if (marError) {
    return (
      <Alert severity="error">
        <AlertTitle>Error Loading MAR</AlertTitle>
        {marError}
      </Alert>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Card sx={{ mb: 2 }}>
        <CardHeader
          avatar={<MedicationIcon color="primary" />}
          title="Medication Administration Record (MAR)"
          subheader={`${format(selectedDate, 'MMMM d, yyyy')} • Patient ID: ${patientId}`}
          action={
            <Stack direction="row" spacing={1}>
              <TextField
                type="date"
                value={selectedDate.toISOString().split('T')[0]}
                onChange={(e) => handleDateChange(new Date(e.target.value))}
                size="small"
                InputLabelProps={{ shrink: true }}
                label="MAR Date"
              />
              <Button
                startIcon={<RefreshIcon />}
                onClick={refreshMAR}
                disabled={marLoading}
                size="small"
              >
                Refresh
              </Button>
              <Button
                startIcon={<PrintIcon />}
                variant="outlined"
                size="small"
              >
                Print MAR
              </Button>
            </Stack>
          }
        />
        
        {marData && (
          <CardContent>
            <Grid container spacing={2}>
              <Grid item xs={3}>
                <Box textAlign="center">
                  <Typography variant="h4" color="primary">
                    {marData.summary.totalScheduled}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Total Scheduled
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={3}>
                <Box textAlign="center">
                  <Typography variant="h4" color="success.main">
                    {marData.summary.administered}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Administered
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={3}>
                <Box textAlign="center">
                  <Typography variant="h4" color="error.main">
                    {marData.summary.missed}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Missed
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={3}>
                <Box textAlign="center">
                  <Typography variant="h4" color="warning.main">
                    {marData.summary.pending}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Pending
                  </Typography>
                </Box>
              </Grid>
            </Grid>
            
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" gutterBottom>
                Adherence Rate: {calculateAdherenceRate()}%
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={calculateAdherenceRate()} 
                color={calculateAdherenceRate() >= 80 ? "success" : calculateAdherenceRate() >= 60 ? "warning" : "error"}
                sx={{ height: 8, borderRadius: 4 }}
              />
            </Box>
          </CardContent>
        )}
      </Card>

      {/* MAR Table */}
      <Accordion 
        expanded={expandedSections.mar} 
        onChange={() => setExpandedSections(prev => ({ ...prev, mar: !prev.mar }))}
        sx={{ mb: 2 }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">
            Administration Schedule
            {marData && (
              <Badge 
                badgeContent={marData.summary.pending} 
                color="warning" 
                sx={{ ml: 1 }}
              />
            )}
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          {marLoading ? (
            <LinearProgress />
          ) : marData?.medications?.length === 0 ? (
            <Alert severity="info">
              <AlertTitle>No Medications Scheduled</AlertTitle>
              No medications are scheduled for administration on {format(selectedDate, 'MMMM d, yyyy')}.
            </Alert>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Medication</TableCell>
                    <TableCell>Scheduled Times</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {marData?.medications?.map((medication, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Box>
                          <Typography variant="subtitle2" fontWeight="bold">
                            {getMedicationName(medication.medicationRequest)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {medication.medicationRequest.dosageInstruction?.[0]?.text || 'No dosage instructions'}
                          </Typography>
                          <Box sx={{ mt: 1 }}>
                            <Chip 
                              size="small" 
                              label={`${medication.summary.scheduled} scheduled`}
                              color={getMedicationSummaryColor(medication)}
                              variant="outlined"
                            />
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Stack spacing={1}>
                          {medication.scheduledDoses.map((dose, doseIndex) => (
                            <Box 
                              key={doseIndex} 
                              sx={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: 1,
                                p: 1,
                                borderRadius: 1,
                                backgroundColor: ADMINISTRATION_STATUSES[getDoseStatus(medication, dose)]?.bgColor
                              }}
                            >
                              <TimeIcon sx={{ fontSize: 16 }} />
                              <Typography variant="body2">
                                {format(new Date(dose.time), 'h:mm a')}
                              </Typography>
                              <Chip
                                size="small"
                                icon={ADMINISTRATION_STATUSES[getDoseStatus(medication, dose)]?.icon}
                                label={ADMINISTRATION_STATUSES[getDoseStatus(medication, dose)]?.label}
                                color={ADMINISTRATION_STATUSES[getDoseStatus(medication, dose)]?.color}
                              />
                            </Box>
                          ))}
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Stack spacing={1}>
                          <Typography variant="body2">
                            ✓ {medication.summary.administered} administered
                          </Typography>
                          <Typography variant="body2" color="error">
                            ✗ {medication.summary.missed} missed
                          </Typography>
                          <Typography variant="body2" color="warning.main">
                            ⏳ {medication.summary.pending} pending
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Stack spacing={1}>
                          {medication.scheduledDoses.map((dose, doseIndex) => {
                            const status = getDoseStatus(medication, dose);
                            if (status === 'pending' || status === 'overdue') {
                              return (
                                <Stack key={doseIndex} direction="row" spacing={1}>
                                  <Button
                                    size="small"
                                    variant="contained"
                                    color="success"
                                    startIcon={<AdministerIcon />}
                                    onClick={() => handleAdministerMedication(medication, dose)}
                                  >
                                    Administer
                                  </Button>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    color="error"
                                    startIcon={<MissedIcon />}
                                    onClick={() => handleMissedDose(medication, dose)}
                                  >
                                    Mark Missed
                                  </Button>
                                </Stack>
                              );
                            }
                            return null;
                          })}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </AccordionDetails>
      </Accordion>

      {/* Metrics Section */}
      <Accordion 
        expanded={expandedSections.metrics} 
        onChange={() => setExpandedSections(prev => ({ ...prev, metrics: !prev.metrics }))}
        sx={{ mb: 2 }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">
            <MetricsIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
            Administration Metrics (7 days)
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          {metricsLoading ? (
            <LinearProgress />
          ) : metrics ? (
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h4" color="primary">
                      {metrics.adherenceRate.toFixed(1)}%
                    </Typography>
                    <Typography variant="subtitle2">
                      Overall Adherence Rate
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {metrics.completedAdministrations} of {metrics.totalAdministrations} doses
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={4}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h4" color="success.main">
                      {metrics.completedAdministrations}
                    </Typography>
                    <Typography variant="subtitle2">
                      Completed Administrations
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Successfully administered doses
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={4}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h4" color="error.main">
                      {metrics.missedAdministrations}
                    </Typography>
                    <Typography variant="subtitle2">
                      Missed Doses
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Doses not administered
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          ) : (
            <Alert severity="info">No metrics available</Alert>
          )}
        </AccordionDetails>
      </Accordion>

      {/* Administration Dialog */}
      <Dialog open={administrationDialogOpen} onClose={() => setAdministrationDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <AdministerIcon color="success" />
            Record Medication Administration
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedMedication && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                {getMedicationName(selectedMedication.medicationRequest)}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Scheduled: {selectedScheduledTime && format(new Date(selectedScheduledTime.time), 'h:mm a')}
              </Typography>
              
              <TextField
                fullWidth
                label="Administration Time"
                type="datetime-local"
                value={administrationData.effectiveDateTime}
                onChange={(e) => setAdministrationData(prev => ({ ...prev, effectiveDateTime: e.target.value }))}
                sx={{ mt: 2 }}
                InputLabelProps={{ shrink: true }}
              />
              
              <TextField
                fullWidth
                label="Notes"
                multiline
                rows={3}
                value={administrationData.notes}
                onChange={(e) => setAdministrationData(prev => ({ ...prev, notes: e.target.value }))}
                sx={{ mt: 2 }}
                placeholder="Patient response, any observations, etc."
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAdministrationDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={confirmAdministration} 
            variant="contained" 
            color="success"
            startIcon={<AdministerIcon />}
          >
            Record Administration
          </Button>
        </DialogActions>
      </Dialog>

      {/* Missed Dose Dialog */}
      <Dialog open={missedDoseDialogOpen} onClose={() => setMissedDoseDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <MissedIcon color="error" />
            Record Missed Dose
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedMedication && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                {getMedicationName(selectedMedication.medicationRequest)}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Scheduled: {selectedScheduledTime && format(new Date(selectedScheduledTime.time), 'h:mm a')}
              </Typography>
              
              <FormControl fullWidth sx={{ mt: 2 }}>
                <InputLabel>Reason for Missed Dose</InputLabel>
                <Select
                  value={missedDoseData.reason}
                  onChange={(e) => setMissedDoseData(prev => ({ ...prev, reason: e.target.value }))}
                  label="Reason for Missed Dose"
                >
                  {MISSED_DOSE_REASONS.map(reason => (
                    <MenuItem key={reason.code} value={reason.code}>
                      {reason.display}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              <TextField
                fullWidth
                label="Additional Notes"
                multiline
                rows={3}
                value={missedDoseData.notes}
                onChange={(e) => setMissedDoseData(prev => ({ ...prev, notes: e.target.value }))}
                sx={{ mt: 2 }}
                placeholder="Additional details about the missed dose..."
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMissedDoseDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={confirmMissedDose} 
            variant="contained" 
            color="error"
            startIcon={<MissedIcon />}
            disabled={!missedDoseData.reason}
          >
            Record Missed Dose
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MedicationAdministrationRecord;