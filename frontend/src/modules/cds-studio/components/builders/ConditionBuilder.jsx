/**
 * Visual Condition Builder Component
 *
 * Provides drag-and-drop interface for building clinical logic conditions.
 * Supports nested conditions, logical operators (AND, OR, NOT), and
 * catalog integration for clinical data selection.
 */

import React, { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Select,
  MenuItem,
  TextField,
  FormControl,
  InputLabel,
  Chip,
  Stack,
  Autocomplete,
  Tooltip,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  DragIndicator as DragIcon,
  ExpandMore as ExpandIcon,
  Functions as FunctionIcon,
  AccountTree as TreeIcon
} from '@mui/icons-material';

import {
  DATA_SOURCES,
  CONDITION_OPERATORS,
  LOGICAL_OPERATORS,
  getOperatorsForDataType,
  getRecommendedDataSources
} from '../../types/serviceTypes';

import catalogIntegrationService from '../../../../services/CatalogIntegrationService';

const catalogService = catalogIntegrationService;

/**
 * Generate plain English description of condition
 */
const getConditionPreview = (condition, availableDataSources) => {
  if (!condition.dataSource || !condition.operator) {
    return 'Configure data source and operator';
  }

  const dataSource = availableDataSources.find(ds => ds.id === condition.dataSource);
  const dataSourceLabel = dataSource?.label || condition.dataSource;

  const operatorMap = {
    equals: 'equals',
    notEquals: 'does not equal',
    contains: 'contains',
    notContains: 'does not contain',
    greaterThan: 'is greater than',
    lessThan: 'is less than',
    greaterThanOrEqual: 'is at least',
    lessThanOrEqual: 'is at most',
    exists: 'exists',
    notExists: 'does not exist',
    in: 'is one of',
    notIn: 'is not one of',
    withinDays: 'within last',
    olderThanDays: 'older than'
  };

  const operatorText = operatorMap[condition.operator] || condition.operator;

  // Format value display
  let valueText = '';
  if (condition.operator === 'exists' || condition.operator === 'notExists') {
    // No value needed
  } else if (condition.catalogSelection) {
    valueText = condition.catalogSelection.display || condition.catalogSelection.name;
  } else if (condition.value) {
    if (Array.isArray(condition.value)) {
      valueText = condition.value.join(', ');
    } else {
      valueText = condition.value;
    }
    // Add units for days
    if (condition.operator === 'withinDays' || condition.operator === 'olderThanDays') {
      valueText += ' days';
    }
  } else {
    valueText = '[value needed]';
  }

  return `${dataSourceLabel} ${operatorText}${valueText ? ' ' + valueText : ''}`;
};

/**
 * Single condition block
 */
