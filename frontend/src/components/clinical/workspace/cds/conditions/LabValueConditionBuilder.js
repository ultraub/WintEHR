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
import { searchService } from '../../../../../services/searchService';
import { cdsClinicalDataService } from '../../../../../services/cdsClinicalDataService';

// No hardcoded lab tests - using dynamic catalog only

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
  const [labOptions, setLabOptions] = useState([]);
  const [searching, setSearching] = useState(false);

  // Initialize from existing condition
  useEffect(() => {
    // Initialize operator if not set
    if (!condition.operator) {
      onChange({ operator: 'gt' });
    }
    
    if (condition.labTest) {
      const lab = labOptions.find(l => l.code === condition.labTest);
      if (lab) {
        setSelectedLab(lab);
      }
    }
  }, [condition.labTest, labOptions]);

  // Load initial dynamic catalog on component mount
  useEffect(() => {
    searchLabTests('');
  }, []);

  // Search for lab tests using dynamic catalog - NO FALLBACKS
  const searchLabTests = async (query) => {
    if (!query || query.length < 2) {
      // Load dynamic lab catalog without search filter
      setSearching(true);
      try {
        const dynamicLabs = await cdsClinicalDataService.getLabCatalog(null, null, 50);
        const formatted = dynamicLabs.map(lab => ({
          code: lab.loinc_code,
          display: lab.display,
          unit: lab.reference_range?.unit || '',
          category: lab.category || 'laboratory',
          reference_range: lab.reference_range,
          critical_low: lab.critical_low,
          critical_high: lab.critical_high,
          source: 'dynamic'
        }));
        setLabOptions(formatted);
      } catch (error) {
        throw new Error(`Failed to load lab catalog: ${error.message}`);
      } finally {
        setSearching(false);
      }
      return;
    }

    setSearching(true);
    try {
      // Search dynamic catalog - DYNAMIC ONLY
      const dynamicLabs = await cdsClinicalDataService.getLabCatalog(query, null, 20);
      const formatted = dynamicLabs.map(lab => ({
        code: lab.loinc_code,
        display: lab.display,
        unit: lab.reference_range?.unit || '',
        category: lab.category || 'laboratory',
        reference_range: lab.reference_range,
        critical_low: lab.critical_low,
        critical_high: lab.critical_high,
        source: 'dynamic'
      }));

      setLabOptions(formatted);
    } catch (error) {
      throw new Error(`Failed to search lab tests: ${error.message}`);
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
    
    // Use dynamic reference range - DYNAMIC ONLY, NO FALLBACKS
    if (selectedLab.reference_range) {
      return {
        low: selectedLab.reference_range.min,
        high: selectedLab.reference_range.max,
        critical_low: selectedLab.critical_low,
        critical_high: selectedLab.critical_high,
        unit: selectedLab.reference_range.unit,
        source: 'dynamic'
      };
    }
    
    // No fallback - if no dynamic reference range, return null
    return null;
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
                  <Typography variant="body2">
                    {option.display}
                    {option.source === 'dynamic' && (
                      <Chip size="small" label="Real Data" color="primary" sx={{ ml: 1, height: 16 }} />
                    )}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    LOINC: {option.code} | Category: {option.category}
                    {option.unit && ` | Unit: ${option.unit}`}
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
                Normal range: {getReferenceRange().low} - {getReferenceRange().high} {getReferenceRange().unit || selectedLab.unit}
                {getReferenceRange().source === 'dynamic' && (
                  <Chip size="small" label="From Patient Data" color="primary" sx={{ ml: 1, height: 16 }} />
                )}
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