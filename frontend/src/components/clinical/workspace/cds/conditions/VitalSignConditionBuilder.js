/**
 * Vital Sign Condition Builder Component
 * Provides a form for building vital sign-based CDS conditions
 * with type selection, comparison operators, value inputs, and unit display.
 */
import React, { useEffect } from 'react';
import {
  Box,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Typography,
  IconButton,
  InputAdornment,
  Chip,
  Alert,
  Stack,
  Tooltip
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Info as InfoIcon
} from '@mui/icons-material';

// Vital sign type definitions with LOINC codes and units
const VITAL_SIGN_TYPES = [
  { value: 'heart_rate', label: 'Heart Rate', code: '8867-4', unit: 'bpm', min: 0, max: 300 },
  { value: 'bp_systolic', label: 'Blood Pressure (Systolic)', code: '8480-6', unit: 'mmHg', min: 0, max: 300 },
  { value: 'bp_diastolic', label: 'Blood Pressure (Diastolic)', code: '8462-4', unit: 'mmHg', min: 0, max: 200 },
  { value: 'temperature', label: 'Temperature', code: '8310-5', unit: '\u00B0F', min: 85, max: 115 },
  { value: 'respiratory_rate', label: 'Respiratory Rate', code: '9279-1', unit: '/min', min: 0, max: 100 },
  { value: 'oxygen_saturation', label: 'Oxygen Saturation (SpO2)', code: '2708-6', unit: '%', min: 0, max: 100 },
  { value: 'weight', label: 'Weight', code: '29463-7', unit: 'kg', min: 0, max: 500 },
  { value: 'height', label: 'Height', code: '8302-2', unit: 'cm', min: 0, max: 300 },
  { value: 'bmi', label: 'BMI', code: '39156-5', unit: 'kg/m\u00B2', min: 0, max: 100 }
];

// Comparison operators
const VITAL_OPERATORS = [
  { value: 'gt', label: 'Greater than (>)', symbol: '>' },
  { value: 'lt', label: 'Less than (<)', symbol: '<' },
  { value: 'eq', label: 'Equal to (=)', symbol: '=' },
  { value: 'gte', label: 'Greater or equal (\u2265)', symbol: '\u2265' },
  { value: 'lte', label: 'Less or equal (\u2264)', symbol: '\u2264' },
  { value: 'between', label: 'Between', symbol: '\u2194' }
];

// Normal reference ranges for informational display
const NORMAL_RANGES = {
  heart_rate: { low: 60, high: 100, label: '60\u2013100 bpm' },
  bp_systolic: { low: 90, high: 120, label: '90\u2013120 mmHg' },
  bp_diastolic: { low: 60, high: 80, label: '60\u201380 mmHg' },
  temperature: { low: 97.8, high: 99.1, label: '97.8\u201399.1 \u00B0F' },
  respiratory_rate: { low: 12, high: 20, label: '12\u201320 /min' },
  oxygen_saturation: { low: 95, high: 100, label: '95\u2013100%' },
  weight: null,
  height: null,
  bmi: { low: 18.5, high: 24.9, label: '18.5\u201324.9 kg/m\u00B2' }
};

