import { buildDraftOrderBundle } from '../cdsDraftBundle';

describe('buildDraftOrderBundle', () => {
  test('returns null bundle and empty selections for empty input', () => {
    expect(buildDraftOrderBundle([])).toEqual({
      draftOrders: null,
      selections: [],
    });
    expect(buildDraftOrderBundle(null)).toEqual({
      draftOrders: null,
      selections: [],
    });
    expect(buildDraftOrderBundle(undefined)).toEqual({
      draftOrders: null,
      selections: [],
    });
  });

  test('wraps a single ServiceRequest into a one-entry collection Bundle', () => {
    const sr = { resourceType: 'ServiceRequest', code: { text: 'Lipid panel' } };
    const { draftOrders, selections } = buildDraftOrderBundle([sr]);

    expect(draftOrders.resourceType).toBe('Bundle');
    expect(draftOrders.type).toBe('collection');
    expect(draftOrders.id).toMatch(/^cds-draft-/);
    expect(draftOrders.entry).toHaveLength(1);
    expect(draftOrders.entry[0].resource.resourceType).toBe('ServiceRequest');
    expect(draftOrders.entry[0].resource.id).toBe('draft-1');
    expect(draftOrders.entry[0].resource.code.text).toBe('Lipid panel');
    expect(selections).toHaveLength(1);
    expect(selections[0]).toMatch(/^Bundle\/cds-draft-[a-f0-9-]+#ServiceRequest\/draft-1$/);
  });

  test('preserves caller-provided resource ids', () => {
    const sr = {
      resourceType: 'ServiceRequest',
      id: 'caller-supplied-id',
      code: { text: 'CBC' },
    };
    const { draftOrders, selections } = buildDraftOrderBundle([sr]);

    expect(draftOrders.entry[0].resource.id).toBe('caller-supplied-id');
    expect(selections[0]).toMatch(/#ServiceRequest\/caller-supplied-id$/);
  });

  test('handles mixed resource types in a single Bundle', () => {
    const resources = [
      { resourceType: 'ServiceRequest', code: { text: 'BMP' } },
      { resourceType: 'MedicationRequest', medicationCodeableConcept: { text: 'Aspirin' } },
      { resourceType: 'Immunization', vaccineCode: { text: 'Influenza' } },
    ];
    const { draftOrders, selections } = buildDraftOrderBundle(resources);

    expect(draftOrders.entry).toHaveLength(3);
    expect(draftOrders.entry.map((e) => e.resource.resourceType)).toEqual([
      'ServiceRequest',
      'MedicationRequest',
      'Immunization',
    ]);
    expect(selections).toHaveLength(3);
    expect(selections[0]).toMatch(/#ServiceRequest\/draft-1$/);
    expect(selections[1]).toMatch(/#MedicationRequest\/draft-2$/);
    expect(selections[2]).toMatch(/#Immunization\/draft-3$/);

    // All selection refs share the same Bundle id
    const bundleId = draftOrders.id;
    selections.forEach((s) => expect(s).toContain(bundleId));
  });

  test('focusedResources subset narrows selections without shrinking draftOrders', () => {
    const r1 = { resourceType: 'ServiceRequest', code: { text: 'A' } };
    const r2 = { resourceType: 'ServiceRequest', code: { text: 'B' } };
    const r3 = { resourceType: 'ServiceRequest', code: { text: 'C' } };

    const { draftOrders, selections } = buildDraftOrderBundle(
      [r1, r2, r3],
      { focusedResources: [r2] }
    );

    expect(draftOrders.entry).toHaveLength(3);
    expect(selections).toHaveLength(1);
    expect(selections[0]).toMatch(/#ServiceRequest\/draft-2$/);
  });

  test('selection refs match the spec format Bundle/<id>#<rt>/<id>', () => {
    const refRegex = /^Bundle\/[A-Za-z0-9-]+#[A-Za-z]+\/[A-Za-z0-9-]+$/;
    const { selections } = buildDraftOrderBundle([
      { resourceType: 'ServiceRequest', code: { text: 'X' } },
      { resourceType: 'MedicationRequest', medicationCodeableConcept: { text: 'Y' } },
    ]);

    selections.forEach((s) => {
      expect(s).toMatch(refRegex);
    });
  });

  test('does not mutate the caller-provided resources', () => {
    const sr = { resourceType: 'ServiceRequest', code: { text: 'Frozen' } };
    const snapshot = JSON.stringify(sr);
    buildDraftOrderBundle([sr]);
    expect(JSON.stringify(sr)).toBe(snapshot);
  });
});
