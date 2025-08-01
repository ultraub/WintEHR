/**
 * Display Behavior Configuration Component
 * Controls how CDS cards are displayed and interacted with
 */
import React from 'react';
import {
  Box,
  Paper,
  Typography,
  FormControl,
  FormControlLabel,
  RadioGroup,
  Radio,
  Switch,
  Stack,
  Grid,
  TextField,
  Slider,
  Alert,
  Chip,
  Divider,
  Card,
  CardContent,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  Timer as TimerIcon,
  Sort as SortIcon,
  FilterList as FilterIcon
} from '@mui/icons-material';

const DISPLAY_MODES = [
  { 
    value: 'immediate', 
    label: 'Immediate', 
    description: 'Show cards immediately when conditions are met' 
  },
  { 
    value: 'user-action', 
    label: 'On User Action', 
    description: 'Show cards only when user requests them' 
  },
  { 
    value: 'delayed', 
    label: 'Delayed', 
    description: 'Show cards after a specified delay' 
  }
];

const CARD_POSITIONS = [
  { value: 'inline', label: 'Inline', icon: '📋', description: 'Within page content' },
  { value: 'popup', label: 'Popup Dialog', icon: '💬', description: 'Non-blocking dialog' },
  { value: 'modal', label: 'Modal (Hard-stop)', icon: '🛑', description: 'Requires acknowledgment' },
  { value: 'banner', label: 'Top Banner', icon: '🔔', description: 'Page-wide banner' },
  { value: 'sidebar', label: 'Right Sidebar', icon: '➡️', description: 'Side panel' },
  { value: 'toast', label: 'Toast', icon: '🍞', description: 'Temporary notification' }
];

const PRIORITY_LEVELS = [
  { value: 'critical-first', label: 'Critical First', description: 'Show critical alerts before warnings' },
  { value: 'newest-first', label: 'Newest First', description: 'Show most recent alerts first' },
  { value: 'relevant-first', label: 'Most Relevant', description: 'AI-determined relevance ordering' }
];

