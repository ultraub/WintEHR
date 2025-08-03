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
    exact: { symbol: ':exact', label: 'Exact match', description: 'Match the entire string exactly' },
    contains: { symbol: ':contains', label: 'Contains', description: 'Match anywhere in the string' },
    missing: { symbol: ':missing', label: 'Missing', description: 'Search for missing values' }
  },
  token: {
    text: { symbol: ':text', label: 'Text search', description: 'Search on text associated with the code' },
    not: { symbol: ':not', label: 'Not', description: 'Reverse the code matching' },
    missing: { symbol: ':missing', label: 'Missing', description: 'Search for missing values' }
  },
  reference: {
    missing: { symbol: ':missing', label: 'Missing', description: 'Search for missing references' }
  },
  date: {
    missing: { symbol: ':missing', label: 'Missing', description: 'Search for missing dates' }
  },
  quantity: {
    missing: { symbol: ':missing', label: 'Missing', description: 'Search for missing quantities' }
  }
};

const COMPARATORS = {
  eq: { symbol: '', label: '=', description: 'Equal to' },
  ne: { symbol: 'ne', label: '≠', description: 'Not equal to' },
  gt: { symbol: 'gt', label: '>', description: 'Greater than' },
  lt: { symbol: 'lt', label: '<', description: 'Less than' },
  ge: { symbol: 'ge', label: '≥', description: 'Greater than or equal' },
  le: { symbol: 'le', label: '≤', description: 'Less than or equal' },
  sa: { symbol: 'sa', label: 'Starts after', description: 'Starts after (dates)' },
  eb: { symbol: 'eb', label: 'Ends before', description: 'Ends before (dates)' }
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
    onParametersChange([...parameters, { key: '', comparator: '', modifier: '', value: '' }]);
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
      
      // Load appropriate catalog based on parameter and resource type
      if (resource === 'Patient' && paramKey === 'gender') {
        suggestions = [
          { value: 'male', label: 'Male' },
          { value: 'female', label: 'Female' },
          { value: 'other', label: 'Other' },
          { value: 'unknown', label: 'Unknown' }
        ];
      } else if (resource === 'Observation' && paramKey === 'code') {
        // Load lab catalog with search parameter
        const labs = await cdsClinicalDataService.getLabCatalog(searchTerm, null, 100);
        suggestions = labs.map(lab => ({
          value: lab.code,
          label: lab.display,
          description: lab.category
        }));
      } else if (resource === 'Condition' && paramKey === 'code') {
        // Load condition catalog with search parameter
        const conditions = await cdsClinicalDataService.getDynamicConditionCatalog(searchTerm, 100);
        suggestions = conditions.map(cond => ({
          value: cond.code,
          label: cond.display,
          description: `Count: ${cond.count}`
        }));
      } else if (resource === 'MedicationRequest' && paramKey === 'medication') {
        // Load medication catalog with search parameter
        const meds = await cdsClinicalDataService.getDynamicMedicationCatalog(searchTerm, 100);
        suggestions = meds.map(med => ({
          value: med.code,
          label: med.display,
          description: med.dosageForm
        }));
      } else if (paramKey === 'status') {
        // Common status values
        suggestions = getStatusValues(resource);
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
  const getModifiers = (paramType) => {
    return SEARCH_MODIFIERS[paramType] || {};
  };
  
  return (
    <Stack spacing={2}>
      {parameters.map((param, index) => {
        const paramConfig = searchParams[param.key];
        const paramType = paramConfig?.type || 'string';
        const operators = getOperators(paramType);
        const modifiers = getModifiers(paramType);
        const suggestions = catalogSuggestions[index] || [];
        
        return (
          <Paper
            key={index}
            elevation={0}
            sx={{
              p: 2,
              backgroundColor: alpha(theme.palette.primary.main, 0.02),
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
                    options={Object.keys(searchParams)}
                    getOptionLabel={(option) => option}
                    renderOption={(props, option) => (
                      <Box component="li" {...props}>
                        <Box>
                          <Typography variant="body2">{option}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {searchParams[option]?.description}
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
                    <FormControl fullWidth size="small">
                      <InputLabel>Modifier</InputLabel>
                      <Select
                        value={param.modifier || ''}
                        onChange={(e) => handleUpdateParameter(index, 'modifier', e.target.value)}
                        label="Modifier"
                        displayEmpty
                      >
                        <MenuItem value="">None</MenuItem>
                        {Object.entries(modifiers).map(([key, mod]) => (
                          <MenuItem key={key} value={key}>
                            <Tooltip title={mod.description}>
                              <span>{mod.label}</span>
                            </Tooltip>
                          </MenuItem>
                        ))}
                      </Select>
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
                      placeholder={paramConfig?.example || 'Enter value...'}
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
            </Stack>
          </Paper>
        );
      })}
      
      <Button
        startIcon={<AddIcon />}
        onClick={handleAddParameter}
        variant="outlined"
        size="small"
        sx={{ alignSelf: 'flex-start' }}
      >
        Add Parameter
      </Button>
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
    setParameters([...parameters, { key: '', value: '', modifier: '' }]);
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
        const paramType = searchParams[p.key]?.type || 'string';
        
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
              backgroundColor: alpha(theme.palette.primary.main, 0.02),
              borderBottom: `1px solid ${theme.palette.divider}`
            }}>
              {mode === 'visual' ? (
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
                  <Grid item xs={12} sm={8}>
                    <TextField
                      fullWidth
                      size="small"
                      value={buildQuery()}
                      InputProps={{
                        readOnly: true,
                        sx: { fontFamily: 'monospace', fontSize: '0.875rem' }
                      }}
                      placeholder="Query will appear here..."
                    />
                  </Grid>
                </Grid>
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
          
          {/* Execute Button */}
          <Box sx={{ p: 1.5, borderTop: `1px solid ${theme.palette.divider}` }}>
            <Button
              fullWidth
              variant="contained"
              size="small"
              onClick={executeQuery}
              disabled={loading || !buildQuery() || buildQuery() === '/'}
              startIcon={loading ? <CircularProgress size={16} /> : <RunIcon />}
            >
              {loading ? 'Executing...' : 'Execute Query'}
            </Button>
          </Box>
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