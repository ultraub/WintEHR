/**
 * Section registry — the panels INSIDE chart tabs, as a registrable unit
 * (Command Center slice 7b, docs/COMMAND_CENTER.md).
 *
 * A tab is a page; a section is a panel on it. Core tabs declare their
 * sections here; modules declare theirs in their manifest (`sections`,
 * docs/MODULES.md). A section with `hostable: true` can be placed on a
 * different tab by the tab policy — that is how Flowsheet or Imaging can
 * appear inside Chart Review for one role while staying a top-level tab
 * for another.
 *
 *   { id, label, host, builtin, hostable, loader?, defaultCollapsed? }
 *
 * - `host`      the tab the section belongs to by default
 * - `builtin`   rendered by the host tab's own code (Chart Review's panels
 *               share its data and filters); has no `loader`
 * - `hostable`  may be added to other tabs; needs a `loader` that resolves
 *               a component taking `{ patientId }` and loading its own data
 * - `defaultCollapsed` start folded when hosted elsewhere (heavy content:
 *               imaging fires DICOM queries on mount)
 *
 * Like the tab registry, this is what EXISTS. What a user SEES on a tab is
 * `useEffectiveSections(tabId)`.
 */

import { getModuleSections } from '../../../modules';

const builtin = (host, id, label) => ({ id, label, host, builtin: true, hostable: false });

export const CORE_SECTIONS = [
  // Chart Review's dashboard panels, in their rendered order.
  builtin('chart-review', 'conditions', 'Conditions'),
  builtin('chart-review', 'medications', 'Medications'),
  builtin('chart-review', 'allergies', 'Allergies'),
  builtin('chart-review', 'immunizations', 'Immunizations'),
  builtin('chart-review', 'procedures', 'Procedures'),
  builtin('chart-review', 'care-plans', 'Care Plans'),
  builtin('chart-review', 'documents', 'Clinical Documents'),
  builtin('chart-review', 'encounters', 'Recent Encounters'),

  // Hostable core content: the Imaging tab's study browser as a panel.
  {
    id: 'imaging-studies',
    label: 'Imaging studies',
    host: 'imaging',
    builtin: false,
    hostable: true,
    defaultCollapsed: true,
    loader: () => import(/* webpackChunkName: "section-imaging" */ './tabs/ImagingTab'),
  },
];

/**
 * Module sections become ordinary registry entries (same stance as module
 * tabs). A module section's `host` defaults to the module's own tab id.
 */
function mergeModuleSections(core, moduleSections) {
  const ids = new Set(core.map((s) => s.id));
  const merged = [...core];
  for (const section of moduleSections) {
    if (ids.has(section.id)) {
      console.error(`sections: module section id '${section.id}' collides with an existing section; skipped`);
      continue;
    }
    ids.add(section.id);
    merged.push({ builtin: false, hostable: true, ...section });
  }
  return merged;
}

export const CLINICAL_SECTIONS = mergeModuleSections(CORE_SECTIONS, getModuleSections());

/** Sections that belong to a tab by default, in registry order. */
export const sectionsForTab = (tabId) => CLINICAL_SECTIONS.filter((s) => s.host === tabId);

/** Sections that may be added to a tab other than their own. */
export const hostableSections = () => CLINICAL_SECTIONS.filter((s) => s.hostable);

export const getSection = (id) => CLINICAL_SECTIONS.find((s) => s.id === id);

/** Plain-data catalog for the Command Center (no loaders, no cycles). */
export const sectionCatalog = () =>
  CLINICAL_SECTIONS.map(({ id, label, host, builtin: isBuiltin, hostable, defaultCollapsed }) => ({
    id, label, host, builtin: isBuiltin, hostable: Boolean(hostable), defaultCollapsed: Boolean(defaultCollapsed),
  }));
