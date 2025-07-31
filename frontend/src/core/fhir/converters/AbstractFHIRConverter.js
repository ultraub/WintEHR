/**
 * AbstractFHIRConverter Base Class
 * Provides standardized patterns for converting between FHIR resources and form data
 * Reduces code duplication across dialog configurations
 */

/**
 * Abstract base class for FHIR resource converters
 * Provides common patterns and utilities for resource/form data conversion
 */
export class AbstractFHIRConverter {
  constructor(resourceType, options = {}) {
    if (this.constructor === AbstractFHIRConverter) {
      throw new Error('AbstractFHIRConverter cannot be instantiated directly');
    }
    
    this.resourceType = resourceType;
    this.options = {
      // Default options
      generateId: true,
      validateRequired: true,
      preserveMeta: true,
      ...options
    };
  }

  /**
   * Parse FHIR resource to form data
   * @param {Object} resource - FHIR resource
   * @returns {Object} Form data object
   */
  parseToForm(resource) {
    if (!resource) return this.getInitialValues();
    
    try {
      return this._parseResourceToForm(resource);
    } catch (error) {
      console.error(`Error parsing ${this.resourceType} to form:`, error);
      return this.getInitialValues();
    }
  }

  /**
   * Create new FHIR resource from form data
   * @param {Object} formData - Form data
   * @param {string} patientId - Patient ID
   * @param {Object} context - Additional context (userId, etc.)
   * @returns {Object} FHIR resource
   */
  createResource(formData, patientId, context = {}) {
    if (this.options.validateRequired) {
      this._validateRequiredFields(formData);
    }

    const resource = {
      resourceType: this.resourceType,
      ...(this.options.generateId && { id: this._generateId() }),
      subject: this._createSubjectReference(patientId),
      ...this._createResourceFromForm(formData, context)
    };

    return this._postProcessResource(resource, 'create', formData, context);
  }

  /**
   * Update existing FHIR resource with form data
   * @param {Object} formData - Form data
   * @param {Object} existingResource - Existing FHIR resource
   * @param {Object} context - Additional context
   * @returns {Object} Updated FHIR resource
   */
  updateResource(formData, existingResource, context = {}) {
    if (!existingResource.id) {
      throw new Error(`Cannot update ${this.resourceType}: missing resource ID`);
    }

    if (this.options.validateRequired) {
      this._validateRequiredFields(formData);
    }

    const resource = {
      ...(this.options.preserveMeta && existingResource),
      resourceType: this.resourceType,
      id: existingResource.id,
      subject: existingResource.subject || this._createSubjectReference(context.patientId),
      ...this._updateResourceFromForm(formData, existingResource, context)
    };

    return this._postProcessResource(resource, 'update', formData, context);
  }

  // Abstract methods that must be implemented by subclasses
  getInitialValues() {
    throw new Error('getInitialValues() must be implemented by subclass');
  }

  _parseResourceToForm(resource) {
    throw new Error('_parseResourceToForm() must be implemented by subclass');
  }

  _createResourceFromForm(formData, context) {
    throw new Error('_createResourceFromForm() must be implemented by subclass');
  }

  _updateResourceFromForm(formData, existingResource, context) {
    // Default implementation - can be overridden
    return this._createResourceFromForm(formData, context);
  }

  _validateRequiredFields(formData) {
    // Default implementation - can be overridden
    // Subclasses can implement custom validation
  }

  // Utility methods available to all subclasses

