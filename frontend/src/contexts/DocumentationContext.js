/**
 * Documentation Context Provider
 * Manages clinical documentation state using FHIR DocumentReference resources
 */
import React, { createContext, useContext, useState, useCallback } from 'react';
import { fhirClient } from '../services/fhirClient';
import { useClinical } from './ClinicalContext';
import { useFHIRResource } from './FHIRResourceContext';

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
  const { refreshPatientResources } = useFHIRResource();
  const [currentNote, setCurrentNote] = useState(null);
  const [noteTemplates, setNoteTemplates] = useState([]);
  const [recentNotes, setRecentNotes] = useState([]);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Transform FHIR DocumentReference to internal format
  const transformFHIRDocument = (fhirDoc) => {
    // Extract content from attachment
    const content = fhirDoc.content?.[0]?.attachment?.data 
      ? atob(fhirDoc.content[0].attachment.data) 
      : '';
    
    // Parse content sections
    const sections = {};
    let isSOAPFormat = false;
    
    if (content) {
      try {
        const parsed = JSON.parse(content);
        // Check if it has SOAP structure
        if (parsed.subjective || parsed.objective || parsed.assessment || parsed.plan ||
            parsed.chiefComplaint || parsed.historyPresentIllness || parsed.reviewOfSystems || parsed.physicalExam) {
          isSOAPFormat = true;
          sections.subjective = parsed.subjective || '';
          sections.objective = parsed.objective || '';
          sections.assessment = parsed.assessment || '';
          sections.plan = parsed.plan || '';
          sections.chiefComplaint = parsed.chiefComplaint || '';
          sections.historyPresentIllness = parsed.historyPresentIllness || '';
          sections.reviewOfSystems = parsed.reviewOfSystems || '';
          sections.physicalExam = parsed.physicalExam || '';
        } else {
          // JSON but not SOAP structure
          sections.content = JSON.stringify(parsed, null, 2);
        }
      } catch (e) {
        // If not JSON, treat as plain text
        sections.content = content;
      }
    }

    // Extract note type from type coding and map LOINC code back to type
    const loinc = fhirDoc.type?.coding?.[0]?.code;
    const codeToType = {
      '11506-3': 'progress',
      '34117-2': 'history_physical',
      '11488-4': 'consultation',
      '18842-5': 'discharge',
      '11504-8': 'operative',
      '28570-0': 'procedure',
      '51845-6': 'emergency',
      '34133-9': 'summary'
    };
    const noteType = codeToType[loinc] || 'progress';

    return {
      id: fhirDoc.id,
      patientId: fhirDoc.subject?.reference?.split('/')[1],
      encounterId: fhirDoc.context?.encounter?.[0]?.reference?.split('/')[1],
      noteType,
      title: getNoteTypeDisplay(noteType),
      templateId: fhirDoc.extension?.find(e => e.url === 'http://medgenemr.com/template-id')?.valueString,
      status: fhirDoc.status,
      authorId: fhirDoc.author?.[0]?.reference?.split('/')[1],
      createdAt: fhirDoc.date,
      signedAt: fhirDoc.status === 'current' ? fhirDoc.date : null,
      requiresCosignature: fhirDoc.extension?.find(e => e.url === 'http://medgenemr.com/requires-cosignature')?.valueBoolean,
      cosignerId: fhirDoc.extension?.find(e => e.url === 'http://medgenemr.com/cosigner')?.valueReference?.reference?.split('/')[1],
      isSOAPFormat,
      ...sections
    };
  };

  // Transform internal note to FHIR DocumentReference
  const transformToFHIRDocument = (note) => {
    const content = {
      subjective: note.subjective || '',
      objective: note.objective || '',
      assessment: note.assessment || '',
      plan: note.plan || '',
      chiefComplaint: note.chiefComplaint || '',
      historyPresentIllness: note.historyPresentIllness || '',
      reviewOfSystems: note.reviewOfSystems || '',
      physicalExam: note.physicalExam || ''
    };

    const fhirDoc = {
      resourceType: 'DocumentReference',
      status: note.status === 'signed' ? 'current' : 'preliminary',
      type: {
        coding: [{
          system: 'http://loinc.org',
          code: getNoteTypeCode(note.noteType),
          display: getNoteTypeDisplay(note.noteType)
        }]
      },
      subject: {
        reference: `Patient/${note.patientId}`
      },
      date: note.createdAt || new Date().toISOString(),
      content: [{
        attachment: {
          contentType: 'application/json',
          data: btoa(JSON.stringify(content))
        }
      }],
      extension: []
    };

    // Add optional fields
    if (note.encounterId) {
      fhirDoc.context = {
        encounter: [{ reference: `Encounter/${note.encounterId}` }]
      };
    }

    if (note.authorId) {
      fhirDoc.author = [{ reference: `Practitioner/${note.authorId}` }];
    }

    if (note.templateId) {
      fhirDoc.extension.push({
        url: 'http://medgenemr.com/template-id',
        valueString: note.templateId
      });
    }

    if (note.requiresCosignature) {
      fhirDoc.extension.push({
        url: 'http://medgenemr.com/requires-cosignature',
        valueBoolean: true
      });
    }

    if (note.cosignerId) {
      fhirDoc.extension.push({
        url: 'http://medgenemr.com/cosigner',
        valueReference: { reference: `Practitioner/${note.cosignerId}` }
      });
    }

    if (note.id) {
      fhirDoc.id = note.id;
    }

    return fhirDoc;
  };

  // Helper function to get LOINC codes for note types
  const getNoteTypeCode = (noteType) => {
    const codes = {
      'progress': '11506-3',
      'history_physical': '34117-2',
      'consultation': '11488-4',
      'discharge': '18842-5',
      'operative': '11504-8',
      'procedure': '28570-0',
      'emergency': '51845-6',
      'nursing': '34119-8',
      'therapy': '11507-1',
      'addendum': '81334-5'
    };
    return codes[noteType] || '11506-3';
  };

  const getNoteTypeDisplay = (noteType) => {
    const displays = {
      'progress': 'Progress note',
      'history_physical': 'History and physical note',
      'consultation': 'Consultation note',
      'discharge': 'Discharge summary',
      'operative': 'Operative note',
      'procedure': 'Procedure note',
      'emergency': 'Emergency department note',
      'nursing': 'Nursing note',
      'therapy': 'Therapy note',
      'addendum': 'Addendum'
    };
    return displays[noteType] || 'Clinical note';
  };

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
      const fhirDoc = await fhirClient.read('DocumentReference', noteId);
      const note = transformFHIRDocument(fhirDoc);
      
      setCurrentNote(note);
      setClinicalContextNote(note);
      setIsDirty(false);
    } catch (error) {
      
      throw error;
    }
  };

  // Load recent notes
  const loadRecentNotes = async (patientId) => {
    try {
      const result = await fhirClient.search('DocumentReference', {
        patient: patientId,
        _sort: '-date',
        _count: 10
      });
      
      // Ensure resources is an array
      const notes = (result.resources || []).map(fhirDoc => {
        const note = transformFHIRDocument(fhirDoc);
        // Add author name if available
        note.authorName = fhirDoc.author?.[0]?.display || 'Provider';
        return note;
      });
      
      setRecentNotes(notes);
    } catch (error) {
      
      throw error;
    }
  };

  // Load note templates (still using API endpoint as templates aren't FHIR resources)
  const loadNoteTemplates = async (specialty) => {
    try {
      // For now, use hardcoded templates until we implement a proper template service
      const templates = [
        {
          id: 'soap-basic',
          name: 'Basic SOAP Note',
          noteType: 'progress',
          content: {
            subjective: 'Chief Complaint: \nHistory of Present Illness: \nReview of Systems: ',
            objective: 'Vital Signs: \nPhysical Exam: ',
            assessment: 'Assessment: \n1. ',
            plan: 'Plan: \n1. '
          }
        },
        {
          id: 'hp-standard',
          name: 'History & Physical',
          noteType: 'history_physical',
          content: {
            chiefComplaint: 'Chief Complaint: ',
            historyPresentIllness: 'History of Present Illness: ',
            reviewOfSystems: 'Review of Systems: \nConstitutional: \nHEENT: \nCardiovascular: \nRespiratory: ',
            physicalExam: 'Physical Examination: \nVital Signs: \nGeneral: \nHEENT: \nCardiovascular: \nRespiratory: ',
            assessment: 'Assessment: ',
            plan: 'Plan: '
          }
        }
      ];
      
      setNoteTemplates(templates);
    } catch (error) {
      
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
      const fhirDoc = transformToFHIRDocument(currentNote);

      let result;
      if (currentNote.id) {
        // Update existing note
        result = await fhirClient.update('DocumentReference', currentNote.id, fhirDoc);
      } else {
        // Create new note
        result = await fhirClient.create('DocumentReference', fhirDoc);
      }

      const savedNote = {
        ...currentNote,
        id: result.id || currentNote.id,
        createdAt: new Date().toISOString()
      };

      setCurrentNote(savedNote);
      setClinicalContextNote(savedNote);
      setIsDirty(false);

      // Refresh patient resources to update all contexts
      if (currentPatient?.id) {
        await refreshPatientResources(currentPatient.id);
      }

      // Reload recent notes
      await loadRecentNotes(currentPatient.id);
    } catch (error) {
      
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
      // Get current document
      const fhirDoc = await fhirClient.read('DocumentReference', currentNote.id);
      
      // Update status to current (signed)
      fhirDoc.status = 'current';
      
      // Add authenticator extension
      if (!fhirDoc.extension) fhirDoc.extension = [];
      fhirDoc.extension.push({
        url: 'http://medgenemr.com/signed-at',
        valueDateTime: new Date().toISOString()
      });
      
      await fhirClient.update('DocumentReference', currentNote.id, fhirDoc);
      
      // Refresh patient resources to update all contexts
      if (currentPatient?.id) {
        await refreshPatientResources(currentPatient.id);
      }
      
      // Reload the note to get updated status
      await loadNote(currentNote.id);
    } catch (error) {
      
      throw error;
    }
  };

  // Create addendum
  const createAddendum = async (parentNoteId, content) => {
    if (!currentPatient) return;

    try {
      // Create a new note with type 'addendum'
      const addendumNote = {
        patientId: currentPatient.id,
        encounterId: currentEncounter?.id,
        noteType: 'addendum',
        status: 'draft'
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
        
        // Add non-empty sections to addendumNote
        Object.entries(sections).forEach(([key, value]) => {
          if (value) {
            addendumNote[key] = value;
          }
        });
      } else {
        // If not structured, put all content in assessment
        addendumNote.assessment = content;
      }

      // Create FHIR document
      const fhirDoc = transformToFHIRDocument(addendumNote);
      
      // Add relationship to parent note
      fhirDoc.relatesTo = [{
        code: 'appends',
        target: {
          reference: `DocumentReference/${parentNoteId}`
        }
      }];

      const result = await fhirClient.create('DocumentReference', fhirDoc);

      // Refresh patient resources to update all contexts
      if (currentPatient?.id) {
        await refreshPatientResources(currentPatient.id);
      }

      // Reload recent notes
      await loadRecentNotes(currentPatient.id);
      
      return result;
    } catch (error) {
      
      throw error;
    }
  };

  // Delete note (only drafts)
  const deleteNote = async (noteId) => {
    try {
      // Check if note is a draft
      const fhirDoc = await fhirClient.read('DocumentReference', noteId);
      if (fhirDoc.status !== 'preliminary') {
        throw new Error('Only draft notes can be deleted');
      }
      
      await fhirClient.delete('DocumentReference', noteId);
      
      // Refresh patient resources to update all contexts
      if (currentPatient?.id) {
        await refreshPatientResources(currentPatient.id);
      }
      
      if (currentNote?.id === noteId) {
        clearCurrentNote();
      }
      
      if (currentPatient) {
        await loadRecentNotes(currentPatient.id);
      }
    } catch (error) {
      
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