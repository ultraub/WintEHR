/**
 * MedicationDialog Component
 * Dialog for adding/editing medications
 */
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Grid
} from '@mui/material';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

const MedicationDialog = ({ 
  open, 
  onClose, 
  medication = null,
  onSave,
  patientId 
}) => {
  const [formData, setFormData] = useState({
    medicationName: '',
    dosage: '',
    frequency: '',
    route: '',
    status: 'active',
    startDate: new Date(),
    endDate: null,
    reason: '',
    instructions: ''
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (medication) {
      // Edit mode - populate form with existing data
      const dosageInstruction = medication.dosageInstruction?.[0];
      setFormData({
        medicationName: medication.medicationCodeableConcept?.text || 
                       medication.medicationCodeableConcept?.coding?.[0]?.display || '',
        dosage: dosageInstruction?.doseAndRate?.[0]?.doseQuantity?.value || '',
        frequency: dosageInstruction?.timing?.repeat?.frequency || '',
        route: dosageInstruction?.route?.coding?.[0]?.display || '',
        status: medication.status || 'active',
        startDate: medication.authoredOn ? new Date(medication.authoredOn) : new Date(),
        endDate: medication.dispenseRequest?.validityPeriod?.end ? 
                new Date(medication.dispenseRequest.validityPeriod.end) : null,
        reason: medication.reasonCode?.[0]?.text || '',
        instructions: dosageInstruction?.patientInstruction || ''
      });
    } else {
      // Add mode - reset form
      setFormData({
        medicationName: '',
        dosage: '',
        frequency: '',
        route: '',
        status: 'active',
        startDate: new Date(),
        endDate: null,
        reason: '',
        instructions: ''
      });
    }
  }, [medication]);

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined
      }));
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.medicationName) {
      newErrors.medicationName = 'Medication name is required';
    }
    if (!formData.dosage) {
      newErrors.dosage = 'Dosage is required';
    }
    if (!formData.frequency) {
      newErrors.frequency = 'Frequency is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;

    const fhirMedication = {
      resourceType: 'MedicationRequest',
      id: medication?.id,
      status: formData.status,
      intent: 'order',
      subject: {
        reference: `Patient/${patientId}`
      },
      medicationCodeableConcept: {
        text: formData.medicationName
      },
      authoredOn: formData.startDate.toISOString(),
      dosageInstruction: [{
        text: `${formData.dosage} ${formData.frequency}`,
        patientInstruction: formData.instructions,
        timing: {
          repeat: {
            frequency: parseInt(formData.frequency) || 1,
            period: 1,
            periodUnit: 'd'
          }
        },
        doseAndRate: [{
          doseQuantity: {
            value: parseFloat(formData.dosage) || 0,
            unit: 'mg'
          }
        }]
      }]
    };

    if (formData.route) {
      fhirMedication.dosageInstruction[0].route = {
        coding: [{
          display: formData.route
        }]
      };
    }

    if (formData.reason) {
      fhirMedication.reasonCode = [{
        text: formData.reason
      }];
    }

    if (formData.endDate) {
      fhirMedication.dispenseRequest = {
        validityPeriod: {
          start: formData.startDate.toISOString(),
          end: formData.endDate.toISOString()
        }
      };
    }

    onSave(fhirMedication);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {medication ? 'Edit Medication' : 'Add Medication'}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="Medication Name"
            value={formData.medicationName}
            onChange={(e) => handleChange('medicationName', e.target.value)}
            fullWidth
            required
            error={!!errors.medicationName}
            helperText={errors.medicationName}
          />

          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Dosage"
                value={formData.dosage}
                onChange={(e) => handleChange('dosage', e.target.value)}
                fullWidth
                required
                error={!!errors.dosage}
                helperText={errors.dosage || 'e.g., 500 mg'}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Frequency"
                value={formData.frequency}
                onChange={(e) => handleChange('frequency', e.target.value)}
                fullWidth
                required
                error={!!errors.frequency}
                helperText={errors.frequency || 'e.g., 2 times daily'}
              />
            </Grid>
          </Grid>

          <FormControl fullWidth>
            <InputLabel>Route</InputLabel>
            <Select
              value={formData.route}
              onChange={(e) => handleChange('route', e.target.value)}
              label="Route"
            >
              <MenuItem value="">None</MenuItem>
              <MenuItem value="Oral">Oral</MenuItem>
              <MenuItem value="Intravenous">Intravenous</MenuItem>
              <MenuItem value="Intramuscular">Intramuscular</MenuItem>
              <MenuItem value="Subcutaneous">Subcutaneous</MenuItem>
              <MenuItem value="Topical">Topical</MenuItem>
              <MenuItem value="Inhalation">Inhalation</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel>Status</InputLabel>
            <Select
              value={formData.status}
              onChange={(e) => handleChange('status', e.target.value)}
              label="Status"
            >
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="on-hold">On Hold</MenuItem>
              <MenuItem value="cancelled">Cancelled</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
              <MenuItem value="stopped">Stopped</MenuItem>
            </Select>
          </FormControl>

          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <DatePicker
                  label="Start Date"
                  value={formData.startDate}
                  onChange={(value) => handleChange('startDate', value)}
                  renderInput={(params) => <TextField {...params} fullWidth />}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <DatePicker
                  label="End Date (Optional)"
                  value={formData.endDate}
                  onChange={(value) => handleChange('endDate', value)}
                  renderInput={(params) => <TextField {...params} fullWidth />}
                />
              </Grid>
            </Grid>
          </LocalizationProvider>

          <TextField
            label="Reason for Medication"
            value={formData.reason}
            onChange={(e) => handleChange('reason', e.target.value)}
            fullWidth
          />

          <TextField
            label="Patient Instructions"
            value={formData.instructions}
            onChange={(e) => handleChange('instructions', e.target.value)}
            fullWidth
            multiline
            rows={3}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained">
          {medication ? 'Update' : 'Add'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MedicationDialog;