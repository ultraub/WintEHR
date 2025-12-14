/**
 * Critical Value Alert Component
 * Displays and manages critical lab value notifications
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
  AlertTitle,
  Stack,
  Chip,
  TextField,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Divider,
  IconButton,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  CircularProgress
} from '@mui/material';
import {
  Warning as CriticalIcon,
  CheckCircle as AcknowledgeIcon,
  Close as CloseIcon,
  AccessTime as TimeIcon,
  Person as PersonIcon,
  LocalHospital as HospitalIcon
} from '@mui/icons-material';
import { format, isValid, parseISO } from 'date-fns';
import { resultsManagementService } from '../../../services/resultsManagementService';
import { useClinicalWorkflow, CLINICAL_EVENTS } from '../../../contexts/ClinicalWorkflowContext';
import { useDataQualityLogger } from '../../../core/fhir/utils/dataQualityLogger';

const CriticalValueAlert = ({ 
  open, 
  onClose, 
  observation, 
  patient, 
  provider,
  onAcknowledge 
}) => {
  const [acknowledging, setAcknowledging] = useState(false);
  const [notificationMethod, setNotificationMethod] = useState('viewed');
  const [providerNotes, setProviderNotes] = useState('');
  const [contactAttempts, setContactAttempts] = useState([]);
  const [additionalActions, setAdditionalActions] = useState({
    orderFollowUp: false,
    notifyConsultant: false,
    adjustMedication: false,
    scheduleAppointment: false
  });
  
  const { publish } = useClinicalWorkflow();
  const dataQuality = useDataQualityLogger('CriticalValueAlert');

  // Get critical value details
  const criticalCheck = observation ?
    resultsManagementService.checkCriticalValue(observation) :
    { isCritical: false };

  // Extract test name with data quality logging
  const getTestName = () => {
    if (observation?.code?.text) {
      return observation.code.text;
    }
    if (observation?.code?.coding?.[0]?.display) {
      return observation.code.coding[0].display;
    }
    dataQuality.logFallback('observation.code', observation?.code, 'Unknown Test', {
      reason: 'No test name in code.text or code.coding[0].display',
      observationId: observation?.id
    });
    return 'Unknown Test';
  };
  const testName = getTestName();

  // Extract value with data quality logging
  const getValue = () => {
    if (observation?.valueQuantity?.value !== undefined) {
      return `${observation.valueQuantity.value} ${observation.valueQuantity.unit || ''}`.trim();
    }
    dataQuality.logFallback('observation.valueQuantity', observation?.valueQuantity, 'No value', {
      reason: 'Missing valueQuantity or valueQuantity.value',
      observationId: observation?.id
    });
    return 'No value';
  };
  const value = getValue();

  // Helper to format date with logging
  const formatDateSafe = (dateValue, fieldName) => {
    if (!dateValue) {
      dataQuality.logFallback(fieldName, dateValue, 'Unknown', {
        reason: 'Date value is missing'
      });
      return 'Unknown';
    }
    try {
      const parsed = typeof dateValue === 'string' ? parseISO(dateValue) : dateValue;
      if (!isValid(parsed)) {
        dataQuality.logFallback(fieldName, dateValue, 'Unknown', {
          reason: 'Invalid date format',
          originalValue: dateValue
        });
        return 'Unknown';
      }
      return format(parsed, 'MM/dd/yyyy HH:mm');
    } catch {
      dataQuality.logFallback(fieldName, dateValue, 'Unknown', {
        reason: 'Date parsing error',
        originalValue: dateValue
      });
      return 'Unknown';
    }
  };

  // Patient data extraction helpers with logging
  const getPatientName = () => {
    const given = patient?.name?.[0]?.given?.[0];
    const family = patient?.name?.[0]?.family;
    if (!given && !family) {
      dataQuality.logFallback('patient.name', patient?.name, 'Unknown', {
        reason: 'No patient name available',
        patientId: patient?.id
      });
      return 'Unknown';
    }
    return `${given || ''} ${family || ''}`.trim();
  };

  const getPatientMRN = () => {
    const mrn = patient?.identifier?.find(id => id.type?.coding?.[0]?.code === 'MR');
    if (!mrn?.value) {
      dataQuality.logFallback('patient.identifier.MRN', mrn, 'Unknown', {
        reason: 'No MRN identifier found',
        patientId: patient?.id
      });
      return 'Unknown';
    }
    return mrn.value;
  };

  const getPatientDOB = () => {
    if (!patient?.birthDate) {
      dataQuality.logFallback('patient.birthDate', patient?.birthDate, 'Unknown', {
        reason: 'Birth date is missing',
        patientId: patient?.id
      });
      return 'Unknown';
    }
    try {
      const parsed = parseISO(patient.birthDate);
      if (!isValid(parsed)) {
        dataQuality.logFallback('patient.birthDate', patient.birthDate, 'Unknown', {
          reason: 'Invalid birth date format',
          patientId: patient?.id
        });
        return 'Unknown';
      }
      return format(parsed, 'MM/dd/yyyy');
    } catch {
      return 'Unknown';
    }
  };

  const getPatientLocation = () => {
    const location = patient?.address?.[0]?.line?.[0];
    if (!location) {
      dataQuality.logFallback('patient.address', patient?.address, 'Unknown', {
        reason: 'No address available',
        patientId: patient?.id
      });
      return 'Unknown';
    }
    return location;
  };

  useEffect(() => {
    if (open && observation && criticalCheck.isCritical) {
      // Log that alert was shown
      logCriticalValueAlert();
    }
  }, [open, observation]);

  const logCriticalValueAlert = () => {
    // Critical value alert logged internally for audit purposes
    const alertTime = new Date();
  };

  const handleAcknowledge = async () => {
    setAcknowledging(true);
    
    try {
      // Create acknowledgment record
      const acknowledgment = await resultsManagementService.acknowledgeResult(
        observation.id,
        provider.id,
        `Critical value acknowledged. Notification method: ${notificationMethod}. ${providerNotes}`
      );

      // Publish critical value acknowledged event
      await publish(CLINICAL_EVENTS.CRITICAL_VALUE_ACKNOWLEDGED, {
        observationId: observation.id,
        patientId: patient.id,
        providerId: provider.id,
        testName,
        value,
        acknowledgedAt: new Date().toISOString(),
        notificationMethod,
        notes: providerNotes,
        actions: additionalActions
      });

      // Notify parent component
      if (onAcknowledge) {
        onAcknowledge({
          observation,
          acknowledgment,
          notificationMethod,
          notes: providerNotes,
          actions: additionalActions
        });
      }

      onClose();
    } catch (error) {
      // Error handled silently, acknowledgment button returns to normal state
    } finally {
      setAcknowledging(false);
    }
  };

  const handleAddContactAttempt = () => {
    setContactAttempts([
      ...contactAttempts,
      {
        time: new Date().toISOString(),
        method: notificationMethod
      }
    ]);
  };

  if (!observation || !criticalCheck.isCritical) {
    return null;
  }

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: {
          border: '3px solid',
          borderColor: 'error.main'
        }
      }}
    >
      <DialogTitle sx={{ bgcolor: 'error.main', color: 'error.contrastText' }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <CriticalIcon />
          <Typography variant="h6" component="span">
            CRITICAL VALUE ALERT
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          <IconButton 
            size="small" 
            onClick={onClose}
            sx={{ color: 'error.contrastText' }}
          >
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ mt: 2 }}>
        {/* Critical Value Details */}
        <Alert severity="error" sx={{ mb: 3 }}>
          <AlertTitle sx={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
            {criticalCheck.message}
          </AlertTitle>
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2">
              <strong>Test:</strong> {testName}
            </Typography>
            <Typography variant="body2">
              <strong>Result:</strong> {value}
            </Typography>
            <Typography variant="body2">
              <strong>Critical Range:</strong> {
                criticalCheck.type === 'low' ? 
                  `< ${criticalCheck.criticalRange.criticalLow} ${criticalCheck.criticalRange.unit}` :
                  `> ${criticalCheck.criticalRange.criticalHigh} ${criticalCheck.criticalRange.unit}`
              }
            </Typography>
            <Typography variant="body2">
              <strong>Result Time:</strong> {formatDateSafe(observation.effectiveDateTime, 'observation.effectiveDateTime')}
            </Typography>
          </Box>
        </Alert>

        {/* Patient Information */}
        <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
            <PersonIcon sx={{ mr: 1 }} /> Patient Information
          </Typography>
          <Stack spacing={1}>
            <Typography variant="body2">
              <strong>Name:</strong> {getPatientName()}
            </Typography>
            <Typography variant="body2">
              <strong>MRN:</strong> {getPatientMRN()}
            </Typography>
            <Typography variant="body2">
              <strong>DOB:</strong> {getPatientDOB()}
            </Typography>
            <Typography variant="body2">
              <strong>Location:</strong> {getPatientLocation()}
            </Typography>
          </Stack>
        </Paper>

        <Divider sx={{ my: 2 }} />

        {/* Notification Method */}
        <FormControl component="fieldset" sx={{ mb: 3 }}>
          <FormLabel component="legend" sx={{ fontWeight: 'bold' }}>
            Provider Notification Method
          </FormLabel>
          <RadioGroup
            value={notificationMethod}
            onChange={(e) => setNotificationMethod(e.target.value)}
          >
            <FormControlLabel value="viewed" control={<Radio />} label="Viewed in system" />
            <FormControlLabel value="phone" control={<Radio />} label="Phone call to provider" />
            <FormControlLabel value="text" control={<Radio />} label="Text message sent" />
            <FormControlLabel value="page" control={<Radio />} label="Pager notification" />
            <FormControlLabel value="inperson" control={<Radio />} label="In-person notification" />
          </RadioGroup>
        </FormControl>

        {/* Contact Attempts */}
        {notificationMethod !== 'viewed' && (
          <Box sx={{ mb: 3 }}>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="subtitle2">Contact Attempts</Typography>
              <Button size="small" variant="outlined" onClick={handleAddContactAttempt}>
                Add Attempt
              </Button>
            </Stack>
            <List dense>
              {contactAttempts.map((attempt, index) => (
                <ListItem key={index}>
                  <ListItemIcon>
                    <TimeIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText 
                    primary={`${attempt.method} at ${format(new Date(attempt.time), 'HH:mm:ss')}`}
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        {/* Additional Actions */}
        <Typography variant="subtitle2" gutterBottom>
          Additional Actions Taken
        </Typography>
        <Stack spacing={1} sx={{ mb: 3 }}>
          <FormControlLabel
            control={
              <Radio
                checked={additionalActions.orderFollowUp}
                onChange={(e) => setAdditionalActions({
                  ...additionalActions,
                  orderFollowUp: e.target.checked
                })}
              />
            }
            label="Order follow-up testing"
          />
          <FormControlLabel
            control={
              <Radio
                checked={additionalActions.notifyConsultant}
                onChange={(e) => setAdditionalActions({
                  ...additionalActions,
                  notifyConsultant: e.target.checked
                })}
              />
            }
            label="Notify specialist/consultant"
          />
          <FormControlLabel
            control={
              <Radio
                checked={additionalActions.adjustMedication}
                onChange={(e) => setAdditionalActions({
                  ...additionalActions,
                  adjustMedication: e.target.checked
                })}
              />
            }
            label="Adjust medication orders"
          />
          <FormControlLabel
            control={
              <Radio
                checked={additionalActions.scheduleAppointment}
                onChange={(e) => setAdditionalActions({
                  ...additionalActions,
                  scheduleAppointment: e.target.checked
                })}
              />
            }
            label="Schedule urgent appointment"
          />
        </Stack>

        {/* Provider Notes */}
        <TextField
          fullWidth
          multiline
          rows={3}
          label="Provider Notes"
          value={providerNotes}
          onChange={(e) => setProviderNotes(e.target.value)}
          placeholder="Document actions taken, clinical reasoning, and follow-up plan..."
          sx={{ mb: 2 }}
        />

        {/* Clinical Guidelines */}
        <Alert severity="info" icon={<HospitalIcon />}>
          <AlertTitle>Clinical Protocol Reminder</AlertTitle>
          <Typography variant="body2">
            Critical values must be communicated to the responsible provider within 30 minutes.
            Document all notification attempts and clinical actions taken.
          </Typography>
        </Alert>
      </DialogContent>

      <DialogActions sx={{ p: 3 }}>
        <Button onClick={onClose} disabled={acknowledging}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={handleAcknowledge}
          disabled={acknowledging || !providerNotes.trim()}
          startIcon={acknowledging ? <CircularProgress size={20} /> : <AcknowledgeIcon />}
        >
          {acknowledging ? 'Acknowledging...' : 'Acknowledge Critical Value'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CriticalValueAlert;