/**
 * CDS Build Mode - Main interface for building CDS hooks visually
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
  Tabs,
  Tab,
  IconButton,
  Tooltip,
  Alert,
  Chip,
  Stack,
  Divider,
  Card,
  CardContent,
  CardActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Collapse,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  Save as SaveIcon,
  PlayArrow as TestIcon,
  Code as CodeIcon,
  Visibility as PreviewIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  ContentCopy as CopyIcon,
  Lightbulb as SuggestionIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Psychology as AIIcon,
  LocalOffer as TemplateIcon
} from '@mui/icons-material';

// Import components
import VisualConditionBuilder from './VisualConditionBuilder';
import CardDesigner from './CardDesigner';
import PrefetchBuilder from './PrefetchBuilder';
import HookPreview from './HookPreview';
import HookTemplateSelector from './HookTemplateSelector';
import HookTestingPanel from './HookTestingPanel';

// Import context
import { useCDSStudio } from '../../../pages/CDSHooksStudio';

// Hook types
const HOOK_TYPES = [
  { 
    id: 'patient-view', 
    label: 'Patient View', 
    description: 'Triggered when viewing a patient record',
    icon: '👤'
  },
  { 
    id: 'medication-prescribe', 
    label: 'Medication Prescribe', 
    description: 'Triggered when prescribing medications',
    icon: '💊'
  },
  { 
    id: 'order-sign', 
    label: 'Order Sign', 
    description: 'Triggered when signing orders',
    icon: '✍️'
  },
  { 
    id: 'order-select', 
    label: 'Order Select', 
    description: 'Triggered when selecting orders',
    icon: '📋'
  },
  { 
    id: 'appointment-book', 
    label: 'Appointment Book', 
    description: 'Triggered when booking appointments',
    icon: '📅'
  }
];

// Builder sections
const BUILDER_SECTIONS = [
  { id: 'info', label: 'Basic Info', icon: <InfoIcon /> },
  { id: 'conditions', label: 'Conditions', icon: <AIIcon /> },
  { id: 'cards', label: 'Cards', icon: <SuggestionIcon /> },
  { id: 'prefetch', label: 'Prefetch', icon: <CodeIcon /> }
];

const CDSBuildMode = () => {
  const { currentHook, validation, actions } = useCDSStudio();
  const [activeSection, setActiveSection] = useState('info');
  const [showPreview, setShowPreview] = useState(true);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showTesting, setShowTesting] = useState(false);
  const [autoValidate, setAutoValidate] = useState(true);

  // Auto-validate when hook changes
  useEffect(() => {
    if (autoValidate) {
      actions.validateHook();
    }
  }, [currentHook, autoValidate, actions]);

  // Render validation status
  const renderValidationStatus = () => {
    const errorCount = validation.errors.length;
    const warningCount = validation.warnings.length;

    if (errorCount === 0 && warningCount === 0) {
      return (
        <Chip
          icon={<CheckIcon />}
          label="Valid"
          color="success"
          size="small"
        />
      );
    }

    return (
      <Stack direction="row" spacing={1}>
        {errorCount > 0 && (
          <Chip
            icon={<ErrorIcon />}
            label={`${errorCount} Error${errorCount > 1 ? 's' : ''}`}
            color="error"
            size="small"
          />
        )}
        {warningCount > 0 && (
          <Chip
            icon={<WarningIcon />}
            label={`${warningCount} Warning${warningCount > 1 ? 's' : ''}`}
            color="warning"
            size="small"
          />
        )}
      </Stack>
    );
  };

  // Render basic info section
  const renderBasicInfo = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Hook Information
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Hook Title"
            value={currentHook.title}
            onChange={(e) => actions.updateHook({ title: e.target.value })}
            required
            error={validation.errors.some(e => e.includes('title'))}
            helperText="A descriptive name for your hook"
          />
        </Grid>

        <Grid item xs={12}>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Description"
            value={currentHook.description}
            onChange={(e) => actions.updateHook({ description: e.target.value })}
            helperText="Explain what this hook does and when it triggers"
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <FormControl fullWidth required>
            <InputLabel>Hook Type</InputLabel>
            <Select
              value={currentHook.hook}
              onChange={(e) => actions.updateHook({ hook: e.target.value })}
              label="Hook Type"
            >
              {HOOK_TYPES.map(type => (
                <MenuItem key={type.id} value={type.id}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <span>{type.icon}</span>
                    <Box>
                      <Typography variant="body1">{type.label}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {type.description}
                      </Typography>
                    </Box>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Hook ID"
            value={currentHook.id}
            disabled
            helperText={currentHook.id ? "Auto-generated ID" : "ID will be generated on save"}
          />
        </Grid>

        <Grid item xs={12}>
          <Box display="flex" gap={2} alignItems="center">
            <Typography variant="subtitle2">Tags:</Typography>
            {currentHook.tags?.map((tag, index) => (
              <Chip
                key={index}
                label={tag}
                onDelete={() => {
                  const newTags = currentHook.tags.filter((_, i) => i !== index);
                  actions.updateHook({ tags: newTags });
                }}
                size="small"
              />
            ))}
            <TextField
              size="small"
              placeholder="Add tag..."
              onKeyPress={(e) => {
                if (e.key === 'Enter' && e.target.value) {
                  const newTags = [...(currentHook.tags || []), e.target.value];
                  actions.updateHook({ tags: newTags });
                  e.target.value = '';
                }
              }}
            />
          </Box>
        </Grid>
      </Grid>
    </Box>
  );

  // Render conditions section
  const renderConditions = () => (
    <VisualConditionBuilder
      conditions={currentHook.conditions}
      onChange={(conditions) => actions.updateHook({ conditions })}
    />
  );

  // Render cards section
  const renderCards = () => (
    <CardDesigner
      cards={currentHook.cards}
      onChange={(cards) => actions.updateHook({ cards })}
      hookType={currentHook.hook}
    />
  );

  // Render prefetch section
  const renderPrefetch = () => (
    <PrefetchBuilder
      prefetch={currentHook.prefetch}
      onChange={(prefetch) => actions.updateHook({ prefetch })}
      hookType={currentHook.hook}
    />
  );

  // Render section content
  const renderSectionContent = () => {
    switch (activeSection) {
      case 'info':
        return renderBasicInfo();
      case 'conditions':
        return renderConditions();
      case 'cards':
        return renderCards();
      case 'prefetch':
        return renderPrefetch();
      default:
        return null;
    }
  };

  return (
    <Grid container spacing={2} sx={{ height: '100%', overflow: 'hidden' }}>
      {/* Left Panel - Builder */}
      <Grid item xs={12} md={showPreview ? 7 : 12} sx={{ height: '100%', display: 'flex' }}>
        <Paper sx={{ p: 3, flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} sx={{ flexShrink: 0 }}>
            <Box>
              <Typography variant="h5">
                {currentHook.id ? 'Edit Hook' : 'Create New Hook'}
              </Typography>
              <Box display="flex" alignItems="center" gap={2} mt={1}>
                {renderValidationStatus()}
                <FormControlLabel
                  control={
                    <Switch
                      checked={autoValidate}
                      onChange={(e) => setAutoValidate(e.target.checked)}
                      size="small"
                    />
                  }
                  label="Auto-validate"
                />
              </Box>
            </Box>

            <Stack direction="row" spacing={1}>
              <Tooltip title="Templates">
                <IconButton onClick={() => setShowTemplates(!showTemplates)}>
                  <TemplateIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Test Hook">
                <IconButton onClick={() => setShowTesting(!showTesting)}>
                  <TestIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title={showPreview ? "Hide Preview" : "Show Preview"}>
                <IconButton onClick={() => setShowPreview(!showPreview)}>
                  <PreviewIcon />
                </IconButton>
              </Tooltip>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={actions.saveHook}
                disabled={!validation.isValid}
              >
                Save Hook
              </Button>
            </Stack>
          </Box>

          {/* Templates Dialog */}
          <Collapse in={showTemplates} sx={{ flexShrink: 0 }}>
            <Box mb={3}>
              <HookTemplateSelector
                onSelectTemplate={(template) => {
                  actions.setCurrentHook({
                    ...currentHook,
                    ...template,
                    id: currentHook.id // Preserve ID if editing
                  });
                  setShowTemplates(false);
                }}
                onClose={() => setShowTemplates(false)}
              />
            </Box>
          </Collapse>

          {/* Section Tabs */}
          <Tabs
            value={activeSection}
            onChange={(e, value) => setActiveSection(value)}
            sx={{ mb: 3, borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}
          >
            {BUILDER_SECTIONS.map(section => (
              <Tab
                key={section.id}
                value={section.id}
                label={section.label}
                icon={section.icon}
                iconPosition="start"
              />
            ))}
          </Tabs>

          {/* Scrollable Content Area */}
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            {/* Section Content */}
            <Box>{renderSectionContent()}</Box>

            {/* Validation Messages */}
            {validation.errors.length > 0 && (
              <Alert severity="error" sx={{ mt: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Please fix the following errors:
                </Typography>
                <List dense>
                  {validation.errors.map((error, index) => (
                    <ListItem key={index}>
                      <ListItemText primary={`• ${error}`} />
                    </ListItem>
                  ))}
                </List>
              </Alert>
            )}

            {validation.warnings.length > 0 && (
              <Alert severity="warning" sx={{ mt: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Warnings:
                </Typography>
                <List dense>
                  {validation.warnings.map((warning, index) => (
                    <ListItem key={index}>
                      <ListItemText primary={`• ${warning}`} />
                    </ListItem>
                  ))}
                </List>
              </Alert>
            )}
          </Box>
        </Paper>
      </Grid>

      {/* Right Panel - Preview */}
      {showPreview && (
        <Grid item xs={12} md={5} sx={{ height: '100%', display: 'flex' }}>
          <Paper sx={{ p: 3, flex: 1, overflow: 'auto' }}>
            <HookPreview hook={currentHook} />
          </Paper>
        </Grid>
      )}

      {/* Testing Panel */}
      <HookTestingPanel
        open={showTesting}
        onClose={() => setShowTesting(false)}
        hook={currentHook}
      />
    </Grid>
  );
};

export default CDSBuildMode;