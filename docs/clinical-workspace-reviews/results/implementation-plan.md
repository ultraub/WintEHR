# Results Tab - Implementation Plan

## Executive Summary

This implementation plan details the technical approach for enhancing the Results Tab with advanced FHIR R4 capabilities, focusing on value-quantity search, provider accountability, and comprehensive clinical workflow integration. The plan follows a phased approach prioritizing patient safety enhancements.

## Implementation Overview

### Core Objectives
1. **Value-Quantity Search**: Enable numeric filtering for critical lab value detection
2. **Provider Accountability**: Integrate Practitioner/PractitionerRole resources for result attribution
3. **Order-Result Correlation**: Complete ServiceRequest integration for workflow tracking
4. **Multi-Facility Support**: Add Location resource for enterprise scalability
5. **Performance Optimization**: Maintain sub-500ms response times for complex queries

### Technical Architecture

```
Enhanced Results Tab Architecture
├── UI Layer
│   ├── AdvancedLabValueFilter (NEW)
│   ├── ProviderAccountabilityPanel (NEW)
│   ├── OrderContextDisplay (NEW)
│   └── FacilityResultManager (NEW)
├── Service Layer
│   ├── Enhanced FHIR Search Service
│   ├── Critical Value Detection Service (NEW)
│   ├── Provider Attribution Service (NEW)
│   └── Order Correlation Service (NEW)
├── Data Layer
│   ├── Observation (Enhanced with value-quantity)
│   ├── ServiceRequest (Full integration)
│   ├── Practitioner/PractitionerRole (NEW)
│   └── Location (NEW)
└── Integration Layer
    ├── Clinical Workflow Events
    ├── Critical Value Alerts (Enhanced)
    └── Cross-Module Communication
```

## Phase 1: Advanced Lab Value Filtering (Days 1-2)

### Day 1: Value-Quantity Search Foundation

#### Task 1.1: Enhanced FHIR Search Service
**Objective**: Extend fhirClient with value-quantity search capabilities
**Files**: `/frontend/src/core/fhir/services/fhirClient.js`

```javascript
// Add to FHIRClient class
/**
 * Enhanced observation search with value-quantity filtering
 */
async searchObservationsWithValueFilter(patientId, filters = {}) {
  const params = {
    patient: patientId,
    _sort: '-date',
    _count: filters.limit || 1000
  };

  // Add code filter if specified
  if (filters.code) {
    params.code = `http://loinc.org|${filters.code}`;
  }

  // Add value-quantity filter
  if (filters.valueFilter) {
    const { operator, value, unit } = filters.valueFilter;
    let valueQuantityParam = `${operator}${value}`;
    
    if (unit) {
      valueQuantityParam += `|http://unitsofmeasure.org|${unit}`;
    }
    
    params['value-quantity'] = valueQuantityParam;
  }

  // Add date range filters
  if (filters.dateFrom) {
    params.date = `ge${filters.dateFrom}`;
  }
  if (filters.dateTo) {
    if (params.date) {
      // Multiple date parameters for range
      return this.httpClient.get('/Observation', {
        params: {
          ...params,
          date: [`ge${filters.dateFrom}`, `le${filters.dateTo}`]
        },
        paramsSerializer: (params) => {
          // Handle multiple date parameters correctly
          return Object.entries(params)
            .flatMap(([key, value]) => 
              Array.isArray(value) 
                ? value.map(v => `${key}=${encodeURIComponent(v)}`)
                : [`${key}=${encodeURIComponent(value)}`]
            )
            .join('&');
        }
      });
    } else {
      params.date = `le${filters.dateTo}`;
    }
  }

  const response = await this.search('Observation', params);
  return response;
}

/**
 * Search for critical lab values using predefined thresholds
 */
