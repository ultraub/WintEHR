/**
 * Inpatient module manifest (docs/MODULES.md). The module key matches the
 * backend MODULE_ROUTERS key so one name disables both halves.
 *
 * First consumer of both Phase 2 seams: contributes a top-level PAGE (the
 * census board, under Clinical Workflows) and the first SLOT contribution
 * (an admitted-patient location chip in the patient header).
 */

import { Hotel as CensusIcon } from '@mui/icons-material';
import { categoricalAccents } from '../../themes/categoricalAccents';
import BedChip from './BedChip';

const inpatientModule = {
  id: 'inpatient',
  pages: [
    {
      id: 'census',
      path: '/census',
      label: 'Unit Census',
      icon: CensusIcon,
      color: categoricalAccents.inpatient,
      description: 'Admitted patients & recent stays',
      nav: { section: 'clinical', order: 60 },
      loader: () => import(/* webpackChunkName: "module-inpatient" */ './CensusPage'),
    },
  ],
  slots: {
    // Context contract: { patient } — see SLOT_NAMES in src/modules/index.js.
    'patient-header.chips': [
      { id: 'bed-assignment', order: 10, Component: BedChip },
    ],
  },
};

export default inpatientModule;
