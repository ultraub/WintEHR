/**
 * CDS Studio API Client
 *
 * Handles all communication with the CDS Studio backend API.
 */

import api from '../../../services/api';

const API_BASE = '/api/cds-studio';

/**
 * Issue a request through the shared axios client (auth header injected by
 * its interceptor) and unwrap the JSON body. On failure, surface the
 * backend's `detail` message when present, else the fallback message with
 * the HTTP status.
 */
async function request(method, url, data, fallbackMessage) {
  try {
    const response = await api.request({ method, url, data });
    return response.data;
  } catch (error) {
    const detail = error.response?.data?.detail;
    const status = error.response?.status;
    throw new Error(detail || (status ? `${fallbackMessage}: ${status}` : fallbackMessage));
  }
}

class CDSStudioAPI {
  /**
   * Service Registry Operations
   */

  async listServices(filters = {}) {
    const params = new URLSearchParams();
    if (filters.hook_type) params.append('hook_type', filters.hook_type);
    if (filters.origin) params.append('origin', filters.origin);
    if (filters.status) params.append('status', filters.status);
    if (filters.search) params.append('search', filters.search);

    return request('get', `${API_BASE}/services?${params}`, undefined, 'Failed to list services');
  }

  async getServiceConfiguration(serviceId) {
    return request('get', `${API_BASE}/services/${serviceId}/config`, undefined, 'Failed to get service configuration');
  }

  async getConfigurationView(serviceId) {
    return request('get', `${API_BASE}/services/${serviceId}/config/view`, undefined, 'Failed to get configuration view');
  }

  /**
   * Service Creation Operations
   */

  async createBuiltInService(serviceData) {
    return request('post', `${API_BASE}/services/built-in`, serviceData, 'Failed to create built-in service');
  }

  async createExternalService(serviceData) {
    return request('post', `${API_BASE}/services/external`, serviceData, 'Failed to create external service');
  }

  /**
   * Service Testing Operations
   */

  async testService(serviceId, testRequest) {
    return request('post', `${API_BASE}/services/${serviceId}/test`, testRequest, 'Failed to test service');
  }

  /**
   * Service Metrics Operations
   */

  async getServiceMetrics(serviceId) {
    return request('get', `${API_BASE}/services/${serviceId}/metrics`, undefined, 'Failed to get service metrics');
  }

  /**
   * Service Management Operations
   */

  async updateServiceStatus(serviceId, status) {
    return request('put', `${API_BASE}/services/${serviceId}/status`, { status }, 'Failed to update service status');
  }

  async deleteService(serviceId, hardDelete = false) {
    const params = new URLSearchParams();
    if (hardDelete) params.append('hard_delete', 'true');

    return request('delete', `${API_BASE}/services/${serviceId}?${params}`, undefined, 'Failed to delete service');
  }

  /**
   * Version Management Operations
   */

  async getVersionHistory(serviceId) {
    return request('get', `${API_BASE}/services/${serviceId}/versions`, undefined, 'Failed to get version history');
  }

  async rollbackService(serviceId, targetVersion, notes = null) {
    return request('post', `${API_BASE}/services/${serviceId}/rollback`, {
      target_version: targetVersion,
      rollback_notes: notes
    }, 'Failed to rollback service');
  }

  /**
   * Credentials Management Operations
   */

  async listCredentials() {
    return request('get', `${API_BASE}/credentials`, undefined, 'Failed to list credentials');
  }

  async getCredential(credentialId) {
    return request('get', `${API_BASE}/credentials/${credentialId}`, undefined, 'Failed to get credential');
  }

  async createCredential(credentialData) {
    return request('post', `${API_BASE}/credentials`, credentialData, 'Failed to create credential');
  }

  async updateCredential(credentialId, credentialData) {
    return request('put', `${API_BASE}/credentials/${credentialId}`, credentialData, 'Failed to update credential');
  }

  async deleteCredential(credentialId) {
    return request('delete', `${API_BASE}/credentials/${credentialId}`, undefined, 'Failed to delete credential');
  }

  /**
   * Monitoring and Metrics Operations
   */

  async getSystemMetrics(timeRange = '24h') {
    return request('get', `${API_BASE}/metrics?time_range=${timeRange}`, undefined, 'Failed to get system metrics');
  }

  /**
   * CQL Authoring Operations (Phase 1+ of student CQL feature).
   *
   * These hit the /api/cds-visual-builder router (CQL services live alongside
   * the visual condition tree under the existing visual-builder path).
   */

  async validateCQL(cqlText, subjectRef = null) {
    return request('post', '/api/cds-visual-builder/cql/validate', {
      cql: cqlText,
      subject_ref: subjectRef,
    }, 'CQL validation failed');
  }

  async deriveDataRequirements(cqlText) {
    return request('post', '/api/cds-visual-builder/cql/data-requirements', {
      cql: cqlText,
    }, 'data-requirements derivation failed');
  }

  async getServiceFHIRPreview(serviceId) {
    return request('get', `/api/cds-visual-builder/services/${serviceId}/fhir-preview`, undefined, 'FHIR preview unavailable');
  }

  /**
   * ValueSet Composer Operations (Phase 2). These talk directly to the
   * cds-studio router's value-sets sub-resource.
   */

  async listValueSets({ search, createdBy, limit = 50, skip = 0 } = {}) {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (createdBy) params.append('created_by', createdBy);
    params.append('limit', String(limit));
    params.append('skip', String(skip));
    return request('get', `${API_BASE}/value-sets?${params}`, undefined, 'Failed to list ValueSets');
  }

  async getValueSet(vsId) {
    return request('get', `${API_BASE}/value-sets/${vsId}`, undefined, 'Failed to load ValueSet');
  }

  async createValueSet(payload) {
    return request('post', `${API_BASE}/value-sets`, payload, 'Failed to create ValueSet');
  }

  async updateValueSet(vsId, payload) {
    return request('put', `${API_BASE}/value-sets/${vsId}`, payload, 'Failed to update ValueSet');
  }

  async deleteValueSet(vsId, { purge = false } = {}) {
    const params = purge ? '?purge=true' : '';
    try {
      await api.delete(`${API_BASE}/value-sets/${vsId}${params}`);
    } catch (error) {
      if (error.response?.status !== 404) {
        throw new Error(`Failed to delete ValueSet: ${error.response?.status || error.message}`);
      }
    }
    return true;
  }

  async expandValueSet(vsId, { filter = null, count = 50 } = {}) {
    const params = new URLSearchParams();
    if (filter) params.append('filter_text', filter);
    params.append('count', String(count));
    return request('get', `${API_BASE}/value-sets/${vsId}/expand?${params}`, undefined, 'Failed to expand ValueSet');
  }
}

export default new CDSStudioAPI();
