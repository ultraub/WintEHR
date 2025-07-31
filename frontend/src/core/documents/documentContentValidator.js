/**
 * Document Content Validator
 * Provides validation utilities for clinical document content
 */

export class DocumentContentValidator {
  /**
   * Validate DocumentReference resource structure
   * @param {Object} docRef - FHIR DocumentReference
   * @returns {Object} Validation result
   */
  static validateDocumentReference(docRef) {
    const errors = [];
    const warnings = [];
    
    // Required fields validation
    if (!docRef.status) {
      errors.push('Missing required field: status');
    } else if (!['current', 'superseded', 'entered-in-error'].includes(docRef.status)) {
      errors.push(`Invalid status: ${docRef.status}`);
    }
    
    if (!docRef.type?.coding?.[0]?.code) {
      errors.push('Missing required field: type.coding.code');
    }
    
    if (!docRef.subject?.reference) {
      errors.push('Missing required field: subject.reference');
    }
    
    if (!docRef.content || docRef.content.length === 0) {
      errors.push('Missing required field: content');
    } else {
      // Validate content structure
      const contentValidation = this.validateContentStructure(docRef.content[0]);
      errors.push(...contentValidation.errors);
      warnings.push(...contentValidation.warnings);
    }
    
    // Optional field warnings
    if (!docRef.date) {
      warnings.push('Missing recommended field: date');
    }
    
    if (!docRef.author?.[0]) {
      warnings.push('Missing recommended field: author');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  /**
   * Validate content structure
   * @param {Object} content - Content object from DocumentReference
   * @returns {Object} Validation result
   */
  static validateContentStructure(content) {
    const errors = [];
    const warnings = [];
    
    if (!content.attachment) {
      errors.push('Content missing attachment');
      return { errors, warnings };
    }
    
    const attachment = content.attachment;
    
    // Check for content data
    if (!attachment.data && !attachment.url) {
      errors.push('Attachment missing both data and url');
    }
    
    // Validate content type
    if (!attachment.contentType) {
      warnings.push('Missing content type');
    } else {
      const validTypes = [
        'text/plain',
        'application/json',
        'text/html',
        'application/pdf'
      ];
      if (!validTypes.includes(attachment.contentType)) {
        warnings.push(`Unusual content type: ${attachment.contentType}`);
      }
    }
    
    // Validate base64 data if present
    if (attachment.data) {
      const base64Validation = this.validateBase64Content(attachment.data);
      if (!base64Validation.isValid) {
        errors.push(...base64Validation.errors);
      }
    }
    
    return { errors, warnings };
  }
  
  /**
   * Validate base64 content
   * @param {string} data - Base64 encoded data
   * @returns {Object} Validation result
   */
  static validateBase64Content(data) {
    const errors = [];
    
    if (!data || typeof data !== 'string') {
      errors.push('Base64 data is not a string');
      return { isValid: false, errors };
    }
    
    // Clean and validate format
    const cleaned = data.replace(/\s+/g, '');
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    
    if (!base64Regex.test(cleaned)) {
      errors.push('Invalid base64 characters');
    }
    
    if (cleaned.length % 4 !== 0) {
      errors.push('Invalid base64 length (must be multiple of 4)');
    }
    
    // Try to decode
    try {
      const decoded = atob(cleaned);
      if (decoded.length === 0) {
        errors.push('Base64 decodes to empty content');
      }
    } catch (error) {
      errors.push(`Base64 decoding failed: ${error.message}`);
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Validate SOAP note sections
   * @param {Object} sections - SOAP sections object
   * @returns {Object} Validation result
   */
  static validateSOAPSections(sections) {
    const errors = [];
    const warnings = [];
    
    const requiredSections = ['subjective', 'objective', 'assessment', 'plan'];
    const foundSections = requiredSections.filter(section => 
      sections[section] && sections[section].trim().length > 0
    );
    
    if (foundSections.length === 0) {
      errors.push('No SOAP sections found with content');
    } else if (foundSections.length < 2) {
      warnings.push(`Only ${foundSections.length} SOAP section(s) have content`);
    }
    
    // Validate individual sections
    Object.entries(sections).forEach(([sectionKey, content]) => {
      if (content && typeof content !== 'string') {
        errors.push(`SOAP section ${sectionKey} is not a string`);
      }
    });
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      completeSections: foundSections
    };
  }
  
  /**
   * Validate medical history content
   * @param {Object} history - Medical history object
   * @returns {Object} Validation result
   */
  static validateMedicalHistory(history) {
    const errors = [];
    const warnings = [];
    
    const expectedFields = [
      'chiefComplaint',
      'historyOfPresentIllness',
      'pastMedicalHistory'
    ];
    
    const foundFields = expectedFields.filter(field => 
      history[field] && history[field].trim().length > 0
    );
    
    if (foundFields.length === 0) {
      errors.push('No medical history fields found with content');
    }
    
    // Check for minimum content requirements
    if (history.chiefComplaint && history.chiefComplaint.trim().length < 5) {
      warnings.push('Chief complaint is very short');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      completeFields: foundFields
    };
  }
  
  /**
   * Validate plain text content
   * @param {string} content - Plain text content
   * @returns {Object} Validation result
   */
  static validatePlainTextContent(content) {
    const errors = [];
    const warnings = [];
    
    if (!content || typeof content !== 'string') {
      errors.push('Content is not a string');
      return { isValid: false, errors, warnings };
    }
    
    const trimmed = content.trim();
    
    if (trimmed.length === 0) {
      errors.push('Content is empty');
    } else if (trimmed.length < 10) {
      warnings.push('Content is very short');
    }
    
    // Check for potential encoding issues
    if (content.includes('\ufffd')) {
      warnings.push('Content contains replacement characters (possible encoding issue)');
    }
    
    // Check for HTML tags in plain text
    if (/<[^>]+>/.test(content)) {
      warnings.push('Plain text content contains HTML tags');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      wordCount: trimmed.split(/\s+/).length,
      characterCount: trimmed.length
    };
  }
  
  /**
   * Comprehensive content validation
   * @param {Object} docRef - DocumentReference resource
   * @param {Object} extractedContent - Content extracted by converter
   * @returns {Object} Complete validation result
   */
  static validateExtractedContent(docRef, extractedContent) {
    const results = {
      document: this.validateDocumentReference(docRef),
      content: null,
      overall: { isValid: true, errors: [], warnings: [] }
    };
    
    // Validate based on content type
    if (extractedContent.error) {
      results.overall.errors.push(`Content extraction failed: ${extractedContent.error}`);
      results.overall.isValid = false;
    } else {
      switch (extractedContent.type) {
        case 'soap':
          results.content = this.validateSOAPSections(extractedContent.sections);
          break;
        case 'medical-history':
          try {
            const parsed = JSON.parse(extractedContent.content);
            results.content = this.validateMedicalHistory(parsed);
          } catch (e) {
            results.content = this.validatePlainTextContent(extractedContent.content);
          }
          break;
        case 'text':
        default:
          results.content = this.validatePlainTextContent(extractedContent.content);
          break;
      }
    }
    
    // Combine all errors and warnings
    results.overall.errors = [
      ...results.document.errors,
      ...(results.content?.errors || [])
    ];
    
    results.overall.warnings = [
      ...results.document.warnings,
      ...(results.content?.warnings || [])
    ];
    
    results.overall.isValid = results.overall.errors.length === 0;
    
    return results;
  }
}

export default DocumentContentValidator;