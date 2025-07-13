/**
 * CDS Hooks Service
 * Handles CRUD operations for custom CDS hooks
 */
import axios from 'axios';

class CDSHooksService {
  constructor() {
    // Use the backend URL directly since the CDS Hooks API doesn't go through the frontend proxy
    this.baseUrl = process.env.NODE_ENV === 'development' 
      ? 'http://localhost:8000/cds-hooks'
      : '/api/cds-hooks';
  }

  /**
   * Transform frontend hook data to backend HookConfiguration format
   */
  transformToBackendFormat(hookData) {
    try {
      // Validate input
      if (!hookData || typeof hookData !== 'object') {
        throw new Error('Hook data must be a valid object');
      }

      // Transform frontend cards to backend actions with error handling
      const actions = [];
      if (hookData.cards && Array.isArray(hookData.cards)) {
        for (let i = 0; i < hookData.cards.length; i++) {
          const card = hookData.cards[i];
          try {
            if (!card || typeof card !== 'object') {
              throw new Error(`Card ${i + 1} is not a valid object`);
            }

            const action = {
              type: 'show-card',
              parameters: {
                summary: card.summary || '',
                detail: card.detail || '',
                indicator: card.indicator || 'info',
                source: card.source || { label: hookData.title || 'EMR System' },
                suggestions: Array.isArray(card.suggestions) ? card.suggestions : [],
                links: Array.isArray(card.links) ? card.links : []
              }
            };
            actions.push(action);
          } catch (error) {
            throw new Error(`Error transforming card ${i + 1}: ${error.message}`);
          }
        }
      }

      // Transform frontend conditions to backend conditions with error handling
      const conditions = [];
      if (hookData.conditions && Array.isArray(hookData.conditions)) {
        for (let i = 0; i < hookData.conditions.length; i++) {
          const condition = hookData.conditions[i];
          try {
            if (!condition || typeof condition !== 'object') {
              throw new Error(`Condition ${i + 1} is not a valid object`);
            }

            const mappedType = this.mapConditionType(condition.type);
            if (!mappedType) {
              throw new Error(`Unknown condition type: ${condition.type}`);
            }

            const parameters = this.buildConditionParameters(condition);
            if (!parameters || typeof parameters !== 'object') {
              throw new Error(`Failed to build parameters for condition ${i + 1}`);
            }

            conditions.push({
              type: mappedType,
              parameters: parameters
            });
          } catch (error) {
            throw new Error(`Error transforming condition ${i + 1}: ${error.message}`);
          }
        }
      }

      // Build the backend configuration with safe defaults
      const backendConfig = {
        id: hookData.id || '',
        hook: hookData.hook || 'patient-view',
        title: hookData.title || '',
        description: hookData.description || '',
        enabled: hookData.enabled !== false, // Default to true
        conditions: conditions,
        actions: actions,
        prefetch: (hookData.prefetch && typeof hookData.prefetch === 'object') ? hookData.prefetch : {},
        usageRequirements: hookData.usageRequirements || null,
        displayBehavior: (hookData.displayBehavior && typeof hookData.displayBehavior === 'object') ? hookData.displayBehavior : null
      };

      // Validate the final structure
      if (!backendConfig.id) {
        throw new Error('Hook ID is required in backend configuration');
      }

      if (!backendConfig.title) {
        throw new Error('Hook title is required in backend configuration');
      }

      if (!Array.isArray(backendConfig.actions) || backendConfig.actions.length === 0) {
        throw new Error('At least one action is required in backend configuration');
      }

      return backendConfig;
    } catch (error) {
      console.error('Transform to backend format failed:', error);
      throw new Error(`Data transformation failed: ${error.message}`);
    }
  }

