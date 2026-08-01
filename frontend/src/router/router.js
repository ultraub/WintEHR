import React, { Suspense, lazy } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';

import { getModulePages } from '../modules';
import { Box, CircularProgress } from '@mui/material';
import ProtectedRoute from '../components/ProtectedRoute';
import LayoutV3 from '../components/LayoutV3';
import Login from '../pages/Login';
import PatientList from '../pages/PatientList';

// Every page except Login/PatientList is lazy: statically importing them
// pulled d3 (FHIR Explorer), monaco (CDS Studio), and recharts (Analytics)
// into the initial bundle, so those libraries downloaded before the login
// screen could paint.
const PatientDashboardV2Page = lazy(() => import('../pages/PatientDashboardV2Page'));
const ClinicalWorkspaceWrapper = lazy(() => import('../components/clinical/ClinicalWorkspaceWrapper'));
const Dashboard = lazy(() => import('../pages/Dashboard'));
const FHIRExplorerApp = lazy(() => import('../components/fhir-explorer-v4/core/FHIRExplorerApp'));
const QueryStudioEnhanced = lazy(() => import('../components/fhir-explorer-v4/query-building/QueryStudioEnhanced'));
const Settings = lazy(() => import('../pages/Settings'));
const NotFound = lazy(() => import('../pages/NotFound'));
const MedicationReconciliationPage = lazy(() => import('../pages/MedicationReconciliationPage'));
const CDSStudioPage = lazy(() => import('../modules/cds-studio').then(m => ({ default: m.CDSStudioPage })));
const CDSPresentationModeTester = lazy(() => import('../components/clinical/cds/CDSPresentationModeTester'));
const EncountersPage = lazy(() => import('../pages/EncountersPage'));
const AuditTrailPage = lazy(() => import('../pages/AuditTrailPage'));
const PharmacyPage = lazy(() => import('../pages/PharmacyPage'));
const InventoryManagementPage = lazy(() => import('../pages/InventoryManagementPage'));
const PatientTimelinePage = lazy(() => import('../pages/PatientTimelinePage'));
const UIComposerMain = lazy(() => import('../modules/ui-composer/UIComposerMain'));
const PerformanceTestPage = lazy(() => import('../pages/PerformanceTestPage'));
const SMARTCallbackPage = lazy(() => import('../pages/SMARTCallbackPage'));
const SMARTDemoApp = lazy(() => import('../pages/SMARTDemoApp'));

const routeFallback = (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
    <CircularProgress size={40} />
  </Box>
);

// Wrap a lazy page in Suspense; optionally in the app chrome + auth guard.
const page = (element, { layout = true, protect = true } = {}) => {
  let node = <Suspense fallback={routeFallback}>{element}</Suspense>;
  if (layout) node = <LayoutV3>{node}</LayoutV3>;
  if (protect) node = <ProtectedRoute>{node}</ProtectedRoute>;
  return node;
};

// Top-level pages contributed by enabled modules (docs/MODULES.md). One
// manifest entry yields this route AND the nav item (navigationRegistry) —
// they cannot drift, and disabling the module removes both. Includes the
// migrated frontend halves of the scheduling and quality-analytics module
// keys (/schedule, /analytics, /quality, /care-gaps).
const modulePageRoutes = getModulePages().map((entry) => {
  const ModulePage = lazy(entry.loader);
  return { path: entry.path, element: page(<ModulePage />) };
});

// Create router with future flags enabled
export const router = createBrowserRouter([
  ...modulePageRoutes,
  {
    path: '/login',
    element: <Login />
  },
  {
    path: '/',
    element: <Navigate to="/patients" replace />
  },
  {
    path: '/patients',
    element: (
      <ProtectedRoute>
        <LayoutV3>
          <PatientList />
        </LayoutV3>
      </ProtectedRoute>
    )
  },
  {
    path: '/patients/:id',
    element: page(<PatientDashboardV2Page />)
  },
  {
    path: '/patients/:id/clinical',
    element: page(<ClinicalWorkspaceWrapper />, { layout: false })
  },
  {
    path: '/patients/:id/timeline',
    element: page(<PatientTimelinePage />)
  },
  {
    path: '/patients/:id/medication-reconciliation',
    element: page(<MedicationReconciliationPage />)
  },
  {
    path: '/patients/:id/encounters/:encounterId/medication-reconciliation',
    element: page(<MedicationReconciliationPage />)
  },
  {
    path: '/dashboard',
    element: page(<Dashboard />)
  },
  {
    path: '/clinical',
    element: <Navigate to="/dashboard" replace />
  },
  {
    path: '/encounters',
    element: page(<EncountersPage />)
  },
  {
    path: '/pharmacy',
    element: page(<PharmacyPage />)
  },
  {
    path: '/inventory',
    element: page(<InventoryManagementPage />)
  },
  {
    // No LayoutV3 (the explorer owns its shell) and no extra AppProviders —
    // App.js already wraps the whole RouterProvider in AppProviders, so the
    // previous nested copy double-mounted every context for this route.
    path: '/fhir-explorer',
    element: page(<FHIRExplorerApp />, { layout: false })
  },
  {
    path: '/fhir-explorer/query-studio-enhanced',
    element: page(<QueryStudioEnhanced />)
  },
  {
    path: '/ui-composer',
    element: page(<UIComposerMain />, { layout: false })
  },
  // Redirect old CDS path to avoid conflicts with API endpoints
  {
    path: '/cds-hooks',
    element: <Navigate to="/cds-studio" replace />
  },
  {
    path: '/cds-studio',
    element: page(<CDSStudioPage />)
  },
  {
    path: '/cds-presentation-test',
    element: page(<CDSPresentationModeTester />)
  },
  {
    path: '/audit-trail',
    element: page(<AuditTrailPage />)
  },
  {
    path: '/settings',
    element: page(<Settings />)
  },
  {
    path: '/performance-test',
    element: page(<PerformanceTestPage />)
  },
  // SMART on FHIR authorization callback
  {
    path: '/smart-callback',
    element: page(<SMARTCallbackPage />, { layout: false })
  },
  // Built-in SMART demo app (educational; unauthenticated by design)
  {
    path: '/smart-demo',
    element: page(<SMARTDemoApp />, { layout: false, protect: false })
  },
  {
    path: '*',
    element: page(<NotFound />)
  }
]);
// (The v6 `future` block is gone: every v7_* flag it enabled is simply the
// default behavior in React Router 7, which is why this upgrade was safe —
// the app had been running v7 semantics on v6 since the flags went on.)
