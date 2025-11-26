/**
 * Hook for paginated FHIR Observation searches
 * Implements server-side pagination to reduce memory usage
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useFHIRResource } from '../../contexts/FHIRResourceContext';

export function usePaginatedObservations(patientId, options = {}) {
  const {
    category = null, // 'laboratory', 'vital-signs', etc.
    pageSize = 10,
    sort = '-date',
    code = null,
    dateRange = null, // { start: Date, end: Date }
    status = null
  } = options;

  const { searchResources, isResourceLoading, getError } = useFHIRResource();
  
  const [currentPage, setCurrentPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [observations, setObservations] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  
  // Build search parameters
  const searchParams = useMemo(() => {
    if (!patientId) return null;
    
    const params = {
      patient: patientId,
      _count: pageSize,
      _offset: currentPage * pageSize,
      _sort: sort,
      _summary: 'data' // Exclude narrative for performance
    };
    
    // Add filters
    if (category) {
      params.category = category;
    }
    
    if (code) {
      params.code = code;
    }
    
    if (status) {
      params.status = status;
    }
    
    if (dateRange) {
      if (dateRange.start) {
        params.date = `ge${dateRange.start.toISOString().split('T')[0]}`;
      }
      if (dateRange.end) {
        params.date = params.date 
          ? `${params.date}&le${dateRange.end.toISOString().split('T')[0]}`
          : `le${dateRange.end.toISOString().split('T')[0]}`;
      }
    }
    
    return params;
  }, [patientId, category, pageSize, currentPage, sort, code, dateRange, status]);
  
  // Load observations when parameters change
  const loadObservations = useCallback(async (forceRefresh = false) => {
    if (!searchParams) return;
    
    try {
      const result = await searchResources('Observation', searchParams, forceRefresh);
      
      // Handle different response formats from searchResources
      if (result) {
        // The searchResources might return resources directly or in a nested structure
        const resources = result.resources || result || [];
        const total = result.total || result.totalCount || resources.length || 0;
        
        setObservations(Array.isArray(resources) ? resources : []);
        setTotalCount(total);
        
        // Check if there are more pages
        const hasNextPage = result.bundle?.link?.some(link => link.relation === 'next') || false;
        setHasMore(hasNextPage || (total > (currentPage + 1) * pageSize));
      } else {
        // No result returned
        setObservations([]);
        setTotalCount(0);
        setHasMore(false);
      }
      
      return result;
    } catch (error) {
      console.error('Error loading observations:', error);
      // Error is handled by setting empty state
      setObservations([]);
      setTotalCount(0);
      setHasMore(false);
    }
  }, [searchParams, searchResources, currentPage, pageSize]);
  
  // Auto-load on parameter changes
  useEffect(() => {
    if (searchParams) {
      loadObservations();
    }
  }, [searchParams]); // loadObservations is stable due to useCallback
  
  // Pagination controls
  const goToPage = useCallback((page) => {
    setCurrentPage(page);
  }, []);
  
  const nextPage = useCallback(() => {
    if (hasMore) {
      setCurrentPage(prev => prev + 1);
    }
  }, [hasMore]);
  
  const previousPage = useCallback(() => {
    if (currentPage > 0) {
      setCurrentPage(prev => prev - 1);
    }
  }, [currentPage]);
  
  const refresh = useCallback(() => {
    return loadObservations(true);
  }, [loadObservations]);
  
  // Get current loading/error state
  const loading = isResourceLoading('Observation');
  const error = getError('Observation');
  
  return {
    observations,
    totalCount,
    currentPage,
    pageSize,
    totalPages: Math.ceil(totalCount / pageSize),
    hasMore,
    loading,
    error,
    goToPage,
    nextPage,
    previousPage,
    refresh,
    setCurrentPage
  };
}

// Hook for paginated DiagnosticReport searches
export function usePaginatedDiagnosticReports(patientId, options = {}) {
  const {
    status = null,
    category = null,
    pageSize = 10,
    sort = '-date'
  } = options;

  const { searchResources, isResourceLoading, getError } = useFHIRResource();
  
  const [currentPage, setCurrentPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [reports, setReports] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  
  const searchParams = useMemo(() => {
    if (!patientId) return null;
    
    const params = {
      patient: patientId,
      _count: pageSize,
      _offset: currentPage * pageSize,
      _sort: sort,
      _include: 'DiagnosticReport:result' // Include linked Observations
    };
    
    if (status) {
      params.status = status;
    }
    
    if (category) {
      params.category = category;
    }
    
    return params;
  }, [patientId, status, category, pageSize, currentPage, sort]);
  
  const loadReports = useCallback(async (forceRefresh = false) => {
    if (!searchParams) return;
    
    try {
      const result = await searchResources('DiagnosticReport', searchParams, forceRefresh);
      
      // Handle different response formats from searchResources
      if (result) {
        const resources = result.resources || result || [];
        const total = result.total || result.totalCount || resources.length || 0;
        
        setReports(Array.isArray(resources) ? resources : []);
        setTotalCount(total);
        
        const hasNextPage = result.bundle?.link?.some(link => link.relation === 'next') || false;
        setHasMore(hasNextPage || (total > (currentPage + 1) * pageSize));
      } else {
        setReports([]);
        setTotalCount(0);
        setHasMore(false);
      }
      
      return result;
    } catch (error) {
      console.error('Error loading diagnostic reports:', error);
      // Error is handled by setting empty state
      setReports([]);
      setTotalCount(0);
      setHasMore(false);
    }
  }, [searchParams, searchResources, currentPage, pageSize]);
  
  useEffect(() => {
    if (searchParams) {
      loadReports();
    }
  }, [searchParams]);
  
  const goToPage = useCallback((page) => {
    setCurrentPage(page);
  }, []);
  
  const loading = isResourceLoading('DiagnosticReport');
  const error = getError('DiagnosticReport');
  
  return {
    reports,
    totalCount,
    currentPage,
    pageSize,
    totalPages: Math.ceil(totalCount / pageSize),
    hasMore,
    loading,
    error,
    goToPage,
    setCurrentPage,
    refresh: () => loadReports(true)
  };
}