  /**
   * Transform backend HookConfiguration to frontend format
   */
  transformToFrontendFormat(backendConfig) {
    // Transform backend actions to frontend cards
    const cards = backendConfig.actions.map((action, index) => ({
      id: `card-${Date.now()}-${index}`,
      summary: action.parameters.summary || '',
      detail: action.parameters.detail || '',
      indicator: action.parameters.indicator || 'info',
      suggestions: action.parameters.suggestions || [],
      links: action.parameters.links || []
    }));

    // Transform backend conditions to frontend conditions
    const conditions = backendConfig.conditions.map((condition, index) => {
      const conditionType = this.mapBackendConditionType(condition.type);
      let operator = condition.parameters.operator || 'equals';
      
      // Map backend operators back to frontend format
      if (conditionType === 'age') {
        const backendToFrontendOperatorMap = {
          'gt': 'greater_than',
          'ge': 'greater_than_or_equal', 
          'lt': 'less_than',
          'le': 'less_than_or_equal',
          'eq': 'equals',
          'between': 'between',
          'not_between': 'not_between',
          // Handle legacy mappings
          '>=': 'greater_than_or_equal',
          '<=': 'less_than_or_equal',
          '==': 'equals'
        };
        operator = backendToFrontendOperatorMap[operator] || operator;
      }
      
      const frontendCondition = {
        id: `condition-${Date.now()}-${index}`,
        type: conditionType,
        operator: operator,
        value: condition.parameters.value || '',
        enabled: true
      };
      
      // Add type-specific fields
      if (conditionType === 'lab_value') {
        frontendCondition.labTest = condition.parameters.code || condition.parameters.labTest;
        if (condition.parameters.timeframe) {
          frontendCondition.timeframe = condition.parameters.timeframe;
        }
        if (condition.parameters.value2) {
          frontendCondition.value2 = condition.parameters.value2;
        }
      } else if (conditionType === 'vital_sign') {
        frontendCondition.vitalType = condition.parameters.type;
        if (condition.parameters.component) {
          frontendCondition.component = condition.parameters.component;
        }
      } else if (conditionType === 'condition') {
        if (condition.parameters.codes) {
          frontendCondition.codes = condition.parameters.codes;
        }
        if (condition.parameters.system) {
          frontendCondition.system = condition.parameters.system;
        }
      }
      
      return frontendCondition;
    });

    return {
      id: backendConfig.id,
      title: backendConfig.title,
      description: backendConfig.description,
      hook: backendConfig.hook,
      enabled: backendConfig.enabled,
      conditions: conditions,
      cards: cards,
      prefetch: backendConfig.prefetch || {},
      displayBehavior: backendConfig.displayBehavior || null,
      _meta: {
        created: backendConfig.created_at ? new Date(backendConfig.created_at) : new Date(),
        modified: backendConfig.updated_at ? new Date(backendConfig.updated_at) : new Date(),
        version: 1,
        author: 'System'
      }
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
      // Map frontend operators to backend format for age conditions
      const ageOperatorMap = {
        'greater_than': 'gt',
        'greater_than_or_equal': 'ge',
        'less_than': 'lt',
        'less_than_or_equal': 'le',
        'equals': 'eq',
        'between': 'between',
        'not_between': 'not_between'
      };
      parameters.operator = ageOperatorMap[condition.operator] || condition.operator;
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
    const warnings = [];

    // Basic required field validation
    if (!hookData) {
      errors.push('Hook data is required');
      return { errors, warnings };
    }

    // Hook ID validation
    if (!hookData.id || !hookData.id.trim()) {
      errors.push('Hook ID is required and cannot be empty');
    } else {
      // Check ID format (alphanumeric, hyphens, underscores only)
      if (!/^[a-zA-Z0-9_-]+$/.test(hookData.id)) {
        errors.push('Hook ID can only contain letters, numbers, hyphens, and underscores');
      }
      if (hookData.id.length > 50) {
        errors.push('Hook ID must be 50 characters or less');
      }
    }

    // Title validation
    if (!hookData.title || !hookData.title.trim()) {
      errors.push('Hook title is required and cannot be empty');
    } else if (hookData.title.length > 200) {
      warnings.push('Hook title is quite long (over 200 characters)');
    }

    // Hook type validation
    if (!hookData.hook) {
      errors.push('Hook type is required');
    } else {
      const validHookTypes = ['patient-view', 'medication-prescribe', 'order-sign', 'order-select', 'encounter-start', 'encounter-discharge'];
      if (!validHookTypes.includes(hookData.hook)) {
        errors.push(`Invalid hook type. Must be one of: ${validHookTypes.join(', ')}`);
      }
    }

    // Description validation
    if (hookData.description && hookData.description.length > 1000) {
      warnings.push('Description is quite long (over 1000 characters)');
    }

    // Cards validation
    if (!hookData.cards || !Array.isArray(hookData.cards)) {
      errors.push('Cards must be an array');
    } else if (hookData.cards.length === 0) {
      errors.push('At least one card must be defined');
    } else {
      hookData.cards.forEach((card, index) => {
        if (!card || typeof card !== 'object') {
          errors.push(`Card ${index + 1}: Must be a valid object`);
          return;
        }

        if (!card.summary || !card.summary.trim()) {
          errors.push(`Card ${index + 1}: Summary is required and cannot be empty`);
        } else if (card.summary.length > 140) {
          warnings.push(`Card ${index + 1}: Summary is quite long (over 140 characters)`);
        }

        // Validate indicator
        if (card.indicator) {
          const validIndicators = ['info', 'warning', 'critical'];
          if (!validIndicators.includes(card.indicator)) {
            warnings.push(`Card ${index + 1}: Invalid indicator "${card.indicator}". Should be: ${validIndicators.join(', ')}`);
          }
        }

        // Validate suggestions if present
        if (card.suggestions && Array.isArray(card.suggestions)) {
          card.suggestions.forEach((suggestion, suggestionIndex) => {
            if (!suggestion.label || !suggestion.label.trim()) {
              errors.push(`Card ${index + 1}, Suggestion ${suggestionIndex + 1}: Label is required`);
            }
          });
        }
      });
    }

    // Conditions validation
    if (!hookData.conditions || !Array.isArray(hookData.conditions)) {
      warnings.push('No conditions defined - hook will always trigger');
    } else {
      hookData.conditions.forEach((condition, index) => {
        if (!condition || typeof condition !== 'object') {
          errors.push(`Condition ${index + 1}: Must be a valid object`);
          return;
        }

        if (!condition.type) {
          errors.push(`Condition ${index + 1}: Type is required`);
        } else {
          const validConditionTypes = ['age', 'gender', 'condition', 'medication', 'lab_value', 'vital_sign'];
          if (!validConditionTypes.includes(condition.type)) {
            errors.push(`Condition ${index + 1}: Invalid type "${condition.type}". Must be one of: ${validConditionTypes.join(', ')}`);
          }
        }

        if (!condition.operator) {
          errors.push(`Condition ${index + 1}: Operator is required`);
        }

        if (condition.value === '' || condition.value === null || condition.value === undefined) {
          errors.push(`Condition ${index + 1}: Value is required`);
        }

        // Type-specific validation
        if (condition.type === 'age' && condition.value !== undefined) {
          const ageValue = Number(condition.value);
          if (isNaN(ageValue) || ageValue < 0 || ageValue > 150) {
            errors.push(`Condition ${index + 1}: Age must be a number between 0 and 150`);
          }
        }

        if (condition.type === 'lab_value') {
          if (!condition.labTest) {
            errors.push(`Condition ${index + 1}: Lab test code is required for lab value conditions`);
          }
          if (condition.value !== undefined && isNaN(Number(condition.value))) {
            errors.push(`Condition ${index + 1}: Lab value must be a number`);
          }
        }
      });
    }

    // Prefetch validation
    if (hookData.prefetch && typeof hookData.prefetch !== 'object') {
      warnings.push('Prefetch should be an object');
    }

    return { errors, warnings };
  }

  /**
   * Create a new CDS hook
   */
  async createHook(hookData) {
    try {
      // Validate the hook data
      const validation = this.validateHookData(hookData);
      if (validation.errors.length > 0) {
        const error = new Error(`Validation failed: ${validation.errors.join(', ')}`);
        error.name = 'ValidationError';
        error.details = validation;
        throw error;
      }

      // Log warnings if any
      if (validation.warnings.length > 0) {
        console.warn('CDS Hook validation warnings:', validation.warnings);
      }

      // Transform to backend format with error handling
      let backendConfig;
      try {
        backendConfig = this.transformToBackendFormat(hookData);
      } catch (transformError) {
        const error = new Error(`Data transformation failed: ${transformError.message}`);
        error.name = 'TransformationError';
        throw error;
      }

      // Validate transformed data structure
      if (!backendConfig || typeof backendConfig !== 'object') {
        throw new Error('Invalid transformed data structure');
      }

      // Send to backend with timeout
      const response = await axios.post(`${this.baseUrl}/hooks`, backendConfig, {
        timeout: 10000, // 10 second timeout
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      return {
        success: true,
        data: response.data,
        message: 'Hook created successfully',
        warnings: validation.warnings
      };
    } catch (error) {
      console.error('Create hook failed:', error);
      
      // Enhanced error categorization
      if (error.name === 'ValidationError') {
        throw error; // Re-throw validation errors as-is
      } else if (error.name === 'TransformationError') {
        throw error; // Re-throw transformation errors as-is
      } else if (error.code === 'ECONNABORTED') {
        throw new Error('Request timeout - the server took too long to respond. Please try again.');
      } else if (error.response?.status === 409) {
        throw new Error('Hook ID already exists. Please choose a different ID.');
      } else if (error.response?.status === 400) {
        const detail = error.response.data?.detail || error.response.data?.message || error.message;
        throw new Error(`Invalid hook data: ${detail}`);
      } else if (error.response?.status === 401) {
        throw new Error('Authentication required. Please log in and try again.');
      } else if (error.response?.status === 403) {
        throw new Error('Permission denied. You do not have access to create hooks.');
      } else if (error.response?.status >= 500) {
        throw new Error('Server error. Please try again later or contact support.');
      } else if (!navigator.onLine) {
        throw new Error('No internet connection. Please check your network and try again.');
      } else {
        throw new Error(`Failed to create hook: ${error.message || 'Unknown error'}`);
      }
    }
  }

  /**
   * Update an existing CDS hook
   */
  async updateHook(hookId, hookData) {
    try {
      // Validate hook ID
      if (!hookId || !hookId.trim()) {
        throw new Error('Hook ID is required for updates');
      }

      // Ensure ID matches
      hookData.id = hookId;

      // Validate the hook data
      const validation = this.validateHookData(hookData);
      if (validation.errors.length > 0) {
        const error = new Error(`Validation failed: ${validation.errors.join(', ')}`);
        error.name = 'ValidationError';
        error.details = validation;
        throw error;
      }

      // Log warnings if any
      if (validation.warnings.length > 0) {
        console.warn('CDS Hook validation warnings:', validation.warnings);
      }

      // Transform to backend format with error handling
      let backendConfig;
      try {
        backendConfig = this.transformToBackendFormat(hookData);
      } catch (transformError) {
        const error = new Error(`Data transformation failed: ${transformError.message}`);
        error.name = 'TransformationError';
        throw error;
      }

      // Validate transformed data structure
      if (!backendConfig || typeof backendConfig !== 'object') {
        throw new Error('Invalid transformed data structure');
      }

      // Send to backend with timeout
      const response = await axios.put(`${this.baseUrl}/hooks/${hookId}`, backendConfig, {
        timeout: 10000, // 10 second timeout
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      return {
        success: true,
        data: response.data,
        message: 'Hook updated successfully',
        warnings: validation.warnings
      };
    } catch (error) {
      console.error('Update hook failed:', error);
      
      // Enhanced error categorization
      if (error.name === 'ValidationError') {
        throw error; // Re-throw validation errors as-is
      } else if (error.name === 'TransformationError') {
        throw error; // Re-throw transformation errors as-is
      } else if (error.code === 'ECONNABORTED') {
        throw new Error('Request timeout - the server took too long to respond. Please try again.');
      } else if (error.response?.status === 404) {
        throw new Error(`Hook "${hookId}" not found. It may have been deleted.`);
      } else if (error.response?.status === 400) {
        const detail = error.response.data?.detail || error.response.data?.message || error.message;
        throw new Error(`Invalid hook data: ${detail}`);
      } else if (error.response?.status === 401) {
        throw new Error('Authentication required. Please log in and try again.');
      } else if (error.response?.status === 403) {
        throw new Error('Permission denied. You do not have access to update this hook.');
      } else if (error.response?.status === 409) {
        throw new Error('Conflict: The hook has been modified by another user. Please refresh and try again.');
      } else if (error.response?.status >= 500) {
        throw new Error('Server error. Please try again later or contact support.');
      } else if (!navigator.onLine) {
        throw new Error('No internet connection. Please check your network and try again.');
      } else {
        throw new Error(`Failed to update hook: ${error.message || 'Unknown error'}`);
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
      // First, we need to create/update the hook to ensure it exists
      let hookExists = false;
      try {
        await this.getHook(hookData.id);
        hookExists = true;
      } catch (e) {
        // Hook doesn't exist yet
      }

      // Save the hook first
      if (hookExists) {
        await this.updateHook(hookData.id, hookData);
      } else {
        await this.createHook(hookData);
      }

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

      // Now test it by calling the CDS service execution endpoint
      const response = await axios.post(`${this.baseUrl}/cds-services/${hookData.id}`, testRequest);
      
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