/**
 * Enhanced Orders Tab Component
 * Comprehensive CPOE system with advanced FHIR R4 search capabilities
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Box,
  Grid,
  Typography,
  Chip,
  Stack,
  Button,
  IconButton,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  SpeedDial,
  SpeedDialIcon,
  SpeedDialAction,
  Snackbar,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme
} from '@mui/material';
import {
  Assignment as OrderIcon,
  Medication as MedicationIcon,
  Science as LabIcon,
  Image as ImagingIcon,
  Add as AddIcon,
  GetApp as ExportIcon,
  Send as SendIcon,
  Delete as DeleteIcon,
  Assignment,
  Draw as SignIcon,
  Analytics as AnalyticsIcon,
  Close as CloseIcon,
  Pending as PendingIcon,
  CheckCircle
} from '@mui/icons-material';

// Enhanced components and hooks
import { useAdvancedOrderSearch } from '../../../../hooks/useAdvancedOrderSearch';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import { useClinicalWorkflow, CLINICAL_EVENTS } from '../../../../contexts/ClinicalWorkflowContext';
import VirtualizedList from '../../../common/VirtualizedList';
import { exportClinicalData, EXPORT_COLUMNS } from '../../../../core/export/exportUtils';
import { getMedicationName } from '../../../../core/fhir/utils/medicationDisplayUtils';
import { useCDS, CDS_HOOK_TYPES } from '../../../../contexts/CDSContext';
import { getStatusColor, getSeverityColor } from '../../../../themes/clinicalThemeUtils';

// Existing dialogs
import CPOEDialog from '../dialogs/CPOEDialog';
import QuickOrderDialog from '../dialogs/QuickOrderDialog';
import OrderSigningDialog from '../dialogs/OrderSigningDialog';

// Shared clinical components
import { 
  ClinicalFilterPanel,
  ClinicalLoadingState,
  ClinicalEmptyState,
  ClinicalSummaryCard,
  ClinicalResourceCard
} from '../../shared';

// Enhanced components (to be created)
// import OrderStatisticsPanel from './components/OrderStatisticsPanel';
// import OrderCard from './components/OrderCard';

// Temporary OrderCard component using ClinicalResourceCard
const OrderCard = ({ order, selected, onSelect, onAction, getRelatedOrders, isAlternate = false }) => {
  // Determine order type and icon
  const getOrderIcon = () => {
    if (order.resourceType === 'MedicationRequest') return <MedicationIcon />;
    if (order.category?.[0]?.coding?.[0]?.code === 'laboratory') return <LabIcon />;
    if (order.category?.[0]?.coding?.[0]?.code === 'imaging') return <ImagingIcon />;
    return <OrderIcon />;
  };

  // Determine severity based on priority
  const getSeverity = () => {
    if (order.priority === 'urgent' || order.priority === 'stat') return 'critical';
    if (order.priority === 'asap') return 'high';
    return 'normal';
  };

  // Build details array
  const details = [];
  
  if (order.authoredOn) {
    details.push({ 
      label: 'Ordered', 
      value: new Date(order.authoredOn).toLocaleDateString() 
    });
  }
  
  if (order.requester?.display) {
    details.push({ label: 'Ordered by', value: order.requester.display });
  }
  
  if (order.dosageInstruction?.[0]?.text) {
    details.push({ value: order.dosageInstruction[0].text });
  }

  const title = order.resourceType === 'MedicationRequest' 
    ? getMedicationName(order)
    : (order.code?.text || order.code?.coding?.[0]?.display || 'Order');

  return (
    <Box sx={{ mb: 1 }}>
      <ClinicalResourceCard
        title={title}
        icon={getOrderIcon()}
        severity={getSeverity()}
        status={order.status}
        statusColor={order.status === 'active' ? 'success' : order.status === 'cancelled' ? 'error' : 'default'}
        details={details}
        onEdit={() => onAction(order, 'edit')}
        onMore={() => onAction(order, 'view')}
        selectable
        selected={selected}
        onSelect={(checked) => onSelect(order, checked)}
        isAlternate={isAlternate}
      />
    </Box>
  );
};

// Enhanced OrderStatisticsPanel component
const OrderStatisticsPanel = ({ statistics, onClose }) => {
  const theme = useTheme();
  
  // Calculate additional statistics
  const completedToday = statistics?.completedToday || 0;
  const pendingOrders = statistics?.pending || 0;
  const medicationOrders = statistics?.byType?.medications || 0;
  const labOrders = statistics?.byType?.laboratory || 0;
  const imagingOrders = statistics?.byType?.imaging || 0;
  
  return (
    <Box sx={{ mb: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6" fontWeight="bold">
          Order Statistics
        </Typography>
        {onClose && (
          <IconButton size="small" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        )}
      </Stack>
      
      <Grid container spacing={2}>
        {/* Main statistics */}
        <Grid item xs={12} sm={6} md={3}>
          <ClinicalSummaryCard
            title="Total Orders"
            value={statistics?.total || 0}
            icon={<OrderIcon />}
            severity="normal"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <ClinicalSummaryCard
            title="Active Orders"
            value={statistics?.active || 0}
            icon={<OrderIcon />}
            severity="moderate"
            chips={[
              { 
                label: `${statistics?.urgent || 0} Urgent`, 
                color: 'error',
                sx: { fontWeight: 'bold', borderRadius: '4px' }
              }
            ]}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <ClinicalSummaryCard
            title="Pending Orders"
            value={pendingOrders}
            icon={<PendingIcon />}
            severity="moderate"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <ClinicalSummaryCard
            title="Completed Today"
            value={completedToday}
            icon={<CheckCircle />}
            severity="success"
          />
        </Grid>
        
        {/* Order type breakdown */}
        <Grid item xs={12}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1, mb: 1 }}>
            Orders by Type
          </Typography>
        </Grid>
        <Grid item xs={12} sm={4}>
          <ClinicalSummaryCard
            title="Medications"
            value={medicationOrders}
            icon={<MedicationIcon />}
            severity="normal"
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <ClinicalSummaryCard
            title="Lab Orders"
            value={labOrders}
            icon={<LabIcon />}
            severity="normal"
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <ClinicalSummaryCard
            title="Imaging Orders"
            value={imagingOrders}
            icon={<ImagingIcon />}
            severity="normal"
          />
        </Grid>
      </Grid>
      
      {/* Last updated */}
      <Typography 
        variant="caption" 
        color="text.secondary" 
        sx={{ display: 'block', mt: 2, textAlign: 'right' }}
      >
        Last updated: {new Date().toLocaleTimeString()}
      </Typography>
    </Box>
  );
};

