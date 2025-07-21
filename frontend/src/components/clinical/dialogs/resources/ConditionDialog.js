/**
 * ConditionDialog Component
 * FHIR-compliant dialog for creating/editing clinical conditions (problems)
 * 
 * Updated 2025-01-21: Simplified UI with reduced icons and new fhirClient
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Grid,
  Stack,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  TextField,
  Paper,
  Autocomplete,
  FormControlLabel,
  Switch,
  RadioGroup,
  Radio,
  useTheme,
  alpha
} from '@mui/material';
import SimplifiedClinicalDialog from '../../common/SimplifiedClinicalDialog';
import { fhirClient } from '../../../../core/fhir/services/fhirClient';
import { notificationService } from '../../../../services/notificationService';
import { getClinicalCatalog } from '../../../../services/cdsClinicalDataService';
import { clinicalCDSService } from '../../../../services/clinicalCDSService';
import { format, parseISO } from 'date-fns';
import type { Condition } from '../../../../core/fhir/types';

// FHIR clinical status options
const CLINICAL_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'recurrence', label: 'Recurrence' },
  { value: 'relapse', label: 'Relapse' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'remission', label: 'Remission' },
  { value: 'resolved', label: 'Resolved' }
];

// FHIR verification status options
const VERIFICATION_STATUS_OPTIONS = [
  { value: 'unconfirmed', label: 'Unconfirmed' },
  { value: 'provisional', label: 'Provisional' },
  { value: 'differential', label: 'Differential' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'refuted', label: 'Refuted' },
  { value: 'entered-in-error', label: 'Entered in Error' }
];

// Severity levels
const SEVERITY_OPTIONS = [
  { value: 'mild', label: 'Mild' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'severe', label: 'Severe' }
];

// Category options
const CATEGORY_OPTIONS = [
  { value: 'problem-list-item', label: 'Problem List Item' },
  { value: 'encounter-diagnosis', label: 'Encounter Diagnosis' }
];

const ConditionDialog = ({
  open,
  onClose,
  mode = 'create',
  condition = null,
  patient,
  onSave,
  encounterId = null
}) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [conditionCatalog, setConditionCatalog] = useState([]);
  const [alerts, setAlerts] = useState([]);

  // Form state
  const [formData, setFormData] = useState({
    condition: null,
    clinicalStatus: 'active',
    verificationStatus: 'confirmed',
    severity: '',
    category: 'problem-list-item',
    onsetDate: format(new Date(), 'yyyy-MM-dd'),
    abatementDate: '',
    notes: '',
    isPrimary: false
  });

  // Load condition catalog
  useEffect(() => {
    const loadCatalog = async () => {
      try {
        setLoading(true);
        const catalog = await getClinicalCatalog('conditions');
        setConditionCatalog(catalog.items || []);
      } catch (error) {
        console.error('Failed to load condition catalog:', error);
        notificationService.error('Failed to load condition catalog');
      } finally {
        setLoading(false);
      }
    };

    if (open) {
      loadCatalog();
    }
  }, [open]);

  // Initialize form for edit mode
  useEffect(() => {
    if (condition && mode === 'edit') {
      setFormData({
        condition: {
          code: condition.code?.coding?.[0]?.code,
          system: condition.code?.coding?.[0]?.system,
          display: condition.code?.text || condition.code?.coding?.[0]?.display
        },
        clinicalStatus: condition.clinicalStatus?.coding?.[0]?.code || 'active',
        verificationStatus: condition.verificationStatus?.coding?.[0]?.code || 'confirmed',
        severity: condition.severity?.coding?.[0]?.code || '',
        category: condition.category?.[0]?.coding?.[0]?.code || 'problem-list-item',
        onsetDate: condition.onsetDateTime ? 
          format(parseISO(condition.onsetDateTime), 'yyyy-MM-dd') : '',
        abatementDate: condition.abatementDateTime ? 
          format(parseISO(condition.abatementDateTime), 'yyyy-MM-dd') : '',
        notes: condition.note?.[0]?.text || '',
        isPrimary: false
      });
    }
  }, [condition, mode]);

  const handleFieldChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setAlerts([]);

      // Validate required fields
      if (!formData.condition) {
        setAlerts([{ severity: 'error', message: 'Please select a condition' }]);
        return;
      }

      // Build FHIR Condition resource
      const conditionResource: Partial<Condition> = {
        resourceType: 'Condition',
        clinicalStatus: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
            code: formData.clinicalStatus,
            display: CLINICAL_STATUS_OPTIONS.find(opt => opt.value === formData.clinicalStatus)?.label
          }]
        },
        verificationStatus: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
            code: formData.verificationStatus,
            display: VERIFICATION_STATUS_OPTIONS.find(opt => opt.value === formData.verificationStatus)?.label
          }]
        },
        category: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/condition-category',
            code: formData.category,
            display: CATEGORY_OPTIONS.find(opt => opt.value === formData.category)?.label
          }]
        }],
        code: {
          coding: [{
            system: formData.condition.system || 'http://snomed.info/sct',
            code: formData.condition.code,
            display: formData.condition.display
          }],
          text: formData.condition.display
        },
        subject: {
          reference: `Patient/${patient.id}`,
          display: patient.name?.[0]?.given?.join(' ') + ' ' + patient.name?.[0]?.family
        },
        recordedDate: new Date().toISOString()
      };

      // Add optional fields
      if (formData.severity) {
        conditionResource.severity = {
          coding: [{
            system: 'http://snomed.info/sct',
            code: formData.severity,
            display: SEVERITY_OPTIONS.find(opt => opt.value === formData.severity)?.label
          }]
        };
      }

      if (formData.onsetDate) {
        conditionResource.onsetDateTime = new Date(formData.onsetDate).toISOString();
      }

      if (formData.abatementDate) {
        conditionResource.abatementDateTime = new Date(formData.abatementDate).toISOString();
      }

      if (formData.notes) {
        conditionResource.note = [{
          text: formData.notes,
          time: new Date().toISOString()
        }];
      }

      if (encounterId) {
        conditionResource.encounter = {
          reference: `Encounter/${encounterId}`
        };
      }

      // Save condition
      let result;
      if (mode === 'edit' && condition?.id) {
        result = await fhirClient.update('Condition', condition.id, {
          ...conditionResource,
          id: condition.id
        } as Condition);
        notificationService.fhirSuccess('Updated', 'Condition', condition.id);
      } else {
        result = await fhirClient.create('Condition', conditionResource);
        notificationService.fhirSuccess('Created', 'Condition', result.id);
      }

      // Fire CDS hooks for new conditions
      if (mode === 'create') {
        try {
          const cdsResult = await clinicalCDSService.fireConditionHooks({
            patient,
            condition: result,
            operation: 'create'
          });

          if (cdsResult.alerts && cdsResult.alerts.length > 0) {
            // Show CDS alerts
            cdsResult.alerts.forEach(alert => {
              notificationService.warning(alert.summary);
            });
          }
        } catch (error) {
          console.error('CDS hook failed:', error);
        }
      }

      // Call parent callback
      if (onSave) {
        onSave(result);
      }

      onClose();
    } catch (error) {
      console.error('Failed to save condition:', error);
      notificationService.fhirError(error, {
        operation: mode === 'edit' ? 'UPDATE' : 'CREATE',
        resourceType: 'Condition'
      });
      setAlerts([{ 
        severity: 'error', 
        message: 'Failed to save condition. Please try again.' 
      }]);
    } finally {
      setSaving(false);
    }
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
      case 'recurrence':
      case 'relapse':
        return theme.palette.error.main;
      case 'inactive':
        return theme.palette.grey[500];
      case 'remission':
      case 'resolved':
        return theme.palette.success.main;
      default:
        return theme.palette.text.primary;
    }
  };

  return (
    <SimplifiedClinicalDialog
      open={open}
      onClose={onClose}
      title={mode === 'edit' ? 'Edit Condition' : 'Add Condition'}
      subtitle={`For ${patient?.name?.[0]?.given?.join(' ')} ${patient?.name?.[0]?.family || ''}`}
      category="condition"
      loading={loading}
      alerts={alerts}
      actions={[
        {
          label: 'Cancel',
          onClick: onClose,
          variant: 'outlined'
        },
        {
          label: mode === 'edit' ? 'Update' : 'Add',
          onClick: handleSave,
          variant: 'contained',
          color: 'primary',
          disabled: saving || !formData.condition
        }
      ]}
    >
      <Stack spacing={3}>
        {/* Condition Selection */}
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle2" gutterBottom color="primary">
            Condition Details
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Autocomplete
                options={conditionCatalog}
                getOptionLabel={(option) => option.display || option.name || ''}
                value={formData.condition}
                onChange={(event, newValue) => handleFieldChange('condition', newValue)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Condition"
                    placeholder="Search conditions..."
                    variant="outlined"
                    size="small"
                    fullWidth
                    required
                  />
                )}
                renderOption={(props, option) => (
                  <Box component="li" {...props}>
                    <Stack>
                      <Typography variant="body2">{option.display || option.name}</Typography>
                      {option.code && (
                        <Typography variant="caption" color="text.secondary">
                          {option.code} • {option.frequency ? `${option.frequency} cases` : ''}
                        </Typography>
                      )}
                    </Stack>
                  </Box>
                )}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl component="fieldset" size="small">
                <Typography variant="caption" color="text.secondary" gutterBottom>
                  Category
                </Typography>
                <RadioGroup
                  row
                  value={formData.category}
                  onChange={(e) => handleFieldChange('category', e.target.value)}
                >
                  {CATEGORY_OPTIONS.map(option => (
                    <FormControlLabel
                      key={option.value}
                      value={option.value}
                      control={<Radio size="small" />}
                      label={option.label}
                    />
                  ))}
                </RadioGroup>
              </FormControl>
            </Grid>
          </Grid>
        </Paper>

        {/* Status Information */}
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle2" gutterBottom color="primary">
            Status & Verification
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Clinical Status</InputLabel>
                <Select
                  value={formData.clinicalStatus}
                  onChange={(e) => handleFieldChange('clinicalStatus', e.target.value)}
                  label="Clinical Status"
                >
                  {CLINICAL_STATUS_OPTIONS.map(option => (
                    <MenuItem key={option.value} value={option.value}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            backgroundColor: getStatusColor(option.value)
                          }}
                        />
                        {option.label}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Verification Status</InputLabel>
                <Select
                  value={formData.verificationStatus}
                  onChange={(e) => handleFieldChange('verificationStatus', e.target.value)}
                  label="Verification Status"
                >
                  {VERIFICATION_STATUS_OPTIONS.map(option => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel>Severity</InputLabel>
                <Select
                  value={formData.severity}
                  onChange={(e) => handleFieldChange('severity', e.target.value)}
                  label="Severity"
                  displayEmpty
                >
                  <MenuItem value="">
                    <em>Not specified</em>
                  </MenuItem>
                  {SEVERITY_OPTIONS.map(option => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Paper>

        {/* Dates */}
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle2" gutterBottom color="primary">
            Timeline
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField
                label="Onset Date"
                type="date"
                value={formData.onsetDate}
                onChange={(e) => handleFieldChange('onsetDate', e.target.value)}
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Abatement Date"
                type="date"
                value={formData.abatementDate}
                onChange={(e) => handleFieldChange('abatementDate', e.target.value)}
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
                helperText="Leave blank if condition is ongoing"
              />
            </Grid>
          </Grid>
        </Paper>

        {/* Notes */}
        <TextField
          label="Clinical Notes"
          value={formData.notes}
          onChange={(e) => handleFieldChange('notes', e.target.value)}
          fullWidth
          multiline
          rows={3}
          size="small"
          placeholder="Additional clinical notes about this condition..."
        />

        {/* Primary Diagnosis Flag */}
        {encounterId && (
          <FormControlLabel
            control={
              <Switch
                checked={formData.isPrimary}
                onChange={(e) => handleFieldChange('isPrimary', e.target.checked)}
              />
            }
            label="Primary diagnosis for this encounter"
          />
        )}
      </Stack>
    </SimplifiedClinicalDialog>
  );
};

export default ConditionDialog;