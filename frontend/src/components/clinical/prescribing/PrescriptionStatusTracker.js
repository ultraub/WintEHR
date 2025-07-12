/**
 * Prescription Status Tracker Component
 * Displays and manages prescription status from order to fulfillment
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  StepConnector,
  Button,
  Chip,
  Stack,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  Paper,
  Divider,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemAvatar,
  useTheme,
  styled
} from '@mui/material';
import {
  Medication as MedicationIcon,
  Send as SendIcon,
  LocalPharmacy as PharmacyIcon,
  Schedule as ProcessingIcon,
  CheckCircle as ReadyIcon,
  Done as DispensedIcon,
  PauseCircle as OnHoldIcon,
  Cancel as CancelledIcon,
  Error as ErrorIcon,
  Update as UpdateIcon,
  History as HistoryIcon,
  Info as InfoIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { format, formatDistanceToNow } from 'date-fns';
import { prescriptionStatusService } from '../../../services/prescriptionStatusService';
import { useClinicalWorkflow, CLINICAL_EVENTS } from '../../../contexts/ClinicalWorkflowContext';

// Custom styled connector
const CustomConnector = styled(StepConnector)(({ theme }) => ({
  [`& .${StepConnector.line}`]: {
    borderColor: theme.palette.mode === 'dark' ? theme.palette.grey[800] : '#eaeaf0',
    borderLeftWidth: 3,
    minHeight: 40
  }
}));

// Status icon mapping
const getStatusIcon = (status) => {
  switch (status) {
    case 'ORDERED':
    case 'TRANSMITTED':
      return <SendIcon />;
    case 'RECEIVED':
      return <PharmacyIcon />;
    case 'IN_PROGRESS':
      return <ProcessingIcon />;
    case 'READY':
      return <ReadyIcon />;
    case 'DISPENSED':
      return <DispensedIcon />;
    case 'ON_HOLD':
      return <OnHoldIcon />;
    case 'CANCELLED':
      return <CancelledIcon />;
    case 'REJECTED':
    case 'RETURNED':
      return <ErrorIcon />;
    default:
      return <InfoIcon />;
  }
};

const PrescriptionStatusTracker = ({ 
  medicationRequestId, 
  compact = false,
  showHistory = true,
  onStatusChange,
  allowManualUpdate = false
}) => {
  const theme = useTheme();
  const { publish, subscribe } = useClinicalWorkflow();
  
  const [status, setStatus] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [updateNotes, setUpdateNotes] = useState('');
  const [selectedNewStatus, setSelectedNewStatus] = useState('');

  // Load prescription status
  const loadPrescriptionStatus = useCallback(async () => {
    if (!medicationRequestId) return;

    try {
      setLoading(true);
      setError(null);

      const [currentStatus, statusHistory] = await Promise.all([
        prescriptionStatusService.getPrescriptionStatus(medicationRequestId),
        showHistory ? prescriptionStatusService.getPrescriptionStatusHistory(medicationRequestId) : Promise.resolve([])
      ]);

      setStatus(currentStatus);
      setHistory(statusHistory);

    } catch (err) {
      console.error('Error loading prescription status:', err);
      setError('Failed to load prescription status');
    } finally {
      setLoading(false);
    }
  }, [medicationRequestId, showHistory]);

  // Subscribe to status updates
  useEffect(() => {
    if (!medicationRequestId) return;

    // Initial load
    loadPrescriptionStatus();

    // Subscribe to status updates
    const unsubscribe = prescriptionStatusService.subscribeToStatusUpdates(
      medicationRequestId,
      (newStatus) => {
        setStatus(newStatus);
        if (onStatusChange) {
          onStatusChange(newStatus);
        }
      }
    );

    // Subscribe to workflow events
    const unsubscribeWorkflow = subscribe(CLINICAL_EVENTS.MEDICATION_DISPENSED, (data) => {
      if (data.medicationRequestId === medicationRequestId) {
        loadPrescriptionStatus();
      }
    });

    return () => {
      unsubscribe();
      unsubscribeWorkflow();
    };
  }, [medicationRequestId, subscribe, loadPrescriptionStatus, onStatusChange]);

  // Handle status update
  const handleStatusUpdate = async () => {
    if (!selectedNewStatus || !medicationRequestId) return;

    try {
      setUpdating(true);
      setError(null);

      await prescriptionStatusService.updatePrescriptionStatus(
        medicationRequestId,
        selectedNewStatus,
        updateNotes
      );

      // Publish workflow event
      await publish(CLINICAL_EVENTS.WORKFLOW_NOTIFICATION, {
        type: 'prescription_status_updated',
        medicationRequestId,
        newStatus: selectedNewStatus,
        notes: updateNotes,
        timestamp: new Date().toISOString()
      });

      // Reload status
      await loadPrescriptionStatus();

      // Close dialog
      setShowUpdateDialog(false);
      setUpdateNotes('');
      setSelectedNewStatus('');

    } catch (err) {
      console.error('Error updating prescription status:', err);
      setError(err.message || 'Failed to update prescription status');
    } finally {
      setUpdating(false);
    }
  };

  // Get step index for current status
  const getStepIndex = (currentStatus) => {
    const workflow = ['ORDERED', 'TRANSMITTED', 'RECEIVED', 'IN_PROGRESS', 'READY', 'DISPENSED'];
    const index = workflow.indexOf(currentStatus);
    return index >= 0 ? index : 0;
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={3}>
        <CircularProgress />
      </Box>
    );
  }

  if (error && !status) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
        <Button size="small" onClick={loadPrescriptionStatus} sx={{ ml: 2 }}>
          Retry
        </Button>
      </Alert>
    );
  }

  if (!status) {
    return (
      <Alert severity="info" sx={{ m: 2 }}>
        No prescription status available
      </Alert>
    );
  }

  const activeStep = getStepIndex(status.status);
  const isCompleted = status.status === 'DISPENSED';
  const isCancelled = ['CANCELLED', 'REJECTED', 'RETURNED'].includes(status.status);

  if (compact) {
    // Compact view - just show current status
    return (
      <Stack direction="row" spacing={1} alignItems="center">
        <Chip
          icon={getStatusIcon(status.status)}
          label={status.display}
          color={status.color || 'default'}
          size="small"
        />
        {status.lastUpdated && (
          <Typography variant="caption" color="text.secondary">
            {formatDistanceToNow(new Date(status.lastUpdated), { addSuffix: true })}
          </Typography>
        )}
      </Stack>
    );
  }

  return (
    <Card>
      <CardHeader
        avatar={<MedicationIcon color="primary" />}
        title="Prescription Status"
        subheader={`Tracking ID: ${medicationRequestId}`}
        action={
          <Stack direction="row" spacing={1}>
            <IconButton size="small" onClick={loadPrescriptionStatus}>
              <RefreshIcon />
            </IconButton>
            {allowManualUpdate && !isCompleted && !isCancelled && (
              <Button
                size="small"
                startIcon={<UpdateIcon />}
                onClick={() => setShowUpdateDialog(true)}
              >
                Update Status
              </Button>
            )}
          </Stack>
        }
      />
      <CardContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        )}

        {/* Current Status Display */}
        <Paper elevation={0} sx={{ p: 2, mb: 3, bgcolor: 'background.default' }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item>
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  bgcolor: `${status.color}.main`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white'
                }}
              >
                {getStatusIcon(status.status)}
              </Box>
            </Grid>
            <Grid item xs>
              <Typography variant="h6">{status.display}</Typography>
              <Typography variant="body2" color="text.secondary">
                {status.description}
              </Typography>
              {status.lastUpdated && (
                <Typography variant="caption" color="text.secondary">
                  Last updated: {format(new Date(status.lastUpdated), 'MMM d, yyyy h:mm a')}
                </Typography>
              )}
            </Grid>
          </Grid>

          {status.dispenseInfo && (
            <Box mt={2}>
              <Divider sx={{ mb: 1 }} />
              <Typography variant="body2">
                Dispensed: {format(new Date(status.dispenseInfo.dispensedDate), 'MMM d, yyyy')}
              </Typography>
              {status.dispenseInfo.quantity && (
                <Typography variant="body2">
                  Quantity: {status.dispenseInfo.quantity.value} {status.dispenseInfo.quantity.unit}
                </Typography>
              )}
              {status.dispenseInfo.daysSupply && (
                <Typography variant="body2">
                  Days Supply: {status.dispenseInfo.daysSupply}
                </Typography>
              )}
            </Box>
          )}
        </Paper>

        {/* Status Workflow */}
        {!isCancelled && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Prescription Workflow
            </Typography>
            <Stepper 
              activeStep={activeStep} 
              orientation="vertical"
              connector={<CustomConnector />}
            >
              <Step>
                <StepLabel>Ordered</StepLabel>
                <StepContent>
                  <Typography variant="body2" color="text.secondary">
                    Prescription sent to pharmacy
                  </Typography>
                </StepContent>
              </Step>
              <Step>
                <StepLabel>Transmitted</StepLabel>
                <StepContent>
                  <Typography variant="body2" color="text.secondary">
                    Electronic transmission successful
                  </Typography>
                </StepContent>
              </Step>
              <Step>
                <StepLabel>Received</StepLabel>
                <StepContent>
                  <Typography variant="body2" color="text.secondary">
                    Pharmacy acknowledged receipt
                  </Typography>
                </StepContent>
              </Step>
              <Step>
                <StepLabel>Being Prepared</StepLabel>
                <StepContent>
                  <Typography variant="body2" color="text.secondary">
                    Pharmacy is preparing medication
                  </Typography>
                </StepContent>
              </Step>
              <Step>
                <StepLabel>Ready for Pickup</StepLabel>
                <StepContent>
                  <Typography variant="body2" color="text.secondary">
                    Medication ready for patient
                  </Typography>
                </StepContent>
              </Step>
              <Step>
                <StepLabel>Dispensed</StepLabel>
                <StepContent>
                  <Typography variant="body2" color="text.secondary">
                    Medication picked up by patient
                  </Typography>
                </StepContent>
              </Step>
            </Stepper>
          </Box>
        )}

        {/* Status History */}
        {showHistory && history.length > 0 && (
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              <HistoryIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'text-bottom' }} />
              Status History
            </Typography>
            <List dense>
              {history.map((item, index) => (
                <ListItem key={index} sx={{ alignItems: 'flex-start' }}>
                  <ListItemAvatar>
                    <Box
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        bgcolor: `${item.color || 'grey'}.main`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: 16
                      }}
                    >
                      {getStatusIcon(item.status)}
                    </Box>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2">{item.display}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {format(new Date(item.timestamp), 'MMM d, h:mm a')}
                        </Typography>
                      </Stack>
                    }
                    secondary={
                      item.notes && (
                        <Typography variant="caption" color="text.secondary">
                          {item.notes}
                        </Typography>
                      )
                    }
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        )}
      </CardContent>

      {/* Update Status Dialog */}
      <Dialog 
        open={showUpdateDialog} 
        onClose={() => setShowUpdateDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Update Prescription Status</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="info">
              Current Status: {status.display}
            </Alert>
            
            <TextField
              select
              fullWidth
              label="New Status"
              value={selectedNewStatus}
              onChange={(e) => setSelectedNewStatus(e.target.value)}
              SelectProps={{ native: true }}
            >
              <option value="">Select new status...</option>
              {status.nextSteps?.map(step => (
                <option key={step} value={step}>
                  {prescriptionStatusService.PRESCRIPTION_STATUSES[step]?.display || step}
                </option>
              ))}
            </TextField>

            <TextField
              fullWidth
              multiline
              rows={3}
              label="Notes (optional)"
              value={updateNotes}
              onChange={(e) => setUpdateNotes(e.target.value)}
              placeholder="Add any relevant notes about this status change..."
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowUpdateDialog(false)} disabled={updating}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleStatusUpdate}
            disabled={!selectedNewStatus || updating}
            startIcon={updating ? <CircularProgress size={16} /> : <UpdateIcon />}
          >
            Update Status
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
};

export default PrescriptionStatusTracker;