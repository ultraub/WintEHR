/**
 * Enhanced Encounter Summary Dialog Component
 * Comprehensive encounter information with improved FHIR data utilization
 * @since 2025-01-27
 */
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Grid,
  Paper,
  Stack,
  Chip,
  IconButton,
  Tabs,
  Tab,
  Card,
  CardContent,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Avatar,
  AvatarGroup,
  LinearProgress,
  Badge,
  Tooltip,
  useTheme,
  alpha,
  Fade,
  Slide,
  useMediaQuery,
  Alert
} from '@mui/material';
import {
  Close as CloseIcon,
  LocalHospital as HospitalIcon,
  LocationOn as LocationIcon,
  Person as PersonIcon,
  Schedule as ScheduleIcon,
  Science as LabIcon,
  MedicalServices as ProcedureIcon,
  Medication as MedicationIcon,
  Assignment as DiagnosisIcon,
  Description as DocumentIcon,
  Print as PrintIcon,
  GetApp as ExportIcon,
  Timeline as TimelineIcon,
  Dashboard as DashboardIcon,
  Notes as NotesIcon,
  Add as AddIcon,
  ArrowForward as ArrowForwardIcon,
  Group as GroupIcon,
  Hotel as BedIcon,
  Restaurant as DietIcon,
  AccessTime as DurationIcon,
  TrendingUp as TrendIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Link as LinkIcon
} from '@mui/icons-material';
import { format, parseISO, differenceInMinutes, differenceInHours, differenceInDays } from 'date-fns';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import { useClinicalWorkflow, CLINICAL_EVENTS } from '../../../../contexts/ClinicalWorkflowContext';
import { printDocument } from '../../../../core/export/printUtils';
import { exportClinicalData } from '../../../../core/export/exportUtils';
import { 
  getEncounterClass, 
  getCodeableConceptDisplay, 
  getEncounterStatus,
  getResourceReference 
} from '../../../../core/fhir/utils/fhirFieldUtils';
import { getMedicationDosageDisplay, getMedicationRoute } from '../../../../core/fhir/utils/medicationDisplayUtils';
import { documentReferenceConverter } from '../../../../core/fhir/converters/DocumentReferenceConverter';

// Tab panel component
function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`encounter-tabpanel-${index}`}
      aria-labelledby={`encounter-tab-${index}`}
      {...other}
    >
      {value === index && <Box>{children}</Box>}
    </div>
  );
}

// Get status icon
const getStatusIcon = (status) => {
  switch (status) {
    case 'finished':
      return <CheckCircleIcon color="success" />;
    case 'in-progress':
      return <ScheduleIcon color="warning" />;
    case 'cancelled':
      return <ErrorIcon color="error" />;
    default:
      return <InfoIcon color="info" />;
  }
};

// Get participant type display
const getParticipantTypeDisplay = (participant) => {
  const typeCode = participant.type?.[0]?.coding?.[0]?.code;
  switch (typeCode) {
    case 'ATND':
      return { label: 'Attending', color: 'primary', icon: <PersonIcon /> };
    case 'PPRF':
      return { label: 'Primary Performer', color: 'secondary', icon: <PersonIcon /> };
    case 'SPRF':
      return { label: 'Secondary Performer', color: 'default', icon: <PersonIcon /> };
    case 'CON':
      return { label: 'Consultant', color: 'info', icon: <PersonIcon /> };
    default:
      return { label: 'Participant', color: 'default', icon: <PersonIcon /> };
  }
};

// Format duration
const formatDuration = (startDate, endDate) => {
  if (!startDate || !endDate) return null;
  
  const minutes = differenceInMinutes(endDate, startDate);
  const hours = differenceInHours(endDate, startDate);
  const days = differenceInDays(endDate, startDate);
  
  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''}, ${hours % 24} hour${hours % 24 !== 1 ? 's' : ''}`;
  } else if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''}, ${minutes % 60} min`;
  } else {
    return `${minutes} min`;
  }
};

