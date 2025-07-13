/**
 * Vital Sign Condition Builder Component
 * Provides enhanced UI for building vital sign-based CDS conditions
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
  InputAdornment,
  Tooltip,
  IconButton,
  Alert,
  Stack,
  Chip,
  RadioGroup,
  FormControlLabel,
  Radio
} from '@mui/material';
import {
  Info as InfoIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Favorite as HeartIcon,
  Air as LungsIcon,
  Thermostat as TempIcon,
  MonitorHeart as BPIcon
} from '@mui/icons-material';
import { vitalSignsService } from '../../../../services/vitalSignsService';

// Vital sign types with metadata
const VITAL_SIGN_TYPES = [
  {
    id: 'blood-pressure',
    display: 'Blood Pressure',
    icon: <BPIcon />,
    hasComponents: true,
    components: ['systolic', 'diastolic'],
    unit: 'mmHg',
    category: 'cardiovascular'
  },
  {
    id: 'heart-rate',
    display: 'Heart Rate',
    icon: <HeartIcon />,
    loinc: '8867-4',
    unit: 'bpm',
    category: 'cardiovascular',
    normalRange: { min: 60, max: 100 }
  },
  {
    id: 'respiratory-rate',
    display: 'Respiratory Rate',
    icon: <LungsIcon />,
    loinc: '9279-1',
    unit: '/min',
    category: 'respiratory',
    normalRange: { min: 12, max: 20 }
  },
  {
    id: 'body-temperature',
    display: 'Body Temperature',
    icon: <TempIcon />,
    loinc: '8310-5',
    unit: '°F',
    unitAlt: '°C',
    category: 'metabolic',
    normalRange: { min: 97, max: 99.5, minC: 36.1, maxC: 37.5 }
  },
  {
    id: 'oxygen-saturation',
    display: 'Oxygen Saturation',
    icon: <LungsIcon />,
    loinc: '2708-6',
    unit: '%',
    category: 'respiratory',
    normalRange: { min: 95, max: 100 }
  },
  {
    id: 'body-weight',
    display: 'Body Weight',
    loinc: '29463-7',
    unit: 'kg',
    unitAlt: 'lb',
    category: 'metabolic'
  },
  {
    id: 'body-height',
    display: 'Body Height',
    loinc: '8302-2',
    unit: 'cm',
    unitAlt: 'in',
    category: 'metabolic'
  },
  {
    id: 'bmi',
    display: 'Body Mass Index',
    loinc: '39156-5',
    unit: 'kg/m²',
    category: 'metabolic',
    normalRange: { min: 18.5, max: 24.9 }
  },
  {
    id: 'pain-scale',
    display: 'Pain Scale',
    loinc: '72514-3',
    unit: '{score}',
    category: 'neurological',
    normalRange: { min: 0, max: 10 }
  }
];

// Operators for vital signs
const VITAL_OPERATORS = [
  { value: 'gt', label: 'Greater than (>)', icon: '>' },
  { value: 'gte', label: 'Greater than or equal (≥)', icon: '≥' },
  { value: 'lt', label: 'Less than (<)', icon: '<' },
  { value: 'lte', label: 'Less than or equal (≤)', icon: '≤' },
  { value: 'eq', label: 'Equals (=)', icon: '=' },
  { value: 'between', label: 'Between', icon: '↔' },
  { value: 'not_between', label: 'Not between', icon: '↮' },
  { value: 'trending_up', label: 'Trending up', icon: '📈' },
  { value: 'trending_down', label: 'Trending down', icon: '📉' },
  { value: 'abnormal', label: 'Abnormal', icon: '⚠' },
  { value: 'critical_high', label: 'Critical high', icon: '🚨↑' },
  { value: 'critical_low', label: 'Critical low', icon: '🚨↓' },
  { value: 'missing', label: 'Missing/Not recorded', icon: '❓' }
];

// Timeframe options
const TIMEFRAMES = [
  { value: 1, label: 'Last hour' },
  { value: 4, label: 'Last 4 hours' },
  { value: 8, label: 'Last 8 hours' },
  { value: 24, label: 'Last 24 hours' },
  { value: 72, label: 'Last 3 days' },
  { value: 168, label: 'Last week' },
  { value: 720, label: 'Last 30 days' },
  { value: -1, label: 'Most recent' }
];

// Age-based normal ranges for vital signs
const getAgeAdjustedRange = (vitalType, age) => {
  // Simplified age-based ranges - in production, this would be more comprehensive
  if (!age) return null;
  
  const ranges = {
    'heart-rate': {
      infant: { min: 100, max: 160 },
      child: { min: 70, max: 120 },
      teen: { min: 60, max: 100 },
      adult: { min: 60, max: 100 },
      elderly: { min: 60, max: 100 }
    },
    'respiratory-rate': {
      infant: { min: 30, max: 60 },
      child: { min: 20, max: 30 },
      teen: { min: 12, max: 20 },
      adult: { min: 12, max: 20 },
      elderly: { min: 12, max: 25 }
    },
    'blood-pressure': {
      child: { systolicMin: 90, systolicMax: 110, diastolicMin: 60, diastolicMax: 75 },
      teen: { systolicMin: 110, systolicMax: 130, diastolicMin: 70, diastolicMax: 85 },
      adult: { systolicMin: 90, systolicMax: 120, diastolicMin: 60, diastolicMax: 80 },
      elderly: { systolicMin: 90, systolicMax: 140, diastolicMin: 60, diastolicMax: 90 }
    }
  };
  
  let ageGroup = 'adult';
  if (age < 1) ageGroup = 'infant';
  else if (age < 12) ageGroup = 'child';
  else if (age < 18) ageGroup = 'teen';
  else if (age >= 65) ageGroup = 'elderly';
  
  return ranges[vitalType]?.[ageGroup];
};

const VitalSignConditionBuilder = ({ condition, onChange, onRemove }) => {
  const [selectedVital, setSelectedVital] = useState(null);
  const [component, setComponent] = useState('');
  const [unitPreference, setUnitPreference] = useState('metric'); // metric or imperial
  const [patientAge, setPatientAge] = useState(null);

  // Initialize from existing condition
  useEffect(() => {
    if (condition.vitalType) {
      const vital = VITAL_SIGN_TYPES.find(v => v.id === condition.vitalType);
      if (vital) {
        setSelectedVital(vital);
        if (condition.component) {
          setComponent(condition.component);
        }
      }
    }
  }, [condition.vitalType, condition.component]);

  const handleVitalChange = (vitalId) => {
    const vital = VITAL_SIGN_TYPES.find(v => v.id === vitalId);
    setSelectedVital(vital);
    
    const updates = {
      ...condition,
      vitalType: vitalId,
      vitalDisplay: vital.display,
      loinc: vital.loinc || (vital.id === 'blood-pressure' ? '85354-9' : null),
      unit: vital.unit,
      category: vital.category
    };
    
    // Reset component if not applicable
    if (!vital.hasComponents) {
      setComponent('');
      delete updates.component;
    } else if (vital.hasComponents && !component) {
      // Default to systolic for BP
      setComponent('systolic');
      updates.component = 'systolic';
    }
    
    onChange(updates);
  };

  const handleOperatorChange = (e) => {
    const operator = e.target.value;
    const updates = { ...condition, operator };
    
    // Reset values for operators that don't need them
    if (['abnormal', 'critical_high', 'critical_low', 'missing'].includes(operator)) {
      updates.value = null;
      updates.value2 = null;
    } else if (operator === 'between' || operator === 'not_between') {
      if (!updates.value2) {
        updates.value2 = '';
      }
    } else {
      updates.value2 = null;
    }
    
    onChange(updates);
  };

  const handleComponentChange = (e) => {
    const newComponent = e.target.value;
    setComponent(newComponent);
    onChange({
      ...condition,
      component: newComponent,
      loinc: newComponent === 'systolic' ? '8480-6' : '8462-4'
    });
  };

  const getNormalRange = () => {
    if (!selectedVital) return null;
    
    // Check age-adjusted ranges first
    if (patientAge) {
      const ageRange = getAgeAdjustedRange(selectedVital.id, patientAge);
      if (ageRange) {
        if (selectedVital.id === 'blood-pressure' && component) {
          return component === 'systolic' 
            ? { min: ageRange.systolicMin, max: ageRange.systolicMax }
            : { min: ageRange.diastolicMin, max: ageRange.diastolicMax };
        }
        return ageRange;
      }
    }
    
    // Fall back to standard ranges
    if (selectedVital.id === 'blood-pressure') {
      return component === 'systolic' 
        ? { min: 90, max: 120 }
        : { min: 60, max: 80 };
    }
    
    return selectedVital.normalRange;
  };

  const getCriticalRange = () => {
    if (!selectedVital) return null;
    
    const criticalRanges = {
      'heart-rate': { low: 40, high: 150 },
      'respiratory-rate': { low: 8, high: 30 },
      'oxygen-saturation': { low: 88, high: null },
      'body-temperature': { low: 95, high: 103, lowC: 35, highC: 39.4 },
      'blood-pressure': {
        systolic: { low: 70, high: 180 },
        diastolic: { low: 40, high: 120 }
      }
    };
    
    if (selectedVital.id === 'blood-pressure' && component) {
      return criticalRanges['blood-pressure'][component];
    }
    
    return criticalRanges[selectedVital.id];
  };

  const formatUnit = () => {
    if (!selectedVital) return '';
    
    if (unitPreference === 'imperial' && selectedVital.unitAlt) {
      return selectedVital.unitAlt;
    }
    
    return selectedVital.unit;
  };

  const needsValueInput = () => {
    return condition.operator && 
           !['abnormal', 'critical_high', 'critical_low', 'missing'].includes(condition.operator);
  };

  const getOperatorHelp = (operator) => {
    const helps = {
      gt: 'Triggers when vital sign is greater than the specified value',
      gte: 'Triggers when vital sign is greater than or equal to the specified value',
      lt: 'Triggers when vital sign is less than the specified value',
      lte: 'Triggers when vital sign is less than or equal to the specified value',
      eq: 'Triggers when vital sign exactly equals the specified value',
      between: 'Triggers when vital sign is between two specified values (inclusive)',
      not_between: 'Triggers when vital sign is outside the specified range',
      trending_up: 'Triggers when recent values show an upward trend',
      trending_down: 'Triggers when recent values show a downward trend',
      abnormal: 'Triggers when vital sign is outside normal range',
      critical_high: 'Triggers when vital sign is critically high',
      critical_low: 'Triggers when vital sign is critically low',
      missing: 'Triggers when the vital sign has not been recorded in the timeframe'
    };
    return helps[operator] || '';
  };

  return (
    <Box>
      <Grid container spacing={2} alignItems="flex-start">
        {/* Vital Sign Type Selection */}
        <Grid item xs={12}>
          <FormControl fullWidth>
            <InputLabel>Vital Sign Type</InputLabel>
            <Select
              value={selectedVital?.id || ''}
              onChange={(e) => handleVitalChange(e.target.value)}
              label="Vital Sign Type"
              data-testid="vital-sign-type-select"
            >
              {VITAL_SIGN_TYPES.map(vital => (
                <MenuItem key={vital.id} value={vital.id}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    {vital.icon}
                    <Box>
                      <Typography variant="body2">{vital.display}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {vital.loinc && `LOINC: ${vital.loinc}`}
                      </Typography>
                    </Box>
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Component Selection for Blood Pressure */}
        {selectedVital?.hasComponents && (
          <Grid item xs={12}>
            <FormControl component="fieldset">
              <Typography variant="subtitle2" gutterBottom>Component</Typography>
              <RadioGroup
                row
                value={component}
                onChange={handleComponentChange}
              >
                <FormControlLabel 
                  value="systolic" 
                  control={<Radio />} 
                  label="Systolic" 
                />
                <FormControlLabel 
                  value="diastolic" 
                  control={<Radio />} 
                  label="Diastolic" 
                />
              </RadioGroup>
            </FormControl>
          </Grid>
        )}

        {/* Normal Range Display */}
        {selectedVital && getNormalRange() && (
          <Grid item xs={12}>
            <Alert severity="info" icon={<InfoIcon />}>
              <Stack spacing={0.5}>
                <Typography variant="caption">
                  Normal range: {getNormalRange().min} - {getNormalRange().max} {formatUnit()}
                </Typography>
                {getCriticalRange() && (
                  <Typography variant="caption">
                    Critical: 
                    {getCriticalRange().low && ` Low <${getCriticalRange().low}`}
                    {getCriticalRange().high && ` | High >${getCriticalRange().high}`}
                    {formatUnit()}
                  </Typography>
                )}
                {patientAge && (
                  <Typography variant="caption" sx={{ fontStyle: 'italic' }}>
                    * Adjusted for age: {patientAge} years
                  </Typography>
                )}
              </Stack>
            </Alert>
          </Grid>
        )}

        {/* Unit Preference for Temperature/Weight */}
        {selectedVital?.unitAlt && (
          <Grid item xs={12}>
            <FormControl component="fieldset">
              <Typography variant="subtitle2" gutterBottom>Unit Preference</Typography>
              <RadioGroup
                row
                value={unitPreference}
                onChange={(e) => setUnitPreference(e.target.value)}
              >
                <FormControlLabel 
                  value="metric" 
                  control={<Radio size="small" />} 
                  label={`Metric (${selectedVital.unit})`} 
                />
                <FormControlLabel 
                  value="imperial" 
                  control={<Radio size="small" />} 
                  label={`Imperial (${selectedVital.unitAlt})`} 
                />
              </RadioGroup>
            </FormControl>
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
              {VITAL_OPERATORS.map(op => (
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
                onChange={(e) => onChange({ ...condition, value: e.target.value })}
                InputProps={{
                  endAdornment: selectedVital && (
                    <InputAdornment position="end">{formatUnit()}</InputAdornment>
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
                  onChange={(e) => onChange({ ...condition, value2: e.target.value })}
                  InputProps={{
                    endAdornment: selectedVital && (
                      <InputAdornment position="end">{formatUnit()}</InputAdornment>
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
              value={condition.timeframe || 24}
              onChange={(e) => onChange({ ...condition, timeframe: e.target.value })}
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

        {/* Trend Configuration */}
        {(condition.operator === 'trending_up' || condition.operator === 'trending_down') && (
          <Grid item xs={12}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Minimum number of readings"
                  type="number"
                  value={condition.trendMinReadings || 3}
                  onChange={(e) => onChange({ ...condition, trendMinReadings: e.target.value })}
                  helperText="Minimum readings needed to calculate trend"
                  InputProps={{
                    inputProps: { min: 2, max: 10 }
                  }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Trend threshold (%)"
                  type="number"
                  value={condition.trendThreshold || 10}
                  onChange={(e) => onChange({ ...condition, trendThreshold: e.target.value })}
                  helperText="Minimum percentage change to trigger"
                  InputProps={{
                    inputProps: { min: 1, max: 50 },
                    endAdornment: <InputAdornment position="end">%</InputAdornment>
                  }}
                />
              </Grid>
            </Grid>
          </Grid>
        )}

        {/* Patient Age (for testing/preview) */}
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Patient Age (optional, for range adjustment)"
            type="number"
            value={patientAge || ''}
            onChange={(e) => setPatientAge(e.target.value ? parseInt(e.target.value) : null)}
            helperText="Enter patient age to see age-adjusted normal ranges"
            InputProps={{
              endAdornment: <InputAdornment position="end">years</InputAdornment>
            }}
          />
        </Grid>
      </Grid>
    </Box>
  );
};

export default VitalSignConditionBuilder;