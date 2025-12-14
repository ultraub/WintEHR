import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import { fhirClient } from '../core/fhir/services/fhirClient';
import { intelligentCache } from '../core/fhir/utils/intelligentCache';
import { useStableCallback } from '../hooks/ui/useStableReferences';
import performanceMonitor from '../utils/performanceMonitor';

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
    
    case FHIR_ACTIONS.ADD_RESOURCE: {
      const { resourceType, resource } = action.payload;
      
      // Validate resource exists and has an id
      if (!resource || !resource.id) {
        // ADD_RESOURCE: Resource is missing or has no id
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

// Standardize response format across all components
const standardizeResponse = (result) => {
  // Handle null/undefined
  if (!result) {
    return { resources: [], total: 0, bundle: null };
  }

  // Already standardized format
  if (result.resources !== undefined && result.total !== undefined) {
    return result;
  }

  // Array format
  if (Array.isArray(result)) {
    return {
      resources: result,
      total: result.length,
      bundle: {
        resourceType: 'Bundle',
        type: 'searchset',
        total: result.length,
        entry: result.map(r => ({ resource: r }))
      }
    };
  }

  // Direct Bundle format
  if (result.resourceType === 'Bundle') {
    const resources = result.entry?.map(e => e.resource).filter(Boolean) || [];
    return {
      resources: resources,
      total: result.total || resources.length,
      bundle: result
    };
  }

  // Single resource
  if (result.resourceType) {
    return {
      resources: [result],
      total: 1,
      bundle: {
        resourceType: 'Bundle',
        type: 'searchset',
        total: 1,
        entry: [{ resource: result }]
      }
    };
  }

  // Fallback
  return { resources: [], total: 0, bundle: null };
};

// Create Context
const FHIRResourceContext = createContext();

// Provider Component
export function FHIRResourceProvider({ children }) {
  const [state, dispatch] = useReducer(fhirResourceReducer, initialState);
  
  // Track in-flight requests to prevent duplicates
  const inFlightRequests = useRef(new Map());
  // Track timeouts for cleanup
  const timeoutRefs = useRef(new Set());
  // Memoization for getPatientResources to prevent duplicate calculations
  const getPatientResourcesMemo = useRef(new Map());
  // Request coalescing for identical concurrent requests
  const coalescedRequests = useRef(new Map());

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

  // Cleanup old resources to prevent memory growth - more aggressive
  const cleanupOldResources = useCallback(() => {
    const MAX_RESOURCES_PER_TYPE = 50; // Reduced from 200 to 50
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
          type: FHIR_ACTIONS.CLEAR_RESOURCES,
          payload: { resourceType }
        });
        
        dispatch({
          type: FHIR_ACTIONS.SET_RESOURCES,
          payload: { resourceType, resources: Object.values(newResourceMap) }
        });
      }
    });
  }, [state.resources]);

  // Resource Management Functions
  const setResources = useCallback((resourceType, resources) => {
    dispatch({
      type: FHIR_ACTIONS.SET_RESOURCES,
      payload: { resourceType, resources }
    });
    
    // Trigger cleanup if needed - more aggressive threshold
    const resourceCount = Object.keys(state.resources[resourceType] || {}).length;
    if (resourceCount > 30) { // Reduced from 150 to 30
      setTimeout(cleanupOldResources, 0);
    }
  }, [state.resources, cleanupOldResources]);

  const addResource = useCallback((resourceType, resource) => {
    dispatch({
      type: FHIR_ACTIONS.ADD_RESOURCE,
      payload: { resourceType, resource }
    });
    
    // Add relationship if patient context exists
    if (state.currentPatient && (resource.subject?.reference === `Patient/${state.currentPatient.id}` || resource.subject?.reference === `urn:uuid:${state.currentPatient.id}`)) {
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
    // Check memoization cache first
    const memoKey = `${patientId}-${resourceType || 'all'}`;
    const cached = getPatientResourcesMemo.current.get(memoKey);
    
    // Check if cached result is still valid
    if (cached) {
      const currentRelationships = state.relationships[patientId];
      const currentResources = resourceType ? state.resources[resourceType] : state.resources;
      
      // Use simple comparison for validity check
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
      const resources = resourceIds.map(id => {
        const resource = state.resources[resourceType]?.[id];
        return resource;
      }).filter(Boolean);
      
      
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

    // Cache the result for all resources
    getPatientResourcesMemo.current.set(memoKey, {
      result: allResources,
      relationships: state.relationships[patientId],
      resources: state.resources
    });

    return allResources;
  }, [state.resources, state.relationships]);

  // FHIR Operations with Caching
  const fetchResource = useCallback(async (resourceType, resourceId, forceRefresh = false) => {
    const cacheKey = `${resourceType}/${resourceId}`;
    const requestKey = `fetch_${cacheKey}`;
    
    // Check for in-flight request
    const existingRequest = inFlightRequests.current.get(requestKey);
    if (existingRequest && !forceRefresh) {
      return existingRequest;
    }
    
    if (!forceRefresh) {
      const cached = getCachedData('resources', cacheKey);
      if (cached) {
        // Track cache hit
        performanceMonitor.recordMetric('fhirFetch', {
          resourceType,
          resourceId,
          duration: 0,
          cached: true,
          status: 'cache-hit'
        });
        return cached;
      }
    }

    dispatch({ type: FHIR_ACTIONS.SET_LOADING, payload: { resourceType, loading: true } });
    dispatch({ type: FHIR_ACTIONS.CLEAR_ERROR, payload: { resourceType } });

    const fetchPromise = (async () => {
      const startTime = performance.now();
      try {
        const resource = await fhirClient.read(resourceType, resourceId);
      
      addResource(resourceType, resource);
      setCachedData('resources', cacheKey, resource, 600000, resourceType); // 10 minute default
      
        // Track performance
        const duration = performance.now() - startTime;
        performanceMonitor.recordMetric('fhirFetch', {
          resourceType,
          resourceId,
          duration,
          cached: false,
          status: 'success'
        });
      
        return resource;
      } catch (error) {
        // Track error
        const duration = performance.now() - startTime;
        performanceMonitor.recordMetric('fhirFetch', {
          resourceType,
          resourceId,
          duration,
          cached: false,
          status: 'error',
          error: error.message
        });
        
        dispatch({ type: FHIR_ACTIONS.SET_ERROR, payload: { resourceType, error: error.message } });
        throw error;
      } finally {
        dispatch({ type: FHIR_ACTIONS.SET_LOADING, payload: { resourceType, loading: false } });
        inFlightRequests.current.delete(requestKey);
      }
    })();
    
    inFlightRequests.current.set(requestKey, fetchPromise);
    return fetchPromise;
  }, [getCachedData, setCachedData, addResource]);

  const searchResources = useCallback(async (resourceType, params = {}, forceRefresh = false) => {
    // Add automatic _include for MedicationRequest to reduce separate fetches
    const enhancedParams = { ...params };
    if (resourceType === 'MedicationRequest' && !params._include) {
      enhancedParams._include = 'MedicationRequest:medication';
    }
    
    const searchKey = `${resourceType}_${JSON.stringify(enhancedParams)}`;
    const requestKey = `search_${searchKey}`;
    
    // Check for in-flight request first
    const existingRequest = inFlightRequests.current.get(requestKey);
    if (existingRequest && !forceRefresh) {
      return existingRequest;
    }
    
    if (!forceRefresh) {
      const cached = getCachedData('searches', searchKey);
      if (cached) {
        setResources(resourceType, cached.resources);
        // Track cache hit
        performanceMonitor.recordMetric('fhirSearch', {
          resourceType,
          params: enhancedParams,
          duration: 0,
          cached: true,
          status: 'cache-hit',
          resultCount: cached.resources ? cached.resources.length : 0
        });
        return cached;
      }
    }

    dispatch({ type: FHIR_ACTIONS.SET_LOADING, payload: { resourceType, loading: true } });
    dispatch({ type: FHIR_ACTIONS.CLEAR_ERROR, payload: { resourceType } });

    // Create the promise and store it
    const searchPromise = (async () => {
      const startTime = performance.now();
      try {
        const rawResult = await fhirClient.search(resourceType, enhancedParams);
        
        // Standardize the response
        const result = standardizeResponse(rawResult);
      
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
      
      // Process included resources from _include parameter
      if (result.bundle?.entry) {
        const includedResources = {};
        
        result.bundle.entry.forEach(entry => {
          const resource = entry.resource;
          if (!resource || !resource.resourceType) return;
          
          // Skip the main resources we already processed
          if (resource.resourceType === resourceType) return;
          
          // Group included resources by type
          if (!includedResources[resource.resourceType]) {
            includedResources[resource.resourceType] = [];
          }
          includedResources[resource.resourceType].push(resource);
        });
        
        // Add included resources to state
        Object.entries(includedResources).forEach(([includedType, resources]) => {
          setResources(includedType, resources);
        });

        // Store included resources info in result for easy access
        result.includedResources = includedResources;

        // Enrich MedicationRequest resources with resolved medication names
        if (resourceType === 'MedicationRequest' && includedResources.Medication?.length > 0) {
          const medicationLookup = {};
          includedResources.Medication.forEach(med => {
            if (med.id) {
              medicationLookup[med.id] = med;
            }
          });

          // Update MedicationRequests that use medicationReference
          result.resources = result.resources.map(medRequest => {
            if (medRequest.medicationReference && !medRequest.medicationCodeableConcept) {
              const refId = medRequest.medicationReference.reference?.replace('Medication/', '');
              const medication = medicationLookup[refId];
              if (medication?.code) {
                // Add resolved medication name as medicationCodeableConcept for display
                return {
                  ...medRequest,
                  _resolvedMedicationCodeableConcept: medication.code,
                  medicationReference: {
                    ...medRequest.medicationReference,
                    display: medication.code.text || medication.code.coding?.[0]?.display
                  }
                };
              }
            }
            return medRequest;
          });

          // Update state with enriched resources
          setResources(resourceType, result.resources);
        }
      }
      
      setCachedData('searches', searchKey, result, 300000, resourceType); // 5 minute cache for searches
      dispatch({ type: FHIR_ACTIONS.SET_SEARCH_RESULTS, payload: { searchKey, results: result } });
      
        // Track performance
        const duration = performance.now() - startTime;
        performanceMonitor.recordMetric('fhirSearch', {
          resourceType,
          params: enhancedParams,
          duration,
          cached: false,
          status: 'success',
          resultCount: result.resources ? result.resources.length : 0
        });
      
        return result;
      } catch (error) {
        // Track error
        const duration = performance.now() - startTime;
        performanceMonitor.recordMetric('fhirSearch', {
          resourceType,
          params: enhancedParams,
          duration,
          cached: false,
          status: 'error',
          error: error.message
        });
        
        dispatch({ type: FHIR_ACTIONS.SET_ERROR, payload: { resourceType, error: error.message } });
        throw error;
      } finally {
        dispatch({ type: FHIR_ACTIONS.SET_LOADING, payload: { resourceType, loading: false } });
        // Clean up in-flight request
        inFlightRequests.current.delete(requestKey);
      }
    })();
    
    // Store the promise
    inFlightRequests.current.set(requestKey, searchPromise);
    
    return searchPromise;
  }, [getCachedData, setCachedData, setResources]);

  // Enhanced search with automatic _include support
  const searchWithInclude = useCallback(async (resourceType, params = {}, includes = [], forceRefresh = false) => {
    const enhancedParams = { ...params };
    
    // Add _include parameters
    if (includes.length > 0) {
      enhancedParams._include = includes.join(',');
    }
    
    // Use standard searchResources which now handles _include
    return searchResources(resourceType, enhancedParams, forceRefresh);
  }, [searchResources]);

  // New optimized $everything-based patient bundle fetch
  const fetchPatientEverything = useCallback(async (patientId, options = {}) => {
    const { 
      types = null, 
      since = null, 
      count = 50, // Reduced default from 200 to 50
      offset = 0,
      forceRefresh = false,
      autoSince = true // Auto-calculate _since if not provided
    } = options;
    
    // Build cache key from parameters
    const cacheKey = `patient_everything_${patientId}_${types || 'all'}_${since || 'all'}_${count}_${offset}`;
    const requestKey = `everything_${cacheKey}`;
    
    // Check for in-flight request
    const existingRequest = inFlightRequests.current.get(requestKey);
    if (existingRequest && !forceRefresh) {
      return existingRequest;
    }
    
    // Check cache
    if (!forceRefresh) {
      const cached = getCachedData('everything', cacheKey);
      if (cached) {
        return cached;
      }
    }
    
    // Build $everything parameters
    const params = new URLSearchParams();
    if (types) {
      params.append('_type', Array.isArray(types) ? types.join(',') : types);
    }
    
    // Auto-calculate _since parameter for better performance
    let effectiveSince = since;
    if (!since && autoSince) {
      // Default to last 3 months for initial load
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      effectiveSince = threeMonthsAgo.toISOString();
    }
    if (effectiveSince) {
      params.append('_since', effectiveSince);
    }
    
    params.append('_count', count);
    if (offset > 0) {
      params.append('_offset', offset);
    }
    
    const everythingPromise = (async () => {
      try {
        dispatch({ type: FHIR_ACTIONS.SET_GLOBAL_LOADING, payload: true });
        
        // Call $everything operation with query parameters
        const url = `/Patient/${patientId}/$everything${params.toString() ? `?${params.toString()}` : ''}`;
        const response = await fhirClient.httpClient.get(url);
        
        // Check if response is already standardized by interceptor
        let bundle;
        if (response.data && response.data.resources !== undefined && response.data.bundle !== undefined) {
          // Response was already transformed by standardizeResponse interceptor
          bundle = response.data.bundle;
        } else {
          bundle = response.data || response;
        }
        
        
        // Process bundle entries and update state
        const resourcesByType = {};
        if (bundle.entry && bundle.entry.length > 0) {
          bundle.entry.forEach((entry, index) => {
            const resource = entry.resource;
            if (!resource || !resource.resourceType) return;
            
            if (!resourcesByType[resource.resourceType]) {
              resourcesByType[resource.resourceType] = [];
            }
            resourcesByType[resource.resourceType].push(resource);
          });
          
          // Update state for each resource type
          Object.entries(resourcesByType).forEach(([resourceType, resources]) => {
            setResources(resourceType, resources);
            
            // Update relationships
            resources.forEach(resource => {
              
              // Check various reference patterns that FHIR resources use
              // Different resource types use different fields to reference patients
              let patientRef = null;
              
              // Common patterns for patient references in FHIR
              if (resource.subject?.reference) {
                patientRef = resource.subject.reference;
              } else if (resource.patient?.reference) {
                patientRef = resource.patient.reference;
              } else if (resource.performer?.reference) {
                patientRef = resource.performer.reference;
              } else if (resource.actor?.reference) {
                patientRef = resource.actor.reference;
              } else if (resource.for?.reference) {
                patientRef = resource.for.reference;
              } else if (resource.beneficiary?.reference) {
                patientRef = resource.beneficiary.reference;
              } else if (resource.individual?.reference) {
                patientRef = resource.individual.reference;
              }
              
              // Some resources might have direct patient ID without 'reference' wrapper
              if (!patientRef && resource.subject && typeof resource.subject === 'string') {
                patientRef = resource.subject;
              }
              if (!patientRef && resource.patient && typeof resource.patient === 'string') {
                patientRef = resource.patient;
              }
              
              
              // Extract patient ID from reference (handles both "Patient/123" and "123" formats)
              let referencesThisPatient = false;
              if (patientRef) {
                // Handle different reference formats:
                // 1. "Patient/123" - standard FHIR reference
                // 2. "123" - just the ID
                // 3. Full URL references like "http://example.com/fhir/Patient/123"
                // 4. "urn:uuid:123" - URN format (common in Synthea imports)
                
                // Handle URN format: urn:uuid:patient-id
                if (patientRef.startsWith('urn:uuid:')) {
                  const urnId = patientRef.substring('urn:uuid:'.length);
                  referencesThisPatient = urnId === patientId;
                } else if (patientRef.includes('/')) {
                  // Handle standard FHIR references like "Patient/123"
                  const refParts = patientRef.split('/');
                  const refId = refParts[refParts.length - 1];
                  referencesThisPatient = refId === patientId;
                } else {
                  // Direct ID comparison
                  referencesThisPatient = patientRef === patientId;
                }
                
                // Also check if the reference is in the format "Patient/[patientId]"
                if (!referencesThisPatient) {
                  referencesThisPatient = patientRef === `Patient/${patientId}`;
                }
                
              }
              
              // For resources from $everything, they should all belong to this patient
              // If no reference found, but we're processing from $everything, assume it belongs to the patient
              if (!patientRef && !referencesThisPatient) {
                // Some resources from $everything might not have explicit patient references
                // but are still related to the patient (e.g., some Organizations, Practitioners)
                // For clinical resources, we should still establish the relationship
                const clinicalResourceTypes = [
                  'Condition', 'MedicationRequest', 'Observation', 'Procedure',
                  'AllergyIntolerance', 'Immunization', 'DiagnosticReport',
                  'Encounter', 'CarePlan', 'CareTeam', 'Goal', 'DocumentReference'
                ];
                
                // For clinical resources from $everything, assume they belong to the patient
                if (clinicalResourceTypes.includes(resource.resourceType)) {
                  referencesThisPatient = true;
                }
              }
              
              // Also check if this is the patient resource itself
              if (resource.resourceType === 'Patient' && resource.id === patientId) {
                referencesThisPatient = true;
              }
              
              if (referencesThisPatient) {
                dispatch({
                  type: FHIR_ACTIONS.ADD_RELATIONSHIP,
                  payload: {
                    patientId,
                    resourceType,
                    resourceId: resource.id
                  }
                });
              }
            });
          });
        }
        
        // Cache the bundle with metadata
        const result = {
          bundle,
          total: bundle.total || 0,
          hasMore: bundle.link?.some(link => link.relation === 'next') || false,
          resourceTypes: Object.keys(resourcesByType || {}),
          timestamp: new Date().toISOString()
        };
        
        setCachedData('everything', cacheKey, result, 600000, 'Bundle'); // 10 min cache
        
        dispatch({ type: FHIR_ACTIONS.SET_GLOBAL_LOADING, payload: false });
        return result;
        
      } catch (error) {
        dispatch({ type: FHIR_ACTIONS.SET_GLOBAL_LOADING, payload: false });
        dispatch({ type: FHIR_ACTIONS.SET_ERROR, payload: { resourceType: 'Bundle', error: error.message } });
        throw error;
      } finally {
        inFlightRequests.current.delete(requestKey);
      }
    })();
    
    inFlightRequests.current.set(requestKey, everythingPromise);
    return everythingPromise;
  }, [setCachedData, getCachedData, setResources]);

  // Optimized fetchPatientBundle using FHIR batch requests
  const fetchPatientBundle = useCallback(async (patientId, forceRefresh = false, priority = 'all') => {
    // Map priority to resource types for backward compatibility
    const resourceTypesByPriority = {
      critical: ['Patient', 'Encounter', 'Condition', 'MedicationRequest', 'AllergyIntolerance'],
      important: ['Observation', 'Procedure', 'DiagnosticReport', 'Coverage', 'DocumentReference'],
      optional: ['Immunization', 'CarePlan', 'CareTeam', 'ImagingStudy']
    };
    
    let types;
    if (priority === 'critical') {
      types = resourceTypesByPriority.critical;
    } else if (priority === 'important') {
      types = [...resourceTypesByPriority.critical, ...resourceTypesByPriority.important];
    } else {
      types = [...resourceTypesByPriority.critical, ...resourceTypesByPriority.important, ...resourceTypesByPriority.optional];
    }

    const cacheKey = `patient_bundle_batch_${patientId}_${priority}`;
    const requestKey = `batch_${cacheKey}`;
    
    // Check for in-flight request
    const existingRequest = inFlightRequests.current.get(requestKey);
    if (existingRequest && !forceRefresh) {
      return existingRequest;
    }
    
    // Check cache
    if (!forceRefresh) {
      const cached = getCachedData('bundles', cacheKey);
      if (cached) {
        return cached;
      }
    }
    
    const batchPromise = (async () => {
      try {
        dispatch({ type: FHIR_ACTIONS.SET_GLOBAL_LOADING, payload: true });
        
        // Build batch requests
        const batchRequests = types.map(resourceType => {
          if (resourceType === 'Patient') {
            return {
              method: 'GET',
              url: `Patient/${patientId}`
            };
          } else {
            // Build search URL with parameters
            const params = new URLSearchParams();
            params.append('patient', patientId);
            // Set base count - will be overridden by resource-specific logic if needed
            const baseCount = priority === 'critical' ? '20' : (priority === 'all' ? '100' : '50');
            params.append('_count', baseCount);
            
            // Add resource-specific parameters with enhanced limits for comprehensive data
            if (resourceType === 'Observation') {
              params.set('_sort', '-date');
              // Increased count and removed date restriction for Chart Review
              params.set('_count', priority === 'all' ? '200' : '30');
              // Only apply date restriction for non-comprehensive fetches
              if (priority !== 'all') {
                const sixMonthsAgo = new Date();
                sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
                params.append('date', `ge${sixMonthsAgo.toISOString().split('T')[0]}`);
              }
            } else if (resourceType === 'Encounter') {
              params.set('_sort', '-date');
              params.set('_count', priority === 'all' ? '100' : '10');
            } else if (resourceType === 'MedicationRequest') {
              params.set('_sort', '-authoredon');
              // Include referenced Medication resources for proper name resolution
              params.set('_include', 'MedicationRequest:medication');
              // Increased count for comprehensive medication history
              if (priority === 'all') {
                params.set('_count', '100');
              }
            } else if (resourceType === 'Condition') {
              params.set('_sort', '-recorded-date');
              // Increased count for comprehensive condition history
              if (priority === 'all') {
                params.set('_count', '100');
              }
            } else if (resourceType === 'DiagnosticReport') {
              params.set('_sort', '-date');
              // Only apply date restriction for non-comprehensive fetches
              if (priority !== 'all') {
                const oneYearAgo = new Date();
                oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
                params.append('date', `ge${oneYearAgo.toISOString().split('T')[0]}`);
              } else {
                params.set('_count', '100');
              }
            } else if (priority === 'all') {
              // For comprehensive mode, increase count for all other resource types
              params.set('_count', '100');
            }
            
            return {
              method: 'GET',
              url: `${resourceType}?${params.toString()}`
            };
          }
        });
        
        // Execute batch request
        const batchResult = await fhirClient.batch(batchRequests);
        
        // Process batch response
        const resourcesByType = {};
        let totalResources = 0;
        
        if (batchResult.entry && batchResult.results) {
          batchResult.entry.forEach((entry, index) => {
            const result = batchResult.results[index];
            
            if (result.success && entry.resource) {
              const resource = entry.resource;
              
              if (resource.resourceType === 'Bundle') {
                // This is a search result bundle
                const searchResults = resource.entry?.map(e => e.resource) || [];
                searchResults.forEach(res => {
                  if (!resourcesByType[res.resourceType]) {
                    resourcesByType[res.resourceType] = [];
                  }
                  resourcesByType[res.resourceType].push(res);
                  totalResources++;
                });
              } else {
                // This is a direct resource (Patient)
                if (!resourcesByType[resource.resourceType]) {
                  resourcesByType[resource.resourceType] = [];
                }
                resourcesByType[resource.resourceType].push(resource);
                totalResources++;
              }
            }
          });

          // Enrich MedicationRequest resources with resolved medication names
          if (resourcesByType.MedicationRequest?.length > 0 && resourcesByType.Medication?.length > 0) {
            const medicationLookup = {};
            resourcesByType.Medication.forEach(med => {
              if (med.id) {
                medicationLookup[med.id] = med;
              }
            });

            // Update MedicationRequests that use medicationReference
            resourcesByType.MedicationRequest = resourcesByType.MedicationRequest.map(medRequest => {
              if (medRequest.medicationReference && !medRequest.medicationCodeableConcept) {
                const refId = medRequest.medicationReference.reference?.replace('Medication/', '');
                const medication = medicationLookup[refId];
                if (medication?.code) {
                  return {
                    ...medRequest,
                    _resolvedMedicationCodeableConcept: medication.code,
                    medicationReference: {
                      ...medRequest.medicationReference,
                      display: medication.code.text || medication.code.coding?.[0]?.display
                    }
                  };
                }
              }
              return medRequest;
            });
          }

          // Update state with all resources and relationships
          Object.entries(resourcesByType).forEach(([resourceType, resources]) => {
            setResources(resourceType, resources);
            
            
            // Update relationships
            resources.forEach(resource => {
              // Check for both standard FHIR references and URN format (used by Synthea)
              const subjectRef = resource.subject?.reference;
              const patientRef = resource.patient?.reference;
              
              
              // Since we searched with patient=${patientId}, all returned resources belong to this patient
              // This handles URN references and any other reference format
              const hasPatientReference = true;
              
                
                
              if (hasPatientReference) {
                dispatch({
                  type: FHIR_ACTIONS.ADD_RELATIONSHIP,
                  payload: {
                    patientId,
                    resourceType,
                    resourceId: resource.id
                  }
                });
                
              }
            });
          });
        }
        
        const result = { 
          success: true, 
          total: totalResources,
          resourceTypes: types,
          resourcesByType
        };
        
        // Cache the result
        setCachedData('bundles', cacheKey, result, 600000, 'Bundle'); // 10 min cache
        
        dispatch({ type: FHIR_ACTIONS.SET_GLOBAL_LOADING, payload: false });
        return result;
        
      } catch (error) {
        dispatch({ type: FHIR_ACTIONS.SET_GLOBAL_LOADING, payload: false });
        
        // Fallback to individual requests if batch fails
        // Batch request failed - falling back to individual requests
        
        // Use the original individual fetch approach
        const promises = types.map(async (resourceType) => {
          if (resourceType === 'Patient') {
            const patient = await fetchResource('Patient', patientId, forceRefresh);
            if (patient) {
              setResources('Patient', [patient]);
            }
            return patient;
          } else {
            const params = { 
              patient: patientId,
              _count: priority === 'critical' ? 20 : 50
            };
            
            if (resourceType === 'Observation') {
              params._sort = '-date';
              params._count = 30;
            }
            
            const result = await searchResources(resourceType, params, forceRefresh);
            return result;
          }
        });
        
        await Promise.all(promises);
        
        let totalResources = 0;
        types.forEach(type => {
          const resourceCount = Object.keys(state.resources[type] || {}).filter(id => {
            const resource = state.resources[type][id];
            return resource.patient?.reference === `Patient/${patientId}` ||
                   resource.patient?.reference === `urn:uuid:${patientId}` ||
                   resource.subject?.reference === `Patient/${patientId}` ||
                   resource.subject?.reference === `urn:uuid:${patientId}`;
          }).length;
          totalResources += resourceCount;
        });
        
        return { 
          success: true, 
          total: totalResources,
          resourceTypes: types 
        };
      } finally {
        inFlightRequests.current.delete(requestKey);
      }
    })();
    
    inFlightRequests.current.set(requestKey, batchPromise);
    return batchPromise;
  }, [fetchResource, searchResources, setResources, state.resources, setCachedData, getCachedData]);

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
        // Try to use $everything first for optimal performance
        try {
          await fetchPatientEverything(patientId, {
            types: ['Condition', 'MedicationRequest', 'AllergyIntolerance', 'Observation', 'Encounter'],
            count: 100,
            autoSince: true, // Last 3 months
            forceRefresh: false
          });
        } catch (everythingError) {
          // Fall back to batch bundle if $everything fails
          // Patient $everything failed in setCurrentPatient - using batch bundle fallback
          await fetchPatientBundle(patientId, false, 'critical');
        }
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

  // Cache coordination utilities - optimized with batch requests
  const warmPatientCache = useCallback(async (patientId, priority = 'critical') => {
    // Pre-warm cache for faster subsequent loads
    const cacheKey = `warm_cache_${patientId}_${priority}`;
    const requestKey = `warm_${cacheKey}`;
    
    // Check for in-flight warming request
    const existingRequest = inFlightRequests.current.get(requestKey);
    if (existingRequest) {
      return existingRequest;
    }
    
    const warmingPromise = (async () => {
      try {
        if (priority === 'all' || priority === 'critical') {
          // Use the optimized batch bundle fetch
          await fetchPatientBundle(patientId, false, priority);
        } else if (priority === 'summary') {
          // For summary view, use batch to get exactly what we need
          // This ensures we get ALL conditions, meds, and allergies, not limited by observation count
          const summaryTypes = ['Patient', 'Condition', 'MedicationRequest', 'AllergyIntolerance', 'Observation', 'Encounter', 'Procedure', 'DiagnosticReport', 'Immunization'];
          
          // Build targeted batch requests with appropriate limits
          const batchRequests = summaryTypes.map(resourceType => {
            if (resourceType === 'Patient') {
              return {
                method: 'GET',
                url: `Patient/${patientId}`
              };
            } else {
              const params = new URLSearchParams();
              params.append('patient', patientId);
              
              // Resource-specific limits to ensure we get all critical data
              if (resourceType === 'Condition') {
                params.append('_count', '50'); // Get all conditions
                params.append('_sort', '-recorded-date');
              } else if (resourceType === 'MedicationRequest') {
                params.append('_count', '50'); // Get all medications
                params.append('_sort', '-authoredon');
                params.append('_include', 'MedicationRequest:medication'); // Include referenced Medication resources
              } else if (resourceType === 'AllergyIntolerance') {
                params.append('_count', '20'); // Get all allergies
                params.append('_sort', '-date');
              } else if (resourceType === 'Observation') {
                params.append('_count', '30'); // Limited vitals for summary
                params.append('_sort', '-date');
                params.append('category', 'vital-signs'); // Only vital signs for summary
              } else if (resourceType === 'Encounter') {
                params.append('_count', '10'); // Recent encounters
                params.append('_sort', '-date');
              } else if (resourceType === 'Procedure') {
                params.append('_count', '10'); // Recent procedures
                params.append('_sort', '-performed-date');
              } else if (resourceType === 'DiagnosticReport') {
                params.append('_count', '10'); // Recent lab reports
                params.append('_sort', '-date');
                params.append('category', 'LAB'); // Focus on lab reports
              } else if (resourceType === 'Immunization') {
                params.append('_count', '20'); // Get all immunizations
                params.append('_sort', '-occurrence-date');
              }
              
              return {
                method: 'GET',
                url: `${resourceType}?${params.toString()}`
              };
            }
          });
          
          // Execute batch request
          const batchResult = await fhirClient.batch(batchRequests);
          
          // Process the batch response using existing logic
          if (batchResult.entry && batchResult.results) {
            const resourcesByType = {};
            batchResult.entry.forEach((entry, index) => {
              const result = batchResult.results[index];
              if (result.success && entry.resource) {
                const resource = entry.resource;
                if (resource.resourceType === 'Bundle') {
                  const searchResults = resource.entry?.map(e => e.resource) || [];
                  searchResults.forEach(res => {
                    if (!resourcesByType[res.resourceType]) {
                      resourcesByType[res.resourceType] = [];
                    }
                    resourcesByType[res.resourceType].push(res);
                  });
                } else {
                  if (!resourcesByType[resource.resourceType]) {
                    resourcesByType[resource.resourceType] = [];
                  }
                  resourcesByType[resource.resourceType].push(resource);
                }
              }
            });
            
            // Enrich MedicationRequest resources with resolved medication names
            if (resourcesByType.MedicationRequest?.length > 0 && resourcesByType.Medication?.length > 0) {
              const medicationLookup = {};
              resourcesByType.Medication.forEach(med => {
                if (med.id) {
                  medicationLookup[med.id] = med;
                }
              });

              // Update MedicationRequests that use medicationReference
              resourcesByType.MedicationRequest = resourcesByType.MedicationRequest.map(medRequest => {
                if (medRequest.medicationReference && !medRequest.medicationCodeableConcept) {
                  const refId = medRequest.medicationReference.reference?.replace('Medication/', '');
                  const medication = medicationLookup[refId];
                  if (medication?.code) {
                    return {
                      ...medRequest,
                      _resolvedMedicationCodeableConcept: medication.code,
                      medicationReference: {
                        ...medRequest.medicationReference,
                        display: medication.code.text || medication.code.coding?.[0]?.display
                      }
                    };
                  }
                }
                return medRequest;
              });
            }

            // Update state with resources
            Object.entries(resourcesByType).forEach(([resourceType, resources]) => {
              setResources(resourceType, resources);


              resources.forEach(resource => {
                // Check for both standard FHIR references and URN format (used by Synthea)
                const subjectRef = resource.subject?.reference;
                const patientRef = resource.patient?.reference;
                
                
                const hasPatientReference = 
                  resource.subject?.reference === `Patient/${patientId}` ||
                  resource.subject?.reference === `urn:uuid:${patientId}` ||
                  resource.patient?.reference === `Patient/${patientId}` ||
                  resource.patient?.reference === `urn:uuid:${patientId}` ||
                  resource.resourceType === 'Patient';
                  
                  
                if (hasPatientReference) {
                  dispatch({
                    type: FHIR_ACTIONS.ADD_RELATIONSHIP,
                    payload: {
                      patientId,
                      resourceType,
                      resourceId: resource.id
                    }
                  });
                }
              });
            });
          }
        }
        
        return { success: true, patientId };
      } catch (error) {
        // Log but don't throw - cache warming should fail silently
        // Cache warming failed - fail silently
        return { success: false, patientId, error };
      } finally {
        inFlightRequests.current.delete(requestKey);
      }
    })();
    
    inFlightRequests.current.set(requestKey, warmingPromise);
    return warmingPromise;
  }, [fetchPatientBundle, fetchPatientEverything]);

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
        // Use smaller counts for refresh to prevent memory issues
        let refreshCount = 20; // Reduced default from 50 to 20
        if (resourceType === 'Observation') {
          refreshCount = 30; // Reduced from 100 to 30
        } else if (resourceType === 'Encounter' || resourceType === 'Condition') {
          refreshCount = 20; // Reduced from 30 to 20
        }
        let params = { patient: patientId, _count: refreshCount };
        
        // Add appropriate sort parameters for each resource type
        switch (resourceType) {
          case 'Procedure':
            params._sort = '-performed-date';
            break;
          case 'Observation':
            params._sort = '-date';
            // Add date filter for observations - last 6 months only
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
            params.date = `ge${sixMonthsAgo.toISOString().split('T')[0]}`;
            break;
          case 'Encounter':
            params._sort = '-date';
            break;
          case 'MedicationRequest':
            params._sort = '-authoredon';
            break;
          case 'Condition':
            params._sort = '-recorded-date';
            break;
          case 'DiagnosticReport':
            params._sort = '-date';
            // Add date filter for diagnostic reports - last year only
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
            params.date = `ge${oneYearAgo.toISOString().split('T')[0]}`;
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

  // Configure fhirClient interceptors on mount
  useEffect(() => {
    // Add response interceptor for consistent data format
    fhirClient.addResponseInterceptor((response) => {
      // Standardize FHIR responses automatically
      if (response.data && (
        response.data.resourceType === 'Bundle' || 
        Array.isArray(response.data) ||
        (response.data.resources !== undefined)
      )) {
        response.data = standardizeResponse(response.data);
      }
      return response;
    });

    // Add request interceptor for logging in development
    if (process.env.NODE_ENV === 'development') {
      fhirClient.addRequestInterceptor((config) => {
        // [FHIR Request] method url with params and data
        return config;
      });
    }

    // Add error interceptor for better error handling
    fhirClient.addErrorInterceptor(async (error) => {
      if (error.response?.status === 401) {
        // Handle unauthorized - could trigger re-authentication
        // [FHIR Auth Error] Unauthorized access - dispatch auth error event
        // Dispatch auth error event
        window.dispatchEvent(new CustomEvent('fhir-auth-error', { detail: { error } }));
      } else if (error.response?.status === 404) {
        // Handle not found with better message
        const resourceInfo = error.config?.url?.match(/\/([A-Za-z]+)\/([^/?]+)/);
        if (resourceInfo) {
          error.message = `${resourceInfo[1]} with ID ${resourceInfo[2]} not found`;
        }
      } else if (error.response?.status >= 500) {
        // Server errors
        // [FHIR Server Error] - status and response data
      }
      
      // Re-throw the error for handling by calling code
      throw error;
    });
  }, []); // Run once on mount

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
  }, [state.currentPatient?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // Missing deps: refreshPatientResources, state.currentPatient. Adding refreshPatientResources would cause
  // infinite loops. state.currentPatient?.id is sufficient to track patient changes

  // Clear memoization cache when relationships or resources change
  useEffect(() => {
    // Clear the memoization cache to ensure fresh data
    getPatientResourcesMemo.current.clear();
    
  }, [state.relationships, state.resources]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Create local copies of refs to avoid stale closure issues
      const timeouts = timeoutRefs.current;
      const requests = inFlightRequests.current;
      
      // Clear all timeouts
      timeouts.forEach(timeout => clearTimeout(timeout));
      timeouts.clear();
      
      // Clear all in-flight requests
      requests.clear();
    };
  }, []);

  // Context Value - MEMOIZED to prevent unnecessary re-renders
  const contextValue = React.useMemo(() => ({
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
    searchWithInclude,
    fetchPatientBundle,
    fetchPatientEverything,
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
    standardizeResponse,
    
    // Cache coordination
    warmPatientCache,
    isCacheWarm,
    
    // Direct fhirClient access for advanced usage
    fhirClient
  }), [
    // State dependencies
    state,
    // Function dependencies
    setResources,
    addResource,
    updateResource,
    removeResource,
    getResource,
    getResourcesByType,
    getPatientResources,
    fetchResource,
    searchResources,
    searchWithInclude,
    fetchPatientBundle,
    fetchPatientEverything,
    refreshPatientResources,
    setCurrentPatient,
    setCurrentEncounter,
    isResourceLoading,
    getError,
    clearCache,
    getCachedData,
    setCachedData,
    warmPatientCache,
    isCacheWarm
  ]);

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
  const { getResource, setCurrentPatient, currentPatient } = useFHIRResource();
  
  const patient = patientId ? getResource('Patient', patientId) : currentPatient;
  
  const loadPatient = useCallback(async (id) => {
    if (id) {
      return await setCurrentPatient(id);
    }
  }, [setCurrentPatient]);

  return { patient, loadPatient };
}

