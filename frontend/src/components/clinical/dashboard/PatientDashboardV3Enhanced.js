/**
 * PatientDashboardV3Enhanced Component
 * Enhanced version with active/inactive toggle and proper status filtering
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
  Fade,
  ToggleButton,
  ToggleButtonGroup,
  FormControlLabel,
  Switch
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
  LocationOn as LocationIcon,
  CheckCircle as ActiveIcon,
  Cancel as InactiveIcon,
  AllInclusive as AllIcon,
  FilterList as FilterIcon
} from '@mui/icons-material';
import { format, differenceInYears, parseISO, formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useFHIRResource } from '../../../contexts/FHIRResourceContext';
import { fhirClient } from '../../../services/fhirClient';
import { encodeFhirId } from '../../../utils/navigationUtils';

// Helper to check if a resource is active based on FHIR status fields
const isResourceActive = (resource, resourceType) => {
  // Log the resource to debug status fields
  console.log(`Checking ${resourceType} status:`, {
    id: resource.id,
    status: resource.status,
    clinicalStatus: resource.clinicalStatus,
    verificationStatus: resource.verificationStatus
  });

  switch (resourceType) {
    case 'Condition':
      // Check both clinicalStatus and verificationStatus
      const clinicalCode = resource.clinicalStatus?.coding?.[0]?.code;
      const verificationCode = resource.verificationStatus?.coding?.[0]?.code;
      return clinicalCode === 'active' || clinicalCode === 'recurrence' || clinicalCode === 'relapse';
      
    case 'AllergyIntolerance':
      // Check clinicalStatus
      return resource.clinicalStatus?.coding?.[0]?.code === 'active';
      
    case 'MedicationRequest':
      // Check status field
      return ['active', 'on-hold'].includes(resource.status);
      
    case 'CarePlan':
      return ['active', 'on-hold'].includes(resource.status);
      
    case 'CareTeam':
      return resource.status === 'active';
      
    case 'Coverage':
      return resource.status === 'active';
      
    case 'Encounter':
      return ['planned', 'arrived', 'triaged', 'in-progress', 'onleave'].includes(resource.status);
      
    default:
      return true;
  }
};

// Custom hook for consolidated data fetching - fetches ALL data
const usePatientDashboardData = (patientId, filterStatus = 'all') => {
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
      // Fetch ALL data without status filters
      const results = await Promise.allSettled([
        fhirClient.read('Patient', patientId),
        fhirClient.search('Encounter', { patient: patientId, _sort: '-date', _count: 50 }),
        fhirClient.search('Condition', { patient: patientId }), // No status filter
        fhirClient.search('MedicationRequest', { patient: patientId }), // No status filter
        fhirClient.search('Observation', { patient: patientId, _sort: '-date', _count: 50 }),
        fhirClient.search('AllergyIntolerance', { patient: patientId }),
        fhirClient.search('CarePlan', { patient: patientId }), // No status filter
        fhirClient.search('CareTeam', { patient: patientId }), // No status filter
        fhirClient.search('Coverage', { patient: patientId }), // No status filter
        fhirClient.search('DocumentReference', { patient: patientId, _sort: '-date', _count: 20 })
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

      // Log raw counts
      console.log('Raw resource counts:', {
        encounters: encountersResult?.total || 0,
        conditions: conditionsResult?.total || 0,
        medications: medicationsResult?.total || 0,
        observations: observationsResult?.total || 0,
        allergies: allergiesResult?.total || 0,
        carePlans: carePlansResult?.total || 0,
        careTeam: careTeamResult?.total || 0,
        coverage: coverageResult?.total || 0
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

// Status Filter Toggle
const StatusFilter = ({ showActiveOnly, onChange }) => {
  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
        <FormControlLabel
          control={
            <Switch
              checked={showActiveOnly}
              onChange={(e) => onChange(e.target.checked)}
              color="primary"
            />
          }
          label={
            <Stack direction="row" spacing={1} alignItems="center">
              <FilterIcon fontSize="small" />
              <Typography variant="body2">Show Only Active</Typography>
            </Stack>
          }
        />
        <Typography variant="caption" color="text.secondary">
          {showActiveOnly ? 'Showing active resources only' : 'Showing all resources'}
        </Typography>
      </Stack>
    </Paper>
  );
};

// Main Dashboard Component with Enhanced Filtering
const PatientDashboardV3Enhanced = ({ patientId }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { setCurrentPatient } = useFHIRResource();
  const [showActiveOnly, setShowActiveOnly] = useState(false); // Default to showing all
  const { data, loading, error, refresh, lastRefresh } = usePatientDashboardData(patientId);

  // Set current patient context
  useEffect(() => {
    if (patientId) {
      setCurrentPatient(patientId);
    }
  }, [patientId, setCurrentPatient]);

  // Process and filter data based on status filter
  const processedData = useMemo(() => {
    // Filter based on active/inactive status
    const filterByStatus = (resources, resourceType) => {
      if (!showActiveOnly) return resources;
      
      return resources.filter(resource => isResourceActive(resource, resourceType));
    };

    const filteredConditions = filterByStatus(data.conditions, 'Condition');
    const filteredMedications = filterByStatus(data.medications, 'MedicationRequest');
    const filteredAllergies = filterByStatus(data.allergies, 'AllergyIntolerance');
    const filteredCarePlans = filterByStatus(data.carePlans, 'CarePlan');
    const filteredCareTeam = filterByStatus(data.careTeam, 'CareTeam');
    const filteredCoverage = filterByStatus(data.coverage, 'Coverage');

    // Log filtered counts
    console.log('Filtered resource counts:', {
      conditions: `${filteredConditions.length}/${data.conditions.length}`,
      medications: `${filteredMedications.length}/${data.medications.length}`,
      allergies: `${filteredAllergies.length}/${data.allergies.length}`,
      carePlans: `${filteredCarePlans.length}/${data.carePlans.length}`,
      careTeam: `${filteredCareTeam.length}/${data.careTeam.length}`,
      coverage: `${filteredCoverage.length}/${data.coverage.length}`
    });

    const vitals = data.observations.filter(obs => 
      ['8310-5', '8867-4', '9279-1', '8480-6', '8462-4', '8302-2', '29463-7', '39156-5'].includes(obs.code?.coding?.[0]?.code)
    );
    
    const labs = data.observations.filter(obs => 
      obs.category?.[0]?.coding?.[0]?.code === 'laboratory'
    );

    // Calculate priority based on conditions and recent encounters
    const hasHighPriority = filteredConditions.some(c => 
      c.severity?.coding?.[0]?.code === 'severe'
    ) || data.encounters.some(e => 
      e.class?.code === 'emergency' && 
      new Date(e.period?.start) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    );

    return {
      vitals,
      labs,
      conditions: filteredConditions,
      medications: filteredMedications,
      allergies: filteredAllergies,
      carePlans: filteredCarePlans,
      careTeam: filteredCareTeam,
      coverage: filteredCoverage,
      hasHighPriority,
      recentEncounter: data.encounters[0]
    };
  }, [data, showActiveOnly]);

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
      {/* Status Filter */}
      <StatusFilter showActiveOnly={showActiveOnly} onChange={setShowActiveOnly} />

      {/* Resource Summary */}
      {!loading && (
        <Paper sx={{ p: 2, mb: 2, bgcolor: 'background.default' }}>
          <Typography variant="subtitle2" gutterBottom>Resource Summary</Typography>
          <Stack direction="row" spacing={2} flexWrap="wrap">
            <Chip label={`Conditions: ${processedData.conditions.length}/${data.conditions.length}`} size="small" />
            <Chip label={`Medications: ${processedData.medications.length}/${data.medications.length}`} size="small" />
            <Chip label={`Allergies: ${processedData.allergies.length}/${data.allergies.length}`} size="small" />
            <Chip label={`Observations: ${data.observations.length}`} size="small" />
            <Chip label={`Encounters: ${data.encounters.length}`} size="small" />
          </Stack>
        </Paper>
      )}

      {/* Main Content Grid */}
      <Grid container spacing={3}>
        {/* Active Problems */}
        <Grid item xs={12} md={6} lg={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Problems ({processedData.conditions.length})
              </Typography>
              <List dense>
                {processedData.conditions.slice(0, 5).map((condition) => (
                  <ListItem key={condition.id}>
                    <ListItemIcon>
                      <DotIcon 
                        color={isResourceActive(condition, 'Condition') ? 'error' : 'action'} 
                        fontSize="small" 
                      />
                    </ListItemIcon>
                    <ListItemText
                      primary={condition.code?.text || condition.code?.coding?.[0]?.display || 'Unknown'}
                      secondary={
                        <Stack spacing={0}>
                          <Typography variant="caption">
                            Status: {condition.clinicalStatus?.coding?.[0]?.code || 'unknown'}
                            {condition.onsetDateTime && ` • Since: ${format(parseISO(condition.onsetDateTime), 'MMM yyyy')}`}
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
                {processedData.conditions.length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                    No {showActiveOnly ? 'active' : ''} problems found
                  </Typography>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Medications */}
        <Grid item xs={12} md={6} lg={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Medications ({processedData.medications.length})
              </Typography>
              <List dense>
                {processedData.medications.slice(0, 5).map((med) => (
                  <ListItem key={med.id}>
                    <ListItemIcon>
                      <MedicationIcon 
                        color={isResourceActive(med, 'MedicationRequest') ? 'secondary' : 'action'} 
                        fontSize="small" 
                      />
                    </ListItemIcon>
                    <ListItemText
                      primary={med.medicationCodeableConcept?.text || 'Unknown medication'}
                      secondary={
                        <Stack spacing={0}>
                          <Typography variant="caption">
                            Status: {med.status} • {med.dosageInstruction?.[0]?.text || 'No dosage info'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Started: {med.authoredOn ? format(parseISO(med.authoredOn), 'MMM d, yyyy') : 'Unknown'}
                          </Typography>
                        </Stack>
                      }
                    />
                  </ListItem>
                ))}
                {processedData.medications.length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                    No {showActiveOnly ? 'active' : ''} medications found
                  </Typography>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Allergies */}
        <Grid item xs={12} md={6} lg={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Allergies & Intolerances ({processedData.allergies.length})
              </Typography>
              <List dense>
                {processedData.allergies.map((allergy) => (
                  <ListItem key={allergy.id}>
                    <ListItemIcon>
                      <WarningIcon 
                        color={isResourceActive(allergy, 'AllergyIntolerance') ? 'warning' : 'action'} 
                        fontSize="small" 
                      />
                    </ListItemIcon>
                    <ListItemText
                      primary={allergy.code?.text || 'Unknown allergen'}
                      secondary={
                        <Stack spacing={0}>
                          <Typography variant="caption">
                            Status: {allergy.clinicalStatus?.coding?.[0]?.code || 'unknown'}
                            • Type: {typeof allergy.type === 'string' ? allergy.type : 'allergy'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Severity: {typeof allergy.criticality === 'string' ? allergy.criticality : 'unknown'}
                          </Typography>
                        </Stack>
                      }
                    />
                  </ListItem>
                ))}
                {processedData.allergies.length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                    {showActiveOnly ? 'No active allergies' : 'NKDA - No known drug allergies'}
                  </Typography>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Labs */}
        <Grid item xs={12} md={6} lg={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent Lab Results ({processedData.labs.length})
              </Typography>
              <List dense>
                {processedData.labs.slice(0, 5).map((lab) => (
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
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default PatientDashboardV3Enhanced;