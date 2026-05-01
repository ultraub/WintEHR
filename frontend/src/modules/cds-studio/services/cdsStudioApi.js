/**
 * CDS Studio API Client
 *
 * Handles all communication with the CDS Studio backend API.
 */

const API_BASE = '/api/cds-studio';

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

    const response = await fetch(`${API_BASE}/services?${params}`, {
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`Failed to list services: ${response.statusText}`);
    }

    return response.json();
  }

  async getServiceConfiguration(serviceId) {
    const response = await fetch(`${API_BASE}/services/${serviceId}/config`, {
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`Failed to get service configuration: ${response.statusText}`);
    }

    return response.json();
  }

  async getConfigurationView(serviceId) {
    const response = await fetch(`${API_BASE}/services/${serviceId}/config/view`, {
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`Failed to get configuration view: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Service Creation Operations
   */

  async createBuiltInService(serviceData) {
    const response = await fetch(`${API_BASE}/services/built-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify(serviceData)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to create built-in service');
    }

    return response.json();
  }

  async createExternalService(serviceData) {
    const response = await fetch(`${API_BASE}/services/external`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify(serviceData)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to create external service');
    }

    return response.json();
  }

  /**
   * Service Testing Operations
   */

  async testService(serviceId, testRequest) {
    const response = await fetch(`${API_BASE}/services/${serviceId}/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify(testRequest)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to test service');
    }

    return response.json();
  }

  /**
   * Service Metrics Operations
   */

  async getServiceMetrics(serviceId) {
    const response = await fetch(`${API_BASE}/services/${serviceId}/metrics`, {
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`Failed to get service metrics: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Service Management Operations
   */

  async updateServiceStatus(serviceId, status) {
    const response = await fetch(`${API_BASE}/services/${serviceId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({ status })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to update service status');
    }

    return response.json();
  }

  async deleteService(serviceId, hardDelete = false) {
    const params = new URLSearchParams();
    if (hardDelete) params.append('hard_delete', 'true');

    const response = await fetch(`${API_BASE}/services/${serviceId}?${params}`, {
      method: 'DELETE',
      credentials: 'include'
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to delete service');
    }

    return response.json();
  }

  /**
   * Version Management Operations
   */

  async getVersionHistory(serviceId) {
    const response = await fetch(`${API_BASE}/services/${serviceId}/versions`, {
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`Failed to get version history: ${response.statusText}`);
    }

    return response.json();
  }

  async rollbackService(serviceId, targetVersion, notes = null) {
    const response = await fetch(`${API_BASE}/services/${serviceId}/rollback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        target_version: targetVersion,
        rollback_notes: notes
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to rollback service');
    }

    return response.json();
  }

  /**
   * Credentials Management Operations
   */

  async listCredentials() {
    const response = await fetch(`${API_BASE}/credentials`, {
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`Failed to list credentials: ${response.statusText}`);
    }

    return response.json();
  }

  async getCredential(credentialId) {
    const response = await fetch(`${API_BASE}/credentials/${credentialId}`, {
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`Failed to get credential: ${response.statusText}`);
    }

    return response.json();
  }

  async createCredential(credentialData) {
    const response = await fetch(`${API_BASE}/credentials`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify(credentialData)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to create credential');
    }

    return response.json();
  }

  async updateCredential(credentialId, credentialData) {
    const response = await fetch(`${API_BASE}/credentials/${credentialId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify(credentialData)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to update credential');
    }

    return response.json();
  }

  async deleteCredential(credentialId) {
    const response = await fetch(`${API_BASE}/credentials/${credentialId}`, {
      method: 'DELETE',
      credentials: 'include'
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to delete credential');
    }

    return response.json();
  }

  /**
   * Monitoring and Metrics Operations
   */

  async getSystemMetrics(timeRange = '24h') {
    const response = await fetch(`${API_BASE}/metrics?time_range=${timeRange}`, {
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`Failed to get system metrics: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * CQL Authoring Operations (Phase 1+ of student CQL feature).
   *
   * These hit the /api/cds-visual-builder router (CQL services live alongside
   * the visual condition tree under the existing visual-builder path).
   */

  async validateCQL(cqlText, subjectRef = null) {
    const response = await fetch('/api/cds-visual-builder/cql/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        cql: cqlText,
        subject_ref: subjectRef,
      }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || `CQL validation failed: ${response.status}`);
    }
    return response.json();
  }

  async deriveDataRequirements(cqlText) {
    const response = await fetch('/api/cds-visual-builder/cql/data-requirements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ cql: cqlText }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || `data-requirements derivation failed: ${response.status}`);
    }
    return response.json();
  }

  async getServiceFHIRPreview(serviceId) {
    const response = await fetch(
      `/api/cds-visual-builder/services/${serviceId}/fhir-preview`,
      { credentials: 'include' },
    );
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || `FHIR preview unavailable: ${response.status}`);
    }
    return response.json();
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
    const response = await fetch(`${API_BASE}/value-sets?${params}`, {
      credentials: 'include',
    });
    if (!response.ok) throw new Error(`Failed to list ValueSets: ${response.status}`);
    return response.json();
  }

  async getValueSet(vsId) {
    const response = await fetch(`${API_BASE}/value-sets/${vsId}`, {
      credentials: 'include',
    });
    if (!response.ok) throw new Error(`Failed to load ValueSet: ${response.status}`);
    return response.json();
  }

  async createValueSet(payload) {
    const response = await fetch(`${API_BASE}/value-sets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to create ValueSet: ${response.status}`);
    }
    return response.json();
  }

  async updateValueSet(vsId, payload) {
    const response = await fetch(`${API_BASE}/value-sets/${vsId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to update ValueSet: ${response.status}`);
    }
    return response.json();
  }

  async deleteValueSet(vsId, { purge = false } = {}) {
    const params = purge ? '?purge=true' : '';
    const response = await fetch(`${API_BASE}/value-sets/${vsId}${params}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!response.ok && response.status !== 404) {
      throw new Error(`Failed to delete ValueSet: ${response.status}`);
    }
    return true;
  }

  async expandValueSet(vsId, { filter = null, count = 50 } = {}) {
    const params = new URLSearchParams();
    if (filter) params.append('filter_text', filter);
    params.append('count', String(count));
    const response = await fetch(
      `${API_BASE}/value-sets/${vsId}/expand?${params}`,
      { credentials: 'include' },
    );
    if (!response.ok) throw new Error(`Failed to expand ValueSet: ${response.status}`);
    return response.json();
  }
}

export default new CDSStudioAPI();