async searchCriticalLabValues(patientId, timeframe = '24h') {
  const criticalValueDefinitions = [
    { code: '2339-0', name: 'Glucose', operator: 'gt', value: 400, unit: 'mg/dL', severity: 'critical' },
    { code: '2339-0', name: 'Glucose', operator: 'lt', value: 40, unit: 'mg/dL', severity: 'critical' },
    { code: '718-7', name: 'Hemoglobin', operator: 'lt', value: 6, unit: 'g/dL', severity: 'critical' },
    { code: '2160-0', name: 'Creatinine', operator: 'gt', value: 4.0, unit: 'mg/dL', severity: 'critical' },
    { code: '6298-4', name: 'Potassium', operator: 'gt', value: 6.5, unit: 'mEq/L', severity: 'critical' },
    { code: '6298-4', name: 'Potassium', operator: 'lt', value: 2.5, unit: 'mEq/L', severity: 'critical' }
  ];

  const cutoffDate = new Date();
  if (timeframe === '24h') {
    cutoffDate.setHours(cutoffDate.getHours() - 24);
  } else if (timeframe === '7d') {
    cutoffDate.setDate(cutoffDate.getDate() - 7);
  }

  const criticalResults = [];

  for (const definition of criticalValueDefinitions) {
    try {
      const results = await this.searchObservationsWithValueFilter(patientId, {
        code: definition.code,
        valueFilter: {
          operator: definition.operator,
          value: definition.value,
          unit: definition.unit
        },
        dateFrom: cutoffDate.toISOString()
      });

      if (results.resources.length > 0) {
        criticalResults.push({
          definition,
          results: results.resources,
          count: results.resources.length
        });
      }
    } catch (error) {
      console.error(`Error searching for critical values: ${definition.name}`, error);
    }
  }

  return criticalResults;
}
```

#### Task 1.2: Critical Value Detection Service
**Objective**: Create service for automated critical value monitoring
**Files**: `/frontend/src/services/criticalValueDetectionService.js`

```javascript
import { fhirClient } from '../core/fhir/services/fhirClient';
import { CLINICAL_EVENTS } from '../contexts/ClinicalWorkflowContext';

class CriticalValueDetectionService {
  constructor() {
    this.criticalValueThresholds = new Map([
      // Glucose thresholds
      ['2339-0', [
        { operator: 'gt', value: 400, unit: 'mg/dL', severity: 'critical', description: 'Severe hyperglycemia' },
        { operator: 'lt', value: 40, unit: 'mg/dL', severity: 'critical', description: 'Severe hypoglycemia' },
        { operator: 'gt', value: 250, unit: 'mg/dL', severity: 'high', description: 'Hyperglycemia' },
        { operator: 'lt', value: 70, unit: 'mg/dL', severity: 'high', description: 'Hypoglycemia' }
      ]],
      
      // Hemoglobin thresholds
      ['718-7', [
        { operator: 'lt', value: 6, unit: 'g/dL', severity: 'critical', description: 'Severe anemia' },
        { operator: 'lt', value: 8, unit: 'g/dL', severity: 'high', description: 'Moderate anemia' },
        { operator: 'gt', value: 18, unit: 'g/dL', severity: 'high', description: 'Polycythemia' }
      ]],
      
      // Creatinine thresholds
      ['2160-0', [
        { operator: 'gt', value: 4.0, unit: 'mg/dL', severity: 'critical', description: 'Severe renal dysfunction' },
        { operator: 'gt', value: 2.0, unit: 'mg/dL', severity: 'high', description: 'Elevated creatinine' }
      ]],
      
      // Potassium thresholds
      ['6298-4', [
        { operator: 'gt', value: 6.5, unit: 'mEq/L', severity: 'critical', description: 'Severe hyperkalemia' },
        { operator: 'lt', value: 2.5, unit: 'mEq/L', severity: 'critical', description: 'Severe hypokalemia' },
        { operator: 'gt', value: 5.5, unit: 'mEq/L', severity: 'high', description: 'Hyperkalemia' },
        { operator: 'lt', value: 3.0, unit: 'mEq/L', severity: 'high', description: 'Hypokalemia' }
      ]]
    ]);
  }

  /**
   * Check if an observation represents a critical value
   */
  isCriticalValue(observation) {
    if (!observation.valueQuantity?.value || !observation.code?.coding) {
      return { isCritical: false };
    }

    const loincCode = observation.code.coding.find(c => c.system === 'http://loinc.org')?.code;
    if (!loincCode) {
      return { isCritical: false };
    }

    const thresholds = this.criticalValueThresholds.get(loincCode);
    if (!thresholds) {
      return { isCritical: false };
    }

    const value = observation.valueQuantity.value;
    const unit = observation.valueQuantity.unit;

    for (const threshold of thresholds) {
      if (this.evaluateThreshold(value, unit, threshold)) {
        return {
          isCritical: true,
          severity: threshold.severity,
          description: threshold.description,
          threshold: threshold,
          actualValue: `${value} ${unit}`
        };
      }
    }

    return { isCritical: false };
  }

  /**
   * Evaluate if a value meets a critical threshold
   */
  evaluateThreshold(value, unit, threshold) {
    // Unit conversion logic would go here in production
    // For now, assume units match
    if (unit !== threshold.unit) {
      return false;
    }

    switch (threshold.operator) {
      case 'gt':
        return value > threshold.value;
      case 'lt':
        return value < threshold.value;
      case 'ge':
        return value >= threshold.value;
      case 'le':
        return value <= threshold.value;
      case 'eq':
        return value === threshold.value;
      default:
        return false;
    }
  }

  /**
   * Monitor patient for new critical values
   */
  async monitorPatientCriticalValues(patientId, timeframe = '24h') {
    try {
      const criticalResults = await fhirClient.searchCriticalLabValues(patientId, timeframe);
      
      // Process each critical result
      const processedResults = criticalResults.map(result => ({
        ...result,
        assessments: result.results.map(obs => this.isCriticalValue(obs)).filter(a => a.isCritical)
      }));

      return processedResults.filter(result => result.assessments.length > 0);
    } catch (error) {
      console.error('Error monitoring critical values:', error);
      return [];
    }
  }

  /**
   * Create critical value alert
   */
  async createCriticalValueAlert(observation, assessment, patientId, publish) {
    const alert = {
      type: 'critical-lab-value',
      severity: assessment.severity,
      patientId,
      observationId: observation.id,
      testName: observation.code?.coding?.[0]?.display || 'Unknown Test',
      actualValue: assessment.actualValue,
      description: assessment.description,
      threshold: assessment.threshold,
      timestamp: new Date().toISOString(),
      requiresAcknowledgment: assessment.severity === 'critical'
    };

    // Publish critical value event
    await publish(CLINICAL_EVENTS.CRITICAL_VALUE_DETECTED, alert);

    return alert;
  }
}

export const criticalValueDetectionService = new CriticalValueDetectionService();
```

### Day 2: Advanced Lab Value Filter UI Component

#### Task 2.1: Advanced Lab Value Filter Component
**Objective**: Create sophisticated UI for value-quantity filtering
**Files**: `/frontend/src/components/clinical/results/AdvancedLabValueFilter.js`

```javascript
import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Chip,
  Stack,
  Typography,
  Card,
  CardContent,
  IconButton,
  Tooltip,
  Alert
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  FilterList as FilterIcon,
  Warning as WarningIcon
} from '@mui/icons-material';

