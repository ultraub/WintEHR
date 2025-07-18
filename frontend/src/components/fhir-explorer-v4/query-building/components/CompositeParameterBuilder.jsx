/**
 * Composite Parameter Builder Component
 * 
 * Visual interface for building composite search parameters
 * that combine multiple search parameters for correlated searches
 */

import React, { useState, useCallback } from 'react';
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
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Divider
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Merge as MergeIcon,
  Help as HelpIcon,
  Link as LinkIcon,
  DragIndicator as DragIcon,
  Info as InfoIcon
} from '@mui/icons-material';

// Example composite parameters for different resource types
const COMPOSITE_PARAMETER_EXAMPLES = {
  Observation: {
    'code-value-quantity': {
      description: 'Search for observations with specific code and numeric value',
      components: ['code', 'value-quantity'],
      example: 'code-value-quantity=http://loinc.org|2339-0$gt5.4'
    },
    'code-value-string': {
      description: 'Search for observations with specific code and string value',
      components: ['code', 'value-string'],
      example: 'code-value-string=http://loinc.org|8302-2$high'
    },
    'component-code-value-quantity': {
      description: 'Search in observation components',
      components: ['component-code', 'component-value-quantity'],
      example: 'component-code-value-quantity=http://loinc.org|8480-6$gt140'
    }
  },
  MedicationRequest: {
    'medication-strength': {
      description: 'Search for medications with specific strength',
      components: ['medication', 'dosage-instruction'],
      example: 'medication-strength=http://medication|123$500mg'
    }
  },
  Condition: {
    'code-severity': {
      description: 'Search for conditions with specific severity',
      components: ['code', 'severity'],
      example: 'code-severity=http://snomed.info/sct|73211009$severe'
    },
    'category-status': {
      description: 'Search by category and clinical status',
      components: ['category', 'clinical-status'],
      example: 'category-status=encounter-diagnosis$active'
    }
  },
  DiagnosticReport: {
    'code-result': {
      description: 'Search for reports with specific results',
      components: ['code', 'result-value'],
      example: 'code-result=http://loinc.org|58410-2$positive'
    }
  }
};

