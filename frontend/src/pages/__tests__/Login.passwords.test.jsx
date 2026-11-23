/**
 * Login page and passwords: one-click demo logins by default, a password
 * field for a user who has one, and username + password with no user list
 * when the environment requires passwords.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '../../test-utils/test-utils';

const { login, navigate } = vi.hoisted(() => ({ login: vi.fn(), navigate: vi.fn() }));
vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('../../contexts/AuthContext', async () => ({
  ...(await vi.importActual('../../contexts/AuthContext')),
  useAuth: () => ({ user: null, login }),
}));
vi.mock('react-router-dom', async () => ({ ...(await vi.importActual('react-router-dom')), useNavigate: () => navigate }));

import api from '../../services/api';
import Login from '../Login';

const config = (data) => api.get.mockResolvedValue({ data: { mode: 'training', jwt_enabled: false, ...data } });
const pick = async (name) => {
  fireEvent.mouseDown(await screen.findByLabelText('Select Provider'));
  fireEvent.click(within(await screen.findByRole('listbox')).getByText(name));
};
const USERS = [
  { username: 'demo', name: 'Dr. Demo Physician', role: 'physician', password_required: false },
  { username: 'admin', name: 'System Administrator', role: 'admin', password_required: true },
];

beforeEach(() => {
  login.mockReset().mockResolvedValue({});
  navigate.mockReset();
});

it('a user on the shared training password logs in with one click and no password field', async () => {
  config({ available_users: ['demo', 'admin'], users: USERS });
  render(<Login />);
  await pick('Dr. Demo Physician');
  expect(screen.queryByLabelText('Password')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
  await waitFor(() => expect(login).toHaveBeenCalledWith('demo'));
});

it('a user with their own password must type it', async () => {
  config({ available_users: ['demo', 'admin'], users: USERS });
  render(<Login />);
  await pick('System Administrator');
  const button = screen.getByRole('button', { name: /sign in/i });
  expect(button).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'from-the-server' } });
  fireEvent.click(button);
  await waitFor(() => expect(login).toHaveBeenCalledWith('admin', 'from-the-server'));
});

it('when passwords are required it asks for a username and password and lists nobody', async () => {
  config({ available_users: [], users: [], require_passwords: true });
  render(<Login />);
  fireEvent.change(await screen.findByLabelText('Username'), { target: { value: 'jsmith' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 's3cret' } });
  fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
  await waitFor(() => expect(login).toHaveBeenCalledWith('jsmith', 's3cret'));
  expect(screen.queryByText('Dr. Demo Physician')).toBeNull();
});
