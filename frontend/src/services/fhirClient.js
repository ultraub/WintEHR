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
    
    // For system-level operations (resourceType = null), check system interactions
    if (resourceType === null) {
      const systemInteractions = this.capabilities.rest?.[0]?.interaction || [];
      return systemInteractions.some(i => i.code === operation);
    }
    
    // For resource-specific operations, check resource interactions
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
    // Ensure capabilities are loaded
    if (!this.capabilities) {
      await this.discoverCapabilities();
    }
    
    // Check if server supports batch operations
    if (!this.supportsOperation(null, 'batch') && !this.supportsOperation(null, 'transaction')) {
      throw new Error('Server does not support batch or transaction bundles');
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
      _count: count,  // Default to 1000 to ensure we get all observations
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
      _count: count,  // Default to 1000 to ensure we get all medications
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
      _count: count,  // Default to 1000 to ensure we get all conditions
      _sort: '-recorded-date'  // Sort by recorded date descending
    });
  }

  /**
   * Encounter-specific convenience methods
   */
  async getEncounters(patientId, status = null, count = 1000) {
    const params = { 
      patient: patientId,
      _count: count,  // Default to 1000 to ensure we get all encounters
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
      _count: count,  // Default to 1000 to ensure we get all allergies
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
      _count: count  // Default to 1000 to ensure we get all imaging studies
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
      _count: count  // Default to 1000 to ensure we get all documents
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
      _count: count  // Default to 1000 to ensure we get all procedures
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
}

// Export singleton instance for common use
export const fhirClient = new FHIRClient();

// Also export class for custom instances
export default FHIRClient;