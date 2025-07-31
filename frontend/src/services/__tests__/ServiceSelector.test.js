/**
 * Comprehensive tests for ServiceSelector
 * Tests feature flag infrastructure and service selection logic
 */

import { 
  ServiceSelector, 
  serviceSelector, 
  getMedicationSearchService, 
  getMedicationWorkflowService,
  getHttpClient,
  medicationSearchAdapter,
  medicationWorkflowAdapter
} from '../ServiceSelector';

// Mock all the services
jest.mock('../MedicationCRUDService', () => ({
  medicationCRUDService: {
    search: jest.fn(),
    getMedicationById: jest.fn(),
    COMMON_MEDICATIONS: []
  }
}));

jest.mock('../MedicationWorkflowService', () => ({
  medicationWorkflowService: {
    getMedicationReconciliationData: jest.fn(),
    createRefillRequest: jest.fn()
  }
}));

jest.mock('../HttpClientFactory', () => ({
  createApiClient: jest.fn(() => ({ type: 'api-factory' })),
  createFhirClient: jest.fn(() => ({ type: 'fhir-factory' })),
  createEmrClient: jest.fn(() => ({ type: 'emr-factory' })),
  createCdsClient: jest.fn(() => ({ type: 'cds-factory' })),
  getCachedClient: jest.fn(() => ({ type: 'cached-factory' }))
}));

// Mock legacy services
jest.mock('../api', () => ({ type: 'legacy-api' }));
jest.mock('../fhirClient', () => ({ fhirClient: { type: 'legacy-fhir' } }));
jest.mock('../emrClient', () => ({ emrClient: { type: 'legacy-emr' } }));
jest.mock('../cdsHooksClient', () => ({ cdsHooksClient: { type: 'legacy-cds' } }));

jest.mock('../medicationSearchService', () => ({
  medicationSearchService: { searchMedications: jest.fn() }
}));
jest.mock('../medicationDiscontinuationService', () => ({
  medicationDiscontinuationService: { discontinue: jest.fn() }
}));
jest.mock('../medicationReconciliationService', () => ({
  medicationReconciliationService: { getMedicationReconciliationData: jest.fn() }
}));
jest.mock('../prescriptionRefillService', () => ({
  prescriptionRefillService: { createRefillRequest: jest.fn() }
}));
jest.mock('../prescriptionStatusService', () => ({
  prescriptionStatusService: { updatePrescriptionStatus: jest.fn() }
}));
jest.mock('../medicationWorkflowValidator', () => ({
  medicationWorkflowValidator: { validatePatientMedicationWorkflow: jest.fn() }
}));

