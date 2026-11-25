import { describe, it, expect } from 'vitest';
import { CLINICAL_EVENTS } from '../../constants/clinicalEvents';
import { applyResourceEvent, isRelevantEvent, isResourceEvent } from '../resourceEvents';

const { RESOURCE_CREATED, RESOURCE_UPDATED, RESOURCE_DELETED, ORDER_PLACED } = CLINICAL_EVENTS;

describe('applyResourceEvent', () => {
  const list = [{ id: 'a', v: 1 }, { id: 'b', v: 1 }];

  it('adds a resource the list has not seen, at the top', () => {
    expect(applyResourceEvent(list, RESOURCE_CREATED, { id: 'c', v: 1 }).map(r => r.id)).toEqual(['c', 'a', 'b']);
  });

  it('replaces a known resource in place, even when the event says created', () => {
    const next = applyResourceEvent(list, RESOURCE_CREATED, { id: 'b', v: 2 });
    expect(next).toEqual([{ id: 'a', v: 1 }, { id: 'b', v: 2 }]);
  });

  it('adds on an update for a resource the list never had', () => {
    expect(applyResourceEvent(list, RESOURCE_UPDATED, { id: 'z' })).toHaveLength(3);
  });

  it('removes on delete from a stub that carries only type and id', () => {
    expect(applyResourceEvent(list, RESOURCE_DELETED, { resourceType: 'Condition', id: 'a' })).toEqual([{ id: 'b', v: 1 }]);
  });

  it('returns the same list when a delete names something it does not hold', () => {
    expect(applyResourceEvent(list, RESOURCE_DELETED, { id: 'nope' })).toBe(list);
  });

  it('runs the transform on what it stores', () => {
    const next = applyResourceEvent(list, RESOURCE_UPDATED, { id: 'a' }, r => ({ ...r, enhanced: true }));
    expect(next[0]).toEqual({ id: 'a', enhanced: true });
  });

  it('tolerates a missing list or resource', () => {
    expect(applyResourceEvent(undefined, RESOURCE_CREATED, { id: 'a' })).toEqual([{ id: 'a' }]);
    expect(applyResourceEvent(list, RESOURCE_CREATED, null)).toBe(list);
  });
});

describe('isRelevantEvent', () => {
  const types = ['Observation', 'DiagnosticReport'];

  it('ignores another patient', () => {
    expect(isRelevantEvent(RESOURCE_CREATED, { patientId: 'p2', resourceType: 'Observation' }, 'p1', types)).toBe(false);
  });

  it('ignores resource events for types the view does not show', () => {
    expect(isRelevantEvent(RESOURCE_CREATED, { patientId: 'p1', resourceType: 'Condition' }, 'p1', types)).toBe(false);
    expect(isRelevantEvent(RESOURCE_DELETED, { patientId: 'p1', resourceType: 'Observation' }, 'p1', types)).toBe(true);
  });

  it('lets domain events through on patient alone', () => {
    expect(isRelevantEvent(ORDER_PLACED, { patientId: 'p1' }, 'p1', types)).toBe(true);
    expect(isResourceEvent(ORDER_PLACED)).toBe(false);
  });
});
