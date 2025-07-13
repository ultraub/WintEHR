/**
 * DocumentReferenceConverter - FHIR DocumentReference Resource Converter
 * Extends AbstractFHIRConverter to provide DocumentReference-specific conversion logic
 * Fixes FHIR structure inconsistencies and content encoding issues
 */
import { AbstractFHIRConverter } from './AbstractFHIRConverter';

// FHIR Value Sets for DocumentReference
export const DOCUMENT_STATUS_OPTIONS = [
  { value: 'current', display: 'Current' },
  { value: 'superseded', display: 'Superseded' },
  { value: 'entered-in-error', display: 'Entered in Error' }
];

export const DOC_STATUS_OPTIONS = [
  { value: 'preliminary', display: 'Preliminary' },
  { value: 'final', display: 'Final' },
  { value: 'amended', display: 'Amended' },
  { value: 'entered-in-error', display: 'Entered in Error' }
];

export const NOTE_TYPES = {
  progress: { code: '11506-3', display: 'Progress note', system: 'http://loinc.org' },
  history_physical: { code: '34117-2', display: 'History and physical note', system: 'http://loinc.org' },
  consultation: { code: '11488-4', display: 'Consultation note', system: 'http://loinc.org' },
  discharge: { code: '18842-5', display: 'Discharge summary', system: 'http://loinc.org' },
  operative: { code: '11504-8', display: 'Surgical operation note', system: 'http://loinc.org' },
  procedure: { code: '28570-0', display: 'Procedure note', system: 'http://loinc.org' },
  soap: { code: '34109-9', display: 'Note', system: 'http://loinc.org' },
  nursing: { code: '34746-8', display: 'Nursing note', system: 'http://loinc.org' },
  therapy: { code: '28635-1', display: 'Physical therapy note', system: 'http://loinc.org' },
  social_work: { code: '34107-3', display: 'Social work note', system: 'http://loinc.org' }
};

export const DOCUMENT_CATEGORIES = [
  { value: 'clinical-note', display: 'Clinical Note' },
  { value: 'assessment', display: 'Assessment' },
  { value: 'plan', display: 'Plan' },
  { value: 'consultation', display: 'Consultation' },
  { value: 'procedure', display: 'Procedure Note' },
  { value: 'discharge', display: 'Discharge Summary' }
];

export class DocumentReferenceConverter extends AbstractFHIRConverter {
  constructor() {
    super('DocumentReference', {
      generateId: true,
      validateRequired: true,
      preserveMeta: true
    });
  }

  /**
   * Get initial form values for new document
   * @returns {Object} Initial form values
   */
  getInitialValues() {
    return {
      type: 'progress',
      status: 'current',
      docStatus: 'preliminary',
      category: 'clinical-note',
      title: '',
      description: '',
      contentType: 'text', // 'text' or 'soap'
      content: '',
      soapSections: {
        subjective: '',
        objective: '',
        assessment: '',
        plan: ''
      },
      encounterId: null,
      authorId: null,
      signNote: false,
      notes: ''
    };
  }

