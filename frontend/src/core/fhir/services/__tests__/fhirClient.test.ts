/**
 * Tests for Enhanced FHIR Client
 * 
 * @since 2025-01-21
 */

import axios from 'axios';
import FHIRClient, { fhirClient } from '../fhirClient';
import type { Patient, Condition } from '../../types';

// jest.mock is hoisted above imports by babel-plugin-jest-hoist. Using a
// factory lets axios.create() return a usable instance at module-load time
// — the fhirClient module eagerly constructs a singleton at the bottom of
// fhirClient.ts (createSingletonClient), and a default auto-mock would
// return undefined and crash setupInterceptors before any beforeEach runs.
jest.mock('axios', () => {
  const buildInstance = () => ({
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    request: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  });
  return {
    __esModule: true,
    default: {
      create: jest.fn(buildInstance),
      isAxiosError: jest.fn(() => false),
    },
    create: jest.fn(buildInstance),
    isAxiosError: jest.fn(() => false),
  };
});

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('FHIRClient', () => {
  let client: FHIRClient;
  let mockAxiosInstance: any;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Mock axios instance
    mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      request: jest.fn(),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() }
      }
    };
    
    mockedAxios.create.mockReturnValue(mockAxiosInstance);
    
    // Create client instance
    client = new FHIRClient({
      baseUrl: '/fhir/R4',
      cache: { enabled: true, defaultTTL: 60000 },
      queue: { maxConcurrent: 5, requestsPerSecond: 10 }
    });
  });

  describe('Basic CRUD Operations', () => {
    test('should create a resource', async () => {
      const newPatient: Omit<Patient, 'id' | 'meta'> = {
        resourceType: 'Patient',
        name: [{ family: 'Test', given: ['Patient'] }],
        gender: 'male',
        birthDate: '1990-01-01'
      };

      const createdPatient: Patient = {
        ...newPatient,
        id: '123',
        meta: { versionId: '1', lastUpdated: '2025-01-21T10:00:00Z' }
      };

      mockAxiosInstance.post.mockResolvedValueOnce({ data: createdPatient });

      const result = await client.create<Patient>('Patient', newPatient);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('Patient', newPatient);
      expect(result).toEqual(createdPatient);
    });

    test('should read a resource by ID', async () => {
      const patient: Patient = {
        resourceType: 'Patient',
        id: '123',
        name: [{ family: 'Test', given: ['Patient'] }],
        gender: 'male',
        birthDate: '1990-01-01'
      };

      mockAxiosInstance.get.mockResolvedValueOnce({ data: patient });

      const result = await client.read<Patient>('Patient', '123');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('Patient/123');
      expect(result).toEqual(patient);
    });

    test('should update a resource', async () => {
      const patient: Patient = {
        resourceType: 'Patient',
        id: '123',
        name: [{ family: 'Updated', given: ['Patient'] }],
        gender: 'male',
        birthDate: '1990-01-01'
      };

      mockAxiosInstance.put.mockResolvedValueOnce({ data: patient });

      const result = await client.update<Patient>('Patient', '123', patient);

      expect(mockAxiosInstance.put).toHaveBeenCalledWith('Patient/123', patient);
      expect(result).toEqual(patient);
    });

    test('should delete a resource', async () => {
      mockAxiosInstance.delete.mockResolvedValueOnce({ status: 204 });

      await client.delete('Patient', '123');

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('Patient/123');
    });
  });

  describe('Search Operations', () => {
    test('should search for resources', async () => {
      const bundle = {
        resourceType: 'Bundle',
        type: 'searchset',
        total: 2,
        entry: [
          { resource: { resourceType: 'Condition', id: '1' } },
          { resource: { resourceType: 'Condition', id: '2' } }
        ]
      };

      mockAxiosInstance.get.mockResolvedValueOnce({ data: bundle });

      const result = await client.search<Condition>('Condition', {
        patient: 'Patient/123',
        'clinical-status': 'active'
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('Condition', {
        params: {
          patient: 'Patient/123',
          'clinical-status': 'active'
        }
      });
      expect(result.resources).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    test('should handle empty search results', async () => {
      const emptyBundle = {
        resourceType: 'Bundle',
        type: 'searchset',
        total: 0,
        entry: []
      };

      mockAxiosInstance.get.mockResolvedValueOnce({ data: emptyBundle });

      const result = await client.search<Condition>('Condition', {
        patient: 'Patient/999'
      });

      expect(result.resources).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    test('should handle 404 for unsupported resource types', async () => {
      mockAxiosInstance.get.mockRejectedValueOnce({
        response: { status: 404 }
      });

      const result = await client.search('UnsupportedResource', {});

      expect(result.resources).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('Caching', () => {
    test('should cache read operations', async () => {
      const patient: Patient = {
        resourceType: 'Patient',
        id: '123',
        name: [{ family: 'Test', given: ['Patient'] }]
      };

      mockAxiosInstance.get.mockResolvedValueOnce({ data: patient });

      // First call - should hit API
      const result1 = await client.read<Patient>('Patient', '123');
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const result2 = await client.read<Patient>('Patient', '123');
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);

      expect(result1).toEqual(result2);
    });

    test('should refresh cache from PUT response after update', async () => {
      // update() clears the prior cache entry for this resource and re-seeds
      // it with the PUT response. A subsequent read therefore returns the
      // updated value from cache without a follow-up GET — confirmed by
      // fhirClient.ts:1024 (clearCache) + 1030 (setInCache).
      const original: Patient = {
        resourceType: 'Patient',
        id: '123',
        name: [{ family: 'Test', given: ['Patient'] }]
      };
      const updated: Patient = {
        resourceType: 'Patient',
        id: '123',
        name: [{ family: 'Updated', given: ['Patient'] }]
      };

      mockAxiosInstance.get.mockResolvedValue({ data: original });
      mockAxiosInstance.put.mockResolvedValue({ data: updated });

      // Read to populate cache
      const before = await client.read<Patient>('Patient', '123');
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);
      expect(before.name?.[0].family).toBe('Test');

      // Update re-seeds cache with PUT response
      await client.update<Patient>('Patient', '123', updated);

      // Next read returns the updated value from cache; no extra GET
      const after = await client.read<Patient>('Patient', '123');
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);
      expect(after.name?.[0].family).toBe('Updated');
    });

    test('should clear cache by pattern', async () => {
      const patient1: Patient = {
        resourceType: 'Patient',
        id: '123',
        name: [{ family: 'Test1' }]
      };
      const patient2: Patient = {
        resourceType: 'Patient',
        id: '456',
        name: [{ family: 'Test2' }]
      };

      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: patient1 })
        .mockResolvedValueOnce({ data: patient2 });

      // Read both patients to cache
      await client.read<Patient>('Patient', '123');
      await client.read<Patient>('Patient', '456');

      // Clear cache for specific pattern
      client.clearCache('Patient/123');

      // Verify cache state
      mockAxiosInstance.get.mockResolvedValue({ data: patient1 });
      await client.read<Patient>('Patient', '123'); // Should hit API
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(3);

      await client.read<Patient>('Patient', '456'); // Should use cache
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(3);
    });
  });

  describe('Batch Operations', () => {
    test('should execute batch requests', async () => {
      const batchBundle = {
        resourceType: 'Bundle',
        type: 'batch-response',
        entry: [
          {
            response: { status: '200' },
            resource: { resourceType: 'Patient', id: '1' }
          },
          {
            response: { status: '201' },
            resource: { resourceType: 'Patient', id: '2' }
          }
        ]
      };

      mockAxiosInstance.post.mockResolvedValueOnce({ data: batchBundle });

      const results = await client.batch([
        { method: 'GET', url: 'Patient/1' },
        { method: 'POST', url: 'Patient', resource: { resourceType: 'Patient' } }
      ]);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });

    test('should unwrap responses pre-transformed by the standardizeResponse interceptor', async () => {
      // FHIRResourceContext registers a global response interceptor that
      // rewrites any Bundle into `{ resources, total, bundle }`. By the
      // time `httpClient.post` resolves, `response.data` is the wrapped
      // shape and no longer has a top-level `.entry`. Without unwrapping,
      // batch() silently returned [] and every loader that depended on it
      // (warmPatientCache, fetchPatientBundle) dispatched nothing — the
      // user-visible symptom was a fully-empty patient summary.
      const innerBundle = {
        resourceType: 'Bundle',
        type: 'batch-response',
        entry: [
          { response: { status: '200' }, resource: { resourceType: 'Patient', id: '1' } },
          { response: { status: '200' }, resource: { resourceType: 'Bundle', type: 'searchset', total: 2, entry: [] } }
        ]
      };
      const wrapped = { resources: [], total: 2, bundle: innerBundle };
      mockAxiosInstance.post.mockResolvedValueOnce({ data: wrapped });

      const results = await client.batch([
        { method: 'GET', url: 'Patient/1' },
        { method: 'GET', url: 'Condition?patient=1' }
      ]);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[0].resource).toEqual({ resourceType: 'Patient', id: '1' });
      expect(results[1].success).toBe(true);
      expect(results[1].resource?.resourceType).toBe('Bundle');
    });

    test('should handle batch errors', async () => {
      const batchBundle = {
        resourceType: 'Bundle',
        type: 'batch-response',
        entry: [
          {
            response: { status: '200' },
            resource: { resourceType: 'Patient', id: '1' }
          },
          {
            response: {
              status: '400',
              outcome: {
                resourceType: 'OperationOutcome',
                issue: [{ severity: 'error', code: 'invalid' }]
              }
            }
          }
        ]
      };

      mockAxiosInstance.post.mockResolvedValueOnce({ data: batchBundle });

      const results = await client.batch([
        { method: 'GET', url: 'Patient/1' },
        { method: 'POST', url: 'Patient', resource: { resourceType: 'Patient' } }
      ]);

      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].error).toBeDefined();
    });
  });

  describe('Retry Logic', () => {
    // The retry handler is the LAST one registered during construction (see
    // setupInterceptors in fhirClient.ts:266). We build a dedicated client
    // with retryDelay=0 so backoff doesn't slow the suite, then capture the
    // error handler off the mocked interceptor registration and invoke it
    // directly with a synthetic AxiosError — the same shape axios would
    // hand to it in real execution.
    let retryErrorHandler: (error: any) => any;
    let retryInstance: any;

    beforeEach(() => {
      retryInstance = {
        get: jest.fn(),
        post: jest.fn(),
        put: jest.fn(),
        delete: jest.fn(),
        request: jest.fn(),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
      };
      mockedAxios.create.mockReturnValueOnce(retryInstance);

      new FHIRClient({
        baseUrl: '/fhir/R4',
        queue: { retryDelay: 0, retryAttempts: 3 } as any,
      });

      const responseUseCalls = retryInstance.interceptors.response.use.mock.calls;
      // The retry handler is the final response.use registration.
      retryErrorHandler = responseUseCalls[responseUseCalls.length - 1][1];
    });

    test('should retry on network errors', async () => {
      retryInstance.request.mockResolvedValueOnce({
        data: { resourceType: 'Patient', id: '123' },
      });

      // No response object → network error; shouldRetry returns true.
      const networkError = { config: {}, message: 'Network error' };
      const result = await retryErrorHandler(networkError);

      expect(retryInstance.request).toHaveBeenCalledTimes(1);
      expect(result.data.id).toBe('123');
    });

    test('should not retry on 4xx errors except specific ones', async () => {
      const badRequest = { config: {}, response: { status: 400 } };

      await expect(retryErrorHandler(badRequest)).rejects.toBeDefined();
      expect(retryInstance.request).not.toHaveBeenCalled();
    });
  });

  describe('Helper Methods', () => {
    test('should build references correctly', () => {
      const ref = FHIRClient.reference('Patient', '123', 'John Doe');
      expect(ref).toEqual({
        reference: 'Patient/123',
        display: 'John Doe'
      });
    });

    test('should extract IDs from references', () => {
      expect(FHIRClient.extractId('Patient/123')).toBe('123');
      expect(FHIRClient.extractId({ reference: 'Patient/123' })).toBe('123');
      expect(FHIRClient.extractId('http://example.com/fhir/Patient/123')).toBe('123');
      expect(FHIRClient.extractId(undefined)).toBeNull();
      expect(FHIRClient.extractId('')).toBeNull();
    });
  });

  describe('Convenience Methods', () => {
    test('should get patient everything', async () => {
      const bundle = {
        resourceType: 'Bundle',
        type: 'searchset',
        entry: []
      };

      mockAxiosInstance.post.mockResolvedValueOnce({ data: bundle });

      const result = await client.getPatientEverything('123');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        'Patient/123/$everything',
        undefined
      );
      expect(result).toEqual(bundle);
    });

    test('should get vital signs', async () => {
      const bundle = {
        resourceType: 'Bundle',
        type: 'searchset',
        entry: []
      };

      mockAxiosInstance.get.mockResolvedValueOnce({ data: bundle });

      await client.getVitalSigns('123', 10);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('Observation', {
        params: {
          patient: '123',
          category: 'vital-signs',
          _count: 10,
          _sort: '-date'
        }
      });
    });

    test('should search for critical lab values', async () => {
      const criticalObservation = {
        resourceType: 'Observation',
        id: '1',
        code: { coding: [{ code: '2339-0' }] },
        valueQuantity: { value: 450, unit: 'mg/dL' }
      };

      const bundle = {
        resourceType: 'Bundle',
        type: 'searchset',
        entry: [{ resource: criticalObservation }]
      };

      mockAxiosInstance.get.mockResolvedValue({ data: bundle });

      const results = await client.searchCriticalLabValues('123', '24h');

      expect(results.length).toBeGreaterThan(0);
      expect(mockAxiosInstance.get).toHaveBeenCalled();
    });
  });

  describe('Interceptors', () => {
    test('should add custom interceptors', () => {
      const requestInterceptor = (config: any) => config;
      const responseInterceptor = (response: any) => response;
      const errorInterceptor = async (error: any) => Promise.reject(error);

      client.addRequestInterceptor(requestInterceptor);
      client.addResponseInterceptor(responseInterceptor);
      client.addErrorInterceptor(errorInterceptor);

      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled();
    });
  });
});

describe('fhirClient singleton', () => {
  test('should export a singleton instance', () => {
    expect(fhirClient).toBeDefined();
    expect(fhirClient).toBeInstanceOf(FHIRClient);
  });
});