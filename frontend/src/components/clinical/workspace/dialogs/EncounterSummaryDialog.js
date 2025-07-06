/**
 * Encounter Summary Dialog Component
 * Shows comprehensive encounter information including related resources
 */
import React, { useState, useEffect, useMemo } from 'react';
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
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Divider,
  Stack,
  Card,
  CardContent,
  CardHeader,
  IconButton,
  Collapse,
  Alert,
  CircularProgress,
  useTheme
} from '@mui/material';
import {
  Close as CloseIcon,
  EventNote as EncounterIcon,
  Person as PatientIcon,
  LocalHospital as ProviderIcon,
  AccessTime as TimeIcon,
  CalendarMonth as DateIcon,
  Description as NotesIcon,
  Science as LabIcon,
  MedicalServices as ProcedureIcon,
  Medication as MedicationIcon,
  Assignment as DiagnosisIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Print as PrintIcon,
  GetApp as ExportIcon
} from '@mui/icons-material';
import { format, parseISO } from 'date-fns';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';

// Get encounter type icon and color
const getEncounterIcon = (encounterClass) => {
  switch (encounterClass?.code) {
    case 'IMP':
    case 'ACUTE':
      return { icon: <ProviderIcon />, color: 'error' };
    case 'EMER':
      return { icon: <ProviderIcon />, color: 'error' };
    case 'HH':
      return { icon: <ProviderIcon />, color: 'info' };
    case 'AMB':
    default:
      return { icon: <ProviderIcon />, color: 'primary' };
  }
};

