/**
 * FHIR Reference Utilities Tests
 *
 * Tests for reference validation and extraction functions
 * @since 2025-11-26
 */

import {
  extractId,
  extractType,
  matchesReference,
  standardizeReference,
  buildReference,
  resourceBelongsToPatient,
  filterBundleByPatient,
  validateReference,
  isValidReference,
  validateReferenceObject,
  getReferenceString,
  resolveContainedReference,
  isContainedReference,
  VALID_RESOURCE_TYPES
} from '../references';

describe('FHIR Reference Utilities', () => {
  describe('extractId', () => {
    test('should extract ID from standard FHIR reference', () => {
      expect(extractId('Patient/123')).toBe('123');
      expect(extractId('Observation/abc-def-ghi')).toBe('abc-def-ghi');
    });

    test('should extract ID from URN format', () => {
      expect(extractId('urn:uuid:patient-123')).toBe('patient-123');
      expect(extractId('urn:uuid:550e8400-e29b-41d4-a716-446655440000')).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    test('should extract ID from full URL', () => {
      expect(extractId('http://example.com/fhir/Patient/123')).toBe('123');
      expect(extractId('https://hapi.fhir.org/baseR4/Observation/xyz')).toBe('xyz');
    });

    test('should return direct ID if no slashes or colons', () => {
      expect(extractId('12345')).toBe('12345');
    });

    test('should return null for empty or null input', () => {
      expect(extractId(null)).toBeNull();
      expect(extractId(undefined)).toBeNull();
      expect(extractId('')).toBeNull();
    });
  });

  describe('extractType', () => {
    test('should extract resource type from standard reference', () => {
      expect(extractType('Patient/123')).toBe('Patient');
      expect(extractType('Observation/abc')).toBe('Observation');
    });

    test('should extract type from full URL', () => {
      expect(extractType('http://example.com/fhir/Patient/123')).toBe('Patient');
    });

    test('should return null for URN format', () => {
      expect(extractType('urn:uuid:patient-123')).toBeNull();
    });

    test('should return null for empty or null input', () => {
      expect(extractType(null)).toBeNull();
      expect(extractType(undefined)).toBeNull();
    });
  });

  describe('matchesReference', () => {
    test('should match standard references', () => {
      expect(matchesReference('Patient/123', '123')).toBe(true);
      expect(matchesReference('Patient/123', '456')).toBe(false);
    });

    test('should match URN references', () => {
      expect(matchesReference('urn:uuid:abc-123', 'abc-123')).toBe(true);
    });

    test('should return false for null inputs', () => {
      expect(matchesReference(null, '123')).toBe(false);
      expect(matchesReference('Patient/123', '')).toBe(false);
    });
  });

  describe('standardizeReference', () => {
    test('should convert URN to standard format', () => {
      expect(standardizeReference('urn:uuid:abc-123', 'Patient')).toBe('Patient/abc-123');
    });

    test('should keep standard format unchanged', () => {
      expect(standardizeReference('Patient/123', 'Patient')).toBe('Patient/123');
    });

    test('should handle null input', () => {
      expect(standardizeReference(null)).toBeNull();
    });
  });

  describe('buildReference', () => {
    test('should build reference without display', () => {
      expect(buildReference('Patient', '123')).toEqual({
        reference: 'Patient/123'
      });
    });

    test('should build reference with display', () => {
      expect(buildReference('Patient', '123', 'John Doe')).toEqual({
        reference: 'Patient/123',
        display: 'John Doe'
      });
    });
  });

  describe('resourceBelongsToPatient', () => {
    test('should detect patient reference in subject', () => {
      const resource = {
        resourceType: 'Observation',
        subject: { reference: 'Patient/123' }
      };
      expect(resourceBelongsToPatient(resource, '123')).toBe(true);
      expect(resourceBelongsToPatient(resource, '456')).toBe(false);
    });

    test('should detect patient reference in patient field', () => {
      const resource = {
        resourceType: 'MedicationRequest',
        patient: { reference: 'Patient/123' }
      };
      expect(resourceBelongsToPatient(resource, '123')).toBe(true);
    });

    test('should match Patient resource by ID', () => {
      const patient = {
        resourceType: 'Patient',
        id: '123'
      };
      expect(resourceBelongsToPatient(patient, '123')).toBe(true);
    });

    test('should return false for null inputs', () => {
      expect(resourceBelongsToPatient(null, '123')).toBe(false);
      expect(resourceBelongsToPatient({}, '')).toBe(false);
    });
  });

  describe('filterBundleByPatient', () => {
    test('should filter bundle entries by patient', () => {
      const bundle = {
        entry: [
          { resource: { resourceType: 'Observation', subject: { reference: 'Patient/123' } } },
          { resource: { resourceType: 'Observation', subject: { reference: 'Patient/456' } } },
          { resource: { resourceType: 'Patient', id: '123' } }
        ]
      };

      const result = filterBundleByPatient(bundle, '123');
      expect(result).toHaveLength(2);
    });

    test('should return empty array for null bundle', () => {
      expect(filterBundleByPatient(null, '123')).toEqual([]);
    });
  });
});

describe('Reference Validation', () => {
  describe('validateReference', () => {
    test('should validate standard FHIR reference', () => {
      const result = validateReference('Patient/123');
      expect(result.isValid).toBe(true);
      expect(result.resourceType).toBe('Patient');
      expect(result.resourceId).toBe('123');
      expect(result.isContained).toBe(false);
      expect(result.isAbsolute).toBe(false);
    });

    test('should validate absolute URL reference', () => {
      const result = validateReference('http://example.com/fhir/Patient/123');
      expect(result.isValid).toBe(true);
      expect(result.isAbsolute).toBe(true);
      expect(result.resourceId).toBe('123');
    });

    test('should validate contained reference', () => {
      const result = validateReference('#med-123');
      expect(result.isValid).toBe(true);
      expect(result.isContained).toBe(true);
      expect(result.resourceId).toBe('med-123');
    });

    test('should validate URN reference', () => {
      const result = validateReference('urn:uuid:abc-123');
      expect(result.isValid).toBe(true);
      expect(result.resourceId).toBe('abc-123');
    });

    test('should reject empty reference', () => {
      const result = validateReference('');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Reference is empty or undefined');
    });

    test('should reject null reference', () => {
      const result = validateReference(null);
      expect(result.isValid).toBe(false);
    });

    test('should validate expected resource type', () => {
      const result = validateReference('Patient/123', { expectedType: 'Patient' });
      expect(result.isValid).toBe(true);
    });

    test('should reject unexpected resource type', () => {
      const result = validateReference('Observation/123', { expectedType: 'Patient' });
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Expected resource type'))).toBe(true);
    });

    test('should accept multiple expected types', () => {
      const result = validateReference('Observation/123', {
        expectedType: ['Patient', 'Observation']
      });
      expect(result.isValid).toBe(true);
    });

    test('should reject contained when not allowed', () => {
      const result = validateReference('#med-123', { allowContained: false });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Contained references are not allowed');
    });

    test('should reject absolute when not allowed', () => {
      const result = validateReference('http://example.com/fhir/Patient/123', {
        allowAbsolute: false
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Absolute URL references are not allowed');
    });

    test('should reject URN when not allowed', () => {
      const result = validateReference('urn:uuid:abc-123', { allowUrn: false });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('URN references are not allowed');
    });

    test('should validate strict resource types', () => {
      const result = validateReference('InvalidType/123', { strictTypeValidation: true });
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Unknown resource type'))).toBe(true);
    });
  });

  describe('isValidReference', () => {
    test('should return true for valid reference', () => {
      expect(isValidReference('Patient/123')).toBe(true);
    });

    test('should return false for invalid reference', () => {
      expect(isValidReference('')).toBe(false);
      expect(isValidReference(null)).toBe(false);
    });

    test('should check expected type', () => {
      expect(isValidReference('Patient/123', 'Patient')).toBe(true);
      expect(isValidReference('Patient/123', 'Observation')).toBe(false);
    });
  });

  describe('validateReferenceObject', () => {
    test('should validate reference object', () => {
      const result = validateReferenceObject({ reference: 'Patient/123' });
      expect(result.isValid).toBe(true);
    });

    test('should reject null object', () => {
      const result = validateReferenceObject(null);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Reference object is null or undefined');
    });

    test('should reject object without reference property', () => {
      const result = validateReferenceObject({ display: 'John Doe' } as any);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Reference object is missing reference property');
    });
  });

  describe('getReferenceString', () => {
    test('should extract string from string input', () => {
      expect(getReferenceString('Patient/123')).toBe('Patient/123');
    });

    test('should extract string from object', () => {
      expect(getReferenceString({ reference: 'Patient/123' })).toBe('Patient/123');
    });

    test('should return null for null input', () => {
      expect(getReferenceString(null)).toBeNull();
    });
  });

  describe('resolveContainedReference', () => {
    const parentResource = {
      resourceType: 'MedicationRequest',
      contained: [
        { resourceType: 'Medication', id: 'med-123', code: { text: 'Aspirin' } },
        { resourceType: 'Medication', id: 'med-456', code: { text: 'Ibuprofen' } }
      ]
    };

    test('should resolve contained reference', () => {
      const result = resolveContainedReference(parentResource, '#med-123');
      expect(result).toBeDefined();
      expect(result?.id).toBe('med-123');
    });

    test('should resolve from reference object', () => {
      const result = resolveContainedReference(parentResource, { reference: '#med-456' });
      expect(result).toBeDefined();
      expect(result?.id).toBe('med-456');
    });

    test('should return null for non-existent reference', () => {
      const result = resolveContainedReference(parentResource, '#med-999');
      expect(result).toBeNull();
    });

    test('should return null for non-contained reference', () => {
      const result = resolveContainedReference(parentResource, 'Medication/ext-123');
      expect(result).toBeNull();
    });

    test('should return null for null parent', () => {
      expect(resolveContainedReference(null, '#med-123')).toBeNull();
    });
  });

  describe('isContainedReference', () => {
    test('should identify contained reference string', () => {
      expect(isContainedReference('#med-123')).toBe(true);
    });

    test('should identify contained reference object', () => {
      expect(isContainedReference({ reference: '#med-123' })).toBe(true);
    });

    test('should reject non-contained reference', () => {
      expect(isContainedReference('Medication/123')).toBe(false);
    });

    test('should handle null', () => {
      expect(isContainedReference(null)).toBe(false);
    });
  });

  describe('VALID_RESOURCE_TYPES', () => {
    test('should contain common FHIR resource types', () => {
      expect(VALID_RESOURCE_TYPES).toContain('Patient');
      expect(VALID_RESOURCE_TYPES).toContain('Observation');
      expect(VALID_RESOURCE_TYPES).toContain('MedicationRequest');
      expect(VALID_RESOURCE_TYPES).toContain('Condition');
    });

    test('should be a readonly array', () => {
      expect(Array.isArray(VALID_RESOURCE_TYPES)).toBe(true);
    });
  });
});
