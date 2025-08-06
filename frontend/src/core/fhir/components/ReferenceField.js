/**
 * ReferenceField Component
 * Standardized FHIR Reference input with resource resolution
 */
import React, { useState, useEffect } from 'react';
import {
  Autocomplete,
  TextField,
  FormControl,
  FormLabel,
  FormHelperText,
  Box,
  Typography,
  Avatar,
  Chip,
  CircularProgress
} from '@mui/material';
import {
  Person as PersonIcon,
  Business as OrganizationIcon,
  LocalHospital as EncounterIcon,
  Science as ObservationIcon,
  Medication as MedicationIcon
} from '@mui/icons-material';

const ReferenceField = ({
  label,
  value,
  onChange,
  error,
  helperText,
  required = false,
  disabled = false,
  resourceType, // Patient, Practitioner, Organization, etc.
  searchFunction,
  resolveFunction,
  searchPlaceholder,
  allowMultiple = false,
  fullWidth = true,
  showResourceType = true,
  ...props
}) => {
  const [searchOptions, setSearchOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [resolvedReferences, setResolvedReferences] = useState({});

  // Extract reference ID from FHIR reference
  const extractReferenceId = (reference) => {
    if (!reference) return null;
    if (typeof reference === 'string') {
      return reference.includes('/') ? reference.split('/').pop() : reference;
    }
    if (reference.reference) {
      return reference.reference.includes('/') ? reference.reference.split('/').pop() : reference.reference;
    }
    return reference.id || null;
  };

  // Format FHIR Reference object
  const formatFHIRReference = (selection) => {
    if (!selection) return allowMultiple ? [] : null;
    
    const formatSingle = (item) => {
      if (typeof item === 'string') {
        // If it's just an ID string
        return {
          reference: resourceType ? `${resourceType}/${item}` : item,
          display: resolvedReferences[item]?.display || item
        };
      }
      
      if (item.reference || item.id) {
        // Already a reference object or has ID
        return {
          reference: item.reference || (resourceType ? `${resourceType}/${item.id}` : item.id),
          display: item.display || item.name || item.text || item.title
        };
      }
      
      return item;
    };
    
    if (allowMultiple) {
      return Array.isArray(selection) ? selection.map(formatSingle) : [formatSingle(selection)];
    }
    
    return formatSingle(selection);
  };

  // Get icon for resource type
  const getResourceIcon = (type) => {
    switch (type?.toLowerCase()) {
      case 'patient':
        return <PersonIcon fontSize="small" />;
      case 'practitioner':
        return <PersonIcon fontSize="small" color="primary" />;
      case 'organization':
        return <OrganizationIcon fontSize="small" />;
      case 'encounter':
        return <EncounterIcon fontSize="small" />;
      case 'observation':
        return <ObservationIcon fontSize="small" />;
      case 'medication':
        return <MedicationIcon fontSize="small" />;
      default:
        return <PersonIcon fontSize="small" />;
    }
  };

  // Resolve reference to get display information
  useEffect(() => {
    if (!resolveFunction || !value) return;
    
    const resolveReferences = async () => {
      const references = allowMultiple ? (Array.isArray(value) ? value : [value]) : [value];
      const unresolvedRefs = references.filter(ref => {
        const id = extractReferenceId(ref);
        return id && !resolvedReferences[id];
      });
      
      if (unresolvedRefs.length === 0) return;
      
      try {
        const resolvePromises = unresolvedRefs.map(async (ref) => {
          const id = extractReferenceId(ref);
          if (!id) return null;
          
          try {
            const resolved = await resolveFunction(id, resourceType);
            return { id, resolved };
          } catch (error) {
            console.warn(`Failed to resolve reference ${id}:`, error);
            return { id, resolved: null };
          }
        });
        
        const results = await Promise.all(resolvePromises);
        const newResolved = { ...resolvedReferences };
        
        results.forEach(({ id, resolved }) => {
          if (id && resolved) {
            newResolved[id] = {
              display: resolved.name || resolved.text || resolved.title || resolved.display || id,
              resource: resolved
            };
          }
        });
        
        setResolvedReferences(newResolved);
      } catch (error) {
        console.error('Error resolving references:', error);
      }
    };
    
    resolveReferences();
  }, [value, resolveFunction, resourceType, allowMultiple]);

  // Handle search with debouncing
  useEffect(() => {
    if (!searchFunction || !inputValue || inputValue.length < 2) {
      setSearchOptions([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await searchFunction(inputValue, resourceType);
        setSearchOptions(results || []);
      } catch (error) {
        console.error('Search error:', error);
        setSearchOptions([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [inputValue, searchFunction, resourceType]);

  // Get option label
  const getOptionLabel = (option) => {
    if (typeof option === 'string') {
      const resolved = resolvedReferences[option];
      return resolved?.display || option;
    }
    return option.display || option.name || option.text || option.title || option.id || '';
  };

  // Check if option equals value
  const isOptionEqualToValue = (option, value) => {
    const optionId = extractReferenceId(option);
    const valueId = extractReferenceId(value);
    return optionId === valueId;
  };

  // Render option in dropdown
  const renderOption = (props, option) => (
    <Box component="li" {...props}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Avatar sx={{ width: 24, height: 24 }}>
          {getResourceIcon(resourceType)}
        </Avatar>
        <Box>
          <Typography variant="body2">
            {getOptionLabel(option)}
          </Typography>
          {option.id && (
            <Typography variant="caption" color="text.secondary">
              ID: {option.id}
            </Typography>
          )}
          {showResourceType && resourceType && (
            <Chip 
              label={resourceType} 
              size="small" 
              sx={{ ml: 1, height: 16, fontSize: '0.6rem' }}
            />
          )}
        </Box>
      </Box>
    </Box>
  );

  const placeholder = searchPlaceholder || `Search ${resourceType || 'resources'}...`;

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
        multiple={allowMultiple}
        value={value}
        onChange={(event, newValue) => {
          const fhirValue = formatFHIRReference(newValue);
          onChange(fhirValue);
        }}
        inputValue={inputValue}
        onInputChange={(event, newInputValue) => {
          setInputValue(newInputValue);
        }}
        options={searchOptions}
        getOptionLabel={getOptionLabel}
        isOptionEqualToValue={isOptionEqualToValue}
        renderOption={renderOption}
        loading={loading}
        disabled={disabled}
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder={placeholder}
            variant="outlined"
            size="small"
            error={!!error}
            InputProps={{
              ...params.InputProps,
              startAdornment: (
                <Box sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
                  {getResourceIcon(resourceType)}
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

export default ReferenceField;