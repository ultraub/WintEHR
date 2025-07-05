/**
 * DocumentationMode Component
 * Complete clinical documentation system with rich text editing, templates, and FHIR integration
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  Grid,
  Card,
  CardContent,
  CardActions,
  Chip,
  Stack,
  CircularProgress,
  IconButton,
  Tooltip,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemButton,
  Divider,
  Badge,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Collapse,
  useTheme,
  alpha,
  Skeleton,
  Fade,
  LinearProgress,
  FormControlLabel,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Menu,
  Autocomplete,
  Snackbar
} from '@mui/material';
import {
  Description as DocumentIcon,
  Save as SaveIcon,
  Check as CheckIcon,
  Mic as MicIcon,
  MicOff as MicOffIcon,
  History as HistoryIcon,
  Timer as TimerIcon,
  AutoAwesome as AutoAwesomeIcon,
  ContentCopy as CopyIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Add as AddIcon,
  KeyboardArrowDown as ArrowDownIcon,
  KeyboardArrowUp as ArrowUpIcon,
  Medication as MedicationIcon,
  Healing as ConditionIcon,
  MonitorHeart as VitalsIcon,
  Science as LabIcon,
  Warning as WarningIcon,
  Person as PersonIcon,
  Event as EventIcon,
  FiberManualRecord as DotIcon,
  FormatQuote as QuoteIcon,
  Subject as SubjectIcon,
  Assessment as AssessmentIcon,
  IntegrationInstructions as PlanIcon,
  LocalHospital as HospitalIcon,
  Assignment as TaskIcon,
  ChevronRight as ChevronRightIcon,
  Refresh as RefreshIcon,
  Close as CloseIcon,
  Search as SearchIcon
} from '@mui/icons-material';
import { format, parseISO, formatDistanceToNow, isToday, differenceInMinutes } from 'date-fns';
import { useNavigate, useParams } from 'react-router-dom';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import { fhirClient } from '../../../../services/fhirClient';
import { 
  useConditions,
  useEncounters,
  useMedications,
  useObservations,
  usePatientResourceType
} from '../../../../hooks/useFHIRResources';

// Note templates
const NOTE_TEMPLATES = {
  soap: {
    name: 'SOAP Note',
    icon: <SubjectIcon />,
    sections: {
      subjective: { title: 'Subjective', placeholder: 'Patient complaints, symptoms, and history...' },
      objective: { title: 'Objective', placeholder: 'Physical exam findings, vital signs, lab results...' },
      assessment: { title: 'Assessment', placeholder: 'Clinical assessment and differential diagnosis...' },
      plan: { title: 'Plan', placeholder: 'Treatment plan, medications, follow-up...' }
    }
  },
  progress: {
    name: 'Progress Note',
    icon: <TaskIcon />,
    sections: {
      interval: { title: 'Interval History', placeholder: 'Changes since last visit...' },
      exam: { title: 'Examination', placeholder: 'Current physical examination findings...' },
      assessment: { title: 'Assessment', placeholder: 'Current status and progress...' },
      plan: { title: 'Plan', placeholder: 'Continued care plan...' }
    }
  },
  consultation: {
    name: 'Consultation Note',
    icon: <HospitalIcon />,
    sections: {
      reason: { title: 'Reason for Consultation', placeholder: 'Referral reason and questions to address...' },
      history: { title: 'History & Findings', placeholder: 'Relevant history and examination findings...' },
      assessment: { title: 'Consultant Assessment', placeholder: 'Expert opinion and recommendations...' },
      recommendations: { title: 'Recommendations', placeholder: 'Specific treatment recommendations...' }
    }
  },
  procedure: {
    name: 'Procedure Note',
    icon: <HospitalIcon />,
    sections: {
      indications: { title: 'Indications', placeholder: 'Reason for procedure...' },
      procedure: { title: 'Procedure Details', placeholder: 'Technical details of procedure performed...' },
      findings: { title: 'Findings', placeholder: 'Intraoperative findings...' },
      postProcedure: { title: 'Post-Procedure Plan', placeholder: 'Recovery and follow-up plan...' }
    }
  }
};

// Smart snippets for common documentation
const SMART_SNIPPETS = {
  vitals: { label: 'Latest Vitals', icon: <VitalsIcon /> },
  medications: { label: 'Current Medications', icon: <MedicationIcon /> },
  problems: { label: 'Active Problems', icon: <ConditionIcon /> },
  allergies: { label: 'Allergies', icon: <WarningIcon /> },
  labs: { label: 'Recent Labs', icon: <LabIcon /> }
};

// Rich text editor component (simplified for now)
const RichTextEditor = ({ value, onChange, placeholder, autoFocus = false }) => {
  const textAreaRef = useRef(null);
  
  useEffect(() => {
    if (autoFocus && textAreaRef.current) {
      textAreaRef.current.focus();
    }
  }, [autoFocus]);

  const insertAtCursor = (text) => {
    const textarea = textAreaRef.current;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newValue = value.substring(0, start) + text + value.substring(end);
    onChange(newValue);
    
    // Set cursor position after inserted text
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + text.length;
      textarea.focus();
    }, 0);
  };

  return (
    <TextField
      ref={textAreaRef}
      multiline
      fullWidth
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      variant="outlined"
      minRows={4}
      maxRows={20}
      sx={{
        '& .MuiOutlinedInput-root': {
          fontSize: '14px',
          lineHeight: 1.6,
          fontFamily: 'Roboto, sans-serif'
        }
      }}
      InputProps={{
        sx: { p: 1.5 }
      }}
    />
  );
};

// Auto-save indicator
const AutoSaveIndicator = ({ lastSaved, isSaving }) => {
  if (isSaving) {
    return (
      <Chip
        icon={<CircularProgress size={16} />}
        label="Saving..."
        size="small"
        color="primary"
        variant="outlined"
      />
    );
  }
  
  if (lastSaved) {
    return (
      <Chip
        icon={<CheckIcon />}
        label={`Saved ${formatDistanceToNow(lastSaved)} ago`}
        size="small"
        color="success"
        variant="outlined"
      />
    );
  }
  
  return null;
};

// Previous notes viewer
const PreviousNotesViewer = ({ patientId, onSelectNote }) => {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedNote, setSelectedNote] = useState(null);

  useEffect(() => {
    const loadNotes = async () => {
      if (!patientId) return;
      
      try {
        setLoading(true);
        const result = await fhirClient.search('DocumentReference', {
          patient: patientId,
          _sort: '-date',
          _count: 20
        });
        
        setNotes(result.resources || []);
      } catch (error) {
        console.error('Error loading previous notes:', error);
      } finally {
        setLoading(false);
      }
    };

    loadNotes();
  }, [patientId]);

  if (loading) {
    return (
      <Box sx={{ p: 2 }}>
        <Skeleton variant="rectangular" height={100} />
        <Skeleton variant="rectangular" height={100} sx={{ mt: 1 }} />
      </Box>
    );
  }

  return (
    <List dense>
      {notes.length === 0 ? (
        <ListItem>
          <ListItemText
            primary="No previous notes"
            secondary="Start documenting to build patient history"
          />
        </ListItem>
      ) : (
        notes.map((note) => (
          <ListItemButton
            key={note.id}
            selected={selectedNote?.id === note.id}
            onClick={() => {
              setSelectedNote(note);
              onSelectNote?.(note);
            }}
          >
            <ListItemIcon>
              <DocumentIcon />
            </ListItemIcon>
            <ListItemText
              primary={note.type?.text || 'Clinical Note'}
              secondary={
                <Stack spacing={0}>
                  <Typography variant="caption">
                    {note.date ? format(parseISO(note.date), 'MMM dd, yyyy h:mm a') : 'No date'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {note.author?.[0]?.display || 'Unknown author'}
                  </Typography>
                </Stack>
              }
            />
          </ListItemButton>
        ))
      )}
    </List>
  );
};

// Patient context panel
const PatientContextPanel = ({ patientId }) => {
  const theme = useTheme();
  // Get patient context data using individual hooks
  const conditionsData = useConditions(patientId);
  const medicationsData = useMedications(patientId);
  const observationsData = useObservations(patientId);
  const allergiesData = usePatientResourceType(patientId, 'AllergyIntolerance');
  
  const loading = conditionsData.loading || medicationsData.loading || 
                 observationsData.loading || allergiesData.loading;
                 
  const conditions = conditionsData.activeConditions || [];
  const medications = medicationsData.activeMedications || [];
  const observations = observationsData.observations || [];
  const allergies = allergiesData.resources || [];

  const vitals = useMemo(() => {
    return observations.filter(obs => 
      ['8310-5', '8867-4', '9279-1', '8480-6', '8462-4'].includes(obs.code?.coding?.[0]?.code)
    ).slice(0, 5);
  }, [observations]);

  const labs = useMemo(() => {
    return observations.filter(obs => 
      obs.category?.[0]?.coding?.[0]?.code === 'laboratory'
    ).slice(0, 5);
  }, [observations]);

  const activeConditions = useMemo(() => {
    return conditions.filter(c => 
      c.clinicalStatus?.coding?.[0]?.code === 'active'
    );
  }, [conditions]);

  const activeMedications = useMemo(() => {
    return medications.filter(m => 
      m.status === 'active'
    );
  }, [medications]);

  if (loading) {
    return (
      <Box sx={{ p: 2 }}>
        <Skeleton variant="rectangular" height={150} />
      </Box>
    );
  }

  return (
    <Stack spacing={2}>
      {/* Active Problems */}
      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle2" color="primary" gutterBottom>
            <Stack direction="row" alignItems="center" spacing={1}>
              <ConditionIcon fontSize="small" />
              <span>Active Problems ({activeConditions.length})</span>
            </Stack>
          </Typography>
          <List dense disablePadding>
            {activeConditions.slice(0, 3).map((condition) => (
              <ListItem key={condition.id} disablePadding>
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <DotIcon fontSize="small" color="error" />
                </ListItemIcon>
                <ListItemText
                  primary={condition.code?.text || 'Unknown'}
                  secondary={condition.onsetDateTime ? 
                    `Since ${format(parseISO(condition.onsetDateTime), 'MMM yyyy')}` : null
                  }
                  primaryTypographyProps={{ variant: 'body2' }}
                  secondaryTypographyProps={{ variant: 'caption' }}
                />
              </ListItem>
            ))}
          </List>
        </CardContent>
      </Card>

      {/* Current Medications */}
      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle2" color="primary" gutterBottom>
            <Stack direction="row" alignItems="center" spacing={1}>
              <MedicationIcon fontSize="small" />
              <span>Current Medications ({activeMedications.length})</span>
            </Stack>
          </Typography>
          <List dense disablePadding>
            {activeMedications.slice(0, 3).map((med) => (
              <ListItem key={med.id} disablePadding>
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <DotIcon fontSize="small" color="primary" />
                </ListItemIcon>
                <ListItemText
                  primary={med.medicationCodeableConcept?.text || 'Unknown'}
                  secondary={med.dosageInstruction?.[0]?.text}
                  primaryTypographyProps={{ variant: 'body2' }}
                  secondaryTypographyProps={{ variant: 'caption' }}
                />
              </ListItem>
            ))}
          </List>
        </CardContent>
      </Card>

      {/* Recent Vitals */}
      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle2" color="primary" gutterBottom>
            <Stack direction="row" alignItems="center" spacing={1}>
              <VitalsIcon fontSize="small" />
              <span>Recent Vitals</span>
            </Stack>
          </Typography>
          <List dense disablePadding>
            {vitals.map((vital) => (
              <ListItem key={vital.id} disablePadding>
                <ListItemText
                  primary={`${vital.code?.text}: ${vital.valueQuantity?.value} ${vital.valueQuantity?.unit}`}
                  secondary={vital.effectiveDateTime ? 
                    format(parseISO(vital.effectiveDateTime), 'MMM dd, h:mm a') : null
                  }
                  primaryTypographyProps={{ variant: 'body2' }}
                  secondaryTypographyProps={{ variant: 'caption' }}
                />
              </ListItem>
            ))}
          </List>
        </CardContent>
      </Card>

      {/* Allergies */}
      {allergies.length > 0 && (
        <Alert severity="warning" variant="outlined">
          <Typography variant="subtitle2" gutterBottom>
            Allergies & Intolerances
          </Typography>
          {allergies.map((allergy) => (
            <Typography key={allergy.id} variant="body2">
              • {allergy.code?.text || 'Unknown'} 
              {allergy.reaction?.[0]?.manifestation?.[0]?.text && 
                ` - ${allergy.reaction[0].manifestation[0].text}`}
            </Typography>
          ))}
        </Alert>
      )}
    </Stack>
  );
};

