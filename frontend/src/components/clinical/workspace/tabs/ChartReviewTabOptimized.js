/**
 * Enhanced Chart Review Tab - Comprehensive patient clinical overview
 * Features:
 * - Visual timeline of clinical events
 * - Interactive summary cards with trends
 * - Smart filtering and search
 * - Data visualizations
 * - Clinical alerts and recommendations
 */
import React, { useState, useMemo, useCallback } from 'react';
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
  BugReport as BugIcon,
  Assignment as AssignmentIcon,
  Description as DescriptionIcon,
  PictureAsPdf as PictureAsPdfIcon,
  Image as ImageIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { format, formatDistanceToNow, subDays, isWithinInterval } from 'date-fns';
import { useSnackbar } from 'notistack';
import useChartReviewResources from '../../../../hooks/useChartReviewResources';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import { useClinicalWorkflow } from '../../../../contexts/ClinicalWorkflowContext';
import { fhirClient } from '../../../../core/fhir/services/fhirClient';
import ResourceDataGrid from '../../../common/ResourceDataGrid';
import ConditionDialogEnhanced from '../dialogs/ConditionDialogEnhanced';
import MedicationDialogEnhanced from '../dialogs/MedicationDialogEnhanced';
import AllergyDialogEnhanced from '../dialogs/AllergyDialogEnhanced';
import ImmunizationDialogEnhanced from '../dialogs/ImmunizationDialogEnhanced';
import ProcedureDialogEnhanced from '../dialogs/ProcedureDialogEnhanced';
import CarePlanDialog from '../dialogs/CarePlanDialog';
import DocumentReferenceDialog from '../dialogs/DocumentReferenceDialog';
import CollapsibleFilterPanel from '../CollapsibleFilterPanel';
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
import { cdsAlertPersistence } from '../../../../services/cdsAlertPersistenceService';

