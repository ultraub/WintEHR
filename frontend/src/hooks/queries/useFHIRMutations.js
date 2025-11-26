/**
 * FHIR Resource Mutation Hooks
 *
 * React Query mutation hooks for creating, updating, and deleting
 * FHIR resources with optimistic updates and cache invalidation.
 *
 * @module hooks/queries/useFHIRMutations
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fhirClient } from '../../core/fhir/services/fhirClient';
import { queryKeys, invalidatePatientData } from '../../lib/queryClient';

// ============================================================================
// Generic FHIR Mutation Hooks
// ============================================================================

/**
 * Generic hook for creating a FHIR resource
 *
 * @param {string} resourceType - FHIR resource type
 * @param {Object} options - Mutation options
 * @returns {Object} Mutation result with mutate function
 *
 * @example
 * const { mutate: createCondition, isLoading } = useCreateResource('Condition');
 * createCondition({ resourceType: 'Condition', ... });
 */
export function useCreateResource(resourceType, options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (resource) => fhirClient.create(resourceType, resource),
    onSuccess: (data, variables) => {
      // Extract patient ID from the resource for cache invalidation
      const patientId = extractPatientId(data);
      if (patientId) {
        // Invalidate related patient queries
        queryClient.invalidateQueries({
          queryKey: [resourceType.toLowerCase(), 'patient', patientId],
        });
      }
      // Invalidate list queries for this resource type
      queryClient.invalidateQueries({
        queryKey: [resourceType.toLowerCase(), 'list'],
      });
    },
    ...options,
  });
}

/**
 * Generic hook for updating a FHIR resource
 *
 * @param {string} resourceType - FHIR resource type
 * @param {Object} options - Mutation options
 * @returns {Object} Mutation result with mutate function
 *
 * @example
 * const { mutate: updateCondition } = useUpdateResource('Condition');
 * updateCondition({ id: 'cond-123', resource: updatedCondition });
 */
export function useUpdateResource(resourceType, options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, resource }) => fhirClient.update(resourceType, id, resource),
    onSuccess: (data, variables) => {
      const patientId = extractPatientId(data);

      // Update the cache with the new data
      queryClient.setQueryData(
        [resourceType.toLowerCase(), 'detail', variables.id],
        data
      );

      if (patientId) {
        // Invalidate related patient queries
        queryClient.invalidateQueries({
          queryKey: [resourceType.toLowerCase(), 'patient', patientId],
        });
      }
    },
    ...options,
  });
}

/**
 * Generic hook for deleting a FHIR resource
 *
 * @param {string} resourceType - FHIR resource type
 * @param {Object} options - Mutation options
 * @returns {Object} Mutation result with mutate function
 *
 * @example
 * const { mutate: deleteCondition } = useDeleteResource('Condition');
 * deleteCondition({ id: 'cond-123', patientId: 'patient-456' });
 */
export function useDeleteResource(resourceType, options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id }) => fhirClient.delete(resourceType, id),
    onSuccess: (_, variables) => {
      // Remove from cache
      queryClient.removeQueries({
        queryKey: [resourceType.toLowerCase(), 'detail', variables.id],
      });

      // Invalidate list queries
      if (variables.patientId) {
        queryClient.invalidateQueries({
          queryKey: [resourceType.toLowerCase(), 'patient', variables.patientId],
        });
      }
      queryClient.invalidateQueries({
        queryKey: [resourceType.toLowerCase(), 'list'],
      });
    },
    ...options,
  });
}

// ============================================================================
// Condition Mutations
// ============================================================================

/**
 * Create a new condition/problem
 *
 * @param {Object} options - Mutation options
 */
export function useCreateCondition(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (condition) => fhirClient.create('Condition', condition),
    onSuccess: (data) => {
      const patientId = extractPatientId(data);
      if (patientId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.conditions.byPatient(patientId),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.patientSummary.detail(patientId),
        });
      }
    },
    ...options,
  });
}

/**
 * Update an existing condition
 *
 * @param {Object} options - Mutation options
 */
export function useUpdateCondition(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, condition }) => fhirClient.update('Condition', id, condition),
    onMutate: async ({ id, condition }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.conditions.details(),
      });

      // Snapshot previous value
      const previousCondition = queryClient.getQueryData(
        queryKeys.conditions.detail(id)
      );

      // Optimistically update
      queryClient.setQueryData(queryKeys.conditions.detail(id), condition);

      return { previousCondition };
    },
    onError: (err, { id }, context) => {
      // Rollback on error
      if (context?.previousCondition) {
        queryClient.setQueryData(
          queryKeys.conditions.detail(id),
          context.previousCondition
        );
      }
    },
    onSuccess: (data) => {
      const patientId = extractPatientId(data);
      if (patientId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.conditions.byPatient(patientId),
        });
      }
    },
    ...options,
  });
}

/**
 * Delete a condition
 *
 * @param {Object} options - Mutation options
 */
export function useDeleteCondition(options = {}) {
  return useDeleteResource('Condition', options);
}

// ============================================================================
// Medication Mutations
// ============================================================================

