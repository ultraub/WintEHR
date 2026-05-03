/**
 * Tests for the runtime <-> builder shape conversion in
 * SuggestionActionBuilder. The component itself is exercised manually;
 * these tests pin down the conversion contract that the runtime
 * (cds_hooks_router::_execute_accepted_suggestion_actions) depends on.
 */

import {
  actionToRuntimeShape,
  runtimeToBuilderState
} from '../SuggestionActionBuilder';

// Mock the catalog service — the conversion functions don't call it, but
// importing the component module triggers the import of the service,
// which (in some test environments) may try to read window.location.
jest.mock('../../../../../services/cdsClinicalDataService', () => ({
  __esModule: true,
  default: {
    getLabCatalog: jest.fn(),
    getDynamicMedicationCatalog: jest.fn(),
    getDynamicConditionCatalog: jest.fn()
  }
}));

describe('actionToRuntimeShape', () => {
  it('returns null for incomplete actions (no codeItem)', () => {
    expect(
      actionToRuntimeShape({
        templateId: 'order-lab',
        codeItem: null,
        description: ''
      })
    ).toBeNull();
  });

  it('returns null for unknown templateId', () => {
    expect(
      actionToRuntimeShape({
        templateId: 'not-a-real-template',
        codeItem: { code: 'X' },
        description: 'X'
      })
    ).toBeNull();
  });

  it('builds an order-lab ServiceRequest with LOINC code', () => {
    const result = actionToRuntimeShape({
      templateId: 'order-lab',
      codeItem: { loinc_code: '4548-4', test_name: 'HbA1c' },
      description: 'Order HbA1c'
    });
    expect(result.type).toBe('create');
    expect(result.description).toBe('Order HbA1c');
    expect(result.resource.resourceType).toBe('ServiceRequest');
    expect(result.resource.status).toBe('draft');
    expect(result.resource.intent).toBe('order');
    expect(result.resource.category[0].coding[0].code).toBe('laboratory');
    expect(result.resource.code.coding[0]).toEqual({
      system: 'http://loinc.org',
      code: '4548-4',
      display: 'HbA1c'
    });
  });

  it('builds an order-medication MedicationRequest with RxNorm code', () => {
    const result = actionToRuntimeShape({
      templateId: 'order-medication',
      codeItem: { rxnorm_code: '6809', generic_name: 'Metformin' },
      description: 'Start metformin'
    });
    expect(result.resource.resourceType).toBe('MedicationRequest');
    expect(result.resource.medicationCodeableConcept.coding[0]).toEqual({
      system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
      code: '6809',
      display: 'Metformin'
    });
  });

  it('builds an add-problem Condition with SNOMED code when present', () => {
    const result = actionToRuntimeShape({
      templateId: 'add-problem',
      codeItem: { snomed_code: '44054006', display_name: 'Type 2 diabetes' },
      description: 'Add T2DM'
    });
    expect(result.resource.resourceType).toBe('Condition');
    expect(result.resource.clinicalStatus.coding[0].code).toBe('active');
    expect(result.resource.code.coding[0]).toEqual({
      system: 'http://snomed.info/sct',
      code: '44054006',
      display: 'Type 2 diabetes'
    });
  });

  it('builds an add-problem Condition with ICD-10 when SNOMED is absent', () => {
    const result = actionToRuntimeShape({
      templateId: 'add-problem',
      codeItem: { icd10_code: 'E11.9', display_name: 'Type 2 diabetes mellitus without complications' },
      description: 'Add T2DM'
    });
    expect(result.resource.code.coding[0]).toEqual({
      system: 'http://hl7.org/fhir/sid/icd-10-cm',
      code: 'E11.9',
      display: 'Type 2 diabetes mellitus without complications'
    });
  });

  it('builds a refer ServiceRequest from free-text', () => {
    const result = actionToRuntimeShape({
      templateId: 'refer',
      codeItem: { display: 'Endocrinology consult' },
      description: 'Refer to endocrinology'
    });
    expect(result.resource.resourceType).toBe('ServiceRequest');
    expect(result.resource.code.text).toBe('Endocrinology consult');
  });
});

describe('runtimeToBuilderState', () => {
  it('returns null for non-objects', () => {
    expect(runtimeToBuilderState(null)).toBeNull();
    expect(runtimeToBuilderState({})).toBeNull();
    expect(runtimeToBuilderState({ resource: 'not-an-object' })).toBeNull();
  });

  it('round-trips a lab order', () => {
    const builder = {
      templateId: 'order-lab',
      codeItem: { loinc_code: '4548-4', test_name: 'HbA1c' },
      description: 'Order HbA1c'
    };
    const runtime = actionToRuntimeShape(builder);
    const recovered = runtimeToBuilderState(runtime);
    expect(recovered.templateId).toBe('order-lab');
    expect(recovered.codeItem.loinc_code).toBe('4548-4');
    expect(recovered.codeItem.test_name).toBe('HbA1c');
    expect(recovered.description).toBe('Order HbA1c');
  });

  it('round-trips a medication order', () => {
    const builder = {
      templateId: 'order-medication',
      codeItem: { rxnorm_code: '6809', generic_name: 'Metformin' },
      description: 'Start metformin'
    };
    const runtime = actionToRuntimeShape(builder);
    const recovered = runtimeToBuilderState(runtime);
    expect(recovered.templateId).toBe('order-medication');
    expect(recovered.codeItem.rxnorm_code).toBe('6809');
    expect(recovered.codeItem.generic_name).toBe('Metformin');
  });

  it('round-trips a SNOMED-coded problem', () => {
    const builder = {
      templateId: 'add-problem',
      codeItem: { snomed_code: '44054006', display_name: 'Type 2 diabetes' },
      description: 'Add T2DM'
    };
    const runtime = actionToRuntimeShape(builder);
    const recovered = runtimeToBuilderState(runtime);
    expect(recovered.templateId).toBe('add-problem');
    expect(recovered.codeItem.snomed_code).toBe('44054006');
    expect(recovered.codeItem.display_name).toBe('Type 2 diabetes');
  });

  it('round-trips an ICD-10-coded problem', () => {
    const builder = {
      templateId: 'add-problem',
      codeItem: { icd10_code: 'E11.9', display_name: 'T2DM without complications' },
      description: 'Add T2DM'
    };
    const runtime = actionToRuntimeShape(builder);
    const recovered = runtimeToBuilderState(runtime);
    expect(recovered.templateId).toBe('add-problem');
    expect(recovered.codeItem.icd10_code).toBe('E11.9');
    expect(recovered.codeItem.display_name).toBe('T2DM without complications');
  });

  it('discriminates referral vs lab on category code', () => {
    const labRuntime = actionToRuntimeShape({
      templateId: 'order-lab',
      codeItem: { loinc_code: '4548-4', test_name: 'HbA1c' },
      description: 'lab'
    });
    const referRuntime = actionToRuntimeShape({
      templateId: 'refer',
      codeItem: { display: 'Endocrinology consult' },
      description: 'refer'
    });
    expect(runtimeToBuilderState(labRuntime).templateId).toBe('order-lab');
    expect(runtimeToBuilderState(referRuntime).templateId).toBe('refer');
  });
});