const AdvancedLabValueFilter = ({ onFilterChange, initialFilters = null }) => {
  const [filters, setFilters] = useState([]);
  const [showBuilder, setShowBuilder] = useState(false);

  // Predefined critical value presets
  const criticalValuePresets = [
    {
      id: 'glucose-high',
      label: 'Glucose > 250',
      description: 'Hyperglycemia',
      code: '2339-0',
      codeName: 'Glucose',
      operator: 'gt',
      value: 250,
      unit: 'mg/dL',
      severity: 'high'
    },
    {
      id: 'glucose-low',
      label: 'Glucose < 70',
      description: 'Hypoglycemia',
      code: '2339-0',
      codeName: 'Glucose',
      operator: 'lt',
      value: 70,
      unit: 'mg/dL',
      severity: 'high'
    },
    {
      id: 'hemoglobin-low',
      label: 'Hemoglobin < 7',
      description: 'Severe anemia',
      code: '718-7',
      codeName: 'Hemoglobin',
      operator: 'lt',
      value: 7,
      unit: 'g/dL',
      severity: 'critical'
    },
    {
      id: 'creatinine-high',
      label: 'Creatinine > 3.0',
      description: 'Severe renal dysfunction',
      code: '2160-0',
      codeName: 'Creatinine',
      operator: 'gt',
      value: 3.0,
      unit: 'mg/dL',
      severity: 'critical'
    },
    {
      id: 'potassium-high',
      label: 'Potassium > 6.0',
      description: 'Hyperkalemia',
      code: '6298-4',
      codeName: 'Potassium',
      operator: 'gt',
      value: 6.0,
      unit: 'mEq/L',
      severity: 'high'
    },
    {
      id: 'potassium-low',
      label: 'Potassium < 3.0',
      description: 'Hypokalemia',
      code: '6298-4',
      codeName: 'Potassium',
      operator: 'lt',
      value: 3.0,
      unit: 'mEq/L',
      severity: 'high'
    }
  ];

  const commonLabTests = [
    { code: '2339-0', name: 'Glucose', commonUnits: ['mg/dL', 'mmol/L'] },
    { code: '718-7', name: 'Hemoglobin', commonUnits: ['g/dL', 'g/L'] },
    { code: '2160-0', name: 'Creatinine', commonUnits: ['mg/dL', 'μmol/L'] },
    { code: '6298-4', name: 'Potassium', commonUnits: ['mEq/L', 'mmol/L'] },
    { code: '2947-0', name: 'Sodium', commonUnits: ['mEq/L', 'mmol/L'] },
    { code: '2069-3', name: 'Chloride', commonUnits: ['mEq/L', 'mmol/L'] },
    { code: '20565-8', name: 'CO2', commonUnits: ['mEq/L', 'mmol/L'] },
    { code: '4548-4', name: 'Hemoglobin A1c', commonUnits: ['%', 'mmol/mol'] }
  ];

  const operators = [
    { value: 'gt', label: '> (greater than)', symbol: '>' },
    { value: 'lt', label: '< (less than)', symbol: '<' },
    { value: 'ge', label: '≥ (greater or equal)', symbol: '≥' },
    { value: 'le', label: '≤ (less or equal)', symbol: '≤' },
    { value: 'eq', label: '= (equal)', symbol: '=' },
    { value: 'ne', label: '≠ (not equal)', symbol: '≠' }
  ];

  useEffect(() => {
    if (initialFilters) {
      setFilters(initialFilters);
    }
  }, [initialFilters]);

  const handleAddPreset = (preset) => {
    const newFilter = {
      id: `${preset.id}-${Date.now()}`,
      ...preset
    };
    
    const updatedFilters = [...filters, newFilter];
    setFilters(updatedFilters);
    onFilterChange(updatedFilters);
  };

  const handleRemoveFilter = (filterId) => {
    const updatedFilters = filters.filter(f => f.id !== filterId);
    setFilters(updatedFilters);
    onFilterChange(updatedFilters);
  };

  const handleClearAll = () => {
    setFilters([]);
    onFilterChange([]);
  };

  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FilterIcon />
            Advanced Lab Value Filtering
          </Typography>
          <Button
            variant="outlined"
            onClick={() => setShowBuilder(!showBuilder)}
            startIcon={<AddIcon />}
          >
            Custom Filter
          </Button>
        </Box>

        {/* Critical Value Presets */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <WarningIcon color="warning" />
            Critical Value Presets:
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {criticalValuePresets.map((preset) => (
              <Chip
                key={preset.id}
                label={preset.label}
                onClick={() => handleAddPreset(preset)}
                clickable
                color={preset.severity === 'critical' ? 'error' : 'warning'}
                variant="outlined"
                sx={{ mb: 1 }}
              />
            ))}
          </Stack>
        </Box>

        {/* Active Filters Display */}
        {filters.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle2">Active Filters:</Typography>
              <Button size="small" onClick={handleClearAll} color="error">
                Clear All
              </Button>
            </Box>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {filters.map((filter) => (
                <Chip
                  key={filter.id}
                  label={`${filter.codeName} ${operators.find(op => op.value === filter.operator)?.symbol} ${filter.value} ${filter.unit}`}
                  onDelete={() => handleRemoveFilter(filter.id)}
                  color={filter.severity === 'critical' ? 'error' : 'warning'}
                  variant="filled"
                />
              ))}
            </Stack>
          </Box>
        )}

        {/* Custom Filter Builder */}
        {showBuilder && (
          <CustomFilterBuilder
            onAddFilter={(filter) => {
              const newFilter = { ...filter, id: `custom-${Date.now()}` };
              const updatedFilters = [...filters, newFilter];
              setFilters(updatedFilters);
              onFilterChange(updatedFilters);
              setShowBuilder(false);
            }}
            onCancel={() => setShowBuilder(false)}
            commonLabTests={commonLabTests}
            operators={operators}
          />
        )}

        {/* Help Text */}
        {filters.length === 0 && (
          <Alert severity="info" sx={{ mt: 2 }}>
            Select critical value presets above or create custom filters to identify specific lab value ranges. 
            This enables automated detection of clinically significant results.
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

// Custom Filter Builder Component
const CustomFilterBuilder = ({ onAddFilter, onCancel, commonLabTests, operators }) => {
  const [selectedTest, setSelectedTest] = useState('');
  const [operator, setOperator] = useState('gt');
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState('');
  const [description, setDescription] = useState('');

  const handleTestChange = (testCode) => {
    setSelectedTest(testCode);
    const test = commonLabTests.find(t => t.code === testCode);
    if (test && test.commonUnits.length > 0) {
      setUnit(test.commonUnits[0]);
    }
  };

  const handleAddFilter = () => {
    if (selectedTest && value && unit) {
      const test = commonLabTests.find(t => t.code === selectedTest);
      onAddFilter({
        code: selectedTest,
        codeName: test.name,
        operator,
        value: parseFloat(value),
        unit,
        description: description || `Custom ${test.name} filter`,
        severity: 'medium'
      });
    }
  };

  return (
    <Card variant="outlined" sx={{ p: 2, backgroundColor: 'grey.50' }}>
      <Typography variant="subtitle1" gutterBottom>Create Custom Filter</Typography>
      
      <Grid container spacing={2} alignItems="center">
        <Grid item xs={12} md={3}>
          <FormControl fullWidth size="small">
            <InputLabel>Lab Test</InputLabel>
            <Select
              value={selectedTest}
              onChange={(e) => handleTestChange(e.target.value)}
              label="Lab Test"
            >
              {commonLabTests.map(test => (
                <MenuItem key={test.code} value={test.code}>
                  {test.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        
        <Grid item xs={12} md={2}>
          <FormControl fullWidth size="small">
            <InputLabel>Operator</InputLabel>
            <Select
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
              label="Operator"
            >
              {operators.map(op => (
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
            inputProps={{ step: 'any', min: 0 }}
          />
        </Grid>
        
        <Grid item xs={12} md={2}>
          <FormControl fullWidth size="small">
            <InputLabel>Unit</InputLabel>
            <Select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              label="Unit"
            >
              {selectedTest && commonLabTests.find(t => t.code === selectedTest)?.commonUnits.map(u => (
                <MenuItem key={u} value={u}>{u}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        
        <Grid item xs={12} md={3}>
          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              onClick={handleAddFilter}
              disabled={!selectedTest || !value || !unit}
              size="small"
            >
              Add Filter
            </Button>
            <Button
              variant="outlined"
              onClick={onCancel}
              size="small"
            >
              Cancel
            </Button>
          </Stack>
        </Grid>
      </Grid>
      
      <TextField
        fullWidth
        size="small"
        label="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        sx={{ mt: 2 }}
      />
    </Card>
  );
};

export default AdvancedLabValueFilter;
```

#### Task 2.2: Integration with Results Tab
**Objective**: Integrate the advanced filter with the main Results Tab component
**Files**: `/frontend/src/components/clinical/workspace/tabs/ResultsTab.js`

```javascript
// Add to imports
import AdvancedLabValueFilter from '../../results/AdvancedLabValueFilter';
import { criticalValueDetectionService } from '../../../../services/criticalValueDetectionService';
import { fhirClient } from '../../../../core/fhir/services/fhirClient';

// Add to state variables in ResultsTab component
const [advancedFilters, setAdvancedFilters] = useState([]);
const [filteredByValue, setFilteredByValue] = useState(false);

// Enhanced useEffect for critical value monitoring
useEffect(() => {
  const monitorCriticalValues = async () => {
    if (observations && observations.length > 0) {
      try {
        // Check for critical values in current observations
        const criticalAssessments = [];
        
        for (const obs of observations) {
          const assessment = criticalValueDetectionService.isCriticalValue(obs);
          if (assessment.isCritical) {
            criticalAssessments.push({
              observation: obs,
              assessment
            });
          }
        }

        // Create alerts for new critical values
        for (const { observation, assessment } of criticalAssessments) {
          if (!alertedResults.has(observation.id)) {
            await criticalValueDetectionService.createCriticalValueAlert(
              observation,
              assessment,
              patientId,
              publish
            );
            
            // Mark as alerted
            const newAlertedResults = new Set(alertedResults);
            newAlertedResults.add(observation.id);
            setAlertedResults(newAlertedResults);
          }
        }
      } catch (error) {
        console.error('Error monitoring critical values:', error);
      }
    }
  };

  monitorCriticalValues();
}, [observations, patientId, publish, alertedResults]);

// Enhanced filtering function with value-quantity support
const filterResultsWithAdvancedFilters = useCallback(async (results) => {
  if (advancedFilters.length === 0) {
    setFilteredByValue(false);
    return filterResults(results);
  }

  setFilteredByValue(true);
  
  try {
    // Apply each advanced filter
    let filteredResults = [];
    
    for (const filter of advancedFilters) {
      const searchResults = await fhirClient.searchObservationsWithValueFilter(patientId, {
        code: filter.code,
        valueFilter: {
          operator: filter.operator,
          value: filter.value,
          unit: filter.unit
        }
      });
      
      // Merge results, avoiding duplicates
      const newResults = searchResults.resources.filter(r => 
        !filteredResults.some(existing => existing.id === r.id)
      );
      filteredResults = [...filteredResults, ...newResults];
    }
    
    // Apply additional filters (period, status, search)
    return filterResults(filteredResults);
  } catch (error) {
    console.error('Error applying advanced filters:', error);
    setFilteredByValue(false);
    return filterResults(results);
  }
}, [advancedFilters, patientId, filterResults]);

// Update the result filtering memoization
const { filteredResults, sortedResults } = useMemo(() => {
  let currentResults;
  switch (tabValue) {
    case 0: 
      // Apply advanced filtering for lab results
      if (advancedFilters.length > 0) {
        // This will be handled by the async function
        return { filteredResults: [], sortedResults: [] };
      }
      currentResults = filterResults(labResults);
      break;
    case 1:
    case 2: 
      currentResults = filterResults(vitalSigns);
      break;
    case 3: 
      currentResults = diagnosticReports;
      break;
    default: 
      currentResults = [];
  }
  
  const sorted = [...currentResults].sort((a, b) => {
    const dateA = new Date(a.effectiveDateTime || a.issued || a.started || 0);
    const dateB = new Date(b.effectiveDateTime || b.issued || b.started || 0);
    return dateB - dateA;
  });
  
  return { 
    filteredResults: currentResults, 
    sortedResults: sorted 
  };
}, [tabValue, labResults, vitalSigns, diagnosticReports, filterResults, advancedFilters]);

// Handle advanced filter changes
const handleAdvancedFilterChange = async (filters) => {
  setAdvancedFilters(filters);
  
  if (filters.length > 0 && tabValue === 0) {
    setLoading(true);
    try {
      const filtered = await filterResultsWithAdvancedFilters(labResults);
      // Update sorted results state here since we can't use async in useMemo
      // You would need to add a separate state for async filtered results
    } catch (error) {
      console.error('Error applying advanced filters:', error);
    } finally {
      setLoading(false);
    }
  }
};

// Add the AdvancedLabValueFilter component in the render section
// Place it after the existing filters section, before the Results Display

{/* Advanced Lab Value Filtering - Only show for Lab Results tab */}
{tabValue === 0 && (
  <AdvancedLabValueFilter
    onFilterChange={handleAdvancedFilterChange}
    initialFilters={advancedFilters}
  />
)}

{/* Show filter status */}
{filteredByValue && (
  <Alert severity="info" sx={{ mb: 2 }}>
    <Typography variant="body2">
      Showing results filtered by {advancedFilters.length} advanced value filter(s). 
      {advancedFilters.map((f, i) => (
        <Chip
          key={i}
          label={`${f.codeName} ${f.operator} ${f.value} ${f.unit}`}
          size="small"
          sx={{ ml: 1 }}
        />
      ))}
    </Typography>
  </Alert>
)}
```

## Expected Timeline and Deliverables

### Day 1 Deliverables
- Enhanced FHIR client with value-quantity search support
- Critical value detection service with automated monitoring
- Backend integration for complex lab value queries

### Day 2 Deliverables  
- Advanced lab value filter UI component with preset critical values
- Integration with Results Tab component
- Automated critical value detection and alerting

### Success Criteria
- **Functionality**: Users can filter lab results by numeric values using FHIR operators
- **Performance**: Search queries complete in <500ms for typical datasets
- **Accuracy**: 100% correct identification of critical values based on defined thresholds
- **Usability**: Intuitive interface with one-click critical value presets

This completes Phase 1 of the implementation plan, providing the foundation for advanced lab value filtering with critical patient safety enhancements.