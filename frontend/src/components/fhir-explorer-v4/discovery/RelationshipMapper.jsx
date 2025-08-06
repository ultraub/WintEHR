/**
 * Relationship Mapper Component for FHIR Explorer v4
 * 
 * Enhanced version with D3.js visualization and dynamic relationship discovery
 * Shows actual relationships from the FHIR data using the backend API
 */

import React, { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { throttle } from 'lodash';
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
  ToggleButtonGroup,
  Drawer,
  Modal,
  Fade,
  Backdrop
} from '@mui/material';
import {
  Stepper,
  Step,
  StepLabel
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
  Route as PathIcon,
  RadioButtonChecked as SourceIcon,
  FiberManualRecord as TargetIcon,
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
  Circle as CircleIcon,
  CheckBox as CheckBoxIcon,
  CompareArrows as CompareIcon,
  Menu as MenuIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon
} from '@mui/icons-material';
import * as d3 from 'd3';

// Import services
import { fhirRelationshipService } from '../../../services/fhirRelationshipService';

// Import components
import ResourceDetailsPanel from './ResourceDetailsPanel';
import RelationshipFilterPanel from './RelationshipFilterPanel';

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
  const [loadingStates, setLoadingStates] = useState({
    relationships: false,
    statistics: false,
    search: false,
    pathFinding: false,
    export: false
  });
  const [currentResource, setCurrentResource] = useState(null);
  const [selectedResourceType, setSelectedResourceType] = useState(null);
  const [relationshipData, setRelationshipData] = useState(null);
  const [visibleNodeTypes, setVisibleNodeTypes] = useState(new Set());
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedNodes, setSelectedNodes] = useState(new Set());
  const [hoveredNode, setHoveredNode] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [currentLayout, setCurrentLayout] = useState(LAYOUTS.FORCE);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showStatistics, setShowStatistics] = useState(false);
  const [statistics, setStatistics] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [currentTab, setCurrentTab] = useState(0);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [comparisonNodes, setComparisonNodes] = useState([]);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeFilters, setActiveFilters] = useState({});
  const [pathFindingMode, setPathFindingMode] = useState(false);
  const [pathSource, setPathSource] = useState(null);
  const [pathTarget, setPathTarget] = useState(null);
  const [discoveredPaths, setDiscoveredPaths] = useState(null);
  const [selectedPath, setSelectedPath] = useState(null);
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
  const isMountedRef = useRef(true);
  const isVisualizationInitializedRef = useRef(false);
  const abortControllerRef = useRef(null);
  const requestsInFlightRef = useRef(new Set());
  const lastLoadedResourceRef = useRef(null);

  // Get FHIR data - useFHIRData is a hook function passed as prop
  const fhirData = useFHIRData?.();
  const resources = fhirData?.resources || {};

  // Placeholder for handleSearch - will be defined later after updateNodeSelection
  const handleSearchRef = useRef(null);
  
  // Track component mount state and cleanup
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      isVisualizationInitializedRef.current = false;
      
      // Cancel any in-flight requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      // Clear all in-flight request tracking
      requestsInFlightRef.current.clear();
      
      // Clear the simulation if it exists
      if (simulationRef.current) {
        simulationRef.current.stop();
      }
    };
  }, []);

  // Initialize selectedResourceType when resources are first loaded
  useEffect(() => {
    if (!selectedResourceType && resources) {
      const availableResourceTypes = Object.keys(resources).filter(key => resources[key]?.length > 0);
      if (availableResourceTypes.length > 0) {
        setSelectedResourceType(availableResourceTypes[0]);
      }
    }
  }, [resources, selectedResourceType]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchQuery]);
  
  // Auto-search on debounced query change
  useEffect(() => {
    if (debouncedSearchQuery && relationshipData && handleSearchRef.current) {
      handleSearchRef.current();
    }
  }, [debouncedSearchQuery, relationshipData]);

  // Fetch relationship schema on mount
  useEffect(() => {
    let isSubscribed = true;
    const requestId = `init-${Date.now()}`;
    
    const init = async () => {
      // Prevent duplicate initialization in React StrictMode
      if (!isSubscribed || requestsInFlightRef.current.has('init')) {
        return;
      }
      
      requestsInFlightRef.current.add('init');
      
      try {
        // Only fetch once on mount
        await Promise.all([
          fetchRelationshipSchema(),
          fetchStatistics()
        ]);
        
        // Auto-load first available patient if we have data
        if (isSubscribed && resources.Patient && resources.Patient.length > 0 && !currentResource && !relationshipData) {
          const firstPatient = resources.Patient[0];
          const patientId = firstPatient.id.includes('/') ? 
            firstPatient.id.split('/').pop() : 
            firstPatient.id;
          
          // Check if we haven't already loaded this resource
          const resourceKey = `Patient/${patientId}`;
          if (lastLoadedResourceRef.current !== resourceKey) {
            loadRelationships('Patient', patientId);
          }
        }
      } finally {
        requestsInFlightRef.current.delete('init');
      }
    };
    
    // Small delay to let component settle
    const timer = setTimeout(init, 100);
    
    return () => {
      isSubscribed = false;
      clearTimeout(timer);
      requestsInFlightRef.current.delete('init');
    };
  }, []); // Empty dependency array - only run once on mount

  // Fetch relationship schema
  const fetchRelationshipSchema = async () => {
    // Check if already fetching
    if (requestsInFlightRef.current.has('schema')) {
      return;
    }
    
    requestsInFlightRef.current.add('schema');
    
    try {
      const schema = await fhirRelationshipService.getRelationshipSchema();
      // Initialize visible node types with common ones
      if (isMountedRef.current) {
        setVisibleNodeTypes(new Set([
          'Patient', 'Observation', 'Condition', 'MedicationRequest', 
          'Encounter', 'Practitioner', 'Organization'
        ]));
      }
    } catch (err) {
      // Error fetching relationship schema - silently handled
    } finally {
      requestsInFlightRef.current.delete('schema');
    }
  };

  // Fetch statistics
  const fetchStatistics = async () => {
    // Check if already fetching
    if (requestsInFlightRef.current.has('statistics')) {
      return;
    }
    
    requestsInFlightRef.current.add('statistics');
    
    try {
      if (isMountedRef.current) {
        setLoadingStates(prev => ({ ...prev, statistics: true }));
      }
      const stats = await retryWithBackoff(async () => {
        return await fhirRelationshipService.getRelationshipStatistics();
      });
      if (isMountedRef.current) {
        setStatistics(stats);
      }
    } catch (err) {
      // Error fetching statistics - non-critical, don't show error
    } finally {
      requestsInFlightRef.current.delete('statistics');
      if (isMountedRef.current) {
        setLoadingStates(prev => ({ ...prev, statistics: false }));
      }
    }
  };

  // Memoize filtered data to avoid recalculation on every render
  const filteredData = useMemo(() => {
    if (!relationshipData || Object.keys(activeFilters).length === 0) {
      return relationshipData;
    }

    let filteredNodes = [...relationshipData.nodes];
    let filteredLinks = [...relationshipData.links];

    // Filter by resource types
    if (activeFilters.resourceTypes?.size > 0) {
      filteredNodes = filteredNodes.filter(node => 
        activeFilters.resourceTypes.has(node.resourceType)
      );
      const nodeIds = new Set(filteredNodes.map(n => n.id));
      filteredLinks = filteredLinks.filter(link => 
        nodeIds.has(link.source.id || link.source) && 
        nodeIds.has(link.target.id || link.target)
      );
    }

    // Filter by relationship types
    if (activeFilters.relationshipTypes?.size > 0) {
      filteredLinks = filteredLinks.filter(link => 
        activeFilters.relationshipTypes.has(link.field)
      );
      // Remove orphaned nodes
      if (!activeFilters.showOrphans) {
        const connectedNodeIds = new Set();
        filteredLinks.forEach(link => {
          connectedNodeIds.add(link.source.id || link.source);
          connectedNodeIds.add(link.target.id || link.target);
        });
        filteredNodes = filteredNodes.filter(node => connectedNodeIds.has(node.id));
      }
    }

    // Apply date range filter if available
    if (activeFilters.dateRange?.start || activeFilters.dateRange?.end) {
      // This would require resource data to have dates
      // For now, we'll skip this implementation
    }

    return {
      nodes: filteredNodes,
      links: filteredLinks
    };
  }, [relationshipData, activeFilters]);

  // Pre-calculate node connection counts for performance
  const nodeConnectionCounts = useMemo(() => {
    if (!relationshipData) return new Map();
    
    const counts = new Map();
    relationshipData.nodes.forEach(node => {
      counts.set(node.id, 0);
    });
    
    relationshipData.links.forEach(link => {
      const sourceId = link.source.id || link.source;
      const targetId = link.target.id || link.target;
      counts.set(sourceId, (counts.get(sourceId) || 0) + 1);
      counts.set(targetId, (counts.get(targetId) || 0) + 1);
    });
    
    return counts;
  }, [relationshipData]);

  // Get node radius based on connections - optimized with pre-calculated counts
  const getNodeRadius = useCallback((node) => {
    if (!relationshipData) return layoutSettings.nodeSize;
    
    const connections = nodeConnectionCounts.get(node.id) || 0;
    
    const scale = d3.scaleLinear()
      .domain([0, 10])
      .range([layoutSettings.nodeSize * 0.8, layoutSettings.nodeSize * 1.5])
      .clamp(true);
    
    return scale(connections);
  }, [nodeConnectionCounts, layoutSettings.nodeSize, relationshipData]);

  // Use ref to store the latest initialization function
  const initializeVisualizationRef = useRef(null);
  
  // Retry mechanism for API calls
  const retryWithBackoff = async (fn, retries = 3, delay = 1000) => {
    try {
      return await fn();
    } catch (error) {
      if (retries === 0) throw error;
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryWithBackoff(fn, retries - 1, delay * 2);
    }
  };

  // Load relationships for a resource
  const loadRelationships = useCallback(async (resourceType, resourceId, depth = 2) => {
    if (!resourceType || !resourceId) {
      setError('Invalid resource type or ID');
      return;
    }

    // Check if we're already loading this exact resource
    const resourceKey = `${resourceType}/${resourceId}`;
    
    // Skip if we're already loading this resource or it's the same as last loaded
    if (requestsInFlightRef.current.has(resourceKey)) {
      return;
    }
    
    // If it's the same resource we just loaded, don't reload
    if (lastLoadedResourceRef.current === resourceKey && relationshipData) {
      return;
    }

    // Cancel any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    
    requestsInFlightRef.current.add(resourceKey);
    setLoadingStates(prev => ({ ...prev, relationships: true }));
    setError(null);

    try {
      // Fetch relationships from API with retry
      const data = await retryWithBackoff(async () => {
        // Check if request was aborted
        if (signal.aborted) {
          throw new Error('Request aborted');
        }
        
        return await fhirRelationshipService.discoverRelationships(
          resourceType, 
          resourceId, 
          { depth, includeCounts: true }
        );
      });

      // Check if request was aborted before processing
      if (signal.aborted) {
        return;
      }

      if (!data || !data.nodes) {
        throw new Error('Invalid response format from API');
      }

      // Transform to D3 format
      const d3Data = fhirRelationshipService.transformToD3Format(data);
      
      // Validate D3 data
      if (!d3Data.nodes || d3Data.nodes.length === 0) {
        if (isMountedRef.current && !signal.aborted) {
          setError('No relationships found for this resource');
        }
        return;
      }
      
      // Only update state if component is still mounted and request wasn't aborted
      if (isMountedRef.current && !signal.aborted) {
        setRelationshipData(d3Data);
        setCurrentResource({ resourceType, resourceId, display: data.source.display });
        setSelectedResourceType(resourceType);
        lastLoadedResourceRef.current = resourceKey;
        
        // Update visible node types
        const nodeTypes = new Set(d3Data.nodes.map(n => n.resourceType));
        setVisibleNodeTypes(nodeTypes);
        
        // Only initialize visualization if it hasn't been initialized yet
        // or if the data structure significantly changed
        if (!isVisualizationInitializedRef.current || !svgRef.current.querySelector('.main-group')) {
          setTimeout(() => {
            if (svgRef.current && initializeVisualizationRef.current && !signal.aborted) {
              const dataToVisualize = filteredData || d3Data;
              initializeVisualizationRef.current(dataToVisualize);
            }
          }, 100);
        } else {
          // Just update the existing visualization data without re-initializing
          if (simulationRef.current && !signal.aborted) {
            const dataToVisualize = filteredData || d3Data;
            // Update simulation data
            simulationRef.current.nodes(dataToVisualize.nodes);
            simulationRef.current.force('link').links(dataToVisualize.links);
            simulationRef.current.alpha(0.3).restart();
          }
        }
      }
    } catch (err) {
      // Don't show error if request was aborted
      if (err.message === 'Request aborted' || signal.aborted) {
        return;
      }
      
      if (isMountedRef.current) {
        const errorMessage = err.response?.data?.detail || err.message || 'Failed to load relationships';
        setError(errorMessage);
        
        if (err.response?.status === 404) {
          setError('Resource not found. Please check the resource ID.');
        } else if (err.response?.status === 403) {
          setError('Access denied. Please check your permissions.');
        } else if (err.response?.status >= 500) {
          setError('Server error. Please try again later.');
        }
      }
    } finally {
      requestsInFlightRef.current.delete(resourceKey);
      if (isMountedRef.current && !signal.aborted) {
        setLoadingStates(prev => ({ ...prev, relationships: false }));
      }
    }
  }, [filteredData]);

  // Apply layout to nodes
  const applyLayout = (layout, data, simulation) => {
    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;
    const centerX = width / 2;
    const centerY = height / 2;
    
    switch (layout) {
      case LAYOUTS.RADIAL:
        // Radial layout
        const radius = Math.min(width, height) / 3;
        const angleStep = (2 * Math.PI) / data.nodes.length;
        data.nodes.forEach((node, i) => {
          const angle = i * angleStep;
          node.fx = centerX + radius * Math.cos(angle);
          node.fy = centerY + radius * Math.sin(angle);
        });
        break;
        
      case LAYOUTS.HIERARCHICAL:
        // Tree layout
        const tree = d3.tree()
          .size([width - 100, height - 100]);
        
        // Create hierarchy - use first node as root if no clear hierarchy
        const rootNode = data.nodes[0];
        const hierarchyData = {
          id: rootNode.id,
          children: data.nodes.slice(1).map(n => ({ id: n.id }))
        };
        
        const root = d3.hierarchy(hierarchyData);
        tree(root);
        
        // Apply positions
        const allNodes = [root, ...root.descendants()];
        allNodes.forEach(d => {
          const node = data.nodes.find(n => n.id === d.data.id);
          if (node) {
            node.fx = d.x + 50;
            node.fy = d.y + 50;
          }
        });
        break;
        
      case LAYOUTS.CIRCULAR:
        // Circular layout
        const circleRadius = Math.min(width, height) / 2.5;
        const circleAngleStep = (2 * Math.PI) / data.nodes.length;
        data.nodes.forEach((node, i) => {
          const angle = i * circleAngleStep;
          node.fx = centerX + circleRadius * Math.cos(angle);
          node.fy = centerY + circleRadius * Math.sin(angle);
        });
        break;
        
      case LAYOUTS.FORCE:
      default:
        // Force layout - release fixed positions
        data.nodes.forEach(node => {
          node.fx = null;
          node.fy = null;
        });
        break;
    }
    
    // Restart simulation
    simulation.alpha(1).restart();
  };

  // Initialize D3 visualization
  const initializeVisualization = useCallback((data) => {
    // initializeVisualization called with svgRef and data
    if (!svgRef.current || !data) {
      // Cannot initialize visualization - missing svgRef or data
      return;
    }

    // Ensure the SVG has dimensions - wait a frame if needed
    const checkAndInitialize = () => {
      const svg = d3.select(svgRef.current);
      // Use the container dimensions if available
      const container = containerRef.current;
      const width = container ? container.clientWidth : svgRef.current.clientWidth;
      const height = container ? container.clientHeight : svgRef.current.clientHeight;
      
      if (width === 0 || height === 0 || width < 100 || height < 100) {
        requestAnimationFrame(checkAndInitialize);
        return;
      }

    // Clear previous visualization
    svg.selectAll('*').remove();
    
    // Mark as initialized
    isVisualizationInitializedRef.current = true;
    
    // Set the SVG viewBox to ensure all content is visible
    svg.attr('viewBox', `0 0 ${width} ${height}`)
       .attr('preserveAspectRatio', 'xMidYMid meet');

    // Add CSS styles for path highlighting
    const defs = svg.append('defs');
    defs.append('style').text(`
      .node { cursor: pointer; }
      .node:hover { stroke-width: 3px; }
      .link { fill: none; stroke: #999; stroke-opacity: 0.6; }
      .link:hover { stroke-opacity: 1; }
      .label { pointer-events: none; user-select: none; }
      
      /* Path highlighting styles */
      .path-node { stroke: #ff9800 !important; stroke-width: 4px !important; }
      .path-endpoint { stroke: #2196f3 !important; stroke-width: 5px !important; }
      .path-link { stroke: #ff9800 !important; stroke-width: 3px !important; stroke-opacity: 1 !important; }
    `);

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

    // Add padding to ensure nodes aren't cut off at edges
    const padding = 50;
    
    // Validate data and filter out invalid links
    const nodeIds = new Set(data.nodes.map(n => n.id));
    const validLinks = data.links.filter(link => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      
      if (!nodeIds.has(sourceId)) {
        console.warn(`Link references non-existent source node: ${sourceId}`);
        return false;
      }
      if (!nodeIds.has(targetId)) {
        console.warn(`Link references non-existent target node: ${targetId}`);
        return false;
      }
      return true;
    });
    
    if (validLinks.length < data.links.length) {
      console.warn(`Filtered out ${data.links.length - validLinks.length} invalid links`);
    }
    
    // Initialize force simulation with validated links
    const simulation = d3.forceSimulation(data.nodes)
      .force('link', d3.forceLink(validLinks)
        .id(d => d.id)
        .distance(layoutSettings.linkDistance)
      )
      .force('charge', d3.forceManyBody()
        .strength(layoutSettings.chargeStrength)
      )
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide()
        .radius(d => getNodeRadius(d) + 5)
      )
      .force('boundary', () => {
        // Keep nodes within bounds
        data.nodes.forEach(node => {
          node.x = Math.max(padding, Math.min(width - padding, node.x));
          node.y = Math.max(padding, Math.min(height - padding, node.y));
        });
      });

    simulationRef.current = simulation;

    // Create links with validated data
    const links = linksGroup.selectAll('path')
      .data(validLinks)
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
      .attr('data-node-id', d => d.id)
      .attr('r', d => getNodeRadius(d))
      .attr('fill', d => {
        // Special colors for path finding mode
        if (pathFindingMode) {
          if (pathSource && d.id === pathSource.id) return '#4caf50'; // Green for source
          if (pathTarget && d.id === pathTarget.id) return '#f44336'; // Red for target
        }
        return fhirRelationshipService.getResourceColor(d.resourceType);
      })
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
      .on('click', (event, node) => {
        // Prevent any default behavior and stop propagation immediately
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        
        // Always handle the click
        handleNodeClick(event, node);
      })
      .on('mouseenter', handleNodeHover)
      .on('mouseleave', () => {
        setHoveredNode(null);
        // Reset all node and link opacities
        svg.selectAll('.node').style('opacity', 1);
        svg.selectAll('.link').style('opacity', 0.6);
      });

    // Add tooltip
    nodes.append('title')
      .text(d => `${d.resourceType}: ${d.display || d.id}`);

    // Performance optimization: Only render visible nodes for large datasets
    const shouldRenderNode = (node) => {
      if (data.nodes.length < 100) return true; // Always render for small datasets
      
      // Get current view bounds
      const transform = d3.zoomTransform(svg.node());
      const bounds = {
        left: -transform.x / transform.k,
        top: -transform.y / transform.k,
        right: (width - transform.x) / transform.k,
        bottom: (height - transform.y) / transform.k
      };
      
      // Check if node is within visible bounds (with some padding)
      const padding = 50;
      return node.x >= bounds.left - padding && 
             node.x <= bounds.right + padding &&
             node.y >= bounds.top - padding && 
             node.y <= bounds.bottom + padding;
    };

    // Create throttled tick handler for better performance
    const throttledTick = throttle(() => {
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

      // Update node positions with visibility culling
      nodes
        .attr('cx', d => d.x)
        .attr('cy', d => d.y)
        .style('display', d => shouldRenderNode(d) ? 'block' : 'none');

      // Update label positions with visibility culling
      if (layoutSettings.showLabels) {
        labelsGroup.selectAll('text')
          .attr('x', d => d.x)
          .attr('y', d => d.y + getNodeRadius(d) + 15)
          .style('display', d => shouldRenderNode(d) ? 'block' : 'none');
      }
    }, 16); // ~60fps
    
    // Update positions on simulation tick
    simulation.on('tick', throttledTick);

    // Apply initial layout
    applyLayout(currentLayout, data, simulation);
    
    // After simulation stabilizes, fit the visualization to view
    simulation.on('end', () => {
      // Calculate bounds of all nodes
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      data.nodes.forEach(node => {
        const r = getNodeRadius(node);
        minX = Math.min(minX, node.x - r);
        minY = Math.min(minY, node.y - r);
        maxX = Math.max(maxX, node.x + r);
        maxY = Math.max(maxY, node.y + r);
      });
      
      // Add some padding
      const viewPadding = 40;
      minX -= viewPadding;
      minY -= viewPadding;
      maxX += viewPadding;
      maxY += viewPadding;
      
      // Calculate the scale and translation to fit
      const fullWidth = maxX - minX;
      const fullHeight = maxY - minY;
      const scale = Math.min(width / fullWidth, height / fullHeight) * 0.9; // 90% to leave some margin
      
      // Apply the transform to center and scale the view
      const translateX = (width - fullWidth * scale) / 2 - minX * scale;
      const translateY = (height - fullHeight * scale) / 2 - minY * scale;
      
      svg.transition()
        .duration(750)
        .call(zoom.transform, d3.zoomIdentity
          .translate(translateX, translateY)
          .scale(scale));
    });
    };
    
    // Start the initialization check
    checkAndInitialize();
  }, [currentLayout, layoutSettings]);
  
  // Update the ref whenever initializeVisualization changes
  useEffect(() => {
    initializeVisualizationRef.current = initializeVisualization;
  }, [initializeVisualization]);

  // Update visualization when filters change without full re-initialization
  useEffect(() => {
    if (relationshipData && svgRef.current && simulationRef.current && filteredData) {
      // Update the existing simulation with new data instead of re-initializing
      const svg = d3.select(svgRef.current);
      const g = svg.select('.main-group');
      
      if (g.empty()) {
        // Only initialize if visualization doesn't exist
        if (initializeVisualizationRef.current) {
          initializeVisualizationRef.current(filteredData);
        }
      } else {
        // Update existing visualization with error handling
        try {
          if (simulationRef.current && filteredData.nodes && filteredData.nodes.length > 0) {
            simulationRef.current.stop();
            simulationRef.current.nodes(filteredData.nodes);
            if (filteredData.links && filteredData.links.length > 0) {
              const linkForce = d3.forceLink(filteredData.links).id(d => d.id).distance(100).strength(0.5);
              simulationRef.current.force("link", linkForce);
            } else {
              simulationRef.current.force("link", null);
            }
            simulationRef.current.alpha(0.3).restart();
          }
        } catch (err) {
          console.error("Error updating visualization:", err);
          if (initializeVisualizationRef.current) {
            initializeVisualizationRef.current(filteredData);
          }
        }
        
        // Update visual elements
        const nodesGroup = g.select('.nodes');
        const linksGroup = g.select('.links');
        const labelsGroup = g.select('.labels');
        
        // Update nodes
        const nodes = nodesGroup.selectAll('circle')
          .data(filteredData.nodes, d => d.id);
        
        nodes.exit().remove();
        
        const nodesEnter = nodes.enter().append('circle')
          .attr('class', 'node')
          .attr('data-node-id', d => d.id)
          .attr('r', d => getNodeRadius(d))
          .attr('fill', d => fhirRelationshipService.getResourceColor(d.resourceType))
          .attr('stroke', '#fff')
          .attr('stroke-width', 2)
          .style('cursor', 'pointer');
        
        // Update links
        const links = linksGroup.selectAll('path')
          .data(filteredData.links, d => `${d.source.id || d.source}-${d.target.id || d.target}`);
        
        links.exit().remove();
        
        links.enter().append('path')
          .attr('class', 'link')
          .attr('stroke', '#999')
          .attr('stroke-opacity', 0.6)
          .attr('stroke-width', 2)
          .attr('fill', 'none');
      }
    }
  }, [filteredData, getNodeRadius]);

  // Add resize observer to handle container size changes
  useEffect(() => {
    if (!containerRef.current) return;

    let previousWidth = 0;
    let previousHeight = 0;
    
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        
        // Only re-initialize if dimensions changed significantly (more than 50px)
        const widthChange = Math.abs(width - previousWidth);
        const heightChange = Math.abs(height - previousHeight);
        
        if ((widthChange > 50 || heightChange > 50) && 
            relationshipData && 
            initializeVisualizationRef.current && 
            width > 100 && 
            height > 100) {
          
          previousWidth = width;
          previousHeight = height;
          
          // Debounce the re-initialization
          clearTimeout(window.resizeTimeout);
          window.resizeTimeout = setTimeout(() => {
            // Only re-initialize if visualization exists
            if (svgRef.current && svgRef.current.querySelector('.main-group')) {
              const svg = d3.select(svgRef.current);
              svg.attr('viewBox', `0 0 ${width} ${height}`);
              
              // Just update the center force instead of full re-initialization
              if (simulationRef.current) {
                simulationRef.current.force('center', d3.forceCenter(width / 2, height / 2));
                simulationRef.current.alpha(0.3).restart();
              }
            }
          }, 300);
        }
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      if (window.resizeTimeout) {
        clearTimeout(window.resizeTimeout);
      }
    };
  }, [relationshipData]);

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
      .on('end', dragended)
      .clickDistance(5); // Only start drag if moved more than 5 pixels
  };

  // Handle node click
  const handleNodeClick = (event, node) => {
    // Prevent default behavior and stop propagation to avoid page refresh
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    if (pathFindingMode) {
      // Path finding mode
      if (!pathSource) {
        setPathSource(node);
      } else if (!pathTarget && node.id !== pathSource.id) {
        setPathTarget(node);
        // Automatically find paths when both are selected
        findPaths(pathSource, node);
      } else {
        // Reset selection
        setPathSource(node);
        setPathTarget(null);
        setDiscoveredPaths(null);
        setSelectedPath(null);
      }
    } else if (multiSelectMode || event.ctrlKey || event.metaKey) {
      // Multi-select mode
      const newSelectedNodes = new Set(selectedNodes);
      if (newSelectedNodes.has(node.id)) {
        newSelectedNodes.delete(node.id);
        if (selectedNode?.id === node.id) {
          // If unselecting the primary selected node, pick another one
          const remaining = Array.from(newSelectedNodes);
          setSelectedNode(remaining.length > 0 ? relationshipData.nodes.find(n => n.id === remaining[0]) : null);
        }
      } else {
        newSelectedNodes.add(node.id);
        if (!selectedNode) {
          setSelectedNode(node);
        }
      }
      setSelectedNodes(newSelectedNodes);
      
      // Update node styling
      updateNodeSelection(newSelectedNodes);
    } else {
      // Single select mode
      setSelectedNode(node);
      setSelectedNodes(new Set([node.id]));
      updateNodeSelection(new Set([node.id]));
      setShowDetailsModal(true); // Show modal instead of panel
      
      if (onResourceSelect) {
        // Extract the ID from the node.id which is in format "ResourceType/id"
        const [resourceType, resourceId] = node.id.split('/');
        onResourceSelect(resourceType, resourceId);
      }
    }
  };

  // Update node selection styling
  const updateNodeSelection = (selectedSet) => {
    if (!svgRef.current) return;
    
    const svg = d3.select(svgRef.current);
    svg.selectAll('.node')
      .style('stroke', d => selectedSet.has(d.id) ? '#000' : '#fff')
      .style('stroke-width', d => selectedSet.has(d.id) ? 3 : 2);
  };

  // Find paths between two nodes
  const findPaths = async (source, target) => {
    if (!source || !target) return;
    
    try {
      setLoadingStates(prev => ({ ...prev, pathFinding: true }));
      const [sourceType, sourceId] = source.id.split('/');
      const [targetType, targetId] = target.id.split('/');
      
      const paths = await retryWithBackoff(async () => {
        return await fhirRelationshipService.findRelationshipPaths(
          sourceType, sourceId, targetType, targetId, 3
        );
      });
      
      setDiscoveredPaths(paths);
      if (paths.paths && paths.paths.length > 0) {
        // Auto-select the first (shortest) path
        setSelectedPath(0);
        highlightPath(paths.paths[0]);
      }
    } catch (error) {
      setError('Failed to find paths between resources');
    } finally {
      setLoadingStates(prev => ({ ...prev, pathFinding: false }));
    }
  };

  // Highlight a specific path
  const highlightPath = (path) => {
    if (!svgRef.current || !path) return;
    
    const svg = d3.select(svgRef.current);
    
    // Reset all highlights
    svg.selectAll('.node').classed('path-node', false).classed('path-endpoint', false);
    svg.selectAll('.link').classed('path-link', false);
    
    // Extract all nodes in the path
    const pathNodes = new Set();
    path.forEach(step => {
      pathNodes.add(step.from);
      pathNodes.add(step.to);
    });
    
    // Highlight nodes
    svg.selectAll('.node')
      .classed('path-node', d => pathNodes.has(d.id))
      .classed('path-endpoint', d => 
        d.id === path[0].from || d.id === path[path.length - 1].to
      );
    
    // Highlight links
    svg.selectAll('.link')
      .classed('path-link', d => {
        return path.some(step => 
          (d.source.id === step.from && d.target.id === step.to) ||
          (d.target.id === step.from && d.source.id === step.to)
        );
      });
  };

  // Toggle path finding mode
  const togglePathFindingMode = () => {
    setPathFindingMode(!pathFindingMode);
    setPathSource(null);
    setPathTarget(null);
    setDiscoveredPaths(null);
    setSelectedPath(null);
    setSelectedNodes(new Set());
    
    // Reset highlights
    if (svgRef.current) {
      const svg = d3.select(svgRef.current);
      svg.selectAll('.node').classed('path-node', false).classed('path-endpoint', false);
      svg.selectAll('.link').classed('path-link', false);
    }
  };

  // Handle zoom functions
  const handleZoomIn = () => {
    if (!svgRef.current || !zoomRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.transition().duration(300).call(
      zoomRef.current.scaleBy, 1.3
    );
  };

  const handleZoomOut = () => {
    if (!svgRef.current || !zoomRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.transition().duration(300).call(
      zoomRef.current.scaleBy, 0.7
    );
  };

  const handleZoomReset = () => {
    if (!svgRef.current || !zoomRef.current) return;
    const svg = d3.select(svgRef.current);
    const bounds = svgRef.current.getBBox();
    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;
    const dx = bounds.width;
    const dy = bounds.height;
    const x = bounds.x;
    const y = bounds.y;
    const scale = 0.9 / Math.max(dx / width, dy / height);
    const translate = [width / 2 - scale * (x + dx / 2), height / 2 - scale * (y + dy / 2)];
    
    svg.transition().duration(750).call(
      zoomRef.current.transform,
      d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
    );
  };

  // Export as image
  const exportAsImage = async () => {
    if (!svgRef.current) return;
    
    try {
      setLoadingStates(prev => ({ ...prev, export: true }));
      
      const svg = svgRef.current;
      const svgData = new XMLSerializer().serializeToString(svg);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      canvas.width = svg.clientWidth;
      canvas.height = svg.clientHeight;
    
      img.onload = () => {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        
        canvas.toBlob((blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `relationship-map-${new Date().toISOString()}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          setLoadingStates(prev => ({ ...prev, export: false }));
        });
      };
      
      img.onerror = () => {
        setLoadingStates(prev => ({ ...prev, export: false }));
        setError('Failed to export visualization');
      };
      
      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    } catch (error) {
      setLoadingStates(prev => ({ ...prev, export: false }));
      setError('Failed to export visualization');
    }
  };

  // Handle search
  const handleSearch = useCallback(() => {
    if (!debouncedSearchQuery || !relationshipData) return;
    
    try {
      setLoadingStates(prev => ({ ...prev, search: true }));
      
      const query = debouncedSearchQuery.toLowerCase();
      const matchingNodes = relationshipData.nodes.filter(node => 
        node.id.toLowerCase().includes(query) ||
        node.display?.toLowerCase().includes(query) ||
        node.resourceType.toLowerCase().includes(query)
      );
      
      if (matchingNodes.length > 0) {
        // Select first matching node
        const firstMatch = matchingNodes[0];
        setSelectedNode(firstMatch);
        setSelectedNodes(new Set([firstMatch.id]));
        updateNodeSelection(new Set([firstMatch.id]));
        
        // Focus on the node
        if (svgRef.current && zoomRef.current) {
          const svg = d3.select(svgRef.current);
          const node = svg.select(`[data-node-id="${firstMatch.id}"]`);
          if (!node.empty()) {
            const transform = d3.zoomTransform(svg.node());
            const x = firstMatch.x * transform.k + transform.x;
            const y = firstMatch.y * transform.k + transform.y;
            const targetX = svgRef.current.clientWidth / 2 - x;
            const targetY = svgRef.current.clientHeight / 2 - y;
            
            svg.transition().duration(750).call(
              zoomRef.current.transform,
              d3.zoomIdentity.translate(targetX, targetY).scale(transform.k)
            );
          }
        }
      } else {
        // Show temporary message when no matches found
        setError(`No resources found matching "${debouncedSearchQuery}"`);
        setTimeout(() => setError(null), 3000);
      }
    } catch (error) {
      // Search error occurred
      setError('Search failed. Please try again.');
    } finally {
      setLoadingStates(prev => ({ ...prev, search: false }));
    }
  }, [debouncedSearchQuery, relationshipData]);

  // Store handleSearch in ref for use in useEffect
  useEffect(() => {
    handleSearchRef.current = handleSearch;
  }, [handleSearch]);

  // Handle node hover
  const handleNodeHover = (event, node) => {
    setHoveredNode(node);
    
    // Only highlight if we have relationship data
    if (!relationshipData || !relationshipData.links) return;
    
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
      .style('opacity', (d) => {
        return d.source.id === node.id || d.target.id === node.id ? 1 : 0.1;
      });
  };

  // Duplicate applyLayout removed - using the one defined earlier

  // Duplicate zoom controls removed - using the ones defined earlier

  // Export visualization as image - already defined earlier

  // Search for resources - already defined earlier

  // Render statistics
  const renderStatistics = useCallback(() => {
    if (loadingStates.statistics) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
          <CircularProgress />
          <Typography variant="body2" color="textSecondary" sx={{ ml: 2 }}>
            Loading statistics...
          </Typography>
        </Box>
      );
    }
    
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
  }, [loadingStates.statistics, statistics]);

  return (
    <Box sx={{ 
      height: '100%',
      minHeight: '750px', 
      display: 'flex', 
      flexDirection: 'column',
      width: '100%'
    }}>
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
                onKeyPress={(e) => e.key === 'Enter' && handleSearch && handleSearch()}
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
              <Divider orientation="vertical" flexItem />
              <Tooltip title="Multi-select mode (or hold Ctrl/Cmd)">
                <ToggleButton
                  value="multiselect"
                  selected={multiSelectMode}
                  onChange={() => setMultiSelectMode(!multiSelectMode)}
                  size="small"
                >
                  <Badge badgeContent={selectedNodes.size > 1 ? selectedNodes.size : 0} color="primary">
                    <CheckBoxIcon />
                  </Badge>
                </ToggleButton>
              </Tooltip>
              <Tooltip title="Filter Options">
                <IconButton 
                  onClick={() => setShowFilterModal(true)} 
                  size="small"
                  color={Object.keys(activeFilters).length > 0 ? "primary" : "default"}
                >
                  <Badge badgeContent={Object.keys(activeFilters).length} color="secondary">
                    <FilterIcon />
                  </Badge>
                </IconButton>
              </Tooltip>
              <Tooltip title={pathFindingMode ? "Exit Path Finding" : "Find Path Between Resources"}>
                <IconButton 
                  onClick={togglePathFindingMode}
                  size="small"
                  color={pathFindingMode ? "primary" : "default"}
                >
                  <PathIcon />
                </IconButton>
              </Tooltip>
            </Stack>
          </Grid>
        </Grid>
      </Box>

      {/* Main Content */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {/* Collapsible Sidebar */}
        <Drawer
          variant="permanent"
          sx={{
            width: sidebarCollapsed ? 60 : 320,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: sidebarCollapsed ? 60 : 320,
              position: 'relative',
              height: '100%',
              transition: theme => theme.transitions.create('width', {
                easing: theme.transitions.easing.sharp,
                duration: theme.transitions.duration.enteringScreen,
              }),
              overflowX: 'hidden',
            },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1, borderBottom: 1, borderColor: 'divider' }}>
            {!sidebarCollapsed && (
              <Typography variant="subtitle2" sx={{ ml: 1 }}>
                Explorer
              </Typography>
            )}
            <IconButton onClick={() => setSidebarCollapsed(!sidebarCollapsed)} size="small">
              {sidebarCollapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
            </IconButton>
          </Box>
          
          {!sidebarCollapsed && (
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            <Tabs value={currentTab} onChange={(e, v) => setCurrentTab(v)} variant="fullWidth">
              <Tab label="Explorer" />
              <Tab label="Statistics" />
            </Tabs>

            {currentTab === 0 && (
              <Box sx={{ p: 2, flex: 1, overflow: 'auto' }}>
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
                  value={selectedResourceType}
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
                      setSelectedResourceType(resourceType);
                      const resource = resources[resourceType][0];
                      // Extract just the ID part if it's prefixed
                      const resourceId = resource.id.includes('/') ? 
                        resource.id.split('/').pop() : 
                        resource.id;
                      
                      // Only load if it's different from current
                      const newResourceKey = `${resourceType}/${resourceId}`;
                      if (lastLoadedResourceRef.current !== newResourceKey) {
                        loadRelationships(resourceType, resourceId);
                      }
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
                          onClick={() => {
                            const nodeId = selectedNode.id.split('/')[1] || selectedNode.id;
                            // Only reload if it's different from current resource
                            const newResourceKey = `${selectedNode.resourceType}/${nodeId}`;
                            if (lastLoadedResourceRef.current !== newResourceKey) {
                              loadRelationships(selectedNode.resourceType, nodeId);
                            }
                          }}
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
              <Box sx={{ p: 2, flex: 1, overflow: 'auto' }}>
                {renderStatistics()}
              </Box>
            )}
          </Box>
          )}
        </Drawer>

        {/* Visualization Panel */}
        <Box sx={{ 
          flex: 1, 
          position: 'relative',
          height: '100%', 
          minHeight: '600px',
          display: 'flex',
          flexDirection: 'column',
          transition: 'all 0.3s ease'
        }}>
            {(loadingStates.relationships || loadingStates.pathFinding || loadingStates.search || loadingStates.export) && (
              <Box sx={{ 
                position: 'absolute', 
                top: 0, 
                left: 0, 
                right: 0, 
                bottom: 0, 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'center', 
                justifyContent: 'center',
                bgcolor: 'rgba(255,255,255,0.9)',
                zIndex: 10
              }}>
                <CircularProgress size={48} sx={{ mb: 2 }} />
                <Typography variant="body1" color="textSecondary">
                  {loadingStates.relationships && 'Loading relationships...'}
                  {loadingStates.pathFinding && 'Finding paths between resources...'}
                  {loadingStates.search && 'Searching resources...'}
                  {loadingStates.export && 'Exporting visualization...'}
                </Typography>
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
                flex: 1,
                width: '100%', 
                height: '100%',
                minHeight: '500px',
                position: isFullscreen ? 'fixed' : 'relative',
                top: isFullscreen ? 0 : 'auto',
                left: isFullscreen ? 0 : 'auto',
                right: isFullscreen ? 0 : 'auto',
                bottom: isFullscreen ? 0 : 'auto',
                zIndex: isFullscreen ? 1300 : 'auto',
                bgcolor: 'background.paper',
                display: 'flex'
              }}
            >
              <svg
                ref={svgRef}
                width="100%"
                height="100%"
                style={{ 
                  cursor: 'grab',
                  overflow: 'visible',
                  display: 'block'
                }}
                onClick={(e) => {
                  // Prevent any default click behavior on the SVG itself
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onMouseDown={(e) => {
                  // Prevent text selection and other default behaviors
                  if (e.button === 0) { // Left click only
                    e.preventDefault();
                  }
                }}
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
        </Box>

        {/* Resource Details Modal */}
        <Modal
          open={showDetailsModal && selectedNode !== null}
          onClose={() => setShowDetailsModal(false)}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          keepMounted={false} // Unmount when closed to prevent memory leaks
          disableEnforceFocus // Prevent focus trap issues
          disableAutoFocus // Prevent auto focus issues
        >
          <Box sx={{ 
            width: '90%',
            maxWidth: 800,
            maxHeight: '90vh',
            bgcolor: 'background.paper',
            borderRadius: 2,
            boxShadow: 24,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {selectedNode && (
              <ResourceDetailsPanel
                key={`${selectedNode.id}-${Date.now()}`} // Force new instance when node changes with timestamp
                selectedNode={selectedNode}
                onClose={() => setShowDetailsModal(false)}
                onResourceSelect={(resourceType, resourceId) => {
                  // Only load if it's different from current
                  const newResourceKey = `${resourceType}/${resourceId}`;
                  if (lastLoadedResourceRef.current !== newResourceKey) {
                    loadRelationships(resourceType, resourceId);
                  }
                  setShowDetailsModal(false);
                }}
                onAddToComparison={(node) => {
                  setComparisonNodes(prev => [...prev, node]);
                }}
                onFindPath={(source, target) => {
                  setPathFindingMode(true);
                  setPathSource(source);
                  setPathTarget(target);
                  findPaths(source, target);
                  setShowDetailsModal(false);
                }}
                width="100%"
              />
            )}
          </Box>
        </Modal>

        {/* Path Finding Panel - Keep as side panel */}
        {pathFindingMode && (
          <Paper sx={{ 
            position: 'absolute',
            right: 16,
            top: 16,
            width: 320,
            maxHeight: 'calc(100% - 32px)',
            p: 2,
            overflow: 'auto',
            zIndex: 10
          }}>
            <Typography variant="h6" gutterBottom>
              Path Finding Mode
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  
                  <Stack spacing={2}>
                    <Alert severity="info">
                      Click on two resources to find paths between them
                    </Alert>
                    
                    <Box>
                      <Typography variant="subtitle2" gutterBottom>
                        Source Resource:
                      </Typography>
                      {pathSource ? (
                        <Chip 
                          icon={<SourceIcon />}
                          label={`${pathSource.resourceType}: ${pathSource.display || pathSource.id}`}
                          color="primary"
                          onDelete={() => {
                            setPathSource(null);
                            setPathTarget(null);
                            setDiscoveredPaths(null);
                          }}
                        />
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          Click a resource to select as source
                        </Typography>
                      )}
                    </Box>
                    
                    <Box>
                      <Typography variant="subtitle2" gutterBottom>
                        Target Resource:
                      </Typography>
                      {pathTarget ? (
                        <Chip 
                          icon={<TargetIcon />}
                          label={`${pathTarget.resourceType}: ${pathTarget.display || pathTarget.id}`}
                          color="secondary"
                          onDelete={() => {
                            setPathTarget(null);
                            setDiscoveredPaths(null);
                          }}
                        />
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          {pathSource ? 'Click another resource to select as target' : 'Select source first'}
                        </Typography>
                      )}
                    </Box>
                    
                    {pathSource && pathTarget && (
                      <Button 
                        variant="contained" 
                        startIcon={<RouteIcon />}
                        onClick={() => findPaths(pathSource, pathTarget)}
                        fullWidth
                      >
                        Find Paths
                      </Button>
                    )}
                    
                    <Button 
                      variant="outlined" 
                      onClick={togglePathFindingMode}
                      fullWidth
                    >
                      Exit Path Finding Mode
                    </Button>
                  </Stack>
          </Paper>
        )}
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

      {/* Path Finding Dialog */}
      <Dialog 
        open={discoveredPaths !== null} 
        onClose={() => {
          setDiscoveredPaths(null);
          setSelectedPath(null);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Typography variant="h6">Relationship Paths</Typography>
            <IconButton onClick={() => {
              setDiscoveredPaths(null);
              setSelectedPath(null);
            }}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {discoveredPaths && (
            <Box>
              <Alert severity="info" sx={{ mb: 2 }}>
                Found {discoveredPaths.pathCount} path{discoveredPaths.pathCount !== 1 ? 's' : ''} between:
                <Box sx={{ mt: 1 }}>
                  <Chip 
                    icon={<SourceIcon />} 
                    label={`${discoveredPaths.source.resourceType}: ${discoveredPaths.source.display}`}
                    color="primary"
                    sx={{ mr: 1 }}
                  />
                  <RouteIcon sx={{ mx: 1, verticalAlign: 'middle' }} />
                  <Chip 
                    icon={<TargetIcon />} 
                    label={`${discoveredPaths.target.resourceType}: ${discoveredPaths.target.display}`}
                    color="secondary"
                  />
                </Box>
              </Alert>
              
              {discoveredPaths.paths.length > 0 ? (
                <List>
                  {discoveredPaths.paths.map((path, index) => (
                    <ListItem 
                      key={index}
                      button
                      selected={selectedPath === index}
                      onClick={() => {
                        setSelectedPath(index);
                        highlightPath(path);
                      }}
                    >
                      <ListItemIcon>
                        <Badge badgeContent={path.length} color="primary">
                          <RouteIcon />
                        </Badge>
                      </ListItemIcon>
                      <ListItemText
                        primary={`Path ${index + 1} (${path.length} step${path.length !== 1 ? 's' : ''})`}
                        secondary={
                          <Stepper orientation="horizontal" sx={{ mt: 1 }}>
                            {path.map((step, stepIndex) => (
                              <Step key={stepIndex} completed>
                                <StepLabel>
                                  {stepIndex === 0 && step.from.split('/')[0]}
                                  {stepIndex > 0 && step.to.split('/')[0]}
                                </StepLabel>
                              </Step>
                            ))}
                          </Stepper>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Alert severity="warning">
                  No paths found between these resources within the search depth.
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setDiscoveredPaths(null);
            setSelectedPath(null);
          }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Filter Modal */}
      <Modal
        open={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <Box sx={{ 
          width: '90%',
          maxWidth: 600,
          maxHeight: '90vh',
          bgcolor: 'background.paper',
          borderRadius: 2,
          boxShadow: 24,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <RelationshipFilterPanel
            visibleNodeTypes={visibleNodeTypes}
            onVisibleNodeTypesChange={setVisibleNodeTypes}
            activeFilters={activeFilters}
            onFiltersChange={setActiveFilters}
            relationshipData={relationshipData}
            onClose={() => setShowFilterModal(false)}
          />
        </Box>
      </Modal>
    </Box>
  );
}

export default memo(RelationshipMapper);
