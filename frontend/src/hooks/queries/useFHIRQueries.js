/**
 * FHIR Resource Query Hooks
 *
 * React Query hooks for fetching FHIR resources with optimized caching,
 * error handling, and loading states.
 *
 * These hooks wrap the fhirClient with React Query's powerful caching
 * and state management capabilities.
 *
 * @module hooks/queries/useFHIRQueries
 */

import { useQuery, useQueries, useInfiniteQuery } from '@tanstack/react-query';
import { fhirClient } from '../../core/fhir/services/fhirClient';
import { queryKeys, STALE_TIMES, CACHE_TIMES } from '../../lib/queryClient';

// ============================================================================
// Generic FHIR Resource Hooks
// ============================================================================

/**
 * Generic hook for reading a single FHIR resource
 *
 * @param {string} resourceType - FHIR resource type (e.g., 'Patient', 'Condition')
 * @param {string} id - Resource ID
 * @param {Object} options - Additional query options
 * @returns {Object} Query result with data, loading, error states
 *
 * @example
 * const { data: patient, isLoading } = useFHIRResource('Patient', patientId);
 */
export function useFHIRResource(resourceType, id, options = {}) {
  return useQuery({
    queryKey: [resourceType.toLowerCase(), 'detail', id],
    queryFn: () => fhirClient.read(resourceType, id),
    enabled: !!id,
    staleTime: STALE_TIMES.CLINICAL,
    ...options,
  });
}

/**
 * Generic hook for searching FHIR resources
 *
 * @param {string} resourceType - FHIR resource type
 * @param {Object} searchParams - FHIR search parameters
 * @param {Object} options - Additional query options
 * @returns {Object} Query result with resources array
 *
 * @example
 * const { data } = useFHIRSearch('Condition', { patient: patientId, 'clinical-status': 'active' });
 */
export function useFHIRSearch(resourceType, searchParams = {}, options = {}) {
  const queryKey = [resourceType.toLowerCase(), 'list', searchParams];

  return useQuery({
    queryKey,
    queryFn: () => fhirClient.search(resourceType, searchParams),
    staleTime: STALE_TIMES.CLINICAL,
    ...options,
  });
}

// ============================================================================
// Patient Hooks
// ============================================================================

/**
 * Fetch a single patient by ID
 *
 * @param {string} patientId - Patient ID
 * @param {Object} options - Additional query options
 * @returns {Object} Query result with patient data
 */
export function usePatient(patientId, options = {}) {
  return useQuery({
    queryKey: queryKeys.patients.detail(patientId),
    queryFn: () => fhirClient.getPatient(patientId),
    enabled: !!patientId,
    staleTime: STALE_TIMES.DEMOGRAPHICS,
    gcTime: CACHE_TIMES.DEMOGRAPHICS,
    ...options,
  });
}

/**
 * Search patients with various criteria
 *
 * @param {Object} searchParams - Search parameters (name, birthdate, identifier, etc.)
 * @param {Object} options - Additional query options
 * @returns {Object} Query result with patient list
 */
export function usePatientSearch(searchParams, options = {}) {
  return useQuery({
    queryKey: queryKeys.patients.search(searchParams),
    queryFn: () => fhirClient.searchPatients(searchParams),
    enabled: Object.keys(searchParams || {}).length > 0,
    staleTime: STALE_TIMES.CLINICAL,
    ...options,
  });
}

/**
 * Fetch complete patient bundle ($everything operation)
 *
 * @param {string} patientId - Patient ID
 * @param {Object} options - Additional query options
 * @returns {Object} Query result with complete patient bundle
 */
export function usePatientEverything(patientId, options = {}) {
  return useQuery({
    queryKey: queryKeys.patientSummary.everything(patientId),
    queryFn: () => fhirClient.getPatientEverything(patientId),
    enabled: !!patientId,
    staleTime: STALE_TIMES.CLINICAL,
    gcTime: CACHE_TIMES.CLINICAL,
    ...options,
  });
}

// ============================================================================
// Condition/Problem Hooks
// ============================================================================

/**
 * Fetch patient conditions/problems
 *
 * @param {string} patientId - Patient ID
 * @param {Object} params - Query parameters
 * @param {string} [params.clinicalStatus='active'] - Clinical status filter
 * @param {number} [params.count=50] - Maximum number of results
 * @param {Object} options - Additional query options
 * @returns {Object} Query result with conditions
 */
export function useConditions(patientId, params = {}, options = {}) {
  const { clinicalStatus = 'active', count = 50 } = params;

  return useQuery({
    queryKey: clinicalStatus === 'active'
      ? queryKeys.conditions.active(patientId)
      : queryKeys.conditions.byPatient(patientId),
    queryFn: () => fhirClient.getConditions(patientId, clinicalStatus, count),
    enabled: !!patientId,
    staleTime: STALE_TIMES.CLINICAL,
    select: (data) => data?.resources || data || [],
    ...options,
  });
}

/**
 * Fetch a single condition by ID
 *
 * @param {string} conditionId - Condition ID
 * @param {Object} options - Additional query options
 */
export function useCondition(conditionId, options = {}) {
  return useFHIRResource('Condition', conditionId, options);
}

// ============================================================================
// Medication Hooks
// ============================================================================

/**
 * Fetch patient medications
 *
 * @param {string} patientId - Patient ID
 * @param {Object} params - Query parameters
 * @param {string} [params.status='active'] - Status filter
 * @param {number} [params.count=50] - Maximum number of results
 * @param {Object} options - Additional query options
 * @returns {Object} Query result with medications
 */
export function useMedications(patientId, params = {}, options = {}) {
  const { status = 'active', count = 50 } = params;

  return useQuery({
    queryKey: status === 'active'
      ? queryKeys.medications.active(patientId)
      : queryKeys.medications.byPatient(patientId),
    queryFn: () => fhirClient.getMedications(patientId, status, count),
    enabled: !!patientId,
    staleTime: STALE_TIMES.CLINICAL,
    select: (data) => data?.resources || data || [],
    ...options,
  });
}

/**
 * Fetch patient medication history (all statuses)
 *
 * @param {string} patientId - Patient ID
 * @param {Object} options - Additional query options
 */
export function useMedicationHistory(patientId, options = {}) {
  return useQuery({
    queryKey: queryKeys.medications.history(patientId),
    queryFn: () => fhirClient.getMedications(patientId, null, 200),
    enabled: !!patientId,
    staleTime: STALE_TIMES.CLINICAL,
    select: (data) => data?.resources || data || [],
    ...options,
  });
}

/**
 * Fetch a single medication request by ID
 *
 * @param {string} medicationId - MedicationRequest ID
 * @param {Object} options - Additional query options
 */
export function useMedication(medicationId, options = {}) {
  return useFHIRResource('MedicationRequest', medicationId, options);
}

// ============================================================================
// Allergy Hooks
// ============================================================================

/**
 * Fetch patient allergies
 *
 * @param {string} patientId - Patient ID
 * @param {Object} params - Query parameters
 * @param {number} [params.count=30] - Maximum number of results
 * @param {Object} options - Additional query options
 * @returns {Object} Query result with allergies
 */
export function useAllergies(patientId, params = {}, options = {}) {
  const { count = 30 } = params;

  return useQuery({
    queryKey: queryKeys.allergies.byPatient(patientId),
    queryFn: () => fhirClient.getAllergies(patientId, count),
    enabled: !!patientId,
    staleTime: STALE_TIMES.CLINICAL,
    select: (data) => data?.resources || data || [],
    ...options,
  });
}

/**
 * Fetch a single allergy by ID
 *
 * @param {string} allergyId - AllergyIntolerance ID
 * @param {Object} options - Additional query options
 */
export function useAllergy(allergyId, options = {}) {
  return useFHIRResource('AllergyIntolerance', allergyId, options);
}

// ============================================================================
// Observation Hooks (Labs, Vitals)
// ============================================================================

/**
 * Fetch patient observations (generic)
 *
 * @param {string} patientId - Patient ID
 * @param {Object} params - Query parameters
 * @param {string} [params.category] - Category filter (vital-signs, laboratory)
 * @param {number} [params.count=100] - Maximum number of results
 * @param {Object} options - Additional query options
 * @returns {Object} Query result with observations
 */
export function useObservations(patientId, params = {}, options = {}) {
  const { category, count = 100 } = params;

  return useQuery({
    queryKey: category
      ? queryKeys.observations.recent(patientId, category)
      : queryKeys.observations.byPatient(patientId),
    queryFn: () => fhirClient.getObservations(patientId, category, count),
    enabled: !!patientId,
    staleTime: STALE_TIMES.REALTIME,
    select: (data) => data?.resources || data || [],
    ...options,
  });
}

/**
 * Fetch patient vital signs
 *
 * @param {string} patientId - Patient ID
 * @param {Object} params - Query parameters
 * @param {number} [params.count=100] - Maximum number of results
 * @param {Object} options - Additional query options
 */
export function useVitalSigns(patientId, params = {}, options = {}) {
  const { count = 100 } = params;

  return useQuery({
    queryKey: queryKeys.observations.vitals(patientId),
    queryFn: () => fhirClient.getVitalSigns(patientId, count),
    enabled: !!patientId,
    staleTime: STALE_TIMES.REALTIME,
    select: (data) => data?.resources || data || [],
    ...options,
  });
}

/**
 * Fetch patient laboratory results
 *
 * @param {string} patientId - Patient ID
 * @param {Object} params - Query parameters
 * @param {number} [params.count=100] - Maximum number of results
 * @param {Object} options - Additional query options
 */
export function useLabResults(patientId, params = {}, options = {}) {
  const { count = 100 } = params;

  return useQuery({
    queryKey: queryKeys.observations.labs(patientId),
    queryFn: () => fhirClient.getLabResults(patientId, count),
    enabled: !!patientId,
    staleTime: STALE_TIMES.REALTIME,
    select: (data) => data?.resources || data || [],
    ...options,
  });
}

/**
 * Fetch a single observation by ID
 *
 * @param {string} observationId - Observation ID
 * @param {Object} options - Additional query options
 */
export function useObservation(observationId, options = {}) {
  return useFHIRResource('Observation', observationId, options);
}

// ============================================================================
// Encounter Hooks
// ============================================================================

/**
 * Fetch patient encounters
 *
 * @param {string} patientId - Patient ID
 * @param {Object} params - Query parameters
 * @param {string} [params.status] - Status filter
 * @param {number} [params.count=30] - Maximum number of results
 * @param {Object} options - Additional query options
 */
export function useEncounters(patientId, params = {}, options = {}) {
  const { status, count = 30 } = params;

  return useQuery({
    queryKey: queryKeys.encounters.byPatient(patientId),
    queryFn: () => fhirClient.getEncounters(patientId, status, count),
    enabled: !!patientId,
    staleTime: STALE_TIMES.CLINICAL,
    select: (data) => data?.resources || data || [],
    ...options,
  });
}

/**
 * Fetch current/active encounter for patient
 *
 * @param {string} patientId - Patient ID
 * @param {Object} options - Additional query options
 */
export function useCurrentEncounter(patientId, options = {}) {
  return useQuery({
    queryKey: queryKeys.encounters.current(patientId),
    queryFn: async () => {
      const result = await fhirClient.getEncounters(patientId, 'in-progress', 1);
      const resources = result?.resources || result || [];
      return resources[0] || null;
    },
    enabled: !!patientId,
    staleTime: STALE_TIMES.REALTIME,
    ...options,
  });
}

/**
 * Fetch a single encounter by ID
 *
 * @param {string} encounterId - Encounter ID
 * @param {Object} options - Additional query options
 */
export function useEncounter(encounterId, options = {}) {
  return useFHIRResource('Encounter', encounterId, options);
}

// ============================================================================
// Order/ServiceRequest Hooks
// ============================================================================

/**
 * Fetch patient orders (ServiceRequest)
 *
 * @param {string} patientId - Patient ID
 * @param {Object} params - Query parameters
 * @param {string} [params.status] - Status filter
 * @param {string} [params.category] - Category filter
 * @param {Object} options - Additional query options
 */
export function useOrders(patientId, params = {}, options = {}) {
  const { status, category, count = 50 } = params;

  const searchParams = {
    patient: `Patient/${patientId}`,
    _count: count,
    _sort: '-authored',
  };

  if (status) searchParams.status = status;
  if (category) searchParams.category = category;

  return useQuery({
    queryKey: status === 'active'
      ? queryKeys.orders.pending(patientId)
      : queryKeys.orders.byPatient(patientId),
    queryFn: () => fhirClient.search('ServiceRequest', searchParams),
    enabled: !!patientId,
    staleTime: STALE_TIMES.REALTIME,
    select: (data) => data?.resources || data || [],
    ...options,
  });
}

/**
 * Fetch a single order by ID
 *
 * @param {string} orderId - ServiceRequest ID
 * @param {Object} options - Additional query options
 */
export function useOrder(orderId, options = {}) {
  return useFHIRResource('ServiceRequest', orderId, options);
}

// ============================================================================
// Procedure Hooks
// ============================================================================

/**
 * Fetch patient procedures
 *
 * @param {string} patientId - Patient ID
 * @param {Object} params - Query parameters
 * @param {number} [params.count=50] - Maximum number of results
 * @param {Object} options - Additional query options
 */
export function useProcedures(patientId, params = {}, options = {}) {
  const { count = 50 } = params;

  return useQuery({
    queryKey: queryKeys.procedures.byPatient(patientId),
    queryFn: () => fhirClient.search('Procedure', {
      patient: `Patient/${patientId}`,
      _count: count,
      _sort: '-date',
    }),
    enabled: !!patientId,
    staleTime: STALE_TIMES.CLINICAL,
    select: (data) => data?.resources || data || [],
    ...options,
  });
}

