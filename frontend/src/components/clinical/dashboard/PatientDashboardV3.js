/**
 * PatientDashboardV3 Component
 * Modernized patient dashboard with improved performance and UX
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  Stack,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemButton,
  Divider,
  Badge,
  LinearProgress,
  Collapse,
  useTheme,
  alpha,
  Fab,
  Skeleton,
  Zoom,
  Fade
} from '@mui/material';
import {
  Person as PersonIcon,
  LocalHospital as HospitalIcon,
  Medication as MedicationIcon,
  Warning as WarningIcon,
  Healing as ConditionIcon,
  Assignment as TaskIcon,
  Assignment as AssignmentIcon,
  Group as TeamIcon,
  Description as DocumentIcon,
  Science as LabIcon,
  MonitorHeart as VitalsIcon,
  Shield as CoverageIcon,
  Event as EventIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Timeline as TimelineIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Home as HomeIcon,
  Refresh as RefreshIcon,
  Add as AddIcon,
  Edit as EditIcon,
  ChevronRight as ChevronRightIcon,
  Star as StarIcon,
  FiberManualRecord as DotIcon,
  AccessTime as ClockIcon,
  LocationOn as LocationIcon
} from '@mui/icons-material';
import { format, differenceInYears, parseISO, formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useFHIRResource } from '../../../contexts/FHIRResourceContext';
import { fhirClient } from '../../../services/fhirClient';
import { encodeFhirId } from '../../../utils/navigationUtils';
import FHIRDataDebug from '../../FHIRDataDebug';

// Custom hook for consolidated data fetching
const usePatientDashboardData = (patientId) => {
  const [data, setData] = useState({
    patient: null,
    encounters: [],
    conditions: [],
    medications: [],
    observations: [],
    allergies: [],
    carePlans: [],
    careTeam: [],
    coverage: [],
    documentReferences: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  const fetchData = useCallback(async () => {
    if (!patientId) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch all data in parallel
      const results = await Promise.allSettled([
        fhirClient.read('Patient', patientId),
        fhirClient.search('Encounter', { patient: patientId, _sort: '-date', _count: 10 }),
        fhirClient.search('Condition', { patient: patientId, 'clinical-status': 'active' }),
        fhirClient.search('MedicationRequest', { patient: patientId, status: 'active' }),
        fhirClient.search('Observation', { patient: patientId, _sort: '-date', _count: 20 }),
        fhirClient.search('AllergyIntolerance', { patient: patientId }),
        fhirClient.search('CarePlan', { patient: patientId, status: 'active' }),
        fhirClient.search('CareTeam', { patient: patientId, status: 'active' }),
        fhirClient.search('Coverage', { patient: patientId, status: 'active' }),
        fhirClient.search('DocumentReference', { patient: patientId, _sort: '-date', _count: 5 })
      ]);

      // Process results with error handling
      const [
        patientResult,
        encountersResult,
        conditionsResult,
        medicationsResult,
        observationsResult,
        allergiesResult,
        carePlansResult,
        careTeamResult,
        coverageResult,
        documentsResult
      ] = results.map((result, index) => {
        if (result.status === 'rejected') {
          console.warn(`Failed to fetch resource at index ${index}:`, result.reason);
          return index === 0 ? null : { resources: [], total: 0 };
        }
        return result.value;
      });

      setData({
        patient: patientResult,
        encounters: encountersResult?.resources || [],
        conditions: conditionsResult?.resources || [],
        medications: medicationsResult?.resources || [],
        observations: observationsResult?.resources || [],
        allergies: allergiesResult?.resources || [],
        carePlans: carePlansResult?.resources || [],
        careTeam: careTeamResult?.resources || [],
        coverage: coverageResult?.resources || [],
        documentReferences: documentsResult?.resources || []
      });
      
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Error fetching patient data:', err);
      setError(err.message || 'Failed to load patient data');
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  // Initial load
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refresh: fetchData, lastRefresh };
};

// Helper functions
const formatPatientName = (patient) => {
  if (!patient?.name?.[0]) return 'Unknown Patient';
  const name = patient.name[0];
  return `${name.given?.join(' ') || ''} ${name.family || ''}`.trim();
};

const calculateAge = (birthDate) => {
  if (!birthDate) return 'Unknown';
  return differenceInYears(new Date(), parseISO(birthDate));
};

const getPatientPhoto = (patient) => {
  return patient?.photo?.[0]?.url || null;
};

const formatPhoneNumber = (telecom) => {
  const phone = telecom?.find(t => t.system === 'phone');
  return phone?.value || 'No phone';
};

const formatAddress = (address) => {
  if (!address?.[0]) return 'No address';
  const addr = address[0];
  return `${addr.line?.join(', ') || ''}, ${addr.city || ''}, ${addr.state || ''} ${addr.postalCode || ''}`.trim();
};

// Hero Section Component
const PatientHero = ({ patient, loading }) => {
  const theme = useTheme();
  const navigate = useNavigate();

  if (loading) {
    return (
      <Paper sx={{ p: 4, mb: 3, background: theme.palette.primary.main }}>
        <Grid container spacing={3}>
          <Grid item>
            <Skeleton variant="circular" width={100} height={100} />
          </Grid>
          <Grid item xs>
            <Skeleton variant="text" width={300} height={40} />
            <Skeleton variant="text" width={200} />
            <Skeleton variant="text" width={250} />
          </Grid>
        </Grid>
      </Paper>
    );
  }

  if (!patient) return null;

  const age = calculateAge(patient.birthDate);
  const photo = getPatientPhoto(patient);

  return (
    <Paper
      sx={{
        p: 4,
        mb: 3,
        background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
        color: 'white',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Background Pattern */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          right: 0,
          opacity: 0.1,
          transform: 'rotate(15deg)',
          fontSize: '200px'
        }}
      >
        <PersonIcon sx={{ fontSize: 'inherit' }} />
      </Box>

      <Grid container spacing={3} alignItems="center" sx={{ position: 'relative' }}>
        <Grid item>
          <Avatar
            src={photo}
            sx={{
              width: 100,
              height: 100,
              border: '4px solid white',
              boxShadow: theme.shadows[3]
            }}
          >
            {!photo && <PersonIcon sx={{ fontSize: 50 }} />}
          </Avatar>
        </Grid>
        
        <Grid item xs>
          <Typography variant="h3" gutterBottom sx={{ fontWeight: 600 }}>
            {formatPatientName(patient)}
          </Typography>
          
          <Stack direction="row" spacing={3} sx={{ mb: 2 }}>
            <Typography variant="h6" sx={{ opacity: 0.9 }}>
              {age} years old • {patient.gender}
            </Typography>
            <Typography variant="h6" sx={{ opacity: 0.9 }}>
              DOB: {patient.birthDate ? format(parseISO(patient.birthDate), 'MMM d, yyyy') : 'Unknown'}
            </Typography>
          </Stack>
          
          <Stack direction="row" spacing={2} flexWrap="wrap">
            <Chip
              icon={<PersonIcon />}
              label={`MRN: ${patient.identifier?.[0]?.value || 'Unknown'}`}
              sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
            />
            <Chip
              icon={<PhoneIcon />}
              label={formatPhoneNumber(patient.telecom)}
              sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
            />
            <Chip
              icon={<HomeIcon />}
              label={formatAddress(patient.address)}
              sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
            />
          </Stack>
        </Grid>
        
        <Grid item>
          <Stack spacing={1}>
            <Button
              variant="contained"
              color="secondary"
              size="large"
              startIcon={<AddIcon />}
              onClick={() => navigate(`/patients/${encodeFhirId(patient.id)}/clinical?mode=encounter-documentation`)}
              sx={{ boxShadow: theme.shadows[3] }}
            >
              Start Visit
            </Button>
            <Button
              variant="outlined"
              size="large"
              startIcon={<TimelineIcon />}
              onClick={() => navigate(`/patients/${encodeFhirId(patient.id)}/clinical?mode=chart-review`)}
              sx={{ 
                color: 'white', 
                borderColor: 'white',
                '&:hover': {
                  borderColor: 'white',
                  bgcolor: 'rgba(255,255,255,0.1)'
                }
              }}
            >
              View Chart
            </Button>
          </Stack>
        </Grid>
      </Grid>
    </Paper>
  );
};

