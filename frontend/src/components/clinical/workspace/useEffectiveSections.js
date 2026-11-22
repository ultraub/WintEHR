/**
 * useEffectiveSections(tabId) — the sections THIS user sees on a tab, in
 * order: the tab's own panels plus hostable sections the policy added,
 * minus hidden ones. Same store and role as useEffectiveTabs.
 */

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { CLINICAL_SECTIONS } from './sectionRegistry';
import { resolveEffectiveSections } from './tabPolicy';
import { ensureTabPolicyLoaded, getActiveContext, getTabPolicySnapshot, subscribeTabPolicy } from './tabPolicyStore';

const warned = new Set();

export function useEffectiveSections(tabId, { context } = {}) {
  const { user } = useAuth();
  const role = user?.role || null;
  const snapshot = useSyncExternalStore(subscribeTabPolicy, getTabPolicySnapshot, getTabPolicySnapshot);

  useEffect(() => {
    ensureTabPolicyLoaded();
  }, []);

  const effectiveContext = context !== undefined ? context : getActiveContext();

  return useMemo(() => {
    const resolved = resolveEffectiveSections(tabId, CLINICAL_SECTIONS, snapshot.policy, { role, context: effectiveContext });
    for (const warning of resolved.warnings) {
      const key = `${tabId}:${warning}`;
      if (!warned.has(key)) {
        warned.add(key);
        console.warn(`[tab policy] ${tabId}: ${warning}`);
      }
    }
    return { ...resolved, ready: snapshot.loaded };
  }, [tabId, snapshot, role, effectiveContext]);
}
