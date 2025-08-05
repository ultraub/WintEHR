/**
 * WebSocket Service
 * Manages real-time communication with the backend
 * 
 * Features:
 * - Auto-reconnection with exponential backoff
 * - Event subscription system
 * - Connection state management
 * - Heartbeat/ping-pong mechanism
 * - Message queuing during disconnection
 */

class WebSocketService {
  constructor() {
    this.ws = null;
    this.url = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000; // Start with 1 second
    this.maxReconnectDelay = 30000; // Max 30 seconds
    this.listeners = new Map();
    this.messageQueue = [];
    this.isConnected = false;
    this.heartbeatInterval = null;
    this.connectionListeners = new Set();
    
    // Get WebSocket URL from environment or use default
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    
    // In development, we need to connect directly to backend port
    // In production, we use the same host as the frontend
    let host;
    if (process.env.NODE_ENV === 'development' && !process.env.REACT_APP_WS_URL) {
      // Development: Connect directly to backend
      host = 'localhost:8000';
    } else {
      // Production or custom URL
      host = process.env.REACT_APP_WS_URL || window.location.host;
    }
    
    this.baseUrl = `${protocol}//${host}/api/ws`;
  }

  /**
   * Connect to WebSocket server
   * @param {string} token - Optional authentication token
   */
  connect(token = null) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    // Construct URL with token if provided
    this.url = token ? `${this.baseUrl}?token=${encodeURIComponent(token)}` : this.baseUrl;
    
    // Connecting to WebSocket
    
