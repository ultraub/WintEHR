/**
 * SMART on FHIR Service
 *
 * Client-side service for SMART App Launch authorization.
 * Provides methods for:
 * - Listing registered SMART apps
 * - Launching apps (EHR launch and standalone)
 * - Token management
 * - Authorization flow handling
 * - Educational flow tracking
 *
 * @module smartService
 */

import api from './api';

const SMART_API_BASE = '/api/smart';

/**
 * SMART App Launch Service
 *
 * Educational Purpose:
 * This service demonstrates the client-side portion of SMART App Launch.
 * In a real EHR, this would integrate with the clinical workspace to:
 * 1. Display available SMART apps
 * 2. Handle app launches with patient context
 * 3. Manage consent flows
 * 4. Track authorization for educational display
 */
class SMARTService {
  constructor() {
    this._discoveryCache = null;
    this._appsCache = null;
    this._appsCacheTime = null;
    this._CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  }

  // =========================================================================
  // Discovery
  // =========================================================================

  /**
   * Get SMART configuration from discovery endpoint
   *
   * Educational Notes:
   * This is the first call apps make to understand server capabilities.
   * Returns endpoints, supported scopes, and features.
   *
   * @returns {Promise<Object>} SMART configuration
   */
  async getSmartConfiguration() {
    if (this._discoveryCache) {
      return this._discoveryCache;
    }

    try {
      const response = await api.get('/.well-known/smart-configuration');
      this._discoveryCache = response.data;
      return response.data;
    } catch (error) {
      console.debug('SMART configuration not available (expected in dev mode):', error.message);
      return null;
    }
  }

  // =========================================================================
  // App Management
  // =========================================================================

  /**
   * Get list of registered SMART apps
   *
   * @param {boolean} useCache - Whether to use cached results
   * @returns {Promise<Array>} List of registered apps
   */
  async getRegisteredApps(useCache = true) {
    // Check cache
    if (
      useCache &&
      this._appsCache &&
      this._appsCacheTime &&
      Date.now() - this._appsCacheTime < this._CACHE_TTL
    ) {
      return this._appsCache;
    }

    try {
      const response = await api.get(`${SMART_API_BASE}/apps`);
      this._appsCache = response.data;
      this._appsCacheTime = Date.now();
      return response.data;
    } catch (error) {
      console.error('Failed to fetch SMART apps:', error);
      throw error;
    }
  }

  /**
   * Get details for a specific app
   *
   * @param {string} clientId - The app's client ID
   * @returns {Promise<Object>} App details
   */
  async getAppDetails(clientId) {
    try {
      const response = await api.get(`${SMART_API_BASE}/apps/${clientId}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch app details for ${clientId}:`, error);
      throw error;
    }
  }

  /**
   * Get apps grouped by category
   *
   * @returns {Promise<Object>} Apps grouped by category
   */
  async getAppsByCategory() {
    const apps = await this.getRegisteredApps();

    const categories = {
      clinical: [],
      analytics: [],
      educational: [],
      other: []
    };

    apps.forEach(app => {
      // Categorize based on scopes and name patterns
      if (app.scopes.some(s => s.includes('patient/'))) {
        categories.clinical.push(app);
      } else if (app.name.toLowerCase().includes('chart') ||
                 app.name.toLowerCase().includes('view')) {
        categories.analytics.push(app);
      } else {
        categories.other.push(app);
      }
    });

    return categories;
  }

  // =========================================================================
  // App Launch
  // =========================================================================

  /**
   * Launch a SMART app from EHR context
   *
   * Educational Notes:
   * EHR Launch Flow:
   * 1. EHR creates launch context with patient/encounter
   * 2. Server returns launch URL with opaque token
   * 3. App opens in new window/tab
   * 4. App uses launch token to get patient context
   *
   * @param {string} clientId - The app's client ID
   * @param {string} patientId - Current patient ID
   * @param {string} encounterId - Current encounter ID (optional)
   * @param {Object} options - Additional launch options
   * @returns {Promise<Object>} Launch response with URL
   */
  async launchApp(clientId, patientId, encounterId = null, options = {}) {
    try {
      const response = await api.post(`${SMART_API_BASE}/launch`, {
        app_client_id: clientId,
        patient_id: patientId,
        encounter_id: encounterId,
        user_id: options.userId || null,
        intent: options.intent || null
      });

      return response.data;
    } catch (error) {
      console.error(`Failed to launch app ${clientId}:`, error);
      throw error;
    }
  }

