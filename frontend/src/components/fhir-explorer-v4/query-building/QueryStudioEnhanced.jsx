/**
 * Enhanced Query Studio - Advanced FHIR Query Building Experience
 * 
 * Major improvements over standard QueryStudio:
 * - Live distinct values from database for all parameters
 * - Smart parameter suggestions based on context
 * - Collapsible sections for optimal screen usage
 * - Visual query comprehension aids
 * - Advanced result visualization with field selection
 * - Live preview with sample results
 * - Query optimization recommendations
 * 
 * @since 2025-08-05
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
  AlertTitle,
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
  CardContent,
  CardHeader,
  CardActions,
  useTheme,
  alpha,
  Fade,
  FormHelperText,
  InputAdornment,
  ToggleButton,
  ToggleButtonGroup,
  Zoom,
  useMediaQuery,
  Drawer,
  AppBar,
  Toolbar,
  Badge,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Popover,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  LinearProgress,
  Skeleton
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
  KeyboardArrowDown,
  ViewColumn as ViewColumnIcon,
  Settings as SettingsIcon,
  Info as InfoIcon,
  ArrowForward as ArrowForwardIcon,
  ArrowRight as ArrowRightIcon,
  Storage as StorageIcon,
  Speed as SpeedIcon,
  AutoAwesome as AutoAwesomeIcon,
  Psychology as PsychologyIcon,
  TrendingUp as TrendingUpIcon,
  Warning as WarningIcon,
  QueryBuilder as QueryBuilderIcon,
  Category as CategoryIcon,
  LocalOffer as TagIcon,
  FilterList as FilterIcon,
  Link as LinkIcon,
  Refresh as RefreshIcon,
  Save as SaveIcon,
  BookmarkBorder as BookmarkIcon,
  BookmarkAdded as BookmarkAddedIcon,
  Timeline as TimelineIcon,
  AccountTree as TreeIcon
} from '@mui/icons-material';

// Import FHIR resources and utilities
import { FHIR_RESOURCES } from '../constants/fhirResources';
import { fhirClient } from '../../../core/fhir/services/fhirClient';
import { cdsClinicalDataService } from '../../../services/cdsClinicalDataService';

// Monaco Editor for syntax highlighting
import Editor from '@monaco-editor/react';

// Debounce hook for performance
import { debounce } from 'lodash';

// Configuration
const QUERY_STUDIO_CONFIG = {
  enableDistinctValues: true,
  distinctValueLimit: 50,
  cacheDistinctValues: true,
  cacheTTL: 300000, // 5 minutes
  defaultCollapsedSections: ['advanced'],
  enableLivePreview: true,
  previewDelay: 500,
  maxParametersShown: 10,
  maxResultsPreview: 5,
  enableQueryOptimizer: true,
  enableSmartSuggestions: true,
  enableQueryTemplates: true,
  enableFieldExplorer: true
};

// FHIR Search Modifiers and Comparators (same as original)
const SEARCH_MODIFIERS = {
  string: {
    exact: { symbol: ':exact', label: 'Exact match', description: 'Case and accent-sensitive exact match' },
    contains: { symbol: ':contains', label: 'Contains', description: 'Match anywhere in the string (case-insensitive)' },
    missing: { symbol: ':missing', label: 'Missing', description: 'Search for missing (true) or present (false) values' }
  },
  token: {
    text: { symbol: ':text', label: 'Text search', description: 'Search on text/display associated with the code' },
    not: { symbol: ':not', label: 'Not equals', description: 'Exclude matching codes' },
    above: { symbol: ':above', label: 'Above', description: 'Include parent codes in hierarchy' },
    below: { symbol: ':below', label: 'Below', description: 'Include child codes in hierarchy' },
    in: { symbol: ':in', label: 'In ValueSet', description: 'Match codes in the specified ValueSet' },
    'not-in': { symbol: ':not-in', label: 'Not in ValueSet', description: 'Exclude codes in the specified ValueSet' },
    missing: { symbol: ':missing', label: 'Missing', description: 'Search for missing (true) or present (false) values' }
  },
  reference: {
    missing: { symbol: ':missing', label: 'Missing', description: 'Search for missing (true) or present (false) references' },
    type: { symbol: ':[type]', label: 'Type modifier', description: 'Specify resource type for polymorphic references' },
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

// Special FHIR parameters
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
 * Collapsible Section Component for better organization
 */
const CollapsibleSection = ({ title, icon, children, defaultExpanded = true, badge = null, actions = null }) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(defaultExpanded);
  
  return (
    <Card sx={{ mb: 1 }}>
      <CardHeader
        avatar={icon}
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="subtitle1" fontWeight="medium">{title}</Typography>
            {badge !== null && badge > 0 && (
              <Badge badgeContent={badge} color="primary" />
            )}
          </Box>
        }
        action={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {actions}
            <IconButton 
              size="small" 
              onClick={() => setExpanded(!expanded)}
              sx={{ ml: 1 }}
            >
              {expanded ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          </Box>
        }
        sx={{ 
          py: 1, 
          cursor: 'pointer',
          backgroundColor: theme.palette.mode === 'dark' 
            ? alpha(theme.palette.primary.main, 0.08)
            : alpha(theme.palette.primary.main, 0.02),
          '&:hover': {
            backgroundColor: theme.palette.mode === 'dark'
              ? alpha(theme.palette.primary.main, 0.12)
              : alpha(theme.palette.primary.main, 0.04)
          }
        }}
        onClick={() => setExpanded(!expanded)}
      />
      <Collapse in={expanded}>
        <CardContent sx={{ pt: 0 }}>
          {children}
        </CardContent>
      </Collapse>
    </Card>
  );
};

