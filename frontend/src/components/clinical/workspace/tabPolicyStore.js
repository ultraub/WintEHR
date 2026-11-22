/**
 * Process-wide cache of the chart tab policy (`/api/command-center/ui-policy`).
 *
 * One fetch per page load, shared by every consumer of useEffectiveTabs();
 * the Command Center calls refreshTabPolicy() after saving so an open
 * workspace updates without a reload. Until the first response arrives,
 * consumers see the empty policy (every tab visible) and `loaded: false`.
 */

import api from '../../../services/api';
import { EMPTY_TAB_POLICY } from './tabPolicy';

// The workflow context (inpatient, surgical, …) this browser works in. A
// per-viewer convenience: chosen in the tab strip, remembered in
// localStorage, applied as the policy's third layer by every consumer that
// does not pass its own `context`. Unknown or removed contexts fall back to none.
export const CONTEXT_STORAGE_KEY = 'wintehr.workflowContext';

const readStoredContext = () => {
  try {
    return window.localStorage.getItem(CONTEXT_STORAGE_KEY) || null;
  } catch {
    return null;
  }
};

let state = { policy: EMPTY_TAB_POLICY, roles: [], contexts: [], context: readStoredContext(), loaded: false, error: null };
let inflight = null;
const listeners = new Set();

const notify = () => listeners.forEach((cb) => cb());

/** The context in effect: the chosen one only while the policy still defines it. */
export const getActiveContext = () => (state.context && state.contexts.includes(state.context) ? state.context : null);

export function setWorkflowContext(context) {
  const next = context || null;
  state = { ...state, context: next };
  try {
    if (next) window.localStorage.setItem(CONTEXT_STORAGE_KEY, next);
    else window.localStorage.removeItem(CONTEXT_STORAGE_KEY);
  } catch {
    // storage unavailable: the choice lasts for this page only
  }
  notify();
}

export const getTabPolicySnapshot = () => state;

export const subscribeTabPolicy = (cb) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export async function refreshTabPolicy() {
  try {
    const response = await api.get('/api/command-center/ui-policy');
    const data = response.data || {};
    state = {
      policy: data.policy || EMPTY_TAB_POLICY,
      roles: data.roles || [],
      contexts: data.contexts || [],
      context: state.context,
      loaded: true,
      error: null,
    };
  } catch (err) {
    // Keep whatever we had (initially: everything visible). A policy fetch
    // failure must never hide the chart.
    state = { ...state, loaded: true, error: err?.message || 'policy unavailable' };
  }
  notify();
  return state;
}

export function ensureTabPolicyLoaded() {
  if (!state.loaded && !inflight) {
    inflight = refreshTabPolicy().finally(() => {
      inflight = null;
    });
  }
  return inflight || Promise.resolve(state);
}

/** Test helper: seed the store without a network call. */
export function __setTabPolicyForTests(next) {
  state = { policy: EMPTY_TAB_POLICY, roles: [], contexts: [], context: null, loaded: true, error: null, ...next };
  inflight = null;
  notify();
}
