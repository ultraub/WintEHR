/**
 * AuditPanel — loads with the default window, renders rows with category,
 * user, outcome and target, expands details, filters drive the query,
 * says when the window held more, admin gate.
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('../../sdk', () => ({
  api: { get: vi.fn() },
  useAuth: vi.fn(),
}));

import { api, useAuth } from '../../sdk';
import AuditPanel from '../AuditPanel';

const PAGE = {
  events: [
    { id: '1', recorded: '2026-11-21T10:00:00Z', event_type: 'system.setting.updated', category: 'system', action: 'update', outcome: 'success',
      user: 'demo-admin', ip: '10.0.0.5', patient: null, entity: 'Setting/system.patient_count_cap', details: { key: 'system.patient_count_cap', tier: 'live' } },
    { id: '2', recorded: '2026-11-21T09:59:00Z', event_type: 'auth.login.failure', category: 'auth', action: 'execute', outcome: 'failure',
      user: 'nurse', ip: null, patient: null, entity: null, details: {} },
  ],
  total: 900, fetched: 200, limit: 200, truncated: true,
  event_types: ['auth.login.failure', 'system.setting.updated'],
};

beforeEach(() => {
  api.get.mockReset();
});

it('refuses non-admins without calling the backend', () => {
  useAuth.mockReturnValue({ user: { permissions: ['read'] } });
  render(<AuditPanel />);
  expect(screen.getByText(/needs the/)).toBeInTheDocument();
  expect(api.get).not.toHaveBeenCalled();
});

it('loads the last 7 days by default and renders rows, outcomes, targets and expandable details', async () => {
  useAuth.mockReturnValue({ user: { permissions: ['admin'] } });
  api.get.mockResolvedValue({ data: PAGE });
  render(<AuditPanel />);
  await waitFor(() => expect(screen.getByTestId('audit-row-1')).toBeInTheDocument());
  const [url, config] = api.get.mock.calls[0];
  expect(url).toBe('/api/command-center/audit');
  expect(config.params.since).toMatch(/T/);
  expect(config.params.limit).toBe(200);
  expect(config.params.category).toBeUndefined();
  expect(screen.getByText('system.setting.updated')).toBeInTheDocument();
  expect(screen.getByText('demo-admin')).toBeInTheDocument();
  expect(screen.getByText('failure')).toBeInTheDocument();
  expect(screen.getByText('Setting/system.patient_count_cap')).toBeInTheDocument();
  expect(screen.getByText(/within the newest 200/)).toBeInTheDocument();
  expect(screen.getByText(/900 in total/)).toBeInTheDocument();
  // row 2 has no details, so no expander; row 1 expands to the JSON and the IP
  expect(screen.queryByLabelText(/details for auth.login.failure/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByLabelText('Show details for system.setting.updated'));
  await waitFor(() => expect(screen.getByTestId('audit-details-1')).toBeInTheDocument());
  expect(screen.getByTestId('audit-details-1').textContent).toContain('from 10.0.0.5');
  expect(screen.getByTestId('audit-details-1').textContent).toContain('"tier": "live"');
});

it('user and text filters are sent as query params and the event-type picker lists the fetched codes', async () => {
  useAuth.mockReturnValue({ user: { permissions: ['admin'] } });
  api.get.mockResolvedValue({ data: PAGE });
  render(<AuditPanel />);
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));
  fireEvent.change(screen.getByLabelText('User'), { target: { value: 'nurse' } });
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
  expect(api.get.mock.calls[1][1].params.user).toBe('nurse');
  fireEvent.change(screen.getByLabelText('Contains'), { target: { value: 'certbot' } });
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(3));
  expect(api.get.mock.calls[2][1].params.q).toBe('certbot');
  fireEvent.mouseDown(screen.getByLabelText('Event type'));
  await waitFor(() => expect(screen.getByRole('option', { name: 'system.setting.updated' })).toBeInTheDocument());
});

it('shows the backend error', async () => {
  useAuth.mockReturnValue({ user: { permissions: ['admin'] } });
  api.get.mockRejectedValue({ response: { data: { detail: 'FHIR store unreachable: ConnectError' } } });
  render(<AuditPanel />);
  await waitFor(() => expect(screen.getByText('FHIR store unreachable: ConnectError')).toBeInTheDocument());
});
