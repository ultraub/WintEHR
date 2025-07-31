/**
 * Comprehensive tests for HttpClientFactory
 * Tests unified HTTP client creation patterns and interceptor functionality
 */

import { HttpClientFactory, createApiClient, createFhirClient, createEmrClient, createCdsClient } from '../HttpClientFactory';
import axios from 'axios';

// Mock axios
jest.mock('axios');

describe('HttpClientFactory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    
    // Mock axios.create to return a mock client
    const mockClient = {
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() }
      },
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      patch: jest.fn(),
      request: jest.fn()
    };
    
    axios.create.mockReturnValue(mockClient);
  });

  describe('Static factory methods', () => {
    describe('createApiClient', () => {
      it('should create API client with default configuration', () => {
        const client = createApiClient();
        
        expect(axios.create).toHaveBeenCalledWith(
          expect.objectContaining({
            baseURL: 'http://localhost:8000',
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            }),
            timeout: 10000
          })
        );
      });

      it('should accept custom configuration', () => {
        const config = {
          baseURL: 'https://custom.api.com',
          timeout: 5000,
          headers: { 'Custom-Header': 'value' }
        };
        
        createApiClient(config);
        
        expect(axios.create).toHaveBeenCalledWith(
          expect.objectContaining({
            baseURL: 'https://custom.api.com',
            timeout: 5000,
            headers: expect.objectContaining({
              'Custom-Header': 'value'
            })
          })
        );
      });

      it('should add authentication interceptors', () => {
        const client = createApiClient();
        
        expect(client.interceptors.request.use).toHaveBeenCalled();
        expect(client.interceptors.response.use).toHaveBeenCalled();
      });
    });

    describe('createFhirClient', () => {
      it('should create FHIR client with FHIR-specific headers', () => {
        createFhirClient();
        
        expect(axios.create).toHaveBeenCalledWith(
          expect.objectContaining({
            headers: expect.objectContaining({
              'Content-Type': 'application/fhir+json',
              'Accept': 'application/fhir+json'
            })
          })
        );
      });

      it('should use FHIR endpoint from environment', () => {
        process.env.REACT_APP_FHIR_ENDPOINT = '/custom/fhir';
        
        createFhirClient();
        
        expect(axios.create).toHaveBeenCalledWith(
          expect.objectContaining({
            baseURL: '/custom/fhir'
          })
        );
        
        delete process.env.REACT_APP_FHIR_ENDPOINT;
      });
    });

    describe('createEmrClient', () => {
      it('should create EMR client when enabled', () => {
        const client = createEmrClient({ enabled: true });
        
        expect(axios.create).toHaveBeenCalled();
        expect(client._clientType).toBe('emr');
      });

      it('should create mock client when disabled', () => {
        const client = createEmrClient({ enabled: false });
        
        expect(client._mock).toBe(true);
        expect(client._reason).toContain('EMR features disabled');
      });

      it('should respect environment variable', () => {
        process.env.REACT_APP_EMR_FEATURES = 'false';
        
        const client = createEmrClient();
        
        expect(client._mock).toBe(true);
        
        delete process.env.REACT_APP_EMR_FEATURES;
      });
    });

    describe('createCdsClient', () => {
      it('should create CDS client with development URL', () => {
        process.env.NODE_ENV = 'development';
        
        createCdsClient();
        
        expect(axios.create).toHaveBeenCalledWith(
          expect.objectContaining({
            baseURL: 'http://localhost:8000/cds-hooks'
          })
        );
      });

      it('should enable caching and deduplication features', () => {
        const client = createCdsClient();
        
        expect(client._config.features.caching).toBe(true);
        expect(client._config.features.deduplication).toBe(true);
      });
    });
  });

  describe('Client caching', () => {
    it('should cache clients by configuration', () => {
      const factory = new HttpClientFactory();
      
      const client1 = HttpClientFactory.getCachedClient('api', { baseURL: 'test' });
      const client2 = HttpClientFactory.getCachedClient('api', { baseURL: 'test' });
      
      expect(client1).toBe(client2);
    });

    it('should create new clients for different configurations', () => {
      const client1 = HttpClientFactory.getCachedClient('api', { baseURL: 'test1' });
      const client2 = HttpClientFactory.getCachedClient('api', { baseURL: 'test2' });
      
      expect(client1).not.toBe(client2);
    });
  });

  describe('Client enhancement features', () => {
    let factory;
    let mockClient;

    beforeEach(() => {
      factory = new HttpClientFactory();
      mockClient = {
        get: jest.fn(),
        post: jest.fn(),
        request: jest.fn(),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      };
    });

    describe('Caching feature', () => {
      it('should add caching to GET requests', () => {
        factory.addCachingFeature(mockClient);
        
        expect(mockClient.get).toBeDefined();
        
        // Test that original get method is preserved
        const originalGet = jest.fn().mockResolvedValue({ data: 'test' });
        mockClient.get = originalGet;
        factory.addCachingFeature(mockClient);
        
        // Call the enhanced get method
        mockClient.get('/test');
        
        // Should have been wrapped
        expect(typeof mockClient.get).toBe('function');
      });

      it('should cache responses and return cached data', async () => {
        const originalGet = jest.fn().mockResolvedValue({ data: 'test' });
        mockClient.get = originalGet;
        
        factory.addCachingFeature(mockClient);
        
        // First call
        await mockClient.get('/test');
        expect(originalGet).toHaveBeenCalledTimes(1);
        
        // Second call should use cache
        await mockClient.get('/test');
        expect(originalGet).toHaveBeenCalledTimes(1);
      });

      it('should respect noCache option', async () => {
        const originalGet = jest.fn().mockResolvedValue({ data: 'test' });
        mockClient.get = originalGet;
        
        factory.addCachingFeature(mockClient);
        
        await mockClient.get('/test', { noCache: true });
        await mockClient.get('/test', { noCache: true });
        
        expect(originalGet).toHaveBeenCalledTimes(2);
      });
    });

    describe('Deduplication feature', () => {
      it('should deduplicate identical requests', async () => {
        const originalRequest = jest.fn().mockResolvedValue({ data: 'test' });
        mockClient.request = originalRequest;
        
        factory.addDeduplicationFeature(mockClient);
        
        // Make two identical requests simultaneously
        const promise1 = mockClient.request({ method: 'GET', url: '/test' });
        const promise2 = mockClient.request({ method: 'GET', url: '/test' });
        
        await Promise.all([promise1, promise2]);
        
        expect(originalRequest).toHaveBeenCalledTimes(1);
      });
    });

    describe('Retry feature', () => {
      it('should retry failed requests', async () => {
        const retryConfig = { retries: 2, retryDelay: 10 };
        
        factory.addRetryFeature(mockClient, retryConfig);
        
        expect(mockClient.interceptors.response.use).toHaveBeenCalledWith(
          null,
          expect.any(Function)
        );
      });

      it('should respect retry condition', async () => {
        const retryConfig = {
          retries: 1,
          retryDelay: 10,
          retryCondition: (error) => error.response?.status >= 500
        };
        
        factory.addRetryFeature(mockClient, retryConfig);
        
        // Get the error handler
        const errorHandler = mockClient.interceptors.response.use.mock.calls[0][1];
        
        // Test with 404 (should not retry)
        const error404 = { response: { status: 404 }, config: {} };
        await expect(errorHandler(error404)).rejects.toBe(error404);
        
        // Test with 500 (should retry)
        const error500 = { response: { status: 500 }, config: {} };
        mockClient.request = jest.fn().mockResolvedValue({ data: 'success' });
        
        const result = await errorHandler(error500);
        expect(mockClient.request).toHaveBeenCalled();
      });
    });

    describe('Logging feature', () => {
      beforeEach(() => {
        console.log = jest.fn();
        console.error = jest.fn();
      });

      it('should log requests when enabled', () => {
        const loggingConfig = { logRequests: true };
        mockClient._clientType = 'test';
        
        factory.addLoggingFeature(mockClient, loggingConfig);
        
        expect(mockClient.interceptors.request.use).toHaveBeenCalled();
      });

      it('should log responses when enabled', () => {
        const loggingConfig = { logResponses: true };
        mockClient._clientType = 'test';
        
        factory.addLoggingFeature(mockClient, loggingConfig);
        
        expect(mockClient.interceptors.response.use).toHaveBeenCalled();
      });

      it('should log errors when enabled', () => {
        const loggingConfig = { logErrors: true };
        mockClient._clientType = 'test';
        
        factory.addLoggingFeature(mockClient, loggingConfig);
        
        expect(mockClient.interceptors.response.use).toHaveBeenCalledWith(
          null,
          expect.any(Function)
        );
      });
    });
  });

  describe('Interceptors', () => {
    let factory;

    beforeEach(() => {
      factory = new HttpClientFactory();
    });

    describe('authInterceptor', () => {
      it('should add authorization header when token exists', () => {
        localStorage.setItem('auth_token', 'test-token');
        
        const interceptor = factory.authInterceptor();
        const config = { headers: {} };
        
        const result = interceptor.fulfilled(config);
        
        expect(result.headers.Authorization).toBe('Bearer test-token');
      });

      it('should not modify config when no token exists', () => {
        const interceptor = factory.authInterceptor();
        const config = { headers: {} };
        
        const result = interceptor.fulfilled(config);
        
        expect(result.headers.Authorization).toBeUndefined();
      });
    });

    describe('authErrorInterceptor', () => {
      it('should handle 401 errors by removing tokens and redirecting', () => {
        localStorage.setItem('auth_token', 'test-token');
        localStorage.setItem('emr_token', 'emr-token');
        
        const originalLocation = window.location;
        delete window.location;
        window.location = { pathname: '/dashboard', href: '' };
        
        const interceptor = factory.authErrorInterceptor();
        const error = { response: { status: 401 } };
        
        expect(interceptor.rejected(error)).rejects.toBe(error);
        expect(localStorage.getItem('auth_token')).toBeNull();
        expect(localStorage.getItem('emr_token')).toBeNull();
        
        window.location = originalLocation;
      });

      it('should not redirect when already on login page', () => {
        const originalLocation = window.location;
        delete window.location;
        window.location = { pathname: '/login', href: '/login' };
        
        const interceptor = factory.authErrorInterceptor();
        const error = { response: { status: 401 } };
        
        expect(interceptor.rejected(error)).rejects.toBe(error);
        expect(window.location.href).toBe('/login');
        
        window.location = originalLocation;
      });
    });

    describe('fhirErrorInterceptor', () => {
      it('should handle FHIR OperationOutcome errors', () => {
        const interceptor = factory.fhirErrorInterceptor();
        const error = {
          response: {
            data: {
              resourceType: 'OperationOutcome',
              issue: [
                { details: { text: 'Validation error' } },
                { diagnostics: 'Field required' }
              ]
            }
          }
        };
        
        expect(interceptor.rejected(error)).rejects.toThrow('Validation error; Field required');
      });
    });

    describe('emrErrorInterceptor', () => {
      it('should mark EMR unavailable on 503 errors', () => {
        const interceptor = factory.emrErrorInterceptor();
        const error = { response: { status: 503 } };
        
        expect(interceptor.rejected(error)).rejects.toMatchObject({
          emrUnavailable: true
        });
      });
    });

    describe('cdsErrorInterceptor', () => {
      it('should mark CDS unavailable on timeout errors', () => {
        const interceptor = factory.cdsErrorInterceptor();
        const error = { code: 'ECONNABORTED' };
        
        expect(interceptor.rejected(error)).rejects.toMatchObject({
          cdsUnavailable: true
        });
      });

      it('should mark CDS unavailable on server errors', () => {
        const interceptor = factory.cdsErrorInterceptor();
        const error = { response: { status: 500 } };
        
        expect(interceptor.rejected(error)).rejects.toMatchObject({
          cdsUnavailable: true
        });
      });
    });
  });

  describe('Mock client for disabled services', () => {
    it('should create mock client that rejects all requests', async () => {
      const factory = new HttpClientFactory();
      const mockClient = factory.createMockClient('test', 'Service disabled');
      
      expect(mockClient._mock).toBe(true);
      expect(mockClient._reason).toBe('Service disabled');
      
      await expect(mockClient.get()).rejects.toThrow('test client disabled: Service disabled');
      await expect(mockClient.post()).rejects.toThrow('test client disabled: Service disabled');
      await expect(mockClient.put()).rejects.toThrow('test client disabled: Service disabled');
      await expect(mockClient.delete()).rejects.toThrow('test client disabled: Service disabled');
      await expect(mockClient.patch()).rejects.toThrow('test client disabled: Service disabled');
      await expect(mockClient.request()).rejects.toThrow('test client disabled: Service disabled');
    });
  });

  describe('Integration tests', () => {
    it('should create fully configured FHIR client with all features', () => {
      const client = createFhirClient({
        features: {
          caching: true,
          deduplication: true,
          retry: { retries: 3 },
          logging: { logRequests: true }
        }
      });
      
      expect(client._clientType).toBe('fhir');
      expect(client._config.features.caching).toBe(true);
      expect(client._config.features.deduplication).toBe(true);
      expect(client._config.features.retry.retries).toBe(3);
    });

    it('should handle environment-based configuration', () => {
      process.env.REACT_APP_API_URL = 'https://prod.api.com';
      process.env.REACT_APP_FHIR_ENDPOINT = '/fhir/R5';
      process.env.REACT_APP_EMR_FEATURES = 'true';
      
      const apiClient = createApiClient();
      const fhirClient = createFhirClient();
      const emrClient = createEmrClient();
      
      expect(axios.create).toHaveBeenCalledWith(
        expect.objectContaining({ baseURL: 'https://prod.api.com' })
      );
      expect(axios.create).toHaveBeenCalledWith(
        expect.objectContaining({ baseURL: '/fhir/R5' })
      );
      expect(emrClient._mock).toBeUndefined();
      
      // Cleanup
      delete process.env.REACT_APP_API_URL;
      delete process.env.REACT_APP_FHIR_ENDPOINT;
      delete process.env.REACT_APP_EMR_FEATURES;
    });
  });
});