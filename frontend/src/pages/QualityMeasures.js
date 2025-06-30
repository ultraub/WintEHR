import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tabs,
  Tab,
  Badge,
  Tooltip
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  PlayArrow as PlayIcon,
  Assessment as AssessmentIcon,
  TrendingUp as TrendingUpIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  ExpandMore as ExpandMoreIcon,
  Analytics as AnalyticsIcon,
  Description as DescriptionIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import api from '../services/api';

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`quality-tabpanel-${index}`}
      aria-labelledby={`quality-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  );
}

const QualityMeasures = () => {
  const [tabValue, setTabValue] = useState(0);
  const [measures, setMeasures] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedMeasure, setSelectedMeasure] = useState(null);
  const [reportDialog, setReportDialog] = useState(false);
  const [measureDialog, setMeasureDialog] = useState(false);

  // Helper function for safe date formatting
  const formatDate = (dateValue, formatString = 'MMM dd, yyyy', defaultValue = 'N/A') => {
    if (!dateValue) return defaultValue;
    try {
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) return defaultValue;
      return format(date, formatString);
    } catch (error) {
      console.error('Date formatting error:', error);
      return defaultValue;
    }
  };

  // Quality measure configuration state
  const [measureConfig, setMeasureConfig] = useState({
    id: '',
    name: '',
    description: '',
    category: 'clinical',
    type: 'proportion',
    numerator: '',
    denominator: '',
    exclusions: '',
    reportingPeriod: 'quarterly',
    enabled: true
  });

  // Sample quality measures
  const sampleMeasures = [
    {
      id: 'diabetes-hba1c',
      name: 'Diabetes HbA1c Control',
      description: 'Percentage of patients 18-75 years of age with diabetes who had HbA1c < 8.0%',
      category: 'clinical',
      type: 'proportion',
      numerator: 'Patients with diabetes and HbA1c < 8.0%',
      denominator: 'Patients with diabetes aged 18-75',
      exclusions: 'Patients with advanced illness',
      reportingPeriod: 'annual',
      enabled: true,
      lastRun: '2024-01-15',
      score: 78.5,
      target: 80.0,
      trend: 'improving'
    },
    {
      id: 'hypertension-control',
      name: 'Hypertension Blood Pressure Control',
      description: 'Percentage of patients 18-85 years of age with hypertension whose BP was adequately controlled',
      category: 'clinical',
      type: 'proportion',
      numerator: 'Patients with controlled BP (<140/90)',
      denominator: 'Patients with hypertension aged 18-85',
      exclusions: 'Patients with end-stage renal disease',
      reportingPeriod: 'quarterly',
      enabled: true,
      lastRun: '2024-01-10',
      score: 82.3,
      target: 85.0,
      trend: 'stable'
    },
    {
      id: 'breast-cancer-screening',
      name: 'Breast Cancer Screening',
      description: 'Percentage of women 50-74 years of age who had a mammogram to screen for breast cancer',
      category: 'preventive',
      type: 'proportion',
      numerator: 'Women with mammogram in past 2 years',
      denominator: 'Women aged 50-74',
      exclusions: 'Women with bilateral mastectomy',
      reportingPeriod: 'annual',
      enabled: true,
      lastRun: '2024-01-08',
      score: 71.2,
      target: 75.0,
      trend: 'declining'
    },
    {
      id: 'medication-reconciliation',
      name: 'Medication Reconciliation',
      description: 'Percentage of discharges with medication reconciliation completed',
      category: 'safety',
      type: 'proportion',
      numerator: 'Discharges with completed med rec',
      denominator: 'All hospital discharges',
      exclusions: 'Patients who died in hospital',
      reportingPeriod: 'monthly',
      enabled: true,
      lastRun: '2024-01-12',
      score: 89.7,
      target: 90.0,
      trend: 'improving'
    },
    {
      id: 'readmission-rate',
      name: '30-Day Readmission Rate',
      description: 'Percentage of patients readmitted within 30 days of discharge',
      category: 'outcome',
      type: 'ratio',
      numerator: 'Readmissions within 30 days',
      denominator: 'All discharges',
      exclusions: 'Planned readmissions',
      reportingPeriod: 'monthly',
      enabled: true,
      lastRun: '2024-01-14',
      score: 12.1,
      target: 10.0,
      trend: 'stable'
    }
  ];

  // Sample reports
  const sampleReports = [
    {
      id: 'q4-2023-report',
      name: 'Q4 2023 Quality Report',
      period: 'Q4 2023',
      generated: '2024-01-15',
      measures: 5,
      status: 'completed',
      score: 78.2,
      trends: 'mixed'
    },
    {
      id: 'q3-2023-report',
      name: 'Q3 2023 Quality Report',
      period: 'Q3 2023',
      generated: '2023-10-15',
      measures: 5,
      status: 'completed',
      score: 76.8,
      trends: 'improving'
    },
    {
      id: 'annual-2023-report',
      name: 'Annual 2023 Quality Report',
      period: 'Annual 2023',
      generated: '2024-01-20',
      measures: 8,
      status: 'completed',
      score: 77.5,
      trends: 'stable'
    }
  ];

  useEffect(() => {
    loadQualityMeasures();
    loadQualityReports();
  }, []);

  const loadQualityMeasures = async () => {
    try {
      const response = await api.get('/api/quality/measures');
      setMeasures(response.data);
    } catch (error) {
      console.error('Error loading quality measures:', error);
      // Fallback to sample data if API fails
      setMeasures(sampleMeasures);
    }
  };

  const loadQualityReports = async () => {
    try {
      // For now, use sample reports as backend doesn't have report storage yet
      setReports(sampleReports);
    } catch (error) {
      console.error('Error loading quality reports:', error);
      setReports(sampleReports);
    }
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleRunMeasure = async (measureId) => {
    setLoading(true);
    try {
      const response = await api.post(`/api/quality/measures/${measureId}/calculate`);
      const result = response.data;
      
      // Update measure with new results
      setMeasures(prev => prev.map(measure => 
        measure.id === measureId 
          ? { 
              ...measure, 
              lastRun: new Date().toISOString().split('T')[0], 
              score: result.percentage || result.rate || 0,
              numeratorCount: result.numerator || 0,
              denominatorCount: result.denominator || 0
            }
          : measure
      ));
    } catch (error) {
      console.error('Error running measure:', error);
      // Show error message to user
      alert('Error running quality measure. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    setLoading(true);
    try {
      const reportData = {
        title: `Quality Report - ${format(new Date(), 'MMM yyyy')}`,
        period: format(new Date(), 'MMM yyyy'),
        measures: measures.map(m => m.id)
      };
      
      const response = await api.post('/api/quality/reports/generate', reportData);
      const result = response.data;
      
      const newReport = {
        id: result.id || `report-${Date.now()}`,
        name: result.title || reportData.title,
        period: result.period || reportData.period,
        generated: new Date().toISOString().split('T')[0],
        measures: result.measures?.length || measures.length,
        status: 'completed',
        score: result.overall_score || 0,
        trends: result.trends || 'stable'
      };
      
      setReports(prev => [newReport, ...prev]);
      setReportDialog(false);
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Error generating quality report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getMeasureStatusColor = (score, target) => {
    const safeScore = score || 0;
    const safeTarget = target || 0;
    if (safeTarget === 0) return 'default';
    if (safeScore >= safeTarget) return 'success';
    if (safeScore >= safeTarget * 0.8) return 'warning';
    return 'error';
  };

  const getTrendIcon = (trend) => {
    switch (trend) {
      case 'improving':
        return <TrendingUpIcon color="success" />;
      case 'declining':
        return <TrendingUpIcon color="error" sx={{ transform: 'rotate(180deg)' }} />;
      default:
        return <TrendingUpIcon color="action" sx={{ transform: 'rotate(90deg)' }} />;
    }
  };

  const getMeasuresByCategory = (category) => {
    return measures.filter(measure => measure.category === category);
  };

  const getOverallScore = () => {
    if (measures.length === 0) return 0;
    const validMeasures = measures.filter(m => m.score !== undefined && m.score !== null);
    if (validMeasures.length === 0) return 0;
    return validMeasures.reduce((sum, measure) => sum + (measure.score || 0), 0) / validMeasures.length;
  };

  const getCategoryStats = () => {
    const categories = ['clinical', 'preventive', 'safety', 'outcome'];
    return categories.map(category => {
      const categoryMeasures = getMeasuresByCategory(category);
      const validMeasures = categoryMeasures.filter(m => m.score !== undefined && m.score !== null);
      const avgScore = validMeasures.length > 0 
        ? validMeasures.reduce((sum, m) => sum + (m.score || 0), 0) / validMeasures.length 
        : 0;
      return {
        category,
        count: categoryMeasures.length,
        avgScore,
        label: category.charAt(0).toUpperCase() + category.slice(1)
      };
    });
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Quality Measures & Reporting
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Monitor and report on quality metrics to improve patient care
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => window.location.reload()}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<AssessmentIcon />}
            onClick={() => setReportDialog(true)}
          >
            Generate Report
          </Button>
        </Box>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <AssessmentIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                {measures.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Active Measures
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <AnalyticsIcon color="success" sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                {getOverallScore().toFixed(1)}%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Overall Score
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <DescriptionIcon color="info" sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                {reports.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Generated Reports
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <TrendingUpIcon color="warning" sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                {measures.filter(m => m.trend === 'improving').length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Improving Trends
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Paper sx={{ width: '100%' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange} aria-label="quality measures tabs">
            <Tab label="Quality Measures" />
            <Tab label="Performance Dashboard" />
            <Tab label="Reports" />
            <Tab label="Configuration" />
          </Tabs>
        </Box>

        {/* Quality Measures Tab */}
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6">Active Quality Measures</Typography>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => setMeasureDialog(true)}
            >
              Add Measure
            </Button>
          </Box>

          <Grid container spacing={3}>
            {measures.map((measure) => (
              <Grid item xs={12} md={6} lg={4} key={measure.id}>
                <Card variant="outlined">
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Box>
                        <Typography variant="h6" gutterBottom>
                          {measure.name}
                        </Typography>
                        <Chip 
                          label={measure.category} 
                          size="small" 
                          variant="outlined"
                          sx={{ mr: 1 }}
                        />
                        <Chip 
                          label={measure.type} 
                          size="small" 
                          color="primary"
                          variant="outlined"
                        />
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {getTrendIcon(measure.trend)}
                        <Chip
                          label={`${(measure.score || 0).toFixed(1)}%`}
                          color={getMeasureStatusColor(measure.score || 0, measure.target || 0)}
                          sx={{ fontWeight: 'bold' }}
                        />
                      </Box>
                    </Box>

                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {measure.description}
                    </Typography>

                    <Box sx={{ mb: 2 }}>
                      <Typography variant="caption" color="text.secondary">
                        Progress to Target ({measure.target}%)
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={((measure.score || 0) / (measure.target || 1)) * 100}
                        color={getMeasureStatusColor(measure.score || 0, measure.target || 0)}
                        sx={{ mt: 0.5 }}
                      />
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="caption" color="text.secondary">
                        Last run: {formatDate(measure.lastRun, 'MMM dd, yyyy', 'Never')}
                      </Typography>
                      <Box>
                        <Tooltip title="Run Measure">
                          <IconButton 
                            size="small" 
                            onClick={() => handleRunMeasure(measure.id)}
                            disabled={loading}
                          >
                            <PlayIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit Measure">
                          <IconButton size="small" onClick={() => setSelectedMeasure(measure)}>
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </TabPanel>

        {/* Performance Dashboard Tab */}
        <TabPanel value={tabValue} index={1}>
          <Typography variant="h6" gutterBottom>Performance by Category</Typography>
          
          <Grid container spacing={3} sx={{ mb: 3 }}>
            {getCategoryStats().map((category) => (
              <Grid item xs={12} sm={6} md={3} key={category.category}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography variant="h6" color="primary">
                      {category.label}
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 'bold', my: 1 }}>
                      {(category.avgScore || 0).toFixed(1)}%
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {category.count} measures
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>Detailed Performance</Typography>
          
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Measure</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell align="center">Score</TableCell>
                  <TableCell align="center">Target</TableCell>
                  <TableCell align="center">Gap</TableCell>
                  <TableCell align="center">Trend</TableCell>
                  <TableCell align="center">Last Updated</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {measures.map((measure) => (
                  <TableRow key={measure.id}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {measure.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={measure.category} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={`${(measure.score || 0).toFixed(1)}%`}
                        color={getMeasureStatusColor(measure.score || 0, measure.target || 0)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">{measure.target}%</TableCell>
                    <TableCell align="center">
                      <Typography 
                        variant="body2" 
                        color={(measure.score || 0) >= (measure.target || 0) ? 'success.main' : 'error.main'}
                      >
                        {((measure.score || 0) - (measure.target || 0)).toFixed(1)}%
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      {getTrendIcon(measure.trend)}
                    </TableCell>
                    <TableCell align="center">
                      {formatDate(measure.lastRun, 'MM/dd/yyyy', 'Never')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        {/* Reports Tab */}
        <TabPanel value={tabValue} index={2}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6">Quality Reports</Typography>
            <Button
              variant="contained"
              startIcon={<AssessmentIcon />}
              onClick={() => setReportDialog(true)}
            >
              Generate New Report
            </Button>
          </Box>

          <Grid container spacing={3}>
            {reports.map((report) => (
              <Grid item xs={12} md={6} lg={4} key={report.id}>
                <Card variant="outlined">
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Typography variant="h6" gutterBottom>
                        {report.name}
                      </Typography>
                      <Chip
                        label={report.status}
                        color={report.status === 'completed' ? 'success' : 'default'}
                        size="small"
                      />
                    </Box>

                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Period: {report.period}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Generated: {formatDate(report.generated, 'MMM dd, yyyy', 'Not generated')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Measures: {report.measures}
                    </Typography>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="body2">
                        Overall Score: <strong>{(report.score || 0).toFixed(1)}%</strong>
                      </Typography>
                      <Chip 
                        label={report.trends} 
                        size="small" 
                        color={report.trends === 'improving' ? 'success' : 'default'}
                        variant="outlined"
                      />
                    </Box>

                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        size="small"
                        startIcon={<DownloadIcon />}
                        onClick={() => console.log('Download report:', report.id)}
                      >
                        Download
                      </Button>
                      <Button
                        size="small"
                        startIcon={<EditIcon />}
                        onClick={() => console.log('View report:', report.id)}
                      >
                        View Details
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </TabPanel>

        {/* Configuration Tab */}
        <TabPanel value={tabValue} index={3}>
          <Typography variant="h6" gutterBottom>Quality Measure Configuration</Typography>
          
          <Alert severity="info" sx={{ mb: 3 }}>
            Configure automated quality measure calculations and reporting schedules. 
            Changes will affect future measure calculations.
          </Alert>

          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>Calculation Settings</Typography>
                  
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>Default Reporting Period</InputLabel>
                    <Select value="quarterly" label="Default Reporting Period">
                      <MenuItem value="monthly">Monthly</MenuItem>
                      <MenuItem value="quarterly">Quarterly</MenuItem>
                      <MenuItem value="annual">Annual</MenuItem>
                    </Select>
                  </FormControl>

                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>Data Source</InputLabel>
                    <Select value="fhir" label="Data Source">
                      <MenuItem value="fhir">FHIR Resources</MenuItem>
                      <MenuItem value="database">Direct Database</MenuItem>
                      <MenuItem value="hybrid">Hybrid</MenuItem>
                    </Select>
                  </FormControl>

                  <TextField
                    fullWidth
                    label="Calculation Window (days)"
                    type="number"
                    defaultValue={30}
                    sx={{ mb: 2 }}
                  />
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>Notification Settings</Typography>
                  
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>Alert Threshold</InputLabel>
                    <Select value="10" label="Alert Threshold">
                      <MenuItem value="5">5% below target</MenuItem>
                      <MenuItem value="10">10% below target</MenuItem>
                      <MenuItem value="15">15% below target</MenuItem>
                    </Select>
                  </FormControl>

                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>Report Schedule</InputLabel>
                    <Select value="monthly" label="Report Schedule">
                      <MenuItem value="weekly">Weekly</MenuItem>
                      <MenuItem value="monthly">Monthly</MenuItem>
                      <MenuItem value="quarterly">Quarterly</MenuItem>
                    </Select>
                  </FormControl>

                  <TextField
                    fullWidth
                    label="Email Recipients"
                    placeholder="admin@hospital.com, quality@hospital.com"
                    sx={{ mb: 2 }}
                  />
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>
      </Paper>

      {/* Generate Report Dialog */}
      <Dialog open={reportDialog} onClose={() => setReportDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Generate Quality Report</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label="Report Name"
              defaultValue={`Quality Report - ${format(new Date(), 'MMM yyyy')}`}
              sx={{ mb: 2 }}
            />
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Reporting Period</InputLabel>
              <Select value="current-month" label="Reporting Period">
                <MenuItem value="current-month">Current Month</MenuItem>
                <MenuItem value="last-month">Last Month</MenuItem>
                <MenuItem value="current-quarter">Current Quarter</MenuItem>
                <MenuItem value="last-quarter">Last Quarter</MenuItem>
                <MenuItem value="ytd">Year to Date</MenuItem>
              </Select>
            </FormControl>
            <Typography variant="body2" color="text.secondary">
              This will generate a comprehensive quality report including all active measures
              and performance analytics for the selected period.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReportDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleGenerateReport} 
            variant="contained"
            disabled={loading}
          >
            {loading ? 'Generating...' : 'Generate Report'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default QualityMeasures;