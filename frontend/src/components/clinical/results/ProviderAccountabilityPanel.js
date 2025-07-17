/**
 * Provider Accountability Panel Component
 * 
 * Provides provider-based filtering and accountability tracking for lab results.
 * Integrates with Practitioner and PractitionerRole FHIR R4 resources.
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Card,
  CardContent,
  Typography,
  Chip,
  Stack,
  Avatar,
  Tooltip,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Badge,
  Button,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  IconButton
} from '@mui/material';
import {
  Person as PersonIcon,
  Business as OrganizationIcon,
  ExpandMore as ExpandMoreIcon,
  Assignment as OrderedIcon,
  Science as PerformedIcon,
  Visibility as ViewIcon,
  AccountBox as AccountabilityIcon,
  Clear as ClearIcon
} from '@mui/icons-material';
import { providerAccountabilityService } from '../../../services/providerAccountabilityService';

const ProviderAccountabilityPanel = ({ 
  patientId, 
  onProviderFilter, 
  onResultsUpdate,
  selectedProvider = null 
}) => {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedProviderId, setSelectedProviderId] = useState(selectedProvider || '');
  const [providerResults, setProviderResults] = useState({});
  const [expandedSections, setExpandedSections] = useState({
    filter: true,
    providers: true,
    accountability: false
  });

  useEffect(() => {
    if (patientId) {
      loadPatientProviders();
    }
  }, [patientId]);

  const loadPatientProviders = async () => {
    setLoading(true);
    try {
      const patientProviders = await providerAccountabilityService.getPatientProviders(patientId);
      setProviders(patientProviders);

      // Load result counts for each provider
      const resultCounts = {};
      for (const provider of patientProviders) {
        try {
          const results = await providerAccountabilityService.getProviderResults(
            patientId, 
            provider.reference, 
            'all'
          );
          resultCounts[provider.id] = {
            total: results.length,
            ordered: await providerAccountabilityService.getProviderResults(patientId, provider.reference, 'ordered'),
            performed: await providerAccountabilityService.getProviderResults(patientId, provider.reference, 'performed')
          };
        } catch (error) {
          console.error(`Error loading results for provider ${provider.id}:`, error);
          resultCounts[provider.id] = { total: 0, ordered: [], performed: [] };
        }
      }
      setProviderResults(resultCounts);
    } catch (error) {
      console.error('Error loading patient providers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProviderChange = async (providerId) => {
    setSelectedProviderId(providerId);
    
    if (providerId === '') {
      // Clear filter
      onProviderFilter(null);
      onResultsUpdate([]);
      return;
    }

    const provider = providers.find(p => p.id === providerId);
    if (provider) {
      setLoading(true);
      try {
        const results = await providerAccountabilityService.getProviderResults(
          patientId, 
          provider.reference, 
          'all'
        );
        
        onProviderFilter({
          provider,
          type: 'all',
          results
        });
        onResultsUpdate(results);
      } catch (error) {
        console.error('Error filtering by provider:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleProviderTypeFilter = async (provider, type) => {
    setLoading(true);
    try {
      const results = await providerAccountabilityService.getProviderResults(
        patientId, 
        provider.reference, 
        type
      );
      
      onProviderFilter({
        provider,
        type,
        results
      });
      onResultsUpdate(results);
    } catch (error) {
      console.error('Error filtering by provider type:', error);
    } finally {
      setLoading(false);
    }
  };

  const getProviderInitials = (name) => {
    if (!name) return 'UP';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const getProviderSpecialtyColor = (specialty) => {
    const colors = {
      'internal medicine': 'primary',
      'cardiology': 'error',
      'endocrinology': 'warning',
      'nephrology': 'info',
      'emergency medicine': 'error',
      'family medicine': 'success',
      'laboratory medicine': 'secondary',
      'pathology': 'secondary'
    };
    
    if (!specialty) return 'default';
    const key = specialty.toLowerCase();
    return colors[key] || 'default';
  };

  const selectedProviderInfo = providers.find(p => p.id === selectedProviderId);

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AccountabilityIcon color="primary" />
          Provider Accountability
          {providers.length > 0 && (
            <Badge badgeContent={providers.length} color="primary" sx={{ ml: 1 }} />
          )}
        </Typography>

        {/* Provider Filter */}
        <Accordion 
          expanded={expandedSections.filter} 
          onChange={() => setExpandedSections(prev => ({ ...prev, filter: !prev.filter }))}
          sx={{ mb: 2 }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1">Filter by Provider</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <FormControl fullWidth>
              <InputLabel>Select Provider</InputLabel>
              <Select
                value={selectedProviderId}
                onChange={(e) => handleProviderChange(e.target.value)}
                label="Select Provider"
                disabled={loading}
              >
                <MenuItem value="">
                  <em>All Providers</em>
                </MenuItem>
                {providers.map((provider) => (
                  <MenuItem key={provider.id} value={provider.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                      <Avatar 
                        sx={{ 
                          width: 32, 
                          height: 32, 
                          bgcolor: `${getProviderSpecialtyColor(provider.specialty)}.main`,
                          fontSize: '0.75rem'
                        }}
                      >
                        {getProviderInitials(provider.name)}
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" fontWeight="bold">
                          {provider.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {provider.specialty} • {provider.organization}
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'right' }}>
                        <Typography variant="caption" color="primary">
                          {providerResults[provider.id]?.total || 0} results
                        </Typography>
                      </Box>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {selectedProviderInfo && (
              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  Showing results for <strong>{selectedProviderInfo.name}</strong> 
                  ({selectedProviderInfo.specialty}) • {providerResults[selectedProviderInfo.id]?.total || 0} total results
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                  <Button
                    size="small"
                    startIcon={<OrderedIcon />}
                    onClick={() => handleProviderTypeFilter(selectedProviderInfo, 'ordered')}
                  >
                    Ordered ({providerResults[selectedProviderInfo.id]?.ordered?.length || 0})
                  </Button>
                  <Button
                    size="small"
                    startIcon={<PerformedIcon />}
                    onClick={() => handleProviderTypeFilter(selectedProviderInfo, 'performed')}
                  >
                    Performed ({providerResults[selectedProviderInfo.id]?.performed?.length || 0})
                  </Button>
                  <Button
                    size="small"
                    startIcon={<ClearIcon />}
                    onClick={() => handleProviderChange('')}
                    color="error"
                  >
                    Clear Filter
                  </Button>
                </Stack>
              </Alert>
            )}
          </AccordionDetails>
        </Accordion>

        {/* Provider List */}
        <Accordion 
          expanded={expandedSections.providers} 
          onChange={() => setExpandedSections(prev => ({ ...prev, providers: !prev.providers }))}
          sx={{ mb: 2 }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1">
              Care Team Providers ({providers.length})
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            {loading ? (
              <Typography variant="body2" color="text.secondary">
                Loading providers...
              </Typography>
            ) : providers.length === 0 ? (
              <Alert severity="info">
                No providers found for this patient. Results may not have provider attribution.
              </Alert>
            ) : (
              <List dense>
                {providers.map((provider, index) => (
                  <React.Fragment key={provider.id}>
                    <ListItem>
                      <ListItemAvatar>
                        <Avatar 
                          sx={{ 
                            bgcolor: `${getProviderSpecialtyColor(provider.specialty)}.main`,
                            width: 40,
                            height: 40
                          }}
                        >
                          {getProviderInitials(provider.name)}
                        </Avatar>
                      </ListItemAvatar>
                      
                      <ListItemText
                        primary={
                          <Typography variant="subtitle2" fontWeight="bold">
                            {provider.name}
                          </Typography>
                        }
                        secondary={
                          <Stack spacing={0.5}>
                            <Typography variant="caption" color="text.secondary">
                              {provider.specialty} • {provider.organization}
                            </Typography>
                            <Stack direction="row" spacing={1}>
                              <Chip 
                                label={provider.involvement} 
                                size="small" 
                                color="primary" 
                                variant="outlined" 
                              />
                              <Chip 
                                label={`${providerResults[provider.id]?.total || 0} results`} 
                                size="small" 
                                color="default" 
                              />
                              {provider.contact?.email && (
                                <Chip 
                                  label="Email available" 
                                  size="small" 
                                  color="success" 
                                  variant="outlined" 
                                />
                              )}
                            </Stack>
                          </Stack>
                        }
                      />
                      
                      <ListItemSecondaryAction>
                        <Stack direction="row" spacing={1}>
                          <Tooltip title="Filter by this provider">
                            <IconButton
                              size="small"
                              onClick={() => handleProviderChange(provider.id)}
                              color={selectedProviderId === provider.id ? "primary" : "default"}
                            >
                              <ViewIcon />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </ListItemSecondaryAction>
                    </ListItem>
                    {index < providers.length - 1 && <Divider variant="inset" component="li" />}
                  </React.Fragment>
                ))}
              </List>
            )}
          </AccordionDetails>
        </Accordion>

        {/* Accountability Summary */}
        <Accordion 
          expanded={expandedSections.accountability} 
          onChange={() => setExpandedSections(prev => ({ ...prev, accountability: !prev.accountability }))}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1">Accountability Summary</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2" gutterBottom>
                      <OrderedIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
                      Ordering Providers
                    </Typography>
                    <Typography variant="h4" color="primary">
                      {providers.filter(p => p.involvement === 'ordering').length}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Providers who ordered lab tests
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2" gutterBottom>
                      <PerformedIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
                      Performing Labs
                    </Typography>
                    <Typography variant="h4" color="secondary">
                      {providers.filter(p => p.involvement === 'performing').length}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Labs/providers performing tests
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12}>
                <Alert severity="info" icon={<AccountabilityIcon />}>
                  <Typography variant="body2">
                    <strong>Provider Accountability:</strong> Track ordering physicians for result follow-up, 
                    performing laboratories for quality assurance, and ensure appropriate clinical response 
                    to abnormal values.
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

export default ProviderAccountabilityPanel;