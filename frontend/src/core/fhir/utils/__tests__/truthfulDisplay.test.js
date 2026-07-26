/**
 * Truthful-rendering contracts, pinned against real MIMIC-on-FHIR shapes.
 *
 * The import stress test showed every display chain ended at
 * `text || coding[0].display || 'Unknown …'` — but FHIR makes text optional
 * and display optional per coding. MIMIC puts condition/vital names in
 * coding[0].display with no text, and ships Medication resources that are
 * bare NDC codes. "Unknown" when a real code exists is not truthful.
 */
import { getCodeableConceptDisplay, getMedicationDisplay, getMedicationResourceDisplay, isConditionActive, isMedicationActive } from '../fhirFieldUtils';
import { getMedicationName } from '../medicationDisplayUtils';

// Real shapes from mimic-iv-clinical-database-demo-on-fhir-2.1.0
const mimicConditionCode = {
  coding: [{
    code: 'V462',
    system: 'http://mimic.mit.edu/fhir/mimic/CodeSystem/mimic-diagnosis-icd9',
    display: 'Other dependence on machines, supplemental oxygen',
  }],
};
const ndcOnlyMedication = {
  id: 'med-ndc',
  code: { coding: [{ code: '51079030020', system: 'http://mimic.mit.edu/fhir/mimic/CodeSystem/mimic-medication-ndc' }] },
};
// The REAL full MIMIC shape: the human name lives in identifier[], not code —
// true for all 1,480 Medications in the demo dataset.
const mimicMedication = {
  id: 'med-full',
  code: { coding: [{ code: '51079030020', system: 'http://mimic.mit.edu/fhir/mimic/CodeSystem/mimic-medication-ndc' }] },
  identifier: [
    { system: 'http://mimic.mit.edu/fhir/mimic/identifier/mimic-medication-ndc', value: '51079030020' },
    { system: 'http://mimic.mit.edu/fhir/mimic/identifier/mimic-medication-formulary-drug-cd', value: 'CATA2' },
    { system: 'http://mimic.mit.edu/fhir/mimic/identifier/mimic-medication-name', value: 'CloniDINE' },
  ],
};

describe('getCodeableConceptDisplay', () => {
  it('uses coding display when text is absent (MIMIC condition/vital shape)', () => {
    expect(getCodeableConceptDisplay(mimicConditionCode, 'Unknown condition'))
      .toBe('Other dependence on machines, supplemental oxygen');
  });

  it('prefers the first coding WITH a display over a bare-code coding[0]', () => {
    const concept = { coding: [
      { code: '51079030020', system: 'ndc' },
      { code: '313782', system: 'rxnorm', display: 'Acetaminophen 325 MG Oral Tablet' },
    ]};
    expect(getCodeableConceptDisplay(concept)).toBe('Acetaminophen 325 MG Oral Tablet');
  });

  it('falls back to the code itself — a real code is more truthful than "Unknown"', () => {
    expect(getCodeableConceptDisplay(ndcOnlyMedication.code, 'Unknown medication'))
      .toBe('51079030020');
  });

  it('still uses text first when present', () => {
    expect(getCodeableConceptDisplay({ text: 'Lisinopril 10mg', ...mimicConditionCode }))
      .toBe('Lisinopril 10mg');
  });
});

describe('getMedicationResourceDisplay — traverse the WHOLE Medication', () => {
  it('finds the human name in identifier[] when code is a bare NDC (all MIMIC meds)', () => {
    expect(getMedicationResourceDisplay(mimicMedication)).toBe('CloniDINE');
  });

  it('prefers code text/display when present', () => {
    expect(getMedicationResourceDisplay({
      ...mimicMedication,
      code: { text: 'Clonidine HCl 0.1mg tablet', coding: mimicMedication.code.coding },
    })).toBe('Clonidine HCl 0.1mg tablet');
  });

  it('name-system CODING code beats the identifier (closer to the concept)', () => {
    expect(getMedicationResourceDisplay({
      id: 'm', code: { coding: [{ code: 'vancomycin', system: 'http://mimic.mit.edu/fhir/mimic/CodeSystem/mimic-medication-name' }] },
    })).toBe('vancomycin');
  });

  it('falls back to the bare code only when no name exists anywhere', () => {
    expect(getMedicationResourceDisplay(ndcOnlyMedication)).toBe('51079030020');
  });
});

describe('name-system codings in CodeableConcepts (MIMIC Dispense shape)', () => {
  it('prefers the name-system coding over other bare codes', () => {
    const concept = { coding: [
      { code: '00409672924', system: 'http://mimic.mit.edu/fhir/mimic/CodeSystem/mimic-medication-ndc' },
      { code: 'Calcium Gluconate', system: 'http://mimic.mit.edu/fhir/mimic/CodeSystem/mimic-medication-name' },
    ]};
    expect(getCodeableConceptDisplay(concept)).toBe('Calcium Gluconate');
  });
});

describe('medicationReference resolution (MIMIC MedicationRequest shape)', () => {
  const mimicMedRequest = {
    id: 'mr-1',
    status: 'completed',
    medicationReference: { reference: 'Medication/med-ndc' },
  };

  it('getMedicationName resolves through a lookup map — to the NAME, via identifier', () => {
    const req = { ...mimicMedRequest, medicationReference: { reference: 'Medication/med-full' } };
    expect(getMedicationName(req, { 'med-full': mimicMedication })).toBe('CloniDINE');
  });

  it('getMedicationName resolves through an array lookup', () => {
    const req = { ...mimicMedRequest, medicationReference: { reference: 'Medication/med-full' } };
    expect(getMedicationName(req, [mimicMedication])).toBe('CloniDINE');
  });

  it('degrades to the NDC only when the Medication truly has no name', () => {
    expect(getMedicationName(mimicMedRequest, { 'med-ndc': ndcOnlyMedication }))
      .toBe('51079030020');
  });

  it('the fetch-layer display stamp wins (it saw the full resource)', () => {
    const stamped = { ...mimicMedRequest, _resolvedMedicationDisplay: 'CloniDINE' };
    expect(getMedicationDisplay(stamped)).toBe('CloniDINE');
    expect(getMedicationName(stamped)).toBe('CloniDINE');
  });

  it('getMedicationDisplay reads the concept the fetch layer stamps from _include', () => {
    const stamped = { ...mimicMedRequest, _resolvedMedicationCodeableConcept: ndcOnlyMedication.code };
    expect(getMedicationDisplay(stamped)).toBe('51079030020');
  });

  it('getMedicationDisplay resolves via options.medicationLookup', () => {
    expect(getMedicationDisplay(mimicMedRequest, { medicationLookup: { 'med-ndc': ndcOnlyMedication } }))
      .toBe('51079030020');
  });
});

describe('one definition of active (preview page vs Summary tab)', () => {
  it('a condition without clinicalStatus is NOT claimed active', () => {
    // MIMIC billing diagnoses legitimately omit clinicalStatus — the data
    // asserts no status, so the UI must not count them as active.
    expect(isConditionActive({ code: mimicConditionCode })).toBe(false);
  });

  it('a completed medication is NOT current', () => {
    expect(isMedicationActive({ status: 'completed' })).toBe(false);
  });

  it('genuinely active resources still count', () => {
    expect(isConditionActive({
      clinicalStatus: { coding: [{ code: 'active' }] },
    })).toBe(true);
    expect(isMedicationActive({ status: 'active' })).toBe(true);
  });
});
