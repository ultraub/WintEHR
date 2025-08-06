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
  Favorite as WarmIcon,
  AutoAwesome as AutoIcon,
  Water as OceanIcon,
  Park as ForestIcon,
  WbSunny as SunriseIcon,
  NightsStay as MidnightIcon,
  FilterBAndW as MonochromeIcon,
  ChildFriendly as PediatricIcon
} from '@mui/icons-material';
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

  const handleModeToggle = () => {
    const newMode = currentMode === 'light' ? 'dark' : 'light';
    onModeChange?.(newMode);
  };

  const handleThemeSelect = (themeName) => {
    onThemeChange?.(themeName);
    handleClose();
  };

  const handleAutoDetectToggle = () => {
    onAutoDetectChange?.(!autoDetectContext);
  };

  // Theme options with icons
  const themeOptions = [
    { 
      id: 'professional', 
      name: 'Professional', 
      icon: <MedicalIcon />,
      description: 'Clean medical interface'
    },
    { 
      id: 'accessible', 
      name: 'High Contrast', 
      icon: <AccessibilityIcon />,
      description: 'Maximum readability'
    },
    { 
      id: 'warm', 
      name: 'Warm Clinical', 
      icon: <WarmIcon />,
      description: 'Comfortable colors'
    },
    { 
      id: 'ocean', 
      name: 'Ocean Health', 
      icon: <OceanIcon />,
      description: 'Calming blues and teals'
    },
    { 
      id: 'forest', 
      name: 'Forest Wellness', 
      icon: <ForestIcon />,
      description: 'Natural greens'
    },
    { 
      id: 'sunrise', 
      name: 'Sunrise Care', 
      icon: <SunriseIcon />,
      description: 'Warm oranges and yellows'
    },
    { 
      id: 'midnight', 
      name: 'Midnight Shift', 
      icon: <MidnightIcon />,
      description: 'Ultra-dark theme'
    },
    { 
      id: 'monochrome', 
      name: 'Monochrome', 
      icon: <MonochromeIcon />,
      description: 'Grayscale minimal'
    },
    { 
      id: 'pediatric', 
      name: 'Pediatric', 
      icon: <PediatricIcon />,
      description: 'Bright and cheerful'
    }
  ];

  // Quick toggle button (dark/light mode)
  const quickToggleButton = (
    <Tooltip title={`Switch to ${currentMode === 'light' ? 'dark' : 'light'} mode`}>
      <IconButton
        onClick={handleModeToggle}
        size={size}
        sx={{
          color: theme.palette.text.primary,
          backgroundColor: alpha(theme.palette.primary.main, 0.08),
          '&:hover': {
            backgroundColor: alpha(theme.palette.primary.main, 0.12),
            transform: 'rotate(180deg)',
          },
          transition: 'all 0.3s ease-in-out',
          mr: 1
        }}
      >
        {currentMode === 'light' ? <DarkModeIcon /> : <LightModeIcon />}
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

        {/* Mode Quick Switch */}
        <Box sx={{ px: 2, py: 1.5 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="body2">
              Dark Mode
            </Typography>
            <Switch
              checked={currentMode === 'dark'}
              onChange={handleModeToggle}
              size="small"
              color="primary"
            />
          </Stack>
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