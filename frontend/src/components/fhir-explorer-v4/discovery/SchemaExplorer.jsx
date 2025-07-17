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
  Card,
  CardContent,
  TextField,
  Autocomplete,
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  InputAdornment,
  LinearProgress,
  Badge,
  CircularProgress,
  Skeleton
} from '@mui/material';
import { TreeView, TreeItem } from '@mui/lab';
import {
  Schema as SchemaIcon,
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
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
  TrendingUp as TrendingUpIcon
} from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
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
  const [expandedNodes, setExpandedNodes] = useState(['root']);
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [resourceTypes, setResourceTypes] = useState([]);
  const [schemas, setSchemas] = useState({});
  const [elementTypes, setElementTypes] = useState(null);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [loadingSchema, setLoadingSchema] = useState(false);

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
      
      // Clear existing schema for this resource to force re-render
      setSchemas(prev => {
        const updated = { ...prev };
        delete updated[resourceType];
        return updated;
      });
      
      const schema = await fhirSchemaService.getResourceSchema(resourceType);
      console.log(`Loaded schema for ${resourceType}:`, schema); // Debug log
      
      // Verify schema structure
      if (!schema || typeof schema !== 'object') {
        throw new Error('Invalid schema structure received');
      }
      
      // Verify elements exist
      if (!schema.elements || Object.keys(schema.elements).length === 0) {
        console.warn(`No elements found in schema for ${resourceType}`);
      }
      
      // Update schemas state with a small delay to ensure React processes the update
      setTimeout(() => {
        setSchemas(prev => {
          const updated = { ...prev, [resourceType]: schema };
          console.log('Updated schemas state:', updated);
          console.log(`Schema for ${resourceType} has ${Object.keys(schema.elements || {}).length} elements`);
          return updated;
        });
        
        // Force expand first few nodes for better UX
        if (schema.elements) {
          const firstKeys = Object.keys(schema.elements).slice(0, 5);
          setExpandedNodes(['root', ...firstKeys]);
        }
      }, 100);
      
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
      setTimeout(() => setLoadingSchema(false), 150);
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

  // Build tree structure for schema
  const buildTreeItems = useCallback((elements, parentId = '') => {
    console.log('buildTreeItems called with:', { parentId, elementCount: Object.keys(elements || {}).length });
    
    if (!elements || typeof elements !== 'object') {
      console.warn('Invalid elements provided to buildTreeItems:', elements);
      return null;
    }
    
    const entries = Object.entries(elements);
    if (entries.length === 0) {
      console.warn('No elements to display in schema');
      return null;
    }
    
    const treeItems = entries.map(([key, element]) => {
      if (!element || typeof element !== 'object') {
        console.warn(`Invalid element for key ${key}:`, element);
        return null;
      }
      
      const nodeId = parentId ? `${parentId}.${key}` : key;
      
      // Handle choice elements
      let displayKey = key;
      let displayType = element.type || 'unknown';
      if (element.isChoice) {
        displayKey = `${key}[x]`;
        if (element.choices && element.choices.length > 0) {
          displayType = element.choices.map(c => c.type).join(' | ');
        }
      }
      
      const dataType = DATA_TYPE_ICONS[element.type] || DATA_TYPE_ICONS.default;
      
      // Create a simple label first to debug
      const labelContent = (
        <Box sx={{ display: 'flex', alignItems: 'center', py: 0.5, gap: 1 }}>
          <Box sx={{ color: dataType.color, display: 'flex', alignItems: 'center' }}>
            {React.cloneElement(dataType.icon, { fontSize: 'small' })}
          </Box>
          <Typography variant="body2" sx={{ fontWeight: element.required ? 600 : 400 }}>
            {displayKey}
          </Typography>
          {element.required && (
            <Chip label="REQ" size="small" color="error" sx={{ height: 16, fontSize: '0.7rem' }} />
          )}
          {element.array && (
            <Chip label="[]" size="small" color="primary" sx={{ height: 16, fontSize: '0.7rem' }} />
          )}
          <Typography variant="caption" color="text.secondary">
            ({displayType})
          </Typography>
        </Box>
      );
      
      return (
        <TreeItem
          key={nodeId}
          nodeId={nodeId}
          label={labelContent}
          onClick={() => setSelectedElement({ key: displayKey, path: nodeId, ...element })}
        >
          {element.elements && buildTreeItems(element.elements, nodeId)}
        </TreeItem>
      );
    }).filter(Boolean);
    
    console.log(`buildTreeItems returning ${treeItems.length} items`);
    return treeItems;
  }, []);

  // Handle node toggle
  const handleToggle = (event, nodeIds) => {
    setExpandedNodes(nodeIds);
  };

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
        {stats && (
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Chip
              icon={<SchemaIcon />}
              label={`${stats.totalResources} Resources`}
              color="primary"
            />
            <Chip
              icon={<TrendingUpIcon />}
              label={`${Object.keys(schemas).length} Loaded`}
              color="secondary"
            />
          </Box>
        )}
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
                      <SchemaIcon color={selectedResource === resource ? 'inherit' : 'primary'} />
                    </ListItemIcon>
                    <ListItemText
                      primary={resource}
                      secondary={
                        schemas[resource] 
                          ? schemas[resource].description?.substring(0, 50) + '...'
                          : 'Loading...'
                      }
                      secondaryTypographyProps={{ 
                        noWrap: true,
                        color: selectedResource === resource ? 'inherit' : 'text.secondary'
                      }}
                    />
                    {fhirData && fhirData.resources && fhirData.resources[resource] && (
                      <Chip
                        label={fhirData.resources[resource].length}
                        size="small"
                        color={selectedResource === resource ? 'default' : 'secondary'}
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
              <IconButton size="small" onClick={exportSchema} disabled={!currentSchema}>
                <DownloadIcon />
              </IconButton>
              <IconButton 
                size="small" 
                onClick={async () => {
                  fhirSchemaService.clearCache();
                  await loadResourceSchema(selectedResource);
                }}
                disabled={loadingSchema}
                title="Refresh schema"
              >
                <RefreshIcon />
              </IconButton>
            </Box>

            {loadingSchema ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : currentSchema ? (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  {currentSchema.description}
                </Typography>

                {/* Debug info */}
                {process.env.NODE_ENV === 'development' && (
                  <Alert severity="info" sx={{ mb: 2, fontSize: '0.75rem' }}>
                    Debug: Schema loaded with {Object.keys(currentSchema.elements || {}).length} elements
                  </Alert>
                )}

                {currentSchema.elements && Object.keys(currentSchema.elements).length > 0 ? (
                  <Box sx={{ flex: 1, overflow: 'auto' }}>
                    {/* Temporary simple list to debug */}
                    <List dense sx={{ mb: 2, bgcolor: 'grey.50', p: 1, borderRadius: 1 }}>
                      {Object.entries(currentSchema.elements).slice(0, 5).map(([key, element]) => (
                        <ListItem key={key}>
                          <ListItemText 
                            primary={`${key} (${element.type})`}
                            secondary={element.description?.substring(0, 50) + '...'}
                          />
                        </ListItem>
                      ))}
                    </List>
                    
                    <TreeView
                      defaultCollapseIcon={<ExpandMoreIcon />}
                      defaultExpandIcon={<ChevronRightIcon />}
                      expanded={expandedNodes}
                      onNodeToggle={handleToggle}
                      sx={{
                        '.MuiTreeItem-content': {
                          borderRadius: 1,
                          '&:hover': {
                            bgcolor: 'action.hover'
                          }
                        },
                        '.MuiTreeItem-label': {
                          fontSize: '0.875rem'
                        }
                      }}
                    >
                      {(() => {
                        const items = buildTreeItems(currentSchema.elements);
                        console.log('Built tree items:', items);
                        return items || [];
                      })()}
                    </TreeView>
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
                              <Box>
                                <Typography variant="body2">
                                  Strength: {selectedElement.binding.strength}
                                </Typography>
                                {selectedElement.binding.valueSet && (
                                  <Typography variant="caption" color="text.secondary">
                                    {selectedElement.binding.valueSet}
                                  </Typography>
                                )}
                                {selectedElement.binding.description && (
                                  <Typography variant="caption" display="block">
                                    {selectedElement.binding.description}
                                  </Typography>
                                )}
                              </Box>
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
                              <Box>
                                {selectedElement.choices.map((choice, idx) => (
                                  <Chip 
                                    key={idx} 
                                    label={choice.type} 
                                    size="small" 
                                    sx={{ mr: 0.5, mb: 0.5 }} 
                                  />
                                ))}
                              </Box>
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