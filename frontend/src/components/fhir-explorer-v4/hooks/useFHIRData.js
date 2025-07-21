/**
 * FHIR Data Management Hook
 * 
 * Manages loading, caching, and searching of FHIR resources
 * for the FHIR Explorer v4 application
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { fhirClient } from '../../../core/fhir/services/fhirClient';

// Cache configuration
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const MAX_CACHE_SIZE = 100; // Maximum cached resources per type

/**
 * Custom hook for FHIR data management
 */
export const useFHIRData = () => {
  const [data, setData] = useState({
    resources: {},
    metadata: {},
    lastUpdated: null
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Cache for storing query results
  const cacheRef = useRef(new Map());
  const lastFetchRef = useRef(new Map());

  // Check if cached data is still valid
  const isCacheValid = useCallback((cacheKey) => {
    const lastFetch = lastFetchRef.current.get(cacheKey);
    if (!lastFetch) return false;
    return Date.now() - lastFetch < CACHE_TTL;
  }, []);

  // Get data from cache
  const getCachedData = useCallback((cacheKey) => {
    if (isCacheValid(cacheKey)) {
      return cacheRef.current.get(cacheKey);
    }
    return null;
  }, [isCacheValid]);

  // Set data in cache
  const setCachedData = useCallback((cacheKey, data) => {
    // Implement LRU cache eviction if needed
    if (cacheRef.current.size >= MAX_CACHE_SIZE) {
      const firstKey = cacheRef.current.keys().next().value;
      cacheRef.current.delete(firstKey);
      lastFetchRef.current.delete(firstKey);
    }
    
    cacheRef.current.set(cacheKey, data);
    lastFetchRef.current.set(cacheKey, Date.now());
  }, []);

  // Load basic resource counts and metadata
  const loadResourceMetadata = useCallback(async () => {
    const cacheKey = 'metadata';
    const cached = getCachedData(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Get counts for each resource type
      const resourceTypes = [
        'Patient', 'Observation', 'Condition', 'MedicationRequest',
        'Encounter', 'DiagnosticReport', 'Procedure', 'Practitioner',
        'Organization', 'Location', 'AllergyIntolerance', 'Immunization'
      ];

      const metadata = {};
      const resources = {};

      // Fetch sample data for each resource type to get counts
      await Promise.all(
        resourceTypes.map(async (resourceType) => {
          try {
            const result = await fhirClient.search(resourceType, { _count: 20, _summary: 'count' });
            const total = result.total || 0;
            const entries = result.bundle?.entry || [];
            
            metadata[resourceType] = {
              total,
              sample: entries.length,
              lastUpdated: new Date().toISOString()
            };

            // Store sample resources for quick access
            resources[resourceType] = entries.map(entry => entry.resource);
          } catch (err) {
            console.warn(`Failed to load ${resourceType}:`, err);
            metadata[resourceType] = { total: 0, sample: 0, error: err.message };
            resources[resourceType] = [];
          }
        })
      );

      const result = { metadata, resources };
      setCachedData(cacheKey, result);
      return result;
    } catch (err) {
      console.error('Failed to load resource metadata:', err);
      throw err;
    }
  }, [getCachedData, setCachedData]);

  // Refresh all data
  const refreshData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await loadResourceMetadata();
      setData({
        ...result,
        lastUpdated: new Date().toISOString()
      });
    } catch (err) {
      setError(err.message || 'Failed to load FHIR data');
    } finally {
      setLoading(false);
    }
  }, [loadResourceMetadata]);

  // Search resources with caching
  const searchResources = useCallback(async (resourceType, searchParams = {}, options = {}) => {
    const {
      useCache = true,
      count = 20,
      offset = 0,
      sort = null,
      include = [],
      revinclude = []
    } = options;

    // Build query string
    const queryParams = new URLSearchParams();
    
    // Add search parameters
    Object.entries(searchParams).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        queryParams.append(key, value);
      }
    });

    // Add control parameters
    queryParams.append('_count', count.toString());
    if (offset > 0) {
      queryParams.append('_offset', offset.toString());
    }
    if (sort) {
      queryParams.append('_sort', sort);
    }
    
    // Add include parameters
    include.forEach(inc => queryParams.append('_include', inc));
    revinclude.forEach(inc => queryParams.append('_revinclude', inc));

    const queryString = queryParams.toString();
    const cacheKey = `${resourceType}?${queryString}`;

    // Check cache first
    if (useCache) {
      const cached = getCachedData(cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      // Convert searchParams to params object for fhirClient
      const params = Object.fromEntries(queryParams);
      const searchResult = await fhirClient.search(resourceType, params);
      const result = {
        resources: searchResult.resources || [],
        total: searchResult.total || 0,
        bundle: searchResult.bundle || { resourceType: 'Bundle', entry: [] },
        links: searchResult.bundle?.link || [],
        timestamp: new Date().toISOString()
      };

      if (useCache) {
        setCachedData(cacheKey, result);
      }

      return result;
    } catch (err) {
      console.error(`Failed to search ${resourceType}:`, err);
      throw err;
    }
  }, [getCachedData, setCachedData]);

  // Get a single resource by ID
  const getResource = useCallback(async (resourceType, id, useCache = true) => {
    const cacheKey = `${resourceType}/${id}`;

    if (useCache) {
      const cached = getCachedData(cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      const result = await fhirClient.read(resourceType, id);

      if (useCache) {
        setCachedData(cacheKey, result);
      }

      return result;
    } catch (err) {
      console.error(`Failed to get ${resourceType}/${id}:`, err);
      throw err;
    }
  }, [getCachedData, setCachedData]);

  // Execute a raw FHIR query
  const executeQuery = useCallback(async (queryUrl, useCache = true) => {
    // Ensure query starts with /fhir/R4/
    let normalizedQuery = queryUrl;
    if (!normalizedQuery.startsWith('/fhir/R4/')) {
      normalizedQuery = '/fhir/R4/' + normalizedQuery.replace(/^\/+/, '');
    }

    const cacheKey = `query:${normalizedQuery}`;

    if (useCache) {
      const cached = getCachedData(cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      // Extract resource type and params from query URL
      const queryParts = normalizedQuery.replace('/fhir/R4/', '').split('?');
      const [resourceType, ...rest] = queryParts[0].split('/');
      const queryString = queryParts[1] || '';
      const params = queryString ? Object.fromEntries(new URLSearchParams(queryString)) : {};
      
      let result;
      if (rest.length > 0) {
        // It's a read operation for a specific resource
        result = await fhirClient.read(resourceType, rest[0]);
      } else {
        // It's a search operation
        const searchResult = await fhirClient.search(resourceType, params);
        result = searchResult.bundle || searchResult;
      }
      
      return {
        data: result,
        timestamp: new Date().toISOString(),
        query: normalizedQuery
      };

      if (useCache) {
        setCachedData(cacheKey, result);
      }

      return result;
    } catch (err) {
      console.error(`Failed to execute query: ${normalizedQuery}`, err);
      throw err;
    }
  }, [getCachedData, setCachedData]);

  // Clear cache
  const clearCache = useCallback(() => {
    cacheRef.current.clear();
    lastFetchRef.current.clear();
  }, []);

  // Get cache statistics
  const getCacheStats = useCallback(() => {
    return {
      size: cacheRef.current.size,
      maxSize: MAX_CACHE_SIZE,
      ttl: CACHE_TTL,
      keys: Array.from(cacheRef.current.keys())
    };
  }, []);

  // Initial data load
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Auto-refresh data periodically (every 5 minutes)
  useEffect(() => {
    const interval = setInterval(() => {
      refreshData();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [refreshData]);

  return {
    data,
    loading,
    error,
    refreshData,
    searchResources,
    getResource,
    executeQuery,
    clearCache,
    getCacheStats,
    
    // Computed values
    hasData: Object.keys(data.resources).length > 0,
    totalResources: Object.values(data.metadata).reduce((sum, meta) => sum + (meta.total || 0), 0),
    resourceTypes: Object.keys(data.resources),
    lastUpdated: data.lastUpdated
  };
};