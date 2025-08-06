/**
 * FHIR Schema Service
 * Provides access to FHIR R4 resource schemas and definitions
 * Uses capability statement to discover supported resources
 */

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

class FHIRSchemaService {
  constructor() {
    this.schemaCache = new Map();
    this.resourceListCache = null;
    this.capabilityStatementCache = null;
    this.cacheExpiry = 30 * 60 * 1000; // 30 minutes
    this.useCapabilityStatement = true; // Flag to use new approach
  }

  /**
   * Get the capability statement
   */
  async getCapabilityStatement() {
    if (this.capabilityStatementCache && this.capabilityStatementCache.timestamp > Date.now() - this.cacheExpiry) {
      return this.capabilityStatementCache.data;
    }

    try {
      const response = await fetch(`${API_BASE}/api/fhir-schemas-v2/capability-statement`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const data = await response.json();
      this.capabilityStatementCache = {
        data,
        timestamp: Date.now()
      };
      
      return data;
    } catch (error) {
      console.error('Error fetching capability statement:', error);
      // Fall back to direct metadata endpoint
      try {
        const response = await fetch(`${API_BASE}/fhir/R4/metadata`);
        if (response.ok) {
          const data = await response.json();
          this.capabilityStatementCache = {
            data,
            timestamp: Date.now()
          };
          return data;
        }
      } catch (e) {
        console.error('Error fetching metadata directly:', e);
      }
      throw error;
    }
  }

  /**
   * Get list of all available FHIR resource types
   */
  async getResourceTypes() {
    if (this.resourceListCache && this.resourceListCache.timestamp > Date.now() - this.cacheExpiry) {
      return this.resourceListCache.data;
    }

    try {
      // Try new capability-based endpoint first
      if (this.useCapabilityStatement) {
        const response = await fetch(`${API_BASE}/api/fhir-schemas-v2/resources`);
        if (response.ok) {
          const data = await response.json();
          this.resourceListCache = {
            data,
            timestamp: Date.now()
          };
          return data;
        }
      }
      
      // Fall back to original endpoint
      const response = await fetch(`${API_BASE}/api/fhir-schemas/resources`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const data = await response.json();
      this.resourceListCache = {
        data,
        timestamp: Date.now()
      };
      
      return data;
    } catch (error) {
      console.error('Error fetching resource types:', error);
      throw error;
    }
  }

  /**
   * Get simplified schema for a specific resource type
   */
  async getResourceSchema(resourceType) {
    const cacheKey = `schema_${resourceType}`;
    const cached = this.schemaCache.get(cacheKey);
    
    if (cached && cached.timestamp > Date.now() - this.cacheExpiry) {
      return cached.data;
    }

    try {
      // Try new capability-based endpoint first
      if (this.useCapabilityStatement) {
        const response = await fetch(`${API_BASE}/api/fhir-schemas-v2/resource/${resourceType}`);
        if (response.ok) {
          const data = await response.json();
          this.schemaCache.set(cacheKey, {
            data,
            timestamp: Date.now()
          });
          return data;
        }
      }
      
      // Fall back to original endpoint
      const response = await fetch(`${API_BASE}/api/fhir-schemas/resource/${resourceType}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const data = await response.json();
      this.schemaCache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });
      
      return data;
    } catch (error) {
      console.error(`Error fetching schema for ${resourceType}:`, error);
      throw error;
    }
  }

  /**
   * Get full StructureDefinition for a resource type
   */
  async getFullResourceSchema(resourceType) {
    const cacheKey = `full_${resourceType}`;
    const cached = this.schemaCache.get(cacheKey);
    
    if (cached && cached.timestamp > Date.now() - this.cacheExpiry) {
      return cached.data;
    }

    try {
      const response = await fetch(`${API_BASE}/api/fhir-schemas/resource/${resourceType}/full`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const data = await response.json();
      this.schemaCache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });
      
      return data;
    } catch (error) {
      console.error(`Error fetching full schema for ${resourceType}:`, error);
      throw error;
    }
  }

  /**
   * Search across all resource schemas
   */
  async searchSchemas(query, limit = 20) {
    try {
      const response = await fetch(
        `${API_BASE}/api/fhir-schemas/search?q=${encodeURIComponent(query)}&limit=${limit}`
      );
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      return await response.json();
    } catch (error) {
      console.error('Error searching schemas:', error);
      throw error;
    }
  }

  /**
   * Get all FHIR data types with descriptions
   */
  async getElementTypes() {
    const cacheKey = 'element_types';
    const cached = this.schemaCache.get(cacheKey);
    
    if (cached && cached.timestamp > Date.now() - this.cacheExpiry) {
      return cached.data;
    }

    try {
      const response = await fetch(`${API_BASE}/api/fhir-schemas/element-types`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const data = await response.json();
      this.schemaCache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });
      
      return data;
    } catch (error) {
      console.error('Error fetching element types:', error);
      // Return empty object on error to prevent UI crashes
      return {};
    }
  }

  /**
   * Get statistics about available schemas
   */
  async getSchemaStats() {
    try {
      // Try v2 endpoint first
      if (this.useCapabilityStatement) {
        const response = await fetch(`${API_BASE}/api/fhir-schemas-v2/stats`);
        if (response.ok) {
          return await response.json();
        }
      }
      
      // Fall back to v1 endpoint
      const response = await fetch(`${API_BASE}/api/fhir-schemas/stats`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching schema stats:', error);
      // Return default stats on error
      return {
        totalResources: 0,
        categories: {
          clinical: 0,
          administrative: 0,
          financial: 0,
          workflow: 0,
          infrastructure: 0
        }
      };
    }
  }

  /**
   * Get resource interactions and capabilities
   */
  async getResourceInteractions(resourceType) {
    const cacheKey = `interactions_${resourceType}`;
    const cached = this.schemaCache.get(cacheKey);
    
    if (cached && cached.timestamp > Date.now() - this.cacheExpiry) {
      return cached.data;
    }

    try {
      const response = await fetch(`${API_BASE}/api/fhir-schemas-v2/resource/${resourceType}/interactions`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const data = await response.json();
      this.schemaCache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });
      
      return data;
    } catch (error) {
      console.error(`Error fetching interactions for ${resourceType}:`, error);
      throw error;
    }
  }

  /**
   * Get search parameters for a resource type
   */
  async getSearchParameters(resourceType) {
    const cacheKey = `search_params_${resourceType}`;
    const cached = this.schemaCache.get(cacheKey);
    
    if (cached && cached.timestamp > Date.now() - this.cacheExpiry) {
      return cached.data;
    }

    try {
      const response = await fetch(`${API_BASE}/api/fhir-schemas-v2/search-parameters/${resourceType}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const data = await response.json();
      this.schemaCache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });
      
      return data;
    } catch (error) {
      console.error(`Error fetching search parameters for ${resourceType}:`, error);
      throw error;
    }
  }

  /**
   * Clear the cache
   */
  clearCache() {
    this.schemaCache.clear();
    this.resourceListCache = null;
    this.capabilityStatementCache = null;
    console.log('FHIRSchemaService cache cleared');
  }
  
  /**
   * Force refresh a specific resource schema
   */
  async refreshResourceSchema(resourceType) {
    const cacheKey = `schema_${resourceType}`;
    this.schemaCache.delete(cacheKey);
    return this.getResourceSchema(resourceType);
  }

  /**
   * Get schema for multiple resources at once
   */
  async getMultipleSchemas(resourceTypes) {
    const promises = resourceTypes.map(type => this.getResourceSchema(type));
    return Promise.all(promises);
  }

  /**
   * Extract element paths from a schema
   */
  extractElementPaths(schema) {
    const paths = [];
    
    function traverse(elements, prefix = '') {
      for (const [key, element] of Object.entries(elements)) {
        const path = prefix ? `${prefix}.${key}` : key;
        paths.push({
          path,
          type: element.type,
          required: element.required,
          array: element.array,
          description: element.description
        });
        
        if (element.elements) {
          traverse(element.elements, path);
        }
      }
    }
    
    if (schema.elements) {
      traverse(schema.elements, schema.resourceType);
    }
    
    return paths;
  }

  /**
   * Validate a resource against its schema
   */
  validateResource(resource, schema) {
    const errors = [];
    
    // Check resource type
    if (resource.resourceType !== schema.resourceType) {
      errors.push({
        path: 'resourceType',
        message: `Expected resourceType '${schema.resourceType}', got '${resource.resourceType}'`
      });
    }
    
    // Check required fields
    for (const [key, element] of Object.entries(schema.elements || {})) {
      if (element.required && !(key in resource)) {
        errors.push({
          path: key,
          message: `Required field '${key}' is missing`
        });
      }
      
      // Check array fields
      if (key in resource && element.array && !Array.isArray(resource[key])) {
        errors.push({
          path: key,
          message: `Field '${key}' should be an array`
        });
      }
      
      // Check fixed values
      if (element.fixed && resource[key] !== element.fixed) {
        errors.push({
          path: key,
          message: `Field '${key}' must have fixed value '${element.fixed}'`
        });
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Export singleton instance
export const fhirSchemaService = new FHIRSchemaService();