/**
 * FHIR Status Display Utilities
 *
 * Standardized status color and label mapping for clinical display.
 * Ensures consistent visual representation of resource statuses across the application.
 *
 * Standard Color Mapping:
 * - active → success (green)
 * - completed → primary (blue)
 * - cancelled/entered-in-error → error (red)
 * - stopped/on-hold → warning (orange)
 * - default → default (gray)
 *
 * @since 2025-11-26
 */

/**
 * Universal status-to-color mapping
 *
 * These colors align with Material-UI's color palette and clinical design standards.
 */
export const STATUS_COLORS = {
  // Active/Current states
  active: 'success',
  'in-progress': 'success',
  current: 'success',
  confirmed: 'success',
  final: 'success',
  arrived: 'success',

  // Completed/Resolved states
  completed: 'primary',
  finished: 'primary',
  resolved: 'resolved',
  inactive: 'default',
  remission: 'primary',
  amended: 'primary',

  // Warning states
  stopped: 'warning',
  'on-hold': 'warning',
  'entered-in-error': 'error',
  suspended: 'warning',
  preliminary: 'warning',
  draft: 'warning',

  // Error/Cancelled states
  cancelled: 'error',
  refuted: 'error',
  unknown: 'default',

  // Planning states
  planned: 'info',
  intended: 'info',
  requested: 'info',
  proposed: 'info',
  pending: 'info',

  // Appointment states
  booked: 'primary',
  fulfilled: 'success',
  noshow: 'warning',
  waitlist: 'info',
  'checked-in': 'info',

  // Default
  registered: 'default',
};

/**
 * Human-readable status labels
 *
 * Converts technical FHIR status codes to user-friendly labels.
 */
export const STATUS_LABELS = {
  // Condition statuses
  active: 'Active',
  resolved: 'Resolved',
  inactive: 'Inactive',
  remission: 'In Remission',
  recurrence: 'Recurrence',

  // Medication statuses
  stopped: 'Stopped',
  'on-hold': 'On Hold',
  completed: 'Completed',
  cancelled: 'Cancelled',
  'entered-in-error': 'Error',

  // Observation statuses
  final: 'Final',
  preliminary: 'Preliminary',
  registered: 'Registered',
  amended: 'Amended',
  corrected: 'Corrected',

  // Encounter statuses
  planned: 'Planned',
  arrived: 'Arrived',
  'in-progress': 'In Progress',
  finished: 'Finished',

  // Verification statuses
  confirmed: 'Confirmed',
  unconfirmed: 'Unconfirmed',
  provisional: 'Provisional',
  differential: 'Differential',
  refuted: 'Refuted',

  // Order statuses
  draft: 'Draft',
  requested: 'Requested',
  received: 'Received',
  accepted: 'Accepted',
  rejected: 'Rejected',

  // Appointment statuses
  booked: 'Booked',
  fulfilled: 'Fulfilled',
  noshow: 'No Show',
  waitlist: 'Waitlist',
  'checked-in': 'Checked In',

  // Generic
  unknown: 'Unknown',
  pending: 'Pending',
  current: 'Current',
};

/**
 * Get the display color for a status value
 *
 * @param {string} status - Status code (e.g., 'active', 'completed')
 * @param {string} resourceType - Optional resource type for context-specific colors
 * @returns {string} - Material-UI color name: 'success', 'error', 'warning', 'primary', 'info', 'default'
 *
 * @example
 * getStatusColor('active') // 'success'
 * getStatusColor('stopped') // 'warning'
 * getStatusColor('cancelled') // 'error'
 */
export const getStatusColor = (status, resourceType = null) => {
  if (!status) return 'default';

  const normalizedStatus = String(status).toLowerCase().trim();

  // Resource-specific overrides
  if (resourceType) {
    const resourceOverride = getResourceSpecificColor(normalizedStatus, resourceType);
    if (resourceOverride) return resourceOverride;
  }

  return STATUS_COLORS[normalizedStatus] || 'default';
};

/**
 * Get resource-specific color overrides
 *
 * Some resources have contextual meaning for status colors.
 *
 * @param {string} status - Normalized status
 * @param {string} resourceType - FHIR resource type
 * @returns {string|null} - Color override or null
 */
const getResourceSpecificColor = (status, resourceType) => {
  const overrides = {
    Condition: {
      resolved: 'primary', // Blue for resolved conditions
      inactive: 'default',
    },
    MedicationRequest: {
      completed: 'default', // Neutral for completed prescriptions
    },
    Observation: {
      preliminary: 'warning', // Highlight preliminary results
      final: 'default', // Neutral for final results
    },
  };

  return overrides[resourceType]?.[status] || null;
};

/**
 * Get human-readable label for a status value
 *
 * @param {string} status - Status code
 * @param {boolean} capitalize - Whether to capitalize the first letter
 * @returns {string} - Human-readable status label
 *
 * @example
 * getStatusLabel('in-progress') // 'In Progress'
 * getStatusLabel('entered-in-error') // 'Error'
 */
export const getStatusLabel = (status, capitalize = true) => {
  if (!status) return 'Unknown';

  const normalizedStatus = String(status).toLowerCase().trim();
  const label = STATUS_LABELS[normalizedStatus];

  if (label) return label;

  // Fallback: convert kebab-case to Title Case
  const fallbackLabel = normalizedStatus
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());

  return capitalize ? fallbackLabel : fallbackLabel.toLowerCase();
};

