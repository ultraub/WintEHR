/**
 * CDS Build Mode - Improved interface with cleaner layout
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  IconButton,
  Tooltip,
  Alert,
  Chip,
  Stack,
  Divider,
  Card,
  CardContent,
  Collapse,
  Switch,
  FormControlLabel,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  LinearProgress,
  Container
} from '@mui/material';
import {
  Save as SaveIcon,
  PlayArrow as TestIcon,
  Code as CodeIcon,
  Visibility as PreviewIcon,
  VisibilityOff as PreviewOffIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  Settings as SettingsIcon,
  Description as BasicInfoIcon,
  Psychology as ConditionsIcon,
  Dashboard as CardsIcon,
  DataObject as PrefetchIcon,
  Help as HelpIcon
} from '@mui/icons-material';

// Import components
import VisualConditionBuilderImproved from './VisualConditionBuilderImproved';
import CardDesigner from './CardDesigner';
import CardDesignerImproved from './CardDesignerImproved';
import PrefetchBuilder from './PrefetchBuilder';
import PrefetchBuilderImproved from './PrefetchBuilderImproved';
import DisplayBehaviorPanel from './DisplayBehaviorPanel';
import HookPreview from './HookPreview';
import HookTemplateSelector from './HookTemplateSelector';
import HookTestingPanel from './HookTestingPanel';

// Import context
import { useCDSStudio } from '../../../pages/CDSHooksStudio';

// Hook types with better descriptions
const HOOK_TYPES = [
  { 
    id: 'patient-view', 
    label: 'Patient View', 
    description: 'When opening a patient chart',
    common: true
  },
  { 
    id: 'medication-prescribe', 
    label: 'Medication Prescribe', 
    description: 'When prescribing medications',
    common: true
  },
  { 
    id: 'order-sign', 
    label: 'Order Sign', 
    description: 'When signing clinical orders',
    common: true
  },
  { 
    id: 'order-select', 
    label: 'Order Select', 
    description: 'When selecting order items',
    common: false
  },
  { 
    id: 'appointment-book', 
    label: 'Appointment Book', 
    description: 'When scheduling appointments',
    common: false
  }
];

// Builder steps for guided workflow
const BUILDER_STEPS = [
  { 
    id: 'info', 
    label: 'Basic Information',
    description: 'Name and describe your hook',
    icon: <BasicInfoIcon />
  },
  { 
    id: 'conditions', 
    label: 'Trigger Conditions',
    description: 'Define when this hook should fire',
    icon: <ConditionsIcon />
  },
  { 
    id: 'cards', 
    label: 'Response Cards',
    description: 'Design the alerts and suggestions',
    icon: <CardsIcon />
  },
  { 
    id: 'prefetch', 
    label: 'Data Requirements',
    description: 'Specify required patient data',
    icon: <PrefetchIcon />,
    optional: true
  },
  { 
    id: 'display', 
    label: 'Display Behavior',
    description: 'Control how alerts are presented',
    icon: <SettingsIcon />,
    optional: true
  }
];

const CDSBuildModeImproved = () => {
  const { currentHook, validation, actions } = useCDSStudio();
  const [activeStep, setActiveStep] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [completedSteps, setCompletedSteps] = useState(new Set());

  // Calculate progress
  const progress = (completedSteps.size / BUILDER_STEPS.filter(s => !s.optional).size) * 100;

  // Check if step is complete
  const isStepComplete = (stepId) => {
    switch (stepId) {
      case 'info':
        return currentHook.title && currentHook.hook;
      case 'conditions':
        return currentHook.conditions?.length > 0 || currentHook.trigger === 'always';
      case 'cards':
        return currentHook.cards?.length > 0;
      case 'prefetch':
        return true; // Optional
      default:
        return false;
    }
  };

  // Update completed steps
  useEffect(() => {
    const newCompleted = new Set();
    BUILDER_STEPS.forEach(step => {
      if (isStepComplete(step.id)) {
        newCompleted.add(step.id);
      }
    });
    setCompletedSteps(newCompleted);
  }, [currentHook]);

  // Render validation summary
  const renderValidationSummary = () => {
    if (!validation.isValid && validation.errors.length === 0) {
      return null; // Not validated yet
    }

    return (
      <Box sx={{ mb: 2 }}>
        {validation.isValid ? (
          <Alert severity="success" icon={<CheckIcon />}>
            Hook configuration is valid and ready to save
          </Alert>
        ) : (
          <Alert severity="error" icon={<ErrorIcon />}>
            Please fix the following issues:
            <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
              {validation.errors.map((error, idx) => (
                <li key={idx}>{error}</li>
              ))}
            </ul>
          </Alert>
        )}
      </Box>
    );
  };

  // Render basic info step
  const renderBasicInfo = () => (
    <Box>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Hook Name"
            value={currentHook.title || ''}
            onChange={(e) => actions.updateHook({ title: e.target.value })}
            required
            placeholder="e.g., Diabetes Screening Reminder"
            helperText="A clear, descriptive name for your clinical decision support hook"
          />
        </Grid>

        <Grid item xs={12}>
          <FormControl fullWidth required>
            <InputLabel>When should this hook trigger?</InputLabel>
            <Select
              value={currentHook.hook || ''}
              onChange={(e) => actions.updateHook({ hook: e.target.value })}
              label="When should this hook trigger?"
            >
              <MenuItem value="" disabled>
                <em>Select a trigger point</em>
              </MenuItem>
              {HOOK_TYPES.filter(t => t.common).map(type => (
                <MenuItem key={type.id} value={type.id}>
                  <Box>
                    <Typography variant="body2">{type.label}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {type.description}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
              <Divider />
              <MenuItem disabled>
                <Typography variant="caption">Less Common</Typography>
              </MenuItem>
              {HOOK_TYPES.filter(t => !t.common).map(type => (
                <MenuItem key={type.id} value={type.id}>
                  <Box>
                    <Typography variant="body2">{type.label}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {type.description}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12}>
          <TextField
            fullWidth
            multiline
            rows={2}
            label="Description (optional)"
            value={currentHook.description || ''}
            onChange={(e) => actions.updateHook({ description: e.target.value })}
            placeholder="Briefly explain what this hook does..."
            helperText="Help other users understand the purpose of this hook"
          />
        </Grid>
      </Grid>
    </Box>
  );

  // Render conditions step
  const renderConditions = () => (
    <Box>
      <Box sx={{ mb: 2 }}>
        <FormControlLabel
          control={
            <Switch
              checked={currentHook.trigger === 'always'}
              onChange={(e) => actions.updateHook({ 
                trigger: e.target.checked ? 'always' : 'conditional' 
              })}
            />
          }
          label="Always trigger (no conditions)"
        />
      </Box>

      {currentHook.trigger !== 'always' && (
        <VisualConditionBuilderImproved
          conditions={currentHook.conditions || []}
          onChange={(conditions) => actions.updateHook({ conditions })}
        />
      )}
    </Box>
  );

  // Render cards step
  const renderCards = () => (
    <Box>
      <CardDesignerImproved
        cards={currentHook.cards || []}
        onChange={(cards) => actions.updateHook({ cards })}
      />
    </Box>
  );

  // Render prefetch step
  const renderPrefetch = () => (
    <Box>
      <PrefetchBuilderImproved
        prefetch={currentHook.prefetch || {}}
        onChange={(prefetch) => actions.updateHook({ prefetch })}
      />
    </Box>
  );

  // Render display behavior step
  const renderDisplayBehavior = () => (
    <Box>
      <DisplayBehaviorPanel
        hookConfig={currentHook}
        onChange={(updates) => actions.updateHook(updates)}
      />
    </Box>
  );

  // Render step content
  const renderStepContent = (stepId) => {
    switch (stepId) {
      case 'info':
        return renderBasicInfo();
      case 'conditions':
        return renderConditions();
      case 'cards':
        return renderCards();
      case 'prefetch':
        return renderPrefetch();
      case 'display':
        return renderDisplayBehavior();
      default:
        return null;
    }
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header with actions */}
      <Box sx={{ 
        borderBottom: 1, 
        borderColor: 'divider',
        px: 3,
        py: 2,
        backgroundColor: 'background.paper'
      }}>
        <Grid container alignItems="center" spacing={2}>
          <Grid item xs>
            <Typography variant="h5">
              {currentHook.title || 'New CDS Hook'}
            </Typography>
            <LinearProgress 
              variant="determinate" 
              value={progress} 
              sx={{ mt: 1, height: 6, borderRadius: 3 }}
            />
          </Grid>
          <Grid item>
            <Stack direction="row" spacing={1}>
              <Tooltip title={showPreview ? "Hide preview" : "Show preview"}>
                <IconButton onClick={() => setShowPreview(!showPreview)}>
                  {showPreview ? <PreviewOffIcon /> : <PreviewIcon />}
                </IconButton>
              </Tooltip>
              <Button
                variant="outlined"
                startIcon={<TestIcon />}
                onClick={() => actions.testHook()}
              >
                Test
              </Button>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={() => actions.saveHook()}
                disabled={!validation.isValid}
              >
                Save Hook
              </Button>
            </Stack>
          </Grid>
        </Grid>
      </Box>

      {/* Main content area */}
      <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        {/* Left panel - Stepper */}
        <Box sx={{ 
          width: showPreview ? '60%' : '100%',
          borderRight: showPreview ? 1 : 0,
          borderColor: 'divider',
          overflow: 'auto',
          p: 3
        }}>
          <Container maxWidth="md">
            {renderValidationSummary()}
            
            <Stepper activeStep={activeStep} orientation="vertical">
              {BUILDER_STEPS.map((step, index) => (
                <Step key={step.id} completed={completedSteps.has(step.id)}>
                  <StepLabel
                    optional={
                      step.optional && (
                        <Typography variant="caption">Optional</Typography>
                      )
                    }
                    StepIconComponent={() => (
                      <Box sx={{ 
                        display: 'flex', 
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        backgroundColor: completedSteps.has(step.id) 
                          ? 'success.main' 
                          : activeStep === index 
                            ? 'primary.main' 
                            : 'grey.300',
                        color: 'white'
                      }}>
                        {completedSteps.has(step.id) ? <CheckIcon /> : step.icon}
                      </Box>
                    )}
                  >
                    <Box onClick={() => setActiveStep(index)} sx={{ cursor: 'pointer' }}>
                      <Typography variant="subtitle1">{step.label}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {step.description}
                      </Typography>
                    </Box>
                  </StepLabel>
                  <StepContent>
                    <Box sx={{ mt: 2, mb: 4 }}>
                      {renderStepContent(step.id)}
                    </Box>
                  </StepContent>
                </Step>
              ))}
            </Stepper>

            {/* Advanced options */}
            <Box sx={{ mt: 4 }}>
              <Accordion 
                expanded={showAdvanced} 
                onChange={(e, expanded) => setShowAdvanced(expanded)}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography>Advanced Options</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Hook ID"
                        value={currentHook.id || ''}
                        onChange={(e) => actions.updateHook({ id: e.target.value })}
                        helperText="Unique identifier (auto-generated if empty)"
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={currentHook.enabled !== false}
                            onChange={(e) => actions.updateHook({ 
                              enabled: e.target.checked 
                            })}
                          />
                        }
                        label="Hook enabled"
                      />
                    </Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>
            </Box>
          </Container>
        </Box>

        {/* Right panel - Preview */}
        {showPreview && (
          <Box sx={{ 
            width: '40%',
            overflow: 'auto',
            backgroundColor: 'grey.50',
            p: 3
          }}>
            <Typography variant="h6" gutterBottom>
              Preview
            </Typography>
            <HookPreview hook={currentHook} />
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default CDSBuildModeImproved;