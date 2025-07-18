/**
 * UI Composer Main Component
 * Main entry point for the Clinical UI Composer module
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Button,
  Alert,
  Divider,
  Fab,
  Zoom,
  IconButton,
  Tooltip,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  AppBar,
  Toolbar,
  Collapse,
  Chip,
  CircularProgress,
  Stack
} from '@mui/material';
import {
  AutoAwesome as AutoAwesomeIcon,
  Settings as SettingsIcon,
  Save as SaveIcon,
  Folder as FolderIcon,
  Close as CloseIcon,
  Dashboard as DashboardIcon,
  Code as CodeIcon,
  Timeline as TimelineIcon,
  Feedback as FeedbackIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon
} from '@mui/icons-material';
import { UIComposerProvider, useUIComposer } from './contexts/UIComposerContext';
import NaturalLanguageInput from './components/NaturalLanguageInput';
import PreviewCanvas from './components/PreviewCanvas';
import FeedbackInterface from './components/FeedbackInterface';
import DashboardManager from './components/DashboardManager';
import MethodSelector from './components/MethodSelector';
import SimpleOrchestrator from './agents/SimpleOrchestrator';
import componentRegistry from './utils/componentRegistry';
import useClaudeStatus from './hooks/useClaudeStatus';
import CostDisplay from './components/CostDisplay';
import TestFHIRIntegration from './components/TestFHIRIntegration';
import CreativeGenerationOptions from './components/CreativeGenerationOptions';
import CostEstimator from './components/CostEstimator';
import GenerationProgressIndicator from './components/GenerationProgressIndicator';

const STEPS = [
  {
    label: 'Describe',
    description: 'Tell us what you want to create in natural language'
  },
  {
    label: 'Generate',
    description: 'AI agents design and build your interface'
  },
  {
    label: 'Review',
    description: 'Preview and provide feedback for improvements'
  },
  {
    label: 'Save',
    description: 'Save your dashboard for future use'
  }
];

const UIComposerMain = () => {
  return (
    <UIComposerProvider>
      <UIComposerContent />
    </UIComposerProvider>
  );
};

const UIComposerContent = () => {
  const claudeStatus = useClaudeStatus();
  const {
    currentRequest,
    currentSpec,
    generationStatus,
    isLoading,
    hasErrors,
    setGenerationStatus,
    setCurrentSpec,
    addConversationEntry,
    setError,
    clearError
  } = useUIComposer();
  
  const [activeStep, setActiveStep] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [orchestrator] = useState(() => new SimpleOrchestrator());
  const [processingRequest, setProcessingRequest] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState('cli'); // Default to CLI mode for testing
  const [feedbackPanelOpen, setFeedbackPanelOpen] = useState(false); // Collapsed by default
  const [selectedModel, setSelectedModel] = useState('claude-sonnet-4-20250514'); // Default to Sonnet 4
  const [sessionCost, setSessionCost] = useState(null);
  const [costLoading, setCostLoading] = useState(false);
  const [generationMode, setGenerationMode] = useState('mixed'); // Default to mixed mode
  const [showCostEstimator, setShowCostEstimator] = useState(false);
  
  // Set up orchestrator listeners
  useEffect(() => {
    const unsubscribe = orchestrator.addListener((event, data) => {
      switch (event) {
        case 'phase_change':
          setGenerationStatus(data.phase, data.progress, data.message);
          break;
        case 'agent_start':
          addConversationEntry({
            type: 'agent_status',
            agent: data.agent,
            status: 'started',
            message: data.message
          });
          break;
        case 'agent_complete':
          addConversationEntry({
            type: 'agent_status',
            agent: data.agent,
            status: 'completed',
            result: data.result
          });
          break;
        case 'error':
          setError('agents', data.error);
          setGenerationStatus('error', 0, data.error);
          break;
        default:
          console.warn(`Unhandled orchestrator event: ${event}`);
          break;
      }
    });
    
    return unsubscribe;
  }, [orchestrator, setGenerationStatus, addConversationEntry, setError]);
  
  // Process request when it changes
  useEffect(() => {
    if (currentRequest && !processingRequest && !showCostEstimator) {
      // Show cost estimator first for SDK method or if user wants to see costs
      if (selectedMethod === 'sdk' || selectedMethod === 'cli') {
        setShowCostEstimator(true);
        setActiveStep(1.5); // Between describe and generate
      } else {
        processRequest();
      }
    }
  }, [currentRequest]); // Remove processingRequest from dependencies to avoid re-triggering
  
  // Process user request through agent orchestrator
  const processRequest = useCallback(async () => {
    if (!currentRequest || processingRequest) return;
    
    setProcessingRequest(true);
    clearError('agents');
    
    try {
      setActiveStep(1); // Move to generate step
      
      const result = await orchestrator.processRequest(currentRequest, {
        // Add any relevant context
        userRole: 'clinician',
        clinicalSetting: 'general practice',
        method: selectedMethod,
        model: selectedModel,
        generationMode: generationMode
      });
      
      if (result.success) {
        setCurrentSpec(result.specification);
        setActiveStep(2); // Move to review step
        
        addConversationEntry({
          type: 'generation_complete',
          specification: result.specification,
          components: result.components
        });
      } else {
        setError('agents', result.error);
        setGenerationStatus('error', 0, result.error);
      }
    } catch (error) {
      setError('agents', error.message);
      setGenerationStatus('error', 0, error.message);
    } finally {
      setProcessingRequest(false);
    }
  }, [currentRequest, processingRequest, orchestrator, setCurrentSpec, addConversationEntry, setError, clearError, setGenerationStatus]);
  
  // Handle cost estimator proceed
  const handleCostEstimatorProceed = useCallback(async () => {
    setShowCostEstimator(false);
    await processRequest();
  }, [processRequest]);
  
  // Handle cost estimator cancel
  const handleCostEstimatorCancel = useCallback(() => {
    setShowCostEstimator(false);
    setActiveStep(0); // Go back to describe step
  }, []);
  
  // Handle step changes
  const handleStepChange = useCallback((step) => {
    setActiveStep(step);
  }, []);
  
  // Handle next step
  const handleNext = useCallback(() => {
    if (activeStep < STEPS.length - 1) {
      setActiveStep(activeStep + 1);
    }
  }, [activeStep]);
  
  // Handle back step
  const handleBack = useCallback(() => {
    if (activeStep > 0) {
      setActiveStep(activeStep - 1);
    }
  }, [activeStep]);
  
  // Handle save
  const handleSave = useCallback(() => {
    if (currentSpec) {
      // Save logic will be implemented in DashboardManager
      setActiveStep(3);
    }
  }, [currentSpec]);
  
  // Determine current step based on state
  useEffect(() => {
    if (!currentRequest) {
      setActiveStep(0);
    } else if (currentRequest && showCostEstimator) {
      setActiveStep(1); // Show cost estimator
    } else if (currentRequest && !currentSpec && !isLoading) {
      setActiveStep(1);
    } else if (currentSpec && !isLoading) {
      setActiveStep(2);
    }
  }, [currentRequest, currentSpec, isLoading, showCostEstimator]);
  
  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Claude Status Banner */}
      {!claudeStatus.available && !claudeStatus.checking && (
        <Alert 
          severity="info" 
          sx={{ borderRadius: 0 }}
          action={
            <Box>
              <Button color="inherit" size="small" onClick={() => setSidebarOpen(true)}>
                Configure
              </Button>
              <Button color="inherit" size="small" onClick={claudeStatus.checkClaude}>
                Retry
              </Button>
            </Box>
          }
        >
          No Claude authentication methods are currently available. Using development mode. 
          Click Configure to set up Claude integration.
        </Alert>
      )}
      
      {/* Header */}
      <AppBar position="static" elevation={1}>
        <Toolbar>
          <DashboardIcon sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Clinical UI Composer
          </Typography>
          {claudeStatus.available && (
            <Tooltip title="Claude Code is connected">
              <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
                <Box 
                  sx={{ 
                    width: 8, 
                    height: 8, 
                    borderRadius: '50%', 
                    bgcolor: 'success.main',
                    mr: 1
                  }} 
                />
                <Typography variant="body2">Claude Ready</Typography>
              </Box>
            </Tooltip>
          )}
          {/* Cost Display */}
          {selectedMethod === 'sdk' && (
            <CostDisplay 
              sessionId={orchestrator.sessionId || null}
              loading={costLoading}
              onCostUpdate={setSessionCost}
            />
          )}
          <Typography variant="body2" sx={{ mr: 2 }}>
            Experimental Feature
          </Typography>
          <Tooltip title="Settings">
            <IconButton
              color="inherit"
              onClick={() => setSidebarOpen(true)}
            >
              <SettingsIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>
      
      {/* Main Content */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left Panel - Process Steps */}
        <Paper 
          elevation={2} 
          sx={{ 
            width: 400, 
            flexShrink: 0, 
            borderRadius: 0,
            overflow: 'auto'
          }}
        >
          <Box sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Creation Process
            </Typography>
            
            <Stepper activeStep={activeStep} orientation="vertical">
              {STEPS.map((step, index) => (
                <Step key={step.label}>
                  <StepLabel
                    onClick={() => handleStepChange(index)}
                    sx={{ cursor: 'pointer' }}
                  >
                    {step.label}
                  </StepLabel>
                  <StepContent>
                    <Typography variant="body2" color="text.secondary">
                      {step.description}
                    </Typography>
                    
                    {/* Step Content */}
                    {index === 0 && (
                      <Box sx={{ mt: 2 }}>
                        <NaturalLanguageInput />
                        {currentRequest && (
                          <Button
                            variant="contained"
                            onClick={handleNext}
                            sx={{ mt: 2 }}
                            startIcon={<AutoAwesomeIcon />}
                          >
                            Generate UI
                          </Button>
                        )}
                      </Box>
                    )}
                    
                    {index === 1 && (
                      <Box sx={{ mt: 2 }}>
                        {isLoading ? (
                          <GenerationProgressIndicator
                            phase={generationStatus.phase}
                            progress={generationStatus.progress}
                            message={generationStatus.message}
                            isLoading={isLoading}
                            selectedMethod={selectedMethod}
                            selectedModel={selectedModel}
                            generationMode={generationMode}
                          />
                        ) : currentSpec ? (
                          <Alert severity="success">
                            UI generated successfully! Review it in the preview panel.
                          </Alert>
                        ) : hasErrors ? (
                          <Alert severity="error">
                            Generation failed. Please try again.
                          </Alert>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            Waiting for request...
                          </Typography>
                        )}
                      </Box>
                    )}
                    
                    {/* Cost Estimator Step */}
                    {index === 1 && showCostEstimator && (
                      <Box sx={{ mt: 2 }}>
                        <CostEstimator
                          request={currentRequest}
                          selectedMethod={selectedMethod}
                          selectedModel={selectedModel}
                          generationMode={generationMode}
                          onProceed={handleCostEstimatorProceed}
                          onCancel={handleCostEstimatorCancel}
                        />
                      </Box>
                    )}
                    
                    {index === 2 && (
                      <Box sx={{ mt: 2 }}>
                        {currentSpec ? (
                          <Box>
                            <Typography variant="body2" gutterBottom>
                              Review your generated UI and provide feedback for improvements.
                            </Typography>
                            <Button
                              variant="outlined"
                              onClick={handleSave}
                              sx={{ mt: 1 }}
                              startIcon={<SaveIcon />}
                            >
                              Save Dashboard
                            </Button>
                          </Box>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            No UI generated yet
                          </Typography>
                        )}
                      </Box>
                    )}
                    
                    {index === 3 && (
                      <Box sx={{ mt: 2 }}>
                        <DashboardManager />
                      </Box>
                    )}
                  </StepContent>
                </Step>
              ))}
            </Stepper>
          </Box>
        </Paper>
        
        {/* Right Panel - Preview and Feedback */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Preview Canvas */}
          <Box sx={{ flex: 1, p: 2, overflow: 'auto' }}>
            <PreviewCanvas />
          </Box>
          
          {/* Feedback Interface - Collapsible */}
          {currentSpec && (
            <>
              {/* Feedback Toggle Button */}
              <Box 
                sx={{ 
                  borderTop: 1, 
                  borderColor: 'divider',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  p: 1,
                  bgcolor: 'background.paper',
                  cursor: 'pointer'
                }}
                onClick={() => setFeedbackPanelOpen(!feedbackPanelOpen)}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <IconButton size="small">
                    {feedbackPanelOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </IconButton>
                  <Typography variant="subtitle2">
                    Feedback & Refinement
                  </Typography>
                </Box>
                <Tooltip title={feedbackPanelOpen ? "Collapse panel" : "Expand to provide feedback"}>
                  <Chip 
                    label={feedbackPanelOpen ? "Hide" : "Show"} 
                    size="small" 
                    color="primary"
                    variant="outlined"
                  />
                </Tooltip>
              </Box>
              
              {/* Collapsible Feedback Panel */}
              <Collapse in={feedbackPanelOpen}>
                <Box sx={{ borderTop: 1, borderColor: 'divider' }}>
                  <FeedbackInterface />
                </Box>
              </Collapse>
            </>
          )}
        </Box>
      </Box>
      
      {/* Sidebar */}
      <Drawer
        anchor="right"
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      >
        <Box sx={{ width: 300 }}>
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">
              UI Composer Settings
            </Typography>
            <IconButton onClick={() => setSidebarOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
          
          <Divider />
          
          {/* Method Selector */}
          <Box sx={{ p: 2 }}>
            <MethodSelector
              selectedMethod={selectedMethod}
              onMethodChange={setSelectedMethod}
              methodStatus={claudeStatus.methodStatus}
              disabled={processingRequest}
              selectedModel={selectedModel}
              onModelChange={setSelectedModel}
            />
          </Box>
          
          <Divider />
          
          {/* Creative Generation Options */}
          <Box sx={{ p: 2 }}>
            <CreativeGenerationOptions
              value={generationMode}
              onChange={setGenerationMode}
              disabled={processingRequest}
            />
          </Box>
          
          <Divider />
          
          {/* Temporary FHIR Test */}
          <Box sx={{ p: 2 }}>
            <TestFHIRIntegration 
              selectedMethod={selectedMethod}
              selectedModel={selectedModel}
            />
          </Box>
          
          <Divider />
          
          <List>
            <ListItem disablePadding>
              <ListItemButton>
                <ListItemIcon>
                  <CodeIcon />
                </ListItemIcon>
                <ListItemText 
                  primary="Debug Mode"
                  secondary="Show component details"
                />
              </ListItemButton>
            </ListItem>
            
            <ListItem disablePadding>
              <ListItemButton>
                <ListItemIcon>
                  <TimelineIcon />
                </ListItemIcon>
                <ListItemText 
                  primary="Generation History"
                  secondary="View past generations"
                />
              </ListItemButton>
            </ListItem>
            
            <ListItem disablePadding>
              <ListItemButton>
                <ListItemIcon>
                  <FolderIcon />
                </ListItemIcon>
                <ListItemText 
                  primary="Saved Dashboards"
                  secondary="Manage saved UIs"
                />
              </ListItemButton>
            </ListItem>
            
            <ListItem disablePadding>
              <ListItemButton>
                <ListItemIcon>
                  <FeedbackIcon />
                </ListItemIcon>
                <ListItemText 
                  primary="Export Feedback"
                  secondary="Share your experience"
                />
              </ListItemButton>
            </ListItem>
          </List>
        </Box>
      </Drawer>
      
      {/* Floating Action Button */}
      <Zoom in={activeStep === 0}>
        <Fab
          color="primary"
          aria-label="generate"
          sx={{
            position: 'fixed',
            bottom: 16,
            right: 16,
          }}
          onClick={() => document.querySelector('textarea')?.focus()}
        >
          <AutoAwesomeIcon />
        </Fab>
      </Zoom>
    </Box>
  );
};

export default UIComposerMain;