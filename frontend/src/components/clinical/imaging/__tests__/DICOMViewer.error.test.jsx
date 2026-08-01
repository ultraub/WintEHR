/**
 * DICOMViewer failure-state tests (the open half of B17,
 * docs/ARCHITECTURE_DEBT.md).
 *
 * The viewer's loading/error branches used to return bare in-flow elements
 * while only the success branch rendered the fixed full-screen overlay — a
 * metadata fetch failure painted an Alert somewhere off-viewport and the
 * click looked like a no-op. That invisibility is exactly how the B17
 * DICOMweb URL bug survived in production. These tests pin the contract:
 * a failure is VISIBLE (overlay + alertdialog), names the server's reason,
 * and offers Try again / Close.
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '../../../../test-utils/test-utils';
import DICOMViewer from '../DICOMViewer';
import { apiClient } from '../../../../services/api';

vi.mock('../../../../services/api', () => ({
  __esModule: true,
  apiClient: { get: vi.fn() },
}));

const STUDY = { id: 'study-1', studyDirectory: 'urn:oid:1.2.3.4' };

const reject = (status, detail) =>
  Promise.reject({ response: { status, data: { detail } }, message: `HTTP ${status}` });

beforeEach(() => {
  vi.clearAllMocks();
});

test('a metadata failure renders a visible alertdialog with the server detail', async () => {
  apiClient.get.mockImplementation(() => reject(503, 'DICOM server unavailable: arc is down'));

  render(<DICOMViewer study={STUDY} onClose={() => {}} />);

  const dialog = await screen.findByRole('alertdialog', { name: /dicom viewer error/i });
  expect(dialog).toBeInTheDocument();
  expect(screen.getByText(/could not load this study/i)).toBeInTheDocument();
  // The server's own reason is the teaching content — it must surface.
  expect(screen.getByText(/arc is down/i)).toBeInTheDocument();
});

test('404 keeps its friendlier no-imaging-data message', async () => {
  apiClient.get.mockImplementation(() => reject(404, 'Not Found'));

  render(<DICOMViewer study={STUDY} onClose={() => {}} />);

  expect(await screen.findByText(/may not have imaging data available/i)).toBeInTheDocument();
});

test('Close dismisses via onClose; Try again refetches', async () => {
  apiClient.get.mockImplementation(() => reject(503, 'down'));
  const onClose = vi.fn();

  render(<DICOMViewer study={STUDY} onClose={onClose} />);
  await screen.findByRole('alertdialog');

  const callsBeforeRetry = apiClient.get.mock.calls.length;
  fireEvent.click(screen.getByRole('button', { name: /try again/i }));
  await waitFor(() => {
    expect(apiClient.get.mock.calls.length).toBeGreaterThan(callsBeforeRetry);
  });

  fireEvent.click(screen.getByRole('button', { name: /^close$/i }));
  expect(onClose).toHaveBeenCalled();
});
