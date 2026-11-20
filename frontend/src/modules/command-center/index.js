/**
 * Command Center module manifest (docs/MODULES.md, docs/COMMAND_CENTER.md).
 * The module key matches the backend MODULE_ROUTERS key so one name
 * disables both halves.
 *
 * Contributes one top-level page in the Administration nav section. The
 * page itself gates on the `admin` permission (the backend enforces the
 * same rule on every /api/command-center route).
 */

import { SpaceDashboard as CommandCenterIcon } from '@mui/icons-material';
import { categoricalAccents } from '../sdk';

const commandCenterModule = {
  id: 'command-center',
  pages: [
    {
      id: 'command-center',
      path: '/command-center',
      label: 'Command Center',
      icon: CommandCenterIcon,
      color: categoricalAccents.commandCenter,
      description: 'Deployment status & administration',
      nav: { section: 'admin', order: 5 },
      loader: () => import(/* webpackChunkName: "module-command-center" */ './CommandCenterPage'),
    },
  ],
};

export default commandCenterModule;
