/**
 * Display Behavior Panel - Configure how CDS cards are presented to users
 */

import React, { useState } from 'react';
import {
  Box,
  Grid,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Switch,
  FormControlLabel,
  Paper,
  Stack,
  Chip,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  RadioGroup,
  Radio,
  Slider,
  Tooltip,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Button
} from '@mui/material';
import {
  Info as InfoIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as SuccessIcon,
  NotificationImportant as HardStopIcon,
  Notifications as PopupIcon,
  ViewSidebar as SidebarIcon,
  ViewDay as InlineIcon,
  ExpandMore as ExpandMoreIcon,
  Help as HelpIcon,
  Timer as TimerIcon,
  Block as BlockIcon,
  Psychology as SmartIcon
} from '@mui/icons-material';

// Presentation modes
const PRESENTATION_MODES = [
  {
    id: 'hard-stop',
    label: 'Hard Stop',
    icon: <HardStopIcon />,
    description: 'Modal dialog that must be addressed',
    severity: 'high',
    indicators: ['critical', 'error']
  },
  {
    id: 'popup',
    label: 'Dismissible Popup',
    icon: <PopupIcon />,
    description: 'Prominent alert that can be dismissed',
    severity: 'medium',
    indicators: ['warning', 'critical']
  },
  {
    id: 'sidebar',
    label: 'Sidebar Alert',
    icon: <SidebarIcon />,
    description: 'Non-blocking alert in sidebar',
    severity: 'low',
    indicators: ['info', 'warning']
  },
  {
    id: 'inline',
    label: 'Inline Suggestion',
    icon: <InlineIcon />,
    description: 'Subtle inline notification',
    severity: 'minimal',
    indicators: ['info', 'success']
  }
];

// Acknowledgment requirements
const ACKNOWLEDGMENT_OPTIONS = [
  { id: 'none', label: 'No acknowledgment required' },
  { id: 'dismiss', label: 'Simple dismissal' },
  { id: 'reason', label: 'Require reason for override' },
  { id: 'attestation', label: 'Require attestation statement' }
];

// Snooze duration options
const SNOOZE_OPTIONS = [
  { value: 0, label: 'No snooze' },
  { value: 3600, label: '1 hour' },
  { value: 14400, label: '4 hours' },
  { value: 28800, label: '8 hours' },
  { value: 86400, label: '24 hours' },
  { value: 604800, label: '1 week' }
];

// Card indicators for override configuration
const CARD_INDICATORS = [
  { id: 'info', label: 'Info', icon: <InfoIcon />, color: '#2196F3' },
  { id: 'warning', label: 'Warning', icon: <WarningIcon />, color: '#FF9800' },
  { id: 'critical', label: 'Critical', icon: <ErrorIcon />, color: '#F44336' },
  { id: 'success', label: 'Success', icon: <SuccessIcon />, color: '#4CAF50' }
];

