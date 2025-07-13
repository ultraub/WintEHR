/**
 * useResourceSearch Hook
 * Simplified hook for FHIR resource searching with built-in service integration
 */
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { fhirClient } from '../services/fhirClient';

// Default search implementation using FHIR client
const defaultSearchService = async (query, options = {}) => {
  const { resourceTypes = ['Patient'], signal, ...searchParams } = options;
  
  try {
    const results = [];
    
    // Search each resource type
    for (const resourceType of resourceTypes) {
      try {
        // Build search parameters based on resource type
        const params = buildSearchParams(resourceType, query, searchParams);
        
        const response = await fhirClient.search(resourceType, params, { signal });
        
        // Handle both Bundle and direct array responses
        const resources = response.entry 
          ? response.entry.map(entry => entry.resource)
          : Array.isArray(response) 
            ? response 
            : [response];
            
        results.push(...resources.filter(Boolean));
        
      } catch (error) {
        if (error.name === 'AbortError') throw error;
        // Continue with other resource types if one fails
        console.warn(`Search failed for ${resourceType}:`, error);
      }
    }
    
    return results;
    
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error(`Search failed: ${error.message}`);
  }
};

// Build FHIR search parameters based on resource type
const buildSearchParams = (resourceType, query, additionalParams = {}) => {
  const baseParams = {
    _count: additionalParams.limit || 20,
    ...additionalParams
  };
  
  // Resource-specific search parameters
  switch (resourceType.toLowerCase()) {
    case 'patient':
      return {
        ...baseParams,
        name: query,
        _sort: 'family'
      };
      
    case 'practitioner':
      return {
        ...baseParams,
        name: query,
        _sort: 'family'
      };
      
    case 'organization':
      return {
        ...baseParams,
        name: query,
        _sort: 'name'
      };
      
    case 'location':
      return {
        ...baseParams,
        name: query,
        _sort: 'name'
      };
      
    case 'medication':
      return {
        ...baseParams,
        code: query,
        _sort: 'code'
      };
      
    case 'condition':
      return {
        ...baseParams,
        code: query,
        _sort: 'code'
      };
      
    case 'procedure':
      return {
        ...baseParams,
        code: query,
        _sort: 'code'
      };
      
    case 'observation':
      return {
        ...baseParams,
        code: query,
        _sort: 'date'
      };
      
    default:
      // Generic text search
      return {
        ...baseParams,
        _text: query
      };
  }
};

