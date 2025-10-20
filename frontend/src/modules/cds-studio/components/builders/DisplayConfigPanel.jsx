/**
 * Display Configuration Panel
 *
 * Configure EMR-side display behavior for CDS alerts.
 * Allows selection of presentation mode, acknowledgment settings,
 * override reasons, snooze options, and more.
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  FormControl,
  FormControlLabel,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  TextField,
  Divider,
  Stack,
  Chip,
  Alert,
  Grid,
  Slider,
  IconButton,
  Tooltip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Info as InfoIcon,
  ExpandMore as ExpandIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon
} from '@mui/icons-material';

import {
  PRESENTATION_MODES,
  DISPLAY_BEHAVIOR_SCHEMA,
  DEFAULT_OVERRIDE_REASONS,
  getDisplayBehaviorDefaults,
  getRecommendedMode,
  validateDisplayBehavior
} from '../../types/displayModes';

/**
 * Override Reason Editor
 */
const OverrideReasonEditor = ({ reasons, onChange }) => {
  const [customReason, setCustomReason] = useState({ code: '', display: '', category: 'clinical' });

  const handleAddReason = () => {
    if (!customReason.code || !customReason.display) return;

    onChange([...reasons, { ...customReason, system: 'https://winterhr.com/cds-hooks/override-reasons' }]);
    setCustomReason({ code: '', display: '', category: 'clinical' });
  };

  const handleDeleteReason = (index) => {
    onChange(reasons.filter((_, i) => i !== index));
  };

  const handleResetToDefaults = () => {
    onChange(DEFAULT_OVERRIDE_REASONS);
  };

  return (
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" mb={2}>
        <Typography variant="subtitle2">Override Reasons</Typography>
        <Chip label={`${reasons.length} reasons`} size="small" />
        <Button size="small" onClick={handleResetToDefaults}>Reset to Defaults</Button>
      </Stack>

      <List dense>
        {reasons.map((reason, index) => (
          <ListItem key={index}>
            <ListItemText
              primary={reason.display}
              secondary={`Code: ${reason.code} | Category: ${reason.category}`}
            />
            <ListItemSecondaryAction>
              <IconButton
                edge="end"
                size="small"
                onClick={() => handleDeleteReason(index)}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </ListItemSecondaryAction>
          </ListItem>
        ))}
      </List>

      {/* Add Custom Reason */}
      <Paper elevation={0} sx={{ p: 2, mt: 2, backgroundColor: 'grey.50' }}>
        <Typography variant="caption" color="text.secondary" gutterBottom>
          Add Custom Override Reason
        </Typography>
        <Stack spacing={1}>
          <TextField
            size="small"
            label="Code"
            value={customReason.code}
            onChange={(e) => setCustomReason({ ...customReason, code: e.target.value })}
            placeholder="e.g., custom-reason"
          />
          <TextField
            size="small"
            label="Display Text"
            value={customReason.display}
            onChange={(e) => setCustomReason({ ...customReason, display: e.target.value })}
            placeholder="e.g., Custom clinical reason"
          />
          <FormControl size="small">
            <InputLabel>Category</InputLabel>
            <Select
              value={customReason.category}
              label="Category"
              onChange={(e) => setCustomReason({ ...customReason, category: e.target.value })}
            >
              <MenuItem value="clinical">Clinical</MenuItem>
              <MenuItem value="system">System</MenuItem>
              <MenuItem value="other">Other</MenuItem>
            </Select>
          </FormControl>
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={handleAddReason}
            disabled={!customReason.code || !customReason.display}
            variant="outlined"
          >
            Add Reason
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
};

/**
 * Snooze Configuration
 */
const SnoozeConfiguration = ({ enabled, durations, onChange }) => {
  const [newDuration, setNewDuration] = useState('');

  const handleAddDuration = () => {
    const duration = parseInt(newDuration);
    if (!duration || duration <= 0) return;

    onChange({
      enabled,
      durations: [...durations, duration].sort((a, b) => a - b)
    });
    setNewDuration('');
  };

  const handleDeleteDuration = (index) => {
    onChange({
      enabled,
      durations: durations.filter((_, i) => i !== index)
    });
  };

  return (
    <Box>
      <FormControlLabel
        control={
          <Switch
            checked={enabled}
            onChange={(e) => onChange({ enabled: e.target.checked, durations })}
          />
        }
        label="Allow Snooze"
      />

      {enabled && (
        <Box mt={2}>
          <Typography variant="caption" color="text.secondary" gutterBottom display="block">
            Snooze Durations (minutes)
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" mb={1}>
            {durations.map((duration, index) => (
              <Chip
                key={index}
                label={`${duration} min`}
                onDelete={() => handleDeleteDuration(index)}
                size="small"
              />
            ))}
          </Stack>

          <Stack direction="row" spacing={1}>
            <TextField
              size="small"
              type="number"
              label="Minutes"
              value={newDuration}
              onChange={(e) => setNewDuration(e.target.value)}
              placeholder="e.g., 60"
              sx={{ width: 120 }}
            />
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={handleAddDuration}
              disabled={!newDuration}
              variant="outlined"
            >
              Add
            </Button>
          </Stack>
        </Box>
      )}
    </Box>
  );
};

/**
 * Presentation Mode Preview
 */
const PresentationModePreview = ({ mode }) => {
  if (!mode) return null;

  const modeConfig = PRESENTATION_MODES[Object.keys(PRESENTATION_MODES).find(
    key => PRESENTATION_MODES[key].id === mode
  )];

  if (!modeConfig) return null;

  return (
    <Paper elevation={0} sx={{ p: 2, backgroundColor: 'grey.50' }}>
      <Stack direction="row" spacing={2} alignItems="center" mb={1}>
        <Typography variant="h6">{modeConfig.icon}</Typography>
        <Typography variant="subtitle1">{modeConfig.label}</Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" paragraph>
        {modeConfig.description}
      </Typography>

      <Typography variant="caption" color="text.secondary" fontWeight="bold" display="block" mb={0.5}>
        Best For:
      </Typography>
      <Stack direction="row" spacing={0.5} mb={1}>
        {modeConfig.bestFor.map((use, index) => (
          <Chip key={index} label={use} size="small" />
        ))}
      </Stack>

      <Typography variant="caption" color="text.secondary" fontWeight="bold" display="block" mb={0.5}>
        Characteristics:
      </Typography>
      <Box component="ul" sx={{ m: 0, pl: 2 }}>
        {modeConfig.characteristics.map((char, index) => (
          <Typography key={index} component="li" variant="caption" color="text.secondary">
            {char}
          </Typography>
        ))}
      </Box>
    </Paper>
  );
};

/**
 * Main Display Configuration Panel
 */
const DisplayConfigPanel = ({
  config,
  onChange,
  cardIndicator = 'info',
  error = null
}) => {
  const [displayConfig, setDisplayConfig] = useState({
    presentationMode: 'inline',
    acknowledgmentRequired: false,
    reasonRequired: false,
    overrideReasons: DEFAULT_OVERRIDE_REASONS,
    allowSnooze: false,
    snoozeDurations: [15, 30, 60, 120, 240, 480, 1440],
    autoHide: false,
    hideDelay: 5000,
    maxAlerts: 5,
    position: null,
    allowInteraction: true,
    backdrop: 'dismissible',
    ...config
  });

  const [validationErrors, setValidationErrors] = useState([]);

  // Get current mode configuration
  const currentMode = PRESENTATION_MODES[Object.keys(PRESENTATION_MODES).find(
    key => PRESENTATION_MODES[key].id === displayConfig.presentationMode
  )];

  // Validate configuration when it changes
  useEffect(() => {
    const validation = validateDisplayBehavior(displayConfig);
    setValidationErrors(validation.errors);
  }, [displayConfig]);

  // Update parent when config changes
  useEffect(() => {
    onChange(displayConfig);
  }, [displayConfig, onChange]);

  const handleModeChange = (newMode) => {
    // Get defaults for new mode
    const defaults = getDisplayBehaviorDefaults(newMode);

    setDisplayConfig({
      ...displayConfig,
      presentationMode: newMode,
      ...defaults
    });
  };

  const handleConfigChange = (field, value) => {
    setDisplayConfig({
      ...displayConfig,
      [field]: value
    });
  };

  // Check if setting applies to current mode
  const appliesToMode = (settingKey) => {
    const schema = DISPLAY_BEHAVIOR_SCHEMA[settingKey];
    if (!schema?.appliesTo) return true;
    return schema.appliesTo.includes(displayConfig.presentationMode);
  };

  return (
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" mb={2}>
        <SettingsIcon color="primary" fontSize="large" />
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6">Display Configuration</Typography>
          <Typography variant="body2" color="text.secondary">
            Configure how this alert is displayed in the EMR
          </Typography>
        </Box>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {validationErrors.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="body2">Configuration Issues:</Typography>
          <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
            {validationErrors.map((err, idx) => (
              <li key={idx}><Typography variant="caption">{err}</Typography></li>
            ))}
          </ul>
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Left Column - Presentation Mode */}
        <Grid item xs={12} md={6}>
          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              Presentation Mode
            </Typography>
            <Divider sx={{ mb: 2 }} />

            {/* Mode Selector */}
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Display Mode</InputLabel>
              <Select
                value={displayConfig.presentationMode}
                label="Display Mode"
                onChange={(e) => handleModeChange(e.target.value)}
              >
                {Object.values(PRESENTATION_MODES).map((mode) => (
                  <MenuItem key={mode.id} value={mode.id}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <span>{mode.icon}</span>
                      <Typography>{mode.label}</Typography>
                    </Stack>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Recommended Modes */}
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="caption">
                <strong>Recommended for {cardIndicator}:</strong>{' '}
                {getRecommendedMode(cardIndicator).join(', ')}
              </Typography>
            </Alert>

            {/* Mode Preview */}
            <PresentationModePreview mode={displayConfig.presentationMode} />
          </Paper>
        </Grid>

        {/* Right Column - Behavior Settings */}
        <Grid item xs={12} md={6}>
          <Stack spacing={3}>
            {/* Acknowledgment Settings */}
            {appliesToMode('acknowledgmentRequired') && (
              <Paper elevation={2} sx={{ p: 3 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Acknowledgment
                </Typography>
                <Divider sx={{ mb: 2 }} />

                <FormControlLabel
                  control={
                    <Switch
                      checked={displayConfig.acknowledgmentRequired}
                      onChange={(e) => handleConfigChange('acknowledgmentRequired', e.target.checked)}
                    />
                  }
                  label="Require Acknowledgment"
                />

                {appliesToMode('reasonRequired') && (
                  <FormControlLabel
                    control={
                      <Switch
                        checked={displayConfig.reasonRequired}
                        onChange={(e) => handleConfigChange('reasonRequired', e.target.checked)}
                      />
                    }
                    label="Require Override Reason"
                  />
                )}
              </Paper>
            )}

            {/* Auto-Hide Settings */}
            {appliesToMode('autoHide') && (
              <Paper elevation={2} sx={{ p: 3 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Auto-Hide
                </Typography>
                <Divider sx={{ mb: 2 }} />

                <FormControlLabel
                  control={
                    <Switch
                      checked={displayConfig.autoHide}
                      onChange={(e) => handleConfigChange('autoHide', e.target.checked)}
                    />
                  }
                  label="Auto-Hide Alert"
                />

                {displayConfig.autoHide && appliesToMode('hideDelay') && (
                  <Box mt={2}>
                    <Typography variant="caption" gutterBottom>
                      Hide Delay: {displayConfig.hideDelay / 1000} seconds
                    </Typography>
                    <Slider
                      value={displayConfig.hideDelay}
                      onChange={(e, val) => handleConfigChange('hideDelay', val)}
                      min={2000}
                      max={30000}
                      step={1000}
                      marks={[
                        { value: 2000, label: '2s' },
                        { value: 30000, label: '30s' }
                      ]}
                    />
                  </Box>
                )}
              </Paper>
            )}

            {/* Position Settings */}
            {displayConfig.presentationMode && (
              <Paper elevation={2} sx={{ p: 3 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Position
                </Typography>
                <Divider sx={{ mb: 2 }} />

                {DISPLAY_BEHAVIOR_SCHEMA.position.options[displayConfig.presentationMode] && (
                  <FormControl fullWidth>
                    <InputLabel>Position</InputLabel>
                    <Select
                      value={displayConfig.position || DISPLAY_BEHAVIOR_SCHEMA.position.default[displayConfig.presentationMode]}
                      label="Position"
                      onChange={(e) => handleConfigChange('position', e.target.value)}
                    >
                      {DISPLAY_BEHAVIOR_SCHEMA.position.options[displayConfig.presentationMode].map((pos) => (
                        <MenuItem key={pos} value={pos}>
                          {pos}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              </Paper>
            )}
          </Stack>
        </Grid>

        {/* Full Width Sections */}
        <Grid item xs={12}>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography variant="subtitle1">Override Reasons</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <OverrideReasonEditor
                reasons={displayConfig.overrideReasons}
                onChange={(reasons) => handleConfigChange('overrideReasons', reasons)}
              />
            </AccordionDetails>
          </Accordion>
        </Grid>

        {appliesToMode('allowSnooze') && (
          <Grid item xs={12}>
            <Accordion>
              <AccordionSummary expandIcon={<ExpandIcon />}>
                <Typography variant="subtitle1">Snooze Configuration</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <SnoozeConfiguration
                  enabled={displayConfig.allowSnooze}
                  durations={displayConfig.snoozeDurations}
                  onChange={({ enabled, durations }) => {
                    handleConfigChange('allowSnooze', enabled);
                    handleConfigChange('snoozeDurations', durations);
                  }}
                />
              </AccordionDetails>
            </Accordion>
          </Grid>
        )}

        {/* Advanced Settings */}
        <Grid item xs={12}>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography variant="subtitle1">Advanced Settings</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                {appliesToMode('maxAlerts') && (
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Maximum Alerts"
                      value={displayConfig.maxAlerts}
                      onChange={(e) => handleConfigChange('maxAlerts', parseInt(e.target.value))}
                      inputProps={{ min: 1, max: 20 }}
                    />
                  </Grid>
                )}

                <Grid item xs={12} sm={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={displayConfig.allowInteraction}
                        onChange={(e) => handleConfigChange('allowInteraction', e.target.checked)}
                      />
                    }
                    label="Allow User Interaction"
                  />
                </Grid>

                {appliesToMode('backdrop') && (
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>Backdrop Behavior</InputLabel>
                      <Select
                        value={displayConfig.backdrop}
                        label="Backdrop Behavior"
                        onChange={(e) => handleConfigChange('backdrop', e.target.value)}
                      >
                        <MenuItem value="static">Static (prevents dismiss)</MenuItem>
                        <MenuItem value="dismissible">Dismissible (click to close)</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                )}
              </Grid>
            </AccordionDetails>
          </Accordion>
        </Grid>
      </Grid>

      {/* Configuration Summary */}
      <Alert severity="info" icon={<InfoIcon />} sx={{ mt: 3 }}>
        <Typography variant="body2">
          <strong>Configuration Summary:</strong> {currentMode?.label} mode with{' '}
          {displayConfig.acknowledgmentRequired ? 'required acknowledgment' : 'optional acknowledgment'},{' '}
          {displayConfig.autoHide ? `auto-hide after ${displayConfig.hideDelay / 1000}s` : 'no auto-hide'},{' '}
          and {displayConfig.allowSnooze ? `snooze options (${displayConfig.snoozeDurations.length})` : 'no snooze'}.
        </Typography>
      </Alert>
    </Box>
  );
};

export default DisplayConfigPanel;
