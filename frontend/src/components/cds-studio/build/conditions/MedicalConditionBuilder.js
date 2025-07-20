/**
 * Medical Condition Builder Component
 * Provides enhanced UI for building condition-based CDS rules
 */
import React, { useState, useEffect, useCallback } from 'react';
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
  Alert,
  Stack,
  RadioGroup,
  FormControlLabel,
  Radio,
  CircularProgress,
  InputAdornment,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Search as SearchIcon,
  LocalHospital as ConditionIcon,
  Info as InfoIcon,
  Clear as ClearIcon,
  History as HistoryIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { searchService } from '../../../../services/searchService';
import { cdsClinicalDataService } from '../../../../services/cdsClinicalDataService';
import { debounce } from 'lodash';

// Condition operators
const CONDITION_OPERATORS = [
  { value: 'has', label: 'Has condition', icon: '✓' },
  { value: 'not_has', label: 'Does not have', icon: '✗' },
  { value: 'active', label: 'Active condition', icon: '🟢' },
  { value: 'resolved', label: 'Resolved condition', icon: '🔵' },
  { value: 'inactive', label: 'Inactive condition', icon: '⚫' },
  { value: 'new_diagnosis', label: 'New diagnosis (within timeframe)', icon: '🆕' },
  { value: 'chronic', label: 'Chronic condition', icon: '♾️' },
  { value: 'acute', label: 'Acute condition', icon: '⚡' }
];

// Severity levels
const SEVERITY_LEVELS = [
  { value: 'any', label: 'Any severity' },
  { value: 'mild', label: 'Mild', color: '#4CAF50' },
  { value: 'moderate', label: 'Moderate', color: '#FF9800' },
  { value: 'severe', label: 'Severe', color: '#F44336' }
];

// Timeframes for new diagnosis
const DIAGNOSIS_TIMEFRAMES = [
  { value: 7, label: 'Last week' },
  { value: 30, label: 'Last month' },
  { value: 90, label: 'Last 3 months' },
  { value: 180, label: 'Last 6 months' },
  { value: 365, label: 'Last year' }
];

// Common condition categories
const CONDITION_CATEGORIES = [
  { id: 'cardiac', label: 'Cardiac Conditions', icon: '❤️' },
  { id: 'respiratory', label: 'Respiratory Conditions', icon: '🫁' },
  { id: 'endocrine', label: 'Endocrine/Metabolic', icon: '🔬' },
  { id: 'renal', label: 'Renal Conditions', icon: '🫘' },
  { id: 'neurological', label: 'Neurological', icon: '🧠' },
  { id: 'infectious', label: 'Infectious Diseases', icon: '🦠' },
  { id: 'mental', label: 'Mental Health', icon: '🧠' },
  { id: 'oncology', label: 'Oncology', icon: '🎗️' }
];

// No hardcoded conditions - using dynamic catalog only

