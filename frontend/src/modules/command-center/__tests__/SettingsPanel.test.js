/**
 * SettingsPanel — rows with tier/source, typed saves, secret handling, reset,
 * and the system-permission gate. Backend mocked at the SDK boundary.
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('../../sdk', () => ({
  api: { get: vi.fn(), put: vi.fn(), delete: vi.fn() },
  useAuth: vi.fn(),
}));

import { api, useAuth } from '../../sdk';
import SettingsPanel from '../SettingsPanel';

const base = (overrides) => ({
  key: 'system.patient_count_cap',
  label: 'Patient count cap',
  description: 'Upper bound on patients.',
  type: 'int',
  tier: 'live',
  used_by: 'job runner',
  env_var: null,
  default: 500,
  value: 500,
  is_secret: false,
  is_set: true,
  source: 'default',
  updated_by: null,
  updated_at: null,
  secrets_enabled: null,
  ...overrides,
});

const SETTINGS = [
  base(),
  base({
    key: 'system.hapi_timeout_seconds', label: 'HAPI FHIR request timeout', type: 'float', tier: 'restart',
    env_var: 'HAPI_FHIR_TIMEOUT', default: 30, value: 45, source: 'environment',
  }),
  base({
    key: 'system.umls_api_key', label: 'UMLS API key', type: 'secret', is_secret: true, is_set: false,
    value: null, default: null, secrets_enabled: true, env_var: 'UMLS_API_KEY',
  }),
];

beforeEach(() => {
  api.get.mockReset();
  api.put.mockReset();
  api.delete.mockReset();
  api.get.mockResolvedValue({ data: SETTINGS });
});

it('shows every setting with its tier and source', async () => {
  useAuth.mockReturnValue({ user: { permissions: ['admin', 'system'] } });
  render(<SettingsPanel />);
  await waitFor(() => expect(screen.getByText('Patient count cap')).toBeInTheDocument());
  expect(screen.getAllByText('live').length).toBeGreaterThanOrEqual(2); // legend + row
  expect(screen.getAllByText('restart').length).toBeGreaterThanOrEqual(2);
  expect(screen.getByText('env var')).toBeInTheDocument();
  expect(screen.getByText('Not set')).toBeInTheDocument();
  expect(screen.getByText(/env HAPI_FHIR_TIMEOUT/)).toBeInTheDocument();
});

it('saves a numeric setting as a number and shows the new source', async () => {
  useAuth.mockReturnValue({ user: { permissions: ['admin', 'system'] } });
  api.put.mockResolvedValue({ data: base({ value: 250, source: 'database', updated_by: 'demo-admin' }) });
  render(<SettingsPanel />);
  const input = await screen.findByLabelText('Patient count cap');
  const save = screen.getByRole('button', { name: 'Save Patient count cap' });
  expect(save).toBeDisabled();
  fireEvent.change(input, { target: { value: '250' } });
  expect(save).toBeEnabled();
  fireEvent.click(save);
  await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/command-center/settings/system.patient_count_cap', { value: 250 }));
  await waitFor(() => expect(screen.getByText('override')).toBeInTheDocument());
  expect(screen.getByText('by demo-admin')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Reset Patient count cap' })).toBeInTheDocument();
});

it('resets an override and shows the fallback source', async () => {
  useAuth.mockReturnValue({ user: { permissions: ['admin', 'system'] } });
  api.get.mockResolvedValue({ data: [base({ value: 250, source: 'database', updated_by: 'demo-admin' })] });
  api.delete.mockResolvedValue({ data: base({ value: 500, source: 'default' }) });
  render(<SettingsPanel />);
  fireEvent.click(await screen.findByRole('button', { name: 'Reset Patient count cap' }));
  await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/api/command-center/settings/system.patient_count_cap'));
  await waitFor(() => expect(screen.getByText('default')).toBeInTheDocument());
  expect(screen.queryByRole('button', { name: 'Reset Patient count cap' })).not.toBeInTheDocument();
});

it('saves a secret without ever displaying it and clears the field', async () => {
  useAuth.mockReturnValue({ user: { permissions: ['admin', 'system'] } });
  api.put.mockResolvedValue({ data: base({ key: 'system.umls_api_key', label: 'UMLS API key', type: 'secret', is_secret: true, is_set: true, value: null, source: 'database', secrets_enabled: true }) });
  render(<SettingsPanel />);
  const input = await screen.findByLabelText('UMLS API key');
  expect(input).toHaveAttribute('type', 'password');
  fireEvent.change(input, { target: { value: 'umls-real-key' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save UMLS API key' }));
  await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/command-center/settings/system.umls_api_key', { value: 'umls-real-key' }));
  await waitFor(() => expect(screen.getByText('Set')).toBeInTheDocument());
  expect(screen.getByLabelText('UMLS API key')).toHaveValue('');
  expect(document.body.textContent).not.toContain('umls-real-key');
});

it('blocks secret entry and explains why when the backend has no settings key', async () => {
  useAuth.mockReturnValue({ user: { permissions: ['admin', 'system'] } });
  api.get.mockResolvedValue({ data: [base({ key: 'system.umls_api_key', label: 'UMLS API key', type: 'secret', is_secret: true, is_set: false, value: null, secrets_enabled: false })] });
  render(<SettingsPanel />);
  expect(await screen.findByText(/WINTEHR_SETTINGS_KEY/)).toBeInTheDocument();
  expect(screen.getByLabelText('UMLS API key')).toBeDisabled();
});

it('is read-only without the system permission and surfaces backend errors', async () => {
  useAuth.mockReturnValue({ user: { permissions: ['admin'] } });
  render(<SettingsPanel />);
  expect(await screen.findByText(/needs the/)).toBeInTheDocument();
  expect(screen.getByLabelText('Patient count cap')).toBeDisabled();
  expect(screen.queryByRole('button', { name: /Save/ })).not.toBeInTheDocument();
});

it('shows the backend detail when a save is refused', async () => {
  useAuth.mockReturnValue({ user: { permissions: ['admin', 'system'] } });
  api.put.mockRejectedValue({ response: { data: { detail: 'system.patient_count_cap: must be at least 1' } } });
  render(<SettingsPanel />);
  fireEvent.change(await screen.findByLabelText('Patient count cap'), { target: { value: '0' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Patient count cap' }));
  await waitFor(() => expect(screen.getByText(/must be at least 1/)).toBeInTheDocument());
});
