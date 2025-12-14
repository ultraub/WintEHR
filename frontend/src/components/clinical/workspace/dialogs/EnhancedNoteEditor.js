/**
 * Enhanced Note Editor Component
 * Integrates with note templates service for comprehensive clinical documentation
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  Snackbar,
  Card,
  CardContent,
  Switch,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  FormatBold as BoldIcon,
  FormatItalic as ItalicIcon,
  FormatUnderlined as UnderlineIcon,
  FormatListBulleted as BulletIcon,
  FormatListNumbered as NumberedIcon,
  AutoAwesome as AutoIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  Save as SaveIcon,
  Draw as SignIcon,
  Close as CloseIcon,
  Assignment as TemplateIcon,
  Visibility as PreviewIcon,
  Share as ShareIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import { useClinicalWorkflow, CLINICAL_EVENTS } from '../../../../contexts/ClinicalWorkflowContext';
import { fhirClient } from '../../../../core/fhir/services/fhirClient';
import { NOTE_TEMPLATES, noteAutoPopulationService } from '../../../../services/noteTemplatesService';
import QualityMeasurePrompts from '../../quality/QualityMeasurePrompts';
import { documentReferenceConverter } from '../../../../core/fhir/converters/DocumentReferenceConverter';

// Template Selection Component
const TemplateSelector = ({ selectedTemplate, onTemplateChange, onLoadTemplate, autoPopulateEnabled, onAutoPopulateToggle }) => {
  const [loading, setLoading] = useState(false);

  const handleTemplateChange = async (templateId) => {
    onTemplateChange(templateId);
    if (autoPopulateEnabled && templateId) {
      setLoading(true);
      await onLoadTemplate(templateId);
      setLoading(false);
    }
  };

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Stack spacing={2}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <TemplateIcon color="primary" />
            <Typography variant="h6">Template Selection</Typography>
          </Box>
          
          <FormControl fullWidth>
            <InputLabel>Note Template</InputLabel>
            <Select
              value={selectedTemplate || ''}
              onChange={(e) => handleTemplateChange(e.target.value)}
              label="Note Template"
            >
              <MenuItem value="">
                <em>Select a template...</em>
              </MenuItem>
              {Object.entries(NOTE_TEMPLATES).map(([key, template]) => (
                <MenuItem key={key} value={key}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip 
                      label={template.label} 
                      color={template.color}
                      size="small"
                    />
                    <Typography variant="body2" color="text.secondary">
                      {template.structure === 'sections' ? 'Structured' : 'Free-form'}
                    </Typography>
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <FormControlLabel
              control={
                <Switch
                  checked={autoPopulateEnabled}
                  onChange={(e) => onAutoPopulateToggle(e.target.checked)}
                />
              }
              label="Auto-populate from patient data"
            />
            
            {selectedTemplate && (
              <Button
                variant="outlined"
                size="small"
                startIcon={loading ? <CircularProgress size={16} /> : <AutoIcon />}
                onClick={() => onLoadTemplate(selectedTemplate)}
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Load Template'}
              </Button>
            )}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
};

// Rich Text Toolbar Component
const RichTextToolbar = ({ formatting, onFormattingChange }) => {
  return (
    <Box sx={{ mb: 1 }}>
      <ToggleButtonGroup
        value={formatting}
        onChange={(e, newFormats) => onFormattingChange(newFormats)}
        aria-label="text formatting"
        size="small"
      >
        <ToggleButton value="bold" aria-label="bold">
          <BoldIcon />
        </ToggleButton>
        <ToggleButton value="italic" aria-label="italic">
          <ItalicIcon />
        </ToggleButton>
        <ToggleButton value="underlined" aria-label="underlined">
          <UnderlineIcon />
        </ToggleButton>
        <ToggleButton value="bullet" aria-label="bullet list">
          <BulletIcon />
        </ToggleButton>
        <ToggleButton value="numbered" aria-label="numbered list">
          <NumberedIcon />
        </ToggleButton>
      </ToggleButtonGroup>
    </Box>
  );
};

// Sectioned Note Editor Component
const SectionedNoteEditor = ({ template, sections, onSectionChange }) => {
  if (!template || template.structure !== 'sections') return null;

  return (
    <Stack spacing={2}>
      {Object.entries(template.sections).map(([sectionKey, sectionConfig]) => (
        <Box key={sectionKey}>
          <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'medium' }}>
            {sectionConfig.label}
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={3}
            value={sections[sectionKey] || ''}
            onChange={(e) => onSectionChange(sectionKey, e.target.value)}
            placeholder={sectionConfig.placeholder}
            variant="outlined"
          />
        </Box>
      ))}
    </Stack>
  );
};

// Auto-Population Preview Component
const AutoPopulationPreview = ({ template, patientId, onApply }) => {
  const [previewData, setPreviewData] = useState(null);
  const [loading, setLoading] = useState(false);

  const generatePreview = useCallback(async () => {
    if (!template || !patientId) return;
    
    setLoading(true);
    try {
      const autoContent = await noteAutoPopulationService.generateTemplateContent(template.id, patientId);
      setPreviewData(autoContent);
    } catch (error) {
      // Auto-population preview failed silently
    } finally {
      setLoading(false);
    }
  }, [template, patientId]);

  useEffect(() => {
    generatePreview();
  }, [generatePreview]);

  if (!template || !template.autoPopulateFields?.length) return null;

  return (
    <Accordion>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <AutoIcon color="primary" />
          <Typography variant="subtitle2">Auto-Population Preview</Typography>
          {loading && <CircularProgress size={16} />}
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            The following data will be auto-populated from the patient's chart:
          </Typography>
          
          <Stack direction="row" flexWrap="wrap" gap={1}>
            {template.autoPopulateFields.map(field => (
              <Chip 
                key={field} 
                label={field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                size="small"
                variant="outlined"
              />
            ))}
          </Stack>

          {previewData && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Preview:</Typography>
              <Paper variant="outlined" sx={{ p: 2, maxHeight: 200, overflow: 'auto' }}>
                {template.structure === 'sections' ? (
                  <Stack spacing={1}>
                    {Object.entries(previewData.sections || {}).map(([key, content]) => (
                      content && (
                        <Box key={key}>
                          <Typography variant="caption" color="primary">
                            {template.sections[key]?.label}:
                          </Typography>
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', ml: 1 }}>
                            {content}
                          </Typography>
                        </Box>
                      )
                    ))}
                  </Stack>
                ) : (
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {previewData.content}
                  </Typography>
                )}
              </Paper>
              
              <Button
                variant="contained"
                size="small"
                startIcon={<AutoIcon />}
                onClick={() => onApply(previewData)}
                sx={{ mt: 1 }}
              >
                Apply Auto-Population
              </Button>
            </Box>
          )}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
};

// Note Sharing Component
const NoteSharing = ({ note, onShare }) => {
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareWith, setShareWith] = useState([]);
  const [shareMessage, setShareMessage] = useState('');
  const [availableProviders, setAvailableProviders] = useState([]);
  const [loading, setLoading] = useState(false);

  // Mock providers for demonstration - in real implementation, fetch from FHIR Practitioner resources
  useEffect(() => {
    setAvailableProviders([
      { id: 'dr-smith', name: 'Dr. Sarah Smith', specialty: 'Internal Medicine' },
      { id: 'dr-jones', name: 'Dr. Michael Jones', specialty: 'Cardiology' },
      { id: 'dr-brown', name: 'Dr. Lisa Brown', specialty: 'Endocrinology' },
      { id: 'nurse-wilson', name: 'Nurse Jennifer Wilson', specialty: 'Primary Care' }
    ]);
  }, []);

  const handleShare = async () => {
    if (shareWith.length === 0) return;
    
    setLoading(true);
    try {
      // In real implementation, this would:
      // 1. Create Communication resource linking to the note
      // 2. Set permissions/access rights
      // 3. Send notifications
      
      const shareData = {
        noteId: note?.id,
        sharedWith: shareWith,
        message: shareMessage,
        timestamp: new Date().toISOString()
      };
      
      await onShare(shareData);
      setShareDialogOpen(false);
      setShareWith([]);
      setShareMessage('');
    } catch (error) {
      // Note sharing failed silently
    } finally {
      setLoading(false);
    }
  };

  if (!note || note.docStatus === 'draft') {
    return null; // Only allow sharing of non-draft notes
  }

  return (
    <>
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack spacing={2}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <ShareIcon color="primary" />
              <Typography variant="h6">Note Sharing</Typography>
            </Box>
            
            <Typography variant="body2" color="text.secondary">
              Share this note with other providers for collaboration and consultation.
            </Typography>
            
            <Button
              variant="outlined"
              startIcon={<ShareIcon />}
              onClick={() => setShareDialogOpen(true)}
              disabled={!note || note.docStatus === 'draft'}
            >
              Share Note
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* Share Dialog */}
      <Dialog open={shareDialogOpen} onClose={() => setShareDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <ShareIcon />
            <Typography variant="h6">Share Clinical Note</Typography>
          </Stack>
        </DialogTitle>
        
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <Alert severity="info">
              Sharing this note will allow selected providers to view and reference it in their clinical workflow.
            </Alert>
            
            <FormControl fullWidth>
              <InputLabel>Select Providers</InputLabel>
              <Select
                multiple
                value={shareWith}
                onChange={(e) => setShareWith(e.target.value)}
                label="Select Providers"
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((providerId) => {
                      const provider = availableProviders.find(p => p.id === providerId);
                      return (
                        <Chip 
                          key={providerId} 
                          label={provider?.name || providerId}
                          size="small"
                          icon={<PersonIcon />}
                        />
                      );
                    })}
                  </Box>
                )}
              >
                {availableProviders.map((provider) => (
                  <MenuItem key={provider.id} value={provider.id}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <PersonIcon fontSize="small" />
                      <Box>
                        <Typography variant="body2">{provider.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {provider.specialty}
                        </Typography>
                      </Box>
                    </Stack>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <TextField
              fullWidth
              label="Message (Optional)"
              multiline
              rows={3}
              value={shareMessage}
              onChange={(e) => setShareMessage(e.target.value)}
              placeholder="Add a message about why you're sharing this note..."
              variant="outlined"
            />
          </Stack>
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setShareDialogOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handleShare}
            disabled={loading || shareWith.length === 0}
            startIcon={loading ? <CircularProgress size={16} /> : <ShareIcon />}
          >
            {loading ? 'Sharing...' : 'Share Note'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

const EnhancedNoteEditor = ({ 
  open, 
  onClose, 
  note, 
  patientId,
  defaultTemplate = null,
  templateData = null,
  encounter = null,
  amendmentMode = false,
  originalNote = null
}) => {
  const { publish } = useClinicalWorkflow();
  const { currentUser } = useFHIRResource();
  
  // State management
  const [selectedTemplate, setSelectedTemplate] = useState(defaultTemplate);
  const [autoPopulateEnabled, setAutoPopulateEnabled] = useState(true);
  const [amendmentReason, setAmendmentReason] = useState('');
  const [noteData, setNoteData] = useState({
    title: '',
    content: '',
    sections: {}
  });
  const [formatting, setFormatting] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [isNonTemplateNote, setIsNonTemplateNote] = useState(false);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open && !note) {
      // New note - initialize with template data if provided
      let initialData = {
        title: '',
        content: '',
        sections: {}
      };
      
      setIsNonTemplateNote(false); // New notes can use templates
      
      // Apply template wizard data if available
      if (templateData) {
        setSelectedTemplate(templateData.templateId);
        
        // Set title and content based on template data
        const template = NOTE_TEMPLATES[templateData.templateId];
        if (template) {
          initialData.title = template.label;
          
          // Add chief complaint to appropriate section if provided
          if (templateData.chiefComplaint) {
            if (template.structure === 'sections') {
              if (template.sections.chiefComplaint) {
                initialData.sections.chiefComplaint = templateData.chiefComplaint;
              } else if (template.sections.subjective) {
                initialData.sections.subjective = `Chief Complaint: ${templateData.chiefComplaint}\n\n`;
              }
            } else {
              initialData.content = `Chief Complaint: ${templateData.chiefComplaint}\n\n`;
            }
          }
          
          // Add visit type context if provided
          if (templateData.visitType) {
            const visitTypeText = `Visit Type: ${templateData.visitType.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}\n`;
            if (template.structure === 'sections' && template.sections.subjective) {
              initialData.sections.subjective = visitTypeText + (initialData.sections.subjective || '');
            } else if (template.structure !== 'sections') {
              initialData.content = visitTypeText + initialData.content;
            }
          }
        }
        
        // Enable auto-population if requested
        if (templateData.autoPopulate && templateData.templateId) {
          setAutoPopulateEnabled(true);
          // Auto-load will be triggered by the template change
        }
      } else {
        setSelectedTemplate(defaultTemplate);
      }
      
      setNoteData(initialData);
    } else if (open && note) {
      // Editing existing note
      const extractedData = extractNoteData(note);
      setNoteData(extractedData);
      setIsNonTemplateNote(extractedData.skipTemplate || false);
      
      // Only set template if it's a template-based note
      if (!extractedData.skipTemplate && extractedData.templateId) {
        setSelectedTemplate(extractedData.templateId);
      } else {
        setSelectedTemplate(null); // No template for plain text notes
      }
    }
  }, [open, note, defaultTemplate, templateData]);

  // Extract data from existing FHIR DocumentReference
  const extractNoteData = (note) => {
    let content = '';
    let sections = {};
    let templateId = null; // Default to null for non-template notes
    let useTemplate = true;

    // Check if this is a non-template note (like from Synthea)
    if (note.skipTemplate) {
      useTemplate = false;
    }

    try {
      // Use standardized content extraction
      const extractedContent = documentReferenceConverter.extractDocumentContent(note);
      
      if (extractedContent.error) {
        // Error is handled by setting content to error message
        content = `Failed to load note content: ${extractedContent.error}`;
      } else if (extractedContent.type === 'soap' && extractedContent.sections && useTemplate) {
        sections = extractedContent.sections;
        templateId = 'soap';
      } else {
        content = extractedContent.content || '';
        // For non-template notes, just use the plain content
        if (!useTemplate) {
          templateId = null;
        }
      }

      // Only try to detect template if we should use templates
      if (useTemplate && !templateId) {
        // Determine template type from LOINC code
        const loincCode = note.type?.coding?.find(c => c.system === 'http://loinc.org')?.code;
        templateId = Object.keys(NOTE_TEMPLATES).find(key => 
          NOTE_TEMPLATES[key].code === loincCode
        ) || null; // Don't default to 'progress' for non-template notes
      }

    } catch (error) {
      // Note data extraction failed silently
    }

    return {
      title: note.description || note.title || '',
      content,
      sections,
      templateId,
      skipTemplate: note.skipTemplate || false
    };
  };

  // Load template with auto-population
  const handleLoadTemplate = async (templateId) => {
    if (!templateId || !patientId) return;

    setLoading(true);
    try {
      const template = NOTE_TEMPLATES[templateId];
      if (template) {
        if (autoPopulateEnabled) {
          const autoContent = await noteAutoPopulationService.generateTemplateContent(templateId, patientId);
          if (autoContent) {
            if (template.structure === 'sections') {
              setNoteData(prev => ({
                ...prev,
                sections: { ...prev.sections, ...autoContent.sections }
              }));
            } else {
              setNoteData(prev => ({
                ...prev,
                content: autoContent.content || template.defaultContent || ''
              }));
            }
          }
        } else {
          // Load template without auto-population - preserve existing content
          if (template.structure === 'sections') {
            const emptySections = {};
            Object.keys(template.sections).forEach(key => {
              // Preserve existing section content if available
              emptySections[key] = noteData.sections[key] || '';
            });
            setNoteData(prev => ({
              ...prev,
              sections: emptySections
            }));
          } else {
            setNoteData(prev => ({
              ...prev,
              content: prev.content || template.defaultContent || ''
            }));
          }
        }

        // Set default title if empty
        if (!noteData.title) {
          setNoteData(prev => ({
            ...prev,
            title: template.label
          }));
        }
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Error loading template: ' + error.message,
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  // Auto-load template when templateData is provided with auto-populate enabled
  useEffect(() => {
    if (open && templateData?.templateId && templateData.autoPopulate && patientId && !note) {
      // Delay to ensure the template has been set
      const timer = setTimeout(() => {
        handleLoadTemplate(templateData.templateId);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [open, templateData, patientId, note]);

  // Handle template change
  const handleTemplateChange = (templateId) => {
    setSelectedTemplate(templateId);
  };

  // Handle section content change
  const handleSectionChange = (sectionKey, value) => {
    setNoteData(prev => ({
      ...prev,
      sections: {
        ...prev.sections,
        [sectionKey]: value
      }
    }));
  };

  // Apply auto-population
  const handleApplyAutoPopulation = (autoContent) => {
    const template = NOTE_TEMPLATES[selectedTemplate];
    if (template?.structure === 'sections') {
      setNoteData(prev => ({
        ...prev,
        sections: { ...prev.sections, ...autoContent.sections }
      }));
    } else {
      setNoteData(prev => ({
        ...prev,
        content: autoContent.content || ''
      }));
    }
  };

  // Save note
  const handleSave = async (status = 'preliminary') => {
    if (!patientId) return;

    setSaving(true);
    try {
      let content = '';
      let contentType = 'text/plain';
      let template = null;

      // Check if we have a template or it's a plain text note
      if (selectedTemplate) {
        template = NOTE_TEMPLATES[selectedTemplate];
        
        // Prepare content based on template structure
        if (template && template.structure === 'sections') {
          content = JSON.stringify(noteData.sections);
          contentType = 'application/json';
        } else {
          content = noteData.content;
        }
      } else {
        // Non-template note - save as plain text
        content = noteData.content;
      }

      // Create FHIR DocumentReference
      const documentReference = {
        resourceType: 'DocumentReference',
        status: 'current', // Always current per FHIR R4 - use docStatus for workflow
        docStatus: status, // 'draft', 'preliminary', or 'final'
        type: {
          coding: [{
            system: template?.system || 'http://loinc.org',
            code: template?.code || '11506-3',
            display: template?.display || 'Progress note'
          }]
        },
        category: [{
          coding: [{
            system: 'http://hl7.org/fhir/ValueSet/document-reference-category',
            code: 'clinical-note',
            display: 'Clinical Note'
          }]
        }],
        subject: {
          reference: `Patient/${patientId}`
        },
        date: new Date().toISOString(),
        author: [{
          reference: currentUser?.id ? `Practitioner/${currentUser.id}` : undefined,
          display: currentUser?.name || 'Current User'
        }].filter(author => author), // Remove undefined references
        description: noteData.title || template?.label || 'Clinical Note',
        content: [{
          attachment: {
            contentType: contentType,
            data: btoa(content),
            title: noteData.title || template?.label || 'Clinical Note',
            creation: new Date().toISOString()
          }
        }]
      };

      // Link to encounter if provided
      if (encounter?.id) {
        documentReference.context = {
          encounter: [{
            reference: `Encounter/${encounter.id}`
          }],
          period: encounter.period || {
            start: new Date().toISOString()
          }
        };
      }

      // Handle amendment mode
      if (amendmentMode && originalNote?.id) {
        // Add relatesTo for amendments
        documentReference.relatesTo = [{
          code: 'replaces',
          target: {
            reference: `DocumentReference/${originalNote.id}`
          }
        }];
        
        // Add amendment reason to description
        if (amendmentReason.trim()) {
          documentReference.description = `${documentReference.description} - AMENDMENT: ${amendmentReason.trim()}`;
        } else {
          documentReference.description = `${documentReference.description} - AMENDED`;
        }
      }

      let savedNote;
      if (note?.id && !amendmentMode) {
        // Update existing note (only if not in amendment mode)
        savedNote = await fhirClient.update('DocumentReference', note.id, {
          ...documentReference,
          id: note.id
        });
      } else {
        // Create new note (includes amendments)
        savedNote = await fhirClient.create('DocumentReference', documentReference);
      }

      // Publish events
      await publish(CLINICAL_EVENTS.DOCUMENTATION_CREATED, {
        ...savedNote,
        noteType: template?.label || 'Clinical Note',
        isUpdate: !!(note?.id),
        isSigned: status === 'final',
        docStatus: status,
        patientId,
        encounterId: encounter?.id,
        timestamp: new Date().toISOString()
      });

      // Refresh patient resources
      window.dispatchEvent(new CustomEvent('fhir-resources-updated', { 
        detail: { patientId } 
      }));

      setSnackbar({
        open: true,
        message: `Note ${status === 'final' ? 'saved and signed' : 
                         status === 'preliminary' ? 'saved for review' : 
                         'saved as draft'} successfully`,
        severity: 'success'
      });

      onClose();

    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Error saving note: ' + error.message,
        severity: 'error'
      });
    } finally {
      setSaving(false);
    }
  };

  // Handle note sharing
  const handleShareNote = async (shareData) => {
    try {
      // In real implementation, this would create a Communication resource
      // linking to the note and set appropriate permissions
      
      // For demonstration, we'll just show a success message
      setSnackbar({
        open: true,
        message: `Note shared with ${shareData.sharedWith.length} provider(s) successfully`,
        severity: 'success'
      });

      // Publish sharing event
      await publish(CLINICAL_EVENTS.DOCUMENTATION_SHARED, {
        noteId: shareData.noteId,
        sharedWith: shareData.sharedWith,
        message: shareData.message,
        timestamp: shareData.timestamp,
        patientId
      });

    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Error sharing note: ' + error.message,
        severity: 'error'
      });
    }
  };

  // Handle quality measure note creation
  const handleQualityNoteCreation = async (qualityPrompt) => {
    try {
      // Set up the note with quality measure content
      setNoteData({
        title: qualityPrompt.title,
        content: qualityPrompt.content,
        sections: {}
      });

      // Set appropriate template if available
      if (qualityPrompt.template?.id) {
        setSelectedTemplate(qualityPrompt.template.id);
      } else {
        // Default to progress note for quality documentation
        setSelectedTemplate('progress');
      }

      // Show success message
      setSnackbar({
        open: true,
        message: `Quality measure documentation template loaded: ${qualityPrompt.measureName}`,
        severity: 'success'
      });

      // Publish workflow event
      await publish(CLINICAL_EVENTS.QUALITY_DOCUMENTATION_INITIATED, {
        patientId,
        encounterId: encounter?.id,
        measureId: qualityPrompt.measureId,
        measureName: qualityPrompt.measureName,
        priority: qualityPrompt.priority,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Error loading quality measure template: ' + error.message,
        severity: 'error'
      });
    }
  };

  const currentTemplate = selectedTemplate ? NOTE_TEMPLATES[selectedTemplate] : null;

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Box>
              <Typography variant="h6">
                {amendmentMode ? 'Amend Clinical Note' : 
                 note ? 'Edit Clinical Note' : 'New Clinical Note'}
              </Typography>
              {amendmentMode && originalNote && (
                <Typography variant="caption" color="text.secondary">
                  Creating amendment to: {originalNote.description || 'Original Note'}
                </Typography>
              )}
            </Box>
            <IconButton onClick={onClose} size="small">
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>

        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            {/* Template Selection - Only show for new notes or template-based notes */}
            {!isNonTemplateNote && (
              <TemplateSelector
                selectedTemplate={selectedTemplate}
                onTemplateChange={handleTemplateChange}
                onLoadTemplate={handleLoadTemplate}
                autoPopulateEnabled={autoPopulateEnabled}
                onAutoPopulateToggle={setAutoPopulateEnabled}
              />
            )}

            {/* Show info for non-template notes */}
            {isNonTemplateNote && (
              <Alert severity="info">
                This note was imported from external data and is displayed as plain text.
              </Alert>
            )}

            {/* Quality Measure Documentation Prompts */}
            {patientId && !amendmentMode && (
              <QualityMeasurePrompts
                patientId={patientId}
                encounterId={encounter?.id}
                onCreateNote={handleQualityNoteCreation}
                variant="inline"
                showSummary={true}
              />
            )}

            {/* Amendment Reason (only shown in amendment mode) */}
            {amendmentMode && (
              <Paper sx={{ p: 2, bgcolor: 'warning.light', border: '1px solid', borderColor: 'warning.main' }}>
                <Stack spacing={2}>
                  <Typography variant="subtitle2" color="warning.dark" fontWeight="600">
                    Amendment Required
                  </Typography>
                  <TextField
                    fullWidth
                    label="Reason for Amendment"
                    value={amendmentReason}
                    onChange={(e) => setAmendmentReason(e.target.value)}
                    placeholder="Explain why this note is being amended..."
                    multiline
                    rows={2}
                    helperText="Describe the reason for creating this amendment (optional but recommended)"
                    variant="outlined"
                    size="small"
                  />
                </Stack>
              </Paper>
            )}

            {/* Auto-Population Preview */}
            {currentTemplate && (
              <AutoPopulationPreview
                template={currentTemplate}
                patientId={patientId}
                onApply={handleApplyAutoPopulation}
              />
            )}

            {/* Note Sharing */}
            {note && (
              <NoteSharing
                note={note}
                onShare={handleShareNote}
              />
            )}

            {/* Note Title */}
            <TextField
              fullWidth
              label="Note Title"
              value={noteData.title}
              onChange={(e) => setNoteData(prev => ({ ...prev, title: e.target.value }))}
              placeholder={currentTemplate?.label || 'Enter note title...'}
            />

            {/* Note Content */}
            {currentTemplate?.structure === 'sections' ? (
              <SectionedNoteEditor
                template={currentTemplate}
                sections={noteData.sections}
                onSectionChange={handleSectionChange}
              />
            ) : (
              <>
                <RichTextToolbar
                  formatting={formatting}
                  onFormattingChange={setFormatting}
                />
                <TextField
                  fullWidth
                  multiline
                  rows={12}
                  label="Note Content"
                  value={noteData.content}
                  onChange={(e) => setNoteData(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Enter clinical note content..."
                />
              </>
            )}
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button 
            onClick={() => handleSave('draft')} 
            disabled={saving}
            startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
            color="warning"
          >
            {saving ? 'Saving...' : 'Save as Draft'}
          </Button>
          <Button 
            onClick={() => handleSave('preliminary')} 
            disabled={saving}
            startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
            color="info"
          >
            {saving ? 'Saving...' : 'Save for Review'}
          </Button>
          <Button 
            variant="contained" 
            onClick={() => handleSave('final')}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={16} /> : <SignIcon />}
          >
            {saving ? 'Saving...' : 'Sign & Complete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default React.memo(EnhancedNoteEditor);