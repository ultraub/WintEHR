/**
 * Enhanced Schema Explorer Component for FHIR Explorer v4
 * 
 * Interactive FHIR resource documentation with full R4 schema support
 * Features complete resource browsing, live examples, and validation
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Alert,
  Button,
  Grid,
  TextField,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Tooltip,
  Tabs,
  Tab,
  InputAdornment,
  Badge,
  CircularProgress,
  Skeleton
} from '@mui/material';
// TreeView removed - using custom list-based implementation
import {
  Schema as SchemaIcon,
  Search as SearchIcon,
  ContentCopy as CopyIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Category as CategoryIcon,
  DataObject as DataObjectIcon,
  Numbers as NumbersIcon,
  TextFields as TextFieldsIcon,
  CalendarToday as CalendarIcon,
  Link as LinkIcon,
  List as ListIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon,
  Clear as ClearIcon
} from '@mui/icons-material';
// alpha import removed - not used in custom list implementation
import { fhirSchemaService } from '../../../services/fhirSchemaService';

// Enhanced color mapping for all FHIR data types
const DATA_TYPE_ICONS = {
  // Primitive types
  boolean: { icon: <CheckCircleIcon />, color: '#2196F3' },
  integer: { icon: <NumbersIcon />, color: '#FF9800' },
  string: { icon: <TextFieldsIcon />, color: '#4CAF50' },
  decimal: { icon: <NumbersIcon />, color: '#FF9800' },
  uri: { icon: <LinkIcon />, color: '#9C27B0' },
  url: { icon: <LinkIcon />, color: '#9C27B0' },
  canonical: { icon: <LinkIcon />, color: '#9C27B0' },
  base64Binary: { icon: <DataObjectIcon />, color: '#795548' },
  instant: { icon: <CalendarIcon />, color: '#00BCD4' },
  date: { icon: <CalendarIcon />, color: '#00BCD4' },
  dateTime: { icon: <CalendarIcon />, color: '#00BCD4' },
  time: { icon: <CalendarIcon />, color: '#00BCD4' },
  code: { icon: <CategoryIcon />, color: '#E91E63' },
  markdown: { icon: <TextFieldsIcon />, color: '#4CAF50' },
  id: { icon: <CategoryIcon />, color: '#9E9E9E' },
  // Complex types
  Identifier: { icon: <CategoryIcon />, color: '#3F51B5' },
  HumanName: { icon: <TextFieldsIcon />, color: '#3F51B5' },
  Address: { icon: <DataObjectIcon />, color: '#3F51B5' },
  ContactPoint: { icon: <DataObjectIcon />, color: '#3F51B5' },
  CodeableConcept: { icon: <CategoryIcon />, color: '#E91E63' },
  Coding: { icon: <CategoryIcon />, color: '#E91E63' },
  Reference: { icon: <LinkIcon />, color: '#FF5722' },
  // Default
  default: { icon: <DataObjectIcon />, color: '#607D8B' }
};

// Example data for different types
const EXAMPLE_DATA = {
  boolean: 'true',
  integer: '42',
  string: '"Example text"',
  decimal: '3.14159',
  uri: '"http://example.org/fhir"',
  url: '"https://example.org"',
  instant: '"2024-01-15T10:30:00.000Z"',
  date: '"2024-01-15"',
  dateTime: '"2024-01-15T10:30:00"',
  code: '"active"',
  id: '"123e4567-e89b-12d3-a456-426614174000"',
  Reference: '{\n  "reference": "Patient/123",\n  "display": "John Doe"\n}',
  Identifier: '{\n  "system": "http://example.org/mrn",\n  "value": "12345"\n}',
  HumanName: '{\n  "use": "official",\n  "family": "Doe",\n  "given": ["John", "James"]\n}',
  CodeableConcept: '{\n  "coding": [{\n    "system": "http://snomed.info/sct",\n    "code": "386661006",\n    "display": "Fever"\n  }],\n  "text": "Fever"\n}'
};

function SchemaExplorer({ onNavigate, useFHIRData }) {
  const fhirData = useFHIRData?.() || null;
  
  // State
  const [selectedResource, setSelectedResource] = useState('Patient');
  const [selectedElement, setSelectedElement] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [resourceTypes, setResourceTypes] = useState([]);
  const [schemas, setSchemas] = useState({});
  const [elementTypes, setElementTypes] = useState(null);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [loadingSchema, setLoadingSchema] = useState(false);
  const [elementSearchTerm, setElementSearchTerm] = useState('');

  // Load resource types on mount
  useEffect(() => {
    loadResourceTypes();
    loadElementTypes();
    loadStats();
  }, []);

  // Load schema when resource is selected
  useEffect(() => {
    if (selectedResource) {
      loadResourceSchema(selectedResource);
    }
  }, [selectedResource]);
  
  // Removed expandedNodes initialization - not needed for list-based implementation

  const loadResourceTypes = async () => {
    try {
      setLoading(true);
      const types = await fhirSchemaService.getResourceTypes();
      setResourceTypes(types);
      setError(null);
    } catch (error) {
      console.error('Failed to load resource types:', error);
      setError('Using offline mode - limited resources available');
      // Fallback to common types
      setResourceTypes(['Patient', 'Observation', 'Condition', 'MedicationRequest', 'Procedure', 'Encounter', 'DiagnosticReport', 'AllergyIntolerance']);
    } finally {
      setLoading(false);
    }
  };

  const loadResourceSchema = async (resourceType) => {
    try {
      setLoadingSchema(true);
      setError(null);
      
      const schema = await fhirSchemaService.getResourceSchema(resourceType);
      
      // Verify schema structure
      if (!schema || typeof schema !== 'object') {
        throw new Error('Invalid schema structure received');
      }
      
      // Update schemas state
      setSchemas(prev => ({ ...prev, [resourceType]: schema }));
      
      // Schema loaded successfully
      
    } catch (error) {
      console.error(`Failed to load schema for ${resourceType}:`, error);
      setError(`Failed to load schema for ${resourceType}: ${error.message}`);
      // Clear any cached bad data
      setSchemas(prev => {
        const updated = { ...prev };
        delete updated[resourceType];
        return updated;
      });
    } finally {
      setLoadingSchema(false);
    }
  };

  const loadElementTypes = async () => {
    try {
      const types = await fhirSchemaService.getElementTypes();
      setElementTypes(types);
    } catch (error) {
      console.error('Failed to load element types:', error);
    }
  };

  const loadStats = async () => {
    try {
      const statsData = await fhirSchemaService.getSchemaStats();
      setStats(statsData);
    } catch (error) {
      console.error('Failed to load stats:', error);
      // Set default stats on error
      setStats({
        totalResources: resourceTypes.length || 0,
        categories: {}
      });
    }
  };

  // Filter resources based on search
  const filteredResources = useMemo(() => {
    if (!searchTerm) return resourceTypes;
    
    const searchLower = searchTerm.toLowerCase();
    return resourceTypes.filter(resource => {
      const schema = schemas[resource];
      return resource.toLowerCase().includes(searchLower) ||
        (schema && schema.description && schema.description.toLowerCase().includes(searchLower));
    });
  }, [searchTerm, resourceTypes, schemas]);

  // Get schema for selected resource
  const currentSchema = useMemo(() => {
    return schemas[selectedResource] || null;
  }, [selectedResource, schemas]);

  // Helper function to check if an element matches search criteria
  const elementMatchesSearch = useCallback((key, element, searchTerm) => {
    if (!searchTerm) return true;
    
    const search = searchTerm.toLowerCase();
    const keyLower = key.toLowerCase();
    const typeLower = (element.type || '').toLowerCase();
    const descriptionLower = (element.description || '').toLowerCase();
    
    return keyLower.includes(search) || 
           typeLower.includes(search) || 
           descriptionLower.includes(search);
  }, []);

  // Recursive function to find all matching elements
  const findMatchingElements = useCallback((elements, parentId = '', searchTerm = '') => {
    if (!elements || typeof elements !== 'object') {
      return [];
    }
    
    const matches = [];
    
    Object.entries(elements).forEach(([key, element]) => {
      if (!element || typeof element !== 'object') return;
      
      const nodeId = parentId ? `${parentId}.${key}` : key;
      
      // Check if this element matches
      if (elementMatchesSearch(key, element, searchTerm)) {
        matches.push(nodeId);
      }
      
      // Check child elements
      if (element.elements) {
        matches.push(...findMatchingElements(element.elements, nodeId, searchTerm));
      }
    });
    
    return matches;
  }, [elementMatchesSearch]);

  // buildTreeItems function removed - now using custom list-based implementation

  // TreeView-related functions removed - using custom list-based implementation

  // Copy to clipboard
  const copyToClipboard = useCallback((text) => {
    navigator.clipboard.writeText(text);
  }, []);

  // Get live example from actual data
  const getLiveExample = useCallback((resourceType, elementPath) => {
    if (!fhirData || !fhirData.resources || !fhirData.resources[resourceType]) {
      return null;
    }

    const resources = fhirData.resources[resourceType];
    if (resources.length === 0) return null;

    // Get a random resource
    const resource = resources[Math.floor(Math.random() * resources.length)];
    
    // Navigate to the element
    let value = resource;
    const pathParts = elementPath.split('.');
    pathParts.shift(); // Remove resource type
    
    for (const part of pathParts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return null;
      }
    }

    return value;
  }, [fhirData]);

  // Export schema
  const exportSchema = useCallback(() => {
    if (!currentSchema) return;
    
    const dataStr = JSON.stringify(currentSchema, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `${selectedResource}_schema.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  }, [currentSchema, selectedResource]);

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Schema Explorer
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Chip
            icon={<SchemaIcon />}
            label={`${stats?.totalResources || resourceTypes.length} Resources`}
            color="primary"
          />
          <Chip
            icon={<TrendingUpIcon />}
            label={`${Object.keys(schemas).length} Loaded`}
            color="secondary"
          />
        </Box>
      </Box>

      {error && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Resource List */}
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 2, height: 'calc(100vh - 240px)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search resources..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                )
              }}
              sx={{ mb: 2 }}
            />

            <Typography variant="subtitle2" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              FHIR R4 Resources
              <Chip label={filteredResources.length} size="small" />
            </Typography>
            <Divider sx={{ mb: 2 }} />

            {loading ? (
              <Box sx={{ flex: 1 }}>
                {[...Array(8)].map((_, i) => (
                  <Skeleton key={i} height={48} sx={{ mb: 1 }} />
                ))}
              </Box>
            ) : (
              <List dense sx={{ flex: 1, overflow: 'auto' }}>
                {filteredResources.map(resource => (
                  <ListItem
                    key={resource}
                    button
                    selected={selectedResource === resource}
                    onClick={() => setSelectedResource(resource)}
                    sx={{
                      borderRadius: 1,
                      mb: 0.5,
                      position: 'relative',
                      '&.Mui-selected': {
                        bgcolor: 'primary.light',
                        color: 'primary.contrastText',
                        '& .MuiListItemIcon-root': {
                          color: 'primary.contrastText'
                        }
                      }
                    }}
                  >
                    <ListItemIcon>
                      <Badge 
                        color="success" 
                        variant="dot" 
                        invisible={!schemas[resource]}
                        sx={{ '& .MuiBadge-dot': { right: -3, top: -3 } }}
                      >
                        <SchemaIcon color={selectedResource === resource ? 'inherit' : 'primary'} />
                      </Badge>
                    </ListItemIcon>
                    <ListItemText
                      primary={resource}
                      secondary={
                        schemas[resource] 
                          ? schemas[resource].description?.substring(0, 50) + '...'
                          : 'Click to load schema'
                      }
                      secondaryTypographyProps={{ 
                        noWrap: true,
                        color: selectedResource === resource ? 'inherit' : 'text.secondary',
                        fontSize: '0.75rem'
                      }}
                    />
                    {fhirData && fhirData.resources && fhirData.resources[resource] && (
                      <Chip
                        label={fhirData.resources[resource].length}
                        size="small"
                        color={selectedResource === resource ? 'default' : 'secondary'}
                        sx={{ height: 20, fontSize: '0.7rem' }}
                      />
                    )}
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </Grid>

        {/* Schema Tree */}
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 3, height: 'calc(100vh - 240px)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <SchemaIcon sx={{ mr: 1, color: 'primary.main' }} />
              <Typography variant="h6" sx={{ flex: 1 }}>
                {selectedResource} Schema
              </Typography>
              {/* Expand/Collapse buttons removed - not needed for list-based implementation */}
              <Tooltip title="Export schema">
                <span>
                  <IconButton size="small" onClick={exportSchema} disabled={!currentSchema}>
                    <DownloadIcon />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Refresh schema">
                <span>
                  <IconButton 
                    size="small" 
                    onClick={async () => {
                      fhirSchemaService.clearCache();
                      await loadResourceSchema(selectedResource);
                    }}
                    disabled={loadingSchema}
                  >
                    <RefreshIcon />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>

            <TextField
              fullWidth
              size="small"
              placeholder="Search elements..."
              value={elementSearchTerm}
              onChange={(e) => setElementSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
                endAdornment: elementSearchTerm && (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={() => setElementSearchTerm('')}
                    >
                      <ClearIcon />
                    </IconButton>
                  </InputAdornment>
                )
              }}
              sx={{ mb: 1 }}
            />
            
            {elementSearchTerm && currentSchema?.elements && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  {(() => {
                    const matches = Object.entries(currentSchema.elements)
                      .filter(([key, element]) => elementMatchesSearch(key, element, elementSearchTerm));
                    return `${matches.length} element${matches.length === 1 ? '' : 's'} found`;
                  })()}
                </Typography>
                <Button
                  size="small"
                  variant="text"
                  onClick={() => setElementSearchTerm('')}
                  sx={{ minWidth: 'auto', px: 1 }}
                >
                  Clear
                </Button>
              </Box>
            )}

            {loadingSchema ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : currentSchema ? (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  {currentSchema.description}
                </Typography>

                {currentSchema.elements && Object.keys(currentSchema.elements).length > 0 ? (
                  <Box sx={{ flex: 1, overflow: 'auto' }}>
                    {/* Schema Elements List */}
                    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}>
                      <Typography variant="subtitle2" sx={{ p: 2, bgcolor: 'grey.50' }}>
                        FHIR Schema Elements
                      </Typography>
                      <List dense>
                        {Object.entries(currentSchema.elements)
                          .filter(([key, element]) => {
                            if (!elementSearchTerm) return true;
                            return elementMatchesSearch(key, element, elementSearchTerm);
                          })
                          .map(([key, element]) => {
                            const displayKey = element.isChoice ? `${key}[x]` : key;
                            const highlightText = (text, highlight) => {
                              if (!highlight) return text;
                              const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
                              return parts.map((part, index) => 
                                part.toLowerCase() === highlight.toLowerCase() ? (
                                  <mark key={index} style={{ backgroundColor: '#ffeb3b', padding: '0 2px' }}>
                                    {part}
                                  </mark>
                                ) : part
                              );
                            };
                            
                            return (
                              <ListItem 
                                key={key} 
                                button 
                                onClick={() => setSelectedElement({ key: displayKey, path: key, ...element })}
                                sx={{
                                  pl: 2,
                                  '&:hover': { bgcolor: 'action.hover' },
                                  borderBottom: '1px solid',
                                  borderColor: 'divider'
                                }}
                              >
                                <ListItemIcon>
                                  <Box sx={{ color: DATA_TYPE_ICONS[element.type]?.color || '#607D8B' }}>
                                    {DATA_TYPE_ICONS[element.type]?.icon || <DataObjectIcon />}
                                  </Box>
                                </ListItemIcon>
                                <ListItemText 
                                  primary={
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <Typography variant="body2" component="span" sx={{ fontWeight: element.required ? 600 : 400 }}>
                                        {elementSearchTerm ? highlightText(displayKey, elementSearchTerm) : displayKey}
                                      </Typography>
                                      {element.required && (
                                        <Chip label="required" size="small" color="error" sx={{ height: 16, fontSize: '0.65rem' }} />
                                      )}
                                      {element.array && (
                                        <Chip label="array" size="small" color="primary" sx={{ height: 16, fontSize: '0.65rem' }} />
                                      )}
                                      {element.binding && (
                                        <Chip 
                                          label={element.binding.strength} 
                                          size="small" 
                                          color="secondary" 
                                          sx={{ height: 16, fontSize: '0.65rem' }} 
                                        />
                                      )}
                                    </span>
                                  }
                                  secondary={
                                    <Typography variant="caption" color="text.secondary" component="span">
                                      {elementSearchTerm ? highlightText(element.type, elementSearchTerm) : element.type} - {element.description?.substring(0, 100)}...
                                    </Typography>
                                  }
                                />
                              </ListItem>
                            );
                          })}
                      </List>
                    </Box>
                  </Box>
                ) : (
                  <Alert severity="warning" sx={{ mt: 2 }}>
                    No schema elements available for this resource. 
                    {currentSchema.url && (
                      <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                        Schema URL: {currentSchema.url}
                      </Typography>
                    )}
                    <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                      Resource Type: {currentSchema.resourceType || 'Unknown'}
                    </Typography>
                  </Alert>
                )}
              </>
            ) : (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <SchemaIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary">
                  Select a resource to view its schema
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Element Details */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, height: 'calc(100vh - 240px)', overflow: 'auto' }}>
            {selectedElement ? (
              <>
                <Typography variant="h6" gutterBottom>
                  {selectedElement.key}
                </Typography>

                <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} sx={{ mb: 2 }}>
                  <Tab label="Details" />
                  <Tab label="Examples" />
                  <Tab label="Validation" />
                </Tabs>

                {activeTab === 0 && (
                  <Box>
                    <List dense>
                      <ListItem>
                        <ListItemText
                          primary="Type"
                          secondary={selectedElement.type}
                        />
                        {DATA_TYPE_ICONS[selectedElement.type] && (
                          <Box sx={{ color: DATA_TYPE_ICONS[selectedElement.type].color }}>
                            {DATA_TYPE_ICONS[selectedElement.type].icon}
                          </Box>
                        )}
                      </ListItem>
                      
                      <ListItem>
                        <ListItemText
                          primary="Required"
                          secondary={selectedElement.required ? 'Yes' : 'No'}
                        />
                        {selectedElement.required ? (
                          <LockIcon color="error" />
                        ) : (
                          <LockOpenIcon color="success" />
                        )}
                      </ListItem>

                      {selectedElement.array && (
                        <ListItem>
                          <ListItemText
                            primary="Cardinality"
                            secondary="0..*"
                          />
                          <ListIcon color="primary" />
                        </ListItem>
                      )}

                      {selectedElement.binding && (
                        <ListItem>
                          <ListItemText
                            primary="Value Set Binding"
                            secondary={
                              <span>
                                <Typography variant="body2" component="span" display="block">
                                  Strength: {selectedElement.binding.strength}
                                </Typography>
                                {selectedElement.binding.valueSet && (
                                  <Typography variant="caption" color="text.secondary" component="span" display="block">
                                    {selectedElement.binding.valueSet}
                                  </Typography>
                                )}
                                {selectedElement.binding.description && (
                                  <Typography variant="caption" component="span" display="block">
                                    {selectedElement.binding.description}
                                  </Typography>
                                )}
                              </span>
                            }
                          />
                          <CategoryIcon color="secondary" />
                        </ListItem>
                      )}

                      {selectedElement.targetTypes && (
                        <ListItem>
                          <ListItemText
                            primary="Target Types"
                            secondary={selectedElement.targetTypes.join(', ')}
                          />
                        </ListItem>
                      )}
                      
                      {selectedElement.isChoice && selectedElement.choices && (
                        <ListItem>
                          <ListItemText
                            primary="Choice Types"
                            secondary={
                              <span>
                                {selectedElement.choices.map((choice, idx) => (
                                  <Chip 
                                    key={idx} 
                                    label={choice.type} 
                                    size="small" 
                                    sx={{ mr: 0.5, mb: 0.5 }} 
                                  />
                                ))}
                              </span>
                            }
                          />
                        </ListItem>
                      )}
                    </List>

                    <Divider sx={{ my: 2 }} />

                    <Typography variant="subtitle2" gutterBottom>
                      Description
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {selectedElement.description}
                    </Typography>

                    {selectedElement.path && (
                      <>
                        <Typography variant="subtitle2" sx={{ mt: 2 }} gutterBottom>
                          Path
                        </Typography>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', bgcolor: 'grey.100', p: 1, borderRadius: 1 }}>
                          {selectedElement.path}
                        </Typography>
                      </>
                    )}
                  </Box>
                )}

                {activeTab === 1 && (
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Example Value
                    </Typography>
                    <Paper
                      sx={{
                        p: 2,
                        bgcolor: 'grey.100',
                        fontFamily: 'monospace',
                        fontSize: '0.875rem',
                        position: 'relative'
                      }}
                    >
                      <IconButton
                        size="small"
                        sx={{ position: 'absolute', top: 4, right: 4 }}
                        onClick={() => copyToClipboard(EXAMPLE_DATA[selectedElement.type] || '{}')}
                      >
                        <CopyIcon fontSize="small" />
                      </IconButton>
                      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {EXAMPLE_DATA[selectedElement.type] || '// No example available'}
                      </pre>
                    </Paper>

                    {fhirData && (
                      <>
                        <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>
                          Live Example from Patient Data
                        </Typography>
                        {(() => {
                          const liveExample = getLiveExample(selectedResource, selectedElement.path);
                          return liveExample !== null ? (
                            <Paper
                              sx={{
                                p: 2,
                                bgcolor: 'success.light',
                                fontFamily: 'monospace',
                                fontSize: '0.875rem',
                                position: 'relative'
                              }}
                            >
                              <IconButton
                                size="small"
                                sx={{ position: 'absolute', top: 4, right: 4 }}
                                onClick={() => copyToClipboard(JSON.stringify(liveExample, null, 2))}
                              >
                                <CopyIcon fontSize="small" />
                              </IconButton>
                              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                {JSON.stringify(liveExample, null, 2)}
                              </pre>
                            </Paper>
                          ) : (
                            <Alert severity="info">
                              No live example available in current patient data
                            </Alert>
                          );
                        })()}
                      </>
                    )}
                  </Box>
                )}

                {activeTab === 2 && (
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Validation Rules
                    </Typography>
                    <List dense>
                      <ListItem>
                        <ListItemIcon>
                          <InfoIcon color="info" />
                        </ListItemIcon>
                        <ListItemText
                          primary="Data Type"
                          secondary={`Must be a valid ${selectedElement.type}`}
                        />
                      </ListItem>

                      {selectedElement.required && (
                        <ListItem>
                          <ListItemIcon>
                            <WarningIcon color="warning" />
                          </ListItemIcon>
                          <ListItemText
                            primary="Required Field"
                            secondary="This field must be present"
                          />
                        </ListItem>
                      )}

                      {selectedElement.fixed && (
                        <ListItem>
                          <ListItemIcon>
                            <LockIcon color="error" />
                          </ListItemIcon>
                          <ListItemText
                            primary="Fixed Value"
                            secondary={`Must be: ${selectedElement.fixed}`}
                          />
                        </ListItem>
                      )}

                      {selectedElement.binding && (
                        <ListItem>
                          <ListItemIcon>
                            <CategoryIcon color="secondary" />
                          </ListItemIcon>
                          <ListItemText
                            primary="Value Set Binding"
                            secondary={`Values from: ${selectedElement.binding}`}
                          />
                        </ListItem>
                      )}

                      {selectedElement.array && (
                        <ListItem>
                          <ListItemIcon>
                            <ListIcon color="primary" />
                          </ListItemIcon>
                          <ListItemText
                            primary="Array Field"
                            secondary="Can contain multiple values"
                          />
                        </ListItem>
                      )}
                      
                      {selectedElement.constraints && selectedElement.constraints.length > 0 && (
                        <>
                          <Divider sx={{ my: 2 }} />
                          <Typography variant="subtitle2" gutterBottom>
                            Constraints
                          </Typography>
                          {selectedElement.constraints.map((constraint, idx) => (
                            <ListItem key={idx}>
                              <ListItemIcon>
                                {constraint.severity === 'error' ? (
                                  <WarningIcon color="error" />
                                ) : (
                                  <InfoIcon color="warning" />
                                )}
                              </ListItemIcon>
                              <ListItemText
                                primary={`${constraint.key}: ${constraint.human}`}
                                secondary={constraint.expression && (
                                  <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                                    {constraint.expression}
                                  </Typography>
                                )}
                              />
                            </ListItem>
                          ))}
                        </>
                      )}
                    </List>
                  </Box>
                )}
              </>
            ) : (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <SchemaIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary">
                  Select a field to view details
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Click on any element in the schema tree to see its properties, examples, and validation rules
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

export default SchemaExplorer;