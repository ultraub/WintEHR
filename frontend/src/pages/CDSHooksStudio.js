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

import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
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

// Import child components (to be created)
import CDSLearnMode from '../components/cds-studio/learn/CDSLearnMode';
import CDSBuildMode from '../components/cds-studio/build/CDSBuildMode';
import CDSManageMode from '../components/cds-studio/manage/CDSManageMode';

// Import services
import { cdsHooksService } from '../services/cdsHooksService';

// Create context for CDS Studio state management
export const CDSStudioContext = createContext();

// Context provider component
export const CDSStudioProvider = ({ children }) => {
  const [currentHook, setCurrentHook] = useState({
    id: '',
    title: '',
    description: '',
    hook: 'patient-view',
    conditions: [],
    cards: [],
    prefetch: {},
    _meta: {
      created: new Date(),
      modified: new Date(),
      version: 1,
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
  const [saveStatus, setSaveStatus] = useState({ open: false, message: '', severity: 'success' });

  // Hook management functions
  const updateHook = useCallback((updates) => {
    setCurrentHook(prev => ({
      ...prev,
      ...updates,
      _meta: {
        ...prev._meta,
        modified: new Date()
      }
    }));
  }, []);

  const validateHook = useCallback(() => {
    const errors = [];
    const warnings = [];

    // Required fields validation
    if (!currentHook.title) errors.push('Hook title is required');
    if (!currentHook.hook) errors.push('Hook type is required');
    if (currentHook.conditions.length === 0) warnings.push('No conditions defined - hook will always trigger');
    if (currentHook.cards.length === 0) errors.push('At least one card is required');

    // Condition validation
    currentHook.conditions.forEach((condition, index) => {
      if (!condition.field) errors.push(`Condition ${index + 1}: Field is required`);
      if (!condition.operator) errors.push(`Condition ${index + 1}: Operator is required`);
      if (condition.value === undefined || condition.value === '') {
        errors.push(`Condition ${index + 1}: Value is required`);
      }
    });

    // Card validation
    currentHook.cards.forEach((card, index) => {
      if (!card.summary) errors.push(`Card ${index + 1}: Summary is required`);
      if (!card.indicator) warnings.push(`Card ${index + 1}: No severity indicator`);
    });

    const isValid = errors.length === 0;
    setValidation({ errors, warnings, isValid });
    return isValid;
  }, [currentHook]);

  const testHook = useCallback(async (patientId) => {
    if (!validateHook()) {
      return { success: false, error: 'Validation failed' };
    }

    try {
      const result = await cdsHooksService.testHook(currentHook, { patientId });
      setTestResults(result);
      return { success: true, result };
    } catch (error) {
      console.error('Test failed:', error);
      return { success: false, error: error.message };
    }
  }, [currentHook, validateHook]);

  const saveHook = useCallback(async () => {
    if (!validateHook()) {
      setSaveStatus({
        open: true,
        message: 'Please fix validation errors before saving',
        severity: 'error'
      });
      return false;
    }

    setIsSaving(true);
    try {
      let result;
      if (currentHook.id) {
        result = await cdsHooksService.updateHook(currentHook.id, currentHook);
      } else {
        result = await cdsHooksService.createHook(currentHook);
        setCurrentHook(prev => ({ ...prev, id: result.id }));
      }

      setSaveStatus({
        open: true,
        message: 'Hook saved successfully!',
        severity: 'success'
      });
      return true;
    } catch (error) {
      console.error('Save failed:', error);
      setSaveStatus({
        open: true,
        message: `Save failed: ${error.message}`,
        severity: 'error'
      });
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [currentHook, validateHook]);

  const value = {
    currentHook,
    validation,
    testResults,
    isSaving,
    actions: {
      updateHook,
      validateHook,
      testHook,
      saveHook,
      setCurrentHook
    }
  };

  return (
    <CDSStudioContext.Provider value={value}>
      {children}
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

  // Mode descriptions
  const modeDescriptions = {
    learn: 'Interactive tutorials and examples to master CDS Hooks',
    build: 'Visual tools to create and test clinical decision support rules',
    manage: 'Organize, analyze, and collaborate on your CDS hooks'
  };

  return (
    <CDSStudioProvider>
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

        {/* Content Area */}
        <Box sx={{ flexGrow: 1, overflow: 'auto', position: 'relative' }}>
          {currentMode === 'learn' && <CDSLearnMode />}
          {currentMode === 'build' && <CDSBuildMode />}
          {currentMode === 'manage' && <CDSManageMode />}
        </Box>

        {/* Floating Action Button for Quick Actions */}
        {currentMode === 'build' && <SaveButton />}
      </Box>
    </CDSStudioProvider>
  );
}

export default CDSHooksStudio;