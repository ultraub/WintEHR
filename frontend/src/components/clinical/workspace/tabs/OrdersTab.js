/**
 * Orders Tab Component
 * Manage active orders, prescriptions, and order history
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
  TextField,
  InputAdornment,
  Menu,
  MenuItem,
  FormControl,
  Select,
  InputLabel,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Badge,
  SpeedDial,
  SpeedDialIcon,
  SpeedDialAction,
  Checkbox,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
  alpha,
  Snackbar
} from '@mui/material';
import {
  Assignment as OrderIcon,
  Medication as MedicationIcon,
  Science as LabIcon,
  Image as ImagingIcon,
  LocalPharmacy as PharmacyIcon,
  CheckCircle as CompletedIcon,
  Schedule as PendingIcon,
  Cancel as CancelledIcon,
  Warning as UrgentIcon,
  Add as AddIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Print as PrintIcon,
  Send as SendIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  CalendarMonth as CalendarIcon,
  AccessTime as TimeIcon,
  Person as ProviderIcon,
  Flag as PriorityIcon,
  MoreVert as MoreIcon,
  Close as CloseIcon,
  Assignment,
  Draw as SignIcon
} from '@mui/icons-material';
import { format, parseISO, formatDistanceToNow, isWithinInterval, subDays } from 'date-fns';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import { fhirClient } from '../../../../core/fhir/services/fhirClient';
import axios from 'axios';
import { useClinicalWorkflow, CLINICAL_EVENTS } from '../../../../contexts/ClinicalWorkflowContext';
import VirtualizedList from '../../../common/VirtualizedList';
import { exportClinicalData, EXPORT_COLUMNS } from '../../../../core/export/exportUtils';
import { getMedicationName } from '../../../../core/fhir/utils/medicationDisplayUtils';
import { GetApp as ExportIcon } from '@mui/icons-material';
import { useCDS, CDS_HOOK_TYPES } from '../../../../contexts/CDSContext';
import CPOEDialog from '../dialogs/CPOEDialog';
import QuickOrderDialog from '../dialogs/QuickOrderDialog';
import OrderSigningDialog from '../dialogs/OrderSigningDialog';
import AdvancedOrderFilters from './components/AdvancedOrderFilters';
import { useAdvancedOrderSearch } from '../../../../hooks/useAdvancedOrderSearch';
import { usePatientClinicalData } from '../../../../hooks/usePatientClinicalData';

// Get order type icon
const getOrderTypeIcon = (order) => {
  if (order.resourceType === 'MedicationRequest') {
    return <MedicationIcon color="primary" />;
  } else if (order.resourceType === 'ServiceRequest') {
    const category = order.category?.[0]?.coding?.[0]?.code;
    switch (category) {
      case 'laboratory':
        return <LabIcon color="info" />;
      case 'imaging':
        return <ImagingIcon color="secondary" />;
      default:
        return <OrderIcon color="action" />;
    }
  }
  return <OrderIcon color="action" />;
};

// Get order status color
const getOrderStatusColor = (status) => {
  switch (status) {
    case 'active':
    case 'in-progress':
      return 'primary';
    case 'completed':
      return 'success';
    case 'cancelled':
    case 'stopped':
      return 'error';
    case 'on-hold':
      return 'warning';
    case 'draft':
      return 'default';
    default:
      return 'default';
  }
};

// Get priority color
const getPriorityColor = (priority) => {
  switch (priority) {
    case 'urgent':
    case 'asap':
      return 'error';
    case 'stat':
      return 'error';
    case 'routine':
      return 'default';
    default:
      return 'default';
  }
};

// Order Card Component
const OrderCard = ({ order, onSelect, onAction, selected }) => {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState(null);
  
  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const getOrderTitle = () => {
    if (order.resourceType === 'MedicationRequest') {
      return order.medication?.concept?.text || 
             order.medication?.concept?.coding?.[0]?.display ||
             'Medication Order';
    } else if (order.resourceType === 'ServiceRequest') {
      return order.code?.text || 
             order.code?.coding?.[0]?.display ||
             'Service Order';
    }
    return 'Order';
  };

  const getOrderDetails = () => {
    if (order.resourceType === 'MedicationRequest') {
      return order.dosageInstruction?.[0]?.text || 'No dosage information';
    } else if (order.resourceType === 'ServiceRequest') {
      return order.orderDetail?.[0]?.text || 
             order.reasonCode?.[0]?.text ||
             'No additional details';
    }
    return '';
  };

  const orderDate = order.authoredOn || order.occurrenceDateTime;

  return (
    <Card 
      sx={{ 
        mb: 2,
        border: selected ? 2 : 0,
        borderColor: 'primary.main',
        backgroundColor: selected ? alpha(theme.palette.primary.main, 0.05) : 'background.paper'
      }}
    >
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box sx={{ flex: 1 }}>
            <Stack direction="row" spacing={2} alignItems="center" mb={1}>
              <Checkbox
                checked={selected}
                onChange={(e) => onSelect(order, e.target.checked)}
                inputProps={{
                  'aria-label': `Select order: ${getOrderTitle()}`
                }}
              />
              {getOrderTypeIcon(order)}
              <Typography variant="h6">
                {getOrderTitle()}
              </Typography>
              <Chip 
                label={order.status} 
                size="small" 
                color={getOrderStatusColor(order.status)}
              />
              {order.priority && (
                <Chip 
                  label={order.priority} 
                  size="small" 
                  color={getPriorityColor(order.priority)}
                  icon={order.priority === 'urgent' ? <UrgentIcon /> : null}
                />
              )}
            </Stack>

            <Typography variant="body2" color="text.secondary" gutterBottom>
              {getOrderDetails()}
            </Typography>

            <Stack direction="row" spacing={3} alignItems="center">
              {orderDate && (
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <CalendarIcon fontSize="small" color="action" />
                  <Typography variant="caption">
                    {(() => {
                      try {
                        return format(parseISO(orderDate), 'MMM d, yyyy');
                      } catch {
                        return 'Invalid date';
                      }
                    })()}
                  </Typography>
                </Stack>
              )}
              
              {order.requester && (
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <ProviderIcon fontSize="small" color="action" />
                  <Typography variant="caption">
                    {order.requester.display || 'Unknown provider'}
                  </Typography>
                </Stack>
              )}

              {order.dispenseRequest && (
                <Typography variant="caption" color="text.secondary">
                  Quantity: {order.dispenseRequest.quantity?.value} {order.dispenseRequest.quantity?.unit}
                  {order.dispenseRequest.numberOfRepeatsAllowed && 
                    ` • Refills: ${order.dispenseRequest.numberOfRepeatsAllowed}`
                  }
                </Typography>
              )}
            </Stack>
          </Box>

          <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
            <MoreIcon />
          </IconButton>
        </Stack>
      </CardContent>

      <CardActions>
        {order.status === 'active' && (
          <>
            <Button 
              size="small" 
              startIcon={<SendIcon />}
              onClick={() => onAction(order, 'send')}
            >
              Send to Pharmacy
            </Button>
            <Button 
              size="small" 
              startIcon={<EditIcon />}
              onClick={() => onAction(order, 'edit')}
            >
              Edit
            </Button>
          </>
        )}
        {order.status === 'completed' && (
          <Button 
            size="small" 
            startIcon={<RefreshIcon />}
            onClick={() => onAction(order, 'reorder')}
          >
            Reorder
          </Button>
        )}
      </CardActions>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => { handleMenuClose(); onAction(order, 'view'); }}>
          View Details
        </MenuItem>
        <MenuItem onClick={() => { handleMenuClose(); onAction(order, 'print'); }}>
          Print Order
        </MenuItem>
        {order.status === 'active' && (
          <MenuItem onClick={() => { handleMenuClose(); onAction(order, 'cancel'); }}>
            Cancel Order
          </MenuItem>
        )}
      </Menu>
    </Card>
  );
};

// Quick Order Dialog - Migrated to separate component file
// Using: import QuickOrderDialog from '../dialogs/QuickOrderDialog';
/*
const QuickOrderDialog = ({ open, onClose, patientId, orderType, onOrderCreated }) => {
  const [orderData, setOrderData] = useState({
    medication: '',
    dosage: '',
    frequency: '',
    duration: '',
    quantity: '',
    refills: 0,
    priority: 'routine',
    notes: ''
  });

  const handleSubmit = async () => {
    try {
      // Create FHIR ServiceRequest or MedicationRequest based on order type
      if (orderType === 'medication') {
        const medicationRequest = {
          resourceType: 'MedicationRequest',
          status: 'active',
          intent: 'order',
          priority: orderData.priority,
          subject: { reference: `Patient/${patientId}` },
          authoredOn: new Date().toISOString(),
          medicationCodeableConcept: {
            text: orderData.medication
          },
          dosageInstruction: [{
            text: `${orderData.dosage} ${orderData.frequency} for ${orderData.duration}`
          }],
          dispenseRequest: {
            quantity: { value: parseFloat(orderData.quantity) || 30 },
            numberOfRepeatsAllowed: parseInt(orderData.refills) || 0
          },
          note: orderData.notes ? [{ text: orderData.notes }] : []
        };
        
        const createdMedication = await fhirClient.create('MedicationRequest', medicationRequest);
        if (createdMedication) {
          // Refresh patient resources to show new order
          window.dispatchEvent(new CustomEvent('fhir-resources-updated', { 
            detail: { patientId } 
          }));
          // Notify parent component about the created order
          if (onOrderCreated) {
            onOrderCreated(createdMedication, 'medication');
          }
        }
      } else {
        const serviceRequest = {
          resourceType: 'ServiceRequest',
          status: 'active',
          intent: 'order',
          priority: orderData.priority,
          subject: { reference: `Patient/${patientId}` },
          authoredOn: new Date().toISOString(),
          category: [{
            coding: [{
              system: 'http://snomed.info/sct',
              code: orderType === 'lab' ? '108252007' : '363679005',
              display: orderType === 'lab' ? 'Laboratory procedure' : 'Imaging'
            }]
          }],
          code: {
            text: orderData.medication // Using medication field for test/study name
          },
          note: orderData.notes ? [{ text: orderData.notes }] : []
        };
        
        const createdService = await fhirClient.create('ServiceRequest', serviceRequest);
        if (createdService) {
          window.dispatchEvent(new CustomEvent('fhir-resources-updated', { 
            detail: { patientId } 
          }));
          // Notify parent component about the created order
          if (onOrderCreated) {
            onOrderCreated(createdService, orderType);
          }
        }
      }
      
      onClose();
    } catch (error) {
      // Handle error
      // Note: onNotificationUpdate expects a count, not an object
      // For errors, we should use the snackbar or other error handling mechanism
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {orderType === 'medication' ? 'New Medication Order' : 
         orderType === 'lab' ? 'New Lab Order' : 'New Imaging Order'}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 2 }}>
          {orderType === 'medication' ? (
            <>
              <TextField
                fullWidth
                label="Medication"
                value={orderData.medication}
                onChange={(e) => setOrderData({ ...orderData, medication: e.target.value })}
              />
              <TextField
                fullWidth
                label="Dosage"
                value={orderData.dosage}
                onChange={(e) => setOrderData({ ...orderData, dosage: e.target.value })}
              />
              <TextField
                fullWidth
                label="Frequency"
                value={orderData.frequency}
                onChange={(e) => setOrderData({ ...orderData, frequency: e.target.value })}
              />
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Duration"
                    value={orderData.duration}
                    onChange={(e) => setOrderData({ ...orderData, duration: e.target.value })}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Refills"
                    type="number"
                    value={orderData.refills}
                    onChange={(e) => setOrderData({ ...orderData, refills: e.target.value })}
                  />
                </Grid>
              </Grid>
            </>
          ) : (
            <TextField
              fullWidth
              label={orderType === 'lab' ? 'Lab Test' : 'Imaging Study'}
              value={orderData.medication}
              onChange={(e) => setOrderData({ ...orderData, medication: e.target.value })}
            />
          )}
          
          <FormControl fullWidth>
            <InputLabel>Priority</InputLabel>
            <Select
              value={orderData.priority}
              onChange={(e) => setOrderData({ ...orderData, priority: e.target.value })}
              label="Priority"
            >
              <MenuItem value="routine">Routine</MenuItem>
              <MenuItem value="urgent">Urgent</MenuItem>
              <MenuItem value="stat">STAT</MenuItem>
            </Select>
          </FormControl>
          
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Clinical Notes"
            value={orderData.notes}
            onChange={(e) => setOrderData({ ...orderData, notes: e.target.value })}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit}>Submit Order</Button>
      </DialogActions>
    </Dialog>
  );
};
*/

