/**
 * WintEHR Frontend Type Definitions
 *
 * This module provides shared TypeScript types for the WintEHR frontend.
 * Types are organized into domain-specific modules for clarity.
 *
 * Usage:
 *   import { Patient, Condition, MedicationRequest } from '@/types';
 *   import type { ClinicalResourceCardProps } from '@/types';
 */

// Re-export all clinical domain types
export * from './clinical';

// Re-export FHIR types
export * from './fhir';

// Re-export common types
export * from './common';

// Re-export API types - this includes CatalogItem
export * from './api';

// Re-export component prop interfaces
// Note: components.ts imports CatalogItem from api.ts but doesn't re-export it
export * from './components';

// =============================================================================
// Common Utility Types
// =============================================================================

/**
 * Makes all properties of T optional recursively
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Extracts the resolved type from a Promise
 */
export type Awaited<T> = T extends Promise<infer U> ? U : T;

/**
 * Makes specified keys required while keeping others optional
 */
export type RequireKeys<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

/**
 * Makes specified keys optional while keeping others required
 */
export type OptionalKeys<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Type for values that can be null or undefined
 */
export type Nullable<T> = T | null | undefined;

/**
 * Type for paginated API responses
 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/**
 * Type for sort configuration
 */
export interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
}

/**
 * Type for filter configuration
 */
export interface FilterConfig {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'startsWith' | 'endsWith';
  value: string | number | boolean | Date;
}

// =============================================================================
// Event Types
// =============================================================================

/**
 * Clinical workflow event types
 */
export type ClinicalEventType =
  | 'ORDER_PLACED'
  | 'ORDER_CANCELLED'
  | 'ORDER_COMPLETED'
  | 'MEDICATION_ORDERED'
  | 'MEDICATION_ADMINISTERED'
  | 'MEDICATION_DISPENSED'
  | 'RESULT_RECEIVED'
  | 'RESULT_ACKNOWLEDGED'
  | 'ALERT_TRIGGERED'
  | 'ALERT_ACKNOWLEDGED'
  | 'PATIENT_SELECTED'
  | 'PATIENT_CLEARED'
  | 'ENCOUNTER_STARTED'
  | 'ENCOUNTER_ENDED'
  | 'NOTE_CREATED'
  | 'NOTE_SIGNED';

/**
 * Clinical workflow event payload
 */
export interface ClinicalEvent<T = unknown> {
  type: ClinicalEventType;
  timestamp: string;
  userId?: string;
  patientId?: string;
  data: T;
}

/**
 * WebSocket message types
 */
export type WebSocketMessageType =
  | 'clinical.update'
  | 'clinical.alert'
  | 'fhir.resource.created'
  | 'fhir.resource.updated'
  | 'fhir.resource.deleted'
  | 'connection.status'
  | 'ping'
  | 'pong';

/**
 * WebSocket message structure
 */
export interface WebSocketMessage<T = unknown> {
  type: WebSocketMessageType;
  timestamp: string;
  payload: T;
}

// =============================================================================
// UI State Types
// =============================================================================

/**
 * Toast/Snackbar notification configuration
 */
export interface NotificationConfig {
  message: string;
  severity: 'success' | 'info' | 'warning' | 'error';
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Dialog/Modal configuration
 */
export interface DialogConfig {
  open: boolean;
  title: string;
  content?: React.ReactNode;
  actions?: {
    label: string;
    onClick: () => void;
    variant?: 'text' | 'outlined' | 'contained';
    color?: 'primary' | 'secondary' | 'error';
  }[];
  onClose?: () => void;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

/**
 * Tab configuration for clinical workspace
 */
export interface TabConfig {
  id: string;
  label: string;
  icon?: React.ReactNode;
  component: React.ComponentType;
  badge?: number;
  disabled?: boolean;
}
