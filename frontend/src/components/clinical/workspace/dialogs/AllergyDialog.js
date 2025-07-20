/**
 * AllergyDialog Component
 * Dialog for adding/editing allergies
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
  Chip,
  Stack
} from '@mui/material';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

const AllergyDialog = ({ 
  open, 
  onClose, 
  allergy = null,
  onSave,
  patientId 
}) => {
  const [formData, setFormData] = useState({
    substance: '',
    type: 'allergy',
    category: 'medication',
    criticality: 'low',
    clinicalStatus: 'active',
    verificationStatus: 'confirmed',
    onsetDate: new Date(),
    reactions: [],
    currentReaction: '',
    note: ''
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (allergy) {
      // Edit mode - populate form with existing data
      setFormData({
        substance: allergy.code?.coding?.[0]?.display || allergy.code?.text || '',
        type: allergy.type || 'allergy',
        category: allergy.category?.[0] || 'medication',
        criticality: allergy.criticality || 'low',
        clinicalStatus: allergy.clinicalStatus?.coding?.[0]?.code || 'active',
        verificationStatus: allergy.verificationStatus?.coding?.[0]?.code || 'confirmed',
        onsetDate: allergy.onsetDateTime ? new Date(allergy.onsetDateTime) : new Date(),
        reactions: allergy.reaction?.map(r => r.manifestation?.[0]?.text || '') || [],
        currentReaction: '',
        note: allergy.note?.[0]?.text || ''
      });
    } else {
      // Add mode - reset form
      setFormData({
        substance: '',
        type: 'allergy',
        category: 'medication',
        criticality: 'low',
        clinicalStatus: 'active',
        verificationStatus: 'confirmed',
        onsetDate: new Date(),
        reactions: [],
        currentReaction: '',
        note: ''
      });
    }
  }, [allergy]);

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

  const addReaction = () => {
    if (formData.currentReaction.trim()) {
      setFormData(prev => ({
        ...prev,
        reactions: [...prev.reactions, prev.currentReaction.trim()],
        currentReaction: ''
      }));
    }
  };

  const removeReaction = (index) => {
    setFormData(prev => ({
      ...prev,
      reactions: prev.reactions.filter((_, i) => i !== index)
    }));
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.substance) {
      newErrors.substance = 'Substance is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;

    const fhirAllergy = {
      resourceType: 'AllergyIntolerance',
      id: allergy?.id,
      clinicalStatus: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical',
          code: formData.clinicalStatus
        }]
      },
      verificationStatus: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification',
          code: formData.verificationStatus
        }]
      },
      type: formData.type,
      category: [formData.category],
      criticality: formData.criticality,
      code: {
        text: formData.substance
      },
      patient: {
        reference: `Patient/${patientId}`
      },
      onsetDateTime: formData.onsetDate.toISOString(),
      recordedDate: new Date().toISOString()
    };

    if (formData.reactions.length > 0) {
      fhirAllergy.reaction = formData.reactions.map(reaction => ({
        manifestation: [{
          text: reaction
        }]
      }));
    }

    if (formData.note) {
      fhirAllergy.note = [{
        text: formData.note,
        time: new Date().toISOString()
      }];
    }

    onSave(fhirAllergy);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {allergy ? 'Edit Allergy' : 'Add Allergy'}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="Substance"
            value={formData.substance}
            onChange={(e) => handleChange('substance', e.target.value)}
            fullWidth
            required
            error={!!errors.substance}
            helperText={errors.substance}
            placeholder="e.g., Penicillin, Peanuts, Latex"
          />

          <FormControl fullWidth>
            <InputLabel>Type</InputLabel>
            <Select
              value={formData.type}
              onChange={(e) => handleChange('type', e.target.value)}
              label="Type"
            >
              <MenuItem value="allergy">Allergy</MenuItem>
              <MenuItem value="intolerance">Intolerance</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel>Category</InputLabel>
            <Select
              value={formData.category}
              onChange={(e) => handleChange('category', e.target.value)}
              label="Category"
            >
              <MenuItem value="food">Food</MenuItem>
              <MenuItem value="medication">Medication</MenuItem>
              <MenuItem value="environment">Environment</MenuItem>
              <MenuItem value="biologic">Biologic</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel>Criticality</InputLabel>
            <Select
              value={formData.criticality}
              onChange={(e) => handleChange('criticality', e.target.value)}
              label="Criticality"
            >
              <MenuItem value="low">Low</MenuItem>
              <MenuItem value="high">High</MenuItem>
              <MenuItem value="unable-to-assess">Unable to Assess</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel>Clinical Status</InputLabel>
            <Select
              value={formData.clinicalStatus}
              onChange={(e) => handleChange('clinicalStatus', e.target.value)}
              label="Clinical Status"
            >
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
              <MenuItem value="resolved">Resolved</MenuItem>
            </Select>
          </FormControl>

          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              label="Onset Date"
              value={formData.onsetDate}
              onChange={(value) => handleChange('onsetDate', value)}
              renderInput={(params) => <TextField {...params} fullWidth />}
            />
          </LocalizationProvider>

          <Box>
            <TextField
              label="Add Reaction"
              value={formData.currentReaction}
              onChange={(e) => handleChange('currentReaction', e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addReaction();
                }
              }}
              fullWidth
              placeholder="Type reaction and press Enter"
            />
            {formData.reactions.length > 0 && (
              <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap', gap: 1 }}>
                {formData.reactions.map((reaction, index) => (
                  <Chip
                    key={index}
                    label={reaction}
                    onDelete={() => removeReaction(index)}
                    size="small"
                  />
                ))}
              </Stack>
            )}
          </Box>

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
          {allergy ? 'Update' : 'Add'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AllergyDialog;