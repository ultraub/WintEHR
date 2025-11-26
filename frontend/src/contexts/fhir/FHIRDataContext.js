/**
 * FHIRDataContext
 *
 * Handles FHIR resource storage and retrieval including:
 * - Resource storage organized by type
 * - Patient-resource relationships
 * - Loading and error states per resource type
 * - Memoization for efficient resource retrieval
 */

import React, { createContext, useContext, useCallback, useReducer, useRef, useEffect } from 'react';

// Action Types
const DATA_ACTIONS = {
  // Resource Management
  SET_RESOURCES: 'SET_RESOURCES',
  ADD_RESOURCE: 'ADD_RESOURCE',
  UPDATE_RESOURCE: 'UPDATE_RESOURCE',
  REMOVE_RESOURCE: 'REMOVE_RESOURCE',
  CLEAR_RESOURCES: 'CLEAR_RESOURCES',

  // Loading States
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR',
  SET_GLOBAL_LOADING: 'SET_GLOBAL_LOADING',

  // Relationships
  SET_RELATIONSHIPS: 'SET_RELATIONSHIPS',
  ADD_RELATIONSHIP: 'ADD_RELATIONSHIP',
  CLEAR_PATIENT_RELATIONSHIPS: 'CLEAR_PATIENT_RELATIONSHIPS'
};

// Initial state with all supported FHIR resource types
const initialState = {
  resources: {
    Patient: {},
    Encounter: {},
    Observation: {},
    Condition: {},
    MedicationRequest: {},
    MedicationStatement: {},
    Procedure: {},
    DiagnosticReport: {},
    DocumentReference: {},
    CarePlan: {},
    CareTeam: {},
    AllergyIntolerance: {},
    Immunization: {},
    Coverage: {},
    Claim: {},
    ExplanationOfBenefit: {},
    ImagingStudy: {},
    Location: {},
    Practitioner: {},
    PractitionerRole: {},
    Organization: {},
    Device: {},
    SupplyDelivery: {},
    Provenance: {}
  },

  // Resource relationships - maps patient IDs to their resource IDs
  relationships: {},

  // Loading states per resource type
  loading: {},

  // Global loading state
  isLoading: false,

  // Errors per resource type
  errors: {}
};

// Reducer
function dataReducer(state, action) {
  switch (action.type) {
    case DATA_ACTIONS.SET_RESOURCES: {
      const { resourceType, resources } = action.payload;
      const resourceMap = {};

      if (Array.isArray(resources)) {
        resources.forEach(resource => {
          if (resource && resource.id) {
            resourceMap[resource.id] = resource;
          }
        });
      } else if (resources && resources.id) {
        resourceMap[resources.id] = resources;
      }

      return {
        ...state,
        resources: {
          ...state.resources,
          [resourceType]: {
            ...state.resources[resourceType],
            ...resourceMap
          }
        }
      };
    }

    case DATA_ACTIONS.ADD_RESOURCE: {
      const { resourceType, resource } = action.payload;

      if (!resource || !resource.id) {
        return state;
      }

      return {
        ...state,
        resources: {
          ...state.resources,
          [resourceType]: {
            ...state.resources[resourceType],
            [resource.id]: resource
          }
        }
      };
    }

    case DATA_ACTIONS.UPDATE_RESOURCE: {
      const { resourceType, resourceId, updates } = action.payload;
      const existingResource = state.resources[resourceType]?.[resourceId];
      if (!existingResource) return state;

      return {
        ...state,
        resources: {
          ...state.resources,
          [resourceType]: {
            ...state.resources[resourceType],
            [resourceId]: {
              ...existingResource,
              ...updates
            }
          }
        }
      };
    }

    case DATA_ACTIONS.REMOVE_RESOURCE: {
      const { resourceType, resourceId } = action.payload;
      const { [resourceId]: removed, ...remaining } = state.resources[resourceType] || {};

      return {
        ...state,
        resources: {
          ...state.resources,
          [resourceType]: remaining
        }
      };
    }

    case DATA_ACTIONS.CLEAR_RESOURCES: {
      const { resourceType } = action.payload;
      return {
        ...state,
        resources: {
          ...state.resources,
          [resourceType]: {}
        }
      };
    }

    case DATA_ACTIONS.SET_LOADING: {
      const { resourceType, loading } = action.payload;
      return {
        ...state,
        loading: {
          ...state.loading,
          [resourceType]: loading
        }
      };
    }

    case DATA_ACTIONS.SET_GLOBAL_LOADING: {
      return {
        ...state,
        isLoading: action.payload
      };
    }

    case DATA_ACTIONS.SET_ERROR: {
      const { resourceType, error } = action.payload;
      return {
        ...state,
        errors: {
          ...state.errors,
          [resourceType]: error
        }
      };
    }

    case DATA_ACTIONS.CLEAR_ERROR: {
      const { resourceType } = action.payload;
      const { [resourceType]: removed, ...remaining } = state.errors;
      return {
        ...state,
        errors: remaining
      };
    }

    case DATA_ACTIONS.SET_RELATIONSHIPS: {
      const { patientId, relationships } = action.payload;
      return {
        ...state,
        relationships: {
          ...state.relationships,
          [patientId]: relationships
        }
      };
    }

    case DATA_ACTIONS.ADD_RELATIONSHIP: {
      const { patientId, resourceType, resourceId } = action.payload;
      const existing = state.relationships[patientId] || {};
      const existingType = existing[resourceType] || [];

      // Only add if not already present
      if (existingType.includes(resourceId)) {
        return state;
      }

      return {
        ...state,
        relationships: {
          ...state.relationships,
          [patientId]: {
            ...existing,
            [resourceType]: [...existingType, resourceId]
          }
        }
      };
    }

    case DATA_ACTIONS.CLEAR_PATIENT_RELATIONSHIPS: {
      const { patientId } = action.payload;
      const { [patientId]: removed, ...remaining } = state.relationships;
      return {
        ...state,
        relationships: remaining
      };
    }

    default:
      return state;
  }
}

