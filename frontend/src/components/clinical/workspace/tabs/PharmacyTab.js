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
  Snackbar,
  ToggleButton,
  ToggleButtonGroup,
  Collapse,
  Avatar,
  AvatarGroup,
  Skeleton
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
  Refresh as RefreshIcon,
  Timeline as TimelineIcon,
  ViewModule as ViewModuleIcon,
  ViewList as ViewListIcon
} from '@mui/icons-material';
import { format, parseISO, isWithinInterval, subDays, addDays, subMonths } from 'date-fns';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import { printDocument } from '../../../../core/export/printUtils';
import { getMedicationDosageDisplay, getMedicationName } from '../../../../core/fhir/utils/medicationDisplayUtils';
import { fhirClient } from '../../../../core/fhir/services/fhirClient';
import { medicationListManagementService } from '../../../../services/medicationListManagementService';
import { prescriptionRefillService } from '../../../../services/prescriptionRefillService';
import { medicationDispenseService } from '../../../../services/medicationDispenseService';
import { medicationAdministrationService } from '../../../../services/medicationAdministrationService';
import { useMedicationDispense, useMedicationWorkflow } from '../../../../hooks/useMedicationDispense';
import { useMedicationAdministration } from '../../../../hooks/useMedicationAdministration';
import { useClinicalWorkflow, CLINICAL_EVENTS } from '../../../../contexts/ClinicalWorkflowContext';
import EnhancedDispenseDialog from './components/EnhancedDispenseDialog';
import AdministrationDialog from './components/AdministrationDialog';
import MedicationAdministrationRecord from '../../pharmacy/MedicationAdministrationRecord';
// Import shared clinical components
import { 
  ClinicalResourceCard,
  ClinicalSummaryCard,
  ClinicalFilterPanel,
  ClinicalDataGrid,
  ClinicalEmptyState,
  ClinicalLoadingState
} from '../../shared';
import { MedicationCardTemplate } from '../../shared/templates';
// Removed framer-motion for consistency with harmonized components

// Custom hook for density - simplified version
const useDensity = (defaultDensity = 'comfortable') => {
  const [density, setDensity] = useState(defaultDensity);
  return [density, setDensity];
};

// Helper function to get status color for chips
const getStatusColor = (status) => {
  const statusMap = {
    'active': 'primary',
    'pending': 'warning',
    'completed': 'success',
    'cancelled': 'error',
    'on-hold': 'warning',
    'draft': 'default'
  };
  return statusMap[status] || 'default';
};

// Helper function to format date consistently
const formatDate = (dateString) => {
  try {
    return format(parseISO(dateString), 'MMM d, yyyy');
  } catch {
    return 'Unknown date';
  }
};

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

// Medication Request Card Component using shared clinical components
const MedicationRequestCard = ({ medicationRequest, onStatusChange, onDispense, onViewDetails, isAlternate = false, relatedDispenses = [] }) => {
  const theme = useTheme();
  
  const medicationName = getMedicationName(medicationRequest);

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
    const status = medicationRequest.status;
    const authoredDate = medicationRequest.authoredOn;
    
    if (status === 'completed') return 'completed';
    if (status === 'cancelled' || status === 'stopped') return 'completed';
    if (relatedDispenses.some(d => d.status === 'completed')) return 'dispensed';
    if (relatedDispenses.some(d => d.status === 'in-progress')) return 'verified';
    if (authoredDate && isWithinInterval(parseISO(authoredDate), {
      start: subDays(new Date(), 1),
      end: new Date()
    })) return 'pending';
    
    return 'verified';
  };

  const getSeverity = () => {
    const status = medicationRequest.status;
    if (status === 'cancelled' || status === 'stopped') return 'high';
    if (status === 'on-hold') return 'moderate';
    if (getPharmacyStatus() === 'pending') return 'moderate';
    return 'normal';
  };

  const getRefillInfo = () => {
    const totalRefills = medicationRequest.dispenseRequest?.numberOfRepeatsAllowed || 0;
    const usedRefills = relatedDispenses.filter(d => d.status === 'completed').length;
    const remainingRefills = Math.max(0, totalRefills - usedRefills + 1);
    
    return {
      total: totalRefills,
      used: usedRefills,
      remaining: remainingRefills,
      lastFilled: relatedDispenses.length > 0 ? 
        relatedDispenses[0].whenHandedOver || relatedDispenses[0].whenPrepared : null
    };
  };

  const pharmacyStatus = getPharmacyStatus();
  const statusInfo = MEDICATION_STATUSES[medicationRequest.status] || MEDICATION_STATUSES.unknown;
  const pharmacyStatusInfo = PHARMACY_STATUSES[pharmacyStatus];
  const refillInfo = getRefillInfo();

  // Calculate metrics
  // Actions for the card
  const actions = [];
  if (pharmacyStatus === 'pending') {
    actions.push({
      label: 'Verify',
      onClick: () => onStatusChange(medicationRequest.id, 'verified')
    });
  }
  if (pharmacyStatus === 'verified') {
    actions.push({
      label: 'Dispense',
      onClick: () => onDispense(medicationRequest),
      variant: 'contained',
      color: 'primary'
    });
  }
  
  // Additional details
  const details = [
    { label: 'Prescriber', value: medicationRequest.requester?.display || 'Unknown Provider' },
    { label: 'Date', value: medicationRequest.authoredOn ? format(parseISO(medicationRequest.authoredOn), 'MMM d, yyyy') : 'No date' },
    { label: 'Refills', value: `${refillInfo.remaining}/${refillInfo.total}` },
    { label: 'Status', value: pharmacyStatusInfo.label }
  ];

  return (
    <ClinicalResourceCard
      title={medicationName}
      severity={getSeverity()}
      status={statusInfo.label}
      statusColor={statusInfo.color}
      icon={<PharmacyIcon />}
      details={details}
      onEdit={() => onViewDetails(medicationRequest)}
      actions={actions}
      isAlternate={isAlternate}
      metadata={
        <Stack direction="row" spacing={1}>
          <Chip
            label={pharmacyStatusInfo.label}
            size="small"
            color={pharmacyStatusInfo.color}
            sx={{ borderRadius: '4px' }}
          />
          {refillInfo.remaining === 0 && (
            <Chip
              label="No refills"
              size="small"
              color="error"
              sx={{ borderRadius: '4px' }}
            />
          )}
        </Stack>
      }
    />
  );
};

