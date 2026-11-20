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
 * thunks for tabs/pages; the ONE sanctioned eager import is a slot
 * contribution component (header chips must not lazy-flash), which must
 * therefore stay tiny. A module must never import the tab registry
 * (the registry imports us; a cycle would be a build error).
 */

import flowsheets from './flowsheets';
import scheduling from './scheduling';
import qualityAnalytics from './quality-analytics';
import inpatient from './inpatient';
import commandCenter from './command-center';
// External modules vendored by scripts/sync-modules.py (empty by default).
import { EXTERNAL_MODULES } from './registry.generated';

const BUILTIN_MODULES = [
  flowsheets,
  scheduling,
  qualityAnalytics,
  inpatient,
  commandCenter,
];

const ALL_MODULES = [...BUILTIN_MODULES, ...EXTERNAL_MODULES];

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
 * Plain-data summary of every manifest (enabled and build-disabled) for the
 * Command Center's Modules tab: what each module contributes, the
 * permissions it says its UI needs (`permissions`), and the settings keys
 * it reads (`settings`, declared by the backend half as module.<key>.*).
 * No components or loaders — safe to ship over the SDK.
 */
export const getModuleSummaries = () =>
  ALL_MODULES.map((m) => ({
    id: m.id,
    enabled: !disabledKeys.has(m.id),
    external: EXTERNAL_MODULES.includes(m),
    tabs: (m.tabs || []).map((t) => ({ id: t.id, label: t.label })),
    pages: (m.pages || []).map((p) => ({ id: p.id, path: p.path, label: p.label })),
    sections: (m.sections || []).map((s) => ({ id: s.id, label: s.label, hostable: s.hostable !== false })),
    slots: Object.keys(m.slots || {}),
    permissions: [...(m.permissions || [])],
    settings: [...(m.settings || [])],
  }));

/**
 * Section entries contributed by enabled modules (panels that can live
 * inside a tab; see workspace/sectionRegistry.js and docs/MODULES.md).
 * Each entry: { id, label, icon?, color?, loader, host?, hostable?,
 * defaultCollapsed? }. `host` defaults to the module's first tab id.
 */
export const getModuleSections = () =>
  ENABLED_MODULES.flatMap((m) =>
    (m.sections || []).map((s) => ({
      host: m.tabs?.[0]?.id ?? m.id,
      hostable: true,
      hostedFrom: m.tabs?.[0]?.label,
      ...s,
      moduleId: m.id,
    })),
  );

/**
 * Top-level page entries contributed by enabled modules, in module order.
 * Each entry: { id, path, label, icon, color, description?, nav?, loader }.
 * `nav: { section, order }` places the page in the app-shell menu
 * (navigationRegistry); omit `nav` for a routed page with no menu item.
 * Consumed by router/router.js (routes) and navigationRegistry (menu) —
 * one entry drives both, so they cannot drift.
 */
export const getModulePages = () => ENABLED_MODULES.flatMap((m) => m.pages || []);

/**
 * Published slot names — the ONLY places module UI may render inside core
 * components (module platform Phase 2). A slot exists where a core
 * component places a <SlotOutlet name="...">; modules contribute by name
 * via `slots: { '<name>': [{ id, order, Component }] }`. The name doubles
 * as the API: each entry documents the context props its outlet passes.
 * Add a name here ONLY together with its outlet — the drift tests hold
 * the two in lockstep, so a typo'd target fails a test instead of
 * silently rendering nothing.
 */
export const SLOT_NAMES = Object.freeze({
  // Chip row under the patient name in the clinical workspace header.
  // Context: { patient } (the current Patient resource).
  'patient-header.chips': { context: ['patient'] },
  // Card grid on the Summary tab, after the core cards.
  // Context: { patientId } (bare FHIR id).
  'summary.cards': { context: ['patientId'] },
});

/**
 * Contributions from enabled modules for one slot, deterministically
 * ordered (order, then module id — module iteration order is stable).
 * Unknown slot targets are reported loudly at load: a typo must not look
 * like an empty slot.
 */
export const getSlotContributions = (slotName) => {
  const contributions = [];
  for (const m of ENABLED_MODULES) {
    for (const [target, entries] of Object.entries(m.slots || {})) {
      if (!(target in SLOT_NAMES)) {
        console.error(
          `modules: '${m.id}' targets unknown slot '${target}' ` +
          `(published: ${Object.keys(SLOT_NAMES).join(', ')})`,
        );
        continue;
      }
      if (target !== slotName) continue;
      for (const entry of entries) {
        contributions.push({ ...entry, moduleId: m.id });
      }
    }
  }
  return contributions.sort(
    (a, b) => ((a.order ?? 1000) - (b.order ?? 1000)) || a.moduleId.localeCompare(b.moduleId),
  );
};
