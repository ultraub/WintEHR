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
  Divider,
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
  Visibility as PreviewIcon
} from '@mui/icons-material';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import { useClinicalWorkflow, CLINICAL_EVENTS } from '../../../../contexts/ClinicalWorkflowContext';
import { fhirClient } from '../../../../services/fhirClient';
import { NOTE_TEMPLATES, noteAutoPopulationService } from '../../../../services/noteTemplatesService';

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
      console.error('Error generating auto-population preview:', error);
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

const EnhancedNoteEditor = ({ 
  open, 
  onClose, 
  note, 
  patientId,
  defaultTemplate = null,
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

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open && !note) {
      // New note
      setNoteData({
        title: '',
        content: '',
        sections: {}
      });
      setSelectedTemplate(defaultTemplate);
    } else if (open && note) {
      // Editing existing note
      const extractedData = extractNoteData(note);
      setNoteData(extractedData);
      setSelectedTemplate(extractedData.templateId || 'progress');
    }
  }, [open, note, defaultTemplate]);

  // Extract data from existing FHIR DocumentReference
  const extractNoteData = (note) => {
    let content = '';
    let sections = {};
    let templateId = 'progress';

    try {
      if (note.content?.[0]?.attachment?.data) {
        const decodedContent = atob(note.content[0].attachment.data);
        
        // Try to parse as JSON for sectioned notes
        try {
          const parsed = JSON.parse(decodedContent);
          if (typeof parsed === 'object' && !Array.isArray(parsed)) {
            sections = parsed;
          } else {
            content = decodedContent;
          }
        } catch (e) {
          content = decodedContent;
        }
      }

      // Determine template type from LOINC code
      const loincCode = note.type?.coding?.find(c => c.system === 'http://loinc.org')?.code;
      templateId = Object.keys(NOTE_TEMPLATES).find(key => 
        NOTE_TEMPLATES[key].code === loincCode
      ) || 'progress';

    } catch (error) {
      console.error('Error extracting note data:', error);
    }

    return {
      title: note.description || note.title || '',
      content,
      sections,
      templateId
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
          // Load template without auto-population
          if (template.structure === 'sections') {
            const emptySections = {};
            Object.keys(template.sections).forEach(key => {
              emptySections[key] = '';
            });
            setNoteData(prev => ({
              ...prev,
              sections: emptySections
            }));
          } else {
            setNoteData(prev => ({
              ...prev,
              content: template.defaultContent || ''
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
  const handleSave = async (signNote = false) => {
    if (!selectedTemplate || !patientId) return;

    setSaving(true);
    try {
      const template = NOTE_TEMPLATES[selectedTemplate];
      let content = '';

      // Prepare content based on template structure
      if (template.structure === 'sections') {
        content = JSON.stringify(noteData.sections);
      } else {
        content = noteData.content;
      }

      // Create FHIR DocumentReference
      const documentReference = {
        resourceType: 'DocumentReference',
        status: 'current', // Always current per FHIR R4 - use docStatus for workflow
        docStatus: signNote ? 'final' : 'preliminary',
        type: {
          coding: [{
            system: template.system,
            code: template.code,
            display: template.display
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
        description: noteData.title || template.label,
        content: [{
          attachment: {
            contentType: template.structure === 'sections' ? 'application/json' : 'text/plain',
            data: btoa(content),
            title: noteData.title || template.label,
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
        noteType: template.label,
        isUpdate: !!(note?.id),
        isSigned: signNote,
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
        message: `Note ${signNote ? 'saved and signed' : 'saved as draft'} successfully`,
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
            {/* Template Selection */}
            <TemplateSelector
              selectedTemplate={selectedTemplate}
              onTemplateChange={handleTemplateChange}
              onLoadTemplate={handleLoadTemplate}
              autoPopulateEnabled={autoPopulateEnabled}
              onAutoPopulateToggle={setAutoPopulateEnabled}
            />

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
            onClick={() => handleSave(false)} 
            disabled={saving || !selectedTemplate}
            startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
          >
            {saving ? 'Saving...' : 'Save as Draft'}
          </Button>
          <Button 
            variant="contained" 
            onClick={() => handleSave(true)}
            disabled={saving || !selectedTemplate}
            startIcon={saving ? <CircularProgress size={16} /> : <SignIcon />}
          >
            {saving ? 'Saving...' : 'Save & Sign'}
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