  /**
   * Launch app and open in new window
   *
   * @param {string} clientId - The app's client ID
   * @param {string} patientId - Current patient ID
   * @param {string} encounterId - Current encounter ID (optional)
   * @param {Object} options - Window options
   * @returns {Promise<Window>} The opened window
   */
  async launchAppInWindow(clientId, patientId, encounterId = null, options = {}) {
    const launchResponse = await this.launchApp(clientId, patientId, encounterId, options);

    const windowOptions = {
      width: options.width || 1200,
      height: options.height || 800,
      left: options.left || (window.screen.width - 1200) / 2,
      top: options.top || (window.screen.height - 800) / 2
    };

    const windowFeatures = `width=${windowOptions.width},height=${windowOptions.height},left=${windowOptions.left},top=${windowOptions.top},resizable=yes,scrollbars=yes,status=yes`;

    const appWindow = window.open(launchResponse.launch_url, `smart-app-${clientId}`, windowFeatures);

    return {
      window: appWindow,
      launchToken: launchResponse.launch_token,
      launchUrl: launchResponse.launch_url,
      expiresIn: launchResponse.expires_in
    };
  }

  /**
   * Generate standalone launch URL for an app
   *
   * Educational Notes:
   * Standalone Launch doesn't have EHR context.
   * The app will need to authenticate and select a patient.
   *
   * @param {string} clientId - The app's client ID
   * @param {string} fhirUrl - FHIR server base URL
   * @returns {Promise<string>} Launch URL
   */
  async getStandaloneLaunchUrl(clientId, fhirUrl = null) {
    const config = await this.getSmartConfiguration();
    const app = await this.getAppDetails(clientId);

    if (!app.launch_uri) {
      throw new Error(`App ${clientId} has no launch URI configured`);
    }

    const params = new URLSearchParams({
      iss: fhirUrl || config.issuer
    });

    return `${app.launch_uri}?${params.toString()}`;
  }

  // =========================================================================
  // Consent Flow
  // =========================================================================

