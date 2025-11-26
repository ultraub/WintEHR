/**
 * useFHIRResourceComposite
 *
 * Composite hook that provides backward compatibility with the original
 * useFHIRResource API by combining all focused FHIR contexts.
 *
 * This allows gradual migration - existing code can continue using
 * useFHIRResource while new code can use the focused contexts directly.
 *
 * Migration path:
 * 1. Replace FHIRResourceProvider with FHIRCompositeProvider
 * 2. Gradually migrate components to use focused hooks:
 *    - useFHIRData for resource storage
 *    - useFHIROperations for API operations
 *    - useFHIRCache for caching
 *    - usePatient for patient context
 * 3. Remove useFHIRResourceComposite usage once migration is complete
 */

import React, { useMemo, useCallback } from 'react';
import { useFHIRCache } from './FHIRCacheContext';
import { useFHIRData } from './FHIRDataContext';
import { useFHIROperations } from './FHIROperationsContext';
import { usePatient } from './PatientContext';
import {
  FHIRCacheProvider,
  FHIRDataProvider,
  FHIROperationsProvider,
  PatientProvider
} from './index';

/**
 * Composite provider that wraps all FHIR-related providers
 * Use this as a drop-in replacement for FHIRResourceProvider
 */
export function FHIRCompositeProvider({ children }) {
  return (
    <FHIRCacheProvider>
      <FHIRDataProvider>
        <FHIROperationsProvider>
          <PatientProvider>
            {children}
          </PatientProvider>
        </FHIROperationsProvider>
      </FHIRDataProvider>
    </FHIRCacheProvider>
  );
}

/**
 * Composite hook that combines all FHIR contexts for backward compatibility
 * with the original useFHIRResource API
 *
 * @returns {object} Combined context value matching original useFHIRResource API
 */
export function useFHIRResourceComposite() {
  const cache = useFHIRCache();
  const data = useFHIRData();
  const operations = useFHIROperations();
  const patient = usePatient();

  /**
   * Warm patient cache - combines cache marking with data fetching
   * @param {string} patientId - Patient ID to warm cache for
   * @param {string[]} resourceTypes - Resource types to warm
   */
  const warmPatientCache = useCallback(async (patientId, resourceTypes = ['Condition', 'MedicationRequest']) => {
    try {
      // Fetch resources
      const bundle = await operations.fetchPatientBundle(patientId, { resourceTypes });

      // Store in data context
      resourceTypes.forEach(type => {
        if (bundle[type]) {
          data.setResources(type, bundle[type]);

          // Add relationships
          bundle[type].forEach(resource => {
            data.addRelationship(patientId, type, resource.id);
          });
        }
      });

      // Mark cache as warm
      cache.markCacheWarm(patientId, resourceTypes);

      return bundle;
    } catch (error) {
      console.error(`Error warming cache for patient ${patientId}:`, error);
      throw error;
    }
  }, [operations, data, cache]);

  /**
   * Search with include - wrapper for searchResources with _include support
   * @param {string} resourceType - Resource type
   * @param {Object} params - Search params including _include
   * @returns {Promise<Object>} Search results
   */
  const searchWithInclude = useCallback(async (resourceType, params) => {
    // The operations context handles this through searchResources
    return operations.searchResources(resourceType, params);
  }, [operations]);

  // Compose the full API matching original useFHIRResource
  const compositeValue = useMemo(() => ({
    // State from data context
    resources: data.resources,
    relationships: data.relationships,
    loading: data.loading,
    isLoading: data.isLoading,
    errors: data.errors,

    // Current patient/encounter from patient context
    currentPatient: patient.currentPatient,
    currentEncounter: patient.currentEncounter,

    // Resource Management (from data context)
    setResources: data.setResources,
    addResource: data.addResource,
    updateResource: data.updateResource,
    removeResource: data.removeResource,
    getResource: data.getResource,
    getResourcesByType: data.getResourcesByType,
    getPatientResources: data.getPatientResources,
    clearResources: data.clearResources,

    // FHIR Operations (from operations context)
    fetchResource: operations.fetchResource,
    searchResources: operations.searchResources,
    searchWithInclude,
    fetchPatientBundle: operations.fetchPatientBundle,
    fetchPatientEverything: operations.fetchPatientEverything,
    refreshPatientResources: operations.refreshPatientResources,
    createResource: operations.createResource,
    deleteResource: operations.deleteResource,

    // Patient Context (from patient context)
    setCurrentPatient: patient.setCurrentPatient,
    setCurrentEncounter: patient.setCurrentEncounter,
    clearCurrentPatient: patient.clearCurrentPatient,
    clearCurrentEncounter: patient.clearCurrentEncounter,

    // Loading/Error utilities (from data context)
    isResourceLoading: data.isResourceLoading,
    getError: data.getError,
    setLoading: data.setLoading,
    setError: data.setError,
    clearError: data.clearError,

    // Cache operations (from cache context)
    clearCache: cache.clearCache,
    getCachedData: cache.getCachedData,
    setCachedData: cache.setCachedData,
    invalidateCacheEntry: cache.invalidateCacheEntry,
    isCacheWarm: cache.isCacheWarm,
    markCacheWarm: cache.markCacheWarm,
    getCacheStats: cache.getCacheStats,

    // Composite operations
    warmPatientCache,

    // Response standardization (from operations context)
    standardizeResponse: operations.standardizeResponse,

    // Direct fhirClient access for advanced usage
    fhirClient: operations.fhirClient,

    // Access to individual contexts for gradual migration
    _contexts: {
      cache,
      data,
      operations,
      patient
    }
  }), [
    data,
    patient,
    operations,
    cache,
    searchWithInclude,
    warmPatientCache
  ]);

  return compositeValue;
}

/**
 * Alias for backward compatibility
 * Components using useFHIRResource can switch to this with minimal changes
 */
export const useFHIRResource = useFHIRResourceComposite;

export default useFHIRResourceComposite;
