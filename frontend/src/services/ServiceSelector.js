/**
 * Service Selector
 * Feature flag infrastructure for choosing between old and new services
 * 
 * This service provides a unified way to switch between legacy services
 * and new consolidated services based on feature flags.
 * 
 * Environment Variables:
 * - REACT_APP_USE_NEW_MEDICATION_SERVICES: Enable new medication services
 * - REACT_APP_USE_NEW_HTTP_FACTORY: Enable HttpClientFactory
 * - REACT_APP_USE_NEW_CONVERTERS: Enable new converter patterns
 * - REACT_APP_DEBUG_SERVICE_SELECTION: Enable debug logging
 */

// Import new consolidated services
import { medicationCRUDService } from './MedicationCRUDService';
import { medicationWorkflowService } from './MedicationWorkflowService';
import { 
  createApiClient, 
  createFhirClient, 
  createEmrClient, 
  createCdsClient,
  getCachedClient 
} from './HttpClientFactory';

// Import legacy services (these remain unchanged)
import { default as legacyApi } from './api';
import { fhirClient as legacyFhirClient } from './fhirClient';
import { emrClient as legacyEmrClient } from './emrClient';
import { cdsHooksClient as legacyCdsHooksClient } from './cdsHooksClient';

// Import individual legacy medication services
import { medicationSearchService as legacyMedicationSearchService } from './medicationSearchService';
import { medicationDiscontinuationService as legacyMedicationDiscontinuationService } from './medicationDiscontinuationService';
import { medicationEffectivenessService as legacyMedicationEffectivenessService } from './medicationEffectivenessService';
import { medicationListManagementService as legacyMedicationListManagementService } from './medicationListManagementService';
import { medicationReconciliationService as legacyMedicationReconciliationService } from './medicationReconciliationService';
import { prescriptionRefillService as legacyPrescriptionRefillService } from './prescriptionRefillService';
import { prescriptionStatusService as legacyPrescriptionStatusService } from './prescriptionStatusService';
import { medicationWorkflowValidator as legacyMedicationWorkflowValidator } from './medicationWorkflowValidator';

class ServiceSelector {
  constructor() {
    this.featureFlags = this.loadFeatureFlags();
    this.debugMode = this.featureFlags.debugServiceSelection;
    this.serviceCache = new Map();
    
    // Debug logging helper
    this.debug = (...args) => {
      if (this.debugMode && typeof window !== 'undefined' && window.console) {
        console.debug('[ServiceSelector]', ...args);
      }
    };
    
    // Log feature flag status if debug mode is enabled
    if (this.debugMode) {
      this.debug('ServiceSelector initialized with feature flags:', this.featureFlags);
    }
  }

  /**
   * Load feature flags from environment variables
   */
  loadFeatureFlags() {
    return {
      useNewMedicationServices: process.env.REACT_APP_USE_NEW_MEDICATION_SERVICES === 'true',
      useNewHttpFactory: process.env.REACT_APP_USE_NEW_HTTP_FACTORY === 'true',
      useNewConverters: process.env.REACT_APP_USE_NEW_CONVERTERS === 'true',
      debugServiceSelection: process.env.REACT_APP_DEBUG_SERVICE_SELECTION === 'true'
    };
  }

  /**
   * Get feature flag status
   */
  getFeatureFlags() {
    return { ...this.featureFlags };
  }

  /**
   * Update feature flag (for runtime toggling)
   */
  setFeatureFlag(flagName, value) {
    this.featureFlags[flagName] = value;
    // Clear relevant cache entries
    this.clearCache(flagName);
    
    if (this.debugMode) {
      this.debug(`Feature flag updated: ${flagName} = ${value}`);
    }
  }

  /**
   * Clear service cache based on feature flag change
   */
  clearCache(flagName) {
    switch (flagName) {
      case 'useNewMedicationServices':
        this.serviceCache.delete('medicationSearch');
        this.serviceCache.delete('medicationWorkflow');
        break;
      case 'useNewHttpFactory':
        this.serviceCache.delete('httpClient');
        break;
      default:
        // Clear all cache
        this.serviceCache.clear();
    }
  }

  // ====================================================================
  // MEDICATION SERVICES SELECTION
  // ====================================================================

  /**
   * Get medication search service (legacy vs consolidated)
   */
  getMedicationSearchService() {
    const cacheKey = 'medicationSearch';
    
    if (this.serviceCache.has(cacheKey)) {
      return this.serviceCache.get(cacheKey);
    }

    let service;
    if (this.featureFlags.useNewMedicationServices) {
      service = medicationCRUDService;
      if (this.debugMode) {
        this.debug('Using new MedicationCRUDService for medication search');
      }
    } else {
      service = legacyMedicationSearchService;
      if (this.debugMode) {
        this.debug('Using legacy medicationSearchService');
      }
    }

    this.serviceCache.set(cacheKey, service);
    return service;
  }

