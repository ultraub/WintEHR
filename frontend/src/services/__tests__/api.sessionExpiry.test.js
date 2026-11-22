/**
 * The 401 handler must only end the session when the backend confirms the
 * session itself is dead. It used to wipe the token and hard-redirect on any
 * 401, so a single misbehaving endpoint logged the user out.
 */
import axios from 'axios';
import api from '../api';
import { AUTH_UNAUTHORIZED_EVENT } from '../../constants/authEvents';

const reject401 = (url) => () =>
  Promise.reject({ config: { url }, response: { status: 401 } });

describe('api 401 handling', () => {
  let onUnauthorized;
  let probe;

  beforeEach(() => {
    localStorage.setItem('auth_token', 'tok');
    localStorage.setItem('auth_user', '{"id":"u"}');
    onUnauthorized = vi.fn();
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, onUnauthorized);
    probe = vi.spyOn(axios, 'get');
  });

  afterEach(() => {
    window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, onUnauthorized);
    probe.mockRestore();
    localStorage.clear();
  });

  test('a 401 from one endpoint keeps the session when /auth/me still accepts the token', async () => {
    probe.mockResolvedValue({ status: 200, data: {} });
    await expect(api.get('/api/quality/x', { adapter: reject401('/api/quality/x') })).rejects.toBeTruthy();
    expect(probe).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('auth_token')).toBe('tok');
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  test('ends the session when /auth/me also rejects the token', async () => {
    probe.mockRejectedValue({ response: { status: 401 } });
    await expect(api.get('/api/quality/x', { adapter: reject401('/api/quality/x') })).rejects.toBeTruthy();
    expect(localStorage.getItem('auth_token')).toBeNull();
    expect(localStorage.getItem('auth_user')).toBeNull();
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  test('a backend outage during the probe does not end the session', async () => {
    probe.mockRejectedValue(new Error('Network Error'));
    await expect(api.get('/api/quality/x', { adapter: reject401('/api/quality/x') })).rejects.toBeTruthy();
    expect(localStorage.getItem('auth_token')).toBe('tok');
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  test('a failed login is left to the login form', async () => {
    await expect(api.post('/api/auth/login', {}, { adapter: reject401('/api/auth/login') })).rejects.toBeTruthy();
    expect(probe).not.toHaveBeenCalled();
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});
