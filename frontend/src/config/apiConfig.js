/**
 * API Configuration Utility
 *
 * Centralized configuration for all API endpoints and service URLs.
 * Eliminates hardcoded URLs and Docker detection duplication across services.
 *
 * Environment Variables:
 * - REACT_APP_API_URL: Backend API base URL
 * - REACT_APP_FHIR_ENDPOINT: FHIR server endpoint
 * - REACT_APP_CDS_HOOKS_URL: CDS Hooks service URL
 * - REACT_APP_WEBSOCKET_URL: WebSocket connection URL
 * - NODE_ENV: Node environment (development/production)
 *
 * Usage:
 *   import { getBackendUrl, getFhirUrl, getCdsHooksUrl } from '@/config/apiConfig';
 *   const backendUrl = getBackendUrl();
 *   const fhirUrl = getFhirUrl();
 */

class ApiConfig {
  constructor() {
    this._isDocker = null;
    this._config = null;
    this.initialize();
  }

  /**
   * Initialize configuration on first access
   */
  initialize() {
    if (this._config) {
      return;
    }

    // Detect Docker environment
    this._isDocker = this.detectDockerEnvironment();

    // Build configuration
    this._config = {
      isDocker: this._isDocker,
      isDevelopment: process.env.NODE_ENV === 'development',
      isProduction: process.env.NODE_ENV === 'production',

      // Backend API endpoints
      backend: this.buildBackendConfig(),

      // FHIR server endpoints
      fhir: this.buildFhirConfig(),

      // CDS Hooks endpoints
      cdsHooks: this.buildCdsHooksConfig(),

      // WebSocket endpoints
      websocket: this.buildWebSocketConfig(),

      // Other service endpoints
      emr: this.buildEmrConfig()
    };

    // Log configuration in development
    if (this._config.isDevelopment) {
      console.log('[ApiConfig] Configuration initialized:', {
        isDocker: this._config.isDocker,
        backend: this._config.backend.baseUrl,
        fhir: this._config.fhir.baseUrl,
        cdsHooks: this._config.cdsHooks.baseUrl
      });
    }
  }

  /**
   * Detect if running in Docker environment
   * Checks hostname to determine if we're inside a Docker container
   */
  detectDockerEnvironment() {
    // In Docker, hostname will typically be a container name or non-localhost address
    const hostname = window.location.hostname;
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

    // Additional check: In Docker, HOST env var is often set to '0.0.0.0'
    const hostEnv = process.env.HOST;
    const isDockerHost = hostEnv === '0.0.0.0';

    return !isLocalhost || isDockerHost;
  }

  /**
   * Build backend API configuration
   */
  buildBackendConfig() {
    // Priority: ENV variable > Docker/local detection > default
    const envUrl = process.env.REACT_APP_API_URL;

    // Check if env var is explicitly set (even if empty)
    // Empty string means "use relative URLs via nginx proxy"
    if (envUrl !== undefined) {
      if (envUrl === '') {
        // Using nginx proxy - all API calls go through same origin
        return {
          baseUrl: '',
          apiPath: '/api',
          fullUrl: '/api'
        };
      }
      return {
        baseUrl: envUrl,
        apiPath: '/api',
        fullUrl: `${envUrl}/api`
      };
    }

    // Docker environment uses container service name
    if (this._isDocker) {
      return {
        baseUrl: 'http://emr-backend-dev:8000',
        apiPath: '/api',
        fullUrl: 'http://emr-backend-dev:8000/api'
      };
    }

    // Local development uses localhost
    return {
      baseUrl: 'http://localhost:8000',
      apiPath: '/api',
      fullUrl: 'http://localhost:8000/api'
    };
  }

  /**
   * Build FHIR server configuration
   */
  buildFhirConfig() {
    const envUrl = process.env.REACT_APP_FHIR_ENDPOINT;

    if (envUrl) {
      return {
        baseUrl: envUrl,
        r4Path: envUrl.includes('/R4') ? '' : '/R4',
        fullUrl: envUrl.includes('/R4') ? envUrl : `${envUrl}/R4`
      };
    }

    // In production and Docker, use proxy paths
    // In development, FHIR requests are proxied to HAPI FHIR server
    return {
      baseUrl: '/fhir',
      r4Path: '/R4',
      fullUrl: '/fhir/R4'
    };
  }

  /**
   * Build CDS Hooks configuration
   */
  buildCdsHooksConfig() {
    const envUrl = process.env.REACT_APP_CDS_HOOKS_URL;

    if (envUrl) {
      return {
        baseUrl: envUrl,
        servicesPath: '/cds-services',
        fullUrl: `${envUrl}/cds-services`
      };
    }

    // CDS Hooks routes to backend
    const backendUrl = this._config?.backend?.baseUrl || this.buildBackendConfig().baseUrl;

    return {
      baseUrl: `${backendUrl}/cds-services`,
      servicesPath: '',
      fullUrl: `${backendUrl}/cds-services`
    };
  }