const EncounterSummaryDialog = ({ open, onClose, encounter, patientId }) => {
  const theme = useTheme();
  const { getPatientResources } = useFHIRResource();
  const [loading, setLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    observations: true,
    procedures: false,
    medications: false,
    diagnoses: false
  });

  // Get all related resources for this encounter
  const relatedResources = useMemo(() => {
    if (!encounter || !patientId) return {};

    const observations = getPatientResources(patientId, 'Observation') || [];
    const procedures = getPatientResources(patientId, 'Procedure') || [];
    const medications = getPatientResources(patientId, 'MedicationRequest') || [];
    const conditions = getPatientResources(patientId, 'Condition') || [];
    const documentReferences = getPatientResources(patientId, 'DocumentReference') || [];

    // Filter resources related to this encounter
    const encounterRef = `Encounter/${encounter.id}`;
    
    return {
      observations: observations.filter(obs => 
        obs.encounter?.reference === encounterRef
      ),
      procedures: procedures.filter(proc => 
        proc.encounter?.reference === encounterRef
      ),
      medications: medications.filter(med => 
        med.encounter?.reference === encounterRef
      ),
      conditions: conditions.filter(cond => 
        cond.encounter?.some(enc => enc.reference === encounterRef)
      ),
      documents: documentReferences.filter(doc => 
        doc.context?.encounter?.some(enc => enc.reference === encounterRef)
      )
    };
  }, [encounter, patientId, getPatientResources]);

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  if (!encounter) return null;

  const period = encounter.period || {};
  const startDate = period.start ? parseISO(period.start) : null;
  const endDate = period.end ? parseISO(period.end) : null;
  const iconInfo = getEncounterIcon(encounter.class);

  const getStatusColor = (status) => {
    switch (status) {
      case 'finished': return 'success';
      case 'in-progress': return 'warning';
      case 'cancelled': return 'error';
      default: return 'default';
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { height: '80vh' }
      }}
    >
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={2} alignItems="center">
            {iconInfo.icon}
            <Box>
              <Typography variant="h6">
                Encounter Summary
              </Typography>
              <Typography variant="subtitle2" color="text.secondary">
                {encounter.type?.[0]?.text || encounter.type?.[0]?.coding?.[0]?.display || encounter.class?.display || 'Encounter'}
              </Typography>
            </Box>
          </Stack>
          <IconButton onClick={onClose} edge="end">
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        <Box sx={{ p: 3 }}>
          {/* Encounter Details */}
          <Paper sx={{ p: 2, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Encounter Information
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Stack spacing={1}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Status
                    </Typography>
                    <br />
                    <Chip 
                      label={encounter.status} 
                      size="small" 
                      color={getStatusColor(encounter.status)}
                    />
                  </Box>
                  
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Class
                    </Typography>
                    <Typography variant="body2">
                      {encounter.class?.display || encounter.class?.code || 'Unknown'}
                    </Typography>
                  </Box>

                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Type
                    </Typography>
                    <Typography variant="body2">
                      {encounter.type?.[0]?.text || encounter.type?.[0]?.coding?.[0]?.display || 'Not specified'}
                    </Typography>
                  </Box>
                </Stack>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <Stack spacing={1}>
                  {startDate && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Start Date & Time
                      </Typography>
                      <Typography variant="body2">
                        {format(startDate, 'MMM d, yyyy h:mm a')}
                      </Typography>
                    </Box>
                  )}
                  
                  {endDate && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        End Date & Time
                      </Typography>
                      <Typography variant="body2">
                        {format(endDate, 'MMM d, yyyy h:mm a')}
                      </Typography>
                    </Box>
                  )}

                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Provider
                    </Typography>
                    <Typography variant="body2">
                      {encounter.participant?.find(p => 
                        p.type?.[0]?.coding?.[0]?.code === 'ATND'
                      )?.individual?.display || 'No provider recorded'}
                    </Typography>
                  </Box>
                </Stack>
              </Grid>
            </Grid>

            {encounter.reasonCode && encounter.reasonCode.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  Reason for Visit
                </Typography>
                <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 0.5 }}>
                  {encounter.reasonCode.map((reason, idx) => (
                    <Chip 
                      key={idx}
                      label={reason.text || reason.coding?.[0]?.display} 
                      size="small"
                      variant="outlined"
                    />
                  ))}
                </Stack>
              </Box>
            )}
          </Paper>

          {/* Related Resources */}
          <Typography variant="h6" gutterBottom>
            Related Clinical Information
          </Typography>

          {/* Observations */}
          <Card sx={{ mb: 2 }}>
            <CardHeader
              title={
                <Stack direction="row" spacing={1} alignItems="center">
                  <LabIcon color="primary" />
                  <Typography variant="subtitle1">
                    Lab Results & Observations ({relatedResources.observations?.length || 0})
                  </Typography>
                </Stack>
              }
              action={
                <IconButton onClick={() => toggleSection('observations')}>
                  {expandedSections.observations ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
              }
            />
            <Collapse in={expandedSections.observations}>
              <CardContent>
                {relatedResources.observations?.length > 0 ? (
                  <List dense>
                    {relatedResources.observations.map((obs) => (
                      <ListItem key={obs.id}>
                        <ListItemText
                          primary={obs.code?.text || obs.code?.coding?.[0]?.display || 'Unknown test'}
                          secondary={`${obs.valueQuantity ? 
                            `${obs.valueQuantity.value} ${obs.valueQuantity.unit || ''}` :
                            obs.valueString || 'Result pending'} - ${obs.effectiveDateTime ? 
                            format(parseISO(obs.effectiveDateTime), 'MMM d, h:mm a') : 'No date'}`}
                        />
                      </ListItem>
                    ))}
                  </List>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No lab results or observations recorded for this encounter
                  </Typography>
                )}
              </CardContent>
            </Collapse>
          </Card>

          {/* Procedures */}
          <Card sx={{ mb: 2 }}>
            <CardHeader
              title={
                <Stack direction="row" spacing={1} alignItems="center">
                  <ProcedureIcon color="primary" />
                  <Typography variant="subtitle1">
                    Procedures ({relatedResources.procedures?.length || 0})
                  </Typography>
                </Stack>
              }
              action={
                <IconButton onClick={() => toggleSection('procedures')}>
                  {expandedSections.procedures ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
              }
            />
            <Collapse in={expandedSections.procedures}>
              <CardContent>
                {relatedResources.procedures?.length > 0 ? (
                  <List dense>
                    {relatedResources.procedures.map((proc) => (
                      <ListItem key={proc.id}>
                        <ListItemText
                          primary={proc.code?.text || proc.code?.coding?.[0]?.display || 'Unknown procedure'}
                          secondary={`Status: ${proc.status} - ${proc.performedDateTime ? 
                            format(parseISO(proc.performedDateTime), 'MMM d, h:mm a') : 'No date'}`}
                        />
                      </ListItem>
                    ))}
                  </List>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No procedures recorded for this encounter
                  </Typography>
                )}
              </CardContent>
            </Collapse>
          </Card>

          {/* Medications */}
          <Card sx={{ mb: 2 }}>
            <CardHeader
              title={
                <Stack direction="row" spacing={1} alignItems="center">
                  <MedicationIcon color="primary" />
                  <Typography variant="subtitle1">
                    Medications ({relatedResources.medications?.length || 0})
                  </Typography>
                </Stack>
              }
              action={
                <IconButton onClick={() => toggleSection('medications')}>
                  {expandedSections.medications ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
              }
            />
            <Collapse in={expandedSections.medications}>
              <CardContent>
                {relatedResources.medications?.length > 0 ? (
                  <List dense>
                    {relatedResources.medications.map((med) => (
                      <ListItem key={med.id}>
                        <ListItemText
                          primary={med.medicationCodeableConcept?.text || 
                                  med.medicationCodeableConcept?.coding?.[0]?.display || 
                                  'Unknown medication'}
                          secondary={`Status: ${med.status} - ${med.authoredOn ? 
                            format(parseISO(med.authoredOn), 'MMM d, h:mm a') : 'No date'}`}
                        />
                      </ListItem>
                    ))}
                  </List>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No medications prescribed during this encounter
                  </Typography>
                )}
              </CardContent>
            </Collapse>
          </Card>

          {/* Diagnoses */}
          <Card sx={{ mb: 2 }}>
            <CardHeader
              title={
                <Stack direction="row" spacing={1} alignItems="center">
                  <DiagnosisIcon color="primary" />
                  <Typography variant="subtitle1">
                    Diagnoses & Conditions ({relatedResources.conditions?.length || 0})
                  </Typography>
                </Stack>
              }
              action={
                <IconButton onClick={() => toggleSection('diagnoses')}>
                  {expandedSections.diagnoses ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
              }
            />
            <Collapse in={expandedSections.diagnoses}>
              <CardContent>
                {relatedResources.conditions?.length > 0 ? (
                  <List dense>
                    {relatedResources.conditions.map((condition) => (
                      <ListItem key={condition.id}>
                        <ListItemText
                          primary={condition.code?.text || condition.code?.coding?.[0]?.display || 'Unknown condition'}
                          secondary={`Status: ${condition.clinicalStatus?.coding?.[0]?.code || 'unknown'} - ${condition.onsetDateTime ? 
                            format(parseISO(condition.onsetDateTime), 'MMM d, yyyy') : 'No onset date'}`}
                        />
                      </ListItem>
                    ))}
                  </List>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No diagnoses or conditions recorded for this encounter
                  </Typography>
                )}
              </CardContent>
            </Collapse>
          </Card>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button startIcon={<PrintIcon />} variant="outlined">
          Print Summary
        </Button>
        <Button startIcon={<ExportIcon />} variant="outlined">
          Export
        </Button>
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EncounterSummaryDialog;