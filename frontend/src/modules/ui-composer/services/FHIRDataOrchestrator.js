/**
 * FHIR Data Orchestrator
 * Handles FHIR data fetching and aggregation for UI Composer
 */

import { fhirClient } from '../../../services/fhirClient';
import { 
  extractPatientDemographics,
  extractConditionInfo,
  extractObservationValue,
  extractMedicationInfo,
  extractVitalSigns,
  aggregateLabResults,
  calculateMedicationAdherence,
  createTimeSeriesData,
  calculateSummaryStats
} from '../utils/clinicalDataHelpers';

class FHIRDataOrchestrator {
  constructor() {
    this.cache = new Map();
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes
    this.pendingRequests = new Map();
  }

  /**
   * Fetch FHIR data based on data source specification
   */
  async fetchData(dataSource, context = {}) {
    const cacheKey = this.generateCacheKey(dataSource, context);
    
    // Check cache first
    const cached = this.getCachedData(cacheKey);
    if (cached) {
      return cached;
    }
    
    // Check if request is already pending
    if (this.pendingRequests.has(cacheKey)) {
      return await this.pendingRequests.get(cacheKey);
    }
    
    // Create new request
    const request = this.performFetch(dataSource, context);
    this.pendingRequests.set(cacheKey, request);
    
    try {
      const result = await request;
      this.setCachedData(cacheKey, result);
      return result;
    } finally {
      this.pendingRequests.delete(cacheKey);
    }
  }

