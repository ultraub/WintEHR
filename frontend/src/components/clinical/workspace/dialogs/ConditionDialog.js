/**
 * ConditionDialog Component
 * Dialog for adding/editing conditions (problems)
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
  Typography,
  Alert
} from '@mui/material';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

const ConditionDialog = ({ 
  open, 
  onClose, 
  condition = null,
  onSave,
  patientId 
}) => {
  const [formData, setFormData] = useState({
    code: '',
    display: '',
    clinicalStatus: 'active',
    verificationStatus: 'confirmed',
    severity: '',
    onsetDateTime: new Date(),
    note: ''
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (condition) {
      // Edit mode - populate form with existing data
      setFormData({
        code: condition.code?.coding?.[0]?.code || '',
        display: condition.code?.coding?.[0]?.display || condition.code?.text || '',
        clinicalStatus: condition.clinicalStatus?.coding?.[0]?.code || 'active',
        verificationStatus: condition.verificationStatus?.coding?.[0]?.code || 'confirmed',
        severity: condition.severity?.coding?.[0]?.code || '',
        onsetDateTime: condition.onsetDateTime ? new Date(condition.onsetDateTime) : new Date(),
        note: condition.note?.[0]?.text || ''
      });
    } else {
      // Add mode - reset form
      setFormData({
        code: '',
        display: '',
        clinicalStatus: 'active',
        verificationStatus: 'confirmed',
        severity: '',
        onsetDateTime: new Date(),
        note: ''
      });
    }
  }, [condition]);

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
    if (!formData.display) {
      newErrors.display = 'Condition name is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;

    const fhirCondition = {
      resourceType: 'Condition',
      id: condition?.id,
      subject: {
        reference: `Patient/${patientId}`
      },
      code: {
        coding: [{
          system: 'http://snomed.info/sct',
          code: formData.code || 'unknown',
          display: formData.display
        }],
        text: formData.display
      },
      clinicalStatus: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
          code: formData.clinicalStatus
        }]
      },
      verificationStatus: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
          code: formData.verificationStatus
        }]
      },
      onsetDateTime: formData.onsetDateTime.toISOString(),
      recordedDate: new Date().toISOString()
    };

    if (formData.severity) {
      fhirCondition.severity = {
        coding: [{
          system: 'http://snomed.info/sct',
          code: formData.severity
        }]
      };
    }

    if (formData.note) {
      fhirCondition.note = [{
        text: formData.note,
        time: new Date().toISOString()
      }];
    }

    onSave(fhirCondition);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {condition ? 'Edit Condition' : 'Add Condition'}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="Condition Name"
            value={formData.display}
            onChange={(e) => handleChange('display', e.target.value)}
            fullWidth
            required
            error={!!errors.display}
            helperText={errors.display}
          />

          <FormControl fullWidth>
            <InputLabel>Clinical Status</InputLabel>
            <Select
              value={formData.clinicalStatus}
              onChange={(e) => handleChange('clinicalStatus', e.target.value)}
              label="Clinical Status"
            >
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="recurrence">Recurrence</MenuItem>
              <MenuItem value="relapse">Relapse</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
              <MenuItem value="remission">Remission</MenuItem>
              <MenuItem value="resolved">Resolved</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel>Verification Status</InputLabel>
            <Select
              value={formData.verificationStatus}
              onChange={(e) => handleChange('verificationStatus', e.target.value)}
              label="Verification Status"
            >
              <MenuItem value="unconfirmed">Unconfirmed</MenuItem>
              <MenuItem value="provisional">Provisional</MenuItem>
              <MenuItem value="differential">Differential</MenuItem>
              <MenuItem value="confirmed">Confirmed</MenuItem>
              <MenuItem value="refuted">Refuted</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel>Severity</InputLabel>
            <Select
              value={formData.severity}
              onChange={(e) => handleChange('severity', e.target.value)}
              label="Severity"
            >
              <MenuItem value="">None</MenuItem>
              <MenuItem value="mild">Mild</MenuItem>
              <MenuItem value="moderate">Moderate</MenuItem>
              <MenuItem value="severe">Severe</MenuItem>
            </Select>
          </FormControl>

          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              label="Onset Date"
              value={formData.onsetDateTime}
              onChange={(value) => handleChange('onsetDateTime', value)}
              renderInput={(params) => <TextField {...params} fullWidth />}
            />
          </LocalizationProvider>

          <TextField
            label="Notes"
            value={formData.note}
            onChange={(e) => handleChange('note', e.target.value)}
            fullWidth
            multiline
            rows={3}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained">
          {condition ? 'Update' : 'Add'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConditionDialog;