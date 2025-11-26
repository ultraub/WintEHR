/**
 * FHIR Query Hooks Module
 *
 * Provides React Query hooks for FHIR resource operations with optimized
 * caching, loading states, and cache invalidation.
 *
 * @module hooks/queries
 *
 * @example
 * // Import individual hooks
 * import { usePatient, useConditions, useCreateMedication } from '@/hooks/queries';
 *
 * // Use query hooks for reading data
 * const { data: patient, isLoading } = usePatient(patientId);
 * const { data: conditions } = useConditions(patientId);
 *
 * // Use mutation hooks for modifying data
 * const { mutate: createMedication } = useCreateMedication();
 * createMedication(medicationData);
 */

// Query hooks for reading data
export {
  // Generic hooks
  useFHIRResource,
  useFHIRSearch,
  // Patient hooks
  usePatient,
  usePatientSearch,
  usePatientEverything,
  // Condition hooks
  useConditions,
  useCondition,
  // Medication hooks
  useMedications,
  useMedicationHistory,
  useMedication,
  // Allergy hooks
  useAllergies,
  useAllergy,
  // Observation hooks
  useObservations,
  useVitalSigns,
  useLabResults,
  useObservation,
  // Encounter hooks
  useEncounters,
  useCurrentEncounter,
  useEncounter,
  // Order hooks
  useOrders,
  useOrder,
  // Procedure hooks
  useProcedures,
  // Diagnostic Report hooks
  useDiagnosticReports,
  useDiagnosticReport,
  // Immunization hooks
  useImmunizations,
  // Care Plan hooks
  useCarePlans,
  // Coverage hooks
  useCoverage,
  // Document hooks
  useDocuments,
  // Practitioner hooks
  usePractitioner,
  usePractitionerSearch,
  // Composite hooks
  usePatientClinicalData,
  // Infinite query hooks
  useObservationsInfinite,
} from './useFHIRQueries';

// Mutation hooks for modifying data
export {
  // Generic mutations
  useCreateResource,
  useUpdateResource,
  useDeleteResource,
  // Condition mutations
  useCreateCondition,
  useUpdateCondition,
  useDeleteCondition,
  // Medication mutations
  useCreateMedication,
  useUpdateMedication,
  useDiscontinueMedication,
  useDeleteMedication,
  // Allergy mutations
  useCreateAllergy,
  useUpdateAllergy,
  useDeleteAllergy,
  // Observation mutations
  useCreateObservation,
  useUpdateObservation,
  // Order mutations
  useCreateOrder,
  useUpdateOrder,
  useCancelOrder,
  // Encounter mutations
  useCreateEncounter,
  useUpdateEncounter,
  useEndEncounter,
  // Document mutations
  useCreateDocument,
  // Care Plan mutations
  useCreateCarePlan,
  useUpdateCarePlan,
  // Batch mutations
  useBatchMutation,
} from './useFHIRMutations';

// Re-export query client utilities
export {
  queryClient,
  queryKeys,
  STALE_TIMES,
  CACHE_TIMES,
  invalidatePatientData,
  prefetchPatientData,
  clearAllCaches,
} from '../../lib/queryClient';
