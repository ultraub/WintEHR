import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { fhirClient } from '../services/fhirClient';
import { intelligentCache, cacheUtils } from '../utils/intelligentCache';
import { useStableCallback, useStateGuard } from '../hooks/useStableReferences';

// Action Types
const FHIR_ACTIONS = {
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
  
  // Patient Context
  SET_CURRENT_PATIENT: 'SET_CURRENT_PATIENT',
  SET_CURRENT_ENCOUNTER: 'SET_CURRENT_ENCOUNTER',
  
  // Cache Management
  SET_CACHE: 'SET_CACHE',
  INVALIDATE_CACHE: 'INVALIDATE_CACHE',
  
  // Relationships
  SET_RELATIONSHIPS: 'SET_RELATIONSHIPS',
  ADD_RELATIONSHIP: 'ADD_RELATIONSHIP',
  
  // Search and Filters
  SET_SEARCH_RESULTS: 'SET_SEARCH_RESULTS',
  SET_FILTERS: 'SET_FILTERS'
};

// Initial State
const initialState = {
  // Resource Storage - organized by resource type and ID
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
  
  // Resource Relationships - maps resource references
  relationships: {
    // Example: patientId -> { encounters: [encounterId1, encounterId2], conditions: [...] }
  },
  
  // Current Context
  currentPatient: null,
  currentEncounter: null,
  
  // Loading States - per resource type
  loading: {},
  
  // Global loading state
  isLoading: false,
  
  // Errors - per resource type
  errors: {},
  
  // Cache - for search results and computed data
  cache: {
    searches: {}, // searchKey -> { results, timestamp, ttl }
    bundles: {},  // bundleKey -> { bundle, timestamp, ttl }
    computed: {}  // computedKey -> { data, timestamp, ttl }
  },
  
  // Search and Filter State
  searchResults: {},
  activeFilters: {}
};

