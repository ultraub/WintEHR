/**
 * ImmunizationDialog Component
 * Dialog for adding/editing immunizations
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

const ImmunizationDialog = ({ 
  open, 
  onClose, 
  immunization = null,
  onSave,
  patientId 
}) => {
  const [formData, setFormData] = useState({
    vaccine: '',
    status: 'completed',
    occurrenceDate: new Date(),
    site: '',
    route: '',
    doseQuantity: '',
    lotNumber: '',
    expirationDate: null,
    performer: '',
    note: ''
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (immunization) {
      // Edit mode - populate form with existing data
      setFormData({
        vaccine: immunization.vaccineCode?.text || 
                immunization.vaccineCode?.coding?.[0]?.display || '',
        status: immunization.status || 'completed',
        occurrenceDate: immunization.occurrenceDateTime ? 
                       new Date(immunization.occurrenceDateTime) : new Date(),
        site: immunization.site?.coding?.[0]?.display || '',
        route: immunization.route?.coding?.[0]?.display || '',
        doseQuantity: immunization.doseQuantity?.value || '',
        lotNumber: immunization.lotNumber || '',
        expirationDate: immunization.expirationDate ? 
                       new Date(immunization.expirationDate) : null,
        performer: immunization.performer?.[0]?.actor?.display || '',
        note: immunization.note?.[0]?.text || ''
      });
    } else {
      // Add mode - reset form
      setFormData({
        vaccine: '',
        status: 'completed',
        occurrenceDate: new Date(),
        site: '',
        route: '',
        doseQuantity: '',
        lotNumber: '',
        expirationDate: null,
        performer: '',
        note: ''
      });
    }
  }, [immunization]);

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
    if (!formData.vaccine) {
      newErrors.vaccine = 'Vaccine name is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;

    const fhirImmunization = {
      resourceType: 'Immunization',
      id: immunization?.id,
      status: formData.status,
      vaccineCode: {
        text: formData.vaccine
      },
      patient: {
        reference: `Patient/${patientId}`
      },
      occurrenceDateTime: formData.occurrenceDate.toISOString(),
      recorded: new Date().toISOString()
    };

    if (formData.site) {
      fhirImmunization.site = {
        coding: [{
          display: formData.site
        }]
      };
    }

    if (formData.route) {
      fhirImmunization.route = {
        coding: [{
          display: formData.route
        }]
      };
    }

    if (formData.doseQuantity) {
      fhirImmunization.doseQuantity = {
        value: parseFloat(formData.doseQuantity) || 0,
        unit: 'mL'
      };
    }

    if (formData.lotNumber) {
      fhirImmunization.lotNumber = formData.lotNumber;
    }

    if (formData.expirationDate) {
      fhirImmunization.expirationDate = formData.expirationDate.toISOString().split('T')[0];
    }

    if (formData.performer) {
      fhirImmunization.performer = [{
        actor: {
          display: formData.performer
        }
      }];
    }

    if (formData.note) {
      fhirImmunization.note = [{
        text: formData.note,
        time: new Date().toISOString()
      }];
    }

    onSave(fhirImmunization);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {immunization ? 'Edit Immunization' : 'Add Immunization'}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="Vaccine Name"
            value={formData.vaccine}
            onChange={(e) => handleChange('vaccine', e.target.value)}
            fullWidth
            required
            error={!!errors.vaccine}
            helperText={errors.vaccine}
            placeholder="e.g., COVID-19 Vaccine, Influenza, Hepatitis B"
          />

          <FormControl fullWidth>
            <InputLabel>Status</InputLabel>
            <Select
              value={formData.status}
              onChange={(e) => handleChange('status', e.target.value)}
              label="Status"
            >
              <MenuItem value="completed">Completed</MenuItem>
              <MenuItem value="entered-in-error">Entered in Error</MenuItem>
              <MenuItem value="not-done">Not Done</MenuItem>
            </Select>
          </FormControl>

          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              label="Administration Date"
              value={formData.occurrenceDate}
              onChange={(value) => handleChange('occurrenceDate', value)}
              renderInput={(params) => <TextField {...params} fullWidth />}
            />
          </LocalizationProvider>

          <FormControl fullWidth>
            <InputLabel>Site</InputLabel>
            <Select
              value={formData.site}
              onChange={(e) => handleChange('site', e.target.value)}
              label="Site"
            >
              <MenuItem value="">None</MenuItem>
              <MenuItem value="Left arm">Left arm</MenuItem>
              <MenuItem value="Right arm">Right arm</MenuItem>
              <MenuItem value="Left thigh">Left thigh</MenuItem>
              <MenuItem value="Right thigh">Right thigh</MenuItem>
              <MenuItem value="Left deltoid">Left deltoid</MenuItem>
              <MenuItem value="Right deltoid">Right deltoid</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel>Route</InputLabel>
            <Select
              value={formData.route}
              onChange={(e) => handleChange('route', e.target.value)}
              label="Route"
            >
              <MenuItem value="">None</MenuItem>
              <MenuItem value="Intramuscular">Intramuscular</MenuItem>
              <MenuItem value="Subcutaneous">Subcutaneous</MenuItem>
              <MenuItem value="Oral">Oral</MenuItem>
              <MenuItem value="Intranasal">Intranasal</MenuItem>
            </Select>
          </FormControl>

          <TextField
            label="Dose Quantity (mL)"
            value={formData.doseQuantity}
            onChange={(e) => handleChange('doseQuantity', e.target.value)}
            fullWidth
            type="number"
          />

          <TextField
            label="Lot Number"
            value={formData.lotNumber}
            onChange={(e) => handleChange('lotNumber', e.target.value)}
            fullWidth
          />

          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              label="Expiration Date"
              value={formData.expirationDate}
              onChange={(value) => handleChange('expirationDate', value)}
              renderInput={(params) => <TextField {...params} fullWidth />}
            />
          </LocalizationProvider>

          <TextField
            label="Administered By"
            value={formData.performer}
            onChange={(e) => handleChange('performer', e.target.value)}
            fullWidth
          />

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
          {immunization ? 'Update' : 'Add'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ImmunizationDialog;