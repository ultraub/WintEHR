import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute';
import Layout from '../components/Layout';
import Login from '../pages/Login';
import PatientList from '../pages/PatientList';
import PatientDashboardV2Page from '../pages/PatientDashboardV2Page';
import ClinicalWorkspaceWrapper from '../components/clinical/ClinicalWorkspaceWrapper';
import Dashboard from '../pages/Dashboard';
import Analytics from '../pages/Analytics';
import FHIRExplorerApp from '../components/fhir-explorer-v4/core/FHIRExplorerApp';
import { AppProviders } from '../providers/AppProviders';
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
import InventoryManagementPage from '../pages/InventoryManagementPage';
import PatientTimelinePage from '../pages/PatientTimelinePage';
import UIComposerMain from '../modules/ui-composer/UIComposerMain';
import PerformanceTestPage from '../pages/PerformanceTestPage';
import PageTransitionProvider, { transitionPresets } from '../components/transitions/PageTransitionProvider';

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
        <Layout>
          <PatientList />
        </Layout>
      </ProtectedRoute>
    )
  },
  {
    path: '/patients/:id',
    element: (
      <ProtectedRoute>
        <Layout>
          <PatientDashboardV2Page />
        </Layout>
      </ProtectedRoute>
    )
  },
  {
    path: '/patients/:id/clinical',
    element: (
      <ProtectedRoute>
        <ClinicalWorkspaceWrapper />
      </ProtectedRoute>
    )
  },
  {
    path: '/patients/:id/timeline',
    element: (
      <ProtectedRoute>
        <Layout>
          <PatientTimelinePage />
        </Layout>
      </ProtectedRoute>
    )
  },
  {
    path: '/patients/:id/medication-reconciliation',
    element: (
      <ProtectedRoute>
        <Layout>
          <MedicationReconciliationPage />
        </Layout>
      </ProtectedRoute>
    )
  },
  {
    path: '/patients/:id/encounters/:encounterId/medication-reconciliation',
    element: (
      <ProtectedRoute>
        <Layout>
          <MedicationReconciliationPage />
        </Layout>
      </ProtectedRoute>
    )
  },
  {
    path: '/patients/:id/vital-signs',
    element: (
      <ProtectedRoute>
        <Layout>
          <VitalSignsPage />
        </Layout>
      </ProtectedRoute>
    )
  },
  {
    path: '/dashboard',
    element: (
      <ProtectedRoute>
        <Layout>
          <Dashboard />
        </Layout>
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
        <Layout>
          <EncountersPage />
        </Layout>
      </ProtectedRoute>
    )
  },
  {
    path: '/lab-results',
    element: (
      <ProtectedRoute>
        <Layout>
          <LabResultsPage />
        </Layout>
      </ProtectedRoute>
    )
  },
  {
    path: '/medications',
    element: (
      <ProtectedRoute>
        <Layout>
          <MedicationsPage />
        </Layout>
      </ProtectedRoute>
    )
  },
  {
    path: '/pharmacy',
    element: (
      <ProtectedRoute>
        <Layout>
          <PharmacyPage />
        </Layout>
      </ProtectedRoute>
    )
  },
  {
    path: '/inventory',
    element: (
      <ProtectedRoute>
        <Layout>
          <InventoryManagementPage />
        </Layout>
      </ProtectedRoute>
    )
  },
  {
    path: '/analytics',
    element: (
      <ProtectedRoute>
        <Layout>
          <Analytics />
        </Layout>
      </ProtectedRoute>
    )
  },
  {
    path: '/quality',
    element: (
      <ProtectedRoute>
        <Layout>
          <QualityMeasuresPage />
        </Layout>
      </ProtectedRoute>
    )
  },
  {
    path: '/care-gaps',
    element: (
      <ProtectedRoute>
        <Layout>
          <CareGapsPage />
        </Layout>
      </ProtectedRoute>
    )
  },
  {
    path: '/fhir-explorer',
    element: (
      <ProtectedRoute>
        <AppProviders>
          <FHIRExplorerApp />
        </AppProviders>
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
        <Layout>
          <CDSHooksStudio />
        </Layout>
      </ProtectedRoute>
    )
  },
  {
    path: '/schedule',
    element: (
      <ProtectedRoute>
        <Layout>
          <Schedule />
        </Layout>
      </ProtectedRoute>
    )
  },
  {
    path: '/audit-trail',
    element: (
      <ProtectedRoute>
        <Layout>
          <AuditTrailPage />
        </Layout>
      </ProtectedRoute>
    )
  },
  {
    path: '/settings',
    element: (
      <ProtectedRoute>
        <Layout>
          <Settings />
        </Layout>
      </ProtectedRoute>
    )
  },
  {
    path: '/training',
    element: (
      <ProtectedRoute>
        <Layout>
          <TrainingCenterPage />
        </Layout>
      </ProtectedRoute>
    )
  },
  {
    path: '/performance-test',
    element: (
      <ProtectedRoute>
        <Layout>
          <PerformanceTestPage />
        </Layout>
      </ProtectedRoute>
    )
  },
  {
    path: '*',
    element: (
      <ProtectedRoute>
        <Layout>
          <NotFound />
        </Layout>
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