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
  }

  /**
   * Discover available CDS services
   */
  async discoverServices() {
    try {
      const response = await this.httpClient.get('/');
      return response.data.services || [];
    } catch (error) {
      console.error('Error discovering CDS services:', error);
      return [];
    }
  }

  /**
   * Execute a specific CDS Hook
   */
  async executeHook(hookId, context) {
    try {
      const response = await this.httpClient.post(`/${hookId}`, context);
      return response.data;
    } catch (error) {
      console.error(`Error executing CDS Hook ${hookId}:`, error);
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
    
    const context = {
      userId,
      patientId,
      context: {
        patientId,
        encounterId
      }
    };

    const allCards = [];
    
    for (const service of patientViewServices) {
      const result = await this.executeHook(service.id, context);
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
    
    const context = {
      userId,
      patientId,
      context: {
        patientId,
        medications
      }
    };

    const allCards = [];
    
    for (const service of prescribeServices) {
      const result = await this.executeHook(service.id, context);
      if (result.cards && result.cards.length > 0) {
        allCards.push(...result.cards);
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
    
    const context = {
      userId,
      patientId,
      context: {
        patientId,
        draftOrders: orders
      }
    };

    const allCards = [];
    
    for (const service of orderServices) {
      const result = await this.executeHook(service.id, context);
      if (result.cards && result.cards.length > 0) {
        allCards.push(...result.cards);
      }
    }

    return allCards;
  }
}

// Export singleton instance
export const cdsHooksClient = new CDSHooksClient();

// Also export class for custom instances
export default CDSHooksClient;