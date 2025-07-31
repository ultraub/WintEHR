/**
 * DocumentReferenceConverter - FHIR DocumentReference Resource Converter
 * Extends AbstractFHIRConverter to provide DocumentReference-specific conversion logic
 * Fixes FHIR structure inconsistencies and content encoding issues
 */
import { AbstractFHIRConverter } from './AbstractFHIRConverter.js';
import { DocumentContentValidator } from '../../documents/documentContentValidator.js';

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
      contentType: 'text', // 'text', 'soap', or 'medical-history'
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
        
        // Try to parse as JSON for structured content
        try {
          const parsed = JSON.parse(decodedContent);
          
          // Check for SOAP format
          if (parsed.subjective || parsed.objective || parsed.assessment || parsed.plan) {
            contentType = 'soap';
            soapSections = {
              subjective: parsed.subjective || '',
              objective: parsed.objective || '',
              assessment: parsed.assessment || '',
              plan: parsed.plan || ''
            };
          }
          // Check for medical history format
          else if (parsed.chiefComplaint || parsed.historyOfPresentIllness || parsed.pastMedicalHistory) {
            contentType = 'medical-history';
            // Convert medical history to readable text format
            const sections = [];
            if (parsed.chiefComplaint) sections.push(`Chief Complaint: ${parsed.chiefComplaint}`);
            if (parsed.historyOfPresentIllness) sections.push(`History of Present Illness: ${parsed.historyOfPresentIllness}`);
            if (parsed.pastMedicalHistory) sections.push(`Past Medical History: ${parsed.pastMedicalHistory}`);
            if (parsed.medications) sections.push(`Medications: ${parsed.medications}`);
            if (parsed.allergies) sections.push(`Allergies: ${parsed.allergies}`);
            if (parsed.socialHistory) sections.push(`Social History: ${parsed.socialHistory}`);
            if (parsed.familyHistory) sections.push(`Family History: ${parsed.familyHistory}`);
            content = sections.join('\n\n');
          }
          // Check for text wrapper
          else if (parsed.text) {
            content = parsed.text;
          }
          // Fall back to stringified JSON
          else {
            content = decodedContent;
          }
        } catch (e) {
          // Not valid JSON, treat as plain text
          content = decodedContent;
        }
      } catch (error) {
        console.warn('Failed to decode document content:', error);
        content = 'Failed to decode content';
      }
    }
    
    // Extract references
    const encounterId = this.extractReferenceId(docRef.context?.encounter?.[0]);
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

    // Add encounter reference via context
    if (formData.encounterId) {
      resource.context = {
        encounter: [{
          reference: `Encounter/${formData.encounterId}`
        }]
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
   * Helper method to decode base64 content safely with enhanced error handling
   * @param {string} encodedContent - Base64 encoded content
   * @returns {string} Decoded content
   */
  _decodeBase64Content(encodedContent) {
    if (!encodedContent || typeof encodedContent !== 'string') {
      throw new Error('Invalid base64 content: content is null or not a string');
    }

    // Clean up the input - remove any whitespace and newlines
    const cleanedContent = encodedContent.replace(/\s+/g, '');
    
    // Validate base64 format
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(cleanedContent)) {
      throw new Error('Invalid base64 content: contains invalid characters');
    }

    // Check length - base64 should be multiple of 4
    if (cleanedContent.length % 4 !== 0) {
      throw new Error('Invalid base64 content: incorrect length');
    }

    try {
      const decoded = atob(cleanedContent);
      
      // Validate that we got actual content
      if (decoded.length === 0) {
        throw new Error('Decoded content is empty');
      }
      
      // Try to decode as UTF-8 to handle international characters
      try {
        return decodeURIComponent(escape(decoded));
      } catch (utfError) {
        // Fall back to raw decoded content if UTF-8 decoding fails
        return decoded;
      }
      
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Base64 decoding failed', {
          error: error.message,
          contentLength: cleanedContent.length,
          contentPreview: cleanedContent.substring(0, 50)
        });
      }
      throw new Error(`Failed to decode base64 content: ${error.message}`);
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
    // Input validation
    if (!docRef || typeof docRef !== 'object') {
      return {
        type: 'text',
        content: '',
        sections: null,
        error: 'Invalid document reference provided'
      };
    }

    // Log document structure for debugging (in development only)
    if (process.env.NODE_ENV === 'development') {
      console.debug('DocumentReferenceConverter: Processing document', {
        id: docRef.id,
        hasContent: !!docRef.content,
        contentLength: docRef.content?.length,
        hasAttachment: !!docRef.content?.[0]?.attachment,
        hasData: !!docRef.content?.[0]?.attachment?.data,
        contentType: docRef.content?.[0]?.attachment?.contentType
      });
    }

    if (!docRef.content?.[0]?.attachment?.data) {
      // Enhanced fallback content extraction with better validation
      
      // Check narrative text (FHIR R4 standard)
      if (docRef.text?.div) {
        // Strip HTML tags and decode entities for plain text
        const cleanContent = docRef.text.div
          .replace(/<[^>]*>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
          .trim();
        
        return {
          type: 'text',
          content: cleanContent,
          sections: null,
          error: null
        };
      }
      
      // Check for plain text content
      if (docRef.text) {
        const textContent = typeof docRef.text === 'string' ? docRef.text : 
                           docRef.text.status && docRef.text.div ? docRef.text.div :
                           JSON.stringify(docRef.text);
        return {
          type: 'text',
          content: textContent,
          sections: null,
          error: null
        };
      }
      
      // Check if there's a content field with different structure
      if (docRef.content && docRef.content.length > 0) {
        const content = docRef.content[0];
        
        // Maybe the content is stored directly as string
        if (typeof content === 'string') {
          // Check if it might be base64 encoded
          try {
            const decoded = atob(content);
            return {
              type: 'text',
              content: decoded,
              sections: null,
              error: null
            };
          } catch (e) {
            // Not base64, use as-is
            return {
              type: 'text',
              content: content,
              sections: null,
              error: null
            };
          }
        }
        
        // Check if attachment exists but without data field
        if (content.attachment) {
          const attachment = content.attachment;
          
          // Check for data field with different name or structure
          if (attachment.content) {
            try {
              const decoded = atob(attachment.content);
              return {
                type: 'text',
                content: decoded,
                sections: null,
                error: null
              };
            } catch (e) {
              return {
                type: 'text',
                content: attachment.content,
                sections: null,
                error: null
              };
            }
          }
          
          // Check if title or other field has content
          if (attachment.title && attachment.title.length > 20) {
            return {
              type: 'text',
              content: attachment.title,
              sections: null,
              error: null
            };
          }
        }
        
        // Check if the content object has any text-like fields
        const textFields = ['text', 'data', 'content', 'description', 'narrative'];
        for (const field of textFields) {
          if (content[field] && typeof content[field] === 'string') {
            // Try to decode if it looks like base64
            if (content[field].length > 20 && /^[A-Za-z0-9+/]+=*$/.test(content[field])) {
              try {
                const decoded = atob(content[field]);
                return {
                  type: 'text',
                  content: decoded,
                  sections: null,
                  error: null
                };
              } catch (e) {
                // Not valid base64, use as-is
              }
            }
            
            return {
              type: 'text',
              content: content[field],
              sections: null,
              error: null
            };
          }
        }
      }
      
      // Check if the entire docRef object has some encoded content in unexpected places
      if (docRef.data && typeof docRef.data === 'string') {
        try {
          const decoded = atob(docRef.data);
          return {
            type: 'text',
            content: decoded,
            sections: null,
            error: null
          };
        } catch (e) {
          return {
            type: 'text',
            content: docRef.data,
            sections: null,
            error: null
          };
        }
      }
      
      return {
        type: 'text',
        content: '',
        sections: null,
        error: 'No content data found'
      };
    }

    try {
      const attachmentData = docRef.content[0].attachment.data;
      const contentType = docRef.content[0].attachment.contentType;
      
      // Validate base64 data before decoding
      if (!attachmentData || typeof attachmentData !== 'string') {
        return {
          type: 'text',
          content: '',
          sections: null,
          error: 'Invalid attachment data format'
        };
      }
      
      // Check if data looks like valid base64
      const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
      if (!base64Regex.test(attachmentData)) {
        // Data might not be base64 encoded, try using as-is
        return {
          type: 'text',
          content: attachmentData,
          sections: null,
          error: null
        };
      }
      
      const decodedContent = this._decodeBase64Content(attachmentData);
      
      // Validate decoded content
      if (!decodedContent || decodedContent.trim().length === 0) {
        return {
          type: 'text',
          content: '',
          sections: null,
          error: 'Decoded content is empty'
        };
      }

      // Enhanced JSON parsing with better error handling
      if (contentType === 'application/json' || decodedContent.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(decodedContent);
          
          // Validate JSON structure
          if (!parsed || typeof parsed !== 'object') {
            throw new Error('Invalid JSON structure');
          }
          
          // Check for SOAP format with validation
          if (this._isSOAPFormat(parsed)) {
            const cleanSections = this._validateAndCleanSOAPSections(parsed);
            return {
              type: 'soap',
              content: decodedContent,
              sections: cleanSections,
              error: null
            };
          }
          
          // Check for medical history format with validation
          else if (this._isMedicalHistoryFormat(parsed)) {
            const formattedContent = this._formatMedicalHistory(parsed);
            return {
              type: 'medical-history',
              content: formattedContent,
              sections: null,
              error: null
            };
          }
          
          // Check for text wrapper
          else if (parsed.text && typeof parsed.text === 'string') {
            return {
              type: 'text',
              content: parsed.text.trim(),
              sections: null,
              error: null
            };
          }
          
          // Unknown JSON structure - convert to readable format
          else {
            const readableContent = this._convertObjectToReadableText(parsed);
            return {
              type: 'text',
              content: readableContent,
              sections: null,
              error: null
            };
          }
          
        } catch (jsonError) {
          // Log JSON parsing error in development only for actual JSON content types
          if (process.env.NODE_ENV === 'development' && 
              contentType === 'application/json' && 
              decodedContent.trim().startsWith('{')) {
            console.debug('DocumentReferenceConverter: JSON parsing failed for structured content', {
              docId: docRef?.id,
              error: jsonError.message,
              contentType,
              contentLength: decodedContent.length,
              contentPreview: decodedContent.substring(0, 100)
            });
          }
          
          // Fall through to treat as plain text
        }
      }

      // Return as plain text with content validation
      const cleanContent = decodedContent.trim();
      return {
        type: 'text',
        content: cleanContent,
        sections: null,
        error: null
      };
      
    } catch (error) {
      // Enhanced error logging
      if (process.env.NODE_ENV === 'development') {
        console.error('DocumentReferenceConverter: Content extraction failed', {
          error: error.message,
          docRefId: docRef.id,
          hasAttachment: !!docRef.content?.[0]?.attachment,
          dataLength: docRef.content?.[0]?.attachment?.data?.length
        });
      }
      
      return {
        type: 'text',
        content: '',
        sections: null,
        error: `Failed to decode content: ${error.message}`
      };
    }
  }

  /**
   * Check if parsed JSON object is in SOAP format
   * @param {Object} parsed - Parsed JSON object
   * @returns {boolean} True if SOAP format
   */
  _isSOAPFormat(parsed) {
    return !!(parsed.subjective || parsed.objective || parsed.assessment || parsed.plan);
  }

  /**
   * Check if parsed JSON object is in medical history format
   * @param {Object} parsed - Parsed JSON object
   * @returns {boolean} True if medical history format
   */
  _isMedicalHistoryFormat(parsed) {
    return !!(parsed.chiefComplaint || parsed.historyOfPresentIllness || 
              parsed.pastMedicalHistory || parsed.historyPresentIllness);
  }

  /**
   * Validate and clean SOAP sections
   * @param {Object} parsed - Parsed SOAP data
   * @returns {Object} Clean SOAP sections
   */
  _validateAndCleanSOAPSections(parsed) {
    const cleanSections = {};
    const soapFields = ['subjective', 'objective', 'assessment', 'plan'];
    
    soapFields.forEach(field => {
      if (parsed[field] && typeof parsed[field] === 'string') {
        cleanSections[field] = parsed[field].trim();
      } else {
        cleanSections[field] = '';
      }
    });

    // Include additional fields that might be present
    const additionalFields = ['chiefComplaint', 'historyPresentIllness', 'reviewOfSystems', 'physicalExam'];
    additionalFields.forEach(field => {
      if (parsed[field] && typeof parsed[field] === 'string') {
        cleanSections[field] = parsed[field].trim();
      }
    });

    return cleanSections;
  }

  /**
   * Format medical history data into readable text
   * @param {Object} parsed - Parsed medical history data
   * @returns {string} Formatted text
   */
  _formatMedicalHistory(parsed) {
    const sections = [];
    const fieldMappings = {
      chiefComplaint: 'Chief Complaint',
      historyOfPresentIllness: 'History of Present Illness',
      historyPresentIllness: 'History of Present Illness', // Alternative spelling
      pastMedicalHistory: 'Past Medical History',
      medications: 'Medications',
      allergies: 'Allergies',
      socialHistory: 'Social History',
      familyHistory: 'Family History',
      reviewOfSystems: 'Review of Systems',
      physicalExam: 'Physical Examination'
    };

    Object.entries(fieldMappings).forEach(([field, label]) => {
      if (parsed[field] && typeof parsed[field] === 'string' && parsed[field].trim()) {
        sections.push(`${label}: ${parsed[field].trim()}`);
      }
    });

    return sections.length > 0 ? sections.join('\n\n') : 'No content available';
  }

  /**
   * Convert unknown JSON object to readable text
   * @param {Object} obj - Object to convert
   * @returns {string} Readable text representation
   */
  _convertObjectToReadableText(obj) {
    const lines = [];
    
    const formatValue = (key, value, depth = 0) => {
      const indent = '  '.repeat(depth);
      
      if (value === null || value === undefined) {
        return `${indent}${key}: (empty)`;
      }
      
      if (typeof value === 'string') {
        return value.trim() ? `${indent}${key}: ${value.trim()}` : null;
      }
      
      if (typeof value === 'number' || typeof value === 'boolean') {
        return `${indent}${key}: ${value}`;
      }
      
      if (Array.isArray(value)) {
        if (value.length === 0) return null;
        const items = value.map(item => 
          typeof item === 'string' ? item.trim() : JSON.stringify(item)
        ).filter(Boolean);
        return items.length > 0 ? `${indent}${key}: ${items.join(', ')}` : null;
      }
      
      if (typeof value === 'object') {
        const subLines = [];
        Object.entries(value).forEach(([subKey, subValue]) => {
          const formattedSub = formatValue(subKey, subValue, depth + 1);
          if (formattedSub) subLines.push(formattedSub);
        });
        
        if (subLines.length > 0) {
          return `${indent}${key}:\n${subLines.join('\n')}`;
        }
      }
      
      return null;
    };

    Object.entries(obj).forEach(([key, value]) => {
      const formatted = formatValue(key, value);
      if (formatted) lines.push(formatted);
    });

    return lines.length > 0 ? lines.join('\n\n') : 'No readable content available';
  }

  /**
   * Validate DocumentReference and its content
   * @param {Object} docRef - FHIR DocumentReference resource
   * @returns {Object} Validation result with extracted content
   */
  validateDocumentContent(docRef) {
    try {
      // Extract content first
      const extractedContent = this.extractDocumentContent(docRef);
      
      // Perform comprehensive validation
      const validation = DocumentContentValidator.validateExtractedContent(docRef, extractedContent);
      
      // Add extraction metadata
      validation.extraction = {
        type: extractedContent.type,
        hasContent: !!extractedContent.content,
        contentLength: extractedContent.content?.length || 0,
        hasSections: !!extractedContent.sections,
        extractionError: extractedContent.error
      };
      
      // Log validation results in development
      if (process.env.NODE_ENV === 'development') {
        if (!validation.overall.isValid || validation.overall.warnings.length > 0) {
          console.info('DocumentReferenceConverter: Validation results', {
            docId: docRef.id,
            isValid: validation.overall.isValid,
            errorCount: validation.overall.errors.length,
            warningCount: validation.overall.warnings.length,
            contentType: extractedContent.type,
            errors: validation.overall.errors,
            warnings: validation.overall.warnings
          });
        }
      }
      
      return {
        ...validation,
        extractedContent
      };
      
    } catch (error) {
      return {
        overall: {
          isValid: false,
          errors: [`Validation failed: ${error.message}`],
          warnings: []
        },
        document: { isValid: false, errors: [error.message], warnings: [] },
        content: null,
        extraction: {
          type: 'unknown',
          hasContent: false,
          contentLength: 0,
          hasSections: false,
          extractionError: error.message
        },
        extractedContent: {
          type: 'text',
          content: '',
          sections: null,
          error: error.message
        }
      };
    }
  }

  /**
   * Enhanced content extraction with validation
   * @param {Object} docRef - FHIR DocumentReference
   * @returns {Object} Extracted content with validation metadata
   */
  extractDocumentContentWithValidation(docRef) {
    const validation = this.validateDocumentContent(docRef);
    
    return {
      ...validation.extractedContent,
      validation: {
        isValid: validation.overall.isValid,
        errors: validation.overall.errors,
        warnings: validation.overall.warnings,
        metadata: validation.extraction
      }
    };
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