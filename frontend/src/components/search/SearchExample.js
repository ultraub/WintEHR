/**
 * Search Example Component
 * Demonstrates usage of the ResourceSearchAutocomplete system
 */
import React, { useState } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Stack,
  Chip,
  Button
} from '@mui/material';
import ResourceSearchAutocomplete from './ResourceSearchAutocomplete';
import { useResourceSearch, usePatientSearch, usePractitionerSearch } from '../../hooks/useResourceSearch';
import { searchService } from '../../services/searchService';

const SearchExample = () => {
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [selectedPractitioner, setSelectedPractitioner] = useState(null);
  const [multipleResources, setMultipleResources] = useState([]);

  // Use specialized hooks
  const patientSearch = usePatientSearch();
  const practitionerSearch = usePractitionerSearch();
  const multiSearch = useResourceSearch({
    resourceTypes: ['Patient', 'Practitioner', 'Organization'],
    debounceMs: 400
  });

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Resource Search Examples
      </Typography>

      <Grid container spacing={3}>
        {/* Patient Search */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Patient Search
            </Typography>
            <ResourceSearchAutocomplete
              label="Search Patients"
              placeholder="Enter patient name..."
              searchService={patientSearch.searchService}
              resourceTypes={['Patient']}
              value={selectedPatient}
              onChange={(event, newValue) => setSelectedPatient(newValue)}
              showCacheStatus={true}
              helperText="Search by patient name"
            />
            
            {selectedPatient && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2">Selected Patient:</Typography>
                <Chip 
                  label={`${selectedPatient.name?.[0]?.given?.join(' ')} ${selectedPatient.name?.[0]?.family}`}
                  color="primary"
                  sx={{ mt: 1 }}
                />
              </Box>
            )}

            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Stats: {patientSearch.searchStats.totalSearches} searches, 
                {patientSearch.searchStats.cacheHits} cache hits
              </Typography>
            </Box>
          </Paper>
        </Grid>

        {/* Practitioner Search */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Practitioner Search
            </Typography>
            <ResourceSearchAutocomplete
              label="Search Practitioners"
              placeholder="Enter practitioner name..."
              searchService={practitionerSearch.searchService}
              resourceTypes={['Practitioner']}
              value={selectedPractitioner}
              onChange={(event, newValue) => setSelectedPractitioner(newValue)}
              showCacheStatus={true}
              helperText="Search by practitioner name"
            />
            
            {selectedPractitioner && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2">Selected Practitioner:</Typography>
                <Chip 
                  label={`${selectedPractitioner.name?.[0]?.prefix?.join(' ')} ${selectedPractitioner.name?.[0]?.given?.join(' ')} ${selectedPractitioner.name?.[0]?.family}`}
                  color="secondary"
                  sx={{ mt: 1 }}
                />
              </Box>
            )}

            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Recent searches: {practitionerSearch.recentSearches.length}
              </Typography>
            </Box>
          </Paper>
        </Grid>

        {/* Multi-Resource Search */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Multi-Resource Search
            </Typography>
            <ResourceSearchAutocomplete
              label="Search All Resources"
              placeholder="Search patients, practitioners, organizations..."
              searchService={multiSearch.searchService}
              resourceTypes={['Patient', 'Practitioner', 'Organization']}
              value={multipleResources}
              onChange={(event, newValue) => setMultipleResources(newValue)}
              multiple={true}
              showCacheStatus={true}
              groupBy={(option) => option.resourceType}
              helperText="Select multiple resources of different types"
            />
            
            {multipleResources.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2">Selected Resources:</Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
                  {multipleResources.map((resource, index) => (
                    <Chip 
                      key={index}
                      label={`${resource.resourceType}: ${resource.name?.[0]?.family || resource.name || resource.id}`}
                      color="info"
                      size="small"
                      sx={{ mb: 1 }}
                    />
                  ))}
                </Stack>
              </Box>
            )}

            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Global search metrics: Avg response time {multiSearch.searchStats.avgResponseTime.toFixed(0)}ms
              </Typography>
            </Box>
          </Paper>
        </Grid>

        {/* Search Analytics */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Search Analytics
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <Box textAlign="center">
                  <Typography variant="h4" color="primary">
                    {searchService.getMetrics().totalSearches}
                  </Typography>
                  <Typography variant="caption">Total Searches</Typography>
                </Box>
              </Grid>
              
              <Grid item xs={12} sm={4}>
                <Box textAlign="center">
                  <Typography variant="h4" color="success.main">
                    {searchService.getMetrics().avgResponseTime.toFixed(0)}ms
                  </Typography>
                  <Typography variant="caption">Avg Response Time</Typography>
                </Box>
              </Grid>
              
              <Grid item xs={12} sm={4}>
                <Box textAlign="center">
                  <Typography variant="h4" color="warning.main">
                    {searchService.getMetrics().errorCount}
                  </Typography>
                  <Typography variant="caption">Errors</Typography>
                </Box>
              </Grid>
            </Grid>

            <Box sx={{ mt: 2 }}>
              <Button 
                variant="outlined" 
                onClick={() => searchService.clearCache()}
                size="small"
              >
                Clear Cache
              </Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default SearchExample;