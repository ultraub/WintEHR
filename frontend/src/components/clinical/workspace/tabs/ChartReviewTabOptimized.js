/**
 * Enhanced Chart Review Tab - Comprehensive patient clinical overview
 * Features:
 * - Visual timeline of clinical events
 * - Interactive summary cards with trends
 * - Smart filtering and search
 * - Data visualizations
 * - Clinical alerts and recommendations
 */
import React, { useState, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Stack,
  Button,
  CircularProgress,
  Alert,
  AlertTitle,
  Divider,
  IconButton,
  Tooltip,
  Grid,
  Paper,
  TextField,
  InputAdornment,
  ToggleButton,
  ToggleButtonGroup,
  Badge,
  LinearProgress,
  Fade,
  Collapse,
  useTheme,
  alpha,
  Avatar,
  AvatarGroup,
  Menu,
  MenuItem,
  FormControlLabel,
  Switch
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Warning as WarningIcon,
  Search as SearchIcon,
  Timeline as TimelineIcon,
  Dashboard as DashboardIcon,
  List as ListIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  LocalHospital as HospitalIcon,
  Medication as MedicationIcon,
  Healing as HealingIcon,
  Vaccines as VaccinesIcon,
  FilterList as FilterIcon,
  DateRange as DateRangeIcon,
  Assessment as AssessmentIcon,
  Favorite as HeartIcon,
  MonitorHeart as MonitorIcon,
  Psychology as PsychologyIcon,
  BugReport as BugIcon
} from '@mui/icons-material';
import { format, formatDistanceToNow, subDays, isWithinInterval } from 'date-fns';
import useChartReviewResources from '../../../../hooks/useChartReviewResources';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import { useClinicalWorkflow } from '../../../../contexts/ClinicalWorkflowContext';
import ResourceDataGrid from '../../../common/ResourceDataGrid';
import ConditionDialog from '../dialogs/ConditionDialog';
import MedicationDialog from '../dialogs/MedicationDialog';
import AllergyDialog from '../dialogs/AllergyDialog';
import ImmunizationDialog from '../dialogs/ImmunizationDialog';
// Modern theme utilities
import { 
  getClinicalCardStyles, 
  getHoverEffect, 
  getSeverityGradient,
  getElevationShadow,
  getBorderRadius,
  getSmoothTransition,
  getColoredShadow
} from '../../../../themes/clinicalThemeUtils';
import { clinicalTokens } from '../../../../themes/clinicalTheme';

