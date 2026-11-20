/**
 * AppsPanel — external services list and actions, SMART apps read-only,
 * registration form, and the system gate.
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('../../sdk', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  useAuth: vi.fn(),
}));

import { api, useAuth } from '../../sdk';
import AppsPanel from '../AppsPanel';

const SERVICE = { id: 'svc-1', name: 'HFpEF CDS', service_type: 'cds_hooks', base_url: 'https://cds.example.org', status: 'active', health_status: 'healthy', auto_disabled: false };

const mockGets = (services = [SERVICE]) =>
  api.get.mockImplementation((url) => {
    if (url === '/api/external-services') return Promise.resolve({ data: { services, total: services.length } });
    if (url === '/api/smart/apps') return Promise.resolve({ data: [{ client_id: 'growth-chart', name: 'Growth Chart', scopes: ['patient/*.read'], is_active: true }] });
    return Promise.reject(new Error(`unexpected ${url}`));
  });

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.put.mockReset();
  api.delete.mockReset();
});

it('lists services and SMART apps and runs deactivate, health check, and a two-step delete', async () => {
  useAuth.mockReturnValue({ user: { permissions: ['admin', 'system'] } });
  mockGets();
  api.put.mockResolvedValue({ data: {} });
  api.post.mockResolvedValue({ data: {} });
  api.delete.mockResolvedValue({ data: {} });

  render(<AppsPanel />);
  expect(await screen.findByText('HFpEF CDS')).toBeInTheDocument();
  expect(screen.getByText('Growth Chart')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }));
  await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/external-services/svc-1', { status: 'inactive' }));

  fireEvent.click(screen.getByRole('button', { name: 'Check' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/external-services/svc-1/health-check'));

  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  expect(api.delete).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));
  await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/api/external-services/svc-1'));
});

it('registers a service from the form', async () => {
  useAuth.mockReturnValue({ user: { permissions: ['admin', 'system'] } });
  mockGets([]);
  api.post.mockResolvedValue({ data: { id: 'svc-2' } });
  render(<AppsPanel />);
  await screen.findByText('No external services registered.');
  expect(screen.getByRole('button', { name: 'Register' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Service name'), { target: { value: 'My CDS' } });
  fireEvent.change(screen.getByLabelText('Base URL'), { target: { value: 'https://cds.test' } });
  fireEvent.click(screen.getByRole('button', { name: 'Register' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/external-services/register', {
    name: 'My CDS', service_type: 'cds_hooks', base_url: 'https://cds.test', auth_type: 'none', description: null,
  }));
});

it('is read-only without system', async () => {
  useAuth.mockReturnValue({ user: { permissions: ['admin'] } });
  mockGets();
  render(<AppsPanel />);
  expect(await screen.findByText(/needs the/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Register' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
});
