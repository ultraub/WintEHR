/**
 * FHIROperationsContext
 *
 * Handles FHIR API operations including:
 * - Resource CRUD operations (create, read, update, delete)
 * - Search and query operations
 * - Patient-specific data fetching (bundles, everything)
 * - Request deduplication
 * - Response standardization
 */

import React, { createContext, useContext, useCallback, useRef } from 'react';
import fhirClient from '../../core/fhir/services/fhirClient';

// Create Context
const FHIROperationsContext = createContext(null);

// Provider Component
export function FHIROperationsProvider({ children }) {
  // Request deduplication tracking
  const pendingRequests = useRef(new Map());

  /**
   * Standardize FHIR response to consistent format
   * @param {Object} response - Raw FHIR response
   * @returns {Object} Standardized response
   */
  const standardizeResponse = useCallback((response) => {
    if (!response) {
      return { resources: [], total: 0 };
    }

    // Handle bundle response
    if (response.resourceType === 'Bundle') {
      const resources = response.entry?.map(e => e.resource).filter(Boolean) || [];
      return {
        resources,
        total: response.total ?? resources.length,
        bundle: response
      };
    }

    // Handle single resource response
    if (response.resourceType) {
      return {
        resources: [response],
        total: 1,
        resource: response
      };
    }

    // Handle array response (already processed)
    if (Array.isArray(response)) {
      return {
        resources: response,
        total: response.length
      };
    }

    // Handle response with resources property
    if (response.resources) {
      return {
        resources: response.resources,
        total: response.total ?? response.resources.length,
        ...response
      };
    }

    return { resources: [], total: 0 };
  }, []);

  /**
   * Deduplicate requests to prevent duplicate API calls
   * @param {string} key - Unique request key
   * @param {Function} requestFn - Request function to execute
   * @returns {Promise} Request result
   */
  const deduplicateRequest = useCallback(async (key, requestFn) => {
    // Check if request is already pending
    if (pendingRequests.current.has(key)) {
      return pendingRequests.current.get(key);
    }

    // Create new request promise
    const promise = requestFn().finally(() => {
      pendingRequests.current.delete(key);
    });

    pendingRequests.current.set(key, promise);
    return promise;
  }, []);

  /**
   * Fetch a single FHIR resource by type and ID
   * @param {string} resourceType - FHIR resource type
   * @param {string} resourceId - Resource ID
   * @param {Object} options - Fetch options
   * @returns {Promise<Object>} The resource
   */
  const fetchResource = useCallback(async (resourceType, resourceId, options = {}) => {
    const { deduplicate = true } = options;

    const fetchFn = async () => {
      try {
        const resource = await fhirClient.read(resourceType, resourceId);
        return resource;
      } catch (error) {
        console.error(`Error fetching ${resourceType}/${resourceId}:`, error);
        throw error;
      }
    };

    if (deduplicate) {
      const key = `fetch:${resourceType}:${resourceId}`;
      return deduplicateRequest(key, fetchFn);
    }

    return fetchFn();
  }, [deduplicateRequest]);

  /**
   * Search for FHIR resources
   * @param {string} resourceType - FHIR resource type
   * @param {Object} params - Search parameters
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Standardized search results
   */
  const searchResources = useCallback(async (resourceType, params = {}, options = {}) => {
    const { deduplicate = true, standardize = true } = options;

    const searchFn = async () => {
      try {
        const response = await fhirClient.search(resourceType, params);
        return standardize ? standardizeResponse(response) : response;
      } catch (error) {
        console.error(`Error searching ${resourceType}:`, error);
        throw error;
      }
    };

    if (deduplicate) {
      const key = `search:${resourceType}:${JSON.stringify(params)}`;
      return deduplicateRequest(key, searchFn);
    }

    return searchFn();
  }, [deduplicateRequest, standardizeResponse]);

  /**
   * Create a new FHIR resource
   * @param {string} resourceType - FHIR resource type
   * @param {Object} resource - Resource data
   * @returns {Promise<Object>} Created resource
   */
  const createResource = useCallback(async (resourceType, resource) => {
    try {
      const result = await fhirClient.create(resourceType, {
        ...resource,
        resourceType
      });
      return result;
    } catch (error) {
      console.error(`Error creating ${resourceType}:`, error);
      throw error;
    }
  }, []);

  /**
   * Update an existing FHIR resource
   * @param {string} resourceType - FHIR resource type
   * @param {string} resourceId - Resource ID
   * @param {Object} resource - Updated resource data
   * @returns {Promise<Object>} Updated resource
   */
  const updateResource = useCallback(async (resourceType, resourceId, resource) => {
    try {
      const result = await fhirClient.update(resourceType, resourceId, {
        ...resource,
        id: resourceId,
        resourceType
      });
      return result;
    } catch (error) {
      console.error(`Error updating ${resourceType}/${resourceId}:`, error);
      throw error;
    }
  }, []);

  /**
   * Delete a FHIR resource
   * @param {string} resourceType - FHIR resource type
   * @param {string} resourceId - Resource ID
   * @returns {Promise<boolean>} Success status
   */
  const deleteResource = useCallback(async (resourceType, resourceId) => {
    try {
      await fhirClient.delete(resourceType, resourceId);
      return true;
    } catch (error) {
      console.error(`Error deleting ${resourceType}/${resourceId}:`, error);
      throw error;
    }
  }, []);

  /**
   * Fetch patient bundle with related resources
   * @param {string} patientId - Patient ID
   * @param {Object} options - Fetch options
   * @returns {Promise<Object>} Patient bundle with resources
   */
  const fetchPatientBundle = useCallback(async (patientId, options = {}) => {
    const {
      resourceTypes = ['Condition', 'MedicationRequest', 'AllergyIntolerance', 'Observation'],
      deduplicate = true
    } = options;

    const fetchFn = async () => {
      try {
        // Fetch resources in parallel
        const results = await Promise.all(
          resourceTypes.map(async (type) => {
            try {
              const response = await fhirClient.search(type, {
                patient: `Patient/${patientId}`,
                _count: 100
              });
              return { type, response: standardizeResponse(response) };
            } catch (error) {
              console.warn(`Failed to fetch ${type} for patient ${patientId}:`, error);
              return { type, response: { resources: [], total: 0 } };
            }
          })
        );

        // Organize results by resource type
        const bundle = {};
        results.forEach(({ type, response }) => {
          bundle[type] = response.resources;
        });

        return bundle;
      } catch (error) {
        console.error(`Error fetching patient bundle for ${patientId}:`, error);
        throw error;
      }
    };

    if (deduplicate) {
      const key = `patientBundle:${patientId}:${resourceTypes.sort().join(',')}`;
      return deduplicateRequest(key, fetchFn);
    }

    return fetchFn();
  }, [deduplicateRequest, standardizeResponse]);

  /**
   * Fetch all resources for a patient using $everything operation
   * @param {string} patientId - Patient ID
   * @param {Object} options - Fetch options
   * @returns {Promise<Object>} All patient resources
   */
  const fetchPatientEverything = useCallback(async (patientId, options = {}) => {
    const { deduplicate = true } = options;

    const fetchFn = async () => {
      try {
        // Try $everything operation if supported
        const response = await fhirClient.operation(
          `Patient/${patientId}`,
          '$everything',
          {}
        );
        return standardizeResponse(response);
      } catch (error) {
        // Fall back to manual bundle fetch
        console.warn('$everything operation failed, falling back to manual fetch');
        const bundle = await fetchPatientBundle(patientId, {
          resourceTypes: [
            'Condition', 'MedicationRequest', 'MedicationStatement',
            'AllergyIntolerance', 'Observation', 'Procedure',
            'DiagnosticReport', 'Encounter', 'CarePlan', 'CareTeam',
            'Immunization', 'DocumentReference'
          ],
          deduplicate: false
        });

        // Flatten bundle to resources array
        const resources = Object.values(bundle).flat();
        return { resources, total: resources.length };
      }
    };

    if (deduplicate) {
      const key = `patientEverything:${patientId}`;
      return deduplicateRequest(key, fetchFn);
    }

    return fetchFn();
  }, [deduplicateRequest, fetchPatientBundle, standardizeResponse]);

  /**
   * Refresh patient resources (force fetch without cache)
   * @param {string} patientId - Patient ID
   * @param {string[]} resourceTypes - Resource types to refresh
   * @returns {Promise<Object>} Fresh resource data
   */
  const refreshPatientResources = useCallback(async (patientId, resourceTypes = null) => {
    // Clear any pending requests for this patient
    const keysToDelete = [];
    pendingRequests.current.forEach((_, key) => {
      if (key.includes(patientId)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => pendingRequests.current.delete(key));

    // Invalidate cache if available
    if (fhirClient.invalidatePatientCache) {
      await fhirClient.invalidatePatientCache(patientId);
    }

    // Fetch fresh data
    if (resourceTypes) {
      return fetchPatientBundle(patientId, {
        resourceTypes,
        deduplicate: false
      });
    }

    return fetchPatientEverything(patientId, { deduplicate: false });
  }, [fetchPatientBundle, fetchPatientEverything]);

  /**
   * Execute a batch of FHIR operations
   * @param {Array} operations - Array of operation descriptors
   * @returns {Promise<Array>} Results of all operations
   */
  const executeBatch = useCallback(async (operations) => {
    try {
      const results = await Promise.all(
        operations.map(async (op) => {
          try {
            switch (op.type) {
              case 'read':
                return await fetchResource(op.resourceType, op.id, { deduplicate: false });
              case 'search':
                return await searchResources(op.resourceType, op.params, { deduplicate: false });
              case 'create':
                return await createResource(op.resourceType, op.resource);
              case 'update':
                return await updateResource(op.resourceType, op.id, op.resource);
              case 'delete':
                return await deleteResource(op.resourceType, op.id);
              default:
                throw new Error(`Unknown operation type: ${op.type}`);
            }
          } catch (error) {
            return { error: error.message, operation: op };
          }
        })
      );
      return results;
    } catch (error) {
      console.error('Error executing batch operations:', error);
      throw error;
    }
  }, [fetchResource, searchResources, createResource, updateResource, deleteResource]);

  /**
   * Get pending request count (for debugging/monitoring)
   * @returns {number} Number of pending requests
   */
  const getPendingRequestCount = useCallback(() => {
    return pendingRequests.current.size;
  }, []);

  // Context value
  const contextValue = React.useMemo(() => ({
    // Single resource operations
    fetchResource,
    createResource,
    updateResource,
    deleteResource,

    // Search operations
    searchResources,

    // Patient-specific operations
    fetchPatientBundle,
    fetchPatientEverything,
    refreshPatientResources,

    // Batch operations
    executeBatch,

    // Utilities
    standardizeResponse,
    deduplicateRequest,
    getPendingRequestCount,

    // Direct fhirClient access for advanced usage
    fhirClient
  }), [
    fetchResource,
    createResource,
    updateResource,
    deleteResource,
    searchResources,
    fetchPatientBundle,
    fetchPatientEverything,
    refreshPatientResources,
    executeBatch,
    standardizeResponse,
    deduplicateRequest,
    getPendingRequestCount
  ]);

  return (
    <FHIROperationsContext.Provider value={contextValue}>
      {children}
    </FHIROperationsContext.Provider>
  );
}

/**
 * Hook to access the FHIR operations context
 * @returns {object} Operations context value
 * @throws {Error} If used outside of FHIROperationsProvider
 */
export function useFHIROperations() {
  const context = useContext(FHIROperationsContext);
  if (!context) {
    throw new Error('useFHIROperations must be used within a FHIROperationsProvider');
  }
  return context;
}

export default FHIROperationsContext;
