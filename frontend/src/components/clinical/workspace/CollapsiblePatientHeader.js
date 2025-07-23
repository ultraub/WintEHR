/**
 * Collapsible Patient Header Component
 * Dynamic header that compresses on scroll to maximize screen real estate
 * Shows full details when at top, minimal info when scrolled
 */
import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Fade,
  Slide
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
  Print as PrintIcon,
  Share as ShareIcon,
  Edit as EditIcon,
  MoreVert as MoreIcon,
  FiberManualRecord as ActiveIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Favorite as PulseIcon,
  Thermostat as TempIcon,
  Speed as BPIcon,
  MonitorHeart as VitalsIcon,
  VerifiedUser as CodeStatusIcon,
  NearMe as LocationIcon
} from '@mui/icons-material';
import { format, differenceInYears, isValid, parseISO } from 'date-fns';
import { useFHIRResource } from '../../../contexts/FHIRResourceContext';
import { usePatientCDSAlerts } from '../../../contexts/CDSContext';
import { useNavigate } from 'react-router-dom';

const CollapsiblePatientHeader = ({ 
  patientId, 
  onPrint, 
  onNavigateToTab,
  dataLoading = false,
  scrollContainerRef // Reference to the scrollable container
}) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.down('lg'));
  
  const { currentPatient, getPatientResources } = useFHIRResource();
  const { alerts } = usePatientCDSAlerts(patientId);
  
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const headerRef = useRef(null);

  // Get patient resources
  const allergies = getPatientResources(patientId, 'AllergyIntolerance') || [];
  const conditions = getPatientResources(patientId, 'Condition') || [];
  const medications = getPatientResources(patientId, 'MedicationRequest') || [];
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

  // Handle scroll events
  useEffect(() => {
    const handleScroll = () => {
      const container = scrollContainerRef?.current || window;
      const scrollTop = container === window 
        ? window.pageYOffset || document.documentElement.scrollTop
        : container.scrollTop;
      
      setScrollY(scrollTop);
      
      // Collapse header after scrolling 100px
      const shouldCollapse = scrollTop > 100;
      setIsCollapsed(shouldCollapse);
      
      // Auto-collapse details when scrolling
      if (shouldCollapse && isDetailsExpanded) {
        setIsDetailsExpanded(false);
      }
    };

    const container = scrollContainerRef?.current || window;
    container.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [scrollContainerRef, isDetailsExpanded]);

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

  // Render collapsed header (minimal info)
  const renderCollapsedHeader = () => (
    <Box sx={{ 
      p: 1.5, 
      display: 'flex', 
      alignItems: 'center', 
      gap: 2,
      minHeight: 56
    }}>
      <Avatar
        sx={{
          width: 32,
          height: 32,
          bgcolor: 'primary.main',
          fontSize: '1rem'
        }}
      >
        {patientName.charAt(0)}
      </Avatar>
      
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography 
            variant="subtitle2" 
            sx={{ 
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {patientName}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {currentPatient.gender}, {calculateAge(currentPatient.birthDate)}y
          </Typography>
          <Typography variant="body2" color="text.secondary">
            MRN: {formatMRN(currentPatient)}
          </Typography>
        </Stack>
      </Box>

      <Stack direction="row" spacing={1} alignItems="center">
        {/* Critical info chips */}
        {activeAllergies.length > 0 && (
          <Chip
            icon={<WarningIcon />}
            label={activeAllergies.length}
            size="small"
            color="error"
            sx={{ height: 24 }}
          />
        )}
        {activeMedications.length > 0 && (
          <Chip
            icon={<MedicationIcon />}
            label={activeMedications.length}
            size="small"
            color="info"
            sx={{ height: 24 }}
          />
        )}
        
        {/* Vitals mini display */}
        {!isMobile && latestBP && (
          <Typography variant="caption" color="text.secondary">
            BP: {formatVital(latestBP)}
          </Typography>
        )}
        
        {/* Expand button */}
        <Tooltip title="Expand header">
          <IconButton 
            size="small"
            onClick={() => {
              window.scrollTo({ top: 0, behavior: 'smooth' });
              setIsDetailsExpanded(true);
            }}
          >
            <ExpandMoreIcon />
          </IconButton>
        </Tooltip>
        
        {/* Quick actions */}
        <IconButton size="small" onClick={onPrint}>
          <PrintIcon fontSize="small" />
        </IconButton>
      </Stack>
    </Box>
  );

  // Render expanded header (full info)
  const renderExpandedHeader = () => (
    <>
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
              <Tooltip title={isDetailsExpanded ? "Hide Details" : "Show Details"}>
                <IconButton 
                  size="small"
                  onClick={() => setIsDetailsExpanded(!isDetailsExpanded)}
                >
                  {isDetailsExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
              </Tooltip>
            </Stack>
          </Grid>
        </Grid>
      </Box>
      
      {/* Expandable Detailed Information */}
      <Collapse in={isDetailsExpanded}>
        <Divider />
        <Box sx={{ p: 2, bgcolor: alpha(theme.palette.primary.main, 0.02) }}>
          <Grid container spacing={3}>
            {/* Contact Information */}
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontWeight: 600 }}>
                Contact Information
              </Typography>
              <Stack spacing={1}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <PhoneIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                  <Typography variant="body2">{getPhone(currentPatient)}</Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <HomeIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                  <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                    {getAddress(currentPatient)}
                  </Typography>
                </Stack>
              </Stack>
            </Grid>

            {/* Recent Vitals */}
            <Grid item xs={12} md={4}>
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
              </Stack>
            </Grid>

            {/* Alerts Summary */}
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontWeight: 600 }}>
                Clinical Alerts
              </Typography>
              <Stack spacing={1}>
                {criticalAlerts.length > 0 && (
                  <Alert severity="error" sx={{ py: 0.5 }}>
                    {criticalAlerts.length} critical alert{criticalAlerts.length > 1 ? 's' : ''}
                  </Alert>
                )}
                {warningAlerts.length > 0 && (
                  <Alert severity="warning" sx={{ py: 0.5 }}>
                    {warningAlerts.length} warning{warningAlerts.length > 1 ? 's' : ''}
                  </Alert>
                )}
              </Stack>
            </Grid>
          </Grid>
        </Box>
      </Collapse>
    </>
  );

  return (
    <Paper
      ref={headerRef}
      elevation={0}
      sx={{
        borderBottom: 1,
        borderColor: 'divider',
        backgroundColor: 'background.paper',
        position: 'sticky',
        top: 0,
        zIndex: theme.zIndex.appBar - 1,
        transition: theme.transitions.create(['height', 'box-shadow'], {
          duration: theme.transitions.duration.shorter,
        }),
        boxShadow: isCollapsed ? 2 : 0
      }}
    >
      {dataLoading && (
        <LinearProgress 
          sx={{ 
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            zIndex: 1
          }} 
        />
      )}
      
      {/* Use Fade transition between collapsed and expanded states */}
      <Box sx={{ position: 'relative' }}>
        <Fade in={isCollapsed} timeout={200}>
          <Box sx={{ display: isCollapsed ? 'block' : 'none' }}>
            {renderCollapsedHeader()}
          </Box>
        </Fade>
        
        <Fade in={!isCollapsed} timeout={200}>
          <Box sx={{ display: !isCollapsed ? 'block' : 'none' }}>
            {renderExpandedHeader()}
          </Box>
        </Fade>
      </Box>
    </Paper>
  );
};

export default CollapsiblePatientHeader;