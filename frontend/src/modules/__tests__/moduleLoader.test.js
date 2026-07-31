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
