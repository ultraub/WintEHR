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
import { categoricalAccents } from '../../themes/categoricalAccents';

const flowsheetsModule = {
  id: 'flowsheets',
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
};

export default flowsheetsModule;
