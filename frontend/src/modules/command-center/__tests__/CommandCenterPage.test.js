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
    { name: 'host', status: 'ok', detail: '45.0 GB of 124.0 GB free (36%)', data: { disk_path: '/repo', disk_free_gb: 45, disk_free_percent: 36.3, cpus: 2 } },
    { name: 'tls', status: 'absent', detail: 'No certificates under certbot/conf/live', data: { domains: '', certificates: 0 } },
  ],
  readiness: [
    { id: 'environment', label: 'Deployment profile', status: 'ok', detail: 'ENVIRONMENT=prod', fix: null },
    { id: 'jwt_secret', label: 'JWT signing key', status: 'fail', detail: 'JWT_SECRET_KEY is the example value', fix: 'openssl rand -hex 32 → JWT_SECRET_KEY in .env' },
    { id: 'terminology', label: 'Terminology index', status: 'warn', detail: 'Catalog search falls back to short static lists', fix: 'Jobs → Terminology load' },
    { id: 'auth_mode', label: 'Authentication', status: 'info', detail: 'Training mode', fix: 'JWT_ENABLED=true' },
    { id: 'tls', label: 'HTTPS', status: 'skip', detail: 'Dev profile serves plain HTTP on purpose', fix: null },
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
  expect(screen.getAllByText('Terminology index')[0]).toBeInTheDocument();
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

it('renders the readiness checklist with a to-fix count, fixes for non-ok items, and no skipped rows', async () => {
  admin();
  api.get.mockResolvedValue({ data: REPORT });
  render(<CommandCenterPage />);
  await waitFor(() => expect(screen.getByTestId('readiness')).toBeInTheDocument());
  const card = screen.getByTestId('readiness');
  expect(card.textContent).toContain('1 to fix');
  expect(card.textContent).toContain('JWT signing key');
  expect(card.textContent).toContain('Fix: openssl rand -hex 32');
  expect(card.textContent).toContain('Fix: Jobs → Terminology load');
  expect(card.textContent).not.toContain('plain HTTP on purpose');
  expect(card.textContent).not.toContain('Fix: ./deploy.sh'); // ok items carry no fix line
  // host and tls components render as ordinary cards with readable labels; paths are not listed as facts
  expect(screen.getByText('Host')).toBeInTheDocument();
  expect(screen.getByText('HTTPS certificate')).toBeInTheDocument();
  expect(screen.getByText(/disk free gb/)).toBeInTheDocument();
  expect(screen.queryByText(/disk path/)).not.toBeInTheDocument();
});
