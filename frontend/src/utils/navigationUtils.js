/**
 * Navigation utilities for FHIR-compliant routing
 */

/**
 * Safely encode a FHIR resource ID for use in URLs
 * FHIR IDs can contain characters that need URL encoding
 */
export const encodeFhirId = (id) => {
  if (!id) return '';
  // URL encode the ID to handle special characters
  return encodeURIComponent(id);
};

/**
 * Decode a FHIR resource ID from a URL parameter
 */
export const decodeFhirId = (encodedId) => {
  if (!encodedId) return '';
  try {
    return decodeURIComponent(encodedId);
  } catch (error) {
    
    return encodedId; // Return as-is if decoding fails
  }
};

/**
 * Build a patient detail URL with proper ID encoding
 */
export const getPatientDetailUrl = (patientId) => {
  return `/patients/${encodeFhirId(patientId)}`;
};

/**
 * Build a clinical workspace URL with proper ID encoding
 */
export const getClinicalWorkspaceUrl = (patientId, options = {}) => {
  const { mode, encounterId } = options;
  let url = `/clinical-workspace/${encodeFhirId(patientId)}`;
  
  const params = new URLSearchParams();
  if (mode) params.append('mode', mode);
  if (encounterId) params.append('encounter', encounterId);
  
  const queryString = params.toString();
  if (queryString) {
    url += `?${queryString}`;
  }
  
  return url;
};

/**
 * Build an encounter detail URL with proper ID encoding
 */
export const getEncounterDetailUrl = (patientId, encounterId) => {
  return `/patients/${encodeFhirId(patientId)}/encounters/${encodeFhirId(encounterId)}`;
};

/**
 * Build an audit trail URL with proper ID encoding
 */
export const getAuditTrailUrl = (resourceType, resourceId) => {
  if (resourceType === 'Patient') {
    return `/audit-trail/patient/${encodeFhirId(resourceId)}`;
  }
  return `/audit-trail/${encodeURIComponent(resourceType)}/${encodeFhirId(resourceId)}`;
};

/**
 * Extract and decode a FHIR ID from route params
 */
export const getFhirIdFromParams = (params, paramName = 'id') => {
  const encodedId = params[paramName];
  return decodeFhirId(encodedId);
};