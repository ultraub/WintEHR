/**
 * React Query Configuration
 *
 * Centralized configuration for TanStack Query (React Query) with
 * healthcare-optimized defaults for caching and data freshness.
 *
 * @module lib/queryClient
 */

import { QueryClient } from '@tanstack/react-query';

/**
 * Default stale times for different data types (in milliseconds)
 * Healthcare data requires careful balance between freshness and performance
 */
export const STALE_TIMES = {
  // Static reference data - rarely changes
  STATIC: 24 * 60 * 60 * 1000,     // 24 hours

  // Semi-static data like demographics, providers
  DEMOGRAPHICS: 2 * 60 * 60 * 1000, // 2 hours

  // Clinical context data (conditions, medications lists)
  CLINICAL: 5 * 60 * 1000,          // 5 minutes

  // Real-time clinical data (vitals, labs, orders)
  REALTIME: 30 * 1000,              // 30 seconds

  // Critical data that should always be fresh
  CRITICAL: 0,                       // Always stale (refetch on every access)
};

/**
 * Cache times (garbage collection) for different data types
 */
export const CACHE_TIMES = {
  STATIC: 24 * 60 * 60 * 1000,      // 24 hours
  DEMOGRAPHICS: 4 * 60 * 60 * 1000, // 4 hours
  CLINICAL: 30 * 60 * 1000,         // 30 minutes
  REALTIME: 5 * 60 * 1000,          // 5 minutes
  CRITICAL: 60 * 1000,              // 1 minute
};

/**
 * Query key factory for consistent cache key management
 * Use these factories to ensure cache invalidation works correctly
 *
 * @example
 * // Get all patients
 * queryKeys.patients.all
 *
 * // Get specific patient
 * queryKeys.patients.detail(patientId)
 *
 * // Get patient's conditions
 * queryKeys.conditions.list({ patientId })
 */
export const queryKeys = {
  // Patient queries
  patients: {
    all: ['patients'],
    lists: () => [...queryKeys.patients.all, 'list'],
    list: (filters) => [...queryKeys.patients.lists(), filters],
    details: () => [...queryKeys.patients.all, 'detail'],
    detail: (id) => [...queryKeys.patients.details(), id],
    search: (query) => [...queryKeys.patients.all, 'search', query],
  },

  // Condition/Problem queries
  conditions: {
    all: ['conditions'],
    lists: () => [...queryKeys.conditions.all, 'list'],
    list: (filters) => [...queryKeys.conditions.lists(), filters],
    details: () => [...queryKeys.conditions.all, 'detail'],
    detail: (id) => [...queryKeys.conditions.details(), id],
    byPatient: (patientId) => [...queryKeys.conditions.all, 'patient', patientId],
    active: (patientId) => [...queryKeys.conditions.byPatient(patientId), 'active'],
  },

  // Medication queries
  medications: {
    all: ['medications'],
    lists: () => [...queryKeys.medications.all, 'list'],
    list: (filters) => [...queryKeys.medications.lists(), filters],
    details: () => [...queryKeys.medications.all, 'detail'],
    detail: (id) => [...queryKeys.medications.details(), id],
    byPatient: (patientId) => [...queryKeys.medications.all, 'patient', patientId],
    active: (patientId) => [...queryKeys.medications.byPatient(patientId), 'active'],
    history: (patientId) => [...queryKeys.medications.byPatient(patientId), 'history'],
  },

  // Allergy queries
  allergies: {
    all: ['allergies'],
    lists: () => [...queryKeys.allergies.all, 'list'],
    list: (filters) => [...queryKeys.allergies.lists(), filters],
    byPatient: (patientId) => [...queryKeys.allergies.all, 'patient', patientId],
    active: (patientId) => [...queryKeys.allergies.byPatient(patientId), 'active'],
  },

  // Observation queries (vitals, labs)
  observations: {
    all: ['observations'],
    lists: () => [...queryKeys.observations.all, 'list'],
    list: (filters) => [...queryKeys.observations.lists(), filters],
    details: () => [...queryKeys.observations.all, 'detail'],
    detail: (id) => [...queryKeys.observations.details(), id],
    byPatient: (patientId) => [...queryKeys.observations.all, 'patient', patientId],
    vitals: (patientId) => [...queryKeys.observations.byPatient(patientId), 'vitals'],
    labs: (patientId) => [...queryKeys.observations.byPatient(patientId), 'labs'],
    recent: (patientId, category) => [...queryKeys.observations.byPatient(patientId), 'recent', category],
  },

  // Encounter queries
  encounters: {
    all: ['encounters'],
    lists: () => [...queryKeys.encounters.all, 'list'],
    list: (filters) => [...queryKeys.encounters.lists(), filters],
    details: () => [...queryKeys.encounters.all, 'detail'],
    detail: (id) => [...queryKeys.encounters.details(), id],
    byPatient: (patientId) => [...queryKeys.encounters.all, 'patient', patientId],
    current: (patientId) => [...queryKeys.encounters.byPatient(patientId), 'current'],
  },

  // ServiceRequest/Order queries
  orders: {
    all: ['orders'],
    lists: () => [...queryKeys.orders.all, 'list'],
    list: (filters) => [...queryKeys.orders.lists(), filters],
    details: () => [...queryKeys.orders.all, 'detail'],
    detail: (id) => [...queryKeys.orders.details(), id],
    byPatient: (patientId) => [...queryKeys.orders.all, 'patient', patientId],
    pending: (patientId) => [...queryKeys.orders.byPatient(patientId), 'pending'],
    completed: (patientId) => [...queryKeys.orders.byPatient(patientId), 'completed'],
  },

  // Procedure queries
  procedures: {
    all: ['procedures'],
    lists: () => [...queryKeys.procedures.all, 'list'],
    list: (filters) => [...queryKeys.procedures.lists(), filters],
    byPatient: (patientId) => [...queryKeys.procedures.all, 'patient', patientId],
  },

  // DiagnosticReport queries
  diagnosticReports: {
    all: ['diagnosticReports'],
    lists: () => [...queryKeys.diagnosticReports.all, 'list'],
    list: (filters) => [...queryKeys.diagnosticReports.lists(), filters],
    details: () => [...queryKeys.diagnosticReports.all, 'detail'],
    detail: (id) => [...queryKeys.diagnosticReports.details(), id],
    byPatient: (patientId) => [...queryKeys.diagnosticReports.all, 'patient', patientId],
  },

  // Immunization queries
  immunizations: {
    all: ['immunizations'],
    lists: () => [...queryKeys.immunizations.all, 'list'],
    byPatient: (patientId) => [...queryKeys.immunizations.all, 'patient', patientId],
  },

  // CarePlan queries
  carePlans: {
    all: ['carePlans'],
    lists: () => [...queryKeys.carePlans.all, 'list'],
    byPatient: (patientId) => [...queryKeys.carePlans.all, 'patient', patientId],
    active: (patientId) => [...queryKeys.carePlans.byPatient(patientId), 'active'],
  },

  // DocumentReference queries
  documents: {
    all: ['documents'],
    lists: () => [...queryKeys.documents.all, 'list'],
    list: (filters) => [...queryKeys.documents.lists(), filters],
    byPatient: (patientId) => [...queryKeys.documents.all, 'patient', patientId],
  },

  // Practitioner/Provider queries
  practitioners: {
    all: ['practitioners'],
    lists: () => [...queryKeys.practitioners.all, 'list'],
    list: (filters) => [...queryKeys.practitioners.lists(), filters],
    details: () => [...queryKeys.practitioners.all, 'detail'],
    detail: (id) => [...queryKeys.practitioners.details(), id],
    search: (query) => [...queryKeys.practitioners.all, 'search', query],
  },

  // Organization queries
  organizations: {
    all: ['organizations'],
    lists: () => [...queryKeys.organizations.all, 'list'],
    details: () => [...queryKeys.organizations.all, 'detail'],
    detail: (id) => [...queryKeys.organizations.details(), id],
  },

  // CDS Hooks queries
  cds: {
    all: ['cds'],
    services: () => [...queryKeys.cds.all, 'services'],
    cards: (hookContext) => [...queryKeys.cds.all, 'cards', hookContext],
    catalogs: () => [...queryKeys.cds.all, 'catalogs'],
    catalog: (type) => [...queryKeys.cds.catalogs(), type],
  },

  // Patient bundle/summary queries
  patientSummary: {
    all: ['patientSummary'],
    detail: (patientId) => [...queryKeys.patientSummary.all, patientId],
    everything: (patientId) => [...queryKeys.patientSummary.detail(patientId), 'everything'],
    timeline: (patientId) => [...queryKeys.patientSummary.detail(patientId), 'timeline'],
  },
};

