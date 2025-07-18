/**
 * Summary Tab Component
 * Patient overview dashboard with key clinical information
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Grid,
  Paper,
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
import { useFHIRResource, usePatientResources } from '../../../../contexts/FHIRResourceContext';
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
      const batchBundle = {
        resourceType: "Bundle",
        type: "batch",
        entry: [
          {
            request: {
              method: "GET",
              url: `Condition?patient=${patientId}&clinical-status=active&_summary=count`
            }
          },
          {
            request: {
              method: "GET",
              url: `MedicationRequest?patient=${patientId}&status=active&_summary=count`
            }
          },
          {
            request: {
              method: "GET",
              url: `Observation?patient=${patientId}&category=laboratory&date=ge${subDays(new Date(), 7).toISOString().split('T')[0]}&_summary=count`
            }
          },
          {
            request: {
              method: "GET",
              url: `AllergyIntolerance?patient=${patientId}&_summary=count`
            }
          }
        ]
      };

      const batchResult = await fhirClient.batch(batchBundle);
      
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
      console.error('Error loading summary stats:', error);
      // Fallback to original method
      if (patientId && !isCacheWarm(patientId, ['Condition', 'MedicationRequest', 'Observation', 'AllergyIntolerance'])) {
        fetchPatientBundle(patientId, false, 'critical');
      }
    }
  }, [patientId, fhirClient, isCacheWarm, fetchPatientBundle]);

  // Load optimized summary stats on patient change
  useEffect(() => {
    loadSummaryStats();
  }, [loadSummaryStats]);

  // Get resources from context - these are already cached and shared
  const conditions = useMemo(() => {
    console.log('[SummaryTab] Raw Condition resources:', resources.Condition);
    const filtered = Object.values(resources.Condition || {}).filter(c => 
      c.subject?.reference === `Patient/${patientId}` || 
      c.subject?.reference === `urn:uuid:${patientId}` ||
      c.patient?.reference === `Patient/${patientId}` ||
      c.patient?.reference === `urn:uuid:${patientId}`
    );
    console.log('[SummaryTab] Filtered conditions:', filtered);
    return filtered;
  }, [resources.Condition, patientId]);
  
  const medications = useMemo(() => {
    console.log('[SummaryTab] Raw MedicationRequest resources:', resources.MedicationRequest);
    const filtered = Object.values(resources.MedicationRequest || {}).filter(m => 
      m.subject?.reference === `Patient/${patientId}` || 
      m.subject?.reference === `urn:uuid:${patientId}` ||
      m.patient?.reference === `Patient/${patientId}` ||
      m.patient?.reference === `urn:uuid:${patientId}`
    );
    console.log('[SummaryTab] Filtered medications:', filtered);
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
        overdueItems: overdueCount
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
    
    console.log('[SummaryTab] Resource check:', {
      patientId,
      conditions: conditions.length,
      medications: medications.length,
      observations: observations.length,
      encounters: encounters.length,
      isLoading: isResourceLoading(patientId),
      isCacheWarm: isCacheWarm(patientId)
    });
    
    // Check if we have any resources loaded for this patient
    const hasAnyResources = conditions.length > 0 || medications.length > 0 || observations.length > 0 || encounters.length > 0;
    
    if (hasAnyResources) {
      // We have resources, process them
      console.log('[SummaryTab] Processing resources...');
      loadDashboardData();
      setLoading(false);
    } else {
      // No resources yet, check if we're already loading from context
      if (isResourceLoading(patientId)) {
        console.log('[SummaryTab] Resources are loading from context...');
        setLoading(true);
      } else if (!isCacheWarm(patientId)) {
        // Cache isn't warm and we're not loading, trigger a fetch
        console.log('[SummaryTab] Cache not warm, fetching patient bundle...');
        setLoading(true);
        fetchPatientBundle(patientId, false, 'critical');
      } else {
        // Cache is warm but no resources - patient might have no data
        console.log('[SummaryTab] Cache is warm but no resources found');
        setLoading(false);
      }
    }
  }, [patientId, conditions.length, medications.length, observations.length, encounters.length, allergies.length, serviceRequests.length]);

  // Note: Removed problematic useEffect that was causing infinite loops
  // Data refreshing is now handled only by the event system below

  // Subscribe to clinical events to refresh summary when data changes
  useEffect(() => {
    const unsubscribers = [];

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
          setTimeout(() => loadDashboardData(), 100);
        }
      });
      unsubscribers.push(unsubscribe);
    });

    // Cleanup subscriptions on unmount
    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, [subscribe, patientId]); // Removed loadDashboardData dependency to prevent loops


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
        .slice(0, 5)
    };
  }, [conditions, medications, observations, encounters]);
  
  const { recentConditions, recentMedications, recentLabs, recentEncounters } = processedData;

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
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      {refreshing && <LinearProgress sx={{ mb: 2 }} />}
      
      {/* Header */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: { xs: 'flex-start', md: 'center' }, 
        mb: 3,
        flexDirection: { xs: 'column', md: 'row' },
        gap: { xs: 2, md: 0 }
      }}>
        <Typography variant="h5" fontWeight="bold">
          Clinical Summary
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography 
            variant="caption" 
            color="text.secondary"
            sx={{ display: { xs: 'none', sm: 'block' } }}
          >
            Last updated: {formatDistanceToNow(lastRefresh, { addSuffix: true })}
          </Typography>
          <IconButton 
            onClick={handlePrintSummary} 
            title="Print Summary"
            aria-label="Print clinical summary for this patient"
            sx={{
              transition: `all ${theme.animations?.duration?.short || 250}ms ${theme.animations?.easing?.easeInOut || 'ease-in-out'}`,
              '&:hover': {
                transform: 'scale(1.1)',
                backgroundColor: theme.clinical?.interactions?.hover || alpha(theme.palette.primary.main, 0.08)
              }
            }}
          >
            <PrintIcon />
          </IconButton>
          <IconButton 
            onClick={handleRefresh} 
            disabled={refreshing}
            aria-label={refreshing ? "Refreshing summary data..." : "Refresh summary data"}
            sx={{
              transition: `all ${theme.animations?.duration?.short || 250}ms ${theme.animations?.easing?.easeInOut || 'ease-in-out'}`,
              '&:hover': {
                transform: 'scale(1.1)',
                backgroundColor: theme.clinical?.interactions?.hover || alpha(theme.palette.primary.main, 0.08)
              },
              ...(refreshing && {
                animation: 'spin 1s linear infinite',
                '@keyframes spin': {
                  '0%': { transform: 'rotate(0deg)' },
                  '100%': { transform: 'rotate(360deg)' }
                }
              })
            }}
          >
            <RefreshIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Metric Cards */}
      <Grid container spacing={{ xs: 2, md: 3 }} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Box sx={{
            animation: loading ? 'none' : 'slideInUp 0.4s ease-out 0.1s both',
            '@keyframes slideInUp': {
              '0%': { transform: 'translateY(20px)', opacity: 0 },
              '100%': { transform: 'translateY(0)', opacity: 1 }
            }
          }}>
            <MetricCard
              title="Active Problems"
              value={stats.activeProblems}
              icon={<ProblemIcon />}
              color="warning"
              variant="clinical"
            />
          </Box>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Box sx={{
            animation: loading ? 'none' : 'slideInUp 0.4s ease-out 0.2s both',
            '@keyframes slideInUp': {
              '0%': { transform: 'translateY(20px)', opacity: 0 },
              '100%': { transform: 'translateY(0)', opacity: 1 }
            }
          }}>
            <MetricCard
              title="Active Medications"
              value={stats.activeMedications}
              icon={<MedicationIcon />}
              color="primary"
              variant="clinical"
            />
          </Box>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Box sx={{
            animation: loading ? 'none' : 'slideInUp 0.4s ease-out 0.3s both',
            '@keyframes slideInUp': {
              '0%': { transform: 'translateY(20px)', opacity: 0 },
              '100%': { transform: 'translateY(0)', opacity: 1 }
            }
          }}>
            <MetricCard
              title="Recent Labs"
              value={stats.recentLabs}
              subtitle="Last 7 days"
              icon={<LabIcon />}
              color="info"
              variant="clinical"
            />
          </Box>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Box sx={{
            animation: loading ? 'none' : 'slideInUp 0.4s ease-out 0.4s both',
            '@keyframes slideInUp': {
              '0%': { transform: 'translateY(20px)', opacity: 0 },
              '100%': { transform: 'translateY(0)', opacity: 1 }
            }
          }}>
            <MetricCard
              title="Overdue Items"
              value={stats.overdueItems}
              icon={<WarningIcon />}
              color="error"
              trend="down"
              trendValue={-25}
              variant="clinical"
            />
          </Box>
        </Grid>
      </Grid>


      {/* Clinical Alerts */}
      {allergies.length > 0 && (
        <Alert 
          severity="error" 
          sx={{ mb: 3 }}
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

      {/* Recent Activity Grid */}
      <Grid container spacing={{ xs: 2, md: 3 }}>
        {/* Recent Problems */}
        <Grid item xs={12} md={6}>
          <Card sx={{
            transition: `all ${theme.animations?.duration?.standard || 300}ms ${theme.animations?.easing?.easeInOut || 'ease-in-out'}`,
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: `0 8px 24px ${alpha(theme.palette.warning.main, 0.15)}`
            }
          }}>
            <CardHeader
              title="Recent Problems"
              action={
                <IconButton 
                  onClick={() => navigate(`/clinical/${patientId}?tab=chart`)}
                  sx={{
                    transition: `all ${theme.animations?.duration?.short || 250}ms ${theme.animations?.easing?.easeInOut || 'ease-in-out'}`,
                    '&:hover': {
                      transform: 'rotate(45deg)',
                      backgroundColor: theme.clinical?.interactions?.hover || 'action.hover'
                    }
                  }}
                >
                  <ArrowIcon />
                </IconButton>
              }
            />
            <CardContent>
              <List disablePadding>
                {recentConditions.length > 0 ? (
                  recentConditions.map((condition) => (
                    <RecentItem
                      key={condition.id}
                      primary={getResourceDisplayText(condition)}
                      secondary={condition.recordedDate ? 
                        `Recorded ${format(parseISO(condition.recordedDate), 'MMM d, yyyy')}` : 
                        'Date unknown'
                      }
                      icon={<ProblemIcon color="warning" />}
                      status={getConditionStatus(condition)}
                      onClick={() => navigate(`/clinical/${patientId}?tab=chart`)}
                    />
                  ))
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No problems recorded
                  </Typography>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Medications */}
        <Grid item xs={12} md={6}>
          <Card sx={{
            transition: `all ${theme.animations?.duration?.standard || 300}ms ${theme.animations?.easing?.easeInOut || 'ease-in-out'}`,
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.15)}`
            }
          }}>
            <CardHeader
              title="Active Medications"
              action={
                <IconButton 
                  onClick={() => navigate(`/medications`)}
                  sx={{
                    transition: `all ${theme.animations?.duration?.short || 250}ms ${theme.animations?.easing?.easeInOut || 'ease-in-out'}`,
                    '&:hover': {
                      transform: 'rotate(45deg)',
                      backgroundColor: theme.clinical?.interactions?.hover || 'action.hover'
                    }
                  }}
                >
                  <ArrowIcon />
                </IconButton>
              }
            />
            <CardContent>
              <List disablePadding>
                {recentMedications.length > 0 ? (
                  recentMedications.map((med) => (
                    <RecentItem
                      key={med.id}
                      primary={getMedicationDisplay(med)}
                      secondary={getMedicationDosageDisplay(med)}
                      icon={<MedicationIcon color="primary" />}
                      onClick={() => navigate(`/clinical/${patientId}?tab=chart`)}
                    />
                  ))
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No active medications
                  </Typography>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Labs */}
        <Grid item xs={12} md={6}>
          <Card sx={{
            transition: `all ${theme.animations?.duration?.standard || 300}ms ${theme.animations?.easing?.easeInOut || 'ease-in-out'}`,
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: `0 8px 24px ${alpha(theme.palette.info.main, 0.15)}`
            }
          }}>
            <CardHeader
              title="Recent Lab Results"
              action={
                <IconButton 
                  onClick={() => navigate(`/clinical/${patientId}?tab=results`)}
                  sx={{
                    transition: `all ${theme.animations?.duration?.short || 250}ms ${theme.animations?.easing?.easeInOut || 'ease-in-out'}`,
                    '&:hover': {
                      transform: 'rotate(45deg)',
                      backgroundColor: theme.clinical?.interactions?.hover || 'action.hover'
                    }
                  }}
                >
                  <ArrowIcon />
                </IconButton>
              }
            />
            <CardContent>
              <List disablePadding>
                {recentLabs.length > 0 ? (
                  recentLabs.map((lab) => (
                    <RecentItem
                      key={lab.id}
                      primary={getResourceDisplayText(lab)}
                      secondary={
                        <>
                          {lab.valueQuantity ? 
                            `${lab.valueQuantity.value} ${lab.valueQuantity.unit}` : 
                            lab.valueString || 'Result pending'
                          }
                          {' • '}
                          {format(parseISO(lab.effectiveDateTime || lab.issued), 'MMM d, yyyy')}
                        </>
                      }
                      icon={<LabIcon color="info" />}
                      status={(() => {
                        const interpretation = getObservationInterpretation(lab);
                        return interpretation === 'H' ? 'High' : 
                               interpretation === 'L' ? 'Low' : null;
                      })()}
                      onClick={() => navigate(`/clinical/${patientId}?tab=chart`)}
                    />
                  ))
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No recent lab results
                  </Typography>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Encounters */}
        <Grid item xs={12} md={6}>
          <Card sx={{
            transition: `all ${theme.animations?.duration?.standard || 300}ms ${theme.animations?.easing?.easeInOut || 'ease-in-out'}`,
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.15)}`
            }
          }}>
            <CardHeader
              title="Recent Encounters"
              action={
                <IconButton 
                  onClick={() => navigate(`/clinical/${patientId}?tab=encounters`)}
                  sx={{
                    transition: `all ${theme.animations?.duration?.short || 250}ms ${theme.animations?.easing?.easeInOut || 'ease-in-out'}`,
                    '&:hover': {
                      transform: 'rotate(45deg)',
                      backgroundColor: theme.clinical?.interactions?.hover || 'action.hover'
                    }
                  }}
                >
                  <ArrowIcon />
                </IconButton>
              }
            />
            <CardContent>
              <List disablePadding>
                {recentEncounters.length > 0 ? (
                  recentEncounters.map((encounter) => (
                    <ListItem 
                      key={encounter.id}
                      component="button"
                      onClick={() => navigate(`/clinical/${patientId}?tab=encounters`)}
                      sx={{ 
                        borderRadius: theme.shape.borderRadius / 8,
                        mb: theme.clinicalSpacing?.sm || 1,
                        transition: `all ${theme.animations?.duration?.short || 250}ms ${theme.animations?.easing?.easeInOut || 'ease-in-out'}`,
                        '&:hover': { 
                          backgroundColor: theme.clinical?.interactions?.hover || 'action.hover',
                          transform: 'translateY(-1px)',
                          boxShadow: `0 2px 8px ${alpha(theme.palette.secondary.main, 0.1)}`
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
                    >
                      <ListItemIcon>
                        <EncounterIcon color="secondary" />
                      </ListItemIcon>
                      <ListItemText 
                        primary={encounter.type?.[0]?.text || encounter.type?.[0]?.coding?.[0]?.display || 'Encounter'}
                        secondary={
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              {(encounter.actualPeriod || encounter.period)?.start ? 
                                format(parseISO((encounter.actualPeriod || encounter.period).start), 'MMM d, yyyy h:mm a') : 
                                'Date unknown'
                              }
                            </Typography>
                            {encounter.participant && (
                              <EnhancedProviderDisplay
                                participants={encounter.participant}
                                encounter={encounter}
                                mode="compact"
                                showIcon={false}
                              />
                            )}
                          </Box>
                        }
                      />
                      <StatusChip 
                        status={getEncounterStatus(encounter)}
                        size="small"
                        variant="clinical"
                      />
                    </ListItem>
                  ))
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No recent encounters
                  </Typography>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Care Team Summary */}
        <Grid item xs={12} md={6}>
          <CareTeamSummary
            patientId={patientId}
            onViewFullTeam={() => navigate(`/clinical/${patientId}?tab=carePlan`)}
          />
        </Grid>
      </Grid>
    </Box>
  );
};

export default SummaryTab;