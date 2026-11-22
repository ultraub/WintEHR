/**
 * Fired on `window` by the api layer (services/api.js) once the backend has
 * confirmed the session is no longer valid. AuthContext listens and clears the
 * user, which lets ProtectedRoute send the browser to /login through the
 * router (no full page reload).
 *
 * Lives here, not in services/api.js, so tests that mock the api module do
 * not also have to re-export it.
 */
export const AUTH_UNAUTHORIZED_EVENT = 'wintehr:auth-unauthorized';
