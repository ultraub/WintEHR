/**
 * FHIR Field Utilities Tests
 *
 * Tests for CodeableConcept extraction and field access utilities
 * @since 2025-11-26
 */

import {
  getConditionStatus,
  getConditionVerificationStatus,
  getMedicationStatus,
  getObservationCategory,
  getObservationStatus,
  getEncounterClass,
  getEncounterStatus,
  getResourceDisplayText,
  getCodeableConceptDisplay,
  getCodeableConceptCode,
  getCodeableConceptSystem,
  getCodingBySystem,
  getAllCodings,
  hasCode,
  getCodeableConceptArrayDisplay,
  getCodeableConceptArrayCode,
  getAllCodeableConceptDisplays,
  createCodeableConcept,
  getReferenceId,
  isConditionActive,
  isMedicationActive,
  isObservationLaboratory,
  isObservationFinal
} from '../fhirFieldUtils';

describe('FHIR Field Utilities', () => {
  describe('CodeableConcept Extraction', () => {
    describe('getCodeableConceptDisplay', () => {
      test('should return text property if present', () => {
        const cc = { text: 'Blood Pressure', coding: [{ display: 'BP' }] };
        expect(getCodeableConceptDisplay(cc)).toBe('Blood Pressure');
      });

      test('should fall back to coding display', () => {
        const cc = { coding: [{ display: 'Blood Pressure', code: '8480-6' }] };
        expect(getCodeableConceptDisplay(cc)).toBe('Blood Pressure');
      });

      test('should fall back to coding code', () => {
        const cc = { coding: [{ code: '8480-6' }] };
        expect(getCodeableConceptDisplay(cc)).toBe('8480-6');
      });

      test('should return default value for null', () => {
        expect(getCodeableConceptDisplay(null)).toBe('Unknown');
        expect(getCodeableConceptDisplay(null, 'N/A')).toBe('N/A');
      });

      test('should return default for empty CodeableConcept', () => {
        expect(getCodeableConceptDisplay({})).toBe('Unknown');
        expect(getCodeableConceptDisplay({ coding: [] })).toBe('Unknown');
      });
    });

    describe('getCodeableConceptCode', () => {
      test('should extract first coding code', () => {
        const cc = { coding: [{ code: '8480-6', display: 'BP' }] };
        expect(getCodeableConceptCode(cc)).toBe('8480-6');
      });

      test('should return null for empty coding array', () => {
        expect(getCodeableConceptCode({ coding: [] })).toBeNull();
      });

      test('should return null for null input', () => {
        expect(getCodeableConceptCode(null)).toBeNull();
        expect(getCodeableConceptCode(undefined)).toBeNull();
      });

      test('should handle missing coding property', () => {
        expect(getCodeableConceptCode({ text: 'BP' })).toBeNull();
      });
    });

    describe('getCodeableConceptSystem', () => {
      test('should extract first coding system', () => {
        const cc = { coding: [{ system: 'http://loinc.org', code: '8480-6' }] };
        expect(getCodeableConceptSystem(cc)).toBe('http://loinc.org');
      });

      test('should return null for missing system', () => {
        const cc = { coding: [{ code: '8480-6' }] };
        expect(getCodeableConceptSystem(cc)).toBeNull();
      });

      test('should return null for null input', () => {
        expect(getCodeableConceptSystem(null)).toBeNull();
      });
    });

    describe('getCodingBySystem', () => {
      test('should find coding by system', () => {
        const cc = {
          coding: [
            { system: 'http://loinc.org', code: '8480-6', display: 'LOINC BP' },
            { system: 'http://snomed.info/sct', code: '271649006', display: 'SNOMED BP' }
          ]
        };

        const result = getCodingBySystem(cc, 'http://snomed.info/sct');
        expect(result).toBeDefined();
        expect(result.code).toBe('271649006');
      });

      test('should return null for non-existent system', () => {
        const cc = { coding: [{ system: 'http://loinc.org', code: '8480-6' }] };
        expect(getCodingBySystem(cc, 'http://snomed.info/sct')).toBeNull();
      });

      test('should return null for null inputs', () => {
        expect(getCodingBySystem(null, 'http://loinc.org')).toBeNull();
        expect(getCodingBySystem({ coding: [] }, null)).toBeNull();
      });
    });

    describe('getAllCodings', () => {
      test('should return all codings', () => {
        const cc = {
          coding: [
            { code: '1' },
            { code: '2' },
            { code: '3' }
          ]
        };
        expect(getAllCodings(cc)).toHaveLength(3);
      });

      test('should filter out null/undefined entries', () => {
        const cc = { coding: [{ code: '1' }, null, undefined, { code: '2' }] };
        expect(getAllCodings(cc)).toHaveLength(2);
      });

      test('should return empty array for null', () => {
        expect(getAllCodings(null)).toEqual([]);
        expect(getAllCodings({ text: 'BP' })).toEqual([]);
      });
    });

    describe('hasCode', () => {
      test('should find code in CodeableConcept', () => {
        const cc = { coding: [{ code: '8480-6', system: 'http://loinc.org' }] };
        expect(hasCode(cc, '8480-6')).toBe(true);
        expect(hasCode(cc, '8480-7')).toBe(false);
      });

      test('should match with system restriction', () => {
        const cc = {
          coding: [
            { code: '123', system: 'http://loinc.org' },
            { code: '123', system: 'http://snomed.info/sct' }
          ]
        };

        expect(hasCode(cc, '123', 'http://loinc.org')).toBe(true);
        expect(hasCode(cc, '123', 'http://example.org')).toBe(false);
      });

      test('should return false for null inputs', () => {
        expect(hasCode(null, '123')).toBe(false);
        expect(hasCode({ coding: [] }, null)).toBe(false);
      });
    });

    describe('getCodeableConceptArrayDisplay', () => {
      test('should get display from first element', () => {
        const arr = [
          { text: 'First' },
          { text: 'Second' }
        ];
        expect(getCodeableConceptArrayDisplay(arr)).toBe('First');
      });

      test('should get display from specified index', () => {
        const arr = [
          { text: 'First' },
          { text: 'Second' }
        ];
        expect(getCodeableConceptArrayDisplay(arr, 1)).toBe('Second');
      });

      test('should return default for out of bounds', () => {
        const arr = [{ text: 'First' }];
        expect(getCodeableConceptArrayDisplay(arr, 5)).toBe('Unknown');
        expect(getCodeableConceptArrayDisplay(arr, -1)).toBe('Unknown');
      });

      test('should return default for empty array', () => {
        expect(getCodeableConceptArrayDisplay([])).toBe('Unknown');
        expect(getCodeableConceptArrayDisplay(null)).toBe('Unknown');
      });
    });

    describe('getCodeableConceptArrayCode', () => {
      test('should get code from first element', () => {
        const arr = [{ coding: [{ code: 'ABC' }] }];
        expect(getCodeableConceptArrayCode(arr)).toBe('ABC');
      });

      test('should return null for empty array', () => {
        expect(getCodeableConceptArrayCode([])).toBeNull();
        expect(getCodeableConceptArrayCode(null)).toBeNull();
      });
    });

    describe('getAllCodeableConceptDisplays', () => {
      test('should get all displays from array', () => {
        const arr = [
          { text: 'First' },
          { coding: [{ display: 'Second' }] },
          { text: 'Third' }
        ];
        expect(getAllCodeableConceptDisplays(arr)).toEqual(['First', 'Second', 'Third']);
      });

      test('should filter out null displays', () => {
        const arr = [
          { text: 'First' },
          {},
          { text: 'Third' }
        ];
        const result = getAllCodeableConceptDisplays(arr);
        expect(result).toHaveLength(2);
      });

      test('should return empty array for null', () => {
        expect(getAllCodeableConceptDisplays(null)).toEqual([]);
      });
    });

    describe('createCodeableConcept', () => {
      test('should create basic CodeableConcept', () => {
        const result = createCodeableConcept('123');
        expect(result).toEqual({
          coding: [{ code: '123' }]
        });
      });

      test('should create CodeableConcept with display', () => {
        const result = createCodeableConcept('123', 'Test Display');
        expect(result).toEqual({
          coding: [{ code: '123', display: 'Test Display' }],
          text: 'Test Display'
        });
      });

      test('should create CodeableConcept with all fields', () => {
        const result = createCodeableConcept(
          '8480-6',
          'Systolic BP',
          'http://loinc.org',
          'Blood Pressure - Systolic'
        );

        expect(result).toEqual({
          coding: [{
            code: '8480-6',
            display: 'Systolic BP',
            system: 'http://loinc.org'
          }],
          text: 'Blood Pressure - Systolic'
        });
      });
    });
  });

  describe('FHIR Resource Field Access', () => {
    describe('getConditionStatus', () => {
      test('should extract status from nested structure', () => {
        const condition = {
          clinicalStatus: {
            coding: [{ code: 'active' }]
          }
        };
        expect(getConditionStatus(condition)).toBe('active');
      });

      test('should handle simple string status', () => {
        const condition = { clinicalStatus: 'active' };
        expect(getConditionStatus(condition)).toBe('active');
      });

      test('should return null for null input', () => {
        expect(getConditionStatus(null)).toBeNull();
      });
    });

    describe('getConditionVerificationStatus', () => {
      test('should extract verification status', () => {
        const condition = {
          verificationStatus: {
            coding: [{ code: 'confirmed' }]
          }
        };
        expect(getConditionVerificationStatus(condition)).toBe('confirmed');
      });
    });

    describe('getMedicationStatus', () => {
      test('should extract simple status', () => {
        const med = { status: 'active' };
        expect(getMedicationStatus(med)).toBe('active');
      });

      test('should handle nested status', () => {
        const med = { status: { coding: [{ code: 'active' }] } };
        expect(getMedicationStatus(med)).toBe('active');
      });
    });

    describe('getObservationCategory', () => {
      test('should extract category from array', () => {
        const obs = {
          category: [{
            coding: [{ code: 'laboratory' }]
          }]
        };
        expect(getObservationCategory(obs)).toBe('laboratory');
      });

      test('should return null for missing category', () => {
        expect(getObservationCategory({})).toBeNull();
        expect(getObservationCategory({ category: [] })).toBeNull();
      });
    });

    describe('getObservationStatus', () => {
      test('should extract status', () => {
        const obs = { status: 'final' };
        expect(getObservationStatus(obs)).toBe('final');
      });
    });

    describe('getEncounterClass', () => {
      test('should extract class from R4 format', () => {
        const encounter = {
          class: { coding: [{ code: 'AMB' }] }
        };
        expect(getEncounterClass(encounter)).toBe('AMB');
      });

      test('should handle array format (R5)', () => {
        const encounter = {
          class: [{ coding: [{ code: 'AMB' }] }]
        };
        expect(getEncounterClass(encounter)).toBe('AMB');
      });

      test('should handle simple string', () => {
        const encounter = { class: 'AMB' };
        expect(getEncounterClass(encounter)).toBe('AMB');
      });
    });

    describe('getEncounterStatus', () => {
      test('should extract status', () => {
        const encounter = { status: 'finished' };
        expect(getEncounterStatus(encounter)).toBe('finished');
      });
    });

    describe('getResourceDisplayText', () => {
      test('should extract display text', () => {
        const resource = {
          code: { text: 'Blood Pressure' }
        };
        expect(getResourceDisplayText(resource)).toBe('Blood Pressure');
      });

      test('should fall back to coding display', () => {
        const resource = {
          code: { coding: [{ display: 'BP' }] }
        };
        expect(getResourceDisplayText(resource)).toBe('BP');
      });

      test('should return Unknown for null', () => {
        expect(getResourceDisplayText(null)).toBe('Unknown');
        expect(getResourceDisplayText({})).toBe('Unknown');
      });
    });

    describe('getReferenceId', () => {
      test('should extract ID from string reference', () => {
        expect(getReferenceId('Patient/123')).toBe('123');
      });

      test('should extract ID from URN', () => {
        expect(getReferenceId('urn:uuid:abc-123')).toBe('abc-123');
      });

      test('should extract ID from reference object', () => {
        expect(getReferenceId({ reference: 'Patient/123' })).toBe('123');
      });

      test('should return null for null', () => {
        expect(getReferenceId(null)).toBeNull();
      });
    });
  });

  describe('Resource Status Predicates', () => {
    describe('isConditionActive', () => {
      test('should return true for active condition', () => {
        const condition = {
          clinicalStatus: { coding: [{ code: 'active' }] }
        };
        expect(isConditionActive(condition)).toBe(true);
      });

      test('should return false for inactive condition', () => {
        const condition = {
          clinicalStatus: { coding: [{ code: 'resolved' }] }
        };
        expect(isConditionActive(condition)).toBe(false);
      });
    });

    describe('isMedicationActive', () => {
      test('should return true for active medication', () => {
        const med = { status: 'active' };
        expect(isMedicationActive(med)).toBe(true);
      });

      test('should return false for completed medication', () => {
        const med = { status: 'completed' };
        expect(isMedicationActive(med)).toBe(false);
      });
    });

    describe('isObservationLaboratory', () => {
      test('should return true for laboratory observation', () => {
        const obs = {
          category: [{ coding: [{ code: 'laboratory' }] }]
        };
        expect(isObservationLaboratory(obs)).toBe(true);
      });

      test('should return false for vital signs', () => {
        const obs = {
          category: [{ coding: [{ code: 'vital-signs' }] }]
        };
        expect(isObservationLaboratory(obs)).toBe(false);
      });
    });

    describe('isObservationFinal', () => {
      test('should return true for final observation', () => {
        const obs = { status: 'final' };
        expect(isObservationFinal(obs)).toBe(true);
      });

      test('should return false for preliminary observation', () => {
        const obs = { status: 'preliminary' };
        expect(isObservationFinal(obs)).toBe(false);
      });
    });
  });
});
