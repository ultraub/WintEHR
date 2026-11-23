/**
 * Enhanced Clinical Dashboard
 * A powerful, beautiful dashboard with clinical tools, visualizations, and actionable insights
 */

import React, { useState, useEffect, useCallback } from 'react';
import BarList from '../components/common/BarList';
import StatTile from '../components/common/StatTile';
import { getToneColors } from '../utils/statusDisplay';
import { buildAttentionItems, describeToday, greetingFor, CARE_TARGET, FAR_BELOW } from '../utils/dashboardAttention';
import { avatarColorFor, initialsOf } from '../utils/avatarColor';
import { useAuroraPalette, avatarInk } from '../themes/auroraPalette';
import AuroraHero from '../components/common/AuroraHero';
import ProgressRing from '../components/common/ProgressRing';
import SectionCard from '../components/common/SectionCard';
import { describeConditions } from '../utils/populationSummaries';
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
  Refresh as RefreshIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
  ChevronRight as ChevronRightIcon,
  Vaccines as VaccinesIcon,
  PriorityHigh as PriorityHighIcon,
  EventNote as EventNoteIcon,
  MonitorHeart as MonitorHeartIcon,
  People as PeopleIcon,
  Medication as MedicationIcon
} from '@mui/icons-material';

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
  const auroraPalette = useAuroraPalette();

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
  const [recentEncounters, setRecentEncounters] = useState(null);

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
        metricsData,
        encountersData
      ] = await Promise.all([
        dashboardDataService.getPopulationStats(),
        dashboardDataService.getChronicDiseaseStats(),
        dashboardDataService.getCareGaps(),
        dashboardDataService.getMedicationSafetyStats(),
        dashboardDataService.getTrendingData(30),
        dashboardDataService.getQualityMetrics(),
        dashboardDataService.getRecentEncounters(30)
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
      setRecentEncounters(encountersData);

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

  // Care measures only count when someone is eligible for them.
  const measuredGaps = (careGaps?.gaps || []).filter((gap) => gap.eligible > 0);
  const measuresOnTarget = measuredGaps.filter((gap) => gap.percentage >= CARE_TARGET).length;
  // Prefer the snapshot's count (distinct drugs, living patients) when present.
  const polypharmacy = population
    ? { count: population.medications.polypharmacy.patients, threshold: population.medications.threshold }
    : medicationSafety?.polypharmacy;
  const attentionItems = buildAttentionItems({ careGaps, medicationSafety: { polypharmacy }, recentEncounters });
  const topDiagnoses = (population?.conditions?.items || [])
    .filter((item) => item.kind === 'diagnosis')
    .slice(0, 8);

  const outstandingCare = measuredGaps.reduce((sum, gap) => sum + Math.max(0, gap.eligible - gap.completed), 0);
  const encounterPeak = Math.max(1, ...encounterSeries.map((day) => day.encounters || 0));
  const todaySummary = describeToday({ careGaps, recentEncounters });

  // Tiles on the deep ground: a soft shadow at dusk, a thin outline at night.
  const tileSx = {
    borderColor: auroraPalette.cardBorder,
    borderRadius: 1.75,
    boxShadow: auroraPalette.cardShadow,
  };
  const latestEncounters = (recentEncounters?.encounters || []).slice(0, 5);

  // Render loading state
  if (loading && !refreshing) {
    const bone = { bgcolor: auroraPalette.groundRaised, borderRadius: 2.25 };
    return (
      <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
        <Skeleton variant="rectangular" height={250} sx={bone} />
        <Grid container spacing={2} sx={{ mt: 1 }}>
          {[1, 2, 3, 4].map((i) => (
            <Grid item xs={6} md={3} key={i}>
              <Skeleton variant="rectangular" height={96} sx={bone} />
            </Grid>
          ))}
          <Grid item xs={12} md={7}><Skeleton variant="rectangular" height={300} sx={bone} /></Grid>
          <Grid item xs={12} md={5}><Skeleton variant="rectangular" height={300} sx={bone} /></Grid>
        </Grid>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      {/* The page sits on the deep ground (router: ground 'deep'), so anything
          set directly on it uses auroraPalette's on-ground colours. */}
      <AuroraHero
        eyebrow={format(new Date(), 'EEEE, MMMM d, yyyy')}
        title={user?.name ? `${greetingFor()},` : greetingFor()}
        highlight={user?.name}
        summary={todaySummary}
      />

      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 1.5, mb: 2 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          aria-label="Dashboard sections"
          sx={{
            minHeight: 44,
            '& .MuiTab-root': {
              minHeight: 44,
              textTransform: 'none',
              fontSize: '0.9375rem',
              fontWeight: 500,
              color: auroraPalette.onGroundSoft,
              opacity: 0.8,
              '&.Mui-selected': { color: auroraPalette.onGround, opacity: 1, fontWeight: 600 },
              '&.Mui-focusVisible': { outline: `2px solid ${auroraPalette.onGroundAccent}`, outlineOffset: -2 },
            },
            '& .MuiTabs-indicator': { backgroundColor: auroraPalette.onGroundAccent, height: 3, borderRadius: 2 },
            '& .MuiTabs-scrollButtons': { color: auroraPalette.onGroundSoft },
          }}
        >
          <Tab label="Overview" />
          <Tab label="Population Health" />
          <Tab label="Clinical Tools" />
          <Tab label="Safety & Alerts" />
        </Tabs>
        <Tooltip title="Refresh data">
          <span>
            <IconButton onClick={handleRefresh} disabled={refreshing} aria-label="Refresh data" sx={{ color: auroraPalette.onGroundSoft }}>
              <RefreshIcon sx={{
                animation: refreshing ? 'spin 1s linear infinite' : 'none',
                '@keyframes spin': {
                  '0%': { transform: 'rotate(0deg)' },
                  '100%': { transform: 'rotate(360deg)' }
                }
              }} />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Tab Content */}
      <Box>
        {/* Overview Tab */}
        {activeTab === 0 && (
          <Grid container spacing={2.5}>
            {/* Headline numbers. Each opens the page behind it. */}
            <Grid item xs={6} md={3}>
              <StatTile
                label="Patients"
                value={populationStats?.totalPatients ?? 0}
                caption={population?.patients?.deceased_excluded
                  ? `${population.patients.total} living · ${population.patients.deceased_excluded} deceased`
                  : undefined}
                icon={<PeopleIcon />}
                onClick={() => navigate('/patients')}
                sx={tileSx}
              />
            </Grid>
            <Grid item xs={6} md={3}>
              <StatTile
                label="Encounters, last 30 days"
                value={encounterTotal}
                caption={(
                  <Stack direction="row" alignItems="flex-end" spacing={1}>
                    <span>{encounterAverage} per day</span>
                    {/* one mark per day, oldest first */}
                    <Box
                      role="img"
                      aria-label={`${encounterTotal} encounters across the last ${encounterSeries.length} days`}
                      sx={{ flexGrow: 1, display: 'flex', alignItems: 'flex-end', gap: '2px', height: 18 }}
                    >
                      {encounterSeries.map((day) => (
                        <Box
                          key={day.date}
                          sx={{
                            flex: '1 1 0',
                            borderRadius: '1px',
                            height: day.encounters > 0 ? `${Math.max(30, (day.encounters / encounterPeak) * 100)}%` : '2px',
                            backgroundColor: day.encounters > 0 ? 'primary.main' : 'divider',
                          }}
                        />
                      ))}
                    </Box>
                  </Stack>
                )}
                icon={<EventNoteIcon />}
                onClick={() => navigate('/encounters')}
                sx={tileSx}
              />
            </Grid>
            <Grid item xs={6} md={3}>
              <StatTile
                label="Active medication orders"
                value={populationStats?.activeMedications ?? 0}
                caption={`${(populationStats?.activeConditions ?? 0).toLocaleString()} active conditions on record`}
                icon={<MedicationIcon />}
                onClick={() => navigate('/pharmacy')}
                sx={tileSx}
              />
            </Grid>
            <Grid item xs={6} md={3}>
              <StatTile
                label="Care measures on target"
                value={measuredGaps.length ? `${measuresOnTarget} of ${measuredGaps.length}` : null}
                caption={`Target ${CARE_TARGET}% of eligible patients`}
                tone={measuresOnTarget < measuredGaps.length ? 'attention' : 'neutral'}
                toneWhenZero
                icon={<VaccinesIcon />}
                onClick={() => navigate('/care-gaps')}
                sx={tileSx}
              />
            </Grid>

            {/* Preventive care: each measure as a ring against the target. */}
            <Grid item xs={12} md={7}>
              <SectionCard
                title="Preventive care"
                icon={<VaccinesIcon />}
                note={`Target ${CARE_TARGET}% of eligible patients`}
                action={{ label: 'Care gaps', onClick: () => navigate('/care-gaps') }}
                footer={measuredGaps.length > 0
                  ? `${outstandingCare.toLocaleString()} screenings and tests outstanding across ${measuredGaps.length} measures`
                  : undefined}
              >
                {measuredGaps.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No care measures have eligible patients yet.
                  </Typography>
                ) : (
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))', gap: 1.5 }}>
                    {[...measuredGaps].sort((x, y) => y.percentage - x.percentage).map((gap) => {
                      const onTarget = gap.percentage >= CARE_TARGET;
                      const farBelow = gap.percentage < FAR_BELOW;
                      return (
                        <Box key={gap.measure} sx={{ borderRadius: 2, backgroundColor: 'action.hover', py: 1.5, px: 0.5 }}>
                          <ProgressRing
                            value={gap.percentage}
                            label={gap.measure}
                            caption={`${gap.completed} of ${gap.eligible}`}
                            status={onTarget ? 'On target' : farBelow ? 'Far below' : 'Below target'}
                            tone={onTarget ? 'positive' : farBelow ? 'critical' : 'attention'}
                            size={116}
                            onClick={() => navigate('/care-gaps')}
                          />
                        </Box>
                      );
                    })}
                  </Box>
                )}
              </SectionCard>
            </Grid>

            {/* What is off, worst first. The one card that leads the page. */}
            <Grid item xs={12} md={5}>
              <SectionCard
                title="Needs attention"
                icon={<PriorityHighIcon />}
                note={attentionItems.length > 0 ? `${attentionItems.length} to review, worst first` : 'Nothing to review'}
                lead
              >
                {attentionItems.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    Nothing is far below target and no patient stands out.
                  </Typography>
                ) : (
                  <Stack component="ul" spacing={1} sx={{ listStyle: 'none', m: 0, p: 0 }}>
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
                              gap: 1.75,
                              minHeight: 72,
                              p: 1.25,
                              borderRadius: 2,
                              border: '1px solid',
                              borderColor: 'divider',
                              transition: 'border-color 150ms, background-color 150ms',
                              '&:hover': { backgroundColor: 'action.hover', borderColor: colors.border },
                            }}
                          >
                            <Box
                              aria-hidden
                              sx={{
                                flex: '0 0 48px',
                                height: 48,
                                borderRadius: 1.5,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontFamily: theme.typography.fontFamilyMonospace,
                                fontWeight: 700,
                                fontSize: '1rem',
                                letterSpacing: '-0.04em',
                                color: colors.fg,
                                backgroundColor: colors.bg,
                              }}
                            >
                              {item.badge}
                            </Box>
                            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                              <Typography sx={{ fontWeight: 600, fontSize: '0.9375rem' }}>{item.title}</Typography>
                              <Typography variant="body2" color="text.secondary">{item.detail}</Typography>
                            </Box>
                            <ChevronRightIcon fontSize="small" sx={{ color: 'text.secondary', flexShrink: 0 }} />
                          </ButtonBase>
                        </Box>
                      );
                    })}
                  </Stack>
                )}
              </SectionCard>
            </Grid>

            {/* Who has been seen lately. */}
            <Grid item xs={12} md={5}>
              <SectionCard
                title="Recent encounters"
                icon={<EventNoteIcon />}
                note={`${encounterTotal} in the last 30 days`}
                action={{ label: 'All encounters', onClick: () => navigate('/encounters') }}
              >
                {latestEncounters.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    {recentEncounters?.error
                      ? 'Recent encounters could not be loaded.'
                      : 'No encounters recorded in the last 30 days.'}
                  </Typography>
                ) : (
                  <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
                    {latestEncounters.map((encounter, index) => (
                      <Box component="li" key={encounter.id} sx={{ borderTop: index === 0 ? 'none' : '1px solid', borderColor: 'divider' }}>
                        <ButtonBase
                          onClick={() => navigate(encounter.patientId ? `/patients/${encodeURIComponent(encounter.patientId)}` : '/encounters')}
                          focusRipple
                          sx={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            textAlign: 'left',
                            gap: 1.75,
                            minHeight: 58,
                            py: 0.5,
                            borderRadius: 1,
                            '&:hover': { backgroundColor: 'action.hover' },
                          }}
                        >
                          <Box
                            aria-hidden
                            sx={{
                              flex: '0 0 40px',
                              height: 40,
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 600,
                              fontSize: '0.8125rem',
                              color: avatarInk,
                              backgroundColor: avatarColorFor(encounter.patientName),
                            }}
                          >
                            {initialsOf(encounter.patientName)}
                          </Box>
                          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                            <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }} noWrap>{encounter.patientName}</Typography>
                            <Typography variant="body2" color="text.secondary" noWrap>
                              {encounter.reason ? `${encounter.type} · ${encounter.reason}` : encounter.type}
                            </Typography>
                          </Box>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ flexShrink: 0, fontFamily: theme.typography.fontFamilyMonospace, fontWeight: 600 }}
                          >
                            {encounter.date ? format(new Date(encounter.date), 'MMM d') : ''}
                          </Typography>
                        </ButtonBase>
                      </Box>
                    ))}
                  </Box>
                )}
              </SectionCard>
            </Grid>

            {/* Conditions. A patient can have several, so these are not slices
                of one whole: ranked bars, not a donut. */}
            <Grid item xs={12} md={7}>
              <SectionCard
                title={population ? 'Most common diagnoses' : 'Chronic disease registry'}
                icon={<MonitorHeartIcon />}
                note={population
                  ? `Share of ${population.patients.total} living patients`
                  : `Of ${chronicDiseaseStats?.totalPatients || 0} patients`}
                action={{ label: 'Explore', onClick: () => navigate('/analytics') }}
                footer={population ? describeConditions(population.conditions, population.patients.total) : undefined}
              >
                {population ? (
                  <BarList
                    items={topDiagnoses.map((item) => ({ label: item.name, value: item.patients }))}
                    max={population.patients.total || undefined}
                    formatValue={(value) => `${value} (${Math.round((value / (population.patients.total || 1)) * 100)}%)`}
                    labelWidth="40%"
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
              </SectionCard>
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