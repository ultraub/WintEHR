/**
 * CDS Clinical Data Service
 * Provides access to clinical reference data, lab catalogs with reference ranges,
 * and vital sign references for CDS Hooks condition evaluation
 */
import axios from 'axios';

class CDSClinicalDataService {
  constructor() {
    // Use direct backend URL for development to bypass proxy issues
    // Check if running in Docker container
    const isInDocker = !!process.env.HOSTNAME;
    const backendHost = isInDocker ? 'http://backend:8000' : 'http://localhost:8000';
    
    this.baseUrl = process.env.REACT_APP_BACKEND_URL 
      ? `${process.env.REACT_APP_BACKEND_URL}/api/catalogs`
      : (process.env.NODE_ENV === 'development' ? `${backendHost}/api/catalogs` : '/api/catalogs');
    
    this.cache = new Map();
    this.cacheTimeout = 10 * 60 * 1000; // 10 minutes for reference data
    
    // Create a dedicated HTTP client
    this.httpClient = axios.create({
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
  }

  /**
   * Get lab catalog with reference ranges (DYNAMIC - from actual patient data)
   * @param {string} search - Search term
   * @param {string} category - Filter by category (chemistry, hematology, etc.)
   * @param {number} limit - Maximum results
   * @returns {Promise<Array>} Array of lab test objects with reference ranges calculated from patient data
   */
  async getLabCatalog(search = null, category = null, limit = 50) {
    const cacheKey = `lab-catalog:${search}:${category}:${limit}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const params = {};
      if (search) params.search = search;
      if (category) params.category = category;
      params.limit = limit;

      const response = await this.httpClient.get(`${this.baseUrl}/lab-tests`, { params });
      
      const data = response.data || [];
      this.setCache(cacheKey, data);
      return data;
    } catch (error) {
      // Error fetching dynamic lab catalog - re-throwing with context
      throw new Error(`Failed to fetch lab catalog: ${error.message}`);
    }
  }

  /**
   * Get dynamic medication catalog from actual patient prescriptions
   * @param {string} search - Search term
   * @param {number} limit - Maximum results
   * @returns {Promise<Array>} Array of medication objects with usage frequencies
   */
  async getDynamicMedicationCatalog(search = null, limit = 50) {
    const cacheKey = `dynamic-medications:${search}:${limit}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const params = {};
      if (search) params.search = search;
      params.limit = limit;

      const response = await this.httpClient.get(`${this.baseUrl}/medications`, { params });
      
      const data = response.data || [];
      this.setCache(cacheKey, data);
      return data;
    } catch (error) {
      // Error fetching dynamic medication catalog - re-throwing with context
      throw new Error(`Failed to fetch medication catalog: ${error.message}`);
    }
  }

  /**
   * Get dynamic condition catalog from actual patient diagnoses  
   * @param {string} search - Search term
   * @param {number} limit - Maximum results
   * @returns {Promise<Array>} Array of condition objects with diagnosis frequencies
   */
  async getDynamicConditionCatalog(search = null, limit = 50) {
    const cacheKey = `dynamic-conditions:${search}:${limit}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const params = {};
      if (search) params.search = search;
      params.limit = limit;

      const response = await this.httpClient.get(`${this.baseUrl}/conditions`, { params });
      
      const data = response.data || [];
      this.setCache(cacheKey, data);
      return data;
    } catch (error) {
      // Error fetching dynamic condition catalog - re-throwing with context
      throw new Error(`Failed to fetch condition catalog: ${error.message}`);
    }
  }

  /**
   * Search across all dynamic catalogs simultaneously
   * @param {string} query - Search term
   * @param {number} limit - Maximum results per category
   * @returns {Promise<Object>} Object with results from all catalog types
   */
  async searchAllDynamicCatalogs(query, limit = 10) {
    const cacheKey = `dynamic-search:${query}:${limit}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const params = { q: query, limit_per_type: limit };
      const response = await this.httpClient.get(`${this.baseUrl}/search`, { params });
      
      const data = response.data || {};
      this.setCache(cacheKey, data);
      return data;
    } catch (error) {
      // Error searching dynamic catalogs - re-throwing with context
      throw new Error(`Failed to search catalogs: ${error.message}`);
    }
  }

