/**
 * React Hook for FHIR Operations
 * 
 * Provides a clean interface for FHIR operations with:
 * - Loading states
 * - Error handling
 * - Caching
 * - Real-time updates (when available)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { fhirClient } from '../services/fhirClient';
import { emrClient } from '../services/emrClient';

// Simple in-memory cache
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function useFHIR(resourceType, id = null, options = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mounted = useRef(true);

  // Options
  const {
    params = {},
    autoFetch = true,
    cacheKey = null,
    cacheTTL = CACHE_TTL,
    onSuccess = null,
    onError = null
  } = options;

  // Generate cache key
  const getCacheKey = useCallback(() => {
    if (cacheKey) return cacheKey;
    if (id) return `${resourceType}/${id}`;
    return `${resourceType}?${JSON.stringify(params)}`;
  }, [resourceType, id, params, cacheKey]);

  // Check cache
  const checkCache = useCallback(() => {
    const key = getCacheKey();
    const cached = cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < cacheTTL) {
      return cached.data;
    }
    
    return null;
  }, [getCacheKey, cacheTTL]);

  // Update cache
  const updateCache = useCallback((data) => {
    const key = getCacheKey();
    cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }, [getCacheKey]);

  // Fetch data
  const fetch = useCallback(async () => {
    // Check cache first
    const cached = checkCache();
    if (cached) {
      setData(cached);
      setLoading(false);
      return cached;
    }

    setLoading(true);
    setError(null);

    try {
      let result;
      
      if (id) {
        // Read single resource
        result = await fhirClient.read(resourceType, id);
      } else {
        // Search resources
        const response = await fhirClient.search(resourceType, params);
        result = response.resources;
      }

      if (mounted.current) {
        setData(result);
        updateCache(result);
        if (onSuccess) onSuccess(result);
      }

      return result;
    } catch (err) {
      if (mounted.current) {
        setError(err);
        if (onError) onError(err);
      }
      throw err;
    } finally {
      if (mounted.current) {
        setLoading(false);
      }
    }
  }, [resourceType, id, params, checkCache, updateCache, onSuccess, onError]);

  // Create resource
  const create = useCallback(async (resource) => {
    setLoading(true);
    setError(null);

    try {
      const result = await fhirClient.create(resourceType, resource);
      
      // Invalidate cache for this resource type
      cache.forEach((value, key) => {
        if (key.startsWith(resourceType)) {
          cache.delete(key);
        }
      });

      if (mounted.current) {
        if (onSuccess) onSuccess(result);
      }

      return result;
    } catch (err) {
      if (mounted.current) {
        setError(err);
        if (onError) onError(err);
      }
      throw err;
    } finally {
      if (mounted.current) {
        setLoading(false);
      }
    }
  }, [resourceType, onSuccess, onError]);

  // Update resource
  const update = useCallback(async (id, resource) => {
    setLoading(true);
    setError(null);

    try {
      const result = await fhirClient.update(resourceType, id, resource);
      
      // Update cache
      const key = `${resourceType}/${id}`;
      cache.delete(key);
      
      // Invalidate search caches
      cache.forEach((value, key) => {
        if (key.startsWith(`${resourceType}?`)) {
          cache.delete(key);
        }
      });

      if (mounted.current) {
        // Update local data if this is the current resource
        if (data && data.id === id) {
          setData(resource);
        }
        if (onSuccess) onSuccess(result);
      }

      return result;
    } catch (err) {
      if (mounted.current) {
        setError(err);
        if (onError) onError(err);
      }
      throw err;
    } finally {
      if (mounted.current) {
        setLoading(false);
      }
    }
  }, [resourceType, data, onSuccess, onError]);

  // Delete resource
  const remove = useCallback(async (id) => {
    setLoading(true);
    setError(null);

    try {
      const result = await fhirClient.delete(resourceType, id);
      
      // Clear from cache
      cache.delete(`${resourceType}/${id}`);
      
      // Invalidate search caches
      cache.forEach((value, key) => {
        if (key.startsWith(`${resourceType}?`)) {
          cache.delete(key);
        }
      });

      if (mounted.current) {
        if (onSuccess) onSuccess(result);
      }

      return result;
    } catch (err) {
      if (mounted.current) {
        setError(err);
        if (onError) onError(err);
      }
      throw err;
    } finally {
      if (mounted.current) {
        setLoading(false);
      }
    }
  }, [resourceType, onSuccess, onError]);

  // Execute operation
  const operation = useCallback(async (operationName, parameters = null) => {
    setLoading(true);
    setError(null);

    try {
      const result = await fhirClient.operation(
        operationName,
        resourceType,
        id,
        parameters
      );

      if (mounted.current) {
        if (onSuccess) onSuccess(result);
      }

      return result;
    } catch (err) {
      if (mounted.current) {
        setError(err);
        if (onError) onError(err);
      }
      throw err;
    } finally {
      if (mounted.current) {
        setLoading(false);
      }
    }
  }, [resourceType, id, onSuccess, onError]);

  // Auto-fetch on mount or when dependencies change
  useEffect(() => {
    if (autoFetch) {
      fetch();
    }

    return () => {
      mounted.current = false;
    };
  }, [autoFetch]); // Only run on mount if autoFetch is true

  // Refresh function
  const refresh = useCallback(() => {
    const key = getCacheKey();
    cache.delete(key);
    return fetch();
  }, [getCacheKey, fetch]);

  return {
    data,
    loading,
    error,
    fetch,
    create,
    update,
    remove,
    operation,
    refresh
  };
}

/**
 * Hook for patient-specific operations
 */
