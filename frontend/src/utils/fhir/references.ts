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

// ============================================================================
// Reference Validation Functions
// ============================================================================

/**
 * Valid FHIR resource types for reference validation
 * This list includes the most commonly used resource types in WintEHR
 */
export const VALID_RESOURCE_TYPES = [
  'Patient', 'Practitioner', 'PractitionerRole', 'Organization', 'Location',
  'Condition', 'Observation', 'DiagnosticReport', 'ServiceRequest',
  'MedicationRequest', 'MedicationDispense', 'MedicationAdministration', 'Medication',
  'AllergyIntolerance', 'Immunization', 'Procedure', 'Encounter',
  'DocumentReference', 'Composition', 'CarePlan', 'Goal', 'Task',
  'Coverage', 'Device', 'ImagingStudy', 'Specimen', 'CareTeam'
] as const;

export type ValidResourceType = typeof VALID_RESOURCE_TYPES[number];

/**
 * Reference validation result
 */
export interface ReferenceValidationResult {
  isValid: boolean;
  errors: string[];
  resourceType: string | null;
  resourceId: string | null;
  isContained: boolean;
  isAbsolute: boolean;
}

/**
 * Validate a FHIR reference string
 *
 * Educational note: FHIR references can be in several formats:
 * - Relative: "Patient/123"
 * - Absolute: "http://example.com/fhir/Patient/123"
 * - Contained: "#med-123" (references a contained resource)
 * - URN: "urn:uuid:abc-123" (used by Synthea and bundles)
 *
 * This function validates that a reference is properly formatted
 * and optionally checks that it references an expected resource type.
 *
 * @param reference - The reference string to validate
 * @param options - Validation options
 * @returns Validation result with detailed information
 */
export const validateReference = (
  reference: string | null | undefined,
  options: {
    expectedType?: string | string[];  // Expected resource type(s)
    allowContained?: boolean;          // Allow contained references (default: true)
    allowAbsolute?: boolean;           // Allow absolute URLs (default: true)
    allowUrn?: boolean;                // Allow URN format (default: true)
    strictTypeValidation?: boolean;    // Only allow known resource types (default: false)
  } = {}
): ReferenceValidationResult => {
  const {
    expectedType,
    allowContained = true,
    allowAbsolute = true,
    allowUrn = true,
    strictTypeValidation = false
  } = options;

  const result: ReferenceValidationResult = {
    isValid: true,
    errors: [],
    resourceType: null,
    resourceId: null,
    isContained: false,
    isAbsolute: false
  };

  // Check for null/undefined/empty
  if (!reference || reference.trim() === '') {
    result.isValid = false;
    result.errors.push('Reference is empty or undefined');
    return result;
  }

  const trimmedRef = reference.trim();

  // Check for contained reference
  if (trimmedRef.startsWith('#')) {
    result.isContained = true;
    if (!allowContained) {
      result.isValid = false;
      result.errors.push('Contained references are not allowed');
    }
    result.resourceId = trimmedRef.substring(1);
    return result;
  }

  // Check for URN format
  if (trimmedRef.startsWith('urn:')) {
    if (!allowUrn) {
      result.isValid = false;
      result.errors.push('URN references are not allowed');
      return result;
    }

    // Validate URN format
    if (!trimmedRef.startsWith('urn:uuid:') && !trimmedRef.startsWith('urn:oid:')) {
      result.isValid = false;
      result.errors.push('Invalid URN format - expected urn:uuid: or urn:oid:');
      return result;
    }

    result.resourceId = extractId(trimmedRef);
    return result;
  }

  // Check for absolute URL
  if (trimmedRef.startsWith('http://') || trimmedRef.startsWith('https://')) {
    result.isAbsolute = true;
    if (!allowAbsolute) {
      result.isValid = false;
      result.errors.push('Absolute URL references are not allowed');
    }
  }

  // Extract resource type and ID
  result.resourceType = extractType(trimmedRef);
  result.resourceId = extractId(trimmedRef);

  // Validate relative reference format (should be ResourceType/id)
  if (!result.isAbsolute && !trimmedRef.includes('/')) {
    result.isValid = false;
    result.errors.push('Reference must be in format ResourceType/id');
    return result;
  }

  // Validate resource type if extracted
  if (result.resourceType) {
    // Check if it's a known resource type
    if (strictTypeValidation && !VALID_RESOURCE_TYPES.includes(result.resourceType as ValidResourceType)) {
      result.isValid = false;
      result.errors.push(`Unknown resource type: ${result.resourceType}`);
    }

    // Check if it matches expected type(s)
    if (expectedType) {
      const expectedTypes = Array.isArray(expectedType) ? expectedType : [expectedType];
      if (!expectedTypes.includes(result.resourceType)) {
        result.isValid = false;
        result.errors.push(
          `Expected resource type ${expectedTypes.join(' or ')}, got ${result.resourceType}`
        );
      }
    }
  }

  // Validate that we have an ID
  if (!result.resourceId || result.resourceId.trim() === '') {
    result.isValid = false;
    result.errors.push('Reference is missing resource ID');
  }

  return result;
};