// Smart Card Component
const SmartCard = ({ 
  title, 
  icon, 
  count, 
  priority = 'normal', 
  gradient,
  children, 
  onViewAll,
  loading = false 
}) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);

  const priorityColors = {
    high: theme.palette.error.main,
    medium: theme.palette.warning.main,
    normal: theme.palette.primary.main
  };

  return (
    <Card
      sx={{
        height: '100%',
        position: 'relative',
        overflow: 'visible',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: theme.shadows[8]
        }
      }}
    >
      {priority !== 'normal' && (
        <Box
          sx={{
            position: 'absolute',
            top: -8,
            right: 16,
            background: priorityColors[priority],
            color: 'white',
            px: 2,
            py: 0.5,
            borderRadius: 2,
            fontSize: '0.75rem',
            fontWeight: 'bold',
            boxShadow: theme.shadows[2]
          }}
        >
          {priority.toUpperCase()}
        </Box>
      )}
      
      <Box
        sx={{
          background: gradient || `linear-gradient(135deg, ${theme.palette.primary.light} 0%, ${theme.palette.primary.main} 100%)`,
          p: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 2
        }}
      >
        <Avatar 
          sx={{ 
            bgcolor: 'white', 
            color: theme.palette.primary.main,
            width: 48,
            height: 48
          }}
        >
          {icon}
        </Avatar>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" color="white" fontWeight="600">
            {title}
          </Typography>
          {count !== undefined && (
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
              {count} {count === 1 ? 'item' : 'items'}
            </Typography>
          )}
        </Box>
        <IconButton
          size="small"
          onClick={() => setExpanded(!expanded)}
          sx={{ color: 'white' }}
        >
          {expanded ? <ChevronRightIcon /> : <ChevronRightIcon sx={{ transform: 'rotate(90deg)' }} />}
        </IconButton>
      </Box>
      
      <Collapse in={expanded} timeout="auto">
        <CardContent>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
              <CircularProgress size={24} />
            </Box>
          ) : (
            children
          )}
        </CardContent>
        {onViewAll && (
          <CardActions sx={{ justifyContent: 'flex-end', pt: 0 }}>
            <Button size="small" onClick={onViewAll} endIcon={<ChevronRightIcon />}>
              View All
            </Button>
          </CardActions>
        )}
      </Collapse>
    </Card>
  );
};

