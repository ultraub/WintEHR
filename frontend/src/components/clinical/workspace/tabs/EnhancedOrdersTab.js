/**
 * Enhanced Orders Tab Component
 * Comprehensive CPOE system with advanced FHIR R4 search capabilities
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Grid,
  Typography,
  Chip,
  Stack,
  Button,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Badge,
  SpeedDial,
  SpeedDialIcon,
  SpeedDialAction,
  Snackbar,
  useTheme,
  alpha
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
  Refresh as RefreshIcon,
  Analytics as AnalyticsIcon
} from '@mui/icons-material';
import { format, parseISO } from 'date-fns';

// Enhanced components and hooks
import AdvancedOrderFilters from './components/AdvancedOrderFilters';
import { useAdvancedOrderSearch } from '../../../hooks/useAdvancedOrderSearch';
import { useFHIRResource } from '../../../contexts/FHIRResourceContext';
import { useClinicalWorkflow, CLINICAL_EVENTS } from '../../../contexts/ClinicalWorkflowContext';
import VirtualizedList from '../../common/VirtualizedList';
import { exportClinicalData, EXPORT_COLUMNS } from '../../../core/export/exportUtils';
import { getMedicationName } from '../../../core/fhir/utils/medicationDisplayUtils';
import { useCDS, CDS_HOOK_TYPES } from '../../../contexts/CDSContext';

// Existing dialogs
import CPOEDialog from './dialogs/CPOEDialog';
import QuickOrderDialog from './dialogs/QuickOrderDialog';
import OrderSigningDialog from './dialogs/OrderSigningDialog';

// Enhanced components (to be created)
import OrderStatisticsPanel from './components/OrderStatisticsPanel';
import OrderCard from './components/OrderCard';

const EnhancedOrdersTab = ({ patientId, onNotificationUpdate }) => {
  const theme = useTheme();
  const { currentPatient } = useFHIRResource();
  const { publish } = useClinicalWorkflow();
  const { executeCDSHooks, getAlerts } = useCDS();

  // Enhanced search hook
  const {
    filters,
    results,
    loading,
    error,
    statistics,
    activeFilterCount,
    updateFilters,
    clearFilters,
    refreshSearch,
    searchWithText,
    loadStatistics,
    getRelatedOrders
  } = useAdvancedOrderSearch(patientId);

  // UI State
  const [tabValue, setTabValue] = useState(0);
  const [selectedOrders, setSelectedOrders] = useState(new Set());
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [speedDialOpen, setSpeedDialOpen] = useState(false);
  const [quickOrderDialog, setQuickOrderDialog] = useState({ open: false, type: null });
  const [cpoeDialogOpen, setCpoeDialogOpen] = useState(false);
  const [signOrdersDialog, setSignOrdersDialog] = useState({ open: false, orders: [] });
  const [exportAnchorEl, setExportAnchorEl] = useState(null);
  const [showStatistics, setShowStatistics] = useState(false);

  // Mock data for providers and locations (will be loaded from FHIR resources)
  const [availableProviders, setAvailableProviders] = useState([]);
  const [availableLocations, setAvailableLocations] = useState([]);
  const [availableOrganizations, setAvailableOrganizations] = useState([]);

  // Load provider and location data
  useEffect(() => {
    loadProviderData();
    loadLocationData();
    loadOrganizationData();
  }, []);

  const loadProviderData = async () => {
    try {
      // In a real implementation, this would fetch from FHIR Practitioner resources
      setAvailableProviders([
        { id: 'practitioner-1', name: 'Dr. John Smith' },
        { id: 'practitioner-2', name: 'Dr. Sarah Johnson' },
        { id: 'practitioner-3', name: 'Dr. Michael Brown' },
        { id: 'practitioner-4', name: 'Dr. Emily Davis' }
      ]);
    } catch (error) {
      // Error loading providers - filter options will be limited
    }
  };

  const loadLocationData = async () => {
    try {
      // In a real implementation, this would fetch from FHIR Location resources
      setAvailableLocations([
        { id: 'location-1', name: 'Main Hospital - East Wing' },
        { id: 'location-2', name: 'Outpatient Clinic - Building A' },
        { id: 'location-3', name: 'Emergency Department' },
        { id: 'location-4', name: 'ICU - Floor 3' }
      ]);
    } catch (error) {
      // Error loading locations - filter options will be limited
    }
  };

  const loadOrganizationData = async () => {
    try {
      // In a real implementation, this would fetch from FHIR Organization resources
      setAvailableOrganizations([
        { id: 'org-1', name: 'Internal Medicine Department' },
        { id: 'org-2', name: 'Cardiology Department' },
        { id: 'org-3', name: 'Pharmacy Services' },
        { id: 'org-4', name: 'Laboratory Services' }
      ]);
    } catch (error) {
      // Error loading organizations - filter options will be limited
    }
  };

  // Process results for display
  const processedResults = useMemo(() => {
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

  const handleSelectAll = (event) => {
    if (event.target.checked) {
      const newSelected = new Set(currentOrders.map(o => o.id));
      setSelectedOrders(newSelected);
    } else {
      setSelectedOrders(new Set());
    }
  };

  // Order action handlers
  const handleOrderAction = async (order, action) => {
    try {
      switch (action) {
        case 'view':
          // Handle view order details
          break;
        case 'edit':
          // Handle edit order
          break;
        case 'cancel':
          // Handle cancel order
          break;
        case 'send':
          // Handle send to pharmacy
          await handleSendToPharmacy(order);
          break;
        case 'reorder':
          // Handle reorder
          break;
        default:
          break;
      }
    } catch (error) {
      // Order action error - showing user notification
      setSnackbar({
        open: true,
        message: `Failed to ${action} order: ${error.message}`,
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

  if (loading && !results.entries.length) {
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
              >
                Sign Orders ({selectedOrders.size})
              </Button>
              <Button
                variant="outlined"
                startIcon={<SendIcon />}
                onClick={() => {/* Handle batch send to pharmacy */}}
              >
                Send to Pharmacy
              </Button>
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={() => {/* Handle batch cancel */}}
              >
                Cancel Selected
              </Button>
            </>
          )}
          <Button
            variant="outlined"
            startIcon={<AnalyticsIcon />}
            onClick={() => setShowStatistics(!showStatistics)}
          >
            Statistics
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCpoeDialogOpen(true)}
          >
            CPOE Order Entry
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
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="subtitle2">
            {urgentOrdersCount} urgent orders require immediate attention
          </Typography>
        </Alert>
      )}

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Advanced Filters */}
      <AdvancedOrderFilters
        filters={filters}
        onFiltersChange={updateFilters}
        onSavePreset={handleSaveFilterPreset}
        availableProviders={availableProviders}
        availableLocations={availableLocations}
        availableOrganizations={availableOrganizations}
        activeFilterCount={activeFilterCount}
        loading={loading}
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
        />
        <Chip 
          label={`${processedResults.medications.filter(o => o.status === 'active').length} Active Medications`} 
          color="info" 
        />
        <Chip 
          label={`${processedResults.lab.filter(o => o.status === 'active').length} Pending Labs`} 
          color="warning" 
        />
        <Chip 
          label={`Total: ${results.total}`} 
          color="default" 
        />
        {loading && (
          <Chip 
            label="Searching..." 
            color="default"
            icon={<CircularProgress size={16} />}
          />
        )}
      </Stack>

      {/* Tabs */}
      <Tabs 
        value={tabValue} 
        onChange={(e, newValue) => setTabValue(newValue)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mb: 3 }}
      >
        <Tab label={`All Orders (${processedResults.all.length})`} />
        <Tab label={`Medications (${processedResults.medications.length})`} />
        <Tab label={`Lab Orders (${processedResults.lab.length})`} />
        <Tab label={`Imaging (${processedResults.imaging.length})`} />
        <Tab label={`Other (${processedResults.other.length})`} />
      </Tabs>

      {/* Orders List */}
      {currentOrders.length === 0 ? (
        <Alert severity="info">
          {loading ? 'Searching for orders...' : 'No orders found matching your criteria'}
        </Alert>
      ) : currentOrders.length > 20 ? (
        // Use virtual scrolling for large lists
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
            />
          )}
        />
      ) : (
        // Use regular rendering for small lists
        <Box>
          {currentOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              selected={selectedOrders.has(order.id)}
              onSelect={handleSelectOrder}
              onAction={handleOrderAction}
              getRelatedOrders={getRelatedOrders}
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
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default React.memo(EnhancedOrdersTab);