/**
 * FHIR Utilities - Barrel Export
 *
 * Centralized exports for all FHIR-related utilities including
 * reference handling and display formatting.
 */

export {
  extractId,
  extractType,
  matchesReference,
  matchesPatient,
  standardizeReference,
  buildReference,
  resourceBelongsToPatient,
  filterBundleByPatient,
} from './references';

export {
  getCodeDisplay,
  getCodeValue,
  getPatientName,
  getInitials,
  getReferenceDisplay,
  getMedicationDisplay,
  truncateText,
} from './display';
