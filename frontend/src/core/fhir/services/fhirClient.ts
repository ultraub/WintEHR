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
  version: number;
  resourceType?: string;
  id?: string;
  references?: string[]; // Track related resources for smart invalidation
}

interface CacheConfig {
  defaultTTL: number;
  maxSize: number;
  enabled: boolean;
  smartInvalidation: boolean;
  versionTracking: boolean;
}

// Resource relationship map for smart invalidation
interface ResourceRelationship {
  invalidates: string[]; // Resource types that should be invalidated
  invalidatedBy: string[]; // Resource types that invalidate this
}

// Cache statistics
interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  invalidations: number;
  size: number;
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
// Updated types to match newer axios versions
type RequestInterceptor = (config: any) => any | Promise<any>;
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

// FHIR resource relationships for smart invalidation
const RESOURCE_RELATIONSHIPS: Record<string, ResourceRelationship> = {
  Patient: {
    invalidates: [], // Patient changes don't invalidate other resources
    invalidatedBy: [] // Nothing invalidates patient cache
  },
  Condition: {
    invalidates: ['Patient/$everything', 'CarePlan'],
    invalidatedBy: ['Patient']
  },
  MedicationRequest: {
    invalidates: ['Patient/$everything', 'MedicationDispense', 'MedicationAdministration'],
    invalidatedBy: ['Patient', 'Encounter']
  },
  Observation: {
    invalidates: ['Patient/$everything', 'DiagnosticReport'],
    invalidatedBy: ['Patient', 'Encounter', 'ServiceRequest']
  },
  ServiceRequest: {
    invalidates: ['Patient/$everything', 'DiagnosticReport', 'Observation'],
    invalidatedBy: ['Patient', 'Encounter']
  },
  Encounter: {
    invalidates: ['Patient/$everything', 'Condition', 'Observation', 'ServiceRequest'],
    invalidatedBy: ['Patient']
  },
  AllergyIntolerance: {
    invalidates: ['Patient/$everything', 'MedicationRequest'],
    invalidatedBy: ['Patient']
  },
  Procedure: {
    invalidates: ['Patient/$everything', 'ServiceRequest', 'DiagnosticReport'],
    invalidatedBy: ['Patient', 'Encounter']
  },
  DiagnosticReport: {
    invalidates: ['Patient/$everything'],
    invalidatedBy: ['Patient', 'ServiceRequest', 'Observation']
  },
  Coverage: {
    invalidates: ['Patient/$everything'],
    invalidatedBy: ['Patient']
  }
};

class FHIRClient {
  private httpClient: AxiosInstance;
  private baseUrl: string;
  private cache: Map<string, CacheEntry>;
  private cacheConfig: CacheConfig;
  private cacheStats: CacheStats;
  private cacheVersion: number;
  private queueConfig: QueueConfig;
  private requestQueue: Array<() => Promise<any>>;
  private activeRequests: number;
  private capabilities: any;
  private requestInterceptors: RequestInterceptor[];
  private responseInterceptors: ResponseInterceptor[];
  private errorInterceptors: ErrorInterceptor[];
  private pendingRequests: Map<string, Promise<any>>; // For request deduplication
  private deduplicationStats: { total: number; deduplicated: number }; // Track deduplication effectiveness

  constructor(config: FHIRClientConfig = {}) {
    // Configure base URL
    this.baseUrl = config.baseUrl || process.env.REACT_APP_FHIR_ENDPOINT || '/fhir/R4';
    
    // Configure cache with optimized TTLs for better performance
    this.cache = new Map();
    this.cacheConfig = {
      defaultTTL: 30 * 60 * 1000, // 30 minutes default (increased from 5 for better performance)
      maxSize: 500, // Increased from 100 to cache more resources
      enabled: true,
      smartInvalidation: true,
      versionTracking: true,
      ...config.cache
    };
    this.cacheStats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      invalidations: 0,
      size: 0
    };
    this.cacheVersion = 1;

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
    this.pendingRequests = new Map();
    this.deduplicationStats = { total: 0, deduplicated: 0 };

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
   * Get from cache with version checking
   */
  private getFromCache<T>(key: string): T | null {
    if (!this.cacheConfig.enabled) return null;

    const entry = this.cache.get(key);
    if (!entry) {
      this.cacheStats.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.cacheStats.evictions++;
      this.cacheStats.size--;
      return null;
    }

    // Check version if version tracking is enabled
    if (this.cacheConfig.versionTracking && entry.version < this.cacheVersion) {
      this.cache.delete(key);
      this.cacheStats.invalidations++;
      this.cacheStats.size--;
      return null;
    }

    this.cacheStats.hits++;
    // Update LRU by re-setting the entry
    this.cache.delete(key);
    this.cache.set(key, entry);
    
    return entry.data as T;
  }

