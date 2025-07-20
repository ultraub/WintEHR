/**
 * Summary Tab Component
 * Patient overview dashboard with key clinical information
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Grid,
  Typography,
  Card,
  CardContent,
  CardHeader,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Divider,
  Button,
  IconButton,
  Skeleton,
  Alert,
  LinearProgress,
  useTheme,
  alpha
} from '@mui/material';
import {
  Warning as WarningIcon,
  Medication as MedicationIcon,
  Assignment as ProblemIcon,
  Science as LabIcon,
  LocalHospital as EncounterIcon,
  Assessment as VitalsIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  ArrowForward as ArrowIcon,
  Refresh as RefreshIcon,
  CalendarMonth as CalendarIcon,
  Print as PrintIcon
} from '@mui/icons-material';
import { format, formatDistanceToNow, parseISO, isWithinInterval, subDays } from 'date-fns';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import { useStableCallback } from '../../../../hooks/useStableReferences';
import { useNavigate } from 'react-router-dom';
import { fhirClient } from '../../../../core/fhir/services/fhirClient';
import { useMedicationResolver } from '../../../../hooks/useMedicationResolver';
import { printDocument, formatConditionsForPrint, formatMedicationsForPrint, formatLabResultsForPrint } from '../../../../core/export/printUtils';
import { useClinicalWorkflow, CLINICAL_EVENTS } from '../../../../contexts/ClinicalWorkflowContext';
import { getMedicationDosageDisplay } from '../../../../core/fhir/utils/medicationDisplayUtils';
import { 
  getConditionStatus, 
  getMedicationStatus, 
  getObservationCategory, 
  getObservationInterpretation,
  getEncounterStatus,
  isObservationLaboratory,
  isConditionActive,
  isMedicationActive,
  getResourceDisplayText,
  getCodeableConceptDisplay
} from '../../../../core/fhir/utils/fhirFieldUtils';
import CareTeamSummary from '../components/CareTeamSummary';
import EnhancedProviderDisplay from '../components/EnhancedProviderDisplay';
import MetricCard from '../../common/MetricCard';
import StatusChip from '../../common/StatusChip';
import ClinicalCard from '../../ui/ClinicalCard';
import MetricsBar from '../../ui/MetricsBar';
import TrendSparkline from '../../ui/TrendSparkline';
import CompactPatientHeader from '../../ui/CompactPatientHeader';
import { ViewControls, useDensity } from '../../ui/DensityControl';
import { motion } from 'framer-motion';

// Use the new MetricCard component from common components

// Recent Item Component
const RecentItem = ({ primary, secondary, icon, status, onClick }) => {
  const theme = useTheme();
  
  return (
    <ListItem 
      component="button"
      onClick={onClick}
      sx={{ 
        borderRadius: theme.shape.borderRadius / 8,
        mb: theme.spacing(1),
        transition: `all ${theme.animations?.duration?.short || 250}ms ${theme.animations?.easing?.easeInOut || 'ease-in-out'}`,
        '&:hover': { 
          backgroundColor: theme.clinical?.interactions?.hover || 'action.hover',
          transform: 'translateY(-1px)'
        },
        cursor: 'pointer',
        border: 'none',
        width: '100%',
        textAlign: 'left',
        background: 'transparent',
        '&:focus': {
          outline: '2px solid',
          outlineColor: 'primary.main',
          outlineOffset: '2px'
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`View details for ${primary}. ${secondary}${status ? `. Status: ${status}` : ''}`}
    >
      <ListItemIcon>{icon}</ListItemIcon>
      <ListItemText 
        primary={primary}
        secondary={secondary}
      />
      {status && (
        <StatusChip 
          status={status}
          size="small"
        />
      )}
    </ListItem>
  );
};

const SummaryTab = ({ patientId, onNotificationUpdate }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { 
    resources,
    fetchPatientBundle,
    isResourceLoading,
    currentPatient,
    relationships,
    isCacheWarm 
  } = useFHIRResource();
  
  const { subscribe, publish } = useClinicalWorkflow();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [density, setDensity] = useDensity('comfortable');
  const [viewMode, setViewMode] = useState('dashboard');
  const [stats, setStats] = useState({
    activeProblems: 0,
    activeMedications: 0,
    recentLabs: 0,
    upcomingAppointments: 0,
    overdueItems: 0
  });

  // Optimized loading for summary counts
  const loadSummaryStats = useCallback(async () => {
    if (!patientId) return;
    
    try {
      // Use batch request to get counts efficiently
      const batchRequests = [
        {
          method: "GET",
          url: `Condition?patient=${patientId}&clinical-status=active&_summary=count`
        },
        {
          method: "GET",
          url: `MedicationRequest?patient=${patientId}&status=active&_summary=count`
        },
        {
          method: "GET",
          url: `Observation?patient=${patientId}&category=laboratory&date=ge${subDays(new Date(), 7).toISOString().split('T')[0]}&_summary=count`
        },
        {
          method: "GET",
          url: `AllergyIntolerance?patient=${patientId}&_summary=count`
        }
      ];

      const batchResult = await fhirClient.batch(batchRequests);
      
      // Extract counts from batch response
      const entries = batchResult.entry || [];
      const activeProblems = entries[0]?.resource?.total || 0;
      const activeMedications = entries[1]?.resource?.total || 0;
      const recentLabs = entries[2]?.resource?.total || 0;
      const totalAllergies = entries[3]?.resource?.total || 0;

      setStats({
        activeProblems,
        activeMedications,
        recentLabs,
        totalAllergies,
        upcomingAppointments: 0, // Will be calculated separately
        overdueItems: 0 // Will be calculated separately
      });
    } catch (error) {
      // Error loading summary stats - stats will not be displayed
      // Log error but don't call fetchPatientBundle to avoid infinite loop
      console.error('Error loading summary stats:', error);
    }
  }, [patientId, fhirClient]);

  // Load optimized summary stats on patient change
  useEffect(() => {
    if (patientId) {
      loadSummaryStats();
    }
  }, [patientId]); // Only depend on patientId to avoid infinite loop

  // Get resources from context - these are already cached and shared
  const conditions = useMemo(() => {
    // Processing raw Condition resources
    const filtered = Object.values(resources.Condition || {}).filter(c => 
      c.subject?.reference === `Patient/${patientId}` || 
      c.subject?.reference === `urn:uuid:${patientId}` ||
      c.patient?.reference === `Patient/${patientId}` ||
      c.patient?.reference === `urn:uuid:${patientId}`
    );
    // Conditions filtered by status
    return filtered;
  }, [resources.Condition, patientId]);
  
  const medications = useMemo(() => {
    // Processing raw MedicationRequest resources
    const filtered = Object.values(resources.MedicationRequest || {}).filter(m => 
      m.subject?.reference === `Patient/${patientId}` || 
      m.subject?.reference === `urn:uuid:${patientId}` ||
      m.patient?.reference === `Patient/${patientId}` ||
      m.patient?.reference === `urn:uuid:${patientId}`
    );
    // Medications filtered by status
    return filtered;
  }, [resources.MedicationRequest, patientId]);
  
  const observations = useMemo(() => 
    Object.values(resources.Observation || {}).filter(o => 
      o.subject?.reference === `Patient/${patientId}` || 
      o.subject?.reference === `urn:uuid:${patientId}` ||
      o.patient?.reference === `Patient/${patientId}` ||
      o.patient?.reference === `urn:uuid:${patientId}`
    ), [resources.Observation, patientId]);
  
  const encounters = useMemo(() => 
    Object.values(resources.Encounter || {}).filter(e => 
      e.subject?.reference === `Patient/${patientId}` || 
      e.subject?.reference === `urn:uuid:${patientId}` ||
      e.patient?.reference === `Patient/${patientId}` ||
      e.patient?.reference === `urn:uuid:${patientId}`
    ), [resources.Encounter, patientId]);
  
  const allergies = useMemo(() => 
    Object.values(resources.AllergyIntolerance || {}).filter(a => 
      a.patient?.reference === `Patient/${patientId}` ||
      a.patient?.reference === `urn:uuid:${patientId}`
    ), [resources.AllergyIntolerance, patientId]);

  const serviceRequests = useMemo(() => 
    Object.values(resources.ServiceRequest || {}).filter(s => 
      s.subject?.reference === `Patient/${patientId}` || 
      s.subject?.reference === `urn:uuid:${patientId}` ||
      s.patient?.reference === `Patient/${patientId}` ||
      s.patient?.reference === `urn:uuid:${patientId}`
    ), [resources.ServiceRequest, patientId]);

  // Define loadDashboardData function with stable callback to prevent infinite loops
  const loadDashboardData = useStableCallback(async () => {
    try {
      // Don't set loading if we're just refreshing data we already have
      if (conditions.length === 0 && medications.length === 0 && observations.length === 0) {
        setLoading(true);
      }
      
      // Use current resource arrays directly - no need to reassign
      // Calculate stats using resilient field access utilities
      const activeConditions = conditions.filter(isConditionActive);
      const activeMeds = medications.filter(isMedicationActive);
      
      // Recent labs (last 7 days)
      const recentLabs = observations.filter(o => {
        if (isObservationLaboratory(o)) {
          const date = o.effectiveDateTime || o.issued;
          if (date) {
            return isWithinInterval(parseISO(date), {
              start: subDays(new Date(), 7),
              end: new Date()
            });
          }
        }
        return false;
      });

      // Count upcoming appointments (encounters with future dates)
      const upcomingAppointments = encounters.filter(enc => {
        const startDate = enc.period?.start;
        return startDate && new Date(startDate) > new Date() && enc.status === 'planned';
      }).length;

      // Calculate overdue items (medications needing refill, overdue lab orders, etc.)
      let overdueCount = 0;
      
      // Check for medications that might need refills
      medications.forEach(med => {
        if (isMedicationActive(med) && med.dispenseRequest?.validityPeriod?.end) {
          const endDate = new Date(med.dispenseRequest.validityPeriod.end);
          if (endDate < new Date()) {
            overdueCount++;
          }
        }
      });

      // Check for overdue lab orders (use already loaded service requests)
      serviceRequests.forEach(order => {
        if (order.status === 'active' && order.occurrenceDateTime) {
          const dueDate = new Date(order.occurrenceDateTime);
          if (dueDate < new Date()) {
            overdueCount++;
          }
        }
      });

      // Update stats
      setStats({
        activeProblems: activeConditions.length,
        activeMedications: activeMeds.length,
        recentLabs: recentLabs.length,
        upcomingAppointments: upcomingAppointments,
        overdueItems: overdueCount,
        totalAllergies: allergies.length
      });

      // Update notifications
      if (onNotificationUpdate && recentLabs.length > 0) {
        onNotificationUpdate(recentLabs.length);
      }

      setLastRefresh(new Date());
    } catch (error) {
      // Error loading summary data - in production this would show an error notification to the user
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  });

  // Update dashboard when resources change - removed loadDashboardData from deps to prevent infinite loops
  useEffect(() => {
    if (!patientId) return;
    
    // Resource check: tracking patient resources and cache status
    
    // Check if we have any resources loaded for this patient
    const hasAnyResources = conditions.length > 0 || medications.length > 0 || observations.length > 0 || encounters.length > 0;
    
    if (hasAnyResources) {
      // We have resources, process them
      // Processing resources from context
      loadDashboardData();
      setLoading(false);
    } else {
      // No resources yet, check if we're already loading from context
      if (isResourceLoading(patientId)) {
        // Resources are loading from context
        setLoading(true);
      } else if (!isCacheWarm(patientId)) {
        // Cache isn't warm and we're not loading, trigger a fetch
        // Cache not warm, fetching patient bundle
        setLoading(true);
        fetchPatientBundle(patientId, false, 'critical');
      } else {
        // Cache is warm but no resources - patient might have no data
        // Cache is warm but no resources found
        setLoading(false);
      }
    }
  }, [patientId, conditions.length, medications.length, observations.length, encounters.length, allergies.length, serviceRequests.length]);

  // Note: Removed problematic useEffect that was causing infinite loops
  // Data refreshing is now handled only by the event system below

  // Subscribe to clinical events to refresh summary when data changes
  useEffect(() => {
    const unsubscribers = [];
    let timeoutId = null;

    // Subscribe to events that should trigger a refresh
    const eventsToWatch = [
      CLINICAL_EVENTS.CONDITION_ADDED,
      CLINICAL_EVENTS.CONDITION_UPDATED,
      CLINICAL_EVENTS.MEDICATION_PRESCRIBED,
      CLINICAL_EVENTS.MEDICATION_STATUS_CHANGED,
      CLINICAL_EVENTS.RESULT_RECEIVED,
      CLINICAL_EVENTS.ENCOUNTER_CREATED,
      CLINICAL_EVENTS.ALLERGY_ADDED,
      CLINICAL_EVENTS.ALLERGY_UPDATED
    ];

    eventsToWatch.forEach(eventType => {
      const unsubscribe = subscribe(eventType, (data) => {
        // Only refresh if the event is for the current patient
        if (data.patientId === patientId || data.resourceType) {
          setRefreshing(true);
          // Use a timeout to prevent rapid successive calls
          if (timeoutId) clearTimeout(timeoutId);
          timeoutId = setTimeout(() => loadDashboardData(), 100);
        }
      });
      unsubscribers.push(unsubscribe);
    });

    // Cleanup subscriptions on unmount
    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [subscribe, patientId, loadDashboardData]); // Include all dependencies


  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadDashboardData();
  }, [loadDashboardData]);

  // Resolve medication references
  const { getMedicationDisplay } = useMedicationResolver(
    medications?.filter(med => med && med.id) || []
  );

  const handlePrintSummary = () => {
    // Skip printing if no relationships are available
    if (!relationships[patientId]) {
      return;
    }
    
    const patientInfo = {
      name: currentPatient ? 
        `${currentPatient.name?.[0]?.given?.join(' ') || ''} ${currentPatient.name?.[0]?.family || ''}`.trim() : 
        'Unknown Patient',
      mrn: currentPatient?.identifier?.find(id => id.type?.coding?.[0]?.code === 'MR')?.value || currentPatient?.id,
      birthDate: currentPatient?.birthDate,
      gender: currentPatient?.gender,
      phone: currentPatient?.telecom?.find(t => t.system === 'phone')?.value
    };
    
    // Create comprehensive summary content
    let content = '<h2>Clinical Summary</h2>';
    
    // Active Problems
    content += '<h3>Active Problems</h3>';
    const activeConditions = conditions.filter(isConditionActive);
    content += formatConditionsForPrint(activeConditions);
    
    // Active Medications
    content += '<h3>Active Medications</h3>';
    const activeMeds = medications.filter(isMedicationActive);
    content += formatMedicationsForPrint(activeMeds);
    
    // Recent Lab Results
    content += '<h3>Recent Lab Results (Last 7 Days)</h3>';
    const recentLabs = observations
      .filter(isObservationLaboratory)
      .sort((a, b) => new Date(b.effectiveDateTime || b.issued || 0) - new Date(a.effectiveDateTime || a.issued || 0))
      .slice(0, 5);
    content += formatLabResultsForPrint(recentLabs);
    
    // Allergies
    if (allergies.length > 0) {
      content += '<h3>Allergies</h3>';
      content += '<ul>';
      allergies.forEach(allergy => {
        const allergyText = getResourceDisplayText(allergy);
        const criticality = allergy.criticality ? ` (${allergy.criticality})` : '';
        content += `<li>${allergyText}${criticality}</li>`;
      });
      content += '</ul>';
    }
    
    printDocument({
      title: 'Clinical Summary',
      patient: patientInfo,
      content
    });
  };

  // Memoized data processing to prevent recalculation on every render
  const processedData = useMemo(() => {
    // Get critical conditions
    const criticalConditions = conditions.filter(c => 
      isConditionActive(c) && 
      (c.severity?.coding?.[0]?.code === 'severe' || 
       c.code?.text?.toLowerCase().includes('critical'))
    );
    
    // Generate vitals trend data (mock for now, should come from real observations)
    const vitalsTrend = observations
      .filter(o => o.code?.coding?.[0]?.system === 'http://loinc.org' && 
                   ['8867-4', '8462-4', '8310-5'].includes(o.code?.coding?.[0]?.code))
      .slice(-10)
      .map(o => ({
        value: o.valueQuantity?.value || 0,
        date: o.effectiveDateTime || o.issued
      }));
    
    return {
      recentConditions: conditions
        .sort((a, b) => new Date(b.recordedDate || 0) - new Date(a.recordedDate || 0))
        .slice(0, 5),
      
      recentMedications: medications
        .filter(isMedicationActive)
        .sort((a, b) => new Date(b.authoredOn || 0) - new Date(a.authoredOn || 0))
        .slice(0, 5),
      
      recentLabs: observations
        .filter(isObservationLaboratory)
        .sort((a, b) => new Date(b.effectiveDateTime || b.issued || 0) - new Date(a.effectiveDateTime || a.issued || 0))
        .slice(0, 5),
      
      recentEncounters: encounters
        .sort((a, b) => new Date(b.period?.start || 0) - new Date(a.period?.start || 0))
        .slice(0, 5),
        
      criticalConditions,
      vitalsTrend
    };
  }, [conditions, medications, observations, encounters]);
  
  const { recentConditions, recentMedications, recentLabs, recentEncounters, criticalConditions, vitalsTrend } = processedData;
  
  // Calculate patient acuity for header
  const patientAcuity = useMemo(() => {
    if (criticalConditions.length > 0) return 'critical';
    if (stats.overdueItems > 3) return 'high';
    if (stats.activeProblems > 5) return 'moderate';
    return 'low';
  }, [criticalConditions.length, stats]);
  
  // Prepare metrics for MetricsBar
  const metrics = useMemo(() => [
    {
      label: 'Active Problems',
      value: stats.activeProblems,
      icon: <ProblemIcon />,
      color: 'warning',
      trend: stats.activeProblems > 3 ? 'up' : 'stable',
      severity: stats.activeProblems > 5 ? 'high' : 'normal'
    },
    {
      label: 'Medications',
      value: stats.activeMedications,
      icon: <MedicationIcon />,
      color: 'primary',
      sublabel: `${stats.overdueItems} need refill`
    },
    {
      label: 'Recent Labs',
      value: stats.recentLabs,
      icon: <LabIcon />,
      color: 'info',
      sublabel: 'Last 7 days'
    },
    {
      label: 'Allergies',
      value: stats.totalAllergies,
      icon: <WarningIcon />,
      color: stats.totalAllergies > 0 ? 'error' : 'default',
      severity: stats.totalAllergies > 3 ? 'high' : 'normal'
    },
    {
      label: 'Overdue',
      value: stats.overdueItems,
      icon: <CalendarIcon />,
      color: 'error',
      severity: stats.overdueItems > 0 ? 'high' : 'normal',
      progress: stats.overdueItems > 0 ? (stats.overdueItems / 10) * 100 : 0
    }
  ], [stats]);

  if (loading && !refreshing) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Loading patient data...</Typography>
        <Grid container spacing={3}>
          {[1, 2, 3, 4].map(i => (
            <Grid item xs={12} sm={6} md={3} key={i}>
              <Skeleton variant="rectangular" height={140} />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Compact Patient Header */}
      <CompactPatientHeader
        patient={currentPatient}
        alerts={[
          ...(criticalConditions.map(c => ({ 
            indicator: 'critical', 
            text: getResourceDisplayText(c) 
          }))),
          ...(stats.overdueItems > 0 ? [{ 
            indicator: 'warning', 
            text: `${stats.overdueItems} overdue items` 
          }] : [])
        ]}
        vitals={{
          bloodPressure: vitalsTrend.filter(v => v.value > 80 && v.value < 200),
          heartRate: vitalsTrend.filter(v => v.value > 40 && v.value < 150)
        }}
        conditions={conditions}
        medications={medications}
        allergies={allergies}
        lastEncounter={recentEncounters[0]}
        onNavigateToTab={(tab) => navigate(`/clinical/${patientId}?tab=${tab}`)}
      />
      
      {refreshing && <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0 }} />}
      
      {/* Main Content */}
      <Box sx={{ flex: 1, overflow: 'auto', p: { xs: 1, md: 2 } }}>
        {/* Dashboard Header */}
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: { xs: 'flex-start', md: 'center' }, 
          mb: 2,
          flexDirection: { xs: 'column', md: 'row' },
          gap: { xs: 1, md: 0 }
        }}>
          <Box>
            <Typography variant="h5" fontWeight="600">
              Clinical Dashboard
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Last updated: {formatDistanceToNow(lastRefresh, { addSuffix: true })}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <ViewControls
              density={density}
              onDensityChange={setDensity}
              showViewMode={false}
              size="small"
            />
            <IconButton 
              onClick={handlePrintSummary} 
              title="Print Summary"
              size="small"
            >
              <PrintIcon />
            </IconButton>
            <IconButton 
              onClick={handleRefresh} 
              disabled={refreshing}
              size="small"
            >
              <RefreshIcon />
            </IconButton>
          </Box>
        </Box>

        {/* Key Metrics Bar */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <MetricsBar 
            metrics={metrics} 
            density={density}
            animate={!loading}
          />
        </motion.div>


        {/* Clinical Alerts */}
        {(allergies.length > 0 || criticalConditions.length > 0) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <Box sx={{ mt: 2, mb: 2 }}>
              {criticalConditions.length > 0 && (
                <Alert 
                  severity="error" 
                  sx={{ mb: 1 }}
                  action={
                    <Button size="small" onClick={() => navigate(`/clinical/${patientId}?tab=chart`)}>
                      Manage
                    </Button>
                  }
                >
                  <Typography variant="subtitle2" fontWeight="bold">
                    Critical Conditions
                  </Typography>
                  {criticalConditions.slice(0, 2).map((condition, index) => (
                    <Typography key={index} variant="body2">
                      • {getResourceDisplayText(condition)}
                    </Typography>
                  ))}
                </Alert>
              )}
              {allergies.length > 0 && (
                <Alert 
                  severity="warning" 
                  sx={{ mb: 1 }}
                  action={
                    <Button size="small" onClick={() => navigate(`/clinical/${patientId}?tab=chart`)}>
                      View All
                    </Button>
                  }
                >
                  <Typography variant="subtitle2" fontWeight="bold">
                    Allergies ({allergies.length})
                  </Typography>
                  {allergies.slice(0, 3).map((allergy, index) => (
                    <Typography key={index} variant="body2">
                      • {getResourceDisplayText(allergy)} 
                      {allergy.criticality && ` (${allergy.criticality})`}
                    </Typography>
                  ))}
                </Alert>
              )}
            </Box>
          </motion.div>
        )}

        {/* Clinical Snapshot Grid - 2x2 Layout */}
        <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
          Clinical Snapshot
        </Typography>
        <Grid container spacing={density === 'compact' ? 1 : 2}>
          {/* Active Problems Card */}
          <Grid item xs={12} md={6}>
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
            >
              <ClinicalCard
                title="Active Problems"
                subtitle={`${stats.activeProblems} conditions`}
                severity={criticalConditions.length > 0 ? 'critical' : 'normal'}
                expandable={false}
                actions={[
                  {
                    label: 'View All',
                    onClick: () => navigate(`/clinical/${patientId}?tab=chart`)
                  }
                ]}
                sx={{ height: '100%' }}
              >
                <List disablePadding>
                  {recentConditions.length > 0 ? (
                    recentConditions.slice(0, density === 'compact' ? 3 : 5).map((condition) => (
                      <ListItem
                        key={condition.id}
                        sx={{ 
                          px: density === 'compact' ? 1 : 2,
                          py: density === 'compact' ? 0.5 : 1
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <ProblemIcon 
                            color="warning" 
                            fontSize={density === 'compact' ? 'small' : 'medium'}
                          />
                        </ListItemIcon>
                        <ListItemText 
                          primary={getResourceDisplayText(condition)}
                          secondary={condition.recordedDate ? 
                            format(parseISO(condition.recordedDate), 'MMM d, yyyy') : 
                            null
                          }
                          primaryTypographyProps={{
                            variant: density === 'compact' ? 'body2' : 'body1',
                            noWrap: density === 'compact'
                          }}
                          secondaryTypographyProps={{
                            variant: 'caption'
                          }}
                        />
                        <StatusChip 
                          status={getConditionStatus(condition)}
                          size="small"
                        />
                      </ListItem>
                    ))
                  ) : (
                    <Typography 
                      variant="body2" 
                      color="text.secondary"
                      sx={{ p: 2, textAlign: 'center' }}
                    >
                      No active problems
                    </Typography>
                  )}
                </List>
              </ClinicalCard>
            </motion.div>
          </Grid>

          {/* Current Medications Card */}
          <Grid item xs={12} md={6}>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.3 }}
            >
              <ClinicalCard
                title="Current Medications"
                subtitle={`${stats.activeMedications} active`}
                status={stats.overdueItems > 0 ? `${stats.overdueItems} need refill` : null}
                expandable={false}
                actions={[
                  {
                    label: 'Manage',
                    onClick: () => navigate(`/medications`)
                  }
                ]}
                metrics={[
                  {
                    label: 'Active',
                    value: stats.activeMedications,
                    color: 'primary'
                  },
                  {
                    label: 'Need Refill',
                    value: stats.overdueItems,
                    color: stats.overdueItems > 0 ? 'error' : 'default'
                  }
                ]}
                sx={{ height: '100%' }}
              >
                <List disablePadding>
                  {recentMedications.length > 0 ? (
                    recentMedications.slice(0, density === 'compact' ? 3 : 5).map((med) => (
                      <ListItem
                        key={med.id}
                        sx={{ 
                          px: density === 'compact' ? 1 : 2,
                          py: density === 'compact' ? 0.5 : 1
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <MedicationIcon 
                            color="primary" 
                            fontSize={density === 'compact' ? 'small' : 'medium'}
                          />
                        </ListItemIcon>
                        <ListItemText 
                          primary={getMedicationDisplay(med)}
                          secondary={getMedicationDosageDisplay(med)}
                          primaryTypographyProps={{
                            variant: density === 'compact' ? 'body2' : 'body1',
                            noWrap: density === 'compact'
                          }}
                          secondaryTypographyProps={{
                            variant: 'caption',
                            noWrap: true
                          }}
                        />
                        {med.dispenseRequest?.validityPeriod?.end && 
                         new Date(med.dispenseRequest.validityPeriod.end) < new Date() && (
                          <Chip 
                            label="Refill" 
                            size="small" 
                            color="error"
                            variant="outlined"
                          />
                        )}
                      </ListItem>
                    ))
                  ) : (
                    <Typography 
                      variant="body2" 
                      color="text.secondary"
                      sx={{ p: 2, textAlign: 'center' }}
                    >
                      No active medications
                    </Typography>
                  )}
                </List>
              </ClinicalCard>
            </motion.div>
          </Grid>

          {/* Recent Lab Results Card */}
          <Grid item xs={12} md={6}>
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.4 }}
            >
              <ClinicalCard
                title="Recent Lab Results"
                subtitle="Last 7 days"
                expandable={false}
                actions={[
                  {
                    label: 'View All',
                    onClick: () => navigate(`/clinical/${patientId}?tab=results`)
                  }
                ]}
                trend={recentLabs.length > 0 ? (
                  <TrendSparkline
                    data={recentLabs.slice(0, 10).map(lab => 
                      lab.valueQuantity?.value || 0
                    ).reverse()}
                    width={60}
                    height={20}
                    color="info"
                    showArea
                  />
                ) : null}
                sx={{ height: '100%' }}
              >
                <List disablePadding>
                  {recentLabs.length > 0 ? (
                    recentLabs.slice(0, density === 'compact' ? 3 : 5).map((lab) => {
                      const interpretation = getObservationInterpretation(lab);
                      const isAbnormal = interpretation === 'H' || interpretation === 'L';
                      
                      return (
                        <ListItem
                          key={lab.id}
                          sx={{ 
                            px: density === 'compact' ? 1 : 2,
                            py: density === 'compact' ? 0.5 : 1,
                            backgroundColor: isAbnormal ? 
                              alpha(theme.palette.error.main, 0.04) : 'transparent'
                          }}
                        >
                          <ListItemIcon sx={{ minWidth: 36 }}>
                            <LabIcon 
                              color={isAbnormal ? 'error' : 'info'}
                              fontSize={density === 'compact' ? 'small' : 'medium'}
                            />
                          </ListItemIcon>
                          <ListItemText 
                            primary={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography 
                                  variant={density === 'compact' ? 'body2' : 'body1'}
                                  noWrap
                                >
                                  {getResourceDisplayText(lab)}
                                </Typography>
                                {isAbnormal && (
                                  <Chip 
                                    label={interpretation} 
                                    size="small" 
                                    color="error"
                                    sx={{ height: 16, fontSize: '0.7rem' }}
                                  />
                                )}
                              </Box>
                            }
                            secondary={
                              <>
                                {lab.valueQuantity ? 
                                  `${lab.valueQuantity.value} ${lab.valueQuantity.unit}` : 
                                  lab.valueString || 'Pending'
                                }
                                {' • '}
                                {format(parseISO(lab.effectiveDateTime || lab.issued), 'MMM d')}
                              </>
                            }
                            secondaryTypographyProps={{
                              variant: 'caption'
                            }}
                          />
                        </ListItem>
                      );
                    })
                  ) : (
                    <Typography 
                      variant="body2" 
                      color="text.secondary"
                      sx={{ p: 2, textAlign: 'center' }}
                    >
                      No recent lab results
                    </Typography>
                  )}
                </List>
              </ClinicalCard>
            </motion.div>
          </Grid>

          {/* Upcoming Care Card */}
          <Grid item xs={12} md={6}>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.5 }}
            >
              <ClinicalCard
                title="Upcoming Care"
                subtitle="Next appointments & tasks"
                expandable={false}
                actions={[
                  {
                    label: 'Schedule',
                    onClick: () => navigate(`/clinical/${patientId}?tab=encounters`)
                  }
                ]}
                sx={{ height: '100%' }}
              >
                <List disablePadding>
                  {encounters.filter(enc => {
                    const startDate = enc.period?.start;
                    return startDate && new Date(startDate) > new Date() && enc.status === 'planned';
                  }).slice(0, density === 'compact' ? 3 : 5).map((encounter) => (
                    <ListItem
                      key={encounter.id}
                      sx={{ 
                        px: density === 'compact' ? 1 : 2,
                        py: density === 'compact' ? 0.5 : 1
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <CalendarIcon 
                          color="secondary" 
                          fontSize={density === 'compact' ? 'small' : 'medium'}
                        />
                      </ListItemIcon>
                      <ListItemText 
                        primary={encounter.type?.[0]?.text || 'Appointment'}
                        secondary={encounter.period?.start ? 
                          format(parseISO(encounter.period.start), 'MMM d, yyyy h:mm a') : 
                          'Date TBD'
                        }
                        primaryTypographyProps={{
                          variant: density === 'compact' ? 'body2' : 'body1',
                          noWrap: density === 'compact'
                        }}
                        secondaryTypographyProps={{
                          variant: 'caption'
                        }}
                      />
                    </ListItem>
                  ))}
                  {stats.overdueItems > 0 && (
                    <ListItem
                      sx={{ 
                        px: density === 'compact' ? 1 : 2,
                        py: density === 'compact' ? 0.5 : 1,
                        backgroundColor: alpha(theme.palette.error.main, 0.04)
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <WarningIcon 
                          color="error" 
                          fontSize={density === 'compact' ? 'small' : 'medium'}
                        />
                      </ListItemIcon>
                      <ListItemText 
                        primary={`${stats.overdueItems} overdue items`}
                        secondary="Action required"
                        primaryTypographyProps={{
                          variant: density === 'compact' ? 'body2' : 'body1',
                          color: 'error'
                        }}
                        secondaryTypographyProps={{
                          variant: 'caption'
                        }}
                      />
                    </ListItem>
                  )}
                  {encounters.filter(enc => enc.status === 'planned').length === 0 && 
                   stats.overdueItems === 0 && (
                    <Typography 
                      variant="body2" 
                      color="text.secondary"
                      sx={{ p: 2, textAlign: 'center' }}
                    >
                      No upcoming appointments
                    </Typography>
                  )}
                </List>
              </ClinicalCard>
            </motion.div>
          </Grid>
        </Grid>

        {/* Additional Information Row */}
        <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
          Recent Activity
        </Typography>
        <Grid container spacing={density === 'compact' ? 1 : 2}>
          {/* Recent Encounters */}
          <Grid item xs={12} md={6}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.6 }}
            >
              <Card sx={{ height: '100%' }}>
                <CardHeader
                  title="Recent Visits"
                  titleTypographyProps={{ variant: 'h6' }}
                  action={
                    <IconButton 
                      size="small"
                      onClick={() => navigate(`/clinical/${patientId}?tab=encounters`)}
                    >
                      <ArrowIcon />
                    </IconButton>
                  }
                />
                <CardContent sx={{ pt: 0 }}>
                  <List disablePadding>
                    {recentEncounters.slice(0, density === 'compact' ? 3 : 4).map((encounter) => (
                      <ListItem 
                        key={encounter.id}
                        sx={{ px: 0 }}
                      >
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <EncounterIcon color="action" fontSize="small" />
                        </ListItemIcon>
                        <ListItemText 
                          primary={encounter.type?.[0]?.text || 'Encounter'}
                          secondary={
                            encounter.period?.start ? 
                              format(parseISO(encounter.period.start), 'MMM d, yyyy') : 
                              'Date unknown'
                          }
                          primaryTypographyProps={{ variant: 'body2' }}
                          secondaryTypographyProps={{ variant: 'caption' }}
                        />
                        <StatusChip 
                          status={getEncounterStatus(encounter)}
                          size="small"
                        />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            </motion.div>
          </Grid>

          {/* Care Team Summary */}
          <Grid item xs={12} md={6}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.7 }}
            >
              <CareTeamSummary
                patientId={patientId}
                onViewFullTeam={() => navigate(`/clinical/${patientId}?tab=carePlan`)}
              />
            </motion.div>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
};

export default SummaryTab;