const ConditionBlock = ({
  condition,
  index,
  onUpdate,
  onDelete,
  availableDataSources,
  level = 0,
  operatorColor = '#2196F3',
  showPreview = false
}) => {
  const [catalogOptions, setCatalogOptions] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [catalogSearchTerm, setCatalogSearchTerm] = useState('');

  // Get available operators for selected data source
  const selectedDataSource = availableDataSources.find(
    ds => ds.id === condition.dataSource
  );
  const dataType = selectedDataSource?.dataType || 'string';
  const availableOperators = getOperatorsForDataType(dataType);

  // Load catalog data with optional search term
  const loadCatalogData = useCallback(async (dataSource, searchTerm = '') => {
    const catalogType = DATA_SOURCES[dataSource]?.catalogType;
    if (!catalogType) return;

    setLoadingCatalog(true);
    try {
      let options = [];
      const limit = searchTerm ? 50 : 20; // Load fewer initially, more when searching

      switch (catalogType) {
        case 'medications':
          options = await catalogService.getMedications(searchTerm, limit);
          break;
        case 'conditions':
          options = await catalogService.getConditions(searchTerm, null, limit);
          break;
        case 'labs':
          options = await catalogService.getLabTests(searchTerm, null, limit);
          break;
        case 'vitals':
          options = await catalogService.getVitalSigns();
          break;
        case 'allergies':
          // Allergies can use medications catalog
          options = await catalogService.getMedications(searchTerm, limit);
          break;
        default:
          options = [];
      }
      setCatalogOptions(options);
    } catch (error) {
      console.error('Error loading catalog:', error);
      setCatalogOptions([]);
    } finally {
      setLoadingCatalog(false);
    }
  }, []);

  // Debounced search handler
  const handleCatalogSearch = React.useMemo(
    () => {
      let timeoutId;
      return (searchValue) => {
        setCatalogSearchTerm(searchValue);
        clearTimeout(timeoutId);

        // Only search if 2+ characters or empty (for initial load)
        if (searchValue.length >= 2 || searchValue.length === 0) {
          timeoutId = setTimeout(() => {
            loadCatalogData(condition.dataSource, searchValue);
          }, 300); // 300ms debounce
        }
      };
    },
    [condition.dataSource, loadCatalogData]
  );

  // Handle data source change
  const handleDataSourceChange = (dataSourceId) => {
    onUpdate(index, {
      ...condition,
      dataSource: dataSourceId,
      operator: '',
      value: '',
      catalogSelection: null
    });

    // Reset search and load initial catalog data
    setCatalogSearchTerm('');
    loadCatalogData(dataSourceId, '');
  };

  // Handle catalog selection
  const handleCatalogSelection = (selection) => {
    onUpdate(index, {
      ...condition,
      catalogSelection: selection,
      value: selection?.code || selection?.id || ''
    });
  };

  // Render value input based on data type and catalog
  const renderValueInput = () => {
    const catalogType = selectedDataSource?.catalogType;

    // Catalog-based selection with incremental search
    if (catalogType) {
      return (
        <Autocomplete
          options={catalogOptions}
          loading={loadingCatalog}
          freeSolo
          value={condition.catalogSelection}
          inputValue={catalogSearchTerm}
          onInputChange={(event, newInputValue) => {
            if (event) {
              handleCatalogSearch(newInputValue);
            }
          }}
          onChange={(event, newValue) => {
            // Handle both object selection and freetext entry
            if (typeof newValue === 'string') {
              // Freetext entry
              onUpdate(index, {
                ...condition,
                value: newValue,
                catalogSelection: null
              });
            } else {
              // Catalog selection
              handleCatalogSelection(newValue);
            }
          }}
          getOptionLabel={(option) => {
            if (typeof option === 'string') return option;
            return option.display || option.name || '';
          }}
          groupBy={(option) => {
            if (typeof option === 'string') return null;
            return option.category || 'Other';
          }}
          renderOption={(props, option) => {
            if (typeof option === 'string') return null;

            return (
              <Box component="li" {...props}>
                <Box sx={{ width: '100%' }}>
                  <Typography variant="body2">
                    {option.display || option.name}
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    {option.code && (
                      <Typography variant="caption" color="text.secondary">
                        {option.code}
                      </Typography>
                    )}
                    {option.usage_count > 0 && (
                      <Chip
                        label={`${option.usage_count} uses`}
                        size="small"
                        variant="outlined"
                        sx={{ height: 18, fontSize: '0.7rem' }}
                      />
                    )}
                  </Stack>
                </Box>
              </Box>
            );
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Search catalog or enter code"
              size="small"
              fullWidth
              placeholder={catalogOptions.length > 0 ? "Type to search..." : "Search for items..."}
              helperText={
                catalogSearchTerm.length > 0 && catalogSearchTerm.length < 2
                  ? "Type at least 2 characters to search"
                  : catalogOptions.length > 0
                  ? `${catalogOptions.length} items found`
                  : "No items found"
              }
            />
          )}
          noOptionsText={
            catalogSearchTerm.length < 2
              ? "Type at least 2 characters to search"
              : loadingCatalog
              ? "Searching..."
              : "No results found - try different search terms"
          }
          sx={{ minWidth: 300 }}
        />
      );
    }

    // Number input
    if (dataType === 'number' || dataType === 'age') {
      return (
        <TextField
          type="number"
          label="Value"
          size="small"
          value={condition.value || ''}
          onChange={(e) => onUpdate(index, { ...condition, value: e.target.value })}
          sx={{ minWidth: 150 }}
        />
      );
    }

    // Date input
    if (dataType === 'date') {
      return (
        <TextField
          type={condition.operator === 'withinDays' || condition.operator === 'olderThanDays' ? 'number' : 'date'}
          label={condition.operator === 'withinDays' || condition.operator === 'olderThanDays' ? 'Days' : 'Date'}
          size="small"
          value={condition.value || ''}
          onChange={(e) => onUpdate(index, { ...condition, value: e.target.value })}
          sx={{ minWidth: 150 }}
        />
      );
    }

    // Code/Select input
    if (dataType === 'code') {
      // If IN or NOT_IN operator, allow multiple values
      if (condition.operator === 'in' || condition.operator === 'notIn') {
        return (
          <Autocomplete
            multiple
            freeSolo
            options={[]}
            value={Array.isArray(condition.value) ? condition.value : (condition.value ? [condition.value] : [])}
            onChange={(event, newValue) => onUpdate(index, { ...condition, value: newValue })}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Values (comma-separated)"
                size="small"
              />
            )}
            sx={{ minWidth: 250 }}
          />
        );
      }
    }

    // Default text input
    return (
      <TextField
        label="Value"
        size="small"
        value={condition.value || ''}
        onChange={(e) => onUpdate(index, { ...condition, value: e.target.value })}
        sx={{ minWidth: 200 }}
      />
    );
  };

  // Generate preview text
  const previewText = React.useMemo(
    () => getConditionPreview(condition, availableDataSources),
    [condition, availableDataSources]
  );

  // Validation state
  const [validationErrors, setValidationErrors] = React.useState([]);

  // Validate condition in real-time
  React.useEffect(() => {
    const errors = [];

    if (!condition.dataSource) {
      errors.push('Select a data source');
    }

    if (condition.dataSource && !condition.operator) {
      errors.push('Select an operator');
    }

    if (condition.operator &&
        condition.operator !== 'exists' &&
        condition.operator !== 'notExists' &&
        !condition.value &&
        !condition.catalogSelection) {
      errors.push('Enter a value or select from catalog');
    }

    // Check for catalog but no selection
    const ds = availableDataSources.find(d => d.id === condition.dataSource);
    if (ds?.catalogType && !condition.catalogSelection && !condition.value) {
      errors.push('Search and select an item from the catalog');
    }

    setValidationErrors(errors);
  }, [condition, availableDataSources]);

  // Check if condition is complete
  const isComplete = validationErrors.length === 0 && condition.dataSource;

  return (
    <Paper
      elevation={1}
      sx={{
        p: 2,
        ml: level * 4,
        mb: 1,
        border: '2px solid',
        borderColor: isComplete ? operatorColor : 'divider',
        borderLeft: `6px solid ${operatorColor}`,
        backgroundColor: level > 0 ? 'grey.50' : 'background.paper',
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          boxShadow: 2,
          backgroundColor: isComplete ? `${operatorColor}10` : 'grey.100'
        }
      }}
    >
      {/* Plain English Preview */}
      {showPreview && (
        <Alert
          severity={isComplete ? 'info' : 'warning'}
          icon={false}
          sx={{
            mb: 2,
            py: 0.5,
            backgroundColor: isComplete ? `${operatorColor}15` : 'warning.light',
            '& .MuiAlert-message': {
              width: '100%',
              py: 0.5
            }
          }}
        >
          <Typography
            variant="body2"
            sx={{
              fontStyle: 'italic',
              color: isComplete ? 'text.primary' : 'warning.dark',
              fontWeight: isComplete ? 'medium' : 'normal'
            }}
          >
            <strong>Condition:</strong> {previewText}
          </Typography>
        </Alert>
      )}

      <Stack direction="row" spacing={2} alignItems="center">
        {/* Drag handle */}
        <IconButton size="small" sx={{ cursor: 'grab', color: operatorColor }}>
          <DragIcon fontSize="small" />
        </IconButton>

        {/* Data source selector */}
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Data Source</InputLabel>
          <Select
            value={condition.dataSource || ''}
            label="Data Source"
            onChange={(e) => handleDataSourceChange(e.target.value)}
          >
            {availableDataSources.map((ds) => (
              <MenuItem key={ds.id} value={ds.id}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2">{ds.label}</Typography>
                  {ds.catalogType && (
                    <Chip label="Catalog" size="small" color="primary" variant="outlined" />
                  )}
                </Stack>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Operator selector */}
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Operator</InputLabel>
          <Select
            value={condition.operator || ''}
            label="Operator"
            onChange={(e) => onUpdate(index, { ...condition, operator: e.target.value })}
            disabled={!condition.dataSource}
          >
            {availableOperators.map((op) => (
              <MenuItem key={op.value} value={op.value}>
                {op.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Value input */}
        {condition.operator &&
          condition.operator !== 'exists' &&
          condition.operator !== 'notExists' &&
          renderValueInput()}

        {/* Delete button */}
        <IconButton
          size="small"
          color="error"
          onClick={() => onDelete(index)}
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Stack>

      {/* Show selected catalog item details */}
      {condition.catalogSelection && (
        <Box mt={1}>
          <Chip
            label={`Selected: ${condition.catalogSelection.display || condition.catalogSelection.name}`}
            size="small"
            onDelete={() => handleCatalogSelection(null)}
            color="primary"
            variant="outlined"
          />
        </Box>
      )}

      {/* Validation feedback */}
      {validationErrors.length > 0 && (
        <Alert
          severity="warning"
          sx={{
            mt: 2,
            py: 0.5,
            '& .MuiAlert-message': {
              width: '100%',
              py: 0
            }
          }}
        >
          <Typography variant="caption" component="div">
            <strong>Incomplete:</strong>
            <Box component="ul" sx={{ m: 0, pl: 2 }}>
              {validationErrors.map((error, idx) => (
                <li key={idx}>{error}</li>
              ))}
            </Box>
          </Typography>
        </Alert>
      )}

      {/* Completion indicator */}
      {isComplete && (
        <Box
          sx={{
            mt: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            color: 'success.main'
          }}
        >
          <Chip
            label="✓ Complete"
            size="small"
            color="success"
            variant="outlined"
            sx={{ height: 20, fontSize: '0.7rem' }}
          />
        </Box>
      )}
    </Paper>
  );
};

/**
 * Condition group with logical operator
 */
const ConditionGroup = ({
  group,
  index,
  onUpdate,
  onDelete,
  availableDataSources,
  level = 0
}) => {
  const handleConditionUpdate = (conditionIndex, updatedCondition) => {
    const updatedConditions = [...group.conditions];
    updatedConditions[conditionIndex] = updatedCondition;
    onUpdate(index, { ...group, conditions: updatedConditions });
  };

  const handleConditionDelete = (conditionIndex) => {
    const updatedConditions = group.conditions.filter((_, i) => i !== conditionIndex);
    onUpdate(index, { ...group, conditions: updatedConditions });
  };

  const handleAddCondition = () => {
    const newCondition = {
      type: 'condition',
      dataSource: '',
      operator: '',
      value: '',
      catalogSelection: null
    };
    onUpdate(index, {
      ...group,
      conditions: [...group.conditions, newCondition]
    });
  };

  const handleAddGroup = () => {
    const newGroup = {
      type: 'group',
      operator: 'AND',
      conditions: []
    };
    onUpdate(index, {
      ...group,
      conditions: [...group.conditions, newGroup]
    });
  };

  // Color coding based on logical operator for visual hierarchy
  const operatorColors = {
    AND: {
      border: '#2196F3',      // Blue
      bg: '#E3F2FD',          // Light blue
      bgHover: '#BBDEFB',     // Darker blue on hover
      icon: '#1976D2'         // Darker blue for icon
    },
    OR: {
      border: '#FF9800',      // Orange
      bg: '#FFF3E0',          // Light orange
      bgHover: '#FFE0B2',     // Darker orange on hover
      icon: '#F57C00'         // Darker orange for icon
    },
    NOT: {
      border: '#F44336',      // Red
      bg: '#FFEBEE',          // Light red
      bgHover: '#FFCDD2',     // Darker red on hover
      icon: '#D32F2F'         // Darker red for icon
    }
  };

  const currentOperator = group.operator || 'AND';
  const colors = operatorColors[currentOperator];

  return (
    <Box sx={{ ml: level * 2, mb: 2, position: 'relative' }}>
      {/* Operator Badge - Prominent visual indicator */}
      <Chip
        label={group.operator || 'AND'}
        size="small"
        sx={{
          position: 'absolute',
          top: -12,
          left: 16,
          backgroundColor: colors.border,
          color: 'white',
          fontWeight: 'bold',
          fontSize: '0.75rem',
          height: 24,
          zIndex: 1,
          boxShadow: 2,
          '& .MuiChip-label': {
            px: 1.5
          }
        }}
      />

      <Paper
        elevation={level === 0 ? 3 : 2}
        sx={{
          p: 2,
          border: '3px solid',
          borderColor: colors.border,
          backgroundColor: colors.bg,
          borderRadius: 2,
          transition: 'all 0.2s ease-in-out',
          position: 'relative',
          '&:hover': {
            backgroundColor: colors.bgHover,
            boxShadow: 4,
            borderWidth: '4px'
          }
        }}
      >
        {/* Group header */}
        <Stack direction="row" spacing={2} alignItems="center" mb={2}>
          <TreeIcon sx={{ color: colors.icon, fontSize: 28 }} />
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Logic</InputLabel>
            <Select
              value={group.operator || 'AND'}
              label="Logic"
              onChange={(e) => onUpdate(index, { ...group, operator: e.target.value })}
              renderValue={(value) => (
                <Stack direction="row" spacing={1} alignItems="center">
                  <Box
                    sx={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      backgroundColor: operatorColors[value].border
                    }}
                  />
                  <Typography>{value}</Typography>
                </Stack>
              )}
            >
              {Object.values(LOGICAL_OPERATORS).map((op) => (
                <MenuItem key={op.value} value={op.value}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Box
                      sx={{
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        backgroundColor: operatorColors[op.value].border
                      }}
                    />
                    <Typography>{op.label}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                      {op.value === 'AND' && '(All must match)'}
                      {op.value === 'OR' && '(Any can match)'}
                      {op.value === 'NOT' && '(None should match)'}
                    </Typography>
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Tooltip title={`This group requires ${group.operator === 'AND' ? 'all' : group.operator === 'OR' ? 'any' : 'none'} of the conditions to match`}>
            <Chip
              label={`${group.conditions.length} condition(s)`}
              size="small"
              variant="outlined"
              sx={{
                borderColor: colors.border,
                color: colors.icon,
                fontWeight: 'medium'
              }}
            />
          </Tooltip>

          <Box sx={{ flex: 1 }} />

          {level > 0 && (
            <IconButton
              size="small"
              color="error"
              onClick={() => onDelete(index)}
              sx={{ '&:hover': { backgroundColor: 'error.light', color: 'white' } }}
            >
              <DeleteIcon />
            </IconButton>
          )}
        </Stack>

        <Divider
          sx={{
            mb: 2,
            borderColor: colors.border,
            borderWidth: 2,
            opacity: 0.4
          }}
        />

        {/* Conditions with visual connectors */}
        {group.conditions.map((condition, idx) => {
          const isLast = idx === group.conditions.length - 1;

          return (
            <Box key={idx} sx={{ position: 'relative' }}>
              {/* Visual connector line */}
              {idx > 0 && (
                <Box
                  sx={{
                    position: 'absolute',
                    left: -16,
                    top: -8,
                    width: '100%',
                    height: 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Chip
                    label={group.operator}
                    size="small"
                    sx={{
                      height: 16,
                      fontSize: '0.65rem',
                      backgroundColor: colors.border,
                      color: 'white',
                      fontWeight: 'bold',
                      '& .MuiChip-label': {
                        px: 0.75
                      }
                    }}
                  />
                </Box>
              )}

              {condition.type === 'group' ? (
                <ConditionGroup
                  group={condition}
                  index={idx}
                  onUpdate={handleConditionUpdate}
                  onDelete={handleConditionDelete}
                  availableDataSources={availableDataSources}
                  level={level + 1}
                />
              ) : (
                <ConditionBlock
                  condition={condition}
                  index={idx}
                  onUpdate={handleConditionUpdate}
                  onDelete={handleConditionDelete}
                  availableDataSources={availableDataSources}
                  level={level}
                  operatorColor={colors.border}
                  showPreview={true}
                />
              )}
            </Box>
          );
        })}

        {/* Add buttons */}
        <Stack direction="row" spacing={1} mt={2}>
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={handleAddCondition}
            variant="outlined"
          >
            Add Condition
          </Button>
          <Button
            size="small"
            startIcon={<TreeIcon />}
            onClick={handleAddGroup}
            variant="outlined"
          >
            Add Group
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
};

/**
 * Main Condition Builder Component
 */
const ConditionBuilder = ({
  conditions,
  onChange,
  serviceType = null,
  error = null
}) => {
  // Get recommended data sources for service type
  const availableDataSources = React.useMemo(() => {
    if (serviceType) {
      const recommended = getRecommendedDataSources(serviceType).filter(Boolean);
      return recommended.length > 0 ? recommended : Object.values(DATA_SOURCES);
    }
    return Object.values(DATA_SOURCES);
  }, [serviceType]);

  // Root is always a group - ensure proper initialization
  const rootGroup = React.useMemo(() => {
    // Handle null, undefined, or empty array
    if (!conditions || !Array.isArray(conditions) || conditions.length === 0) {
      return { type: 'group', operator: 'AND', conditions: [] };
    }

    // Use first item if it's a valid group
    const first = conditions[0];
    if (first && first.type === 'group') {
      return first;
    }

    // Fallback to default group
    return { type: 'group', operator: 'AND', conditions: [] };
  }, [conditions]);

  const handleRootUpdate = (index, updatedGroup) => {
    if (onChange) {
      onChange([updatedGroup]);
    }
  };

  const handleRootDelete = () => {
    // Cannot delete root group
  };

  return (
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" mb={2}>
        <FunctionIcon color="primary" fontSize="large" />
        <Box>
          <Typography variant="h6">Condition Builder</Typography>
          <Typography variant="body2" color="text.secondary">
            Define the clinical logic for when this service should trigger
          </Typography>
        </Box>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Alert severity="info" sx={{ mb: 2 }}>
        <Typography variant="body2">
          <strong>Tip:</strong> Combine multiple conditions using AND/OR logic.
          Nest groups for complex rules like: (Condition A AND Condition B) OR (Condition C)
        </Typography>
      </Alert>

      <ConditionGroup
        group={rootGroup}
        index={0}
        onUpdate={handleRootUpdate}
        onDelete={handleRootDelete}
        availableDataSources={availableDataSources}
        level={0}
      />

      {/* Summary */}
      {rootGroup.conditions.length === 0 && (
        <Paper elevation={0} sx={{ p: 3, mt: 2, textAlign: 'center', backgroundColor: 'grey.50' }}>
          <Typography variant="body2" color="text.secondary">
            No conditions defined. Click "Add Condition" to start building your logic.
          </Typography>
        </Paper>
      )}
    </Box>
  );
};

export default ConditionBuilder;
