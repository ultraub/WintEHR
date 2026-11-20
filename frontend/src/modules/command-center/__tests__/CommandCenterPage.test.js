/**
 * CommandCenterPage — the four states (loading, error, not-admin, success)
 * against a mocked status endpoint and auth context.
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('../../../services/api', () => ({
  default: { get: vi.fn() },
}));
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import api from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import CommandCenterPage from '../CommandCenterPage';

const REPORT = {
  status: 'degraded',
  checked_at: '2026-11-20T12:00:00Z',
  build: { version: '1.0.0', git_commit: 'abcdef1234567890', environment: 'development' },
  routers: {
    registered: 41,
    failed: [{ router: 'Flowsheets', error: 'ImportError: nope' }],
    disabled_modules: ['imaging'],
    modules: ['flowsheets', 'imaging', 'command-center'],
  },
  components: [
    { name: 'fhir', status: 'ok', detail: 'HAPI FHIR Server 8.8.0', data: { patient_count: 761 } },
    {
      name: 'database',
      status: 'ok',
      detail: '3 resources',
      data: { resource_counts: { Observation: 2, Patient: 1 }, total_resources: 3 },
    },
    { name: 'terminology', status: 'degraded', detail: 'Terminology index not built', data: { present: false } },
    { name: 'vna', status: 'absent', detail: 'DICOM_QIDO_URL not set', data: {} },
  ],
};

const admin = () => useAuth.mockReturnValue({ user: { permissions: ['read', 'admin'] } });

beforeEach(() => {
  api.get.mockReset();
});

it('refuses non-admin users without calling the backend', () => {
  useAuth.mockReturnValue({ user: { permissions: ['read', 'write'] } });
  render(<CommandCenterPage />);
  expect(screen.getByText(/Administrator access is required/)).toBeInTheDocument();
  expect(api.get).not.toHaveBeenCalled();
});

it('shows a loading state, then every component, router failures and resource counts', async () => {
  admin();
  api.get.mockResolvedValue({ data: REPORT });
  render(<CommandCenterPage />);

  expect(screen.getByText(/Probing the deployment/)).toBeInTheDocument();
  await waitFor(() => expect(screen.getByText('HAPI FHIR')).toBeInTheDocument());
  expect(api.get).toHaveBeenCalledWith('/api/command-center/status');

  // Components by their friendly names, with status chips.
  expect(screen.getByText('Terminology index')).toBeInTheDocument();
  expect(screen.getByText('Imaging VNA')).toBeInTheDocument();
  expect(screen.getAllByText('degraded').length).toBeGreaterThanOrEqual(2); // header + terminology
  expect(screen.getByText('absent')).toBeInTheDocument();

  // Router failure is loud, disabled module is listed.
  expect(screen.getByText('Flowsheets')).toBeInTheDocument();
  expect(screen.getByText(/ImportError: nope/)).toBeInTheDocument();
  expect(screen.getByText('imaging')).toBeInTheDocument();

  // Resource counts table, sorted by count.
  const cells = screen.getAllByRole('cell').map((c) => c.textContent);
  expect(cells.indexOf('Observation')).toBeLessThan(cells.indexOf('Patient'));

  // Build info in the header.
  expect(screen.getByText(/v1\.0\.0 \(abcdef12\)/)).toBeInTheDocument();
});

it('surfaces the backend error detail and lets the user retry', async () => {
  admin();
  api.get
    .mockRejectedValueOnce({ response: { data: { detail: 'Admin access required' } } })
    .mockResolvedValueOnce({ data: REPORT });
  render(<CommandCenterPage />);

  await waitFor(() => expect(screen.getByText('Admin access required')).toBeInTheDocument());

  fireEvent.click(screen.getByRole('button', { name: /Refresh/ }));
  await waitFor(() => expect(screen.getByText('HAPI FHIR')).toBeInTheDocument());
  expect(screen.queryByText('Admin access required')).not.toBeInTheDocument();
});