const EncounterSummaryDialogEnhanced = ({ open, onClose, encounter, patientId }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { getPatientResources, currentPatient, searchResources } = useFHIRResource();
  const { publish } = useClinicalWorkflow();
  const [activeTab, setActiveTab] = useState(0);
  const [documentReferencesLoaded, setDocumentReferencesLoaded] = useState(false);
  
  // Load DocumentReferences if not already loaded
  useEffect(() => {
    const loadDocumentReferences = async () => {
      if (open && patientId && !documentReferencesLoaded) {
        try {
          await searchResources('DocumentReference', { 
            patient: patientId,
            _count: 100 
          });
          setDocumentReferencesLoaded(true);
        } catch (error) {
          console.error('Failed to load DocumentReferences:', error);
        }
      }
    };
    
    loadDocumentReferences();
  }, [open, patientId, searchResources, documentReferencesLoaded]);

  // Get all related resources for this encounter
  const relatedResources = useMemo(() => {
    if (!encounter || !patientId) return {};

    const observations = getPatientResources(patientId, 'Observation') || [];
    const procedures = getPatientResources(patientId, 'Procedure') || [];
    const medications = getPatientResources(patientId, 'MedicationRequest') || [];
    const conditions = getPatientResources(patientId, 'Condition') || [];
    const documentReferences = getPatientResources(patientId, 'DocumentReference') || [];
    const diagnosticReports = getPatientResources(patientId, 'DiagnosticReport') || [];
    const immunizations = getPatientResources(patientId, 'Immunization') || [];

    // Filter resources related to this encounter
    const encounterRef = `Encounter/${encounter.id}`;
    const encounterUrnRef = `urn:uuid:${encounter.id}`;
    
    const isEncounterMatch = (ref) => {
      return ref === encounterRef || ref === encounterUrnRef;
    };
    
    return {
      observations: observations.filter(obs => 
        isEncounterMatch(obs.encounter?.reference)
      ),
      procedures: procedures.filter(proc => 
        isEncounterMatch(proc.encounter?.reference)
      ),
      medications: medications.filter(med => 
        isEncounterMatch(med.encounter?.reference)
      ),
      conditions: conditions.filter(cond => {
        if (Array.isArray(cond.encounter)) {
          return cond.encounter.some(enc => isEncounterMatch(enc.reference));
        }
        if (cond.encounter?.reference) {
          return isEncounterMatch(cond.encounter.reference);
        }
        return false;
      }),
      documents: documentReferences.filter(doc => {
        // First check for explicit encounter reference
        if (Array.isArray(doc.context?.encounter)) {
          const hasEncounterRef = doc.context.encounter.some(enc => isEncounterMatch(enc.reference));
          if (hasEncounterRef) return true;
        }
        if (doc.context?.encounter?.reference) {
          if (isEncounterMatch(doc.context.encounter.reference)) return true;
        }
        
        // Fallback: Check if document was created during encounter period
        const period = encounter.actualPeriod || encounter.period;
        if (period && doc.date) {
          const docDate = parseISO(doc.date);
          const encounterStart = period.start ? parseISO(period.start) : null;
          const encounterEnd = period.end ? parseISO(period.end) : null;
          
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
      }),
      diagnosticReports: diagnosticReports.filter(report =>
        isEncounterMatch(report.encounter?.reference)
      ),
      immunizations: immunizations.filter(imm =>
        isEncounterMatch(imm.encounter?.reference)
      )
    };
  }, [encounter, patientId, getPatientResources]);

  // Calculate encounter metrics
  const encounterMetrics = useMemo(() => {
    if (!encounter) return {};
    
    const period = encounter.actualPeriod || encounter.period || {};
    const startDate = period.start ? parseISO(period.start) : null;
    const endDate = period.end ? parseISO(period.end) : null;
    
    return {
      duration: startDate && endDate ? formatDuration(startDate, endDate) : 
                encounter.status === 'in-progress' ? 'Ongoing' : null,
      resourceCount: Object.values(relatedResources).reduce((total, resources) => 
        total + resources.length, 0),
      criticalFindings: relatedResources.observations?.filter(obs =>
        obs.interpretation?.[0]?.coding?.[0]?.code === 'H' ||
        obs.interpretation?.[0]?.coding?.[0]?.code === 'L' ||
        obs.interpretation?.[0]?.coding?.[0]?.code === 'HH' ||
        obs.interpretation?.[0]?.coding?.[0]?.code === 'LL'
      ).length || 0,
      activeMedications: relatedResources.medications?.filter(med =>
        med.status === 'active'
      ).length || 0
    };
  }, [encounter, relatedResources]);

  // Get encounter type label
  const getEncounterTypeLabel = (enc) => {
    const typeDisplay = enc.type?.[0] ? getCodeableConceptDisplay(enc.type[0]) : null;
    if (typeDisplay && typeDisplay !== 'Unknown') {
      return typeDisplay;
    }
    
    const classCode = getEncounterClass(enc);
    switch (classCode) {
      case 'AMB': return 'Ambulatory Visit';
      case 'IMP': return 'Inpatient Encounter';
      case 'EMER': return 'Emergency Visit';
      case 'HH': return 'Home Health Visit';
      default: return 'Clinical Encounter';
    }
  };

  // Timeline events
  const timelineEvents = useMemo(() => {
    if (!encounter) return [];
    
    const events = [];
    const period = encounter.actualPeriod || encounter.period || {};
    
    // Start event
    if (period.start) {
      events.push({
        time: parseISO(period.start),
        type: 'start',
        title: 'Encounter Started',
        description: `${getEncounterTypeLabel(encounter)} began`,
        icon: <HospitalIcon />,
        color: 'primary'
      });
    }
    
    // Add resource events
    relatedResources.observations?.forEach(obs => {
      if (obs.effectiveDateTime) {
        events.push({
          time: parseISO(obs.effectiveDateTime),
          type: 'observation',
          title: 'Lab Result',
          description: obs.code?.text || obs.code?.coding?.[0]?.display,
          icon: <LabIcon />,
          color: 'info',
          resource: obs
        });
      }
    });
    
    relatedResources.procedures?.forEach(proc => {
      if (proc.performedDateTime) {
        events.push({
          time: parseISO(proc.performedDateTime),
          type: 'procedure',
          title: 'Procedure',
          description: proc.code?.text || proc.code?.coding?.[0]?.display,
          icon: <ProcedureIcon />,
          color: 'secondary',
          resource: proc
        });
      }
    });
    
    relatedResources.medications?.forEach(med => {
      if (med.authoredOn) {
        events.push({
          time: parseISO(med.authoredOn),
          type: 'medication',
          title: 'Medication Ordered',
          description: med.medication?.concept?.text || 
                      med.medication?.concept?.coding?.[0]?.display,
          icon: <MedicationIcon />,
          color: 'success',
          resource: med
        });
      }
    });
    
    // End event
    if (period.end) {
      events.push({
        time: parseISO(period.end),
        type: 'end',
        title: 'Encounter Ended',
        description: `${getEncounterTypeLabel(encounter)} completed`,
        icon: <CheckCircleIcon />,
        color: 'success'
      });
    }
    
    // Sort by time
    return events.sort((a, b) => a.time - b.time);
  }, [encounter, relatedResources]);

  if (!encounter) return null;

  const period = encounter.actualPeriod || encounter.period || {};
  const startDate = period.start ? parseISO(period.start) : null;
  const endDate = period.end ? parseISO(period.end) : null;

  // Navigate to related tab
  const handleNavigateToTab = (tabName) => {
    publish(CLINICAL_EVENTS.TAB_CHANGE, { tab: tabName });
    onClose();
  };

  // Handle quick actions
  const handleAddNote = () => {
    publish(CLINICAL_EVENTS.ADD_NOTE, { encounterId: encounter.id });
    onClose();
  };

  const handleAddOrder = () => {
    publish(CLINICAL_EVENTS.ADD_ORDER, { encounterId: encounter.id });
    onClose();
  };

  // Handle print
  const handlePrint = () => {
    const printContent = {
      title: 'Encounter Summary',
      subtitle: getEncounterTypeLabel(encounter),
      sections: []
    };

    // Add comprehensive encounter details
    printDocument({
      title: 'Encounter Summary',
      patient: {
        name: currentPatient ? 
          `${currentPatient.name?.[0]?.given?.join(' ') || ''} ${currentPatient.name?.[0]?.family || ''}`.trim() : 
          'Unknown Patient',
        mrn: currentPatient?.identifier?.find(id => id.type?.coding?.[0]?.code === 'MR')?.value || patientId,
        birthDate: currentPatient?.birthDate,
        gender: currentPatient?.gender
      },
      content: 'Comprehensive encounter summary content here...'
    });
  };

  // Handle export
  const handleExport = (format) => {
    exportClinicalData({
      patient: currentPatient,
      data: {
        encounter,
        relatedResources,
        metrics: encounterMetrics,
        timeline: timelineEvents
      },
      format,
      title: `Encounter_Summary_${encounter.id}`,
      includeRelatedResources: true
    });
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="xl"
      fullWidth
      fullScreen={isMobile}
      TransitionComponent={isMobile ? Slide : Fade}
      TransitionProps={isMobile ? { direction: 'up' } : {}}
      PaperProps={{
        sx: { 
          height: isMobile ? '100%' : '90vh',
          borderRadius: isMobile ? 0 : 2,
          overflow: 'hidden'
        }
      }}
    >
      {/* Enhanced Header */}
      <DialogTitle sx={{ 
        p: 0,
        background: theme.palette.mode === 'dark'
          ? `linear-gradient(135deg, ${alpha(theme.palette.primary.dark, 0.9)} 0%, ${theme.palette.background.paper} 100%)`
          : `linear-gradient(135deg, ${alpha(theme.palette.primary.light, 0.15)} 0%, ${theme.palette.background.paper} 100%)`,
        borderBottom: `1px solid ${theme.palette.divider}`
      }}>
        <Box sx={{ p: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Stack spacing={1} flex={1}>
              {/* Title Row */}
              <Stack direction="row" spacing={2} alignItems="center">
                {getStatusIcon(encounter.status)}
                <Typography variant="h5" fontWeight="bold">
                  {getEncounterTypeLabel(encounter)}
                </Typography>
                <Chip 
                  label={encounter.status?.toUpperCase()} 
                  size="small" 
                  color={getStatusColor(encounter.status)}
                  sx={{ fontWeight: 'bold' }}
                />
                {encounter.priority && (
                  <Chip
                    label={encounter.priority.text || encounter.priority.coding?.[0]?.display}
                    size="small"
                    color={encounter.priority.coding?.[0]?.code === 'UR' ? 'error' : 'default'}
                    icon={encounter.priority.coding?.[0]?.code === 'UR' ? <WarningIcon /> : null}
                  />
                )}
              </Stack>
              
              {/* Info Row */}
              <Stack direction="row" spacing={3} flexWrap="wrap">
                {startDate && (
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <ScheduleIcon fontSize="small" color="action" />
                    <Typography variant="body2" color="text.secondary">
                      {format(startDate, 'MMM d, yyyy h:mm a')}
                    </Typography>
                  </Stack>
                )}
                {encounterMetrics.duration && (
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <DurationIcon fontSize="small" color="action" />
                    <Typography variant="body2" color="text.secondary">
                      {encounterMetrics.duration}
                    </Typography>
                  </Stack>
                )}
                {encounter.location?.[0] && (
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <LocationIcon fontSize="small" color="action" />
                    <Typography variant="body2" color="text.secondary">
                      {encounter.location[0].location?.display || 'Unknown Location'}
                    </Typography>
                  </Stack>
                )}
              </Stack>
              
              {/* Metrics Row */}
              <Stack direction="row" spacing={2}>
                <Chip
                  icon={<DiagnosisIcon />}
                  label={`${relatedResources.conditions?.length || 0} Diagnoses`}
                  size="small"
                  variant="outlined"
                />
                <Chip
                  icon={<MedicationIcon />}
                  label={`${encounterMetrics.activeMedications} Active Meds`}
                  size="small"
                  variant="outlined"
                  color={encounterMetrics.activeMedications > 0 ? 'success' : 'default'}
                />
                {encounterMetrics.criticalFindings > 0 && (
                  <Chip
                    icon={<WarningIcon />}
                    label={`${encounterMetrics.criticalFindings} Critical Findings`}
                    size="small"
                    color="error"
                  />
                )}
                <Chip
                  icon={<NotesIcon />}
                  label={`${encounterMetrics.resourceCount} Total Resources`}
                  size="small"
                  variant="outlined"
                />
              </Stack>
            </Stack>
            
            {/* Actions */}
            <Stack direction="row" spacing={1}>
              <Tooltip title="Add Note">
                <IconButton onClick={handleAddNote} size="small">
                  <AddIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Print">
                <IconButton onClick={handlePrint} size="small">
                  <PrintIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Export">
                <IconButton onClick={() => handleExport('pdf')} size="small">
                  <ExportIcon />
                </IconButton>
              </Tooltip>
              <IconButton onClick={onClose} edge="end">
                <CloseIcon />
              </IconButton>
            </Stack>
          </Stack>
        </Box>
        
        {/* Navigation Tabs */}
        <Tabs 
          value={activeTab} 
          onChange={(e, newValue) => setActiveTab(newValue)}
          variant={isMobile ? "scrollable" : "standard"}
          scrollButtons={isMobile ? "auto" : false}
          sx={{ 
            borderTop: `1px solid ${theme.palette.divider}`,
            bgcolor: theme.palette.background.default
          }}
        >
          <Tab 
            icon={<DashboardIcon />} 
            label="Overview" 
            iconPosition="start"
            sx={{ minHeight: 48 }}
          />
          <Tab 
            icon={<TimelineIcon />} 
            label="Timeline" 
            iconPosition="start"
            sx={{ minHeight: 48 }}
          />
          <Tab 
            icon={<LabIcon />} 
            label={`Labs (${relatedResources.observations?.length || 0})`}
            iconPosition="start"
            sx={{ minHeight: 48 }}
          />
          <Tab 
            icon={<MedicationIcon />} 
            label={`Medications (${relatedResources.medications?.length || 0})`}
            iconPosition="start"
            sx={{ minHeight: 48 }}
          />
          <Tab 
            icon={<NotesIcon />} 
            label={`Notes (${relatedResources.documents?.length || 0})`}
            iconPosition="start"
            sx={{ minHeight: 48 }}
          />
        </Tabs>
      </DialogTitle>

      <DialogContent sx={{ p: 0, bgcolor: theme.palette.background.default }}>
        {/* Overview Tab */}
        <TabPanel value={activeTab} index={0}>
          <Grid container spacing={3} sx={{ p: 3 }}>
            {/* Left Column - Main Info */}
            <Grid item xs={12} md={8}>
              {/* Participants Card */}
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Stack direction="row" alignItems="center" spacing={2} mb={2}>
                    <GroupIcon color="primary" />
                    <Typography variant="h6">Care Team</Typography>
                  </Stack>
                  
                  {encounter.participant?.length > 0 ? (
                    <List dense>
                      {encounter.participant.map((participant, idx) => {
                        const typeInfo = getParticipantTypeDisplay(participant);
                        return (
                          <ListItem key={idx}>
                            <ListItemIcon>
                              <Avatar sx={{ 
                                bgcolor: alpha(theme.palette[typeInfo.color].main, 0.1),
                                color: theme.palette[typeInfo.color].main
                              }}>
                                {typeInfo.icon}
                              </Avatar>
                            </ListItemIcon>
                            <ListItemText
                              primary={participant.actor?.display || 
                                      participant.individual?.display || 
                                      'Unknown Provider'}
                              secondary={typeInfo.label}
                            />
                            {participant.period && (
                              <Typography variant="caption" color="text.secondary">
                                {participant.period.start && 
                                  format(parseISO(participant.period.start), 'h:mm a')}
                              </Typography>
                            )}
                          </ListItem>
                        );
                      })}
                    </List>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No participants recorded
                    </Typography>
                  )}
                  
                  {encounter.serviceProvider && (
                    <Box sx={{ mt: 2, p: 2, bgcolor: theme.palette.action.hover, borderRadius: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        Service Provider
                      </Typography>
                      <Typography variant="body2">
                        {encounter.serviceProvider.display || 'Unknown Provider'}
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>

              {/* Reason for Visit Card */}
              {(encounter.reasonCode?.length > 0 || encounter.reasonReference?.length > 0) && (
                <Card sx={{ mb: 3 }}>
                  <CardContent>
                    <Stack direction="row" alignItems="center" spacing={2} mb={2}>
                      <InfoIcon color="primary" />
                      <Typography variant="h6">Reason for Visit</Typography>
                    </Stack>
                    
                    <Stack spacing={1}>
                      {encounter.reasonCode?.map((reason, idx) => (
                        <Chip
                          key={`code-${idx}`}
                          label={reason.text || reason.coding?.[0]?.display}
                          color="primary"
                          variant="outlined"
                        />
                      ))}
                      {encounter.reasonReference?.map((reason, idx) => (
                        <Chip
                          key={`ref-${idx}`}
                          label={reason.display || 'Referenced condition'}
                          color="secondary"
                          variant="outlined"
                          icon={<LinkIcon />}
                        />
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              )}

              {/* Diagnoses Card */}
              {encounter.diagnosis?.length > 0 && (
                <Card sx={{ mb: 3 }}>
                  <CardContent>
                    <Stack direction="row" alignItems="center" spacing={2} mb={2}>
                      <DiagnosisIcon color="primary" />
                      <Typography variant="h6">Encounter Diagnoses</Typography>
                    </Stack>
                    
                    <List dense>
                      {encounter.diagnosis.map((diag, idx) => (
                        <ListItem key={idx}>
                          <ListItemIcon>
                            <Badge 
                              badgeContent={diag.rank} 
                              color={diag.use?.coding?.[0]?.code === 'AD' ? 'primary' : 'default'}
                            >
                              <Avatar sx={{ width: 32, height: 32 }}>
                                {diag.rank || idx + 1}
                              </Avatar>
                            </Badge>
                          </ListItemIcon>
                          <ListItemText
                            primary={diag.condition?.display || 'Diagnosis'}
                            secondary={diag.use?.coding?.[0]?.display}
                          />
                          <Chip
                            label={diag.use?.coding?.[0]?.code === 'AD' ? 'Admission' : 'Working'}
                            size="small"
                            color={diag.use?.coding?.[0]?.code === 'AD' ? 'primary' : 'default'}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              )}

              {/* Hospitalization Details */}
              {encounter.hospitalization && (
                <Card>
                  <CardContent>
                    <Stack direction="row" alignItems="center" spacing={2} mb={2}>
                      <BedIcon color="primary" />
                      <Typography variant="h6">Hospitalization Details</Typography>
                    </Stack>
                    
                    <Grid container spacing={2}>
                      {encounter.hospitalization.preAdmissionIdentifier && (
                        <Grid item xs={12} sm={6}>
                          <Typography variant="caption" color="text.secondary">
                            Pre-Admission ID
                          </Typography>
                          <Typography variant="body2">
                            {encounter.hospitalization.preAdmissionIdentifier.value}
                          </Typography>
                        </Grid>
                      )}
                      
                      {encounter.hospitalization.admitSource && (
                        <Grid item xs={12} sm={6}>
                          <Typography variant="caption" color="text.secondary">
                            Admit Source
                          </Typography>
                          <Typography variant="body2">
                            {getCodeableConceptDisplay(encounter.hospitalization.admitSource)}
                          </Typography>
                        </Grid>
                      )}
                      
                      {encounter.hospitalization.dischargeDisposition && (
                        <Grid item xs={12} sm={6}>
                          <Typography variant="caption" color="text.secondary">
                            Discharge Disposition
                          </Typography>
                          <Typography variant="body2">
                            {getCodeableConceptDisplay(encounter.hospitalization.dischargeDisposition)}
                          </Typography>
                        </Grid>
                      )}
                      
                      {encounter.hospitalization.destination && (
                        <Grid item xs={12} sm={6}>
                          <Typography variant="caption" color="text.secondary">
                            Destination
                          </Typography>
                          <Typography variant="body2">
                            {encounter.hospitalization.destination.display}
                          </Typography>
                        </Grid>
                      )}
                    </Grid>
                    
                    {/* Special Arrangements */}
                    {(encounter.hospitalization.specialCourtesy?.length > 0 ||
                      encounter.hospitalization.specialArrangement?.length > 0 ||
                      encounter.hospitalization.dietPreference?.length > 0) && (
                      <Box sx={{ mt: 2 }}>
                        <Divider sx={{ my: 2 }} />
                        <Grid container spacing={2}>
                          {encounter.hospitalization.dietPreference?.length > 0 && (
                            <Grid item xs={12}>
                              <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                                <DietIcon fontSize="small" color="action" />
                                <Typography variant="subtitle2">Diet Preferences</Typography>
                              </Stack>
                              <Stack direction="row" spacing={1} flexWrap="wrap">
                                {encounter.hospitalization.dietPreference.map((diet, idx) => (
                                  <Chip
                                    key={idx}
                                    label={getCodeableConceptDisplay(diet)}
                                    size="small"
                                    variant="outlined"
                                  />
                                ))}
                              </Stack>
                            </Grid>
                          )}
                          
                          {encounter.hospitalization.specialCourtesy?.length > 0 && (
                            <Grid item xs={12}>
                              <Typography variant="subtitle2" gutterBottom>
                                Special Courtesies
                              </Typography>
                              <Stack direction="row" spacing={1} flexWrap="wrap">
                                {encounter.hospitalization.specialCourtesy.map((courtesy, idx) => (
                                  <Chip
                                    key={idx}
                                    label={getCodeableConceptDisplay(courtesy)}
                                    size="small"
                                    variant="outlined"
                                    color="info"
                                  />
                                ))}
                              </Stack>
                            </Grid>
                          )}
                          
                          {encounter.hospitalization.specialArrangement?.length > 0 && (
                            <Grid item xs={12}>
                              <Typography variant="subtitle2" gutterBottom>
                                Special Arrangements
                              </Typography>
                              <Stack direction="row" spacing={1} flexWrap="wrap">
                                {encounter.hospitalization.specialArrangement.map((arrangement, idx) => (
                                  <Chip
                                    key={idx}
                                    label={getCodeableConceptDisplay(arrangement)}
                                    size="small"
                                    variant="outlined"
                                    color="secondary"
                                  />
                                ))}
                              </Stack>
                            </Grid>
                          )}
                        </Grid>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              )}
            </Grid>

            {/* Right Column - Quick Stats & Actions */}
            <Grid item xs={12} md={4}>
              {/* Quick Stats */}
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Quick Stats
                  </Typography>
                  
                  <Stack spacing={2}>
                    {/* Lab Results */}
                    <Paper 
                      variant="outlined" 
                      sx={{ 
                        p: 2, 
                        cursor: 'pointer',
                        '&:hover': { bgcolor: theme.palette.action.hover }
                      }}
                      onClick={() => setActiveTab(2)}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Stack direction="row" spacing={1} alignItems="center">
                          <LabIcon color="primary" />
                          <Typography variant="body2">Lab Results</Typography>
                        </Stack>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Chip label={relatedResources.observations?.length || 0} size="small" />
                          {encounterMetrics.criticalFindings > 0 && (
                            <Chip 
                              label={`${encounterMetrics.criticalFindings} critical`} 
                              size="small" 
                              color="error"
                            />
                          )}
                          <ArrowForwardIcon fontSize="small" color="action" />
                        </Stack>
                      </Stack>
                    </Paper>
                    
                    {/* Procedures */}
                    <Paper 
                      variant="outlined" 
                      sx={{ 
                        p: 2,
                        cursor: 'pointer',
                        '&:hover': { bgcolor: theme.palette.action.hover }
                      }}
                      onClick={() => handleNavigateToTab('procedures')}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Stack direction="row" spacing={1} alignItems="center">
                          <ProcedureIcon color="secondary" />
                          <Typography variant="body2">Procedures</Typography>
                        </Stack>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Chip label={relatedResources.procedures?.length || 0} size="small" />
                          <ArrowForwardIcon fontSize="small" color="action" />
                        </Stack>
                      </Stack>
                    </Paper>
                    
                    {/* Medications */}
                    <Paper 
                      variant="outlined" 
                      sx={{ 
                        p: 2,
                        cursor: 'pointer',
                        '&:hover': { bgcolor: theme.palette.action.hover }
                      }}
                      onClick={() => setActiveTab(3)}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Stack direction="row" spacing={1} alignItems="center">
                          <MedicationIcon color="success" />
                          <Typography variant="body2">Medications</Typography>
                        </Stack>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Chip label={relatedResources.medications?.length || 0} size="small" />
                          {encounterMetrics.activeMedications > 0 && (
                            <Chip 
                              label={`${encounterMetrics.activeMedications} active`} 
                              size="small" 
                              color="success"
                            />
                          )}
                          <ArrowForwardIcon fontSize="small" color="action" />
                        </Stack>
                      </Stack>
                    </Paper>
                    
                    {/* Documents */}
                    <Paper 
                      variant="outlined" 
                      sx={{ 
                        p: 2,
                        cursor: 'pointer',
                        '&:hover': { bgcolor: theme.palette.action.hover }
                      }}
                      onClick={() => setActiveTab(4)}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Stack direction="row" spacing={1} alignItems="center">
                          <DocumentIcon color="info" />
                          <Typography variant="body2">Clinical Notes</Typography>
                        </Stack>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Chip label={relatedResources.documents?.length || 0} size="small" />
                          <ArrowForwardIcon fontSize="small" color="action" />
                        </Stack>
                      </Stack>
                    </Paper>
                  </Stack>
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Quick Actions
                  </Typography>
                  
                  <Stack spacing={1}>
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<NotesIcon />}
                      onClick={handleAddNote}
                    >
                      Add Clinical Note
                    </Button>
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<AddIcon />}
                      onClick={handleAddOrder}
                    >
                      Place Order
                    </Button>
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<TimelineIcon />}
                      onClick={() => navigate(`/patient/${patientId}/timeline`)}
                    >
                      View Full Timeline
                    </Button>
                  </Stack>
                </CardContent>
              </Card>

              {/* Class History */}
              {encounter.classHistory?.length > 0 && (
                <Card sx={{ mt: 3 }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Encounter Progression
                    </Typography>
                    
                    <Stack spacing={2}>
                      {encounter.classHistory.map((classHist, idx) => (
                        <Box key={idx} sx={{ display: 'flex', alignItems: 'center' }}>
                          <Box sx={{ 
                            position: 'relative',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            mr: 2
                          }}>
                            <Box sx={{
                              width: 12,
                              height: 12,
                              borderRadius: '50%',
                              bgcolor: theme.palette.primary.main,
                              zIndex: 1
                            }} />
                            {idx < encounter.classHistory.length - 1 && (
                              <Box sx={{
                                position: 'absolute',
                                top: 12,
                                width: 2,
                                height: 40,
                                bgcolor: theme.palette.divider
                              }} />
                            )}
                          </Box>
                          <Box>
                            <Typography variant="body2" fontWeight="medium">
                              {classHist.class?.display || classHist.class?.code}
                            </Typography>
                            {classHist.period?.start && (
                              <Typography variant="caption" color="text.secondary">
                                {format(parseISO(classHist.period.start), 'h:mm a')}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              )}
            </Grid>
          </Grid>
        </TabPanel>

        {/* Timeline Tab */}
        <TabPanel value={activeTab} index={1}>
          <Box sx={{ p: 3 }}>
            {timelineEvents.length > 0 ? (
              <Box sx={{ position: 'relative' }}>
                {timelineEvents.map((event, idx) => (
                  <Box key={idx} sx={{ display: 'flex', mb: 3 }}>
                    {/* Time Column */}
                    {!isMobile && (
                      <Box sx={{ 
                        width: 100, 
                        pr: 2, 
                        textAlign: 'right',
                        flexShrink: 0
                      }}>
                        <Typography variant="caption" color="text.secondary">
                          {format(event.time, 'h:mm a')}
                        </Typography>
                      </Box>
                    )}
                    
                    {/* Timeline Line */}
                    <Box sx={{ 
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      px: 2
                    }}>
                      <Avatar sx={{ 
                        width: 40, 
                        height: 40,
                        bgcolor: alpha(theme.palette[event.color].main, 0.1),
                        color: theme.palette[event.color].main,
                        zIndex: 1
                      }}>
                        {event.icon}
                      </Avatar>
                      {idx < timelineEvents.length - 1 && (
                        <Box sx={{
                          position: 'absolute',
                          top: 40,
                          bottom: -24,
                          width: 2,
                          bgcolor: theme.palette.divider
                        }} />
                      )}
                    </Box>
                    
                    {/* Content */}
                    <Box sx={{ flex: 1 }}>
                      <Paper elevation={1} sx={{ p: 2 }}>
                        <Typography variant="subtitle2" fontWeight="medium">
                          {event.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {event.description}
                        </Typography>
                        {isMobile && (
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                            {format(event.time, 'h:mm a')}
                          </Typography>
                        )}
                      </Paper>
                    </Box>
                  </Box>
                ))}
              </Box>
            ) : (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <TimelineIcon sx={{ fontSize: 64, color: theme.palette.text.disabled, mb: 2 }} />
                <Typography variant="body1" color="text.secondary">
                  No timeline events available for this encounter
                </Typography>
              </Box>
            )}
          </Box>
        </TabPanel>

        {/* Lab Results Tab */}
        <TabPanel value={activeTab} index={2}>
          <Box sx={{ p: 3 }}>
            {relatedResources.observations?.length > 0 ? (
              <Grid container spacing={2}>
                {relatedResources.observations.map((obs) => (
                  <Grid item xs={12} md={6} key={obs.id}>
                    <Card>
                      <CardContent>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                          <Box flex={1}>
                            <Typography variant="subtitle1" fontWeight="medium">
                              {obs.code?.text || obs.code?.coding?.[0]?.display}
                            </Typography>
                            <Typography variant="h4" sx={{ my: 1 }}>
                              {obs.valueQuantity ? 
                                `${obs.valueQuantity.value} ${obs.valueQuantity.unit || ''}` :
                                obs.valueString || 'Pending'}
                            </Typography>
                            {obs.referenceRange?.[0] && (
                              <Typography variant="caption" color="text.secondary">
                                Reference: {obs.referenceRange[0].low?.value}-{obs.referenceRange[0].high?.value} {obs.referenceRange[0].low?.unit}
                              </Typography>
                            )}
                          </Box>
                          {obs.interpretation?.[0] && (
                            <Chip
                              label={obs.interpretation[0].coding?.[0]?.display || obs.interpretation[0].coding?.[0]?.code}
                              size="small"
                              color={
                                obs.interpretation[0].coding?.[0]?.code === 'H' || 
                                obs.interpretation[0].coding?.[0]?.code === 'HH' ? 'error' :
                                obs.interpretation[0].coding?.[0]?.code === 'L' || 
                                obs.interpretation[0].coding?.[0]?.code === 'LL' ? 'warning' : 
                                'success'
                              }
                            />
                          )}
                        </Stack>
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                          {obs.effectiveDateTime && format(parseISO(obs.effectiveDateTime), 'MMM d, h:mm a')}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            ) : (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <LabIcon sx={{ fontSize: 64, color: theme.palette.text.disabled, mb: 2 }} />
                <Typography variant="body1" color="text.secondary">
                  No lab results available for this encounter
                </Typography>
                <Button 
                  variant="outlined" 
                  startIcon={<AddIcon />}
                  sx={{ mt: 2 }}
                  onClick={() => handleNavigateToTab('orders')}
                >
                  Order Labs
                </Button>
              </Box>
            )}
          </Box>
        </TabPanel>

        {/* Medications Tab */}
        <TabPanel value={activeTab} index={3}>
          <Box sx={{ p: 3 }}>
            {relatedResources.medications?.length > 0 ? (
              <List>
                {relatedResources.medications.map((med) => (
                  <ListItem key={med.id} divider>
                    <ListItemIcon>
                      <Avatar sx={{ 
                        bgcolor: med.status === 'active' ? 
                          alpha(theme.palette.success.main, 0.1) : 
                          alpha(theme.palette.grey[500], 0.1),
                        color: med.status === 'active' ? 
                          theme.palette.success.main : 
                          theme.palette.grey[500]
                      }}>
                        <MedicationIcon />
                      </Avatar>
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Typography variant="subtitle1" fontWeight="medium">
                          {med.medication?.concept?.text || 
                           med.medication?.concept?.coding?.[0]?.display ||
                           med.medicationCodeableConcept?.text ||
                           med.medicationCodeableConcept?.coding?.[0]?.display ||
                           'Unknown medication'}
                        </Typography>
                      }
                      secondary={
                        <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                          <Typography variant="body2" color="text.primary">
                            {/* Enhanced dosage display */}
                            {(() => {
                              const dosageText = getMedicationDosageDisplay(med);
                              // If no structured dosage, try to extract from other fields
                              if (dosageText === 'No dosage information') {
                                // Check for dispenseRequest details
                                if (med.dispenseRequest?.quantity?.value) {
                                  const qty = med.dispenseRequest.quantity;
                                  const days = med.dispenseRequest?.expectedSupplyDuration?.value;
                                  return `${qty.value} ${qty.unit || 'units'}${days ? ` for ${days} days` : ''}`;
                                }
                                // Check for any text in the request
                                if (med.note?.[0]?.text) {
                                  return med.note[0].text;
                                }
                              }
                              return dosageText;
                            })()}
                          </Typography>
                          <Stack direction="row" spacing={2} flexWrap="wrap">
                            <Typography variant="caption" color="text.secondary">
                              Route: {getMedicationRoute(med) || med.dosageInstruction?.[0]?.route?.text || 'Not specified'}
                            </Typography>
                            {med.dosageInstruction?.[0]?.timing?.repeat?.frequency && (
                              <Typography variant="caption" color="text.secondary">
                                Frequency: {med.dosageInstruction[0].timing.repeat.frequency}x per {med.dosageInstruction[0].timing.repeat.period} {med.dosageInstruction[0].timing.repeat.periodUnit}
                              </Typography>
                            )}
                            <Typography variant="caption" color="text.secondary">
                              Ordered: {med.authoredOn && format(parseISO(med.authoredOn), 'MMM d, h:mm a')}
                            </Typography>
                          </Stack>
                          {/* Additional medication details */}
                          {(med.requester?.display || med.recorder?.display) && (
                            <Typography variant="caption" color="text.secondary">
                              Prescribed by: {med.requester?.display || med.recorder?.display}
                            </Typography>
                          )}
                          {med.reasonCode?.[0] && (
                            <Typography variant="caption" color="text.secondary">
                              Reason: {med.reasonCode[0].text || med.reasonCode[0].coding?.[0]?.display}
                            </Typography>
                          )}
                        </Stack>
                      }
                    />
                    <ListItemSecondaryAction>
                      <Chip
                        label={med.status}
                        size="small"
                        color={
                          med.status === 'active' ? 'success' :
                          med.status === 'on-hold' ? 'warning' :
                          med.status === 'stopped' ? 'error' : 'default'
                        }
                      />
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            ) : (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <MedicationIcon sx={{ fontSize: 64, color: theme.palette.text.disabled, mb: 2 }} />
                <Typography variant="body1" color="text.secondary">
                  No medications prescribed during this encounter
                </Typography>
                <Button 
                  variant="outlined" 
                  startIcon={<AddIcon />}
                  sx={{ mt: 2 }}
                  onClick={() => handleNavigateToTab('medications')}
                >
                  Prescribe Medication
                </Button>
              </Box>
            )}
          </Box>
        </TabPanel>

        {/* Notes Tab */}
        <TabPanel value={activeTab} index={4}>
          <Box sx={{ p: 3 }}>
            {relatedResources.documents?.length > 0 ? (
              <Stack spacing={2}>
                {relatedResources.documents.map((doc) => {
                  // Extract document content
                  const extractedContent = documentReferenceConverter.extractDocumentContent(doc);
                  const hasContent = extractedContent.content && !extractedContent.error;
                  
                  return (
                    <Card key={doc.id}>
                      <CardContent>
                        <Stack spacing={2}>
                          {/* Header */}
                          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                            <Box flex={1}>
                              <Typography variant="subtitle1" fontWeight="medium">
                                {doc.type?.text || doc.type?.coding?.[0]?.display || 'Clinical Note'}
                              </Typography>
                              <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
                                <Chip
                                  label={doc.docStatus || doc.status || 'draft'}
                                  size="small"
                                  color={doc.docStatus === 'final' ? 'success' : 'default'}
                                />
                                {doc.authenticator && (
                                  <Typography variant="body2" color="text.secondary">
                                    Signed by: {doc.authenticator.display}
                                  </Typography>
                                )}
                                {doc.author?.[0]?.display && (
                                  <Typography variant="body2" color="text.secondary">
                                    By: {doc.author[0].display}
                                  </Typography>
                                )}
                              </Stack>
                              <Typography variant="caption" color="text.secondary">
                                {doc.date && format(parseISO(doc.date), 'MMM d, yyyy h:mm a')}
                              </Typography>
                            </Box>
                            <Button 
                              size="small" 
                              startIcon={<ArrowForwardIcon />}
                              onClick={() => handleNavigateToTab('notes')}
                            >
                              Open Full
                            </Button>
                          </Stack>
                          
                          {/* Content Preview */}
                          {hasContent && (
                            <Paper 
                              variant="outlined" 
                              sx={{ 
                                p: 2, 
                                bgcolor: theme.palette.background.default,
                                maxHeight: 300,
                                overflow: 'auto'
                              }}
                            >
                              {extractedContent.type === 'soap' && extractedContent.sections ? (
                                // SOAP format
                                <Stack spacing={2}>
                                  {Object.entries(extractedContent.sections).map(([key, value]) => (
                                    value && (
                                      <Box key={key}>
                                        <Typography variant="subtitle2" color="primary" fontWeight="medium" gutterBottom>
                                          {key.charAt(0).toUpperCase() + key.slice(1)}
                                        </Typography>
                                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                                          {value}
                                        </Typography>
                                      </Box>
                                    )
                                  ))}
                                </Stack>
                              ) : (
                                // Plain text
                                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                                  {extractedContent.content}
                                </Typography>
                              )}
                            </Paper>
                          )}
                          
                          {extractedContent.error && (
                            <Alert severity="warning" sx={{ mt: 1 }}>
                              Unable to display note content: {extractedContent.error}
                            </Alert>
                          )}
                        </Stack>
                      </CardContent>
                    </Card>
                  );
                })}
              </Stack>
            ) : (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <DocumentIcon sx={{ fontSize: 64, color: theme.palette.text.disabled, mb: 2 }} />
                <Typography variant="body1" color="text.secondary">
                  No clinical notes for this encounter
                </Typography>
                <Button 
                  variant="outlined" 
                  startIcon={<AddIcon />}
                  sx={{ mt: 2 }}
                  onClick={handleAddNote}
                >
                  Add Clinical Note
                </Button>
              </Box>
            )}
          </Box>
        </TabPanel>
      </DialogContent>

      <DialogActions sx={{ 
        p: 2,
        borderTop: `1px solid ${theme.palette.divider}`,
        bgcolor: theme.palette.background.paper
      }}>
        <Stack direction="row" spacing={2} sx={{ width: '100%' }} justifyContent="space-between">
          <Stack direction="row" spacing={1}>
            <Button 
              startIcon={<PrintIcon />} 
              variant="outlined"
              onClick={handlePrint}
            >
              Print
            </Button>
            <Button 
              startIcon={<ExportIcon />} 
              variant="outlined"
              onClick={() => handleExport('pdf')}
            >
              Export
            </Button>
          </Stack>
          <Button 
            onClick={onClose} 
            variant="contained"
            sx={{ minWidth: 100 }}
          >
            Close
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
};

// Helper function for status color
const getStatusColor = (status) => {
  switch (status) {
    case 'finished': return 'success';
    case 'in-progress': return 'warning';
    case 'cancelled': return 'error';
    default: return 'default';
  }
};

export default EncounterSummaryDialogEnhanced;