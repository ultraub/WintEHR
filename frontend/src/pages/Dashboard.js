/**
 * Enhanced Clinical Dashboard
 * A powerful, beautiful dashboard with clinical tools, visualizations, and actionable insights
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  IconButton,
  Chip,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Paper,
  useTheme,
  alpha,
  Tooltip,
  Button,
  Divider,
  LinearProgress,
  Stack,
  Avatar,
  AvatarGroup,
  Skeleton,
  List,
  ListItem,
  ListItemText
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  LocalHospital as HospitalIcon,
  Science as ScienceIcon,
  Calculate as CalculateIcon,
  TrendingUp as TrendingUpIcon,
  Warning as WarningIcon,
  People as PeopleIcon,
  Medication as MedicationIcon,
  Assignment as AssignmentIcon,
  Timeline as TimelineIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
  Favorite as HeartIcon,
  Psychology as BrainIcon,
  AirlineSeatFlat as BedIcon,
  Vaccines as VaccineIcon
} from '@mui/icons-material';

// Chart imports
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts';

// Service imports
import dashboardDataService from '../services/dashboard/dashboardDataService';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';

// Component imports
import ClinicalCalculatorWidget from '../components/dashboard/widgets/ClinicalCalculatorWidget';
import PatientListWidget from '../components/dashboard/widgets/PatientListWidget';
import CareGapsWidget from '../components/dashboard/widgets/CareGapsWidget';
import QuickReferenceWidget from '../components/dashboard/widgets/QuickReferenceWidget';

// Color palette for charts
const CHART_COLORS = [
  '#2196f3', // Blue
  '#4caf50', // Green
  '#ff9800', // Orange
  '#f44336', // Red
  '#9c27b0', // Purple
  '#00bcd4', // Cyan
  '#ffeb3b', // Yellow
  '#795548', // Brown
];

function Dashboard() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Data states
  const [populationStats, setPopulationStats] = useState(null);
  const [chronicDiseaseStats, setChronicDiseaseStats] = useState(null);
  const [careGaps, setCareGaps] = useState(null);
  const [medicationSafety, setMedicationSafety] = useState(null);
  const [trendingData, setTrendingData] = useState(null);
  const [qualityMetrics, setQualityMetrics] = useState(null);

  // Fetch all dashboard data
  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [
        populationData,
        chronicData,
        gapsData,
        medicationData,
        trendsData,
        metricsData
      ] = await Promise.all([
        dashboardDataService.getPopulationStats(),
        dashboardDataService.getChronicDiseaseStats(),
        dashboardDataService.getCareGaps(),
        dashboardDataService.getMedicationSafetyStats(),
        dashboardDataService.getTrendingData(30),
        dashboardDataService.getQualityMetrics()
      ]);

      setPopulationStats(populationData);
      setChronicDiseaseStats(chronicData);
      setCareGaps(gapsData);
      setMedicationSafety(medicationData);
      setTrendingData(trendsData);
      setQualityMetrics(metricsData);

    } catch (err) {
      console.error('Dashboard data fetch error:', err);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleRefresh = () => {
    setRefreshing(true);
    dashboardDataService.clearCache();
    fetchDashboardData();
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  // Render loading state
  if (loading && !refreshing) {
    return (
      <Box sx={{ p: 3 }}>
        <Grid container spacing={3}>
          {[1, 2, 3, 4].map((i) => (
            <Grid item xs={12} md={6} lg={3} key={i}>
              <Skeleton variant="rectangular" height={120} />
            </Grid>
          ))}
          <Grid item xs={12}>
            <Skeleton variant="rectangular" height={400} />
          </Grid>
        </Grid>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 3, pb: 0 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Box>
            <Typography variant="h4" fontWeight="bold" gutterBottom>
              Clinical Dashboard
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {format(new Date(), 'EEEE, MMMM d, yyyy')} • Welcome back, {user?.name || 'Doctor'}
            </Typography>
          </Box>
          <Box>
            <Tooltip title="Refresh data">
              <IconButton onClick={handleRefresh} disabled={refreshing}>
                <RefreshIcon className={refreshing ? 'rotating' : ''} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Navigation Tabs */}
        <Paper sx={{ borderRadius: 2, mb: 3 }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              '& .MuiTab-root': {
                minHeight: 64,
                textTransform: 'none',
                fontSize: '0.95rem',
                fontWeight: 500
              }
            }}
          >
            <Tab icon={<DashboardIcon />} label="Overview" />
            <Tab icon={<HospitalIcon />} label="Population Health" />
            <Tab icon={<CalculateIcon />} label="Clinical Tools" />
            <Tab icon={<WarningIcon />} label="Safety & Alerts" />
            <Tab icon={<TrendingUpIcon />} label="Analytics" />
          </Tabs>
        </Paper>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mx: 3, mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Tab Content */}
      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
        {/* Overview Tab */}
        {activeTab === 0 && (
          <Grid container spacing={2}>
            {/* Key Metrics Cards */}
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ 
                height: 120, 
                background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
                border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`
              }}>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography color="text.secondary" variant="caption" display="block">
                        Total Patients
                      </Typography>
                      <Typography variant="h4" fontWeight="bold">
                        {populationStats?.totalPatients || 0}
                      </Typography>
                      <Typography variant="caption" color="success.main">
                        <ArrowUpIcon sx={{ fontSize: 12, verticalAlign: 'middle' }} />
                        12%
                      </Typography>
                    </Box>
                    <Avatar sx={{ bgcolor: 'primary.main', width: 40, height: 40 }}>
                      <PeopleIcon />
                    </Avatar>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ 
                height: 120,
                background: `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.1)} 0%, ${alpha(theme.palette.success.main, 0.05)} 100%)`,
                border: `1px solid ${alpha(theme.palette.success.main, 0.2)}`
              }}>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography color="text.secondary" variant="caption" display="block">
                        Active Conditions
                      </Typography>
                      <Typography variant="h4" fontWeight="bold">
                        {populationStats?.activeConditions || 0}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        All patients
                      </Typography>
                    </Box>
                    <Avatar sx={{ bgcolor: 'success.main', width: 40, height: 40 }}>
                      <AssignmentIcon />
                    </Avatar>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ 
                height: 120,
                background: `linear-gradient(135deg, ${alpha(theme.palette.warning.main, 0.1)} 0%, ${alpha(theme.palette.warning.main, 0.05)} 100%)`,
                border: `1px solid ${alpha(theme.palette.warning.main, 0.2)}`
              }}>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography color="text.secondary" variant="caption" display="block">
                        Active Medications
                      </Typography>
                      <Typography variant="h4" fontWeight="bold">
                        {populationStats?.activeMedications || 0}
                      </Typography>
                      <Typography variant="caption" color="warning.main">
                        {medicationSafety?.polypharmacy?.count || 0} polypharm
                      </Typography>
                    </Box>
                    <Avatar sx={{ bgcolor: 'warning.main', width: 40, height: 40 }}>
                      <MedicationIcon />
                    </Avatar>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ 
                height: 120,
                background: `linear-gradient(135deg, ${alpha(theme.palette.error.main, 0.1)} 0%, ${alpha(theme.palette.error.main, 0.05)} 100%)`,
                border: `1px solid ${alpha(theme.palette.error.main, 0.2)}`
              }}>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography color="text.secondary" variant="caption" display="block">
                        Care Gaps
                      </Typography>
                      <Typography variant="h4" fontWeight="bold">
                        {careGaps?.gaps?.filter(g => g.percentage < 80).length || 0}
                      </Typography>
                      <Typography variant="caption" color="error.main">
                        Action needed
                      </Typography>
                    </Box>
                    <Avatar sx={{ bgcolor: 'error.main', width: 40, height: 40 }}>
                      <WarningIcon />
                    </Avatar>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Encounter Trends Chart */}
            <Grid item xs={12} md={8}>
              <Paper sx={{ p: 2, height: 300 }}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Patient Encounters - Last 30 Days
                </Typography>
                <Box sx={{ width: '100%', height: 220 }}>
                  <ResponsiveContainer>
                    <AreaChart data={trendingData?.dailyTrend || []}>
                      <defs>
                        <linearGradient id="colorEncounters" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={theme.palette.primary.main} stopOpacity={0.8}/>
                          <stop offset="95%" stopColor={theme.palette.primary.main} stopOpacity={0.1}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.3)} />
                      <XAxis 
                        dataKey="dayOfWeek" 
                        stroke={theme.palette.text.secondary}
                        style={{ fontSize: '0.75rem' }}
                      />
                      <YAxis 
                        stroke={theme.palette.text.secondary}
                        style={{ fontSize: '0.75rem' }}
                      />
                      <ChartTooltip
                        contentStyle={{
                          backgroundColor: theme.palette.background.paper,
                          border: `1px solid ${theme.palette.divider}`,
                          borderRadius: 8
                        }}
                        labelFormatter={(value, data) => {
                          if (data && data[0]?.payload?.date) {
                            return format(new Date(data[0].payload.date), 'MMM d, yyyy');
                          }
                          return value;
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="encounters"
                        stroke={theme.palette.primary.main}
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorEncounters)"
                        animationDuration={1000}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </Box>
                <Box display="flex" justifyContent="space-between" mt={2}>
                  <Typography variant="body2" color="text.secondary">
                    Average: {trendingData?.averagePerDay || 0} encounters/day
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total: {trendingData?.totalEncounters || 0} encounters
                  </Typography>
                </Box>
              </Paper>
            </Grid>

            {/* Chronic Disease Distribution */}
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 2, height: 300 }}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Chronic Disease Registry
                </Typography>
                <Box sx={{ width: '100%', height: 220 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={chronicDiseaseStats?.diseases || []}
                        dataKey="count"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={70}
                        paddingAngle={2}
                        animationBegin={0}
                        animationDuration={800}
                      >
                        {(chronicDiseaseStats?.diseases || []).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <ChartTooltip
                        contentStyle={{
                          backgroundColor: theme.palette.background.paper,
                          border: `1px solid ${theme.palette.divider}`,
                          borderRadius: 8
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <Box sx={{ textAlign: 'center', mt: -15, position: 'relative' }}>
                    <Typography variant="h5" fontWeight="bold">
                      {chronicDiseaseStats?.totalPatients || 0}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Total Patients
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ mt: 2 }}>
                  <Grid container spacing={1}>
                    {(chronicDiseaseStats?.diseases || []).slice(0, 6).map((disease, index) => (
                      <Grid item xs={6} key={disease.name}>
                        <Box display="flex" alignItems="center">
                          <Box
                            sx={{
                              width: 12,
                              height: 12,
                              borderRadius: '50%',
                              backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
                              mr: 1
                            }}
                          />
                          <Typography variant="caption" noWrap>
                            {disease.icon} {disease.name}: {disease.count}
                          </Typography>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              </Paper>
            </Grid>

            {/* Quick Actions */}
            <Grid item xs={12}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Quick Actions
                </Typography>
                <Grid container spacing={1}>
                  <Grid item>
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<SearchIcon />}
                      onClick={() => navigate('/patients')}
                    >
                      Find Patient
                    </Button>
                  </Grid>
                  <Grid item>
                    <Button
                      size="small"
                      variant="contained"
                      color="secondary"
                      startIcon={<CalculateIcon />}
                      onClick={() => setActiveTab(2)}
                    >
                      Calculators
                    </Button>
                  </Grid>
                  <Grid item>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<MedicationIcon />}
                      onClick={() => navigate('/pharmacy')}
                    >
                      Pharmacy
                    </Button>
                  </Grid>
                  <Grid item>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<ScienceIcon />}
                      onClick={() => navigate('/fhir-explorer')}
                    >
                      FHIR Explorer
                    </Button>
                  </Grid>
                  <Grid item>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<TimelineIcon />}
                      onClick={() => setActiveTab(4)}
                    >
                      Analytics
                    </Button>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>
          </Grid>
        )}

        {/* Population Health Tab */}
        {activeTab === 1 && (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <PatientListWidget />
            </Grid>
            <Grid item xs={12}>
              <CareGapsWidget careGaps={careGaps} />
            </Grid>
          </Grid>
        )}

        {/* Clinical Tools Tab */}
        {activeTab === 2 && (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <ClinicalCalculatorWidget />
            </Grid>
          </Grid>
        )}

        {/* Safety & Alerts Tab */}
        {activeTab === 3 && (
          <Grid container spacing={2}>
            {/* Active Clinical Alerts */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2, height: 350 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="subtitle1" fontWeight="bold">
                    Active Clinical Alerts
                  </Typography>
                  <Chip 
                    label={`${medicationSafety?.clinicalAlerts?.filter(a => a.status === 'active').length || 0} Active`} 
                    color="error" 
                    size="small" 
                  />
                </Box>
                <Stack spacing={1} sx={{ maxHeight: 280, overflow: 'auto' }}>
                  {medicationSafety?.clinicalAlerts?.map((alert) => (
                    <Paper
                      key={alert.id}
                      sx={{
                        p: 2,
                        border: 1,
                        borderColor: alert.severity === 'critical' ? 'error.main' : 'warning.main',
                        borderRadius: 1,
                        bgcolor: alpha(
                          alert.severity === 'critical' ? theme.palette.error.main : theme.palette.warning.main,
                          0.05
                        )
                      }}
                    >
                      <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                        <Box flex={1}>
                          <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                            <Chip
                              label={alert.type}
                              size="small"
                              color={alert.severity === 'critical' ? 'error' : 'warning'}
                            />
                            <Typography variant="caption" color="text.secondary">
                              {format(new Date(alert.timestamp), 'HH:mm')}
                            </Typography>
                          </Box>
                          <Typography variant="subtitle2" fontWeight="bold">
                            {alert.patient}
                          </Typography>
                          <Typography variant="body2">
                            {alert.message}
                          </Typography>
                        </Box>
                        <Chip
                          label={alert.status}
                          size="small"
                          variant="outlined"
                          color={
                            alert.status === 'active' ? 'error' :
                            alert.status === 'acknowledged' ? 'warning' : 'success'
                          }
                        />
                      </Box>
                    </Paper>
                  ))}
                </Stack>
              </Paper>
            </Grid>

            {/* Safety Incidents Tracking */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2, height: 350 }}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Safety Incident Tracking (Last 30 Days)
                </Typography>
                <List dense>
                  {medicationSafety?.safetyIncidents?.map((incident, index) => (
                    <ListItem key={index} sx={{ px: 0 }}>
                      <ListItemText
                        primary={
                          <Box display="flex" justifyContent="space-between" alignItems="center">
                            <Typography variant="body2">
                              {incident.type}
                            </Typography>
                            <Box display="flex" alignItems="center" gap={1}>
                              <Chip
                                label={incident.count}
                                size="small"
                                color={incident.count === 0 ? 'success' : incident.severity === 'critical' ? 'error' : 'warning'}
                              />
                              {incident.trend === 'down' && <ArrowDownIcon sx={{ fontSize: 16, color: 'success.main' }} />}
                              {incident.trend === 'up' && <ArrowUpIcon sx={{ fontSize: 16, color: 'error.main' }} />}
                            </Box>
                          </Box>
                        }
                        secondary={
                          <LinearProgress
                            variant="determinate"
                            value={Math.min((incident.count / 10) * 100, 100)}
                            sx={{
                              mt: 0.5,
                              height: 6,
                              borderRadius: 3,
                              bgcolor: alpha(theme.palette.divider, 0.2),
                              '& .MuiLinearProgress-bar': {
                                borderRadius: 3,
                                bgcolor: incident.count === 0 ? 'success.main' : 
                                        incident.severity === 'critical' ? 'error.main' : 'warning.main'
                              }
                            }}
                          />
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </Paper>
            </Grid>

            {/* High-Risk Medication Monitoring */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  High-Risk Medication Monitoring
                </Typography>
                <Grid container spacing={2}>
                  {medicationSafety?.highRiskCategories?.map((category, index) => (
                    <Grid item xs={12} sm={6} key={index}>
                      <Box
                        sx={{
                          p: 2,
                          border: 1,
                          borderColor: 'divider',
                          borderRadius: 1,
                          bgcolor: alpha(
                            category.risk === 'critical' ? theme.palette.error.main : theme.palette.warning.main,
                            0.05
                          )
                        }}
                      >
                        <Box display="flex" alignItems="center" gap={1} mb={1}>
                          <Typography variant="h6">{category.icon}</Typography>
                          <Typography variant="subtitle2" fontWeight="bold">
                            {category.category}
                          </Typography>
                        </Box>
                        <Typography variant="h4" fontWeight="bold" color={category.risk === 'critical' ? 'error' : 'warning'}>
                          {category.count}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block">
                          patients
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {category.description}
                        </Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
                <Divider sx={{ my: 2 }} />
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="subtitle2">
                      {medicationSafety?.polypharmacy?.icon} Polypharmacy Risk
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Patients with ≥{medicationSafety?.polypharmacy?.threshold} medications
                    </Typography>
                  </Box>
                  <Typography variant="h5" fontWeight="bold" color="warning.main">
                    {medicationSafety?.polypharmacy?.count || 0}
                  </Typography>
                </Box>
              </Paper>
            </Grid>

            {/* Quality Metrics Summary */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Patient Safety Quality Metrics ({qualityMetrics?.period || '30 days'})
                </Typography>
                <Stack spacing={2}>
                  {qualityMetrics && [
                    qualityMetrics.hai,
                    qualityMetrics.falls,
                    qualityMetrics.medicationErrors,
                    qualityMetrics.pressureInjuries
                  ].map((metric, index) => {
                    const value = parseFloat(metric.rate);
                    const percentage = metric.label.includes('per 1000') ? 
                      Math.max(0, 100 - (value / 10 * 100)) : // For fall rate
                      Math.max(0, 100 - (value * 10)); // For percentage rates
                    const color = value <= metric.benchmark ? 'success' : 
                                 value <= metric.benchmark * 1.5 ? 'warning' : 'error';
                    
                    return (
                      <Box key={index}>
                        <Box display="flex" justifyContent="space-between" mb={0.5}>
                          <Typography variant="body2">{metric.label}</Typography>
                          <Typography variant="body2" fontWeight="bold">
                            {metric.rate}{metric.label.includes('%') ? '%' : ''}
                          </Typography>
                        </Box>
                        <LinearProgress 
                          variant="determinate" 
                          value={percentage} 
                          color={color} 
                          sx={{ height: 8, borderRadius: 4 }} 
                        />
                        <Typography variant="caption" color="text.secondary">
                          {metric.count} events • Benchmark: {metric.benchmark}{metric.label.includes('%') ? '%' : ''}
                        </Typography>
                      </Box>
                    );
                  })}
                </Stack>
                {qualityMetrics && (
                  <Alert 
                    severity={
                      [qualityMetrics.hai, qualityMetrics.falls, qualityMetrics.medicationErrors, qualityMetrics.pressureInjuries]
                        .every(m => parseFloat(m.rate) <= m.benchmark) ? 'success' : 'warning'
                    } 
                    sx={{ mt: 2 }}
                  >
                    <Typography variant="caption">
                      {[qualityMetrics.hai, qualityMetrics.falls, qualityMetrics.medicationErrors, qualityMetrics.pressureInjuries]
                        .filter(m => parseFloat(m.rate) <= m.benchmark).length} of 4 metrics meet or exceed benchmarks
                    </Typography>
                  </Alert>
                )}
              </Paper>
            </Grid>
          </Grid>
        )}

        {/* Analytics Tab */}
        {activeTab === 4 && (
          <Grid container spacing={2}>
            {/* Encounter Types */}
            <Grid item xs={12} lg={6}>
              <Paper sx={{ p: 2, height: 350 }}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Encounter Types Distribution
                </Typography>
                <Box sx={{ width: '100%', height: 280 }}>
                  <ResponsiveContainer>
                    <BarChart 
                      data={trendingData?.encounterTypes || []}
                      margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.3)} />
                      <XAxis 
                        dataKey="type" 
                        angle={-30}
                        textAnchor="end"
                        interval={0}
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis tick={{ fontSize: 11 }} />
                      <ChartTooltip />
                      <Bar dataKey="count" fill={theme.palette.primary.main} radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </Paper>
            </Grid>

            {/* Care Gap Performance */}
            <Grid item xs={12} lg={6}>
              <Paper sx={{ p: 2, height: 350 }}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Preventive Care Performance
                </Typography>
                <Box sx={{ width: '100%', height: 280 }}>
                  <ResponsiveContainer>
                    <BarChart
                      data={careGaps?.gaps?.map(gap => ({
                        ...gap,
                        displayPercentage: gap.percentage || 0
                      })) || []}
                      layout="vertical"
                      margin={{ top: 20, right: 30, left: 100, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.3)} />
                      <XAxis 
                        type="number" 
                        domain={[0, 100]}
                        tick={{ fontSize: 11 }}
                        tickFormatter={(value) => `${value}%`}
                      />
                      <YAxis 
                        dataKey="measure" 
                        type="category"
                        tick={{ fontSize: 11 }}
                        width={90}
                      />
                      <ChartTooltip formatter={(value) => `${value}%`} />
                      <Bar dataKey="displayPercentage" radius={[0, 8, 8, 0]}>
                        {(careGaps?.gaps || []).map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.percentage >= 80 ? theme.palette.success.main : 
                                  entry.percentage >= 60 ? theme.palette.warning.main : 
                                  theme.palette.error.main} 
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </Paper>
            </Grid>

            {/* Additional Analytics */}
            <Grid item xs={12}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Key Performance Indicators
                </Typography>
                <Grid container spacing={2} sx={{ mt: 1 }}>
                  <Grid item xs={6} sm={3}>
                    <Box textAlign="center">
                      <Typography variant="h4" fontWeight="bold" color="primary">
                        {trendingData?.averagePerDay || 0}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Avg Encounters/Day
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Box textAlign="center">
                      <Typography variant="h4" fontWeight="bold" color="success.main">
                        {careGaps?.gaps?.filter(g => g.percentage >= 80).length || 0}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Quality Targets Met
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Box textAlign="center">
                      <Typography variant="h4" fontWeight="bold" color="warning.main">
                        {medicationSafety?.polypharmacy?.count || 0}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Polypharmacy Patients
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Box textAlign="center">
                      <Typography variant="h4" fontWeight="bold" color="info.main">
                        {Math.round((careGaps?.gaps?.reduce((sum, g) => sum + g.percentage, 0) || 0) / (careGaps?.gaps?.length || 1))}%
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Overall Compliance
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>
          </Grid>
        )}
      </Box>

      <style jsx>{`
        @keyframes rotate {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        
        .rotating {
          animation: rotate 1s linear infinite;
        }
      `}</style>
    </Box>
  );
}

export default Dashboard;