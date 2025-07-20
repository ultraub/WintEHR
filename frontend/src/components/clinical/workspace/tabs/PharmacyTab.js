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
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { format, parseISO, isWithinInterval, subDays, addDays, subMonths } from 'date-fns';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import { printDocument } from '../../../../core/export/printUtils';
import { getMedicationDosageDisplay, getMedicationName } from '../../../../core/fhir/utils/medicationDisplayUtils';
import { fhirClient } from '../../../../services/fhirClient';
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
import ClinicalCard from '../../ui/ClinicalCard';
import ResourceTimeline from '../../ui/ResourceTimeline';
import MetricsBar from '../../ui/MetricsBar';
import SmartTable from '../../ui/SmartTable';
import { ViewControls, useDensity } from '../../ui/DensityControl';
import TrendSparkline from '../../ui/TrendSparkline';
import QuickActionFAB, { ContextualFAB } from '../../ui/QuickActionFAB';
import { motion, AnimatePresence } from 'framer-motion';

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

// Enhanced Medication Request Card Component with new UI components
const MedicationRequestCard = ({ medicationRequest, onStatusChange, onDispense, onViewDetails, density = 'comfortable', expanded = false, onToggleExpand, relatedDispenses = [] }) => {
  const theme = useTheme();
  const [localExpanded, setLocalExpanded] = useState(expanded);
  
  const handleToggleExpand = () => {
    const newExpanded = !localExpanded;
    setLocalExpanded(newExpanded);
    onToggleExpand?.(medicationRequest.id, newExpanded);
  };
  
  const getMedicationNameLocal = () => {
    return getMedicationName(medicationRequest);
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
  const medicationMetrics = [
    {
      label: 'Refills',
      value: `${refillInfo.remaining}/${refillInfo.total}`,
      color: refillInfo.remaining === 0 ? 'error' : 'default',
      icon: <RefreshIcon fontSize="small" />
    },
    {
      label: 'Quantity',
      value: medicationRequest.dispenseRequest?.quantity?.value || 'N/A',
      sublabel: medicationRequest.dispenseRequest?.quantity?.unit
    },
    {
      label: 'Days Supply',
      value: medicationRequest.dispenseRequest?.expectedSupplyDuration?.value || 'N/A',
      sublabel: 'days'
    }
  ];

  // Generate dispense history sparkline data
  const dispenseHistory = relatedDispenses
    .filter(d => d.whenHandedOver)
    .map(d => ({
      date: d.whenHandedOver,
      value: d.quantity?.value || 0
    }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <ClinicalCard
        severity={getSeverity()}
        title={
          <Stack direction="row" spacing={1} alignItems="center">
            <PharmacyIcon color="primary" />
            <Typography variant={density === 'compact' ? 'body1' : 'h6'}>
              {getMedicationNameLocal()}
            </Typography>
          </Stack>
        }
        subtitle={getDosageInstruction()}
        status={
          <Stack direction="row" spacing={1}>
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
        expandable
        expanded={localExpanded}
        onToggleExpand={handleToggleExpand}
        metrics={density !== 'compact' ? medicationMetrics : undefined}
        trend={dispenseHistory.length > 1 ? (
          <TrendSparkline
            data={dispenseHistory.map(d => d.value)}
            width={80}
            height={30}
            showLastValue
            color="primary"
          />
        ) : null}
        actions={[
          ...(pharmacyStatus === 'pending' ? [{
            label: 'Verify',
            icon: <FilledIcon />,
            onClick: () => onStatusChange(medicationRequest.id, 'verified'),
            color: 'primary'
          }] : []),
          ...(pharmacyStatus === 'verified' ? [{
            label: 'Dispense',
            icon: <DispenseIcon />,
            onClick: () => onDispense(medicationRequest),
            color: 'success',
            variant: 'contained'
          }] : []),
          {
            label: 'Details',
            icon: <InfoIcon />,
            onClick: () => onViewDetails(medicationRequest)
          },
          {
            label: 'Print Label',
            icon: <PrintIcon />,
            onClick: () => {}
          }
        ]}
        sx={{ mb: density === 'compact' ? 1 : 2 }}
      >
        <Stack spacing={2}>
          <Grid container spacing={density === 'compact' ? 1 : 2}>
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
                  format(parseISO(medicationRequest.authoredOn), 'MMM d, yyyy') : 
                  'No date'}
              </Typography>
            </Grid>
          </Grid>

          <Collapse in={localExpanded}>
            <Box sx={{ pt: 2 }}>
              {/* Refill History */}
              {refillInfo.lastFilled && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Last Filled
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {format(parseISO(refillInfo.lastFilled), 'MMM d, yyyy h:mm a')}
                  </Typography>
                </Box>
              )}

              {/* Dispense History */}
              {relatedDispenses.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Dispense History
                  </Typography>
                  <List dense>
                    {relatedDispenses.slice(0, 3).map((dispense, index) => (
                      <ListItem key={dispense.id || index} sx={{ px: 0 }}>
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <DispenseIcon fontSize="small" color="action" />
                        </ListItemIcon>
                        <ListItemText
                          primary={`${dispense.quantity?.value || 'N/A'} ${dispense.quantity?.unit || 'units'}`}
                          secondary={dispense.whenHandedOver ? 
                            format(parseISO(dispense.whenHandedOver), 'MMM d, yyyy') : 
                            'Date unknown'
                          }
                        />
                        <Chip
                          label={dispense.status}
                          size="small"
                          variant="outlined"
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}

              {/* Notes */}
              {medicationRequest.note && medicationRequest.note.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Notes
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {medicationRequest.note[0].text}
                  </Typography>
                </Box>
              )}
            </Box>
          </Collapse>
        </Stack>
      </ClinicalCard>
    </motion.div>
  );
};

// Refill Request Card Component
const RefillRequestCard = ({ refillRequest, onApprove, onReject, onViewDetails }) => {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState(null);

  const getMedicationNameLocal = () => {
    return getMedicationName(refillRequest);
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
              {getMedicationNameLocal()}
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
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Dispense Medication
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <Typography variant="h6" gutterBottom>
            {getMedicationName(medicationRequest)}
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

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Box>
            <Typography variant="h5" fontWeight="bold">
              Pharmacy Management
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {medicationRequests.length} prescriptions • {dispenses.length} dispenses
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <ViewControls
              density={density}
              onDensityChange={setDensity}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              showViewMode
              availableViews={['timeline', 'cards', 'table']}
              size="small"
            />
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

        {/* Metrics Bar */}
        <MetricsBar 
          metrics={pharmacyMetrics} 
          density={density}
          animate
        />

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
            // Timeline view
            <Box sx={{ height: 'calc(100vh - 400px)', minHeight: 500 }}>
              <ResourceTimeline
                resources={allMedicationResources.filter(r => {
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
                })}
                onResourceClick={(resource) => {
                  if (resource.resourceType === 'MedicationRequest') {
                    handleViewDetails(resource);
                  }
                }}
                height={600}
                showLegend
                showRangeSelector
                enableZoom
                groupByType
              />
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
                    <Alert severity="info">
                      No medications in this category
                    </Alert>
                  );
                }
                
                return (
                  <AnimatePresence>
                    {requests.map((request, index) => (
                      <motion.div
                        key={request.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                      >
                        {tabValue === 4 ? (
                          <RefillRequestCard
                            refillRequest={request}
                            onApprove={handleApproveRefill}
                            onReject={handleRejectRefill}
                            onViewDetails={handleViewDetails}
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
                          />
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                );
              })()}
            </Box>
          ) : (
            // Table view
            <SmartTable
              columns={[
                {
                  id: 'medication',
                  label: 'Medication',
                  renderCell: (value, row) => (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <PharmacyIcon fontSize="small" color="primary" />
                      <Typography variant="body2">
                        {getMedicationName(row)}
                      </Typography>
                    </Stack>
                  )
                },
                {
                  id: 'dosage',
                  label: 'Dosage',
                  renderCell: (value, row) => (
                    <Typography variant="body2" noWrap>
                      {getMedicationDosageDisplay(row)}
                    </Typography>
                  )
                },
                {
                  id: 'status',
                  label: 'Status',
                  renderCell: (value, row) => {
                    const statusInfo = MEDICATION_STATUSES[row.status] || MEDICATION_STATUSES.unknown;
                    return (
                      <Chip
                        icon={statusInfo.icon}
                        label={statusInfo.label}
                        size="small"
                        color={statusInfo.color}
                      />
                    );
                  }
                },
                {
                  id: 'refills',
                  label: 'Refills',
                  renderCell: (value, row) => {
                    const totalRefills = row.dispenseRequest?.numberOfRepeatsAllowed || 0;
                    const usedRefills = row.relatedDispenses?.filter(d => d.status === 'completed').length || 0;
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
                  id: 'prescriber',
                  label: 'Prescriber',
                  renderCell: (value, row) => (
                    <Typography variant="body2" noWrap>
                      {row.requester?.display || 'Unknown'}
                    </Typography>
                  )
                },
                {
                  id: 'date',
                  label: 'Date',
                  renderCell: (value, row) => (
                    <Typography variant="body2">
                      {row.authoredOn ? 
                        format(parseISO(row.authoredOn), 'MMM d, yyyy') : 
                        'N/A'
                      }
                    </Typography>
                  )
                },
                {
                  id: 'actions',
                  label: 'Actions',
                  align: 'right',
                  renderCell: (value, row) => (
                    <Stack direction="row" spacing={1}>
                      {row.status === 'active' && !row.relatedDispenses?.some(d => d.status === 'completed') && (
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleOpenDispenseDialog(row)}
                          title="Dispense"
                        >
                          <DispenseIcon fontSize="small" />
                        </IconButton>
                      )}
                      <IconButton
                        size="small"
                        onClick={() => handleViewDetails(row)}
                        title="View details"
                      >
                        <InfoIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  )
                }
              ]}
              data={(() => {
                const requests = tabValue === 0 ? filteredRequests :
                                 tabValue === 1 ? categorizedRequests.pending :
                                 tabValue === 2 ? categorizedRequests.verified :
                                 tabValue === 3 ? categorizedRequests.dispensed :
                                 tabValue === 4 ? pendingRefills : [];
                return requests;
              })()}
              density={density}
              sortable
              filterable
              onRowClick={(row) => handleViewDetails(row)}
              emptyMessage="No medications found"
            />
          )}
        </Box>
      </Box>

      {/* Floating Action Button */}
      <ContextualFAB
        currentModule="pharmacy"
        primaryAction={{
          icon: <DispenseIcon />,
          onClick: () => {
            if (categorizedRequests.verified.length > 0) {
              handleOpenDispenseDialog(categorizedRequests.verified[0]);
            }
          }
        }}
        actions={[
          {
            icon: <PrescriptionIcon />,
            name: 'New Prescription',
            onClick: () => {}
          },
          {
            icon: <RefreshIcon />,
            name: 'Process Refill',
            onClick: () => {}
          },
          {
            icon: <InventoryIcon />,
            name: 'Check Inventory',
            onClick: () => {}
          },
          {
            icon: <PrintIcon />,
            name: 'Print Queue',
            onClick: handlePrintQueue
          }
        ]}
        position="bottom-right"
        color="primary"
      />

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
          <Button onClick={() => setDetailsDialogOpen(false)}>Close</Button>
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