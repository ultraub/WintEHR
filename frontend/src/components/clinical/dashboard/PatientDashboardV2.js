import React, { useState, useEffect } from 'react';
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
  useTheme
} from '@mui/material';
import {
  Person as PersonIcon,
  LocalHospital as HospitalIcon,
  Medication as MedicationIcon,
  Warning as WarningIcon,
  Healing as ConditionIcon,
  Assignment as TaskIcon,
  Group as TeamIcon,
  Description as DocumentIcon,
  Science as LabIcon,
  MonitorHeart as VitalsIcon,
  Shield as CoverageIcon,
  Event as EventIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Timeline as TimelineIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Home as HomeIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { format, differenceInYears, parseISO, formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import FHIRResourceTimeline from '../timeline/FHIRResourceTimeline';
import { useFHIRResource, usePatient } from '../../../contexts/FHIRResourceContext';
import { 
  usePatientSummary, 
  useEncounters, 
  useConditions, 
  useMedications, 
  useObservations,
  usePatientResourceType 
} from '../../../hooks/useFHIRResources';

// Summary Card Component
const SummaryCard = ({ title, icon: Icon, color = 'primary', children, onViewAll, loading = false, count }) => {
  const theme = useTheme();
  
  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flexGrow: 1, pb: 1 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Avatar sx={{ bgcolor: `${color}.light`, width: 40, height: 40 }}>
              <Icon sx={{ color: `${color}.main` }} />
            </Avatar>
            <Box>
              <Typography variant="h6" component="div">
                {title}
              </Typography>
              {count !== undefined && (
                <Typography variant="caption" color="text.secondary">
                  {count} {count === 1 ? 'item' : 'items'}
                </Typography>
              )}
            </Box>
          </Stack>
        </Stack>
        {loading ? (
          <Box display="flex" justifyContent="center" p={2}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          children
        )}
      </CardContent>
      {onViewAll && (
        <CardActions sx={{ justifyContent: 'flex-end', pt: 0 }}>
          <Button size="small" onClick={onViewAll} color={color}>
            View All
          </Button>
        </CardActions>
      )}
    </Card>
  );
};

// Patient Demographics Card
const DemographicsCard = ({ patient, coverage = [] }) => {
  if (!patient) return <Typography>No patient data</Typography>;
  
  const age = patient.birthDate ? differenceInYears(new Date(), parseISO(patient.birthDate)) : null;
  
  const getContactInfo = () => {
    const phone = patient.telecom?.find(t => t.system === 'phone')?.value;
    const email = patient.telecom?.find(t => t.system === 'email')?.value;
    const address = patient.address?.[0];
    return { phone, email, address };
  };
  
  const { phone, email, address } = getContactInfo();

  return (
    <Box>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h5">
            {patient.name?.[0]?.given?.join(' ')} {patient.name?.[0]?.family}
          </Typography>
          <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
            <Chip 
              label={patient.gender} 
              size="small" 
              color={patient.gender === 'male' ? 'info' : 'secondary'}
            />
            {age && <Chip label={`${age} years`} size="small" />}
            {patient.birthDate && (
              <Chip label={`DOB: ${format(parseISO(patient.birthDate), 'MM/dd/yyyy')}`} size="small" />
            )}
          </Stack>
        </Box>

        <Divider />

        <Stack spacing={1}>
          {phone && (
            <Stack direction="row" spacing={1} alignItems="center">
              <PhoneIcon fontSize="small" color="action" />
              <Typography variant="body2">{phone}</Typography>
            </Stack>
          )}
          {email && (
            <Stack direction="row" spacing={1} alignItems="center">
              <EmailIcon fontSize="small" color="action" />
              <Typography variant="body2">{email}</Typography>
            </Stack>
          )}
          {address && (
            <Stack direction="row" spacing={1} alignItems="center">
              <HomeIcon fontSize="small" color="action" />
              <Typography variant="body2">
                {[address.line?.[0], address.city, address.state, address.postalCode]
                  .filter(Boolean)
                  .join(', ')}
              </Typography>
            </Stack>
          )}
        </Stack>

        {coverage.length > 0 && (
          <>
            <Divider />
            <Box>
              <Typography variant="subtitle2" gutterBottom>Insurance</Typography>
              {coverage.slice(0, 2).map((cov, index) => (
                <Stack key={cov.id} direction="row" spacing={1} alignItems="center">
                  <CoverageIcon fontSize="small" color="primary" />
                  <Typography variant="body2">
                    {cov.payor?.[0]?.display || 'Unknown Payor'}
                  </Typography>
                  <Chip label={cov.status} size="small" color="success" />
                </Stack>
              ))}
            </Box>
          </>
        )}
      </Stack>
    </Box>
  );
};

// Recent Encounters Card
const RecentEncountersCard = ({ encounters = [] }) => {
  const recentEncounters = encounters.slice(0, 3);

  return (
    <List dense>
      {recentEncounters.map((encounter) => (
        <ListItem key={encounter.id}>
          <ListItemIcon>
            <HospitalIcon color="info" />
          </ListItemIcon>
          <ListItemText
            primary={encounter.type?.[0]?.text || encounter.type?.[0]?.coding?.[0]?.display || 'Encounter'}
            secondary={
              <Stack spacing={0}>
                <Typography variant="caption" display="block">
                  Status: {encounter.status}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {encounter.period?.start ? format(parseISO(encounter.period.start), 'MM/dd/yyyy') : 'No date'}
                </Typography>
              </Stack>
            }
          />
        </ListItem>
      ))}
      {encounters.length === 0 && (
        <ListItem>
          <ListItemText 
            primary="No recent encounters"
            secondary="No encounters found"
          />
        </ListItem>
      )}
    </List>
  );
};

// Active Conditions Card
const ActiveConditionsCard = ({ conditions = [] }) => {
  return (
    <List dense>
      {conditions.slice(0, 3).map((condition) => (
        <ListItem key={condition.id}>
          <ListItemIcon>
            <ConditionIcon color="error" />
          </ListItemIcon>
          <ListItemText
            primary={condition.code?.text || condition.code?.coding?.[0]?.display}
            secondary={
              <Stack spacing={0}>
                <Typography variant="caption" display="block">
                  Status: {condition.clinicalStatus?.coding?.[0]?.code}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {condition.onsetDateTime ? `Onset: ${format(parseISO(condition.onsetDateTime), 'MM/dd/yyyy')}` : 'No onset date'}
                </Typography>
              </Stack>
            }
          />
        </ListItem>
      ))}
      {conditions.length === 0 && (
        <ListItem>
          <ListItemText 
            primary="No active conditions"
            secondary="No conditions found"
          />
        </ListItem>
      )}
    </List>
  );
};

// Current Medications Card
const CurrentMedicationsCard = ({ medications = [] }) => {
  return (
    <List dense>
      {medications.slice(0, 3).map((medication) => (
        <ListItem key={medication.id}>
          <ListItemIcon>
            <MedicationIcon color="secondary" />
          </ListItemIcon>
          <ListItemText
            primary={
              medication.medicationCodeableConcept?.text || 
              medication.medicationCodeableConcept?.coding?.[0]?.display ||
              'Unknown Medication'
            }
            secondary={
              <Stack spacing={0}>
                <Typography variant="caption" display="block">
                  Status: {medication.status}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {medication.authoredOn ? format(parseISO(medication.authoredOn), 'MM/dd/yyyy') : 'No date'}
                </Typography>
              </Stack>
            }
          />
        </ListItem>
      ))}
      {medications.length === 0 && (
        <ListItem>
          <ListItemText 
            primary="No active medications"
            secondary="No medications found"
          />
        </ListItem>
      )}
    </List>
  );
};

// Allergies Card
const AllergiesCard = ({ allergies = [] }) => {
  const activeAllergies = allergies.filter(a => 
    a.clinicalStatus?.coding?.[0]?.code === 'active' || !a.clinicalStatus
  );

  return (
    <List dense>
      {activeAllergies.slice(0, 3).map((allergy) => (
        <ListItem key={allergy.id}>
          <ListItemIcon>
            <WarningIcon color="warning" />
          </ListItemIcon>
          <ListItemText
            primary={
              allergy.code?.text || 
              allergy.code?.coding?.[0]?.display ||
              'Unknown Allergen'
            }
            secondary={
              <Stack spacing={0}>
                <Typography variant="caption" display="block">
                  Type: {allergy.type || 'allergy'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Severity: {allergy.criticality || 'unknown'}
                </Typography>
              </Stack>
            }
          />
        </ListItem>
      ))}
      {activeAllergies.length === 0 && (
        <ListItem>
          <ListItemText 
            primary="No known allergies"
            secondary="NKDA - No known drug allergies"
          />
        </ListItem>
      )}
    </List>
  );
};

// Recent Vitals Card
const RecentVitalsCard = ({ vitals = [] }) => {
  // Group by type and get most recent
  const latestVitals = {};
  vitals.forEach(obs => {
    const code = obs.code?.coding?.[0]?.code;
    if (code && (!latestVitals[code] || new Date(obs.effectiveDateTime) > new Date(latestVitals[code].effectiveDateTime))) {
      latestVitals[code] = obs;
    }
  });

  const vitalDisplay = {
    '8310-5': { name: 'Temperature', unit: '°F', icon: '🌡️' },
    '8867-4': { name: 'Heart Rate', unit: 'bpm', icon: '❤️' },
    '9279-1': { name: 'Respiratory Rate', unit: '/min', icon: '🫁' },
    '8480-6': { name: 'Systolic BP', unit: 'mmHg', icon: '💉' },
    '8462-4': { name: 'Diastolic BP', unit: 'mmHg', icon: '💉' },
    '8302-2': { name: 'Height', unit: 'cm', icon: '📏' },
    '29463-7': { name: 'Weight', unit: 'kg', icon: '⚖️' },
    '39156-5': { name: 'BMI', unit: 'kg/m²', icon: '📊' }
  };

  return (
    <Box>
      <Grid container spacing={2}>
        {Object.entries(latestVitals).slice(0, 6).map(([code, obs]) => {
          const config = vitalDisplay[code] || { name: obs.code?.text, unit: '', icon: '📋' };
          const value = obs.valueQuantity?.value;
          const unit = obs.valueQuantity?.unit || config.unit;
          
          return (
            <Grid item xs={6} key={obs.id}>
              <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'background.default' }}>
                <Typography variant="caption" color="text.secondary">
                  {config.name}
                </Typography>
                <Typography variant="h6">
                  {value ? `${value} ${unit}` : 'N/A'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {obs.effectiveDateTime ? format(parseISO(obs.effectiveDateTime), 'MM/dd') : 'No date'}
                </Typography>
              </Paper>
            </Grid>
          );
        })}
      </Grid>
      {Object.keys(latestVitals).length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
          No recent vital signs
        </Typography>
      )}
    </Box>
  );
};

