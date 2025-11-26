/**
 * Clinical Cross-References Component
 * Displays bidirectional links between notes and clinical data
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Chip,
  Stack,
  Button,
  IconButton,
  Tooltip,
  Collapse,
  Badge,
  Card,
  CardContent,
  CardActions,
  Divider,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  Link as LinkIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Assignment as ProblemIcon,
  Medication as MedicationIcon,
  Science as LabIcon,
  LocalHospital as ProcedureIcon,
  Assessment as ReportIcon,
  EventNote as EncounterIcon,
  FavoriteBorder as CarePlanIcon,
  Description as DocumentIcon,
  Visibility as ViewIcon,
  AccountTree as NetworkIcon,
  Info as InfoIcon
} from '@mui/icons-material';

import { clinicalCrossReferenceService } from '../../../services/clinicalCrossReferenceService';
import { useClinicalWorkflow } from '../../../contexts/ClinicalWorkflowContext';

const ClinicalCrossReferences = ({ 
  resourceType, 
  resourceId, 
  patientId,
  onNavigate,
  variant = 'inline', // 'inline', 'dialog', 'summary'
  showSummary = true
}) => {
  const [linkedNotes, setLinkedNotes] = useState([]);
  const [linkedData, setLinkedData] = useState(null);
  const [summary, setSummary] = useState(null);
  const [relatedData, setRelatedData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedResource, setSelectedResource] = useState(null);
  const { publish } = useClinicalWorkflow();

  // Load cross-references
  useEffect(() => {
    if (resourceType && resourceId) {
      loadCrossReferences();
    }
  }, [resourceType, resourceId]);

  const loadCrossReferences = useCallback(async () => {
    setLoading(true);
    try {
      const [notes, data, summaryData, related] = await Promise.all([
        resourceType === 'DocumentReference' ? 
          [] : 
          clinicalCrossReferenceService.getLinkedNotes(resourceType, resourceId),
        
        resourceType === 'DocumentReference' ? 
          clinicalCrossReferenceService.getLinkedClinicalData(resourceId) : 
          null,
        
        clinicalCrossReferenceService.getCrossReferenceSummary(resourceType, resourceId),
        
        clinicalCrossReferenceService.findRelatedClinicalData(resourceType, resourceId)
      ]);

      setLinkedNotes(notes);
      setLinkedData(data);
      setSummary(summaryData);
      setRelatedData(related);
    } catch (error) {
      // Error loading cross-references - component will handle gracefully
    } finally {
      setLoading(false);
    }
  }, [resourceType, resourceId]);

  const handleResourceClick = useCallback((resource) => {
    if (onNavigate) {
      onNavigate(resource.resourceType, resource.id);
    } else {
      // Publish navigation event
      publish('NAVIGATE_TO_RESOURCE', {
        resourceType: resource.resourceType,
        resourceId: resource.id,
        patientId,
        source: 'cross-reference'
      });
    }
  }, [onNavigate, publish, patientId]);

  const handleNoteClick = useCallback((note) => {
    if (onNavigate) {
      onNavigate('DocumentReference', note.id);
    } else {
      // Publish navigation event
      publish('NAVIGATE_TO_NOTE', {
        documentId: note.id,
        patientId,
        source: 'cross-reference'
      });
    }
  }, [onNavigate, publish, patientId]);

  const getResourceIcon = (resourceType) => {
    switch (resourceType?.toLowerCase()) {
      case 'condition':
        return <ProblemIcon />;
      case 'medicationrequest':
      case 'medicationstatement':
      case 'medicationdispense':
        return <MedicationIcon />;
      case 'observation':
        return <LabIcon />;
      case 'procedure':
        return <ProcedureIcon />;
      case 'diagnosticreport':
        return <ReportIcon />;
      case 'encounter':
        return <EncounterIcon />;
      case 'careplan':
        return <CarePlanIcon />;
      case 'documentreference':
        return <DocumentIcon />;
      default:
        return <InfoIcon />;
    }
  };

  const getLinkStrengthColor = (strength) => {
    switch (strength) {
      case 'strong':
        return 'success';
      case 'medium':
        return 'warning';
      case 'weak':
        return 'info';
      default:
        return 'default';
    }
  };

  const formatResourceDisplay = (resource) => {
    switch (resource.resourceType) {
      case 'Condition':
        return resource.code?.text || resource.code?.coding?.[0]?.display || 'Unknown condition';
      case 'MedicationRequest':
      case 'MedicationStatement':
        return resource.medicationCodeableConcept?.text || 
               resource.medicationCodeableConcept?.coding?.[0]?.display || 
               'Unknown medication';
      case 'Observation':
        return resource.code?.text || resource.code?.coding?.[0]?.display || 'Unknown test';
      case 'Procedure':
        return resource.code?.text || resource.code?.coding?.[0]?.display || 'Unknown procedure';
      case 'DiagnosticReport':
        return resource.code?.text || resource.code?.coding?.[0]?.display || 'Diagnostic report';
      case 'Encounter':
        return resource.type?.[0]?.text || 'Clinical encounter';
      case 'CarePlan':
        return resource.title || 'Care plan';
      default:
        return 'Clinical resource';
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
        <CircularProgress size={24} sx={{ mr: 1 }} />
        <Typography variant="body2">Loading cross-references...</Typography>
      </Box>
    );
  }

  if (variant === 'summary') {
    return (
      <Card variant="outlined">
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={2}>
            <NetworkIcon color="primary" />
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h6">Cross-References</Typography>
              <Typography variant="body2" color="text.secondary">
                {summary?.totalNotes || 0} linked note(s)
              </Typography>
            </Box>
            {summary?.totalNotes > 0 && (
              <Badge badgeContent={summary.totalNotes} color="primary">
                <LinkIcon />
              </Badge>
            )}
          </Stack>
          
          {summary?.totalNotes > 0 && (
            <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
              <Chip
                label={`${summary.linksByStrength.strong} Strong`}
                size="small"
                color="success"
                variant="outlined"
              />
              <Chip
                label={`${summary.linksByStrength.medium} Medium`}
                size="small"
                color="warning"
                variant="outlined"
              />
              <Chip
                label={`${summary.linksByStrength.weak} Weak`}
                size="small"
                color="info"
                variant="outlined"
              />
            </Stack>
          )}
        </CardContent>
        
        {summary?.totalNotes > 0 && (
          <CardActions>
            <Button
              size="small"
              startIcon={<ViewIcon />}
              onClick={() => setDetailsOpen(true)}
            >
              View Details
            </Button>
          </CardActions>
        )}
      </Card>
    );
  }

  const hasLinkedData = linkedNotes.length > 0 || 
                       (linkedData && Object.values(linkedData).some(arr => arr.length > 0));

  if (!hasLinkedData) {
    return (
      <Alert severity="info" variant="outlined">
        <Typography variant="body2">
          No cross-references found for this {resourceType?.toLowerCase() || 'resource'}.
        </Typography>
      </Alert>
    );
  }

  return (
    <Box>
      <Paper variant="outlined" sx={{ mb: 2 }}>
        <Box
          sx={{
            p: 2,
            backgroundColor: 'primary.light',
            cursor: 'pointer'
          }}
          onClick={() => setExpanded(!expanded)}
        >
          <Stack direction="row" alignItems="center" spacing={1}>
            <NetworkIcon color="primary" />
            <Typography variant="h6" color="primary.main" sx={{ flexGrow: 1 }}>
              Clinical Cross-References
            </Typography>
            <Badge badgeContent={summary?.totalNotes || 0} color="primary">
              <LinkIcon />
            </Badge>
            <IconButton size="small" color="primary">
              {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Stack>
        </Box>

        <Collapse in={expanded}>
          <Box sx={{ p: 2 }}>
            {/* Linked Notes (for non-document resources) */}
            {linkedNotes.length > 0 && (
              <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Stack direction="row" alignItems="center" spacing={2}>
                    <DocumentIcon color="primary" />
                    <Typography variant="subtitle1">
                      Linked Documentation ({linkedNotes.length})
                    </Typography>
                  </Stack>
                </AccordionSummary>
                <AccordionDetails>
                  <List disablePadding>
                    {linkedNotes.map((note, index) => (
                      <ListItem
                        key={note.id}
                        button
                        onClick={() => handleNoteClick(note)}
                        divider={index < linkedNotes.length - 1}
                      >
                        <ListItemIcon>
                          <DocumentIcon />
                        </ListItemIcon>
                        <ListItemText
                          primary={note.description || 'Clinical Note'}
                          secondary={
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                              <Typography variant="caption">
                                {note.date ? new Date(note.date).toLocaleDateString() : 'No date'}
                              </Typography>
                              <Chip
                                label={note.crossReference?.linkType || 'Linked'}
                                size="small"
                                variant="outlined"
                                color={getLinkStrengthColor(note.crossReference?.linkStrength)}
                              />
                            </Stack>
                          }
                        />
                        <ListItemSecondaryAction>
                          <Tooltip title={`Link strength: ${note.crossReference?.linkStrength || 'medium'}`}>
                            <IconButton size="small">
                              <LinkIcon color={getLinkStrengthColor(note.crossReference?.linkStrength)} />
                            </IconButton>
                          </Tooltip>
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                  </List>
                </AccordionDetails>
              </Accordion>
            )}

            {/* Linked Clinical Data (for documents) */}
            {linkedData && (
              <Box>
                {Object.entries(linkedData).map(([dataType, resources]) => (
                  resources.length > 0 && (
                    <Accordion key={dataType}>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Stack direction="row" alignItems="center" spacing={2}>
                          {getResourceIcon(dataType.slice(0, -1))}
                          <Typography variant="subtitle1">
                            {dataType.charAt(0).toUpperCase() + dataType.slice(1)} ({resources.length})
                          </Typography>
                        </Stack>
                      </AccordionSummary>
                      <AccordionDetails>
                        <List disablePadding>
                          {resources.map((resource, index) => (
                            <ListItem
                              key={resource.id}
                              button
                              onClick={() => handleResourceClick(resource)}
                              divider={index < resources.length - 1}
                            >
                              <ListItemIcon>
                                {getResourceIcon(resource.resourceType)}
                              </ListItemIcon>
                              <ListItemText
                                primary={formatResourceDisplay(resource)}
                                secondary={
                                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                                    <Typography variant="caption">
                                      {resource.resourceType}
                                    </Typography>
                                    <Chip
                                      label={resource.crossReference?.linkType || 'Linked'}
                                      size="small"
                                      variant="outlined"
                                      color={getLinkStrengthColor(resource.crossReference?.linkStrength)}
                                    />
                                  </Stack>
                                }
                              />
                              <ListItemSecondaryAction>
                                <Tooltip title={`Link strength: ${resource.crossReference?.linkStrength || 'medium'}`}>
                                  <IconButton size="small">
                                    <LinkIcon color={getLinkStrengthColor(resource.crossReference?.linkStrength)} />
                                  </IconButton>
                                </Tooltip>
                              </ListItemSecondaryAction>
                            </ListItem>
                          ))}
                        </List>
                      </AccordionDetails>
                    </Accordion>
                  )
                ))}
              </Box>
            )}

            {/* Related Clinical Data */}
            {relatedData && Object.values(relatedData).some(arr => arr.length > 0) && (
              <Box sx={{ mt: 2 }}>
                <Divider sx={{ mb: 2 }} />
                <Typography variant="subtitle2" gutterBottom>
                  Indirectly Related Data (via shared documentation):
                </Typography>
                <Grid container spacing={1}>
                  {relatedData.relatedConditions.length > 0 && (
                    <Grid item>
                      <Chip
                        icon={<ProblemIcon />}
                        label={`${relatedData.relatedConditions.length} Conditions`}
                        size="small"
                        variant="outlined"
                        color="primary"
                      />
                    </Grid>
                  )}
                  {relatedData.relatedMedications.length > 0 && (
                    <Grid item>
                      <Chip
                        icon={<MedicationIcon />}
                        label={`${relatedData.relatedMedications.length} Medications`}
                        size="small"
                        variant="outlined"
                        color="secondary"
                      />
                    </Grid>
                  )}
                  {relatedData.relatedObservations.length > 0 && (
                    <Grid item>
                      <Chip
                        icon={<LabIcon />}
                        label={`${relatedData.relatedObservations.length} Results`}
                        size="small"
                        variant="outlined"
                        color="info"
                      />
                    </Grid>
                  )}
                  {relatedData.relatedProcedures.length > 0 && (
                    <Grid item>
                      <Chip
                        icon={<ProcedureIcon />}
                        label={`${relatedData.relatedProcedures.length} Procedures`}
                        size="small"
                        variant="outlined"
                        color="success"
                      />
                    </Grid>
                  )}
                </Grid>
              </Box>
            )}
          </Box>
        </Collapse>
      </Paper>

      {/* Details Dialog */}
      <Dialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={2}>
            <NetworkIcon />
            <Typography variant="h6">
              Cross-Reference Details
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          {summary && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" gutterBottom>
                Summary
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="body2">
                    <strong>Total Notes:</strong> {summary.totalNotes}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2">
                    <strong>Link Distribution:</strong>
                  </Typography>
                  <Typography variant="caption" display="block">
                    Strong: {summary.linksByStrength.strong} | 
                    Medium: {summary.linksByStrength.medium} | 
                    Weak: {summary.linksByStrength.weak}
                  </Typography>
                </Grid>
              </Grid>
              
              {summary.mostRecentNote && (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  <strong>Most Recent:</strong> {summary.mostRecentNote.description} 
                  ({new Date(summary.mostRecentNote.date).toLocaleDateString()})
                </Typography>
              )}
            </Box>
          )}
          
          <Typography variant="body2" color="text.secondary">
            Cross-references help you navigate between related clinical information. 
            Strong links indicate direct relationships, while weak links suggest 
            indirect associations through shared documentation.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ClinicalCrossReferences;