  /**
   * Build WebSocket configuration
   */
  buildWebSocketConfig() {
    const envUrl = process.env.REACT_APP_WEBSOCKET_URL;

    if (envUrl) {
      return {
        baseUrl: envUrl,
        protocol: envUrl.startsWith('wss:') ? 'wss:' : 'ws:',
        fullUrl: envUrl
      };
    }

    // Build WebSocket URL based on backend configuration
    const backendConfig = this._config?.backend || this.buildBackendConfig();

    // If backend URL is empty (using nginx proxy), derive from current page
    if (!backendConfig.baseUrl || backendConfig.baseUrl === '') {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      return {
        baseUrl: `${wsProtocol}//${host}`,
        protocol: wsProtocol,
        fullUrl: `${wsProtocol}//${host}/api/ws`
      };
    }

    // Legacy: absolute backend URL
    const wsProtocol = backendConfig.baseUrl.startsWith('https') ? 'wss:' : 'ws:';

    // Extract host from backend URL
    const backendHost = backendConfig.baseUrl.replace(/^https?:\/\//, '');

    return {
      baseUrl: `${wsProtocol}//${backendHost}`,
      protocol: wsProtocol,
      fullUrl: `${wsProtocol}//${backendHost}/api/ws`
    };
  }

  /**
   * Build EMR service configuration
   */
  buildEmrConfig() {
    const envUrl = process.env.REACT_APP_EMR_API;
    const enabled = process.env.REACT_APP_EMR_FEATURES !== 'false';

    if (envUrl) {
      return {
        baseUrl: envUrl,
        enabled,
        fullUrl: envUrl
      };
    }

    const backendUrl = this._config?.backend?.baseUrl || this.buildBackendConfig().baseUrl;

    return {
      baseUrl: `${backendUrl}/api/emr`,
      enabled,
      fullUrl: `${backendUrl}/api/emr`
    };
  }

  /**
   * Get backend API base URL
   */
  getBackendUrl() {
    return this._config.backend.baseUrl;
  }

  /**
   * Get backend API full path (base + /api)
   */
  getBackendApiUrl() {
    return this._config.backend.fullUrl;
  }

  /**
   * Get FHIR server base URL
   */
  getFhirUrl() {
    return this._config.fhir.fullUrl;
  }

  /**
   * Get CDS Hooks base URL
   */
  getCdsHooksUrl() {
    return this._config.cdsHooks.baseUrl;
  }

  /**
   * Get CDS Hooks services URL
   */
  getCdsHooksServicesUrl() {
    return this._config.cdsHooks.fullUrl;
  }

  /**
   * Get WebSocket connection URL
   */
  getWebSocketUrl() {
    return this._config.websocket.fullUrl;
  }

  /**
   * Get EMR service URL
   */
  getEmrUrl() {
    return this._config.emr.fullUrl;
  }

  /**
   * Check if running in Docker environment
   */
  isDocker() {
    return this._config.isDocker;
  }

  /**
   * Check if running in development mode
   */
  isDevelopment() {
    return this._config.isDevelopment;
  }

  /**
   * Check if running in production mode
   */
  isProduction() {
    return this._config.isProduction;
  }

  /**
   * Get complete configuration object
   */
  getConfig() {
    return { ...this._config };
  }

  /**
   * Build URL with custom path
   * @param {string} service - Service name (backend, fhir, cdsHooks, websocket)
   * @param {string} path - Path to append to base URL
   */
  buildUrl(service, path = '') {
    const serviceConfig = this._config[service];
    if (!serviceConfig) {
      throw new Error(`Unknown service: ${service}`);
    }

    const baseUrl = serviceConfig.baseUrl;
    const cleanPath = path.startsWith('/') ? path : `/${path}`;

    return `${baseUrl}${cleanPath}`;
  }
}

// Create singleton instance
const apiConfig = new ApiConfig();

// Export convenience methods
export const getBackendUrl = () => apiConfig.getBackendUrl();
export const getBackendApiUrl = () => apiConfig.getBackendApiUrl();
export const getFhirUrl = () => apiConfig.getFhirUrl();
export const getCdsHooksUrl = () => apiConfig.getCdsHooksUrl();
export const getCdsHooksServicesUrl = () => apiConfig.getCdsHooksServicesUrl();
export const getWebSocketUrl = () => apiConfig.getWebSocketUrl();
export const getEmrUrl = () => apiConfig.getEmrUrl();
export const isDocker = () => apiConfig.isDocker();
export const isDevelopment = () => apiConfig.isDevelopment();
export const isProduction = () => apiConfig.isProduction();
export const buildUrl = (service, path) => apiConfig.buildUrl(service, path);
export const getConfig = () => apiConfig.getConfig();

// Export singleton instance for direct access
export default apiConfig;
