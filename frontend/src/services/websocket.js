/**
 * WebSocket client for real-time FHIR updates
 * Implements reconnection logic, message queuing, and subscription management
 */

class FHIRWebSocketClient {
  constructor() {
    this.ws = null;
    this.clientId = null;
    this.subscriptions = new Map();
    this.eventHandlers = new Map();
    this.messageQueue = [];
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000; // Start with 1 second
    this.maxReconnectDelay = 30000; // Max 30 seconds
    this.heartbeatInterval = null;
    this.connectionPromise = null;
  }

  /**
   * Connect to WebSocket server
   * @param {string} token - Optional authentication token
   */
  async connect(token = null) {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = this._doConnect(token);
    return this.connectionPromise;
  }

  async _doConnect(token = null) {
    try {
      // Determine WebSocket URL based on current location
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      let host = window.location.host;
      
      // In development, use the backend port directly for WebSocket
      if (process.env.NODE_ENV === 'development' && !process.env.REACT_APP_API_URL) {
        // Extract port from package.json proxy or use default
        host = window.location.hostname + ':8000';
      } else if (process.env.REACT_APP_API_URL) {
        // Extract host from API URL
        const apiUrl = new URL(process.env.REACT_APP_API_URL);
        host = apiUrl.host;
      }
      
      const wsUrl = `${protocol}//${host}/api/ws${token ? `?token=${token}` : ''}`;

      

      this.ws = new WebSocket(wsUrl);

      await new Promise((resolve, reject) => {
        this.ws.onopen = () => {
          
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.reconnectDelay = 1000;
          resolve();
        };

        this.ws.onerror = (error) => {
          
          reject(error);
        };
      });

      // Set up message handler
      this.ws.onmessage = (event) => {
        this._handleMessage(JSON.parse(event.data));
      };

      // Set up close handler
      this.ws.onclose = () => {
        
        this.isConnected = false;
        this.clientId = null;
        this._clearHeartbeat();
        this._attemptReconnect(token);
      };

      // Send queued messages
      this._flushMessageQueue();

      return true;
    } catch (error) {
      
      this.connectionPromise = null;
      throw error;
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.clientId = null;
    this._clearHeartbeat();
    this.connectionPromise = null;
  }

  /**
   * Handle incoming WebSocket messages
   */
  _handleMessage(message) {
    

    switch (message.type) {
      case 'welcome':
        this.clientId = message.data.client_id;
        this._resubscribeAll();
        break;

      case 'ping':
        this._sendMessage({ type: 'pong' });
        break;

      case 'update':
        this._handleResourceUpdate(message.data);
        break;

      case 'subscription':
        this._handleSubscriptionResponse(message.data);
        break;

      case 'error':
        
        break;

      default:
        
    }
  }

  /**
   * Handle FHIR resource updates
   */
  _handleResourceUpdate(data) {
    const { action, resource_type, resource_id, patient_id, resource } = data;

    // Notify all matching event handlers
    this.eventHandlers.forEach((handler, key) => {
      const [eventResourceType, eventPatientId] = key.split(':');
      
      if (
        (eventResourceType === '*' || eventResourceType === resource_type) &&
        (eventPatientId === '*' || eventPatientId === patient_id)
      ) {
        handler({
          action,
          resourceType: resource_type,
          resourceId: resource_id,
          patientId: patient_id,
          resource
        });
      }
    });

    // Handle clinical events specially
    if (action === 'clinical_event' && resource) {
      const { event_type, details } = resource;
      this._handleClinicalEvent(event_type, details, resource_type, patient_id);
    }
  }

  /**
   * Handle clinical events (e.g., critical lab results)
   */
  _handleClinicalEvent(eventType, details, resourceType, patientId) {
    const key = `clinical:${eventType}`;
    const handler = this.eventHandlers.get(key);
    if (handler) {
      handler({
        eventType,
        details,
        resourceType,
        patientId
      });
    }
  }

  /**
   * Subscribe to resource updates
   * @param {Object} options - Subscription options
   * @param {string[]} options.resourceTypes - Resource types to subscribe to
   * @param {string[]} options.patientIds - Patient IDs to subscribe to
   * @param {Function} options.onUpdate - Callback for updates
   * @returns {string} Subscription ID
   */
  subscribe({ resourceTypes = [], patientIds = [], onUpdate }) {
    const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Store subscription locally
    this.subscriptions.set(subscriptionId, {
      resourceTypes,
      patientIds,
      onUpdate
    });

    // Register event handlers
    if (resourceTypes.length === 0 || resourceTypes.includes('*')) {
      // Subscribe to all resource types
      const key = `*:${patientIds.length === 0 ? '*' : patientIds[0]}`;
      this.eventHandlers.set(key, onUpdate);
    } else {
      // Subscribe to specific resource types
      resourceTypes.forEach(resourceType => {
        if (patientIds.length === 0) {
          const key = `${resourceType}:*`;
          this.eventHandlers.set(key, onUpdate);
        } else {
          patientIds.forEach(patientId => {
            const key = `${resourceType}:${patientId}`;
            this.eventHandlers.set(key, onUpdate);
          });
        }
      });
    }

    // Send subscription to server if connected
    if (this.isConnected) {
      this._sendMessage({
        type: 'subscribe',
        data: {
          subscription_id: subscriptionId,
          resource_types: resourceTypes,
          patient_ids: patientIds
        }
      });
    }

    return subscriptionId;
  }

  /**
   * Unsubscribe from resource updates
   * @param {string} subscriptionId - Subscription ID to remove
   */
  unsubscribe(subscriptionId) {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return;

    // Remove event handlers
    const { resourceTypes, patientIds } = subscription;
    if (resourceTypes.length === 0 || resourceTypes.includes('*')) {
      const key = `*:${patientIds.length === 0 ? '*' : patientIds[0]}`;
      this.eventHandlers.delete(key);
    } else {
      resourceTypes.forEach(resourceType => {
        if (patientIds.length === 0) {
          const key = `${resourceType}:*`;
          this.eventHandlers.delete(key);
        } else {
          patientIds.forEach(patientId => {
            const key = `${resourceType}:${patientId}`;
            this.eventHandlers.delete(key);
          });
        }
      });
    }

    // Remove subscription
    this.subscriptions.delete(subscriptionId);

    // Notify server if connected
    if (this.isConnected) {
      this._sendMessage({
        type: 'unsubscribe',
        data: {
          subscription_id: subscriptionId
        }
      });
    }
  }

  /**
   * Subscribe to clinical events
   * @param {string} eventType - Type of clinical event
   * @param {Function} onEvent - Callback for events
   * @returns {string} Subscription ID
   */
  subscribeToClinicalEvents(eventType, onEvent) {
    const key = `clinical:${eventType}`;
    this.eventHandlers.set(key, onEvent);
    return key;
  }

  /**
   * Send a message to the server
   */
  _sendMessage(message) {
    if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      // Queue message for later
      this.messageQueue.push(message);
    }
  }

  /**
   * Flush queued messages
   */
  _flushMessageQueue() {
    while (this.messageQueue.length > 0 && this.isConnected) {
      const message = this.messageQueue.shift();
      this._sendMessage(message);
    }
  }

  /**
   * Resubscribe all active subscriptions
   */
  _resubscribeAll() {
    this.subscriptions.forEach((subscription, subscriptionId) => {
      this._sendMessage({
        type: 'subscribe',
        data: {
          subscription_id: subscriptionId,
          resource_types: subscription.resourceTypes,
          patient_ids: subscription.patientIds
        }
      });
    });
  }

  /**
   * Attempt to reconnect after disconnection
   */
  _attemptReconnect(token) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );

    `);

    setTimeout(() => {
      this.connectionPromise = null;
      this.connect(token).catch(error => {
        
      });
    }, delay);
  }

  /**
   * Clear heartbeat interval
   */
  _clearHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Handle subscription response
   */
  _handleSubscriptionResponse(data) {
    
  }

  /**
   * Get connection status
   */
  get connected() {
    return this.isConnected;
  }

  /**
   * Get client ID
   */
  get id() {
    return this.clientId;
  }
}

// Create singleton instance
const websocketClient = new FHIRWebSocketClient();

export default websocketClient;