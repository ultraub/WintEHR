/**
 * Refill Management Component
 * Comprehensive medication refill request and tracking interface
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Grid,
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  FormControlLabel,
  Checkbox,
  Select,
  MenuItem,
  InputLabel,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  CardHeader,
  Tabs,
  Tab,
  Badge,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Avatar,
  useTheme
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  RequestPage as RefillIcon,
  Schedule as PendingIcon,
  CheckCircle as ApprovedIcon,
  Cancel as RejectedIcon,
  LocalPharmacy as DispensedIcon,
  TrendingUp as AdherenceIcon,
  History as HistoryIcon,
  ExpandMore as ExpandMoreIcon,
  Medication as MedicationIcon,
  NotificationImportant as AlertIcon
} from '@mui/icons-material';
import { format, parseISO, differenceInDays, isAfter, addDays } from 'date-fns';
import { useFHIRResource } from '../../../contexts/FHIRResourceContext';
import { useClinicalWorkflow, CLINICAL_EVENTS } from '../../../contexts/ClinicalWorkflowContext';
import { prescriptionRefillService } from '../../../services/prescriptionRefillService';
import { useMedicationResolver } from '../../../hooks/useMedicationResolver';

// Refill Status Mapping
const REFILL_STATUS_CONFIG = {
  'requested': { label: 'Requested', color: 'info', icon: <RefillIcon /> },
  'pending-approval': { label: 'Pending Approval', color: 'warning', icon: <PendingIcon /> },
  'approved': { label: 'Approved', color: 'success', icon: <ApprovedIcon /> },
  'rejected': { label: 'Rejected', color: 'error', icon: <RejectedIcon /> },
  'dispensed': { label: 'Dispensed', color: 'success', icon: <DispensedIcon /> },
  'cancelled': { label: 'Cancelled', color: 'default', icon: <RejectedIcon /> }
};

// Adherence Rating Colors
const ADHERENCE_COLORS = {
  excellent: 'success',
  good: 'info', 
  fair: 'warning',
  poor: 'error',
  'insufficient-data': 'default'
};

// Refill Request Dialog
const RefillRequestDialog = ({ open, onClose, medicationRequest, onSubmit }) => {
  const [urgent, setUrgent] = useState(false);
  const [patientNotes, setPatientNotes] = useState('');
  const [requestMethod, setRequestMethod] = useState('portal');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await onSubmit({
        urgent,
        patientNotes,
        requestMethod,
        requestedBy: 'patient' // In real app, this would come from auth context
      });
      onClose();
    } catch (error) {
      // Failed to submit refill request
    } finally {
      setLoading(false);
    }
  };

  const { getMedicationDisplay } = useMedicationResolver(medicationRequest ? [medicationRequest] : []);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Request Medication Refill
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          {medicationRequest && (
            <Card sx={{ mb: 3, bgcolor: 'grey.50' }}>
              <CardContent>
                <Typography variant="h6">
                  {getMedicationDisplay(medicationRequest)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {medicationRequest.dosageInstruction?.[0]?.text || 'See instructions'}
                </Typography>
              </CardContent>
            </Card>
          )}

          <Stack spacing={3}>
            <FormControl fullWidth>
              <InputLabel>Request Method</InputLabel>
              <Select
                value={requestMethod}
                onChange={(e) => setRequestMethod(e.target.value)}
                label="Request Method"
              >
                <MenuItem value="portal">Patient Portal</MenuItem>
                <MenuItem value="phone">Phone Call</MenuItem>
                <MenuItem value="email">Email</MenuItem>
                <MenuItem value="in-person">In Person</MenuItem>
              </Select>
            </FormControl>

            <FormControlLabel
              control={
                <Checkbox
                  checked={urgent}
                  onChange={(e) => setUrgent(e.target.checked)}
                />
              }
              label="Urgent Refill Request"
            />

            <TextField
              label="Patient Notes"
              value={patientNotes}
              onChange={(e) => setPatientNotes(e.target.value)}
              multiline
              rows={3}
              fullWidth
              placeholder="Any additional information or concerns..."
            />
          </Stack>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained"
          disabled={loading}
        >
          {loading ? 'Submitting...' : 'Submit Refill Request'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Refill History Component
const RefillHistory = ({ medicationRequestId }) => {
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [adherence, setAdherence] = useState(null);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!medicationRequestId) return;
      
      setLoading(true);
      try {
        const [historyData, adherenceData] = await Promise.all([
          prescriptionRefillService.getRefillHistory(medicationRequestId),
          prescriptionRefillService.calculateMedicationAdherence(medicationRequestId)
        ]);
        setHistory(historyData);
        setAdherence(adherenceData);
      } catch (error) {
        // Failed to fetch refill history
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [medicationRequestId]);

  if (loading) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="body2" sx={{ mt: 1 }}>
          Loading refill history...
        </Typography>
      </Box>
    );
  }

  if (!history) {
    return (
      <Alert severity="error">
        Unable to load refill history
      </Alert>
    );
  }

  return (
    <Box>
      {/* Adherence Summary */}
      {adherence && (
        <Card sx={{ mb: 2 }}>
          <CardHeader
            avatar={
              <Avatar sx={{ bgcolor: `${ADHERENCE_COLORS[adherence.rating]}.main` }}>
                <AdherenceIcon />
              </Avatar>
            }
            title="Medication Adherence"
            subheader={`${Math.round(adherence.adherenceRate * 100)}% adherence rate`}
          />
          <CardContent>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Rating
                </Typography>
                <Chip 
                  label={adherence.rating.toUpperCase()} 
                  color={ADHERENCE_COLORS[adherence.rating]}
                  size="small"
                />
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Days Covered (90d)
                </Typography>
                <Typography variant="body1">
                  {adherence.daysCovered} / 90 days
                </Typography>
              </Grid>
              {adherence.gaps.length > 0 && (
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">
                    Coverage Gaps
                  </Typography>
                  <Typography variant="body2" color="warning.main">
                    {adherence.gaps.length} gap(s) totaling {adherence.gaps.reduce((sum, gap) => sum + gap.days, 0)} days
                  </Typography>
                </Grid>
              )}
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Refill Statistics */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Refill Summary
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={4}>
              <Typography variant="body2" color="text.secondary">
                Refills Used
              </Typography>
              <Typography variant="h6">
                {history.refillsUsed} / {history.totalRefillsAllowed}
              </Typography>
            </Grid>
            <Grid item xs={4}>
              <Typography variant="body2" color="text.secondary">
                Last Refill
              </Typography>
              <Typography variant="body1">
                {history.lastRefillDate ? 
                  format(parseISO(history.lastRefillDate), 'MMM d, yyyy') : 
                  'None'
                }
              </Typography>
            </Grid>
            <Grid item xs={4}>
              <Typography variant="body2" color="text.secondary">
                Total Events
              </Typography>
              <Typography variant="h6">
                {history.history.length}
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* History Timeline */}
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Timeline
        </Typography>
        <List>
          {history.history.map((event, index) => {
            const isLast = index === history.history.length - 1;
            const eventIcon = {
              'original': <MedicationIcon color="primary" />,
              'refill-request': <RefillIcon color="info" />,
              'dispense': <DispensedIcon color="success" />
            }[event.type];

            return (
              <ListItem key={`event-${event.type}-${event.date}-${index}`} sx={{ pl: 0 }}>
                <ListItemIcon>
                  <Box sx={{ position: 'relative' }}>
                    {eventIcon}
                    {!isLast && (
                      <Box
                        sx={{
                          position: 'absolute',
                          left: '50%',
                          top: '100%',
                          width: 2,
                          height: 40,
                          bgcolor: 'divider',
                          transform: 'translateX(-50%)'
                        }}
                      />
                    )}
                  </Box>
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="body1">
                        {event.type === 'original' && 'Original Prescription'}
                        {event.type === 'refill-request' && `Refill Request #${event.refillInfo?.refillNumber || 'N/A'}`}
                        {event.type === 'dispense' && 'Medication Dispensed'}
                      </Typography>
                      <Chip 
                        label={event.status} 
                        size="small" 
                        color={event.status === 'active' || event.status === 'completed' ? 'success' : 'default'}
                      />
                    </Stack>
                  }
                  secondary={
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        {format(parseISO(event.date), 'MMM d, yyyy h:mm a')}
                      </Typography>
                      {event.type === 'dispense' && event.data.daysSupply && (
                        <Typography variant="caption" color="text.secondary">
                          {event.data.daysSupply.value} days supply
                        </Typography>
                      )}
                    </Box>
                  }
                />
              </ListItem>
            );
          })}
        </List>
      </Paper>
    </Box>
  );
};

