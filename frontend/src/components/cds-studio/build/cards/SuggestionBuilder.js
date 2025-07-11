/**
 * Suggestion Builder - Create FHIR resource suggestions for CDS cards
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Alert,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControlLabel,
  Radio,
  RadioGroup
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Science as LabIcon,
  Medication as MedIcon,
  Assignment as TaskIcon,
  Event as AppointmentIcon,
  LocalHospital as ReferralIcon,
  Description as DocumentIcon,
  ExpandMore as ExpandMoreIcon,
  ContentCopy as CopyIcon,
  Code as CodeIcon
} from '@mui/icons-material';
import { v4 as uuidv4 } from 'uuid';

// FHIR resource templates
const RESOURCE_TEMPLATES = {
  ServiceRequest: {
    label: 'Lab/Imaging Order',
    icon: <LabIcon />,
    category: 'diagnostics',
    fields: [
      { name: 'code', label: 'Test/Procedure Code', required: true, type: 'code' },
      { name: 'priority', label: 'Priority', type: 'select', options: ['routine', 'urgent', 'asap', 'stat'] },
      { name: 'reason', label: 'Reason', type: 'text' }
    ],
    template: {
      resourceType: 'ServiceRequest',
      status: 'draft',
      intent: 'order',
      subject: { reference: 'Patient/{{context.patientId}}' },
      authoredOn: '{{timestamp}}',
      requester: { reference: 'Practitioner/{{context.userId}}' }
    }
  },
  MedicationRequest: {
    label: 'Medication Order',
    icon: <MedIcon />,
    category: 'medications',
    fields: [
      { name: 'medication', label: 'Medication', required: true, type: 'medication' },
      { name: 'dosage', label: 'Dosage Instructions', type: 'text' },
      { name: 'quantity', label: 'Quantity', type: 'number' },
      { name: 'refills', label: 'Refills', type: 'number' }
    ],
    template: {
      resourceType: 'MedicationRequest',
      status: 'draft',
      intent: 'order',
      subject: { reference: 'Patient/{{context.patientId}}' },
      authoredOn: '{{timestamp}}',
      requester: { reference: 'Practitioner/{{context.userId}}' }
    }
  },
  Task: {
    label: 'Clinical Task',
    icon: <TaskIcon />,
    category: 'workflow',
    fields: [
      { name: 'description', label: 'Task Description', required: true, type: 'text' },
      { name: 'priority', label: 'Priority', type: 'select', options: ['routine', 'urgent', 'asap', 'stat'] },
      { name: 'performer', label: 'Assign To', type: 'text' }
    ],
    template: {
      resourceType: 'Task',
      status: 'draft',
      intent: 'order',
      for: { reference: 'Patient/{{context.patientId}}' },
      authoredOn: '{{timestamp}}',
      requester: { reference: 'Practitioner/{{context.userId}}' }
    }
  },
  Appointment: {
    label: 'Appointment',
    icon: <AppointmentIcon />,
    category: 'scheduling',
    fields: [
      { name: 'serviceType', label: 'Appointment Type', required: true, type: 'text' },
      { name: 'duration', label: 'Duration (minutes)', type: 'number', default: 30 },
      { name: 'comment', label: 'Notes', type: 'text' }
    ],
    template: {
      resourceType: 'Appointment',
      status: 'proposed',
      participant: [
        { 
          actor: { reference: 'Patient/{{context.patientId}}' },
          status: 'needs-action'
        }
      ]
    }
  },
  ServiceRequest_Referral: {
    label: 'Referral',
    icon: <ReferralIcon />,
    category: 'referrals',
    fields: [
      { name: 'specialty', label: 'Specialty', required: true, type: 'text' },
      { name: 'reason', label: 'Reason for Referral', type: 'text' },
      { name: 'priority', label: 'Priority', type: 'select', options: ['routine', 'urgent'] }
    ],
    template: {
      resourceType: 'ServiceRequest',
      status: 'draft',
      intent: 'order',
      category: [{
        coding: [{
          system: 'http://snomed.info/sct',
          code: '306206005',
          display: 'Referral'
        }]
      }],
      subject: { reference: 'Patient/{{context.patientId}}' },
      authoredOn: '{{timestamp}}',
      requester: { reference: 'Practitioner/{{context.userId}}' }
    }
  }
};

// Common lab tests
const COMMON_LAB_TESTS = [
  { code: '4548-4', display: 'Hemoglobin A1c' },
  { code: '2160-0', display: 'Creatinine' },
  { code: '2345-7', display: 'Glucose' },
  { code: '718-7', display: 'White Blood Cell Count' },
  { code: '789-8', display: 'Hemoglobin' }
];

// Suggestion item component
const SuggestionItem = ({ suggestion, onChange, onDelete }) => {
  const [expanded, setExpanded] = useState(true);
  const template = RESOURCE_TEMPLATES[suggestion.resourceType];

  return (
    <Accordion expanded={expanded} onChange={(e, isExpanded) => setExpanded(isExpanded)}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box display="flex" alignItems="center" gap={2} width="100%">
          {template?.icon}
          <Typography variant="subtitle2" sx={{ flex: 1 }}>
            {suggestion.label || template?.label || 'Untitled Suggestion'}
          </Typography>
          <Chip 
            label={suggestion.resourceType} 
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
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Suggestion Label"
              value={suggestion.label || ''}
              onChange={(e) => onChange({ ...suggestion, label: e.target.value })}
              placeholder="e.g., Order HbA1c test"
            />
          </Grid>
          
          {template?.fields.map(field => (
            <Grid item xs={12} md={field.type === 'text' ? 12 : 6} key={field.name}>
              {field.type === 'select' ? (
                <FormControl fullWidth>
                  <InputLabel>{field.label}</InputLabel>
                  <Select
                    value={suggestion.resource?.[field.name] || ''}
                    onChange={(e) => onChange({
                      ...suggestion,
                      resource: {
                        ...suggestion.resource,
                        [field.name]: e.target.value
                      }
                    })}
                    label={field.label}
                  >
                    {field.options.map(opt => (
                      <MenuItem key={opt} value={opt}>
                        {opt.charAt(0).toUpperCase() + opt.slice(1)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              ) : field.type === 'code' ? (
                <FormControl fullWidth>
                  <InputLabel>{field.label}</InputLabel>
                  <Select
                    value={suggestion.resource?.code?.coding?.[0]?.code || ''}
                    onChange={(e) => {
                      const selected = COMMON_LAB_TESTS.find(t => t.code === e.target.value);
                      onChange({
                        ...suggestion,
                        resource: {
                          ...suggestion.resource,
                          code: {
                            coding: [{
                              system: 'http://loinc.org',
                              code: selected.code,
                              display: selected.display
                            }]
                          }
                        }
                      });
                    }}
                    label={field.label}
                  >
                    {COMMON_LAB_TESTS.map(test => (
                      <MenuItem key={test.code} value={test.code}>
                        {test.display}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              ) : (
                <TextField
                  fullWidth
                  label={field.label}
                  type={field.type}
                  value={suggestion.resource?.[field.name] || field.default || ''}
                  onChange={(e) => onChange({
                    ...suggestion,
                    resource: {
                      ...suggestion.resource,
                      [field.name]: e.target.value
                    }
                  })}
                  required={field.required}
                />
              )}
            </Grid>
          ))}

          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Radio
                  checked={suggestion.isRecommended === true}
                  onChange={(e) => onChange({
                    ...suggestion,
                    isRecommended: e.target.checked
                  })}
                />
              }
              label="Mark as recommended (pre-selected)"
            />
          </Grid>

          {/* Show resource preview */}
          <Grid item xs={12}>
            <Accordion>
              <AccordionSummary expandIcon={<CodeIcon />}>
                <Typography variant="caption">View FHIR Resource</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Paper sx={{ p: 2, backgroundColor: 'grey.100' }}>
                  <pre style={{ margin: 0, fontSize: '0.8rem' }}>
                    {JSON.stringify({
                      ...template.template,
                      ...suggestion.resource
                    }, null, 2)}
                  </pre>
                </Paper>
              </AccordionDetails>
            </Accordion>
          </Grid>
        </Grid>
      </AccordionDetails>
    </Accordion>
  );
};

