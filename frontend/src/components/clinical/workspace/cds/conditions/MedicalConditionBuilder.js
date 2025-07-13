/**
 * Medical Condition Builder Component
 * Provides enhanced UI for building medical condition-based CDS conditions
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
  Chip,
  Alert
} from '@mui/material';
import {
  Info as InfoIcon
} from '@mui/icons-material';
import { cdsClinicalDataService } from '../../../../../services/cdsClinicalDataService';

// Common condition categories
const CONDITION_CATEGORIES = [
  'cardiovascular',
  'endocrine',
  'respiratory',
  'infectious',
  'neurological',
  'gastrointestinal',
  'musculoskeletal',
  'psychiatric',
  'dermatologic',
  'hematologic',
  'oncologic',
  'general'
];

// Status options
const CONDITION_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'provisional', label: 'Provisional' },
  { value: 'differential', label: 'Differential' }
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

const MedicalConditionBuilder = ({ condition, onChange, onRemove }) => {
  const [selectedCondition, setSelectedCondition] = useState(null);
  const [conditionSearchInput, setConditionSearchInput] = useState('');
  const [conditionOptions, setConditionOptions] = useState([]);
  const [searching, setSearching] = useState(false);

  // Initialize from existing condition
  useEffect(() => {
    if (condition.conditionCode) {
      const cond = conditionOptions.find(c => c.code === condition.conditionCode);
      if (cond) {
        setSelectedCondition(cond);
      }
    }
  }, [condition.conditionCode, conditionOptions]);

  // Search for conditions using dynamic catalog
  const searchConditions = async (query) => {
    if (!query || query.length < 2) {
      // Load dynamic condition catalog without search filter
      setSearching(true);
      try {
        const dynamicConditions = await cdsClinicalDataService.getDynamicConditionCatalog(null, 20);
        const formatted = dynamicConditions.map(cond => ({
          code: cond.code,
          display: cond.display,
          category: cond.categories?.[0] || 'general',
          frequency_count: cond.frequency_count,
          source: 'dynamic'
        }));
        setConditionOptions(formatted);
      } catch (error) {
        setConditionOptions([]);
      } finally {
        setSearching(false);
      }
      return;
    }

    setSearching(true);
    try {
      // Search dynamic catalog
      const dynamicConditions = await cdsClinicalDataService.getDynamicConditionCatalog(query, 10);
      const formatted = dynamicConditions.map(cond => ({
        code: cond.code,
        display: cond.display,
        category: cond.categories?.[0] || 'general',
        frequency_count: cond.frequency_count,
        source: 'dynamic'
      }));

      setConditionOptions(formatted);
    } catch (error) {
      setConditionOptions([]);
    } finally {
      setSearching(false);
    }
  };

  const handleConditionChange = (event, newValue) => {
    setSelectedCondition(newValue);
    if (newValue) {
      onChange({
        ...condition,
        conditionCode: newValue.code,
        conditionDisplay: newValue.display,
        category: newValue.category
      });
    }
  };

  const handleStatusChange = (e) => {
    onChange({
      ...condition,
      status: e.target.value
    });
  };

  const handleTimeframeChange = (e) => {
    onChange({
      ...condition,
      timeframe: e.target.value
    });
  };

  return (
    <Box>
      <Grid container spacing={2} alignItems="flex-start">
        {/* Condition Selection */}
        <Grid item xs={12}>
          <Autocomplete
            value={selectedCondition}
            onChange={handleConditionChange}
            inputValue={conditionSearchInput}
            onInputChange={(event, newInputValue) => {
              setConditionSearchInput(newInputValue);
              searchConditions(newInputValue);
            }}
            options={conditionOptions}
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
                    Code: {option.code} | Category: {option.category}
                    {option.frequency_count && ` | Used ${option.frequency_count} times`}
                  </Typography>
                </Box>
              </Box>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Medical Condition"
                placeholder="Search by condition name or code"
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

        {/* Show condition info if available */}
        {selectedCondition && (
          <Grid item xs={12}>
            <Alert severity="info" icon={<InfoIcon />}>
              <Typography variant="caption">
                Condition: {selectedCondition.display} | Category: {selectedCondition.category}
                {selectedCondition.frequency_count && (
                  <> | Found in {selectedCondition.frequency_count} patient records</>
                )}
                {selectedCondition.source === 'dynamic' && (
                  <Chip size="small" label="From Patient Data" color="primary" sx={{ ml: 1, height: 16 }} />
                )}
              </Typography>
            </Alert>
          </Grid>
        )}

        {/* Status Selection */}
        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel>Condition Status</InputLabel>
            <Select
              value={condition.status || 'active'}
              onChange={handleStatusChange}
              label="Condition Status"
            >
              {CONDITION_STATUSES.map(status => (
                <MenuItem key={status.value} value={status.value}>
                  {status.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Timeframe Selection */}
        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel>Timeframe</InputLabel>
            <Select
              value={condition.timeframe || 365}
              onChange={handleTimeframeChange}
              label="Timeframe"
            >
              {TIMEFRAMES.map(tf => (
                <MenuItem key={tf.value} value={tf.value}>
                  {tf.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
      </Grid>
    </Box>
  );
};

export default MedicalConditionBuilder;