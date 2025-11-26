/**
 * useResourceSearch Hook
 * Simplified hook for FHIR resource searching with built-in service integration
 */
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { fhirClient } from '../../core/fhir/services/fhirClient';

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
  const { cdsClinicalDataService } = require('../../services/cdsClinicalDataService');
  
  // Memoize the search service to prevent recreation
  const searchService = useCallback(async (query, searchOpts) => {
    // Direct catalog search to avoid recursion
    try {
      const results = await cdsClinicalDataService.getDynamicMedicationCatalog(query, searchOpts.limit || 20);
      
      // Transform to match the format expected by medication search components
      return results.map(med => {
        // Create a consistent structure that matches what the Autocomplete expects
        const code = med.rxnorm_code || med.id;
        const system = med.rxnorm_code ? 'http://www.nlm.nih.gov/research/umls/rxnorm' : 
                       'http://terminology.hl7.org/CodeSystem/medication-statement-category';
        
        return {
          // These fields are used by the Autocomplete for matching
          code: code,
          display: med.generic_name || med.display || 'Unknown medication',
          system: system,
          source: 'catalog',
          
          // Additional medication-specific fields
          id: med.id || `med-${code}`,
          resourceType: 'Medication',
          generic_name: med.generic_name,
          brand_name: med.brand_name,
          strength: med.strength,
          dosage_form: med.dosage_form,
          route: med.route,
          
          // Usage and catalog metadata
          frequency: med.usage_count || 0,
          usage_count: med.usage_count || 0,
          common_dosages: med.common_dosages || [],
          searchSource: 'catalog'
        };
      });
    } catch (error) {
      console.warn('Catalog medication search failed:', error);
      return [];
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // cdsClinicalDataService is imported at module level and doesn't change
  
  return useResourceSearch({
    resourceTypes: ['Medication'],
    searchService,
    ...options
  });
};

export const useCatalogConditionSearch = (options = {}) => {
  const { cdsClinicalDataService } = require('../../services/cdsClinicalDataService');
  
  // Memoize the search service to prevent recreation
  const searchService = useCallback(async (query, searchOpts) => {
    // Direct catalog search to avoid recursion
    try {
      const results = await cdsClinicalDataService.getDynamicConditionCatalog(query, searchOpts.limit || 20);
      
      // Transform to match the format expected by ConditionFormFields
      return results.map(cond => {
        // Create a consistent structure that matches what the Autocomplete expects
        const code = cond.snomed_code || cond.icd10_code || cond.id;
        const system = cond.snomed_code ? 'http://snomed.info/sct' : 
                       cond.icd10_code ? 'http://hl7.org/fhir/sid/icd-10' : 
                       'http://terminology.hl7.org/CodeSystem/condition-clinical';
        
        return {
          // These fields are used by the Autocomplete for matching
          code: code,
          display: cond.display_name || cond.display || 'Unknown condition',
          system: system,
          source: 'catalog',
          
          // Additional fields for compatibility
          id: cond.id || `cond-${code}`,
          resourceType: 'Condition',
          frequency: cond.usage_count || 0,
          category: cond.category,
          
          // For display in the dropdown
          frequency_count: cond.usage_count || 0,
          searchSource: 'catalog'
        };
      });
    } catch (error) {
      console.warn('Catalog condition search failed:', error);
      return [];
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // cdsClinicalDataService is imported at module level and doesn't change
  
  return useResourceSearch({
    resourceTypes: ['Condition'],
    searchService,
    ...options
  });
};

export const useHybridSearch = (resourceTypes, options = {}) => {
  const { searchService } = require('../../services/searchService');
  const { cdsClinicalDataService } = require('../../services/cdsClinicalDataService');
  
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
              .map(item => {
                // Get display name based on catalog type
                let displayName = '';
                let code = '';
                let coding = [];
                
                if (type === 'medications') {
                  displayName = item.generic_name || item.display || item.name || 'Unknown medication';
                  code = item.rxnorm_code || item.code || '';
                  if (code) {
                    coding = [{
                      system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
                      code: code,
                      display: displayName
                    }];
                  }
                } else if (type === 'lab_tests') {
                  displayName = item.test_name || item.display || item.name || 'Unknown test';
                  code = item.loinc_code || item.test_code || item.code || '';
                  if (code) {
                    coding = [{
                      system: 'http://loinc.org',
                      code: code,
                      display: displayName
                    }];
                  }
                } else if (type === 'conditions') {
                  displayName = item.display_name || item.display || item.name || 'Unknown condition';
                  code = item.icd10_code || item.snomed_code || item.code || '';
                  if (code) {
                    const system = item.icd10_code ? 'http://hl7.org/fhir/sid/icd-10' : 'http://snomed.info/sct';
                    coding = [{
                      system: system,
                      code: code,
                      display: displayName
                    }];
                  }
                } else {
                  displayName = item.display || item.name || 'Unknown';
                  code = item.code || '';
                  if (item.coding) {
                    coding = [item.coding];
                  }
                }
                
                return {
                  resourceType: type === 'lab_tests' ? 'Observation' : type.charAt(0).toUpperCase() + type.slice(1),
                  id: item.id || `${type}-${Math.random().toString(36).substr(2, 9)}`,
                  code: {
                    text: displayName,
                    coding: coding
                  },
                  display: displayName,
                  frequency: item.frequency || item.usage_count || 0,
                  searchSource: 'catalog',
                  category: item.category || type
                };
              });
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // cdsClinicalDataService and searchService are imported at module level and don't change
  
  return useResourceSearch({
    resourceTypes,
    searchService: hybridSearchService,
    ...options
  });
};

export const useLabTestSearch = (options = {}) => {
  const { cdsClinicalDataService } = require('../../services/cdsClinicalDataService');
  
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
          text: lab.test_name || lab.display || lab.name,
          coding: lab.loinc_code ? [{
            system: 'http://loinc.org',
            code: lab.loinc_code,
            display: lab.test_name || lab.display || lab.name
          }] : []
        },
        display: lab.test_name || lab.display || lab.name,
        referenceRange: lab.reference_range,
        category: lab.category || 'laboratory',
        searchSource: 'catalog'
      }));
    } catch (error) {
      console.warn('Lab test search failed:', error);
      return [];
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // cdsClinicalDataService is imported at module level and doesn't change
  
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