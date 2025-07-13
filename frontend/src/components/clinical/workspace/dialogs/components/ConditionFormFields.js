/**
 * ConditionFormFields Component
 * Specialized form fields for Condition resource management
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
  Box
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { format } from 'date-fns';
import ResourceSearchAutocomplete from '../../../../search/ResourceSearchAutocomplete';
import { useCatalogConditionSearch } from '../../../../../hooks/useResourceSearch';
import {
  CLINICAL_STATUS_OPTIONS,
  VERIFICATION_STATUS_OPTIONS,
  CONDITION_CATEGORIES,
  SEVERITY_OPTIONS,
  getStatusColor,
  getProblemDisplay
} from '../../../../utils/fhir/ConditionConverter';

const ConditionFormFields = ({ formData = {}, errors = {}, onChange, disabled }) => {
  // Use catalog-enhanced condition search hook
  const conditionSearch = useCatalogConditionSearch({
    debounceMs: 300,
    minQueryLength: 2
  });

  // Provide safe defaults for form data to prevent undefined values
  const safeFormData = {
    selectedProblem: formData.selectedProblem || null,
    problemText: formData.problemText || '',
    clinicalStatus: formData.clinicalStatus || 'active',
    verificationStatus: formData.verificationStatus || 'confirmed',
    severity: formData.severity || '',
    onsetDate: formData.onsetDate || null,
    category: formData.category || 'problem-list-item',
    notes: formData.notes || ''
  };

  return (
    <Stack spacing={3}>
      <Grid container spacing={2}>
        {/* Problem Search */}
        <Grid item xs={12}>
          <Typography variant="subtitle2" gutterBottom>
            Problem/Condition
          </Typography>
          <ResourceSearchAutocomplete
            label="Search for conditions"
            placeholder="Type to search conditions from dynamic catalog..."
            searchService={conditionSearch.searchService}
            resourceTypes={['Condition']}
            value={safeFormData.selectedProblem}
            onChange={(event, newValue) => {
              onChange('selectedProblem', newValue);
              onChange('problemText', newValue ? (newValue.display || newValue.code?.text || '') : safeFormData.problemText);
            }}
            disabled={disabled}
            error={!!errors.selectedProblem}
            helperText={errors.selectedProblem || "Search conditions from dynamic clinical catalog"}
            freeSolo={false}
            showCacheStatus={true}
            enableCache={true}
            cacheTTL={10}
            debounceMs={300}
            minQueryLength={2}
            getOptionLabel={(option) => {
              if (typeof option === 'string') return option;
              return option.display || option.code?.text || option.id || 'Unknown condition';
            }}
            getOptionKey={(option) => {
              if (typeof option === 'string') return option;
              return `condition-${option.id || option.code?.coding?.[0]?.code || Math.random()}`;
            }}
            renderOption={(props, option) => {
              const { key, ...otherProps } = props;
              const display = option.display || option.code?.text || 'Unknown condition';
              const code = option.code?.coding?.[0]?.code || option.id;
              const frequency = option.frequency || 0;
              const source = option.searchSource || 'catalog';
              
              return (
                <Box component="li" key={key} {...otherProps}>
                  <Stack sx={{ width: '100%' }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {display}
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                      {code && (
                        <Chip 
                          label={`SNOMED: ${code}`} 
                          size="small" 
                          variant="outlined"
                          color="primary"
                        />
                      )}
                      {frequency > 0 && (
                        <Chip 
                          label={`Freq: ${frequency}`} 
                          size="small" 
                          variant="outlined"
                          color="secondary"
                        />
                      )}
                      <Chip 
                        label={source} 
                        size="small" 
                        variant="outlined"
                        color={source === 'catalog' ? 'success' : 'default'}
                      />
                    </Stack>
                  </Stack>
                </Box>
              );
            }}
          />
        </Grid>

        {/* Custom Problem Text */}
        <Grid item xs={12}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Or enter a custom problem description:
          </Typography>
          <TextField
            fullWidth
            label="Custom Problem Description"
            value={safeFormData.problemText}
            onChange={(e) => {
              onChange('problemText', e.target.value);
              onChange('selectedProblem', null);
            }}
            variant="outlined"
            disabled={disabled}
            error={!!errors.problemText}
            helperText={errors.problemText || "Enter a problem not found in the search results"}
            multiline
            rows={2}
          />
        </Grid>

        {/* Clinical Status and Verification Status */}
        <Grid item xs={6}>
          <FormControl fullWidth error={!!errors.clinicalStatus}>
            <InputLabel>Clinical Status</InputLabel>
            <Select
              value={safeFormData.clinicalStatus}
              label="Clinical Status"
              disabled={disabled}
              onChange={(e) => onChange('clinicalStatus', e.target.value)}
            >
              {CLINICAL_STATUS_OPTIONS.map(status => (
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

        <Grid item xs={6}>
          <FormControl fullWidth error={!!errors.verificationStatus}>
            <InputLabel>Verification Status</InputLabel>
            <Select
              value={safeFormData.verificationStatus}
              label="Verification Status"
              disabled={disabled}
              onChange={(e) => onChange('verificationStatus', e.target.value)}
            >
              {VERIFICATION_STATUS_OPTIONS.map(status => (
                <MenuItem key={status.value} value={status.value}>
                  {status.display}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Category and Severity */}
        <Grid item xs={6}>
          <FormControl fullWidth error={!!errors.category}>
            <InputLabel>Category</InputLabel>
            <Select
              value={safeFormData.category}
              label="Category"
              disabled={disabled}
              onChange={(e) => onChange('category', e.target.value)}
            >
              {CONDITION_CATEGORIES.map(category => (
                <MenuItem key={category.value} value={category.value}>
                  {category.display}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={6}>
          <FormControl fullWidth error={!!errors.severity}>
            <InputLabel>Severity</InputLabel>
            <Select
              value={safeFormData.severity}
              label="Severity"
              disabled={disabled}
              onChange={(e) => onChange('severity', e.target.value)}
            >
              <MenuItem value="">
                <em>Not specified</em>
              </MenuItem>
              {SEVERITY_OPTIONS.map(severity => (
                <MenuItem key={severity.value} value={severity.value}>
                  {severity.display}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Onset Date */}
        <Grid item xs={12}>
          <DatePicker
            label="Onset Date"
            value={safeFormData.onsetDate}
            disabled={disabled}
            onChange={(newValue) => onChange('onsetDate', newValue)}
            slotProps={{
              textField: { 
                fullWidth: true,
                error: !!errors.onsetDate,
                helperText: errors.onsetDate || "When did this problem/condition start?"
              }
            }}
            maxDate={new Date()}
          />
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
            helperText={errors.notes || "Additional clinical notes about this condition"}
            placeholder="Clinical notes, context, or additional information..."
          />
        </Grid>
      </Grid>

      {/* Preview */}
      {(safeFormData.selectedProblem || safeFormData.problemText) && (
        <Box sx={{ p: 2, backgroundColor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            Preview:
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
              {getProblemDisplay(safeFormData)}
            </Typography>
            <Chip 
              label={safeFormData.clinicalStatus} 
              size="small" 
              color={getStatusColor(safeFormData.clinicalStatus)}
            />
            <Chip 
              label={safeFormData.verificationStatus} 
              size="small" 
              variant="outlined"
            />
            {safeFormData.severity && (
              <Chip 
                label={safeFormData.severity} 
                size="small" 
                color="warning"
                variant="outlined"
              />
            )}
          </Stack>
          <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Category: {CONDITION_CATEGORIES.find(c => c.value === safeFormData.category)?.display}
            </Typography>
          </Stack>
          {safeFormData.onsetDate && (
            <Typography variant="caption" color="text.secondary">
              Onset: {format(safeFormData.onsetDate, 'MMM d, yyyy')}
            </Typography>
          )}
        </Box>
      )}
    </Stack>
  );
};

export default ConditionFormFields;