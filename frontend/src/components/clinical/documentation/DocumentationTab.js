/**
 * Documentation Tab Component
 * Main container for clinical documentation functionality
 */
import React, { useState, useEffect } from 'react';
import api from '../../../services/api';
import {
  Box,
  Grid,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  ListItemIcon,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Chip,
  Divider,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  FormControl,
  InputLabel
} from '@mui/material';
import {
  Add as AddIcon,
  Description as NoteIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  MoreVert as MoreIcon,
  CheckCircle as SignedIcon,
  Schedule as DraftIcon,
  ContentPaste as TemplateIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { useDocumentation } from '../../../contexts/DocumentationContext';
import { useClinical } from '../../../contexts/ClinicalContext';
import SOAPEditor from './SOAPEditor';
import { fhirClient } from '../../../services/fhirClient';

const DocumentationTab = () => {
  const { currentPatient } = useClinical();
  const {
    recentNotes,
    noteTemplates,
    currentNote,
    loadRecentNotes,
    loadNoteTemplates,
    createNewNote,
    loadNote,
    clearCurrentNote,
    createAddendum
  } = useDocumentation();

  const [selectedNoteId, setSelectedNoteId] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedNote, setSelectedNote] = useState(null);
  const [showNewNoteDialog, setShowNewNoteDialog] = useState(false);
  const [newNoteType, setNewNoteType] = useState('progress_note');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [encounterNotes, setEncounterNotes] = useState([]);
  const [selectedEncounterNote, setSelectedEncounterNote] = useState(null);
  const [showEncounterNoteDialog, setShowEncounterNoteDialog] = useState(false);
  const [showAddendumDialog, setShowAddendumDialog] = useState(false);
  const [addendumContent, setAddendumContent] = useState('');
  const [addendumNoteId, setAddendumNoteId] = useState(null);

  // Load encounter notes
  const loadEncounterNotes = async () => {
    if (!currentPatient) return;
    
    try {
      // Fetch encounters using FHIR
      const result = await fhirClient.getEncounters(currentPatient.id);
      const response = { data: result.resources.slice(0, 20) };
      
      // Filter encounters that have notes
      const notesFromEncounters = response.data
        .filter(enc => enc.notes)
        .map(enc => ({
          id: `encounter-${enc.id}`,
          type: 'encounter',
          noteType: enc.encounter_type || 'Encounter Note',
          content: enc.notes,
          createdAt: enc.encounter_date,
          encounterDate: enc.encounter_date,
          status: 'signed',
          authorName: 'System Generated',
          encounterId: enc.id
        }));
      
      setEncounterNotes(notesFromEncounters);
    } catch (error) {
      console.error('Error loading encounter notes:', error);
    }
  };

  // Load data on mount
  useEffect(() => {
    if (currentPatient) {
      loadRecentNotes(currentPatient.id);
      loadNoteTemplates();
      loadEncounterNotes();
    }
  }, [currentPatient?.id]);

  const handleNewNote = () => {
    setShowNewNoteDialog(true);
  };

  const handleCreateNote = () => {
    createNewNote(newNoteType, selectedTemplateId || undefined);
    setShowNewNoteDialog(false);
    setSelectedNoteId(null);
  };

  const handleSelectNote = (noteId) => {
    // Check if it's an encounter note
    if (noteId.startsWith('encounter-')) {
      const encounterNote = encounterNotes.find(n => n.id === noteId);
      if (encounterNote) {
        setSelectedEncounterNote(encounterNote);
        setShowEncounterNoteDialog(true);
      }
    } else {
      setSelectedNoteId(noteId);
      loadNote(noteId);
    }
  };

  const handleMenuOpen = (event, note) => {
    setAnchorEl(event.currentTarget);
    setSelectedNote(note);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedNote(null);
  };

  const handleAddendum = async () => {
    if (selectedNote) {
      setAddendumNoteId(selectedNote.id);
      
      try {
        let fullNote;
        let originalContent;
        
        // Check if this is an encounter note
        if (selectedNote.id.startsWith('encounter-')) {
          // For encounter notes, use the data we already have
          fullNote = selectedNote;
          originalContent = `=== ORIGINAL ENCOUNTER NOTE (${format(new Date(fullNote.createdAt || fullNote.encounterDate), 'MM/dd/yyyy h:mm a')}) ===\n\n`;
        } else {
          // Always fetch the full note details to ensure we have all content
          try {
            const response = await api.get(`/api/clinical/notes/${selectedNote.id}`);
            fullNote = response.data;
            originalContent = `=== ORIGINAL NOTE (${format(new Date(fullNote.created_at || fullNote.createdAt), 'MM/dd/yyyy h:mm a')}) ===\n\n`;
          } catch (fetchError) {
            console.error('Error fetching note, using cached data:', fetchError);
            // Fall back to cached data if fetch fails
            fullNote = selectedNote;
            originalContent = `=== ORIGINAL NOTE (${format(new Date(fullNote.createdAt || fullNote.created_at), 'MM/dd/yyyy h:mm a')}) ===\n\n`;
          }
        }
        
        // Build note content from all available fields, including raw text
        const sections = [];
        
        // Debug: Log all fields
        // Add any content field (for notes that might have a general content field or markdown-style notes)
        if (fullNote.content) {
          sections.push(fullNote.content);
        }
        
        // For encounter notes or notes stored as plain text in the notes field
        if (fullNote.notes) {
          sections.push(fullNote.notes);
        }
        
        // Check if any of the text fields contain the full note content (markdown style)
        // Some notes might store everything in one field like assessment
        const possibleFullTextFields = [
          fullNote.assessment,
          fullNote.subjective,
          fullNote.objective,
          fullNote.plan,
          fullNote.chief_complaint
        ];
        
        // Check if any field contains markdown-style headers (indicates full note content)
        const markdownPattern = /^(#{1,3}\s|[\d-]+\n|Patient is presenting)/m;
        const fullTextField = possibleFullTextFields.find(field => 
          field && (field.includes('# Chief Complaint') || 
                   field.includes('# History of Present Illness') ||
                   field.includes('# Assessment and Plan') ||
                   markdownPattern.test(field))
        );
        
        if (fullTextField && sections.length === 0) {
          // This field contains the full note, add it as is
          sections.push(fullTextField);
        } else {
          // Add structured fields if they exist and haven't been added yet
          if (fullNote.chief_complaint && !fullTextField) {
            sections.push(`Chief Complaint:\n${fullNote.chief_complaint}`);
          }
          if (fullNote.history_present_illness && !fullTextField) {
            sections.push(`History of Present Illness:\n${fullNote.history_present_illness}`);
          }
          if (fullNote.subjective && !fullTextField) {
            sections.push(`Subjective:\n${fullNote.subjective}`);
          }
          if (fullNote.objective && !fullTextField) {
            sections.push(`Objective:\n${fullNote.objective}`);
          }
          if (fullNote.assessment && !fullTextField) {
            sections.push(`Assessment:\n${fullNote.assessment}`);
          }
          if (fullNote.plan && !fullTextField) {
            sections.push(`Plan:\n${fullNote.plan}`);
          }
          if (fullNote.review_of_systems) {
            // Handle review_of_systems as JSON object
            if (typeof fullNote.review_of_systems === 'object') {
              const ros = Object.entries(fullNote.review_of_systems)
                .map(([system, findings]) => `  ${system}: ${findings}`)
                .join('\n');
              if (ros) {
                sections.push(`Review of Systems:\n${ros}`);
              }
            }
          }
          if (fullNote.physical_exam) {
            // Handle physical_exam as JSON object
            if (typeof fullNote.physical_exam === 'object') {
              const pe = Object.entries(fullNote.physical_exam)
                .map(([system, findings]) => `  ${system}: ${findings}`)
                .join('\n');
              if (pe) {
                sections.push(`Physical Exam:\n${pe}`);
              }
            }
          }
        }
        
        // If no content was found, check all possible fields
        if (sections.length === 0) {
          // Try to get any text content from the note
          const allFields = Object.entries(fullNote).filter(([key, value]) => 
            typeof value === 'string' && 
            value.length > 0 && 
            !['id', 'patient_id', 'encounter_id', 'author_id', 'status', 'note_type', 'template_id', 'parent_note_id', 'cosigner_id'].includes(key) &&
            !key.includes('_at') && !key.includes('_id')
          );
          
          if (allFields.length > 0) {
            allFields.forEach(([key, value]) => {
              sections.push(`${key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:\n${value}`);
            });
          } else {
            sections.push('[No content available in original note]');
          }
        }
        
        // Join all sections with double newlines
        const noteContent = sections.join('\n\n');
        
        setAddendumContent(originalContent + noteContent + '\n\n=== ADDENDUM ===\n\n');
        setShowAddendumDialog(true);
      } catch (error) {
        console.error('Error loading note for addendum:', error);
        alert('Error loading note content');
      }
    }
    handleMenuClose();
  };

  const handleCreateAddendum = async () => {
    if (!addendumNoteId || !addendumContent.trim()) return;

    try {
      // Check if this is an encounter note
      if (addendumNoteId.startsWith('encounter-')) {
        // For encounter notes, create a new clinical note with the content
        const encounterId = addendumNoteId.replace('encounter-', '');
        
        // Create a new progress note
        await api.post('/api/clinical/notes/', {
          patient_id: currentPatient.id,
          encounter_id: encounterId,
          note_type: 'progress_note',
          assessment: addendumContent,
          status: 'draft'
        });
        
        alert('Created a new progress note based on the encounter note. You can now edit and sign it.');
      } else {
        // For clinical notes, create an addendum
        await createAddendum(addendumNoteId, addendumContent);
      }
      
      setShowAddendumDialog(false);
      setAddendumContent('');
      setAddendumNoteId(null);
      
      // Reload notes to show the new addendum/note
      if (currentPatient) {
        loadRecentNotes(currentPatient.id);
      }
    } catch (error) {
      console.error('Error creating addendum:', error);
      alert(`Error creating addendum: ${error.response?.data?.detail || error.message}`);
    }
  };

  const handleViewNote = () => {
    if (selectedNote) {
      handleSelectNote(selectedNote.id);
    }
    handleMenuClose();
  };

  const getNoteStatusIcon = (status) => {
    switch (status) {
      case 'signed':
        return <SignedIcon color="success" fontSize="small" />;
      case 'draft':
      case 'pending_signature':
        return <DraftIcon color="warning" fontSize="small" />;
      default:
        return null;
    }
  };

  const getNoteTypeLabel = (type) => {
    const labels = {
      'progress_note': 'Progress Note',
      'admission_note': 'Admission Note',
      'discharge_summary': 'Discharge Summary',
      'procedure_note': 'Procedure Note',
      'consult_note': 'Consultation Note',
      'addendum': 'Addendum'
    };
    return labels[type] || type;
  };

  return (
    <Box sx={{ p: 3 }}>
      <Grid container spacing={3}>
        {/* Note List */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ height: 'calc(100vh - 250px)', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="h6">Clinical Notes</Typography>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={handleNewNote}
                >
                  New Note
                </Button>
              </Box>
            </Box>

            <Box sx={{ flex: 1, overflow: 'auto' }}>
              {(recentNotes.length > 0 || encounterNotes.length > 0) ? (
                <List>
                  {/* Combine and sort all notes by date */}
                  {[...recentNotes, ...encounterNotes]
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                    .map((note) => (
                    <ListItem
                      key={note.id}
                      disablePadding
                      secondaryAction={
                        <IconButton
                          edge="end"
                          onClick={(e) => handleMenuOpen(e, note)}
                        >
                          <MoreIcon />
                        </IconButton>
                      }
                    >
                      <ListItemButton
                        selected={selectedNoteId === note.id}
                        onClick={() => handleSelectNote(note.id)}
                      >
                        <ListItemIcon>
                          {getNoteStatusIcon(note.status)}
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Box display="flex" alignItems="center" gap={1}>
                              <Typography variant="body2">
                                {getNoteTypeLabel(note.noteType)}
                              </Typography>
                              {note.type === 'encounter' && (
                                <Chip label="Encounter" size="small" color="info" />
                              )}
                              {note.status === 'draft' && (
                                <Chip label="Draft" size="small" color="warning" />
                              )}
                            </Box>
                          }
                          secondary={
                            <Box>
                              <Typography variant="caption" display="block">
                                {format(new Date(note.createdAt), 'MM/dd/yyyy h:mm a')}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                By: {note.authorName || note.authorId || 'Provider'}
                              </Typography>
                            </Box>
                          }
                        />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Box sx={{ p: 3, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    No notes found
                  </Typography>
                </Box>
              )}
            </Box>
          </Paper>
        </Grid>

        {/* Note Editor */}
        <Grid item xs={12} md={8}>
          {selectedNoteId || currentNote ? (
            <SOAPEditor
              noteId={selectedNoteId || undefined}
              onSave={() => {
                if (currentPatient) {
                  loadRecentNotes(currentPatient.id);
                }
              }}
              onSign={() => {
                if (currentPatient) {
                  loadRecentNotes(currentPatient.id);
                }
              }}
            />
          ) : (
            <Paper sx={{ p: 4, textAlign: 'center', height: 'calc(100vh - 250px)' }}>
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%'
                }}
              >
                <NoteIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  Select a note to view or edit
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Or create a new note to document this visit
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={handleNewNote}
                >
                  Create New Note
                </Button>
              </Box>
            </Paper>
          )}
        </Grid>
      </Grid>

      {/* Note Actions Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleViewNote}>
          <ListItemIcon>
            <ViewIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>View</ListItemText>
        </MenuItem>
        {selectedNote?.status === 'signed' && (
          <MenuItem onClick={handleAddendum}>
            <ListItemIcon>
              <EditIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>
              {selectedNote?.id?.startsWith('encounter-') ? 'Edit as New Note' : 'Add Addendum'}
            </ListItemText>
          </MenuItem>
        )}
      </Menu>

      {/* New Note Dialog */}
      <Dialog
        open={showNewNoteDialog}
        onClose={() => setShowNewNoteDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create New Note</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>Note Type</InputLabel>
              <Select
                value={newNoteType}
                onChange={(e) => setNewNoteType(e.target.value)}
                label="Note Type"
              >
                <MenuItem value="progress_note">Progress Note</MenuItem>
                <MenuItem value="admission_note">Admission Note</MenuItem>
                <MenuItem value="discharge_summary">Discharge Summary</MenuItem>
                <MenuItem value="procedure_note">Procedure Note</MenuItem>
                <MenuItem value="consult_note">Consultation Note</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Template (Optional)</InputLabel>
              <Select
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                label="Template (Optional)"
              >
                <MenuItem value="">
                  <em>No template</em>
                </MenuItem>
                {(noteTemplates || [])
                  .filter(t => !t.noteType || t.noteType === newNoteType)
                  .map(template => (
                    <MenuItem key={template.id} value={template.id}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <TemplateIcon fontSize="small" />
                        {template.name}
                      </Box>
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowNewNoteDialog(false)}>Cancel</Button>
          <Button onClick={handleCreateNote} variant="contained">
            Create Note
          </Button>
        </DialogActions>
      </Dialog>

      {/* Encounter Note View Dialog */}
      <Dialog
        open={showEncounterNoteDialog}
        onClose={() => setShowEncounterNoteDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">
              {selectedEncounterNote?.noteType || 'Encounter Note'}
            </Typography>
            <Chip label="Read Only" size="small" color="info" />
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedEncounterNote && (
            <Box sx={{ pt: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Date: {format(new Date(selectedEncounterNote.encounterDate), 'MM/dd/yyyy h:mm a')}
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Paper sx={{ p: 2, backgroundColor: 'grey.50' }}>
                <Typography
                  variant="body1"
                  component="pre"
                  sx={{
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'monospace',
                    fontSize: '0.9rem'
                  }}
                >
                  {selectedEncounterNote.content}
                </Typography>
              </Paper>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowEncounterNoteDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Addendum Dialog */}
      <Dialog
        open={showAddendumDialog}
        onClose={() => setShowAddendumDialog(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          {addendumNoteId?.startsWith('encounter-') ? 'Edit Encounter Note' : 'Add Addendum to Note'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Alert severity="info" sx={{ mb: 2 }}>
              {addendumNoteId?.startsWith('encounter-') ? (
                <>
                  <Typography variant="body2">
                    You are creating a new progress note based on this encounter note.
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    • The original encounter note is shown below for reference
                    • You can edit and enhance the content
                    • This will create a new clinical note that you can sign
                  </Typography>
                </>
              ) : (
                <>
                  <Typography variant="body2">
                    You are creating an addendum to a signed note. The original note content is shown below for reference.
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    • You can edit any part of the content below
                    • The addendum will be saved as a new version
                    • The original note will remain unchanged
                  </Typography>
                </>
              )}
            </Alert>
            <TextField
              fullWidth
              multiline
              rows={20}
              value={addendumContent}
              onChange={(e) => setAddendumContent(e.target.value)}
              placeholder="Enter your addendum content here..."
              variant="outlined"
              autoFocus
              sx={{ 
                fontFamily: 'monospace',
                '& .MuiInputBase-input': {
                  fontSize: '0.9rem',
                  lineHeight: 1.6
                }
              }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Tip: You can modify the original content or add new information in the ADDENDUM section
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddendumDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleCreateAddendum} 
            variant="contained"
            disabled={!addendumContent.trim()}
          >
            Save Addendum
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DocumentationTab;