/**
 * ClinicalFilterPanel Component
 * Unified filter panel for clinical tabs based on Chart Review implementation
 * Collapsible, responsive, and accessible
 */
import React, { useState, useEffect } from 'react';
import {
  Box,
  Stack,
  TextField,
  InputAdornment,
  ToggleButton,
  ToggleButtonGroup,
  IconButton,
  Tooltip,
  Collapse,
  useTheme,
  useMediaQuery,
  alpha,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  Chip,
  Button,
  Badge
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
  CalendarMonth as CalendarIcon,
  Refresh as RefreshIcon,
  Dashboard as DashboardIcon,
  Timeline as TimelineIcon,
  List as ListIcon,
  Clear as ClearIcon,
  Download as DownloadIcon
} from '@mui/icons-material';

/**
 * Collapsible filter panel for clinical data views
 * @param {Object} props
 * @param {string} props.searchQuery - Current search query
 * @param {Function} props.onSearchChange - Search change handler
 * @param {string} props.dateRange - Selected date range
 * @param {Function} props.onDateRangeChange - Date range change handler
 * @param {string} props.viewMode - Current view mode
 * @param {Function} props.onViewModeChange - View mode change handler
 * @param {boolean} props.showInactive - Show inactive items
 * @param {Function} props.onShowInactiveChange - Toggle inactive items
 * @param {Function} props.onRefresh - Refresh handler
 * @param {Function} props.onExport - Export handler
 * @param {string} props.searchPlaceholder - Search field placeholder
 * @param {Array} props.categories - Available categories for filtering
 * @param {Array} props.selectedCategories - Currently selected categories
 * @param {Function} props.onCategoriesChange - Category selection handler
 * @param {boolean} props.showCategories - Whether to show category filters
 * @param {Array} props.customFilters - Additional custom filters
 * @param {boolean} props.loading - Loading state
 * @param {number} props.resultCount - Number of results
 * @param {Object} props.scrollContainerRef - Ref to scroll container for auto-collapse
 */
