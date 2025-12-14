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
  Tooltip
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

const ServicesTable = ({ onSelectService, onRefresh }) => {
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

  const handleToggleStatus = async () => {
    if (!selectedService) return;

    try {
      const newStatus = selectedService.status === 'active' ? 'inactive' : 'active';
      await cdsStudioApi.updateServiceStatus(selectedService.service_id, newStatus);
      await loadServices();
    } catch (err) {
      setError(err.message);
    }
    handleMenuClose();
  };

  const handleDelete = async () => {
    if (!selectedService) return;

    if (window.confirm(`Delete service "${selectedService.title}"?`)) {
      try {
        await cdsStudioApi.deleteService(selectedService.service_id);
        await loadServices();
      } catch (err) {
        setError(err.message);
      }
    }
    handleMenuClose();
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
        <MenuItem onClick={handleToggleStatus}>
          {selectedService?.status === 'active' ? 'Deactivate' : 'Activate'}
        </MenuItem>
        <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
          Delete
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default ServicesTable;
