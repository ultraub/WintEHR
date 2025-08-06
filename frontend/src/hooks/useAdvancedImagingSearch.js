/**
 * Advanced Imaging Search Hook
 * Provides comprehensive imaging study search capabilities with enhanced filtering
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { enhancedImagingSearchService } from '../services/enhancedImagingSearch';
import { useFHIRResource } from '../contexts/FHIRResourceContext';

export const useAdvancedImagingSearch = (patientId) => {
  const { refreshPatientResources } = useFHIRResource();
  
  // Search state
  const [studies, setStudies] = useState([]);
  const [performers, setPerformers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [availableFilters, setAvailableFilters] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchParams, setSearchParams] = useState({});
  const [totalResults, setTotalResults] = useState(0);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [hasMore, setHasMore] = useState(true);

  // Performance tracking
  const [searchMetrics, setSearchMetrics] = useState({
    lastSearchTime: 0,
    totalSearches: 0,
    cacheHits: 0
  });

  // Refs for cleanup
  const searchTimeoutRef = useRef(null);
  const abortControllerRef = useRef(null);

  /**
   * Perform search with current parameters
   */
  const performSearch = useCallback(async (params = {}, append = false) => {
    // Cancel any pending search
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (!patientId) {
      setStudies([]);
      setPerformers([]);
      setOrders([]);
      return;
    }

    setLoading(true);
    setError(null);

    const startTime = Date.now();
    abortControllerRef.current = new AbortController();

    try {
      const searchParameters = {
        ...params,
        _count: pageSize,
        _getpagesoffset: append ? currentPage * pageSize : 0
      };

      const result = await enhancedImagingSearchService.searchImagingStudies(
        patientId,
        searchParameters
      );

      if (append) {
        setStudies(prev => [...prev, ...result.studies]);
      } else {
        setStudies(result.studies);
        setCurrentPage(0);
      }

      setPerformers(result.performers);
      setOrders(result.orders);
      setTotalResults(result.total);
      setHasMore(result.studies.length === pageSize);
      setSearchParams(searchParameters);

      // Update search metrics
      const searchTime = Date.now() - startTime;
      setSearchMetrics(prev => ({
        lastSearchTime: searchTime,
        totalSearches: prev.totalSearches + 1,
        cacheHits: prev.cacheHits // Will be updated by service if cache hit
      }));

    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Search failed');
        console.error('Advanced imaging search error:', err);
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  }, [patientId, pageSize, currentPage]);

  /**
   * Load more results (pagination)
   */
  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      setCurrentPage(prev => prev + 1);
      performSearch(searchParams, true);
    }
  }, [loading, hasMore, searchParams, performSearch]);

  /**
   * Search with debouncing
   */
  const debouncedSearch = useCallback((params, delay = 300) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      performSearch(params);
    }, delay);
  }, [performSearch]);

  /**
   * Load available filter options
   */
  const loadAvailableFilters = useCallback(async () => {
    if (!patientId) return;

    try {
      const filters = await enhancedImagingSearchService.getAvailableFilters(patientId);
      setAvailableFilters(filters);
    } catch (err) {
      console.error('Failed to load available filters:', err);
      // Use defaults from service
      setAvailableFilters(enhancedImagingSearchService.getDefaultFilters());
    }
  }, [patientId]);

  /**
   * Specialized search methods
   */
  const searchByModality = useCallback(async (modality) => {
    const params = { modality: Array.isArray(modality) ? modality : [modality] };
    await performSearch(params);
  }, [performSearch]);

  const searchByDateRange = useCallback(async (fromDate, toDate) => {
    const params = {
      started: {
        from: fromDate,
        to: toDate
      }
    };
    await performSearch(params);
  }, [performSearch]);

  const searchByPerformer = useCallback(async (performerId) => {
    const params = { performer: performerId };
    await performSearch(params);
  }, [performSearch]);

  const searchByAccessionNumber = useCallback(async (accessionNumber) => {
    const params = { identifier: accessionNumber };
    await performSearch(params);
  }, [performSearch]);

  const searchByText = useCallback(async (searchText) => {
    const params = { textSearch: searchText };
    await debouncedSearch(params);
  }, [debouncedSearch]);

  /**
   * Filter management
   */
  const applyFilters = useCallback((filterParams) => {
    performSearch(filterParams);
  }, [performSearch]);

  const clearAllFilters = useCallback(() => {
    setSearchParams({});
    performSearch({});
  }, [performSearch]);

  /**
   * Refresh functionality
   */
  const refreshStudies = useCallback(async () => {
    // Clear cache and reload
    enhancedImagingSearchService.clearCache();
    await loadAvailableFilters();
    await performSearch(searchParams);
    
    // Also refresh FHIR resources context
    if (refreshPatientResources) {
      await refreshPatientResources(patientId);
    }
  }, [searchParams, performSearch, loadAvailableFilters, refreshPatientResources, patientId]);

  /**
   * Data transformations and utilities
   */
  const getStudiesByModality = useCallback(() => {
    return studies.reduce((acc, study) => {
      const modality = study._computedFields?.primaryModality || 'Unknown';
      if (!acc[modality]) acc[modality] = [];
      acc[modality].push(study);
      return acc;
    }, {});
  }, [studies]);

  const getStudiesWithReports = useCallback(() => {
    return studies.filter(study => {
      // Check if study has associated DiagnosticReport
      return orders.some(order => 
        order.code?.coding?.some(coding => 
          study.procedureCode?.some(proc => 
            proc.coding?.some(studyCoding => 
              studyCoding.code === coding.code
            )
          )
        )
      );
    });
  }, [studies, orders]);

  const getPerformerStats = useCallback(() => {
    const stats = {};
    performers.forEach(performer => {
      const performerStudies = studies.filter(study =>
        study.series?.some(series =>
          series.performer?.some(p =>
            p.actor?.reference?.includes(performer.id)
          )
        )
      );
      
      stats[performer.id] = {
        name: performer.name?.[0]?.family || 'Unknown',
        studyCount: performerStudies.length,
        modalities: [...new Set(performerStudies.flatMap(s => 
          s.modality?.map(m => m.code || m.display) || []
        ))]
      };
    });
    return stats;
  }, [studies, performers]);

  /**
   * Advanced analytics
   */
  const getSearchAnalytics = useCallback(() => {
    return {
      totalStudies: studies.length,
      totalResults: totalResults,
      modalityDistribution: getStudiesByModality(),
      dateRange: availableFilters.dateRange,
      searchMetrics,
      hasActiveFilters: Object.keys(searchParams).length > 0,
      performerStats: getPerformerStats()
    };
  }, [studies, totalResults, getStudiesByModality, availableFilters.dateRange, searchMetrics, searchParams, getPerformerStats]);

  /**
   * Export functionality
   */
  const exportSearchResults = useCallback((format = 'json') => {
    const exportData = {
      searchParams,
      studies,
      performers,
      orders,
      totalResults,
      exportDate: new Date().toISOString(),
      patientId
    };

    switch (format) {
      case 'json':
        return JSON.stringify(exportData, null, 2);
      case 'csv':
        return convertToCSV(studies);
      default:
        return exportData;
    }
  }, [searchParams, studies, performers, orders, totalResults, patientId]);

  const convertToCSV = (data) => {
    if (!data.length) return '';
    
    const headers = [
      'Study ID',
      'Description',
      'Modality',
      'Body Site',
      'Study Date',
      'Status',
      'Series Count',
      'Instance Count'
    ];
    
    const rows = data.map(study => [
      study.id,
      study.description || '',
      study._computedFields?.primaryModality || '',
      study.bodySite?.[0]?.display || '',
      study.started || '',
      study.status || '',
      study.numberOfSeries || 0,
      study._computedFields?.totalInstances || 0
    ]);
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
  };

  // Effects
  
  // Initial load
  useEffect(() => {
    if (patientId) {
      loadAvailableFilters();
      performSearch({});
    } else {
      setStudies([]);
      setPerformers([]);
      setOrders([]);
      setAvailableFilters({});
    }
  }, [patientId, loadAvailableFilters, performSearch]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    // Data
    studies,
    performers,
    orders,
    availableFilters,
    totalResults,
    searchParams,
    
    // State
    loading,
    error,
    hasMore,
    currentPage,
    pageSize,
    
    // Actions
    performSearch,
    debouncedSearch,
    loadMore,
    applyFilters,
    clearAllFilters,
    refreshStudies,
    loadAvailableFilters,
    
    // Specialized searches
    searchByModality,
    searchByDateRange,
    searchByPerformer,
    searchByAccessionNumber,
    searchByText,
    
    // Data transformations
    getStudiesByModality,
    getStudiesWithReports,
    getPerformerStats,
    getSearchAnalytics,
    
    // Export
    exportSearchResults,
    
    // Configuration
    setPageSize: (size) => {
      setPageSize(size);
      setCurrentPage(0);
      performSearch(searchParams);
    }
  };
};

export default useAdvancedImagingSearch;