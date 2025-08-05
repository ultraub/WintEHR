/**
 * Query Studio Redesigned - Unified FHIR Query Building Experience
 * 
 * A simplified, intuitive interface for building and understanding FHIR queries
 * with visual construction, inline editing, and immediate results display
 * 
 * @since 2025-08-03
 */

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  IconButton,
  Tooltip,
  Chip,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Autocomplete,
  Grid,
  Divider,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Collapse,
  Stack,
  Card,
  useTheme,
  alpha,
  Fade,
  FormHelperText,
  InputAdornment,
  ToggleButton,
  ToggleButtonGroup,
  Zoom,
  useMediaQuery
} from '@mui/material';
import {
  PlayArrow as RunIcon,
  Code as CodeIcon,
  TableChart as TableIcon,
  DataObject as JsonIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Remove as RemoveIcon,
  HelpOutline as HelpIcon,
  ContentCopy as CopyIcon,
  Download as ExportIcon,
  CheckCircle as ValidIcon,
  Error as ErrorIcon,
  Lightbulb as TipIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  ChevronRight,
  ExpandMore,
  ExpandLess,
  Visibility as PreviewIcon,
  Edit as EditIcon,
  Build as BuildIcon,
  KeyboardArrowUp,
  KeyboardArrowDown
} from '@mui/icons-material';

// Import FHIR resources and utilities
import { FHIR_RESOURCES } from '../constants/fhirResources';
import { fhirClient } from '../../../core/fhir/services/fhirClient';
import { cdsClinicalDataService } from '../../../services/cdsClinicalDataService';

// Monaco Editor for syntax highlighting
import Editor from '@monaco-editor/react';

// FHIR Search Modifiers and Comparators
const SEARCH_MODIFIERS = {
  string: {
    exact: { symbol: ':exact', label: 'Exact match', description: 'Case and accent-sensitive exact match' },
    contains: { symbol: ':contains', label: 'Contains', description: 'Match anywhere in the string (case-insensitive)' },
    missing: { symbol: ':missing', label: 'Missing', description: 'Search for missing (true) or present (false) values' }
  },
  token: {
    text: { symbol: ':text', label: 'Text search', description: 'Search on text/display associated with the code (for complex codes only)', restricted: ['gender', 'status', 'active', 'family-status', 'marital-status'] },
    not: { symbol: ':not', label: 'Not equals', description: 'Exclude matching codes' },
    above: { symbol: ':above', label: 'Above', description: 'Include parent codes in hierarchy (for hierarchical codes)' },
    below: { symbol: ':below', label: 'Below', description: 'Include child codes in hierarchy (for hierarchical codes)' },
    in: { symbol: ':in', label: 'In ValueSet', description: 'Match codes in the specified ValueSet' },
    'not-in': { symbol: ':not-in', label: 'Not in ValueSet', description: 'Exclude codes in the specified ValueSet' },
    missing: { symbol: ':missing', label: 'Missing', description: 'Search for missing (true) or present (false) values' }
  },
  reference: {
    missing: { symbol: ':missing', label: 'Missing', description: 'Search for missing (true) or present (false) references' },
    type: { symbol: ':[type]', label: 'Type modifier', description: 'Specify resource type for polymorphic references', example: ':Patient' },
    identifier: { symbol: ':identifier', label: 'By identifier', description: 'Match by business identifier instead of reference' }
  },
  date: {
    missing: { symbol: ':missing', label: 'Missing', description: 'Search for missing (true) or present (false) dates' }
  },
  quantity: {
    missing: { symbol: ':missing', label: 'Missing', description: 'Search for missing (true) or present (false) quantities' }
  },
  number: {
    missing: { symbol: ':missing', label: 'Missing', description: 'Search for missing (true) or present (false) numbers' }
  },
  uri: {
    below: { symbol: ':below', label: 'Below', description: 'Match URIs hierarchically below the value' },
    above: { symbol: ':above', label: 'Above', description: 'Match URIs hierarchically above the value' },
    missing: { symbol: ':missing', label: 'Missing', description: 'Search for missing (true) or present (false) URIs' }
  },
  composite: {
    missing: { symbol: ':missing', label: 'Missing', description: 'Search for missing (true) or present (false) composite values' }
  }
};

const COMPARATORS = {
  eq: { symbol: '', label: 'Equals (=)', description: 'Equal to the value' },
  ne: { symbol: 'ne', label: 'Not equals (≠)', description: 'Not equal to the value' },
  gt: { symbol: 'gt', label: 'Greater than (>)', description: 'Greater than the value' },
  lt: { symbol: 'lt', label: 'Less than (<)', description: 'Less than the value' },
  ge: { symbol: 'ge', label: 'Greater or equal (≥)', description: 'Greater than or equal to the value' },
  le: { symbol: 'le', label: 'Less or equal (≤)', description: 'Less than or equal to the value' },
  sa: { symbol: 'sa', label: 'Starts after', description: 'Starts after the value (dates)' },
  eb: { symbol: 'eb', label: 'Ends before', description: 'Ends before the value (dates)' }
};