const EnhancedOrdersTab = ({ patientId, onNotificationUpdate }) => {
  const theme = useTheme();
  const { currentPatient } = useFHIRResource();
  const { publish } = useClinicalWorkflow();
  const { getAlerts } = useCDS();

  // Enhanced search hook
  const {
    filters,
    entries,
    total,
    loading,
    error,
    analytics: statistics,
    hasActiveFilters,
    updateFilters,
    search: refreshSearch,
    getRelatedOrders
  } = useAdvancedOrderSearch({ patientId, autoSearch: true });

  // Create results object for backward compatibility
  const results = { entries, total };

  // UI State
  const [tabValue, setTabValue] = useState(0);
  const [selectedOrders, setSelectedOrders] = useState(new Set());
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [speedDialOpen, setSpeedDialOpen] = useState(false);
  const [quickOrderDialog, setQuickOrderDialog] = useState({ open: false, type: null });
  const [cpoeDialogOpen, setCpoeDialogOpen] = useState(false);
  const [signOrdersDialog, setSignOrdersDialog] = useState({ open: false, orders: [] });
  const [showStatistics, setShowStatistics] = useState(false);
  const [viewMode, setViewMode] = useState('list'); // Added for ClinicalFilterPanel
  const scrollContainerRef = useRef(null); // Added for auto-collapse on scroll
  const [selectedResult, setSelectedResult] = useState(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  // FHIR resources for providers, locations, and organizations
  const [availableProviders, setAvailableProviders] = useState([]);
  const [availableLocations, setAvailableLocations] = useState([]);
  const [availableOrganizations, setAvailableOrganizations] = useState([]);

  // Load provider and location data from FHIR
  useEffect(() => {
    loadProviderData();
    loadLocationData();
    loadOrganizationData();
  }, []);

  const loadProviderData = async () => {
    try {
      const { fhirClient } = await import('../../../../core/fhir/services/fhirClient');
      const response = await fhirClient.search('Practitioner', {
        _count: 100,
        active: true
      });
      
      const providers = (response.resources || []).map(practitioner => ({
        id: practitioner.id,
        name: practitioner.name?.[0] ? 
          `${practitioner.name[0].prefix?.join(' ') || ''} ${practitioner.name[0].given?.join(' ') || ''} ${practitioner.name[0].family || ''}`.trim() :
          'Unknown Provider'
      }));
      
      setAvailableProviders(providers);
    } catch (error) {
      console.error('Error loading providers:', error);
      setAvailableProviders([]);
    }
  };

  const loadLocationData = async () => {
    try {
      const { fhirClient } = await import('../../../../core/fhir/services/fhirClient');
      const response = await fhirClient.search('Location', {
        _count: 100,
        status: 'active'
      });
      
      const locations = (response.resources || []).map(location => ({
        id: location.id,
        name: location.name || 'Unknown Location'
      }));
      
      setAvailableLocations(locations);
    } catch (error) {
      console.error('Error loading locations:', error);
      setAvailableLocations([]);
    }
  };

  const loadOrganizationData = async () => {
    try {
      const { fhirClient } = await import('../../../../core/fhir/services/fhirClient');
      const response = await fhirClient.search('Organization', {
        _count: 100,
        active: true
      });
      
      const organizations = (response.resources || []).map(org => ({
        id: org.id,
        name: org.name || 'Unknown Organization'
      }));
      
      setAvailableOrganizations(organizations);
    } catch (error) {
      console.error('Error loading organizations:', error);
      setAvailableOrganizations([]);
    }
  };

  // Process results for display
  const processedResults = useMemo(() => {
    if (!results || !results.entries) {
      return {
        all: [],
        medications: [],
        lab: [],
        imaging: [],
        other: []
      };
    }

    const orders = results.entries.map(entry => entry.resource);
    
    // Categorize orders
    const categorizedOrders = {
      all: orders,
      medications: orders.filter(order => order.resourceType === 'MedicationRequest'),
      lab: orders.filter(order => 
        order.resourceType === 'ServiceRequest' && 
        order.category?.[0]?.coding?.[0]?.code === 'laboratory'
      ),
      imaging: orders.filter(order => 
        order.resourceType === 'ServiceRequest' && 
        order.category?.[0]?.coding?.[0]?.code === 'imaging'
      ),
      other: orders.filter(order => 
        order.resourceType === 'ServiceRequest' && 
        !['laboratory', 'imaging'].includes(order.category?.[0]?.coding?.[0]?.code)
      )
    };

    return categorizedOrders;
  }, [results]);

  // Get current orders based on tab
  const getCurrentOrders = () => {
    switch (tabValue) {
      case 0: return processedResults.all;
      case 1: return processedResults.medications;
      case 2: return processedResults.lab;
      case 3: return processedResults.imaging;
      case 4: return processedResults.other;
      default: return [];
    }
  };

  const currentOrders = getCurrentOrders();

  // Count active orders for alerts
  const activeOrdersCount = processedResults.all.filter(o => o.status === 'active').length;
  const urgentOrdersCount = processedResults.all.filter(o => 
    o.priority === 'urgent' || o.priority === 'stat'
  ).length;

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

  // Filter preset management
  const handleSaveFilterPreset = (name, filterData) => {
    try {
      const presets = JSON.parse(localStorage.getItem('orderFilterPresets') || '{}');
      presets[name] = {
        ...filterData,
        createdAt: new Date().toISOString()
      };
      localStorage.setItem('orderFilterPresets', JSON.stringify(presets));
      
      setSnackbar({
        open: true,
        message: `Filter preset "${name}" saved successfully`,
        severity: 'success'
      });
    } catch (error) {
      // Error saving filter preset - showing user notification
      setSnackbar({
        open: true,
        message: 'Failed to save filter preset',
        severity: 'error'
      });
    }
  };

  // Order selection handlers
  const handleSelectOrder = (order, selected) => {
    const newSelected = new Set(selectedOrders);
    if (selected) {
      newSelected.add(order.id);
    } else {
      newSelected.delete(order.id);
    }
    setSelectedOrders(newSelected);
  };


  // Order action handlers
  const handleOrderAction = async (order, action) => {
    try {
      switch (action) {
        case 'view':
          // Handle view order details
          setSelectedResult(order);
          setDetailsDialogOpen(true);
          break;
        case 'edit':
          // Handle edit order - would open CPOE dialog in edit mode
          setSnackbar({
            open: true,
            message: 'Edit order functionality coming soon',
            severity: 'info'
          });
          break;
        case 'cancel':
          // Handle cancel order
          if (window.confirm(`Are you sure you want to cancel this ${order.resourceType === 'MedicationRequest' ? 'medication' : 'order'}?`)) {
            try {
              const { fhirClient } = await import('../../../../core/fhir/services/fhirClient');
              const updatedOrder = { ...order, status: 'cancelled' };
              await fhirClient.update(order.resourceType, order.id, updatedOrder);
              refreshSearch();
              setSnackbar({
                open: true,
                message: 'Order cancelled successfully',
                severity: 'success'
              });
            } catch (cancelError) {
              console.error('Error cancelling order:', cancelError);
              throw cancelError;
            }
          }
          break;
        case 'send':
          // Handle send to pharmacy
          await handleSendToPharmacy(order);
          break;
        case 'reorder':
          // Handle reorder - create a new order based on existing one
          setSnackbar({
            open: true,
            message: 'Reorder functionality coming soon',
            severity: 'info'
          });
          break;
        default:
          console.warn(`Unknown order action: ${action}`);
          break;
      }
    } catch (error) {
      console.error(`Error handling order action ${action}:`, error);
      setSnackbar({
        open: true,
        message: `Failed to ${action} order: ${error.message || 'Unknown error'}`,
        severity: 'error'
      });
    }
  };

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
      setSnackbar({
        open: true,
        message: 'Failed to send to pharmacy: ' + error.message,
        severity: 'error'
      });
    }
  };

  // Export handler
  const handleExportOrders = (format) => {
    const ordersToExport = currentOrders;
    const tabNames = ['All_Orders', 'Medication_Orders', 'Lab_Orders', 'Imaging_Orders', 'Other_Orders'];
    const exportTitle = tabNames[tabValue] || 'Orders';
    
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
      title: exportTitle
    });
  };

  // Speed dial actions
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

  if (loading && entries.length === 0) {
    return (
      <Box sx={{ p: 3 }}>
        <ClinicalLoadingState.Table rows={10} columns={6} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, height: '100%', overflow: 'auto' }} ref={scrollContainerRef}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight="bold">
          Enhanced Orders & Prescriptions
        </Typography>
        <Stack direction="row" spacing={2}>
          {selectedOrders.size > 0 && (
            <>
              <Button
                variant="outlined"
                startIcon={<SignIcon />}
                onClick={() => setSignOrdersDialog({ open: true, orders: [] })}
                color="primary"
                sx={{ borderRadius: 0 }}
              >
                Sign Orders ({selectedOrders.size})
              </Button>
              <Button
                variant="outlined"
                startIcon={<SendIcon />}
                onClick={() => {/* Handle batch send to pharmacy */}}
                sx={{ borderRadius: 0 }}
              >
                Send to Pharmacy
              </Button>
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={() => {/* Handle batch cancel */}}
                sx={{ borderRadius: 0 }}
              >
                Cancel Selected
              </Button>
            </>
          )}
          <Button
            variant="outlined"
            startIcon={<AnalyticsIcon />}
            onClick={() => setShowStatistics(!showStatistics)}
            sx={{ borderRadius: 0 }}
          >
            Statistics
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCpoeDialogOpen(true)}
            sx={{ borderRadius: 0 }}
          >
            CPOE Order Entry
          </Button>
          <Button
            variant="outlined"
            startIcon={<ExportIcon />}
            onClick={() => handleExportOrders('csv')}
            sx={{ borderRadius: 0 }}
          >
            Export
          </Button>
        </Stack>
      </Stack>

      {/* Alerts */}
      {urgentOrdersCount > 0 && (
        <Alert 
          severity="warning" 
          sx={{ 
            mb: 3,
            borderRadius: 0,
            borderLeft: `4px solid ${getSeverityColor(theme, 'moderate')}`
          }}
        >
          <Typography variant="subtitle2">
            {urgentOrdersCount} urgent orders require immediate attention
          </Typography>
        </Alert>
      )}

      {/* Error Display */}
      {error && (
        <Alert 
          severity="error" 
          sx={{ 
            mb: 3,
            borderRadius: 0,
            borderLeft: `4px solid ${getSeverityColor(theme, 'critical')}`
          }}
        >
          {error}
        </Alert>
      )}

      {/* Clinical Filter Panel */}
      <ClinicalFilterPanel
        searchQuery={filters.searchTerm || ''}
        onSearchChange={(value) => updateFilters({ searchTerm: value })}
        dateRange={filters.dateRange || 'all'}
        onDateRangeChange={(value) => updateFilters({ dateRange: value })}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onRefresh={refreshSearch}
        scrollContainerRef={scrollContainerRef}
        loading={loading}
        resultCount={total}
        customFilters={
          <Stack direction="row" spacing={2} flexWrap="wrap">
            {/* Status Filter */}
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={filters.status || 'all'}
                onChange={(e) => updateFilters({ status: e.target.value })}
                label="Status"
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0 } }}
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="draft">Draft</MenuItem>
                <MenuItem value="on-hold">On Hold</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
              </Select>
            </FormControl>

            {/* Priority Filter */}
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Priority</InputLabel>
              <Select
                value={filters.priority || 'all'}
                onChange={(e) => updateFilters({ priority: e.target.value })}
                label="Priority"
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0 } }}
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="routine">Routine</MenuItem>
                <MenuItem value="urgent">Urgent</MenuItem>
                <MenuItem value="stat">STAT</MenuItem>
                <MenuItem value="asap">ASAP</MenuItem>
              </Select>
            </FormControl>

            {/* Provider Filter */}
            {availableProviders.length > 0 && (
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Provider</InputLabel>
                <Select
                  value={filters.providerId || 'all'}
                  onChange={(e) => updateFilters({ providerId: e.target.value })}
                  label="Provider"
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0 } }}
                >
                  <MenuItem value="all">All Providers</MenuItem>
                  {availableProviders.map(provider => (
                    <MenuItem key={provider.id} value={provider.id}>
                      {provider.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {/* Location Filter */}
            {availableLocations.length > 0 && (
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Location</InputLabel>
                <Select
                  value={filters.locationId || 'all'}
                  onChange={(e) => updateFilters({ locationId: e.target.value })}
                  label="Location"
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0 } }}
                >
                  <MenuItem value="all">All Locations</MenuItem>
                  {availableLocations.map(location => (
                    <MenuItem key={location.id} value={location.id}>
                      {location.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Stack>
        }
      />

      {/* Statistics Panel */}
      {showStatistics && statistics && (
        <OrderStatisticsPanel 
          statistics={statistics}
          onClose={() => setShowStatistics(false)}
        />
      )}

      {/* Summary Stats */}
      <Stack direction="row" spacing={2} mb={3} flexWrap="wrap">
        <Chip 
          label={`${activeOrdersCount} Active Orders`} 
          color="primary" 
          icon={<Assignment />}
          sx={{ fontWeight: 'bold', borderRadius: '4px' }}
        />
        <Chip 
          label={`${processedResults.medications.filter(o => o.status === 'active').length} Active Medications`} 
          color="info" 
          sx={{ fontWeight: 'bold', borderRadius: '4px' }}
        />
        <Chip 
          label={`${processedResults.lab.filter(o => o.status === 'active').length} Pending Labs`} 
          color="warning" 
          sx={{ fontWeight: 'bold', borderRadius: '4px' }}
        />
        <Chip 
          label={`Total: ${results?.total || 0}`} 
          color="default" 
          sx={{ fontWeight: 'bold', borderRadius: '4px' }}
        />
        {loading && (
          <Chip 
            label="Searching..." 
            color="default"
            icon={<CircularProgress size={16} />}
            sx={{ fontWeight: 'bold', borderRadius: '4px' }}
          />
        )}
      </Stack>

      {/* Tabs */}
      <Tabs 
        value={tabValue} 
        onChange={(e, newValue) => setTabValue(newValue)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ 
          mb: 3,
          '& .MuiTab-root': {
            borderRadius: 0
          }
        }}
      >
        <Tab label={`All Orders (${processedResults.all.length})`} />
        <Tab label={`Medications (${processedResults.medications.length})`} />
        <Tab label={`Lab Orders (${processedResults.lab.length})`} />
        <Tab label={`Imaging (${processedResults.imaging.length})`} />
        <Tab label={`Other (${processedResults.other.length})`} />
      </Tabs>

      {/* Orders List */}
      {loading && entries.length === 0 ? (
        <Box sx={{ p: 2 }}>
          {viewMode === 'list' ? (
            <ClinicalLoadingState.Table rows={10} columns={6} />
          ) : (
            <Grid container spacing={2}>
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Grid item xs={12} md={6} key={i}>
                  <ClinicalLoadingState.ResourceCard />
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      ) : currentOrders.length === 0 ? (
        <ClinicalEmptyState
          title="No orders found"
          message="No orders found matching your criteria"
          actions={[
            ...(hasActiveFilters() ? [{
              label: 'Clear Filters',
              onClick: () => updateFilters({})
            }] : []),
            {
              label: 'Create New Order',
              onClick: () => setCpoeDialogOpen(true),
              variant: 'contained'
            }
          ]}
        />
      ) : currentOrders.length > 20 && viewMode === 'list' ? (
        // Use virtual scrolling for large lists in list mode
        <VirtualizedList
          items={currentOrders}
          itemHeight={120}
          containerHeight={600}
          renderItem={(order, index, key) => (
            <OrderCard
              key={key}
              order={order}
              selected={selectedOrders.has(order.id)}
              onSelect={handleSelectOrder}
              onAction={handleOrderAction}
              getRelatedOrders={getRelatedOrders}
              isAlternate={index % 2 === 1}
            />
          )}
        />
      ) : (
        // Use regular rendering for small lists or card view
        <Box>
          {currentOrders.map((order, index) => (
            <OrderCard
              key={order.id}
              order={order}
              selected={selectedOrders.has(order.id)}
              onSelect={handleSelectOrder}
              onAction={handleOrderAction}
              getRelatedOrders={getRelatedOrders}
              isAlternate={index % 2 === 1}
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

      {/* Dialogs */}
      <QuickOrderDialog
        open={quickOrderDialog.open}
        onClose={() => setQuickOrderDialog({ open: false, type: null })}
        patientId={patientId}
        orderType={quickOrderDialog.type}
        onOrderCreated={(order) => refreshSearch()}
      />

      <CPOEDialog
        open={cpoeDialogOpen}
        onClose={() => setCpoeDialogOpen(false)}
        patientId={patientId}
        onSave={(orders) => {
          refreshSearch();
          setSnackbar({
            open: true,
            message: `${orders.length} order(s) created successfully`,
            severity: 'success'
          });
        }}
      />

      <OrderSigningDialog
        open={signOrdersDialog.open}
        onClose={() => setSignOrdersDialog({ open: false, orders: [] })}
        orders={signOrdersDialog.orders}
        onOrdersSigned={(signedOrders) => {
          refreshSearch();
          setSelectedOrders(new Set());
        }}
        loading={loading}
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
          sx={{ width: '100%', borderRadius: 0 }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Order Details Dialog */}
      <Dialog
        open={detailsDialogOpen}
        onClose={() => {
          setDetailsDialogOpen(false);
          setSelectedResult(null);
        }}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 0 } }}
      >
        <DialogTitle>
          Order Details
          <IconButton
            aria-label="close"
            onClick={() => {
              setDetailsDialogOpen(false);
              setSelectedResult(null);
            }}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {selectedResult && (
            <Box>
              <Typography variant="h6" gutterBottom>
                {selectedResult.resourceType === 'MedicationRequest' 
                  ? getMedicationName(selectedResult)
                  : (selectedResult.code?.text || selectedResult.code?.coding?.[0]?.display || 'Order')}
              </Typography>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Status</Typography>
                  <Chip 
                    label={selectedResult.status} 
                    size="small" 
                    color={selectedResult.status === 'active' ? 'success' : 'default'}
                    sx={{ fontWeight: 'bold', borderRadius: '4px' }}
                  />
                </Box>
                {selectedResult.priority && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">Priority</Typography>
                    <Chip 
                      label={selectedResult.priority} 
                      size="small" 
                      color={selectedResult.priority === 'urgent' || selectedResult.priority === 'stat' ? 'error' : 'default'}
                      sx={{ fontWeight: 'bold', borderRadius: '4px' }}
                    />
                  </Box>
                )}
                {selectedResult.authoredOn && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">Ordered Date</Typography>
                    <Typography variant="body2">
                      {new Date(selectedResult.authoredOn).toLocaleString()}
                    </Typography>
                  </Box>
                )}
                {selectedResult.requester?.display && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">Ordered By</Typography>
                    <Typography variant="body2">{selectedResult.requester.display}</Typography>
                  </Box>
                )}
                {selectedResult.dosageInstruction?.[0]?.text && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">Instructions</Typography>
                    <Typography variant="body2">{selectedResult.dosageInstruction[0].text}</Typography>
                  </Box>
                )}
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Full Resource Data
                  </Typography>
                  <Box 
                    component="pre" 
                    sx={{ 
                      bgcolor: 'grey.50', 
                      p: 2, 
                      borderRadius: 0,
                      overflow: 'auto',
                      fontSize: '0.875rem',
                      maxHeight: 400
                    }}
                  >
                    {JSON.stringify(selectedResult, null, 2)}
                  </Box>
                </Box>
              </Stack>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setDetailsDialogOpen(false);
            setSelectedResult(null);
          }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default React.memo(EnhancedOrdersTab);