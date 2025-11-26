/**
 * FHIR Reference Utilities
 * 
 * This module provides utilities for working with FHIR references,
 * particularly handling different reference formats including URN format
 * used by Synthea-generated data.
 * 
 * Created: 2025-01-21
 */

/**
 * Check if a FHIR reference points to a specific patient
 * 
 * Handles multiple reference formats:
 * - URN format: urn:uuid:patient-id (Synthea)
 * - Standard format: Patient/123
 * - Full URL: http://example.com/fhir/Patient/123
 * - Direct ID: just the patient ID
 * 
 * @param {string} reference - The FHIR reference to check
 * @param {string} patientId - The patient ID to match against
 * @returns {boolean} True if the reference points to the patient
 */
export const checkPatientReference = (reference, patientId) => {
  if (!reference || !patientId) return false;
  
  // Handle URN format: urn:uuid:patient-id
  if (reference.startsWith('urn:uuid:')) {
    const urnId = reference.substring('urn:uuid:'.length);
    return urnId === patientId;
  }
  
  // Handle standard FHIR references like "Patient/123"
  if (reference.includes('/')) {
    const refParts = reference.split('/');
    const refId = refParts[refParts.length - 1];
    return refId === patientId;
  }
  
  // Direct ID comparison
  return reference === patientId || reference === `Patient/${patientId}`;
};

/**
 * Extract patient ID from a FHIR reference
 * 
 * @param {string} reference - The FHIR reference
 * @returns {string|null} The extracted patient ID or null
 */
export const extractPatientId = (reference) => {
  if (!reference) return null;
  
  // Handle URN format: urn:uuid:patient-id
  if (reference.startsWith('urn:uuid:')) {
    return reference.substring('urn:uuid:'.length);
  }
  
  // Handle standard FHIR references like "Patient/123"
  if (reference.includes('Patient/')) {
    const refParts = reference.split('/');
    return refParts[refParts.length - 1];
  }
  
  // If it doesn't look like a reference, might be direct ID
  if (!reference.includes('/') && !reference.includes(':')) {
    return reference;
  }
  
  return null;
};

/**
 * Check if a resource belongs to a specific patient
 * 
 * Checks various fields that might contain patient references:
 * - subject.reference
 * - patient.reference
 * - performer.reference
 * - actor.reference
 * - for.reference
 * - beneficiary.reference
 * - individual.reference
 * 
 * @param {Object} resource - The FHIR resource to check
 * @param {string} patientId - The patient ID to match against
 * @returns {boolean} True if the resource belongs to the patient
 */
export const resourceBelongsToPatient = (resource, patientId) => {
  if (!resource || !patientId) return false;
  
  // Common patterns for patient references in FHIR
  const referenceFields = [
    resource.subject?.reference,
    resource.patient?.reference,
    resource.performer?.reference,
    resource.actor?.reference,
    resource.for?.reference,
    resource.beneficiary?.reference,
    resource.individual?.reference,
    // Some resources might have direct patient ID without 'reference' wrapper
    resource.subject,
    resource.patient
  ];
  
  // Check each potential reference field
  for (const ref of referenceFields) {
    if (ref && typeof ref === 'string' && checkPatientReference(ref, patientId)) {
      return true;
    }
  }
  
  // Special case: Check if this is the patient resource itself
  if (resource.resourceType === 'Patient' && resource.id === patientId) {
    return true;
  }
  
  return false;
};

/**
 * Get all resources from a bundle that belong to a specific patient
 * 
 * @param {Object} bundle - FHIR Bundle resource
 * @param {string} patientId - The patient ID to filter by
 * @returns {Array} Array of resources that belong to the patient
 */
export const filterBundleByPatient = (bundle, patientId) => {
  if (!bundle?.entry || !patientId) return [];
  
  return bundle.entry
    .map(entry => entry.resource)
    .filter(resource => resource && resourceBelongsToPatient(resource, patientId));
};

/**
 * Convert a reference to standard FHIR format
 *
 * @param {string} reference - The reference to convert
 * @param {string} resourceType - The resource type (e.g., 'Patient')
 * @returns {string} Standard FHIR reference format
 */
export const standardizeReference = (reference, resourceType = 'Patient') => {
  if (!reference) return null;

  const id = extractPatientId(reference);
  if (!id) return reference;

  return `${resourceType}/${id}`;
};

/**
 * Resolve a contained resource reference within a parent resource
 *
 * In FHIR, contained resources are embedded within a parent resource and
 * referenced using a '#' prefix. This is commonly used for inline resources
 * like Medication within MedicationRequest.
 *
 * HAPI FHIR v8.0.0+ change: Contained resources no longer have IDs starting
 * with '#' - the '#' only appears in references. For example:
 * - Reference: "#med-123"
 * - Contained resource ID: "med-123"
 *
 * @param {Object} parentResource - The parent FHIR resource containing the embedded resources
 * @param {string} reference - The contained reference (e.g., "#med-123")
 * @returns {Object|null} The contained resource or null if not found
 *
 * @example
 * const medRequest = {
 *   resourceType: 'MedicationRequest',
 *   contained: [{ id: 'med-123', resourceType: 'Medication', ... }],
 *   medicationReference: { reference: '#med-123' }
 * };
 * const medication = resolveContainedResource(medRequest, '#med-123');
 */
export const resolveContainedResource = (parentResource, reference) => {
  // Validate inputs
  if (!parentResource || !reference) {
    return null;
  }

  // Handle Reference objects
  const refString = typeof reference === 'string'
    ? reference
    : reference.reference;

  if (!refString) {
    return null;
  }

  // Contained references must start with '#'
  if (!refString.startsWith('#')) {
    return null;
  }

  // Extract the ID by removing the '#' prefix
  // HAPI FHIR v8+: contained resources have IDs like "med-123"
  // but references use "#med-123"
  const containedId = refString.substring(1);

  // Check if parent has contained resources
  const contained = parentResource.contained;
  if (!Array.isArray(contained) || contained.length === 0) {
    return null;
  }

  // Find the contained resource by ID
  // Support both old format (id: "#med-123") and new format (id: "med-123")
  return contained.find(resource =>
    resource.id === containedId || resource.id === `#${containedId}`
  ) || null;
};

/**
 * Check if a reference is a contained reference
 *
 * @param {string|Object} reference - The reference to check
 * @returns {boolean} True if this is a contained reference
 */
export const isContainedReference = (reference) => {
  if (!reference) return false;

  const refString = typeof reference === 'string'
    ? reference
    : reference.reference;

  return refString?.startsWith('#') || false;
};