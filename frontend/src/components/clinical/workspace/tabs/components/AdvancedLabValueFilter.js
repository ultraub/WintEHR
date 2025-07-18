/**
 * Advanced Lab Value Filter Component
 * 
 * Provides quantitative filtering capabilities for laboratory results using FHIR R4 value-quantity search parameters.
 * Enables critical value detection and automated filtering for patient safety.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Chip,
  Stack,
  Switch,
  FormControlLabel,
  Divider,
  Alert,
  Tooltip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Badge,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  InputAdornment
} from '@mui/material';
import {
  FilterList as FilterIcon,
  Clear as ClearIcon,
  Science as LabIcon,
  Warning as WarningIcon,
  ExpandMore as ExpandMoreIcon,
  Save as SaveIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';

// Critical value presets for laboratory tests
const LAB_VALUE_PRESETS = [
  { 
    id: 'glucose_high', 
    label: 'Glucose > 250', 
    code: '2339-0', 
    system: 'http://loinc.org',
    operator: 'gt', 
    value: 250, 
    unit: 'mg/dL',
    category: 'critical',
    description: 'Critical high glucose level'
  },
  { 
    id: 'glucose_low', 
    label: 'Glucose < 70', 
    code: '2339-0', 
    system: 'http://loinc.org',
    operator: 'lt', 
    value: 70, 
    unit: 'mg/dL',
    category: 'critical',
    description: 'Critical low glucose level'
  },
  { 
    id: 'hemoglobin_low', 
    label: 'Hemoglobin < 7', 
    code: '718-7', 
    system: 'http://loinc.org',
    operator: 'lt', 
    value: 7, 
    unit: 'g/dL',
    category: 'critical',
    description: 'Critical low hemoglobin'
  },
  { 
    id: 'creatinine_high', 
    label: 'Creatinine > 3.0', 
    code: '2160-0', 
    system: 'http://loinc.org',
    operator: 'gt', 
    value: 3.0, 
    unit: 'mg/dL',
    category: 'critical',
    description: 'Critical high creatinine'
  },
  { 
    id: 'potassium_high', 
    label: 'Potassium > 6.0', 
    code: '6298-4', 
    system: 'http://loinc.org',
    operator: 'gt', 
    value: 6.0, 
    unit: 'mEq/L',
    category: 'critical',
    description: 'Critical high potassium'
  },
  { 
    id: 'sodium_low', 
    label: 'Sodium < 130', 
    code: '2947-0', 
    system: 'http://loinc.org',
    operator: 'lt', 
    value: 130, 
    unit: 'mEq/L',
    category: 'critical',
    description: 'Critical low sodium'
  },
  { 
    id: 'wbc_high', 
    label: 'WBC > 15', 
    code: '6690-2', 
    system: 'http://loinc.org',
    operator: 'gt', 
    value: 15, 
    unit: 'K/uL',
    category: 'abnormal',
    description: 'High white blood cell count'
  },
  { 
    id: 'wbc_low', 
    label: 'WBC < 4', 
    code: '6690-2', 
    system: 'http://loinc.org',
    operator: 'lt', 
    value: 4, 
    unit: 'K/uL',
    category: 'abnormal',
    description: 'Low white blood cell count'
  },
  { 
    id: 'platelets_low', 
    label: 'Platelets < 100', 
    code: '777-3', 
    system: 'http://loinc.org',
    operator: 'lt', 
    value: 100, 
    unit: 'K/uL',
    category: 'abnormal',
    description: 'Low platelet count'
  },
  { 
    id: 'inr_high', 
    label: 'INR > 4.0', 
    code: '34714-6', 
    system: 'http://loinc.org',
    operator: 'gt', 
    value: 4.0, 
    unit: '{ratio}',
    category: 'critical',
    description: 'Critical high INR'
  }
];

// Vital signs presets for common abnormal values
const VITAL_SIGNS_PRESETS = [
  {
    id: 'bp_high_systolic',
    label: 'Systolic BP > 180',
    code: '8480-6', // Systolic blood pressure
    system: 'http://loinc.org',
    operator: 'gt',
    value: 180,
    unit: 'mmHg',
    category: 'critical',
    description: 'Critical high systolic blood pressure'
  },
  {
    id: 'bp_low_systolic',
    label: 'Systolic BP < 90',
    code: '8480-6',
    system: 'http://loinc.org',
    operator: 'lt',
    value: 90,
    unit: 'mmHg',
    category: 'critical',
    description: 'Critical low systolic blood pressure'
  },
  {
    id: 'bp_high_diastolic',
    label: 'Diastolic BP > 110',
    code: '8462-4', // Diastolic blood pressure
    system: 'http://loinc.org',
    operator: 'gt',
    value: 110,
    unit: 'mmHg',
    category: 'critical',
    description: 'Critical high diastolic blood pressure'
  },
  {
    id: 'heart_rate_high',
    label: 'Heart Rate > 120',
    code: '8867-4', // Heart rate
    system: 'http://loinc.org',
    operator: 'gt',
    value: 120,
    unit: 'bpm',
    category: 'abnormal',
    description: 'High heart rate (tachycardia)'
  },
  {
    id: 'heart_rate_low',
    label: 'Heart Rate < 50',
    code: '8867-4',
    system: 'http://loinc.org',
    operator: 'lt',
    value: 50,
    unit: 'bpm',
    category: 'abnormal',
    description: 'Low heart rate (bradycardia)'
  },
  {
    id: 'temp_high',
    label: 'Temperature > 101°F',
    code: '8310-5', // Body temperature
    system: 'http://loinc.org',
    operator: 'gt',
    value: 101,
    unit: '[degF]',
    category: 'abnormal',
    description: 'High body temperature (fever)'
  },
  {
    id: 'temp_low',
    label: 'Temperature < 95°F',
    code: '8310-5',
    system: 'http://loinc.org',
    operator: 'lt',
    value: 95,
    unit: '[degF]',
    category: 'critical',
    description: 'Low body temperature (hypothermia)'
  },
  {
    id: 'resp_rate_high',
    label: 'Respiratory Rate > 24',
    code: '9279-1', // Respiratory rate
    system: 'http://loinc.org',
    operator: 'gt',
    value: 24,
    unit: '/min',
    category: 'abnormal',
    description: 'High respiratory rate'
  },
  {
    id: 'oxygen_sat_low',
    label: 'O2 Saturation < 90%',
    code: '2708-6', // Oxygen saturation
    system: 'http://loinc.org',
    operator: 'lt',
    value: 90,
    unit: '%',
    category: 'critical',
    description: 'Low oxygen saturation'
  }
];

// Common lab test options for custom filtering
const COMMON_LAB_TESTS = [
  { code: '2339-0', display: 'Glucose', system: 'http://loinc.org', commonUnits: ['mg/dL', 'mmol/L'] },
  { code: '718-7', display: 'Hemoglobin', system: 'http://loinc.org', commonUnits: ['g/dL', 'g/L'] },
  { code: '2160-0', display: 'Creatinine', system: 'http://loinc.org', commonUnits: ['mg/dL', 'umol/L'] },
  { code: '6298-4', display: 'Potassium', system: 'http://loinc.org', commonUnits: ['mEq/L', 'mmol/L'] },
  { code: '2947-0', display: 'Sodium', system: 'http://loinc.org', commonUnits: ['mEq/L', 'mmol/L'] },
  { code: '6690-2', display: 'WBC', system: 'http://loinc.org', commonUnits: ['K/uL', '10*9/L'] },
  { code: '777-3', display: 'Platelets', system: 'http://loinc.org', commonUnits: ['K/uL', '10*9/L'] },
  { code: '34714-6', display: 'INR', system: 'http://loinc.org', commonUnits: ['{ratio}'] },
  { code: '2571-8', display: 'Triglycerides', system: 'http://loinc.org', commonUnits: ['mg/dL', 'mmol/L'] },
  { code: '2093-3', display: 'Cholesterol', system: 'http://loinc.org', commonUnits: ['mg/dL', 'mmol/L'] }
];

// Common vital signs options for custom filtering
const COMMON_VITAL_SIGNS = [
  { code: '8480-6', display: 'Systolic Blood Pressure', system: 'http://loinc.org', commonUnits: ['mmHg'] },
  { code: '8462-4', display: 'Diastolic Blood Pressure', system: 'http://loinc.org', commonUnits: ['mmHg'] },
  { code: '8867-4', display: 'Heart Rate', system: 'http://loinc.org', commonUnits: ['bpm', '/min'] },
  { code: '8310-5', display: 'Body Temperature', system: 'http://loinc.org', commonUnits: ['[degF]', 'Cel'] },
  { code: '9279-1', display: 'Respiratory Rate', system: 'http://loinc.org', commonUnits: ['/min'] },
  { code: '2708-6', display: 'Oxygen Saturation', system: 'http://loinc.org', commonUnits: ['%'] },
  { code: '29463-7', display: 'Body Weight', system: 'http://loinc.org', commonUnits: ['kg', 'lb'] },
  { code: '8302-2', display: 'Body Height', system: 'http://loinc.org', commonUnits: ['cm', 'in'] },
  { code: '39156-5', display: 'Body Mass Index', system: 'http://loinc.org', commonUnits: ['kg/m2'] }
];

// Operator options for value comparison
const COMPARISON_OPERATORS = [
  { value: 'gt', label: 'Greater than (>)', description: 'Values greater than threshold' },
  { value: 'ge', label: 'Greater than or equal (≥)', description: 'Values greater than or equal to threshold' },
  { value: 'lt', label: 'Less than (<)', description: 'Values less than threshold' },
  { value: 'le', label: 'Less than or equal (≤)', description: 'Values less than or equal to threshold' },
  { value: 'eq', label: 'Equal to (=)', description: 'Values equal to threshold' },
  { value: 'ne', label: 'Not equal to (≠)', description: 'Values not equal to threshold' }
];

// Helper functions to get appropriate data based on tab
const getPresetsForTab = (tabIndex) => {
  switch (tabIndex) {
    case 0: return LAB_VALUE_PRESETS; // Lab Results
    case 1: return VITAL_SIGNS_PRESETS; // Vital Signs
    default: return [];
  }
};

const getTestOptionsForTab = (tabIndex) => {
  switch (tabIndex) {
    case 0: return COMMON_LAB_TESTS; // Lab Results
    case 1: return COMMON_VITAL_SIGNS; // Vital Signs
    default: return [];
  }
};

const getFilterTitleForTab = (tabIndex) => {
  switch (tabIndex) {
    case 0: return 'Advanced Lab Value Filtering';
    case 1: return 'Advanced Vital Signs Filtering';
    default: return 'Advanced Filtering';
  }
};

const AdvancedLabValueFilter = ({ 
  patientId, 
  observations = [], // Receive observations from parent instead of fetching
  currentTab = 0, // Know which tab we're filtering for
  onFilterChange, 
  onFilteredResultsChange, 
  onCriticalValuesFound,
  initialFilters = [],
  isVisible = true 
}) => {
  const [filters, setFilters] = useState(initialFilters);
  const [isEnabled, setIsEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filteredResults, setFilteredResults] = useState([]);
  const [activeFilters, setActiveFilters] = useState([]);
  const [savedFilters, setSavedFilters] = useState([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [filterName, setFilterName] = useState('');
  
  // Custom filter state
  const [selectedTest, setSelectedTest] = useState('');
  const [operator, setOperator] = useState('gt');
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState('');
  const [rangeMin, setRangeMin] = useState('');
  const [rangeMax, setRangeMax] = useState('');
  const [useRange, setUseRange] = useState(false);

  // Get tab-specific data
  const currentPresets = getPresetsForTab(currentTab);
  const currentTestOptions = getTestOptionsForTab(currentTab);
  const filterTitle = getFilterTitleForTab(currentTab);

  // Load saved filters on mount
  useEffect(() => {
    const loadSavedFilters = async () => {
      try {
        const saved = localStorage.getItem('lab-value-filters');
        if (saved) {
          setSavedFilters(JSON.parse(saved));
        }
      } catch (error) {
        // Failed to load saved filters - will use defaults
      }
    };
    loadSavedFilters();
  }, []);

  // Client-side filtering function
  const applyFiltersCallback = useCallback(() => {
    if (filters.length === 0 || observations.length === 0) {
      setFilteredResults([]);
      setActiveFilters([]);
      onFilteredResultsChange([]);
      onFilterChange([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const allResults = [];
      const criticalValues = [];

      // Filter observations client-side based on active filters
      for (const filter of filters) {
        const matchingObservations = observations.filter(obs => {
          // Match by LOINC code
          const obsCode = obs.code?.coding?.find(c => c.system === 'http://loinc.org')?.code;
          if (obsCode !== filter.testCode) return false;

          // Check if observation has a value (either direct or in components for BP)
          let obsValue, obsUnit;
          
          if (obs.valueQuantity?.value) {
            obsValue = obs.valueQuantity.value;
            obsUnit = obs.valueQuantity.unit;
          } else if (obs.component && obs.component.length > 0) {
            // Handle blood pressure components
            const targetComponent = obs.component.find(c => 
              c.code?.coding?.some(coding => coding.code === filter.testCode)
            );
            if (targetComponent?.valueQuantity?.value) {
              obsValue = targetComponent.valueQuantity.value;
              obsUnit = targetComponent.valueQuantity.unit;
            } else {
              return false;
            }
          } else {
            return false;
          }

          // Unit validation (basic check)
          if (filter.unit && obsUnit && obsUnit !== filter.unit) {
            // Allow common unit variations
            const unitMatch = (
              (filter.unit === 'mg/dL' && ['mg/dl', 'mg/dL'].includes(obsUnit)) ||
              (filter.unit === 'mEq/L' && ['mEq/L', 'mmol/L'].includes(obsUnit)) ||
              (filter.unit === obsUnit)
            );
            if (!unitMatch) return false;
          }

          // Apply filter logic
          if (filter.operator === 'range') {
            return obsValue >= filter.rangeMin && obsValue <= filter.rangeMax;
          } else {
            switch (filter.operator) {
              case 'gt': return obsValue > filter.value;
              case 'ge': return obsValue >= filter.value;
              case 'lt': return obsValue < filter.value;
              case 'le': return obsValue <= filter.value;
              case 'eq': return obsValue === filter.value;
              case 'ne': return obsValue !== filter.value;
              default: return false;
            }
          }
        });

        // Tag results with filter info
        const taggedResults = matchingObservations.map(result => ({
          ...result,
          _filterInfo: {
            filterId: filter.id,
            filterType: filter.type,
            filterDescription: filter.description,
            category: filter.category
          }
        }));

        allResults.push(...taggedResults);

        // Check for critical values
        const critical = taggedResults.filter(r => filter.category === 'critical');
        criticalValues.push(...critical);
      }

      // Remove duplicates and sort by date
      const uniqueResults = Array.from(
        new Map(allResults.map(r => [r.id, r])).values()
      ).sort((a, b) => new Date(b.effectiveDateTime || b.issued) - new Date(a.effectiveDateTime || a.issued));

      setFilteredResults(uniqueResults);
      setActiveFilters([...filters]);
      
      // Notify parent components
      onFilteredResultsChange(uniqueResults);
      onFilterChange(filters);
      
      if (criticalValues.length > 0) {
        onCriticalValuesFound(criticalValues);
      }

    } catch (error) {
      // Error applying lab value filters - displaying user error
      setError(`Failed to apply filters: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [filters, observations, onFilteredResultsChange, onFilterChange, onCriticalValuesFound]);

  // Apply filters when enabled state, filters, or observations change
  useEffect(() => {
    if (isEnabled && filters.length > 0) {
      applyFiltersCallback();
    } else {
      setFilteredResults([]);
      setActiveFilters([]);
      onFilteredResultsChange([]);
      onFilterChange([]);
    }
  }, [isEnabled, filters, observations, applyFiltersCallback, onFilteredResultsChange, onFilterChange]);

  // Apply preset filter
  const applyPreset = (preset) => {
    const newFilter = {
      id: `preset_${preset.id}_${Date.now()}`,
      type: 'preset',
      testCode: preset.code,
      testSystem: preset.system,
      testDisplay: preset.label,
      operator: preset.operator,
      value: preset.value,
      unit: preset.unit,
      category: preset.category,
      description: preset.description
    };
    
    setFilters([...filters, newFilter]);
    setIsEnabled(true);
  };

  // Add custom filter
  const addCustomFilter = () => {
    if (!selectedTest || !value || !operator) {
      setError('Please fill in all required fields');
      return;
    }

    const testInfo = currentTestOptions.find(t => t.code === selectedTest);
    if (!testInfo) {
      setError('Invalid test selection');
      return;
    }

    const newFilter = {
      id: `custom_${Date.now()}`,
      type: 'custom',
      testCode: selectedTest,
      testSystem: testInfo.system,
      testDisplay: testInfo.display,
      operator: useRange ? 'range' : operator,
      value: useRange ? null : parseFloat(value),
      rangeMin: useRange ? parseFloat(rangeMin) : null,
      rangeMax: useRange ? parseFloat(rangeMax) : null,
      unit: unit || testInfo.commonUnits[0],
      category: 'custom',
      description: `Custom ${testInfo.display} filter`
    };

    setFilters([...filters, newFilter]);
    setIsEnabled(true);
    
    // Clear form
    setSelectedTest('');
    setValue('');
    setUnit('');
    setRangeMin('');
    setRangeMax('');
    setUseRange(false);
    setError(null);
  };

  // Remove filter
  const removeFilter = (filterId) => {
    setFilters(filters.filter(f => f.id !== filterId));
  };

  // Clear all filters
  const clearAllFilters = () => {
    setFilters([]);
    setIsEnabled(false);
    setError(null);
  };


  // Save filter preset
  const saveFilterPreset = () => {
    if (!filterName.trim()) {
      setError('Please enter a filter name');
      return;
    }

    const preset = {
      id: `saved_${Date.now()}`,
      name: filterName,
      filters: [...filters],
      created: new Date().toISOString()
    };

    const updated = [...savedFilters, preset];
    setSavedFilters(updated);
    localStorage.setItem('lab-value-filters', JSON.stringify(updated));
    
    setShowSaveDialog(false);
    setFilterName('');
  };

  // Load saved filter preset
  const loadFilterPreset = (preset) => {
    setFilters(preset.filters);
    setIsEnabled(true);
  };

  // Delete saved filter preset
  const deleteFilterPreset = (presetId) => {
    const updated = savedFilters.filter(f => f.id !== presetId);
    setSavedFilters(updated);
    localStorage.setItem('lab-value-filters', JSON.stringify(updated));
  };

  if (!isVisible) return null;

  return (
    <Paper sx={{ p: 2, mb: 3, border: '1px solid #e0e0e0' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FilterIcon />
          {filterTitle}
          {isEnabled && (
            <Badge badgeContent={activeFilters.length} color="primary">
              <Chip label="Active" color="success" size="small" />
            </Badge>
          )}
        </Typography>
        
        <Stack direction="row" spacing={1}>
          <FormControlLabel
            control={
              <Switch
                checked={isEnabled}
                onChange={(e) => setIsEnabled(e.target.checked)}
                disabled={filters.length === 0}
              />
            }
            label="Enable Filtering"
          />
          
          {filters.length > 0 && (
            <Button
              size="small"
              onClick={() => setShowSaveDialog(true)}
              startIcon={<SaveIcon />}
            >
              Save Preset
            </Button>
          )}
          
          <Button
            size="small"
            onClick={clearAllFilters}
            startIcon={<ClearIcon />}
            disabled={filters.length === 0}
          >
            Clear All
          </Button>
        </Stack>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Critical Value Presets */}
      <Accordion defaultExpanded={false}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle1">
            {currentTab === 0 ? 'Critical Lab Value Presets' : 'Critical Vital Sign Presets'}
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Quick filters for clinically significant values that require immediate attention:
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1 }}>
            {currentPresets.filter(p => p.category === 'critical').map((preset) => (
              <Tooltip key={preset.id} title={preset.description}>
                <Chip
                  label={preset.label}
                  onClick={() => applyPreset(preset)}
                  clickable
                  color="error"
                  variant="outlined"
                  icon={<WarningIcon />}
                />
              </Tooltip>
            ))}
          </Stack>
          
          <Divider sx={{ my: 2 }} />
          
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Common abnormal value filters:
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1 }}>
            {currentPresets.filter(p => p.category === 'abnormal').map((preset) => (
              <Tooltip key={preset.id} title={preset.description}>
                <Chip
                  label={preset.label}
                  onClick={() => applyPreset(preset)}
                  clickable
                  color="warning"
                  variant="outlined"
                  icon={<LabIcon />}
                />
              </Tooltip>
            ))}
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* Custom Filter Builder */}
      <Accordion defaultExpanded={false}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle1">
            {currentTab === 0 ? 'Custom Lab Value Filter' : 'Custom Vital Sign Filter'}
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>{currentTab === 0 ? 'Lab Test' : 'Vital Sign'}</InputLabel>
                <Select
                  value={selectedTest}
                  onChange={(e) => {
                    setSelectedTest(e.target.value);
                    const testInfo = currentTestOptions.find(t => t.code === e.target.value);
                    if (testInfo) {
                      setUnit(testInfo.commonUnits[0]);
                    }
                  }}
                >
                  {currentTestOptions.map(test => (
                    <MenuItem key={test.code} value={test.code}>
                      {test.display}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={2}>
              <FormControlLabel
                control={
                  <Switch
                    checked={useRange}
                    onChange={(e) => setUseRange(e.target.checked)}
                  />
                }
                label="Range"
              />
            </Grid>
            
            {!useRange ? (
              <>
                <Grid item xs={12} md={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Operator</InputLabel>
                    <Select value={operator} onChange={(e) => setOperator(e.target.value)}>
                      {COMPARISON_OPERATORS.map(op => (
                        <MenuItem key={op.value} value={op.value}>
                          {op.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12} md={2}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Value"
                    type="number"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">{unit}</InputAdornment>
                    }}
                  />
                </Grid>
              </>
            ) : (
              <>
                <Grid item xs={12} md={2}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Min Value"
                    type="number"
                    value={rangeMin}
                    onChange={(e) => setRangeMin(e.target.value)}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">{unit}</InputAdornment>
                    }}
                  />
                </Grid>
                
                <Grid item xs={12} md={2}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Max Value"
                    type="number"
                    value={rangeMax}
                    onChange={(e) => setRangeMax(e.target.value)}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">{unit}</InputAdornment>
                    }}
                  />
                </Grid>
              </>
            )}
            
            <Grid item xs={12} md={1}>
              <Button
                fullWidth
                variant="contained"
                onClick={addCustomFilter}
                disabled={!selectedTest || (!useRange && !value) || (useRange && (!rangeMin || !rangeMax))}
              >
                Add
              </Button>
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Active Filters */}
      {filters.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Active Filters ({filters.length})
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1 }}>
            {filters.map((filter) => (
              <Chip
                key={filter.id}
                label={filter.testDisplay + ' ' + (
                  filter.operator === 'range' 
                    ? `${filter.rangeMin}-${filter.rangeMax} ${filter.unit}`
                    : `${filter.operator} ${filter.value} ${filter.unit}`
                )}
                onDelete={() => removeFilter(filter.id)}
                color={filter.category === 'critical' ? 'error' : 'primary'}
                variant="filled"
              />
            ))}
          </Stack>
        </Box>
      )}

      {/* Results Summary */}
      {isEnabled && (
        <Box sx={{ mt: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {loading ? (
              'Applying filters...'
            ) : (
              `Found ${filteredResults.length} results matching your filters`
            )}
            {filteredResults.length > 0 && (
              <span>
                {' • '}
                {filteredResults.filter(r => r._filterInfo?.category === 'critical').length} critical values
              </span>
            )}
          </Typography>
        </Box>
      )}

      {/* Save Filter Dialog */}
      <Dialog open={showSaveDialog} onClose={() => setShowSaveDialog(false)}>
        <DialogTitle>Save Filter Preset</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Filter Name"
            value={filterName}
            onChange={(e) => setFilterName(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSaveDialog(false)}>Cancel</Button>
          <Button onClick={saveFilterPreset} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>

      {/* Saved Filters */}
      {savedFilters.length > 0 && (
        <Accordion defaultExpanded={false}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1">Saved Filter Presets</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <List dense>
              {savedFilters.map((preset) => (
                <ListItem key={preset.id}>
                  <ListItemIcon>
                    <SaveIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary={preset.name}
                    secondary={`${preset.filters.length} filters • Created ${new Date(preset.created).toLocaleDateString()}`}
                  />
                  <Button
                    size="small"
                    onClick={() => loadFilterPreset(preset)}
                    sx={{ mr: 1 }}
                  >
                    Load
                  </Button>
                  <IconButton
                    size="small"
                    onClick={() => deleteFilterPreset(preset.id)}
                    color="error"
                  >
                    <DeleteIcon />
                  </IconButton>
                </ListItem>
              ))}
            </List>
          </AccordionDetails>
        </Accordion>
      )}
    </Paper>
  );
};

export default AdvancedLabValueFilter;