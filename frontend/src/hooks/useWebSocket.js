/**
 * React hook for WebSocket subscriptions
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import websocketClient from '../services/websocket';

/**
 * Hook for subscribing to FHIR resource updates via WebSocket
 * @param {Object} options - Subscription options
 * @param {string[]} options.resourceTypes - Resource types to subscribe to
 * @param {string[]} options.patientIds - Patient IDs to subscribe to
 * @param {boolean} options.enabled - Whether to enable the subscription
 * @returns {Object} WebSocket state and methods
 */
export const useWebSocket = ({ 
  resourceTypes = [], 
  patientIds = [], 
  enabled = true 
} = {}) => {
  const [connected, setConnected] = useState(websocketClient.connected);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [error, setError] = useState(null);
  const subscriptionRef = useRef(null);
  const updateCallbackRef = useRef(null);

  // Connection status effect
  useEffect(() => {
    const checkConnection = setInterval(() => {
      setConnected(websocketClient.connected);
    }, 1000);

    return () => clearInterval(checkConnection);
  }, []);

  // Subscribe to updates
  useEffect(() => {
    if (!enabled) return;

    const handleUpdate = (update) => {
      setLastUpdate({
        ...update,
        timestamp: new Date()
      });

      // Call custom update handler if provided
      if (updateCallbackRef.current) {
        updateCallbackRef.current(update);
      }
    };

    // Create subscription
    const subscriptionId = websocketClient.subscribe({
      resourceTypes,
      patientIds,
      onUpdate: handleUpdate
    });

    subscriptionRef.current = subscriptionId;

    // Cleanup
    return () => {
      if (subscriptionRef.current) {
        websocketClient.unsubscribe(subscriptionRef.current);
        subscriptionRef.current = null;
      }
    };
  }, [resourceTypes, patientIds, enabled]);

  // Method to set custom update handler
  const onUpdate = useCallback((callback) => {
    updateCallbackRef.current = callback;
  }, []);

  // Method to manually connect
  const connect = useCallback(async (token) => {
    try {
      await websocketClient.connect(token);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  // Method to manually disconnect
  const disconnect = useCallback(() => {
    websocketClient.disconnect();
  }, []);

  return {
    connected,
    lastUpdate,
    error,
    onUpdate,
    connect,
    disconnect
  };
};

/**
 * Hook for subscribing to patient-specific updates
 * @param {string} patientId - Patient ID to monitor
 * @param {Object} options - Additional options
 * @returns {Object} WebSocket state for patient
 */
export const usePatientUpdates = (patientId, options = {}) => {
  const [patientData, setPatientData] = useState({});
  
  const { connected, lastUpdate, error, onUpdate } = useWebSocket({
    ...options,
    patientIds: patientId ? [patientId] : [],
    enabled: !!patientId && (options.enabled !== false)
  });

  // Handle updates
  useEffect(() => {
    onUpdate((update) => {
      const { resourceType, resource, action } = update;
      
      setPatientData(prev => {
        const newData = { ...prev };
        
        if (action === 'deleted') {
          // Remove resource from local state
          if (newData[resourceType]) {
            delete newData[resourceType][resource.id];
          }
        } else {
          // Add or update resource
          if (!newData[resourceType]) {
            newData[resourceType] = {};
          }
          newData[resourceType][resource.id] = resource;
        }
        
        return newData;
      });
    });
  }, [onUpdate]);

  return {
    connected,
    lastUpdate,
    error,
    patientData
  };
};

/**
 * Hook for subscribing to clinical events
 * @param {string} eventType - Type of clinical event to monitor
 * @param {Function} onEvent - Callback for events
 * @returns {Object} WebSocket state for clinical events
 */
export const useClinicalEvents = (eventType, onEvent) => {
  const [connected, setConnected] = useState(websocketClient.connected);
  const [lastEvent, setLastEvent] = useState(null);

  useEffect(() => {
    if (!eventType || !onEvent) return;

    const handleEvent = (event) => {
      setLastEvent({
        ...event,
        timestamp: new Date()
      });
      onEvent(event);
    };

    const subscriptionId = websocketClient.subscribeToClinicalEvents(
      eventType,
      handleEvent
    );

    return () => {
      // Clean up if needed
    };
  }, [eventType, onEvent]);

  // Connection status effect
  useEffect(() => {
    const checkConnection = setInterval(() => {
      setConnected(websocketClient.connected);
    }, 1000);

    return () => clearInterval(checkConnection);
  }, []);

  return {
    connected,
    lastEvent
  };
};