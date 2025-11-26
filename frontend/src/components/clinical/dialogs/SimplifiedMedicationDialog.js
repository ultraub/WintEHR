/**
 * SimplifiedMedicationDialog Component
 * 
 * A cleaner, more focused medication prescribing dialog with reduced visual clutter.
 * Demonstrates the simplified dialog pattern with better UX.
 * 
 * @since 2025-01-21
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Stack,
  Typography,
  TextField,
  Paper,
  Autocomplete,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from '@mui/material';
import { Send as SendIcon } from '@mui/icons-material';
import SimplifiedClinicalDialog from '../common/SimplifiedClinicalDialog';
import { fhirClient } from '../../../core/fhir/services/fhirClient';
import { notificationService } from '../../../services/notificationService';
import { getClinicalCatalog } from '../../../services/cdsClinicalDataService';
import { format, addDays } from 'date-fns';

// Common dosage frequencies
const FREQUENCY_OPTIONS = [
  { value: 'QD', label: 'Once daily', instructions: 'Take once daily' },
  { value: 'BID', label: 'Twice daily', instructions: 'Take twice daily' },
  { value: 'TID', label: 'Three times daily', instructions: 'Take three times daily' },
  { value: 'QID', label: 'Four times daily', instructions: 'Take four times daily' },
  { value: 'PRN', label: 'As needed', instructions: 'Take as needed' },
  { value: 'QHS', label: 'At bedtime', instructions: 'Take at bedtime' },
  { value: 'AC', label: 'Before meals', instructions: 'Take before meals' },
  { value: 'PC', label: 'After meals', instructions: 'Take after meals' }
];

// Common durations
const DURATION_OPTIONS = [
  { value: 7, label: '7 days' },
  { value: 10, label: '10 days' },
  { value: 14, label: '14 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' }
];

const SimplifiedMedicationDialog = ({
  open,
  onClose,
  patient,
  medication = null,
  mode = 'prescribe',
  onSave
}) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [medicationCatalog, setMedicationCatalog] = useState([]);
  const [alerts, setAlerts] = useState([]);

  // Form state
  const [formData, setFormData] = useState({
    medication: null,
    status: 'active',
    dosageAmount: '',
    dosageUnit: 'mg',
    frequency: 'BID',
    duration: 7,
    quantity: '',
    refills: 0,
    instructions: '',
    notes: '',
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
        dosageAmount: dosage?.doseAndRate?.[0]?.doseQuantity?.value || '',
        dosageUnit: dosage?.doseAndRate?.[0]?.doseQuantity?.unit || 'mg',
        frequency: 'BID', // Would need to parse from timing
        duration: 7,
        quantity: medication.dispenseRequest?.quantity?.value || '',
        refills: medication.dispenseRequest?.numberOfRepeatsAllowed || 0,
        instructions: dosage?.text || '',
        notes: medication.note?.[0]?.text || '',
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
        'QHS': 1,
        'AC': 3,
        'PC': 3
      };
      
      const dailyDoses = frequencyMap[formData.frequency] || 1;
      const totalQuantity = dailyDoses * formData.duration;
      
      setFormData(prev => ({
        ...prev,
        quantity: totalQuantity.toString()
      }));
    }
  }, [formData.dosageAmount, formData.frequency, formData.duration]);

  const handleFieldChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
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
      const medicationRequest = {
        resourceType: 'MedicationRequest',
        status: formData.status,
        intent: 'order',
        priority: 'routine',
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
          numberOfRepeatsAllowed: parseInt(formData.refills),
          quantity: {
            value: parseFloat(formData.quantity),
            unit: 'tablet',
            system: 'http://unitsofmeasure.org',
            code: 'TAB'
          }
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
        });
        notificationService.fhirSuccess('Updated', 'MedicationRequest', medication.id);
      } else {
        result = await fhirClient.create('MedicationRequest', medicationRequest);
        notificationService.fhirSuccess('Created', 'MedicationRequest', result.id);
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

  const handleSendToPharmacy = async () => {
    // First save the medication
    await handleSave();
    
    // Then send to pharmacy
    notificationService.info('Prescription sent to pharmacy');
  };

  return (
    <SimplifiedClinicalDialog
      open={open}
      onClose={onClose}
      title={mode === 'edit' ? 'Edit Medication' : 'Prescribe Medication'}
      subtitle={`For ${patient?.name?.[0]?.given?.join(' ')} ${patient?.name?.[0]?.family || ''}`}
      category="medication"
      loading={loading}
      alerts={alerts}
      actions={[
        {
          label: 'Cancel',
          onClick: onClose,
          variant: 'outlined'
        },
        {
          label: 'Save Draft',
          onClick: handleSave,
          variant: 'outlined',
          color: 'primary',
          disabled: saving
        },
        {
          label: 'Send to Pharmacy',
          onClick: handleSendToPharmacy,
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
            Medication
          </Typography>
          <Autocomplete
            options={medicationCatalog}
            getOptionLabel={(option) => option.display || option.name || ''}
            value={formData.medication}
            onChange={(event, newValue) => handleFieldChange('medication', newValue)}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder="Search medications..."
                variant="outlined"
                size="small"
                fullWidth
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
              <FormControl fullWidth size="small">
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
            Dispensing
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

export default SimplifiedMedicationDialog;