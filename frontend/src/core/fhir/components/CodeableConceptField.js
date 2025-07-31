/**
 * CodeableConceptField Component
 * Standardized FHIR CodeableConcept input with search and custom entry
 */
import React, { useState, useEffect } from 'react';
import {
  Autocomplete,
  TextField,
  FormControl,
  FormLabel,
  FormHelperText,
  Chip,
  Box,
  Typography,
  CircularProgress
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';

const CodeableConceptField = ({
  label,
  value,
  onChange,
  error,
  helperText,
  required = false,
  disabled = false,
  multiple = false,
  searchFunction,
  searchPlaceholder = "Search or enter custom value...",
  allowCustom = true,
  system = null, // Default coding system
  fullWidth = true,
  options = [],
  renderOption,
  getOptionLabel,
  isOptionEqualToValue,
  ...props
}) => {
  const [searchOptions, setSearchOptions] = useState(options);
  const [loading, setLoading] = useState(false);
  const [inputValue, setInputValue] = useState('');

  // Convert FHIR CodeableConcept to display format
  const formatValueForDisplay = (codeableConcept) => {
    if (!codeableConcept) return multiple ? [] : null;
    
    if (multiple) {
      return Array.isArray(codeableConcept) ? codeableConcept : [codeableConcept];
    }
    
    return codeableConcept;
  };

  // Convert selection back to FHIR CodeableConcept format
  const formatValueForFHIR = (selection) => {
    if (!selection) return multiple ? [] : null;
    
    const formatSingle = (item) => {
      if (typeof item === 'string') {
        // Custom text entry
        return {
          text: item,
          coding: system ? [{
            system,
            code: item,
            display: item
          }] : []
        };
      }
      
      if (item.coding || item.text) {
        // Already a CodeableConcept
        return item;
      }
      
      // Convert from search result format
      return {
        text: item.display || item.text || item.label,
        coding: [{
          system: item.system || system,
          code: item.code || item.value,
          display: item.display || item.text || item.label
        }]
      };
    };
    
    if (multiple) {
      return Array.isArray(selection) ? selection.map(formatSingle) : [formatSingle(selection)];
    }
    
    return formatSingle(selection);
  };

  // Handle search with debouncing
  useEffect(() => {
    if (!searchFunction || !inputValue || inputValue.length < 2) {
      setSearchOptions(options);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await searchFunction(inputValue);
        setSearchOptions([...options, ...results]);
      } catch (error) {
        console.error('Search error:', error);
        setSearchOptions(options);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [inputValue, searchFunction, options]);

  // Default option label function
  const defaultGetOptionLabel = (option) => {
    if (typeof option === 'string') return option;
    return option.text || option.display || option.label || option.code || '';
  };

  // Default option equality function
  const defaultIsOptionEqualToValue = (option, value) => {
    if (typeof option === 'string' && typeof value === 'string') {
      return option === value;
    }
    
    const optionCode = option.code || option.value;
    const valueCode = value.code || value.value;
    const optionSystem = option.system;
    const valueSystem = value.system;
    
    return optionCode === valueCode && optionSystem === valueSystem;
  };

  // Default render option function
  const defaultRenderOption = (props, option) => (
    <Box component="li" {...props}>
      <Box>
        <Typography variant="body2">
          {option.display || option.text || option.label}
        </Typography>
        {option.code && (
          <Typography variant="caption" color="text.secondary">
            {option.system ? `${option.system}: ` : ''}{option.code}
          </Typography>
        )}
      </Box>
    </Box>
  );

  const displayValue = formatValueForDisplay(value);

  return (
    <FormControl fullWidth={fullWidth} error={!!error}>
      {label && (
        <FormLabel 
          required={required}
          sx={{ mb: 1, fontSize: '0.875rem', fontWeight: 500 }}
        >
          {label}
        </FormLabel>
      )}
      
      <Autocomplete
        multiple={multiple}
        value={displayValue}
        onChange={(event, newValue) => {
          const fhirValue = formatValueForFHIR(newValue);
          onChange(fhirValue);
        }}
        inputValue={inputValue}
        onInputChange={(event, newInputValue) => {
          setInputValue(newInputValue);
        }}
        options={searchOptions}
        getOptionLabel={getOptionLabel || defaultGetOptionLabel}
        isOptionEqualToValue={isOptionEqualToValue || defaultIsOptionEqualToValue}
        renderOption={renderOption || defaultRenderOption}
        loading={loading}
        disabled={disabled}
        freeSolo={allowCustom}
        filterOptions={(options, params) => {
          // If custom entry is allowed and no exact match found, add the input as an option
          if (allowCustom && params.inputValue && !options.find(opt => 
            defaultGetOptionLabel(opt).toLowerCase() === params.inputValue.toLowerCase()
          )) {
            return [...options, params.inputValue];
          }
          return options;
        }}
        renderTags={(tagValue, getTagProps) =>
          tagValue.map((option, index) => (
            <Chip
              label={defaultGetOptionLabel(option)}
              {...getTagProps({ index })}
              key={index}
              size="small"
            />
          ))
        }
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder={searchPlaceholder}
            variant="outlined"
            size="small"
            error={!!error}
            InputProps={{
              ...params.InputProps,
              startAdornment: (
                <Box sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
                  <SearchIcon color="action" fontSize="small" />
                  {params.InputProps.startAdornment}
                </Box>
              ),
              endAdornment: (
                <>
                  {loading ? <CircularProgress color="inherit" size={20} /> : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
            {...props}
          />
        )}
      />
      
      {(error || helperText) && (
        <FormHelperText>
          {error || helperText}
        </FormHelperText>
      )}
    </FormControl>
  );
};

export default CodeableConceptField;