/**
 * DensityControl Component
 * Allows users to switch between compact/comfortable/spacious view modes
 * Persists preference in localStorage
 */
import React, { useState, useEffect } from 'react';
import {
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Box,
  Typography,
  useTheme,
  alpha
} from '@mui/material';
import {
  ViewCompact as CompactIcon,
  ViewComfortable as ComfortableIcon,
  ViewAgenda as SpaciousIcon,
  TableRows as RowsIcon,
  ViewModule as CardsIcon,
  ViewList as ListIcon
} from '@mui/icons-material';

const DENSITY_OPTIONS = [
  {
    value: 'compact',
    label: 'Compact',
    icon: <CompactIcon fontSize="small" />,
    description: 'Maximum information density'
  },
  {
    value: 'comfortable',
    label: 'Comfortable',
    icon: <ComfortableIcon fontSize="small" />,
    description: 'Balanced view (default)'
  },
  {
    value: 'spacious',
    label: 'Spacious',
    icon: <SpaciousIcon fontSize="small" />,
    description: 'More white space'
  }
];

const VIEW_OPTIONS = [
  {
    value: 'list',
    label: 'List',
    icon: <ListIcon fontSize="small" />,
    description: 'Traditional list view'
  },
  {
    value: 'cards',
    label: 'Cards',
    icon: <CardsIcon fontSize="small" />,
    description: 'Card-based layout'
  },
  {
    value: 'table',
    label: 'Table',
    icon: <RowsIcon fontSize="small" />,
    description: 'Tabular data view'
  }
];

const DensityControl = ({
  value = 'comfortable',
  onChange,
  showLabel = false,
  size = 'small',
  storageKey = 'clinicalDensity',
  options = DENSITY_OPTIONS,
  exclusive = true,
  orientation = 'horizontal'
}) => {
  const theme = useTheme();
  const [density, setDensity] = useState(value);

  // Load saved preference on mount
  useEffect(() => {
    if (storageKey) {
      const saved = localStorage.getItem(storageKey);
      if (saved && options.some(opt => opt.value === saved)) {
        setDensity(saved);
        onChange?.(saved);
      }
    }
  }, [storageKey, options, onChange]);

  const handleChange = (event, newValue) => {
    if (newValue !== null) {
      setDensity(newValue);
      onChange?.(newValue);
      
      // Save preference
      if (storageKey) {
        localStorage.setItem(storageKey, newValue);
      }
    }
  };

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 1
      }}
    >
      {showLabel && (
        <Typography variant="caption" color="text.secondary">
          View:
        </Typography>
      )}
      <ToggleButtonGroup
        value={density}
        exclusive={exclusive}
        onChange={handleChange}
        size={size}
        orientation={orientation}
        sx={{
          '& .MuiToggleButton-root': {
            px: size === 'small' ? 1 : 1.5,
            py: size === 'small' ? 0.5 : 1,
            '&.Mui-selected': {
              backgroundColor: alpha(theme.palette.primary.main, 0.12),
              color: theme.palette.primary.main,
              '&:hover': {
                backgroundColor: alpha(theme.palette.primary.main, 0.2)
              }
            }
          }
        }}
      >
        {options.map(option => (
          <Tooltip
            key={option.value}
            title={
              <Box>
                <Typography variant="body2" fontWeight={600}>
                  {option.label}
                </Typography>
                <Typography variant="caption">
                  {option.description}
                </Typography>
              </Box>
            }
            placement="top"
          >
            <ToggleButton value={option.value}>
              {option.icon}
              {size !== 'small' && (
                <Typography
                  variant="caption"
                  sx={{ ml: 0.5 }}
                >
                  {option.label}
                </Typography>
              )}
            </ToggleButton>
          </Tooltip>
        ))}
      </ToggleButtonGroup>
    </Box>
  );
};

// Compound component for both density and view mode
export const ViewControls = ({
  density = 'comfortable',
  viewMode = 'list',
  onDensityChange,
  onViewModeChange,
  showDensity = true,
  showViewMode = true,
  availableViews = ['list', 'cards', 'table'],
  size = 'small'
}) => {
  const filteredViewOptions = VIEW_OPTIONS.filter(opt => 
    availableViews.includes(opt.value)
  );

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2
      }}
    >
      {showDensity && (
        <DensityControl
          value={density}
          onChange={onDensityChange}
          size={size}
          storageKey="clinicalDensity"
        />
      )}
      
      {showDensity && showViewMode && (
        <Box
          sx={{
            height: 24,
            width: 1,
            backgroundColor: 'divider'
          }}
        />
      )}
      
      {showViewMode && (
        <DensityControl
          value={viewMode}
          onChange={onViewModeChange}
          options={filteredViewOptions}
          size={size}
          storageKey="clinicalViewMode"
        />
      )}
    </Box>
  );
};

// Hook to manage density state
export const useDensity = (initialDensity = 'comfortable', storageKey = 'clinicalDensity') => {
  const [density, setDensity] = useState(() => {
    if (storageKey) {
      const saved = localStorage.getItem(storageKey);
      return saved || initialDensity;
    }
    return initialDensity;
  });

  const updateDensity = (newDensity) => {
    setDensity(newDensity);
    if (storageKey) {
      localStorage.setItem(storageKey, newDensity);
    }
  };

  return [density, updateDensity];
};

export default DensityControl;