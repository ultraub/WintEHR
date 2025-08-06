/**
 * CDS Service Editor Client
 * Handles communication with the service executor backend
 */

import axios from 'axios';

class CDSServiceEditorClient {
  constructor() {
    this.baseUrl = process.env.REACT_APP_API_URL || 
                   (process.env.NODE_ENV === 'development' ? 'http://localhost:8000' : '');
    
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000, // 30 second timeout for execution
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    // Add auth interceptor
    this.httpClient.interceptors.request.use((config) => {
      const token = localStorage.getItem('authToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  /**
   * Execute CDS service code in sandbox
   * @param {string} code - Service code to execute
   * @param {object} request - CDS Hook request to test with
   * @param {number} timeout - Execution timeout in seconds
   * @param {boolean} debug - Enable debug mode
   */
  async executeService(code, request, timeout = 10, debug = false) {
    try {
      const response = await this.httpClient.post('/cds-services/executor/execute', {
        code,
        request,
        timeout,
        debug
      });

      return response.data;
    } catch (error) {
      console.error('Service execution failed:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Validate service code without executing
   * @param {string} code - Service code to validate
   */
  async validateCode(code) {
    try {
      const response = await this.httpClient.post('/cds-services/executor/validate', { code });
      return response.data;
    } catch (error) {
      console.error('Code validation failed:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Test service with specific hook and data
   * @param {string} code - Service code
   * @param {string} hook - Hook type
   * @param {object} context - Hook context
   * @param {object} prefetch - Prefetch data
   */
  async testService(code, hook, context, prefetch = null) {
    try {
      const response = await this.httpClient.post('/cds-services/executor/test', {
        code,
        hook,
        context,
        prefetch
      });

      return response.data;
    } catch (error) {
      console.error('Service test failed:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Get sandbox environment status
   */
  async getSandboxStatus() {
    try {
      const response = await this.httpClient.get('/cds-services/executor/sandbox/status');
      return response.data;
    } catch (error) {
      console.error('Failed to get sandbox status:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Save service code to backend
   * @param {string} serviceId - Service ID
   * @param {object} serviceData - Service data including code and metadata
   */
  async saveService(serviceId, serviceData) {
    try {
      // Check if service exists
      let response;
      try {
        await this.httpClient.get(`/cds-services/services/${serviceId}`);
        // Service exists, update it
        response = await this.httpClient.put(`/cds-services/services/${serviceId}`, serviceData);
      } catch (e) {
        if (e.response?.status === 404) {
          // Service doesn't exist, create it
          response = await this.httpClient.post('/cds-services/services', {
            ...serviceData,
            id: serviceId
          });
        } else {
          throw e;
        }
      }

      return response.data;
    } catch (error) {
      console.error('Failed to save service:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Load service code from backend
   * @param {string} serviceId - Service ID
   */
  async loadService(serviceId) {
    try {
      const response = await this.httpClient.get(`/cds-services/services/${serviceId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to load service:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Get all available services
   */
  async listServices() {
    try {
      const response = await this.httpClient.get('/cds-services/services');
      return response.data;
    } catch (error) {
      console.error('Failed to list services:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Export service as JSON
   * @param {object} service - Service object with code and metadata
   */
  exportService(service) {
    const exportData = {
      version: '2.0',
      exported: new Date().toISOString(),
      service: {
        metadata: service.metadata,
        code: service.code
      }
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
      type: 'application/json' 
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cds-service-${service.metadata.id || 'export'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Import service from JSON file
   * @param {File} file - JSON file to import
   */
  async importService(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          
          // Validate import format
          if (!data.service || !data.service.code || !data.service.metadata) {
            throw new Error('Invalid service file format');
          }

          resolve(data.service);
        } catch (error) {
          reject(new Error(`Failed to parse service file: ${error.message}`));
        }
      };

      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };

      reader.readAsText(file);
    });
  }

  /**
   * Handle API errors
   */
  handleError(error) {
    if (error.response) {
      // Server responded with error
      const message = error.response.data?.detail || error.response.data?.message || 'Server error';
      return new Error(message);
    } else if (error.request) {
      // No response received
      return new Error('No response from server. Please check your connection.');
    } else {
      // Request setup error
      return new Error(error.message || 'Request failed');
    }
  }
}

// Export singleton instance
export const cdsServiceEditorClient = new CDSServiceEditorClient();

// Also export class for testing
export default CDSServiceEditorClient;