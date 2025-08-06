import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export const useNotifications = () => {
  const [count, setCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const pollIntervalRef = useRef(null);

  // Function to fetch notification count
  const fetchNotificationCount = useCallback(async () => {
    if (!user) return;

    try {
      // TODO: Implement notifications endpoint in backend
      // For now, return 0 to prevent 404 errors
      setCount(0);
      return;
      
      // The following code is temporarily commented out until the notifications endpoint is implemented
      /*
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
      */
    } catch (error) {
      // Silently handle error since notifications are not critical
      
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
                  ext.url === 'http://wintehr.com/fhir/StructureDefinition/notification-read'
                    ? { ...ext, valueBoolean: true }
                    : ext
                )}
              : notif
          )
        );
        
        return true;
      }
    } catch (error) {
      
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
              ext.url === 'http://wintehr.com/fhir/StructureDefinition/notification-read'
                ? { ...ext, valueBoolean: true }
                : ext
            )
          }))
        );
        
        return true;
      }
    } catch (error) {
      
      return false;
    }
  }, [user]);


  // Set up polling
  useEffect(() => {
    if (!user) return;

    // Initial fetch
    fetchNotificationCount();

    // Set up polling (every 30 seconds)
    pollIntervalRef.current = setInterval(fetchNotificationCount, 30000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [user, fetchNotificationCount]);

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