// Reducer
function fhirResourceReducer(state, action) {
  switch (action.type) {
    case FHIR_ACTIONS.SET_RESOURCES: {
      const { resourceType, resources } = action.payload;
      const resourceMap = {};
      
      if (Array.isArray(resources)) {
        resources.forEach(resource => {
          resourceMap[resource.id] = resource;
        });
      } else {
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
    
    case FHIR_ACTIONS.ADD_RESOURCE: {
      const { resourceType, resource } = action.payload;
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
    
    case FHIR_ACTIONS.UPDATE_RESOURCE: {
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
    
    case FHIR_ACTIONS.REMOVE_RESOURCE: {
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
    
    case FHIR_ACTIONS.CLEAR_RESOURCES: {
      const { resourceType } = action.payload;
      return {
        ...state,
        resources: {
          ...state.resources,
          [resourceType]: {}
        }
      };
    }
    
    case FHIR_ACTIONS.SET_LOADING: {
      const { resourceType, loading } = action.payload;
      return {
        ...state,
        loading: {
          ...state.loading,
          [resourceType]: loading
        }
      };
    }
    
    case FHIR_ACTIONS.SET_ERROR: {
      const { resourceType, error } = action.payload;
      return {
        ...state,
        errors: {
          ...state.errors,
          [resourceType]: error
        }
      };
    }
    
    case FHIR_ACTIONS.CLEAR_ERROR: {
      const { resourceType } = action.payload;
      const { [resourceType]: removed, ...remaining } = state.errors;
      return {
        ...state,
        errors: remaining
      };
    }
    
    case FHIR_ACTIONS.SET_GLOBAL_LOADING: {
      return {
        ...state,
        isLoading: action.payload
      };
    }
    
    case FHIR_ACTIONS.SET_CURRENT_PATIENT: {
      return {
        ...state,
        currentPatient: action.payload
      };
    }
    
    case FHIR_ACTIONS.SET_CURRENT_ENCOUNTER: {
      return {
        ...state,
        currentEncounter: action.payload
      };
    }
    
    case FHIR_ACTIONS.SET_CACHE: {
      const { cacheType, key, data, ttl = 300000 } = action.payload; // 5 minute default TTL
      return {
        ...state,
        cache: {
          ...state.cache,
          [cacheType]: {
            ...state.cache[cacheType],
            [key]: {
              data,
              timestamp: Date.now(),
              ttl
            }
          }
        }
      };
    }
    
    case FHIR_ACTIONS.INVALIDATE_CACHE: {
      const { cacheType, key } = action.payload;
      if (key) {
        const { [key]: removed, ...remaining } = state.cache[cacheType] || {};
        return {
          ...state,
          cache: {
            ...state.cache,
            [cacheType]: remaining
          }
        };
      } else {
        return {
          ...state,
          cache: {
            ...state.cache,
            [cacheType]: {}
          }
        };
      }
    }
    
    case FHIR_ACTIONS.SET_RELATIONSHIPS: {
      const { patientId, relationships } = action.payload;
      return {
        ...state,
        relationships: {
          ...state.relationships,
          [patientId]: relationships
        }
      };
    }
    
    case FHIR_ACTIONS.ADD_RELATIONSHIP: {
      const { patientId, resourceType, resourceId } = action.payload;
      const existing = state.relationships[patientId] || {};
      const existingType = existing[resourceType] || [];
      
      return {
        ...state,
        relationships: {
          ...state.relationships,
          [patientId]: {
            ...existing,
            [resourceType]: [...existingType, resourceId].filter((id, index, arr) => arr.indexOf(id) === index)
          }
        }
      };
    }
    
    case FHIR_ACTIONS.SET_SEARCH_RESULTS: {
      const { searchKey, results } = action.payload;
      return {
        ...state,
        searchResults: {
          ...state.searchResults,
          [searchKey]: results
        }
      };
    }
    
    case FHIR_ACTIONS.SET_FILTERS: {
      const { resourceType, filters } = action.payload;
      return {
        ...state,
        activeFilters: {
          ...state.activeFilters,
          [resourceType]: filters
        }
      };
    }
    
    default:
      return state;
  }
}

// Create Context
const FHIRResourceContext = createContext();

// Provider Component
export function FHIRResourceProvider({ children }) {
  const [state, dispatch] = useReducer(fhirResourceReducer, initialState);

  // Enhanced cache utilities using intelligent cache
  const getCachedData = useCallback((cacheType, key) => {
    // First check intelligent cache
    const intelligentCacheKey = `${cacheType}:${key}`;
    const intelligentData = intelligentCache.get(intelligentCacheKey);
    if (intelligentData) {
      return intelligentData;
    }
    
    // Fallback to state cache for backward compatibility
    const cached = state.cache[cacheType]?.[key];
    if (!cached) return null;
    
    const now = Date.now();
    if (now - cached.timestamp > cached.ttl) {
      // Cache expired, remove it
      dispatch({
        type: FHIR_ACTIONS.INVALIDATE_CACHE,
        payload: { cacheType, key }
      });
      return null;
    }
    
    return cached.data;
  }, [state.cache]);

  const setCachedData = useCallback((cacheType, key, data, ttl, resourceType = null) => {
    // Store in intelligent cache
    const intelligentCacheKey = `${cacheType}:${key}`;
    intelligentCache.set(intelligentCacheKey, data, {
      resourceType,
      customTTL: ttl,
      tags: [cacheType]
    });
    
    // Also store in state cache for backward compatibility
    dispatch({
      type: FHIR_ACTIONS.SET_CACHE,
      payload: { cacheType, key, data, ttl }
    });
  }, []);

  // Resource Management Functions
  const setResources = useCallback((resourceType, resources) => {
    dispatch({
      type: FHIR_ACTIONS.SET_RESOURCES,
      payload: { resourceType, resources }
    });
  }, []);

  const addResource = useCallback((resourceType, resource) => {
    dispatch({
      type: FHIR_ACTIONS.ADD_RESOURCE,
      payload: { resourceType, resource }
    });
    
    // Add relationship if patient context exists
    if (state.currentPatient && resource.subject?.reference === `Patient/${state.currentPatient.id}`) {
      dispatch({
        type: FHIR_ACTIONS.ADD_RELATIONSHIP,
        payload: {
          patientId: state.currentPatient.id,
          resourceType,
          resourceId: resource.id
        }
      });
    }
  }, [state.currentPatient]);

  const updateResource = useCallback((resourceType, resourceId, updates) => {
    dispatch({
      type: FHIR_ACTIONS.UPDATE_RESOURCE,
      payload: { resourceType, resourceId, updates }
    });
  }, []);

  const removeResource = useCallback((resourceType, resourceId) => {
    dispatch({
      type: FHIR_ACTIONS.REMOVE_RESOURCE,
      payload: { resourceType, resourceId }
    });
  }, []);

  const getResource = useCallback((resourceType, resourceId) => {
    return state.resources[resourceType]?.[resourceId] || null;
  }, [state.resources]);

  const getResourcesByType = useCallback((resourceType) => {
    return Object.values(state.resources[resourceType] || {});
  }, [state.resources]);

  const getPatientResources = useCallback((patientId, resourceType = null) => {
    const relationships = state.relationships[patientId];
    if (!relationships) return [];

    if (resourceType) {
      const resourceIds = relationships[resourceType] || [];
      return resourceIds.map(id => state.resources[resourceType]?.[id]).filter(Boolean);
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

    return allResources;
  }, [state.resources, state.relationships]);

  // FHIR Operations with Caching
  const fetchResource = useCallback(async (resourceType, resourceId, forceRefresh = false) => {
    const cacheKey = `${resourceType}/${resourceId}`;
    
    if (!forceRefresh) {
      const cached = getCachedData('resources', cacheKey);
      if (cached) return cached;
    }

    dispatch({ type: FHIR_ACTIONS.SET_LOADING, payload: { resourceType, loading: true } });
    dispatch({ type: FHIR_ACTIONS.CLEAR_ERROR, payload: { resourceType } });

    try {
      const resource = await fhirClient.read(resourceType, resourceId);
      
      addResource(resourceType, resource);
      setCachedData('resources', cacheKey, resource, 600000, resourceType); // 10 minute default
      
      return resource;
    } catch (error) {
      dispatch({ type: FHIR_ACTIONS.SET_ERROR, payload: { resourceType, error: error.message } });
      throw error;
    } finally {
      dispatch({ type: FHIR_ACTIONS.SET_LOADING, payload: { resourceType, loading: false } });
    }
  }, [getCachedData, setCachedData, addResource]);

  const searchResources = useCallback(async (resourceType, params = {}, forceRefresh = false) => {
    const searchKey = `${resourceType}_${JSON.stringify(params)}`;
    
    if (!forceRefresh) {
      const cached = getCachedData('searches', searchKey);
      if (cached) {
        setResources(resourceType, cached.resources);
        return cached;
      }
    }

    dispatch({ type: FHIR_ACTIONS.SET_LOADING, payload: { resourceType, loading: true } });
    dispatch({ type: FHIR_ACTIONS.CLEAR_ERROR, payload: { resourceType } });

    try {
      const result = await fhirClient.search(resourceType, params);
      
      if (result.resources && result.resources.length > 0) {
        setResources(resourceType, result.resources);
        
        // Build relationships for patient resources
        if (params.patient || params.subject) {
          const patientId = params.patient || params.subject;
          result.resources.forEach(resource => {
            dispatch({
              type: FHIR_ACTIONS.ADD_RELATIONSHIP,
              payload: {
                patientId,
                resourceType,
                resourceId: resource.id
              }
            });
          });
        }
      }
      
      setCachedData('searches', searchKey, result, 300000, resourceType); // 5 minute cache for searches
      dispatch({ type: FHIR_ACTIONS.SET_SEARCH_RESULTS, payload: { searchKey, results: result } });
      
      return result;
    } catch (error) {
      dispatch({ type: FHIR_ACTIONS.SET_ERROR, payload: { resourceType, error: error.message } });
      throw error;
    } finally {
      dispatch({ type: FHIR_ACTIONS.SET_LOADING, payload: { resourceType, loading: false } });
    }
  }, [getCachedData, setCachedData, setResources]);

  const fetchPatientBundle = useCallback(async (patientId, forceRefresh = false, priority = 'all') => {
    const cacheKey = `patient_bundle_${patientId}_${priority}`;
    
    if (!forceRefresh) {
      const cached = getCachedData('bundles', cacheKey);
      if (cached) return cached;
    }

    // Define resource types by priority for progressive loading
    const resourceTypesByPriority = {
      critical: ['Encounter', 'Condition', 'MedicationRequest', 'AllergyIntolerance'],
      important: ['Observation', 'Procedure', 'DiagnosticReport', 'Coverage'],
      optional: ['Immunization', 'CarePlan', 'CareTeam', 'DocumentReference', 'ImagingStudy']
    };
    
    let resourceTypes;
    if (priority === 'critical') {
      resourceTypes = resourceTypesByPriority.critical;
    } else if (priority === 'important') {
      resourceTypes = [...resourceTypesByPriority.critical, ...resourceTypesByPriority.important];
    } else {
      resourceTypes = [...resourceTypesByPriority.critical, ...resourceTypesByPriority.important, ...resourceTypesByPriority.optional];
    }

    try {
      const promises = resourceTypes.map(resourceType => {
        // Reduce initial count for better performance, increase for specific needs
        const counts = {
          critical: 100,
          important: 200,
          optional: 50
        };
        
        let baseCount = priority === 'critical' ? counts.critical : 
                       priority === 'important' ? counts.important : counts.optional;
        
        // Adjust count based on resource type
        let resourceCount = baseCount;
        if (resourceType === 'Observation' && priority !== 'critical') {
          resourceCount = 500; // Observations are numerous but important
        } else if (resourceType === 'Encounter') {
          resourceCount = 50;  // Usually fewer encounters
        }
        
        let params = { patient: patientId, _count: resourceCount };
        
        // Add appropriate sort parameters for each resource type
        switch (resourceType) {
          case 'Procedure':
            params._sort = '-performed-date';
            break;
          case 'Observation':
            params._sort = '-date';
            break;
          case 'Encounter':
            params._sort = '-date';
            break;
          case 'MedicationRequest':
            params._sort = '-authored';
            break;
          case 'Condition':
            params._sort = '-recorded-date';
            break;
          case 'DiagnosticReport':
            params._sort = '-date';
            break;
          case 'DocumentReference':
            params._sort = '-date';
            break;
          case 'ImagingStudy':
            params._sort = '-started';
            break;
          case 'AllergyIntolerance':
            params._sort = '-date';
            break;
          case 'Immunization':
            params._sort = '-date';
            break;
          default:
            // Most resources use -date as default
            params._sort = '-date';
        }
        
        return searchResources(resourceType, params, forceRefresh)
          .catch(err => ({ resourceType, error: err.message, resources: [] }));
      });

      const results = await Promise.all(promises);
      const bundle = {};
      
      results.forEach(result => {
        if (result.error) {
          
        }
        bundle[result.resourceType || 'unknown'] = result.resources || [];
      });

      // Cache with intelligent TTL based on priority
      const cacheTTL = priority === 'critical' ? 900000 : // 15 minutes
                      priority === 'important' ? 600000 : // 10 minutes  
                      300000; // 5 minutes
      setCachedData('bundles', cacheKey, bundle, cacheTTL, 'Bundle');
      return bundle;
    } catch (error) {
      
      throw error;
    }
  }, [searchResources, getCachedData, setCachedData]);

  // Patient Context Management - using stable callback to prevent infinite loops
  const setCurrentPatient = useStableCallback(async (patientId) => {
    // Prevent duplicate calls for the same patient
    if (state.currentPatient?.id === patientId) {
      return state.currentPatient;
    }
    
    dispatch({ type: FHIR_ACTIONS.SET_GLOBAL_LOADING, payload: true });
    
    try {
      // Check if patient is already cached in resources
      let patient = state.resources.Patient?.[patientId];
      
      if (!patient) {
        patient = await fetchResource('Patient', patientId);
      }
      
      dispatch({ type: FHIR_ACTIONS.SET_CURRENT_PATIENT, payload: patient });
      
      // Check if we already have critical resources cached
      const hasExistingData = state.relationships[patientId] && 
        Object.keys(state.relationships[patientId]).length > 0;
      
      if (!hasExistingData) {
        // Progressive loading: Load critical resources first, then important ones in background
        await fetchPatientBundle(patientId, false, 'critical');
        
        // Load important resources in background
        setTimeout(() => {
          fetchPatientBundle(patientId, false, 'important');
        }, 100);
        
        // Load optional resources after a delay
        setTimeout(() => {
          fetchPatientBundle(patientId, false, 'all');
        }, 2000);
      }
      
      dispatch({ type: FHIR_ACTIONS.SET_GLOBAL_LOADING, payload: false });
      return patient;
    } catch (error) {
      dispatch({ type: FHIR_ACTIONS.SET_GLOBAL_LOADING, payload: false });
      throw error;
    }
  });

  const setCurrentEncounter = useCallback(async (encounterId) => {
    try {
      const encounter = await fetchResource('Encounter', encounterId);
      dispatch({ type: FHIR_ACTIONS.SET_CURRENT_ENCOUNTER, payload: encounter });
      return encounter;
    } catch (error) {
      
      throw error;
    }
  }, [fetchResource]);

  // Cache coordination utilities
  const warmPatientCache = useCallback(async (patientId, priority = 'critical') => {
    // Pre-warm cache for faster subsequent loads
    try {
      if (priority === 'all') {
        // Warm all data types
        await fetchPatientBundle(patientId, false, 'all');
      } else if (priority === 'summary') {
        // Warm only summary view data (conditions, meds, vitals, allergies)
        const summaryTypes = ['Condition', 'MedicationRequest', 'Observation', 'AllergyIntolerance'];
        await Promise.all(summaryTypes.map(type => 
          searchResources(type, { 
            patient: patientId, 
            _count: type === 'Observation' ? 20 : 10,
            _sort: type === 'Observation' ? '-date' : '-recorded-date'
          })
        ));
      } else {
        // Default critical priority
        await fetchPatientBundle(patientId, false, 'critical');
      }
    } catch (error) {
      // Silent fail for cache warming
    }
  }, [fetchPatientBundle, searchResources]);

  const isCacheWarm = useCallback((patientId, resourceTypes = ['Condition', 'MedicationRequest']) => {
    if (!state.relationships[patientId]) return false;
    
    return resourceTypes.every(type => 
      state.relationships[patientId][type] && 
      state.relationships[patientId][type].length > 0
    );
  }, [state.relationships]);

  // Utility Functions
  const isResourceLoading = useCallback((resourceType) => {
    return state.loading[resourceType] || false;
  }, [state.loading]);

  const getError = useCallback((resourceType) => {
    return state.errors[resourceType] || null;
  }, [state.errors]);

  const clearCache = useCallback((cacheType = null) => {
    if (cacheType) {
      dispatch({ type: FHIR_ACTIONS.INVALIDATE_CACHE, payload: { cacheType } });
    } else {
      // Clear all caches
      Object.keys(state.cache).forEach(type => {
        dispatch({ type: FHIR_ACTIONS.INVALIDATE_CACHE, payload: { cacheType: type } });
      });
    }
  }, [state.cache]);

  const refreshPatientResources = useStableCallback(async (patientId) => {
    try {
      
      // Clear the patient bundle cache
      const cacheKey = `patient_bundle_${patientId}`;
      dispatch({ type: FHIR_ACTIONS.INVALIDATE_CACHE, payload: { cacheType: 'bundles', key: cacheKey } });
      
      // Clear the relationships for this patient to ensure fresh data
      dispatch({ type: FHIR_ACTIONS.SET_RELATIONSHIPS, payload: { patientId, relationships: {} } });
      
      // Clear related search caches
      const resourceTypes = [
        'Encounter', 'Condition', 'Observation', 'MedicationRequest', 
        'Procedure', 'DiagnosticReport', 'AllergyIntolerance', 'Immunization',
        'CarePlan', 'CareTeam', 'Coverage', 'DocumentReference', 'ImagingStudy'
      ];
      
      resourceTypes.forEach(resourceType => {
        let params = { patient: patientId, _count: 1000 };
        
        // Add appropriate sort parameters for each resource type
        switch (resourceType) {
          case 'Procedure':
            params._sort = '-performed-date';
            break;
          case 'Observation':
            params._sort = '-date';
            break;
          case 'Encounter':
            params._sort = '-date';
            break;
          case 'MedicationRequest':
            params._sort = '-authored';
            break;
          case 'Condition':
            params._sort = '-recorded-date';
            break;
          case 'DiagnosticReport':
            params._sort = '-date';
            break;
          case 'DocumentReference':
            params._sort = '-date';
            break;
          case 'ImagingStudy':
            params._sort = '-started';
            break;
          case 'AllergyIntolerance':
            params._sort = '-date';
            break;
          case 'Immunization':
            params._sort = '-date';
            break;
          default:
            // Most resources use -date as default
            params._sort = '-date';
        }
        
        const searchKey = `${resourceType}_${JSON.stringify(params)}`;
        dispatch({ type: FHIR_ACTIONS.INVALIDATE_CACHE, payload: { cacheType: 'searches', key: searchKey } });
      });
      
      // Force refresh the patient bundle
      await fetchPatientBundle(patientId, true);
      
    } catch (error) {
      
      throw error;
    }
  });

  // Listen for refresh events from fhirService - no function dependencies
  useEffect(() => {
    const handleResourcesUpdated = (event) => {
      const { patientId } = event.detail;
      if (patientId && state.currentPatient && state.currentPatient.id === patientId) {
        refreshPatientResources(patientId);
      }
    };

    window.addEventListener('fhir-resources-updated', handleResourcesUpdated);
    return () => {
      window.removeEventListener('fhir-resources-updated', handleResourcesUpdated);
    };
  }, [state.currentPatient?.id]); // Only depend on patient ID, not the function

  // Context Value
  const contextValue = {
    // State
    ...state,
    
    // Resource Management
    setResources,
    addResource,
    updateResource,
    removeResource,
    getResource,
    getResourcesByType,
    getPatientResources,
    
    // FHIR Operations
    fetchResource,
    searchResources,
    fetchPatientBundle,
    refreshPatientResources,
    
    // Patient Context
    setCurrentPatient,
    setCurrentEncounter,
    
    // Utilities
    isResourceLoading,
    getError,
    clearCache,
    getCachedData,
    setCachedData,
    
    // Cache coordination
    warmPatientCache,
    isCacheWarm
  };

  return (
    <FHIRResourceContext.Provider value={contextValue}>
      {children}
    </FHIRResourceContext.Provider>
  );
}

// Hook for using the context
export function useFHIRResource() {
  const context = useContext(FHIRResourceContext);
  if (!context) {
    throw new Error('useFHIRResource must be used within a FHIRResourceProvider');
  }
  return context;
}

// Convenience hooks for specific resource types
export function usePatient(patientId) {
  const { getResource, fetchResource, setCurrentPatient, currentPatient } = useFHIRResource();
  
  const patient = patientId ? getResource('Patient', patientId) : currentPatient;
  
  const loadPatient = useCallback(async (id) => {
    if (id) {
      return await setCurrentPatient(id);
    }
  }, [setCurrentPatient]);

  return { patient, loadPatient };
}

export function usePatientResources(patientId, resourceType = null) {
  const { getPatientResources, fetchPatientBundle, isLoading } = useFHIRResource();
  
  const resources = getPatientResources(patientId, resourceType);
  const loading = isLoading(resourceType || 'Patient');
  
  const loadResources = useCallback(async (forceRefresh = false) => {
    if (patientId) {
      return await fetchPatientBundle(patientId, forceRefresh);
    }
  }, [patientId, fetchPatientBundle]);

  return { resources, loading, loadResources };
}

export default FHIRResourceContext;