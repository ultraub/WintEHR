/**
 * Advanced Document Search Component
 * Enhanced FHIR R4 DocumentReference search with full parameter support
 */
import React, { useState, useEffect } from 'react';
import {
  Paper,
  Typography,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  Box,
  Chip,
  Stack,
  Autocomplete,
  DatePicker,
  Collapse,
  IconButton,
  Alert
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  FilterList as FilterIcon,
  TuneIcon
} from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker as MuiDatePicker } from '@mui/x-date-pickers/DatePicker';
import { fhirClient } from '../../../../services/fhirClient';

// FHIR R4 DocumentReference categories
const DOCUMENT_CATEGORIES = [
  { code: 'clinical-note', display: 'Clinical Note', system: 'http://hl7.org/fhir/us/core/CodeSystem/us-core-documentreference-category' },
  { code: 'discharge-summary', display: 'Discharge Summary', system: 'http://loinc.org' },
  { code: 'consultation', display: 'Consultation', system: 'http://loinc.org' },
  { code: 'progress-note', display: 'Progress Note', system: 'http://loinc.org' },
  { code: 'procedure-note', display: 'Procedure Note', system: 'http://loinc.org' },
  { code: 'imaging-report', display: 'Imaging Report', system: 'http://loinc.org' },
  { code: 'laboratory-report', display: 'Laboratory Report', system: 'http://loinc.org' }
];

// Security labels for document access control
const SECURITY_LABELS = [
  { code: 'N', display: 'Normal', system: 'http://terminology.hl7.org/CodeSystem/v3-Confidentiality' },
  { code: 'R', display: 'Restricted', system: 'http://terminology.hl7.org/CodeSystem/v3-Confidentiality' },
  { code: 'V', display: 'Very Restricted', system: 'http://terminology.hl7.org/CodeSystem/v3-Confidentiality' },
  { code: 'M', display: 'Moderate', system: 'http://terminology.hl7.org/CodeSystem/v3-Confidentiality' }
];

// Relationship types
const RELATIONSHIP_TYPES = [
  { code: 'replaces', display: 'Replaces' },
  { code: 'transforms', display: 'Transforms' },
  { code: 'signs', display: 'Signs' },
  { code: 'appends', display: 'Appends' }
];

