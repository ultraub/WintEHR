/**
 * Optimized hook for patient data with tab-specific optimizations
 * Implements FHIR best practices: _include, _summary, chained searches, and batch operations
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useFHIRResource } from '../contexts/FHIRResourceContext';
import { fhirClient } from '../core/fhir/services/fhirClient';
import { subDays } from 'date-fns';

export function useOptimizedPatientData(patientId, tabName, options = {}) {
  const {
    filters = {},
    forceRefresh = false,
    autoLoad = true
  } = options;

  const {
    searchResources,
    searchWithInclude,
    fetchPatientEverything,
    isResourceLoading,
    getPatientResources
  } = useFHIRResource();

  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Tab-specific optimization configurations
  const tabConfigs = {
    ChartReview: {
      useBatch: true,
      resources: ['Condition', 'MedicationRequest', 'AllergyIntolerance', 'Observation', 'Immunization'],
      includes: {
        MedicationRequest: ['MedicationRequest:medication', 'MedicationRequest:requester'],
        Condition: [],
        AllergyIntolerance: [],
        Observation: [],
        Immunization: []
      },
      counts: { Condition: 50, MedicationRequest: 50, AllergyIntolerance: 100, Observation: 20, Immunization: 50 },
      summary: 'data', // Exclude narrative
      serverFilters: true
    },
    Results: {
      useBatch: false, // Results uses pagination
      usePagination: true,
      resources: ['Observation', 'DiagnosticReport'],
      includes: {
        Observation: ['Observation:performer', 'Observation:based-on'],
        DiagnosticReport: ['DiagnosticReport:performer', 'DiagnosticReport:result']
      },
      pageSize: 10,
      summary: 'data'
    },
    Orders: {
      useBatch: true,
      useChainedSearch: true,
      resources: ['MedicationRequest', 'ServiceRequest'],
      includes: {
        MedicationRequest: ['MedicationRequest:medication', 'MedicationRequest:requester'],
        ServiceRequest: ['ServiceRequest:requester', 'ServiceRequest:performer']
      },
      counts: { MedicationRequest: 50, ServiceRequest: 50 },
      chainedSearches: {
        byDepartment: 'performer.organization.name',
        byProvider: 'requester.name'
      }
    },
    Timeline: {
      useEverything: true,
      progressiveLoad: true,
      resources: ['Encounter', 'Condition', 'MedicationRequest', 'Procedure', 'Observation', 'DiagnosticReport'],
      everythingCount: 200,
      dateFiltering: true
    },
    Summary: {
      useCountsOnly: true,
      useBatch: true,
      resources: ['Condition', 'MedicationRequest', 'Observation', 'AllergyIntolerance'],
      summary: 'count',
      serverFilters: {
        Condition: { 'clinical-status': 'active' },
        MedicationRequest: { status: 'active' },
        Observation: { 
          category: 'laboratory', 
          date: `ge${subDays(new Date(), 7).toISOString().split('T')[0]}` 
        }
      }
    },
    Encounters: {
      useBatch: true,
      resources: ['Encounter'],
      includes: {
        Encounter: ['Encounter:location', 'Encounter:participant']
      },
      revIncludes: ['Observation:encounter'],
      counts: { Encounter: 50 }
    }
  };

  const config = tabConfigs[tabName] || tabConfigs.ChartReview;

  // Optimized loading function based on tab configuration
  const loadOptimizedData = useCallback(async () => {
    if (!patientId || !autoLoad) return;
    
    setLoading(true);
    setError(null);
    
    try {
      if (config.useCountsOnly) {
        // Load counts only for summary views
        await loadCountsOnly();
      } else if (config.useEverything) {
        // Use $everything operation for timeline
        await loadWithEverything();
      } else if (config.useBatch) {
        // Use batch requests for multiple resources
        await loadWithBatch();
      } else if (config.usePagination) {
        // Use paginated loading for large datasets
        await loadWithPagination();
      } else {
        // Fallback to individual requests
        await loadIndividual();
      }
    } catch (err) {
      setError(err.message);
      // Fallback to original method
      const fallbackData = {};
      for (const resourceType of config.resources) {
        fallbackData[resourceType.toLowerCase()] = getPatientResources(patientId, resourceType) || [];
      }
      setData(fallbackData);
    } finally {
      setLoading(false);
    }
  }, [patientId, config, filters, forceRefresh]);

  // Load counts only (for Summary tab)
  const loadCountsOnly = async () => {
    const batchBundle = {
      resourceType: "Bundle",
      type: "batch",
      entry: []
    };

    config.resources.forEach(resourceType => {
      let query = `${resourceType}?patient=${patientId}&_summary=count`;
      
      // Add server filters
      if (config.serverFilters && config.serverFilters[resourceType]) {
        Object.entries(config.serverFilters[resourceType]).forEach(([param, value]) => {
          query += `&${param}=${value}`;
        });
      }

      batchBundle.entry.push({
        request: { method: "GET", url: query }
      });
    });

    const batchResult = await fhirClient.batch(batchBundle);
    const entries = batchResult.entry || [];
    
    const counts = {};
    config.resources.forEach((resourceType, index) => {
      counts[resourceType.toLowerCase()] = entries[index]?.resource?.total || 0;
    });
    
    setData(counts);
  };

  // Load with $everything operation (for Timeline tab)
  const loadWithEverything = async () => {
    const everythingOptions = {
      types: config.resources,
      count: config.everythingCount || 200,
      forceRefresh
    };
    
    // Add date filter if specified
    if (config.dateFiltering && filters.startDate) {
      everythingOptions.since = filters.startDate;
    }
    
    const result = await fetchPatientEverything(patientId, everythingOptions);
    
    // Process result into structured data
    const structuredData = {};
    if (result.bundle?.entry) {
      result.bundle.entry.forEach(entry => {
        const resource = entry.resource;
        if (!resource || !resource.resourceType) return;
        
        const resourceType = resource.resourceType.toLowerCase();
        if (!structuredData[resourceType]) {
          structuredData[resourceType] = [];
        }
        structuredData[resourceType].push(resource);
      });
    }
    
    setData(structuredData);
  };

  // Load with batch requests (for ChartReview, Orders tabs)
  const loadWithBatch = async () => {
    const batchBundle = {
      resourceType: "Bundle",
      type: "batch",
      entry: []
    };

    config.resources.forEach(resourceType => {
      let query = `${resourceType}?patient=${patientId}`;
      
      // Add summary parameter
      if (config.summary) {
        query += `&_summary=${config.summary}`;
      }
      
      // Add count
      if (config.counts && config.counts[resourceType]) {
        query += `&_count=${config.counts[resourceType]}`;
      }
      
      // Add includes
      if (config.includes && config.includes[resourceType]) {
        const includes = config.includes[resourceType];
        if (includes.length > 0) {
          query += `&_include=${includes.join(',')}`;
        }
      }
      
      // Add server-side filters
      if (config.serverFilters && filters[resourceType.toLowerCase()]) {
        Object.entries(filters[resourceType.toLowerCase()]).forEach(([param, value]) => {
          if (value && value !== 'all') {
            query += `&${param}=${value}`;
          }
        });
      }
      
      // Add default sort
      const sortMap = {
        Condition: '-recorded-date',
        MedicationRequest: '-authored-on',
        Observation: '-date',
        ServiceRequest: '-authored-on',
        Encounter: '-date',
        AllergyIntolerance: '-recorded-date',
        Immunization: '-date'
      };
      if (sortMap[resourceType]) {
        query += `&_sort=${sortMap[resourceType]}`;
      }

      batchBundle.entry.push({
        request: { method: "GET", url: query }
      });
    });

    const batchResult = await fhirClient.batch(batchBundle);
    const entries = batchResult.entry || [];
    
    const batchData = {};
    config.resources.forEach((resourceType, index) => {
      const bundle = entries[index]?.resource;
      const resources = bundle?.entry?.map(e => e.resource) || [];
      
      // Filter to only include the main resource type (not included resources)
      const mainResources = resources.filter(r => r.resourceType === resourceType);
      batchData[resourceType.toLowerCase()] = mainResources;
    });
    
    setData(batchData);
  };

  // Load with pagination (for Results tab)
  const loadWithPagination = async () => {
    // This would use the existing usePaginatedObservations hook
    // For now, fallback to regular loading
    await loadIndividual();
  };

  // Load individual resources (fallback method)
  const loadIndividual = async () => {
    const individualData = {};
    
    for (const resourceType of config.resources) {
      try {
        const params = {
          patient: patientId,
          _count: config.counts?.[resourceType] || 50
        };
        
        if (config.includes && config.includes[resourceType]) {
          const result = await searchWithInclude(resourceType, params, config.includes[resourceType]);
          individualData[resourceType.toLowerCase()] = result.resources || [];
        } else {
          const result = await searchResources(resourceType, params);
          individualData[resourceType.toLowerCase()] = result.resources || [];
        }
      } catch (err) {
        console.error(`Error loading ${resourceType}:`, err);
        individualData[resourceType.toLowerCase()] = [];
      }
    }
    
    setData(individualData);
  };

  // Refresh function
  const refresh = useCallback(() => {
    return loadOptimizedData();
  }, [loadOptimizedData]);

  // Load data on mount and when dependencies change
  useEffect(() => {
    loadOptimizedData();
  }, [loadOptimizedData]);

  // Memoized return value
  return useMemo(() => ({
    // Resource data
    ...data,
    
    // Individual resource arrays for backward compatibility
    conditions: data.condition || [],
    medications: data.medicationrequest || [],
    allergies: data.allergyintolerance || [],
    observations: data.observation || [],
    encounters: data.encounter || [],
    procedures: data.procedure || [],
    diagnosticReports: data.diagnosticreport || [],
    immunizations: data.immunization || [],
    serviceRequests: data.servicerequest || [],
    
    // State
    loading,
    error,
    
    // Actions
    refresh
  }), [data, loading, error, refresh]);
}

// Tab-specific convenience hooks
export const useChartReviewData = (patientId, filters = {}) => 
  useOptimizedPatientData(patientId, 'ChartReview', { filters });

export const useOrdersData = (patientId, filters = {}) => 
  useOptimizedPatientData(patientId, 'Orders', { filters });

export const useTimelineData = (patientId, filters = {}) => 
  useOptimizedPatientData(patientId, 'Timeline', { filters });

export const useSummaryData = (patientId) => 
  useOptimizedPatientData(patientId, 'Summary');

export default useOptimizedPatientData;