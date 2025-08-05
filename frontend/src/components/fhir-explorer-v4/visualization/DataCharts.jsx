/**
 * Data Charts Component for FHIR Explorer v4
 * 
 * Interactive charts and graphs for clinical data visualization
 * Leverages existing analytics APIs for real-time healthcare insights
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  IconButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  ToggleButtonGroup,
  ToggleButton,
  useTheme
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
  AreaChart,
  Area,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';
import {
  Analytics as AnalyticsIcon,
  People as PeopleIcon,
  LocalPharmacy as PharmacyIcon,
  MonitorHeart as HealthIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  TrendingUp as TrendingUpIcon,
  DonutLarge as DonutIcon,
  ShowChart as LineIcon,
  BarChart as BarIcon,
  PieChart as PieIcon
} from '@mui/icons-material';
import ChartTypeSelector from './components/ChartTypeSelector';
import VitalSignsChart from './components/VitalSignsChart';
import { exportToPNG, exportToPDF, exportToJSON } from './utils/timelineExport';
import { getChartColors } from '../../../themes/chartColors';

// Safe wrapper component for charts to handle errors
class SafeChartWrapper extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Chart rendering error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: this.props.height || 300 }}>
          <Typography variant="body2" color="text.secondary">Error rendering chart</Typography>
        </Box>
      );
    }

    return this.props.children;
  }
}

function DataCharts({ onNavigate, fhirData }) {
  const theme = useTheme();
  const chartColors = getChartColors(theme);
  
  // Use the palette colors for charts with fallback
  const CHART_COLORS = chartColors?.palette || ['#1976D2', '#388E3C', '#F57C00', '#D32F2F', '#7B1FA2', '#0288D1', '#388E3C', '#FFA726'];
  
  const [currentTab, setCurrentTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [selectedChartType, setSelectedChartType] = useState('bar');
  const [aggregationPeriod, setAggregationPeriod] = useState('month');
  
  // Analytics data state - Initialize with empty structures to avoid null issues
  const [demographicsData, setDemographicsData] = useState({ ageGroups: [], genderDistribution: [], totalPatients: 0 });
  const [diseasePrevalenceData, setDiseasePrevalenceData] = useState([]);
  const [medicationPatternsData, setMedicationPatternsData] = useState([]);
  const [vitalSignsData, setVitalSignsData] = useState({});
  const [refreshInterval, setRefreshInterval] = useState(null);

  // Process FHIR data into analytics
  const processAnalyticsData = useCallback(() => {
    if (!fhirData || !fhirData.resources) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Process demographics from Patient resources
      const patients = Array.isArray(fhirData.resources.Patient) ? fhirData.resources.Patient : [];
      const demographics = processPatientDemographics(patients);
      setDemographicsData(demographics);
      
      // Process disease prevalence from Condition resources
      const conditions = Array.isArray(fhirData.resources.Condition) ? fhirData.resources.Condition : [];
      const diseases = processDiseasePrevalence(conditions);
      setDiseasePrevalenceData(diseases);
      
      // Process medication patterns from MedicationRequest resources
      const medications = Array.isArray(fhirData.resources.MedicationRequest) ? fhirData.resources.MedicationRequest : [];
      const medPatterns = processMedicationPatterns(medications);
      setMedicationPatternsData(medPatterns);
      
      // Process vital signs from Observation resources
      const observations = Array.isArray(fhirData.resources.Observation) ? fhirData.resources.Observation : [];
      const vitals = processVitalSigns(observations);
      setVitalSignsData(vitals);
    } catch (err) {
      console.error('Error processing analytics data:', err);
      setError(err.message || 'Failed to process analytics data');
    } finally {
      setLoading(false);
    }
  }, [fhirData]);

  // Process patient demographics
  const processPatientDemographics = (patients) => {
    if (!Array.isArray(patients) || patients.length === 0) {
      return {
        ageGroups: [],
        genderDistribution: [],
        totalPatients: 0
      };
    }
    
    const ageGroups = { '0-17': 0, '18-34': 0, '35-49': 0, '50-64': 0, '65+': 0 };
    const genderDistribution = { male: 0, female: 0, other: 0 };
    
    patients.forEach(patient => {
      if (!patient) return;
      
      // Age calculation
      if (patient.birthDate) {
        const age = new Date().getFullYear() - new Date(patient.birthDate).getFullYear();
        if (age < 18) ageGroups['0-17']++;
        else if (age < 35) ageGroups['18-34']++;
        else if (age < 50) ageGroups['35-49']++;
        else if (age < 65) ageGroups['50-64']++;
        else ageGroups['65+']++;
      }
      
      // Gender distribution
      const gender = patient.gender?.toLowerCase() || 'other';
      genderDistribution[gender] = (genderDistribution[gender] || 0) + 1;
    });
    
    return {
      ageGroups: Object.entries(ageGroups).map(([name, value]) => ({ name, value: value || 0 })),
      genderDistribution: Object.entries(genderDistribution).map(([name, value]) => ({ name, value: value || 0 })),
      totalPatients: patients.length
    };
  };

  // Process disease prevalence
  const processDiseasePrevalence = (conditions) => {
    if (!Array.isArray(conditions) || conditions.length === 0) {
      return [];
    }
    
    const diseaseCount = {};
    
    conditions.forEach(condition => {
      if (!condition) return;
      const code = condition.code?.text || condition.code?.coding?.[0]?.display || 'Unknown';
      diseaseCount[code] = (diseaseCount[code] || 0) + 1;
    });
    
    return Object.entries(diseaseCount)
      .map(([name, value]) => ({ name, value: value || 0 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10); // Top 10
  };

  // Process medication patterns
  const processMedicationPatterns = (medications) => {
    if (!Array.isArray(medications) || medications.length === 0) {
      return [];
    }
    
    const medCount = {};
    
    medications.forEach(med => {
      if (!med) return;
      const name = med.medicationCodeableConcept?.text || 
                   med.medicationCodeableConcept?.coding?.[0]?.display || 'Unknown';
      medCount[name] = (medCount[name] || 0) + 1;
    });
    
    return Object.entries(medCount)
      .map(([name, value]) => ({ name, value: value || 0 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10); // Top 10
  };

  // Process vital signs
  const processVitalSigns = (observations) => {
    const vitals = {};
    
    observations.forEach(obs => {
      const code = obs.code?.coding?.[0]?.code;
      const value = obs.valueQuantity?.value;
      const date = new Date(obs.effectiveDateTime || obs.meta?.lastUpdated);
      
      if (code && value && date) {
        if (!vitals[code]) vitals[code] = [];
        vitals[code].push({ date: date.toISOString(), value });
      }
    });
    
    return vitals;
  };

  // Auto-refresh setup
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(processAnalyticsData, 30000); // Refresh every 30 seconds
      setRefreshInterval(interval);
      return () => clearInterval(interval);
    } else if (refreshInterval) {
      clearInterval(refreshInterval);
      setRefreshInterval(null);
    }
  }, [autoRefresh, processAnalyticsData]);

  // Initial data load
  useEffect(() => {
    processAnalyticsData();
  }, [processAnalyticsData]);

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


  // Custom tooltip for charts
  const CustomTooltip = ({ active, payload, label }) => {
    try {
      if (active && payload && Array.isArray(payload) && payload.length > 0) {
        return (
          <Paper sx={{ p: 2, border: '1px solid #ccc' }}>
            <Typography variant="body2" fontWeight="bold">{label || ''}</Typography>
            {payload.filter(entry => entry != null).map((entry, index) => {
              const percentage = entry?.payload?.percentage;
              const percentageText = percentage !== undefined && percentage !== null ? ` (${percentage.toFixed(1)}%)` : '';
              return (
                <Typography key={`tooltip-${index}`} variant="body2" color={entry?.color || 'inherit'}>
                  {`${entry?.name || 'Unknown'}: ${entry?.value || 0}${percentageText}`}
                </Typography>
              );
            })}
          </Paper>
        );
      }
    } catch (error) {
      console.error('Error in CustomTooltip:', error);
    }
    return null;
  };

  // Demographics Charts Tab
  const DemographicsTab = () => {
    const totalPatients = Math.max(demographicsData?.totalPatients || 0, 1);
    
    const ageGroupsWithPercentages = useMemo(() => {
      if (!demographicsData?.ageGroups) return [];
      return demographicsData.ageGroups
        .filter(item => item && typeof item.value === 'number' && item.value >= 0)
        .map(item => ({
          ...item,
          name: item.name || 'Unknown',
          value: item.value || 0,
          percentage: (item.value / totalPatients * 100)
        }));
    }, [demographicsData?.ageGroups, totalPatients]);
    
    const genderWithPercentages = useMemo(() => {
      if (!demographicsData?.genderDistribution) return [];
      return demographicsData.genderDistribution
        .filter(item => item && typeof item.value === 'number' && item.value >= 0)
        .map(item => ({
          ...item,
          name: item.name || 'Unknown',
          value: item.value || 0,
          percentage: (item.value / totalPatients * 100)
        }));
    }, [demographicsData?.genderDistribution, totalPatients]);
    
    if (!demographicsData || !demographicsData.ageGroups || !demographicsData.genderDistribution) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      );
    }

    return (
      <Grid container spacing={3}>
        {/* Age Distribution */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader
              title="Age Distribution"
              avatar={<PeopleIcon color="primary" />}
              action={
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <ChartTypeSelector
                    value={selectedChartType}
                    onChange={setSelectedChartType}
                    availableTypes={['bar', 'line', 'area', 'pie']}
                  />
                  <IconButton size="small" onClick={() => exportChartData(ageGroupsWithPercentages, 'age-distribution')}>
                    <DownloadIcon />
                  </IconButton>
                </Box>
              }
            />
            <CardContent>
              {Array.isArray(ageGroupsWithPercentages) && ageGroupsWithPercentages.length > 0 ? (
                <SafeChartWrapper height={300}>
                  {selectedChartType === 'bar' && (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={ageGroupsWithPercentages}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <RechartsTooltip />
                        <Bar dataKey="value" fill={CHART_COLORS[0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                  {selectedChartType === 'line' && (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={ageGroupsWithPercentages}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <RechartsTooltip />
                        <Line type="monotone" dataKey="value" stroke={CHART_COLORS[0]} strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                  {selectedChartType === 'area' && (
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={ageGroupsWithPercentages}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <RechartsTooltip />
                        <Area type="monotone" dataKey="value" fill={CHART_COLORS[0]} stroke={CHART_COLORS[0]} />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                  {selectedChartType === 'pie' && (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={ageGroupsWithPercentages}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {ageGroupsWithPercentages.map((entry, index) => (
                            <Cell key={`cell-age-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </SafeChartWrapper>
              ) : (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
                  <Typography variant="body2" color="text.secondary">No data available</Typography>
                </Box>
              )}
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
                <IconButton size="small" onClick={() => exportChartData(genderWithPercentages, 'gender-distribution')}>
                  <DownloadIcon />
                </IconButton>
              }
            />
            <CardContent>
              {Array.isArray(genderWithPercentages) && genderWithPercentages.length > 0 ? (
                <SafeChartWrapper height={300}>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={genderWithPercentages}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {genderWithPercentages.map((entry, index) => (
                          <Cell key={`cell-gender-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </SafeChartWrapper>
              ) : (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
                  <Typography variant="body2" color="text.secondary">No data available</Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  };

  // Clinical Analytics Tab
  const ClinicalAnalyticsTab = () => {
    // Calculate total for percentage calculations
    const totalDiseases = diseasePrevalenceData?.reduce((sum, item) => sum + (item?.value || 0), 0) || 1;
    const totalMedications = medicationPatternsData?.reduce((sum, item) => sum + (item?.value || 0), 0) || 1;
    
    // Add percentage to disease data
    const diseaseData = (diseasePrevalenceData || []).map(item => ({
      ...item,
      percentage: (item.value / totalDiseases * 100)
    }));
    
    // Add percentage to medication data
    const medicationData = (medicationPatternsData || []).map(item => ({
      ...item,
      percentage: (item.value / totalMedications * 100)
    }));
    
    if (!diseasePrevalenceData && !medicationPatternsData) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      );
    }

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
              {Array.isArray(diseaseData) && diseaseData.length > 0 ? (
                <SafeChartWrapper height={400}>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={diseaseData} layout="horizontal">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={120} />
                      <RechartsTooltip />
                      <Bar dataKey="value" fill={CHART_COLORS[3]} />
                    </BarChart>
                  </ResponsiveContainer>
                </SafeChartWrapper>
              ) : (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
                  <Typography variant="body2" color="text.secondary">No condition data available</Typography>
                </Box>
              )}
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
              {Array.isArray(medicationData) && medicationData.length > 0 ? (
                <SafeChartWrapper height={400}>
                  <ResponsiveContainer width="100%" height={400}>
                    <PieChart>
                      <Pie
                        data={medicationData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={120}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {medicationData.map((entry, index) => (
                          <Cell key={`cell-med-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </SafeChartWrapper>
              ) : (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
                  <Typography variant="body2" color="text.secondary">No medication data available</Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  };

  // Vital Signs Tab
  const VitalSignsTab = () => {
    const observations = fhirData?.resources?.Observation || [];
    const patients = fhirData?.resources?.Patient || [];
    
    // Group observations by patient
    const patientObservations = {};
    observations.forEach(obs => {
      const patientRef = obs.subject?.reference;
      if (patientRef) {
        const patientId = patientRef.split('/').pop();
        if (!patientObservations[patientId]) {
          patientObservations[patientId] = [];
        }
        patientObservations[patientId].push(obs);
      }
    });
    
    // Get first patient with observations for demo
    const patientIds = Object.keys(patientObservations);
    const selectedPatientId = patientIds[0];
    
    return (
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <VitalSignsChart
            observations={patientObservations[selectedPatientId] || []}
            patientId={selectedPatientId}
            timeRange="30d"
          />
        </Grid>
        
        <Grid item xs={12}>
          <Card>
            <CardHeader
              title="Vital Signs Summary"
              avatar={<HealthIcon color="primary" />}
            />
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Showing vital signs for {patientIds.length} patients with observations
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  };

  // Trends Tab
  const TrendsTab = () => {
    // Process time-series data for trends
    const trendsData = useMemo(() => {
      if (!fhirData?.resources) return [];
      
      // Group resources by month
      const monthlyData = {};
      
      Object.entries(fhirData.resources).forEach(([resourceType, resources]) => {
        resources.forEach(resource => {
          const date = new Date(resource.meta?.lastUpdated || resource.date);
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          
          if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = {
              month: monthKey,
              Patient: 0,
              Encounter: 0,
              Observation: 0,
              Condition: 0,
              MedicationRequest: 0
            };
          }
          
          if (monthlyData[monthKey][resourceType] !== undefined) {
            monthlyData[monthKey][resourceType]++;
          }
        });
      });
      
      return Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month));
    }, [fhirData]);
    
    return (
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Card>
            <CardHeader
              title="Resource Creation Trends"
              avatar={<TrendingUpIcon color="primary" />}
              action={
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Period</InputLabel>
                  <Select value={aggregationPeriod} onChange={(e) => setAggregationPeriod(e.target.value)} label="Period">
                    <MenuItem value="day">Daily</MenuItem>
                    <MenuItem value="week">Weekly</MenuItem>
                    <MenuItem value="month">Monthly</MenuItem>
                    <MenuItem value="year">Yearly</MenuItem>
                  </Select>
                </FormControl>
              }
            />
            <CardContent>
              {Array.isArray(trendsData) && trendsData.length > 0 ? (
                <SafeChartWrapper height={400}>
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={trendsData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <RechartsTooltip />
                      <Legend />
                      <Line type="monotone" dataKey="Patient" stroke={chartColors?.timeline?.patient || CHART_COLORS[0]} strokeWidth={2} />
                      <Line type="monotone" dataKey="Encounter" stroke={chartColors?.timeline?.encounter || CHART_COLORS[1]} strokeWidth={2} />
                      <Line type="monotone" dataKey="Observation" stroke={chartColors?.timeline?.observation || CHART_COLORS[2]} strokeWidth={2} />
                      <Line type="monotone" dataKey="Condition" stroke={chartColors?.timeline?.condition || CHART_COLORS[3]} strokeWidth={2} />
                      <Line type="monotone" dataKey="MedicationRequest" stroke={chartColors?.timeline?.medication || CHART_COLORS[4]} strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </SafeChartWrapper>
              ) : (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
                  <Typography variant="body2" color="text.secondary">No trends data available</Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  };

  const tabLabels = useMemo(() => [
    { label: 'Demographics', icon: PeopleIcon },
    { label: 'Clinical Analytics', icon: AnalyticsIcon },
    { label: 'Vital Signs', icon: HealthIcon },
    { label: 'Trends', icon: TrendingUpIcon }
  ], []);

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
            onClick={processAnalyticsData}
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
              {loading ? (
                <Chip
                  label="Loading..."
                  color="warning"
                  size="small"
                />
              ) : (
                <Chip
                  label="Live Data"
                  color="success"
                  size="small"
                  icon={<AnalyticsIcon />}
                />
              )}
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
          {tabLabels.map((tab, index) => {
            if (!tab || !tab.label) return null;
            const TabIcon = tab.icon;
            return (
              <Tab
                key={`tab-${index}`}
                label={tab.label}
                icon={TabIcon ? <TabIcon /> : null}
                iconPosition="start"
              />
            );
          }).filter(Boolean)}
        </Tabs>
      </Paper>

      {/* Tab Content */}
      <Box sx={{ mt: 3 }}>
        {currentTab === 0 && <DemographicsTab />}
        {currentTab === 1 && <ClinicalAnalyticsTab />}
        {currentTab === 2 && <VitalSignsTab />}
        {currentTab === 3 && <TrendsTab />}
      </Box>
    </Box>
  );
}

export default DataCharts;