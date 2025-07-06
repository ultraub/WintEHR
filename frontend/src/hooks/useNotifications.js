import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket } from '../contexts/WebSocketContext';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export const useNotifications = () => {
  const [count, setCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { lastMessage, sendMessage, subscribe, unsubscribe } = useWebSocket();
  const pollIntervalRef = useRef(null);

  // Function to fetch notification count
  const fetchNotificationCount = useCallback(async () => {
    if (!user) return;

    try {
      // TODO: Implement notifications endpoint in backend
      // For now, return 0 to prevent 404 errors
      setCount(0);
      return;
      
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/fhir/R4/notifications/count`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCount(data.count || 0);
      } else if (response.status === 404) {
        // Notifications endpoint not yet implemented - set count to 0
        setCount(0);
      }
    } catch (error) {
      // Silently handle error since notifications are not critical
      console.debug('Notifications not available:', error);
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Function to fetch notifications list
  const fetchNotifications = useCallback(async (unreadOnly = false) => {
    if (!user) return;

    try {
      const token = localStorage.getItem('token');
      const url = new URL(`${API_BASE_URL}/fhir/R4/notifications`);
      if (unreadOnly) {
        url.searchParams.append('unread_only', 'true');
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
        return data;
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  }, [user]);

  // Function to mark notification as read
  const markAsRead = useCallback(async (notificationId) => {
    if (!user) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/fhir/R4/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        // Update local count
        setCount(prev => Math.max(0, prev - 1));
        
        // Update notifications list if loaded
        setNotifications(prev => 
          prev.map(notif => 
            notif.id === notificationId 
              ? { ...notif, extension: notif.extension?.map(ext => 
                  ext.url === 'http://medgenemr.com/fhir/StructureDefinition/notification-read'
                    ? { ...ext, valueBoolean: true }
                    : ext
                )}
              : notif
          )
        );
        
        return true;
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return false;
    }
  }, [user]);

  // Function to mark all as read
  const markAllAsRead = useCallback(async () => {
    if (!user) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/fhir/R4/notifications/mark-all-read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setCount(0);
        
        // Update all notifications in the list
        setNotifications(prev => 
          prev.map(notif => ({
            ...notif,
            extension: notif.extension?.map(ext => 
              ext.url === 'http://medgenemr.com/fhir/StructureDefinition/notification-read'
                ? { ...ext, valueBoolean: true }
                : ext
            )
          }))
        );
        
        return true;
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      return false;
    }
  }, [user]);

  // Handle WebSocket messages
  useEffect(() => {
    if (!lastMessage) return;

    const message = JSON.parse(lastMessage.data);
    
    if (message.type === 'update' && message.data?.resource_type === 'Communication') {
      const { action, resource } = message.data;
      
      if (action === 'created') {
        // Check if this notification is for the current user
        const isForCurrentUser = resource?.recipient?.some(
          r => r.reference === `Practitioner/${user.id}`
        );
        
        if (isForCurrentUser) {
          // Increment count if it's unread
          const isUnread = resource?.extension?.some(
            ext => ext.url === 'http://medgenemr.com/fhir/StructureDefinition/notification-read' 
                   && ext.valueBoolean === false
          );
          
          if (isUnread) {
            setCount(prev => prev + 1);
          }
          
          // Add to notifications list if it's loaded
          if (notifications.length > 0) {
            setNotifications(prev => [resource, ...prev]);
          }
        }
      } else if (action === 'updated') {
        // Update notification if it's in our list
        setNotifications(prev => 
          prev.map(notif => 
            notif.id === message.data.resource_id ? resource : notif
          )
        );
        
        // Recalculate count if needed
        fetchNotificationCount();
      }
    }
  }, [lastMessage, user, notifications.length, fetchNotificationCount]);

  // Set up WebSocket subscription and polling
  useEffect(() => {
    if (!user) return;

    // Subscribe to Communication resources
    const subscriptionId = `notifications-${user.id}`;
    subscribe(subscriptionId, ['Communication'], [`Practitioner/${user.id}`]);

    // Initial fetch
    fetchNotificationCount();

    // Set up polling as fallback (every 30 seconds)
    pollIntervalRef.current = setInterval(fetchNotificationCount, 30000);

    return () => {
      unsubscribe(subscriptionId);
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [user, subscribe, unsubscribe, fetchNotificationCount]);

  return {
    count,
    notifications,
    loading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    refetch: fetchNotificationCount
  };
};