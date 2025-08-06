/**
 * ReferenceField Component
 * Reusable field for FHIR Reference data type with resource search and selection
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
  FormHelperText,
  Avatar,
  ListItem,
  ListItemAvatar,
  ListItemText
} from '@mui/material';
import { 
  Search as SearchIcon,
  Person as PersonIcon,
  LocalHospital as HospitalIcon,
  BusinessCenter as OrganizationIcon,
  Assignment as GenericIcon
} from '@mui/icons-material';
import { useDebounce } from '../../../hooks/useDebounce';

const ReferenceField = ({
  label,
  value = null, // Reference object: { reference: 'ResourceType/id', display: 'Display Name' }
  onChange,
  onBlur,
  error = false,
  helperText = '',
  required = false,
  disabled = false,
  placeholder = '',
  
  // Resource configuration
  resourceType = 'Patient', // Target resource type
  resourceTypes = null, // Array of allowed resource types (overrides resourceType)
  allowedStatuses = ['active'], // Filter resources by status
  
  // Search configuration
  searchService = null, // Function to search resources: (query, resourceType) => Promise<results>
  predefinedOptions = [], // Array of predefined resources
  allowFreeText = false, // Allow manual reference entry
  allowMultiple = false, // Allow multiple references
  
  // Display configuration
  displayFormat = 'name-id', // 'name-id' | 'id-name' | 'name-only'
  showResourceType = true,
  showStatus = false,
  customDisplayExtractor = null, // Function to extract display text: (resource) => string
  
  // Validation
  validateReference = null, // Function to validate reference: (ref) => Promise<boolean>
  
  ...otherProps
}) => {
  const [inputValue, setInputValue] = useState('');
  const [options, setOptions] = useState(predefinedOptions || []);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  
  const debouncedInputValue = useDebounce(inputValue, 300);
  
  // Determine which resource types to search
  const targetResourceTypes = useMemo(() => {
    if (resourceTypes && Array.isArray(resourceTypes)) {
      return resourceTypes;
    }
    return [resourceType];
  }, [resourceType, resourceTypes]);

  // Get icon for resource type
  const getResourceIcon = (resType) => {
    switch (resType?.toLowerCase()) {
      case 'patient':
        return <PersonIcon />;
      case 'practitioner':
      case 'practitionerrole':
        return <PersonIcon color="primary" />;
      case 'organization':
        return <OrganizationIcon />;
      case 'location':
        return <HospitalIcon />;
      default:
        return <GenericIcon />;
    }
  };

  // Extract display information from resource
  const extractDisplayInfo = (resource) => {
    if (customDisplayExtractor) {
      return customDisplayExtractor(resource);
    }

    let name = '';
    let id = resource.id || '';
    let resourceType = resource.resourceType || '';
    
    // Extract name based on resource type
    switch (resourceType.toLowerCase()) {
      case 'patient':
        const patientName = resource.name?.[0];
        if (patientName) {
          const given = patientName.given?.join(' ') || '';
          const family = patientName.family || '';
          name = `${given} ${family}`.trim();
        }
        break;
        
      case 'practitioner':
        const practitionerName = resource.name?.[0];
        if (practitionerName) {
          const given = practitionerName.given?.join(' ') || '';
          const family = practitionerName.family || '';
          const prefix = practitionerName.prefix?.join(' ') || '';
          name = `${prefix} ${given} ${family}`.trim();
        }
        break;
        
      case 'organization':
        name = resource.name || '';
        break;
        
      case 'location':
        name = resource.name || '';
        break;
        
      default:
        name = resource.display || resource.name || resource.title || '';
    }

    return {
      name: name || 'Unknown',
      id,
      resourceType,
      status: resource.status || 'unknown',
      fullResource: resource
    };
  };

  // Format display text for options
  const formatOptionDisplay = (option) => {
    if (!option) return '';
    
    const info = extractDisplayInfo(option);
    
    switch (displayFormat) {
      case 'id-name':
        return info.id && info.name ? `${info.id} - ${info.name}` : info.name || info.id;
      case 'name-only':
        return info.name || info.id;
      case 'name-id':
      default:
        return info.name && info.id ? `${info.name} (${info.id})` : info.name || info.id;
    }
  };

  // Search for resources when input changes
  useEffect(() => {
    const searchResources = async () => {
      if (!debouncedInputValue || !searchService) {
        setOptions(predefinedOptions || []);
        return;
      }

      if (debouncedInputValue.length < 2) {
        return; // Don't search for very short queries
      }

      setLoading(true);
      setSearchError(null);
      
      try {
        const allResults = [];
        
        // Search all target resource types
        for (const resType of targetResourceTypes) {
          const results = await searchService(debouncedInputValue, resType);
          allResults.push(...results);
        }
        
        // Filter by allowed statuses
        const filteredResults = allResults.filter(resource => {
          if (!allowedStatuses || allowedStatuses.length === 0) return true;
          return allowedStatuses.includes(resource.status || 'active');
        });
        
        // Combine predefined options with search results
        const combinedOptions = [
          ...(predefinedOptions || []),
          ...filteredResults.filter(result => 
            !predefinedOptions?.some(pred => pred.id === result.id && pred.resourceType === result.resourceType)
          )
        ];
        
        setOptions(combinedOptions);
      } catch (error) {
        console.error('Resource search error:', error);
        setSearchError('Failed to search resources');
        setOptions(predefinedOptions || []);
      } finally {
        setLoading(false);
      }
    };

    searchResources();
  }, [debouncedInputValue, searchService, targetResourceTypes, allowedStatuses, predefinedOptions]);

  // Convert value to display format
  const getDisplayValue = () => {
    if (!value) return allowMultiple ? [] : null;
    
    if (allowMultiple) {
      if (Array.isArray(value)) {
        return value.map(ref => {
          // Try to find the full resource in options
          const fullResource = options.find(opt => 
            opt.id === ref.reference?.split('/')?.[1] && 
            opt.resourceType === ref.reference?.split('/')?.[0]
          );
          
          return fullResource || {
            id: ref.reference?.split('/')?.[1] || '',
            resourceType: ref.reference?.split('/')?.[0] || '',
            display: ref.display || '',
            reference: ref.reference
          };
        });
      }
      return [];
    }
    
    // Single value
    if (value.reference) {
      // Try to find the full resource in options
      const fullResource = options.find(opt => 
        opt.id === value.reference?.split('/')?.[1] && 
        opt.resourceType === value.reference?.split('/')?.[0]
      );
      
      return fullResource || {
        id: value.reference?.split('/')?.[1] || '',
        resourceType: value.reference?.split('/')?.[0] || '',
        display: value.display || '',
        reference: value.reference
      };
    }
    
    return null;
  };

  // Handle selection change
  const handleChange = (event, newValue) => {
    if (allowMultiple) {
      // Multiple selection
      const references = newValue.map(item => {
        if (typeof item === 'string' && allowFreeText) {
          // Free text entry - create a manual reference
          return {
            reference: item,
            display: item
          };
        }
        
        // Resource selection
        const info = extractDisplayInfo(item);
        return {
          reference: `${info.resourceType}/${info.id}`,
          display: info.name
        };
      });
      
      onChange(references);
    } else {
      // Single selection
      if (!newValue) {
        onChange(null);
        return;
      }
      
      if (typeof newValue === 'string' && allowFreeText) {
        // Free text entry
        onChange({
          reference: newValue,
          display: newValue
        });
        return;
      }
      
      // Resource selection
      const info = extractDisplayInfo(newValue);
      const reference = {
        reference: `${info.resourceType}/${info.id}`,
        display: info.name
      };
      
      onChange(reference);
    }
  };

  // Handle input text change
  const handleInputChange = (event, newInputValue) => {
    setInputValue(newInputValue);
  };

  // Render option in dropdown
  const renderOption = (props, option) => {
    const info = extractDisplayInfo(option);
    
    return (
      <ListItem {...props} key={`${info.resourceType}-${info.id}`} dense>
        <ListItemAvatar>
          <Avatar sx={{ width: 32, height: 32 }}>
            {getResourceIcon(info.resourceType)}
          </Avatar>
        </ListItemAvatar>
        <ListItemText
          primary={
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="body2">
                {info.name}
              </Typography>
              {showResourceType && (
                <Chip 
                  label={info.resourceType} 
                  size="small" 
                  variant="outlined"
                />
              )}
              {showStatus && info.status !== 'unknown' && (
                <Chip 
                  label={info.status} 
                  size="small" 
                  color={info.status === 'active' ? 'success' : 'default'}
                />
              )}
            </Stack>
          }
          secondary={info.id && `ID: ${info.id}`}
        />
      </ListItem>
    );
  };

  // Render selected value(s)
  const renderValue = (value, getTagProps) => {
    if (allowMultiple) {
      return value.map((option, index) => {
        const info = extractDisplayInfo(option);
        return (
          <Chip
            {...getTagProps({ index })}
            key={`${info.resourceType}-${info.id}-${index}`}
            label={formatOptionDisplay(option)}
            size="small"
            avatar={<Avatar sx={{ width: 24, height: 24 }}>{getResourceIcon(info.resourceType)}</Avatar>}
            color="primary"
          />
        );
      });
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
          const optionInfo = extractDisplayInfo(option);
          const valueInfo = extractDisplayInfo(value);
          return optionInfo.id === valueInfo.id && optionInfo.resourceType === valueInfo.resourceType;
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
            {targetResourceTypes.length > 1 && (
              <Box sx={{ p: 1, borderTop: 1, borderColor: 'divider' }}>
                <Typography variant="caption" color="text.secondary">
                  Searching: {targetResourceTypes.join(', ')}
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

export default ReferenceField;