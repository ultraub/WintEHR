/**
 * UsersPanel — list with sources, add user dialog (validation, create), edit with
 * password reset, disable toggle rules, delete after confirmation, system gate.
 */

import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('../../sdk', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  useAuth: vi.fn(),
}));

import { api, useAuth } from '../../sdk';
import UsersPanel from '../UsersPanel';

const u = (overrides) => ({
  username: 'demo', id: 'demo-physician', name: 'Dr. Demo Physician', email: 'demo@wintehr.example.com', role: 'physician',
  department: 'General Practice', permissions: ['read', 'write'], permissions_explicit: false, source: 'builtin', disabled: false, protected: false,
  ...overrides,
});
const USERS = [
  u(),
  u({ username: 'nurse', id: 'demo-nurse', name: 'RN Demo Nurse', role: 'nurse', permissions: ['read'] }),
  u({ username: 'admin', id: 'demo-admin', name: 'Dr. Demo Administrator', role: 'admin', permissions: ['read', 'admin', 'system'], protected: true }),
  u({ username: 'jsmith', id: 'user-jsmith', name: 'Jane Smith', role: 'nurse', department: 'ICU', permissions: ['read'], source: 'custom', disabled: true }),
];

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.put.mockReset();
  api.delete.mockReset();
  api.get.mockResolvedValue({ data: USERS });
});

it('lists users with their source and the enable rules, and creates a custom user', async () => {
  useAuth.mockReturnValue({ user: { username: 'admin', permissions: ['admin', 'system'] } });
  api.post.mockResolvedValue({ data: u({ username: 'rlee', id: 'user-rlee', name: 'Ray Lee', role: 'pharmacist', source: 'custom', permissions: ['read', 'pharmacy:dispense'] }) });
  render(<UsersPanel />);
  const admin = await screen.findByTestId('user-admin');
  expect(admin).toHaveTextContent('admin (you)');
  expect(within(admin).getByLabelText('admin enabled')).toBeDisabled();            // protected and self
  expect(within(screen.getByTestId('user-nurse')).getByLabelText('nurse enabled')).toBeEnabled();
  const jsmith = screen.getByTestId('user-jsmith');
  expect(within(jsmith).getByLabelText('jsmith enabled')).not.toBeChecked();
  expect(within(jsmith).getByRole('button', { name: 'Edit jsmith' })).toBeInTheDocument();
  expect(within(screen.getByTestId('user-demo')).queryByRole('button', { name: /Edit/ })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Add user' }));
  const create = await screen.findByRole('button', { name: 'Create' });
  expect(create).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'rlee' } });
  fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'Ray Lee' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'hunter22' } });
  fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'hunter2' } });
  expect(create).toBeDisabled();                                                    // mismatch
  fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'hunter22' } });
  expect(create).toBeEnabled();
  fireEvent.click(create);
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/command-center/users', { username: 'rlee', name: 'Ray Lee', role: 'physician', password: 'hunter22' }));
  expect(await screen.findByText('rlee created.')).toBeInTheDocument();
  expect(screen.getByTestId('user-rlee')).toHaveTextContent('custom');
});

it('edits a custom user with an optional password reset, toggles enabled, and deletes after confirmation', async () => {
  useAuth.mockReturnValue({ user: { username: 'admin', permissions: ['admin', 'system'] } });
  api.put.mockImplementation((_url, body) => Promise.resolve({ data: u({ ...USERS[3], ...body, disabled: body.disabled ?? USERS[3].disabled }) }));
  api.delete.mockResolvedValue({});
  render(<UsersPanel />);
  const jsmith = await screen.findByTestId('user-jsmith');
  fireEvent.click(within(jsmith).getByRole('button', { name: 'Edit jsmith' }));
  expect(await screen.findByText('Edit jsmith')).toBeInTheDocument();
  expect(screen.getByLabelText('Username')).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Department'), { target: { value: 'ED' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/command-center/users/jsmith', { name: 'Jane Smith', role: 'nurse', department: 'ED', email: 'demo@wintehr.example.com' }));
  expect(await screen.findByText('jsmith updated.')).toBeInTheDocument();

  fireEvent.click(within(screen.getByTestId('user-jsmith')).getByLabelText('jsmith enabled'));
  await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/command-center/users/jsmith', { disabled: false }));
  expect(await screen.findByText('jsmith enabled.')).toBeInTheDocument();

  fireEvent.click(within(screen.getByTestId('user-jsmith')).getByText('Delete'));
  expect(await screen.findByText('Delete jsmith?')).toBeInTheDocument();
  fireEvent.click(screen.getAllByText('Delete').pop());
  await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/api/command-center/users/jsmith'));
  await waitFor(() => expect(screen.queryByTestId('user-jsmith')).not.toBeInTheDocument());
  expect(screen.getByText('jsmith deleted.')).toBeInTheDocument();
});

it('is read-only without the system permission and surfaces backend refusals', async () => {
  useAuth.mockReturnValue({ user: { username: 'demo', permissions: ['admin'] } });
  render(<UsersPanel />);
  await screen.findByTestId('user-nurse');
  expect(screen.getByText(/needs the/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Add user' })).not.toBeInTheDocument();
  expect(within(screen.getByTestId('user-nurse')).getByLabelText('nurse enabled')).toBeDisabled();
  expect(within(screen.getByTestId('user-jsmith')).getByRole('button', { name: 'Edit jsmith' })).toBeDisabled();

  useAuth.mockReturnValue({ user: { username: 'admin', permissions: ['admin', 'system'] } });
  api.put.mockRejectedValue({ response: { data: { detail: "'nurse' is built in; only disabled can change here" } } });
  render(<UsersPanel />);
  await waitFor(() => expect(screen.getAllByTestId('user-nurse')).toHaveLength(2));
  fireEvent.click(within(screen.getAllByTestId('user-nurse')[1]).getByLabelText('nurse enabled'));
  expect(await screen.findByText(/only disabled can change here/)).toBeInTheDocument();
});
