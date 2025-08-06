import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  ToggleButton,
  ToggleButtonGroup,
  Card,
  CardContent,
  Collapse,
  Stack,
  Divider,
  TextField,
  MenuItem,
  FormControlLabel,
  Switch,
  Avatar,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Grid,
  useTheme
} from '@mui/material';
import {
  LocalHospital as EncounterIcon,
  Science as LabIcon,
  Medication as MedicationIcon,
  Assignment as ProcedureIcon,
  Warning as AllergyIcon,
  Healing as ConditionIcon,
  MedicalServices as ImmunizationIcon,
  Description as DocumentIcon,
  CameraAlt as ImagingIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  FilterList as FilterIcon,
  ViewList as ListViewIcon,
  Timeline as TimelineViewIcon
} from '@mui/icons-material';
import { format, subMonths } from 'date-fns';
import { fhirClient } from '../../../core/fhir/services/fhirClient';
import { getChartColors } from '../../../themes/chartColors';

// Resource configuration for icons and colors
const RESOURCE_CONFIG = (theme) => {
  const chartColors = getChartColors(theme);
  
  return {
    Encounter: {
      icon: EncounterIcon,
      color: chartColors.timeline.Encounter,
      label: 'Encounter',
      description: 'Hospital visits and appointments'
    },
    Observation: {
      icon: LabIcon,
      color: chartColors.timeline.Observation,
      label: 'Observation',
      description: 'Lab results and vital signs'
    },
    MedicationRequest: {
      icon: MedicationIcon,
      color: chartColors.timeline.MedicationRequest,
      label: 'Medication',
      description: 'Medication orders and prescriptions'
    },
    Procedure: {
      icon: ProcedureIcon,
      color: chartColors.timeline.Procedure,
      label: 'Procedure',
      description: 'Medical procedures performed'
    },
    AllergyIntolerance: {
      icon: AllergyIcon,
      color: chartColors.timeline.AllergyIntolerance,
      label: 'Allergy',
      description: 'Allergies and intolerances'
    },
    Condition: {
      icon: ConditionIcon,
      color: chartColors.timeline.Condition,
      label: 'Condition',
      description: 'Diagnoses and conditions'
    },
    Immunization: {
      icon: ImmunizationIcon,
      color: chartColors.timeline.Immunization,
      label: 'Immunization',
      description: 'Vaccines and immunizations'
    },
    DocumentReference: {
      icon: DocumentIcon,
      color: chartColors.timeline.DiagnosticReport,
      label: 'Document',
      description: 'Clinical documents and notes'
    },
    ImagingStudy: {
      icon: ImagingIcon,
      color: chartColors.timeline.CarePlan,
      label: 'Imaging',
      description: 'Radiology and imaging studies'
    }
  };
};

// Helper functions - defined early for use in components
const getResourceDate = (resource) => {
  const type = resource._resourceType || resource.resourceType;
  
  switch (type) {
    case 'Encounter':
      return new Date(resource.period?.start || resource.actualPeriod?.start || resource.meta?.lastUpdated);
    case 'Observation':
      return new Date(resource.effectiveDateTime || resource.effectivePeriod?.start || resource.issued);
    case 'MedicationRequest':
      return new Date(resource.authoredOn || resource.meta?.lastUpdated);
    case 'Procedure':
      return new Date(resource.performedDateTime || resource.performedPeriod?.start || resource.occurrenceDateTime);
    case 'AllergyIntolerance':
      return new Date(resource.recordedDate || resource.onsetDateTime || resource.meta?.lastUpdated);
    case 'Condition':
      return new Date(resource.onsetDateTime || resource.recordedDate || resource.meta?.lastUpdated);
    case 'Immunization':
      return new Date(resource.occurrenceDateTime || resource.meta?.lastUpdated);
    case 'DocumentReference':
      return new Date(resource.date || resource.meta?.lastUpdated);
    case 'ImagingStudy':
      return new Date(resource.started || resource.meta?.lastUpdated);
    default:
      return new Date(resource.meta?.lastUpdated);
  }
};

