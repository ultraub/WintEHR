/**
 * Orders Tab Component
 * Manage active orders, prescriptions, and order history
 */
import React, { useState, useEffect } from 'react';
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
  Assignment
} from '@mui/icons-material';
import { format, parseISO, formatDistanceToNow, isWithinInterval, subDays } from 'date-fns';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useClinicalWorkflow, CLINICAL_EVENTS } from '../../../../contexts/ClinicalWorkflowContext';
import { exportClinicalData, EXPORT_COLUMNS } from '../../../../utils/exportUtils';
import { GetApp as ExportIcon } from '@mui/icons-material';

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
      return order.medicationCodeableConcept?.text || 
             order.medicationCodeableConcept?.coding?.[0]?.display ||
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
                    {format(parseISO(orderDate), 'MMM d, yyyy')}
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

// Quick Order Dialog
const QuickOrderDialog = ({ open, onClose, patientId, orderType, onNotificationUpdate, onOrderCreated }) => {
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
        
        const response = await axios.post('/fhir/R4/MedicationRequest', medicationRequest);
        if (response.data) {
          // Refresh patient resources to show new order
          window.dispatchEvent(new CustomEvent('fhir-resources-updated', { 
            detail: { patientId } 
          }));
          // Notify parent component about the created order
          if (onOrderCreated) {
            onOrderCreated(response.data, 'medication');
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
        
        const response = await axios.post('/fhir/R4/ServiceRequest', serviceRequest);
        if (response.data) {
          window.dispatchEvent(new CustomEvent('fhir-resources-updated', { 
            detail: { patientId } 
          }));
          // Notify parent component about the created order
          if (onOrderCreated) {
            onOrderCreated(response.data, orderType);
          }
        }
      }
      
      onClose();
    } catch (error) {
      // Handle error
      if (onNotificationUpdate) {
        onNotificationUpdate({
          type: 'error',
          message: 'Failed to create order: ' + error.message
        });
      }
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

const OrdersTab = ({ patientId, onNotificationUpdate }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { getPatientResources, isLoading, currentPatient } = useFHIRResource();
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
  const [editOrderDialog, setEditOrderDialog] = useState({ open: false, order: null });
  const [exportAnchorEl, setExportAnchorEl] = useState(null);

  useEffect(() => {
    setLoading(false);
  }, []);

  // Get all orders
  const medicationRequests = getPatientResources(patientId, 'MedicationRequest') || [];
  const serviceRequests = getPatientResources(patientId, 'ServiceRequest') || [];
  
  // Combine all orders
  const allOrders = [...medicationRequests, ...serviceRequests];
  
  // Separate by category
  const medicationOrders = medicationRequests;
  const labOrders = serviceRequests.filter(sr => 
    sr.category?.[0]?.coding?.[0]?.code === 'laboratory'
  );
  const imagingOrders = serviceRequests.filter(sr => 
    sr.category?.[0]?.coding?.[0]?.code === 'imaging'
  );
  const otherOrders = serviceRequests.filter(sr => 
    !['laboratory', 'imaging'].includes(sr.category?.[0]?.coding?.[0]?.code)
  );

  // Filter orders
  const filterOrders = (orders) => {
    return orders.filter(order => {
      // Status filter
      if (filterStatus !== 'all' && order.status !== filterStatus) {
        return false;
      }

      // Period filter
      if (filterPeriod !== 'all') {
        const orderDate = order.authoredOn || order.occurrenceDateTime;
        if (orderDate) {
          const date = parseISO(orderDate);
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
          order.medicationCodeableConcept?.text,
          order.medicationCodeableConcept?.coding?.[0]?.display,
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
  const sortedOrders = [...currentOrders].sort((a, b) => {
    const dateA = new Date(a.authoredOn || a.occurrenceDateTime || 0);
    const dateB = new Date(b.authoredOn || b.occurrenceDateTime || 0);
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
          medicationName: order.medicationCodeableConcept?.text || 
                         order.medicationCodeableConcept?.coding?.[0]?.display || 
                         'Unknown medication',
          patientId,
          timestamp: new Date().toISOString()
        }
      });

      setSnackbar({
        open: true,
        message: `${order.medicationCodeableConcept?.text || 'Medication'} sent to pharmacy queue`,
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
      
      const endpoint = order.resourceType === 'MedicationRequest' 
        ? '/fhir/R4/MedicationRequest' 
        : '/fhir/R4/ServiceRequest';
      
      const response = await axios.put(`${endpoint}/${order.id}`, updatedOrder);
      
      if (response.data) {
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
        
        const response = await axios.post('/fhir/R4/MedicationRequest', newOrder);
        if (response.data) {
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
        
        const response = await axios.post('/fhir/R4/ServiceRequest', newOrder);
        if (response.data) {
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
        const endpoint = order.resourceType === 'MedicationRequest' 
          ? '/fhir/R4/MedicationRequest' 
          : '/fhir/R4/ServiceRequest';
        return axios.put(`${endpoint}/${order.id}`, updatedOrder);
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

  const handleOrderAction = (order, action) => {
    switch (action) {
      case 'view':
        setViewOrderDialog({ open: true, order });
        break;
      case 'edit':
        setEditOrderDialog({ open: true, order });
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

  // Handle order creation from QuickOrderDialog
  const handleOrderCreated = async (order, orderType) => {
    try {
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
      console.error('Failed to publish order created event:', error);
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
          ? (order.medicationCodeableConcept?.text || order.medicationCodeableConcept?.coding?.[0]?.display)
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
            ? (order.medicationCodeableConcept?.text || order.medicationCodeableConcept?.coding?.[0]?.display || 'Unknown')
            : (order.code?.text || order.code?.coding?.[0]?.display || 'Unknown');
          
          html += `
            <div class="section">
              <h3>${orderName}</h3>
              <p><strong>Type:</strong> ${order.resourceType === 'MedicationRequest' ? 'Medication' : 'Service Request'}</p>
              <p><strong>Status:</strong> ${order.status}</p>
              <p><strong>Priority:</strong> ${order.priority || 'Routine'}</p>
              <p><strong>Ordered:</strong> ${order.authoredOn ? format(parseISO(order.authoredOn), 'MMM d, yyyy h:mm a') : 'Unknown'}</p>
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

  if (loading) {
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
            onClick={() => setQuickOrderDialog({ open: true, type: 'medication' })}
          >
            New Order
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

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField
            placeholder="Search orders..."
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
          
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
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
              onChange={(e) => setFilterPeriod(e.target.value)}
              label="Period"
            >
              <MenuItem value="all">All Time</MenuItem>
              <MenuItem value="7d">Last 7 Days</MenuItem>
              <MenuItem value="30d">Last 30 Days</MenuItem>
              <MenuItem value="90d">Last 90 Days</MenuItem>
            </Select>
          </FormControl>

          <FormControlLabel
            control={
              <Checkbox
                checked={selectedOrders.size === sortedOrders.length && sortedOrders.length > 0}
                indeterminate={selectedOrders.size > 0 && selectedOrders.size < sortedOrders.length}
                onChange={handleSelectAll}
              />
            }
            label="Select All"
          />
        </Stack>
      </Paper>

      {/* Orders List */}
      {sortedOrders.length === 0 ? (
        <Alert severity="info">
          No orders found matching your criteria
        </Alert>
      ) : (
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
        onNotificationUpdate={(notification) => setSnackbar({
          open: true,
          message: notification.message,
          severity: notification.type === 'error' ? 'error' : 'success'
        })}
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
                  ? (viewOrderDialog.order.medicationCodeableConcept?.text || viewOrderDialog.order.medicationCodeableConcept?.coding?.[0]?.display || 'Unknown Medication')
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
                    {viewOrderDialog.order.authoredOn ? format(parseISO(viewOrderDialog.order.authoredOn), 'MMM d, yyyy h:mm a') : 'Unknown'}
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
    </Box>
  );
};

export default OrdersTab;