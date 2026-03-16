/**
 * API Configuration Utility
 *
 * Centralized configuration for all API endpoints and service URLs.
 *
 * PHILOSOPHY: Environment-Agnostic Deployment
 * - Frontend uses EMPTY/RELATIVE URLs by default so that the CRA dev server
 *   proxy (development) or nginx (production) routes requests correctly.
 * - REACT_APP_* env vars override only when explicitly set to a non-empty value.
 * - NEVER hardcode hostnames (localhost, container names, domain names).
 * - Code must work seamlessly on any system: local dev, Docker, Azure, AWS, GCP.
 *
 * Environment Variables:
 * - REACT_APP_API_URL: Backend API base URL (leave empty for proxy/relative)
 * - REACT_APP_FHIR_ENDPOINT: FHIR server endpoint (leave empty for proxy)
 * - REACT_APP_CDS_HOOKS_URL: CDS Hooks service URL (leave empty for proxy)
 * - REACT_APP_WEBSOCKET_URL: WebSocket connection URL (auto-derived if empty)
 * - NODE_ENV: Node environment (development/production)
 *
 * Usage:
 *   import { getBackendUrl, getFhirUrl, getCdsHooksUrl } from '@/config/apiConfig';
 *   const backendUrl = getBackendUrl();
 *   const fhirUrl = getFhirUrl();
 */

class ApiConfig {
  constructor() {
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

    // Build configuration
    this._config = {
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
        backend: this._config.backend.baseUrl || '(relative)',
        fhir: this._config.fhir.baseUrl,
        cdsHooks: this._config.cdsHooks.baseUrl || '(relative)'
      });
    }
  }

  /**
   * Build backend API configuration
   *
   * Uses REACT_APP_API_URL if set to a non-empty value.
   * Otherwise defaults to empty string (relative URLs via proxy/nginx).
   */
  buildBackendConfig() {
    const envUrl = process.env.REACT_APP_API_URL;

    // Use env var if explicitly set to a non-empty value
    if (envUrl) {
      return {
        baseUrl: envUrl,
        apiPath: '/api',
        fullUrl: `${envUrl}/api`
      };
    }

    // Default: relative URLs — proxy (dev) or nginx (prod) handles routing
    return {
      baseUrl: '',
      apiPath: '/api',
      fullUrl: '/api'
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

    // Default: relative URLs via proxy
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

    // CDS Hooks routes to backend — use relative URL
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

    // Derive WebSocket URL from the current page origin
    // This works regardless of whether the page is served from localhost,
    // an Azure VM IP, a custom domain, etc.
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return {
      baseUrl: `${wsProtocol}//${host}`,
      protocol: wsProtocol,
      fullUrl: `${wsProtocol}//${host}/api/ws`
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
export const isDevelopment = () => apiConfig.isDevelopment();
export const isProduction = () => apiConfig.isProduction();
export const buildUrl = (service, path) => apiConfig.buildUrl(service, path);
export const getConfig = () => apiConfig.getConfig();

// Export singleton instance for direct access
export default apiConfig;
