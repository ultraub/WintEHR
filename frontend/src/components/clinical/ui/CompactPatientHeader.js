/**
 * Compact Patient Header Component
 * Information-dense patient header with progressive disclosure
 * Part of the Clinical UI Improvements Initiative
 */
import React, { useState, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  Stack,
  IconButton,
  Collapse,
  Avatar,
  Badge,
  Tooltip,
  useTheme,
  alpha,
  Grid,
  Divider,
  LinearProgress,
  useMediaQuery
} from '@mui/material';
import {
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Warning as AlertIcon,
  Medication as MedIcon,
  Assignment as ProblemIcon,
  TrendingUp as TrendUpIcon,
  TrendingDown as TrendDownIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Badge as IdIcon,
  CalendarMonth as CalendarIcon,
  FiberManualRecord as StatusIcon
} from '@mui/icons-material';
import { format, differenceInYears, parseISO, formatDistanceToNow } from 'date-fns';
import TrendSparkline from './TrendSparkline';

// Severity indicator component
const SeverityIndicator = ({ severity, size = 'small' }) => {
  const colors = {
    critical: '#d32f2f',
    high: '#f57c00',
    moderate: '#fbc02d',
    low: '#388e3c',
    normal: '#616161'
  };

  return (
    <StatusIcon 
      sx={{ 
        fontSize: size === 'small' ? 8 : 12,
        color: colors[severity] || colors.normal
      }} 
    />
  );
};