  /**
   * Get medication workflow service (legacy vs consolidated)
   */
  getMedicationWorkflowService() {
    const cacheKey = 'medicationWorkflow';
    
    if (this.serviceCache.has(cacheKey)) {
      return this.serviceCache.get(cacheKey);
    }

    let service;
    if (this.featureFlags.useNewMedicationServices) {
      service = medicationWorkflowService;
      if (this.debugMode) {
        this.debug('Using new MedicationWorkflowService');
      }
    } else {
      // Return object with legacy services for backwards compatibility
      service = {
        reconciliation: legacyMedicationReconciliationService,
        refill: legacyPrescriptionRefillService,
        status: legacyPrescriptionStatusService,
        validator: legacyMedicationWorkflowValidator
      };
      if (this.debugMode) {
        this.debug('Using legacy medication workflow services');
      }
    }

    this.serviceCache.set(cacheKey, service);
    return service;
  }

  /**
   * Get specific medication service (for backwards compatibility)
   */
  getMedicationService(serviceType) {
    if (this.featureFlags.useNewMedicationServices) {
      // Map legacy service types to new consolidated services
      switch (serviceType) {
        case 'search':
        case 'discontinuation':
        case 'effectiveness':
        case 'listManagement':
          return medicationCRUDService;
        case 'reconciliation':
        case 'refill':
        case 'status':
        case 'validator':
          return medicationWorkflowService;
        default:
          return medicationCRUDService; // Default to CRUD service
      }
    } else {
      // Return legacy services
      const legacyServices = {
        search: legacyMedicationSearchService,
        discontinuation: legacyMedicationDiscontinuationService,
        effectiveness: legacyMedicationEffectivenessService,
        listManagement: legacyMedicationListManagementService,
        reconciliation: legacyMedicationReconciliationService,
        refill: legacyPrescriptionRefillService,
        status: legacyPrescriptionStatusService,
        validator: legacyMedicationWorkflowValidator
      };
      return legacyServices[serviceType];
    }
  }

  // ====================================================================
  // HTTP CLIENT SELECTION
  // ====================================================================

  /**
   * Get HTTP client (legacy vs factory)
   */
  getHttpClient(clientType = 'api', config = {}) {
    const cacheKey = `httpClient_${clientType}`;
    
    if (this.serviceCache.has(cacheKey)) {
      return this.serviceCache.get(cacheKey);
    }

    let client;
    if (this.featureFlags.useNewHttpFactory) {
      // Use new HttpClientFactory
      switch (clientType) {
        case 'api':
          client = createApiClient(config);
          break;
        case 'fhir':
          client = createFhirClient(config);
          break;
        case 'emr':
          client = createEmrClient(config);
          break;
        case 'cds':
          client = createCdsClient(config);
          break;
        default:
          client = createApiClient(config);
      }
      if (this.debugMode) {
        this.debug(`Using new HttpClientFactory for ${clientType} client`);
      }
    } else {
      // Use legacy clients
      switch (clientType) {
        case 'api':
          client = legacyApi;
          break;
        case 'fhir':
          client = legacyFhirClient;
          break;
        case 'emr':
          client = legacyEmrClient;
          break;
        case 'cds':
          client = legacyCdsHooksClient;
          break;
        default:
          client = legacyApi;
      }
      if (this.debugMode) {
        this.debug(`Using legacy ${clientType} client`);
      }
    }

    this.serviceCache.set(cacheKey, client);
    return client;
  }

  /**
   * Get cached HTTP client (only works with new factory)
   */
  getCachedHttpClient(clientType, config = {}) {
    if (this.featureFlags.useNewHttpFactory) {
      return getCachedClient(clientType, config);
    } else {
      // Fallback to regular client for legacy mode
      return this.getHttpClient(clientType, config);
    }
  }

  // ====================================================================
  // ADAPTER METHODS FOR BACKWARDS COMPATIBILITY
  // ====================================================================

  /**
   * Create backwards-compatible wrapper for medication search
   */
  createMedicationSearchAdapter() {
    const service = this.getMedicationSearchService();
    
    if (this.featureFlags.useNewMedicationServices) {
      // Adapter for new service to match legacy API
      return {
        searchMedications: (query, options) => service.search(query, options),
        getMedicationById: (id) => service.getMedicationById(id),
        getDosingRecommendations: (id, context) => service.getDosingRecommendations(id, context),
        checkDrugInteractions: (medications) => service.checkDrugInteractions(medications),
        checkAllergies: (medicationId, allergies) => service.checkAllergies(medicationId, allergies),
        getCommonPrescriptions: () => service.COMMON_MEDICATIONS,
        // Add any other methods that components expect
        _service: service, // Access to full service if needed
        _isNew: true
      };
    } else {
      // Return legacy service as-is
      return {
        ...service,
        _service: service,
        _isNew: false
      };
    }
  }

