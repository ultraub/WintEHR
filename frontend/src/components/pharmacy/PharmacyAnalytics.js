/**
 * PharmacyAnalytics Component
 * Analytics dashboard for pharmacy workflow metrics and insights
 */
import React, { useMemo } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  Stack,
  Chip,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  useTheme
} from '@mui/material';
import {
  Timeline as TrendIcon,
  Speed as PerformanceIcon,
  Assignment as VolumeIcon,
  AccessTime as TimingIcon,
  LocalPharmacy as PharmacyIcon,
  TrendingUp as UpIcon,
  TrendingDown as DownIcon,
  Remove as FlatIcon
} from '@mui/icons-material';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend
} from 'recharts';
import { format, subDays, startOfDay } from 'date-fns';

const PharmacyAnalytics = ({ queueStats, medicationRequests }) => {
  const theme = useTheme();

  // Generate trend data for the last 7 days
  const trendData = useMemo(() => {
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dayRequests = medicationRequests.filter(req => {
        const authoredDate = new Date(req.authoredOn);
        return startOfDay(authoredDate).getTime() === startOfDay(date).getTime();
      });
      
      data.push({
        date: format(date, 'MMM dd'),
        newOrders: Math.floor(Math.random() * 20) + 5, // Mock data
        completed: Math.floor(Math.random() * 15) + 3,
        pending: Math.floor(Math.random() * 8) + 2,
        total: dayRequests.length
      });
    }
    return data;
  }, [medicationRequests]);

  // Queue distribution data
  const queueDistribution = [
    { name: 'New Orders', value: queueStats.newOrders, color: theme.palette.warning.main },
    { name: 'Verification', value: queueStats.verification, color: theme.palette.info.main },
    { name: 'Dispensing', value: queueStats.dispensing, color: theme.palette.primary.main },
    { name: 'Ready', value: queueStats.ready, color: theme.palette.success.main }
  ];

  // Top medications by volume
  const medicationVolume = useMemo(() => {
    const counts = {};
    medicationRequests.forEach(req => {
      const medName = req.medicationCodeableConcept?.text ||
                     req.medicationCodeableConcept?.coding?.[0]?.display ||
                     'Unknown';
      counts[medName] = (counts[medName] || 0) + 1;
    });
    
    return Object.entries(counts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));
  }, [medicationRequests]);

  // Performance metrics
  const performanceMetrics = {
    avgProcessingTime: '18 min', // Mock data
    completionRate: 94.2,
    errorRate: 0.8,
    patientWaitTime: '12 min'
  };

  const MetricCard = ({ title, value, subtitle, icon, trend, color = 'primary' }) => (
    <Card>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="caption" color="text.secondary">
              {title}
            </Typography>
            <Typography variant="h4" fontWeight="bold" color={`${color}.main`}>
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="body2" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
          <Avatar sx={{ bgcolor: `${color}.light` }}>
            {icon}
          </Avatar>
        </Stack>
        {trend && (
          <Stack direction="row" alignItems="center" spacing={0.5} mt={1}>
            {trend > 0 ? (
              <UpIcon color="success" fontSize="small" />
            ) : trend < 0 ? (
              <DownIcon color="error" fontSize="small" />
            ) : (
              <FlatIcon color="action" fontSize="small" />
            )}
            <Typography 
              variant="caption" 
              color={trend > 0 ? 'success.main' : trend < 0 ? 'error.main' : 'text.secondary'}
            >
              {Math.abs(trend)}% vs last week
            </Typography>
          </Stack>
        )}
      </CardContent>
    </Card>
  );

  return (
    <Box>
      {/* Key Metrics */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Total Prescriptions"
            value={queueStats.total}
            subtitle="Today"
            icon={<VolumeIcon />}
            trend={8.2}
            color="primary"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Avg Processing Time"
            value={performanceMetrics.avgProcessingTime}
            subtitle="Per prescription"
            icon={<TimingIcon />}
            trend={-5.3}
            color="info"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Completion Rate"
            value={`${performanceMetrics.completionRate}%`}
            subtitle="Successfully dispensed"
            icon={<PerformanceIcon />}
            trend={2.1}
            color="success"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Error Rate"
            value={`${performanceMetrics.errorRate}%`}
            subtitle="Requiring correction"
            icon={<TrendIcon />}
            trend={-1.2}
            color="warning"
          />
        </Grid>
      </Grid>

      {/* Charts */}
      <Grid container spacing={3}>
        {/* Queue Trends */}
        <Grid item xs={12} lg={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Queue Volume Trends (Last 7 Days)
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area 
                  type="monotone" 
                  dataKey="newOrders" 
                  stackId="1"
                  stroke={theme.palette.warning.main}
                  fill={theme.palette.warning.light}
                  name="New Orders"
                />
                <Area 
                  type="monotone" 
                  dataKey="completed" 
                  stackId="1"
                  stroke={theme.palette.success.main}
                  fill={theme.palette.success.light}
                  name="Completed"
                />
                <Area 
                  type="monotone" 
                  dataKey="pending" 
                  stackId="1"
                  stroke={theme.palette.info.main}
                  fill={theme.palette.info.light}
                  name="Pending"
                />
              </AreaChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Current Queue Distribution */}
        <Grid item xs={12} lg={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Current Queue Distribution
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={queueDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={120}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {queueDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <Box mt={2}>
              {queueDistribution.map((item, index) => (
                <Stack key={index} direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Box
                      sx={{
                        width: 12,
                        height: 12,
                        bgcolor: item.color,
                        borderRadius: '50%'
                      }}
                    />
                    <Typography variant="body2">{item.name}</Typography>
                  </Stack>
                  <Typography variant="body2" fontWeight="bold">
                    {item.value}
                  </Typography>
                </Stack>
              ))}
            </Box>
          </Paper>
        </Grid>

        {/* Top Medications */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Top Medications by Volume
            </Typography>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={medicationVolume} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} />
                <Tooltip />
                <Bar dataKey="count" fill={theme.palette.primary.main} />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Performance Indicators */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Performance Indicators
            </Typography>
            <Stack spacing={3}>
              <Box>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="body2">Queue Efficiency</Typography>
                  <Typography variant="body2" fontWeight="bold">92%</Typography>
                </Stack>
                <LinearProgress 
                  variant="determinate" 
                  value={92} 
                  color="success"
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>
              
              <Box>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="body2">First-Time Accuracy</Typography>
                  <Typography variant="body2" fontWeight="bold">98%</Typography>
                </Stack>
                <LinearProgress 
                  variant="determinate" 
                  value={98} 
                  color="success"
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>
              
              <Box>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="body2">On-Time Completion</Typography>
                  <Typography variant="body2" fontWeight="bold">89%</Typography>
                </Stack>
                <LinearProgress 
                  variant="determinate" 
                  value={89} 
                  color="warning"
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>
              
              <Box>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="body2">Patient Satisfaction</Typography>
                  <Typography variant="body2" fontWeight="bold">94%</Typography>
                </Stack>
                <LinearProgress 
                  variant="determinate" 
                  value={94} 
                  color="success"
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>
            </Stack>
          </Paper>
        </Grid>

        {/* Recent Activity */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Recent Activity
            </Typography>
            <List>
              <ListItem>
                <ListItemAvatar>
                  <Avatar sx={{ bgcolor: 'success.light' }}>
                    <PharmacyIcon />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary="Lisinopril 10mg dispensed"
                  secondary="Patient: John Smith - 2 minutes ago"
                />
                <Chip label="Completed" color="success" size="small" />
              </ListItem>
              <ListItem>
                <ListItemAvatar>
                  <Avatar sx={{ bgcolor: 'warning.light' }}>
                    <PharmacyIcon />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary="Metformin 500mg - drug interaction alert"
                  secondary="Patient: Mary Johnson - 5 minutes ago"
                />
                <Chip label="Needs Review" color="warning" size="small" />
              </ListItem>
              <ListItem>
                <ListItemAvatar>
                  <Avatar sx={{ bgcolor: 'info.light' }}>
                    <PharmacyIcon />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary="Inventory low: Simvastatin 20mg"
                  secondary="Current stock: 15 units - 8 minutes ago"
                />
                <Chip label="Reorder Needed" color="info" size="small" />
              </ListItem>
            </List>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default PharmacyAnalytics;