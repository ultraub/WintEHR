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
  alpha
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
  Assignment
} from '@mui/icons-material';
import { format, parseISO, formatDistanceToNow, isWithinInterval, subDays } from 'date-fns';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import { useNavigate } from 'react-router-dom';

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
const QuickOrderDialog = ({ open, onClose, patientId, orderType }) => {
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

  const handleSubmit = () => {
    // TODO: Implement order submission
    console.log('Submitting order:', orderData);
    onClose();
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
  const { getPatientResources, isLoading } = useFHIRResource();
  
  const [tabValue, setTabValue] = useState(0);
  const [filterStatus, setFilterStatus] = useState('active');
  const [filterPeriod, setFilterPeriod] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrders, setSelectedOrders] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [speedDialOpen, setSpeedDialOpen] = useState(false);
  const [quickOrderDialog, setQuickOrderDialog] = useState({ open: false, type: null });

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

  const handleOrderAction = (order, action) => {
    switch (action) {
      case 'view':
        console.log('Viewing order:', order);
        break;
      case 'edit':
        console.log('Editing order:', order);
        break;
      case 'cancel':
        // TODO: Implement cancel order
        console.log('Cancel order:', order.id);
        break;
      case 'reorder':
        // TODO: Implement reorder
        console.log('Reorder:', order.id);
        break;
      case 'send':
        // TODO: Implement send to pharmacy
        console.log('Send to pharmacy:', order.id);
        break;
      case 'print':
        window.print();
        break;
      default:
        break;
    }
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
              >
                Send Selected ({selectedOrders.size})
              </Button>
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
              >
                Cancel Selected
              </Button>
            </>
          )}
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            disabled
          >
            New Order
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
      />
    </Box>
  );
};

export default OrdersTab;