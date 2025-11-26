/**
 * FHIR Reference Utilities
 *
 * Utilities for working with FHIR references, handling multiple reference formats:
 * - Standard FHIR: Patient/123
 * - URN format: urn:uuid:patient-id (Synthea data)
 * - Full URL: http://example.com/fhir/Patient/123
 * - Direct ID: just the ID
 */

/**
 * Extract resource ID from a FHIR reference
 * @param reference - The FHIR reference string
 * @returns The extracted ID or null
 */
export const extractId = (reference: string | null | undefined): string | null => {
  if (!reference) return null;

  // Handle URN format: urn:uuid:patient-id
  if (reference.startsWith('urn:uuid:')) {
    return reference.substring('urn:uuid:'.length);
  }

  // Handle standard FHIR references like "Patient/123" or full URLs
  if (reference.includes('/')) {
    const parts = reference.split('/');
    return parts[parts.length - 1];
  }

  // If it doesn't look like a reference, might be direct ID
  if (!reference.includes(':')) {
    return reference;
  }

  return null;
};

/**
 * Extract resource type from a FHIR reference
 * @param reference - The FHIR reference string
 * @returns The resource type or null
 */
export const extractType = (reference: string | null | undefined): string | null => {
  if (!reference) return null;

  // URN format doesn't include type
  if (reference.startsWith('urn:uuid:')) {
    return null;
  }

  // Handle standard FHIR references like "Patient/123"
  if (reference.includes('/')) {
    const parts = reference.split('/');
    // Return second to last part (handles full URLs too)
    return parts.length >= 2 ? parts[parts.length - 2] : null;
  }

  return null;
};

/**
 * Check if a FHIR reference points to a specific resource
 * @param reference - The FHIR reference to check
 * @param resourceId - The resource ID to match against
 * @returns True if the reference points to the resource
 */
export const matchesReference = (
  reference: string | null | undefined,
  resourceId: string
): boolean => {
  if (!reference || !resourceId) return false;
  return extractId(reference) === resourceId;
};

/**
 * Check if a FHIR reference points to a specific patient
 * Alias for matchesReference with clearer naming for patient contexts
 */
export const matchesPatient = matchesReference;

/**
 * Convert a reference to standard FHIR format
 * @param reference - The reference to convert
 * @param resourceType - The resource type (e.g., 'Patient')
 * @returns Standard FHIR reference format (e.g., 'Patient/123')
 */
export const standardizeReference = (
  reference: string | null | undefined,
  resourceType: string = 'Patient'
): string | null => {
  if (!reference) return null;

  const id = extractId(reference);
  if (!id) return reference || null;

  return `${resourceType}/${id}`;
};

/**
 * Build a FHIR reference object
 * @param resourceType - The resource type
 * @param id - The resource ID
 * @param display - Optional display text
 * @returns FHIR Reference object
 */
export const buildReference = (
  resourceType: string,
  id: string,
  display?: string
): { reference: string; display?: string } => {
  const ref: { reference: string; display?: string } = {
    reference: `${resourceType}/${id}`
  };

  if (display) {
    ref.display = display;
  }

  return ref;
};

/**
 * Check if a resource belongs to a specific patient
 * Checks common FHIR reference fields
 * @param resource - The FHIR resource to check
 * @param patientId - The patient ID to match against
 * @returns True if the resource belongs to the patient
 */
export const resourceBelongsToPatient = (
  resource: Record<string, unknown> | null | undefined,
  patientId: string
): boolean => {
  if (!resource || !patientId) return false;

  // Common patterns for patient references in FHIR
  const referenceFields = [
    (resource.subject as { reference?: string })?.reference,
    (resource.patient as { reference?: string })?.reference,
    resource.subject as string,
    resource.patient as string,
  ];

  // Check each potential reference field
  for (const ref of referenceFields) {
    if (ref && typeof ref === 'string' && matchesReference(ref, patientId)) {
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
 * Extract all resources from a bundle that belong to a specific patient
 * @param bundle - FHIR Bundle resource
 * @param patientId - The patient ID to filter by
 * @returns Array of resources that belong to the patient
 */
export const filterBundleByPatient = <T extends Record<string, unknown>>(
  bundle: { entry?: Array<{ resource?: T }> } | null | undefined,
  patientId: string
): T[] => {
  if (!bundle?.entry || !patientId) return [];

  return bundle.entry
    .map(entry => entry.resource)
    .filter((resource): resource is T =>
      resource !== undefined && resourceBelongsToPatient(resource, patientId)
    );
};
