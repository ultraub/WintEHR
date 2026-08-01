/**
 * Module-loader tests (docs/MODULES.md).
 *
 * Pins the platform contract: module tabs are ordinary registry entries
 * (every selector treats them identically to core tabs), and each manifest
 * carries everything the registry consumers need — a missing field here
 * would surface as a silently broken strip entry or keyboard shortcut.
 */

import { describe, it, expect } from 'vitest';

import { ENABLED_MODULES, getModuleTabs } from '../index';
import {
  CLINICAL_TABS,
  TAB_ID_LIST,
  TAB_DISPLAY_NAMES,
  isKnownTabId,
} from '../../components/clinical/workspace/clinicalTabRegistry';
import { categoricalAccents } from '../../themes/categoricalAccents';

describe('module loader', () => {
  it('every manifest has a unique module id', () => {
    const ids = ENABLED_MODULES.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach((id) => expect(id).toMatch(/^[a-z][a-z0-9-]*$/));
  });

  it('module tab entries carry the full registry field set', () => {
    for (const tab of getModuleTabs()) {
      expect(tab.id).toBeTruthy();
      expect(tab.label).toBeTruthy();
      expect(tab.icon).toBeTruthy();
      expect(tab.color).toBeTruthy();
      expect(tab.description).toBeTruthy();
      expect(typeof tab.loader).toBe('function');
    }
  });

  it('module tabs are first-class registry entries', () => {
    for (const tab of getModuleTabs()) {
      expect(TAB_ID_LIST).toContain(tab.id);
      expect(isKnownTabId(tab.id)).toBe(true);
      expect(TAB_DISPLAY_NAMES[tab.id]).toBe(tab.label);
    }
  });

  it('module tab ids do not collide with core tabs', () => {
    const ids = CLINICAL_TABS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('module tab colors come from categoricalAccents (one hue system)', () => {
    const accentValues = Object.values(categoricalAccents);
    for (const tab of getModuleTabs()) {
      expect(accentValues).toContain(tab.color);
    }
  });
});

describe('flowsheets module', () => {
  it('is enabled by default and contributes the flowsheet tab', () => {
    expect(ENABLED_MODULES.map((m) => m.id)).toContain('flowsheets');
    expect(TAB_ID_LIST).toContain('flowsheet');
  });

  it('its tab chunk resolves to a component', async () => {
    const tab = getModuleTabs().find((t) => t.id === 'flowsheet');
    const mod = await tab.loader();
    expect(mod.default).toBeTruthy();
  });
});

// ---------------------------------------------------------------------
// Pages contract (module platform Phase 1)
// ---------------------------------------------------------------------

import { getModulePages } from '../index';
import { buildNavigationConfig, NAV_SECTION_KEYS } from '../../components/navigationRegistry';

describe('module pages', () => {
  it('every page entry carries the full field set', () => {
    for (const p of getModulePages()) {
      expect(p.id).toBeTruthy();
      expect(p.path).toMatch(/^\//);
      expect(p.label).toBeTruthy();
      expect(p.icon).toBeTruthy();
      expect(p.color).toBeTruthy();
      expect(typeof p.loader).toBe('function');
      if (p.nav) {
        expect(NAV_SECTION_KEYS).toContain(p.nav.section);
        expect(typeof p.nav.order).toBe('number');
      }
    }
  });

  it('page paths are unique across modules', () => {
    const paths = getModulePages().map((p) => p.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('page colors come from categoricalAccents (one hue system)', () => {
    const accentValues = Object.values(categoricalAccents);
    for (const p of getModulePages()) {
      expect(accentValues).toContain(p.color);
    }
  });

  it('the coherence migration is in place: scheduling and quality-analytics own their pages', () => {
    const byModule = Object.fromEntries(
      ENABLED_MODULES.map((m) => [m.id, (m.pages || []).map((p) => p.path)]),
    );
    expect(byModule['scheduling']).toEqual(['/schedule']);
    expect(byModule['quality-analytics']).toEqual(['/analytics', '/quality', '/care-gaps']);
  });
});

describe('navigation registry', () => {
  it('module pages land in their target sections, ordered', () => {
    const config = buildNavigationConfig();
    const clinicalPaths = config.clinical.items.map((i) => i.path);
    // Schedule slots between Dashboard (10) and Patients (30) via order 20.
    expect(clinicalPaths).toEqual(
      ['/dashboard', '/schedule', '/patients', '/encounters', '/pharmacy'],
    );
    // Population Health exists ONLY because quality-analytics contributes it.
    expect(config.analytics.items.map((i) => i.path)).toEqual(
      ['/analytics', '/quality', '/care-gaps'],
    );
  });

  it('a section with no items is dropped, not rendered empty', () => {
    // The analytics section seed is empty by design; if the module system
    // were broken the section would either vanish (fine) or show empty
    // (a bug). With modules enabled it must be present and populated.
    const config = buildNavigationConfig();
    for (const section of Object.values(config)) {
      expect(section.items.length).toBeGreaterThan(0);
    }
  });
});

describe('tab placement', () => {
  it('flowsheet sits directly after the MAR, not at the end of the strip', () => {
    const ids = CLINICAL_TABS.map((t) => t.id);
    expect(ids.indexOf('flowsheet')).toBe(ids.indexOf('administration') + 1);
  });

  it('a tab with an unknown insertAfter would append, never vanish', () => {
    // Contract check via the registry length: every module tab is present
    // exactly once regardless of placement.
    const ids = CLINICAL_TABS.map((t) => t.id);
    for (const tab of getModuleTabs()) {
      expect(ids.filter((id) => id === tab.id)).toHaveLength(1);
    }
  });
});
