/**
 * Hook-type parity pin (bug B4, docs/ARCHITECTURE_DEBT.md).
 *
 * The backend's HookType enum (backend/api/cds_hooks/models.py) is the
 * authority; this literal list mirrors it, and the backend test suite pins
 * the SAME literal list against the enum
 * (tests/api/cds_hooks/test_hook_type_parity.py). If either side adds or
 * removes a hook, exactly one of the two tests fails — that's the alarm to
 * update both together.
 */

import { CDS_HOOK_TYPE_OPTIONS, CDS_HOOK_TYPES, CDS_HOOK_TYPE_VALUES } from '../cdsHookTypes';

const BACKEND_HOOK_TYPES = [
  'patient-view',
  'medication-prescribe',
  'order-sign',
  'order-select',
  'encounter-start',
  'encounter-discharge',
  'allergyintolerance-create',
  'appointment-book',
  'medication-refill',
  'order-dispatch',
  'problem-list-item-create',
];

describe('CDS hook types — one list, matching the backend engine', () => {
  it('covers every backend-supported hook (5 were UI-invisible before)', () => {
    expect([...CDS_HOOK_TYPE_VALUES].sort()).toEqual([...BACKEND_HOOK_TYPES].sort());
  });

  it('enum-style access works for the keys existing code uses', () => {
    expect(CDS_HOOK_TYPES.PATIENT_VIEW).toBe('patient-view');
    expect(CDS_HOOK_TYPES.MEDICATION_PRESCRIBE).toBe('medication-prescribe');
    expect(CDS_HOOK_TYPES.ORDER_SELECT).toBe('order-select');
  });

  it('every option has a value and a human label', () => {
    for (const opt of CDS_HOOK_TYPE_OPTIONS) {
      expect(opt.value).toBeTruthy();
      expect(opt.label).toBeTruthy();
    }
  });
});
