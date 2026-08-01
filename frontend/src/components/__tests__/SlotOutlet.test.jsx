/**
 * SlotOutlet + slot registry tests (module platform Phase 2).
 *
 * Pins the slot contract: contributions render in deterministic order
 * with the host's context spread as props, a crashing contribution shows
 * a VISIBLE labeled error instead of blanking (the B17 invisibility
 * lesson, enforced from birth), and manifest slot targets can only name
 * published slots.
 */

import React from 'react';
import { render, screen } from '../../test-utils/test-utils';
import SlotOutlet from '../SlotOutlet';
import { ENABLED_MODULES, SLOT_NAMES, getSlotContributions } from '../../modules';

describe('slot registry', () => {
  it('every module slot target is a published slot name', () => {
    for (const m of ENABLED_MODULES) {
      for (const target of Object.keys(m.slots || {})) {
        expect(Object.keys(SLOT_NAMES)).toContain(target);
      }
    }
  });

  it('contributions carry id and a component, and order deterministically', () => {
    for (const name of Object.keys(SLOT_NAMES)) {
      const contributions = getSlotContributions(name);
      const orders = contributions.map((c) => c.order ?? 1000);
      expect([...orders].sort((a, b) => a - b)).toEqual(orders);
      for (const c of contributions) {
        expect(c.id).toBeTruthy();
        expect(c.moduleId).toBeTruthy();
        expect(typeof c.Component).toBe('function');
      }
    }
  });

  it('the inpatient bed chip is registered in the patient header slot', () => {
    const ids = getSlotContributions('patient-header.chips')
      .map((c) => `${c.moduleId}:${c.id}`);
    expect(ids).toContain('inpatient:bed-assignment');
  });
});

describe('SlotOutlet rendering', () => {
  it('renders nothing for a slot with no contributions', () => {
    const { container } = render(<SlotOutlet name="summary.cards" context={{ patientId: 'p1' }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('a crashing contribution shows a visible labeled error, not a blank', () => {
    // Use the real registry path: temporarily register a throwing module.
    const Bomb = () => { throw new Error('kaboom'); };
    const module = { id: 'test-bomb', slots: { 'patient-header.chips': [{ id: 'bomb', Component: Bomb }] } };
    ENABLED_MODULES.push(module);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      render(<SlotOutlet name="patient-header.chips" context={{ patient: { id: 'p1' } }} />);
      // The failure is VISIBLE and names the module.
      expect(screen.getByText('test-bomb')).toBeInTheDocument();
    } finally {
      ENABLED_MODULES.splice(ENABLED_MODULES.indexOf(module), 1);
      consoleError.mockRestore();
    }
  });

  it('passes the host context to contributions as props', () => {
    const seen = [];
    const Probe = (props) => { seen.push(props); return null; };
    const module = { id: 'test-probe', slots: { 'summary.cards': [{ id: 'probe', Component: Probe }] } };
    ENABLED_MODULES.push(module);
    try {
      render(<SlotOutlet name="summary.cards" context={{ patientId: 'p42' }} />);
      expect(seen[0].patientId).toBe('p42');
    } finally {
      ENABLED_MODULES.splice(ENABLED_MODULES.indexOf(module), 1);
    }
  });
});
