/**
 * Enhanced Patient Header Component
 * Modern, professional header design inspired by FHIR Explorer v4
 * with comprehensive patient information and clinical status indicators
 */
import React, { useState, useMemo } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Avatar,
  Badge,
  Chip,
  Stack,
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Tooltip,
  LinearProgress,
  Paper,
  Grid,
  useTheme,
  useMediaQuery,
  Collapse,
  Alert,
  AlertTitle
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
  Notifications as NotificationsIcon,
  Settings as SettingsIcon,
  ExitToApp as LogoutIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  FiberManualRecord as ActiveIcon,
  CheckCircle as VerifiedIcon,
  Info as InfoIcon,
  LocalPharmacy as PharmacyIcon,
  Science as LabIcon,
  AccountCircle as AccountIcon,
  LocalHospital as HospitalIcon
} from '@mui/icons-material';
import { format, differenceInYears, isValid, parseISO } from 'date-fns';
import { useFHIRResource } from '../../../contexts/FHIRResourceContext';
import { useAuth } from '../../../contexts/AuthContext';
import { usePatientCDSAlerts } from '../../../contexts/CDSContext';
import { useNavigate } from 'react-router-dom';

const EnhancedPatientHeader = ({ 
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
  const { user, logout } = useAuth();
  const { alerts } = usePatientCDSAlerts(patientId);
  
  const [userMenuAnchor, setUserMenuAnchor] = useState(null);
  const [moreMenuAnchor, setMoreMenuAnchor] = useState(null);
  const [showPatientDetails, setShowPatientDetails] = useState(false);

  // Get patient resources
  const allergies = getPatientResources(patientId, 'AllergyIntolerance') || [];
  const conditions = getPatientResources(patientId, 'Condition') || [];
  const medications = getPatientResources(patientId, 'MedicationRequest') || [];
  const encounters = getPatientResources(patientId, 'Encounter') || [];
  
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

  const getInsurance = (patient) => {
    // This would typically come from Coverage resources
    return 'Blue Cross Blue Shield';
  };

  const getPCP = (patient) => {
    // This would typically come from the patient's care team
    return 'Dr. Sarah Johnson';
  };
  
  // Memoized patient name
  const patientName = useMemo(() => {
    if (!currentPatient) return 'Unknown Patient';
    const names = currentPatient.name?.[0];
    if (!names) return 'Unknown Patient';
    return `${names.given?.join(' ') || ''} ${names.family || ''}`.trim() || 'Unknown Patient';
  }, [currentPatient]);
  
  if (!currentPatient) return null;

  return (
    <>
      {/* Top Application Bar */}
      <AppBar 
        position="fixed" 
        elevation={0}
        sx={{
          zIndex: theme.zIndex.drawer + 1,
          backgroundColor: 'background.paper',
          borderBottom: 1,
          borderColor: 'divider',
          backdropFilter: 'blur(8px)',
          backgroundColor: alpha(theme.palette.background.paper, 0.9)
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
        
        <Toolbar sx={{ minHeight: 56 }}>
          {/* Logo and Title */}
          <Box sx={{ display: 'flex', alignItems: 'center', mr: 3 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: 1,
                background: 'linear-gradient(45deg, #1976d2, #42a5f5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mr: 2
              }}
            >
              <HospitalIcon sx={{ color: 'white', fontSize: 24 }} />
            </Box>
            {!isMobile && (
              <Typography 
                variant="h6" 
                sx={{ 
                  fontWeight: 600,
                  color: 'text.primary'
                }}
              >
                Clinical Workspace
              </Typography>
            )}
          </Box>
          
          {/* Spacer */}
          <Box sx={{ flexGrow: 1 }} />
          
          {/* User Actions */}
          <Stack direction="row" spacing={1} alignItems="center">
            {/* Notifications */}
            <Tooltip title="Notifications">
              <IconButton size="small">
                <Badge badgeContent={3} color="error">
                  <NotificationsIcon />
                </Badge>
              </IconButton>
            </Tooltip>
            
            {/* Settings */}
            {!isMobile && (
              <Tooltip title="Settings">
                <IconButton size="small">
                  <SettingsIcon />
                </IconButton>
              </Tooltip>
            )}
            
            {/* User Menu */}
            <Button
              onClick={(e) => setUserMenuAnchor(e.currentTarget)}
              startIcon={
                <Avatar 
                  sx={{ 
                    width: 32, 
                    height: 32,
                    bgcolor: 'primary.main'
                  }}
                >
                  <PersonIcon fontSize="small" />
                </Avatar>
              }
              endIcon={<ExpandMoreIcon />}
              sx={{
                ml: 2,
                textTransform: 'none',
                color: 'text.primary'
              }}
            >
              {!isMobile && (
                <Box sx={{ textAlign: 'left' }}>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {user?.name || 'Clinical User'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {user?.role || 'Healthcare Provider'}
                  </Typography>
                </Box>
              )}
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>
      
      {/* Patient Information Banner */}
      <Paper
        elevation={0}
        sx={{
          position: 'fixed',
          top: 56,
          left: 0,
          right: 0,
          zIndex: theme.zIndex.appBar - 1,
          borderBottom: 1,
          borderColor: 'divider',
          backgroundColor: 'background.paper'
        }}
      >
        {/* Main Patient Bar */}
        <Box sx={{ p: 2 }}>
          <Grid container spacing={2} alignItems="center">
            {/* Patient Identity */}
            <Grid item xs={12} md={4}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Avatar
                  sx={{
                    width: 48,
                    height: 48,
                    bgcolor: 'primary.main',
                    fontSize: '1.25rem'
                  }}
                >
                  {patientName.charAt(0)}
                </Avatar>
                <Box sx={{ minWidth: 0 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
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
                      sx={{ height: 24 }}
                    />
                  </Stack>
                  <Stack direction="row" spacing={2} alignItems="center">
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
                </Box>
              </Stack>
            </Grid>

            {/* Clinical Summary */}
            <Grid item xs={12} md={5}>
              <Stack direction="row" spacing={3} sx={{ overflowX: 'auto' }}>
                <Tooltip title="Active Conditions">
                  <Chip
                    icon={<AssignmentIcon />}
                    label={`${activeConditions.length} Conditions`}
                    color={activeConditions.length > 0 ? 'warning' : 'default'}
                    onClick={() => onNavigateToTab?.('chart')}
                    sx={{ cursor: 'pointer' }}
                  />
                </Tooltip>
                <Tooltip title="Active Medications">
                  <Chip
                    icon={<MedicationIcon />}
                    label={`${activeMedications.length} Medications`}
                    color={activeMedications.length > 0 ? 'info' : 'default'}
                    onClick={() => onNavigateToTab?.('chart')}
                    sx={{ cursor: 'pointer' }}
                  />
                </Tooltip>
                <Tooltip title="Active Allergies">
                  <Chip
                    icon={<WarningIcon />}
                    label={`${activeAllergies.length} Allergies`}
                    color={activeAllergies.length > 0 ? 'error' : 'default'}
                    onClick={() => onNavigateToTab?.('chart')}
                    sx={{ cursor: 'pointer' }}
                  />
                </Tooltip>
              </Stack>
            </Grid>
            
            {/* Quick Actions */}
            <Grid item xs={12} md={3}>
              <Stack direction="row" spacing={1} justifyContent="flex-end">
                {!isMobile && (
                  <>
                    <Tooltip title="Print">
                      <IconButton size="small" onClick={onPrint}>
                        <PrintIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Share">
                      <IconButton size="small">
                        <ShareIcon />
                      </IconButton>
                    </Tooltip>
                  </>
                )}
                <Tooltip title="View Details">
                  <IconButton 
                    size="small"
                    onClick={() => setShowPatientDetails(!showPatientDetails)}
                  >
                    {showPatientDetails ? <ExpandLessIcon /> : <ExpandMoreIcon />}
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
        
        {/* Expandable Details Section */}
        <Collapse in={showPatientDetails}>
          <Divider />
          <Box sx={{ p: 2, bgcolor: 'background.default' }}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Contact Information
                </Typography>
                <Stack spacing={1}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <PhoneIcon fontSize="small" color="action" />
                    <Typography variant="body2">{getPhone(currentPatient)}</Typography>
                  </Stack>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <EmailIcon fontSize="small" color="action" />
                    <Typography variant="body2">{getEmail(currentPatient)}</Typography>
                  </Stack>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <HomeIcon fontSize="small" color="action" />
                    <Typography variant="body2">{getAddress(currentPatient)}</Typography>
                  </Stack>
                </Stack>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Care Team
                </Typography>
                <Stack spacing={1}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <TeamIcon fontSize="small" color="action" />
                    <Typography variant="body2">Dr. Sarah Johnson (PCP)</Typography>
                  </Stack>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <PharmacyIcon fontSize="small" color="action" />
                    <Typography variant="body2">Main Street Pharmacy</Typography>
                  </Stack>
                </Stack>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Insurance
                </Typography>
                <Stack spacing={1}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <SecurityIcon fontSize="small" color="action" />
                    <Typography variant="body2">Blue Cross Blue Shield</Typography>
                  </Stack>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <BadgeIcon fontSize="small" color="action" />
                    <Typography variant="body2">Member ID: BCBS123456</Typography>
                  </Stack>
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
      </Paper>

      
      {/* User Menu */}
      <Menu
        anchorEl={userMenuAnchor}
        open={Boolean(userMenuAnchor)}
        onClose={() => setUserMenuAnchor(null)}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem onClick={() => setUserMenuAnchor(null)}>
          <ListItemIcon><PersonIcon /></ListItemIcon>
          <ListItemText>My Profile</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => setUserMenuAnchor(null)}>
          <ListItemIcon><SettingsIcon /></ListItemIcon>
          <ListItemText>Preferences</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => { setUserMenuAnchor(null); logout(); }}>
          <ListItemIcon><LogoutIcon /></ListItemIcon>
          <ListItemText>Sign Out</ListItemText>
        </MenuItem>
      </Menu>
      
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
    </>
  );
};

export default EnhancedPatientHeader;