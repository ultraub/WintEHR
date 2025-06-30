/**
 * Order Catalog Selector Component
 * Searchable dropdown for medications, labs, and imaging
 */
import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Autocomplete,
  Chip,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Alert
} from '@mui/material';
import {
  LocalPharmacy as MedicationIcon,
  Science as LabIcon,
  Camera as ImagingIcon
} from '@mui/icons-material';
import api from '../../../services/api';

const OrderCatalogSelector = ({ orderType, onSelect, value }) => {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({});
  const [availableFilters, setAvailableFilters] = useState({});

  useEffect(() => {
    if (orderType) {
      loadOptions();
      loadFilters();
    }
  }, [orderType, searchTerm, filters]);

  const loadOptions = async () => {
    if (!orderType) return;

    setLoading(true);
    try {
      let endpoint = '';
      let params = { search: searchTerm };

      switch (orderType) {
        case 'medication':
          endpoint = '/api/catalogs/medications';
          if (filters.drug_class) params.drug_class = filters.drug_class;
          if (filters.formulary_only !== undefined) params.formulary_only = filters.formulary_only;
          break;
        case 'lab':
          endpoint = '/api/catalogs/lab-tests';
          if (filters.category) params.category = filters.category;
          if (filters.stat_only) params.stat_only = filters.stat_only;
          break;
        case 'imaging':
          endpoint = '/api/catalogs/imaging-studies';
          if (filters.modality) params.modality = filters.modality;
          if (filters.body_part) params.body_part = filters.body_part;
          break;
        default:
          return;
      }

      const response = await api.get(endpoint, { params });
      setOptions(response.data);
    } catch (error) {
      console.error('Error loading catalog options:', error);
      setOptions([]);
    } finally {
      setLoading(false);
    }
  };

  const loadFilters = async () => {
    try {
      let endpoints = [];
      
      switch (orderType) {
        case 'medication':
          endpoints.push({ key: 'drug_classes', url: '/api/catalogs/drug-classes' });
          break;
        case 'lab':
          endpoints.push({ key: 'test_categories', url: '/api/catalogs/test-categories' });
          break;
        case 'imaging':
          endpoints.push({ key: 'modalities', url: '/api/catalogs/imaging-modalities' });
          break;
      }

      const filterData = {};
      for (const endpoint of endpoints) {
        const response = await api.get(endpoint.url);
        filterData[endpoint.key] = response.data;
      }
      
      setAvailableFilters(filterData);
    } catch (error) {
      console.error('Error loading filter options:', error);
    }
  };

  const getOptionLabel = (option) => {
    switch (orderType) {
      case 'medication':
        return `${option.generic_name}${option.brand_name ? ` (${option.brand_name})` : ''} ${option.strength}`;
      case 'lab':
        return `${option.test_name}${option.test_code ? ` (${option.test_code})` : ''}`;
      case 'imaging':
        return `${option.study_name} - ${option.modality}`;
      default:
        return option.name || '';
    }
  };

  const getOptionDetails = (option) => {
    switch (orderType) {
      case 'medication':
        return (
          <Box>
            <Typography variant="body2" color="text.secondary">
              {option.drug_class} • {option.dosage_form} • {option.route}
            </Typography>
            {option.is_controlled_substance && (
              <Chip label={`Schedule ${option.controlled_substance_schedule}`} size="small" color="warning" />
            )}
            {option.requires_authorization && (
              <Chip label="Prior Auth Required" size="small" color="error" />
            )}
          </Box>
        );
      case 'lab':
        return (
          <Box>
            <Typography variant="body2" color="text.secondary">
              {option.test_category} • {option.specimen_type}
              {option.fasting_required && ' • Fasting Required'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Turnaround: {option.typical_turnaround_time}
            </Typography>
          </Box>
        );
      case 'imaging':
        return (
          <Box>
            <Typography variant="body2" color="text.secondary">
              {option.body_part} • {option.study_type}
              {option.contrast_required && ' • Contrast Required'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Duration: {option.typical_duration}
            </Typography>
          </Box>
        );
      default:
        return null;
    }
  };

  const getIcon = () => {
    switch (orderType) {
      case 'medication':
        return <MedicationIcon color="primary" />;
      case 'lab':
        return <LabIcon color="secondary" />;
      case 'imaging':
        return <ImagingIcon color="info" />;
      default:
        return null;
    }
  };

  const renderFilters = () => {
    switch (orderType) {
      case 'medication':
        return (
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Drug Class</InputLabel>
                <Select
                  value={filters.drug_class || ''}
                  label="Drug Class"
                  onChange={(e) => setFilters(prev => ({ ...prev, drug_class: e.target.value }))}
                >
                  <MenuItem value="">All Classes</MenuItem>
                  {availableFilters.drug_classes?.map(cls => (
                    <MenuItem key={cls} value={cls}>{cls}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Formulary</InputLabel>
                <Select
                  value={filters.formulary_only !== undefined ? filters.formulary_only : true}
                  label="Formulary"
                  onChange={(e) => setFilters(prev => ({ ...prev, formulary_only: e.target.value }))}
                >
                  <MenuItem value={true}>Formulary Only</MenuItem>
                  <MenuItem value={false}>All Medications</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        );
      case 'lab':
        return (
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Category</InputLabel>
                <Select
                  value={filters.category || ''}
                  label="Category"
                  onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
                >
                  <MenuItem value="">All Categories</MenuItem>
                  {availableFilters.test_categories?.map(cat => (
                    <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Urgency</InputLabel>
                <Select
                  value={filters.stat_only || false}
                  label="Urgency"
                  onChange={(e) => setFilters(prev => ({ ...prev, stat_only: e.target.value }))}
                >
                  <MenuItem value={false}>All Tests</MenuItem>
                  <MenuItem value={true}>STAT Available Only</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        );
      case 'imaging':
        return (
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel>Modality</InputLabel>
                <Select
                  value={filters.modality || ''}
                  label="Modality"
                  onChange={(e) => setFilters(prev => ({ ...prev, modality: e.target.value }))}
                >
                  <MenuItem value="">All Modalities</MenuItem>
                  {availableFilters.modalities?.map(mod => (
                    <MenuItem key={mod} value={mod}>{mod}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        );
      default:
        return null;
    }
  };

  if (!orderType) {
    return (
      <Alert severity="info">
        Please select an order type to choose from the catalog.
      </Alert>
    );
  }

  return (
    <Box>
      {renderFilters()}
      
      <Autocomplete
        options={options}
        value={value}
        loading={loading}
        getOptionLabel={getOptionLabel}
        onChange={(event, newValue) => onSelect(newValue)}
        renderInput={(params) => (
          <TextField
            {...params}
            label={`Search ${orderType}s`}
            variant="outlined"
            fullWidth
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              ...params.InputProps,
              startAdornment: (
                <Box sx={{ mr: 1, display: 'flex', alignItems: 'center' }}>
                  {getIcon()}
                </Box>
              ),
            }}
          />
        )}
        renderOption={(props, option) => (
          <Box component="li" {...props}>
            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
              <Box sx={{ mr: 2 }}>
                {getIcon()}
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body1">
                  {getOptionLabel(option)}
                </Typography>
                {getOptionDetails(option)}
              </Box>
            </Box>
          </Box>
        )}
        noOptionsText={searchTerm ? "No matching items found" : "Start typing to search..."}
        filterOptions={(x) => x} // We handle filtering on the server
        isOptionEqualToValue={(option, value) => option.id === value?.id}
      />
    </Box>
  );
};

export default OrderCatalogSelector;