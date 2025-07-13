/**
 * Search Service
 * Provides unified search functionality across all clinical catalogs
 */
import axios from 'axios';

class SearchService {
  constructor() {
    this.baseUrl = '/api/clinical/dynamic-catalog';
    this.cdsUrl = '/api/clinical';
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    
    // Create a dedicated HTTP client for catalog searches
    this.httpClient = axios.create({
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
  }

  /**
   * Search for conditions/problems using dynamic catalog
   * @param {string} query - Search term
   * @param {number} limit - Maximum results
   * @returns {Promise<Array>} Array of condition objects
   */
  async searchConditions(query, limit = 20) {
    if (!query || query.length < 2) {
      return [];
    }

    const cacheKey = `conditions:${query}:${limit}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await this.httpClient.get(`${this.baseUrl}/conditions`, {
        params: { search: query, limit }
      });
      
      const conditions = response.data || [];
      const formatted = conditions.map(this.formatCondition);
      this.setCache(cacheKey, formatted);
      return formatted;
    } catch (error) {
      return [];
    }
  }

  /**
   * Search for medications using dynamic catalog
   * @param {string} query - Search term
   * @param {number} limit - Maximum results
   * @returns {Promise<Array>} Array of medication objects
   */
  async searchMedications(query, limit = 20) {
    if (!query || query.length < 2) {
      return [];
    }

    const cacheKey = `medications:${query}:${limit}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await this.httpClient.get(`${this.baseUrl}/medications`, {
        params: { search: query, limit }
      });
      
      const medications = response.data || [];
      const formatted = medications.map(this.formatMedication);
      this.setCache(cacheKey, formatted);
      return formatted;
    } catch (error) {
      return [];
    }
  }

  /**
   * Search for lab tests using dynamic catalog
   * @param {string} query - Search term
   * @param {number} limit - Maximum results
   * @returns {Promise<Array>} Array of lab test objects
   */
  async searchLabTests(query, limit = 20) {
    if (!query || query.length < 2) {
      return [];
    }

    const cacheKey = `labTests:${query}:${limit}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await this.httpClient.get(`${this.baseUrl}/lab-tests`, {
        params: { search: query, limit }
      });
      
      const labTests = response.data || [];
      const formatted = labTests.map(this.formatLabTest);
      this.setCache(cacheKey, formatted);
      return formatted;
    } catch (error) {
      return [];
    }
  }

  /**
   * Search for imaging procedures
   * @param {string} query - Search term
   * @param {number} limit - Maximum results
   * @returns {Promise<Array>} Array of imaging procedure objects
   */
  async searchImagingProcedures(query, limit = 20) {
    if (!query || query.length < 2) {
      return [];
    }

    const cacheKey = `imaging:${query}:${limit}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await this.httpClient.get(`${this.baseUrl}/imaging-procedures/search`, {
        params: { query, limit }
      });
      
      const procedures = response.data?.imagingProcedures || [];
      this.setCache(cacheKey, procedures);
      return procedures;
    } catch (error) {
      return [];
    }
  }