  /**
   * Perform the actual FHIR fetch
   */
  async performFetch(dataSource, context) {
    try {
      const { resourceType, query = {}, transform } = dataSource;
      
      // Build FHIR query
      const fhirQuery = this.buildFHIRQuery(resourceType, query, context);
      
      // Fetch from FHIR API
      const response = await fhirClient.search(resourceType, fhirQuery);
      
      if (!response.entry) {
        return {
          success: true,
          data: [],
          metadata: {
            resourceType,
            count: 0,
            fetchedAt: new Date().toISOString()
          }
        };
      }
      
      // Extract resources
      const resources = response.entry.map(entry => entry.resource);
      
      // Apply transformation if specified
      let transformedData = resources;
      if (transform) {
        transformedData = await this.applyTransformation(resources, transform);
      }
      
      return {
        success: true,
        data: transformedData,
        metadata: {
          resourceType,
          count: transformedData.length,
          fetchedAt: new Date().toISOString(),
          query: fhirQuery
        }
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        metadata: {
          resourceType: dataSource.resourceType,
          fetchedAt: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Build FHIR query parameters
   */
  buildFHIRQuery(resourceType, query, context) {
    const fhirQuery = { ...query };
    
    // Add patient context if available
    if (context.patientId) {
      switch (resourceType) {
        case 'Observation':
        case 'Condition':
        case 'MedicationRequest':
        case 'MedicationDispense':
        case 'AllergyIntolerance':
        case 'Immunization':
        case 'DiagnosticReport':
        case 'Procedure':
          fhirQuery.patient = context.patientId;
          break;
        case 'Encounter':
          fhirQuery.patient = context.patientId;
          break;
        case 'Patient':
          if (!fhirQuery._id) {
            fhirQuery._id = context.patientId;
          }
          break;
      }
    }
    
    // Add encounter context if available
    if (context.encounterId) {
      switch (resourceType) {
        case 'Observation':
        case 'DiagnosticReport':
        case 'Procedure':
          fhirQuery.encounter = context.encounterId;
          break;
      }
    }
    
    // Add default sorting
    if (!fhirQuery._sort) {
      switch (resourceType) {
        case 'Observation':
          fhirQuery._sort = '-date';
          break;
        case 'Condition':
          fhirQuery._sort = '-recorded-date';
          break;
        case 'MedicationRequest':
          fhirQuery._sort = '-authored-on';
          break;
        case 'Patient':
          fhirQuery._sort = 'family,given';
          break;
        default:
          fhirQuery._sort = '-_lastUpdated';
      }
    }
    
    // Add default count limit
    if (!fhirQuery._count) {
      fhirQuery._count = 100;
    }
    
    return fhirQuery;
  }

  /**
   * Apply data transformation
   */
  async applyTransformation(resources, transform) {
    switch (transform.type) {
      case 'extract_demographics':
        return resources.map(extractPatientDemographics).filter(Boolean);
      
      case 'extract_conditions':
        return resources.map(extractConditionInfo).filter(Boolean);
      
      case 'extract_observations':
        return resources.map(extractObservationValue).filter(Boolean);
      
      case 'extract_medications':
        return resources.map(med => extractMedicationInfo(med)).filter(Boolean);
      
      case 'extract_vital_signs':
        return extractVitalSigns(resources);
      
      case 'aggregate_lab_results':
        return aggregateLabResults(resources);
      
      case 'time_series':
        return createTimeSeriesData(resources.map(extractObservationValue).filter(Boolean));
      
      case 'summary_stats':
        const values = resources.map(r => r.valueQuantity?.value).filter(Boolean);
        return calculateSummaryStats(values);
      
      case 'filter':
        return this.applyFilters(resources, transform.filters);
      
      case 'group_by':
        return this.groupResources(resources, transform.groupBy);
      
      case 'sort':
        return this.sortResources(resources, transform.sortBy);
      
      case 'limit':
        return resources.slice(0, transform.limit);
      
      case 'custom':
        if (transform.function) {
          return await transform.function(resources);
        }
        return resources;
      
      default:
        return resources;
    }
  }

  /**
   * Apply filters to resources
   */
  applyFilters(resources, filters) {
    return resources.filter(resource => {
      return filters.every(filter => {
        const value = this.getNestedValue(resource, filter.field);
        
        switch (filter.operator) {
          case 'equals':
            return value === filter.value;
          case 'not_equals':
            return value !== filter.value;
          case 'contains':
            return String(value).toLowerCase().includes(String(filter.value).toLowerCase());
          case 'greater_than':
            return Number(value) > Number(filter.value);
          case 'less_than':
            return Number(value) < Number(filter.value);
          case 'greater_equal':
            return Number(value) >= Number(filter.value);
          case 'less_equal':
            return Number(value) <= Number(filter.value);
          case 'in':
            return Array.isArray(filter.value) && filter.value.includes(value);
          case 'not_in':
            return Array.isArray(filter.value) && !filter.value.includes(value);
          case 'exists':
            return value !== undefined && value !== null;
          case 'not_exists':
            return value === undefined || value === null;
          default:
            return true;
        }
      });
    });
  }

  /**
   * Group resources by field
   */
  groupResources(resources, groupBy) {
    const groups = {};
    
    resources.forEach(resource => {
      const groupValue = this.getNestedValue(resource, groupBy);
      const key = String(groupValue || 'unknown');
      
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(resource);
    });
    
    return groups;
  }

  /**
   * Sort resources
   */
  sortResources(resources, sortBy) {
    return resources.sort((a, b) => {
      const aValue = this.getNestedValue(a, sortBy.field);
      const bValue = this.getNestedValue(b, sortBy.field);
      
      if (aValue === bValue) return 0;
      
      const result = aValue < bValue ? -1 : 1;
      return sortBy.order === 'desc' ? -result : result;
    });
  }

  /**
   * Get nested value from object
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
      if (current && typeof current === 'object') {
        return current[key];
      }
      return undefined;
    }, obj);
  }

  /**
   * Aggregate data from multiple sources
   */
  async aggregateData(dataSources, context = {}) {
    const results = await Promise.allSettled(
      dataSources.map(dataSource => this.fetchData(dataSource, context))
    );
    
    const aggregated = {
      success: true,
      data: {},
      metadata: {
        sources: dataSources.length,
        aggregatedAt: new Date().toISOString()
      }
    };
    
    results.forEach((result, index) => {
      const sourceId = dataSources[index].id;
      
      if (result.status === 'fulfilled') {
        aggregated.data[sourceId] = result.value;
      } else {
        aggregated.data[sourceId] = {
          success: false,
          error: result.reason.message
        };
      }
    });
    
    return aggregated;
  }

  /**
   * Generate cache key
   */
  generateCacheKey(dataSource, context) {
    const keyData = {
      resourceType: dataSource.resourceType,
      query: dataSource.query,
      transform: dataSource.transform,
      context: {
        patientId: context.patientId,
        encounterId: context.encounterId
      }
    };
    
    return JSON.stringify(keyData);
  }

  /**
   * Get cached data
   */
  getCachedData(cacheKey) {
    const cached = this.cache.get(cacheKey);
    if (!cached) return null;
    
    const now = Date.now();
    if (now - cached.timestamp > this.cacheTTL) {
      this.cache.delete(cacheKey);
      return null;
    }
    
    return cached.data;
  }

  /**
   * Set cached data
   */
  setCachedData(cacheKey, data) {
    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache() {
    const now = Date.now();
    
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.cacheTTL) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      ttl: this.cacheTTL
    };
  }

  /**
   * Preload data for common queries
   */
  async preloadData(context = {}) {
    const commonQueries = [
      { resourceType: 'Patient', id: 'patients' },
      { resourceType: 'Observation', id: 'observations' },
      { resourceType: 'Condition', id: 'conditions' },
      { resourceType: 'MedicationRequest', id: 'medications' }
    ];
    
    const preloadPromises = commonQueries.map(query => 
      this.fetchData(query, context).catch(error => ({
        success: false,
        error: error.message
      }))
    );
    
    await Promise.allSettled(preloadPromises);
  }
}

// Create singleton instance
const fhirDataOrchestrator = new FHIRDataOrchestrator();

export default fhirDataOrchestrator;