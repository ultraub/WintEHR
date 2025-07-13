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
  Autocomplete,
  Box,
  CircularProgress
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { format } from 'date-fns';
import { cdsClinicalDataService } from '../../../../../services/cdsClinicalDataService';
import {
  CLINICAL_STATUS_OPTIONS,
  VERIFICATION_STATUS_OPTIONS,
  CONDITION_CATEGORIES,
  SEVERITY_OPTIONS,
  getStatusColor,
  getProblemDisplay
} from '../config/conditionDialogConfig';

const ConditionFormFields = ({ formData = {}, errors = {}, onChange, disabled }) => {
  const [searchLoading, setSearchLoading] = useState(false);
  const [conditionOptions, setConditionOptions] = useState([]);

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

  // Initialize options with existing problem if in edit mode
  React.useEffect(() => {
    if (safeFormData.selectedProblem && conditionOptions.length === 0) {
      setConditionOptions([safeFormData.selectedProblem]);
    }
  }, [safeFormData.selectedProblem]);

  // Search for conditions as user types using dynamic catalog
  const handleSearchConditions = async (query) => {
    if (!query || query.length < 2) {
      setConditionOptions([]);
      return;
    }

    setSearchLoading(true);
    try {
      const results = await cdsClinicalDataService.getDynamicConditionCatalog(query, 20);
      setConditionOptions(results.map(cond => ({
        code: cond.code,
        display: cond.display,
        system: 'http://snomed.info/sct', // Most conditions are SNOMED
        frequency_count: cond.frequency_count,
        source: 'dynamic'
      })));
    } catch (error) {
      setConditionOptions([]);
    } finally {
      setSearchLoading(false);
    }
  };

  return (
    <Stack spacing={3}>
      <Grid container spacing={2}>
        {/* Problem Search */}
        <Grid item xs={12}>
          <Typography variant="subtitle2" gutterBottom>
            Problem/Condition
          </Typography>
          <Autocomplete
            options={conditionOptions}
            getOptionLabel={(option) => option.display}
            value={safeFormData.selectedProblem}
            loading={searchLoading}
            disabled={disabled}
            isOptionEqualToValue={(option, value) => {
              if (!option || !value) return false;
              return option.code === value.code && option.system === value.system;
            }}
            onInputChange={(event, value) => {
              handleSearchConditions(value);
            }}
            onChange={(event, newValue) => {
              onChange('selectedProblem', newValue);
              onChange('problemText', newValue ? newValue.display : safeFormData.problemText);
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Search for conditions"
                placeholder="Type to search conditions..."
                variant="outlined"
                error={!!errors.selectedProblem}
                helperText={errors.selectedProblem}
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {searchLoading ? <CircularProgress color="inherit" size={20} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
            renderOption={(props, option) => (
              <Box component="li" {...props}>
                <Stack>
                  <Typography variant="body2">{option.display}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    SNOMED: {option.code} • Frequency: {option.frequency_count || 0} • Source: {option.source}
                  </Typography>
                </Stack>
              </Box>
            )}
            noOptionsText={
              searchLoading ? "Searching..." : "No conditions found"
            }
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