/**
 * PatientSummaryV4 Component
 * Beautiful, modern patient summary with clinical workspace integration
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  Stack,
  Alert,
  CircularProgress,
  IconButton,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Badge,
  Fab,
  useTheme,
  alpha,
  Tooltip
} from '@mui/material';
import {
  Person as PersonIcon,
  Assignment as WorkspaceIcon,
  LocalHospital as ConditionIcon,
  Medication as MedicationIcon,
  Warning as WarningIcon,
  Science as LabIcon,
  MonitorHeart as VitalsIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Home as AddressIcon,
  Edit as EditIcon,
  Timeline as TimelineIcon,
  EventNote as EncounterIcon,
  CalendarToday as CalendarIcon,
  Star as StarIcon,
  Launch as LaunchIcon
} from '@mui/icons-material';
import { format, parseISO, differenceInYears } from 'date-fns';
import { useFHIRResource } from '../../../contexts/FHIRResourceContext';

const PatientSummaryV4 = ({ patientId }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { searchResources } = useFHIRResource();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [patientData, setPatientData] = useState({
    patient: null,
    conditions: [],
    medications: [],
    observations: [],
    encounters: [],
    allergies: []
  });

  // Load patient data
  useEffect(() => {
    const loadPatientData = async () => {
      if (!patientId) return;
      
      try {
        setLoading(true);
        setError(null);

        const [
          patientResult,
          conditionsResult,
          medicationsResult,
          observationsResult,
          encountersResult,
          allergiesResult
        ] = await Promise.allSettled([
          searchResources('Patient', { _id: patientId }),
          searchResources('Condition', { patient: patientId, _count: 10, _sort: '-onset-date' }),
          searchResources('MedicationRequest', { patient: patientId, _count: 10, _sort: '-date' }),
          searchResources('Observation', { patient: patientId, _count: 20, _sort: '-date' }),
          searchResources('Encounter', { patient: patientId, _count: 5, _sort: '-date' }),
          searchResources('AllergyIntolerance', { patient: patientId, _count: 10 })
        ]);

        setPatientData({
          patient: patientResult.status === 'fulfilled' ? patientResult.value.resources?.[0] : null,
          conditions: conditionsResult.status === 'fulfilled' ? conditionsResult.value.resources || [] : [],
          medications: medicationsResult.status === 'fulfilled' ? medicationsResult.value.resources || [] : [],
          observations: observationsResult.status === 'fulfilled' ? observationsResult.value.resources || [] : [],
          encounters: encountersResult.status === 'fulfilled' ? encountersResult.value.resources || [] : [],
          allergies: allergiesResult.status === 'fulfilled' ? allergiesResult.value.resources || [] : []
        });

      } catch (err) {
        console.error('Error loading patient data:', err);
        setError('Failed to load patient data');
      } finally {
        setLoading(false);
      }
    };

    loadPatientData();
  }, [patientId, searchResources]);

  // Processed patient info
  const patientInfo = useMemo(() => {
    if (!patientData.patient) return null;
    
    const patient = patientData.patient;
    const name = patient.name?.[0];
    const fullName = name ? `${name.given?.join(' ') || ''} ${name.family || ''}`.trim() : 'Unknown Patient';
    const age = patient.birthDate ? differenceInYears(new Date(), new Date(patient.birthDate)) : null;
    const phone = patient.telecom?.find(t => t.system === 'phone')?.value;
    const email = patient.telecom?.find(t => t.system === 'email')?.value;
    const address = patient.address?.[0];
    
    return {
      id: patient.id,
      fullName,
      firstName: name?.given?.[0] || '',
      lastName: name?.family || '',
      age,
      gender: patient.gender || 'unknown',
      birthDate: patient.birthDate,
      phone,
      email,
      address: address ? `${address.line?.join(' ') || ''}, ${address.city || ''}, ${address.state || ''} ${address.postalCode || ''}`.trim() : null
    };
  }, [patientData.patient]);

  // Active conditions
  const activeConditions = useMemo(() => {
    return patientData.conditions
      .filter(condition => 
        condition.clinicalStatus?.coding?.[0]?.code === 'active' ||
        !condition.clinicalStatus
      )
      .slice(0, 5);
  }, [patientData.conditions]);

  // Current medications
  const currentMedications = useMemo(() => {
    return patientData.medications
      .filter(med => 
        med.status === 'active' || 
        med.status === 'completed' ||
        !med.status
      )
      .slice(0, 5);
  }, [patientData.medications]);

  // Recent vitals
  const recentVitals = useMemo(() => {
    const vitalsCodes = ['8480-6', '8462-4', '8310-5', '39156-5', '3141-9', '29463-7'];
    return patientData.observations
      .filter(obs => 
        obs.category?.[0]?.coding?.[0]?.code === 'vital-signs' ||
        vitalsCodes.some(code => obs.code?.coding?.[0]?.code === code)
      )
      .slice(0, 4);
  }, [patientData.observations]);

  // Active allergies
  const activeAllergies = useMemo(() => {
    return patientData.allergies
      .filter(allergy => 
        allergy.clinicalStatus?.coding?.[0]?.code === 'active' ||
        !allergy.clinicalStatus
      )
      .slice(0, 3);
  }, [patientData.allergies]);

  const handleLaunchWorkspace = () => {
    navigate(`/patients/${patientId}/clinical`);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !patientInfo) {
    return (
      <Alert severity="error" sx={{ m: 3 }}>
        {error || 'Patient not found'}
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
      {/* Patient Header */}
      <Paper
        elevation={0}
        sx={{
          background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
          color: 'white',
          borderRadius: 3,
          mb: 3,
          overflow: 'hidden',
          position: 'relative'
        }}
      >
        <Box sx={{ p: 4 }}>
          <Grid container spacing={3} alignItems="center">
            <Grid item>
              <Avatar
                sx={{
                  width: 80,
                  height: 80,
                  fontSize: '2rem',
                  bgcolor: alpha(theme.palette.common.white, 0.2),
                  backdropFilter: 'blur(10px)'
                }}
              >
                {patientInfo.firstName.charAt(0)}{patientInfo.lastName.charAt(0)}
              </Avatar>
            </Grid>
            
            <Grid item xs>
              <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
                {patientInfo.fullName}
              </Typography>
              <Stack direction="row" spacing={3} flexWrap="wrap">
                <Stack direction="row" spacing={1} alignItems="center">
                  <PersonIcon fontSize="small" />
                  <Typography variant="body1">
                    {patientInfo.age ? `${patientInfo.age} years old` : 'Age unknown'} • {patientInfo.gender}
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <CalendarIcon fontSize="small" />
                  <Typography variant="body1">
                    {patientInfo.birthDate ? format(new Date(patientInfo.birthDate), 'MMM d, yyyy') : 'DOB unknown'}
                  </Typography>
                </Stack>
                {patientInfo.phone && (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <PhoneIcon fontSize="small" />
                    <Typography variant="body1">{patientInfo.phone}</Typography>
                  </Stack>
                )}
              </Stack>
            </Grid>

            <Grid item>
              <Stack spacing={2} alignItems="flex-end">
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<WorkspaceIcon />}
                  onClick={handleLaunchWorkspace}
                  sx={{
                    bgcolor: 'white',
                    color: theme.palette.primary.main,
                    fontWeight: 600,
                    px: 3,
                    py: 1.5,
                    '&:hover': {
                      bgcolor: alpha(theme.palette.common.white, 0.9)
                    }
                  }}
                >
                  Launch Clinical Workspace
                </Button>
                <Stack direction="row" spacing={1}>
                  <Tooltip title="Edit Patient">
                    <IconButton sx={{ color: 'white' }}>
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="View Timeline">
                    <IconButton sx={{ color: 'white' }}>
                      <TimelineIcon />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Stack>
            </Grid>
          </Grid>
        </Box>
      </Paper>

      {/* Quick Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Active Problems */}
        <Grid item xs={12} md={6} lg={3}>
          <Card sx={{ height: '100%', borderRadius: 2 }}>
            <CardContent>
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                <Badge badgeContent={activeConditions.length} color="error">
                  <ConditionIcon color="error" />
                </Badge>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Active Problems
                </Typography>
              </Stack>
              
              {activeConditions.length > 0 ? (
                <List dense>
                  {activeConditions.map((condition, index) => (
                    <ListItem key={condition.id} disablePadding>
                      <ListItemText
                        primary={condition.code?.text || 'Unknown condition'}
                        primaryTypographyProps={{ variant: 'body2', noWrap: true }}
                        secondary={condition.onsetDateTime ? format(parseISO(condition.onsetDateTime), 'MMM yyyy') : 'Unknown onset'}
                        secondaryTypographyProps={{ variant: 'caption' }}
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No active problems recorded
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Current Medications */}
        <Grid item xs={12} md={6} lg={3}>
          <Card sx={{ height: '100%', borderRadius: 2 }}>
            <CardContent>
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                <Badge badgeContent={currentMedications.length} color="primary">
                  <MedicationIcon color="primary" />
                </Badge>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Medications
                </Typography>
              </Stack>
              
              {currentMedications.length > 0 ? (
                <List dense>
                  {currentMedications.map((med, index) => (
                    <ListItem key={med.id} disablePadding>
                      <ListItemText
                        primary={med.medication?.concept?.text || med.medicationCodeableConcept?.text || 'Unknown medication'}
                        primaryTypographyProps={{ variant: 'body2', noWrap: true }}
                        secondary={med.dosageInstruction?.[0]?.text || 'See instructions'}
                        secondaryTypographyProps={{ variant: 'caption' }}
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No current medications
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Vitals */}
        <Grid item xs={12} md={6} lg={3}>
          <Card sx={{ height: '100%', borderRadius: 2 }}>
            <CardContent>
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                <Badge badgeContent={recentVitals.length} color="success">
                  <VitalsIcon color="success" />
                </Badge>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Recent Vitals
                </Typography>
              </Stack>
              
              {recentVitals.length > 0 ? (
                <List dense>
                  {recentVitals.map((vital, index) => (
                    <ListItem key={vital.id} disablePadding>
                      <ListItemText
                        primary={vital.code?.text || 'Unknown vital'}
                        primaryTypographyProps={{ variant: 'body2', noWrap: true }}
                        secondary={`${vital.valueQuantity?.value || '--'} ${vital.valueQuantity?.unit || ''}`}
                        secondaryTypographyProps={{ variant: 'caption' }}
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No recent vitals
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Allergies & Alerts */}
        <Grid item xs={12} md={6} lg={3}>
          <Card sx={{ height: '100%', borderRadius: 2 }}>
            <CardContent>
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                <Badge badgeContent={activeAllergies.length} color="warning">
                  <WarningIcon color="warning" />
                </Badge>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Allergies
                </Typography>
              </Stack>
              
              {activeAllergies.length > 0 ? (
                <List dense>
                  {activeAllergies.map((allergy, index) => (
                    <ListItem key={allergy.id} disablePadding>
                      <ListItemText
                        primary={allergy.code?.text || 'Unknown allergen'}
                        primaryTypographyProps={{ variant: 'body2', noWrap: true }}
                        secondary={`${allergy.criticality || 'Unknown'} severity`}
                        secondaryTypographyProps={{ variant: 'caption' }}
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  NKDA - No known allergies
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Quick Actions */}
      <Paper sx={{ p: 3, borderRadius: 2 }}>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
          Quick Actions
        </Typography>
        <Stack direction="row" spacing={2} flexWrap="wrap">
          <Button 
            variant="outlined" 
            startIcon={<EncounterIcon />}
            onClick={() => navigate(`/patients/${patientId}/encounters`)}
          >
            View Encounters
          </Button>
          <Button 
            variant="outlined" 
            startIcon={<LabIcon />}
            onClick={() => navigate(`/patients/${patientId}/lab-results`)}
          >
            Lab Results
          </Button>
          <Button 
            variant="outlined" 
            startIcon={<MedicationIcon />}
            onClick={() => navigate(`/patients/${patientId}/medications`)}
          >
            Medication History
          </Button>
          <Button 
            variant="outlined" 
            startIcon={<TimelineIcon />}
            onClick={() => navigate(`/patients/${patientId}/timeline`)}
          >
            Clinical Timeline
          </Button>
        </Stack>
      </Paper>

      {/* Floating Action Button */}
      <Fab
        color="primary"
        aria-label="clinical workspace"
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 1000
        }}
        onClick={handleLaunchWorkspace}
      >
        <LaunchIcon />
      </Fab>
    </Box>
  );
};

export default PatientSummaryV4;