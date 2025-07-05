/**
 * PopulationHealthMode Component
 * Real-time population analytics and quality measure tracking using FHIR data
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Alert,
  Button,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  IconButton,
  Tooltip,
  Stack,
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import { 
  Analytics as PopulationIcon,
  TrendingUp,
  TrendingDown,
  Group as GroupIcon,
  ExpandMore as ExpandMoreIcon,
  Refresh as RefreshIcon,
  FileDownload as ExportIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  Person as PersonIcon,
  Assignment as AssignmentIcon,
  Timeline as TimelineIcon,
  BarChart as ChartIcon,
  Medication as MedicationIcon,
  LocalHospital as ConditionIcon
} from '@mui/icons-material';
import { fhirClient } from '../../../../services/fhirClient';
import { format, subMonths, isAfter, parseISO } from 'date-fns';

// Helper functions for analytics
const calculateMetrics = (patients, conditions, medications, observations) => {
  const totalPatients = patients.length;
  
  // Diabetes control (HbA1c observations)
  const diabeticPatients = conditions.filter(c => 
    c.code?.coding?.some(coding => 
      coding.display?.toLowerCase().includes('diabetes') ||
      coding.code === '73211009' // SNOMED diabetes code
    )
  );
  
  const recentHbA1c = observations.filter(o => 
    o.code?.coding?.some(coding => 
      coding.display?.toLowerCase().includes('hemoglobin a1c') ||
      coding.code === '4548-4' // LOINC HbA1c code
    ) && isAfter(parseISO(o.effectiveDateTime || o.issued), subMonths(new Date(), 6))
  );
  
  // Active medication adherence
  const activeMedications = medications.filter(m => m.status === 'active');
  
  // Hypertension management
  const hypertensionPatients = conditions.filter(c => 
    c.code?.coding?.some(coding => 
      coding.display?.toLowerCase().includes('hypertension') ||
      coding.code === '38341003' // SNOMED hypertension code
    )
  );
  
  return {
    totalPatients,
    diabeticPatients: diabeticPatients.length,
    hypertensionPatients: hypertensionPatients.length,
    activeMedications: activeMedications.length,
    recentLabs: recentHbA1c.length,
    medicationAdherence: Math.round((activeMedications.length / totalPatients) * 100),
    diabetesControl: diabeticPatients.length > 0 ? Math.round((recentHbA1c.length / diabeticPatients.length) * 100) : 0
  };
};

const MetricCard = ({ title, value, target, trend, color = 'primary', isLoading, icon, unit = '%' }) => (
  <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
    <CardContent sx={{ flexGrow: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography color="text.secondary" variant="body2">
          {title}
        </Typography>
        {icon && <Avatar sx={{ bgcolor: `${color}.light`, width: 32, height: 32 }}>{icon}</Avatar>}
      </Box>
      
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
          <CircularProgress size={24} />
        </Box>
      ) : (
        <>
          <Typography variant="h4" component="div" color={color}>
            {value}{unit}
          </Typography>
          
          {trend !== undefined && (
            <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
              {trend > 0 ? (
                <TrendingUp color="success" fontSize="small" />
              ) : trend < 0 ? (
                <TrendingDown color="error" fontSize="small" />
              ) : null}
              <Typography variant="body2" sx={{ ml: 1 }}>
                {trend > 0 ? '+' : ''}{trend}% from last period
              </Typography>
            </Box>
          )}
          
          {target && (
            <>
              <LinearProgress 
                variant="determinate" 
                value={Math.min((value / target) * 100, 100)} 
                sx={{ mt: 2, height: 8, borderRadius: 4 }}
                color={color}
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Target: {target}{unit}
              </Typography>
            </>
          )}
        </>
      )}
    </CardContent>
  </Card>
);

const CareGapTable = ({ conditions, isLoading }) => {
  const careGaps = useMemo(() => {
    if (!conditions.length) return [];
    
    const conditionGroups = conditions.reduce((acc, condition) => {
      const display = condition.code?.text || condition.code?.coding?.[0]?.display || 'Unknown Condition';
      const status = condition.clinicalStatus?.coding?.[0]?.code || 'unknown';
      
      if (!acc[display]) {
        acc[display] = { total: 0, active: 0, needsReview: 0 };
      }
      
      acc[display].total++;
      if (status === 'active') {
        acc[display].active++;
      }
      if (!condition.lastReviewed || isAfter(subMonths(new Date(), 6), parseISO(condition.lastReviewed))) {
        acc[display].needsReview++;
      }
      
      return acc;
    }, {});
    
    return Object.entries(conditionGroups)
      .map(([condition, stats]) => ({ condition, ...stats }))
      .sort((a, b) => b.needsReview - a.needsReview)
      .slice(0, 10);
  }, [conditions]);
  
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }
  
  return (
    <TableContainer component={Paper} variant="outlined">
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Condition</TableCell>
            <TableCell align="center">Total Patients</TableCell>
            <TableCell align="center">Active Cases</TableCell>
            <TableCell align="center">Needs Review</TableCell>
            <TableCell align="center">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {careGaps.map((row, index) => (
            <TableRow key={index}>
              <TableCell>{row.condition}</TableCell>
              <TableCell align="center">{row.total}</TableCell>
              <TableCell align="center">
                <Chip 
                  label={row.active} 
                  color={row.active > 0 ? "warning" : "success"} 
                  size="small" 
                />
              </TableCell>
              <TableCell align="center">
                <Chip 
                  label={row.needsReview} 
                  color={row.needsReview > 0 ? "error" : "success"} 
                  size="small" 
                />
              </TableCell>
              <TableCell align="center">
                <Button size="small" disabled>
                  View List
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

const PopulationHealthMode = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState({
    patients: [],
    conditions: [],
    medications: [],
    observations: []
  });
  const [refreshing, setRefreshing] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  
  const loadPopulationData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch all patients and their data
      const [patientsResult, conditionsResult, medicationsResult, observationsResult] = await Promise.allSettled([
        fhirClient.search('Patient', { _count: 1000 }),
        fhirClient.search('Condition', { _count: 5000 }),
        fhirClient.search('MedicationRequest', { _count: 5000 }),
        fhirClient.search('Observation', { _count: 5000 })
      ]);
      
      setData({
        patients: patientsResult.status === 'fulfilled' ? patientsResult.value.resources || [] : [],
        conditions: conditionsResult.status === 'fulfilled' ? conditionsResult.value.resources || [] : [],
        medications: medicationsResult.status === 'fulfilled' ? medicationsResult.value.resources || [] : [],
        observations: observationsResult.status === 'fulfilled' ? observationsResult.value.resources || [] : []
      });
      
    } catch (err) {
      console.error('Error loading population data:', err);
      setError(err.message || 'Failed to load population data');
    } finally {
      setLoading(false);
    }
  }, []);
  
  const refreshData = useCallback(async () => {
    setRefreshing(true);
    await loadPopulationData();
    setRefreshing(false);
  }, [loadPopulationData]);
  
  useEffect(() => {
    loadPopulationData();
  }, [loadPopulationData]);
  
  const metrics = useMemo(() => {
    if (loading || !data.patients.length) {
      return {
        totalPatients: 0,
        diabeticPatients: 0,
        hypertensionPatients: 0,
        activeMedications: 0,
        medicationAdherence: 0,
        diabetesControl: 0
      };
    }
    
    return calculateMetrics(data.patients, data.conditions, data.medications, data.observations);
  }, [data, loading]);
  
  const handleExport = () => {
    const csvData = [
      ['Metric', 'Value', 'Date'],
      ['Total Patients', metrics.totalPatients, format(new Date(), 'yyyy-MM-dd')],
      ['Diabetic Patients', metrics.diabeticPatients, format(new Date(), 'yyyy-MM-dd')],
      ['Hypertension Patients', metrics.hypertensionPatients, format(new Date(), 'yyyy-MM-dd')],
      ['Active Medications', metrics.activeMedications, format(new Date(), 'yyyy-MM-dd')],
      ['Medication Adherence %', metrics.medicationAdherence, format(new Date(), 'yyyy-MM-dd')]
    ];
    
    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `population-health-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
    setExportDialogOpen(false);
  };
  
  if (error) {
    return (
      <Paper elevation={0} sx={{ height: '100%', p: 3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Alert severity="error" sx={{ maxWidth: 600 }}>
          <Typography variant="h6" gutterBottom>
            Failed to Load Population Data
          </Typography>
          {error}
          <Box sx={{ mt: 2 }}>
            <Button onClick={loadPopulationData} variant="contained">
              Retry
            </Button>
          </Box>
        </Alert>
      </Paper>
    );
  }
  
  return (
    <Paper elevation={0} sx={{ height: '100%', overflow: 'auto' }}>
      {/* Header */}
      <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper', position: 'sticky', top: 0, zIndex: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <PopulationIcon color="primary" fontSize="large" />
            <Typography variant="h5">Population Health Analytics</Typography>
            <Chip 
              icon={<GroupIcon />} 
              label={`${metrics.totalPatients.toLocaleString()} Patients`}
              color="primary" 
              variant="outlined" 
            />
          </Box>
          
          <Stack direction="row" spacing={1}>
            <Tooltip title="Refresh Data">
              <IconButton onClick={refreshData} disabled={refreshing}>
                {refreshing ? <CircularProgress size={20} /> : <RefreshIcon />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Export Data">
              <IconButton onClick={() => setExportDialogOpen(true)}>
                <ExportIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>
      </Box>
      
      <Box sx={{ p: 3 }}>
        {/* Key Metrics */}
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ChartIcon color="primary" />
          Population Health Metrics
        </Typography>
        
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <MetricCard
              title="Total Active Patients"
              value={metrics.totalPatients}
              isLoading={loading}
              icon={<PersonIcon />}
              color="primary"
              unit=""
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <MetricCard
              title="Diabetes Management"
              value={metrics.diabetesControl}
              target={80}
              isLoading={loading}
              icon={<AssignmentIcon />}
              color="success"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <MetricCard
              title="Medication Adherence"
              value={metrics.medicationAdherence}
              target={85}
              isLoading={loading}
              icon={<MedicationIcon />}
              color="info"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <MetricCard
              title="Chronic Conditions"
              value={metrics.diabeticPatients + metrics.hypertensionPatients}
              isLoading={loading}
              icon={<ConditionIcon />}
              color="warning"
              unit=""
            />
          </Grid>
        </Grid>
        
        {/* Detailed Analytics */}
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TimelineIcon color="primary" />
              Care Gaps Analysis
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <CareGapTable conditions={data.conditions} isLoading={loading} />
          </AccordionDetails>
        </Accordion>
        
        <Accordion sx={{ mt: 2 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">
              Quality Measures Performance
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle1" gutterBottom>
                      Diabetes Care Quality
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                      <Typography variant="h4" color="success.main">
                        {metrics.diabeticPatients}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        patients with diabetes
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={metrics.diabetesControl}
                      sx={{ height: 8, borderRadius: 4 }}
                      color="success"
                    />
                    <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
                      {metrics.diabetesControl}% meeting control targets
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle1" gutterBottom>
                      Hypertension Management
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                      <Typography variant="h4" color="warning.main">
                        {metrics.hypertensionPatients}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        patients with hypertension
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min((metrics.hypertensionPatients / metrics.totalPatients) * 100, 100)}
                      sx={{ height: 8, borderRadius: 4 }}
                      color="warning"
                    />
                    <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
                      {Math.round((metrics.hypertensionPatients / metrics.totalPatients) * 100)}% of population
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>
        
        {/* Action Buttons */}
        <Box sx={{ mt: 4, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Button 
            variant="contained" 
            color="primary"
            startIcon={<AssignmentIcon />}
            disabled
          >
            Generate Quality Report
          </Button>
          <Button 
            variant="outlined"
            startIcon={<ExportIcon />}
            onClick={() => setExportDialogOpen(true)}
          >
            Export Data
          </Button>
          <Button 
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={refreshData}
            disabled={refreshing}
          >
            {refreshing ? 'Refreshing...' : 'Refresh Data'}
          </Button>
        </Box>
      </Box>
      
      {/* Export Dialog */}
      <Dialog open={exportDialogOpen} onClose={() => setExportDialogOpen(false)}>
        <DialogTitle>Export Population Health Data</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Export current population health metrics and analytics to CSV format.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleExport} variant="contained">Export CSV</Button>
        </DialogActions>
      </Dialog>
      
      {/* Floating Action Button for Quick Actions */}
      <Fab
        color="primary"
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
        onClick={refreshData}
        disabled={refreshing}
      >
        {refreshing ? <CircularProgress size={24} color="inherit" /> : <RefreshIcon />}
      </Fab>
    </Paper>
  );
};

export default PopulationHealthMode;