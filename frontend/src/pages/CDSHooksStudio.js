/**
 * CDS Hooks Studio - Redesigned Visual Builder for Clinical Decision Support
 * 
 * Features:
 * - Three-mode interface: Learn, Build, Manage
 * - Visual drag-and-drop condition builder
 * - Real-time card preview
 * - Comprehensive template library
 * - Advanced testing and validation
 */

import React, { useState, useEffect, useCallback, createContext, useContext, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
  Button,
  Grid,
  Card,
  CardContent,
  IconButton,
  Tooltip,
  Alert,
  Divider,
  Chip,
  Stack,
  Badge,
  Fab,
  Snackbar,
  CircularProgress
} from '@mui/material';
import {
  School as LearnIcon,
  Build as BuildIcon,
  Dashboard as ManageIcon,
  PlayArrow as PlayIcon,
  Save as SaveIcon,
  Add as AddIcon,
  Help as HelpIcon,
  Visibility as PreviewIcon,
  Code as CodeIcon,
  BugReport as TestIcon,
  Analytics as AnalyticsIcon,
  Group as TeamIcon,
  History as HistoryIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Error as ErrorIcon
} from '@mui/icons-material';

// Import child components
import CDSLearnMode from '../components/cds-studio/learn/CDSLearnMode';
import { CDSBuildMode, CDSBuildModeImproved } from '../components/cds-studio/build/CDSBuildModeWrapper';
import CDSManageMode from '../components/cds-studio/manage/CDSManageMode';

// Import error boundary and loading states
import CDSErrorBoundary from '../components/cds-studio/shared/CDSErrorBoundary';
import { CDSSaveLoading, CDSLoadingOverlay } from '../components/cds-studio/shared/CDSLoadingStates';

// Import services
import { cdsHooksService } from '../services/cdsHooksService';

// Create context for CDS Studio state management
export const CDSStudioContext = createContext(null);