// Quick Actions
const QuickActions = ({ patientId }) => {
  const navigate = useNavigate();
  const theme = useTheme();

  const actions = [
    {
      label: 'New Note',
      icon: <DocumentIcon />,
      color: theme.palette.primary.main,
      onClick: () => navigate(`/patients/${encodeFhirId(patientId)}/clinical?mode=encounter-documentation`)
    },
    {
      label: 'Order',
      icon: <AssignmentIcon />,
      color: theme.palette.secondary.main,
      onClick: () => navigate(`/patients/${encodeFhirId(patientId)}/clinical?mode=orders-management`)
    },
    {
      label: 'Schedule',
      icon: <EventIcon />,
      color: theme.palette.success.main,
      onClick: () => navigate(`/schedule?patient=${encodeFhirId(patientId)}`)
    },
    {
      label: 'Message',
      icon: <EmailIcon />,
      color: theme.palette.info.main,
      onClick: () => {} // TODO: Implement messaging
    }
  ];

  return (
    <Box sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: 100 }}>
      <Stack spacing={2}>
        {actions.map((action, index) => (
          <Zoom in timeout={300 + index * 100} key={action.label}>
            <Fab
              color="primary"
              size="medium"
              onClick={action.onClick}
              sx={{ 
                bgcolor: action.color,
                '&:hover': { bgcolor: alpha(action.color, 0.8) }
              }}
            >
              <Tooltip title={action.label} placement="left">
                {action.icon}
              </Tooltip>
            </Fab>
          </Zoom>
        ))}
      </Stack>
    </Box>
  );
};

