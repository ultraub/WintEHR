import axios from 'axios';

// Use relative URL to work with proxy in development and direct routing in production
import { getBackendUrl } from '../config/apiConfig';
import { AUTH_UNAUTHORIZED_EVENT } from '../constants/authEvents';

const API_BASE_URL = getBackendUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

let sessionProbe = null;

/**
 * A 401 from one endpoint does not prove the session is dead (it can be a
 * permission or wiring problem on that endpoint alone). Ask /api/auth/me
 * before logging the user out. Concurrent 401s share one probe. Uses bare
 * axios so the probe's own 401 does not re-enter this interceptor.
 */
const isSessionDead = (token) => {
  if (!sessionProbe) {
    sessionProbe = axios
      .get(`${API_BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then(() => false)
      .catch((err) => err.response?.status === 401)
      .finally(() => {
        sessionProbe = null;
      });
  }
  return sessionProbe;
};

const endSession = () => {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('auth_user');
  window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT));
};

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    if (error.response?.status === 401) {
      const url = error.config?.url || '';
      const token = localStorage.getItem('auth_token');
      if (url.includes('/api/auth/login')) {
        // Wrong credentials: the login form shows the error itself.
      } else if (!token || url.includes('/api/auth/me')) {
        endSession();
      } else if (await isSessionDead(token)) {
        endSession();
      }
    }
    return Promise.reject(error);
  }
);

export default api;
export { api as apiClient };