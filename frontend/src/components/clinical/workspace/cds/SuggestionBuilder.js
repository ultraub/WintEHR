/**
 * Suggestion Builder Component
 * Interface for building actionable suggestions within CDS cards
 */
import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Grid,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip,
  Card,
  CardContent,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  Code as CodeIcon,
  ContentCopy as CopyIcon,
  Build as BuildIcon,
  Edit as EditIcon
} from '@mui/icons-material';
import { cdsClinicalDataService } from '../../../../services/cdsClinicalDataService';

const ACTION_TYPES = [
  { value: 'create', label: 'Create Resource', description: 'Create a new FHIR resource' },
  { value: 'update', label: 'Update Resource', description: 'Update an existing FHIR resource' },
  { value: 'delete', label: 'Delete Resource', description: 'Delete a FHIR resource' },
  { value: 'external', label: 'External Action', description: 'Open external link or app' }
];

const RESOURCE_TYPES = [
  'MedicationRequest',
  'ServiceRequest',
  'Procedure',
  'Observation',
  'Condition',
  'CarePlan',
  'Goal',
  'Task',
  'Appointment'
];

const SuggestionBuilder = ({ suggestions = [], onChange }) => {
  const [expandedSuggestion, setExpandedSuggestion] = useState(null);

  const addSuggestion = () => {
    const newSuggestion = {
      id: Date.now(),
      label: '',
      uuid: `suggestion-${Date.now()}`,
      isRecommended: true,
      actions: []
    };
    onChange([...suggestions, newSuggestion]);
    setExpandedSuggestion(newSuggestion.id);
  };

  const updateSuggestion = (suggestionId, updates) => {
    const updated = suggestions.map(suggestion =>
      suggestion.id === suggestionId ? { ...suggestion, ...updates } : suggestion
    );
    onChange(updated);
  };

  const removeSuggestion = (suggestionId) => {
    const updated = suggestions.filter(s => s.id !== suggestionId);
    onChange(updated);
  };

  const addAction = (suggestionId) => {
    const suggestion = suggestions.find(s => s.id === suggestionId);
    if (!suggestion) return;

    const newAction = {
      id: Date.now(),
      type: 'create',
      description: '',
      resource: null
    };

    updateSuggestion(suggestionId, {
      actions: [...(suggestion.actions || []), newAction]
    });
  };

  const updateAction = (suggestionId, actionId, updates) => {
    const suggestion = suggestions.find(s => s.id === suggestionId);
    if (!suggestion) return;

    const updatedActions = suggestion.actions.map(action =>
      action.id === actionId ? { ...action, ...updates } : action
    );

    updateSuggestion(suggestionId, { actions: updatedActions });
  };

  const removeAction = (suggestionId, actionId) => {
    const suggestion = suggestions.find(s => s.id === suggestionId);
    if (!suggestion) return;

    const updatedActions = suggestion.actions.filter(a => a.id !== actionId);
    updateSuggestion(suggestionId, { actions: updatedActions });
  };

  const generateResourceTemplate = (resourceType) => {
    const templates = {
      MedicationRequest: {
        resourceType: 'MedicationRequest',
        status: 'draft',
        intent: 'order',
        subject: { reference: 'Patient/{{patientId}}' },
        medicationCodeableConcept: {
          coding: [{
            system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
            code: '',
            display: ''
          }]
        },
        dosageInstruction: [{
          text: '',
          timing: {
            repeat: {
              frequency: 1,
              period: 1,
              periodUnit: 'd'
            }
          }
        }]
      },
      ServiceRequest: {
        resourceType: 'ServiceRequest',
        status: 'draft',
        intent: 'order',
        subject: { reference: 'Patient/{{patientId}}' },
        code: {
          coding: [{
            system: 'http://loinc.org',
            code: '',
            display: ''
          }]
        },
        occurrenceDateTime: new Date().toISOString()
      },
      Observation: {
        resourceType: 'Observation',
        status: 'preliminary',
        code: {
          coding: [{
            system: 'http://loinc.org',
            code: '',
            display: ''
          }]
        },
        subject: { reference: 'Patient/{{patientId}}' },
        effectiveDateTime: new Date().toISOString(),
        valueQuantity: {
          value: 0,
          unit: '',
          system: 'http://unitsofmeasure.org',
          code: ''
        }
      }
    };

    return templates[resourceType] || { resourceType };
  };

  const renderActionBuilder = (suggestion, action) => (
    <Card variant="outlined" sx={{ mb: 1 }}>
      <CardContent>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Action Type</InputLabel>
              <Select
                value={action.type}
                label="Action Type"
                onChange={(e) => updateAction(suggestion.id, action.id, { type: e.target.value })}
              >
                {ACTION_TYPES.map(type => (
                  <MenuItem key={type.value} value={type.value}>
                    <Stack>
                      <Typography key={`${type.value}-label`} variant="body2">{type.label}</Typography>
                      <Typography key={`${type.value}-desc`} variant="caption" color="text.secondary">
                        {type.description}
                      </Typography>
                    </Stack>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={8}>
            <TextField
              fullWidth
              size="small"
              label="Action Description"
              value={action.description || ''}
              onChange={(e) => updateAction(suggestion.id, action.id, { description: e.target.value })}
              placeholder="Brief description of what this action does"
            />
          </Grid>

          {action.type === 'create' && (
            <Grid item xs={12}>
              <Stack spacing={1}>
                <FormControl fullWidth size="small">
                  <InputLabel>Resource Type</InputLabel>
                  <Select
                    value={action.resource?.resourceType || ''}
                    label="Resource Type"
                    onChange={(e) => {
                      const template = generateResourceTemplate(e.target.value);
                      updateAction(suggestion.id, action.id, { resource: template });
                    }}
                  >
                    {RESOURCE_TYPES.map(type => (
                      <MenuItem key={type} value={type}>{type}</MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {action.resource && (
                  <Box>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        Resource Template (JSON)
                      </Typography>
                      <Tooltip title="Copy JSON">
                        <IconButton 
                          size="small"
                          onClick={() => navigator.clipboard.writeText(JSON.stringify(action.resource, null, 2))}
                        >
                          <CopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                    <TextField
                      fullWidth
                      multiline
                      rows={6}
                      size="small"
                      value={JSON.stringify(action.resource, null, 2)}
                      onChange={(e) => {
                        try {
                          const parsed = JSON.parse(e.target.value);
                          updateAction(suggestion.id, action.id, { resource: parsed });
                        } catch (err) {
                          // Invalid JSON, don't update
                        }
                      }}
                      sx={{
                        '& .MuiInputBase-input': {
                          fontFamily: 'monospace',
                          fontSize: '0.875rem'
                        }
                      }}
                    />
                  </Box>
                )}
              </Stack>
            </Grid>
          )}

          {action.type === 'external' && (
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="External URL"
                value={action.url || ''}
                onChange={(e) => updateAction(suggestion.id, action.id, { url: e.target.value })}
                placeholder="https://example.com/action"
              />
            </Grid>
          )}

          <Grid item xs={12}>
            <Stack direction="row" justifyContent="flex-end">
              <IconButton 
                color="error" 
                size="small"
                onClick={() => removeAction(suggestion.id, action.id)}
              >
                <DeleteIcon />
              </IconButton>
            </Stack>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );

  return (
    <Paper elevation={1} sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Suggestion Builder</Typography>
          <Button 
            startIcon={<AddIcon />} 
            onClick={addSuggestion}
            variant="outlined"
          >
            Add Suggestion
          </Button>
        </Stack>

        {suggestions.length === 0 ? (
          <Alert severity="info">
            No suggestions defined. Suggestions provide actionable recommendations to clinicians.
          </Alert>
        ) : (
          suggestions.map((suggestion) => (
            <Accordion 
              key={suggestion.id}
              expanded={expandedSuggestion === suggestion.id}
              onChange={() => setExpandedSuggestion(
                expandedSuggestion === suggestion.id ? null : suggestion.id
              )}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Stack direction="row" spacing={2} alignItems="center" sx={{ width: '100%' }}>
                  <BuildIcon color="primary" />
                  <Typography sx={{ flexGrow: 1 }}>
                    {suggestion.label || 'Untitled Suggestion'}
                  </Typography>
                  {suggestion.isRecommended && (
                    <Chip label="Recommended" size="small" color="primary" />
                  )}
                  <Chip 
                    label={`${(suggestion.actions || []).length} actions`} 
                    size="small" 
                    variant="outlined"
                  />
                </Stack>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={2}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={8}>
                      <TextField
                        fullWidth
                        label="Suggestion Label"
                        value={suggestion.label}
                        onChange={(e) => updateSuggestion(suggestion.id, { label: e.target.value })}
                        placeholder="e.g., Order follow-up lab test"
                      />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={suggestion.isRecommended}
                            onChange={(e) => updateSuggestion(suggestion.id, { 
                              isRecommended: e.target.checked 
                            })}
                          />
                        }
                        label="Recommended"
                      />
                    </Grid>
                  </Grid>

                  <Box>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                      <Typography variant="subtitle2">Actions</Typography>
                      <Button 
                        size="small" 
                        startIcon={<AddIcon />}
                        onClick={() => addAction(suggestion.id)}
                      >
                        Add Action
                      </Button>
                    </Stack>

                    {(!suggestion.actions || suggestion.actions.length === 0) ? (
                      <Alert severity="warning" variant="outlined">
                        No actions defined. Add at least one action for this suggestion.
                      </Alert>
                    ) : (
                      suggestion.actions.map(action => (
                        <Box key={action.id}>
                          {renderActionBuilder(suggestion, action)}
                        </Box>
                      ))
                    )}
                  </Box>

                  <Stack direction="row" justifyContent="flex-end">
                    <Button
                      color="error"
                      startIcon={<DeleteIcon />}
                      onClick={() => removeSuggestion(suggestion.id)}
                    >
                      Remove Suggestion
                    </Button>
                  </Stack>
                </Stack>
              </AccordionDetails>
            </Accordion>
          ))
        )}
      </Stack>
    </Paper>
  );
};

export default SuggestionBuilder;