import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute';
import LayoutV3 from '../components/LayoutV3';
import ClinicalLayout from '../components/ClinicalLayout';
import Login from '../pages/Login';
import PatientList from '../pages/PatientList';
import PatientDashboardV2Page from '../pages/PatientDashboardV2Page';
import ClinicalWorkspaceV3 from '../components/clinical/ClinicalWorkspaceV3';
import Dashboard from '../pages/Dashboard';
import Analytics from '../pages/Analytics';
import FHIRExplorerRedesigned from '../pages/FHIRExplorerRedesigned';
import Settings from '../pages/Settings';
import Schedule from '../pages/Schedule';
import NotFound from '../pages/NotFound';
import MedicationReconciliationPage from '../pages/MedicationReconciliationPage';
import VitalSignsPage from '../pages/VitalSignsPage';
import TrainingCenterPage from '../pages/TrainingCenterPage';
import CDSHooksStudio from '../pages/CDSHooksStudio';
import EncountersPage from '../pages/EncountersPage';
import LabResultsPage from '../pages/LabResultsPage';
import MedicationsPage from '../pages/MedicationsPage';
import QualityMeasuresPage from '../pages/QualityMeasuresPage';
import CareGapsPage from '../pages/CareGapsPage';
import AuditTrailPage from '../pages/AuditTrailPage';
import PharmacyPage from '../pages/PharmacyPage';
import PatientTimelinePage from '../pages/PatientTimelinePage';
import UIComposerMain from '../modules/ui-composer/UIComposerMain';

// Create router with future flags enabled
export const router = createBrowserRouter([
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
    element: (
      <ProtectedRoute>
        <LayoutV3>
          <PatientDashboardV2Page />
        </LayoutV3>
      </ProtectedRoute>
    )
  },
  {
    path: '/patients/:id/clinical',
    element: (
      <ProtectedRoute>
        <ClinicalLayout>
          <ClinicalWorkspaceV3 />
        </ClinicalLayout>
      </ProtectedRoute>
    )
  },
  {
    path: '/patients/:id/timeline',
    element: (
      <ProtectedRoute>
        <LayoutV3>
          <PatientTimelinePage />
        </LayoutV3>
      </ProtectedRoute>
    )
  },
  {
    path: '/patients/:id/medication-reconciliation',
    element: (
      <ProtectedRoute>
        <LayoutV3>
          <MedicationReconciliationPage />
        </LayoutV3>
      </ProtectedRoute>
    )
  },
  {
    path: '/patients/:id/encounters/:encounterId/medication-reconciliation',
    element: (
      <ProtectedRoute>
        <LayoutV3>
          <MedicationReconciliationPage />
        </LayoutV3>
      </ProtectedRoute>
    )
  },
  {
    path: '/patients/:id/vital-signs',
    element: (
      <ProtectedRoute>
        <LayoutV3>
          <VitalSignsPage />
        </LayoutV3>
      </ProtectedRoute>
    )
  },
  {
    path: '/dashboard',
    element: (
      <ProtectedRoute>
        <LayoutV3>
          <Dashboard />
        </LayoutV3>
      </ProtectedRoute>
    )
  },
  {
    path: '/clinical',
    element: <Navigate to="/dashboard" replace />
  },
  {
    path: '/encounters',
    element: (
      <ProtectedRoute>
        <LayoutV3>
          <EncountersPage />
        </LayoutV3>
      </ProtectedRoute>
    )
  },
  {
    path: '/lab-results',
    element: (
      <ProtectedRoute>
        <LayoutV3>
          <LabResultsPage />
        </LayoutV3>
      </ProtectedRoute>
    )
  },
  {
    path: '/medications',
    element: (
      <ProtectedRoute>
        <LayoutV3>
          <MedicationsPage />
        </LayoutV3>
      </ProtectedRoute>
    )
  },
  {
    path: '/pharmacy',
    element: (
      <ProtectedRoute>
        <LayoutV3>
          <PharmacyPage />
        </LayoutV3>
      </ProtectedRoute>
    )
  },
  {
    path: '/analytics',
    element: (
      <ProtectedRoute>
        <LayoutV3>
          <Analytics />
        </LayoutV3>
      </ProtectedRoute>
    )
  },
  {
    path: '/quality',
    element: (
      <ProtectedRoute>
        <LayoutV3>
          <QualityMeasuresPage />
        </LayoutV3>
      </ProtectedRoute>
    )
  },
  {
    path: '/care-gaps',
    element: (
      <ProtectedRoute>
        <LayoutV3>
          <CareGapsPage />
        </LayoutV3>
      </ProtectedRoute>
    )
  },
  {
    path: '/fhir-explorer',
    element: (
      <ProtectedRoute>
        <LayoutV3>
          <FHIRExplorerRedesigned />
        </LayoutV3>
      </ProtectedRoute>
    )
  },
  {
    path: '/ui-composer',
    element: (
      <ProtectedRoute>
        <UIComposerMain />
      </ProtectedRoute>
    )
  },
  // Redirect old CDS path to avoid conflicts with API endpoints
  {
    path: '/cds-hooks',
    element: <Navigate to="/cds-studio" replace />
  },
  {
    path: '/cds-studio',
    element: (
      <ProtectedRoute>
        <LayoutV3>
          <CDSHooksStudio />
        </LayoutV3>
      </ProtectedRoute>
    )
  },
  {
    path: '/schedule',
    element: (
      <ProtectedRoute>
        <LayoutV3>
          <Schedule />
        </LayoutV3>
      </ProtectedRoute>
    )
  },
  {
    path: '/audit-trail',
    element: (
      <ProtectedRoute>
        <LayoutV3>
          <AuditTrailPage />
        </LayoutV3>
      </ProtectedRoute>
    )
  },
  {
    path: '/settings',
    element: (
      <ProtectedRoute>
        <LayoutV3>
          <Settings />
        </LayoutV3>
      </ProtectedRoute>
    )
  },
  {
    path: '/training',
    element: (
      <ProtectedRoute>
        <LayoutV3>
          <TrainingCenterPage />
        </LayoutV3>
      </ProtectedRoute>
    )
  },
  {
    path: '*',
    element: (
      <ProtectedRoute>
        <LayoutV3>
          <NotFound />
        </LayoutV3>
      </ProtectedRoute>
    )
  }
], {
  // Enable future flags to prevent deprecation warnings
  future: {
    v7_startTransition: true,
    v7_relativeSplatPath: true,
    v7_fetcherPersist: true,
    v7_normalizeFormMethod: true,
    v7_partialHydration: true,
    v7_skipActionErrorRevalidation: true
  }
});