// Mini info card component
const InfoCard = ({ icon, label, value, trend, severity, onClick }) => {
  const theme = useTheme();
  
  return (
    <Paper
      elevation={0}
      onClick={onClick}
      sx={{
        p: 1.5,
        cursor: onClick ? 'pointer' : 'default',
        backgroundColor: theme.palette.background.paper,
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        transition: 'all 0.2s',
        height: '100%',
        '&:hover': onClick ? {
          backgroundColor: alpha(theme.palette.primary.main, 0.04),
          transform: 'translateY(-1px)',
          boxShadow: 1
        } : {}
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center">
        <Box sx={{ color: theme.palette.text.secondary }}>
          {icon}
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="caption" color="text.secondary" noWrap>
            {label}
          </Typography>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Typography variant="h6" fontWeight={600} noWrap>
              {value}
            </Typography>
            {trend && (
              trend > 0 ? 
                <TrendUpIcon sx={{ fontSize: 14, color: 'success.main' }} /> :
                <TrendDownIcon sx={{ fontSize: 14, color: 'error.main' }} />
            )}
            {severity && <SeverityIndicator severity={severity} />}
          </Stack>
        </Box>
      </Stack>
    </Paper>
  );
};

const CompactPatientHeader = ({ 
  patient,
  alerts = [],
  vitals = {},
  conditions = [],
  medications = [],
  allergies = [],
  lastEncounter,
  onNavigateToTab
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [expanded, setExpanded] = useState(false);

  // Calculate age
  const age = useMemo(() => {
    if (!patient?.birthDate) return 'Unknown';
    try {
      const birthDate = parseISO(patient.birthDate);
      return differenceInYears(new Date(), birthDate);
    } catch (error) {
      console.error('Invalid birth date:', patient.birthDate);
      return 'Unknown';
    }
  }, [patient?.birthDate]);

  // Get MRN
  const mrn = useMemo(() => {
    const mrnIdentifier = patient?.identifier?.find(id => 
      id.type?.coding?.[0]?.code === 'MR'
    );
    return mrnIdentifier?.value || 'No MRN';
  }, [patient?.identifier]);

  // Get phone
  const phone = patient?.telecom?.find(t => t.system === 'phone')?.value;
  const email = patient?.telecom?.find(t => t.system === 'email')?.value;

  // Calculate summary stats
  const activeConditions = conditions.filter(c => 
    c.clinicalStatus?.coding?.[0]?.code === 'active'
  ).length;
  
  const activeMeds = medications.filter(m => m.status === 'active').length;
  
  const criticalAlerts = alerts.filter(a => a.indicator === 'critical').length;
  const warningAlerts = alerts.filter(a => a.indicator === 'warning').length;

  // Determine overall patient acuity
  const patientAcuity = useMemo(() => {
    if (criticalAlerts > 0) return 'critical';
    if (warningAlerts > 2 || activeConditions > 5) return 'high';
    if (warningAlerts > 0 || activeConditions > 2) return 'moderate';
    return 'low';
  }, [criticalAlerts, warningAlerts, activeConditions]);

  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: 0,
        borderBottom: 2,
        borderColor: 'divider',
        background: `linear-gradient(to right, ${alpha(theme.palette.background.paper, 0.9)}, ${theme.palette.background.paper})`
      }}
    >
      {/* Acuity indicator bar */}
      <Box
        sx={{
          height: 3,
          background: patientAcuity === 'critical' ? theme.palette.error.main :
                      patientAcuity === 'high' ? theme.palette.warning.main :
                      patientAcuity === 'moderate' ? theme.palette.info.main :
                      theme.palette.grey[300]
        }}
      />

      {/* Main header content */}
      <Box sx={{ p: 1.5 }}>
        <Grid container spacing={1.5} alignItems="center">
          {/* Patient Identity */}
          <Grid item xs={12} md={4}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Badge
                overlap="circular"
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                badgeContent={
                  <SeverityIndicator severity={patientAcuity} size="large" />
                }
              >
                <Avatar
                  sx={{ 
                    width: isMobile ? 40 : 48, 
                    height: isMobile ? 40 : 48,
                    bgcolor: theme.palette.primary.main
                  }}
                >
                  {patient?.name?.[0]?.given?.[0]?.[0]}{patient?.name?.[0]?.family?.[0]}
                </Avatar>
              </Badge>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="h6" noWrap>
                  {patient?.name?.[0]?.given?.join(' ')} {patient?.name?.[0]?.family}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip 
                    size="small" 
                    label={`${age}y ${patient?.gender?.[0]?.toUpperCase()}`}
                    variant="outlined"
                  />
                  <Typography variant="caption" color="text.secondary" noWrap>
                    MRN: {mrn}
                  </Typography>
                </Stack>
              </Box>
            </Stack>
          </Grid>

          {/* Clinical Summary Cards */}
          <Grid item xs={12} md={7}>
            <Grid container spacing={1}>
              <Grid item xs={6} sm={3}>
                <InfoCard
                  icon={<AlertIcon fontSize="small" />}
                  label="Alerts"
                  value={`${criticalAlerts}/${warningAlerts}`}
                  severity={criticalAlerts > 0 ? 'critical' : warningAlerts > 0 ? 'high' : 'normal'}
                  onClick={() => onNavigateToTab?.('summary')}
                />
              </Grid>
              <Grid item xs={6} sm={3}>
                <InfoCard
                  icon={<ProblemIcon fontSize="small" />}
                  label="Conditions"
                  value={activeConditions}
                  trend={activeConditions > 3 ? 1 : 0}
                  onClick={() => onNavigateToTab?.('chart')}
                />
              </Grid>
              <Grid item xs={6} sm={3}>
                <InfoCard
                  icon={<MedIcon fontSize="small" />}
                  label="Medications"
                  value={activeMeds}
                  onClick={() => onNavigateToTab?.('chart')}
                />
              </Grid>
              <Grid item xs={6} sm={3}>
                <InfoCard
                  icon={<CalendarIcon fontSize="small" />}
                  label="Last Visit"
                  value={(() => {
                    if (!lastEncounter?.period?.start) return 'Never';
                    try {
                      const date = parseISO(lastEncounter.period.start);
                      return formatDistanceToNow(date, { addSuffix: true });
                    } catch (error) {
                      console.error('Invalid encounter date:', lastEncounter.period.start);
                      return 'Unknown';
                    }
                  })()}
                  onClick={() => onNavigateToTab?.('encounters')}
                />
              </Grid>
            </Grid>
          </Grid>

          {/* Expand/Collapse Button */}
          <Grid item xs={12} md={1}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Tooltip title={expanded ? "Show less" : "Show more details"}>
                <IconButton
                  size="small"
                  onClick={() => setExpanded(!expanded)}
                  sx={{
                    transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.3s'
                  }}
                >
                  <ExpandIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Grid>
        </Grid>

        {/* Expanded Details */}
        <Collapse in={expanded} timeout="auto">
          <Divider sx={{ my: 2 }} />
          <Grid container spacing={2}>
            {/* Contact Information */}
            <Grid item xs={12} md={3}>
              <Typography variant="subtitle2" gutterBottom>
                Contact Information
              </Typography>
              <Stack spacing={1}>
                {phone && (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <PhoneIcon fontSize="small" color="action" />
                    <Typography variant="body2">{phone}</Typography>
                  </Stack>
                )}
                {email && (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <EmailIcon fontSize="small" color="action" />
                    <Typography variant="body2" noWrap>{email}</Typography>
                  </Stack>
                )}
              </Stack>
            </Grid>

            {/* Vital Signs Trends */}
            <Grid item xs={12} md={5}>
              <Typography variant="subtitle2" gutterBottom>
                Recent Vitals
              </Typography>
              <Stack direction="row" spacing={2}>
                {vitals.bloodPressure && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      BP
                    </Typography>
                    <TrendSparkline 
                      data={vitals.bloodPressure} 
                      width={80} 
                      height={30}
                      showLastValue
                    />
                  </Box>
                )}
                {vitals.heartRate && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      HR
                    </Typography>
                    <TrendSparkline 
                      data={vitals.heartRate} 
                      width={80} 
                      height={30}
                      showLastValue
                      color="secondary"
                    />
                  </Box>
                )}
              </Stack>
            </Grid>

            {/* Active Allergies */}
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" gutterBottom>
                Allergies ({allergies.length})
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {allergies.slice(0, 3).map((allergy, index) => (
                  <Chip
                    key={index}
                    size="small"
                    label={allergy.code?.text || 'Unknown'}
                    color={allergy.criticality === 'high' ? 'error' : 'default'}
                    variant={allergy.verificationStatus?.coding?.[0]?.code === 'confirmed' ? 'filled' : 'outlined'}
                  />
                ))}
                {allergies.length > 3 && (
                  <Chip
                    size="small"
                    label={`+${allergies.length - 3} more`}
                    variant="outlined"
                  />
                )}
              </Stack>
            </Grid>
          </Grid>
        </Collapse>
      </Box>

      {/* Loading indicator for data refresh */}
      {false && <LinearProgress sx={{ height: 2 }} />}
    </Paper>
  );
};

export default CompactPatientHeader;