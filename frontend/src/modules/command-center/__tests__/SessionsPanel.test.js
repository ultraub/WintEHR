/**
 * SessionsPanel — list with the current marker, revoke one / revoke all after
 * confirmation, own-session warning, system gate, JWT note.
 */

import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('../../sdk', () => ({
  api: { get: vi.fn(), delete: vi.fn() },
  useAuth: vi.fn(),
}));

import { api, useAuth } from '../../sdk';
import SessionsPanel from '../SessionsPanel';

const SESSIONS = {
  mode: 'training', shared: true, note: null,
  sessions: [
    { id: 'aaaa000000000001', kind: 'training', user_id: 'demo-admin', username: 'admin', name: 'Dr. Demo Administrator', role: 'admin', created_at: '2026-11-21T11:00:00Z', expires_at: '2026-11-22T11:00:00Z', ip: '10.0.0.1', user_agent: 'Firefox', current: true },
    { id: 'bbbb000000000002', kind: 'training', user_id: 'demo-physician', username: 'demo', name: 'Dr. Demo Physician', role: 'physician', created_at: '2026-11-21T10:00:00Z', expires_at: '2026-11-22T10:00:00Z', ip: '10.0.0.5', user_agent: null, current: false },
    { id: 'cccc000000000003', kind: 'training', user_id: 'demo-physician', username: 'demo', name: 'Dr. Demo Physician', role: 'physician', created_at: '2026-11-21T09:00:00Z', expires_at: '2026-11-22T09:00:00Z', ip: null, user_agent: null, current: false },
    { id: 'dddd000000000004', kind: 'practitioner', user_id: '78', username: 'Reilly981', name: 'Dr Reilly', role: 'physician', created_at: '2026-11-21T08:00:00Z', expires_at: '2026-11-22T08:00:00Z', ip: '10.0.0.9', user_agent: null, current: false },
  ],
};

beforeEach(() => {
  api.get.mockReset();
  api.delete.mockReset();
});

it('lists sessions, marks the caller, and revokes one after confirmation', async () => {
  useAuth.mockReturnValue({ user: { id: 'demo-admin', permissions: ['admin', 'system'] } });
  api.get.mockResolvedValue({ data: SESSIONS });
  api.delete.mockResolvedValue({ data: { revoked: 1 } });
  render(<SessionsPanel pollMs={0} />);
  expect(await screen.findByText('4 active sessions')).toBeInTheDocument();
  expect(screen.getByText('shared store')).toBeInTheDocument();
  const me = screen.getByTestId('session-aaaa000000000001');
  expect(me).toHaveTextContent('this session');
  const demo = screen.getByTestId('session-bbbb000000000002');
  expect(demo).toHaveTextContent('10.0.0.5');
  expect(within(demo).getByRole('button', { name: 'Revoke all sessions of demo' })).toHaveTextContent('Revoke all (2)');
  expect(within(screen.getByTestId('session-dddd000000000004')).queryByRole('button', { name: /Revoke all/ })).not.toBeInTheDocument();

  fireEvent.click(within(demo).getByRole('button', { name: 'Revoke session bbbb000000000002' }));
  expect(await screen.findByText('Revoke session of demo?')).toBeInTheDocument();
  expect(screen.queryByText(/your own session/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Revoke' }));
  await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/api/command-center/sessions/bbbb000000000002'));
  expect(await screen.findByText('Revoked 1 session.')).toBeInTheDocument();
  expect(api.get).toHaveBeenCalledTimes(2);
});

it('revokes every session of a user and warns when that includes your own', async () => {
  useAuth.mockReturnValue({ user: { id: 'demo-admin', permissions: ['admin', 'system'] } });
  api.get.mockResolvedValue({ data: SESSIONS });
  api.delete.mockResolvedValue({ data: { revoked: 2 } });
  render(<SessionsPanel pollMs={0} />);
  const demo = await screen.findByTestId('session-bbbb000000000002');
  fireEvent.click(within(demo).getByRole('button', { name: 'Revoke all sessions of demo' }));
  expect(await screen.findByText('Revoke all sessions of demo?')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Revoke' }));
  await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/api/command-center/sessions', { params: { user_id: 'demo-physician' } }));
  expect(await screen.findByText('Revoked 2 sessions of demo.')).toBeInTheDocument();

  // text query: the just-closed dialog's exit transition still aria-hides the page in jsdom
  fireEvent.click(within(screen.getByTestId('session-aaaa000000000001')).getByText('Revoke'));
  expect(await screen.findByText(/This includes your own session/)).toBeInTheDocument();
});

it('is read-only without the system permission and shows the backend note', async () => {
  useAuth.mockReturnValue({ user: { id: 'demo-physician', permissions: ['admin'] } });
  api.get.mockResolvedValue({ data: { ...SESSIONS, shared: false, note: 'Sessions are in-process on this worker (no Redis); with several workers this list is partial.' } });
  render(<SessionsPanel pollMs={0} />);
  await screen.findByText('4 active sessions');
  expect(screen.getByTestId('sessions-note')).toHaveTextContent('in-process');
  expect(screen.getByText(/needs the/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Revoke session bbbb000000000002' })).toBeDisabled();
});

it('explains JWT mode and surfaces load errors', async () => {
  useAuth.mockReturnValue({ user: { id: 'demo-admin', permissions: ['admin', 'system'] } });
  api.get.mockResolvedValueOnce({ data: { mode: 'jwt', sessions: [], shared: null, note: 'JWT mode: tokens are self-contained and not tracked server-side, so there is nothing to list or revoke.' } });
  const { unmount } = render(<SessionsPanel pollMs={0} />);
  expect(await screen.findByTestId('sessions-note')).toHaveTextContent('JWT mode');
  expect(screen.queryByText('No one is logged in.')).not.toBeInTheDocument();
  unmount();
  api.get.mockRejectedValueOnce({ response: { data: { detail: 'Admin access required' } } });
  render(<SessionsPanel pollMs={0} />);
  expect(await screen.findByText('Admin access required')).toBeInTheDocument();
});
