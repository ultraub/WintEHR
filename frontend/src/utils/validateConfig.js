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
    if (!process.env.REACT_APP_API_URL) {
      errors.push('REACT_APP_API_URL not set');
    }

    if (!process.env.REACT_APP_FHIR_ENDPOINT) {
      errors.push('REACT_APP_FHIR_ENDPOINT not set');
    }

    if (!process.env.REACT_APP_WS_URL) {
      errors.push('REACT_APP_WS_URL not set');
    }
  }

  if (errors.length > 0) {
    console.error('[Config Validation] Missing environment variables:', errors);
    console.warn('[Config Validation] Using fallback proxy paths. This may not work correctly in production.');
    return { valid: false, errors };
  }

  console.log('[Config Validation] All required environment variables are set.');
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
    hasApiUrl: !!process.env.REACT_APP_API_URL,
    hasFhirEndpoint: !!process.env.REACT_APP_FHIR_ENDPOINT,
    hasWsUrl: !!process.env.REACT_APP_WS_URL,
    apiUrl: process.env.REACT_APP_API_URL || 'not set',
    fhirEndpoint: process.env.REACT_APP_FHIR_ENDPOINT || 'not set',
    wsUrl: process.env.REACT_APP_WS_URL || 'not set'
  };
};
