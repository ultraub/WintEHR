/**
 * CDS Hooks Service
 * Handles firing CDS hooks and managing responses
 */
import api from './api';

class CDSHooksService {
  constructor() {
    this.activeHooks = new Map();
    this.listeners = [];
    this.recentHooks = new Map(); // Track recent hook calls to prevent duplicates
    this.hookDebounceTime = 5000; // 5 second debounce for encounter switching
    this.firedHooksPerSession = new Set(); // Track hooks fired during this session
  }

  /**
   * Fire a CDS hook
   * @param {string} hook - Hook name (patient-view, medication-prescribe, etc.)
   * @param {object} context - Hook context containing patientId, userId, etc.
   * @returns {Promise<Array>} Array of CDS cards
   */
  async fireHook(hook, context) {
    try {
      // Create a unique key for this hook call
      const hookKey = `${hook}-${context.patientId}`;
      const hookKeyWithEncounter = `${hook}-${context.patientId}-${context.encounterId || 'none'}`;
      const now = Date.now();
      
      // Check if this exact hook was already fired in this session
      if (this.firedHooksPerSession.has(hookKeyWithEncounter)) {
        console.log(`Skipping ${hook} hook - already fired for this patient/encounter in session`);
        return [];
      }
      
      // Check if this hook was recently fired (debounce)
      const lastFired = this.recentHooks.get(hookKey);
      if (lastFired && (now - lastFired) < this.hookDebounceTime) {
        console.log(`Debouncing duplicate ${hook} hook call for patient ${context.patientId}`);
        return [];
      }
      
      // Update tracking
      this.recentHooks.set(hookKey, now);
      this.firedHooksPerSession.add(hookKeyWithEncounter);
      
      // Clean up old entries
      for (const [key, time] of this.recentHooks.entries()) {
        if (now - time > this.hookDebounceTime * 2) {
          this.recentHooks.delete(key);
        }
      }
      
      // Get available services for this hook type
      const discovery = await api.get('/cds-hooks/');
      const services = discovery.data.services.filter(s => s.hook === hook);
      
      if (services.length === 0) {
        console.log(`No CDS services registered for hook: ${hook}`);
        return [];
      }

      // Fire all services for this hook type
      const promises = services.map(service => 
        this.executeService(service.id, hook, context)
      );
      
      const results = await Promise.allSettled(promises);
      
      // Collect all cards from successful responses
      const allCards = [];
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.cards) {
          result.value.cards.forEach(card => {
            // Add service info to card
            card.serviceId = services[index].id;
            card.serviceTitle = services[index].title;
            // Add a unique ID if not present
            card.uuid = card.uuid || `${services[index].id}-${Date.now()}-${Math.random()}`;
            allCards.push(card);
          });
        }
      });

      // Notify listeners
      this.notifyListeners(hook, allCards);
      
      return allCards;
    } catch (error) {
      console.error('Error firing CDS hook:', error);
      return [];
    }
  }

  /**
   * Execute a specific CDS service
   */
  async executeService(serviceId, hook, context) {
    try {
      const request = {
        hookInstance: `${Date.now()}-${Math.random()}`,
        hook: hook,
        context: context
      };

      const response = await api.post(`/cds-hooks/${serviceId}`, request);
      return response.data;
    } catch (error) {
      console.error(`Error executing CDS service ${serviceId}:`, error);
      return { cards: [] };
    }
  }

  /**
   * Fire patient-view hook
   */
  async firePatientView(patientId, userId, encounterId = null) {
    return this.fireHook('patient-view', {
      patientId,
      userId,
      encounterId
    });
  }

  /**
   * Fire medication-prescribe hook
   */
  async fireMedicationPrescribe(patientId, userId, encounterId, medications) {
    return this.fireHook('medication-prescribe', {
      patientId,
      userId,
      encounterId,
      medications
    });
  }

  /**
   * Fire order-select hook
   */
  async fireOrderSelect(patientId, userId, encounterId, selections) {
    return this.fireHook('order-select', {
      patientId,
      userId,
      encounterId,
      selections
    });
  }

  /**
   * Fire order-sign hook
   */
  async fireOrderSign(patientId, userId, encounterId, draftOrders) {
    return this.fireHook('order-sign', {
      patientId,
      userId,
      encounterId,
      draftOrders
    });
  }

  /**
   * Add a listener for CDS hook events
   */
  addListener(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  /**
   * Notify all listeners of new CDS cards
   */
  notifyListeners(hook, cards) {
    this.listeners.forEach(listener => {
      try {
        listener(hook, cards);
      } catch (error) {
        console.error('Error in CDS hooks listener:', error);
      }
    });
  }

  /**
   * Clear session cache when patient changes
   */
  clearSessionCache(patientId = null) {
    if (patientId) {
      // Clear only entries for a specific patient
      const keysToDelete = [];
      for (const key of this.firedHooksPerSession) {
        if (key.includes(`-${patientId}-`)) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(key => this.firedHooksPerSession.delete(key));
    } else {
      // Clear all entries
      this.firedHooksPerSession.clear();
    }
    console.log('Cleared CDS hooks session cache');
  }

  /**
   * Get test context for demo purposes
   */
  getTestContext() {
    return {
      patientId: '1',
      userId: 'demo-user',
      encounterId: '1'
    };
  }
}

// Create singleton instance
const cdsHooksService = new CDSHooksService();

export default cdsHooksService;