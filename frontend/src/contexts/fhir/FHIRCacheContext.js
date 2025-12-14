/**
 * FHIRCacheContext
 *
 * Handles all caching logic for FHIR resources including:
 * - Multi-level caching (memory, session)
 * - Cache invalidation and TTL management
 * - Cache warming for patient data
 * - Integration with intelligentCache service
 */

import React, { createContext, useContext, useCallback, useReducer, useRef } from 'react';
import { intelligentCache } from '../../core/fhir/utils/intelligentCache';

// Action Types
const CACHE_ACTIONS = {
  SET_CACHE: 'SET_CACHE',
  INVALIDATE_CACHE: 'INVALIDATE_CACHE',
  CLEAR_ALL_CACHE: 'CLEAR_ALL_CACHE'
};

// Initial State
const initialState = {
  cache: {
    searches: {}, // searchKey -> { results, timestamp, ttl }
    bundles: {},  // bundleKey -> { bundle, timestamp, ttl }
    computed: {}, // computedKey -> { data, timestamp, ttl }
    resources: {} // resourceKey -> { data, timestamp, ttl }
  }
};

// Reducer
function cacheReducer(state, action) {
  switch (action.type) {
    case CACHE_ACTIONS.SET_CACHE: {
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

    case CACHE_ACTIONS.INVALIDATE_CACHE: {
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

    case CACHE_ACTIONS.CLEAR_ALL_CACHE: {
      return {
        ...state,
        cache: {
          searches: {},
          bundles: {},
          computed: {},
          resources: {}
        }
      };
    }

    default:
      return state;
  }
}

// Create Context
const FHIRCacheContext = createContext(null);

// Provider Component
export function FHIRCacheProvider({ children }) {
  const [state, dispatch] = useReducer(cacheReducer, initialState);

  // Track warm cache status by patient
  const warmCacheStatus = useRef(new Map());

  /**
   * Get cached data from both intelligent cache and state cache
   * @param {string} cacheType - Type of cache (searches, bundles, computed, resources)
   * @param {string} key - Cache key
   * @returns {any} Cached data or null if not found/expired
   */
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
        type: CACHE_ACTIONS.INVALIDATE_CACHE,
        payload: { cacheType, key }
      });
      return null;
    }

    return cached.data;
  }, [state.cache]);

  /**
   * Set data in both intelligent cache and state cache
   * @param {string} cacheType - Type of cache
   * @param {string} key - Cache key
   * @param {any} data - Data to cache
   * @param {number} ttl - Time to live in milliseconds
   * @param {string} resourceType - Optional FHIR resource type for intelligent cache
   */
  const setCachedData = useCallback((cacheType, key, data, ttl = 300000, resourceType = null) => {
    // Store in intelligent cache
    const intelligentCacheKey = `${cacheType}:${key}`;
    intelligentCache.set(intelligentCacheKey, data, {
      resourceType,
      customTTL: ttl,
      tags: [cacheType]
    });

    // Also store in state cache for backward compatibility
    dispatch({
      type: CACHE_ACTIONS.SET_CACHE,
      payload: { cacheType, key, data, ttl }
    });
  }, []);

  /**
   * Clear specific cache type or all caches
   * @param {string} cacheType - Optional cache type to clear
   */
  const clearCache = useCallback((cacheType = null) => {
    if (cacheType) {
      dispatch({ type: CACHE_ACTIONS.INVALIDATE_CACHE, payload: { cacheType } });
      // Also clear from intelligent cache by tag
      intelligentCache.invalidateByTag?.(cacheType);
    } else {
      dispatch({ type: CACHE_ACTIONS.CLEAR_ALL_CACHE });
      // Clear all intelligent cache
      intelligentCache.clear?.();
    }
  }, []);

  /**
   * Invalidate specific cache entry
   * @param {string} cacheType - Type of cache
   * @param {string} key - Cache key to invalidate
   */
  const invalidateCacheEntry = useCallback((cacheType, key) => {
    dispatch({
      type: CACHE_ACTIONS.INVALIDATE_CACHE,
      payload: { cacheType, key }
    });

    // Also invalidate from intelligent cache
    const intelligentCacheKey = `${cacheType}:${key}`;
    intelligentCache.invalidate?.(intelligentCacheKey);
  }, []);

  /**
   * Check if cache is warm for a patient
   * @param {string} patientId - Patient ID
   * @param {string[]} resourceTypes - Resource types to check
   * @returns {boolean} True if cache is warm
   */
  const isCacheWarm = useCallback((patientId, resourceTypes = ['Condition', 'MedicationRequest']) => {
    const status = warmCacheStatus.current.get(patientId);
    if (!status) return false;

    return resourceTypes.every(type => status[type] === true);
  }, []);

  /**
   * Mark cache as warm for specific resource types
   * @param {string} patientId - Patient ID
   * @param {string[]} resourceTypes - Resource types that are warmed
   */
  const markCacheWarm = useCallback((patientId, resourceTypes) => {
    const existing = warmCacheStatus.current.get(patientId) || {};
    resourceTypes.forEach(type => {
      existing[type] = true;
    });
    warmCacheStatus.current.set(patientId, existing);
  }, []);

  /**
   * Clear warm cache status for a patient
   * @param {string} patientId - Patient ID
   */
  const clearWarmCacheStatus = useCallback((patientId) => {
    warmCacheStatus.current.delete(patientId);
  }, []);

  /**
   * Get cache statistics for debugging/monitoring
   * @returns {object} Cache statistics
   */
  const getCacheStats = useCallback(() => {
    const stats = {
      searches: Object.keys(state.cache.searches).length,
      bundles: Object.keys(state.cache.bundles).length,
      computed: Object.keys(state.cache.computed).length,
      resources: Object.keys(state.cache.resources).length,
      warmPatients: warmCacheStatus.current.size
    };

    // Also include intelligent cache stats if available
    if (intelligentCache.getStats) {
      stats.intelligentCache = intelligentCache.getStats();
    }

    return stats;
  }, [state.cache]);

  // Context value
  const contextValue = React.useMemo(() => ({
    // State
    cache: state.cache,

    // Cache operations
    getCachedData,
    setCachedData,
    clearCache,
    invalidateCacheEntry,

    // Warm cache management
    isCacheWarm,
    markCacheWarm,
    clearWarmCacheStatus,

    // Debugging
    getCacheStats,

    // Direct access for advanced usage
    intelligentCache
  }), [
    state.cache,
    getCachedData,
    setCachedData,
    clearCache,
    invalidateCacheEntry,
    isCacheWarm,
    markCacheWarm,
    clearWarmCacheStatus,
    getCacheStats
  ]);

  return (
    <FHIRCacheContext.Provider value={contextValue}>
      {children}
    </FHIRCacheContext.Provider>
  );
}

/**
 * Hook to access the FHIR cache context
 * @returns {object} Cache context value
 * @throws {Error} If used outside of FHIRCacheProvider
 */
export function useFHIRCache() {
  const context = useContext(FHIRCacheContext);
  if (!context) {
    throw new Error('useFHIRCache must be used within a FHIRCacheProvider');
  }
  return context;
}

export default FHIRCacheContext;
