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
import { fhirClient } from '../../../../../core/fhir/services/fhirClient';

// Critical value presets based on common clinical thresholds
const CRITICAL_VALUE_PRESETS = [
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

// Operator options for value comparison
const COMPARISON_OPERATORS = [
  { value: 'gt', label: 'Greater than (>)', description: 'Values greater than threshold' },
  { value: 'ge', label: 'Greater than or equal (≥)', description: 'Values greater than or equal to threshold' },
  { value: 'lt', label: 'Less than (<)', description: 'Values less than threshold' },
  { value: 'le', label: 'Less than or equal (≤)', description: 'Values less than or equal to threshold' },
  { value: 'eq', label: 'Equal to (=)', description: 'Values equal to threshold' },
  { value: 'ne', label: 'Not equal to (≠)', description: 'Values not equal to threshold' }
];

const AdvancedLabValueFilter = ({ 
  patientId, 
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
  // const [editingFilter, setEditingFilter] = useState(null);
  
  // Custom filter state
  const [selectedTest, setSelectedTest] = useState('');
  const [operator, setOperator] = useState('gt');
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState('');
  const [rangeMin, setRangeMin] = useState('');
  const [rangeMax, setRangeMax] = useState('');
  const [useRange, setUseRange] = useState(false);

  // Load saved filters on mount
  useEffect(() => {
    const loadSavedFilters = async () => {
      try {
        const saved = localStorage.getItem('lab-value-filters');
        if (saved) {
          setSavedFilters(JSON.parse(saved));
        }
      } catch (error) {
        console.warn('Failed to load saved filters:', error);
      }
    };
    loadSavedFilters();
  }, []);

  // Apply filters function wrapped in useCallback
  const applyFiltersCallback = useCallback(async () => {
    if (!patientId || filters.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const allResults = [];
      const criticalValues = [];

      for (const filter of filters) {
        let searchParams = {
          patient: patientId,
          code: filter.testCode,
          _sort: '-date',
          _count: 100
        };

        // Build value-quantity search parameter
        if (filter.operator === 'range') {
          if (filter.rangeMin && filter.rangeMax) {
            searchParams['value-quantity'] = `ge${filter.rangeMin}|${filter.unit},le${filter.rangeMax}|${filter.unit}`;
          }
        } else {
          searchParams['value-quantity'] = `${filter.operator}${filter.value}|${filter.unit}`;
        }

        try {
          const response = await fhirClient.searchObservations(searchParams);
          const results = response.entry?.map(e => e.resource) || [];
          
          // Tag results with filter info
          const taggedResults = results.map(result => ({
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

        } catch (searchError) {
          console.warn(`Filter ${filter.id} failed:`, searchError);
        }
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
      console.error('Error applying lab value filters:', error);
      setError(`Failed to apply filters: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [filters, patientId, onFilteredResultsChange, onFilterChange, onCriticalValuesFound]);

  // Apply filters when enabled state or filters change
  useEffect(() => {
    if (isEnabled && filters.length > 0) {
      applyFiltersCallback();
    } else {
      setFilteredResults([]);
      setActiveFilters([]);
      onFilteredResultsChange([]);
      onFilterChange([]);
    }
  }, [isEnabled, filters, patientId, applyFiltersCallback, onFilteredResultsChange, onFilterChange]);

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

    const testInfo = COMMON_LAB_TESTS.find(t => t.code === selectedTest);
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
          Advanced Lab Value Filtering
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
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle1">Critical Value Presets</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Quick filters for clinically significant values that require immediate attention:
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1 }}>
            {CRITICAL_VALUE_PRESETS.filter(p => p.category === 'critical').map((preset) => (
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
            {CRITICAL_VALUE_PRESETS.filter(p => p.category === 'abnormal').map((preset) => (
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
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle1">Custom Value Filter</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Lab Test</InputLabel>
                <Select
                  value={selectedTest}
                  onChange={(e) => {
                    setSelectedTest(e.target.value);
                    const testInfo = COMMON_LAB_TESTS.find(t => t.code === e.target.value);
                    if (testInfo) {
                      setUnit(testInfo.commonUnits[0]);
                    }
                  }}
                >
                  {COMMON_LAB_TESTS.map(test => (
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
        <Accordion>
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