/**
 * Get both color and label for a status
 *
 * @param {string} status - Status code
 * @param {string} resourceType - Optional resource type
 * @returns {Object} - { color: string, label: string }
 *
 * @example
 * getStatusDisplay('active')
 * // { color: 'success', label: 'Active' }
 */
export const getStatusDisplay = (status, resourceType = null) => {
  return {
    color: getStatusColor(status, resourceType),
    label: getStatusLabel(status),
  };
};

/**
 * Interpretation code display utilities
 *
 * Maps observation interpretation codes to colors and labels.
 * Handles all FHIR observation interpretation codes.
 */
export const INTERPRETATION_DISPLAY = {
  // High values
  H: { color: 'error', label: 'High', severity: 'high' },
  HH: { color: 'error', label: 'Critical High', severity: 'critical' },
  HU: { color: 'error', label: 'Significantly High', severity: 'high' },
  '>': { color: 'error', label: 'Above Range', severity: 'high' },

  // Low values
  L: { color: 'warning', label: 'Low', severity: 'low' },
  LL: { color: 'error', label: 'Critical Low', severity: 'critical' },
  LU: { color: 'warning', label: 'Significantly Low', severity: 'low' },
  '<': { color: 'warning', label: 'Below Range', severity: 'low' },

  // Abnormal
  A: { color: 'warning', label: 'Abnormal', severity: 'abnormal' },
  AA: { color: 'error', label: 'Critical Abnormal', severity: 'critical' },

  // Normal
  N: { color: 'success', label: 'Normal', severity: 'normal' },

  // Other
  I: { color: 'info', label: 'Intermediate', severity: 'info' },
  S: { color: 'info', label: 'Susceptible', severity: 'info' },
  R: { color: 'error', label: 'Resistant', severity: 'abnormal' },
  MS: { color: 'warning', label: 'Moderately Susceptible', severity: 'info' },
  VS: { color: 'success', label: 'Very Susceptible', severity: 'info' },
  POS: { color: 'error', label: 'Positive', severity: 'abnormal' },
  NEG: { color: 'success', label: 'Negative', severity: 'normal' },
  IND: { color: 'warning', label: 'Indeterminate', severity: 'info' },
  DET: { color: 'info', label: 'Detected', severity: 'info' },
  ND: { color: 'success', label: 'Not Detected', severity: 'normal' },
  U: { color: 'default', label: 'Unknown', severity: 'unknown' },
};

/**
 * Get display information for an interpretation code
 *
 * @param {string|Object} interpretation - Interpretation code or CodeableConcept
 * @returns {Object} - { color: string, label: string, severity: string }
 *
 * @example
 * getInterpretationDisplay('H')
 * // { color: 'error', label: 'High', severity: 'high' }
 *
 * getInterpretationDisplay({ coding: [{ code: 'LL' }] })
 * // { color: 'error', label: 'Critical Low', severity: 'critical' }
 */
export const getInterpretationDisplay = (interpretation) => {
  if (!interpretation) {
    return { color: 'default', label: '', severity: 'unknown' };
  }

  // Handle string directly
  if (typeof interpretation === 'string') {
    return INTERPRETATION_DISPLAY[interpretation.toUpperCase()] ||
           { color: 'default', label: interpretation, severity: 'unknown' };
  }

  // Handle CodeableConcept
  if (interpretation.coding?.[0]?.code) {
    const code = interpretation.coding[0].code.toUpperCase();
    return INTERPRETATION_DISPLAY[code] ||
           { color: 'default', label: interpretation.coding[0].display || code, severity: 'unknown' };
  }

  // Handle text fallback
  if (interpretation.text) {
    return { color: 'default', label: interpretation.text, severity: 'unknown' };
  }

  return { color: 'default', label: '', severity: 'unknown' };
};

/**
 * Check if an interpretation indicates a critical value
 *
 * @param {string|Object} interpretation - Interpretation code or CodeableConcept
 * @returns {boolean} - True if critical
 */
export const isCriticalInterpretation = (interpretation) => {
  const display = getInterpretationDisplay(interpretation);
  return display.severity === 'critical';
};

/**
 * Check if an interpretation indicates an abnormal value
 *
 * @param {string|Object} interpretation - Interpretation code or CodeableConcept
 * @returns {boolean} - True if abnormal (high, low, critical, or abnormal)
 */
export const isAbnormalInterpretation = (interpretation) => {
  const display = getInterpretationDisplay(interpretation);
  return ['critical', 'high', 'low', 'abnormal'].includes(display.severity);
};

/**
 * Get priority color for clinical urgency
 *
 * @param {string} priority - Priority code (routine, urgent, asap, stat)
 * @returns {string} - Material-UI color
 */
export const getPriorityColor = (priority) => {
  const priorityColors = {
    stat: 'error',
    asap: 'warning',
    urgent: 'warning',
    routine: 'default',
  };

  return priorityColors[String(priority).toLowerCase()] || 'default';
};

/**
 * Get priority label for display
 *
 * @param {string} priority - Priority code
 * @returns {string} - Human-readable priority label
 */
export const getPriorityLabel = (priority) => {
  const priorityLabels = {
    stat: 'STAT',
    asap: 'ASAP',
    urgent: 'Urgent',
    routine: 'Routine',
  };

  return priorityLabels[String(priority).toLowerCase()] || priority || 'Routine';
};

/**
 * Get combined priority display
 *
 * @param {string} priority - Priority code
 * @returns {Object} - { color: string, label: string }
 */
export const getPriorityDisplay = (priority) => {
  return {
    color: getPriorityColor(priority),
    label: getPriorityLabel(priority),
  };
};
