/**
 * Prefetch Builder Improved - Visual FHIR query builder for CDS Hooks
 */

import React, { useState } from 'react';
import {
  Box,
  Grid,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  IconButton,
  Paper,
  Stack,
  Chip,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Switch,
  Tabs,
  Tab,
  InputAdornment
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  ContentCopy as CopyIcon,
  Code as CodeIcon,
  Person as PatientIcon,
  LocalHospital as ConditionIcon,
  Medication as MedicationIcon,
  Science as ObservationIcon,
  Assignment as ProcedureIcon,
  Warning as AllergyIcon,
  Vaccines as ImmunizationIcon,
  ExpandMore as ExpandMoreIcon,
  Help as HelpIcon,
  CheckCircle as ValidIcon,
  Error as ErrorIcon,
  Search as SearchIcon
} from '@mui/icons-material';

// Common FHIR resource types for prefetch
const RESOURCE_TYPES = [
  { 
    id: 'Patient', 
    label: 'Patient Demographics',
    icon: <PatientIcon />,
    description: 'Basic patient information',
    singleton: true
  },
  { 
    id: 'Condition', 
    label: 'Conditions/Problems',
    icon: <ConditionIcon />,
    description: 'Patient diagnoses and problems',
    commonParams: ['clinical-status', 'category']
  },
  { 
    id: 'MedicationRequest', 
    label: 'Medications',
    icon: <MedicationIcon />,
    description: 'Current and past medications',
    commonParams: ['status', 'intent']
  },
  { 
    id: 'Observation', 
    label: 'Observations',
    icon: <ObservationIcon />,
    description: 'Lab results, vital signs, etc.',
    commonParams: ['category', 'code', 'date']
  },
  { 
    id: 'Procedure', 
    label: 'Procedures',
    icon: <ProcedureIcon />,
    description: 'Completed or planned procedures',
    commonParams: ['status', 'date']
  },
  { 
    id: 'AllergyIntolerance', 
    label: 'Allergies',
    icon: <AllergyIcon />,
    description: 'Allergies and intolerances',
    commonParams: ['clinical-status']
  },
  { 
    id: 'Immunization', 
    label: 'Immunizations',
    icon: <ImmunizationIcon />,
    description: 'Vaccination records',
    commonParams: ['status', 'date']
  }
];

// Common query templates
const QUERY_TEMPLATES = {
  activeConditions: {
    name: 'Active Conditions',
    description: 'All active problems',
    resource: 'Condition',
    params: { 'clinical-status': 'active' }
  },
  currentMedications: {
    name: 'Current Medications',
    description: 'Active medication orders',
    resource: 'MedicationRequest',
    params: { 'status': 'active' }
  },
  recentLabs: {
    name: 'Recent Lab Results',
    description: 'Lab results from last 90 days',
    resource: 'Observation',
    params: { 
      'category': 'laboratory',
      'date': 'ge{{today-90days}}'
    }
  },
  recentVitals: {
    name: 'Recent Vital Signs',
    description: 'Vital signs from last 7 days',
    resource: 'Observation',
    params: { 
      'category': 'vital-signs',
      'date': 'ge{{today-7days}}'
    }
  },
  activeAllergies: {
    name: 'Active Allergies',
    description: 'Confirmed allergies',
    resource: 'AllergyIntolerance',
    params: { 'clinical-status': 'active' }
  }
};

// Parameter types
const PARAM_TYPES = {
  'clinical-status': {
    type: 'select',
    options: ['active', 'inactive', 'resolved']
  },
  'status': {
    type: 'select',
    options: ['active', 'completed', 'draft', 'stopped']
  },
  'category': {
    type: 'select',
    options: ['laboratory', 'vital-signs', 'imaging', 'procedure', 'survey', 'exam', 'therapy']
  },
  'date': {
    type: 'date-range'
  },
  'code': {
    type: 'code-search'
  }
};

