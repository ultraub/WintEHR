/**
 * FHIR Relationship Service
 * 
 * Service for discovering and analyzing relationships between FHIR resources
 * Uses the backend relationship discovery API for dynamic relationship mapping
 */

import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

class FHIRRelationshipService {
  constructor() {
    this.client = axios.create({
      baseURL: `${API_BASE_URL}/api/fhir-relationships`,
      headers: {
        'Content-Type': 'application/json',
      }
    });

    // Add auth token if available
    const token = localStorage.getItem('token');
    if (token) {
      this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
  }

  /**
   * Get the complete relationship schema
   * Returns all possible relationships between resource types
   */
  async getRelationshipSchema() {
    try {
      const response = await this.client.get('/schema');
      return response.data;
    } catch (error) {
      // Error logged internally
      throw error;
    }
  }

  /**
   * Discover actual relationships for a specific resource
   * @param {string} resourceType - The FHIR resource type
   * @param {string} resourceId - The resource ID
   * @param {Object} options - Discovery options
   * @returns {Object} Discovered relationships with nodes and links
   */
  async discoverRelationships(resourceType, resourceId, options = {}) {
    const { 
      depth = 2, 
      includeCounts = true 
    } = options;

    try {
      const response = await this.client.get(`/discover/${resourceType}/${resourceId}`, {
        params: { depth, include_counts: includeCounts }
      });
      return response.data;
    } catch (error) {
      // Error logged internally
      throw error;
    }
  }

  /**
   * Get relationship statistics
   * @param {string} resourceType - Optional filter by resource type
   * @returns {Object} Statistical information about relationships
   */
  async getRelationshipStatistics(resourceType = null) {
    try {
      const response = await this.client.get('/statistics', {
        params: resourceType ? { resource_type: resourceType } : {}
      });
      return response.data;
    } catch (error) {
      // Error logged internally
      throw error;
    }
  }

  /**
   * Find paths between two resources
   * @param {string} sourceType - Source resource type
   * @param {string} sourceId - Source resource ID
   * @param {string} targetType - Target resource type
   * @param {string} targetId - Target resource ID
   * @param {number} maxDepth - Maximum path depth
   * @returns {Object} All paths between the resources
   */
  async findRelationshipPaths(sourceType, sourceId, targetType, targetId, maxDepth = 3) {
    try {
      const response = await this.client.get('/paths', {
        params: {
          source_type: sourceType,
          source_id: sourceId,
          target_type: targetType,
          target_id: targetId,
          max_depth: maxDepth
        }
      });
      return response.data;
    } catch (error) {
      // Error logged internally
      throw error;
    }
  }

  /**
   * Transform backend relationship data to D3 format
   * @param {Object} relationshipData - Data from the backend API
   * @returns {Object} D3-compatible nodes and links
   */
  transformToD3Format(relationshipData) {
    const { nodes, links } = relationshipData;
    
    // Transform nodes
    const d3Nodes = nodes.map(node => ({
      id: node.id,
      resourceType: node.resourceType,
      display: node.display,
      depth: node.depth,
      group: this.getResourceGroup(node.resourceType)
    }));

    // Transform links
    const d3Links = links.map(link => ({
      source: link.source,
      target: link.target,
      field: link.field,
      type: link.type,
      value: 1 // Link strength
    }));

    return { nodes: d3Nodes, links: d3Links };
  }

  /**
   * Get resource group for visualization
   * Groups resources by clinical category
   */
  getResourceGroup(resourceType) {
    const groups = {
      administrative: ['Patient', 'Practitioner', 'Organization', 'Location', 'PractitionerRole'],
      clinical: ['Condition', 'Observation', 'Procedure', 'DiagnosticReport', 'CarePlan'],
      medications: ['MedicationRequest', 'MedicationDispense', 'MedicationAdministration', 'Medication'],
      workflow: ['Encounter', 'EpisodeOfCare', 'ServiceRequest', 'Task', 'Appointment'],
      documents: ['DocumentReference', 'Communication', 'Composition'],
      financial: ['Coverage', 'Claim', 'ExplanationOfBenefit', 'Invoice'],
      other: []
    };

    for (const [group, types] of Object.entries(groups)) {
      if (types.includes(resourceType)) {
        return group;
      }
    }
    return 'other';
  }

  /**
   * Get color for resource type
   * Returns consistent colors for visualization
   */
  getResourceColor(resourceType) {
    const colorMap = {
      // Administrative
      'Patient': '#1976d2',
      'Practitioner': '#2e7d32',
      'Organization': '#ed6c02',
      'Location': '#0288d1',
      'PractitionerRole': '#388e3c',
      
      // Clinical
      'Condition': '#d32f2f',
      'Observation': '#4caf50',
      'Procedure': '#9c27b0',
      'DiagnosticReport': '#7b1fa2',
      'CarePlan': '#00796b',
      
      // Medications
      'MedicationRequest': '#f57c00',
      'MedicationDispense': '#ff9800',
      'MedicationAdministration': '#ffa726',
      'Medication': '#ffb74d',
      
      // Workflow
      'Encounter': '#5e35b1',
      'ServiceRequest': '#673ab7',
      'Task': '#7e57c2',
      'Appointment': '#9575cd',
      
      // Documents
      'DocumentReference': '#546e7a',
      'Communication': '#607d8b',
      'Composition': '#78909c',
      
      // Financial
      'Coverage': '#6d4c41',
      'Claim': '#795548',
      'ExplanationOfBenefit': '#8d6e63',
      
      // Default
      'default': '#9e9e9e'
    };

    return colorMap[resourceType] || colorMap.default;
  }

  /**
   * Get icon for resource type
   * Returns Material-UI icon name
   */
  getResourceIcon(resourceType) {
    const iconMap = {
      'Patient': 'Person',
      'Practitioner': 'LocalHospital',
      'Organization': 'Business',
      'Location': 'Place',
      'Condition': 'Healing',
      'Observation': 'Science',
      'Procedure': 'MedicalServices',
      'DiagnosticReport': 'Assessment',
      'MedicationRequest': 'Medication',
      'Encounter': 'Event',
      'ServiceRequest': 'Assignment',
      'DocumentReference': 'Description',
      'Coverage': 'HealthAndSafety',
      'default': 'Category'
    };

    return iconMap[resourceType] || iconMap.default;
  }

  /**
   * Build relationship summary
   * Summarizes the relationships for display
   */
  buildRelationshipSummary(relationshipData) {
    const summary = {
      totalNodes: relationshipData.nodes.length,
      totalLinks: relationshipData.links.length,
      resourceTypes: {},
      relationshipTypes: {},
      maxDepth: 0
    };

    // Count resource types
    relationshipData.nodes.forEach(node => {
      summary.resourceTypes[node.resourceType] = 
        (summary.resourceTypes[node.resourceType] || 0) + 1;
      summary.maxDepth = Math.max(summary.maxDepth, node.depth);
    });

    // Count relationship types
    relationshipData.links.forEach(link => {
      const key = `${link.field} (${link.type})`;
      summary.relationshipTypes[key] = 
        (summary.relationshipTypes[key] || 0) + 1;
    });

    return summary;
  }
}

// Export singleton instance
export const fhirRelationshipService = new FHIRRelationshipService();

// Also export class for testing
export default FHIRRelationshipService;