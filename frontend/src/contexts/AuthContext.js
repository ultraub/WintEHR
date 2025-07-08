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
      // For now, just use cached user data since auth endpoints are not implemented
      // TODO: Implement proper FHIR auth endpoints
      const cachedUser = localStorage.getItem('auth_user');
      if (cachedUser) {
        try {
          setUser(JSON.parse(cachedUser));
        } catch (e) {
          
          localStorage.removeItem('auth_token');
          localStorage.removeItem('auth_user');
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
      
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.post('/api/auth/logout');
    } catch (error) {
      
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