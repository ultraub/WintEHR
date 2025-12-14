/**
 * API Type Definitions for WintEHR
 *
 * Types for API requests, responses, and error handling.
 */

import type { FHIRResource, Bundle, OperationOutcome } from './fhir';

// =============================================================================
// API Response Types
// =============================================================================

/**
 * Standard API success response
 */
export interface ApiResponse<T = unknown> {
  success: true;
  data: T;
  meta?: ApiResponseMeta;
}

/**
 * Standard API error response
 */
export interface ApiErrorResponse {
  success: false;
  error: ApiError;
}

/**
 * API response metadata
 */
export interface ApiResponseMeta {
  timestamp: string;
  requestId?: string;
  version?: string;
  pagination?: PaginationMeta;
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

/**
 * API error details
 */
export interface ApiError {
  code: string;
  message: string;
  status: number;
  details?: Record<string, unknown>;
  validationErrors?: ValidationError[];
  requestId?: string;
  stackTrace?: string;
}

/**
 * Validation error for individual fields
 */
export interface ValidationError {
  field: string;
  message: string;
  type: string;
}

// =============================================================================
// Authentication Types
// =============================================================================

/**
 * Login request
 */
export interface LoginRequest {
  username: string;
  password: string;
  rememberMe?: boolean;
}

/**
 * Login response
 */
export interface LoginResponse {
  token: string;
  refreshToken?: string;
  expiresIn: number;
  user: AuthUser;
}

/**
 * Authenticated user
 */
export interface AuthUser {
  id: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  permissions: string[];
  practitionerId?: string;
  organizationId?: string;
}

/**
 * User roles
 */
export type UserRole =
  | 'admin'
  | 'physician'
  | 'nurse'
  | 'pharmacist'
  | 'technician'
  | 'receptionist'
  | 'patient'
  | 'demo';

/**
 * Token refresh request
 */
export interface TokenRefreshRequest {
  refreshToken: string;
}

/**
 * Token refresh response
 */
export interface TokenRefreshResponse {
  token: string;
  expiresIn: number;
}

// =============================================================================
// FHIR API Types
// =============================================================================

/**
 * FHIR search request
 */
export interface FHIRSearchRequest {
  resourceType: string;
  params?: Record<string, string | string[] | number | boolean>;
  headers?: Record<string, string>;
}

/**
 * FHIR search response
 */
export interface FHIRSearchResponse<T extends FHIRResource = FHIRResource> {
  bundle: Bundle<T>;
  resources: T[];
  total: number;
  link?: {
    self?: string;
    next?: string;
    previous?: string;
    first?: string;
    last?: string;
  };
}

/**
 * FHIR create request
 */
export interface FHIRCreateRequest<T extends FHIRResource = FHIRResource> {
  resourceType: string;
  resource: T;
  headers?: Record<string, string>;
}

/**
 * FHIR create response
 */
export interface FHIRCreateResponse<T extends FHIRResource = FHIRResource> {
  resource: T;
  id: string;
  versionId: string;
  lastUpdated: string;
}

/**
 * FHIR update request
 */
export interface FHIRUpdateRequest<T extends FHIRResource = FHIRResource> {
  resourceType: string;
  id: string;
  resource: T;
  ifMatch?: string;
  headers?: Record<string, string>;
}

/**
 * FHIR update response
 */
export interface FHIRUpdateResponse<T extends FHIRResource = FHIRResource> {
  resource: T;
  versionId: string;
  lastUpdated: string;
}

/**
 * FHIR delete request
 */
export interface FHIRDeleteRequest {
  resourceType: string;
  id: string;
  headers?: Record<string, string>;
}

/**
 * FHIR delete response
 */
export interface FHIRDeleteResponse {
  success: boolean;
  outcome?: OperationOutcome;
}

/**
 * FHIR operation request
 */
export interface FHIROperationRequest {
  operation: string;
  resourceType?: string;
  id?: string;
  parameters?: Record<string, unknown>;
  headers?: Record<string, string>;
}

/**
 * FHIR operation response
 */
export interface FHIROperationResponse<T = unknown> {
  result: T;
  outcome?: OperationOutcome;
}

// =============================================================================
// Clinical Data API Types
// =============================================================================

/**
 * Patient search request
 */
export interface PatientSearchRequest {
  name?: string;
  identifier?: string;
  birthDate?: string;
  gender?: string;
  phone?: string;
  email?: string;
  address?: string;
  _count?: number;
  _offset?: number;
}

/**
 * Clinical catalog request
 */
export interface CatalogSearchRequest {
  catalogType: 'medication' | 'lab' | 'imaging' | 'procedure' | 'diagnosis';
  search?: string;
  category?: string;
  _count?: number;
}

/**
 * Clinical catalog response
 */
export interface CatalogSearchResponse {
  items: CatalogItem[];
  total: number;
  categories?: string[];
}

/**
 * Catalog item
 */
export interface CatalogItem {
  id: string;
  code: string;
  display: string;
  system?: string;
  category?: string;
  synonyms?: string[];
  metadata?: Record<string, unknown>;
}

// =============================================================================
// CDS Hooks API Types
// =============================================================================

/**
 * CDS Hooks discovery response
 */
export interface CDSDiscoveryResponse {
  services: CDSService[];
}

/**
 * CDS Service definition
 */
export interface CDSService {
  id: string;
  hook: string;
  title: string;
  description: string;
  prefetch?: Record<string, string>;
  usageRequirements?: string;
}

/**
 * CDS Hooks request
 */
export interface CDSHookRequest {
  hookInstance: string;
  hook: string;
  fhirServer: string;
  fhirAuthorization?: {
    access_token: string;
    token_type: string;
    expires_in: number;
    scope: string;
    subject: string;
  };
  context: Record<string, unknown>;
  prefetch?: Record<string, FHIRResource | Bundle>;
}

/**
 * CDS Hooks response
 */
export interface CDSHookResponse {
  cards: CDSCard[];
  systemActions?: CDSAction[];
}

/**
 * CDS Card
 */
export interface CDSCard {
  uuid?: string;
  summary: string;
  detail?: string;
  indicator: 'info' | 'warning' | 'critical';
  source: {
    label: string;
    url?: string;
    icon?: string;
  };
  suggestions?: CDSSuggestion[];
  selectionBehavior?: 'at-most-one';
  overrideReasons?: CDSOverrideReason[];
  links?: CDSLink[];
}

/**
 * CDS Suggestion
 */
export interface CDSSuggestion {
  label: string;
  uuid?: string;
  isRecommended?: boolean;
  actions?: CDSAction[];
}

/**
 * CDS Action
 */
export interface CDSAction {
  type: 'create' | 'update' | 'delete';
  description: string;
  resource?: FHIRResource;
  resourceId?: string;
}

/**
 * CDS Override Reason
 */
export interface CDSOverrideReason {
  code: string;
  system?: string;
  display: string;
}

/**
 * CDS Link
 */
export interface CDSLink {
  label: string;
  url: string;
  type: 'absolute' | 'smart';
  appContext?: string;
}

/**
 * CDS Feedback request
 */
export interface CDSFeedbackRequest {
  card: string;
  outcome: 'accepted' | 'overridden';
  acceptedSuggestions?: string[];
  overrideReason?: CDSOverrideReason;
  outcomeTimestamp: string;
}

// =============================================================================
// WebSocket Types
// =============================================================================

/**
 * WebSocket connection config
 */
export interface WebSocketConfig {
  url: string;
  token?: string;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
}

/**
 * WebSocket message
 */
export interface WebSocketMessage<T = unknown> {
  type: string;
  timestamp: string;
  payload: T;
}

/**
 * WebSocket clinical event
 */
export interface WebSocketClinicalEvent {
  eventType: string;
  patientId?: string;
  resourceType?: string;
  resourceId?: string;
  userId?: string;
  data: Record<string, unknown>;
}

// =============================================================================
// Analytics API Types
// =============================================================================

/**
 * Analytics query request
 */
export interface AnalyticsQueryRequest {
  metric: string;
  dimensions?: string[];
  filters?: AnalyticsFilter[];
  dateRange?: {
    start: string;
    end: string;
  };
  granularity?: 'hour' | 'day' | 'week' | 'month' | 'year';
  limit?: number;
}

/**
 * Analytics filter
 */
export interface AnalyticsFilter {
  dimension: string;
  operator: 'eq' | 'ne' | 'in' | 'not_in' | 'gt' | 'lt' | 'gte' | 'lte';
  value: string | number | string[] | number[];
}

/**
 * Analytics query response
 */
export interface AnalyticsQueryResponse {
  data: AnalyticsDataPoint[];
  metadata: {
    metric: string;
    dimensions: string[];
    dateRange: { start: string; end: string };
    total: number;
  };
}

/**
 * Analytics data point
 */
export interface AnalyticsDataPoint {
  timestamp?: string;
  dimensions: Record<string, string>;
  value: number;
}

// =============================================================================
// Audit API Types
// =============================================================================

/**
 * Audit event
 */
export interface AuditEvent {
  id: string;
  timestamp: string;
  eventType: AuditEventType;
  userId: string;
  userName?: string;
  resourceType?: string;
  resourceId?: string;
  action: string;
  outcome: 'success' | 'failure';
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Audit event types
 */
export type AuditEventType =
  | 'login'
  | 'logout'
  | 'resource_access'
  | 'resource_create'
  | 'resource_update'
  | 'resource_delete'
  | 'order_placed'
  | 'medication_dispensed'
  | 'alert_acknowledged'
  | 'note_signed'
  | 'system_config_change';

/**
 * Audit search request
 */
export interface AuditSearchRequest {
  eventType?: AuditEventType | AuditEventType[];
  userId?: string;
  resourceType?: string;
  resourceId?: string;
  outcome?: 'success' | 'failure';
  dateRange?: { start: string; end: string };
  _count?: number;
  _offset?: number;
}

// =============================================================================
// Health Check Types
// =============================================================================

/**
 * Health check response
 */
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  services: ServiceHealth[];
}

/**
 * Service health status
 */
export interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency?: number;
  message?: string;
  lastChecked: string;
}

// =============================================================================
// HTTP Client Types
// =============================================================================

/**
 * HTTP request config
 */
export interface HttpRequestConfig {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean>;
  body?: unknown;
  timeout?: number;
  signal?: AbortSignal;
}

/**
 * HTTP response
 */
export interface HttpResponse<T = unknown> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
}

/**
 * HTTP error
 */
export interface HttpError extends Error {
  status?: number;
  statusText?: string;
  response?: unknown;
  isNetworkError?: boolean;
  isTimeout?: boolean;
}