/**
 * Create a new medication request (prescription)
 *
 * @param {Object} options - Mutation options
 */
export function useCreateMedication(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (medication) => fhirClient.create('MedicationRequest', medication),
    onSuccess: (data) => {
      const patientId = extractPatientId(data);
      if (patientId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.medications.byPatient(patientId),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.patientSummary.detail(patientId),
        });
      }
    },
    ...options,
  });
}

/**
 * Update a medication request
 *
 * @param {Object} options - Mutation options
 */
export function useUpdateMedication(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, medication }) =>
      fhirClient.update('MedicationRequest', id, medication),
    onSuccess: (data, variables) => {
      // Update cache
      queryClient.setQueryData(
        queryKeys.medications.detail(variables.id),
        data
      );

      const patientId = extractPatientId(data);
      if (patientId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.medications.byPatient(patientId),
        });
      }
    },
    ...options,
  });
}

/**
 * Discontinue a medication (update status to stopped)
 *
 * @param {Object} options - Mutation options
 */
export function useDiscontinueMedication(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, reason }) => {
      const medication = await fhirClient.read('MedicationRequest', id);
      return fhirClient.update('MedicationRequest', id, {
        ...medication,
        status: 'stopped',
        statusReason: reason
          ? { coding: [{ display: reason }] }
          : undefined,
      });
    },
    onSuccess: (data) => {
      const patientId = extractPatientId(data);
      if (patientId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.medications.byPatient(patientId),
        });
      }
    },
    ...options,
  });
}

/**
 * Delete a medication request
 *
 * @param {Object} options - Mutation options
 */
export function useDeleteMedication(options = {}) {
  return useDeleteResource('MedicationRequest', options);
}

// ============================================================================
// Allergy Mutations
// ============================================================================

/**
 * Create a new allergy
 *
 * @param {Object} options - Mutation options
 */
export function useCreateAllergy(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (allergy) => fhirClient.create('AllergyIntolerance', allergy),
    onSuccess: (data) => {
      const patientId = extractPatientId(data);
      if (patientId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.allergies.byPatient(patientId),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.patientSummary.detail(patientId),
        });
      }
    },
    ...options,
  });
}

/**
 * Update an allergy
 *
 * @param {Object} options - Mutation options
 */
export function useUpdateAllergy(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, allergy }) =>
      fhirClient.update('AllergyIntolerance', id, allergy),
    onSuccess: (data) => {
      const patientId = extractPatientId(data);
      if (patientId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.allergies.byPatient(patientId),
        });
      }
    },
    ...options,
  });
}

/**
 * Delete an allergy
 *
 * @param {Object} options - Mutation options
 */
export function useDeleteAllergy(options = {}) {
  return useDeleteResource('AllergyIntolerance', options);
}

// ============================================================================
// Observation Mutations
// ============================================================================

/**
 * Create a new observation (vital sign, lab result)
 *
 * @param {Object} options - Mutation options
 */
export function useCreateObservation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (observation) => fhirClient.create('Observation', observation),
    onSuccess: (data) => {
      const patientId = extractPatientId(data);
      if (patientId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.observations.byPatient(patientId),
        });
      }
    },
    ...options,
  });
}

/**
 * Update an observation
 *
 * @param {Object} options - Mutation options
 */
export function useUpdateObservation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, observation }) =>
      fhirClient.update('Observation', id, observation),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(
        queryKeys.observations.detail(variables.id),
        data
      );

      const patientId = extractPatientId(data);
      if (patientId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.observations.byPatient(patientId),
        });
      }
    },
    ...options,
  });
}

// ============================================================================
// Order/ServiceRequest Mutations
// ============================================================================

/**
 * Create a new order (ServiceRequest)
 *
 * @param {Object} options - Mutation options
 */
export function useCreateOrder(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (order) => fhirClient.create('ServiceRequest', order),
    onSuccess: (data) => {
      const patientId = extractPatientId(data);
      if (patientId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.orders.byPatient(patientId),
        });
      }
    },
    ...options,
  });
}

/**
 * Update an order
 *
 * @param {Object} options - Mutation options
 */
export function useUpdateOrder(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, order }) =>
      fhirClient.update('ServiceRequest', id, order),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(queryKeys.orders.detail(variables.id), data);

      const patientId = extractPatientId(data);
      if (patientId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.orders.byPatient(patientId),
        });
      }
    },
    ...options,
  });
}

/**
 * Cancel an order
 *
 * @param {Object} options - Mutation options
 */
export function useCancelOrder(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, reason }) => {
      const order = await fhirClient.read('ServiceRequest', id);
      return fhirClient.update('ServiceRequest', id, {
        ...order,
        status: 'revoked',
        reasonCode: reason
          ? [{ coding: [{ display: reason }] }]
          : undefined,
      });
    },
    onSuccess: (data) => {
      const patientId = extractPatientId(data);
      if (patientId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.orders.byPatient(patientId),
        });
      }
    },
    ...options,
  });
}

// ============================================================================
// Encounter Mutations
// ============================================================================

/**
 * Create a new encounter
 *
 * @param {Object} options - Mutation options
 */