const MedicalConditionBuilder = ({ condition, onChange, onRemove }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCondition, setSelectedCondition] = useState(null);
  const [showQuickSelect, setShowQuickSelect] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [commonConditions, setCommonConditions] = useState([]);
  const [loadingCommon, setLoadingCommon] = useState(false);

  // Initialize from existing condition and load common conditions
  useEffect(() => {
    if (condition.conditionCode && condition.conditionDisplay) {
      setSelectedCondition({
        code: condition.conditionCode,
        system: condition.conditionSystem || 'SNOMED',
        display: condition.conditionDisplay
      });
      setShowQuickSelect(false);
    }

    // Load common conditions from dynamic catalog
    const loadCommonConditions = async () => {
      setLoadingCommon(true);
      try {
        const dynamicConditions = await cdsClinicalDataService.getDynamicConditionCatalog(null, 20);
        const formatted = dynamicConditions.map(cond => ({
          code: cond.code,
          display: cond.display,
          system: 'SNOMED', // Most conditions are SNOMED
          category: cond.categories?.[0] || 'general',
          frequency_count: cond.frequency_count,
          source: 'dynamic'
        }));
        setCommonConditions(formatted);
      } catch (error) {
        setCommonConditions([]);
      } finally {
        setLoadingCommon(false);
      }
    };

    loadCommonConditions();
  }, [condition.conditionCode, condition.conditionDisplay, condition.conditionSystem]);

  // Debounced search function
  const searchConditions = useCallback(
    debounce(async (term) => {
      if (!term || term.length < 3) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const results = await searchService.searchConditions(term, 20);
        setSearchResults(results);
      } catch (error) {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300),
    []
  );

  // Handle search input change
  const handleSearchChange = (event, value) => {
    setSearchTerm(value);
    if (value && value.length >= 3) {
      searchConditions(value);
      setShowQuickSelect(false);
    } else {
      setSearchResults([]);
      setShowQuickSelect(true);
    }
  };

  // Handle condition selection
  const handleConditionSelect = (event, value) => {
    if (value) {
      setSelectedCondition(value);
      onChange({
        ...condition,
        conditionCode: value.code,
        conditionSystem: value.system || 'SNOMED',
        conditionDisplay: value.display
      });
    }
  };

  // Handle quick select
  const handleQuickSelect = (conditionItem) => {
    setSelectedCondition(conditionItem);
    setSearchTerm(conditionItem.display);
    onChange({
      ...condition,
      conditionCode: conditionItem.code,
      conditionSystem: conditionItem.system,
      conditionDisplay: conditionItem.display
    });
    setShowQuickSelect(false);
  };

  // Handle operator change
  const handleOperatorChange = (e) => {
    const operator = e.target.value;
    const updates = { ...condition, operator };
    
    // Reset fields based on operator
    if (!['new_diagnosis'].includes(operator)) {
      delete updates.timeframe;
    }
    
    onChange(updates);
  };

  // Get filtered common conditions from dynamic data
  const getFilteredCommonConditions = () => {
    if (selectedCategory === 'all') {
      return commonConditions;
    }
    return commonConditions.filter(c => c.category === selectedCategory);
  };

  return (
    <Box>
      <Grid container spacing={2}>
        {/* Condition Search/Selection */}
        <Grid item xs={12}>
          <Typography variant="subtitle2" gutterBottom>
            Select Medical Condition
          </Typography>
          
          {/* Search input */}
          <Autocomplete
            freeSolo
            options={searchResults}
            getOptionLabel={(option) => 
              typeof option === 'string' ? option : option.display
            }
            renderOption={(props, option) => (
              <Box component="li" {...props}>
                <Stack>
                  <Typography variant="body2">
                    {option.display}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {option.system}: {option.code}
                  </Typography>
                </Stack>
              </Box>
            )}
            value={selectedCondition}
            onInputChange={handleSearchChange}
            onChange={handleConditionSelect}
            loading={isSearching}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder="Search conditions (type at least 3 characters)..."
                InputProps={{
                  ...params.InputProps,
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <>
                      {isSearching ? <CircularProgress color="inherit" size={20} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
          />

          {/* Quick Select Categories */}
          {showQuickSelect && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary" gutterBottom>
                Or select from common conditions (from patient data):
              </Typography>
              
              {loadingCommon && (
                <Box display="flex" justifyContent="center" sx={{ my: 2 }}>
                  <CircularProgress size={20} />
                  <Typography variant="caption" sx={{ ml: 1 }}>Loading conditions...</Typography>
                </Box>
              )}

              {!loadingCommon && commonConditions.length > 0 && (
                <>
                  {/* Category filter */}
                  <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap' }}>
                    <Chip
                      label="All"
                      onClick={() => setSelectedCategory('all')}
                      color={selectedCategory === 'all' ? 'primary' : 'default'}
                      size="small"
                    />
                    {CONDITION_CATEGORIES.map(cat => (
                      <Chip
                        key={cat.id}
                        label={`${cat.icon} ${cat.label}`}
                        onClick={() => setSelectedCategory(cat.id)}
                        color={selectedCategory === cat.id ? 'primary' : 'default'}
                        size="small"
                      />
                    ))}
                  </Stack>

                  {/* Common conditions grid */}
                  <Grid container spacing={1}>
                    {getFilteredCommonConditions().map(cond => (
                      <Grid item xs={12} md={6} key={cond.code}>
                        <Chip
                          label={`${cond.display} (${cond.frequency_count || 0})`}
                          onClick={() => handleQuickSelect(cond)}
                          clickable
                          icon={<ConditionIcon />}
                          variant="outlined"
                          sx={{ width: '100%', justifyContent: 'flex-start' }}
                        />
                      </Grid>
                    ))}
                  </Grid>
                </>
              )}

              {!loadingCommon && commonConditions.length === 0 && (
                <Alert severity="info" sx={{ mt: 1 }}>
                  <Typography variant="caption">
                    No conditions available. Try using the search above to find conditions.
                  </Typography>
                </Alert>
              )}
            </Box>
          )}

          {/* Selected condition display */}
          {selectedCondition && (
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="subtitle2">Selected Condition:</Typography>
              <Typography variant="body2">{selectedCondition.display}</Typography>
              <Typography variant="caption" color="text.secondary">
                {selectedCondition.system}: {selectedCondition.code}
              </Typography>
            </Alert>
          )}
        </Grid>

        {/* Operator Selection */}
        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel>Condition Status</InputLabel>
            <Select
              value={condition.operator || 'has'}
              onChange={handleOperatorChange}
              label="Condition Status"
            >
              {CONDITION_OPERATORS.map(op => (
                <MenuItem key={op.value} value={op.value}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="body2">{op.icon}</Typography>
                    <Typography>{op.label}</Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Severity Selection */}
        {['has', 'active', 'new_diagnosis'].includes(condition.operator) && (
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Severity</InputLabel>
              <Select
                value={condition.severity || 'any'}
                onChange={(e) => onChange({ ...condition, severity: e.target.value })}
                label="Severity"
              >
                {SEVERITY_LEVELS.map(level => (
                  <MenuItem key={level.value} value={level.value}>
                    {level.color && (
                      <Box
                        component="span"
                        sx={{
                          display: 'inline-block',
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          backgroundColor: level.color,
                          mr: 1
                        }}
                      />
                    )}
                    {level.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        )}

        {/* Timeframe for new diagnosis */}
        {condition.operator === 'new_diagnosis' && (
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Diagnosed Within</InputLabel>
              <Select
                value={condition.timeframe || 90}
                onChange={(e) => onChange({ ...condition, timeframe: e.target.value })}
                label="Diagnosed Within"
              >
                {DIAGNOSIS_TIMEFRAMES.map(tf => (
                  <MenuItem key={tf.value} value={tf.value}>
                    {tf.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        )}

        {/* Additional Options */}
        <Grid item xs={12}>
          <FormControl component="fieldset">
            <Typography variant="subtitle2" gutterBottom>
              Additional Options
            </Typography>
            <FormControlLabel
              control={
                <Radio
                  checked={condition.includeRelated !== false}
                  onChange={(e) => onChange({ 
                    ...condition, 
                    includeRelated: e.target.checked 
                  })}
                />
              }
              label={
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2">
                    Include related conditions
                  </Typography>
                  <Tooltip title="Includes child concepts and related diagnoses">
                    <InfoIcon fontSize="small" color="action" />
                  </Tooltip>
                </Stack>
              }
            />
          </FormControl>
        </Grid>

        {/* Condition Examples */}
        {selectedCondition && (
          <Grid item xs={12}>
            <Alert severity="info" icon={<InfoIcon />}>
              <Typography variant="caption">
                <strong>Example matches:</strong>
                {condition.operator === 'has' && ' Patients with any record of this condition'}
                {condition.operator === 'active' && ' Patients with this as an active problem'}
                {condition.operator === 'new_diagnosis' && ` Patients diagnosed within the last ${condition.timeframe || 90} days`}
                {condition.operator === 'chronic' && ' Patients with this as a chronic condition'}
              </Typography>
            </Alert>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default MedicalConditionBuilder;