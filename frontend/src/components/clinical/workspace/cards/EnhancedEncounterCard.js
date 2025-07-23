/**
 * Enhanced Encounter Card Component
 * Displays comprehensive encounter information in an expanded card format
 * Similar to Chart Review cards but with encounter-specific details
 */
import React, { memo, useState } from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Box,
  Stack,
  Chip,
  IconButton,
  Button,
  Divider,
  Grid,
  Avatar,
  Tooltip,
  Collapse,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Badge,
  useTheme,
  alpha
} from '@mui/material';
import {
  LocalHospital as HospitalIcon,
  MedicalServices as ClinicIcon,
  LocalHospital as EmergencyIcon,
  Home as HomeIcon,
  Person as PersonIcon,
  LocationOn as LocationIcon,
  AccessTime as TimeIcon,
  CalendarMonth as CalendarIcon,
  Assignment as AssignmentIcon,
  Science as LabIcon,
  Medication as MedicationIcon,
  Note as NoteIcon,
  AttachFile as AttachmentIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Edit as EditIcon,
  Draw as SignIcon,
  CheckCircle as CheckCircleIcon,
  MoreVert as MoreVertIcon,
  Warning as WarningIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import { format, parseISO, formatDistanceToNow, differenceInMinutes } from 'date-fns';
import { motion } from 'framer-motion';
import { getEncounterClass, getEncounterStatus, getCodeableConceptDisplay } from '../../../../core/fhir/utils/fhirFieldUtils';

// Get encounter icon based on class
const getEncounterIcon = (encounter) => {
  const classCode = getEncounterClass(encounter);
  
  switch (classCode) {
    case 'IMP':
    case 'ACUTE':
      return <HospitalIcon color="error" />;
    case 'EMER':
      return <EmergencyIcon color="error" />;
    case 'HH':
      return <HomeIcon color="info" />;
    case 'AMB':
    default:
      return <ClinicIcon color="primary" />;
  }
};

// Get encounter severity for styling
const getEncounterSeverity = (encounter) => {
  const classCode = getEncounterClass(encounter);
  const status = getEncounterStatus(encounter);
  
  if (classCode === 'EMER') return 'critical';
  if (classCode === 'IMP' || classCode === 'ACUTE') return 'high';
  if (status === 'in-progress') return 'moderate';
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
    case 'AMB': return 'Ambulatory Visit';
    case 'IMP': return 'Inpatient Admission';
    case 'EMER': return 'Emergency Visit';
    case 'HH': return 'Home Health Visit';
    default: return 'Clinical Encounter';
  }
};

