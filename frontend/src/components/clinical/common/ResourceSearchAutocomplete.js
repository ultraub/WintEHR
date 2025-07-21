/**
 * ResourceSearchAutocomplete Component
 * 
 * A reusable autocomplete component for searching FHIR resources with:
 * - Dynamic search with debouncing
 * - Support for multiple resource types
 * - Clinical coding system integration
 * - Recent selections memory
 * - Keyboard navigation
 * - Loading states and error handling
 * 
 * @since 2025-01-20
 */

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Autocomplete,
  TextField,
  CircularProgress,
  Chip,
  Box,
  Typography,
  Paper,
  ListItem,
  ListItemText,
  ListItemIcon,
  InputAdornment,
  IconButton,
  Tooltip,
  Alert,
  Popper,
  ClickAwayListener,
  List,
  ListSubheader,
  Divider,
  Badge,
  alpha,
  useTheme
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  History as HistoryIcon,
  Favorite as FavoriteIcon,
  LocalOffer as TagIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  TrendingUp as TrendingIcon,
  Schedule as ScheduleIcon,
  LocalHospital as LocalHospitalIcon,
  Medication as MedicationIcon,
  Science as ScienceIcon,
  Assignment as AssignmentIcon,
  Healing as HealingIcon,
  Vaccines as VaccinesIcon,
  Biotech as BiotechIcon,
  MedicalServices as MedicalServicesIcon
} from '@mui/icons-material';
import debounce from 'lodash/debounce';
import { fhirClient } from '../../../core/fhir/services/fhirClient';
import catalogService from '../../../services/cdsClinicalDataService';

// Resource type configurations
const RESOURCE_CONFIGS = {
  MedicationRequest: {
    icon: <MedicationIcon />,
    color: '#2196F3',
    searchParams: ['code', 'medication.code', '_text'],
    displayField: (resource) => resource?.medicationCodeableConcept?.coding?.[0]?.display || 
                                resource?.medicationReference?.display || 'Unknown Medication',
    secondaryField: (resource) => resource?.medicationCodeableConcept?.coding?.[0]?.code || '',
    system: 'RxNorm'
  },
  Condition: {
    icon: <LocalHospitalIcon />,
    color: '#f44336',
    searchParams: ['code', 'clinical-status', '_text'],
    displayField: (resource) => resource?.code?.coding?.[0]?.display || 'Unknown Condition',
    secondaryField: (resource) => resource?.code?.coding?.[0]?.code || '',
    system: 'ICD-10'
  },
  Procedure: {
    icon: <HealingIcon />,
    color: '#9C27B0',
    searchParams: ['code', 'status', '_text'],
    displayField: (resource) => resource?.code?.coding?.[0]?.display || 'Unknown Procedure',
    secondaryField: (resource) => resource?.code?.coding?.[0]?.code || '',
    system: 'CPT'
  },
  Observation: {
    icon: <ScienceIcon />,
    color: '#4CAF50',
    searchParams: ['code', 'category', '_text'],
    displayField: (resource) => resource?.code?.coding?.[0]?.display || 'Unknown Observation',
    secondaryField: (resource) => {
      const value = resource?.valueQuantity?.value;
      const unit = resource?.valueQuantity?.unit;
      return value && unit ? `${value} ${unit}` : resource?.code?.coding?.[0]?.code || '';
    },
    system: 'LOINC'
  },
  ServiceRequest: {
    icon: <AssignmentIcon />,
    color: '#FF9800',
    searchParams: ['code', 'category', '_text'],
    displayField: (resource) => resource?.code?.coding?.[0]?.display || 'Unknown Service',
    secondaryField: (resource) => resource?.code?.coding?.[0]?.code || '',
    system: 'LOINC'
  },
  Immunization: {
    icon: <VaccinesIcon />,
    color: '#00BCD4',
    searchParams: ['vaccine-code', 'status', '_text'],
    displayField: (resource) => resource?.vaccineCode?.coding?.[0]?.display || 'Unknown Vaccine',
    secondaryField: (resource) => resource?.vaccineCode?.coding?.[0]?.code || '',
    system: 'CVX'
  },
  AllergyIntolerance: {
    icon: <WarningIcon />,
    color: '#FF5722',
    searchParams: ['code', 'clinical-status', '_text'],
    displayField: (resource) => resource?.code?.coding?.[0]?.display || 'Unknown Allergen',
    secondaryField: (resource) => resource?.reaction?.[0]?.manifestation?.[0]?.coding?.[0]?.display || '',
    system: 'SNOMED'
  },
  DiagnosticReport: {
    icon: <BiotechIcon />,
    color: '#673AB7',
    searchParams: ['code', 'status', '_text'],
    displayField: (resource) => resource?.code?.coding?.[0]?.display || 'Unknown Report',
    secondaryField: (resource) => resource?.code?.coding?.[0]?.code || '',
    system: 'LOINC'
  }
};

