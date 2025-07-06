/**
 * Provider Service
 * Centralized service for resolving and managing provider information from FHIR resources
 */

import { fhirClient } from './fhirClient';

class ProviderService {
  constructor() {
    this.providerCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Resolve provider information from an encounter
   */
  async resolveProviderFromEncounter(encounter) {
    try {
      // Method 1: Check encounter participant for practitioner
      if (encounter.participant && encounter.participant.length > 0) {
        for (const participant of encounter.participant) {
          if (participant.individual && participant.individual.reference) {
            const providerRef = participant.individual.reference;
            if (providerRef.startsWith('Practitioner/')) {
              const providerId = providerRef.split('/').pop();
              return await this.getProviderById(providerId);
            }
          }
          
          // Check if display name is available directly
          if (participant.individual && participant.individual.display) {
            return {
              id: null,
              name: participant.individual.display,
              display: participant.individual.display
            };
          }
        }
      }

      // Method 2: Check encounter serviceProvider
      if (encounter.serviceProvider && encounter.serviceProvider.reference) {
        const orgRef = encounter.serviceProvider.reference;
        if (orgRef.startsWith('Organization/')) {
          const orgId = orgRef.split('/').pop();
          const org = await this.getOrganizationById(orgId);
          if (org) {
            return {
              id: orgId,
              name: org.name || 'Unknown Organization',
              display: org.name || 'Unknown Organization',
              type: 'organization'
            };
          }
        }
      }

      // Method 3: Check for practitioner in encounter extensions
      if (encounter.extension) {
        for (const ext of encounter.extension) {
          if (ext.valueReference && ext.valueReference.reference) {
            const ref = ext.valueReference.reference;
            if (ref.startsWith('Practitioner/')) {
              const providerId = ref.split('/').pop();
              return await this.getProviderById(providerId);
            }
          }
        }
      }

      return null;
    } catch (error) {
      console.error('Error resolving provider from encounter:', error);
      return null;
    }
  }

  /**
   * Get provider by ID with caching
   */
  async getProviderById(providerId) {
    try {
      // Check cache first
      const cacheKey = `provider_${providerId}`;
      const cached = this.providerCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
        return cached.data;
      }

      // Fetch from FHIR server
      const practitioner = await fhirClient.read('Practitioner', providerId);
      
      const providerInfo = this.transformPractitioner(practitioner);
      
      // Cache the result
      this.providerCache.set(cacheKey, {
        data: providerInfo,
        timestamp: Date.now()
      });

      return providerInfo;
    } catch (error) {
      console.error('Error fetching provider:', providerId, error);
      return null;
    }
  }

  /**
   * Get organization by ID
   */
  async getOrganizationById(orgId) {
    try {
      const cacheKey = `org_${orgId}`;
      const cached = this.providerCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
        return cached.data;
      }

      const organization = await fhirClient.read('Organization', orgId);
      
      // Cache the result
      this.providerCache.set(cacheKey, {
        data: organization,
        timestamp: Date.now()
      });

      return organization;
    } catch (error) {
      console.error('Error fetching organization:', orgId, error);
      return null;
    }
  }

  /**
   * Transform FHIR Practitioner resource to simplified format
   */
  transformPractitioner(practitioner) {
    if (!practitioner) return null;

    const name = practitioner.name?.[0] || {};
    const firstName = name.given?.join(' ') || '';
    const lastName = name.family || '';
    const prefix = name.prefix?.join(' ') || '';
    const suffix = name.suffix?.join(' ') || '';
    
    let displayName = '';
    if (prefix) displayName += `${prefix} `;
    displayName += `${firstName} ${lastName}`.trim();
    if (suffix) displayName += `, ${suffix}`;
    
    // Extract specialty from qualification
    let specialty = '';
    if (practitioner.qualification && practitioner.qualification.length > 0) {
      const qual = practitioner.qualification[0];
      specialty = qual.code?.text || qual.code?.coding?.[0]?.display || '';
    }

    // Extract NPI from identifier
    let npi = '';
    if (practitioner.identifier) {
      const npiIdentifier = practitioner.identifier.find(id => 
        id.system === 'http://hl7.org/fhir/sid/us-npi' ||
        id.type?.coding?.[0]?.code === 'NPI'
      );
      npi = npiIdentifier?.value || '';
    }

    return {
      id: practitioner.id,
      name: displayName.trim() || 'Unknown Provider',
      display: displayName.trim() || 'Unknown Provider',
      firstName,
      lastName,
      prefix,
      suffix,
      specialty,
      npi,
      active: practitioner.active !== false
    };
  }

  /**
   * Search for providers
   */
  async searchProviders(searchTerm, limit = 10) {
    try {
      const result = await fhirClient.search('Practitioner', {
        name: searchTerm,
        _count: limit,
        active: 'true'
      });

      return result.resources.map(practitioner => this.transformPractitioner(practitioner));
    } catch (error) {
      console.error('Error searching providers:', error);
      return [];
    }
  }

  /**
   * Get all active providers
   */
  async getAllProviders(limit = 50) {
    try {
      const result = await fhirClient.search('Practitioner', {
        _count: limit,
        active: 'true',
        _sort: 'family'
      });

      return result.resources.map(practitioner => this.transformPractitioner(practitioner));
    } catch (error) {
      console.error('Error fetching all providers:', error);
      return [];
    }
  }

  /**
   * Clear provider cache
   */
  clearCache() {
    this.providerCache.clear();
  }

  /**
   * Get provider display name with fallback
   */
  getProviderDisplayName(provider) {
    if (!provider) return 'Unknown Provider';
    
    if (typeof provider === 'string') return provider;
    
    return provider.display || provider.name || 'Unknown Provider';
  }
}

// Export singleton instance
export const providerService = new ProviderService();

// Also export class for custom instances
export default ProviderService;