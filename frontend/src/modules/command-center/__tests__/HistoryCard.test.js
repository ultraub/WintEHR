/**
 * HistoryCard — strip of samples with tooltips, legend, uptime table, incidents,
 * window selection, empty and error states.
 */

import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('../../sdk', () => ({
  api: { get: vi.fn() },
}));

import { api } from '../../sdk';
import HistoryCard, { describeSample } from '../HistoryCard';

const HISTORY = {
  hours: 24, since: '2026-11-20T10:00:00Z', sample_seconds: 300, retention_days: 7, overall_uptime: 66.7,
  samples: [
    { t: '2026-11-21T10:00:00Z', overall: 'ok', components: { fhir: 'ok', redis: 'ok' }, source: 'sampler' },
    { t: '2026-11-21T10:05:00Z', overall: 'degraded', components: { fhir: 'ok', redis: 'down' }, source: 'sampler' },
    { t: '2026-11-21T10:10:00Z', overall: 'ok', components: { fhir: 'ok', redis: 'ok' }, source: 'request' },
  ],
  uptime: { fhir: 100, redis: 66.7 },
  incidents: [{ component: 'redis', status: 'down', first_seen: '2026-11-21T10:05:00Z', last_seen: '2026-11-21T10:05:00Z', samples: 1, ongoing: false }],
};

beforeEach(() => {
  api.get.mockReset();
});

it('describes a sample with its unhealthy components', () => {
  expect(describeSample(HISTORY.samples[1])).toMatch(/degraded \(Redis down\) · sampler$/);
  expect(describeSample(HISTORY.samples[0])).toMatch(/ok · sampler$/);
});

it('renders the strip, uptime and incidents, and reloads on a window change', async () => {
  api.get.mockResolvedValue({ data: HISTORY });
  render(<HistoryCard />);
  const strip = await screen.findByTestId('history-strip');
  expect(within(strip).getAllByRole('generic').filter((el) => el.dataset.state)).toHaveLength(3);
  expect(strip.querySelectorAll('[data-state="degraded"]')).toHaveLength(1);
  expect(screen.getByText('66.7% of samples fully ok')).toBeInTheDocument();
  expect(screen.getByText('3 samples', { exact: false })).toBeInTheDocument();
  const uptime = screen.getByTestId('history-uptime');
  expect(within(uptime).getByText('Redis').closest('tr')).toHaveTextContent('66.7%');
  expect(within(uptime).getByText('HAPI FHIR').closest('tr')).toHaveTextContent('100%');
  const incidents = screen.getByTestId('history-incidents');
  expect(incidents).toHaveTextContent('Redis');
  expect(incidents).toHaveTextContent('1 sample');
  expect(api.get).toHaveBeenCalledWith('/api/command-center/status/history', { params: { hours: 24 } });

  fireEvent.mouseDown(screen.getByRole('combobox'));
  fireEvent.click(await screen.findByRole('option', { name: 'Last 7 days' }));
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/command-center/status/history', { params: { hours: 168 } }));
});

it('explains an empty window and surfaces errors', async () => {
  api.get.mockResolvedValueOnce({ data: { ...HISTORY, samples: [], uptime: {}, incidents: [], overall_uptime: null } });
  const { unmount } = render(<HistoryCard />);
  expect(await screen.findByText(/No samples in this window yet/)).toHaveTextContent('every 5 minutes');
  unmount();
  api.get.mockRejectedValueOnce({ response: { data: { detail: 'Admin access required' } } });
  render(<HistoryCard />);
  expect(await screen.findByText('Admin access required')).toBeInTheDocument();
});