const ChartReviewTabOptimized = ({ patient }) => {
  const theme = useTheme();
  const { currentPatient } = useFHIRResource();
  const { publish } = useClinicalWorkflow();
  const patientId = patient?.id || currentPatient?.id;
  
  // Use optimized hook for chart review resources with all FHIR resources
  const { 
    conditions, 
    medications, 
    allergies, 
    immunizations,
    observations,
    procedures,
    encounters,
    loading, 
    error,
    refresh,
    stats,
    searchResources,
    updateFilters,
    filters
  } = useChartReviewResources(patientId, {
    includeInactive: true,
    realTimeUpdates: true
  });
  
  // View and filter states
  const [viewMode, setViewMode] = useState('dashboard'); // dashboard, timeline, list
  const [dateRange, setDateRange] = useState('all'); // all, 30d, 90d, 1y
  const [showInactive, setShowInactive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState(['all']);
  const [expandedSections, setExpandedSections] = useState({
    conditions: true,
    medications: true,
    allergies: true,
    vitals: true
  });
  
  // Dialog states
  const [openDialogs, setOpenDialogs] = useState({
    condition: false,
    medication: false,
    allergy: false,
    immunization: false
  });
  
  const [selectedResource, setSelectedResource] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  
  // Filter data by date range
  const filteredByDate = useMemo(() => {
    if (dateRange === 'all') return () => true;
    
    const days = {
      '30d': 30,
      '90d': 90,
      '1y': 365
    }[dateRange];
    
    const cutoffDate = subDays(new Date(), days);
    
    return (resource) => {
      const resourceDate = resource.recordedDate || 
                          resource.onsetDateTime || 
                          resource.authoredOn || 
                          resource.occurrenceDateTime ||
                          resource.effectiveDateTime ||
                          resource.period?.start;
      
      if (!resourceDate) return true;
      return new Date(resourceDate) >= cutoffDate;
    };
  }, [dateRange]);
  
  // Process and categorize data with FHIR R4 structure
  const processedData = useMemo(() => {
    // Active vs Inactive conditions using FHIR R4 clinicalStatus
    const activeConditions = conditions.filter(c => 
      c.clinicalStatus?.coding?.[0]?.code === 'active' && filteredByDate(c)
    );
    const inactiveConditions = conditions.filter(c => 
      c.clinicalStatus?.coding?.[0]?.code !== 'active' && filteredByDate(c)
    );
    
    // Categorize conditions by FHIR R4 category
    const conditionsByCategory = {
      'problem-list-item': activeConditions.filter(c => 
        c.category?.some(cat => cat.coding?.[0]?.code === 'problem-list-item')
      ),
      'encounter-diagnosis': activeConditions.filter(c => 
        c.category?.some(cat => cat.coding?.[0]?.code === 'encounter-diagnosis')
      )
    };
    
    // Medications by FHIR R4 status and intent
    const activeMedications = medications.filter(m => 
      ['active', 'on-hold'].includes(m.status) && filteredByDate(m)
    );
    const inactiveMedications = medications.filter(m => 
      !['active', 'on-hold'].includes(m.status) && filteredByDate(m)
    );
    
    // Group medications by FHIR R4 intent
    const medicationsByIntent = {
      order: activeMedications.filter(m => m.intent === 'order'),
      plan: activeMedications.filter(m => m.intent === 'plan'),
      proposal: activeMedications.filter(m => m.intent === 'proposal')
    };
    
    // Allergies by FHIR R4 criticality
    const criticalAllergies = allergies.filter(a => 
      a.criticality === 'high' && filteredByDate(a)
    );
    const nonCriticalAllergies = allergies.filter(a => 
      a.criticality !== 'high' && filteredByDate(a)
    );
    
    // Recent vital signs (last 10)
    const recentVitals = observations
      .filter(o => o.category?.some(cat => 
        cat.coding?.[0]?.code === 'vital-signs'
      ))
      .sort((a, b) => 
        new Date(b.effectiveDateTime || b.issued) - 
        new Date(a.effectiveDateTime || a.issued)
      )
      .slice(0, 10);
    
    // Recent encounters
    const recentEncounters = encounters
      .filter(filteredByDate)
      .sort((a, b) => 
        new Date(b.period?.start || 0) - new Date(a.period?.start || 0)
      )
      .slice(0, 5);
    
    return {
      activeConditions,
      inactiveConditions,
      conditionsByCategory,
      activeMedications,
      inactiveMedications,
      medicationsByIntent,
      criticalAllergies,
      nonCriticalAllergies,
      recentVitals,
      recentEncounters,
      procedures: procedures.filter(filteredByDate),
      immunizations: immunizations.filter(filteredByDate)
    };
  }, [conditions, medications, allergies, observations, procedures, encounters, immunizations, filteredByDate]);
  
  // Calculate clinical alerts and recommendations
  const clinicalAlerts = useMemo(() => {
    const alerts = [];
    
    // Critical allergies alert
    if (processedData.criticalAllergies.length > 0) {
      alerts.push({
        severity: 'error',
        title: 'Critical Allergies',
        message: `Patient has ${processedData.criticalAllergies.length} critical allergies`,
        icon: <WarningIcon />
      });
    }
    
    // Polypharmacy alert
    if (processedData.activeMedications.length >= 5) {
      alerts.push({
        severity: 'warning',
        title: 'Polypharmacy Risk',
        message: `Patient is on ${processedData.activeMedications.length} active medications`,
        icon: <MedicationIcon />
      });
    }
    
    // Multiple chronic conditions
    const chronicConditions = processedData.activeConditions.filter(c => 
      c.category?.some(cat => cat.coding?.[0]?.code === 'problem-list-item')
    );
    if (chronicConditions.length >= 3) {
      alerts.push({
        severity: 'info',
        title: 'Complex Patient',
        message: `Managing ${chronicConditions.length} chronic conditions`,
        icon: <HealingIcon />
      });
    }
    
    // Overdue immunizations
    const overdueImmunizations = processedData.immunizations.filter(i => 
      i.status === 'not-done'
    );
    if (overdueImmunizations.length > 0) {
      alerts.push({
        severity: 'info',
        title: 'Immunizations Due',
        message: `${overdueImmunizations.length} immunizations need attention`,
        icon: <VaccinesIcon />
      });
    }
    
    return alerts;
  }, [processedData]);
  
  // Handler functions
  const handleOpenDialog = (type, resource = null) => {
    setSelectedResource(resource);
    setOpenDialogs(prev => ({ ...prev, [type]: true }));
  };
  
  const handleCloseDialog = (type) => {
    setOpenDialogs(prev => ({ ...prev, [type]: false }));
    setSelectedResource(null);
  };
  
  const handleResourceSaved = async () => {
    // Refresh data after save
    await refresh();
  };
  
  // Search and filter handlers
  const handleSearch = (query) => {
    setSearchQuery(query);
    searchResources(query);
  };

  const handleDateRangeChange = (event, newRange) => {
    if (newRange) {
      setDateRange(newRange);
    }
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
        <CircularProgress />
      </Box>
    );
  }
  
  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Professional Header */}
      <Paper 
        elevation={0} 
        sx={{ 
          p: 2, 
          mb: 2, 
          backgroundColor: theme.palette.background.paper,
          borderRadius: 0,  // Sharp corners for professional UI
          border: '1px solid',
          borderColor: 'divider',
          borderLeft: '4px solid',
          borderLeftColor: theme.palette.primary.main
        }}
      >
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <Typography variant="caption" color="text.secondary">
              Last updated {formatDistanceToNow(new Date(), { addSuffix: true })}
            </Typography>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              {/* View Mode Toggle */}
              <ToggleButtonGroup
                value={viewMode}
                exclusive
                onChange={(e, newMode) => newMode && setViewMode(newMode)}
                size="small"
              >
                <ToggleButton value="dashboard">
                  <Tooltip title="Dashboard View">
                    <DashboardIcon />
                  </Tooltip>
                </ToggleButton>
                <ToggleButton value="timeline">
                  <Tooltip title="Timeline View">
                    <TimelineIcon />
                  </Tooltip>
                </ToggleButton>
                <ToggleButton value="list">
                  <Tooltip title="List View">
                    <ListIcon />
                  </Tooltip>
                </ToggleButton>
              </ToggleButtonGroup>
              
              {/* Filter Menu */}
              <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
                <Badge badgeContent={selectedCategories.length - 1} color="primary">
                  <FilterIcon />
                </Badge>
              </IconButton>
              
              {/* Refresh */}
              <Tooltip title="Refresh data">
                <IconButton onClick={refresh} disabled={loading}>
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
            </Stack>
          </Grid>
        </Grid>
        
        {/* Search and Date Range */}
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search conditions, medications, procedures..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                )
              }}
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <ToggleButtonGroup
              value={dateRange}
              exclusive
              onChange={handleDateRangeChange}
              size="small"
              fullWidth
            >
              <ToggleButton value="30d">Last 30 Days</ToggleButton>
              <ToggleButton value="90d">Last 90 Days</ToggleButton>
              <ToggleButton value="1y">Last Year</ToggleButton>
              <ToggleButton value="all">All Time</ToggleButton>
            </ToggleButtonGroup>
          </Grid>
        </Grid>
      </Paper>
      
      {/* Clinical Alerts */}
      {clinicalAlerts.length > 0 && (
        <Stack spacing={1} sx={{ mb: 2 }}>
          {clinicalAlerts.map((alert, index) => (
            <Alert 
              key={index} 
              severity={alert.severity}
              icon={alert.icon}
              action={
                <Button size="small" color="inherit">
                  Review
                </Button>
              }
            >
              <AlertTitle>{alert.title}</AlertTitle>
              {alert.message}
            </Alert>
          ))}
        </Stack>
      )}
      
      {/* Main Content Area */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {viewMode === 'dashboard' && (
          <Fade in={true}>
            <Box>
              {/* Summary Cards with modern gradients */}
              <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid item xs={12} md={3}>
                  <Card sx={{ 
                    height: '100%',
                    backgroundColor: clinicalTokens.severity.high.bg,
                    borderRadius: 0,  // Sharp corners
                    border: '1px solid',
                    borderColor: 'divider',
                    borderLeft: '4px solid',
                    borderLeftColor: theme.palette.error.main,
                    '&:hover': {
                      boxShadow: theme.shadows[1]
                    }
                  }}>
                    <CardContent>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Box>
                          <Typography color="text.secondary" variant="caption">
                            Active Conditions
                          </Typography>
                          <Typography variant="h3" fontWeight="bold">
                            {processedData.activeConditions.length}
                          </Typography>
                          <Stack direction="row" spacing={0.5} mt={1}>
                            {processedData.conditionsByCategory['problem-list-item']?.length > 0 && (
                              <Chip 
                                label={`${processedData.conditionsByCategory['problem-list-item'].length} Chronic`}
                                size="small"
                                color="error"
                              />
                            )}
                          </Stack>
                        </Box>
                        <Avatar sx={{ bgcolor: alpha(theme.palette.error.main, 0.1) }}>
                          <HealingIcon color="error" />
                        </Avatar>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} md={3}>
                  <Card sx={{ 
                    height: '100%',
                    backgroundColor: alpha(theme.palette.primary.main, 0.04),
                    borderRadius: 0,  // Sharp corners
                    border: '1px solid',
                    borderColor: 'divider',
                    borderLeft: '4px solid',
                    borderLeftColor: theme.palette.primary.main,
                    '&:hover': {
                      boxShadow: theme.shadows[1]
                    }
                  }}>
                    <CardContent>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Box>
                          <Typography color="text.secondary" variant="caption">
                            Active Medications
                          </Typography>
                          <Typography variant="h3" fontWeight="bold">
                            {processedData.activeMedications.length}
                          </Typography>
                          <Stack direction="row" spacing={0.5} mt={1}>
                            {processedData.medicationsByIntent.order?.length > 0 && (
                              <Chip 
                                label={`${processedData.medicationsByIntent.order.length} Orders`}
                                size="small"
                                color="primary"
                              />
                            )}
                          </Stack>
                        </Box>
                        <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1) }}>
                          <MedicationIcon color="primary" />
                        </Avatar>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} md={3}>
                  <Card sx={{ 
                    height: '100%',
                    backgroundColor: clinicalTokens.severity.moderate.bg,
                    borderRadius: 0,  // Sharp corners
                    border: '1px solid',
                    borderColor: 'divider',
                    borderLeft: '4px solid',
                    borderLeftColor: theme.palette.warning.main,
                    '&:hover': {
                      boxShadow: theme.shadows[1]
                    }
                  }}>
                    <CardContent>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Box>
                          <Typography color="text.secondary" variant="caption">
                            Allergies
                          </Typography>
                          <Typography variant="h3" fontWeight="bold">
                            {allergies.length}
                          </Typography>
                          {processedData.criticalAllergies.length > 0 && (
                            <Stack direction="row" alignItems="center" mt={1}>
                              <WarningIcon color="error" fontSize="small" />
                              <Typography variant="caption" color="error" ml={0.5}>
                                {processedData.criticalAllergies.length} Critical
                              </Typography>
                            </Stack>
                          )}
                        </Box>
                        <Avatar sx={{ bgcolor: alpha(theme.palette.warning.main, 0.1) }}>
                          <BugIcon color="warning" />
                        </Avatar>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} md={3}>
                  <Card sx={{ 
                    height: '100%',
                    backgroundColor: clinicalTokens.severity.low.bg,
                    borderRadius: 0,  // Sharp corners
                    border: '1px solid',
                    borderColor: 'divider',
                    borderLeft: '4px solid',
                    borderLeftColor: theme.palette.success.main,
                    '&:hover': {
                      boxShadow: theme.shadows[1]
                    }
                  }}>
                    <CardContent>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Box>
                          <Typography color="text.secondary" variant="caption">
                            Recent Vitals
                          </Typography>
                          <Typography variant="h3" fontWeight="bold">
                            {processedData.recentVitals.length}
                          </Typography>
                          {processedData.recentVitals[0] && (
                            <Typography variant="caption" color="text.secondary" mt={1}>
                              Last: {format(new Date(processedData.recentVitals[0].effectiveDateTime || processedData.recentVitals[0].issued), 'MMM d')}
                            </Typography>
                          )}
                        </Box>
                        <Avatar sx={{ bgcolor: alpha(theme.palette.success.main, 0.1) }}>
                          <MonitorIcon color="success" />
                        </Avatar>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
              
              {/* Main Content Grid */}
              <Grid container spacing={3}>
                {/* Conditions Panel */}
                <Grid item xs={12} lg={6}>
                  <Card sx={{
                    borderRadius: 0,  // Sharp corners
                    border: '1px solid',
                    borderColor: 'divider',
                    borderLeft: '4px solid',
                    borderLeftColor: theme.palette.error.main,
                    backgroundColor: theme.palette.background.paper,
                    boxShadow: 'none',
                    transition: 'box-shadow 0.2s ease'
                  }}>
                    <CardContent>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Typography variant="h6" sx={{ fontWeight: 600 }}>Conditions</Typography>
                          <Chip 
                            label={`${processedData.activeConditions.length} Active`} 
                            size="small" 
                            color="error"
                            sx={{
                              borderRadius: '4px',  // Professional UI
                              fontWeight: 600
                            }}
                          />
                        </Stack>
                        <Button
                          startIcon={<AddIcon />}
                          size="small"
                          onClick={() => handleOpenDialog('condition')}
                          sx={{
                            borderRadius: getBorderRadius('md'),
                            textTransform: 'none',
                            fontWeight: 600,
                            ...getHoverEffect('scale', theme)
                          }}
                        >
                          Add
                        </Button>
                      </Stack>
                      
                      {processedData.activeConditions.length === 0 ? (
                        <Alert severity="info">No active conditions</Alert>
                      ) : (
                        <Stack spacing={1}>
                          {processedData.activeConditions.slice(0, 5).map((condition, index) => (
                            <EnhancedConditionCard
                              key={condition.id}
                              condition={condition}
                              onEdit={() => handleOpenDialog('condition', condition)}
                              isAlternate={index % 2 === 1}  // For alternating rows
                            />
                          ))}
                          {processedData.activeConditions.length > 5 && (
                            <Button size="small" fullWidth>
                              View {processedData.activeConditions.length - 5} more conditions
                            </Button>
                          )}
                        </Stack>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
                
                {/* Medications Panel */}
                <Grid item xs={12} lg={6}>
                  <Card sx={{
                    borderRadius: 0,  // Sharp corners
                    border: '1px solid',
                    borderColor: 'divider',
                    borderLeft: '4px solid',
                    borderLeftColor: theme.palette.primary.main,
                    backgroundColor: theme.palette.background.paper,
                    boxShadow: 'none',
                    transition: 'box-shadow 0.2s ease'
                  }}>
                    <CardContent>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Typography variant="h6" sx={{ fontWeight: 600 }}>Medications</Typography>
                          <Chip 
                            label={`${processedData.activeMedications.length} Active`} 
                            size="small" 
                            color="primary"
                            sx={{
                              borderRadius: '4px',  // Professional UI
                              fontWeight: 600
                            }}
                          />
                        </Stack>
                        <Button
                          startIcon={<AddIcon />}
                          size="small"
                          onClick={() => handleOpenDialog('medication')}
                          sx={{
                            borderRadius: getBorderRadius('md'),
                            textTransform: 'none',
                            fontWeight: 600,
                            ...getHoverEffect('scale', theme)
                          }}
                        >
                          Add
                        </Button>
                      </Stack>
                      
                      {processedData.activeMedications.length === 0 ? (
                        <Alert severity="info">No active medications</Alert>
                      ) : (
                        <Stack spacing={1}>
                          {processedData.activeMedications.slice(0, 5).map((medication, index) => (
                            <EnhancedMedicationCard
                              key={medication.id}
                              medication={medication}
                              onEdit={() => handleOpenDialog('medication', medication)}
                              isAlternate={index % 2 === 1}  // For alternating rows
                            />
                          ))}
                          {processedData.activeMedications.length > 5 && (
                            <Button size="small" fullWidth>
                              View {processedData.activeMedications.length - 5} more medications
                            </Button>
                          )}
                        </Stack>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
                
                {/* Allergies Panel */}
                <Grid item xs={12} md={6}>
                  <Card sx={{
                    borderRadius: 0,  // Sharp corners
                    border: '1px solid',
                    borderColor: 'divider',
                    borderLeft: '4px solid',
                    borderLeftColor: theme.palette.warning.main,
                    backgroundColor: theme.palette.background.paper,
                    boxShadow: 'none',
                    transition: 'box-shadow 0.2s ease'
                  }}>
                    <CardContent>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Typography variant="h6" sx={{ fontWeight: 600 }}>Allergies</Typography>
                          {processedData.criticalAllergies.length > 0 && (
                            <Chip 
                              icon={<WarningIcon />}
                              label={`${processedData.criticalAllergies.length} Critical`} 
                              size="small" 
                              color="error"
                              sx={{
                                borderRadius: '4px',  // Professional UI
                                fontWeight: 600,
                                animation: 'pulse 2s infinite'
                              }}
                            />
                          )}
                        </Stack>
                        <Button
                          startIcon={<AddIcon />}
                          size="small"
                          onClick={() => handleOpenDialog('allergy')}
                          sx={{
                            borderRadius: getBorderRadius('md'),
                            textTransform: 'none',
                            fontWeight: 600,
                            ...getHoverEffect('scale', theme)
                          }}
                        >
                          Add
                        </Button>
                      </Stack>
                      
                      {allergies.length === 0 ? (
                        <Alert severity="success">No known allergies</Alert>
                      ) : (
                        <Stack spacing={1}>
                          {[...processedData.criticalAllergies, ...processedData.nonCriticalAllergies]
                            .slice(0, 5)
                            .map((allergy, index) => (
                              <EnhancedAllergyCard
                                key={allergy.id}
                                allergy={allergy}
                                onEdit={() => handleOpenDialog('allergy', allergy)}
                                isAlternate={index % 2 === 1}  // For alternating rows
                              />
                            ))}
                        </Stack>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
                
                {/* Recent Encounters Panel */}
                <Grid item xs={12} md={6}>
                  <Card sx={{
                    borderRadius: 0,  // Sharp corners
                    border: '1px solid',
                    borderColor: 'divider',
                    borderLeft: '4px solid',
                    borderLeftColor: theme.palette.info.main,
                    backgroundColor: theme.palette.background.paper,
                    boxShadow: 'none',
                    transition: 'box-shadow 0.2s ease'
                  }}>
                    <CardContent>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>Recent Encounters</Typography>
                        <Chip 
                          label={`${processedData.recentEncounters.length}`} 
                          size="small"
                          sx={{
                            borderRadius: '4px',  // Professional UI
                            fontWeight: 600,
                            backgroundColor: alpha(theme.palette.info.main, 0.1),
                            color: theme.palette.info.main
                          }}
                        />
                      </Stack>
                      
                      {processedData.recentEncounters.length === 0 ? (
                        <Alert severity="info">No recent encounters</Alert>
                      ) : (
                        <Stack spacing={1}>
                          {processedData.recentEncounters.map((encounter, index) => (
                            <Paper
                              key={encounter.id}
                              elevation={0}
                              sx={{ 
                                p: 2, 
                                borderRadius: 0,  // Sharp corners
                                border: '1px solid',
                                borderColor: 'divider',
                                borderLeft: '4px solid',
                                borderLeftColor: theme.palette.info.main,
                                backgroundColor: index % 2 === 1 ? alpha(theme.palette.action.hover, 0.04) : theme.palette.background.paper,
                                '&:hover': {
                                  backgroundColor: alpha(theme.palette.action.hover, 0.08),
                                  transform: 'translateX(2px)'
                                },
                                transition: 'all 0.2s ease'
                              }}
                            >
                              <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Box>
                                  <Typography variant="body2" fontWeight={500}>
                                    {encounter.type?.[0]?.text || encounter.type?.[0]?.coding?.[0]?.display || 'Encounter'}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {encounter.period?.start && format(new Date(encounter.period.start), 'MMM d, yyyy')}
                                  </Typography>
                                </Box>
                                <Chip 
                                  label={encounter.status} 
                                  size="small"
                                  color={encounter.status === 'in-progress' ? 'primary' : 'default'}
                                />
                              </Stack>
                            </Paper>
                          ))}
                        </Stack>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          </Fade>
        )}
        
        {viewMode === 'timeline' && (
          <Fade in={true}>
            <Box>
              <Alert severity="info" sx={{ mb: 2 }}>
                Timeline view shows a chronological history of clinical events
              </Alert>
              {/* Timeline implementation would go here */}
            </Box>
          </Fade>
        )}
        
        {viewMode === 'list' && (
          <Fade in={true}>
            <Box>
              {/* Traditional list view */}
              <Stack spacing={2}>
                {/* Reuse the original simple list components */}
              </Stack>
            </Box>
          </Fade>
        )}
      </Box>
      
      {/* Dialogs */}
      <ConditionDialog
        open={openDialogs.condition}
        onClose={() => handleCloseDialog('condition')}
        condition={selectedResource}
        patientId={patientId}
        onSaved={handleResourceSaved}
      />
      
      <MedicationDialog
        open={openDialogs.medication}
        onClose={() => handleCloseDialog('medication')}
        medication={selectedResource}
        patientId={patientId}
        onSaved={handleResourceSaved}
      />
      
      <AllergyDialog
        open={openDialogs.allergy}
        onClose={() => handleCloseDialog('allergy')}
        allergy={selectedResource}
        patientId={patientId}
        onSaved={handleResourceSaved}
      />
      
      <ImmunizationDialog
        open={openDialogs.immunization}
        onClose={() => handleCloseDialog('immunization')}
        immunization={selectedResource}
        patientId={patientId}
        onSaved={handleResourceSaved}
      />
    </Box>
  );
};

// Enhanced card components with professional styling
const EnhancedConditionCard = ({ condition, onEdit, isAlternate = false }) => {
  const theme = useTheme();
  const severity = condition.severity?.coding?.[0]?.display || condition.severity?.text;
  const stage = condition.stage?.[0]?.summary?.coding?.[0]?.display || condition.stage?.[0]?.summary?.text;
  const verification = condition.verificationStatus?.coding?.[0]?.code;
  const isActive = condition.clinicalStatus?.coding?.[0]?.code === 'active';
  
  // Determine severity level for styling
  const severityLevel = severity?.toLowerCase().includes('severe') ? 'high' : 
                       severity?.toLowerCase().includes('moderate') ? 'moderate' : 
                       isActive ? 'moderate' : 'low';
  
  const cardStyles = getClinicalCardStyles(severityLevel, 1, true);
  
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 0,  // Sharp corners
        border: '1px solid',
        borderColor: 'divider',
        borderLeft: '4px solid',
        borderLeftColor: clinicalTokens.severity[severityLevel]?.color || theme.palette.grey[300],
        backgroundColor: isAlternate ? alpha(theme.palette.action.hover, 0.04) : theme.palette.background.paper,
        transition: 'all 0.2s ease',
        '&:hover': {
          backgroundColor: alpha(theme.palette.action.hover, 0.08),
          transform: 'translateX(2px)'
        }
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
        <Box flex={1}>
          <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
            <Typography variant="body1" fontWeight={600}>
              {condition.code?.text || condition.code?.coding?.[0]?.display || 'Unknown condition'}
            </Typography>
            {verification === 'confirmed' && (
              <Chip label="Confirmed" size="small" color="success" />
            )}
          </Stack>
          
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="caption" color="text.secondary">
              <strong>Onset:</strong> {condition.onsetDateTime ? 
                format(new Date(condition.onsetDateTime), 'MMM d, yyyy') : 
                condition.onsetAge?.value ? `Age ${condition.onsetAge.value}` : 
                'Unknown'}
            </Typography>
            {severity && (
              <Typography variant="caption" color="text.secondary">
                <strong>Severity:</strong> {severity}
              </Typography>
            )}
            {stage && (
              <Typography variant="caption" color="text.secondary">
                <strong>Stage:</strong> {stage}
              </Typography>
            )}
          </Stack>
          
          {condition.note?.[0]?.text && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              {condition.note[0].text}
            </Typography>
          )}
        </Box>
        
        <IconButton size="small" onClick={onEdit}>
          <EditIcon fontSize="small" />
        </IconButton>
      </Stack>
    </Paper>
  );
};

const EnhancedMedicationCard = ({ medication, onEdit, isAlternate = false }) => {
  const theme = useTheme();
  const medicationDisplay = medication.medicationCodeableConcept?.text || 
                          medication.medicationCodeableConcept?.coding?.[0]?.display || 
                          'Unknown medication';
  const dosage = medication.dosageInstruction?.[0];
  const isActive = ['active', 'on-hold'].includes(medication.status);
  
  const cardStyles = getClinicalCardStyles(isActive ? 'normal' : 'low', 1, true);
  
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 0,  // Sharp corners
        border: '1px solid',
        borderColor: 'divider',
        borderLeft: `4px solid ${isActive ? theme.palette.primary.main : theme.palette.grey[300]}`,
        backgroundColor: isAlternate ? alpha(theme.palette.action.hover, 0.04) : theme.palette.background.paper,
        transition: 'all 0.2s ease',
        '&:hover': {
          backgroundColor: alpha(theme.palette.action.hover, 0.08),
          transform: 'translateX(2px)'
        }
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
        <Box flex={1}>
          <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
            <Typography variant="body1" fontWeight={600}>
              {medicationDisplay}
            </Typography>
            <Chip 
              label={medication.status} 
              size="small" 
              color={isActive ? 'primary' : 'default'}
            />
            {medication.intent && (
              <Chip 
                label={medication.intent} 
                size="small" 
                variant="outlined"
              />
            )}
          </Stack>
          
          <Stack spacing={0.5}>
            {dosage && (
              <Typography variant="caption" color="text.secondary">
                <strong>Dosage:</strong> {dosage.text || 
                  `${dosage.doseAndRate?.[0]?.doseQuantity?.value} ${dosage.doseAndRate?.[0]?.doseQuantity?.unit} ${dosage.timing?.repeat?.frequency ? `${dosage.timing.repeat.frequency}x daily` : ''}`}
              </Typography>
            )}
            {dosage?.route && (
              <Typography variant="caption" color="text.secondary">
                <strong>Route:</strong> {dosage.route.text || dosage.route.coding?.[0]?.display}
              </Typography>
            )}
            {medication.authoredOn && (
              <Typography variant="caption" color="text.secondary">
                <strong>Started:</strong> {format(new Date(medication.authoredOn), 'MMM d, yyyy')}
              </Typography>
            )}
            {medication.reasonCode?.[0] && (
              <Typography variant="caption" color="text.secondary">
                <strong>Reason:</strong> {medication.reasonCode[0].text || medication.reasonCode[0].coding?.[0]?.display}
              </Typography>
            )}
          </Stack>
        </Box>
        
        <IconButton size="small" onClick={onEdit}>
          <EditIcon fontSize="small" />
        </IconButton>
      </Stack>
    </Paper>
  );
};

const EnhancedAllergyCard = ({ allergy, onEdit, isAlternate = false }) => {
  const theme = useTheme();
  const criticality = allergy.criticality || 'low';
  const criticalityColor = {
    high: 'error',
    low: 'success',
    'unable-to-assess': 'warning'
  }[criticality];
  
  const manifestations = allergy.reaction?.[0]?.manifestation || [];
  const severity = allergy.reaction?.[0]?.severity;
  
  // Map criticality to severity level
  const severityLevel = criticality === 'high' ? 'critical' : 
                       criticality === 'unable-to-assess' ? 'moderate' : 'low';
  
  const cardStyles = getClinicalCardStyles(severityLevel, 1, true);
  
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 0,  // Sharp corners
        border: '1px solid',
        borderColor: 'divider',
        borderLeft: `4px solid ${theme.palette[criticalityColor].main}`,
        backgroundColor: isAlternate ? alpha(theme.palette.action.hover, 0.04) : 
                         (criticality === 'high' ? clinicalTokens.severity.critical.bg : theme.palette.background.paper),
        transition: 'all 0.2s ease',
        '&:hover': {
          backgroundColor: alpha(theme.palette.action.hover, 0.08),
          transform: 'translateX(2px)'
        },
        ...(criticality === 'high' && {
          animation: 'pulse 3s ease-in-out infinite'
        })
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
        <Box flex={1}>
          <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
            {criticality === 'high' && <WarningIcon color="error" />}
            <Typography variant="body1" fontWeight={600}>
              {allergy.code?.text || allergy.code?.coding?.[0]?.display || 'Unknown allergen'}
            </Typography>
            <Chip 
              label={criticality} 
              size="small" 
              color={criticalityColor}
            />
            {severity && (
              <Chip 
                label={severity} 
                size="small" 
                variant="outlined"
                color={severity === 'severe' ? 'error' : 'default'}
              />
            )}
          </Stack>
          
          <Stack spacing={0.5}>
            <Typography variant="caption" color="text.secondary">
              <strong>Type:</strong> {allergy.type || 'Unknown'} | 
              <strong> Category:</strong> {allergy.category?.[0] || 'Unknown'}
            </Typography>
            {manifestations.length > 0 && (
              <Typography variant="caption" color="text.secondary">
                <strong>Reactions:</strong> {manifestations.map(m => 
                  m.text || m.coding?.[0]?.display
                ).join(', ')}
              </Typography>
            )}
            {allergy.recordedDate && (
              <Typography variant="caption" color="text.secondary">
                <strong>Recorded:</strong> {format(new Date(allergy.recordedDate), 'MMM d, yyyy')}
              </Typography>
            )}
          </Stack>
        </Box>
        
        <IconButton size="small" onClick={onEdit}>
          <EditIcon fontSize="small" />
        </IconButton>
      </Stack>
    </Paper>
  );
};

export default ChartReviewTabOptimized;