// ============================================================================
// Diagnostic Report Hooks
// ============================================================================

/**
 * Fetch patient diagnostic reports
 *
 * @param {string} patientId - Patient ID
 * @param {Object} params - Query parameters
 * @param {string} [params.category] - Category filter
 * @param {number} [params.count=50] - Maximum number of results
 * @param {Object} options - Additional query options
 */
export function useDiagnosticReports(patientId, params = {}, options = {}) {
  const { category, count = 50 } = params;

  const searchParams = {
    patient: `Patient/${patientId}`,
    _count: count,
    _sort: '-date',
  };

  if (category) searchParams.category = category;

  return useQuery({
    queryKey: queryKeys.diagnosticReports.byPatient(patientId),
    queryFn: () => fhirClient.search('DiagnosticReport', searchParams),
    enabled: !!patientId,
    staleTime: STALE_TIMES.REALTIME,
    select: (data) => data?.resources || data || [],
    ...options,
  });
}

/**
 * Fetch a single diagnostic report by ID
 *
 * @param {string} reportId - DiagnosticReport ID
 * @param {Object} options - Additional query options
 */
export function useDiagnosticReport(reportId, options = {}) {
  return useFHIRResource('DiagnosticReport', reportId, options);
}

// ============================================================================
// Immunization Hooks
// ============================================================================

/**
 * Fetch patient immunizations
 *
 * @param {string} patientId - Patient ID
 * @param {Object} options - Additional query options
 */
export function useImmunizations(patientId, options = {}) {
  return useQuery({
    queryKey: queryKeys.immunizations.byPatient(patientId),
    queryFn: () => fhirClient.search('Immunization', {
      patient: `Patient/${patientId}`,
      _sort: '-date',
    }),
    enabled: !!patientId,
    staleTime: STALE_TIMES.CLINICAL,
    select: (data) => data?.resources || data || [],
    ...options,
  });
}

// ============================================================================
// Care Plan Hooks
// ============================================================================

/**
 * Fetch patient care plans
 *
 * @param {string} patientId - Patient ID
 * @param {Object} params - Query parameters
 * @param {string} [params.status='active'] - Status filter
 * @param {Object} options - Additional query options
 */
export function useCarePlans(patientId, params = {}, options = {}) {
  const { status = 'active' } = params;

  return useQuery({
    queryKey: status === 'active'
      ? queryKeys.carePlans.active(patientId)
      : queryKeys.carePlans.byPatient(patientId),
    queryFn: () => fhirClient.search('CarePlan', {
      patient: `Patient/${patientId}`,
      status: status,
    }),
    enabled: !!patientId,
    staleTime: STALE_TIMES.CLINICAL,
    select: (data) => data?.resources || data || [],
    ...options,
  });
}

// ============================================================================
// Coverage/Insurance Hooks
// ============================================================================

/**
 * Fetch patient coverage/insurance
 *
 * @param {string} patientId - Patient ID
 * @param {Object} options - Additional query options
 */
export function useCoverage(patientId, options = {}) {
  return useQuery({
    queryKey: ['coverage', 'patient', patientId],
    queryFn: () => fhirClient.getCoverage(patientId),
    enabled: !!patientId,
    staleTime: STALE_TIMES.DEMOGRAPHICS,
    select: (data) => data?.resources || data || [],
    ...options,
  });
}

// ============================================================================
// Document Reference Hooks
// ============================================================================

/**
 * Fetch patient documents
 *
 * @param {string} patientId - Patient ID
 * @param {Object} params - Query parameters
 * @param {string} [params.type] - Document type filter
 * @param {Object} options - Additional query options
 */
export function useDocuments(patientId, params = {}, options = {}) {
  const { type } = params;

  const searchParams = {
    patient: `Patient/${patientId}`,
    _sort: '-date',
  };

  if (type) searchParams.type = type;

  return useQuery({
    queryKey: queryKeys.documents.byPatient(patientId),
    queryFn: () => fhirClient.search('DocumentReference', searchParams),
    enabled: !!patientId,
    staleTime: STALE_TIMES.CLINICAL,
    select: (data) => data?.resources || data || [],
    ...options,
  });
}

// ============================================================================
// Practitioner/Provider Hooks
// ============================================================================

/**
 * Fetch practitioner by ID
 *
 * @param {string} practitionerId - Practitioner ID
 * @param {Object} options - Additional query options
 */
