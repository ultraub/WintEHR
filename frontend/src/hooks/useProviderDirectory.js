/**
 * Provider Directory Hook
 * 
 * Custom React hook for provider directory operations including provider search,
 * geographic search, and organizational hierarchy management.
 */

import { useState, useCallback } from 'react';
import { apiClient } from '../services/api';
import { useProviderDirectoryContext } from '../contexts/ProviderDirectoryContext';

export const useProviderDirectory = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  
  // Get shared data from context to prevent duplicate API calls
  const {
    specialties: availableSpecialties,
    organizations: availableOrganizations,
    loadSpecialties: contextLoadSpecialties,
    loadOrganizations: contextLoadOrganizations
  } = useProviderDirectoryContext();

  // ============================================================================
  // Provider Search Operations
  // ============================================================================

  const searchProviders = useCallback(async (searchParams = {}) => {
    setLoading(true);
    setError(null);
    try {
      const {
        specialty,
        locationId,
        organizationId,
        name,
        activeOnly = true
      } = searchParams;

      const params = new URLSearchParams();
      if (specialty) params.append('specialty', specialty);
      if (locationId) params.append('location_id', locationId);
      if (organizationId) params.append('organization_id', organizationId);
      if (name) params.append('name', name);
      params.append('active_only', activeOnly.toString());

      const response = await apiClient.get(`/provider-directory/providers/search?${params}`);
      setSearchResults(response.providers || []);
      return response;
    } catch (err) {
      setError(`Failed to search providers: ${err.message}`);
      setSearchResults([]);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const searchProvidersBySpecialty = useCallback(async (specialtyCode, locationId = null) => {
    return searchProviders({ specialty: specialtyCode, locationId });
  }, [searchProviders]);

  const searchProvidersByOrganization = useCallback(async (organizationId) => {
    return searchProviders({ organizationId });
  }, [searchProviders]);

  const searchProvidersByName = useCallback(async (name) => {
    return searchProviders({ name });
  }, [searchProviders]);

  // ============================================================================
  // Provider Profile Operations
  // ============================================================================

  const getProviderProfile = useCallback(async (practitionerId) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get(`/provider-directory/providers/${practitionerId}/profile`);
      return response;
    } catch (err) {
      setError(`Failed to get provider profile: ${err.message}`);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getProviderRoles = useCallback(async (practitionerId) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get(`/provider-directory/providers/${practitionerId}/roles`);
      return response.roles || [];
    } catch (err) {
      setError(`Failed to get provider roles: ${err.message}`);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getProviderSpecialties = useCallback(async (practitionerId) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get(`/provider-directory/providers/${practitionerId}/specialties`);
      return response.specialties || [];
    } catch (err) {
      setError(`Failed to get provider specialties: ${err.message}`);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getProviderLocations = useCallback(async (practitionerId) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get(`/provider-directory/providers/${practitionerId}/locations`);
      return response.locations || [];
    } catch (err) {
      setError(`Failed to get provider locations: ${err.message}`);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // ============================================================================
  // Geographic Search Operations
  // ============================================================================

  const searchProvidersNearLocation = useCallback(async (coordinates, options = {}) => {
    setLoading(true);
    setError(null);
    try {
      const {
        distance = 50,
        specialtyCode = null
      } = options;

      const params = new URLSearchParams({
        latitude: coordinates.latitude.toString(),
        longitude: coordinates.longitude.toString(),
        distance_km: distance.toString()
      });

      if (specialtyCode) {
        params.append('specialty_code', specialtyCode);
      }

      const response = await apiClient.get(`/provider-directory/providers/near?${params}`);
      return response;
    } catch (err) {
      setError(`Failed to search providers near location: ${err.message}`);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const searchLocationsNear = useCallback(async (coordinates, options = {}) => {
    setLoading(true);
    setError(null);
    try {
      const {
        distance = 50,
        locationType = null
      } = options;

      const params = new URLSearchParams({
        latitude: coordinates.latitude.toString(),
        longitude: coordinates.longitude.toString(),
        distance_km: distance.toString()
      });

      if (locationType) {
        params.append('location_type', locationType);
      }

      const response = await apiClient.get(`/provider-directory/locations/near?${params}`);
      return response;
    } catch (err) {
      setError(`Failed to search locations near coordinates: ${err.message}`);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // ============================================================================
  // Organization and Location Hierarchy Operations
  // ============================================================================

  const getOrganizationHierarchy = useCallback(async (organizationId) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get(`/provider-directory/organizations/${organizationId}/hierarchy`);
      return response.hierarchy;
    } catch (err) {
      setError(`Failed to get organization hierarchy: ${err.message}`);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getOrganizationProviders = useCallback(async (organizationId, activeOnly = true) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        active_only: activeOnly.toString()
      });

      const response = await apiClient.get(`/provider-directory/organizations/${organizationId}/providers?${params}`);
      return response.providers || [];
    } catch (err) {
      setError(`Failed to get organization providers: ${err.message}`);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getLocationHierarchy = useCallback(async (locationId) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get(`/provider-directory/locations/${locationId}/hierarchy`);
      return response;
    } catch (err) {
      setError(`Failed to get location hierarchy: ${err.message}`);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getLocationProviders = useCallback(async (locationId, activeOnly = true) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        active_only: activeOnly.toString()
      });

      const response = await apiClient.get(`/provider-directory/locations/${locationId}/providers?${params}`);
      return response.providers || [];
    } catch (err) {
      setError(`Failed to get location providers: ${err.message}`);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // ============================================================================
  // Directory Utility Operations
  // ============================================================================

  // Use context methods to prevent duplicate API calls
  const loadAvailableSpecialties = useCallback(async (forceRefresh = false) => {
    return contextLoadSpecialties(forceRefresh);
  }, [contextLoadSpecialties]);

  const loadAvailableOrganizations = useCallback(async (activeOnly = true, forceRefresh = false) => {
    return contextLoadOrganizations(activeOnly, forceRefresh);
  }, [contextLoadOrganizations]);

  // ============================================================================
  // Utility Functions
  // ============================================================================

  const getProviderDisplayName = useCallback((practitioner) => {
    if (!practitioner) return 'Unknown Provider';

    const name = practitioner.name?.[0];
    if (!name) return practitioner.id || 'Unknown Provider';

    const given = name.given?.join(' ') || '';
    const family = name.family || '';
    return `${given} ${family}`.trim() || practitioner.id || 'Unknown Provider';
  }, []);

  const getSpecialtyDisplay = useCallback((specialty) => {
    if (!specialty) return 'Unknown Specialty';

    const coding = specialty.coding?.[0];
    return coding?.display || specialty.text || coding?.code || 'Unknown Specialty';
  }, []);

  const getLocationDisplay = useCallback((location) => {
    if (!location) return 'Unknown Location';

    return location.name || location.description || location.id || 'Unknown Location';
  }, []);

  const getOrganizationDisplay = useCallback((organization) => {
    if (!organization) return 'Unknown Organization';

    return organization.name || organization.id || 'Unknown Organization';
  }, []);

  const formatDistance = useCallback((distanceKm) => {
    if (typeof distanceKm !== 'number') return '';

    if (distanceKm < 1) {
      return `${Math.round(distanceKm * 1000)}m`;
    } else {
      return `${distanceKm.toFixed(1)}km`;
    }
  }, []);

  const clearSearch = useCallback(() => {
    setSearchResults([]);
    setError(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Remove automatic loading on hook initialization to prevent redundant API calls
  // Components should explicitly call these functions when needed
  // useEffect(() => {
  //   loadAvailableSpecialties();
  //   loadAvailableOrganizations();
  // }, [loadAvailableSpecialties, loadAvailableOrganizations]);

  return {
    // State
    loading,
    error,
    searchResults,
    availableSpecialties,
    availableOrganizations,

    // Provider Search Operations
    searchProviders,
    searchProvidersBySpecialty,
    searchProvidersByOrganization,
    searchProvidersByName,

    // Provider Profile Operations
    getProviderProfile,
    getProviderRoles,
    getProviderSpecialties,
    getProviderLocations,

    // Geographic Search Operations
    searchProvidersNearLocation,
    searchLocationsNear,

    // Organization and Location Hierarchy Operations
    getOrganizationHierarchy,
    getOrganizationProviders,
    getLocationHierarchy,
    getLocationProviders,

    // Directory Utility Operations
    loadAvailableSpecialties,
    loadAvailableOrganizations,

    // Utility Functions
    getProviderDisplayName,
    getSpecialtyDisplay,
    getLocationDisplay,
    getOrganizationDisplay,
    formatDistance,
    clearSearch,
    clearError
  };
};

// ============================================================================
// Provider Directory Context Hook
// ============================================================================

export const useProviderContext = () => {
  const [currentProvider, setCurrentProvider] = useState(null);
  const [selectedFacility, setSelectedFacility] = useState(null);
  const [providerHistory, setProviderHistory] = useState([]);

  const switchProvider = useCallback((provider) => {
    if (currentProvider) {
      setProviderHistory(prev => [currentProvider, ...prev.slice(0, 4)]); // Keep last 5
    }
    setCurrentProvider(provider);
  }, [currentProvider]);

  const switchFacility = useCallback((facility) => {
    setSelectedFacility(facility);
  }, []);

  const clearProviderContext = useCallback(() => {
    setCurrentProvider(null);
    setSelectedFacility(null);
    setProviderHistory([]);
  }, []);

  const goToPreviousProvider = useCallback(() => {
    if (providerHistory.length > 0) {
      const previousProvider = providerHistory[0];
      setCurrentProvider(previousProvider);
      setProviderHistory(prev => prev.slice(1));
    }
  }, [providerHistory]);

  return {
    currentProvider,
    selectedFacility,
    providerHistory,
    switchProvider,
    switchFacility,
    clearProviderContext,
    goToPreviousProvider,
    hasPreviousProvider: providerHistory.length > 0
  };
};

export default useProviderDirectory;