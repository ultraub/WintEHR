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

let state = { policy: EMPTY_TAB_POLICY, roles: [], contexts: [], loaded: false, error: null };
let inflight = null;
const listeners = new Set();

const notify = () => listeners.forEach((cb) => cb());

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
  state = { policy: EMPTY_TAB_POLICY, roles: [], contexts: [], loaded: true, error: null, ...next };
  inflight = null;
  notify();
}
