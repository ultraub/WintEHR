/**
 * LogsPanel — filters drive the query, lines render with level chips and
 * tracebacks intact, auto-refresh polls, export downloads, admin gate.
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('../../sdk', () => ({
  api: { get: vi.fn() },
  useAuth: vi.fn(),
}));

import { api, useAuth } from '../../sdk';
import LogsPanel from '../LogsPanel';

const LINES = {
  lines: [
    { ts: '2026-11-20T17:00:00.000Z', level: 'INFO', pid: 11, logger: 'api.auth.session_store', message: 'using Redis', file: 'backend.11.log' },
    { ts: '2026-11-20T17:00:02.000Z', level: 'ERROR', pid: 12, logger: 'api.fhir.proxy', message: 'Timeout proxying\nTraceback (most recent call last):\nhttpx.ReadTimeout', file: 'backend.12.log' },
  ],
  total: 2, files: 2, levels: ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'], truncated: false,
};

beforeEach(() => {
  api.get.mockReset();
  URL.createObjectURL = vi.fn(() => 'blob:x');
  URL.revokeObjectURL = vi.fn();
});

it('loads with the default filters and renders lines with their worker, level and traceback', async () => {
  useAuth.mockReturnValue({ user: { permissions: ['admin'] } });
  api.get.mockResolvedValue({ data: LINES });
  render(<LogsPanel />);
  await waitFor(() => expect(screen.getByText('using Redis')).toBeInTheDocument());
  const [url, config] = api.get.mock.calls[0];
  expect(url).toBe('/api/command-center/logs');
  expect(config.params.level).toBe('INFO');
  expect(config.params.since).toMatch(/T/);
  expect(screen.getByText('ERROR')).toBeInTheDocument();
  expect(screen.getByText(/w12 api\.fhir\.proxy/)).toBeInTheDocument();
  expect(screen.getByTestId('log-lines').textContent).toContain('httpx.ReadTimeout');
  expect(screen.getByText(/2 of 2 matching lines from 2 files/)).toBeInTheDocument();
});

it('changing the level and text filter re-queries, and auto-refresh polls', async () => {
  useAuth.mockReturnValue({ user: { permissions: ['admin'] } });
  api.get.mockResolvedValue({ data: LINES });
  render(<LogsPanel pollMs={30} />);
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));
  fireEvent.change(screen.getByLabelText('Contains'), { target: { value: 'proxy' } });
  await waitFor(() => expect(api.get.mock.calls.at(-1)[1].params.q).toBe('proxy'));
  fireEvent.click(screen.getByLabelText('Auto-refresh'));
  const before = api.get.mock.calls.length;
  await waitFor(() => expect(api.get.mock.calls.length).toBeGreaterThan(before + 1));
});

it('exports the current window as a download', async () => {
  useAuth.mockReturnValue({ user: { permissions: ['admin'] } });
  api.get.mockImplementation((url) => {
    if (url.endsWith('/export')) return Promise.resolve({ data: new Blob(['x']), headers: { 'content-disposition': 'attachment; filename="wintehr-backend-logs-a-b.txt"' } });
    return Promise.resolve({ data: LINES });
  });
  render(<LogsPanel />);
  await screen.findByText('using Redis');
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  fireEvent.click(screen.getByRole('button', { name: 'Export window' }));
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/command-center/logs/export', expect.objectContaining({ responseType: 'blob' })));
  await waitFor(() => expect(click).toHaveBeenCalled());
  click.mockRestore();
});

it('needs the admin permission', () => {
  useAuth.mockReturnValue({ user: { permissions: ['read'] } });
  render(<LogsPanel />);
  expect(screen.getByText(/needs the/)).toBeInTheDocument();
  expect(api.get).not.toHaveBeenCalled();
});
