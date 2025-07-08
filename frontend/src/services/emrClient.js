/**
 * EMR Client Service
 * 
 * Handles EMR-specific functionality that extends beyond FHIR.
 * Optional - degrades gracefully if EMR backend is not available.
 */

import axios from 'axios';

class EMRClient {
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || process.env.REACT_APP_EMR_API || '/api/emr';
    this.enabled = config.enabled !== false && process.env.REACT_APP_EMR_FEATURES !== 'false';
    // Disable EMR features by default if not explicitly enabled
    if (process.env.REACT_APP_EMR_FEATURES === undefined) {
      this.enabled = false;
    }
    this.auth = config.auth || null;
    this.capabilities = {
      auth: false,
      workflow: false,
      uiState: false,
      clinicalTools: false,
      auditLogs: false
    };

    if (this.enabled) {
      this.httpClient = axios.create({
        baseURL: this.baseUrl,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      // Add auth interceptor
      this.httpClient.interceptors.request.use(config => {
        const token = this.auth?.token || localStorage.getItem('emr_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      });

      // Add response interceptor for auth errors
      this.httpClient.interceptors.response.use(
        response => response,
        error => {
          if (error.response?.status === 401) {
            // Token expired or invalid
            this.handleAuthError();
          }
          return Promise.reject(error);
        }
      );

      // Discover capabilities
      this.discoverCapabilities();
    }
  }

  /**
   * Discover EMR capabilities
   */
  async discoverCapabilities() {
    if (!this.enabled) return;

    try {
      const response = await this.httpClient.get('/');
      const info = response.data;
      
      // Update capabilities based on response
      this.capabilities = {
        auth: !!info.endpoints?.auth,
        workflow: !!info.endpoints?.workflow,
        uiState: !!info.endpoints?.ui,
        clinicalTools: !!info.endpoints?.clinical,
        auditLogs: info.features?.includes('Audit logging')
      };

      
    } catch (error) {
      
      this.enabled = false;
    }
  }

  /**
   * Check if a feature is available
   */
  hasFeature(feature) {
    return this.enabled && this.capabilities[feature];
  }

  /**
   * Handle authentication error
   */
  handleAuthError() {
    localStorage.removeItem('emr_token');
    // Emit event for app to handle
    window.dispatchEvent(new CustomEvent('emr:auth:expired'));
  }

  /**
   * Authentication methods
   */
  async login(username, password) {
    if (!this.hasFeature('auth')) {
      throw new Error('Authentication not available');
    }

    const response = await this.httpClient.post('/auth/login', {
      username,
      password
    });

    const { token, user } = response.data;
    
    // Store token
    localStorage.setItem('emr_token', token);
    this.auth = { token, user };

    return { token, user };
  }

  async logout() {
    if (!this.hasFeature('auth')) return;

    try {
      await this.httpClient.post('/auth/logout');
    } finally {
      localStorage.removeItem('emr_token');
      this.auth = null;
    }
  }

  async getCurrentUser() {
    if (!this.hasFeature('auth')) return null;

    const response = await this.httpClient.get('/auth/me');
    return response.data;
  }

  async updatePreferences(preferences) {
    if (!this.hasFeature('auth')) return;

    const response = await this.httpClient.put('/auth/me/preferences', preferences);
    return response.data;
  }

  /**
   * Workflow methods
   */
  async getWorkflows(type = null, activeOnly = true) {
    if (!this.hasFeature('workflow')) return { workflows: [] };

    const response = await this.httpClient.get('/workflow/workflows', {
      params: { type, activeOnly }
    });
    return response.data;
  }

  async instantiateWorkflow(workflowId, context) {
    if (!this.hasFeature('workflow')) {
      throw new Error('Workflow management not available');
    }

    const response = await this.httpClient.post(
      `/workflow/workflows/${workflowId}/instantiate`,
      context
    );
    return response.data;
  }

  async getMyTasks(status = null, priority = null) {
    if (!this.hasFeature('workflow')) return { tasks: [] };

    const response = await this.httpClient.get('/workflow/tasks/my-tasks', {
      params: { status, priority }
    });
    return response.data;
  }

  async assignTask(taskFhirId, userId) {
    if (!this.hasFeature('workflow')) {
      throw new Error('Task assignment not available');
    }

    const response = await this.httpClient.put(
      `/workflow/tasks/${taskFhirId}/assign`,
      { userId }
    );
    return response.data;
  }

  /**
   * UI State methods
   */
  async getUIState(context) {
    if (!this.hasFeature('uiState')) {
      // Return default state
      return { state: this.getDefaultUIState(context) };
    }

    const response = await this.httpClient.get(`/ui/state/${context}`);
    return response.data;
  }

  async saveUIState(context, state) {
    if (!this.hasFeature('uiState')) {
      // Store locally
      localStorage.setItem(`ui_state_${context}`, JSON.stringify(state));
      return { message: 'Saved locally' };
    }

    const response = await this.httpClient.put(`/ui/state/${context}`, state);
    return response.data;
  }

  getDefaultUIState(context) {
    // Check local storage first
    const localState = localStorage.getItem(`ui_state_${context}`);
    if (localState) {
      try {
        return JSON.parse(localState);
      } catch (e) {
        // Invalid JSON, ignore
      }
    }

    // Return context-specific defaults
    const defaults = {
      'patient-list': {
        columns: ['name', 'mrn', 'dob', 'provider'],
        sortBy: 'name',
        pageSize: 20
      },
      'patient-chart': {
        layout: 'tabbed',
        activeTab: 'summary'
      },
      'clinical-canvas': {
        theme: 'light',
        aiAssistance: true
      }
    };

    return defaults[context] || {};
  }

  /**
   * Clinical Tools methods
   */
  async generateNoteAssistance(context) {
    if (!this.hasFeature('clinicalTools')) {
      // Return basic template
      return this.getBasicNoteTemplate(context.noteType);
    }

    const response = await this.httpClient.post('/clinical/note-assist', context);
    return response.data;
  }

  async getOrderRecommendations(context) {
    if (!this.hasFeature('clinicalTools')) {
      return { recommendations: [] };
    }

    const response = await this.httpClient.post('/clinical/order-recommendations', context);
    return response.data;
  }

  async calculateRiskScore(scoreType, parameters) {
    if (!this.hasFeature('clinicalTools')) {
      // Could implement basic calculations client-side
      return { error: 'Risk calculations not available' };
    }

    const response = await this.httpClient.post('/clinical/risk-scores/calculate', {
      scoreType,
      parameters
    });
    return response.data;
  }

  async checkDrugInteractions(medications) {
    if (!this.hasFeature('clinicalTools')) {
      return { interactions: [] };
    }

    const response = await this.httpClient.post('/clinical/drug-interactions/check', medications);
    return response.data;
  }

  async getClinicalReminders(patientId) {
    if (!this.hasFeature('clinicalTools')) {
      return { reminders: [] };
    }

    const response = await this.httpClient.get(`/clinical/clinical-reminders/${patientId}`);
    return response.data;
  }

  /**
   * Audit Log methods
   */
  async getAuditLogs(filters = {}) {
    if (!this.hasFeature('auditLogs')) {
      return { logs: [] };
    }

    const response = await this.httpClient.get('/audit-logs', { params: filters });
    return response.data;
  }

  /**
   * Clinical Canvas methods
   */
  async generateClinicalUI(prompt, context) {
    // Clinical Canvas is a separate service
    const response = await axios.post('/api/clinical-canvas/generate', {
      prompt,
      context,
      fhirBaseUrl: process.env.REACT_APP_FHIR_ENDPOINT
    });
    return response.data;
  }

  async enhanceClinicalUI(currentUi, enhancement, context) {
    const response = await axios.post('/api/clinical-canvas/enhance', {
      currentUi,
      enhancement,
      context
    });
    return response.data;
  }

  /**
   * Helper methods
   */
  getBasicNoteTemplate(noteType) {
    const templates = {
      progress: {
        sections: [
          { title: 'Chief Complaint', content: '' },
          { title: 'History of Present Illness', content: '' },
          { title: 'Physical Examination', content: '' },
          { title: 'Assessment and Plan', content: '' }
        ]
      },
      consultation: {
        sections: [
          { title: 'Reason for Consultation', content: '' },
          { title: 'History', content: '' },
          { title: 'Examination', content: '' },
          { title: 'Recommendations', content: '' }
        ]
      }
    };

    return {
      noteType,
      template: templates[noteType] || templates.progress
    };
  }
}

// Export singleton instance
export const emrClient = new EMRClient();

// Also export class
export default EMRClient;