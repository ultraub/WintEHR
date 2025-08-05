/**
 * CDS Hooks Client Service - CDS Hooks 2.0
 * Handles communication with CDS Hooks endpoints
 */
import axios from 'axios';
import { cdsPrefetchResolver } from './cdsPrefetchResolver';
import { v4 as uuidv4 } from 'uuid';

class CDSHooksClient {
  constructor() {
    // Use proxied path for all environments - the proxy handles the actual backend URL
    // In development, the proxy forwards /api to http://localhost:8000
    this.baseUrl = process.env.REACT_APP_CDS_HOOKS_URL || '/api';
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000, // 10 second timeout
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    this.servicesCache = null;
    this.servicesCacheTime = null;
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes cache
    this.requestCache = new Map();
    this.requestCacheTimeout = 30 * 1000; // 30 seconds cache for individual requests
    this.lastFailureLogged = null;
    
    // Promise deduplication for in-flight requests
    this.inFlightRequests = new Map();
    
    // JWT token for CDS Hooks 2.0
    this.jwtToken = null;
  }

  /**
   * Discover available CDS services
   */
  async discoverServices() {
    // Check cache first
    const now = Date.now();
    if (this.servicesCache && this.servicesCacheTime && (now - this.servicesCacheTime < this.cacheTimeout)) {
      return this.servicesCache;
    }

    // Check if there's already an in-flight request for service discovery
    const inFlightKey = 'discover-services';
    if (this.inFlightRequests.has(inFlightKey)) {
      return this.inFlightRequests.get(inFlightKey);
    }

    // Create a new request promise
    const requestPromise = (async () => {
      try {
        console.log('[CDS Debug] CDSHooksClient - Discovering services from:', this.baseUrl + '/cds-services');
        const response = await this.httpClient.get('/cds-services');
        console.log('[CDS Debug] CDSHooksClient - Service discovery response:', response.data);
        this.servicesCache = response.data.services || [];
        this.servicesCacheTime = now;
        console.log('[CDS Debug] CDSHooksClient - Cached services:', this.servicesCache);
        return this.servicesCache;
      } catch (error) {
        // Failed to load CDS services - error handled gracefully with fallback
        console.error('[CDS Debug] CDSHooksClient - Service discovery failed:', error.message);
        console.error('[CDS Debug] CDSHooksClient - Error details:', error.response?.data || error);
        
        // Return cached data if available, even if expired
        if (this.servicesCache && this.servicesCache.length > 0) {
          return this.servicesCache;
        }
        
        // Return empty array as fallback - don't log repeatedly
        if (!this.lastFailureLogged || Date.now() - this.lastFailureLogged > 60000) {
          this.lastFailureLogged = Date.now();
        }
        return [];
      } finally {
        // Clean up the in-flight request
        this.inFlightRequests.delete(inFlightKey);
      }
    })();

    // Store the promise for deduplication
    this.inFlightRequests.set(inFlightKey, requestPromise);
    
    return requestPromise;
  }

  /**
   * Execute a specific CDS Hook
   * @param {string} hookId - Hook service ID
   * @param {Object} context - Hook request context OR full request object
   * @param {Object} prefetch - Optional prefetch data
   */
  async executeHook(hookId, context, prefetch = null) {
    // Create cache key from hookId and context
    const cacheKey = `${hookId}-${JSON.stringify(context)}`;
    const now = Date.now();
    
    // Check cache
    const cached = this.requestCache.get(cacheKey);
    if (cached && (now - cached.time < this.requestCacheTimeout)) {
      return cached.data;
    }

    // Check if there's already an in-flight request for this exact hook/context
    if (this.inFlightRequests.has(cacheKey)) {
      return this.inFlightRequests.get(cacheKey);
    }

    // Create a new request promise
    const requestPromise = (async () => {
      try {
        // Build request - check if context is already a full request object
        let request;
        if (context.hook && context.hookInstance && context.context) {
          // It's already a full request object from CDSContext
          request = { ...context };
        } else {
          // It's just a context object, build the full request
          request = { ...context };
        }
        
        if (prefetch) {
          request.prefetch = prefetch;
        }
        
        console.log(`[CDS Debug] CDSHooksClient - Sending request to /cds-services/${hookId}:`, request);
        const response = await this.httpClient.post(`/cds-services/${hookId}`, request);
        
        // Cache the response
        this.requestCache.set(cacheKey, {
          data: response.data,
          time: now
        });
        
        // Clean old cache entries
        for (const [key, value] of this.requestCache.entries()) {
          if (now - value.time > this.requestCacheTimeout) {
            this.requestCache.delete(key);
          }
        }
        
        return response.data;
      } catch (error) {
        // Failed to execute CDS hook - error handled gracefully with fallback
        
        // Check if we have cached data for this request
        const cached = this.requestCache.get(cacheKey);
        if (cached) {
          return cached.data;
        }
        
        return { cards: [] };
      } finally {
        // Clean up the in-flight request
        this.inFlightRequests.delete(cacheKey);
      }
    })();

    // Store the promise for deduplication
    this.inFlightRequests.set(cacheKey, requestPromise);
    
    return requestPromise;
  }