  /**
   * Set in cache with intelligent features
   */
  private setInCache<T>(
    key: string, 
    data: T, 
    options: {
      ttl?: number;
      resourceType?: string;
      id?: string;
      references?: string[];
    } = {}
  ): void {
    if (!this.cacheConfig.enabled) return;

    // Enforce max cache size with LRU eviction
    if (this.cache.size >= this.cacheConfig.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
        this.cacheStats.evictions++;
        this.cacheStats.size--;
      }
    }

    // Extract resource info if it's a FHIR resource
    let resourceType = options.resourceType;
    let id = options.id;
    if (!resourceType && data && typeof data === 'object' && 'resourceType' in data) {
      resourceType = (data as any).resourceType;
      id = (data as any).id;
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: options.ttl || this.cacheConfig.defaultTTL,
      version: this.cacheVersion,
      resourceType,
      id,
      references: options.references || []
    };

    this.cache.set(key, entry);
    this.cacheStats.size++;
  }

  /**
   * Clear cache with smart invalidation
   */
  public clearCache(pattern?: string, options?: { 
    smartInvalidation?: boolean; 
    resourceType?: string;
    resourceId?: string;
  }): void {
    const keysToDelete: string[] = [];

    if (pattern) {
      // Clear entries matching pattern
      const regex = new RegExp(pattern);
      this.cache.forEach((entry, key) => {
        if (regex.test(key)) {
          keysToDelete.push(key);
        }
      });
    } else if (options?.smartInvalidation && options.resourceType) {
      // Smart invalidation based on resource relationships
      const relationships = RESOURCE_RELATIONSHIPS[options.resourceType];
      if (relationships) {
        // Invalidate related resource types
        relationships.invalidates.forEach(relatedType => {
          this.cache.forEach((entry, key) => {
            if (key.includes(relatedType) || 
                (entry.resourceType && relationships.invalidates.includes(entry.resourceType))) {
              keysToDelete.push(key);
            }
          });
        });
      }

      // Also invalidate the specific resource
      if (options.resourceId) {
        const specificKey = `${options.resourceType}/${options.resourceId}`;
        keysToDelete.push(specificKey);
        
        // Invalidate searches that might include this resource
        this.cache.forEach((entry, key) => {
          if (key.startsWith(`${options.resourceType}?`)) {
            keysToDelete.push(key);
          }
        });
      }
    } else {
      // Clear all
      this.cache.clear();
      this.cacheStats.size = 0;
      this.cacheStats.invalidations += this.cache.size;
      return;
    }

    // Delete identified keys
    keysToDelete.forEach(key => {
      this.cache.delete(key);
      this.cacheStats.invalidations++;
      this.cacheStats.size--;
    });
  }

  /**
   * Invalidate cache version to force refresh
   */
  public invalidateCacheVersion(): void {
    this.cacheVersion++;
    // Cache version incremented
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): CacheStats & { hitRate: number } {
    const total = this.cacheStats.hits + this.cacheStats.misses;
    const hitRate = total > 0 ? this.cacheStats.hits / total : 0;
    
    return {
      ...this.cacheStats,
      hitRate
    };
  }

  /**
   * Reset cache statistics
   */
  public resetCacheStats(): void {
    this.cacheStats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      invalidations: 0,
      size: this.cache.size
    };
  }

  /**
   * Create a unique key for request deduplication
   */
  private createRequestKey(method: string, url: string, params?: any): string {
    const paramStr = params ? JSON.stringify(params) : '';
    return `${method}:${url}:${paramStr}`;
  }

  /**
   * Execute request with deduplication
   */
  private async executeWithDeduplication<T>(
    key: string,
    requestFn: () => Promise<T>
  ): Promise<T> {
    // Track total requests
    this.deduplicationStats.total++;
    
    // Check if identical request is already pending
    const pendingRequest = this.pendingRequests.get(key);
    if (pendingRequest) {
      // Deduplicating request
      this.deduplicationStats.deduplicated++;
      return pendingRequest as Promise<T>;
    }

    // Create new request promise
    const requestPromise = requestFn()
      .then(result => {
        // Remove from pending when complete
        this.pendingRequests.delete(key);
        return result;
      })
      .catch(error => {
        // Remove from pending on error
        this.pendingRequests.delete(key);
        throw error;
      });

    // Store as pending
    this.pendingRequests.set(key, requestPromise);

    return requestPromise;
  }

  /**
   * Prefetch resources to warm the cache
   */
  public async prefetchResources(
    requests: Array<{
      resourceType: ResourceType;
      id?: string;
      params?: SearchParams;
    }>
  ): Promise<void> {
    const prefetchPromises = requests.map(async (request) => {
      try {
        if (request.id) {
          // Prefetch specific resource
          const cacheKey = `${request.resourceType}/${request.id}`;
          if (!this.cache.has(cacheKey)) {
            await this.read(request.resourceType as any, request.id);
          }
        } else if (request.params) {
          // Prefetch search results
          await this.search(request.resourceType as any, request.params);
        }
      } catch (error) {
        // Prefetch failed for resource type
      }
    });

    await Promise.allSettled(prefetchPromises);
  }

  /**
   * Warm cache with patient context
   */
  public async warmCacheForPatient(patientId: string): Promise<void> {
    // Warming cache for patient
    
    // Prefetch common patient-related resources
    const prefetchRequests = [
      // Patient demographics
      { resourceType: 'Patient' as ResourceType, id: patientId },
      
      // Active conditions
      { resourceType: 'Condition' as ResourceType, params: { 
        patient: patientId, 
        'clinical-status': 'active',
        _count: 20 
      }},
      
      // Current medications
      { resourceType: 'MedicationRequest' as ResourceType, params: { 
        patient: patientId, 
        status: 'active',
        _count: 20 
      }},
      
      // Allergies
      { resourceType: 'AllergyIntolerance' as ResourceType, params: { 
        patient: patientId,
        _count: 10 
      }},
      
      // Recent observations
      { resourceType: 'Observation' as ResourceType, params: { 
        patient: patientId,
        category: 'vital-signs',
        _sort: '-date',
        _count: 10 
      }},
      
      // Coverage
      { resourceType: 'Coverage' as ResourceType, params: { 
        beneficiary: patientId,
        status: 'active' 
      }}
    ];

    await this.prefetchResources(prefetchRequests);
  }

  /**
   * Get deduplication statistics
   */
  public getDeduplicationStats(): { total: number; deduplicated: number; ratio: number } {
    // Track deduplication effectiveness
    const stats = {
      total: this.deduplicationStats?.total || 0,
      deduplicated: this.deduplicationStats?.deduplicated || 0,
      ratio: 0
    };
    
    if (stats.total > 0) {
      stats.ratio = stats.deduplicated / stats.total;
    }
    
    return stats;
  }

  /**
   * Clear pending requests (useful for cleanup)
   */
  public clearPendingRequests(): void {
    this.pendingRequests.clear();
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
      const response = await this.httpClient.get('metadata');
      this.capabilities = response.data;
      this.setInCache(cacheKey, this.capabilities, { ttl: 60 * 60 * 1000 }); // Cache for 1 hour
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
      const response = await this.httpClient.post<T>(`${resourceType}`, resource);
      const createdResource = response.data;
      
      // Smart cache invalidation
      if (this.cacheConfig.smartInvalidation) {
        this.clearCache(undefined, {
          smartInvalidation: true,
          resourceType,
          resourceId: createdResource.id
        });
      } else {
        // Fallback to pattern-based clearing
        this.clearCache(`${resourceType}.*`);
      }
      
      return createdResource;
    });
  }

  /**
   * Read a resource by ID
   */
  async read<T extends FHIRResource>(resourceType: T['resourceType'], id: string): Promise<T> {
    const cacheKey = `${resourceType}/${id}`;
    const cached = this.getFromCache<T>(cacheKey);
    if (cached) return cached;

    // Create request key for deduplication
    const requestKey = this.createRequestKey('GET', `${resourceType}/${id}`);

    return this.executeWithDeduplication(requestKey, () =>
      this.queueRequest(async () => {
        const response = await this.httpClient.get<T>(`${resourceType}/${id}`);
        const resource = response.data;
        
        // Cache with resource metadata
        this.setInCache(cacheKey, resource, {
          resourceType,
          id,
          ttl: this.getResourceSpecificTTL(resourceType)
        });
        
        return resource;
      })
    );
  }

  /**
   * Get resource-specific TTL based on resource type
   * Optimized TTLs for better performance while maintaining data freshness
   */
  private getResourceSpecificTTL(resourceType: string): number {
    // Different TTLs for different resource types based on how often they change
    // TTLs increased proportionally for better performance
    const ttlMap: Record<string, number> = {
      Patient: 2 * 60 * 60 * 1000, // 2 hours - patient demographics rarely change
      Practitioner: 4 * 60 * 60 * 1000, // 4 hours - practitioner info is very stable
      Organization: 4 * 60 * 60 * 1000, // 4 hours - org info is very stable
      Coverage: 60 * 60 * 1000, // 1 hour - insurance info can change but not frequently
      Observation: 15 * 60 * 1000, // 15 minutes - lab results are somewhat time-sensitive
      MedicationRequest: 30 * 60 * 1000, // 30 minutes - medications relatively stable
      Condition: 60 * 60 * 1000, // 1 hour - conditions are quite stable
      Encounter: 30 * 60 * 1000, // 30 minutes - encounters stable after initial creation
      ServiceRequest: 15 * 60 * 1000, // 15 minutes - orders are somewhat time-sensitive
      DiagnosticReport: 45 * 60 * 1000, // 45 minutes - reports stable once created
      AllergyIntolerance: 2 * 60 * 60 * 1000, // 2 hours - allergies very rarely change
      Procedure: 60 * 60 * 1000, // 1 hour - procedures stable once documented
      Immunization: 2 * 60 * 60 * 1000, // 2 hours - immunizations very stable
      DocumentReference: 2 * 60 * 60 * 1000, // 2 hours - documents don't change after creation
      CarePlan: 45 * 60 * 1000, // 45 minutes - care plans relatively stable
      CareTeam: 2 * 60 * 60 * 1000, // 2 hours - care teams stable
      Location: 4 * 60 * 60 * 1000, // 4 hours - locations very stable
      Medication: 4 * 60 * 60 * 1000, // 4 hours - medication definitions very stable
      ImagingStudy: 2 * 60 * 60 * 1000, // 2 hours - imaging studies stable after creation
    };
    
    return ttlMap[resourceType] || this.cacheConfig.defaultTTL;
  }

  /**
   * Get search-specific TTL based on resource type and search parameters
   */
  private getSearchSpecificTTL(resourceType: string, params: SearchParams): number {
    // Shorter TTL for searches as they can change more frequently
    const baseTTL = this.getResourceSpecificTTL(resourceType);
    
    // Reduce TTL for time-sensitive searches
    if (params._lastUpdated || params.date || params['authored-on']) {
      return Math.min(baseTTL, 2 * 60 * 1000); // Max 2 minutes for date-based searches
    }
    
    // Reduce TTL for status-based searches
    if (params.status || params['clinical-status']) {
      return Math.min(baseTTL, 3 * 60 * 1000); // Max 3 minutes for status searches
    }
    
    // Use half of resource TTL for general searches
    return baseTTL / 2;
  }

  /**
   * Update a resource
   */
  async update<T extends FHIRResource>(resourceType: T['resourceType'], id: string, resource: T): Promise<T> {
    // Ensure resource has correct ID
    resource.id = id;
    
    return this.queueRequest(async () => {
      const response = await this.httpClient.put<T>(`${resourceType}/${id}`, resource);
      const updatedResource = response.data;
      
      // Smart cache invalidation
      if (this.cacheConfig.smartInvalidation) {
        this.clearCache(undefined, {
          smartInvalidation: true,
          resourceType,
          resourceId: id
        });
      } else {
        // Fallback to pattern-based clearing
        this.clearCache(`${resourceType}/${id}`);
        this.clearCache(`${resourceType}\\?.*`);
      }
      
      // Cache the updated resource
      const cacheKey = `${resourceType}/${id}`;
      this.setInCache(cacheKey, updatedResource, {
        resourceType,
        id,
        ttl: this.getResourceSpecificTTL(resourceType)
      });
      
      return updatedResource;
    });
  }

  /**
   * Delete a resource
   */
  async delete(resourceType: ResourceType, id: string): Promise<void> {
    return this.queueRequest(async () => {
      await this.httpClient.delete(`${resourceType}/${id}`);
      
      // Smart cache invalidation
      if (this.cacheConfig.smartInvalidation) {
        this.clearCache(undefined, {
          smartInvalidation: true,
          resourceType,
          resourceId: id
        });
      } else {
        // Fallback to pattern-based clearing
        this.clearCache(`${resourceType}/${id}`);
        this.clearCache(`${resourceType}\\?.*`);
      }
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

    // Create request key for deduplication
    const requestKey = this.createRequestKey('GET', `${resourceType}`, params);

    return this.executeWithDeduplication(requestKey, () =>
      this.queueRequest(async () => {
        try {
          const response = await this.httpClient.get<any>(`${resourceType}`, { params });
          
          // Check if response is already standardized by FHIRResourceContext interceptor
          if (response.data.resources !== undefined && response.data.total !== undefined) {
            // Response is already in the SearchResult format
            return response.data as SearchResult<T>;
          }
          
          // Otherwise, handle as a regular FHIR Bundle
          const bundle = response.data as Bundle;
          const resources = (bundle.entry?.map(entry => entry.resource) || []) as T[];
          
          const result: SearchResult<T> = {
            resources,
            total: bundle.total || resources.length,
            bundle
          };
          
          // Cache with appropriate TTL based on resource type and search
          const searchTTL = this.getSearchSpecificTTL(resourceType, params);
          this.setInCache(cacheKey, result, {
            ttl: searchTTL,
            resourceType,
            references: resources.map(r => `${resourceType}/${r.id}`).filter(Boolean)
          });
          
          // Also cache individual resources from the search
          resources.forEach(resource => {
            if (resource.id) {
              const resourceKey = `${resourceType}/${resource.id}`;
              this.setInCache(resourceKey, resource, {
                resourceType,
                id: resource.id,
                ttl: this.getResourceSpecificTTL(resourceType)
              });
            }
          });
          
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
      })
    );
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
    
    // Create request key for deduplication
    const requestKey = this.createRequestKey('POST', '', bundle);
    
    return this.executeWithDeduplication(requestKey, () =>
      this.queueRequest(async () => {
        const response = await this.httpClient.post<Bundle>('/', bundle);
        
        // Process results
        const results: BatchResult[] = response.data.entry?.map(entry => {
          const status = entry.response?.status || '';
          const success = status.startsWith('2');
          
          return {
            success,
            resource: entry.resource as FHIRResource,
            error: success ? undefined : entry.response?.outcome as OperationOutcome,
            status
          };
        }) || [];
        
        // Clear relevant caches based on operations
        requests.forEach(req => {
          if (req.method !== 'GET' && req.url) {
            const parts = req.url.split('/');
            if (parts.length > 0) {
              this.clearCache(`${parts[0]}.*`);
            }
          }
        });
        
        return results;
      })
    );
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
      url = `${resourceType}/${id}/$${operation}`;
    } else if (resourceType) {
      // Type level operation
      url = `${resourceType}/$${operation}`;
    } else {
      // System level operation
      url = `$${operation}`;
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
      ? `${resourceType}/${id}/_history`
      : `${resourceType}/_history`;
    
    // Create request key for deduplication
    const requestKey = this.createRequestKey('GET', url);
    
    return this.executeWithDeduplication(requestKey, () =>
      this.queueRequest(async () => {
        const response = await this.httpClient.get<Bundle>(url);
        return response.data;
      })
    );
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
    
    // Create request key for deduplication
    const requestKey = this.createRequestKey('GET', `Patient/${patientId}/$bundle-optimized`, params);
    
    return this.executeWithDeduplication(requestKey, () =>
      this.queueRequest(async () => {
        const response = await this.httpClient.get<Bundle>(`Patient/${patientId}/$bundle-optimized`, { params });
        return response.data;
      })
    );
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
    
    // Create request key for deduplication
    const requestKey = this.createRequestKey('GET', `Patient/${patientId}/$timeline`, params);
    
    return this.executeWithDeduplication(requestKey, () =>
      this.queueRequest(async () => {
        const response = await this.httpClient.get(`Patient/${patientId}/$timeline`, { params });
        return response.data;
      })
    );
  }
  
  async getPatientSummaryOptimized(patientId: string): Promise<any> {
    // Create request key for deduplication
    const requestKey = this.createRequestKey('GET', `Patient/${patientId}/$summary`);
    
    return this.executeWithDeduplication(requestKey, () =>
      this.queueRequest(async () => {
        const response = await this.httpClient.get(`Patient/${patientId}/$summary`);
        return response.data;
      })
    );
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
        // Error searching for critical values
      }
    }

    return criticalResults;
  }
}

// Create a function to ensure environment variables are loaded
function createSingletonClient() {
  const baseUrl = process.env.REACT_APP_FHIR_ENDPOINT || '/fhir/R4';
  return new FHIRClient({
    baseUrl: baseUrl
  });
}

// Export singleton instance for common use with proper configuration
export const fhirClient = createSingletonClient();

// Also export class for custom instances
export default FHIRClient;