  /**
   * Get consent screen data for an authorization session
   *
   * @param {string} sessionId - Authorization session ID
   * @returns {Promise<Object>} Consent display data
   */
  async getConsentData(sessionId) {
    try {
      const response = await api.get(`${SMART_API_BASE}/consent/${sessionId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch consent data:', error);
      throw error;
    }
  }

  /**
   * Approve authorization request
   *
   * @param {string} sessionId - Authorization session ID
   * @param {Object} approvalData - Approval details
   * @returns {Promise<Object>} Redirect URL
   */
  async approveConsent(sessionId, approvalData = {}) {
    try {
      const formData = new FormData();
      formData.append('user_id', approvalData.userId || 'demo');
      if (approvalData.patientId) {
        formData.append('patient_id', approvalData.patientId);
      }
      if (approvalData.grantedScopes) {
        formData.append('granted_scopes', approvalData.grantedScopes.join(','));
      }

      const response = await api.post(
        `${SMART_API_BASE}/consent/${sessionId}/approve`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      return response.data;
    } catch (error) {
      console.error('Failed to approve consent:', error);
      throw error;
    }
  }

  /**
   * Deny authorization request
   *
   * @param {string} sessionId - Authorization session ID
   * @param {string} reason - Denial reason
   * @returns {Promise<Object>} Redirect URL
   */
  async denyConsent(sessionId, reason = 'User denied access') {
    try {
      const formData = new FormData();
      formData.append('reason', reason);

      const response = await api.post(
        `${SMART_API_BASE}/consent/${sessionId}/deny`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      return response.data;
    } catch (error) {
      console.error('Failed to deny consent:', error);
      throw error;
    }
  }

  // =========================================================================
  // Educational Features
  // =========================================================================

  /**
   * Get authorization flow details for educational display
   *
   * Educational Notes:
   * This endpoint returns detailed step-by-step information
   * about an authorization flow, including:
   * - Each step of the OAuth2 flow
   * - Request/response data
   * - Educational explanations
   *
   * @param {string} sessionId - Authorization session ID
   * @returns {Promise<Object>} Flow session with steps
   */
  async getAuthorizationFlow(sessionId) {
    try {
      const response = await api.get(`${SMART_API_BASE}/flow/${sessionId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch flow session:', error);
      throw error;
    }
  }

  /**
   * Inspect an access token (educational)
   *
   * Educational Notes:
   * This decodes a JWT token and explains its claims.
   * In production, tokens should be treated as opaque.
   *
   * @param {string} token - The access token to inspect
   * @returns {Promise<Object>} Token details with explanations
   */
  async inspectToken(token) {
    try {
      const response = await api.get(`${SMART_API_BASE}/token-info`, {
        params: { token }
      });
      return response.data;
    } catch (error) {
      console.error('Failed to inspect token:', error);
      throw error;
    }
  }

  /**
   * Revoke a token
   *
   * @param {string} token - The token to revoke
   * @param {string} tokenType - 'access_token' or 'refresh_token'
   * @returns {Promise<Object>} Revocation result
   */
  async revokeToken(token, tokenType = 'access_token') {
    try {
      const formData = new FormData();
      formData.append('token', token);
      formData.append('token_type_hint', tokenType);

      const response = await api.post(
        `${SMART_API_BASE}/revoke`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      return response.data;
    } catch (error) {
      console.error('Failed to revoke token:', error);
      throw error;
    }
  }

  // =========================================================================
  // Utility Methods
  // =========================================================================

  /**
   * Parse SMART scopes into human-readable format
   *
   * @param {string[]} scopes - Array of scope strings
   * @returns {Array} Parsed scope descriptions
   */
  parseScopeDescriptions(scopes) {
    const descriptions = {
      'launch': { display: 'EHR Launch', description: 'Launch from within the EHR with context' },
      'launch/patient': { display: 'Patient Selection', description: 'Select a patient when launching' },
      'openid': { display: 'OpenID Connect', description: 'Access your identity' },
      'fhirUser': { display: 'FHIR User', description: 'Access your user profile' },
      'profile': { display: 'Profile', description: 'Access your profile information' },
      'offline_access': { display: 'Offline Access', description: 'Maintain access when not using the app' },
      'patient/Patient.read': { display: 'Read Demographics', description: 'Read patient name and contact info' },
      'patient/Observation.read': { display: 'Read Vitals/Labs', description: 'Read lab results and vital signs' },
      'patient/Condition.read': { display: 'Read Conditions', description: 'Read diagnoses and problems' },
      'patient/MedicationRequest.read': { display: 'Read Medications', description: 'Read current medications' },
      'patient/AllergyIntolerance.read': { display: 'Read Allergies', description: 'Read allergy information' },
      'patient/*.read': { display: 'Read All Data', description: 'Read all patient health information' },
      'patient/*.write': { display: 'Write All Data', description: 'Create and modify patient data' }
    };

    return scopes.map(scope => {
      if (descriptions[scope]) {
        return { scope, ...descriptions[scope] };
      }

      // Parse dynamic scopes (e.g., patient/Procedure.read)
      const match = scope.match(/^(patient|user)\/(\*|[A-Z][a-zA-Z]+)\.(read|write|\*)$/);
      if (match) {
        const [, context, resource, action] = match;
        return {
          scope,
          display: `${action.charAt(0).toUpperCase() + action.slice(1)} ${resource}`,
          description: `${action === 'read' ? 'Read' : 'Modify'} ${resource} resources`
        };
      }

      return {
        scope,
        display: scope,
        description: `Access: ${scope}`
      };
    });
  }

  /**
   * Check if an app has a specific scope capability
   *
   * @param {Object} app - The app object
   * @param {string} scope - The scope to check
   * @returns {boolean} Whether the app has the scope
   */
  appHasScope(app, scope) {
    if (!app.scopes) return false;

    // Exact match
    if (app.scopes.includes(scope)) return true;

    // Wildcard match (patient/*.read covers patient/Observation.read)
    const match = scope.match(/^(patient|user)\/([A-Z][a-zA-Z]+)\.(read|write)$/);
    if (match) {
      const [, context, resource, action] = match;
      const wildcard = `${context}/*.${action}`;
      if (app.scopes.includes(wildcard)) return true;

      // *.* covers everything
      const superWildcard = `${context}/*.*`;
      if (app.scopes.includes(superWildcard)) return true;
    }

    return false;
  }

  /**
   * Clear cached data
   */
  clearCache() {
    this._discoveryCache = null;
    this._appsCache = null;
    this._appsCacheTime = null;
  }

  /**
   * Health check for SMART service
   *
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    try {
      const response = await api.get(`${SMART_API_BASE}/health`);
      return response.data;
    } catch (error) {
      return { status: 'unhealthy', error: error.message };
    }
  }
}

// Export singleton instance
const smartService = new SMARTService();
export default smartService;
export { SMARTService };
