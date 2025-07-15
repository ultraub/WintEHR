/**
 * Order Statistics Panel Component
 * 
 * Displays comprehensive statistics and analytics for patient orders including
 * distribution, trends, and workflow metrics.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Box,
  Stack,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  Divider,
  useTheme
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  Assignment as OrderIcon,
  LocalHospital as MedicalIcon,
  Science as LabIcon,
  CameraAlt as ImagingIcon,
  Speed as MetricsIcon,
  Timeline as TimelineIcon,
  Assessment as StatsIcon,
  Refresh as RefreshIcon,
  Warning as WarningIcon,
  CheckCircle as CompleteIcon,
  Schedule as PendingIcon,
  Cancel as CancelledIcon
} from '@mui/icons-material';
import { 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  Legend, 
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';
import { format, subDays, isWithinInterval, parseISO } from 'date-fns';
import { useFHIRResource } from '../../../../../contexts/FHIRResourceContext';

const OrderStatisticsPanel = ({ 
  patientId, 
  timeRange = 'all', 
  refreshTrigger = 0,
  compact = false 
}) => {
  const theme = useTheme();
  const { getPatientResources } = useFHIRResource();
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Color schemes for charts
  const statusColors = {
    'draft': theme.palette.grey[400],
    'active': theme.palette.info.main,
    'on-hold': theme.palette.warning.main,
    'completed': theme.palette.success.main,
    'cancelled': theme.palette.error.main,
    'entered-in-error': theme.palette.error.light
  };

  const priorityColors = {
    'routine': theme.palette.primary.light,
    'urgent': theme.palette.warning.main,
    'asap': theme.palette.warning.dark,
    'stat': theme.palette.error.main
  };

  const categoryColors = [
    theme.palette.primary.main,
    theme.palette.secondary.main,
    theme.palette.success.main,
    theme.palette.warning.main,
    theme.palette.error.main,
    theme.palette.info.main
  ];

  useEffect(() => {
    if (patientId) {
      calculateStatistics();
    }
  }, [patientId, timeRange, refreshTrigger]);

  const calculateStatistics = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get all order resources
      const serviceRequests = getPatientResources(patientId, 'ServiceRequest') || [];
      const medicationRequests = getPatientResources(patientId, 'MedicationRequest') || [];
      
      // Combine all orders
      const allOrders = [
        ...serviceRequests.map(sr => ({ ...sr, orderType: 'ServiceRequest' })),
        ...medicationRequests.map(mr => ({ ...mr, orderType: 'MedicationRequest' }))
      ];

      // Filter by time range
      const filteredOrders = filterOrdersByTimeRange(allOrders, timeRange);

      // Calculate comprehensive statistics
      const stats = {
        overview: calculateOverviewStats(filteredOrders),
        byStatus: calculateStatusDistribution(filteredOrders),
        byPriority: calculatePriorityDistribution(filteredOrders),
        byCategory: calculateCategoryDistribution(filteredOrders),
        byType: calculateTypeDistribution(filteredOrders),
        trends: calculateTrends(filteredOrders),
        workflow: calculateWorkflowMetrics(filteredOrders),
        performance: calculatePerformanceMetrics(filteredOrders)
      };

      setStatistics(stats);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error calculating order statistics:', err);
      setError('Failed to calculate order statistics');
    } finally {
      setLoading(false);
    }
  };

  const filterOrdersByTimeRange = (orders, range) => {
    if (range === 'all') return orders;

    const now = new Date();
    const ranges = {
      '7d': subDays(now, 7),
      '30d': subDays(now, 30),
      '90d': subDays(now, 90),
      '1y': subDays(now, 365)
    };

    const startDate = ranges[range];
    if (!startDate) return orders;

    return orders.filter(order => {
      const authoredDate = order.authoredOn || order.dosageInstruction?.[0]?.timing?.repeat?.boundsPeriod?.start;
      if (!authoredDate) return false;
      
      const orderDate = parseISO(authoredDate);
      return isWithinInterval(orderDate, { start: startDate, end: now });
    });
  };

  const calculateOverviewStats = (orders) => {
    const total = orders.length;
    const completed = orders.filter(o => o.status === 'completed').length;
    const active = orders.filter(o => o.status === 'active').length;
    const pending = orders.filter(o => ['draft', 'active', 'on-hold'].includes(o.status)).length;
    const urgent = orders.filter(o => ['urgent', 'asap', 'stat'].includes(o.priority)).length;

    return {
      total,
      completed,
      active,
      pending,
      urgent,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0
    };
  };

  const calculateStatusDistribution = (orders) => {
    const distribution = {};
    orders.forEach(order => {
      const status = order.status || 'unknown';
      distribution[status] = (distribution[status] || 0) + 1;
    });

    return Object.entries(distribution).map(([status, count]) => ({
      name: status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' '),
      value: count,
      percentage: Math.round((count / orders.length) * 100),
      color: statusColors[status] || theme.palette.grey[400]
    }));
  };

  const calculatePriorityDistribution = (orders) => {
    const distribution = {};
    orders.forEach(order => {
      const priority = order.priority || 'routine';
      distribution[priority] = (distribution[priority] || 0) + 1;
    });

    return Object.entries(distribution).map(([priority, count]) => ({
      name: priority.charAt(0).toUpperCase() + priority.slice(1),
      value: count,
      percentage: Math.round((count / orders.length) * 100),
      color: priorityColors[priority] || theme.palette.primary.main
    }));
  };

  const calculateCategoryDistribution = (orders) => {
    const distribution = {};
    orders.forEach(order => {
      let category = 'Other';
      
      if (order.orderType === 'MedicationRequest') {
        category = 'Medications';
      } else if (order.category) {
        // For ServiceRequests, use the category
        category = order.category[0]?.coding?.[0]?.display || 
                  order.category[0]?.text || 
                  'Procedures';
      } else if (order.code) {
        // Try to infer category from code
        const codeText = order.code.text || order.code.coding?.[0]?.display || '';
        if (codeText.toLowerCase().includes('lab')) category = 'Laboratory';
        else if (codeText.toLowerCase().includes('image') || codeText.toLowerCase().includes('scan')) category = 'Imaging';
        else if (codeText.toLowerCase().includes('procedure')) category = 'Procedures';
      }
      
      distribution[category] = (distribution[category] || 0) + 1;
    });

    return Object.entries(distribution).map(([category, count], index) => ({
      name: category,
      value: count,
      percentage: Math.round((count / orders.length) * 100),
      color: categoryColors[index % categoryColors.length]
    }));
  };

  const calculateTypeDistribution = (orders) => {
    const distribution = {};
    orders.forEach(order => {
      const type = order.orderType || 'Unknown';
      distribution[type] = (distribution[type] || 0) + 1;
    });

    return Object.entries(distribution).map(([type, count]) => ({
      name: type.replace('Request', ''),
      value: count,
      percentage: Math.round((count / orders.length) * 100)
    }));
  };

  const calculateTrends = (orders) => {
    // Group orders by date for trend analysis
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = subDays(new Date(), i);
      return {
        date: format(date, 'MMM dd'),
        orders: 0,
        completed: 0
      };
    }).reverse();

    orders.forEach(order => {
      const orderDate = order.authoredOn || order.dosageInstruction?.[0]?.timing?.repeat?.boundsPeriod?.start;
      if (orderDate) {
        const date = parseISO(orderDate);
        const dayIndex = last30Days.findIndex(day => 
          format(date, 'MMM dd') === day.date
        );
        
        if (dayIndex >= 0) {
          last30Days[dayIndex].orders++;
          if (order.status === 'completed') {
            last30Days[dayIndex].completed++;
          }
        }
      }
    });

    return last30Days;
  };

  const calculateWorkflowMetrics = (orders) => {
    const metrics = {
      averageTimeToCompletion: 0,
      ordersAwaitingAction: 0,
      overdueTasks: 0,
      nextActionRequired: []
    };

    // Calculate average time to completion for completed orders
    const completedOrders = orders.filter(o => o.status === 'completed');
    if (completedOrders.length > 0) {
      const totalTime = completedOrders.reduce((sum, order) => {
        const start = parseISO(order.authoredOn || new Date().toISOString());
        const end = parseISO(order.meta?.lastUpdated || new Date().toISOString());
        return sum + (end.getTime() - start.getTime());
      }, 0);
      
      metrics.averageTimeToCompletion = Math.round(totalTime / completedOrders.length / (1000 * 60 * 60 * 24)); // in days
    }

    // Count orders awaiting action
    metrics.ordersAwaitingAction = orders.filter(o => 
      ['draft', 'active', 'on-hold'].includes(o.status)
    ).length;

    return metrics;
  };

  const calculatePerformanceMetrics = (orders) => {
    const now = new Date();
    const last7Days = subDays(now, 7);
    const previous7Days = subDays(now, 14);
    
    const currentPeriod = orders.filter(o => {
      const orderDate = parseISO(o.authoredOn || new Date().toISOString());
      return isWithinInterval(orderDate, { start: last7Days, end: now });
    });
    
    const previousPeriod = orders.filter(o => {
      const orderDate = parseISO(o.authoredOn || new Date().toISOString());
      return isWithinInterval(orderDate, { start: previous7Days, end: last7Days });
    });

    const currentCount = currentPeriod.length;
    const previousCount = previousPeriod.length;
    const trend = previousCount > 0 ? 
      Math.round(((currentCount - previousCount) / previousCount) * 100) : 0;

    return {
      currentPeriodOrders: currentCount,
      previousPeriodOrders: previousCount,
      trend,
      trendDirection: trend > 0 ? 'up' : trend < 0 ? 'down' : 'stable'
    };
  };

  const handleRefresh = () => {
    calculateStatistics();
  };

  if (loading) {
    return (
      <Paper sx={{ p: 2, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="body2" sx={{ mt: 1 }}>
          Calculating order statistics...
        </Typography>
      </Paper>
    );
  }

  if (error) {
    return (
      <Paper sx={{ p: 2 }}>
        <Alert severity="error" action={
          <IconButton size="small" onClick={handleRefresh}>
            <RefreshIcon />
          </IconButton>
        }>
          {error}
        </Alert>
      </Paper>
    );
  }

  if (!statistics) return null;

  const { overview, byStatus, byPriority, byCategory, byType, trends, workflow, performance } = statistics;

  if (compact) {
    return (
      <Paper sx={{ p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Order Statistics</Typography>
          <Tooltip title="Refresh Statistics">
            <IconButton size="small" onClick={handleRefresh}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Stack>
        
        <Grid container spacing={2}>
          <Grid item xs={3}>
            <Box textAlign="center">
              <Typography variant="h4" color="primary">{overview.total}</Typography>
              <Typography variant="caption">Total</Typography>
            </Box>
          </Grid>
          <Grid item xs={3}>
            <Box textAlign="center">
              <Typography variant="h4" color="success.main">{overview.completed}</Typography>
              <Typography variant="caption">Completed</Typography>
            </Box>
          </Grid>
          <Grid item xs={3}>
            <Box textAlign="center">
              <Typography variant="h4" color="warning.main">{overview.pending}</Typography>
              <Typography variant="caption">Pending</Typography>
            </Box>
          </Grid>
          <Grid item xs={3}>
            <Box textAlign="center">
              <Typography variant="h4" color="error.main">{overview.urgent}</Typography>
              <Typography variant="caption">Urgent</Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight="bold">
          Order Analytics & Statistics
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          {lastUpdated && (
            <Typography variant="caption" color="text.secondary">
              Updated: {format(lastUpdated, 'MMM d, h:mm a')}
            </Typography>
          )}
          <Tooltip title="Refresh Statistics">
            <IconButton onClick={handleRefresh}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      {/* Overview Cards */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <OrderIcon color="primary" />
                <Box>
                  <Typography variant="h4">{overview.total}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Orders
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <CompleteIcon color="success" />
                <Box>
                  <Typography variant="h4">{overview.completed}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Completed ({overview.completionRate}%)
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <PendingIcon color="warning" />
                <Box>
                  <Typography variant="h4">{overview.pending}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Pending
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <WarningIcon color="error" />
                <Box>
                  <Typography variant="h4">{overview.urgent}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Urgent Priority
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Charts Section */}
      <Grid container spacing={3} mb={4}>
        {/* Status Distribution */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Status Distribution
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={byStatus}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                  >
                    {byStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value) => [value, 'Orders']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Category Distribution */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Category Distribution
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={byCategory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <RechartsTooltip />
                  <Bar dataKey="value" fill={theme.palette.primary.main} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Trends and Performance */}
      <Grid container spacing={3}>
        {/* Order Trends */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                30-Day Order Trends
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <RechartsTooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="orders" 
                    stroke={theme.palette.primary.main} 
                    name="Total Orders"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="completed" 
                    stroke={theme.palette.success.main} 
                    name="Completed"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Performance Metrics */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Performance Metrics
              </Typography>
              <Stack spacing={3}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Average Completion Time
                  </Typography>
                  <Typography variant="h5">
                    {workflow.averageTimeToCompletion} days
                  </Typography>
                </Box>
                
                <Divider />
                
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    7-Day Trend
                  </Typography>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography variant="h5">
                      {performance.currentPeriodOrders}
                    </Typography>
                    <Chip
                      label={`${performance.trend > 0 ? '+' : ''}${performance.trend}%`}
                      size="small"
                      color={
                        performance.trendDirection === 'up' ? 'success' : 
                        performance.trendDirection === 'down' ? 'error' : 'default'
                      }
                      icon={<TrendingUpIcon />}
                    />
                  </Stack>
                </Box>
                
                <Divider />
                
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Orders Awaiting Action
                  </Typography>
                  <Typography variant="h5" color="warning.main">
                    {workflow.ordersAwaitingAction}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Paper>
  );
};

export default OrderStatisticsPanel;