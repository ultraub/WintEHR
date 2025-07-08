/**
 * CDS Hooks Client Service
 * Handles communication with CDS Hooks endpoints
 */
import axios from 'axios';

class CDSHooksClient {
  constructor() {
    // Use relative URL for production compatibility
    this.baseUrl = process.env.REACT_APP_CDS_HOOKS_URL || '/cds-hooks';
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
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

    try {
      const response = await this.httpClient.get('/cds-services');
      this.servicesCache = response.data.services || [];
      this.servicesCacheTime = now;
      return this.servicesCache;
    } catch (error) {
      
      // Return cached data if available, even if expired
      return this.servicesCache || [];
    }
  }

  /**
   * Execute a specific CDS Hook
   */
  async executeHook(hookId, context) {
    // Create cache key from hookId and context
    const cacheKey = `${hookId}-${JSON.stringify(context)}`;
    const now = Date.now();
    
    // Check cache
    const cached = this.requestCache.get(cacheKey);
    if (cached && (now - cached.time < this.requestCacheTimeout)) {
      return cached.data;
    }

    try {
      const response = await this.httpClient.post(`/cds-services/${hookId}`, context);
      
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
      
      return { cards: [] };
    }
  }

  /**
   * Call a CDS service (alias for executeHook for compatibility)
   */
  async callService(serviceId, context) {
    return this.executeHook(serviceId, context);
  }

  /**
   * Fire patient-view hook
   */
  async firePatientView(patientId, userId, encounterId = null) {
    const services = await this.discoverServices();
    const patientViewServices = services.filter(s => s.hook === 'patient-view');
    
    const allCards = [];
    
    for (const service of patientViewServices) {
      // Properly format context according to CDS Hooks v1.0 spec
      const hookContext = {
        hook: 'patient-view',
        hookInstance: `${service.id}-${Date.now()}`,
        context: {
          patientId,
          userId
        }
      };
      
      if (encounterId) {
        hookContext.context.encounterId = encounterId;
      }
      
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
   * Fire medication-prescribe hook
   */
  async fireMedicationPrescribe(patientId, userId, medications = []) {
    const services = await this.discoverServices();
    const prescribeServices = services.filter(s => s.hook === 'medication-prescribe');
    
    const allCards = [];
    
    for (const service of prescribeServices) {
      // Properly format context according to CDS Hooks v1.0 spec
      const hookContext = {
        hook: 'medication-prescribe',
        hookInstance: `${service.id}-${Date.now()}`,
        context: {
          patientId,
          userId,
          medications
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
   * Fire order-sign hook
   */
  async fireOrderSign(patientId, userId, orders = []) {
    const services = await this.discoverServices();
    const orderServices = services.filter(s => s.hook === 'order-sign');
    
    const allCards = [];
    
    for (const service of orderServices) {
      // Properly format context according to CDS Hooks v1.0 spec
      const hookContext = {
        hook: 'order-sign',
        hookInstance: `${service.id}-${Date.now()}`,
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
}

// Export singleton instance
export const cdsHooksClient = new CDSHooksClient();

// Also export class for custom instances
export default CDSHooksClient;