    try {
      this.ws = new WebSocket(this.url);
      this.setupEventHandlers();
    } catch (error) {
      // Connection error, will attempt reconnect
      this.scheduleReconnect();
    }
  }

  /**
   * Setup WebSocket event handlers
   */
  setupEventHandlers() {
    this.ws.onopen = () => {
      // WebSocket connected
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;
      
      // Send any queued messages
      this.flushMessageQueue();
      
      // Start heartbeat
      this.startHeartbeat();
      
      // Notify connection listeners
      this.notifyConnectionListeners('connected');
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      } catch (error) {
        // Failed to parse message
      }
    };

    this.ws.onerror = (error) => {
      // WebSocket error
      this.notifyConnectionListeners('error', error);
    };

    this.ws.onclose = (event) => {
      // WebSocket disconnected
      this.isConnected = false;
      this.stopHeartbeat();
      this.notifyConnectionListeners('disconnected', event);
      
      // Attempt to reconnect unless explicitly closed
      if (event.code !== 1000) {
        this.scheduleReconnect();
      }
    };
  }

  /**
   * Handle incoming messages
   */
  handleMessage(data) {
    const { type, payload, data: messageData } = data;
    
    // Handle system messages
    switch (type) {
      case 'welcome':
        // Welcome message received
        break;
      case 'pong':
        // Heartbeat response
        break;
      case 'error':
        // Server error
        break;
      case 'subscription':
        // Subscription confirmed
        break;
      case 'update':
        // Handle FHIR resource updates from other users
        if (messageData) {
          // Resource update received
          const { event_type, patient_id, resource_type, resource } = messageData;
          
          // Dispatch as a clinical event
          if (event_type && resource) {
            this.dispatch(event_type, {
              patientId: patient_id,
              resource: resource,
              resourceType: resource_type,
              fromWebSocket: true // Mark as coming from WebSocket
            });
          }
        }
        break;
      default:
        // Dispatch to listeners
        this.dispatch(type, payload || data);
    }
  }

  /**
   * Subscribe to a patient room for multi-user updates
   * @param {string} patientId - Patient ID to subscribe to
   * @param {Array<string>} resourceTypes - Optional resource types to filter
   */
  async subscribeToPatient(patientId, resourceTypes = []) {
    if (!this.isConnected) {
      // Cannot subscribe - not connected
      return;
    }
    
    const subscriptionId = `patient-${patientId}-${Date.now()}`;
    const message = {
      type: 'subscription',
      data: {
        subscription_id: subscriptionId,
        patient_ids: [patientId],
        resource_types: resourceTypes
      }
    };
    
    // Subscribing to patient
    this.send(message);
    
    // Store subscription info for reconnection
    this.activeSubscriptions = this.activeSubscriptions || new Map();
    this.activeSubscriptions.set(subscriptionId, { patientId, resourceTypes });
    
    return subscriptionId;
  }
  
  /**
   * Unsubscribe from a patient room
   * @param {string} subscriptionId - Subscription ID to cancel
   */
  async unsubscribeFromPatient(subscriptionId) {
    if (!this.isConnected) {
      return;
    }
    
    const message = {
      type: 'unsubscribe',
      data: {
        subscription_id: subscriptionId
      }
    };
    
    // Unsubscribing
    this.send(message);
    
    // Remove from active subscriptions
    if (this.activeSubscriptions) {
      this.activeSubscriptions.delete(subscriptionId);
    }
  }

  /**
   * Subscribe to a custom room (e.g., pharmacy:queue)
   * @param {string} roomName - Room name to subscribe to
   * @returns {string} Subscription ID
   */
  async subscribeToRoom(roomName) {
    if (!this.isConnected) {
      // Cannot subscribe to room - not connected
      return;
    }
    
    const subscriptionId = `room-${roomName}-${Date.now()}`;
    const message = {
      type: 'subscription',
      data: {
        subscription_id: subscriptionId,
        room: roomName
      }
    };
    
    // Subscribing to room
    this.send(message);
    
    // Store subscription info for reconnection
    this.activeSubscriptions = this.activeSubscriptions || new Map();
    this.activeSubscriptions.set(subscriptionId, { room: roomName });
    
    return subscriptionId;
  }
  
  /**
   * Unsubscribe from a room
   * @param {string} subscriptionId - Subscription ID to cancel
   */
  async unsubscribeFromRoom(subscriptionId) {
    if (!this.isConnected) {
      return;
    }
    
    const message = {
      type: 'unsubscribe',
      data: {
        subscription_id: subscriptionId
      }
    };
    
    // Unsubscribing from room
    this.send(message);
    
    // Remove from active subscriptions
    if (this.activeSubscriptions) {
      this.activeSubscriptions.delete(subscriptionId);
    }
  }

  /**
   * Subscribe to events
   * @param {string} eventType - Event type to listen for
   * @param {function} callback - Callback function
   * @returns {function} Unsubscribe function
   */
  subscribe(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    
    this.listeners.get(eventType).add(callback);
    
    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(eventType);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          this.listeners.delete(eventType);
        }
      }
    };
  }

  /**
   * Subscribe to connection state changes
   */
  onConnectionChange(callback) {
    this.connectionListeners.add(callback);
    return () => this.connectionListeners.delete(callback);
  }

  /**
   * Dispatch event to listeners
   */
  dispatch(eventType, data) {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          // Error in listener
        }
      });
    }
  }

  /**
   * Publish event to server
   * @param {string} eventType - Event type
   * @param {object} data - Event data
   */
  publish(eventType, data) {
    const message = {
      type: eventType,
      payload: data,
      timestamp: new Date().toISOString()
    };

    if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      // Queue message if not connected
      // Queuing message
      this.messageQueue.push(message);
    }
  }

  /**
   * Send raw message
   */
  send(message) {
    if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(typeof message === 'string' ? message : JSON.stringify(message));
    } else {
      // Cannot send message - not connected
    }
  }

  /**
   * Flush queued messages
   */
  flushMessageQueue() {
    while (this.messageQueue.length > 0 && this.isConnected) {
      const message = this.messageQueue.shift();
      this.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Schedule reconnection attempt
   */
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      // Max reconnection attempts reached
      this.notifyConnectionListeners('failed');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );

    // Scheduling reconnection
    
    setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Start heartbeat mechanism
   */
  startHeartbeat() {
    this.stopHeartbeat();
    
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping' });
      }
    }, 30000); // Send ping every 30 seconds
  }

  /**
   * Stop heartbeat
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Notify connection state listeners
   */
  notifyConnectionListeners(state, data = null) {
    this.connectionListeners.forEach(callback => {
      try {
        callback(state, data);
      } catch (error) {
        // Error in connection listener
      }
    });
  }

  /**
   * Manually reconnect
   */
  reconnect() {
    this.disconnect();
    this.reconnectAttempts = 0;
    this.connect();
  }

  /**
   * Disconnect from server
   */
  disconnect() {
    this.stopHeartbeat();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    
    this.isConnected = false;
    this.messageQueue = [];
    this.reconnectAttempts = 0;
  }

  /**
   * Get connection state
   */
  getConnectionState() {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      queuedMessages: this.messageQueue.length
    };
  }
}

// Create singleton instance
const websocketService = new WebSocketService();

// Export service and helper function
export default websocketService;

export const getWebSocketConnection = () => websocketService;