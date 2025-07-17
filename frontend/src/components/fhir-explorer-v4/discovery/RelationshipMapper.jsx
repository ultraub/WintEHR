/**
 * Relationship Mapper Component for FHIR Explorer v4
 * 
 * Interactive visualization of FHIR resource relationships
 * Helps users understand complex interconnections between healthcare data
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
  Accordion,
  AccordionSummary,
  AccordionDetails,
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
  Divider
} from '@mui/material';
import {
  AccountTree as RelationshipIcon,
  Hub as HubIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  CenterFocusStrong as CenterIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  ExpandMore as ExpandMoreIcon,
  Person as PersonIcon,
  LocalHospital as HospitalIcon,
  Science as ScienceIcon,
  Medication as MedicationIcon,
  Assignment as AssignmentIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  FilterList as FilterIcon,
  Share as ShareIcon
} from '@mui/icons-material';

// FHIR Resource relationship definitions
const RESOURCE_RELATIONSHIPS = {
  Patient: {
    icon: <PersonIcon />,
    color: '#2196f3',
    connections: [
      { target: 'Observation', field: 'subject', type: 'one-to-many', label: 'observations' },
      { target: 'Condition', field: 'subject', type: 'one-to-many', label: 'conditions' },
      { target: 'MedicationRequest', field: 'subject', type: 'one-to-many', label: 'prescriptions' },
      { target: 'Encounter', field: 'subject', type: 'one-to-many', label: 'encounters' },
      { target: 'AllergyIntolerance', field: 'patient', type: 'one-to-many', label: 'allergies' },
      { target: 'CarePlan', field: 'subject', type: 'one-to-many', label: 'care plans' },
      { target: 'Practitioner', field: 'general-practitioner', type: 'many-to-one', label: 'primary care' }
    ]
  },
  Observation: {
    icon: <ScienceIcon />,
    color: '#4caf50',
    connections: [
      { target: 'Patient', field: 'subject', type: 'many-to-one', label: 'patient' },
      { target: 'Encounter', field: 'encounter', type: 'many-to-one', label: 'encounter' },
      { target: 'Practitioner', field: 'performer', type: 'many-to-one', label: 'performer' },
      { target: 'DiagnosticReport', field: 'result', type: 'many-to-one', label: 'diagnostic report' }
    ]
  },
  Condition: {
    icon: <HospitalIcon />,
    color: '#f44336',
    connections: [
      { target: 'Patient', field: 'subject', type: 'many-to-one', label: 'patient' },
      { target: 'Encounter', field: 'encounter', type: 'many-to-one', label: 'encounter' },
      { target: 'Practitioner', field: 'asserter', type: 'many-to-one', label: 'asserter' },
      { target: 'Observation', field: 'evidence-detail', type: 'one-to-many', label: 'evidence' }
    ]
  },
  MedicationRequest: {
    icon: <MedicationIcon />,
    color: '#ff9800',
    connections: [
      { target: 'Patient', field: 'subject', type: 'many-to-one', label: 'patient' },
      { target: 'Practitioner', field: 'requester', type: 'many-to-one', label: 'requester' },
      { target: 'Encounter', field: 'encounter', type: 'many-to-one', label: 'encounter' },
      { target: 'Medication', field: 'medication', type: 'many-to-one', label: 'medication' },
      { target: 'MedicationDispense', field: 'prescription', type: 'one-to-many', label: 'dispensing' }
    ]
  },
  Encounter: {
    icon: <AssignmentIcon />,
    color: '#9c27b0',
    connections: [
      { target: 'Patient', field: 'subject', type: 'many-to-one', label: 'patient' },
      { target: 'Practitioner', field: 'participant', type: 'many-to-many', label: 'participants' },
      { target: 'Organization', field: 'serviceProvider', type: 'many-to-one', label: 'provider' },
      { target: 'Observation', field: 'encounter', type: 'one-to-many', label: 'observations' },
      { target: 'Condition', field: 'encounter', type: 'one-to-many', label: 'conditions' },
      { target: 'Procedure', field: 'encounter', type: 'one-to-many', label: 'procedures' }
    ]
  }
};

// Predefined relationship patterns for common scenarios
const RELATIONSHIP_PATTERNS = [
  {
    name: 'Patient Care Journey',
    description: 'Complete patient care workflow',
    resources: ['Patient', 'Encounter', 'Observation', 'Condition', 'MedicationRequest'],
    focus: 'Patient'
  },
  {
    name: 'Diagnostic Workflow',
    description: 'From observation to diagnosis',
    resources: ['Patient', 'Observation', 'DiagnosticReport', 'Condition'],
    focus: 'Observation'
  },
  {
    name: 'Medication Management',
    description: 'Prescription to dispensing flow',
    resources: ['Patient', 'MedicationRequest', 'Medication', 'MedicationDispense', 'Practitioner'],
    focus: 'MedicationRequest'
  },
  {
    name: 'Care Team Structure',
    description: 'Healthcare provider relationships',
    resources: ['Patient', 'Practitioner', 'Organization', 'CareTeam'],
    focus: 'Practitioner'
  }
];

function RelationshipMapper({ selectedResource, onResourceSelect, useFHIRData }) {
  const [currentPattern, setCurrentPattern] = useState('');
  const [visibleResources, setVisibleResources] = useState(new Set(['Patient', 'Observation', 'Condition']));
  const [layoutSettings, setLayoutSettings] = useState({
    showLabels: true,
    showConnections: true,
    nodeSize: 50,
    linkDistance: 150
  });
  const [hoveredNode, setHoveredNode] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const canvasRef = useRef(null);
  const [relationships, setRelationships] = useState([]);

  // Generate visual network data
  const generateNetworkData = useCallback(() => {
    const nodes = [];
    const links = [];
    const processedLinks = new Set();

    // Create nodes for visible resources
    Array.from(visibleResources).forEach((resourceType, index) => {
      const resource = RESOURCE_RELATIONSHIPS[resourceType];
      if (resource) {
        nodes.push({
          id: resourceType,
          type: resourceType,
          label: resourceType,
          icon: resource.icon,
          color: resource.color,
          x: Math.cos((index * 2 * Math.PI) / visibleResources.size) * 200,
          y: Math.sin((index * 2 * Math.PI) / visibleResources.size) * 200,
          isSelected: selectedNode === resourceType,
          isHovered: hoveredNode === resourceType
        });
      }
    });

    // Create links between visible resources
    Array.from(visibleResources).forEach(sourceType => {
      const sourceResource = RESOURCE_RELATIONSHIPS[sourceType];
      if (sourceResource) {
        sourceResource.connections.forEach(connection => {
          if (visibleResources.has(connection.target)) {
            const linkId = `${sourceType}-${connection.target}`;
            const reverseLinkId = `${connection.target}-${sourceType}`;
            
            if (!processedLinks.has(linkId) && !processedLinks.has(reverseLinkId)) {
              links.push({
                id: linkId,
                source: sourceType,
                target: connection.target,
                type: connection.type,
                label: connection.label,
                field: connection.field
              });
              processedLinks.add(linkId);
            }
          }
        });
      }
    });

    return { nodes, links };
  }, [visibleResources, selectedNode, hoveredNode]);

  // Draw the network visualization
  const drawNetwork = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const { nodes, links } = generateNetworkData();
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Apply zoom and center
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(zoomLevel, zoomLevel);

    // Draw links
    if (layoutSettings.showConnections) {
      links.forEach(link => {
        const sourceNode = nodes.find(n => n.id === link.source);
        const targetNode = nodes.find(n => n.id === link.target);
        
        if (sourceNode && targetNode) {
          ctx.strokeStyle = '#999';
          ctx.lineWidth = 2;
          ctx.setLineDash(link.type === 'one-to-many' ? [5, 5] : []);
          
          ctx.beginPath();
          ctx.moveTo(sourceNode.x, sourceNode.y);
          ctx.lineTo(targetNode.x, targetNode.y);
          ctx.stroke();
          
          // Draw arrow
          const angle = Math.atan2(targetNode.y - sourceNode.y, targetNode.x - sourceNode.x);
          const arrowX = targetNode.x - Math.cos(angle) * 30;
          const arrowY = targetNode.y - Math.sin(angle) * 30;
          
          ctx.fillStyle = '#999';
          ctx.beginPath();
          ctx.moveTo(arrowX, arrowY);
          ctx.lineTo(arrowX - 10 * Math.cos(angle - 0.5), arrowY - 10 * Math.sin(angle - 0.5));
          ctx.lineTo(arrowX - 10 * Math.cos(angle + 0.5), arrowY - 10 * Math.sin(angle + 0.5));
          ctx.closePath();
          ctx.fill();
          
          // Draw label
          if (layoutSettings.showLabels) {
            ctx.fillStyle = '#666';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            const midX = (sourceNode.x + targetNode.x) / 2;
            const midY = (sourceNode.y + targetNode.y) / 2;
            ctx.fillText(link.label, midX, midY - 5);
          }
        }
      });
    }

    // Draw nodes
    nodes.forEach(node => {
      const radius = layoutSettings.nodeSize / 2;
      
      // Node circle
      ctx.fillStyle = node.isSelected ? '#1976d2' : node.isHovered ? '#42a5f5' : node.color;
      ctx.strokeStyle = node.isSelected ? '#0d47a1' : '#fff';
      ctx.lineWidth = node.isSelected ? 3 : 2;
      
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
      
      // Node label
      if (layoutSettings.showLabels) {
        ctx.fillStyle = '#333';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(node.label, node.x, node.y + radius + 20);
      }
    });

    ctx.restore();
  }, [generateNetworkData, layoutSettings, zoomLevel]);

  // Handle canvas interactions
  const handleCanvasClick = (event) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left - canvas.width / 2) / zoomLevel;
    const y = (event.clientY - rect.top - canvas.height / 2) / zoomLevel;

    const { nodes } = generateNetworkData();
    const clickedNode = nodes.find(node => {
      const distance = Math.sqrt((x - node.x) ** 2 + (y - node.y) ** 2);
      return distance <= layoutSettings.nodeSize / 2;
    });

    if (clickedNode) {
      setSelectedNode(clickedNode.id);
      if (onResourceSelect) {
        onResourceSelect(clickedNode.id);
      }
    } else {
      setSelectedNode(null);
    }
  };

  const handleCanvasMouseMove = (event) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left - canvas.width / 2) / zoomLevel;
    const y = (event.clientY - rect.top - canvas.height / 2) / zoomLevel;

    const { nodes } = generateNetworkData();
    const hoveredNode = nodes.find(node => {
      const distance = Math.sqrt((x - node.x) ** 2 + (y - node.y) ** 2);
      return distance <= layoutSettings.nodeSize / 2;
    });

    setHoveredNode(hoveredNode ? hoveredNode.id : null);
    canvas.style.cursor = hoveredNode ? 'pointer' : 'default';
  };

  // Load pattern
  const loadPattern = (pattern) => {
    setCurrentPattern(pattern.name);
    setVisibleResources(new Set(pattern.resources));
    setSelectedNode(pattern.focus);
  };

  // Toggle resource visibility
  const toggleResourceVisibility = (resourceType) => {
    setVisibleResources(prev => {
      const newSet = new Set(prev);
      if (newSet.has(resourceType)) {
        newSet.delete(resourceType);
      } else {
        newSet.add(resourceType);
      }
      return newSet;
    });
  };

  // Effect to redraw canvas
  useEffect(() => {
    drawNetwork();
  }, [drawNetwork]);

  // Get relationship details for selected node
  const getSelectedNodeDetails = () => {
    if (!selectedNode) return null;
    
    const resource = RESOURCE_RELATIONSHIPS[selectedNode];
    if (!resource) return null;

    const visibleConnections = resource.connections.filter(conn => 
      visibleResources.has(conn.target)
    );

    return {
      type: selectedNode,
      ...resource,
      visibleConnections
    };
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <RelationshipIcon color="primary" />
          Resource Relationship Mapper
        </Typography>
        <Stack direction="row" spacing={1}>
          <IconButton onClick={() => setZoomLevel(prev => Math.min(prev + 0.2, 3))}>
            <ZoomInIcon />
          </IconButton>
          <IconButton onClick={() => setZoomLevel(prev => Math.max(prev - 0.2, 0.5))}>
            <ZoomOutIcon />
          </IconButton>
          <IconButton onClick={() => setZoomLevel(1)}>
            <CenterIcon />
          </IconButton>
          <IconButton onClick={() => setShowSettings(true)}>
            <SettingsIcon />
          </IconButton>
        </Stack>
      </Box>

      <Grid container spacing={3}>
        {/* Controls Panel */}
        <Grid item xs={12} lg={3}>
          {/* Pattern Selection */}
          <Card sx={{ mb: 3 }}>
            <CardHeader title="Relationship Patterns" />
            <CardContent>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Select Pattern</InputLabel>
                <Select
                  value={currentPattern}
                  label="Select Pattern"
                  onChange={(e) => {
                    const pattern = RELATIONSHIP_PATTERNS.find(p => p.name === e.target.value);
                    if (pattern) loadPattern(pattern);
                  }}
                >
                  <MenuItem value="">Custom</MenuItem>
                  {RELATIONSHIP_PATTERNS.map(pattern => (
                    <MenuItem key={pattern.name} value={pattern.name}>
                      {pattern.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              {currentPattern && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  {RELATIONSHIP_PATTERNS.find(p => p.name === currentPattern)?.description}
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Resource Visibility */}
          <Card sx={{ mb: 3 }}>
            <CardHeader title="Visible Resources" />
            <CardContent>
              <Stack spacing={1}>
                {Object.entries(RESOURCE_RELATIONSHIPS).map(([type, resource]) => (
                  <FormControlLabel
                    key={type}
                    control={
                      <Switch
                        checked={visibleResources.has(type)}
                        onChange={() => toggleResourceVisibility(type)}
                        size="small"
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {resource.icon}
                        <Typography variant="body2">{type}</Typography>
                      </Box>
                    }
                  />
                ))}
              </Stack>
            </CardContent>
          </Card>

          {/* Selected Resource Details */}
          {getSelectedNodeDetails() && (
            <Card>
              <CardHeader title={`${getSelectedNodeDetails().type} Details`} />
              <CardContent>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  Connections to other resources:
                </Typography>
                <List dense>
                  {getSelectedNodeDetails().visibleConnections.map((conn, index) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        {RESOURCE_RELATIONSHIPS[conn.target]?.icon}
                      </ListItemIcon>
                      <ListItemText
                        primary={conn.target}
                        secondary={`${conn.type} - ${conn.label}`}
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          )}
        </Grid>

        {/* Visualization Panel */}
        <Grid item xs={12} lg={9}>
          <Card>
            <CardHeader 
              title="Resource Relationship Network"
              action={
                <Typography variant="body2" color="text.secondary">
                  Click nodes to explore • Zoom: {Math.round(zoomLevel * 100)}%
                </Typography>
              }
            />
            <CardContent>
              <Paper sx={{ position: 'relative', bgcolor: '#fafafa' }}>
                <canvas
                  ref={canvasRef}
                  width={800}
                  height={600}
                  onClick={handleCanvasClick}
                  onMouseMove={handleCanvasMouseMove}
                  style={{ 
                    width: '100%', 
                    height: '600px', 
                    border: '1px solid #ddd',
                    borderRadius: '4px'
                  }}
                />
                
                {/* Legend */}
                <Paper sx={{ position: 'absolute', top: 16, right: 16, p: 2, bgcolor: 'rgba(255,255,255,0.95)' }}>
                  <Typography variant="subtitle2" gutterBottom>Legend</Typography>
                  <Stack spacing={1}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 12, height: 2, bgcolor: '#999' }} />
                      <Typography variant="caption">One-to-one</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 12, height: 2, bgcolor: '#999', borderStyle: 'dashed', borderWidth: '1px 0' }} />
                      <Typography variant="caption">One-to-many</Typography>
                    </Box>
                  </Stack>
                </Paper>
              </Paper>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onClose={() => setShowSettings(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Visualization Settings</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={layoutSettings.showLabels}
                  onChange={(e) => setLayoutSettings(prev => ({ ...prev, showLabels: e.target.checked }))}
                />
              }
              label="Show Labels"
            />
            
            <FormControlLabel
              control={
                <Switch
                  checked={layoutSettings.showConnections}
                  onChange={(e) => setLayoutSettings(prev => ({ ...prev, showConnections: e.target.checked }))}
                />
              }
              label="Show Connections"
            />
            
            <Box>
              <Typography gutterBottom>Node Size</Typography>
              <Slider
                value={layoutSettings.nodeSize}
                onChange={(e, value) => setLayoutSettings(prev => ({ ...prev, nodeSize: value }))}
                min={30}
                max={80}
                marks
                valueLabelDisplay="auto"
              />
            </Box>
            
            <Box>
              <Typography gutterBottom>Link Distance</Typography>
              <Slider
                value={layoutSettings.linkDistance}
                onChange={(e, value) => setLayoutSettings(prev => ({ ...prev, linkDistance: value }))}
                min={100}
                max={300}
                marks
                valueLabelDisplay="auto"
              />
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSettings(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default RelationshipMapper;