/**
 * FHIR Service
 * Handles all FHIR resource CRUD operations with the backend API
 */

class FHIRService {
  constructor() {
    this.baseUrl = '/fhir/R4';
  }

  /**
   * Create a new FHIR resource
   * @param {string} resourceType - The FHIR resource type (e.g., 'Condition', 'MedicationRequest')
   * @param {object} resource - The FHIR resource data
   * @returns {Promise<object>} The created resource
   */
  async createResource(resourceType, resource) {
    try {
      const response = await fetch(`${this.baseUrl}/${resourceType}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(resource),
      });

      if (!response.ok) {
        let errorMessage = `Failed to create ${resourceType}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorData.message || errorMessage;
        } catch (e) {
          // If error response is not JSON, use status text
          errorMessage = `${errorMessage}: ${response.statusText} (${response.status})`;
        }
        
        const error = new Error(errorMessage);
        error.status = response.status;
        throw error;
      }

      // Check if response has content before parsing JSON
      const contentLength = response.headers.get('content-length');
      if (contentLength === '0' || !response.headers.get('content-type')?.includes('application/json')) {
        // Return success object for empty responses
        const location = response.headers.get('location');
        const resourceId = location ? location.split('/').pop() : null;
        return { 
          success: true, 
          resourceType,
          id: resourceId,
          versionId: response.headers.get('etag')?.replace(/[W/"]*/g, ''),
          lastModified: response.headers.get('last-modified'),
          status: response.status
        };
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Error creating ${resourceType}:`, error);
      throw error;
    }
  }

  /**
   * Update an existing FHIR resource
   * @param {string} resourceType - The FHIR resource type
   * @param {string} resourceId - The resource ID
   * @param {object} resource - The updated FHIR resource data
   * @returns {Promise<object>} The updated resource
   */
  async updateResource(resourceType, resourceId, resource) {
    try {
      const response = await fetch(`${this.baseUrl}/${resourceType}/${resourceId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(resource),
      });

      if (!response.ok) {
        let errorMessage = `Failed to update ${resourceType}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorData.message || errorMessage;
        } catch (e) {
          // If error response is not JSON, use status text
          errorMessage = `${errorMessage}: ${response.statusText} (${response.status})`;
        }
        
        const error = new Error(errorMessage);
        error.status = response.status;
        throw error;
      }

      // Check if response has content before parsing JSON
      const contentLength = response.headers.get('content-length');
      if (contentLength === '0' || !response.headers.get('content-type')?.includes('application/json')) {
        // Return success object for empty responses
        return { 
          success: true, 
          resourceType,
          id: resourceId,
          versionId: response.headers.get('etag')?.replace(/[W/"]*/g, ''),
          lastModified: response.headers.get('last-modified')
        };
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Error updating ${resourceType}:`, error);
      throw error;
    }
  }

  /**
   * Delete a FHIR resource (soft delete where possible)
   * @param {string} resourceType - The FHIR resource type
   * @param {string} resourceId - The resource ID
   * @returns {Promise<void>}
   */
  async deleteResource(resourceType, resourceId) {
    try {
      const response = await fetch(`${this.baseUrl}/${resourceType}/${resourceId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        let errorMessage = `Failed to delete ${resourceType}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorData.message || errorMessage;
        } catch (e) {
          // If error response is not JSON, use status text
          errorMessage = `${errorMessage}: ${response.statusText} (${response.status})`;
        }
        
        const error = new Error(errorMessage);
        error.status = response.status;
        throw error;
      }

      return true;
    } catch (error) {
      console.error(`Error deleting ${resourceType}:`, error);
      throw error;
    }
  }

  /**
   * Get a specific FHIR resource by ID
   * @param {string} resourceType - The FHIR resource type
   * @param {string} resourceId - The resource ID
   * @returns {Promise<object>} The resource
   */
  async getResource(resourceType, resourceId) {
    try {
      const response = await fetch(`${this.baseUrl}/${resourceType}/${resourceId}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Failed to get ${resourceType}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Error getting ${resourceType}:`, error);
      throw error;
    }
  }

  /**
   * Search for FHIR resources
   * @param {string} resourceType - The FHIR resource type
   * @param {object} searchParams - Search parameters
   * @returns {Promise<object>} Bundle with search results
   */
  async searchResources(resourceType, searchParams = {}) {
    try {
      const params = new URLSearchParams(searchParams);
      const response = await fetch(`${this.baseUrl}/${resourceType}?${params}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Failed to search ${resourceType}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Error searching ${resourceType}:`, error);
      throw error;
    }
  }

  /**
   * Create a new Condition resource
   * @param {object} conditionData - Condition data
   * @returns {Promise<object>} The created condition
   */
  async createCondition(conditionData) {
    return this.createResource('Condition', conditionData);
  }

  /**
   * Update an existing Condition resource
   * @param {string} conditionId - Condition ID
   * @param {object} conditionData - Updated condition data
   * @returns {Promise<object>} The updated condition
   */
  async updateCondition(conditionId, conditionData) {
    return this.updateResource('Condition', conditionId, conditionData);
  }

  /**
   * Delete a Condition resource
   * @param {string} conditionId - Condition ID
   * @returns {Promise<void>}
   */
  async deleteCondition(conditionId) {
    return this.deleteResource('Condition', conditionId);
  }

  /**
   * Create a new MedicationRequest resource
   * @param {object} medicationData - MedicationRequest data
   * @returns {Promise<object>} The created medication request
   */
  async createMedicationRequest(medicationData) {
    return this.createResource('MedicationRequest', medicationData);
  }

  /**
   * Update an existing MedicationRequest resource
   * @param {string} medicationId - MedicationRequest ID
   * @param {object} medicationData - Updated medication data
   * @returns {Promise<object>} The updated medication request
   */
  async updateMedicationRequest(medicationId, medicationData) {
    return this.updateResource('MedicationRequest', medicationId, medicationData);
  }

  /**
   * Delete a MedicationRequest resource
   * @param {string} medicationId - MedicationRequest ID
   * @returns {Promise<void>}
   */
  async deleteMedicationRequest(medicationId) {
    return this.deleteResource('MedicationRequest', medicationId);
  }

  /**
   * Create a new AllergyIntolerance resource
   * @param {object} allergyData - AllergyIntolerance data
   * @returns {Promise<object>} The created allergy intolerance
   */
  async createAllergyIntolerance(allergyData) {
    return this.createResource('AllergyIntolerance', allergyData);
  }

  /**
   * Update an existing AllergyIntolerance resource
   * @param {string} allergyId - AllergyIntolerance ID
   * @param {object} allergyData - Updated allergy data
   * @returns {Promise<object>} The updated allergy intolerance
   */
  async updateAllergyIntolerance(allergyId, allergyData) {
    return this.updateResource('AllergyIntolerance', allergyId, allergyData);
  }

  /**
   * Delete an AllergyIntolerance resource
   * @param {string} allergyId - AllergyIntolerance ID
   * @returns {Promise<void>}
   */
  async deleteAllergyIntolerance(allergyId) {
    return this.deleteResource('AllergyIntolerance', allergyId);
  }

  /**
   * Refresh patient resources by invalidating cache (if using context cache)
   * @param {string} patientId - Patient ID
   * @returns {Promise<void>}
   */
  async refreshPatientResources(patientId) {
    // This would typically trigger a refresh in the FHIRResourceContext
    // For now, we'll just trigger a custom event that components can listen to
    const event = new CustomEvent('fhir-resources-updated', {
      detail: { patientId }
    });
    window.dispatchEvent(event);
  }
}

// Create and export a singleton instance
const fhirService = new FHIRService();
export default fhirService;