/**
 * Documentation Tab Component
 * Clinical notes, forms, and documentation management
 */
import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
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
  Divider,
  Card,
  CardContent,
  CardActions,
  TextField,
  InputAdornment,
  Menu,
  MenuItem,
  FormControl,
  Select,
  InputLabel,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  TextareaAutosize,
  ToggleButton,
  ToggleButtonGroup,
  useTheme,
  alpha,
  Snackbar
} from '@mui/material';
import {
  Description as NoteIcon,
  Assignment as FormIcon,
  AttachFile as AttachmentIcon,
  Edit as EditIcon,
  Add as AddIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Print as PrintIcon,
  Share as ShareIcon,
  Lock as SignedIcon,
  LockOpen as UnsignedIcon,
  ExpandMore as ExpandMoreIcon,
  CalendarMonth as CalendarIcon,
  Person as AuthorIcon,
  LocalOffer as TagIcon,
  History as HistoryIcon,
  Notes as SOAPIcon,
  Assessment as AssessmentIcon,
  EventNote as ProgressIcon,
  MedicalServices as ConsultIcon,
  Receipt as DischargeIcon,
  FormatBold as BoldIcon,
  FormatItalic as ItalicIcon,
  FormatUnderlined as UnderlineIcon,
  FormatListBulleted as BulletIcon,
  FormatListNumbered as NumberedIcon,
  Visibility as VisibilityIcon
} from '@mui/icons-material';
import { format, parseISO, formatDistanceToNow, isWithinInterval, subDays, subMonths } from 'date-fns';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import { fhirClient } from '../../../../services/fhirClient';
import { useNavigate } from 'react-router-dom';
import { printDocument, formatClinicalNoteForPrint } from '../../../../utils/printUtils';
import { useClinicalWorkflow, CLINICAL_EVENTS } from '../../../../contexts/ClinicalWorkflowContext';

// Note type configuration
const noteTypes = {
  // LOINC codes from actual data
  '34117-2': { icon: <AssessmentIcon />, label: 'History & Physical', color: 'primary' },
  '51847-2': { icon: <ProgressIcon />, label: 'Evaluation & Plan', color: 'info' },
  // Common note types
  'progress': { icon: <ProgressIcon />, label: 'Progress Note', color: 'primary' },
  'soap': { icon: <SOAPIcon />, label: 'SOAP Note', color: 'info' },
  'consult': { icon: <ConsultIcon />, label: 'Consultation', color: 'secondary' },
  'discharge': { icon: <DischargeIcon />, label: 'Discharge Summary', color: 'warning' },
  'assessment': { icon: <AssessmentIcon />, label: 'Assessment', color: 'success' },
  'clinical-note': { icon: <NoteIcon />, label: 'Clinical Note', color: 'primary' },
  'other': { icon: <NoteIcon />, label: 'Other', color: 'default' }
};