// Storage keys for recent selections
const STORAGE_PREFIX = 'emr_resource_search_';

const ResourceSearchAutocomplete = ({
  resourceType,
  value,
  onChange,
  onInputChange,
  label = 'Search',
  placeholder = 'Type to search...',
  multiple = false,
  required = false,
  disabled = false,
  patientId = null,
  includePatientResources = true,
  includeCatalog = true,
  maxResults = 20,
  minSearchLength = 2,
  debounceMs = 300,
  showRecent = true,
  showFavorites = true,
  showTrending = true,
  onError,
  ...autocompleteProps
}) => {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [recentSelections, setRecentSelections] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const searchRef = useRef(null);
  const abortControllerRef = useRef(null);

  const config = RESOURCE_CONFIGS[resourceType] || {
    icon: <MedicalServicesIcon />,
    color: theme.palette.primary.main,
    searchParams: ['_text'],
    displayField: (r) => r?.id || 'Unknown',
    secondaryField: () => '',
    system: ''
  };

  // Load recent selections and favorites from localStorage
  useEffect(() => {
    if (showRecent) {
      const stored = localStorage.getItem(`${STORAGE_PREFIX}recent_${resourceType}`);
      if (stored) {
        try {
          setRecentSelections(JSON.parse(stored));
        } catch (e) {
          console.error('Failed to parse recent selections:', e);
        }
      }
    }

    if (showFavorites) {
      const stored = localStorage.getItem(`${STORAGE_PREFIX}favorites_${resourceType}`);
      if (stored) {
        try {
          setFavorites(JSON.parse(stored));
        } catch (e) {
          console.error('Failed to parse favorites:', e);
        }
      }
    }
  }, [resourceType, showRecent, showFavorites]);

  // Save recent selection
  const saveRecentSelection = useCallback((selection) => {
    if (!showRecent) return;

    const recent = [...recentSelections];
    const existingIndex = recent.findIndex(r => r.id === selection.id);
    
    if (existingIndex > -1) {
      recent.splice(existingIndex, 1);
    }
    
    recent.unshift(selection);
    const trimmed = recent.slice(0, 5); // Keep only 5 most recent
    
    setRecentSelections(trimmed);
    localStorage.setItem(`${STORAGE_PREFIX}recent_${resourceType}`, JSON.stringify(trimmed));
  }, [recentSelections, resourceType, showRecent]);

  // Toggle favorite
  const toggleFavorite = useCallback((resource) => {
    const newFavorites = [...favorites];
    const existingIndex = newFavorites.findIndex(f => f.id === resource.id);
    
    if (existingIndex > -1) {
      newFavorites.splice(existingIndex, 1);
    } else {
      newFavorites.push(resource);
    }
    
    setFavorites(newFavorites);
    localStorage.setItem(`${STORAGE_PREFIX}favorites_${resourceType}`, JSON.stringify(newFavorites));
  }, [favorites, resourceType]);

  // Search function
  const performSearch = useCallback(async (searchText) => {
    if (!searchText || searchText.length < minSearchLength) {
      setOptions([]);
      return;
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    
    setLoading(true);
    setError(null);

    try {
      const searchOptions = [];

      // Search in patient resources if enabled
      if (includePatientResources && patientId) {
        try {
          const params = {
            patient: patientId,
            _count: maxResults,
            _sort: '-_lastUpdated'
          };

          // Add text search
          if (searchText) {
            params._text = searchText;
          }

          const result = await fhirClient.search(resourceType, params);

          if (result.resources && result.resources.length > 0) {
            result.resources.forEach(resource => {
              searchOptions.push({
                ...resource,
                source: 'patient',
                display: config.displayField(resource),
                secondary: config.secondaryField(resource)
              });
            });
          }
        } catch (err) {
          if (err.name !== 'AbortError') {
            console.error('Patient resource search error:', err);
          }
        }
      }

      // Search in catalog if enabled
      if (includeCatalog) {
        try {
          let catalogItems = [];

          switch (resourceType) {
            case 'MedicationRequest':
              catalogItems = await catalogService.getMedicationCatalog();
              break;
            case 'Observation':
              catalogItems = await catalogService.getLabCatalog();
              break;
            case 'Procedure':
              catalogItems = await catalogService.getProcedureCatalog();
              break;
            case 'ServiceRequest':
              const labs = await catalogService.getLabCatalog();
              const procedures = await catalogService.getProcedureCatalog();
              catalogItems = [...labs, ...procedures];
              break;
            default:
              catalogItems = [];
          }

          // Filter catalog items
          const filtered = catalogItems.filter(item => {
            const searchLower = searchText.toLowerCase();
            return (
              item.display?.toLowerCase().includes(searchLower) ||
              item.code?.toLowerCase().includes(searchLower)
            );
          }).slice(0, maxResults);

          filtered.forEach(item => {
            searchOptions.push({
              id: `catalog_${item.code}`,
              code: {
                coding: [{
                  system: item.system || config.system,
                  code: item.code,
                  display: item.display
                }]
              },
              source: 'catalog',
              display: item.display,
              secondary: item.code,
              frequency: item.frequency || 0
            });
          });
        } catch (err) {
          console.error('Catalog search error:', err);
        }
      }

      // Sort by relevance (favorites first, then frequency)
      searchOptions.sort((a, b) => {
        const aIsFavorite = favorites.some(f => f.id === a.id);
        const bIsFavorite = favorites.some(f => f.id === b.id);
        
        if (aIsFavorite && !bIsFavorite) return -1;
        if (!aIsFavorite && bIsFavorite) return 1;
        
        return (b.frequency || 0) - (a.frequency || 0);
      });

      setOptions(searchOptions);
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message);
        if (onError) onError(err);
      }
    } finally {
      setLoading(false);
    }
  }, [resourceType, patientId, includePatientResources, includeCatalog, maxResults, minSearchLength, config, favorites, onError]);

  // Debounced search
  const debouncedSearch = useMemo(
    () => debounce(performSearch, debounceMs),
    [performSearch, debounceMs]
  );

  // Handle input change
  const handleInputChange = useCallback((event, newValue) => {
    setInputValue(newValue);
    if (onInputChange) {
      onInputChange(event, newValue);
    }
    debouncedSearch(newValue);
  }, [debouncedSearch, onInputChange]);

  // Handle value change
  const handleChange = useCallback((event, newValue) => {
    if (onChange) {
      onChange(event, newValue);
    }
    
    // Save to recent selections
    if (newValue && !multiple) {
      saveRecentSelection(newValue);
    } else if (newValue && multiple && newValue.length > 0) {
      const latest = newValue[newValue.length - 1];
      saveRecentSelection(latest);
    }
  }, [onChange, multiple, saveRecentSelection]);

  // Render option
  const renderOption = useCallback((props, option) => {
    const isFavorite = favorites.some(f => f.id === option.id);
    const isRecent = recentSelections.some(r => r.id === option.id);
    
    return (
      <ListItem {...props} sx={{ py: 1 }}>
        <ListItemIcon sx={{ minWidth: 40 }}>
          <Badge
            invisible={!isRecent && !isFavorite}
            badgeContent={
              isFavorite ? <FavoriteIcon sx={{ fontSize: 12 }} /> :
              isRecent ? <HistoryIcon sx={{ fontSize: 12 }} /> : null
            }
            sx={{
              '& .MuiBadge-badge': {
                right: -3,
                top: 3,
                backgroundColor: isFavorite ? '#f50057' : '#ff9800'
              }
            }}
          >
            <Box
              sx={{
                color: config.color,
                display: 'flex',
                alignItems: 'center'
              }}
            >
              {config.icon}
            </Box>
          </Badge>
        </ListItemIcon>
        <ListItemText
          primary={option.display}
          secondary={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {option.secondary && (
                <Typography variant="caption" color="text.secondary">
                  {option.secondary}
                </Typography>
              )}
              {option.source === 'catalog' && (
                <Chip
                  label="Catalog"
                  size="small"
                  sx={{ height: 16, fontSize: '0.65rem' }}
                />
              )}
              {option.frequency > 10 && showTrending && (
                <Tooltip title={`Used ${option.frequency} times`}>
                  <TrendingIcon sx={{ fontSize: 14, color: 'warning.main' }} />
                </Tooltip>
              )}
            </Box>
          }
        />
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(option);
          }}
          sx={{ ml: 'auto' }}
        >
          <FavoriteIcon
            sx={{
              fontSize: 18,
              color: isFavorite ? 'error.main' : 'action.disabled'
            }}
          />
        </IconButton>
      </ListItem>
    );
  }, [config, favorites, recentSelections, showTrending, toggleFavorite]);

  // Group options by source
  const groupBy = useCallback((option) => {
    if (favorites.some(f => f.id === option.id)) return 'Favorites';
    if (recentSelections.some(r => r.id === option.id)) return 'Recent';
    if (option.source === 'catalog') return 'Catalog';
    return 'Patient Resources';
  }, [favorites, recentSelections]);

  // Render group header
  const renderGroup = useCallback((params) => (
    <Box key={params.key}>
      <ListSubheader
        sx={{
          backgroundColor: alpha(theme.palette.primary.main, 0.08),
          lineHeight: '32px',
          fontSize: '0.75rem',
          fontWeight: 600
        }}
      >
        {params.group}
      </ListSubheader>
      {params.children}
      <Divider />
    </Box>
  ), [theme]);

  // Custom popper with enhanced styling
  const CustomPopper = useCallback((props) => (
    <Popper
      {...props}
      placement="bottom-start"
      modifiers={[
        {
          name: 'offset',
          options: {
            offset: [0, 8],
          },
        },
      ]}
    >
      <Paper
        elevation={8}
        sx={{
          mt: 1,
          maxHeight: 400,
          overflow: 'auto',
          minWidth: 400,
          '& .MuiAutocomplete-listbox': {
            p: 0
          }
        }}
      >
        {props.children}
      </Paper>
    </Popper>
  ), []);

  return (
    <Box>
      <Autocomplete
        ref={searchRef}
        open={open}
        onOpen={() => setOpen(true)}
        onClose={() => setOpen(false)}
        value={value}
        onChange={handleChange}
        inputValue={inputValue}
        onInputChange={handleInputChange}
        options={options}
        loading={loading}
        multiple={multiple}
        disabled={disabled}
        isOptionEqualToValue={(option, val) => option.id === val.id}
        getOptionLabel={(option) => option.display || ''}
        renderOption={renderOption}
        groupBy={showRecent || showFavorites ? groupBy : undefined}
        renderGroup={renderGroup}
        PopperComponent={CustomPopper}
        renderInput={(params) => (
          <TextField
            {...params}
            label={label}
            placeholder={placeholder}
            required={required}
            error={!!error}
            helperText={error}
            InputProps={{
              ...params.InputProps,
              startAdornment: (
                <>
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                  {params.InputProps.startAdornment}
                </>
              ),
              endAdornment: (
                <>
                  {loading && <CircularProgress color="inherit" size={20} />}
                  {params.InputProps.endAdornment}
                  {inputValue && !loading && (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        onClick={() => {
                          setInputValue('');
                          setOptions([]);
                          if (onChange) {
                            onChange(null, multiple ? [] : null);
                          }
                        }}
                      >
                        <ClearIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  )}
                </>
              ),
            }}
          />
        )}
        renderTags={(tagValue, getTagProps) => (
          tagValue.map((option, index) => (
            <Chip
              label={option.display}
              size="small"
              icon={config.icon}
              {...getTagProps({ index })}
              sx={{
                backgroundColor: alpha(config.color, 0.1),
                '& .MuiChip-icon': {
                  color: config.color
                }
              }}
            />
          ))
        )}
        noOptionsText={
          loading ? 'Searching...' :
          inputValue.length < minSearchLength ? `Type at least ${minSearchLength} characters` :
          'No results found'
        }
        {...autocompleteProps}
      />

      {/* Quick actions */}
      {(showRecent || showFavorites) && !inputValue && !open && (
        <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {showRecent && recentSelections.length > 0 && (
            <Chip
              label="Recent"
              size="small"
              icon={<HistoryIcon />}
              onClick={() => {
                setOptions(recentSelections);
                setOpen(true);
              }}
              sx={{ cursor: 'pointer' }}
            />
          )}
          {showFavorites && favorites.length > 0 && (
            <Chip
              label="Favorites"
              size="small"
              icon={<FavoriteIcon />}
              onClick={() => {
                setOptions(favorites);
                setOpen(true);
              }}
              sx={{ cursor: 'pointer' }}
            />
          )}
        </Box>
      )}
    </Box>
  );
};

export default ResourceSearchAutocomplete;