/**
 * Smart Parameter Suggestions Component
 */
const SmartParameterSuggestions = ({ resource, existingParams, onAddParameter }) => {
  const theme = useTheme();
  
  const suggestions = useMemo(() => {
    const suggested = [];
    
    // Context-aware suggestions based on resource type and existing parameters
    if (resource === 'Patient') {
      if (!existingParams.some(p => p.key === 'name')) {
        suggested.push({ key: 'name', reason: 'Search by patient name', priority: 'high' });
      }
      if (!existingParams.some(p => p.key === 'birthdate')) {
        suggested.push({ key: 'birthdate', reason: 'Filter by birth date', priority: 'medium' });
      }
      if (!existingParams.some(p => p.key === 'gender')) {
        suggested.push({ key: 'gender', reason: 'Filter by gender', priority: 'low' });
      }
    }
    
    if (resource === 'Observation') {
      if (!existingParams.some(p => p.key === 'patient')) {
        suggested.push({ key: 'patient', reason: 'Required: specify patient', priority: 'critical' });
      }
      if (!existingParams.some(p => p.key === 'category')) {
        suggested.push({ key: 'category', value: 'vital-signs', reason: 'Filter by observation type', priority: 'high' });
      }
      if (!existingParams.some(p => p.key === 'date')) {
        suggested.push({ key: 'date', reason: 'Filter by date range', priority: 'medium' });
      }
    }
    
    if (resource === 'MedicationRequest') {
      if (!existingParams.some(p => p.key === 'patient')) {
        suggested.push({ key: 'patient', reason: 'Required: specify patient', priority: 'critical' });
      }
      if (!existingParams.some(p => p.key === 'status')) {
        suggested.push({ key: 'status', value: 'active', reason: 'Filter by prescription status', priority: 'high' });
      }
    }
    
    if (resource === 'Condition') {
      if (!existingParams.some(p => p.key === 'patient')) {
        suggested.push({ key: 'patient', reason: 'Required: specify patient', priority: 'critical' });
      }
      if (!existingParams.some(p => p.key === 'clinical-status')) {
        suggested.push({ key: 'clinical-status', value: 'active', reason: 'Filter by clinical status', priority: 'high' });
      }
    }
    
    // General suggestions for all resources
    if (!existingParams.some(p => p.key === '_count')) {
      suggested.push({ key: '_count', value: '50', reason: 'Limit result count for performance', priority: 'low' });
    }
    if (!existingParams.some(p => p.key === '_sort')) {
      suggested.push({ key: '_sort', value: '-_lastUpdated', reason: 'Sort by most recent', priority: 'low' });
    }
    
    return suggested.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }, [resource, existingParams]);
  
  if (suggestions.length === 0) return null;
  
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'critical': return 'error';
      case 'high': return 'primary';
      case 'medium': return 'secondary';
      case 'low': return 'default';
      default: return 'default';
    }
  };
  
  return (
    <Box sx={{ mt: 2, p: 2, bgcolor: alpha(theme.palette.info.main, 0.05), borderRadius: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <AutoAwesomeIcon fontSize="small" color="info" />
        <Typography variant="subtitle2">Suggested Parameters</Typography>
      </Box>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {suggestions.map((sugg) => (
          <Tooltip key={sugg.key} title={sugg.reason}>
            <Chip
              label={sugg.key}
              size="small"
              color={getPriorityColor(sugg.priority)}
              variant={sugg.priority === 'critical' ? 'filled' : 'outlined'}
              onClick={() => onAddParameter(sugg)}
              icon={<AddIcon />}
              sx={{ mb: 1 }}
            />
          </Tooltip>
        ))}
      </Stack>
    </Box>
  );
};

/**
 * Visual Query Flow Diagram
 */
const QueryFlowDiagram = ({ query, theme }) => {
  return (
    <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ overflowX: 'auto', pb: 1 }}>
        {/* Resource Node */}
        <Chip 
          icon={<StorageIcon />}
          label={query.resource || 'Select Resource'}
          color="primary"
          sx={{ minWidth: 120 }}
        />
        
        {/* Parameters as connected nodes */}
        {query.parameters.map((param, index) => (
          <React.Fragment key={index}>
            <ArrowForwardIcon color="action" />
            <Chip 
              label={
                <Box>
                  <Typography variant="caption" fontWeight="bold">
                    {param.key}
                  </Typography>
                  {param.modifier && (
                    <Typography variant="caption" color="secondary" sx={{ ml: 0.5 }}>
                      :{param.modifier}
                    </Typography>
                  )}
                  {param.comparator && param.comparator !== 'eq' && (
                    <Typography variant="caption" color="secondary" sx={{ ml: 0.5 }}>
                      {COMPARATORS[param.comparator]?.symbol}
                    </Typography>
                  )}
                  <Typography variant="caption" sx={{ ml: 0.5 }}>
                    = {param.value?.substring(0, 20)}{param.value?.length > 20 ? '...' : ''}
                  </Typography>
                </Box>
              }
              variant="outlined"
              size="medium"
              sx={{ minWidth: 150 }}
            />
          </React.Fragment>
        ))}
        
        {/* Result Node */}
        {query.parameters.length > 0 && (
          <>
            <ArrowForwardIcon color="action" />
            <Chip 
              icon={<TableIcon />}
              label="Results"
              color="success"
              sx={{ minWidth: 100 }}
            />
          </>
        )}
      </Stack>
    </Box>
  );
};

