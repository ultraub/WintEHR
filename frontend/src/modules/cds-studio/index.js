/**
 * CDS Management Studio Module
 *
 * Main entry point for the CDS Studio module
 *
 * Features:
 * - Service Registry: Browse and manage all CDS services
 * - Visual Builder: Create services with drag-and-drop interface
 * - Template Builder: Start from pre-built service templates
 * - Code Builder: Write Python code directly
 * - External Services: Register external HTTP endpoints
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
export { default as VisualBuilderWizard } from './components/builder/VisualBuilderWizard';
export { default as TemplateServiceBuilder } from './components/templates/TemplateServiceBuilder';
export { default as BuiltInServiceDialog } from './components/BuiltInServiceDialog';
export { default as ExternalServiceDialog } from './components/ExternalServiceDialog';
export { default as DiscoveryImportDialog } from './components/DiscoveryImportDialog';

// Visual Builder Components
export { default as ConditionBuilder } from './components/builders/ConditionBuilder';
export { default as CardDesigner } from './components/builders/CardDesigner';
export { default as DisplayConfigPanel } from './components/builders/DisplayConfigPanel';
export { default as ServiceTemplateGallery } from './components/templates/ServiceTemplateGallery';
export { default as PresentationModeSelector } from './components/builders/PresentationModeSelector';

// Testing & Preview
export { default as ServiceTester } from './components/testing/ServiceTester';
export { default as CardPreviewPanel } from './components/preview/CardPreviewPanel';

// Code Editor
export { default as CodeEditor } from './components/CodeEditor';

// Versioning
export { default as VersionHistory } from './components/VersionHistory';

// Credentials
export { default as CredentialDialog } from './components/CredentialDialog';

// API Client
export { default as cdsStudioApi } from './services/cdsStudioApi';
