/**
 * Documentation Context Provider
 * Manages clinical documentation state and note editing
 */
import React, { createContext, useContext, useState, useCallback } from 'react';
import api from '../services/api';
import { useClinical } from './ClinicalContext';

const DocumentationContext = createContext(undefined);

export const useDocumentation = () => {
  const context = useContext(DocumentationContext);
  if (!context) {
    throw new Error('useDocumentation must be used within a DocumentationProvider');
  }
  return context;
};

export const DocumentationProvider = ({ children }) => {
  const { currentPatient, currentEncounter, setCurrentNote: setClinicalContextNote } = useClinical();
  const [currentNote, setCurrentNote] = useState(null);
  const [noteTemplates, setNoteTemplates] = useState([]);
  const [recentNotes, setRecentNotes] = useState([]);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Create new note
  const createNewNote = useCallback((noteType, templateId) => {
    if (!currentPatient) {
      throw new Error('No patient selected');
    }

    const newNote = {
      patientId: currentPatient.id,
      encounterId: currentEncounter?.id,
      noteType,
      templateId,
      status: 'draft'
    };

    // Apply template if provided
    if (templateId) {
      const template = noteTemplates.find(t => t.id === templateId);
      if (template && template.content) {
        Object.assign(newNote, template.content);
      }
    }

    setCurrentNote(newNote);
    setClinicalContextNote(newNote);
    setIsDirty(false);
  }, [currentPatient, currentEncounter, noteTemplates, setClinicalContextNote]);

  // Load existing note
  const loadNote = async (noteId) => {
    try {
      const response = await api.get(`/api/clinical/notes/${noteId}`);
      const noteData = response.data;
      
      const note = {
        id: noteData.id,
        patientId: noteData.patient_id,
        encounterId: noteData.encounter_id,
        noteType: noteData.note_type,
        templateId: noteData.template_id,
        subjective: noteData.subjective,
        objective: noteData.objective,
        assessment: noteData.assessment,
        plan: noteData.plan,
        chiefComplaint: noteData.chief_complaint,
        historyPresentIllness: noteData.history_present_illness,
        reviewOfSystems: noteData.review_of_systems,
        physicalExam: noteData.physical_exam,
        status: noteData.status,
        authorId: noteData.author_id,
        createdAt: noteData.created_at,
        signedAt: noteData.signed_at,
        requiresCosignature: noteData.requires_cosignature,
        cosignerId: noteData.cosigner_id
      };
      
      setCurrentNote(note);
      setClinicalContextNote(note);
      setIsDirty(false);
    } catch (error) {
      console.error('Error loading note:', error);
      throw error;
    }
  };

  // Load recent notes
  const loadRecentNotes = async (patientId) => {
    try {
      const response = await api.get('/api/clinical/notes/', {
        params: {
          patient_id: patientId,
          limit: 10
        }
      });
      
      const notes = response.data.map((noteData) => ({
        id: noteData.id,
        patientId: noteData.patient_id,
        encounterId: noteData.encounter_id,
        noteType: noteData.note_type,
        status: noteData.status,
        authorId: noteData.author_id,
        authorName: noteData.author_name || 'Provider',
        createdAt: noteData.created_at,
        signedAt: noteData.signed_at,
        // Include content fields for easier access
        subjective: noteData.subjective,
        objective: noteData.objective,
        assessment: noteData.assessment,
        plan: noteData.plan,
        chief_complaint: noteData.chief_complaint,
        history_present_illness: noteData.history_present_illness,
        review_of_systems: noteData.review_of_systems,
        physical_exam: noteData.physical_exam
      }));
      
      setRecentNotes(notes);
    } catch (error) {
      console.error('Error loading recent notes:', error);
      throw error;
    }
  };

  // Load note templates
  const loadNoteTemplates = async (specialty) => {
    try {
      const response = await api.get('/api/clinical/notes/templates/', {
        params: specialty ? { specialty } : {}
      });
      
      setNoteTemplates(response.data);
    } catch (error) {
      console.error('Error loading note templates:', error);
      throw error;
    }
  };

  // Update note field
  const updateNoteField = useCallback((field, value) => {
    if (!currentNote) return;
    
    setCurrentNote(prev => ({
      ...prev,
      [field]: value
    }));
    setIsDirty(true);
  }, [currentNote]);

  // Update SOAP section
  const updateSOAPSection = useCallback((section, value) => {
    updateNoteField(section, value);
  }, [updateNoteField]);

  // Save note
  const saveNote = async () => {
    if (!currentNote || !currentPatient) return;

    setIsSaving(true);
    try {
      const noteData = {
        patient_id: currentNote.patientId,
        encounter_id: currentNote.encounterId,
        note_type: currentNote.noteType,
        template_id: currentNote.templateId,
        subjective: currentNote.subjective,
        objective: currentNote.objective,
        assessment: currentNote.assessment,
        plan: currentNote.plan,
        chief_complaint: currentNote.chiefComplaint,
        history_present_illness: currentNote.historyPresentIllness,
        review_of_systems: currentNote.reviewOfSystems,
        physical_exam: currentNote.physicalExam,
        requires_cosignature: currentNote.requiresCosignature,
        cosigner_id: currentNote.cosignerId
      };

      let response;
      if (currentNote.id) {
        // Update existing note
        response = await api.put(`/api/clinical/notes/${currentNote.id}`, noteData);
      } else {
        // Create new note
        response = await api.post('/api/clinical/notes/', noteData);
      }

      const savedNote = {
        ...currentNote,
        id: response.data.id,
        status: response.data.status,
        createdAt: response.data.created_at,
        authorId: response.data.author_id
      };

      setCurrentNote(savedNote);
      setClinicalContextNote(savedNote);
      setIsDirty(false);

      // Reload recent notes
      await loadRecentNotes(currentPatient.id);
    } catch (error) {
      console.error('Error saving note:', error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  // Sign note
  const signNote = async () => {
    if (!currentNote?.id) {
      throw new Error('Note must be saved before signing');
    }

    try {
      await api.put(`/api/clinical/notes/${currentNote.id}/sign`);
      
      // Reload the note to get updated status
      await loadNote(currentNote.id);
    } catch (error) {
      console.error('Error signing note:', error);
      throw error;
    }
  };

  // Create addendum
  const createAddendum = async (parentNoteId, content) => {
    if (!currentPatient) return;

    try {
      // Parse the content to extract sections if structured
      let noteData = {
        patient_id: currentPatient.id,
        encounter_id: currentEncounter?.id,
        note_type: 'addendum',
      };

      // If content contains sections, parse them
      if (content.includes('Chief Complaint:') || content.includes('Subjective:')) {
        const sections = {
          chiefComplaint: content.match(/Chief Complaint:\n(.*?)(?=\n\n|Subjective:|Objective:|Assessment:|Plan:|$)/s)?.[1]?.trim(),
          subjective: content.match(/Subjective:\n(.*?)(?=\n\n|Objective:|Assessment:|Plan:|$)/s)?.[1]?.trim(),
          objective: content.match(/Objective:\n(.*?)(?=\n\n|Assessment:|Plan:|$)/s)?.[1]?.trim(),
          assessment: content.match(/Assessment:\n(.*?)(?=\n\n|Plan:|$)/s)?.[1]?.trim(),
          plan: content.match(/Plan:\n(.*?)(?=\n\n|$)/s)?.[1]?.trim(),
        };
        
        // Add non-empty sections to noteData
        Object.entries(sections).forEach(([key, value]) => {
          if (value) {
            noteData[key === 'chiefComplaint' ? 'chief_complaint' : key] = value;
          }
        });
      } else {
        // If not structured, put all content in assessment
        noteData.assessment = content;
      }

      const response = await api.post(`/api/clinical/notes/${parentNoteId}/addendum`, noteData);

      // Reload recent notes
      await loadRecentNotes(currentPatient.id);
      
      return response.data;
    } catch (error) {
      console.error('Error creating addendum:', error);
      throw error;
    }
  };

  // Delete note (only drafts)
  const deleteNote = async (noteId) => {
    try {
      await api.delete(`/api/clinical/notes/${noteId}`);
      
      if (currentNote?.id === noteId) {
        clearCurrentNote();
      }
      
      if (currentPatient) {
        await loadRecentNotes(currentPatient.id);
      }
    } catch (error) {
      console.error('Error deleting note:', error);
      throw error;
    }
  };

  // Expand smart phrase
  const expandSmartPhrase = (phrase) => {
    // Mock smart phrase expansion
    const smartPhrases = {
      '.ros': 'Review of Systems: Constitutional: Denies fever, chills, or weight loss. HEENT: Denies headache, vision changes. Cardiovascular: Denies chest pain, palpitations. Respiratory: Denies shortness of breath, cough.',
      '.pe': 'Physical Exam: Vital Signs: BP ___/___ HR ___ RR ___ Temp ___°F SpO2 ___%. General: Alert and oriented x3, in no acute distress.',
      '.normal': 'Within normal limits',
      '.wnl': 'Within normal limits'
    };

    return smartPhrases[phrase.toLowerCase()] || phrase;
  };

  // Clear current note
  const clearCurrentNote = () => {
    setCurrentNote(null);
    setClinicalContextNote(null);
    setIsDirty(false);
  };

  const value = {
    currentNote,
    noteTemplates,
    recentNotes,
    isDirty,
    isSaving,
    createNewNote,
    loadNote,
    loadRecentNotes,
    loadNoteTemplates,
    updateNoteField,
    updateSOAPSection,
    saveNote,
    signNote,
    createAddendum,
    deleteNote,
    expandSmartPhrase,
    clearCurrentNote,
    setIsDirty
  };

  return (
    <DocumentationContext.Provider value={value}>
      {children}
    </DocumentationContext.Provider>
  );
};