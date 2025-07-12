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
  CardContent
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
  { value: 'top', label: 'Top of Screen', icon: '⬆️' },
  { value: 'right', label: 'Right Sidebar', icon: '➡️' },
  { value: 'bottom', label: 'Bottom Panel', icon: '⬇️' },
  { value: 'modal', label: 'Modal Dialog', icon: '🔲' }
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
    position: 'top',
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

        {/* Position */}
        <Box>
          <Typography variant="subtitle1" gutterBottom>Card Position</Typography>
          <Grid container spacing={2}>
            {CARD_POSITIONS.map(position => (
              <Grid item xs={6} md={3} key={position.value}>
                <Card 
                  variant={defaultConfig.position === position.value ? 'elevation' : 'outlined'}
                  sx={{ 
                    cursor: 'pointer',
                    border: defaultConfig.position === position.value ? 2 : 1,
                    borderColor: defaultConfig.position === position.value ? 'primary.main' : 'divider'
                  }}
                  onClick={() => handleChange('position', position.value)}
                >
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography variant="h4">{position.icon}</Typography>
                    <Typography variant="body2">{position.label}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
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
              <strong>Configuration Summary:</strong> Cards will be displayed{' '}
            </Typography>
            <Chip label={defaultConfig.displayMode} size="small" />
            <Typography variant="body2" component="span">
              {' '}at the{' '}
            </Typography>
            <Chip label={defaultConfig.position} size="small" />
            <Typography variant="body2" component="span">
              {' '}position, showing up to{' '}
            </Typography>
            <Chip label={`${defaultConfig.maxCards} cards`} size="small" />
            <Typography variant="body2" component="span">
              , sorted by{' '}
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