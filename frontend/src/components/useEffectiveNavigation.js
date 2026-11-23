/**
 * useEffectiveNavigation — the primary navigation THIS user sees: the
 * registry's config minus what the Command Center's navigation policy
 * hides for the organization, their role and the chosen workflow context
 * (`ui.tabs.policy` → `nav.hidden`; docs/COMMAND_CENTER.md slice 19).
 *
 * LayoutV3 renders the sidebar, the icon rail and the command palette from
 * `config`, and redirects a hidden page's URL to `landingPath`: the
 * Dashboard while it is visible, else Patients, which can never be hidden.
 * Until the policy has loaded everything is visible and `ready` is false,
 * so nothing flashes or redirects on a cold load.
 */

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { buildNavigationConfig, filterNavigationConfig, navigationCatalog } from './navigationRegistry';
import { resolveEffectiveNav } from './clinical/workspace/tabPolicy';
import { ensureTabPolicyLoaded, getActiveContext, getTabPolicySnapshot, subscribeTabPolicy } from './clinical/workspace/tabPolicyStore';

let fullConfig = null;
let catalog = null;
const warned = new Set();

const ensureCatalog = () => {
  if (!fullConfig) {
    fullConfig = buildNavigationConfig();
    catalog = navigationCatalog();
  }
};

/** True when `pathname` is the item's page or one of its sub-pages. */
export const pathUnder = (pathname, path) => pathname === path || pathname.startsWith(`${path}/`);

export function useEffectiveNavigation() {
  const { user } = useAuth();
  const role = user?.role || null;
  const snapshot = useSyncExternalStore(subscribeTabPolicy, getTabPolicySnapshot, getTabPolicySnapshot);

  useEffect(() => {
    ensureTabPolicyLoaded();
  }, []);

  const context = getActiveContext();

  return useMemo(() => {
    ensureCatalog();
    const resolved = resolveEffectiveNav(catalog, snapshot.policy, { role, context });
    for (const warning of resolved.warnings) {
      if (!warned.has(warning)) {
        warned.add(warning);
        console.warn(`[nav policy] ${warning}`);
      }
    }
    const config = filterNavigationConfig(fullConfig, resolved.hiddenIds);
    const hiddenPaths = catalog.filter((i) => resolved.hiddenIds.includes(i.id)).map((i) => i.path);
    return {
      config,
      hiddenIds: resolved.hiddenIds,
      hiddenPaths,
      landingPath: resolved.hiddenIds.includes('dashboard') ? '/patients' : '/dashboard',
      isHiddenPath: (pathname) => hiddenPaths.some((p) => pathUnder(pathname, p)),
      ready: snapshot.loaded,
      role,
      context,
    };
  }, [snapshot, role, context]);
}

/** Test helper: rebuild the catalog (after mocking modules) and forget printed warnings. */
export const __resetNavigationForTests = () => {
  fullConfig = null;
  catalog = null;
  warned.clear();
};
