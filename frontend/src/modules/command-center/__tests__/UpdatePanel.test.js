/**
 * UpdatePanel — check, preview (commits / areas / blockers), confirmed apply,
 * polling that tolerates the backend restarting, finished states, system gate.
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('../../sdk', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}));

import { api } from '../../sdk';
import UpdatePanel, { progressOf } from '../UpdatePanel';

const A = 'a'.repeat(40);
const B = 'b'.repeat(40);
const PREVIEW = (overrides = {}) => ({
  branch: 'master', local: A, remote: B, update_available: true, fast_forward: true, error: null,
  commits: [{ sha: B, author: 'Robert', date: '2026-11-21T10:00:00Z', subject: 'feat: thing' }, { sha: 'c'.repeat(40), author: 'Robert', date: '2026-11-20T10:00:00Z', subject: 'fix: other' }],
  files: 3, areas: { backend: 2, frontend: 1 }, insertions: 40, deletions: 5, dirty: [],
  profile: 'prod', services: ['backend-prod', 'frontend-prod', 'control-plane'], blockers: [], can_apply: true,
  updater: { present: false, running: false },
  ...overrides,
});

const idle = { present: false, running: false };

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
});

it('parses STEP lines into progress', () => {
  expect(progressOf('STEP 1/4: fetch')).toBe(0);
  expect(progressOf('STEP 3/4: build')).toBe(50);
  expect(progressOf('DONE')).toBeNull();
  expect(progressOf(undefined)).toBeNull();
});

it('previews the change and applies after confirmation, then polls to completion', async () => {
  let phase = 'idle';
  const STATUS = {
    idle: () => Promise.resolve({ data: idle }),
    down: () => Promise.reject(new Error('Network Error')),                 // backend recreated
    building: () => Promise.resolve({ data: { present: true, running: true, commit: B, lines: ['STEP 3/4: build images'], message: 'STEP 3/4: build images' } }),
    done: () => Promise.resolve({ data: { present: true, running: false, exit_code: 0, succeeded: true, commit: B, lines: ['DONE: now at bbbbbbbb'], message: 'DONE: now at bbbbbbbb' } }),
  };
  api.get.mockImplementation((url) => {
    if (url.endsWith('/update/preview')) return Promise.resolve({ data: PREVIEW() });
    if (url.endsWith('/update/status')) return STATUS[phase]();
    return Promise.reject(new Error(`unexpected ${url}`));
  });
  api.post.mockResolvedValue({ data: { accepted: true, updater: 'id', from: A, to: B } });

  render(<UpdatePanel canAct pollMs={20} />);
  fireEvent.click(screen.getByRole('button', { name: 'Preview update' }));
  const preview = await screen.findByTestId('update-preview');
  expect(preview).toHaveTextContent('2 commits, 3 files (+40 −5)');
  expect(preview).toHaveTextContent('backend: 2');
  expect(preview).toHaveTextContent('feat: thing');
  expect(preview).toHaveTextContent('Rebuilds backend-prod, frontend-prod, control-plane (profile prod)');

  fireEvent.click(screen.getByRole('button', { name: 'Apply update' }));
  expect(await screen.findByText('Apply update?')).toBeInTheDocument();
  expect(screen.getByText(/no automatic rollback/)).toBeInTheDocument();
  phase = 'down';
  fireEvent.click(screen.getAllByRole('button', { name: 'Apply update' }).pop());
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/command-center/control/update/apply', { commit: B }));

  const status = await screen.findByTestId('update-status');
  expect(status).toHaveTextContent('Updating');
  await waitFor(() => expect(screen.getByText(/Backend restarting/)).toBeInTheDocument());
  phase = 'building';
  await waitFor(() => expect(screen.getAllByText('STEP 3/4: build images').length).toBeGreaterThan(0));
  expect(screen.queryByText(/Backend restarting/)).not.toBeInTheDocument();
  phase = 'done';
  await waitFor(() => expect(screen.getByText('Update complete')).toBeInTheDocument());
  expect(screen.getByText('succeeded')).toBeInTheDocument();
  expect(screen.getByText('Reload to use the new build')).toBeInTheDocument(); // role query would miss it: the closed dialog's exit transition still aria-hides the page in jsdom
  expect(screen.queryByTestId('update-preview')).not.toBeInTheDocument();
});

it('shows blockers and keeps apply disabled, and gates apply on the system permission', async () => {
  api.get.mockImplementation((url) => {
    if (url.endsWith('/update/preview')) return Promise.resolve({ data: PREVIEW({ fast_forward: false, can_apply: false, blockers: ['the host checkout has commits origin does not; resolve on the host'], dirty: ['deploy.sh'] }) });
    return Promise.resolve({ data: idle });
  });
  render(<UpdatePanel canAct />);
  fireEvent.click(screen.getByRole('button', { name: 'Preview update' }));
  expect(await screen.findByTestId('update-blockers')).toHaveTextContent('commits origin does not');
  expect(screen.getByText(/Locally modified on the host: deploy.sh/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Apply update' })).toBeDisabled();

  api.get.mockImplementation((url) => (url.endsWith('/update/preview') ? Promise.resolve({ data: PREVIEW() }) : Promise.resolve({ data: idle })));
  const { unmount } = render(<UpdatePanel canAct={false} />);
  fireEvent.click(screen.getAllByRole('button', { name: 'Preview update' }).pop());
  await waitFor(() => expect(screen.getAllByTestId('update-preview').length).toBe(2));
  expect(screen.getAllByRole('button', { name: 'Apply update' }).pop()).toBeDisabled();
  unmount();
});

it('resumes the view of a running or failed update on mount and surfaces a refused apply', async () => {
  api.get.mockResolvedValue({ data: { present: true, running: false, exit_code: 3, succeeded: false, commit: B, lines: ['✗ origin/master moved'], message: '✗ origin/master moved' } });
  render(<UpdatePanel canAct />);
  expect(await screen.findByText('Update failed')).toBeInTheDocument();
  expect(screen.getByText('exit 3')).toBeInTheDocument();
  expect(screen.getByText(/did not complete/)).toBeInTheDocument();

  api.get.mockImplementation((url) => (url.endsWith('/update/preview') ? Promise.resolve({ data: PREVIEW() }) : Promise.resolve({ data: idle })));
  api.post.mockRejectedValue({ response: { data: { detail: 'Control plane: an update is already running' } } });
  fireEvent.click(screen.getByRole('button', { name: 'Preview update' }));
  await screen.findByTestId('update-preview');
  fireEvent.click(screen.getByRole('button', { name: 'Apply update' }));
  fireEvent.click(screen.getAllByRole('button', { name: 'Apply update' }).pop());
  expect(await screen.findByText(/already running/)).toBeInTheDocument();
});

it('still runs the quick check', async () => {
  api.get.mockImplementation((url) => (url.endsWith('/update-check') ? Promise.resolve({ data: { branch: 'master', local: A, remote: B, update_available: true, error: null } }) : Promise.resolve({ data: idle })));
  render(<UpdatePanel canAct />);
  fireEvent.click(screen.getByRole('button', { name: 'Check for updates' }));
  expect(await screen.findByText(/Update available/)).toBeInTheDocument();
});