// Prefetch query item
const PrefetchItem = ({ queryKey, query, onChange, onDelete }) => {
  const [expanded, setExpanded] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [testResult, setTestResult] = useState(null);
  
  const resourceType = RESOURCE_TYPES.find(r => r.id === query.resource);
  
  // Parse query URL to extract parameters
  const parseQuery = (url) => {
    if (!url) return { resource: '', params: {} };
    const [resource, paramString] = url.split('?');
    const params = {};
    if (paramString) {
      paramString.split('&').forEach(param => {
        const [key, value] = param.split('=');
        params[key] = decodeURIComponent(value);
      });
    }
    return { resource, params };
  };
  
  // Build query URL from parameters
  const buildQuery = (resource, params) => {
    const paramPairs = Object.entries(params)
      .filter(([key, value]) => value)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`);
    return paramPairs.length > 0 ? `${resource}?${paramPairs.join('&')}` : resource;
  };
  
  const handleParamChange = (param, value) => {
    const parsed = parseQuery(query);
    parsed.params[param] = value;
    if (!value) delete parsed.params[param];
    onChange(queryKey, buildQuery(parsed.resource, parsed.params));
  };

  return (
    <Accordion expanded={expanded} onChange={(e, isExpanded) => setExpanded(isExpanded)}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box display="flex" alignItems="center" gap={2} width="100%">
          {resourceType?.icon}
          <Typography variant="subtitle2" sx={{ flex: 1 }}>
            {queryKey}
          </Typography>
          <Chip 
            label={query.resource || 'Not configured'} 
            size="small" 
            color={query.resource ? 'primary' : 'default'}
            onClick={(e) => e.stopPropagation()}
          />
          <IconButton 
            size="small" 
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <DeleteIcon />
          </IconButton>
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        <Grid container spacing={2}>
          {/* Query key */}
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Query Key"
              value={queryKey}
              disabled
              helperText="This key is used to reference the data in your hook logic"
            />
          </Grid>

          {/* Resource type */}
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel>Resource Type</InputLabel>
              <Select
                value={query.resource || ''}
                onChange={(e) => onChange(queryKey, e.target.value)}
                label="Resource Type"
              >
                {RESOURCE_TYPES.map(resource => (
                  <MenuItem key={resource.id} value={resource.id}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      {resource.icon}
                      <Box>
                        <Typography variant="body2">{resource.label}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {resource.description}
                        </Typography>
                      </Box>
                    </Stack>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Common parameters */}
          {query.resource && (
            <>
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  Query Parameters
                </Typography>
              </Grid>
              
              {resourceType?.commonParams?.map(param => (
                <Grid item xs={12} md={6} key={param}>
                  {PARAM_TYPES[param]?.type === 'select' ? (
                    <FormControl fullWidth size="small">
                      <InputLabel>{param}</InputLabel>
                      <Select
                        value={parseQuery(query).params[param] || ''}
                        onChange={(e) => handleParamChange(param, e.target.value)}
                        label={param}
                      >
                        <MenuItem value="">
                          <em>Any</em>
                        </MenuItem>
                        {PARAM_TYPES[param].options.map(opt => (
                          <MenuItem key={opt} value={opt}>
                            {opt}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  ) : (
                    <TextField
                      fullWidth
                      size="small"
                      label={param}
                      value={parseQuery(query).params[param] || ''}
                      onChange={(e) => handleParamChange(param, e.target.value)}
                      placeholder={param === 'date' ? 'e.g., ge{{today-30days}}' : ''}
                    />
                  )}
                </Grid>
              ))}
            </>
          )}

          {/* Advanced options */}
          <Grid item xs={12}>
            <Accordion expanded={showAdvanced} onChange={(e, expanded) => setShowAdvanced(expanded)}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle2">Advanced Options</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Custom Query URL"
                      value={query}
                      onChange={(e) => onChange(queryKey, e.target.value)}
                      multiline
                      rows={2}
                      helperText="Edit the raw FHIR query URL"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={query._include !== undefined}
                          onChange={(e) => {
                            const newQuery = { ...query };
                            if (e.target.checked) {
                              newQuery._include = [];
                            } else {
                              delete newQuery._include;
                            }
                            onChange(queryKey, newQuery);
                          }}
                        />
                      }
                      label="Include referenced resources"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Result limit"
                      type="number"
                      value={parseQuery(query).params._count || ''}
                      onChange={(e) => handleParamChange('_count', e.target.value)}
                      InputProps={{
                        inputProps: { min: 1, max: 100 }
                      }}
                    />
                  </Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>
          </Grid>

          {/* Query preview */}
          <Grid item xs={12}>
            <Paper variant="outlined" sx={{ p: 2, backgroundColor: 'grey.50' }}>
              <Typography variant="caption" color="text.secondary" gutterBottom>
                Query Preview:
              </Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                {query || 'Not configured'}
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      </AccordionDetails>
    </Accordion>
  );
};

// Main component
const PrefetchBuilderImproved = ({ prefetch = {}, onChange }) => {
  const [showTemplates, setShowTemplates] = useState(false);
  const [newQueryKey, setNewQueryKey] = useState('');
  const [activeTab, setActiveTab] = useState(0);

  // Add new query
  const addQuery = (key, template = null) => {
    const queryKey = key || `query${Object.keys(prefetch).length + 1}`;
    const newPrefetch = { ...prefetch };
    
    if (template) {
      newPrefetch[queryKey] = buildQueryFromTemplate(template);
    } else {
      newPrefetch[queryKey] = '';
    }
    
    onChange(newPrefetch);
    setNewQueryKey('');
    setShowTemplates(false);
  };

  // Build query from template
  const buildQueryFromTemplate = (template) => {
    const params = Object.entries(template.params)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');
    return `${template.resource}?${params}`;
  };

  // Update query
  const updateQuery = (key, value) => {
    onChange({ ...prefetch, [key]: value });
  };

  // Delete query
  const deleteQuery = (key) => {
    const newPrefetch = { ...prefetch };
    delete newPrefetch[key];
    onChange(newPrefetch);
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Prefetch Configuration
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Define FHIR queries to pre-load patient data before your hook executes
      </Typography>

      {Object.keys(prefetch).length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center', borderStyle: 'dashed' }}>
          <Typography color="text.secondary" gutterBottom>
            No prefetch queries defined
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Prefetch queries improve performance by loading required data upfront
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setShowTemplates(true)}
          >
            Add First Query
          </Button>
        </Paper>
      ) : (
        <>
          <Stack spacing={2}>
            {Object.entries(prefetch).map(([key, query]) => (
              <PrefetchItem
                key={key}
                queryKey={key}
                query={query}
                onChange={updateQuery}
                onDelete={() => deleteQuery(key)}
              />
            ))}
          </Stack>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => setShowTemplates(true)}
            fullWidth
            sx={{ mt: 2 }}
          >
            Add Another Query
          </Button>
        </>
      )}

      {/* Add query dialog */}
      <Dialog 
        open={showTemplates} 
        onClose={() => setShowTemplates(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Add Prefetch Query</DialogTitle>
        <DialogContent>
          <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} sx={{ mb: 2 }}>
            <Tab label="Templates" />
            <Tab label="Custom" />
          </Tabs>

          {activeTab === 0 ? (
            <Grid container spacing={2}>
              {Object.entries(QUERY_TEMPLATES).map(([key, template]) => (
                <Grid item xs={12} md={6} key={key}>
                  <Paper
                    variant="outlined"
                    sx={{ 
                      p: 2, 
                      cursor: 'pointer',
                      '&:hover': { boxShadow: 2 }
                    }}
                    onClick={() => {
                      const queryKey = template.name.toLowerCase().replace(/\s+/g, '');
                      addQuery(queryKey, template);
                    }}
                  >
                    <Typography variant="subtitle2" gutterBottom>
                      {template.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {template.description}
                    </Typography>
                    <Typography variant="caption" color="primary" sx={{ mt: 1, display: 'block' }}>
                      {template.resource}
                    </Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          ) : (
            <Box sx={{ mt: 2 }}>
              <TextField
                fullWidth
                label="Query Key"
                value={newQueryKey}
                onChange={(e) => setNewQueryKey(e.target.value)}
                placeholder="e.g., recentLabs, activeProblems"
                helperText="A unique identifier for this query"
                sx={{ mb: 2 }}
              />
              <Button
                variant="contained"
                onClick={() => addQuery(newQueryKey)}
                disabled={!newQueryKey}
                fullWidth
              >
                Create Custom Query
              </Button>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowTemplates(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PrefetchBuilderImproved;