/**
 * CDS Service Builder v2 - Main Component
 * Enhanced CDS service development platform with dual perspectives
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
  Button,
  ButtonGroup,
  IconButton,
  Tooltip,
  AppBar,
  Toolbar,
  Divider,
  Alert,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Chip,
  Stack,
  Card,
  CardContent,
  CardActions,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  Code as CodeIcon,
  Visibility as PreviewIcon,
  PlayArrow as TestIcon,
  Save as SaveIcon,
  Settings as SettingsIcon,
  AccountTree as WorkflowIcon,
  ViewModule as TemplateIcon,
  Analytics as AnalyticsIcon,
  Group as CollaborateIcon,
  Help as HelpIcon,
  Refresh as RefreshIcon,
  Download as ExportIcon,
  Upload as ImportIcon,
  BugReport as DebugIcon,
  Speed as PerformanceIcon,
  Security as SecurityIcon,
  Link as IntegrationIcon
} from '@mui/icons-material';

// Import existing components
import ServiceCodeEditor from '../editor/ServiceCodeEditor';
import { SERVICE_TEMPLATES } from '../templates/ServiceTemplates';
import { cdsServiceEditorClient } from '../../../services/cdsServiceEditorClient';

// Import new v2 components (will be created)
import VisualWorkflowBuilder from './VisualWorkflowBuilder';
import ClinicalIntegrationPreview from './ClinicalIntegrationPreview';
import EnhancedTemplateGallery from './EnhancedTemplateGallery';
import ClinicalContextSimulator from './ClinicalContextSimulator';
import ServiceAnalytics from './ServiceAnalytics';
import CollaborationPanel from './CollaborationPanel';

// Builder modes
const BUILDER_MODES = {
  CODE: 'code',
  VISUAL: 'visual',
  HYBRID: 'hybrid'
};

// Perspective modes
const PERSPECTIVE_MODES = {
  PROVIDER: 'provider',    // Service developer perspective
  CONSUMER: 'consumer',    // EHR/Clinical user perspective
  DUAL: 'dual'            // Split view with both perspectives
};

// Main interface tabs
const INTERFACE_TABS = {
  BUILD: 0,           // Service building interface
  TEST: 1,            // Testing and simulation
  INTEGRATE: 2,       // Clinical integration preview
  ANALYZE: 3,         // Analytics and performance
  COLLABORATE: 4      // Collaboration and sharing
};

const ServiceBuilderV2 = ({
  initialServiceId = null,
  onServiceSave,
  onServiceTest,
  onClose
}) => {
  // Core state
  const [activeTab, setActiveTab] = useState(INTERFACE_TABS.BUILD);
  const [builderMode, setBuilderMode] = useState(BUILDER_MODES.CODE);
  const [perspectiveMode, setPerspectiveMode] = useState(PERSPECTIVE_MODES.PROVIDER);
  
  // Service state
  const [service, setService] = useState({
    id: '',
    metadata: {
      title: '',
      description: '',
      hook: 'patient-view',
      version: '2.0'
    },
    code: '',
    visualWorkflow: null,
    testResults: null,
    analytics: null
  });
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showTemplateGallery, setShowTemplateGallery] = useState(false);
  const [previewMode, setPreviewMode] = useState('desktop');
  
  // Advanced features state
  const [debugMode, setDebugMode] = useState(false);
  const [performanceMode, setPerformanceMode] = useState(false);
  const [collaborationEnabled, setCollaborationEnabled] = useState(false);
  const [realTimePreview, setRealTimePreview] = useState(true);

  // Load initial service
  useEffect(() => {
    if (initialServiceId) {
      loadService(initialServiceId);
    }
  }, [initialServiceId]);

  // Auto-save functionality
  useEffect(() => {
    if (unsavedChanges && service.id) {
      const saveTimer = setTimeout(() => {
        handleAutoSave();
      }, 30000); // Auto-save every 30 seconds

      return () => clearTimeout(saveTimer);
    }
  }, [unsavedChanges, service]);

  // Load service from backend
  const loadService = useCallback(async (serviceId) => {
    setLoading(true);
    try {
      const serviceData = await cdsServiceEditorClient.loadService(serviceId);
      setService(serviceData);
      setUnsavedChanges(false);
    } catch (err) {
      setError(`Failed to load service: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  // Save service
  const handleSave = useCallback(async () => {
    if (!service.metadata.title) {
      setError('Service title is required');
      return;
    }

    setLoading(true);
    try {
      const savedService = await cdsServiceEditorClient.saveService(service.id, service);
      setService(savedService);
      setUnsavedChanges(false);
      setSuccess('Service saved successfully');
      
      if (onServiceSave) {
        onServiceSave(savedService);
      }
    } catch (err) {
      setError(`Failed to save service: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [service, onServiceSave]);

  // Auto-save
  const handleAutoSave = useCallback(async () => {
    if (service.id && unsavedChanges) {
      try {
        await cdsServiceEditorClient.saveService(service.id, service);
        setUnsavedChanges(false);
        setSuccess('Auto-saved');
      } catch (err) {
        console.warn('Auto-save failed:', err);
      }
    }
  }, [service, unsavedChanges]);

  // Test service
  const handleTest = useCallback(async () => {
    if (!service.code && !service.visualWorkflow) {
      setError('No service logic to test');
      return;
    }

    setLoading(true);
    try {
      const testRequest = {
        hook: service.metadata.hook,
        hookInstance: `test-${Date.now()}`,
        fhirServer: window.location.origin + '/fhir/R4',
        context: { patientId: 'test-patient-123' },
        prefetch: {}
      };

      const result = await cdsServiceEditorClient.testService(
        service.code,
        service.metadata.hook,
        testRequest.context,
        testRequest.prefetch
      );

      setService(prev => ({
        ...prev,
        testResults: result
      }));

      if (onServiceTest) {
        onServiceTest(result);
      }

      setSuccess('Service tested successfully');
    } catch (err) {
      setError(`Test failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [service, onServiceTest]);

  // Export service
  const handleExport = useCallback(() => {
    cdsServiceEditorClient.exportService(service);
    setSuccess('Service exported');
  }, [service]);

  // Import service
  const handleImport = useCallback(async (file) => {
    try {
      const importedService = await cdsServiceEditorClient.importService(file);
      setService(importedService);
      setUnsavedChanges(true);
      setSuccess('Service imported successfully');
    } catch (err) {
      setError(`Import failed: ${err.message}`);
    }
  }, []);

  // Update service data
  const updateService = useCallback((updates) => {
    setService(prev => ({
      ...prev,
      ...updates
    }));
    setUnsavedChanges(true);
  }, []);

  // Render main toolbar
  const renderToolbar = () => (
    <AppBar position="static" color="default" elevation={0}>
      <Toolbar>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          CDS Service Builder v2
          {service.metadata.title && ` - ${service.metadata.title}`}
          {unsavedChanges && ' *'}
        </Typography>

        {/* Builder mode selector */}
        <FormControl size="small" sx={{ minWidth: 120, mr: 2 }}>
          <InputLabel>Mode</InputLabel>
          <Select
            value={builderMode}
            onChange={(e) => setBuilderMode(e.target.value)}
            label="Mode"
          >
            <MenuItem value={BUILDER_MODES.CODE}>Code</MenuItem>
            <MenuItem value={BUILDER_MODES.VISUAL}>Visual</MenuItem>
            <MenuItem value={BUILDER_MODES.HYBRID}>Hybrid</MenuItem>
          </Select>
        </FormControl>

        {/* Perspective selector */}
        <FormControl size="small" sx={{ minWidth: 120, mr: 2 }}>
          <InputLabel>Perspective</InputLabel>
          <Select
            value={perspectiveMode}
            onChange={(e) => setPerspectiveMode(e.target.value)}
            label="Perspective"
          >
            <MenuItem value={PERSPECTIVE_MODES.PROVIDER}>Provider</MenuItem>
            <MenuItem value={PERSPECTIVE_MODES.CONSUMER}>Consumer</MenuItem>
            <MenuItem value={PERSPECTIVE_MODES.DUAL}>Dual</MenuItem>
          </Select>
        </FormControl>

        {/* Action buttons */}
        <ButtonGroup size="small" sx={{ mr: 2 }}>
          <Tooltip title="Test service">
            <Button
              startIcon={<TestIcon />}
              onClick={handleTest}
              disabled={loading}
            >
              Test
            </Button>
          </Tooltip>
          <Tooltip title="Save service">
            <Button
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={loading}
              variant={unsavedChanges ? 'contained' : 'outlined'}
            >
              Save
            </Button>
          </Tooltip>
        </ButtonGroup>

        {/* Advanced options */}
        <ButtonGroup size="small">
          <Tooltip title="Templates">
            <IconButton onClick={() => setShowTemplateGallery(true)}>
              <TemplateIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Export">
            <IconButton onClick={handleExport}>
              <ExportIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Settings">
            <IconButton onClick={() => setShowSettings(true)}>
              <SettingsIcon />
            </IconButton>
          </Tooltip>
        </ButtonGroup>
      </Toolbar>
    </AppBar>
  );

  // Render main interface tabs
  const renderTabs = () => (
    <Tabs
      value={activeTab}
      onChange={(e, newValue) => setActiveTab(newValue)}
      variant="scrollable"
      scrollButtons="auto"
    >
      <Tab icon={<CodeIcon />} label="Build" />
      <Tab icon={<TestIcon />} label="Test" />
      <Tab icon={<IntegrationIcon />} label="Integrate" />
      <Tab icon={<AnalyticsIcon />} label="Analyze" />
      <Tab icon={<CollaborateIcon />} label="Collaborate" />
    </Tabs>
  );

  // Render build interface
  const renderBuildInterface = () => {
    switch (builderMode) {
      case BUILDER_MODES.VISUAL:
        return (
          <VisualWorkflowBuilder
            service={service}
            onServiceUpdate={updateService}
            perspectiveMode={perspectiveMode}
            debugMode={debugMode}
          />
        );
        
      case BUILDER_MODES.HYBRID:
        return (
          <Box sx={{ display: 'flex', height: '100%' }}>
            <Box sx={{ flex: 1, borderRight: 1, borderColor: 'divider' }}>
              <VisualWorkflowBuilder
                service={service}
                onServiceUpdate={updateService}
                perspectiveMode={perspectiveMode}
                debugMode={debugMode}
              />
            </Box>
            <Box sx={{ flex: 1 }}>
              <ServiceCodeEditor
                initialCode={service.code}
                metadata={service.metadata}
                onSave={(code, metadata) => updateService({ code, metadata })}
                onRun={handleTest}
                onValidate={cdsServiceEditorClient.validateCode}
              />
            </Box>
          </Box>
        );
        
      case BUILDER_MODES.CODE:
      default:
        return (
          <ServiceCodeEditor
            initialCode={service.code}
            metadata={service.metadata}
            onSave={(code, metadata) => updateService({ code, metadata })}
            onRun={handleTest}
            onValidate={cdsServiceEditorClient.validateCode}
          />
        );
    }
  };

  // Render content based on active tab
  const renderContent = () => {
    switch (activeTab) {
      case INTERFACE_TABS.BUILD:
        return renderBuildInterface();
        
      case INTERFACE_TABS.TEST:
        return (
          <ClinicalContextSimulator
            service={service}
            testResults={service.testResults}
            onTest={handleTest}
            perspectiveMode={perspectiveMode}
            realTimePreview={realTimePreview}
          />
        );
        
      case INTERFACE_TABS.INTEGRATE:
        return (
          <ClinicalIntegrationPreview
            service={service}
            perspectiveMode={perspectiveMode}
            previewMode={previewMode}
            onPreviewModeChange={setPreviewMode}
          />
        );
        
      case INTERFACE_TABS.ANALYZE:
        return (
          <ServiceAnalytics
            service={service}
            performanceMode={performanceMode}
            onAnalyticsUpdate={(analytics) => updateService({ analytics })}
          />
        );
        
      case INTERFACE_TABS.COLLABORATE:
        return (
          <CollaborationPanel
            service={service}
            collaborationEnabled={collaborationEnabled}
            onCollaborationToggle={setCollaborationEnabled}
          />
        );
        
      default:
        return null;
    }
  };

  // Render settings dialog
  const renderSettingsDialog = () => (
    <Dialog
      open={showSettings}
      onClose={() => setShowSettings(false)}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>Builder Settings</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <FormControlLabel
            control={
              <Switch
                checked={debugMode}
                onChange={(e) => setDebugMode(e.target.checked)}
              />
            }
            label="Debug Mode"
          />
          <FormControlLabel
            control={
              <Switch
                checked={performanceMode}
                onChange={(e) => setPerformanceMode(e.target.checked)}
              />
            }
            label="Performance Monitoring"
          />
          <FormControlLabel
            control={
              <Switch
                checked={realTimePreview}
                onChange={(e) => setRealTimePreview(e.target.checked)}
              />
            }
            label="Real-time Preview"
          />
          <FormControlLabel
            control={
              <Switch
                checked={collaborationEnabled}
                onChange={(e) => setCollaborationEnabled(e.target.checked)}
              />
            }
            label="Collaboration Features"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setShowSettings(false)}>Close</Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Main toolbar */}
      {renderToolbar()}
      
      {/* Interface tabs */}
      <Paper square sx={{ borderBottom: 1, borderColor: 'divider' }}>
        {renderTabs()}
      </Paper>

      {/* Main content area */}
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        {renderContent()}
      </Box>

      {/* Enhanced template gallery */}
      {showTemplateGallery && (
        <EnhancedTemplateGallery
          open={showTemplateGallery}
          onClose={() => setShowTemplateGallery(false)}
          onTemplateSelect={(template) => {
            updateService({
              code: template.template.code,
              metadata: { ...service.metadata, ...template.template.metadata }
            });
            setShowTemplateGallery(false);
          }}
          builderMode={builderMode}
          perspectiveMode={perspectiveMode}
        />
      )}

      {/* Settings dialog */}
      {renderSettingsDialog()}

      {/* Snackbar notifications */}
      <Snackbar
        open={!!success}
        autoHideDuration={4000}
        onClose={() => setSuccess(null)}
      >
        <Alert severity="success" onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
      >
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ServiceBuilderV2;