const ChartReviewTabOptimized = ({ patient, scrollContainerRef }) => {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
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
    carePlans,
    documentReferences,
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
    vitals: true,
    immunizations: true,
    procedures: true,
    carePlans: true,
    documents: true
  });
  
  // Dialog states
  const [openDialogs, setOpenDialogs] = useState({
    condition: false,
    medication: false,
    allergy: false,
    immunization: false,
    procedure: false,
    carePlan: false,
    document: false
  });
  
  const [selectedResource, setSelectedResource] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  
  // Alert dismissal state
  const [dismissedAlerts, setDismissedAlerts] = useState(() => {
    if (!patientId) return new Set();
    return cdsAlertPersistence.getDismissedAlerts(patientId);
  });
  
  // Handle alert dismissal
  const handleDismissAlert = useCallback((alertId, permanent = false) => {
    // Update local state
    setDismissedAlerts(prev => new Set([...prev, alertId]));
    
    // Persist dismissal
    if (patientId) {
      cdsAlertPersistence.dismissAlert(patientId, alertId, 'User dismissed alert', permanent);
    }
  }, [patientId]);
  
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
      immunizations: immunizations.filter(filteredByDate),
      carePlans: carePlans.filter(filteredByDate),
      documentReferences: documentReferences.filter(filteredByDate)
    };
  }, [conditions, medications, allergies, observations, procedures, encounters, immunizations, filteredByDate]);
  
  // Calculate clinical alerts and recommendations
  const clinicalAlerts = useMemo(() => {
    const alerts = [];
    
    // Critical allergies alert
    if (processedData.criticalAllergies.length > 0) {
      const alertId = 'critical-allergies';
      if (!dismissedAlerts.has(alertId)) {
        alerts.push({
          id: alertId,
          severity: 'error',
          title: 'Critical Allergies',
          message: `Patient has ${processedData.criticalAllergies.length} critical allergies`,
          icon: <WarningIcon />
        });
      }
    }
    
    // Polypharmacy alert
    if (processedData.activeMedications.length >= 5) {
      const alertId = 'polypharmacy-risk';
      if (!dismissedAlerts.has(alertId)) {
        alerts.push({
          id: alertId,
          severity: 'warning',
          title: 'Polypharmacy Risk',
          message: `Patient is on ${processedData.activeMedications.length} active medications`,
          icon: <MedicationIcon />
        });
      }
    }
    
    // Multiple chronic conditions
    const chronicConditions = processedData.activeConditions.filter(c => 
      c.category?.some(cat => cat.coding?.[0]?.code === 'problem-list-item')
    );
    if (chronicConditions.length >= 3) {
      const alertId = 'complex-patient';
      if (!dismissedAlerts.has(alertId)) {
        alerts.push({
          id: alertId,
          severity: 'info',
          title: 'Complex Patient',
          message: `Managing ${chronicConditions.length} chronic conditions`,
          icon: <HealingIcon />
        });
      }
    }
    
    // Overdue immunizations
    const overdueImmunizations = processedData.immunizations.filter(i => 
      i.status === 'not-done'
    );
    if (overdueImmunizations.length > 0) {
      const alertId = 'immunizations-due';
      if (!dismissedAlerts.has(alertId)) {
        alerts.push({
          id: alertId,
          severity: 'info',
          title: 'Immunizations Due',
          message: `${overdueImmunizations.length} immunizations need attention`,
          icon: <VaccinesIcon />
        });
      }
    }
    
    return alerts;
  }, [processedData, dismissedAlerts]);
  
  // Handler functions
  const handleOpenDialog = (type, resource = null) => {
    setSelectedResource(resource);
    setOpenDialogs(prev => ({ ...prev, [type]: true }));
  };
  
  const handleCloseDialog = (type) => {
    setOpenDialogs(prev => ({ ...prev, [type]: false }));
    setSelectedResource(null);
  };
  
  const handleResourceSaved = async (resource) => {
    try {
      // Determine if this is an update or create based on whether the resource has an ID
      const isUpdate = resource.id && selectedResource?.id === resource.id;
      let result;
      
      if (isUpdate) {
        // Update existing resource
        result = await fhirClient.update(resource.resourceType, resource.id, resource);
        enqueueSnackbar(`${resource.resourceType} updated successfully`, { variant: 'success' });
      } else {
        // Create new resource
        result = await fhirClient.create(resource.resourceType, resource);
        enqueueSnackbar(`${resource.resourceType} created successfully`, { variant: 'success' });
      }
      
      // Refresh data after save
      refresh();
      
      // Return the saved resource
      return result;
    } catch (error) {
      console.error('Error saving resource:', error);
      enqueueSnackbar(`Failed to save ${resource.resourceType}. Please try again.`, { variant: 'error' });
      throw error; // Re-throw to let dialog handle error state
    }
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
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: theme.palette.mode === 'dark' ? 'background.default' : 'background.paper' }}>
      {/* Collapsible Filter Panel */}
      <CollapsibleFilterPanel
        searchQuery={searchQuery}
        onSearchChange={handleSearch}
        dateRange={dateRange}
        onDateRangeChange={handleDateRangeChange}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        showInactive={showInactive}
        onShowInactiveChange={setShowInactive}
        onRefresh={refresh}
        searchPlaceholder="Search conditions, medications, procedures..."
        categories={[
          { value: 'conditions', label: 'Conditions' },
          { value: 'medications', label: 'Medications' },
          { value: 'allergies', label: 'Allergies' },
          { value: 'procedures', label: 'Procedures' },
          { value: 'immunizations', label: 'Immunizations' }
        ]}
        selectedCategories={selectedCategories}
        onCategoriesChange={setSelectedCategories}
        showCategories={false} // Hide for now, can enable later
        scrollContainerRef={scrollContainerRef} // Pass the scroll container ref
      />
      
      {/* Clinical Alerts */}
      {clinicalAlerts.length > 0 && (
        <Stack spacing={0.5} sx={{ mb: 1, px: 1 }}>
          {clinicalAlerts.map((alert) => (
            <Alert 
              key={alert.id} 
              severity={alert.severity}
              icon={alert.icon}
              action={
                <Stack direction="row" spacing={0.5}>
                  <Tooltip title="Dismiss for this session">
                    <IconButton 
                      size="small" 
                      color="inherit"
                      onClick={() => handleDismissAlert(alert.id, false)}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              }
              sx={{
                '& .MuiAlert-action': {
                  alignItems: 'flex-start',
                  pt: 0.5
                }
              }}
            >
              <AlertTitle sx={{ fontSize: '0.875rem', fontWeight: 600 }}>
                {alert.title}
              </AlertTitle>
              <Typography variant="body2" sx={{ fontSize: '0.813rem' }}>
                {alert.message}
              </Typography>
            </Alert>
          ))}
        </Stack>
      )}
      
      {/* Main Content Area */}
      <Box sx={{ flex: 1, overflow: 'auto', p: { xs: 1, sm: 2 } }}>
        {viewMode === 'dashboard' && (
          <Fade in={true}>
            <Box>
              {/* Summary Cards with modern gradients */}
              <Grid container spacing={1} sx={{ mb: 2 }}>
                <Grid item xs={12} md={3}>
                  <Card sx={{ 
                    height: '100%',
                    backgroundColor: theme.palette.mode === 'dark' ? alpha(theme.palette.error.main, 0.08) : clinicalTokens.severity.high.bg,
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
                    backgroundColor: theme.palette.mode === 'dark' ? alpha(theme.palette.primary.main, 0.08) : alpha(theme.palette.primary.main, 0.04),
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
                    backgroundColor: theme.palette.mode === 'dark' ? alpha(theme.palette.warning.main, 0.08) : clinicalTokens.severity.moderate.bg,
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
                    backgroundColor: theme.palette.mode === 'dark' ? alpha(theme.palette.success.main, 0.08) : clinicalTokens.severity.low.bg,
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
                      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Typography variant="h6" sx={{ fontWeight: 600 }}>Conditions</Typography>
                          <Chip 
                            label={`${processedData.activeConditions.length} Active`} 
                            size="small" 
                            color="error"
                            sx={{
                              borderRadius: 0,  // Sharp corners
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
                        <Stack spacing={0.5}>
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
                      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Typography variant="h6" sx={{ fontWeight: 600 }}>Medications</Typography>
                          <Chip 
                            label={`${processedData.activeMedications.length} Active`} 
                            size="small" 
                            color="primary"
                            sx={{
                              borderRadius: 0,  // Sharp corners
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
                        <Stack spacing={0.5}>
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
                      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Typography variant="h6" sx={{ fontWeight: 600 }}>Allergies</Typography>
                          {processedData.criticalAllergies.length > 0 && (
                            <Chip 
                              icon={<WarningIcon />}
                              label={`${processedData.criticalAllergies.length} Critical`} 
                              size="small" 
                              color="error"
                              sx={{
                                borderRadius: 0,  // Sharp corners
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
                        <Stack spacing={0.5}>
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
                
                {/* Immunizations Panel */}
                <Grid item xs={12} md={6}>
                  <Card sx={{
                    borderRadius: 0,  // Sharp corners
                    border: '1px solid',
                    borderColor: 'divider',
                    borderLeft: '4px solid',
                    borderLeftColor: theme.palette.success.main,
                    backgroundColor: theme.palette.background.paper,
                    boxShadow: 'none',
                    transition: 'box-shadow 0.2s ease'
                  }}>
                    <CardContent>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Typography variant="h6" sx={{ fontWeight: 600 }}>Immunizations</Typography>
                          <Chip 
                            label={`${processedData.immunizations.length}`} 
                            size="small"
                            sx={{
                              borderRadius: 0,  // Sharp corners
                              fontWeight: 600,
                              backgroundColor: alpha(theme.palette.success.main, 0.1),
                              color: theme.palette.success.main
                            }}
                          />
                        </Stack>
                        <Button
                          startIcon={<AddIcon />}
                          size="small"
                          onClick={() => handleOpenDialog('immunization')}
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
                      
                      {processedData.immunizations.length === 0 ? (
                        <Alert severity="info">No immunization records</Alert>
                      ) : (
                        <Stack spacing={0.5}>
                          {processedData.immunizations.slice(0, 5).map((immunization, index) => (
                            <EnhancedImmunizationCard
                              key={immunization.id}
                              immunization={immunization}
                              onEdit={() => handleOpenDialog('immunization', immunization)}
                              isAlternate={index % 2 === 1}  // For alternating rows
                            />
                          ))}
                          {processedData.immunizations.length > 5 && (
                            <Button size="small" fullWidth>
                              View {processedData.immunizations.length - 5} more immunizations
                            </Button>
                          )}
                        </Stack>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
                
                {/* Procedures Panel */}
                <Grid item xs={12} md={6}>
                  <Card sx={{
                    borderRadius: 0,  // Sharp corners
                    border: '1px solid',
                    borderColor: 'divider',
                    borderLeft: '4px solid',
                    borderLeftColor: theme.palette.secondary.main,
                    backgroundColor: theme.palette.background.paper,
                    boxShadow: 'none',
                    transition: 'box-shadow 0.2s ease'
                  }}>
                    <CardContent>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Typography variant="h6" sx={{ fontWeight: 600 }}>Procedures</Typography>
                          <Chip 
                            label={`${processedData.procedures.length}`} 
                            size="small"
                            sx={{
                              borderRadius: 0,  // Sharp corners
                              fontWeight: 600,
                              backgroundColor: alpha(theme.palette.secondary.main, 0.1),
                              color: theme.palette.secondary.main
                            }}
                          />
                        </Stack>
                        <Button
                          startIcon={<AddIcon />}
                          size="small"
                          onClick={() => handleOpenDialog('procedure')}
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
                      
                      {processedData.procedures.length === 0 ? (
                        <Alert severity="info">No procedure records</Alert>
                      ) : (
                        <Stack spacing={0.5}>
                          {processedData.procedures.slice(0, 5).map((procedure, index) => (
                            <EnhancedProcedureCard
                              key={procedure.id}
                              procedure={procedure}
                              onEdit={() => handleOpenDialog('procedure', procedure)}
                              isAlternate={index % 2 === 1}  // For alternating rows
                            />
                          ))}
                          {processedData.procedures.length > 5 && (
                            <Button size="small" fullWidth>
                              View {processedData.procedures.length - 5} more procedures
                            </Button>
                          )}
                        </Stack>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
                
                {/* Care Plans Panel */}
                <Grid item xs={12} md={6}>
                  <Card sx={{
                    borderRadius: 0,  // Sharp corners
                    border: '1px solid',
                    borderColor: 'divider',
                    borderLeft: '4px solid',
                    borderLeftColor: theme.palette.indigo?.[500] || theme.palette.primary.dark,
                    backgroundColor: theme.palette.background.paper,
                    boxShadow: 'none',
                    transition: 'box-shadow 0.2s ease'
                  }}>
                    <CardContent>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Typography variant="h6" sx={{ fontWeight: 600 }}>Care Plans</Typography>
                          <Chip 
                            label={`${processedData.carePlans.length}`} 
                            size="small"
                            sx={{
                              borderRadius: 0,  // Sharp corners
                              fontWeight: 600,
                              backgroundColor: alpha(theme.palette.primary.main, 0.1),
                              color: theme.palette.primary.main
                            }}
                          />
                        </Stack>
                        <Button
                          startIcon={<AddIcon />}
                          size="small"
                          onClick={() => handleOpenDialog('carePlan')}
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
                      
                      {processedData.carePlans.length === 0 ? (
                        <Alert severity="info">No care plans</Alert>
                      ) : (
                        <Stack spacing={0.5}>
                          {processedData.carePlans.slice(0, 5).map((carePlan, index) => (
                            <EnhancedCarePlanCard
                              key={carePlan.id}
                              carePlan={carePlan}
                              onEdit={() => handleOpenDialog('carePlan', carePlan)}
                              isAlternate={index % 2 === 1}  // For alternating rows
                            />
                          ))}
                          {processedData.carePlans.length > 5 && (
                            <Button size="small" fullWidth>
                              View {processedData.carePlans.length - 5} more care plans
                            </Button>
                          )}
                        </Stack>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
                
                {/* Clinical Documents Panel */}
                <Grid item xs={12} md={6}>
                  <Card sx={{
                    borderRadius: 0,  // Sharp corners
                    border: '1px solid',
                    borderColor: 'divider',
                    borderLeft: '4px solid',
                    borderLeftColor: theme.palette.grey[600],
                    backgroundColor: theme.palette.background.paper,
                    boxShadow: 'none',
                    transition: 'box-shadow 0.2s ease'
                  }}>
                    <CardContent>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Typography variant="h6" sx={{ fontWeight: 600 }}>Clinical Documents</Typography>
                          <Chip 
                            label={`${processedData.documentReferences.length}`} 
                            size="small"
                            sx={{
                              borderRadius: 0,  // Sharp corners
                              fontWeight: 600,
                              backgroundColor: alpha(theme.palette.grey[600], 0.1),
                              color: theme.palette.grey[600]
                            }}
                          />
                        </Stack>
                        <Button
                          startIcon={<AddIcon />}
                          size="small"
                          onClick={() => handleOpenDialog('document')}
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
                      
                      {processedData.documentReferences.length === 0 ? (
                        <Alert severity="info">No clinical documents</Alert>
                      ) : (
                        <Stack spacing={0.5}>
                          {processedData.documentReferences.slice(0, 5).map((document, index) => (
                            <EnhancedDocumentCard
                              key={document.id}
                              document={document}
                              onEdit={() => handleOpenDialog('document', document)}
                              isAlternate={index % 2 === 1}  // For alternating rows
                            />
                          ))}
                          {processedData.documentReferences.length > 5 && (
                            <Button size="small" fullWidth>
                              View {processedData.documentReferences.length - 5} more documents
                            </Button>
                          )}
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
                      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>Recent Encounters</Typography>
                        <Chip 
                          label={`${processedData.recentEncounters.length}`} 
                          size="small"
                          sx={{
                            borderRadius: 0,  // Sharp corners
                            fontWeight: 600,
                            backgroundColor: alpha(theme.palette.info.main, 0.1),
                            color: theme.palette.info.main
                          }}
                        />
                      </Stack>
                      
                      {processedData.recentEncounters.length === 0 ? (
                        <Alert severity="info">No recent encounters</Alert>
                      ) : (
                        <Stack spacing={0.5}>
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
      <ConditionDialogEnhanced
        open={openDialogs.condition}
        onClose={() => handleCloseDialog('condition')}
        condition={selectedResource}
        patientId={patientId}
        onSave={handleResourceSaved}
      />
      
      <MedicationDialogEnhanced
        open={openDialogs.medication}
        onClose={() => handleCloseDialog('medication')}
        medication={selectedResource}
        patientId={patientId}
        onSave={handleResourceSaved}
      />
      
      <AllergyDialogEnhanced
        open={openDialogs.allergy}
        onClose={() => handleCloseDialog('allergy')}
        allergy={selectedResource}
        patientId={patientId}
        onSave={handleResourceSaved}
      />
      
      <ImmunizationDialogEnhanced
        open={openDialogs.immunization}
        onClose={() => handleCloseDialog('immunization')}
        immunization={selectedResource}
        patientId={patientId}
        onSave={handleResourceSaved}
      />
      
      <ProcedureDialogEnhanced
        open={openDialogs.procedure}
        onClose={() => handleCloseDialog('procedure')}
        procedure={selectedResource}
        patientId={patientId}
        onSave={handleResourceSaved}
      />
      
      <CarePlanDialog
        open={openDialogs.carePlan}
        onClose={() => handleCloseDialog('carePlan')}
        carePlan={selectedResource}
        patientId={patientId}
        onSave={handleResourceSaved}
      />
      
      <DocumentReferenceDialog
        open={openDialogs.document}
        onClose={() => handleCloseDialog('document')}
        document={selectedResource}
        patientId={patientId}
        onSave={handleResourceSaved}
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

const EnhancedImmunizationCard = ({ immunization, onEdit, isAlternate = false }) => {
  const theme = useTheme();
  const vaccineDisplay = immunization.vaccineCode?.text || 
                        immunization.vaccineCode?.coding?.[0]?.display || 
                        'Unknown vaccine';
  const status = immunization.status;
  const isCompleted = status === 'completed';
  
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 0,  // Sharp corners
        border: '1px solid',
        borderColor: 'divider',
        borderLeft: `4px solid ${isCompleted ? theme.palette.success.main : theme.palette.warning.main}`,
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
            <VaccinesIcon fontSize="small" color={isCompleted ? "success" : "warning"} />
            <Typography variant="body1" fontWeight={600}>
              {vaccineDisplay}
            </Typography>
            <Chip 
              label={status} 
              size="small" 
              color={isCompleted ? 'success' : 'warning'}
            />
          </Stack>
          
          <Stack spacing={0.5}>
            <Typography variant="caption" color="text.secondary">
              <strong>Date:</strong> {immunization.occurrenceDateTime ? 
                format(new Date(immunization.occurrenceDateTime), 'MMM d, yyyy') : 
                'Unknown'}
            </Typography>
            {immunization.protocolApplied?.[0] && (
              <Typography variant="caption" color="text.secondary">
                <strong>Dose:</strong> {immunization.protocolApplied[0].doseNumberString || 
                  immunization.protocolApplied[0].doseNumberPositiveInt || 'Unknown'} 
                {immunization.protocolApplied[0].seriesDosesString && 
                  ` of ${immunization.protocolApplied[0].seriesDosesString}`}
              </Typography>
            )}
            {immunization.site && (
              <Typography variant="caption" color="text.secondary">
                <strong>Site:</strong> {immunization.site.text || immunization.site.coding?.[0]?.display}
              </Typography>
            )}
            {immunization.manufacturer && (
              <Typography variant="caption" color="text.secondary">
                <strong>Manufacturer:</strong> {immunization.manufacturer.display}
              </Typography>
            )}
            {immunization.lotNumber && (
              <Typography variant="caption" color="text.secondary">
                <strong>Lot:</strong> {immunization.lotNumber}
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

const EnhancedProcedureCard = ({ procedure, onEdit, isAlternate = false }) => {
  const theme = useTheme();
  const procedureDisplay = procedure.code?.text || 
                          procedure.code?.coding?.[0]?.display || 
                          'Unknown procedure';
  const status = procedure.status;
  const isCompleted = status === 'completed';
  
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 0,  // Sharp corners
        border: '1px solid',
        borderColor: 'divider',
        borderLeft: `4px solid ${isCompleted ? theme.palette.secondary.main : theme.palette.info.main}`,
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
            <HealingIcon fontSize="small" color="secondary" />
            <Typography variant="body1" fontWeight={600}>
              {procedureDisplay}
            </Typography>
            <Chip 
              label={status} 
              size="small" 
              color={isCompleted ? 'secondary' : 'info'}
            />
          </Stack>
          
          <Stack spacing={0.5}>
            <Typography variant="caption" color="text.secondary">
              <strong>Date:</strong> {procedure.performedDateTime ? 
                format(new Date(procedure.performedDateTime), 'MMM d, yyyy') : 
                procedure.performedPeriod?.start ? 
                format(new Date(procedure.performedPeriod.start), 'MMM d, yyyy') : 
                'Unknown'}
            </Typography>
            {procedure.performer?.[0] && (
              <Typography variant="caption" color="text.secondary">
                <strong>Performer:</strong> {procedure.performer[0].actor?.display || 
                  procedure.performer[0].actor?.reference || 'Unknown'}
              </Typography>
            )}
            {procedure.bodySite?.[0] && (
              <Typography variant="caption" color="text.secondary">
                <strong>Body Site:</strong> {procedure.bodySite[0].text || 
                  procedure.bodySite[0].coding?.[0]?.display}
              </Typography>
            )}
            {procedure.outcome && (
              <Typography variant="caption" color="text.secondary">
                <strong>Outcome:</strong> {procedure.outcome.text || 
                  procedure.outcome.coding?.[0]?.display}
              </Typography>
            )}
            {procedure.reasonCode?.[0] && (
              <Typography variant="caption" color="text.secondary">
                <strong>Reason:</strong> {procedure.reasonCode[0].text || 
                  procedure.reasonCode[0].coding?.[0]?.display}
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

const EnhancedCarePlanCard = ({ carePlan, onEdit, isAlternate = false }) => {
  const theme = useTheme();
  const title = carePlan.title || carePlan.category?.[0]?.text || 
                carePlan.category?.[0]?.coding?.[0]?.display || 'Care Plan';
  const status = carePlan.status;
  const isActive = status === 'active';
  
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 0,  // Sharp corners
        border: '1px solid',
        borderColor: 'divider',
        borderLeft: `4px solid ${isActive ? theme.palette.primary.main : theme.palette.grey[400]}`,
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
            <AssignmentIcon fontSize="small" color="primary" />
            <Typography variant="body1" fontWeight={600}>
              {title}
            </Typography>
            <Chip 
              label={status} 
              size="small" 
              color={isActive ? 'primary' : 'default'}
            />
            {carePlan.intent && (
              <Chip 
                label={carePlan.intent} 
                size="small" 
                variant="outlined"
              />
            )}
          </Stack>
          
          <Stack spacing={0.5}>
            {carePlan.description && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                {carePlan.description}
              </Typography>
            )}
            {carePlan.period && (
              <Typography variant="caption" color="text.secondary">
                <strong>Period:</strong> {carePlan.period.start && 
                  format(new Date(carePlan.period.start), 'MMM d, yyyy')}
                {carePlan.period.end && ` - ${format(new Date(carePlan.period.end), 'MMM d, yyyy')}`}
              </Typography>
            )}
            {carePlan.goal && carePlan.goal.length > 0 && (
              <Typography variant="caption" color="text.secondary">
                <strong>Goals:</strong> {carePlan.goal.length} defined
              </Typography>
            )}
            {carePlan.activity && carePlan.activity.length > 0 && (
              <Typography variant="caption" color="text.secondary">
                <strong>Activities:</strong> {carePlan.activity.length} scheduled
              </Typography>
            )}
            {carePlan.careTeam?.[0] && (
              <Typography variant="caption" color="text.secondary">
                <strong>Care Team:</strong> {carePlan.careTeam[0].display || 'Assigned'}
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

const EnhancedDocumentCard = ({ document, onEdit, isAlternate = false }) => {
  const theme = useTheme();
  const title = document.description || document.type?.text || 
                document.type?.coding?.[0]?.display || 'Clinical Document';
  const status = document.status || 'current';
  const isCurrent = status === 'current';
  
  const getDocumentIcon = () => {
    const mimeType = document.content?.[0]?.attachment?.contentType;
    if (mimeType?.includes('pdf')) return <PictureAsPdfIcon fontSize="small" />;
    if (mimeType?.includes('image')) return <ImageIcon fontSize="small" />;
    return <DescriptionIcon fontSize="small" />;
  };
  
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 0,  // Sharp corners
        border: '1px solid',
        borderColor: 'divider',
        borderLeft: `4px solid ${isCurrent ? theme.palette.grey[600] : theme.palette.grey[400]}`,
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
            {getDocumentIcon()}
            <Typography variant="body1" fontWeight={600}>
              {title}
            </Typography>
            <Chip 
              label={status} 
              size="small" 
              color={isCurrent ? 'default' : 'warning'}
            />
            {document.docStatus && (
              <Chip 
                label={document.docStatus} 
                size="small" 
                variant="outlined"
              />
            )}
          </Stack>
          
          <Stack spacing={0.5}>
            <Typography variant="caption" color="text.secondary">
              <strong>Date:</strong> {document.date ? 
                format(new Date(document.date), 'MMM d, yyyy h:mm a') : 
                'Unknown'}
            </Typography>
            {document.author?.[0] && (
              <Typography variant="caption" color="text.secondary">
                <strong>Author:</strong> {document.author[0].display || 'Unknown'}
              </Typography>
            )}
            {document.content?.[0]?.attachment && (
              <Typography variant="caption" color="text.secondary">
                <strong>Type:</strong> {document.content[0].attachment.contentType || 'Unknown'} 
                {document.content[0].attachment.size && 
                  ` • ${Math.round(document.content[0].attachment.size / 1024)} KB`}
              </Typography>
            )}
            {document.context?.encounter?.[0] && (
              <Typography variant="caption" color="text.secondary">
                <strong>Encounter:</strong> {document.context.encounter[0].display || 
                  'Related encounter'}
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

export default React.memo(ChartReviewTabOptimized);