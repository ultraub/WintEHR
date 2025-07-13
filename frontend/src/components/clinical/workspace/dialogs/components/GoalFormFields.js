/**
 * GoalFormFields Component
 * Specialized form fields for Goal resource management
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
  FormControlLabel,
  Checkbox,
  Autocomplete,
  Divider,
  InputAdornment
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { format } from 'date-fns';
import ResourceSearchAutocomplete from '../../../../search/ResourceSearchAutocomplete';
import { useConditionSearch } from '../../../../../hooks/useResourceSearch';
import {
  GOAL_LIFECYCLE_STATUS_OPTIONS,
  GOAL_ACHIEVEMENT_STATUS_OPTIONS,
  GOAL_PRIORITY_OPTIONS,
  GOAL_CATEGORIES,
  GOAL_MEASUREMENT_UNITS,
  COMMON_GOAL_CODES,
  getLifecycleStatusColor,
  getAchievementStatusColor,
  getPriorityColor,
  getGoalDisplay
} from '../../../../../utils/fhir/GoalConverter';

const GoalFormFields = ({ formData = {}, errors = {}, onChange, disabled }) => {
  // Use condition search for linking goals to conditions
  const conditionSearch = useConditionSearch({
    debounceMs: 300,
    minQueryLength: 2
  });

  // Provide safe defaults for form data to prevent undefined values
  const safeFormData = {
    description: formData.description || '',
    selectedGoalCode: formData.selectedGoalCode || null,
    category: formData.category || 'health-maintenance',
    priority: formData.priority || 'medium-priority',
    lifecycleStatus: formData.lifecycleStatus || 'active',
    achievementStatus: formData.achievementStatus || 'in-progress',
    startDate: formData.startDate || new Date(),
    targetDate: formData.targetDate || null,
    targetMeasure: {
      hasTarget: formData.targetMeasure?.hasTarget || false,
      valueQuantity: formData.targetMeasure?.valueQuantity || '',
      unit: formData.targetMeasure?.unit || '',
      comparison: formData.targetMeasure?.comparison || 'greater-than'
    },
    notes: formData.notes || '',
    addresses: formData.addresses || []
  };

  return (
    <Stack spacing={3}>
      <Grid container spacing={2}>
        {/* Goal Description Search */}
        <Grid item xs={12}>
          <Typography variant="subtitle2" gutterBottom>
            Goal Description
          </Typography>
          <Autocomplete
            options={COMMON_GOAL_CODES}
            value={safeFormData.selectedGoalCode}
            onChange={(event, newValue) => {
              onChange('selectedGoalCode', newValue);
              onChange('description', newValue ? newValue.display : safeFormData.description);
              if (newValue?.category) {
                onChange('category', newValue.category);
              }
            }}
            getOptionLabel={(option) => option?.display || ''}
            getOptionKey={(option) => option?.code || Math.random()}
            disabled={disabled}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Search for common goals"
                placeholder="Type to search goals or enter custom description below..."
                error={!!errors.selectedGoalCode}
                helperText={errors.selectedGoalCode || "Search for common clinical goals"}
              />
            )}
            renderOption={(props, option) => {
              const { key, ...otherProps } = props;
              return (
                <Box component="li" key={key} {...otherProps}>
                  <Stack sx={{ width: '100%' }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {option.display}
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip 
                        label={`SNOMED: ${option.code}`} 
                        size="small" 
                        variant="outlined"
                        color="primary"
                      />
                      <Chip 
                        label={option.category} 
                        size="small" 
                        variant="outlined"
                        color="secondary"
                      />
                    </Stack>
                  </Stack>
                </Box>
              );
            }}
            freeSolo={false}
          />
        </Grid>

        {/* Custom Goal Description */}
        <Grid item xs={12}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Or enter a custom goal description:
          </Typography>
          <TextField
            fullWidth
            label="Custom Goal Description"
            value={safeFormData.description}
            onChange={(e) => {
              onChange('description', e.target.value);
              onChange('selectedGoalCode', null);
            }}
            variant="outlined"
            disabled={disabled}
            error={!!errors.description}
            helperText={errors.description || "Enter a goal not found in the common goals list"}
            multiline
            rows={2}
            placeholder="Describe the specific goal for this patient..."
          />
        </Grid>

        {/* Category and Priority */}
        <Grid item xs={6}>
          <FormControl fullWidth error={!!errors.category}>
            <InputLabel>Category</InputLabel>
            <Select
              value={safeFormData.category}
              label="Category"
              disabled={disabled}
              onChange={(e) => onChange('category', e.target.value)}
            >
              {GOAL_CATEGORIES.map(category => (
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
          <FormControl fullWidth error={!!errors.priority}>
            <InputLabel>Priority</InputLabel>
            <Select
              value={safeFormData.priority}
              label="Priority"
              disabled={disabled}
              onChange={(e) => onChange('priority', e.target.value)}
            >
              {GOAL_PRIORITY_OPTIONS.map(priority => (
                <MenuItem key={priority.value} value={priority.value}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography variant="body2">{priority.display}</Typography>
                    <Chip 
                      size="small" 
                      label={priority.value} 
                      color={getPriorityColor(priority.value)}
                      variant="outlined"
                    />
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Status Fields */}
        <Grid item xs={6}>
          <FormControl fullWidth error={!!errors.lifecycleStatus}>
            <InputLabel>Lifecycle Status</InputLabel>
            <Select
              value={safeFormData.lifecycleStatus}
              label="Lifecycle Status"
              disabled={disabled}
              onChange={(e) => onChange('lifecycleStatus', e.target.value)}
            >
              {GOAL_LIFECYCLE_STATUS_OPTIONS.map(status => (
                <MenuItem key={status.value} value={status.value}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography variant="body2">{status.display}</Typography>
                    <Chip 
                      size="small" 
                      label={status.value} 
                      color={getLifecycleStatusColor(status.value)}
                      variant="outlined"
                    />
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={6}>
          <FormControl fullWidth error={!!errors.achievementStatus}>
            <InputLabel>Achievement Status</InputLabel>
            <Select
              value={safeFormData.achievementStatus}
              label="Achievement Status"
              disabled={disabled}
              onChange={(e) => onChange('achievementStatus', e.target.value)}
            >
              {GOAL_ACHIEVEMENT_STATUS_OPTIONS.map(status => (
                <MenuItem key={status.value} value={status.value}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography variant="body2">{status.display}</Typography>
                    <Chip 
                      size="small" 
                      label={status.value} 
                      color={getAchievementStatusColor(status.value)}
                      variant="outlined"
                    />
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Date Fields */}
        <Grid item xs={6}>
          <DatePicker
            label="Start Date"
            value={safeFormData.startDate}
            disabled={disabled}
            onChange={(newValue) => onChange('startDate', newValue)}
            slotProps={{
              textField: { 
                fullWidth: true,
                error: !!errors.startDate,
                helperText: errors.startDate || "When should this goal start?"
              }
            }}
            maxDate={new Date()}
          />
        </Grid>

        <Grid item xs={6}>
          <DatePicker
            label="Target Date (Optional)"
            value={safeFormData.targetDate}
            disabled={disabled}
            onChange={(newValue) => onChange('targetDate', newValue)}
            slotProps={{
              textField: { 
                fullWidth: true,
                error: !!errors.targetDate,
                helperText: errors.targetDate || "When should this goal be achieved?"
              }
            }}
            minDate={safeFormData.startDate}
          />
        </Grid>

        {/* Target Measure Section */}
        <Grid item xs={12}>
          <Divider sx={{ my: 1 }} />
          <Typography variant="subtitle2" gutterBottom>
            Target Measure (Optional)
          </Typography>
          <FormControlLabel
            control={
              <Checkbox
                checked={safeFormData.targetMeasure.hasTarget}
                onChange={(e) => onChange('targetMeasure', {
                  ...safeFormData.targetMeasure,
                  hasTarget: e.target.checked
                })}
                disabled={disabled}
              />
            }
            label="Set a measurable target for this goal"
          />
        </Grid>

        {safeFormData.targetMeasure.hasTarget && (
          <>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Target Value"
                value={safeFormData.targetMeasure.valueQuantity}
                onChange={(e) => onChange('targetMeasure', {
                  ...safeFormData.targetMeasure,
                  valueQuantity: e.target.value
                })}
                variant="outlined"
                disabled={disabled}
                error={!!errors.targetMeasure}
                helperText={errors.targetMeasure || "Enter numeric target value"}
                type="number"
                inputProps={{ min: 0, step: "any" }}
              />
            </Grid>

            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Unit</InputLabel>
                <Select
                  value={safeFormData.targetMeasure.unit}
                  label="Unit"
                  disabled={disabled}
                  onChange={(e) => onChange('targetMeasure', {
                    ...safeFormData.targetMeasure,
                    unit: e.target.value
                  })}
                >
                  {GOAL_MEASUREMENT_UNITS.map(unit => (
                    <MenuItem key={unit.value} value={unit.value}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2">{unit.display}</Typography>
                        <Chip 
                          label={unit.category} 
                          size="small" 
                          variant="outlined"
                          color="default"
                        />
                      </Stack>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </>
        )}

        {/* Addresses (Conditions) */}
        <Grid item xs={12}>
          <Typography variant="subtitle2" gutterBottom>
            Related Conditions (Optional)
          </Typography>
          <ResourceSearchAutocomplete
            label="Search for related conditions"
            placeholder="Link this goal to specific patient conditions..."
            searchService={conditionSearch.searchService}
            resourceTypes={['Condition']}
            value={null} // Multi-select would need different handling
            onChange={(event, newValue) => {
              if (newValue && !safeFormData.addresses.includes(newValue.id)) {
                onChange('addresses', [...safeFormData.addresses, newValue.id]);
              }
            }}
            disabled={disabled}
            error={!!errors.addresses}
            helperText={errors.addresses || "Search for conditions this goal addresses"}
            freeSolo={false}
            multiple={false}
            getOptionLabel={(option) => {
              if (typeof option === 'string') return option;
              return option.display || option.code?.text || option.id || 'Unknown condition';
            }}
          />
          
          {/* Display selected conditions */}
          {safeFormData.addresses.length > 0 && (
            <Box sx={{ mt: 1 }}>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {safeFormData.addresses.map((conditionId, index) => (
                  <Chip
                    key={conditionId}
                    label={`Condition: ${conditionId}`}
                    onDelete={disabled ? undefined : () => {
                      const newAddresses = safeFormData.addresses.filter((_, i) => i !== index);
                      onChange('addresses', newAddresses);
                    }}
                    color="primary"
                    variant="outlined"
                    size="small"
                  />
                ))}
              </Stack>
            </Box>
          )}
        </Grid>

        {/* Additional Notes */}
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Additional Notes"
            value={safeFormData.notes}
            disabled={disabled}
            onChange={(e) => onChange('notes', e.target.value)}
            variant="outlined"
            multiline
            rows={3}
            error={!!errors.notes}
            helperText={errors.notes || "Additional clinical notes about this goal"}
            placeholder="Progress notes, barriers, modifications, or other relevant information..."
          />
        </Grid>
      </Grid>

      {/* Preview */}
      {(safeFormData.selectedGoalCode || safeFormData.description) && (
        <Box sx={{ p: 2, backgroundColor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            Preview:
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
              {getGoalDisplay(safeFormData)}
            </Typography>
            <Chip 
              label={safeFormData.lifecycleStatus} 
              size="small" 
              color={getLifecycleStatusColor(safeFormData.lifecycleStatus)}
            />
            <Chip 
              label={safeFormData.achievementStatus} 
              size="small" 
              color={getAchievementStatusColor(safeFormData.achievementStatus)}
              variant="outlined"
            />
            <Chip 
              label={safeFormData.priority} 
              size="small" 
              color={getPriorityColor(safeFormData.priority)}
              variant="outlined"
            />
          </Stack>
          <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Category: {GOAL_CATEGORIES.find(c => c.value === safeFormData.category)?.display}
            </Typography>
          </Stack>
          <Stack direction="row" spacing={2}>
            <Typography variant="caption" color="text.secondary">
              Start: {format(safeFormData.startDate, 'MMM d, yyyy')}
            </Typography>
            {safeFormData.targetDate && (
              <Typography variant="caption" color="text.secondary">
                Target: {format(safeFormData.targetDate, 'MMM d, yyyy')}
              </Typography>
            )}
            {safeFormData.targetMeasure.hasTarget && (
              <Typography variant="caption" color="text.secondary">
                Target: {safeFormData.targetMeasure.valueQuantity} {safeFormData.targetMeasure.unit}
              </Typography>
            )}
          </Stack>
        </Box>
      )}
    </Stack>
  );
};

export default GoalFormFields;