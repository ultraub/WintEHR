/**
 * CDS Service Model - Spec-compliant service definition
 * Based on CDS Hooks 1.0 specification
 */

/**
 * CDS Service Definition
 * @typedef {Object} CDSService
 * @property {string} id - Unique service identifier
 * @property {string} hook - Hook type this service responds to
 * @property {string} [title] - Human-readable service name
 * @property {string} description - Service description
 * @property {Object.<string, string>} [prefetch] - FHIR query templates
 * @property {string} [usageRequirements] - Additional requirements or limitations
 */

/**
 * Valid hook types per CDS Hooks specification
 */
export const HOOK_TYPES = {
  PATIENT_VIEW: 'patient-view',
  MEDICATION_PRESCRIBE: 'medication-prescribe',
  ORDER_SIGN: 'order-sign',
  ORDER_SELECT: 'order-select',
  ENCOUNTER_START: 'encounter-start',
  ENCOUNTER_DISCHARGE: 'encounter-discharge'
};

/**
 * Card indicator levels
 */
export const INDICATOR_LEVELS = {
  INFO: 'info',
  WARNING: 'warning', 
  CRITICAL: 'critical',
  HARD_STOP: 'hard-stop' // Note: hard-stop not in original spec but commonly used
};

/**
 * Creates a spec-compliant CDS service definition
 * @param {Partial<CDSService>} data - Service data
 * @returns {CDSService} Complete service definition
 */
export function createCDSService(data = {}) {
  return {
    id: data.id || '',
    hook: data.hook || HOOK_TYPES.PATIENT_VIEW,
    title: data.title || '',
    description: data.description || '',
    prefetch: data.prefetch || {},
    usageRequirements: data.usageRequirements || null
  };
}

/**
 * Validates a CDS service definition against the specification
 * @param {CDSService} service - Service to validate
 * @returns {{valid: boolean, errors: string[]}} Validation result
 */
export function validateCDSService(service) {
  const errors = [];

  // Required fields
  if (!service.id || !service.id.trim()) {
    errors.push('Service ID is required');
  } else if (!/^[a-zA-Z0-9_-]+$/.test(service.id)) {
    errors.push('Service ID must contain only letters, numbers, hyphens, and underscores');
  }

  if (!service.hook) {
    errors.push('Hook type is required');
  } else if (!Object.values(HOOK_TYPES).includes(service.hook)) {
    errors.push(`Invalid hook type. Must be one of: ${Object.values(HOOK_TYPES).join(', ')}`);
  }

  if (!service.description || !service.description.trim()) {
    errors.push('Service description is required');
  }

  // Validate prefetch templates if present
  if (service.prefetch && typeof service.prefetch === 'object') {
    Object.entries(service.prefetch).forEach(([key, template]) => {
      if (typeof template !== 'string') {
        errors.push(`Prefetch template '${key}' must be a string`);
      } else if (!template.includes('{{') && !template.startsWith('Patient/')) {
        errors.push(`Prefetch template '${key}' should include context tokens or be a valid FHIR query`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * CDS Card structure per specification
 * @typedef {Object} CDSCard
 * @property {string} [uuid] - Unique card identifier
 * @property {string} summary - Brief summary (≤140 characters)
 * @property {string} indicator - Urgency/importance level
 * @property {Object} source - Information source
 * @property {string} source.label - Source label
 * @property {string} [source.url] - Source URL
 * @property {string} [source.icon] - Source icon URL
 * @property {string} [detail] - Markdown-formatted details
 * @property {Array} [suggestions] - Suggested actions
 * @property {string} [selectionBehavior] - How suggestions should be applied
 * @property {Array} [overrideReasons] - Reasons for overriding
 * @property {Array} [links] - Related links
 */

/**
 * Creates a spec-compliant CDS card
 * @param {Partial<CDSCard>} data - Card data
 * @returns {CDSCard} Complete card
 */
export function createCDSCard(data = {}) {
  const card = {
    summary: data.summary || '',
    indicator: data.indicator || INDICATOR_LEVELS.INFO,
    source: data.source || { label: 'CDS Service' }
  };

  // Add optional fields if provided
  if (data.uuid) card.uuid = data.uuid;
  if (data.detail) card.detail = data.detail;
  if (data.suggestions) card.suggestions = data.suggestions;
  if (data.selectionBehavior) card.selectionBehavior = data.selectionBehavior;
  if (data.overrideReasons) card.overrideReasons = data.overrideReasons;
  if (data.links) card.links = data.links;

  return card;
}

/**
 * Validates a CDS card against the specification
 * @param {CDSCard} card - Card to validate
 * @returns {{valid: boolean, errors: string[]}} Validation result
 */
export function validateCDSCard(card) {
  const errors = [];

  // Required fields
  if (!card.summary || !card.summary.trim()) {
    errors.push('Card summary is required');
  } else if (card.summary.length > 140) {
    errors.push('Card summary must be 140 characters or less');
  }

  if (!card.indicator) {
    errors.push('Card indicator is required');
  } else if (!Object.values(INDICATOR_LEVELS).includes(card.indicator)) {
    errors.push(`Invalid indicator. Must be one of: ${Object.values(INDICATOR_LEVELS).join(', ')}`);
  }

  if (!card.source || typeof card.source !== 'object') {
    errors.push('Card source is required and must be an object');
  } else if (!card.source.label) {
    errors.push('Card source must have a label');
  }

  // Validate suggestions if present
  if (card.suggestions && Array.isArray(card.suggestions)) {
    card.suggestions.forEach((suggestion, index) => {
      if (!suggestion.label) {
        errors.push(`Suggestion ${index + 1} must have a label`);
      }
      if (!suggestion.actions || !Array.isArray(suggestion.actions)) {
        errors.push(`Suggestion ${index + 1} must have an actions array`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Hook context structure per specification
 * @typedef {Object} HookContext
 * @property {string} [userId] - User identifier
 * @property {string} [patientId] - Patient identifier  
 * @property {string} [encounterId] - Encounter identifier
 * @property {Object} [draftOrders] - Draft orders (for order hooks)
 * @property {Object} [medications] - Medications (for medication hooks)
 */

/**
 * CDS Request structure
 * @typedef {Object} CDSRequest
 * @property {string} hook - Hook type
 * @property {string} hookInstance - Unique instance identifier
 * @property {string} [fhirServer] - FHIR server URL
 * @property {Object} [fhirAuthorization] - OAuth token
 * @property {HookContext} context - Hook-specific context
 * @property {Object} [prefetch] - Pre-fetched FHIR resources
 */

/**
 * CDS Response structure
 * @typedef {Object} CDSResponse
 * @property {CDSCard[]} cards - Array of cards
 * @property {Array} [systemActions] - System actions to take
 */

export default {
  HOOK_TYPES,
  INDICATOR_LEVELS,
  createCDSService,
  validateCDSService,
  createCDSCard,
  validateCDSCard
};