export function usePractitioner(practitionerId, options = {}) {
  return useQuery({
    queryKey: queryKeys.practitioners.detail(practitionerId),
    queryFn: () => fhirClient.read('Practitioner', practitionerId),
    enabled: !!practitionerId,
    staleTime: STALE_TIMES.STATIC,
    gcTime: CACHE_TIMES.STATIC,
    ...options,
  });
}

/**
 * Search practitioners
 *
 * @param {Object} searchParams - Search parameters
 * @param {Object} options - Additional query options
 */
export function usePractitionerSearch(searchParams, options = {}) {
  return useQuery({
    queryKey: queryKeys.practitioners.search(searchParams),
    queryFn: () => fhirClient.search('Practitioner', searchParams),
    enabled: Object.keys(searchParams || {}).length > 0,
    staleTime: STALE_TIMES.STATIC,
    select: (data) => data?.resources || data || [],
    ...options,
  });
}

// ============================================================================
// Composite/Batch Hooks
// ============================================================================

/**
 * Fetch multiple resources in parallel
 * Useful for loading patient dashboard data
 *
 * @param {string} patientId - Patient ID
 * @param {Object} options - Query options
 * @returns {Object} Combined query results
 */
export function usePatientClinicalData(patientId, options = {}) {
  const queries = useQueries({
    queries: [
      {
        queryKey: queryKeys.conditions.active(patientId),
        queryFn: () => fhirClient.getConditions(patientId, 'active', 50),
        enabled: !!patientId,
        staleTime: STALE_TIMES.CLINICAL,
        ...options,
      },
      {
        queryKey: queryKeys.medications.active(patientId),
        queryFn: () => fhirClient.getMedications(patientId, 'active', 50),
        enabled: !!patientId,
        staleTime: STALE_TIMES.CLINICAL,
        ...options,
      },
      {
        queryKey: queryKeys.allergies.byPatient(patientId),
        queryFn: () => fhirClient.getAllergies(patientId, 30),
        enabled: !!patientId,
        staleTime: STALE_TIMES.CLINICAL,
        ...options,
      },
      {
        queryKey: queryKeys.observations.vitals(patientId),
        queryFn: () => fhirClient.getVitalSigns(patientId, 20),
        enabled: !!patientId,
        staleTime: STALE_TIMES.REALTIME,
        ...options,
      },
    ],
  });

  const [conditions, medications, allergies, vitals] = queries;

  return {
    conditions: conditions.data?.resources || [],
    medications: medications.data?.resources || [],
    allergies: allergies.data?.resources || [],
    vitals: vitals.data?.resources || [],
    isLoading: queries.some((q) => q.isLoading),
    isError: queries.some((q) => q.isError),
    errors: queries.filter((q) => q.isError).map((q) => q.error),
    isFetching: queries.some((q) => q.isFetching),
  };
}

// ============================================================================
// Infinite Query Hooks (for pagination)
// ============================================================================

/**
 * Infinite query for observations with pagination
 *
 * @param {string} patientId - Patient ID
 * @param {Object} params - Query parameters
 * @param {Object} options - Additional query options
 */
export function useObservationsInfinite(patientId, params = {}, options = {}) {
  const { category, pageSize = 20 } = params;

  return useInfiniteQuery({
    queryKey: ['observations', 'infinite', patientId, params],
    queryFn: async ({ pageParam = 0 }) => {
      const searchParams = {
        patient: `Patient/${patientId}`,
        _count: pageSize,
        _offset: pageParam * pageSize,
        _sort: '-date',
      };
      if (category) searchParams.category = category;
      return fhirClient.search('Observation', searchParams);
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const resources = lastPage?.resources || [];
      return resources.length === pageSize ? allPages.length : undefined;
    },
    enabled: !!patientId,
    staleTime: STALE_TIMES.REALTIME,
    ...options,
  });
}

export default {
  useFHIRResource,
  useFHIRSearch,
  usePatient,
  usePatientSearch,
  usePatientEverything,
  useConditions,
  useCondition,
  useMedications,
  useMedicationHistory,
  useMedication,
  useAllergies,
  useAllergy,
  useObservations,
  useVitalSigns,
  useLabResults,
  useObservation,
  useEncounters,
  useCurrentEncounter,
  useEncounter,
  useOrders,
  useOrder,
  useProcedures,
  useDiagnosticReports,
  useDiagnosticReport,
  useImmunizations,
  useCarePlans,
  useCoverage,
  useDocuments,
  usePractitioner,
  usePractitionerSearch,
  usePatientClinicalData,
  useObservationsInfinite,
};
