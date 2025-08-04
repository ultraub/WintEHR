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
// Enhanced UX components
import { 
  CardSkeleton, 
  GridSkeleton, 
  FadeInContainer, 
  StaggeredFadeIn,
  LoadingOverlay 
} from './components/EnhancedLoadingStates';
import { 
  InteractiveIconButton, 
  InteractiveButton, 
  InteractiveChip,
  RichTooltip,
  CopyButton,
  AnimatedCounter 
} from './components/EnhancedInteractions';
import {
  EmptyConditions,
  EmptyMedications,
  EmptyAllergies,
  EmptyImmunizations,
  EmptyProcedures,
  EmptyCarePlans,
  EmptyDocuments,
  EmptyEncounters,
  EmptyVitals
} from './components/EnhancedEmptyStates';
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
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
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
    realTimeUpdates: true  // Enable real-time updates
  });
  
  // View and filter states
  const [viewMode, setViewMode] = useState('dashboard'); // dashboard, timeline, list
  const [dateRange, setDateRange] = useState('all'); // all, 30d, 90d, 1y
  const [showInactive, setShowInactive] = useState(true); // Changed to true - show all by default
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]); // Fixed: Empty array instead of ['all'] to prevent phantom filter
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
  
  // Performance optimization - limit visible items
  const [visibleItems, setVisibleItems] = useState({
    conditions: 10,
    medications: 10,
    allergies: 10,
    immunizations: 10,
    procedures: 10,
    observations: 10,
    carePlans: 10,
    documents: 10
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
  
  // Filter data by date range - stabilized with useCallback
  const filteredByDate = useCallback((resource) => {
    if (dateRange === 'all') return true;
    
    const days = {
      '30d': 30,
      '90d': 90,
      '1y': 365
    }[dateRange];
    
    const cutoffDate = subDays(new Date(), days);
    
    const resourceDate = resource.recordedDate || 
                        resource.onsetDateTime || 
                        resource.authoredOn || 
                        resource.occurrenceDateTime ||
                        resource.effectiveDateTime ||
                        resource.performedDateTime ||  // For Procedures
                        resource.performedPeriod?.start ||  // For Procedures with period
                        resource.date ||  // For DocumentReference
                        resource.created ||  // For CarePlan
                        resource.period?.start ||  // For Encounters and others
                        resource.issued;  // For some Observations
    
    if (!resourceDate) return true;
    return new Date(resourceDate) >= cutoffDate;
  }, [dateRange]);
  
  // Process and categorize data with FHIR R4 structure
  const processedData = useMemo(() => {
    // Guard against undefined data
    if (!conditions || !medications || !allergies || !observations || !procedures || !encounters || !immunizations || !carePlans || !documentReferences) {
      return {
        activeConditions: [],
        inactiveConditions: [],
        conditionsByCategory: {},
        activeMedications: [],
        inactiveMedications: [],
        medicationsByIntent: {},
        criticalAllergies: [],
        nonCriticalAllergies: [],
        recentVitals: [],
        recentEncounters: [],
        procedures: [],
        immunizations: [],
        carePlans: [],
        documentReferences: [],
        filteredConditions: [],
        filteredMedications: [],
        filteredAllergies: []
      };
    }
    // Filter conditions based on showInactive toggle
    const filteredConditions = showInactive 
      ? conditions.filter(filteredByDate)
      : conditions.filter(c => c.clinicalStatus?.coding?.[0]?.code === 'active' && filteredByDate(c));
    
    // Active vs Inactive conditions using FHIR R4 clinicalStatus
    const activeConditions = filteredConditions.filter(c => 
      c.clinicalStatus?.coding?.[0]?.code === 'active'
    );
    const inactiveConditions = filteredConditions.filter(c => 
      c.clinicalStatus?.coding?.[0]?.code !== 'active'
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
    
    // Filter medications based on showInactive toggle
    const filteredMedications = showInactive 
      ? medications.filter(filteredByDate)
      : medications.filter(m => ['active', 'on-hold'].includes(m.status) && filteredByDate(m));
    
    // Medications by FHIR R4 status and intent
    const activeMedications = filteredMedications.filter(m => 
      ['active', 'on-hold'].includes(m.status)
    );
    const inactiveMedications = filteredMedications.filter(m => 
      !['active', 'on-hold'].includes(m.status)
    );
    
    // Group medications by FHIR R4 intent
    const medicationsByIntent = {
      order: activeMedications.filter(m => m.intent === 'order'),
      plan: activeMedications.filter(m => m.intent === 'plan'),
      proposal: activeMedications.filter(m => m.intent === 'proposal')
    };
    
    // Filter allergies based on showInactive toggle
    const filteredAllergies = showInactive 
      ? allergies.filter(filteredByDate)
      : allergies.filter(a => a.clinicalStatus?.coding?.[0]?.code === 'active' && filteredByDate(a));
    
    // Allergies by FHIR R4 criticality
    const criticalAllergies = filteredAllergies.filter(a => 
      a.criticality === 'high'
    );
    const nonCriticalAllergies = filteredAllergies.filter(a => 
      a.criticality !== 'high'
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
    
    const result = {
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
      documentReferences: documentReferences.filter(filteredByDate),
      // Add filtered versions for summary cards
      filteredConditions,
      filteredMedications,
      filteredAllergies
    };
    
    
    return result;
  }, [conditions, medications, allergies, observations, procedures, encounters, immunizations, carePlans, documentReferences, showInactive, dateRange]);
  
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
  
  // Handler functions - memoized to prevent re-renders
  const handleOpenDialog = useCallback((type, resource = null) => {
    setSelectedResource(resource);
    setOpenDialogs(prev => ({ ...prev, [type]: true }));
  }, []);
  
  const handleCloseDialog = useCallback((type) => {
    setOpenDialogs(prev => ({ ...prev, [type]: false }));
    setSelectedResource(null);
  }, []);
  
  const { updateResource, addResource } = useFHIRResource();
  
  const handleResourceSaved = useCallback(async (resource) => {
    try {
      // Determine if this is an update or create based on whether the resource has an ID
      const isUpdate = resource.id && selectedResource?.id === resource.id;
      let result;
      
      if (isUpdate) {
        // Update existing resource
        result = await fhirClient.update(resource.resourceType, resource.id, resource);
        // Update the FHIRResourceContext
        updateResource(resource.resourceType, resource.id, result);
        enqueueSnackbar(`${resource.resourceType} updated successfully`, { variant: 'success' });
      } else {
        // Create new resource
        result = await fhirClient.create(resource.resourceType, resource);
        // Add to the FHIRResourceContext
        addResource(result);
        enqueueSnackbar(`${resource.resourceType} created successfully`, { variant: 'success' });
      }
      
      // Refresh data after save
      console.log('[ChartReviewTabOptimized] Calling refresh after save');
      refresh();
      
      // Return the saved resource
      return result;
    } catch (error) {
      console.error('Error saving resource:', error);
      enqueueSnackbar(`Failed to save ${resource.resourceType}. Please try again.`, { variant: 'error' });
      throw error; // Re-throw to let dialog handle error state
    }
  }, [selectedResource, enqueueSnackbar, refresh]);
  
  // Search and filter handlers
  const handleSearch = useCallback((query) => {
    setSearchQuery(query);
    searchResources(query);
  }, [searchResources]);

  const handleDateRangeChange = useCallback((event, newRange) => {
    if (newRange) {
      setDateRange(newRange);
    }
  }, []);

  const toggleSection = useCallback((section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  }, []);

  if (loading) {
    return (
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', p: { xs: 1, sm: 2 } }}>
        {/* Summary Cards Skeleton */}
        <Grid container spacing={1} sx={{ mb: 2 }}>
          {Array.from({ length: 4 }).map((_, index) => (
            <Grid item xs={12} md={3} key={index}>
              <CardSkeleton lines={2} showChips height={120} />
            </Grid>
          ))}
        </Grid>
        
        {/* Main Content Grid Skeleton */}
        <GridSkeleton count={6} columns={2} cardProps={{ lines: 4, showAvatar: true, showChips: true }} />
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
          <FadeInContainer>
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
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      boxShadow: theme.shadows[2],
                      transform: 'translateY(-2px)'
                    }
                  }}>
                    <CardContent>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Box>
                          <Typography color="text.secondary" variant="caption">
                            {showInactive ? 'All Conditions' : 'Active Conditions'}
                          </Typography>
                          <AnimatedCounter 
                            value={showInactive ? processedData.filteredConditions.length : processedData.activeConditions.length}
                            variant="h3"
                            duration={800}
                          />
                          <Stack spacing={0.5} mt={1}>
                            <Stack direction="row" spacing={0.5}>
                              {stats.conditions.active > 0 && (
                                <Chip 
                                  label={`${stats.conditions.active} Active`} 
                                  size="small" 
                                  sx={{ 
                                    fontSize: '0.6875rem',
                                    borderRadius: 0,
                                    backgroundColor: alpha(theme.palette.error.main, 0.1),
                                    color: theme.palette.error.main,
                                    fontWeight: 600
                                  }} 
                                />
                              )}
                              {stats.conditions.resolved > 0 && (
                                <Chip 
                                  label={`${stats.conditions.resolved} Resolved`} 
                                  size="small" 
                                  sx={{ 
                                    fontSize: '0.6875rem',
                                    borderRadius: 0,
                                    backgroundColor: alpha(theme.palette.success.main, 0.1),
                                    color: theme.palette.success.main,
                                    fontWeight: 600
                                  }} 
                                />
                              )}
                            </Stack>
                          </Stack>
                        </Box>
                        <Avatar sx={{ 
                          bgcolor: alpha(theme.palette.error.main, 0.1),
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            bgcolor: alpha(theme.palette.error.main, 0.2)
                          }
                        }}>
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
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      boxShadow: theme.shadows[2],
                      transform: 'translateY(-2px)'
                    }
                  }}>
                    <CardContent>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Box>
                          <Typography color="text.secondary" variant="caption">
                            {showInactive ? 'All Medications' : 'Active Medications'}
                          </Typography>
                          <AnimatedCounter 
                            value={showInactive ? processedData.filteredMedications.length : processedData.activeMedications.length}
                            variant="h3"
                            duration={800}
                          />
                          <Stack direction="row" spacing={0.5} mt={1}>
                            {processedData.medicationsByIntent.order?.length > 0 && (
                              <InteractiveChip 
                                label={`${processedData.medicationsByIntent.order.length} Orders`}
                                size="small"
                                color="primary"
                                hoverEffect="scale"
                                tooltip="Active medication orders"
                              />
                            )}
                          </Stack>
                        </Box>
                        <Avatar sx={{ 
                          bgcolor: alpha(theme.palette.primary.main, 0.1),
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            bgcolor: alpha(theme.palette.primary.main, 0.2)
                          }
                        }}>
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
                            {processedData.filteredAllergies.length}
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
                          {stats.conditions.active > 0 && (
                            <Chip 
                              label={`${stats.conditions.active} Active`} 
                              size="small" 
                              color="error"
                              sx={{
                                borderRadius: 0,
                                fontWeight: 600
                              }}
                            />
                          )}
                          {stats.conditions.resolved > 0 && (
                            <Chip 
                              label={`${stats.conditions.resolved} Resolved`} 
                              size="small" 
                              color="success"
                              sx={{
                                borderRadius: 0,
                                fontWeight: 600
                              }}
                            />
                          )}
                        </Stack>
                        <InteractiveButton
                          startIcon={<AddIcon />}
                          size="small"
                          onClick={() => handleOpenDialog('condition')}
                          hoverEffect="scale"
                          tooltip="Add new condition"
                        >
                          Add
                        </InteractiveButton>
                      </Stack>
                      
                      {(showInactive ? conditions.length : processedData.activeConditions.length) === 0 ? (
                        <EmptyConditions onAdd={() => handleOpenDialog('condition')} />
                      ) : (
                        <Box sx={{ 
                          maxHeight: 400, 
                          overflowY: 'auto',
                          overflowX: 'hidden',
                          pr: 0.5,
                          '&::-webkit-scrollbar': {
                            width: '8px',
                          },
                          '&::-webkit-scrollbar-track': {
                            background: 'transparent',
                          },
                          '&::-webkit-scrollbar-thumb': {
                            background: theme.palette.divider,
                            borderRadius: '4px',
                            '&:hover': {
                              background: theme.palette.action.disabled,
                            },
                          },
                        }}>
                          <StaggeredFadeIn staggerDelay={30}>
                            {(showInactive 
                              ? [...processedData.activeConditions, ...processedData.inactiveConditions]
                              : processedData.activeConditions
                            ).slice(0, visibleItems.conditions).map((condition, index) => (
                              <EnhancedConditionCard
                                key={condition.id}
                                condition={condition}
                                onEdit={() => handleOpenDialog('condition', condition)}
                                isAlternate={index % 2 === 1}  // For alternating rows
                              />
                            ))}
                          </StaggeredFadeIn>
                          {(showInactive 
                            ? processedData.activeConditions.length + processedData.inactiveConditions.length
                            : processedData.activeConditions.length
                          ) > visibleItems.conditions && (
                            <Box sx={{ textAlign: 'center', mt: 2 }}>
                              <Button
                                size="small"
                                onClick={() => setVisibleItems(prev => ({ ...prev, conditions: prev.conditions + 10 }))}
                                sx={{ textTransform: 'none' }}
                              >
                                Show More ({(showInactive 
                                  ? processedData.activeConditions.length + processedData.inactiveConditions.length
                                  : processedData.activeConditions.length
                                ) - visibleItems.conditions} more)
                              </Button>
                            </Box>
                          )}
                        </Box>
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
                        <InteractiveButton
                          startIcon={<AddIcon />}
                          size="small"
                          onClick={() => handleOpenDialog('medication')}
                          hoverEffect="scale"
                          tooltip="Prescribe new medication"
                        >
                          Add
                        </InteractiveButton>
                      </Stack>
                      
                      {(showInactive ? medications.length : processedData.activeMedications.length) === 0 ? (
                        <EmptyMedications onAdd={() => handleOpenDialog('medication')} />
                      ) : (
                        <Box sx={{ 
                          maxHeight: 400, 
                          overflowY: 'auto',
                          overflowX: 'hidden',
                          pr: 0.5,
                          '&::-webkit-scrollbar': {
                            width: '8px',
                          },
                          '&::-webkit-scrollbar-track': {
                            background: 'transparent',
                          },
                          '&::-webkit-scrollbar-thumb': {
                            background: theme.palette.divider,
                            borderRadius: '4px',
                            '&:hover': {
                              background: theme.palette.action.disabled,
                            },
                          },
                        }}>
                          <StaggeredFadeIn staggerDelay={30}>
                            {(showInactive 
                              ? [...processedData.activeMedications, ...processedData.inactiveMedications]
                              : processedData.activeMedications
                            ).slice(0, visibleItems.medications).map((medication, index) => (
                              <EnhancedMedicationCard
                                key={medication.id}
                                medication={medication}
                                onEdit={() => handleOpenDialog('medication', medication)}
                                isAlternate={index % 2 === 1}  // For alternating rows
                              />
                            ))}
                          </StaggeredFadeIn>
                          {(showInactive 
                            ? processedData.activeMedications.length + processedData.inactiveMedications.length
                            : processedData.activeMedications.length
                          ) > visibleItems.medications && (
                            <Box sx={{ textAlign: 'center', mt: 2 }}>
                              <Button
                                size="small"
                                onClick={() => setVisibleItems(prev => ({ ...prev, medications: prev.medications + 10 }))}
                                sx={{ textTransform: 'none' }}
                              >
                                Show More ({(showInactive 
                                  ? processedData.activeMedications.length + processedData.inactiveMedications.length
                                  : processedData.activeMedications.length
                                ) - visibleItems.medications} more)
                              </Button>
                            </Box>
                          )}
                        </Box>
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
                        <InteractiveButton
                          startIcon={<AddIcon />}
                          size="small"
                          onClick={() => handleOpenDialog('allergy')}
                          hoverEffect="scale"
                          tooltip="Document new allergy"
                        >
                          Add
                        </InteractiveButton>
                      </Stack>
                      
                      {(processedData.criticalAllergies.length + processedData.nonCriticalAllergies.length) === 0 ? (
                        <EmptyAllergies onAdd={() => handleOpenDialog('allergy')} />
                      ) : (
                        <Box sx={{ 
                          maxHeight: 400, 
                          overflowY: 'auto',
                          overflowX: 'hidden',
                          pr: 0.5,
                          '&::-webkit-scrollbar': {
                            width: '8px',
                          },
                          '&::-webkit-scrollbar-track': {
                            background: 'transparent',
                          },
                          '&::-webkit-scrollbar-thumb': {
                            background: theme.palette.divider,
                            borderRadius: '4px',
                            '&:hover': {
                              background: theme.palette.action.disabled,
                            },
                          },
                        }}>
                          <StaggeredFadeIn staggerDelay={50}>
                            {[...processedData.criticalAllergies, ...processedData.nonCriticalAllergies]
                              .slice(0, visibleItems.allergies)
                              .map((allergy, index) => (
                                <EnhancedAllergyCard
                                  key={allergy.id}
                                  allergy={allergy}
                                  onEdit={() => handleOpenDialog('allergy', allergy)}
                                  isAlternate={index % 2 === 1}  // For alternating rows
                                />
                              ))}
                          </StaggeredFadeIn>
                          {[...processedData.criticalAllergies, ...processedData.nonCriticalAllergies].length > visibleItems.allergies && (
                            <Box sx={{ textAlign: 'center', mt: 2 }}>
                              <Button
                                onClick={() => setVisibleItems(prev => ({ ...prev, allergies: prev.allergies + 10 }))}
                                sx={{ textTransform: 'none' }}
                              >
                                Show More ({[...processedData.criticalAllergies, ...processedData.nonCriticalAllergies].length - visibleItems.allergies} more)
                              </Button>
                            </Box>
                          )}
                        </Box>
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
                        <Box sx={{ 
                          maxHeight: 400, 
                          overflowY: 'auto',
                          overflowX: 'hidden',
                          pr: 0.5,
                          '&::-webkit-scrollbar': {
                            width: '8px',
                          },
                          '&::-webkit-scrollbar-track': {
                            background: 'transparent',
                          },
                          '&::-webkit-scrollbar-thumb': {
                            background: theme.palette.divider,
                            borderRadius: '4px',
                            '&:hover': {
                              background: theme.palette.action.disabled,
                            },
                          },
                        }}>
                          <Stack spacing={0.5}>
                            {processedData.immunizations.slice(0, visibleItems.immunizations).map((immunization, index) => (
                              <EnhancedImmunizationCard
                                key={immunization.id}
                                immunization={immunization}
                                onEdit={() => handleOpenDialog('immunization', immunization)}
                                isAlternate={index % 2 === 1}  // For alternating rows
                              />
                            ))}
                          </Stack>
                          {processedData.immunizations.length > visibleItems.immunizations && (
                            <Box sx={{ textAlign: 'center', mt: 2 }}>
                              <Button
                                onClick={() => setVisibleItems(prev => ({ ...prev, immunizations: prev.immunizations + 10 }))}
                                sx={{ textTransform: 'none' }}
                              >
                                Show More ({processedData.immunizations.length - visibleItems.immunizations} more)
                              </Button>
                            </Box>
                          )}
                        </Box>
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
                        <Box sx={{ 
                          maxHeight: 400, 
                          overflowY: 'auto',
                          overflowX: 'hidden',
                          pr: 0.5,
                          '&::-webkit-scrollbar': {
                            width: '8px',
                          },
                          '&::-webkit-scrollbar-track': {
                            background: 'transparent',
                          },
                          '&::-webkit-scrollbar-thumb': {
                            background: theme.palette.divider,
                            borderRadius: '4px',
                            '&:hover': {
                              background: theme.palette.action.disabled,
                            },
                          },
                        }}>
                          <Stack spacing={0.5}>
                            {processedData.procedures.slice(0, visibleItems.procedures).map((procedure, index) => (
                              <EnhancedProcedureCard
                                key={procedure.id}
                                procedure={procedure}
                                onEdit={() => handleOpenDialog('procedure', procedure)}
                                isAlternate={procedure.id.charCodeAt(procedure.id.length - 1) % 2 === 1}  // Stable alternating based on ID
                              />
                            ))}
                          </Stack>
                          {processedData.procedures.length > visibleItems.procedures && (
                            <Box sx={{ textAlign: 'center', mt: 2 }}>
                              <Button
                                onClick={() => setVisibleItems(prev => ({ ...prev, procedures: prev.procedures + 10 }))}
                                sx={{ textTransform: 'none' }}
                              >
                                Show More ({processedData.procedures.length - visibleItems.procedures} more)
                              </Button>
                            </Box>
                          )}
                        </Box>
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
                        <Box sx={{ 
                          maxHeight: 400, 
                          overflowY: 'auto',
                          overflowX: 'hidden',
                          pr: 0.5,
                          '&::-webkit-scrollbar': {
                            width: '8px',
                          },
                          '&::-webkit-scrollbar-track': {
                            background: 'transparent',
                          },
                          '&::-webkit-scrollbar-thumb': {
                            background: theme.palette.divider,
                            borderRadius: '4px',
                            '&:hover': {
                              background: theme.palette.action.disabled,
                            },
                          },
                        }}>
                          <Stack spacing={0.5}>
                            {processedData.carePlans.slice(0, visibleItems.carePlans).map((carePlan, index) => (
                              <EnhancedCarePlanCard
                                key={carePlan.id}
                                carePlan={carePlan}
                                onEdit={() => handleOpenDialog('carePlan', carePlan)}
                                isAlternate={carePlan.id.charCodeAt(carePlan.id.length - 1) % 2 === 1}  // Stable alternating based on ID
                              />
                            ))}
                          </Stack>
                          {processedData.carePlans.length > visibleItems.carePlans && (
                            <Box sx={{ textAlign: 'center', mt: 2 }}>
                              <Button
                                onClick={() => setVisibleItems(prev => ({ ...prev, carePlans: prev.carePlans + 5 }))}
                                sx={{ textTransform: 'none' }}
                              >
                                Show More ({processedData.carePlans.length - visibleItems.carePlans} more)
                              </Button>
                            </Box>
                          )}
                        </Box>
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
                        <Box sx={{ 
                          maxHeight: 400, 
                          overflowY: 'auto',
                          overflowX: 'hidden',
                          pr: 0.5,
                          '&::-webkit-scrollbar': {
                            width: '8px',
                          },
                          '&::-webkit-scrollbar-track': {
                            background: 'transparent',
                          },
                          '&::-webkit-scrollbar-thumb': {
                            background: theme.palette.divider,
                            borderRadius: '4px',
                            '&:hover': {
                              background: theme.palette.action.disabled,
                            },
                          },
                        }}>
                          <Stack spacing={0.5}>
                            {processedData.documentReferences.slice(0, visibleItems.documents).map((document, index) => (
                              <EnhancedDocumentCard
                                key={document.id}
                                document={document}
                                onEdit={() => handleOpenDialog('document', document)}
                                isAlternate={index % 2 === 1}  // For alternating rows
                              />
                            ))}
                          </Stack>
                          {processedData.documentReferences.length > visibleItems.documents && (
                            <Box sx={{ textAlign: 'center', mt: 2 }}>
                              <Button
                                onClick={() => setVisibleItems(prev => ({ ...prev, documents: prev.documents + 5 }))}
                                sx={{ textTransform: 'none' }}
                              >
                                Show More ({processedData.documentReferences.length - visibleItems.documents} more)
                              </Button>
                            </Box>
                          )}
                        </Box>
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
                        <Box sx={{ 
                          maxHeight: 400, 
                          overflowY: 'auto',
                          overflowX: 'hidden',
                          pr: 0.5,
                          '&::-webkit-scrollbar': {
                            width: '8px',
                          },
                          '&::-webkit-scrollbar-track': {
                            background: 'transparent',
                          },
                          '&::-webkit-scrollbar-thumb': {
                            background: theme.palette.divider,
                            borderRadius: '4px',
                            '&:hover': {
                              background: theme.palette.action.disabled,
                            },
                          },
                        }}>
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
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          </FadeInContainer>
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
  const severity = condition.severity?.coding?.[0]?.display || condition.severity?.text || null;
  const stage = condition.stage?.[0]?.summary?.coding?.[0]?.display || condition.stage?.[0]?.summary?.text || null;
  const verification = condition.verificationStatus?.coding?.[0]?.code;
  const clinicalStatus = condition.clinicalStatus?.coding?.[0]?.code;
  const isActive = clinicalStatus === 'active';
  
  // Additional FHIR fields for enhanced clinical utility
  const bodySite = condition.bodySite?.[0]?.text || condition.bodySite?.[0]?.coding?.[0]?.display || null;
  const category = condition.category?.[0]?.coding?.[0]?.display || condition.category?.[0]?.text || null;
  const asserter = condition.asserter?.display;
  const recorder = condition.recorder?.display;
  const recordedDate = condition.recordedDate;
  const abatementDate = condition.abatementDateTime || condition.abatementAge?.value;
  const evidence = condition.evidence?.[0]?.detail?.[0]?.display || condition.evidence?.[0]?.code?.[0]?.text || null;
  const clinicalCode = condition.code?.coding?.[0]?.code;
  const codeSystem = condition.code?.coding?.[0]?.system;
  
  // Format identifiers if present
  const identifiers = condition.identifier?.map(id => `${id.type?.text || 'ID'}: ${id.value}`).join(', ');
  
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
        borderLeftColor: clinicalStatus === 'active' ? theme.palette.error.main :
                        clinicalStatus === 'resolved' ? theme.palette.success.main :
                        clinicalStatus === 'remission' ? theme.palette.info.main :
                        clinicalStatus === 'recurrence' ? theme.palette.warning.main :
                        clinicalTokens.severity[severityLevel]?.color || theme.palette.grey[300],
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
            <RichTooltip
              title="Condition Details"
              content={
                <Box>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>Full Name:</strong> {condition.code?.text || condition.code?.coding?.[0]?.display || 'Unknown condition'}
                  </Typography>
                  {clinicalCode && (
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Code:</strong> {clinicalCode}
                    </Typography>
                  )}
                  {category && (
                    <Typography variant="body2">
                      <strong>Category:</strong> {category}
                    </Typography>
                  )}
                </Box>
              }
            >
              <Typography 
                variant="body1" 
                fontWeight={600}
                sx={{ 
                  cursor: 'help',
                  maxWidth: '300px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {condition.code?.text || condition.code?.coding?.[0]?.display || 'Unknown condition'}
              </Typography>
            </RichTooltip>
            {/* Clinical Status */}
            {clinicalStatus && (
              <Chip 
                label={clinicalStatus === 'active' ? 'Active' : 
                       clinicalStatus === 'resolved' ? 'Resolved' : 
                       clinicalStatus === 'inactive' ? 'Inactive' : 
                       clinicalStatus === 'remission' ? 'Remission' : 
                       clinicalStatus === 'recurrence' ? 'Recurrence' : clinicalStatus}
                size="small" 
                color={clinicalStatus === 'active' ? 'error' : 
                       clinicalStatus === 'resolved' ? 'success' : 
                       clinicalStatus === 'remission' ? 'info' : 
                       clinicalStatus === 'recurrence' ? 'warning' : 'default'}
                sx={{ 
                  fontWeight: 600,
                  borderRadius: 0,
                  ...(clinicalStatus === 'active' && {
                    backgroundColor: alpha(theme.palette.error.main, 0.9),
                    color: 'white'
                  }),
                  ...(clinicalStatus === 'resolved' && {
                    backgroundColor: alpha(theme.palette.success.main, 0.9),
                    color: 'white'
                  })
                }}
              />
            )}
            {verification === 'confirmed' && (
              <Chip label="Confirmed" size="small" variant="outlined" color="success" sx={{ borderRadius: 0 }} />
            )}
            {category && (
              <Chip label={category} size="small" variant="outlined" sx={{ borderRadius: 0 }} />
            )}
          </Stack>
          
          {/* Clinical codes and identifiers */}
          {(clinicalCode || identifiers) && (
            <Stack direction="row" spacing={2} alignItems="center" mb={0.5}>
              {clinicalCode && (
                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                  <strong>Code:</strong> {clinicalCode}
                  {codeSystem?.includes('snomed') && ' (SNOMED)'}
                  {codeSystem?.includes('icd') && ' (ICD)'}
                </Typography>
              )}
              {identifiers && (
                <Typography variant="caption" color="text.secondary">
                  <strong>ID:</strong> {identifiers}
                </Typography>
              )}
            </Stack>
          )}
          
          {/* Clinical details */}
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
            <Typography variant="caption" color="text.secondary">
              <strong>Onset:</strong> {condition.onsetDateTime ? 
                format(new Date(condition.onsetDateTime), 'MMM d, yyyy') : 
                condition.onsetAge?.value ? `Age ${condition.onsetAge.value}` : 
                'Unknown'}
            </Typography>
            
            {abatementDate && (
              <Typography variant="caption" color="text.secondary">
                <strong>Resolved:</strong> {typeof abatementDate === 'string' ? 
                  format(new Date(abatementDate), 'MMM d, yyyy') : 
                  `Age ${abatementDate}`}
              </Typography>
            )}
            
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
            
            {bodySite && (
              <Typography variant="caption" color="text.secondary">
                <strong>Site:</strong> {bodySite}
              </Typography>
            )}
          </Stack>
          
          {/* Clinical team and dates */}
          {(asserter || recorder || recordedDate) && (
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 0.5 }} flexWrap="wrap">
              {asserter && (
                <Typography variant="caption" color="text.secondary">
                  <strong>Asserted by:</strong> {asserter}
                </Typography>
              )}
              {recorder && recorder !== asserter && (
                <Typography variant="caption" color="text.secondary">
                  <strong>Recorded by:</strong> {recorder}
                </Typography>
              )}
              {recordedDate && (
                <Typography variant="caption" color="text.secondary">
                  <strong>Recorded:</strong> {format(new Date(recordedDate), 'MMM d, yyyy')}
                </Typography>
              )}
            </Stack>
          )}
          
          {/* Evidence and notes */}
          {evidence && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              <strong>Evidence:</strong> {evidence}
            </Typography>
          )}
          
          {condition.note?.[0]?.text && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              <strong>Notes:</strong> {condition.note[0].text}
            </Typography>
          )}
        </Box>
        
        <InteractiveIconButton 
          size="small" 
          onClick={onEdit}
          tooltip="Edit condition"
          hoverEffect="scale"
        >
          <EditIcon fontSize="small" />
        </InteractiveIconButton>
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
  
  // Additional FHIR fields for enhanced clinical utility
  const requester = medication.requester?.display;
  const reasonReference = medication.reasonReference?.[0]?.display;
  const courseOfTherapy = medication.courseOfTherapyType?.text || medication.courseOfTherapyType?.coding?.[0]?.display || null;
  const dispenseRequest = medication.dispenseRequest;
  const substitution = medication.substitution;
  const medicationCode = medication.medicationCodeableConcept?.coding?.[0]?.code;
  const medicationSystem = medication.medicationCodeableConcept?.coding?.[0]?.system;
  const identifiers = medication.identifier?.map(id => `${id.type?.text || 'ID'}: ${id.value}`).join(', ');
  const groupIdentifier = medication.groupIdentifier?.value;
  const priorPrescription = medication.priorPrescription?.display;
  const detectedIssue = medication.detectedIssue?.[0]?.display;
  
  const cardStyles = getClinicalCardStyles(isActive ? 'normal' : 'low', 1, true);
  
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 0,  // Sharp corners
        border: '1px solid',
        borderColor: 'divider',
        borderLeft: '4px solid',
        borderLeftColor: medication.status === 'active' ? theme.palette.primary.main :
                        medication.status === 'stopped' ? theme.palette.error.main :
                        medication.status === 'completed' ? theme.palette.success.main :
                        medication.status === 'on-hold' ? theme.palette.warning.main :
                        theme.palette.grey[300],
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
            {/* Medication Status */}
            <Chip 
              label={medication.status === 'active' ? 'Active' : 
                     medication.status === 'completed' ? 'Completed' : 
                     medication.status === 'stopped' ? 'Stopped' : 
                     medication.status === 'on-hold' ? 'On Hold' : 
                     medication.status === 'cancelled' ? 'Cancelled' : 
                     medication.status === 'entered-in-error' ? 'Error' : medication.status}
              size="small" 
              color={medication.status === 'active' ? 'primary' : 
                     medication.status === 'completed' ? 'success' : 
                     medication.status === 'stopped' ? 'error' : 
                     medication.status === 'on-hold' ? 'warning' : 
                     medication.status === 'cancelled' ? 'default' : 'default'}
              sx={{ 
                fontWeight: 600,
                borderRadius: 0,
                ...(medication.status === 'active' && {
                  backgroundColor: alpha(theme.palette.primary.main, 0.9),
                  color: 'white'
                }),
                ...(medication.status === 'stopped' && {
                  backgroundColor: alpha(theme.palette.error.main, 0.9),
                  color: 'white'
                }),
                ...(medication.status === 'completed' && {
                  backgroundColor: alpha(theme.palette.success.main, 0.9),
                  color: 'white'
                })
              }}
            />
            {medication.intent && (
              <Chip 
                label={medication.intent} 
                size="small" 
                variant="outlined"
                sx={{ borderRadius: 0 }}
              />
            )}
            {courseOfTherapy && (
              <Chip 
                label={courseOfTherapy} 
                size="small" 
                variant="outlined"
                sx={{ fontSize: '0.7rem', borderRadius: 0 }}
              />
            )}
          </Stack>
          
          {/* Medication codes and identifiers */}
          {(medicationCode || identifiers || groupIdentifier) && (
            <Stack direction="row" spacing={2} alignItems="center" mb={0.5} flexWrap="wrap">
              {medicationCode && (
                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                  <strong>Code:</strong> {medicationCode}
                  {medicationSystem?.includes('rxnorm') && ' (RxNorm)'}
                  {medicationSystem?.includes('ndc') && ' (NDC)'}
                </Typography>
              )}
              {identifiers && (
                <Typography variant="caption" color="text.secondary">
                  <strong>ID:</strong> {identifiers}
                </Typography>
              )}
              {groupIdentifier && (
                <Typography variant="caption" color="text.secondary">
                  <strong>Group:</strong> {groupIdentifier}
                </Typography>
              )}
            </Stack>
          )}
          
          <Stack spacing={0.5}>
            {dosage && (
              <Typography variant="caption" color="text.secondary">
                <strong>Dosage:</strong> {dosage.text || 
                  `${dosage.doseAndRate?.[0]?.doseQuantity?.value} ${dosage.doseAndRate?.[0]?.doseQuantity?.unit} ${dosage.timing?.repeat?.frequency ? `${dosage.timing.repeat.frequency}x daily` : ''}`}
              </Typography>
            )}
            {dosage?.route && (
              <Typography variant="caption" color="text.secondary">
                <strong>Route:</strong> {dosage.route.text || dosage.route.coding?.[0]?.display || 'Unknown'}
              </Typography>
            )}
            
            {/* Prescriber and timing */}
            <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
              {medication.authoredOn && (
                <Typography variant="caption" color="text.secondary">
                  <strong>Prescribed:</strong> {format(new Date(medication.authoredOn), 'MMM d, yyyy')}
                </Typography>
              )}
              {requester && (
                <Typography variant="caption" color="text.secondary">
                  <strong>Prescriber:</strong> {requester}
                </Typography>
              )}
            </Stack>
            
            {/* Clinical context */}
            {(medication.reasonCode?.[0] || reasonReference) && (
              <Typography variant="caption" color="text.secondary">
                <strong>Reason:</strong> {medication.reasonCode?.[0]?.text || medication.reasonCode?.[0]?.coding?.[0]?.display || reasonReference}
              </Typography>
            )}
            
            {/* Dispense information */}
            {dispenseRequest && (
              <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                {dispenseRequest.quantity && (
                  <Typography variant="caption" color="text.secondary">
                    <strong>Quantity:</strong> {dispenseRequest.quantity.value} {dispenseRequest.quantity.unit}
                  </Typography>
                )}
                {dispenseRequest.numberOfRepeatsAllowed !== undefined && (
                  <Typography variant="caption" color="text.secondary">
                    <strong>Refills:</strong> {dispenseRequest.numberOfRepeatsAllowed}
                  </Typography>
                )}
                {dispenseRequest.expectedSupplyDuration && (
                  <Typography variant="caption" color="text.secondary">
                    <strong>Supply:</strong> {dispenseRequest.expectedSupplyDuration.value} days
                  </Typography>
                )}
              </Stack>
            )}
            
            {/* Substitution and alerts */}
            {substitution && (
              <Typography variant="caption" color="text.secondary">
                <strong>Substitution:</strong> {typeof substitution.allowedBoolean === 'boolean' ? 
                  (substitution.allowedBoolean ? 'Allowed' : 'Not allowed') : 
                  (substitution.allowedCodeableConcept?.text || substitution.allowedCodeableConcept?.coding?.[0]?.display || 'Unknown')}
              </Typography>
            )}
            
            {detectedIssue && (
              <Typography variant="caption" color="warning.main">
                <strong>⚠ Issue:</strong> {detectedIssue}
              </Typography>
            )}
            
            {priorPrescription && (
              <Typography variant="caption" color="text.secondary">
                <strong>Replaces:</strong> {priorPrescription}
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
  
  // Debug logging to catch the issue
  if (allergy.category && typeof allergy.category === 'object' && !Array.isArray(allergy.category)) {
    // allergy.category is an object, not an array
  }
  if (allergy.category?.[0] && typeof allergy.category[0] === 'object' && 
      !allergy.category[0].coding && !allergy.category[0].text) {
    // allergy.category[0] is missing coding and text
  }
  
  const criticality = allergy.criticality || 'low';
  const criticalityColor = {
    high: 'error',
    low: 'success',
    'unable-to-assess': 'warning'
  }[criticality];
  
  const manifestations = allergy.reaction?.[0]?.manifestation || [];
  const severity = allergy.reaction?.[0]?.severity;
  
  // Additional FHIR fields for enhanced clinical utility
  const asserter = allergy.asserter?.display;
  const recorder = allergy.recorder?.display;
  const lastOccurrence = allergy.lastOccurrence;
  const clinicalStatus = allergy.clinicalStatus?.coding?.[0]?.code;
  const verificationStatus = allergy.verificationStatus?.coding?.[0]?.code;
  const allergenCode = allergy.code?.coding?.[0]?.code;
  const codeSystem = allergy.code?.coding?.[0]?.system;
  const identifiers = allergy.identifier?.map(id => `${id.type?.text || 'ID'}: ${id.value}`).join(', ');
  const onsetDate = allergy.onsetDateTime || allergy.onsetAge?.value;
  
  // All manifestations from all reactions
  const allManifestations = allergy.reaction?.flatMap(reaction => 
    reaction.manifestation?.map(m => m.text || m.coding?.[0]?.display).filter(Boolean)
  ) || [];
  
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
        borderLeft: '4px solid',
        borderLeftColor: criticality === 'high' ? theme.palette.error.main :
                        criticality === 'low' ? theme.palette.success.main :
                        theme.palette.warning.main,
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
            {/* Criticality */}
            <Chip 
              label={criticality === 'high' ? 'High Risk' : 
                     criticality === 'low' ? 'Low Risk' : 
                     criticality === 'unable-to-assess' ? 'Unknown Risk' : criticality} 
              size="small" 
              color={criticalityColor}
              sx={{ 
                fontWeight: 600,
                borderRadius: 0,
                ...(criticality === 'high' && {
                  backgroundColor: alpha(theme.palette.error.main, 0.9),
                  color: 'white'
                }),
                ...(criticality === 'low' && {
                  backgroundColor: alpha(theme.palette.success.main, 0.9),
                  color: 'white'
                })
              }}
            />
            {severity && (
              <Chip 
                label={severity} 
                size="small" 
                variant="outlined"
                color={severity === 'severe' ? 'error' : 'default'}
                sx={{ borderRadius: 0 }}
              />
            )}
            {clinicalStatus && (
              <Chip 
                label={clinicalStatus === 'active' ? 'Active' : 
                       clinicalStatus === 'resolved' ? 'Resolved' : 
                       clinicalStatus === 'inactive' ? 'Inactive' : clinicalStatus} 
                size="small" 
                color={clinicalStatus === 'active' ? 'error' : 
                       clinicalStatus === 'resolved' ? 'success' : 'default'}
                sx={{ 
                  fontWeight: 600,
                  borderRadius: 0,
                  ...(clinicalStatus === 'active' && {
                    backgroundColor: alpha(theme.palette.error.main, 0.1),
                    color: theme.palette.error.main
                  }),
                  ...(clinicalStatus === 'resolved' && {
                    backgroundColor: alpha(theme.palette.success.main, 0.1),
                    color: theme.palette.success.main
                  })
                }}
              />
            )}
            {verificationStatus === 'confirmed' && (
              <Chip 
                label="Confirmed" 
                size="small" 
                color="success"
                variant="outlined"
                sx={{ borderRadius: 0 }}
              />
            )}
          </Stack>
          
          {/* Allergy codes and identifiers */}
          {(allergenCode || identifiers) && (
            <Stack direction="row" spacing={2} alignItems="center" mb={0.5} flexWrap="wrap">
              {allergenCode && (
                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                  <strong>Code:</strong> {allergenCode}
                  {codeSystem?.includes('snomed') && ' (SNOMED)'}
                  {codeSystem?.includes('rxnorm') && ' (RxNorm)'}
                </Typography>
              )}
              {identifiers && (
                <Typography variant="caption" color="text.secondary">
                  <strong>ID:</strong> {identifiers}
                </Typography>
              )}
            </Stack>
          )}
          
          <Stack spacing={0.5}>
            <Typography variant="caption" color="text.secondary">
              <strong>Type:</strong> {typeof allergy.type === 'string' ? allergy.type : 'Unknown'} | 
              <strong> Category:</strong> {(() => {
                // Handle both array and single object formats
                const categoryArray = Array.isArray(allergy.category) ? allergy.category : 
                                     (allergy.category ? [allergy.category] : []);
                const firstCategory = categoryArray[0];
                
                if (!firstCategory) return 'Unknown';
                
                // If it's a string, return it
                if (typeof firstCategory === 'string') return firstCategory;
                
                // If it's a CodeableConcept, extract the display
                if (typeof firstCategory === 'object') {
                  return firstCategory.coding?.[0]?.display || 
                         firstCategory.text || 
                         'Unknown';
                }
                
                return 'Unknown';
              })()}
            </Typography>
            
            {/* Enhanced manifestation display */}
            {allManifestations.length > 0 && (
              <Typography variant="caption" color="text.secondary">
                <strong>Manifestations:</strong> {allManifestations.join(', ')}
              </Typography>
            )}
            
            {/* Onset and occurrence information */}
            <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
              {onsetDate && (
                <Typography variant="caption" color="text.secondary">
                  <strong>Onset:</strong> {typeof onsetDate === 'string' ? 
                    format(new Date(onsetDate), 'MMM d, yyyy') : 
                    `Age ${onsetDate}`}
                </Typography>
              )}
              {lastOccurrence && (
                <Typography variant="caption" color="text.secondary">
                  <strong>Last reaction:</strong> {format(new Date(lastOccurrence), 'MMM d, yyyy')}
                </Typography>
              )}
            </Stack>
            
            {/* Clinical team and recording information */}
            <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
              {allergy.recordedDate && (
                <Typography variant="caption" color="text.secondary">
                  <strong>Recorded:</strong> {format(new Date(allergy.recordedDate), 'MMM d, yyyy')}
                </Typography>
              )}
              {recorder && (
                <Typography variant="caption" color="text.secondary">
                  <strong>Recorded by:</strong> {recorder}
                </Typography>
              )}
              {asserter && asserter !== recorder && (
                <Typography variant="caption" color="text.secondary">
                  <strong>Asserted by:</strong> {asserter}
                </Typography>
              )}
            </Stack>
            
            {/* Notes */}
            {allergy.note?.[0]?.text && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                <strong>Notes:</strong> {allergy.note[0].text}
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
        borderLeft: '4px solid',
        borderLeftColor: status === 'completed' ? theme.palette.success.main :
                        status === 'not-done' ? theme.palette.warning.main :
                        theme.palette.grey[300],
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
            {/* Immunization Status */}
            <Chip 
              label={status === 'completed' ? 'Completed' : 
                     status === 'not-done' ? 'Not Done' : 
                     status === 'entered-in-error' ? 'Error' : status} 
              size="small" 
              color={status === 'completed' ? 'success' : 
                     status === 'not-done' ? 'warning' : 'default'}
              sx={{ 
                fontWeight: 600,
                borderRadius: 0,
                ...(status === 'completed' && {
                  backgroundColor: alpha(theme.palette.success.main, 0.9),
                  color: 'white'
                }),
                ...(status === 'not-done' && {
                  backgroundColor: alpha(theme.palette.warning.main, 0.9),
                  color: 'white'
                })
              }}
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
                <strong>Site:</strong> {immunization.site.text || immunization.site.coding?.[0]?.display || 'Unknown'}
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
        borderLeft: '4px solid',
        borderLeftColor: status === 'completed' ? theme.palette.success.main :
                        status === 'in-progress' ? theme.palette.info.main :
                        status === 'stopped' ? theme.palette.error.main :
                        status === 'not-done' ? theme.palette.warning.main :
                        theme.palette.grey[300],
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
            {/* Procedure Status */}
            <Chip 
              label={status === 'completed' ? 'Completed' : 
                     status === 'in-progress' ? 'In Progress' : 
                     status === 'preparation' ? 'Preparation' : 
                     status === 'not-done' ? 'Not Done' : 
                     status === 'stopped' ? 'Stopped' : 
                     status === 'on-hold' ? 'On Hold' : 
                     status === 'entered-in-error' ? 'Error' : status} 
              size="small" 
              color={status === 'completed' ? 'success' : 
                     status === 'in-progress' ? 'info' : 
                     status === 'preparation' ? 'info' : 
                     status === 'not-done' ? 'warning' : 
                     status === 'stopped' ? 'error' : 'default'}
              sx={{ 
                fontWeight: 600,
                borderRadius: 0,
                ...(status === 'completed' && {
                  backgroundColor: alpha(theme.palette.success.main, 0.9),
                  color: 'white'
                }),
                ...(status === 'in-progress' && {
                  backgroundColor: alpha(theme.palette.info.main, 0.9),
                  color: 'white'
                }),
                ...(status === 'stopped' && {
                  backgroundColor: alpha(theme.palette.error.main, 0.9),
                  color: 'white'
                })
              }}
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
                  procedure.bodySite[0].coding?.[0]?.display || null}
              </Typography>
            )}
            {procedure.outcome && (
              <Typography variant="caption" color="text.secondary">
                <strong>Outcome:</strong> {procedure.outcome.text || 
                  procedure.outcome.coding?.[0]?.display || null}
              </Typography>
            )}
            {procedure.reasonCode?.[0] && (
              <Typography variant="caption" color="text.secondary">
                <strong>Reason:</strong> {procedure.reasonCode[0].text || 
                  procedure.reasonCode[0].coding?.[0]?.display || null}
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
        borderLeft: '4px solid',
        borderLeftColor: status === 'active' ? theme.palette.primary.main :
                        status === 'completed' ? theme.palette.success.main :
                        status === 'draft' ? theme.palette.info.main :
                        status === 'revoked' ? theme.palette.error.main :
                        theme.palette.grey[400],
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
            {/* Care Plan Status */}
            <Chip 
              label={status === 'active' ? 'Active' : 
                     status === 'completed' ? 'Completed' : 
                     status === 'draft' ? 'Draft' : 
                     status === 'revoked' ? 'Revoked' : 
                     status === 'on-hold' ? 'On Hold' : 
                     status === 'unknown' ? 'Unknown' : 
                     status === 'entered-in-error' ? 'Error' : status} 
              size="small" 
              color={status === 'active' ? 'primary' : 
                     status === 'completed' ? 'success' : 
                     status === 'draft' ? 'info' : 
                     status === 'revoked' ? 'error' : 'default'}
              sx={{ 
                fontWeight: 600,
                borderRadius: 0,
                ...(status === 'active' && {
                  backgroundColor: alpha(theme.palette.primary.main, 0.9),
                  color: 'white'
                }),
                ...(status === 'completed' && {
                  backgroundColor: alpha(theme.palette.success.main, 0.9),
                  color: 'white'
                }),
                ...(status === 'revoked' && {
                  backgroundColor: alpha(theme.palette.error.main, 0.9),
                  color: 'white'
                })
              }}
            />
            {carePlan.intent && (
              <Chip 
                label={carePlan.intent} 
                size="small" 
                variant="outlined"
                sx={{ borderRadius: 0 }}
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
        borderLeft: '4px solid',
        borderLeftColor: status === 'current' ? theme.palette.primary.main :
                        status === 'superseded' ? theme.palette.warning.main :
                        status === 'entered-in-error' ? theme.palette.error.main :
                        theme.palette.grey[600],
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
            {/* Document Status */}
            <Chip 
              label={status === 'current' ? 'Current' : 
                     status === 'superseded' ? 'Superseded' : 
                     status === 'entered-in-error' ? 'Error' : status} 
              size="small" 
              color={status === 'current' ? 'primary' : 
                     status === 'superseded' ? 'warning' : 
                     status === 'entered-in-error' ? 'error' : 'default'}
              sx={{ 
                fontWeight: 600,
                borderRadius: 0,
                ...(status === 'current' && {
                  backgroundColor: alpha(theme.palette.primary.main, 0.9),
                  color: 'white'
                }),
                ...(status === 'superseded' && {
                  backgroundColor: alpha(theme.palette.warning.main, 0.9),
                  color: 'white'
                })
              }}
            />
            {document.docStatus && (
              <Chip 
                label={document.docStatus} 
                size="small" 
                variant="outlined"
                sx={{ borderRadius: 0 }}
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

// Custom comparison function to prevent unnecessary re-renders
const arePropsEqual = (prevProps, nextProps) => {
  // Only re-render if patient or patientId changes
  const prevPatientId = prevProps.patient?.id || prevProps.patientId;
  const nextPatientId = nextProps.patient?.id || nextProps.patientId;
  
  // Check if patientId has changed
  if (prevPatientId !== nextPatientId) {
    return false; // Props are not equal, re-render needed
  }
  
  // Check if scrollContainerRef has changed (this is important for scroll functionality)
  if (prevProps.scrollContainerRef !== nextProps.scrollContainerRef) {
    return false;
  }
  
  // For all other prop changes, prevent re-render
  return true; // Props are equal, no re-render needed
};

export default React.memo(ChartReviewTabOptimized, arePropsEqual);