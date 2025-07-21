/**
 * Enhanced FHIR Client Service
 * 
 * A FHIR-endpoint-agnostic client with advanced features:
 * - TypeScript support with full FHIR R4 types
 * - Request/response interceptors
 * - Automatic retry with exponential backoff
 * - Smart caching with TTL
 * - Request queuing and rate limiting
 * - Batch operations support
 * 
 * @since 2025-01-21
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import type { 
  FHIRResource, 
  Patient, 
  Condition, 
  MedicationRequest, 
  AllergyIntolerance,
  Observation,
  Encounter,
  Procedure,
  Immunization,
  ServiceRequest,
  DiagnosticReport,
  Coverage,
  Bundle,
  BundleEntry,
  OperationOutcome,
  Reference,
  SearchResult,
  ResourceType
} from '../types';

// Cache configuration
interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface CacheConfig {
  defaultTTL: number;
  maxSize: number;
  enabled: boolean;
}

// Request queue configuration
interface QueueConfig {
  maxConcurrent: number;
  requestsPerSecond: number;
  retryAttempts: number;
  retryDelay: number;
  retryMultiplier: number;
  maxRetryDelay: number;
}

// Interceptor types
type RequestInterceptor = (config: AxiosRequestConfig) => AxiosRequestConfig | Promise<AxiosRequestConfig>;
type ResponseInterceptor = (response: AxiosResponse) => AxiosResponse | Promise<AxiosResponse>;
type ErrorInterceptor = (error: AxiosError) => Promise<any>;

// FHIR Client configuration
interface FHIRClientConfig {
  baseUrl?: string;
  auth?: {
    token?: string;
    type?: 'Bearer' | 'Basic';
  };
  cache?: Partial<CacheConfig>;
  queue?: Partial<QueueConfig>;
  interceptors?: {
    request?: RequestInterceptor[];
    response?: ResponseInterceptor[];
    error?: ErrorInterceptor[];
  };
}

// Search parameters type
type SearchParams = Record<string, string | number | boolean | string[] | undefined>;

// Batch request type
interface BatchRequest {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  url: string;
  resource?: FHIRResource;
}

interface BatchResult {
  success: boolean;
  resource?: FHIRResource;
  error?: OperationOutcome;
  status: string;
}

class FHIRClient {
  private httpClient: AxiosInstance;
  private baseUrl: string;
  private cache: Map<string, CacheEntry>;
  private cacheConfig: CacheConfig;
  private queueConfig: QueueConfig;
  private requestQueue: Array<() => Promise<any>>;
  private activeRequests: number;
  private capabilities: any;
  private requestInterceptors: RequestInterceptor[];
  private responseInterceptors: ResponseInterceptor[];
  private errorInterceptors: ErrorInterceptor[];

  constructor(config: FHIRClientConfig = {}) {
    // Configure base URL
    this.baseUrl = config.baseUrl || process.env.REACT_APP_FHIR_ENDPOINT || '/fhir/R4';
    
    // Configure cache
    this.cache = new Map();
    this.cacheConfig = {
      defaultTTL: 5 * 60 * 1000, // 5 minutes default
      maxSize: 100,
      enabled: true,
      ...config.cache
    };

    // Configure request queue
    this.queueConfig = {
      maxConcurrent: 5,
      requestsPerSecond: 10,
      retryAttempts: 3,
      retryDelay: 1000,
      retryMultiplier: 2,
      maxRetryDelay: 30000,
      ...config.queue
    };

    this.requestQueue = [];
    this.activeRequests = 0;

    // Initialize interceptors
    this.requestInterceptors = config.interceptors?.request || [];
    this.responseInterceptors = config.interceptors?.response || [];
    this.errorInterceptors = config.interceptors?.error || [];

    // Create axios instance
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/fhir+json',
        'Accept': 'application/fhir+json'
      }
    });

    // Setup interceptors
    this.setupInterceptors(config);
    
    // Start queue processor
    this.startQueueProcessor();
  }

  /**
   * Setup axios interceptors
   */
  private setupInterceptors(config: FHIRClientConfig): void {
    // Add auth interceptor if configured
    if (config.auth) {
      this.httpClient.interceptors.request.use(axiosConfig => {
        if (config.auth?.token) {
          axiosConfig.headers.Authorization = `${config.auth.type || 'Bearer'} ${config.auth.token}`;
        }
        return axiosConfig;
      });
    }

    // Add custom request interceptors
    this.requestInterceptors.forEach(interceptor => {
      this.httpClient.interceptors.request.use(interceptor);
    });

    // Add response interceptors
    this.responseInterceptors.forEach(interceptor => {
      this.httpClient.interceptors.response.use(interceptor);
    });

    // Add error handling with retry logic
    this.httpClient.interceptors.response.use(
      response => response,
      async (error: AxiosError) => {
        // Check if we should retry
        const config = error.config as any;
        const retryCount = config._retryCount || 0;
        
        if (this.shouldRetry(error) && retryCount < this.queueConfig.retryAttempts) {
          config._retryCount = retryCount + 1;
          
          // Calculate delay with exponential backoff
          const delay = Math.min(
            this.queueConfig.retryDelay * Math.pow(this.queueConfig.retryMultiplier, retryCount),
            this.queueConfig.maxRetryDelay
          );
          
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, delay));
          
          // Retry the request
          return this.httpClient.request(config);
        }

        // Run custom error interceptors
        for (const interceptor of this.errorInterceptors) {
          try {
            return await interceptor(error);
          } catch (e) {
            // Continue to next interceptor
          }
        }

        // Enhance error message
        return Promise.reject(this.enhanceError(error));
      }
    );
  }

  /**
   * Check if request should be retried
   */
  private shouldRetry(error: AxiosError): boolean {
    if (!error.response) {
      // Network error - retry
      return true;
    }

    const status = error.response.status;
    
    // Retry on 5xx errors or specific 4xx errors
    return status >= 500 || status === 408 || status === 429;
  }

  /**
   * Enhance error with more context
   */
  private enhanceError(error: AxiosError): Error {
    if (error.response?.status === 400) {
      const detail = (error.response.data as any)?.detail || error.message;
      return new Error(`FHIR Validation Error: ${detail}`);
    } else if (error.response?.status === 404) {
      return new Error('Resource not found');
    } else if (error.response?.status === 401) {
      return new Error('Unauthorized - please check authentication');
    } else if (error.response?.status === 403) {
      return new Error('Forbidden - insufficient permissions');
    }
    
    return error as any;
  }

  /**
   * Start the request queue processor
   */
  private startQueueProcessor(): void {
    setInterval(() => {
      this.processQueue();
    }, 1000 / this.queueConfig.requestsPerSecond);
  }

  /**
   * Process queued requests
   */
  private async processQueue(): Promise<void> {
    while (this.requestQueue.length > 0 && this.activeRequests < this.queueConfig.maxConcurrent) {
      const request = this.requestQueue.shift();
      if (request) {
        this.activeRequests++;
        try {
          await request();
        } finally {
          this.activeRequests--;
        }
      }
    }
  }

  /**
   * Queue a request
   */
  private queueRequest<T>(request: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await request();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.processQueue();
    });
  }

  /**
   * Get from cache
   */
  private getFromCache<T>(key: string): T | null {
    if (!this.cacheConfig.enabled) return null;

    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set in cache
   */
  private setInCache<T>(key: string, data: T, ttl?: number): void {
    if (!this.cacheConfig.enabled) return;

    // Enforce max cache size
    if (this.cache.size >= this.cacheConfig.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.cacheConfig.defaultTTL
    });
  }

  /**
   * Clear cache
   */
  public clearCache(pattern?: string): void {
    if (pattern) {
      // Clear entries matching pattern
      const regex = new RegExp(pattern);
      Array.from(this.cache.keys()).forEach(key => {
        if (regex.test(key)) {
          this.cache.delete(key);
        }
      });
    } else {
      // Clear all
      this.cache.clear();
    }
  }

  /**
   * Add request interceptor
   */
  public addRequestInterceptor(interceptor: RequestInterceptor): void {
    this.requestInterceptors.push(interceptor);
    this.httpClient.interceptors.request.use(interceptor);
  }

  /**
   * Add response interceptor
   */
  public addResponseInterceptor(interceptor: ResponseInterceptor): void {
    this.responseInterceptors.push(interceptor);
    this.httpClient.interceptors.response.use(interceptor);
  }

  /**
   * Add error interceptor
   */
  public addErrorInterceptor(interceptor: ErrorInterceptor): void {
    this.errorInterceptors.push(interceptor);
  }

  /**
   * Discover server capabilities
   */
  async discoverCapabilities(): Promise<any> {
    const cacheKey = 'capabilities';
    const cached = this.getFromCache<any>(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.httpClient.get('/metadata');
      this.capabilities = response.data;
      this.setInCache(cacheKey, this.capabilities, 60 * 60 * 1000); // Cache for 1 hour
      return this.capabilities;
    } catch (error) {
      // Create default capabilities
      this.capabilities = this.getDefaultCapabilities();
      return this.capabilities;
    }
  }

  /**
   * Get default capabilities
   */
  private getDefaultCapabilities(): any {
    return {
      resourceType: 'CapabilityStatement',
      status: 'active',
      kind: 'instance',
      fhirVersion: '4.0.1',
      format: ['application/fhir+json'],
      rest: [{
        mode: 'server',
        resource: [
          'Patient', 'Observation', 'Condition', 'MedicationRequest',
          'MedicationDispense', 'AllergyIntolerance', 'Encounter',
          'ServiceRequest', 'DocumentReference', 'Procedure',
          'ImagingStudy', 'Coverage', 'Organization', 'Practitioner',
          'Immunization', 'DiagnosticReport', 'CarePlan', 'Goal'
        ].map(type => ({
          type,
          interaction: [
            { code: 'read' }, { code: 'search-type' }, 
            { code: 'create' }, { code: 'update' }, { code: 'delete' }
          ]
        }))
      }]
    };
  }

  /**
   * Create a resource
   */
  async create<T extends FHIRResource>(resourceType: T['resourceType'], resource: Omit<T, 'id' | 'meta'>): Promise<T> {
    return this.queueRequest(async () => {
      const response = await this.httpClient.post<T>(`/${resourceType}`, resource);
      
      // Clear related cache
      this.clearCache(`${resourceType}.*`);
      
      return response.data;
    });
  }

  /**
   * Read a resource by ID
   */
  async read<T extends FHIRResource>(resourceType: T['resourceType'], id: string): Promise<T> {
    const cacheKey = `${resourceType}/${id}`;
    const cached = this.getFromCache<T>(cacheKey);
    if (cached) return cached;

    return this.queueRequest(async () => {
      const response = await this.httpClient.get<T>(`/${resourceType}/${id}`);
      const resource = response.data;
      
      this.setInCache(cacheKey, resource);
      return resource;
    });
  }

  /**
   * Update a resource
   */
  async update<T extends FHIRResource>(resourceType: T['resourceType'], id: string, resource: T): Promise<T> {
    // Ensure resource has correct ID
    resource.id = id;
    
    return this.queueRequest(async () => {
      const response = await this.httpClient.put<T>(`/${resourceType}/${id}`, resource);
      
      // Clear cache for this resource and searches
      this.clearCache(`${resourceType}/${id}`);
      this.clearCache(`${resourceType}\\?.*`);
      
      return response.data;
    });
  }

  /**
   * Delete a resource
   */
  async delete(resourceType: ResourceType, id: string): Promise<void> {
    return this.queueRequest(async () => {
      await this.httpClient.delete(`/${resourceType}/${id}`);
      
      // Clear cache
      this.clearCache(`${resourceType}/${id}`);
      this.clearCache(`${resourceType}\\?.*`);
    });
  }

  /**
   * Search for resources
   */
  async search<T extends FHIRResource>(
    resourceType: T['resourceType'], 
    params: SearchParams = {}
  ): Promise<SearchResult<T>> {
    const queryString = new URLSearchParams(
      Object.entries(params)
        .filter(([_, value]) => value !== undefined && value !== null)
        .map(([key, value]) => [key, String(value)])
    ).toString();
    
    const cacheKey = `${resourceType}?${queryString}`;
    const cached = this.getFromCache<SearchResult<T>>(cacheKey);
    if (cached) return cached;

    return this.queueRequest(async () => {
      try {
        const response = await this.httpClient.get<Bundle>(`/${resourceType}`, { params });
        
        // Extract resources from bundle
        const bundle = response.data;
        const resources = (bundle.entry?.map(entry => entry.resource) || []) as T[];
        
        const result: SearchResult<T> = {
          resources,
          total: bundle.total || resources.length,
          bundle
        };
        
        this.setInCache(cacheKey, result);
        return result;
      } catch (error: any) {
        // Handle 404 for unsupported resource types
        if (error.response?.status === 404) {
          const emptyResult: SearchResult<T> = {
            resources: [],
            total: 0,
            bundle: { resourceType: 'Bundle', type: 'searchset', entry: [] }
          };
          return emptyResult;
        }
        throw error;
      }
    });
  }

  /**
   * Execute a batch of requests
   */
  async batch(requests: BatchRequest[]): Promise<BatchResult[]> {
    const bundle: Bundle = {
      resourceType: 'Bundle',
      type: 'batch',
      entry: requests.map(req => ({
        request: {
          method: req.method,
          url: req.url
        },
        resource: req.resource
      } as BundleEntry))
    };
    
    return this.queueRequest(async () => {
      const response = await this.httpClient.post<Bundle>('/', bundle);
      
      // Process results
      const results: BatchResult[] = response.data.entry?.map(entry => {
        const status = entry.response?.status || '';
        const success = status.startsWith('2');
        
        return {
          success,
          resource: entry.resource,
          error: success ? undefined : entry.response?.outcome as OperationOutcome,
          status
        };
      }) || [];
      
      return results;
    });
  }

  /**
   * Batch update multiple resources
   */
  async batchUpdate<T extends FHIRResource>(resources: T[]): Promise<BatchResult[]> {
    const requests: BatchRequest[] = resources.map(resource => ({
      method: 'PUT',
      url: `${resource.resourceType}/${resource.id}`,
      resource
    }));
    
    return this.batch(requests);
  }

  /**
   * Batch create multiple resources
   */
  async batchCreate<T extends FHIRResource>(resources: Omit<T, 'id' | 'meta'>[]): Promise<BatchResult[]> {
    const requests: BatchRequest[] = resources.map(resource => ({
      method: 'POST',
      url: resource.resourceType,
      resource: resource as FHIRResource
    }));
    
    return this.batch(requests);
  }

  /**
   * Execute a transaction bundle
   */
  async transaction(bundle: Bundle): Promise<Bundle> {
    if (bundle.type !== 'transaction') {
      throw new Error('Bundle must be of type "transaction"');
    }
    
    return this.queueRequest(async () => {
      const response = await this.httpClient.post<Bundle>('/', bundle);
      return response.data;
    });
  }

  /**
   * Execute a custom operation
   */
  async operation<T = any>(
    operation: string,
    resourceType?: ResourceType,
    id?: string,
    parameters?: any
  ): Promise<T> {
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

    return this.queueRequest(async () => {
      const response = await this.httpClient.post<T>(url, parameters);
      return response.data;
    });
  }

  /**
   * Get resource history
   */
  async history(resourceType: ResourceType, id?: string): Promise<Bundle> {
    const url = id 
      ? `/${resourceType}/${id}/_history`
      : `/${resourceType}/_history`;
    
    return this.queueRequest(async () => {
      const response = await this.httpClient.get<Bundle>(url);
      return response.data;
    });
  }

  /**
   * Helper: Build a reference
   */
  static reference(resourceType: ResourceType, id: string, display?: string): Reference {
    const ref: Reference = {
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
  static extractId(reference: string | Reference | undefined): string | null {
    if (!reference) return null;
    
    // Handle string references
    if (typeof reference === 'string') {
      // Handle absolute URLs
      if (reference.startsWith('http://') || reference.startsWith('https://')) {
        const parts = reference.split('/');
        return parts[parts.length - 1];
      }
      // Handle relative references (ResourceType/id)
      return reference.split('/').pop() || null;
    }
    
    // Handle reference objects
    if (reference.reference) {
      return FHIRClient.extractId(reference.reference);
    }
    
    return null;
  }

  // Instance method for backward compatibility
  extractId(reference: string | Reference | undefined): string | null {
    return FHIRClient.extractId(reference);
  }

  // Convenience methods for specific resources

  /**
   * Patient operations
   */
  async getPatient(id: string): Promise<Patient> {
    return this.read<Patient>('Patient', id);
  }

  async searchPatients(params: SearchParams): Promise<SearchResult<Patient>> {
    return this.search<Patient>('Patient', params);
  }

  async getPatientEverything(id: string): Promise<Bundle> {
    return this.operation<Bundle>('everything', 'Patient', id);
  }

  /**
   * Observation operations
   */
  async getObservations(patientId: string, category?: string, count: number = 100): Promise<SearchResult<Observation>> {
    const params: SearchParams = {
      patient: patientId,
      _count: count,
      _sort: '-date'
    };
    if (category) params.category = category;
    return this.search<Observation>('Observation', params);
  }

  async getVitalSigns(patientId: string, count: number = 100): Promise<SearchResult<Observation>> {
    return this.getObservations(patientId, 'vital-signs', count);
  }

  async getLabResults(patientId: string, count: number = 100): Promise<SearchResult<Observation>> {
    return this.getObservations(patientId, 'laboratory', count);
  }

  /**
   * Medication operations
   */
  async getMedications(patientId: string, status?: string, count: number = 50): Promise<SearchResult<MedicationRequest>> {
    const params: SearchParams = {
      patient: patientId,
      _count: count,
      _sort: '-authoredon'
    };
    if (status) params.status = status;
    return this.search<MedicationRequest>('MedicationRequest', params);
  }

  /**
   * Condition operations
   */
  async getConditions(patientId: string, clinicalStatus: string = 'active', count: number = 50): Promise<SearchResult<Condition>> {
    return this.search<Condition>('Condition', {
      patient: patientId,
      'clinical-status': clinicalStatus,
      _count: count,
      _sort: '-recorded-date'
    });
  }

  /**
   * Encounter operations
   */
  async getEncounters(patientId: string, status?: string, count: number = 30): Promise<SearchResult<Encounter>> {
    const params: SearchParams = {
      patient: patientId,
      _count: count,
      _sort: '-date'
    };
    if (status) params.status = status;
    return this.search<Encounter>('Encounter', params);
  }

  /**
   * AllergyIntolerance operations
   */
  async getAllergies(patientId: string, count: number = 30): Promise<SearchResult<AllergyIntolerance>> {
    return this.search<AllergyIntolerance>('AllergyIntolerance', {
      patient: patientId,
      _count: count,
      _sort: '-date'
    });
  }

  /**
   * Coverage operations
   */
  async getCoverage(patientId: string): Promise<SearchResult<Coverage>> {
    return this.search<Coverage>('Coverage', {
      beneficiary: patientId
    });
  }

  async getCoverageById(id: string): Promise<Coverage> {
    return this.read<Coverage>('Coverage', id);
  }

  async getActiveCoverage(patientId: string): Promise<SearchResult<Coverage>> {
    return this.search<Coverage>('Coverage', {
      beneficiary: patientId,
      status: 'active'
    });
  }

  async createCoverage(coverage: Omit<Coverage, 'id' | 'meta'>): Promise<Coverage> {
    return this.create<Coverage>('Coverage', coverage);
  }

  async updateCoverage(id: string, coverage: Coverage): Promise<Coverage> {
    return this.update<Coverage>('Coverage', id, coverage);
  }

  /**
   * Performance-optimized endpoints
   */
  async getPatientBundleOptimized(patientId: string, options: {
    resourceTypes?: ResourceType[];
    limit?: number;
    priority?: 'all' | 'critical';
  } = {}): Promise<Bundle> {
    const params: any = {
      limit: options.limit || 100,
      priority: options.priority || 'all'
    };
    
    if (options.resourceTypes?.length) {
      params.resource_types = options.resourceTypes.join(',');
    }
    
    const response = await this.httpClient.get<Bundle>(`/Patient/${patientId}/$bundle-optimized`, { params });
    return response.data;
  }
  
  async getPatientTimelineOptimized(patientId: string, options: {
    days?: number;
    limit?: number;
    resourceTypes?: ResourceType[];
  } = {}): Promise<any> {
    const params: any = {
      days: options.days || 365,
      limit: options.limit || 100
    };
    
    if (options.resourceTypes?.length) {
      params.resource_types = options.resourceTypes.join(',');
    }
    
    const response = await this.httpClient.get(`/Patient/${patientId}/$timeline`, { params });
    return response.data;
  }
  
  async getPatientSummaryOptimized(patientId: string): Promise<any> {
    const response = await this.httpClient.get(`/Patient/${patientId}/$summary`);
    return response.data;
  }

  /**
   * Procedure operations
   */
  async getProcedures(patientId: string, count: number = 50): Promise<SearchResult<Procedure>> {
    return this.search<Procedure>('Procedure', {
      patient: patientId,
      _sort: '-performed-date',
      _count: count
    });
  }

  async getProcedure(procedureId: string): Promise<Procedure> {
    return this.read<Procedure>('Procedure', procedureId);
  }

  async createProcedure(procedure: Omit<Procedure, 'id' | 'meta'>): Promise<Procedure> {
    return this.create<Procedure>('Procedure', procedure);
  }

  async updateProcedure(id: string, procedure: Procedure): Promise<Procedure> {
    return this.update<Procedure>('Procedure', id, procedure);
  }

  /**
   * Advanced search with value filtering
   */
  async searchObservationsWithValueFilter(patientId: string, filters: {
    code?: string;
    valueFilter?: {
      operator: string;
      value: number;
      unit?: string;
    };
    category?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
  } = {}): Promise<SearchResult<Observation>> {
    const params: SearchParams = {
      patient: patientId,
      _sort: '-date',
      _count: filters.limit || 50
    };

    if (filters.code) {
      params.code = `http://loinc.org|${filters.code}`;
    }

    if (filters.valueFilter) {
      const { operator, value, unit } = filters.valueFilter;
      let valueQuantityParam = `${operator}${value}`;
      
      if (unit) {
        valueQuantityParam += `|http://unitsofmeasure.org|${unit}`;
      }
      
      params['value-quantity'] = valueQuantityParam;
    }

    if (filters.category) {
      params.category = filters.category;
    }

    if (filters.dateFrom || filters.dateTo) {
      const dateParams: string[] = [];
      if (filters.dateFrom) {
        dateParams.push(`ge${filters.dateFrom}`);
      }
      if (filters.dateTo) {
        dateParams.push(`le${filters.dateTo}`);
      }
      params.date = dateParams;
    }

    return this.search<Observation>('Observation', params);
  }

  /**
   * Search for critical lab values
   */
  async searchCriticalLabValues(patientId: string, timeframe: '24h' | '7d' | '30d' = '24h'): Promise<Array<{
    definition: any;
    results: Observation[];
    count: number;
  }>> {
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

        if (results.resources.length > 0) {
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
}

// Export singleton instance for common use
export const fhirClient = new FHIRClient();

// Also export class for custom instances
export default FHIRClient;