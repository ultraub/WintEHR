/**
 * Search Service
 * Centralized search functionality with caching, indexing, and multiple search backends
 * Integrates with dynamic clinical catalogs for enhanced search experience
 */
import { fhirClient } from './fhirClient';
import { cdsClinicalDataService } from './cdsClinicalDataService';

// Search backends
const SEARCH_BACKENDS = {
  FHIR: 'fhir',
  CATALOG: 'catalog',
  HYBRID: 'hybrid',
  ELASTICSEARCH: 'elasticsearch', 
  LOCAL_INDEX: 'local'
};

class SearchService {
  constructor() {
    this.backend = SEARCH_BACKENDS.FHIR; // Default to FHIR search
    this.localIndex = new Map(); // Local search index
    this.searchMetrics = {
      totalSearches: 0,
      cacheHits: 0,
      errorCount: 0,
      avgResponseTime: 0
    };
  }

  // Main search function
  async search(query, options = {}) {
    const startTime = Date.now();
    
    try {
      this.searchMetrics.totalSearches++;
      
      let results = [];
      
      // Route to appropriate backend
      switch (this.backend) {
        case SEARCH_BACKENDS.FHIR:
          results = await this.searchFHIR(query, options);
          break;
          
        case SEARCH_BACKENDS.CATALOG:
          results = await this.searchCatalog(query, options);
          break;
          
        case SEARCH_BACKENDS.HYBRID:
          results = await this.searchHybrid(query, options);
          break;
          
        default:
          results = await this.searchFHIR(query, options);
      }

      // Update metrics
      const responseTime = Date.now() - startTime;
      this.updateMetrics(responseTime);

      return results;
      
    } catch (error) {
      this.searchMetrics.errorCount++;
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  // FHIR search implementation
  async searchFHIR(query, options = {}) {
    const {
      resourceTypes = ['Patient'],
      patientId = null,
      limit = 20,
      signal,
      ...additionalParams
    } = options;

    const allResults = [];

    for (const resourceType of resourceTypes) {
      try {
        const searchParams = this.buildFHIRSearchParams(
          resourceType, 
          query, 
          { limit, patientId, ...additionalParams }
        );

        const response = await fhirClient.search(resourceType, searchParams, { signal });
        
        // Handle both Bundle and array responses
        let resources = [];
        if (response.entry) {
          resources = response.entry.map(entry => entry.resource);
        } else if (Array.isArray(response)) {
          resources = response;
        } else if (response.resourceType) {
          resources = [response];
        }

        allResults.push(...resources);

      } catch (error) {
        if (error.name === 'AbortError') throw error;
        console.warn(`FHIR search failed for ${resourceType}:`, error);
      }
    }

    return allResults;
  }

  // Build FHIR search parameters for specific resource types
  buildFHIRSearchParams(resourceType, query, options = {}) {
    const { limit = 20, patientId } = options;

    const baseParams = { _count: limit };

    // Add patient context if provided
    if (patientId) {
      baseParams.patient = patientId;
    }

    // Resource-specific search parameters
    switch (resourceType.toLowerCase()) {
      case 'patient':
        return { ...baseParams, name: query, _sort: 'family' };

      case 'practitioner':
        return { ...baseParams, name: query, _sort: 'family' };

      case 'organization':
        return { ...baseParams, name: query, _sort: 'name' };

      case 'medication':
        return { ...baseParams, code: query };

      case 'condition':
        return { ...baseParams, code: query };

      default:
        return { ...baseParams, _text: query };
    }
  }

  // Catalog search implementation  
  async searchCatalog(query, options = {}) {
    const {
      resourceTypes = ['Medication', 'Condition'],
      limit = 20,
      category = null,
      signal
    } = options;

    const allResults = [];

    try {
      // Search dynamic catalogs based on resource types
      for (const resourceType of resourceTypes) {
        if (signal?.aborted) throw new Error('Aborted');
        
        try {
          let catalogResults = [];
          
          switch (resourceType.toLowerCase()) {
            case 'medication':
              catalogResults = await cdsClinicalDataService.getDynamicMedicationCatalog(query, limit);
              // Transform to FHIR-like structure
              catalogResults = catalogResults.map(med => ({
                resourceType: 'Medication',
                id: med.id || `med-${Math.random().toString(36).substr(2, 9)}`,
                code: {
                  text: med.display || med.name,
                  coding: med.coding ? [med.coding] : []
                },
                display: med.display || med.name,
                frequency: med.frequency || 0,
                searchScore: this.calculateSearchScore(query, med.display || med.name)
              }));
              break;

            case 'condition':
              catalogResults = await cdsClinicalDataService.getDynamicConditionCatalog(query, limit);
              // Transform to FHIR-like structure
              catalogResults = catalogResults.map(cond => ({
                resourceType: 'Condition',
                id: cond.id || `cond-${Math.random().toString(36).substr(2, 9)}`,
                code: {
                  text: cond.display || cond.name,
                  coding: cond.coding ? [cond.coding] : []
                },
                display: cond.display || cond.name,
                frequency: cond.frequency || 0,
                searchScore: this.calculateSearchScore(query, cond.display || cond.name)
              }));
              break;

            case 'observation':
              catalogResults = await cdsClinicalDataService.getLabCatalog(query, category, limit);
              // Transform to FHIR-like structure
              catalogResults = catalogResults.map(lab => ({
                resourceType: 'Observation', 
                id: lab.id || `obs-${Math.random().toString(36).substr(2, 9)}`,
                code: {
                  text: lab.display || lab.name,
                  coding: lab.coding ? [lab.coding] : []
                },
                display: lab.display || lab.name,
                referenceRange: lab.reference_range,
                category: lab.category,
                searchScore: this.calculateSearchScore(query, lab.display || lab.name)
              }));
              break;

            default:
              // For other resource types, try the general search
              const searchResults = await cdsClinicalDataService.searchAllDynamicCatalogs(query, limit);
              
              // Flatten and transform results
              Object.entries(searchResults).forEach(([type, results]) => {
                if (Array.isArray(results)) {
                  const transformedResults = results.map(item => ({
                    resourceType: type.charAt(0).toUpperCase() + type.slice(1),
                    id: item.id || `${type}-${Math.random().toString(36).substr(2, 9)}`,
                    code: {
                      text: item.display || item.name,
                      coding: item.coding ? [item.coding] : []
                    },
                    display: item.display || item.name,
                    frequency: item.frequency || 0,
                    searchScore: this.calculateSearchScore(query, item.display || item.name)
                  }));
                  catalogResults.push(...transformedResults);
                }
              });
          }

          allResults.push(...catalogResults);

        } catch (error) {
          console.warn(`Catalog search failed for ${resourceType}:`, error);
        }
      }

      // Sort by search score and frequency
      allResults.sort((a, b) => {
        const scoreA = (a.searchScore || 0) + (a.frequency || 0) * 0.1;
        const scoreB = (b.searchScore || 0) + (b.frequency || 0) * 0.1;
        return scoreB - scoreA;
      });

      return allResults.slice(0, limit);

    } catch (error) {
      if (error.message === 'Aborted') throw error;
      throw new Error(`Catalog search failed: ${error.message}`);
    }
  }

  // Hybrid search combining FHIR and catalog results
  async searchHybrid(query, options = {}) {
    const { limit = 20 } = options;
    
    try {
      // Run both searches in parallel
      const [fhirResults, catalogResults] = await Promise.allSettled([
        this.searchFHIR(query, { ...options, limit: Math.ceil(limit * 0.7) }),
        this.searchCatalog(query, { ...options, limit: Math.ceil(limit * 0.5) })
      ]);

      const combinedResults = [];

      // Add FHIR results
      if (fhirResults.status === 'fulfilled') {
        combinedResults.push(...fhirResults.value.map(result => ({
          ...result,
          searchSource: 'fhir',
          searchScore: this.calculateSearchScore(query, this.getDisplayText(result))
        })));
      }

      // Add catalog results that don't duplicate FHIR results
      if (catalogResults.status === 'fulfilled') {
        const fhirIds = new Set(combinedResults.map(r => r.id));
        const uniqueCatalogResults = catalogResults.value.filter(result => 
          !fhirIds.has(result.id)
        );
        
        combinedResults.push(...uniqueCatalogResults.map(result => ({
          ...result,
          searchSource: 'catalog'
        })));
      }

      // Sort by search score and relevance
      combinedResults.sort((a, b) => {
        // Prioritize FHIR results slightly for exact matches
        const scoreA = (a.searchScore || 0) + (a.searchSource === 'fhir' ? 0.1 : 0);
        const scoreB = (b.searchScore || 0) + (b.searchSource === 'fhir' ? 0.1 : 0);
        return scoreB - scoreA;
      });

      return combinedResults.slice(0, limit);

    } catch (error) {
      // Fall back to FHIR search if hybrid fails
      console.warn('Hybrid search failed, falling back to FHIR:', error);
      return this.searchFHIR(query, options);
    }
  }

  // Calculate search relevance score
  calculateSearchScore(query, text) {
    if (!query || !text) return 0;
    
    const queryLower = query.toLowerCase();
    const textLower = text.toLowerCase();
    
    // Exact match gets highest score
    if (textLower === queryLower) return 1.0;
    
    // Starts with query gets high score
    if (textLower.startsWith(queryLower)) return 0.8;
    
    // Contains query gets medium score
    if (textLower.includes(queryLower)) return 0.6;
    
    // Word boundary matches get good score
    const wordBoundaryRegex = new RegExp(`\\b${queryLower}`, 'i');
    if (wordBoundaryRegex.test(text)) return 0.7;
    
    // Partial matches get lower score
    const similarity = this.calculateStringSimilarity(queryLower, textLower);
    return similarity * 0.4;
  }

  // Calculate string similarity (simple Levenshtein-based)
  calculateStringSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  // Levenshtein distance calculation
  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  // Get display text from FHIR resource for scoring
  getDisplayText(resource) {
    if (!resource) return '';
    
    const resourceType = resource.resourceType?.toLowerCase();
    
    switch (resourceType) {
      case 'patient':
        const name = resource.name?.[0];
        if (name) {
          const given = name.given?.join(' ') || '';
          const family = name.family || '';
          return `${given} ${family}`.trim();
        }
        return resource.id || '';
        
      case 'practitioner':
        const practName = resource.name?.[0];
        if (practName) {
          const given = practName.given?.join(' ') || '';
          const family = practName.family || '';
          return `${given} ${family}`.trim();
        }
        return resource.id || '';
        
      case 'organization':
        return resource.name || resource.id || '';
        
      case 'medication':
        return resource.code?.text || 
               resource.code?.coding?.[0]?.display || 
               resource.id || '';
        
      case 'condition':
        return resource.code?.text || 
               resource.code?.coding?.[0]?.display || 
               resource.id || '';
        
      default:
        return resource.display || 
               resource.name || 
               resource.code?.text ||
               resource.id || '';
    }
  }

  // Set search backend
  setBackend(backend) {
    if (Object.values(SEARCH_BACKENDS).includes(backend)) {
      this.backend = backend;
    } else {
      console.warn(`Invalid search backend: ${backend}`);
    }
  }

  // Get current backend
  getBackend() {
    return this.backend;
  }

  // Clear local search index
  clearLocalIndex() {
    this.localIndex.clear();
  }

  // Update search metrics
  updateMetrics(responseTime) {
    const total = this.searchMetrics.totalSearches;
    this.searchMetrics.avgResponseTime = 
      (this.searchMetrics.avgResponseTime * (total - 1) + responseTime) / total;
  }

  // Get search metrics
  getMetrics() {
    return { ...this.searchMetrics };
  }
}

// Export singleton instance
export const searchService = new SearchService();

// Export search backends enum
export { SEARCH_BACKENDS };