/**
 * Chained Parameter Builder Component
 * 
 * Visual interface for building chained search parameters
 * that traverse references between resources
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Card,
  CardHeader,
  CardContent,
  Typography,
  Button,
  IconButton,
  TextField,
  Stack,
  Paper,
  Grid,
  Chip,
  Alert,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Link as LinkIcon,
  Help as HelpIcon,
  ChevronRight as ChevronIcon,
  Info as InfoIcon,
  AccountTree as TreeIcon
} from '@mui/icons-material';

import { FHIR_RESOURCES } from '../../constants/fhirResources';

// Common chaining patterns
const CHAINING_EXAMPLES = {
  Patient: [
    {
      chain: 'general-practitioner.name',
      description: 'Find patients by their GP\'s name',
      example: 'general-practitioner.name=Smith'
    },
    {
      chain: 'organization.name',
      description: 'Find patients by organization name',
      example: 'organization.name=Acme%20Hospital'
    }
  ],
  Observation: [
    {
      chain: 'patient.name',
      description: 'Find observations by patient name',
      example: 'patient.name=John'
    },
    {
      chain: 'performer.practitioner.name',
      description: 'Find observations by performer name',
      example: 'performer.practitioner.name=Dr%20Smith'
    },
    {
      chain: 'encounter.location.name',
      description: 'Find observations by encounter location',
      example: 'encounter.location.name=ER'
    }
  ],
  MedicationRequest: [
    {
      chain: 'patient.birthdate',
      description: 'Find medications by patient birth date',
      example: 'patient.birthdate=1990-01-01'
    },
    {
      chain: 'requester.practitioner.identifier',
      description: 'Find medications by prescriber ID',
      example: 'requester.practitioner.identifier=12345'
    }
  ],
  Encounter: [
    {
      chain: 'patient.gender',
      description: 'Find encounters by patient gender',
      example: 'patient.gender=female'
    },
    {
      chain: 'location.location.type',
      description: 'Find encounters by location type',
      example: 'location.location.type=ICU'
    }
  ]
};

function ChainedParameterBuilder({ 
  resourceType, 
  chainedParams = [], 
  onUpdate 
}) {
  const [showHelp, setShowHelp] = useState(false);
  const [expandedParam, setExpandedParam] = useState(null);

  // Get reference parameters for current resource
  const referenceParams = useMemo(() => {
    if (!resourceType || !FHIR_RESOURCES[resourceType]) return {};
    
    const params = FHIR_RESOURCES[resourceType].searchParams || {};
    return Object.entries(params)
      .filter(([_, param]) => param.type === 'reference')
      .reduce((acc, [name, param]) => ({ ...acc, [name]: param }), {});
  }, [resourceType]);

  // Get searchable parameters for a target resource
  const getTargetSearchParams = useCallback((targetResourceType) => {
    if (!targetResourceType || !FHIR_RESOURCES[targetResourceType]) return [];
    
    const params = FHIR_RESOURCES[targetResourceType].searchParams || {};
    return Object.entries(params)
      .filter(([_, param]) => ['string', 'token', 'date', 'number'].includes(param.type))
      .map(([name, param]) => ({ name, ...param }));
  }, []);

  // Add new chained parameter
  const addChainedParam = useCallback(() => {
    const newParam = {
      id: Date.now(),
      referenceParam: '',
      targetResource: '',
      targetParam: '',
      value: '',
      chain: []
    };
    onUpdate([...chainedParams, newParam]);
    setExpandedParam(newParam.id);
  }, [chainedParams, onUpdate]);

  // Update chained parameter
  const updateChainedParam = useCallback((paramId, updates) => {
    const updatedParams = chainedParams.map(param => 
      param.id === paramId ? { ...param, ...updates } : param
    );
    onUpdate(updatedParams);
  }, [chainedParams, onUpdate]);

  // Remove chained parameter
  const removeChainedParam = useCallback((paramId) => {
    onUpdate(chainedParams.filter(param => param.id !== paramId));
  }, [chainedParams, onUpdate]);

  // Build chain string
  const buildChainString = useCallback((param) => {
    const parts = [param.referenceParam];
    if (param.targetParam) {
      parts.push(param.targetParam);
    }
    param.chain.forEach(link => {
      if (link.param) parts.push(link.param);
    });
    return parts.join('.');
  }, []);

  // Get target resource type from reference parameter
  const getTargetResourceType = useCallback((refParam) => {
    if (!refParam || !referenceParams[refParam]) return null;
    
    const targetRef = referenceParams[refParam].target;
    if (typeof targetRef === 'string') return targetRef;
    if (Array.isArray(targetRef) && targetRef.length > 0) return targetRef[0];
    return null;
  }, [referenceParams]);

  if (!resourceType) {
    return (
      <Alert severity="info">
        Select a resource type to see available chained parameters
      </Alert>
    );
  }

  if (Object.keys(referenceParams).length === 0) {
    return (
      <Alert severity="info">
        No reference parameters available for {resourceType}
      </Alert>
    );
  }

  return (
    <Card variant="outlined">
      <CardHeader
        title="Chained Parameters"
        subheader="Search through referenced resources"
        avatar={<TreeIcon color="primary" />}
        action={
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Help">
              <IconButton onClick={() => setShowHelp(!showHelp)} size="small">
                <HelpIcon />
              </IconButton>
            </Tooltip>
            <Button
              startIcon={<AddIcon />}
              onClick={addChainedParam}
              size="small"
              variant="outlined"
            >
              Add Chain
            </Button>
          </Box>
        }
      />
      <CardContent>
        {showHelp && (
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              How Chained Parameters Work:
            </Typography>
            <Typography variant="body2" paragraph>
              Chained parameters allow you to search through references. For example, 
              find all Observations for patients named "John" using: patient.name=John
            </Typography>
            <Typography variant="body2">
              You can chain multiple levels deep: encounter.location.name=ER
            </Typography>
          </Alert>
        )}

        <Stack spacing={2}>
          {chainedParams.map((param) => (
            <Paper 
              key={param.id} 
              sx={{ p: 2, bgcolor: 'background.default' }}
              variant="outlined"
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="subtitle2" color="primary">
                  Chain: {buildChainString(param) || 'Configure chain below'}
                </Typography>
                <IconButton
                  onClick={() => removeChainedParam(param.id)}
                  color="error"
                  size="small"
                >
                  <DeleteIcon />
                </IconButton>
              </Box>

              <Grid container spacing={2} alignItems="center">
                {/* Reference Parameter */}
                <Grid item xs={12} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Reference Parameter</InputLabel>
                    <Select
                      value={param.referenceParam}
                      onChange={(e) => {
                        const targetType = getTargetResourceType(e.target.value);
                        updateChainedParam(param.id, {
                          referenceParam: e.target.value,
                          targetResource: targetType,
                          targetParam: '',
                          chain: []
                        });
                      }}
                      label="Reference Parameter"
                    >
                      {Object.entries(referenceParams).map(([name, ref]) => (
                        <MenuItem key={name} value={name}>
                          <Box>
                            <Typography variant="body2">{name}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              → {ref.target}
                            </Typography>
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={1} sx={{ textAlign: 'center' }}>
                  <ChevronIcon />
                </Grid>

                {/* Target Parameter */}
                <Grid item xs={12} md={3}>
                  <Autocomplete
                    size="small"
                    value={param.targetParam}
                    onChange={(e, value) => updateChainedParam(param.id, { targetParam: value })}
                    options={param.targetResource ? getTargetSearchParams(param.targetResource).map(p => p.name) : []}
                    disabled={!param.targetResource}
                    renderInput={(params) => (
                      <TextField {...params} label="Target Parameter" />
                    )}
                  />
                </Grid>

                <Grid item xs={12} md={1} sx={{ textAlign: 'center' }}>
                  =
                </Grid>

                {/* Value */}
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Value"
                    value={param.value}
                    onChange={(e) => updateChainedParam(param.id, { value: e.target.value })}
                    disabled={!param.targetParam}
                  />
                </Grid>
              </Grid>

              {/* Generated chain */}
              {param.referenceParam && param.targetParam && param.value && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    Generated parameter:
                  </Typography>
                  <Paper sx={{ p: 1, bgcolor: 'grey.100', mt: 0.5 }}>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                      {buildChainString(param)}={param.value}
                    </Typography>
                  </Paper>
                </Box>
              )}
            </Paper>
          ))}

          {chainedParams.length === 0 && (
            <Alert severity="info" icon={<InfoIcon />}>
              No chained parameters added. Click "Add Chain" to search through referenced resources.
            </Alert>
          )}
        </Stack>

        {/* Examples Section */}
        {CHAINING_EXAMPLES[resourceType] && (
          <Box sx={{ mt: 3 }}>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="subtitle2" gutterBottom>
              Common Chaining Patterns for {resourceType}:
            </Typography>
            <List dense>
              {CHAINING_EXAMPLES[resourceType].map((example, index) => (
                <ListItem key={index}>
                  <ListItemIcon>
                    <LinkIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary={example.chain}
                    secondary={
                      <Box>
                        <Typography variant="caption" display="block">
                          {example.description}
                        </Typography>
                        <Typography variant="caption" color="primary" sx={{ fontFamily: 'monospace' }}>
                          Example: {example.example}
                        </Typography>
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

export default ChainedParameterBuilder;