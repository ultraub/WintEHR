/**
 * CodeableConceptField Component
 * Reusable field for FHIR CodeableConcept data type with search and autocomplete
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  TextField,
  Autocomplete,
  Box,
  Typography,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  FormControl,
  InputLabel,
  FormHelperText
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import { useDebounce } from '../../../hooks/useDebounce';
import { useCatalogConditionSearch, useCatalogMedicationSearch } from '../../../hooks/useResourceSearch';

const CodeableConceptField = ({
  label,
  value = null, // CodeableConcept object or null
  onChange,
  onBlur,
  error = false,
  helperText = '',
  required = false,
  disabled = false,
  placeholder = '',
  
  // Coding system configuration
  codeSystem = 'http://snomed.info/sct', // Default to SNOMED CT
  codeSystemLabel = 'SNOMED CT',
  
  // Search configuration
  searchService = null, // Function to search codes: (query, system) => Promise<results>
  predefinedOptions = [], // Array of predefined codes
  allowFreeText = true, // Allow custom text entry
  allowMultiple = false, // Allow multiple selections
  useCatalogSearch = true, // Whether to use dynamic catalog search
  catalogType = 'condition', // 'condition' | 'medication' | 'observation'
  
  // Display configuration
  displayFormat = 'display-code', // 'display-code' | 'code-display' | 'display-only'
  showSystemInfo = false,
  
  // Validation
  validateCode = null, // Function to validate codes: (code) => Promise<boolean>
  
  ...otherProps
}) => {
  const [inputValue, setInputValue] = useState('');
  const [options, setOptions] = useState(predefinedOptions || []);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  
  const debouncedInputValue = useDebounce(inputValue, 300);

  // Initialize catalog search hooks
  const conditionSearch = useCatalogConditionSearch({
    debounceMs: 300,
    minQueryLength: 2
  });

  const medicationSearch = useCatalogMedicationSearch({
    debounceMs: 300,
    minQueryLength: 2
  });

  // Format display text for options
  const formatOptionDisplay = (option) => {
    if (!option) return '';
    
    const display = option.display || option.text || '';
    const code = option.code || '';
    
    switch (displayFormat) {
      case 'code-display':
        return code && display ? `${code} - ${display}` : display || code;
      case 'display-only':
        return display || code;
      case 'display-code':
      default:
        return display && code ? `${display} (${code})` : display || code;
    }
  };

  // Search for codes when input changes
  useEffect(() => {
    const searchCodes = async () => {
      if (!debouncedInputValue) {
        setOptions(predefinedOptions || []);
        return;
      }

      if (debouncedInputValue.length < 2) {
        return; // Don't search for very short queries
      }

      setLoading(true);
      setSearchError(null);
      
      try {
        let results = [];

        if (useCatalogSearch) {
          // Use catalog search based on type
          let catalogResults = [];
          
          switch (catalogType) {
            case 'condition':
              catalogResults = await conditionSearch.searchService(debouncedInputValue, {
                resourceTypes: ['Condition']
              });
              break;
            case 'medication':
              catalogResults = await medicationSearch.searchService(debouncedInputValue, {
                resourceTypes: ['Medication']
              });
              break;
            default:
              // Fall back to custom search service if provided
              if (searchService) {
                catalogResults = await searchService(debouncedInputValue, codeSystem);
              }
          }

          // Transform catalog results to CodeableConcept format
          results = catalogResults.map(item => ({
            code: item.code?.coding?.[0]?.code || item.id,
            display: item.display || item.code?.text || 'Unknown',
            system: item.code?.coding?.[0]?.system || codeSystem,
            frequency: item.frequency || 0,
            searchSource: item.searchSource || 'catalog'
          }));
        } else if (searchService) {
          // Use custom search service
          results = await searchService(debouncedInputValue, codeSystem);
        }
        
        // Combine predefined options with search results
        const combinedOptions = [
          ...(predefinedOptions || []),
          ...results.filter(result => 
            !predefinedOptions?.some(pred => pred.code === result.code)
          )
        ];
        
        setOptions(combinedOptions);
      } catch (error) {
        console.error('Code search error:', error);
        setSearchError('Failed to search codes');
        setOptions(predefinedOptions || []);
      } finally {
        setLoading(false);
      }
    };

    searchCodes();
  }, [debouncedInputValue, searchService, codeSystem, predefinedOptions, useCatalogSearch, catalogType, conditionSearch, medicationSearch]);

  // Convert value to display format
  const getDisplayValue = () => {
    if (!value) return allowMultiple ? [] : null;
    
    if (allowMultiple) {
      if (Array.isArray(value)) {
        return value.map(v => ({
          ...v,
          displayText: formatOptionDisplay(v)
        }));
      }
      return [];
    }
    
    // Single value
    if (value.coding && value.coding.length > 0) {
      return {
        ...value.coding[0],
        text: value.text,
        displayText: formatOptionDisplay(value.coding[0])
      };
    }
    
    if (value.text) {
      return {
        text: value.text,
        displayText: value.text
      };
    }
    
    return null;
  };

  // Handle selection change
  const handleChange = (event, newValue) => {
    if (allowMultiple) {
      // Multiple selection
      const concepts = newValue.map(item => {
        if (typeof item === 'string') {
          // Free text entry
          return {
            text: item
          };
        }
        
        // Coded entry
        return {
          coding: [{
            system: item.system || codeSystem,
            code: item.code,
            display: item.display
          }],
          text: item.display || item.text
        };
      });
      
      onChange(concepts);
    } else {
      // Single selection
      if (!newValue) {
        onChange(null);
        return;
      }
      
      if (typeof newValue === 'string') {
        // Free text entry
        onChange({
          text: newValue
        });
        return;
      }
      
      // Coded entry
      const concept = {
        coding: [{
          system: newValue.system || codeSystem,
          code: newValue.code,
          display: newValue.display
        }],
        text: newValue.display || newValue.text
      };
      
      onChange(concept);
    }
  };

  // Handle input text change
  const handleInputChange = (event, newInputValue) => {
    setInputValue(newInputValue);
  };

  // Render option in dropdown
  const renderOption = (props, option) => (
    <Box component="li" {...props} key={option.code || option.text}>
      <Box sx={{ flexGrow: 1 }}>
        <Typography variant="body2">
          {formatOptionDisplay(option)}
        </Typography>
        {showSystemInfo && option.system && (
          <Typography variant="caption" color="text.secondary">
            System: {option.system}
          </Typography>
        )}
      </Box>
    </Box>
  );

  // Render selected value(s)
  const renderValue = (value, getTagProps) => {
    if (allowMultiple) {
      return value.map((option, index) => (
        <Chip
          {...getTagProps({ index })}
          key={option.code || option.text || index}
          label={option.displayText || formatOptionDisplay(option)}
          size="small"
          color={option.code ? 'primary' : 'default'}
        />
      ));
    }
    
    return null; // Single selection handled by default rendering
  };

  const displayValue = getDisplayValue();

  return (
    <FormControl fullWidth error={error} {...otherProps}>
      {label && (
        <InputLabel shrink required={required}>
          {label}
        </InputLabel>
      )}
      
      <Autocomplete
        value={displayValue}
        onChange={handleChange}
        onInputChange={handleInputChange}
        inputValue={inputValue}
        options={options}
        loading={loading}
        disabled={disabled}
        multiple={allowMultiple}
        freeSolo={allowFreeText}
        getOptionLabel={formatOptionDisplay}
        isOptionEqualToValue={(option, value) => {
          if (typeof option === 'string' && typeof value === 'string') {
            return option === value;
          }
          return option.code === value.code && option.system === value.system;
        }}
        renderOption={renderOption}
        renderTags={allowMultiple ? renderValue : undefined}
        renderInput={(params) => (
          <TextField
            {...params}
            label={!label ? undefined : ''} // Avoid duplicate labels
            placeholder={placeholder}
            error={error}
            required={required}
            InputProps={{
              ...params.InputProps,
              startAdornment: (
                <SearchIcon color="action" sx={{ mr: 1 }} />
              ),
              endAdornment: (
                <>
                  {loading ? <CircularProgress color="inherit" size={20} /> : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
            onBlur={onBlur}
          />
        )}
        PaperComponent={(props) => (
          <Paper {...props}>
            {searchError && (
              <Box sx={{ p: 2 }}>
                <Typography variant="body2" color="error">
                  {searchError}
                </Typography>
              </Box>
            )}
            {props.children}
            {showSystemInfo && (
              <Box sx={{ p: 1, borderTop: 1, borderColor: 'divider' }}>
                <Typography variant="caption" color="text.secondary">
                  Code System: {codeSystemLabel} ({codeSystem})
                </Typography>
              </Box>
            )}
          </Paper>
        )}
      />
      
      {helperText && (
        <FormHelperText>
          {helperText}
        </FormHelperText>
      )}
    </FormControl>
  );
};

export default CodeableConceptField;