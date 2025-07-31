/**
 * Collapsible Filter Panel Component
 * Reusable filter panel that collapses on scroll to save screen space
 * Shows applied filters when collapsed for context awareness
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Chip,
  Stack,
  Button,
  Collapse,
  TextField,
  InputAdornment,
  ToggleButtonGroup,
  ToggleButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  useTheme,
  useMediaQuery,
  Fade,
  Badge,
  Tooltip,
  Divider,
  FormControlLabel,
  Switch,
  alpha
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Clear as ClearIcon,
  DateRange as DateRangeIcon,
  Category as CategoryIcon,
  LocalOffer as TagIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Timeline as TimelineIcon,
  Dashboard as DashboardIcon,
  List as ListIcon,
  CalendarMonth as CalendarIcon
} from '@mui/icons-material';

const CollapsibleFilterPanel = ({
  // Core props
  searchQuery = '',
  onSearchChange,
  dateRange = 'all',
  onDateRangeChange,
  viewMode = 'list',
  onViewModeChange,
  categories = [],
  selectedCategories = [],
  onCategoriesChange,
  showInactive = false,
  onShowInactiveChange,
  additionalFilters = [],
  onRefresh,
  onExport,
  scrollContainerRef,
  // Customization
  searchPlaceholder = 'Search...',
  dateRangeOptions = [
    { value: 'all', label: 'All Time' },
    { value: '30d', label: 'Last 30 Days' },
    { value: '90d', label: 'Last 90 Days' },
    { value: '1y', label: 'Last Year' }
  ],
  viewModeOptions = [
    { value: 'list', label: 'List', icon: <ListIcon /> },
    { value: 'dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
    { value: 'timeline', label: 'Timeline', icon: <TimelineIcon /> }
  ],
  showViewMode = true,
  showCategories = true,
  showInactiveToggle = true,
  collapseThreshold = 100,
  children // Additional filter controls
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  
  const [isCollapsed, setIsCollapsed] = useState(true);  // Start collapsed
  const [isManuallyExpanded, setIsManuallyExpanded] = useState(false);
  const [activeFiltersCount, setActiveFiltersCount] = useState(0);
  
  // Calculate active filters
  useEffect(() => {
    let count = 0;
    if (searchQuery) count++;
    if (dateRange !== 'all') count++;
    if (showCategories && selectedCategories.length > 0) count += selectedCategories.length; // Only count if categories are shown
    if (showInactive) count++;
    if (additionalFilters.length > 0) count += additionalFilters.filter(f => f.active).length;
    setActiveFiltersCount(count);
  }, [searchQuery, dateRange, selectedCategories, showInactive, additionalFilters, showCategories]);

  // Handle scroll-based collapse
  useEffect(() => {
    if (isManuallyExpanded) return; // Don't auto-collapse if manually expanded

    const handleScroll = () => {
      const container = scrollContainerRef?.current || window;
      const scrollTop = container === window 
        ? window.pageYOffset || document.documentElement.scrollTop
        : container.scrollTop;
      
      // Only change collapse state based on scroll if not starting at top
      if (scrollTop === 0) {
        // At top, respect initial collapsed state (true)
        return;
      }
      
      setIsCollapsed(scrollTop > collapseThreshold);
    };

    const container = scrollContainerRef?.current || window;
    
    // Add scroll listener
    if (container) {
      container.addEventListener('scroll', handleScroll, { passive: true });
    }
    
    return () => {
      if (container) {
        container.removeEventListener('scroll', handleScroll);
      }
    };
  }, [scrollContainerRef, collapseThreshold, isManuallyExpanded]);

  // Clear all filters
  const handleClearAll = () => {
    if (onSearchChange) onSearchChange('');
    if (onDateRangeChange) onDateRangeChange('all');
    if (onCategoriesChange) onCategoriesChange([]);
    if (onShowInactiveChange) onShowInactiveChange(false);
  };

  // Toggle manual expansion
  const handleToggleExpanded = () => {
    setIsManuallyExpanded(!isManuallyExpanded);
    setIsCollapsed(!isCollapsed);
  };

  // Get selected date range label
  const getDateRangeLabel = () => {
    const option = dateRangeOptions.find(opt => opt.value === dateRange);
    return option?.label || 'All Time';
  };

  // Render collapsed state - single line with key filters visible
  const renderCollapsedPanel = () => (
    <Paper
      elevation={1}
      sx={{
        p: 1,
        borderRadius: 1,
        backgroundColor: alpha(theme.palette.background.paper, 0.9),
        backdropFilter: 'blur(8px)'
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center">
        {/* Search field - compact */}
        <TextField
          size="small"
          placeholder={searchPlaceholder}
          value={searchQuery}
          onChange={(e) => onSearchChange?.(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
            endAdornment: searchQuery && (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  onClick={() => onSearchChange?.('')}
                  edge="end"
                >
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ),
            sx: { 
              height: 32,
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: alpha(theme.palette.divider, 0.2)
              }
            }
          }}
          sx={{ 
            flex: isMobile ? 1 : '0 1 300px',
            minWidth: isMobile ? 0 : 200
          }}
        />

        {/* Active filters display */}
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flex: 1 }}>
          {activeFiltersCount > 0 && (
            <Badge badgeContent={activeFiltersCount} color="primary" variant="dot">
              <FilterIcon fontSize="small" color="action" />
            </Badge>
          )}
          
          {dateRange !== 'all' && (
            <Chip
              size="small"
              icon={<DateRangeIcon sx={{ fontSize: 16 }} />}
              label={getDateRangeLabel()}
              onDelete={() => onDateRangeChange?.('all')}
              sx={{ height: 24 }}
            />
          )}
          
          {showCategories && selectedCategories.length > 0 && (
            <Chip
              size="small"
              icon={<CategoryIcon sx={{ fontSize: 16 }} />}
              label={`${selectedCategories.length} categories`}
              onDelete={() => onCategoriesChange?.([])}
              sx={{ height: 24 }}
            />
          )}
          
          {showInactive && (
            <Chip
              size="small"
              label="Show Inactive"
              onDelete={() => onShowInactiveChange?.(false)}
              sx={{ height: 24 }}
            />
          )}
        </Stack>

        {/* Action buttons */}
        <Stack direction="row" spacing={0.5}>
          {onRefresh && (
            <Tooltip title="Refresh">
              <IconButton size="small" onClick={onRefresh}>
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          
          <Tooltip title="Expand filters">
            <IconButton size="small" onClick={handleToggleExpanded}>
              <ExpandMoreIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>
    </Paper>
  );

  // Render expanded state - full filter options
  const renderExpandedPanel = () => (
    <Paper
      elevation={1}
      sx={{
        p: 2,
        borderRadius: 1,
        backgroundColor: theme.palette.background.paper
      }}
    >
      <Stack spacing={2}>
        {/* Header row */}
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Filters & Search
          </Typography>
          
          <Stack direction="row" spacing={1}>
            {activeFiltersCount > 0 && (
              <Button
                size="small"
                variant="text"
                startIcon={<ClearIcon fontSize="small" />}
                onClick={handleClearAll}
              >
                Clear All
              </Button>
            )}
            
            {onExport && (
              <Button
                size="small"
                variant="text"
                startIcon={<DownloadIcon fontSize="small" />}
                onClick={onExport}
              >
                Export
              </Button>
            )}
            
            {onRefresh && (
              <Button
                size="small"
                variant="text"
                startIcon={<RefreshIcon fontSize="small" />}
                onClick={onRefresh}
              >
                Refresh
              </Button>
            )}
            
            <IconButton size="small" onClick={handleToggleExpanded}>
              <ExpandLessIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Stack>

        <Divider />

        {/* Filter controls */}
        <Stack 
          direction={{ xs: 'column', md: 'row' }} 
          spacing={2}
          alignItems={{ xs: 'stretch', md: 'flex-start' }}
        >
          {/* Search */}
          <TextField
            size="small"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
              endAdornment: searchQuery && (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={() => onSearchChange?.('')}
                    edge="end"
                  >
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              )
            }}
            sx={{ 
              flex: '1 1 300px',
              minWidth: 200
            }}
          />

          {/* Date Range */}
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Date Range</InputLabel>
            <Select
              value={dateRange}
              onChange={(e) => onDateRangeChange?.(e.target.value)}
              label="Date Range"
              startAdornment={<DateRangeIcon sx={{ fontSize: 20, mr: 1, color: 'action.active' }} />}
            >
              {dateRangeOptions.map(option => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Categories */}
          {showCategories && categories.length > 0 && (
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Categories</InputLabel>
              <Select
                multiple
                value={selectedCategories}
                onChange={(e) => onCategoriesChange?.(e.target.value)}
                label="Categories"
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value) => (
                      <Chip key={value} label={value} size="small" />
                    ))}
                  </Box>
                )}
              >
                {categories.map(category => (
                  <MenuItem key={category.value} value={category.value}>
                    {category.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {/* View Mode */}
          {showViewMode && (
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={(e, newMode) => newMode && onViewModeChange?.(newMode)}
              size="small"
            >
              {viewModeOptions.map(option => (
                <ToggleButton key={option.value} value={option.value}>
                  <Tooltip title={option.label}>
                    {option.icon}
                  </Tooltip>
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          )}

          {/* Show Inactive Toggle */}
          {showInactiveToggle && (
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={showInactive}
                  onChange={(e) => onShowInactiveChange?.(e.target.checked)}
                />
              }
              label="Show Inactive"
              sx={{ ml: 1 }}
            />
          )}
        </Stack>

        {/* Additional custom filters */}
        {children && (
          <>
            <Divider />
            <Box>{children}</Box>
          </>
        )}
      </Stack>
    </Paper>
  );

  return (
    <Box
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 100, // Ensure it's above other content but below modals
        transition: theme.transitions.create(['all'], {
          duration: theme.transitions.duration.short,
        }),
        mb: 2,
        backgroundColor: theme.palette.background.default // Ensure background to prevent see-through
      }}
    >
      <Collapse in={!isCollapsed} collapsedSize={0}>
        {renderExpandedPanel()}
      </Collapse>
      
      <Collapse in={isCollapsed}>
        {renderCollapsedPanel()}
      </Collapse>
    </Box>
  );
};

export default CollapsibleFilterPanel;