const AdvancedDocumentSearch = ({ 
  patientId, 
  onSearchResults, 
  onClose,
  initialFilters = {} 
}) => {
  const [searchParams, setSearchParams] = useState({
    category: initialFilters.category || '',
    facility: initialFilters.facility || '',
    periodStart: initialFilters.periodStart || null,
    periodEnd: initialFilters.periodEnd || null,
    securityLabel: initialFilters.securityLabel || '',
    relatesTo: initialFilters.relatesTo || '',
    relationshipType: initialFilters.relationshipType || '',
    author: initialFilters.author || '',
    status: initialFilters.status || '',
    docStatus: initialFilters.docStatus || '',
    contentType: initialFilters.contentType || '',
    textSearch: initialFilters.textSearch || ''
  });

  const [advanced, setAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [facilities, setFacilities] = useState([]);
  const [authors, setAuthors] = useState([]);
  const [savedSearches, setSavedSearches] = useState([]);

  useEffect(() => {
    loadFacilities();
    loadAuthors();
    loadSavedSearches();
  }, []);

  const loadFacilities = async () => {
    try {
      const response = await fhirClient.search('Organization', {
        type: 'prov',
        _count: 100
      });
      setFacilities(response.resources || []);
    } catch (error) {
      console.error('Failed to load facilities:', error);
    }
  };

  const loadAuthors = async () => {
    try {
      const response = await fhirClient.search('Practitioner', {
        _count: 100
      });
      setAuthors(response.resources || []);
    } catch (error) {
      console.error('Failed to load authors:', error);
    }
  };

  const loadSavedSearches = async () => {
    // Load user's saved searches from local storage or API
    const saved = localStorage.getItem('documentSearches');
    if (saved) {
      setSavedSearches(JSON.parse(saved));
    }
  };

  const buildSearchParameters = () => {
    const params = {
      patient: patientId,
      _sort: '-date',
      _count: 1000
    };

    // Category search
    if (searchParams.category) {
      const category = DOCUMENT_CATEGORIES.find(c => c.code === searchParams.category);
      if (category) {
        params.category = `${category.system}|${category.code}`;
      }
    }

    // Facility search
    if (searchParams.facility) {
      params.facility = searchParams.facility;
    }

    // Period search
    if (searchParams.periodStart || searchParams.periodEnd) {
      if (searchParams.periodStart && searchParams.periodEnd) {
        params.period = `ge${searchParams.periodStart.toISOString().split('T')[0]}&period=le${searchParams.periodEnd.toISOString().split('T')[0]}`;
      } else if (searchParams.periodStart) {
        params.period = `ge${searchParams.periodStart.toISOString().split('T')[0]}`;
      } else if (searchParams.periodEnd) {
        params.period = `le${searchParams.periodEnd.toISOString().split('T')[0]}`;
      }
    }

    // Security label search
    if (searchParams.securityLabel) {
      const security = SECURITY_LABELS.find(s => s.code === searchParams.securityLabel);
      if (security) {
        params['security-label'] = `${security.system}|${security.code}`;
      }
    }

    // Related document search
    if (searchParams.relatesTo && searchParams.relationshipType) {
      params['relatesto:type'] = searchParams.relationshipType;
      params['relatesto:target'] = searchParams.relatesTo;
    }

    // Author search
    if (searchParams.author) {
      params.author = searchParams.author;
    }

    // Status filters
    if (searchParams.status) {
      params.status = searchParams.status;
    }

    if (searchParams.docStatus) {
      params.docstatus = searchParams.docStatus;
    }

    // Content type filter
    if (searchParams.contentType) {
      params.contenttype = searchParams.contentType;
    }

    // Text search (if supported by server)
    if (searchParams.textSearch) {
      params._text = searchParams.textSearch;
    }

    return params;
  };

  const handleSearch = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = buildSearchParameters();
      const response = await fhirClient.search('DocumentReference', params);
      
      onSearchResults({
        resources: response.resources || [],
        total: response.total || 0,
        searchParams: params
      });

    } catch (err) {
      setError(`Search failed: ${err.message}`);
      console.error('Document search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setSearchParams({
      category: '',
      facility: '',
      periodStart: null,
      periodEnd: null,
      securityLabel: '',
      relatesTo: '',
      relationshipType: '',
      author: '',
      status: '',
      docStatus: '',
      contentType: '',
      textSearch: ''
    });
    setError(null);
  };

  const handleSaveSearch = () => {
    const searchName = prompt('Enter a name for this search:');
    if (searchName) {
      const newSearch = {
        id: Date.now(),
        name: searchName,
        params: searchParams,
        created: new Date().toISOString()
      };
      
      const updated = [...savedSearches, newSearch];
      setSavedSearches(updated);
      localStorage.setItem('documentSearches', JSON.stringify(updated));
    }
  };

  const handleLoadSearch = (search) => {
    setSearchParams(search.params);
  };

  const getActiveFilterCount = () => {
    return Object.values(searchParams).filter(value => 
      value && value !== '' && value !== null
    ).length;
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Paper sx={{ p: 3, mb: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FilterIcon />
            Advanced Document Search
            {getActiveFilterCount() > 0 && (
              <Chip 
                label={`${getActiveFilterCount()} filters`} 
                size="small" 
                color="primary" 
              />
            )}
          </Typography>
          <Stack direction="row" spacing={1}>
            <IconButton onClick={() => setAdvanced(!advanced)}>
              <TuneIcon />
            </IconButton>
            <Button 
              variant="outlined" 
              onClick={handleClear}
              startIcon={<ClearIcon />}
              size="small"
            >
              Clear
            </Button>
          </Stack>
        </Stack>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Grid container spacing={2}>
          {/* Basic search parameters */}
          <Grid item xs={12} md={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Category</InputLabel>
              <Select
                value={searchParams.category}
                onChange={(e) => setSearchParams({
                  ...searchParams,
                  category: e.target.value
                })}
                label="Category"
              >
                <MenuItem value="">All Categories</MenuItem>
                {DOCUMENT_CATEGORIES.map(category => (
                  <MenuItem key={category.code} value={category.code}>
                    {category.display}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select
                value={searchParams.status}
                onChange={(e) => setSearchParams({
                  ...searchParams,
                  status: e.target.value
                })}
                label="Status"
              >
                <MenuItem value="">All Status</MenuItem>
                <MenuItem value="current">Current</MenuItem>
                <MenuItem value="superseded">Superseded</MenuItem>
                <MenuItem value="entered-in-error">Entered in Error</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Document Status</InputLabel>
              <Select
                value={searchParams.docStatus}
                onChange={(e) => setSearchParams({
                  ...searchParams,
                  docStatus: e.target.value
                })}
                label="Document Status"
              >
                <MenuItem value="">All Document Status</MenuItem>
                <MenuItem value="preliminary">Preliminary</MenuItem>
                <MenuItem value="final">Final</MenuItem>
                <MenuItem value="amended">Amended</MenuItem>
                <MenuItem value="entered-in-error">Entered in Error</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          {/* Date range */}
          <Grid item xs={12} md={6}>
            <MuiDatePicker
              label="Period Start"
              value={searchParams.periodStart}
              onChange={(newValue) => setSearchParams({
                ...searchParams,
                periodStart: newValue
              })}
              renderInput={(params) => <TextField {...params} size="small" fullWidth />}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <MuiDatePicker
              label="Period End"
              value={searchParams.periodEnd}
              onChange={(newValue) => setSearchParams({
                ...searchParams,
                periodEnd: newValue
              })}
              renderInput={(params) => <TextField {...params} size="small" fullWidth />}
            />
          </Grid>

          {/* Text search */}
          <Grid item xs={12}>
            <TextField
              fullWidth
              size="small"
              label="Text Search"
              value={searchParams.textSearch}
              onChange={(e) => setSearchParams({
                ...searchParams,
                textSearch: e.target.value
              })}
              placeholder="Search in document content..."
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'action.active' }} />
              }}
            />
          </Grid>
        </Grid>

        {/* Advanced parameters */}
        <Collapse in={advanced}>
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Advanced Filters
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Autocomplete
                  size="small"
                  options={facilities}
                  getOptionLabel={(option) => option.name || option.id}
                  value={facilities.find(f => f.id === searchParams.facility) || null}
                  onChange={(_, newValue) => setSearchParams({
                    ...searchParams,
                    facility: newValue?.id || ''
                  })}
                  renderInput={(params) => (
                    <TextField {...params} label="Facility" />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Autocomplete
                  size="small"
                  options={authors}
                  getOptionLabel={(option) => {
                    const name = option.name?.[0];
                    return name ? `${name.family}, ${name.given?.join(' ') || ''}` : option.id;
                  }}
                  value={authors.find(a => a.id === searchParams.author) || null}
                  onChange={(_, newValue) => setSearchParams({
                    ...searchParams,
                    author: newValue?.id || ''
                  })}
                  renderInput={(params) => (
                    <TextField {...params} label="Author" />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Security Label</InputLabel>
                  <Select
                    value={searchParams.securityLabel}
                    onChange={(e) => setSearchParams({
                      ...searchParams,
                      securityLabel: e.target.value
                    })}
                    label="Security Label"
                  >
                    <MenuItem value="">All Security Levels</MenuItem>
                    {SECURITY_LABELS.map(label => (
                      <MenuItem key={label.code} value={label.code}>
                        {label.display}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Content Type</InputLabel>
                  <Select
                    value={searchParams.contentType}
                    onChange={(e) => setSearchParams({
                      ...searchParams,
                      contentType: e.target.value
                    })}
                    label="Content Type"
                  >
                    <MenuItem value="">All Content Types</MenuItem>
                    <MenuItem value="text/plain">Plain Text</MenuItem>
                    <MenuItem value="text/html">HTML</MenuItem>
                    <MenuItem value="application/pdf">PDF</MenuItem>
                    <MenuItem value="application/xml">XML</MenuItem>
                    <MenuItem value="application/json">JSON</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Document relationships */}
              <Grid item xs={12} md={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Relationship Type</InputLabel>
                  <Select
                    value={searchParams.relationshipType}
                    onChange={(e) => setSearchParams({
                      ...searchParams,
                      relationshipType: e.target.value
                    })}
                    label="Relationship Type"
                  >
                    <MenuItem value="">No Relationship Filter</MenuItem>
                    {RELATIONSHIP_TYPES.map(type => (
                      <MenuItem key={type.code} value={type.code}>
                        {type.display}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Related Document ID"
                  value={searchParams.relatesTo}
                  onChange={(e) => setSearchParams({
                    ...searchParams,
                    relatesTo: e.target.value
                  })}
                  placeholder="Enter document ID..."
                  disabled={!searchParams.relationshipType}
                />
              </Grid>
            </Grid>
          </Box>
        </Collapse>

        {/* Saved searches */}
        {savedSearches.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Saved Searches
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {savedSearches.map(search => (
                <Chip
                  key={search.id}
                  label={search.name}
                  onClick={() => handleLoadSearch(search)}
                  onDelete={() => {
                    const updated = savedSearches.filter(s => s.id !== search.id);
                    setSavedSearches(updated);
                    localStorage.setItem('documentSearches', JSON.stringify(updated));
                  }}
                  variant="outlined"
                  size="small"
                />
              ))}
            </Stack>
          </Box>
        )}

        {/* Action buttons */}
        <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
          <Button
            variant="contained"
            onClick={handleSearch}
            startIcon={<SearchIcon />}
            disabled={loading}
          >
            {loading ? 'Searching...' : 'Search Documents'}
          </Button>
          
          <Button
            variant="outlined"
            onClick={handleSaveSearch}
            disabled={getActiveFilterCount() === 0}
          >
            Save Search
          </Button>

          {onClose && (
            <Button
              variant="text"
              onClick={onClose}
            >
              Close
            </Button>
          )}
        </Stack>

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
            <CircularProgress size={24} />
          </Box>
        )}
      </Paper>
    </LocalizationProvider>
  );
};

export default AdvancedDocumentSearch;