const getResourceTitle = (resource) => {
  const type = resource._resourceType;
  
  switch (type) {
    case 'Encounter':
      return resource.type?.[0]?.text || resource.type?.[0]?.coding?.[0]?.display || 'Encounter';
    case 'Observation':
      return resource.code?.text || resource.code?.coding?.[0]?.display || 'Observation';
    case 'MedicationRequest':
      return resource.medication?.concept?.text || 
             resource.medication?.concept?.coding?.[0]?.display || 'Medication';
    case 'Procedure':
      return resource.code?.text || resource.code?.coding?.[0]?.display || 'Procedure';
    case 'AllergyIntolerance':
      return resource.code?.text || resource.code?.coding?.[0]?.display || 'Allergy';
    case 'Condition':
      return resource.code?.text || resource.code?.coding?.[0]?.display || 'Condition';
    case 'Immunization':
      return resource.vaccineCode?.text || resource.vaccineCode?.coding?.[0]?.display || 'Vaccination';
    case 'DocumentReference':
      return resource.description || resource.type?.text || 'Document';
    case 'ImagingStudy':
      return resource.description || resource.modality?.[0]?.code || 'Imaging Study';
    default:
      return `${type} Resource`;
  }
};

const getResourceSummary = (resource) => {
  const type = resource._resourceType;
  
  switch (type) {
    case 'Encounter':
      return `Status: ${resource.status} | Class: ${resource.class?.code || 'Unknown'}`;
    case 'Observation':
      const value = resource.valueQuantity ? 
        `${resource.valueQuantity.value} ${resource.valueQuantity.unit}` :
        resource.valueString || 'No value';
      return `Value: ${value}`;
    case 'MedicationRequest':
      return `Status: ${resource.status} | ${resource.dosageInstruction?.[0]?.text || 'No dosage'}`;
    case 'Procedure':
      return `Status: ${resource.status}`;
    case 'AllergyIntolerance':
      return `Type: ${resource.type} | Criticality: ${resource.criticality || 'Unknown'}`;
    case 'Condition':
      return `Status: ${resource.clinicalStatus?.coding?.[0]?.code}`;
    case 'Immunization':
      return `Status: ${resource.status}`;
    default:
      return `ID: ${resource.id}`;
  }
};