/**
 * Check if a reference is valid (simple boolean check)
 *
 * @param reference - The reference to check
 * @param expectedType - Optional expected resource type(s)
 * @returns True if valid
 */
export const isValidReference = (
  reference: string | null | undefined,
  expectedType?: string | string[]
): boolean => {
  return validateReference(reference, { expectedType }).isValid;
};

/**
 * Validate that a Reference object (not just string) is valid
 *
 * @param refObj - FHIR Reference object with reference property
 * @param expectedType - Optional expected resource type(s)
 * @returns Validation result
 */
export const validateReferenceObject = (
  refObj: { reference?: string; display?: string } | null | undefined,
  expectedType?: string | string[]
): ReferenceValidationResult => {
  if (!refObj) {
    return {
      isValid: false,
      errors: ['Reference object is null or undefined'],
      resourceType: null,
      resourceId: null,
      isContained: false,
      isAbsolute: false
    };
  }

  if (!refObj.reference) {
    return {
      isValid: false,
      errors: ['Reference object is missing reference property'],
      resourceType: null,
      resourceId: null,
      isContained: false,
      isAbsolute: false
    };
  }

  return validateReference(refObj.reference, { expectedType });
};

/**
 * Safely get reference string from various input formats
 *
 * Educational note: References in FHIR can appear as:
 * - String: "Patient/123"
 * - Object: { reference: "Patient/123", display: "John Doe" }
 * - Nested: { subject: { reference: "Patient/123" } }
 *
 * @param input - Input that might contain a reference
 * @returns Reference string or null
 */
export const getReferenceString = (
  input: string | { reference?: string } | null | undefined
): string | null => {
  if (!input) return null;

  if (typeof input === 'string') {
    return input;
  }

  if (typeof input === 'object' && 'reference' in input && input.reference) {
    return input.reference;
  }

  return null;
};

/**
 * Resolve a contained reference from a parent resource
 *
 * @param parentResource - Parent FHIR resource with contained array
 * @param reference - The contained reference (e.g., "#med-123")
 * @returns The contained resource or null
 */
export const resolveContainedReference = <T extends Record<string, unknown>>(
  parentResource: { contained?: T[] } | null | undefined,
  reference: string | { reference?: string } | null | undefined
): T | null => {
  if (!parentResource?.contained || !Array.isArray(parentResource.contained)) {
    return null;
  }

  const refString = getReferenceString(reference);
  if (!refString || !refString.startsWith('#')) {
    return null;
  }

  const containedId = refString.substring(1);

  // Support both old format (id: "#med-123") and new format (id: "med-123")
  return parentResource.contained.find(
    (resource) => resource.id === containedId || resource.id === `#${containedId}`
  ) as T | undefined ?? null;
};

/**
 * Check if a reference points to a contained resource
 *
 * @param reference - Reference to check
 * @returns True if it's a contained reference
 */
export const isContainedReference = (
  reference: string | { reference?: string } | null | undefined
): boolean => {
  const refString = getReferenceString(reference);
  return refString?.startsWith('#') ?? false;
};
