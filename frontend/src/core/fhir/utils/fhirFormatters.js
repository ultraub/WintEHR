/**
 * FHIR Data Formatters
 * Utility functions to safely format FHIR data types for display
 */

/**
 * Format a FHIR CodeableConcept for display
 * @param {Object} codeableConcept - FHIR CodeableConcept object
 * @returns {string} Display text
 */
export const formatCodeableConcept = (codeableConcept) => {
  if (!codeableConcept) return '';
  
  // Check for text first (preferred)
  if (codeableConcept.text) return codeableConcept.text;
  
  // Check for coding display
  if (codeableConcept.coding?.length > 0) {
    const primaryCoding = codeableConcept.coding[0];
    return primaryCoding.display || primaryCoding.code || '';
  }
  
  return '';
};

/**
 * Format a FHIR Coding for display
 * @param {Object} coding - FHIR Coding object
 * @returns {string} Display text
 */
export const formatCoding = (coding) => {
  if (!coding) return '';
  return coding.display || coding.code || '';
};

/**
 * Format a FHIR Reference for display
 * @param {Object} reference - FHIR Reference object
 * @returns {string} Display text
 */
export const formatReference = (reference) => {
  if (!reference) return '';
  
  if (typeof reference === 'string') return reference;
  
  return reference.display || reference.reference || '';
};

/**
 * Format a FHIR Period for display
 * @param {Object} period - FHIR Period object
 * @returns {string} Display text
 */
export const formatPeriod = (period) => {
  if (!period) return '';
  
  const start = period.start ? new Date(period.start).toLocaleDateString() : '';
  const end = period.end ? new Date(period.end).toLocaleDateString() : 'Present';
  
  if (start && end) return `${start} - ${end}`;
  if (start) return `Since ${start}`;
  if (period.end) return `Until ${end}`;
  
  return '';
};

/**
 * Format a FHIR Quantity for display
 * @param {Object} quantity - FHIR Quantity object
 * @returns {string} Display text
 */
export const formatQuantity = (quantity) => {
  if (!quantity) return '';
  
  const value = quantity.value || '';
  const unit = quantity.unit || quantity.code || '';
  
  return `${value} ${unit}`.trim();
};

/**
 * Format a FHIR HumanName for display
 * @param {Object} name - FHIR HumanName object
 * @returns {string} Display text
 */
export const formatHumanName = (name) => {
  if (!name) return '';
  
  const given = name.given?.join(' ') || '';
  const family = name.family || '';
  
  return `${given} ${family}`.trim();
};

/**
 * Format a FHIR Address for display
 * @param {Object} address - FHIR Address object
 * @returns {string} Display text
 */
export const formatAddress = (address) => {
  if (!address) return '';
  
  const parts = [];
  
  if (address.line?.length > 0) {
    parts.push(address.line.join(', '));
  }
  
  if (address.city) parts.push(address.city);
  if (address.state) parts.push(address.state);
  if (address.postalCode) parts.push(address.postalCode);
  if (address.country) parts.push(address.country);
  
  return parts.join(', ');
};

/**
 * Format a FHIR ContactPoint for display
 * @param {Object} contactPoint - FHIR ContactPoint object
 * @returns {string} Display text
 */
export const formatContactPoint = (contactPoint) => {
  if (!contactPoint) return '';
  
  const value = contactPoint.value || '';
  const use = contactPoint.use ? `(${contactPoint.use})` : '';
  
  return `${value} ${use}`.trim();
};

/**
 * Safely get display text from any FHIR field
 * @param {*} field - Any FHIR field that might contain display text
 * @returns {string} Display text
 */
export const getDisplayText = (field) => {
  if (!field) return '';
  
  // Handle string
  if (typeof field === 'string') return field;
  
  // Handle array (take first item)
  if (Array.isArray(field) && field.length > 0) {
    return getDisplayText(field[0]);
  }
  
  // Handle objects with common FHIR patterns
  if (typeof field === 'object') {
    // CodeableConcept
    if ('coding' in field || 'text' in field) {
      return formatCodeableConcept(field);
    }
    
    // Reference
    if ('reference' in field || 'display' in field) {
      return formatReference(field);
    }
    
    // Coding
    if ('code' in field && 'system' in field) {
      return formatCoding(field);
    }
    
    // Period
    if ('start' in field || 'end' in field) {
      return formatPeriod(field);
    }
    
    // Quantity
    if ('value' in field && ('unit' in field || 'code' in field)) {
      return formatQuantity(field);
    }
  }
  
  return '';
};

/**
 * Format FHIR date/dateTime for display
 * @param {string} date - FHIR date or dateTime string
 * @param {string} format - Display format ('short', 'long', 'relative')
 * @returns {string} Formatted date
 */
export const formatFHIRDate = (date, format = 'short') => {
  if (!date) return '';
  
  try {
    const dateObj = new Date(date);
    
    switch (format) {
      case 'short':
        return dateObj.toLocaleDateString();
      case 'long':
        return dateObj.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
      case 'relative':
        const now = new Date();
        const diffTime = Math.abs(now - dateObj);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
        if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
        return `${Math.floor(diffDays / 365)} years ago`;
      default:
        return dateObj.toLocaleDateString();
    }
  } catch (error) {
    
    return date;
  }
};