/**
 * Auth Context Provider
 * Real authentication context for the EMR system
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { AUTH_UNAUTHORIZED_EVENT } from '../constants/authEvents';

const AuthContext = createContext(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkSession = useCallback(async () => {
    const token = localStorage.getItem('auth_token');
    const cachedUser = localStorage.getItem('auth_user');
    let parsed = null;
    if (token && cachedUser) {
      try {
        parsed = JSON.parse(cachedUser);
      } catch (e) {
        parsed = null;
      }
    }
    if (!parsed) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      setLoading(false);
      return;
    }
    // Confirm the cached session with the backend before trusting it. A stale
    // token used to look signed in until the first strict endpoint returned
    // 401 and threw the user out mid-task. A 401 here is handled by the api
    // interceptor (AUTH_UNAUTHORIZED_EVENT); any other failure (backend down,
    // network) keeps the cached user so the app still opens.
    setUser(parsed);
    try {
      await api.get('/api/auth/me');
    } catch (e) {
      // see comment above
    }
    setLoading(false);
  }, []);

  // The api layer reports a confirmed-dead session; drop the user so
  // ProtectedRoute redirects to /login through the router.
  useEffect(() => {
    const onUnauthorized = () => setUser(null);
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  // Check for existing session on mount
  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const login = async (username, password = 'password') => {
    setLoading(true);
    try {
      const response = await api.post('/api/auth/login', {
        username: username,
        password: password
      });
      
      const { session_token, user: userData, access_token, token_type } = response.data;
      
      // Store token (session_token for training mode, access_token for JWT mode)
      const authToken = access_token || session_token;
      localStorage.setItem('auth_token', authToken);
      localStorage.setItem('auth_user', JSON.stringify(userData));
      
      // Set user data
      setUser(userData);
      
      return userData;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.post('/api/auth/logout');
    } catch (error) {
      console.warn('Logout request failed; clearing local session anyway:', error);
    } finally {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      setUser(null);
    }
  };

  const value = {
    user,
    isAuthenticated: !!user,
    login,
    logout,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};