/**
 * HTTP Client Factory
 * Unified factory for creating HTTP clients with consistent configuration
 * 
 * This factory consolidates HTTP client creation patterns from:
 * - api.js (general API client)
 * - fhirClient.js (FHIR-specific client)
 * - emrClient.js (EMR-specific client)
 * - cdsHooksClient.js (CDS Hooks client)
 * 
 * Note: All existing clients remain unchanged and functional.
 * This provides an alternative unified approach for creating HTTP clients.
 */

import axios from 'axios';

class HttpClientFactory {
  constructor() {
    this.clientCache = new Map();
    this.defaultTimeout = 10000; // 10 seconds
    this.interceptorCache = new Map();
  }

  /**
   * Create a general API client (equivalent to api.js)
   */
  static createApiClient(config = {}) {
    const factory = new HttpClientFactory();
    return factory.createClient('api', {
      baseURL: config.baseURL || process.env.REACT_APP_API_URL || 'http://localhost:8000',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...config.headers
      },
      timeout: config.timeout || factory.defaultTimeout,
      interceptors: {
        request: [factory.authInterceptor()],
        response: [factory.authErrorInterceptor()]
      },
      ...config
    });
  }

  /**
   * Create a FHIR client (equivalent to fhirClient.js patterns)
   */
  static createFhirClient(config = {}) {
    const factory = new HttpClientFactory();
    return factory.createClient('fhir', {
      baseURL: config.baseURL || process.env.REACT_APP_FHIR_ENDPOINT || '/fhir/R4',
      headers: {
        'Content-Type': 'application/fhir+json',
        'Accept': 'application/fhir+json',
        ...config.headers
      },
      timeout: config.timeout || factory.defaultTimeout,
      interceptors: {
        request: [
          factory.authInterceptor(),
          factory.fhirContentTypeInterceptor()
        ],
        response: [
          factory.fhirErrorInterceptor(),
          factory.authErrorInterceptor()
        ]
      },
      ...config
    });
  }

  /**
   * Create an EMR client (equivalent to emrClient.js patterns)
   */
  static createEmrClient(config = {}) {
    const factory = new HttpClientFactory();
    const enabled = config.enabled !== false && process.env.REACT_APP_EMR_FEATURES !== 'false';
    
    if (!enabled) {
      return factory.createMockClient('emr', 'EMR features disabled');
    }

    return factory.createClient('emr', {
      baseURL: config.baseURL || process.env.REACT_APP_EMR_API || '/api/emr',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...config.headers
      },
      timeout: config.timeout || factory.defaultTimeout,
      interceptors: {
        request: [
          factory.emrAuthInterceptor(),
          factory.emrCapabilityInterceptor()
        ],
        response: [
          factory.emrErrorInterceptor(),
          factory.authErrorInterceptor()
        ]
      },
      ...config
    });
  }

  /**
   * Create a CDS Hooks client (equivalent to cdsHooksClient.js patterns)
   */
  static createCdsClient(config = {}) {
    const factory = new HttpClientFactory();
    return factory.createClient('cds', {
      baseURL: config.baseURL || 
               process.env.REACT_APP_CDS_HOOKS_URL || 
               (process.env.NODE_ENV === 'development' ? 'http://localhost:8000/cds-hooks' : '/cds-hooks'),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...config.headers
      },
      timeout: config.timeout || factory.defaultTimeout,
      interceptors: {
        request: [
          factory.cdsHooksInterceptor(),
          factory.authInterceptor()
        ],
        response: [
          factory.cdsErrorInterceptor(),
          factory.authErrorInterceptor()
        ]
      },
      features: {
        caching: true,
        deduplication: true,
        ...config.features
      },
      ...config
    });
  }

  /**
   * Create a custom HTTP client with specified configuration
   */
  static createCustomClient(clientType, config = {}) {
    const factory = new HttpClientFactory();
    return factory.createClient(clientType, config);
  }

  /**
   * Get a cached client instance
   */
  static getCachedClient(clientType, config = {}) {
    const factory = new HttpClientFactory();
    const cacheKey = factory.generateCacheKey(clientType, config);
    
    if (factory.clientCache.has(cacheKey)) {
      return factory.clientCache.get(cacheKey);
    }

    // Create new client based on type
    let client;
    switch (clientType) {
      case 'api':
        client = HttpClientFactory.createApiClient(config);
        break;
      case 'fhir':
        client = HttpClientFactory.createFhirClient(config);
        break;
      case 'emr':
        client = HttpClientFactory.createEmrClient(config);
        break;
      case 'cds':
        client = HttpClientFactory.createCdsClient(config);
        break;
      default:
        client = HttpClientFactory.createCustomClient(clientType, config);
    }

    factory.clientCache.set(cacheKey, client);
    return client;
  }

  // ====================================================================
  // PRIVATE METHODS
  // ====================================================================

  /**
   * Core client creation method
   */
  createClient(clientType, config) {
    const axiosConfig = {
      baseURL: config.baseURL,
      headers: config.headers,
      timeout: config.timeout || this.defaultTimeout,
      ...this.extractAxiosConfig(config)
    };

    const client = axios.create(axiosConfig);

    // Apply request interceptors
    if (config.interceptors?.request) {
      config.interceptors.request.forEach(interceptor => {
        client.interceptors.request.use(interceptor.fulfilled, interceptor.rejected);
      });
    }

    // Apply response interceptors
    if (config.interceptors?.response) {
      config.interceptors.response.forEach(interceptor => {
        client.interceptors.response.use(interceptor.fulfilled, interceptor.rejected);
      });
    }

    // Add client metadata
    client._clientType = clientType;
    client._config = config;
    client._createdAt = new Date().toISOString();

    // Add enhanced features if specified
    if (config.features) {
      this.enhanceClientWithFeatures(client, config.features);
    }

    return client;
  }

  /**
   * Create a mock client for disabled services
   */
  createMockClient(clientType, reason) {
    return {
      _clientType: clientType,
      _mock: true,
      _reason: reason,
      get: () => Promise.reject(new Error(`${clientType} client disabled: ${reason}`)),
      post: () => Promise.reject(new Error(`${clientType} client disabled: ${reason}`)),
      put: () => Promise.reject(new Error(`${clientType} client disabled: ${reason}`)),
      delete: () => Promise.reject(new Error(`${clientType} client disabled: ${reason}`)),
      patch: () => Promise.reject(new Error(`${clientType} client disabled: ${reason}`)),
      request: () => Promise.reject(new Error(`${clientType} client disabled: ${reason}`))
    };
  }

  /**
   * Extract axios-specific config
   */
  extractAxiosConfig(config) {
    const axiosConfig = {};
    const axiosKeys = [
      'url', 'method', 'params', 'data', 'headers', 'timeout',
      'withCredentials', 'auth', 'responseType', 'responseEncoding',
      'xsrfCookieName', 'xsrfHeaderName', 'maxContentLength', 'maxBodyLength',
      'maxRedirects', 'socketPath', 'httpAgent', 'httpsAgent', 'proxy',
      'cancelToken', 'decompress', 'transitional', 'signal', 'insecureHTTPParser'
    ];

    axiosKeys.forEach(key => {
      if (config[key] !== undefined) {
        axiosConfig[key] = config[key];
      }
    });

    return axiosConfig;
  }

  /**
   * Generate cache key for client
   */
  generateCacheKey(clientType, config) {
    const keyData = {
      type: clientType,
      baseURL: config.baseURL,
      timeout: config.timeout,
      auth: config.auth,
      features: config.features
    };
    return JSON.stringify(keyData);
  }

  /**
   * Enhance client with additional features
   */
  enhanceClientWithFeatures(client, features) {
    if (features.caching) {
      this.addCachingFeature(client);
    }
    if (features.deduplication) {
      this.addDeduplicationFeature(client);
    }
    if (features.retry) {
      this.addRetryFeature(client, features.retry);
    }
    if (features.logging) {
      this.addLoggingFeature(client, features.logging);
    }
  }

  /**
   * Add caching feature to client
   */
  addCachingFeature(client) {
    const cache = new Map();
    const cacheTimeout = 30000; // 30 seconds

    const originalGet = client.get.bind(client);
    client.get = (url, config = {}) => {
      if (config.noCache) {
        return originalGet(url, config);
      }

      const cacheKey = `${url}?${JSON.stringify(config.params || {})}`;
      const cached = cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < cacheTimeout) {
        return Promise.resolve(cached.response);
      }

      return originalGet(url, config).then(response => {
        cache.set(cacheKey, {
          response: response,
          timestamp: Date.now()
        });
        return response;
      });
    };
  }

  /**
   * Add request deduplication feature
   */
  addDeduplicationFeature(client) {
    const inFlightRequests = new Map();

    const originalRequest = client.request.bind(client);
    client.request = (config) => {
      const requestKey = `${config.method}-${config.url}-${JSON.stringify(config.params)}`;
      
      if (inFlightRequests.has(requestKey)) {
        return inFlightRequests.get(requestKey);
      }

      const requestPromise = originalRequest(config).finally(() => {
        inFlightRequests.delete(requestKey);
      });

      inFlightRequests.set(requestKey, requestPromise);
      return requestPromise;
    };
  }

  /**
   * Add retry feature to client
   */
  addRetryFeature(client, retryConfig) {
    const { retries = 3, retryDelay = 1000, retryCondition } = retryConfig;

    client.interceptors.response.use(null, async (error) => {
      const config = error.config;
      
      if (!config || config.__retryCount >= retries) {
        return Promise.reject(error);
      }

      if (retryCondition && !retryCondition(error)) {
        return Promise.reject(error);
      }

      config.__retryCount = config.__retryCount || 0;
      config.__retryCount++;

      await new Promise(resolve => setTimeout(resolve, retryDelay * config.__retryCount));
      return client.request(config);
    });
  }

  /**
   * Add logging feature to client
   */
  addLoggingFeature(client, loggingConfig) {
    const { logRequests = true, logResponses = true, logErrors = true } = loggingConfig;

    if (logRequests) {
      client.interceptors.request.use(config => {
        console.log(`[${client._clientType}] Request:`, config.method?.toUpperCase(), config.url, config);
        return config;
      });
    }

    if (logResponses) {
      client.interceptors.response.use(response => {
        console.log(`[${client._clientType}] Response:`, response.status, response.config.url, response);
        return response;
      });
    }

    if (logErrors) {
      client.interceptors.response.use(null, error => {
        console.error(`[${client._clientType}] Error:`, error.response?.status, error.config?.url, error);
        return Promise.reject(error);
      });
    }
  }

  // ====================================================================
  // INTERCEPTOR FACTORIES
  // ====================================================================

  /**
   * General authentication interceptor
   */
  authInterceptor() {
    return {
      fulfilled: (config) => {
        const token = localStorage.getItem('auth_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      rejected: (error) => Promise.reject(error)
    };
  }

  /**
   * EMR-specific authentication interceptor
   */
  emrAuthInterceptor() {
    return {
      fulfilled: (config) => {
        const token = localStorage.getItem('emr_token') || localStorage.getItem('auth_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      rejected: (error) => Promise.reject(error)
    };
  }

  /**
   * FHIR content type interceptor
   */
  fhirContentTypeInterceptor() {
    return {
      fulfilled: (config) => {
        // Ensure FHIR-specific content types
        if (!config.headers['Content-Type']) {
          config.headers['Content-Type'] = 'application/fhir+json';
        }
        if (!config.headers['Accept']) {
          config.headers['Accept'] = 'application/fhir+json';
        }
        return config;
      },
      rejected: (error) => Promise.reject(error)
    };
  }

  /**
   * CDS Hooks interceptor
   */
  cdsHooksInterceptor() {
    return {
      fulfilled: (config) => {
        // Add CDS Hooks specific headers
        config.headers['CDS-Hook-Context'] = 'frontend';
        return config;
      },
      rejected: (error) => Promise.reject(error)
    };
  }

  /**
   * EMR capability interceptor
   */
  emrCapabilityInterceptor() {
    return {
      fulfilled: (config) => {
        // Add EMR capability headers
        config.headers['EMR-Features'] = process.env.REACT_APP_EMR_FEATURES || 'basic';
        return config;
      },
      rejected: (error) => Promise.reject(error)
    };
  }

  /**
   * General authentication error interceptor
   */
  authErrorInterceptor() {
    return {
      fulfilled: (response) => response,
      rejected: (error) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('emr_token');
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      }
    };
  }

  /**
   * FHIR-specific error interceptor
   */
  fhirErrorInterceptor() {
    return {
      fulfilled: (response) => response,
      rejected: (error) => {
        if (error.response?.data?.resourceType === 'OperationOutcome') {
          // Handle FHIR OperationOutcome errors
          const issues = error.response.data.issue || [];
          const fhirError = new Error(issues.map(i => i.details?.text || i.diagnostics).join('; '));
          fhirError.operationOutcome = error.response.data;
          return Promise.reject(fhirError);
        }
        return Promise.reject(error);
      }
    };
  }

  /**
   * EMR-specific error interceptor
   */
  emrErrorInterceptor() {
    return {
      fulfilled: (response) => response,
      rejected: (error) => {
        if (error.response?.status === 503) {
          // EMR service unavailable - degrade gracefully
          console.warn('EMR service unavailable, degrading functionality');
          error.emrUnavailable = true;
        }
        return Promise.reject(error);
      }
    };
  }

  /**
   * CDS-specific error interceptor
   */
  cdsErrorInterceptor() {
    return {
      fulfilled: (response) => response,
      rejected: (error) => {
        if (error.code === 'ECONNABORTED' || error.response?.status >= 500) {
          // CDS service error - continue without CDS recommendations
          console.warn('CDS service error, continuing without recommendations');
          error.cdsUnavailable = true;
        }
        return Promise.reject(error);
      }
    };
  }
}

// Export singleton methods for direct use
export const createApiClient = HttpClientFactory.createApiClient;
export const createFhirClient = HttpClientFactory.createFhirClient;
export const createEmrClient = HttpClientFactory.createEmrClient;
export const createCdsClient = HttpClientFactory.createCdsClient;
export const createCustomClient = HttpClientFactory.createCustomClient;
export const getCachedClient = HttpClientFactory.getCachedClient;

// Export factory class for advanced usage
export { HttpClientFactory };

// Export default instance
export default new HttpClientFactory();