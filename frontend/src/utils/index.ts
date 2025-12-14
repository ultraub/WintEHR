/**
 * Centralized Utilities Export
 *
 * This barrel file provides a single import point for all shared utilities.
 * Part of Phase 1: Shared Utilities Extraction in the frontend refactoring plan.
 *
 * Usage:
 *   import { getStatusColor, formatClinicalDate, extractId, sortByDate } from '@/utils';
 *
 * Or import from specific domains:
 *   import { getStatusColor } from '@/utils/status';
 *   import { formatClinicalDate } from '@/utils/date';
 *   import { extractId } from '@/utils/fhir';
 *   import { sortByDate } from '@/utils/collection';
 */

// Status utilities - clinical status colors, priority colors, severity colors
export * from './status';

// Date utilities - formatting, calculations, relative dates
export * from './date';

// FHIR utilities - reference handling, display formatting
export * from './fhir';

// Collection utilities - sorting, filtering, grouping, pagination
export * from './collection';

// String utilities - text formatting, truncation, initials
export * from './string';
