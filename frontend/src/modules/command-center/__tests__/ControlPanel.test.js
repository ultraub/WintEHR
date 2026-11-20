/**
 * ControlPanel — not-configured state, container table, logs on select,
 * restart confirm + system gate, update check, config view.
 */

import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('../../sdk', () => ({
  api: { get: vi.fn(), post: vi.fn() },
  useAuth: vi.fn(),
}));

import { api, useAuth } from '../../sdk';
import ControlPanel from '../ControlPanel';

const CONTROL = {
  configured: true, reachable: true, error: null, how_to: null,
  containers: [
    { name: 'emr-backend', present: true, state: 'running', status: 'Up 3 hours (healthy)', health: 'healthy', image: 'wintehr-backend-prod', restartable: true },
    { name: 'emr-postgres', present: true, state: 'running', status: 'Up 3 hours', health: null, image: 'postgres:15', restartable: false },
    { name: 'vna-arc', present: false, state: 'absent', status: '', health: null, image: null, restartable: false },
  ],
};

const route = (overrides = {}) => (url) => {
  if (url === '/api/command-center/control') return Promise.resolve({ data: overrides.control || CONTROL });
  if (url.endsWith('/logs')) return Promise.resolve({ data: { name: 'emr-backend', lines: ['line one', 'line two'], tail: 300, truncated: false } });
  if (url.endsWith('/update-check')) return Promise.resolve({ data: overrides.update || { branch: 'master', local: 'a'.repeat(40), remote: 'b'.repeat(40), update_available: true, error: null } });
  if (url.endsWith('/config')) return Promise.resolve({ data: { nginx: 'server {}', nginx_path: 'deploy/rendered/nginx.conf', compose: 'services: {}', env_keys: ['POSTGRES_PASSWORD', 'CONTROL_PLANE_TOKEN'] } });
  return Promise.reject(new Error(`unexpected ${url}`));
};

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
});

it('explains how to enable the sidecar when it is not configured', async () => {
  useAuth.mockReturnValue({ user: { permissions: ['admin', 'system'] } });
  api.get.mockImplementation(route({ control: { configured: false, reachable: false, containers: [], error: null, how_to: 'Set CONTROL_PLANE_TOKEN in .env' } }));
  render(<ControlPanel />);
  expect(await screen.findByTestId('control-not-configured')).toHaveTextContent('Set CONTROL_PLANE_TOKEN');
});

it('lists containers, loads logs on select, and restarts after confirmation', async () => {
  useAuth.mockReturnValue({ user: { permissions: ['admin', 'system'] } });
  api.get.mockImplementation(route());
  api.post.mockResolvedValue({ data: { accepted: true, name: 'emr-backend' } });
  render(<ControlPanel />);
  const backend = await screen.findByTestId('container-emr-backend');
  expect(within(backend).getByText('running')).toBeInTheDocument();
  expect(within(backend).getByText('healthy')).toBeInTheDocument();
  const postgres = screen.getByTestId('container-emr-postgres');
  expect(within(postgres).getByRole('button', { name: 'Restart' })).toBeDisabled();
  const absent = screen.getByTestId('container-vna-arc');
  expect(within(absent).getByRole('button', { name: 'Logs' })).toBeDisabled();

  fireEvent.click(within(backend).getByRole('button', { name: 'Logs' }));
  await waitFor(() => expect(screen.getByTestId('container-logs')).toHaveTextContent('line one'));
  expect(api.get).toHaveBeenCalledWith('/api/command-center/control/containers/emr-backend/logs', { params: { tail: 300 } });

  fireEvent.click(within(backend).getByRole('button', { name: 'Restart' }));
  expect(await screen.findByText('Restart emr-backend?')).toBeInTheDocument();
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Restart' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/command-center/control/containers/emr-backend/restart'));
  expect(await screen.findByText(/Restart of emr-backend accepted/)).toBeInTheDocument();
});

it('keeps restart disabled without the system permission', async () => {
  useAuth.mockReturnValue({ user: { permissions: ['admin'] } });
  api.get.mockImplementation(route());
  render(<ControlPanel />);
  const backend = await screen.findByTestId('container-emr-backend');
  expect(within(backend).getByRole('button', { name: 'Restart' })).toBeDisabled();
});

it('runs the update check and shows the config view with env names only', async () => {
  useAuth.mockReturnValue({ user: { permissions: ['admin', 'system'] } });
  api.get.mockImplementation(route());
  render(<ControlPanel />);
  await screen.findByTestId('container-emr-backend');
  fireEvent.click(screen.getByRole('button', { name: 'Check for updates' }));
  expect(await screen.findByText(/Update available/)).toBeInTheDocument();
  fireEvent.click(screen.getByText('Deployment configuration (read-only)'));
  expect(await screen.findByText('CONTROL_PLANE_TOKEN')).toBeInTheDocument();
  expect(screen.getByText('server {}')).toBeInTheDocument();
});

it('needs the admin permission', () => {
  useAuth.mockReturnValue({ user: { permissions: ['read'] } });
  render(<ControlPanel />);
  expect(screen.getByText(/needs the/)).toBeInTheDocument();
  expect(api.get).not.toHaveBeenCalled();
});
