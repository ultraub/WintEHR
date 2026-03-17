import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Alert,
  Button,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  TextField,
  MenuItem,
  Grid,
  Paper,
  Tooltip,
  IconButton,
  Collapse
} from '@mui/material';
import {
  Security as AuditIcon,
  GetApp as ExportIcon,
  Refresh as RefreshIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Schedule as TimeIcon,
  KeyboardArrowDown as ExpandIcon,
  KeyboardArrowUp as CollapseIcon
} from '@mui/icons-material';
import api from '../services/api';
import ClinicalLoadingState from '../components/clinical/shared/ClinicalLoadingState';

/**
 * AuditTrailPage - Displays CDS audit events fetched from the backend.
 *
 * Data source: /api/audit/history (CDS Hooks audit trail)
 * and /api/audit/analytics for summary statistics.
 *
 * Note: This page shows CDS-related audit events (clinical decision support
 * actions such as order creation, prescriptions, updates, and deletions).
 */
const AuditTrailPage = () => {
  // Data state
  const [auditEvents, setAuditEvents] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Expanded row state
  const [expandedRow, setExpandedRow] = useState(null);

  // Filter state
  const [filters, setFilters] = useState({
    actionType: 'all',
    outcome: 'all',
    dateFrom: '',
    dateTo: ''
  });

  const fetchAuditData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Build query params for audit history
      const params = {
        limit: 200,
        include_system_info: true
      };

      if (filters.actionType !== 'all') {
        params.action_type = filters.actionType;
      }
      if (filters.outcome !== 'all') {
        params.outcome = filters.outcome;
      }
      if (filters.dateFrom) {
        params.date_from = filters.dateFrom;
      }
      if (filters.dateTo) {
        params.date_to = filters.dateTo;
      }

      // Fetch audit history and analytics in parallel
      const [historyRes, analyticsRes] = await Promise.allSettled([
        api.get('/api/audit/history', { params }),
        api.get('/api/audit/analytics', { params: { days: 30 } })
      ]);

      if (historyRes.status === 'fulfilled') {
        const historyData = historyRes.value.data;
        setAuditEvents(historyData.events || []);
      } else {
        // If history endpoint fails, set empty and show warning
        setAuditEvents([]);
        setError('Unable to fetch audit history. The CDS audit trail may not have any recorded events yet.');
      }

      if (analyticsRes.status === 'fulfilled') {
        setAnalytics(analyticsRes.value.data);
      }
    } catch (err) {
      console.error('Failed to fetch audit data:', err);
      setError(
        err.response?.data?.detail ||
        'Failed to load audit data. Ensure the backend is running.'
      );
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchAuditData();
  }, [fetchAuditData]);

  // Apply client-side filtering for fields the backend doesn't filter on its own
  const filteredEvents = useMemo(() => {
    return auditEvents;
  }, [auditEvents]);

  const handleFilterChange = (field) => (event) => {
    setFilters((prev) => ({
      ...prev,
      [field]: event.target.value
    }));
  };

  const getOutcomeColor = (outcome) => {
    switch (outcome) {
      case '0': return 'success';
      case '4': return 'warning';
      case '8': return 'error';
      case '12': return 'error';
      default: return 'default';
    }
  };

  const getOutcomeLabel = (outcome) => {
    switch (outcome) {
      case '0': return 'Success';
      case '4': return 'Minor Failure';
      case '8': return 'Serious Failure';
      case '12': return 'Major Failure';
      default: return outcome || 'Unknown';
    }
  };

  const getActionTypeLabel = (actionType) => {
    const labels = {
      create: 'Create',
      update: 'Update',
      delete: 'Delete',
      order: 'Order',
      prescribe: 'Prescribe',
      schedule: 'Schedule'
    };
    return labels[actionType] || actionType || 'Unknown';
  };

  const formatTimestamp = (isoString) => {
    if (!isoString) return 'N/A';
    try {
      const date = new Date(isoString);
      return date.toLocaleString();
    } catch {
      return isoString;
    }
  };

  const handleExport = () => {
    if (filteredEvents.length === 0) return;

    const csvRows = [
      ['Timestamp', 'Action', 'User', 'Patient', 'Service', 'Outcome', 'Message', 'Execution Time (ms)']
    ];

    filteredEvents.forEach((event) => {
      csvRows.push([
        event.recorded || '',
        event.action_type || '',
        event.user_id || '',
        event.patient_id || '',
        event.service_id || '',
        getOutcomeLabel(event.outcome),
        (event.message || '').replace(/,/g, ';'),
        event.execution_time_ms || ''
      ]);
    });

    const csvContent = csvRows.map((row) => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit_trail_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Summary stats computed from real data
  const summaryStats = useMemo(() => {
    if (analytics) {
      return {
        totalEvents: analytics.total_executions || 0,
        successRate: analytics.success_rate != null ? analytics.success_rate.toFixed(1) : '0.0',
        avgExecutionTime: analytics.avg_execution_time_ms != null
          ? analytics.avg_execution_time_ms.toFixed(0)
          : '0',
        failedEvents: analytics.failed_executions || 0
      };
    }

    // Fallback: compute from loaded events
    const total = filteredEvents.length;
    const successful = filteredEvents.filter((e) => e.outcome === '0').length;
    const failed = filteredEvents.filter((e) => e.outcome !== '0').length;
    const executionTimes = filteredEvents
      .map((e) => e.execution_time_ms)
      .filter((t) => t > 0);
    const avgTime = executionTimes.length > 0
      ? (executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length).toFixed(0)
      : '0';

    return {
      totalEvents: total,
      successRate: total > 0 ? ((successful / total) * 100).toFixed(1) : '0.0',
      avgExecutionTime: avgTime,
      failedEvents: failed
    };
  }, [analytics, filteredEvents]);

  if (loading) {
    return (
      <Box sx={{ minHeight: 400, p: 3 }}>
        <ClinicalLoadingState.Table rows={8} columns={6} />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
        <AuditIcon color="primary" />
        <Typography variant="h4" component="h1">
          Audit Trail
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Tooltip title="Refresh audit data">
          <IconButton onClick={fetchAuditData} color="primary">
            <RefreshIcon />
          </IconButton>
        </Tooltip>
        <Button
          variant="contained"
          startIcon={<ExportIcon />}
          onClick={handleExport}
          disabled={filteredEvents.length === 0}
        >
          Export CSV
        </Button>
      </Stack>

      {/* Info banner */}
      <Alert severity="info" sx={{ mb: 3 }}>
        Showing CDS (Clinical Decision Support) audit events -- actions triggered by CDS Hooks
        such as order creation, medication prescriptions, resource updates, and deletions.
      </Alert>

      {/* Error state */}
      {error && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Summary Stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }} variant="outlined">
            <Stack alignItems="center" spacing={0.5}>
              <AuditIcon color="primary" />
              <Typography variant="h5">{summaryStats.totalEvents}</Typography>
              <Typography variant="body2" color="text.secondary">Total Events</Typography>
            </Stack>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }} variant="outlined">
            <Stack alignItems="center" spacing={0.5}>
              <SuccessIcon color="success" />
              <Typography variant="h5">{summaryStats.successRate}%</Typography>
              <Typography variant="body2" color="text.secondary">Success Rate</Typography>
            </Stack>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }} variant="outlined">
            <Stack alignItems="center" spacing={0.5}>
              <TimeIcon color="action" />
              <Typography variant="h5">{summaryStats.avgExecutionTime}ms</Typography>
              <Typography variant="body2" color="text.secondary">Avg Execution Time</Typography>
            </Stack>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }} variant="outlined">
            <Stack alignItems="center" spacing={0.5}>
              <ErrorIcon color="error" />
              <Typography variant="h5">{summaryStats.failedEvents}</Typography>
              <Typography variant="body2" color="text.secondary">Failed Events</Typography>
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
            <TextField
              select
              label="Action Type"
              value={filters.actionType}
              onChange={handleFilterChange('actionType')}
              size="small"
              sx={{ minWidth: 150 }}
            >
              <MenuItem value="all">All Actions</MenuItem>
              <MenuItem value="create">Create</MenuItem>
              <MenuItem value="update">Update</MenuItem>
              <MenuItem value="delete">Delete</MenuItem>
              <MenuItem value="order">Order</MenuItem>
              <MenuItem value="prescribe">Prescribe</MenuItem>
              <MenuItem value="schedule">Schedule</MenuItem>
            </TextField>

            <TextField
              select
              label="Outcome"
              value={filters.outcome}
              onChange={handleFilterChange('outcome')}
              size="small"
              sx={{ minWidth: 150 }}
            >
              <MenuItem value="all">All Outcomes</MenuItem>
              <MenuItem value="0">Success</MenuItem>
              <MenuItem value="4">Minor Failure</MenuItem>
              <MenuItem value="8">Serious Failure</MenuItem>
              <MenuItem value="12">Major Failure</MenuItem>
            </TextField>

            <TextField
              type="date"
              label="From Date"
              value={filters.dateFrom}
              onChange={handleFilterChange('dateFrom')}
              size="small"
              InputLabelProps={{ shrink: true }}
            />

            <TextField
              type="date"
              label="To Date"
              value={filters.dateTo}
              onChange={handleFilterChange('dateTo')}
              size="small"
              InputLabelProps={{ shrink: true }}
            />
          </Stack>
        </CardContent>
      </Card>

      {/* Audit Events Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Audit Events ({filteredEvents.length})
          </Typography>

          {filteredEvents.length === 0 ? (
            <Alert severity="info" sx={{ mt: 2 }}>
              No audit events found matching the current filters. CDS audit events are
              recorded when clinical decision support actions are executed (e.g., applying
              CDS suggestions, creating orders from CDS cards).
            </Alert>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox" />
                    <TableCell>Timestamp</TableCell>
                    <TableCell>Action</TableCell>
                    <TableCell>User</TableCell>
                    <TableCell>Patient</TableCell>
                    <TableCell>Service</TableCell>
                    <TableCell>Outcome</TableCell>
                    <TableCell>Message</TableCell>
                    <TableCell align="right">Time (ms)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredEvents.map((event, index) => {
                    const rowKey = event.execution_id || index;
                    const isExpanded = expandedRow === rowKey;
                    return (
                      <React.Fragment key={rowKey}>
                        <TableRow
                          hover
                          onClick={() => setExpandedRow(isExpanded ? null : rowKey)}
                          sx={{
                            cursor: 'pointer',
                            '& > *': { borderBottom: isExpanded ? 'unset' : undefined }
                          }}
                        >
                          <TableCell padding="checkbox">
                            <IconButton
                              size="small"
                              aria-label={isExpanded ? 'Collapse row' : 'Expand row'}
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedRow(isExpanded ? null : rowKey);
                              }}
                            >
                              {isExpanded ? <CollapseIcon /> : <ExpandIcon />}
                            </IconButton>
                          </TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            {formatTimestamp(event.recorded)}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={getActionTypeLabel(event.action_type)}
                              size="small"
                              variant="outlined"
                              color="primary"
                            />
                          </TableCell>
                          <TableCell>{event.user_id || 'System'}</TableCell>
                          <TableCell
                            sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
                          >
                            {event.patient_id || 'N/A'}
                          </TableCell>
                          <TableCell
                            sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
                          >
                            {event.service_id || 'N/A'}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={getOutcomeLabel(event.outcome)}
                              color={getOutcomeColor(event.outcome)}
                              size="small"
                            />
                          </TableCell>
                          <TableCell
                            sx={{
                              maxWidth: 300,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            <Tooltip title={event.message || ''} placement="top-start">
                              <span>{event.message || ''}</span>
                            </Tooltip>
                          </TableCell>
                          <TableCell align="right">
                            {event.execution_time_ms != null ? event.execution_time_ms : 'N/A'}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell sx={{ py: 0 }} colSpan={9}>
                            <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                              <Box sx={{ py: 2, px: 2 }}>
                                <Typography variant="subtitle2" gutterBottom>
                                  Event Details
                                </Typography>
                                <Grid container spacing={2}>
                                  <Grid item xs={12}>
                                    <Typography variant="body2" color="text.secondary" gutterBottom>
                                      <strong>Full Message:</strong>
                                    </Typography>
                                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mb: 1 }}>
                                      {event.message || 'No message available'}
                                    </Typography>
                                  </Grid>
                                  <Grid item xs={12} sm={6} md={3}>
                                    <Typography variant="caption" color="text.secondary">Execution ID</Typography>
                                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                      {event.execution_id || 'N/A'}
                                    </Typography>
                                  </Grid>
                                  <Grid item xs={12} sm={6} md={3}>
                                    <Typography variant="caption" color="text.secondary">Action Type</Typography>
                                    <Typography variant="body2">
                                      {getActionTypeLabel(event.action_type)}
                                    </Typography>
                                  </Grid>
                                  <Grid item xs={12} sm={6} md={3}>
                                    <Typography variant="caption" color="text.secondary">User</Typography>
                                    <Typography variant="body2">
                                      {event.user_id || 'System'}
                                    </Typography>
                                  </Grid>
                                  <Grid item xs={12} sm={6} md={3}>
                                    <Typography variant="caption" color="text.secondary">Patient ID</Typography>
                                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                      {event.patient_id || 'N/A'}
                                    </Typography>
                                  </Grid>
                                  <Grid item xs={12} sm={6} md={3}>
                                    <Typography variant="caption" color="text.secondary">Service ID</Typography>
                                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                      {event.service_id || 'N/A'}
                                    </Typography>
                                  </Grid>
                                  <Grid item xs={12} sm={6} md={3}>
                                    <Typography variant="caption" color="text.secondary">Outcome</Typography>
                                    <Typography variant="body2">
                                      {getOutcomeLabel(event.outcome)}
                                    </Typography>
                                  </Grid>
                                  <Grid item xs={12} sm={6} md={3}>
                                    <Typography variant="caption" color="text.secondary">Execution Time</Typography>
                                    <Typography variant="body2">
                                      {event.execution_time_ms != null ? `${event.execution_time_ms} ms` : 'N/A'}
                                    </Typography>
                                  </Grid>
                                  <Grid item xs={12} sm={6} md={3}>
                                    <Typography variant="caption" color="text.secondary">Recorded At</Typography>
                                    <Typography variant="body2">
                                      {event.recorded
                                        ? new Date(event.recorded).toLocaleString(undefined, {
                                            weekday: 'short',
                                            year: 'numeric',
                                            month: 'short',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit',
                                            second: '2-digit'
                                          })
                                        : 'N/A'}
                                    </Typography>
                                  </Grid>
                                  {event.hook_id && (
                                    <Grid item xs={12} sm={6} md={3}>
                                      <Typography variant="caption" color="text.secondary">Hook ID</Typography>
                                      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                        {event.hook_id}
                                      </Typography>
                                    </Grid>
                                  )}
                                  {event.resource_type && (
                                    <Grid item xs={12} sm={6} md={3}>
                                      <Typography variant="caption" color="text.secondary">Resource Type</Typography>
                                      <Typography variant="body2">
                                        {event.resource_type}
                                      </Typography>
                                    </Grid>
                                  )}
                                  {event.resource_id && (
                                    <Grid item xs={12} sm={6} md={3}>
                                      <Typography variant="caption" color="text.secondary">Resource ID</Typography>
                                      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                        {event.resource_id}
                                      </Typography>
                                    </Grid>
                                  )}
                                  {event.errors && event.errors.length > 0 && (
                                    <Grid item xs={12}>
                                      <Typography variant="caption" color="text.secondary">Errors</Typography>
                                      <Typography variant="body2" color="error.main" sx={{ whiteSpace: 'pre-wrap' }}>
                                        {Array.isArray(event.errors) ? event.errors.join('\n') : event.errors}
                                      </Typography>
                                    </Grid>
                                  )}
                                  {event.warnings && event.warnings.length > 0 && (
                                    <Grid item xs={12}>
                                      <Typography variant="caption" color="text.secondary">Warnings</Typography>
                                      <Typography variant="body2" color="warning.main" sx={{ whiteSpace: 'pre-wrap' }}>
                                        {Array.isArray(event.warnings) ? event.warnings.join('\n') : event.warnings}
                                      </Typography>
                                    </Grid>
                                  )}
                                </Grid>
                              </Box>
                            </Collapse>
                          </TableCell>
                        </TableRow>
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Analytics Breakdown */}
      {analytics && (analytics.action_type_breakdown || analytics.service_breakdown) && (
        <Grid container spacing={2} sx={{ mt: 1 }}>
          {analytics.action_type_breakdown && Object.keys(analytics.action_type_breakdown).length > 0 && (
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Actions by Type
                  </Typography>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Action Type</TableCell>
                        <TableCell align="right">Count</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {Object.entries(analytics.action_type_breakdown).map(([type, count]) => (
                        <TableRow key={type}>
                          <TableCell>{getActionTypeLabel(type)}</TableCell>
                          <TableCell align="right">{count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </Grid>
          )}

          {analytics.service_breakdown && Object.keys(analytics.service_breakdown).length > 0 && (
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Actions by CDS Service
                  </Typography>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Service ID</TableCell>
                        <TableCell align="right">Count</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {Object.entries(analytics.service_breakdown).map(([service, count]) => (
                        <TableRow key={service}>
                          <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                            {service}
                          </TableCell>
                          <TableCell align="right">{count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>
      )}

      {/* Compliance & Security Features */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Compliance & Security Features
          </Typography>
          <Typography variant="body2" component="div">
            This audit trail tracks CDS Hooks action execution including:
          </Typography>
          <Typography variant="body2" component="div" sx={{ mt: 1 }}>
            &bull; CDS action execution tracking with timestamps and outcomes<br />
            &bull; User and patient association for every action<br />
            &bull; Resource creation, update, and deletion logging<br />
            &bull; Execution performance metrics (latency monitoring)<br />
            &bull; Error and warning capture per action<br />
            &bull; Service-level analytics and breakdown<br />
            &bull; CSV export for offline analysis and compliance reporting
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default AuditTrailPage;