// Recent Labs Card
const RecentLabsCard = ({ labResults = [] }) => {
  return (
    <List dense>
      {labResults.slice(0, 3).map((lab) => (
        <ListItem key={lab.id}>
          <ListItemIcon>
            <LabIcon color="success" />
          </ListItemIcon>
          <ListItemText
            primary={lab.code?.text || lab.code?.coding?.[0]?.display}
            secondary={
              <Stack spacing={0}>
                <Typography variant="caption" display="block">
                  Value: {lab.valueQuantity ? `${lab.valueQuantity.value} ${lab.valueQuantity.unit}` : 'N/A'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {lab.effectiveDateTime ? format(parseISO(lab.effectiveDateTime), 'MM/dd/yyyy') : 'No date'}
                </Typography>
              </Stack>
            }
          />
        </ListItem>
      ))}
      {labResults.length === 0 && (
        <ListItem>
          <ListItemText 
            primary="No recent lab results"
            secondary="No laboratory results found"
          />
        </ListItem>
      )}
    </List>
  );
};

// Main Patient Dashboard Component
const PatientDashboardV2 = ({ patientId }) => {
  const navigate = useNavigate();
  const [showTimeline, setShowTimeline] = useState(false);
  
  // Use the new FHIR resource hooks
  const { setCurrentPatient } = useFHIRResource();
  const { patient } = usePatient(patientId);
  
  // Individual resource hooks for detailed access
  const encounters = useEncounters(patientId);
  const conditions = useConditions(patientId);
  const medications = useMedications(patientId);
  const observations = useObservations(patientId);
  const allergies = usePatientResourceType(patientId, 'AllergyIntolerance');
  const carePlans = usePatientResourceType(patientId, 'CarePlan');
  const careTeams = usePatientResourceType(patientId, 'CareTeam');
  const coverage = usePatientResourceType(patientId, 'Coverage');
  
  // Set patient context when component mounts
  useEffect(() => {
    if (patientId) {
      setCurrentPatient(patientId);
    }
  }, [patientId, setCurrentPatient]);
  
  // Calculate overall loading state
  const isLoading = encounters.loading || conditions.loading || 
                   medications.loading || observations.loading || allergies.loading || 
                   carePlans.loading || careTeams.loading || coverage.loading;
  
  // Calculate any errors
  const hasError = encounters.error || conditions.error || medications.error || 
                  observations.error || allergies.error || carePlans.error || 
                  careTeams.error || coverage.error;

  // Refresh all data
  const refreshAll = async () => {
    await Promise.all([
      encounters.refresh(),
      conditions.refresh(),
      medications.refresh(),
      observations.refresh(),
      allergies.refresh(),
      carePlans.refresh(),
      careTeams.refresh(),
      coverage.refresh()
    ]);
  };

  if (isLoading && !patient) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (hasError) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        Error loading patient data: {hasError}
        <Button onClick={refreshAll} sx={{ ml: 2 }}>
          Retry
        </Button>
      </Alert>
    );
  }

  if (!patient) {
    return (
      <Alert severity="warning" sx={{ m: 2 }}>
        Patient not found
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header with quick actions */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h4">
            Patient Dashboard - {patient.name?.[0]?.given?.join(' ')} {patient.name?.[0]?.family}
          </Typography>
          <Stack direction="row" spacing={2}>
            <Button
              variant="outlined"
              startIcon={<TimelineIcon />}
              onClick={() => setShowTimeline(!showTimeline)}
            >
              {showTimeline ? 'Hide Timeline' : 'Show Timeline'}
            </Button>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={refreshAll}
              disabled={isLoading}
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              onClick={() => navigate(`/patients/${patientId}/clinical`)}
            >
              Open Clinical Workspace
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {/* Timeline */}
      <Collapse in={showTimeline}>
        <Paper sx={{ p: 2, mb: 3 }}>
          <FHIRResourceTimeline patientId={patientId} height="400px" />
        </Paper>
      </Collapse>

      {/* Summary Cards Grid */}
      <Grid container spacing={3}>
        {/* Demographics & Insurance */}
        <Grid item xs={12} md={6} lg={4}>
          <SummaryCard
            title="Demographics & Insurance"
            icon={PersonIcon}
            color="primary"
          >
            <DemographicsCard patient={patient} coverage={coverage.resources} />
          </SummaryCard>
        </Grid>

        {/* Recent Encounters */}
        <Grid item xs={12} md={6} lg={4}>
          <SummaryCard
            title="Recent Encounters"
            icon={HospitalIcon}
            color="info"
            count={encounters.encounters?.length || 0}
            onViewAll={() => navigate(`/patients/${patientId}/clinical?tab=encounters`)}
            loading={encounters.loading}
          >
            <RecentEncountersCard encounters={encounters.recentEncounters || []} />
          </SummaryCard>
        </Grid>

        {/* Active Conditions */}
        <Grid item xs={12} md={6} lg={4}>
          <SummaryCard
            title="Active Conditions"
            icon={ConditionIcon}
            color="error"
            count={conditions.activeConditions?.length || 0}
            onViewAll={() => navigate(`/patients/${patientId}/clinical?tab=chart-review`)}
            loading={conditions.loading}
          >
            <ActiveConditionsCard conditions={conditions.activeConditions || []} />
          </SummaryCard>
        </Grid>

        {/* Current Medications */}
        <Grid item xs={12} md={6} lg={4}>
          <SummaryCard
            title="Current Medications"
            icon={MedicationIcon}
            color="secondary"
            count={medications.activeMedications?.length || 0}
            onViewAll={() => navigate(`/patients/${patientId}/clinical?tab=medications`)}
            loading={medications.loading}
          >
            <CurrentMedicationsCard medications={medications.activeMedications || []} />
          </SummaryCard>
        </Grid>

        {/* Allergies */}
        <Grid item xs={12} md={6} lg={4}>
          <SummaryCard
            title="Allergies & Intolerances"
            icon={WarningIcon}
            color="warning"
            count={allergies.resources?.filter(a => a.clinicalStatus?.coding?.[0]?.code === 'active' || !a.clinicalStatus).length || 0}
            loading={allergies.loading}
          >
            <AllergiesCard allergies={allergies.resources || []} />
          </SummaryCard>
        </Grid>

        {/* Recent Vitals */}
        <Grid item xs={12} md={6} lg={4}>
          <SummaryCard
            title="Recent Vitals"
            icon={VitalsIcon}
            color="info"
            count={observations.vitals?.length || 0}
            onViewAll={() => navigate(`/patients/${patientId}/vital-signs`)}
            loading={observations.loading}
          >
            <RecentVitalsCard vitals={observations.vitals || []} />
          </SummaryCard>
        </Grid>

        {/* Care Team */}
        <Grid item xs={12} md={6} lg={4}>
          <SummaryCard
            title="Care Team"
            icon={TeamIcon}
            color="success"
            count={careTeams.resources?.length || 0}
            onViewAll={() => navigate(`/patients/${patientId}/clinical?tab=care-management`)}
            loading={careTeams.loading}
          >
            <List dense>
              {careTeams.resources?.slice(0, 3).map((team) => (
                <ListItem key={team.id}>
                  <ListItemIcon>
                    <TeamIcon color="success" />
                  </ListItemIcon>
                  <ListItemText
                    primary={team.name || `Care Team ${team.id}`}
                    secondary={`${team.participant?.length || 0} members`}
                  />
                </ListItem>
              ))}
              {(!careTeams.resources || careTeams.resources.length === 0) && (
                <ListItem>
                  <ListItemText 
                    primary="No care teams"
                    secondary="No active care teams found"
                  />
                </ListItem>
              )}
            </List>
          </SummaryCard>
        </Grid>

        {/* Care Plans */}
        <Grid item xs={12} md={6} lg={4}>
          <SummaryCard
            title="Care Plans"
            icon={TaskIcon}
            color="primary"
            count={carePlans.resources?.filter(cp => cp.status === 'active').length || 0}
            onViewAll={() => navigate(`/patients/${patientId}/clinical?tab=care-management`)}
            loading={carePlans.loading}
          >
            <List dense>
              {carePlans.resources?.filter(cp => cp.status === 'active').slice(0, 3).map((plan, index) => (
                <ListItem key={plan.id}>
                  <ListItemIcon>
                    <TaskIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary={plan.title || `Care Plan ${index + 1}`}
                    secondary={`Status: ${plan.status} | Intent: ${plan.intent}`}
                  />
                </ListItem>
              ))}
              {(!carePlans.resources || carePlans.resources.filter(cp => cp.status === 'active').length === 0) && (
                <ListItem>
                  <ListItemText 
                    primary="No active care plans"
                    secondary="No care plans found"
                  />
                </ListItem>
              )}
            </List>
          </SummaryCard>
        </Grid>

        {/* Recent Labs */}
        <Grid item xs={12} md={6} lg={4}>
          <SummaryCard
            title="Recent Lab Results"
            icon={LabIcon}
            color="success"
            count={observations.labResults?.length || 0}
            onViewAll={() => navigate(`/patients/${patientId}/clinical?tab=results`)}
            loading={observations.loading}
          >
            <RecentLabsCard labResults={observations.labResults || []} />
          </SummaryCard>
        </Grid>
      </Grid>
    </Box>
  );
};

export default PatientDashboardV2;