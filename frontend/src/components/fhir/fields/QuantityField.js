/**
 * QuantityField Component
 * Reusable field for FHIR Quantity data type with unit validation and conversion
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  TextField,
  Autocomplete,
  Grid,
  FormControl,
  InputLabel,
  FormHelperText,
  InputAdornment,
  Typography,
  Chip,
  Paper,
  Stack
} from '@mui/material';
import { 
  Calculate as CalculateIcon,
  Warning as WarningIcon
} from '@mui/icons-material';

const QuantityField = ({
  label,
  value = null, // Quantity object: { value: number, unit: string, system?: string, code?: string }
  onChange,
  onBlur,
  error = false,
  helperText = '',
  required = false,
  disabled = false,
  placeholder = '',
  
  // Unit configuration
  allowedUnits = [], // Array of allowed units with optional conversion factors
  unitSystem = 'http://unitsofmeasure.org', // UCUM by default
  defaultUnit = '',
  showUnitSystem = false,
  
  // Value configuration
  allowDecimals = true,
  decimalPlaces = 2,
  minValue = null,
  maxValue = null,
  step = null,
  
  // Display configuration
  showComparator = false, // Show comparator field (<, <=, >=, >)
  showCalculator = false, // Show unit conversion calculator
  displayFormat = 'value-unit', // 'value-unit' | 'unit-value'
  
  // Validation
  validateQuantity = null, // Function to validate quantity: (quantity) => string|null
  
  ...otherProps
}) => {
  const [valueInput, setValueInput] = useState('');
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [comparator, setComparator] = useState('');
  const [showConverter, setShowConverter] = useState(false);
  const [conversionResult, setConversionResult] = useState(null);
  const [validationError, setValidationError] = useState(null);

  // Comparator options for ranges
  const comparatorOptions = [
    { value: '<', label: 'Less than (<)' },
    { value: '<=', label: 'Less than or equal (≤)' },
    { value: '>=', label: 'Greater than or equal (≥)' },
    { value: '>', label: 'Greater than (>)' }
  ];

  // Initialize from value prop
  useEffect(() => {
    if (value) {
      setValueInput(value.value?.toString() || '');
      setComparator(value.comparator || '');
      
      // Find unit in allowed units or create one
      if (value.unit) {
        const foundUnit = allowedUnits.find(u => 
          u.code === value.unit || u.unit === value.unit || u.display === value.unit
        );
        setSelectedUnit(foundUnit || {
          unit: value.unit,
          code: value.code || value.unit,
          display: value.unit,
          system: value.system || unitSystem
        });
      } else if (defaultUnit) {
        const defaultUnitObj = allowedUnits.find(u => 
          u.code === defaultUnit || u.unit === defaultUnit || u.display === defaultUnit
        );
        setSelectedUnit(defaultUnitObj);
      }
    } else {
      setValueInput('');
      setComparator('');
      if (defaultUnit && allowedUnits.length > 0) {
        const defaultUnitObj = allowedUnits.find(u => 
          u.code === defaultUnit || u.unit === defaultUnit || u.display === defaultUnit
        );
        setSelectedUnit(defaultUnitObj || allowedUnits[0]);
      }
    }
  }, [value, allowedUnits, defaultUnit, unitSystem]);

  // Validate input value
  const validateValue = (inputValue) => {
    if (!inputValue && !required) return null;
    if (!inputValue && required) return 'Value is required';
    
    const numValue = parseFloat(inputValue);
    if (isNaN(numValue)) return 'Must be a valid number';
    
    if (minValue !== null && numValue < minValue) {
      return `Value must be at least ${minValue}`;
    }
    
    if (maxValue !== null && numValue > maxValue) {
      return `Value must be at most ${maxValue}`;
    }
    
    if (!allowDecimals && !Number.isInteger(numValue)) {
      return 'Decimal values are not allowed';
    }
    
    return null;
  };

  // Handle value change
  const handleValueChange = (event) => {
    const newValue = event.target.value;
    setValueInput(newValue);
    
    // Validate
    const error = validateValue(newValue);
    setValidationError(error);
    
    // Update parent if valid
    if (!error && selectedUnit) {
      updateQuantity(newValue, selectedUnit, comparator);
    }
  };

  // Handle unit change
  const handleUnitChange = (event, newUnit) => {
    setSelectedUnit(newUnit);
    if (valueInput && !validationError) {
      updateQuantity(valueInput, newUnit, comparator);
    }
  };

  // Handle comparator change
  const handleComparatorChange = (event, newComparator) => {
    const comp = newComparator?.value || '';
    setComparator(comp);
    if (valueInput && selectedUnit && !validationError) {
      updateQuantity(valueInput, selectedUnit, comp);
    }
  };

  // Update parent quantity object
  const updateQuantity = (value, unit, comp) => {
    if (!value || !unit) {
      onChange(null);
      return;
    }

    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      onChange(null);
      return;
    }

    const quantity = {
      value: allowDecimals 
        ? Math.round(numValue * Math.pow(10, decimalPlaces)) / Math.pow(10, decimalPlaces)
        : Math.round(numValue),
      unit: unit.unit || unit.display || unit.code,
      system: unit.system || unitSystem,
      ...(unit.code && { code: unit.code }),
      ...(comp && { comparator: comp })
    };

    // Custom validation
    if (validateQuantity) {
      const customError = validateQuantity(quantity);
      if (customError) {
        setValidationError(customError);
        return;
      }
    }

    onChange(quantity);
  };

  // Format unit display
  const formatUnitDisplay = (unit) => {
    if (!unit) return '';
    return unit.display || unit.unit || unit.code || '';
  };

  // Perform unit conversion
  const convertUnits = (fromUnit, toUnit, value) => {
    if (!fromUnit?.conversionFactor || !toUnit?.conversionFactor) {
      return null; // No conversion factors available
    }

    // Convert to base unit first, then to target unit
    const baseValue = parseFloat(value) * fromUnit.conversionFactor;
    const convertedValue = baseValue / toUnit.conversionFactor;
    
    return {
      value: Math.round(convertedValue * Math.pow(10, decimalPlaces)) / Math.pow(10, decimalPlaces),
      unit: toUnit,
      originalValue: parseFloat(value),
      originalUnit: fromUnit
    };
  };

  // Handle unit conversion
  const handleConversion = (targetUnit) => {
    if (valueInput && selectedUnit) {
      const result = convertUnits(selectedUnit, targetUnit, valueInput);
      if (result) {
        setConversionResult(result);
        setValueInput(result.value.toString());
        setSelectedUnit(targetUnit);
        updateQuantity(result.value.toString(), targetUnit, comparator);
      }
    }
  };

  const hasError = error || !!validationError;
  const errorMessage = validationError || helperText;

  return (
    <Box {...otherProps}>
      <Grid container spacing={2} alignItems="flex-start">
        {/* Comparator Field */}
        {showComparator && (
          <Grid item xs={12} sm={3}>
            <Autocomplete
              value={comparatorOptions.find(opt => opt.value === comparator) || null}
              onChange={handleComparatorChange}
              options={comparatorOptions}
              getOptionLabel={(option) => option.label}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Comparator"
                  size="small"
                  disabled={disabled}
                />
              )}
            />
          </Grid>
        )}

        {/* Value Field */}
        <Grid item xs={12} sm={showComparator ? 4 : 6}>
          <TextField
            label={label}
            value={valueInput}
            onChange={handleValueChange}
            onBlur={onBlur}
            error={hasError}
            helperText={errorMessage}
            required={required}
            disabled={disabled}
            placeholder={placeholder}
            type="number"
            inputProps={{
              step: step || (allowDecimals ? 'any' : '1'),
              min: minValue,
              max: maxValue
            }}
            InputProps={{
              endAdornment: showCalculator && (
                <InputAdornment position="end">
                  <CalculateIcon 
                    color="action" 
                    sx={{ cursor: 'pointer' }}
                    onClick={() => setShowConverter(!showConverter)}
                  />
                </InputAdornment>
              )
            }}
            fullWidth
          />
        </Grid>

        {/* Unit Field */}
        <Grid item xs={12} sm={showComparator ? 5 : 6}>
          <Autocomplete
            value={selectedUnit}
            onChange={handleUnitChange}
            options={allowedUnits}
            getOptionLabel={formatUnitDisplay}
            isOptionEqualToValue={(option, value) => 
              (option.code || option.unit) === (value.code || value.unit)
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label="Unit"
                error={hasError && !selectedUnit}
                helperText={!selectedUnit && required ? 'Unit is required' : ''}
                disabled={disabled}
              />
            )}
            renderOption={(props, option) => (
              <Box component="li" {...props}>
                <Stack direction="column" spacing={0}>
                  <Typography variant="body2">
                    {formatUnitDisplay(option)}
                  </Typography>
                  {option.description && (
                    <Typography variant="caption" color="text.secondary">
                      {option.description}
                    </Typography>
                  )}
                  {showUnitSystem && option.system && (
                    <Typography variant="caption" color="text.secondary">
                      System: {option.system}
                    </Typography>
                  )}
                </Stack>
              </Box>
            )}
          />
        </Grid>
      </Grid>

      {/* Unit Converter */}
      {showCalculator && showConverter && allowedUnits.length > 1 && (
        <Paper sx={{ mt: 2, p: 2 }} variant="outlined">
          <Typography variant="subtitle2" gutterBottom>
            Unit Converter
          </Typography>
          <Grid container spacing={2}>
            {allowedUnits
              .filter(unit => unit !== selectedUnit)
              .map((unit) => (
                <Grid item key={unit.code || unit.unit} xs={6} sm={4}>
                  <Chip
                    label={`Convert to ${formatUnitDisplay(unit)}`}
                    onClick={() => handleConversion(unit)}
                    variant="outlined"
                    size="small"
                    clickable
                  />
                </Grid>
              ))}
          </Grid>
          
          {conversionResult && (
            <Box sx={{ mt: 2, p: 1, bgcolor: 'background.default', borderRadius: 1 }}>
              <Typography variant="body2">
                <strong>Converted:</strong> {conversionResult.originalValue} {formatUnitDisplay(conversionResult.originalUnit)} 
                = {conversionResult.value} {formatUnitDisplay(conversionResult.unit)}
              </Typography>
            </Box>
          )}
        </Paper>
      )}

      {/* Display current quantity */}
      {value && (
        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Current: {displayFormat === 'unit-value' 
              ? `${value.unit} ${value.value}`
              : `${value.value} ${value.unit}`
            }
            {value.comparator && ` (${value.comparator})`}
            {showUnitSystem && value.system && ` [${value.system}]`}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default QuantityField;