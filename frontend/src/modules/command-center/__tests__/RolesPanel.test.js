/**
 * RolesPanel — matrix from the roles endpoint, locked admin cells, override
 * save (only roles that differ), reset, and the system gate.
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('../../sdk', () => ({
  api: { get: vi.fn(), put: vi.fn(), delete: vi.fn() },
  useAuth: vi.fn(),
  refreshTabPolicy: vi.fn(() => Promise.resolve()),
}));

import { api, useAuth } from '../../sdk';
import RolesPanel from '../RolesPanel';

const PERMS = [
  { key: 'read', label: 'Read charts', description: 'View.' },
  { key: 'order:imaging', label: 'Order imaging', description: 'Imaging orders.' },
  { key: 'admin', label: 'Administrator', description: 'Admin.' },
  { key: 'system', label: 'System administrator', description: 'System.' },
];
const roles = (nursePerms = ['read'], overridden = false, source = 'default') => ({
  data: {
    roles: [
      { role: 'admin', permissions: ['read', 'admin', 'system'], default_permissions: ['read', 'admin', 'system'], overridden: false, locked: ['admin', 'system'], users: ['admin'] },
      { role: 'nurse', permissions: nursePerms, default_permissions: ['read'], overridden, locked: [], users: ['nurse'] },
    ],
    permissions: PERMS,
    source,
    updated_by: overridden ? 'demo-admin' : null,
  },
});

beforeEach(() => {
  api.get.mockReset();
  api.put.mockReset();
  api.delete.mockReset();
});

it('renders the matrix with locked admin cells and saves only the changed role as an override', async () => {
  useAuth.mockReturnValue({ user: { permissions: ['admin', 'system'] } });
  api.get.mockResolvedValueOnce(roles()).mockResolvedValueOnce(roles(['read', 'order:imaging'], true, 'database'));
  api.put.mockResolvedValue({ data: {} });

  render(<RolesPanel />);
  await screen.findByLabelText('Read charts for nurse');
  expect(screen.getByLabelText('System administrator for admin')).toBeDisabled();
  expect(screen.getByLabelText('System administrator for admin')).toBeChecked();
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

  fireEvent.click(screen.getByLabelText('Order imaging for nurse'));
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/command-center/settings/auth.roles', { value: { nurse: { permissions: ['read', 'order:imaging'] } } }));
  await waitFor(() => expect(screen.getByText('override')).toBeInTheDocument());
  expect(screen.getByText(/Custom roles by demo-admin/)).toBeInTheDocument();
});

it('saving a draft equal to the defaults deletes the override instead of storing one', async () => {
  useAuth.mockReturnValue({ user: { permissions: ['admin', 'system'] } });
  api.get.mockResolvedValueOnce(roles(['read', 'order:imaging'], true, 'database')).mockResolvedValueOnce(roles());
  api.delete.mockResolvedValue({ data: {} });
  render(<RolesPanel />);
  fireEvent.click(await screen.findByLabelText('Order imaging for nurse'));
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/api/command-center/settings/auth.roles'));
  expect(api.put).not.toHaveBeenCalled();
});

it('is read-only without system and shows backend errors', async () => {
  useAuth.mockReturnValue({ user: { permissions: ['admin'] } });
  api.get.mockResolvedValue(roles());
  render(<RolesPanel />);
  expect(await screen.findByText(/needs the/)).toBeInTheDocument();
  expect(screen.getByLabelText('Read charts for nurse')).toBeDisabled();
  expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
});
