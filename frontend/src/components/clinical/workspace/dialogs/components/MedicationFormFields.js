/**
 * MedicationFormFields Component
 * Specialized form fields for MedicationRequest resource management
 */
import React, { useMemo, useCallback } from 'react';
import {
  Grid,
  Typography,
  Chip,
  Stack,
  Box,
  FormControlLabel,
  Checkbox,
  Divider,
  InputAdornment,
  Alert,
  Paper,
  useTheme,
  alpha,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { format } from 'date-fns';
import ResourceSearchAutocomplete from '../../../../search/ResourceSearchAutocomplete';
import { useCatalogMedicationSearch } from '../../../../../hooks/useResourceSearch';
import ClinicalTextField from '../../../common/ClinicalTextField';
import ClinicalSelect from '../../../common/ClinicalSelect';
import { ClinicalResourceCard } from '../../../shared/cards';
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
import {
  Warning as WarningIcon,
  Info as InfoIcon,
  LocalPharmacy as PharmacyIcon,
  Schedule as ScheduleIcon,
  Science as ScienceIcon
} from '@mui/icons-material';

const MedicationFormFields = ({ 
  formData = {}, 
  errors = {}, 
  onChange, 
  disabled,
  clinicalContext,
  department,
  mode = 'add' 
}) => {
  const theme = useTheme();
  
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

  // Determine urgency based on priority
  const getFormUrgency = () => {
    if (safeFormData.priority === 'urgent' || safeFormData.priority === 'stat') {
      return 'urgent';
    }
    if (safeFormData.priority === 'asap') {
      return 'high';
    }
    return 'normal';
  };

  const formUrgency = getFormUrgency();

  // Prepare enhanced options
  const priorityOptions = (MEDICATION_PRIORITY_OPTIONS || []).map(opt => ({
    value: opt.value,
    label: opt.label,
    category: 'Priority',
    severity: opt.value === 'stat' ? 'critical' : opt.value === 'urgent' ? 'severe' : null
  }));

  const routeOptions = (ROUTES || []).map(opt => ({
    value: opt.value,
    label: opt.label,
    category: opt.category || 'Route'
  }));

  const frequencyOptions = (DOSING_FREQUENCIES || []).map(opt => ({
    value: opt.value,
    label: opt.label,
    category: 'Frequency',
    code: opt.code
  }));

  // Calculate duration from dates
  const calculateDuration = useCallback(() => {
    if (safeFormData.startDate && safeFormData.endDate) {
      const start = new Date(safeFormData.startDate);
      const end = new Date(safeFormData.endDate);
      const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      return `${days} days`;
    }
    return '';
  }, [safeFormData.startDate, safeFormData.endDate]);

  // Handle medication selection
  const handleMedicationChange = useCallback((event, newValue) => {
    onChange('selectedMedication', newValue);
    onChange('customMedication', newValue ? (newValue.display || newValue.code?.text || '') : safeFormData.customMedication);
  }, [onChange, safeFormData.customMedication]);

  // Memoize onChange handlers to prevent recreation
  const handleNotesChange = useCallback((e) => {
    onChange('notes', e.target.value);
  }, [onChange]);

  return (
    <Stack spacing={3}>
      {/* Priority Alert */}
      {(safeFormData.priority === 'stat' || safeFormData.priority === 'urgent') && (
        <Alert 
          severity="warning" 
          icon={<WarningIcon />}
          sx={{ 
            borderLeft: `4px solid ${theme.palette.warning?.main || '#ff9800'}`,
            backgroundColor: alpha(theme.palette.warning?.main || '#ff9800', 0.05)
          }}
        >
          <Typography variant="body2" fontWeight={600}>
            {safeFormData.priority === 'stat' ? 'STAT Order' : 'Urgent Order'}
          </Typography>
          <Typography variant="caption">
            This medication will be prioritized for immediate processing
          </Typography>
        </Alert>
      )}

      {/* Medication Selection */}
      <ClinicalResourceCard
        title="Medication Details"
        icon={<PharmacyIcon />}
        urgency={formUrgency}
        department={department}
        clinicalContext={clinicalContext}
        variant="clinical"
      >
        <Stack spacing={3}>
          {/* Medication Search */}
          <Box>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
              Medication
            </Typography>
            <ResourceSearchAutocomplete
              label="Search for medications"
              placeholder="Type to search medications from dynamic catalog..."
              searchService={medicationSearch.searchService}
              resourceTypes={['Medication']}
              value={safeFormData.selectedMedication}
              onChange={handleMedicationChange}
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
                const display = option.display || option.generic_name || option.code?.text || option.id || 'Unknown medication';
                if (option.strength) {
                  return `${display} ${option.strength}`;
                }
                return display;
              }}
              getOptionKey={(option) => {
                if (typeof option === 'string') return option;
                const code = option.code || option.rxnorm_code || option.code?.coding?.[0]?.code || option.id;
                return `medication-${code}-${option.system || ''}`;
              }}
              renderOption={(props, option) => {
                const { key, ...otherProps } = props;
                const display = option.display || option.generic_name || option.code?.text || 'Unknown medication';
                const code = option.code || option.rxnorm_code || option.code?.coding?.[0]?.code || option.id;
                const frequency = option.frequency || option.usage_count || 0;
                const source = option.source || option.searchSource || 'catalog';
                const strength = option.strength || '';
                const form = option.dosage_form || option.form || '';
                const route = option.route || '';
                
                return (
                  <Box component="li" key={key} {...otherProps}>
                    <Stack sx={{ width: '100%' }}>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {display}
                        {option.brand_name && (
                          <Typography component="span" variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>
                            ({option.brand_name})
                          </Typography>
                        )}
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
                        {route && (
                          <Chip 
                            label={route} 
                            size="small" 
                            variant="outlined"
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
          </Box>

          {/* Custom Medication */}
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Or enter a custom medication:
            </Typography>
            <ClinicalTextField
              fullWidth
              label="Custom Medication Name"
              value={safeFormData.customMedication}
              onChange={(e) => {
                onChange('customMedication', e.target.value);
                onChange('selectedMedication', null);
              }}
              placeholder="Enter medication if not found in search"
              disabled={disabled || !!safeFormData.selectedMedication}
              clinicalHint="Use for compounded medications or special formulations"
              department={department}
              clinicalContext={clinicalContext}
            />
          </Box>
        </Stack>
      </ClinicalResourceCard>

      {/* Dosing Information */}
      <Paper 
        sx={{ 
          p: 2, 
          backgroundColor: theme.clinical?.surfaces?.secondary || theme.palette.background.paper,
          border: `1px solid ${theme.palette.divider}`
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
          <ScheduleIcon color="action" />
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Dosing Information
          </Typography>
        </Stack>
        
        <Grid container spacing={2}>
          {/* Dosage */}
          <Grid item xs={12} sm={6}>
            <ClinicalTextField
              fullWidth
              label="Dosage"
              value={safeFormData.dosage}
              onChange={(e) => onChange('dosage', e.target.value)}
              placeholder="e.g., 10 mg, 2 tablets"
              required
              error={!!errors.dosage}
              helperText={errors.dosage}
              disabled={disabled}
              clinicalHint="Specify amount and unit"
              department={department}
              clinicalContext={clinicalContext}
            />
          </Grid>

          {/* Route */}
          <Grid item xs={12} sm={6}>
            <ClinicalSelect
              label="Route"
              value={safeFormData.route}
              onChange={(e) => onChange('route', e.target.value)}
              options={routeOptions}
              required
              disabled={disabled}
              showCategories={true}
              department={department}
              clinicalContext={clinicalContext}
            />
          </Grid>

          {/* Frequency */}
          <Grid item xs={12} sm={6}>
            <ClinicalSelect
              label="Frequency"
              value={safeFormData.frequency}
              onChange={(e) => onChange('frequency', e.target.value)}
              options={frequencyOptions}
              required
              disabled={disabled}
              showClinicalCodes={true}
              frequentOptions={['once-daily', 'twice-daily', 'three-times-daily', 'as-needed']}
              department={department}
              clinicalContext={clinicalContext}
            />
          </Grid>

          {/* Priority */}
          <Grid item xs={12} sm={6}>
            <ClinicalSelect
              label="Priority"
              value={safeFormData.priority}
              onChange={(e) => onChange('priority', e.target.value)}
              options={priorityOptions}
              disabled={disabled}
              showSeverityIndicators={true}
              department={department}
              clinicalContext={clinicalContext}
              urgency={formUrgency}
            />
          </Grid>

          {/* Start Date */}
          <Grid item xs={12} sm={6}>
            <DatePicker
              label="Start Date"
              value={safeFormData.startDate}
              onChange={(date) => onChange('startDate', date)}
              disabled={disabled}
              minDate={new Date()}
              slotProps={{
                textField: {
                  fullWidth: true,
                  error: !!errors.startDate,
                  helperText: errors.startDate
                }
              }}
            />
          </Grid>

          {/* End Date */}
          <Grid item xs={12} sm={6}>
            <DatePicker
              label="End Date (Optional)"
              value={safeFormData.endDate}
              onChange={(date) => onChange('endDate', date)}
              disabled={disabled}
              minDate={safeFormData.startDate || new Date()}
              slotProps={{
                textField: {
                  fullWidth: true,
                  error: !!errors.endDate,
                  helperText: errors.endDate || calculateDuration()
                }
              }}
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Dispensing Information */}
      <Paper 
        sx={{ 
          p: 2, 
          backgroundColor: theme.palette.background.paper,
          border: `1px solid ${theme.palette.divider}`
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
          <ScienceIcon color="action" />
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Dispensing Information
          </Typography>
        </Stack>
        
        <Grid container spacing={2}>
          {/* Quantity */}
          <Grid item xs={12} sm={4}>
            <ClinicalTextField
              fullWidth
              label="Quantity"
              value={safeFormData.quantity}
              onChange={(e) => onChange('quantity', e.target.value)}
              placeholder="e.g., 30"
              required
              error={!!errors.quantity}
              helperText={errors.quantity}
              disabled={disabled}
              unit="units"
              type="number"
              department={department}
              clinicalContext={clinicalContext}
            />
          </Grid>

          {/* Refills */}
          <Grid item xs={12} sm={4}>
            <ClinicalTextField
              fullWidth
              label="Refills"
              value={safeFormData.refills}
              onChange={(e) => onChange('refills', parseInt(e.target.value) || 0)}
              error={!!errors.refills}
              helperText={errors.refills}
              disabled={disabled}
              type="number"
              inputProps={{ min: 0, max: 12 }}
              department={department}
              clinicalContext={clinicalContext}
            />
          </Grid>

          {/* Generic Substitution */}
          <Grid item xs={12} sm={4}>
            <Box sx={{ pt: 2 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={safeFormData.genericSubstitution}
                    onChange={(e) => onChange('genericSubstitution', e.target.checked)}
                    disabled={disabled}
                  />
                }
                label="Generic substitution allowed"
              />
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Additional Information */}
      <Stack spacing={2}>
        {/* Indication */}
        <ClinicalTextField
          fullWidth
          label="Indication"
          value={safeFormData.indication}
          onChange={(e) => onChange('indication', e.target.value)}
          placeholder="What condition is this medication treating?"
          required
          error={!!errors.indication}
          helperText={errors.indication}
          disabled={disabled}
          clinicalHint="This helps pharmacists verify appropriate use"
          department={department}
          clinicalContext={clinicalContext}
        />

        {/* Patient Instructions */}
        <ClinicalTextField
          fullWidth
          multiline
          rows={2}
          label="Patient Instructions"
          value={safeFormData.instructions}
          onChange={(e) => onChange('instructions', e.target.value)}
          placeholder="Special instructions for the patient..."
          disabled={disabled}
          clinicalHint="These will appear on the medication label"
          department={department}
          clinicalContext={clinicalContext}
        />

        {/* Clinical Notes */}
        <ClinicalTextField
          fullWidth
          multiline
          rows={2}
          label="Clinical Notes (Internal)"
          value={safeFormData.notes}
          onChange={handleNotesChange}
          placeholder="Additional notes for healthcare providers..."
          disabled={disabled}
          helperText="These notes are for clinical staff only"
          department={department}
          clinicalContext={clinicalContext}
        />
      </Stack>

      {/* Prescription Summary */}
      {(safeFormData.selectedMedication || safeFormData.customMedication) && safeFormData.dosage && (
        <Paper 
          variant="outlined" 
          sx={{ 
            p: 2, 
            backgroundColor: alpha(theme.palette.info?.main || '#2196f3', 0.05),
            borderColor: theme.palette.info?.main || '#2196f3'
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <InfoIcon fontSize="small" sx={{ color: theme.palette.info?.main || '#2196f3' }} />
            <Typography variant="subtitle2" sx={{ color: theme.palette.info?.main || '#2196f3' }}>
              Prescription Summary
            </Typography>
          </Stack>
          <Typography variant="body2">
            <strong>Medication:</strong> {getMedicationDisplay(safeFormData.selectedMedication) || safeFormData.customMedication}
          </Typography>
          <Typography variant="body2">
            <strong>Sig:</strong> {safeFormData.dosage} {safeFormData.route} {safeFormData.frequency}
          </Typography>
          <Typography variant="body2">
            <strong>Dispense:</strong> {safeFormData.quantity} units, {safeFormData.refills} refills
          </Typography>
          {safeFormData.indication && (
            <Typography variant="body2">
              <strong>For:</strong> {safeFormData.indication}
            </Typography>
          )}
        </Paper>
      )}
    </Stack>
  );
};

export default MedicationFormFields;