  /**
   * Call a CDS service (alias for executeHook for compatibility)
   */
  async callService(serviceId, context) {
    return this.executeHook(serviceId, context);
  }

  /**
   * Fire patient-view hook with prefetch optimization
   */
  async firePatientView(patientId, userId, encounterId = null) {
    const services = await this.discoverServices();
    const patientViewServices = services.filter(s => s.hook === 'patient-view');
    
    const allCards = [];
    
    for (const service of patientViewServices) {
      // Properly format context according to CDS Hooks v1.0 spec
      const context = {
        patientId,
        userId
      };
      
      if (encounterId) {
        context.encounterId = encounterId;
      }
      
      // Resolve prefetch data if service has prefetch templates
      let prefetch = null;
      if (service.prefetch && Object.keys(service.prefetch).length > 0) {
        try {
          prefetch = await cdsPrefetchResolver.resolvePrefetchTemplates(service, context);
        } catch (error) {
          console.warn('Prefetch resolution failed, continuing without prefetch', error);
        }
      }
      
      const hookContext = {
        hook: 'patient-view',
        hookInstance: `${service.id}-${Date.now()}`,
        context
      };
      
      const result = await this.executeHook(service.id, hookContext, prefetch);
      if (result.cards && result.cards.length > 0) {
        allCards.push(...result.cards.map(card => ({
          ...card,
          serviceId: service.id,
          serviceTitle: service.title
        })));
      }
    }

    return allCards;
  }

  /**
   * Fire medication-prescribe hook with prefetch optimization
   */
  async fireMedicationPrescribe(patientId, userId, medications = []) {
    const services = await this.discoverServices();
    const prescribeServices = services.filter(s => s.hook === 'medication-prescribe');
    
    const allCards = [];
    
    for (const service of prescribeServices) {
      const context = {
        patientId,
        userId,
        medications
      };
      
      // Resolve prefetch data if service has prefetch templates
      let prefetch = null;
      if (service.prefetch && Object.keys(service.prefetch).length > 0) {
        try {
          prefetch = await cdsPrefetchResolver.resolvePrefetchTemplates(service, context);
        } catch (error) {
          console.warn('Prefetch resolution failed, continuing without prefetch', error);
        }
      } else {
        // Use common prefetch for medication prescribe if no templates defined
        try {
          prefetch = await cdsPrefetchResolver.buildCommonPrefetch('medication-prescribe', context);
        } catch (error) {
          console.warn('Common prefetch failed, continuing without prefetch', error);
        }
      }
      
      const hookContext = {
        hook: 'medication-prescribe',
        hookInstance: `${service.id}-${Date.now()}`,
        context
      };
      
      const result = await this.executeHook(service.id, hookContext, prefetch);
      if (result.cards && result.cards.length > 0) {
        allCards.push(...result.cards.map(card => ({
          ...card,
          serviceId: service.id,
          serviceTitle: service.title
        })));
      }
    }

    return allCards;
  }

