/**
 * JobsPanel — form from param_schema, start, polling to completion, cancel,
 * and the system-permission gate. Backend mocked at the SDK boundary.
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('../../sdk', () => ({
  api: { get: vi.fn(), post: vi.fn() },
  useAuth: vi.fn(),
}));

import { api, useAuth } from '../../sdk';
import JobsPanel from '../JobsPanel';

const KINDS = [
  {
    key: 'synthea_load',
    label: 'Load Synthea patients',
    description: 'Generate patients.',
    notes: '',
    adds_patients: true,
    required_settings: [],
    param_schema: {
      count: { type: 'int', label: 'Patients to add', default: 10, min: 1, max: 1000 },
      state: { type: 'enum', label: 'US state', default: 'Massachusetts', options: ['Massachusetts', 'Ohio'] },
    },
  },
  {
    key: 'terminology_load',
    label: 'Load terminology (UMLS)',
    description: 'Download UMLS.',
    notes: 'Needs the UMLS API key setting.',
    adds_patients: false,
    required_settings: ['system.umls_api_key'],
    param_schema: {
      skip_download: { type: 'bool', label: 'Reuse an already downloaded MRCONSO', default: false },
    },
  },
];

const SETTINGS = [{ key: 'system.umls_api_key', label: 'UMLS API key', is_set: false }];

const job = (overrides) => ({
  id: 'job1',
  kind: 'synthea_load',
  params: { count: 2, state: 'Ohio' },
  status: 'running',
  progress: 0.3,
  message: 'Loading 4 bundles',
  started_by: 'demo-admin',
  created_at: '2026-11-20T15:00:00Z',
  started_at: '2026-11-20T15:00:01Z',
  finished_at: null,
  cancel_requested: false,
  exit_code: null,
  worker: 'w:1',
  ...overrides,
});

/** Route api.get by URL with per-call sequences for jobs and log. */
function mockBackend({ jobSequence = [[]], logSequence = [] }) {
  let jobsCall = 0;
  let logCall = 0;
  api.get.mockImplementation((url, config) => {
    if (url.endsWith('/jobs/kinds')) return Promise.resolve({ data: KINDS });
    if (url.endsWith('/settings')) return Promise.resolve({ data: SETTINGS });
    if (url.endsWith('/jobs')) {
      const data = jobSequence[Math.min(jobsCall, jobSequence.length - 1)];
      jobsCall += 1;
      return Promise.resolve({ data });
    }
    if (url.includes('/log')) {
      const chunk = logSequence[Math.min(logCall, Math.max(logSequence.length - 1, 0))] || {
        text: '', next_offset: config?.params?.offset || 0, finished: true,
      };
      logCall += 1;
      return Promise.resolve({ data: { job_id: 'job1', offset: config?.params?.offset || 0, ...chunk } });
    }
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });
}

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
});

it('builds the form from the schema and starts a job with the typed params', async () => {
  useAuth.mockReturnValue({ user: { permissions: ['admin', 'system'] } });
  mockBackend({ jobSequence: [[], [job({ status: 'succeeded', progress: 1, finished_at: '2026-11-20T15:01:00Z' })]] });
  api.post.mockResolvedValue({ data: job({ status: 'queued' }) });

  render(<JobsPanel pollMs={20} />);
  await waitFor(() => expect(screen.getByLabelText('Patients to add')).toBeInTheDocument());
  expect(screen.getByText('No jobs have run on this deployment yet.')).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Patients to add'), { target: { value: '2' } });
  fireEvent.click(screen.getByRole('button', { name: 'Start' }));

  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith('/api/command-center/jobs', {
      kind: 'synthea_load',
      params: { count: '2', state: 'Massachusetts' },
    }),
  );
  await waitFor(() => expect(screen.getAllByText('succeeded').length).toBeGreaterThan(0));
  expect(screen.getByText('History')).toBeInTheDocument();
});

