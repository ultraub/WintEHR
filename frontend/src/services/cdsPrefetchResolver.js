/**
 * CDS Prefetch Resolver Service
 * Handles prefetch template resolution for CDS Hooks optimization
 */
import { fhirClient } from '../core/fhir/services/fhirClient';
import { cdsLogger } from '../config/logging';

class CDSPrefetchResolver {
  /**
   * Resolve prefetch templates for a CDS service
   * @param {Object} service - CDS service definition
   * @param {Object} context - Hook context
   * @returns {Promise<Object>} Resolved prefetch data
   */
  async resolvePrefetchTemplates(service, context) {
    if (!service.prefetch || Object.keys(service.prefetch).length === 0) {
      return null;
    }

    const resolved = {};
    const errors = [];

    for (const [key, template] of Object.entries(service.prefetch)) {
      try {
        const data = await this.resolveTemplate(template, context);
        if (data) {
          resolved[key] = data;
        }
      } catch (error) {
        cdsLogger.warn(`Failed to resolve prefetch template ${key}`, {
          template,
          error: error.message
        });
        errors.push({ key, template, error: error.message });
      }
    }

    // Log resolution results
    cdsLogger.info('Prefetch resolution completed', {
      serviceId: service.id,
      resolved: Object.keys(resolved).length,
      failed: errors.length,
      totalTemplates: Object.keys(service.prefetch).length
    });

    return Object.keys(resolved).length > 0 ? resolved : null;
  }

  /**
   * Resolve a single prefetch template
   * @param {string} template - FHIR query template
   * @param {Object} context - Hook context
   * @returns {Promise<Object>} FHIR resource or bundle
   */
  async resolveTemplate(template, context) {
    // Replace template variables with context values
    const resolvedUrl = this.replaceTemplateVariables(template, context);
    
    if (!resolvedUrl) {
      throw new Error('Unable to resolve template variables');
    }

    // Parse the URL to extract resource type and parameters
    const { resourceType, params } = this.parseQueryUrl(resolvedUrl);

    // Execute the FHIR query
    if (resourceType) {
      const result = await fhirClient.search(resourceType, params);
      
      // Return appropriate format based on query
      if (resolvedUrl.includes('_id=')) {
        // Single resource query - return the resource directly
        return result.resources?.[0] || null;
      } else {
        // Search query - return the bundle
        return result.bundle || { resourceType: 'Bundle', entry: [] };
      }
    }

    throw new Error('Invalid query template');
  }

  /**
   * Replace template variables with context values
   * @param {string} template - Template string
   * @param {Object} context - Context object
   * @returns {string} Resolved URL
   */
  replaceTemplateVariables(template, context) {
    let resolved = template;

    // Common template patterns
    const replacements = {
      '{{context.patientId}}': context.patientId,
      '{{context.userId}}': context.userId,
      '{{context.encounterId}}': context.encounterId,
      '{{patientId}}': context.patientId,
      '{{userId}}': context.userId,
      '{{encounterId}}': context.encounterId
    };

    for (const [pattern, value] of Object.entries(replacements)) {
      if (value && resolved.includes(pattern)) {
        resolved = resolved.replace(new RegExp(pattern, 'g'), value);
      }
    }

    // Check if all variables were resolved
    if (resolved.includes('{{') && resolved.includes('}}')) {
      cdsLogger.warn('Unresolved template variables', { template, resolved });
      return null;
    }

    return resolved;
  }

  /**
   * Parse FHIR query URL to extract resource type and parameters
   * @param {string} url - FHIR query URL
   * @returns {Object} Parsed components
   */
  parseQueryUrl(url) {
    try {
      // Remove leading slash if present
      const cleanUrl = url.startsWith('/') ? url.substring(1) : url;
      
      // Split by ? to get resource and params
      const [resourcePath, queryString] = cleanUrl.split('?');
      
      // Extract resource type (handle paths like Patient/123 or just Patient)
      const pathParts = resourcePath.split('/');
      const resourceType = pathParts[0];
      
      // Parse query parameters
      const params = {};
      if (queryString) {
        const searchParams = new URLSearchParams(queryString);
        for (const [key, value] of searchParams.entries()) {
          params[key] = value;
        }
      }

      // Handle direct resource queries (e.g., Patient/123)
      if (pathParts.length === 2 && pathParts[1]) {
        params._id = pathParts[1];
      }

      return { resourceType, params };
    } catch (error) {
      cdsLogger.error('Failed to parse query URL', { url, error: error.message });
      return { resourceType: null, params: {} };
    }
  }

  /**
   * Build prefetch for common scenarios
   * @param {string} hookType - Type of CDS hook
   * @param {Object} context - Hook context
   * @returns {Promise<Object>} Common prefetch data
   */
  async buildCommonPrefetch(hookType, context) {
    const commonQueries = {
      'patient-view': {
        patient: `Patient/{{patientId}}`,
        conditions: `Condition?patient={{patientId}}&clinical-status=active`,
        medications: `MedicationRequest?patient={{patientId}}&status=active`,
        allergies: `AllergyIntolerance?patient={{patientId}}`,
        recentLabs: `Observation?patient={{patientId}}&category=laboratory&_sort=-date&_count=10`
      },
      'medication-prescribe': {
        patient: `Patient/{{patientId}}`,
        activeMedications: `MedicationRequest?patient={{patientId}}&status=active`,
        allergies: `AllergyIntolerance?patient={{patientId}}`,
        recentLabs: `Observation?patient={{patientId}}&category=laboratory&_sort=-date&_count=5`
      },
      'order-sign': {
        patient: `Patient/{{patientId}}`,
        encounter: `Encounter/{{encounterId}}`,
        recentOrders: `ServiceRequest?patient={{patientId}}&_sort=-authored&_count=10`
      }
    };

    const templates = commonQueries[hookType];
    if (!templates) {
      return null;
    }

    const prefetch = {};
    for (const [key, template] of Object.entries(templates)) {
      try {
        const data = await this.resolveTemplate(template, context);
        if (data) {
          prefetch[key] = data;
        }
      } catch (error) {
        // Skip failed prefetch items
        cdsLogger.debug(`Skipping prefetch item ${key}`, error.message);
      }
    }

    return Object.keys(prefetch).length > 0 ? prefetch : null;
  }

  /**
   * Cache prefetch data for reuse
   * @param {string} cacheKey - Cache key
   * @param {Object} data - Prefetch data
   * @param {number} ttl - Time to live in milliseconds
   */
  cachePrefetchData(cacheKey, data, ttl = 30000) {
    // Simple in-memory cache - could be enhanced with localStorage
    if (!this.cache) {
      this.cache = new Map();
    }

    this.cache.set(cacheKey, {
      data,
      expires: Date.now() + ttl
    });

    // Clean expired entries
    for (const [key, value] of this.cache.entries()) {
      if (value.expires < Date.now()) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cached prefetch data
   * @param {string} cacheKey - Cache key
   * @returns {Object|null} Cached data or null
   */
  getCachedPrefetchData(cacheKey) {
    if (!this.cache) {
      return null;
    }

    const cached = this.cache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }

    // Remove expired entry
    if (cached) {
      this.cache.delete(cacheKey);
    }

    return null;
  }
}

// Export singleton instance
export const cdsPrefetchResolver = new CDSPrefetchResolver();

// Also export class for testing
export default CDSPrefetchResolver;