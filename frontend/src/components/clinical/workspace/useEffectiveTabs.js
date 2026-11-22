/**
 * useEffectiveTabs — the chart tabs THIS user sees, in order, with the
 * default tab and the ids the policy hid.
 *
 * Replaces direct imports of CLINICAL_TABS in everything that renders or
 * navigates the strip (tab bar, keyboard shortcuts, shortcut help, the
 * workspace's hidden-tab fallback), so a hidden tab is hidden everywhere.
 * The registry (`clinicalTabRegistry`) stays the catalog of what EXISTS;
 * this is what is SHOWN.
 *
 * `context` is the optional workflow context (inpatient, surgical, …).
 * Left undefined, the one chosen in the tab strip's context picker applies
 * (`setWorkflowContext` in tabPolicyStore, remembered per browser).
 */

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { CLINICAL_TABS } from './clinicalTabRegistry';
import { resolveEffectiveTabs } from './tabPolicy';
import { ensureTabPolicyLoaded, getActiveContext, getTabPolicySnapshot, subscribeTabPolicy } from './tabPolicyStore';

let warned = new Set();

export function useEffectiveTabs({ context } = {}) {
  const { user } = useAuth();
  const role = user?.role || null;
  const snapshot = useSyncExternalStore(subscribeTabPolicy, getTabPolicySnapshot, getTabPolicySnapshot);

  useEffect(() => {
    ensureTabPolicyLoaded();
  }, []);

  // An explicit `context` wins; otherwise the one chosen in the tab strip (tabPolicyStore).
  const effectiveContext = context !== undefined ? context : getActiveContext();

  return useMemo(() => {
    const resolved = resolveEffectiveTabs(CLINICAL_TABS, snapshot.policy, { role, context: effectiveContext });
    for (const warning of resolved.warnings) {
      if (!warned.has(warning)) {
        warned.add(warning);
        console.warn(`[tab policy] ${warning}`);
      }
    }
    return { ...resolved, ready: snapshot.loaded, role, context: effectiveContext, contexts: snapshot.contexts, policy: snapshot.policy };
  }, [snapshot, role, effectiveContext]);
}

/** Test helper: forget which warnings were already printed. */
export const __resetTabPolicyWarnings = () => {
  warned = new Set();
};
