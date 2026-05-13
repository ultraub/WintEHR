import React, { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  CircularProgress,
  Alert,
  Box,
  Typography,
  TextField,
  InputAdornment,
  Select,
  FormControl,
  InputLabel,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Snackbar
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  CheckCircle as ActiveIcon,
  Cancel as InactiveIcon,
  Error as FailingIcon,
  Code as CodeIcon,
  Cloud as CloudIcon
} from '@mui/icons-material';
import cdsStudioApi from '../../services/cdsStudioApi';

const ServicesTable = ({ onSelectService, onEditService, onRefresh }) => {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    search: '',
    hook_type: '',
    origin: '',
    status: ''
  });
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  // Delete confirmation lives in its own state slot so closing the row
  // menu (which clears selectedService) doesn't strand the dialog with
  // nothing to act on. snackbar surfaces API failures that the inline
  // <Alert> would miss when triggered from inside the dialog.
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'error' });

  const loadServices = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await cdsStudioApi.listServices(filters);
      setServices(response.services);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadServices();
  }, [filters]);

  const handleMenuOpen = (event, service) => {
    setAnchorEl(event.currentTarget);
    setSelectedService(service);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedService(null);
  };

  const handleViewDetails = () => {
    if (selectedService) {
      onSelectService(selectedService);
    }
    handleMenuClose();
  };

  const handleEdit = () => {
    if (selectedService && onEditService) {
      onEditService(selectedService);
    }
    handleMenuClose();
  };

  const handleToggleStatus = async () => {
    if (!selectedService) return;
    const target = selectedService;
    handleMenuClose();

    try {
      const newStatus = target.status === 'active' ? 'inactive' : 'active';
      await cdsStudioApi.updateServiceStatus(target.service_id, newStatus);
      await loadServices();
    } catch (err) {
      setSnackbar({ open: true, message: err.message || 'Failed to update status', severity: 'error' });
    }
  };

  const openDeleteDialog = () => {
    if (!selectedService) return;
    // Capture the service object NOW — handleMenuClose() clears
    // selectedService and the dialog needs to remember which row to
    // delete on confirm. Without this snapshot, racing menu-close +
    // dialog-confirm could fire delete against null.
    setDeleteTarget(selectedService);
    handleMenuClose();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      // hard_delete=true so "Delete" actually removes the row from the DB
      // AND the PlanDefinition from HAPI. Without it the backend's
      // soft-delete path just flips status → INACTIVE, which is what
      // "Deactivate" already does from the same menu — making the two
      // menu items indistinguishable in effect. Users expect Delete to
      // be destructive; that's also what the confirmation copy implies.
      await cdsStudioApi.deleteService(deleteTarget.service_id, true);
      setDeleteTarget(null);
      await loadServices();
      setSnackbar({ open: true, message: `Deleted "${deleteTarget.title}"`, severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: err.message || 'Failed to delete service', severity: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active':
        return <ActiveIcon sx={{ color: 'success.main', fontSize: 20 }} />;
      case 'inactive':
        return <InactiveIcon sx={{ color: 'grey.500', fontSize: 20 }} />;
      case 'failing':
        return <FailingIcon sx={{ color: 'error.main', fontSize: 20 }} />;
      default:
        return null;
    }
  };

  const getOriginIcon = (origin) => {
    return origin === 'built-in' ? (
      <CodeIcon sx={{ fontSize: 16, mr: 0.5 }} />
    ) : (
      <CloudIcon sx={{ fontSize: 16, mr: 0.5 }} />
    );
  };

  const getOriginColor = (origin) => {
    return origin === 'built-in' ? 'primary' : 'warning';
  };

  if (loading && services.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Filters */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <TextField
          placeholder="Search services..."
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          size="small"
          sx={{ minWidth: 300 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            )
          }}
        />

        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Hook Type</InputLabel>
          <Select
            value={filters.hook_type}
            label="Hook Type"
            onChange={(e) => setFilters({ ...filters, hook_type: e.target.value })}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="patient-view">patient-view</MenuItem>
            <MenuItem value="medication-prescribe">medication-prescribe</MenuItem>
            <MenuItem value="order-select">order-select</MenuItem>
            <MenuItem value="order-sign">order-sign</MenuItem>
            <MenuItem value="encounter-start">encounter-start</MenuItem>
            <MenuItem value="encounter-discharge">encounter-discharge</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Origin</InputLabel>
          <Select
            value={filters.origin}
            label="Origin"
            onChange={(e) => setFilters({ ...filters, origin: e.target.value })}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="built-in">Built-in</MenuItem>
            <MenuItem value="external">External</MenuItem>
            <MenuItem value="custom">Custom</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={filters.status}
            label="Status"
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="inactive">Inactive</MenuItem>
            <MenuItem value="failing">Failing</MenuItem>
          </Select>
        </FormControl>

        <Tooltip title="Refresh">
          <IconButton onClick={loadServices} size="small">
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Services Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Service ID</TableCell>
              <TableCell>Title</TableCell>
              <TableCell>Hook Type</TableCell>
              <TableCell>Origin</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Version</TableCell>
              <TableCell align="right">Executions (24h)</TableCell>
              <TableCell align="right">Success Rate</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {services.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                    No services found
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              services.map((service) => (
                <TableRow
                  key={service.service_id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => onSelectService(service)}
                >
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace">
                      {service.service_id}
                    </Typography>
                  </TableCell>
                  <TableCell>{service.title}</TableCell>
                  <TableCell>
                    <Chip
                      label={service.hook_type}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      icon={getOriginIcon(service.origin)}
                      label={service.origin}
                      size="small"
                      color={getOriginColor(service.origin)}
                    />
                  </TableCell>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      {getStatusIcon(service.status)}
                      <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                        {service.status}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace">
                      {service.version}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">{service.execution_count_24h}</TableCell>
                  <TableCell align="right">
                    <Typography
                      variant="body2"
                      color={service.success_rate >= 95 ? 'success.main' : 'warning.main'}
                    >
                      {service.success_rate.toFixed(1)}%
                    </Typography>
                  </TableCell>
                  <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                    <IconButton
                      size="small"
                      onClick={(e) => handleMenuOpen(e, service)}
                    >
                      <MoreVertIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleViewDetails}>View Details</MenuItem>
        {/* Edit only applies to visual-builder-authored services. Built-in
            services live in code (no DB row to edit), and external services
            are HTTP endpoints owned elsewhere. */}
        {selectedService?.origin === 'visual-builder' && onEditService && (
          <MenuItem onClick={handleEdit}>Edit Service</MenuItem>
        )}
        <MenuItem onClick={handleToggleStatus}>
          {selectedService?.status === 'active' ? 'Deactivate' : 'Activate'}
        </MenuItem>
        <MenuItem onClick={openDeleteDialog} sx={{ color: 'error.main' }}>
          Delete
        </MenuItem>
      </Menu>

      {/* Delete confirmation — replaces window.confirm so styling
          matches the rest of the studio and works in environments where
          the native dialog is suppressed. deleteTarget gates the open
          state and carries the service through the async confirm. */}
      <Dialog open={Boolean(deleteTarget)} onClose={() => !deleting && setDeleteTarget(null)}>
        <DialogTitle>Delete service?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {deleteTarget && (
              <>
                This will remove <strong>{deleteTarget.title}</strong> (
                <code>{deleteTarget.service_id}</code>) from the registry.
                Execution history is preserved but the service stops firing.
              </>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting}>
            Cancel
          </Button>
          <Button onClick={confirmDelete} color="error" disabled={deleting} autoFocus>
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ServicesTable;
