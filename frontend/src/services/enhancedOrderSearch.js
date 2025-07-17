/**
 * Enhanced Order Search Service
 * 
 * Provides comprehensive FHIR R4 search capabilities for ServiceRequest and MedicationRequest resources
 * with advanced filtering, sorting, and analytics support.
 */

import { fhirService } from '../core/fhir/services/fhirService';
import { cdsClinicalDataService } from './cdsClinicalDataService';
import { fhirClient } from '../core/fhir/services/fhirClient';

class EnhancedOrderSearchService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    this.baseUrl = '/fhir/R4';
  }

  /**
   * Search orders with advanced FHIR R4 parameters
   * @param {Object} searchParams - Search parameters
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Search results with metadata
   */
  async searchOrders(searchParams, options = {}) {
    try {
      const {
        patientId,
        resourceTypes = ['ServiceRequest', 'MedicationRequest'],
        sort = '-authored-date',
        count = 50,
        page = 1,
        includeAnalytics = false
      } = options;

      // Build search URLs for each resource type
      const searchPromises = resourceTypes.map(resourceType => 
        this.searchResourceType(resourceType, patientId, searchParams, { sort, count, page })
      );

      const results = await Promise.all(searchPromises);
      
      // Combine and process results
      const combinedResults = this.combineSearchResults(results, resourceTypes);
      
      // Add analytics if requested
      if (includeAnalytics) {
        combinedResults.analytics = await this.generateSearchAnalytics(combinedResults.entries);
      }

      return combinedResults;
    } catch (error) {
      console.error('Enhanced order search error:', error);
      throw new Error(`Order search failed: ${error.message}`);
    }
  }

  /**
   * Search a specific resource type with FHIR parameters
   * @param {string} resourceType - FHIR resource type
   * @param {string} patientId - Patient ID
   * @param {URLSearchParams} searchParams - Search parameters
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} FHIR Bundle
   */
  async searchResourceType(resourceType, patientId, searchParams, options = {}) {
    const { sort, count, page } = options;
    
    // Build URL with parameters
    const url = new URL(`${this.baseUrl}/${resourceType}`, window.location.origin);
    
    // Add patient filter
    if (patientId) {
      url.searchParams.append('subject', `Patient/${patientId}`);
    }

    // Add search parameters
    for (const [key, value] of searchParams.entries()) {
      url.searchParams.append(key, value);
    }

    // Add sorting and pagination
    if (sort) url.searchParams.append('_sort', sort);
    if (count) url.searchParams.append('_count', count);
    if (page > 1) {
      const offset = (page - 1) * count;
      url.searchParams.append('_offset', offset);
    }

    // Add common includes for enhanced data
    url.searchParams.append('_include', `${resourceType}:requester`);
    url.searchParams.append('_include', `${resourceType}:performer`);
    url.searchParams.append('_include', `${resourceType}:encounter`);

    // Check cache first
    const cacheKey = url.toString();
    const cached = this.getCachedResult(cacheKey);
    if (cached) {
      return cached;
    }

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/fhir+json',
        'Accept': 'application/fhir+json'
      }
    });

    if (!response.ok) {
      throw new Error(`${resourceType} search failed: ${response.statusText}`);
    }

    const bundle = await response.json();
    
    // Cache the result
    this.setCachedResult(cacheKey, bundle);
    
    return bundle;
  }

  /**
   * Combine search results from multiple resource types
   * @param {Array} results - Array of FHIR bundles
   * @param {Array} resourceTypes - Resource types searched
   * @returns {Object} Combined results
   */
  combineSearchResults(results, resourceTypes) {
    const combinedEntries = [];
    const includedResources = [];
    let totalResults = 0;

    results.forEach((bundle, index) => {
      const resourceType = resourceTypes[index];
      
      if (bundle.entry) {
        bundle.entry.forEach(entry => {
          if (entry.resource.resourceType === resourceType) {
            // Mark the resource type for easier filtering
            entry.resource._orderType = resourceType;
            combinedEntries.push(entry);
          } else {
            // This is an included resource
            includedResources.push(entry);
          }
        });
      }

      totalResults += bundle.total || 0;
    });

    // Sort combined entries by date (most recent first)
    combinedEntries.sort((a, b) => {
      const dateA = new Date(a.resource.authoredOn || a.resource.meta?.lastUpdated || '1970-01-01');
      const dateB = new Date(b.resource.authoredOn || b.resource.meta?.lastUpdated || '1970-01-01');
      return dateB - dateA;
    });

    return {
      resourceType: 'Bundle',
      type: 'searchset',
      total: totalResults,
      entries: combinedEntries,
      included: includedResources,
      searchMetadata: {
        resourceTypes,
        searchTime: new Date().toISOString(),
        resultCount: combinedEntries.length
      }
    };
  }

  /**
   * Generate analytics for search results
   * @param {Array} entries - Search result entries
   * @returns {Object} Analytics data
   */
  async generateSearchAnalytics(entries) {
    const orders = entries.map(entry => entry.resource);
    
    const analytics = {
      summary: {
        total: orders.length,
        byResourceType: {},
        byStatus: {},
        byPriority: {},
        byCategory: {}
      },
      trends: {
        last30Days: this.calculateTrends(orders, 30),
        last7Days: this.calculateTrends(orders, 7)
      },
      performance: {
        averageTimeToCompletion: this.calculateAverageCompletionTime(orders),
        completionRate: this.calculateCompletionRate(orders)
      }
    };

    // Calculate distributions
    orders.forEach(order => {
      // By resource type
      const resourceType = order._orderType || order.resourceType;
      analytics.summary.byResourceType[resourceType] = 
        (analytics.summary.byResourceType[resourceType] || 0) + 1;

      // By status
      const status = order.status || 'unknown';
      analytics.summary.byStatus[status] = 
        (analytics.summary.byStatus[status] || 0) + 1;

      // By priority
      const priority = order.priority || 'routine';
      analytics.summary.byPriority[priority] = 
        (analytics.summary.byPriority[priority] || 0) + 1;

      // By category
      let category = 'Other';
      if (order._orderType === 'MedicationRequest') {
        category = 'Medications';
      } else if (order.category?.[0]) {
        category = order.category[0].coding?.[0]?.display || 
                  order.category[0].text || 
                  'Procedures';
      }
      analytics.summary.byCategory[category] = 
        (analytics.summary.byCategory[category] || 0) + 1;
    });

    return analytics;
  }

  /**
   * Calculate trends over a specified period
   * @param {Array} orders - Order resources
   * @param {number} days - Number of days to analyze
   * @returns {Array} Trend data
   */
  calculateTrends(orders, days) {
    const now = new Date();
    const trends = Array.from({ length: days }, (_, i) => {
      const date = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000));
      return {
        date: date.toISOString().split('T')[0],
        orders: 0,
        completed: 0
      };
    }).reverse();

    orders.forEach(order => {
      const orderDate = new Date(order.authoredOn || order.meta?.lastUpdated || '1970-01-01');
      const daysDiff = Math.floor((now - orderDate) / (24 * 60 * 60 * 1000));
      
      if (daysDiff >= 0 && daysDiff < days) {
        const trendIndex = days - 1 - daysDiff;
        if (trends[trendIndex]) {
          trends[trendIndex].orders++;
          if (order.status === 'completed') {
            trends[trendIndex].completed++;
          }
        }
      }
    });

    return trends;
  }

  /**
   * Calculate average completion time for orders
   * @param {Array} orders - Order resources
   * @returns {number} Average completion time in days
   */
  calculateAverageCompletionTime(orders) {
    const completedOrders = orders.filter(order => order.status === 'completed');
    
    if (completedOrders.length === 0) return 0;

    const totalTime = completedOrders.reduce((sum, order) => {
      const start = new Date(order.authoredOn || order.meta?.lastUpdated || '1970-01-01');
      const end = new Date(order.meta?.lastUpdated || '1970-01-01');
      return sum + (end - start);
    }, 0);

    return Math.round(totalTime / completedOrders.length / (24 * 60 * 60 * 1000));
  }

  /**
   * Calculate completion rate for orders
   * @param {Array} orders - Order resources
   * @returns {number} Completion rate as percentage
   */
  calculateCompletionRate(orders) {
    if (orders.length === 0) return 0;
    
    const completed = orders.filter(order => order.status === 'completed').length;
    return Math.round((completed / orders.length) * 100);
  }

  /**
   * Search orders with smart autocomplete suggestions
   * @param {string} query - Search query
   * @param {string} patientId - Patient ID
   * @param {Object} context - Search context
   * @returns {Promise<Array>} Suggestions
   */
  async getSearchSuggestions(query, patientId, context = {}) {
    try {
      const suggestions = [];
      const lowerQuery = query.toLowerCase();

      // Get suggestions from dynamic catalogs
      if (query.length >= 2) {
        const [medications, procedures, conditions] = await Promise.all([
          cdsClinicalDataService.getDynamicMedicationCatalog(query, 10),
          cdsClinicalDataService.getProcedureCatalog(query, null, 10),
          cdsClinicalDataService.getDynamicConditionCatalog(query, 10)
        ]);

        // Add medication suggestions
        medications.forEach(med => {
          suggestions.push({
            type: 'medication',
            text: med.code?.text || med.code?.coding?.[0]?.display,
            code: med.code?.coding?.[0]?.code,
            system: med.code?.coding?.[0]?.system,
            category: 'Medications',
            searchType: 'code'
          });
        });

        // Add procedure suggestions
        procedures.forEach(proc => {
          suggestions.push({
            type: 'procedure',
            text: proc.code?.text || proc.code?.coding?.[0]?.display,
            code: proc.code?.coding?.[0]?.code,
            system: proc.code?.coding?.[0]?.system,
            category: 'Procedures',
            searchType: 'code'
          });
        });

        // Add condition suggestions for reason codes
        conditions.forEach(cond => {
          suggestions.push({
            type: 'condition',
            text: cond.code?.text || cond.code?.coding?.[0]?.display,
            code: cond.code?.coding?.[0]?.code,
            system: cond.code?.coding?.[0]?.system,
            category: 'Indications',
            searchType: 'reason-code'
          });
        });
      }

      // Add common search patterns
      const commonPatterns = [
        { text: 'Lab orders', searchType: 'category', value: 'laboratory' },
        { text: 'Imaging orders', searchType: 'category', value: 'imaging' },
        { text: 'Urgent orders', searchType: 'priority', value: 'urgent' },
        { text: 'STAT orders', searchType: 'priority', value: 'stat' },
        { text: 'Active orders', searchType: 'status', value: 'active' },
        { text: 'Completed orders', searchType: 'status', value: 'completed' },
        { text: 'Today\'s orders', searchType: 'date', value: 'today' },
        { text: 'This week\'s orders', searchType: 'date', value: 'week' }
      ];

      commonPatterns.forEach(pattern => {
        if (pattern.text.toLowerCase().includes(lowerQuery)) {
          suggestions.push({
            type: 'pattern',
            text: pattern.text,
            searchType: pattern.searchType,
            value: pattern.value,
            category: 'Quick Filters'
          });
        }
      });

      // Limit and sort suggestions
      return suggestions
        .slice(0, 20)
        .sort((a, b) => {
          // Prioritize exact matches
          const aExact = a.text.toLowerCase().startsWith(lowerQuery);
          const bExact = b.text.toLowerCase().startsWith(lowerQuery);
          if (aExact && !bExact) return -1;
          if (!aExact && bExact) return 1;
          return a.text.localeCompare(b.text);
        });
    } catch (error) {
      console.error('Error getting search suggestions:', error);
      return [];
    }
  }

  /**
   * Get order recommendations based on patient context
   * @param {string} patientId - Patient ID
   * @param {Object} clinicalContext - Patient clinical context
   * @returns {Promise<Array>} Order recommendations
   */
  async getOrderRecommendations(patientId, clinicalContext = {}) {
    try {
      const recommendations = [];

      // Get patient's recent orders to avoid duplicates
      const recentOrders = await this.searchOrders(
        new URLSearchParams({ 'authored-date': 'ge' + new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] }),
        { patientId, count: 100 }
      );

      const recentOrderCodes = new Set();
      recentOrders.entries.forEach(entry => {
        const code = entry.resource.code?.coding?.[0]?.code;
        if (code) recentOrderCodes.add(code);
      });

      // Generate recommendations based on conditions
      if (clinicalContext.conditions) {
        for (const condition of clinicalContext.conditions) {
          const conditionCode = condition.code?.coding?.[0]?.code;
          const conditionText = condition.code?.text || condition.code?.coding?.[0]?.display;

          // Get recommended orders for this condition
          const conditionRecommendations = await this.getRecommendationsForCondition(conditionCode, conditionText);
          
          conditionRecommendations.forEach(rec => {
            if (!recentOrderCodes.has(rec.code)) {
              recommendations.push({
                ...rec,
                reason: `Recommended for ${conditionText}`,
                evidence: 'Clinical guidelines',
                priority: rec.priority || 'routine'
              });
            }
          });
        }
      }

      // Add preventive care recommendations based on age/gender
      if (clinicalContext.demographics) {
        const preventiveRecommendations = await this.getPreventiveRecommendations(
          clinicalContext.demographics,
          recentOrderCodes
        );
        recommendations.push(...preventiveRecommendations);
      }

      return recommendations.slice(0, 10); // Limit to top 10 recommendations
    } catch (error) {
      console.error('Error getting order recommendations:', error);
      return [];
    }
  }

  /**
   * Get recommendations for a specific condition
   * @param {string} conditionCode - Condition code
   * @param {string} conditionText - Condition display text
   * @returns {Promise<Array>} Recommendations
   */
  async getRecommendationsForCondition(conditionCode, conditionText) {
    // This would typically query a clinical decision support system
    // For now, return some basic recommendations based on common conditions
    
    const conditionRecommendations = {
      '44054006': [ // Type 2 diabetes
        { code: '33747-0', text: 'Glucose [Mass/volume] in Serum or Plasma', type: 'ServiceRequest', priority: 'routine' },
        { code: '4548-4', text: 'Hemoglobin A1c/Hemoglobin.total in Blood', type: 'ServiceRequest', priority: 'routine' }
      ],
      '38341003': [ // Hypertension
        { code: '85354-9', text: 'Blood pressure panel with all children optional', type: 'ServiceRequest', priority: 'routine' },
        { code: '2093-3', text: 'Cholesterol [Mass/volume] in Serum or Plasma', type: 'ServiceRequest', priority: 'routine' }
      ],
      '25064002': [ // Headache
        { code: 'CT-HEAD', text: 'CT scan of head', type: 'ServiceRequest', priority: 'routine' },
        { code: '387207008', text: 'Ibuprofen', type: 'MedicationRequest', priority: 'routine' }
      ]
    };

    return conditionRecommendations[conditionCode] || [];
  }

  /**
   * Get preventive care recommendations
   * @param {Object} demographics - Patient demographics
   * @param {Set} recentOrderCodes - Recently ordered codes
   * @returns {Promise<Array>} Preventive recommendations
   */
  async getPreventiveRecommendations(demographics, recentOrderCodes) {
    const recommendations = [];
    const age = demographics.age || 0;
    const gender = demographics.gender;

    // Age-based screening recommendations
    if (age >= 50) {
      if (!recentOrderCodes.has('COLONOSCOPY')) {
        recommendations.push({
          code: 'COLONOSCOPY',
          text: 'Colonoscopy screening',
          type: 'ServiceRequest',
          reason: 'Age-based screening (50+)',
          evidence: 'USPSTF guidelines',
          priority: 'routine'
        });
      }
    }

    if (age >= 40) {
      if (!recentOrderCodes.has('MAMMOGRAM') && gender === 'female') {
        recommendations.push({
          code: 'MAMMOGRAM',
          text: 'Mammography screening',
          type: 'ServiceRequest',
          reason: 'Age-based screening (40+)',
          evidence: 'USPSTF guidelines',
          priority: 'routine'
        });
      }
    }

    return recommendations;
  }

  /**
   * Cache management methods
   */
  getCachedResult(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  setCachedResult(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });

    // Clean up old cache entries
    if (this.cache.size > 100) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
  }

  clearCache() {
    this.cache.clear();
  }
}

// Export singleton instance
export const enhancedOrderSearchService = new EnhancedOrderSearchService();
export default enhancedOrderSearchService;