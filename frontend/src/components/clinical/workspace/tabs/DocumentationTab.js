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
  alpha
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
import { useNavigate } from 'react-router-dom';

// Note type configuration
const noteTypes = {
  'progress': { icon: <ProgressIcon />, label: 'Progress Note', color: 'primary' },
  'soap': { icon: <SOAPIcon />, label: 'SOAP Note', color: 'info' },
  'consult': { icon: <ConsultIcon />, label: 'Consultation', color: 'secondary' },
  'discharge': { icon: <DischargeIcon />, label: 'Discharge Summary', color: 'warning' },
  'assessment': { icon: <AssessmentIcon />, label: 'Assessment', color: 'success' },
  'other': { icon: <NoteIcon />, label: 'Other', color: 'default' }
};

// Note Card Component
const NoteCard = ({ note, onEdit, onView }) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  
  const noteType = note.type?.coding?.[0]?.code || 'other';
  const typeConfig = noteTypes[noteType] || noteTypes.other;
  const author = note.author?.[0]?.display || 'Unknown';
  const date = note.date || note.meta?.lastUpdated;
  const isSigned = note.status === 'final';

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box sx={{ flex: 1 }}>
            <Stack direction="row" spacing={2} alignItems="center" mb={1}>
              <Box sx={{ color: theme.palette[typeConfig.color].main }}>
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
                WebkitBoxOrient: 'vertical'
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
            <IconButton size="small">
              <PrintIcon />
            </IconButton>
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
          <Button size="small" color="primary">
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
  const [noteData, setNoteData] = useState({
    type: note?.type?.coding?.[0]?.code || 'progress',
    title: note?.title || '',
    content: note?.text || '',
    sections: {
      subjective: '',
      objective: '',
      assessment: '',
      plan: ''
    }
  });
  const [formatting, setFormatting] = useState([]);

  const handleSave = () => {
    // TODO: Implement save functionality
    console.log('Saving note:', noteData);
    onClose();
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
        <Button onClick={handleSave}>Save as Draft</Button>
        <Button variant="contained" onClick={handleSave}>
          Save & Sign
        </Button>
      </DialogActions>
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
  const { getPatientResources, isLoading } = useFHIRResource();
  
  const [tabValue, setTabValue] = useState(0);
  const [filterType, setFilterType] = useState('all');
  const [filterPeriod, setFilterPeriod] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
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

  // Mock notes for demonstration (in real app, these would come from FHIR resources)
  const mockNotes = [
    {
      id: '1',
      resourceType: 'DocumentReference',
      type: { coding: [{ code: 'progress' }] },
      status: 'final',
      date: new Date().toISOString(),
      author: [{ display: 'Dr. Smith' }],
      text: 'Patient presents with improved symptoms. Continue current treatment plan.'
    },
    {
      id: '2',
      resourceType: 'DocumentReference',
      type: { coding: [{ code: 'soap' }] },
      status: 'draft',
      date: new Date(Date.now() - 86400000).toISOString(),
      author: [{ display: 'Dr. Johnson' }],
      text: 'Follow-up visit for hypertension management.',
      section: [
        { title: 'Subjective', text: 'Patient reports compliance with medication.' },
        { title: 'Objective', text: 'BP: 130/80, HR: 72' },
        { title: 'Assessment', text: 'Hypertension - improving' },
        { title: 'Plan', text: 'Continue current medications' }
      ]
    }
  ];

  // Combine all documentation
  const allDocuments = [...documentReferences, ...compositions, ...clinicalImpressions, ...mockNotes];

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
    navigate(`/patients/${patientId}/notes/${note.id}`);
  };
  
  const handleSaveAddendum = (addendumText) => {
    // In a real app, this would create a new DocumentReference
    // linked to the original note
    console.log('Saving addendum for note:', selectedNoteForAddendum?.id);
    console.log('Addendum text:', addendumText);
    setAddendumDialogOpen(false);
    setSelectedNoteForAddendum(null);
    // Would typically refresh the documents list here
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
    </Box>
  );
};

export default DocumentationTab;