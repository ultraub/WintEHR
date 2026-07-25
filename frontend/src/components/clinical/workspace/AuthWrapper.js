/**
 * Auth Wrapper
 *
 * Historically this used try/require/catch to fall back to a
 * `../MockAuthProvider` in "demo mode" — but that module does not exist, so
 * the catch branch could never succeed. Under webpack the `require` resolved
 * and the fallback was simply dead; under Vite/ESM a bare `require` is a
 * runtime ReferenceError. Re-export the real hook directly.
 */
export { useAuth } from '../../../contexts/AuthContext';
