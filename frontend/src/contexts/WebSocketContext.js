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
  const [isOnline, setIsOnline] = useState(navigator.onLine);
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
    // Don't require user in simple auth mode
    if (isConnected || !isOnline) {
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');
      
      // Check if we're in simple mode (no JWT required)
      if (!token || token === 'null') {
        // Try connecting without authentication for simple mode
        wsRef.current = new WebSocket(WS_URL);
        
        wsRef.current.onopen = () => {
          // WebSocket connected in simple mode
          setIsConnected(true);
          reconnectAttempts.current = 0;
        };
        
        wsRef.current.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            setLastMessage({ data: event.data, timestamp: Date.now() });
            
            if (message.type === 'ping') {
              sendMessage({ type: 'pong' });
            }
          } catch (error) {
            console.warn('WebSocket message parse error:', error);
          }
        };
        
        wsRef.current.onclose = () => {
          // WebSocket disconnected
          setIsConnected(false);
          wsRef.current = null;
          
          // Retry connection after delay
          if (reconnectAttempts.current < 3) {
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
            reconnectAttempts.current += 1;
            setTimeout(connect, delay);
          }
        };
        
        return;
      }
      
      // Connect with authentication for JWT mode
      wsRef.current = new WebSocket(WS_URL);

      wsRef.current.onopen = () => {
        // Send authentication message after connection
        const authMessage = {
          type: 'authenticate',
          token: token
        };
        wsRef.current.send(JSON.stringify(authMessage));
        
        setIsConnected(true);
        reconnectAttempts.current = 0;

        // Re-subscribe to all active subscriptions after auth
        setTimeout(() => {
          Object.entries(subscriptions).forEach(([id, { resourceTypes, patientIds }]) => {
            subscribe(id, resourceTypes, patientIds);
          });
        }, 100); // Small delay to ensure auth is processed
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
          
        }
      };

      wsRef.current.onclose = () => {
        
        setIsConnected(false);
        wsRef.current = null;

        // Only attempt to reconnect if we have a valid token
        const token = localStorage.getItem('auth_token');
        if (token && token !== 'null' && reconnectAttempts.current < 3) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          reconnectAttempts.current += 1;

          reconnectTimeoutRef.current = setTimeout(() => {
            if (user) {
              // Reconnecting to WebSocket
              connect();
            }
          }, delay);
        }
      };

      wsRef.current.onerror = (error) => {
        
      };
    } catch (error) {
      
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
  }, [user]); // Only depend on user, not on connect/disconnect

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (user) {
        connect();
      }
    };
    
    const handleOffline = () => {
      setIsOnline(false);
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [user, connect]);

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