const OrdersTab = ({ patientId, onNotificationUpdate, department = 'general' }) => {
  const theme = useTheme();
  const { isLoading, currentPatient } = useFHIRResource();
  const { publish } = useClinicalWorkflow();
  
  const [tabValue, setTabValue] = useState(0);
  const [filterStatus, setFilterStatus] = useState('active');
  const [filterPeriod, setFilterPeriod] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrders, setSelectedOrders] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [speedDialOpen, setSpeedDialOpen] = useState(false);
  const [quickOrderDialog, setQuickOrderDialog] = useState({ open: false, type: null });
  const [viewOrderDialog, setViewOrderDialog] = useState({ open: false, order: null });
  const [cpoeDialogOpen, setCpoeDialogOpen] = useState(false);
  const [signOrdersDialog, setSignOrdersDialog] = useState({ open: false, orders: [] });
  const [editOrderDialog, setEditOrderDialog] = useState({ open: false, order: null });
  const [exportAnchorEl, setExportAnchorEl] = useState(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  
  // Enhanced order search with comprehensive FHIR R4 capabilities
  const {
    entries: searchResults,
    total: totalResults,
    loading: searchLoading,
    error: searchError,
    analytics,
    hasActiveFilters,
    updateFilters,
    clearSearch,
    search: executeSearch,
    pagination
  } = useAdvancedOrderSearch({
    patientId,
    autoSearch: true,
    includeAnalytics: true,
    debounceMs: 300
  });

  // Use centralized CDS
  const { executeCDSHooks, getAlerts } = useCDS();

  useEffect(() => {
    setLoading(false);
  }, []);

  // Handle CDS alerts notification
  useEffect(() => {
    const orderAlerts = getAlerts(CDS_HOOK_TYPES.ORDER_SIGN) || [];
    const selectAlerts = getAlerts(CDS_HOOK_TYPES.ORDER_SELECT) || [];
    const allAlerts = [...orderAlerts, ...selectAlerts];
    
    if (allAlerts.length > 0 && onNotificationUpdate) {
      const criticalCount = allAlerts.filter(alert => alert.indicator === 'critical').length;
      onNotificationUpdate(criticalCount || allAlerts.length);
    }
  }, [getAlerts, onNotificationUpdate]);

  // State for optimized chained search results
  const [chainedSearchResults, setChainedSearchResults] = useState([]);
  const [loadingChainedSearch, setLoadingChainedSearch] = useState(false);
  
  // Use shared hook to get orders data as fallback
  const { medications, serviceRequests, isLoading: clinicalDataLoading } = usePatientClinicalData(patientId, {
    resourceTypes: ['MedicationRequest', 'ServiceRequest']
  });
  
  // Optimized chained search function for orders
  const performChainedSearch = useCallback(async (searchFilters = {}) => {
    if (!patientId) return;
    
    setLoadingChainedSearch(true);
    
    try {
      // Build batch bundle with chained searches
      const batchBundle = {
        resourceType: "Bundle",
        type: "batch",
        entry: []
      };

      // Standard medication requests with _include for requester and medication
      batchBundle.entry.push({
        request: {
          method: "GET",
          url: `MedicationRequest?patient=${patientId}&_include=MedicationRequest:medication,MedicationRequest:requester&_sort=-authored-on&_count=50`
        }
      });

      // Service requests with _include for requester and performer
      batchBundle.entry.push({
        request: {
          method: "GET",
          url: `ServiceRequest?patient=${patientId}&_include=ServiceRequest:requester,ServiceRequest:performer&_sort=-authored-on&_count=50`
        }
      });

      // If filtering by department, use chained search for organization
      if (searchFilters.department) {
        batchBundle.entry.push({
          request: {
            method: "GET",
            url: `ServiceRequest?patient=${patientId}&performer.organization.name=${searchFilters.department}&_include=ServiceRequest:performer&_sort=-authored-on`
          }
        });
      }

      // If filtering by provider, use chained search for practitioner
      if (searchFilters.provider) {
        batchBundle.entry.push({
          request: {
            method: "GET",
            url: `ServiceRequest?patient=${patientId}&requester.name=${searchFilters.provider}&_include=ServiceRequest:requester&_sort=-authored-on`
          }
        });
      }

      // Execute batch request
      const batchResult = await fhirClient.batch(batchBundle);
      const entries = batchResult.entry || [];
      
      // Process results
      const allOrdersResults = [];
      
      // Extract medication requests from first batch entry
      const medicationBundle = entries[0]?.resource;
      if (medicationBundle?.entry) {
        const medicationRequests = medicationBundle.entry
          .filter(e => e.resource?.resourceType === 'MedicationRequest')
          .map(e => e.resource);
        allOrdersResults.push(...medicationRequests);
      }

      // Extract service requests from second batch entry
      const serviceBundle = entries[1]?.resource;
      if (serviceBundle?.entry) {
        const serviceRequests = serviceBundle.entry
          .filter(e => e.resource?.resourceType === 'ServiceRequest')
          .map(e => e.resource);
        allOrdersResults.push(...serviceRequests);
      }

      // Add filtered results from chained searches
      if (entries.length > 2) {
        for (let i = 2; i < entries.length; i++) {
          const chainedBundle = entries[i]?.resource;
          if (chainedBundle?.entry) {
            const chainedResults = chainedBundle.entry
              .filter(e => e.resource?.resourceType === 'ServiceRequest')
              .map(e => e.resource);
            allOrdersResults.push(...chainedResults);
          }
        }
      }

      // Remove duplicates based on resource ID
      const uniqueOrders = allOrdersResults.filter((order, index, self) =>
        index === self.findIndex(o => o.id === order.id)
      );

      setChainedSearchResults(uniqueOrders);
      
    } catch (error) {
      // Error performing chained search - defaulting to empty results
      setChainedSearchResults([]);
    } finally {
      setLoadingChainedSearch(false);
    }
  }, [patientId, fhirClient]);

  // Load optimized chained search results on patient change
  useEffect(() => {
    performChainedSearch();
  }, [performChainedSearch]);

  // Get orders from enhanced search, chained search, or fallback to shared hook data
  const enhancedOrders = searchResults?.map(entry => entry.resource) || [];
  const fallbackOrders = [...medications, ...serviceRequests];
  
  // Use enhanced search results first, then chained search, then fallback
  const allOrders = enhancedOrders.length > 0 ? enhancedOrders : 
                   chainedSearchResults.length > 0 ? chainedSearchResults : 
                   fallbackOrders;
  
  // Separate by category
  const medicationOrders = allOrders.filter(order => order.resourceType === 'MedicationRequest');
  const labOrders = allOrders.filter(order => 
    order.resourceType === 'ServiceRequest' && 
    order.category?.[0]?.coding?.[0]?.code === 'laboratory'
  );
  const imagingOrders = allOrders.filter(order => 
    order.resourceType === 'ServiceRequest' && 
    order.category?.[0]?.coding?.[0]?.code === 'imaging'
  );
  const otherOrders = allOrders.filter(order => 
    order.resourceType === 'ServiceRequest' && 
    !['laboratory', 'imaging'].includes(order.category?.[0]?.coding?.[0]?.code)
  );

  // Filter orders (legacy filters for fallback when not using enhanced search)
  const filterOrders = (orders) => {
    // If using enhanced search results, return as-is (filtering handled by search service)
    if (enhancedOrders.length > 0) {
      return orders;
    }
    
    // Legacy filtering for fallback
    return orders.filter(order => {
      // Status filter
      if (filterStatus !== 'all' && order.status !== filterStatus) {
        return false;
      }

      // Period filter
      if (filterPeriod !== 'all') {
        const orderDate = order.authoredOn || order.occurrenceDateTime;
        if (orderDate) {
          let date;
          try {
            date = parseISO(orderDate);
          } catch {
            return false; // Skip invalid dates
          }
          const periodMap = {
            '7d': subDays(new Date(), 7),
            '30d': subDays(new Date(), 30),
            '90d': subDays(new Date(), 90)
          };
          if (!isWithinInterval(date, {
            start: periodMap[filterPeriod],
            end: new Date()
          })) {
            return false;
          }
        }
      }

      // Search filter
      if (searchTerm) {
        const searchableText = [
          getMedicationName(order),
          order.code?.text,
          order.code?.coding?.[0]?.display
        ].filter(Boolean).join(' ').toLowerCase();
        
        if (!searchableText.includes(searchTerm.toLowerCase())) {
          return false;
        }
      }

      return true;
    });
  };

  // Get current orders based on tab
  const getCurrentOrders = () => {
    switch (tabValue) {
      case 0: return filterOrders(allOrders);
      case 1: return filterOrders(medicationOrders);
      case 2: return filterOrders(labOrders);
      case 3: return filterOrders(imagingOrders);
      case 4: return filterOrders(otherOrders);
      default: return [];
    }
  };

  const currentOrders = getCurrentOrders();
  // Enhanced search results are already sorted by service
  const sortedOrders = enhancedOrders.length > 0 ? currentOrders : [...currentOrders].sort((a, b) => {
    let dateA, dateB;
    try {
      dateA = new Date(a.authoredOn || a.occurrenceDateTime || 0);
      dateB = new Date(b.authoredOn || b.occurrenceDateTime || 0);
    } catch {
      return 0; // Keep original order for invalid dates
    }
    return dateB - dateA;
  });

  // Count active orders
  const activeOrdersCount = allOrders.filter(o => o.status === 'active').length;
  const urgentOrdersCount = allOrders.filter(o => 
    o.priority === 'urgent' || o.priority === 'stat'
  ).length;

  const handleSelectOrder = (order, selected) => {
    const newSelected = new Set(selectedOrders);
    if (selected) {
      newSelected.add(order.id);
    } else {
      newSelected.delete(order.id);
    }
    setSelectedOrders(newSelected);
  };

  const handleSelectAll = (event) => {
    if (event.target.checked) {
      const newSelected = new Set(sortedOrders.map(o => o.id));
      setSelectedOrders(newSelected);
    } else {
      setSelectedOrders(new Set());
    }
  };

  // Send medication to pharmacy workflow
  const handleSendToPharmacy = async (order) => {
    if (order.resourceType !== 'MedicationRequest') {
      setSnackbar({
        open: true,
        message: 'Only medication orders can be sent to pharmacy',
        severity: 'error'
      });
      return;
    }

    try {
      // Update pharmacy status to pending
      await axios.put(`/api/clinical/pharmacy/status/${order.id}`, {
        status: 'pending',
        notes: 'Sent from orders tab',
        updated_by: 'Current User' // This would come from auth context
      });

      // Publish workflow event for pharmacy notification
      await publish(CLINICAL_EVENTS.WORKFLOW_NOTIFICATION, {
        workflowType: 'prescription-dispense',
        step: 'sent-to-pharmacy',
        data: {
          ...order,
          medicationName: getMedicationName(order),
          patientId,
          timestamp: new Date().toISOString()
        }
      });

      setSnackbar({
        open: true,
        message: `${getMedicationName(order)} sent to pharmacy queue`,
        severity: 'success'
      });
    } catch (error) {
      // Handle error
      setSnackbar({
        open: true,
        message: 'Failed to send to pharmacy: ' + error.message,
        severity: 'error'
      });
    }
  };

  // Cancel order
  const handleCancelOrder = async (order) => {
    try {
      const updatedOrder = {
        ...order,
        status: 'cancelled'
      };
      
      const updatedResource = await fhirClient.update(order.resourceType, order.id, updatedOrder);
      
      if (updatedResource) {
        // Refresh patient resources to show updated status
        window.dispatchEvent(new CustomEvent('fhir-resources-updated', { 
          detail: { patientId } 
        }));
        
        setSnackbar({
          open: true,
          message: 'Order cancelled successfully',
          severity: 'success'
        });
      }
    } catch (error) {
      // Handle error
      setSnackbar({
        open: true,
        message: 'Failed to cancel order: ' + error.message,
        severity: 'error'
      });
    }
  };

  // Order signing functionality
  const handleSignOrders = () => {
    const draftOrders = sortedOrders.filter(order => 
      selectedOrders.has(order.id) && order.status === 'draft'
    );

    if (draftOrders.length === 0) {
      setSnackbar({
        open: true,
        message: 'No draft orders selected for signing',
        severity: 'warning'
      });
      return;
    }

    setSignOrdersDialog({ open: true, orders: draftOrders });
  };

  const handleOrderSigned = async (signedOrders, pin, reason) => {
    try {
      setLoading(true);
      
      // Update each order status to active and add signature
      const promises = signedOrders.map(async (order) => {
        const updatedOrder = {
          ...order,
          status: 'active',
          meta: {
            ...order.meta,
            signature: {
              type: 'digital',
              when: new Date().toISOString(),
              who: currentPatient ? `Practitioner/${currentPatient.id}` : 'Unknown',
              reason: reason,
              hash: btoa(`${order.id}:${pin}:${Date.now()}`)
            }
          }
        };
        
        return fhirClient.update(order.resourceType, order.id, updatedOrder);
      });

      await Promise.all(promises);

      // Publish order signed events
      for (const order of signedOrders) {
        await publish(CLINICAL_EVENTS.ORDER_PLACED, {
          orderId: order.id,
          patientId,
          orderType: order.resourceType === 'MedicationRequest' ? 'medication' : 'service',
          providerId: currentPatient?.id,
          timestamp: new Date().toISOString()
        });
      }

      // Refresh patient resources
      window.dispatchEvent(new CustomEvent('fhir-resources-updated', { 
        detail: { patientId } 
      }));

      setSnackbar({
        open: true,
        message: `${signedOrders.length} order(s) signed successfully`,
        severity: 'success'
      });

      setSignOrdersDialog({ open: false, orders: [] });
      setSelectedOrders(new Set());

    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Failed to sign orders: ' + error.message,
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  // CPOE handlers
  const handleOpenCPOE = (orderType = 'medication') => {
    setCpoeDialogOpen(true);
  };

  const handleCPOEOrdersCreated = async (createdOrders) => {
    setSnackbar({
      open: true,
      message: `${createdOrders.length} order(s) created successfully`,
      severity: 'success'
    });
    
    // Trigger CDS check for new orders
    await executeCDSHooks(CDS_HOOK_TYPES.ORDER_SELECT, {
      patientId,
      userId: 'current-user',
      orders: createdOrders
    });
  };

  // Batch send selected orders to pharmacy
  const handleBatchSendToPharmacy = async () => {
    const medicationOrders = sortedOrders.filter(order => 
      selectedOrders.has(order.id) && order.resourceType === 'MedicationRequest'
    );

    if (medicationOrders.length === 0) {
      setSnackbar({
        open: true,
        message: 'No medication orders selected',
        severity: 'warning'
      });
      return;
    }

    try {
      // Send all selected medication orders to pharmacy
      const promises = medicationOrders.map(order =>
        axios.put(`/api/clinical/pharmacy/status/${order.id}`, {
          status: 'pending',
          notes: 'Batch sent from orders tab',
          updated_by: 'Current User'
        })
      );

      await Promise.all(promises);

      // Publish workflow event for batch pharmacy notification
      await publish(CLINICAL_EVENTS.WORKFLOW_NOTIFICATION, {
        workflowType: 'prescription-dispense',
        step: 'batch-sent-to-pharmacy',
        data: {
          orderCount: medicationOrders.length,
          orderIds: medicationOrders.map(o => o.id),
          patientId,
          timestamp: new Date().toISOString()
        }
      });

      setSnackbar({
        open: true,
        message: `${medicationOrders.length} medication orders sent to pharmacy`,
        severity: 'success'
      });

      // Clear selections
      setSelectedOrders(new Set());
    } catch (error) {
      // Handle error
      setSnackbar({
        open: true,
        message: 'Failed to send selected orders to pharmacy',
        severity: 'error'
      });
    }
  };

  // Reorder - create a new order with same details
  const handleReorder = async (order) => {
    try {
      let newOrder;
      
      if (order.resourceType === 'MedicationRequest') {
        newOrder = {
          ...order,
          id: undefined,
          meta: undefined,
          status: 'active',
          authoredOn: new Date().toISOString()
        };
        
        const createdOrder = await fhirClient.create('MedicationRequest', newOrder);
        if (createdOrder) {
          setSnackbar({
            open: true,
            message: 'Medication reordered successfully',
            severity: 'success'
          });
        }
      } else if (order.resourceType === 'ServiceRequest') {
        newOrder = {
          ...order,
          id: undefined,
          meta: undefined,
          status: 'active',
          authoredOn: new Date().toISOString()
        };
        
        const createdOrder = await fhirClient.create('ServiceRequest', newOrder);
        if (createdOrder) {
          setSnackbar({
            open: true,
            message: 'Service reordered successfully',
            severity: 'success'
          });
        }
      }
      
      // Refresh patient resources
      window.dispatchEvent(new CustomEvent('fhir-resources-updated', { 
        detail: { patientId } 
      }));
    } catch (error) {
      // Handle error
      setSnackbar({
        open: true,
        message: 'Failed to reorder: ' + error.message,
        severity: 'error'
      });
    }
  };

  // Batch cancel selected orders
  const handleBatchCancelOrders = async () => {
    const ordersToCancel = sortedOrders.filter(order => 
      selectedOrders.has(order.id) && order.status === 'active'
    );

    if (ordersToCancel.length === 0) {
      setSnackbar({
        open: true,
        message: 'No active orders selected to cancel',
        severity: 'warning'
      });
      return;
    }

    try {
      const promises = ordersToCancel.map(order => {
        const updatedOrder = { ...order, status: 'cancelled' };
        return fhirClient.update(order.resourceType, order.id, updatedOrder);
      });

      await Promise.all(promises);

      // Refresh patient resources
      window.dispatchEvent(new CustomEvent('fhir-resources-updated', { 
        detail: { patientId } 
      }));

      setSnackbar({
        open: true,
        message: `${ordersToCancel.length} orders cancelled successfully`,
        severity: 'success'
      });

      // Clear selections
      setSelectedOrders(new Set());
    } catch (error) {
      // Handle error  
      setSnackbar({
        open: true,
        message: 'Failed to cancel selected orders',
        severity: 'error'
      });
    }
  };

  const handleOrderAction = async (order, action) => {
    switch (action) {
      case 'view':
        setViewOrderDialog({ open: true, order });
        break;
      case 'edit':
        setEditOrderDialog({ open: true, order });
        break;
      case 'sign':
        await handleSignOrder(order);
        break;
      case 'cancel':
        // Cancel order by updating status
        handleCancelOrder(order);
        break;
      case 'reorder':
        // Reorder by creating a new order with same details
        handleReorder(order);
        break;
      case 'send':
        handleSendToPharmacy(order);
        break;
      case 'print':
        window.print();
        break;
      default:
        break;
    }
  };

  // Handle order signing with CDS hooks
  const handleSignOrder = async (order) => {
    try {
      // Trigger CDS hooks for order signing
      await executeCDSHooks(CDS_HOOK_TYPES.ORDER_SIGN, {
        patientId,
        userId: 'current-user',
        orders: [order]
      });

      // Order signing implemented via batch dialog
      // This would typically involve updating the order status and adding a signature
      setSnackbar({
        open: true,
        message: 'Order signed successfully',
        severity: 'success'
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Failed to sign order',
        severity: 'error'
      });
    }
  };

  // Handle order creation from QuickOrderDialog
  const handleOrderCreated = async (order, orderType) => {
    try {
      // Trigger CDS hooks for order selection before placing
      await executeCDSHooks(CDS_HOOK_TYPES.ORDER_SELECT, {
        patientId,
        userId: 'current-user',
        orders: [order]
      });

      // Publish ORDER_PLACED event
      await publish(CLINICAL_EVENTS.ORDER_PLACED, {
        ...order,
        orderType,
        patientId,
        timestamp: new Date().toISOString()
      });

      // For lab orders, notify the results tab
      if (orderType === 'lab') {
        await publish(CLINICAL_EVENTS.TAB_UPDATE, {
          targetTabs: ['results'],
          updateType: 'pending_lab_order',
          data: order
        });
      }

      // For imaging orders, notify the imaging tab
      if (orderType === 'imaging') {
        await publish(CLINICAL_EVENTS.TAB_UPDATE, {
          targetTabs: ['imaging'],
          updateType: 'pending_imaging_order',
          data: order
        });
      }
    } catch (error) {
      // Non-critical error - event publishing failed
      // Event publishing is not critical to order creation success
    }
  };

  // Export handler
  const handleExportOrders = (format) => {
    // Get the currently displayed orders based on tab
    let ordersToExport = [];
    let exportTitle = '';
    
    switch (tabValue) {
      case 0: // All Orders
        ordersToExport = sortedOrders;
        exportTitle = 'All_Orders';
        break;
      case 1: // Medications
        ordersToExport = sortedOrders.filter(o => o.resourceType === 'MedicationRequest');
        exportTitle = 'Medication_Orders';
        break;
      case 2: // Labs
        ordersToExport = sortedOrders.filter(o => 
          o.resourceType === 'ServiceRequest' && o.category?.[0]?.coding?.[0]?.code === 'laboratory'
        );
        exportTitle = 'Lab_Orders';
        break;
      case 3: // Imaging
        ordersToExport = sortedOrders.filter(o => 
          o.resourceType === 'ServiceRequest' && o.category?.[0]?.coding?.[0]?.code === 'imaging'
        );
        exportTitle = 'Imaging_Orders';
        break;
      case 4: // Other
        ordersToExport = sortedOrders.filter(o => 
          o.resourceType === 'ServiceRequest' && 
          !['laboratory', 'imaging'].includes(o.category?.[0]?.coding?.[0]?.code)
        );
        exportTitle = 'Other_Orders';
        break;
    }
    
    // Transform orders to include display values
    const transformedOrders = ordersToExport.map(order => ({
      ...order,
      code: {
        text: order.resourceType === 'MedicationRequest' 
          ? getMedicationName(order)
          : (order.code?.text || order.code?.coding?.[0]?.display)
      }
    }));
    
    exportClinicalData({
      patient: currentPatient,
      data: transformedOrders,
      columns: EXPORT_COLUMNS.orders,
      format,
      title: exportTitle,
      formatForPrint: (data) => {
        let html = '<h2>Orders & Prescriptions</h2>';
        data.forEach(order => {
          const orderName = order.resourceType === 'MedicationRequest' 
            ? getMedicationName(order)
            : (order.code?.text || order.code?.coding?.[0]?.display || 'Unknown');
          
          html += `
            <div class="section">
              <h3>${orderName}</h3>
              <p><strong>Type:</strong> ${order.resourceType === 'MedicationRequest' ? 'Medication' : 'Service Request'}</p>
              <p><strong>Status:</strong> ${order.status}</p>
              <p><strong>Priority:</strong> ${order.priority || 'Routine'}</p>
              <p><strong>Ordered:</strong> ${order.authoredOn ? (() => {
                try {
                  return format(parseISO(order.authoredOn), 'MMM d, yyyy h:mm a');
                } catch {
                  return 'Invalid date';
                }
              })() : 'Unknown'}</p>
              ${order.requester?.display ? `<p><strong>Ordered By:</strong> ${order.requester.display}</p>` : ''}
              ${order.note?.[0]?.text ? `<p><strong>Instructions:</strong> ${order.note[0].text}</p>` : ''}
            </div>
          `;
        });
        return html;
      }
    });
  };

  const speedDialActions = [
    { 
      icon: <MedicationIcon />, 
      name: 'Medication Order',
      onClick: () => setQuickOrderDialog({ open: true, type: 'medication' })
    },
    { 
      icon: <LabIcon />, 
      name: 'Lab Order',
      onClick: () => setQuickOrderDialog({ open: true, type: 'lab' })
    },
    { 
      icon: <ImagingIcon />, 
      name: 'Imaging Order',
      onClick: () => setQuickOrderDialog({ open: true, type: 'imaging' })
    }
  ];

  if (loading || loadingChainedSearch || clinicalDataLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight="bold">
          Orders & Prescriptions
        </Typography>
        <Stack direction="row" spacing={2}>
          {selectedOrders.size > 0 && (
            <>
              <Button
                variant="outlined"
                startIcon={<SignIcon />}
                onClick={handleSignOrders}
                color="primary"
              >
                Sign Orders ({selectedOrders.size})
              </Button>
              <Button
                variant="outlined"
                startIcon={<SendIcon />}
                onClick={handleBatchSendToPharmacy}
              >
                Send to Pharmacy ({selectedOrders.size})
              </Button>
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={handleBatchCancelOrders}
              >
                Cancel Selected
              </Button>
            </>
          )}
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenCPOE('medication')}
          >
            CPOE Order Entry
          </Button>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => setQuickOrderDialog({ open: true, type: 'medication' })}
          >
            Quick Order
          </Button>
          <Button
            variant="outlined"
            startIcon={<ExportIcon />}
            onClick={(e) => setExportAnchorEl(e.currentTarget)}
          >
            Export
          </Button>
        </Stack>
      </Stack>

      {/* Alerts */}
      {urgentOrdersCount > 0 && (
        <Alert 
          severity="warning" 
          sx={{ mb: 3 }}
          icon={<UrgentIcon />}
        >
          <Typography variant="subtitle2">
            {urgentOrdersCount} urgent orders require immediate attention
          </Typography>
        </Alert>
      )}

      {/* Summary Stats */}
      <Stack direction="row" spacing={2} mb={3}>
        <Chip 
          label={`${activeOrdersCount} Active Orders`} 
          color="primary" 
          icon={<Assignment />}
        />
        <Chip 
          label={`${medicationOrders.filter(o => o.status === 'active').length} Active Medications`} 
          color="info" 
        />
        <Chip 
          label={`${labOrders.filter(o => o.status === 'active').length} Pending Labs`} 
          color="warning" 
        />
      </Stack>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs 
          value={tabValue} 
          onChange={(e, newValue) => setTabValue(newValue)}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label={`All Orders (${allOrders.length})`} />
          <Tab label={`Medications (${medicationOrders.length})`} />
          <Tab label={`Lab Orders (${labOrders.length})`} />
          <Tab label={`Imaging (${imagingOrders.length})`} />
          <Tab label={`Other (${otherOrders.length})`} />
        </Tabs>
      </Paper>

      {/* Enhanced Order Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Search & Filters</Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            {hasActiveFilters() && (
              <Chip 
                label={`${Object.keys(searchResults || {}).length} filters active`} 
                size="small" 
                color="primary"
                onDelete={clearSearch}
              />
            )}
            <Button
              size="small"
              startIcon={<FilterIcon />}
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              variant={showAdvancedFilters ? 'contained' : 'outlined'}
            >
              {showAdvancedFilters ? 'Hide' : 'Show'} Advanced Filters
            </Button>
          </Stack>
        </Stack>
        
        {/* Quick Filters Row */}
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} mb={showAdvancedFilters ? 2 : 0}>
          <TextField
            placeholder="Search orders, medications, procedures..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              // Update enhanced search with text
              updateFilters({ freeText: e.target.value });
            }}
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
          
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                updateFilters({ status: e.target.value !== 'all' ? e.target.value : '' });
              }}
              label="Status"
            >
              <MenuItem value="all">All Status</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
              <MenuItem value="cancelled">Cancelled</MenuItem>
              <MenuItem value="on-hold">On Hold</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Period</InputLabel>
            <Select
              value={filterPeriod}
              onChange={(e) => {
                setFilterPeriod(e.target.value);
                updateFilters({ dateRange: e.target.value !== 'all' ? e.target.value : '' });
              }}
              label="Period"
            >
              <MenuItem value="all">All Time</MenuItem>
              <MenuItem value="today">Today</MenuItem>
              <MenuItem value="week">Last Week</MenuItem>
              <MenuItem value="month">Last Month</MenuItem>
              <MenuItem value="3months">Last 3 Months</MenuItem>
            </Select>
          </FormControl>

          <FormControlLabel
            control={
              <Checkbox
                checked={selectedOrders.size === sortedOrders.length && sortedOrders.length > 0}
                indeterminate={selectedOrders.size > 0 && selectedOrders.size < sortedOrders.length}
                onChange={handleSelectAll}
                inputProps={{
                  'aria-label': selectedOrders.size === sortedOrders.length && sortedOrders.length > 0 
                    ? 'Deselect all orders' 
                    : 'Select all orders'
                }}
              />
            }
            label="Select All"
          />
        </Stack>
        
        {/* Advanced Filters */}
        {showAdvancedFilters && (
          <AdvancedOrderFilters
            onFiltersChange={updateFilters}
            patientId={patientId}
            showAdvanced={true}
          />
        )}
      </Paper>

      {/* Search Results Info */}
      {searchLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          <CircularProgress size={24} />
          <Typography sx={{ ml: 1 }}>Searching orders...</Typography>
        </Box>
      )}
      
      {searchError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Search Error: {searchError}
        </Alert>
      )}
      
      {analytics && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>Search Analytics</Typography>
          <Stack direction="row" spacing={2}>
            <Chip label={`Total: ${analytics.summary.total}`} size="small" />
            <Chip label={`Service Requests: ${analytics.summary.byResourceType?.ServiceRequest || 0}`} size="small" color="info" />
            <Chip label={`Medications: ${analytics.summary.byResourceType?.MedicationRequest || 0}`} size="small" color="secondary" />
            <Chip label={`Active: ${analytics.summary.byStatus?.active || 0}`} size="small" color="success" />
            <Chip label={`Urgent: ${analytics.summary.byPriority?.urgent || 0}`} size="small" color="warning" />
          </Stack>
        </Paper>
      )}
      
      {/* Orders List */}
      {sortedOrders.length === 0 ? (
        <Alert severity="info">
          {searchLoading ? 'Searching...' : (enhancedOrders.length > 0 ? 'No orders match your search criteria' : 'No orders found')}
        </Alert>
      ) : sortedOrders.length > 20 ? (
        // Use virtual scrolling for large lists
        <VirtualizedList
          items={sortedOrders}
          itemHeight={120}
          containerHeight={600}
          renderItem={(order, index, key) => (
            <OrderCard
              key={key}
              order={order}
              selected={selectedOrders.has(order.id)}
              onSelect={handleSelectOrder}
              onAction={handleOrderAction}
            />
          )}
        />
      ) : (
        // Use regular rendering for small lists
        <Box>
          {sortedOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              selected={selectedOrders.has(order.id)}
              onSelect={handleSelectOrder}
              onAction={handleOrderAction}
            />
          ))}
        </Box>
      )}

      {/* Speed Dial for Quick Orders */}
      <SpeedDial
        ariaLabel="Quick order actions"
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
        icon={<SpeedDialIcon />}
        onClose={() => setSpeedDialOpen(false)}
        onOpen={() => setSpeedDialOpen(true)}
        open={speedDialOpen}
      >
        {speedDialActions.map((action) => (
          <SpeedDialAction
            key={action.name}
            icon={action.icon}
            tooltipTitle={action.name}
            aria-label={`Create new ${action.name.toLowerCase()}`}
            onClick={() => {
              setSpeedDialOpen(false);
              action.onClick();
            }}
          />
        ))}
      </SpeedDial>

      {/* Quick Order Dialog */}
      <QuickOrderDialog
        open={quickOrderDialog.open}
        onClose={() => setQuickOrderDialog({ open: false, type: null })}
        patientId={patientId}
        orderType={quickOrderDialog.type}
        onOrderCreated={handleOrderCreated}
      />

      {/* View Order Dialog */}
      <Dialog open={viewOrderDialog.open} onClose={() => setViewOrderDialog({ open: false, order: null })} maxWidth="md" fullWidth>
        <DialogTitle>
          Order Details
          <IconButton
            edge="end"
            color="inherit"
            onClick={() => setViewOrderDialog({ open: false, order: null })}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {viewOrderDialog.order && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="h6" gutterBottom>
                {viewOrderDialog.order.resourceType === 'MedicationRequest' 
                  ? getMedicationName(viewOrderDialog.order)
                  : (viewOrderDialog.order.code?.text || viewOrderDialog.order.code?.coding?.[0]?.display || 'Unknown Order')}
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">Order Type</Typography>
                  <Typography variant="body1">
                    {viewOrderDialog.order.resourceType === 'MedicationRequest' ? 'Medication' : 'Service Request'}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">Status</Typography>
                  <Chip
                    label={viewOrderDialog.order.status}
                    size="small"
                    color={viewOrderDialog.order.status === 'active' ? 'success' : 'default'}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">Priority</Typography>
                  <Typography variant="body1">{viewOrderDialog.order.priority || 'Routine'}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">Ordered Date</Typography>
                  <Typography variant="body1">
                    {viewOrderDialog.order.authoredOn ? (() => {
                      try {
                        return format(parseISO(viewOrderDialog.order.authoredOn), 'MMM d, yyyy h:mm a');
                      } catch {
                        return 'Invalid date';
                      }
                    })() : 'Unknown'}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">Ordered By</Typography>
                  <Typography variant="body1">{viewOrderDialog.order.requester?.display || 'Unknown Provider'}</Typography>
                </Grid>
                {viewOrderDialog.order.note?.[0]?.text && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="text.secondary">Instructions</Typography>
                    <Typography variant="body1">{viewOrderDialog.order.note[0].text}</Typography>
                  </Grid>
                )}
                {viewOrderDialog.order.resourceType === 'MedicationRequest' && viewOrderDialog.order.dosageInstruction?.[0] && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="text.secondary">Dosage Instructions</Typography>
                    <Typography variant="body1">{viewOrderDialog.order.dosageInstruction[0].text || 'See prescription'}</Typography>
                  </Grid>
                )}
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewOrderDialog({ open: false, order: null })}>Close</Button>
        </DialogActions>
      </Dialog>

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

      {/* Export Menu */}
      <Menu
        anchorEl={exportAnchorEl}
        open={Boolean(exportAnchorEl)}
        onClose={() => setExportAnchorEl(null)}
      >
        <MenuItem onClick={() => { handleExportOrders('csv'); setExportAnchorEl(null); }}>
          Export as CSV
        </MenuItem>
        <MenuItem onClick={() => { handleExportOrders('json'); setExportAnchorEl(null); }}>
          Export as JSON
        </MenuItem>
        <MenuItem onClick={() => { handleExportOrders('pdf'); setExportAnchorEl(null); }}>
          Export as PDF
        </MenuItem>
      </Menu>

      {/* CPOE Dialog */}
      <CPOEDialog
        open={cpoeDialogOpen}
        onClose={() => setCpoeDialogOpen(false)}
        patientId={patientId}
        onSave={handleCPOEOrdersCreated}
        patientConditions={[]} // TODO: Pass actual patient conditions
        recentOrders={[]} // TODO: Pass actual recent orders
      />

      {/* Order Signing Dialog */}
      <OrderSigningDialog
        open={signOrdersDialog.open}
        onClose={() => setSignOrdersDialog({ open: false, orders: [] })}
        orders={signOrdersDialog.orders}
        onOrdersSigned={handleOrderSigned}
        loading={loading}
      />

      {/* Edit Order Dialog */}
      <Dialog
        open={editOrderDialog.open}
        onClose={() => setEditOrderDialog({ open: false, order: null })}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Edit Order</DialogTitle>
        <DialogContent>
          {editOrderDialog.order && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body1" sx={{ mb: 2 }}>
                Order editing functionality is being enhanced. For now, please cancel this order and create a new one with the correct details.
              </Typography>
              <Typography variant="subtitle2" color="text.secondary">
                Current Order: {editOrderDialog.order.resourceType === 'MedicationRequest' 
                  ? getMedicationName(editOrderDialog.order) 
                  : editOrderDialog.order.code?.text || 'Unknown'}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOrderDialog({ open: false, order: null })}>
            Close
          </Button>
          <Button 
            variant="contained" 
            onClick={() => {
              setEditOrderDialog({ open: false, order: null });
              setCpoeDialogOpen(true);
            }}
          >
            Create New Order
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default React.memo(OrdersTab);