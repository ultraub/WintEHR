import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  Typography,
  Box,
  Chip,
  IconButton,
  Stack,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress
} from '@mui/material';
import {
  Close as CloseIcon,
  Assignment as CarePlanIcon,
  Add as AddIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { fhirClient } from '../../../../core/fhir/services/fhirClient';

const INITIAL_FORM = {
  title: '',
  description: '',
  status: 'draft',
  intent: 'plan',
  periodStart: '',
  periodEnd: '',
  goals: [''],
  activities: ['']
};

const CarePlanDialog = ({ open, onClose, carePlan, patientId, onSaved }) => {
  const isViewMode = !!carePlan;
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleClose = () => {
    setFormData(INITIAL_FORM);
    setError(null);
    onClose();
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleListChange = (field, index, value) => {
    setFormData(prev => {
      const updated = [...prev[field]];
      updated[index] = value;
      return { ...prev, [field]: updated };
    });
  };

  const handleAddListItem = (field) => {
    setFormData(prev => ({ ...prev, [field]: [...prev[field], ''] }));
  };

  const handleRemoveListItem = (field, index) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
    }));
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const fhirCarePlan = {
        resourceType: 'CarePlan',
        status: formData.status,
        intent: formData.intent,
        title: formData.title.trim(),
        subject: { reference: `Patient/${patientId}` },
        created: new Date().toISOString()
      };

      if (formData.description.trim()) {
        fhirCarePlan.description = formData.description.trim();
      }

      if (formData.periodStart) {
        fhirCarePlan.period = { start: formData.periodStart };
        if (formData.periodEnd) {
          fhirCarePlan.period.end = formData.periodEnd;
        }
      }

      const filteredGoals = formData.goals.filter(g => g.trim());
      if (filteredGoals.length > 0) {
        fhirCarePlan.goal = filteredGoals.map(goalText => ({
          reference: '#',
          display: goalText.trim()
        }));
      }

      const filteredActivities = formData.activities.filter(a => a.trim());
      if (filteredActivities.length > 0) {
        fhirCarePlan.activity = filteredActivities.map(activityText => ({
          detail: {
            description: activityText.trim(),
            status: 'not-started'
          }
        }));
      }

      await fhirClient.create('CarePlan', fhirCarePlan);

      if (onSaved) {
        onSaved();
      }
      handleClose();
    } catch (err) {
      console.error('Error creating care plan:', err);
      setError(err.message || 'Failed to create care plan');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      sx={{
        '& .MuiDialog-paper': {
          borderRadius: 0
        }
      }}
    >
      <DialogTitle>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={1}>
            <CarePlanIcon />
            <Typography variant="h6">
              {isViewMode ? 'View Care Plan' : 'Add Care Plan'}
            </Typography>
          </Stack>
          <IconButton size="small" onClick={handleClose}>
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        {isViewMode && carePlan ? (
          <Box>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    backgroundColor: 'grey.50',
                    borderRadius: 0,
                    border: '1px solid',
                    borderColor: 'divider'
                  }}
                >
                  <Typography variant="h6" gutterBottom>
                    {carePlan.title || 'Care Plan'}
                  </Typography>
                  <Stack direction="row" spacing={1} mb={2}>
                    <Chip
                      label={carePlan.status}
                      color={carePlan.status === 'active' ? 'success' : 'default'}
                      size="small"
                    />
                    {carePlan.intent && (
                      <Chip label={carePlan.intent} size="small" variant="outlined" />
                    )}
                  </Stack>

                  {carePlan.description && (
                    <Typography variant="body2" paragraph>
                      {carePlan.description}
                    </Typography>
                  )}

                  {carePlan.period && (
                    <Typography variant="caption" color="text.secondary">
                      Period: {carePlan.period.start && format(new Date(carePlan.period.start), 'MMM d, yyyy')}
                      {carePlan.period.end && ` - ${format(new Date(carePlan.period.end), 'MMM d, yyyy')}`}
                    </Typography>
                  )}
                </Paper>
              </Grid>

              {carePlan.goal && carePlan.goal.length > 0 && (
                <Grid item xs={12}>
                  <Typography variant="subtitle1" gutterBottom>
                    Goals
                  </Typography>
                  <Stack spacing={1}>
                    {carePlan.goal.map((goal, index) => (
                      <Paper
                        key={index}
                        elevation={0}
                        sx={{
                          p: 1.5,
                          borderRadius: 0,
                          border: '1px solid',
                          borderColor: 'divider'
                        }}
                      >
                        <Typography variant="body2">
                          {goal.display || goal.description?.text || 'Goal'}
                        </Typography>
                      </Paper>
                    ))}
                  </Stack>
                </Grid>
              )}

              {carePlan.activity && carePlan.activity.length > 0 && (
                <Grid item xs={12}>
                  <Typography variant="subtitle1" gutterBottom>
                    Activities
                  </Typography>
                  <Stack spacing={1}>
                    {carePlan.activity.map((activity, index) => (
                      <Paper
                        key={index}
                        elevation={0}
                        sx={{
                          p: 1.5,
                          borderRadius: 0,
                          border: '1px solid',
                          borderColor: 'divider'
                        }}
                      >
                        <Typography variant="body2">
                          {activity.detail?.description || activity.detail?.code?.text || 'Activity'}
                        </Typography>
                        {activity.detail?.status && (
                          <Chip
                            label={activity.detail.status}
                            size="small"
                            sx={{ mt: 1 }}
                          />
                        )}
                      </Paper>
                    ))}
                  </Stack>
                </Grid>
              )}
            </Grid>
          </Box>
        ) : (
          <Box>
            {error && (
              <Typography color="error" variant="body2" sx={{ mb: 2 }}>
                {error}
              </Typography>
            )}
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  label="Title"
                  value={formData.title}
                  onChange={(e) => handleChange('title', e.target.value)}
                  fullWidth
                  required
                  size="small"
                  placeholder="e.g., Diabetes Management Plan"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Description"
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  fullWidth
                  multiline
                  rows={3}
                  size="small"
                  placeholder="Describe the care plan objectives and approach"
                />
              </Grid>
              <Grid item xs={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={formData.status}
                    onChange={(e) => handleChange('status', e.target.value)}
                    label="Status"
                  >
                    <MenuItem value="draft">Draft</MenuItem>
                    <MenuItem value="active">Active</MenuItem>
                    <MenuItem value="on-hold">On Hold</MenuItem>
                    <MenuItem value="completed">Completed</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Intent</InputLabel>
                  <Select
                    value={formData.intent}
                    onChange={(e) => handleChange('intent', e.target.value)}
                    label="Intent"
                  >
                    <MenuItem value="proposal">Proposal</MenuItem>
                    <MenuItem value="plan">Plan</MenuItem>
                    <MenuItem value="order">Order</MenuItem>
                    <MenuItem value="option">Option</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Period Start"
                  type="date"
                  value={formData.periodStart}
                  onChange={(e) => handleChange('periodStart', e.target.value)}
                  fullWidth
                  size="small"
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Period End"
                  type="date"
                  value={formData.periodEnd}
                  onChange={(e) => handleChange('periodEnd', e.target.value)}
                  fullWidth
                  size="small"
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              {/* Goals */}
              <Grid item xs={12}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Typography variant="subtitle2">Goals</Typography>
                  <IconButton size="small" onClick={() => handleAddListItem('goals')}>
                    <AddIcon fontSize="small" />
                  </IconButton>
                </Stack>
                <Stack spacing={1} sx={{ mt: 1 }}>
                  {formData.goals.map((goal, index) => (
                    <Stack key={index} direction="row" spacing={1} alignItems="center">
                      <TextField
                        value={goal}
                        onChange={(e) => handleListChange('goals', index, e.target.value)}
                        fullWidth
                        size="small"
                        placeholder={`Goal ${index + 1}`}
                      />
                      {formData.goals.length > 1 && (
                        <IconButton size="small" onClick={() => handleRemoveListItem('goals', index)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      )}
                    </Stack>
                  ))}
                </Stack>
              </Grid>

              {/* Activities */}
              <Grid item xs={12}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Typography variant="subtitle2">Activities</Typography>
                  <IconButton size="small" onClick={() => handleAddListItem('activities')}>
                    <AddIcon fontSize="small" />
                  </IconButton>
                </Stack>
                <Stack spacing={1} sx={{ mt: 1 }}>
                  {formData.activities.map((activity, index) => (
                    <Stack key={index} direction="row" spacing={1} alignItems="center">
                      <TextField
                        value={activity}
                        onChange={(e) => handleListChange('activities', index, e.target.value)}
                        fullWidth
                        size="small"
                        placeholder={`Activity ${index + 1}`}
                      />
                      {formData.activities.length > 1 && (
                        <IconButton size="small" onClick={() => handleRemoveListItem('activities', index)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      )}
                    </Stack>
                  ))}
                </Stack>
              </Grid>
            </Grid>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={saving}>
          {isViewMode ? 'Close' : 'Cancel'}
        </Button>
        {!isViewMode && (
          <Button
            onClick={handleSave}
            variant="contained"
            color="primary"
            disabled={saving}
            startIcon={saving ? <CircularProgress size={16} /> : null}
          >
            {saving ? 'Saving...' : 'Save Care Plan'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default CarePlanDialog;