export function usePatientResources(patientId, resourceType = null) {
  const { getPatientResources, fetchPatientBundle, isResourceLoading, searchResources, getResourcesByType } = useFHIRResource();
  
  const resources = resourceType 
    ? getPatientResources(patientId, resourceType) 
    : getResourcesByType(resourceType);
  const loading = isResourceLoading(resourceType || 'Patient');
  
  // Load resources on-demand for specific resource type
  const loadResources = useCallback(async (forceRefresh = false) => {
    if (!patientId) return;
    
    if (resourceType) {
      // Load specific resource type with optimized parameters
      let count = 20; // Default small count
      let params = { patient: patientId, _count: count };
      
      // Resource-specific optimizations
      if (resourceType === 'Observation') {
        count = 30;
        params._count = count;
        params._sort = '-date';
        // Get only last 6 months of observations
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        params.date = `ge${sixMonthsAgo.toISOString().split('T')[0]}`;
      } else if (resourceType === 'MedicationRequest') {
        params._sort = '-authoredon';
        params.status = 'active,on-hold'; // Only active medications
      } else if (resourceType === 'Condition') {
        params._sort = '-recorded-date';
        params['clinical-status'] = 'active'; // Only active conditions
      } else if (resourceType === 'DiagnosticReport') {
        params._sort = '-date';
        // Get only last year of reports
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        params.date = `ge${oneYearAgo.toISOString().split('T')[0]}`;
      } else if (resourceType === 'Encounter') {
        params._sort = '-date';
        params._count = 10; // Fewer encounters needed
      }
      
      return await searchResources(resourceType, params, forceRefresh);
    } else {
      // Load patient bundle if no specific type requested
      return await fetchPatientBundle(patientId, forceRefresh);
    }
  }, [patientId, resourceType, searchResources, fetchPatientBundle]);

  // Auto-load resources on mount if not already loaded
  useEffect(() => {
    if (patientId && resourceType && resources.length === 0 && !loading) {
      loadResources();
    }
  }, [patientId, resourceType, resources.length, loading, loadResources]);

  return { resources, loading, loadResources };
}

export default FHIRResourceContext;