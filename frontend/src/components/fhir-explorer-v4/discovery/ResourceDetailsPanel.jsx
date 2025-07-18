/**
 * Resource Details Panel for RelationshipMapper
 * 
 * Displays comprehensive FHIR resource information when a node is selected.
 * Includes resource data, metadata, relationships, and actions.
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Divider,
  Button,
  Stack,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemButton,
  Collapse,
  Alert,
  Tooltip,
  CircularProgress,
  Tab,
  Tabs,
  Badge,
  Card,
  CardContent,
  CardActions,
  Menu,
  MenuItem,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Link
} from '@mui/material';
import {
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  ContentCopy as CopyIcon,
  OpenInNew as OpenInNewIcon,
  Timeline as TimelineIcon,
  Link as LinkIcon,
  Person as PersonIcon,
  LocalHospital as HospitalIcon,
  Science as ObservationIcon,
  Medication as MedicationIcon,
  Assignment as AssignmentIcon,
  CalendarToday as EncounterIcon,
  Description as DocumentIcon,
  Code as CodeIcon,
  AccessTime as ClockIcon,
  Fingerprint as IdIcon,
  Category as CategoryIcon,
  Label as LabelIcon,
  MoreVert as MoreIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Refresh as RefreshIcon,
  AccountTree as RelationshipIcon,
  Warning as ConditionIcon
} from '@mui/icons-material';
import { format, parseISO } from 'date-fns';
import { fhirClient } from '../../../core/fhir/services/fhirClient';
import { fhirRelationshipService } from '../../../services/fhirRelationshipService';

// Resource type icons mapping
const RESOURCE_ICONS = {
  Patient: PersonIcon,
  Practitioner: HospitalIcon,
  Observation: ObservationIcon,
  MedicationRequest: MedicationIcon,
  Condition: ConditionIcon,
  Encounter: EncounterIcon,
  DocumentReference: DocumentIcon,
  Procedure: HospitalIcon,
  DiagnosticReport: DocumentIcon,
  AllergyIntolerance: ConditionIcon,
  Immunization: MedicationIcon,
  CarePlan: AssignmentIcon,
  CareTeam: HospitalIcon
};

function ResourceDetailsPanel({ 
  selectedNode, 
  onClose, 
  onResourceSelect,
  onAddToComparison,
  onFindPath,
  width = 400 
}) {
  const [resourceData, setResourceData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [expandedSections, setExpandedSections] = useState({
    metadata: true,
    relationships: true,
    clinical: true,
    raw: false
  });
  const [anchorEl, setAnchorEl] = useState(null);
  const [relatedResources, setRelatedResources] = useState({});
  const [loadingRelated, setLoadingRelated] = useState({});

  // Load full resource data when selected node changes
  useEffect(() => {
    if (selectedNode) {
      loadResourceData();
      loadRelatedResources();
    }
  }, [selectedNode]);

  const loadResourceData = async () => {
    if (!selectedNode) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const [resourceType, resourceId] = selectedNode.id.split('/');
      const resource = await fhirClient.read(resourceType, resourceId);
      setResourceData(resource);
    } catch (err) {
      setError(`Failed to load resource: ${err.message}`);
      console.error('Error loading resource:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadRelatedResources = async () => {
    if (!selectedNode) return;
    
    try {
      const [resourceType, resourceId] = selectedNode.id.split('/');
      const relationships = await fhirRelationshipService.discoverRelationships(
        resourceType, 
        resourceId,
        { depth: 1, includeCounts: true }
      );
      
      // Group related resources by type
      const grouped = {};
      relationships.links?.forEach(link => {
        const targetNode = relationships.nodes.find(n => n.id === link.target);
        if (targetNode && targetNode.id !== selectedNode.id) {
          const type = targetNode.resourceType;
          if (!grouped[type]) {
            grouped[type] = [];
          }
          grouped[type].push({
            ...targetNode,
            relationshipType: link.type,
            relationshipField: link.field
          });
        }
      });
      
      setRelatedResources(grouped);
    } catch (err) {
      console.error('Error loading related resources:', err);
    }
  };

  const handleCopyResourceId = () => {
    navigator.clipboard.writeText(selectedNode.id);
    // Could add a snackbar notification here
  };

  const handleCopyResource = () => {
    if (resourceData) {
      navigator.clipboard.writeText(JSON.stringify(resourceData, null, 2));
    }
  };

  const handleOpenInNewTab = () => {
    // This could open a dedicated resource viewer
    console.log('Open in new tab:', selectedNode.id);
  };

  const handleMoreActions = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return format(parseISO(dateString), 'MMM dd, yyyy HH:mm');
    } catch {
      return dateString;
    }
  };

  const getResourceIcon = (resourceType) => {
    const Icon = RESOURCE_ICONS[resourceType] || CategoryIcon;
    return <Icon />;
  };

  const getResourceDisplay = (resource) => {
    if (!resource) return 'Unknown';
    
    // Common display patterns
    if (resource.name) {
      if (Array.isArray(resource.name)) {
        const name = resource.name[0];
        return `${name.given?.join(' ') || ''} ${name.family || ''}`.trim();
      }
      return resource.name;
    }
    
    if (resource.code?.text) return resource.code.text;
    if (resource.code?.coding?.[0]?.display) return resource.code.coding[0].display;
    if (resource.display) return resource.display;
    if (resource.description) return resource.description;
    if (resource.title) return resource.title;
    
    return `${resource.resourceType}/${resource.id}`;
  };

  const renderMetadata = () => {
    if (!resourceData) return null;
    
    return (
      <Box>
        <Table size="small">
          <TableBody>
            <TableRow>
              <TableCell component="th" scope="row">
                <Stack direction="row" spacing={1} alignItems="center">
                  <IdIcon fontSize="small" />
                  <Typography variant="body2">ID</Typography>
                </Stack>
              </TableCell>
              <TableCell>
                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                  {resourceData.id}
                </Typography>
              </TableCell>
            </TableRow>
            
            {resourceData.meta?.versionId && (
              <TableRow>
                <TableCell component="th" scope="row">
                  <Typography variant="body2">Version</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{resourceData.meta.versionId}</Typography>
                </TableCell>
              </TableRow>
            )}
            
            <TableRow>
              <TableCell component="th" scope="row">
                <Stack direction="row" spacing={1} alignItems="center">
                  <ClockIcon fontSize="small" />
                  <Typography variant="body2">Last Updated</Typography>
                </Stack>
              </TableCell>
              <TableCell>
                <Typography variant="body2">
                  {formatDate(resourceData.meta?.lastUpdated)}
                </Typography>
              </TableCell>
            </TableRow>
            
            {resourceData.meta?.source && (
              <TableRow>
                <TableCell component="th" scope="row">
                  <Typography variant="body2">Source</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{resourceData.meta.source}</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        
        {resourceData.meta?.profile && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="caption" color="text.secondary">Profiles:</Typography>
            <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 0.5 }}>
              {resourceData.meta.profile.map((profile, idx) => (
                <Chip 
                  key={idx} 
                  label={profile.split('/').pop()} 
                  size="small"
                  variant="outlined"
                />
              ))}
            </Stack>
          </Box>
        )}
      </Box>
    );
  };

  const renderRelationships = () => {
    return (
      <Box>
        {Object.entries(relatedResources).length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No related resources found
          </Typography>
        ) : (
          <List dense>
            {Object.entries(relatedResources).map(([resourceType, resources]) => (
              <Box key={resourceType} sx={{ mb: 1 }}>
                <Typography 
                  variant="subtitle2" 
                  sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 1,
                    mb: 0.5 
                  }}
                >
                  {getResourceIcon(resourceType)}
                  {resourceType}
                  <Chip label={resources.length} size="small" />
                </Typography>
                
                {resources.slice(0, 5).map((resource, idx) => (
                  <ListItemButton
                    key={idx}
                    onClick={() => onResourceSelect?.(resourceType, resource.id.split('/')[1])}
                    sx={{ pl: 4, py: 0.5 }}
                  >
                    <ListItemText 
                      primary={resource.display || resource.id}
                      secondary={`via ${resource.relationshipField}`}
                      primaryTypographyProps={{ variant: 'body2' }}
                      secondaryTypographyProps={{ variant: 'caption' }}
                    />
                    <IconButton 
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        onFindPath?.(selectedNode, resource);
                      }}
                    >
                      <RouteIcon fontSize="small" />
                    </IconButton>
                  </ListItemButton>
                ))}
                
                {resources.length > 5 && (
                  <Typography 
                    variant="caption" 
                    color="text.secondary"
                    sx={{ pl: 4, display: 'block' }}
                  >
                    and {resources.length - 5} more...
                  </Typography>
                )}
              </Box>
            ))}
          </List>
        )}
      </Box>
    );
  };

  const renderClinicalSummary = () => {
    if (!resourceData) return null;
    
    // Resource-specific clinical summaries
    switch (selectedNode.resourceType) {
      case 'Patient':
        return (
          <Box>
            <Typography variant="body2">
              <strong>Birth Date:</strong> {formatDate(resourceData.birthDate)}
            </Typography>
            <Typography variant="body2">
              <strong>Gender:</strong> {resourceData.gender}
            </Typography>
            {resourceData.address?.[0] && (
              <Typography variant="body2">
                <strong>Address:</strong> {resourceData.address[0].city}, {resourceData.address[0].state}
              </Typography>
            )}
          </Box>
        );
        
      case 'Condition':
        return (
          <Box>
            <Typography variant="body2">
              <strong>Clinical Status:</strong> {resourceData.clinicalStatus?.coding?.[0]?.code}
            </Typography>
            <Typography variant="body2">
              <strong>Verification:</strong> {resourceData.verificationStatus?.coding?.[0]?.code}
            </Typography>
            <Typography variant="body2">
              <strong>Onset:</strong> {formatDate(resourceData.onsetDateTime)}
            </Typography>
          </Box>
        );
        
      case 'Observation':
        return (
          <Box>
            <Typography variant="body2">
              <strong>Status:</strong> {resourceData.status}
            </Typography>
            <Typography variant="body2">
              <strong>Effective:</strong> {formatDate(resourceData.effectiveDateTime)}
            </Typography>
            {resourceData.valueQuantity && (
              <Typography variant="body2">
                <strong>Value:</strong> {resourceData.valueQuantity.value} {resourceData.valueQuantity.unit}
              </Typography>
            )}
          </Box>
        );
        
      default:
        return (
          <Typography variant="body2" color="text.secondary">
            No clinical summary available for this resource type
          </Typography>
        );
    }
  };

  const renderRawData = () => {
    if (!resourceData) return null;
    
    return (
      <Box 
        sx={{ 
          bgcolor: 'grey.50',
          p: 2,
          borderRadius: 1,
          overflow: 'auto',
          maxHeight: 400
        }}
      >
        <pre style={{ margin: 0, fontSize: '0.75rem' }}>
          {JSON.stringify(resourceData, null, 2)}
        </pre>
      </Box>
    );
  };

  if (!selectedNode) return null;

  return (
    <Paper 
      elevation={2}
      sx={{ 
        width, 
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      {/* Header */}
      <Box sx={{ 
        p: 2, 
        borderBottom: 1, 
        borderColor: 'divider',
        bgcolor: 'primary.light',
        color: 'primary.contrastText'
      }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
            {getResourceIcon(selectedNode.resourceType)}
            <Box>
              <Typography variant="h6">
                {selectedNode.resourceType}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.9 }}>
                {selectedNode.display || selectedNode.id}
              </Typography>
            </Box>
          </Box>
          
          <Stack direction="row" spacing={0.5}>
            <Tooltip title="Copy Resource ID">
              <IconButton 
                size="small" 
                onClick={handleCopyResourceId}
                sx={{ color: 'inherit' }}
              >
                <CopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="More Actions">
              <IconButton 
                size="small" 
                onClick={handleMoreActions}
                sx={{ color: 'inherit' }}
              >
                <MoreIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            
            <IconButton 
              size="small" 
              onClick={onClose}
              sx={{ color: 'inherit' }}
            >
              <CloseIcon />
            </IconButton>
          </Stack>
        </Stack>
      </Box>

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleCloseMenu}
      >
        <MenuItem onClick={() => { handleCopyResource(); handleCloseMenu(); }}>
          <ListItemIcon><CopyIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Copy Full Resource</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { handleOpenInNewTab(); handleCloseMenu(); }}>
          <ListItemIcon><OpenInNewIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Open in New Tab</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { onAddToComparison?.(selectedNode); handleCloseMenu(); }}>
          <ListItemIcon><CompareIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Add to Comparison</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => { loadResourceData(); handleCloseMenu(); }}>
          <ListItemIcon><RefreshIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Refresh</ListItemText>
        </MenuItem>
      </Menu>

      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>
        ) : (
          <Box>
            {/* Tabs */}
            <Tabs 
              value={activeTab} 
              onChange={(e, v) => setActiveTab(v)}
              variant="fullWidth"
              sx={{ borderBottom: 1, borderColor: 'divider' }}
            >
              <Tab label="Overview" />
              <Tab label="Relationships" icon={<Badge badgeContent={Object.keys(relatedResources).length} color="primary" />} />
              <Tab label="Raw Data" />
            </Tabs>

            {/* Tab Content */}
            <Box sx={{ p: 2 }}>
              {activeTab === 0 && (
                <Stack spacing={2}>
                  {/* Metadata Section */}
                  <Accordion 
                    expanded={expandedSections.metadata}
                    onChange={(e, expanded) => setExpandedSections(prev => ({ ...prev, metadata: expanded }))}
                  >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="subtitle1">Resource Metadata</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      {renderMetadata()}
                    </AccordionDetails>
                  </Accordion>

                  {/* Clinical Summary Section */}
                  <Accordion 
                    expanded={expandedSections.clinical}
                    onChange={(e, expanded) => setExpandedSections(prev => ({ ...prev, clinical: expanded }))}
                  >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="subtitle1">Clinical Summary</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      {renderClinicalSummary()}
                    </AccordionDetails>
                  </Accordion>
                </Stack>
              )}

              {activeTab === 1 && renderRelationships()}
              
              {activeTab === 2 && renderRawData()}
            </Box>
          </Box>
        )}
      </Box>
    </Paper>
  );
}

// Fix missing import
const CompareIcon = LinkIcon;
const RouteIcon = RelationshipIcon;

export default ResourceDetailsPanel;