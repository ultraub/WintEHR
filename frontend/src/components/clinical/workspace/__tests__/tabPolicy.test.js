/**
 * resolveEffectiveTabs — the layered policy rules, pure.
 */

import { ALWAYS_VISIBLE, EMPTY_TAB_POLICY, resolveEffectiveTabs, resolveEffectiveNav } from '../tabPolicy';

const TABS = ['summary', 'chart-review', 'results', 'orders', 'administration', 'pharmacy', 'inbox'].map((id) => ({
  id,
  label: id,
}));
const ids = (r) => r.tabs.map((t) => t.id);

it('with no policy every tab is visible in catalog order and Summary is the default', () => {
  const r = resolveEffectiveTabs(TABS, EMPTY_TAB_POLICY, { role: 'nurse' });
  expect(ids(r)).toEqual(TABS.map((t) => t.id));
  expect(r.defaultTab).toBe('summary');
  expect(r.hiddenIds).toEqual([]);
  expect(r.warnings).toEqual([]);
});

it('org hides for everyone; a role can only hide more', () => {
  const policy = {
    org: { hidden: ['inbox'] },
    roles: { nurse: { hidden: ['orders', 'inbox'] }, physician: { hidden: [] } },
  };
  expect(ids(resolveEffectiveTabs(TABS, policy, { role: 'physician' }))).not.toContain('inbox');
  const nurse = resolveEffectiveTabs(TABS, policy, { role: 'nurse' });
  expect(ids(nurse)).toEqual(['summary', 'chart-review', 'results', 'administration', 'pharmacy']);
  expect(nurse.hiddenIds.sort()).toEqual(['inbox', 'orders']);
  // Unknown role → org layer only.
  expect(ids(resolveEffectiveTabs(TABS, policy, { role: 'visitor' }))).toHaveLength(6);
});

it('Summary can never be hidden, even if the policy says so', () => {
  const r = resolveEffectiveTabs(TABS, { org: { hidden: ['summary'] } }, {});
  expect(ids(r)[0]).toBe('summary');
  expect(r.warnings[0]).toMatch(/summary cannot be hidden/);
  expect(ALWAYS_VISIBLE).toEqual(['summary']);
});

it('the most specific order wins and unmentioned tabs keep catalog order after it', () => {
  const policy = {
    org: { order: ['results', 'summary'] },
    roles: { nurse: { order: ['administration', 'summary'] } },
    contexts: { inpatient: { order: ['pharmacy'] } },
  };
  expect(ids(resolveEffectiveTabs(TABS, policy, {}))).toEqual(['results', 'summary', 'chart-review', 'orders', 'administration', 'pharmacy', 'inbox']);
  expect(ids(resolveEffectiveTabs(TABS, policy, { role: 'nurse' })).slice(0, 2)).toEqual(['administration', 'summary']);
  expect(ids(resolveEffectiveTabs(TABS, policy, { role: 'nurse', context: 'inpatient' }))[0]).toBe('pharmacy');
});

it('the most specific visible default wins; a hidden default falls back to the first visible tab', () => {
  const policy = {
    org: { default: 'chart-review' },
    roles: { nurse: { default: 'administration' }, pharmacist: { hidden: ['pharmacy'], default: 'pharmacy' } },
  };
  expect(resolveEffectiveTabs(TABS, policy, {}).defaultTab).toBe('chart-review');
  expect(resolveEffectiveTabs(TABS, policy, { role: 'nurse' }).defaultTab).toBe('administration');
  const pharm = resolveEffectiveTabs(TABS, policy, { role: 'pharmacist' });
  expect(pharm.defaultTab).toBe('summary');
  expect(pharm.warnings.join(' ')).toMatch(/default tab pharmacy is hidden/);
});

it('unknown tab ids are ignored with a warning, never thrown', () => {
  const r = resolveEffectiveTabs(TABS, { org: { hidden: ['nope'], order: ['zzz', 'results'], default: 'ghost' } }, {});
  expect(ids(r)).toHaveLength(TABS.length);
  expect(ids(r)[0]).toBe('results');
  expect(r.defaultTab).toBe('results');
  expect(r.warnings).toEqual(expect.arrayContaining([
    'unknown tab id in hidden: nope',
    'unknown tab id in order: zzz',
    'unknown default tab: ghost',
  ]));
});

it('tolerates malformed layers and a missing catalog', () => {
  expect(resolveEffectiveTabs(undefined, { org: { hidden: 'inbox' } }, {}).tabs).toEqual([]);
  expect(ids(resolveEffectiveTabs(TABS, { org: null, roles: null }, { role: 'nurse' }))).toHaveLength(TABS.length);
});

