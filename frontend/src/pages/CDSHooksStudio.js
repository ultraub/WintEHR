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
  Transform as TransformIcon,
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
// CDSBuildMode components replaced with ServiceBuilderV2
import CDSManageMode from '../components/cds-studio/manage/CDSManageMode';
import CDSMigrationTool from '../components/cds-studio/migration/CDSMigrationTool';
import ServiceBuilderV2 from '../components/cds-studio/builder-v2/ServiceBuilderV2';

// Import error boundary and loading states
import CDSErrorBoundary from '../components/cds-studio/shared/CDSErrorBoundary';
import { CDSSaveLoading, CDSLoadingOverlay } from '../components/cds-studio/shared/CDSLoadingStates';

// Import services
import { cdsHooksService } from '../services/cdsHooksService';

// Create context for CDS Studio state management
export const CDSStudioContext = createContext(null);

// Context provider component
export const CDSStudioProvider = ({ children, onModeSwitch, onHookChange, onRefreshManage }) => {
  const [currentHook, setCurrentHook] = useState({
    id: '',
    title: '',
    description: '',
    hook: 'patient-view',
    conditions: [],
    cards: [],
    prefetch: {},
    displayBehavior: {
      defaultMode: 'popup',
      acknowledgment: {
        required: false,
        reasonRequired: false
      },
      snooze: {
        enabled: true,
        defaultDuration: 60
      },
      indicatorOverrides: {
        critical: 'modal',
        warning: 'popup',
        info: 'inline'
      }
    },
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
  const validateHookRef = useRef(null);

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


  const validateHook = useCallback((hookToValidate = null) => {
    try {
      const errors = [];
      const warnings = [];

      // Use provided hook or fall back to currentHook
      const hook = hookToValidate || currentHook;

      // Safety check for hook
      if (!hook || typeof hook !== 'object') {
        errors.push('Invalid hook data');
        const validationResult = { errors, warnings, isValid: false };
        setValidation(validationResult);
        return validationResult;
      }

      // Check title first, then ID
      if (!hook.title || !hook.title.trim()) {
        errors.push('Hook title is required');
      } else {
        // Only check ID if title exists
        let hookId = hook.id;
        if (!hookId || !hookId.trim()) {
          // Try to generate from title
          hookId = generateHookId(hook.title);
          if (!hookId || !hookId.trim()) {
            errors.push('Unable to generate Hook ID from title');
          }
        }
      }
      if (!hook.hook) {
        errors.push('Hook type is required');
      }
      
      // Cards validation - more lenient
      if (!hook.cards || !Array.isArray(hook.cards) || hook.cards.length === 0) {
        errors.push('At least one card is required');
      } else {
        // Validate each card
        hook.cards.forEach((card, index) => {
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
      if (hook.conditions && Array.isArray(hook.conditions) && hook.conditions.length > 0) {
        hook.conditions.forEach((condition, index) => {
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

  // Store validateHook in ref to avoid circular dependency
  useEffect(() => {
    validateHookRef.current = validateHook;
  }, [validateHook]);

  // Hook management functions
  const updateService = useCallback((updates) => {
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
      
      // Schedule validation after state update
      setTimeout(() => {
        if (validateHookRef.current) {
          validateHookRef.current(newHook);
        }
      }, 0);
      
      return newHook;
    });
  }, [generateHookId, onHookChange]);

  const testService = useCallback(async (patientId) => {
    const validationResult = validateHook();
    if (!validationResult.isValid) {
      return { success: false, error: 'Validation failed' };
    }

    try {
      const result = await cdsHooksService.testService(currentHook, { patientId });
      setTestResults(result);
      return { success: true, result };
    } catch (error) {
      console.error('Test hook failed:', error);
      return { success: false, error: error.message };
    }
  }, [currentHook, validateHook]);

  const saveService = useCallback(async () => {
    // console.log('Save hook called, current hook:', currentHook);
    
    // Small delay to ensure state is fully propagated
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Run validation and get fresh results, explicitly passing the current hook
    const validationResult = validateHook(currentHook);
    
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
        result = await cdsHooksService.updateService(currentHook.id, hookDataToSave);
      } else {
        // This is a new hook being created (even if it has an auto-generated ID)
        // console.log('Creating new hook:', hookDataToSave.id);
        result = await cdsHooksService.createService(hookDataToSave);
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
      
      // Trigger a refresh of the manage mode hooks list
      if (onRefreshManage) {
        onRefreshManage();
      }
      
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
      updateHook: updateService,
      validateHook,
      testHook: testService,
      saveHook: saveService,
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

// Note: BuildModeWithErrorHandling has been replaced with ServiceBuilderV2
// This component is kept for reference but no longer used

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
  const [currentMode, setCurrentMode] = useState('build'); // learn, build, manage, migrate
  const [showHelp, setShowHelp] = useState(false);
  const [pendingEditHook, setPendingEditHook] = useState(null);
  const [manageRefreshTrigger, setManageRefreshTrigger] = useState(0);
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
      displayBehavior: {
        defaultMode: 'popup',
        acknowledgment: {
          required: false,
          reasonRequired: false
        },
        snooze: {
          enabled: true,
          defaultDuration: 60
        },
        indicatorOverrides: {
          critical: 'modal',
          warning: 'popup',
          info: 'inline'
        }
      },
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
    manage: 'Organize, analyze, and collaborate on your CDS services',
    migrate: 'Migrate existing hooks to CDS Hooks 1.0 specification compliance'
  };

  return (
    <CDSStudioProvider 
      onModeSwitch={handleModeSwitch} 
      onHookChange={handleHookChange}
      onRefreshManage={() => setManageRefreshTrigger(prev => prev + 1)}
    >
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Compact Header */}
        <Paper sx={{ px: 2, py: 1, mb: 1 }}>
          <Grid container alignItems="center" spacing={1}>
            <Grid item>
              <Typography variant="h6" component="h1" sx={{ fontWeight: 600 }}>
                CDS Studio
              </Typography>
            </Grid>
            <Grid item xs>
              <Tabs 
                value={currentMode} 
                onChange={(e, value) => setCurrentMode(value)}
                sx={{ minHeight: 36 }}
              >
                <Tab 
                  label="Learn" 
                  value="learn" 
                  icon={<LearnIcon sx={{ fontSize: 18 }} />}
                  iconPosition="start"
                  sx={{ minHeight: 36, py: 0 }}
                />
                <Tab 
                  label="Build" 
                  value="build" 
                  icon={<BuildIcon sx={{ fontSize: 18 }} />}
                  iconPosition="start"
                  sx={{ minHeight: 36, py: 0 }}
                />
                <Tab 
                  label="Manage" 
                  value="manage" 
                  icon={<ManageIcon sx={{ fontSize: 18 }} />}
                  iconPosition="start"
                  sx={{ minHeight: 36, py: 0 }}
                />
                <Tab 
                  label="Migrate" 
                  value="migrate" 
                  icon={<TransformIcon sx={{ fontSize: 18 }} />}
                  iconPosition="start"
                  sx={{ minHeight: 36, py: 0 }}
                />
              </Tabs>
            </Grid>
            <Grid item>
              <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
                {modeDescriptions[currentMode]}
              </Typography>
              <Tooltip title="Help & Documentation">
                <IconButton size="small" onClick={() => setShowHelp(!showHelp)}>
                  <HelpIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Grid>
          </Grid>
        </Paper>

        {/* Help Panel */}
        {showHelp && (
          <Alert severity="info" sx={{ mb: 1, py: 1 }} onClose={() => setShowHelp(false)}>
            <Stack spacing={0.5}>
              <Typography variant="caption"><strong>Learn</strong>: Interactive tutorials and examples</Typography>
              <Typography variant="caption"><strong>Build</strong>: Create services with visual tools and templates</Typography>
              <Typography variant="caption"><strong>Manage</strong>: View, test, and organize your services</Typography>
              <Typography variant="caption"><strong>Migrate</strong>: Convert existing hooks to spec-compliant services</Typography>
            </Stack>
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
                // Reset by clearing the pending edit hook
                setPendingEditHook(null);
              }}
            >
              <ServiceBuilderV2 
                initialService={pendingEditHook}
                onServiceSave={() => {
                  // Refresh the manage tab after saving
                  setManageRefreshTrigger(prev => prev + 1);
                  // Clear pending edit hook after successful save
                  setPendingEditHook(null);
                }}
                onServiceTest={(testRequest) => {
                  // Delegate to context test function if available
                  return { success: true, cards: [] };
                }}
                onClose={() => setPendingEditHook(null)}
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
                refreshTrigger={manageRefreshTrigger}
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
          {currentMode === 'migrate' && (
            <CDSErrorBoundary 
              componentName="Migration Tool"
              onRetry={() => window.location.reload()}
              onReset={() => setCurrentMode('manage')}
            >
              <CDSMigrationTool 
                onComplete={() => {
                  // Refresh the manage tab after migration
                  setManageRefreshTrigger(prev => prev + 1);
                  setCurrentMode('manage');
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