// Context provider component
export const CDSStudioProvider = ({ children, onModeSwitch, onHookChange }) => {
  const [currentHook, setCurrentHook] = useState({
    id: '',
    title: '',
    description: '',
    hook: 'patient-view',
    conditions: [],
    cards: [],
    prefetch: {},
    _meta: {
      created: null, // null means this is a new hook
      modified: new Date(),
      version: 0, // 0 means this is a new hook
      author: 'Current User'
    }
  });

  const [validation, setValidation] = useState({
    errors: [],
    warnings: [],
    isValid: true
  });

  const [testResults, setTestResults] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveStatus, setSaveStatus] = useState({ open: false, message: '', severity: 'success' });
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  // Generate hook ID from title
  const generateHookId = useCallback((title) => {
    if (!title || typeof title !== 'string') return '';
    
    // Convert title to kebab-case ID
    return title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
  }, []);

  // Hook management functions
  const updateHook = useCallback((updates) => {
    setCurrentHook(prev => {
      const updated = { ...prev, ...updates };
      
      // Auto-generate ID from title if title changed and no existing ID
      if (updates.title && (!prev.id || prev.id === generateHookId(prev.title))) {
        updated.id = generateHookId(updates.title);
      }
      
      const newHook = {
        ...updated,
        _meta: {
          ...prev._meta,
          modified: new Date()
        }
      };
      
      // Notify parent of hook changes
      if (onHookChange) {
        onHookChange(newHook);
      }
      
      return newHook;
    });
  }, [generateHookId, onHookChange]);

  const validateHook = useCallback(() => {
    try {
      const errors = [];
      const warnings = [];

      // Safety check for currentHook
      if (!currentHook || typeof currentHook !== 'object') {
        errors.push('Invalid hook data');
        const validationResult = { errors, warnings, isValid: false };
        setValidation(validationResult);
        return validationResult;
      }

      // Check if we can auto-generate ID from title
      let hookId = currentHook.id;
      if ((!hookId || !hookId.trim()) && currentHook.title) {
        hookId = generateHookId(currentHook.title);
      }
      
      // Required fields validation - ID will be auto-generated from title
      if (!hookId || !hookId.trim()) {
        errors.push('Hook title is required (used to generate Hook ID)');
      }
      if (!currentHook.title || !currentHook.title.trim()) {
        errors.push('Hook title is required');
      }
      if (!currentHook.hook) {
        errors.push('Hook type is required');
      }
      
      // Cards validation - more lenient
      if (!currentHook.cards || !Array.isArray(currentHook.cards) || currentHook.cards.length === 0) {
        errors.push('At least one card is required');
      } else {
        // Validate each card
        currentHook.cards.forEach((card, index) => {
          if (!card || typeof card !== 'object') {
            errors.push(`Card ${index + 1}: Invalid card data`);
            return;
          }
          if (!card.summary || !card.summary.trim()) {
            errors.push(`Card ${index + 1}: Summary is required`);
          }
          // Don't require indicator - just warn
          if (!card.indicator) {
            warnings.push(`Card ${index + 1}: No severity indicator specified (will default to 'info')`);
          }
        });
      }

      // Conditions validation - make completely optional and more lenient
      if (currentHook.conditions && Array.isArray(currentHook.conditions) && currentHook.conditions.length > 0) {
        currentHook.conditions.forEach((condition, index) => {
          if (!condition || typeof condition !== 'object') {
            errors.push(`Condition ${index + 1}: Invalid condition data`);
            return;
          }
          
          // Only validate if condition has data - be more lenient
          if (condition.type || condition.operator || condition.value !== undefined) {
            if (!condition.type) {
              errors.push(`Condition ${index + 1}: Condition type is required`);
            }
            if (!condition.operator) {
              errors.push(`Condition ${index + 1}: Operator is required`);
            }
            if (condition.value === undefined || condition.value === '' || condition.value === null) {
              errors.push(`Condition ${index + 1}: Value is required`);
            }
          }
        });
      } else {
        // Only warn if there are no conditions at all
        warnings.push('No conditions defined - hook will always trigger');
      }

      const isValid = errors.length === 0;
      const validationResult = { errors, warnings, isValid };
      setValidation(validationResult);
      
      return validationResult;
    } catch (error) {
      console.error('Validation error:', error);
      const validationResult = { errors: ['Validation failed due to internal error'], warnings: [], isValid: false };
      setValidation(validationResult);
      return validationResult;
    }
  }, [currentHook, generateHookId]);

  const testHook = useCallback(async (patientId) => {
    const validationResult = validateHook();
    if (!validationResult.isValid) {
      return { success: false, error: 'Validation failed' };
    }

    try {
      const result = await cdsHooksService.testHook(currentHook, { patientId });
      setTestResults(result);
      return { success: true, result };
    } catch (error) {
      console.error('Test hook failed:', error);
      return { success: false, error: error.message };
    }
  }, [currentHook, validateHook]);

  const saveHook = useCallback(async () => {
    // console.log('Save hook called, current hook:', currentHook);
    
    // Run validation and get fresh results
    const validationResult = validateHook();
    
    // console.log('Validation result:', validationResult);
    
    // Check validation results directly from the function return
    if (!validationResult.isValid) {
      const errorCount = validationResult.errors.length;
      const warningCount = validationResult.warnings.length;
      
      // console.log('Validation failed with:', { errorCount, warningCount, errors: validationResult.errors, warnings: validationResult.warnings });
      
      let message;
      if (errorCount > 0) {
        message = `Cannot save: ${errorCount} error${errorCount !== 1 ? 's' : ''} found.`;
        if (warningCount > 0) {
          message += ` Also ${warningCount} warning${warningCount !== 1 ? 's' : ''} found.`;
        }
        message += '\n\nErrors:\n• ' + validationResult.errors.join('\n• ');
      } else {
        message = 'Cannot save: Validation failed but no specific errors found. Please check your hook data.';
      }
      
      setSaveStatus({
        open: true,
        message,
        severity: 'error'
      });
      return false;
    }

    // Check for required fields with better error messages
    if (!currentHook.id?.trim()) {
      setSaveStatus({
        open: true,
        message: 'Hook ID is required and cannot be empty',
        severity: 'error'
      });
      return false;
    }

    if (!currentHook.title?.trim()) {
      setSaveStatus({
        open: true,
        message: 'Hook title is required and cannot be empty',
        severity: 'error'
      });
      return false;
    }

    setIsSaving(true);
    setSaveProgress(0);
    setSaveMessage('Preparing hook data...');
    
    try {
      // Step 1: Prepare data (20%)
      setSaveProgress(20);
      setSaveMessage('Preparing hook data...');
      
      // Auto-generate ID if missing
      let hookId = currentHook.id;
      if (!hookId || !hookId.trim()) {
        if (currentHook.title) {
          hookId = generateHookId(currentHook.title);
          // Update the current hook with the generated ID
          setCurrentHook(prev => ({ ...prev, id: hookId }));
        }
      }
      
      setSaveMessage('Validating hook data...');
      
      // Create a safe copy of the hook data for saving
      const hookDataToSave = {
        ...currentHook,
        // Ensure ID is set
        id: hookId,
        // Ensure required fields have valid defaults
        enabled: currentHook.enabled !== false, // Default to true if undefined
        conditions: currentHook.conditions || [],
        cards: currentHook.cards || [],
        prefetch: currentHook.prefetch || {},
        // Update metadata
        _meta: {
          ...currentHook._meta,
          modified: new Date(),
          version: (currentHook._meta?.version || 0) + 1
        }
      };

      // Step 2: Send to server (50%)
      setSaveProgress(50);
      
      // Determine if this is an update or create based on metadata, not just ID existence
      // A hook is considered existing if it has both an ID and a created timestamp
      const isExistingHook = currentHook._meta?.created && currentHook._meta?.version > 0;
      setSaveMessage(isExistingHook ? 'Updating hook...' : 'Creating hook...');
      
      let result;
      
      if (isExistingHook) {
        // This is an existing hook being updated
        // console.log('Updating existing hook:', currentHook.id);
        result = await cdsHooksService.updateHook(currentHook.id, hookDataToSave);
      } else {
        // This is a new hook being created (even if it has an auto-generated ID)
        // console.log('Creating new hook:', hookDataToSave.id);
        result = await cdsHooksService.createHook(hookDataToSave);
      }

      // Step 3: Process response (80%)
      setSaveProgress(80);
      setSaveMessage('Processing response...');
      
      // Update the current hook with the response data
      if (result?.data) {
        if (!isExistingHook) {
          // This was a create operation - mark as created
          setCurrentHook(prev => ({ 
            ...prev, 
            ...result.data,
            _meta: {
              ...prev._meta,
              created: new Date(),
              modified: new Date(),
              version: 1
            }
          }));
        } else {
          // This was an update operation - just update modified time and version
          setCurrentHook(prev => ({ 
            ...prev, 
            ...result.data,
            _meta: {
              ...prev._meta,
              modified: new Date(),
              version: (prev._meta?.version || 0) + 1
            }
          }));
        }
      }

      // Step 4: Complete (100%)
      setSaveProgress(100);
      setSaveMessage('Save completed!');

      setSaveStatus({
        open: true,
        message: `Hook ${isExistingHook ? 'updated' : 'created'} successfully!`,
        severity: 'success'
      });
      
      // console.log('Save successful:', result);
      return true;
      
    } catch (error) {
      console.error('Save failed:', error);
      
      // Enhanced error handling with specific error types
      let errorMessage = 'Save failed: ';
      
      if (error.name === 'ValidationError' || error.message?.includes('Validation')) {
        errorMessage += `Data validation error - ${error.message}`;
      } else if (error.message?.includes('409') || error.message?.includes('already exists')) {
        errorMessage += `Hook ID "${currentHook.id}" already exists. Please choose a different ID.`;
      } else if (error.message?.includes('400') || error.message?.includes('Bad Request')) {
        errorMessage += `Invalid data format - ${error.message}`;
      } else if (error.message?.includes('404')) {
        errorMessage += `Hook not found. It may have been deleted by another user.`;
      } else if (error.message?.includes('fetch') || error.message?.includes('network')) {
        errorMessage += 'Network error. Please check your connection and try again.';
      } else {
        errorMessage += error.message || 'Unknown error occurred';
      }
      
      setSaveStatus({
        open: true,
        message: errorMessage,
        severity: 'error'
      });
      
      return false;
    } finally {
      setIsSaving(false);
      setSaveProgress(0);
      setSaveMessage('');
    }
  }, [currentHook, validateHook]);

  const value = {
    currentHook,
    validation,
    testResults,
    isSaving,
    saveProgress,
    saveMessage,
    isLoading,
    loadingMessage,
    actions: {
      updateHook,
      validateHook,
      testHook,
      saveHook,
      setCurrentHook: (hook) => {
        setCurrentHook(hook);
        if (onHookChange) {
          onHookChange(hook);
        }
      },
      setIsLoading,
      setLoadingMessage,
      switchMode: onModeSwitch
    }
  };

  return (
    <CDSStudioContext.Provider value={value}>
      {children}
      
      {/* Save Loading Indicator */}
      <CDSSaveLoading 
        isVisible={isSaving}
        progress={saveProgress}
        message={saveMessage}
      />
      
      {/* General Loading Overlay */}
      <CDSLoadingOverlay 
        open={isLoading}
        message={loadingMessage}
      />
      
      {/* Save Status Snackbar */}
      <Snackbar
        open={saveStatus.open}
        autoHideDuration={6000}
        onClose={() => setSaveStatus(prev => ({ ...prev, open: false }))}
      >
        <Alert severity={saveStatus.severity} onClose={() => setSaveStatus(prev => ({ ...prev, open: false }))}>
          {saveStatus.message}
        </Alert>
      </Snackbar>
    </CDSStudioContext.Provider>
  );
};

