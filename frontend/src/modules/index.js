/**
 * Module loader — the frontend half of the pluggable-module platform
 * (docs/MODULES.md).
 *
 * A module is a self-contained directory under `src/modules/<key>/` whose
 * `index.js` default-exports a manifest:
 *
 *   {
 *     id: 'flowsheets',            // module key — MUST match the backend
 *                                  // MODULE_ROUTERS key so one name disables
 *                                  // both halves
 *     tabs: [{ id, label, icon, color, description, loader }],
 *   }
 *
 * Registration is deliberately a STATIC list (one import + one array entry
 * per module) rather than auto-discovery: the import is what gives Vite a
 * code-splittable chunk per tab loader, and an explicit list is reviewable —
 * the same reasoning as the backend's ROUTERS list.
 *
 * Disabling: REACT_APP_DISABLED_MODULES="flowsheets,other" (build-time, like
 * every REACT_APP_* var) removes a module's registrations entirely — its
 * chunks are never fetched. The backend honors the same keys at runtime via
 * WINTEHR_DISABLED_MODULES.
 *
 * Import-graph note: manifests must stay CHEAP — icons and `() => import()`
 * thunks only, no eager component imports. A module must never import the
 * tab registry (the registry imports us; a cycle would be a build error).
 */

import flowsheets from './flowsheets';
import scheduling from './scheduling';
import qualityAnalytics from './quality-analytics';

const ALL_MODULES = [
  flowsheets,
  scheduling,
  qualityAnalytics,
];

const disabledKeys = new Set(
  (import.meta.env.REACT_APP_DISABLED_MODULES || '')
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean),
);

/** Manifests of every module enabled in this build. */
export const ENABLED_MODULES = ALL_MODULES.filter((m) => !disabledKeys.has(m.id));

/** Module keys disabled in this build (for diagnostics/tests). */
export const DISABLED_MODULE_KEYS = ALL_MODULES
  .filter((m) => disabledKeys.has(m.id))
  .map((m) => m.id);

/** Workspace tab entries contributed by enabled modules, in module order. */
export const getModuleTabs = () => ENABLED_MODULES.flatMap((m) => m.tabs || []);

/**
 * Top-level page entries contributed by enabled modules, in module order.
 * Each entry: { id, path, label, icon, color, description?, nav?, loader }.
 * `nav: { section, order }` places the page in the app-shell menu
 * (navigationRegistry); omit `nav` for a routed page with no menu item.
 * Consumed by router/router.js (routes) and navigationRegistry (menu) —
 * one entry drives both, so they cannot drift.
 */
export const getModulePages = () => ENABLED_MODULES.flatMap((m) => m.pages || []);
