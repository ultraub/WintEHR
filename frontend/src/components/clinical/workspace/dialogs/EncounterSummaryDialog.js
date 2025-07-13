/**
 * Encounter Summary Dialog Component
 * Shows comprehensive encounter information including related resources
 */
import React, { useState, useMemo } from 'react';
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
  Chip,
  Stack,
  Card,
  CardContent,
  CardHeader,
  IconButton,
  Collapse,
  useTheme,
  Zoom
} from '@mui/material';
import {
  Close as CloseIcon,
  LocalHospital as ProviderIcon,
  Science as LabIcon,
  MedicalServices as ProcedureIcon,
  Medication as MedicationIcon,
  Assignment as DiagnosisIcon,
  Description as DocumentIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Print as PrintIcon,
  GetApp as ExportIcon
} from '@mui/icons-material';
import { format, parseISO } from 'date-fns';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import { printDocument } from '../../../../utils/printUtils';
import { getMedicationDosageDisplay, getMedicationRoute } from '../../../../utils/medicationDisplayUtils';

// Get encounter type icon and color
const getEncounterIcon = (encounterClass) => {
  // Handle both array format (R5) and object format (R4)
  const classCode = Array.isArray(encounterClass) 
    ? encounterClass[0]?.coding?.[0]?.code 
    : encounterClass?.code;
    
  switch (classCode) {
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
  const [expandedSections, setExpandedSections] = useState({
    observations: false,
    procedures: false,
    medications: false,
    diagnoses: false,
    documents: false
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
    // Handle both reference formats: "Encounter/id" and "urn:uuid:id"
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
        // Check if encounter is an array
        if (Array.isArray(cond.encounter)) {
          return cond.encounter.some(enc => isEncounterMatch(enc.reference));
        }
        // Check if encounter is a single reference object
        if (cond.encounter?.reference) {
          return isEncounterMatch(cond.encounter.reference);
        }
        return false;
      }),
      documents: documentReferences.filter(doc => {
        // Check if context.encounter is an array
        if (Array.isArray(doc.context?.encounter)) {
          return doc.context.encounter.some(enc => isEncounterMatch(enc.reference));
        }
        // Check if context.encounter is a single reference object
        if (doc.context?.encounter?.reference) {
          return isEncounterMatch(doc.context.encounter.reference);
        }
        return false;
      })
    };
  }, [encounter, patientId, getPatientResources]);

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  if (!encounter) return null;

  const period = encounter.actualPeriod || encounter.period || {};
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

  const handlePrint = () => {
    const printContent = {
      title: 'Encounter Summary',
      sections: [
        {
          title: 'Encounter Information',
          items: [
            ['Status', encounter.status?.toUpperCase()],
            ['Class', (Array.isArray(encounter.class) 
              ? encounter.class[0]?.coding?.[0]?.display 
              : encounter.class?.display) || encounter.class?.code || 'Unknown'],
            ['Type', encounter.type?.[0]?.text || encounter.type?.[0]?.coding?.[0]?.display || 'Not specified'],
            ['Start Date', startDate ? format(startDate, 'MMM d, yyyy h:mm a') : 'Not recorded'],
            ['End Date', endDate ? format(endDate, 'MMM d, yyyy h:mm a') : 'Not recorded'],
            ['Provider', encounter.participant?.find(p => 
              p.type?.[0]?.coding?.[0]?.code === 'PPRF' || p.type?.[0]?.coding?.[0]?.code === 'ATND'
            )?.actor?.display || encounter.participant?.find(p => 
              p.type?.[0]?.coding?.[0]?.code === 'PPRF' || p.type?.[0]?.coding?.[0]?.code === 'ATND'
            )?.individual?.display || 'No provider recorded']
          ]
        }
      ]
    };

    if ((encounter.reasonCode && encounter.reasonCode.length > 0) || (encounter.reason && encounter.reason.length > 0)) {
      const reasons = encounter.reasonCode || encounter.reason || [];
      printContent.sections.push({
        title: 'Reason for Visit',
        content: reasons.map(r => r.text || r.coding?.[0]?.display || r.use?.[0]?.coding?.[0]?.display).join(', ')
      });
    }

    if (relatedResources.observations?.length > 0) {
      printContent.sections.push({
        title: 'Lab Results & Observations',
        items: relatedResources.observations.map(obs => [
          obs.code?.text || obs.code?.coding?.[0]?.display || 'Unknown test',
          `${obs.valueQuantity ? 
            `${obs.valueQuantity.value} ${obs.valueQuantity.unit || ''}` :
            obs.valueString || 'Result pending'} - ${obs.effectiveDateTime ? 
            format(parseISO(obs.effectiveDateTime), 'MMM d, h:mm a') : 'No date'}`
        ])
      });
    }

    if (relatedResources.procedures?.length > 0) {
      printContent.sections.push({
        title: 'Procedures',
        items: relatedResources.procedures.map(proc => [
          proc.code?.text || proc.code?.coding?.[0]?.display || 'Unknown procedure',
          `Status: ${proc.status} - ${proc.performedDateTime ? 
            format(parseISO(proc.performedDateTime), 'MMM d, h:mm a') : 'No date'}`
        ])
      });
    }

    if (relatedResources.medications?.length > 0) {
      printContent.sections.push({
        title: 'Medications',
        items: relatedResources.medications.map(med => [
          med.medication?.concept?.text || 
          med.medication?.concept?.coding?.[0]?.display || 
          'Unknown medication',
          `Status: ${med.status} - ${med.authoredOn ? 
            format(parseISO(med.authoredOn), 'MMM d, h:mm a') : 'No date'}`
        ])
      });
    }

    if (relatedResources.conditions?.length > 0) {
      printContent.sections.push({
        title: 'Diagnoses & Conditions',
        items: relatedResources.conditions.map(condition => [
          condition.code?.text || condition.code?.coding?.[0]?.display || 'Unknown condition',
          `Status: ${condition.clinicalStatus?.coding?.[0]?.code || 'unknown'} - ${condition.onsetDateTime ? 
            format(parseISO(condition.onsetDateTime), 'MMM d, yyyy') : 'No onset date'}`
        ])
      });
    }

    if (relatedResources.documents?.length > 0) {
      printContent.sections.push({
        title: 'Clinical Notes & Documents',
        items: relatedResources.documents.map(doc => [
          doc.type?.text || doc.type?.coding?.[0]?.display || 'Clinical Note',
          `Status: ${doc.docStatus || doc.status || 'draft'} - ${doc.date ? 
            format(parseISO(doc.date), 'MMM d, h:mm a') : 'No date'}${doc.authenticator ? ` - Signed by: ${doc.authenticator.display || 'Provider'}` : ''}`
        ])
      });
    }

    printDocument({
      title: 'Encounter Summary',
      patient: {
        name: `Patient ${patientId}`,
        mrn: patientId
      },
      content: printContent.sections.map(section => {
        if (section.items) {
          return `<h3>${section.title}</h3>` + 
            section.items.map(([label, value]) => `<p><strong>${label}:</strong> ${value}</p>`).join('');
        } else if (section.content) {
          return `<h3>${section.title}</h3><p>${section.content}</p>`;
        }
        return '';
      }).join('\n')
    });
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
      <DialogTitle sx={{ 
        background: theme.palette.mode === 'dark' 
          ? `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.background.paper} 100%)`
          : `linear-gradient(135deg, ${theme.palette.primary.light} 0%, ${theme.palette.background.paper} 100%)`,
        borderBottom: `1px solid ${theme.palette.divider}`
      }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={2} alignItems="center">
            <Box sx={{ 
              p: 1.5, 
              borderRadius: 2, 
              bgcolor: theme.palette.background.paper,
              color: iconInfo.color === 'primary' ? theme.palette.primary.main : theme.palette[iconInfo.color].main,
              boxShadow: theme.shadows[1]
            }}>
              {iconInfo.icon}
            </Box>
            <Box>
              <Typography variant="h5" fontWeight="bold">
                Encounter Summary
              </Typography>
              <Typography variant="subtitle1" color="text.secondary">
                {encounter.type?.[0]?.text || encounter.type?.[0]?.coding?.[0]?.display || encounter.class?.display || 'Encounter'}
              </Typography>
            </Box>
          </Stack>
          <IconButton onClick={onClose} edge="end" sx={{ color: theme.palette.text.primary }}>
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        <Box sx={{ p: 3 }}>
          {/* Encounter Details */}
          <Paper sx={{ 
            p: 3, 
            mb: 3,
            borderRadius: 2,
            background: theme.palette.mode === 'dark' 
              ? theme.palette.background.paper 
              : theme.palette.grey[50],
            boxShadow: theme.shadows[1]
          }}>
            <Stack direction="row" alignItems="center" spacing={2} mb={3}>
              <Box sx={{ 
                width: 6, 
                height: 40, 
                borderRadius: 1,
                bgcolor: iconInfo.color === 'primary' ? theme.palette.primary.main : theme.palette[iconInfo.color].main 
              }} />
              <Typography variant="h6" fontWeight="600">
                Encounter Information
              </Typography>
            </Stack>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1 }}>
                      Status
                    </Typography>
                    <Box sx={{ mt: 0.5 }}>
                      <Zoom in={true} style={{ transitionDelay: '100ms' }}>
                        <Chip 
                          label={encounter.status?.toUpperCase()} 
                          size="medium" 
                          color={getStatusColor(encounter.status)}
                          sx={{ fontWeight: 'bold' }}
                        />
                      </Zoom>
                    </Box>
                  </Box>
                  
                  <Box>
                    <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1 }}>
                      Class
                    </Typography>
                    <Typography variant="body1" fontWeight="500">
                      {(Array.isArray(encounter.class) 
                        ? encounter.class[0]?.coding?.[0]?.display 
                        : encounter.class?.display) || encounter.class?.code || 'Unknown'}
                    </Typography>
                  </Box>

                  <Box>
                    <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1 }}>
                      Type
                    </Typography>
                    <Typography variant="body1" fontWeight="500">
                      {encounter.type?.[0]?.text || encounter.type?.[0]?.coding?.[0]?.display || 'Not specified'}
                    </Typography>
                  </Box>
                </Stack>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <Stack spacing={2}>
                  {startDate && (
                    <Box>
                      <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1 }}>
                        Start Date & Time
                      </Typography>
                      <Typography variant="body1" fontWeight="500">
                        {format(startDate, 'MMM d, yyyy h:mm a')}
                      </Typography>
                    </Box>
                  )}
                  
                  {endDate && (
                    <Box>
                      <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1 }}>
                        End Date & Time
                      </Typography>
                      <Typography variant="body1" fontWeight="500">
                        {format(endDate, 'MMM d, yyyy h:mm a')}
                      </Typography>
                    </Box>
                  )}

                  {!endDate && startDate && (
                    <Box>
                      <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1 }}>
                        Duration
                      </Typography>
                      <Typography variant="body1" fontWeight="500">
                        {encounter.status === 'in-progress' ? 'Ongoing' : 'Not specified'}
                      </Typography>
                    </Box>
                  )}

                  <Box>
                    <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1 }}>
                      Provider
                    </Typography>
                    <Typography variant="body1" fontWeight="500">
                      {encounter.participant?.find(p => 
                        p.type?.[0]?.coding?.[0]?.code === 'PPRF' || p.type?.[0]?.coding?.[0]?.code === 'ATND'
                      )?.actor?.display || encounter.participant?.find(p => 
                        p.type?.[0]?.coding?.[0]?.code === 'PPRF' || p.type?.[0]?.coding?.[0]?.code === 'ATND'
                      )?.individual?.display || 'No provider recorded'}
                    </Typography>
                  </Box>
                </Stack>
              </Grid>
            </Grid>

            {((encounter.reasonCode && encounter.reasonCode.length > 0) || (encounter.reason && encounter.reason.length > 0)) && (
              <Box sx={{ 
                mt: 3, 
                pt: 3,
                borderTop: `1px solid ${theme.palette.divider}`
              }}>
                <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1 }}>
                  Reason for Visit
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1 }}>
                  {(encounter.reasonCode || encounter.reason || []).map((reason, idx) => (
                    <Chip 
                      key={idx}
                      label={reason.text || reason.coding?.[0]?.display || reason.use?.[0]?.coding?.[0]?.display} 
                      variant="filled"
                      sx={{ 
                        bgcolor: theme.palette.primary.main + '15',
                        color: theme.palette.primary.main,
                        fontWeight: 500
                      }}
                    />
                  ))}
                </Stack>
              </Box>
            )}
          </Paper>

          {/* Related Resources */}
          <Box sx={{ 
            mb: 3,
            p: 3,
            background: theme.palette.mode === 'dark'
              ? `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${theme.palette.background.default} 100%)`
              : `linear-gradient(135deg, ${theme.palette.grey[50]} 0%, ${theme.palette.background.paper} 100%)`,
            borderRadius: 2
          }}>
            <Stack direction="row" alignItems="center" spacing={2} mb={3}>
              <Box sx={{ 
                width: 6, 
                height: 40, 
                borderRadius: 1,
                bgcolor: theme.palette.secondary.main 
              }} />
              <Typography variant="h6" fontWeight="600">
                Related Clinical Information
              </Typography>
            </Stack>

            {/* Observations */}
            <Card sx={{ 
              mb: 2,
              borderRadius: 2,
              overflow: 'hidden',
              boxShadow: theme.shadows[2],
              '&:hover': {
                boxShadow: theme.shadows[4]
              },
              transition: 'box-shadow 0.3s ease'
            }}>
              <CardHeader
                sx={{
                  background: theme.palette.mode === 'dark'
                    ? theme.palette.background.paper
                    : theme.palette.grey[100],
                  borderBottom: `1px solid ${theme.palette.divider}`
                }}
                title={
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Box sx={{ 
                      p: 1, 
                      borderRadius: 1.5,
                      bgcolor: theme.palette.primary.main + '20',
                      color: theme.palette.primary.main,
                      display: 'flex',
                      alignItems: 'center'
                    }}>
                      <LabIcon />
                    </Box>
                    <Box>
                      <Typography variant="subtitle1" fontWeight="600">
                        Lab Results & Observations
                      </Typography>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip 
                          label={`${relatedResources.observations?.length || 0} items`} 
                          size="small" 
                          color={relatedResources.observations?.length > 0 ? 'primary' : 'default'}
                          sx={{ fontWeight: 'medium' }}
                        />
                        {relatedResources.observations?.length > 0 && (
                          <Typography variant="caption" color="text.secondary">
                            Click to {expandedSections.observations ? 'collapse' : 'expand'}
                          </Typography>
                        )}
                      </Stack>
                    </Box>
                  </Stack>
                }
                action={
                  relatedResources.observations?.length > 0 && (
                    <IconButton 
                      onClick={() => toggleSection('observations')}
                      sx={{
                        bgcolor: theme.palette.action.hover,
                        '&:hover': {
                          bgcolor: theme.palette.action.selected
                        }
                      }}
                    >
                      {expandedSections.observations ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  )
                }
              />
            <Collapse in={expandedSections.observations}>
              <CardContent>
                {relatedResources.observations?.length > 0 ? (
                  <List sx={{ py: 0 }}>
                    {relatedResources.observations.map((obs, index) => (
                      <ListItem 
                        key={obs.id}
                        sx={{
                          borderBottom: index < relatedResources.observations.length - 1 ? `1px solid ${theme.palette.divider}` : 'none',
                          '&:hover': {
                            bgcolor: theme.palette.action.hover
                          }
                        }}
                      >
                        <ListItemText
                          primary={
                            <Typography variant="body1" fontWeight="500">
                              {obs.code?.text || obs.code?.coding?.[0]?.display || 'Unknown test'}
                            </Typography>
                          }
                          secondary={
                            <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 0.5 }}>
                              <Chip
                                label={obs.valueQuantity ? 
                                  `${obs.valueQuantity.value} ${obs.valueQuantity.unit || ''}` :
                                  obs.valueString || 'Result pending'}
                                size="small"
                                color={obs.interpretation?.[0]?.coding?.[0]?.code === 'H' ? 'error' : 
                                       obs.interpretation?.[0]?.coding?.[0]?.code === 'L' ? 'warning' : 'default'}
                                variant="outlined"
                                sx={{ fontWeight: 'medium' }}
                              />
                              <Typography variant="caption" color="text.secondary">
                                {obs.effectiveDateTime ? 
                                  format(parseISO(obs.effectiveDateTime), 'MMM d, h:mm a') : 'No date'}
                              </Typography>
                            </Stack>
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                ) : (
                  <Box sx={{ 
                    p: 4, 
                    textAlign: 'center',
                    bgcolor: theme.palette.mode === 'dark' ? theme.palette.grey[900] : theme.palette.grey[50],
                    borderRadius: 1
                  }}>
                    <LabIcon sx={{ fontSize: 48, color: theme.palette.text.disabled, mb: 2 }} />
                    <Typography variant="body1" color="text.secondary">
                      No lab results or observations recorded
                    </Typography>
                    <Typography variant="caption" color="text.disabled">
                      Lab results from this encounter will appear here
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Collapse>
          </Card>

            {/* Procedures */}
            <Card sx={{ 
              mb: 2,
              borderRadius: 2,
              overflow: 'hidden',
              boxShadow: theme.shadows[2],
              '&:hover': {
                boxShadow: theme.shadows[4]
              },
              transition: 'box-shadow 0.3s ease'
            }}>
              <CardHeader
                sx={{
                  background: theme.palette.mode === 'dark'
                    ? theme.palette.background.paper
                    : theme.palette.grey[100],
                  borderBottom: `1px solid ${theme.palette.divider}`
                }}
                title={
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Box sx={{ 
                      p: 1, 
                      borderRadius: 1.5,
                      bgcolor: theme.palette.secondary.main + '20',
                      color: theme.palette.secondary.main,
                      display: 'flex',
                      alignItems: 'center'
                    }}>
                      <ProcedureIcon />
                    </Box>
                    <Box>
                      <Typography variant="subtitle1" fontWeight="600">
                        Procedures
                      </Typography>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip 
                          label={`${relatedResources.procedures?.length || 0} items`} 
                          size="small" 
                          color={relatedResources.procedures?.length > 0 ? 'secondary' : 'default'}
                          sx={{ fontWeight: 'medium' }}
                        />
                        {relatedResources.procedures?.length > 0 && (
                          <Typography variant="caption" color="text.secondary">
                            Click to {expandedSections.procedures ? 'collapse' : 'expand'}
                          </Typography>
                        )}
                      </Stack>
                    </Box>
                  </Stack>
                }
                action={
                  relatedResources.procedures?.length > 0 && (
                    <IconButton 
                      onClick={() => toggleSection('procedures')}
                      sx={{
                        bgcolor: theme.palette.action.hover,
                        '&:hover': {
                          bgcolor: theme.palette.action.selected
                        }
                      }}
                    >
                      {expandedSections.procedures ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  )
                }
              />
            <Collapse in={expandedSections.procedures}>
              <CardContent>
                {relatedResources.procedures?.length > 0 ? (
                  <List sx={{ py: 0 }}>
                    {relatedResources.procedures.map((proc, index) => (
                      <ListItem 
                        key={proc.id}
                        sx={{
                          borderBottom: index < relatedResources.procedures.length - 1 ? `1px solid ${theme.palette.divider}` : 'none',
                          '&:hover': {
                            bgcolor: theme.palette.action.hover
                          }
                        }}
                      >
                        <ListItemText
                          primary={
                            <Typography variant="body1" fontWeight="500">
                              {proc.code?.text || proc.code?.coding?.[0]?.display || 'Unknown procedure'}
                            </Typography>
                          }
                          secondary={
                            <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 0.5 }}>
                              <Chip
                                label={proc.status}
                                size="small"
                                color={proc.status === 'completed' ? 'success' : 
                                       proc.status === 'in-progress' ? 'warning' : 'default'}
                                variant="outlined"
                                sx={{ fontWeight: 'medium', textTransform: 'capitalize' }}
                              />
                              <Typography variant="caption" color="text.secondary">
                                {proc.performedDateTime ? 
                                  format(parseISO(proc.performedDateTime), 'MMM d, h:mm a') : 'No date'}
                              </Typography>
                            </Stack>
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                ) : (
                  <Box sx={{ 
                    p: 4, 
                    textAlign: 'center',
                    bgcolor: theme.palette.mode === 'dark' ? theme.palette.grey[900] : theme.palette.grey[50],
                    borderRadius: 1
                  }}>
                    <ProcedureIcon sx={{ fontSize: 48, color: theme.palette.text.disabled, mb: 2 }} />
                    <Typography variant="body1" color="text.secondary">
                      No procedures recorded
                    </Typography>
                    <Typography variant="caption" color="text.disabled">
                      Procedures performed during this encounter will appear here
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Collapse>
          </Card>

            {/* Medications */}
            <Card sx={{ 
              mb: 2,
              borderRadius: 2,
              overflow: 'hidden',
              boxShadow: theme.shadows[2],
              '&:hover': {
                boxShadow: theme.shadows[4]
              },
              transition: 'box-shadow 0.3s ease'
            }}>
              <CardHeader
                sx={{
                  background: theme.palette.mode === 'dark'
                    ? theme.palette.background.paper
                    : theme.palette.grey[100],
                  borderBottom: `1px solid ${theme.palette.divider}`
                }}
                title={
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Box sx={{ 
                      p: 1, 
                      borderRadius: 1.5,
                      bgcolor: theme.palette.success.main + '20',
                      color: theme.palette.success.main,
                      display: 'flex',
                      alignItems: 'center'
                    }}>
                      <MedicationIcon />
                    </Box>
                    <Box>
                      <Typography variant="subtitle1" fontWeight="600">
                        Medications
                      </Typography>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip 
                          label={`${relatedResources.medications?.length || 0} items`} 
                          size="small" 
                          color={relatedResources.medications?.length > 0 ? 'success' : 'default'}
                          sx={{ fontWeight: 'medium' }}
                        />
                        {relatedResources.medications?.length > 0 && (
                          <Typography variant="caption" color="text.secondary">
                            Click to {expandedSections.medications ? 'collapse' : 'expand'}
                          </Typography>
                        )}
                      </Stack>
                    </Box>
                  </Stack>
                }
                action={
                  relatedResources.medications?.length > 0 && (
                    <IconButton 
                      onClick={() => toggleSection('medications')}
                      sx={{
                        bgcolor: theme.palette.action.hover,
                        '&:hover': {
                          bgcolor: theme.palette.action.selected
                        }
                      }}
                    >
                      {expandedSections.medications ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  )
                }
              />
            <Collapse in={expandedSections.medications}>
              <CardContent>
                {relatedResources.medications?.length > 0 ? (
                  <List sx={{ py: 0 }}>
                    {relatedResources.medications.map((med, index) => (
                      <ListItem 
                        key={med.id}
                        sx={{
                          borderBottom: index < relatedResources.medications.length - 1 ? `1px solid ${theme.palette.divider}` : 'none',
                          '&:hover': {
                            bgcolor: theme.palette.action.hover
                          }
                        }}
                      >
                        <ListItemText
                          primary={
                            <Typography variant="body1" fontWeight="500">
                              {med.medication?.concept?.text || 
                               med.medication?.concept?.coding?.[0]?.display || 
                               'Unknown medication'}
                            </Typography>
                          }
                          secondary={
                            <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 0.5 }}>
                              <Chip
                                label={med.status}
                                size="small"
                                color={med.status === 'active' ? 'success' : 
                                       med.status === 'on-hold' ? 'warning' : 
                                       med.status === 'stopped' ? 'error' : 'default'}
                                variant="outlined"
                                sx={{ fontWeight: 'medium', textTransform: 'capitalize' }}
                              />
                              <Typography variant="caption" color="text.secondary">
                                {getMedicationDosageDisplay(med)}
                                {(() => {
                                  const route = getMedicationRoute(med);
                                  return route ? ` • Route: ${route}` : '';
                                })()}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {med.authoredOn ? 
                                  format(parseISO(med.authoredOn), 'MMM d, h:mm a') : 'No date'}
                              </Typography>
                            </Stack>
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                ) : (
                  <Box sx={{ 
                    p: 4, 
                    textAlign: 'center',
                    bgcolor: theme.palette.mode === 'dark' ? theme.palette.grey[900] : theme.palette.grey[50],
                    borderRadius: 1
                  }}>
                    <MedicationIcon sx={{ fontSize: 48, color: theme.palette.text.disabled, mb: 2 }} />
                    <Typography variant="body1" color="text.secondary">
                      No medications prescribed
                    </Typography>
                    <Typography variant="caption" color="text.disabled">
                      Medications prescribed during this encounter will appear here
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Collapse>
          </Card>

            {/* Diagnoses */}
            <Card sx={{ 
              borderRadius: 2,
              overflow: 'hidden',
              boxShadow: theme.shadows[2],
              '&:hover': {
                boxShadow: theme.shadows[4]
              },
              transition: 'box-shadow 0.3s ease'
            }}>
              <CardHeader
                sx={{
                  background: theme.palette.mode === 'dark'
                    ? theme.palette.background.paper
                    : theme.palette.grey[100],
                  borderBottom: `1px solid ${theme.palette.divider}`
                }}
                title={
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Box sx={{ 
                      p: 1, 
                      borderRadius: 1.5,
                      bgcolor: theme.palette.warning.main + '20',
                      color: theme.palette.warning.main,
                      display: 'flex',
                      alignItems: 'center'
                    }}>
                      <DiagnosisIcon />
                    </Box>
                    <Box>
                      <Typography variant="subtitle1" fontWeight="600">
                        Diagnoses & Conditions
                      </Typography>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip 
                          label={`${relatedResources.conditions?.length || 0} items`} 
                          size="small" 
                          color={relatedResources.conditions?.length > 0 ? 'warning' : 'default'}
                          sx={{ fontWeight: 'medium' }}
                        />
                        {relatedResources.conditions?.length > 0 && (
                          <Typography variant="caption" color="text.secondary">
                            Click to {expandedSections.diagnoses ? 'collapse' : 'expand'}
                          </Typography>
                        )}
                      </Stack>
                    </Box>
                  </Stack>
                }
                action={
                  relatedResources.conditions?.length > 0 && (
                    <IconButton 
                      onClick={() => toggleSection('diagnoses')}
                      sx={{
                        bgcolor: theme.palette.action.hover,
                        '&:hover': {
                          bgcolor: theme.palette.action.selected
                        }
                      }}
                    >
                      {expandedSections.diagnoses ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  )
                }
              />
            <Collapse in={expandedSections.diagnoses}>
              <CardContent>
                {relatedResources.conditions?.length > 0 ? (
                  <List sx={{ py: 0 }}>
                    {relatedResources.conditions.map((condition, index) => (
                      <ListItem 
                        key={condition.id}
                        sx={{
                          borderBottom: index < relatedResources.conditions.length - 1 ? `1px solid ${theme.palette.divider}` : 'none',
                          '&:hover': {
                            bgcolor: theme.palette.action.hover
                          }
                        }}
                      >
                        <ListItemText
                          primary={
                            <Typography variant="body1" fontWeight="500">
                              {condition.code?.text || condition.code?.coding?.[0]?.display || 'Unknown condition'}
                            </Typography>
                          }
                          secondary={
                            <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 0.5 }}>
                              <Chip
                                label={condition.clinicalStatus?.coding?.[0]?.code || 'unknown'}
                                size="small"
                                color={condition.clinicalStatus?.coding?.[0]?.code === 'active' ? 'error' : 
                                       condition.clinicalStatus?.coding?.[0]?.code === 'resolved' ? 'success' : 'default'}
                                variant="outlined"
                                sx={{ fontWeight: 'medium', textTransform: 'capitalize' }}
                              />
                              {condition.severity?.coding?.[0]?.display && (
                                <Chip
                                  label={condition.severity.coding[0].display}
                                  size="small"
                                  variant="outlined"
                                  color="secondary"
                                />
                              )}
                              <Typography variant="caption" color="text.secondary">
                                {condition.onsetDateTime ? 
                                  `Onset: ${format(parseISO(condition.onsetDateTime), 'MMM d, yyyy')}` : 'No onset date'}
                              </Typography>
                            </Stack>
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                ) : (
                  <Box sx={{ 
                    p: 4, 
                    textAlign: 'center',
                    bgcolor: theme.palette.mode === 'dark' ? theme.palette.grey[900] : theme.palette.grey[50],
                    borderRadius: 1
                  }}>
                    <DiagnosisIcon sx={{ fontSize: 48, color: theme.palette.text.disabled, mb: 2 }} />
                    <Typography variant="body1" color="text.secondary">
                      No diagnoses or conditions recorded
                    </Typography>
                    <Typography variant="caption" color="text.disabled">
                      Diagnoses made during this encounter will appear here
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Collapse>
          </Card>

          {/* Clinical Notes & Documents */}
          <Card sx={{ 
            mt: 2,
            borderRadius: 2,
            overflow: 'hidden',
            boxShadow: theme.shadows[2],
            '&:hover': {
              boxShadow: theme.shadows[4]
            },
            transition: 'box-shadow 0.3s ease'
          }}>
            <CardHeader
              sx={{
                background: theme.palette.mode === 'dark'
                  ? theme.palette.background.paper
                  : theme.palette.grey[100],
                borderBottom: `1px solid ${theme.palette.divider}`
              }}
              title={
                <Stack direction="row" spacing={2} alignItems="center">
                  <Box sx={{ 
                    p: 1, 
                    borderRadius: 1.5,
                    bgcolor: theme.palette.info.main + '20',
                    color: theme.palette.info.main,
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    <DocumentIcon />
                  </Box>
                  <Box>
                    <Typography variant="subtitle1" fontWeight="600">
                      Clinical Notes & Documents
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip 
                        label={`${relatedResources.documents?.length || 0} items`} 
                        size="small" 
                        color={relatedResources.documents?.length > 0 ? 'info' : 'default'}
                        sx={{ fontWeight: 'medium' }}
                      />
                      {relatedResources.documents?.length > 0 && (
                        <Typography variant="caption" color="text.secondary">
                          Click to {expandedSections.documents ? 'collapse' : 'expand'}
                        </Typography>
                      )}
                    </Stack>
                  </Box>
                </Stack>
              }
              action={
                relatedResources.documents?.length > 0 && (
                  <IconButton 
                    onClick={() => toggleSection('documents')}
                    sx={{
                      bgcolor: theme.palette.action.hover,
                      '&:hover': {
                        bgcolor: theme.palette.action.selected
                      }
                    }}
                  >
                    {expandedSections.documents ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </IconButton>
                )
              }
            />
          <Collapse in={expandedSections.documents}>
            <CardContent>
              {relatedResources.documents?.length > 0 ? (
                <List sx={{ py: 0 }}>
                  {relatedResources.documents.map((doc, index) => (
                    <ListItem 
                      key={doc.id}
                      sx={{
                        borderBottom: index < relatedResources.documents.length - 1 ? `1px solid ${theme.palette.divider}` : 'none',
                        '&:hover': {
                          bgcolor: theme.palette.action.hover
                        }
                      }}
                    >
                      <ListItemText
                        primary={
                          <Typography variant="body1" fontWeight="500">
                            {doc.type?.text || 
                             doc.type?.coding?.[0]?.display || 
                             'Clinical Note'}
                          </Typography>
                        }
                        secondary={
                          <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 0.5 }}>
                            <Chip
                              label={doc.docStatus || doc.status || 'draft'}
                              size="small"
                              color={doc.docStatus === 'final' ? 'success' : 
                                     doc.docStatus === 'preliminary' ? 'warning' : 'default'}
                              variant="outlined"
                              sx={{ fontWeight: 'medium', textTransform: 'capitalize' }}
                            />
                            {doc.authenticator && (
                              <Typography variant="caption" color="text.secondary">
                                Signed by: {doc.authenticator.display || 'Provider'}
                              </Typography>
                            )}
                            <Typography variant="caption" color="text.secondary">
                              {doc.date ? 
                                format(parseISO(doc.date), 'MMM d, h:mm a') : 'No date'}
                            </Typography>
                          </Stack>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Box sx={{ 
                  p: 4, 
                  textAlign: 'center',
                  bgcolor: theme.palette.mode === 'dark' ? theme.palette.grey[900] : theme.palette.grey[50],
                  borderRadius: 1
                }}>
                  <DocumentIcon sx={{ fontSize: 48, color: theme.palette.text.disabled, mb: 2 }} />
                  <Typography variant="body1" color="text.secondary">
                    No notes or documents recorded
                  </Typography>
                  <Typography variant="caption" color="text.disabled">
                    Clinical notes created during this encounter will appear here
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Collapse>
        </Card>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ 
        p: 2,
        borderTop: `1px solid ${theme.palette.divider}`,
        bgcolor: theme.palette.mode === 'dark' ? theme.palette.grey[900] : theme.palette.grey[50]
      }}>
        <Stack direction="row" spacing={2} sx={{ width: '100%' }} justifyContent="space-between">
          <Stack direction="row" spacing={1}>
            <Button 
              startIcon={<PrintIcon />} 
              variant="outlined"
              onClick={handlePrint}
              sx={{
                borderColor: theme.palette.divider,
                '&:hover': {
                  bgcolor: theme.palette.action.hover,
                  borderColor: theme.palette.primary.main
                }
              }}
            >
              Print Summary
            </Button>
            <Button 
              startIcon={<ExportIcon />} 
              variant="outlined"
              sx={{
                borderColor: theme.palette.divider,
                '&:hover': {
                  bgcolor: theme.palette.action.hover,
                  borderColor: theme.palette.primary.main
                }
              }}
            >
              Export
            </Button>
          </Stack>
          <Button 
            onClick={onClose} 
            variant="contained"
            sx={{
              px: 4,
              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
              '&:hover': {
                background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
              }
            }}
          >
            Close
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
};

export default EncounterSummaryDialog;