// --- sections (slice 7b) ----------------------------------------------------------

import { resolveEffectiveSections } from '../tabPolicy';

const SECTIONS = [
  { id: 'conditions', label: 'Conditions', host: 'chart-review', builtin: true, hostable: false },
  { id: 'medications', label: 'Medications', host: 'chart-review', builtin: true, hostable: false },
  { id: 'documents', label: 'Documents', host: 'chart-review', builtin: true, hostable: false },
  { id: 'imaging-studies', label: 'Imaging studies', host: 'imaging', builtin: false, hostable: true },
  { id: 'flowsheet', label: 'Flowsheet', host: 'flowsheet', builtin: false, hostable: true },
];
const sids = (r) => r.sections.map((s) => s.id);

it("a tab's own sections show in registry order with no policy", () => {
  const r = resolveEffectiveSections('chart-review', SECTIONS, EMPTY_TAB_POLICY, { role: 'nurse' });
  expect(sids(r)).toEqual(['conditions', 'medications', 'documents']);
  expect(r.addedIds).toEqual([]);
});

it('a layer can hide own sections, add hostable ones, and order the result', () => {
  const policy = {
    org: { sections: { 'chart-review': { hidden: ['documents'], added: ['flowsheet'] } } },
    roles: { nurse: { sections: { 'chart-review': { order: ['flowsheet', 'conditions'] } } } },
  };
  expect(sids(resolveEffectiveSections('chart-review', SECTIONS, policy, {}))).toEqual(['conditions', 'medications', 'flowsheet']);
  const nurse = resolveEffectiveSections('chart-review', SECTIONS, policy, { role: 'nurse' });
  expect(sids(nurse)).toEqual(['flowsheet', 'conditions', 'medications']);
  expect(nurse.addedIds).toEqual(['flowsheet']);
});

it('a role can hide a section the organization added, and non-hostable sections cannot be added', () => {
  const policy = {
    org: { sections: { 'chart-review': { added: ['imaging-studies', 'conditions'] } } },
    roles: { nurse: { sections: { 'chart-review': { hidden: ['imaging-studies'] } } } },
  };
  expect(sids(resolveEffectiveSections('chart-review', SECTIONS, policy, {}))).toContain('imaging-studies');
  expect(sids(resolveEffectiveSections('chart-review', SECTIONS, policy, { role: 'nurse' }))).not.toContain('imaging-studies');
  const r = resolveEffectiveSections('results', SECTIONS, { org: { sections: { results: { added: ['conditions', 'nope'] } } } }, {});
  expect(sids(r)).toEqual([]);
  expect(r.warnings).toEqual(expect.arrayContaining(['section conditions is not hostable; ignored', 'unknown section id in added: nope']));
});

it('sections on other tabs are untouched by a tab\'s spec', () => {
  const policy = { org: { sections: { 'chart-review': { hidden: ['conditions'] } } } };
  expect(sids(resolveEffectiveSections('imaging', SECTIONS, policy, {}))).toEqual(['imaging-studies']);
});

const NAV = [
  { id: 'dashboard', path: '/dashboard' },
  { id: 'patients', path: '/patients' },
  { id: 'analytics', path: '/analytics' },
  { id: 'command-center', path: '/command-center' },
];
const nids = (r) => r.items.map((i) => i.id);

it('nav: layers union their hidden pages; patients and the command center never hide; unknown ids warn', () => {
  const policy = {
    org: { nav: { hidden: ['dashboard', 'patients', 'nope'] } },
    roles: { nurse: { nav: { hidden: ['analytics', 'command-center'] } } },
    contexts: { clinic: { nav: { hidden: ['analytics'] } } },
  };
  expect(nids(resolveEffectiveNav(NAV, policy, {}))).toEqual(['patients', 'analytics', 'command-center']);
  const nurse = resolveEffectiveNav(NAV, policy, { role: 'nurse' });
  expect(nids(nurse)).toEqual(['patients', 'command-center']);
  expect(nurse.hiddenIds).toEqual(['dashboard', 'analytics']);
  expect(nurse.warnings).toEqual(expect.arrayContaining([
    'unknown nav id in hidden: nope',
    'patients cannot be hidden from the navigation; ignored',
    'command-center cannot be hidden from the navigation; ignored',
  ]));
  expect(nids(resolveEffectiveNav(NAV, policy, { role: 'physician', context: 'clinic' }))).toEqual(['patients', 'command-center']);
  expect(nids(resolveEffectiveNav(NAV, undefined, { role: 'nurse' }))).toHaveLength(4);
  expect(nids(resolveEffectiveNav(NAV, { org: { hidden: ['inbox'] } }, {}))).toHaveLength(4);
});