  /**
   * Generate a unique ID for the resource
   * @returns {string} Unique ID
   */
  _generateId() {
    const resourcePrefix = this.resourceType.toLowerCase().replace(/([A-Z])/g, '-$1');
    return `${resourcePrefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create a subject reference for the patient
   * @param {string} patientId - Patient ID
   * @returns {Object} Subject reference
   */
  _createSubjectReference(patientId) {
    return {
      reference: `Patient/${patientId}`
    };
  }

  /**
   * Post-process the resource (hook for subclasses)
   * @param {Object} resource - The resource
   * @param {string} operation - 'create' or 'update'
   * @param {Object} formData - Original form data
   * @param {Object} context - Additional context
   * @returns {Object} Processed resource
   */
  _postProcessResource(resource, operation, formData, context) {
    // Default implementation - can be overridden
    return resource;
  }

  // Common FHIR field extractors and builders

  /**
   * Extract coding from FHIR CodeableConcept
   * @param {Object} codeableConcept - FHIR CodeableConcept
   * @param {string} defaultValue - Default value if extraction fails
   * @returns {string} Extracted code
   */
  extractCoding(codeableConcept, defaultValue = '') {
    if (!codeableConcept) return defaultValue;
    
    // Handle direct code
    if (typeof codeableConcept === 'string') return codeableConcept;
    
    // Handle coding array
    if (codeableConcept.coding?.[0]?.code) {
      return codeableConcept.coding[0].code;
    }
    
    // Handle direct code field
    if (codeableConcept.code) {
      return codeableConcept.code;
    }
    
    return defaultValue;
  }

  /**
   * Extract display text from FHIR CodeableConcept
   * @param {Object} codeableConcept - FHIR CodeableConcept  
   * @param {string} defaultValue - Default value if extraction fails
   * @returns {string} Extracted display text
   */
  extractDisplay(codeableConcept, defaultValue = '') {
    if (!codeableConcept) return defaultValue;
    
    // Try text first
    if (codeableConcept.text) return codeableConcept.text;
    
    // Try coding display
    if (codeableConcept.coding?.[0]?.display) {
      return codeableConcept.coding[0].display;
    }
    
    return defaultValue;
  }

  /**
   * Create FHIR CodeableConcept from form field
   * @param {Object} formField - Form field with code/display info
   * @param {string} defaultSystem - Default coding system
   * @returns {Object} FHIR CodeableConcept
   */
  createCodeableConcept(formField, defaultSystem = 'http://snomed.info/sct') {
    if (!formField) return null;
    
    // Handle string values
    if (typeof formField === 'string') {
      return { text: formField };
    }
    
    // Handle complex form field with code structure
    const code = String(
      formField.code?.coding?.[0]?.code || 
      formField.code || 
      formField.id || 
      'unknown'
    );
    
    const display = formField.display || 
                   formField.code?.text || 
                   'Unknown';
    
    const system = formField.system || 
                  formField.code?.coding?.[0]?.system || 
                  defaultSystem;

    return {
      coding: [{
        system,
        code,
        display
      }],
      text: display
    };
  }

  /**
   * Parse date from various FHIR date formats
   * @param {string|Object} dateValue - FHIR date value
   * @returns {Date|null} Parsed date
   */
  parseDate(dateValue) {
    if (!dateValue) return null;
    
    try {
      if (typeof dateValue === 'string') {
        return new Date(dateValue);
      }
      
      // Handle period start
      if (dateValue.start) {
        return new Date(dateValue.start);
      }
      
      return null;
    } catch (error) {
      console.warn('Failed to parse date:', dateValue, error);
      return null;
    }
  }

  /**
   * Create FHIR date string from Date object
   * @param {Date} date - Date object
   * @returns {string} FHIR date string
   */
  createDateString(date) {
    if (!date || !(date instanceof Date)) return null;
    return date.toISOString();
  }

  /**
   * Extract notes from FHIR resource
   * @param {Array} noteArray - FHIR note array
   * @returns {string} Extracted note text
   */
  extractNotes(noteArray) {
    if (!Array.isArray(noteArray) || noteArray.length === 0) return '';
    return noteArray[0]?.text || '';
  }

  /**
   * Create FHIR note array from text
   * @param {string} noteText - Note text
   * @returns {Array} FHIR note array
   */
  createNotes(noteText) {
    if (!noteText || typeof noteText !== 'string') return null;
    
    return [{
      text: noteText,
      time: new Date().toISOString()
    }];
  }

  /**
   * Extract reference ID from FHIR reference
   * @param {Object} reference - FHIR reference
   * @returns {string|null} Extracted ID
   */
  extractReferenceId(reference) {
    if (!reference?.reference) return null;
    return reference.reference.split('/')[1] || null;
  }

  /**
   * Create FHIR reference from resource type and ID
   * @param {string} resourceType - Resource type
   * @param {string} id - Resource ID
   * @returns {Object} FHIR reference
   */
  createReference(resourceType, id) {
    return {
      reference: `${resourceType}/${id}`
    };
  }

  /**
   * Safe string conversion for FHIR fields
   * @param {*} value - Value to convert
   * @param {string} defaultValue - Default value
   * @returns {string} String value
   */
  safeString(value, defaultValue = '') {
    if (value === null || value === undefined) return defaultValue;
    return String(value);
  }

  /**
   * Safe number conversion for FHIR fields
   * @param {*} value - Value to convert
   * @param {number} defaultValue - Default value
   * @returns {number} Number value
   */
  safeNumber(value, defaultValue = 0) {
    const num = parseFloat(value);
    return isNaN(num) ? defaultValue : num;
  }

  /**
   * Create status coding for common FHIR status fields
   * @param {string} status - Status value
   * @param {string} system - Coding system URL
   * @param {Array} options - Available status options
   * @returns {Object} FHIR status coding
   */
  createStatusCoding(status, system, options = []) {
    const statusOption = options.find(opt => opt.value === status);
    
    return {
      coding: [{
        system,
        code: status,
        display: statusOption?.display || status
      }]
    };
  }
}

export default AbstractFHIRConverter;