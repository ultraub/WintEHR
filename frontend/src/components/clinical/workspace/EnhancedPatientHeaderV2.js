/**
 * Enhanced Patient Header V2 Component
 * Comprehensive patient information display with improved layout
 * Removes duplication from app bar and adds more clinical details
 */
import React, { useState, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Avatar,
  Badge,
  Chip,
  Stack,
  Button,
  Grid,
  Divider,
  Tooltip,
  Collapse,
  Alert,
  LinearProgress,
  useTheme,
  useMediaQuery,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  Person as PersonIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Home as HomeIcon,
  Warning as WarningIcon,
  Medication as MedicationIcon,
  Assignment as AssignmentIcon,
  LocalHospital as EmergencyIcon,
  Print as PrintIcon,
  Share as ShareIcon,
  Edit as EditIcon,
  History as HistoryIcon,
  MoreVert as MoreIcon,
  CalendarMonth as CalendarIcon,
  Badge as BadgeIcon,
  Security as SecurityIcon,
  Groups as TeamIcon,
  LocalPharmacy as PharmacyIcon,
  FiberManualRecord as ActiveIcon,
  ContactPhone as ContactIcon,
  MonitorHeart as VitalsIcon,
  Policy as InsuranceIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Favorite as PulseIcon,
  Thermostat as TempIcon,
  Speed as BPIcon,
  Straighten as HeightIcon,
  Scale as WeightIcon,
  VerifiedUser as CodeStatusIcon,
  LocalHospital as IsolationIcon,
  NearMe as LocationIcon
} from '@mui/icons-material';
import { format, differenceInYears, isValid, parseISO } from 'date-fns';
import { useFHIRResource } from '../../../contexts/FHIRResourceContext';
import { usePatientCDSAlerts } from '../../../contexts/CDSContext';
import { useNavigate } from 'react-router-dom';