/**
 * Query Natural Language Description
 */
const QueryNaturalLanguage = ({ query }) => {
  const description = useMemo(() => {
    if (!query.resource) return 'Select a resource type to begin building your query';
    
    const parts = [`Find all ${query.resource} resources`];
    
    if (query.parameters.length === 0) {
      parts.push('(no filters applied)');
    } else {
      parts.push('where:');
      query.parameters.forEach((param, index) => {
        const paramConfig = FHIR_RESOURCES[query.resource]?.searchParams?.[param.key] || SPECIAL_FHIR_PARAMS[param.key];
        let desc = `  • ${param.key}`;
        
        if (param.modifier) {
          const modifierConfig = SEARCH_MODIFIERS[paramConfig?.type]?.[param.modifier];
          desc += ` (${modifierConfig?.label || param.modifier})`;
        }
        
        if (param.comparator && param.comparator !== 'eq') {
          desc += ` ${COMPARATORS[param.comparator]?.label || param.comparator}`;
        }
        
        desc += ` "${param.value}"`;
        parts.push(desc);
      });
    }
    
    if (query.sort) {
      parts.push(`sorted by ${query.sort}`);
    }
    
    if (query.count && query.count !== 20) {
      parts.push(`limited to ${query.count} results`);
    }
    
    return parts.join('\n');
  }, [query]);
  
  return (
    <Alert severity="info" icon={<InfoIcon />} sx={{ mt: 1 }}>
      <Typography variant="body2" component="pre" sx={{ fontFamily: 'inherit', m: 0 }}>
        {description}
      </Typography>
    </Alert>
  );
};

/**
 * Live Query Preview Component
 */