/**
 * Default query options for the QueryClient
 */
const defaultQueryOptions = {
  queries: {
    // Default stale time - 5 minutes for general clinical data
    staleTime: STALE_TIMES.CLINICAL,

    // Cache time - 30 minutes before garbage collection
    gcTime: CACHE_TIMES.CLINICAL,

    // Retry failed queries up to 3 times with exponential backoff
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

    // Don't refetch on window focus by default (can be overridden per query)
    refetchOnWindowFocus: false,

    // Don't refetch on reconnect by default
    refetchOnReconnect: false,

    // Keep previous data while fetching new data
    placeholderData: (previousData) => previousData,
  },
  mutations: {
    // Retry mutations once on network errors
    retry: 1,
    retryDelay: 1000,
  },
};

/**
 * Create a new QueryClient instance with healthcare-optimized defaults
 * @returns {QueryClient} Configured QueryClient instance
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: defaultQueryOptions,
  });
}

/**
 * Singleton QueryClient instance for the application
 */
export const queryClient = createQueryClient();

/**
 * Invalidate all queries related to a specific patient
 * Useful after patient data modifications
 *
 * @param {string} patientId - The patient ID to invalidate
 */
export function invalidatePatientData(patientId) {
  // Invalidate all patient-related queries
  queryClient.invalidateQueries({ queryKey: queryKeys.patients.detail(patientId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.conditions.byPatient(patientId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.medications.byPatient(patientId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.allergies.byPatient(patientId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.observations.byPatient(patientId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.encounters.byPatient(patientId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.orders.byPatient(patientId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.procedures.byPatient(patientId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.diagnosticReports.byPatient(patientId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.immunizations.byPatient(patientId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.carePlans.byPatient(patientId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.documents.byPatient(patientId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.patientSummary.detail(patientId) });
}

/**
 * Prefetch patient data for faster loading
 *
 * @param {string} patientId - The patient ID to prefetch
 * @param {Function} fetchFn - Function to fetch patient data
 */
export async function prefetchPatientData(patientId, fetchFn) {
  await queryClient.prefetchQuery({
    queryKey: queryKeys.patients.detail(patientId),
    queryFn: fetchFn,
    staleTime: STALE_TIMES.DEMOGRAPHICS,
  });
}

/**
 * Clear all cached data
 * Useful on logout or session end
 */
export function clearAllCaches() {
  queryClient.clear();
}

export default queryClient;
