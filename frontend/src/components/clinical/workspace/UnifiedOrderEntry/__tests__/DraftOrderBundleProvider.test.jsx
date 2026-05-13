/**
 * Provider unit tests. The bundle state powers the right-pane list, the
 * unified order-select firing, and the Sign All flow — getting its
 * add/remove/clear semantics right matters more than visual polish for
 * Phase 4.1.
 */
import React from 'react';
import { render, act } from '@testing-library/react';
import {
  DraftOrderBundleProvider,
  useDraftOrderBundle,
} from '../DraftOrderBundleProvider';

// Test rig: a child component that captures the latest context value via
// a mutable ref so each act() boundary in the test can inspect what the
// provider exposed after the most recent state change.
let latestCtx;

const Probe = () => {
  latestCtx = useDraftOrderBundle();
  return null;
};

const renderWithProvider = (patientId = 'p1') =>
  render(
    <DraftOrderBundleProvider patientId={patientId}>
      <Probe />
    </DraftOrderBundleProvider>,
  );

describe('DraftOrderBundleProvider', () => {
  beforeEach(() => {
    latestCtx = null;
  });

  test('starts with empty drafts and exposes patientId', () => {
    renderWithProvider('p1');
    expect(latestCtx.patientId).toBe('p1');
    expect(latestCtx.drafts).toEqual([]);
    expect(latestCtx.draftCount).toBe(0);
    expect(latestCtx.recentlyAddedId).toBeNull();
  });

  test('addDraft appends and marks recently-added', () => {
    renderWithProvider();
    let addedId;
    act(() => {
      addedId = latestCtx.addDraft({ resourceType: 'ServiceRequest', code: { text: 'CBC' } });
    });
    expect(addedId).toBeTruthy();
    expect(latestCtx.drafts).toHaveLength(1);
    expect(latestCtx.drafts[0].resource.code.text).toBe('CBC');
    expect(latestCtx.recentlyAddedId).toBe(addedId);
  });

  test('addDraft refuses input without resourceType', () => {
    renderWithProvider();
    let id;
    act(() => {
      id = latestCtx.addDraft({ note: 'no type' });
    });
    expect(id).toBeNull();
    expect(latestCtx.drafts).toHaveLength(0);
  });

  test('removeDraft only removes the matching localId', () => {
    renderWithProvider();
    let firstId;
    let secondId;
    act(() => {
      firstId = latestCtx.addDraft({ resourceType: 'ServiceRequest', code: { text: 'A' } });
    });
    act(() => {
      secondId = latestCtx.addDraft({ resourceType: 'ServiceRequest', code: { text: 'B' } });
    });
    expect(latestCtx.drafts).toHaveLength(2);

    act(() => {
      latestCtx.removeDraft(firstId);
    });
    expect(latestCtx.drafts).toHaveLength(1);
    expect(latestCtx.drafts[0].resource.code.text).toBe('B');
    // recentlyAddedId pointed at the second add, not the first — it should survive.
    expect(latestCtx.recentlyAddedId).toBe(secondId);
  });

  test('removeDraft clears recentlyAddedId when that draft was the recent one', () => {
    renderWithProvider();
    let id;
    act(() => {
      id = latestCtx.addDraft({ resourceType: 'ServiceRequest', code: { text: 'A' } });
    });
    expect(latestCtx.recentlyAddedId).toBe(id);
    act(() => {
      latestCtx.removeDraft(id);
    });
    expect(latestCtx.recentlyAddedId).toBeNull();
  });

  test('clearDrafts empties everything', () => {
    renderWithProvider();
    act(() => {
      latestCtx.addDraft({ resourceType: 'ServiceRequest', code: { text: 'A' } });
      latestCtx.addDraft({ resourceType: 'ServiceRequest', code: { text: 'B' } });
    });
    expect(latestCtx.drafts).toHaveLength(2);

    act(() => {
      latestCtx.clearDrafts();
    });
    expect(latestCtx.drafts).toHaveLength(0);
    expect(latestCtx.recentlyAddedId).toBeNull();
  });

  test('updateDraft replaces only the matching draft', () => {
    renderWithProvider();
    let id;
    act(() => {
      id = latestCtx.addDraft({ resourceType: 'ServiceRequest', code: { text: 'A' }, priority: 'routine' });
    });
    act(() => {
      latestCtx.updateDraft(id, (prev) => ({ ...prev, priority: 'urgent' }));
    });
    expect(latestCtx.drafts[0].resource.priority).toBe('urgent');
  });

  test('throws when useDraftOrderBundle is called outside the provider', () => {
    // Suppress React's error-boundary console output for the negative case.
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(
      /useDraftOrderBundle must be used within a DraftOrderBundleProvider/,
    );
    spy.mockRestore();
  });
});