const LiveQueryPreview = ({ query, enabled }) => {
  const theme = useTheme();
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const fetchPreview = useCallback(
    debounce(async (queryObj) => {
      if (!queryObj.resource || !enabled) return;
      
      setLoading(true);
      setError(null);
      
      try {
        // Build minimal query for preview
        const params = {};
        queryObj.parameters.slice(0, 3).forEach(p => {
          if (p.key && p.value) {
            const key = p.modifier ? `${p.key}:${p.modifier}` : p.key;
            params[key] = p.comparator && p.comparator !== 'eq' 
              ? `${COMPARATORS[p.comparator].symbol}${p.value}`
              : p.value;
          }
        });
        
        // Add count limit for preview
        params._count = 5;
        params._summary = 'true';
        
        const startTime = Date.now();
        const result = await fhirClient.search(queryObj.resource, params);
        const executionTime = Date.now() - startTime;
        
        setPreview({
          count: result.total || 0,
          samples: result.resources?.slice(0, 3) || [],
          executionTime
        });
      } catch (err) {
        console.error('Preview failed:', err);
        setError('Preview unavailable');
      } finally {
        setLoading(false);
      }
    }, QUERY_STUDIO_CONFIG.previewDelay),
    [enabled]
  );
  
  useEffect(() => {
    if (query.resource && query.parameters.some(p => p.key && p.value)) {
      fetchPreview(query);
    } else {
      setPreview(null);
    }
  }, [query, fetchPreview]);
  
  if (!enabled) return null;
  
  return (
    <Card variant="outlined" sx={{ mt: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <PreviewIcon fontSize="small" color="primary" />
          <Typography variant="subtitle2">Live Preview</Typography>
          {loading && <CircularProgress size={16} />}
          {preview && (
            <Chip 
              label={`${preview.executionTime}ms`}
              size="small"
              color="success"
              sx={{ ml: 'auto' }}
            />
          )}
        </Box>
        
        {error && (
          <Alert severity="error" sx={{ py: 0.5 }}>
            <Typography variant="caption">{error}</Typography>
          </Alert>
        )}
        
        {preview && (
          <>
            <Alert severity="success" sx={{ py: 0.5, mb: 1 }}>
              <Typography variant="body2">
                Estimated <strong>{preview.count}</strong> results
              </Typography>
            </Alert>
            
            {preview.samples.length > 0 && (
              <Box>
                <Typography variant="caption" color="text.secondary" gutterBottom>
                  Sample Results:
                </Typography>
                {preview.samples.map((resource, index) => (
                  <Paper 
                    key={index} 
                    sx={{ 
                      p: 1, 
                      mb: 0.5, 
                      bgcolor: alpha(theme.palette.primary.main, 0.02)
                    }}
                  >
                    <Typography variant="caption" component="div">
                      <strong>{resource.resourceType}</strong> #{resource.id}
                      {resource.meta?.lastUpdated && (
                        <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                          {new Date(resource.meta.lastUpdated).toLocaleDateString()}
                        </Typography>
                      )}
                    </Typography>
                  </Paper>
                ))}
              </Box>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

/**
 * Query Optimizer Component
 */
const QueryOptimizer = ({ query, executionTime }) => {
  const theme = useTheme();
  
  const optimizations = useMemo(() => {
    const suggestions = [];
    
    // Performance optimizations
    if (executionTime > 1000) {
      suggestions.push({
        type: 'performance',
        severity: 'warning',
        message: 'Query took >1s. Consider adding _count parameter to limit results.',
        action: { key: '_count', value: '50' }
      });
    }
    
    // Missing patient scope
    if (!query.parameters.some(p => p.key === 'patient') && 
        query.resource !== 'Patient' && 
        ['Observation', 'Condition', 'MedicationRequest', 'Procedure'].includes(query.resource)) {
      suggestions.push({
        type: 'scope',
        severity: 'info',
        message: 'Consider filtering by patient to narrow scope and improve performance.',
        action: { key: 'patient' }
      });
    }
    
    // Missing date range
    if (!query.parameters.some(p => p.key === 'date' || p.key === '_lastUpdated')) {
      suggestions.push({
        type: 'scope',
        severity: 'info',
        message: 'Consider adding a date range to limit results to relevant time period.',
        action: { key: '_lastUpdated' }
      });
    }
    
    // Suggest includes for common patterns
    if (query.resource === 'MedicationRequest' && !query.includes?.length) {
      suggestions.push({
        type: 'enhancement',
        severity: 'success',
        message: 'Include medication details for complete information.',
        include: 'MedicationRequest:medication'
      });
    }
    
    if (query.resource === 'Observation' && !query.includes?.length) {
      suggestions.push({
        type: 'enhancement',
        severity: 'success',
        message: 'Include encounter details for context.',
        include: 'Observation:encounter'
      });
    }
    
    return suggestions;
  }, [query, executionTime]);
  
  if (optimizations.length === 0) return null;
  
  return (
    <Alert severity="info" icon={<SpeedIcon />} sx={{ mt: 2 }}>
      <AlertTitle>Query Optimization Suggestions</AlertTitle>
      <Stack spacing={1} sx={{ mt: 1 }}>
        {optimizations.map((opt, index) => (
          <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {opt.severity === 'warning' && <WarningIcon fontSize="small" color="warning" />}
            {opt.severity === 'success' && <TrendingUpIcon fontSize="small" color="success" />}
            {opt.severity === 'info' && <InfoIcon fontSize="small" color="info" />}
            <Typography variant="body2" sx={{ flex: 1 }}>
              {opt.message}
            </Typography>
            {opt.action && (
              <Button 
                size="small" 
                variant="outlined"
                onClick={() => console.log('Apply optimization:', opt.action)}
              >
                Apply
              </Button>
            )}
          </Box>
        ))}
      </Stack>
    </Alert>
  );
};

/**
 * Enhanced Parameter Builder with Distinct Values
 */
const EnhancedParameterBuilder = ({ resource, parameters, onParametersChange }) => {
  const theme = useTheme();
  const [distinctValues, setDistinctValues] = useState({});
  const [loadingValues, setLoadingValues] = useState({});
  const distinctValuesCache = useRef(new Map());
  
  const resourceConfig = FHIR_RESOURCES[resource] || {};
  const searchParams = resourceConfig.searchParams || {};
  
  // Fetch distinct values for a parameter
  const fetchDistinctValues = useCallback(async (paramName, index) => {
    if (!QUERY_STUDIO_CONFIG.enableDistinctValues) return [];
    
    const cacheKey = `${resource}:${paramName}`;
    
    // Check cache first
    if (distinctValuesCache.current.has(cacheKey)) {
      const cached = distinctValuesCache.current.get(cacheKey);
      if (Date.now() - cached.timestamp < QUERY_STUDIO_CONFIG.cacheTTL) {
        return cached.values;
      }
    }
    
    setLoadingValues(prev => ({ ...prev, [index]: true }));
    
    try {
      // Try to fetch distinct values from the API
      const response = await fetch(
        `/api/fhir/search-values/${resource}/${paramName}?limit=${QUERY_STUDIO_CONFIG.distinctValueLimit}`
      );
      
      if (response.ok) {
        const data = await response.json();
        const values = data.values?.map(item => ({
          value: item.value || item.value_string || item.value_reference,
          label: item.display || item.value || item.value_string,
          count: item.usage_count,
          description: `Used in ${item.usage_count} resources`
        })) || [];
        
        // Cache the results
        if (QUERY_STUDIO_CONFIG.cacheDistinctValues) {
          distinctValuesCache.current.set(cacheKey, {
            values,
            timestamp: Date.now()
          });
        }
        
        return values;
      }
    } catch (error) {
      console.log('Distinct values API not available, using fallback');
    } finally {
      setLoadingValues(prev => ({ ...prev, [index]: false }));
    }
    
    // Fallback to catalog or hardcoded values
    return await loadCatalogSuggestions(paramName);
  }, [resource]);
  
  // Load catalog suggestions as fallback
  const loadCatalogSuggestions = async (paramName) => {
    try {
      let suggestions = [];
      
      if (resource === 'Observation' && paramName === 'code') {
        const labs = await cdsClinicalDataService.getLabCatalog(null, null, 50);
        suggestions = labs.map(lab => ({
          value: lab.loinc_code || lab.test_code,
          label: lab.test_name,
          description: lab.test_description || lab.specimen_type
        }));
      } else if (resource === 'Condition' && paramName === 'code') {
        const conditions = await cdsClinicalDataService.getDynamicConditionCatalog(null, 50);
        suggestions = conditions.map(cond => ({
          value: cond.snomed_code || cond.icd10_code || cond.id,
          label: cond.display_name,
          description: cond.usage_count ? `Used ${cond.usage_count} times` : cond.category
        }));
      } else if (resource === 'MedicationRequest' && paramName === 'medication') {
        const meds = await cdsClinicalDataService.getDynamicMedicationCatalog(null, 50);
        suggestions = meds.map(med => ({
          value: med.rxnorm_code || med.id,
          label: med.brand_name ? `${med.generic_name} (${med.brand_name})` : med.generic_name,
          description: med.strength && med.dosage_form ? `${med.strength} ${med.dosage_form}` : med.dosage_form
        }));
      } else if (paramName === 'status' || paramName === 'clinical-status') {
        suggestions = getCommonStatusValues(resource);
      } else if (paramName === 'gender') {
        suggestions = [
          { value: 'male', label: 'Male' },
          { value: 'female', label: 'Female' },
          { value: 'other', label: 'Other' },
          { value: 'unknown', label: 'Unknown' }
        ];
      }
      
      return suggestions;
    } catch (error) {
      console.error('Failed to load catalog suggestions:', error);
      return [];
    }
  };
  
  // Get common status values
  const getCommonStatusValues = (resourceType) => {
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
  
  const handleAddParameter = () => {
    onParametersChange([...parameters, { key: '', comparator: '', modifier: '', value: '' }]);
  };
  
  const handleUpdateParameter = async (index, field, value) => {
    const updated = [...parameters];
    updated[index] = { ...updated[index], [field]: value };
    
    // Load distinct values when parameter is selected
    if (field === 'key' && value) {
      const values = await fetchDistinctValues(value, index);
      setDistinctValues(prev => ({ ...prev, [index]: values }));
      
      // Reset dependent fields
      updated[index].comparator = '';
      updated[index].modifier = '';
      updated[index].value = '';
    }
    
    onParametersChange(updated);
  };
  
  const handleRemoveParameter = (index) => {
    onParametersChange(parameters.filter((_, i) => i !== index));
    // Clean up distinct values cache for this index
    setDistinctValues(prev => {
      const newValues = { ...prev };
      delete newValues[index];
      return newValues;
    });
  };
  
  const handleAddSuggestedParameter = (suggestion) => {
    const newParam = {
      key: suggestion.key,
      value: suggestion.value || '',
      comparator: '',
      modifier: ''
    };
    onParametersChange([...parameters, newParam]);
  };
  
  // Get operators and modifiers for parameter type
  const getOperators = (paramType) => {
    if (['date', 'quantity', 'number'].includes(paramType)) {
      return COMPARATORS;
    }
    return {};
  };
  
  const getModifiers = (paramType) => {
    return SEARCH_MODIFIERS[paramType] || {};
  };
  
  return (
    <Stack spacing={2}>
      {parameters.map((param, index) => {
        const paramConfig = searchParams[param.key] || SPECIAL_FHIR_PARAMS[param.key];
        const paramType = paramConfig?.type || 'string';
        const operators = getOperators(paramType);
        const modifiers = getModifiers(paramType);
        const values = distinctValues[index] || [];
        
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
            <Grid container spacing={2} alignItems="flex-start">
              {/* Parameter Selection */}
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
                      helperText={paramConfig?.type ? `Type: ${paramConfig.type}` : ''}
                    />
                  )}
                />
              </Grid>
              
              {/* Operator Selection */}
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
                      <MenuItem value="">
                        <em>None (Equals)</em>
                      </MenuItem>
                      {Object.entries(modifiers).map(([key, mod]) => (
                        <MenuItem key={key} value={key}>
                          {mod.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              )}
              
              {/* Value Input with Distinct Values */}
              <Grid item xs={12} sm={Object.keys(operators).length > 0 || Object.keys(modifiers).length > 0 ? 3 : 7}>
                {values.length > 0 ? (
                  <Autocomplete
                    value={param.value}
                    onChange={(e, value) => {
                      const actualValue = typeof value === 'object' ? value?.value : value;
                      handleUpdateParameter(index, 'value', actualValue || '');
                    }}
                    options={values}
                    getOptionLabel={(option) => {
                      if (typeof option === 'string') return option;
                      return option.label || option.value || '';
                    }}
                    renderOption={(props, option) => (
                      <Box component="li" {...props}>
                        <Box sx={{ width: '100%' }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="body2">{option.label || option.value}</Typography>
                            {option.count && (
                              <Chip 
                                label={option.count} 
                                size="small" 
                                color="primary"
                                sx={{ ml: 1 }}
                              />
                            )}
                          </Box>
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
                              {loadingValues[index] && <CircularProgress size={20} />}
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
                      paramType === 'date' ? 'YYYY-MM-DD' :
                      paramType === 'token' ? 'code or system|code' :
                      paramType === 'reference' ? 'Resource/id' :
                      'Enter value...'
                    }
                    InputProps={{
                      endAdornment: loadingValues[index] && (
                        <InputAdornment position="end">
                          <CircularProgress size={20} />
                        </InputAdornment>
                      )
                    }}
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
            
            {/* Parameter Description */}
            {param.key && paramConfig?.description && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                <InfoIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
                {paramConfig.description}
              </Typography>
            )}
          </Paper>
        );
      })}
      
      {/* Add Parameter Button */}
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
        <Button
          startIcon={<AddIcon />}
          onClick={handleAddParameter}
          variant="outlined"
          size="small"
        >
          Add Parameter
        </Button>
        
        {/* AND/OR Logic Help */}
        <Alert severity="info" sx={{ flex: 1, py: 0.5 }}>
          <Typography variant="caption">
            <strong>Logic:</strong> Multiple parameters use AND | Comma-separated values use OR
          </Typography>
        </Alert>
      </Box>
      
      {/* Smart Parameter Suggestions */}
      <SmartParameterSuggestions
        resource={resource}
        existingParams={parameters}
        onAddParameter={handleAddSuggestedParameter}
      />
    </Stack>
  );
};

/**
 * Enhanced Results Table with Field Selection
 */
const EnhancedResultsTable = ({ data }) => {
  const theme = useTheme();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedFields, setSelectedFields] = useState([]);
  const [fieldSelectorAnchor, setFieldSelectorAnchor] = useState(null);
  const [expandedRows, setExpandedRows] = useState(new Set());
  
  // Extract resources from various response formats
  const resources = data?.resources || data?.bundle?.entry?.map(e => e.resource) || data?.entry?.map(e => e.resource) || [];
  
  // Get all available fields from the first resource
  const availableFields = useMemo(() => {
    if (resources.length === 0) return [];
    
    const fields = new Set(['id', 'resourceType']);
    const sampleResource = resources[0];
    
    // Add common fields based on resource type
    if (sampleResource.meta) fields.add('lastUpdated');
    if (sampleResource.name) fields.add('name');
    if (sampleResource.code) fields.add('code');
    if (sampleResource.status) fields.add('status');
    if (sampleResource.patient) fields.add('patient');
    if (sampleResource.subject) fields.add('subject');
    if (sampleResource.encounter) fields.add('encounter');
    if (sampleResource.performer) fields.add('performer');
    if (sampleResource.date) fields.add('date');
    if (sampleResource.effectiveDateTime) fields.add('effectiveDateTime');
    if (sampleResource.value) fields.add('value');
    if (sampleResource.valueQuantity) fields.add('valueQuantity');
    if (sampleResource.category) fields.add('category');
    
    return Array.from(fields);
  }, [resources]);
  
  // Initialize selected fields
  useEffect(() => {
    if (selectedFields.length === 0 && availableFields.length > 0) {
      setSelectedFields(availableFields.slice(0, 5));
    }
  }, [availableFields, selectedFields.length]);
  
  const handleFieldToggle = (field) => {
    setSelectedFields(prev => {
      if (prev.includes(field)) {
        return prev.filter(f => f !== field);
      } else {
        return [...prev, field];
      }
    });
  };
  
  const getFieldValue = (resource, field) => {
    switch (field) {
      case 'lastUpdated':
        return resource.meta?.lastUpdated ? new Date(resource.meta.lastUpdated).toLocaleDateString() : '-';
      case 'name':
        if (resource.name?.[0]) {
          const name = resource.name[0];
          return name.text || `${name.given?.join(' ')} ${name.family}`;
        }
        return '-';
      case 'code':
        return resource.code?.text || resource.code?.coding?.[0]?.display || '-';
      case 'patient':
      case 'subject':
        const ref = resource.patient || resource.subject;
        return ref?.reference || ref?.display || '-';
      case 'valueQuantity':
        return resource.valueQuantity ? `${resource.valueQuantity.value} ${resource.valueQuantity.unit}` : '-';
      default:
        return resource[field] || '-';
    }
  };
  
  const toggleRowExpansion = (index) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedRows(newExpanded);
  };
  
  if (resources.length === 0) {
    return (
      <Alert severity="info">No results found</Alert>
    );
  }
  
  return (
    <>
      {/* Field Selector */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
        <Button
          startIcon={<ViewColumnIcon />}
          onClick={(e) => setFieldSelectorAnchor(e.currentTarget)}
          size="small"
          variant="outlined"
        >
          Select Fields ({selectedFields.length})
        </Button>
        <Popover
          open={Boolean(fieldSelectorAnchor)}
          anchorEl={fieldSelectorAnchor}
          onClose={() => setFieldSelectorAnchor(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <Box sx={{ p: 2, minWidth: 200 }}>
            <Typography variant="subtitle2" gutterBottom>
              Select Fields to Display
            </Typography>
            <FormGroup>
              {availableFields.map(field => (
                <FormControlLabel
                  key={field}
                  control={
                    <Checkbox
                      checked={selectedFields.includes(field)}
                      onChange={() => handleFieldToggle(field)}
                      size="small"
                    />
                  }
                  label={field}
                />
              ))}
            </FormGroup>
          </Box>
        </Popover>
      </Box>
      
      {/* Results Table */}
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell width={40} />
              {selectedFields.map(field => (
                <TableCell key={field}>
                  {field.charAt(0).toUpperCase() + field.slice(1)}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {resources
              .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
              .map((resource, index) => {
                const globalIndex = page * rowsPerPage + index;
                const isExpanded = expandedRows.has(globalIndex);
                
                return (
                  <React.Fragment key={globalIndex}>
                    <TableRow hover>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => toggleRowExpansion(globalIndex)}
                        >
                          {isExpanded ? <ExpandLess /> : <ExpandMore />}
                        </IconButton>
                      </TableCell>
                      {selectedFields.map(field => (
                        <TableCell key={field}>
                          {getFieldValue(resource, field)}
                        </TableCell>
                      ))}
                    </TableRow>
                    {isExpanded && (
                      <TableRow>
                        <TableCell colSpan={selectedFields.length + 1}>
                          <Paper sx={{ p: 2, bgcolor: alpha(theme.palette.primary.main, 0.02) }}>
                            <Typography variant="subtitle2" gutterBottom>
                              Full Resource JSON
                            </Typography>
                            <pre style={{ 
                              margin: 0, 
                              fontSize: '0.75rem', 
                              overflow: 'auto',
                              maxHeight: 300
                            }}>
                              {JSON.stringify(resource, null, 2)}
                            </pre>
                          </Paper>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
          </TableBody>
        </Table>
      </TableContainer>
      
      <TablePagination
        component="div"
        count={resources.length}
        page={page}
        onPageChange={(e, newPage) => setPage(newPage)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(e) => {
          setRowsPerPage(parseInt(e.target.value, 10));
          setPage(0);
        }}
        rowsPerPageOptions={[5, 10, 25, 50]}
      />
    </>
  );
};

/**
 * Main Enhanced Query Studio Component
 */
function QueryStudioEnhanced({ onNavigate, useFHIRData, onClose }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.down('lg'));
  
  // State management
  const [mode, setMode] = useState('visual');
  const [resource, setResource] = useState('');
  const [parameters, setParameters] = useState([]);
  const [codeQuery, setCodeQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [resultView, setResultView] = useState('table');
  const [executionTime, setExecutionTime] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [livePreviewEnabled, setLivePreviewEnabled] = useState(QUERY_STUDIO_CONFIG.enableLivePreview);
  
  // Collapsible sections state
  const [sections, setSections] = useState({
    resource: true,
    parameters: true,
    advanced: false,
    comprehension: true,
    optimization: false
  });
  
  const toggleSection = (section) => {
    setSections(prev => ({ ...prev, [section]: !prev[section] }));
  };
  
  // Build query from visual parameters
  const buildQuery = useCallback(() => {
    if (mode === 'code') return codeQuery;
    
    let query = `/${resource}`;
    const paramStrings = parameters
      .filter(p => p.key && p.value)
      .map(p => {
        let paramName = p.key;
        let modifier = '';

        // Add modifier if present (don't encode the colon - it's part of FHIR syntax)
        if (p.modifier) {
          const paramConfig = FHIR_RESOURCES[resource]?.searchParams?.[p.key] || SPECIAL_FHIR_PARAMS[p.key];
          const paramType = paramConfig?.type || 'string';
          const modifierSymbol = SEARCH_MODIFIERS[paramType]?.[p.modifier]?.symbol;
          if (modifierSymbol) {
            modifier = modifierSymbol;  // Keep modifier separate to avoid encoding the colon
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

        // Only encode the parameter name and value, not the modifier (colon)
        return `${encodeURIComponent(paramName)}${modifier}=${encodeURIComponent(value)}`;
      });
    
    if (paramStrings.length > 0) {
      query += '?' + paramStrings.join('&');
    }
    
    return query;
  }, [mode, resource, parameters, codeQuery]);
  
  // Execute query
  const executeQuery = useCallback(async () => {
    const query = buildQuery();
    if (!query || query === '/') return;
    
    setLoading(true);
    setError(null);
    const startTime = Date.now();
    
    try {
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
  
  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Compact App Bar */}
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar variant="dense">
          <IconButton edge="start" color="primary" sx={{ mr: 1 }}>
            <QueryBuilderIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 0, mr: 2 }}>
            Query Studio
          </Typography>
          
          <Box sx={{ flexGrow: 1 }} />
          
          {/* Mode Toggle */}
          <ToggleButtonGroup
            value={mode}
            exclusive
            onChange={(e, value) => value && setMode(value)}
            size="small"
            sx={{ mr: 2 }}
          >
            <ToggleButton value="visual">
              <Tooltip title="Visual Builder">
                <BuildIcon fontSize="small" />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="code">
              <Tooltip title="Code Editor">
                <CodeIcon fontSize="small" />
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>
          
          {/* Execute Button */}
          <Button
            variant="contained"
            color="primary"
            size="small"
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <RunIcon />}
            onClick={executeQuery}
            disabled={loading || !resource}
            sx={{ mr: 2 }}
          >
            {loading ? 'Running...' : 'Execute'}
          </Button>
          
          {/* Settings */}
          <IconButton 
            size="small" 
            onClick={() => setShowSettings(!showSettings)}
            color={showSettings ? 'primary' : 'default'}
          >
            <SettingsIcon fontSize="small" />
          </IconButton>
        </Toolbar>
      </AppBar>
      
      {/* Settings Panel */}
      <Collapse in={showSettings}>
        <Paper sx={{ p: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={livePreviewEnabled}
                    onChange={(e) => setLivePreviewEnabled(e.target.checked)}
                  />
                }
                label="Enable Live Preview"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={QUERY_STUDIO_CONFIG.enableDistinctValues}
                    onChange={(e) => {
                      QUERY_STUDIO_CONFIG.enableDistinctValues = e.target.checked;
                      setShowSettings(false);
                    }}
                  />
                }
                label="Enable Distinct Values"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={QUERY_STUDIO_CONFIG.enableQueryOptimizer}
                    onChange={(e) => {
                      QUERY_STUDIO_CONFIG.enableQueryOptimizer = e.target.checked;
                      setShowSettings(false);
                    }}
                  />
                }
                label="Enable Query Optimizer"
              />
            </Grid>
          </Grid>
        </Paper>
      </Collapse>
      
      {/* Main Content Area */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left Panel - Query Builder */}
        <Box sx={{ 
          width: isMobile ? '100%' : '50%', 
          display: 'flex', 
          flexDirection: 'column',
          borderRight: `1px solid ${theme.palette.divider}`,
          overflow: 'auto'
        }}>
          <Box sx={{ p: 2 }}>
            {mode === 'visual' ? (
              <Stack spacing={1}>
                {/* Resource Selection */}
                <CollapsibleSection
                  title="Resource Type"
                  icon={<StorageIcon color="primary" />}
                  defaultExpanded={sections.resource}
                  badge={resource ? 1 : 0}
                >
                  <FormControl fullWidth size="small">
                    <Select
                      value={resource}
                      onChange={(e) => {
                        setResource(e.target.value);
                        setParameters([]);
                      }}
                      displayEmpty
                    >
                      <MenuItem value="" disabled>
                        <em>Select a resource type...</em>
                      </MenuItem>
                      {Object.keys(FHIR_RESOURCES).map(r => (
                        <MenuItem key={r} value={r}>
                          {r}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </CollapsibleSection>
                
                {/* Parameters */}
                {resource && (
                  <CollapsibleSection
                    title="Search Parameters"
                    icon={<FilterIcon color="primary" />}
                    defaultExpanded={sections.parameters}
                    badge={parameters.filter(p => p.key && p.value).length}
                  >
                    <EnhancedParameterBuilder
                      resource={resource}
                      parameters={parameters}
                      onParametersChange={setParameters}
                    />
                  </CollapsibleSection>
                )}
                
                {/* Query Comprehension */}
                {resource && (
                  <CollapsibleSection
                    title="Query Comprehension"
                    icon={<PsychologyIcon color="primary" />}
                    defaultExpanded={sections.comprehension}
                  >
                    <QueryFlowDiagram 
                      query={{ resource, parameters }} 
                      theme={theme}
                    />
                    <QueryNaturalLanguage 
                      query={{ resource, parameters }}
                    />
                    <LiveQueryPreview
                      query={{ resource, parameters }}
                      enabled={livePreviewEnabled}
                    />
                  </CollapsibleSection>
                )}
                
                {/* Query Optimization */}
                {resource && QUERY_STUDIO_CONFIG.enableQueryOptimizer && (
                  <CollapsibleSection
                    title="Optimization"
                    icon={<SpeedIcon color="primary" />}
                    defaultExpanded={sections.optimization}
                  >
                    <QueryOptimizer
                      query={{ resource, parameters }}
                      executionTime={executionTime}
                    />
                  </CollapsibleSection>
                )}
              </Stack>
            ) : (
              // Code Mode
              <Paper sx={{ height: '100%', p: 1 }}>
                <Editor
                  height="400px"
                  language="plaintext"
                  theme={theme.palette.mode === 'dark' ? 'vs-dark' : 'light'}
                  value={codeQuery}
                  onChange={(value) => setCodeQuery(value || '')}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    wordWrap: 'on'
                  }}
                />
              </Paper>
            )}
          </Box>
        </Box>
        
        {/* Right Panel - Results */}
        <Box sx={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {/* Results Header */}
          <Box sx={{ 
            p: 1, 
            borderBottom: `1px solid ${theme.palette.divider}`,
            display: 'flex',
            alignItems: 'center',
            gap: 1
          }}>
            <Typography variant="subtitle1" sx={{ flex: 1 }}>
              Results
              {executionTime && (
                <Chip 
                  label={`${executionTime}ms`} 
                  size="small" 
                  color="success"
                  sx={{ ml: 1 }} 
                />
              )}
              {results?.total !== undefined && (
                <Chip 
                  label={`${results.total} found`} 
                  size="small" 
                  color="primary"
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
              <IconButton
                size="small"
                onClick={() => navigator.clipboard.writeText(JSON.stringify(results, null, 2))}
              >
                <CopyIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
          
          {/* Results Content */}
          <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
            {error ? (
              <Alert severity="error">
                {error}
              </Alert>
            ) : results ? (
              resultView === 'table' ? (
                <EnhancedResultsTable data={results} />
              ) : (
                <Paper sx={{ p: 2, height: '100%', overflow: 'auto' }}>
                  <pre style={{ margin: 0, fontSize: '0.8rem' }}>
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
                flexDirection: 'column'
              }}>
                <SearchIcon sx={{ fontSize: 48, opacity: 0.3, mb: 2 }} />
                <Typography variant="body1" color="text.secondary">
                  Build and execute a query to see results
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default QueryStudioEnhanced;