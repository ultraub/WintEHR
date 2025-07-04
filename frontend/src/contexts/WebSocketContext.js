import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';

const WebSocketContext = createContext();

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:8000/api/ws';

export const WebSocketProvider = ({ children }) => {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const [subscriptions, setSubscriptions] = useState({});
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttempts = useRef(0);

  // Send message to WebSocket
  const sendMessage = useCallback((message) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, []);

  // Subscribe to resources
  const subscribe = useCallback((subscriptionId, resourceTypes = [], patientIds = []) => {
    const message = {
      type: 'subscribe',
      data: {
        subscription_id: subscriptionId,
        resource_types: resourceTypes,
        patient_ids: patientIds
      }
    };
    
    setSubscriptions(prev => ({
      ...prev,
      [subscriptionId]: { resourceTypes, patientIds }
    }));
    
    return sendMessage(message);
  }, [sendMessage]);

  // Unsubscribe from resources
  const unsubscribe = useCallback((subscriptionId) => {
    const message = {
      type: 'unsubscribe',
      data: {
        subscription_id: subscriptionId
      }
    };
    
    setSubscriptions(prev => {
      const newSubs = { ...prev };
      delete newSubs[subscriptionId];
      return newSubs;
    });
    
    return sendMessage(message);
  }, [sendMessage]);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (!user) return;

    try {
      const token = localStorage.getItem('token');
      const wsUrl = `${WS_URL}?token=${encodeURIComponent(token)}`;
      
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        reconnectAttempts.current = 0;

        // Re-subscribe to all active subscriptions
        Object.entries(subscriptions).forEach(([id, { resourceTypes, patientIds }]) => {
          subscribe(id, resourceTypes, patientIds);
        });
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          setLastMessage({ data: event.data, timestamp: Date.now() });
          
          // Handle ping messages
          if (message.type === 'ping') {
            sendMessage({ type: 'pong' });
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      wsRef.current.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        wsRef.current = null;

        // Attempt to reconnect with exponential backoff
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
        reconnectAttempts.current += 1;

        reconnectTimeoutRef.current = setTimeout(() => {
          if (user) {
            console.log(`Attempting to reconnect... (attempt ${reconnectAttempts.current})`);
            connect();
          }
        }, delay);
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
    }
  }, [user, subscriptions, subscribe, sendMessage]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
    reconnectAttempts.current = 0;
  }, []);

  // Connect when user logs in
  useEffect(() => {
    if (user) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [user, connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      disconnect();
    };
  }, [disconnect]);

  const value = {
    isConnected,
    lastMessage,
    sendMessage,
    subscribe,
    unsubscribe
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};