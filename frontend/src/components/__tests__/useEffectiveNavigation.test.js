/**
 * useEffectiveNavigation — the shell's menu minus what the navigation policy
 * hides for this user's role and context; hidden paths and the landing page.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('../../services/api', () => ({ default: { get: vi.fn() } }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: vi.fn() }));

import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useEffectiveNavigation, __resetNavigationForTests, pathUnder } from '../useEffectiveNavigation';
import { __setTabPolicyForTests, setWorkflowContext } from '../clinical/workspace/tabPolicyStore';
import { navigationCatalog } from '../navigationRegistry';

const Probe = () => {
  const { config, hiddenIds, landingPath, isHiddenPath, ready } = useEffectiveNavigation();
  return (
    <div>
      <div data-testid="ready">{String(ready)}</div>
      <div data-testid="items">{Object.values(config).flatMap((s) => s.items.map((i) => i.id)).join(',')}</div>
      <div data-testid="sections">{Object.keys(config).join(',')}</div>
      <div data-testid="hidden">{hiddenIds.join(',')}</div>
      <div data-testid="landing">{landingPath}</div>
      <div data-testid="dashboard-hidden">{String(isHiddenPath('/dashboard'))}</div>
      <div data-testid="chart-hidden">{String(isHiddenPath('/patients/abc/clinical'))}</div>
    </div>
  );
};

beforeEach(() => {
  api.get.mockReset();
  __resetNavigationForTests();
  setWorkflowContext(null);
  __setTabPolicyForTests({ loaded: false });
});

it('every nav item in the build has a unique id and the catalog lists them all', () => {
  const catalog = navigationCatalog();
  const ids = catalog.map((i) => i.id);
  expect(ids.every(Boolean)).toBe(true);
  expect(new Set(ids).size).toBe(ids.length);
  expect(ids).toEqual(expect.arrayContaining(['dashboard', 'patients', 'command-center']));
});

it('shows the whole menu until the policy loads, then hides pages for the role and redirects their paths', async () => {
  useAuth.mockReturnValue({ user: { role: 'nurse' } });
  api.get.mockResolvedValue({ data: { policy: { org: { nav: { hidden: ['dashboard'] } }, roles: { nurse: { nav: { hidden: ['fhir-explorer', 'cds-studio'] } } } }, roles: ['nurse'] } });

  render(<Probe />);
  expect(screen.getByTestId('ready').textContent).toBe('false');
  expect(screen.getByTestId('items').textContent).toContain('dashboard');
  expect(screen.getByTestId('landing').textContent).toBe('/dashboard');

  await waitFor(() => expect(screen.getByTestId('ready').textContent).toBe('true'));
  // a nurse is not an administrator, so the Command Center is hidden too
  expect(screen.getByTestId('hidden').textContent).toBe('dashboard,fhir-explorer,cds-studio,command-center');
  expect(screen.getByTestId('items').textContent).not.toContain('dashboard');
  // Developer Tools lost both pages, so the section is gone.
  expect(screen.getByTestId('sections').textContent.split(',')).not.toContain('tools');
  expect(screen.getByTestId('landing').textContent).toBe('/patients');
  expect(screen.getByTestId('dashboard-hidden').textContent).toBe('true');
  expect(screen.getByTestId('chart-hidden').textContent).toBe('false');
});

it('the chosen workflow context narrows the menu on top of the role', async () => {
  useAuth.mockReturnValue({ user: { role: 'physician' } });
  __setTabPolicyForTests({
    policy: { org: {}, roles: {}, contexts: { clinic: { nav: { hidden: ['encounters'] } } } },
    contexts: ['clinic'],
  });
  const { rerender } = render(<Probe />);
  expect(screen.getByTestId('hidden').textContent).toBe('command-center');
  setWorkflowContext('clinic');
  rerender(<Probe />);
  await waitFor(() => expect(screen.getByTestId('hidden').textContent).toBe('encounters,command-center'));
});

it('the Command Center is in the menu for an administrator and for nobody else', () => {
  __setTabPolicyForTests({ policy: { org: {}, roles: {}, contexts: {} }, contexts: [] });
  useAuth.mockReturnValue({ user: { role: 'admin', permissions: ['read', 'admin', 'system'] } });
  const { unmount } = render(<Probe />);
  expect(screen.getByTestId('hidden').textContent).toBe('');
  expect(screen.getByTestId('items').textContent).toContain('command-center');
  unmount();

  useAuth.mockReturnValue({ user: { role: 'physician', permissions: ['read', 'write', 'prescribe'] } });
  render(<Probe />);
  expect(screen.getByTestId('hidden').textContent).toBe('command-center');
  expect(screen.getByTestId('items').textContent).not.toContain('command-center');
});

it('pathUnder matches a page and its sub-pages only', () => {
  expect(pathUnder('/pharmacy', '/pharmacy')).toBe(true);
  expect(pathUnder('/pharmacy/inventory', '/pharmacy')).toBe(true);
  expect(pathUnder('/pharmacy-other', '/pharmacy')).toBe(false);
});
