/**
 * Data Charts Component for FHIR Explorer v4
 * 
 * Interactive charts and graphs for clinical data visualization
 * Leverages existing analytics APIs for real-time healthcare insights
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Button,
  Chip,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  Switch,
  FormControlLabel,
  IconButton
} from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import {
  Analytics as AnalyticsIcon,
  People as PeopleIcon,
  LocalPharmacy as PharmacyIcon,
  MonitorHeart as HealthIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  TrendingUp as TrendingUpIcon,
  DonutLarge as DonutIcon
} from '@mui/icons-material';

// Chart color palette
const CHART_COLORS = [
  '#1976d2', '#dc004e', '#9c27b0', '#673ab7', '#3f51b5',
  '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50',
  '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107', '#ff9800',
  '#ff5722', '#795548', '#9e9e9e', '#607d8b'
];

function DataCharts({ onNavigate, fhirData }) {
  const [currentTab, setCurrentTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  
  // Analytics data state
  const [demographicsData, setDemographicsData] = useState(null);
  const [diseasePrevalenceData, setDiseasePrevalenceData] = useState(null);
  const [medicationPatternsData, setMedicationPatternsData] = useState(null);
  const [refreshInterval, setRefreshInterval] = useState(null);

  // Fetch analytics data from backend
  const fetchAnalyticsData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const [demographics, diseases, medications] = await Promise.all([
        fetch('/api/analytics/demographics').then(res => res.json()),
        fetch('/api/analytics/disease-prevalence').then(res => res.json()),
        fetch('/api/analytics/medication-patterns').then(res => res.json())
      ]);
      
      setDemographicsData(demographics);
      setDiseasePrevalenceData(diseases);
      setMedicationPatternsData(medications);
    } catch (err) {
      setError(err.message || 'Failed to fetch analytics data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-refresh setup
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchAnalyticsData, 30000); // Refresh every 30 seconds
      setRefreshInterval(interval);
      return () => clearInterval(interval);
    } else if (refreshInterval) {
      clearInterval(refreshInterval);
      setRefreshInterval(null);
    }
  }, [autoRefresh, fetchAnalyticsData]);

  // Initial data load
  useEffect(() => {
    fetchAnalyticsData();
  }, [fetchAnalyticsData]);

  // Export chart data
  const exportChartData = useCallback((data, filename) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  // Format demographics data for charts
  const formatDemographicsData = useCallback((data) => {
    if (!data) return null;
    
    return {
      ageGroups: data.age_groups?.map(group => ({
        name: group.age_group,
        value: group.count,
        percentage: group.percentage
      })) || [],
      
      genderDistribution: data.gender_distribution?.map(gender => ({
        name: gender.gender,
        value: gender.count,
        percentage: gender.percentage
      })) || [],
      
      raceDistribution: data.race_distribution?.map(race => ({
        name: race.race,
        value: race.count,
        percentage: race.percentage
      })) || []
    };
  }, []);

  // Format disease prevalence data
  const formatDiseaseData = useCallback((data) => {
    if (!data) return null;
    
    return data.top_conditions?.map(condition => ({
      name: condition.condition_name,
      value: condition.patient_count,
      percentage: condition.percentage
    })) || [];
  }, []);

  // Format medication patterns data
  const formatMedicationData = useCallback((data) => {
    if (!data) return null;
    
    return data.medication_classes?.map(medClass => ({
      name: medClass.medication_class,
      value: medClass.prescription_count,
      percentage: medClass.percentage
    })) || [];
  }, []);

  // Custom tooltip for charts
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <Paper sx={{ p: 2, border: '1px solid #ccc' }}>
          <Typography variant="body2" fontWeight="bold">{label}</Typography>
          {payload.map((entry, index) => (
            <Typography key={index} variant="body2" color={entry.color}>
              {`${entry.name}: ${entry.value} (${entry.payload.percentage?.toFixed(1)}%)`}
            </Typography>
          ))}
        </Paper>
      );
    }
    return null;
  };

  // Demographics Charts Tab
  const DemographicsTab = () => {
    const formattedData = formatDemographicsData(demographicsData);
    if (!formattedData) return <CircularProgress />;

    return (
      <Grid container spacing={3}>
        {/* Age Distribution */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader
              title="Age Distribution"
              avatar={<PeopleIcon color="primary" />}
              action={
                <IconButton size="small" onClick={() => exportChartData(formattedData.ageGroups, 'age-distribution')}>
                  <DownloadIcon />
                </IconButton>
              }
            />
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={formattedData.ageGroups}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" fill={CHART_COLORS[0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Gender Distribution */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader
              title="Gender Distribution"
              avatar={<DonutIcon color="secondary" />}
              action={
                <IconButton size="small" onClick={() => exportChartData(formattedData.genderDistribution, 'gender-distribution')}>
                  <DownloadIcon />
                </IconButton>
              }
            />
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={formattedData.genderDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percentage }) => `${name} ${percentage?.toFixed(1)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {formattedData.genderDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Race Distribution */}
        <Grid item xs={12}>
          <Card>
            <CardHeader
              title="Race/Ethnicity Distribution"
              avatar={<PeopleIcon color="info" />}
              action={
                <IconButton size="small" onClick={() => exportChartData(formattedData.raceDistribution, 'race-distribution')}>
                  <DownloadIcon />
                </IconButton>
              }
            />
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={formattedData.raceDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" fill={CHART_COLORS[2]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  };

  // Clinical Analytics Tab
  const ClinicalAnalyticsTab = () => {
    const diseaseData = formatDiseaseData(diseasePrevalenceData);
    const medicationData = formatMedicationData(medicationPatternsData);

    return (
      <Grid container spacing={3}>
        {/* Disease Prevalence */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader
              title="Top Conditions"
              avatar={<HealthIcon color="error" />}
              action={
                <IconButton size="small" onClick={() => exportChartData(diseaseData, 'disease-prevalence')}>
                  <DownloadIcon />
                </IconButton>
              }
            />
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={diseaseData?.slice(0, 10)} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={120} />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" fill={CHART_COLORS[3]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Medication Patterns */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader
              title="Medication Classes"
              avatar={<PharmacyIcon color="warning" />}
              action={
                <IconButton size="small" onClick={() => exportChartData(medicationData, 'medication-patterns')}>
                  <DownloadIcon />
                </IconButton>
              }
            />
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <PieChart>
                  <Pie
                    data={medicationData?.slice(0, 8)}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percentage }) => `${name} ${percentage?.toFixed(1)}%`}
                    outerRadius={120}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {medicationData?.slice(0, 8).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  };

  const tabLabels = [
    { label: 'Demographics', icon: <PeopleIcon /> },
    { label: 'Clinical Analytics', icon: <AnalyticsIcon /> }
  ];

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <TrendingUpIcon color="primary" />
          Data Charts
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <FormControlLabel
            control={<Switch checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />}
            label="Auto-refresh"
          />
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchAnalyticsData}
            disabled={loading}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Status Information */}
      <Paper sx={{ p: 2, mb: 3, bgcolor: 'background.default' }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <Typography variant="body2" color="text.secondary">
              Real-time analytics from {fhirData?.totalResources || 0} FHIR resources
            </Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
              <Chip
                label={loading ? 'Loading...' : 'Live Data'}
                color={loading ? 'warning' : 'success'}
                size="small"
                icon={loading ? <CircularProgress size={16} /> : <AnalyticsIcon />}
              />
              {autoRefresh && (
                <Chip
                  label="Auto-refresh ON"
                  color="info"
                  size="small"
                  icon={<RefreshIcon />}
                />
              )}
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Tab Navigation */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={currentTab}
          onChange={(_, newValue) => setCurrentTab(newValue)}
          variant="fullWidth"
          indicatorColor="primary"
          textColor="primary"
        >
          {tabLabels.map((tab, index) => (
            <Tab
              key={index}
              label={tab.label}
              icon={tab.icon}
              iconPosition="start"
            />
          ))}
        </Tabs>
      </Paper>

      {/* Tab Content */}
      <Box sx={{ mt: 3 }}>
        {currentTab === 0 && <DemographicsTab />}
        {currentTab === 1 && <ClinicalAnalyticsTab />}
      </Box>
    </Box>
  );
}

export default DataCharts;