// Special FHIR parameters that are common across all resources
const SPECIAL_FHIR_PARAMS = {
  '_id': { type: 'string', description: 'Logical id of the resource' },
  '_lastUpdated': { type: 'date', description: 'When the resource version last changed' },
  '_tag': { type: 'token', description: 'Tags applied to this resource' },
  '_profile': { type: 'reference', description: 'Profiles this resource claims to conform to' },
  '_security': { type: 'token', description: 'Security labels applied to this resource' },
  '_text': { type: 'string', description: 'Search on the narrative of the resource' },
  '_content': { type: 'string', description: 'Search on the entire content of the resource' },
  '_list': { type: 'string', description: 'Inclusion in a particular list' },
  '_has': { type: 'string', description: 'Reverse chaining - search for resources that are referenced by other resources' },
  '_type': { type: 'token', description: 'Resource type(s) - for multi-type searches' },
  '_sort': { type: 'string', description: 'Sort results by field (prefix with - for descending)' },
  '_count': { type: 'number', description: 'Number of results per page' },
  '_include': { type: 'string', description: 'Include referenced resources in results' },
  '_revinclude': { type: 'string', description: 'Include resources that reference this resource' },
  '_summary': { type: 'string', description: 'Return subset of resource (true, text, data, count, false)' },
  '_elements': { type: 'string', description: 'Return only specific elements (comma-separated list)' },
  '_contained': { type: 'string', description: 'Whether to return contained resources (true, false, both)' },
  '_containedType': { type: 'string', description: 'If contained, whether container or contained (container, contained)' }
};

/**
 * Query comprehension helper - explains query parts
 */