const EnhancedPatientHeaderV2 = ({ 
  patientId, 
  onPrint, 
  onNavigateToTab,
  dataLoading = false 
}) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.down('lg'));
  
  const { currentPatient, getPatientResources } = useFHIRResource();
  const { alerts } = usePatientCDSAlerts(patientId);
  
  const [moreMenuAnchor, setMoreMenuAnchor] = useState(null);
  const [showDetailedInfo, setShowDetailedInfo] = useState(false);

  // Get patient resources
  const allergies = getPatientResources(patientId, 'AllergyIntolerance') || [];
  const conditions = getPatientResources(patientId, 'Condition') || [];
  const medications = getPatientResources(patientId, 'MedicationRequest') || [];
  const encounters = getPatientResources(patientId, 'Encounter') || [];
  const observations = getPatientResources(patientId, 'Observation') || [];
  
  // Calculate active counts
  const activeAllergies = allergies.filter(a => 
    a.clinicalStatus?.coding?.[0]?.code === 'active'
  );
  const activeConditions = conditions.filter(c => 
    c.clinicalStatus?.coding?.[0]?.code === 'active'
  );
  const activeMedications = medications.filter(m => 
    m.status === 'active'
  );
  
  // Critical alerts
  const criticalAlerts = alerts.filter(a => a.indicator === 'critical');
  const warningAlerts = alerts.filter(a => a.indicator === 'warning');
  
  // Get most recent vitals
  const getLatestVital = (type) => {
    const vitals = observations.filter(obs => {
      const coding = obs.code?.coding?.[0];
      switch(type) {
        case 'bp':
          return coding?.code === '85354-9' || coding?.display?.toLowerCase().includes('blood pressure');
        case 'pulse':
          return coding?.code === '8867-4' || coding?.display?.toLowerCase().includes('heart rate');
        case 'temp':
          return coding?.code === '8310-5' || coding?.display?.toLowerCase().includes('temperature');
        case 'resp':
          return coding?.code === '9279-1' || coding?.display?.toLowerCase().includes('respiratory');
        case 'weight':
          return coding?.code === '29463-7' || coding?.display?.toLowerCase().includes('weight');
        case 'height':
          return coding?.code === '8302-2' || coding?.display?.toLowerCase().includes('height');
        default:
          return false;
      }
    });
    
    const sorted = vitals.sort((a, b) => 
      new Date(b.effectiveDateTime || 0) - new Date(a.effectiveDateTime || 0)
    );
    
    return sorted[0];
  };

  // Format vital values
  const formatVital = (obs) => {
    if (!obs) return null;
    const value = obs.valueQuantity;
    if (obs.component) { // Blood pressure
      const systolic = obs.component.find(c => c.code?.coding?.[0]?.code === '8480-6');
      const diastolic = obs.component.find(c => c.code?.coding?.[0]?.code === '8462-4');
      if (systolic && diastolic) {
        return `${systolic.valueQuantity?.value}/${diastolic.valueQuantity?.value}`;
      }
    }
    return value ? `${value.value} ${value.unit}` : null;
  };

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
    return mrn?.value || 'No MRN';
  };

  const getAddress = (patient) => {
    const address = patient?.address?.[0];
    if (!address) return 'No address';
    const parts = [
      address.line?.join(' '),
      address.city,
      address.state,
      address.postalCode
    ].filter(Boolean);
    return parts.join(', ');
  };

  const getPhone = (patient) => {
    const phone = patient?.telecom?.find(t => t.system === 'phone');
    return phone?.value || 'No phone';
  };

  const getEmail = (patient) => {
    const email = patient?.telecom?.find(t => t.system === 'email');
    return email?.value || 'No email';
  };

  // Mock data for demo - would come from real resources
  const getInsurance = () => 'Blue Cross Blue Shield PPO';
  const getPCP = () => 'Dr. Sarah Johnson, MD';
  const getEmergencyContact = () => 'John Doe (Spouse) - (555) 123-4567';
  const getCodeStatus = () => 'Full Code';
  const getLocation = () => 'Room 204B - Med/Surg Unit';
  
  // Memoized patient name
  const patientName = useMemo(() => {
    if (!currentPatient) return 'Unknown Patient';
    const names = currentPatient.name?.[0];
    if (!names) return 'Unknown Patient';
    return `${names.given?.join(' ') || ''} ${names.family || ''}`.trim() || 'Unknown Patient';
  }, [currentPatient]);
  
  if (!currentPatient) return null;

  // Recent vitals
  const latestBP = getLatestVital('bp');
  const latestPulse = getLatestVital('pulse');
  const latestTemp = getLatestVital('temp');
  const latestResp = getLatestVital('resp');

  return (
    <Paper
      elevation={0}
      sx={{
        borderBottom: 1,
        borderColor: 'divider',
        backgroundColor: 'background.paper',
        position: 'relative'
      }}
    >
      {dataLoading && (
        <LinearProgress 
          sx={{ 
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 2
          }} 
        />
      )}
      
      {/* Main Patient Information Bar */}
      <Box sx={{ p: 2 }}>
        <Grid container spacing={2} alignItems="center">
          {/* Patient Identity Section */}
          <Grid item xs={12} md={5}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Avatar
                sx={{
                  width: 56,
                  height: 56,
                  bgcolor: 'primary.main',
                  fontSize: '1.5rem'
                }}
              >
                {patientName.charAt(0)}
              </Avatar>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                  <Typography 
                    variant="h6" 
                    sx={{ 
                      fontWeight: 600,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {patientName}
                  </Typography>
                  <Chip
                    icon={<ActiveIcon sx={{ fontSize: 12 }} />}
                    label="Active"
                    size="small"
                    color="success"
                    sx={{ height: 22 }}
                  />
                  {currentPatient.deceasedBoolean && (
                    <Chip
                      label="Deceased"
                      size="small"
                      color="error"
                      sx={{ height: 22 }}
                    />
                  )}
                </Stack>
                <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                  <Typography variant="body2" color="text.secondary">
                    {currentPatient.gender || 'Unknown'}, {calculateAge(currentPatient.birthDate)} years
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    DOB: {formatDate(currentPatient.birthDate)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    MRN: {formatMRN(currentPatient)}
                  </Typography>
                </Stack>
                {!isMobile && (
                  <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 0.5 }}>
                    <Chip
                      icon={<LocationIcon sx={{ fontSize: 16 }} />}
                      label={getLocation()}
                      size="small"
                      variant="outlined"
                      sx={{ height: 22, fontSize: '0.75rem' }}
                    />
                    <Chip
                      icon={<CodeStatusIcon sx={{ fontSize: 16 }} />}
                      label={getCodeStatus()}
                      size="small"
                      variant="outlined"
                      color="primary"
                      sx={{ height: 22, fontSize: '0.75rem' }}
                    />
                  </Stack>
                )}
              </Box>
            </Stack>
          </Grid>

          {/* Clinical Summary Section */}
          <Grid item xs={12} md={4}>
            <Stack direction="row" spacing={2} sx={{ overflowX: 'auto' }}>
              <Tooltip title="Active Conditions">
                <Chip
                  icon={<AssignmentIcon />}
                  label={`${activeConditions.length} Conditions`}
                  color={activeConditions.length > 0 ? 'warning' : 'default'}
                  onClick={() => onNavigateToTab?.('chart-review')}
                  sx={{ cursor: 'pointer' }}
                />
              </Tooltip>
              <Tooltip title="Active Medications">
                <Chip
                  icon={<MedicationIcon />}
                  label={`${activeMedications.length} Medications`}
                  color={activeMedications.length > 0 ? 'info' : 'default'}
                  onClick={() => onNavigateToTab?.('chart-review')}
                  sx={{ cursor: 'pointer' }}
                />
              </Tooltip>
              <Tooltip title="Active Allergies">
                <Chip
                  icon={<WarningIcon />}
                  label={`${activeAllergies.length} Allergies`}
                  color={activeAllergies.length > 0 ? 'error' : 'default'}
                  onClick={() => onNavigateToTab?.('chart-review')}
                  sx={{ cursor: 'pointer' }}
                />
              </Tooltip>
            </Stack>
            
            {/* Vitals Summary - Only on desktop */}
            {!isTablet && (
              <Stack direction="row" spacing={1.5} sx={{ mt: 1 }}>
                {latestBP && (
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <BPIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                    <Typography variant="caption" color="text.secondary">
                      BP: {formatVital(latestBP)}
                    </Typography>
                  </Stack>
                )}
                {latestPulse && (
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <PulseIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                    <Typography variant="caption" color="text.secondary">
                      HR: {formatVital(latestPulse)}
                    </Typography>
                  </Stack>
                )}
                {latestTemp && (
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <TempIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                    <Typography variant="caption" color="text.secondary">
                      Temp: {formatVital(latestTemp)}
                    </Typography>
                  </Stack>
                )}
              </Stack>
            )}
          </Grid>
          
          {/* Quick Actions */}
          <Grid item xs={12} md={3}>
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Tooltip title="Print Patient Summary">
                <IconButton size="small" onClick={onPrint}>
                  <PrintIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Share Chart">
                <IconButton size="small">
                  <ShareIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Edit Demographics">
                <IconButton size="small">
                  <EditIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title={showDetailedInfo ? "Hide Details" : "Show Details"}>
                <IconButton 
                  size="small"
                  onClick={() => setShowDetailedInfo(!showDetailedInfo)}
                >
                  {showDetailedInfo ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
              </Tooltip>
              <Tooltip title="More Actions">
                <IconButton 
                  size="small"
                  onClick={(e) => setMoreMenuAnchor(e.currentTarget)}
                >
                  <MoreIcon />
                </IconButton>
              </Tooltip>
            </Stack>
          </Grid>
        </Grid>
      </Box>
      
      {/* Expandable Detailed Information */}
      <Collapse in={showDetailedInfo}>
        <Divider />
        <Box sx={{ p: 2, bgcolor: alpha(theme.palette.primary.main, 0.02) }}>
          <Grid container spacing={3}>
            {/* Contact Information */}
            <Grid item xs={12} md={3}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontWeight: 600 }}>
                Contact Information
              </Typography>
              <Stack spacing={1}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <PhoneIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                  <Typography variant="body2">{getPhone(currentPatient)}</Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <EmailIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                  <Typography variant="body2">{getEmail(currentPatient)}</Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <HomeIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                  <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                    {getAddress(currentPatient)}
                  </Typography>
                </Stack>
              </Stack>
            </Grid>

            {/* Care Team & Insurance */}
            <Grid item xs={12} md={3}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontWeight: 600 }}>
                Care Team & Coverage
              </Typography>
              <Stack spacing={1}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <TeamIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                  <Typography variant="body2">{getPCP()}</Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <InsuranceIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                  <Typography variant="body2">{getInsurance()}</Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <PharmacyIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                  <Typography variant="body2">Main Street Pharmacy</Typography>
                </Stack>
              </Stack>
            </Grid>

            {/* Emergency Contact */}
            <Grid item xs={12} md={3}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontWeight: 600 }}>
                Emergency Contact
              </Typography>
              <Stack spacing={1}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <ContactIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                  <Typography variant="body2">{getEmergencyContact()}</Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <BadgeIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                  <Typography variant="body2">Medical POA: Same as above</Typography>
                </Stack>
              </Stack>
            </Grid>

            {/* Recent Vitals */}
            <Grid item xs={12} md={3}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontWeight: 600 }}>
                Recent Vitals
              </Typography>
              <Stack spacing={1}>
                {latestBP && (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <BPIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                    <Typography variant="body2">BP: {formatVital(latestBP)}</Typography>
                  </Stack>
                )}
                {latestPulse && (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <PulseIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                    <Typography variant="body2">HR: {formatVital(latestPulse)}</Typography>
                  </Stack>
                )}
                {latestTemp && (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <TempIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                    <Typography variant="body2">Temp: {formatVital(latestTemp)}</Typography>
                  </Stack>
                )}
                {latestResp && (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <VitalsIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                    <Typography variant="body2">RR: {formatVital(latestResp)}</Typography>
                  </Stack>
                )}
              </Stack>
            </Grid>
          </Grid>
        </Box>
      </Collapse>
      
      {/* Critical Alerts Bar */}
      {(criticalAlerts.length > 0 || warningAlerts.length > 0) && (
        <>
          <Divider />
          <Box sx={{ p: 1, bgcolor: alpha(theme.palette.error.main, 0.05) }}>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ overflowX: 'auto' }}>
              {criticalAlerts.map((alert) => (
                <Alert
                  key={alert.uuid}
                  severity="error"
                  variant="outlined"
                  sx={{ 
                    py: 0.5,
                    minWidth: 'fit-content',
                    flexShrink: 0
                  }}
                >
                  {alert.summary}
                </Alert>
              ))}
              {warningAlerts.slice(0, 2).map((alert) => (
                <Alert
                  key={alert.uuid}
                  severity="warning"
                  variant="outlined"
                  sx={{ 
                    py: 0.5,
                    minWidth: 'fit-content',
                    flexShrink: 0
                  }}
                >
                  {alert.summary}
                </Alert>
              ))}
            </Stack>
          </Box>
        </>
      )}
      
      {/* More Actions Menu */}
      <Menu
        anchorEl={moreMenuAnchor}
        open={Boolean(moreMenuAnchor)}
        onClose={() => setMoreMenuAnchor(null)}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem onClick={() => { setMoreMenuAnchor(null); onPrint?.(); }}>
          <ListItemIcon><PrintIcon /></ListItemIcon>
          <ListItemText>Print Summary</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => setMoreMenuAnchor(null)}>
          <ListItemIcon><ShareIcon /></ListItemIcon>
          <ListItemText>Share Chart</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => setMoreMenuAnchor(null)}>
          <ListItemIcon><HistoryIcon /></ListItemIcon>
          <ListItemText>View History</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => setMoreMenuAnchor(null)}>
          <ListItemIcon><EditIcon /></ListItemIcon>
          <ListItemText>Edit Demographics</ListItemText>
        </MenuItem>
      </Menu>
    </Paper>
  );
};

export default EnhancedPatientHeaderV2;