  /**
   * Fire order-sign hook
   */
  async fireOrderSign(patientId, userId, orders = []) {
    const services = await this.discoverServices();
    const orderServices = services.filter(s => s.hook === 'order-sign');
    
    const allCards = [];
    
    for (const service of orderServices) {
      // Properly format context according to CDS Hooks spec
      const hookContext = {
        hook: 'order-sign',
        hookInstance: uuidv4(), // CDS Hooks 2.0 requires UUID
        context: {
          patientId,
          userId,
          draftOrders: orders
        }
      };
      
      const result = await this.executeHook(service.id, hookContext);
      if (result.cards && result.cards.length > 0) {
        allCards.push(...result.cards.map(card => ({
          ...card,
          serviceId: service.id,
          serviceTitle: service.title
        })));
      }
    }

    return allCards;
  }

  /**
   * Send feedback about card outcomes - CDS Hooks 2.0
   * @param {string} serviceId - Service that generated the card
   * @param {object} feedbackData - Feedback data including card outcomes
   */
  async sendFeedback(serviceId, feedbackData) {
    try {
      const response = await this.httpClient.post(
        `/cds-services/${serviceId}/feedback`,
        feedbackData
      );
      return response.data;
    } catch (error) {
      console.error('Failed to send CDS feedback:', error);
      throw error;
    }
  }

  /**
   * Apply system actions - CDS Hooks 2.0
   * @param {array} systemActions - Array of system actions to apply
   * @param {object} context - Context including hookInstance
   */
  async applySystemActions(systemActions, context) {
    try {
      const response = await this.httpClient.post(
        `/cds-services/apply-system-actions`,
        {
          systemActions,
          context,
          hookInstance: context.hookInstance || uuidv4()
        }
      );
      return response.data;
    } catch (error) {
      console.error('Failed to apply system actions:', error);
      throw error;
    }
  }

  /**
   * Set JWT token for authentication - CDS Hooks 2.0
   * @param {string} token - JWT token
   */
  setAuthToken(token) {
    this.jwtToken = token;
    if (token) {
      this.httpClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete this.httpClient.defaults.headers.common['Authorization'];
    }
  }

  /**
   * Fire new CDS Hooks 2.0 hooks
   */
  
  // AllergyIntolerance Create Hook
  async fireAllergyIntoleranceCreate(patientId, userId, allergyIntolerance) {
    return this.executeHookType('allergyintolerance-create', {
      patientId,
      userId,
      allergyIntolerance
    });
  }

  // Appointment Book Hook
  async fireAppointmentBook(patientId, userId, appointments) {
    return this.executeHookType('appointment-book', {
      patientId,
      userId,
      appointments
    });
  }

  // Problem List Item Create Hook
  async fireProblemListItemCreate(patientId, userId, condition) {
    return this.executeHookType('problem-list-item-create', {
      patientId,
      userId,
      condition
    });
  }

  // Order Dispatch Hook
  async fireOrderDispatch(patientId, userId, order) {
    return this.executeHookType('order-dispatch', {
      patientId,
      userId,
      order
    });
  }

  // Medication Refill Hook
  async fireMedicationRefill(patientId, userId, medications) {
    return this.executeHookType('medication-refill', {
      patientId,
      userId,
      medications
    });
  }

  /**
   * Generic hook execution for CDS Hooks 2.0
   */
  async executeHookType(hookType, context, prefetch = null) {
    const services = await this.discoverServices();
    const relevantServices = services.filter(s => s.hook === hookType);
    
    const allCards = [];
    const allSystemActions = [];
    
    for (const service of relevantServices) {
      const hookContext = {
        hook: hookType,
        hookInstance: uuidv4(),
        context,
        fhirServer: window.location.origin + '/fhir/R4'
      };
      
      if (prefetch) {
        hookContext.prefetch = prefetch;
      }
      
      const result = await this.executeHook(service.id, hookContext);
      
      if (result.cards && result.cards.length > 0) {
        allCards.push(...result.cards.map(card => ({
          ...card,
          serviceId: service.id,
          serviceTitle: service.title,
          uuid: card.uuid || uuidv4() // Ensure all cards have UUIDs
        })));
      }
      
      if (result.systemActions && result.systemActions.length > 0) {
        allSystemActions.push(...result.systemActions);
      }
    }

    return {
      cards: allCards,
      systemActions: allSystemActions
    };
  }
}

// Export singleton instance
export const cdsHooksClient = new CDSHooksClient();

// Also export class for custom instances
export default CDSHooksClient;