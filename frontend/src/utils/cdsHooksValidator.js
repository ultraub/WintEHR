/**
 * CDS Hooks Validator
 * Validates CDS services and requests against CDS Hooks 1.0 specification
 */

// Valid hook types per CDS Hooks 1.0 spec
const VALID_HOOKS = [
  'patient-view',
  'medication-prescribe',
  'order-select',
  'order-sign',
  'encounter-start',
  'encounter-discharge',
  'appointment-book',
  'appointment-create',
  'appointment-update',
  'appointment-cancel'
];

// Valid card indicators
const VALID_INDICATORS = ['info', 'warning', 'critical'];

// Valid suggestion action types
const VALID_ACTION_TYPES = ['create', 'update', 'delete'];

// Valid link types
const VALID_LINK_TYPES = ['absolute', 'smart'];

/**
 * Validate a CDS service definition
 * @param {Object} service - Service definition to validate
 * @returns {Object} Validation result with isValid, errors, and warnings
 */
export function validateServiceDefinition(service) {
  const errors = [];
  const warnings = [];

  // Required fields
  if (!service.id) {
    errors.push('Service ID is required');
  } else if (typeof service.id !== 'string') {
    errors.push('Service ID must be a string');
  } else if (!/^[a-zA-Z0-9_-]+$/.test(service.id)) {
    warnings.push('Service ID should only contain letters, numbers, hyphens, and underscores');
  }

  if (!service.hook) {
    errors.push('Hook type is required');
  } else if (!VALID_HOOKS.includes(service.hook)) {
    errors.push(`Invalid hook type: ${service.hook}. Must be one of: ${VALID_HOOKS.join(', ')}`);
  }

  if (!service.description) {
    errors.push('Description is required');
  } else if (typeof service.description !== 'string') {
    errors.push('Description must be a string');
  }

  // Optional fields
  if (service.title && typeof service.title !== 'string') {
    errors.push('Title must be a string');
  }

  // Validate prefetch if present
  if (service.prefetch) {
    if (typeof service.prefetch !== 'object') {
      errors.push('Prefetch must be an object');
    } else {
      Object.entries(service.prefetch).forEach(([key, template]) => {
        if (typeof template !== 'string') {
          errors.push(`Prefetch template "${key}" must be a string`);
        } else if (!template.includes('/') && !template.includes('?')) {
          warnings.push(`Prefetch template "${key}" may be invalid - should be a FHIR query`);
        }
      });
    }
  }

  // Check for non-standard fields
  const standardFields = ['id', 'hook', 'title', 'description', 'prefetch', 'usageRequirements'];
  Object.keys(service).forEach(key => {
    if (!standardFields.includes(key) && !key.startsWith('_')) {
      warnings.push(`Non-standard field "${key}" will be ignored by CDS clients`);
    }
  });

  // Specific checks for common mistakes
  if (service.conditions) {
    errors.push('Conditions field is not part of CDS Hooks spec - move logic to service implementation');
  }

  if (service.cards) {
    errors.push('Cards should not be stored in service definition - they should be generated dynamically');
  }

  if (service.displayBehavior) {
    errors.push('Display behavior is not part of CDS Hooks spec - this is controlled by the client');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate a CDS Hooks request
 * @param {Object} request - Request to validate
 * @returns {Object} Validation result
 */
export function validateCDSRequest(request) {
  const errors = [];
  const warnings = [];

  // Required fields
  if (!request.hookInstance) {
    errors.push('hookInstance is required');
  } else if (typeof request.hookInstance !== 'string') {
    errors.push('hookInstance must be a string');
  }

  if (!request.hook) {
    errors.push('hook is required');
  } else if (!VALID_HOOKS.includes(request.hook)) {
    errors.push(`Invalid hook type: ${request.hook}`);
  }

  if (!request.context) {
    errors.push('context is required');
  } else if (typeof request.context !== 'object') {
    errors.push('context must be an object');
  }

  // Hook-specific context validation
  if (request.hook && request.context) {
    const contextErrors = validateContextForHook(request.hook, request.context);
    errors.push(...contextErrors);
  }

  // Optional fields
  if (request.fhirAuthorization && typeof request.fhirAuthorization !== 'object') {
    errors.push('fhirAuthorization must be an object');
  }

  if (request.prefetch && typeof request.prefetch !== 'object') {
    errors.push('prefetch must be an object');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate context for specific hook type
 * @param {string} hook - Hook type
 * @param {Object} context - Context object
 * @returns {Array} Array of error messages
 */
function validateContextForHook(hook, context) {
  const errors = [];

  switch (hook) {
    case 'patient-view':
      if (!context.patientId) {
        errors.push('patientId is required in context for patient-view hook');
      }
      if (!context.userId) {
        errors.push('userId is required in context for patient-view hook');
      }
      break;

    case 'medication-prescribe':
      if (!context.patientId) {
        errors.push('patientId is required in context for medication-prescribe hook');
      }
      if (!context.userId) {
        errors.push('userId is required in context for medication-prescribe hook');
      }
      if (!context.medications || !Array.isArray(context.medications)) {
        errors.push('medications array is required in context for medication-prescribe hook');
      }
      break;

    case 'order-select':
    case 'order-sign':
      if (!context.patientId) {
        errors.push(`patientId is required in context for ${hook} hook`);
      }
      if (!context.userId) {
        errors.push(`userId is required in context for ${hook} hook`);
      }
      if (!context.draftOrders || !Array.isArray(context.draftOrders)) {
        errors.push(`draftOrders array is required in context for ${hook} hook`);
      }
      break;

    case 'encounter-start':
    case 'encounter-discharge':
      if (!context.patientId) {
        errors.push(`patientId is required in context for ${hook} hook`);
      }
      if (!context.userId) {
        errors.push(`userId is required in context for ${hook} hook`);
      }
      if (!context.encounterId) {
        errors.push(`encounterId is required in context for ${hook} hook`);
      }
      break;
  }

  return errors;
}

/**
 * Validate a CDS card
 * @param {Object} card - Card to validate
 * @returns {Object} Validation result
 */
export function validateCDSCard(card) {
  const errors = [];
  const warnings = [];

  // Required fields
  if (!card.summary) {
    errors.push('Card summary is required');
  } else if (typeof card.summary !== 'string') {
    errors.push('Card summary must be a string');
  } else if (card.summary.length > 140) {
    errors.push(`Card summary must be 140 characters or less (current: ${card.summary.length})`);
  }

  if (!card.indicator) {
    errors.push('Card indicator is required');
  } else if (!VALID_INDICATORS.includes(card.indicator)) {
    errors.push(`Invalid indicator: ${card.indicator}. Must be one of: ${VALID_INDICATORS.join(', ')}`);
  }

  if (!card.source) {
    errors.push('Card source is required');
  } else if (typeof card.source !== 'object') {
    errors.push('Card source must be an object');
  } else if (!card.source.label) {
    errors.push('Card source.label is required');
  }

  // Optional fields
  if (card.detail && typeof card.detail !== 'string') {
    errors.push('Card detail must be a string');
  }

  // Validate suggestions
  if (card.suggestions) {
    if (!Array.isArray(card.suggestions)) {
      errors.push('Card suggestions must be an array');
    } else {
      card.suggestions.forEach((suggestion, index) => {
        const suggestionErrors = validateSuggestion(suggestion);
        errors.push(...suggestionErrors.map(e => `Suggestion ${index}: ${e}`));
      });
    }
  }

  // Validate links
  if (card.links) {
    if (!Array.isArray(card.links)) {
      errors.push('Card links must be an array');
    } else {
      card.links.forEach((link, index) => {
        const linkErrors = validateLink(link);
        errors.push(...linkErrors.map(e => `Link ${index}: ${e}`));
      });
    }
  }

  // Validate selection behavior
  if (card.selectionBehavior && !['at-most-one', 'any'].includes(card.selectionBehavior)) {
    errors.push('Invalid selectionBehavior. Must be "at-most-one" or "any"');
  }

  // Check for UUID
  if (card.uuid && typeof card.uuid !== 'string') {
    errors.push('Card uuid must be a string');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate a suggestion
 * @param {Object} suggestion - Suggestion to validate
 * @returns {Array} Array of error messages
 */
function validateSuggestion(suggestion) {
  const errors = [];

  if (!suggestion.label) {
    errors.push('label is required');
  }

  if (suggestion.actions) {
    if (!Array.isArray(suggestion.actions)) {
      errors.push('actions must be an array');
    } else {
      suggestion.actions.forEach((action, index) => {
        if (!action.type) {
          errors.push(`Action ${index}: type is required`);
        } else if (!VALID_ACTION_TYPES.includes(action.type)) {
          errors.push(`Action ${index}: Invalid type "${action.type}"`);
        }
        
        if (!action.description) {
          errors.push(`Action ${index}: description is required`);
        }
      });
    }
  }

  if (suggestion.isRecommended !== undefined && typeof suggestion.isRecommended !== 'boolean') {
    errors.push('isRecommended must be a boolean');
  }

  return errors;
}

/**
 * Validate a link
 * @param {Object} link - Link to validate
 * @returns {Array} Array of error messages
 */
function validateLink(link) {
  const errors = [];

  if (!link.label) {
    errors.push('label is required');
  }

  if (!link.url) {
    errors.push('url is required');
  } else if (typeof link.url !== 'string') {
    errors.push('url must be a string');
  }

  if (!link.type) {
    errors.push('type is required');
  } else if (!VALID_LINK_TYPES.includes(link.type)) {
    errors.push(`Invalid type "${link.type}". Must be "absolute" or "smart"`);
  }

  return errors;
}

/**
 * Validate a complete CDS response
 * @param {Object} response - Response to validate
 * @returns {Object} Validation result
 */
export function validateCDSResponse(response) {
  const errors = [];
  const warnings = [];

  if (!response.cards) {
    errors.push('Response must include cards array');
  } else if (!Array.isArray(response.cards)) {
    errors.push('Response cards must be an array');
  } else {
    response.cards.forEach((card, index) => {
      const cardValidation = validateCDSCard(card);
      errors.push(...cardValidation.errors.map(e => `Card ${index}: ${e}`));
      warnings.push(...cardValidation.warnings.map(e => `Card ${index}: ${e}`));
    });
  }

  // Check for systemActions (optional)
  if (response.systemActions && !Array.isArray(response.systemActions)) {
    errors.push('systemActions must be an array');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate prefetch template syntax
 * @param {string} template - Prefetch template string
 * @returns {Object} Validation result
 */
export function validatePrefetchTemplate(template) {
  const errors = [];
  const warnings = [];

  if (typeof template !== 'string') {
    errors.push('Prefetch template must be a string');
    return { isValid: false, errors, warnings };
  }

  // Check for context placeholders
  const placeholderRegex = /\{\{([^}]+)\}\}/g;
  const placeholders = [];
  let match;

  while ((match = placeholderRegex.exec(template)) !== null) {
    placeholders.push(match[1]);
  }

  if (placeholders.length === 0) {
    warnings.push('Prefetch template has no context placeholders');
  }

  // Validate placeholder syntax
  placeholders.forEach(placeholder => {
    if (!placeholder.startsWith('context.')) {
      warnings.push(`Placeholder "${placeholder}" should start with "context."`);
    }
  });

  // Check for valid FHIR query structure
  if (!template.includes('/') && !template.includes('?')) {
    errors.push('Prefetch template should be a valid FHIR query');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    placeholders
  };
}

/**
 * Full validation of a service against CDS Hooks spec
 * @param {Object} service - Complete service object
 * @returns {Object} Comprehensive validation result
 */
export function validateCompleteService(service) {
  const result = {
    definition: validateServiceDefinition(service),
    prefetch: {},
    overall: {
      isValid: true,
      errors: [],
      warnings: []
    }
  };

  // Validate each prefetch template
  if (service.prefetch) {
    Object.entries(service.prefetch).forEach(([key, template]) => {
      result.prefetch[key] = validatePrefetchTemplate(template);
    });
  }

  // Aggregate results
  result.overall.errors.push(...result.definition.errors);
  result.overall.warnings.push(...result.definition.warnings);

  Object.entries(result.prefetch).forEach(([key, validation]) => {
    result.overall.errors.push(...validation.errors.map(e => `Prefetch ${key}: ${e}`));
    result.overall.warnings.push(...validation.warnings.map(e => `Prefetch ${key}: ${e}`));
  });

  result.overall.isValid = result.overall.errors.length === 0;

  return result;
}