  /**
   * Force refresh all dynamic catalogs
   * @param {number} limit - Optional limit for each catalog
   * @returns {Promise<Object>} Refresh summary
   */
  async refreshDynamicCatalogs(limit = null) {
    try {
      const params = {};
      if (limit) params.limit = limit;

      const response = await this.httpClient.post(`${this.baseUrl}/refresh`, null, { params });
      
      // Clear our cache since catalogs have been refreshed
      this.clearCache();
      
      return response.data;
    } catch (error) {
      // Error refreshing dynamic catalogs - re-throwing with context
      throw new Error(`Failed to refresh catalogs: ${error.message}`);
    }
  }

  /**
   * Get statistics about dynamic catalogs
   * @returns {Promise<Object>} Catalog statistics including resource counts
   */
  async getDynamicCatalogStatistics() {
    try {
      const response = await this.httpClient.get(`${this.baseUrl}/stats`);
      return response.data;
    } catch (error) {
      // Error fetching catalog statistics - re-throwing with context
      throw new Error(`Failed to fetch catalog statistics: ${error.message}`);
    }
  }

  /**
   * Get detailed lab test information including reference ranges
   * @param {string} labId - Lab test ID
   * @returns {Promise<Object>} Lab test details
   */
  async getLabDetails(labId) {
    const cacheKey = `lab-details:${labId}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await this.httpClient.get(`${this.baseUrl}/lab-tests/${labId}`);
      
      const data = response.data;
      this.setCache(cacheKey, data);
      return data;
    } catch (error) {
      // Error fetching lab details - returning null for graceful degradation
      return null;
    }
  }

  /**
   * Get vital sign reference ranges
   * @param {string} vitalType - Filter by vital sign type
   * @returns {Promise<Array>} Array of vital sign references
   */
  async getVitalSignReferences(vitalType = null) {
    const cacheKey = `vital-references:${vitalType}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const params = {};
      if (vitalType) params.vital_type = vitalType;

      const response = await this.httpClient.get(`${this.baseUrl}/vital-references`, { params });
      
      const data = response.data || [];
      this.setCache(cacheKey, data);
      return data;
    } catch (error) {
      // Error fetching vital sign references - returning empty array for graceful degradation
      return [];
    }
  }

  /**
   * Get detailed vital sign reference information
   * @param {string} vitalId - Vital sign ID
   * @returns {Promise<Object>} Vital sign reference details
   */
  async getVitalSignDetails(vitalId) {
    const cacheKey = `vital-details:${vitalId}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await this.httpClient.get(`${this.baseUrl}/vital-references/${vitalId}`);
      
      const data = response.data;
      this.setCache(cacheKey, data);
      return data;
    } catch (error) {
      // Error fetching vital sign details - returning null for graceful degradation
      return null;
    }
  }

  /**
   * Get medical condition catalog
   * @param {string} search - Search term
   * @param {string} category - Filter by category
   * @param {number} limit - Maximum results
   * @returns {Promise<Array>} Array of condition objects
   */
  async getConditionCatalog(search = null, category = null, limit = 50) {
    const cacheKey = `condition-catalog:${search}:${category}:${limit}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const params = {};
      if (search) params.search = search;
      if (category) params.category = category;
      params.limit = limit;

      const response = await this.httpClient.get(`${this.baseUrl}/conditions`, { params });
      
      const data = response.data || [];
      this.setCache(cacheKey, data);
      return data;
    } catch (error) {
      // Error fetching condition catalog - returning empty array for graceful degradation
      return [];
    }
  }

  /**
   * Get detailed condition information
   * @param {string} conditionId - Condition ID
   * @returns {Promise<Object>} Condition details
   */
  async getConditionDetails(conditionId) {
    const cacheKey = `condition-details:${conditionId}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await this.httpClient.get(`${this.baseUrl}/condition-catalog/${conditionId}`);
      
      const data = response.data;
      this.setCache(cacheKey, data);
      return data;
    } catch (error) {
      // Error fetching condition details - returning null for graceful degradation
      return null;
    }
  }

  /**
   * Get available lab test categories
   * @returns {Promise<Array>} Array of category strings
   */
  async getLabCategories() {
    const cacheKey = 'lab-categories';
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await this.httpClient.get(`${this.baseUrl}/lab-categories`);
      
      const data = response.data || [];
      this.setCache(cacheKey, data);
      return data;
    } catch (error) {
      // Error fetching lab categories - returning empty array for graceful degradation
      return [];
    }
  }

  /**
   * Get available condition categories
   * @returns {Promise<Array>} Array of category strings
   */
  async getConditionCategories() {
    const cacheKey = 'condition-categories';
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await this.httpClient.get(`${this.baseUrl}/condition-categories`);
      
      const data = response.data || [];
      this.setCache(cacheKey, data);
      return data;
    } catch (error) {
      // Error fetching condition categories - returning empty array for graceful degradation
      return [];
    }
  }

  /**
   * Check if a lab value is within normal range
   * @param {string} labCode - LOINC code
   * @param {number} value - Lab value
   * @param {string} ageGroup - Patient age group
   * @returns {Object} { inRange: boolean, interpretation: string }
   */
  checkLabValueRange(labCode, value, ageGroup = 'adult') {
    // This would typically call the backend, but for now we'll use local logic
    const labTest = this.cache.get(`lab-details:${labCode}`)?.data;
    if (!labTest) {
      return { inRange: null, interpretation: 'Unknown' };
    }

    const range = labTest.reference_range;
    if (!range) {
      return { inRange: null, interpretation: 'No reference range' };
    }

    if (value < range.min) {
      return { 
        inRange: false, 
        interpretation: value < labTest.critical_low ? 'Critical Low' : 'Low' 
      };
    } else if (value > range.max) {
      return { 
        inRange: false, 
        interpretation: value > labTest.critical_high ? 'Critical High' : 'High' 
      };
    } else {
      return { inRange: true, interpretation: 'Normal' };
    }
  }

  /**
   * Check if a vital sign is within normal range
   * @param {string} vitalType - Vital sign type
   * @param {number} value - Vital sign value
   * @param {string} ageGroup - Patient age group
   * @param {string} component - For BP: 'systolic' or 'diastolic'
   * @returns {Object} { inRange: boolean, interpretation: string }
   */
  checkVitalSignRange(vitalType, value, ageGroup = 'adult', component = null) {
    const vitalSign = this.cache.get(`vital-details:${vitalType}`)?.data;
    if (!vitalSign) {
      return { inRange: null, interpretation: 'Unknown' };
    }

    const ranges = vitalSign.normal_ranges[ageGroup] || vitalSign.normal_ranges['all'];
    if (!ranges) {
      return { inRange: null, interpretation: 'No reference range' };
    }

    let min, max;
    if (vitalType === 'blood-pressure' && component) {
      min = ranges[`${component}_min`];
      max = ranges[`${component}_max`];
    } else {
      min = ranges.min;
      max = ranges.max;
    }

    if (value < min) {
      return { 
        inRange: false, 
        interpretation: value < vitalSign.critical_low ? 'Critical Low' : 'Low' 
      };
    } else if (value > max) {
      return { 
        inRange: false, 
        interpretation: value > vitalSign.critical_high ? 'Critical High' : 'High' 
      };
    } else {
      return { inRange: true, interpretation: 'Normal' };
    }
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
}

// Export singleton instance
export const cdsClinicalDataService = new CDSClinicalDataService();
export default cdsClinicalDataService;