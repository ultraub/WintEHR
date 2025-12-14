/**
 * String Formatting Utilities
 * Centralized string manipulation functions for consistent text handling
 *
 * Note: For truncateText and getInitials, use the FHIR utilities:
 *   - truncateText: import from '@/utils/fhir'
 *   - getInitials: import from '@/utils/fhir' (supports FHIR HumanName objects)
 *
 * @module utils/string/formatters
 */

/**
 * Capitalize the first letter of a string
 * @param text - The text to capitalize
 * @returns Text with first letter capitalized
 *
 * @example
 * capitalizeFirst('hello') // 'Hello'
 */
export const capitalizeFirst = (text: string | null | undefined): string => {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
};

/**
 * Convert string to title case
 * @param text - The text to convert
 * @returns Text in title case (first letter of each word capitalized)
 *
 * @example
 * toTitleCase('hello world') // 'Hello World'
 */
export const toTitleCase = (text: string | null | undefined): string => {
  if (!text) return '';
  return text
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

/**
 * Remove extra whitespace from a string
 * @param text - The text to normalize
 * @returns Text with normalized whitespace
 *
 * @example
 * normalizeWhitespace('  hello   world  ') // 'hello world'
 */
export const normalizeWhitespace = (text: string | null | undefined): string => {
  if (!text) return '';
  return text.trim().replace(/\s+/g, ' ');
};
