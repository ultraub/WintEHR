/**
 * Geographic Timeline Filter Component
 * Provides location-based filtering and provider organization filters for timeline events
 */
import React, { useState, useEffect } from 'react';
import {
  Paper,
  Typography,
  Box,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  TextField,
  Switch,
  FormControlLabel,
  Divider,
  Alert,
  Grid,
  Slider,
  Autocomplete
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  LocationOn as LocationIcon,
  Business as OrganizationIcon,
  Map as MapIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  MyLocation as MyLocationIcon,
  FilterList as FilterIcon
} from '@mui/icons-material';
import { useProviderDirectory } from '../../../../hooks/useProviderDirectory';

const GeographicTimelineFilter = ({ 
  filters, 
  onFiltersChange, 
  patientLocation,
  onLocationSearch,
  availableLocations = [],
  availableOrganizations = []
}) => {
  const [expanded, setExpanded] = useState(false);
  const [locationSearch, setLocationSearch] = useState('');
  const [nearbyProviders, setNearbyProviders] = useState([]);
  const [loadingNearby, setLoadingNearby] = useState(false);
  
  const { searchProvidersNearLocation, getOrganizationHierarchy } = useProviderDirectory();

  useEffect(() => {
    if (filters.useGeographicFilter && patientLocation) {
      loadNearbyProviders();
    }
  }, [filters.useGeographicFilter, patientLocation, filters.distanceKm]);

  const loadNearbyProviders = async () => {
    if (!patientLocation) return;
    
    setLoadingNearby(true);
    try {
      const providers = await searchProvidersNearLocation(
        patientLocation.latitude,
        patientLocation.longitude,
        filters.distanceKm || 25
      );
      setNearbyProviders(providers);
      
      // Auto-update organization filter if geographic filter is enabled
      if (filters.useGeographicFilter) {
        const nearbyOrganizations = [...new Set(
          providers.flatMap(p => p.organizations?.map(org => org.id)).filter(Boolean)
        )];
        
        onFiltersChange({
          ...filters,
          organizations: nearbyOrganizations
        });
      }
    } catch (error) {
      // Error loading nearby providers - geographic filter will be unavailable
    } finally {
      setLoadingNearby(false);
    }
  };

  const handleFilterChange = (key, value) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  const handleGeographicToggle = (enabled) => {
    if (enabled && !patientLocation) {
      // Request patient location
      if (onLocationSearch) {
        onLocationSearch();
      }
      return;
    }
    
    handleFilterChange('useGeographicFilter', enabled);
    
    if (!enabled) {
      // Clear geographic-related filters
      handleFilterChange('organizations', []);
      handleFilterChange('distanceKm', 25);
    }
  };

  const handleLocationSelect = (location) => {
    if (location && onLocationSearch) {
      onLocationSearch(location);
    }
  };

  const clearFilters = () => {
    onFiltersChange({
      useGeographicFilter: false,
      organizations: [],
      locations: [],
      distanceKm: 25,
      providers: [],
      encounterTypes: []
    });
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.organizations?.length) count++;
    if (filters.locations?.length) count++;
    if (filters.providers?.length) count++;
    if (filters.encounterTypes?.length) count++;
    if (filters.useGeographicFilter) count++;
    return count;
  };

  return (
    <Paper sx={{ mb: 2 }}>
      <Accordion expanded={expanded} onChange={() => setExpanded(!expanded)}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
            <FilterIcon />
            <Typography variant="subtitle2">
              Geographic & Administrative Filters
            </Typography>
            {getActiveFilterCount() > 0 && (
              <Chip
                label={`${getActiveFilterCount()} active`}
                size="small"
                color="primary"
              />
            )}
          </Box>
        </AccordionSummary>
        
        <AccordionDetails>
          <Stack spacing={3}>
            {/* Geographic Filter Toggle */}
            <Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={filters.useGeographicFilter || false}
                    onChange={(e) => handleGeographicToggle(e.target.checked)}
                  />
                }
                label="Filter by Geographic Proximity"
              />
              <Typography variant="caption" color="text.secondary" display="block">
                Show only events from providers near the patient's location
              </Typography>
            </Box>

            {/* Geographic Settings */}
            {filters.useGeographicFilter && (
              <Box sx={{ pl: 2, borderLeft: 2, borderColor: 'primary.main' }}>
                <Stack spacing={2}>
                  {/* Patient Location Status */}
                  {patientLocation ? (
                    <Alert severity="success" size="small">
                      <Typography variant="body2">
                        Patient location: {patientLocation.address || 'Coordinates available'}
                      </Typography>
                    </Alert>
                  ) : (
                    <Alert severity="warning" size="small">
                      <Typography variant="body2">
                        Patient location not available. Geographic filtering disabled.
                      </Typography>
                    </Alert>
                  )}

                  {/* Distance Slider */}
                  {patientLocation && (
                    <Box>
                      <Typography variant="body2" gutterBottom>
                        Distance Radius: {filters.distanceKm || 25} km
                      </Typography>
                      <Slider
                        value={filters.distanceKm || 25}
                        onChange={(e, value) => handleFilterChange('distanceKm', value)}
                        min={5}
                        max={100}
                        step={5}
                        marks={[
                          { value: 5, label: '5km' },
                          { value: 25, label: '25km' },
                          { value: 50, label: '50km' },
                          { value: 100, label: '100km' }
                        ]}
                        valueLabelDisplay="auto"
                      />
                    </Box>
                  )}

                  {/* Nearby Providers Summary */}
                  {nearbyProviders.length > 0 && (
                    <Box>
                      <Typography variant="body2" color="primary" gutterBottom>
                        Found {nearbyProviders.length} providers within {filters.distanceKm || 25}km
                      </Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        {nearbyProviders.slice(0, 3).map(provider => (
                          <Chip
                            key={provider.id}
                            label={provider.displayName}
                            size="small"
                            variant="outlined"
                            icon={<LocationIcon />}
                          />
                        ))}
                        {nearbyProviders.length > 3 && (
                          <Chip
                            label={`+${nearbyProviders.length - 3} more`}
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </Stack>
                    </Box>
                  )}
                </Stack>
              </Box>
            )}

            <Divider />

            {/* Organization Filter */}
            <FormControl fullWidth>
              <InputLabel>Healthcare Organizations</InputLabel>
              <Select
                multiple
                value={filters.organizations || []}
                onChange={(e) => handleFilterChange('organizations', e.target.value)}
                label="Healthcare Organizations"
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value) => {
                      const org = availableOrganizations.find(o => o.id === value);
                      return (
                        <Chip
                          key={value}
                          label={org?.name || value}
                          size="small"
                          icon={<OrganizationIcon />}
                        />
                      );
                    })}
                  </Box>
                )}
              >
                {availableOrganizations.map((org) => (
                  <MenuItem key={org.id} value={org.id}>
                    <OrganizationIcon sx={{ mr: 1 }} />
                    {org.name}
                    {org.type && (
                      <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                        ({org.type})
                      </Typography>
                    )}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Location Filter */}
            <FormControl fullWidth>
              <InputLabel>Care Locations</InputLabel>
              <Select
                multiple
                value={filters.locations || []}
                onChange={(e) => handleFilterChange('locations', e.target.value)}
                label="Care Locations"
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value) => {
                      const location = availableLocations.find(l => l.id === value);
                      return (
                        <Chip
                          key={value}
                          label={location?.name || value}
                          size="small"
                          icon={<LocationIcon />}
                        />
                      );
                    })}
                  </Box>
                )}
              >
                {availableLocations.map((location) => (
                  <MenuItem key={location.id} value={location.id}>
                    <LocationIcon sx={{ mr: 1 }} />
                    {location.name}
                    {location.address && (
                      <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                        {location.address.city}
                      </Typography>
                    )}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Provider Type Filter */}
            <FormControl fullWidth>
              <InputLabel>Provider Types</InputLabel>
              <Select
                multiple
                value={filters.providerTypes || []}
                onChange={(e) => handleFilterChange('providerTypes', e.target.value)}
                label="Provider Types"
              >
                <MenuItem value="primary-care">Primary Care</MenuItem>
                <MenuItem value="specialist">Specialist</MenuItem>
                <MenuItem value="emergency">Emergency Medicine</MenuItem>
                <MenuItem value="hospitalist">Hospitalist</MenuItem>
                <MenuItem value="nursing">Nursing</MenuItem>
                <MenuItem value="pharmacy">Pharmacy</MenuItem>
                <MenuItem value="radiology">Radiology</MenuItem>
                <MenuItem value="laboratory">Laboratory</MenuItem>
              </Select>
            </FormControl>

            {/* Encounter Type Filter */}
            <FormControl fullWidth>
              <InputLabel>Encounter Types</InputLabel>
              <Select
                multiple
                value={filters.encounterTypes || []}
                onChange={(e) => handleFilterChange('encounterTypes', e.target.value)}
                label="Encounter Types"
              >
                <MenuItem value="AMB">Ambulatory</MenuItem>
                <MenuItem value="IMP">Inpatient</MenuItem>
                <MenuItem value="EMER">Emergency</MenuItem>
                <MenuItem value="HH">Home Health</MenuItem>
                <MenuItem value="VR">Virtual</MenuItem>
              </Select>
            </FormControl>

            {/* Action Buttons */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 2 }}>
              <Button
                variant="outlined"
                startIcon={<ClearIcon />}
                onClick={clearFilters}
                disabled={getActiveFilterCount() === 0}
              >
                Clear Filters
              </Button>
              
              <Button
                variant="outlined"
                startIcon={<MyLocationIcon />}
                onClick={() => onLocationSearch && onLocationSearch()}
                disabled={!!patientLocation}
              >
                {patientLocation ? 'Location Set' : 'Set Patient Location'}
              </Button>
            </Box>

            {/* Filter Summary */}
            {getActiveFilterCount() > 0 && (
              <Alert severity="info" size="small">
                <Typography variant="body2">
                  Timeline filtered by {getActiveFilterCount()} criteria. 
                  {filters.useGeographicFilter && patientLocation && 
                    ` Showing events within ${filters.distanceKm || 25}km of patient location.`
                  }
                </Typography>
              </Alert>
            )}
          </Stack>
        </AccordionDetails>
      </Accordion>
    </Paper>
  );
};

export default GeographicTimelineFilter;