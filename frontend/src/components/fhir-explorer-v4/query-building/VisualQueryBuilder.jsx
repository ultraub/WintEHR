/**
 * Visual Query Builder Component for FHIR Explorer v4
 * 
 * Enhanced drag-and-drop interface for building FHIR queries
 * with support for all 48 FHIR resource types and advanced search features
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Button,
  Chip,
  Card,
  CardContent,
  CardHeader,
  Divider,
  IconButton,
  Tooltip,
  TextField,
  Autocomplete,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Switch,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tab,
  Tabs,
  Badge,
  InputAdornment,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemButton,
  Collapse,
  CircularProgress
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  PlayArrow as RunIcon,
  Code as CodeIcon,
  Save as SaveIcon,
  Clear as ClearIcon,
  DragIndicator as DragIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  FilterList as FilterIcon,
  Link as LinkIcon,
  Lightbulb as LightbulbIcon,
  ContentCopy as CopyIcon,
  Build as BuildIcon,
  Search as SearchIcon,
  Category as CategoryIcon,
  Help as HelpIcon,
  Settings as SettingsIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  Info as InfoIcon,
  AccountTree as TreeIcon,
  Merge as MergeIcon,
  Bookmark as BookmarkIcon
} from '@mui/icons-material';

// Import comprehensive FHIR resource definitions
import { 
  FHIR_RESOURCES, 
  RESOURCE_CATEGORIES,
  getResourcesByCategory,
  searchResources,
  getSearchParamType,
  getSearchModifiers
} from '../constants/fhirResources';

// Import advanced search components
import CompositeParameterBuilder from './components/CompositeParameterBuilder';
import ChainedParameterBuilder from './components/ChainedParameterBuilder';
import ModifierSelector from './components/ModifierSelector';

// Query builder constants
const LOGICAL_OPERATORS = {
  AND: { label: 'AND', description: 'All conditions must match' },
  OR: { label: 'OR', description: 'Any condition must match' }
};

const COMMON_QUERIES = [
  {
    name: 'Active Patients',
    description: 'All active patients in the system',
    query: { resourceType: 'Patient', searchParams: [{ name: 'active', value: 'true' }] }
  },
  {
    name: 'Recent Observations',
    description: 'Observations from the last 30 days',
    query: { 
      resourceType: 'Observation', 
      searchParams: [{ name: 'date', operator: 'ge', value: `ge${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}` }] 
    }
  },
  {
    name: 'Active Medications',
    description: 'Currently active medication requests',
    query: { 
      resourceType: 'MedicationRequest', 
      searchParams: [{ name: 'status', value: 'active' }] 
    }
  }
];

function VisualQueryBuilder({ onNavigate, onExecuteQuery, useFHIRData, useQueryHistory }) {
  // State management
  const [query, setQuery] = useState({
    resourceType: '',
    searchParams: [],
    includes: [],
    revIncludes: [],
    hasParams: [],
    compositeParams: [],
    chainedParams: [],
    logicalOperator: 'AND',
    count: 20,
    sort: '',
    summary: false
  });
  
  const [selectedCategory, setSelectedCategory] = useState('');
  const [resourceSearchTerm, setResourceSearchTerm] = useState('');
  const [generatedUrl, setGeneratedUrl] = useState('');
  const [showQueryDialog, setShowQueryDialog] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [results, setResults] = useState(null);
  const [errors, setErrors] = useState([]);
  const [currentTab, setCurrentTab] = useState(0);
  
  // Query save form
  const [saveForm, setSaveForm] = useState({
    name: '',
    description: '',
    category: 'general',
    tags: []
  });

  // Initialize hooks
  const fhirDataHook = useFHIRData || (() => ({ searchResources: () => Promise.resolve([]) }));
  const queryHistoryHook = useQueryHistory || (() => ({ saveQuery: () => {}, addToHistory: () => {} }));
  
  const { searchResources: executeFHIRQuery } = fhirDataHook();
  const { saveQuery, addToHistory } = queryHistoryHook();

  // Get filtered resources based on category and search
  const filteredResources = useMemo(() => {
    let resources = Object.entries(FHIR_RESOURCES);
    
    if (selectedCategory) {
      resources = resources.filter(([_, resource]) => resource.category === selectedCategory);
    }
    
    if (resourceSearchTerm) {
      const searchResults = searchResources(resourceSearchTerm);
      resources = resources.filter(([key]) => 
        searchResults.some(result => result.key === key)
      );
    }
    
    return resources;
  }, [selectedCategory, resourceSearchTerm]);

  // Get current resource definition
  const currentResource = query.resourceType ? FHIR_RESOURCES[query.resourceType] : null;

  // Validate query
  const validateQuery = useCallback(() => {
    const newErrors = [];
    
    if (!query.resourceType) {
      newErrors.push('Please select a resource type');
    }
    
    query.searchParams.forEach((param, index) => {
      if (!param.name) {
        newErrors.push(`Search parameter ${index + 1}: Name is required`);
      }
      if (!param.value) {
        newErrors.push(`Search parameter ${index + 1}: Value is required`);
      }
    });
    
    query.hasParams.forEach((param, index) => {
      if (!param.resource || !param.reference || !param.searchParam) {
        newErrors.push(`_has parameter ${index + 1}: All fields are required`);
      }
    });
    
    setErrors(newErrors);
    return newErrors.length === 0;
  }, [query]);

  // Generate FHIR query URL
  const generateQueryUrl = useCallback(() => {
    if (!validateQuery()) return '';

    const params = new URLSearchParams();
    
    // Add search parameters
    query.searchParams.forEach(param => {
      if (param.value) {
        const key = param.operator ? `${param.name}${param.operator}` : param.name;
        params.append(key, param.value);
      }
    });

    // Add composite parameters
    query.compositeParams.forEach(param => {
      if (param.values && param.values.length > 0) {
        const value = param.values.join('$');
        params.append(param.name, value);
      }
    });

    // Add _has parameters
    query.hasParams.forEach(param => {
      const hasValue = `${param.resource}:${param.reference}:${param.searchParam}=${param.value}`;
      params.append('_has', hasValue);
    });

    // Add chained parameters
    query.chainedParams.forEach(param => {
      if (param.referenceParam && param.targetParam && param.value) {
        const chainKey = `${param.referenceParam}.${param.targetParam}`;
        params.append(chainKey, param.value);
      }
    });

    // Add includes
    query.includes.forEach(include => {
      params.append('_include', include);
    });

    // Add reverse includes
    query.revIncludes.forEach(revInclude => {
      params.append('_revinclude', revInclude);
    });

    // Add count
    if (query.count !== 20) {
      params.append('_count', query.count);
    }

    // Add sort
    if (query.sort) {
      params.append('_sort', query.sort);
    }

    // Add summary
    if (query.summary) {
      params.append('_summary', 'true');
    }

    const queryString = params.toString();
    return `/${query.resourceType}${queryString ? `?${queryString}` : ''}`;
  }, [query, validateQuery]);

  // Update generated URL when query changes
  useEffect(() => {
    const url = generateQueryUrl();
    setGeneratedUrl(url);
  }, [generateQueryUrl]);

  // Execute query
  const executeQuery = useCallback(async () => {
    if (!validateQuery()) return;

    setIsExecuting(true);
    setResults(null);

    try {
      const startTime = Date.now();
      const url = generateQueryUrl();
      
      // Execute using the FHIR service
      const result = await executeFHIRQuery(query.resourceType, Object.fromEntries(new URLSearchParams(url.split('?')[1])));
      
      const executionTime = Date.now() - startTime;
      
      setResults({
        data: result,
        count: result.total || result.entry?.length || 0,
        executionTime
      });

      // Add to history
      addToHistory({
        query: url,
        resultCount: result.total || result.entry?.length || 0,
        executionTime,
        resourceType: query.resourceType
      });
    } catch (error) {
      setErrors([`Query execution failed: ${error.message}`]);
    } finally {
      setIsExecuting(false);
    }
  }, [query, validateQuery, generateQueryUrl, executeFHIRQuery, addToHistory]);

  // Save query
  const handleSaveQuery = useCallback(() => {
    if (!validateQuery()) return;

    try {
      saveQuery({
        query: generatedUrl,
        name: saveForm.name,
        description: saveForm.description,
        category: saveForm.category,
        tags: saveForm.tags,
        resourceType: query.resourceType
      });
      
      setShowSaveDialog(false);
      setSaveForm({ name: '', description: '', category: 'general', tags: [] });
    } catch (error) {
      setErrors([`Failed to save query: ${error.message}`]);
    }
  }, [query, generatedUrl, saveForm, validateQuery, saveQuery]);

  // Add search parameter
  const addSearchParam = useCallback(() => {
    setQuery(prev => ({
      ...prev,
      searchParams: [...prev.searchParams, { name: '', operator: '', value: '' }]
    }));
  }, []);

  // Update search parameter
  const updateSearchParam = useCallback((index, field, value) => {
    setQuery(prev => ({
      ...prev,
      searchParams: prev.searchParams.map((param, i) => 
        i === index ? { ...param, [field]: value } : param
      )
    }));
  }, []);

  // Remove search parameter
  const removeSearchParam = useCallback((index) => {
    setQuery(prev => ({
      ...prev,
      searchParams: prev.searchParams.filter((_, i) => i !== index)
    }));
  }, []);

  // Add _has parameter
  const addHasParam = useCallback(() => {
    setQuery(prev => ({
      ...prev,
      hasParams: [...prev.hasParams, { resource: '', reference: '', searchParam: '', value: '' }]
    }));
  }, []);

  // Load common query
  const loadCommonQuery = useCallback((commonQuery) => {
    setQuery(prev => ({ ...prev, ...commonQuery.query }));
  }, []);

  // Get placeholder text for search parameter
  const getPlaceholderForSearchParam = (type) => {
    switch (type) {
      case 'token':
        return 'system|code or code';
      case 'string':
        return 'text to search';
      case 'reference':
        return 'Resource/id';
      case 'date':
        return 'YYYY-MM-DD or gt2024-01-01';
      case 'quantity':
        return 'value or comparatorValue (e.g., gt5.4)';
      case 'number':
        return 'numeric value';
      case 'uri':
        return 'full URI';
      default:
        return 'value';
    }
  };

  // Render resource selector
  const renderResourceSelector = () => (
    <Card>
      <CardHeader 
        title="Select Resource Type"
        avatar={<CategoryIcon color="primary" />}
      />
      <CardContent>
        <Stack spacing={2}>
          {/* Category filter */}
          <FormControl fullWidth size="small">
            <InputLabel>Filter by Category</InputLabel>
            <Select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              label="Filter by Category"
            >
              <MenuItem value="">All Categories</MenuItem>
              {Object.entries(RESOURCE_CATEGORIES).map(([key, category]) => (
                <MenuItem key={key} value={key}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: category.color }} />
                    {category.name} - {category.description}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Resource search */}
          <TextField
            fullWidth
            size="small"
            placeholder="Search resources..."
            value={resourceSearchTerm}
            onChange={(e) => setResourceSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              )
            }}
          />

          {/* Resource list */}
          <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
            <List dense>
              {filteredResources.map(([key, resource]) => (
                <ListItemButton
                  key={key}
                  selected={query.resourceType === key}
                  onClick={() => setQuery(prev => ({ ...prev, resourceType: key, searchParams: [] }))}
                >
                  <ListItemIcon>
                    <Typography fontSize="1.5rem">{resource.icon}</Typography>
                  </ListItemIcon>
                  <ListItemText
                    primary={resource.name}
                    secondary={resource.description}
                  />
                  <Chip
                    label={RESOURCE_CATEGORIES[resource.category].name}
                    size="small"
                    sx={{
                      bgcolor: RESOURCE_CATEGORIES[resource.category].color,
                      color: 'white'
                    }}
                  />
                </ListItemButton>
              ))}
            </List>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );

  // Render search parameters
  const renderSearchParameters = () => (
    <Card>
      <CardHeader
        title="Search Parameters"
        avatar={<FilterIcon color="primary" />}
        action={
          <Button
            startIcon={<AddIcon />}
            onClick={addSearchParam}
            size="small"
          >
            Add Parameter
          </Button>
        }
      />
      <CardContent>
        <Stack spacing={2}>
          {query.searchParams.map((param, index) => (
            <Paper key={index} sx={{ p: 2 }} variant="outlined">
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={4}>
                  <Autocomplete
                    value={param.name}
                    onChange={(e, value) => updateSearchParam(index, 'name', value)}
                    options={currentResource ? Object.keys(currentResource.searchParams) : []}
                    renderInput={(params) => (
                      <TextField {...params} label="Parameter" size="small" fullWidth />
                    )}
                    renderOption={(props, option) => (
                      <li {...props}>
                        <Box>
                          <Typography variant="body2">{option}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {currentResource?.searchParams[option]?.description}
                          </Typography>
                        </Box>
                      </li>
                    )}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Value"
                    value={param.value}
                    onChange={(e) => updateSearchParam(index, 'value', e.target.value)}
                    helperText={param.name && currentResource?.searchParams[param.name]?.type}
                    placeholder={param.name && getPlaceholderForSearchParam(currentResource?.searchParams[param.name]?.type)}
                  />
                </Grid>
                <Grid item xs={12} md={1}>
                  <IconButton
                    onClick={() => removeSearchParam(index)}
                    color="error"
                    size="small"
                  >
                    <DeleteIcon />
                  </IconButton>
                </Grid>
              </Grid>
            </Paper>
          ))}

          {query.searchParams.length === 0 && (
            <Alert severity="info">
              No search parameters added. Click "Add Parameter" to start building your query.
            </Alert>
          )}
        </Stack>
      </CardContent>
    </Card>
  );

  // Render advanced features
  const renderAdvancedFeatures = () => (
    <Accordion expanded={showAdvanced} onChange={(e, expanded) => setShowAdvanced(expanded)}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="h6">Advanced Features</Typography>
        <Chip label="Optional" size="small" sx={{ ml: 2 }} />
      </AccordionSummary>
      <AccordionDetails>
        <Grid container spacing={3}>
          {/* _has parameters */}
          <Grid item xs={12}>
            <Card variant="outlined">
              <CardHeader
                title="_has Parameters (Reverse Chaining)"
                subheader="Find resources referenced by other resources"
                action={
                  <Button
                    startIcon={<AddIcon />}
                    onClick={addHasParam}
                    size="small"
                  >
                    Add _has
                  </Button>
                }
              />
              <CardContent>
                <Stack spacing={2}>
                  {query.hasParams.map((param, index) => (
                    <Paper key={index} sx={{ p: 2, bgcolor: 'background.default' }}>
                      <Grid container spacing={2}>
                        <Grid item xs={3}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Resource Type"
                            value={param.resource}
                            onChange={(e) => {
                              const newHasParams = [...query.hasParams];
                              newHasParams[index].resource = e.target.value;
                              setQuery(prev => ({ ...prev, hasParams: newHasParams }));
                            }}
                            placeholder="e.g., Observation"
                          />
                        </Grid>
                        <Grid item xs={3}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Reference Field"
                            value={param.reference}
                            onChange={(e) => {
                              const newHasParams = [...query.hasParams];
                              newHasParams[index].reference = e.target.value;
                              setQuery(prev => ({ ...prev, hasParams: newHasParams }));
                            }}
                            placeholder="e.g., patient"
                          />
                        </Grid>
                        <Grid item xs={3}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Search Parameter"
                            value={param.searchParam}
                            onChange={(e) => {
                              const newHasParams = [...query.hasParams];
                              newHasParams[index].searchParam = e.target.value;
                              setQuery(prev => ({ ...prev, hasParams: newHasParams }));
                            }}
                            placeholder="e.g., code"
                          />
                        </Grid>
                        <Grid item xs={2}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Value"
                            value={param.value}
                            onChange={(e) => {
                              const newHasParams = [...query.hasParams];
                              newHasParams[index].value = e.target.value;
                              setQuery(prev => ({ ...prev, hasParams: newHasParams }));
                            }}
                          />
                        </Grid>
                        <Grid item xs={1}>
                          <IconButton
                            onClick={() => {
                              setQuery(prev => ({
                                ...prev,
                                hasParams: prev.hasParams.filter((_, i) => i !== index)
                              }));
                            }}
                            color="error"
                            size="small"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Grid>
                      </Grid>
                    </Paper>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {/* Include/RevInclude */}
          <Grid item xs={12} md={6}>
            <Card variant="outlined">
              <CardHeader title="_include" subheader="Include referenced resources" />
              <CardContent>
                <Autocomplete
                  multiple
                  value={query.includes}
                  onChange={(e, value) => setQuery(prev => ({ ...prev, includes: value }))}
                  options={currentResource?.includes || []}
                  renderInput={(params) => (
                    <TextField {...params} placeholder="Select includes..." size="small" />
                  )}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip {...getTagProps({ index })} label={option} size="small" />
                    ))
                  }
                />
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card variant="outlined">
              <CardHeader title="_revinclude" subheader="Include resources that reference this" />
              <CardContent>
                <Autocomplete
                  multiple
                  value={query.revIncludes}
                  onChange={(e, value) => setQuery(prev => ({ ...prev, revIncludes: value }))}
                  options={currentResource?.revIncludes || []}
                  renderInput={(params) => (
                    <TextField {...params} placeholder="Select reverse includes..." size="small" />
                  )}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip {...getTagProps({ index })} label={option} size="small" />
                    ))
                  }
                />
              </CardContent>
            </Card>
          </Grid>

          {/* Composite Parameters */}
          <Grid item xs={12}>
            <CompositeParameterBuilder
              resourceType={query.resourceType}
              compositeParams={query.compositeParams}
              onUpdate={(params) => setQuery(prev => ({ ...prev, compositeParams: params }))}
              availableSearchParams={currentResource?.searchParams || {}}
            />
          </Grid>

          {/* Chained Parameters */}
          <Grid item xs={12}>
            <ChainedParameterBuilder
              resourceType={query.resourceType}
              chainedParams={query.chainedParams}
              onUpdate={(params) => setQuery(prev => ({ ...prev, chainedParams: params }))}
            />
          </Grid>

          {/* Query Options */}
          <Grid item xs={12}>
            <Card variant="outlined">
              <CardHeader title="Query Options" />
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={3}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Results per page"
                      type="number"
                      value={query.count}
                      onChange={(e) => setQuery(prev => ({ ...prev, count: parseInt(e.target.value) || 20 }))}
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Sort by"
                      value={query.sort}
                      onChange={(e) => setQuery(prev => ({ ...prev, sort: e.target.value }))}
                      placeholder="e.g., -_lastUpdated"
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={query.summary}
                          onChange={(e) => setQuery(prev => ({ ...prev, summary: e.target.checked }))}
                        />
                      }
                      label="Summary only"
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Logical Operator</InputLabel>
                      <Select
                        value={query.logicalOperator}
                        onChange={(e) => setQuery(prev => ({ ...prev, logicalOperator: e.target.value }))}
                        label="Logical Operator"
                      >
                        {Object.entries(LOGICAL_OPERATORS).map(([key, op]) => (
                          <MenuItem key={key} value={key}>
                            <Box>
                              <Typography variant="body2">{op.label}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {op.description}
                              </Typography>
                            </Box>
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </AccordionDetails>
    </Accordion>
  );

  // Render query preview
  const renderQueryPreview = () => (
    <Card>
      <CardHeader
        title="Query Preview"
        avatar={<CodeIcon color="primary" />}
        action={
          <Stack direction="row" spacing={1}>
            <Button
              startIcon={<CopyIcon />}
              onClick={() => navigator.clipboard.writeText(generatedUrl)}
              size="small"
            >
              Copy
            </Button>
            <Button
              startIcon={<SaveIcon />}
              onClick={() => setShowSaveDialog(true)}
              size="small"
              disabled={!query.resourceType}
            >
              Save
            </Button>
            <Button
              startIcon={<RunIcon />}
              onClick={executeQuery}
              variant="contained"
              size="small"
              disabled={!query.resourceType || isExecuting}
            >
              {isExecuting ? 'Executing...' : 'Execute'}
            </Button>
          </Stack>
        }
      />
      <CardContent>
        {errors.length > 0 && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </Alert>
        )}
        
        <Paper sx={{ p: 2, bgcolor: 'grey.100', fontFamily: 'monospace' }}>
          <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
            {generatedUrl || 'Select a resource type to start building your query'}
          </Typography>
        </Paper>

        {results && (
          <Box sx={{ mt: 2 }}>
            <Alert severity="success">
              Found {results.count} results in {results.executionTime}ms
            </Alert>
          </Box>
        )}
      </CardContent>
    </Card>
  );

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <BuildIcon color="primary" />
          Visual Query Builder
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button
            startIcon={<BookmarkIcon />}
            onClick={() => setCurrentTab(1)}
            variant="outlined"
          >
            Common Queries
          </Button>
          <Button
            startIcon={<HelpIcon />}
            onClick={() => window.open('/docs/query-builder', '_blank')}
            variant="outlined"
          >
            Help
          </Button>
        </Stack>
      </Box>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={currentTab} onChange={(e, v) => setCurrentTab(v)}>
          <Tab label="Build Query" />
          <Tab label="Common Queries" />
          <Tab label="Query Templates" />
        </Tabs>
      </Paper>

      {/* Tab Content */}
      {currentTab === 0 && (
        <Grid container spacing={3}>
          {/* Left Column - Resource Selection */}
          <Grid item xs={12} md={4}>
            {renderResourceSelector()}
          </Grid>

          {/* Right Column - Query Building */}
          <Grid item xs={12} md={8}>
            <Stack spacing={3}>
              {query.resourceType && (
                <>
                  {renderSearchParameters()}
                  {renderAdvancedFeatures()}
                </>
              )}
              {renderQueryPreview()}
            </Stack>
          </Grid>
        </Grid>
      )}

      {currentTab === 1 && (
        <Grid container spacing={3}>
          {COMMON_QUERIES.map((commonQuery, index) => (
            <Grid item xs={12} md={4} key={index}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>{commonQuery.name}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {commonQuery.description}
                  </Typography>
                  <Button
                    fullWidth
                    variant="outlined"
                    onClick={() => loadCommonQuery(commonQuery)}
                  >
                    Use This Query
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {currentTab === 2 && (
        <Alert severity="info">
          Query templates will be available in the next update. You'll be able to create and share 
          reusable query templates with your team.
        </Alert>
      )}

      {/* Save Query Dialog */}
      <Dialog open={showSaveDialog} onClose={() => setShowSaveDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Save Query</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              label="Query Name"
              value={saveForm.name}
              onChange={(e) => setSaveForm(prev => ({ ...prev, name: e.target.value }))}
              required
            />
            <TextField
              fullWidth
              label="Description"
              value={saveForm.description}
              onChange={(e) => setSaveForm(prev => ({ ...prev, description: e.target.value }))}
              multiline
              rows={2}
            />
            <TextField
              fullWidth
              label="Tags (comma separated)"
              value={saveForm.tags.join(', ')}
              onChange={(e) => setSaveForm(prev => ({ 
                ...prev, 
                tags: e.target.value.split(',').map(t => t.trim()).filter(t => t) 
              }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSaveDialog(false)}>Cancel</Button>
          <Button onClick={handleSaveQuery} variant="contained" disabled={!saveForm.name}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default VisualQueryBuilder;