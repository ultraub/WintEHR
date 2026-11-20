/**
 * Flowsheets module manifest — the pilot module for the pluggable-module
 * platform (docs/MODULES.md).
 *
 * Nursing vitals flowsheet: a time × vital-sign grid whose values are FHIR
 * Observations, served by the matching backend module
 * (backend/api/clinical/flowsheets/). The module key here matches the
 * backend MODULE_ROUTERS key so `flowsheets` in the disable lists switches
 * off both halves.
 */

import { MonitorHeart as FlowsheetIcon } from '@mui/icons-material';
import { categoricalAccents } from '../sdk';

const flowsheetsModule = {
  id: 'flowsheets',
  // What the module's UI needs a user to hold (docs/MODULES.md). Shown on the
  // Command Center's Modules tab; the chart itself still works read-only.
  permissions: ['read', 'write'],
  tabs: [
    {
      id: 'flowsheet',
      label: 'Flowsheet',
      icon: FlowsheetIcon,
      color: categoricalAccents.flowsheet,
      description: 'Vitals flowsheet — time grid of nursing observations',
      // Nursing surfaces sit together: Flowsheet lands beside the MAR
      // instead of at the end of the strip (Phase 1 tab placement).
      insertAfter: 'administration',
      loader: () => import(/* webpackChunkName: "module-flowsheets" */ './FlowsheetTab'),
    },
  ],
  // The same grid as a hostable SECTION: the tab policy can place it inside
  // another tab (e.g. Chart Review for nurses) — docs/MODULES.md, sections.
  sections: [
    {
      id: 'flowsheet',
      label: 'Flowsheet',
      icon: FlowsheetIcon,
      color: categoricalAccents.flowsheet,
      host: 'flowsheet',
      hostable: true,
      loader: () => import(/* webpackChunkName: "module-flowsheets" */ './FlowsheetTab'),
    },
  ],
};

export default flowsheetsModule;
