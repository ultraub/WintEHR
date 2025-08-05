/**
 * Network Diagram Component for FHIR Explorer v4
 * 
 * Interactive network visualization for clinical relationships
 * Shows patient-provider networks, care teams, and resource connections
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Button,
  Chip,
  Alert,
  CircularProgress,
  Switch,
  FormControlLabel,
  IconButton,
  Autocomplete,
  TextField,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon
} from '@mui/material';
import {
  AccountTree as NetworkIcon,
  People as PeopleIcon,
  PersonPin as ProviderIcon,
  LocalHospital as HospitalIcon,
  Refresh as RefreshIcon,
  CenterFocusStrong as CenterIcon,
  Hub as HubIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  Fullscreen as FullscreenIcon
} from '@mui/icons-material';
import * as d3 from 'd3';
import NetworkControls from './components/NetworkControls';
import {
  initializeForceSimulation,
  createZoomBehavior,
  calculateClusters,
  calculateNetworkMetrics,
  exportNetworkAsImage,
  applyClusteringForce
} from './utils/forceNetwork';
import { fhirRelationshipService } from '../../../services/fhirRelationshipService';

// Network visualization constants
const NODE_TYPES = {
  PATIENT: 'patient',
  PROVIDER: 'provider',
  ORGANIZATION: 'organization',
  ENCOUNTER: 'encounter',
  CONDITION: 'condition',
  MEDICATION: 'medication',
  OBSERVATION: 'observation'
};

const NODE_COLORS = {
  [NODE_TYPES.PATIENT]: '#1976d2',
  [NODE_TYPES.PROVIDER]: '#2e7d32',
  [NODE_TYPES.ORGANIZATION]: '#ed6c02',
  [NODE_TYPES.ENCOUNTER]: '#9c27b0',
  [NODE_TYPES.CONDITION]: '#d32f2f',
  [NODE_TYPES.MEDICATION]: '#673ab7',
  [NODE_TYPES.OBSERVATION]: '#0288d1'
};

const NODE_SIZES = {
  [NODE_TYPES.PATIENT]: 12,
  [NODE_TYPES.PROVIDER]: 10,
  [NODE_TYPES.ORGANIZATION]: 8,
  [NODE_TYPES.ENCOUNTER]: 6,
  [NODE_TYPES.CONDITION]: 8,
  [NODE_TYPES.MEDICATION]: 8,
  [NODE_TYPES.OBSERVATION]: 6
};

function NetworkDiagram({ onNavigate, fhirData }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [networkData, setNetworkData] = useState({ nodes: [], links: [] });
  const [visibleNodeTypes, setVisibleNodeTypes] = useState(new Set(Object.values(NODE_TYPES)));
  const [selectedNode, setSelectedNode] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isSimulationRunning, setIsSimulationRunning] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isClustering, setIsClustering] = useState(false);
  const [linkDistance, setLinkDistance] = useState(50);
  const [chargeStrength, setChargeStrength] = useState(-300);
  const [currentLayout, setCurrentLayout] = useState('force');
  const [networkMetrics, setNetworkMetrics] = useState(null);
  
  const svgRef = useRef(null);
  const simulationRef = useRef(null);
  const zoomRef = useRef(null);
  const containerRef = useRef(null);

  // Get available patients
  const patients = fhirData?.resources?.Patient || [];

  // Build network data from FHIR relationships API
  const buildNetworkData = useCallback(async (patientId) => {
    if (!patientId) return { nodes: [], links: [] };

    try {
      console.log('NetworkDiagram: Fetching relationships for patient:', patientId);
      
      // Use fhirRelationshipService to discover relationships
      const relationshipData = await fhirRelationshipService.discoverRelationships(
        'Patient', 
        patientId, 
        { depth: 2, includeCounts: true }
      );
      
      console.log('NetworkDiagram: Raw relationship data:', relationshipData);
      
      // Transform to D3 format
      const d3Data = fhirRelationshipService.transformToD3Format(relationshipData);
      
      console.log('NetworkDiagram: Transformed D3 data:', d3Data);
      
      // Map the transformed data to match NetworkDiagram's expected format
      const nodes = d3Data.nodes.map(node => {
        // Determine node type based on resourceType
        let nodeType = NODE_TYPES.PATIENT;
        switch (node.resourceType) {
          case 'Patient':
            nodeType = NODE_TYPES.PATIENT;
            break;
          case 'Practitioner':
          case 'PractitionerRole':
            nodeType = NODE_TYPES.PROVIDER;
            break;
          case 'Organization':
            nodeType = NODE_TYPES.ORGANIZATION;
            break;
          case 'Encounter':
            nodeType = NODE_TYPES.ENCOUNTER;
            break;
          case 'Condition':
            nodeType = NODE_TYPES.CONDITION;
            break;
          case 'MedicationRequest':
          case 'Medication':
            nodeType = NODE_TYPES.MEDICATION;
            break;
          case 'Observation':
            nodeType = NODE_TYPES.OBSERVATION;
            break;
        }
        
        return {
          id: node.id,
          type: nodeType,
          name: node.display || node.id,
          color: NODE_COLORS[nodeType] || fhirRelationshipService.getResourceColor(node.resourceType),
          size: NODE_SIZES[nodeType] || 8,
          resourceType: node.resourceType,
          depth: node.depth
        };
      });
      
      const links = d3Data.links.map(link => ({
        source: link.source,
        target: link.target,
        type: link.field,
        strength: link.value || 1
      }));
      
      return { nodes, links };
    } catch (error) {
      console.error('NetworkDiagram: Error building network data:', error);
      setError('Failed to load network relationships');
      return { nodes: [], links: [] };
    }
  }, []);

  // Original buildNetworkData function (kept for reference but not used)
  const buildNetworkDataOld = useCallback((patientId) => {
    if (!patientId || !fhirData) return { nodes: [], links: [] };

    const nodes = [];
    const links = [];
    const nodeMap = new Map();
    
    // Helper function to add node
    const addNode = (id, type, name, data = {}) => {
      if (!nodeMap.has(id)) {
        const node = {
          id,
          type,
          name,
          color: NODE_COLORS[type],
          size: NODE_SIZES[type],
          ...data
        };
        nodes.push(node);
        nodeMap.set(id, node);
      }
      return nodeMap.get(id);
    };

    // Helper function to add link
    const addLink = (sourceId, targetId, type, strength = 1) => {
      if (nodeMap.has(sourceId) && nodeMap.has(targetId)) {
        links.push({
          source: sourceId,
          target: targetId,
          type,
          strength
        });
      }
    };

    // Add selected patient as central node
    const patient = patients.find(p => p.id === patientId);
    if (patient) {
      addNode(patient.id, NODE_TYPES.PATIENT, 
        `${patient.name?.[0]?.given?.[0] || ''} ${patient.name?.[0]?.family || ''}`.trim() || 'Patient',
        { birthDate: patient.birthDate, gender: patient.gender }
      );
    }

    // Add encounters and related resources
    const encounters = fhirData.resources?.Encounter?.filter(e => 
      e.subject?.reference?.includes(patientId)
    ) || [];

    encounters.forEach(encounter => {
      // Add encounter node
      addNode(encounter.id, NODE_TYPES.ENCOUNTER, 
        `${encounter.type?.[0]?.coding?.[0]?.display || 'Encounter'}`,
        { date: encounter.period?.start, class: encounter.class?.code }
      );

      // Link patient to encounter
      addLink(patientId, encounter.id, 'has_encounter', 0.8);

      // Add practitioners
      encounter.participant?.forEach(participant => {
        if (participant.individual?.reference) {
          const practitionerId = participant.individual.reference.split('/')[1];
          const practitioner = fhirData.resources?.Practitioner?.find(p => p.id === practitionerId);
          
          if (practitioner) {
            addNode(practitionerId, NODE_TYPES.PROVIDER,
              `${practitioner.name?.[0]?.given?.[0] || ''} ${practitioner.name?.[0]?.family || ''}`.trim() || 'Provider',
              { specialty: practitioner.qualification?.[0]?.code?.coding?.[0]?.display }
            );
            addLink(encounter.id, practitionerId, 'has_participant', 0.6);
          }
        }
      });

      // Add organization
      if (encounter.serviceProvider?.reference) {
        const orgId = encounter.serviceProvider.reference.split('/')[1];
        const organization = fhirData.resources?.Organization?.find(o => o.id === orgId);
        
        if (organization) {
          addNode(orgId, NODE_TYPES.ORGANIZATION,
            organization.name || 'Organization',
            { type: organization.type?.[0]?.coding?.[0]?.display }
          );
          addLink(encounter.id, orgId, 'at_organization', 0.4);
        }
      }
    });

    // Add conditions
    const conditions = fhirData.resources?.Condition?.filter(c => 
      c.subject?.reference?.includes(patientId)
    ) || [];

    conditions.forEach(condition => {
      addNode(condition.id, NODE_TYPES.CONDITION,
        condition.code?.coding?.[0]?.display || condition.code?.text || 'Condition',
        { 
          clinicalStatus: condition.clinicalStatus?.coding?.[0]?.code,
          category: condition.category?.[0]?.coding?.[0]?.display
        }
      );

      // Link patient to condition
      addLink(patientId, condition.id, 'has_condition', 0.9);

      // Link condition to encounter if available
      if (condition.encounter?.reference) {
        const encounterId = condition.encounter.reference.split('/')[1];
        if (nodeMap.has(encounterId)) {
          addLink(encounterId, condition.id, 'documented_in', 0.5);
        }
      }
    });

    // Add medications
    const medications = fhirData.resources?.MedicationRequest?.filter(m => 
      m.subject?.reference?.includes(patientId)
    ) || [];

    medications.forEach(medication => {
      addNode(medication.id, NODE_TYPES.MEDICATION,
        medication.medicationCodeableConcept?.coding?.[0]?.display || 
        medication.medicationCodeableConcept?.text || 'Medication',
        { 
          status: medication.status,
          intent: medication.intent
        }
      );

      // Link patient to medication
      addLink(patientId, medication.id, 'prescribed', 0.7);

      // Link medication to encounter if available
      if (medication.encounter?.reference) {
        const encounterId = medication.encounter.reference.split('/')[1];
        if (nodeMap.has(encounterId)) {
          addLink(encounterId, medication.id, 'prescribed_in', 0.5);
        }
      }
    });

    // Add observations (limited to avoid overcrowding)
    const observations = fhirData.resources?.Observation?.filter(o => 
      o.subject?.reference?.includes(patientId)
    ).slice(0, 20) || []; // Limit to 20 most recent observations

    observations.forEach(observation => {
      addNode(observation.id, NODE_TYPES.OBSERVATION,
        observation.code?.coding?.[0]?.display || observation.code?.text || 'Observation',
        { 
          status: observation.status,
          category: observation.category?.[0]?.coding?.[0]?.display,
          value: observation.valueQuantity?.value
        }
      );

      // Link patient to observation
      addLink(patientId, observation.id, 'has_observation', 0.3);

      // Link observation to encounter if available
      if (observation.encounter?.reference) {
        const encounterId = observation.encounter.reference.split('/')[1];
        if (nodeMap.has(encounterId)) {
          addLink(encounterId, observation.id, 'observed_in', 0.3);
        }
      }
    });

    return { nodes, links };
  }, [fhirData, patients]);

  // Render network visualization
  const renderNetwork = useCallback(() => {
    if (!networkData.nodes.length || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 800;
    const height = 600;

    // Create container group
    const g = svg.append('g');

    // Filter data based on visibility
    const visibleNodes = networkData.nodes.filter(node => visibleNodeTypes.has(node.type));
    const visibleLinks = networkData.links.filter(link => 
      visibleNodes.some(n => n.id === link.source || n.id === link.source.id) &&
      visibleNodes.some(n => n.id === link.target || n.id === link.target.id)
    );

    // Add radius to nodes for collision detection
    visibleNodes.forEach(node => {
      node.radius = node.size;
    });

    // Initialize force simulation with our utility
    const simulation = initializeForceSimulation(visibleNodes, visibleLinks, { width, height });
    
    // Update force parameters based on controls
    simulation.force('link')
      .distance(linkDistance)
      .strength(d => d.strength || 0.5);
    
    simulation.force('charge')
      .strength(chargeStrength);

    // Apply clustering if enabled
    if (isClustering && currentLayout === 'cluster') {
      const { clusters, clusterCenters } = calculateClusters(visibleNodes, visibleLinks);
      applyClusteringForce(simulation, clusterCenters);
    }

    simulationRef.current = simulation;

    // Create zoom behavior with our utility
    const zoomBehavior = createZoomBehavior(svg, g, setZoomLevel);
    zoomRef.current = zoomBehavior;

    // Create links
    const link = g.append('g')
      .selectAll('line')
      .data(visibleLinks)
      .enter().append('line')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', d => Math.sqrt(d.strength || 1) * 2);

    // Create nodes
    const node = g.append('g')
      .selectAll('circle')
      .data(visibleNodes)
      .enter().append('circle')
      .attr('r', d => d.size)
      .attr('fill', d => d.color)
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended))
      .on('click', (event, d) => {
        setSelectedNode(d);
      });

    // Create labels
    const label = g.append('g')
      .selectAll('text')
      .data(visibleNodes)
      .enter().append('text')
      .text(d => d.name)
      .attr('font-size', '10px')
      .attr('text-anchor', 'middle')
      .attr('dy', d => d.size + 15)
      .style('pointer-events', 'none');

    // Update positions on simulation tick
    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      node
        .attr('cx', d => d.x)
        .attr('cy', d => d.y);

      label
        .attr('x', d => d.x)
        .attr('y', d => d.y);
    });

    // Drag functions
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

  }, [networkData, visibleNodeTypes, linkDistance, chargeStrength, isClustering, currentLayout]);

  // Load network data for selected patient
  useEffect(() => {
    const loadNetworkData = async () => {
      if (selectedPatient) {
        setLoading(true);
        try {
          const data = await buildNetworkData(selectedPatient.id);
          setNetworkData(data);
          
          // Calculate network metrics
          const metrics = calculateNetworkMetrics(data.nodes, data.links);
          setNetworkMetrics(metrics);
        } catch (error) {
          console.error('Error loading network data:', error);
          setError('Failed to load network data');
        } finally {
          setLoading(false);
        }
      }
    };
    
    loadNetworkData();
  }, [selectedPatient, buildNetworkData]);

  // Render network when data changes
  useEffect(() => {
    if (networkData.nodes.length > 0) {
      renderNetwork();
    }
  }, [networkData, renderNetwork]);

  // Toggle node type visibility
  const toggleNodeType = (nodeType) => {
    const newVisibleTypes = new Set(visibleNodeTypes);
    if (newVisibleTypes.has(nodeType)) {
      newVisibleTypes.delete(nodeType);
    } else {
      newVisibleTypes.add(nodeType);
    }
    setVisibleNodeTypes(newVisibleTypes);
  };

  // Zoom controls
  const handleZoomIn = () => {
    if (zoomRef.current) zoomRef.current.zoomIn();
  };

  const handleZoomOut = () => {
    if (zoomRef.current) zoomRef.current.zoomOut();
  };

  const handleResetZoom = () => {
    if (zoomRef.current) zoomRef.current.resetZoom();
  };

  // Toggle simulation
  const toggleSimulation = () => {
    if (simulationRef.current) {
      if (isSimulationRunning) {
        simulationRef.current.stop();
      } else {
        simulationRef.current.restart();
      }
      setIsSimulationRunning(!isSimulationRunning);
    }
  };

  // Refresh network
  const refreshNetwork = async () => {
    if (selectedPatient) {
      setLoading(true);
      try {
        const data = await buildNetworkData(selectedPatient.id);
        setNetworkData(data);
        
        // Recalculate metrics
        const metrics = calculateNetworkMetrics(data.nodes, data.links);
        setNetworkMetrics(metrics);
      } catch (error) {
        console.error('Error refreshing network:', error);
        setError('Failed to refresh network data');
      } finally {
        setLoading(false);
      }
    }
  };

  // Export network
  const exportNetwork = async () => {
    if (svgRef.current) {
      await exportNetworkAsImage(svgRef.current, 'png');
    }
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Update force parameters
  const updateSimulationForces = useCallback(() => {
    if (simulationRef.current) {
      simulationRef.current.force('link')
        .distance(linkDistance);
      simulationRef.current.force('charge')
        .strength(chargeStrength);
      simulationRef.current.alpha(0.3).restart();
    }
  }, [linkDistance, chargeStrength]);

  useEffect(() => {
    updateSimulationForces();
  }, [updateSimulationForces]);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <NetworkIcon color="primary" />
          Network Diagram
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={refreshNetwork}
            disabled={loading || !selectedPatient}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Network Visualization */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2, height: '900px' }} ref={containerRef}>
            {/* Patient Selection */}
            <Box sx={{ mb: 2 }}>
              <Autocomplete
                options={patients}
                getOptionLabel={(option) => `${option.name?.[0]?.given?.[0] || ''} ${option.name?.[0]?.family || ''}`.trim() || 'Patient'}
                value={selectedPatient}
                onChange={(_, newValue) => setSelectedPatient(newValue)}
                renderInput={(params) => (
                  <TextField {...params} label="Select Patient" fullWidth />
                )}
              />
            </Box>

            {/* Network Controls */}
            {selectedPatient && (
              <NetworkControls
                onZoomIn={handleZoomIn}
                onZoomOut={handleZoomOut}
                onResetZoom={handleResetZoom}
                onToggleSimulation={toggleSimulation}
                isSimulationRunning={isSimulationRunning}
                onRefresh={refreshNetwork}
                onExport={exportNetwork}
                onToggleFullscreen={toggleFullscreen}
                isFullscreen={isFullscreen}
                onToggleClustering={setIsClustering}
                isClustering={isClustering}
                linkDistance={linkDistance}
                onLinkDistanceChange={setLinkDistance}
                chargeStrength={chargeStrength}
                onChargeStrengthChange={setChargeStrength}
                onLayoutChange={setCurrentLayout}
                currentLayout={currentLayout}
              />
            )}

            {/* Network SVG */}
            <Box sx={{ border: '1px solid #ddd', borderRadius: 1, height: '600px', overflow: 'hidden', backgroundColor: '#f5f5f5' }}>
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                  <CircularProgress />
                </Box>
              ) : selectedPatient ? (
                <svg
                  ref={svgRef}
                  width="100%"
                  height="100%"
                  viewBox="0 0 800 600"
                  style={{ display: 'block' }}
                />
              ) : (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                  <Typography variant="body1" color="text.secondary">
                    Select a patient to view their network
                  </Typography>
                </Box>
              )}
            </Box>
          </Paper>
        </Grid>

        {/* Controls Panel */}
        <Grid item xs={12} md={4}>
          {/* Node Type Controls */}
          <Card sx={{ mb: 3 }}>
            <CardHeader title="Node Types" />
            <CardContent>
              <List dense>
                {Object.entries(NODE_TYPES).map(([key, nodeType]) => (
                  <ListItem key={nodeType} dense>
                    <ListItemIcon>
                      <Box
                        sx={{
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          backgroundColor: NODE_COLORS[nodeType],
                          mr: 1
                        }}
                      />
                    </ListItemIcon>
                    <ListItemText primary={key.toLowerCase().replace('_', ' ')} />
                    <Switch
                      checked={visibleNodeTypes.has(nodeType)}
                      onChange={() => toggleNodeType(nodeType)}
                      size="small"
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>

          {/* Selected Node Details */}
          {selectedNode && (
            <Card>
              <CardHeader title="Node Details" />
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {selectedNode.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Type: {selectedNode.type}
                </Typography>
                
                {Object.entries(selectedNode).map(([key, value]) => {
                  if (['id', 'name', 'type', 'color', 'size', 'x', 'y', 'fx', 'fy', 'vx', 'vy', 'index'].includes(key)) {
                    return null;
                  }
                  return (
                    <Typography key={key} variant="body2" sx={{ mb: 1 }}>
                      <strong>{key}:</strong> {value || 'N/A'}
                    </Typography>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Network Statistics */}
          {networkData.nodes.length > 0 && (
            <Card sx={{ mt: 3 }}>
              <CardHeader title="Network Statistics" />
              <CardContent>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  Total Nodes: {networkData.nodes.length}
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  Total Links: {networkData.links.length}
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  Visible Nodes: {networkData.nodes.filter(n => visibleNodeTypes.has(n.type)).length}
                </Typography>
                
                {networkMetrics && (
                  <>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      Network Density: {(networkMetrics.density * 100).toFixed(1)}%
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      Average Degree: {networkMetrics.avgDegree.toFixed(1)}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      Connected Components: {networkMetrics.components.length}
                    </Typography>
                  </>
                )}
                
                <Divider sx={{ my: 2 }} />
                
                <Typography variant="subtitle2" gutterBottom>
                  Node Distribution:
                </Typography>
                {Object.entries(NODE_TYPES).map(([key, nodeType]) => {
                  const count = networkData.nodes.filter(n => n.type === nodeType).length;
                  return count > 0 ? (
                    <Typography key={nodeType} variant="body2" sx={{ mb: 0.5 }}>
                      {key.toLowerCase().replace('_', ' ')}: {count}
                    </Typography>
                  ) : null;
                })}
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>
    </Box>
  );
}

export default NetworkDiagram;