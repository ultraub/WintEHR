/**
 * Encounter Card Component
 * Streamlined, view-focused encounter card with enhanced styling and summary
 */
import React, { memo, useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Stack,
  Chip,
  Avatar,
  Tooltip,
  useTheme,
  alpha,
  LinearProgress,
  Skeleton,
  Grid,
  Paper
} from '@mui/material';
import {
  LocalHospital as HospitalIcon,
  MedicalServices as ClinicIcon,
  LocalHospital as EmergencyIcon,
  Home as HomeIcon,
  Person as PersonIcon,
  LocationOn as LocationIcon,
  AccessTime as TimeIcon,
  Science as LabIcon,
  Medication as MedicationIcon,
  Note as NoteIcon,
  MonitorHeart as VitalSignsIcon,
  Assignment as OrderIcon,
  MedicalInformation as DiagnosisIcon,
  Healing as ProcedureIcon,
  Circle as StatusIcon,
  TrendingUp as TrendingUpIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import { format, parseISO, formatDistanceToNow, differenceInHours, differenceInDays, isToday, isYesterday } from 'date-fns';
import { motion } from 'framer-motion';
import { getEncounterClass, getEncounterStatus, getCodeableConceptDisplay } from '../../../../core/fhir/utils/fhirFieldUtils';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';

// Get encounter icon based on class
const getEncounterIcon = (encounter) => {
  const classCode = getEncounterClass(encounter);
  
  switch (classCode) {
    case 'IMP':
    case 'ACUTE':
      return <HospitalIcon />;
    case 'EMER':
      return <EmergencyIcon />;
    case 'HH':
      return <HomeIcon />;
    case 'AMB':
    default:
      return <ClinicIcon />;
  }
};

// Get encounter severity for styling
const getEncounterSeverity = (encounter) => {
  const classCode = getEncounterClass(encounter);
  const status = getEncounterStatus(encounter);
  
  // Check for priority
  if (encounter.priority?.coding?.[0]?.code === 'urgent' || 
      encounter.priority?.coding?.[0]?.code === 'stat') {
    return 'critical';
  }
  
  if (classCode === 'EMER') return 'critical';
  if (classCode === 'IMP' || classCode === 'ACUTE') return 'high';
  if (status === 'in-progress') return 'active';
  return 'normal';
};

// Get encounter type label
const getEncounterTypeLabel = (encounter) => {
  const typeDisplay = encounter.type?.[0] ? getCodeableConceptDisplay(encounter.type[0]) : null;
  if (typeDisplay && typeDisplay !== 'Unknown') {
    return typeDisplay;
  }
  
  const classCode = getEncounterClass(encounter);
  switch (classCode) {
    case 'AMB': return 'Ambulatory';
    case 'IMP': return 'Inpatient';
    case 'EMER': return 'Emergency';
    case 'HH': return 'Home Health';
    case 'OBSENC': return 'Observation';
    case 'VR': return 'Virtual';
    default: return 'Clinical Visit';
  }
};

// Format date for display
const formatEncounterDate = (date) => {
  if (!date) return '';
  
  const parsedDate = parseISO(date);
  
  if (isToday(parsedDate)) {
    return `Today at ${format(parsedDate, 'h:mm a')}`;
  } else if (isYesterday(parsedDate)) {
    return `Yesterday at ${format(parsedDate, 'h:mm a')}`;
  } else {
    const days = differenceInDays(new Date(), parsedDate);
    if (days < 7) {
      return format(parsedDate, 'EEEE \'at\' h:mm a');
    } else if (days < 30) {
      return format(parsedDate, 'MMM d \'at\' h:mm a');
    } else {
      return format(parsedDate, 'MMM d, yyyy');
    }
  }
};

// Resource summary component
const ResourceSummaryChip = ({ icon, count, label, color = 'default' }) => {
  if (count === 0) return null;
  
  return (
    <Tooltip title={label}>
      <Chip
        icon={icon}
        label={count}
        size="small"
        sx={{
          height: 24,
          '& .MuiChip-label': {
            px: 1,
            fontWeight: 600
          },
          bgcolor: theme => alpha(
            color === 'default' ? theme.palette.grey[500] : theme.palette[color].main,
            0.08
          ),
          color: theme => color === 'default' ? theme.palette.text.secondary : theme.palette[color].main,
          borderColor: theme => alpha(
            color === 'default' ? theme.palette.grey[500] : theme.palette[color].main,
            0.2
          ),
          border: '1px solid'
        }}
      />
    </Tooltip>
  );
};

const EncounterCard = memo(({ 
  encounter, 
  onViewDetails,
  patientId,
  elevation = 0
}) => {
  const theme = useTheme();
  const [resourceSummary, setResourceSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const { getPatientResources } = useFHIRResource();
  
  // Extract encounter data
  const period = encounter.actualPeriod || encounter.period || {};
  const startDate = period.start ? parseISO(period.start) : null;
  const endDate = period.end ? parseISO(period.end) : null;
  const status = getEncounterStatus(encounter);
  const severity = getEncounterSeverity(encounter);
  
  // Get primary provider
  const primaryProvider = encounter.participant?.find(p => 
    p.type?.some(t => t.coding?.some(c => c.code === 'PPRF' || c.code === 'ATND'))
  )?.individual?.display || encounter.participant?.[0]?.individual?.display;
  
  // Get location
  const location = encounter.location?.[0]?.location?.display;
  
  // Get primary diagnosis
  const primaryDiagnosis = encounter.diagnosis?.find(d => d.rank === 1 || d.use?.coding?.[0]?.code === 'billing') ||
                          encounter.diagnosis?.[0];
  const diagnosisText = primaryDiagnosis?.condition?.display;
  
  // Get reason for visit
  const reasonForVisit = encounter.reasonCode?.[0] ? 
    getCodeableConceptDisplay(encounter.reasonCode[0]) : null;
  
  // Load resource summary
  useEffect(() => {
    const loadResourceSummary = async () => {
      if (!patientId || !encounter.id) {
        setLoading(false);
        return;
      }
      
      setLoading(true);
      try {
        // Load all resources for the patient
        const [observations, medications, procedures, notes, diagnosticReports, orders] = await Promise.all([
          getPatientResources(patientId, 'Observation') || [],
          getPatientResources(patientId, 'MedicationRequest') || [],
          getPatientResources(patientId, 'Procedure') || [],
          getPatientResources(patientId, 'DocumentReference') || [],
          getPatientResources(patientId, 'DiagnosticReport') || [],
          getPatientResources(patientId, 'ServiceRequest') || []
        ]);
        
        // Filter by encounter
        const isEncounterMatch = (reference) => {
          if (!reference) return false;
          return reference.includes(encounter.id);
        };
        
        // Count resources by type
        const encounterObservations = observations.filter(obs => isEncounterMatch(obs.encounter?.reference));
        const vitals = encounterObservations.filter(obs => 
          obs.category?.some(cat => cat.coding?.some(c => c.code === 'vital-signs'))
        );
        const labs = encounterObservations.filter(obs => 
          obs.category?.some(cat => cat.coding?.some(c => c.code === 'laboratory'))
        );
        
        // Check for critical values
        const hasCriticalLabs = labs.some(lab => 
          lab.interpretation?.[0]?.coding?.[0]?.code === 'H' ||
          lab.interpretation?.[0]?.coding?.[0]?.code === 'L' ||
          lab.interpretation?.[0]?.coding?.[0]?.code === 'HH' ||
          lab.interpretation?.[0]?.coding?.[0]?.code === 'LL'
        );
        
        const summary = {
          vitals: vitals.length,
          labs: labs.length,
          medications: medications.filter(med => isEncounterMatch(med.encounter?.reference)).length,
          procedures: procedures.filter(proc => isEncounterMatch(proc.encounter?.reference)).length,
          notes: notes.filter(doc => {
            // Check for explicit encounter reference
            if (doc.context?.encounter?.some(enc => enc.reference?.includes(encounter.id))) {
              return true;
            }
            
            // Fallback: Check if document was created during encounter period
            if (period.start && doc.date) {
              const docDate = parseISO(doc.date);
              const encounterStart = startDate;
              const encounterEnd = endDate;
              
              if (encounterStart) {
                // If encounter has ended, check if doc is within the period
                if (encounterEnd) {
                  return docDate >= encounterStart && docDate <= encounterEnd;
                }
                // If encounter is ongoing, check if doc is after start and within 24 hours
                else {
                  const twentyFourHoursAfterStart = new Date(encounterStart);
                  twentyFourHoursAfterStart.setHours(twentyFourHoursAfterStart.getHours() + 24);
                  return docDate >= encounterStart && docDate <= twentyFourHoursAfterStart;
                }
              }
            }
            
            return false;
          }).length,
          orders: orders.filter(req => isEncounterMatch(req.encounter?.reference)).length,
          totalResources: 0,
          hasCriticalLabs
        };
        
        summary.totalResources = Object.values(summary).reduce((sum, val) => 
          typeof val === 'number' ? sum + val : sum, 0
        );
        
        setResourceSummary(summary);
      } catch (error) {
        console.error('Error loading resource summary:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadResourceSummary();
  }, [encounter.id, patientId, getPatientResources]);
  
  // Severity theme configuration
  const severityConfig = {
    critical: {
      bgcolor: alpha(theme.palette.error.main, 0.04),
      borderColor: theme.palette.error.main,
      accentColor: theme.palette.error.main,
      iconBgColor: theme.palette.error.main,
      iconColor: theme.palette.error.contrastText
    },
    high: {
      bgcolor: alpha(theme.palette.warning.main, 0.04),
      borderColor: theme.palette.warning.main,
      accentColor: theme.palette.warning.main,
      iconBgColor: theme.palette.warning.main,
      iconColor: theme.palette.warning.contrastText
    },
    active: {
      bgcolor: alpha(theme.palette.info.main, 0.04),
      borderColor: theme.palette.info.main,
      accentColor: theme.palette.info.main,
      iconBgColor: theme.palette.info.main,
      iconColor: theme.palette.info.contrastText
    },
    normal: {
      bgcolor: theme.palette.background.paper,
      borderColor: theme.palette.divider,
      accentColor: theme.palette.primary.main,
      iconBgColor: alpha(theme.palette.primary.main, 0.1),
      iconColor: theme.palette.primary.main
    }
  };
  
  const config = severityConfig[severity];
  
  // Status configuration
  const statusConfig = {
    'in-progress': { color: 'info', label: 'Active' },
    'finished': { color: 'success', label: 'Completed' },
    'cancelled': { color: 'error', label: 'Cancelled' },
    'planned': { color: 'warning', label: 'Scheduled' },
    'arrived': { color: 'info', label: 'Arrived' },
    'triaged': { color: 'warning', label: 'Triaged' }
  };
  
  const statusInfo = statusConfig[status] || { color: 'default', label: status };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={{ y: -2 }}
    >
      <Card 
        elevation={elevation}
        onClick={() => onViewDetails(encounter)}
        sx={{ 
          mb: 2,
          cursor: 'pointer',
          position: 'relative',
          overflow: 'visible',
          bgcolor: config.bgcolor,
          border: '1px solid',
          borderColor: config.borderColor,
          borderLeft: '4px solid',
          borderLeftColor: config.borderColor,
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            boxShadow: theme.shadows[4],
            borderColor: alpha(config.borderColor, 0.8),
            transform: 'translateY(-2px)',
            '& .view-details-hint': {
              opacity: 1
            }
          }
        }}
      >
        {loading && (
          <LinearProgress 
            sx={{ 
              position: 'absolute', 
              top: 0, 
              left: 0, 
              right: 0,
              height: 2,
              bgcolor: 'transparent'
            }}
            color={severity === 'critical' ? 'error' : severity === 'high' ? 'warning' : 'primary'}
          />
        )}
        
        <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
          <Grid container spacing={2}>
            {/* Left section - Main info */}
            <Grid item xs={12} md={8}>
              <Stack spacing={2}>
                {/* Header with icon and type */}
                <Stack direction="row" spacing={2} alignItems="flex-start">
                  <Avatar
                    sx={{
                      bgcolor: config.iconBgColor,
                      color: config.iconColor,
                      width: 44,
                      height: 44
                    }}
                  >
                    {getEncounterIcon(encounter)}
                  </Avatar>
                  
                  <Box sx={{ flex: 1 }}>
                    {/* Type and status */}
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                      <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1.1rem' }}>
                        {getEncounterTypeLabel(encounter)}
                      </Typography>
                      <Chip
                        icon={<StatusIcon sx={{ fontSize: '0.75rem !important' }} />}
                        label={statusInfo.label}
                        size="small"
                        color={statusInfo.color}
                        sx={{
                          height: 22,
                          '& .MuiChip-label': {
                            px: 1,
                            fontSize: '0.75rem',
                            fontWeight: 500
                          }
                        }}
                      />
                      {resourceSummary?.hasCriticalLabs && (
                        <Tooltip title="Critical lab results">
                          <WarningIcon color="error" sx={{ fontSize: 20 }} />
                        </Tooltip>
                      )}
                    </Stack>
                    
                    {/* Date and time */}
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {formatEncounterDate(period.start)}
                      {endDate && status === 'finished' && (
                        <Typography component="span" variant="body2" color="text.secondary">
                          {' • '}{differenceInHours(endDate, startDate) < 24 
                            ? `${differenceInHours(endDate, startDate)} hours`
                            : `${differenceInDays(endDate, startDate)} days`}
                        </Typography>
                      )}
                    </Typography>
                    
                    {/* Quick info chips */}
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {location && (
                        <Chip
                          icon={<LocationIcon />}
                          label={location}
                          size="small"
                          variant="outlined"
                          sx={{
                            height: 26,
                            borderColor: theme.palette.divider,
                            '& .MuiChip-icon': { fontSize: 16 }
                          }}
                        />
                      )}
                      {primaryProvider && (
                        <Chip
                          icon={<PersonIcon />}
                          label={primaryProvider}
                          size="small"
                          variant="outlined"
                          sx={{
                            height: 26,
                            borderColor: theme.palette.divider,
                            '& .MuiChip-icon': { fontSize: 16 }
                          }}
                        />
                      )}
                    </Stack>
                  </Box>
                </Stack>
                
                {/* Primary reason/diagnosis */}
                {(diagnosisText || reasonForVisit) && (
                  <Box sx={{ 
                    pl: 7.5,
                    borderLeft: `2px solid ${alpha(config.accentColor, 0.2)}`,
                    ml: 2.75
                  }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                      {diagnosisText ? 'Primary Diagnosis' : 'Reason for Visit'}
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {diagnosisText || reasonForVisit}
                    </Typography>
                  </Box>
                )}
              </Stack>
            </Grid>
            
            {/* Right section - Resource summary */}
            <Grid item xs={12} md={4}>
              <Stack spacing={2} alignItems={{ xs: 'flex-start', md: 'flex-end' }}>
                {/* Resource summary */}
                {loading ? (
                  <Stack spacing={1} alignItems={{ xs: 'flex-start', md: 'flex-end' }}>
                    <Skeleton variant="text" width={120} height={20} />
                    <Skeleton variant="rectangular" width={200} height={32} />
                  </Stack>
                ) : resourceSummary && resourceSummary.totalResources > 0 ? (
                  <Stack spacing={1} alignItems={{ xs: 'flex-start', md: 'flex-end' }}>
                    <Typography variant="caption" color="text.secondary" fontWeight="medium">
                      Clinical Data ({resourceSummary.totalResources} items)
                    </Typography>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" justifyContent={{ xs: 'flex-start', md: 'flex-end' }}>
                      <ResourceSummaryChip
                        icon={<VitalSignsIcon sx={{ fontSize: 16 }} />}
                        count={resourceSummary.vitals}
                        label="Vital Signs"
                        color="primary"
                      />
                      <ResourceSummaryChip
                        icon={<LabIcon sx={{ fontSize: 16 }} />}
                        count={resourceSummary.labs}
                        label="Lab Results"
                        color={resourceSummary.hasCriticalLabs ? 'error' : 'info'}
                      />
                      <ResourceSummaryChip
                        icon={<MedicationIcon sx={{ fontSize: 16 }} />}
                        count={resourceSummary.medications}
                        label="Medications"
                        color="secondary"
                      />
                      <ResourceSummaryChip
                        icon={<ProcedureIcon sx={{ fontSize: 16 }} />}
                        count={resourceSummary.procedures}
                        label="Procedures"
                        color="warning"
                      />
                      <ResourceSummaryChip
                        icon={<NoteIcon sx={{ fontSize: 16 }} />}
                        count={resourceSummary.notes}
                        label="Clinical Notes"
                        color="success"
                      />
                      {resourceSummary.orders > 0 && (
                        <ResourceSummaryChip
                          icon={<OrderIcon sx={{ fontSize: 16 }} />}
                          count={resourceSummary.orders}
                          label="Orders"
                        />
                      )}
                    </Stack>
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No clinical data recorded
                  </Typography>
                )}
                
                {/* View details hint */}
                <Typography
                  className="view-details-hint"
                  variant="caption"
                  color="primary"
                  sx={{
                    opacity: 0,
                    transition: 'opacity 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5
                  }}
                >
                  Click to view full details
                  <TrendingUpIcon sx={{ fontSize: 14 }} />
                </Typography>
              </Stack>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </motion.div>
  );
});

EncounterCard.displayName = 'EncounterCard';

export default EncounterCard;