// Main component
const SuggestionBuilder = ({ suggestions = [], onChange }) => {
  const [showSelector, setShowSelector] = useState(false);

  const addSuggestion = (resourceType) => {
    const template = RESOURCE_TEMPLATES[resourceType];
    const newSuggestion = {
      uuid: uuidv4(),
      label: template.label,
      resourceType,
      resource: {}
    };
    onChange([...suggestions, newSuggestion]);
    setShowSelector(false);
  };

  const updateSuggestion = (index, updates) => {
    const newSuggestions = [...suggestions];
    newSuggestions[index] = { ...newSuggestions[index], ...updates };
    onChange(newSuggestions);
  };

  const deleteSuggestion = (index) => {
    onChange(suggestions.filter((_, i) => i !== index));
  };

  return (
    <Box>
      {suggestions.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: 'center', borderStyle: 'dashed' }}>
          <Typography color="text.secondary" gutterBottom>
            No suggestions defined
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setShowSelector(true)}
            sx={{ mt: 2 }}
          >
            Add First Suggestion
          </Button>
        </Paper>
      ) : (
        <>
          <Stack spacing={2}>
            {suggestions.map((suggestion, index) => (
              <SuggestionItem
                key={suggestion.uuid}
                suggestion={suggestion}
                onChange={(updates) => updateSuggestion(index, updates)}
                onDelete={() => deleteSuggestion(index)}
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
            Add Another Suggestion
          </Button>
        </>
      )}

      {/* Resource type selector */}
      {showSelector && (
        <Paper sx={{ mt: 3, p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Choose Resource Type
          </Typography>
          <List>
            {Object.entries(RESOURCE_TEMPLATES).map(([key, template]) => (
              <ListItem
                key={key}
                button
                onClick={() => addSuggestion(key)}
              >
                <ListItemIcon>{template.icon}</ListItemIcon>
                <ListItemText
                  primary={template.label}
                  secondary={`Create ${key} resource`}
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

export default SuggestionBuilder;