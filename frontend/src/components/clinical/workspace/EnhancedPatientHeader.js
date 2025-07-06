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
  Emergency as EmergencyIcon,
  Print as PrintIcon,
  MoreVert as MoreIcon,
  CalendarMonth as CalendarIcon,
  Badge as BadgeIcon,
  HealthAndSafety as InsuranceIcon,
  Groups as TeamIcon
} from '@mui/icons-material';
import { format, differenceInYears } from 'date-fns';
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
    return differenceInYears(new Date(), new Date(birthDate));
  };

  const formatMRN = (patient) => {
    const mrn = patient?.identifier?.find(id => 
      id.type?.coding?.[0]?.code === 'MR' || 
      id.type?.text === 'Medical Record Number'
    );
    return mrn?.value || 'No MRN';
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
      elevation={0}
      sx={{
        background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
        color: 'white',
        borderRadius: 0,
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
          width: '40%',
          height: '100%',
          opacity: 0.1,
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat'
        }}
      />

      <Box sx={{ position: 'relative', p: 3 }}>
        <Grid container spacing={3}>
          {/* Patient Photo and Basic Info */}
          <Grid item xs={12} md={4}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
              <Avatar
                sx={{
                  width: 80,
                  height: 80,
                  bgcolor: alpha(theme.palette.common.white, 0.2),
                  border: `3px solid ${alpha(theme.palette.common.white, 0.3)}`
                }}
              >
                <PersonIcon sx={{ fontSize: 40 }} />
              </Avatar>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h4" fontWeight="bold">
                  {currentPatient.name?.[0]?.given?.join(' ')} {currentPatient.name?.[0]?.family}
                </Typography>
                <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 1 }}>
                  <Chip
                    icon={<BadgeIcon />}
                    label={formatMRN(currentPatient)}
                    size="small"
                    sx={{ bgcolor: alpha(theme.palette.common.white, 0.2), color: 'white' }}
                  />
                  <Typography variant="body2">
                    {currentPatient.gender} • {calculateAge(currentPatient.birthDate)} years
                  </Typography>
                </Stack>
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  DOB: {currentPatient.birthDate ? format(new Date(currentPatient.birthDate), 'MMM d, yyyy') : 'Unknown'}
                </Typography>
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
                  sx={{ bgcolor: alpha(theme.palette.common.white, 0.2), color: 'white' }}
                  onClick={() => navigate(`/patients/${patientId}/medications`)}
                />
              )}
            </Stack>
          </Grid>

          {/* Contact Information */}
          <Grid item xs={12} md={4}>
            <Typography variant="subtitle2" sx={{ opacity: 0.8, mb: 1 }}>
              Contact Information
            </Typography>
            <Stack spacing={1}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <HomeIcon fontSize="small" sx={{ opacity: 0.8 }} />
                <Typography variant="body2">{getAddress(currentPatient)}</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PhoneIcon fontSize="small" sx={{ opacity: 0.8 }} />
                <Typography variant="body2">{getPhone(currentPatient)}</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <EmailIcon fontSize="small" sx={{ opacity: 0.8 }} />
                <Typography variant="body2">{getEmail(currentPatient)}</Typography>
              </Box>
            </Stack>

            <Divider sx={{ my: 2, borderColor: alpha(theme.palette.common.white, 0.2) }} />

            {/* Insurance & Care Team */}
            <Stack spacing={1}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <InsuranceIcon fontSize="small" sx={{ opacity: 0.8 }} />
                <Typography variant="body2">Insurance: {getInsurance(currentPatient)}</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TeamIcon fontSize="small" sx={{ opacity: 0.8 }} />
                <Typography variant="body2">PCP: {getPCP(currentPatient)}</Typography>
              </Box>
            </Stack>
          </Grid>

          {/* Clinical Summary */}
          <Grid item xs={12} md={4}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2" sx={{ opacity: 0.8, mb: 1 }}>
                  Recent Activity
                </Typography>
                {lastEncounter && (
                  <Box>
                    <Typography variant="body2">
                      Last Visit: {format(new Date(lastEncounter.period?.start || lastEncounter.period?.end), 'MMM d, yyyy')}
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.8 }}>
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
                    sx={{ 
                      bgcolor: alpha(theme.palette.success.main, 0.2), 
                      color: 'white',
                      borderColor: 'white'
                    }}
                    variant="outlined"
                  />
                </Stack>
              </Box>

              {/* Action Buttons */}
              <Stack direction="row" spacing={1}>
                <Tooltip title="Print Patient Summary">
                  <IconButton 
                    size="small" 
                    sx={{ color: 'white' }}
                    onClick={onPrint}
                  >
                    <PrintIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="More Options">
                  <IconButton size="small" sx={{ color: 'white' }}>
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