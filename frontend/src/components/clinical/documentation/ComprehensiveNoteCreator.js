/**
 * Comprehensive Note Creator Component
 * Creates notes that pull from Results and Chart Review tabs
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Chip,
  Stack,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Card,
  CardContent,
  IconButton,
  Tooltip,
  Collapse,
  Grid
} from '@mui/material';
import {
  NoteAdd as CreateNoteIcon,
  Assignment as TemplateIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Assessment as AssessmentIcon,
  Science as LabIcon,
  Medication as MedicationIcon,
  MonitorHeart,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as CheckIcon,
  TrendingUp as TrendIcon,
  Article as DocumentIcon
} from '@mui/icons-material';

import { comprehensiveNoteTemplatesService } from '../../../services/comprehensiveNoteTemplatesService';
import { fhirClient } from '../../../services/fhirClient';
import { useClinicalWorkflow } from '../../../contexts/ClinicalWorkflowContext';

const COMPREHENSIVE_TEMPLATES = [
  {
    id: 'comprehensive-assessment',
    name: 'Comprehensive Assessment',
    description: 'Complete assessment note with all active problems, medications, allergies, and recent results',
    icon: <AssessmentIcon />,
    color: 'primary',
    sections: ['Chief Complaint', 'Review of Systems', 'Physical Exam', 'Active Problems', 'Medications', 'Allergies', 'Recent Results', 'Assessment', 'Plan']
  },
  {
    id: 'results-review',
    name: 'Results Review Note',
    description: 'Focused review of recent lab results, abnormal findings, and clinical correlation',
    icon: <LabIcon />,
    color: 'secondary',
    sections: ['Results Summary', 'Abnormal Results', 'Critical Results', 'Trends', 'Clinical Correlation', 'Follow-up Plan']
  },
  {
    id: 'chronic-care-management',
    name: 'Chronic Care Management',
    description: 'Comprehensive review for patients with chronic conditions including monitoring and care coordination',
    icon: <MonitorHeart />,
    color: 'success',
    sections: ['Chronic Conditions', 'Medication Review', 'Monitoring Results', 'Goal Assessment', 'Care Coordination', 'Plan Adjustments']
  },
  {
    id: 'medication-reconciliation',
    name: 'Medication Reconciliation',
    description: 'Complete medication review including adherence, side effects, and interactions',
    icon: <MedicationIcon />,
    color: 'warning',
    sections: ['Current Medications', 'Medication Changes', 'Adherence Assessment', 'Side Effects Review', 'Drug Interactions', 'Medication Plan']
  },
  {
    id: 'problem-focused',
    name: 'Problem-Focused Note',
    description: 'Focused assessment and plan for specific active problems with related results',
    icon: <TrendIcon />,
    color: 'info',
    sections: ['Primary Problem', 'Related Results', 'Problem Assessment', 'Treatment Response', 'Problem Plan']
  },
  {
    id: 'visit-summary',
    name: 'Visit Summary',
    description: 'Comprehensive visit summary including all reviewed data and decisions made',
    icon: <DocumentIcon />,
    color: 'primary',
    sections: ['Visit Overview', 'Data Reviewed', 'Clinical Decisions', 'Patient Education', 'Follow-up Instructions']
  }
];

const ComprehensiveNoteCreator = ({ 
  patientId, 
  encounterId, 
  onNoteCreated,
  variant = 'dialog', // 'dialog', 'inline', 'card'
  disabled = false 
}) => {
  const [open, setOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [generatedNote, setGeneratedNote] = useState(null);
  const [editableContent, setEditableContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [step, setStep] = useState('select'); // 'select', 'preview', 'edit', 'saving'
  const [error, setError] = useState(null);
  const [patientData, setPatientData] = useState(null);
  const [expandedTemplate, setExpandedTemplate] = useState(null);
  const { publish } = useClinicalWorkflow();

  // Load patient data for preview
  useEffect(() => {
    if (open && patientId) {
      loadPatientDataSummary();
    }
  }, [open, patientId]);

  const loadPatientDataSummary = useCallback(async () => {
    try {
      const data = await comprehensiveNoteTemplatesService.getComprehensivePatientData(patientId);
      setPatientData(data);
    } catch (error) {
      // Error loading patient data - component will handle gracefully
    }
  }, [patientId]);

  const handleTemplateSelect = useCallback((templateId) => {
    setSelectedTemplate(templateId);
    const template = COMPREHENSIVE_TEMPLATES.find(t => t.id === templateId);
    setCustomTitle(template?.name || '');
  }, []);

  const handleGenerateNote = useCallback(async () => {
    if (!selectedTemplate) return;
    
    setIsGenerating(true);
    setError(null);
    
    try {
      const noteData = await comprehensiveNoteTemplatesService.createComprehensiveTemplate(
        selectedTemplate,
        patientId,
        encounterId
      );
      
      if (noteData) {
        setGeneratedNote({
          ...noteData,
          title: customTitle || noteData.template.title
        });
        setEditableContent(noteData.content);
        setStep('preview');
      } else {
        setError('Failed to generate note template');
      }
      
    } catch (error) {
      setError('Failed to generate note. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  }, [selectedTemplate, patientId, encounterId, customTitle]);

  const handleSaveNote = useCallback(async () => {
    if (!generatedNote) return;
    
    setIsSaving(true);
    setError(null);
    
    try {
      // Create DocumentReference
      const documentRef = {
        resourceType: 'DocumentReference',
        status: 'current',
        type: {
          coding: [{
            system: 'http://loinc.org',
            code: generatedNote.metadata.loincCode,
            display: generatedNote.title
          }]
        },
        category: [{
          coding: [{
            system: 'http://hl7.org/fhir/us/core/CodeSystem/us-core-documentreference-category',
            code: 'clinical-note',
            display: 'Clinical Note'
          }]
        }],
        subject: {
          reference: `Patient/${patientId}`,
          display: 'Patient'
        },
        date: new Date().toISOString(),
        author: [{
          reference: 'Practitioner/current-user',
          display: 'Current User'
        }],
        description: generatedNote.title,
        content: [{
          attachment: {
            contentType: 'text/plain',
            data: btoa(editableContent) // Base64 encode content
          }
        }],
        context: encounterId ? {
          encounter: [{ reference: `Encounter/${encounterId}` }]
        } : undefined,
        extension: [
          {
            url: 'http://wintehr.com/fhir/StructureDefinition/comprehensive-note',
            valueBoolean: true
          },
          {
            url: 'http://wintehr.com/fhir/StructureDefinition/template-type',
            valueString: generatedNote.metadata.templateType
          },
          {
            url: 'http://wintehr.com/fhir/StructureDefinition/data-sourced',
            valueBoolean: generatedNote.metadata.dataSourced
          }
        ]
      };

      const created = await fhirClient.create('DocumentReference', documentRef);
      
      // Publish workflow event
      await publish('COMPREHENSIVE_NOTE_CREATED', {
        patientId,
        encounterId,
        documentId: created.id,
        templateType: generatedNote.metadata.templateType,
        templateId: generatedNote.metadata.templateId,
        sections: generatedNote.metadata.sections,
        dataSourced: true
      });

      // Call parent handler
      if (onNoteCreated) {
        onNoteCreated({
          documentRef: created,
          noteData: generatedNote,
          templateType: selectedTemplate
        });
      }

      setStep('saving');
      
      // Close dialog after short delay
      setTimeout(() => {
        handleClose();
      }, 1500);

    } catch (error) {
      setError('Failed to save note. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [generatedNote, editableContent, patientId, encounterId, publish, onNoteCreated, selectedTemplate]);

  const handleClose = useCallback(() => {
    setOpen(false);
    setStep('select');
    setSelectedTemplate('');
    setCustomTitle('');
    setGeneratedNote(null);
    setEditableContent('');
    setError(null);
    setExpandedTemplate(null);
  }, []);

  const getDataSummary = () => {
    if (!patientData) return null;
    
    return {
      activeProblems: patientData.activeProblems.length,
      activeMedications: patientData.activeMedications.length,
      recentResults: patientData.recentResults.length,
      abnormalResults: patientData.abnormalResults.length,
      criticalResults: patientData.criticalResults.length,
      allergies: patientData.allergies.length
    };
  };

  const renderTriggerButton = () => {
    switch (variant) {
      case 'card':
        return (
          <Card sx={{ cursor: 'pointer' }} onClick={() => setOpen(true)}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <TemplateIcon color="primary" />
                <Box>
                  <Typography variant="h6">Comprehensive Notes</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Create notes with data from Results and Chart Review
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        );
      
      case 'inline':
        return (
          <Button
            variant="contained"
            startIcon={<CreateNoteIcon />}
            onClick={() => setOpen(true)}
            disabled={disabled}
            color="primary"
          >
            Create Comprehensive Note
          </Button>
        );
      
      case 'dialog':
      default:
        return (
          <Button
            variant="outlined"
            startIcon={<CreateNoteIcon />}
            onClick={() => setOpen(true)}
            disabled={disabled}
          >
            Comprehensive Note
          </Button>
        );
    }
  };

  const summary = getDataSummary();

  return (
    <>
      {renderTriggerButton()}
      
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: { minHeight: '70vh' }
        }}
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={2}>
            <TemplateIcon color="primary" />
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              Create Comprehensive Clinical Note
            </Typography>
            <IconButton size="small" onClick={handleClose}>
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>

        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {/* Data Summary */}
          {summary && step === 'select' && (
            <Alert severity="info" sx={{ mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Available Patient Data
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6} sm={4}>
                  <Chip
                    icon={<AssessmentIcon />}
                    label={`${summary.activeProblems} Active Problems`}
                    size="small"
                    variant="outlined"
                  />
                </Grid>
                <Grid item xs={6} sm={4}>
                  <Chip
                    icon={<MedicationIcon />}
                    label={`${summary.activeMedications} Medications`}
                    size="small"
                    variant="outlined"
                  />
                </Grid>
                <Grid item xs={6} sm={4}>
                  <Chip
                    icon={<LabIcon />}
                    label={`${summary.recentResults} Recent Results`}
                    size="small"
                    variant="outlined"
                  />
                </Grid>
                <Grid item xs={6} sm={4}>
                  <Chip
                    icon={<WarningIcon />}
                    label={`${summary.abnormalResults} Abnormal`}
                    size="small"
                    variant="outlined"
                    color="warning"
                  />
                </Grid>
                <Grid item xs={6} sm={4}>
                  <Chip
                    icon={<ErrorIcon />}
                    label={`${summary.criticalResults} Critical`}
                    size="small"
                    variant="outlined"
                    color="error"
                  />
                </Grid>
                <Grid item xs={6} sm={4}>
                  <Chip
                    icon={<WarningIcon />}
                    label={`${summary.allergies} Allergies`}
                    size="small"
                    variant="outlined"
                  />
                </Grid>
              </Grid>
            </Alert>
          )}

          {/* Step 1: Template Selection */}
          {step === 'select' && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Select Note Template
              </Typography>
              
              <List>
                {COMPREHENSIVE_TEMPLATES.map((template) => (
                  <React.Fragment key={template.id}>
                    <ListItem
                      button
                      selected={selectedTemplate === template.id}
                      onClick={() => handleTemplateSelect(template.id)}
                      sx={{
                        border: '1px solid',
                        borderColor: selectedTemplate === template.id ? 
                          `${template.color}.main` : 'divider',
                        borderRadius: 1,
                        mb: 1
                      }}
                    >
                      <ListItemIcon>
                        {React.cloneElement(template.icon, { color: template.color })}
                      </ListItemIcon>
                      
                      <ListItemText
                        primary={template.name}
                        secondary={template.description}
                      />
                      
                      <ListItemSecondaryAction>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Chip
                            label={`${template.sections.length} sections`}
                            size="small"
                            variant="outlined"
                          />
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedTemplate(
                                expandedTemplate === template.id ? null : template.id
                              );
                            }}
                          >
                            {expandedTemplate === template.id ? 
                              <ExpandLessIcon /> : <ExpandMoreIcon />}
                          </IconButton>
                        </Stack>
                      </ListItemSecondaryAction>
                    </ListItem>
                    
                    <Collapse in={expandedTemplate === template.id}>
                      <Box sx={{ pl: 4, pr: 2, pb: 2 }}>
                        <Typography variant="subtitle2" gutterBottom>
                          Template Sections:
                        </Typography>
                        <Stack direction="row" spacing={0.5} flexWrap="wrap">
                          {template.sections.map((section, index) => (
                            <Chip
                              key={index}
                              label={section}
                              size="small"
                              variant="outlined"
                              sx={{ mb: 0.5 }}
                            />
                          ))}
                        </Stack>
                      </Box>
                    </Collapse>
                  </React.Fragment>
                ))}
              </List>

              {selectedTemplate && (
                <Box sx={{ mt: 3 }}>
                  <TextField
                    fullWidth
                    label="Custom Note Title (optional)"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="Enter custom title or leave blank for default"
                  />
                </Box>
              )}
            </Box>
          )}

          {/* Step 2: Preview Generated Note */}
          {step === 'preview' && generatedNote && (
            <Box>
              <Alert severity="success" sx={{ mb: 2 }}>
                <Typography variant="subtitle2">
                  Comprehensive Note Generated Successfully
                </Typography>
                <Typography variant="body2">
                  The note has been populated with data from Chart Review and Results tabs. 
                  Review and edit as needed before saving.
                </Typography>
              </Alert>

              <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
                <Chip
                  icon={<TemplateIcon />}
                  label={generatedNote.template.title}
                  color="primary"
                  variant="outlined"
                />
                <Chip
                  label={`${generatedNote.metadata.sections.length} sections`}
                  variant="outlined"
                />
                {generatedNote.metadata.dataSourced && (
                  <Chip
                    icon={<CheckIcon />}
                    label="Data Sourced"
                    color="success"
                    size="small"
                  />
                )}
              </Stack>

              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  maxHeight: 500,
                  overflow: 'auto',
                  backgroundColor: 'grey.50',
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                  fontSize: '0.875rem'
                }}
              >
                {generatedNote.content}
              </Paper>
            </Box>
          )}

          {/* Step 3: Edit Note */}
          {step === 'edit' && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Edit Note Content:
              </Typography>
              <TextField
                multiline
                rows={25}
                fullWidth
                value={editableContent}
                onChange={(e) => setEditableContent(e.target.value)}
                variant="outlined"
                sx={{
                  '& .MuiInputBase-input': {
                    fontFamily: 'monospace',
                    fontSize: '0.875rem'
                  }
                }}
              />
            </Box>
          )}

          {/* Step 4: Saving */}
          {step === 'saving' && (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4 }}>
              <CheckIcon color="success" sx={{ fontSize: 48, mr: 2 }} />
              <Typography variant="h6" color="success.main">
                Comprehensive Note Saved Successfully!
              </Typography>
            </Box>
          )}
        </DialogContent>

        <DialogActions>
          {step === 'select' && (
            <>
              <Button onClick={handleClose}>
                Cancel
              </Button>
              <Button
                variant="contained"
                startIcon={isGenerating ? <CircularProgress size={16} /> : <CreateNoteIcon />}
                onClick={handleGenerateNote}
                disabled={!selectedTemplate || isGenerating}
              >
                {isGenerating ? 'Generating...' : 'Generate Note'}
              </Button>
            </>
          )}

          {step === 'preview' && (
            <>
              <Button onClick={() => setStep('select')}>
                Back to Templates
              </Button>
              <Button
                startIcon={<EditIcon />}
                onClick={() => setStep('edit')}
              >
                Edit Content
              </Button>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleSaveNote}
                disabled={isSaving}
              >
                Save Note
              </Button>
            </>
          )}

          {step === 'edit' && (
            <>
              <Button onClick={() => setStep('preview')}>
                Back to Preview
              </Button>
              <Button
                variant="contained"
                startIcon={isSaving ? <CircularProgress size={16} /> : <SaveIcon />}
                onClick={handleSaveNote}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save Note'}
              </Button>
            </>
          )}

          {step === 'saving' && (
            <Button variant="contained" onClick={handleClose}>
              Done
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ComprehensiveNoteCreator;