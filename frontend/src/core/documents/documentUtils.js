/**
 * Document Utilities
 * Helper functions for processing and displaying FHIR DocumentReference content
 * Fixes content decoding and presentation issues
 */

import { documentReferenceConverter, NOTE_TYPES } from '../fhir/converters/DocumentReferenceConverter';

/**
 * Extract and decode content from FHIR DocumentReference
 * Provides robust error handling and fallback logic
 * @param {Object} docRef - FHIR DocumentReference resource
 * @returns {Object} Extracted content with metadata
 */
export const extractDocumentContent = (docRef) => {
  return documentReferenceConverter.extractDocumentContent(docRef);
};

/**
 * Format document content for display
 * Handles both SOAP and plain text formats
 * @param {Object} docRef - FHIR DocumentReference resource
 * @returns {Object} Formatted content for display
 */
export const formatDocumentForDisplay = (docRef) => {
  const extracted = extractDocumentContent(docRef);
  
  if (extracted.error) {
    return {
      displayContent: extracted.error,
      type: 'error',
      sections: null,
      hasContent: false
    };
  }

  if (extracted.type === 'soap' && extracted.sections) {
    return {
      displayContent: formatSoapContent(extracted.sections),
      type: 'soap',
      sections: extracted.sections,
      hasContent: true
    };
  }
  
  if (extracted.type === 'medical-history') {
    return {
      displayContent: extracted.content,
      type: 'medical-history',
      sections: null,
      hasContent: true
    };
  }

  return {
    displayContent: extracted.content || 'No content available',
    type: 'text',
    sections: null,
    hasContent: !!extracted.content
  };
};

/**
 * Format SOAP sections for display
 * @param {Object} sections - SOAP sections object
 * @returns {string} Formatted SOAP content
 */
export const formatSoapContent = (sections) => {
  const parts = [];
  
  if (sections.subjective) {
    parts.push(`SUBJECTIVE:\n${sections.subjective}`);
  }
  
  if (sections.objective) {
    parts.push(`OBJECTIVE:\n${sections.objective}`);
  }
  
  if (sections.assessment) {
    parts.push(`ASSESSMENT:\n${sections.assessment}`);
  }
  
  if (sections.plan) {
    parts.push(`PLAN:\n${sections.plan}`);
  }
  
  return parts.join('\n\n');
};

/**
 * Create document reference payload with proper FHIR structure
 * Fixes field mapping and encoding issues
 * @param {Object} noteData - Note form data
 * @param {Object} options - Additional options (patientId, encounterId, etc.)
 * @returns {Object} Properly formatted FHIR DocumentReference
 */
export const createDocumentReferencePayload = (noteData, options = {}) => {
  const { patientId, encounterId, userId, signNote = false } = options;
  
  // Convert form data to standardized format
  const formData = {
    type: noteData.type || 'progress',
    status: 'current',
    docStatus: signNote ? 'final' : 'preliminary',
    category: 'clinical-note',
    title: noteData.title || '',
    description: noteData.description || '',
    contentType: noteData.sections ? 'soap' : 'text',
    content: noteData.content || '',
    soapSections: noteData.sections || {
      subjective: '',
      objective: '',
      assessment: '',
      plan: ''
    },
    encounterId,
    authorId: userId,
    signNote,
    notes: noteData.notes || ''
  };
  
  // Use converter to create proper FHIR resource
  return documentReferenceConverter.createResource(formData, patientId, { userId });
};

/**
 * Update document reference payload with proper FHIR structure
 * Fixes update operation field conflicts
 * @param {Object} noteData - Note form data
 * @param {Object} existingNote - Existing DocumentReference resource
 * @param {Object} options - Additional options
 * @returns {Object} Properly formatted FHIR DocumentReference for update
 */
export const updateDocumentReferencePayload = (noteData, existingNote, options = {}) => {
  const { signNote = false, userId } = options;
  
  // Convert form data to standardized format
  const formData = {
    type: noteData.type || existingNote.type || 'progress',
    status: existingNote.status || 'current',
    docStatus: signNote ? 'final' : (noteData.docStatus || existingNote.docStatus || 'preliminary'),
    category: existingNote.category || 'clinical-note',
    title: noteData.title || existingNote.title || '',
    description: noteData.description || existingNote.description || '',
    contentType: noteData.sections ? 'soap' : 'text',
    content: noteData.content || '',
    soapSections: noteData.sections || {
      subjective: '',
      objective: '',
      assessment: '',
      plan: ''
    },
    encounterId: existingNote.encounterId,
    authorId: existingNote.authorId || userId,
    signNote,
    notes: noteData.notes || ''
  };
  
  // Use converter to update resource properly
  return documentReferenceConverter.updateResource(formData, existingNote, { userId });
};

