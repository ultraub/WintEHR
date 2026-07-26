/**
 * Resource-registry contracts (opportunity #3, docs/ARCHITECTURE_DEBT.md).
 *
 * The registry replaced 7 drifting copies of "which resources load for a
 * patient, at what priority" and ~15 inlined HAPI sort-parameter literals.
 * These tests pin the semantics the migrated call sites rely on — most
 * importantly the HAPI sort names, where an invented name is a server 400
 * (the '-authored-on' incident, PR #234 family).
 */

import {
  RESOURCE_REGISTRY,
  TIERED_TYPES,
  typesForPriority,
  PATIENT_CLINICAL_TYPES,
  SUMMARY_TYPES,
  getSortParam,
  getResourceLabel,
} from '../resourceRegistry';

describe('tier membership', () => {
  it('critical tier is the first-paint set', () => {
    expect(TIERED_TYPES.critical).toEqual([
      'Patient', 'Encounter', 'Condition', 'MedicationRequest', 'AllergyIntolerance',
    ]);
  });

  it('every tiered type appears in exactly one tier', () => {
    const all = [...TIERED_TYPES.critical, ...TIERED_TYPES.important, ...TIERED_TYPES.optional];
    expect(new Set(all).size).toBe(all.length);
  });

  it('priority fetches are cumulative', () => {
    expect(typesForPriority('critical')).toEqual(TIERED_TYPES.critical);
    expect(typesForPriority('important')).toEqual([
      ...TIERED_TYPES.critical, ...TIERED_TYPES.important,
    ]);
    // Procedure and ImagingStudy fell out of one load path entirely before
    // the registry — pin that a full fetch includes every tier.
    expect(typesForPriority('all')).toContain('Procedure');
    expect(typesForPriority('all')).toContain('ImagingStudy');
  });

  it('PATIENT_CLINICAL_TYPES is all tiers minus Patient', () => {
    expect(PATIENT_CLINICAL_TYPES).not.toContain('Patient');
    expect(PATIENT_CLINICAL_TYPES).toHaveLength(typesForPriority('all').length - 1);
  });

  it('summary set matches the Summary tab batch fetch', () => {
    expect(SUMMARY_TYPES).toEqual([
      'Patient', 'Encounter', 'Condition', 'MedicationRequest', 'AllergyIntolerance',
      'Observation', 'Procedure', 'DiagnosticReport', 'Immunization',
    ]);
  });
});

describe("HAPI's real sort-parameter names (server 400s on invented ones)", () => {
  it.each([
    ['MedicationRequest', '-authoredon'],
    ['ServiceRequest', '-authored'],
    ['MedicationDispense', '-whenhandedover'],
    ['Condition', '-recorded-date'],
    ['ImagingStudy', '-started'],
    ['Observation', '-date'],
  ])('%s sorts by %s', (type, param) => {
    expect(getSortParam(type)).toBe(param);
  });

  it('defaults to -date for unregistered types', () => {
    expect(getSortParam('Basic')).toBe('-date');
  });
});

describe('labels', () => {
  it('registered types get human labels; unknown types fall back to the type', () => {
    expect(getResourceLabel('DiagnosticReport')).toBe('Diagnostic Report');
    expect(getResourceLabel('Media')).toBe('Media');
  });
});

describe('registry shape', () => {
  it('every entry declares the full field set', () => {
    for (const [type, meta] of Object.entries(RESOURCE_REGISTRY)) {
      expect(meta, type).toHaveProperty('label');
      expect(meta, type).toHaveProperty('tier');
      expect(meta, type).toHaveProperty('summary');
      expect(meta, type).toHaveProperty('sortParam');
    }
  });
});
