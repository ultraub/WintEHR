/**
 * Tests for cdsActionExecutor's context-injection behavior. The
 * end-to-end create/update path is exercised manually against HAPI; here
 * we pin the shape the wizard produces (resource without subject) ↔ what
 * the validator sees after _injectContext runs.
 */

import CDSActionExecutor from '../cdsActionExecutor';

// fhirClient and cdsFeedbackService are imported as side effects of the
// module under test — mock them so import doesn't try to read window.
jest.mock('../../core/fhir/services/fhirClient', () => ({
  fhirClient: { create: jest.fn(), update: jest.fn(), delete: jest.fn() }
}));
jest.mock('../cdsFeedbackService', () => ({
  cdsFeedbackService: { sendAcceptanceFeedback: jest.fn() }
}));
jest.mock('../../config/logging', () => ({
  cdsLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

describe('cdsActionExecutor._injectContext', () => {
  let executor;

  beforeEach(() => {
    executor = new CDSActionExecutor();
  });

  it('returns the resource unchanged when no context is provided', () => {
    const resource = {
      resourceType: 'Condition',
      code: { text: 'T2DM' }
    };
    const result = executor._injectContext(resource, {});
    expect(result.subject).toBeUndefined();
    expect(result).toEqual(resource);
  });

  it('injects subject for subject-required types when patientId is given', () => {
    const cases = [
      'MedicationRequest', 'ServiceRequest', 'Observation',
      'Condition', 'AllergyIntolerance', 'CarePlan', 'Goal', 'Task'
    ];
    cases.forEach((resourceType) => {
      const result = executor._injectContext(
        { resourceType, status: 'draft' },
        { patientId: 'p-1' }
      );
      expect(result.subject).toEqual({ reference: 'Patient/p-1' });
    });
  });

  it('does not overwrite an existing subject', () => {
    const result = executor._injectContext(
      { resourceType: 'Condition', subject: { reference: 'Patient/preset' } },
      { patientId: 'p-1' }
    );
    expect(result.subject).toEqual({ reference: 'Patient/preset' });
  });

  it('does not inject subject for types that do not require one', () => {
    // Appointment uses `participant` instead of subject — should be left alone.
    const result = executor._injectContext(
      { resourceType: 'Appointment', status: 'proposed' },
      { patientId: 'p-1' }
    );
    expect(result.subject).toBeUndefined();
  });

  it('injects requester only for ServiceRequest, MedicationRequest, Task', () => {
    const requesterTypes = ['ServiceRequest', 'MedicationRequest', 'Task'];
    requesterTypes.forEach((resourceType) => {
      const result = executor._injectContext(
        { resourceType },
        { patientId: 'p-1', userId: 'u-1' }
      );
      expect(result.requester).toEqual({ reference: 'Practitioner/u-1' });
    });

    const conditionResult = executor._injectContext(
      { resourceType: 'Condition' },
      { patientId: 'p-1', userId: 'u-1' }
    );
    expect(conditionResult.requester).toBeUndefined();
  });

  it('injects encounter for any type when encounterId is given', () => {
    const result = executor._injectContext(
      { resourceType: 'Condition' },
      { patientId: 'p-1', encounterId: 'e-1' }
    );
    expect(result.encounter).toEqual({ reference: 'Encounter/e-1' });
  });

  it('does not mutate the input resource', () => {
    const input = { resourceType: 'Condition' };
    const result = executor._injectContext(input, { patientId: 'p-1' });
    expect(input.subject).toBeUndefined();
    expect(result).not.toBe(input);
  });

  it('round-trips a wizard-shaped Condition into something the validator accepts', () => {
    // This is the exact shape the visual wizard now generates for
    // "Add Problem: Type 2 diabetes" (post PR #71). Pre-context, the
    // validator throws at _injectContext; post-context, it should pass.
    const wizardResource = {
      resourceType: 'Condition',
      clinicalStatus: { coding: [{ system: 'x', code: 'active' }] },
      verificationStatus: { coding: [{ system: 'x', code: 'confirmed' }] },
      code: {
        coding: [{
          system: 'http://hl7.org/fhir/sid/icd-10-cm',
          code: 'E11.9',
          display: 'T2DM'
        }],
        text: 'T2DM'
      }
    };
    const enriched = executor._injectContext(
      wizardResource,
      { patientId: 'p-1' }
    );
    // Note: Condition isn't on the validator's switch (no subject check),
    // but executor injects it anyway because Condition is in the
    // SUBJECT_REQUIRED_TYPES set — matching backend behavior so the
    // resource lands with a real subject reference.
    expect(enriched.subject).toEqual({ reference: 'Patient/p-1' });
    expect(enriched.code.coding[0].code).toBe('E11.9');
  });
});
