/**
 * FHIR Explorer - Query Builder Components
 * 
 * Reusable components for building FHIR queries with educational guidance
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Tooltip,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Card,
  CardContent,
  Grid,
  Autocomplete,
  Switch,
  FormControlLabel,
  Stack,
  Divider
} from '@mui/material';
import {
  Help as HelpIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  ExpandMore as ExpandMoreIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Code as CodeIcon,
  PlayArrow as PlayIcon,
  Lightbulb as LightbulbIcon
} from '@mui/icons-material';

// FHIR Search Parameter Definitions
export const SEARCH_PARAMETERS = {
  Patient: {
    name: {
      type: 'string',
      description: 'A portion of either family or given name',
      modifiers: ['exact', 'contains'],
      examples: ['Smith', 'John', 'Mary Johnson']
    },
    given: {
      type: 'string',
      description: 'A portion of the given name',
      modifiers: ['exact', 'contains'],
      examples: ['John', 'Mary', 'Robert']
    },
    family: {
      type: 'string',
      description: 'A portion of the family name',
      modifiers: ['exact', 'contains'],
      examples: ['Smith', 'Johnson', 'Williams']
    },
    identifier: {
      type: 'token',
      description: 'A patient identifier (e.g., MRN)',
      modifiers: ['exact'],
      examples: ['12345', 'MRN|12345']
    },
    birthdate: {
      type: 'date',
      description: 'The patient\'s date of birth',
      modifiers: ['eq', 'ne', 'gt', 'ge', 'lt', 'le'],
      examples: ['1990-01-01', 'ge1980', 'le2000-12-31']
    },
    gender: {
      type: 'token',
      description: 'Gender of the patient',
      modifiers: [],
      examples: ['male', 'female', 'other', 'unknown']
    }
  },
  Observation: {
    patient: {
      type: 'reference',
      description: 'The patient that the observation is about',
      modifiers: [],
      examples: ['Patient/123', '123']
    },
    code: {
      type: 'token',
      description: 'The code of the observation type',
      modifiers: [],
      examples: ['29463-7', 'http://loinc.org|29463-7']
    },
    category: {
      type: 'token',
      description: 'The classification of the type of observation',
      modifiers: [],
      examples: ['vital-signs', 'laboratory', 'survey']
    },
    date: {
      type: 'date',
      description: 'Obtained date/time',
      modifiers: ['eq', 'ne', 'gt', 'ge', 'lt', 'le'],
      examples: ['2023-01-01', 'ge2023-01-01', 'le2023-12-31']
    },
    'value-quantity': {
      type: 'quantity',
      description: 'The value of the observation',
      modifiers: ['eq', 'ne', 'gt', 'ge', 'lt', 'le'],
      examples: ['120', 'gt100', 'le140']
    }
  },
  Condition: {
    patient: {
      type: 'reference',
      description: 'Who has the condition',
      modifiers: [],
      examples: ['Patient/123', '123']
    },
    code: {
      type: 'token',
      description: 'Code for the condition',
      modifiers: [],
      examples: ['E11.9', 'http://hl7.org/fhir/sid/icd-10-cm|E11.9']
    },
    'clinical-status': {
      type: 'token',
      description: 'The clinical status of the condition',
      modifiers: [],
      examples: ['active', 'inactive', 'resolved']
    },
    'onset-date': {
      type: 'date',
      description: 'Date the condition started',
      modifiers: ['eq', 'ne', 'gt', 'ge', 'lt', 'le'],
      examples: ['2023-01-01', 'ge2023', 'le2023-12-31']
    }
  }
};

// Query Parameter Component
export const QueryParameter = ({ 
  parameter, 
  resourceType, 
  onChange, 
  onRemove,
  showHelp = true 
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const paramDef = SEARCH_PARAMETERS[resourceType]?.[parameter.name];

  const handleChange = (field, value) => {
    onChange({ ...parameter, [field]: value });
  };

  const getInputComponent = () => {
    if (!paramDef) {
      return (
        <TextField
          label="Value"
          value={parameter.value || ''}
          onChange={(e) => handleChange('value', e.target.value)}
          size="small"
          fullWidth
        />
      );
    }

    switch (paramDef.type) {
      case 'string':
        return (
          <TextField
            label="Value"
            value={parameter.value || ''}
            onChange={(e) => handleChange('value', e.target.value)}
            placeholder={paramDef.examples[0]}
            size="small"
            fullWidth
          />
        );
      
      case 'token':
        return (
          <Autocomplete
            options={paramDef.examples}
            freeSolo
            value={parameter.value || ''}
            onChange={(event, newValue) => handleChange('value', newValue || '')}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Value"
                size="small"
                placeholder={paramDef.examples[0]}
              />
            )}
          />
        );
      
      case 'date':
        return (
          <TextField
            label="Date"
            value={parameter.value || ''}
            onChange={(e) => handleChange('value', e.target.value)}
            placeholder="YYYY-MM-DD or with prefix like ge2023"
            size="small"
            fullWidth
            helperText="Format: YYYY-MM-DD or with prefix (ge, le, gt, lt)"
          />
        );
      
      case 'reference':
        return (
          <TextField
            label="Reference"
            value={parameter.value || ''}
            onChange={(e) => handleChange('value', e.target.value)}
            placeholder="Patient/123 or just 123"
            size="small"
            fullWidth
          />
        );
      
      case 'quantity':
        return (
          <TextField
            label="Quantity"
            value={parameter.value || ''}
            onChange={(e) => handleChange('value', e.target.value)}
            placeholder="120 or gt100 or le140"
            size="small"
            fullWidth
            helperText="Number with optional prefix (gt, ge, lt, le)"
          />
        );
      
      default:
        return (
          <TextField
            label="Value"
            value={parameter.value || ''}
            onChange={(e) => handleChange('value', e.target.value)}
            size="small"
            fullWidth
          />
        );
    }
  };

  return (
    <Paper sx={{ p: 2, mb: 2 }} variant="outlined">
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
        {/* Parameter Name */}
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Parameter</InputLabel>
          <Select
            value={parameter.name || ''}
            onChange={(e) => handleChange('name', e.target.value)}
          >
            {Object.keys(SEARCH_PARAMETERS[resourceType] || {}).map(param => (
              <MenuItem key={param} value={param}>
                {param}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Modifier (if applicable) */}
        {paramDef?.modifiers?.length > 0 && (
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Modifier</InputLabel>
            <Select
              value={parameter.modifier || ''}
              onChange={(e) => handleChange('modifier', e.target.value)}
            >
              <MenuItem value="">None</MenuItem>
              {paramDef.modifiers.map(modifier => (
                <MenuItem key={modifier} value={modifier}>
                  :{modifier}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {/* Value Input */}
        <Box sx={{ flexGrow: 1 }}>
          {getInputComponent()}
        </Box>

        {/* Actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {showHelp && paramDef && (
            <Tooltip title="Show parameter details">
              <IconButton 
                size="small" 
                onClick={() => setShowDetails(!showDetails)}
                color={showDetails ? 'primary' : 'default'}
              >
                <HelpIcon />
              </IconButton>
            </Tooltip>
          )}
          <IconButton size="small" color="error" onClick={onRemove}>
            <RemoveIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Parameter Help */}
      {showDetails && paramDef && (
        <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {paramDef.description}
          </Typography>
          <Typography variant="caption" display="block" gutterBottom>
            Type: {paramDef.type}
          </Typography>
          <Typography variant="caption" display="block" gutterBottom>
            Examples: {paramDef.examples.join(', ')}
          </Typography>
          {paramDef.modifiers.length > 0 && (
            <Typography variant="caption" display="block">
              Available modifiers: {paramDef.modifiers.map(m => `:${m}`).join(', ')}
            </Typography>
          )}
        </Box>
      )}
    </Paper>
  );
};

// Query Validator Component
export const QueryValidator = ({ query, resourceType }) => {
  const [validation, setValidation] = useState({ isValid: true, errors: [], warnings: [] });

  useEffect(() => {
    validateQuery();
  }, [query, resourceType]);

  const validateQuery = () => {
    const errors = [];
    const warnings = [];

    // Basic validation
    if (!resourceType) {
      errors.push('Resource type is required');
    }

    // Parameter validation
    if (query.parameters) {
      query.parameters.forEach((param, index) => {
        if (!param.name) {
          errors.push(`Parameter ${index + 1} is missing a name`);
        }
        if (!param.value) {
          warnings.push(`Parameter ${index + 1} (${param.name}) has no value`);
        }

        // Type-specific validation
        const paramDef = SEARCH_PARAMETERS[resourceType]?.[param.name];
        if (paramDef && param.value) {
          switch (paramDef.type) {
            case 'date':
              if (!/^\d{4}(-\d{2}(-\d{2})?)?$/.test(param.value.replace(/^(ge|le|gt|lt|eq|ne)/, ''))) {
                errors.push(`Invalid date format for ${param.name}: ${param.value}`);
              }
              break;
            case 'quantity':
              if (!/^(ge|le|gt|lt|eq|ne)?\d+(\.\d+)?$/.test(param.value)) {
                warnings.push(`Quantity format may be incorrect for ${param.name}: ${param.value}`);
              }
              break;
          }
        }
      });
    }

    // Performance warnings
    if (query.parameters?.length === 0) {
      warnings.push('No search parameters - this will return all resources (may be slow)');
    }

    if (!query.count || query.count > 100) {
      warnings.push('Consider limiting results with _count parameter for better performance');
    }

    setValidation({
      isValid: errors.length === 0,
      errors,
      warnings
    });
  };

  if (validation.isValid && validation.warnings.length === 0) {
    return (
      <Alert severity="success" icon={<CheckCircleIcon />}>
        Query looks good! Ready to execute.
      </Alert>
    );
  }

  return (
    <Box>
      {validation.errors.length > 0 && (
        <Alert severity="error" sx={{ mb: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            Errors that need to be fixed:
          </Typography>
          <List dense>
            {validation.errors.map((error, index) => (
              <ListItem key={index}>
                <ListItemText primary={error} />
              </ListItem>
            ))}
          </List>
        </Alert>
      )}

      {validation.warnings.length > 0 && (
        <Alert severity="warning" icon={<WarningIcon />}>
          <Typography variant="subtitle2" gutterBottom>
            Suggestions for improvement:
          </Typography>
          <List dense>
            {validation.warnings.map((warning, index) => (
              <ListItem key={index}>
                <ListItemText primary={warning} />
              </ListItem>
            ))}
          </List>
        </Alert>
      )}
    </Box>
  );
};

// Query URL Generator Component
export const QueryURLGenerator = ({ resourceType, parameters, includes, sort, count }) => {
  const generateURL = () => {
    if (!resourceType) return '';

    let url = `/fhir/R4/${resourceType}`;
    const params = [];

    // Add search parameters
    if (parameters?.length > 0) {
      parameters.forEach(param => {
        if (param.name && param.value) {
          let paramName = param.name;
          if (param.modifier) {
            paramName += `:${param.modifier}`;
          }
          params.push(`${paramName}=${encodeURIComponent(param.value)}`);
        }
      });
    }

    // Add includes
    if (includes?.length > 0) {
      includes.forEach(include => {
        params.push(`_include=${encodeURIComponent(include)}`);
      });
    }

    // Add sort
    if (sort) {
      params.push(`_sort=${encodeURIComponent(sort)}`);
    }

    // Add count
    if (count) {
      params.push(`_count=${count}`);
    }

    if (params.length > 0) {
      url += '?' + params.join('&');
    }

    return url;
  };

  const url = generateURL();

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Generated Query URL
      </Typography>
      <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
        <Typography 
          variant="body2" 
          sx={{ 
            fontFamily: 'monospace',
            wordBreak: 'break-all',
            fontSize: '0.875rem'
          }}
        >
          {url || 'Configure parameters above to generate query'}
        </Typography>
      </Paper>
      
      {url && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Query breakdown:
          </Typography>
          <List dense>
            <ListItem>
              <ListItemIcon><CodeIcon fontSize="small" /></ListItemIcon>
              <ListItemText 
                primary="Base URL" 
                secondary={`/fhir/R4/${resourceType}`}
              />
            </ListItem>
            {parameters?.filter(p => p.name && p.value).map((param, index) => (
              <ListItem key={index}>
                <ListItemIcon><LightbulbIcon fontSize="small" /></ListItemIcon>
                <ListItemText 
                  primary={`Parameter: ${param.name}${param.modifier ? ':' + param.modifier : ''}`}
                  secondary={`Value: ${param.value}`}
                />
              </ListItem>
            ))}
          </List>
        </Box>
      )}
    </Box>
  );
};

// Quick Query Templates Component
export const QuickQueryTemplates = ({ resourceType, onSelectTemplate }) => {
  const templates = {
    Patient: [
      {
        name: 'Find by Name',
        description: 'Search patients by partial name',
        parameters: [{ name: 'name', value: 'Smith' }]
      },
      {
        name: 'Recent Patients',
        description: 'Patients updated in last 30 days',
        parameters: [{ name: '_lastUpdated', modifier: 'ge', value: new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0] }]
      }
    ],
    Observation: [
      {
        name: 'Patient Vital Signs',
        description: 'All vital signs for a patient',
        parameters: [
          { name: 'patient', value: 'Patient/123' },
          { name: 'category', value: 'vital-signs' }
        ]
      },
      {
        name: 'Recent Lab Results',
        description: 'Lab results from last week',
        parameters: [
          { name: 'category', value: 'laboratory' },
          { name: 'date', modifier: 'ge', value: new Date(Date.now() - 7*24*60*60*1000).toISOString().split('T')[0] }
        ]
      }
    ]
  };

  const resourceTemplates = templates[resourceType] || [];

  if (resourceTemplates.length === 0) {
    return null;
  }

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Quick Start Templates
      </Typography>
      <Grid container spacing={2}>
        {resourceTemplates.map((template, index) => (
          <Grid item xs={12} sm={6} key={index}>
            <Card 
              sx={{ 
                cursor: 'pointer',
                '&:hover': { elevation: 4 }
              }}
              onClick={() => onSelectTemplate(template)}
            >
              <CardContent>
                <Typography variant="subtitle1" gutterBottom>
                  {template.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {template.description}
                </Typography>
                <Box sx={{ mt: 1 }}>
                  {template.parameters.map((param, pIndex) => (
                    <Chip 
                      key={pIndex}
                      label={`${param.name}: ${param.value}`}
                      size="small"
                      sx={{ mr: 0.5, mb: 0.5 }}
                    />
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};