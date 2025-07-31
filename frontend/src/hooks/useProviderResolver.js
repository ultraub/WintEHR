/**
 * Provider Resolver Hook
 * Provides provider resolution and management capabilities for imaging workflows
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { providerResolverService } from '../services/providerResolverService';

export const useProviderResolver = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [providers, setProviders] = useState(new Map());
  const [radiologists, setRadiologists] = useState([]);
  const [technologists, setTechnologists] = useState([]);
  const [providerStats, setProviderStats] = useState(null);

  // Cache for resolved providers
  const resolvedProvidersRef = useRef(new Map());

  /**
   * Resolve a single provider by reference
   * @param {string} reference - FHIR reference (e.g., "Practitioner/123")
   * @returns {Promise<Object>} Resolved provider information
   */
  const resolveProvider = useCallback(async (reference) => {
    if (!reference) return null;

    const providerId = reference.split('/').pop();
    
    // Check if already resolved
    if (resolvedProvidersRef.current.has(providerId)) {
      return resolvedProvidersRef.current.get(providerId);
    }

    setLoading(true);
    setError(null);

    try {
      const provider = await providerResolverService.resolveProvider(reference);
      
      // Cache the resolved provider
      resolvedProvidersRef.current.set(providerId, provider);
      setProviders(prev => new Map(prev.set(providerId, provider)));

      return provider;

    } catch (err) {
      setError(err.message);
      console.error('Failed to resolve provider:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Resolve multiple providers in parallel
   * @param {Array<string>} references - Array of FHIR references
   * @returns {Promise<Array>} Array of resolved providers
   */
  const resolveProviders = useCallback(async (references) => {
    if (!references?.length) return [];

    const uniqueReferences = [...new Set(references)];
    const resolvePromises = uniqueReferences.map(ref => resolveProvider(ref));
    
    try {
      const resolved = await Promise.allSettled(resolvePromises);
      return resolved
        .filter(result => result.status === 'fulfilled' && result.value)
        .map(result => result.value);
    } catch (err) {
      console.error('Failed to resolve multiple providers:', err);
      return [];
    }
  }, [resolveProvider]);

  /**
   * Get available radiologists for a specific specialty
   * @param {string} specialty - Radiology subspecialty
   * @param {string} organizationId - Optional organization filter
   * @returns {Promise<Array>} Available radiologists
   */
  const getAvailableRadiologists = useCallback(async (specialty = null, organizationId = null) => {
    setLoading(true);
    setError(null);

    try {
      const radiologistList = await providerResolverService.findAvailableRadiologists(
        specialty, 
        organizationId
      );
      
      setRadiologists(radiologistList);
      return radiologistList;

    } catch (err) {
      setError(err.message);
      console.error('Failed to get radiologists:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Assign optimal radiologist for a study
   * @param {Object} study - ImagingStudy resource
   * @returns {Promise<Object>} Assigned radiologist
   */
  const assignRadiologist = useCallback(async (study) => {
    setLoading(true);
    setError(null);

    try {
      const assignedRadiologist = await providerResolverService.assignRadiologist(study);
      
      if (assignedRadiologist) {
        // Cache the assigned radiologist
        resolvedProvidersRef.current.set(assignedRadiologist.id, assignedRadiologist);
        setProviders(prev => new Map(prev.set(assignedRadiologist.id, assignedRadiologist)));
      }

      return assignedRadiologist;

    } catch (err) {
      setError(err.message);
      console.error('Failed to assign radiologist:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Get technologists for specific modality
   * @param {string} modality - Imaging modality
   * @param {string} organizationId - Optional organization filter
   * @returns {Promise<Array>} Available technologists
   */
  const getTechnologistsForModality = useCallback(async (modality, organizationId = null) => {
    setLoading(true);
    setError(null);

    try {
      const technologistList = await providerResolverService.getTechnologistsForModality(
        modality, 
        organizationId
      );
      
      setTechnologists(technologistList);
      return technologistList;

    } catch (err) {
      setError(err.message);
      console.error('Failed to get technologists:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Get imaging department statistics
   * @param {string} organizationId - Organization ID
   * @returns {Promise<Object>} Provider statistics
   */
  const getImagingStats = useCallback(async (organizationId) => {
    setLoading(true);
    setError(null);

    try {
      const stats = await providerResolverService.getImagingProviderStats(organizationId);
      setProviderStats(stats);
      return stats;

    } catch (err) {
      setError(err.message);
      console.error('Failed to get imaging stats:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Extract providers from imaging study
   * @param {Object} study - ImagingStudy resource
   * @returns {Promise<Object>} Study performers information
   */
  const extractStudyPerformers = useCallback(async (study) => {
    if (!study?.series?.length) return { performers: [], assignedRadiologist: null };

    // Extract performer references from study series
    const performerRefs = study.series
      .flatMap(series => series.performer || [])
      .map(performer => performer.actor?.reference)
      .filter(Boolean);

    // Resolve all performers
    const performers = await resolveProviders(performerRefs);

    // Assign radiologist if not already assigned
    let assignedRadiologist = performers.find(p => p.isRadiologist);
    if (!assignedRadiologist) {
      assignedRadiologist = await assignRadiologist(study);
    }

    return {
      performers: performers.filter(p => p.isTechnologist),
      assignedRadiologist,
      allPerformers: performers
    };
  }, [resolveProviders, assignRadiologist]);

  /**
   * Format provider name with credentials
   * @param {Object} provider - Provider object
   * @param {boolean} includeCredentials - Include credentials in display
   * @returns {string} Formatted provider name
   */
  const formatProviderDisplay = useCallback((provider, includeCredentials = false) => {
    if (!provider) return 'Unknown Provider';

    let display = provider.displayName || 'Unknown Provider';
    
    if (includeCredentials && provider.credentials?.length > 0) {
      const primaryCredential = provider.credentials[0];
      display += `, ${primaryCredential}`;
    }

    return display;
  }, []);

  /**
   * Get provider specialties for display
   * @param {Object} provider - Provider object
   * @returns {Array} Array of specialty strings
   */
  const getProviderSpecialties = useCallback((provider) => {
    if (!provider) return [];
    
    return provider.imagingSpecialties?.length > 0 
      ? provider.imagingSpecialties 
      : provider.specialties || [];
  }, []);

  /**
   * Check if provider is available
   * @param {Object} provider - Provider object
   * @returns {boolean} Provider availability status
   */
  const isProviderAvailable = useCallback((provider) => {
    return provider?.availability?.isAvailable ?? true; // Default to available if unknown
  }, []);

  /**
   * Get provider workload information
   * @param {Object} provider - Provider object
   * @returns {Object} Workload information
   */
  const getProviderWorkload = useCallback((provider) => {
    return {
      currentStudies: provider?.currentWorkload || 0,
      availability: provider?.availability || null,
      isOverloaded: (provider?.currentWorkload || 0) > 10
    };
  }, []);

  /**
   * Filter providers by criteria
   * @param {Array} providerList - List of providers
   * @param {Object} criteria - Filter criteria
   * @returns {Array} Filtered providers
   */
  const filterProviders = useCallback((providerList, criteria) => {
    return providerList.filter(provider => {
      // Filter by specialty
      if (criteria.specialty) {
        const hasSpecialty = provider.imagingSpecialties?.includes(criteria.specialty) ||
                            provider.specialties?.includes(criteria.specialty);
        if (!hasSpecialty) return false;
      }

      // Filter by availability
      if (criteria.availableOnly && !isProviderAvailable(provider)) {
        return false;
      }

      // Filter by organization
      if (criteria.organizationId) {
        const hasOrganization = provider.organizations?.some(org => 
          org.id === criteria.organizationId
        );
        if (!hasOrganization) return false;
      }

      // Filter by role type
      if (criteria.roleType === 'radiologist' && !provider.isRadiologist) {
        return false;
      }
      if (criteria.roleType === 'technologist' && !provider.isTechnologist) {
        return false;
      }

      return true;
    });
  }, [isProviderAvailable]);

  /**
   * Clear cached providers
   */
  const clearProviderCache = useCallback(() => {
    resolvedProvidersRef.current.clear();
    setProviders(new Map());
    providerResolverService.clearCache();
  }, []);

  /**
   * Refresh provider data
   */
  const refreshProviders = useCallback(async () => {
    clearProviderCache();
    // Optionally reload current data
    if (radiologists.length > 0) {
      await getAvailableRadiologists();
    }
  }, [clearProviderCache, radiologists.length, getAvailableRadiologists]);

  return {
    // State
    loading,
    error,
    providers: Array.from(providers.values()),
    radiologists,
    technologists,
    providerStats,

    // Core resolution methods
    resolveProvider,
    resolveProviders,
    extractStudyPerformers,

    // Specialized provider methods
    getAvailableRadiologists,
    assignRadiologist,
    getTechnologistsForModality,
    getImagingStats,

    // Utility methods
    formatProviderDisplay,
    getProviderSpecialties,
    isProviderAvailable,
    getProviderWorkload,
    filterProviders,

    // Management methods
    clearProviderCache,
    refreshProviders,

    // Error handling
    setError: (error) => setError(error),
    clearError: () => setError(null)
  };
};

export default useProviderResolver;