  /**
   * Create backwards-compatible wrapper for medication workflow
   */
  createMedicationWorkflowAdapter() {
    const service = this.getMedicationWorkflowService();
    
    if (this.featureFlags.useNewMedicationServices) {
      // Adapter for new service to match legacy APIs
      return {
        // Reconciliation methods
        getMedicationReconciliationData: (patientId, encounterId) => 
          service.getMedicationReconciliationData(patientId, encounterId),
        executeReconciliation: (patientId, data) => 
          service.executeReconciliation(patientId, data),
        
        // Refill methods
        createRefillRequest: (medicationRequestId, data) => 
          service.createRefillRequest(medicationRequestId, data),
        getRefillHistory: (medicationRequestId) => 
          service.getRefillHistory(medicationRequestId),
        calculateMedicationAdherence: (medicationRequestId, options) => 
          service.calculateMedicationAdherence(medicationRequestId, options),
        
        // Status methods
        updatePrescriptionStatus: (medicationRequestId, status, metadata) => 
          service.updatePrescriptionStatus(medicationRequestId, status, metadata),
        getPatientPrescriptionStatuses: (patientId) => 
          service.getPatientPrescriptionStatuses(patientId),
        
        // Validation methods
        validatePatientMedicationWorkflow: (patientId, options) => 
          service.validatePatientMedicationWorkflow(patientId, options),
        
        _service: service,
        _isNew: true
      };
    } else {
      // Return legacy services with consistent API
      return {
        // Reconciliation methods
        getMedicationReconciliationData: (patientId, encounterId) => 
          service.reconciliation.getMedicationReconciliationData(patientId, encounterId),
        executeReconciliation: (patientId, data) => 
          service.reconciliation.executeReconciliation(patientId, data),
        
        // Refill methods
        createRefillRequest: (medicationRequestId, data) => 
          service.refill.createRefillRequest(medicationRequestId, data),
        getRefillHistory: (medicationRequestId) => 
          service.refill.getRefillHistory(medicationRequestId),
        calculateMedicationAdherence: (medicationRequestId, options) => 
          service.refill.calculateMedicationAdherence(medicationRequestId, options),
        
        // Status methods
        updatePrescriptionStatus: (medicationRequestId, status, metadata) => 
          service.status.updatePrescriptionStatus(medicationRequestId, status, metadata),
        getPatientPrescriptionStatuses: (patientId) => 
          service.status.getPatientPrescriptionStatuses(patientId),
        
        // Validation methods
        validatePatientMedicationWorkflow: (patientId, options) => 
          service.validator.validatePatientMedicationWorkflow(patientId, options),
        
        _services: service,
        _isNew: false
      };
    }
  }

  // ====================================================================
  // UTILITY METHODS
  // ====================================================================

  /**
   * Get service information for debugging
   */
  getServiceInfo() {
    return {
      featureFlags: this.featureFlags,
      activeServices: {
        medicationSearch: this.featureFlags.useNewMedicationServices ? 'MedicationCRUDService' : 'legacy services',
        medicationWorkflow: this.featureFlags.useNewMedicationServices ? 'MedicationWorkflowService' : 'legacy services',
        httpClient: this.featureFlags.useNewHttpFactory ? 'HttpClientFactory' : 'legacy clients'
      },
      cacheSize: this.serviceCache.size,
      debugMode: this.debugMode
    };
  }

  /**
   * Clear all service cache
   */
  clearAllCache() {
    this.serviceCache.clear();
    if (this.debugMode) {
      this.debug('All service cache cleared');
    }
  }

  /**
   * Enable/disable debug mode
   */
  setDebugMode(enabled) {
    this.debugMode = enabled;
    this.featureFlags.debugServiceSelection = enabled;
  }
}

// Export singleton instance
export const serviceSelector = new ServiceSelector();

// Export convenience functions
export const getMedicationSearchService = () => serviceSelector.getMedicationSearchService();
export const getMedicationWorkflowService = () => serviceSelector.getMedicationWorkflowService();
export const getHttpClient = (clientType, config) => serviceSelector.getHttpClient(clientType, config);
export const getMedicationService = (serviceType) => serviceSelector.getMedicationService(serviceType);

// Export adapters for easy migration
export const medicationSearchAdapter = () => serviceSelector.createMedicationSearchAdapter();
export const medicationWorkflowAdapter = () => serviceSelector.createMedicationWorkflowAdapter();

// Export the ServiceSelector class for advanced usage
export { ServiceSelector };