const QueryExplainer = ({ query }) => {
  const theme = useTheme();
  
  const parseQuery = useCallback(() => {
    if (!query) return null;
    
    const parts = [];
    const queryParts = query.split('?');
    
    if (queryParts.length > 0) {
      // Resource type
      const resourceMatch = queryParts[0].match(/\/([A-Za-z]+)$/);
      if (resourceMatch) {
        parts.push({
          type: 'resource',
          value: resourceMatch[1],
          explanation: `Search for ${resourceMatch[1]} resources`
        });
      }
    }
    
    if (queryParts.length > 1) {
      // Parameters
      const params = queryParts[1].split('&');
      params.forEach(param => {
        const [key, value] = param.split('=');
        if (key && value) {
          parts.push({
            type: 'parameter',
            key: decodeURIComponent(key),
            value: decodeURIComponent(value),
            explanation: getParameterExplanation(key, value)
          });
        }
      });
    }
    
    return parts;
  }, [query]);
  
  const getParameterExplanation = (key, value) => {
    // Common FHIR search parameters
    const explanations = {
      '_id': `Find resources with ID "${value}"`,
      'name': `Find resources with name containing "${value}"`,
      'patient': `Find resources for patient "${value}"`,
      'status': `Find resources with status "${value}"`,
      'date': `Find resources with date "${value}"`,
      '_count': `Limit results to ${value} resources`,
      '_sort': `Sort results by "${value}"`,
      '_include': `Include related "${value}" resources`,
      '_revinclude': `Include resources that reference this one`
    };
    
    return explanations[key] || `Filter by ${key} = "${value}"`;
  };
  
  const queryParts = parseQuery();
  
  if (!queryParts || queryParts.length === 0) return null;
  
  return (
    <Box sx={{ p: 1 }}>
      <Stack spacing={0.5}>
        {queryParts.map((part, index) => (
          <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              size="small"
              label={part.type === 'resource' ? part.value : `${part.key}=${part.value}`}
              color={part.type === 'resource' ? 'primary' : 'default'}
              sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}
            />
            <Typography variant="caption" color="text.secondary">
              {part.explanation}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Box>
  );
};

/**
 * Enhanced Visual parameter builder component with operators and catalog support
 */
const ParameterBuilder = ({ resource, parameters, onParametersChange }) => {
  const theme = useTheme();
  const [catalogSuggestions, setCatalogSuggestions] = useState({});
  const [loadingCatalog, setLoadingCatalog] = useState({});
  
  const resourceConfig = FHIR_RESOURCES[resource] || {};
  const searchParams = resourceConfig.searchParams || {};
  
  const handleAddParameter = () => {
    onParametersChange([...parameters, { key: '', comparator: '', modifier: '', value: '', isMultiple: false, values: [] }]);
  };
  
  const handleUpdateParameter = async (index, field, value) => {
    const updated = [...parameters];
    updated[index] = { ...updated[index], [field]: value };
    
    // Reset dependent fields when parameter changes
    if (field === 'key') {
      updated[index].comparator = '';
      updated[index].modifier = '';
      updated[index].value = '';
      
      // Load catalog suggestions for certain parameters
      await loadCatalogSuggestions(value, index);
    }
    
    // Handle modifier change - reload suggestions if needed
    if (field === 'modifier') {
      const param = updated[index];
      await loadCatalogSuggestions(param.key, index);
    }
    
    onParametersChange(updated);
  };
  
  const handleRemoveParameter = (index) => {
    onParametersChange(parameters.filter((_, i) => i !== index));
  };
  
  // Load catalog suggestions based on parameter type
  const loadCatalogSuggestions = async (paramKey, index, searchTerm = null) => {
    if (!paramKey) return;
    
    setLoadingCatalog({ ...loadingCatalog, [index]: true });
    
    try {
      let suggestions = [];
      const param = parameters[index];
      
      // First try to get distinct values for token parameters (disabled temporarily)
      // const paramConfig = searchParams[paramKey] || SPECIAL_FHIR_PARAMS[paramKey];
      // if (paramConfig?.type === 'token' && !searchTerm) {
      //   try {
      //     const response = await fetch(`/api/fhir/search-values/${resource}/${paramKey}?limit=50`);
      //     if (response.ok) {
      //       const data = await response.json();
      //       suggestions = data.values.map(item => ({
      //         value: item.value,
      //         label: item.display || item.value,
      //         description: `Used in ${item.count} resources`
      //       }));
      //     }
      //   } catch (error) {
      //     console.log('Distinct values not available, using fallbacks');
      //   }
      // }
      
      // Fallback to catalog search or hardcoded values if distinct values failed
      if (suggestions.length === 0) {
        if (resource === 'Observation' && paramKey === 'code') {
          // Load lab catalog with search parameter
          const labs = await cdsClinicalDataService.getLabCatalog(searchTerm, null, 100);
          suggestions = labs.map(lab => ({
            value: lab.loinc_code || lab.test_code,
            label: lab.test_name,
            description: lab.test_description || lab.specimen_type
          }));
        } else if (resource === 'Condition' && paramKey === 'code') {
          // Load condition catalog with search parameter
          const conditions = await cdsClinicalDataService.getDynamicConditionCatalog(searchTerm, 100);
          suggestions = conditions.map(cond => ({
            value: cond.snomed_code || cond.icd10_code || cond.id,
            label: cond.display_name,
            description: cond.usage_count ? `Used ${cond.usage_count} times` : cond.category
          }));
        } else if (resource === 'MedicationRequest' && paramKey === 'medication') {
          // Load medication catalog with search parameter
          const meds = await cdsClinicalDataService.getDynamicMedicationCatalog(searchTerm, 100);
          suggestions = meds.map(med => ({
            value: med.rxnorm_code || med.id,
            label: med.brand_name ? `${med.generic_name} (${med.brand_name})` : med.generic_name,
            description: med.strength && med.dosage_form ? `${med.strength} ${med.dosage_form}` : med.dosage_form || med.drug_class
          }));
        } else if (paramKey === 'status' || paramKey === 'clinical-status') {
          // Use common status values
          suggestions = getStatusValues(resource);
        } else if (paramKey === '_summary') {
          suggestions = [
            { value: 'true', label: 'Summary', description: 'Return only summary elements' },
            { value: 'text', label: 'Text', description: 'Return only text, id, meta elements' },
            { value: 'data', label: 'Data', description: 'Remove text elements' },
            { value: 'count', label: 'Count', description: 'Return only count' },
            { value: 'false', label: 'Full', description: 'Return all elements (default)' }
          ];
        } else if (paramKey === '_sort') {
          // Common sort fields based on resource type
          const resourceConfig = FHIR_RESOURCES[resource] || {};
          const searchParams = resourceConfig.searchParams || {};
          const sortFields = Object.keys(searchParams).filter(p => ['date', 'string', 'token'].includes(searchParams[p]?.type));
          suggestions = sortFields.flatMap(field => [
            { value: field, label: field, description: 'Sort ascending' },
            { value: `-${field}`, label: `-${field}`, description: 'Sort descending' }
          ]);
        } else if (paramKey === '_include' || paramKey === '_revinclude') {
          // Include parameters based on references in the resource
          const resourceConfig = FHIR_RESOURCES[resource] || {};
          const searchParams = resourceConfig.searchParams || {};
          const referenceParams = Object.entries(searchParams)
            .filter(([_, config]) => config?.type === 'reference')
            .map(([param, _]) => ({
              value: `${resource}:${param}`,
              label: `${resource}:${param}`,
              description: `Include ${param} references`
            }));
          suggestions = referenceParams;
        }
      }
      
      // Check if the parameter has a :missing modifier - it needs true/false values
      if (param.modifier === 'missing') {
        suggestions = [
          { value: 'true', label: 'True', description: 'Resources where this parameter is missing' },
          { value: 'false', label: 'False', description: 'Resources where this parameter is present' }
        ];
      }
      
      setCatalogSuggestions({ ...catalogSuggestions, [index]: suggestions });
    } catch (error) {
      console.error('Failed to load catalog:', error);
    } finally {
      setLoadingCatalog({ ...loadingCatalog, [index]: false });
    }
  };
  
  // Get status values for different resources
  const getStatusValues = (resourceType) => {
    const statusMap = {
      Observation: ['final', 'preliminary', 'registered', 'corrected', 'amended', 'cancelled', 'entered-in-error'],
      Condition: ['active', 'recurrence', 'relapse', 'inactive', 'remission', 'resolved'],
      MedicationRequest: ['active', 'on-hold', 'cancelled', 'completed', 'entered-in-error', 'stopped', 'draft'],
      Procedure: ['preparation', 'in-progress', 'not-done', 'on-hold', 'stopped', 'completed'],
      Encounter: ['planned', 'arrived', 'triaged', 'in-progress', 'onleave', 'finished', 'cancelled']
    };
    
    return (statusMap[resourceType] || []).map(status => ({
      value: status,
      label: status.charAt(0).toUpperCase() + status.slice(1).replace(/-/g, ' ')
    }));
  };
  
  // Get available operators for parameter type
  const getOperators = (paramType) => {
    if (['date', 'quantity', 'number'].includes(paramType)) {
      return COMPARATORS;
    }
    return {};
  };
  
  // Get available modifiers for parameter type
  const getModifiers = (paramType, paramKey) => {
    const modifiers = SEARCH_MODIFIERS[paramType] || {};
    
    // Filter out restricted modifiers for specific parameters
    const filteredModifiers = {};
    Object.entries(modifiers).forEach(([key, modifier]) => {
      if (modifier.restricted && modifier.restricted.includes(paramKey)) {
        // Skip this modifier for this parameter
        return;
      }
      filteredModifiers[key] = modifier;
    });
    
    return filteredModifiers;
  };
  
  return (
    <Stack spacing={2}>
      {parameters.map((param, index) => {
        const paramConfig = searchParams[param.key] || SPECIAL_FHIR_PARAMS[param.key];
        const paramType = paramConfig?.type || 'string';
        const operators = getOperators(paramType);
        const modifiers = getModifiers(paramType, param.key);
        const suggestions = catalogSuggestions[index] || [];
        
        return (
          <Paper
            key={index}
            elevation={0}
            sx={{
              p: 2,
              backgroundColor: theme.palette.mode === 'dark'
                ? alpha(theme.palette.primary.main, 0.08)
                : alpha(theme.palette.primary.main, 0.02),
              border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`
            }}
          >
            <Stack spacing={2}>
              {/* Parameter Selection */}
              <Grid container spacing={2} alignItems="flex-start">
                <Grid item xs={12} sm={4}>
                  <Autocomplete
                    value={param.key}
                    onChange={(e, value) => handleUpdateParameter(index, 'key', value || '')}
                    options={[...Object.keys(searchParams), ...Object.keys(SPECIAL_FHIR_PARAMS)]}
                    groupBy={(option) => option.startsWith('_') ? 'Special Parameters' : 'Resource Parameters'}
                    getOptionLabel={(option) => option}
                    renderOption={(props, option) => (
                      <Box component="li" {...props}>
                        <Box>
                          <Typography variant="body2">{option}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {searchParams[option]?.description || SPECIAL_FHIR_PARAMS[option]?.description}
                          </Typography>
                        </Box>
                      </Box>
                    )}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Parameter"
                        size="small"
                        fullWidth
                      />
                    )}
                  />
                </Grid>
                
                {/* Operator Selection (for date/number/quantity) */}
                {Object.keys(operators).length > 0 && (
                  <Grid item xs={12} sm={2}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Operator</InputLabel>
                      <Select
                        value={param.comparator || 'eq'}
                        onChange={(e) => handleUpdateParameter(index, 'comparator', e.target.value)}
                        label="Operator"
                      >
                        {Object.entries(operators).map(([key, op]) => (
                          <MenuItem key={key} value={key}>
                            <Tooltip title={op.description}>
                              <span>{op.label}</span>
                            </Tooltip>
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                )}
                
                {/* Modifier Selection */}
                {Object.keys(modifiers).length > 0 && (
                  <Grid item xs={12} sm={2}>
                    <FormControl fullWidth size="small" variant="outlined">
                      <InputLabel shrink={true}>Modifier</InputLabel>
                      <Select
                        value={param.modifier || ''}
                        onChange={(e) => handleUpdateParameter(index, 'modifier', e.target.value)}
                        label="Modifier"
                        displayEmpty
                        notched
                        renderValue={(value) => {
                          if (!value) return <span style={{ opacity: 0.8 }}>Equals</span>;
                          const mod = modifiers[value];
                          return mod ? mod.label : value;
                        }}
                      >
                        <MenuItem value="">
                          <Box>
                            <Typography variant="body2">Equals</Typography>
                            <Typography variant="caption" color="text.secondary">
                              Standard equality match (no modifier)
                            </Typography>
                          </Box>
                        </MenuItem>
                        {Object.entries(modifiers).map(([key, mod]) => (
                          <MenuItem key={key} value={key}>
                            <Box>
                              <Typography variant="body2">{mod.label}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {mod.description}
                              </Typography>
                            </Box>
                          </MenuItem>
                        ))}
                      </Select>
                      <FormHelperText sx={{ mx: 0 }}>
                        {param.modifier && modifiers[param.modifier]?.symbol}
                      </FormHelperText>
                    </FormControl>
                  </Grid>
                )}
                
                {/* Value Input with Catalog Support */}
                <Grid item xs={12} sm={Object.keys(operators).length > 0 || Object.keys(modifiers).length > 0 ? 3 : 6}>
                  {suggestions.length > 0 ? (
                    <Autocomplete
                      value={param.value}
                      onChange={(e, value) => handleUpdateParameter(index, 'value', value?.value || value || '')}
                      onInputChange={(e, newInputValue) => {
                        // Support dynamic search for catalog parameters
                        if (newInputValue && newInputValue.length > 2) {
                          loadCatalogSuggestions(param.key, index, newInputValue);
                        }
                      }}
                      options={suggestions}
                      getOptionLabel={(option) => {
                        if (typeof option === 'string') return option;
                        return option.label || option.value || '';
                      }}
                      renderOption={(props, option) => (
                        <Box component="li" {...props}>
                          <Box>
                            <Typography variant="body2">{option.label}</Typography>
                            {option.description && (
                              <Typography variant="caption" color="text.secondary">
                                {option.description}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      )}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Value"
                          size="small"
                          fullWidth
                          InputProps={{
                            ...params.InputProps,
                            endAdornment: (
                              <>
                                {loadingCatalog[index] && <CircularProgress size={20} />}
                                {params.InputProps.endAdornment}
                              </>
                            )
                          }}
                        />
                      )}
                      freeSolo
                    />
                  ) : (
                    <TextField
                      label="Value"
                      value={param.value}
                      onChange={(e) => handleUpdateParameter(index, 'value', e.target.value)}
                      size="small"
                      fullWidth
                      placeholder={
                        param.key === 'gender' ? 'male, female, other, unknown' :
                        param.key === 'status' ? 'active, inactive' :
                        paramConfig?.type === 'token' ? 'Enter exact value... (comma-separate for OR)' :
                        paramConfig?.example || 'Enter value... (comma-separate for OR)'
                      }
                      type={paramType === 'number' ? 'number' : paramType === 'date' ? 'date' : 'text'}
                    />
                  )}
                </Grid>
                
                {/* Remove Button */}
                <Grid item xs={12} sm={1}>
                  <IconButton
                    onClick={() => handleRemoveParameter(index)}
                    color="error"
                    size="small"
                  >
                    <DeleteIcon />
                  </IconButton>
                </Grid>
              </Grid>
              
              {/* Parameter Help Text */}
              {param.key && paramConfig?.description && (
                <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                  {paramConfig.description}
                </Typography>
              )}
              
              {/* Special help for gender parameter */}
              {param.key === 'gender' && param.modifier === 'text' && (
                <Alert severity="warning" sx={{ mt: 1 }}>
                  <Typography variant="caption">
                    <strong>Note:</strong> Gender is a simple token parameter. Use direct values like "male" or "female" without the :text modifier. 
                    The :text modifier is for complex coded values with display text.
                  </Typography>
                </Alert>
              )}
              
              {/* General token parameter guidance */}
              {paramConfig?.type === 'token' && !param.modifier && param.key && ['gender', 'status', 'active'].includes(param.key) && (
                <Typography variant="caption" color="success.main" sx={{ ml: 1, display: 'block', mt: 0.5 }}>
                  ✓ Use exact values for this token parameter (no modifier needed)
                </Typography>
              )}
            </Stack>
          </Paper>
        );
      })}
      
      {/* Add Parameter Button and AND/OR Logic Help */}
      <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <Button
          startIcon={<AddIcon />}
          onClick={handleAddParameter}
          variant="outlined"
          size="small"
        >
          Add Parameter
        </Button>
        
        {/* AND/OR Logic Explanation */}
        <Paper sx={{ px: 2, py: 1, backgroundColor: theme.palette.mode === 'dark' ? alpha(theme.palette.info.main, 0.2) : alpha(theme.palette.info.main, 0.1), border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`, maxWidth: 600 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <TipIcon sx={{ fontSize: 16, color: 'info.main' }} />
            <Typography variant="caption" color="info.main">
              <strong>Query Logic:</strong> Multiple parameters = AND logic | Comma-separated values = OR logic
            </Typography>
            <Tooltip title="AND Logic: Multiple different parameters are combined with AND&#10;Example: name=Smith&gender=male finds patients named Smith AND male&#10;&#10;OR Logic: Multiple values for the same parameter are combined with OR&#10;Example: status=active,completed finds resources with status active OR completed&#10;&#10;This follows FHIR R4 search specification standard behavior.">
              <HelpIcon sx={{ fontSize: 14, color: 'info.main', cursor: 'help' }} />
            </Tooltip>
          </Stack>
        </Paper>
      </Stack>
    </Stack>
  );
};

/**
 * Results table component
 */
const ResultsTable = ({ data }) => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  
  // Handle both fhirClient format (data.resources) and Bundle format (data.entry or data.bundle?.entry)
  const resources = data?.resources || data?.bundle?.entry?.map(e => e.resource) || data?.entry?.map(e => e.resource) || [];
  
  if (resources.length === 0) {
    return (
      <Alert severity="info">No results found</Alert>
    );
  }
  
  // Extract common fields for table display
  const getResourceDisplay = (resource) => {
    const common = {
      id: resource.id,
      type: resource.resourceType,
      lastUpdated: resource.meta?.lastUpdated,
    };
    
    // Add resource-specific fields
    switch (resource.resourceType) {
      case 'Patient':
        return {
          ...common,
          name: resource.name?.[0]?.text || `${resource.name?.[0]?.given?.join(' ')} ${resource.name?.[0]?.family}`,
          birthDate: resource.birthDate,
          gender: resource.gender
        };
      case 'Observation':
        return {
          ...common,
          code: resource.code?.text || resource.code?.coding?.[0]?.display,
          value: resource.valueQuantity?.value ? `${resource.valueQuantity.value} ${resource.valueQuantity.unit}` : resource.valueCodeableConcept?.text,
          status: resource.status
        };
      case 'Condition':
        return {
          ...common,
          code: resource.code?.text || resource.code?.coding?.[0]?.display,
          onset: resource.onsetDateTime,
          status: resource.clinicalStatus?.coding?.[0]?.code
        };
      default:
        return common;
    }
  };
  
  const displayData = resources.map(getResourceDisplay);
  const columns = displayData.length > 0 ? Object.keys(displayData[0]) : [];
  
  return (
    <>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              {columns.map(col => (
                <TableCell key={col}>
                  {col.charAt(0).toUpperCase() + col.slice(1)}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {displayData
              .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
              .map((row, index) => (
                <TableRow key={index} hover>
                  {columns.map(col => (
                    <TableCell key={col}>
                      {row[col] || '-'}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        component="div"
        count={displayData.length}
        page={page}
        onPageChange={(e, newPage) => setPage(newPage)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(e) => {
          setRowsPerPage(parseInt(e.target.value, 10));
          setPage(0);
        }}
      />
    </>
  );
};

/**
 * Main Query Studio component
 */
function QueryStudio({ onNavigate, useFHIRData, onClose }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.down('lg'));
  
  const [mode, setMode] = useState('visual'); // 'visual' or 'code'
  const [resource, setResource] = useState('Patient');
  const [parameters, setParameters] = useState([]);
  const [codeQuery, setCodeQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [resultView, setResultView] = useState('table'); // 'table' or 'json'
  const [showHelp, setShowHelp] = useState(false); // Start collapsed to save space
  const [executionTime, setExecutionTime] = useState(null);
  const [builderWidth, setBuilderWidth] = useState(50); // Percentage for resizable panels
  
  // Helper functions for parameter management
  const handleAddParameter = useCallback(() => {
    setParameters([...parameters, { key: '', value: '', modifier: '', comparator: '' }]);
  }, [parameters]);
  
  const handleUpdateParameter = useCallback((index, field, value) => {
    const updated = [...parameters];
    updated[index] = { ...updated[index], [field]: value };
    setParameters(updated);
  }, [parameters]);
  
  const handleRemoveParameter = useCallback((index) => {
    setParameters(parameters.filter((_, i) => i !== index));
  }, [parameters]);
  
  // Build query from visual parameters with operators and modifiers
  const buildQuery = useCallback(() => {
    if (mode === 'code') return codeQuery;
    
    
    let query = `/${resource}`;
    const paramStrings = parameters
      .filter(p => p.key && p.value)
      .map(p => {
        let paramStr = p.key;
        const resourceConfig = FHIR_RESOURCES[resource] || {};
        const searchParams = resourceConfig.searchParams || {};
        const paramConfig = searchParams[p.key] || SPECIAL_FHIR_PARAMS[p.key];
        const paramType = paramConfig?.type || 'string';
        
        // Add modifier if present
        if (p.modifier) {
          const modifierSymbol = SEARCH_MODIFIERS[paramType]?.[p.modifier]?.symbol;
          if (modifierSymbol) {
            paramStr += modifierSymbol;
          }
        }
        
        // Build value with comparator
        let value = p.value;
        if (p.comparator && p.comparator !== 'eq') {
          const comparatorSymbol = COMPARATORS[p.comparator]?.symbol;
          if (comparatorSymbol) {
            value = comparatorSymbol + value;
          }
        }
        
        return `${encodeURIComponent(paramStr)}=${encodeURIComponent(value)}`;
      });
    
    if (paramStrings.length > 0) {
      query += '?' + paramStrings.join('&');
    }
    
    return query;
  }, [mode, resource, parameters, codeQuery]);
  
  // Get search params for current resource
  const searchParams = useMemo(() => {
    return FHIR_RESOURCES[resource]?.searchParams || {};
  }, [resource]);
  
  // Execute query
  const executeQuery = useCallback(async () => {
    const query = buildQuery();
    if (!query || query === '/') return;
    
    setLoading(true);
    setError(null);
    const startTime = Date.now();
    
    try {
      // Parse the query to extract resource type and parameters
      const [resourcePath, queryString] = query.split('?');
      const resourceType = resourcePath.replace(/^\//, '');
      
      const searchParams = {};
      if (queryString) {
        queryString.split('&').forEach(param => {
          const [key, value] = param.split('=');
          if (key && value) {
            searchParams[decodeURIComponent(key)] = decodeURIComponent(value);
          }
        });
      }
      
      
      const result = await fhirClient.search(resourceType, searchParams);
      setResults(result);
      setExecutionTime(Date.now() - startTime);
    } catch (err) {
      console.error('Query execution error:', err);
      setError(err.message || 'Failed to execute query');
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);
  
  // Sync visual parameters to code
  useEffect(() => {
    if (mode === 'visual') {
      setCodeQuery(buildQuery());
    }
  }, [mode, resource, parameters, buildQuery]);
  
  // Parse code query to visual parameters
  const parseCodeQuery = useCallback(() => {
    try {
      const [resourcePath, queryString] = codeQuery.split('?');
      const resourceMatch = resourcePath.match(/\/([A-Za-z]+)$/);
      
      if (resourceMatch) {
        setResource(resourceMatch[1]);
        
        const params = [];
        if (queryString) {
          queryString.split('&').forEach(param => {
            const [key, value] = param.split('=');
            if (key && value) {
              const decodedKey = decodeURIComponent(key);
              const decodedValue = decodeURIComponent(value);
              
              // Parse modifier from key
              let paramKey = decodedKey;
              let modifier = '';
              const colonIndex = decodedKey.indexOf(':');
              if (colonIndex > 0) {
                paramKey = decodedKey.substring(0, colonIndex);
                const modifierPart = decodedKey.substring(colonIndex);
                // Find matching modifier
                const resourceConfig = FHIR_RESOURCES[resourceMatch[1]] || {};
                const searchParams = resourceConfig.searchParams || {};
                const paramType = searchParams[paramKey]?.type || 'string';
                const modifiers = SEARCH_MODIFIERS[paramType] || {};
                for (const [modKey, modConfig] of Object.entries(modifiers)) {
                  if (modConfig.symbol === modifierPart) {
                    modifier = modKey;
                    break;
                  }
                }
              }
              
              // Parse comparator from value
              let paramValue = decodedValue;
              let comparator = 'eq';
              for (const [compKey, compConfig] of Object.entries(COMPARATORS)) {
                if (compConfig.symbol && decodedValue.startsWith(compConfig.symbol)) {
                  comparator = compKey;
                  paramValue = decodedValue.substring(compConfig.symbol.length);
                  break;
                }
              }
              
              params.push({
                key: paramKey,
                value: paramValue,
                modifier: modifier,
                comparator: comparator
              });
            }
          });
        }
        setParameters(params);
      }
    } catch (err) {
      console.error('Failed to parse query:', err);
    }
  }, [codeQuery]);
  
  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Compact Header */}
      <Box sx={{ 
        p: 1.5, 
        borderBottom: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.paper,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        minHeight: 48
      }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BuildIcon fontSize="small" color="primary" />
          {!isMobile && 'Query Studio'}
        </Typography>
        
        <Box sx={{ flex: 1 }} />
        
        <ToggleButtonGroup
          value={mode}
          exclusive
          onChange={(e, value) => value && setMode(value)}
          size="small"
        >
          <ToggleButton value="visual">
            <Tooltip title="Visual Builder">
              <PreviewIcon fontSize="small" />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="code">
            <Tooltip title="Code Editor">
              <CodeIcon fontSize="small" />
            </Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>
        
        <IconButton 
          size="small" 
          onClick={() => setShowHelp(!showHelp)} 
          color={showHelp ? 'primary' : 'default'}
        >
          <HelpIcon fontSize="small" />
        </IconButton>
      </Box>
      
      {/* Main Content Area */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {/* Query Builder Section */}
        <Box
          sx={{
            width: isMobile ? '100%' : `${builderWidth}%`,
            display: 'flex',
            flexDirection: 'column',
            borderRight: isMobile ? 'none' : `1px solid ${theme.palette.divider}`,
            transition: 'width 0.3s ease',
            overflow: 'hidden'
          }}
        >
          {/* Query Input Area */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Compact Query Bar */}
            <Box sx={{ 
              p: 1.5, 
              backgroundColor: theme.palette.mode === 'dark'
                ? alpha(theme.palette.primary.main, 0.08)
                : alpha(theme.palette.primary.main, 0.02),
              borderBottom: `1px solid ${theme.palette.divider}`
            }}>
              {mode === 'visual' ? (
                <Stack spacing={1}>
                  <Grid container spacing={1} alignItems="center">
                    <Grid item xs={12} sm={4}>
                      <FormControl fullWidth size="small">
                        <Select
                          value={resource}
                          onChange={(e) => setResource(e.target.value)}
                          displayEmpty
                        >
                          <MenuItem value="" disabled>Select Resource</MenuItem>
                          {Object.keys(FHIR_RESOURCES).map(r => (
                            <MenuItem key={r} value={r}>{r}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        size="small"
                        value={decodeURIComponent(buildQuery())}
                        InputProps={{
                          readOnly: true,
                          sx: { fontFamily: 'monospace', fontSize: '0.875rem' }
                        }}
                        placeholder="Query will appear here..."
                      />
                    </Grid>
                    <Grid item xs={12} sm={2}>
                      <Button
                        fullWidth
                        variant="contained"
                        size="small"
                        onClick={executeQuery}
                        disabled={loading || !buildQuery() || buildQuery() === '/'}
                        startIcon={loading ? <CircularProgress size={16} /> : <RunIcon />}
                      >
                        {loading ? 'Running...' : 'Execute'}
                      </Button>
                    </Grid>
                  </Grid>
                </Stack>
              ) : (
                <TextField
                  fullWidth
                  size="small"
                  value={codeQuery}
                  onChange={(e) => setCodeQuery(e.target.value)}
                  placeholder="Enter FHIR query (e.g., /Patient?name=Smith)"
                  InputProps={{
                    sx: { fontFamily: 'monospace' },
                    endAdornment: (
                      <InputAdornment position="end">
                        <Tooltip title="Convert to Visual">
                          <IconButton size="small" onClick={parseCodeQuery}>
                            <BuildIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </InputAdornment>
                    )
                  }}
                />
              )}
            </Box>
            
            {/* Parameters Area (Visual Mode) */}
            {mode === 'visual' && (
              <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
                <ParameterBuilder
                  resource={resource}
                  parameters={parameters}
                  onParametersChange={setParameters}
                />
              </Box>
            )}
            
            {/* Code Editor (Code Mode) */}
            {mode === 'code' && (
              <Box sx={{ flex: 1, p: 2 }}>
                <Editor
                  height="100%"
                  language="plaintext"
                  theme={theme.palette.mode === 'dark' ? 'vs-dark' : 'light'}
                  value={codeQuery}
                  onChange={(value) => setCodeQuery(value || '')}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                    padding: { top: 8, bottom: 8 }
                  }}
                />
              </Box>
            )}
          </Box>
          
          {/* Help Section (Collapsible) */}
          <Collapse in={showHelp}>
            <Box sx={{ 
              p: 1.5, 
              borderTop: `1px solid ${theme.palette.divider}`,
              backgroundColor: alpha(theme.palette.info.main, 0.05),
              maxHeight: 200,
              overflow: 'auto'
            }}>
              <Typography variant="subtitle2" gutterBottom>
                Query Breakdown
              </Typography>
              <QueryExplainer query={buildQuery()} />
            </Box>
          </Collapse>
        </Box>
        
        {/* Resizable Divider */}
        {!isMobile && (
          <Box
            sx={{
              width: 4,
              cursor: 'col-resize',
              backgroundColor: theme.palette.divider,
              '&:hover': {
                backgroundColor: theme.palette.primary.main,
              },
              position: 'relative',
              transition: 'background-color 0.2s'
            }}
            onMouseDown={(e) => {
              const startX = e.clientX;
              const startWidth = builderWidth;
              const containerWidth = e.currentTarget.parentElement.offsetWidth;
              
              const handleMouseMove = (e) => {
                const deltaX = e.clientX - startX;
                const newWidth = Math.max(30, Math.min(70, startWidth + (deltaX / containerWidth) * 100));
                setBuilderWidth(newWidth);
              };
              
              const handleMouseUp = () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
              };
              
              document.addEventListener('mousemove', handleMouseMove);
              document.addEventListener('mouseup', handleMouseUp);
            }}
          />
        )}
        
        {/* Results Section */}
        <Box
          sx={{
            flex: 1,
            display: isMobile && !results ? 'none' : 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          {/* Results Header */}
          <Box sx={{ 
            p: 1, 
            borderBottom: `1px solid ${theme.palette.divider}`,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            minHeight: 40
          }}>
            <Typography variant="subtitle2" sx={{ flex: 1 }}>
              Results
              {executionTime && (
                <Chip 
                  label={`${executionTime}ms`} 
                  size="small" 
                  sx={{ ml: 1 }} 
                />
              )}
              {results?.total !== undefined && (
                <Chip 
                  label={`${results.total} found`} 
                  size="small" 
                  color="success"
                  sx={{ ml: 1 }} 
                />
              )}
            </Typography>
            
            <ToggleButtonGroup
              value={resultView}
              exclusive
              onChange={(e, value) => value && setResultView(value)}
              size="small"
            >
              <ToggleButton value="table" size="small">
                <TableIcon fontSize="small" />
              </ToggleButton>
              <ToggleButton value="json" size="small">
                <JsonIcon fontSize="small" />
              </ToggleButton>
            </ToggleButtonGroup>
            
            {results && (
              <>
                <IconButton
                  size="small"
                  onClick={() => navigator.clipboard.writeText(JSON.stringify(results, null, 2))}
                >
                  <CopyIcon fontSize="small" />
                </IconButton>
                <IconButton size="small">
                  <ExportIcon fontSize="small" />
                </IconButton>
              </>
            )}
          </Box>
          
          {/* Results Content */}
          <Box sx={{ flex: 1, overflow: 'auto', p: 1.5 }}>
            {error ? (
              <Alert severity="error" sx={{ mb: 1 }}>
                {error}
              </Alert>
            ) : results ? (
              resultView === 'table' ? (
                <ResultsTable data={results} />
              ) : (
                <Paper
                  elevation={0}
                  sx={{
                    p: 1.5,
                    backgroundColor: theme.palette.mode === 'dark'
                      ? theme.palette.grey[900]
                      : theme.palette.grey[50],
                    height: '100%',
                    overflow: 'auto'
                  }}
                >
                  <pre style={{ margin: 0, fontSize: '0.8rem', lineHeight: 1.4 }}>
                    {JSON.stringify(results, null, 2)}
                  </pre>
                </Paper>
              )
            ) : (
              <Box sx={{ 
                height: '100%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                flexDirection: 'column',
                color: 'text.secondary'
              }}>
                <SearchIcon sx={{ fontSize: 40, mb: 1, opacity: 0.3 }} />
                <Typography variant="body2">
                  Execute a query to see results
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default QueryStudio;