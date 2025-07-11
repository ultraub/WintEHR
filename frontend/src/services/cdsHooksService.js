/**
 * CDS Hooks Service
 * Handles CRUD operations for custom CDS hooks
 */
import axios from 'axios';

class CDSHooksService {
  constructor() {
    this.baseUrl = '/cds-hooks';
  }

  /**
   * Transform frontend hook data to backend HookConfiguration format
   */
  transformToBackendFormat(hookData) {
    // Transform frontend cards to backend actions
    const actions = hookData.cards.map(card => ({
      type: 'show-card',
      parameters: {
        summary: card.summary,
        detail: card.detail,
        indicator: card.indicator,
        source: { label: hookData.title },
        suggestions: card.suggestions || [],
        links: card.links || []
      }
    }));

    // Transform frontend conditions to backend conditions
    const conditions = hookData.conditions.map(condition => ({
      type: this.mapConditionType(condition.type),
      parameters: this.buildConditionParameters(condition)
    }));

    // Build the backend configuration
    const backendConfig = {
      id: hookData.id,
      hook: hookData.hook, // Will be mapped to enum value
      title: hookData.title,
      description: hookData.description,
      enabled: hookData.enabled,
      conditions: conditions,
      actions: actions,
      prefetch: hookData.prefetch || {},
      usageRequirements: null
    };

    return backendConfig;
  }

  /**
   * Transform backend HookConfiguration to frontend format
   */
  transformToFrontendFormat(backendConfig) {
    // Transform backend actions to frontend cards
    const cards = backendConfig.actions.map((action, index) => ({
      id: Date.now() + index,
      summary: action.parameters.summary || '',
      detail: action.parameters.detail || '',
      indicator: action.parameters.indicator || 'info',
      suggestions: action.parameters.suggestions || [],
      links: action.parameters.links || []
    }));

    // Transform backend conditions to frontend conditions
    const conditions = backendConfig.conditions.map((condition, index) => ({
      id: Date.now() + index,
      type: this.mapBackendConditionType(condition.type),
      operator: condition.parameters.operator || 'equals',
      value: condition.parameters.value || '',
      enabled: true
    }));

    return {
      id: backendConfig.id,
      title: backendConfig.title,
      description: backendConfig.description,
      hook: backendConfig.hook,
      enabled: backendConfig.enabled,
      conditions: conditions,
      cards: cards,
      prefetch: backendConfig.prefetch || {}
    };
  }

  /**
   * Map frontend condition types to backend types
   */
  mapConditionType(frontendType) {
    const typeMap = {
      'age': 'patient-age',
      'gender': 'patient-gender',
      'condition': 'diagnosis-code',
      'medication': 'medication-active',
      'lab_value': 'lab-value',
      'vital_sign': 'vital-sign'
    };
    return typeMap[frontendType] || frontendType;
  }

  /**
   * Map backend condition types to frontend types
   */
  mapBackendConditionType(backendType) {
    const typeMap = {
      'patient-age': 'age',
      'patient-gender': 'gender',
      'diagnosis-code': 'condition',
      'medication-active': 'medication',
      'lab-value': 'lab_value',
      'vital-sign': 'vital_sign'
    };
    return typeMap[backendType] || backendType;
  }

  /**
   * Build condition parameters from frontend condition
   */
  buildConditionParameters(condition) {
    const parameters = {
      operator: condition.operator,
      value: condition.value
    };

    // Add type-specific parameters
    if (condition.type === 'age') {
      // Convert operator for age conditions
      if (condition.operator === 'greater_than') {
        parameters.operator = '>=';
      } else if (condition.operator === 'less_than') {
        parameters.operator = '<=';
      } else if (condition.operator === 'equals') {
        parameters.operator = '==';
      }
    } else if (condition.type === 'lab_value') {
      // Lab value specific parameters
      parameters.code = condition.labTest;
      parameters.labTest = condition.labTest; // For backward compatibility
      if (condition.value2) {
        parameters.value2 = condition.value2;
      }
      if (condition.timeframe) {
        parameters.timeframe = condition.timeframe;
      }
      if (condition.trendMinResults) {
        parameters.trendMinResults = condition.trendMinResults;
      }
      // Map frontend operators to backend format
      const operatorMap = {
        'gt': 'gt',
        'gte': 'ge',
        'lt': 'lt',
        'lte': 'le',
        'eq': 'eq',
        'between': 'between',
        'not_between': 'not_between',
        'abnormal': 'abnormal',
        'critical': 'critical',
        'trending_up': 'trending_up',
        'trending_down': 'trending_down',
        'missing': 'missing'
      };
      parameters.operator = operatorMap[condition.operator] || condition.operator;
    } else if (condition.type === 'vital_sign') {
      // Vital sign specific parameters
      parameters.type = condition.vitalType;
      if (condition.component) {
        parameters.component = condition.component;
      }
      if (condition.timeframe) {
        parameters.timeframe = condition.timeframe;
      }
    } else if (condition.type === 'condition') {
      // Medical condition specific parameters
      if (condition.codes) {
        parameters.codes = condition.codes;
      }
      if (condition.system) {
        parameters.system = condition.system;
      }
    }

    return parameters;
  }

