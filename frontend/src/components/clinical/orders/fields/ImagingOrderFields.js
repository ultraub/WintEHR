/**
 * ImagingOrderFields Component
 * Renders imaging-specific form fields for CPOE
 */
import React from 'react';
import PropTypes from 'prop-types';
import {
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Typography,
  Divider
} from '@mui/material';

// Imaging modalities (DICOM standard)
const MODALITIES = [
  { value: 'XR', label: 'X-Ray (XR)' },
  { value: 'CT', label: 'CT Scan' },
  { value: 'MRI', label: 'MRI' },
  { value: 'US', label: 'Ultrasound (US)' },
  { value: 'NM', label: 'Nuclear Medicine (NM)' },
  { value: 'PET', label: 'PET Scan' },
  { value: 'MG', label: 'Mammography (MG)' },
  { value: 'FL', label: 'Fluoroscopy (FL)' },
  { value: 'DX', label: 'Digital Radiography (DX)' },
  { value: 'CR', label: 'Computed Radiography (CR)' }
];

// Common body sites
const BODY_SITES = [
  { value: 'head', label: 'Head' },
  { value: 'neck', label: 'Neck' },
  { value: 'chest', label: 'Chest' },
  { value: 'abdomen', label: 'Abdomen' },
  { value: 'pelvis', label: 'Pelvis' },
  { value: 'spine_cervical', label: 'Spine - Cervical' },
  { value: 'spine_thoracic', label: 'Spine - Thoracic' },
  { value: 'spine_lumbar', label: 'Spine - Lumbar' },
  { value: 'shoulder', label: 'Shoulder' },
  { value: 'elbow', label: 'Elbow' },
  { value: 'wrist', label: 'Wrist' },
  { value: 'hand', label: 'Hand' },
  { value: 'hip', label: 'Hip' },
  { value: 'knee', label: 'Knee' },
  { value: 'ankle', label: 'Ankle' },
  { value: 'foot', label: 'Foot' },
  { value: 'extremity_upper', label: 'Upper Extremity' },
  { value: 'extremity_lower', label: 'Lower Extremity' }
];

// Laterality options
const LATERALITY = [
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'bilateral', label: 'Bilateral' },
  { value: 'na', label: 'N/A (Midline)' }
];

// Transport modes
const TRANSPORT_MODES = [
  { value: 'ambulatory', label: 'Ambulatory (Walking)' },
  { value: 'wheelchair', label: 'Wheelchair' },
  { value: 'stretcher', label: 'Stretcher' },
  { value: 'bed', label: 'In Bed (Portable)' }
];

const ImagingOrderFields = ({ values, onChange }) => {
  const handleChange = (field) => (event) => {
    const value = event.target.type === 'checkbox'
      ? event.target.checked
      : event.target.value;
    onChange({ ...values, [field]: value });
  };

  return (
    <>
      <Grid item xs={12}>
        <Divider sx={{ my: 1 }} />
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
          Imaging Details
        </Typography>
      </Grid>

      {/* Modality */}
      <Grid item xs={6}>
        <FormControl fullWidth size="small">
          <InputLabel>Modality</InputLabel>
          <Select
            value={values.modality || ''}
            onChange={handleChange('modality')}
            label="Modality"
          >
            <MenuItem value="">
              <em>Select modality</em>
            </MenuItem>
            {MODALITIES.map((mod) => (
              <MenuItem key={mod.value} value={mod.value}>
                {mod.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>

      {/* Body Site */}
      <Grid item xs={6}>
        <FormControl fullWidth size="small">
          <InputLabel>Body Site</InputLabel>
          <Select
            value={values.bodySite || ''}
            onChange={handleChange('bodySite')}
            label="Body Site"
          >
            <MenuItem value="">
              <em>Select body site</em>
            </MenuItem>
            {BODY_SITES.map((site) => (
              <MenuItem key={site.value} value={site.value}>
                {site.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>

      {/* Laterality */}
      <Grid item xs={6}>
        <FormControl fullWidth size="small">
          <InputLabel>Laterality</InputLabel>
          <Select
            value={values.laterality || 'na'}
            onChange={handleChange('laterality')}
            label="Laterality"
          >
            {LATERALITY.map((lat) => (
              <MenuItem key={lat.value} value={lat.value}>
                {lat.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>

      {/* Contrast */}
      <Grid item xs={6}>
        <FormControlLabel
          control={
            <Checkbox
              checked={values.contrastRequired || false}
              onChange={handleChange('contrastRequired')}
            />
          }
          label="Contrast Required"
          sx={{ mt: 1 }}
        />
      </Grid>

      {/* Contrast Details (conditional) */}
      {values.contrastRequired && (
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Contrast Type/Notes"
            value={values.contrastNotes || ''}
            onChange={handleChange('contrastNotes')}
            size="small"
            placeholder="e.g., IV contrast, oral contrast, with and without"
          />
        </Grid>
      )}

      <Grid item xs={12}>
        <Divider sx={{ my: 1 }} />
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
          Patient Transport
        </Typography>
      </Grid>

      {/* Transport Mode */}
      <Grid item xs={6}>
        <FormControl fullWidth size="small">
          <InputLabel>Transport Mode</InputLabel>
          <Select
            value={values.transportMode || 'ambulatory'}
            onChange={handleChange('transportMode')}
            label="Transport Mode"
          >
            {TRANSPORT_MODES.map((mode) => (
              <MenuItem key={mode.value} value={mode.value}>
                {mode.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>

      {/* Isolation Precautions */}
      <Grid item xs={6}>
        <FormControlLabel
          control={
            <Checkbox
              checked={values.isolationRequired || false}
              onChange={handleChange('isolationRequired')}
            />
          }
          label="Isolation Precautions"
          sx={{ mt: 1 }}
        />
      </Grid>

      {/* Scheduled Time */}
      <Grid item xs={12}>
        <TextField
          fullWidth
          label="Preferred Scheduling"
          type="datetime-local"
          value={values.scheduledDateTime || ''}
          onChange={handleChange('scheduledDateTime')}
          InputLabelProps={{ shrink: true }}
          size="small"
          helperText="Leave blank for routine scheduling"
        />
      </Grid>

      {/* Clinical History for Radiologist */}
      <Grid item xs={12}>
        <TextField
          fullWidth
          label="Clinical History for Radiologist"
          value={values.clinicalHistory || ''}
          onChange={handleChange('clinicalHistory')}
          multiline
          rows={2}
          size="small"
          placeholder="Brief relevant clinical history and indication for study"
        />
      </Grid>
    </>
  );
};

ImagingOrderFields.propTypes = {
  values: PropTypes.shape({
    modality: PropTypes.string,
    bodySite: PropTypes.string,
    laterality: PropTypes.string,
    contrastRequired: PropTypes.bool,
    contrastNotes: PropTypes.string,
    transportMode: PropTypes.string,
    isolationRequired: PropTypes.bool,
    scheduledDateTime: PropTypes.string,
    clinicalHistory: PropTypes.string
  }).isRequired,
  onChange: PropTypes.func.isRequired
};

export default ImagingOrderFields;