export function useCreateEncounter(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (encounter) => fhirClient.create('Encounter', encounter),
    onSuccess: (data) => {
      const patientId = extractPatientId(data);
      if (patientId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.encounters.byPatient(patientId),
        });
      }
    },
    ...options,
  });
}

/**
 * Update an encounter
 *
 * @param {Object} options - Mutation options
 */
export function useUpdateEncounter(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, encounter }) =>
      fhirClient.update('Encounter', id, encounter),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(queryKeys.encounters.detail(variables.id), data);

      const patientId = extractPatientId(data);
      if (patientId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.encounters.byPatient(patientId),
        });
      }
    },
    ...options,
  });
}

/**
 * End/discharge an encounter
 *
 * @param {Object} options - Mutation options
 */
export function useEndEncounter(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, endDateTime }) => {
      const encounter = await fhirClient.read('Encounter', id);
      return fhirClient.update('Encounter', id, {
        ...encounter,
        status: 'finished',
        period: {
          ...encounter.period,
          end: endDateTime || new Date().toISOString(),
        },
      });
    },
    onSuccess: (data) => {
      const patientId = extractPatientId(data);
      if (patientId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.encounters.byPatient(patientId),
        });
      }
    },
    ...options,
  });
}

// ============================================================================
// Document Reference Mutations
// ============================================================================

/**
 * Create a new document reference
 *
 * @param {Object} options - Mutation options
 */
export function useCreateDocument(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (document) => fhirClient.create('DocumentReference', document),
    onSuccess: (data) => {
      const patientId = extractPatientId(data);
      if (patientId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.documents.byPatient(patientId),
        });
      }
    },
    ...options,
  });
}

// ============================================================================
// Care Plan Mutations
// ============================================================================

/**
 * Create a new care plan
 *
 * @param {Object} options - Mutation options
 */
export function useCreateCarePlan(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (carePlan) => fhirClient.create('CarePlan', carePlan),
    onSuccess: (data) => {
      const patientId = extractPatientId(data);
      if (patientId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.carePlans.byPatient(patientId),
        });
      }
    },
    ...options,
  });
}

/**
 * Update a care plan
 *
 * @param {Object} options - Mutation options
 */
export function useUpdateCarePlan(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, carePlan }) =>
      fhirClient.update('CarePlan', id, carePlan),
    onSuccess: (data) => {
      const patientId = extractPatientId(data);
      if (patientId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.carePlans.byPatient(patientId),
        });
      }
    },
    ...options,
  });
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Execute multiple mutations as a batch
 *
 * @param {Object} options - Mutation options
 */
export function useBatchMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (operations) => {
      const results = await Promise.all(
        operations.map(async (op) => {
          switch (op.type) {
            case 'create':
              return fhirClient.create(op.resourceType, op.resource);
            case 'update':
              return fhirClient.update(op.resourceType, op.id, op.resource);
            case 'delete':
              return fhirClient.delete(op.resourceType, op.id);
            default:
              throw new Error(`Unknown operation type: ${op.type}`);
          }
        })
      );
      return results;
    },
    onSuccess: (_, variables) => {
      // Collect all affected patient IDs
      const patientIds = new Set();
      variables.forEach((op) => {
        const patientId = extractPatientId(op.resource);
        if (patientId) patientIds.add(patientId);
      });

      // Invalidate all affected patients
      patientIds.forEach((patientId) => {
        invalidatePatientData(patientId);
      });
    },
    ...options,
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Extract patient ID from a FHIR resource
 *
 * @param {Object} resource - FHIR resource
 * @returns {string|null} Patient ID or null
 */
function extractPatientId(resource) {
  if (!resource) return null;

  // Direct patient reference
  if (resource.subject?.reference) {
    const match = resource.subject.reference.match(/Patient\/(.+)/);
    if (match) return match[1];
  }

  // Patient reference in different fields
  if (resource.patient?.reference) {
    const match = resource.patient.reference.match(/Patient\/(.+)/);
    if (match) return match[1];
  }

  // For Patient resource itself
  if (resource.resourceType === 'Patient' && resource.id) {
    return resource.id;
  }

  return null;
}

// ============================================================================
// Exports
// ============================================================================

export default {
  // Generic
  useCreateResource,
  useUpdateResource,
  useDeleteResource,
  // Condition
  useCreateCondition,
  useUpdateCondition,
  useDeleteCondition,
  // Medication
  useCreateMedication,
  useUpdateMedication,
  useDiscontinueMedication,
  useDeleteMedication,
  // Allergy
  useCreateAllergy,
  useUpdateAllergy,
  useDeleteAllergy,
  // Observation
  useCreateObservation,
  useUpdateObservation,
  // Order
  useCreateOrder,
  useUpdateOrder,
  useCancelOrder,
  // Encounter
  useCreateEncounter,
  useUpdateEncounter,
  useEndEncounter,
  // Document
  useCreateDocument,
  // CarePlan
  useCreateCarePlan,
  useUpdateCarePlan,
  // Batch
  useBatchMutation,
};
