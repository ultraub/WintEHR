/**
 * Prefetch Builder - Visual interface for building prefetch queries
 */

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Alert,
  Chip,
  Stack,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Code as CodeIcon,
  Help as HelpIcon
} from '@mui/icons-material';

// Common prefetch templates based on hook type
const PREFETCH_TEMPLATES = {
  'patient-view': [
    { key: 'patient', query: 'Patient/{{context.patientId}}' },
    { key: 'conditions', query: 'Condition?patient={{context.patientId}}' },
    { key: 'medications', query: 'MedicationRequest?patient={{context.patientId}}&status=active' }
  ],
  'medication-prescribe': [
    { key: 'patient', query: 'Patient/{{context.patientId}}' },
    { key: 'activeMedications', query: 'MedicationRequest?patient={{context.patientId}}&status=active' },
    { key: 'allergies', query: 'AllergyIntolerance?patient={{context.patientId}}' }
  ],
  'order-sign': [
    { key: 'patient', query: 'Patient/{{context.patientId}}' },
    { key: 'draftOrders', query: 'ServiceRequest?patient={{context.patientId}}&status=draft' }
  ]
};

const PrefetchBuilder = ({ prefetch = {}, onChange, hookType }) => {
  const [newKey, setNewKey] = useState('');
  const [newQuery, setNewQuery] = useState('');
  const [showHelp, setShowHelp] = useState(false);

  const addPrefetch = () => {
    if (newKey && newQuery) {
      onChange({
        ...prefetch,
        [newKey]: newQuery
      });
      setNewKey('');
      setNewQuery('');
    }
  };

  const removePrefetch = (key) => {
    const updated = { ...prefetch };
    delete updated[key];
    onChange(updated);
  };

  const applyTemplate = (template) => {
    onChange({
      ...prefetch,
      [template.key]: template.query
    });
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Prefetch Queries</Typography>
        <Tooltip title="Help">
          <IconButton onClick={() => setShowHelp(!showHelp)} size="small">
            <HelpIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {showHelp && (
        <Alert severity="info" sx={{ mb: 2 }} onClose={() => setShowHelp(false)}>
          <Typography variant="subtitle2" gutterBottom>
            Prefetch allows you to request data before your hook executes.
          </Typography>
          <Typography variant="body2">
            • Use context variables like {`{{context.patientId}}`}<br />
            • Define FHIR queries to fetch needed resources<br />
            • Data will be available in your hook logic
          </Typography>
        </Alert>
      )}

      {/* Templates */}
      {PREFETCH_TEMPLATES[hookType] && (
        <Box mb={3}>
          <Typography variant="subtitle2" gutterBottom>
            Quick Templates:
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {PREFETCH_TEMPLATES[hookType].map((template, index) => (
              <Chip
                key={index}
                label={template.key}
                onClick={() => applyTemplate(template)}
                clickable
                size="small"
                icon={<AddIcon />}
              />
            ))}
          </Stack>
        </Box>
      )}

      {/* Existing Prefetch Queries */}
      {Object.keys(prefetch).length > 0 ? (
        <List>
          {Object.entries(prefetch).map(([key, query]) => (
            <ListItem key={key}>
              <ListItemText
                primary={key}
                secondary={
                  <Typography variant="body2" component="span" sx={{ fontFamily: 'monospace' }}>
                    {query}
                  </Typography>
                }
              />
              <ListItemSecondaryAction>
                <IconButton edge="end" onClick={() => removePrefetch(key)}>
                  <DeleteIcon />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      ) : (
        <Alert severity="info" sx={{ mb: 2 }}>
          No prefetch queries defined. Add queries to fetch data before hook execution.
        </Alert>
      )}

      {/* Add New Prefetch */}
      <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Add Prefetch Query
        </Typography>
        <Stack spacing={2}>
          <TextField
            fullWidth
            label="Key"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder="e.g., patient, medications"
            size="small"
          />
          <TextField
            fullWidth
            label="FHIR Query"
            value={newQuery}
            onChange={(e) => setNewQuery(e.target.value)}
            placeholder="e.g., Patient/{{context.patientId}}"
            size="small"
            multiline
            rows={2}
          />
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={addPrefetch}
            disabled={!newKey || !newQuery}
          >
            Add Prefetch
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
};

export default PrefetchBuilder;