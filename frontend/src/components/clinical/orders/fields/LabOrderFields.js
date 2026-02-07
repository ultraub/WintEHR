/**
 * LabOrderFields Component
 * Renders laboratory-specific form fields for CPOE
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

// Specimen types (SNOMED CT based)
const SPECIMEN_TYPES = [
  { value: 'blood', label: 'Blood' },
  { value: 'serum', label: 'Serum' },
  { value: 'plasma', label: 'Plasma' },
  { value: 'urine', label: 'Urine' },
  { value: 'stool', label: 'Stool' },
  { value: 'csf', label: 'Cerebrospinal Fluid (CSF)' },
  { value: 'sputum', label: 'Sputum' },
  { value: 'swab', label: 'Swab' },
  { value: 'tissue', label: 'Tissue' },
  { value: 'fluid', label: 'Body Fluid' },
  { value: 'saliva', label: 'Saliva' }
];

// Specimen sources
const SPECIMEN_SOURCES = [
  { value: 'venous', label: 'Venous (Venipuncture)' },
  { value: 'arterial', label: 'Arterial' },
  { value: 'fingerstick', label: 'Fingerstick (Capillary)' },
  { value: 'heelstick', label: 'Heelstick' },
  { value: 'central_line', label: 'Central Line' },
  { value: 'picc', label: 'PICC Line' },
  { value: 'port', label: 'Port' },
  { value: 'midstream', label: 'Midstream (Urine)' },
  { value: 'catheter', label: 'Catheter' },
  { value: 'random', label: 'Random' },
  { value: '24h_collection', label: '24-Hour Collection' }
];

const LabOrderFields = ({ values, onChange }) => {
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
          Specimen Information
        </Typography>
      </Grid>

      {/* Specimen Type */}
      <Grid item xs={6}>
        <FormControl fullWidth size="small">
          <InputLabel>Specimen Type</InputLabel>
          <Select
            value={values.specimenType || ''}
            onChange={handleChange('specimenType')}
            label="Specimen Type"
          >
            <MenuItem value="">
              <em>Not specified</em>
            </MenuItem>
            {SPECIMEN_TYPES.map((type) => (
              <MenuItem key={type.value} value={type.value}>
                {type.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>

      {/* Specimen Source */}
      <Grid item xs={6}>
        <FormControl fullWidth size="small">
          <InputLabel>Collection Source</InputLabel>
          <Select
            value={values.specimenSource || ''}
            onChange={handleChange('specimenSource')}
            label="Collection Source"
          >
            <MenuItem value="">
              <em>Not specified</em>
            </MenuItem>
            {SPECIMEN_SOURCES.map((source) => (
              <MenuItem key={source.value} value={source.value}>
                {source.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>

      {/* Collection Options */}
      <Grid item xs={12}>
        <Divider sx={{ my: 1 }} />
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
          Collection Requirements
        </Typography>
      </Grid>

      <Grid item xs={6}>
        <FormControlLabel
          control={
            <Checkbox
              checked={values.fastingRequired || false}
              onChange={handleChange('fastingRequired')}
            />
          }
          label="Fasting Required"
        />
      </Grid>

      <Grid item xs={6}>
        <FormControlLabel
          control={
            <Checkbox
              checked={values.statCollection || false}
              onChange={handleChange('statCollection')}
            />
          }
          label="STAT Collection"
        />
      </Grid>

      {/* Scheduled Collection Time */}
      <Grid item xs={12}>
        <TextField
          fullWidth
          label="Preferred Collection Time"
          type="datetime-local"
          value={values.collectionDateTime || ''}
          onChange={handleChange('collectionDateTime')}
          InputLabelProps={{ shrink: true }}
          size="small"
          helperText="Leave blank for routine collection"
        />
      </Grid>

      {/* Special Instructions */}
      <Grid item xs={12}>
        <TextField
          fullWidth
          label="Special Collection Instructions"
          value={values.specialInstructions || ''}
          onChange={handleChange('specialInstructions')}
          multiline
          rows={2}
          size="small"
          placeholder="e.g., Collect on ice, avoid hemolysis, timed specimen"
        />
      </Grid>
    </>
  );
};

LabOrderFields.propTypes = {
  values: PropTypes.shape({
    specimenType: PropTypes.string,
    specimenSource: PropTypes.string,
    fastingRequired: PropTypes.bool,
    statCollection: PropTypes.bool,
    collectionDateTime: PropTypes.string,
    specialInstructions: PropTypes.string
  }).isRequired,
  onChange: PropTypes.func.isRequired
};

export default LabOrderFields;
