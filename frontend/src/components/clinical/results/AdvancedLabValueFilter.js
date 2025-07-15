/**
 * Advanced Lab Value Filter Component
 * 
 * Provides sophisticated UI for FHIR R4 value-quantity filtering
 * with preset critical values and custom filter builder.
 */

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
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  Badge
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  FilterList as FilterIcon,
  Warning as WarningIcon,
  ExpandMore as ExpandMoreIcon,
  Clear as ClearIcon,
  Science as ScienceIcon,
  TrendingUp as TrendingUpIcon
} from '@mui/icons-material';
import { criticalValueDetectionService } from '../../../services/criticalValueDetectionService';

const AdvancedLabValueFilter = ({ onFilterChange, initialFilters = null, patientId = null }) => {
  const [filters, setFilters] = useState([]);
  const [showBuilder, setShowBuilder] = useState(false);
  const [criticalValuePresets, setCriticalValuePresets] = useState([]);
  const [expandedSections, setExpandedSections] = useState({
    presets: true,
    custom: false,
    active: true
  });

  useEffect(() => {
    // Load critical value presets from service
    const presets = criticalValueDetectionService.getCriticalValueFilters();
    setCriticalValuePresets(presets);
  }, []);

  useEffect(() => {
    if (initialFilters) {
      setFilters(initialFilters);
    }
  }, [initialFilters]);

  const commonLabTests = [
    { code: '2339-0', name: 'Glucose', commonUnits: ['mg/dL', 'mmol/L'], normalRange: '70-100 mg/dL' },
    { code: '718-7', name: 'Hemoglobin', commonUnits: ['g/dL', 'g/L'], normalRange: '12-16 g/dL' },
    { code: '2160-0', name: 'Creatinine', commonUnits: ['mg/dL', 'μmol/L'], normalRange: '0.6-1.2 mg/dL' },
    { code: '6298-4', name: 'Potassium', commonUnits: ['mEq/L', 'mmol/L'], normalRange: '3.5-5.0 mEq/L' },
    { code: '2947-0', name: 'Sodium', commonUnits: ['mEq/L', 'mmol/L'], normalRange: '136-145 mEq/L' },
    { code: '2069-3', name: 'Chloride', commonUnits: ['mEq/L', 'mmol/L'], normalRange: '98-107 mEq/L' },
    { code: '20565-8', name: 'CO2', commonUnits: ['mEq/L', 'mmol/L'], normalRange: '22-29 mEq/L' },
    { code: '4548-4', name: 'Hemoglobin A1c', commonUnits: ['%', 'mmol/mol'], normalRange: '<5.7%' },
    { code: '6598-7', name: 'Troponin', commonUnits: ['ng/mL', 'μg/L'], normalRange: '<0.01 ng/mL' },
    { code: '6690-2', name: 'WBC Count', commonUnits: ['10*3/uL', 'K/uL'], normalRange: '4.0-11.0 K/uL' },
    { code: '777-3', name: 'Platelet Count', commonUnits: ['10*3/uL', 'K/uL'], normalRange: '150-450 K/uL' }
  ];

  const operators = [
    { value: 'gt', label: '> (greater than)', symbol: '>', description: 'Find values greater than specified threshold' },
    { value: 'lt', label: '< (less than)', symbol: '<', description: 'Find values less than specified threshold' },
    { value: 'ge', label: '≥ (greater or equal)', symbol: '≥', description: 'Find values greater than or equal to threshold' },
    { value: 'le', label: '≤ (less or equal)', symbol: '≤', description: 'Find values less than or equal to threshold' },
    { value: 'eq', label: '= (equal)', symbol: '=', description: 'Find values exactly equal to threshold' },
    { value: 'ne', label: '≠ (not equal)', symbol: '≠', description: 'Find values not equal to threshold' }
  ];

  const handleAddPreset = (preset) => {
    const newFilter = {
      id: `${preset.id}-${Date.now()}`,
      ...preset,
      type: 'preset'
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

  const handleToggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const getFilterStats = () => {
    const stats = {
      total: filters.length,
      critical: filters.filter(f => f.severity === 'critical').length,
      high: filters.filter(f => f.severity === 'high').length,
      preset: filters.filter(f => f.type === 'preset').length,
      custom: filters.filter(f => f.type === 'custom').length
    };
    return stats;
  };

  const groupedPresets = criticalValuePresets.reduce((acc, preset) => {
    const testName = preset.codeName;
    if (!acc[testName]) {
      acc[testName] = [];
    }
    acc[testName].push(preset);
    return acc;
  }, {});

  const stats = getFilterStats();

  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ScienceIcon color="primary" />
            Advanced Lab Value Filtering
            {stats.total > 0 && (
              <Badge badgeContent={stats.total} color="primary" sx={{ ml: 1 }}>
                <FilterIcon />
              </Badge>
            )}
          </Typography>
          <Stack direction="row" spacing={1}>
            <Tooltip title="Create custom filter">
              <Button
                variant={showBuilder ? "contained" : "outlined"}
                onClick={() => setShowBuilder(!showBuilder)}
                startIcon={<AddIcon />}
                size="small"
              >
                Custom Filter
              </Button>
            </Tooltip>
            {filters.length > 0 && (
              <Tooltip title="Clear all filters">
                <Button
                  variant="outlined"
                  onClick={handleClearAll}
                  startIcon={<ClearIcon />}
                  color="error"
                  size="small"
                >
                  Clear All
                </Button>
              </Tooltip>
            )}
          </Stack>
        </Box>

        {/* Filter Statistics */}
        {stats.total > 0 && (
          <Alert severity="info" sx={{ mb: 2 }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Typography variant="body2">
                Active filters: {stats.total} total
              </Typography>
              {stats.critical > 0 && (
                <Chip 
                  label={`${stats.critical} critical`} 
                  color="error" 
                  size="small" 
                />
              )}
              {stats.high > 0 && (
                <Chip 
                  label={`${stats.high} high priority`} 
                  color="warning" 
                  size="small" 
                />
              )}
            </Stack>
          </Alert>
        )}

        {/* Critical Value Presets */}
        <Accordion 
          expanded={expandedSections.presets} 
          onChange={() => handleToggleSection('presets')}
          sx={{ mb: 2 }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <WarningIcon color="warning" />
              Critical Value Presets ({criticalValuePresets.length} available)
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Quick filters for clinically significant abnormal values that require immediate attention
            </Typography>
            
            {Object.entries(groupedPresets).map(([testName, presets]) => (
              <Box key={testName} sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
                  {testName}
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {presets.map((preset) => (
                    <Tooltip 
                      key={preset.id} 
                      title={`${preset.description} - Priority: ${preset.priority}`}
                    >
                      <Chip
                        label={preset.label}
                        onClick={() => handleAddPreset(preset)}
                        clickable
                        color={preset.severity === 'critical' ? 'error' : 'warning'}
                        variant="outlined"
                        sx={{ mb: 1 }}
                        icon={preset.severity === 'critical' ? <WarningIcon /> : <TrendingUpIcon />}
                      />
                    </Tooltip>
                  ))}
                </Stack>
              </Box>
            ))}
          </AccordionDetails>
        </Accordion>

        {/* Active Filters Display */}
        {filters.length > 0 && (
          <Accordion 
            expanded={expandedSections.active} 
            onChange={() => handleToggleSection('active')}
            sx={{ mb: 2 }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle1">
                Active Filters ({filters.length})
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={1}>
                {filters.map((filter) => (
                  <Box 
                    key={filter.id} 
                    sx={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      p: 1,
                      border: '1px solid',
                      borderColor: filter.severity === 'critical' ? 'error.main' : 'warning.main',
                      borderRadius: 1,
                      backgroundColor: filter.severity === 'critical' ? 'error.light' : 'warning.light',
                      opacity: 0.1
                    }}
                  >
                    <Box>
                      <Typography variant="body2" fontWeight="bold">
                        {filter.codeName} {operators.find(op => op.value === filter.operator)?.symbol} {filter.value} {filter.unit}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {filter.description} • {filter.type === 'preset' ? 'Preset' : 'Custom'} • Priority: {filter.priority}
                      </Typography>
                    </Box>
                    <IconButton 
                      onClick={() => handleRemoveFilter(filter.id)} 
                      color="error"
                      size="small"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                ))}
              </Stack>
            </AccordionDetails>
          </Accordion>
        )}

        {/* Custom Filter Builder */}
        {showBuilder && (
          <Accordion 
            expanded={expandedSections.custom} 
            onChange={() => handleToggleSection('custom')}
            sx={{ mb: 2 }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle1">Custom Filter Builder</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <CustomFilterBuilder
                onAddFilter={(filter) => {
                  const newFilter = { ...filter, id: `custom-${Date.now()}`, type: 'custom' };
                  const updatedFilters = [...filters, newFilter];
                  setFilters(updatedFilters);
                  onFilterChange(updatedFilters);
                  setShowBuilder(false);
                  setExpandedSections(prev => ({ ...prev, custom: false, active: true }));
                }}
                onCancel={() => setShowBuilder(false)}
                commonLabTests={commonLabTests}
                operators={operators}
              />
            </AccordionDetails>
          </Accordion>
        )}

        {/* Help Text */}
        {filters.length === 0 && (
          <Alert severity="info" icon={<ScienceIcon />}>
            <Typography variant="body2">
              <strong>Get Started:</strong> Select critical value presets above for immediate patient safety alerts, 
              or create custom filters to identify specific lab value ranges. This enables automated detection 
              of clinically significant results using FHIR R4 value-quantity search capabilities.
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Example: Filter for glucose > 250 mg/dL to identify severe hyperglycemia requiring immediate intervention
            </Typography>
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
  const [severity, setSeverity] = useState('medium');
  const [priority, setPriority] = useState('routine');

  const selectedTestInfo = commonLabTests.find(t => t.code === selectedTest);
  const selectedOperatorInfo = operators.find(op => op.value === operator);

  const handleTestChange = (testCode) => {
    setSelectedTest(testCode);
    const test = commonLabTests.find(t => t.code === testCode);
    if (test && test.commonUnits.length > 0) {
      setUnit(test.commonUnits[0]);
    }
    
    // Auto-generate description
    if (test && value && operator) {
      const operatorSymbol = operators.find(op => op.value === operator)?.symbol;
      setDescription(`Custom ${test.name} filter: ${operatorSymbol} ${value}`);
    }
  };

  const handleOperatorChange = (newOperator) => {
    setOperator(newOperator);
    
    // Update description
    if (selectedTestInfo && value) {
      const operatorSymbol = operators.find(op => op.value === newOperator)?.symbol;
      setDescription(`Custom ${selectedTestInfo.name} filter: ${operatorSymbol} ${value}`);
    }
  };

  const handleValueChange = (newValue) => {
    setValue(newValue);
    
    // Update description
    if (selectedTestInfo && operator) {
      const operatorSymbol = operators.find(op => op.value === operator)?.symbol;
      setDescription(`Custom ${selectedTestInfo.name} filter: ${operatorSymbol} ${newValue}`);
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
        severity,
        priority,
        label: `${test.name} ${operators.find(op => op.value === operator)?.symbol} ${value} ${unit}`
      });
      
      // Reset form
      setSelectedTest('');
      setValue('');
      setDescription('');
      setSeverity('medium');
      setPriority('routine');
    }
  };

  const isValid = selectedTest && value && unit && parseFloat(value) > 0;

  return (
    <Card variant="outlined" sx={{ p: 2, backgroundColor: 'grey.50' }}>
      <Typography variant="subtitle1" gutterBottom>Create Custom Filter</Typography>
      
      <Grid container spacing={2}>
        {/* Test Selection */}
        <Grid item xs={12} md={4}>
          <FormControl fullWidth size="small">
            <InputLabel>Lab Test</InputLabel>
            <Select
              value={selectedTest}
              onChange={(e) => handleTestChange(e.target.value)}
              label="Lab Test"
            >
              {commonLabTests.map(test => (
                <MenuItem key={test.code} value={test.code}>
                  <Box>
                    <Typography variant="body2">{test.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Normal: {test.normalRange}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {selectedTestInfo && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              Normal range: {selectedTestInfo.normalRange}
            </Typography>
          )}
        </Grid>
        
        {/* Operator Selection */}
        <Grid item xs={12} md={2}>
          <FormControl fullWidth size="small">
            <InputLabel>Operator</InputLabel>
            <Select
              value={operator}
              onChange={(e) => handleOperatorChange(e.target.value)}
              label="Operator"
            >
              {operators.map(op => (
                <MenuItem key={op.value} value={op.value}>
                  <Tooltip title={op.description}>
                    <span>{op.label}</span>
                  </Tooltip>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {selectedOperatorInfo && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              {selectedOperatorInfo.description}
            </Typography>
          )}
        </Grid>
        
        {/* Value Input */}
        <Grid item xs={12} md={2}>
          <TextField
            fullWidth
            size="small"
            label="Value"
            type="number"
            value={value}
            onChange={(e) => handleValueChange(e.target.value)}
            inputProps={{ step: 'any', min: 0 }}
            error={value !== '' && (parseFloat(value) <= 0 || isNaN(parseFloat(value)))}
            helperText={value !== '' && (parseFloat(value) <= 0 || isNaN(parseFloat(value))) ? 'Enter valid number > 0' : ''}
          />
        </Grid>
        
        {/* Unit Selection */}
        <Grid item xs={12} md={2}>
          <FormControl fullWidth size="small">
            <InputLabel>Unit</InputLabel>
            <Select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              label="Unit"
              disabled={!selectedTest}
            >
              {selectedTest && commonLabTests.find(t => t.code === selectedTest)?.commonUnits.map(u => (
                <MenuItem key={u} value={u}>{u}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        
        {/* Severity and Priority */}
        <Grid item xs={12} md={1}>
          <FormControl fullWidth size="small">
            <InputLabel>Severity</InputLabel>
            <Select
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              label="Severity"
            >
              <MenuItem value="critical">Critical</MenuItem>
              <MenuItem value="high">High</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="low">Low</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        
        <Grid item xs={12} md={1}>
          <FormControl fullWidth size="small">
            <InputLabel>Priority</InputLabel>
            <Select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              label="Priority"
            >
              <MenuItem value="immediate">Immediate</MenuItem>
              <MenuItem value="urgent">Urgent</MenuItem>
              <MenuItem value="routine">Routine</MenuItem>
            </Select>
          </FormControl>
        </Grid>
      </Grid>
      
      {/* Description */}
      <TextField
        fullWidth
        size="small"
        label="Description (auto-generated)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        sx={{ mt: 2 }}
        multiline
        rows={2}
      />
      
      {/* Actions */}
      <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
        <Button
          variant="contained"
          onClick={handleAddFilter}
          disabled={!isValid}
          startIcon={<AddIcon />}
        >
          Add Filter
        </Button>
        <Button
          variant="outlined"
          onClick={onCancel}
        >
          Cancel
        </Button>
      </Stack>
    </Card>
  );
};

export default AdvancedLabValueFilter;