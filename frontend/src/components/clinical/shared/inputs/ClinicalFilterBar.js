/**
 * ClinicalFilterBar Component
 * Reusable filter interface for clinical data
 */

import React, { useState } from 'react';
import {
  Box,
  TextField,
  MenuItem,
  Stack,
  IconButton,
  Tooltip,
  Chip,
  Button,
  Popover,
  Typography,
  useTheme,
  alpha,
  Collapse
} from '@mui/material';
import {
  FilterList as FilterIcon,
  Clear as ClearIcon,
  CalendarMonth as CalendarIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format } from 'date-fns';

const ClinicalFilterBar = ({
  // Filter configurations
  filters = {},
  onFilterChange,
  
  // Available filter options
  availableFilters = ['status', 'severity', 'priority', 'dateRange'],
  filterOptions = {},
  
  // Display options
  showActiveFilters = true,
  showClearAll = true,
  showAdvanced = false,
  advancedFilters = [],
  
  // Customization
  sx = {},
  ...props
}) => {
  const theme = useTheme();
  const [dateRangeAnchor, setDateRangeAnchor] = useState(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  
  // Default filter options
  const defaultFilterOptions = {
    status: [
      { value: 'all', label: 'All Status' },
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
      { value: 'resolved', label: 'Resolved' }
    ],
    severity: [
      { value: 'all', label: 'All Severities' },
      { value: 'high', label: 'High' },
      { value: 'moderate', label: 'Moderate' },
      { value: 'low', label: 'Low' }
    ],
    priority: [
      { value: 'all', label: 'All Priorities' },
      { value: 'high', label: 'High' },
      { value: 'medium', label: 'Medium' },
      { value: 'low', label: 'Low' }
    ],
    category: [
      { value: 'all', label: 'All Categories' },
      { value: 'diagnostic', label: 'Diagnostic' },
      { value: 'medication', label: 'Medication' },
      { value: 'procedure', label: 'Procedure' }
    ]
  };
  
  // Merge provided options with defaults
  const mergedOptions = {
    ...defaultFilterOptions,
    ...filterOptions
  };
  
  // Handle filter change
  const handleFilterChange = (filterName, value) => {
    onFilterChange({
      ...filters,
      [filterName]: value
    });
  };
  
  // Handle date range change
  const handleDateRangeChange = (field, value) => {
    const currentRange = filters.dateRange || {};
    handleFilterChange('dateRange', {
      ...currentRange,
      [field]: value
    });
  };
  
  // Clear all filters
  const handleClearAll = () => {
    const clearedFilters = {};
    availableFilters.forEach(filter => {
      if (filter === 'dateRange') {
        clearedFilters[filter] = null;
      } else {
        clearedFilters[filter] = 'all';
      }
    });
    onFilterChange(clearedFilters);
  };
  
  // Check if any filters are active
  const hasActiveFilters = () => {
    return availableFilters.some(filter => {
      if (filter === 'dateRange') {
        return filters.dateRange && (filters.dateRange.start || filters.dateRange.end);
      }
      return filters[filter] && filters[filter] !== 'all';
    });
  };
  
  // Get active filter count
  const getActiveFilterCount = () => {
    return availableFilters.filter(filter => {
      if (filter === 'dateRange') {
        return filters.dateRange && (filters.dateRange.start || filters.dateRange.end);
      }
      return filters[filter] && filters[filter] !== 'all';
    }).length;
  };
  
  // Format date range display
  const formatDateRange = () => {
    if (!filters.dateRange) return 'Date Range';
    const { start, end } = filters.dateRange;
    if (start && end) {
      return `${format(start, 'MMM d')} - ${format(end, 'MMM d')}`;
    } else if (start) {
      return `From ${format(start, 'MMM d')}`;
    } else if (end) {
      return `Until ${format(end, 'MMM d')}`;
    }
    return 'Date Range';
  };
  
  return (
    <Box sx={{ mb: 2, ...sx }} {...props}>
      <Stack spacing={2}>
        {/* Main filters */}
        <Stack 
          direction="row" 
          spacing={1} 
          alignItems="center"
          flexWrap="wrap"
        >
          {/* Status filter */}
          {availableFilters.includes('status') && (
            <TextField
              select
              size="small"
              value={filters.status || 'all'}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              sx={{ minWidth: 140 }}
            >
              {mergedOptions.status.map(option => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
          )}
          
          {/* Severity filter */}
          {availableFilters.includes('severity') && (
            <TextField
              select
              size="small"
              value={filters.severity || 'all'}
              onChange={(e) => handleFilterChange('severity', e.target.value)}
              sx={{ minWidth: 140 }}
            >
              {mergedOptions.severity.map(option => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
          )}
          
          {/* Priority filter */}
          {availableFilters.includes('priority') && (
            <TextField
              select
              size="small"
              value={filters.priority || 'all'}
              onChange={(e) => handleFilterChange('priority', e.target.value)}
              sx={{ minWidth: 140 }}
            >
              {mergedOptions.priority.map(option => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
          )}
          
          {/* Date range filter */}
          {availableFilters.includes('dateRange') && (
            <>
              <Button
                size="small"
                variant="outlined"
                startIcon={<CalendarIcon />}
                onClick={(e) => setDateRangeAnchor(e.currentTarget)}
                sx={{
                  color: filters.dateRange ? theme.palette.primary.main : theme.palette.text.secondary,
                  borderColor: filters.dateRange ? theme.palette.primary.main : alpha(theme.palette.divider, 0.5)
                }}
              >
                {formatDateRange()}
              </Button>
              
              <Popover
                open={Boolean(dateRangeAnchor)}
                anchorEl={dateRangeAnchor}
                onClose={() => setDateRangeAnchor(null)}
                anchorOrigin={{
                  vertical: 'bottom',
                  horizontal: 'left',
                }}
              >
                <Box sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Select Date Range
                  </Typography>
                  <LocalizationProvider dateAdapter={AdapterDateFns}>
                    <Stack spacing={2}>
                      <DatePicker
                        label="Start Date"
                        value={filters.dateRange?.start || null}
                        onChange={(value) => handleDateRangeChange('start', value)}
                        slotProps={{
                          textField: {
                            size: 'small',
                            fullWidth: true
                          }
                        }}
                      />
                      <DatePicker
                        label="End Date"
                        value={filters.dateRange?.end || null}
                        onChange={(value) => handleDateRangeChange('end', value)}
                        minDate={filters.dateRange?.start || undefined}
                        slotProps={{
                          textField: {
                            size: 'small',
                            fullWidth: true
                          }
                        }}
                      />
                      <Button
                        size="small"
                        onClick={() => {
                          handleFilterChange('dateRange', null);
                          setDateRangeAnchor(null);
                        }}
                      >
                        Clear Date Range
                      </Button>
                    </Stack>
                  </LocalizationProvider>
                </Box>
              </Popover>
            </>
          )}
          
          {/* Advanced filters toggle */}
          {showAdvanced && advancedFilters.length > 0 && (
            <Tooltip title={showAdvancedFilters ? 'Hide advanced filters' : 'Show advanced filters'}>
              <IconButton
                size="small"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              >
                {showAdvancedFilters ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Tooltip>
          )}
          
          {/* Clear all button */}
          {showClearAll && hasActiveFilters() && (
            <Tooltip title="Clear all filters">
              <IconButton
                size="small"
                onClick={handleClearAll}
                sx={{ ml: 'auto' }}
              >
                <ClearIcon />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
        
        {/* Advanced filters */}
        {showAdvanced && (
          <Collapse in={showAdvancedFilters}>
            <Stack 
              direction="row" 
              spacing={1} 
              alignItems="center"
              flexWrap="wrap"
              sx={{ pt: 1 }}
            >
              {advancedFilters.map(filter => (
                <TextField
                  key={filter.name}
                  select={filter.type === 'select'}
                  size="small"
                  label={filter.label}
                  value={filters[filter.name] || filter.defaultValue || ''}
                  onChange={(e) => handleFilterChange(filter.name, e.target.value)}
                  sx={{ minWidth: 140 }}
                  {...filter.props}
                >
                  {filter.type === 'select' && filter.options.map(option => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
              ))}
            </Stack>
          </Collapse>
        )}
        
        {/* Active filters display */}
        {showActiveFilters && hasActiveFilters() && (
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <FilterIcon sx={{ fontSize: 16, color: theme.palette.text.secondary }} />
            
            {availableFilters.map(filter => {
              if (filter === 'dateRange' && filters.dateRange) {
                return (
                  <Chip
                    key={filter}
                    label={formatDateRange()}
                    size="small"
                    onDelete={() => handleFilterChange('dateRange', null)}
                    sx={{
                      backgroundColor: alpha(theme.palette.primary.main, 0.1),
                      color: theme.palette.primary.main,
                      '& .MuiChip-deleteIcon': {
                        color: alpha(theme.palette.primary.main, 0.5)
                      }
                    }}
                  />
                );
              } else if (filters[filter] && filters[filter] !== 'all') {
                const option = mergedOptions[filter]?.find(opt => opt.value === filters[filter]);
                return (
                  <Chip
                    key={filter}
                    label={option?.label || filters[filter]}
                    size="small"
                    onDelete={() => handleFilterChange(filter, 'all')}
                    sx={{
                      backgroundColor: alpha(theme.palette.primary.main, 0.1),
                      color: theme.palette.primary.main,
                      '& .MuiChip-deleteIcon': {
                        color: alpha(theme.palette.primary.main, 0.5)
                      }
                    }}
                  />
                );
              }
              return null;
            })}
            
            <Typography variant="caption" color="text.secondary">
              ({getActiveFilterCount()} active)
            </Typography>
          </Stack>
        )}
      </Stack>
    </Box>
  );
};

export default ClinicalFilterBar;