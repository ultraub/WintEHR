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
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import { useNavigate } from 'react-router-dom';
import { useMedicationResolver } from '../../../../hooks/useMedicationResolver';
import { printDocument, formatConditionsForPrint, formatMedicationsForPrint, formatLabResultsForPrint } from '../../../../utils/printUtils';
import { useClinicalWorkflow, CLINICAL_EVENTS } from '../../../../contexts/ClinicalWorkflowContext';

// Metric Card Component
const MetricCard = ({ title, value, subValue, icon, color = 'primary', trend, onClick }) => {
  const theme = useTheme();
  
  return (
    <Card 
      sx={{ 
        height: '100%', 
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.2s',
        '&:hover': onClick ? {
          transform: 'translateY(-2px)',
          boxShadow: 3
        } : {}
      }}
      onClick={onClick}
    >
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: color && theme.palette[color]?.main 
                ? alpha(theme.palette[color].main, 0.1)
                : alpha(theme.palette.primary.main, 0.1),
              color: color && theme.palette[color]?.main 
                ? theme.palette[color].main 
                : theme.palette.primary.main
            }}
          >
            {icon}
          </Box>
          {trend && (
            <Chip
              size="small"
              icon={trend === 'up' ? <TrendingUpIcon /> : <TrendingDownIcon />}
              label={`${trend === 'up' ? '+' : '-'}${Math.abs(trend)}%`}
              color={trend === 'up' ? 'success' : 'error'}
              variant="outlined"
            />
          )}
        </Box>
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          {value}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {title}
        </Typography>
        {subValue && (
          <Typography variant="caption" color="text.secondary">
            {subValue}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

// Recent Item Component
const RecentItem = ({ primary, secondary, icon, status, onClick }) => (
  <ListItem 
    button 
    onClick={onClick}
    sx={{ 
      borderRadius: 1,
      mb: 1,
      '&:hover': { backgroundColor: 'action.hover' }
    }}
  >
    <ListItemIcon>{icon}</ListItemIcon>
    <ListItemText 
      primary={primary}
      secondary={secondary}
    />
    {status && (
      <Chip 
        label={status} 
        size="small" 
        color={status === 'Critical' ? 'error' : 'default'}
      />
    )}
  </ListItem>
);

const SummaryTab = ({ patientId, onNotificationUpdate }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { 
    getPatientResources, 
    searchResources, 
    isResourceLoading,
    currentPatient 
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

  // Load all patient data
  useEffect(() => {
    loadDashboardData();
  }, [patientId]);

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
          loadDashboardData();
        }
      });
      unsubscribers.push(unsubscribe);
    });

    // Cleanup subscriptions on unmount
    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, [subscribe, patientId]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Get all resources
      const conditions = getPatientResources(patientId, 'Condition') || [];
      const medications = getPatientResources(patientId, 'MedicationRequest') || [];
      const observations = getPatientResources(patientId, 'Observation') || [];
      const encounters = getPatientResources(patientId, 'Encounter') || [];
      const allergies = getPatientResources(patientId, 'AllergyIntolerance') || [];

      // Calculate stats
      const activeConditions = conditions.filter(c => {
        // Check multiple possible locations for clinical status
        const status = c.clinicalStatus?.coding?.[0]?.code || 
                      c.clinicalStatus?.code ||
                      c.clinicalStatus;
        return status === 'active';
      });
      const activeMeds = medications.filter(m => 
        m.status === 'active'
      );
      
      // Recent labs (last 7 days)
      const recentLabs = observations.filter(o => {
        if (o.category?.[0]?.coding?.[0]?.code === 'laboratory') {
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
        if (med.status === 'active' && med.dispenseRequest?.validityPeriod?.end) {
          const endDate = new Date(med.dispenseRequest.validityPeriod.end);
          if (endDate < new Date()) {
            overdueCount++;
          }
        }
      });

      // Check for overdue lab orders
      const labOrders = getPatientResources(patientId, 'ServiceRequest') || [];
      labOrders.forEach(order => {
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
      console.error('Error loading summary data:', error);
      // In production, this would show an error notification to the user
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };


  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadDashboardData();
  }, []);

  const handlePrintSummary = () => {
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
    const activeConditions = conditions.filter(c => {
      const status = c.clinicalStatus?.coding?.[0]?.code || 
                    c.clinicalStatus?.code ||
                    c.clinicalStatus;
      return status === 'active';
    });
    content += formatConditionsForPrint(activeConditions);
    
    // Active Medications
    content += '<h3>Active Medications</h3>';
    const activeMeds = medications.filter(m => m.status === 'active');
    content += formatMedicationsForPrint(activeMeds);
    
    // Recent Lab Results
    content += '<h3>Recent Lab Results (Last 7 Days)</h3>';
    content += formatLabResultsForPrint(recentLabs);
    
    // Allergies
    if (allergies.length > 0) {
      content += '<h3>Allergies</h3>';
      content += '<ul>';
      allergies.forEach(allergy => {
        const allergyText = allergy.code?.text || allergy.code?.coding?.[0]?.display || 'Unknown';
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

  // Get recent items
  const conditions = getPatientResources(patientId, 'Condition') || [];
  const medications = getPatientResources(patientId, 'MedicationRequest') || [];
  const observations = getPatientResources(patientId, 'Observation') || [];
  const encounters = getPatientResources(patientId, 'Encounter') || [];
  const allergies = getPatientResources(patientId, 'AllergyIntolerance') || [];
  
  // Resolve medication references
  const { getMedicationDisplay } = useMedicationResolver(medications);

  // Memoized data processing to prevent recalculation on every render
  const processedData = useMemo(() => {
    return {
      recentConditions: conditions
        .sort((a, b) => new Date(b.recordedDate || 0) - new Date(a.recordedDate || 0))
        .slice(0, 5),
      
      recentMedications: medications
        .filter(m => m.status === 'active')
        .sort((a, b) => new Date(b.authoredOn || 0) - new Date(a.authoredOn || 0))
        .slice(0, 5),
      
      recentLabs: observations
        .filter(o => o.category?.[0]?.coding?.[0]?.code === 'laboratory')
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
    <Box sx={{ p: 3 }}>
      {refreshing && <LinearProgress sx={{ mb: 2 }} />}
      
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">
          Clinical Summary
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="caption" color="text.secondary">
            Last updated: {formatDistanceToNow(lastRefresh, { addSuffix: true })}
          </Typography>
          <IconButton onClick={handlePrintSummary} title="Print Summary">
            <PrintIcon />
          </IconButton>
          <IconButton onClick={handleRefresh} disabled={refreshing}>
            <RefreshIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Metric Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Active Problems"
            value={stats.activeProblems}
            icon={<ProblemIcon />}
            color="warning"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Active Medications"
            value={stats.activeMedications}
            icon={<MedicationIcon />}
            color="primary"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Recent Labs"
            value={stats.recentLabs}
            subValue="Last 7 days"
            icon={<LabIcon />}
            color="info"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Overdue Items"
            value={stats.overdueItems}
            icon={<WarningIcon />}
            color="error"
            trend={-25}
          />
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
              • {allergy.code?.text || allergy.code?.coding?.[0]?.display || 'Unknown'} 
              {allergy.criticality && ` (${allergy.criticality})`}
            </Typography>
          ))}
        </Alert>
      )}

      {/* Recent Activity Grid */}
      <Grid container spacing={3}>
        {/* Recent Problems */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader
              title="Recent Problems"
              action={
                <IconButton onClick={() => navigate(`/clinical/${patientId}?tab=chart`)}>
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
                      primary={condition.code?.text || condition.code?.coding?.[0]?.display}
                      secondary={condition.recordedDate ? 
                        `Recorded ${format(parseISO(condition.recordedDate), 'MMM d, yyyy')}` : 
                        'Date unknown'
                      }
                      icon={<ProblemIcon color="warning" />}
                      status={condition.clinicalStatus?.coding?.[0]?.code}
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
          <Card>
            <CardHeader
              title="Active Medications"
              action={
                <IconButton onClick={() => navigate(`/medications`)}>
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
                      secondary={med.dosageInstruction?.[0]?.text || 'No dosage information'}
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
          <Card>
            <CardHeader
              title="Recent Lab Results"
              action={
                <IconButton onClick={() => navigate(`/clinical/${patientId}?tab=results`)}>
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
                      primary={lab.code?.text || lab.code?.coding?.[0]?.display}
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
                      status={lab.interpretation?.[0]?.coding?.[0]?.code === 'H' ? 'High' : 
                              lab.interpretation?.[0]?.coding?.[0]?.code === 'L' ? 'Low' : null}
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
          <Card>
            <CardHeader
              title="Recent Encounters"
              action={
                <IconButton onClick={() => navigate(`/clinical/${patientId}?tab=encounters`)}>
                  <ArrowIcon />
                </IconButton>
              }
            />
            <CardContent>
              <List disablePadding>
                {recentEncounters.length > 0 ? (
                  recentEncounters.map((encounter) => (
                    <RecentItem
                      key={encounter.id}
                      primary={encounter.type?.[0]?.text || encounter.type?.[0]?.coding?.[0]?.display || 'Encounter'}
                      secondary={
                        encounter.period?.start ? 
                          format(parseISO(encounter.period.start), 'MMM d, yyyy h:mm a') : 
                          'Date unknown'
                      }
                      icon={<EncounterIcon color="secondary" />}
                      status={encounter.status}
                      onClick={() => navigate(`/clinical/${patientId}?tab=chart`)}
                    />
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
      </Grid>
    </Box>
  );
};

export default SummaryTab;