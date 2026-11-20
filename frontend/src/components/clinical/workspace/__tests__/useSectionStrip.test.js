/**
 * useSectionStrip: the strip follows the policy (hidden sections leave,
 * order holds), selection sticks while visible, and falls back to the first
 * visible section when the chosen one is hidden or nothing was chosen.
 */

import { renderHook, act } from '@testing-library/react';
import { useSectionStrip } from '../useSectionStrip';

const sections = vi.hoisted(() => ({ current: [] }));
vi.mock('../useEffectiveSections', () => ({
  useEffectiveSections: () => ({ sections: sections.current, ready: true }),
}));

const b = (id) => ({ id, label: id, host: 'results', builtin: true });

beforeEach(() => {
  sections.current = [b('lab-results'), b('vital-signs'), b('diagnostic-reports')];
});

it('starts on the default section and follows a selection', () => {
  const { result } = renderHook(() => useSectionStrip('results', 'lab-results'));
  expect(result.current.activeId).toBe('lab-results');
  act(() => result.current.select('diagnostic-reports'));
  expect(result.current.activeId).toBe('diagnostic-reports');
  expect(result.current.sections.map((s) => s.id)).toEqual(['lab-results', 'vital-signs', 'diagnostic-reports']);
});

it('falls back to the first visible section when the chosen one is hidden by policy', () => {
  sections.current = [b('vital-signs'), b('diagnostic-reports')];
  const { result } = renderHook(() => useSectionStrip('results', 'lab-results'));
  expect(result.current.activeId).toBe('vital-signs');
});

it('a hosted section added by the policy is selectable like a builtin one', () => {
  const hosted = { id: 'flowsheet', label: 'Flowsheet', host: 'flowsheets', builtin: false, hostable: true, loader: () => {} };
  sections.current = [b('lab-results'), hosted];
  const { result } = renderHook(() => useSectionStrip('results', 'lab-results'));
  act(() => result.current.select('flowsheet'));
  expect(result.current.active).toBe(hosted);
  expect(result.current.active.builtin).toBe(false);
});

it('yields no active section when the policy hides every section', () => {
  sections.current = [];
  const { result } = renderHook(() => useSectionStrip('results', 'lab-results'));
  expect(result.current.active).toBeNull();
  expect(result.current.activeId).toBeNull();
});