const VitalSignConditionBuilder = ({ condition, onChange, onRemove }) => {
  // Initialize default values on mount
  useEffect(() => {
    if (!condition.operator) {
      onChange({
        ...condition,
        vitalType: condition.vitalType || '',
        operator: 'gt',
        value: '',
        value2: ''
      });
    }
  }, []);

  const selectedType = VITAL_SIGN_TYPES.find(v => v.value === condition.vitalType) || null;
  const normalRange = condition.vitalType ? NORMAL_RANGES[condition.vitalType] : null;
  const isBetween = condition.operator === 'between';

  const handleFieldChange = (field, value) => {
    const updates = { ...condition, [field]: value };

    // When vital type changes, update the LOINC code and reset values
    if (field === 'vitalType') {
      const type = VITAL_SIGN_TYPES.find(v => v.value === value);
      if (type) {
        updates.vitalCode = type.code;
        updates.unit = type.unit;
        updates.vitalDisplay = type.label;
      }
      updates.value = '';
      updates.value2 = '';
    }

    // When operator changes to/from "between", manage value2
    if (field === 'operator') {
      if (value === 'between') {
        if (!updates.value2) {
          updates.value2 = '';
        }
      } else {
        updates.value2 = '';
      }
    }

    onChange(updates);
  };

  const getConditionSummary = () => {
    if (!condition.vitalType || !condition.operator || !condition.value) return null;

    const type = VITAL_SIGN_TYPES.find(v => v.value === condition.vitalType);
    const op = VITAL_OPERATORS.find(o => o.value === condition.operator);
    if (!type || !op) return null;

    if (isBetween && condition.value2) {
      return `${type.label} between ${condition.value} and ${condition.value2} ${type.unit}`;
    }

    return `${type.label} ${op.symbol} ${condition.value} ${type.unit}`;
  };

  return (
    <Box>
      <Stack spacing={2}>
        {/* Header with remove button */}
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Alert severity="info" icon={<InfoIcon />} sx={{ flex: 1, mr: 1 }}>
            Define a vital sign condition. Values are compared against the patient's most recent recorded vital signs.
          </Alert>
          {onRemove && (
            <Tooltip title="Remove condition">
              <IconButton color="error" onClick={onRemove} size="small">
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          )}
        </Stack>

        <Grid container spacing={2} alignItems="flex-start">
          {/* Vital Sign Type */}
          <Grid item xs={12} md={6}>
            <FormControl fullWidth required>
              <InputLabel>Vital Sign</InputLabel>
              <Select
                value={condition.vitalType || ''}
                label="Vital Sign"
                onChange={(e) => handleFieldChange('vitalType', e.target.value)}
                data-testid="vital-type-select"
              >
                {VITAL_SIGN_TYPES.map(type => (
                  <MenuItem key={type.value} value={type.value}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography>{type.label}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        ({type.unit})
                      </Typography>
                    </Stack>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Operator */}
          <Grid item xs={12} md={6}>
            <FormControl fullWidth required>
              <InputLabel>Operator</InputLabel>
              <Select
                value={condition.operator || ''}
                label="Operator"
                onChange={(e) => handleFieldChange('operator', e.target.value)}
                data-testid="operator-select"
              >
                {VITAL_OPERATORS.map(op => (
                  <MenuItem key={op.value} value={op.value}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', minWidth: 20 }}>
                        {op.symbol}
                      </Typography>
                      <Typography>{op.label}</Typography>
                    </Stack>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Normal range info */}
          {selectedType && normalRange && (
            <Grid item xs={12}>
              <Alert severity="info" variant="outlined" sx={{ py: 0.5 }}>
                <Typography variant="caption">
                  Normal range for {selectedType.label}: {normalRange.label}
                </Typography>
              </Alert>
            </Grid>
          )}

          {/* Value input(s) */}
          <Grid item xs={12} md={isBetween ? 3 : 6}>
            <TextField
              fullWidth
              type="number"
              label={isBetween ? 'From' : 'Value'}
              value={condition.value || ''}
              onChange={(e) => handleFieldChange('value', e.target.value)}
              required
              InputProps={{
                inputProps: {
                  min: selectedType?.min ?? 0,
                  max: selectedType?.max ?? 999,
                  step: condition.vitalType === 'temperature' || condition.vitalType === 'bmi' ? 0.1 : 1
                },
                endAdornment: selectedType && (
                  <InputAdornment position="end">{selectedType.unit}</InputAdornment>
                )
              }}
              helperText={!isBetween && selectedType ? `Enter value in ${selectedType.unit}` : undefined}
            />
          </Grid>

          {isBetween && (
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                type="number"
                label="To"
                value={condition.value2 || ''}
                onChange={(e) => handleFieldChange('value2', e.target.value)}
                required
                InputProps={{
                  inputProps: {
                    min: selectedType?.min ?? 0,
                    max: selectedType?.max ?? 999,
                    step: condition.vitalType === 'temperature' || condition.vitalType === 'bmi' ? 0.1 : 1
                  },
                  endAdornment: selectedType && (
                    <InputAdornment position="end">{selectedType.unit}</InputAdornment>
                  )
                }}
              />
            </Grid>
          )}
        </Grid>

        {/* Condition Summary */}
        {getConditionSummary() && (
          <Box>
            <Typography variant="caption" color="text.secondary">
              Condition Summary:
            </Typography>
            <Chip
              label={getConditionSummary()}
              color="primary"
              variant="outlined"
              size="small"
              sx={{ ml: 1 }}
            />
          </Box>
        )}

        {/* Quick Presets */}
        {condition.vitalType && (
          <Box>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              Quick Presets:
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
              {condition.vitalType === 'heart_rate' && (
                <>
                  <Chip
                    label="Tachycardia (>100 bpm)"
                    size="small"
                    clickable
                    onClick={() => onChange({ ...condition, operator: 'gt', value: '100', value2: '' })}
                  />
                  <Chip
                    label="Bradycardia (<60 bpm)"
                    size="small"
                    clickable
                    onClick={() => onChange({ ...condition, operator: 'lt', value: '60', value2: '' })}
                  />
                </>
              )}
              {condition.vitalType === 'bp_systolic' && (
                <>
                  <Chip
                    label="Hypertension (\u2265140 mmHg)"
                    size="small"
                    clickable
                    onClick={() => onChange({ ...condition, operator: 'gte', value: '140', value2: '' })}
                  />
                  <Chip
                    label="Hypotension (<90 mmHg)"
                    size="small"
                    clickable
                    onClick={() => onChange({ ...condition, operator: 'lt', value: '90', value2: '' })}
                  />
                </>
              )}
              {condition.vitalType === 'bp_diastolic' && (
                <>
                  <Chip
                    label="Hypertension (\u226590 mmHg)"
                    size="small"
                    clickable
                    onClick={() => onChange({ ...condition, operator: 'gte', value: '90', value2: '' })}
                  />
                  <Chip
                    label="Hypotension (<60 mmHg)"
                    size="small"
                    clickable
                    onClick={() => onChange({ ...condition, operator: 'lt', value: '60', value2: '' })}
                  />
                </>
              )}
              {condition.vitalType === 'temperature' && (
                <>
                  <Chip
                    label="Fever (>100.4 \u00B0F)"
                    size="small"
                    clickable
                    onClick={() => onChange({ ...condition, operator: 'gt', value: '100.4', value2: '' })}
                  />
                  <Chip
                    label="Hypothermia (<95 \u00B0F)"
                    size="small"
                    clickable
                    onClick={() => onChange({ ...condition, operator: 'lt', value: '95', value2: '' })}
                  />
                </>
              )}
              {condition.vitalType === 'respiratory_rate' && (
                <>
                  <Chip
                    label="Tachypnea (>20 /min)"
                    size="small"
                    clickable
                    onClick={() => onChange({ ...condition, operator: 'gt', value: '20', value2: '' })}
                  />
                  <Chip
                    label="Bradypnea (<12 /min)"
                    size="small"
                    clickable
                    onClick={() => onChange({ ...condition, operator: 'lt', value: '12', value2: '' })}
                  />
                </>
              )}
              {condition.vitalType === 'oxygen_saturation' && (
                <>
                  <Chip
                    label="Hypoxemia (<90%)"
                    size="small"
                    clickable
                    onClick={() => onChange({ ...condition, operator: 'lt', value: '90', value2: '' })}
                  />
                  <Chip
                    label="Low SpO2 (<95%)"
                    size="small"
                    clickable
                    onClick={() => onChange({ ...condition, operator: 'lt', value: '95', value2: '' })}
                  />
                </>
              )}
              {condition.vitalType === 'bmi' && (
                <>
                  <Chip
                    label="Underweight (<18.5)"
                    size="small"
                    clickable
                    onClick={() => onChange({ ...condition, operator: 'lt', value: '18.5', value2: '' })}
                  />
                  <Chip
                    label="Overweight (\u226525)"
                    size="small"
                    clickable
                    onClick={() => onChange({ ...condition, operator: 'gte', value: '25', value2: '' })}
                  />
                  <Chip
                    label="Obese (\u226530)"
                    size="small"
                    clickable
                    onClick={() => onChange({ ...condition, operator: 'gte', value: '30', value2: '' })}
                  />
                </>
              )}
            </Stack>
          </Box>
        )}
      </Stack>
    </Box>
  );
};

export default VitalSignConditionBuilder;
