/**
 * Clinical workspace tab registry — the single source of truth.
 *
 * Before this file, adding a workspace tab meant editing FIVE places that
 * each kept their own hardcoded list:
 *   - ClinicalWorkspaceEnhanced.TAB_CONFIG   (id, label, icon, component)
 *   - ClinicalTabs.NAVIGATION_ITEMS          (id, label, icon, color, badge)
 *   - ClinicalSidebar.NAVIGATION_ITEMS       (id, label, icon, description, badge)
 *   - EnhancedClinicalLayout.MODULES         (id, label, index)
 *   - navigationHelper.TAB_IDS / TAB_DISPLAY_NAMES
 *
 * Adding the Administration tab (#116 Phase 5.1) tripped over three of
 * those independently — each miss was a silent bug (tab missing from the
 * strip; URL fell back to Summary). This registry collapses all five into
 * one ordered array. Each consumer derives the shape it needs via the
 * helper selectors below.
 *
 * To add a tab now: append one entry here. Nothing else.
 *
 * Import-graph note: this module imports React `lazy` and MUI icons.
 * `lazy(() => import(...))` does NOT eagerly load the tab's code — the
 * chunk is fetched on first render — so importing the registry stays
 * cheap, and `navigationHelper` (imported very widely) can pull
 * `TAB_IDS` from here without dragging in every tab's bundle.
 */

import { lazy } from 'react';
import { categoricalAccents } from '../../../themes/categoricalAccents';
import { getModuleTabs } from '../../../modules';
import {
  Dashboard as SummaryIcon,
  Assignment as ChartReviewIcon,
  Event as EncountersIcon,
  Science as ResultsIcon,
  LocalPharmacy as OrdersIcon,
  MedicalServices as AdministrationIcon,
  Medication as PharmacyIcon,
  CameraAlt as ImagingIcon,
  Description as DocumentationIcon,
  AccountTree as CarePlanIcon,
  Timeline as TimelineIcon,
  Inbox as InboxIcon,
} from '@mui/icons-material';

/**
 * The ordered tab list. Array order IS the tab order — `EnhancedClinicalLayout`
 * derives its numeric index map from array position, so reordering here
 * reorders the workspace.
 *
 * Field reference:
 *   id          — URL `?tab=` value + internal activeTab key
 *   label       — display text everywhere
 *   icon        — MUI icon component (used by the tab strip + sidebar)
 *   color       — accent color for the horizontal tab strip
 *   description — sidebar secondary text
 *   loader      — () => dynamic import of the tab's content component.
 *                 Kept as a thunk (not a pre-built lazy component) so
 *                 selectors that don't need the component — the sidebar,
 *                 the layout — don't construct it.
 */
const CORE_TABS = [
  {
    id: 'summary',
    label: 'Summary',
    icon: SummaryIcon,
    color: categoricalAccents.summary,
    description: 'Patient overview and key metrics',
    loader: () => import(/* webpackChunkName: "clinical-summary" */ './tabs/SummaryTab'),
  },
  {
    id: 'chart-review',
    label: 'Chart Review',
    icon: ChartReviewIcon,
    color: categoricalAccents.chartReview,
    description: 'Problems, medications, allergies, vitals',
    loader: () => import(/* webpackChunkName: "clinical-chart-review" */ './tabs/ChartReviewTabOptimized'),
  },
  {
    id: 'encounters',
    label: 'Encounters',
    icon: EncountersIcon,
    color: categoricalAccents.encounters,
    description: 'Visit history and notes',
    loader: () => import(/* webpackChunkName: "clinical-encounters" */ './tabs/EncountersTab'),
  },
  {
    id: 'results',
    label: 'Results',
    icon: ResultsIcon,
    color: categoricalAccents.results,
    description: 'Lab results and reports',
    loader: () => import(/* webpackChunkName: "clinical-results" */ './tabs/ResultsTabOptimized'),
  },
  {
    id: 'orders',
    label: 'Orders',
    icon: OrdersIcon,
    color: categoricalAccents.orders,
    description: 'Active and pending orders',
    loader: () => import(/* webpackChunkName: "clinical-orders" */ './tabs/EnhancedOrdersTab'),
  },
  {
    id: 'administration',
    label: 'Administration',
    icon: AdministrationIcon,
    color: categoricalAccents.administration,
    description: 'Medication Administration Record (MAR)',
    loader: () => import(/* webpackChunkName: "clinical-administration" */ './AdministrationRecord/AdministrationRecord'),
  },
  {
    id: 'pharmacy',
    label: 'Pharmacy',
    icon: PharmacyIcon,
    color: categoricalAccents.pharmacy,
    description: 'Medication management',
    loader: () => import(/* webpackChunkName: "clinical-pharmacy" */ './tabs/PharmacyTab'),
  },
  {
    id: 'imaging',
    label: 'Imaging',
    icon: ImagingIcon,
    color: categoricalAccents.imaging,
    description: 'Radiology and DICOM viewer',
    loader: () => import(/* webpackChunkName: "clinical-imaging" */ './tabs/ImagingTab'),
  },
  {
    id: 'documentation',
    label: 'Documentation',
    icon: DocumentationIcon,
    color: categoricalAccents.documentation,
    description: 'Clinical notes and forms',
    loader: () => import(/* webpackChunkName: "clinical-documentation" */ './tabs/DocumentationTabEnhanced'),
  },
  {
    id: 'care-plan',
    label: 'Care Plan',
    icon: CarePlanIcon,
    color: categoricalAccents.carePlan,
    description: 'Treatment plans and goals',
    loader: () => import(/* webpackChunkName: "clinical-care-plan" */ './tabs/CarePlanTabEnhanced'),
  },
  {
    id: 'timeline',
    label: 'Timeline',
    icon: TimelineIcon,
    color: categoricalAccents.timeline,
    description: 'Clinical history timeline',
    loader: () => import(/* webpackChunkName: "clinical-timeline" */ './tabs/TimelineTabModern'),
  },
  {
    id: 'inbox',
    label: 'Inbox',
    icon: InboxIcon,
    color: categoricalAccents.inbox,
    description: 'Messages, results review, and follow-ups',
    loader: () => import(/* webpackChunkName: "clinical-inbox" */ '../inbox/InboxTab'),
  },
];

