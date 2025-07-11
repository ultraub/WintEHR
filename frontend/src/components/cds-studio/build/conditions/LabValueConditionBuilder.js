/**
 * Lab Value Condition Builder Component
 * Provides enhanced UI for building lab value-based CDS conditions
 */
import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Typography,
  Autocomplete,
  InputAdornment,
  Tooltip,
  IconButton,
  Chip,
  Alert
} from '@mui/material';
import {
  Info as InfoIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon
} from '@mui/icons-material';
import { searchService } from '../../../../services/searchService';

// Common lab tests with LOINC codes
const COMMON_LAB_TESTS = [
  { code: '4548-4', display: 'Hemoglobin A1c', unit: '%', category: 'Diabetes' },
  { code: '2160-0', display: 'Creatinine', unit: 'mg/dL', category: 'Renal' },
  { code: '2345-7', display: 'Glucose', unit: 'mg/dL', category: 'Diabetes' },
  { code: '2951-2', display: 'Sodium', unit: 'mmol/L', category: 'Electrolytes' },
  { code: '2823-3', display: 'Potassium', unit: 'mmol/L', category: 'Electrolytes' },
  { code: '3094-0', display: 'BUN (Blood Urea Nitrogen)', unit: 'mg/dL', category: 'Renal' },
  { code: '33914-3', display: 'eGFR', unit: 'mL/min/1.73m²', category: 'Renal' },
  { code: '2085-9', display: 'HDL Cholesterol', unit: 'mg/dL', category: 'Lipids' },
  { code: '2089-1', display: 'LDL Cholesterol', unit: 'mg/dL', category: 'Lipids' },
  { code: '2571-8', display: 'Triglycerides', unit: 'mg/dL', category: 'Lipids' },
  { code: '1742-6', display: 'ALT', unit: 'U/L', category: 'Liver' },
  { code: '1920-8', display: 'AST', unit: 'U/L', category: 'Liver' },
  { code: '789-8', display: 'Hemoglobin', unit: 'g/dL', category: 'Hematology' },
  { code: '718-7', display: 'WBC', unit: '10*3/uL', category: 'Hematology' },
  { code: '777-3', display: 'Platelet Count', unit: '10*3/uL', category: 'Hematology' },
  { code: '1988-5', display: 'CRP', unit: 'mg/L', category: 'Inflammation' },
  { code: '4544-3', display: 'Hematocrit', unit: '%', category: 'Hematology' },
  { code: '17861-6', display: 'Calcium', unit: 'mg/dL', category: 'Electrolytes' },
  { code: '14749-6', display: 'Glucose (fasting)', unit: 'mg/dL', category: 'Diabetes' },
  { code: '1759-0', display: 'Albumin', unit: 'g/dL', category: 'Liver' }
];

// Operators for lab values
const LAB_OPERATORS = [
  { value: 'gt', label: 'Greater than (>)', icon: '>' },
  { value: 'gte', label: 'Greater than or equal (≥)', icon: '≥' },
  { value: 'lt', label: 'Less than (<)', icon: '<' },
  { value: 'lte', label: 'Less than or equal (≤)', icon: '≤' },
  { value: 'eq', label: 'Equals (=)', icon: '=' },
  { value: 'between', label: 'Between', icon: '↔' },
  { value: 'not_between', label: 'Not between', icon: '↮' },
  { value: 'abnormal', label: 'Abnormal (any)', icon: '⚠' },
  { value: 'critical', label: 'Critical', icon: '🚨' },
  { value: 'trending_up', label: 'Trending up', icon: '📈' },
  { value: 'trending_down', label: 'Trending down', icon: '📉' },
  { value: 'missing', label: 'Missing/Not done', icon: '❓' }
];

// Timeframe options
const TIMEFRAMES = [
  { value: 7, label: 'Last 7 days' },
  { value: 30, label: 'Last 30 days' },
  { value: 90, label: 'Last 90 days' },
  { value: 180, label: 'Last 6 months' },
  { value: 365, label: 'Last year' },
  { value: 730, label: 'Last 2 years' },
  { value: -1, label: 'Any time' }
];

