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
export const CLINICAL_TABS = [
  {
    id: 'summary',
    label: 'Summary',
    icon: SummaryIcon,
    color: '#6366F1',
    description: 'Patient overview and key metrics',
    loader: () => import(/* webpackChunkName: "clinical-summary" */ './tabs/SummaryTab'),
  },
  {
    id: 'chart-review',
    label: 'Chart Review',
    icon: ChartReviewIcon,
    color: '#10B981',
    description: 'Problems, medications, allergies, vitals',
    loader: () => import(/* webpackChunkName: "clinical-chart-review" */ './tabs/ChartReviewTabOptimized'),
  },
  {
    id: 'encounters',
    label: 'Encounters',
    icon: EncountersIcon,
    color: '#3B82F6',
    description: 'Visit history and notes',
    loader: () => import(/* webpackChunkName: "clinical-encounters" */ './tabs/EncountersTab'),
  },
  {
    id: 'results',
    label: 'Results',
    icon: ResultsIcon,
    color: '#F59E0B',
    description: 'Lab results and reports',
    loader: () => import(/* webpackChunkName: "clinical-results" */ './tabs/ResultsTabOptimized'),
  },
  {
    id: 'orders',
    label: 'Orders',
    icon: OrdersIcon,
    color: '#8B5CF6',
    description: 'Active and pending orders',
    loader: () => import(/* webpackChunkName: "clinical-orders" */ './tabs/EnhancedOrdersTab'),
  },
  {
    id: 'administration',
    label: 'Administration',
    icon: AdministrationIcon,
    color: '#0EA5E9',
    description: 'Medication Administration Record (MAR)',
    loader: () => import(/* webpackChunkName: "clinical-administration" */ './AdministrationRecord/AdministrationRecord'),
  },
  {
    id: 'pharmacy',
    label: 'Pharmacy',
    icon: PharmacyIcon,
    color: '#14B8A6',
    description: 'Medication management',
    loader: () => import(/* webpackChunkName: "clinical-pharmacy" */ './tabs/PharmacyTab'),
  },
  {
    id: 'imaging',
    label: 'Imaging',
    icon: ImagingIcon,
    color: '#EF4444',
    description: 'Radiology and DICOM viewer',
    loader: () => import(/* webpackChunkName: "clinical-imaging" */ './tabs/ImagingTab'),
  },
  {
    id: 'documentation',
    label: 'Documentation',
    icon: DocumentationIcon,
    color: '#78716C',
    description: 'Clinical notes and forms',
    loader: () => import(/* webpackChunkName: "clinical-documentation" */ './tabs/DocumentationTabEnhanced'),
  },
  {
    id: 'care-plan',
    label: 'Care Plan',
    icon: CarePlanIcon,
    color: '#EC4899',
    description: 'Treatment plans and goals',
    loader: () => import(/* webpackChunkName: "clinical-care-plan" */ './tabs/CarePlanTabEnhanced'),
  },
  {
    id: 'timeline',
    label: 'Timeline',
    icon: TimelineIcon,
    color: '#06B6D4',
    description: 'Clinical history timeline',
    loader: () => import(/* webpackChunkName: "clinical-timeline" */ './tabs/TimelineTabModern'),
  },
];

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
export const buildTabContentConfig = () =>
  CLINICAL_TABS.map((t) => ({
    id: t.id,
    label: t.label,
    icon: t.icon,
    component: lazy(t.loader),
  }));
