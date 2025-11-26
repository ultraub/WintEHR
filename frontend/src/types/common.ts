/**
 * Common Utility Types for WintEHR
 *
 * Shared types used across multiple type definition files.
 * This file exists to avoid circular dependencies.
 */

// =============================================================================
// Async State Types
// =============================================================================

/**
 * Type for async function return values with loading/error states
 */
export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

// =============================================================================
// Clinical Severity and Status Types
// =============================================================================

/**
 * Clinical severity levels
 */
export type ClinicalSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/**
 * Clinical status types
 */
export type ClinicalStatus = 'active' | 'inactive' | 'completed' | 'cancelled' | 'pending' | 'draft';

/**
 * Clinical severity color mapping
 */
export const SEVERITY_COLORS: Record<ClinicalSeverity, { color: string; bgcolor: string }> = {
  critical: { color: '#d32f2f', bgcolor: '#ffebee' },
  high: { color: '#f57c00', bgcolor: '#fff3e0' },
  medium: { color: '#fbc02d', bgcolor: '#fffde7' },
  low: { color: '#388e3c', bgcolor: '#e8f5e9' },
  info: { color: '#1976d2', bgcolor: '#e3f2fd' },
};

/**
 * Clinical status color mapping
 */
export const STATUS_COLORS: Record<ClinicalStatus, string> = {
  active: '#388e3c',
  inactive: '#757575',
  completed: '#1976d2',
  cancelled: '#d32f2f',
  pending: '#f57c00',
  draft: '#9e9e9e',
};