export const useResourceSearch = (options = {}) => {
  const {
    resourceTypes = ['Patient'],
    searchService = defaultSearchService,
    enableCache = true,
    debounceMs = 300,
    minQueryLength = 2,
    ...searchOptions
  } = options;
  
  const [searchHistory, setSearchHistory] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [lastError, setLastError] = useState(null);
  const [searchStats, setSearchStats] = useState({
    totalSearches: 0,
    cacheHits: 0,
    avgResponseTime: 0
  });

  // Use refs to store current values and prevent recreation
  const searchServiceRef = useRef(searchService);
  const resourceTypesRef = useRef(resourceTypes);
  const searchOptionsRef = useRef(searchOptions);

  // Update refs when props change
  useEffect(() => {
    searchServiceRef.current = searchService;
  }, [searchService]);

  useEffect(() => {
    resourceTypesRef.current = resourceTypes;
  }, [resourceTypes]);

  useEffect(() => {
    searchOptionsRef.current = searchOptions;
  }, [searchOptions]);

  // Enhanced search service with analytics
  const enhancedSearchService = useCallback(async (query, searchOpts = {}) => {
    const startTime = Date.now();
    setIsSearching(true);
    setLastError(null);
    
    try {
      const results = await searchServiceRef.current(query, {
        resourceTypes: resourceTypesRef.current,
        ...searchOptionsRef.current,
        ...searchOpts
      });
      
      const responseTime = Date.now() - startTime;
      
      // Update statistics
      setSearchStats(prev => ({
        totalSearches: prev.totalSearches + 1,
        cacheHits: prev.cacheHits + (responseTime < 50 ? 1 : 0), // Assume cache if very fast
        avgResponseTime: (prev.avgResponseTime * prev.totalSearches + responseTime) / (prev.totalSearches + 1)
      }));
      
      // Add to search history
      setSearchHistory(prev => [
        { query, resultCount: results.length, timestamp: new Date(), responseTime },
        ...prev.slice(0, 9) // Keep last 10 searches
      ]);
      
      return results;
      
    } catch (error) {
      setLastError(error);
      throw error;
    } finally {
      setIsSearching(false);
    }
  }, []); // No dependencies - use refs instead

  // Clear search history
  const clearHistory = useCallback(() => {
    setSearchHistory([]);
  }, []);

  // Reset statistics
  const resetStats = useCallback(() => {
    setSearchStats({
      totalSearches: 0,
      cacheHits: 0,
      avgResponseTime: 0
    });
  }, []);

  // Get popular searches
  const popularSearches = useMemo(() => {
    const searchCounts = searchHistory.reduce((acc, { query }) => {
      acc[query] = (acc[query] || 0) + 1;
      return acc;
    }, {});
    
    return Object.entries(searchCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([query, count]) => ({ query, count }));
  }, [searchHistory]);

  // Recent searches (unique)
  const recentSearches = useMemo(() => {
    const seen = new Set();
    return searchHistory
      .filter(({ query }) => {
        if (seen.has(query)) return false;
        seen.add(query);
        return true;
      })
      .slice(0, 5);
  }, [searchHistory]);

  return {
    // Core search functionality
    searchService: enhancedSearchService,
    isSearching,
    lastError,
    
    // Configuration
    resourceTypes,
    searchOptions: {
      enableCache,
      debounceMs,
      minQueryLength,
      ...searchOptions
    },
    
    // Analytics and history
    searchStats,
    searchHistory,
    popularSearches,
    recentSearches,
    
    // Actions
    clearHistory,
    resetStats
  };
};

// Specialized hooks for common resource types
export const usePatientSearch = (options = {}) => {
  return useResourceSearch({
    resourceTypes: ['Patient'],
    ...options
  });
};

export const usePractitionerSearch = (options = {}) => {
  return useResourceSearch({
    resourceTypes: ['Practitioner'],
    ...options
  });
};

export const useOrganizationSearch = (options = {}) => {
  return useResourceSearch({
    resourceTypes: ['Organization'],
    ...options
  });
};

export const useMedicationSearch = (options = {}) => {
  return useResourceSearch({
    resourceTypes: ['Medication'],
    ...options
  });
};

export const useConditionSearch = (options = {}) => {
  return useResourceSearch({
    resourceTypes: ['Condition'],
    ...options
  });
};

export const useMultiResourceSearch = (resourceTypes, options = {}) => {
  return useResourceSearch({
    resourceTypes,
    ...options
  });
};

// Catalog-enhanced search hooks  
export const useCatalogMedicationSearch = (options = {}) => {
  const { cdsClinicalDataService } = require('../services/cdsClinicalDataService');
  
  // Memoize the search service to prevent recreation
  const searchService = useCallback(async (query, searchOpts) => {
    // Direct catalog search to avoid recursion
    try {
      const results = await cdsClinicalDataService.getDynamicMedicationCatalog(query, searchOpts.limit || 20);
      
      // Transform to FHIR-like structure
      return results.map(med => ({
        resourceType: 'Medication',
        id: med.id || `med-${Math.random().toString(36).substr(2, 9)}`,
        code: {
          text: med.display || med.name,
          coding: med.coding ? [med.coding] : []
        },
        display: med.display || med.name,
        frequency: med.frequency || 0,
        searchSource: 'catalog'
      }));
    } catch (error) {
      console.warn('Catalog medication search failed:', error);
      return [];
    }
  }, []);
  
  return useResourceSearch({
    resourceTypes: ['Medication'],
    searchService,
    ...options
  });
};

