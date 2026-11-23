/**
 * Enhanced Clinical Dashboard
 * A powerful, beautiful dashboard with clinical tools, visualizations, and actionable insights
 */

import React, { useState, useEffect, useCallback } from 'react';
import BarList from '../components/common/BarList';
import StatTile from '../components/common/StatTile';
import PageHeader from '../components/common/PageHeader';
import { getToneColors } from '../utils/statusDisplay';
import { buildAttentionItems, greetingFor, CARE_TARGET } from '../utils/dashboardAttention';
import {
  Box,
  Grid,
  Typography,
  IconButton,
  Chip,
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
  Skeleton,
  List,
  ListItem,
  ListItemText,
  ButtonBase
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  LocalHospital as HospitalIcon,
  Calculate as CalculateIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
  ChevronRight as ChevronRightIcon
} from '@mui/icons-material';

// Chart imports
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';

// Service imports
import dashboardDataService from '../services/dashboard/dashboardDataService';
import api from '../services/api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';

// Component imports
import ClinicalCalculatorWidget from '../components/dashboard/widgets/ClinicalCalculatorWidget';
import PatientListWidget from '../components/dashboard/widgets/PatientListWidget';
import CareGapsWidget from '../components/dashboard/widgets/CareGapsWidget';

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
  const [population, setPopulation] = useState(null);

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

      // The same snapshot the Analytics page draws, so the two pages agree.
      // It belongs to an optional module: without it the overview falls back
      // to the registry counts above.
      try {
        const response = await api.get('/api/analytics/population');
        setPopulation(response.data);
      } catch (snapshotError) {
        setPopulation(null);
      }

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

  // Encounter series for the chart. The average is computed here from the
  // series itself; the rounded figure from the API showed "0 per day" for
  // any population with fewer than one encounter a day.
  const encounterSeries = trendingData?.dailyTrend || [];
  const encounterTotal = encounterSeries.reduce((sum, day) => sum + (day.encounters || 0), 0);
  const encounterAverage = encounterSeries.length
    ? (encounterTotal / encounterSeries.length).toFixed(1)
    : '0';

  const busiestDay = encounterSeries.reduce(
    (best, day) => ((day.encounters || 0) > (best?.encounters || 0) ? day : best),
    null,
  );

  // Care measures only count when someone is eligible for them.
  const measuredGaps = (careGaps?.gaps || []).filter((gap) => gap.eligible > 0);
  const measuresOnTarget = measuredGaps.filter((gap) => gap.percentage >= CARE_TARGET).length;
  // Prefer the snapshot's count (distinct drugs, living patients) when present.
  const polypharmacy = population
    ? { count: population.medications.polypharmacy.patients, threshold: population.medications.threshold }
    : medicationSafety?.polypharmacy;
  const attentionItems = buildAttentionItems({ careGaps, medicationSafety: { polypharmacy } });
  const topDiagnoses = (population?.conditions?.items || [])
    .filter((item) => item.kind === 'diagnosis')
    .slice(0, 6);

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
          <PageHeader
            title={`${greetingFor()}${user?.name ? `, ${user.name}` : ''}`}
            subtitle={format(new Date(), 'EEEE, MMMM d, yyyy')}
            sx={{ mb: 0 }}
          />
          <Box>
            <Tooltip title="Refresh data">
              <IconButton onClick={handleRefresh} disabled={refreshing}>
                <RefreshIcon sx={{
                  animation: refreshing ? 'spin 1s linear infinite' : 'none',
                  '@keyframes spin': {
                    '0%': { transform: 'rotate(0deg)' },
                    '100%': { transform: 'rotate(360deg)' }
                  }
                }} />
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
      <Box sx={{ flexGrow: 1, overflow: 'auto', px: 3, pb: 3 }}>
        {/* Overview Tab */}
        {activeTab === 0 && (
          <Grid container spacing={2}>
            {/* Headline numbers. Each opens the page behind it. */}
            <Grid item xs={6} md={3}>
              <StatTile
                label="Patients"
                value={populationStats?.totalPatients ?? 0}
                caption={population?.patients?.deceased_excluded
                  ? `${population.patients.total} living · ${population.patients.deceased_excluded} deceased`
                  : undefined}
                onClick={() => navigate('/patients')}
              />
            </Grid>
            <Grid item xs={6} md={3}>
              <StatTile
                label="Encounters, last 30 days"
                value={encounterTotal}
                caption={`${encounterAverage} per day${busiestDay ? ` · busiest ${format(new Date(`${busiestDay.date}T00:00`), 'EEE MMM d')} (${busiestDay.encounters})` : ''}`}
                onClick={() => navigate('/encounters')}
              />
            </Grid>
            <Grid item xs={6} md={3}>
              <StatTile
                label="Active medication orders"
                value={populationStats?.activeMedications ?? 0}
                caption={`${populationStats?.activeConditions ?? 0} active conditions on record`}
                onClick={() => navigate('/pharmacy')}
              />
            </Grid>
            <Grid item xs={6} md={3}>
              <StatTile
                label="Care measures on target"
                value={measuredGaps.length ? `${measuresOnTarget} of ${measuredGaps.length}` : null}
                caption={`Target ${CARE_TARGET}% of eligible patients`}
                tone={measuresOnTarget < measuredGaps.length ? 'attention' : 'neutral'}
                toneWhenZero
                onClick={() => navigate('/care-gaps')}
              />
            </Grid>

            {/* Encounters per day. Counts are whole numbers on separate days, so
                they are bars: a smoothed area drew values that never happened. */}
            <Grid item xs={12} md={8}>
              <Paper variant="outlined" sx={{ p: 2, height: 340 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                  <Typography variant="subtitle1" fontWeight="bold">
                    Encounters per day
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Last 30 days · dashed line is the daily average
                  </Typography>
                </Stack>
                {encounterTotal === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                    No encounters recorded in the last 30 days.
                  </Typography>
                ) : (
                  <Box sx={{ width: '100%', height: 270, mt: 1 }}>
                    <ResponsiveContainer>
                      <BarChart data={encounterSeries} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                        <CartesianGrid vertical={false} stroke={theme.palette.divider} />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(value) => {
                            const date = new Date(`${value}T00:00`);
                            return Number.isNaN(date.getTime()) ? '' : format(date, 'MMM d');
                          }}
                          interval={6}
                          tickLine={false}
                          axisLine={{ stroke: theme.palette.divider }}
                          tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
                        />
                        <YAxis
                          allowDecimals={false}
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
                        />
                        <ChartTooltip
                          cursor={{ fill: theme.palette.action.hover }}
                          contentStyle={{
                            backgroundColor: theme.palette.background.paper,
                            border: `1px solid ${theme.palette.divider}`,
                            borderRadius: 6,
                            boxShadow: 'none',
                            fontSize: 12,
                          }}
                          labelFormatter={(value) => {
                            const date = new Date(`${value}T00:00`);
                            return Number.isNaN(date.getTime()) ? value : format(date, 'EEE, MMM d');
                          }}
                          formatter={(value) => [value, 'Encounters']}
                        />
                        <ReferenceLine
                          y={Number(encounterAverage)}
                          stroke={theme.palette.text.secondary}
                          strokeDasharray="4 4"
                          ifOverflow="extendDomain"
                        />
                        <Bar
                          dataKey="encounters"
                          fill={theme.palette.primary.main}
                          radius={[4, 4, 0, 0]}
                          maxBarSize={16}
                          isAnimationActive={false}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                )}
              </Paper>
            </Grid>

            {/* What is below its line, worst first. */}
            <Grid item xs={12} md={4}>
              <Paper variant="outlined" sx={{ p: 2, height: 340, overflow: 'auto' }}>
                <Typography variant="subtitle1" fontWeight="bold">
                  Needs attention
                </Typography>
                {attentionItems.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                    Nothing is below target. Every care measure with eligible patients is at {CARE_TARGET}% or better.
                  </Typography>
                ) : (
                  <Stack component="ul" spacing={0.5} sx={{ listStyle: 'none', m: 0, mt: 1, p: 0 }}>
                    {attentionItems.map((item) => {
                      const colors = getToneColors(theme, item.tone);
                      return (
                        <Box component="li" key={item.id}>
                          <ButtonBase
                            onClick={() => navigate(item.to)}
                            focusRipple
                            sx={{
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              textAlign: 'left',
                              gap: 1,
                              py: 1,
                              pl: 1.5,
                              pr: 0.5,
                              borderRadius: 1,
                              boxShadow: `inset 3px 0 0 ${colors.border}`,
                              '&:hover': { backgroundColor: 'action.hover' },
                            }}
                          >
                            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>{item.title}</Typography>
                              <Typography variant="caption" color="text.secondary" component="div">{item.detail}</Typography>
                            </Box>
                            <ChevronRightIcon fontSize="small" sx={{ color: 'text.disabled', flexShrink: 0 }} />
                          </ButtonBase>
                        </Box>
                      );
                    })}
                  </Stack>
                )}
              </Paper>
            </Grid>

            {/* Preventive care against its target. */}
            <Grid item xs={12} md={7}>
              <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" fontWeight="bold">
                    Preventive care
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Completed of eligible · mark is the {CARE_TARGET}% target
                  </Typography>
                </Stack>
                {(careGaps?.gaps || []).length === 0 ? (
                  <Typography variant="body2" color="text.secondary">No care measures available.</Typography>
                ) : (
                  <Stack spacing={2}>
                    {careGaps.gaps.map((gap) => {
                      const measured = gap.eligible > 0;
                      const onTarget = gap.percentage >= CARE_TARGET;
                      const fill = !measured || onTarget
                        ? theme.palette.primary.main
                        : getToneColors(theme, gap.percentage < 50 ? 'critical' : 'attention').border;
                      return (
                        <Box key={gap.measure}>
                          <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {gap.measure}
                              <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1, fontWeight: 400 }}>
                                {gap.description}
                              </Typography>
                            </Typography>
                            <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', ml: 2 }}>
                              {measured ? (
                                <>
                                  <Box component="span" sx={{ color: 'text.secondary', mr: 1 }}>{gap.completed} of {gap.eligible}</Box>
                                  <Box component="span" sx={{ fontWeight: 600 }}>{gap.percentage}%</Box>
                                </>
                              ) : (
                                <Box component="span" sx={{ color: 'text.secondary' }}>No eligible patients</Box>
                              )}
                            </Typography>
                          </Stack>
                          <Box
                            role="img"
                            aria-label={measured
                              ? `${gap.measure}: ${gap.percentage}% complete, target ${CARE_TARGET}%`
                              : `${gap.measure}: no eligible patients`}
                            sx={{ position: 'relative', height: 10, mt: 0.75, borderRadius: 1, backgroundColor: 'action.hover' }}
                          >
                            {measured && (
                              <Box sx={{ height: '100%', width: `${gap.percentage}%`, minWidth: gap.percentage > 0 ? 3 : 0, borderRadius: 1, backgroundColor: fill }} />
                            )}
                            <Box sx={{ position: 'absolute', top: -3, bottom: -3, left: `${CARE_TARGET}%`, width: 2, backgroundColor: 'text.primary' }} />
                          </Box>
                        </Box>
                      );
                    })}
                  </Stack>
                )}
              </Paper>
            </Grid>

            {/* Conditions. A patient can have several, so these are not slices
                of one whole: ranked bars, not a donut. */}
            <Grid item xs={12} md={5}>
              <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 1.5 }}>
                  <Typography variant="subtitle1" fontWeight="bold">
                    {population ? 'Most common diagnoses' : 'Chronic disease registry'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {population
                      ? `of ${population.patients.total} living patients`
                      : `of ${chronicDiseaseStats?.totalPatients || 0} patients`}
                  </Typography>
                </Stack>
                {population ? (
                  <BarList
                    items={topDiagnoses.map((item) => ({ label: item.name, value: item.patients }))}
                    max={population.patients.total || undefined}
                    formatValue={(value) => `${value} (${Math.round((value / (population.patients.total || 1)) * 100)}%)`}
                    labelWidth="46%"
                    emptyText="No active diagnoses recorded."
                  />
                ) : (
                  <BarList
                    items={(chronicDiseaseStats?.diseases || []).map((disease) => ({
                      label: disease.name,
                      value: disease.count,
                    }))}
                    max={chronicDiseaseStats?.totalPatients || undefined}
                    emptyText="No chronic conditions recorded."
                  />
                )}
                <Button
                  size="small"
                  endIcon={<ChevronRightIcon />}
                  onClick={() => navigate('/analytics')}
                  sx={{ mt: 2, ml: -0.5 }}
                >
                  Explore the population
                </Button>
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
      </Box>

    </Box>
  );
}

export default Dashboard;