// Refill Request Card Component
const RefillRequestCard = ({ refillRequest, onApprove, onReject, onViewDetails, isAlternate = false }) => {
  const medicationName = getMedicationName(refillRequest);
  const refillInfo = refillRequest.refillInfo || {};
  
  const getPatientName = () => {
    if (refillRequest.patient) {
      const patient = refillRequest.patient;
      return `${patient.name?.[0]?.given?.join(' ') || ''} ${patient.name?.[0]?.family || ''}`.trim();
    }
    return 'Unknown Patient';
  };

  const details = [
    { label: 'Patient', value: getPatientName() },
    { label: 'Request Date', value: refillRequest.authoredOn ? format(parseISO(refillRequest.authoredOn), 'MMM d, yyyy') : 'Unknown' },
    { label: 'Refill #', value: refillInfo.refillNumber || 'N/A' },
    { label: 'Method', value: refillInfo.requestMethod || 'Unknown' }
  ];

  const actions = [
    {
      label: 'Approve',
      onClick: () => onApprove(refillRequest.id),
      color: 'success'
    },
    {
      label: 'Reject',
      onClick: () => onReject(refillRequest.id),
      color: 'error'
    }
  ];

  return (
    <ClinicalResourceCard
      title={medicationName}
      severity={refillInfo.urgent ? 'critical' : 'moderate'}
      status="Refill Request"
      statusColor="warning"
      icon={<RefreshIcon />}
      details={details}
      onEdit={() => onViewDetails(refillRequest)}
      actions={actions}
      isAlternate={isAlternate}
      metadata={
        refillInfo.urgent && (
          <Chip
            label="URGENT"
            size="small"
            color="error"
            sx={{ borderRadius: 1 }}
          />
        )
      }
    />
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
    // Extract medication information from the request
    let medication = null;
    if (medicationRequest.medicationCodeableConcept) {
      medication = medicationRequest.medicationCodeableConcept;
    } else if (medicationRequest.medication?.concept) {
      medication = medicationRequest.medication.concept;
    }
    
    const dispenseData = {
      medicationRequestId: medicationRequest.id,
      medication: medication,
      quantity: parseFloat(quantity),
      unit: medicationRequest.dispenseRequest?.quantity?.unit || 'units',
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
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="sm" 
      fullWidth
      PaperProps={{ sx: { borderRadius: 0 } }}
    >
      <DialogTitle sx={{ fontWeight: 600, borderBottom: 1, borderColor: 'divider' }}>
        Dispense Medication
      </DialogTitle>
      
      <DialogContent sx={{ p: 3 }}>
        <Box>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: 'primary.main' }}>
            {getMedicationName(medicationRequest)}
          </Typography>
          
          {/* Prescription Details */}
          <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', border: 1, borderColor: 'divider', borderRadius: 0 }}>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary" display="block">
                  <strong>Prescriber</strong>
                </Typography>
                <Typography variant="body2">
                  {medicationRequest.requester?.display || 'Unknown'}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary" display="block">
                  <strong>Date Prescribed</strong>
                </Typography>
                <Typography variant="body2">
                  {medicationRequest.authoredOn ? format(parseISO(medicationRequest.authoredOn), 'MMM d, yyyy') : 'Unknown'}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary" display="block">
                  <strong>Dosage</strong>
                </Typography>
                <Typography variant="body2">
                  {medicationRequest.dosageInstruction?.[0]?.text || 'See instructions'}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary" display="block">
                  <strong>Quantity Prescribed</strong>
                </Typography>
                <Typography variant="body2">
                  {medicationRequest.dispenseRequest?.quantity?.value || 'Not specified'} {medicationRequest.dispenseRequest?.quantity?.unit || ''}
                </Typography>
              </Grid>
            </Grid>
          </Box>
          
          <Grid container spacing={3}>
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
                  ),
                  sx: { borderRadius: 0 }
                }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0 } }}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="Lot Number"
                value={lotNumber}
                onChange={(e) => setLotNumber(e.target.value)}
                fullWidth
                required
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0 } }}
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
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0 } }}
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
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0 } }}
              />
            </Grid>
          </Grid>
        </Box>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose} sx={{ borderRadius: 0 }}>Cancel</Button>
        <Button 
          onClick={handleDispense} 
          variant="contained"
          disabled={!quantity || !lotNumber || !expirationDate}
          sx={{ borderRadius: 0 }}
        >
          Dispense Medication
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const PharmacyTab = ({ patientId, onNotificationUpdate, department = 'general' }) => {
  const theme = useTheme();
  const { getPatientResources, isLoading, currentPatient, refreshPatientResources, resources } = useFHIRResource();
  const { publish } = useClinicalWorkflow();
  
  // Enhanced medication hooks
  const { dispenses, createDispense, refreshDispenses } = useMedicationDispense(patientId);
  const { administrations, recordAdministration, refreshAdministrations } = useMedicationAdministration(patientId);
  const [enhancedDispenseDialog, setEnhancedDispenseDialog] = useState(false);
  const [administrationDialogOpen, setAdministrationDialogOpen] = useState(false);
  const [administrationMode, setAdministrationMode] = useState('administer');
  
  const [viewMode, setViewMode] = useState('timeline'); // 'timeline', 'cards', 'table'
  const [tabValue, setTabValue] = useState(0);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPharmacyStatus, setFilterPharmacyStatus] = useState('all');
  const [filterPeriod, setFilterPeriod] = useState('6m'); // all, 1m, 3m, 6m, 1y
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [expandedCards, setExpandedCards] = useState(new Set());
  const [density, setDensity] = useDensity('comfortable');
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
        // Handle error silently to prevent console clutter
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

  // Get all medication-related resources for timeline
  const allMedicationResources = useMemo(() => {
    const allResources = [];
    
    // Add medication requests
    medicationRequests.forEach(req => {
      allResources.push({
        ...req,
        resourceType: 'MedicationRequest',
        date: req.authoredOn || req.meta?.lastUpdated
      });
    });
    
    // Add medication dispenses
    dispenses.forEach(dispense => {
      allResources.push({
        ...dispense,
        resourceType: 'MedicationDispense',
        date: dispense.whenHandedOver || dispense.whenPrepared || dispense.meta?.lastUpdated
      });
    });
    
    // Add medication administrations
    administrations.forEach(admin => {
      allResources.push({
        ...admin,
        resourceType: 'MedicationAdministration',
        date: admin.effectiveDateTime || admin.effectivePeriod?.start || admin.meta?.lastUpdated
      });
    });
    
    // Add medication-related observations (drug levels, etc.)
    const observations = Object.values(resources.Observation || {}).filter(obs => 
      (obs.subject?.reference === `Patient/${patientId}` ||
       obs.patient?.reference === `Patient/${patientId}`) &&
      obs.code?.coding?.some(c => 
        c.system === 'http://loinc.org' && 
        (c.code?.includes('drug') || c.code?.includes('medication'))
      )
    );
    
    observations.forEach(obs => {
      allResources.push({
        ...obs,
        resourceType: 'Observation',
        date: obs.effectiveDateTime || obs.issued || obs.meta?.lastUpdated
      });
    });
    
    return allResources.sort((a, b) => 
      new Date(b.date || 0) - new Date(a.date || 0)
    );
  }, [medicationRequests, dispenses, administrations, resources, patientId]);

  // Enhanced categorization with dispense information
  const categorizedRequests = useMemo(() => {
    const pending = [];
    const verified = [];
    const dispensed = [];
    const completed = [];
    
    medicationRequests.forEach(request => {
      const status = request.status;
      const authoredDate = request.authoredOn;
      
      // Check for related dispenses
      const relatedDispenses = dispenses.filter(dispense => 
        dispense.authorizingPrescription?.some(prescription => 
          prescription.reference === `MedicationRequest/${request.id}`
        )
      );
      
      // Enhanced categorization logic
      if (status === 'completed' || status === 'cancelled' || status === 'stopped') {
        completed.push({ ...request, relatedDispenses });
      } else if (relatedDispenses.some(d => d.status === 'completed')) {
        dispensed.push({ ...request, relatedDispenses });
      } else if (relatedDispenses.some(d => d.status === 'in-progress' || d.status === 'preparation')) {
        verified.push({ ...request, relatedDispenses });
      } else if (authoredDate && isWithinInterval(parseISO(authoredDate), {
        start: subDays(new Date(), 1),
        end: new Date()
      })) {
        pending.push({ ...request, relatedDispenses });
      } else {
        verified.push({ ...request, relatedDispenses });
      }
    });
    
    return { pending, verified, dispensed, completed };
  }, [medicationRequests, dispenses]);

  // Filter requests based on current filters
  const filteredRequests = useMemo(() => {
    let requests = medicationRequests.map(req => {
      // Attach related dispenses to each request
      const relatedDispenses = dispenses.filter(dispense => 
        dispense.authorizingPrescription?.some(prescription => 
          prescription.reference === `MedicationRequest/${req.id}`
        )
      );
      return { ...req, relatedDispenses };
    });
    
    // Filter by medication status
    if (filterStatus !== 'all') {
      requests = requests.filter(req => req.status === filterStatus);
    }
    
    // Filter by pharmacy status
    if (filterPharmacyStatus !== 'all') {
      if (filterPharmacyStatus === 'pending') {
        requests = requests.filter(req => 
          req.authoredOn && isWithinInterval(parseISO(req.authoredOn), {
            start: subDays(new Date(), 1),
            end: new Date()
          })
        );
      } else if (filterPharmacyStatus === 'dispensed') {
        requests = requests.filter(req => 
          req.relatedDispenses.some(d => d.status === 'completed')
        );
      }
    }
    
    // Filter by period
    if (filterPeriod !== 'all') {
      const periodMap = {
        '1m': subMonths(new Date(), 1),
        '3m': subMonths(new Date(), 3),
        '6m': subMonths(new Date(), 6),
        '1y': subMonths(new Date(), 12)
      };
      const startDate = periodMap[filterPeriod];
      requests = requests.filter(req => 
        req.authoredOn && new Date(req.authoredOn) >= startDate
      );
    }
    
    // Filter by search term
    if (searchTerm) {
      requests = requests.filter(req => {
        const medName = getMedicationName(req);
        return medName.toLowerCase().includes(searchTerm.toLowerCase());
      });
    }
    
    // Sort by priority and date
    return requests.sort((a, b) => {
      const dateA = new Date(a.authoredOn || 0);
      const dateB = new Date(b.authoredOn || 0);
      return dateB - dateA;
    });
  }, [medicationRequests, filterStatus, filterPharmacyStatus, filterPeriod, searchTerm, dispenses]);

  // Prepare metrics for MetricsBar
  const pharmacyMetrics = useMemo(() => [
    {
      label: 'Pending Review',
      value: categorizedRequests.pending.length,
      icon: <PendingIcon />,
      color: 'warning',
      severity: categorizedRequests.pending.length > 5 ? 'high' : 'normal'
    },
    {
      label: 'Verified',
      value: categorizedRequests.verified.length,
      icon: <FilledIcon />,
      color: 'info'
    },
    {
      label: 'Ready for Pickup',
      value: categorizedRequests.dispensed.length,
      icon: <DispenseIcon />,
      color: 'primary',
      severity: categorizedRequests.dispensed.length > 10 ? 'moderate' : 'normal'
    },
    {
      label: 'Completed',
      value: categorizedRequests.completed.length,
      icon: <DoneIcon />,
      color: 'success',
      progress: (categorizedRequests.completed.length / Math.max(medicationRequests.length, 1)) * 100
    },
    {
      label: 'Refill Requests',
      value: pendingRefills.length,
      icon: <RefreshIcon />,
      color: pendingRefills.length > 0 ? 'error' : 'default',
      severity: pendingRefills.length > 3 ? 'high' : 'normal'
    }
  ], [categorizedRequests, medicationRequests.length, pendingRefills.length]);

  // Handle card expansion toggle
  const handleToggleCardExpand = useCallback((requestId, expanded) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (expanded) {
        newSet.add(requestId);
      } else {
        newSet.delete(requestId);
      }
      return newSet;
    });
  }, []);

  // Import required icons that may be missing

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
        // Error updating medication lists - handle silently
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
      // Failed to update medication request status - handle silently
      setSnackbar({
        open: true,
        message: 'Failed to update medication request status',
        severity: 'error'
      });
    }
  }, [medicationRequests, refreshPatientResources, publish, patientId]);

  // Enhanced dispensing with MedicationDispense service
  const handleDispense = useCallback(async (medicationDispenseData) => {
    try {
      // Create the MedicationDispense resource using the enhanced service
      const createdDispense = await medicationDispenseService.createMedicationDispense(medicationDispenseData);
      
      // Update the originating MedicationRequest
      const prescriptionId = medicationDispenseData.authorizingPrescription?.[0]?.reference?.split('/')[1];
      if (prescriptionId) {
        const currentRequest = medicationRequests.find(req => req.id === prescriptionId);
        if (currentRequest) {
          // Calculate remaining refills
          const currentRefills = currentRequest.dispenseRequest?.numberOfRepeatsAllowed || 0;
          const remainingRefills = Math.max(0, currentRefills - 1);
          
          const updatedRequest = {
            ...currentRequest,
            status: remainingRefills > 0 ? 'active' : 'completed',
            dispenseRequest: {
              ...currentRequest.dispenseRequest,
              numberOfRepeatsAllowed: remainingRefills
            }
          };
          
          await fhirClient.update('MedicationRequest', prescriptionId, updatedRequest);
        }
      }
      
      // Refresh patient resources and dispenses
      await refreshPatientResources(patientId);
      await refreshDispenses();
      
      // Publish enhanced workflow events
      await publish(CLINICAL_EVENTS.MEDICATION_DISPENSED, {
        medicationDispense: createdDispense,
        prescriptionId: prescriptionId,
        patientId: patientId,
        medicationName: getMedicationName({ 
          medicationCodeableConcept: medicationDispenseData.medicationCodeableConcept,
          medicationReference: medicationDispenseData.medicationReference 
        }),
        timestamp: createdDispense.whenHandedOver || new Date().toISOString()
      });
      
      await publish(CLINICAL_EVENTS.WORKFLOW_NOTIFICATION, {
        workflowType: 'prescription-dispense',
        step: 'completed',
        data: {
          medicationName: getMedicationName({ 
            medicationCodeableConcept: medicationDispenseData.medicationCodeableConcept,
            medicationReference: medicationDispenseData.medicationReference 
          }),
          quantity: medicationDispenseData.quantity,
          daysSupply: medicationDispenseData.daysSupply,
          patientId: patientId,
          timestamp: createdDispense.whenHandedOver || new Date().toISOString()
        }
      });
      
      setSnackbar({
        open: true,
        message: 'Medication dispensed successfully and recorded in FHIR',
        severity: 'success'
      });
      
      setSelectedRequest(null);
      setDispenseDialogOpen(false);
      setEnhancedDispenseDialog(false);
      
    } catch (error) {
      setSnackbar({
        open: true,
        message: `Failed to dispense medication: ${error.message}`,
        severity: 'error'
      });
    }
  }, [patientId, medicationRequests, publish, refreshPatientResources, refreshDispenses]);

  // Handle medication administration
  const handleAdminister = useCallback(async (medicationRequest, mode = 'administer') => {
    setSelectedRequest(medicationRequest);
    setAdministrationMode(mode);
    setAdministrationDialogOpen(true);
  }, []);

  const handleRecordAdministration = useCallback(async (administrationData) => {
    try {
      await recordAdministration(administrationData);
      await refreshAdministrations();
      
      setSnackbar({
        open: true,
        message: 'Medication administration recorded successfully',
        severity: 'success'
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: `Failed to record administration: ${error.message}`,
        severity: 'error'
      });
    }
  }, [recordAdministration, refreshAdministrations]);

  const handleRecordMissedDose = useCallback(async (missedDoseData) => {
    try {
      await recordAdministration(missedDoseData);
      await refreshAdministrations();
      
      setSnackbar({
        open: true,
        message: 'Missed dose recorded successfully',
        severity: 'info'
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: `Failed to record missed dose: ${error.message}`,
        severity: 'error'
      });
    }
  }, [recordAdministration, refreshAdministrations]);

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
      // Error approving refill request - handle silently
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
      // Error rejecting refill request - handle silently
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
      case 5: return []; // MAR tab - handled separately
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
            const medicationName = getMedicationName(request);
            
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
      footer: 'Generated from WintEHR Pharmacy Management System'
    });
  }, [tabValue, currentRequests, patientFilter, currentPatient]);

  if (isLoading) {
    return <ClinicalLoadingState type="pharmacy" />;
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="caption" color="text.secondary">
            {medicationRequests.length} prescriptions • {dispenses.length} dispenses
          </Typography>
          <Stack direction="row" spacing={1}>
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={(e, newMode) => newMode && setViewMode(newMode)}
              size="small"
              sx={{ '& .MuiToggleButton-root': { borderRadius: 0 } }}
            >
              <ToggleButton value="timeline">
                <TimelineIcon sx={{ fontSize: 20 }} />
              </ToggleButton>
              <ToggleButton value="cards">
                <ViewModuleIcon sx={{ fontSize: 20 }} />
              </ToggleButton>
              <ToggleButton value="table">
                <ViewListIcon sx={{ fontSize: 20 }} />
              </ToggleButton>
            </ToggleButtonGroup>
            {currentPatient && patientFilter === 'current' && (
              <Chip
                icon={<PatientIcon />}
                label={`${currentPatient.name?.[0]?.given?.join(' ') || ''} ${currentPatient.name?.[0]?.family || ''}`}
                color="primary"
                variant="outlined"
                size="small"
              />
            )}
          </Stack>
        </Stack>

        {/* Summary Cards */}
        <Stack direction="row" spacing={2} sx={{ mb: 2, overflowX: 'auto' }}>
          <ClinicalSummaryCard
            title="Pending Review"
            value={categorizedRequests.pending.length}
            severity={categorizedRequests.pending.length > 5 ? 'high' : 'normal'}
            icon={<PendingIcon />}
            chips={categorizedRequests.pending.length > 0 ? [
              { label: 'Action needed', color: 'warning' }
            ] : []}
          />
          <ClinicalSummaryCard
            title="Verified"
            value={categorizedRequests.verified.length}
            severity="normal"
            icon={<FilledIcon />}
          />
          <ClinicalSummaryCard
            title="Ready for Pickup"
            value={categorizedRequests.dispensed.length}
            severity={categorizedRequests.dispensed.length > 10 ? 'moderate' : 'normal'}
            icon={<DispenseIcon />}
          />
          <ClinicalSummaryCard
            title="Refill Requests"
            value={pendingRefills.length}
            severity={pendingRefills.length > 3 ? 'high' : 'normal'}
            icon={<RefreshIcon />}
            chips={pendingRefills.length > 0 ? [
              { label: 'Pending', color: 'error' }
            ] : []}
          />
        </Stack>

        {/* Quick Filters */}
        <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
          <TextField
            placeholder="Search medications..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="small"
            sx={{ width: 300 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              )
            }}
          />
          
          <ToggleButtonGroup
            value={filterPharmacyStatus}
            exclusive
            onChange={(e, value) => value && setFilterPharmacyStatus(value)}
            size="small"
            sx={{ '& .MuiToggleButton-root': { borderRadius: 0 } }}
          >
            <ToggleButton value="all">
              All Status
            </ToggleButton>
            <ToggleButton value="pending">
              <PendingIcon fontSize="small" sx={{ mr: 0.5 }} />
              Pending
            </ToggleButton>
            <ToggleButton value="dispensed">
              <DispenseIcon fontSize="small" sx={{ mr: 0.5 }} />
              Dispensed
            </ToggleButton>
          </ToggleButtonGroup>

          <ToggleButtonGroup
            value={filterPeriod}
            exclusive
            onChange={(e, value) => value && setFilterPeriod(value)}
            size="small"
            sx={{ '& .MuiToggleButton-root': { borderRadius: 0 } }}
          >
            <ToggleButton value="1m">1M</ToggleButton>
            <ToggleButton value="3m">3M</ToggleButton>
            <ToggleButton value="6m">6M</ToggleButton>
            <ToggleButton value="1y">1Y</ToggleButton>
            <ToggleButton value="all">All</ToggleButton>
          </ToggleButtonGroup>

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <Select
              value={patientFilter}
              onChange={(e) => setPatientFilter(e.target.value)}
              displayEmpty
              sx={{ borderRadius: 0 }}
            >
              <MenuItem value="current">
                <PatientIcon fontSize="small" sx={{ mr: 0.5 }} />
                Current Patient
              </MenuItem>
              <MenuItem value="all">
                <PeopleIcon fontSize="small" sx={{ mr: 0.5 }} />
                All Patients
              </MenuItem>
            </Select>
          </FormControl>

          <Button
            variant="outlined"
            size="small"
            startIcon={<PrintIcon />}
            onClick={handlePrintQueue}
            sx={{ borderRadius: 0 }}
          >
            Print
          </Button>
        </Stack>
      </Box>

      {/* Main Content Area */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {/* Workflow Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs 
            value={tabValue} 
            onChange={(e, newValue) => setTabValue(newValue)}
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab 
              label="All Medications" 
              icon={<PharmacyIcon />}
              iconPosition="start"
            />
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
              label="Ready to Dispense" 
              icon={
                <Badge badgeContent={categorizedRequests.verified.length} color="info">
                  <FilledIcon />
                </Badge>
              }
              iconPosition="start"
            />
            <Tab 
              label="Dispensed" 
              icon={
                <Badge badgeContent={categorizedRequests.dispensed.length} color="primary">
                  <DispenseIcon />
                </Badge>
              }
              iconPosition="start"
            />
            <Tab 
              label="Refills" 
              icon={
                <Badge badgeContent={pendingRefills.length} color="error">
                  <RefreshIcon />
                </Badge>
              }
              iconPosition="start"
            />
            <Tab 
              label="MAR" 
              icon={<PrescriptionIcon />}
              iconPosition="start"
            />
          </Tabs>
        </Box>

        {/* Content */}
        <Box sx={{ p: 2 }}>
          {tabValue === 5 ? (
            // Render MAR (Medication Administration Record)
            <MedicationAdministrationRecord
              patientId={patientId}
              onAdministrationComplete={(type, medicationRequestId) => {
                setSnackbar({
                  open: true,
                  message: `Medication ${type} recorded successfully`,
                  severity: type === 'administered' ? 'success' : 'info'
                });
              }}
              currentUser={{ id: 'current-user', name: 'Current User' }}
            />
          ) : viewMode === 'timeline' ? (
            // Timeline view - simplified without ResourceTimeline component
            <Box>
              <Typography variant="h6" gutterBottom sx={{ p: 2 }}>
                Medication Timeline
              </Typography>
              <List>
                {allMedicationResources
                  .filter(r => {
                    // Apply tab filters
                    if (tabValue === 0) return true; // All medications
                    
                    if (r.resourceType === 'MedicationRequest') {
                      switch (tabValue) {
                        case 1: return categorizedRequests.pending.some(p => p.id === r.id);
                        case 2: return categorizedRequests.verified.some(v => v.id === r.id);
                        case 3: return categorizedRequests.dispensed.some(d => d.id === r.id);
                        case 4: return pendingRefills.some(ref => ref.id === r.id);
                        default: return true;
                      }
                    }
                    return true; // Show all related resources
                  })
                  .map((resource, index) => {
                    const resourceTypeConfig = {
                      MedicationRequest: { icon: <PrescriptionIcon />, color: 'primary.main', label: 'Prescription' },
                      MedicationDispense: { icon: <DispenseIcon />, color: 'success.main', label: 'Dispensed' },
                      MedicationAdministration: { icon: <PharmacyIcon />, color: 'info.main', label: 'Administered' },
                      Observation: { icon: <InfoIcon />, color: 'warning.main', label: 'Lab Result' }
                    };
                    const config = resourceTypeConfig[resource.resourceType] || { icon: <InfoIcon />, color: 'grey.500', label: resource.resourceType };
                    
                    return (
                      <ListItem
                        key={`${resource.resourceType}-${resource.id}`}
                        button
                        onClick={() => {
                          if (resource.resourceType === 'MedicationRequest') {
                            handleViewDetails(resource);
                          }
                        }}
                        sx={{
                          mb: 1,
                          border: 1,
                          borderColor: 'divider',
                          borderRadius: 0,
                          borderLeft: 4,
                          borderLeftColor: config.color,
                          backgroundColor: index % 2 === 0 ? 'grey.50' : 'background.paper',
                          '&:hover': {
                            backgroundColor: 'action.hover',
                            transform: 'translateX(2px)',
                            transition: 'all 0.2s'
                          }
                        }}
                      >
                        <ListItemIcon>
                          {config.icon}
                        </ListItemIcon>
                        <ListItemText
                          primary={getMedicationName(resource)}
                          secondary={
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Typography variant="caption">
                                {config.label}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                • {resource.date ? format(parseISO(resource.date), 'MMM d, yyyy h:mm a') : 'No date'}
                              </Typography>
                            </Stack>
                          }
                        />
                        <ListItemSecondaryAction>
                          <Chip
                            label={resource.status || 'Unknown'}
                            size="small"
                            sx={{ borderRadius: 1 }}
                          />
                        </ListItemSecondaryAction>
                      </ListItem>
                    );
                  })}
              </List>
            </Box>
          ) : viewMode === 'cards' ? (
            // Cards view
            <Box>
              {(() => {
                const requests = tabValue === 0 ? filteredRequests :
                                 tabValue === 1 ? categorizedRequests.pending :
                                 tabValue === 2 ? categorizedRequests.verified :
                                 tabValue === 3 ? categorizedRequests.dispensed :
                                 tabValue === 4 ? pendingRefills : [];
                
                if (requests.length === 0) {
                  return (
                    <ClinicalEmptyState
                      message="No medications in this category"
                      icon={<PharmacyIcon />}
                    />
                  );
                }
                
                return (
                  <Stack spacing={1}>
                    {requests.map((request, index) => (
                      <Box key={request.id}>
                        {tabValue === 4 ? (
                          <RefillRequestCard
                            refillRequest={request}
                            onApprove={handleApproveRefill}
                            onReject={handleRejectRefill}
                            onViewDetails={handleViewDetails}
                            isAlternate={index % 2 === 1}
                          />
                        ) : (
                          <MedicationRequestCard
                            medicationRequest={request}
                            onStatusChange={handleStatusChange}
                            onDispense={handleOpenDispenseDialog}
                            onViewDetails={handleViewDetails}
                            density={density}
                            expanded={expandedCards.has(request.id)}
                            onToggleExpand={handleToggleCardExpand}
                            relatedDispenses={request.relatedDispenses || []}
                            isAlternate={index % 2 === 1}
                          />
                        )}
                      </Box>
                    ))}
                  </Stack>
                );
              })()}
            </Box>
          ) : (
            // Table view using ClinicalDataGrid
            <ClinicalDataGrid
              columns={[
                {
                  field: 'medication',
                  headerName: 'Medication',
                  flex: 2,
                  renderCell: (params) => (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <PharmacyIcon fontSize="small" color="primary" />
                      <Typography variant="body2">
                        {getMedicationName(params.row)}
                      </Typography>
                    </Stack>
                  )
                },
                {
                  field: 'dosage',
                  headerName: 'Dosage',
                  flex: 1.5,
                  valueGetter: (params) => getMedicationDosageDisplay(params.row)
                },
                {
                  field: 'status',
                  headerName: 'Status',
                  flex: 1,
                  renderCell: (params) => {
                    const statusInfo = MEDICATION_STATUSES[params.row.status] || MEDICATION_STATUSES.unknown;
                    return (
                      <Chip
                        icon={statusInfo.icon}
                        label={statusInfo.label}
                        size="small"
                        color={statusInfo.color}
                        sx={{ borderRadius: 1 }}
                      />
                    );
                  }
                },
                {
                  field: 'refills',
                  headerName: 'Refills',
                  flex: 0.8,
                  renderCell: (params) => {
                    const totalRefills = params.row.dispenseRequest?.numberOfRepeatsAllowed || 0;
                    const usedRefills = params.row.relatedDispenses?.filter(d => d.status === 'completed').length || 0;
                    const remaining = Math.max(0, totalRefills - usedRefills + 1);
                    return (
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <Typography variant="body2">
                          {remaining}/{totalRefills}
                        </Typography>
                        {remaining === 0 && (
                          <AlertIcon fontSize="small" color="error" />
                        )}
                      </Stack>
                    );
                  }
                },
                {
                  field: 'prescriber',
                  headerName: 'Prescriber',
                  flex: 1.5,
                  valueGetter: (params) => params.row.requester?.display || 'Unknown'
                },
                {
                  field: 'date',
                  headerName: 'Date',
                  flex: 1,
                  valueGetter: (params) => params.row.authoredOn || '',
                  valueFormatter: (params) => 
                    params.value ? format(parseISO(params.value), 'MMM d, yyyy') : 'N/A'
                },
                {
                  field: 'actions',
                  headerName: 'Actions',
                  flex: 1,
                  sortable: false,
                  align: 'right',
                  renderCell: (params) => (
                    <Stack direction="row" spacing={1}>
                      {params.row.status === 'active' && 
                       !params.row.relatedDispenses?.some(d => d.status === 'completed') && (
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDispenseDialog(params.row);
                          }}
                          title="Dispense"
                        >
                          <DispenseIcon fontSize="small" />
                        </IconButton>
                      )}
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewDetails(params.row);
                        }}
                        title="View details"
                      >
                        <InfoIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  )
                }
              ]}
              rows={(() => {
                const requests = tabValue === 0 ? filteredRequests :
                                 tabValue === 1 ? categorizedRequests.pending :
                                 tabValue === 2 ? categorizedRequests.verified :
                                 tabValue === 3 ? categorizedRequests.dispensed :
                                 tabValue === 4 ? pendingRefills : [];
                return requests.map(r => ({ ...r, id: r.id || `med-${Math.random()}` }));
              })()}
              onRowClick={(params) => handleViewDetails(params.row)}
              pageSize={10}
              initialSort={[{ field: 'date', sort: 'desc' }]}
            />
          )}
        </Box>
      </Box>

      {/* Removed Floating Action Button - functionality moved to header buttons */}

      {/* Enhanced Dispense Dialog */}
      <EnhancedDispenseDialog
        open={dispenseDialogOpen}
        onClose={() => setDispenseDialogOpen(false)}
        medicationRequest={selectedRequest}
        onDispense={handleDispense}
      />

      {/* Details Dialog */}
      <Dialog
        open={detailsDialogOpen}
        onClose={() => setDetailsDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Medication Request Details</DialogTitle>
        <DialogContent>
          {selectedRequest && (
            <Box sx={{ mt: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">Medication</Typography>
                  <Typography variant="body1">{getMedicationName(selectedRequest)}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">Status</Typography>
                  <Typography variant="body1">{selectedRequest.status || 'Unknown'}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">Priority</Typography>
                  <Typography variant="body1">{selectedRequest.priority || 'routine'}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">Authored Date</Typography>
                  <Typography variant="body1">
                    {selectedRequest.authoredOn ? format(parseISO(selectedRequest.authoredOn), 'MMM d, yyyy h:mm a') : 'Unknown'}
                  </Typography>
                </Grid>
                {selectedRequest.dosageInstruction?.[0] && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="text.secondary">Dosage Instructions</Typography>
                    <Typography variant="body1">{getMedicationDosageDisplay(selectedRequest)}</Typography>
                  </Grid>
                )}
                {selectedRequest.dispenseRequest && (
                  <>
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" color="text.secondary">Quantity</Typography>
                      <Typography variant="body1">
                        {selectedRequest.dispenseRequest.quantity?.value || 'Not specified'} {selectedRequest.dispenseRequest.quantity?.unit || ''}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" color="text.secondary">Refills Allowed</Typography>
                      <Typography variant="body1">{selectedRequest.dispenseRequest.numberOfRepeatsAllowed || 0}</Typography>
                    </Grid>
                  </>
                )}
                {selectedRequest.reasonCode?.[0] && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="text.secondary">Reason</Typography>
                    <Typography variant="body1">{selectedRequest.reasonCode[0].text || 'Not specified'}</Typography>
                  </Grid>
                )}
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsDialogOpen(false)} sx={{ borderRadius: 0 }}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Administration Dialog */}
      <AdministrationDialog
        open={administrationDialogOpen}
        onClose={() => setAdministrationDialogOpen(false)}
        medicationRequest={selectedRequest}
        patientId={patientId}
        mode={administrationMode}
        onAdminister={handleRecordAdministration}
        onMissedDose={handleRecordMissedDose}
        currentUser={{ id: 'current-user', name: 'Current User' }} // In real app, get from auth context
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