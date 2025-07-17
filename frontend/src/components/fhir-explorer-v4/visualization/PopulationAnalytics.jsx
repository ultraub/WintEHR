/**
 * Population Analytics Component for FHIR Explorer v4
 * 
 * Advanced population health metrics and quality measures
 * Leverages backend analytics for clinical insights and outcomes
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Chip,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  Switch,
  FormControlLabel,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemText
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
  Cell,
  LineChart,
  Line,
  ComposedChart,
  Legend
} from 'recharts';
import {
  Analytics as AnalyticsIcon,
  Assessment as AssessmentIcon,
  HealthAndSafety as HealthIcon,
  Warning as WarningIcon,
  People as PeopleIcon,
  LocalPharmacy as PharmacyIcon,
  Healing as HealingIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  StarRate as StarRateIcon,
  ShowChart as ShowChartIcon
} from '@mui/icons-material';

// Chart colors for different metrics
const CHART_COLORS = [
  '#1976d2', '#dc004e', '#9c27b0', '#673ab7', '#3f51b5',
  '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50',
  '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107', '#ff9800'
];

// Quality measure target thresholds
const QUALITY_TARGETS = {
  diabetes_a1c_testing: 85,
  diabetes_a1c_control: 70,
  medication_adherence: 80,
  preventive_care: 75,
  readmission_rate: 15 // Lower is better
};

function PopulationAnalytics({ onNavigate, fhirData }) {
  const [currentTab, setCurrentTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [selectedTimeFrame, setSelectedTimeFrame] = useState('1y');
  
  // Analytics data state
  const [comprehensiveAnalytics, setComprehensiveAnalytics] = useState(null);
  const [qualityMeasures, setQualityMeasures] = useState(null);
  const [utilizationData, setUtilizationData] = useState(null);
  const [refreshInterval, setRefreshInterval] = useState(null);

  // Fetch comprehensive analytics data
  const fetchAnalyticsData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch comprehensive analytics dashboard
      const comprehensiveResponse = await fetch('/api/analytics/comprehensive-dashboard');
      const comprehensiveData = await comprehensiveResponse.json();
      setComprehensiveAnalytics(comprehensiveData);
      
      // Extract quality measures and utilization data
      if (comprehensiveData.quality_measures) {
        setQualityMeasures(comprehensiveData.quality_measures);
      }
      
      if (comprehensiveData.utilization_patterns) {
        setUtilizationData(comprehensiveData.utilization_patterns);
      }
      
    } catch (err) {
      setError(err.message || 'Failed to fetch population analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-refresh setup
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchAnalyticsData, 60000); // Refresh every minute
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

  // Format quality measures for visualization
  const formatQualityMeasures = useCallback((measures) => {
    if (!measures) return [];
    
    return Object.entries(measures).map(([key, value]) => ({
      name: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      value: typeof value === 'number' ? value : (value.percentage || 0),
      target: QUALITY_TARGETS[key] || 80,
      status: getQualityStatus(key, value)
    }));
  }, []);

  // Get quality status color
  const getQualityStatus = (key, value) => {
    const target = QUALITY_TARGETS[key] || 80;
    const actualValue = typeof value === 'number' ? value : (value.percentage || 0);
    
    if (key === 'readmission_rate') {
      // Lower is better for readmission rate
      return actualValue <= target ? 'success' : actualValue <= target * 1.2 ? 'warning' : 'error';
    } else {
      // Higher is better for other measures
      return actualValue >= target ? 'success' : actualValue >= target * 0.8 ? 'warning' : 'error';
    }
  };

  // Format utilization data for charts
  const formatUtilizationData = useCallback((data) => {
    if (!data) return [];
    
    return data.monthly_encounters?.map(item => ({
      month: item.month,
      encounters: item.encounter_count,
      patients: item.unique_patients || 0,
      avgPerPatient: item.unique_patients ? (item.encounter_count / item.unique_patients).toFixed(1) : 0
    })) || [];
  }, []);

  // Format polypharmacy data
  const formatPolypharmacyData = useCallback((data) => {
    if (!data || !data.polypharmacy_analysis) return [];
    
    const analysis = data.polypharmacy_analysis;
    return [
      { name: 'Low Risk (0-4 meds)', value: analysis.low_risk_patients || 0, color: CHART_COLORS[0] },
      { name: 'Moderate Risk (5-9 meds)', value: analysis.moderate_risk_patients || 0, color: CHART_COLORS[1] },
      { name: 'High Risk (10+ meds)', value: analysis.high_risk_patients || 0, color: CHART_COLORS[2] }
    ];
  }, []);

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <Paper sx={{ p: 2, border: '1px solid #ccc' }}>
          <Typography variant="body2" fontWeight="bold">{label}</Typography>
          {payload.map((entry, index) => (
            <Typography key={index} variant="body2" color={entry.color}>
              {`${entry.name}: ${entry.value}${entry.name.includes('Rate') || entry.name.includes('Percentage') ? '%' : ''}`}
            </Typography>
          ))}
        </Paper>
      );
    }
    return null;
  };

  // Quality Measures Tab
  const QualityMeasuresTab = () => {
    const qualityData = formatQualityMeasures(qualityMeasures);
    
    return (
      <Grid container spacing={3}>
        {/* Quality Measures Overview */}
        <Grid item xs={12}>
          <Card>
            <CardHeader
              title="Quality Measures Performance"
              avatar={<StarRateIcon color="warning" />}
              action={
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Chip label={`${qualityData.filter(q => q.status === 'success').length} Meeting Targets`} color="success" size="small" />
                  <Chip label={`${qualityData.filter(q => q.status === 'warning').length} At Risk`} color="warning" size="small" />
                  <Chip label={`${qualityData.filter(q => q.status === 'error').length} Below Target`} color="error" size="small" />
                </Box>
              }
            />
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <ComposedChart data={qualityData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                  <YAxis />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" fill="#1976d2" />
                  <Line type="monotone" dataKey="target" stroke="#dc004e" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Individual Quality Measures */}
        {qualityData.map((measure, index) => (
          <Grid item xs={12} md={6} lg={4} key={index}>
            <Card>
              <CardHeader
                title={measure.name}
                titleTypographyProps={{ variant: 'h6', fontSize: '1rem' }}
                avatar={
                  <Box
                    sx={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      backgroundColor: measure.status === 'success' ? '#4caf50' : 
                                      measure.status === 'warning' ? '#ff9800' : '#f44336'
                    }}
                  />
                }
              />
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h3" sx={{ mr: 1 }}>
                    {measure.value.toFixed(1)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    %
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(measure.value, 100)}
                  sx={{
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: '#e0e0e0',
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: measure.status === 'success' ? '#4caf50' : 
                                      measure.status === 'warning' ? '#ff9800' : '#f44336'
                    }
                  }}
                />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Target: {measure.target}%
                  </Typography>
                  <Typography variant="body2" color={
                    measure.status === 'success' ? 'success.main' : 
                    measure.status === 'warning' ? 'warning.main' : 'error.main'
                  }>
                    {measure.value >= measure.target ? 'Met' : 'Below Target'}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    );
  };

  // Utilization Patterns Tab
  const UtilizationTab = () => {
    const utilizationChartData = formatUtilizationData(utilizationData);
    const polypharmacyData = formatPolypharmacyData(comprehensiveAnalytics);
    
    return (
      <Grid container spacing={3}>
        {/* Monthly Utilization Trends */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardHeader
              title="Healthcare Utilization Trends"
              avatar={<ShowChartIcon color="primary" />}
              action={
                <IconButton size="small">
                  <DownloadIcon />
                </IconButton>
              }
            />
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={utilizationChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar yAxisId="left" dataKey="encounters" fill="#1976d2" name="Total Encounters" />
                  <Line yAxisId="right" type="monotone" dataKey="avgPerPatient" stroke="#dc004e" strokeWidth={2} name="Avg Per Patient" />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Polypharmacy Risk Distribution */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardHeader
              title="Polypharmacy Risk"
              avatar={<PharmacyIcon color="warning" />}
            />
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={polypharmacyData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {polypharmacyData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* High Utilizers */}
        {comprehensiveAnalytics?.utilization_patterns?.high_utilizers && (
          <Grid item xs={12}>
            <Card>
              <CardHeader
                title="High Utilizers"
                avatar={<WarningIcon color="error" />}
                subheader={`${comprehensiveAnalytics.utilization_patterns.high_utilizers.length} patients with 10+ encounters`}
              />
              <CardContent>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Patients requiring care coordination and intervention
                </Typography>
                <List dense>
                  {comprehensiveAnalytics.utilization_patterns.high_utilizers.slice(0, 5).map((patient, index) => (
                    <ListItem key={index} divider>
                      <ListItemText
                        primary={`Patient ${patient.patient_id}`}
                        secondary={`${patient.encounter_count} encounters`}
                      />
                      <Chip
                        label={`${patient.encounter_count} visits`}
                        color={patient.encounter_count > 20 ? 'error' : 'warning'}
                        size="small"
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
    );
  };

  // Population Health Tab
  const PopulationHealthTab = () => {
    const demographics = comprehensiveAnalytics?.population_demographics;
    const diseasePrevalence = comprehensiveAnalytics?.disease_prevalence;
    
    return (
      <Grid container spacing={3}>
        {/* Population Overview */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Population Overview
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h3" color="primary">
                    {demographics?.total_patients || fhirData?.totalResources || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Patients
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h3" color="secondary">
                    {demographics?.avg_age?.toFixed(1) || 'N/A'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Average Age
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h3" color="warning.main">
                    {diseasePrevalence?.total_conditions || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Active Conditions
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h3" color="success.main">
                    {comprehensiveAnalytics?.medication_usage?.total_prescriptions || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Active Prescriptions
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* Disease Prevalence */}
        <Grid item xs={12}>
          <Card>
            <CardHeader
              title="Disease Prevalence"
              avatar={<HealingIcon color="error" />}
            />
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={diseasePrevalence?.top_conditions?.slice(0, 10) || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="condition_name" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Bar dataKey="patient_count" fill="#dc004e" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  };

  const tabLabels = [
    { label: 'Quality Measures', icon: <StarRateIcon /> },
    { label: 'Utilization', icon: <ShowChartIcon /> },
    { label: 'Population Health', icon: <HealthIcon /> }
  ];

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <AssessmentIcon color="primary" />
          Population Analytics
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Time Frame</InputLabel>
            <Select
              value={selectedTimeFrame}
              label="Time Frame"
              onChange={(e) => setSelectedTimeFrame(e.target.value)}
            >
              <MenuItem value="3m">3 Months</MenuItem>
              <MenuItem value="6m">6 Months</MenuItem>
              <MenuItem value="1y">1 Year</MenuItem>
              <MenuItem value="2y">2 Years</MenuItem>
            </Select>
          </FormControl>
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

      {/* Status Bar */}
      <Paper sx={{ p: 2, mb: 3, bgcolor: 'background.default' }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <Typography variant="body2" color="text.secondary">
              Population analytics from {fhirData?.totalResources || 0} FHIR resources
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
        {currentTab === 0 && <QualityMeasuresTab />}
        {currentTab === 1 && <UtilizationTab />}
        {currentTab === 2 && <PopulationHealthTab />}
      </Box>
    </Box>
  );
}

export default PopulationAnalytics;