it('polls a running job to completion and tails its log incrementally', async () => {
  useAuth.mockReturnValue({ user: { permissions: ['admin', 'system'] } });
  mockBackend({
    jobSequence: [
      [job({ status: 'running', progress: 0.3 })],
      [job({ status: 'running', progress: 0.8, message: 'Loaded 3/4 bundles' })],
      [job({ status: 'succeeded', progress: 1, message: 'Complete', finished_at: '2026-11-20T15:01:00Z' })],
    ],
    logSequence: [
      { text: '$ python pipeline\n', next_offset: 18, finished: false },
      { text: 'Found 4 bundle files\n', next_offset: 39, finished: false },
      { text: '[exit 0]\n', next_offset: 48, finished: true },
    ],
  });

  render(<JobsPanel pollMs={20} />);
  await waitFor(() => expect(screen.getByText(/Loading 4 bundles|Loaded 3\/4|Complete/)).toBeInTheDocument());
  expect(screen.getByRole('button', { name: 'A job is already running' })).toBeDisabled();

  await waitFor(() => expect(screen.getAllByText('succeeded').length).toBeGreaterThan(0), { timeout: 3000 });
  const logBox = screen.getByTestId('job-log');
  await waitFor(() => expect(logBox.textContent).toContain('[exit 0]'));
  expect(logBox.textContent).toContain('$ python pipeline');
  expect(logBox.textContent).toContain('Found 4 bundle files');

  // Offsets advance: the second log call asked for the first chunk's next_offset.
  const logCalls = api.get.mock.calls.filter(([url]) => url.includes('/log'));
  expect(logCalls[1][1].params.offset).toBe(18);
});

it('lets a system user cancel the running job', async () => {
  useAuth.mockReturnValue({ user: { permissions: ['admin', 'system'] } });
  mockBackend({ jobSequence: [[job({ status: 'running' })], [job({ status: 'running', cancel_requested: true, message: 'Cancel requested' })]] });
  api.post.mockResolvedValue({ data: job({ cancel_requested: true }) });

  render(<JobsPanel pollMs={1000} />);
  const cancelButton = await screen.findByRole('button', { name: 'Cancel' });
  fireEvent.click(cancelButton);
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/command-center/jobs/job1/cancel'));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Cancelling…' })).toBeDisabled());
});

it('admins without the system permission can watch but not start, and see the missing-setting warning', async () => {
  useAuth.mockReturnValue({ user: { permissions: ['admin'] } });
  mockBackend({ jobSequence: [[job({ status: 'failed', exit_code: 1, message: 'Exited with code 1' })]] });

  render(<JobsPanel pollMs={1000} />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Start' })).toBeDisabled());
  expect(screen.getByText(/needs the/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();

  // Switching to the terminology kind shows its notes and the unset-secret warning.
  // The kind picker is the first Select in the form (MUI renders its trigger as a combobox).
  fireEvent.mouseDown(screen.getAllByRole('combobox')[0]);
  fireEvent.click(await screen.findByRole('option', { name: 'Load terminology (UMLS)' }));
  await waitFor(() => expect(screen.getByText(/UMLS API key to be set first/)).toBeInTheDocument());
  expect(screen.getByText('Needs the UMLS API key setting.')).toBeInTheDocument();
  expect(screen.getByLabelText('Reuse an already downloaded MRCONSO')).toBeInTheDocument();
});

it('shows the backend detail when a start is refused', async () => {
  useAuth.mockReturnValue({ user: { permissions: ['admin', 'system'] } });
  mockBackend({ jobSequence: [[]] });
  api.post.mockRejectedValue({ response: { data: { detail: 'This job would add 10 patients to the 500 loaded, exceeding the patient count cap' } } });

  render(<JobsPanel pollMs={1000} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Start' }));
  await waitFor(() => expect(screen.getByText(/exceeding the patient count cap/)).toBeInTheDocument());
});