// Note Card Component
const NoteCard = ({ note, onEdit, onView, onSign }) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  
  const noteType = note.type?.coding?.[0]?.code || 'other';
  const typeConfig = noteTypes[noteType] || noteTypes.other;
  const author = note.author?.[0]?.display || 'Unknown';
  const date = note.date || note.meta?.lastUpdated;
  const isSigned = note.status === 'final';
  
  // Ensure typeConfig has required properties
  if (!typeConfig || !typeConfig.color) {
    // Invalid type config - return default formatting
    return null;
  }

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box sx={{ flex: 1 }}>
            <Stack direction="row" spacing={2} alignItems="center" mb={1}>
              <Box sx={{ 
                color: typeConfig.color === 'default' 
                  ? theme.palette.text.secondary 
                  : theme.palette[typeConfig.color]?.main || theme.palette.text.primary 
              }}>
                {typeConfig.icon}
              </Box>
              <Typography variant="h6">
                {typeConfig.label}
              </Typography>
              {isSigned ? (
                <Chip 
                  icon={<SignedIcon />} 
                  label="Signed" 
                  size="small" 
                  color="success"
                />
              ) : (
                <Chip 
                  icon={<UnsignedIcon />} 
                  label="Draft" 
                  size="small" 
                  color="warning"
                />
              )}
            </Stack>

            <Stack direction="row" spacing={3} alignItems="center" mb={2}>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <AuthorIcon fontSize="small" color="action" />
                <Typography variant="caption">{author}</Typography>
              </Stack>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <CalendarIcon fontSize="small" color="action" />
                <Typography variant="caption">
                  {date ? format(parseISO(date), 'MMM d, yyyy h:mm a') : 'No date'}
                </Typography>
              </Stack>
              {date && (
                <Typography variant="caption" color="text.secondary">
                  ({formatDistanceToNow(parseISO(date), { addSuffix: true })})
                </Typography>
              )}
            </Stack>

            <Typography 
              variant="body2" 
              sx={{ 
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: expanded ? 'unset' : 3,
                WebkitBoxOrient: 'vertical',
                whiteSpace: 'pre-wrap'
              }}
            >
              {note.text?.div || note.text || 'No content available'}
            </Typography>

            {note.section && (
              <Box mt={2}>
                {note.section.map((section, index) => (
                  <Accordion key={index} expanded={expanded}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="subtitle2">
                        {section.title || 'Section'}
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Typography variant="body2">
                        {section.text?.div || section.text || ''}
                      </Typography>
                    </AccordionDetails>
                  </Accordion>
                ))}
              </Box>
            )}
          </Box>

          <Stack direction="column" spacing={1}>
            <IconButton size="small" onClick={() => onView(note)}>
              <VisibilityIcon />
            </IconButton>
            {!isSigned && (
              <IconButton size="small" onClick={() => onEdit(note)}>
                <EditIcon />
              </IconButton>
            )}
          </Stack>
        </Stack>
      </CardContent>

      <CardActions>
        <Button 
          size="small" 
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Show Less' : 'Read More'}
        </Button>
        {!isSigned && (
          <Button size="small" color="primary" onClick={() => onSign && onSign(note)}>
            Sign Note
          </Button>
        )}
        {isSigned && (
          <Button 
            size="small" 
            startIcon={<AddIcon />}
            onClick={() => onEdit && onEdit({ ...note, isAddendum: true })}
          >
            Addendum
          </Button>
        )}
        <Button size="small" startIcon={<ShareIcon />}>
          Share
        </Button>
      </CardActions>
    </Card>
  );
};