/**
 * Process document reference for display in lists
 * Standardizes document metadata extraction
 * @param {Object} docRef - FHIR DocumentReference resource
 * @returns {Object} Processed document for display
 */
export const processDocumentForDisplay = (docRef) => {
  const content = formatDocumentForDisplay(docRef);
  
  // Extract type information
  let noteType = 'progress';
  let typeDisplay = 'Progress Note';
  if (docRef.type?.coding?.[0]) {
    const code = docRef.type.coding[0].code;
    typeDisplay = docRef.type.coding[0].display || typeDisplay;
    
    // Map LOINC code back to note type
    for (const [key, value] of Object.entries(NOTE_TYPES || {})) {
      if (value.code === code) {
        noteType = key;
        break;
      }
    }
  }
  
  // Extract author information
  let author = 'Unknown';
  if (docRef.author?.[0]) {
    if (docRef.author[0].display) {
      author = docRef.author[0].display;
    } else if (docRef.author[0].reference) {
      const parts = docRef.author[0].reference.split('/');
      author = parts[parts.length - 1];
    }
  }
  
  // Extract status information
  const status = docRef.status || 'current';
  const docStatus = docRef.docStatus || 'preliminary';
  const isSigned = docStatus === 'final';
  
  return {
    ...docRef,
    noteType,
    typeDisplay,
    author,
    status,
    docStatus,
    isSigned,
    date: docRef.date || new Date().toISOString(),
    title: docRef.content?.[0]?.attachment?.title || typeDisplay,
    displayContent: content.displayContent,
    contentType: content.type,
    sections: content.sections,
    hasContent: content.hasContent,
    text: content.displayContent // For backward compatibility
  };
};

/**
 * Validate document reference data before save
 * @param {Object} noteData - Note form data
 * @returns {Object} Validation result with errors
 */
export const validateDocumentData = (noteData) => {
  const errors = {};
  
  if (!noteData.type) {
    errors.type = 'Document type is required';
  }
  
  if (noteData.sections) {
    // SOAP note validation
    const hasContent = noteData.sections.subjective || 
                      noteData.sections.objective || 
                      noteData.sections.assessment || 
                      noteData.sections.plan;
    if (!hasContent) {
      errors.content = 'At least one SOAP section must have content';
    }
  } else {
    // Plain text validation
    if (!noteData.content || noteData.content.trim() === '') {
      errors.content = 'Document content is required';
    }
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

/**
 * Get note type options for dropdowns
 * @returns {Array} Array of note type options
 */
export const getNoteTypeOptions = () => {
  return Object.entries(NOTE_TYPES || {}).map(([key, value]) => ({
    value: key,
    label: value.display,
    code: value.code
  }));
};

/**
 * Create addendum document reference
 * @param {Object} originalNote - Original DocumentReference
 * @param {string} addendumText - Addendum content
 * @param {Object} options - Additional options
 * @returns {Object} Addendum DocumentReference
 */
export const createAddendumPayload = (originalNote, addendumText, options = {}) => {
  const { patientId, userId } = options;
  
  const formData = {
    type: 'progress',
    status: 'current',
    docStatus: 'final',
    category: 'clinical-note',
    title: `Addendum to ${originalNote.title || 'note'}`,
    description: `Addendum to ${originalNote.type?.text || 'note'} from ${originalNote.date}`,
    contentType: 'text',
    content: addendumText,
    soapSections: {
      subjective: '',
      objective: '',
      assessment: '',
      plan: ''
    },
    encounterId: originalNote.encounterId,
    authorId: userId,
    signNote: true,
    notes: ''
  };
  
  const resource = documentReferenceConverter.createResource(formData, patientId, { userId });
  
  // Add relatesTo for addendum relationship
  resource.relatesTo = [{
    code: 'appends',
    target: {
      reference: `DocumentReference/${originalNote.id}`
    }
  }];
  
  return resource;
};