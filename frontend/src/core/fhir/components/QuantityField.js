/**
 * QuantityField Component
 * Standardized FHIR Quantity input with unit validation
 */
import React, { useState } from 'react';
import {
  Grid,
  TextField,
  Autocomplete,
  FormControl,
  FormLabel,
  FormHelperText,
  InputAdornment,
  Box
} from '@mui/material';

const QuantityField = ({
  label,
  value,
  onChange,
  error,
  helperText,
  required = false,
  disabled = false,
  unitOptions = [],
  allowCustomUnit = true,
  unitSystem = 'http://unitsofmeasure.org', // UCUM by default
  decimalPlaces = 2,
  min,
  max,
  step,
  fullWidth = true,
  ...props
}) => {
  const [unitSearchValue, setUnitSearchValue] = useState('');

  // Parse FHIR Quantity value
  const parsedValue = value || {};
  const numericValue = parsedValue.value || '';
  const unit = parsedValue.unit || '';
  const code = parsedValue.code || unit;
  const system = parsedValue.system || unitSystem;

  // Handle numeric value change
  const handleValueChange = (event) => {
    const newValue = event.target.value;
    
    // Validate numeric input
    if (newValue && isNaN(parseFloat(newValue))) {
      return; // Don't update if not a valid number
    }
    
    const updatedQuantity = {
      ...parsedValue,
      value: newValue ? parseFloat(newValue) : undefined
    };
    
    // Remove empty fields
    Object.keys(updatedQuantity).forEach(key => {
      if (updatedQuantity[key] === undefined || updatedQuantity[key] === '') {
        delete updatedQuantity[key];
      }
    });
    
    onChange(Object.keys(updatedQuantity).length > 0 ? updatedQuantity : null);
  };

  // Handle unit change
  const handleUnitChange = (event, newUnit) => {
    const selectedUnit = typeof newUnit === 'string' ? newUnit : newUnit?.code || newUnit?.display || newUnit;
    
    const updatedQuantity = {
      ...parsedValue,
      unit: selectedUnit,
      code: selectedUnit,
      system: unitSystem
    };
    
    // Remove empty fields
    Object.keys(updatedQuantity).forEach(key => {
      if (updatedQuantity[key] === undefined || updatedQuantity[key] === '') {
        delete updatedQuantity[key];
      }
    });
    
    onChange(Object.keys(updatedQuantity).length > 0 ? updatedQuantity : null);
  };

  // Format unit options for autocomplete
  const formatUnitOptions = () => {
    return unitOptions.map(option => {
      if (typeof option === 'string') {
        return { code: option, display: option };
      }
      return {
        code: option.code || option.value,
        display: option.display || option.label || option.code || option.value,
        system: option.system || unitSystem
      };
    });
  };

  const formattedUnitOptions = formatUnitOptions();

  // Get option label for unit autocomplete
  const getUnitOptionLabel = (option) => {
    if (typeof option === 'string') return option;
    return option.display || option.code || '';
  };

  // Check if unit option equals current value
  const isUnitOptionEqualToValue = (option, value) => {
    const optionCode = typeof option === 'string' ? option : option.code;
    return optionCode === value;
  };

  // Validate numeric input
  const validateNumericValue = (val) => {
    if (!val) return null;
    
    const num = parseFloat(val);
    if (isNaN(num)) return 'Must be a valid number';
    if (min !== undefined && num < min) return `Must be at least ${min}`;
    if (max !== undefined && num > max) return `Must be at most ${max}`;
    
    return null;
  };

  const numericError = validateNumericValue(numericValue);

  return (
    <FormControl fullWidth={fullWidth} error={!!(error || numericError)}>
      {label && (
        <FormLabel 
          required={required}
          sx={{ mb: 1, fontSize: '0.875rem', fontWeight: 500 }}
        >
          {label}
        </FormLabel>
      )}
      
      <Grid container spacing={2}>
        {/* Numeric Value */}
        <Grid item xs={6}>
          <TextField
            type="number"
            value={numericValue}
            onChange={handleValueChange}
            disabled={disabled}
            placeholder="Value"
            variant="outlined"
            size="small"
            fullWidth
            error={!!numericError}
            inputProps={{
              step: step || (decimalPlaces > 0 ? Math.pow(10, -decimalPlaces) : 1),
              min: min,
              max: max
            }}
            {...props}
          />
        </Grid>
        
        {/* Unit */}
        <Grid item xs={6}>
          <Autocomplete
            value={unit}
            onChange={handleUnitChange}
            inputValue={unitSearchValue}
            onInputChange={(event, newInputValue) => {
              setUnitSearchValue(newInputValue);
            }}
            options={formattedUnitOptions}
            getOptionLabel={getUnitOptionLabel}
            isOptionEqualToValue={isUnitOptionEqualToValue}
            freeSolo={allowCustomUnit}
            disabled={disabled}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder="Unit"
                variant="outlined"
                size="small"
                fullWidth
              />
            )}
          />
        </Grid>
      </Grid>
      
      {/* Display current FHIR value for debugging (only in development) */}
      {process.env.NODE_ENV === 'development' && value && (
        <Box sx={{ mt: 1, p: 1, bgcolor: 'grey.100', borderRadius: 1 }}>
          <code style={{ fontSize: '0.75rem' }}>
            {JSON.stringify(value, null, 2)}
          </code>
        </Box>
      )}
      
      {(error || numericError || helperText) && (
        <FormHelperText>
          {error || numericError || helperText}
        </FormHelperText>
      )}
    </FormControl>
  );
};

export default QuantityField;