// Note Editor Component
const NoteEditor = ({ open, onClose, note, patientId }) => {
  const { publish } = useClinicalWorkflow();
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [noteData, setNoteData] = useState({
    type: 'progress',
    title: '',
    content: '',
    sections: {
      subjective: '',
      objective: '',
      assessment: '',
      plan: ''
    }
  });
  const [formatting, setFormatting] = useState([]);

  // Extract content from FHIR DocumentReference when editing existing note
  useEffect(() => {
    if (note && open) {
      // Extract content from FHIR DocumentReference
      let extractedContent = '';
      let extractedSections = {
        subjective: '',
        objective: '',
        assessment: '',
        plan: ''
      };

      // Try to decode base64 content
      if (note.content?.[0]?.attachment?.data) {
        try {
          const decodedContent = atob(note.content[0].attachment.data);
          extractedContent = decodedContent;
          
          // Try to parse as JSON for SOAP sections
          try {
            const parsed = JSON.parse(decodedContent);
            if (parsed.subjective || parsed.objective || parsed.assessment || parsed.plan) {
              extractedSections = {
                subjective: parsed.subjective || '',
                objective: parsed.objective || '',
                assessment: parsed.assessment || '',
                plan: parsed.plan || ''
              };
              extractedContent = ''; // Use sections instead of plain content
            }
          } catch (e) {
            // Not JSON, use as plain content
          }
        } catch (e) {
          // Failed to decode - will return original base64 string
        }
      }

      setNoteData({
        type: note.type?.coding?.[0]?.code || 'progress',
        title: note.title || '',
        content: extractedContent,
        sections: extractedSections
      });
    } else if (!note && open) {
      // Reset for new note
      setNoteData({
        type: 'progress',
        title: '',
        content: '',
        sections: {
          subjective: '',
          objective: '',
          assessment: '',
          plan: ''
        }
      });
    }
  }, [note, open]);

  const handleSave = async (signNote = false) => {
    try {
      // Prepare content based on note type
      let content = '';
      if (noteData.type === 'soap') {
        // Format SOAP sections
        content = JSON.stringify({
          subjective: noteData.sections.subjective,
          objective: noteData.sections.objective,
          assessment: noteData.sections.assessment,
          plan: noteData.sections.plan
        });
      } else {
        content = noteData.content;
      }

      // Create FHIR DocumentReference
      const documentReference = {
        resourceType: 'DocumentReference',
        status: signNote ? 'current' : 'preliminary',
        docStatus: signNote ? 'final' : 'preliminary',
        type: {
          coding: [{
            system: 'http://loinc.org',
            code: noteData.type === '34117-2' || noteData.type === '51847-2' ? noteData.type : '11488-4',
            display: noteTypes[noteData.type]?.label || 'Clinical Note'
          }]
        },
        subject: {
          reference: `Patient/${patientId}`
        },
        date: new Date().toISOString(),
        author: [{
          display: 'Current User' // This would come from auth context
        }],
        description: noteData.title || noteTypes[noteData.type]?.label || 'Clinical Note',
        content: [{
          attachment: {
            contentType: 'text/plain',
            data: btoa(content), // Base64 encode the content
            title: noteData.title || 'Clinical Note'
          }
        }]
      };

      let response;
      if (note && note.id) {
        // Update existing note
        // Only include valid FHIR fields, exclude text and context if they're invalid
        const updatePayload = {
          ...documentReference,
          id: note.id,
          resourceType: 'DocumentReference'
        };
        
        // Remove invalid fields that might exist in the note
        delete updatePayload.text;
        delete updatePayload.context;
        
        const updatedResource = await fhirClient.update('DocumentReference', note.id, updatePayload);
        response = { ok: true, data: updatedResource };
      } else {
        // Create new note
        const createdResource = await fhirClient.create('DocumentReference', documentReference);
        response = { ok: true, data: createdResource };
      }

      if (response.ok) {
        const savedNote = response.data;
        
        // Publish DOCUMENTATION_CREATED event
        await publish(CLINICAL_EVENTS.DOCUMENTATION_CREATED, {
          ...savedNote,
          noteType: noteTypes[noteData.type]?.label || 'Clinical Note',
          isUpdate: !!(note && note.id),
          isSigned: signNote,
          patientId,
          timestamp: new Date().toISOString()
        });
        
        // Publish workflow notification
        await publish(CLINICAL_EVENTS.WORKFLOW_NOTIFICATION, {
          workflowType: 'clinical-documentation',
          step: note && note.id ? 'updated' : 'created',
          data: {
            noteType: noteTypes[noteData.type]?.label || 'Clinical Note',
            title: noteData.title || 'Clinical Note',
            isSigned: signNote,
            patientId,
            timestamp: new Date().toISOString()
          }
        });
        
        // Refresh patient resources to show new/updated note
        window.dispatchEvent(new CustomEvent('fhir-resources-updated', { 
          detail: { patientId } 
        }));
        onClose();
      } else {
        throw new Error(`Failed to save note: ${response.statusText}`);
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Failed to save note. Please try again.',
        severity: 'error'
      });
    }
  };

  const applyFormatting = (format) => {
    const newFormatting = formatting.includes(format) 
      ? formatting.filter(f => f !== format)
      : [...formatting, format];
    setFormatting(newFormatting);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {note ? 'Edit Clinical Note' : 'New Clinical Note'}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 2 }}>
          <FormControl fullWidth>
            <InputLabel>Note Type</InputLabel>
            <Select
              value={noteData.type}
              onChange={(e) => setNoteData({ ...noteData, type: e.target.value })}
              label="Note Type"
            >
              {Object.entries(noteTypes).map(([key, config]) => (
                <MenuItem key={key} value={key}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    {config.icon}
                    <span>{config.label}</span>
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            fullWidth
            label="Note Title"
            value={noteData.title}
            onChange={(e) => setNoteData({ ...noteData, title: e.target.value })}
          />

          {noteData.type === 'soap' ? (
            <>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Subjective"
                value={noteData.sections.subjective}
                onChange={(e) => setNoteData({
                  ...noteData,
                  sections: { ...noteData.sections, subjective: e.target.value }
                })}
              />
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Objective"
                value={noteData.sections.objective}
                onChange={(e) => setNoteData({
                  ...noteData,
                  sections: { ...noteData.sections, objective: e.target.value }
                })}
              />
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Assessment"
                value={noteData.sections.assessment}
                onChange={(e) => setNoteData({
                  ...noteData,
                  sections: { ...noteData.sections, assessment: e.target.value }
                })}
              />
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Plan"
                value={noteData.sections.plan}
                onChange={(e) => setNoteData({
                  ...noteData,
                  sections: { ...noteData.sections, plan: e.target.value }
                })}
              />
            </>
          ) : (
            <>
              <Box>
                <ToggleButtonGroup
                  value={formatting}
                  onChange={(e, newFormats) => setFormatting(newFormats)}
                  aria-label="text formatting"
                  size="small"
                  sx={{ mb: 1 }}
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
              <TextField
                fullWidth
                multiline
                rows={10}
                label="Note Content"
                value={noteData.content}
                onChange={(e) => setNoteData({ ...noteData, content: e.target.value })}
                placeholder="Enter clinical note content..."
              />
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={() => handleSave(false)}>Save as Draft</Button>
        <Button variant="contained" onClick={() => handleSave(true)}>
          Save & Sign
        </Button>
      </DialogActions>
      
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
    </Dialog>
  );
};

// Addendum Dialog Component
const AddendumDialog = ({ open, onClose, note, onSave }) => {
  const [addendumText, setAddendumText] = useState('');
  
  const handleSave = () => {
    if (addendumText.trim()) {
      onSave(addendumText);
      setAddendumText('');
    }
  };
  
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Add Addendum to Note
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Alert severity="info">
            You are adding an addendum to a signed note. The original note cannot be modified.
          </Alert>
          
          {note && (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Original Note:
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {note.text || 'No content'}
              </Typography>
              <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                Signed by {note.author?.[0]?.display} on {note.date ? format(parseISO(note.date), 'MMM d, yyyy h:mm a') : 'Unknown'}
              </Typography>
            </Paper>
          )}
          
          <TextField
            fullWidth
            multiline
            rows={6}
            label="Addendum Text"
            value={addendumText}
            onChange={(e) => setAddendumText(e.target.value)}
            placeholder="Enter your addendum..."
            helperText="This addendum will be permanently attached to the original note."
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          variant="contained" 
          onClick={handleSave}
          disabled={!addendumText.trim()}
        >
          Save Addendum
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const DocumentationTab = ({ patientId, onNotificationUpdate, newNoteDialogOpen, onNewNoteDialogClose }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { getPatientResources, isLoading, currentPatient } = useFHIRResource();
  const { publish } = useClinicalWorkflow();
  
  const [tabValue, setTabValue] = useState(0);
  const [filterType, setFilterType] = useState('all');
  const [filterPeriod, setFilterPeriod] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState(null);
  const [addendumDialogOpen, setAddendumDialogOpen] = useState(false);
  const [selectedNoteForAddendum, setSelectedNoteForAddendum] = useState(null);

  useEffect(() => {
    setLoading(false);
  }, []);

  // Get documentation resources
  const documentReferences = getPatientResources(patientId, 'DocumentReference') || [];
  const compositions = getPatientResources(patientId, 'Composition') || [];
  const clinicalImpressions = getPatientResources(patientId, 'ClinicalImpression') || [];
  const diagnosticReports = getPatientResources(patientId, 'DiagnosticReport') || [];
  
  // Helper function to decode base64 content
  const decodeBase64Content = (content) => {
    try {
      if (content?.data) {
        return atob(content.data);
      }
      return null;
    } catch (error) {
      // Failed to decode - return original content
      return null;
    }
  };
  
  // Process DocumentReference resources to extract notes
  const processedDocumentReferences = documentReferences.map(doc => {
    const decodedContent = doc.content?.[0]?.attachment ? 
      decodeBase64Content(doc.content[0].attachment) : null;
    
    return {
      ...doc,
      type: doc.type || { coding: [{ code: 'other' }] },
      status: doc.status || 'final',
      date: doc.date || doc.content?.[0]?.attachment?.creation,
      author: doc.author || [{ display: 'Unknown' }],
      text: decodedContent || doc.description || 'No content available'
    };
  });
  
  // Process DiagnosticReport resources to extract notes
  const processedDiagnosticReports = diagnosticReports.map(report => {
    const decodedContent = report.presentedForm?.[0] ? 
      decodeBase64Content(report.presentedForm[0]) : null;
    
    return {
      ...report,
      resourceType: 'DocumentReference', // Treat as document for display
      type: { coding: [{ code: 'assessment' }] },
      status: report.status || 'final',
      date: report.issued || report.effectiveDateTime,
      author: report.performer || [{ display: 'System' }],
      text: decodedContent || report.conclusion || 'No content available'
    };
  });

  // Combine all documentation
  const allDocuments = [...processedDocumentReferences, ...compositions, ...clinicalImpressions, ...processedDiagnosticReports];

  // Filter documents
  const filterDocuments = (docs) => {
    return docs.filter(doc => {
      // Type filter
      if (filterType !== 'all') {
        const docType = doc.type?.coding?.[0]?.code;
        if (docType !== filterType) return false;
      }

      // Status filter
      if (filterStatus !== 'all' && doc.status !== filterStatus) {
        return false;
      }

      // Period filter
      if (filterPeriod !== 'all') {
        const docDate = doc.date || doc.meta?.lastUpdated;
        if (docDate) {
          const date = parseISO(docDate);
          const periodMap = {
            '7d': subDays(new Date(), 7),
            '30d': subDays(new Date(), 30),
            '3m': subMonths(new Date(), 3),
            '6m': subMonths(new Date(), 6),
            '1y': subMonths(new Date(), 12)
          };
          if (!isWithinInterval(date, {
            start: periodMap[filterPeriod],
            end: new Date()
          })) {
            return false;
          }
        }
      }

      // Search filter
      if (searchTerm) {
        const searchableText = [
          doc.type?.text,
          doc.type?.coding?.[0]?.display,
          doc.text?.div,
          doc.text,
          doc.title,
          doc.author?.[0]?.display
        ].filter(Boolean).join(' ').toLowerCase();
        
        if (!searchableText.includes(searchTerm.toLowerCase())) {
          return false;
        }
      }

      return true;
    });
  };

  const filteredDocuments = filterDocuments(allDocuments);
  const sortedDocuments = [...filteredDocuments].sort((a, b) => {
    const dateA = new Date(a.date || a.meta?.lastUpdated || 0);
    const dateB = new Date(b.date || b.meta?.lastUpdated || 0);
    return dateB - dateA;
  });

  // Count documents by status
  const draftCount = allDocuments.filter(d => d.status === 'draft').length;
  const signedCount = allDocuments.filter(d => d.status === 'final').length;

  const handleNewNote = () => {
    setSelectedNote(null);
    setEditorOpen(true);
  };

  const handleEditNote = (note) => {
    if (note.isAddendum) {
      // This is from the addendum button in NoteCard
      setSelectedNoteForAddendum(note);
      setAddendumDialogOpen(true);
    } else {
      // Regular edit
      setSelectedNote(note);
      setEditorOpen(true);
    }
  };

  const handleViewNote = (note) => {
    // Show note details in a modal or expanded view
    setSelectedNote(note);
    // You could also open a dialog here if needed
  };

  const handleSignNote = async (note) => {
    try {
      // Update the note status to final
      const updatedNote = {
        ...note,
        status: 'current',
        docStatus: 'final'
      };
      
      const updatedResource = await fhirClient.update('DocumentReference', note.id, updatedNote);
      
      if (updatedResource) {
        // Publish DOCUMENTATION_CREATED event (for signed note)
        await publish(CLINICAL_EVENTS.DOCUMENTATION_CREATED, {
          ...updatedNote,
          noteType: note.type?.coding?.[0]?.display || 'Clinical Note',
          isUpdate: true,
          isSigned: true,
          patientId,
          timestamp: new Date().toISOString()
        });
        
        // Publish workflow notification
        await publish(CLINICAL_EVENTS.WORKFLOW_NOTIFICATION, {
          workflowType: 'clinical-documentation',
          step: 'signed',
          data: {
            noteType: note.type?.coding?.[0]?.display || 'Clinical Note',
            title: note.description || 'Clinical Note',
            isSigned: true,
            patientId,
            timestamp: new Date().toISOString()
          }
        });
        
        // Refresh patient resources to show updated status
        window.dispatchEvent(new CustomEvent('fhir-resources-updated', { 
          detail: { patientId } 
        }));
        
        setSnackbar({
          open: true,
          message: 'Note signed successfully',
          severity: 'success'
        });
      } else {
        throw new Error('Failed to sign note');
      }
    } catch (error) {
      // Handle error
      setSnackbar({
        open: true,
        message: 'Failed to sign note: ' + error.message,
        severity: 'error'
      });
    }
  };
  
  const handleSaveAddendum = async (addendumText) => {
    // Create a new DocumentReference linked to the original note
    try {
      if (!selectedNoteForAddendum || !addendumText.trim()) {
        throw new Error('Invalid addendum data');
      }

      // Create the addendum DocumentReference
      const addendumResource = {
        resourceType: 'DocumentReference',
        status: 'current',
        docStatus: 'final',
        type: {
          coding: [{
            system: 'http://loinc.org',
            code: '11506-3',
            display: 'Progress note'
          }],
          text: 'Addendum'
        },
        category: [{
          coding: [{
            system: 'http://hl7.org/fhir/us/core/CodeSystem/us-core-documentreference-category',
            code: 'clinical-note',
            display: 'Clinical Note'
          }]
        }],
        subject: {
          reference: `Patient/${patientId}`
        },
        date: new Date().toISOString(),
        author: [{
          display: 'Current User' // This would come from auth context
        }],
        relatesTo: [{
          code: 'appends',
          target: {
            reference: `DocumentReference/${selectedNoteForAddendum.id}`
          }
        }],
        description: `Addendum to ${selectedNoteForAddendum.type?.text || 'note'} from ${format(parseISO(selectedNoteForAddendum.date), 'MMM d, yyyy')}`,
        content: [{
          attachment: {
            contentType: 'text/plain',
            data: btoa(addendumText), // Base64 encode the text
            creation: new Date().toISOString()
          }
        }]
      };

      // Save the addendum
      const createdAddendum = await fhirClient.createDocumentReference(addendumResource);
      
      // Publish DOCUMENTATION_CREATED event
      await publish(CLINICAL_EVENTS.DOCUMENTATION_CREATED, {
        ...createdAddendum,
        noteType: 'Addendum',
        isUpdate: false,
        isSigned: true,
        isAddendum: true,
        originalNoteId: selectedNoteForAddendum.id,
        patientId,
        timestamp: new Date().toISOString()
      });
      
      // Publish workflow notification
      await publish(CLINICAL_EVENTS.WORKFLOW_NOTIFICATION, {
        workflowType: 'clinical-documentation',
        step: 'addendum-created',
        data: {
          noteType: 'Addendum',
          originalNoteTitle: selectedNoteForAddendum.description || 'Clinical Note',
          patientId,
          timestamp: new Date().toISOString()
        }
      });
      
      // Refresh the documents list
      await fhirClient.refreshPatientResources(patientId);
      
      // Close dialog and clear state
      setAddendumDialogOpen(false);
      setSelectedNoteForAddendum(null);
      
      // Show success message
      setSnackbar({
        open: true,
        message: 'Addendum saved successfully',
        severity: 'success'
      });
    } catch (error) {
      // Log error for debugging (would use proper logging in production)
      setSnackbar({
        open: true,
        message: 'Failed to save addendum: ' + error.message,
        severity: 'error'
      });
    }
  };
  
  const handlePrintDocumentation = () => {
    const patientInfo = {
      name: currentPatient ? 
        `${currentPatient.name?.[0]?.given?.join(' ') || ''} ${currentPatient.name?.[0]?.family || ''}`.trim() : 
        'Unknown Patient',
      mrn: currentPatient?.identifier?.find(id => id.type?.coding?.[0]?.code === 'MR')?.value || currentPatient?.id,
      birthDate: currentPatient?.birthDate,
      gender: currentPatient?.gender,
      phone: currentPatient?.telecom?.find(t => t.system === 'phone')?.value
    };
    
    let content = '';
    sortedDocuments.forEach((doc, index) => {
      if (index > 0) content += '<div class="page-break"></div>';
      content += formatClinicalNoteForPrint(doc);
    });
    
    printDocument({
      title: 'Clinical Documentation',
      patient: patientInfo,
      content
    });
  };
  
  useEffect(() => {
    if (newNoteDialogOpen) {
      handleNewNote();
    }
  }, [newNoteDialogOpen]);
  
  useEffect(() => {
    if (!editorOpen && onNewNoteDialogClose) {
      onNewNoteDialogClose();
    }
  }, [editorOpen, onNewNoteDialogClose]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight="bold">
          Clinical Documentation
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleNewNote}
        >
          New Note
        </Button>
      </Stack>

      {/* Summary Stats */}
      <Stack direction="row" spacing={2} mb={3}>
        <Chip 
          label={`${draftCount} Draft Notes`} 
          color="warning" 
          icon={<UnsignedIcon />}
        />
        <Chip 
          label={`${signedCount} Signed Notes`} 
          color="success" 
          icon={<SignedIcon />}
        />
        <Chip 
          label={`${allDocuments.length} Total Documents`} 
          color="primary" 
        />
      </Stack>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField
            placeholder="Search documentation..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="small"
            sx={{ flex: 1 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              )
            }}
          />
          
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Type</InputLabel>
            <Select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              label="Type"
            >
              <MenuItem value="all">All Types</MenuItem>
              <MenuItem value="progress">Progress Notes</MenuItem>
              <MenuItem value="soap">SOAP Notes</MenuItem>
              <MenuItem value="consult">Consultations</MenuItem>
              <MenuItem value="discharge">Discharge Summaries</MenuItem>
              <MenuItem value="assessment">Assessments</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              label="Status"
            >
              <MenuItem value="all">All Status</MenuItem>
              <MenuItem value="draft">Draft</MenuItem>
              <MenuItem value="final">Signed</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Period</InputLabel>
            <Select
              value={filterPeriod}
              onChange={(e) => setFilterPeriod(e.target.value)}
              label="Period"
            >
              <MenuItem value="all">All Time</MenuItem>
              <MenuItem value="7d">Last 7 Days</MenuItem>
              <MenuItem value="30d">Last 30 Days</MenuItem>
              <MenuItem value="3m">Last 3 Months</MenuItem>
              <MenuItem value="6m">Last 6 Months</MenuItem>
              <MenuItem value="1y">Last Year</MenuItem>
            </Select>
          </FormControl>

          <Button
            variant="outlined"
            startIcon={<PrintIcon />}
            onClick={handlePrintDocumentation}
          >
            Print
          </Button>
        </Stack>
      </Paper>

      {/* Documents List */}
      {sortedDocuments.length === 0 ? (
        <Alert severity="info">
          No documentation found matching your criteria
        </Alert>
      ) : (
        <Box>
          {sortedDocuments.map((document) => (
            <NoteCard
              key={document.id}
              note={document}
              onEdit={handleEditNote}
              onView={handleViewNote}
              onSign={handleSignNote}
            />
          ))}
        </Box>
      )}

      {/* Note Editor Dialog */}
      <NoteEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        note={selectedNote}
        patientId={patientId}
      />
      
      {/* Addendum Dialog */}
      <AddendumDialog
        open={addendumDialogOpen}
        onClose={() => {
          setAddendumDialogOpen(false);
          setSelectedNoteForAddendum(null);
        }}
        note={selectedNoteForAddendum}
        onSave={handleSaveAddendum}
      />

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
    </Box>
  );
};

export default React.memo(DocumentationTab);