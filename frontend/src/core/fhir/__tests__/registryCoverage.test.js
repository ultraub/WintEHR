/**
 * Registry coverage pins (opportunity #3b + bug B2,
 * docs/ARCHITECTURE_DEBT.md).
 *
 * Deliberate boundary: the resource registry owns SEMANTICS (tiers,
 * membership, labels, sort names); themes and feature modules own their
 * PRESENTATION (colors, icons). These tests are the drift alarms across
 * that boundary — a type added to the registry without presentation
 * coverage fails here instead of rendering unstyled, and the keyboard
 * layer can never again hand-maintain a stale copy of the tab strip.
 */

import { PATIENT_CLINICAL_TYPES } from '../resourceRegistry';
import { resourceTypeAccents } from '../../../themes/categoricalAccents';
import {
  CLINICAL_TABS,
  TAB_ID_LIST,
} from '../../../components/clinical/workspace/clinicalTabRegistry';
import { TAB_ORDER, TAB_SHORTCUTS } from '../../../hooks/ui/useKeyboardNavigation';

describe('theme accents cover every patient-scoped clinical type', () => {
  // Patient itself is deliberately absent: it is the chart's identity, not
  // a categorized clinical datum, so it carries no category accent.
  it.each(PATIENT_CLINICAL_TYPES)('%s has a theme accent', (type) => {
    expect(resourceTypeAccents[type]).toBeDefined();
  });
});

describe('keyboard navigation derives from the tab registry (B2)', () => {
  it('ctrl+Tab cycles through EVERY tab — including Administration and Inbox', () => {
    expect(TAB_ORDER).toEqual(TAB_ID_LIST);
    expect(TAB_ORDER).toContain('administration');
    expect(TAB_ORDER).toContain('inbox');
  });

  it('digit shortcuts map to the first ten tabs in strip order', () => {
    const shortcutTabs = Object.values(TAB_SHORTCUTS).map((s) => s.tab);
    expect(shortcutTabs).toEqual(CLINICAL_TABS.slice(0, 10).map((t) => t.id));
  });

  it('shortcut descriptions use the registry labels', () => {
    for (const s of Object.values(TAB_SHORTCUTS)) {
      const tab = CLINICAL_TABS.find((t) => t.id === s.tab);
      expect(s.description).toBe(`Go to ${tab.label}`);
    }
  });
});
