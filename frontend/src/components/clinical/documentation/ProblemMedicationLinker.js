/**
 * Problem and Medication Documentation Linker Component
 * Displays active problems and medications with documentation status
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Collapse,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Chip,
  Stack,
  Alert,
  Tooltip,
  Badge,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  MedicalServices as ProblemIcon,
  Medication as MedicationIcon,
  Description as DocumentIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as CheckIcon,
  Schedule as ClockIcon,
  Assignment as NoteIcon,
  ExpandMore as ExpandMoreIcon,
  Link as LinkIcon,
  Timeline as TimelineIcon
} from '@mui/icons-material';

import { clinicalDocumentationLinkingService } from '../../../services/clinicalDocumentationLinkingService';
import { useClinicalWorkflow } from '../../../contexts/ClinicalWorkflowContext';

const ProblemMedicationLinker = ({ 
  patientId, 
  encounterId,
  onCreateDocumentation,
  className = '' 
}) => {
  const [problems, setProblems] = useState([]);
  const [medications, setMedications] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expandedProblems, setExpandedProblems] = useState(true);
  const [expandedMedications, setExpandedMedications] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const { publish } = useClinicalWorkflow();

  // Load problems and medications with documentation status
  useEffect(() => {
    if (patientId) {
      loadClinicalData();
    }
  }, [patientId]);

  const loadClinicalData = useCallback(async () => {
    setLoading(true);
    try {
      const [problemsData, medicationsData, summaryData] = await Promise.all([
        clinicalDocumentationLinkingService.getActiveProblemsWithDocumentation(patientId),
        clinicalDocumentationLinkingService.getActiveMedicationsWithDocumentation(patientId),
        clinicalDocumentationLinkingService.getDocumentationRequirementsSummary(patientId)
      ]);

      setProblems(problemsData);
      setMedications(medicationsData);
      setSummary(summaryData);
    } catch (error) {
      console.error('Error loading clinical documentation data:', error);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  const handleCreateProblemDocumentation = useCallback(async (problem, templateId) => {
    try {
      // Get suggested template
      const suggestions = clinicalDocumentationLinkingService.getSuggestedTemplatesForProblem(problem);
      const template = suggestions.find(t => t.templateId === templateId) || suggestions[0];

      // Publish workflow event for documentation creation
      await publish('PROBLEM_DOCUMENTATION_REQUESTED', {
        patientId,
        encounterId,
        conditionId: problem.id,
        problemText: problem.code?.text || 'Unknown problem',
        templateId: template.templateId,
        templateTitle: template.title,
        source: 'problem-linker'
      });

      // Call parent handler if provided
      if (onCreateDocumentation) {
        onCreateDocumentation({
          type: 'problem',
          resourceId: problem.id,
          resourceText: problem.code?.text,
          templateId: template.templateId,
          templateTitle: template.title
        });
      }

      // Refresh data
      await loadClinicalData();

    } catch (error) {
      console.error('Error creating problem documentation:', error);
    }
  }, [patientId, encounterId, publish, onCreateDocumentation, loadClinicalData]);

  const handleCreateMedicationDocumentation = useCallback(async (medication, templateId) => {
    try {
      // Get suggested template
      const suggestions = clinicalDocumentationLinkingService.getSuggestedTemplatesForMedication(medication);
      const template = suggestions.find(t => t.templateId === templateId) || suggestions[0];

      // Publish workflow event for documentation creation
      await publish('MEDICATION_DOCUMENTATION_REQUESTED', {
        patientId,
        encounterId,
        medicationId: medication.id,
        medicationText: medication.medicationCodeableConcept?.text || 'Unknown medication',
        templateId: template.templateId,
        templateTitle: template.title,
        source: 'medication-linker'
      });

      // Call parent handler if provided
      if (onCreateDocumentation) {
        onCreateDocumentation({
          type: 'medication',
          resourceId: medication.id,
          resourceText: medication.medicationCodeableConcept?.text,
          templateId: template.templateId,
          templateTitle: template.title
        });
      }

      // Refresh data
      await loadClinicalData();

    } catch (error) {
      console.error('Error creating medication documentation:', error);
    }
  }, [patientId, encounterId, publish, onCreateDocumentation, loadClinicalData]);

  const getUrgencyColor = (needsDoc, severity) => {
    if (!needsDoc) return 'success';
    if (severity === 'high' || severity === 'critical') return 'error';
    if (severity === 'moderate' || severity === 'warning') return 'warning';
    return 'info';
  };

  const getUrgencyIcon = (needsDoc, severity) => {
    if (!needsDoc) return <CheckIcon color="success" />;
    if (severity === 'high' || severity === 'critical') return <ErrorIcon color="error" />;
    if (severity === 'moderate' || severity === 'warning') return <WarningIcon color="warning" />;
    return <ClockIcon color="info" />;
  };

  const formatLastDocumented = (lastDocumented) => {
    if (!lastDocumented) return 'Never documented';
    const date = new Date(lastDocumented);
    const daysAgo = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysAgo === 0) return 'Today';
    if (daysAgo === 1) return 'Yesterday';
    if (daysAgo < 7) return `${daysAgo} days ago`;
    if (daysAgo < 30) return `${Math.floor(daysAgo / 7)} weeks ago`;
    return `${Math.floor(daysAgo / 30)} months ago`;
  };

  if (loading) {
    return (
      <Box className={className}>
        <Typography>Loading clinical documentation data...</Typography>
      </Box>
    );
  }

  return (
    <Box className={className}>
      {/* Summary Alert */}
      {summary && (summary.problemsNeedingDocumentation > 0 || summary.medicationsNeedingDocumentation > 0) && (
        <Alert 
          severity={summary.urgentItems.length > 0 ? 'error' : 'warning'} 
          sx={{ mb: 2 }}
          icon={<DocumentIcon />}
        >
          <Typography variant="subtitle2" gutterBottom>
            Documentation Required
          </Typography>
          <Typography variant="body2">
            {summary.problemsNeedingDocumentation} problem(s) and {summary.medicationsNeedingDocumentation} medication(s) need documentation updates.
            {summary.urgentItems.length > 0 && (
              <> <strong>{summary.urgentItems.length} urgent item(s) require immediate attention.</strong></>
            )}
          </Typography>
        </Alert>
      )}

      {/* Active Problems Section */}
      <Accordion expanded={expandedProblems} onChange={() => setExpandedProblems(!expandedProblems)}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Stack direction="row" alignItems="center" spacing={2} sx={{ width: '100%' }}>
            <ProblemIcon color="primary" />
            <Typography variant="h6">Active Problems</Typography>
            <Badge 
              badgeContent={problems.filter(p => p.needsDocumentation).length} 
              color="warning"
            >
              <Chip 
                label={`${problems.length} active`} 
                size="small" 
                color="primary"
                variant="outlined"
              />
            </Badge>
          </Stack>
        </AccordionSummary>
        
        <AccordionDetails>
          <List disablePadding>
            {problems.map((problem, index) => (
              <React.Fragment key={problem.id}>
                <ListItem
                  sx={{
                    border: '1px solid',
                    borderColor: problem.needsDocumentation ? 
                      getUrgencyColor(true, problem.severity) + '.light' : 'divider',
                    borderRadius: 1,
                    mb: 1,
                    backgroundColor: problem.needsDocumentation ? 
                      getUrgencyColor(true, problem.severity) + '.light' : 'background.default',
                    opacity: 0.9
                  }}
                >
                  <ListItemIcon>
                    {getUrgencyIcon(problem.needsDocumentation, problem.severity)}
                  </ListItemIcon>
                  
                  <ListItemText
                    primary={
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Typography variant="subtitle2">
                          {problem.code?.text || 'Unknown condition'}
                        </Typography>
                        <Chip 
                          label={problem.severity || 'unknown'} 
                          size="small" 
                          color={getUrgencyColor(false, problem.severity)}
                          variant="outlined"
                        />
                      </Stack>
                    }
                    secondary={
                      <Box sx={{ mt: 1 }}>
                        <Stack direction="row" spacing={2}>
                          <Typography variant="caption">
                            Last documented: {formatLastDocumented(problem.lastDocumented)}
                          </Typography>
                          <Typography variant="caption">
                            {problem.documentation.length} note(s)
                          </Typography>
                          {problem.relatedOrders.length > 0 && (
                            <Typography variant="caption">
                              {problem.relatedOrders.length} order(s)
                            </Typography>
                          )}
                          {problem.relatedResults.length > 0 && (
                            <Typography variant="caption">
                              {problem.relatedResults.length} result(s)
                            </Typography>
                          )}
                        </Stack>
                      </Box>
                    }
                  />

                  <ListItemSecondaryAction>
                    <Stack direction="row" spacing={1}>
                      {problem.documentation.length > 0 && (
                        <Tooltip title="View documentation">
                          <IconButton size="small">
                            <TimelineIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                      
                      <Tooltip title="Create documentation">
                        <Button
                          size="small"
                          variant={problem.needsDocumentation ? "contained" : "outlined"}
                          color={getUrgencyColor(problem.needsDocumentation, problem.severity)}
                          startIcon={<NoteIcon />}
                          onClick={() => handleCreateProblemDocumentation(problem, 'progress')}
                        >
                          Document
                        </Button>
                      </Tooltip>
                    </Stack>
                  </ListItemSecondaryAction>
                </ListItem>
                
                {index < problems.length - 1 && <Divider sx={{ my: 1 }} />}
              </React.Fragment>
            ))}
            
            {problems.length === 0 && (
              <ListItem>
                <ListItemText 
                  primary="No active problems found"
                  secondary="Patient has no documented active conditions"
                />
              </ListItem>
            )}
          </List>
        </AccordionDetails>
      </Accordion>

      {/* Active Medications Section */}
      <Accordion 
        expanded={expandedMedications} 
        onChange={() => setExpandedMedications(!expandedMedications)}
        sx={{ mt: 2 }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Stack direction="row" alignItems="center" spacing={2} sx={{ width: '100%' }}>
            <MedicationIcon color="primary" />
            <Typography variant="h6">Active Medications</Typography>
            <Badge 
              badgeContent={medications.filter(m => m.needsDocumentation).length} 
              color="warning"
            >
              <Chip 
                label={`${medications.length} active`} 
                size="small" 
                color="primary"
                variant="outlined"
              />
            </Badge>
          </Stack>
        </AccordionSummary>
        
        <AccordionDetails>
          <List disablePadding>
            {medications.map((medication, index) => (
              <React.Fragment key={medication.id}>
                <ListItem
                  sx={{
                    border: '1px solid',
                    borderColor: medication.needsDocumentation ? 
                      getUrgencyColor(true, medication.riskLevel) + '.light' : 'divider',
                    borderRadius: 1,
                    mb: 1,
                    backgroundColor: medication.needsDocumentation ? 
                      getUrgencyColor(true, medication.riskLevel) + '.light' : 'background.default',
                    opacity: 0.9
                  }}
                >
                  <ListItemIcon>
                    {getUrgencyIcon(medication.needsDocumentation, medication.riskLevel)}
                  </ListItemIcon>
                  
                  <ListItemText
                    primary={
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Typography variant="subtitle2">
                          {medication.medicationCodeableConcept?.text || 'Unknown medication'}
                        </Typography>
                        <Chip 
                          label={medication.riskLevel || 'low'} 
                          size="small" 
                          color={getUrgencyColor(false, medication.riskLevel)}
                          variant="outlined"
                        />
                      </Stack>
                    }
                    secondary={
                      <Box sx={{ mt: 1 }}>
                        <Stack direction="row" spacing={2}>
                          <Typography variant="caption">
                            Last documented: {formatLastDocumented(medication.lastDocumented)}
                          </Typography>
                          <Typography variant="caption">
                            {medication.documentation.length} note(s)
                          </Typography>
                          {medication.monitoringResults.length > 0 && (
                            <Typography variant="caption">
                              {medication.monitoringResults.length} monitoring result(s)
                            </Typography>
                          )}
                        </Stack>
                        {medication.dosageInstruction?.[0]?.text && (
                          <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                            Dosage: {medication.dosageInstruction[0].text}
                          </Typography>
                        )}
                      </Box>
                    }
                  />

                  <ListItemSecondaryAction>
                    <Stack direction="row" spacing={1}>
                      {medication.documentation.length > 0 && (
                        <Tooltip title="View documentation">
                          <IconButton size="small">
                            <TimelineIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                      
                      <Tooltip title="Create documentation">
                        <Button
                          size="small"
                          variant={medication.needsDocumentation ? "contained" : "outlined"}
                          color={getUrgencyColor(medication.needsDocumentation, medication.riskLevel)}
                          startIcon={<NoteIcon />}
                          onClick={() => handleCreateMedicationDocumentation(medication, 'progress')}
                        >
                          Document
                        </Button>
                      </Tooltip>
                    </Stack>
                  </ListItemSecondaryAction>
                </ListItem>
                
                {index < medications.length - 1 && <Divider sx={{ my: 1 }} />}
              </React.Fragment>
            ))}
            
            {medications.length === 0 && (
              <ListItem>
                <ListItemText 
                  primary="No active medications found"
                  secondary="Patient has no documented active medications"
                />
              </ListItem>
            )}
          </List>
        </AccordionDetails>
      </Accordion>

      {/* Quick Actions */}
      {summary && (summary.problemsNeedingDocumentation > 0 || summary.medicationsNeedingDocumentation > 0) && (
        <Paper sx={{ p: 2, mt: 2, backgroundColor: 'primary.light' }}>
          <Typography variant="subtitle2" gutterBottom>
            Quick Actions
          </Typography>
          <Stack direction="row" spacing={2}>
            {summary.problemsNeedingDocumentation > 0 && (
              <Button
                variant="contained"
                size="small"
                startIcon={<ProblemIcon />}
                onClick={() => {
                  const urgentProblem = problems.find(p => p.needsDocumentation);
                  if (urgentProblem) {
                    handleCreateProblemDocumentation(urgentProblem, 'progress');
                  }
                }}
              >
                Document Problem
              </Button>
            )}
            
            {summary.medicationsNeedingDocumentation > 0 && (
              <Button
                variant="contained"
                size="small"
                startIcon={<MedicationIcon />}
                onClick={() => {
                  const urgentMedication = medications.find(m => m.needsDocumentation);
                  if (urgentMedication) {
                    handleCreateMedicationDocumentation(urgentMedication, 'progress');
                  }
                }}
              >
                Document Medication
              </Button>
            )}
          </Stack>
        </Paper>
      )}
    </Box>
  );
};

export default ProblemMedicationLinker;