/**
 * QuickThemeToggle Component
 * Provides quick access to theme switching from the main navigation
 * 
 * @since 2025-01-21
 */
import React, { useContext, useState } from 'react';
import {
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Box,
  Typography,
  Switch,
  Stack,
  Fade,
  ToggleButton,
  ToggleButtonGroup,
  useTheme,
  alpha
} from '@mui/material';
import {
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
  Palette as PaletteIcon,
  Check as CheckIcon,
  LocalHospital as MedicalIcon,
  Accessibility as AccessibilityIcon,
  AutoAwesome as AutoIcon,
  BrightnessAuto as AutoModeIcon,
  WbTwilight as TwilightIcon,
} from '@mui/icons-material';
import { PHASES, PHASE_LABELS } from '../../themes/auroraPalette';
import { MedicalThemeContext } from '../../App';

const QuickThemeToggle = ({ 
  showLabel = false, 
  size = 'medium',
  position = 'header' 
}) => {
  const context = useContext(MedicalThemeContext);
  const theme = useTheme();
  const {
    currentMode = 'light',
    currentTheme = 'professional',
    autoDetectContext = false,
    phase = currentMode === 'dark' ? 'night' : 'day',
    phaseSetting = phase,
    onPhaseSettingChange,
    onModeChange,
    onThemeChange,
    onAutoDetectChange
  } = context || {};

  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  // The header button steps through: follow the clock, daytime, night.
  // Sunrise and sunset can be pinned from the menu.
  const nextSetting = phaseSetting === 'auto' ? 'day' : phaseSetting === 'day' ? 'night' : 'auto';
  const handleModeToggle = () => {
    if (onPhaseSettingChange) onPhaseSettingChange(nextSetting);
    else onModeChange?.(currentMode === 'light' ? 'dark' : 'light');
  };
  const settingLabel = (setting) => (setting === 'auto' ? 'follow the time of day' : PHASE_LABELS[setting].toLowerCase());
  const toggleTitle = phaseSetting === 'auto'
    ? `Following the time of day (${PHASE_LABELS[phase].toLowerCase()} now). Switch to ${settingLabel(nextSetting)}`
    : `${PHASE_LABELS[phase]}. Switch to ${settingLabel(nextSetting)}`;
  const toggleIcon = phaseSetting === 'auto'
    ? <AutoModeIcon />
    : phase === 'night' ? <DarkModeIcon /> : phase === 'day' ? <LightModeIcon /> : <TwilightIcon />;

  const handleThemeSelect = (themeName) => {
    onThemeChange?.(themeName);
    handleClose();
  };

  const handleAutoDetectToggle = () => {
    onAutoDetectChange?.(!autoDetectContext);
  };

  // Theme options with icons
  const themeOptions = [
    { id: 'professional', name: 'Standard', icon: <MedicalIcon />, description: 'The default WintEHR look' },
    { id: 'accessible', name: 'High contrast', icon: <AccessibilityIcon />, description: 'Stronger contrast for readability' },
  ];

  // Quick toggle button (dark/light mode)
  const quickToggleButton = (
    <Tooltip title={toggleTitle}>
      <IconButton
        onClick={handleModeToggle}
        size={size}
        sx={{
          color: theme.palette.text.primary,
          backgroundColor: alpha(theme.palette.primary.main, 0.08),
          '&:hover': {
            backgroundColor: alpha(theme.palette.primary.main, 0.12),
          },
          transition: 'all 0.3s ease-in-out',
          mr: 1
        }}
        aria-label={toggleTitle}
      >
        {toggleIcon}
      </IconButton>
    </Tooltip>
  );

  // Theme selector button
  const themeSelectorButton = (
    <Tooltip title="Theme settings">
      <IconButton
        onClick={handleClick}
        size={size}
        sx={{
          color: theme.palette.text.primary,
          '&:hover': {
            backgroundColor: alpha(theme.palette.primary.main, 0.08),
          }
        }}
      >
        <PaletteIcon />
      </IconButton>
    </Tooltip>
  );

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        {quickToggleButton}
        {themeSelectorButton}
        {showLabel && (
          <Typography variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>
            {currentTheme} • {currentMode}
          </Typography>
        )}
      </Box>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        TransitionComponent={Fade}
        PaperProps={{
          sx: {
            mt: 1.5,
            minWidth: 280,
            borderRadius: 2,
            boxShadow: theme.shadows[8],
            backgroundColor: theme.palette.mode === 'dark' 
              ? theme.palette.background.paper 
              : theme.palette.background.default,
          }
        }}
      >
        {/* Theme Selection */}
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography variant="subtitle2" color="text.secondary">
            Color Scheme
          </Typography>
        </Box>
        
        {themeOptions.map((option) => (
          <MenuItem
            key={option.id}
            onClick={() => handleThemeSelect(option.id)}
            selected={currentTheme === option.id}
            sx={{
              py: 1.5,
              '&.Mui-selected': {
                backgroundColor: alpha(theme.palette.primary.main, 0.08),
                '&:hover': {
                  backgroundColor: alpha(theme.palette.primary.main, 0.12),
                }
              }
            }}
          >
            <ListItemIcon>
              {option.icon}
            </ListItemIcon>
            <ListItemText 
              primary={option.name}
              secondary={option.description}
              secondaryTypographyProps={{ variant: 'caption' }}
            />
            {currentTheme === option.id && (
              <CheckIcon fontSize="small" color="primary" />
            )}
          </MenuItem>
        ))}

        <Divider sx={{ my: 1 }} />

        {/* Auto-detect Context */}
        <MenuItem 
          onClick={handleAutoDetectToggle}
          sx={{ py: 1.5 }}
        >
          <ListItemIcon>
            <AutoIcon />
          </ListItemIcon>
          <ListItemText 
            primary="Auto-detect Context"
            secondary="Adjust theme by department & time"
            secondaryTypographyProps={{ variant: 'caption' }}
          />
          <Switch
            edge="end"
            checked={autoDetectContext}
            size="small"
          />
        </MenuItem>

        <Divider sx={{ my: 1 }} />

        {/* Time of day: follow the clock, or pin one phase */}
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Time of day
          </Typography>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={phaseSetting}
            onChange={(event, value) => { if (value) onPhaseSettingChange?.(value); }}
            aria-label="Time of day"
            sx={{ flexWrap: 'wrap' }}
          >
            <ToggleButton value="auto">Auto</ToggleButton>
            {PHASES.map((name) => (
              <ToggleButton key={name} value={name}>{PHASE_LABELS[name]}</ToggleButton>
            ))}
          </ToggleButtonGroup>
          <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.75 }}>
            Auto follows the clock: sunrise 5–8, daytime 8–5, sunset 5–8, then night.
          </Typography>
        </Box>
      </Menu>
    </>
  );
};

// Compact version for mobile or limited space
export const CompactThemeToggle = () => {
  const context = useContext(MedicalThemeContext);
  const { currentMode = 'light', onModeChange } = context || {};

  const handleToggle = () => {
    const newMode = currentMode === 'light' ? 'dark' : 'light';
    onModeChange?.(newMode);
  };

  return (
    <IconButton onClick={handleToggle} size="small">
      {currentMode === 'light' ? <DarkModeIcon /> : <LightModeIcon />}
    </IconButton>
  );
};

export default QuickThemeToggle;