  /**
   * Validate hook data before sending to backend
   */
  validateHookData(hookData) {
    const errors = [];

    if (!hookData.id || !hookData.id.trim()) {
      errors.push('Hook ID is required');
    }

    if (!hookData.title || !hookData.title.trim()) {
      errors.push('Hook title is required');
    }

    if (!hookData.hook) {
      errors.push('Hook type is required');
    }

    if (!hookData.cards || hookData.cards.length === 0) {
      errors.push('At least one card must be defined');
    }

    // Validate cards
    hookData.cards.forEach((card, index) => {
      if (!card.summary || !card.summary.trim()) {
        errors.push(`Card ${index + 1}: Summary is required`);
      }
    });

    // Validate conditions
    hookData.conditions.forEach((condition, index) => {
      if (!condition.type) {
        errors.push(`Condition ${index + 1}: Type is required`);
      }
      if (!condition.operator) {
        errors.push(`Condition ${index + 1}: Operator is required`);
      }
      if (condition.value === '' || condition.value === null || condition.value === undefined) {
        errors.push(`Condition ${index + 1}: Value is required`);
      }
    });

    return errors;
  }

  /**
   * Create a new CDS hook
   */
  async createHook(hookData) {
    try {
      // Validate the hook data
      const validationErrors = this.validateHookData(hookData);
      if (validationErrors.length > 0) {
        throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
      }

      // Transform to backend format
      const backendConfig = this.transformToBackendFormat(hookData);

      // Send to backend
      const response = await axios.post(`${this.baseUrl}/hooks`, backendConfig);
      
      return {
        success: true,
        data: response.data,
        message: 'Hook created successfully'
      };
    } catch (error) {
      
      
      if (error.response?.status === 409) {
        throw new Error('Hook ID already exists. Please choose a different ID.');
      } else if (error.response?.status === 400) {
        throw new Error(`Invalid hook data: ${error.response.data?.detail || error.message}`);
      } else {
        throw new Error(`Failed to create hook: ${error.message}`);
      }
    }
  }

  /**
   * Update an existing CDS hook
   */
  async updateHook(hookId, hookData) {
    try {
      // Validate the hook data
      const validationErrors = this.validateHookData(hookData);
      if (validationErrors.length > 0) {
        throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
      }

      // Ensure ID matches
      hookData.id = hookId;

      // Transform to backend format
      const backendConfig = this.transformToBackendFormat(hookData);

      // Send to backend
      const response = await axios.put(`${this.baseUrl}/hooks/${hookId}`, backendConfig);
      
      return {
        success: true,
        data: response.data,
        message: 'Hook updated successfully'
      };
    } catch (error) {
      
      
      if (error.response?.status === 404) {
        throw new Error('Hook not found');
      } else if (error.response?.status === 400) {
        throw new Error(`Invalid hook data: ${error.response.data?.detail || error.message}`);
      } else {
        throw new Error(`Failed to update hook: ${error.message}`);
      }
    }
  }

  /**
   * Delete a CDS hook
   */
  async deleteHook(hookId) {
    try {
      await axios.delete(`${this.baseUrl}/hooks/${hookId}`);
      
      return {
        success: true,
        message: 'Hook deleted successfully'
      };
    } catch (error) {
      
      
      if (error.response?.status === 404) {
        throw new Error('Hook not found');
      } else {
        throw new Error(`Failed to delete hook: ${error.message}`);
      }
    }
  }

  /**
   * Get a specific CDS hook
   */
  async getHook(hookId) {
    try {
      const response = await axios.get(`${this.baseUrl}/hooks/${hookId}`);
      
      // Transform to frontend format
      const frontendHook = this.transformToFrontendFormat(response.data);
      
      return {
        success: true,
        data: frontendHook
      };
    } catch (error) {
      
      
      if (error.response?.status === 404) {
        throw new Error('Hook not found');
      } else {
        throw new Error(`Failed to get hook: ${error.message}`);
      }
    }
  }

  /**
   * List all custom CDS hooks
   */
  async listCustomHooks() {
    try {
      const response = await axios.get(`${this.baseUrl}/hooks`);
      
      // Transform each hook to frontend format
      const frontendHooks = response.data.map(hook => this.transformToFrontendFormat(hook));
      
      return {
        success: true,
        data: frontendHooks
      };
    } catch (error) {
      
      throw new Error(`Failed to list hooks: ${error.message}`);
    }
  }

  /**
   * Test a hook with sample data
   */
  async testHook(hookData, testContext = {}) {
    try {
      // Transform to backend format
      const backendConfig = this.transformToBackendFormat(hookData);

      // Create test request
      const testRequest = {
        hook: hookData.hook,
        hookInstance: `test-${Date.now()}`,
        context: {
          patientId: testContext.patientId || 'test-patient-123',
          userId: testContext.userId || 'test-user-456',
          ...testContext
        }
      };

      // For now, simulate a test by calling the hook execution endpoint
      // In a real implementation, this would be a dedicated test endpoint
      const response = await axios.post(`${this.baseUrl}/cds-services/${backendConfig.id}`, testRequest);
      
      return {
        success: true,
        data: response.data,
        message: 'Hook tested successfully'
      };
    } catch (error) {
      
      return {
        success: false,
        error: error.message,
        message: 'Hook test failed'
      };
    }
  }
}

// Export singleton instance
export const cdsHooksService = new CDSHooksService();

// Also export class for custom instances
export default CDSHooksService;