/**
 * EncounterPreview Component
 * Preview display for encounter data before saving
 */
import React from 'react';
import {
  Box,
  Grid,
  Typography,
  Paper,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Alert,
  Stack
} from '@mui/material';
import {
  EventNote as EncounterIcon,
  Person as PersonIcon,
  Schedule as ScheduleIcon,
  LocationOn as LocationIcon,
  CheckCircle as CheckIcon,
  Assignment as OrderIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import {
  ENCOUNTER_TYPES,
  PRIORITY_LEVELS,
  ENCOUNTER_LOCATIONS,
  ENCOUNTER_TEMPLATES
} from '../config/encounterDialogConfig';

const EncounterPreview = ({ formData = {} }) => {
  // Safe defaults
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

  const getEncounterTypeDisplay = () => {
    const type = ENCOUNTER_TYPES.find(t => t.value === safeFormData.type);
    return type ? `${type.display} - ${type.description}` : safeFormData.type;
  };

  const getPriorityDisplay = () => {
    const priority = PRIORITY_LEVELS.find(p => p.value === safeFormData.priority);
    return priority ? priority.display : safeFormData.priority;
  };

  const getLocationDisplay = () => {
    const location = ENCOUNTER_LOCATIONS.find(l => l.value === safeFormData.location);
    return location ? `${location.display} - ${location.address}` : safeFormData.location;
  };

  const formatDateTime = () => {
    try {
      const dateTime = new Date(`${safeFormData.scheduledDate}T${safeFormData.scheduledTime}`);
      return format(dateTime, 'PPP p');
    } catch {
      return `${safeFormData.scheduledDate} at ${safeFormData.scheduledTime}`;
    }
  };

  const getEndTime = () => {
    try {
      const startTime = new Date(`${safeFormData.scheduledDate}T${safeFormData.scheduledTime}`);
      const endTime = new Date(startTime.getTime() + (safeFormData.duration * 60000));
      return format(endTime, 'p');
    } catch {
      return 'Unknown';
    }
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <EncounterIcon color="primary" />
        Encounter Summary
      </Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={3}>
          {/* Basic Information */}
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <EncounterIcon fontSize="small" />
              Encounter Type
            </Typography>
            <Typography variant="body1" gutterBottom>
              {getEncounterTypeDisplay()}
            </Typography>
            
            <Typography variant="subtitle2" color="text.secondary">
              Priority
            </Typography>
            <Chip 
              label={getPriorityDisplay()} 
              color={safeFormData.priority === 'urgent' ? 'warning' : 
                     safeFormData.priority === 'stat' ? 'error' : 'default'}
              size="small"
            />
          </Grid>

          {/* Schedule Information */}
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <ScheduleIcon fontSize="small" />
              Scheduled
            </Typography>
            <Typography variant="body1">
              {formatDateTime()}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Duration: {safeFormData.duration} minutes (until {getEndTime()})
            </Typography>
          </Grid>

          {/* Provider & Location */}
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <PersonIcon fontSize="small" />
              Provider
            </Typography>
            <Typography variant="body1" gutterBottom>
              {safeFormData.provider || 'Not assigned'}
            </Typography>
          </Grid>

          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <LocationIcon fontSize="small" />
              Location
            </Typography>
            <Typography variant="body1">
              {getLocationDisplay()}
            </Typography>
          </Grid>

          {/* Clinical Information */}
          <Grid item xs={12}>
            <Typography variant="subtitle2" color="text.secondary">
              Reason for Visit
            </Typography>
            <Typography variant="body1" gutterBottom>
              {safeFormData.reasonForVisit || 'Not specified'}
            </Typography>
          </Grid>

          {safeFormData.chiefComplaint && (
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="text.secondary">
                Chief Complaint
              </Typography>
              <Typography variant="body1" gutterBottom>
                {safeFormData.chiefComplaint}
              </Typography>
            </Grid>
          )}

          {safeFormData.notes && (
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="text.secondary">
                Notes
              </Typography>
              <Typography variant="body1">
                {safeFormData.notes}
              </Typography>
            </Grid>
          )}
        </Grid>
      </Paper>

      {/* Template Information */}
      {safeFormData.selectedTemplate && (
        <Alert severity="info" sx={{ mb: 2 }}>
          This encounter is based on the "{ENCOUNTER_TEMPLATES[safeFormData.selectedTemplate]?.name}" template.
        </Alert>
      )}

      {/* Checklist */}
      {safeFormData.checklist.length > 0 && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CheckIcon color="success" />
            Planned Activities
          </Typography>
          <List dense>
            {safeFormData.checklist.map((item, index) => (
              <ListItem key={index} sx={{ py: 0.5 }}>
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <CheckIcon color="success" fontSize="small" />
                </ListItemIcon>
                <ListItemText primary={item} />
              </ListItem>
            ))}
          </List>
        </Paper>
      )}

      {/* Expected Orders */}
      {safeFormData.expectedOrders.length > 0 && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <OrderIcon color="info" />
            Expected Orders/Tests
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {safeFormData.expectedOrders.map((order, index) => (
              <Chip 
                key={index} 
                label={order} 
                variant="outlined" 
                color="info"
                size="small"
              />
            ))}
          </Stack>
        </Paper>
      )}
    </Box>
  );
};

export default EncounterPreview;