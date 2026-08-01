/**
 * App-shell navigation registry — core seed + module page contributions
 * (docs/MODULES.md, module platform Phase 1).
 *
 * Extracted from LayoutV3's hardcoded `navigationConfig`, which had the
 * same disease the workspace tab strip had before #150: the nav item list
 * and the route table had to agree BY HAND (a nav item is only real if
 * someone also registered its path in router/router.js). Both now derive
 * from one source: the core seed below plus `pages` contributed by module
 * manifests (`src/modules/`). Disabling a module removes its nav items and
 * its routes together — no more dead menu links to disabled features.
 *
 * Section keys are the API module pages target (`nav.section`); items sort
 * by `order` within a section (core items are pre-spaced by tens so module
 * items can slot between). A section with no items is dropped from the nav
 * entirely — "Population Health" only exists while the quality-analytics
 * module is enabled.
 */

import React from 'react';
import {
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  LocalPharmacy as PharmacyIcon,
  Api as ApiIcon,
  Webhook as WebhookIcon,
  Security as SecurityIcon,
  Settings as SettingsIcon,
  MedicalServices as MedicalIcon,
  Analytics as AnalyticsIcon,
  Assignment as EncountersIcon,
} from '@mui/icons-material';

import { categoricalAccents } from '../themes/categoricalAccents';
import { getModulePages } from '../modules';

/**
 * Core sections and items. `order` is explicit and spaced by tens; module
 * contributions interleave by their own `nav.order`. Schedule and the whole
 * Population Health item set are NOT here — they belong to the `scheduling`
 * and `quality-analytics` modules (frontend halves of the backend module
 * keys), contributed via manifests like any other module page.
 */
const CORE_NAV_SECTIONS = {
  clinical: {
    title: 'Clinical Workflows',
    icon: <MedicalIcon />,
    items: [
      { order: 10, text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard', description: 'Overview & quick actions', iconColor: categoricalAccents.summary },
      { order: 30, text: 'Patients', icon: <PeopleIcon />, path: '/patients', description: 'Patient management', iconColor: categoricalAccents.patients },
      { order: 40, text: 'Encounters', icon: <EncountersIcon />, path: '/encounters', description: 'Visit management', iconColor: categoricalAccents.encounters },
      { order: 50, text: 'Pharmacy', icon: <PharmacyIcon />, path: '/pharmacy', description: 'Pharmacy workflow & dispensing', iconColor: categoricalAccents.pharmacy },
    ],
  },
  analytics: {
    title: 'Population Health',
    icon: <AnalyticsIcon />,
    items: [],
  },
  tools: {
    title: 'Developer Tools',
    icon: <ApiIcon />,
    items: [
      { order: 10, text: 'FHIR Explorer', icon: <ApiIcon />, path: '/fhir-explorer', description: 'FHIR resource exploration & queries', iconColor: categoricalAccents.fhirExplorer },
      { order: 20, text: 'CDS Studio', icon: <WebhookIcon />, path: '/cds-studio', description: 'Clinical decision support studio', iconColor: categoricalAccents.cdsStudio },
    ],
  },
  admin: {
    title: 'Administration',
    icon: <SecurityIcon />,
    items: [
      { order: 10, text: 'Audit Trail', icon: <SecurityIcon />, path: '/audit-trail', description: 'Security & compliance', iconColor: categoricalAccents.audit },
      { order: 20, text: 'System Settings', icon: <SettingsIcon />, path: '/settings', description: 'Configuration', iconColor: categoricalAccents.settings },
    ],
  },
};

/** Section keys module pages may target. Exported for the drift tests. */
export const NAV_SECTION_KEYS = Object.keys(CORE_NAV_SECTIONS);

/**
 * Build the nav config LayoutV3 renders: core seed merged with enabled
 * modules' page contributions, sorted, empty sections dropped.
 */
export function buildNavigationConfig() {
  const sections = {};
  for (const [key, section] of Object.entries(CORE_NAV_SECTIONS)) {
    sections[key] = { ...section, items: [...section.items] };
  }

  for (const pageEntry of getModulePages()) {
    const nav = pageEntry.nav;
    if (!nav) continue; // a routed page with no menu presence is legal
    const section = sections[nav.section];
    if (!section) {
      // A typo'd section key must be loud, not a silently missing menu item
      // (same philosophy as the backend's unknown-disable-key warning).
      console.error(
        `navigationRegistry: module page '${pageEntry.id}' targets unknown ` +
        `nav section '${nav.section}' (known: ${NAV_SECTION_KEYS.join(', ')})`,
      );
      continue;
    }
    const Icon = pageEntry.icon;
    section.items.push({
      order: nav.order ?? 1000,
      text: pageEntry.label,
      icon: <Icon />,
      path: pageEntry.path,
      description: pageEntry.description,
      iconColor: pageEntry.color,
    });
  }

  const config = {};
  for (const [key, section] of Object.entries(sections)) {
    if (section.items.length === 0) continue;
    section.items.sort((a, b) => (a.order - b.order) || a.path.localeCompare(b.path));
    config[key] = section;
  }
  return config;
}
