/**
 * Facility Result Manager Component
 * 
 * Provides multi-facility result management using Location FHIR R4 resources
 * for enterprise-scale laboratory operations across multiple locations.
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Typography,
  Chip,
  Stack,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Tooltip,
  Badge,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Avatar,
  Button
} from '@mui/material';
import {
  LocationOn as LocationIcon,
  Business as FacilityIcon,
  Science as LabIcon,
  ExpandMore as ExpandMoreIcon,
  Visibility as ViewIcon,
  Clear as ClearIcon,
  Map as MapIcon,
  Schedule as HoursIcon,
  Phone as ContactIcon
} from '@mui/icons-material';
import { fhirClient } from '../../../core/fhir/services/fhirClient';

const FacilityResultManager = ({ 
  patientId, 
  onFacilityFilter, 
  onResultsUpdate,
  selectedFacility = null 
}) => {
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedFacilityId, setSelectedFacilityId] = useState(selectedFacility || '');
  const [facilityResults, setFacilityResults] = useState({});
  const [expandedSections, setExpandedSections] = useState({
    filter: true,
    facilities: true,
    summary: false
  });

  useEffect(() => {
    if (patientId) {
      loadLabFacilities();
    }
  }, [patientId]);

  const loadLabFacilities = async () => {
    setLoading(true);
    try {
      // Search for laboratory locations
      const locationResponse = await fhirClient.search('Location', {
        type: 'laboratory',
        status: 'active',
        _include: 'Location:organization',
        _count: 100
      });

      // Also search for organizations that perform lab tests
      const orgResponse = await fhirClient.search('Organization', {
        type: 'prov',
        active: 'true',
        _count: 100
      });

      // Combine and process facilities
      const allFacilities = [];
      
      // Process locations
      locationResponse.resources?.forEach(location => {
        if (location.resourceType === 'Location') {
          allFacilities.push({
            id: location.id,
            type: 'location',
            name: location.name,
            alias: location.alias?.[0],
            status: location.status,
            mode: location.mode,
            description: location.description,
            address: location.address ? formatAddress(location.address) : null,
            phone: location.telecom?.find(t => t.system === 'phone')?.value,
            email: location.telecom?.find(t => t.system === 'email')?.value,
            organization: location.managingOrganization?.display,
            operationalStatus: location.operationalStatus?.coding?.[0]?.display,
            hoursOfOperation: location.hoursOfOperation,
            physicalType: location.physicalType?.coding?.[0]?.display,
            reference: `Location/${location.id}`
          });
        }
      });

      // Process organizations
      orgResponse.resources?.forEach(org => {
        if (org.resourceType === 'Organization' && isLabOrganization(org)) {
          allFacilities.push({
            id: org.id,
            type: 'organization',
            name: org.name,
            alias: org.alias?.[0],
            status: org.active ? 'active' : 'inactive',
            description: `${org.type?.[0]?.text || 'Healthcare Organization'}`,
            address: org.address?.[0] ? formatAddress(org.address[0]) : null,
            phone: org.telecom?.find(t => t.system === 'phone')?.value,
            email: org.telecom?.find(t => t.system === 'email')?.value,
            website: org.telecom?.find(t => t.system === 'url')?.value,
            organizationType: org.type?.[0]?.text,
            reference: `Organization/${org.id}`
          });
        }
      });

      setFacilities(allFacilities);

      // Load result counts for each facility
      const resultCounts = {};
      for (const facility of allFacilities) {
        try {
          const results = await getFacilityResults(patientId, facility.reference);
          resultCounts[facility.id] = {
            total: results.length,
            recent: results.filter(r => isRecentResult(r)).length,
            critical: results.filter(r => isCriticalResult(r)).length
          };
        } catch (error) {
          console.error(`Error loading results for facility ${facility.id}:`, error);
          resultCounts[facility.id] = { total: 0, recent: 0, critical: 0 };
        }
      }
      setFacilityResults(resultCounts);

    } catch (error) {
      console.error('Error loading lab facilities:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFacilityResults = async (patientId, facilityReference) => {
    try {
      // Search for observations performed by this facility
      const response = await fhirClient.search('Observation', {
        patient: patientId,
        performer: facilityReference,
        category: 'laboratory',
        _sort: '-date',
        _count: 1000
      });

      return response.resources || [];
    } catch (error) {
      console.error('Error getting facility results:', error);
      return [];
    }
  };

  const handleFacilityChange = async (facilityId) => {
    setSelectedFacilityId(facilityId);
    
    if (facilityId === '') {
      // Clear filter
      onFacilityFilter(null);
      onResultsUpdate([]);
      return;
    }

    const facility = facilities.find(f => f.id === facilityId);
    if (facility) {
      setLoading(true);
      try {
        const results = await getFacilityResults(patientId, facility.reference);
        
        onFacilityFilter({
          facility,
          results
        });
        onResultsUpdate(results);
      } catch (error) {
        console.error('Error filtering by facility:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  const formatAddress = (address) => {
    if (!address) return null;
    
    const parts = [];
    if (address.line) parts.push(address.line.join(', '));
    if (address.city) parts.push(address.city);
    if (address.state) parts.push(address.state);
    if (address.postalCode) parts.push(address.postalCode);
    
    return parts.length > 0 ? parts.join(', ') : null;
  };

  const isLabOrganization = (org) => {
    // Check if organization is related to laboratory services
    const labTypes = ['laboratory', 'lab', 'diagnostic', 'pathology', 'clinical'];
    const orgType = org.type?.[0]?.text?.toLowerCase() || '';
    const orgName = org.name?.toLowerCase() || '';
    
    return labTypes.some(type => orgType.includes(type) || orgName.includes(type));
  };

  const isRecentResult = (result) => {
    const resultDate = new Date(result.effectiveDateTime || result.issued);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return resultDate > sevenDaysAgo;
  };

  const isCriticalResult = (result) => {
    const interpretation = result.interpretation?.[0]?.coding?.[0]?.code;
    return ['HH', 'LL', 'AA'].includes(interpretation);
  };

  const getFacilityIcon = (facility) => {
    if (facility.type === 'location') {
      return <LocationIcon />;
    } else {
      return <FacilityIcon />;
    }
  };

  const getFacilityTypeColor = (facility) => {
    if (facility.type === 'location') {
      return 'primary';
    } else {
      return 'secondary';
    }
  };

  const selectedFacilityInfo = facilities.find(f => f.id === selectedFacilityId);

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <MapIcon color="primary" />
          Multi-Facility Lab Management
          {facilities.length > 0 && (
            <Badge badgeContent={facilities.length} color="primary" sx={{ ml: 1 }} />
          )}
        </Typography>

        {/* Facility Filter */}
        <Accordion 
          expanded={expandedSections.filter} 
          onChange={() => setExpandedSections(prev => ({ ...prev, filter: !prev.filter }))}
          sx={{ mb: 2 }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1">Filter by Laboratory Facility</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <FormControl fullWidth>
              <InputLabel>Select Facility</InputLabel>
              <Select
                value={selectedFacilityId}
                onChange={(e) => handleFacilityChange(e.target.value)}
                label="Select Facility"
                disabled={loading}
              >
                <MenuItem value="">
                  <em>All Facilities</em>
                </MenuItem>
                {facilities.map((facility) => (
                  <MenuItem key={facility.id} value={facility.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                      <Avatar 
                        sx={{ 
                          width: 32, 
                          height: 32, 
                          bgcolor: `${getFacilityTypeColor(facility)}.main`
                        }}
                      >
                        {getFacilityIcon(facility)}
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" fontWeight="bold">
                          {facility.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {facility.description} • {facility.address || 'No address'}
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'right' }}>
                        <Typography variant="caption" color="primary">
                          {facilityResults[facility.id]?.total || 0} results
                        </Typography>
                        {facilityResults[facility.id]?.critical > 0 && (
                          <Chip 
                            label={`${facilityResults[facility.id].critical} critical`}
                            size="small"
                            color="error"
                            sx={{ ml: 1 }}
                          />
                        )}
                      </Box>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {selectedFacilityInfo && (
              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  Showing results from <strong>{selectedFacilityInfo.name}</strong> 
                  • {facilityResults[selectedFacilityInfo.id]?.total || 0} total results
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                  {facilityResults[selectedFacilityInfo.id]?.recent > 0 && (
                    <Chip 
                      label={`${facilityResults[selectedFacilityInfo.id].recent} recent`}
                      size="small"
                      color="success"
                    />
                  )}
                  {facilityResults[selectedFacilityInfo.id]?.critical > 0 && (
                    <Chip 
                      label={`${facilityResults[selectedFacilityInfo.id].critical} critical`}
                      size="small"
                      color="error"
                    />
                  )}
                  <Button
                    size="small"
                    startIcon={<ClearIcon />}
                    onClick={() => handleFacilityChange('')}
                    color="error"
                  >
                    Clear Filter
                  </Button>
                </Stack>
              </Alert>
            )}
          </AccordionDetails>
        </Accordion>

        {/* Facility List */}
        <Accordion 
          expanded={expandedSections.facilities} 
          onChange={() => setExpandedSections(prev => ({ ...prev, facilities: !prev.facilities }))}
          sx={{ mb: 2 }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1">
              Laboratory Network ({facilities.length})
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            {loading ? (
              <Typography variant="body2" color="text.secondary">
                Loading facilities...
              </Typography>
            ) : facilities.length === 0 ? (
              <Alert severity="info">
                No laboratory facilities found. Results may not have facility attribution.
              </Alert>
            ) : (
              <List dense>
                {facilities.map((facility) => (
                  <ListItem key={facility.id}>
                    <ListItemIcon>
                      <Avatar 
                        sx={{ 
                          bgcolor: `${getFacilityTypeColor(facility)}.main`,
                          width: 40,
                          height: 40
                        }}
                      >
                        {getFacilityIcon(facility)}
                      </Avatar>
                    </ListItemIcon>
                    
                    <ListItemText
                      primary={
                        <Typography variant="subtitle2" fontWeight="bold">
                          {facility.name}
                        </Typography>
                      }
                      secondary={
                        <Stack spacing={0.5}>
                          <Typography variant="caption" color="text.secondary">
                            {facility.description}
                          </Typography>
                          {facility.address && (
                            <Typography variant="caption" color="text.secondary">
                              <LocationIcon sx={{ fontSize: 12, verticalAlign: 'middle', mr: 0.5 }} />
                              {facility.address}
                            </Typography>
                          )}
                          <Stack direction="row" spacing={1}>
                            <Chip 
                              label={facility.type} 
                              size="small" 
                              color={getFacilityTypeColor(facility)} 
                              variant="outlined" 
                            />
                            <Chip 
                              label={`${facilityResults[facility.id]?.total || 0} results`} 
                              size="small" 
                              color="default" 
                            />
                            {facility.phone && (
                              <Chip 
                                label="Contact available" 
                                size="small" 
                                color="success" 
                                variant="outlined" 
                                icon={<ContactIcon />}
                              />
                            )}
                          </Stack>
                        </Stack>
                      }
                    />
                    
                    <ListItemSecondaryAction>
                      <Tooltip title="Filter by this facility">
                        <IconButton
                          size="small"
                          onClick={() => handleFacilityChange(facility.id)}
                          color={selectedFacilityId === facility.id ? "primary" : "default"}
                        >
                          <ViewIcon />
                        </IconButton>
                      </Tooltip>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            )}
          </AccordionDetails>
        </Accordion>

        {/* Network Summary */}
        <Accordion 
          expanded={expandedSections.summary} 
          onChange={() => setExpandedSections(prev => ({ ...prev, summary: !prev.summary }))}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1">Network Summary</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2" gutterBottom>
                      <LocationIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
                      Physical Locations
                    </Typography>
                    <Typography variant="h4" color="primary">
                      {facilities.filter(f => f.type === 'location').length}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Laboratory facilities
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} md={4}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2" gutterBottom>
                      <FacilityIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
                      Organizations
                    </Typography>
                    <Typography variant="h4" color="secondary">
                      {facilities.filter(f => f.type === 'organization').length}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Lab service organizations
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} md={4}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2" gutterBottom>
                      <LabIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
                      Total Results
                    </Typography>
                    <Typography variant="h4" color="success">
                      {Object.values(facilityResults).reduce((sum, counts) => sum + (counts.total || 0), 0)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Across all facilities
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12}>
                <Alert severity="info" icon={<MapIcon />}>
                  <Typography variant="body2">
                    <strong>Multi-Facility Management:</strong> Track laboratory results across your healthcare network. 
                    Filter by specific facilities for quality assurance, compare turnaround times, and ensure 
                    consistent care delivery across all locations.
                  </Typography>
                </Alert>
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>
      </CardContent>
    </Card>
  );
};

export default FacilityResultManager;