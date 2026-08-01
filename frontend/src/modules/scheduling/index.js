/**
 * Scheduling module manifest — the frontend half of the backend
 * `scheduling` module key (docs/MODULES.md).
 *
 * Created in module platform Phase 1 to make the disable key coherent
 * end-to-end: `scheduling` in the disable lists now removes the backend
 * routers AND this page AND its nav item together (previously disabling
 * the backend left a dead "Schedule" menu link).
 *
 * The page component stays in src/pages/ for now — Phase 1 moves
 * ownership, not files; relocation is optional later and would only churn
 * imports.
 */

import { CalendarMonth as ScheduleIcon } from '@mui/icons-material';
import { categoricalAccents } from '../../themes/categoricalAccents';

const schedulingModule = {
  id: 'scheduling',
  pages: [
    {
      id: 'schedule',
      path: '/schedule',
      label: 'Schedule',
      icon: ScheduleIcon,
      color: categoricalAccents.schedule,
      description: 'Appointments & scheduling',
      nav: { section: 'clinical', order: 20 },
      loader: () => import(/* webpackChunkName: "module-scheduling" */ '../../pages/Schedule'),
    },
  ],
};

export default schedulingModule;
