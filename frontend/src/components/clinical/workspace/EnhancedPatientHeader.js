/**
 * Enhanced Patient Header Component
 * Comprehensive patient demographics and clinical summary for the workspace
 */
import React, { useState } from 'react';
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
  alpha,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText
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
  Groups as TeamIcon,
  Edit as EditIcon,
  History as HistoryIcon,
  Share as ShareIcon,
  Description as DocumentIcon,
  Security as SecurityIcon
} from '@mui/icons-material';
import { format, differenceInYears, isValid, parseISO } from 'date-fns';
import { useFHIRResource } from '../../../contexts/FHIRResourceContext';
import { useNavigate } from 'react-router-dom';

const EnhancedPatientHeader = ({ patientId, onPrint, onNavigateToTab }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { currentPatient, getPatientResources } = useFHIRResource();
  const [moreMenuAnchor, setMoreMenuAnchor] = useState(null);

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
      elevation={0}
      sx={{
        backgroundColor: theme.palette.background.paper,
        borderRadius: 0,
        borderBottom: `1px solid ${theme.palette.divider}`,
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <Box sx={{ p: 1.5 }}>
        <Grid container spacing={1.5} alignItems="center">
          {/* Patient Photo and Basic Info */}
          <Grid item xs={12} md={5}>
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
              <Avatar
                sx={{
                  width: 48,
                  height: 48,
                  bgcolor: theme.palette.primary.main,
                  color: 'white',
                  fontSize: '1rem'
                }}
              >
                <PersonIcon sx={{ fontSize: 28 }} />
              </Avatar>
              <Box sx={{ flex: 1 }}>
                <Stack direction="row" spacing={2} alignItems="baseline">
                  <Typography variant="subtitle1" fontWeight="bold" sx={{ lineHeight: 1.2 }}>
                    {currentPatient.name?.[0]?.given?.join(' ')} {currentPatient.name?.[0]?.family}
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    {activeAllergies.length > 0 && (
                      <Chip
                        icon={<WarningIcon />}
                        label={`${activeAllergies.length}`}
                        color="error"
                        size="small"
                        onClick={() => onNavigateToTab ? onNavigateToTab('chart') : null}
                        sx={{ cursor: onNavigateToTab ? 'pointer' : 'default', height: 20 }}
                      />
                    )}
                    {activeConditions.length > 0 && (
                      <Chip
                        icon={<AssignmentIcon />}
                        label={`${activeConditions.length}`}
                        color="warning"
                        size="small"
                        onClick={() => onNavigateToTab ? onNavigateToTab('chart') : null}
                        sx={{ cursor: onNavigateToTab ? 'pointer' : 'default', height: 20 }}
                      />
                    )}
                    {activeMedications.length > 0 && (
                      <Chip
                        icon={<MedicationIcon />}
                        label={`${activeMedications.length}`}
                        size="small"
                        onClick={() => onNavigateToTab ? onNavigateToTab('chart') : null}
                        sx={{ cursor: onNavigateToTab ? 'pointer' : 'default', height: 20 }}
                      />
                    )}
                  </Stack>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="caption" color="text.secondary">
                    {formatMRN(currentPatient)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">•</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {currentPatient.gender || 'Unknown'}, {calculateAge(currentPatient.birthDate)}y
                  </Typography>
                  <Typography variant="caption" color="text.secondary">•</Typography>
                  <Typography variant="caption" color="text.secondary">
                    DOB: {formatDate(currentPatient.birthDate)}
                  </Typography>
                </Stack>
              </Box>
            </Box>
          </Grid>

          {/* Contact Information */}
          <Grid item xs={12} md={4}>
            <Stack spacing={0.5}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <HomeIcon sx={{ fontSize: 16 }} color="action" />
                  <Typography variant="caption">{getAddress(currentPatient)}</Typography>
                </Stack>
              </Stack>
              <Stack direction="row" spacing={2} alignItems="center">
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <PhoneIcon sx={{ fontSize: 16 }} color="action" />
                  <Typography variant="caption">{getPhone(currentPatient)}</Typography>
                </Stack>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <InsuranceIcon sx={{ fontSize: 16 }} color="action" />
                  <Typography variant="caption">{getInsurance(currentPatient)}</Typography>
                </Stack>
              </Stack>
            </Stack>
          </Grid>

          {/* Clinical Summary */}
          <Grid item xs={12} md={3}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Stack direction="row" spacing={2} alignItems="center">
                {lastEncounter && (
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <CalendarIcon sx={{ fontSize: 16 }} color="action" />
                    <Typography variant="caption" color="text.secondary">
                      Last: {formatDate(lastEncounter.period?.start || lastEncounter.period?.end, 'MMM d')}
                    </Typography>
                  </Stack>
                )}
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <TeamIcon sx={{ fontSize: 16 }} color="action" />
                  <Typography variant="caption" color="text.secondary">
                    {getPCP(currentPatient)}
                  </Typography>
                </Stack>
                <Chip
                  icon={<EmergencyIcon />}
                  label="Full Code"
                  size="small"
                  color="success"
                  sx={{ height: 20 }}
                />
              </Stack>

              {/* Action Buttons */}
              <Stack direction="row" spacing={0.5}>
                <Tooltip title="Print Patient Summary">
                  <IconButton 
                    size="small" 
                    onClick={onPrint}
                    sx={{ padding: 0.5 }}
                  >
                    <PrintIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="More Options">
                  <IconButton 
                    size="small"
                    sx={{ padding: 0.5 }}
                    onClick={(e) => setMoreMenuAnchor(e.currentTarget)}
                  >
                    <MoreIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Box>
          </Grid>
        </Grid>
      </Box>

      {/* More Options Menu */}
      <Menu
        anchorEl={moreMenuAnchor}
        open={Boolean(moreMenuAnchor)}
        onClose={() => setMoreMenuAnchor(null)}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <MenuItem onClick={() => {
          setMoreMenuAnchor(null);
          navigate(`/patients/${patientId}/edit`);
        }}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit Demographics</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => {
          setMoreMenuAnchor(null);
          onNavigateToTab('timeline');
        }}>
          <ListItemIcon>
            <HistoryIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>View History</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => {
          setMoreMenuAnchor(null);
          // Generate shareable link
          const shareUrl = `${window.location.origin}/patients/${patientId}/view?readonly=true`;
          if (navigator.share) {
            navigator.share({
              title: `Patient: ${currentPatient.name?.[0]?.given?.join(' ')} ${currentPatient.name?.[0]?.family}`,
              text: 'Patient medical record',
              url: shareUrl
            }).catch(err => {});
          } else {
            // Fallback: copy to clipboard
            navigator.clipboard.writeText(shareUrl);
          }
        }}>
          <ListItemIcon>
            <ShareIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Share Patient Info</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => {
          setMoreMenuAnchor(null);
          onNavigateToTab('documentation');
        }}>
          <ListItemIcon>
            <DocumentIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>View Documents</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => {
          setMoreMenuAnchor(null);
          // Navigate to privacy settings page
          navigate(`/patients/${patientId}/privacy`);
        }}>
          <ListItemIcon>
            <SecurityIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Privacy Settings</ListItemText>
        </MenuItem>
      </Menu>
    </Paper>
  );
};

export default EnhancedPatientHeader;