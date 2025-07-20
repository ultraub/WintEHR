/**
 * CarePlanFormFields Component
 * Specialized form fields for CarePlan resource management
 */
import React, { useState } from 'react';
import {
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Chip,
  Stack,
  Box,
  Button,
  IconButton,
  Card,
  CardContent,
  CardActions,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  Event as EventIcon,
  Group as GroupIcon,
  Assignment as AssignmentIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { format } from 'date-fns';
import ResourceSearchAutocomplete from '../../../../search/ResourceSearchAutocomplete';
import { useConditionSearch, useGoalSearch } from '../../../../../hooks/useResourceSearch';
import {
  CAREPLAN_STATUS_OPTIONS,
  CAREPLAN_INTENT_OPTIONS,
  CAREPLAN_CATEGORIES,
  ACTIVITY_STATUS_OPTIONS,
  ACTIVITY_CATEGORIES,
  COMMON_ACTIVITY_CODES,
  getStatusColor,
  getActivityStatusColor,
  getIntentColor,
  getCarePlanDisplay
} from '../../../../../core/fhir/converters/CarePlanConverter';

const CarePlanFormFields = ({ formData = {}, errors = {}, onChange, disabled }) => {
  const [expandedActivity, setExpandedActivity] = useState(null);
  
  // Search hooks for related resources
  const conditionSearch = useConditionSearch({
    debounceMs: 300,
    minQueryLength: 2
  });
  
  const goalSearch = useGoalSearch({
    debounceMs: 300,
    minQueryLength: 2
  });

  // Provide safe defaults for form data to prevent undefined values
  const safeFormData = {
    title: formData.title || '',
    description: formData.description || '',
    status: formData.status || 'active',
    intent: formData.intent || 'plan',
    category: formData.category || 'assess-plan',
    period: {
      start: formData.period?.start || new Date(),
      end: formData.period?.end || null
    },
    careTeam: formData.careTeam || [],
    addresses: formData.addresses || [],
    goals: formData.goals || [],
    activities: formData.activities || [],
    notes: formData.notes || ''
  };

  const handleActivityChange = (index, field, value) => {
    const newActivities = [...safeFormData.activities];
    newActivities[index] = {
      ...newActivities[index],
      [field]: value
    };
    onChange('activities', newActivities);
  };

  const addActivity = () => {
    const newActivity = {
      id: `activity-${Date.now()}`,
      description: '',
      status: 'not-started',
      category: 'other',
      code: null,
      scheduledPeriod: {
        start: null,
        end: null
      },
      location: null,
      performer: []
    };
    onChange('activities', [...safeFormData.activities, newActivity]);
    setExpandedActivity(safeFormData.activities.length);
  };

  const removeActivity = (index) => {
    const newActivities = safeFormData.activities.filter((_, i) => i !== index);
    onChange('activities', newActivities);
    if (expandedActivity === index) {
      setExpandedActivity(null);
    }
  };

  const addRelatedResource = (type, resourceId) => {
    if (!resourceId) return;
    
    const currentList = safeFormData[type] || [];
    if (!currentList.includes(resourceId)) {
      onChange(type, [...currentList, resourceId]);
    }
  };

  const removeRelatedResource = (type, resourceId) => {
    const currentList = safeFormData[type] || [];
    onChange(type, currentList.filter(id => id !== resourceId));
  };

  return (
    <Stack spacing={3}>
      <Grid container spacing={2}>
        {/* Basic Information */}
        <Grid item xs={12}>
          <Typography variant="h6" gutterBottom>
            Basic Information
          </Typography>
        </Grid>

        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Care Plan Title"
            value={safeFormData.title}
            onChange={(e) => onChange('title', e.target.value)}
            variant="outlined"
            disabled={disabled}
            error={!!errors.title}
            helperText={errors.title || "Brief descriptive title for this care plan"}
            placeholder="e.g., Diabetes Management Plan, Post-Surgery Recovery Plan..."
            required
          />
        </Grid>

        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Description"
            value={safeFormData.description}
            onChange={(e) => onChange('description', e.target.value)}
            variant="outlined"
            disabled={disabled}
            error={!!errors.description}
            helperText={errors.description || "Detailed description of the care plan objectives and approach"}
            multiline
            rows={3}
            placeholder="Describe the overall goals, approach, and key considerations for this care plan..."
          />
        </Grid>

        {/* Status and Classification */}
        <Grid item xs={4}>
          <FormControl fullWidth error={!!errors.status}>
            <InputLabel>Status</InputLabel>
            <Select
              value={safeFormData.status}
              label="Status"
              disabled={disabled}
              onChange={(e) => onChange('status', e.target.value)}
            >
              {CAREPLAN_STATUS_OPTIONS.map(status => (
                <MenuItem key={status.value} value={status.value}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography variant="body2">{status.display}</Typography>
                    <Chip 
                      size="small" 
                      label={status.value} 
                      color={getStatusColor(status.value)}
                      variant="outlined"
                    />
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={4}>
          <FormControl fullWidth error={!!errors.intent}>
            <InputLabel>Intent</InputLabel>
            <Select
              value={safeFormData.intent}
              label="Intent"
              disabled={disabled}
              onChange={(e) => onChange('intent', e.target.value)}
            >
              {CAREPLAN_INTENT_OPTIONS.map(intent => (
                <MenuItem key={intent.value} value={intent.value}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography variant="body2">{intent.display}</Typography>
                    <Chip 
                      size="small" 
                      label={intent.value} 
                      color={getIntentColor(intent.value)}
                      variant="outlined"
                    />
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={4}>
          <FormControl fullWidth error={!!errors.category}>
            <InputLabel>Category</InputLabel>
            <Select
              value={safeFormData.category}
              label="Category"
              disabled={disabled}
              onChange={(e) => onChange('category', e.target.value)}
            >
              {CAREPLAN_CATEGORIES.map(category => (
                <MenuItem key={category.value} value={category.value}>
                  <Stack>
                    <Typography variant="body2">{category.display}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {category.description}
                    </Typography>
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Care Period */}
        <Grid item xs={6}>
          <DatePicker
            label="Start Date"
            value={safeFormData.period.start}
            disabled={disabled}
            onChange={(newValue) => onChange('period', {
              ...safeFormData.period,
              start: newValue
            })}
            slotProps={{
              textField: { 
                fullWidth: true,
                error: !!errors.period,
                helperText: errors.period || "When does this care plan begin?"
              }
            }}
            maxDate={new Date()}
          />
        </Grid>

        <Grid item xs={6}>
          <DatePicker
            label="End Date (Optional)"
            value={safeFormData.period.end}
            disabled={disabled}
            onChange={(newValue) => onChange('period', {
              ...safeFormData.period,
              end: newValue
            })}
            slotProps={{
              textField: { 
                fullWidth: true,
                helperText: "When is this care plan expected to be completed?"
              }
            }}
            minDate={safeFormData.period.start}
          />
        </Grid>
      </Grid>

      <Divider />

      {/* Related Resources */}
      <Box>
        <Typography variant="h6" gutterBottom>
          Related Resources
        </Typography>
        
        {/* Addresses (Conditions) */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            <AssignmentIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Conditions Addressed
          </Typography>
          <ResourceSearchAutocomplete
            label="Search for conditions"
            placeholder="Link conditions this care plan addresses..."
            searchService={conditionSearch.searchService}
            resourceTypes={['Condition']}
            value={null}
            onChange={(event, newValue) => {
              if (newValue) {
                addRelatedResource('addresses', newValue.id);
              }
            }}
            disabled={disabled}
            freeSolo={false}
            getOptionLabel={(option) => {
              if (typeof option === 'string') return option;
              return option.display || option.code?.text || option.id || 'Unknown condition';
            }}
          />
          
          {safeFormData.addresses.length > 0 && (
            <Box sx={{ mt: 1 }}>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {safeFormData.addresses.map((conditionId) => (
                  <Chip
                    key={conditionId}
                    label={`Condition: ${conditionId}`}
                    onDelete={disabled ? undefined : () => removeRelatedResource('addresses', conditionId)}
                    color="primary"
                    variant="outlined"
                    size="small"
                  />
                ))}
              </Stack>
            </Box>
          )}
        </Box>

        {/* Goals */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            <EventIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Associated Goals
          </Typography>
          <ResourceSearchAutocomplete
            label="Search for goals"
            placeholder="Link goals to this care plan..."
            searchService={goalSearch.searchService}
            resourceTypes={['Goal']}
            value={null}
            onChange={(event, newValue) => {
              if (newValue) {
                addRelatedResource('goals', newValue.id);
              }
            }}
            disabled={disabled}
            freeSolo={false}
            getOptionLabel={(option) => {
              if (typeof option === 'string') return option;
              return option.display || option.description?.text || option.id || 'Unknown goal';
            }}
          />
          
          {safeFormData.goals.length > 0 && (
            <Box sx={{ mt: 1 }}>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {safeFormData.goals.map((goalId) => (
                  <Chip
                    key={goalId}
                    label={`Goal: ${goalId}`}
                    onDelete={disabled ? undefined : () => removeRelatedResource('goals', goalId)}
                    color="secondary"
                    variant="outlined"
                    size="small"
                  />
                ))}
              </Stack>
            </Box>
          )}
        </Box>
      </Box>

      <Divider />

      {/* Activities */}
      <Box>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="h6">
            Planned Activities
          </Typography>
          <Button
            startIcon={<AddIcon />}
            onClick={addActivity}
            disabled={disabled}
            variant="outlined"
            size="small"
          >
            Add Activity
          </Button>
        </Stack>

        {safeFormData.activities.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center', backgroundColor: 'grey.50', borderRadius: 1 }}>
            <Typography variant="body2" color="text.secondary">
              No activities planned yet. Click "Add Activity" to create planned care activities.
            </Typography>
          </Box>
        ) : (
          <Stack spacing={2}>
            {safeFormData.activities.map((activity, index) => (
              <Accordion
                key={activity.id}
                expanded={expandedActivity === index}
                onChange={(event, isExpanded) => setExpandedActivity(isExpanded ? index : null)}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%', mr: 2 }}>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {activity.description || `Activity ${index + 1}`}
                    </Typography>
                    <Chip 
                      label={activity.status} 
                      size="small" 
                      color={getActivityStatusColor(activity.status)}
                      variant="outlined"
                    />
                    <Chip 
                      label={activity.category} 
                      size="small" 
                      variant="outlined"
                    />
                  </Stack>
                </AccordionSummary>
                
                <AccordionDetails>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Activity Description"
                        value={activity.description}
                        onChange={(e) => handleActivityChange(index, 'description', e.target.value)}
                        variant="outlined"
                        disabled={disabled}
                        placeholder="Describe what needs to be done..."
                        required
                      />
                    </Grid>

                    <Grid item xs={6}>
                      <FormControl fullWidth>
                        <InputLabel>Status</InputLabel>
                        <Select
                          value={activity.status}
                          label="Status"
                          disabled={disabled}
                          onChange={(e) => handleActivityChange(index, 'status', e.target.value)}
                        >
                          {ACTIVITY_STATUS_OPTIONS.map(status => (
                            <MenuItem key={status.value} value={status.value}>
                              <Stack direction="row" alignItems="center" spacing={1}>
                                <Typography variant="body2">{status.display}</Typography>
                                <Chip 
                                  size="small" 
                                  label={status.value} 
                                  color={getActivityStatusColor(status.value)}
                                  variant="outlined"
                                />
                              </Stack>
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>

                    <Grid item xs={6}>
                      <FormControl fullWidth>
                        <InputLabel>Category</InputLabel>
                        <Select
                          value={activity.category}
                          label="Category"
                          disabled={disabled}
                          onChange={(e) => handleActivityChange(index, 'category', e.target.value)}
                        >
                          {ACTIVITY_CATEGORIES.map(category => (
                            <MenuItem key={category.value} value={category.value}>
                              <Stack>
                                <Typography variant="body2">{category.display}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {category.description}
                                </Typography>
                              </Stack>
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>

                    <Grid item xs={6}>
                      <DatePicker
                        label="Scheduled Start"
                        value={activity.scheduledPeriod.start}
                        disabled={disabled}
                        onChange={(newValue) => handleActivityChange(index, 'scheduledPeriod', {
                          ...activity.scheduledPeriod,
                          start: newValue
                        })}
                        slotProps={{
                          textField: { 
                            fullWidth: true,
                            helperText: "When should this activity start?"
                          }
                        }}
                      />
                    </Grid>

                    <Grid item xs={6}>
                      <DatePicker
                        label="Scheduled End"
                        value={activity.scheduledPeriod.end}
                        disabled={disabled}
                        onChange={(newValue) => handleActivityChange(index, 'scheduledPeriod', {
                          ...activity.scheduledPeriod,
                          end: newValue
                        })}
                        slotProps={{
                          textField: { 
                            fullWidth: true,
                            helperText: "When should this activity be completed?"
                          }
                        }}
                        minDate={activity.scheduledPeriod.start}
                      />
                    </Grid>
                  </Grid>
                  
                  <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                    <Button
                      startIcon={<DeleteIcon />}
                      onClick={() => removeActivity(index)}
                      disabled={disabled}
                      color="error"
                      size="small"
                    >
                      Remove Activity
                    </Button>
                  </Box>
                </AccordionDetails>
              </Accordion>
            ))}
          </Stack>
        )}
      </Box>

      <Divider />

      {/* Additional Notes */}
      <Box>
        <Typography variant="h6" gutterBottom>
          Additional Notes
        </Typography>
        <TextField
          fullWidth
          label="Care Plan Notes"
          value={safeFormData.notes}
          disabled={disabled}
          onChange={(e) => onChange('notes', e.target.value)}
          variant="outlined"
          multiline
          rows={4}
          error={!!errors.notes}
          helperText={errors.notes || "Additional notes, considerations, or instructions for this care plan"}
          placeholder="Include any special considerations, patient preferences, coordination notes, or other relevant information..."
        />
      </Box>

      {/* Preview */}
      {safeFormData.title && (
        <Box sx={{ p: 2, backgroundColor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            Preview:
          </Typography>
          <Stack spacing={1}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                {getCarePlanDisplay(safeFormData)}
              </Typography>
              <Chip 
                label={safeFormData.status} 
                size="small" 
                color={getStatusColor(safeFormData.status)}
              />
              <Chip 
                label={safeFormData.intent} 
                size="small" 
                color={getIntentColor(safeFormData.intent)}
                variant="outlined"
              />
            </Stack>
            
            <Typography variant="caption" color="text.secondary">
              Category: {CAREPLAN_CATEGORIES.find(c => c.value === safeFormData.category)?.display}
            </Typography>
            
            <Stack direction="row" spacing={2}>
              <Typography variant="caption" color="text.secondary">
                Start: {format(safeFormData.period.start, 'MMM d, yyyy')}
              </Typography>
              {safeFormData.period.end && (
                <Typography variant="caption" color="text.secondary">
                  End: {format(safeFormData.period.end, 'MMM d, yyyy')}
                </Typography>
              )}
            </Stack>
            
            <Stack direction="row" spacing={2}>
              <Typography variant="caption" color="text.secondary">
                Conditions: {safeFormData.addresses.length}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Goals: {safeFormData.goals.length}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Activities: {safeFormData.activities.length}
              </Typography>
            </Stack>
          </Stack>
        </Box>
      )}
    </Stack>
  );
};

export default CarePlanFormFields;