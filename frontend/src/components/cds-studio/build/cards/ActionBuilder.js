/**
 * Action Builder - Create SMART app launch and external actions for CDS cards
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
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControlLabel,
  Switch,
  InputAdornment,
  Tooltip
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Launch as LaunchIcon,
  Apps as AppIcon,
  Calculate as CalculatorIcon,
  Description as GuidelineIcon,
  Assessment as RiskIcon,
  ExpandMore as ExpandMoreIcon,
  Help as HelpIcon,
  ContentCopy as CopyIcon,
  Code as CodeIcon
} from '@mui/icons-material';
import { v4 as uuidv4 } from 'uuid';

// Action types
const ACTION_TYPES = [
  {
    id: 'smart',
    label: 'SMART App Launch',
    icon: <AppIcon />,
    description: 'Launch a SMART on FHIR application',
    fields: ['url', 'appId', 'displayText']
  },
  {
    id: 'calculator',
    label: 'Clinical Calculator',
    icon: <CalculatorIcon />,
    description: 'Open a clinical calculator (MDCalc, etc.)',
    fields: ['url', 'calculator', 'displayText', 'params']
  },
  {
    id: 'guideline',
    label: 'Clinical Guideline',
    icon: <GuidelineIcon />,
    description: 'Link to clinical guidelines or protocols',
    fields: ['url', 'displayText', 'source']
  },
  {
    id: 'external',
    label: 'External Resource',
    icon: <LaunchIcon />,
    description: 'Open any external web resource',
    fields: ['url', 'displayText']
  }
];

// Common clinical calculators
const CLINICAL_CALCULATORS = [
  { id: 'mdcalc-cha2ds2-vasc', name: 'CHA₂DS₂-VASc Score', url: 'https://www.mdcalc.com/cha2ds2-vasc-score-atrial-fibrillation-stroke-risk' },
  { id: 'mdcalc-chads2', name: 'CHADS₂ Score', url: 'https://www.mdcalc.com/chads2-score-atrial-fibrillation-stroke-risk' },
  { id: 'mdcalc-wells-pe', name: 'Wells\' Criteria for PE', url: 'https://www.mdcalc.com/wells-criteria-pulmonary-embolism' },
  { id: 'mdcalc-framingham', name: 'Framingham Risk Score', url: 'https://www.mdcalc.com/framingham-risk-score-hard-coronary-heart-disease' },
  { id: 'mdcalc-meld', name: 'MELD Score', url: 'https://www.mdcalc.com/meld-score-model-end-stage-liver-disease' },
  { id: 'mdcalc-curb65', name: 'CURB-65 Score', url: 'https://www.mdcalc.com/curb-65-score-pneumonia-severity' }
];

// SMART app examples
const SMART_APPS = [
  { id: 'growth-chart', name: 'Pediatric Growth Chart', url: 'https://examples.smarthealthit.org/growth-chart/launch.html' },
  { id: 'cardiac-risk', name: 'Cardiac Risk', url: 'https://examples.smarthealthit.org/cardiac-risk/launch.html' },
  { id: 'diabetes-monograph', name: 'Diabetes Monograph', url: 'https://examples.smarthealthit.org/diabetes-monograph/launch.html' },
  { id: 'bp-centiles', name: 'BP Centiles', url: 'https://examples.smarthealthit.org/bp-centiles/launch.html' }
];

// Action item component
const ActionItem = ({ action, onChange, onDelete }) => {
  const [expanded, setExpanded] = useState(true);
  const actionType = ACTION_TYPES.find(t => t.id === action.type) || ACTION_TYPES[0];

  return (
    <Accordion expanded={expanded} onChange={(e, isExpanded) => setExpanded(isExpanded)}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box display="flex" alignItems="center" gap={2} width="100%">
          {actionType.icon}
          <Typography variant="subtitle2" sx={{ flex: 1 }}>
            {action.label || 'Untitled Action'}
          </Typography>
          <Chip 
            label={actionType.label} 
            size="small" 
            variant="outlined"
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
          {/* Common fields */}
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Action Label"
              value={action.label || ''}
              onChange={(e) => onChange({ ...action, label: e.target.value })}
              placeholder="e.g., Calculate Risk Score"
              required
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Button Text"
              value={action.description || ''}
              onChange={(e) => onChange({ ...action, description: e.target.value })}
              placeholder="Text shown on the action button"
            />
          </Grid>

          {/* Type-specific fields */}
          {action.type === 'smart' && (
            <>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>SMART App</InputLabel>
                  <Select
                    value={action.resource?.appId || ''}
                    onChange={(e) => {
                      const app = SMART_APPS.find(a => a.id === e.target.value);
                      onChange({
                        ...action,
                        resource: {
                          ...action.resource,
                          appId: app.id,
                          url: app.url
                        }
                      });
                    }}
                    label="SMART App"
                  >
                    <MenuItem value="">
                      <em>Custom URL</em>
                    </MenuItem>
                    {SMART_APPS.map(app => (
                      <MenuItem key={app.id} value={app.id}>
                        {app.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="App Launch URL"
                  value={action.resource?.url || ''}
                  onChange={(e) => onChange({
                    ...action,
                    resource: { ...action.resource, url: e.target.value }
                  })}
                  placeholder="https://app.example.com/launch"
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <Tooltip title="SMART app launch URL">
                          <HelpIcon fontSize="small" />
                        </Tooltip>
                      </InputAdornment>
                    )
                  }}
                />
              </Grid>
            </>
          )}

          {action.type === 'calculator' && (
            <>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Clinical Calculator</InputLabel>
                  <Select
                    value={action.resource?.calculatorId || ''}
                    onChange={(e) => {
                      const calc = CLINICAL_CALCULATORS.find(c => c.id === e.target.value);
                      onChange({
                        ...action,
                        resource: {
                          ...action.resource,
                          calculatorId: calc.id,
                          url: calc.url
                        }
                      });
                    }}
                    label="Clinical Calculator"
                  >
                    <MenuItem value="">
                      <em>Custom Calculator</em>
                    </MenuItem>
                    {CLINICAL_CALCULATORS.map(calc => (
                      <MenuItem key={calc.id} value={calc.id}>
                        {calc.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Calculator URL"
                  value={action.resource?.url || ''}
                  onChange={(e) => onChange({
                    ...action,
                    resource: { ...action.resource, url: e.target.value }
                  })}
                  placeholder="https://calculator.example.com"
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={action.resource?.prefillParams === true}
                      onChange={(e) => onChange({
                        ...action,
                        resource: { 
                          ...action.resource, 
                          prefillParams: e.target.checked 
                        }
                      })}
                    />
                  }
                  label="Pre-fill calculator with patient data"
                />
              </Grid>
            </>
          )}

          {action.type === 'guideline' && (
            <>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Guideline URL"
                  value={action.resource?.url || ''}
                  onChange={(e) => onChange({
                    ...action,
                    resource: { ...action.resource, url: e.target.value }
                  })}
                  placeholder="https://guidelines.example.com/diabetes"
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Source Organization"
                  value={action.resource?.source || ''}
                  onChange={(e) => onChange({
                    ...action,
                    resource: { ...action.resource, source: e.target.value }
                  })}
                  placeholder="e.g., ADA, ACC/AHA"
                />
              </Grid>
            </>
          )}

          {action.type === 'external' && (
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="External URL"
                value={action.resource?.url || ''}
                onChange={(e) => onChange({
                  ...action,
                  resource: { ...action.resource, url: e.target.value }
                })}
                placeholder="https://example.com/resource"
                required
              />
            </Grid>
          )}

          {/* Advanced options */}
          <Grid item xs={12}>
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle2">Advanced Options</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={action.resource?.openInNewTab !== false}
                          onChange={(e) => onChange({
                            ...action,
                            resource: { 
                              ...action.resource, 
                              openInNewTab: e.target.checked 
                            }
                          })}
                        />
                      }
                      label="Open in new tab"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Custom Parameters (JSON)"
                      multiline
                      rows={3}
                      value={action.resource?.params || ''}
                      onChange={(e) => onChange({
                        ...action,
                        resource: { ...action.resource, params: e.target.value }
                      })}
                      placeholder='{"param1": "value1", "param2": "value2"}'
                      helperText="Additional parameters to pass to the action"
                    />
                  </Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>
          </Grid>
        </Grid>
      </AccordionDetails>
    </Accordion>
  );
};

// Main component
const ActionBuilder = ({ actions = [], onChange }) => {
  const [showSelector, setShowSelector] = useState(false);

  const addAction = (type) => {
    const actionType = ACTION_TYPES.find(t => t.id === type);
    const newAction = {
      uuid: uuidv4(),
      type,
      label: actionType.label,
      description: '',
      resource: {
        openInNewTab: true
      }
    };
    onChange([...actions, newAction]);
    setShowSelector(false);
  };

  const updateAction = (index, updates) => {
    const newActions = [...actions];
    newActions[index] = { ...newActions[index], ...updates };
    onChange(newActions);
  };

  const deleteAction = (index) => {
    onChange(actions.filter((_, i) => i !== index));
  };

  return (
    <Box>
      {actions.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: 'center', borderStyle: 'dashed' }}>
          <Typography color="text.secondary" gutterBottom>
            No actions defined
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Actions let users launch apps or access external resources
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setShowSelector(true)}
            sx={{ mt: 2 }}
          >
            Add First Action
          </Button>
        </Paper>
      ) : (
        <>
          <Stack spacing={2}>
            {actions.map((action, index) => (
              <ActionItem
                key={action.uuid}
                action={action}
                onChange={(updates) => updateAction(index, updates)}
                onDelete={() => deleteAction(index)}
              />
            ))}
          </Stack>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => setShowSelector(true)}
            fullWidth
            sx={{ mt: 2 }}
          >
            Add Another Action
          </Button>
        </>
      )}

      {/* Action type selector */}
      {showSelector && (
        <Paper sx={{ mt: 3, p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Choose Action Type
          </Typography>
          <List>
            {ACTION_TYPES.map(type => (
              <ListItem
                key={type.id}
                button
                onClick={() => addAction(type.id)}
              >
                <ListItemIcon>{type.icon}</ListItemIcon>
                <ListItemText
                  primary={type.label}
                  secondary={type.description}
                />
              </ListItem>
            ))}
          </List>
          <Box mt={2} textAlign="right">
            <Button onClick={() => setShowSelector(false)}>
              Cancel
            </Button>
          </Box>
        </Paper>
      )}
    </Box>
  );
};

export default ActionBuilder;