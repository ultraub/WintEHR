/**
 * Age Condition Builder Component
 * Visual interface for building age-based conditions
 */
import React from 'react';
import {
  Box,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Stack,
  InputAdornment,
  Alert,
  Chip
} from '@mui/material';
import { Info as InfoIcon } from '@mui/icons-material';

const AGE_OPERATORS = [
  { value: 'equals', label: 'Equals', symbol: '=' },
  { value: 'greater_than', label: 'Greater Than', symbol: '>' },
  { value: 'greater_than_or_equal', label: 'Greater Than or Equal', symbol: '≥' },
  { value: 'less_than', label: 'Less Than', symbol: '<' },
  { value: 'less_than_or_equal', label: 'Less Than or Equal', symbol: '≤' },
  { value: 'between', label: 'Between', symbol: '↔' },
  { value: 'not_between', label: 'Not Between', symbol: '↮' }
];

const AGE_UNITS = [
  { value: 'years', label: 'Years', short: 'y' },
  { value: 'months', label: 'Months', short: 'mo' },
  { value: 'weeks', label: 'Weeks', short: 'w' },
  { value: 'days', label: 'Days', short: 'd' }
];

const AgeConditionBuilder = ({ condition, onChange }) => {
  const handleFieldChange = (field, value) => {
    onChange({ [field]: value });
  };

  // Initialize default values
  React.useEffect(() => {
    if (!condition.operator) {
      onChange({
        operator: 'greater_than',
        value: '',
        value2: '',
        unit: 'years'
      });
    }
  }, []);

  const renderValueFields = () => {
    const isBetween = condition.operator === 'between' || condition.operator === 'not_between';

    if (isBetween) {
      return (
        <>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              type="number"
              label="Min Age"
              value={condition.value || ''}
              onChange={(e) => handleFieldChange('value', e.target.value)}
              InputProps={{
                inputProps: { min: 0, max: 150 },
                endAdornment: (
                  <InputAdornment position="end">
                    {AGE_UNITS.find(u => u.value === condition.unit)?.short || 'y'}
                  </InputAdornment>
                )
              }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              type="number"
              label="Max Age"
              value={condition.value2 || ''}
              onChange={(e) => handleFieldChange('value2', e.target.value)}
              InputProps={{
                inputProps: { min: 0, max: 150 },
                endAdornment: (
                  <InputAdornment position="end">
                    {AGE_UNITS.find(u => u.value === condition.unit)?.short || 'y'}
                  </InputAdornment>
                )
              }}
            />
          </Grid>
        </>
      );
    }

    return (
      <Grid item xs={12} md={6}>
        <TextField
          fullWidth
          type="number"
          label="Age Value"
          value={condition.value || ''}
          onChange={(e) => handleFieldChange('value', e.target.value)}
          InputProps={{
            inputProps: { min: 0, max: 150 },
            endAdornment: (
              <InputAdornment position="end">
                {AGE_UNITS.find(u => u.value === condition.unit)?.short || 'y'}
              </InputAdornment>
            )
          }}
          helperText="Enter the age threshold"
        />
      </Grid>
    );
  };

  const getConditionSummary = () => {
    if (!condition.operator || !condition.value) return null;

    const operator = AGE_OPERATORS.find(op => op.value === condition.operator);
    const unit = AGE_UNITS.find(u => u.value === condition.unit);
    
    if (condition.operator === 'between' || condition.operator === 'not_between') {
      if (!condition.value2) return null;
      return `Age ${operator?.label.toLowerCase()} ${condition.value} and ${condition.value2} ${unit?.label.toLowerCase()}`;
    }
    
    return `Age ${operator?.symbol} ${condition.value} ${unit?.label.toLowerCase()}`;
  };

  return (
    <Box sx={{ mt: 2 }}>
      <Stack spacing={2}>
        <Alert severity="info" icon={<InfoIcon />}>
          Define age-based conditions for triggering this CDS hook. Age is calculated from the patient's date of birth.
        </Alert>

        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>Age Operator</InputLabel>
              <Select
                value={condition.operator || 'greater_than'}
                label="Age Operator"
                onChange={(e) => handleFieldChange('operator', e.target.value)}
              >
                {AGE_OPERATORS.map(op => (
                  <MenuItem key={op.value} value={op.value}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        {op.symbol}
                      </Typography>
                      <Typography>{op.label}</Typography>
                    </Stack>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {renderValueFields()}

          <Grid item xs={12} md={2}>
            <FormControl fullWidth>
              <InputLabel>Unit</InputLabel>
              <Select
                value={condition.unit || 'years'}
                label="Unit"
                onChange={(e) => handleFieldChange('unit', e.target.value)}
              >
                {AGE_UNITS.map(unit => (
                  <MenuItem key={unit.value} value={unit.value}>
                    {unit.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        {/* Condition Summary */}
        {getConditionSummary() && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Condition Summary:
            </Typography>
            <Chip 
              label={getConditionSummary()} 
              color="primary" 
              variant="outlined"
              size="small"
              sx={{ ml: 1 }}
            />
          </Box>
        )}

        {/* Common Age Presets */}
        <Box>
          <Typography variant="caption" color="text.secondary" gutterBottom>
            Quick Presets:
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap">
            <Chip
              label="Pediatric (<18y)"
              size="small"
              onClick={() => onChange({
                operator: 'less_than',
                value: '18',
                unit: 'years'
              })}
              clickable
            />
            <Chip
              label="Adult (≥18y)"
              size="small"
              onClick={() => onChange({
                operator: 'greater_than_or_equal',
                value: '18',
                unit: 'years'
              })}
              clickable
            />
            <Chip
              label="Elderly (≥65y)"
              size="small"
              onClick={() => onChange({
                operator: 'greater_than_or_equal',
                value: '65',
                unit: 'years'
              })}
              clickable
            />
            <Chip
              label="Infant (<1y)"
              size="small"
              onClick={() => onChange({
                operator: 'less_than',
                value: '1',
                unit: 'years'
              })}
              clickable
            />
            <Chip
              label="Newborn (<30d)"
              size="small"
              onClick={() => onChange({
                operator: 'less_than',
                value: '30',
                unit: 'days'
              })}
              clickable
            />
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
};

export default AgeConditionBuilder;