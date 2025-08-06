/**
 * MedicationDialog Component
 * FHIR-compliant dialog for prescribing medications
 * Integrates CDS hooks for drug interactions, dosing guidance, and safety checks
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
  Alert,
  TextField,
  Paper,
  Button,
  Divider,
  Autocomplete,
  FormControlLabel,
  Switch,
  useTheme,
  alpha
} from '@mui/material';
import {
  Send as SendIcon,
  Print as PrintIcon
} from '@mui/icons-material';
import SimplifiedClinicalDialog from '../../common/SimplifiedClinicalDialog';
import { fhirClient } from '../../../../core/fhir/services/fhirClient';
import { notificationService } from '../../../../services/notificationService';
import { getClinicalCatalog } from '../../../../services/cdsClinicalDataService';
import { clinicalCDSService } from '../../../../services/clinicalCDSService';
import { addDays, format } from 'date-fns';
import type { MedicationRequest } from '../../../../core/fhir/types';

// Simplified medication status options
const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'on-hold', label: 'On Hold' },
  { value: 'draft', label: 'Draft' },
  { value: 'stopped', label: 'Stopped' }
];

// Priority options
const PRIORITY_OPTIONS = [
  { value: 'routine', label: 'Routine' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'asap', label: 'ASAP' },
  { value: 'stat', label: 'STAT' }
];

// Common dosage frequencies
const FREQUENCY_OPTIONS = [
  { value: 'QD', label: 'Once daily', instructions: 'Take once daily' },
  { value: 'BID', label: 'Twice daily', instructions: 'Take twice daily' },
  { value: 'TID', label: 'Three times daily', instructions: 'Take three times daily' },
  { value: 'QID', label: 'Four times daily', instructions: 'Take four times daily' },
  { value: 'PRN', label: 'As needed', instructions: 'Take as needed' },
  { value: 'QHS', label: 'At bedtime', instructions: 'Take at bedtime' }
];

// Common durations
const DURATION_OPTIONS = [
  { value: 7, label: '7 days' },
  { value: 10, label: '10 days' },
  { value: 14, label: '14 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' }
];

const MedicationDialog = ({
  open,
  onClose,
  mode = 'prescribe',
  medication = null,
  patient,
  onSave,
  onSendToPharmacy,
  clinicalContext = {}
}) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [medicationCatalog, setMedicationCatalog] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [cdsAlerts, setCdsAlerts] = useState([]);

  // Form state
  const [formData, setFormData] = useState({
    medication: null,
    status: 'active',
    priority: 'routine',
    dosageAmount: '',
    dosageUnit: 'mg',
    frequency: 'BID',
    duration: 7,
    quantity: '',
    refills: 0,
    instructions: '',
    notes: '',
    substitutionAllowed: true,
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(addDays(new Date(), 7), 'yyyy-MM-dd')
  });

  // Load medication catalog
  useEffect(() => {
    const loadCatalog = async () => {
      try {
        setLoading(true);
        const catalog = await getClinicalCatalog('medications');
        setMedicationCatalog(catalog.items || []);
      } catch (error) {
        console.error('Failed to load medication catalog:', error);
        notificationService.error('Failed to load medication catalog');
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
    if (medication && mode === 'edit') {
      // Parse existing medication data
      const dosage = medication.dosageInstruction?.[0];
      setFormData({
        medication: {
          code: medication.medicationCodeableConcept?.coding?.[0]?.code,
          display: medication.medicationCodeableConcept?.text || 
                   medication.medicationCodeableConcept?.coding?.[0]?.display
        },
        status: medication.status || 'active',
        priority: medication.priority || 'routine',
        dosageAmount: dosage?.doseAndRate?.[0]?.doseQuantity?.value || '',
        dosageUnit: dosage?.doseAndRate?.[0]?.doseQuantity?.unit || 'mg',
        frequency: 'BID', // Would need to parse from timing
        duration: 7,
        quantity: medication.dispenseRequest?.quantity?.value || '',
        refills: medication.dispenseRequest?.numberOfRepeatsAllowed || 0,
        instructions: dosage?.text || '',
        notes: medication.note?.[0]?.text || '',
        substitutionAllowed: medication.substitution?.allowedBoolean !== false,
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: format(addDays(new Date(), 7), 'yyyy-MM-dd')
      });
    }
  }, [medication, mode]);

  // Update instructions when frequency changes
  useEffect(() => {
    const freq = FREQUENCY_OPTIONS.find(f => f.value === formData.frequency);
    if (freq && !formData.instructions) {
      setFormData(prev => ({
        ...prev,
        instructions: freq.instructions
      }));
    }
  }, [formData.frequency, formData.instructions]);

  // Calculate quantity based on dosage and duration
  useEffect(() => {
    if (formData.dosageAmount && formData.frequency && formData.duration) {
      const frequencyMap = {
        'QD': 1,
        'BID': 2,
        'TID': 3,
        'QID': 4,
        'PRN': 0,
        'QHS': 1
      };
      
      const dailyDoses = frequencyMap[formData.frequency] || 1;
      const totalQuantity = dailyDoses * formData.duration;
      
      setFormData(prev => ({
        ...prev,
        quantity: totalQuantity.toString()
      }));
    }
  }, [formData.dosageAmount, formData.frequency, formData.duration]);

  // Check for drug interactions when medication changes
  useEffect(() => {
    const checkInteractions = async () => {
      if (!formData.medication || !patient) return;

      try {
        const cdsResult = await clinicalCDSService.fireMedicationHooks({
          patient,
          medications: [{
            medicationCodeableConcept: {
              coding: [{
                code: formData.medication.code,
                display: formData.medication.display
              }]
            }
          }],
          operation: 'prescribe',
          user: clinicalContext.user
        });

        if (cdsResult.alerts && cdsResult.alerts.length > 0) {
          setCdsAlerts(cdsResult.alerts);
        }
      } catch (error) {
        console.error('Failed to check drug interactions:', error);
      }
    };

    checkInteractions();
  }, [formData.medication, patient, clinicalContext.user]);

  const handleFieldChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async (sendToPharmacy = false) => {
    try {
      setSaving(true);

      // Validate required fields
      if (!formData.medication) {
        setAlerts([{ severity: 'error', message: 'Please select a medication' }]);
        return;
      }

      if (!formData.dosageAmount || !formData.quantity) {
        setAlerts([{ severity: 'error', message: 'Please complete dosage information' }]);
        return;
      }

      // Build FHIR MedicationRequest
      const medicationRequest: Partial<MedicationRequest> = {
        resourceType: 'MedicationRequest',
        status: formData.status as any,
        intent: 'order',
        priority: formData.priority as any,
        medicationCodeableConcept: {
          coding: [{
            system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
            code: formData.medication.code,
            display: formData.medication.display
          }],
          text: formData.medication.display
        },
        subject: {
          reference: `Patient/${patient.id}`,
          display: patient.name?.[0]?.given?.join(' ') + ' ' + patient.name?.[0]?.family
        },
        authoredOn: new Date().toISOString(),
        dosageInstruction: [{
          text: formData.instructions,
          timing: {
            code: {
              coding: [{
                code: formData.frequency,
                display: FREQUENCY_OPTIONS.find(f => f.value === formData.frequency)?.label
              }]
            }
          },
          doseAndRate: [{
            doseQuantity: {
              value: parseFloat(formData.dosageAmount),
              unit: formData.dosageUnit,
              system: 'http://unitsofmeasure.org',
              code: formData.dosageUnit
            }
          }]
        }],
        dispenseRequest: {
          validityPeriod: {
            start: formData.startDate,
            end: formData.endDate
          },
          numberOfRepeatsAllowed: parseInt(formData.refills.toString()),
          quantity: {
            value: parseFloat(formData.quantity),
            unit: 'tablet',
            system: 'http://unitsofmeasure.org',
            code: 'TAB'
          }
        },
        substitution: {
          allowedBoolean: formData.substitutionAllowed
        }
      };

      // Add notes if provided
      if (formData.notes) {
        medicationRequest.note = [{
          text: formData.notes,
          time: new Date().toISOString()
        }];
      }

      // Save medication
      let result;
      if (mode === 'edit' && medication?.id) {
        result = await fhirClient.update('MedicationRequest', medication.id, {
          ...medicationRequest,
          id: medication.id
        } as MedicationRequest);
        notificationService.fhirSuccess('Updated', 'MedicationRequest', medication.id);
      } else {
        result = await fhirClient.create('MedicationRequest', medicationRequest);
        notificationService.fhirSuccess('Created', 'MedicationRequest', result.id);
      }

      // Send to pharmacy if requested
      if (sendToPharmacy && onSendToPharmacy) {
        await onSendToPharmacy(result);
        notificationService.success('Prescription sent to pharmacy');
      }

      // Call parent callback
      if (onSave) {
        onSave(result);
      }

      onClose();
    } catch (error) {
      console.error('Failed to save medication:', error);
      notificationService.fhirError(error, {
        operation: mode === 'edit' ? 'UPDATE' : 'CREATE',
        resourceType: 'MedicationRequest'
      });
      setAlerts([{ 
        severity: 'error', 
        message: 'Failed to save medication. Please try again.' 
      }]);
    } finally {
      setSaving(false);
    }
  };

  // Convert CDS alerts to dialog alerts
  const dialogAlerts = [
    ...alerts,
    ...cdsAlerts.map(alert => ({
      severity: alert.indicator === 'critical' ? 'error' : 
                alert.indicator === 'warning' ? 'warning' : 'info',
      message: alert.summary
    }))
  ];

  return (
    <SimplifiedClinicalDialog
      open={open}
      onClose={onClose}
      title={mode === 'edit' ? 'Edit Medication' : 'Prescribe Medication'}
      subtitle={`For ${patient?.name?.[0]?.given?.join(' ')} ${patient?.name?.[0]?.family || ''}`}
      category="medication"
      priority={formData.priority as any}
      loading={loading}
      alerts={dialogAlerts}
      actions={[
        {
          label: 'Cancel',
          onClick: onClose,
          variant: 'outlined'
        },
        {
          label: 'Save Draft',
          onClick: () => handleSave(false),
          variant: 'outlined',
          color: 'primary',
          disabled: saving || formData.status !== 'draft'
        },
        {
          label: 'Print',
          onClick: () => window.print(),
          variant: 'outlined',
          startIcon: <PrintIcon />,
          disabled: saving
        },
        {
          label: 'Send to Pharmacy',
          onClick: () => handleSave(true),
          variant: 'contained',
          color: 'primary',
          startIcon: <SendIcon />,
          disabled: saving
        }
      ]}
    >
      <Stack spacing={3}>
        {/* Medication Selection */}
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle2" gutterBottom color="primary">
            Medication Details
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Autocomplete
                options={medicationCatalog}
                getOptionLabel={(option) => option.display || option.name || ''}
                value={formData.medication}
                onChange={(event, newValue) => handleFieldChange('medication', newValue)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Medication"
                    placeholder="Search medications..."
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
                      {option.frequency && (
                        <Typography variant="caption" color="text.secondary">
                          Prescribed {option.frequency} times
                        </Typography>
                      )}
                    </Stack>
                  </Box>
                )}
              />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select
                  value={formData.status}
                  onChange={(e) => handleFieldChange('status', e.target.value)}
                  label="Status"
                >
                  {STATUS_OPTIONS.map(option => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Priority</InputLabel>
                <Select
                  value={formData.priority}
                  onChange={(e) => handleFieldChange('priority', e.target.value)}
                  label="Priority"
                >
                  {PRIORITY_OPTIONS.map(option => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Paper>

        {/* Dosage Information */}
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle2" gutterBottom color="primary">
            Dosage & Frequency
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField
                label="Dosage Amount"
                type="number"
                value={formData.dosageAmount}
                onChange={(e) => handleFieldChange('dosageAmount', e.target.value)}
                fullWidth
                size="small"
                required
                InputProps={{
                  endAdornment: (
                    <Select
                      value={formData.dosageUnit}
                      onChange={(e) => handleFieldChange('dosageUnit', e.target.value)}
                      variant="standard"
                      sx={{ ml: 1 }}
                    >
                      <MenuItem value="mg">mg</MenuItem>
                      <MenuItem value="mcg">mcg</MenuItem>
                      <MenuItem value="g">g</MenuItem>
                      <MenuItem value="mL">mL</MenuItem>
                      <MenuItem value="units">units</MenuItem>
                    </Select>
                  )
                }}
              />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth size="small" required>
                <InputLabel>Frequency</InputLabel>
                <Select
                  value={formData.frequency}
                  onChange={(e) => handleFieldChange('frequency', e.target.value)}
                  label="Frequency"
                >
                  {FREQUENCY_OPTIONS.map(option => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Instructions"
                value={formData.instructions}
                onChange={(e) => handleFieldChange('instructions', e.target.value)}
                fullWidth
                size="small"
                multiline
                rows={2}
                helperText="Patient instructions for taking this medication"
              />
            </Grid>
          </Grid>
        </Paper>

        {/* Dispensing Information */}
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle2" gutterBottom color="primary">
            Dispensing Information
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Duration</InputLabel>
                <Select
                  value={formData.duration}
                  onChange={(e) => handleFieldChange('duration', e.target.value)}
                  label="Duration"
                >
                  {DURATION_OPTIONS.map(option => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={4}>
              <TextField
                label="Quantity"
                type="number"
                value={formData.quantity}
                onChange={(e) => handleFieldChange('quantity', e.target.value)}
                fullWidth
                size="small"
                required
                helperText="Total tablets/units"
              />
            </Grid>
            <Grid item xs={4}>
              <TextField
                label="Refills"
                type="number"
                value={formData.refills}
                onChange={(e) => handleFieldChange('refills', e.target.value)}
                fullWidth
                size="small"
                inputProps={{ min: 0, max: 11 }}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.substitutionAllowed}
                    onChange={(e) => handleFieldChange('substitutionAllowed', e.target.checked)}
                  />
                }
                label="Generic substitution allowed"
              />
            </Grid>
          </Grid>
        </Paper>

        {/* Notes */}
        <TextField
          label="Additional Notes"
          value={formData.notes}
          onChange={(e) => handleFieldChange('notes', e.target.value)}
          fullWidth
          multiline
          rows={2}
          size="small"
          placeholder="Any additional notes or special instructions..."
        />
      </Stack>
    </SimplifiedClinicalDialog>
  );
};

export default MedicationDialog;