// Template library dialog
const TemplateLibraryDialog = ({ open, onClose, onSelectTemplate }) => {
  const [selectedTemplate, setSelectedTemplate] = useState('soap');

  const handleSelect = () => {
    onSelectTemplate(selectedTemplate);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Select Note Template</DialogTitle>
      <DialogContent>
        <List>
          {Object.entries(NOTE_TEMPLATES).map(([key, template]) => (
            <ListItemButton
              key={key}
              selected={selectedTemplate === key}
              onClick={() => setSelectedTemplate(key)}
              sx={{ borderRadius: 1, mb: 1 }}
            >
              <ListItemIcon>
                {template.icon}
              </ListItemIcon>
              <ListItemText
                primary={template.name}
                secondary={`Sections: ${Object.keys(template.sections).join(', ')}`}
              />
            </ListItemButton>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSelect} variant="contained">
          Use Template
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Main DocumentationMode component
const DocumentationMode = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { patientId } = useParams();
  const { currentPatient, searchResources } = useFHIRResource();
  
  // State management
  const [selectedTemplate, setSelectedTemplate] = useState('soap');
  const [sections, setSections] = useState({});
  const [noteTitle, setNoteTitle] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [lastSaved, setLastSaved] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showPreviousNotes, setShowPreviousNotes] = useState(true);
  const [currentSection, setCurrentSection] = useState(null);
  const [showSnippetMenu, setShowSnippetMenu] = useState(null);
  const [draftId, setDraftId] = useState(null);
  const [noteStatus, setNoteStatus] = useState('draft');
  const [expandedSections, setExpandedSections] = useState({});
  const [searchTerm, setSearchTerm] = useState('');

  // Initialize sections based on template
  useEffect(() => {
    const template = NOTE_TEMPLATES[selectedTemplate];
    if (template) {
      const initialSections = {};
      Object.keys(template.sections).forEach(key => {
        initialSections[key] = sections[key] || '';
      });
      setSections(initialSections);
      
      // Set all sections as expanded by default
      const expanded = {};
      Object.keys(template.sections).forEach(key => {
        expanded[key] = true;
      });
      setExpandedSections(expanded);
    }
  }, [selectedTemplate]);

  // Auto-save functionality
  useEffect(() => {
    if (!autoSaveEnabled || !draftId) return;

    const saveTimer = setTimeout(async () => {
      if (Object.values(sections).some(content => content.trim())) {
        await saveDraft();
      }
    }, 3000); // Save after 3 seconds of inactivity

    return () => clearTimeout(saveTimer);
  }, [sections, noteTitle, autoSaveEnabled, draftId]);

  // Save draft
  const saveDraft = async () => {
    setIsSaving(true);
    try {
      const documentReference = {
        resourceType: 'DocumentReference',
        id: draftId,
        status: 'current',
        docStatus: 'preliminary',
        type: {
          coding: [{
            system: 'http://loinc.org',
            code: '34117-2',
            display: 'History and physical note'
          }],
          text: NOTE_TEMPLATES[selectedTemplate].name
        },
        subject: {
          reference: `Patient/${patientId}`
        },
        date: new Date().toISOString(),
        author: [{
          reference: 'Practitioner/current', // Would be actual practitioner ID
          display: 'Current Provider'
        }],
        description: noteTitle || `${NOTE_TEMPLATES[selectedTemplate].name} - Draft`,
        content: [{
          attachment: {
            contentType: 'text/plain',
            data: btoa(JSON.stringify({ sections, template: selectedTemplate }))
          }
        }]
      };

      if (draftId) {
        await fhirClient.update('DocumentReference', draftId, documentReference);
      } else {
        const result = await fhirClient.create('DocumentReference', documentReference);
        setDraftId(result.id);
      }

      setLastSaved(new Date());
    } catch (error) {
      console.error('Error saving draft:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Sign and finalize note
  const signNote = async () => {
    if (!Object.values(sections).some(content => content.trim())) {
      alert('Please add content to the note before signing.');
      return;
    }

    try {
      const noteContent = Object.entries(sections)
        .map(([key, content]) => {
          const section = NOTE_TEMPLATES[selectedTemplate].sections[key];
          return `${section.title}:\n${content}`;
        })
        .join('\n\n');

      const documentReference = {
        resourceType: 'DocumentReference',
        status: 'current',
        docStatus: 'final',
        type: {
          coding: [{
            system: 'http://loinc.org',
            code: '34117-2',
            display: 'History and physical note'
          }],
          text: NOTE_TEMPLATES[selectedTemplate].name
        },
        subject: {
          reference: `Patient/${patientId}`
        },
        date: new Date().toISOString(),
        author: [{
          reference: 'Practitioner/current',
          display: 'Current Provider'
        }],
        authenticator: {
          reference: 'Practitioner/current',
          display: 'Current Provider'
        },
        description: noteTitle || NOTE_TEMPLATES[selectedTemplate].name,
        content: [{
          attachment: {
            contentType: 'text/plain',
            data: btoa(noteContent),
            creation: new Date().toISOString()
          }
        }]
      };

      await fhirClient.create('DocumentReference', documentReference);
      
      // Clear the form
      setSections({});
      setNoteTitle('');
      setDraftId(null);
      setLastSaved(null);
      
      // Show success message
      alert('Note signed and saved successfully!');
      
      // Refresh notes list
      window.location.reload();
    } catch (error) {
      console.error('Error signing note:', error);
      alert('Error signing note. Please try again.');
    }
  };

  // Insert smart snippet
  const insertSnippet = async (snippetType) => {
    if (!currentSection) return;

    let snippetText = '';
    
    try {
      switch (snippetType) {
        case 'vitals':
          const vitalsResult = await searchResources('Observation', {
            patient: patientId,
            category: 'vital-signs',
            _sort: '-date',
            _count: 5
          });
          
          if (vitalsResult.resources?.length > 0) {
            snippetText = '\n\nVital Signs:\n';
            vitalsResult.resources.forEach(vital => {
              snippetText += `• ${vital.code?.text}: ${vital.valueQuantity?.value} ${vital.valueQuantity?.unit}`;
              if (vital.effectiveDateTime) {
                snippetText += ` (${format(parseISO(vital.effectiveDateTime), 'MMM dd, h:mm a')})`;
              }
              snippetText += '\n';
            });
          }
          break;

        case 'medications':
          const medsResult = await searchResources('MedicationRequest', {
            patient: patientId,
            status: 'active',
            _sort: '-authoredon'
          });
          
          if (medsResult.resources?.length > 0) {
            snippetText = '\n\nCurrent Medications:\n';
            medsResult.resources.forEach(med => {
              snippetText += `• ${med.medicationCodeableConcept?.text || 'Unknown medication'}`;
              if (med.dosageInstruction?.[0]?.text) {
                snippetText += ` - ${med.dosageInstruction[0].text}`;
              }
              snippetText += '\n';
            });
          }
          break;

        case 'problems':
          const conditionsResult = await searchResources('Condition', {
            patient: patientId,
            'clinical-status': 'active'
          });
          
          if (conditionsResult.resources?.length > 0) {
            snippetText = '\n\nActive Problems:\n';
            conditionsResult.resources.forEach(condition => {
              snippetText += `• ${condition.code?.text || 'Unknown condition'}`;
              if (condition.onsetDateTime) {
                snippetText += ` (onset: ${format(parseISO(condition.onsetDateTime), 'MMM yyyy')})`;
              }
              snippetText += '\n';
            });
          }
          break;

        case 'allergies':
          const allergyResult = await searchResources('AllergyIntolerance', {
            patient: patientId,
            'clinical-status': 'active'
          });
          
          if (allergyResult.resources?.length > 0) {
            snippetText = '\n\nAllergies:\n';
            allergyResult.resources.forEach(allergy => {
              snippetText += `• ${allergy.code?.text || 'Unknown allergen'}`;
              if (allergy.reaction?.[0]?.manifestation?.[0]?.text) {
                snippetText += ` - Reaction: ${allergy.reaction[0].manifestation[0].text}`;
              }
              snippetText += '\n';
            });
          } else {
            snippetText = '\n\nAllergies: No known allergies\n';
          }
          break;

        case 'labs':
          const labsResult = await searchResources('Observation', {
            patient: patientId,
            category: 'laboratory',
            _sort: '-date',
            _count: 10
          });
          
          if (labsResult.resources?.length > 0) {
            snippetText = '\n\nRecent Lab Results:\n';
            labsResult.resources.forEach(lab => {
              snippetText += `• ${lab.code?.text}: ${lab.valueQuantity?.value || lab.valueString || 'pending'} ${lab.valueQuantity?.unit || ''}`;
              if (lab.effectiveDateTime) {
                snippetText += ` (${format(parseISO(lab.effectiveDateTime), 'MMM dd')})`;
              }
              snippetText += '\n';
            });
          }
          break;
      }

      if (snippetText) {
        setSections(prev => ({
          ...prev,
          [currentSection]: prev[currentSection] + snippetText
        }));
      }
    } catch (error) {
      console.error('Error inserting snippet:', error);
    }

    setShowSnippetMenu(null);
  };

  // Toggle voice recording (mock implementation)
  const toggleRecording = () => {
    setIsRecording(!isRecording);
    if (!isRecording) {
      // TODO: Implement actual voice recording
      console.log('Voice recording would start here');
    } else {
      // TODO: Stop recording and transcribe
      console.log('Voice recording would stop here');
    }
  };

  // Handle template change
  const handleTemplateChange = (templateKey) => {
    if (Object.values(sections).some(content => content.trim())) {
      if (window.confirm('Changing templates will clear your current content. Continue?')) {
        setSelectedTemplate(templateKey);
        setSections({});
        setNoteTitle('');
      }
    } else {
      setSelectedTemplate(templateKey);
    }
    setShowTemplateDialog(false);
  };

  // Toggle section expansion
  const toggleSection = (sectionKey) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  const template = NOTE_TEMPLATES[selectedTemplate];

  return (
    <>
      {/* Left Panel - Note Editor */}
      <Paper 
        elevation={0} 
        sx={{ 
          height: '100%', 
          display: 'flex', 
          flexDirection: 'column',
          borderRight: 1,
          borderColor: 'divider'
        }}
      >
        {/* Header */}
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Stack direction="row" alignItems="center" spacing={2}>
              <DocumentIcon color="primary" fontSize="large" />
              <Box>
                <Typography variant="h6">Clinical Documentation</Typography>
                <Typography variant="caption" color="text.secondary">
                  {currentPatient?.name?.[0]?.given?.join(' ')} {currentPatient?.name?.[0]?.family}
                </Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <AutoSaveIndicator lastSaved={lastSaved} isSaving={isSaving} />
              <FormControlLabel
                control={
                  <Switch
                    checked={autoSaveEnabled}
                    onChange={(e) => setAutoSaveEnabled(e.target.checked)}
                    size="small"
                  />
                }
                label="Auto-save"
                sx={{ mr: 2 }}
              />
            </Stack>
          </Stack>
        </Box>

        {/* Template Selection & Title */}
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Stack spacing={2}>
            <Stack direction="row" spacing={2}>
              <Button
                variant="outlined"
                startIcon={template.icon}
                endIcon={<ArrowDownIcon />}
                onClick={() => setShowTemplateDialog(true)}
                fullWidth
              >
                {template.name}
              </Button>
              <Tooltip title={isRecording ? "Stop recording" : "Start voice dictation"}>
                <IconButton
                  color={isRecording ? "error" : "default"}
                  onClick={toggleRecording}
                  sx={{
                    bgcolor: isRecording ? alpha(theme.palette.error.main, 0.1) : 'transparent'
                  }}
                >
                  {isRecording ? <MicOffIcon /> : <MicIcon />}
                </IconButton>
              </Tooltip>
            </Stack>
            <TextField
              placeholder="Note title (optional)"
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              variant="outlined"
              size="small"
              fullWidth
            />
          </Stack>
        </Box>

        {/* Editor Sections */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          <Stack spacing={2}>
            {Object.entries(template.sections).map(([key, section]) => (
              <Card key={key} variant="outlined">
                <CardContent sx={{ p: 2 }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                    <Typography variant="subtitle1" color="primary">
                      {section.title}
                    </Typography>
                    <Stack direction="row" spacing={1}>
                      <Menu
                        anchorEl={showSnippetMenu}
                        open={Boolean(showSnippetMenu) && currentSection === key}
                        onClose={() => setShowSnippetMenu(null)}
                      >
                        {Object.entries(SMART_SNIPPETS).map(([snippetKey, snippet]) => (
                          <MenuItem
                            key={snippetKey}
                            onClick={() => insertSnippet(snippetKey)}
                          >
                            <ListItemIcon>{snippet.icon}</ListItemIcon>
                            <ListItemText>{snippet.label}</ListItemText>
                          </MenuItem>
                        ))}
                      </Menu>
                      <Tooltip title="Insert smart snippet">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            setCurrentSection(key);
                            setShowSnippetMenu(e.currentTarget);
                          }}
                        >
                          <AutoAwesomeIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <IconButton
                        size="small"
                        onClick={() => toggleSection(key)}
                      >
                        {expandedSections[key] ? <ArrowUpIcon /> : <ArrowDownIcon />}
                      </IconButton>
                    </Stack>
                  </Stack>
                  <Collapse in={expandedSections[key] !== false}>
                    <RichTextEditor
                      value={sections[key] || ''}
                      onChange={(value) => setSections(prev => ({ ...prev, [key]: value }))}
                      placeholder={section.placeholder}
                      autoFocus={false}
                    />
                  </Collapse>
                </CardContent>
              </Card>
            ))}
          </Stack>
        </Box>

        {/* Actions */}
        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
          <Stack direction="row" spacing={2}>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={saveDraft}
              disabled={!Object.values(sections).some(content => content.trim())}
            >
              Save Draft
            </Button>
            <Button
              variant="contained"
              color="success"
              startIcon={<CheckIcon />}
              onClick={signNote}
              disabled={!Object.values(sections).some(content => content.trim())}
            >
              Sign Note
            </Button>
            <Button
              variant="outlined"
              color="error"
              onClick={() => {
                if (window.confirm('Discard all changes?')) {
                  setSections({});
                  setNoteTitle('');
                  setDraftId(null);
                }
              }}
            >
              Discard
            </Button>
          </Stack>
        </Box>
      </Paper>
      
      {/* Right Panel - Relevant Data */}
      <Paper elevation={0} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Tabs value={showPreviousNotes ? 0 : 1} onChange={(e, v) => setShowPreviousNotes(v === 0)}>
          <Tab label="Previous Notes" icon={<HistoryIcon />} iconPosition="start" />
          <Tab label="Patient Context" icon={<PersonIcon />} iconPosition="start" />
        </Tabs>

        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {showPreviousNotes ? (
            <PreviousNotesViewer
              patientId={patientId}
              onSelectNote={(note) => {
                // TODO: Load note content for reference
                console.log('Selected note:', note);
              }}
            />
          ) : (
            <Box sx={{ p: 2 }}>
              <PatientContextPanel patientId={patientId} />
            </Box>
          )}
        </Box>
      </Paper>

      {/* Template Library Dialog */}
      <TemplateLibraryDialog
        open={showTemplateDialog}
        onClose={() => setShowTemplateDialog(false)}
        onSelectTemplate={handleTemplateChange}
      />
    </>
  );
};

export default DocumentationMode;