// Hook to use CDS Studio context
export const useCDSStudio = () => {
  const context = useContext(CDSStudioContext);
  if (!context) {
    throw new Error('useCDSStudio must be used within CDSStudioProvider');
  }
  return context;
};

// Build Mode component with error handling
const BuildModeWithErrorHandling = ({ pendingEditHook, onPendingHookProcessed }) => {
  const { actions } = useCDSStudio();
  
  // Handle pending edit hook when component mounts or pendingEditHook changes
  useEffect(() => {
    console.log('[BuildModeWithErrorHandling] pendingEditHook:', pendingEditHook);
    if (pendingEditHook) {
      console.log('[BuildModeWithErrorHandling] Setting current hook in context');
      actions.setCurrentHook(pendingEditHook);
      onPendingHookProcessed();
    }
  }, [pendingEditHook, actions, onPendingHookProcessed]);
  
  const handleReset = useCallback(() => {
    actions.setCurrentHook({
      id: '',
      title: '',
      description: '',
      hook: 'patient-view',
      conditions: [],
      cards: [],
      prefetch: {},
      _meta: {
        created: null, // null means this is a new hook
        modified: new Date(),
        version: 0, // 0 means this is a new hook
        author: 'Current User'
      }
    });
  }, [actions]);

  // Expose reset function globally for error boundary
  useEffect(() => {
    window.resetCDSBuildMode = handleReset;
    return () => {
      delete window.resetCDSBuildMode;
    };
  }, [handleReset]);

  return <CDSBuildMode />;
};

