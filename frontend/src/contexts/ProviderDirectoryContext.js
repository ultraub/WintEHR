/**
 * Provider Directory Context
 * 
 * Centralized context for managing provider directory data to prevent duplicate API calls.
 * Provides caching and shared state for specialties, organizations, and provider data.
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { apiClient } from '../services/api';

const ProviderDirectoryContext = createContext();

// Cache TTL in milliseconds (5 minutes)
const CACHE_TTL = 5 * 60 * 1000;

export const ProviderDirectoryProvider = ({ children }) => {
  // Shared state
  const [specialties, setSpecialties] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState({
    specialties: false,
    organizations: false
  });
  const [error, setError] = useState({
    specialties: null,
    organizations: null
  });

  // Cache timestamps
  const cacheTimestamps = useRef({
    specialties: null,
    organizations: null
  });

  // Check if cache is valid
  const isCacheValid = useCallback((cacheType) => {
    const timestamp = cacheTimestamps.current[cacheType];
    if (!timestamp) return false;
    return Date.now() - timestamp < CACHE_TTL;
  }, []);

  // Load specialties with caching
  const loadSpecialties = useCallback(async (forceRefresh = false) => {
    // Return cached data if valid and not forcing refresh
    if (!forceRefresh && specialties.length > 0 && isCacheValid('specialties')) {
      return specialties;
    }

    // Prevent duplicate requests
    if (loading.specialties) {
      return specialties;
    }

    setLoading(prev => ({ ...prev, specialties: true }));
    setError(prev => ({ ...prev, specialties: null }));

    try {
      const response = await apiClient.get('/api/provider-directory/specialties');
      const data = response.specialties || [];
      setSpecialties(data);
      cacheTimestamps.current.specialties = Date.now();
      return data;
    } catch (err) {
      const errorMsg = `Failed to load specialties: ${err.message}`;
      setError(prev => ({ ...prev, specialties: errorMsg }));
      return [];
    } finally {
      setLoading(prev => ({ ...prev, specialties: false }));
    }
  }, [specialties, loading.specialties, isCacheValid]);

  // Load organizations with caching
  const loadOrganizations = useCallback(async (activeOnly = true, forceRefresh = false) => {
    // Return cached data if valid and not forcing refresh
    if (!forceRefresh && organizations.length > 0 && isCacheValid('organizations')) {
      return organizations;
    }

    // Prevent duplicate requests
    if (loading.organizations) {
      return organizations;
    }

    setLoading(prev => ({ ...prev, organizations: true }));
    setError(prev => ({ ...prev, organizations: null }));

    try {
      const params = new URLSearchParams({
        active_only: activeOnly.toString()
      });

      const response = await apiClient.get(`/api/provider-directory/organizations?${params}`);
      const data = response.organizations || [];
      setOrganizations(data);
      cacheTimestamps.current.organizations = Date.now();
      return data;
    } catch (err) {
      const errorMsg = `Failed to load organizations: ${err.message}`;
      setError(prev => ({ ...prev, organizations: errorMsg }));
      return [];
    } finally {
      setLoading(prev => ({ ...prev, organizations: false }));
    }
  }, [organizations, loading.organizations, isCacheValid]);

  // Clear cache
  const clearCache = useCallback(() => {
    setSpecialties([]);
    setOrganizations([]);
    cacheTimestamps.current = {
      specialties: null,
      organizations: null
    };
  }, []);

  // Preload data on mount (single load for entire app)
  useEffect(() => {
    loadSpecialties();
    loadOrganizations();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Missing deps: loadSpecialties, loadOrganizations. These functions don't change
  // and we only want to load once on mount

  const value = {
    // Data
    specialties,
    organizations,
    
    // Loading states
    loadingSpecialties: loading.specialties,
    loadingOrganizations: loading.organizations,
    
    // Error states
    specialtiesError: error.specialties,
    organizationsError: error.organizations,
    
    // Actions
    loadSpecialties,
    loadOrganizations,
    clearCache,
    
    // Cache info
    isCacheValid
  };

  return (
    <ProviderDirectoryContext.Provider value={value}>
      {children}
    </ProviderDirectoryContext.Provider>
  );
};

// Hook to use the provider directory context
export const useProviderDirectoryContext = () => {
  const context = useContext(ProviderDirectoryContext);
  if (!context) {
    throw new Error('useProviderDirectoryContext must be used within a ProviderDirectoryProvider');
  }
  return context;
};

export default ProviderDirectoryContext;