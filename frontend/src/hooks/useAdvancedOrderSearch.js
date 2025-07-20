/**
 * Advanced Order Search Hook
 * 
 * React hook for performing advanced FHIR R4 order searches with filtering,
 * analytics, and recommendation capabilities.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { enhancedOrderSearchService } from '../services/enhancedOrderSearch';
import { useFHIRResource } from '../contexts/FHIRResourceContext';

export const useAdvancedOrderSearch = (options = {}) => {
  const { currentPatient } = useFHIRResource();
  
  const {
    patientId: propPatientId,
    autoSearch = false,
    includeAnalytics = false,
    debounceMs = 300
  } = options;

  // Determine patient ID
  const patientId = propPatientId || currentPatient?.id;

  // State management
  const [searchState, setSearchState] = useState({
    // Search parameters
    filters: new URLSearchParams(),
    resourceTypes: ['ServiceRequest', 'MedicationRequest'],
    sort: '-authored-date',
    count: 50,
    page: 1,
    
    // Results
    results: null,
    entries: [],
    total: 0,
    analytics: null,
    
    // UI state
    loading: false,
    error: null,
    hasSearched: false,
    
    // Suggestions
    suggestions: [],
    loadingSuggestions: false,
    
    // Recommendations
    recommendations: [],
    loadingRecommendations: false
  });

  // Refs for managing async operations
  const abortControllerRef = useRef(null);
  const debounceTimeoutRef = useRef(null);
  const searchCounterRef = useRef(0);

  /**
   * Perform order search with current parameters
   */
  const executeSearch = useCallback(async (searchParams = null, searchOptions = {}) => {
    if (!patientId) {
      setSearchState(prev => ({
        ...prev,
        error: 'Patient ID is required for order search',
        loading: false
      }));
      return;
    }

    // Cancel any ongoing search
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();
    const currentSearchId = ++searchCounterRef.current;

    try {
      setSearchState(prev => ({
        ...prev,
        loading: true,
        error: null
      }));

      const finalSearchParams = searchParams || searchState.filters;
      const finalOptions = {
        patientId,
        resourceTypes: searchState.resourceTypes,
        sort: searchState.sort,
        count: searchState.count,
        page: searchState.page,
        includeAnalytics,
        ...searchOptions
      };

      const results = await enhancedOrderSearchService.searchOrders(
        finalSearchParams,
        finalOptions
      );

      // Check if this search is still current
      if (currentSearchId === searchCounterRef.current && !abortControllerRef.current.signal.aborted) {
        setSearchState(prev => ({
          ...prev,
          results,
          entries: results.entries || [],
          total: results.total || 0,
          analytics: results.analytics || null,
          loading: false,
          hasSearched: true,
          error: null
        }));
      }

      return results;
    } catch (error) {
      if (currentSearchId === searchCounterRef.current && !abortControllerRef.current.signal.aborted) {
        setSearchState(prev => ({
          ...prev,
          loading: false,
          error: error.message || 'Search failed',
          hasSearched: true
        }));
      }
      throw error;
    }
  }, [patientId, searchState.filters, searchState.resourceTypes, searchState.sort, searchState.count, searchState.page, includeAnalytics]);

  /**
   * Update search filters
   */
  const updateFilters = useCallback((newFilters) => {
    let updatedFilters;
    
    if (newFilters instanceof URLSearchParams) {
      updatedFilters = newFilters;
    } else if (typeof newFilters === 'object') {
      updatedFilters = new URLSearchParams();
      Object.entries(newFilters).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          updatedFilters.append(key, value);
        }
      });
    } else {
      console.error('Invalid filter format. Expected URLSearchParams or object.');
      return;
    }

    setSearchState(prev => ({
      ...prev,
      filters: updatedFilters,
      page: 1 // Reset to first page when filters change
    }));

    // Auto-search if enabled
    if (autoSearch) {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      
      debounceTimeoutRef.current = setTimeout(() => {
        executeSearch(updatedFilters);
      }, debounceMs);
    }
  }, [autoSearch, debounceMs, executeSearch]);

  /**
   * Update search options
   */
  const updateSearchOptions = useCallback((options) => {
    setSearchState(prev => ({
      ...prev,
      ...options,
      page: options.hasOwnProperty('resourceTypes') || options.hasOwnProperty('sort') ? 1 : prev.page
    }));
  }, []);

  /**
   * Clear all filters and results
   */
  const clearSearch = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setSearchState(prev => ({
      ...prev,
      filters: new URLSearchParams(),
      results: null,
      entries: [],
      total: 0,
      analytics: null,
      page: 1,
      loading: false,
      error: null,
      hasSearched: false
    }));
  }, []);

  /**
   * Get search suggestions for autocomplete
   */
  const getSuggestions = useCallback(async (query, context = {}) => {
    if (!query || query.length < 2) {
      setSearchState(prev => ({
        ...prev,
        suggestions: [],
        loadingSuggestions: false
      }));
      return [];
    }

    try {
      setSearchState(prev => ({
        ...prev,
        loadingSuggestions: true
      }));

      const suggestions = await enhancedOrderSearchService.getSearchSuggestions(
        query,
        patientId,
        context
      );

      setSearchState(prev => ({
        ...prev,
        suggestions,
        loadingSuggestions: false
      }));

      return suggestions;
    } catch (error) {
      console.error('Error getting search suggestions:', error);
      setSearchState(prev => ({
        ...prev,
        suggestions: [],
        loadingSuggestions: false
      }));
      return [];
    }
  }, [patientId]);

  /**
   * Get order recommendations based on patient context
   */
  const getRecommendations = useCallback(async (clinicalContext = {}) => {
    if (!patientId) return [];

    try {
      setSearchState(prev => ({
        ...prev,
        loadingRecommendations: true
      }));

      const recommendations = await enhancedOrderSearchService.getOrderRecommendations(
        patientId,
        clinicalContext
      );

      setSearchState(prev => ({
        ...prev,
        recommendations,
        loadingRecommendations: false
      }));

      return recommendations;
    } catch (error) {
      console.error('Error getting order recommendations:', error);
      setSearchState(prev => ({
        ...prev,
        recommendations: [],
        loadingRecommendations: false
      }));
      return [];
    }
  }, [patientId]);

  /**
   * Pagination helpers
   */
  const goToPage = useCallback((page) => {
    setSearchState(prev => ({
      ...prev,
      page: Math.max(1, page)
    }));

    if (autoSearch) {
      executeSearch();
    }
  }, [autoSearch, executeSearch]);

  const nextPage = useCallback(() => {
    setSearchState(prev => {
      const newPage = prev.page + 1;
      const maxPage = Math.ceil(prev.total / prev.count);
      
      if (newPage <= maxPage) {
        if (autoSearch) {
          executeSearch();
        }
        return { ...prev, page: newPage };
      }
      return prev;
    });
  }, [autoSearch, executeSearch]);

  const previousPage = useCallback(() => {
    setSearchState(prev => {
      if (prev.page > 1) {
        const newPage = prev.page - 1;
        if (autoSearch) {
          executeSearch();
        }
        return { ...prev, page: newPage };
      }
      return prev;
    });
  }, [autoSearch, executeSearch]);

  /**
   * Utility functions
   */
  const hasActiveFilters = useCallback(() => {
    return Array.from(searchState.filters.entries()).length > 0;
  }, [searchState.filters]);

  const getFilterSummary = useCallback(() => {
    const filters = Array.from(searchState.filters.entries());
    return filters.map(([key, value]) => ({
      key,
      value,
      display: `${key}: ${value}`
    }));
  }, [searchState.filters]);

  const canLoadMore = useCallback(() => {
    return searchState.total > searchState.entries.length;
  }, [searchState.total, searchState.entries.length]);

  /**
   * Load more results (append to existing)
   */
  const loadMore = useCallback(async () => {
    if (!canLoadMore() || searchState.loading) return;

    const nextPage = searchState.page + 1;
    
    try {
      setSearchState(prev => ({ ...prev, loading: true }));
      
      const results = await executeSearch(searchState.filters, { 
        page: nextPage,
        includeAnalytics: false // Don't need analytics for pagination
      });

      setSearchState(prev => ({
        ...prev,
        entries: [...prev.entries, ...(results.entries || [])],
        page: nextPage,
        loading: false
      }));
    } catch (error) {
      console.error('Error loading more results:', error);
      setSearchState(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to load more results'
      }));
    }
  }, [canLoadMore, searchState.loading, searchState.page, searchState.filters, executeSearch]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Initial search on mount when autoSearch is enabled
   */
  useEffect(() => {
    if (autoSearch && patientId && !searchState.hasSearched) {
      console.log('useAdvancedOrderSearch: Executing initial search for patient:', patientId);
      executeSearch();
    }
  }, [autoSearch, patientId]); // Only run when autoSearch or patientId changes
  
  /**
   * Auto-search on patient change after initial search
   */
  useEffect(() => {
    if (autoSearch && patientId && searchState.hasSearched) {
      executeSearch();
    }
  }, [patientId]); // Only run when patientId changes

  return {
    // State
    ...searchState,
    patientId,
    
    // Actions
    search: executeSearch,
    updateFilters,
    updateSearchOptions,
    clearSearch,
    getSuggestions,
    getRecommendations,
    
    // Pagination
    goToPage,
    nextPage,
    previousPage,
    loadMore,
    
    // Utilities
    hasActiveFilters,
    getFilterSummary,
    canLoadMore,
    
    // Pagination info
    pagination: {
      current: searchState.page,
      total: Math.ceil(searchState.total / searchState.count),
      hasNext: searchState.page < Math.ceil(searchState.total / searchState.count),
      hasPrevious: searchState.page > 1,
      pageSize: searchState.count,
      totalResults: searchState.total
    }
  };
};

export default useAdvancedOrderSearch;