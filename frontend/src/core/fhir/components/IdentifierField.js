/**
 * IdentifierField Component
 * Standardized FHIR Identifier input with system/value pairs
 */
import React, { useState } from 'react';
import {
  Grid,
  TextField,
  Autocomplete,
  FormControl,
  FormLabel,
  FormHelperText,
  Box,
  IconButton,
  Chip,
  Typography
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';

const IdentifierField = ({
  label,
  value,
  onChange,
  error,
  helperText,
  required = false,
  disabled = false,
  allowMultiple = true,
  systemOptions = [],
  useOptions = ['official', 'usual', 'temp', 'secondary'],
  defaultSystem,
  defaultUse = 'official',
  fullWidth = true,
  ...props
}) => {
  // Parse FHIR Identifier value (can be single identifier or array)
  const identifiers = value ? (Array.isArray(value) ? value : [value]) : [];

  // Add new identifier
  const addIdentifier = () => {
    const newIdentifier = {
      use: defaultUse,
      system: defaultSystem || '',
      value: ''
    };
    
    const updatedIdentifiers = [...identifiers, newIdentifier];
    onChange(allowMultiple ? updatedIdentifiers : updatedIdentifiers[updatedIdentifiers.length - 1]);
  };

  // Remove identifier at index
  const removeIdentifier = (index) => {
    const updatedIdentifiers = identifiers.filter((_, i) => i !== index);
    
    if (updatedIdentifiers.length === 0) {
      onChange(null);
    } else {
      onChange(allowMultiple ? updatedIdentifiers : updatedIdentifiers[0]);
    }
  };

  // Update specific identifier field
  const updateIdentifier = (index, field, newValue) => {
    const updatedIdentifiers = [...identifiers];
    updatedIdentifiers[index] = {
      ...updatedIdentifiers[index],
      [field]: newValue
    };
    
    // Remove empty fields
    Object.keys(updatedIdentifiers[index]).forEach(key => {
      if (updatedIdentifiers[index][key] === '') {
        delete updatedIdentifiers[index][key];
      }
    });
    
    onChange(allowMultiple ? updatedIdentifiers : updatedIdentifiers[0]);
  };

  // Format system options for autocomplete
  const formatSystemOptions = () => {
    return systemOptions.map(option => {
      if (typeof option === 'string') {
        return { value: option, label: option };
      }
      return {
        value: option.system || option.value,
        label: option.display || option.label || option.system || option.value,
        description: option.description
      };
    });
  };

  const formattedSystemOptions = formatSystemOptions();

  // Get system option label
  const getSystemOptionLabel = (option) => {
    if (typeof option === 'string') return option;
    return option.label || option.value || '';
  };

  // Validate identifier
  const validateIdentifier = (identifier) => {
    if (!identifier.value) return 'Value is required';
    if (!identifier.system && systemOptions.length > 0) return 'System is required';
    return null;
  };

  // Ensure at least one identifier exists if required
  const displayIdentifiers = identifiers.length > 0 ? identifiers : [{ use: defaultUse, system: defaultSystem || '', value: '' }];

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
      
      {displayIdentifiers.map((identifier, index) => {
        const identifierError = validateIdentifier(identifier);
        
        return (
          <Box key={index} sx={{ mb: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
            <Grid container spacing={2} alignItems="center">
              {/* Use */}
              <Grid item xs={3}>
                <Autocomplete
                  value={identifier.use || defaultUse}
                  onChange={(event, newValue) => updateIdentifier(index, 'use', newValue)}
                  options={useOptions}
                  disabled={disabled}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Use"
                      variant="outlined"
                      size="small"
                      fullWidth
                    />
                  )}
                />
              </Grid>
              
              {/* System */}
              <Grid item xs={4}>
                <Autocomplete
                  value={identifier.system || ''}
                  onChange={(event, newValue) => {
                    const system = typeof newValue === 'string' ? newValue : newValue?.value || '';
                    updateIdentifier(index, 'system', system);
                  }}
                  options={formattedSystemOptions}
                  getOptionLabel={getSystemOptionLabel}
                  freeSolo
                  disabled={disabled}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="System"
                      variant="outlined"
                      size="small"
                      fullWidth
                      placeholder="http://example.org/identifiers"
                    />
                  )}
                  renderOption={(props, option) => (
                    <Box component="li" {...props}>
                      <Box>
                        <Typography variant="body2">
                          {option.label}
                        </Typography>
                        {option.description && (
                          <Typography variant="caption" color="text.secondary">
                            {option.description}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  )}
                />
              </Grid>
              
              {/* Value */}
              <Grid item xs={4}>
                <TextField
                  label="Value"
                  value={identifier.value || ''}
                  onChange={(event) => updateIdentifier(index, 'value', event.target.value)}
                  disabled={disabled}
                  variant="outlined"
                  size="small"
                  fullWidth
                  error={!!identifierError}
                  helperText={identifierError}
                  placeholder="Identifier value"
                />
              </Grid>
              
              {/* Actions */}
              <Grid item xs={1}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  {allowMultiple && (
                    <IconButton
                      onClick={addIdentifier}
                      size="small"
                      color="primary"
                      disabled={disabled}
                    >
                      <AddIcon fontSize="small" />
                    </IconButton>
                  )}
                  
                  {(allowMultiple && identifiers.length > 1) && (
                    <IconButton
                      onClick={() => removeIdentifier(index)}
                      size="small"
                      color="error"
                      disabled={disabled}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  )}
                </Box>
              </Grid>
            </Grid>
            
            {/* Type (optional) */}
            {identifier.type && (
              <Box sx={{ mt: 1 }}>
                <Chip 
                  label={identifier.type.text || identifier.type.coding?.[0]?.display || 'Typed'}
                  size="small"
                  color="info"
                />
              </Box>
            )}
          </Box>
        );
      })}
      
      {/* Add first identifier button */}
      {identifiers.length === 0 && allowMultiple && (
        <Box sx={{ textAlign: 'center', py: 2 }}>
          <IconButton
            onClick={addIdentifier}
            color="primary"
            disabled={disabled}
          >
            <AddIcon />
          </IconButton>
          <Typography variant="body2" color="text.secondary">
            Add identifier
          </Typography>
        </Box>
      )}
      
      {/* Display current FHIR value for debugging (only in development) */}
      {process.env.NODE_ENV === 'development' && value && (
        <Box sx={{ mt: 1, p: 1, bgcolor: 'grey.100', borderRadius: 1 }}>
          <code style={{ fontSize: '0.75rem' }}>
            {JSON.stringify(value, null, 2)}
          </code>
        </Box>
      )}
      
      {(error || helperText) && (
        <FormHelperText>
          {error || helperText}
        </FormHelperText>
      )}
    </FormControl>
  );
};

export default IdentifierField;