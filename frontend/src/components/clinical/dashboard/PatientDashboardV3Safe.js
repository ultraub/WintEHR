/**
 * PatientDashboardV3Safe Component
 * Safe version with comprehensive object rendering protection
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
import { formatCodeableConcept, getDisplayText, formatFHIRDate } from '../../../utils/fhirFormatters';

// Safe value getter - ensures we never render objects
const safeValue = (value, defaultValue = '') => {
  if (value === null || value === undefined) return defaultValue;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'object') {
    // Try to extract display text from FHIR objects
    return getDisplayText(value) || defaultValue;
  }
  return defaultValue;
};

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
      ] = await Promise.all([
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

      setData({
        patient: patientResult,
        encounters: encountersResult.resources || [],
        conditions: conditionsResult.resources || [],
        medications: medicationsResult.resources || [],
        observations: observationsResult.resources || [],
        allergies: allergiesResult.resources || [],
        carePlans: carePlansResult.resources || [],
        careTeam: careTeamResult.resources || [],
        coverage: coverageResult.resources || [],
        documentReferences: documentsResult.resources || []
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

// Main Dashboard Component with Safe Rendering
const PatientDashboardV3Safe = ({ patientId }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { setCurrentPatient } = useFHIRResource();
  const { data, loading, error, refresh, lastRefresh } = usePatientDashboardData(patientId);

  // Set current patient context
  useEffect(() => {
    if (patientId) {
      setCurrentPatient(patientId);
    }
  }, [patientId, setCurrentPatient]);

  // Process data for display with safe value extraction
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
      {/* Main Content Grid */}
      <Grid container spacing={3}>
        {/* Active Problems - with safe rendering */}
        <Grid item xs={12} md={6} lg={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Active Problems ({processedData.activeConditions.length})
              </Typography>
              <List dense>
                {processedData.activeConditions.slice(0, 3).map((condition) => (
                  <ListItem key={condition.id}>
                    <ListItemIcon>
                      <DotIcon color="error" fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary={safeValue(formatCodeableConcept(condition.code), 'Unknown condition')}
                      secondary={
                        <Typography variant="caption" component="div">
                          Since: {condition.onsetDateTime ? formatFHIRDate(condition.onsetDateTime, 'short') : 'Unknown'}
                          {condition.severity && (
                            <Chip
                              label={safeValue(formatCodeableConcept(condition.severity), 'Severity')}
                              size="small"
                              color={condition.severity?.coding?.[0]?.code === 'severe' ? 'error' : 'default'}
                              sx={{ ml: 1 }}
                            />
                          )}
                        </Typography>
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
            </CardContent>
          </Card>
        </Grid>

        {/* Medications - with safe rendering */}
        <Grid item xs={12} md={6} lg={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Active Medications ({data.medications.length})
              </Typography>
              <List dense>
                {data.medications.slice(0, 3).map((med) => (
                  <ListItem key={med.id}>
                    <ListItemIcon>
                      <MedicationIcon color="secondary" fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary={safeValue(formatCodeableConcept(med.medicationCodeableConcept), 'Unknown medication')}
                      secondary={
                        <Typography variant="caption" component="div">
                          {safeValue(med.dosageInstruction?.[0]?.text, 'No dosage info')}
                          <br />
                          Started: {med.authoredOn ? formatFHIRDate(med.authoredOn, 'short') : 'Unknown'}
                        </Typography>
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
            </CardContent>
          </Card>
        </Grid>

        {/* Allergies - with safe rendering */}
        <Grid item xs={12} md={6} lg={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Allergies & Intolerances ({processedData.activeAllergies.length})
              </Typography>
              <List dense>
                {processedData.activeAllergies.map((allergy) => (
                  <ListItem key={allergy.id}>
                    <ListItemIcon>
                      <WarningIcon color="warning" fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary={safeValue(formatCodeableConcept(allergy.code), 'Unknown allergen')}
                      secondary={
                        <Typography variant="caption" component="div">
                          Type: {safeValue(allergy.type, 'allergy')}
                          <br />
                          Severity: {safeValue(allergy.criticality, 'unknown')}
                        </Typography>
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
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default PatientDashboardV3Safe;