const DisplayBehaviorConfig = ({ config = {}, onChange }) => {
  const handleChange = (field, value) => {
    onChange({ ...config, [field]: value });
  };

  const defaultConfig = {
    displayMode: 'immediate',
    defaultMode: config.defaultMode || 'popup', // CDS Hooks presentation mode
    position: config.position || config.defaultMode || 'popup', // Legacy support
    indicatorOverrides: config.indicatorOverrides || {
      critical: 'modal',
      warning: 'popup',
      info: 'inline'
    },
    acknowledgment: config.acknowledgment || {
      required: false,
      reasonRequired: false
    },
    snooze: config.snooze || {
      enabled: true,
      defaultDuration: 60,
      maxDuration: 1440
    },
    delay: 0,
    autoHide: false,
    autoHideDelay: 30,
    maxCards: 10,
    groupByService: true,
    allowDismiss: true,
    persistDismissals: true,
    animation: true,
    sound: false,
    priority: 'critical-first',
    filterDuplicates: true,
    ...config
  };

  return (
    <Paper elevation={1} sx={{ p: 3 }}>
      <Stack spacing={3}>
        <Typography variant="h6" gutterBottom>
          Display Behavior Configuration
        </Typography>

        <Divider />

        {/* Display Mode */}
        <Box>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
            <VisibilityIcon color="primary" />
            <Typography variant="subtitle1">Display Mode</Typography>
          </Stack>
          <FormControl component="fieldset">
            <RadioGroup
              value={defaultConfig.displayMode}
              onChange={(e) => handleChange('displayMode', e.target.value)}
            >
              {DISPLAY_MODES.map(mode => (
                <FormControlLabel
                  key={mode.value}
                  value={mode.value}
                  control={<Radio />}
                  label={
                    <Box>
                      <Typography variant="body1">{mode.label}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {mode.description}
                      </Typography>
                    </Box>
                  }
                />
              ))}
            </RadioGroup>
          </FormControl>

          {defaultConfig.displayMode === 'delayed' && (
            <Box sx={{ mt: 2, ml: 4 }}>
              <Typography gutterBottom>Delay (seconds)</Typography>
              <Slider
                value={defaultConfig.delay}
                onChange={(e, value) => handleChange('delay', value)}
                min={0}
                max={60}
                step={5}
                marks
                valueLabelDisplay="auto"
              />
            </Box>
          )}
        </Box>

        <Divider />

        {/* Default Presentation Mode */}
        <Box>
          <Typography variant="subtitle1" gutterBottom>Default Presentation Mode</Typography>
          <Grid container spacing={2}>
            {CARD_POSITIONS.map(position => (
              <Grid item xs={6} md={4} key={position.value}>
                <Card 
                  variant={defaultConfig.defaultMode === position.value ? 'elevation' : 'outlined'}
                  sx={{ 
                    cursor: 'pointer',
                    border: defaultConfig.defaultMode === position.value ? 2 : 1,
                    borderColor: defaultConfig.defaultMode === position.value ? 'primary.main' : 'divider'
                  }}
                  onClick={() => handleChange('defaultMode', position.value)}
                >
                  <CardContent sx={{ textAlign: 'center', p: 1.5 }}>
                    <Typography variant="h4">{position.icon}</Typography>
                    <Typography variant="body2" fontWeight="bold">{position.label}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {position.description}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>

        <Divider />

        {/* Indicator-based Overrides */}
        <Box>
          <Typography variant="subtitle1" gutterBottom>Severity-based Presentation</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Override presentation mode based on alert severity
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Critical Alerts</InputLabel>
                <Select
                  value={defaultConfig.indicatorOverrides?.critical || 'modal'}
                  onChange={(e) => handleChange('indicatorOverrides', {
                    ...defaultConfig.indicatorOverrides,
                    critical: e.target.value
                  })}
                  label="Critical Alerts"
                >
                  {CARD_POSITIONS.map(pos => (
                    <MenuItem key={pos.value} value={pos.value}>{pos.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Warning Alerts</InputLabel>
                <Select
                  value={defaultConfig.indicatorOverrides?.warning || 'popup'}
                  onChange={(e) => handleChange('indicatorOverrides', {
                    ...defaultConfig.indicatorOverrides,
                    warning: e.target.value
                  })}
                  label="Warning Alerts"
                >
                  {CARD_POSITIONS.map(pos => (
                    <MenuItem key={pos.value} value={pos.value}>{pos.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Info Alerts</InputLabel>
                <Select
                  value={defaultConfig.indicatorOverrides?.info || 'inline'}
                  onChange={(e) => handleChange('indicatorOverrides', {
                    ...defaultConfig.indicatorOverrides,
                    info: e.target.value
                  })}
                  label="Info Alerts"
                >
                  {CARD_POSITIONS.map(pos => (
                    <MenuItem key={pos.value} value={pos.value}>{pos.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
          {defaultConfig.indicatorOverrides?.critical === 'modal' && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Critical alerts will show as modal dialogs that require acknowledgment before continuing.
            </Alert>
          )}
        </Box>

        <Divider />

        {/* Auto-hide Settings */}
        <Box>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
            <TimerIcon color="primary" />
            <Typography variant="subtitle1">Auto-hide Settings</Typography>
          </Stack>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={defaultConfig.autoHide}
                    onChange={(e) => handleChange('autoHide', e.target.checked)}
                  />
                }
                label="Auto-hide cards after display"
              />
            </Grid>
            {defaultConfig.autoHide && (
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Auto-hide delay (seconds)"
                  value={defaultConfig.autoHideDelay}
                  onChange={(e) => handleChange('autoHideDelay', parseInt(e.target.value))}
                  InputProps={{
                    inputProps: { min: 5, max: 300, step: 5 }
                  }}
                />
              </Grid>
            )}
          </Grid>
        </Box>

        <Divider />

        {/* Filtering and Limits */}
        <Box>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
            <FilterIcon color="primary" />
            <Typography variant="subtitle1">Filtering & Limits</Typography>
          </Stack>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label="Maximum cards to display"
                value={defaultConfig.maxCards}
                onChange={(e) => handleChange('maxCards', parseInt(e.target.value))}
                InputProps={{
                  inputProps: { min: 1, max: 50 }
                }}
                helperText="Limit the number of cards shown at once"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <FormControlLabel
                  control={
                    <Switch
                      checked={defaultConfig.filterDuplicates}
                      onChange={(e) => handleChange('filterDuplicates', e.target.checked)}
                    />
                  }
                  label="Filter duplicate alerts"
                />
              </FormControl>
            </Grid>
          </Grid>
        </Box>

        <Divider />

        {/* Sorting and Priority */}
        <Box>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
            <SortIcon color="primary" />
            <Typography variant="subtitle1">Sorting & Priority</Typography>
          </Stack>
          <FormControl component="fieldset">
            <RadioGroup
              value={defaultConfig.priority}
              onChange={(e) => handleChange('priority', e.target.value)}
            >
              {PRIORITY_LEVELS.map(level => (
                <FormControlLabel
                  key={level.value}
                  value={level.value}
                  control={<Radio />}
                  label={
                    <Box>
                      <Typography variant="body1">{level.label}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {level.description}
                      </Typography>
                    </Box>
                  }
                />
              ))}
            </RadioGroup>
          </FormControl>
        </Box>

        <Divider />

        {/* Additional Options */}
        <Box>
          <Typography variant="subtitle1" gutterBottom>Additional Options</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={defaultConfig.groupByService}
                    onChange={(e) => handleChange('groupByService', e.target.checked)}
                  />
                }
                label="Group cards by service"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={defaultConfig.allowDismiss}
                    onChange={(e) => handleChange('allowDismiss', e.target.checked)}
                  />
                }
                label="Allow users to dismiss cards"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={defaultConfig.persistDismissals}
                    onChange={(e) => handleChange('persistDismissals', e.target.checked)}
                    disabled={!defaultConfig.allowDismiss}
                  />
                }
                label="Remember dismissed cards"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={defaultConfig.animation}
                    onChange={(e) => handleChange('animation', e.target.checked)}
                  />
                }
                label="Enable animations"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={defaultConfig.sound}
                    onChange={(e) => handleChange('sound', e.target.checked)}
                  />
                }
                label="Play sound for critical alerts"
              />
            </Grid>
          </Grid>
        </Box>

        {/* Preview Summary */}
        <Alert severity="info">
          <Box component="div">
            <Typography variant="body2" component="span">
              <strong>Configuration Summary:</strong> Cards will use{' '}
            </Typography>
            <Chip label={defaultConfig.defaultMode} size="small" color="primary" />
            <Typography variant="body2" component="span">
              {' '}presentation by default
            </Typography>
            {defaultConfig.indicatorOverrides?.critical === 'modal' && (
              <>
                <Typography variant="body2" component="span">
                  {', with critical alerts shown as '}
                </Typography>
                <Chip label="modal" size="small" color="error" />
              </>
            )}
            <Typography variant="body2" component="span">
              {', displaying up to '}
            </Typography>
            <Chip label={`${defaultConfig.maxCards} cards`} size="small" />
            <Typography variant="body2" component="span">
              {' sorted by '}
            </Typography>
            <Chip label={defaultConfig.priority} size="small" />
            <Typography variant="body2" component="span">
              .
            </Typography>
          </Box>
        </Alert>
      </Stack>
    </Paper>
  );
};

export default DisplayBehaviorConfig;