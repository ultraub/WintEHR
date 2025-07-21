/**
 * PharmacyPage Component
 * Standalone pharmacy workflow management with kanban-style queue
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  IconButton,
  Button,
  TextField,
  InputAdornment,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  Card,
  CardContent,
  Stack,
  Chip,
  Alert,
  CircularProgress,
  useTheme,
  alpha,
  Tooltip,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon
} from '@mui/material';
import SafeBadge from '../components/common/SafeBadge';
import {
  LocalPharmacy as PharmacyIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Refresh as RefreshIcon,
  Print as PrintIcon,
  Inventory as InventoryIcon,
  Add as AddIcon,
  Schedule as PendingIcon,
  VerifiedUser as VerifyIcon,
  LocalShipping as DispenseIcon,
  CheckCircle as ReadyIcon,
  Assignment as OrderIcon,
  Timeline as AnalyticsIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import { format } from 'date-fns';

// Import pharmacy components
import PharmacyQueue from '../components/pharmacy/PharmacyQueue';
import PharmacyAnalytics from '../components/pharmacy/PharmacyAnalytics';

// Services
import { fhirClient } from '../core/fhir/services/fhirClient';

// Context
import { useFHIRResource } from '../contexts/FHIRResourceContext';
import { useClinicalWorkflow } from '../contexts/ClinicalWorkflowContext';

const PharmacyPage = () => {
  const theme = useTheme();
  const { isLoading } = useFHIRResource();
  const { subscribe, publish, CLINICAL_EVENTS } = useClinicalWorkflow();
  
  // State
  const [activeView, setActiveView] = useState('queue'); // 'queue' | 'analytics'
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [selectedDateRange, setSelectedDateRange] = useState('today');
  const [refreshing, setRefreshing] = useState(false);
  const [medicationRequests, setMedicationRequests] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [queueStats, setQueueStats] = useState({
    newOrders: 0,
    verification: 0,
    dispensing: 0,
    ready: 0,
    total: 0
  });

  // Fetch all medication requests on mount
  useEffect(() => {
    const fetchMedicationRequests = async () => {
      try {
        setDataLoading(true);
        const result = await fhirClient.search('MedicationRequest', { 
          _count: 50,
          _summary: 'true'  // Only essential fields for list view
        });
        const resources = result.resources || [];
        setMedicationRequests(resources);
      } catch (error) {
        
        setMedicationRequests([]);
      } finally {
        setDataLoading(false);
      }
    };

    fetchMedicationRequests();
  }, []);

  // Get all medication requests for the pharmacy queue
  const allMedicationRequests = medicationRequests;
  
  // Filter and categorize medication requests
  const pharmacyQueue = useMemo(() => {
    let filtered = allMedicationRequests;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(req => {
        const medicationName = req.medicationCodeableConcept?.text || 
                              req.medicationCodeableConcept?.coding?.[0]?.display || '';
        const patientRef = req.subject?.display || req.subject?.reference || '';
        return medicationName.toLowerCase().includes(searchTerm.toLowerCase()) ||
               patientRef.toLowerCase().includes(searchTerm.toLowerCase());
      });
    }

    // Apply status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(req => req.status === filterStatus);
    }

    // Date filter
    const now = new Date();
    let startDate;
    switch (selectedDateRange) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default:
        startDate = null;
    }

    if (startDate) {
      filtered = filtered.filter(req => {
        const authoredDate = new Date(req.authoredOn);
        return authoredDate >= startDate;
      });
    }

    return filtered;
  }, [allMedicationRequests, searchTerm, filterStatus, selectedDateRange]);

  // Helper function to determine pharmacy status
  const getPharmacyStatus = useCallback((medicationRequest) => {
    // Check for pharmacy status extension
    const extensions = medicationRequest.extension || [];
    for (const ext of extensions) {
      if (ext.url === 'http://wintehr.com/fhir/StructureDefinition/pharmacy-status') {
        for (const subExt of ext.extension || []) {
          if (subExt.url === 'status') {
            return subExt.valueString;
          }
        }
      }
    }

    // Default logic based on medication request status and timing
    const status = medicationRequest.status;
    if (status === 'completed') return 'ready';
    if (status === 'cancelled' || status === 'stopped') return 'ready';
    
    // Check how long since prescribed
    const authoredDate = new Date(medicationRequest.authoredOn);
    const hoursSince = (new Date() - authoredDate) / (1000 * 60 * 60);
    
    if (hoursSince < 1) return 'newOrders';
    if (hoursSince < 4) return 'verification';
    return 'dispensing';
  }, []);

  // Categorize queue items by pharmacy status
  const queueCategories = useMemo(() => {
    const categories = {
      newOrders: [],
      verification: [],
      dispensing: [],
      ready: []
    };

    pharmacyQueue.forEach(request => {
      const pharmacyStatus = getPharmacyStatus(request);
      if (categories[pharmacyStatus]) {
        categories[pharmacyStatus].push(request);
      }
    });

    return categories;
  }, [pharmacyQueue, getPharmacyStatus]);

  // Update queue statistics
  useEffect(() => {
    setQueueStats({
      newOrders: queueCategories.newOrders.length,
      verification: queueCategories.verification.length,
      dispensing: queueCategories.dispensing.length,
      ready: queueCategories.ready.length,
      total: pharmacyQueue.length
    });
  }, [queueCategories, pharmacyQueue.length]);

  // Handle queue refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const result = await fhirClient.search('MedicationRequest', { _count: 1000 });
      const resources = result.resources || [];
      setMedicationRequests(resources);
    } catch (error) {
      
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Subscribe to clinical workflow events
  useEffect(() => {
    const unsubscribeNewPrescription = subscribe(CLINICAL_EVENTS.ORDER_PLACED, (data) => {
      if (data.category === 'medication') {
        // Refresh the queue when new prescriptions arrive
        handleRefresh();
      }
    });

    return () => {
      unsubscribeNewPrescription();
    };
  }, [subscribe, handleRefresh, CLINICAL_EVENTS.ORDER_PLACED]);

  // Handle status change for medication request
  const handleStatusChange = useCallback(async (medicationRequestId, newStatus, category) => {
    try {
      // Update pharmacy status via API
      const response = await fetch(`/api/clinical/pharmacy/status/${medicationRequestId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: newStatus,
          updated_by: 'current-pharmacist', // This would come from auth context
          notes: `Status changed to ${newStatus} via pharmacy queue`
        })
      });

      if (response.ok) {
        // Publish workflow event
        publish(CLINICAL_EVENTS.WORKFLOW_NOTIFICATION, {
          type: 'pharmacy_status_change',
          medicationRequestId,
          newStatus,
          category,
          timestamp: new Date().toISOString()
        });

        // Refresh queue to show changes
        handleRefresh();
      }
    } catch (error) {
      
    }
  }, [publish, handleRefresh, CLINICAL_EVENTS.WORKFLOW_NOTIFICATION]);

  // Speed dial actions
  const speedDialActions = [
    { icon: <RefreshIcon />, name: 'Refresh Queue', onClick: handleRefresh },
    { icon: <PrintIcon />, name: 'Print Labels', onClick: () => {} },
    { icon: <InventoryIcon />, name: 'Check Inventory', onClick: () => {} },
    { icon: <AnalyticsIcon />, name: 'View Analytics', onClick: () => setActiveView('analytics') },
    { icon: <AddIcon />, name: 'Manual Entry', onClick: () => {} }
  ];

  return (
    <Box sx={{ p: 3, height: '100vh', overflow: 'auto' }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight="bold" color="primary.main">
            🏥 Pharmacy Management
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            System-wide medication dispensing & workflow
          </Typography>
        </Box>
        
        <Stack direction="row" spacing={2}>
          <Button
            variant={activeView === 'queue' ? 'contained' : 'outlined'}
            startIcon={<PharmacyIcon />}
            onClick={() => setActiveView('queue')}
          >
            Queue
          </Button>
          <Button
            variant={activeView === 'analytics' ? 'contained' : 'outlined'}
            startIcon={<AnalyticsIcon />}
            onClick={() => setActiveView('analytics')}
          >
            Analytics
          </Button>
        </Stack>
      </Stack>

      {/* Queue Overview Cards */}
      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{ bgcolor: alpha(theme.palette.warning.main, 0.1), border: `1px solid ${theme.palette.warning.main}` }}>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <SafeBadge badgeContent={queueStats.newOrders} color="warning" max={99}>
                <PendingIcon color="warning" sx={{ fontSize: 32 }} />
              </SafeBadge>
              <Typography variant="h6" color="warning.main" mt={1}>
                New Orders
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Awaiting review
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{ bgcolor: alpha(theme.palette.info.main, 0.1), border: `1px solid ${theme.palette.info.main}` }}>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <SafeBadge badgeContent={queueStats.verification} color="info" max={99}>
                <VerifyIcon color="info" sx={{ fontSize: 32 }} />
              </SafeBadge>
              <Typography variant="h6" color="info.main" mt={1}>
                Verification
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Under review
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1), border: `1px solid ${theme.palette.primary.main}` }}>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <SafeBadge badgeContent={queueStats.dispensing} color="primary" max={99}>
                <DispenseIcon color="primary" sx={{ fontSize: 32 }} />
              </SafeBadge>
              <Typography variant="h6" color="primary.main" mt={1}>
                Dispensing
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Being filled
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{ bgcolor: alpha(theme.palette.success.main, 0.1), border: `1px solid ${theme.palette.success.main}` }}>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <SafeBadge badgeContent={queueStats.ready} color="success" max={99}>
                <ReadyIcon color="success" sx={{ fontSize: 32 }} />
              </SafeBadge>
              <Typography variant="h6" color="success.main" mt={1}>
                Ready
              </Typography>
              <Typography variant="caption" color="text.secondary">
                For pickup
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{ bgcolor: alpha(theme.palette.grey[500], 0.1), border: `1px solid ${theme.palette.grey[500]}` }}>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <SafeBadge badgeContent={queueStats.total} color="primary" max={999}>
                <OrderIcon color="action" sx={{ fontSize: 32 }} />
              </SafeBadge>
              <Typography variant="h6" color="text.primary" mt={1}>
                Total
              </Typography>
              <Typography variant="caption" color="text.secondary">
                All prescriptions
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Search and Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              placeholder="Search medications, patients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                )
              }}
              size="small"
            />
          </Grid>
          
          <Grid item xs={12} md={2}>
            <FormControl fullWidth size="small">
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
          </Grid>
          
          <Grid item xs={12} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Date Range</InputLabel>
              <Select
                value={selectedDateRange}
                onChange={(e) => setSelectedDateRange(e.target.value)}
                label="Date Range"
              >
                <MenuItem value="today">Today</MenuItem>
                <MenuItem value="week">This Week</MenuItem>
                <MenuItem value="month">This Month</MenuItem>
                <MenuItem value="all">All Time</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button
                variant="outlined"
                startIcon={refreshing ? <CircularProgress size={16} /> : <RefreshIcon />}
                onClick={handleRefresh}
                disabled={refreshing}
              >
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </Button>
              <Button
                variant="outlined"
                startIcon={<PrintIcon />}
                onClick={() => window.print()}
              >
                Print Queue
              </Button>
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      {/* Main Content */}
      {activeView === 'queue' ? (
        <>
          {dataLoading ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          ) : queueStats.total === 0 ? (
            <Alert severity="info" sx={{ mt: 2 }}>
              No prescriptions found for the selected filters. 
              {searchTerm && (
                <Button 
                  size="small" 
                  onClick={() => setSearchTerm('')}
                  sx={{ ml: 1 }}
                >
                  Clear search
                </Button>
              )}
            </Alert>
          ) : (
            <PharmacyQueue
              queueCategories={queueCategories}
              onStatusChange={handleStatusChange}
              searchTerm={searchTerm}
            />
          )}
        </>
      ) : (
        <PharmacyAnalytics
          queueStats={queueStats}
          medicationRequests={pharmacyQueue}
        />
      )}

      {/* Speed Dial for Quick Actions */}
      <SpeedDial
        ariaLabel="Pharmacy actions"
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
        icon={<SpeedDialIcon />}
      >
        {speedDialActions.map((action) => (
          <SpeedDialAction
            key={action.name}
            icon={action.icon}
            tooltipTitle={action.name}
            onClick={action.onClick}
          />
        ))}
      </SpeedDial>
    </Box>
  );
};

export default PharmacyPage;