  /**
   * Parse FHIR DocumentReference resource to form data
   * @param {Object} docRef - FHIR DocumentReference resource
   * @returns {Object} Form data
   */
  _parseResourceToForm(docRef) {
    // Extract basic fields
    const status = this.safeString(docRef.status, 'current');
    const docStatus = this.safeString(docRef.docStatus, 'preliminary');
    const title = this.safeString(docRef.content?.[0]?.attachment?.title, '');
    const description = this.safeString(docRef.description, '');
    
    // Extract type from coding
    let type = 'progress';
    if (docRef.type?.coding?.[0]) {
      const code = docRef.type.coding[0].code;
      for (const [key, value] of Object.entries(NOTE_TYPES)) {
        if (value.code === code) {
          type = key;
          break;
        }
      }
    }
    
    // Extract category
    let category = 'clinical-note';
    if (docRef.category?.[0]?.coding?.[0]) {
      category = docRef.category[0].coding[0].code;
    }
    
    // Extract content
    let content = '';
    let contentType = 'text';
    let soapSections = {
      subjective: '',
      objective: '',
      assessment: '',
      plan: ''
    };
    
    if (docRef.content?.[0]?.attachment?.data) {
      try {
        // Decode base64 content
        const decodedContent = this._decodeBase64Content(docRef.content[0].attachment.data);
        
        // Check if it's JSON (SOAP format)
        if (docRef.content[0].attachment.contentType === 'application/json') {
          try {
            const parsed = JSON.parse(decodedContent);
            if (parsed.subjective || parsed.objective || parsed.assessment || parsed.plan) {
              contentType = 'soap';
              soapSections = {
                subjective: parsed.subjective || '',
                objective: parsed.objective || '',
                assessment: parsed.assessment || '',
                plan: parsed.plan || ''
              };
            } else if (parsed.text) {
              content = parsed.text;
            } else {
              content = decodedContent;
            }
          } catch (e) {
            // Not valid JSON, treat as text
            content = decodedContent;
          }
        } else {
          content = decodedContent;
        }
      } catch (error) {
        console.warn('Failed to decode document content:', error);
        content = 'Failed to decode content';
      }
    }
    
    // Extract references
    const encounterId = this.extractReferenceId(docRef.encounter);
    const authorId = this.extractReferenceId(docRef.author?.[0]);
    
    // Extract notes
    const notes = this.extractNotes(docRef.note);

    return {
      type,
      status,
      docStatus,
      category,
      title,
      description,
      contentType,
      content,
      soapSections,
      encounterId,
      authorId,
      signNote: docStatus === 'final',
      notes
    };
  }

  /**
   * Create FHIR DocumentReference resource from form data
   * @param {Object} formData - Form data
   * @param {Object} context - Additional context (patientId, etc.)
   * @returns {Object} FHIR resource fields
   */
  _createResourceFromForm(formData, context = {}) {
    const noteTypeInfo = NOTE_TYPES[formData.type] || NOTE_TYPES.progress;
    
    const resource = {
      status: formData.status,
      docStatus: formData.signNote ? 'final' : formData.docStatus,
      type: {
        coding: [{
          system: noteTypeInfo.system,
          code: noteTypeInfo.code,
          display: noteTypeInfo.display
        }]
      },
      category: [{
        coding: [{
          system: 'http://hl7.org/fhir/us/core/CodeSystem/us-core-documentreference-category',
          code: formData.category,
          display: DOCUMENT_CATEGORIES.find(c => c.value === formData.category)?.display || 'Clinical Note'
        }]
      }],
      date: new Date().toISOString()
    };

    // Add description if provided
    if (formData.description) {
      resource.description = formData.description;
    }

    // Add encounter reference
    if (formData.encounterId) {
      resource.encounter = {
        reference: `Encounter/${formData.encounterId}`
      };
    }

    // Add author reference
    if (formData.authorId || context.userId) {
      resource.author = [{
        reference: `Practitioner/${formData.authorId || context.userId}`
      }];
    }

    // Create content based on type
    let contentData;
    let contentType;
    let title;

    if (formData.contentType === 'soap') {
      // SOAP format - JSON content
      contentData = {
        subjective: formData.soapSections.subjective || '',
        objective: formData.soapSections.objective || '',
        assessment: formData.soapSections.assessment || '',
        plan: formData.soapSections.plan || ''
      };
      contentType = 'application/json';
      title = formData.title || `SOAP Note - ${noteTypeInfo.display}`;
    } else {
      // Plain text format
      contentData = formData.content || '';
      contentType = 'text/plain';
      title = formData.title || noteTypeInfo.display;
    }

    // Convert content to string and encode
    const contentString = typeof contentData === 'string' ? contentData : JSON.stringify(contentData);
    const encodedContent = this._encodeBase64Content(contentString);

    resource.content = [{
      attachment: {
        contentType,
        data: encodedContent,
        title,
        creation: new Date().toISOString()
      }
    }];

    // Add notes if provided
    if (formData.notes) {
      resource.note = this.createNotes(formData.notes);
    }

    return resource;
  }

