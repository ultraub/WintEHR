/**
 * Prescription Status Dashboard
 * Overview of all prescription statuses for a patient
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
  Stack,
  IconButton,
  Button,
  TextField,
  InputAdornment,
  Menu,
  MenuItem,
  Divider,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Dialog,
  useTheme,
  alpha
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Medication as MedicationIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Refresh as RefreshIcon,
  TrendingUp as ActiveIcon,
  CheckCircle as CompletedIcon,
  Schedule as PendingIcon,
  Warning as AlertIcon,
  MoreVert as MoreIcon,
  CalendarMonth as DateIcon,
  LocalPharmacy as PharmacyIcon
} from '@mui/icons-material';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { prescriptionStatusService } from '../../../services/prescriptionStatusService';
import { useFHIRResource } from '../../../contexts/FHIRResourceContext';
import PrescriptionStatusTracker from './PrescriptionStatusTracker';

const PrescriptionStatusDashboard = ({ patientId }) => {
  const theme = useTheme();
  const { currentPatient } = useFHIRResource();
  
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedPrescription, setSelectedPrescription] = useState(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);

  // Statistics
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    pending: 0,
    completed: 0,
    issues: 0
  });

  // Load prescriptions and their statuses
  const loadPrescriptions = useCallback(async () => {
    if (!patientId) return;

    try {
      setLoading(true);
      setError(null);

      // Determine date range based on filter
      let dateRange = null;
      if (dateFilter !== 'all') {
        const now = new Date();
        switch (dateFilter) {
          case '7days':
            dateRange = {
              start: startOfDay(subDays(now, 7)),
              end: endOfDay(now)
            };
            break;
          case '30days':
            dateRange = {
              start: startOfDay(subDays(now, 30)),
              end: endOfDay(now)
            };
            break;
          case '90days':
            dateRange = {
              start: startOfDay(subDays(now, 90)),
              end: endOfDay(now)
            };
            break;
          default:
            break;
        }
      }

      const statuses = await prescriptionStatusService.getPatientPrescriptionStatuses(
        patientId,
        { status: statusFilter, dateRange }
      );

      setPrescriptions(statuses);

      // Calculate statistics
      const newStats = {
        total: statuses.length,
        active: 0,
        pending: 0,
        completed: 0,
        issues: 0
      };

      statuses.forEach(p => {
        switch (p.status) {
          case 'ORDERED':
          case 'TRANSMITTED':
          case 'RECEIVED':
          case 'IN_PROGRESS':
          case 'READY':
            newStats.active++;
            if (['ORDERED', 'TRANSMITTED'].includes(p.status)) {
              newStats.pending++;
            }
            break;
          case 'DISPENSED':
            newStats.completed++;
            break;
          case 'ON_HOLD':
          case 'CANCELLED':
          case 'REJECTED':
          case 'RETURNED':
            newStats.issues++;
            break;
          default:
            break;
        }
      });

      setStats(newStats);

    } catch (err) {
      setError('Failed to load prescriptions');
    } finally {
      setLoading(false);
    }
  }, [patientId, statusFilter, dateFilter]);

  useEffect(() => {
    loadPrescriptions();
  }, [loadPrescriptions]);

  // Filter prescriptions based on search
  const filteredPrescriptions = prescriptions.filter(p => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      p.medication?.toLowerCase().includes(query) ||
      p.prescriber?.toLowerCase().includes(query) ||
      p.display?.toLowerCase().includes(query)
    );
  });

  // Group prescriptions by status category
  const groupedPrescriptions = {
    active: filteredPrescriptions.filter(p => 
      ['ORDERED', 'TRANSMITTED', 'RECEIVED', 'IN_PROGRESS', 'READY'].includes(p.status)
    ),
    completed: filteredPrescriptions.filter(p => p.status === 'DISPENSED'),
    issues: filteredPrescriptions.filter(p => 
      ['ON_HOLD', 'CANCELLED', 'REJECTED', 'RETURNED'].includes(p.status)
    )
  };

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleViewDetails = (prescription) => {
    setSelectedPrescription(prescription);
    setShowDetailsDialog(true);
    handleMenuClose();
  };

  const renderPrescriptionItem = (prescription) => (
    <ListItem key={prescription.medicationRequestId} divider>
      <ListItemIcon>
        <MedicationIcon color={prescription.color || 'action'} />
      </ListItemIcon>
      <ListItemText
        primary={
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body1">{prescription.medication}</Typography>
            <Chip
              size="small"
              label={prescription.display}
              color={prescription.color || 'default'}
            />
          </Stack>
        }
        secondary={
          <Stack spacing={0.5}>
            {prescription.dosageInstructions && (
              <Typography variant="caption">
                {prescription.dosageInstructions}
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary">
              Ordered: {format(new Date(prescription.authoredOn), 'MMM d, yyyy')} • 
              {prescription.prescriber || 'Unknown prescriber'}
            </Typography>
          </Stack>
        }
      />
      <ListItemSecondaryAction>
        <IconButton edge="end" onClick={() => handleViewDetails(prescription)}>
          <MoreIcon />
        </IconButton>
      </ListItemSecondaryAction>
    </ListItem>
  );

  if (loading && prescriptions.length === 0) {
    return (
      <Box display="flex" justifyContent="center" p={3}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">
          <DashboardIcon sx={{ mr: 1, verticalAlign: 'bottom' }} />
          Prescription Status Dashboard
        </Typography>
        <Button
          startIcon={<RefreshIcon />}
          onClick={loadPrescriptions}
          disabled={loading}
        >
          Refresh
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
      )}

      {/* Statistics Cards */}
      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography color="text.secondary" variant="body2">
                    Total Prescriptions
                  </Typography>
                  <Typography variant="h4">{stats.total}</Typography>
                </Box>
                <MedicationIcon sx={{ fontSize: 40, color: 'primary.main', opacity: 0.3 }} />
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography color="text.secondary" variant="body2">
                    Active
                  </Typography>
                  <Typography variant="h4" color="info.main">{stats.active}</Typography>
                </Box>
                <ActiveIcon sx={{ fontSize: 40, color: 'info.main', opacity: 0.3 }} />
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography color="text.secondary" variant="body2">
                    Completed
                  </Typography>
                  <Typography variant="h4" color="success.main">{stats.completed}</Typography>
                </Box>
                <CompletedIcon sx={{ fontSize: 40, color: 'success.main', opacity: 0.3 }} />
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography color="text.secondary" variant="body2">
                    Issues
                  </Typography>
                  <Typography variant="h4" color="error.main">{stats.issues}</Typography>
                </Box>
                <AlertIcon sx={{ fontSize: 40, color: 'error.main', opacity: 0.3 }} />
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search prescriptions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                )
              }}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              select
              size="small"
              label="Status Filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <FilterIcon />
                  </InputAdornment>
                )
              }}
            >
              <MenuItem value="all">All Statuses</MenuItem>
              <MenuItem value="active">Active Only</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
              <MenuItem value="on-hold">On Hold</MenuItem>
              <MenuItem value="cancelled">Cancelled</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              select
              size="small"
              label="Date Range"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <DateIcon />
                  </InputAdornment>
                )
              }}
            >
              <MenuItem value="all">All Time</MenuItem>
              <MenuItem value="7days">Last 7 Days</MenuItem>
              <MenuItem value="30days">Last 30 Days</MenuItem>
              <MenuItem value="90days">Last 90 Days</MenuItem>
            </TextField>
          </Grid>
        </Grid>
      </Paper>

      {/* Prescription Lists */}
      {filteredPrescriptions.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            No prescriptions found matching your criteria
          </Typography>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {/* Active Prescriptions */}
          {groupedPrescriptions.active.length > 0 && (
            <Grid item xs={12} lg={4}>
              <Paper>
                <Box p={2} bgcolor={alpha(theme.palette.info.main, 0.08)}>
                  <Typography variant="h6" color="info.main">
                    Active Prescriptions ({groupedPrescriptions.active.length})
                  </Typography>
                </Box>
                <List>
                  {groupedPrescriptions.active.map(renderPrescriptionItem)}
                </List>
              </Paper>
            </Grid>
          )}

          {/* Completed Prescriptions */}
          {groupedPrescriptions.completed.length > 0 && (
            <Grid item xs={12} lg={4}>
              <Paper>
                <Box p={2} bgcolor={alpha(theme.palette.success.main, 0.08)}>
                  <Typography variant="h6" color="success.main">
                    Completed ({groupedPrescriptions.completed.length})
                  </Typography>
                </Box>
                <List>
                  {groupedPrescriptions.completed.map(renderPrescriptionItem)}
                </List>
              </Paper>
            </Grid>
          )}

          {/* Issues */}
          {groupedPrescriptions.issues.length > 0 && (
            <Grid item xs={12} lg={4}>
              <Paper>
                <Box p={2} bgcolor={alpha(theme.palette.error.main, 0.08)}>
                  <Typography variant="h6" color="error.main">
                    Issues ({groupedPrescriptions.issues.length})
                  </Typography>
                </Box>
                <List>
                  {groupedPrescriptions.issues.map(renderPrescriptionItem)}
                </List>
              </Paper>
            </Grid>
          )}
        </Grid>
      )}

      {/* Prescription Details Dialog */}
      <Dialog
        open={showDetailsDialog}
        onClose={() => setShowDetailsDialog(false)}
        maxWidth="md"
        fullWidth
      >
        {selectedPrescription && (
          <Box p={2}>
            <Typography variant="h6" gutterBottom>
              {selectedPrescription.medication}
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <PrescriptionStatusTracker
              medicationRequestId={selectedPrescription.medicationRequestId}
              showHistory={true}
              allowManualUpdate={true}
            />
          </Box>
        )}
      </Dialog>
    </Box>
  );
};

export default PrescriptionStatusDashboard;