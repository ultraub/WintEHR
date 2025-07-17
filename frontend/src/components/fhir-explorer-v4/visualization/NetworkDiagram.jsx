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
  Hub as HubIcon
} from '@mui/icons-material';
import * as d3 from 'd3';

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
  
  const svgRef = useRef(null);
  const simulationRef = useRef(null);

  // Get available patients
  const patients = fhirData?.resources?.Patient || [];

  // Build network data from FHIR resources
  const buildNetworkData = useCallback((patientId) => {
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

    // Create zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
        setZoomLevel(event.transform.k);
      });

    svg.call(zoom);

    const g = svg.append('g');

    // Filter data based on visibility
    const visibleNodes = networkData.nodes.filter(node => visibleNodeTypes.has(node.type));
    const visibleLinks = networkData.links.filter(link => 
      visibleNodes.some(n => n.id === link.source || n.id === link.source.id) &&
      visibleNodes.some(n => n.id === link.target || n.id === link.target.id)
    );

    // Create simulation
    const simulation = d3.forceSimulation(visibleNodes)
      .force('link', d3.forceLink(visibleLinks).id(d => d.id).distance(d => {
        // Vary link distance based on relationship type
        const distances = {
          'has_encounter': 50,
          'has_condition': 60,
          'prescribed': 70,
          'has_observation': 80,
          'has_participant': 40,
          'at_organization': 60,
          'documented_in': 30,
          'prescribed_in': 30,
          'observed_in': 30
        };
        return distances[d.type] || 50;
      }))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(d => d.size + 2));

    simulationRef.current = simulation;

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

  }, [networkData, visibleNodeTypes]);

  // Load network data for selected patient
  useEffect(() => {
    if (selectedPatient) {
      setLoading(true);
      const data = buildNetworkData(selectedPatient.id);
      setNetworkData(data);
      setLoading(false);
    }
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

  // Center and reset zoom
  const resetZoom = () => {
    const svg = d3.select(svgRef.current);
    svg.transition().duration(750).call(
      d3.zoom().transform,
      d3.zoomIdentity
    );
  };

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
            onClick={() => selectedPatient && setNetworkData(buildNetworkData(selectedPatient.id))}
            disabled={loading || !selectedPatient}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Network Visualization */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2, height: '700px' }}>
            {/* Controls */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Autocomplete
                options={patients}
                getOptionLabel={(option) => `${option.name?.[0]?.given?.[0] || ''} ${option.name?.[0]?.family || ''}`.trim() || 'Patient'}
                value={selectedPatient}
                onChange={(_, newValue) => setSelectedPatient(newValue)}
                renderInput={(params) => (
                  <TextField {...params} label="Select Patient" sx={{ minWidth: 300 }} />
                )}
              />
              
              <Box sx={{ display: 'flex', gap: 1 }}>
                <IconButton onClick={resetZoom}>
                  <CenterIcon />
                </IconButton>
                <Typography variant="body2" sx={{ alignSelf: 'center' }}>
                  Zoom: {(zoomLevel * 100).toFixed(0)}%
                </Typography>
              </Box>
            </Box>

            {/* Network SVG */}
            <Box sx={{ border: '1px solid #ddd', borderRadius: 1, height: '600px', overflow: 'hidden' }}>
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