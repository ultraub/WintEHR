import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format } from 'date-fns';
import InfoIcon from '@mui/icons-material/Info';
import FilterListIcon from '@mui/icons-material/FilterList';
import RefreshIcon from '@mui/icons-material/Refresh';
import { fhirApi } from '../services/api';

const AuditTrail = ({ patientId = null, resourceType = null, resourceId = null }) => {
  const [auditEvents, setAuditEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  
  // Filters
  const [filters, setFilters] = useState({
    dateFrom: null,
    dateTo: null,
    action: '',
    outcome: '',
    user: '',
    entity: resourceType && resourceId ? `${resourceType}/${resourceId}` : ''
  });

  const [showFilters, setShowFilters] = useState(false);

  // Action types
  const actionTypes = [
    { value: '', label: 'All Actions' },
    { value: 'C', label: 'Create' },
    { value: 'R', label: 'Read' },
    { value: 'U', label: 'Update' },
    { value: 'D', label: 'Delete' },
    { value: 'E', label: 'Execute' }
  ];

  // Outcome types
  const outcomeTypes = [
    { value: '', label: 'All Outcomes' },
    { value: '0', label: 'Success' },
    { value: '4', label: 'Minor Failure' },
    { value: '8', label: 'Major Failure' },
    { value: '12', label: 'Serious Failure' }
  ];

  const fetchAuditEvents = async () => {
    setLoading(true);
    setError(null);

    try {
      // Build search parameters
      const params = new URLSearchParams({
        _count: rowsPerPage.toString(),
        _offset: (page * rowsPerPage).toString()
      });

      // Add filters
      if (filters.dateFrom) {
        params.append('date', `ge${format(filters.dateFrom, 'yyyy-MM-dd')}`);
      }
      if (filters.dateTo) {
        params.append('date', `le${format(filters.dateTo, 'yyyy-MM-dd')}`);
      }
      if (filters.action) {
        params.append('action', filters.action);
      }
      if (filters.outcome) {
        params.append('outcome', filters.outcome);
      }
      if (filters.user) {
        params.append('agent', filters.user);
      }
      if (filters.entity) {
        params.append('entity', filters.entity);
      }
      if (patientId) {
        params.append('patient', `Patient/${patientId}`);
      }

      const response = await fhirApi.search('AuditEvent', params);

      if (response.entry) {
        setAuditEvents(response.entry.map(e => e.resource));
        setTotalCount(response.total || response.entry.length);
      } else {
        setAuditEvents([]);
        setTotalCount(0);
      }
    } catch (err) {
      console.error('Error fetching audit events:', err);
      setError('Failed to load audit trail');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditEvents();
  }, [page, rowsPerPage, filters, patientId, resourceType, resourceId]);

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
    setPage(0); // Reset to first page on filter change
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const getActionDisplay = (action) => {
    const actionMap = {
      'C': 'Create',
      'R': 'Read',
      'U': 'Update',
      'D': 'Delete',
      'E': 'Execute'
    };
    return actionMap[action] || action;
  };

  const getOutcomeDisplay = (outcome) => {
    const outcomeMap = {
      '0': { label: 'Success', color: 'success' },
      '4': { label: 'Minor Failure', color: 'warning' },
      '8': { label: 'Major Failure', color: 'error' },
      '12': { label: 'Serious Failure', color: 'error' }
    };
    const result = outcomeMap[outcome] || { label: 'Unknown', color: 'default' };
    return result;
  };

  const getEventTypeDisplay = (event) => {
    if (event.type?.display) {
      return event.type.display;
    }
    if (event.type?.code) {
      return event.type.code;
    }
    return 'Unknown';
  };

  const getAgentDisplay = (event) => {
    if (!event.agent || event.agent.length === 0) {
      return 'Unknown';
    }
    
    const primaryAgent = event.agent.find(a => a.requestor) || event.agent[0];
    
    if (primaryAgent.who?.display) {
      return primaryAgent.who.display;
    }
    if (primaryAgent.who?.reference) {
      return primaryAgent.who.reference.split('/').pop();
    }
    if (primaryAgent.name) {
      return primaryAgent.name;
    }
    
    return 'Unknown';
  };

  const getEntityDisplay = (event) => {
    if (!event.entity || event.entity.length === 0) {
      return '-';
    }
    
    const entities = event.entity.map(e => {
      if (e.what?.display) {
        return e.what.display;
      }
      if (e.what?.reference) {
        return e.what.reference;
      }
      return 'Unknown';
    });
    
    return entities.join(', ');
  };

  const renderFilters = () => (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Grid container spacing={2} alignItems="center">
        <Grid item xs={12}>
          <Typography variant="h6" gutterBottom>
            Filters
          </Typography>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              label="From Date"
              value={filters.dateFrom}
              onChange={(value) => handleFilterChange('dateFrom', value)}
              renderInput={(params) => <TextField {...params} fullWidth size="small" />}
            />
          </LocalizationProvider>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              label="To Date"
              value={filters.dateTo}
              onChange={(value) => handleFilterChange('dateTo', value)}
              renderInput={(params) => <TextField {...params} fullWidth size="small" />}
            />
          </LocalizationProvider>
        </Grid>
        
        <Grid item xs={12} sm={6} md={2}>
          <FormControl fullWidth size="small">
            <InputLabel>Action</InputLabel>
            <Select
              value={filters.action}
              onChange={(e) => handleFilterChange('action', e.target.value)}
              label="Action"
            >
              {actionTypes.map(type => (
                <MenuItem key={type.value} value={type.value}>
                  {type.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        
        <Grid item xs={12} sm={6} md={2}>
          <FormControl fullWidth size="small">
            <InputLabel>Outcome</InputLabel>
            <Select
              value={filters.outcome}
              onChange={(e) => handleFilterChange('outcome', e.target.value)}
              label="Outcome"
            >
              {outcomeTypes.map(type => (
                <MenuItem key={type.value} value={type.value}>
                  {type.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        
        <Grid item xs={12} sm={6} md={2}>
          <TextField
            fullWidth
            size="small"
            label="User"
            value={filters.user}
            onChange={(e) => handleFilterChange('user', e.target.value)}
            placeholder="User ID or name"
          />
        </Grid>
      </Grid>
    </Paper>
  );

  if (loading && auditEvents.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5">Audit Trail</Typography>
        <Box>
          <Tooltip title="Toggle Filters">
            <IconButton onClick={() => setShowFilters(!showFilters)} color="primary">
              <FilterListIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Refresh">
            <IconButton onClick={fetchAuditEvents} color="primary">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {showFilters && renderFilters()}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Date/Time</TableCell>
              <TableCell>Event Type</TableCell>
              <TableCell>Action</TableCell>
              <TableCell>User</TableCell>
              <TableCell>Entity</TableCell>
              <TableCell>Outcome</TableCell>
              <TableCell>Details</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {auditEvents.map((event) => (
              <TableRow key={event.id}>
                <TableCell>
                  {format(new Date(event.recorded), 'yyyy-MM-dd HH:mm:ss')}
                </TableCell>
                <TableCell>{getEventTypeDisplay(event)}</TableCell>
                <TableCell>{getActionDisplay(event.action)}</TableCell>
                <TableCell>{getAgentDisplay(event)}</TableCell>
                <TableCell>{getEntityDisplay(event)}</TableCell>
                <TableCell>
                  <Chip
                    label={getOutcomeDisplay(event.outcome).label}
                    color={getOutcomeDisplay(event.outcome).color}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Tooltip title="View Details">
                    <IconButton
                      size="small"
                      onClick={() => {
                        console.log('Audit Event Details:', event);
                        // TODO: Implement detail view modal
                      }}
                    >
                      <InfoIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
            {auditEvents.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography variant="body2" color="textSecondary">
                    No audit events found
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        component="div"
        count={totalCount}
        page={page}
        onPageChange={handleChangePage}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        rowsPerPageOptions={[10, 25, 50, 100]}
      />
    </Box>
  );
};

export default AuditTrail;