function CompositeParameterBuilder({ 
  resourceType, 
  compositeParams = [], 
  onUpdate, 
  availableSearchParams = {} 
}) {
  const [expandedParam, setExpandedParam] = useState(null);
  const [showHelp, setShowHelp] = useState(false);

  // Get composite parameters for current resource type
  const availableCompositeParams = COMPOSITE_PARAMETER_EXAMPLES[resourceType] || {};

  // Add new composite parameter
  const addCompositeParam = useCallback((paramName) => {
    const paramDef = availableCompositeParams[paramName];
    if (!paramDef) return;

    const newParam = {
      id: Date.now(),
      name: paramName,
      components: paramDef.components,
      values: new Array(paramDef.components.length).fill(''),
      description: paramDef.description
    };

    onUpdate([...compositeParams, newParam]);
    setExpandedParam(newParam.id);
  }, [availableCompositeParams, compositeParams, onUpdate]);

  // Update component value
  const updateComponentValue = useCallback((paramId, componentIndex, value) => {
    const updatedParams = compositeParams.map(param => {
      if (param.id === paramId) {
        const newValues = [...param.values];
        newValues[componentIndex] = value;
        return { ...param, values: newValues };
      }
      return param;
    });
    onUpdate(updatedParams);
  }, [compositeParams, onUpdate]);

  // Remove composite parameter
  const removeCompositeParam = useCallback((paramId) => {
    onUpdate(compositeParams.filter(param => param.id !== paramId));
  }, [compositeParams, onUpdate]);

  // Generate composite value string
  const generateCompositeValue = useCallback((param) => {
    return param.values.filter(v => v).join('$');
  }, []);

  // Render component input field
  const renderComponentField = (param, component, index) => {
    const searchParam = availableSearchParams[component];
    const paramType = searchParam?.type || 'string';
    
    return (
      <Grid item xs={12} md={6} key={component}>
        <TextField
          fullWidth
          size="small"
          label={component}
          value={param.values[index] || ''}
          onChange={(e) => updateComponentValue(param.id, index, e.target.value)}
          helperText={searchParam?.description || `Type: ${paramType}`}
          placeholder={getPlaceholderForType(paramType)}
        />
      </Grid>
    );
  };

  // Get placeholder based on parameter type
  const getPlaceholderForType = (type) => {
    switch (type) {
      case 'token':
        return 'system|code or code';
      case 'quantity':
        return 'comparatorValue (e.g., gt5.4)';
      case 'string':
        return 'text value';
      case 'reference':
        return 'Resource/id';
      case 'date':
        return 'YYYY-MM-DD';
      default:
        return 'value';
    }
  };

  if (!resourceType) {
    return (
      <Alert severity="info">
        Select a resource type to see available composite parameters
      </Alert>
    );
  }

  if (Object.keys(availableCompositeParams).length === 0) {
    return (
      <Alert severity="info">
        No composite parameters available for {resourceType}
      </Alert>
    );
  }

  return (
    <Card variant="outlined">
      <CardHeader
        title="Composite Parameters"
        subheader="Combine multiple search parameters for correlated searches"
        avatar={<MergeIcon color="primary" />}
        action={
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Help">
              <IconButton onClick={() => setShowHelp(!showHelp)} size="small">
                <HelpIcon />
              </IconButton>
            </Tooltip>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Add Composite</InputLabel>
              <Select
                value=""
                onChange={(e) => addCompositeParam(e.target.value)}
                label="Add Composite"
              >
                {Object.entries(availableCompositeParams).map(([name, def]) => (
                  <MenuItem key={name} value={name}>
                    <Box>
                      <Typography variant="body2">{name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {def.description}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        }
      />
      <CardContent>
        {showHelp && (
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              How Composite Parameters Work:
            </Typography>
            <Typography variant="body2" paragraph>
              Composite parameters allow you to search for resources where multiple conditions 
              must be true for the same item. Components are separated by $ in the query.
            </Typography>
            <Typography variant="body2">
              Example: Find observations with glucose code AND value &gt; 5.4:
              <br />
              <code>code-value-quantity=http://loinc.org|2339-0$gt5.4</code>
            </Typography>
          </Alert>
        )}

        <Stack spacing={2}>
          {compositeParams.map((param) => (
            <Paper 
              key={param.id} 
              sx={{ p: 2, bgcolor: 'background.default' }}
              variant="outlined"
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                <Box>
                  <Typography variant="subtitle1" fontWeight="medium">
                    {param.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {param.description}
                  </Typography>
                </Box>
                <IconButton
                  onClick={() => removeCompositeParam(param.id)}
                  color="error"
                  size="small"
                >
                  <DeleteIcon />
                </IconButton>
              </Box>

              <Grid container spacing={2}>
                {param.components.map((component, index) => 
                  renderComponentField(param, component, index)
                )}
              </Grid>

              {param.values.some(v => v) && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    Generated value:
                  </Typography>
                  <Paper sx={{ p: 1, bgcolor: 'grey.100', mt: 0.5 }}>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                      {param.name}={generateCompositeValue(param)}
                    </Typography>
                  </Paper>
                </Box>
              )}
            </Paper>
          ))}

          {compositeParams.length === 0 && (
            <Alert severity="info" icon={<InfoIcon />}>
              No composite parameters added. Select from the dropdown above to add composite search criteria.
            </Alert>
          )}
        </Stack>

        {/* Examples Section */}
        {Object.keys(availableCompositeParams).length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="subtitle2" gutterBottom>
              Available Composite Parameters:
            </Typography>
            <List dense>
              {Object.entries(availableCompositeParams).map(([name, def]) => (
                <ListItem key={name}>
                  <ListItemIcon>
                    <LinkIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary={name}
                    secondary={
                      <Box>
                        <Typography variant="caption" display="block">
                          {def.description}
                        </Typography>
                        <Typography variant="caption" color="primary" sx={{ fontFamily: 'monospace' }}>
                          Example: {def.example}
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

export default CompositeParameterBuilder;