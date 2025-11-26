/**
 * FHIR Data Quality Logger
 *
 * Development-mode logging utility for tracking data quality issues.
 * Helps identify when fallbacks are used for critical clinical fields,
 * surfacing potential data extraction or data flow issues.
 *
 * Usage:
 * - Logs warnings to console in development mode only
 * - Automatically disabled in production
 * - Throttles repeated warnings to prevent console spam
 *
 * @since 2025-11-26
 */

const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';

// Throttle tracking to prevent repeated warnings
const warningThrottleMap = new Map();
const THROTTLE_INTERVAL_MS = 5000; // 5 seconds between same warnings

// Warning counts for summary reporting
const warningCounts = {
  byField: {},
  byContext: {},
  total: 0,
};

/**
 * Log a data quality warning for a missing or fallback field
 *
 * @param {string} field - Name of the missing/fallback field (e.g., 'patient name', 'medication display')
 * @param {Object} context - Additional context for debugging
 * @param {string} context.resourceId - ID of the resource with missing data
 * @param {string} context.resourceType - FHIR resource type
 * @param {string} context.component - Component where the fallback occurred
 * @param {*} context.value - The actual value that was missing/empty
 *
 * @example
 * // In a component:
 * const patientName = patient?.name?.[0]?.given?.[0];
 * if (!patientName) {
 *   logDataQuality('patient given name', {
 *     resourceId: patient?.id,
 *     resourceType: 'Patient',
 *     component: 'PatientHeader'
 *   });
 * }
 * return patientName || 'Unknown';
 */
export const logDataQuality = (field, context = {}) => {
  if (!IS_DEVELOPMENT) return;

  const throttleKey = `${field}:${context.resourceId || 'unknown'}`;

  // Check throttle
  const lastWarning = warningThrottleMap.get(throttleKey);
  const now = Date.now();

  if (lastWarning && now - lastWarning < THROTTLE_INTERVAL_MS) {
    return; // Throttled
  }

  warningThrottleMap.set(throttleKey, now);

  // Track counts
  warningCounts.total++;
  warningCounts.byField[field] = (warningCounts.byField[field] || 0) + 1;

  if (context.component) {
    warningCounts.byContext[context.component] =
      (warningCounts.byContext[context.component] || 0) + 1;
  }

  // Format and log warning
  const logMessage = formatWarning(field, context);
  console.warn(logMessage, context);
};

/**
 * Format a warning message for console output
 *
 * @param {string} field - Field name
 * @param {Object} context - Context object
 * @returns {string} - Formatted warning message
 */
const formatWarning = (field, context) => {
  const parts = ['[FHIR Data Quality]', `Missing: ${field}`];

  if (context.resourceType) {
    parts.push(`(${context.resourceType})`);
  }

  if (context.resourceId) {
    parts.push(`ID: ${context.resourceId}`);
  }

  if (context.component) {
    parts.push(`in ${context.component}`);
  }

  return parts.join(' ');
};

/**
 * Log a data quality warning with automatic field extraction
 *
 * Use this when you have a FHIR resource and want to log all missing critical fields.
 *
 * @param {string} resourceType - FHIR resource type
 * @param {Object} resource - The FHIR resource
 * @param {string} component - Component name for context
 * @param {Object} fieldPaths - Object mapping field names to their values (checks for truthy)
 *
 * @example
 * logMissingFields('Patient', patient, 'PatientHeader', {
 *   'given name': patient?.name?.[0]?.given?.[0],
 *   'family name': patient?.name?.[0]?.family,
 *   'birth date': patient?.birthDate
 * });
 */
export const logMissingFields = (resourceType, resource, component, fieldPaths) => {
  if (!IS_DEVELOPMENT) return;

  Object.entries(fieldPaths).forEach(([fieldName, value]) => {
    if (!value) {
      logDataQuality(fieldName, {
        resourceId: resource?.id,
        resourceType,
        component,
        value,
      });
    }
  });
};

/**
 * Log when a fallback value is used
 *
 * @param {string} field - Field name
 * @param {*} originalValue - The original (missing/empty) value
 * @param {*} fallbackValue - The fallback value being used
 * @param {Object} context - Additional context
 *
 * @example
 * const status = condition?.clinicalStatus?.coding?.[0]?.code;
 * if (!status) {
 *   logFallbackUsed('condition status', status, 'unknown', {
 *     resourceId: condition?.id,
 *     component: 'ConditionCard'
 *   });
 * }
 */