const DisplayBehaviorPanel = ({ hookConfig = {}, onChange }) => {
  const [displayConfig, setDisplayConfig] = useState({
    defaultMode: 'popup',
    indicatorOverrides: {},
    acknowledgment: {
      required: false,
      type: 'dismiss',
      reasonRequired: false,
      reasonOptions: []
    },
    snooze: {
      enabled: false,
      defaultDuration: 0,
      maxDuration: 86400
    },
    timing: {
      autoDisplay: true,
      displayDelay: 0,
      autoDismiss: false,
      autoDismissDelay: 30
    },
    ...hookConfig.displayBehavior
  });

  // Update config and notify parent
  const updateConfig = (updates) => {
    const newConfig = { ...displayConfig, ...updates };
    setDisplayConfig(newConfig);
    onChange({ displayBehavior: newConfig });
  };

  // Update nested config
  const updateNestedConfig = (section, updates) => {
    updateConfig({
      [section]: { ...displayConfig[section], ...updates }
    });
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Display Behavior Configuration
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Control how CDS alerts are presented to users and what actions they must take
      </Typography>

      <Stack spacing={3}>
        {/* Default Presentation Mode */}
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            Default Presentation Mode
          </Typography>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Presentation Mode</InputLabel>
            <Select
              value={displayConfig.defaultMode}
              onChange={(e) => updateConfig({ defaultMode: e.target.value })}
              label="Presentation Mode"
            >
              {PRESENTATION_MODES.map(mode => (
                <MenuItem key={mode.id} value={mode.id}>
                  <Stack direction="row" spacing={2} alignItems="center" width="100%">
                    {mode.icon}
                    <Box flex={1}>
                      <Typography variant="body2">{mode.label}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {mode.description}
                      </Typography>
                    </Box>
                    <Chip 
                      label={mode.severity} 
                      size="small" 
                      color={
                        mode.severity === 'high' ? 'error' :
                        mode.severity === 'medium' ? 'warning' :
                        mode.severity === 'low' ? 'info' : 'default'
                      }
                    />
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Alert severity="info" sx={{ mt: 2 }}>
            This default can be overridden based on card indicator type below
          </Alert>
        </Paper>

        {/* Per-Indicator Overrides */}
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1">
              Indicator-Based Overrides
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                Override presentation mode based on card severity indicator
              </Typography>
              <List>
                {CARD_INDICATORS.map(indicator => (
                  <ListItem key={indicator.id} sx={{ px: 0 }}>
                    <ListItemIcon>
                      <Box sx={{ color: indicator.color }}>
                        {indicator.icon}
                      </Box>
                    </ListItemIcon>
                    <ListItemText 
                      primary={indicator.label}
                      secondary={`Default: ${displayConfig.indicatorOverrides[indicator.id] || displayConfig.defaultMode}`}
                    />
                    <ListItemSecondaryAction>
                      <FormControl size="small" sx={{ minWidth: 180 }}>
                        <Select
                          value={displayConfig.indicatorOverrides[indicator.id] || ''}
                          onChange={(e) => updateConfig({
                            indicatorOverrides: {
                              ...displayConfig.indicatorOverrides,
                              [indicator.id]: e.target.value || undefined
                            }
                          })}
                          displayEmpty
                        >
                          <MenuItem value="">
                            <em>Use default</em>
                          </MenuItem>
                          {PRESENTATION_MODES.map(mode => (
                            <MenuItem key={mode.id} value={mode.id}>
                              {mode.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
              <Alert severity="warning">
                Critical alerts should generally use "Hard Stop" or "Dismissible Popup" modes
              </Alert>
            </Stack>
          </AccordionDetails>
        </Accordion>

        {/* Acknowledgment Settings */}
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1">
              Acknowledgment Requirements
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={displayConfig.acknowledgment.required}
                      onChange={(e) => updateNestedConfig('acknowledgment', {
                        required: e.target.checked
                      })}
                    />
                  }
                  label="Require user acknowledgment"
                />
              </Grid>

              {displayConfig.acknowledgment.required && (
                <>
                  <Grid item xs={12}>
                    <FormControl component="fieldset">
                      <Typography variant="subtitle2" gutterBottom>
                        Acknowledgment Type
                      </Typography>
                      <RadioGroup
                        value={displayConfig.acknowledgment.type}
                        onChange={(e) => updateNestedConfig('acknowledgment', {
                          type: e.target.value
                        })}
                      >
                        {ACKNOWLEDGMENT_OPTIONS.map(option => (
                          <FormControlLabel
                            key={option.id}
                            value={option.id}
                            control={<Radio />}
                            label={option.label}
                          />
                        ))}
                      </RadioGroup>
                    </FormControl>
                  </Grid>

                  {displayConfig.acknowledgment.type === 'reason' && (
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" gutterBottom>
                        Predefined Reason Options
                      </Typography>
                      <Stack spacing={1}>
                        {(displayConfig.acknowledgment.reasonOptions || []).map((reason, idx) => (
                          <Chip
                            key={idx}
                            label={reason}
                            onDelete={() => {
                              const newReasons = [...displayConfig.acknowledgment.reasonOptions];
                              newReasons.splice(idx, 1);
                              updateNestedConfig('acknowledgment', {
                                reasonOptions: newReasons
                              });
                            }}
                          />
                        ))}
                        <TextField
                          size="small"
                          placeholder="Add reason option..."
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && e.target.value) {
                              updateNestedConfig('acknowledgment', {
                                reasonOptions: [
                                  ...(displayConfig.acknowledgment.reasonOptions || []),
                                  e.target.value
                                ]
                              });
                              e.target.value = '';
                            }
                          }}
                        />
                      </Stack>
                    </Grid>
                  )}
                </>
              )}
            </Grid>
          </AccordionDetails>
        </Accordion>

        {/* Snooze Settings */}
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1">
              Snooze Options
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={displayConfig.snooze.enabled}
                      onChange={(e) => updateNestedConfig('snooze', {
                        enabled: e.target.checked
                      })}
                    />
                  }
                  label="Allow users to snooze alerts"
                />
              </Grid>

              {displayConfig.snooze.enabled && (
                <>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth>
                      <InputLabel>Default Snooze Duration</InputLabel>
                      <Select
                        value={displayConfig.snooze.defaultDuration}
                        onChange={(e) => updateNestedConfig('snooze', {
                          defaultDuration: e.target.value
                        })}
                        label="Default Snooze Duration"
                      >
                        {SNOOZE_OPTIONS.map(option => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth>
                      <InputLabel>Maximum Snooze Duration</InputLabel>
                      <Select
                        value={displayConfig.snooze.maxDuration}
                        onChange={(e) => updateNestedConfig('snooze', {
                          maxDuration: e.target.value
                        })}
                        label="Maximum Snooze Duration"
                      >
                        {SNOOZE_OPTIONS.filter(o => o.value >= displayConfig.snooze.defaultDuration).map(option => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                </>
              )}
            </Grid>
          </AccordionDetails>
        </Accordion>

        {/* Timing Configuration */}
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1">
              Timing & Auto-behavior
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={displayConfig.timing.autoDisplay}
                      onChange={(e) => updateNestedConfig('timing', {
                        autoDisplay: e.target.checked
                      })}
                    />
                  }
                  label="Automatically display when triggered"
                />
              </Grid>

              {displayConfig.timing.autoDisplay && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2" gutterBottom>
                    Display Delay (seconds)
                  </Typography>
                  <Slider
                    value={displayConfig.timing.displayDelay}
                    onChange={(e, value) => updateNestedConfig('timing', {
                      displayDelay: value
                    })}
                    min={0}
                    max={10}
                    marks
                    valueLabelDisplay="auto"
                  />
                  <Typography variant="caption" color="text.secondary">
                    Delay before showing the alert (0 = immediate)
                  </Typography>
                </Grid>
              )}

              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={displayConfig.timing.autoDismiss}
                      onChange={(e) => updateNestedConfig('timing', {
                        autoDismiss: e.target.checked
                      })}
                    />
                  }
                  label="Auto-dismiss after timeout"
                />
              </Grid>

              {displayConfig.timing.autoDismiss && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2" gutterBottom>
                    Auto-dismiss After (seconds)
                  </Typography>
                  <Slider
                    value={displayConfig.timing.autoDismissDelay}
                    onChange={(e, value) => updateNestedConfig('timing', {
                      autoDismissDelay: value
                    })}
                    min={5}
                    max={120}
                    step={5}
                    marks={[
                      { value: 5, label: '5s' },
                      { value: 30, label: '30s' },
                      { value: 60, label: '1m' },
                      { value: 120, label: '2m' }
                    ]}
                    valueLabelDisplay="auto"
                  />
                </Grid>
              )}
            </Grid>
          </AccordionDetails>
        </Accordion>

        {/* Preview */}
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            Configuration Summary
          </Typography>
          <List dense>
            <ListItem>
              <ListItemText 
                primary="Default Mode"
                secondary={PRESENTATION_MODES.find(m => m.id === displayConfig.defaultMode)?.label}
              />
            </ListItem>
            {displayConfig.acknowledgment.required && (
              <ListItem>
                <ListItemText 
                  primary="Acknowledgment"
                  secondary={ACKNOWLEDGMENT_OPTIONS.find(a => a.id === displayConfig.acknowledgment.type)?.label}
                />
              </ListItem>
            )}
            {displayConfig.snooze.enabled && (
              <ListItem>
                <ListItemText 
                  primary="Snooze"
                  secondary={`Default: ${SNOOZE_OPTIONS.find(s => s.value === displayConfig.snooze.defaultDuration)?.label}`}
                />
              </ListItem>
            )}
          </List>
        </Paper>
      </Stack>
    </Box>
  );
};

export default DisplayBehaviorPanel;