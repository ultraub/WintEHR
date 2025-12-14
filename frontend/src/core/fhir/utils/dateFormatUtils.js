/**
 * FHIR Date Format Utilities
 *
 * Standardized date formatting for clinical display.
 * All FHIR date/datetime fields should use these utilities for consistency.
 *
 * Standard Formats:
 * - standard: 'MMM d, yyyy' → "Jan 15, 2025"
 * - withTime: 'MMM d, yyyy h:mm a' → "Jan 15, 2025 2:30 PM"
 * - short: 'MM/dd/yyyy' → "01/15/2025" (forms/exports only)
 * - verbose: 'MMMM d, yyyy' → "January 15, 2025"
 * - relative: "2 hours ago", "yesterday", etc.
 *
 * @since 2025-11-26
 */

import { format, parseISO, isValid, formatDistanceToNow, differenceInDays } from 'date-fns';

/**
 * Date format presets for clinical display
 */
export const DATE_PRESETS = {
  standard: 'MMM d, yyyy',           // "Jan 15, 2025" - default for all dates
  withTime: 'MMM d, yyyy h:mm a',    // "Jan 15, 2025 2:30 PM" - when time matters
  short: 'MM/dd/yyyy',               // "01/15/2025" - forms and exports only
  verbose: 'MMMM d, yyyy',           // "January 15, 2025" - formal documents
  verboseWithTime: 'MMMM d, yyyy h:mm a', // "January 15, 2025 2:30 PM" - detailed with time
  timeOnly: 'h:mm a',                // "2:30 PM" - same-day references
  monthDay: 'MMM d',                 // "Jan 15" - short date without year
  monthYear: 'MMMM yyyy',            // "January 2025" - historical summaries
  shortMonthYear: 'MMM yyyy',        // "Jan 2025" - abbreviated month + year
  iso: "yyyy-MM-dd'T'HH:mm:ss",      // ISO format for FHIR
};

/**
 * Parse a FHIR date string into a Date object
 *
 * FHIR dates can be in various formats:
 * - Full datetime: "2025-01-15T14:30:00Z"
 * - Date only: "2025-01-15"
 * - Year-month: "2025-01"
 * - Year only: "2025"
 *
 * @param {string|Date} dateValue - FHIR date string or Date object
 * @returns {Date|null} - Parsed Date or null if invalid
 */