export const logFallbackUsed = (field, originalValue, fallbackValue, context = {}) => {
  if (!IS_DEVELOPMENT) return;

  logDataQuality(field, {
    ...context,
    originalValue,
    fallbackValue,
    message: `Using fallback "${fallbackValue}" instead`,
  });
};

/**
 * Create a logged fallback accessor
 *
 * Returns the value if truthy, otherwise logs and returns fallback.
 *
 * @param {*} value - The value to check
 * @param {*} fallback - Fallback value if value is falsy
 * @param {string} field - Field name for logging
 * @param {Object} context - Context for logging
 * @returns {*} - Value or fallback
 *
 * @example
 * const patientName = withFallback(
 *   patient?.name?.[0]?.given?.[0],
 *   'Unknown',
 *   'patient given name',
 *   { resourceId: patient?.id, component: 'PatientHeader' }
 * );
 */
export const withFallback = (value, fallback, field, context = {}) => {
  if (value) return value;

  logFallbackUsed(field, value, fallback, context);
  return fallback;
};

/**
 * Get summary of data quality warnings
 *
 * Useful for debugging data quality issues at the end of a session.
 *
 * @returns {Object} - Summary of warnings by field and context
 */
export const getDataQualitySummary = () => {
  if (!IS_DEVELOPMENT) return null;

  return {
    totalWarnings: warningCounts.total,
    byField: { ...warningCounts.byField },
    byComponent: { ...warningCounts.byContext },
  };
};

/**
 * Print data quality summary to console
 *
 * Call this at appropriate times (e.g., on unmount) to see overall data quality.
 */
export const printDataQualitySummary = () => {
  if (!IS_DEVELOPMENT) return;

  const summary = getDataQualitySummary();

  if (summary.totalWarnings === 0) {
    console.log('[FHIR Data Quality] No data quality warnings detected.');
    return;
  }

  console.groupCollapsed(
    `[FHIR Data Quality] Summary: ${summary.totalWarnings} warning(s)`
  );

  console.log('By Field:');
  Object.entries(summary.byField)
    .sort((a, b) => b[1] - a[1])
    .forEach(([field, count]) => {
      console.log(`  ${field}: ${count}`);
    });

  console.log('\nBy Component:');
  Object.entries(summary.byComponent)
    .sort((a, b) => b[1] - a[1])
    .forEach(([component, count]) => {
      console.log(`  ${component}: ${count}`);
    });

  console.groupEnd();
};

/**
 * Reset warning counts (useful for testing)
 */
export const resetDataQualityCounts = () => {
  warningCounts.total = 0;
  warningCounts.byField = {};
  warningCounts.byContext = {};
  warningThrottleMap.clear();
};

/**
 * Higher-order component wrapper for automatic data quality logging
 *
 * @param {string} componentName - Name of the component
 * @returns {Function} - HOC wrapper function
 *
 * @example
 * const PatientCard = withDataQualityLogging('PatientCard')(({ patient }) => {
 *   // Component implementation
 * });
 */
export const withDataQualityLogging = (componentName) => (Component) => {
  if (!IS_DEVELOPMENT) return Component;

  return function DataQualityWrapper(props) {
    // Can add useEffect here to log on mount/unmount if needed
    return Component(props);
  };
};

/**
 * Hook for component-level data quality logging
 *
 * @param {string} componentName - Name of the component
 * @returns {Object} - { log, logMissing, logFallback }
 *
 * @example
 * const PatientHeader = ({ patient }) => {
 *   const { logMissing, logFallback } = useDataQualityLogger('PatientHeader');
 *
 *   const name = patient?.name?.[0]?.given?.[0];
 *   if (!name) {
 *     logMissing('patient name', { resourceId: patient?.id });
 *   }
 *
 *   return <div>{name || 'Unknown'}</div>;
 * };
 */
export const useDataQualityLogger = (componentName) => {
  return {
    log: (field, context) =>
      logDataQuality(field, { ...context, component: componentName }),

    logMissing: (field, context) =>
      logDataQuality(field, { ...context, component: componentName }),

    logFallback: (field, originalValue, fallbackValue, context) =>
      logFallbackUsed(field, originalValue, fallbackValue, {
        ...context,
        component: componentName,
      }),

    withFallback: (value, fallback, field, context) =>
      withFallback(value, fallback, field, {
        ...context,
        component: componentName,
      }),
  };
};
