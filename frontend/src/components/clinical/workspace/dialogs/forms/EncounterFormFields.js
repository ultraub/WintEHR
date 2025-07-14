/**
 * EncounterFormFields Component
 * Form fields for encounter creation and editing using BaseResourceDialog
 */
import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Autocomplete,
  Chip,
  Stack
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import {
  ENCOUNTER_TYPES,
  ENCOUNTER_STATUS_OPTIONS,
  PRIORITY_LEVELS,
  ENCOUNTER_LOCATIONS,
  ENCOUNTER_TEMPLATES
} from '../config/encounterDialogConfig';

const PROVIDER_TEMPLATES = [
  'Dr. Sarah Johnson, MD',
  'Dr. Michael Chen, MD',
  'Dr. Emily Rodriguez, MD',
  'Dr. James Wilson, MD',
  'Dr. Lisa Thompson, NP',
  'Dr. Robert Kim, PA-C'
];

const EncounterFormFields = ({ 
  formData = {}, 
  errors = {}, 
  onChange, 
  disabled = false,
  activeStep = 0
}) => {
  // Safe defaults to prevent undefined values
  const safeFormData = {
    selectedTemplate: formData.selectedTemplate || '',
    type: formData.type || 'AMB',
    reasonForVisit: formData.reasonForVisit || '',
    chiefComplaint: formData.chiefComplaint || '',
    provider: formData.provider || '',
    location: formData.location || 'main-clinic',
    scheduledDate: formData.scheduledDate || new Date().toISOString().split('T')[0],
    scheduledTime: formData.scheduledTime || new Date().toTimeString().split(' ')[0].slice(0, 5),
    duration: formData.duration || 30,
    priority: formData.priority || 'routine',
    status: formData.status || 'planned',
    checklist: formData.checklist || [],
    expectedOrders: formData.expectedOrders || [],
    notes: formData.notes || ''
  };

  const applyTemplate = (templateKey) => {
    const template = ENCOUNTER_TEMPLATES[templateKey];
    if (!template) return;

    onChange('selectedTemplate', templateKey);
    onChange('type', template.type);
    onChange('reasonForVisit', template.reasonForVisit);
    onChange('chiefComplaint', template.chiefComplaint);
    onChange('duration', template.duration);
    onChange('checklist', [...template.checklist]);
    onChange('expectedOrders', [...template.expectedOrders]);
  };

  const renderStep = () => {
    switch (activeStep) {
      case 0: // Basic Information
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Choose Encounter Template (Optional)
            </Typography>
            <Grid container spacing={2} sx={{ mb: 3 }}>
              {Object.entries(ENCOUNTER_TEMPLATES).map(([key, template]) => (
                <Grid item xs={12} md={6} key={key}>
                  <Card 
                    sx={{ 
                      cursor: disabled ? 'default' : 'pointer',
                      border: safeFormData.selectedTemplate === key ? 2 : 1,
                      borderColor: safeFormData.selectedTemplate === key ? 'primary.main' : 'divider',
                      opacity: disabled ? 0.6 : 1
                    }}
                    onClick={() => !disabled && applyTemplate(key)}
                  >
                    <CardContent>
                      <Typography variant="subtitle1" fontWeight="bold">
                        {template.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Duration: {template.duration} minutes
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        {template.reasonForVisit}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>

            <Typography variant="h6" gutterBottom>
              Basic Details
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth error={!!errors.type}>
                  <InputLabel>Encounter Type</InputLabel>
                  <Select
                    value={safeFormData.type}
                    onChange={(e) => onChange('type', e.target.value)}
                    label="Encounter Type"
                    disabled={disabled}
                  >
                    {ENCOUNTER_TYPES.map((type) => (
                      <MenuItem key={type.value} value={type.value}>
                        {type.display} - {type.description}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  label="Duration (minutes)"
                  type="number"
                  value={safeFormData.duration}
                  onChange={(e) => onChange('duration', parseInt(e.target.value) || 30)}
                  inputProps={{ min: 5, max: 480, step: 5 }}
                  disabled={disabled}
                  error={!!errors.duration}
                  helperText={errors.duration}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Priority</InputLabel>
                  <Select
                    value={safeFormData.priority}
                    onChange={(e) => onChange('priority', e.target.value)}
                    label="Priority"
                    disabled={disabled}
                  >
                    {PRIORITY_LEVELS.map((priority) => (
                      <MenuItem key={priority.value} value={priority.value}>
                        {priority.display}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Date"
                  type="date"
                  value={safeFormData.scheduledDate}
                  onChange={(e) => onChange('scheduledDate', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  disabled={disabled}
                  error={!!errors.scheduledDate}
                  helperText={errors.scheduledDate}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Time"
                  type="time"
                  value={safeFormData.scheduledTime}
                  onChange={(e) => onChange('scheduledTime', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  disabled={disabled}
                  error={!!errors.scheduledTime}
                  helperText={errors.scheduledTime}
                />
              </Grid>
            </Grid>
          </Box>
        );

      case 1: // Clinical Details
        return (
          <Box>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Reason for Visit"
                  value={safeFormData.reasonForVisit}
                  onChange={(e) => onChange('reasonForVisit', e.target.value)}
                  placeholder="e.g., Annual physical exam, Diabetes follow-up"
                  disabled={disabled}
                  error={!!errors.reasonForVisit}
                  helperText={errors.reasonForVisit}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Chief Complaint"
                  value={safeFormData.chiefComplaint}
                  onChange={(e) => onChange('chiefComplaint', e.target.value)}
                  placeholder="Patient's main concern or complaint"
                  multiline
                  rows={2}
                  disabled={disabled}
                  error={!!errors.chiefComplaint}
                  helperText={errors.chiefComplaint}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Additional Notes"
                  value={safeFormData.notes}
                  onChange={(e) => onChange('notes', e.target.value)}
                  placeholder="Any additional preparation notes or instructions"
                  multiline
                  rows={3}
                  disabled={disabled}
                />
              </Grid>
            </Grid>

            {safeFormData.checklist.length > 0 && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Planned Activities:
                </Typography>
                <List dense>
                  {safeFormData.checklist.map((item, index) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <CheckIcon color="success" />
                      </ListItemIcon>
                      <ListItemText primary={item} />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
          </Box>
        );

      case 2: // Provider & Location
        return (
          <Box>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Autocomplete
                  value={safeFormData.provider}
                  onChange={(event, newValue) => {
                    onChange('provider', newValue || '');
                  }}
                  options={PROVIDER_TEMPLATES}
                  freeSolo
                  disabled={disabled}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Provider"
                      placeholder="Select or type provider name"
                      error={!!errors.provider}
                      helperText={errors.provider}
                      required
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Location</InputLabel>
                  <Select
                    value={safeFormData.location}
                    onChange={(e) => onChange('location', e.target.value)}
                    label="Location"
                    disabled={disabled}
                  >
                    {ENCOUNTER_LOCATIONS.map((location) => (
                      <MenuItem key={location.value} value={location.value}>
                        {location.display} - {location.address}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            {safeFormData.expectedOrders.length > 0 && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Expected Orders/Tests:
                </Typography>
                <List dense>
                  {safeFormData.expectedOrders.map((order, index) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <InfoIcon color="info" />
                      </ListItemIcon>
                      <ListItemText primary={order} />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
          </Box>
        );

      default:
        return (
          <Box>
            <Typography variant="body2" color="text.secondary">
              Step {activeStep + 1} content
            </Typography>
          </Box>
        );
    }
  };

  return renderStep();
};

export default EncounterFormFields;