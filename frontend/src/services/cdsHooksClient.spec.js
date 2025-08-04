/**
 * CDS Hooks Client - Spec-compliant implementation
 * Follows CDS Hooks 1.0 specification exactly
 */
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

class CDSHooksClientSpec {
  constructor() {
    this.baseUrl = process.env.REACT_APP_CDS_HOOKS_URL || 'http://localhost:8000';
    this.fhirServer = process.env.REACT_APP_FHIR_SERVER || 'http://localhost:8000/fhir/R4';
    
    // Create axios instance with proper headers
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
  }

  /**
   * Discover available CDS services
   * GET {baseUrl}/cds-services
   * @returns {Promise<{services: Array}>} Service discovery response
   */
  async discoverServices() {
    try {
      const response = await this.client.get('/cds-services');
      return response.data;
    } catch (error) {
      console.error('Service discovery failed:', error);
      throw new Error(`Failed to discover CDS services: ${error.message}`);
    }
  }

  /**
   * Get details for a specific service
   * @param {string} serviceId - Service identifier
   * @returns {Promise<Object>} Service definition
   */
  async getService(serviceId) {
    const discovery = await this.discoverServices();
    const service = discovery.services.find(s => s.id === serviceId);
    
    if (!service) {
      throw new Error(`Service '${serviceId}' not found`);
    }
    
    return service;
  }

  /**
   * Invoke a CDS service
   * POST {baseUrl}/cds-services/{id}
   * @param {string} serviceId - Service to invoke
   * @param {Object} request - CDS Hooks request
   * @returns {Promise<Object>} CDS Hooks response with cards
   */
  async invokeService(serviceId, request) {
    try {
      // Ensure request has required fields
      if (!request.hookInstance) {
        request.hookInstance = uuidv4();
      }
      
      // Add FHIR server if not provided
      if (!request.fhirServer) {
        request.fhirServer = this.fhirServer;
      }
      
      const response = await this.client.post(
        `/cds-services/${serviceId}`,
        request
      );
      
      return response.data;
    } catch (error) {
      console.error(`Service invocation failed for ${serviceId}:`, error);
      
      if (error.response?.status === 404) {
        throw new Error(`Service '${serviceId}' not found`);
      } else if (error.response?.status === 400) {
        throw new Error(`Invalid request: ${error.response.data.detail || error.message}`);
      } else {
        throw new Error(`Service invocation failed: ${error.message}`);
      }
    }
  }

  /**
   * Build a CDS Hooks request for a specific hook and context
   * @param {string} hook - Hook type (e.g., 'patient-view')
   * @param {Object} context - Hook-specific context
   * @param {Object} prefetch - Optional prefetched data
   * @returns {Object} Complete CDS Hooks request
   */
  buildRequest(hook, context, prefetch = null) {
    const request = {
      hookInstance: uuidv4(),
      fhirServer: this.fhirServer,
      hook: hook,
      context: context
    };
    
    // Add authorization if available
    const token = this.getAuthToken();
    if (token) {
      request.fhirAuthorization = {
        access_token: token,
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'user/*.read'
      };
    }
    
    // Add prefetch if provided
    if (prefetch) {
      request.prefetch = prefetch;
    }
    
    return request;
  }

  /**
   * Helper to get auth token from current session
   * @returns {string|null} Auth token if available
   */
  getAuthToken() {
    // In production, get from auth service
    return localStorage.getItem('access_token');
  }

  /**
   * Send feedback about a card
   * POST {baseUrl}/cds-services/feedback
   * @param {Object} feedback - Feedback data
   * @returns {Promise<void>}
   */
  async sendFeedback(feedback) {
    try {
      await this.client.post('/cds-services/feedback', feedback);
    } catch (error) {
      console.error('Failed to send feedback:', error);
      // Don't throw - feedback is best-effort
    }
  }

  /**
   * Helper to create feedback for a card action
   * @param {string} serviceId - Service that generated the card
   * @param {string} cardId - Card UUID
   * @param {string} outcome - accepted, overridden, or ignored
   * @param {Array} overrideReasons - Reasons if overridden
   * @returns {Object} Feedback object
   */
  createFeedback(serviceId, cardId, outcome, overrideReasons = []) {
    return {
      card: cardId,
      outcome: outcome,
      overrideReasons: outcome === 'overridden' ? overrideReasons : undefined,
      outcomeTimestamp: new Date().toISOString(),
      serviceId: serviceId
    };
  }

  /**
   * Invoke all services for a specific hook
   * @param {string} hook - Hook type
   * @param {Object} context - Hook context
   * @param {Object} prefetch - Optional prefetch data
   * @returns {Promise<Array>} Array of service responses
   */
  async invokeHook(hook, context, prefetch = null) {
    const discovery = await this.discoverServices();
    const relevantServices = discovery.services.filter(s => s.hook === hook);
    
    if (relevantServices.length === 0) {
      return [];
    }
    
    const request = this.buildRequest(hook, context, prefetch);
    
    // Invoke all relevant services in parallel
    const promises = relevantServices.map(service => 
      this.invokeService(service.id, request)
        .then(response => ({
          serviceId: service.id,
          ...response
        }))
        .catch(error => {
          console.error(`Service ${service.id} failed:`, error);
          return {
            serviceId: service.id,
            cards: [],
            error: error.message
          };
        })
    );
    
    return Promise.all(promises);
  }

  /**
   * Format a card for display
   * @param {Object} card - Raw card from service
   * @param {string} serviceId - Service that generated the card
   * @returns {Object} Formatted card with additional metadata
   */
  formatCard(card, serviceId) {
    return {
      ...card,
      uuid: card.uuid || uuidv4(),
      serviceId: serviceId,
      timestamp: new Date().toISOString(),
      dismissed: false
    };
  }
}

// Export singleton instance
export const cdsHooksClientSpec = new CDSHooksClientSpec();

// Also export class for testing
export default CDSHooksClientSpec;