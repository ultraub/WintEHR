/**
 * ResourceSearchAutocomplete Component
 * Advanced autocomplete with caching, debouncing, and FHIR resource search
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Autocomplete,
  TextField,
  Box,
  Typography,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Avatar,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Popper,
  ClickAwayListener,
  Fade
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  Storage as CacheIcon,
  CloudOff as OfflineIcon
} from '@mui/icons-material';
import { useDebounce } from '../../hooks/useDebounce';

// Search result cache with TTL
class SearchCache {
  constructor(ttlMinutes = 5) {
    this.cache = new Map();
    this.ttl = ttlMinutes * 60 * 1000; // Convert to milliseconds
  }

  set(key, value) {
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }

  clear() {
    this.cache.clear();
  }

  size() {
    return this.cache.size;
  }

  cleanup() {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > this.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

// Global cache instance
const globalSearchCache = new SearchCache(5); // 5 minute TTL

const ResourceSearchAutocomplete = ({
  // Core props
  value,
  onChange,
  onBlur,
  
  // Search configuration
  searchService, // Function: (query, options) => Promise<results>
  resourceTypes = ['Patient'], // Array of resource types to search
  searchOptions = {}, // Additional search parameters
  
  // Cache configuration
  enableCache = true,
  cacheKey = 'default',
  cacheTTL = 5, // minutes
  
  // Debouncing
  debounceMs = 300,
  minQueryLength = 2,
  
  // Display configuration
  multiple = false,
  freeSolo = false,
  placeholder = 'Search resources...',
  label = 'Search',
  helperText = '',
  error = false,
  disabled = false,
  required = false,
  
  // Result formatting
  getOptionLabel = null, // Function to format option display
  getOptionKey = null, // Function to get unique key for option
  renderOption = null, // Custom option renderer
  groupBy = null, // Function to group results
  
  // UI customization
  showSearchIcon = true,
  showClearButton = true,
  showCacheStatus = false,
  showOfflineIndicator = true,
  
  // Callbacks
  onSearchStart = null,
  onSearchComplete = null,
  onSearchError = null,
  onCacheHit = null,
  
  ...otherProps
}) => {
  const [inputValue, setInputValue] = useState('');
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [cacheHits, setCacheHits] = useState(0);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  
  const debouncedInputValue = useDebounce(inputValue, debounceMs);
  const searchController = useRef(null);
  const localCache = useMemo(() => 
    enableCache ? new SearchCache(cacheTTL) : null, 
    [enableCache, cacheTTL]
  );

  // Use refs to store current values and prevent recreation
  const searchServiceRef = useRef(searchService);
  const resourceTypesRef = useRef(resourceTypes);
  const searchOptionsRef = useRef(searchOptions);

  // Update refs when props change
  useEffect(() => {
    searchServiceRef.current = searchService;
  }, [searchService]);

  useEffect(() => {
    resourceTypesRef.current = resourceTypes;
  }, [resourceTypes]);

  useEffect(() => {
    searchOptionsRef.current = searchOptions;
  }, [searchOptions]);

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Generate cache key - memoized to prevent recreation
  const generateCacheKey = useCallback((query, resTypes, options) => {
    return `${cacheKey}:${query}:${resTypes.join(',')}:${JSON.stringify(options)}`;
  }, [cacheKey]);

  // Default option label formatter
  const defaultGetOptionLabel = useCallback((option) => {
    if (typeof option === 'string') return option;
    
    // Try different display fields based on resource type
    const resourceType = option.resourceType?.toLowerCase();
    
    switch (resourceType) {
      case 'patient':
        const name = option.name?.[0];
        if (name) {
          const given = name.given?.join(' ') || '';
          const family = name.family || '';
          return `${given} ${family}`.trim() || option.id;
        }
        return option.id || 'Unknown Patient';
        
      case 'practitioner':
        const practName = option.name?.[0];
        if (practName) {
          const given = practName.given?.join(' ') || '';
          const family = practName.family || '';
          const prefix = practName.prefix?.join(' ') || '';
          return `${prefix} ${given} ${family}`.trim() || option.id;
        }
        return option.id || 'Unknown Practitioner';
        
      case 'organization':
        return option.name || option.id || 'Unknown Organization';
        
      case 'medication':
        return option.code?.text || 
               option.code?.coding?.[0]?.display || 
               option.id || 'Unknown Medication';
        
      default:
        return option.display || 
               option.name || 
               option.title || 
               option.code?.text ||
               option.id || 
               'Unknown Resource';
    }
  }, []);

  // Default option key generator
  const defaultGetOptionKey = useCallback((option) => {
    if (typeof option === 'string') return option;
    return `${option.resourceType || 'Unknown'}-${option.id || Math.random()}`;
  }, []);

  // Search function with caching and error handling
  const performSearch = useCallback(async (query) => {
    if (!query || query.length < minQueryLength || !searchServiceRef.current) {
      setOptions([]);
      return;
    }

    // Check cache first
    const searchCacheKey = generateCacheKey(query, resourceTypesRef.current, searchOptionsRef.current);
    
    if (enableCache) {
      const cachedResult = localCache?.get(searchCacheKey) || globalSearchCache.get(searchCacheKey);
      if (cachedResult) {
        setOptions(cachedResult);
        setCacheHits(prev => prev + 1);
        onCacheHit?.(cachedResult);
        return;
      }
    }

    // Cancel previous search
    if (searchController.current) {
      searchController.current.abort();
    }
    
    searchController.current = new AbortController();
    
    setLoading(true);
    setSearchError(null);
    onSearchStart?.(query);

    try {
      const results = await searchServiceRef.current(query, {
        resourceTypes: resourceTypesRef.current,
        signal: searchController.current.signal,
        ...searchOptionsRef.current
      });

      // Validate results
      const validResults = Array.isArray(results) ? results : [];
      
      setOptions(validResults);
      
      // Cache results
      if (enableCache && validResults.length > 0) {
        localCache?.set(searchCacheKey, validResults);
        globalSearchCache.set(searchCacheKey, validResults);
      }
      
      onSearchComplete?.(validResults);
      
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Search error:', error);
        setSearchError(error.message || 'Search failed');
        onSearchError?.(error);
        
        // In offline mode, try to get any cached results
        if (isOffline && enableCache) {
          const fallbackResults = localCache?.get(searchCacheKey) || [];
          setOptions(fallbackResults);
        }
      }
    } finally {
      setLoading(false);
      searchController.current = null;
    }
  }, [
    minQueryLength,
    enableCache,
    localCache,
    generateCacheKey,
    isOffline,
    onSearchStart,
    onSearchComplete,
    onSearchError,
    onCacheHit
  ]);

  // Effect to trigger search when debounced input changes
  useEffect(() => {
    performSearch(debouncedInputValue);
  }, [debouncedInputValue, performSearch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (searchController.current) {
        searchController.current.abort();
      }
    };
  }, []);

  // Handle input change
  const handleInputChange = (event, newInputValue) => {
    setInputValue(newInputValue);
  };

  // Default option renderer
  const defaultRenderOption = (props, option) => {
    const label = (getOptionLabel || defaultGetOptionLabel)(option);
    const key = (getOptionKey || defaultGetOptionKey)(option);
    
    return (
      <ListItem {...props} key={key} dense>
        <ListItemAvatar>
          <Avatar sx={{ width: 32, height: 32, fontSize: '0.875rem' }}>
            {option.resourceType?.[0]?.toUpperCase() || '?'}
          </Avatar>
        </ListItemAvatar>
        <ListItemText
          primary={label}
          secondary={
            <Stack direction="row" spacing={1} alignItems="center">
              {option.resourceType && (
                <Chip label={option.resourceType} size="small" variant="outlined" />
              )}
              {option.id && (
                <Typography variant="caption" color="text.secondary">
                  ID: {option.id}
                </Typography>
              )}
            </Stack>
          }
        />
      </ListItem>
    );
  };

  return (
    <Box>
      <Autocomplete
        value={value}
        onChange={onChange}
        inputValue={inputValue}
        onInputChange={handleInputChange}
        options={options}
        loading={loading}
        multiple={multiple}
        freeSolo={freeSolo}
        disabled={disabled}
        getOptionLabel={getOptionLabel || defaultGetOptionLabel}
        isOptionEqualToValue={(option, value) => {
          const optionKey = (getOptionKey || defaultGetOptionKey)(option);
          const valueKey = (getOptionKey || defaultGetOptionKey)(value);
          return optionKey === valueKey;
        }}
        groupBy={groupBy}
        renderOption={renderOption || defaultRenderOption}
        renderInput={(params) => (
          <TextField
            {...params}
            label={label}
            placeholder={placeholder}
            helperText={helperText}
            error={error || !!searchError}
            required={required}
            InputProps={{
              ...params.InputProps,
              startAdornment: showSearchIcon && (
                <SearchIcon color="action" sx={{ mr: 1 }} />
              ),
              endAdornment: (
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  {isOffline && showOfflineIndicator && (
                    <OfflineIcon color="warning" fontSize="small" />
                  )}
                  {showCacheStatus && cacheHits > 0 && (
                    <Chip 
                      icon={<CacheIcon />} 
                      label={cacheHits} 
                      size="small" 
                      variant="outlined" 
                    />
                  )}
                  {loading && <CircularProgress color="inherit" size={20} />}
                  {params.InputProps.endAdornment}
                </Stack>
              ),
            }}
            onBlur={onBlur}
          />
        )}
        PaperComponent={(props) => (
          <Paper {...props} elevation={8}>
            {searchError && (
              <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                <Typography variant="body2" color="error">
                  {searchError}
                </Typography>
              </Box>
            )}
            {props.children}
            {showCacheStatus && (
              <Box sx={{ p: 1, borderTop: 1, borderColor: 'divider', bgcolor: 'background.default' }}>
                <Typography variant="caption" color="text.secondary">
                  Cache: {localCache?.size() || 0} local, {globalSearchCache.size()} global
                  {cacheHits > 0 && ` • ${cacheHits} hits`}
                </Typography>
              </Box>
            )}
          </Paper>
        )}
        {...otherProps}
      />
    </Box>
  );
};

export default ResourceSearchAutocomplete;

// Export cache for external management
export { globalSearchCache };