/**
 * Tests for TaskPane — the MAR non-medication recording pane (#116 Phase 5.2).
 *
 * Mocks the `/tasks` fetch and confirms the pane renders pending vs.
 * fulfilled task cards and opens the matching recording dialog on click.
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '../../../../../test-utils/test-utils';
import TaskPane from '../TaskPane';
import api from '../../../../../services/api';

jest.mock('../../../../../services/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

const tasksPayload = {
  patient_id: 'p1',
  immunizations: [{
    service_request_id: 'sr-imm',
    task_type: 'immunization',
    code_display: 'Influenza vaccine',
    ordered_datetime: '2026-05-10T08:00:00Z',
    priority: 'routine',
    fulfilled: false,
  }],
  specimens: [],
  procedures: [{
    service_request_id: 'sr-proc',
    task_type: 'procedure',
    code_display: 'Appendectomy',
    ordered_datetime: '2026-05-09T08:00:00Z',
    priority: 'routine',
    fulfilled: true,
    fulfillment_id: 'proc-9',
  }],
};

beforeEach(() => {
  api.get.mockResolvedValue({ data: tasksPayload });
});

afterEach(() => {
  jest.resetAllMocks();
});

test('renders pending and fulfilled task cards', async () => {
  render(<TaskPane patientId="p1" />);
  await waitFor(() => expect(screen.getByText('Influenza vaccine')).toBeInTheDocument());
  // One pending task across all sections (the procedure is fulfilled).
  expect(screen.getByText('1 pending')).toBeInTheDocument();
  // Fulfilled procedure still renders (muted).
  expect(screen.getByText('Appendectomy')).toBeInTheDocument();
});

test('clicking a pending task card opens its recording dialog', async () => {
  render(<TaskPane patientId="p1" />);
  await waitFor(() => expect(screen.getByText('Influenza vaccine')).toBeInTheDocument());
  fireEvent.click(screen.getByText('Influenza vaccine'));
  await waitFor(() => expect(screen.getByText('Record immunization')).toBeInTheDocument());
});
