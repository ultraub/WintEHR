/**
 * Configuration Validation Utility
 *
 * Validates that required environment variables are set, especially in production.
 * Provides warnings when configuration is missing but allows fallback to proxy paths.
 */

/**
 * Validate environment configuration
 *
 * Checks for required environment variables in production mode.
 * Logs errors for missing variables but doesn't throw to allow fallback behavior.
 *
 * @returns {Object} Validation result with valid flag and error list
 */
export const validateConfiguration = () => {
  const errors = [];

  // Production checks
  if (process.env.NODE_ENV === 'production') {
    if (!import.meta.env.REACT_APP_API_URL) {
      errors.push('REACT_APP_API_URL not set');
    }

    if (!import.meta.env.REACT_APP_FHIR_ENDPOINT) {
      errors.push('REACT_APP_FHIR_ENDPOINT not set');
    }

    // No WebSocket check: the address is derived from the page's host
    // (config/apiConfig.js buildWebSocketConfig), so there is nothing to set.
  }

  if (errors.length > 0) {
    console.error('[Config Validation] Missing environment variables:', errors);
    console.warn('[Config Validation] Using fallback proxy paths. This may not work correctly in production.');
    return { valid: false, errors };
  }

  // Config validation passed — no need to log in production
  return { valid: true };
};

/**
 * Get current configuration status for debugging
 *
 * @returns {Object} Current configuration state
 */
export const getConfigurationStatus = () => {
  return {
    environment: process.env.NODE_ENV,
    hasApiUrl: !!import.meta.env.REACT_APP_API_URL,
    hasFhirEndpoint: !!import.meta.env.REACT_APP_FHIR_ENDPOINT,
    hasWsUrlOverride: !!import.meta.env.REACT_APP_WEBSOCKET_URL,
    apiUrl: import.meta.env.REACT_APP_API_URL || 'not set',
    fhirEndpoint: import.meta.env.REACT_APP_FHIR_ENDPOINT || 'not set',
    wsUrl: import.meta.env.REACT_APP_WEBSOCKET_URL || 'derived from page host'
  };
};
