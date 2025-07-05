import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Grid,
  Typography,
  Card,
  CardContent,
  CardActions,
  Chip,
  Button,
  CircularProgress,
  Alert,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemButton,
  IconButton,
  Tooltip,
  Snackbar
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Home as HomeIcon,
  Warning as WarningIcon,
  Assignment as AssignmentIcon,
  Science as ScienceIcon,
  Description as DocumentIcon,
  OpenInNew as OpenInNewIcon,
  Event as EventIcon,
  FiberManualRecord as DotIcon,
  Security as SecurityIcon,
  Sync as SyncIcon,
  SyncDisabled as SyncDisabledIcon
} from '@mui/icons-material';
import { format, differenceInYears, parseISO, isToday, isYesterday, differenceInDays } from 'date-fns';
import { fhirClient } from '../services/fhirClient';
import { useClinical } from '../contexts/ClinicalContext';
import { useWebSocket } from '../contexts/WebSocketContext';
import VitalsOverview from '../components/clinical/charts/VitalsOverview';
import CDSHooksDisplay from '../components/CDSHooksDisplay';
import { decodeFhirId, getClinicalWorkspaceUrl, getAuditTrailUrl } from '../utils/navigationUtils';

function PatientViewRefined() {
  const { id: encodedId } = useParams();
  const id = decodeFhirId(encodedId); // Decode the FHIR ID from URL
  const navigate = useNavigate();
  const { loadPatient, setCurrentEncounter } = useClinical();
  const { subscribe, unsubscribe, lastMessage, isConnected } = useWebSocket();
  
  const [patient, setPatient] = useState(null);
  const [encounters, setEncounters] = useState([]);
  const [conditions, setConditions] = useState([]);
  const [medications, setMedications] = useState([]);
  const [recentLabs, setRecentLabs] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [vitalsData, setVitalsData] = useState([]);
  const [realtimeUpdate, setRealtimeUpdate] = useState(null);

  // Subscribe to real-time updates for this patient
  useEffect(() => {
    if (id && isConnected) {
      const subscriptionId = `patient-view-${id}`;
      
      // Subscribe to updates for all relevant resource types
      subscribe(subscriptionId, [
        'Patient',
        'Observation', 
        'Condition',
        'MedicationRequest',
        'Encounter',
        'DiagnosticReport',
        'Flag'
      ], [id]);
      
      return () => {
        unsubscribe(subscriptionId);
      };
    }
  }, [id, isConnected, subscribe, unsubscribe]);
  
  // Handle incoming WebSocket messages
  useEffect(() => {
    if (lastMessage && lastMessage.data) {
      try {
        const message = JSON.parse(lastMessage.data);
        
        // Handle resource updates
        if (message.type === 'resource_update' && message.data) {
          const { resource_type, resource_id, patient_id, action } = message.data;
          
          // Only process if it's for our current patient
          if (patient_id === id) {
            console.log(`Real-time update: ${action} ${resource_type}/${resource_id}`);
            
            // Show notification
            setRealtimeUpdate({
              message: `${resource_type} ${action}`,
              timestamp: Date.now()
            });
            
            // Auto-hide after 5 seconds
            setTimeout(() => setRealtimeUpdate(null), 5000);
            
            // Determine what needs to be refreshed based on resource type
            switch (resource_type) {
              case 'Observation':
                // Refresh labs and vitals
                if (patient) {
                  fetchObservations();
                }
                break;
                
              case 'Condition':
                // Refresh conditions
                if (patient) {
                  fetchConditions();
                }
                break;
                
              case 'MedicationRequest':
                // Refresh medications
                if (patient) {
                  fetchMedications();
                }
                break;
                
              case 'Encounter':
                // Refresh encounters
                if (patient) {
                  fetchEncounters();
                }
                break;
                
              case 'Flag':
                // Refresh alerts
                if (patient) {
                  fetchAlerts();
                }
                break;
                
              case 'Patient':
                // Refresh entire patient summary
                if (resource_id === id) {
                  fetchPatientSummary();
                }
                break;
            }
          }
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    }
  }, [lastMessage, id]);

  const fetchPatientSummary = async () => {
      try {
        setLoading(true);
        
        // Fetch patient data
        const fhirPatient = await fhirClient.read('Patient', id);
        
        // Transform FHIR patient to expected format
        const name = fhirPatient.name?.[0] || {};
        const telecom = fhirPatient.telecom || [];
        const address = fhirPatient.address?.[0] || {};
        const phone = telecom.find(t => t.system === 'phone')?.value;
        const email = telecom.find(t => t.system === 'email')?.value;
        const mrn = fhirPatient.identifier?.find(id => 
          id.type?.coding?.[0]?.code === 'MR' || 
          id.system?.includes('mrn')
        )?.value || fhirPatient.identifier?.[0]?.value || '';
        
        const transformedPatient = {
          id: fhirPatient.id,
          mrn: mrn,
          first_name: name.given?.join(' ') || '',
          last_name: name.family || '',
          date_of_birth: fhirPatient.birthDate,
          gender: fhirPatient.gender,
          phone: phone,
          email: email,
          address: address.line?.join(', ') || '',
          city: address.city,
          state: address.state,
          zip_code: address.postalCode
        };
        
        // Fetch additional data using FHIR APIs
        const [
          encountersResult,
          conditionsResult,
          medicationsResult,
          observationsResult
        ] = await Promise.all([
          fhirClient.getEncounters(id),
          fhirClient.getConditions(id, 'active'),
          fhirClient.getMedications(id),
          fhirClient.getObservations(id)
        ]);
        
        // Transform encounters
        const transformedEncounters = encountersResult.resources.slice(0, 5).map(enc => {
          const type = enc.type?.[0];
          const period = enc.period || {};
          return {
            id: enc.id,
            patient_id: id,
            encounter_type: type?.text || type?.coding?.[0]?.display || 'Unknown',
            encounter_date: period.start || enc.date,
            status: enc.status,
            provider: enc.participant?.find(p => 
              p.type?.[0]?.coding?.[0]?.code === 'ATND'
            )?.individual?.display || 'Unknown Provider'
          };
        });
        
        // Transform conditions
        const transformedConditions = conditionsResult.resources.map(cond => ({
          id: cond.id,
          patient_id: id,
          code: cond.code?.coding?.[0]?.code,
          display: cond.code?.text || cond.code?.coding?.[0]?.display || 'Unknown',
          clinical_status: cond.clinicalStatus?.coding?.[0]?.code || 'active',
          onset_date: cond.onsetDateTime || cond.onsetPeriod?.start
        }));
        
        // Transform medications
        const transformedMedications = medicationsResult.resources.map(med => ({
          id: med.id,
          patient_id: id,
          medication_name: med.medicationCodeableConcept?.text || 
                          med.medicationCodeableConcept?.coding?.[0]?.display || 'Unknown',
          dosage: med.dosageInstruction?.[0]?.text || '',
          status: med.status,
          authored_on: med.authoredOn
        }));
        
        // Transform and categorize observations
        const allObs = observationsResult.resources.map(obs => ({
          id: obs.id,
          patient_id: id,
          display: obs.code?.text || obs.code?.coding?.[0]?.display || 'Unknown',
          value: obs.valueQuantity?.value || obs.valueString || '',
          unit: obs.valueQuantity?.unit || '',
          observation_date: obs.effectiveDateTime || obs.issued,
          status: obs.status,
          interpretation: obs.interpretation?.[0]?.coding?.[0]?.code,
          reference_range_low: obs.referenceRange?.[0]?.low?.value,
          reference_range_high: obs.referenceRange?.[0]?.high?.value,
          reference_range_text: obs.referenceRange?.[0]?.text
        }));
        
        // Split observations into lab and vitals
        const labObs = allObs.filter(obs => {
          const display = obs.display?.toLowerCase() || '';
          return !display.includes('blood pressure') && !display.includes('heart rate') && 
                 !display.includes('temperature') && !display.includes('weight') && 
                 !display.includes('height') && !display.includes('oxygen') && 
                 !display.includes('respiratory') && !display.includes('bmi') && 
                 !display.includes('pulse') && !display.includes('bp');
        }).map(obs => {
          // Add abnormal flag detection based on interpretation or reference ranges
          const hasInterpretation = obs.interpretation && 
            ['H', 'HH', 'L', 'LL', 'A', 'AA'].includes(obs.interpretation.toUpperCase());
          
          // Check if value is outside reference range
          let isOutOfRange = false;
          if (obs.value && obs.reference_range_low && obs.reference_range_high) {
            const value = parseFloat(obs.value);
            const low = parseFloat(obs.reference_range_low);
            const high = parseFloat(obs.reference_range_high);
            if (!isNaN(value) && !isNaN(low) && !isNaN(high)) {
              isOutOfRange = value < low || value > high;
            }
          }
          
          return {
            ...obs,
            is_abnormal: hasInterpretation || isOutOfRange
          };
        }).slice(0, 10);
        
        const vitalsObs = allObs.filter(obs => {
          const display = obs.display?.toLowerCase() || '';
          return display.includes('blood pressure') || display.includes('heart rate') || 
                 display.includes('temperature') || display.includes('weight') || 
                 display.includes('height') || display.includes('oxygen') || 
                 display.includes('respiratory') || display.includes('bmi') || 
                 display.includes('pulse') || display.includes('bp');
        }).slice(0, 200);
        
        const observationsResponse = { labObs, vitalsObs };

        setPatient(transformedPatient);
        setEncounters(transformedEncounters);
        setConditions(transformedConditions);
        setMedications(transformedMedications);
        setRecentLabs(observationsResponse.labObs);
        setVitalsData(observationsResponse.vitalsObs);
        
        // Load patient alerts from FHIR Flag resources
        try {
          const flagsResult = await fhirClient.search('Flag', {
            patient: id,
            status: 'active',
            _sort: '-date'
          });
          
          const transformedAlerts = (flagsResult.resources || []).map(flag => ({
            id: flag.id,
            message: flag.code?.text || flag.code?.coding?.[0]?.display || 'Clinical Alert',
            category: flag.category?.[0]?.coding?.[0]?.code || 'clinical',
            status: flag.status,
            period: flag.period,
            author: flag.author?.display || 'System'
          }));
          
          setAlerts(transformedAlerts);
        } catch (err) {
          console.error('Error loading patient flags:', err);
          setAlerts([]);
        }
        
        // Load patient in clinical context with proper transformation
        await loadPatient(id);
        
        setError(null);
      } catch (err) {
        console.error('Error fetching patient summary:', err);
        console.error('Error details:', {
          message: err.message,
          response: err.response?.data,
          status: err.response?.status,
          config: err.config?.url
        });
        if (err.response?.status === 404) {
          setError('Failed to load patient: 404');
        } else {
          setError(`Failed to load patient summary: ${err.response?.status || err.message}`);
        }
      } finally {
        setLoading(false);
      }
  };
  
  useEffect(() => {
    fetchPatientSummary();
  }, [id]);
  
  // Separate fetch functions for real-time updates
  const fetchObservations = async () => {
    try {
      const observationsResult = await fhirClient.getObservations(id);
      
      // Transform and categorize observations
      const allObs = observationsResult.resources.map(obs => ({
        id: obs.id,
        patient_id: id,
        display: obs.code?.text || obs.code?.coding?.[0]?.display || 'Unknown',
        value: obs.valueQuantity?.value || obs.valueString || '',
        unit: obs.valueQuantity?.unit || '',
        observation_date: obs.effectiveDateTime || obs.issued,
        status: obs.status,
        interpretation: obs.interpretation?.[0]?.coding?.[0]?.code,
        reference_range_low: obs.referenceRange?.[0]?.low?.value,
        reference_range_high: obs.referenceRange?.[0]?.high?.value,
        reference_range_text: obs.referenceRange?.[0]?.text
      }));
      
      // Split observations into lab and vitals
      const labObs = allObs.filter(obs => {
        const display = obs.display?.toLowerCase() || '';
        return !display.includes('blood pressure') && !display.includes('heart rate') && 
               !display.includes('temperature') && !display.includes('weight') && 
               !display.includes('height') && !display.includes('oxygen') && 
               !display.includes('respiratory') && !display.includes('bmi') && 
               !display.includes('pulse') && !display.includes('bp');
      }).map(obs => {
        // Add abnormal flag detection
        const hasInterpretation = obs.interpretation && 
          ['H', 'HH', 'L', 'LL', 'A', 'AA'].includes(obs.interpretation.toUpperCase());
        
        let isOutOfRange = false;
        if (obs.value && obs.reference_range_low && obs.reference_range_high) {
          const value = parseFloat(obs.value);
          const low = parseFloat(obs.reference_range_low);
          const high = parseFloat(obs.reference_range_high);
          if (!isNaN(value) && !isNaN(low) && !isNaN(high)) {
            isOutOfRange = value < low || value > high;
          }
        }
        
        return {
          ...obs,
          is_abnormal: hasInterpretation || isOutOfRange
        };
      }).slice(0, 10);
      
      const vitalsObs = allObs.filter(obs => {
        const display = obs.display?.toLowerCase() || '';
        return display.includes('blood pressure') || display.includes('heart rate') || 
               display.includes('temperature') || display.includes('weight') || 
               display.includes('height') || display.includes('oxygen') || 
               display.includes('respiratory') || display.includes('bmi') || 
               display.includes('pulse') || display.includes('bp');
      }).slice(0, 200);
      
      setRecentLabs(labObs);
      setVitalsData(vitalsObs);
    } catch (error) {
      console.error('Error fetching observations:', error);
    }
  };
  
  const fetchConditions = async () => {
    try {
      const conditionsResult = await fhirClient.getConditions(id, 'active');
      
      const transformedConditions = conditionsResult.resources.map(cond => ({
        id: cond.id,
        patient_id: id,
        code: cond.code?.coding?.[0]?.code,
        display: cond.code?.text || cond.code?.coding?.[0]?.display || 'Unknown',
        clinical_status: cond.clinicalStatus?.coding?.[0]?.code || 'active',
        onset_date: cond.onsetDateTime || cond.onsetPeriod?.start
      }));
      
      setConditions(transformedConditions);
    } catch (error) {
      console.error('Error fetching conditions:', error);
    }
  };
  
  const fetchMedications = async () => {
    try {
      const medicationsResult = await fhirClient.getMedications(id);
      
      const transformedMedications = medicationsResult.resources.map(med => ({
        id: med.id,
        patient_id: id,
        medication_name: med.medicationCodeableConcept?.text || 
                        med.medicationCodeableConcept?.coding?.[0]?.display || 'Unknown',
        dosage: med.dosageInstruction?.[0]?.text || '',
        status: med.status,
        authored_on: med.authoredOn
      }));
      
      setMedications(transformedMedications);
    } catch (error) {
      console.error('Error fetching medications:', error);
    }
  };
  
  const fetchEncounters = async () => {
    try {
      const encountersResult = await fhirClient.getEncounters(id);
      
      const transformedEncounters = encountersResult.resources.slice(0, 5).map(enc => {
        const type = enc.type?.[0];
        const period = enc.period || {};
        return {
          id: enc.id,
          patient_id: id,
          encounter_type: type?.text || type?.coding?.[0]?.display || 'Unknown',
          encounter_date: period.start || enc.date,
          status: enc.status,
          provider: enc.participant?.find(p => 
            p.type?.[0]?.coding?.[0]?.code === 'ATND'
          )?.individual?.display || 'Unknown Provider'
        };
      });
      
      setEncounters(transformedEncounters);
    } catch (error) {
      console.error('Error fetching encounters:', error);
    }
  };
  
  const fetchAlerts = async () => {
    try {
      const flagsResult = await fhirClient.search('Flag', {
        patient: id,
        status: 'active',
        _sort: '-date'
      });
      
      const transformedAlerts = (flagsResult.resources || []).map(flag => ({
        id: flag.id,
        message: flag.code?.text || flag.code?.coding?.[0]?.display || 'Clinical Alert',
        category: flag.category?.[0]?.coding?.[0]?.code || 'clinical',
        status: flag.status,
        period: flag.period,
        author: flag.author?.display || 'System'
      }));
      
      setAlerts(transformedAlerts);
    } catch (error) {
      console.error('Error fetching alerts:', error);
      setAlerts([]);
    }
  };

  const calculateAge = (birthDate) => {
    return differenceInYears(new Date(), new Date(birthDate));
  };

  const getInitials = (firstName, lastName) => {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
  };

  const formatEncounterDate = (date) => {
    if (!date) return 'Date not available';
    
    try {
      const encounterDate = parseISO(date);
      if (isNaN(encounterDate.getTime())) return 'Invalid date';
      
      if (isToday(encounterDate)) return 'Today';
      if (isYesterday(encounterDate)) return 'Yesterday';
      const daysAgo = differenceInDays(new Date(), encounterDate);
      if (daysAgo < 7) return `${daysAgo} days ago`;
      return format(encounterDate, 'MMM d, yyyy');
    } catch (error) {
      console.error('Error formatting encounter date:', date, error);
      return 'Invalid date';
    }
  };

  const openClinicalWorkspace = (mode = 'overview', encounter = null) => {
    const url = getClinicalWorkspaceUrl(patient.id, {
      mode,
      encounterId: encounter?.id
    });
    if (encounter) {
      setCurrentEncounter(encounter);
    }
    navigate(url);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!patient) {
    return (
      <Box p={3}>
        <Alert severity="warning">Patient not found</Alert>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton onClick={() => navigate('/patients')} sx={{ mr: 1 }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h5">Patient Summary</Typography>
          <Tooltip title={isConnected ? 'Real-time updates active' : 'Real-time updates disconnected'}>
            <IconButton size="small" sx={{ ml: 2 }}>
              {isConnected ? (
                <SyncIcon color="success" fontSize="small" />
              ) : (
                <SyncDisabledIcon color="disabled" fontSize="small" />
              )}
            </IconButton>
          </Tooltip>
        </Box>
        <Button
          variant="contained"
          startIcon={<OpenInNewIcon />}
          onClick={() => openClinicalWorkspace()}
        >
          Open Clinical Workspace
        </Button>
      </Box>

      <Grid container spacing={3}>
        {/* Patient Header Card */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Grid container spacing={3} alignItems="center">
                <Grid item>
                  <Avatar
                    sx={{ 
                      width: 80, 
                      height: 80, 
                      bgcolor: 'primary.main',
                      fontSize: '2rem'
                    }}
                  >
                    {getInitials(patient.first_name, patient.last_name)}
                  </Avatar>
                </Grid>
                <Grid item xs>
                  <Typography variant="h4" gutterBottom>
                    {patient.last_name}, {patient.first_name}
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item>
                      <Typography variant="body2" color="text.secondary">
                        MRN: <strong>{patient.mrn}</strong>
                      </Typography>
                    </Grid>
                    <Grid item>
                      <Typography variant="body2" color="text.secondary">
                        DOB: <strong>{format(new Date(patient.date_of_birth), 'MM/dd/yyyy')}</strong>
                      </Typography>
                    </Grid>
                    <Grid item>
                      <Typography variant="body2" color="text.secondary">
                        Age: <strong>{calculateAge(patient.date_of_birth)} years</strong>
                      </Typography>
                    </Grid>
                    <Grid item>
                      <Typography variant="body2" color="text.secondary">
                        Gender: <strong>{patient.gender}</strong>
                      </Typography>
                    </Grid>
                  </Grid>
                </Grid>
                <Grid item>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      <PhoneIcon fontSize="small" sx={{ mr: 1, verticalAlign: 'middle' }} />
                      {patient.phone}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      <EmailIcon fontSize="small" sx={{ mr: 1, verticalAlign: 'middle' }} />
                      {patient.email}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      <HomeIcon fontSize="small" sx={{ mr: 1, verticalAlign: 'middle' }} />
                      {patient.city}, {patient.state}
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* CDS Hooks Display */}
        <Grid item xs={12}>
          <CDSHooksDisplay patientId={id} hook="patient-view" />
        </Grid>

        {/* Clinical Alerts */}
        {alerts.length > 0 && (
          <Grid item xs={12}>
            <Alert severity="warning" icon={<WarningIcon />}>
              <Typography variant="subtitle2" gutterBottom>
                <strong>Clinical Alerts</strong>
              </Typography>
              {alerts.map((alert, index) => (
                <Typography key={index} variant="body2">
                  • {alert.message}
                </Typography>
              ))}
            </Alert>
          </Grid>
        )}

        {/* Quick Actions */}
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Quick Actions
              </Typography>
              <List>
                <ListItemButton onClick={() => openClinicalWorkspace('documentation')}>
                  <ListItemIcon>
                    <DocumentIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText primary="New Encounter Note" />
                </ListItemButton>
                <ListItemButton onClick={() => openClinicalWorkspace('orders')}>
                  <ListItemIcon>
                    <AssignmentIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText primary="Place Orders" />
                </ListItemButton>
                <ListItemButton onClick={() => openClinicalWorkspace('results')}>
                  <ListItemIcon>
                    <ScienceIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText primary="Review Results" />
                </ListItemButton>
                <ListItemButton onClick={() => navigate(getAuditTrailUrl('Patient', id))}>
                  <ListItemIcon>
                    <SecurityIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText primary="View Audit Trail" />
                </ListItemButton>
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Encounters */}
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent Encounters
              </Typography>
              <List>
                {encounters.slice(0, 5).map((encounter) => (
                  <ListItem key={encounter.id} disablePadding>
                    <ListItemButton onClick={() => openClinicalWorkspace('overview', encounter)}>
                      <ListItemIcon>
                        <EventIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText 
                        primary={encounter.encounter_type}
                        secondary={
                          <>
                            {formatEncounterDate(encounter.encounter_date)}
                            {encounter.chief_complaint && ` • ${encounter.chief_complaint}`}
                          </>
                        }
                      />
                      <Tooltip title="Open in Clinical Workspace">
                        <IconButton size="small" edge="end">
                          <OpenInNewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
              <Box sx={{ mt: 2, textAlign: 'center' }}>
                <Button size="small" onClick={() => navigate(`/patients/${id}/encounters`)}>
                  View All Encounters
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Clinical Summary */}
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Clinical Summary
              </Typography>
              
              {/* Active Problems */}
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Active Problems ({conditions.length})
                </Typography>
                {conditions.slice(0, 3).map((condition) => (
                  <Chip
                    key={condition.id}
                    label={condition.display || condition.description || 'Unknown condition'}
                    size="small"
                    sx={{ mr: 0.5, mb: 0.5 }}
                  />
                ))}
                {conditions.length > 3 && (
                  <Typography variant="caption" color="text.secondary">
                    +{conditions.length - 3} more
                  </Typography>
                )}
              </Box>

              {/* Active Medications */}
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Active Medications ({medications.length})
                </Typography>
                {medications.slice(0, 3).map((med) => (
                  <Chip
                    key={med.id}
                    label={med.medication_name}
                    size="small"
                    color="primary"
                    variant="outlined"
                    sx={{ mr: 0.5, mb: 0.5 }}
                  />
                ))}
                {medications.length > 3 && (
                  <Typography variant="caption" color="text.secondary">
                    +{medications.length - 3} more
                  </Typography>
                )}
              </Box>

              {/* Recent Labs */}
              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Recent Lab Results
                </Typography>
                {recentLabs.length > 0 ? (
                  <List dense>
                    {recentLabs.slice(0, 3).map((lab) => (
                      <ListItem key={lab.id} disableGutters>
                        <ListItemIcon sx={{ minWidth: 30 }}>
                          <DotIcon 
                            fontSize="small" 
                            color={lab.is_abnormal ? 'warning' : 'success'}
                          />
                        </ListItemIcon>
                        <ListItemText 
                          primary={lab.display}
                          secondary={`${lab.value} ${lab.unit}`}
                          primaryTypographyProps={{ variant: 'body2' }}
                          secondaryTypographyProps={{ variant: 'caption' }}
                        />
                      </ListItem>
                    ))}
                  </List>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No recent lab results
                  </Typography>
                )}
              </Box>
            </CardContent>
            <CardActions>
              <Button 
                size="small" 
                fullWidth
                onClick={() => openClinicalWorkspace('overview')}
              >
                View Full Clinical Details
              </Button>
            </CardActions>
          </Card>
        </Grid>

        {/* Vital Signs Overview */}
        <Grid item xs={12}>
          <VitalsOverview patientId={id} vitalsData={vitalsData} compact={true} />
        </Grid>
      </Grid>
      
      {/* Real-time update notification */}
      <Snackbar
        open={!!realtimeUpdate}
        autoHideDuration={5000}
        onClose={() => setRealtimeUpdate(null)}
        message={realtimeUpdate?.message || ''}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        sx={{
          '& .MuiSnackbarContent-root': {
            backgroundColor: 'info.main'
          }
        }}
      />
    </Box>
  );
}

export default PatientViewRefined;