  /**
   * Universal search across all dynamic catalogs
   * @param {string} query - Search term
   * @param {number} limit - Maximum results per category
   * @returns {Promise<Object>} Object with results from all categories
   */
  async searchAll(query, limit = 10) {
    if (!query || query.length < 2) {
      return {
        medications: [],
        labTests: [],
        conditions: [],
        procedures: [],
        documentTypes: [],
        practitioners: [],
        vaccines: []
      };
    }

    const cacheKey = `all:${query}:${limit}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await this.httpClient.get(`${this.baseUrl}/search`, {
        params: { query, limit }
      });
      
      const data = response.data || {};
      const results = {
        medications: (data.medications || []).map(this.formatMedication),
        labTests: (data.lab_tests || []).map(this.formatLabTest),
        conditions: (data.conditions || []).map(this.formatCondition),
        procedures: (data.procedures || []).map(this.formatProcedure),
        documentTypes: [], // Not implemented in dynamic catalog yet
        practitioners: [], // Not implemented in dynamic catalog yet
        vaccines: [] // Not implemented in dynamic catalog yet
      };
      
      this.setCache(cacheKey, results);
      return results;
    } catch (error) {
      return {
        medications: [],
        labTests: [],
        conditions: [],
        procedures: [],
        documentTypes: [],
        practitioners: [],
        vaccines: []
      };
    }
  }

  /**
   * Search for procedures using dynamic catalog
   * @param {string} query - Search term
   * @param {number} limit - Maximum results
   * @returns {Promise<Array>} Array of procedure objects
   */
  async searchProcedures(query, limit = 20) {
    if (!query || query.length < 2) {
      return [];
    }

    const cacheKey = `procedures:${query}:${limit}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await this.httpClient.get(`${this.baseUrl}/procedures`, {
        params: { search: query, limit }
      });
      
      const procedures = response.data || [];
      const formatted = procedures.map(this.formatProcedure);
      this.setCache(cacheKey, formatted);
      return formatted;
    } catch (error) {
      return [];
    }
  }

  /**
   * Search for document types
   * @param {string} query - Search term
   * @param {number} limit - Maximum results
   * @returns {Promise<Array>} Array of document type objects
   */
  async searchDocumentTypes(query, limit = 20) {
    if (!query || query.length < 2) {
      return [];
    }

    const cacheKey = `documentTypes:${query}:${limit}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await this.httpClient.get(`${this.baseUrl}/document-types/search`, {
        params: { query, limit }
      });
      
      const documentTypes = response.data?.documentTypes || [];
      this.setCache(cacheKey, documentTypes);
      return documentTypes;
    } catch (error) {
      return [];
    }
  }

  /**
   * Search for practitioners/providers
   * @param {string} query - Search term
   * @param {number} limit - Maximum results
   * @returns {Promise<Array>} Array of practitioner objects
   */
  async searchPractitioners(query, limit = 20) {
    if (!query || query.length < 2) {
      return [];
    }

    const cacheKey = `practitioners:${query}:${limit}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await this.httpClient.get(`${this.baseUrl}/practitioners/search`, {
        params: { query, limit }
      });
      
      const practitioners = response.data?.practitioners || [];
      this.setCache(cacheKey, practitioners);
      return practitioners;
    } catch (error) {
      return [];
    }
  }

  /**
   * Search for organizations/facilities
   * @param {string} query - Search term
   * @param {number} limit - Maximum results
   * @returns {Promise<Array>} Array of organization objects
   */
  async searchOrganizations(query, limit = 20) {
    if (!query || query.length < 2) {
      return [];
    }

    const cacheKey = `organizations:${query}:${limit}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await this.httpClient.get(`${this.baseUrl}/organizations/search`, {
        params: { query, limit }
      });
      
      const organizations = response.data?.organizations || [];
      this.setCache(cacheKey, organizations);
      return organizations;
    } catch (error) {
      return [];
    }
  }

  /**
   * Search for vaccine codes
   * @param {string} query - Search term
   * @param {number} limit - Maximum results
   * @returns {Promise<Array>} Array of vaccine objects
   */
  async searchVaccines(query, limit = 20) {
    if (!query || query.length < 2) {
      return [];
    }

    const cacheKey = `vaccines:${query}:${limit}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await this.httpClient.get(`${this.baseUrl}/vaccines/search`, {
        params: { query, limit }
      });
      
      const vaccines = response.data?.vaccines || [];
      this.setCache(cacheKey, vaccines);
      return vaccines;
    } catch (error) {
      return [];
    }
  }

  /**
   * Search for allergens (combines medications with environmental allergens)
   * @param {string} query - Search term
   * @param {string} category - Filter by category (medication, food, environment)
   * @returns {Promise<Array>} Array of allergen objects
   */
  async searchAllergens(query, category = null) {
    if (!query || query.length < 2) {
      return [];
    }

    const results = [];

    // Search medications if no category filter or medication category
    if (!category || category === 'medication') {
      try {
        const medications = await this.searchMedications(query, 10);
        results.push(...medications.map(med => ({
          code: med.code || 'RXNORM:' + med.id,
          display: med.name || med.display,
          system: med.system || 'http://www.nlm.nih.gov/research/umls/rxnorm',
          category: 'medication',
          source: 'medication_catalog'
        })));
      } catch (error) {
        // Silently ignore medication search errors
      }
    }

    // Add common environmental and food allergens
    if (!category || category === 'food' || category === 'environment') {
      const commonAllergens = [
        // Foods
        { code: 'SNOMED:735029007', display: 'Shellfish', category: 'food' },
        { code: 'SNOMED:735030002', display: 'Peanuts', category: 'food' },
        { code: 'SNOMED:735048007', display: 'Tree nuts', category: 'food' },
        { code: 'SNOMED:735049004', display: 'Milk', category: 'food' },
        { code: 'SNOMED:735050004', display: 'Eggs', category: 'food' },
        { code: 'SNOMED:735051000', display: 'Wheat', category: 'food' },
        { code: 'SNOMED:735052007', display: 'Soy', category: 'food' },
        
        // Environmental
        { code: 'SNOMED:256259004', display: 'Pollen', category: 'environment' },
        { code: 'SNOMED:232347008', display: 'Dust mites', category: 'environment' },
        { code: 'SNOMED:232350006', display: 'Animal dander', category: 'environment' },
        { code: 'SNOMED:232353008', display: 'Mold', category: 'environment' },
        { code: 'SNOMED:420174000', display: 'Latex', category: 'environment' }
      ];

      const filtered = commonAllergens.filter(allergen => {
        const matchesQuery = allergen.display.toLowerCase().includes(query.toLowerCase()) ||
                           allergen.code.toLowerCase().includes(query.toLowerCase());
        const matchesCategory = !category || allergen.category === category;
        return matchesQuery && matchesCategory;
      });

      results.push(...filtered.map(allergen => ({
        ...allergen,
        system: 'http://snomed.info/sct',
        source: 'common_allergens'
      })));
    }

    return results;
  }

  /**
   * Get item from cache if not expired
   * @param {string} key - Cache key
   * @returns {any|null} Cached value or null
   */
  getFromCache(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  /**
   * Set item in cache with timestamp
   * @param {string} key - Cache key
   * @param {any} data - Data to cache
   */
  setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Clear all cached data
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Format medication for display
   * @param {Object} medication - Medication object from dynamic catalog
   * @returns {Object} Formatted medication
   */
  formatMedication(medication) {
    return {
      id: medication.id,
      name: medication.display || 'Unknown medication',
      display: medication.display || 'Unknown medication',
      code: medication.code,
      system: medication.system || 'http://www.nlm.nih.gov/research/umls/rxnorm',
      frequency_count: medication.frequency_count || 0,
      source: 'dynamic'
    };
  }

  /**
   * Format condition for display
   * @param {Object} condition - Condition object from dynamic catalog
   * @returns {Object} Formatted condition
   */
  formatCondition(condition) {
    return {
      code: condition.code,
      display: condition.display || 'Unknown condition',
      system: condition.system || 'http://snomed.info/sct',
      frequency_count: condition.frequency_count || 0,
      source: 'dynamic'
    };
  }

  /**
   * Format lab test for display
   * @param {Object} labTest - Lab test object from dynamic catalog
   * @returns {Object} Formatted lab test
   */
  formatLabTest(labTest) {
    return {
      code: labTest.loinc_code || labTest.code,
      display: labTest.display || 'Unknown test',
      system: 'http://loinc.org',
      type: 'laboratory',
      frequency_count: labTest.frequency_count || 0,
      reference_range: labTest.reference_range,
      source: 'dynamic'
    };
  }

  /**
   * Format procedure for display
   * @param {Object} procedure - Procedure object from dynamic catalog
   * @returns {Object} Formatted procedure
   */
  formatProcedure(procedure) {
    return {
      code: procedure.code,
      display: procedure.display || 'Unknown procedure',
      system: procedure.system || 'http://snomed.info/sct',
      category: procedure.category || 'procedure',
      frequency_count: procedure.frequency_count || 0,
      source: 'dynamic'
    };
  }

  /**
   * Format document type for display
   * @param {Object} documentType - Document type object from API
   * @returns {Object} Formatted document type
   */
  formatDocumentType(documentType) {
    return {
      code: documentType.code,
      display: documentType.display || 'Unknown document type',
      system: documentType.system || 'http://loinc.org',
      category: 'clinical-document'
    };
  }

  /**
   * Format practitioner for display
   * @param {Object} practitioner - Practitioner object from API
   * @returns {Object} Formatted practitioner
   */
  formatPractitioner(practitioner) {
    return {
      id: practitioner.id,
      display: practitioner.name || practitioner.display || 'Unknown practitioner',
      specialty: practitioner.specialty,
      organization: practitioner.organization,
      active: practitioner.active !== false
    };
  }

  /**
   * Format vaccine for display
   * @param {Object} vaccine - Vaccine object from API
   * @returns {Object} Formatted vaccine
   */
  formatVaccine(vaccine) {
    return {
      code: vaccine.code,
      display: vaccine.display || 'Unknown vaccine',
      system: vaccine.system || 'http://hl7.org/fhir/sid/cvx',
      manufacturer: vaccine.manufacturer,
      type: 'vaccine'
    };
  }
}

// Export singleton instance
export const searchService = new SearchService();
export default searchService;