export const useCatalogConditionSearch = (options = {}) => {
  const { cdsClinicalDataService } = require('../services/cdsClinicalDataService');
  
  // Memoize the search service to prevent recreation
  const searchService = useCallback(async (query, searchOpts) => {
    // Direct catalog search to avoid recursion
    try {
      const results = await cdsClinicalDataService.getDynamicConditionCatalog(query, searchOpts.limit || 20);
      
      // Transform to FHIR-like structure
      return results.map(cond => ({
        resourceType: 'Condition',
        id: cond.id || `cond-${Math.random().toString(36).substr(2, 9)}`,
        code: {
          text: cond.display || cond.name,
          coding: cond.coding ? [cond.coding] : []
        },
        display: cond.display || cond.name,
        frequency: cond.frequency || 0,
        searchSource: 'catalog'
      }));
    } catch (error) {
      console.warn('Catalog condition search failed:', error);
      return [];
    }
  }, []);
  
  return useResourceSearch({
    resourceTypes: ['Condition'],
    searchService,
    ...options
  });
};

export const useHybridSearch = (resourceTypes, options = {}) => {
  const { searchService } = require('../services/searchService');
  const { cdsClinicalDataService } = require('../services/cdsClinicalDataService');
  
  // Memoize the search service to prevent recreation
  const hybridSearchService = useCallback(async (query, searchOpts) => {
    try {
      // Run FHIR and catalog searches in parallel
      const [fhirResults, catalogResults] = await Promise.allSettled([
        // Direct FHIR search
        searchService.searchFHIR(query, searchOpts),
        // Direct catalog search
        cdsClinicalDataService.searchAllDynamicCatalogs(query, searchOpts.limit || 10)
      ]);

      const combinedResults = [];

      // Add FHIR results
      if (fhirResults.status === 'fulfilled') {
        combinedResults.push(...fhirResults.value.map(result => ({
          ...result,
          searchSource: 'fhir'
        })));
      }

      // Add catalog results that don't duplicate FHIR results
      if (catalogResults.status === 'fulfilled') {
        const fhirIds = new Set(combinedResults.map(r => r.id));
        
        // Flatten catalog results
        Object.entries(catalogResults.value).forEach(([type, results]) => {
          if (Array.isArray(results)) {
            const transformedResults = results
              .filter(item => !fhirIds.has(item.id))
              .map(item => ({
                resourceType: type.charAt(0).toUpperCase() + type.slice(1),
                id: item.id || `${type}-${Math.random().toString(36).substr(2, 9)}`,
                code: {
                  text: item.display || item.name,
                  coding: item.coding ? [item.coding] : []
                },
                display: item.display || item.name,
                frequency: item.frequency || 0,
                searchSource: 'catalog'
              }));
            combinedResults.push(...transformedResults);
          }
        });
      }

      return combinedResults.slice(0, searchOpts.limit || 20);
    } catch (error) {
      console.warn('Hybrid search failed:', error);
      // Fall back to FHIR search only
      return await searchService.searchFHIR(query, searchOpts);
    }
  }, []);
  
  return useResourceSearch({
    resourceTypes,
    searchService: hybridSearchService,
    ...options
  });
};

export const useLabTestSearch = (options = {}) => {
  const { cdsClinicalDataService } = require('../services/cdsClinicalDataService');
  
  // Memoize the search service to prevent recreation
  const searchService = useCallback(async (query, searchOpts) => {
    // Direct catalog search for lab tests
    try {
      const results = await cdsClinicalDataService.getLabCatalog(query, null, searchOpts.limit || 20);
      
      // Transform to FHIR-like structure
      return results.map(lab => ({
        resourceType: 'Observation',
        id: lab.id || `obs-${Math.random().toString(36).substr(2, 9)}`,
        code: {
          text: lab.display || lab.name,
          coding: lab.coding ? [lab.coding] : []
        },
        display: lab.display || lab.name,
        referenceRange: lab.reference_range,
        category: lab.category,
        searchSource: 'catalog'
      }));
    } catch (error) {
      console.warn('Lab test search failed:', error);
      return [];
    }
  }, []);
  
  return useResourceSearch({
    resourceTypes: ['Observation'],
    searchService,
    ...options
  });
};

export const useGoalSearch = (options = {}) => {
  return useResourceSearch({
    resourceTypes: ['Goal'],
    ...options
  });
};