const ClinicalFilterPanel = ({
  searchQuery = '',
  onSearchChange,
  dateRange = 'all',
  onDateRangeChange,
  viewMode = 'dashboard',
  onViewModeChange,
  showInactive = false,
  onShowInactiveChange,
  onRefresh,
  onExport,
  searchPlaceholder = 'Search...',
  categories = [],
  selectedCategories = [],
  onCategoriesChange,
  showCategories = false,
  customFilters,
  loading = false,
  resultCount,
  scrollContainerRef,
  ...props
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  
  const [expanded, setExpanded] = useState(!isMobile);
  const [isSticky, setIsSticky] = useState(false);
  
  // Auto-collapse on scroll for mobile
  useEffect(() => {
    if (!scrollContainerRef?.current || !isMobile) return;
    
    let lastScrollTop = 0;
    const handleScroll = () => {
      const scrollTop = scrollContainerRef.current.scrollTop;
      
      // Scrolling down - collapse
      if (scrollTop > lastScrollTop && scrollTop > 50) {
        setExpanded(false);
      }
      // Scrolling up - expand
      else if (scrollTop < lastScrollTop - 10) {
        setExpanded(true);
      }
      
      // Make sticky after scrolling past header
      setIsSticky(scrollTop > 100);
      
      lastScrollTop = scrollTop;
    };
    
    const container = scrollContainerRef.current;
    container.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [scrollContainerRef, isMobile]);
  
  // Date range options
  const dateRangeOptions = [
    { value: 'all', label: 'All Time' },
    { value: '30d', label: '30 Days' },
    { value: '90d', label: '90 Days' },
    { value: '1y', label: '1 Year' }
  ];
  
  // View mode options
  const viewModeOptions = [
    { value: 'dashboard', icon: <DashboardIcon fontSize="small" />, label: 'Dashboard' },
    { value: 'timeline', icon: <TimelineIcon fontSize="small" />, label: 'Timeline' },
    { value: 'list', icon: <ListIcon fontSize="small" />, label: 'List' }
  ];
  
  const hasActiveFilters = searchQuery || dateRange !== 'all' || 
    (selectedCategories.length > 0 && selectedCategories[0] !== 'all');
  
  return (
    <Box
      sx={{
        backgroundColor: theme.palette.background.paper,
        borderBottom: 1,
        borderColor: 'divider',
        transition: 'all 0.3s ease',
        ...(isSticky && {
          position: 'sticky',
          top: 0,
          zIndex: 10,
          boxShadow: theme.shadows[2]
        }),
        ...props.sx
      }}
    >
      {/* Collapsed Header */}
      <Box
        sx={{
          px: 2,
          py: 1,
          cursor: 'pointer',
          '&:hover': {
            backgroundColor: alpha(theme.palette.action.hover, 0.04)
          }
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={1}>
            <FilterIcon fontSize="small" color="action" />
            <Typography variant="body2" fontWeight={500}>
              Filters
            </Typography>
            {hasActiveFilters && (
              <Chip
                label="Active"
                size="small"
                color="primary"
                sx={{ height: 20, fontSize: '0.75rem' }}
              />
            )}
            {resultCount !== undefined && (
              <Typography variant="caption" color="text.secondary">
                ({resultCount} results)
              </Typography>
            )}
          </Stack>
          <IconButton size="small">
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Stack>
      </Box>
      
      {/* Expanded Content */}
      <Collapse in={expanded}>
        <Box sx={{ p: 2, pt: 0 }}>
          <Stack spacing={2}>
            {/* Search and Actions Row */}
            <Stack direction={isMobile ? 'column' : 'row'} spacing={2}>
              {/* Search Field */}
              <TextField
                size="small"
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
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
                        onClick={() => onSearchChange('')}
                        edge="end"
                      >
                        <ClearIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  )
                }}
                sx={{ 
                  flex: 1,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 0
                  }
                }}
              />
              
              {/* Date Range Selector */}
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <Select
                  value={dateRange}
                  onChange={(e) => onDateRangeChange(e.target.value)}
                  startAdornment={<CalendarIcon fontSize="small" sx={{ mr: 1 }} />}
                  sx={{ borderRadius: 0 }}
                >
                  {dateRangeOptions.map(option => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              {/* Action Buttons */}
              <Stack direction="row" spacing={1}>
                {onExport && (
                  <Tooltip title="Export data">
                    <IconButton size="small" onClick={onExport}>
                      <DownloadIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title="Refresh">
                  <IconButton 
                    size="small" 
                    onClick={onRefresh}
                    disabled={loading}
                  >
                    <RefreshIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Stack>
            
            {/* View Mode and Categories Row */}
            <Stack direction={isMobile ? 'column' : 'row'} spacing={2} alignItems="center">
              {/* View Mode Toggle */}
              <ToggleButtonGroup
                value={viewMode}
                exclusive
                onChange={(e, value) => value && onViewModeChange(value)}
                size="small"
                sx={{
                  '& .MuiToggleButton-root': {
                    borderRadius: 0,
                    textTransform: 'none',
                    px: 2
                  }
                }}
              >
                {viewModeOptions.map(option => (
                  <ToggleButton key={option.value} value={option.value}>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      {option.icon}
                      {!isMobile && (
                        <Typography variant="body2">{option.label}</Typography>
                      )}
                    </Stack>
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
              
              {/* Category Filters */}
              {showCategories && categories.length > 0 && (
                <Stack direction="row" spacing={1} flex={1} flexWrap="wrap">
                  {categories.map(category => (
                    <Chip
                      key={category.value}
                      label={category.label}
                      onClick={() => {
                        const newSelection = selectedCategories.includes(category.value)
                          ? selectedCategories.filter(c => c !== category.value)
                          : [...selectedCategories, category.value];
                        onCategoriesChange(newSelection);
                      }}
                      color={selectedCategories.includes(category.value) ? 'primary' : 'default'}
                      variant={selectedCategories.includes(category.value) ? 'filled' : 'outlined'}
                      size="small"
                      sx={{ borderRadius: '4px' }}
                    />
                  ))}
                </Stack>
              )}
              
              {/* Clear Filters */}
              {hasActiveFilters && (
                <Button
                  size="small"
                  onClick={() => {
                    onSearchChange('');
                    onDateRangeChange('all');
                    onCategoriesChange(['all']);
                  }}
                  startIcon={<ClearIcon />}
                  sx={{ 
                    ml: 'auto',
                    borderRadius: 0,
                    textTransform: 'none'
                  }}
                >
                  Clear
                </Button>
              )}
            </Stack>
            
            {/* Custom Filters */}
            {customFilters && (
              <Box>
                {customFilters}
              </Box>
            )}
          </Stack>
        </Box>
      </Collapse>
    </Box>
  );
};

export default ClinicalFilterPanel;