const LabValueConditionBuilder = ({ condition, onChange, onRemove }) => {
  const [selectedLab, setSelectedLab] = useState(null);
  const [labSearchInput, setLabSearchInput] = useState('');
  const [labOptions, setLabOptions] = useState(COMMON_LAB_TESTS);
  const [searching, setSearching] = useState(false);

  // Initialize from existing condition
  useEffect(() => {
    if (condition.labTest) {
      const lab = COMMON_LAB_TESTS.find(l => l.code === condition.labTest);
      if (lab) {
        setSelectedLab(lab);
      }
    }
  }, [condition.labTest]);

  // Search for lab tests
  const searchLabTests = async (query) => {
    if (!query || query.length < 2) {
      setLabOptions(COMMON_LAB_TESTS);
      return;
    }

    setSearching(true);
    try {
      // In real implementation, this would search LOINC
      // For now, filter common tests
      const filtered = COMMON_LAB_TESTS.filter(lab =>
        lab.display.toLowerCase().includes(query.toLowerCase()) ||
        lab.code.includes(query)
      );
      setLabOptions(filtered.length > 0 ? filtered : COMMON_LAB_TESTS);
    } catch (error) {
      console.error('Error searching lab tests:', error);
      setLabOptions(COMMON_LAB_TESTS);
    } finally {
      setSearching(false);
    }
  };

  const handleLabChange = (event, newValue) => {
    setSelectedLab(newValue);
    if (newValue) {
      onChange({
        ...condition,
        labTest: newValue.code,
        labTestDisplay: newValue.display,
        unit: newValue.unit,
        category: newValue.category
      });
    }
  };

  const handleOperatorChange = (e) => {
    const operator = e.target.value;
    const updates = { ...condition, operator };
    
    // Reset values for operators that don't need them
    if (['abnormal', 'critical', 'missing'].includes(operator)) {
      updates.value = null;
      updates.value2 = null;
    } else if (operator === 'between' || operator === 'not_between') {
      // Initialize range values
      if (!updates.value2) {
        updates.value2 = '';
      }
    } else {
      // Single value operators
      updates.value2 = null;
    }
    
    onChange(updates);
  };

  const handleValueChange = (field, value) => {
    onChange({
      ...condition,
      [field]: value
    });
  };

  const getOperatorHelp = (operator) => {
    const helps = {
      gt: 'Triggers when lab value is greater than the specified value',
      gte: 'Triggers when lab value is greater than or equal to the specified value',
      lt: 'Triggers when lab value is less than the specified value',
      lte: 'Triggers when lab value is less than or equal to the specified value',
      eq: 'Triggers when lab value exactly equals the specified value',
      between: 'Triggers when lab value is between two specified values (inclusive)',
      not_between: 'Triggers when lab value is outside the specified range',
      abnormal: 'Triggers when lab value is flagged as abnormal by the lab',
      critical: 'Triggers when lab value is in the critical range',
      trending_up: 'Triggers when recent values show an upward trend',
      trending_down: 'Triggers when recent values show a downward trend',
      missing: 'Triggers when the lab test has not been performed in the timeframe'
    };
    return helps[operator] || '';
  };

  const getReferenceRange = () => {
    if (!selectedLab) return null;
    
    // Reference ranges (simplified - in production, these would be age/gender specific)
    const ranges = {
      '4548-4': { low: 4.0, high: 5.6, critical_low: null, critical_high: 9.0 }, // A1c
      '2160-0': { low: 0.6, high: 1.2, critical_low: null, critical_high: 4.0 }, // Creatinine
      '2345-7': { low: 70, high: 100, critical_low: 40, critical_high: 400 }, // Glucose
      '2951-2': { low: 136, high: 145, critical_low: 120, critical_high: 160 }, // Sodium
      '2823-3': { low: 3.5, high: 5.1, critical_low: 2.5, critical_high: 6.5 }, // Potassium
      '789-8': { low: 12.0, high: 16.0, critical_low: 7.0, critical_high: null }, // Hemoglobin
      '718-7': { low: 4.5, high: 11.0, critical_low: 2.0, critical_high: 30.0 }, // WBC
      '777-3': { low: 150, high: 400, critical_low: 50, critical_high: 1000 } // Platelets
    };
    
    return ranges[selectedLab.code];
  };

  const needsValueInput = () => {
    return condition.operator && 
           !['abnormal', 'critical', 'missing', 'trending_up', 'trending_down'].includes(condition.operator);
  };

  return (
    <Box>
      <Grid container spacing={2} alignItems="flex-start">
        {/* Lab Test Selection */}
        <Grid item xs={12}>
          <Autocomplete
            value={selectedLab}
            onChange={handleLabChange}
            inputValue={labSearchInput}
            onInputChange={(event, newInputValue) => {
              setLabSearchInput(newInputValue);
              searchLabTests(newInputValue);
            }}
            options={labOptions}
            getOptionLabel={(option) => `${option.display} (${option.code})`}
            renderOption={(props, option) => (
              <Box component="li" {...props}>
                <Box>
                  <Typography variant="body2">{option.display}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    LOINC: {option.code} | Category: {option.category}
                  </Typography>
                </Box>
              </Box>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Lab Test"
                placeholder="Search by name or LOINC code"
                required
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {searching && <Typography variant="caption">Searching...</Typography>}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
            loading={searching}
          />
        </Grid>

        {/* Show reference range if available */}
        {selectedLab && getReferenceRange() && (
          <Grid item xs={12}>
            <Alert severity="info" icon={<InfoIcon />}>
              <Typography variant="caption">
                Normal range: {getReferenceRange().low} - {getReferenceRange().high} {selectedLab.unit}
                {getReferenceRange().critical_low && (
                  <> | Critical low: &lt;{getReferenceRange().critical_low}</>
                )}
                {getReferenceRange().critical_high && (
                  <> | Critical high: &gt;{getReferenceRange().critical_high}</>
                )}
              </Typography>
            </Alert>
          </Grid>
        )}

        {/* Operator Selection */}
        <Grid item xs={12} md={4}>
          <FormControl fullWidth>
            <InputLabel>Operator</InputLabel>
            <Select
              value={condition.operator || ''}
              onChange={handleOperatorChange}
              label="Operator"
              data-testid="operator-select"
            >
              {LAB_OPERATORS.map(op => (
                <MenuItem key={op.value} value={op.value}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="body2">{op.icon}</Typography>
                    <Typography>{op.label}</Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {condition.operator && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
              {getOperatorHelp(condition.operator)}
            </Typography>
          )}
        </Grid>

        {/* Value inputs */}
        {needsValueInput() && (
          <>
            <Grid item xs={12} md={condition.operator === 'between' || condition.operator === 'not_between' ? 2 : 4}>
              <TextField
                fullWidth
                label={condition.operator === 'between' || condition.operator === 'not_between' ? 'From' : 'Value'}
                type="number"
                value={condition.value || ''}
                onChange={(e) => handleValueChange('value', e.target.value)}
                InputProps={{
                  endAdornment: selectedLab && (
                    <InputAdornment position="end">{selectedLab.unit}</InputAdornment>
                  )
                }}
                required
              />
            </Grid>

            {(condition.operator === 'between' || condition.operator === 'not_between') && (
              <Grid item xs={12} md={2}>
                <TextField
                  fullWidth
                  label="To"
                  type="number"
                  value={condition.value2 || ''}
                  onChange={(e) => handleValueChange('value2', e.target.value)}
                  InputProps={{
                    endAdornment: selectedLab && (
                      <InputAdornment position="end">{selectedLab.unit}</InputAdornment>
                    )
                  }}
                  required
                />
              </Grid>
            )}
          </>
        )}

        {/* Timeframe Selection */}
        <Grid item xs={12} md={4}>
          <FormControl fullWidth>
            <InputLabel>Timeframe</InputLabel>
            <Select
              value={condition.timeframe || 90}
              onChange={(e) => handleValueChange('timeframe', e.target.value)}
              label="Timeframe"
              data-testid="timeframe-select"
            >
              {TIMEFRAMES.map(tf => (
                <MenuItem key={tf.value} value={tf.value}>
                  {tf.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Additional Options */}
        {(condition.operator === 'trending_up' || condition.operator === 'trending_down') && (
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Minimum number of results for trend"
              type="number"
              value={condition.trendMinResults || 3}
              onChange={(e) => handleValueChange('trendMinResults', e.target.value)}
              helperText="Minimum number of results needed to calculate trend"
              InputProps={{
                inputProps: { min: 2, max: 10 }
              }}
            />
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default LabValueConditionBuilder;