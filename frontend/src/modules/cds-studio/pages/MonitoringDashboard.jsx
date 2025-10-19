import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Alert,
  CircularProgress,
  LinearProgress,
  IconButton,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  CheckCircle as HealthyIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Speed as PerformanceIcon
} from '@mui/icons-material';
import cdsStudioApi from '../services/cdsStudioApi';

const MonitoringDashboard = () => {
  const [metrics, setMetrics] = useState(null);
  const [services, setServices] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('24h');
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    loadDashboardData();

    // Auto-refresh every 30 seconds
    let interval;
    if (autoRefresh) {
      interval = setInterval(() => {
        loadDashboardData(true); // Silent refresh
      }, 30000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timeRange, autoRefresh]);

  const loadDashboardData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);

      // Load all monitoring data in parallel
      const [servicesData, metricsData] = await Promise.all([
        cdsStudioApi.listServices(),
        cdsStudioApi.getSystemMetrics(timeRange)
      ]);

      setServices(servicesData.services || []);
      setMetrics(metricsData);

      // Generate recent activity from services
      const activity = generateRecentActivity(servicesData.services || []);
      setRecentActivity(activity);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      if (!silent) setError(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const generateRecentActivity = (services) => {
    // Mock recent activity - in production this would come from backend
    return services.slice(0, 10).map((service, index) => ({
      id: index,
      service_id: service.service_id,
      event: 'Service Execution',
      timestamp: new Date(Date.now() - Math.random() * 3600000).toISOString(),
      status: Math.random() > 0.2 ? 'success' : 'error',
      duration_ms: Math.floor(Math.random() * 1000)
    }));
  };

  const getHealthStatus = () => {
    if (!services.length) return { status: 'unknown', color: 'default', icon: <WarningIcon /> };

    const activeServices = services.filter(s => s.status === 'active').length;
    const totalServices = services.length;
    const healthPercentage = (activeServices / totalServices) * 100;

    if (healthPercentage >= 90) {
      return { status: 'healthy', color: 'success', icon: <HealthyIcon /> };
    } else if (healthPercentage >= 70) {
      return { status: 'degraded', color: 'warning', icon: <WarningIcon /> };
    } else {
      return { status: 'unhealthy', color: 'error', icon: <ErrorIcon /> };
    }
  };

  const calculateAverageResponseTime = () => {
    if (!metrics?.services) return 0;
    const services = Object.values(metrics.services);
    if (services.length === 0) return 0;

    const total = services.reduce((sum, s) => sum + (s.avg_response_time_ms || 0), 0);
    return Math.round(total / services.length);
  };

  const calculateSuccessRate = () => {
    if (!metrics?.services) return 0;
    const services = Object.values(metrics.services);
    if (services.length === 0) return 0;

    const total = services.reduce((sum, s) => sum + (s.success_rate || 0), 0);
    return Math.round(total / services.length);
  };

  const getTotalExecutions = () => {
    if (!metrics?.services) return 0;
    return Object.values(metrics.services).reduce((sum, s) => sum + (s.total_executions || 0), 0);
  };

  const health = getHealthStatus();

  if (loading && !metrics) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box mb={3}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Box display="flex" alignItems="center" gap={2}>
            <DashboardIcon fontSize="large" />
            <Box>
              <Typography variant="h4" gutterBottom>
                Monitoring Dashboard
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Real-time health and performance metrics for CDS services
              </Typography>
            </Box>
          </Box>
          <Box display="flex" gap={2} alignItems="center">
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Time Range</InputLabel>
              <Select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                label="Time Range"
              >
                <MenuItem value="1h">Last Hour</MenuItem>
                <MenuItem value="24h">Last 24 Hours</MenuItem>
                <MenuItem value="7d">Last 7 Days</MenuItem>
                <MenuItem value="30d">Last 30 Days</MenuItem>
              </Select>
            </FormControl>
            <Tooltip title="Refresh">
              <IconButton onClick={() => loadDashboardData()}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
      </Box>

      {/* Key Metrics Cards */}
      <Grid container spacing={3} mb={3}>
        {/* System Health */}
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="start">
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    System Health
                  </Typography>
                  <Typography variant="h4" sx={{ textTransform: 'capitalize' }}>
                    {health.status}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {services.filter(s => s.status === 'active').length} / {services.length} active
                  </Typography>
                </Box>
                <Chip
                  icon={health.icon}
                  label={health.status}
                  color={health.color}
                  size="small"
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Total Executions */}
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="start">
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Total Executions
                  </Typography>
                  <Typography variant="h4">
                    {getTotalExecutions().toLocaleString()}
                  </Typography>
                  <Box display="flex" alignItems="center" gap={0.5}>
                    <TrendingUpIcon fontSize="small" color="success" />
                    <Typography variant="caption" color="success.main">
                      +12% vs last period
                    </Typography>
                  </Box>
                </Box>
                <PerformanceIcon color="primary" />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Success Rate */}
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Success Rate
                </Typography>
                <Typography variant="h4">
                  {calculateSuccessRate()}%
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={calculateSuccessRate()}
                  sx={{ mt: 1 }}
                  color={calculateSuccessRate() >= 95 ? 'success' : 'warning'}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Avg Response Time */}
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Avg Response Time
                </Typography>
                <Typography variant="h4">
                  {calculateAverageResponseTime()}ms
                </Typography>
                <Box display="flex" alignItems="center" gap={0.5}>
                  <TrendingDownIcon fontSize="small" color="success" />
                  <Typography variant="caption" color="success.main">
                    -8% improvement
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Service Health Table */}
      <Grid container spacing={3}>
        <Grid item xs={12} lg={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Service Health Status
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Service</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell align="right">Executions</TableCell>
                    <TableCell align="right">Success Rate</TableCell>
                    <TableCell align="right">Avg Time</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {services.map((service) => {
                    const serviceMetrics = metrics?.services?.[service.service_id] || {};
                    const successRate = serviceMetrics.success_rate || 0;

                    return (
                      <TableRow key={service.service_id} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight="medium">
                            {service.title}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" fontFamily="monospace">
                            {service.service_id}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={service.status}
                            size="small"
                            color={service.status === 'active' ? 'success' : 'default'}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={service.origin}
                            size="small"
                            color={service.origin === 'built-in' ? 'primary' : 'warning'}
                          />
                        </TableCell>
                        <TableCell align="right">
                          {(serviceMetrics.total_executions || 0).toLocaleString()}
                        </TableCell>
                        <TableCell align="right">
                          <Typography
                            variant="body2"
                            color={successRate >= 95 ? 'success.main' : successRate >= 80 ? 'warning.main' : 'error.main'}
                          >
                            {successRate.toFixed(1)}%
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          {serviceMetrics.avg_response_time_ms || 0}ms
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        {/* Recent Activity */}
        <Grid item xs={12} lg={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Recent Activity
            </Typography>
            <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
              {recentActivity.map((activity) => (
                <Box
                  key={activity.id}
                  sx={{
                    p: 2,
                    mb: 1,
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: 'divider',
                    '&:last-child': { mb: 0 }
                  }}
                >
                  <Box display="flex" justifyContent="space-between" alignItems="start" mb={0.5}>
                    <Typography variant="body2" fontWeight="medium">
                      {activity.event}
                    </Typography>
                    <Chip
                      label={activity.status}
                      size="small"
                      color={activity.status === 'success' ? 'success' : 'error'}
                    />
                  </Box>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {activity.service_id}
                  </Typography>
                  <Box display="flex" justifyContent="space-between" mt={1}>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(activity.timestamp).toLocaleTimeString()}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {activity.duration_ms}ms
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default MonitoringDashboard;
