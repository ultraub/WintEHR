/**
 * MedicationOrderFields Component
 * Renders medication-specific form fields for CPOE
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

// Standard medication routes (SNOMED CT based)
const ROUTES = [
  { value: 'oral', label: 'Oral (PO)' },
  { value: 'iv', label: 'Intravenous (IV)' },
  { value: 'im', label: 'Intramuscular (IM)' },
  { value: 'subcutaneous', label: 'Subcutaneous (SC)' },
  { value: 'topical', label: 'Topical' },
  { value: 'inhalation', label: 'Inhalation' },
  { value: 'rectal', label: 'Rectal' },
  { value: 'sublingual', label: 'Sublingual (SL)' },
  { value: 'transdermal', label: 'Transdermal' },
  { value: 'ophthalmic', label: 'Ophthalmic' },
  { value: 'otic', label: 'Otic' },
  { value: 'nasal', label: 'Nasal' }
];

// Standard medication frequencies
const FREQUENCIES = [
  { value: 'once', label: 'Once' },
  { value: 'daily', label: 'Daily (QD)' },
  { value: 'bid', label: 'Twice daily (BID)' },
  { value: 'tid', label: 'Three times daily (TID)' },
  { value: 'qid', label: 'Four times daily (QID)' },
  { value: 'q4h', label: 'Every 4 hours (Q4H)' },
  { value: 'q6h', label: 'Every 6 hours (Q6H)' },
  { value: 'q8h', label: 'Every 8 hours (Q8H)' },
  { value: 'q12h', label: 'Every 12 hours (Q12H)' },
  { value: 'qhs', label: 'At bedtime (QHS)' },
  { value: 'qam', label: 'Every morning (QAM)' },
  { value: 'qpm', label: 'Every evening (QPM)' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'prn', label: 'As needed (PRN)' }
];

// Common dose units
const DOSE_UNITS = [
  { value: 'mg', label: 'mg' },
  { value: 'g', label: 'g' },
  { value: 'mcg', label: 'mcg' },
  { value: 'mL', label: 'mL' },
  { value: 'units', label: 'units' },
  { value: 'tablets', label: 'tablet(s)' },
  { value: 'capsules', label: 'capsule(s)' },
  { value: 'drops', label: 'drop(s)' },
  { value: 'puffs', label: 'puff(s)' },
  { value: 'patches', label: 'patch(es)' }
];

// Duration units
const DURATION_UNITS = [
  { value: 'days', label: 'days' },
  { value: 'weeks', label: 'weeks' },
  { value: 'months', label: 'months' }
];

// Dispense units
const DISPENSE_UNITS = [
  { value: 'tablets', label: 'tablets' },
  { value: 'capsules', label: 'capsules' },
  { value: 'mL', label: 'mL' },
  { value: 'units', label: 'units' },
  { value: 'patches', label: 'patches' },
  { value: 'inhalers', label: 'inhalers' },
  { value: 'bottles', label: 'bottles' },
  { value: 'tubes', label: 'tubes' }
];

const MedicationOrderFields = ({ values, onChange }) => {
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
          Dosage Information
        </Typography>
      </Grid>

      {/* Dose and Unit */}
      <Grid item xs={6}>
        <TextField
          fullWidth
          label="Dose"
          type="number"
          value={values.dose || ''}
          onChange={handleChange('dose')}
          inputProps={{ min: 0, step: 'any' }}
          size="small"
        />
      </Grid>
      <Grid item xs={6}>
        <FormControl fullWidth size="small">
          <InputLabel>Unit</InputLabel>
          <Select
            value={values.doseUnit || 'mg'}
            onChange={handleChange('doseUnit')}
            label="Unit"
          >
            {DOSE_UNITS.map((unit) => (
              <MenuItem key={unit.value} value={unit.value}>
                {unit.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>

      {/* Route and Frequency */}
      <Grid item xs={6}>
        <FormControl fullWidth size="small">
          <InputLabel>Route</InputLabel>
          <Select
            value={values.route || 'oral'}
            onChange={handleChange('route')}
            label="Route"
          >
            {ROUTES.map((route) => (
              <MenuItem key={route.value} value={route.value}>
                {route.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>
      <Grid item xs={6}>
        <FormControl fullWidth size="small">
          <InputLabel>Frequency</InputLabel>
          <Select
            value={values.frequency || 'daily'}
            onChange={handleChange('frequency')}
            label="Frequency"
          >
            {FREQUENCIES.map((freq) => (
              <MenuItem key={freq.value} value={freq.value}>
                {freq.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>

      {/* Duration */}
      <Grid item xs={6}>
        <TextField
          fullWidth
          label="Duration"
          type="number"
          value={values.duration || ''}
          onChange={handleChange('duration')}
          inputProps={{ min: 1 }}
          size="small"
        />
      </Grid>
      <Grid item xs={6}>
        <FormControl fullWidth size="small">
          <InputLabel>Duration Unit</InputLabel>
          <Select
            value={values.durationUnit || 'days'}
            onChange={handleChange('durationUnit')}
            label="Duration Unit"
          >
            {DURATION_UNITS.map((unit) => (
              <MenuItem key={unit.value} value={unit.value}>
                {unit.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>

      {/* PRN */}
      <Grid item xs={12}>
        <FormControlLabel
          control={
            <Checkbox
              checked={values.prn || false}
              onChange={handleChange('prn')}
            />
          }
          label="PRN (As Needed)"
        />
      </Grid>
      {values.prn && (
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="PRN Reason"
            value={values.prnReason || ''}
            onChange={handleChange('prnReason')}
            placeholder="e.g., for pain, for nausea"
            size="small"
          />
        </Grid>
      )}

      <Grid item xs={12}>
        <Divider sx={{ my: 1 }} />
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
          Dispensing Information
        </Typography>
      </Grid>

      {/* Dispense Quantity */}
      <Grid item xs={6}>
        <TextField
          fullWidth
          label="Dispense Quantity"
          type="number"
          value={values.dispenseQuantity || ''}
          onChange={handleChange('dispenseQuantity')}
          inputProps={{ min: 1 }}
          size="small"
        />
      </Grid>
      <Grid item xs={6}>
        <FormControl fullWidth size="small">
          <InputLabel>Dispense Unit</InputLabel>
          <Select
            value={values.dispenseUnit || 'tablets'}
            onChange={handleChange('dispenseUnit')}
            label="Dispense Unit"
          >
            {DISPENSE_UNITS.map((unit) => (
              <MenuItem key={unit.value} value={unit.value}>
                {unit.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>

      {/* Refills */}
      <Grid item xs={6}>
        <TextField
          fullWidth
          label="Refills"
          type="number"
          value={values.refills ?? 0}
          onChange={handleChange('refills')}
          inputProps={{ min: 0, max: 11 }}
          size="small"
          helperText="0-11 allowed"
        />
      </Grid>
      <Grid item xs={6}>
        <FormControlLabel
          control={
            <Checkbox
              checked={values.genericAllowed ?? true}
              onChange={handleChange('genericAllowed')}
            />
          }
          label="Generic Substitution Allowed"
          sx={{ mt: 1 }}
        />
      </Grid>
    </>
  );
};

MedicationOrderFields.propTypes = {
  values: PropTypes.shape({
    dose: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    doseUnit: PropTypes.string,
    route: PropTypes.string,
    frequency: PropTypes.string,
    duration: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    durationUnit: PropTypes.string,
    prn: PropTypes.bool,
    prnReason: PropTypes.string,
    dispenseQuantity: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    dispenseUnit: PropTypes.string,
    refills: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    genericAllowed: PropTypes.bool
  }).isRequired,
  onChange: PropTypes.func.isRequired
};

export default MedicationOrderFields;
