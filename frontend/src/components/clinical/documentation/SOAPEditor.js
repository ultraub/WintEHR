/**
 * SOAP Editor Component
 * Editor for clinical documentation using SOAP format
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  TextField,
  Typography,
  Button,
  IconButton,
  Tooltip,
  Alert,
  Divider,
  Chip,
  Stack
} from '@mui/material';
import {
  Save as SaveIcon,
  CheckCircle as SignIcon,
  Psychology as SmartPhraseIcon,
  Info as InfoIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { useDocumentation } from '../../../contexts/DocumentationContext';
import { useClinical } from '../../../contexts/ClinicalContext';
import { format } from 'date-fns';

const SOAPEditor = ({ noteId, onSave, onSign }) => {
  const { currentPatient, currentEncounter } = useClinical();
  const {
    currentNote,
    isDirty,
    isSaving,
    updateSOAPSection,
    saveNote,
    signNote,
    expandSmartPhrase,
    loadNote,
    createNewNote
  } = useDocumentation();

  const [activeSection, setActiveSection] = useState('subjective');
  const [showSmartPhrases, setShowSmartPhrases] = useState(false);
  const [error, setError] = useState(null);

  // Load note if ID provided
  useEffect(() => {
    if (noteId) {
      loadNote(noteId).catch(err => {
        setError('Failed to load note');
        
      });
    } else if (!currentNote) {
      // Create new note if none exists
      createNewNote('progress_note');
    }
  }, [noteId]);

  // Handle smart phrase expansion
  const handleTextChange = useCallback((section, value) => {
    // Check for smart phrases (starting with .)
    const smartPhraseMatch = value.match(/\.\w+$/);
    if (smartPhraseMatch) {
      const phrase = smartPhraseMatch[0];
      const expandedText = expandSmartPhrase(phrase);
      if (expandedText !== phrase) {
        // Replace the smart phrase with expanded text
        const newValue = value.replace(phrase, expandedText);
        updateSOAPSection(section, newValue);
        return;
      }
    }
    
    updateSOAPSection(section, value);
  }, [updateSOAPSection, expandSmartPhrase]);

  const handleSave = async () => {
    try {
      setError(null);
      await saveNote();
      if (onSave) {
        onSave();
      }
    } catch (err) {
      setError('Failed to save note');
      
    }
  };

  const handleSign = async () => {
    try {
      setError(null);
      // Save first if dirty
      if (isDirty) {
        await saveNote();
      }
      await signNote();
      if (onSign) {
        onSign();
      }
    } catch (err) {
      setError('Failed to sign note');
      
    }
  };

  const canSign = currentNote?.id && !isDirty && currentNote.status !== 'signed';
  const isSigned = currentNote?.status === 'signed';

  const getSectionLabel = (section) => {
    const labels = {
      subjective: 'Subjective - Patient History & Symptoms',
      objective: 'Objective - Physical Exam & Test Results',
      assessment: 'Assessment - Clinical Impression & Diagnosis',
      plan: 'Plan - Treatment & Follow-up'
    };
    return labels[section] || section;
  };

  const getPlaceholder = (section) => {
    const placeholders = {
      subjective: 'Document patient\'s chief complaint, history of present illness, review of systems...\n\nTry smart phrases: .ros (review of systems)',
      objective: 'Document vital signs, physical examination findings, laboratory results...\n\nTry smart phrases: .pe (physical exam), .wnl (within normal limits)',
      assessment: 'Document clinical assessment, differential diagnosis, problem list updates...',
      plan: 'Document treatment plan, medications, follow-up instructions, patient education...'
    };
    return placeholders[section] || '';
  };

  if (!currentNote) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">Loading note editor...</Alert>
      </Box>
    );
  }

  return (
    <Box>
      {/* Note Header */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h6">
              {currentNote.noteType === 'progress_note' ? 'Progress Note' : 'Clinical Note'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {currentPatient?.firstName} {currentPatient?.lastName} - 
              {currentEncounter ? ` ${currentEncounter.encounterType} Visit` : ' No active encounter'}
            </Typography>
            {currentNote.createdAt && (
              <Typography variant="caption" color="text.secondary">
                Created: {format(new Date(currentNote.createdAt), 'MM/dd/yyyy h:mm a')}
              </Typography>
            )}
          </Box>
          
          <Box display="flex" gap={1} alignItems="center">
            {isSigned && (
              <Chip 
                label="Signed" 
                color="success" 
                icon={<SignIcon />}
                size="small"
              />
            )}
            {isDirty && (
              <Chip 
                label="Unsaved changes" 
                color="warning" 
                size="small"
              />
            )}
            
            <Tooltip title="Smart phrases available">
              <IconButton 
                size="small" 
                onClick={() => setShowSmartPhrases(!showSmartPhrases)}
                color={showSmartPhrases ? 'primary' : 'default'}
              >
                <SmartPhraseIcon />
              </IconButton>
            </Tooltip>
            
            <Button
              variant="outlined"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={!isDirty || isSaving || isSigned}
            >
              Save
            </Button>
            
            <Button
              variant="contained"
              startIcon={<SignIcon />}
              onClick={handleSign}
              disabled={!canSign}
            >
              Sign Note
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Smart Phrases Help */}
      {showSmartPhrases && (
        <Alert severity="info" sx={{ mb: 2 }} icon={<InfoIcon />}>
          <Typography variant="subtitle2" gutterBottom>Available Smart Phrases:</Typography>
          <Box display="flex" gap={2} flexWrap="wrap">
            <Chip label=".ros - Review of Systems" size="small" />
            <Chip label=".pe - Physical Exam" size="small" />
            <Chip label=".normal - Within normal limits" size="small" />
            <Chip label=".wnl - Within normal limits" size="small" />
          </Box>
        </Alert>
      )}

      {/* SOAP Sections */}
      <Paper sx={{ p: 2 }}>
        <Stack spacing={3}>
          {/* Subjective */}
          <Box>
            <Typography 
              variant="subtitle1" 
              fontWeight="bold" 
              color="primary"
              gutterBottom
            >
              S - {getSectionLabel('subjective')}
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={6}
              value={currentNote.subjective || ''}
              onChange={(e) => handleTextChange('subjective', e.target.value)}
              placeholder={getPlaceholder('subjective')}
              disabled={isSigned}
              variant="outlined"
            />
          </Box>

          <Divider />

          {/* Objective */}
          <Box>
            <Typography 
              variant="subtitle1" 
              fontWeight="bold" 
              color="primary"
              gutterBottom
            >
              O - {getSectionLabel('objective')}
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={6}
              value={currentNote.objective || ''}
              onChange={(e) => handleTextChange('objective', e.target.value)}
              placeholder={getPlaceholder('objective')}
              disabled={isSigned}
              variant="outlined"
            />
          </Box>

          <Divider />

          {/* Assessment */}
          <Box>
            <Typography 
              variant="subtitle1" 
              fontWeight="bold" 
              color="primary"
              gutterBottom
            >
              A - {getSectionLabel('assessment')}
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={6}
              value={currentNote.assessment || ''}
              onChange={(e) => handleTextChange('assessment', e.target.value)}
              placeholder={getPlaceholder('assessment')}
              disabled={isSigned}
              variant="outlined"
            />
          </Box>

          <Divider />

          {/* Plan */}
          <Box>
            <Typography 
              variant="subtitle1" 
              fontWeight="bold" 
              color="primary"
              gutterBottom
            >
              P - {getSectionLabel('plan')}
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={6}
              value={currentNote.plan || ''}
              onChange={(e) => handleTextChange('plan', e.target.value)}
              placeholder={getPlaceholder('plan')}
              disabled={isSigned}
              variant="outlined"
            />
          </Box>
        </Stack>
      </Paper>

      {/* Cosignature Section */}
      {currentNote.requiresCosignature && !isSigned && (
        <Alert severity="warning" sx={{ mt: 2 }} icon={<WarningIcon />}>
          This note requires cosignature from an attending physician
        </Alert>
      )}
    </Box>
  );
};

export default SOAPEditor;