describe('ServiceSelector', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = process.env;
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Constructor and feature flag loading', () => {
    it('should load feature flags from environment variables', () => {
      process.env.REACT_APP_USE_NEW_MEDICATION_SERVICES = 'true';
      process.env.REACT_APP_USE_NEW_HTTP_FACTORY = 'true';
      process.env.REACT_APP_DEBUG_SERVICE_SELECTION = 'true';

      const selector = new ServiceSelector();
      const flags = selector.getFeatureFlags();

      expect(flags.useNewMedicationServices).toBe(true);
      expect(flags.useNewHttpFactory).toBe(true);
      expect(flags.debugServiceSelection).toBe(true);
    });

    it('should default to false for undefined environment variables', () => {
      const selector = new ServiceSelector();
      const flags = selector.getFeatureFlags();

      expect(flags.useNewMedicationServices).toBe(false);
      expect(flags.useNewHttpFactory).toBe(false);
      expect(flags.useNewConverters).toBe(false);
      expect(flags.debugServiceSelection).toBe(false);
    });
  });

  describe('Feature flag management', () => {
    let selector;

    beforeEach(() => {
      selector = new ServiceSelector();
    });

    it('should update feature flags at runtime', () => {
      selector.setFeatureFlag('useNewMedicationServices', true);
      
      const flags = selector.getFeatureFlags();
      expect(flags.useNewMedicationServices).toBe(true);
    });

    it('should clear relevant cache when feature flags change', () => {
      const clearCacheSpy = jest.spyOn(selector, 'clearCache');
      
      selector.setFeatureFlag('useNewMedicationServices', true);
      
      expect(clearCacheSpy).toHaveBeenCalledWith('useNewMedicationServices');
    });

    it('should enable/disable debug mode', () => {
      selector.setDebugMode(true);
      
      expect(selector.debugMode).toBe(true);
      expect(selector.featureFlags.debugServiceSelection).toBe(true);
    });
  });

  describe('Medication service selection', () => {
    let selector;

    beforeEach(() => {
      selector = new ServiceSelector();
    });

    describe('getMedicationSearchService', () => {
      it('should return new service when feature flag enabled', () => {
        selector.setFeatureFlag('useNewMedicationServices', true);
        
        const service = selector.getMedicationSearchService();
        
        expect(service).toHaveProperty('search');
      });

      it('should return legacy service when feature flag disabled', () => {
        selector.setFeatureFlag('useNewMedicationServices', false);
        
        const service = selector.getMedicationSearchService();
        
        expect(service).toHaveProperty('searchMedications');
      });

      it('should cache service instances', () => {
        selector.setFeatureFlag('useNewMedicationServices', true);
        
        const service1 = selector.getMedicationSearchService();
        const service2 = selector.getMedicationSearchService();
        
        expect(service1).toBe(service2);
      });
    });

    describe('getMedicationWorkflowService', () => {
      it('should return new service when feature flag enabled', () => {
        selector.setFeatureFlag('useNewMedicationServices', true);
        
        const service = selector.getMedicationWorkflowService();
        
        expect(service).toHaveProperty('getMedicationReconciliationData');
      });

      it('should return legacy services object when feature flag disabled', () => {
        selector.setFeatureFlag('useNewMedicationServices', false);
        
        const service = selector.getMedicationWorkflowService();
        
        expect(service).toHaveProperty('reconciliation');
        expect(service).toHaveProperty('refill');
        expect(service).toHaveProperty('status');
        expect(service).toHaveProperty('validator');
      });
    });

    describe('getMedicationService', () => {
      it('should map service types to new consolidated services', () => {
        selector.setFeatureFlag('useNewMedicationServices', true);
        
        const searchService = selector.getMedicationService('search');
        const reconciliationService = selector.getMedicationService('reconciliation');
        
        expect(searchService).toHaveProperty('search');
        expect(reconciliationService).toHaveProperty('getMedicationReconciliationData');
      });

      it('should return specific legacy services when feature flag disabled', () => {
        selector.setFeatureFlag('useNewMedicationServices', false);
        
        const searchService = selector.getMedicationService('search');
        const reconciliationService = selector.getMedicationService('reconciliation');
        
        expect(searchService).toHaveProperty('searchMedications');
        expect(reconciliationService).toHaveProperty('getMedicationReconciliationData');
      });
    });
  });

  describe('HTTP client selection', () => {
    let selector;

    beforeEach(() => {
      selector = new ServiceSelector();
    });

    describe('getHttpClient', () => {
      it('should return new factory clients when feature flag enabled', () => {
        selector.setFeatureFlag('useNewHttpFactory', true);
        
        const apiClient = selector.getHttpClient('api');
        const fhirClient = selector.getHttpClient('fhir');
        
        expect(apiClient.type).toBe('api-factory');
        expect(fhirClient.type).toBe('fhir-factory');
      });

      it('should return legacy clients when feature flag disabled', () => {
        selector.setFeatureFlag('useNewHttpFactory', false);
        
        const apiClient = selector.getHttpClient('api');
        const fhirClient = selector.getHttpClient('fhir');
        
        expect(apiClient.type).toBe('legacy-api');
        expect(fhirClient.type).toBe('legacy-fhir');
      });

      it('should cache client instances', () => {
        selector.setFeatureFlag('useNewHttpFactory', true);
        
        const client1 = selector.getHttpClient('api');
        const client2 = selector.getHttpClient('api');
        
        expect(client1).toBe(client2);
      });

      it('should pass configuration to client factory', () => {
        const { createApiClient } = require('../HttpClientFactory');
        selector.setFeatureFlag('useNewHttpFactory', true);
        
        const config = { timeout: 5000 };
        selector.getHttpClient('api', config);
        
        expect(createApiClient).toHaveBeenCalledWith(config);
      });
    });

    describe('getCachedHttpClient', () => {
      it('should use factory cached client when feature flag enabled', () => {
        const { getCachedClient } = require('../HttpClientFactory');
        selector.setFeatureFlag('useNewHttpFactory', true);
        
        const client = selector.getCachedHttpClient('api');
        
        expect(getCachedClient).toHaveBeenCalledWith('api', {});
        expect(client.type).toBe('cached-factory');
      });

      it('should fallback to regular client when feature flag disabled', () => {
        selector.setFeatureFlag('useNewHttpFactory', false);
        
        const client = selector.getCachedHttpClient('api');
        
        expect(client.type).toBe('legacy-api');
      });
    });
  });

  describe('Adapter methods', () => {
    let selector;

    beforeEach(() => {
      selector = new ServiceSelector();
    });

    describe('createMedicationSearchAdapter', () => {
      it('should create adapter for new service', () => {
        selector.setFeatureFlag('useNewMedicationServices', true);
        
        const adapter = selector.createMedicationSearchAdapter();
        
        expect(adapter).toHaveProperty('searchMedications');
        expect(adapter).toHaveProperty('getMedicationById');
        expect(adapter).toHaveProperty('_isNew', true);
      });

      it('should wrap legacy service when feature flag disabled', () => {
        selector.setFeatureFlag('useNewMedicationServices', false);
        
        const adapter = selector.createMedicationSearchAdapter();
        
        expect(adapter).toHaveProperty('searchMedications');
        expect(adapter).toHaveProperty('_isNew', false);
      });
    });

    describe('createMedicationWorkflowAdapter', () => {
      it('should create adapter for new service', () => {
        selector.setFeatureFlag('useNewMedicationServices', true);
        
        const adapter = selector.createMedicationWorkflowAdapter();
        
        expect(adapter).toHaveProperty('getMedicationReconciliationData');
        expect(adapter).toHaveProperty('createRefillRequest');
        expect(adapter).toHaveProperty('updatePrescriptionStatus');
        expect(adapter).toHaveProperty('_isNew', true);
      });

      it('should create unified interface for legacy services', () => {
        selector.setFeatureFlag('useNewMedicationServices', false);
        
        const adapter = selector.createMedicationWorkflowAdapter();
        
        expect(adapter).toHaveProperty('getMedicationReconciliationData');
        expect(adapter).toHaveProperty('createRefillRequest');
        expect(adapter).toHaveProperty('updatePrescriptionStatus');
        expect(adapter).toHaveProperty('_isNew', false);
      });
    });
  });

  describe('Utility methods', () => {
    let selector;

    beforeEach(() => {
      selector = new ServiceSelector();
    });

    describe('getServiceInfo', () => {
      it('should provide service information', () => {
        selector.setFeatureFlag('useNewMedicationServices', true);
        selector.setFeatureFlag('useNewHttpFactory', false);
        
        const info = selector.getServiceInfo();
        
        expect(info).toEqual({
          featureFlags: expect.objectContaining({
            useNewMedicationServices: true,
            useNewHttpFactory: false
          }),
          activeServices: {
            medicationSearch: 'MedicationCRUDService',
            medicationWorkflow: 'MedicationWorkflowService',
            httpClient: 'legacy clients'
          },
          cacheSize: expect.any(Number),
          debugMode: false
        });
      });
    });

    describe('clearAllCache', () => {
      it('should clear all cached services', () => {
        selector.getMedicationSearchService(); // Cache a service
        expect(selector.serviceCache.size).toBeGreaterThan(0);
        
        selector.clearAllCache();
        
        expect(selector.serviceCache.size).toBe(0);
      });
    });

    describe('clearCache', () => {
      it('should clear specific cache entries based on flag changes', () => {
        selector.getMedicationSearchService(); // Cache medication services
        selector.getHttpClient('api'); // Cache HTTP client
        
        selector.clearCache('useNewMedicationServices');
        
        // Should clear medication-related cache entries
        expect(selector.serviceCache.has('medicationSearch')).toBe(false);
        expect(selector.serviceCache.has('medicationWorkflow')).toBe(false);
      });
    });
  });

  describe('Singleton and convenience functions', () => {
    it('should provide singleton instance', () => {
      expect(serviceSelector).toBeInstanceOf(ServiceSelector);
    });

    it('should provide convenience functions', () => {
      const medicationService = getMedicationSearchService();
      const workflowService = getMedicationWorkflowService();
      const httpClient = getHttpClient('api');
      
      expect(medicationService).toBeDefined();
      expect(workflowService).toBeDefined();
      expect(httpClient).toBeDefined();
    });

    it('should provide adapter functions', () => {
      const searchAdapter = medicationSearchAdapter();
      const workflowAdapter = medicationWorkflowAdapter();
      
      expect(searchAdapter).toHaveProperty('searchMedications');
      expect(workflowAdapter).toHaveProperty('getMedicationReconciliationData');
    });
  });

  describe('Debug mode', () => {
    let consoleSpy;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should log service selection when debug mode enabled', () => {
      process.env.REACT_APP_DEBUG_SERVICE_SELECTION = 'true';
      const selector = new ServiceSelector();
      
      selector.getMedicationSearchService();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Using legacy medicationSearchService')
      );
    });

    it('should not log when debug mode disabled', () => {
      const selector = new ServiceSelector();
      
      selector.getMedicationSearchService();
      
      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('Integration scenarios', () => {
    it('should handle gradual migration from legacy to new services', () => {
      const selector = new ServiceSelector();
      
      // Start with legacy services
      expect(selector.getMedicationSearchService()).toHaveProperty('searchMedications');
      expect(selector.getHttpClient('api').type).toBe('legacy-api');
      
      // Enable new medication services
      selector.setFeatureFlag('useNewMedicationServices', true);
      expect(selector.getMedicationSearchService()).toHaveProperty('search');
      
      // Enable new HTTP factory
      selector.setFeatureFlag('useNewHttpFactory', true);
      expect(selector.getHttpClient('api').type).toBe('api-factory');
    });

    it('should maintain backwards compatibility through adapters', () => {
      const selector = new ServiceSelector();
      
      // Test legacy adapter interface
      selector.setFeatureFlag('useNewMedicationServices', false);
      const legacyAdapter = selector.createMedicationSearchAdapter();
      expect(legacyAdapter._isNew).toBe(false);
      
      // Test new adapter interface
      selector.setFeatureFlag('useNewMedicationServices', true);
      const newAdapter = selector.createMedicationSearchAdapter();
      expect(newAdapter._isNew).toBe(true);
      
      // Both should have same interface
      expect(legacyAdapter).toHaveProperty('searchMedications');
      expect(newAdapter).toHaveProperty('searchMedications');
    });

    it('should handle feature flag changes during runtime', () => {
      const selector = new ServiceSelector();
      
      // Get initial service
      const initialService = selector.getMedicationSearchService();
      expect(initialService).toHaveProperty('searchMedications');
      
      // Change feature flag
      selector.setFeatureFlag('useNewMedicationServices', true);
      
      // Get new service (should be different due to cache clearing)
      const newService = selector.getMedicationSearchService();
      expect(newService).toHaveProperty('search');
      expect(newService).not.toBe(initialService);
    });
  });
});