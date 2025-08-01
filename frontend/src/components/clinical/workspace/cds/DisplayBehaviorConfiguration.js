/**
 * Display Behavior Configuration for CDS Hooks
 * Allows configuration of how CDS alerts are presented to users
 */
import React from 'react';
import {
  Box,
  Typography,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  TextField,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid,
  FormHelperText
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

const DisplayBehaviorConfiguration = ({ config = {}, onChange }) => {
  // Default configuration
  const displayBehavior = {
    defaultMode: 'popup',
    acknowledgment: {
      required: false,
      reasonRequired: false
    },
    snooze: {
      enabled: true,
      defaultDuration: 60,
      maxDuration: 1440
    },
    indicatorOverrides: {
      critical: 'modal',
      warning: 'popup',
      info: 'inline'
    },
    ...config
  };

  const handleChange = (path, value) => {
    const newConfig = { ...displayBehavior };
    const keys = path.split('.');
    let current = newConfig;
    
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }
    
    current[keys[keys.length - 1]] = value;
    onChange(newConfig);
  };

  const presentationModes = [
    { value: 'inline', label: 'Inline', description: 'Shows within the page content' },
    { value: 'popup', label: 'Popup', description: 'Shows as a dialog box' },
    { value: 'modal', label: 'Modal', description: 'Hard-stop requiring acknowledgment' },
    { value: 'banner', label: 'Banner', description: 'Top of page banner' },
    { value: 'toast', label: 'Toast', description: 'Temporary notification' },
    { value: 'sidebar', label: 'Sidebar', description: 'Side panel' }
  ];

  const indicators = ['critical', 'warning', 'info'];

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h6" gutterBottom>
          Display Behavior Configuration
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Configure how CDS alerts are presented to users
        </Typography>
      </Box>

      {/* Default Presentation Mode */}
      <FormControl fullWidth>
        <InputLabel>Default Presentation Mode</InputLabel>
        <Select
          value={displayBehavior.defaultMode}
          label="Default Presentation Mode"
          onChange={(e) => handleChange('defaultMode', e.target.value)}
        >
          {presentationModes.map(mode => (
            <MenuItem key={mode.value} value={mode.value}>
              <Box>
                <Typography variant="body1">{mode.label}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {mode.description}
                </Typography>
              </Box>
            </MenuItem>
          ))}
        </Select>
        <FormHelperText>
          How alerts are displayed by default
        </FormHelperText>
      </FormControl>

      {/* Indicator-based Overrides */}
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle1">
            Severity-based Presentation
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Override presentation mode based on alert severity
            </Typography>
            <Grid container spacing={2}>
              {indicators.map(indicator => (
                <Grid item xs={12} sm={4} key={indicator}>
                  <FormControl fullWidth size="small">
                    <InputLabel>{indicator.charAt(0).toUpperCase() + indicator.slice(1)}</InputLabel>
                    <Select
                      value={displayBehavior.indicatorOverrides?.[indicator] || displayBehavior.defaultMode}
                      label={indicator.charAt(0).toUpperCase() + indicator.slice(1)}
                      onChange={(e) => handleChange(`indicatorOverrides.${indicator}`, e.target.value)}
                    >
                      {presentationModes.map(mode => (
                        <MenuItem key={mode.value} value={mode.value}>
                          {mode.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              ))}
            </Grid>
            <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              <InfoOutlinedIcon fontSize="small" color="action" />
              <Typography variant="caption" color="text.secondary">
                Critical alerts often use modal presentation to ensure they are not missed
              </Typography>
            </Box>
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* Acknowledgment Settings */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle1">
            Acknowledgment Requirements
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            <FormControlLabel
              control={
                <Switch
                  checked={displayBehavior.acknowledgment?.required || false}
                  onChange={(e) => handleChange('acknowledgment.required', e.target.checked)}
                />
              }
              label="Require acknowledgment"
            />
            {displayBehavior.acknowledgment?.required && (
              <FormControlLabel
                control={
                  <Switch
                    checked={displayBehavior.acknowledgment?.reasonRequired || false}
                    onChange={(e) => handleChange('acknowledgment.reasonRequired', e.target.checked)}
                  />
                }
                label="Require reason for override"
                sx={{ ml: 3 }}
              />
            )}
            <Typography variant="caption" color="text.secondary">
              When enabled, users must acknowledge alerts before proceeding
            </Typography>
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* Snooze Settings */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle1">
            Snooze Configuration
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            <FormControlLabel
              control={
                <Switch
                  checked={displayBehavior.snooze?.enabled || false}
                  onChange={(e) => handleChange('snooze.enabled', e.target.checked)}
                />
              }
              label="Allow snoozing alerts"
            />
            {displayBehavior.snooze?.enabled && (
              <>
                <TextField
                  type="number"
                  label="Default snooze duration (minutes)"
                  value={displayBehavior.snooze?.defaultDuration || 60}
                  onChange={(e) => handleChange('snooze.defaultDuration', parseInt(e.target.value))}
                  InputProps={{ inputProps: { min: 1, max: 1440 } }}
                  size="small"
                  fullWidth
                />
                <TextField
                  type="number"
                  label="Maximum snooze duration (minutes)"
                  value={displayBehavior.snooze?.maxDuration || 1440}
                  onChange={(e) => handleChange('snooze.maxDuration', parseInt(e.target.value))}
                  InputProps={{ inputProps: { min: 1, max: 10080 } }}
                  size="small"
                  fullWidth
                  helperText="Up to 7 days (10080 minutes)"
                />
              </>
            )}
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* Current Configuration Preview */}
      <Box sx={{ 
        p: 2, 
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: 1
      }}>
        <Typography variant="subtitle2" gutterBottom>
          Configuration Preview
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1 }}>
          <Chip 
            label={`Default: ${displayBehavior.defaultMode}`} 
            size="small" 
            color="primary"
          />
          {displayBehavior.acknowledgment?.required && (
            <Chip 
              label="Acknowledgment Required" 
              size="small" 
              color="warning"
            />
          )}
          {displayBehavior.snooze?.enabled && (
            <Chip 
              label={`Snooze: ${displayBehavior.snooze.defaultDuration}min`} 
              size="small"
            />
          )}
          {displayBehavior.indicatorOverrides?.critical === 'modal' && (
            <Chip 
              label="Critical → Modal" 
              size="small" 
              color="error"
            />
          )}
        </Stack>
      </Box>
    </Stack>
  );
};

export default DisplayBehaviorConfiguration;