/**
 * Core tabs + tabs contributed by enabled modules (src/modules/ —
 * docs/MODULES.md). A module tab may carry `insertAfter: '<tab-id>'` to sit
 * where it clinically belongs in the strip (e.g. Flowsheet beside the MAR);
 * without it — or if the named tab is absent — the tab appends at the end,
 * never silently disappears. From here on module tabs are ordinary registry
 * entries: every selector, the keyboard map, and the coverage tests treat
 * them identically. Disabling a module (via REACT_APP_DISABLED_MODULES)
 * removes its registrations — its lazy chunks are still emitted by the
 * build but are never fetched, since nothing references them at runtime.
 */
function mergeModuleTabs(coreTabs, moduleTabs) {
  const merged = [...coreTabs];
  for (const tab of moduleTabs) {
    const anchor = tab.insertAfter
      ? merged.findIndex((t) => t.id === tab.insertAfter)
      : -1;
    if (anchor >= 0) {
      merged.splice(anchor + 1, 0, tab);
    } else {
      merged.push(tab);
    }
  }
  return merged;
}

export const CLINICAL_TABS = mergeModuleTabs(CORE_TABS, getModuleTabs());

// ---------------------------------------------------------------------
// Derived selectors — each consumer takes only what it needs.
// ---------------------------------------------------------------------

/** Ordered list of tab id strings. */
export const TAB_ID_LIST = CLINICAL_TABS.map((t) => t.id);

/**
 * Constant-style id map: `TAB_IDS.CHART_REVIEW === 'chart-review'`.
 * Keys are the id upper-cased with hyphens → underscores. Preserves the
 * shape `navigationHelper` exposed before this refactor so its existing
 * consumers (RESOURCE_TYPE_TO_TAB etc.) don't change.
 */
export const TAB_IDS = Object.fromEntries(
  CLINICAL_TABS.map((t) => [t.id.toUpperCase().replace(/-/g, '_'), t.id]),
);

/** id → display label. */
export const TAB_DISPLAY_NAMES = Object.fromEntries(
  CLINICAL_TABS.map((t) => [t.id, t.label]),
);

/** Whether a string is a registered tab id. */
export const isKnownTabId = (id) => TAB_ID_LIST.includes(id);

/** 0-based position of a tab in the workspace order, or -1. */
export const getTabIndex = (id) => TAB_ID_LIST.indexOf(id);

/**
 * Build the lazy-loaded content-routing config for ClinicalWorkspaceEnhanced.
 * Each entry's `component` is a `React.lazy` wrapper around the tab's loader.
 * Constructed on demand (not at module scope) so consumers that never render
 * tab content don't pay for it.
 */
/**
 * lazy() with one retry: a tab's chunk fetch can fail transiently (backend
 * or nginx mid-restart). One short-delay retry absorbs those without any
 * user-visible error. If BOTH attempts fail the rejection propagates so
 * TabErrorBoundary + staleBundleRecovery can classify it (stale deploy vs
 * server down) — do not retry more than once here or the update-recovery
 * reload gets needlessly delayed.
 */
const RETRY_DELAY_MS = 1500;

/** Run a dynamic-import loader; on rejection, wait and try exactly once more. */
export const retryOnce = (loader, delayMs = RETRY_DELAY_MS) =>
  loader().catch(
    () => new Promise((resolve) => setTimeout(resolve, delayMs)).then(loader)
  );

const lazyWithRetry = (loader) => lazy(() => retryOnce(loader));

export const buildTabContentConfig = () =>
  CLINICAL_TABS.map((t) => ({
    id: t.id,
    label: t.label,
    icon: t.icon,
    component: lazyWithRetry(t.loader),
  }));