// Main Dashboard Component
const PatientDashboardV3 = ({ patientId }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { setCurrentPatient } = useFHIRResource();
  const { data, loading, error, refresh, lastRefresh } = usePatientDashboardData(patientId);

  // Debug logging
  useEffect(() => {
    console.log('PatientDashboardV3 - patientId:', patientId);
    console.log('PatientDashboardV3 - data:', data);
    console.log('PatientDashboardV3 - loading:', loading);
    console.log('PatientDashboardV3 - error:', error);
    
    // Log specific data to find the rendering issue
    if (data.conditions?.length > 0) {
      console.log('Conditions:', data.conditions.map(c => ({
        id: c.id,
        code: c.code,
        severity: c.severity,
        category: c.category
      })));
    }
    if (data.allergies?.length > 0) {
      console.log('Allergies:', data.allergies.map(a => ({
        id: a.id,
        code: a.code,
        type: a.type,
        category: a.category,
        criticality: a.criticality
      })));
    }
  }, [patientId, data, loading, error]);

  // Set current patient context
  useEffect(() => {
    if (patientId) {
      setCurrentPatient(patientId);
    }
  }, [patientId, setCurrentPatient]);

  // Process data for display
  const processedData = useMemo(() => {
    const vitals = data.observations.filter(obs => 
      ['8310-5', '8867-4', '9279-1', '8480-6', '8462-4', '8302-2', '29463-7', '39156-5'].includes(obs.code?.coding?.[0]?.code)
    );
    
    const labs = data.observations.filter(obs => 
      obs.category?.[0]?.coding?.[0]?.code === 'laboratory'
    );

    const activeConditions = data.conditions.filter(c => 
      c.clinicalStatus?.coding?.[0]?.code === 'active'
    );

    const activeAllergies = data.allergies.filter(a => 
      a.clinicalStatus?.coding?.[0]?.code === 'active'
    );

    // Calculate priority based on conditions and recent encounters
    const hasHighPriority = activeConditions.some(c => 
      c.severity?.coding?.[0]?.code === 'severe'
    ) || data.encounters.some(e => 
      e.class?.code === 'emergency' && 
      new Date(e.period?.start) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    );

    return {
      vitals,
      labs,
      activeConditions,
      activeAllergies,
      hasHighPriority,
      recentEncounter: data.encounters[0]
    };
  }, [data]);

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" action={
          <Button color="inherit" size="small" onClick={refresh}>
            Retry
          </Button>
        }>
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ pb: 8 }}>
      {/* Debug Component - Temporary */}
      <FHIRDataDebug patientId={patientId} />
      
      {/* Hero Section */}
      <PatientHero patient={data.patient} loading={loading} />

      {/* Last Refresh Indicator */}
      {lastRefresh && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          <Chip
            icon={<ClockIcon />}
            label={`Last updated ${formatDistanceToNow(lastRefresh)} ago`}
            size="small"
            onClick={refresh}
            clickable
          />
        </Box>
      )}

      {/* Main Content Grid */}
      <Grid container spacing={3}>
        {/* Active Problems */}
        <Grid item xs={12} md={6} lg={4}>
          <SmartCard
            title="Active Problems"
            icon={<ConditionIcon />}
            count={processedData.activeConditions.length}
            priority={processedData.hasHighPriority ? 'high' : 'normal'}
            gradient={`linear-gradient(135deg, ${theme.palette.error.light} 0%, ${theme.palette.error.main} 100%)`}
            loading={loading}
            onViewAll={() => navigate(`/patients/${encodeFhirId(patientId)}/clinical?mode=chart-review`)}
          >
            <List dense>
              {processedData.activeConditions.slice(0, 3).map((condition) => (
                <ListItem key={condition.id}>
                  <ListItemIcon>
                    <DotIcon color="error" fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary={condition.code?.text || 'Unknown'}
                    secondary={
                      <Stack spacing={0}>
                        <Typography variant="caption">
                          Since: {condition.onsetDateTime ? format(parseISO(condition.onsetDateTime), 'MMM yyyy') : 'Unknown'}
                        </Typography>
                        {condition.severity && (
                          <Chip
                            label={condition.severity.text || condition.severity.coding?.[0]?.display || 'Unknown severity'}
                            size="small"
                            color={condition.severity.coding?.[0]?.code === 'severe' ? 'error' : 'default'}
                            sx={{ mt: 0.5 }}
                          />
                        )}
                      </Stack>
                    }
                  />
                </ListItem>
              ))}
              {processedData.activeConditions.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                  No active problems
                </Typography>
              )}
            </List>
          </SmartCard>
        </Grid>

        {/* Medications */}
        <Grid item xs={12} md={6} lg={4}>
          <SmartCard
            title="Active Medications"
            icon={<MedicationIcon />}
            count={data.medications.length}
            gradient={`linear-gradient(135deg, ${theme.palette.secondary.light} 0%, ${theme.palette.secondary.main} 100%)`}
            loading={loading}
            onViewAll={() => navigate(`/patients/${encodeFhirId(patientId)}/medication-reconciliation`)}
          >
            <List dense>
              {data.medications.slice(0, 3).map((med) => (
                <ListItem key={med.id}>
                  <ListItemIcon>
                    <MedicationIcon color="secondary" fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary={med.medicationCodeableConcept?.text || 'Unknown medication'}
                    secondary={
                      <Stack spacing={0}>
                        <Typography variant="caption">
                          {med.dosageInstruction?.[0]?.text || 'No dosage info'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Started: {med.authoredOn ? format(parseISO(med.authoredOn), 'MMM d, yyyy') : 'Unknown'}
                        </Typography>
                      </Stack>
                    }
                  />
                </ListItem>
              ))}
              {data.medications.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                  No active medications
                </Typography>
              )}
            </List>
          </SmartCard>
        </Grid>

        {/* Recent Vitals */}
        <Grid item xs={12} md={6} lg={4}>
          <SmartCard
            title="Recent Vitals"
            icon={<VitalsIcon />}
            count={processedData.vitals.length}
            gradient={`linear-gradient(135deg, ${theme.palette.success.light} 0%, ${theme.palette.success.main} 100%)`}
            loading={loading}
            onViewAll={() => navigate(`/patients/${encodeFhirId(patientId)}/vital-signs`)}
          >
            <Grid container spacing={1}>
              {processedData.vitals.slice(0, 6).map((vital) => {
                const vitalConfig = {
                  '8310-5': { name: 'Temp', unit: '°F' },
                  '8867-4': { name: 'HR', unit: 'bpm' },
                  '9279-1': { name: 'RR', unit: '/min' },
                  '8480-6': { name: 'SBP', unit: 'mmHg' },
                  '8462-4': { name: 'DBP', unit: 'mmHg' },
                  '39156-5': { name: 'BMI', unit: 'kg/m²' }
                };
                
                const config = vitalConfig[vital.code?.coding?.[0]?.code] || { name: 'Other', unit: '' };
                
                return (
                  <Grid item xs={6} key={vital.id}>
                    <Paper sx={{ p: 1.5, textAlign: 'center', bgcolor: 'background.default' }}>
                      <Typography variant="caption" color="text.secondary">
                        {config.name}
                      </Typography>
                      <Typography variant="h6">
                        {vital.valueQuantity?.value || 'N/A'} {config.unit}
                      </Typography>
                    </Paper>
                  </Grid>
                );
              })}
            </Grid>
            {processedData.vitals.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                No recent vitals
              </Typography>
            )}
          </SmartCard>
        </Grid>

        {/* Allergies */}
        <Grid item xs={12} md={6} lg={4}>
          <SmartCard
            title="Allergies & Intolerances"
            icon={<WarningIcon />}
            count={processedData.activeAllergies.length}
            priority={processedData.activeAllergies.length > 0 ? 'medium' : 'normal'}
            gradient={`linear-gradient(135deg, ${theme.palette.warning.light} 0%, ${theme.palette.warning.main} 100%)`}
            loading={loading}
          >
            <List dense>
              {processedData.activeAllergies.map((allergy) => (
                <ListItem key={allergy.id}>
                  <ListItemIcon>
                    <WarningIcon color="warning" fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary={allergy.code?.text || 'Unknown allergen'}
                    secondary={
                      <Stack spacing={0}>
                        <Typography variant="caption">
                          Type: {typeof allergy.type === 'string' ? allergy.type : 'allergy'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Severity: {typeof allergy.criticality === 'string' ? allergy.criticality : 'unknown'}
                        </Typography>
                      </Stack>
                    }
                  />
                </ListItem>
              ))}
              {processedData.activeAllergies.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                  NKDA - No known drug allergies
                </Typography>
              )}
            </List>
          </SmartCard>
        </Grid>

        {/* Recent Labs */}
        <Grid item xs={12} md={6} lg={4}>
          <SmartCard
            title="Recent Lab Results"
            icon={<LabIcon />}
            count={processedData.labs.length}
            gradient={`linear-gradient(135deg, ${theme.palette.info.light} 0%, ${theme.palette.info.main} 100%)`}
            loading={loading}
            onViewAll={() => navigate(`/patients/${encodeFhirId(patientId)}/clinical?mode=results-review`)}
          >
            <List dense>
              {processedData.labs.slice(0, 3).map((lab) => (
                <ListItem key={lab.id}>
                  <ListItemIcon>
                    <LabIcon color="info" fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary={lab.code?.text || 'Unknown test'}
                    secondary={
                      <Stack spacing={0}>
                        <Typography variant="caption">
                          {lab.valueQuantity ? `${lab.valueQuantity.value} ${lab.valueQuantity.unit}` : 'Pending'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {lab.effectiveDateTime ? format(parseISO(lab.effectiveDateTime), 'MMM d, yyyy') : 'No date'}
                        </Typography>
                      </Stack>
                    }
                  />
                </ListItem>
              ))}
              {processedData.labs.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                  No recent lab results
                </Typography>
              )}
            </List>
          </SmartCard>
        </Grid>

        {/* Recent Encounters */}
        <Grid item xs={12} md={6} lg={4}>
          <SmartCard
            title="Recent Encounters"
            icon={<EventIcon />}
            count={data.encounters.length}
            gradient={`linear-gradient(135deg, ${theme.palette.primary.light} 0%, ${theme.palette.primary.main} 100%)`}
            loading={loading}
          >
            <List dense>
              {data.encounters.slice(0, 3).map((encounter) => {
                const startDate = encounter.period?.start ? parseISO(encounter.period.start) : null;
                const isRecent = startDate && isToday(startDate);
                
                return (
                  <ListItem key={encounter.id}>
                    <ListItemIcon>
                      <EventIcon color={isRecent ? 'primary' : 'action'} fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary={encounter.type?.[0]?.text || encounter.class?.display || 'Unknown type'}
                      secondary={
                        <Stack spacing={0}>
                          <Typography variant="caption">
                            {encounter.serviceProvider?.display || 'Unknown location'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {startDate ? format(startDate, 'MMM d, yyyy h:mm a') : 'No date'}
                          </Typography>
                        </Stack>
                      }
                    />
                    {isRecent && (
                      <Chip label="Today" size="small" color="primary" />
                    )}
                  </ListItem>
                );
              })}
              {data.encounters.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                  No recent encounters
                </Typography>
              )}
            </List>
          </SmartCard>
        </Grid>
      </Grid>

      {/* Quick Actions FAB */}
      <QuickActions patientId={patientId} />
    </Box>
  );
};

export default PatientDashboardV3;