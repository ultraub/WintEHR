/**
 * Quality & Analytics module manifest — the frontend half of the backend
 * `quality-analytics` module key (docs/MODULES.md).
 *
 * Contributes the entire "Population Health" nav section's items; with
 * this module disabled the section disappears from the app shell along
 * with its routes and backend routers — one key, one honest switch
 * (module platform Phase 1 coherence migration).
 *
 * Page components stay in src/pages/ — Phase 1 moves ownership, not files.
 */

import {
  TrendingUp as AnalyticsIcon,
  Assessment as QualityIcon,
  Timeline as CareGapsIcon,
} from '@mui/icons-material';
import { categoricalAccents } from '../sdk';

const qualityAnalyticsModule = {
  id: 'quality-analytics',
  pages: [
    {
      id: 'analytics',
      path: '/analytics',
      label: 'Population Analytics',
      icon: AnalyticsIcon,
      color: categoricalAccents.analytics,
      description: 'Health trends & metrics',
      nav: { section: 'analytics', order: 10 },
      // eslint-disable-next-line no-restricted-imports -- Phase 1 moved page OWNERSHIP, not the file
      loader: () => import(/* webpackChunkName: "module-qa-analytics" */ '../../pages/Analytics'),
    },
    {
      id: 'quality',
      path: '/quality',
      label: 'Quality Measures',
      icon: QualityIcon,
      color: categoricalAccents.quality,
      description: 'Performance tracking',
      nav: { section: 'analytics', order: 20 },
      // eslint-disable-next-line no-restricted-imports -- Phase 1 moved page OWNERSHIP, not the file
      loader: () => import(/* webpackChunkName: "module-qa-quality" */ '../../pages/QualityMeasuresPage'),
    },
    {
      id: 'care-gaps',
      path: '/care-gaps',
      label: 'Care Gaps',
      icon: CareGapsIcon,
      color: categoricalAccents.careGaps,
      description: 'Preventive care tracking',
      nav: { section: 'analytics', order: 30 },
      // eslint-disable-next-line no-restricted-imports -- Phase 1 moved page OWNERSHIP, not the file
      loader: () => import(/* webpackChunkName: "module-qa-caregaps" */ '../../pages/CareGapsPage'),
    },
  ],
};

export default qualityAnalyticsModule;
