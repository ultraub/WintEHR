/**
 * Modifier Selector Component
 * 
 * Visual interface for selecting and applying search parameter modifiers
 */

import React, { useState, useMemo } from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Typography,
  Tooltip,
  IconButton,
  Alert,
  Stack,
  Paper
} from '@mui/material';
import {
  Help as HelpIcon,
  Info as InfoIcon
} from '@mui/icons-material';

// Modifier definitions
const MODIFIERS = {
  string: {
    exact: { label: ':exact', description: 'Match the entire string exactly' },
    contains: { label: ':contains', description: 'Match anywhere in the string' },
    missing: { label: ':missing', description: 'Search for missing values' }
  },
  token: {
    text: { label: ':text', description: 'Search on text associated with the code' },
    not: { label: ':not', description: 'Reverse the code matching' },
    above: { label: ':above', description: 'Search for codes above in hierarchy' },
    below: { label: ':below', description: 'Search for codes below in hierarchy' },
    in: { label: ':in', description: 'Search for codes in the specified value set' },
    'not-in': { label: ':not-in', description: 'Search for codes not in the value set' },
    missing: { label: ':missing', description: 'Search for missing values' }
  },
  reference: {
    missing: { label: ':missing', description: 'Search for missing references' },
    type: { label: ':[type]', description: 'Specify resource type for polymorphic references' }
  },
  date: {
    missing: { label: ':missing', description: 'Search for missing dates' }
  },
  quantity: {
    missing: { label: ':missing', description: 'Search for missing quantities' }
  },
  number: {
    missing: { label: ':missing', description: 'Search for missing numbers' }
  },
  uri: {
    below: { label: ':below', description: 'Search for URIs that are hierarchically below' },
    above: { label: ':above', description: 'Search for URIs that are hierarchically above' },
    missing: { label: ':missing', description: 'Search for missing URIs' }
  }
};

// Comparator prefixes for quantity/number/date
const COMPARATORS = {
  eq: { symbol: '', label: 'equals', description: 'Equal to the given value' },
  ne: { symbol: 'ne', label: 'not equals', description: 'Not equal to the given value' },
  gt: { symbol: 'gt', label: 'greater than', description: 'Greater than the given value' },
  lt: { symbol: 'lt', label: 'less than', description: 'Less than the given value' },
  ge: { symbol: 'ge', label: 'greater or equal', description: 'Greater than or equal to the given value' },
  le: { symbol: 'le', label: 'less or equal', description: 'Less than or equal to the given value' },
  sa: { symbol: 'sa', label: 'starts after', description: 'Starts after the given value' },
  eb: { symbol: 'eb', label: 'ends before', description: 'Ends before the given value' },
  ap: { symbol: 'ap', label: 'approximately', description: 'Approximately equal to the given value' }
};

function ModifierSelector({ 
  parameterType, 
  value, 
  onChange, 
  showHelp = false,
  size = 'small',
  fullWidth = true
}) {
  const [localShowHelp, setLocalShowHelp] = useState(showHelp);

  // Get available modifiers for parameter type
  const availableModifiers = useMemo(() => {
    const typeModifiers = MODIFIERS[parameterType] || {};
    
    // Add comparators for numeric/date types
    if (['quantity', 'number', 'date'].includes(parameterType)) {
      return { ...COMPARATORS, ...typeModifiers };
    }
    
    return typeModifiers;
  }, [parameterType]);

  // Parse current value to extract modifier
  const currentModifier = useMemo(() => {
    if (!value) return '';
    
    // Check for comparator prefixes
    for (const [key, comp] of Object.entries(COMPARATORS)) {
      if (comp.symbol && value.startsWith(comp.symbol)) {
        return key;
      }
    }
    
    // Check for suffix modifiers
    const colonIndex = value.indexOf(':');
    if (colonIndex > 0) {
      const modifier = value.substring(colonIndex);
      return modifier;
    }
    
    return '';
  }, [value]);

  // Handle modifier change
  const handleModifierChange = (modifier) => {
    if (!onChange) return;
    
    let newValue = value || '';
    
    // Remove existing modifier
    if (currentModifier) {
      if (COMPARATORS[currentModifier]) {
        newValue = newValue.substring(COMPARATORS[currentModifier].symbol.length);
      } else {
        const colonIndex = newValue.indexOf(':');
        if (colonIndex > 0) {
          newValue = newValue.substring(0, colonIndex);
        }
      }
    }
    
    // Add new modifier
    if (modifier) {
      if (COMPARATORS[modifier]) {
        newValue = COMPARATORS[modifier].symbol + newValue;
      } else {
        newValue = newValue + modifier;
      }
    }
    
    onChange(newValue);
  };

  if (!parameterType) {
    return null;
  }

  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center">
        <FormControl size={size} fullWidth={fullWidth}>
          <InputLabel>Modifier</InputLabel>
          <Select
            value={currentModifier}
            onChange={(e) => handleModifierChange(e.target.value)}
            label="Modifier"
          >
            <MenuItem value="">
              <em>None</em>
            </MenuItem>
            {Object.entries(availableModifiers).map(([key, mod]) => (
              <MenuItem key={key} value={mod.symbol || mod.label}>
                <Box>
                  <Typography variant="body2">
                    {mod.label} {mod.symbol && `(${mod.symbol})`}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {mod.description}
                  </Typography>
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        
        <Tooltip title="Modifier Help">
          <IconButton 
            size="small" 
            onClick={() => setLocalShowHelp(!localShowHelp)}
          >
            <HelpIcon />
          </IconButton>
        </Tooltip>
      </Stack>

      {localShowHelp && (
        <Paper sx={{ mt: 2, p: 2 }} variant="outlined">
          <Typography variant="subtitle2" gutterBottom>
            Search Parameter Modifiers
          </Typography>
          
          <Typography variant="body2" paragraph>
            Modifiers change how search parameters match values:
          </Typography>
          
          <Stack spacing={1}>
            {Object.entries(availableModifiers).map(([key, mod]) => (
              <Box key={key}>
                <Chip 
                  label={mod.label} 
                  size="small" 
                  sx={{ mr: 1 }} 
                />
                <Typography variant="caption" color="text.secondary">
                  {mod.description}
                </Typography>
              </Box>
            ))}
          </Stack>
          
          {['quantity', 'number', 'date'].includes(parameterType) && (
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="caption">
                For {parameterType} parameters, you can use comparison operators 
                to search for ranges of values.
              </Typography>
            </Alert>
          )}
        </Paper>
      )}
    </Box>
  );
}

export default ModifierSelector;