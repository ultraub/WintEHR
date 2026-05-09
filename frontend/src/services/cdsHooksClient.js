/**
 * CDS Hooks Client Service - CDS Hooks 2.0
 * Handles communication with CDS Hooks endpoints
 */
import axios from 'axios';
import { cdsPrefetchResolver } from './cdsPrefetchResolver';
import { v4 as uuidv4 } from 'uuid';
import { getBackendUrl, getBackendApiUrl } from '../config/apiConfig';

class CDSHooksClient {
  constructor() {
    // Use centralized configuration for all URLs
    const backendUrl = getBackendUrl();
    const apiUrl = getBackendApiUrl();

    // Configure service endpoints
    this.baseUrl = apiUrl;

    console.log(`[CDSHooksClient] Using backend URL: ${backendUrl}`);

    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000, // 30 second timeout (increased for CDS processing)
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

    // Suppress further calls to a service that just failed, so a broken
    // service doesn't drop a failed XHR on every React render. The cooldown
    // depends on the failure category — see executeHook():
    //   - 404: stick for FAILED_COOLDOWN_404_MS — service genuinely doesn't
    //     exist; pointless to keep trying.
    //   - 5xx: stick for FAILED_COOLDOWN_5XX_MS — likely infrastructure
    //     (nginx rate limit, backend hiccup); recover quickly.
    //   - network error: do NOT stick. Transient client-side blips
    //     (offline, DNS) shouldn't lock out a working service.
    // Map value: { at: ms timestamp, cooldownMs: number }.
    this.failedServices = new Map();
    this.FAILED_COOLDOWN_404_MS = 5 * 60 * 1000; // 5 minutes
    this.FAILED_COOLDOWN_5XX_MS = 60 * 1000;     // 60 seconds

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
        const response = await this.httpClient.get('/cds-services');
        this.servicesCache = response.data.services || [];
        this.servicesCacheTime = now;
        return this.servicesCache;
      } catch (error) {
        // Failed to load CDS services - error handled gracefully with fallback
        
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

    // Short-circuit services that have already failed hard in this session.
    // After the per-entry cooldown elapses we drop the record and try
    // again — the service may have been redeployed (404 → 200) or
    // infrastructure pressure may have subsided (503 → 200).
    const failure = this.failedServices.get(hookId);
    if (failure !== undefined) {
      if (now - failure.at < failure.cooldownMs) {
        return { cards: [] };
      }
      this.failedServices.delete(hookId);
    }

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
        // Failed to execute CDS hook - error handled gracefully with fallback.
        //
        // Pick a cooldown by failure category:
        //   404 → service is gone; long cooldown (no point retrying)
        //   5xx → infrastructure (nginx rate limit, backend hiccup);
        //         short cooldown so we recover quickly when it eases
        //   network/other → transient client-side; do NOT sticky-fail,
        //         the next render's request gets to try fresh
        const status = error.response?.status;
        let cooldownMs = null;
        if (status === 404) {
          cooldownMs = this.FAILED_COOLDOWN_404_MS;
        } else if (status >= 500) {
          cooldownMs = this.FAILED_COOLDOWN_5XX_MS;
        }
        if (cooldownMs !== null && !this.failedServices.has(hookId)) {
          this.failedServices.set(hookId, { at: Date.now(), cooldownMs });
          console.warn(
            `[CDSHooksClient] Suppressing further calls to "${hookId}" for `
            + `${cooldownMs / 1000}s after HTTP ${status}.`
          );
        }

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

    // Dispatch every matching service in parallel. The previous
    // `for...of`+`await` serialized N services into wall = sum(durations);
    // this gives wall = max(durations). allSettled keeps the per-service
    // error-isolation behavior — one rejecting service doesn't lose the
    // others' cards. Output ordering matches input ordering because
    // Array.map preserves it.
    const settled = await Promise.allSettled(
      patientViewServices.map(async (service) => {
        const context = { patientId, userId };
        if (encounterId) context.encounterId = encounterId;

        let prefetch = null;
        if (service.prefetch && Object.keys(service.prefetch).length > 0) {
          try {
            prefetch = await cdsPrefetchResolver.resolvePrefetchTemplates(service, context);
          } catch (error) {
            // Prefetch resolution failed, continuing without prefetch
          }
        }

        const hookContext = {
          hook: 'patient-view',
          hookInstance: uuidv4(),
          context
        };

        const result = await this.executeHook(service.id, hookContext, prefetch);
        return { service, result };
      })
    );

    const allCards = [];
    for (const outcome of settled) {
      if (outcome.status !== 'fulfilled') continue;
      const { service, result } = outcome.value;
      if (result?.cards?.length > 0) {
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
   * Per CDS Hooks spec, medications should be passed as draftOrders Bundle
   */
  async fireMedicationPrescribe(patientId, userId, medications = []) {
    const services = await this.discoverServices();
    const prescribeServices = services.filter(s => s.hook === 'medication-prescribe');

    const allCards = [];

    // Format medications as FHIR Bundle entries per CDS Hooks 2.0 spec
    const draftOrders = {
      resourceType: 'Bundle',
      type: 'collection',
      entry: medications.map(med => ({
        resource: med.resourceType ? med : {
          resourceType: 'MedicationRequest',
          ...med
        }
      }))
    };

    // Parallel dispatch — same rationale as firePatientView.
    const settled = await Promise.allSettled(
      prescribeServices.map(async (service) => {
        const context = {
          patientId,
          userId,
          draftOrders // CDS Hooks spec requires draftOrders, not medications
        };

        let prefetch = null;
        if (service.prefetch && Object.keys(service.prefetch).length > 0) {
          try {
            prefetch = await cdsPrefetchResolver.resolvePrefetchTemplates(service, context);
          } catch (error) {
            // Prefetch resolution failed, continuing without prefetch
          }
        } else {
          // Use common prefetch for medication-prescribe if no templates defined
          try {
            prefetch = await cdsPrefetchResolver.buildCommonPrefetch('medication-prescribe', context);
          } catch (error) {
            console.warn('Common prefetch failed, continuing without prefetch', error);
          }
        }

        const hookContext = {
          hook: 'medication-prescribe',
          hookInstance: uuidv4(),
          context
        };

        const result = await this.executeHook(service.id, hookContext, prefetch);
        return { service, result };
      })
    );

    for (const outcome of settled) {
      if (outcome.status !== 'fulfilled') continue;
      const { service, result } = outcome.value;
      if (result?.cards?.length > 0) {
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
   * Per CDS Hooks spec, orders should be passed as draftOrders Bundle
   */
  async fireOrderSign(patientId, userId, orders = []) {
    const services = await this.discoverServices();
    const orderServices = services.filter(s => s.hook === 'order-sign');

    const allCards = [];

    // Format orders as FHIR Bundle per CDS Hooks 2.0 spec
    const draftOrders = {
      resourceType: 'Bundle',
      type: 'collection',
      entry: orders.map(order => ({
        resource: order.resourceType ? order : {
          resourceType: 'ServiceRequest',
          ...order
        }
      }))
    };

    // Parallel dispatch — same rationale as firePatientView.
    const settled = await Promise.allSettled(
      orderServices.map(async (service) => {
        const hookContext = {
          hook: 'order-sign',
          hookInstance: uuidv4(),
          context: { patientId, userId, draftOrders }
        };
        const result = await this.executeHook(service.id, hookContext);
        return { service, result };
      })
    );

    for (const outcome of settled) {
      if (outcome.status !== 'fulfilled') continue;
      const { service, result } = outcome.value;
      if (result?.cards?.length > 0) {
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