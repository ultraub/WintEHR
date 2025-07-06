/**
 * Enhanced Patient Header Component
 * Comprehensive patient demographics and clinical summary for the workspace
 */
import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Chip,
  Stack,
  Avatar,
  IconButton,
  Tooltip,
  Divider,
  Button,
  useTheme,
  alpha
} from '@mui/material';
import {
  Person as PersonIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Home as HomeIcon,
  LocalHospital as HospitalIcon,
  Warning as WarningIcon,
  Medication as MedicationIcon,
  Assignment as AssignmentIcon,
  AccountCircle as AccountIcon,
  LocalHospital as EmergencyIcon,
  Print as PrintIcon,
  MoreVert as MoreIcon,
  CalendarMonth as CalendarIcon,
  Badge as BadgeIcon,
  HealthAndSafety as InsuranceIcon,
  Groups as TeamIcon
} from '@mui/icons-material';
import { format, differenceInYears, isValid, parseISO } from 'date-fns';
import { useFHIRResource } from '../../../contexts/FHIRResourceContext';
import { useNavigate } from 'react-router-dom';

const EnhancedPatientHeader = ({ patientId, onPrint }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { currentPatient, getPatientResources } = useFHIRResource();

  // Get patient resources
  const allergies = getPatientResources(patientId, 'AllergyIntolerance') || [];
  const conditions = getPatientResources(patientId, 'Condition') || [];
  const medications = getPatientResources(patientId, 'MedicationRequest') || [];
  const encounters = getPatientResources(patientId, 'Encounter') || [];

  const activeAllergies = allergies.filter(a => 
    a.clinicalStatus?.coding?.[0]?.code === 'active'
  );
  const activeConditions = conditions.filter(c => 
    c.clinicalStatus?.coding?.[0]?.code === 'active'
  );
  const activeMedications = medications.filter(m => 
    m.status === 'active'
  );

  // Get most recent encounter
  const sortedEncounters = [...encounters].sort((a, b) => {
    const dateA = new Date(a.period?.start || a.period?.end || 0);
    const dateB = new Date(b.period?.start || b.period?.end || 0);
    return dateB - dateA;
  });
  const lastEncounter = sortedEncounters[0];

  const calculateAge = (birthDate) => {
    if (!birthDate) return 'Unknown';
    try {
      const date = typeof birthDate === 'string' ? parseISO(birthDate) : new Date(birthDate);
      if (!isValid(date)) return 'Unknown';
      return differenceInYears(new Date(), date);
    } catch {
      return 'Unknown';
    }
  };

  const formatDate = (dateValue, formatString = 'MMM d, yyyy') => {
    if (!dateValue) return 'Unknown';
    try {
      const date = typeof dateValue === 'string' ? parseISO(dateValue) : new Date(dateValue);
      if (!isValid(date)) return 'Unknown';
      return format(date, formatString);
    } catch {
      return 'Unknown';
    }
  };

  const formatMRN = (patient) => {
    const mrn = patient?.identifier?.find(id => 
      id.type?.coding?.[0]?.code === 'MR' || 
      id.type?.text === 'Medical Record Number'
    );
    if (!mrn?.value) return 'No MRN';
    
    // If it's a UUID (more than 10 characters), show shortened version
    if (mrn.value.length > 10) {
      return mrn.value.substring(0, 8) + '...';
    }
    return mrn.value;
  };

  const getAddress = (patient) => {
    const address = patient?.address?.[0];
    if (!address) return 'No address on file';
    return `${address.line?.join(' ') || ''}, ${address.city || ''}, ${address.state || ''} ${address.postalCode || ''}`.trim();
  };

  const getPhone = (patient) => {
    const phone = patient?.telecom?.find(t => t.system === 'phone');
    return phone?.value || 'No phone';
  };

  const getEmail = (patient) => {
    const email = patient?.telecom?.find(t => t.system === 'email');
    return email?.value || 'No email';
  };

  const getInsurance = (patient) => {
    // This would typically come from Coverage resources
    return 'Blue Cross Blue Shield';
  };

  const getPCP = (patient) => {
    // This would typically come from the patient's care team
    return 'Dr. Sarah Johnson';
  };

  if (!currentPatient) {
    return null;
  }

  return (
    <Paper
      elevation={1}
      sx={{
        backgroundColor: theme.palette.background.paper,
        borderRadius: 0,
        borderBottom: `1px solid ${theme.palette.divider}`,
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <Box sx={{ p: 2 }}>
        <Grid container spacing={2}>
          {/* Patient Photo and Basic Info */}
          <Grid item xs={12} md={3}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Avatar
                sx={{
                  width: 64,
                  height: 64,
                  bgcolor: theme.palette.primary.main,
                  color: 'white',
                  fontSize: '1.25rem'
                }}
              >
                <PersonIcon sx={{ fontSize: 40 }} />
              </Avatar>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6" fontWeight="bold">
                  {currentPatient.name?.[0]?.given?.join(' ')} {currentPatient.name?.[0]?.family}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                  <Typography variant="body2" color="text.secondary">
                    MRN: {formatMRN(currentPatient)}
                  </Typography>
                  <Divider orientation="vertical" flexItem />
                  <Typography variant="body2" color="text.secondary">
                    {currentPatient.gender || 'Unknown'} • {calculateAge(currentPatient.birthDate)} years
                  </Typography>
                  <Divider orientation="vertical" flexItem />
                  <Typography variant="body2" color="text.secondary">
                    DOB: {formatDate(currentPatient.birthDate)}
                  </Typography>
                </Stack>
              </Box>
            </Box>

            {/* Clinical Alerts */}
            <Stack direction="row" spacing={1} sx={{ mt: 2 }} flexWrap="wrap">
              {activeAllergies.length > 0 && (
                <Chip
                  icon={<WarningIcon />}
                  label={`${activeAllergies.length} Allergies`}
                  color="error"
                  size="small"
                  onClick={() => navigate(`/patients/${patientId}/allergies`)}
                />
              )}
              {activeConditions.length > 0 && (
                <Chip
                  icon={<AssignmentIcon />}
                  label={`${activeConditions.length} Active Problems`}
                  color="warning"
                  size="small"
                  onClick={() => navigate(`/patients/${patientId}/problems`)}
                />
              )}
              {activeMedications.length > 0 && (
                <Chip
                  icon={<MedicationIcon />}
                  label={`${activeMedications.length} Medications`}
                  size="small"
                  onClick={() => navigate(`/patients/${patientId}/medications`)}
                />
              )}
            </Stack>
          </Grid>

          {/* Contact Information */}
          <Grid item xs={12} md={5}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              Contact Information
            </Typography>
            <Stack spacing={1}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <HomeIcon fontSize="small" color="action" />
                <Typography variant="body2">{getAddress(currentPatient)}</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PhoneIcon fontSize="small" color="action" />
                <Typography variant="body2">{getPhone(currentPatient)}</Typography>
              </Box>
              {getEmail(currentPatient) !== 'No email' && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <EmailIcon fontSize="small" color="action" />
                  <Typography variant="body2">{getEmail(currentPatient)}</Typography>
                </Box>
              )}
            </Stack>

            <Divider sx={{ my: 1.5 }} />

            {/* Insurance & Care Team */}
            <Stack spacing={1}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <InsuranceIcon fontSize="small" color="action" />
                <Typography variant="body2">Insurance: {getInsurance(currentPatient)}</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TeamIcon fontSize="small" color="action" />
                <Typography variant="body2">PCP: {getPCP(currentPatient)}</Typography>
              </Box>
            </Stack>
          </Grid>

          {/* Clinical Summary */}
          <Grid item xs={12} md={4}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                  Recent Activity
                </Typography>
                {lastEncounter && (
                  <Box>
                    <Typography variant="body2">
                      Last Visit: {formatDate(lastEncounter.period?.start || lastEncounter.period?.end)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Type: {lastEncounter.type?.[0]?.text || 'Unknown'}
                    </Typography>
                  </Box>
                )}

                {/* Code Status */}
                <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                  <Chip
                    icon={<EmergencyIcon />}
                    label="Full Code"
                    size="small"
                    color="success"
                  />
                </Stack>
              </Box>

              {/* Action Buttons */}
              <Stack direction="row" spacing={1}>
                <Tooltip title="Print Patient Summary">
                  <IconButton 
                    size="small" 
                    onClick={onPrint}
                  >
                    <PrintIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="More Options">
                  <IconButton size="small">
                    <MoreIcon />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Box>
          </Grid>
        </Grid>
      </Box>
    </Paper>
  );
};

export default EnhancedPatientHeader;