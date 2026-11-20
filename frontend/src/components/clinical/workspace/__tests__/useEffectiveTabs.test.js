/**
 * useEffectiveTabs — loads the policy once, applies the user's role, and
 * re-resolves when the policy store changes (what the Command Center
 * triggers after a save). Policy fetch failure leaves every tab visible.
 */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('../../../../services/api', () => ({ default: { get: vi.fn() } }));
vi.mock('../../../../contexts/AuthContext', () => ({ useAuth: vi.fn() }));

import api from '../../../../services/api';
import { useAuth } from '../../../../contexts/AuthContext';
import { useEffectiveTabs, __resetTabPolicyWarnings } from '../useEffectiveTabs';
import { __setTabPolicyForTests, refreshTabPolicy } from '../tabPolicyStore';
import { CLINICAL_TABS } from '../clinicalTabRegistry';

const Probe = () => {
  const { tabs, defaultTab, hiddenIds, ready } = useEffectiveTabs();
  return (
    <div>
      <div data-testid="ready">{String(ready)}</div>
      <div data-testid="tabs">{tabs.map((t) => t.id).join(',')}</div>
      <div data-testid="hidden">{hiddenIds.join(',')}</div>
      <div data-testid="default">{defaultTab}</div>
    </div>
  );
};

beforeEach(() => {
  api.get.mockReset();
  __resetTabPolicyWarnings();
  __setTabPolicyForTests({ loaded: false });
});

it('shows every registry tab before the policy loads, then applies the role layer', async () => {
  useAuth.mockReturnValue({ user: { role: 'nurse' } });
  api.get.mockResolvedValue({ data: { policy: { org: { hidden: ['inbox'] }, roles: { nurse: { hidden: ['orders'], default: 'administration' } } }, roles: ['nurse'] } });

  render(<Probe />);
  expect(screen.getByTestId('tabs').textContent.split(',')).toHaveLength(CLINICAL_TABS.length);

  await waitFor(() => expect(screen.getByTestId('ready').textContent).toBe('true'));
  expect(api.get).toHaveBeenCalledWith('/api/command-center/ui-policy');
  const visible = screen.getByTestId('tabs').textContent.split(',');
  expect(visible).not.toContain('inbox');
  expect(visible).not.toContain('orders');
  expect(screen.getByTestId('hidden').textContent.split(',').sort()).toEqual(['inbox', 'orders']);
  expect(screen.getByTestId('default').textContent).toBe('administration');
});

it('re-resolves when the policy is refreshed (after a Command Center save)', async () => {
  useAuth.mockReturnValue({ user: { role: 'physician' } });
  api.get.mockResolvedValueOnce({ data: { policy: {}, roles: [] } });
  render(<Probe />);
  await waitFor(() => expect(screen.getByTestId('ready').textContent).toBe('true'));
  expect(screen.getByTestId('hidden').textContent).toBe('');

  api.get.mockResolvedValueOnce({ data: { policy: { org: { hidden: ['pharmacy'] } }, roles: [] } });
  await act(async () => {
    await refreshTabPolicy();
  });
  expect(screen.getByTestId('hidden').textContent).toBe('pharmacy');
});

it('a failed policy fetch leaves the chart fully visible', async () => {
  useAuth.mockReturnValue({ user: { role: 'nurse' } });
  api.get.mockRejectedValue(new Error('network down'));
  render(<Probe />);
  await waitFor(() => expect(screen.getByTestId('ready').textContent).toBe('true'));
  expect(screen.getByTestId('tabs').textContent.split(',')).toHaveLength(CLINICAL_TABS.length);
  expect(screen.getByTestId('hidden').textContent).toBe('');
});
