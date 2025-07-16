/**
 * MedicationFormFields Component
 * Specialized form fields for MedicationRequest resource management
 */
import React, { useState, useMemo, useCallback } from 'react';
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
  Divider,
  InputAdornment
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { format } from 'date-fns';
import ResourceSearchAutocomplete from '../../../../search/ResourceSearchAutocomplete';
import { useCatalogMedicationSearch } from '../../../../../hooks/useResourceSearch';
import {
  MEDICATION_STATUS_OPTIONS,
  MEDICATION_PRIORITY_OPTIONS,
  DOSING_FREQUENCIES,
  ROUTES,
  INTENT_OPTIONS,
  getStatusColor,
  getPriorityColor,
  getMedicationDisplay
} from '../../../../../core/fhir/converters/MedicationConverter';

const MedicationFormFields = ({ formData = {}, errors = {}, onChange, disabled }) => {
  // Use catalog-enhanced medication search hook
  const medicationSearch = useCatalogMedicationSearch({
    debounceMs: 300,
    minQueryLength: 2
  });

  // Provide safe defaults for form data with useMemo to prevent recreation
  const safeFormData = useMemo(() => ({
    selectedMedication: formData.selectedMedication || null,
    customMedication: formData.customMedication || '',
    dosage: formData.dosage || '',
    route: formData.route || 'oral',
    frequency: formData.frequency || 'once-daily',
    duration: formData.duration || '',
    quantity: formData.quantity || '',
    refills: formData.refills || 0,
    startDate: formData.startDate || new Date(),
    endDate: formData.endDate || null,
    instructions: formData.instructions || '',
    indication: formData.indication || '',
    priority: formData.priority || 'routine',
    status: formData.status || 'active',
    intent: formData.intent || 'order',
    genericSubstitution: formData.genericSubstitution !== undefined ? formData.genericSubstitution : true,
    notes: formData.notes || ''
  }), [formData]);

  // Memoize onChange handlers to prevent recreation
  const handleNotesChange = useCallback((e) => {
    onChange('notes', e.target.value);
  }, [onChange]);

  return (
    <Stack spacing={3}>
      <Grid container spacing={2}>
        {/* Medication Search */}
        <Grid item xs={12}>
          <Typography variant="subtitle2" gutterBottom>
            Medication
          </Typography>
          <ResourceSearchAutocomplete
            label="Search for medications"
            placeholder="Type to search medications from dynamic catalog..."
            searchService={medicationSearch.searchService}
            resourceTypes={['Medication']}
            value={safeFormData.selectedMedication}
            onChange={(event, newValue) => {
              onChange('selectedMedication', newValue);
              onChange('customMedication', newValue ? (newValue.display || newValue.code?.text || '') : safeFormData.customMedication);
            }}
            disabled={disabled}
            error={!!errors.selectedMedication}
            helperText={errors.selectedMedication || "Search medications from dynamic clinical catalog"}
            freeSolo={false}
            showCacheStatus={true}
            enableCache={true}
            cacheTTL={10}
            debounceMs={300}
            minQueryLength={2}
            groupBy={(option) => option.searchSource || 'catalog'}
            getOptionLabel={(option) => {
              if (typeof option === 'string') return option;
              return option.display || option.code?.text || option.id || 'Unknown medication';
            }}
            getOptionKey={(option) => {
              if (typeof option === 'string') return option;
              return `medication-${option.id || option.code?.coding?.[0]?.code || Math.random()}`;
            }}
            renderOption={(props, option) => {
              const { key, ...otherProps } = props;
              const display = option.display || option.code?.text || 'Unknown medication';
              const code = option.code?.coding?.[0]?.code || option.id;
              const frequency = option.frequency || 0;
              const source = option.searchSource || 'catalog';
              const strength = option.strength || '';
              const form = option.form || '';
              
              return (
                <Box component="li" key={key} {...otherProps}>
                  <Stack sx={{ width: '100%' }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {display}
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      {code && (
                        <Chip 
                          label={`RxNorm: ${code}`} 
                          size="small" 
                          variant="outlined"
                          color="primary"
                        />
                      )}
                      {strength && (
                        <Chip 
                          label={strength} 
                          size="small" 
                          variant="outlined"
                          color="secondary"
                        />
                      )}
                      {form && (
                        <Chip 
                          label={form} 
                          size="small" 
                          variant="outlined"
                          color="info"
                        />
                      )}
                      {frequency > 0 && (
                        <Chip 
                          label={`Freq: ${frequency}`} 
                          size="small" 
                          variant="outlined"
                          color="warning"
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

        {/* Custom Medication */}
        <Grid item xs={12}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Or enter a custom medication:
          </Typography>
          <TextField
            fullWidth
            label="Custom Medication"
            value={safeFormData.customMedication}
            onChange={(e) => {
              onChange('customMedication', e.target.value);
              onChange('selectedMedication', null);
            }}
            variant="outlined"
            disabled={disabled}
            error={!!errors.customMedication}
            helperText={errors.customMedication || "Enter a medication not found in the search results"}
          />
        </Grid>

        <Grid item xs={12}>
          <Divider>
            <Typography variant="caption" color="text.secondary">
              Prescription Details
            </Typography>
          </Divider>
        </Grid>

        {/* Dosage and Route */}
        <Grid item xs={6}>
          <TextField
            fullWidth
            label="Dosage"
            value={safeFormData.dosage}
            onChange={(e) => onChange('dosage', e.target.value)}
            variant="outlined"
            disabled={disabled}
            error={!!errors.dosage}
            helperText={errors.dosage || "e.g., 10mg, 1 tablet, 5ml"}
            placeholder="Enter dosage amount"
            required
          />
        </Grid>

        <Grid item xs={6}>
          <FormControl fullWidth error={!!errors.route}>
            <InputLabel>Route</InputLabel>
            <Select
              value={safeFormData.route}
              label="Route"
              disabled={disabled}
              onChange={(e) => onChange('route', e.target.value)}
              required
            >
              {ROUTES.map(route => (
                <MenuItem key={route.value} value={route.value}>
                  {route.display}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Frequency and Duration */}
        <Grid item xs={6}>
          <FormControl fullWidth error={!!errors.frequency}>
            <InputLabel>Frequency</InputLabel>
            <Select
              value={safeFormData.frequency}
              label="Frequency"
              disabled={disabled}
              onChange={(e) => onChange('frequency', e.target.value)}
              required
            >
              {DOSING_FREQUENCIES.map(freq => (
                <MenuItem key={freq.value} value={freq.value}>
                  <Stack direction="row" justifyContent="space-between" sx={{ width: '100%' }}>
                    <Typography variant="body2">{freq.display}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {freq.timing}
                    </Typography>
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={6}>
          <TextField
            fullWidth
            label="Duration"
            value={safeFormData.duration}
            onChange={(e) => onChange('duration', e.target.value)}
            variant="outlined"
            disabled={disabled}
            error={!!errors.duration}
            helperText={errors.duration || "Supply duration in days"}
            placeholder="e.g., 30"
            InputProps={{
              endAdornment: <InputAdornment position="end">days</InputAdornment>
            }}
          />
        </Grid>

        {/* Quantity and Refills */}
        <Grid item xs={6}>
          <TextField
            fullWidth
            label="Quantity"
            value={safeFormData.quantity}
            onChange={(e) => onChange('quantity', e.target.value)}
            variant="outlined"
            disabled={disabled}
            error={!!errors.quantity}
            helperText={errors.quantity || "Total quantity to dispense"}
            placeholder="e.g., 30"
            required
          />
        </Grid>

        <Grid item xs={6}>
          <TextField
            fullWidth
            label="Refills"
            type="number"
            value={safeFormData.refills}
            onChange={(e) => onChange('refills', parseInt(e.target.value) || 0)}
            variant="outlined"
            disabled={disabled}
            error={!!errors.refills}
            helperText={errors.refills || "Number of refills allowed"}
            inputProps={{ min: 0, max: 12 }}
          />
        </Grid>

        <Grid item xs={12}>
          <Divider>
            <Typography variant="caption" color="text.secondary">
              Clinical Information
            </Typography>
          </Divider>
        </Grid>

        {/* Status, Priority, Intent */}
        <Grid item xs={4}>
          <FormControl fullWidth error={!!errors.status}>
            <InputLabel>Status</InputLabel>
            <Select
              value={safeFormData.status}
              label="Status"
              disabled={disabled}
              onChange={(e) => onChange('status', e.target.value)}
              required
            >
              {MEDICATION_STATUS_OPTIONS.map(status => (
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
          <FormControl fullWidth error={!!errors.priority}>
            <InputLabel>Priority</InputLabel>
            <Select
              value={safeFormData.priority}
              label="Priority"
              disabled={disabled}
              onChange={(e) => onChange('priority', e.target.value)}
              required
            >
              {MEDICATION_PRIORITY_OPTIONS.map(priority => (
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

        <Grid item xs={4}>
          <FormControl fullWidth error={!!errors.intent}>
            <InputLabel>Intent</InputLabel>
            <Select
              value={safeFormData.intent}
              label="Intent"
              disabled={disabled}
              onChange={(e) => onChange('intent', e.target.value)}
              required
            >
              {INTENT_OPTIONS.map(intent => (
                <MenuItem key={intent.value} value={intent.value}>
                  {intent.display}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Dates */}
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
                helperText: errors.startDate || "When to start the medication"
              }
            }}
            minDate={new Date()}
          />
        </Grid>

        <Grid item xs={6}>
          <DatePicker
            label="End Date (Optional)"
            value={safeFormData.endDate}
            disabled={disabled}
            onChange={(newValue) => onChange('endDate', newValue)}
            slotProps={{
              textField: { 
                fullWidth: true,
                error: !!errors.endDate,
                helperText: errors.endDate || "When to stop the medication (optional)"
              }
            }}
            minDate={safeFormData.startDate}
          />
        </Grid>

        {/* Instructions and Indication */}
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Special Instructions"
            value={safeFormData.instructions}
            disabled={disabled}
            onChange={(e) => onChange('instructions', e.target.value)}
            variant="outlined"
            multiline
            rows={2}
            error={!!errors.instructions}
            helperText={errors.instructions || "Special dosing instructions for the patient"}
            placeholder="e.g., Take with food, Take at bedtime..."
          />
        </Grid>

        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Indication"
            value={safeFormData.indication}
            disabled={disabled}
            onChange={(e) => onChange('indication', e.target.value)}
            variant="outlined"
            error={!!errors.indication}
            helperText={errors.indication || "What condition is this medication treating?"}
            placeholder="e.g., Hypertension, Diabetes, Pain management..."
          />
        </Grid>

        {/* Generic Substitution */}
        <Grid item xs={12}>
          <FormControlLabel
            control={
              <Checkbox
                checked={safeFormData.genericSubstitution}
                onChange={(e) => onChange('genericSubstitution', e.target.checked)}
                disabled={disabled}
              />
            }
            label="Allow generic substitution"
          />
        </Grid>

        {/* Additional Notes */}
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Additional Notes"
            value={safeFormData.notes}
            disabled={disabled}
            onChange={handleNotesChange}
            variant="outlined"
            multiline
            rows={3}
            error={!!errors.notes}
            helperText={errors.notes || "Additional clinical notes about this prescription"}
            placeholder="Clinical notes, drug interactions, patient preferences..."
          />
        </Grid>
      </Grid>

      {/* Preview */}
      {(safeFormData.selectedMedication || safeFormData.customMedication) && safeFormData.dosage && (
        <Box sx={{ p: 2, backgroundColor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            Prescription Preview:
          </Typography>
          <Stack spacing={1}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                {getMedicationDisplay(safeFormData)}
              </Typography>
              <Chip 
                label={safeFormData.status} 
                size="small" 
                color={getStatusColor(safeFormData.status)}
              />
              <Chip 
                label={safeFormData.priority} 
                size="small" 
                color={getPriorityColor(safeFormData.priority)}
                variant="outlined"
              />
            </Stack>
            
            <Typography variant="body2">
              <strong>Dosage:</strong> {safeFormData.dosage} {ROUTES.find(r => r.value === safeFormData.route)?.display} {DOSING_FREQUENCIES.find(f => f.value === safeFormData.frequency)?.display}
            </Typography>
            
            {safeFormData.quantity && (
              <Typography variant="body2">
                <strong>Dispense:</strong> {safeFormData.quantity} doses
                {safeFormData.refills > 0 && ` (${safeFormData.refills} refills)`}
                {safeFormData.duration && ` • ${safeFormData.duration} day supply`}
              </Typography>
            )}
            
            {safeFormData.instructions && (
              <Typography variant="body2">
                <strong>Instructions:</strong> {safeFormData.instructions}
              </Typography>
            )}
            
            {safeFormData.indication && (
              <Typography variant="body2">
                <strong>For:</strong> {safeFormData.indication}
              </Typography>
            )}
            
            <Typography variant="caption" color="text.secondary">
              Start: {format(safeFormData.startDate, 'MMM d, yyyy')}
              {safeFormData.endDate && ` • End: ${format(safeFormData.endDate, 'MMM d, yyyy')}`}
              {!safeFormData.genericSubstitution && " • Brand name only"}
            </Typography>
          </Stack>
        </Box>
      )}
    </Stack>
  );
};

export default React.memo(MedicationFormFields);