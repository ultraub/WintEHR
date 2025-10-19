/**
 * CDS Management Studio Module
 *
 * Main entry point for the CDS Studio module
 *
 * Features:
 * - Service Registry: Browse and manage all CDS services
 * - Service Creation: Built-in (Python) and External (HTTP) services
 * - Configuration Transparency: View complete FHIR PlanDefinitions
 * - Service Testing: Test with synthetic patient data
 * - Monaco Editor: Browser-based Python code editing
 */

// Main Pages
export { default as CDSStudioPage } from './pages/CDSStudioPage';
export { default as CredentialsManager } from './pages/CredentialsManager';
export { default as MonitoringDashboard } from './pages/MonitoringDashboard';

// Registry Components
export { default as ServicesTable } from './pages/ServicesRegistry/ServicesTable';
export { default as ServiceDetailPanel } from './components/ServiceDetailPanel';

// Configuration & Testing
export { default as ConfigurationViewer } from './components/ConfigurationViewer';
export { default as ServiceTestRunner } from './components/ServiceTestRunner';

// Service Creation
export { default as BuiltInServiceDialog } from './components/BuiltInServiceDialog';
export { default as ExternalServiceDialog } from './components/ExternalServiceDialog';
export { default as DiscoveryImportDialog } from './components/DiscoveryImportDialog';

// Code Editor
export { default as CodeEditor } from './components/CodeEditor';

// Versioning
export { default as VersionHistory } from './components/VersionHistory';

// Credentials
export { default as CredentialDialog } from './components/CredentialDialog';

// API Client
export { default as cdsStudioApi } from './services/cdsStudioApi';
