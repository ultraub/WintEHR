/**
 * Summary Tab Component
 * Patient overview dashboard with key clinical information
 */
import React, { useState, useEffect } from 'react';
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
  CalendarMonth as CalendarIcon
} from '@mui/icons-material';
import { format, formatDistanceToNow, parseISO, isWithinInterval, subDays } from 'date-fns';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import { useNavigate } from 'react-router-dom';

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
              backgroundColor: alpha(theme.palette[color].main, 0.1),
              color: theme.palette[color].main
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
    isLoading 
  } = useFHIRResource();

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
      const activeConditions = conditions.filter(c => 
        c.clinicalStatus?.coding?.[0]?.code === 'active'
      );
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

      // Update stats
      setStats({
        activeProblems: activeConditions.length,
        activeMedications: activeMeds.length,
        recentLabs: recentLabs.length,
        upcomingAppointments: 0, // TODO: Implement appointment counting
        overdueItems: 3 // TODO: Calculate actual overdue items
      });

      // Update notifications
      if (onNotificationUpdate && recentLabs.length > 0) {
        onNotificationUpdate(recentLabs.length);
      }

      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  // Get recent items
  const conditions = getPatientResources(patientId, 'Condition') || [];
  const medications = getPatientResources(patientId, 'MedicationRequest') || [];
  const observations = getPatientResources(patientId, 'Observation') || [];
  const encounters = getPatientResources(patientId, 'Encounter') || [];
  const allergies = getPatientResources(patientId, 'AllergyIntolerance') || [];

  // Sort and limit items
  const recentConditions = conditions
    .sort((a, b) => new Date(b.recordedDate || 0) - new Date(a.recordedDate || 0))
    .slice(0, 5);

  const recentMedications = medications
    .filter(m => m.status === 'active')
    .sort((a, b) => new Date(b.authoredOn || 0) - new Date(a.authoredOn || 0))
    .slice(0, 5);

  const recentLabs = observations
    .filter(o => o.category?.[0]?.coding?.[0]?.code === 'laboratory')
    .sort((a, b) => new Date(b.effectiveDateTime || b.issued || 0) - new Date(a.effectiveDateTime || a.issued || 0))
    .slice(0, 5);

  const recentEncounters = encounters
    .sort((a, b) => new Date(b.period?.start || 0) - new Date(a.period?.start || 0))
    .slice(0, 5);

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
            onClick={() => navigate(`/patients/${patientId}/problems`)}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Active Medications"
            value={stats.activeMedications}
            icon={<MedicationIcon />}
            color="primary"
            onClick={() => navigate(`/patients/${patientId}/medications`)}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Recent Labs"
            value={stats.recentLabs}
            subValue="Last 7 days"
            icon={<LabIcon />}
            color="info"
            onClick={() => navigate(`/patients/${patientId}/results`)}
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
            <Button size="small" onClick={() => navigate(`/patients/${patientId}/allergies`)}>
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
                <IconButton onClick={() => navigate(`/patients/${patientId}/problems`)}>
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
                      onClick={() => navigate(`/patients/${patientId}/problems/${condition.id}`)}
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
                <IconButton onClick={() => navigate(`/patients/${patientId}/medications`)}>
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
                      primary={
                        med.medicationCodeableConcept?.text || 
                        med.medicationCodeableConcept?.coding?.[0]?.display ||
                        'Unknown medication'
                      }
                      secondary={med.dosageInstruction?.[0]?.text || 'No dosage information'}
                      icon={<MedicationIcon color="primary" />}
                      onClick={() => navigate(`/patients/${patientId}/medications/${med.id}`)}
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
                <IconButton onClick={() => navigate(`/patients/${patientId}/results`)}>
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
                        <Box>
                          <Typography variant="caption">
                            {lab.valueQuantity ? 
                              `${lab.valueQuantity.value} ${lab.valueQuantity.unit}` : 
                              lab.valueString || 'Result pending'
                            }
                          </Typography>
                          <Typography variant="caption" color="text.secondary" display="block">
                            {format(parseISO(lab.effectiveDateTime || lab.issued), 'MMM d, yyyy')}
                          </Typography>
                        </Box>
                      }
                      icon={<LabIcon color="info" />}
                      status={lab.interpretation?.[0]?.coding?.[0]?.code === 'H' ? 'High' : 
                              lab.interpretation?.[0]?.coding?.[0]?.code === 'L' ? 'Low' : null}
                      onClick={() => navigate(`/patients/${patientId}/results/${lab.id}`)}
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
                <IconButton onClick={() => navigate(`/patients/${patientId}/encounters`)}>
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
                      onClick={() => navigate(`/patients/${patientId}/encounters/${encounter.id}`)}
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