/**
 * Advanced Imaging Filters Component
 * Provides comprehensive filtering interface for FHIR R4 ImagingStudy resources
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  ListItemText,
  Chip,
  Stack,
  Button,
  IconButton,
  Collapse,
  Tooltip,
  Divider,
  InputAdornment,
  Autocomplete,
  Slider,
  Switch,
  FormControlLabel,
  Grid
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Clear as ClearIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  CalendarMonth as CalendarIcon,
  Person as PersonIcon,
  LocationOn as LocationIcon,
  MedicalServices as ModalityIcon,
  Numbers as CountIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, subDays, subMonths, subYears } from 'date-fns';

const MENU_PROPS = {
  PaperProps: {
    style: {
      maxHeight: 224,
      width: 250,
    },
  },
};

const QuickDateRanges = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 3 months', days: 90 },
  { label: 'Last 6 months', days: 180 },
  { label: 'Last year', days: 365 },
  { label: 'Last 2 years', days: 730 }
];

const AdvancedImagingFilters = ({ 
  onFiltersChange, 
  availableFilters = {},
  loading = false,
  patientId,
  onRefreshFilters 
}) => {
  const [expanded, setExpanded] = useState(false);
  const [filters, setFilters] = useState({
    // Basic filters
    textSearch: '',
    modality: [],
    status: 'all',
    
    // Date filters
    dateRange: {
      from: null,
      to: null,
      quickRange: ''
    },
    
    // Provider filters
    performer: '',
    
    // Location filters
    facility: '',
    bodySite: '',
    
    // Technical filters
    minSeries: 0,
    maxSeries: 100,
    minInstances: 0,
    maxInstances: 1000,
    
    // Advanced options
    hasMultipleModalities: false,
    onlyWithReports: false,
    excludeIncomplete: false
  });

  const [localSearchText, setLocalSearchText] = useState('');
  const [searchDebounceTimer, setSearchDebounceTimer] = useState(null);

  // Available options from props or defaults
  const {
    modalities = [],
    performers = [],
    bodyParts = [],
    facilities = [],
    statusOptions = ['available', 'pending', 'cancelled'],
    dateRange: availableDateRange
  } = availableFilters;

  // Debounced text search
  useEffect(() => {
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }

    const timer = setTimeout(() => {
      setFilters(prev => ({ ...prev, textSearch: localSearchText }));
    }, 300);

    setSearchDebounceTimer(timer);

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [localSearchText]);

  // Notify parent when filters change
  useEffect(() => {
    const searchParams = buildSearchParams(filters);
    onFiltersChange?.(searchParams);
  }, [filters, onFiltersChange]);

  const buildSearchParams = useCallback((filterState) => {
    const params = {};

    // Text search
    if (filterState.textSearch.trim()) {
      params.textSearch = filterState.textSearch.trim();
    }

    // Modality filter
    if (filterState.modality.length > 0) {
      params.modality = filterState.modality;
    }

    // Status filter
    if (filterState.status !== 'all') {
      params.status = filterState.status;
    }

    // Date range
    if (filterState.dateRange.from || filterState.dateRange.to) {
      params.started = {};
      if (filterState.dateRange.from) {
        params.started.from = format(filterState.dateRange.from, 'yyyy-MM-dd');
      }
      if (filterState.dateRange.to) {
        params.started.to = format(filterState.dateRange.to, 'yyyy-MM-dd');
      }
    }

    // Performer filter
    if (filterState.performer) {
      params.performer = filterState.performer;
    }

    // Facility filter
    if (filterState.facility) {
      params.facility = filterState.facility;
    }

    // Body site filter
    if (filterState.bodySite) {
      params.bodySite = filterState.bodySite;
    }

    // Series count filter
    if (filterState.minSeries > 0) {
      params.minSeries = filterState.minSeries;
    }
    if (filterState.maxSeries < 100) {
      params.maxSeries = filterState.maxSeries;
    }

    // Instance count filter
    if (filterState.minInstances > 0) {
      params.minInstances = filterState.minInstances;
    }
    if (filterState.maxInstances < 1000) {
      params.maxInstances = filterState.maxInstances;
    }

    return params;
  }, []);

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleModalityChange = (event) => {
    const value = event.target.value;
    handleFilterChange('modality', typeof value === 'string' ? value.split(',') : value);
  };

  const handleDateRangeChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      dateRange: {
        ...prev.dateRange,
        [field]: value,
        quickRange: '' // Clear quick range when manually setting dates
      }
    }));
  };

  const handleQuickDateRange = (days) => {
    const toDate = new Date();
    const fromDate = subDays(toDate, days);
    
    setFilters(prev => ({
      ...prev,
      dateRange: {
        from: fromDate,
        to: toDate,
        quickRange: `last-${days}-days`
      }
    }));
  };

  const clearAllFilters = () => {
    setFilters({
      textSearch: '',
      modality: [],
      status: 'all',
      dateRange: { from: null, to: null, quickRange: '' },
      performer: '',
      facility: '',
      bodySite: '',
      minSeries: 0,
      maxSeries: 100,
      minInstances: 0,
      maxInstances: 1000,
      hasMultipleModalities: false,
      onlyWithReports: false,
      excludeIncomplete: false
    });
    setLocalSearchText('');
  };

  const hasActiveFilters = useMemo(() => {
    return filters.textSearch.trim() !== '' ||
           filters.modality.length > 0 ||
           filters.status !== 'all' ||
           filters.dateRange.from ||
           filters.dateRange.to ||
           filters.performer !== '' ||
           filters.facility !== '' ||
           filters.bodySite !== '' ||
           filters.minSeries > 0 ||
           filters.maxSeries < 100 ||
           filters.minInstances > 0 ||
           filters.maxInstances < 1000 ||
           filters.hasMultipleModalities ||
           filters.onlyWithReports ||
           filters.excludeIncomplete;
  }, [filters]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.textSearch.trim()) count++;
    if (filters.modality.length > 0) count++;
    if (filters.status !== 'all') count++;
    if (filters.dateRange.from || filters.dateRange.to) count++;
    if (filters.performer) count++;
    if (filters.facility) count++;
    if (filters.bodySite) count++;
    if (filters.minSeries > 0 || filters.maxSeries < 100) count++;
    if (filters.minInstances > 0 || filters.maxInstances < 1000) count++;
    if (filters.hasMultipleModalities) count++;
    if (filters.onlyWithReports) count++;
    if (filters.excludeIncomplete) count++;
    return count;
  }, [filters]);

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Paper sx={{ p: 2, mb: 2 }}>
        {/* Header with expand/collapse and filter count */}
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Typography variant="h6">
              Advanced Filters
              {activeFilterCount > 0 && (
                <Chip 
                  label={`${activeFilterCount} active`} 
                  size="small" 
                  color="primary" 
                  sx={{ ml: 1 }}
                />
              )}
            </Typography>
            
            <Tooltip title="Refresh available filter options">
              <IconButton 
                size="small" 
                onClick={onRefreshFilters}
                disabled={loading}
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Stack>

          <Stack direction="row" spacing={1}>
            {hasActiveFilters && (
              <Button
                size="small"
                startIcon={<ClearIcon />}
                onClick={clearAllFilters}
                variant="outlined"
              >
                Clear All
              </Button>
            )}
            
            <IconButton onClick={() => setExpanded(!expanded)}>
              {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Stack>
        </Stack>

        {/* Always visible - Primary filters */}
        <Grid container spacing={2} alignItems="center">
          {/* Text Search */}
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search studies, descriptions, body parts..."
              value={localSearchText}
              onChange={(e) => setLocalSearchText(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
                endAdornment: localSearchText && (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={() => setLocalSearchText('')}
                    >
                      <ClearIcon />
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
          </Grid>

          {/* Modality Filter */}
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Modality</InputLabel>
              <Select
                multiple
                value={filters.modality}
                onChange={handleModalityChange}
                label="Modality"
                MenuProps={MENU_PROPS}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value) => (
                      <Chip key={value} label={value} size="small" />
                    ))}
                  </Box>
                )}
              >
                {modalities.map((modality) => (
                  <MenuItem key={modality} value={modality}>
                    <Checkbox checked={filters.modality.indexOf(modality) > -1} />
                    <ListItemText primary={modality} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Status Filter */}
          <Grid item xs={12} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                label="Status"
              >
                <MenuItem value="all">All Status</MenuItem>
                {statusOptions.map((status) => (
                  <MenuItem key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Quick Date Ranges */}
          <Grid item xs={12} md={3}>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {QuickDateRanges.slice(0, 3).map((range) => (
                <Chip
                  key={range.days}
                  label={range.label}
                  size="small"
                  variant={filters.dateRange.quickRange === `last-${range.days}-days` ? 'filled' : 'outlined'}
                  clickable
                  onClick={() => handleQuickDateRange(range.days)}
                />
              ))}
            </Stack>
          </Grid>
        </Grid>

        {/* Expandable Advanced Filters */}
        <Collapse in={expanded}>
          <Divider sx={{ my: 2 }} />
          
          <Grid container spacing={2}>
            {/* Date Range */}
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CalendarIcon fontSize="small" />
                Date Range
              </Typography>
              <Stack direction="row" spacing={2}>
                <DatePicker
                  label="From Date"
                  value={filters.dateRange.from}
                  onChange={(value) => handleDateRangeChange('from', value)}
                  slotProps={{ textField: { size: 'small', fullWidth: true } }}
                  maxDate={filters.dateRange.to || new Date()}
                />
                <DatePicker
                  label="To Date"
                  value={filters.dateRange.to}
                  onChange={(value) => handleDateRangeChange('to', value)}
                  slotProps={{ textField: { size: 'small', fullWidth: true } }}
                  minDate={filters.dateRange.from}
                  maxDate={new Date()}
                />
              </Stack>
            </Grid>

            {/* Provider Filter */}
            <Grid item xs={12} md={3}>
              <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PersonIcon fontSize="small" />
                Performer
              </Typography>
              <Autocomplete
                size="small"
                options={performers}
                getOptionLabel={(option) => option.name || ''}
                value={performers.find(p => p.id === filters.performer) || null}
                onChange={(event, newValue) => {
                  handleFilterChange('performer', newValue?.id || '');
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="Select radiologist/technologist"
                  />
                )}
                renderOption={(props, option) => (
                  <Box component="li" {...props}>
                    <Box>
                      <Typography variant="body2">{option.name}</Typography>
                      {option.specialty && (
                        <Typography variant="caption" color="text.secondary">
                          {option.specialty}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                )}
              />
            </Grid>

            {/* Facility Filter */}
            <Grid item xs={12} md={3}>
              <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <LocationIcon fontSize="small" />
                Facility
              </Typography>
              <FormControl fullWidth size="small">
                <Select
                  value={filters.facility}
                  onChange={(e) => handleFilterChange('facility', e.target.value)}
                  displayEmpty
                >
                  <MenuItem value="">All Facilities</MenuItem>
                  {facilities.map((facility) => (
                    <MenuItem key={facility} value={facility}>
                      {facility}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Body Part Filter */}
            <Grid item xs={12} md={3}>
              <Typography variant="subtitle2" gutterBottom>
                Body Part
              </Typography>
              <Autocomplete
                size="small"
                freeSolo
                options={bodyParts}
                value={filters.bodySite}
                onChange={(event, newValue) => {
                  handleFilterChange('bodySite', newValue || '');
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="Select or type body part"
                  />
                )}
              />
            </Grid>

            {/* Series Count Range */}
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CountIcon fontSize="small" />
                Number of Series: {filters.minSeries} - {filters.maxSeries}
              </Typography>
              <Slider
                value={[filters.minSeries, filters.maxSeries]}
                onChange={(event, newValue) => {
                  handleFilterChange('minSeries', newValue[0]);
                  handleFilterChange('maxSeries', newValue[1]);
                }}
                valueLabelDisplay="auto"
                min={0}
                max={100}
                step={1}
                marks={[
                  { value: 0, label: '0' },
                  { value: 25, label: '25' },
                  { value: 50, label: '50' },
                  { value: 75, label: '75' },
                  { value: 100, label: '100+' }
                ]}
              />
            </Grid>

            {/* Instance Count Range */}
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>
                Number of Images: {filters.minInstances} - {filters.maxInstances}
              </Typography>
              <Slider
                value={[filters.minInstances, filters.maxInstances]}
                onChange={(event, newValue) => {
                  handleFilterChange('minInstances', newValue[0]);
                  handleFilterChange('maxInstances', newValue[1]);
                }}
                valueLabelDisplay="auto"
                min={0}
                max={1000}
                step={10}
                marks={[
                  { value: 0, label: '0' },
                  { value: 250, label: '250' },
                  { value: 500, label: '500' },
                  { value: 750, label: '750' },
                  { value: 1000, label: '1000+' }
                ]}
              />
            </Grid>

            {/* Advanced Options */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Advanced Options
              </Typography>
              <Stack direction="row" spacing={3} flexWrap="wrap">
                <FormControlLabel
                  control={
                    <Switch
                      checked={filters.hasMultipleModalities}
                      onChange={(e) => handleFilterChange('hasMultipleModalities', e.target.checked)}
                      size="small"
                    />
                  }
                  label="Multiple modalities"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={filters.onlyWithReports}
                      onChange={(e) => handleFilterChange('onlyWithReports', e.target.checked)}
                      size="small"
                    />
                  }
                  label="Only with reports"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={filters.excludeIncomplete}
                      onChange={(e) => handleFilterChange('excludeIncomplete', e.target.checked)}
                      size="small"
                    />
                  }
                  label="Exclude incomplete"
                />
              </Stack>
            </Grid>
          </Grid>
        </Collapse>
      </Paper>
    </LocalizationProvider>
  );
};

export default AdvancedImagingFilters;