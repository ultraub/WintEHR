/**
 * Catalog Integration Service
 * Bridges CDS Hook builders with WintEHR's dynamic catalog system
 * Provides normalized data structures for condition builders
 */

import { cdsClinicalDataService } from './cdsClinicalDataService';

class CatalogIntegrationService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get medications with search and filtering capabilities
   * Returns normalized structure for MedicationConditionBuilder
   */
  async getMedications(searchTerm = '', limit = 50) {
    const cacheKey = `medications:${searchTerm}:${limit}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const medications = await cdsClinicalDataService.getDynamicMedicationCatalog(searchTerm, limit);
      
      // Normalize for condition builder use
      const normalized = medications.map(med => ({
        id: med.id || med.code,
        code: med.code,
        display: med.display || med.name,
        system: med.system || 'http://www.nlm.nih.gov/research/umls/rxnorm',
        category: med.category || 'medication',
        usage_count: med.usage_count || 0,
        // Additional fields for CDS logic
        strength: med.strength,
        dosage_form: med.dosage_form,
        generic_name: med.generic_name,
        brand_name: med.brand_name
      }));

      this.setCache(cacheKey, normalized);
      return normalized;
    } catch (error) {
      console.error('Failed to fetch medications from catalog:', error);
      return [];
    }
  }

  /**
   * Get medical conditions with search and filtering
   * Returns normalized structure for MedicalConditionBuilder
   */
  async getConditions(searchTerm = '', category = null, limit = 50) {
    const cacheKey = `conditions:${searchTerm}:${category}:${limit}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const conditions = await cdsClinicalDataService.getDynamicConditionCatalog(searchTerm, limit);
      
      // Normalize for condition builder use
      const normalized = conditions.map(condition => ({
        id: condition.id || condition.code,
        code: condition.code,
        display: condition.display || condition.name,
        system: condition.system || 'http://snomed.info/sct',
        category: condition.category || 'condition',
        usage_count: condition.usage_count || 0,
        // Additional fields for CDS logic
        severity: condition.severity,
        clinical_status: condition.clinical_status || 'active',
        verification_status: condition.verification_status || 'confirmed'
      }));

      this.setCache(cacheKey, normalized);
      return normalized;
    } catch (error) {
      console.error('Failed to fetch conditions from catalog:', error);
      return [];
    }
  }

  /**
   * Get lab tests with reference ranges
   * Returns normalized structure for LabValueConditionBuilder
   */
  async getLabTests(searchTerm = '', category = null, limit = 50) {
    const cacheKey = `lab-tests:${searchTerm}:${category}:${limit}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const labTests = await cdsClinicalDataService.getLabCatalog(searchTerm, category, limit);
      
      // Normalize for condition builder use
      const normalized = labTests.map(lab => ({
        id: lab.id || lab.code,
        code: lab.code,
        display: lab.display || lab.name,
        system: lab.system || 'http://loinc.org',
        category: lab.category || 'laboratory',
        usage_count: lab.usage_count || 0,
        // Reference range information
        reference_range: lab.reference_range,
        unit: lab.unit,
        normal_range: lab.normal_range,
        critical_low: lab.critical_low,
        critical_high: lab.critical_high
      }));

      this.setCache(cacheKey, normalized);
      return normalized;
    } catch (error) {
      console.error('Failed to fetch lab tests from catalog:', error);
      return [];
    }
  }

  /**
   * Get vital sign references
   * Returns normalized structure for VitalSignConditionBuilder
   */
  async getVitalSigns(vitalType = null) {
    const cacheKey = `vital-signs:${vitalType}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const vitalSigns = await cdsClinicalDataService.getVitalSignReferences(vitalType);
      
      // Normalize for condition builder use
      const normalized = vitalSigns.map(vital => ({
        id: vital.id || vital.code,
        code: vital.code,
        display: vital.display || vital.name,
        system: vital.system || 'http://loinc.org',
        category: 'vital-signs',
        // Reference range information
        normal_ranges: vital.normal_ranges,
        unit: vital.unit,
        critical_low: vital.critical_low,
        critical_high: vital.critical_high
      }));

      this.setCache(cacheKey, normalized);
      return normalized;
    } catch (error) {
      console.error('Failed to fetch vital signs from catalog:', error);
      return [];
    }
  }

  /**
   * Search across all catalogs simultaneously
   * Returns categorized results for universal search
   */
  async searchAllCatalogs(query, limit = 10) {
    const cacheKey = `search-all:${query}:${limit}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const results = await cdsClinicalDataService.searchAllDynamicCatalogs(query, limit);
      
      // Normalize results by category
      const normalized = {
        medications: (results.medications || []).map(med => ({
          id: med.id || med.code,
          code: med.code,
          display: med.display || med.name,
          system: med.system || 'http://www.nlm.nih.gov/research/umls/rxnorm',
          category: 'medication',
          usage_count: med.usage_count || 0
        })),
        conditions: (results.conditions || []).map(condition => ({
          id: condition.id || condition.code,
          code: condition.code,
          display: condition.display || condition.name,
          system: condition.system || 'http://snomed.info/sct',
          category: 'condition',
          usage_count: condition.usage_count || 0
        })),
        lab_tests: (results.lab_tests || []).map(lab => ({
          id: lab.id || lab.code,
          code: lab.code,
          display: lab.display || lab.name,
          system: lab.system || 'http://loinc.org',
          category: 'laboratory',
          usage_count: lab.usage_count || 0,
          reference_range: lab.reference_range,
          unit: lab.unit
        }))
      };

      this.setCache(cacheKey, normalized);
      return normalized;
    } catch (error) {
      console.error('Failed to search all catalogs:', error);
      return { medications: [], conditions: [], lab_tests: [] };
    }
  }

  /**
   * Get available categories for a specific resource type
   */
  async getCategories(resourceType) {
    const cacheKey = `categories:${resourceType}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      let categories = [];
      
      switch (resourceType) {
        case 'lab_tests':
          categories = await cdsClinicalDataService.getLabCategories();
          break;
        case 'conditions':
          categories = await cdsClinicalDataService.getConditionCategories();
          break;
        default:
          categories = [];
      }

      this.setCache(cacheKey, categories);
      return categories;
    } catch (error) {
      console.error(`Failed to fetch categories for ${resourceType}:`, error);
      return [];
    }
  }

  /**
   * Validate a clinical code against the catalog
   * Returns validation status and normalized data
   */
  async validateClinicalCode(code, system, resourceType) {
    try {
      let results = [];
      
      switch (resourceType) {
        case 'medication':
          results = await this.getMedications(code, 10);
          break;
        case 'condition':
          results = await this.getConditions(code, null, 10);
          break;
        case 'lab_test':
          results = await this.getLabTests(code, null, 10);
          break;
        default:
          return { isValid: false, message: 'Unknown resource type' };
      }

      const match = results.find(item => 
        item.code === code && item.system === system
      );

      if (match) {
        return {
          isValid: true,
          data: match,
          message: 'Code found in catalog'
        };
      } else {
        return {
          isValid: false,
          message: 'Code not found in catalog',
          suggestions: results.slice(0, 3)
        };
      }
    } catch (error) {
      return {
        isValid: false,
        message: `Validation error: ${error.message}`
      };
    }
  }

  /**
   * Refresh catalog data
   */
  async refreshCatalogs() {
    try {
      await cdsClinicalDataService.refreshDynamicCatalogs();
      this.clearCache();
      return { success: true, message: 'Catalogs refreshed successfully' };
    } catch (error) {
      return { success: false, message: `Refresh failed: ${error.message}` };
    }
  }

  /**
   * Get catalog statistics
   */
  async getCatalogStats() {
    try {
      return await cdsClinicalDataService.getDynamicCatalogStatistics();
    } catch (error) {
      console.error('Failed to fetch catalog statistics:', error);
      return null;
    }
  }

  // Cache management methods
  getFromCache(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  clearCache() {
    this.cache.clear();
  }
}

// Export singleton instance
export const catalogIntegrationService = new CatalogIntegrationService();
export default catalogIntegrationService;