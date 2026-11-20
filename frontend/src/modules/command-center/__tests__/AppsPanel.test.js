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

// --- SMART registration (slice 8b) --------------------------------------------------

it('registers a confidential SMART app, shows the secret once, and offers rotate/deactivate for registered apps', async () => {
  useAuth.mockReturnValue({ user: { permissions: ['admin', 'system'] } });
  let apps = [{ client_id: 'growth-chart-app', name: 'Growth Chart', scopes: ['launch'], is_active: true, client_type: 'public', source: 'demo' }];
  api.get.mockImplementation((url) => {
    if (url === '/api/external-services') return Promise.resolve({ data: { items: [], total: 0 } });
    if (url === '/api/smart/apps') return Promise.resolve({ data: apps });
    return Promise.reject(new Error(`unexpected ${url}`));
  });
  api.post.mockImplementation((url, body) => {
    if (url === '/api/smart/apps') {
      apps = [...apps, { client_id: 'risk-calc-abc123', name: body.name, scopes: body.scopes, is_active: true, client_type: body.client_type, source: 'registered', has_secret: true }];
      return Promise.resolve({ data: { client_id: 'risk-calc-abc123', client_secret: 'ONE-TIME-SECRET-xyz' } });
    }
    if (url.endsWith('/rotate-secret')) return Promise.resolve({ data: { client_id: 'risk-calc-abc123', client_secret: 'ROTATED-SECRET' } });
    return Promise.reject(new Error(`unexpected POST ${url}`));
  });
  api.put.mockResolvedValue({ data: {} });

  render(<AppsPanel />);
  await screen.findByText('Growth Chart');
  expect(screen.getByText('defined in code')).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('SMART app name'), { target: { value: 'Risk Calc' } });
  fireEvent.change(screen.getByLabelText('Redirect URIs'), { target: { value: 'https://app.example/cb\nhttps://app.example/alt' } });
  fireEvent.mouseDown(screen.getAllByRole('combobox').find((el) => el.textContent.includes('Public')));
  fireEvent.click(await screen.findByRole('option', { name: /Confidential/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Register SMART app' }));

  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/smart/apps', expect.objectContaining({
    name: 'Risk Calc', client_type: 'confidential', redirect_uris: ['https://app.example/cb', 'https://app.example/alt'],
  })));
  const secretBox = await screen.findByTestId('issued-secret');
  expect(secretBox.textContent).toContain('ONE-TIME-SECRET-xyz');
  await waitFor(() => expect(screen.getByText('Risk Calc')).toBeInTheDocument());

  fireEvent.click(screen.getByRole('button', { name: 'Rotate secret for Risk Calc' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/smart/apps/risk-calc-abc123/rotate-secret'));
  await waitFor(() => expect(screen.getByTestId('issued-secret').textContent).toContain('ROTATED-SECRET'));

  fireEvent.click(screen.getByRole('button', { name: 'Deactivate Risk Calc' }));
  await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/smart/apps/risk-calc-abc123', { is_active: false }));
});
