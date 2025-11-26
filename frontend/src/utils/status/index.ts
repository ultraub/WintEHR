/**
 * Status Utilities - Barrel Export
 *
 * Centralized exports for all status-related utilities including
 * colors, filters, and indicator helpers.
 */

export {
  // Color functions
  getStatusColor,
  getPriorityColor,
  getSeverityColor,
  getResultStatusColor,
  getClinicalCardBackground,
  getClinicalAlertLevel,

  // Types
  type ClinicalStatus,
  type Priority,
  type Severity,
  type ResultStatus,
  type ClinicalCardType,
  type AlertLevel,
} from './colors';
