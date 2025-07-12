/**
 * Pharmacy Tab Component
 * Comprehensive medication dispensing and pharmacy workflow management
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  Tooltip,
  Divider,
  Card,
  CardContent,
  CardActions,
  CardHeader,
  TextField,
  InputAdornment,
  Menu,
  MenuItem,
  FormControl,
  Select,
  InputLabel,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Badge,
  LinearProgress,
  useTheme,
  alpha,
  Tabs,
  Tab,
  Snackbar
} from '@mui/material';
import {
  Medication as PharmacyIcon,
  LocalPharmacy as DispenseIcon,
  Assignment as PrescriptionIcon,
  Schedule as PendingIcon,
  CheckCircle as FilledIcon,
  Warning as AlertIcon,
  Info as InfoIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  MoreVert as MoreIcon,
  Print as PrintIcon,
  QrCode as QrCodeIcon,
  Inventory as InventoryIcon,
  Person as PatientIcon,
  AccessTime as TimeIcon,
  CalendarMonth as DateIcon,
  Edit as EditIcon,
  Add as AddIcon,
  Cancel as CancelIcon,
  Done as DoneIcon,
  People as PeopleIcon,
  CheckCircle as ApprovedIcon,
  History as HistoryIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { format, parseISO, isWithinInterval, subDays, addDays } from 'date-fns';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import { printDocument } from '../../../../utils/printUtils';
import { fhirClient } from '../../../../services/fhirClient';
import { medicationListManagementService } from '../../../../services/medicationListManagementService';
import { prescriptionRefillService } from '../../../../services/prescriptionRefillService';
import { useClinicalWorkflow, CLINICAL_EVENTS } from '../../../../contexts/ClinicalWorkflowContext';

// Medication status definitions
const MEDICATION_STATUSES = {
  'active': { label: 'Active', color: 'success', icon: <FilledIcon /> },
  'on-hold': { label: 'On Hold', color: 'warning', icon: <PendingIcon /> },
  'cancelled': { label: 'Cancelled', color: 'error', icon: <CancelIcon /> },
  'completed': { label: 'Completed', color: 'info', icon: <DoneIcon /> },
  'entered-in-error': { label: 'Error', color: 'error', icon: <AlertIcon /> },
  'stopped': { label: 'Stopped', color: 'default', icon: <CancelIcon /> },
  'draft': { label: 'Draft', color: 'default', icon: <EditIcon /> },
  'unknown': { label: 'Unknown', color: 'default', icon: <InfoIcon /> }
};

// Pharmacy workflow statuses
const PHARMACY_STATUSES = {
  'pending': { label: 'Pending Review', color: 'warning', priority: 1 },
  'verified': { label: 'Verified', color: 'info', priority: 2 },
  'dispensed': { label: 'Dispensed', color: 'success', priority: 3 },
  'ready': { label: 'Ready for Pickup', color: 'primary', priority: 4 },
  'completed': { label: 'Completed', color: 'success', priority: 5 }
};

// Medication Request Card Component
const MedicationRequestCard = ({ medicationRequest, onStatusChange, onDispense, onViewDetails }) => {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState(null);
  
  const getMedicationName = () => {
    return medicationRequest.medicationCodeableConcept?.text ||
           medicationRequest.medicationCodeableConcept?.coding?.[0]?.display ||
           medicationRequest.medicationReference?.display ||
           'Unknown Medication';
  };

  const getDosageInstruction = () => {
    const dosage = medicationRequest.dosageInstruction?.[0];
    if (!dosage) return 'No dosage specified';
    
    const dose = dosage.doseAndRate?.[0]?.doseQuantity;
    const frequency = dosage.timing?.repeat?.frequency;
    const period = dosage.timing?.repeat?.period;
    const periodUnit = dosage.timing?.repeat?.periodUnit;
    
    let instruction = '';
    if (dose) {
      instruction += `${dose.value} ${dose.unit || 'units'}`;
    }
    if (frequency && period) {
      instruction += ` - ${frequency} time(s) every ${period} ${periodUnit}`;
    }
    if (dosage.text) {
      instruction = dosage.text;
    }
    
    return instruction || 'See instructions';
  };

  const getPharmacyStatus = () => {
    // This would typically come from a pharmacy system
    // For demo, derive from medication status and dates
    const status = medicationRequest.status;
    const authoredDate = medicationRequest.authoredOn;
    
    if (status === 'completed') return 'completed';
    if (status === 'cancelled' || status === 'stopped') return 'completed';
    if (authoredDate && isWithinInterval(parseISO(authoredDate), {
      start: subDays(new Date(), 1),
      end: new Date()
    })) return 'pending';
    
    return 'verified';
  };

  const pharmacyStatus = getPharmacyStatus();
  const statusInfo = MEDICATION_STATUSES[medicationRequest.status] || MEDICATION_STATUSES.unknown;
  const pharmacyStatusInfo = PHARMACY_STATUSES[pharmacyStatus];

  return (
    <Card sx={{ mb: 2 }}>
      <CardHeader
        avatar={<PharmacyIcon color="primary" />}
        title={
          <Typography variant="h6" component="div">
            {getMedicationName()}
          </Typography>
        }
        subheader={
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip 
              icon={statusInfo.icon}
              label={statusInfo.label} 
              size="small" 
              color={statusInfo.color}
            />
            <Chip 
              label={pharmacyStatusInfo.label} 
              size="small" 
              color={pharmacyStatusInfo.color}
              variant="outlined"
            />
          </Stack>
        }
        action={
          <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
            <MoreIcon />
          </IconButton>
        }
      />
      
      <CardContent>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Typography variant="caption" color="text.secondary">
              Dosage Instructions
            </Typography>
            <Typography variant="body2">
              {getDosageInstruction()}
            </Typography>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Typography variant="caption" color="text.secondary">
              Prescriber
            </Typography>
            <Typography variant="body2">
              {medicationRequest.requester?.display || 'Unknown Provider'}
            </Typography>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Typography variant="caption" color="text.secondary">
              Date Prescribed
            </Typography>
            <Typography variant="body2">
              {medicationRequest.authoredOn ? 
                format(parseISO(medicationRequest.authoredOn), 'MMM d, yyyy h:mm a') : 
                'No date'}
            </Typography>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Typography variant="caption" color="text.secondary">
              Quantity
            </Typography>
            <Typography variant="body2">
              {medicationRequest.dispenseRequest?.quantity?.value || 'Not specified'} {medicationRequest.dispenseRequest?.quantity?.unit || ''}
            </Typography>
          </Grid>
          
          {medicationRequest.note && medicationRequest.note.length > 0 && (
            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary">
                Notes
              </Typography>
              <Typography variant="body2">
                {medicationRequest.note[0].text}
              </Typography>
            </Grid>
          )}
        </Grid>
      </CardContent>
      
      <CardActions>
        {pharmacyStatus === 'pending' && (
          <Button 
            size="small" 
            startIcon={<FilledIcon />}
            onClick={() => onStatusChange(medicationRequest.id, 'verified')}
            color="primary"
          >
            Verify
          </Button>
        )}
        
        {pharmacyStatus === 'verified' && (
          <Button 
            size="small" 
            startIcon={<DispenseIcon />}
            onClick={() => onDispense(medicationRequest)}
            color="success"
          >
            Dispense
          </Button>
        )}
        
        <Button 
          size="small" 
          startIcon={<InfoIcon />}
          onClick={() => onViewDetails(medicationRequest)}
        >
          Details
        </Button>
        
        <Button 
          size="small" 
          startIcon={<PrintIcon />}
        >
          Print Label
        </Button>
      </CardActions>
      
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem onClick={() => setAnchorEl(null)}>
          <EditIcon sx={{ mr: 1 }} />
          Edit Prescription
        </MenuItem>
        <MenuItem onClick={() => setAnchorEl(null)}>
          <QrCodeIcon sx={{ mr: 1 }} />
          Generate QR Code
        </MenuItem>
        <MenuItem onClick={() => setAnchorEl(null)}>
          <InventoryIcon sx={{ mr: 1 }} />
          Check Inventory
        </MenuItem>
      </Menu>
    </Card>
  );
};

// Refill Request Card Component
const RefillRequestCard = ({ refillRequest, onApprove, onReject, onViewDetails }) => {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState(null);

  const getMedicationName = () => {
    return refillRequest.medicationCodeableConcept?.text ||
           refillRequest.medicationCodeableConcept?.coding?.[0]?.display ||
           refillRequest.medicationReference?.display ||
           'Unknown Medication';
  };

  const getPatientName = () => {
    if (refillRequest.patient) {
      const patient = refillRequest.patient;
      return `${patient.name?.[0]?.given?.join(' ') || ''} ${patient.name?.[0]?.family || ''}`.trim();
    }
    return 'Unknown Patient';
  };

  const getRefillInfo = () => {
    return refillRequest.refillInfo || {};
  };

  const refillInfo = getRefillInfo();

  return (
    <Card sx={{ mb: 2, border: refillInfo.urgent ? `2px solid ${theme.palette.error.main}` : undefined }}>
      <CardHeader
        avatar={<RefreshIcon color="warning" />}
        title={
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="h6" component="div">
              {getMedicationName()}
            </Typography>
            {refillInfo.urgent && (
              <Chip label="URGENT" color="error" size="small" />
            )}
          </Stack>
        }
        subheader={
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip 
              label={`Refill #${refillInfo.refillNumber || 'N/A'}`} 
              size="small" 
              color="info"
            />
            <Typography variant="caption" color="text.secondary">
              via {refillInfo.requestMethod || 'unknown'}
            </Typography>
          </Stack>
        }
        action={
          <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
            <MoreIcon />
          </IconButton>
        }
      />
      
      <CardContent>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Typography variant="caption" color="text.secondary">
              Patient
            </Typography>
            <Typography variant="body2">
              {getPatientName()}
            </Typography>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Typography variant="caption" color="text.secondary">
              Original Prescription
            </Typography>
            <Typography variant="body2">
              {refillRequest.originalPrescription ? 
                format(parseISO(refillRequest.originalPrescription.authoredOn), 'MMM d, yyyy') : 
                'Unknown'}
            </Typography>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Typography variant="caption" color="text.secondary">
              Request Date
            </Typography>
            <Typography variant="body2">
              {format(parseISO(refillRequest.authoredOn), 'MMM d, yyyy h:mm a')}
            </Typography>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Typography variant="caption" color="text.secondary">
              Requested By
            </Typography>
            <Typography variant="body2">
              {refillInfo.requestedBy || 'Unknown'}
            </Typography>
          </Grid>
          
          {refillRequest.note && refillRequest.note.some(note => note.text.includes('Patient notes:')) && (
            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary">
                Patient Notes
              </Typography>
              <Typography variant="body2">
                {refillRequest.note.find(note => note.text.includes('Patient notes:'))?.text.replace('Patient notes: ', '')}
              </Typography>
            </Grid>
          )}
        </Grid>
      </CardContent>
      
      <CardActions>
        <Button 
          size="small" 
          startIcon={<ApprovedIcon />}
          onClick={() => onApprove(refillRequest.id)}
          color="success"
        >
          Approve
        </Button>
        
        <Button 
          size="small" 
          startIcon={<CancelIcon />}
          onClick={() => onReject(refillRequest.id)}
          color="error"
        >
          Reject
        </Button>
        
        <Button 
          size="small" 
          startIcon={<InfoIcon />}
          onClick={() => onViewDetails(refillRequest)}
        >
          Details
        </Button>
      </CardActions>
      
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem onClick={() => setAnchorEl(null)}>
          <EditIcon sx={{ mr: 1 }} />
          Edit Request
        </MenuItem>
        <MenuItem onClick={() => setAnchorEl(null)}>
          <HistoryIcon sx={{ mr: 1 }} />
          View History
        </MenuItem>
        <MenuItem onClick={() => setAnchorEl(null)}>
          <PrintIcon sx={{ mr: 1 }} />
          Print Request
        </MenuItem>
      </Menu>
    </Card>
  );
};

// Dispense Dialog Component
const DispenseDialog = ({ open, onClose, medicationRequest, onDispense }) => {
  const [quantity, setQuantity] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [pharmacistNotes, setPharmacistNotes] = useState('');

  useEffect(() => {
    if (medicationRequest) {
      const requestedQuantity = medicationRequest.dispenseRequest?.quantity?.value || '';
      setQuantity(requestedQuantity.toString());
    }
  }, [medicationRequest]);

  const handleDispense = () => {
    const dispenseData = {
      medicationRequestId: medicationRequest.id,
      quantity: parseFloat(quantity),
      lotNumber,
      expirationDate,
      pharmacistNotes,
      dispensedAt: new Date().toISOString(),
      pharmacist: 'Current User' // This would come from auth context
    };
    
    onDispense(dispenseData);
    onClose();
  };

  if (!medicationRequest) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Dispense Medication
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <Typography variant="h6" gutterBottom>
            {medicationRequest.medicationCodeableConcept?.text ||
             medicationRequest.medicationCodeableConcept?.coding?.[0]?.display ||
             'Unknown Medication'}
          </Typography>
          
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Quantity to Dispense"
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                fullWidth
                required
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      {medicationRequest.dispenseRequest?.quantity?.unit || 'units'}
                    </InputAdornment>
                  )
                }}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="Lot Number"
                value={lotNumber}
                onChange={(e) => setLotNumber(e.target.value)}
                fullWidth
                required
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="Expiration Date"
                type="date"
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
                fullWidth
                required
                InputLabelProps={{
                  shrink: true,
                }}
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                label="Pharmacist Notes"
                value={pharmacistNotes}
                onChange={(e) => setPharmacistNotes(e.target.value)}
                fullWidth
                multiline
                rows={3}
                placeholder="Any additional notes or instructions..."
              />
            </Grid>
          </Grid>
        </Box>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          onClick={handleDispense} 
          variant="contained"
          disabled={!quantity || !lotNumber || !expirationDate}
        >
          Dispense Medication
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const PharmacyTab = ({ patientId, onNotificationUpdate }) => {
  const theme = useTheme();
  const { getPatientResources, isLoading, currentPatient, refreshPatientResources } = useFHIRResource();
  const { publish } = useClinicalWorkflow();
  
  const [tabValue, setTabValue] = useState(0);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPharmacyStatus, setFilterPharmacyStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [dispenseDialogOpen, setDispenseDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [patientFilter, setPatientFilter] = useState('current'); // 'all' or 'current'
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [refillRequests, setRefillRequests] = useState([]);
  const [pendingRefills, setPendingRefills] = useState([]);

  // Load refill requests when component mounts or patient changes
  useEffect(() => {
    const loadRefillData = async () => {
      if (!patientId) return;
      
      try {
        // Load patient-specific refill requests
        const patientRefills = await prescriptionRefillService.getRefillRequests(patientId);
        setRefillRequests(patientRefills);
        
        // Load pending refill requests for pharmacy (across all patients when filter is 'all')
        if (patientFilter === 'all') {
          const pending = await prescriptionRefillService.getPendingRefillRequests();
          setPendingRefills(pending);
        } else {
          setPendingRefills(patientRefills.filter(r => r.status === 'draft'));
        }
      } catch (error) {
        console.error('Error loading refill data:', error);
      }
    };

    loadRefillData();
  }, [patientId, patientFilter]);

  // Get medication requests based on patient filter
  const medicationRequests = useMemo(() => {
    if (!getPatientResources) return [];
    
    // For patient-specific filter, only get current patient's requests
    if (patientFilter === 'current' && patientId) {
      return getPatientResources(patientId, 'MedicationRequest') || [];
    }
    
    // For 'all' filter, we would typically fetch from all patients
    // Since we're using patient context, we'll still use current patient
    // In a real pharmacy system, this would query across all patients
    return getPatientResources(patientId, 'MedicationRequest') || [];
  }, [getPatientResources, patientId, patientFilter]);

  // Categorize medication requests by pharmacy status
  const categorizedRequests = useMemo(() => {
    const pending = [];
    const verified = [];
    const dispensed = [];
    const completed = [];
    
    medicationRequests.forEach(request => {
      // Simplified status categorization for demo
      const status = request.status;
      const authoredDate = request.authoredOn;
      
      if (status === 'completed') {
        completed.push(request);
      } else if (status === 'cancelled' || status === 'stopped') {
        completed.push(request);
      } else if (authoredDate && isWithinInterval(parseISO(authoredDate), {
        start: subDays(new Date(), 1),
        end: new Date()
      })) {
        pending.push(request);
      } else {
        verified.push(request);
      }
    });
    
    return { pending, verified, dispensed, completed };
  }, [medicationRequests]);

  // Filter requests based on current filters
  const filteredRequests = useMemo(() => {
    let requests = medicationRequests;
    
    // Filter by medication status
    if (filterStatus !== 'all') {
      requests = requests.filter(req => req.status === filterStatus);
    }
    
    // Filter by pharmacy status
    if (filterPharmacyStatus !== 'all') {
      // This would be more sophisticated with actual pharmacy status
      if (filterPharmacyStatus === 'pending') {
        requests = requests.filter(req => 
          req.authoredOn && isWithinInterval(parseISO(req.authoredOn), {
            start: subDays(new Date(), 1),
            end: new Date()
          })
        );
      }
    }
    
    // Filter by search term
    if (searchTerm) {
      requests = requests.filter(req => {
        const medName = req.medicationCodeableConcept?.text || 
                        req.medicationCodeableConcept?.coding?.[0]?.display || '';
        return medName.toLowerCase().includes(searchTerm.toLowerCase());
      });
    }
    
    // Sort by priority and date
    return requests.sort((a, b) => {
      const dateA = new Date(a.authoredOn || 0);
      const dateB = new Date(b.authoredOn || 0);
      return dateB - dateA;
    });
  }, [medicationRequests, filterStatus, filterPharmacyStatus, searchTerm]);

  // Handle status changes
  const handleStatusChange = useCallback(async (requestId, newStatus) => {
    try {
      // Get the current medication request
      const currentRequest = medicationRequests.find(req => req.id === requestId);
      if (!currentRequest) {
        throw new Error('Medication request not found');
      }

      const oldStatus = currentRequest.status;

      // Update the medication request status
      const updatedRequest = {
        ...currentRequest,
        status: newStatus
      };

      await fhirClient.update('MedicationRequest', requestId, updatedRequest);
      
      // Update medication lists based on status change
      try {
        await medicationListManagementService.handlePrescriptionStatusUpdate(
          requestId, 
          newStatus, 
          oldStatus
        );
      } catch (error) {
        console.error('Error updating medication lists:', error);
      }
      
      // Refresh the medication requests
      await refreshPatientResources(patientId);

      // Publish event for other tabs
      await publish(CLINICAL_EVENTS.MEDICATION_STATUS_CHANGED, {
        resourceId: requestId,
        newStatus: newStatus,
        oldStatus: oldStatus,
        resourceType: 'MedicationRequest'
      });
      
      setSnackbar({
        open: true,
        message: `Medication request status updated to ${newStatus}`,
        severity: 'success'
      });
    } catch (error) {
      console.error('Failed to update medication request status:', error);
      setSnackbar({
        open: true,
        message: 'Failed to update medication request status',
        severity: 'error'
      });
    }
  }, [medicationRequests, refreshPatientResources, publish, patientId]);

  // Handle dispensing
  const handleDispense = useCallback(async (dispenseData) => {
    try {
      // Create MedicationDispense FHIR resource
      const dispenseResource = {
        resourceType: 'MedicationDispense',
        status: 'completed',
        medicationCodeableConcept: dispenseData.medication,
        subject: { reference: `Patient/${patientId}` },
        authorizingPrescription: [{ reference: `MedicationRequest/${dispenseData.medicationRequestId}` }],
        quantity: { value: dispenseData.quantity, unit: dispenseData.unit },
        whenHandedOver: dispenseData.dispensedAt || new Date().toISOString(),
        daysSupply: dispenseData.daysSupply ? {
          value: dispenseData.daysSupply,
          unit: 'days'
        } : undefined,
        performer: [{
          actor: {
            display: 'Pharmacy Staff' // In production, this would be the current user
          }
        }],
        note: dispenseData.pharmacistNotes ? [{ text: dispenseData.pharmacistNotes }] : undefined
      };
      
      // Create the MedicationDispense resource
      const createdDispense = await fhirClient.create('MedicationDispense', dispenseResource);
      
      // Get the current medication request to update it
      const currentRequest = medicationRequests.find(req => req.id === dispenseData.medicationRequestId);
      if (currentRequest) {
        // Update the medication request status to 'completed'
        const updatedRequest = {
          ...currentRequest,
          status: 'completed',
          dispenseRequest: {
            ...currentRequest.dispenseRequest,
            numberOfRepeatsAllowed: (currentRequest.dispenseRequest?.numberOfRepeatsAllowed || 0) - 1
          }
        };
        await fhirClient.update('MedicationRequest', dispenseData.medicationRequestId, updatedRequest);
      }
      
      // Refresh patient resources to update the UI
      await refreshPatientResources(patientId);
      
      // Publish MEDICATION_DISPENSED event
      await publish(CLINICAL_EVENTS.MEDICATION_DISPENSED, {
        ...createdDispense,
        medicationName: dispenseData.medication?.text || 
                       dispenseData.medication?.coding?.[0]?.display || 
                       'Unknown medication',
        patientId,
        timestamp: new Date().toISOString()
      });
      
      // Publish workflow notification
      await publish(CLINICAL_EVENTS.WORKFLOW_NOTIFICATION, {
        workflowType: 'prescription-dispense',
        step: 'completed',
        data: {
          medicationName: dispenseData.medication?.text || 
                         dispenseData.medication?.coding?.[0]?.display || 
                         'Unknown medication',
          quantity: dispenseData.quantity,
          unit: dispenseData.unit,
          daysSupply: dispenseData.daysSupply,
          patientId,
          timestamp: new Date().toISOString()
        }
      });
      
      setSnackbar({
        open: true,
        message: 'Medication dispensed successfully',
        severity: 'success'
      });
      setSelectedRequest(null);
      setDispenseDialogOpen(false);
    } catch (error) {
      
      setSnackbar({
        open: true,
        message: error.message || 'Failed to dispense medication',
        severity: 'error'
      });
    }
  }, [onNotificationUpdate, patientId, medicationRequests, publish]);

  // Handle refill request approval
  const handleApproveRefill = useCallback(async (refillRequestId, approvalData) => {
    try {
      await prescriptionRefillService.approveRefillRequest(refillRequestId, {
        approvedBy: 'Current Pharmacist', // In real app, get from auth context
        notes: approvalData?.notes || '',
        ...approvalData
      });

      // Refresh refill data
      const patientRefills = await prescriptionRefillService.getRefillRequests(patientId);
      setRefillRequests(patientRefills);
      setPendingRefills(patientRefills.filter(r => r.status === 'draft'));

      // Publish workflow event
      await publish(CLINICAL_EVENTS.WORKFLOW_NOTIFICATION, {
        workflowType: 'refill-approval',
        step: 'approved',
        data: {
          refillRequestId,
          patientId,
          timestamp: new Date().toISOString()
        }
      });

      setSnackbar({
        open: true,
        message: 'Refill request approved successfully',
        severity: 'success'
      });

    } catch (error) {
      console.error('Error approving refill request:', error);
      setSnackbar({
        open: true,
        message: 'Failed to approve refill request',
        severity: 'error'
      });
    }
  }, [patientId, publish]);

  // Handle refill request rejection
  const handleRejectRefill = useCallback(async (refillRequestId, rejectionData) => {
    try {
      await prescriptionRefillService.rejectRefillRequest(refillRequestId, {
        rejectedBy: 'Current Pharmacist', // In real app, get from auth context
        reason: rejectionData?.reason || 'Not specified',
        ...rejectionData
      });

      // Refresh refill data
      const patientRefills = await prescriptionRefillService.getRefillRequests(patientId);
      setRefillRequests(patientRefills);
      setPendingRefills(patientRefills.filter(r => r.status === 'draft'));

      // Publish workflow event
      await publish(CLINICAL_EVENTS.WORKFLOW_NOTIFICATION, {
        workflowType: 'refill-approval',
        step: 'rejected',
        data: {
          refillRequestId,
          reason: rejectionData?.reason,
          patientId,
          timestamp: new Date().toISOString()
        }
      });

      setSnackbar({
        open: true,
        message: 'Refill request rejected',
        severity: 'info'
      });

    } catch (error) {
      console.error('Error rejecting refill request:', error);
      setSnackbar({
        open: true,
        message: 'Failed to reject refill request',
        severity: 'error'
      });
    }
  }, [patientId, publish]);

  // Handle opening dispense dialog
  const handleOpenDispenseDialog = useCallback((medicationRequest) => {
    setSelectedRequest(medicationRequest);
    setDispenseDialogOpen(true);
  }, []);

  // Handle viewing details
  const handleViewDetails = useCallback((medicationRequest) => {
    setSelectedRequest(medicationRequest);
    setDetailsDialogOpen(true);
  }, []);

  const getCurrentTabRequests = () => {
    switch (tabValue) {
      case 0: return categorizedRequests.pending;
      case 1: return categorizedRequests.verified;
      case 2: return categorizedRequests.dispensed;
      case 3: return categorizedRequests.completed;
      case 4: return pendingRefills; // Refill requests tab
      default: return filteredRequests;
    }
  };

  const currentRequests = getCurrentTabRequests();
  
  // Handle print queue
  const handlePrintQueue = useCallback(() => {
    const tabNames = ['Pending Review', 'Verified', 'Ready for Pickup', 'Completed', 'Refill Requests'];
    const currentTabName = tabNames[tabValue] || 'All';
    
    const content = `
      <h2>Pharmacy Queue - ${currentTabName}</h2>
      <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
      <p><strong>Filter:</strong> ${patientFilter === 'current' ? `Current Patient (${currentPatient?.name?.[0]?.given?.join(' ') || ''} ${currentPatient?.name?.[0]?.family || ''})` : 'All Patients'}</p>
      <p><strong>Total Items:</strong> ${currentRequests.length}</p>
      
      <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
        <thead>
          <tr style="background-color: #f5f5f5;">
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Medication</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Patient</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Dosage</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Quantity</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Status</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Prescribed Date</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Prescriber</th>
          </tr>
        </thead>
        <tbody>
          ${currentRequests.map(request => {
            const medicationName = request.medicationCodeableConcept?.text ||
              request.medicationCodeableConcept?.coding?.[0]?.display ||
              request.medicationReference?.display ||
              'Unknown Medication';
            
            const dosage = request.dosageInstruction?.[0];
            const dosageText = dosage?.text || 
              (dosage?.doseAndRate?.[0]?.doseQuantity ? 
                `${dosage.doseAndRate[0].doseQuantity.value} ${dosage.doseAndRate[0].doseQuantity.unit || 'units'}` : 
                'See instructions');
            
            const quantity = request.dispenseRequest?.quantity?.value ?
              `${request.dispenseRequest.quantity.value} ${request.dispenseRequest.quantity.unit || ''}` :
              'Not specified';
            
            const statusInfo = MEDICATION_STATUSES[request.status] || MEDICATION_STATUSES.unknown;
            
            return `
              <tr>
                <td style="border: 1px solid #ddd; padding: 8px;">${medicationName}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${request.subject?.display || 'Unknown Patient'}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${dosageText}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${quantity}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${statusInfo.label}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${request.authoredOn ? format(parseISO(request.authoredOn), 'MMM d, yyyy') : 'No date'}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${request.requester?.display || 'Unknown Provider'}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
      
      ${currentRequests.length === 0 ? '<p style="text-align: center; margin-top: 20px;">No medication requests in this queue.</p>' : ''}
    `;
    
    printDocument({
      title: `Pharmacy Queue - ${currentTabName}`,
      patient: patientFilter === 'current' ? currentPatient : null,
      content,
      footer: 'Generated from MedGenEMR Pharmacy Management System'
    });
  }, [tabValue, currentRequests, patientFilter, currentPatient]);

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Typography variant="h5" fontWeight="bold">
            Pharmacy Management
          </Typography>
          {currentPatient && patientFilter === 'current' && (
            <Chip
              icon={<PatientIcon />}
              label={`${currentPatient.name?.[0]?.given?.join(' ') || ''} ${currentPatient.name?.[0]?.family || ''}`}
              color="primary"
              variant="outlined"
            />
          )}
        </Stack>
        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            startIcon={<InventoryIcon />}
          >
            Check Inventory
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
          >
            Manual Entry
          </Button>
        </Stack>
      </Stack>

      {/* Pharmacy Queue Summary */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Pharmacy Queue Status
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={3}>
            <Card sx={{ bgcolor: alpha(theme.palette.warning.main, 0.1) }}>
              <CardContent sx={{ textAlign: 'center' }}>
                <Badge badgeContent={categorizedRequests.pending.length} color="warning">
                  <PendingIcon color="warning" sx={{ fontSize: 40 }} />
                </Badge>
                <Typography variant="h6" color="warning.main">
                  Pending Review
                </Typography>
                {patientFilter === 'current' && (
                  <Typography variant="caption" color="text.secondary">
                    Current patient
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={3}>
            <Card sx={{ bgcolor: alpha(theme.palette.info.main, 0.1) }}>
              <CardContent sx={{ textAlign: 'center' }}>
                <Badge badgeContent={categorizedRequests.verified.length} color="info">
                  <FilledIcon color="info" sx={{ fontSize: 40 }} />
                </Badge>
                <Typography variant="h6" color="info.main">
                  Verified
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={3}>
            <Card sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1) }}>
              <CardContent sx={{ textAlign: 'center' }}>
                <Badge badgeContent={categorizedRequests.dispensed.length} color="primary">
                  <DispenseIcon color="primary" sx={{ fontSize: 40 }} />
                </Badge>
                <Typography variant="h6" color="primary.main">
                  Ready for Pickup
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={3}>
            <Card sx={{ bgcolor: alpha(theme.palette.success.main, 0.1) }}>
              <CardContent sx={{ textAlign: 'center' }}>
                <Badge badgeContent={categorizedRequests.completed.length} color="success">
                  <DoneIcon color="success" sx={{ fontSize: 40 }} />
                </Badge>
                <Typography variant="h6" color="success.main">
                  Completed
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Paper>

      {/* Pharmacy Workflow Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs 
          value={tabValue} 
          onChange={(e, newValue) => setTabValue(newValue)}
          variant="fullWidth"
        >
          <Tab 
            label="Pending Review" 
            icon={
              <Badge badgeContent={categorizedRequests.pending.length} color="warning">
                <PendingIcon />
              </Badge>
            }
            iconPosition="start"
          />
          <Tab 
            label="Verified" 
            icon={
              <Badge badgeContent={categorizedRequests.verified.length} color="info">
                <FilledIcon />
              </Badge>
            }
            iconPosition="start"
          />
          <Tab 
            label="Ready for Pickup" 
            icon={
              <Badge badgeContent={categorizedRequests.dispensed.length} color="primary">
                <DispenseIcon />
              </Badge>
            }
            iconPosition="start"
          />
          <Tab 
            label="Completed" 
            icon={
              <Badge badgeContent={categorizedRequests.completed.length} color="success">
                <DoneIcon />
              </Badge>
            }
            iconPosition="start"
          />
          <Tab 
            label="Refill Requests" 
            icon={
              <Badge badgeContent={pendingRefills.length} color="warning">
                <RefreshIcon />
              </Badge>
            }
            iconPosition="start"
          />
        </Tabs>
      </Paper>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
          <TextField
            placeholder="Search medications..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="small"
            sx={{ flex: 1 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              )
            }}
          />
          
          {/* Patient Filter Toggle */}
          <Stack direction="row" spacing={1} alignItems="center">
            <IconButton
              size="small"
              onClick={() => setPatientFilter('current')}
              color={patientFilter === 'current' ? 'primary' : 'default'}
            >
              <Tooltip title="Current Patient">
                <PatientIcon />
              </Tooltip>
            </IconButton>
            <IconButton
              size="small"
              onClick={() => setPatientFilter('all')}
              color={patientFilter === 'all' ? 'primary' : 'default'}
            >
              <Tooltip title="All Patients">
                <PeopleIcon />
              </Tooltip>
            </IconButton>
          </Stack>
          
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              label="Status"
            >
              <MenuItem value="all">All Statuses</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="on-hold">On Hold</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
              <MenuItem value="cancelled">Cancelled</MenuItem>
            </Select>
          </FormControl>

          <Button
            variant="outlined"
            startIcon={<PrintIcon />}
            onClick={handlePrintQueue}
          >
            Print Queue
          </Button>
        </Stack>
      </Paper>

      {/* Medication Requests List */}
      {currentRequests.length === 0 ? (
        <Alert severity="info">
          {patientFilter === 'current' && currentPatient
            ? `No ${tabValue === 4 ? 'refill requests' : 'medication requests'} in this category for ${currentPatient.name?.[0]?.given?.join(' ') || ''} ${currentPatient.name?.[0]?.family || ''}`
            : `No ${tabValue === 4 ? 'refill requests' : 'medication requests'} in this category`
          }
        </Alert>
      ) : (
        <Box>
          {tabValue === 4 ? (
            // Render refill requests
            currentRequests.map((refillRequest) => (
              <RefillRequestCard
                key={refillRequest.id}
                refillRequest={refillRequest}
                onApprove={handleApproveRefill}
                onReject={handleRejectRefill}
                onViewDetails={handleViewDetails}
              />
            ))
          ) : (
            // Render regular medication requests
            currentRequests.map((request) => (
              <MedicationRequestCard
                key={request.id}
                medicationRequest={request}
                onStatusChange={handleStatusChange}
                onDispense={handleOpenDispenseDialog}
                onViewDetails={handleViewDetails}
              />
            ))
          )}
        </Box>
      )}

      {/* Dispense Dialog */}
      <DispenseDialog
        open={dispenseDialogOpen}
        onClose={() => setDispenseDialogOpen(false)}
        medicationRequest={selectedRequest}
        onDispense={handleDispense}
      />

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
    </Box>
  );
};

export default PharmacyTab;