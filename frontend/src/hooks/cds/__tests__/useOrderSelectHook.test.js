/**
 * Tests for useOrderSelectHook — verify spec-compliant payload, dedup
 * behavior, and refire semantics.
 *
 * Strategy: mock cdsHooksClient (the bottom of the call chain) and
 * cdsPrefetchResolver. Provide a fake service registered for
 * `order-select` via the discoverServices mock. The useCDSHooks
 * internal executeHook will then call through to our mocked
 * cdsHooksClient.executeHook with the constructed request — that's
 * where we capture and inspect the payload (request.context).
 */
const calls = [];

jest.mock('../../../services/cdsHooksClient', () => ({
  __esModule: true,
  cdsHooksClient: {
    discoverServices: async () =>
      [{ id: 'test-order-select', hook: 'order-select' }],
    executeHook: async (serviceId, request) => {
      calls.push({ serviceId, request });
      return { cards: [], systemActions: [] };
    },
    sendFeedback: async () => ({}),
  },
}));

jest.mock('../../../services/cdsPrefetchResolver', () => ({
  __esModule: true,
  cdsPrefetchResolver: {
    resolvePrefetchTemplates: async () => null,
    buildCommonPrefetch: async () => null,
  },
}));

import React from 'react';
import { render, act } from '@testing-library/react';
import { useOrderSelectHook } from '../useCDSHooks';

const Harness = ({ patientId, userId, draftResources, encounterId }) => {
  useOrderSelectHook(patientId, userId, draftResources, encounterId);
  return null;
};

const flush = async () => {
  await act(async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve();
  });
};

describe('useOrderSelectHook', () => {
  beforeEach(() => {
    calls.length = 0;
  });

  test('does not fire when draftResources is empty', async () => {
    render(<Harness patientId="p1" userId="u1" draftResources={[]} />);
    await flush();
    expect(calls).toHaveLength(0);
  });

  test('does not fire when patientId or userId is missing', async () => {
    const draft = [{ resourceType: 'ServiceRequest', code: { text: 'A' } }];
    render(<Harness patientId={null} userId="u1" draftResources={draft} />);
    render(<Harness patientId="p1" userId={null} draftResources={draft} />);
    await flush();
    expect(calls).toHaveLength(0);
  });

  test('fires once with spec-aligned context shape', async () => {
    const draft = [{
      resourceType: 'ServiceRequest',
      code: { text: 'Lipid panel' },
    }];

    render(<Harness patientId="p1" userId="u1" draftResources={draft} />);
    await flush();

    expect(calls.length).toBeGreaterThan(0);
    const { serviceId, request } = calls[0];
    expect(serviceId).toBe('test-order-select');
    expect(request.hook).toBe('order-select');
    expect(request.context.patientId).toBe('p1');
    expect(request.context.userId).toBe('Practitioner/u1');           // normalized
    expect(request.context.draftOrders.resourceType).toBe('Bundle');
    expect(request.context.draftOrders.entry).toHaveLength(1);
    expect(request.context.selections).toHaveLength(1);
    expect(request.context.selections[0]).toMatch(
      /^Bundle\/cds-draft-[a-f0-9-]+#ServiceRequest\/draft-1$/
    );
  });

  test('preserves an already-prefixed userId', async () => {
    const draft = [{ resourceType: 'ServiceRequest', code: { text: 'X' } }];
    render(<Harness patientId="p1" userId="Practitioner/already-prefixed" draftResources={draft} />);
    await flush();
    expect(calls[0].request.context.userId).toBe('Practitioner/already-prefixed');
  });

  test('includes encounterId in context when provided', async () => {
    const draft = [{ resourceType: 'ServiceRequest', code: { text: 'X' } }];
    render(<Harness patientId="p1" userId="u1" draftResources={draft} encounterId="e1" />);
    await flush();
    expect(calls[0].request.context.encounterId).toBe('e1');
  });

  test('omits encounterId when not provided', async () => {
    const draft = [{ resourceType: 'ServiceRequest', code: { text: 'X' } }];
    render(<Harness patientId="p1" userId="u1" draftResources={draft} />);
    await flush();
    expect(calls[0].request.context).not.toHaveProperty('encounterId');
  });

  test('does not refire on parent re-render with logically identical drafts', async () => {
    const draft1 = [{ resourceType: 'ServiceRequest', code: { text: 'CBC' } }];
    const draft2 = [{ resourceType: 'ServiceRequest', code: { text: 'CBC' } }]; // distinct array, same content

    const { rerender } = render(<Harness patientId="p1" userId="u1" draftResources={draft1} />);
    await flush();
    const callsAfterFirst = calls.length;
    expect(callsAfterFirst).toBeGreaterThan(0);

    rerender(<Harness patientId="p1" userId="u1" draftResources={draft2} />);
    await flush();
    expect(calls.length).toBe(callsAfterFirst); // unchanged
  });

  test('refires when the draft resource code changes', async () => {
    const draft1 = [{ resourceType: 'ServiceRequest', code: { text: 'CBC' } }];
    const draft2 = [{ resourceType: 'ServiceRequest', code: { text: 'BMP' } }];

    const { rerender } = render(<Harness patientId="p1" userId="u1" draftResources={draft1} />);
    await flush();
    const callsAfterFirst = calls.length;

    rerender(<Harness patientId="p1" userId="u1" draftResources={draft2} />);
    await flush();
    expect(calls.length).toBeGreaterThan(callsAfterFirst);
  });

  test('handles MedicationRequest resources via medicationCodeableConcept code key', async () => {
    const draft = [{
      resourceType: 'MedicationRequest',
      medicationCodeableConcept: { text: 'Aspirin 81mg', coding: [{ code: '243670' }] },
    }];

    render(<Harness patientId="p1" userId="u1" draftResources={draft} />);
    await flush();
    expect(calls[0].request.context.draftOrders.entry[0].resource.resourceType)
      .toBe('MedicationRequest');
    expect(calls[0].request.context.selections[0]).toMatch(/#MedicationRequest\/draft-1$/);
  });

  test('handles Immunization resources via vaccineCode code key', async () => {
    const draft = [{
      resourceType: 'Immunization',
      vaccineCode: { text: 'Influenza, seasonal', coding: [{ code: '140' }] },
    }];

    render(<Harness patientId="p1" userId="u1" draftResources={draft} />);
    await flush();
    expect(calls[0].request.context.draftOrders.entry[0].resource.resourceType)
      .toBe('Immunization');
    expect(calls[0].request.context.selections[0]).toMatch(/#Immunization\/draft-1$/);
  });
});
