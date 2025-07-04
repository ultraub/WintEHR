/**
 * Auth Context Provider
 * Real authentication context for the EMR system
 */
import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

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

  // Check for existing session on mount
  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      try {
        // Try to get user info from the FHIR auth endpoint
        try {
          const response = await api.get('/api/fhir/auth/userinfo');
          setUser(response.data);
        } catch (fhirAuthError) {
          // FHIR auth endpoint not available, try legacy auth/me
          const response = await api.get('/api/auth/me');
          setUser(response.data);
        }
      } catch (error) {
        // If FHIR auth endpoint fails, check if we have cached user data
        const cachedUser = localStorage.getItem('auth_user');
        if (cachedUser) {
          try {
            setUser(JSON.parse(cachedUser));
          } catch (e) {
            console.error('Invalid cached user data:', e);
            localStorage.removeItem('auth_token');
            localStorage.removeItem('auth_user');
          }
        } else {
          console.error('Session check failed:', error);
          localStorage.removeItem('auth_token');
        }
      }
    }
    setLoading(false);
  };

  const login = async (providerId) => {
    setLoading(true);
    try {
      const response = await api.post('/api/auth/login', {
        provider_id: providerId
      });
      
      const { session_token, provider } = response.data;
      
      // Store token and user data
      localStorage.setItem('auth_token', session_token);
      localStorage.setItem('auth_user', JSON.stringify(provider));
      
      // Set user data
      setUser(provider);
      
      return provider;
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
      console.error('Logout error:', error);
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