export const parseFhirDate = (dateValue) => {
  if (!dateValue) return null;

  // Already a Date object
  if (dateValue instanceof Date) {
    return isValid(dateValue) ? dateValue : null;
  }

  // String parsing
  if (typeof dateValue !== 'string') return null;

  try {
    // Handle partial dates by padding
    let normalizedDate = dateValue;

    // Year only: "2025" → "2025-01-01"
    if (/^\d{4}$/.test(dateValue)) {
      normalizedDate = `${dateValue}-01-01`;
    }
    // Year-month: "2025-01" → "2025-01-01"
    else if (/^\d{4}-\d{2}$/.test(dateValue)) {
      normalizedDate = `${dateValue}-01`;
    }

    const parsed = parseISO(normalizedDate);
    return isValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

/**
 * Format a clinical date with standardized presets
 *
 * @param {string|Date} dateValue - FHIR date string or Date object
 * @param {string} preset - Format preset: 'standard', 'withTime', 'short', 'verbose', 'timeOnly', 'relative'
 * @param {string} defaultValue - Value to return if date is invalid
 * @returns {string} - Formatted date string
 *
 * @example
 * formatClinicalDate('2025-01-15T14:30:00Z') // "Jan 15, 2025"
 * formatClinicalDate('2025-01-15T14:30:00Z', 'withTime') // "Jan 15, 2025 2:30 PM"
 * formatClinicalDate('2025-01-15', 'short') // "01/15/2025"
 * formatClinicalDate(null) // "" (empty string by default)
 */
export const formatClinicalDate = (dateValue, preset = 'standard', defaultValue = '') => {
  const date = parseFhirDate(dateValue);

  if (!date) {
    return defaultValue;
  }

  // Handle relative formatting
  if (preset === 'relative') {
    return formatRelativeDate(date);
  }

  // Get format pattern from preset
  const formatPattern = DATE_PRESETS[preset] || DATE_PRESETS.standard;

  try {
    return format(date, formatPattern);
  } catch {
    return defaultValue;
  }
};

/**
 * Format a date as relative time (e.g., "2 hours ago")
 *
 * Returns absolute date if more than 7 days ago.
 *
 * @param {Date} date - Date object
 * @returns {string} - Relative time string
 */
export const formatRelativeDate = (date) => {
  if (!date || !isValid(date)) return '';

  const daysDiff = Math.abs(differenceInDays(new Date(), date));

  // Use relative for recent dates (within 7 days)
  if (daysDiff <= 7) {
    return formatDistanceToNow(date, { addSuffix: true });
  }

  // Use absolute date for older dates
  return format(date, DATE_PRESETS.standard);
};

/**
 * Format a FHIR Period (start/end dates)
 *
 * @param {Object} period - FHIR Period object with start and/or end
 * @param {string} preset - Format preset
 * @param {string} separator - Separator between dates (default: " - ")
 * @returns {string} - Formatted period string
 *
 * @example
 * formatPeriod({ start: '2024-01-01', end: '2025-01-01' })
 * // "Jan 1, 2024 - Jan 1, 2025"
 *
 * formatPeriod({ start: '2024-01-01' })
 * // "Jan 1, 2024 - Present"
 */
export const formatPeriod = (period, preset = 'standard', separator = ' - ') => {
  if (!period) return '';

  const startDate = formatClinicalDate(period.start, preset);
  const endDate = period.end ? formatClinicalDate(period.end, preset) : 'Present';

  if (!startDate && !endDate) return '';
  if (!startDate) return endDate;
  if (!endDate || endDate === 'Present') return `${startDate}${separator}Present`;

  return `${startDate}${separator}${endDate}`;
};

/**
 * Format a FHIR dateTime for display with smart time handling
 *
 * Shows time only if it's meaningful (not midnight) and within last 24 hours.
 *
 * @param {string} dateTime - FHIR dateTime string
 * @param {boolean} alwaysShowTime - Force showing time even if midnight
 * @returns {string} - Formatted date/time string
 */
export const formatSmartDateTime = (dateTime, alwaysShowTime = false) => {
  const date = parseFhirDate(dateTime);
  if (!date) return '';

  const daysDiff = Math.abs(differenceInDays(new Date(), date));
  const hasTime = typeof dateTime === 'string' && dateTime.includes('T');
  const isMidnight = date.getHours() === 0 && date.getMinutes() === 0;

  // Show time for recent dates with meaningful time
  if (hasTime && (alwaysShowTime || (!isMidnight && daysDiff <= 1))) {
    return formatClinicalDate(dateTime, 'withTime');
  }

  return formatClinicalDate(dateTime, 'standard');
};

/**
 * Get age display from a birth date
 *
 * @param {string} birthDate - FHIR date string for birth date
 * @returns {string} - Age display (e.g., "45 years", "6 months", "2 weeks")
 */
export const getAgeDisplay = (birthDate) => {
  const date = parseFhirDate(birthDate);
  if (!date) return '';

  const now = new Date();
  const years = now.getFullYear() - date.getFullYear();
  const months = now.getMonth() - date.getMonth();
  const adjustedYears = months < 0 ? years - 1 : years;

  if (adjustedYears >= 2) {
    return `${adjustedYears} years`;
  }

  // Calculate months for infants
  const totalMonths = adjustedYears * 12 + months + (now.getDate() >= date.getDate() ? 0 : -1);

  if (totalMonths >= 1) {
    return `${totalMonths} month${totalMonths !== 1 ? 's' : ''}`;
  }

  // Calculate weeks for newborns
  const days = differenceInDays(now, date);
  const weeks = Math.floor(days / 7);

  if (weeks >= 1) {
    return `${weeks} week${weeks !== 1 ? 's' : ''}`;
  }

  return `${days} day${days !== 1 ? 's' : ''}`;
};

/**
 * Sort comparison function for FHIR dates (newest first)
 *
 * @param {string} a - First FHIR date
 * @param {string} b - Second FHIR date
 * @returns {number} - Sort comparison result
 */
export const compareFhirDatesDescending = (a, b) => {
  const dateA = parseFhirDate(a);
  const dateB = parseFhirDate(b);

  if (!dateA && !dateB) return 0;
  if (!dateA) return 1;
  if (!dateB) return -1;

  return dateB.getTime() - dateA.getTime();
};

/**
 * Sort comparison function for FHIR dates (oldest first)
 *
 * @param {string} a - First FHIR date
 * @param {string} b - Second FHIR date
 * @returns {number} - Sort comparison result
 */
export const compareFhirDatesAscending = (a, b) => {
  return -compareFhirDatesDescending(a, b);
};

/**
 * Check if a FHIR date is in the past
 *
 * @param {string} dateValue - FHIR date string
 * @returns {boolean} - True if date is before now
 */
export const isFhirDateInPast = (dateValue) => {
  const date = parseFhirDate(dateValue);
  if (!date) return false;
  return date < new Date();
};

/**
 * Check if a FHIR date is in the future
 *
 * @param {string} dateValue - FHIR date string
 * @returns {boolean} - True if date is after now
 */
export const isFhirDateInFuture = (dateValue) => {
  const date = parseFhirDate(dateValue);
  if (!date) return false;
  return date > new Date();
};

/**
 * Get the most recent date from a list of FHIR dates
 *
 * @param {string[]} dates - Array of FHIR date strings
 * @returns {string|null} - Most recent date string or null
 */
export const getMostRecentDate = (dates) => {
  if (!Array.isArray(dates) || dates.length === 0) return null;

  const validDates = dates.filter(d => parseFhirDate(d));
  if (validDates.length === 0) return null;

  validDates.sort(compareFhirDatesDescending);
  return validDates[0];
};