// Custom Timeline Components
const CustomTimelineItem = ({ resource, config, isLast, onToggleDetails, showDetails }) => {
  const theme = useTheme();
  const resourceDate = getResourceDate(resource);
  const Icon = config.icon;

  return (
    <Box sx={{ display: 'flex', mb: 2 }}>
      {/* Date Column */}
      <Box sx={{ width: 120, mr: 2, textAlign: 'right', pt: 1 }}>
        <Typography variant="caption" color="text.secondary">
          {format(resourceDate, 'MMM dd')}
        </Typography>
        <Typography variant="caption" display="block" color="text.secondary">
          {format(resourceDate, 'HH:mm')}
        </Typography>
      </Box>

      {/* Timeline Line */}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mr: 2 }}>
        <Avatar sx={{ bgcolor: config.color, width: 40, height: 40 }}>
          <Icon sx={{ color: 'white' }} />
        </Avatar>
        {!isLast && (
          <Box 
            sx={{ 
              width: 2, 
              height: 60, 
              bgcolor: theme.palette.divider, 
              mt: 1 
            }} 
          />
        )}
      </Box>

      {/* Content */}
      <Box sx={{ flexGrow: 1 }}>
        <Card sx={{ mb: 1 }}>
          <CardContent sx={{ pb: '16px !important' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  {getResourceTitle(resource)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {getResourceSummary(resource)}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip 
                  label={config.label} 
                  size="small" 
                  sx={{ bgcolor: config.color, color: 'white' }}
                />
                <IconButton 
                  size="small" 
                  onClick={() => onToggleDetails(resource.id)}
                >
                  {showDetails ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        <Collapse in={showDetails}>
          <Paper sx={{ p: 2, bgcolor: theme.palette.action.hover }}>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              FHIR Resource Details
            </Typography>
            <pre style={{ fontSize: '12px', overflow: 'auto', maxHeight: '200px' }}>
              {JSON.stringify(resource, null, 2)}
            </pre>
          </Paper>
        </Collapse>
      </Box>
    </Box>
  );
};

const FHIRResourceTimeline = ({ patientId, height = '600px' }) => {
  const theme = useTheme();
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('timeline');
  const [dateRange, setDateRange] = useState('6months');
  const [filterResourceTypes, setFilterResourceTypes] = useState([
    'Encounter', 'Observation', 'MedicationRequest', 'Procedure', 
    'AllergyIntolerance', 'Condition', 'Immunization', 'DocumentReference', 'ImagingStudy'
  ]);
  const [expandedItems, setExpandedItems] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  
  // Get theme-aware resource config
  const resourceConfig = RESOURCE_CONFIG(theme);

  // Fetch all FHIR resources for the patient
  useEffect(() => {
    if (!patientId) return;

    const fetchResources = async () => {
      setLoading(true);
      setError(null);

      try {
        const allResources = [];
        
        // Resource types to fetch
        const resourceTypes = Object.keys(resourceConfig);
        
        for (const resourceType of resourceTypes) {
          try {
            let result;
            
            // Use specific client methods where available
            switch (resourceType) {
              case 'Encounter':
                result = await fhirClient.getEncounters(patientId);
                break;
              case 'Observation':
                result = await fhirClient.getObservations(patientId);
                break;
              case 'MedicationRequest':
                result = await fhirClient.getMedications(patientId);
                break;
              case 'Condition':
                result = await fhirClient.getConditions(patientId);
                break;
              case 'AllergyIntolerance':
                result = await fhirClient.getAllergies(patientId);
                break;
              case 'Immunization':
                result = await fhirClient.getImmunizations(patientId);
                break;
              default:
                result = await fhirClient.search(resourceType, { 
                  patient: patientId,
                  _sort: '-date'
                });
            }
            
            // Add resource type to each resource for easier processing
            const typedResources = result.resources.map(r => ({
              ...r,
              _resourceType: resourceType
            }));
            
            allResources.push(...typedResources);
          } catch (err) {
            
          }
        }

        // Sort by date
        const sortedResources = allResources.sort((a, b) => {
          const dateA = getResourceDate(a);
          const dateB = getResourceDate(b);
          return dateB - dateA;
        });

        setResources(sortedResources);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchResources();
  }, [patientId, resourceConfig]);

  // Filter resources based on settings
  const filteredResources = useMemo(() => {
    let filtered = resources.filter(r => filterResourceTypes.includes(r._resourceType));
    
    // Apply date range filter
    if (dateRange !== 'all') {
      const now = new Date();
      let startDate;
      
      switch (dateRange) {
        case '1month':
          startDate = subMonths(now, 1);
          break;
        case '3months':
          startDate = subMonths(now, 3);
          break;
        case '6months':
          startDate = subMonths(now, 6);
          break;
        case '1year':
          startDate = subMonths(now, 12);
          break;
        default:
          startDate = subMonths(now, 6);
      }
      
      filtered = filtered.filter(r => {
        const resourceDate = getResourceDate(r);
        return resourceDate >= startDate;
      });
    }
    
    return filtered;
  }, [resources, filterResourceTypes, dateRange]);

  // Group resources by date for grouped view
  const groupedResources = useMemo(() => {
    const groups = {};
    
    filteredResources.forEach(resource => {
      const date = format(getResourceDate(resource), 'yyyy-MM-dd');
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(resource);
    });
    
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [filteredResources]);

  const toggleResourceType = (resourceType) => {
    setFilterResourceTypes(prev => 
      prev.includes(resourceType)
        ? prev.filter(t => t !== resourceType)
        : [...prev, resourceType]
    );
  };

  const toggleExpandedItem = (id) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height={height}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error">
        Error loading timeline: {error}
      </Alert>
    );
  }

  return (
    <Paper sx={{ height, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Patient Timeline</Typography>
          <Stack direction="row" spacing={1}>
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={(e, newMode) => newMode && setViewMode(newMode)}
              size="small"
            >
              <ToggleButton value="timeline">
                <TimelineViewIcon />
              </ToggleButton>
              <ToggleButton value="grouped">
                <ListViewIcon />
              </ToggleButton>
            </ToggleButtonGroup>
            <IconButton 
              size="small" 
              onClick={() => setShowFilters(!showFilters)}
              color={showFilters ? 'primary' : 'default'}
            >
              <FilterIcon />
            </IconButton>
          </Stack>
        </Stack>
      </Box>

      {/* Filters */}
      <Collapse in={showFilters}>
        <Box sx={{ p: 2, bgcolor: theme.palette.action.hover, borderBottom: 1, borderColor: 'divider' }}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                select
                fullWidth
                size="small"
                label="Date Range"
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
              >
                <MenuItem value="1month">Last Month</MenuItem>
                <MenuItem value="3months">Last 3 Months</MenuItem>
                <MenuItem value="6months">Last 6 Months</MenuItem>
                <MenuItem value="1year">Last Year</MenuItem>
                <MenuItem value="all">All Time</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>
                Resource Types
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {Object.entries(resourceConfig).map(([type, config]) => (
                  <Chip
                    key={type}
                    label={config.label}
                    size="small"
                    onClick={() => toggleResourceType(type)}
                    color={filterResourceTypes.includes(type) ? 'primary' : 'default'}
                    variant={filterResourceTypes.includes(type) ? 'filled' : 'outlined'}
                    sx={{ mb: 1 }}
                  />
                ))}
              </Stack>
            </Grid>
          </Grid>
        </Box>
      </Collapse>

      {/* Content */}
      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
        {viewMode === 'timeline' ? (
          // Timeline View
          <Box>
            {filteredResources.map((resource, index) => {
              const config = resourceConfig[resource._resourceType] || {
                icon: DocumentIcon,
                color: theme.palette.text.secondary,
                label: resource._resourceType
              };

              return (
                <CustomTimelineItem
                  key={resource.id}
                  resource={resource}
                  config={config}
                  isLast={index === filteredResources.length - 1}
                  onToggleDetails={toggleExpandedItem}
                  showDetails={expandedItems[resource.id]}
                />
              );
            })}
          </Box>
        ) : (
          // Grouped View
          <Box>
            {groupedResources.map(([date, resources]) => (
              <Box key={date} sx={{ mb: 3 }}>
                <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>
                  {format(new Date(date), 'EEEE, MMMM dd, yyyy')}
                </Typography>
                <List>
                  {resources.map((resource) => {
                    const config = resourceConfig[resource._resourceType] || {
                      icon: DocumentIcon,
                      color: theme.palette.text.secondary,
                      label: resource._resourceType
                    };
                    const Icon = config.icon;

                    return (
                      <ListItem key={resource.id} sx={{ px: 0 }}>
                        <ListItemIcon>
                          <Avatar sx={{ bgcolor: config.color, width: 32, height: 32 }}>
                            <Icon sx={{ fontSize: 18, color: 'white' }} />
                          </Avatar>
                        </ListItemIcon>
                        <ListItemText
                          primary={getResourceTitle(resource)}
                          secondary={getResourceSummary(resource)}
                        />
                        <Chip 
                          label={config.label} 
                          size="small" 
                          sx={{ bgcolor: config.color, color: 'white', mr: 1 }}
                        />
                        <IconButton 
                          size="small" 
                          onClick={() => toggleExpandedItem(resource.id)}
                        >
                          {expandedItems[resource.id] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </IconButton>
                      </ListItem>
                    );
                  })}
                </List>
              </Box>
            ))}
          </Box>
        )}

        {filteredResources.length === 0 && (
          <Alert severity="info">
            No resources found for the selected criteria
          </Alert>
        )}
      </Box>
    </Paper>
  );
};

export default FHIRResourceTimeline;