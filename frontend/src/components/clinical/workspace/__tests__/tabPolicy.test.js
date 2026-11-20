/**
 * resolveEffectiveTabs — the layered policy rules, pure.
 */

import { ALWAYS_VISIBLE, EMPTY_TAB_POLICY, resolveEffectiveTabs } from '../tabPolicy';

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