export function usePatient(patientId, options = {}) {
  const patient = useFHIR('Patient', patientId, options);
  
  // Get everything for patient
  const getEverything = useCallback(async () => {
    return patient.operation('everything');
  }, [patient]);

  return {
    ...patient,
    getEverything
  };
}

/**
 * Hook for searching resources
 */
export function useFHIRSearch(resourceType, searchParams = {}, options = {}) {
  return useFHIR(resourceType, null, {
    ...options,
    params: searchParams
  });
}

/**
 * Hook for Clinical Canvas
 */
export function useClinicalCanvas() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const generate = useCallback(async (prompt, context) => {
    setLoading(true);
    setError(null);

    try {
      const result = await emrClient.generateClinicalUI(prompt, context);
      return result;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const enhance = useCallback(async (currentUi, enhancement, context) => {
    setLoading(true);
    setError(null);

    try {
      const result = await emrClient.enhanceClinicalUI(currentUi, enhancement, context);
      return result;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    generate,
    enhance,
    loading,
    error
  };
}

/**
 * Hook for EMR features with graceful degradation
 */
export function useEMR() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Check if EMR is available
  const isAvailable = emrClient.enabled;

  // Auth methods
  const login = useCallback(async (username, password) => {
    if (!isAvailable) {
      // Fallback to basic auth
      setUser({ username, role: 'user' });
      return { user: { username, role: 'user' } };
    }

    setLoading(true);
    setError(null);

    try {
      const result = await emrClient.login(username, password);
      setUser(result.user);
      return result;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [isAvailable]);

  const logout = useCallback(async () => {
    if (isAvailable) {
      await emrClient.logout();
    }
    setUser(null);
  }, [isAvailable]);

  // UI State methods with local fallback
  const getUIState = useCallback(async (context) => {
    if (!isAvailable) {
      return { state: emrClient.getDefaultUIState(context) };
    }
    return emrClient.getUIState(context);
  }, [isAvailable]);

  const saveUIState = useCallback(async (context, state) => {
    return emrClient.saveUIState(context, state);
  }, []);

  // Clinical tools with graceful degradation
  const getNoteTemplate = useCallback(async (context) => {
    if (!isAvailable || !emrClient.hasFeature('clinicalTools')) {
      return emrClient.getBasicNoteTemplate(context.noteType);
    }
    return emrClient.generateNoteAssistance(context);
  }, [isAvailable]);

  return {
    isAvailable,
    user,
    loading,
    error,
    login,
    logout,
    getUIState,
    saveUIState,
    getNoteTemplate,
    features: emrClient.capabilities
  };
}

// Invalidate all caches
export function invalidateCache() {
  cache.clear();
}

// Invalidate specific resource type caches
export function invalidateResourceCache(resourceType) {
  cache.forEach((value, key) => {
    if (key.startsWith(resourceType)) {
      cache.delete(key);
    }
  });
}

/**
 * Utility search functions for common resources
 */
export function searchPatients(params = {}) {
  return fhirClient.get('/Patient', { params });
}

export function searchPractitioners(params = {}) {
  return fhirClient.get('/Practitioner', { params });
}

export function searchLocations(params = {}) {
  return fhirClient.get('/Location', { params });
}

export function searchAppointments(params = {}) {
  return fhirClient.get('/Appointment', { params });
}