  /**
   * Validate required fields for document reference
   * @param {Object} formData - Form data to validate
   * @throws {Error} If validation fails
   */
  _validateRequiredFields(formData) {
    if (!formData.status) {
      throw new Error('Document status is required');
    }

    if (!formData.type) {
      throw new Error('Document type is required');
    }

    // Validate content based on type
    if (formData.contentType === 'soap') {
      const hasContent = formData.soapSections.subjective || 
                        formData.soapSections.objective || 
                        formData.soapSections.assessment || 
                        formData.soapSections.plan;
      if (!hasContent) {
        throw new Error('At least one SOAP section must have content');
      }
    } else {
      if (!formData.content || formData.content.trim() === '') {
        throw new Error('Document content is required');
      }
    }
  }

  /**
   * Post-process the document reference resource
   * @param {Object} resource - The resource
   * @param {string} operation - 'create' or 'update'
   * @param {Object} formData - Original form data
   * @param {Object} context - Additional context
   * @returns {Object} Processed resource
   */
  _postProcessResource(resource, operation, formData, context) {
    // Ensure dates are properly formatted
    if (resource.date && typeof resource.date !== 'string') {
      resource.date = new Date(resource.date).toISOString();
    }

    if (resource.content?.[0]?.attachment?.creation && 
        typeof resource.content[0].attachment.creation !== 'string') {
      resource.content[0].attachment.creation = new Date(resource.content[0].attachment.creation).toISOString();
    }

    // Ensure category is an array
    if (resource.category && !Array.isArray(resource.category)) {
      resource.category = [resource.category];
    }

    // Ensure author is an array
    if (resource.author && !Array.isArray(resource.author)) {
      resource.author = [resource.author];
    }

    return resource;
  }

  /**
   * Helper method to decode base64 content safely
   * @param {string} encodedContent - Base64 encoded content
   * @returns {string} Decoded content
   */
  _decodeBase64Content(encodedContent) {
    try {
      return atob(encodedContent);
    } catch (error) {
      throw new Error('Failed to decode base64 content');
    }
  }

  /**
   * Helper method to encode content as base64 safely
   * @param {string} content - Content to encode
   * @returns {string} Base64 encoded content
   */
  _encodeBase64Content(content) {
    try {
      return btoa(unescape(encodeURIComponent(content)));
    } catch (error) {
      throw new Error('Failed to encode content as base64');
    }
  }

  /**
   * Extract and decode document content from FHIR DocumentReference
   * @param {Object} docRef - FHIR DocumentReference
   * @returns {Object} Extracted content with type and data
   */
  extractDocumentContent(docRef) {
    if (!docRef.content?.[0]?.attachment?.data) {
      return {
        type: 'text',
        content: '',
        sections: null,
        error: 'No content data found'
      };
    }

    try {
      const decodedContent = this._decodeBase64Content(docRef.content[0].attachment.data);
      const contentType = docRef.content[0].attachment.contentType;

      if (contentType === 'application/json') {
        try {
          const parsed = JSON.parse(decodedContent);
          if (parsed.subjective || parsed.objective || parsed.assessment || parsed.plan) {
            return {
              type: 'soap',
              content: decodedContent,
              sections: parsed,
              error: null
            };
          } else if (parsed.text) {
            return {
              type: 'text',
              content: parsed.text,
              sections: null,
              error: null
            };
          }
        } catch (e) {
          // Fall through to treat as text
        }
      }

      return {
        type: 'text',
        content: decodedContent,
        sections: null,
        error: null
      };
    } catch (error) {
      return {
        type: 'text',
        content: '',
        sections: null,
        error: 'Failed to decode content'
      };
    }
  }
}

// Helper functions that can be used by the dialog config
export const getDocumentStatusColor = (status) => {
  switch (status?.toLowerCase()) {
    case 'current':
      return 'success';
    case 'superseded':
      return 'warning';
    case 'entered-in-error':
      return 'error';
    default:
      return 'default';
  }
};

export const getDocStatusColor = (docStatus) => {
  switch (docStatus?.toLowerCase()) {
    case 'final':
      return 'success';
    case 'preliminary':
      return 'info';
    case 'amended':
      return 'warning';
    case 'entered-in-error':
      return 'error';
    default:
      return 'default';
  }
};

export const getNoteTypeDisplay = (type) => {
  return NOTE_TYPES[type]?.display || 'Unknown Note Type';
};

export const getDocumentDisplay = (formData) => {
  return formData.title || getNoteTypeDisplay(formData.type);
};

// Export singleton instance for use in dialog configs
export const documentReferenceConverter = new DocumentReferenceConverter();