const EnhancedEncounterCard = memo(({ 
  encounter, 
  onViewDetails, 
  onEdit, 
  onSign, 
  onAddNote,
  onMenuAction,
  isExpanded = true,
  showRelatedResources = true,
  elevation = 1
}) => {
  const theme = useTheme();
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  
  // Extract encounter data
  const period = encounter.actualPeriod || encounter.period || {};
  const startDate = period.start ? parseISO(period.start) : null;
  const endDate = period.end ? parseISO(period.end) : null;
  const duration = startDate && endDate ? differenceInMinutes(endDate, startDate) : null;
  const status = getEncounterStatus(encounter);
  const severity = getEncounterSeverity(encounter);
  
  // Get providers
  const providers = encounter.participant?.filter(p => 
    p.type?.some(t => t.coding?.some(c => c.code === 'ATND'))
  ) || [];
  
  // Get location
  const location = encounter.location?.[0]?.location?.display || 'Unknown Location';
  
  // Get reason for visit
  const reasonForVisit = encounter.reasonCode?.[0] ? 
    getCodeableConceptDisplay(encounter.reasonCode[0]) : 
    'No reason documented';
  
  // Get diagnosis
  const diagnosis = encounter.diagnosis?.map(d => ({
    condition: d.condition?.display || 'Unknown',
    rank: d.rank || 999
  })).sort((a, b) => a.rank - b.rank) || [];
  
  // Severity colors
  const severityColors = {
    critical: theme.palette.error.main,
    high: theme.palette.warning.main,
    moderate: theme.palette.info.main,
    normal: theme.palette.text.secondary
  };
  
  // Status colors
  const statusColors = {
    'in-progress': theme.palette.info.main,
    'finished': theme.palette.success.main,
    'cancelled': theme.palette.error.main,
    'entered-in-error': theme.palette.error.main,
    'planned': theme.palette.warning.main
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card 
        elevation={elevation}
        sx={{ 
          mb: 2,
          borderLeft: 4,
          borderLeftColor: severityColors[severity],
          '&:hover': {
            boxShadow: theme.shadows[4]
          }
        }}
      >
        <CardContent>
          {/* Header */}
          <Grid container spacing={2} alignItems="flex-start">
            <Grid item xs={12} md={8}>
              <Stack spacing={1}>
                {/* Title with icon */}
                <Stack direction="row" spacing={2} alignItems="center">
                  <Avatar
                    sx={{
                      bgcolor: alpha(severityColors[severity], 0.1),
                      color: severityColors[severity]
                    }}
                  >
                    {getEncounterIcon(encounter)}
                  </Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h6" component="div">
                      {getEncounterTypeLabel(encounter)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {startDate && format(startDate, 'EEEE, MMMM d, yyyy')}
                    </Typography>
                  </Box>
                  <Chip
                    label={status}
                    size="small"
                    sx={{
                      bgcolor: alpha(statusColors[status] || theme.palette.grey[500], 0.1),
                      color: statusColors[status] || theme.palette.grey[700],
                      fontWeight: 500
                    }}
                  />
                </Stack>
                
                {/* Key Details */}
                <Grid container spacing={2} sx={{ mt: 1 }}>
                  <Grid item xs={12} sm={6}>
                    <Stack spacing={1}>
                      {/* Time */}
                      <Stack direction="row" spacing={1} alignItems="center">
                        <TimeIcon fontSize="small" color="action" />
                        <Typography variant="body2">
                          {startDate && format(startDate, 'h:mm a')}
                          {duration && ` (${duration} minutes)`}
                        </Typography>
                      </Stack>
                      
                      {/* Location */}
                      <Stack direction="row" spacing={1} alignItems="center">
                        <LocationIcon fontSize="small" color="action" />
                        <Typography variant="body2">{location}</Typography>
                      </Stack>
                      
                      {/* Provider */}
                      {providers.length > 0 && (
                        <Stack direction="row" spacing={1} alignItems="center">
                          <PersonIcon fontSize="small" color="action" />
                          <Typography variant="body2">
                            {providers.map(p => 
                              p.individual?.display || 'Unknown Provider'
                            ).join(', ')}
                          </Typography>
                        </Stack>
                      )}
                    </Stack>
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <Stack spacing={1}>
                      {/* Reason for visit */}
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Reason for Visit
                        </Typography>
                        <Typography variant="body2">
                          {reasonForVisit}
                        </Typography>
                      </Box>
                      
                      {/* Primary diagnosis if available */}
                      {diagnosis.length > 0 && (
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Primary Diagnosis
                          </Typography>
                          <Typography variant="body2">
                            {diagnosis[0].condition}
                          </Typography>
                        </Box>
                      )}
                    </Stack>
                  </Grid>
                </Grid>
              </Stack>
            </Grid>
            
            <Grid item xs={12} md={4}>
              {/* Metrics/Stats */}
              <Stack direction="row" spacing={2} justifyContent="flex-end">
                {encounter.extension?.filter(ext => ext.url === 'notes')?.length > 0 && (
                  <Tooltip title="Clinical Notes">
                    <Badge badgeContent={encounter.extension.filter(ext => ext.url === 'notes').length} color="primary">
                      <NoteIcon />
                    </Badge>
                  </Tooltip>
                )}
                {encounter.extension?.filter(ext => ext.url === 'orders')?.length > 0 && (
                  <Tooltip title="Orders">
                    <Badge badgeContent={encounter.extension.filter(ext => ext.url === 'orders').length} color="secondary">
                      <AssignmentIcon />
                    </Badge>
                  </Tooltip>
                )}
                {encounter.extension?.filter(ext => ext.url === 'labs')?.length > 0 && (
                  <Tooltip title="Lab Results">
                    <Badge badgeContent={encounter.extension.filter(ext => ext.url === 'labs').length} color="info">
                      <LabIcon />
                    </Badge>
                  </Tooltip>
                )}
              </Stack>
            </Grid>
          </Grid>
          
          {/* Expandable Details */}
          {showRelatedResources && (
            <>
              <Divider sx={{ my: 2 }} />
              <Box>
                <Button
                  size="small"
                  onClick={() => setDetailsExpanded(!detailsExpanded)}
                  startIcon={detailsExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                >
                  {detailsExpanded ? 'Hide' : 'Show'} Details
                </Button>
                
                <Collapse in={detailsExpanded}>
                  <Box sx={{ mt: 2 }}>
                    <Grid container spacing={2}>
                      {/* All Diagnoses */}
                      {diagnosis.length > 0 && (
                        <Grid item xs={12} md={6}>
                          <Typography variant="subtitle2" gutterBottom>
                            Diagnoses
                          </Typography>
                          <List dense>
                            {diagnosis.map((dx, index) => (
                              <ListItem key={index}>
                                <ListItemIcon>
                                  <Chip label={dx.rank} size="small" />
                                </ListItemIcon>
                                <ListItemText primary={dx.condition} />
                              </ListItem>
                            ))}
                          </List>
                        </Grid>
                      )}
                      
                      {/* Service Type */}
                      {encounter.serviceType && (
                        <Grid item xs={12} md={6}>
                          <Typography variant="subtitle2" gutterBottom>
                            Service Type
                          </Typography>
                          <Typography variant="body2">
                            {getCodeableConceptDisplay(encounter.serviceType)}
                          </Typography>
                        </Grid>
                      )}
                      
                      {/* Additional Notes */}
                      {encounter.text?.div && (
                        <Grid item xs={12}>
                          <Typography variant="subtitle2" gutterBottom>
                            Notes
                          </Typography>
                          <Box 
                            sx={{ 
                              p: 1, 
                              bgcolor: 'background.default',
                              borderRadius: 1
                            }}
                            dangerouslySetInnerHTML={{ __html: encounter.text.div }}
                          />
                        </Grid>
                      )}
                    </Grid>
                  </Box>
                </Collapse>
              </Box>
            </>
          )}
        </CardContent>
        
        <CardActions sx={{ px: 2, pb: 2 }}>
          <Button
            size="small"
            startIcon={<NoteIcon />}
            onClick={() => onViewDetails(encounter)}
          >
            View Summary
          </Button>
          {status === 'in-progress' && (
            <>
              <Button
                size="small"
                startIcon={<NoteIcon />}
                onClick={() => onAddNote(encounter)}
              >
                Add Note
              </Button>
              <Button
                size="small"
                startIcon={<SignIcon />}
                onClick={() => onSign(encounter)}
                color="primary"
              >
                Sign & Close
              </Button>
            </>
          )}
          {status === 'finished' && (
            <Button
              size="small"
              startIcon={<EditIcon />}
              onClick={() => onEdit(encounter)}
            >
              Edit
            </Button>
          )}
          <Box sx={{ flex: 1 }} />
          <IconButton 
            size="small"
            onClick={(e) => onMenuAction?.(e, encounter)}
          >
            <MoreVertIcon />
          </IconButton>
        </CardActions>
      </Card>
    </motion.div>
  );
});

EnhancedEncounterCard.displayName = 'EnhancedEncounterCard';

export default EnhancedEncounterCard;