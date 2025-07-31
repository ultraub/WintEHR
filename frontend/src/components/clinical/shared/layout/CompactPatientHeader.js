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
import TrendSparkline from '../display/TrendSparkline';

// Severity indicator component
const SeverityIndicator = ({ severity, size = 'small' }) => {
  const theme = useTheme();
  const colors = {
    critical: theme.palette.error.main,
    high: theme.palette.warning.main,
    moderate: theme.palette.warning.light,
    low: theme.palette.success.main,
    normal: theme.palette.text.secondary
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
        borderBottom: '1px solid',
        borderColor: 'divider',
        backgroundColor: theme.palette.background.paper,
        height: 80,  // Fixed 80px height
        display: 'flex',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Acuity indicator bar - vertical instead of horizontal */}
      <Box
        sx={{
          width: 4,
          height: '100%',
          background: patientAcuity === 'critical' ? theme.palette.error.main :
                      patientAcuity === 'high' ? theme.palette.warning.main :
                      patientAcuity === 'moderate' ? theme.palette.info.main :
                      theme.palette.grey[300]
        }}
      />

      {/* Main header content - ultra-compact single line */}
      <Box sx={{ px: 2, width: '100%', height: '100%', display: 'flex', alignItems: 'center' }}>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ width: '100%', height: '100%' }}>
          {/* Patient Identity - Ultra compact */}
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
            <Avatar
              sx={{ 
                width: 32, 
                height: 32,
                bgcolor: theme.palette.primary.main,
                fontSize: '0.875rem'
              }}
            >
              {patient?.name?.[0]?.given?.[0]?.[0]}{patient?.name?.[0]?.family?.[0]}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography 
                variant="body2" 
                fontWeight={600} 
                noWrap 
                sx={{ lineHeight: 1.2 }}
              >
                {patient?.name?.[0]?.given?.join(' ')} {patient?.name?.[0]?.family}
              </Typography>
              <Typography 
                variant="caption" 
                color="text.secondary" 
                noWrap
                sx={{ lineHeight: 1.2, fontSize: '0.7rem' }}
              >
                {age}y {patient?.gender?.[0]?.toUpperCase()} • MRN: {mrn}
              </Typography>
            </Box>
          </Stack>

          <Divider orientation="vertical" flexItem sx={{ mx: 1.5, height: 32 }} />

          {/* Critical Alert - Priority display */}
          {criticalAlerts > 0 && (
            <Chip
              icon={<AlertIcon sx={{ fontSize: 16 }} />}
              label={`${criticalAlerts} Critical`}
              color="error"
              size="small"
              sx={{ 
                height: 24,
                fontWeight: 600,
                borderRadius: '4px',
                animation: 'pulse 2s infinite',
                '& .MuiChip-label': { px: 1 }
              }}
            />
          )}
          
          {/* Key Metrics - Ultra compact */}
          <Stack 
            direction="row" 
            spacing={2} 
            alignItems="center" 
            sx={{ flex: 1, minWidth: 0, overflow: 'hidden' }}
          >
            {/* Conditions - Compact chip style */}
            <Chip
              size="small"
              icon={<ProblemIcon sx={{ fontSize: 14 }} />}
              label={`${activeConditions}`}
              sx={{ 
                height: 24,
                borderRadius: '4px',
                bgcolor: activeConditions > 0 ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
                '& .MuiChip-label': { px: 0.5, fontWeight: 600 }
              }}
            />

            {/* Medications - Compact chip style */}
            <Chip
              size="small"
              icon={<MedIcon sx={{ fontSize: 14 }} />}
              label={`${activeMeds}`}
              sx={{ 
                height: 24,
                borderRadius: '4px',
                bgcolor: activeMeds > 0 ? alpha(theme.palette.info.main, 0.08) : 'transparent',
                '& .MuiChip-label': { px: 0.5, fontWeight: 600 }
              }}
            />

            {/* Allergies - Only show if present */}
            {allergies.length > 0 && (
              <Chip
                label={`${allergies.length} Allerg${allergies.length === 1 ? 'y' : 'ies'}`}
                size="small"
                color={allergies.some(a => a.criticality === 'high') ? 'warning' : 'default'}
                variant="outlined"
                sx={{ 
                  height: 24,
                  borderRadius: '4px',
                  '& .MuiChip-label': { px: 1 }
                }}
              />
            )}
          </Stack>

          {/* Last Visit - Right aligned */}
          <Stack 
            direction="row" 
            spacing={0.5} 
            alignItems="center" 
            sx={{ ml: 'auto', flexShrink: 0 }}
          >
            <CalendarIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
            <Typography 
              variant="caption" 
              color="text.secondary" 
              noWrap
              sx={{ fontSize: '0.75rem' }}
            >
              {(() => {
                if (!lastEncounter?.period?.start) return 'No visits';
                try {
                  const date = parseISO(lastEncounter.period.start);
                  const distance = formatDistanceToNow(date);
                  // Shorten the output
                  return distance.replace('about ', '').replace('less than ', '<');
                } catch {
                  return 'Unknown';
                }
              })()}
            </Typography>
          </Stack>

          {/* Quick Actions - Optional expand button */}
          <IconButton
            size="small"
            onClick={() => onNavigateToTab && onNavigateToTab('summary')}
            sx={{ 
              ml: 1,
              padding: 0.5,
              color: 'text.secondary',
              '&:hover': { color: 'primary.main' }
            }}
          >
            <ExpandIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Stack>
      </Box>
    </Paper>
  );
};

export default CompactPatientHeader;