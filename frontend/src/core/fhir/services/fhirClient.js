/**
 * FHIR Client Service
 * 
 * A FHIR-endpoint-agnostic client that can work with any FHIR R4 server.
 * Discovers server capabilities and adapts functionality accordingly.
 */

import axios from 'axios';

class FHIRClient {
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || process.env.REACT_APP_FHIR_ENDPOINT || '/fhir/R4';
    this.auth = config.auth || null;
    this.capabilities = null;
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/fhir+json',
        'Accept': 'application/fhir+json'
      }
    });

    // Add auth interceptor if configured
    if (this.auth) {
      this.httpClient.interceptors.request.use(config => {
        if (this.auth.token) {
          config.headers.Authorization = `Bearer ${this.auth.token}`;
        }
        return config;
      });
    }

    // Initialize capabilities on creation
    this.discoverCapabilities();
  }

  /**
   * Discover server capabilities via metadata endpoint
   */
  async discoverCapabilities() {
    try {
      const response = await this.httpClient.get('/metadata');
      this.capabilities = response.data;
      return this.capabilities;
    } catch (error) {
      // Could not discover FHIR server capabilities - using defaults
      // Create default capabilities for common FHIR resources
      this.capabilities = this.getDefaultCapabilities();
      return this.capabilities;
    }
  }

  /**
   * Get default FHIR R4 capabilities when server metadata is unavailable
   */
  getDefaultCapabilities() {
    return {
      resourceType: 'CapabilityStatement',
      status: 'active',
      kind: 'instance',
      fhirVersion: '4.0.1',
      format: ['application/fhir+json'],
      rest: [{
        mode: 'server',
        resource: [
          { type: 'Patient', interaction: [{ code: 'read' }, { code: 'search-type' }, { code: 'create' }, { code: 'update' }, { code: 'delete' }] },
          { type: 'Observation', interaction: [{ code: 'read' }, { code: 'search-type' }, { code: 'create' }, { code: 'update' }, { code: 'delete' }] },
          { type: 'Condition', interaction: [{ code: 'read' }, { code: 'search-type' }, { code: 'create' }, { code: 'update' }, { code: 'delete' }] },
          { type: 'MedicationRequest', interaction: [{ code: 'read' }, { code: 'search-type' }, { code: 'create' }, { code: 'update' }, { code: 'delete' }] },
          { type: 'MedicationDispense', interaction: [{ code: 'read' }, { code: 'search-type' }, { code: 'create' }, { code: 'update' }, { code: 'delete' }] },
          { type: 'AllergyIntolerance', interaction: [{ code: 'read' }, { code: 'search-type' }, { code: 'create' }, { code: 'update' }, { code: 'delete' }] },
          { type: 'Encounter', interaction: [{ code: 'read' }, { code: 'search-type' }, { code: 'create' }, { code: 'update' }, { code: 'delete' }] },
          { type: 'ServiceRequest', interaction: [{ code: 'read' }, { code: 'search-type' }, { code: 'create' }, { code: 'update' }, { code: 'delete' }] },
          { type: 'DocumentReference', interaction: [{ code: 'read' }, { code: 'search-type' }, { code: 'create' }, { code: 'update' }, { code: 'delete' }] },
          { type: 'Procedure', interaction: [{ code: 'read' }, { code: 'search-type' }, { code: 'create' }, { code: 'update' }, { code: 'delete' }] },
          { type: 'ImagingStudy', interaction: [{ code: 'read' }, { code: 'search-type' }, { code: 'create' }, { code: 'update' }, { code: 'delete' }] },
          { type: 'Coverage', interaction: [{ code: 'read' }, { code: 'search-type' }, { code: 'create' }, { code: 'update' }, { code: 'delete' }] },
          { type: 'Organization', interaction: [{ code: 'read' }, { code: 'search-type' }, { code: 'create' }, { code: 'update' }, { code: 'delete' }] }
        ]
      }]
    };
  }

  /**
   * Check if server supports a specific resource type
   */
  supportsResource(resourceType) {
    if (!this.capabilities) {
      // No capabilities available, assuming resource is supported
      return true; // Assume support if no capabilities
    }
    
    const resources = this.capabilities.rest?.[0]?.resource || [];
    const isSupported = resources.some(r => r.type === resourceType);
    
    if (!isSupported) {
      // Resource type not found in server capabilities
      // For common FHIR R4 resources, assume support even if not in capabilities
      const commonResources = [
        'Patient', 'Observation', 'Condition', 'MedicationRequest', 
        'MedicationDispense', 'AllergyIntolerance', 'Encounter', 
        'ServiceRequest', 'DocumentReference', 'Procedure', 
        'ImagingStudy', 'Coverage', 'Organization'
      ];
      
      if (commonResources.includes(resourceType)) {
        return true;
      }
    }
    
    return isSupported;
  }

  /**
   * Check if server supports a specific operation
   */
  supportsOperation(resourceType, operation) {
    if (!this.capabilities) return true; // Assume support if no capabilities
    
    const resources = this.capabilities.rest?.[0]?.resource || [];
    const resource = resources.find(r => r.type === resourceType);
    if (!resource) return false;
    
    return resource.interaction?.some(i => i.code === operation);
  }

  /**
   * Create a new resource
   */
  async create(resourceType, resource) {
    if (!this.supportsResource(resourceType)) {
      // Server capabilities indicate resource may not be supported, attempting anyway
    }

    try {
      const response = await this.httpClient.post(`/${resourceType}`, resource);
      return {
        id: response.headers.location?.split('/').pop() || response.data?.id || resource.id,
        location: response.headers.location,
        etag: response.headers.etag,
        resource: response.data
      };
    } catch (error) {
      // Provide more helpful error messages
      if (error.response?.status === 400) {
        // FHIR Validation Error creating resource
        throw new Error(`Invalid ${resourceType} resource: ${error.response.data?.detail || error.message}`);
      } else if (error.response?.status === 404) {
        // Resource endpoint not found
        throw new Error(`Server does not support ${resourceType} resources`);
      } else {
        // Error creating resource
        throw error;
      }
    }
  }

  /**
   * Read a resource by ID
   */
  async read(resourceType, id) {
    const response = await this.httpClient.get(`/${resourceType}/${id}`);
    return response.data;
  }

  /**
   * Update a resource
   */
  async update(resourceType, id, resource) {
    // Ensure resource has correct ID
    resource.id = id;
    
    const response = await this.httpClient.put(`/${resourceType}/${id}`, resource);
    return {
      id: id,
      etag: response.headers.etag,
      lastModified: response.headers['last-modified']
    };
  }

  /**
   * Delete a resource
   */
  async delete(resourceType, id) {
    await this.httpClient.delete(`/${resourceType}/${id}`);
    return { deleted: true };
  }

  /**
   * Execute a batch request
   * @param {Array} requests - Array of request objects with method and url
   * @returns {Promise} Bundle response with results
   */
  async batch(requests) {
    const bundle = {
      resourceType: 'Bundle',
      type: 'batch',
      entry: requests.map(req => ({
        request: {
          method: req.method || 'GET',
          url: req.url
        },
        resource: req.resource // Include resource for POST/PUT requests
      }))
    };
    
    try {
      const response = await this.httpClient.post('/', bundle);
      
      // Extract resources from bundle response
      const results = response.data.entry?.map(entry => {
        if (entry.response?.status?.startsWith('2')) {
          return {
            success: true,
            resource: entry.resource,
            status: entry.response.status
          };
        } else {
          return {
            success: false,
            error: entry.response?.outcome || entry.response,
            status: entry.response?.status
          };
        }
      }) || [];
      
      return {
        resourceType: 'Bundle',
        type: 'batch-response',
        entry: response.data.entry,
        results
      };
    } catch (error) {
      throw new Error(`Batch request failed: ${error.message}`);
    }
  }

  /**
   * Search for resources
   */
  async search(resourceType, params = {}) {
    try {
      const response = await this.httpClient.get(`/${resourceType}`, { params });
      
      // Extract resources from bundle
      const bundle = response.data;
      const resources = bundle.entry?.map(entry => entry.resource) || [];
      
      return {
        resources,
        total: bundle.total || resources.length,
        bundle
      };
    } catch (error) {
      // Handle 404 errors for known missing resource types gracefully
      if (error.response?.status === 404) {
        const missingResourceTypes = ['List', 'MedicationDispense', 'Basic'];
        if (missingResourceTypes.includes(resourceType)) {
          // Resource type not supported by server - using empty result
          return {
            resources: [],
            total: 0,
            bundle: { resourceType: 'Bundle', entry: [] }
          };
        }
      }
      // Re-throw the error for other resource types or non-404 errors
      throw error;
    }
  }

  /**
   * Execute a custom operation
   */
  async operation(operation, resourceType = null, id = null, parameters = null) {
    let url = '';
    
    if (resourceType && id) {
      // Instance level operation
      url = `/${resourceType}/${id}/$${operation}`;
    } else if (resourceType) {
      // Type level operation
      url = `/${resourceType}/$${operation}`;
    } else {
      // System level operation
      url = `/$${operation}`;
    }

    const response = await this.httpClient.post(url, parameters);
    return response.data;
  }

  /**
   * Process a batch/transaction bundle
   */
  async batch(bundle) {
    if (!this.supportsOperation(null, 'transaction')) {
      throw new Error('Server does not support transaction bundles');
    }

    const response = await this.httpClient.post('/', bundle);
    return response.data;
  }

  /**
   * Get resource history
   */
  async history(resourceType, id = null) {
    let url = '';
    
    if (id) {
      url = `/${resourceType}/${id}/_history`;
    } else {
      url = `/${resourceType}/_history`;
    }

    const response = await this.httpClient.get(url);
    return response.data;
  }

  /**
   * Helper: Build a reference object
   */
  static reference(resourceType, id, display = null) {
    const ref = {
      reference: `${resourceType}/${id}`
    };
    if (display) {
      ref.display = display;
    }
    return ref;
  }

  /**
   * Helper: Extract ID from reference
   */
  static extractId(reference) {
    if (!reference) return null;
    
    // Handle string references
    if (typeof reference === 'string') {
      // Handle absolute URLs
      if (reference.startsWith('http://') || reference.startsWith('https://')) {
        const parts = reference.split('/');
        return parts[parts.length - 1];
      }
      // Handle relative references (ResourceType/id)
      return reference.split('/').pop();
    }
    
    // Handle reference objects
    if (reference.reference) {
      return FHIRClient.extractId(reference.reference);
    }
    
    return null;
  }

  // Instance method for backward compatibility
  extractId(reference) {
    return FHIRClient.extractId(reference);
  }

  /**
   * Helper: Build search query string
   */
  static buildSearchParams(criteria) {
    const params = new URLSearchParams();
    
    Object.entries(criteria).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach(v => params.append(key, v));
      } else if (value !== null && value !== undefined) {
        params.append(key, value);
      }
    });
    
    return params;
  }

  /**
   * Patient-specific convenience methods
   */
  async getPatient(id) {
    return this.read('Patient', id);
  }

  async searchPatients(params) {
    return this.search('Patient', params);
  }

  async getPatientEverything(id) {
    return this.operation('everything', 'Patient', id);
  }

  /**
   * Observation-specific convenience methods
   */
  async getObservations(patientId, category = null, count = 1000) {
    const params = { 
      patient: patientId,
      _count: count || 100,  // Reasonable default to prevent memory issues
      _sort: '-date'  // Sort by date descending
    };
    if (category) params.category = category;
    return this.search('Observation', params);
  }

  async getVitalSigns(patientId, count = 1000) {
    return this.getObservations(patientId, 'vital-signs', count);
  }

  async getLabResults(patientId, count = 1000) {
    return this.getObservations(patientId, 'laboratory', count);
  }

  /**
   * Medication-specific convenience methods
   */
  async getMedications(patientId, status = null, count = 1000) {
    const params = { 
      patient: patientId,
      _count: count || 50,  // Reasonable default to prevent memory issues
      _sort: '-authoredon'  // Sort by authored date descending
    };
    if (status) {
      params.status = status;
    }
    return this.search('MedicationRequest', params);
  }

  /**
   * Condition-specific convenience methods
   */
  async getConditions(patientId, clinicalStatus = 'active', count = 1000) {
    return this.search('Condition', {
      patient: patientId,
      'clinical-status': clinicalStatus,
      _count: count || 50,  // Reasonable default to prevent memory issues
      _sort: '-recorded-date'  // Sort by recorded date descending
    });
  }

  /**
   * Encounter-specific convenience methods
   */
  async getEncounters(patientId, status = null, count = 1000) {
    const params = { 
      patient: patientId,
      _count: count || 30,  // Reasonable default to prevent memory issues
      _sort: '-date'  // Sort by date descending
    };
    if (status) params.status = status;
    return this.search('Encounter', params);
  }

  /**
   * AllergyIntolerance-specific convenience methods
   */
  async getAllergies(patientId, count = 1000) {
    return this.search('AllergyIntolerance', {
      patient: patientId,
      _count: count || 30,  // Reasonable default to prevent memory issues
      _sort: '-date'  // Sort by date descending
    });
  }

  /**
   * Coverage-specific convenience methods
   */
  async getCoverage(patientId) {
    return this.search('Coverage', {
      beneficiary: patientId
    });
  }

  async getCoverageById(id) {
    return this.read('Coverage', id);
  }

  async getActiveCoverage(patientId) {
    return this.search('Coverage', {
      beneficiary: patientId,
      status: 'active'
    });
  }

  async createCoverage(coverage) {
    return this.create('Coverage', coverage);
  }

  async updateCoverage(id, coverage) {
    return this.update('Coverage', id, coverage);
  }

  /**
   * Organization-specific convenience methods for payers
   */
  async getPayers() {
    return this.search('Organization', {
      type: 'payer'
    });
  }

  /**
   * ImagingStudy-specific convenience methods
   */
  async getImagingStudies(patientId, count = 1000) {
    return this.search('ImagingStudy', {
      patient: patientId,
      _sort: '-started',
      _count: count || 30  // Reasonable default to prevent memory issues
    });
  }

  async getImagingStudy(studyId) {
    return this.read('ImagingStudy', studyId);
  }

  /**
   * DocumentReference-specific convenience methods
   */
  async getDocumentReferences(patientId, count = 1000) {
    return this.search('DocumentReference', {
      patient: patientId,
      _sort: '-date',
      _count: count || 30  // Reasonable default to prevent memory issues
    });
  }

  async getDocumentReference(documentId) {
    return this.read('DocumentReference', documentId);
  }

  /**
   * Performance-optimized endpoints
   */
  async getPatientBundleOptimized(patientId, options = {}) {
    const {
      resourceTypes = null,
      limit = 100,
      priority = 'all'
    } = options;
    
    const params = {
      limit,
      priority
    };
    
    if (resourceTypes && Array.isArray(resourceTypes)) {
      params.resource_types = resourceTypes.join(',');
    }
    
    const response = await this.httpClient.get(`/Patient/${patientId}/$bundle-optimized`, {
      params
    });
    
    return response.data;
  }
  
  async getPatientTimelineOptimized(patientId, options = {}) {
    const {
      days = 365,
      limit = 100,
      resourceTypes = null
    } = options;
    
    const params = {
      days,
      limit
    };
    
    if (resourceTypes && Array.isArray(resourceTypes)) {
      params.resource_types = resourceTypes.join(',');
    }
    
    const response = await this.httpClient.get(`/Patient/${patientId}/$timeline`, {
      params
    });
    
    return response.data;
  }
  
  async getPatientSummaryOptimized(patientId) {
    const response = await this.httpClient.get(`/Patient/${patientId}/$summary`);
    return response.data;
  }

  /**
   * Procedure-specific convenience methods
   */
  async getProcedures(patientId, count = 1000) {
    return this.search('Procedure', {
      patient: patientId,
      _sort: '-performed-date',
      _count: count || 50  // Reasonable default to prevent memory issues
    });
  }

  async getProcedure(procedureId) {
    return this.read('Procedure', procedureId);
  }

  async createProcedure(procedure) {
    return this.create('Procedure', procedure);
  }

  async updateProcedure(id, procedure) {
    return this.update('Procedure', id, procedure);
  }

  /**
   * Enhanced observation search with value-quantity filtering
   * Supports FHIR R4 value-quantity search parameters with operators
   */
  async searchObservationsWithValueFilter(patientId, filters = {}) {
    const params = {
      patient: patientId,
      _sort: '-date',
      _count: filters.limit || 50  // Reasonable default
    };

    // Add code filter if specified
    if (filters.code) {
      params.code = `http://loinc.org|${filters.code}`;
    }

    // Add value-quantity filter
    if (filters.valueFilter) {
      const { operator, value, unit } = filters.valueFilter;
      let valueQuantityParam = `${operator}${value}`;
      
      if (unit) {
        valueQuantityParam += `|http://unitsofmeasure.org|${unit}`;
      }
      
      params['value-quantity'] = valueQuantityParam;
    }

    // Add category filter if specified
    if (filters.category) {
      params.category = filters.category;
    }

    // Add date range filters
    if (filters.dateFrom || filters.dateTo) {
      const dateParams = [];
      if (filters.dateFrom) {
        dateParams.push(`ge${filters.dateFrom}`);
      }
      if (filters.dateTo) {
        dateParams.push(`le${filters.dateTo}`);
      }
      
      if (dateParams.length === 1) {
        params.date = dateParams[0];
      } else if (dateParams.length === 2) {
        // Handle multiple date parameters for range queries
        const response = await this.httpClient.get('/Observation', {
          params: {
            ...params,
            date: dateParams
          },
          paramsSerializer: (params) => {
            // Handle multiple date parameters correctly for FHIR
            return Object.entries(params)
              .flatMap(([key, value]) => 
                Array.isArray(value) 
                  ? value.map(v => `${key}=${encodeURIComponent(v)}`)
                  : [`${key}=${encodeURIComponent(value)}`]
              )
              .join('&');
          }
        });
        
        const bundle = response.data;
        const resources = bundle.entry?.map(entry => entry.resource) || [];
        
        return {
          resources,
          total: bundle.total || resources.length,
          bundle
        };
      }
    }

    const response = await this.search('Observation', params);
    return response;
  }

  /**
   * Search for critical lab values using predefined thresholds
   * Uses value-quantity search to identify abnormal results
   */
  async searchCriticalLabValues(patientId, timeframe = '24h') {
    const criticalValueDefinitions = [
      // Glucose critical values
      { code: '2339-0', name: 'Glucose', operator: 'gt', value: 400, unit: 'mg/dL', severity: 'critical' },
      { code: '2339-0', name: 'Glucose', operator: 'lt', value: 40, unit: 'mg/dL', severity: 'critical' },
      
      // Hemoglobin critical values
      { code: '718-7', name: 'Hemoglobin', operator: 'lt', value: 6, unit: 'g/dL', severity: 'critical' },
      { code: '718-7', name: 'Hemoglobin', operator: 'gt', value: 20, unit: 'g/dL', severity: 'critical' },
      
      // Creatinine critical values
      { code: '2160-0', name: 'Creatinine', operator: 'gt', value: 4.0, unit: 'mg/dL', severity: 'critical' },
      
      // Potassium critical values
      { code: '6298-4', name: 'Potassium', operator: 'gt', value: 6.5, unit: 'mEq/L', severity: 'critical' },
      { code: '6298-4', name: 'Potassium', operator: 'lt', value: 2.5, unit: 'mEq/L', severity: 'critical' },
      
      // Sodium critical values
      { code: '2947-0', name: 'Sodium', operator: 'gt', value: 155, unit: 'mEq/L', severity: 'critical' },
      { code: '2947-0', name: 'Sodium', operator: 'lt', value: 125, unit: 'mEq/L', severity: 'critical' },
      
      // Troponin critical values
      { code: '6598-7', name: 'Troponin', operator: 'gt', value: 0.04, unit: 'ng/mL', severity: 'critical' }
    ];

    const cutoffDate = new Date();
    if (timeframe === '24h') {
      cutoffDate.setHours(cutoffDate.getHours() - 24);
    } else if (timeframe === '7d') {
      cutoffDate.setDate(cutoffDate.getDate() - 7);
    } else if (timeframe === '30d') {
      cutoffDate.setDate(cutoffDate.getDate() - 30);
    }

    const criticalResults = [];

    for (const definition of criticalValueDefinitions) {
      try {
        const results = await this.searchObservationsWithValueFilter(patientId, {
          code: definition.code,
          valueFilter: {
            operator: definition.operator,
            value: definition.value,
            unit: definition.unit
          },
          dateFrom: cutoffDate.toISOString()
        });

        if (results.resources && results.resources.length > 0) {
          criticalResults.push({
            definition,
            results: results.resources,
            count: results.resources.length
          });
        }
      } catch (error) {
        console.error(`Error searching for critical values: ${definition.name}`, error);
      }
    }

    return criticalResults;
  }

  /**
   * Search observations with multiple value filters (OR logic)
   * Useful for finding results matching any of several critical thresholds
   */
  async searchObservationsWithMultipleValueFilters(patientId, filters = []) {
    const allResults = [];
    const seenIds = new Set();

    for (const filter of filters) {
      try {
        const results = await this.searchObservationsWithValueFilter(patientId, filter);
        
        // Add unique results to avoid duplicates
        results.resources.forEach(result => {
          if (!seenIds.has(result.id)) {
            seenIds.add(result.id);
            allResults.push(result);
          }
        });
      } catch (error) {
        console.error('Error in multi-filter search:', error);
      }
    }

    // Sort by date descending
    allResults.sort((a, b) => {
      const dateA = new Date(a.effectiveDateTime || a.issued || 0);
      const dateB = new Date(b.effectiveDateTime || b.issued || 0);
      return dateB - dateA;
    });

    return {
      resources: allResults,
      total: allResults.length,
      bundle: {
        resourceType: 'Bundle',
        type: 'searchset',
        total: allResults.length,
        entry: allResults.map(resource => ({ resource }))
      }
    };
  }

  /**
   * Search observations with range-based value filtering
   * Supports finding values within or outside specified ranges
   */
  async searchObservationsInValueRange(patientId, options = {}) {
    const { code, minValue, maxValue, unit, dateFrom, dateTo, excludeRange = false } = options;

    if (excludeRange) {
      // Find values outside the range (less than min OR greater than max)
      const filters = [];
      
      if (minValue !== undefined) {
        filters.push({
          code,
          valueFilter: { operator: 'lt', value: minValue, unit },
          dateFrom,
          dateTo
        });
      }
      
      if (maxValue !== undefined) {
        filters.push({
          code,
          valueFilter: { operator: 'gt', value: maxValue, unit },
          dateFrom,
          dateTo
        });
      }
      
      return this.searchObservationsWithMultipleValueFilters(patientId, filters);
    } else {
      // Find values within the range (greater than min AND less than max)
      const params = {
        patient: patientId,
        _sort: '-date',
        _count: 100  // Reasonable default
      };

      if (code) {
        params.code = `http://loinc.org|${code}`;
      }

      // For range queries, we need to make multiple calls or use server-side filtering
      // This is a simplified implementation - a production system might need more sophisticated handling
      if (minValue !== undefined && maxValue !== undefined) {
        // Search for values >= minValue
        const minResults = await this.searchObservationsWithValueFilter(patientId, {
          code,
          valueFilter: { operator: 'ge', value: minValue, unit },
          dateFrom,
          dateTo
        });

        // Filter client-side for values <= maxValue
        const rangeResults = minResults.resources.filter(obs => {
          const value = obs.valueQuantity?.value;
          return value !== undefined && value <= maxValue;
        });

        return {
          resources: rangeResults,
          total: rangeResults.length,
          bundle: {
            resourceType: 'Bundle',
            type: 'searchset',
            total: rangeResults.length,
            entry: rangeResults.map(resource => ({ resource }))
          }
        };
      } else if (minValue !== undefined) {
        return this.searchObservationsWithValueFilter(patientId, {
          code,
          valueFilter: { operator: 'ge', value: minValue, unit },
          dateFrom,
          dateTo
        });
      } else if (maxValue !== undefined) {
        return this.searchObservationsWithValueFilter(patientId, {
          code,
          valueFilter: { operator: 'le', value: maxValue, unit },
          dateFrom,
          dateTo
        });
      }
    }

    // Fallback to regular search if no value constraints
    return this.searchObservationsWithValueFilter(patientId, { code, dateFrom, dateTo });
  }
}

// Export singleton instance for common use
export const fhirClient = new FHIRClient();

// Also export class for custom instances
export default FHIRClient;