// Save Button component
const SaveButton = () => {
  const { actions } = useCDSStudio();
  
  return (
    <Fab
      color="primary"
      sx={{ position: 'fixed', bottom: 24, right: 24 }}
      onClick={() => actions.saveHook()}
    >
      <SaveIcon />
    </Fab>
  );
};

// Main CDS Hooks Studio component
function CDSHooksStudio() {
  const [currentMode, setCurrentMode] = useState('build'); // learn, build, manage
  const [showHelp, setShowHelp] = useState(false);
  const [pendingEditHook, setPendingEditHook] = useState(null);
  const contextActionsRef = useRef(null);

  // Create a function to handle mode switching that can be passed to children
  const handleModeSwitch = (mode) => {
    setCurrentMode(mode);
  };
  
  // Handle hook changes from the provider
  const handleHookChange = useCallback((hook) => {
    // Store the context actions when they become available
    if (contextActionsRef.current) {
      contextActionsRef.current.setCurrentHook(hook);
    }
  }, []);
  
  // Hook reset function for error recovery
  const resetCurrentHook = useCallback(() => {
    // This will be passed to the provider
    return {
      id: '',
      title: '',
      description: '',
      hook: 'patient-view',
      conditions: [],
      cards: [],
      prefetch: {},
      _meta: {
        created: null, // null means this is a new hook
        modified: new Date(),
        version: 0, // 0 means this is a new hook
        author: 'Current User'
      }
    };
  }, []);

  // Mode descriptions
  const modeDescriptions = {
    learn: 'Interactive tutorials and examples to master CDS Hooks',
    build: 'Visual tools to create and test clinical decision support rules',
    manage: 'Organize, analyze, and collaborate on your CDS hooks'
  };

  return (
    <CDSStudioProvider onModeSwitch={handleModeSwitch} onHookChange={handleHookChange}>
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Paper sx={{ p: 2, mb: 2 }}>
          <Grid container alignItems="center" spacing={2}>
            <Grid item xs>
              <Typography variant="h4" component="h1">
                CDS Hooks Studio
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {modeDescriptions[currentMode]}
              </Typography>
            </Grid>
            <Grid item>
              <Stack direction="row" spacing={1}>
                <Tooltip title="Help & Documentation">
                  <IconButton onClick={() => setShowHelp(!showHelp)}>
                    <HelpIcon />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Grid>
          </Grid>

          {/* Mode Selector */}
          <Tabs 
            value={currentMode} 
            onChange={(e, value) => setCurrentMode(value)}
            sx={{ mt: 2 }}
          >
            <Tab 
              label="Learn" 
              value="learn" 
              icon={<LearnIcon />}
              iconPosition="start"
            />
            <Tab 
              label="Build" 
              value="build" 
              icon={<BuildIcon />}
              iconPosition="start"
            />
            <Tab 
              label="Manage" 
              value="manage" 
              icon={<ManageIcon />}
              iconPosition="start"
            />
          </Tabs>
        </Paper>

        {/* Help Panel */}
        {showHelp && (
          <Alert severity="info" sx={{ mb: 2 }} onClose={() => setShowHelp(false)}>
            <Typography variant="subtitle2" gutterBottom>
              CDS Hooks Studio Help
            </Typography>
            <Typography variant="body2">
              • <strong>Learn Mode</strong>: Start here if you're new to CDS Hooks. Interactive tutorials will guide you through concepts and best practices.
              <br />
              • <strong>Build Mode</strong>: Create new hooks using our visual builder. Drag and drop conditions, design cards, and test in real-time.
              <br />
              • <strong>Manage Mode</strong>: View all your hooks, analyze performance, manage versions, and collaborate with your team.
            </Typography>
          </Alert>
        )}

        {/* Content Area with Error Boundaries */}
        <Box sx={{ flexGrow: 1, overflow: 'auto', position: 'relative' }}>
          {currentMode === 'learn' && (
            <CDSErrorBoundary 
              componentName="Learn Mode"
              onRetry={() => window.location.reload()}
              onReset={() => setCurrentMode('build')}
            >
              <CDSLearnMode />
            </CDSErrorBoundary>
          )}
          {currentMode === 'build' && (
            <CDSErrorBoundary 
              componentName="Build Mode"
              onRetry={() => window.location.reload()}
              onReset={() => {
                if (window.resetCDSBuildMode) {
                  window.resetCDSBuildMode();
                }
              }}
            >
              <BuildModeWithErrorHandling 
                pendingEditHook={pendingEditHook}
                onPendingHookProcessed={() => setPendingEditHook(null)}
              />
            </CDSErrorBoundary>
          )}
          {currentMode === 'manage' && (
            <CDSErrorBoundary 
              componentName="Manage Mode"
              onRetry={() => window.location.reload()}
              onReset={() => setCurrentMode('build')}
            >
              <CDSManageMode 
                onEditService={(serviceOrHook) => {
                  console.log('[CDSHooksStudio] Edit service called with:', serviceOrHook);
                  // Set the current hook in context for editing
                  if (serviceOrHook) {
                    // Transform service to hook format if needed
                    const hook = serviceOrHook.conditions !== undefined 
                      ? serviceOrHook  // It's already a hook
                      : {
                          ...serviceOrHook,
                          conditions: [],
                          actions: [],
                          cards: [],
                          enabled: true,
                          _meta: {
                            isExternalService: true,
                            created: new Date().toISOString(),
                            modified: new Date().toISOString()
                          }
                        };
                    console.log('[CDSHooksStudio] Setting pending edit hook:', hook);
                    // Store the hook to be edited
                    setPendingEditHook(hook);
                    // Switch to build mode
                    setCurrentMode('build');
                  }
                }}
              />
            </CDSErrorBoundary>
          )}
        </Box>
      </Box>
    </CDSStudioProvider>
  );
}

export default CDSHooksStudio;