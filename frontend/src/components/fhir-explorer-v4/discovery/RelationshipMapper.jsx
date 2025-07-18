/**
 * Relationship Mapper Component for FHIR Explorer v4
 * 
 * Enhanced version with D3.js visualization and dynamic relationship discovery
 * Shows actual relationships from the FHIR data using the backend API
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Button,
  Card,
  CardContent,
  CardHeader,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Stack,
  Alert,
  IconButton,
  Tooltip,
  Autocomplete,
  TextField,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Switch,
  FormControlLabel,
  Slider,
  CircularProgress,
  LinearProgress,
  Tab,
  Tabs,
  Badge,
  Menu,
  ListItemButton,
  Collapse,
  ToggleButton,
  ToggleButtonGroup
} from '@mui/material';
import {
  AccountTree,
  Hub as HubIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  CenterFocusStrong as CenterIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Person as PersonIcon,
  LocalHospital as HospitalIcon,
  Science as ScienceIcon,
  Medication as MedicationIcon,
  Assignment as AssignmentIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  FilterList as FilterIcon,
  Share as ShareIcon,
  Download as DownloadIcon,
  Search as SearchIcon,
  Timeline as TimelineIcon,
  BubbleChart as BubbleIcon,
  DeviceHub as NetworkIcon,
  Category as CategoryIcon,
  Analytics as AnalyticsIcon,
  Route as RouteIcon,
  AutoGraph as GraphIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  MoreVert as MoreIcon,
  Close as CloseIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
  PhotoCamera as ScreenshotIcon,
  RadioButtonUnchecked as RadioButtonUncheckedIcon,
  Circle as CircleIcon
} from '@mui/icons-material';
import * as d3 from 'd3';

// Import services
import { fhirRelationshipService } from '../../../services/fhirRelationshipService';
import { fhirClient } from '../../../core/fhir/services/fhirClient';

// Visualization constants
const NODE_RADIUS = {
  MIN: 8,
  MAX: 20,
  DEFAULT: 12
};

const LINK_DISTANCE = {
  MIN: 50,
  MAX: 200,
  DEFAULT: 100
};

const CHARGE_STRENGTH = {
  MIN: -500,
  MAX: -100,
  DEFAULT: -300
};

const LAYOUTS = {
  FORCE: 'force',
  RADIAL: 'radial',
  HIERARCHICAL: 'hierarchical',
  CIRCULAR: 'circular'
};

function RelationshipMapper({ selectedResource, onResourceSelect, useFHIRData }) {
  // State management
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentResource, setCurrentResource] = useState(null);
  const [relationshipData, setRelationshipData] = useState(null);
  const [visibleNodeTypes, setVisibleNodeTypes] = useState(new Set());
  const [selectedNode, setSelectedNode] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [currentLayout, setCurrentLayout] = useState(LAYOUTS.FORCE);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showStatistics, setShowStatistics] = useState(false);
  const [statistics, setStatistics] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentTab, setCurrentTab] = useState(0);
  const [layoutSettings, setLayoutSettings] = useState({
    nodeSize: NODE_RADIUS.DEFAULT,
    linkDistance: LINK_DISTANCE.DEFAULT,
    chargeStrength: CHARGE_STRENGTH.DEFAULT,
    showLabels: true,
    showLinkLabels: false,
    curved: true,
    animate: true
  });

  // Refs
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const simulationRef = useRef(null);
  const zoomRef = useRef(null);

  // Get FHIR data - useFHIRData is a hook function passed as prop
  const fhirData = useFHIRData?.();
  const resources = fhirData?.resources || {};
  console.log('RelationshipMapper - fhirData:', fhirData);
  console.log('RelationshipMapper - resources:', resources);

  // Fetch relationship schema on mount
  useEffect(() => {
    fetchRelationshipSchema();
    fetchStatistics();
  }, []);

  // Fetch relationship schema
  const fetchRelationshipSchema = async () => {
    try {
      const schema = await fhirRelationshipService.getRelationshipSchema();
      // Initialize visible node types with common ones
      setVisibleNodeTypes(new Set([
        'Patient', 'Observation', 'Condition', 'MedicationRequest', 
        'Encounter', 'Practitioner', 'Organization'
      ]));
    } catch (err) {
      console.error('Error fetching relationship schema:', err);
    }
  };

  // Fetch statistics
  const fetchStatistics = async () => {
    try {
      const stats = await fhirRelationshipService.getRelationshipStatistics();
      setStatistics(stats);
    } catch (err) {
      console.error('Error fetching statistics:', err);
    }
  };

  // Use ref to store the latest initialization function
  const initializeVisualizationRef = useRef(null);
  
  // Load relationships for a resource
  const loadRelationships = useCallback(async (resourceType, resourceId, depth = 2) => {
    console.log('loadRelationships called with:', { resourceType, resourceId, depth });
    setLoading(true);
    setError(null);

    try {
      // Fetch relationships from API
      const data = await fhirRelationshipService.discoverRelationships(
        resourceType, 
        resourceId, 
        { depth, includeCounts: true }
      );
      console.log('API response:', data);

      // Transform to D3 format
      const d3Data = fhirRelationshipService.transformToD3Format(data);
      console.log('D3 data:', d3Data);
      
      setRelationshipData(d3Data);
      setCurrentResource({ resourceType, resourceId, display: data.source.display });
      
      // Update visible node types
      const nodeTypes = new Set(d3Data.nodes.map(n => n.resourceType));
      setVisibleNodeTypes(nodeTypes);

      // Initialize visualization after a short delay to ensure DOM is ready
      console.log('Initializing visualization with data:', d3Data);
      setTimeout(() => {
        if (svgRef.current && initializeVisualizationRef.current) {
          initializeVisualizationRef.current(d3Data);
        }
      }, 100);
    } catch (err) {
      setError(`Failed to load relationships: ${err.message}`);
      console.error('Error loading relationships:', err);
      console.error('Full error:', err.response?.data || err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initialize D3 visualization
  const initializeVisualization = useCallback((data) => {
    console.log('initializeVisualization called, svgRef:', svgRef.current, 'data:', data);
    if (!svgRef.current || !data) {
      console.warn('Cannot initialize visualization - missing svgRef or data');
      return;
    }

    // Ensure the SVG has dimensions - wait a frame if needed
    const checkAndInitialize = () => {
      const svg = d3.select(svgRef.current);
      const width = svgRef.current.clientWidth;
      const height = svgRef.current.clientHeight;
      console.log('SVG dimensions:', { width, height });
      
      if (width === 0 || height === 0) {
        console.warn('SVG has no dimensions, waiting for next frame...');
        requestAnimationFrame(checkAndInitialize);
        return;
      }

    // Clear previous visualization
    svg.selectAll('*').remove();

    // Create container groups
    const g = svg.append('g').attr('class', 'main-group');
    const linksGroup = g.append('g').attr('class', 'links');
    const nodesGroup = g.append('g').attr('class', 'nodes');
    const labelsGroup = g.append('g').attr('class', 'labels');

    // Create zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
        setZoomLevel(event.transform.k);
      });

    svg.call(zoom);
    zoomRef.current = zoom;

    // Initialize force simulation
    const simulation = d3.forceSimulation(data.nodes)
      .force('link', d3.forceLink(data.links)
        .id(d => d.id)
        .distance(layoutSettings.linkDistance)
      )
      .force('charge', d3.forceManyBody()
        .strength(layoutSettings.chargeStrength)
      )
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide()
        .radius(d => getNodeRadius(d) + 5)
      );

    simulationRef.current = simulation;

    // Create links
    const links = linksGroup.selectAll('path')
      .data(data.links)
      .enter().append('path')
      .attr('class', 'link')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', d => d.type === 'reverse' ? 1 : 2)
      .attr('stroke-dasharray', d => d.type === 'one-to-many' ? '5,5' : null)
      .attr('fill', 'none')
      .attr('marker-end', 'url(#arrowhead)');

    // Create arrow markers
    svg.append('defs').append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 20)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 8)
      .attr('markerHeight', 8)
      .append('path')
      .attr('d', 'M 0,-5 L 10,0 L 0,5')
      .attr('fill', '#999');

    // Create nodes
    const nodes = nodesGroup.selectAll('circle')
      .data(data.nodes)
      .enter().append('circle')
      .attr('class', 'node')
      .attr('r', d => getNodeRadius(d))
      .attr('fill', d => fhirRelationshipService.getResourceColor(d.resourceType))
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .call(drag(simulation));

    // Add labels if enabled
    if (layoutSettings.showLabels) {
      const labels = labelsGroup.selectAll('text')
        .data(data.nodes)
        .enter().append('text')
        .attr('class', 'label')
        .attr('text-anchor', 'middle')
        .attr('dy', '.35em')
        .attr('font-size', '12px')
        .attr('pointer-events', 'none')
        .text(d => d.display || d.id);
    }

    // Add interactions
    nodes
      .on('click', handleNodeClick)
      .on('mouseenter', handleNodeHover)
      .on('mouseleave', () => setHoveredNode(null));

    // Add tooltip
    nodes.append('title')
      .text(d => `${d.resourceType}: ${d.display || d.id}`);

    // Update positions on simulation tick
    simulation.on('tick', () => {
      // Update link positions
      links.attr('d', d => {
        if (layoutSettings.curved) {
          const dx = d.target.x - d.source.x;
          const dy = d.target.y - d.source.y;
          const dr = Math.sqrt(dx * dx + dy * dy);
          return `M${d.source.x},${d.source.y}A${dr},${dr} 0 0,1 ${d.target.x},${d.target.y}`;
        } else {
          return `M${d.source.x},${d.source.y}L${d.target.x},${d.target.y}`;
        }
      });

      // Update node positions
      nodes
        .attr('cx', d => d.x)
        .attr('cy', d => d.y);

      // Update label positions
      if (layoutSettings.showLabels) {
        labelsGroup.selectAll('text')
          .attr('x', d => d.x)
          .attr('y', d => d.y + getNodeRadius(d) + 15);
      }
    });

    // Apply initial layout
    applyLayout(currentLayout, data, simulation);
    };
    
    // Start the initialization check
    checkAndInitialize();
  }, [currentLayout, layoutSettings]);
  
  // Update the ref whenever initializeVisualization changes
  useEffect(() => {
    initializeVisualizationRef.current = initializeVisualization;
  }, [initializeVisualization]);

  // Get node radius based on connections
  const getNodeRadius = (node) => {
    if (!relationshipData) return layoutSettings.nodeSize;
    
    const connections = relationshipData.links.filter(
      l => l.source.id === node.id || l.target.id === node.id
    ).length;
    
    const scale = d3.scaleLinear()
      .domain([0, 10])
      .range([layoutSettings.nodeSize * 0.8, layoutSettings.nodeSize * 1.5])
      .clamp(true);
    
    return scale(connections);
  };

  // Drag behavior
  const drag = (simulation) => {
    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    return d3.drag()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended);
  };

  // Handle node click
  const handleNodeClick = (event, node) => {
    setSelectedNode(node);
    if (onResourceSelect) {
      onResourceSelect(node.resourceType, node.id.split('/')[1]);
    }
  };

  // Handle node hover
  const handleNodeHover = (event, node) => {
    setHoveredNode(node);
    
    // Highlight connected nodes and links
    const svg = d3.select(svgRef.current);
    const connectedNodes = new Set([node.id]);
    
    relationshipData.links.forEach(link => {
      if (link.source.id === node.id) connectedNodes.add(link.target.id);
      if (link.target.id === node.id) connectedNodes.add(link.source.id);
    });

    // Dim non-connected nodes
    svg.selectAll('.node')
      .style('opacity', d => connectedNodes.has(d.id) ? 1 : 0.3);
    
    svg.selectAll('.link')
      .style('opacity', d => 
        d.source.id === node.id || d.target.id === node.id ? 1 : 0.1
      );
  };

  // Apply layout algorithm
  const applyLayout = (layout, data, simulation) => {
    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    switch (layout) {
      case LAYOUTS.RADIAL:
        // Radial layout with selected node at center
        const centerNode = selectedNode || data.nodes[0];
        
        // Apply radial positions
        data.nodes.forEach((node, i) => {
          if (node.id === centerNode.id) {
            node.x = width / 2;
            node.y = height / 2;
          } else {
            const angle = (i / data.nodes.length) * 2 * Math.PI;
            const radius = 150 + (node.depth || 0) * 100;
            node.x = width / 2 + radius * Math.cos(angle);
            node.y = height / 2 + radius * Math.sin(angle);
          }
        });
        break;

      case LAYOUTS.HIERARCHICAL:
        // Hierarchical tree layout
        try {
          // Create a simple tree layout based on depth
          const depthGroups = {};
          data.nodes.forEach(node => {
            const depth = node.depth || 0;
            if (!depthGroups[depth]) {
              depthGroups[depth] = [];
            }
            depthGroups[depth].push(node);
          });
          
          const maxDepth = Math.max(...Object.keys(depthGroups).map(Number));
          const yStep = (height - 100) / (maxDepth + 1);
          
          Object.entries(depthGroups).forEach(([depth, nodes]) => {
            const xStep = (width - 100) / (nodes.length + 1);
            nodes.forEach((node, i) => {
              node.x = xStep * (i + 1);
              node.y = 50 + yStep * Number(depth);
            });
          });
        } catch (error) {
          console.error('Error applying hierarchical layout:', error);
          // Fall back to force layout
        }
        break;

      case LAYOUTS.CIRCULAR:
        // Circular layout
        const radius = Math.min(width, height) / 2 - 50;
        data.nodes.forEach((node, i) => {
          const angle = (i / data.nodes.length) * 2 * Math.PI;
          node.x = width / 2 + radius * Math.cos(angle);
          node.y = height / 2 + radius * Math.sin(angle);
        });
        break;

      default:
        // Force layout - let simulation handle it
        break;
    }

    // Restart simulation with new positions
    simulation.nodes(data.nodes);
    simulation.alpha(1).restart();
  };

  // Zoom controls
  const handleZoomIn = () => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current)
      .transition()
      .duration(300)
      .call(zoomRef.current.scaleBy, 1.3);
  };

  const handleZoomOut = () => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current)
      .transition()
      .duration(300)
      .call(zoomRef.current.scaleBy, 0.7);
  };

  const handleZoomReset = () => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current)
      .transition()
      .duration(300)
      .call(zoomRef.current.transform, d3.zoomIdentity);
  };

  // Export visualization as image
  const exportAsImage = () => {
    if (!svgRef.current) return;
    
    const svgElement = svgRef.current;
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    canvas.width = svgElement.clientWidth;
    canvas.height = svgElement.clientHeight;
    
    img.onload = () => {
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      
      canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `fhir-relationships-${Date.now()}.png`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
      });
    };
    
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  // Search for resources
  const handleSearch = async () => {
    if (!searchQuery) return;
    
    try {
      // Search for patients by name
      const results = await fhirClient.searchPatients({ name: searchQuery });
      
      if (results.resources && results.resources.length > 0) {
        const patient = results.resources[0];
        loadRelationships('Patient', patient.id);
      }
    } catch (err) {
      setError(`Search failed: ${err.message}`);
    }
  };

  // Render statistics
  const renderStatistics = () => {
    if (!statistics) return null;

    return (
      <Card>
        <CardHeader 
          title="Relationship Statistics" 
          avatar={<AnalyticsIcon />}
        />
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Typography variant="h6">{statistics.totalResources}</Typography>
              <Typography variant="body2" color="text.secondary">
                Total Resources
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="h6">{statistics.totalRelationships}</Typography>
              <Typography variant="body2" color="text.secondary">
                Total Relationships
              </Typography>
            </Grid>
          </Grid>
          
          <Divider sx={{ my: 2 }} />
          
          <Typography variant="subtitle2" gutterBottom>
            Most Connected Resources
          </Typography>
          <List dense>
            {statistics.mostConnectedResources?.slice(0, 5).map((resource, index) => (
              <ListItem key={index}>
                <ListItemText
                  primary={`${resource.resourceType}/${resource.id}`}
                  secondary={`${resource.connectionCount} connections`}
                />
              </ListItem>
            ))}
          </List>
        </CardContent>
      </Card>
    );
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Grid container alignItems="center" spacing={2}>
          <Grid item xs>
            <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <NetworkIcon color="primary" />
              Resource Relationship Mapper
            </Typography>
          </Grid>
          <Grid item>
            <Stack direction="row" spacing={1}>
              <TextField
                size="small"
                placeholder="Search resources..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                }}
              />
              <ToggleButtonGroup
                value={currentLayout}
                exclusive
                onChange={(e, layout) => layout && setCurrentLayout(layout)}
                size="small"
              >
                <ToggleButton value={LAYOUTS.FORCE}>
                  <Tooltip title="Force Layout">
                    <BubbleIcon />
                  </Tooltip>
                </ToggleButton>
                <ToggleButton value={LAYOUTS.RADIAL}>
                  <Tooltip title="Radial Layout">
                    <HubIcon />
                  </Tooltip>
                </ToggleButton>
                <ToggleButton value={LAYOUTS.HIERARCHICAL}>
                  <Tooltip title="Tree Layout">
                    <AccountTree />
                  </Tooltip>
                </ToggleButton>
                <ToggleButton value={LAYOUTS.CIRCULAR}>
                  <Tooltip title="Circular Layout">
                    <RadioButtonUncheckedIcon />
                  </Tooltip>
                </ToggleButton>
              </ToggleButtonGroup>
              <IconButton onClick={handleZoomIn} size="small">
                <ZoomInIcon />
              </IconButton>
              <IconButton onClick={handleZoomOut} size="small">
                <ZoomOutIcon />
              </IconButton>
              <IconButton onClick={handleZoomReset} size="small">
                <CenterIcon />
              </IconButton>
              <IconButton onClick={() => setIsFullscreen(!isFullscreen)} size="small">
                {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
              </IconButton>
              <IconButton onClick={exportAsImage} size="small">
                <ScreenshotIcon />
              </IconButton>
              <IconButton onClick={() => setShowSettings(true)} size="small">
                <SettingsIcon />
              </IconButton>
            </Stack>
          </Grid>
        </Grid>
      </Box>

      {/* Main Content */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Grid container sx={{ height: '100%' }}>
          {/* Left Panel */}
          <Grid item xs={12} md={3} sx={{ borderRight: 1, borderColor: 'divider', overflow: 'auto' }}>
            <Tabs value={currentTab} onChange={(e, v) => setCurrentTab(v)} variant="fullWidth">
              <Tab label="Explorer" />
              <Tab label="Statistics" />
            </Tabs>

            {currentTab === 0 && (
              <Box sx={{ p: 2 }}>
                {/* Show loading or empty state message */}
                {Object.values(resources).every(arr => arr.length === 0) && (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    <Typography variant="body2">
                      Loading FHIR resources... If this message persists, please check your data connection.
                    </Typography>
                  </Alert>
                )}
                
                {/* Resource selector */}
                <Autocomplete
                  options={Object.keys(resources).filter(key => resources[key]?.length > 0)}
                  renderInput={(params) => (
                    <TextField 
                      {...params} 
                      label="Select Resource Type" 
                      size="small"
                      helperText={Object.values(resources).every(arr => arr.length === 0) ? 
                        "Loading resources..." : undefined}
                    />
                  )}
                  onChange={(e, resourceType) => {
                    if (resourceType && resources[resourceType]?.length > 0) {
                      const resource = resources[resourceType][0];
                      console.log('Selected resource:', resourceType, resource);
                      // Extract just the ID part if it's prefixed
                      const resourceId = resource.id.includes('/') ? 
                        resource.id.split('/').pop() : 
                        resource.id;
                      loadRelationships(resourceType, resourceId);
                    }
                  }}
                  sx={{ mb: 2 }}
                  noOptionsText="No resources available. Please wait for data to load."
                />

                {/* Current resource info */}
                {currentResource && (
                  <Card sx={{ mb: 2 }}>
                    <CardHeader
                      title="Current Resource"
                      subheader={`${currentResource.resourceType}/${currentResource.resourceId}`}
                    />
                    <CardContent>
                      <Typography variant="body2">
                        {currentResource.display}
                      </Typography>
                    </CardContent>
                  </Card>
                )}

                {/* Selected node details */}
                {selectedNode && (
                  <Card sx={{ mb: 2 }}>
                    <CardHeader
                      title="Selected Node"
                      action={
                        <IconButton 
                          size="small"
                          onClick={() => loadRelationships(
                            selectedNode.resourceType, 
                            selectedNode.id.split('/')[1]
                          )}
                        >
                          <RefreshIcon />
                        </IconButton>
                      }
                    />
                    <CardContent>
                      <Typography variant="body2">
                        <strong>Type:</strong> {selectedNode.resourceType}
                      </Typography>
                      <Typography variant="body2">
                        <strong>ID:</strong> {selectedNode.id}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Display:</strong> {selectedNode.display}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Depth:</strong> {selectedNode.depth}
                      </Typography>
                    </CardContent>
                  </Card>
                )}

                {/* Relationship summary */}
                {relationshipData && (
                  <Card>
                    <CardHeader title="Relationship Summary" />
                    <CardContent>
                      <Typography variant="body2">
                        <strong>Nodes:</strong> {relationshipData.nodes.length}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Links:</strong> {relationshipData.links.length}
                      </Typography>
                      <Divider sx={{ my: 1 }} />
                      <Typography variant="subtitle2" gutterBottom>
                        Resource Types
                      </Typography>
                      <Stack direction="row" flexWrap="wrap" gap={0.5}>
                        {Array.from(visibleNodeTypes).map(type => (
                          <Chip
                            key={type}
                            label={type}
                            size="small"
                            sx={{
                              bgcolor: fhirRelationshipService.getResourceColor(type),
                              color: 'white'
                            }}
                          />
                        ))}
                      </Stack>
                    </CardContent>
                  </Card>
                )}
              </Box>
            )}

            {currentTab === 1 && (
              <Box sx={{ p: 2 }}>
                {renderStatistics()}
              </Box>
            )}
          </Grid>

          {/* Visualization Panel */}
          <Grid item xs={12} md={9} sx={{ position: 'relative', height: '100%', minHeight: '600px' }}>
            {loading && (
              <Box sx={{ 
                position: 'absolute', 
                top: 0, 
                left: 0, 
                right: 0, 
                bottom: 0, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                bgcolor: 'rgba(255,255,255,0.8)',
                zIndex: 10
              }}>
                <CircularProgress />
              </Box>
            )}

            {error && (
              <Alert severity="error" sx={{ m: 2 }}>
                {error}
              </Alert>
            )}

            <Box
              ref={containerRef}
              sx={{ 
                width: '100%', 
                height: '100%',
                position: isFullscreen ? 'fixed' : 'relative',
                top: isFullscreen ? 0 : 'auto',
                left: isFullscreen ? 0 : 'auto',
                right: isFullscreen ? 0 : 'auto',
                bottom: isFullscreen ? 0 : 'auto',
                zIndex: isFullscreen ? 1300 : 'auto',
                bgcolor: 'background.paper'
              }}
            >
              <svg
                ref={svgRef}
                width="100%"
                height="100%"
                style={{ cursor: 'grab' }}
              />

              {/* Zoom indicator */}
              <Paper sx={{ 
                position: 'absolute', 
                bottom: 16, 
                right: 16, 
                p: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}>
                <Typography variant="caption">
                  Zoom: {Math.round(zoomLevel * 100)}%
                </Typography>
              </Paper>
            </Box>
          </Grid>
        </Grid>
      </Box>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onClose={() => setShowSettings(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Visualization Settings</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <Box>
              <Typography gutterBottom>Node Size</Typography>
              <Slider
                value={layoutSettings.nodeSize}
                onChange={(e, value) => setLayoutSettings(prev => ({ ...prev, nodeSize: value }))}
                min={NODE_RADIUS.MIN}
                max={NODE_RADIUS.MAX}
                marks
                valueLabelDisplay="auto"
              />
            </Box>

            <Box>
              <Typography gutterBottom>Link Distance</Typography>
              <Slider
                value={layoutSettings.linkDistance}
                onChange={(e, value) => setLayoutSettings(prev => ({ ...prev, linkDistance: value }))}
                min={LINK_DISTANCE.MIN}
                max={LINK_DISTANCE.MAX}
                marks
                valueLabelDisplay="auto"
              />
            </Box>

            <Box>
              <Typography gutterBottom>Charge Strength</Typography>
              <Slider
                value={layoutSettings.chargeStrength}
                onChange={(e, value) => setLayoutSettings(prev => ({ ...prev, chargeStrength: value }))}
                min={CHARGE_STRENGTH.MIN}
                max={CHARGE_STRENGTH.MAX}
                marks
                valueLabelDisplay="auto"
              />
            </Box>

            <FormControlLabel
              control={
                <Switch
                  checked={layoutSettings.showLabels}
                  onChange={(e) => setLayoutSettings(prev => ({ ...prev, showLabels: e.target.checked }))}
                />
              }
              label="Show Node Labels"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={layoutSettings.showLinkLabels}
                  onChange={(e) => setLayoutSettings(prev => ({ ...prev, showLinkLabels: e.target.checked }))}
                />
              }
              label="Show Link Labels"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={layoutSettings.curved}
                  onChange={(e) => setLayoutSettings(prev => ({ ...prev, curved: e.target.checked }))}
                />
              }
              label="Curved Links"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={layoutSettings.animate}
                  onChange={(e) => setLayoutSettings(prev => ({ ...prev, animate: e.target.checked }))}
                />
              }
              label="Animate Transitions"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSettings(false)}>Close</Button>
          <Button 
            onClick={() => {
              setShowSettings(false);
              if (relationshipData) {
                initializeVisualization(relationshipData);
              }
            }}
            variant="contained"
          >
            Apply
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default RelationshipMapper;