// Create Context
const FHIRDataContext = createContext(null);

// Max resources per type to prevent memory growth
const MAX_RESOURCES_PER_TYPE = 50;

// Provider Component
export function FHIRDataProvider({ children }) {
  const [state, dispatch] = useReducer(dataReducer, initialState);

  // Memoization cache for getPatientResources
  const getPatientResourcesMemo = useRef(new Map());

  /**
   * Set multiple resources of a given type
   * @param {string} resourceType - FHIR resource type
   * @param {Array|Object} resources - Resource(s) to set
   */
  const setResources = useCallback((resourceType, resources) => {
    dispatch({
      type: DATA_ACTIONS.SET_RESOURCES,
      payload: { resourceType, resources }
    });
  }, []);

  /**
   * Add a single resource
   * @param {string} resourceType - FHIR resource type
   * @param {Object} resource - Resource to add
   */
  const addResource = useCallback((resourceType, resource) => {
    dispatch({
      type: DATA_ACTIONS.ADD_RESOURCE,
      payload: { resourceType, resource }
    });
  }, []);

  /**
   * Update an existing resource
   * @param {string} resourceType - FHIR resource type
   * @param {string} resourceId - Resource ID
   * @param {Object} updates - Fields to update
   */
  const updateResource = useCallback((resourceType, resourceId, updates) => {
    dispatch({
      type: DATA_ACTIONS.UPDATE_RESOURCE,
      payload: { resourceType, resourceId, updates }
    });
  }, []);

  /**
   * Remove a resource
   * @param {string} resourceType - FHIR resource type
   * @param {string} resourceId - Resource ID
   */
  const removeResource = useCallback((resourceType, resourceId) => {
    dispatch({
      type: DATA_ACTIONS.REMOVE_RESOURCE,
      payload: { resourceType, resourceId }
    });
  }, []);

  /**
   * Clear all resources of a type
   * @param {string} resourceType - FHIR resource type
   */
  const clearResources = useCallback((resourceType) => {
    dispatch({
      type: DATA_ACTIONS.CLEAR_RESOURCES,
      payload: { resourceType }
    });
  }, []);

  /**
   * Get a specific resource by type and ID
   * @param {string} resourceType - FHIR resource type
   * @param {string} resourceId - Resource ID
   * @returns {Object|null} The resource or null
   */
  const getResource = useCallback((resourceType, resourceId) => {
    return state.resources[resourceType]?.[resourceId] || null;
  }, [state.resources]);

  /**
   * Get all resources of a type
   * @param {string} resourceType - FHIR resource type
   * @returns {Array} Array of resources
   */
  const getResourcesByType = useCallback((resourceType) => {
    return Object.values(state.resources[resourceType] || {});
  }, [state.resources]);

  /**
   * Get resources for a specific patient with memoization
   * @param {string} patientId - Patient ID
   * @param {string} resourceType - Optional specific resource type
   * @returns {Array} Array of resources for the patient
   */
  const getPatientResources = useCallback((patientId, resourceType = null) => {
    if (!patientId) return [];

    // Check memoization cache
    const memoKey = `${patientId}-${resourceType || 'all'}`;
    const cached = getPatientResourcesMemo.current.get(memoKey);

    if (cached) {
      const currentRelationships = state.relationships[patientId];
      const currentResources = resourceType ? state.resources[resourceType] : state.resources;

      // Use simple reference comparison for validity
      if (cached.relationships === currentRelationships &&
          cached.resources === currentResources) {
        return cached.result;
      }
    }

    const relationships = state.relationships[patientId];
    if (!relationships) {
      // Cache empty result
      getPatientResourcesMemo.current.set(memoKey, {
        result: [],
        relationships: relationships,
        resources: resourceType ? state.resources[resourceType] : state.resources
      });
      return [];
    }

    if (resourceType) {
      const resourceIds = relationships[resourceType] || [];
      const resources = resourceIds
        .map(id => state.resources[resourceType]?.[id])
        .filter(Boolean);

      // Cache the result
      getPatientResourcesMemo.current.set(memoKey, {
        result: resources,
        relationships: state.relationships[patientId],
        resources: state.resources[resourceType]
      });

      return resources;
    }

    // Return all resources for patient
    const allResources = [];
    Object.entries(relationships).forEach(([type, ids]) => {
      ids.forEach(id => {
        const resource = state.resources[type]?.[id];
        if (resource) {
          allResources.push(resource);
        }
      });
    });

    // Cache result
    getPatientResourcesMemo.current.set(memoKey, {
      result: allResources,
      relationships: state.relationships[patientId],
      resources: state.resources
    });

    return allResources;
  }, [state.resources, state.relationships]);

  /**
   * Add a relationship between patient and resource
   * @param {string} patientId - Patient ID
   * @param {string} resourceType - FHIR resource type
   * @param {string} resourceId - Resource ID
   */
  const addRelationship = useCallback((patientId, resourceType, resourceId) => {
    dispatch({
      type: DATA_ACTIONS.ADD_RELATIONSHIP,
      payload: { patientId, resourceType, resourceId }
    });
  }, []);

  /**
   * Set all relationships for a patient
   * @param {string} patientId - Patient ID
   * @param {Object} relationships - Relationships object
   */
  const setRelationships = useCallback((patientId, relationships) => {
    dispatch({
      type: DATA_ACTIONS.SET_RELATIONSHIPS,
      payload: { patientId, relationships }
    });
  }, []);

  /**
   * Clear all relationships for a patient
   * @param {string} patientId - Patient ID
   */
  const clearPatientRelationships = useCallback((patientId) => {
    dispatch({
      type: DATA_ACTIONS.CLEAR_PATIENT_RELATIONSHIPS,
      payload: { patientId }
    });
  }, []);

  /**
   * Set loading state for a resource type
   * @param {string} resourceType - FHIR resource type
   * @param {boolean} loading - Loading state
   */
  const setLoading = useCallback((resourceType, loading) => {
    dispatch({
      type: DATA_ACTIONS.SET_LOADING,
      payload: { resourceType, loading }
    });
  }, []);

  /**
   * Set global loading state
   * @param {boolean} loading - Loading state
   */
  const setGlobalLoading = useCallback((loading) => {
    dispatch({
      type: DATA_ACTIONS.SET_GLOBAL_LOADING,
      payload: loading
    });
  }, []);

  /**
   * Set error for a resource type
   * @param {string} resourceType - FHIR resource type
   * @param {string} error - Error message
   */
  const setError = useCallback((resourceType, error) => {
    dispatch({
      type: DATA_ACTIONS.SET_ERROR,
      payload: { resourceType, error }
    });
  }, []);

  /**
   * Clear error for a resource type
   * @param {string} resourceType - FHIR resource type
   */
  const clearError = useCallback((resourceType) => {
    dispatch({
      type: DATA_ACTIONS.CLEAR_ERROR,
      payload: { resourceType }
    });
  }, []);

  /**
   * Check if a resource type is loading
   * @param {string} resourceType - FHIR resource type
   * @returns {boolean} True if loading
   */
  const isResourceLoading = useCallback((resourceType) => {
    return state.loading[resourceType] || false;
  }, [state.loading]);

  /**
   * Get error for a resource type
   * @param {string} resourceType - FHIR resource type
   * @returns {string|null} Error message or null
   */
  const getError = useCallback((resourceType) => {
    return state.errors[resourceType] || null;
  }, [state.errors]);

  /**
   * Cleanup old resources to prevent memory growth
   */
  const cleanupOldResources = useCallback(() => {
    const resourceTypes = Object.keys(state.resources);

    resourceTypes.forEach(resourceType => {
      const resources = state.resources[resourceType];
      const resourceIds = Object.keys(resources);

      if (resourceIds.length > MAX_RESOURCES_PER_TYPE) {
        // Sort by lastUpdated or meta.lastUpdated to keep recent ones
        const sortedResources = resourceIds
          .map(id => ({ id, resource: resources[id] }))
          .sort((a, b) => {
            const dateA = new Date(a.resource.meta?.lastUpdated || a.resource.lastUpdated || 0);
            const dateB = new Date(b.resource.meta?.lastUpdated || b.resource.lastUpdated || 0);
            return dateB - dateA;
          });

        // Keep only the most recent resources
        const resourcesToKeep = sortedResources.slice(0, MAX_RESOURCES_PER_TYPE);
        const newResourceMap = {};
        resourcesToKeep.forEach(({ id, resource }) => {
          newResourceMap[id] = resource;
        });

        dispatch({
          type: DATA_ACTIONS.CLEAR_RESOURCES,
          payload: { resourceType }
        });

        dispatch({
          type: DATA_ACTIONS.SET_RESOURCES,
          payload: { resourceType, resources: Object.values(newResourceMap) }
        });
      }
    });
  }, [state.resources]);

  // Clear memoization cache when relationships or resources change
  useEffect(() => {
    getPatientResourcesMemo.current.clear();
  }, [state.relationships, state.resources]);

  // Context value
  const contextValue = React.useMemo(() => ({
    // State
    resources: state.resources,
    relationships: state.relationships,
    loading: state.loading,
    isLoading: state.isLoading,
    errors: state.errors,

    // Resource operations
    setResources,
    addResource,
    updateResource,
    removeResource,
    clearResources,
    getResource,
    getResourcesByType,
    getPatientResources,
    cleanupOldResources,

    // Relationship operations
    addRelationship,
    setRelationships,
    clearPatientRelationships,

    // Loading/Error operations
    setLoading,
    setGlobalLoading,
    setError,
    clearError,
    isResourceLoading,
    getError,

    // Dispatch for advanced usage
    dispatch
  }), [
    state,
    setResources,
    addResource,
    updateResource,
    removeResource,
    clearResources,
    getResource,
    getResourcesByType,
    getPatientResources,
    cleanupOldResources,
    addRelationship,
    setRelationships,
    clearPatientRelationships,
    setLoading,
    setGlobalLoading,
    setError,
    clearError,
    isResourceLoading,
    getError
  ]);

  return (
    <FHIRDataContext.Provider value={contextValue}>
      {children}
    </FHIRDataContext.Provider>
  );
}

/**
 * Hook to access the FHIR data context
 * @returns {object} Data context value
 * @throws {Error} If used outside of FHIRDataProvider
 */
export function useFHIRData() {
  const context = useContext(FHIRDataContext);
  if (!context) {
    throw new Error('useFHIRData must be used within a FHIRDataProvider');
  }
  return context;
}

// Export action types for external use
export { DATA_ACTIONS };

export default FHIRDataContext;