// Main Refill Management Component
const RefillManagement = ({ patientId, medications = [], onRefresh }) => {
  const theme = useTheme();
  const { publish } = useClinicalWorkflow();
  const [tabValue, setTabValue] = useState(0);
  const [refillRequests, setRefillRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refillDialogOpen, setRefillDialogOpen] = useState(false);
  const [selectedMedication, setSelectedMedication] = useState(null);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [eligibilityData, setEligibilityData] = useState(new Map());

  // Load refill requests and eligibility
  useEffect(() => {
    if (patientId) {
      loadRefillData();
    }
  }, [patientId, medications]);

  const loadRefillData = async () => {
    setLoading(true);
    try {
      // Load refill requests
      const requests = await prescriptionRefillService.getRefillRequests(patientId);
      setRefillRequests(requests);

      // Check eligibility for each medication
      const eligibilityMap = new Map();
      await Promise.all(
        medications.map(async (med) => {
          try {
            const eligibility = await prescriptionRefillService.checkRefillEligibility(med.id);
            eligibilityMap.set(med.id, eligibility);
          } catch (error) {
            // Skip failed eligibility check
          }
        })
      );
      setEligibilityData(eligibilityMap);

    } catch (error) {
      // Failed to load refill data
    } finally {
      setLoading(false);
    }
  };

  // Handle refill request submission
  const handleRefillRequest = async (requestData) => {
    try {
      const refillRequest = await prescriptionRefillService.createRefillRequest(
        selectedMedication.id,
        requestData
      );

      // Publish workflow event
      await publish(CLINICAL_EVENTS.WORKFLOW_NOTIFICATION, {
        workflowType: 'refill-request',
        step: 'submitted',
        data: {
          medicationName: selectedMedication.medicationCodeableConcept?.text || 'Unknown',
          patientId,
          urgent: requestData.urgent,
          timestamp: new Date().toISOString()
        }
      });

      // Refresh data
      await loadRefillData();
      if (onRefresh) {
        await onRefresh();
      }

      setRefillDialogOpen(false);
      setSelectedMedication(null);

    } catch (error) {
      throw error;
    }
  };

  // Filter medications by refill eligibility
  const eligibleMedications = useMemo(() => {
    return medications.filter(med => {
      const eligibility = eligibilityData.get(med.id);
      return eligibility?.eligible || eligibility?.refillsRemaining > 0;
    });
  }, [medications, eligibilityData]);

  const dueMedications = useMemo(() => {
    return medications.filter(med => {
      const eligibility = eligibilityData.get(med.id);
      return eligibility?.eligible && eligibility?.daysTillDue <= 0;
    });
  }, [medications, eligibilityData]);

  const { getMedicationDisplay } = useMedicationResolver(medications?.filter(med => med != null) || []);

  return (
    <Box>
      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={3}>
          <Card sx={{ bgcolor: alpha(theme.palette.info.main, 0.1) }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <Badge badgeContent={refillRequests.filter(r => r.status === 'draft').length} color="info">
                <RefillIcon color="info" sx={{ fontSize: 40 }} />
              </Badge>
              <Typography variant="h6" color="info.main">
                Pending Requests
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={3}>
          <Card sx={{ bgcolor: alpha(theme.palette.warning.main, 0.1) }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <Badge badgeContent={dueMedications.length} color="warning">
                <AlertIcon color="warning" sx={{ fontSize: 40 }} />
              </Badge>
              <Typography variant="h6" color="warning.main">
                Due for Refill
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={3}>
          <Card sx={{ bgcolor: alpha(theme.palette.success.main, 0.1) }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <Badge badgeContent={eligibleMedications.length} color="success">
                <ApprovedIcon color="success" sx={{ fontSize: 40 }} />
              </Badge>
              <Typography variant="h6" color="success.main">
                Eligible Medications
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={3}>
          <Card sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1) }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <Badge badgeContent={medications.length} color="primary">
                <MedicationIcon color="primary" sx={{ fontSize: 40 }} />
              </Badge>
              <Typography variant="h6" color="primary.main">
                Total Medications
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Action Bar */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5">
          Refill Management
        </Typography>
        <Button
          startIcon={<RefreshIcon />}
          onClick={loadRefillData}
          disabled={loading}
        >
          Refresh
        </Button>
      </Stack>

      {/* Tabs */}
      <Paper sx={{ mb: 2 }}>
        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
          <Tab label="Current Medications" />
          <Tab label="Refill Requests" />
          <Tab label="Adherence Tracking" />
        </Tabs>
      </Paper>

      {/* Tab Content */}
      {tabValue === 0 && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Current Medications
          </Typography>
          {loading ? (
            <CircularProgress />
          ) : (
            <List>
              {medications.map((medication) => {
                const eligibility = eligibilityData.get(medication.id);
                const isEligible = eligibility?.eligible;
                const isDue = eligibility?.daysTillDue <= 0;
                
                return (
                  <ListItem key={medication.id} divider>
                    <ListItemIcon>
                      <MedicationIcon color={medication.status === 'active' ? 'primary' : 'disabled'} />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="body1">
                            {getMedicationDisplay(medication)}
                          </Typography>
                          {isDue && (
                            <Chip label="DUE" color="warning" size="small" />
                          )}
                          {medication.status && (
                            <Chip 
                              label={medication.status.toUpperCase()} 
                              size="small" 
                              color={medication.status === 'active' ? 'success' : 'default'}
                            />
                          )}
                        </Stack>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2">
                            {medication.dosageInstruction?.[0]?.text || 'See instructions'}
                          </Typography>
                          {eligibility && (
                            <Typography variant="caption" color="text.secondary">
                              {eligibility.reason} • {eligibility.refillsRemaining} refills remaining
                            </Typography>
                          )}
                        </Box>
                      }
                    />
                    <ListItemSecondaryAction>
                      <Stack direction="row" spacing={1}>
                        <IconButton
                          onClick={() => {
                            setSelectedMedication(medication);
                            setHistoryDialogOpen(true);
                          }}
                          size="small"
                        >
                          <HistoryIcon />
                        </IconButton>
                        <Button
                          variant="outlined"
                          size="small"
                          disabled={!isEligible}
                          onClick={() => {
                            setSelectedMedication(medication);
                            setRefillDialogOpen(true);
                          }}
                        >
                          Request Refill
                        </Button>
                      </Stack>
                    </ListItemSecondaryAction>
                  </ListItem>
                );
              })}
            </List>
          )}
        </Paper>
      )}

      {tabValue === 1 && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Refill Requests
          </Typography>
          {loading ? (
            <CircularProgress />
          ) : refillRequests.length === 0 ? (
            <Alert severity="info">
              No refill requests found
            </Alert>
          ) : (
            <List>
              {refillRequests.map((request) => {
                const statusConfig = REFILL_STATUS_CONFIG[request.status] || REFILL_STATUS_CONFIG['requested'];
                
                return (
                  <ListItem key={request.id} divider>
                    <ListItemIcon>
                      {statusConfig.icon}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="body1">
                            {request.medicationCodeableConcept?.text || 'Unknown medication'}
                          </Typography>
                          <Chip 
                            label={statusConfig.label} 
                            color={statusConfig.color} 
                            size="small"
                          />
                          {request.refillInfo?.urgent && (
                            <Chip label="URGENT" color="error" size="small" />
                          )}
                        </Stack>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2">
                            Requested: {format(parseISO(request.authoredOn), 'MMM d, yyyy h:mm a')}
                          </Typography>
                          {request.refillInfo && (
                            <Typography variant="caption" color="text.secondary">
                              Refill #{request.refillInfo.refillNumber} • Via {request.refillInfo.requestMethod}
                            </Typography>
                          )}
                        </Box>
                      }
                    />
                  </ListItem>
                );
              })}
            </List>
          )}
        </Paper>
      )}

      {tabValue === 2 && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Adherence Tracking
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select a medication to view detailed adherence analytics
          </Typography>
          {medications.map((medication) => (
            <Accordion key={medication.id}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="body1">
                  {getMedicationDisplay(medication)}
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <RefillHistory medicationRequestId={medication.id} />
              </AccordionDetails>
            </Accordion>
          ))}
        </Paper>
      )}

      {/* Dialogs */}
      <RefillRequestDialog
        open={refillDialogOpen}
        onClose={() => {
          setRefillDialogOpen(false);
          setSelectedMedication(null);
        }}
        medicationRequest={selectedMedication}
        onSubmit={handleRefillRequest}
      />

      <Dialog
        open={historyDialogOpen}
        onClose={() => {
          setHistoryDialogOpen(false);
          setSelectedMedication(null);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Refill History
          {selectedMedication && (
            <Typography variant="subtitle2" color="text.secondary">
              {getMedicationDisplay(selectedMedication)}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          {selectedMedication && (
            <RefillHistory medicationRequestId={selectedMedication.id} />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setHistoryDialogOpen(false);
            setSelectedMedication(null);
          }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RefillManagement;