/**
 * OrderDialogWizard Component
 * Enhanced 3-step wizard for placing clinical orders with progressive disclosure
 * Provides a simpler, more intuitive interface for lab, imaging, and procedure orders
 * 
 * @since 2025-01-21
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Grid,
  Stack,
  Typography,
  Select,
  AlertTitle,
  TextField,
  Paper,
  Autocomplete,
  useTheme,
  Fade,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  LinearProgress,
  IconButton,
  Tooltip,
  Card,
  CardContent,
  Badge,
  ToggleButton,
  ToggleButtonGroup
} from '@mui/material';
import {
  Science as LabIcon,
  MedicalServices as ImagingIcon,
  LocalHospital as ProcedureIcon,
  NavigateNext as NextIcon,
  NavigateBefore as BackIcon,
  Check as CheckIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Schedule as ScheduleIcon,
  Assignment as ReviewIcon,
  Star as StarIcon,
  LightbulbOutlined as SuggestionIcon
} from '@mui/icons-material';
import SimplifiedClinicalDialog from '../../common/SimplifiedClinicalDialog';
import { fhirClient } from '../../../../core/fhir/services/fhirClient';
import { notificationService } from '../../../../services/notificationService';
import { clinicalCDSService } from '../../../../services/clinicalCDSService';
import { getClinicalCatalog } from '../../../../services/cdsClinicalDataService';
import { format } from 'date-fns';
import {
  getBorderRadius,
  getElevationShadow,
  getSmoothTransition
} from '../../../../themes/clinicalThemeUtils';
import { clinicalTokens } from '../../../../themes/clinicalTheme';
import type { ServiceRequest } from '../../../../core/fhir/types';

// Order category configuration with icons and styling
const CATEGORY_CONFIG = {
  laboratory: {
    label: 'Laboratory',
    icon: <LabIcon />,
    color: 'primary',
    gradient: 'primary',
    popularTests: [
      { code: '51990-0', name: 'Basic Metabolic Panel', shortName: 'BMP', frequency: 'common' },
      { code: '24323-8', name: 'Comprehensive Metabolic Panel', shortName: 'CMP', frequency: 'common' },
      { code: '58410-2', name: 'Complete Blood Count', shortName: 'CBC', frequency: 'common' },
      { code: '57698-3', name: 'Lipid Panel', shortName: 'Lipid', frequency: 'common' },
      { code: '14682-9', name: 'Creatinine', shortName: 'Cr', frequency: 'common' },
      { code: '2339-0', name: 'Glucose', shortName: 'Glu', frequency: 'common' }
    ]
  },
  imaging: {
    label: 'Imaging',
    icon: <ImagingIcon />,
    color: 'secondary',
    gradient: 'secondary',
    popularTests: [
      { code: 'chest-xray', name: 'Chest X-ray', modality: 'XR', frequency: 'common' },
      { code: 'ct-head', name: 'CT Head w/o contrast', modality: 'CT', frequency: 'common' },
      { code: 'ct-chest', name: 'CT Chest w/contrast', modality: 'CT', frequency: 'moderate' },
      { code: 'ct-abdomen', name: 'CT Abdomen/Pelvis', modality: 'CT', frequency: 'moderate' },
      { code: 'us-abdomen', name: 'Ultrasound Abdomen', modality: 'US', frequency: 'common' },
      { code: 'mri-brain', name: 'MRI Brain', modality: 'MR', frequency: 'moderate' }
    ]
  },
  procedure: {
    label: 'Procedure',
    icon: <ProcedureIcon />,
    color: 'warning',
    gradient: 'warning',
    popularTests: [
      { code: 'ekg', name: 'Electrocardiogram', shortName: 'EKG', frequency: 'common' },
      { code: 'echo', name: 'Echocardiogram', shortName: 'Echo', frequency: 'moderate' },
      { code: 'pft', name: 'Pulmonary Function Test', shortName: 'PFT', frequency: 'moderate' },
      { code: 'eeg', name: 'Electroencephalogram', shortName: 'EEG', frequency: 'rare' }
    ]
  }
};

// Priority configuration with visual styling
const PRIORITY_CONFIG = {
  routine: {
    label: 'Routine',
    description: 'Normal processing time',
    color: 'default',
    icon: '🔵',
    timeframe: '24-48 hours'
  },
  urgent: {
    label: 'Urgent',
    description: 'Expedited processing',
    color: 'warning',
    icon: '🟡',
    timeframe: '2-4 hours'
  },
  asap: {
    label: 'ASAP',
    description: 'As soon as possible',
    color: 'warning',
    icon: '🟠',
    timeframe: '< 2 hours'
  },
  stat: {
    label: 'STAT',
    description: 'Immediate processing',
    color: 'error',
    icon: '🔴',
    timeframe: '< 1 hour'
  }
};

const OrderDialogWizard = ({
  open,
  onClose,
  mode = 'create',
  order = null,
  patient,
  onSave,
  encounterId = null,
  defaultCategory = null
}) => {
  const theme = useTheme();
  
  // Helper function to generate gradient from theme color
  const getGradient = (colorName) => {
    const color = theme.palette[colorName]?.main || theme.palette.grey[500];
    const lightColor = theme.palette[colorName]?.light || theme.palette.grey[300];
    return `linear-gradient(135deg, ${color} 0%, ${lightColor} 100%)`;
  };
  
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [orderCatalog, setOrderCatalog] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [cdsAlerts, setCdsAlerts] = useState([]);
  const [stepErrors, setStepErrors] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  
  // Form state
  const [selectedCategory, setSelectedCategory] = useState(defaultCategory || 'laboratory');
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [formData, setFormData] = useState({
    priority: 'routine',
    occurrenceDateTime: '',
    reasonCode: null,
    bodySite: null,
    specimen: 'blood',
    specialInstructions: '',
    patientInstructions: '',
    scheduleType: 'now' // 'now' or 'scheduled'
  });
  
  const [appropriatenessScore, setAppropriatenessScore] = useState(null);
  const [suggestions, setSuggestions] = useState([]);

  // Load order catalog
  useEffect(() => {
    const loadCatalog = async () => {
      if (!selectedCategory || !open) return;
      
      try {
        setLoading(true);
        let catalogType = 'laboratories';
        if (selectedCategory === 'imaging') catalogType = 'imaging';
        else if (selectedCategory === 'procedure') catalogType = 'procedures';
        
        const catalog = await getClinicalCatalog(catalogType);
        setOrderCatalog(catalog.items || []);
        
        // Generate intelligent suggestions based on patient data
        generateOrderSuggestions();
      } catch (error) {
        console.error('Failed to load order catalog:', error);
      } finally {
        setLoading(false);
      }
    };
    
    if (open) {
      loadCatalog();
      setActiveStep(0);
      setSelectedOrders([]);
    }
  }, [selectedCategory, open]);

  // Generate intelligent order suggestions
  const generateOrderSuggestions = async () => {
    // In a real implementation, this would analyze patient conditions,
    // medications, and recent results to suggest appropriate orders
    const mockSuggestions = [
      {
        category: 'laboratory',
        reason: 'Patient on metformin - monitor renal function',
        orders: ['Basic Metabolic Panel', 'Creatinine']
      },
      {
        category: 'laboratory',
        reason: 'Annual health maintenance',
        orders: ['Complete Blood Count', 'Lipid Panel']
      }
    ];
    
    setSuggestions(mockSuggestions.filter(s => s.category === selectedCategory));
  };

  // Check order appropriateness
  const checkOrderAppropriateness = async (orders) => {
    if (!patient || orders.length === 0) return;
    
    try {
      // Fire CDS hooks
      const cdsResult = await clinicalCDSService.fireLabOrderHooks({
        patient,
        orders: orders.map(order => ({
          resourceType: 'ServiceRequest',
          status: 'draft',
          intent: 'order',
          code: order.code,
          subject: { reference: `Patient/${patient.id}` },
          priority: order.priority || formData.priority,
          category: [{
            coding: [{
              system: 'http://snomed.info/sct',
              code: selectedCategory,
              display: CATEGORY_CONFIG[selectedCategory].label
            }]
          }]
        }))
      });
      
      if (cdsResult?.cards?.length > 0) {
        setCdsAlerts(cdsResult.cards);
      }
      
      // Calculate appropriateness score
      if (selectedCategory === 'imaging' && formData.reasonCode) {
        setAppropriatenessScore(8); // Mock score
      }
    } catch (error) {
      console.error('CDS check failed:', error);
    }
  };

  // Add order to selection
  const handleAddOrder = (orderItem) => {
    const newOrder = {
      id: `order-${Date.now()}-${Math.random()}`,
      code: {
        coding: [{
          system: orderItem.system || 'http://loinc.org',
          code: orderItem.code,
          display: orderItem.name || orderItem.display
        }],
        text: orderItem.name || orderItem.display
      },
      priority: formData.priority,
      category: selectedCategory,
      ...orderItem
    };
    
    setSelectedOrders(prev => {
      const updated = [...prev, newOrder];
      checkOrderAppropriateness(updated);
      return updated;
    });
  };

  // Remove order from selection
  const handleRemoveOrder = (orderId) => {
    setSelectedOrders(prev => {
      const updated = prev.filter(o => o.id !== orderId);
      if (updated.length > 0) {
        checkOrderAppropriateness(updated);
      } else {
        setCdsAlerts([]);
      }
      return updated;
    });
  };

  // Validate current step
  const validateStep = (step) => {
    const errors = {};
    
    switch (step) {
      case 0: // Order selection
        if (selectedOrders.length === 0) {
          errors.orders = 'Please select at least one order';
        }
        break;
      case 1: // Details & Priority
        // All fields are optional in this step
        break;
      case 2: // Review
        // No validation needed for review
        break;
    }
    
    setStepErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle step navigation
  const handleNext = () => {
    if (validateStep(activeStep)) {
      setActiveStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    setActiveStep(prev => prev - 1);
  };

  // Handle save
  const handleSave = async () => {
    if (!validateStep(activeStep)) return;

    try {
      setSaving(true);
      const serviceRequests = [];
      
      for (const order of selectedOrders) {
        const serviceRequest: Partial<ServiceRequest> = {
          resourceType: 'ServiceRequest',
          status: 'active',
          intent: 'order',
          priority: order.priority || formData.priority,
          category: [{
            coding: [{
              system: 'http://snomed.info/sct',
              code: selectedCategory,
              display: CATEGORY_CONFIG[selectedCategory].label
            }]
          }],
          code: order.code,
          subject: {
            reference: `Patient/${patient.id}`,
            display: patient.name?.[0]?.given?.join(' ') + ' ' + patient.name?.[0]?.family
          },
          authoredOn: new Date().toISOString()
        };
        
        // Add optional fields
        if (formData.scheduleType === 'scheduled' && formData.occurrenceDateTime) {
          serviceRequest.occurrenceDateTime = new Date(formData.occurrenceDateTime).toISOString();
        }
        
        if (formData.reasonCode) {
          serviceRequest.reasonCode = [{
            coding: [{
              code: formData.reasonCode.code,
              display: formData.reasonCode.display
            }],
            text: formData.reasonCode.display
          }];
        }
        
        if (formData.specialInstructions) {
          serviceRequest.note = [{
            text: formData.specialInstructions,
            time: new Date().toISOString()
          }];
        }
        
        if (formData.patientInstructions) {
          serviceRequest.patientInstruction = formData.patientInstructions;
        }
        
        if (encounterId) {
          serviceRequest.encounter = {
            reference: `Encounter/${encounterId}`
          };
        }
        
        const result = await fhirClient.create('ServiceRequest', serviceRequest);
        serviceRequests.push(result);
      }
      
      notificationService.success(`Successfully placed ${serviceRequests.length} order(s)`);
      
      if (onSave) {
        onSave(serviceRequests);
      }
      
      onClose();
    } catch (error) {
      console.error('Failed to save orders:', error);
      notificationService.fhirError(error, {
        operation: 'CREATE',
        resourceType: 'ServiceRequest'
      });
      setAlerts([{ 
        severity: 'error', 
        message: 'Failed to save orders. Please try again.' 
      }]);
    } finally {
      setSaving(false);
    }
  };

  // Step components
  const OrderSelectionStep = () => {
    const categoryConfig = CATEGORY_CONFIG[selectedCategory];
    const filteredCatalog = useMemo(() => {
      if (!searchTerm) return [];
      return orderCatalog.filter(item => 
        item.display?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.code?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }, [orderCatalog, searchTerm]);

    return (
      <Fade in={activeStep === 0}>
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Select the type of order and choose from common orders or search the catalog.
          </Typography>

          {/* Category Selection */}
          <Paper 
            sx={{ 
              p: 2, 
              mb: 3,
              borderRadius: getBorderRadius('lg'),
              background: clinicalTokens.gradients.backgroundCard
            }}
          >
            <Typography variant="subtitle2" color="primary" gutterBottom>
              Order Category
            </Typography>
            <ToggleButtonGroup
              value={selectedCategory}
              exclusive
              onChange={(e, newCategory) => newCategory && setSelectedCategory(newCategory)}
              fullWidth
              sx={{ mt: 1 }}
            >
              {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                <ToggleButton 
                  key={key} 
                  value={key}
                  sx={{
                    py: 2,
                    flexDirection: 'column',
                    gap: 0.5,
                    borderRadius: getBorderRadius('md'),
                    '&.Mui-selected': {
                      background: getGradient(config.gradient),
                      color: 'white',
                      '&:hover': {
                        background: getGradient(config.gradient),
                        filter: 'brightness(1.1)'
                      }
                    }
                  }}
                >
                  {config.icon}
                  <Typography variant="button">{config.label}</Typography>
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Paper>

          {/* Intelligent Suggestions */}
          {suggestions.length > 0 && (
            <Paper 
              sx={{ 
                p: 2, 
                mb: 3,
                borderRadius: getBorderRadius('lg'),
                background: alpha(theme.palette.info.main, 0.04),
                border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <SuggestionIcon sx={{ color: theme.palette.info.main }} />
                <Typography variant="subtitle2" color="info.main">
                  Suggested Orders
                </Typography>
              </Stack>
              {suggestions.map((suggestion, index) => (
                <Alert 
                  key={index}
                  severity="info" 
                  sx={{ mb: 1 }}
                  action={
                    <Button 
                      size="small" 
                      onClick={() => {
                        // Add suggested orders
                        suggestion.orders.forEach(orderName => {
                          const orderItem = categoryConfig.popularTests.find(
                            test => test.name === orderName || test.shortName === orderName
                          );
                          if (orderItem) {
                            handleAddOrder(orderItem);
                          }
                        });
                      }}
                    >
                      Add All
                    </Button>
                  }
                >
                  <Typography variant="body2">{suggestion.reason}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {suggestion.orders.join(', ')}
                  </Typography>
                </Alert>
              ))}
            </Paper>
          )}

          {/* Popular Orders */}
          <Paper 
            sx={{ 
              p: 2, 
              mb: 3,
              borderRadius: getBorderRadius('lg'),
              background: clinicalTokens.gradients.backgroundCard
            }}
          >
            <Typography variant="subtitle2" color="primary" gutterBottom>
              Popular {categoryConfig.label} Orders
            </Typography>
            <Grid container spacing={1} sx={{ mt: 1 }}>
              {categoryConfig.popularTests.map((test) => (
                <Grid item xs={6} sm={4} key={test.code}>
                  <Card
                    onClick={() => handleAddOrder(test)}
                    sx={{
                      cursor: 'pointer',
                      height: '100%',
                      borderRadius: getBorderRadius('md'),
                      border: `2px solid transparent`,
                      background: alpha(categoryConfig.color, 0.04),
                      ...getSmoothTransition(['all']),
                      '&:hover': {
                        borderColor: categoryConfig.color,
                        transform: 'translateY(-2px)',
                        boxShadow: getElevationShadow(2)
                      }
                    }}
                  >
                    <CardContent sx={{ p: 2 }}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Box>
                          <Typography variant="body2" fontWeight={600}>
                            {test.shortName || test.name}
                          </Typography>
                          {test.shortName && (
                            <Typography variant="caption" color="text.secondary">
                              {test.name}
                            </Typography>
                          )}
                        </Box>
                        {test.frequency === 'common' && (
                          <Tooltip title="Commonly ordered">
                            <StarIcon sx={{ fontSize: 16, color: theme.palette.warning.main }} />
                          </Tooltip>
                        )}
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Paper>

          {/* Search Catalog */}
          <Paper 
            sx={{ 
              p: 2, 
              mb: 3,
              borderRadius: getBorderRadius('lg'),
              background: clinicalTokens.gradients.backgroundCard
            }}
          >
            <Typography variant="subtitle2" color="primary" gutterBottom>
              Search {categoryConfig.label} Catalog
            </Typography>
            <TextField
              fullWidth
              placeholder={`Search ${categoryConfig.label.toLowerCase()} orders...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: getBorderRadius('md')
                }
              }}
            />
            {searchTerm && filteredCatalog.length > 0 && (
              <List sx={{ mt: 1, maxHeight: 200, overflow: 'auto' }}>
                {filteredCatalog.slice(0, 10).map((item, index) => (
                  <ListItem
                    key={index}
                    button
                    onClick={() => {
                      handleAddOrder(item);
                      setSearchTerm('');
                    }}
                    sx={{
                      borderRadius: getBorderRadius('sm'),
                      mb: 0.5
                    }}
                  >
                    <ListItemText
                      primary={item.display || item.name}
                      secondary={item.code}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>

          {/* Selected Orders */}
          {selectedOrders.length > 0 && (
            <Paper 
              sx={{ 
                p: 2,
                borderRadius: getBorderRadius('lg'),
                background: alpha(theme.palette.success.main, 0.04),
                border: `1px solid ${alpha(theme.palette.success.main, 0.2)}`
              }}
            >
              <Typography variant="subtitle2" color="success.main" gutterBottom>
                Selected Orders ({selectedOrders.length})
              </Typography>
              <List dense>
                {selectedOrders.map((order) => (
                  <ListItem
                    key={order.id}
                    sx={{
                      borderRadius: getBorderRadius('sm'),
                      mb: 0.5,
                      background: theme.palette.background.paper
                    }}
                  >
                    <ListItemIcon>
                      {CATEGORY_CONFIG[order.category].icon}
                    </ListItemIcon>
                    <ListItemText
                      primary={order.code?.text}
                      secondary={
                        <Chip 
                          label={PRIORITY_CONFIG[order.priority || formData.priority].label}
                          size="small"
                          color={PRIORITY_CONFIG[order.priority || formData.priority].color}
                        />
                      }
                    />
                    <ListItemSecondaryAction>
                      <IconButton 
                        edge="end" 
                        onClick={() => handleRemoveOrder(order.id)}
                        size="small"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            </Paper>
          )}

          {stepErrors.orders && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {stepErrors.orders}
            </Alert>
          )}
        </Box>
      </Fade>
    );
  };

  const DetailsAndPriorityStep = () => (
    <Fade in={activeStep === 1}>
      <Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Set the priority and provide clinical details for the orders.
        </Typography>

        <Grid container spacing={3}>
          {/* Priority Selection */}
          <Grid item xs={12}>
            <Paper 
              sx={{ 
                p: 2,
                borderRadius: getBorderRadius('lg'),
                background: clinicalTokens.gradients.backgroundCard
              }}
            >
              <Typography variant="subtitle2" color="primary" gutterBottom>
                Order Priority
              </Typography>
              <Typography variant="caption" color="text.secondary" paragraph>
                Select the urgency level for these orders
              </Typography>
              <Grid container spacing={1}>
                {Object.entries(PRIORITY_CONFIG).map(([key, config]) => (
                  <Grid item xs={6} sm={3} key={key}>
                    <Paper
                      onClick={() => setFormData(prev => ({ ...prev, priority: key }))}
                      sx={{
                        p: 2,
                        cursor: 'pointer',
                        textAlign: 'center',
                        borderRadius: getBorderRadius('md'),
                        border: `2px solid ${formData.priority === key ? 
                          theme.palette[config.color === 'default' ? 'primary' : config.color].main : 
                          'transparent'}`,
                        background: formData.priority === key ? 
                          alpha(theme.palette[config.color === 'default' ? 'primary' : config.color].main, 0.08) :
                          alpha(theme.palette.background.default, 0.5),
                        ...getSmoothTransition(['all']),
                        '&:hover': {
                          borderColor: theme.palette[config.color === 'default' ? 'primary' : config.color].light,
                          transform: 'translateY(-2px)',
                          boxShadow: getElevationShadow(1)
                        }
                      }}
                    >
                      <Typography variant="h5" sx={{ mb: 0.5 }}>{config.icon}</Typography>
                      <Typography variant="body2" fontWeight={formData.priority === key ? 600 : 400}>
                        {config.label}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {config.timeframe}
                      </Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </Paper>
          </Grid>

          {/* Scheduling */}
          <Grid item xs={12}>
            <Paper 
              sx={{ 
                p: 2,
                borderRadius: getBorderRadius('lg'),
                background: clinicalTokens.gradients.backgroundCard
              }}
            >
              <Typography variant="subtitle2" color="primary" gutterBottom>
                When to Perform
              </Typography>
              <Stack spacing={2}>
                <ToggleButtonGroup
                  value={formData.scheduleType}
                  exclusive
                  onChange={(e, newType) => newType && setFormData(prev => ({ ...prev, scheduleType: newType }))}
                  fullWidth
                >
                  <ToggleButton value="now">
                    Perform Now
                  </ToggleButton>
                  <ToggleButton value="scheduled">
                    Schedule for Later
                  </ToggleButton>
                </ToggleButtonGroup>
                
                {formData.scheduleType === 'scheduled' && (
                  <TextField
                    label="Scheduled Date/Time"
                    type="datetime-local"
                    value={formData.occurrenceDateTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, occurrenceDateTime: e.target.value }))}
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: getBorderRadius('md')
                      }
                    }}
                  />
                )}
              </Stack>
            </Paper>
          </Grid>

          {/* Clinical Information */}
          <Grid item xs={12}>
            <Paper 
              sx={{ 
                p: 2,
                borderRadius: getBorderRadius('lg'),
                background: clinicalTokens.gradients.backgroundCard
              }}
            >
              <Typography variant="subtitle2" color="primary" gutterBottom>
                Clinical Information (Optional)
              </Typography>
              <Stack spacing={2}>
                <Autocomplete
                  options={[
                    { code: 'chest-pain', display: 'Chest pain' },
                    { code: 'shortness-breath', display: 'Shortness of breath' },
                    { code: 'abdominal-pain', display: 'Abdominal pain' },
                    { code: 'routine-screening', display: 'Routine screening' },
                    { code: 'follow-up', display: 'Follow-up' }
                  ]}
                  getOptionLabel={(option) => option.display}
                  value={formData.reasonCode}
                  onChange={(event, newValue) => setFormData(prev => ({ ...prev, reasonCode: newValue }))}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Clinical Indication"
                      placeholder="Why are these orders being placed?"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: getBorderRadius('md')
                        }
                      }}
                    />
                  )}
                />

                <TextField
                  label="Special Instructions (Optional)"
                  multiline
                  rows={2}
                  value={formData.specialInstructions}
                  onChange={(e) => setFormData(prev => ({ ...prev, specialInstructions: e.target.value }))}
                  placeholder="Any special instructions for the lab/imaging team..."
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: getBorderRadius('md')
                    }
                  }}
                />

                <TextField
                  label="Patient Instructions (Optional)"
                  multiline
                  rows={2}
                  value={formData.patientInstructions}
                  onChange={(e) => setFormData(prev => ({ ...prev, patientInstructions: e.target.value }))}
                  placeholder="Instructions for the patient (e.g., fasting requirements)..."
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: getBorderRadius('md')
                    }
                  }}
                />
              </Stack>
            </Paper>
          </Grid>

          {/* Appropriateness Score */}
          {selectedCategory === 'imaging' && appropriatenessScore !== null && (
            <Grid item xs={12}>
              <Alert 
                severity={
                  appropriatenessScore >= 7 ? 'success' : 
                  appropriatenessScore >= 4 ? 'warning' : 
                  'error'
                }
                sx={{ borderRadius: getBorderRadius('md') }}
              >
                <AlertTitle>Appropriateness Score: {appropriatenessScore}/9</AlertTitle>
                <Typography variant="body2">
                  {appropriatenessScore >= 7 ? 
                    'This imaging study is appropriate for the clinical indication.' :
                    appropriatenessScore >= 4 ?
                    'Consider clinical justification for this imaging study.' :
                    'This imaging study may not be appropriate. Consider alternatives.'
                  }
                </Typography>
              </Alert>
            </Grid>
          )}
        </Grid>
      </Box>
    </Fade>
  );

  const ReviewAndConfirmStep = () => {
    const priorityConfig = PRIORITY_CONFIG[formData.priority];
    
    return (
      <Fade in={activeStep === 2}>
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Review your orders before submitting.
          </Typography>

          {/* Order Summary Card */}
          <Paper 
            sx={{ 
              p: 3,
              mb: 3,
              borderRadius: getBorderRadius('lg'),
              background: clinicalTokens.gradients.backgroundCard,
              boxShadow: getElevationShadow(2)
            }}
          >
            <Typography variant="h6" gutterBottom>
              Order Summary
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={6}>
                <Typography variant="overline" color="text.secondary">Total Orders</Typography>
                <Typography variant="h3" color="primary">
                  {selectedOrders.length}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="overline" color="text.secondary">Priority</Typography>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography variant="h5">{priorityConfig.icon}</Typography>
                  <Box>
                    <Typography variant="h6" color={priorityConfig.color === 'default' ? 'primary' : `${priorityConfig.color}.main`}>
                      {priorityConfig.label}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {priorityConfig.timeframe}
                    </Typography>
                  </Box>
                </Stack>
              </Grid>
            </Grid>

            <Divider sx={{ my: 2 }} />

            {/* Orders List */}
            <Typography variant="subtitle2" gutterBottom>
              Orders to be Placed:
            </Typography>
            <List dense>
              {selectedOrders.map((order, index) => (
                <ListItem 
                  key={order.id}
                  sx={{
                    borderRadius: getBorderRadius('sm'),
                    mb: 0.5,
                    background: alpha(theme.palette.background.default, 0.5)
                  }}
                >
                  <ListItemIcon>
                    <Badge badgeContent={index + 1} color="primary">
                      {CATEGORY_CONFIG[order.category].icon}
                    </Badge>
                  </ListItemIcon>
                  <ListItemText
                    primary={order.code?.text}
                    secondary={CATEGORY_CONFIG[order.category].label}
                  />
                </ListItem>
              ))}
            </List>

            {/* Clinical Details */}
            {(formData.reasonCode || formData.scheduleType === 'scheduled') && (
              <>
                <Divider sx={{ my: 2 }} />
                <Stack spacing={1}>
                  {formData.reasonCode && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Clinical Indication:
                      </Typography>
                      <Typography variant="body2">
                        {formData.reasonCode.display}
                      </Typography>
                    </Box>
                  )}
                  {formData.scheduleType === 'scheduled' && formData.occurrenceDateTime && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Scheduled For:
                      </Typography>
                      <Typography variant="body2">
                        {format(new Date(formData.occurrenceDateTime), 'MMM d, yyyy h:mm a')}
                      </Typography>
                    </Box>
                  )}
                </Stack>
              </>
            )}
          </Paper>

          {/* CDS Alerts */}
          {cdsAlerts.length > 0 && (
            <Stack spacing={1} sx={{ mb: 3 }}>
              {cdsAlerts.map((alert, index) => (
                <Alert 
                  key={index}
                  severity={alert.indicator === 'critical' ? 'error' : 
                           alert.indicator === 'warning' ? 'warning' : 'info'}
                  icon={alert.indicator === 'critical' ? <WarningIcon /> : <InfoIcon />}
                  sx={{ borderRadius: getBorderRadius('md') }}
                >
                  {alert.summary}
                </Alert>
              ))}
            </Stack>
          )}

          {/* Instructions Summary */}
          {(formData.specialInstructions || formData.patientInstructions) && (
            <Paper 
              sx={{ 
                p: 2,
                borderRadius: getBorderRadius('lg'),
                background: alpha(theme.palette.info.main, 0.04),
                border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`
              }}
            >
              <Typography variant="subtitle2" color="info.main" gutterBottom>
                Instructions
              </Typography>
              {formData.specialInstructions && (
                <Box sx={{ mb: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Special Instructions:
                  </Typography>
                  <Typography variant="body2">
                    {formData.specialInstructions}
                  </Typography>
                </Box>
              )}
              {formData.patientInstructions && (
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Patient Instructions:
                  </Typography>
                  <Typography variant="body2">
                    {formData.patientInstructions}
                  </Typography>
                </Box>
              )}
            </Paper>
          )}
        </Box>
      </Fade>
    );
  };

  const steps = [
    { label: 'Select Orders', icon: <SearchIcon /> },
    { label: 'Details & Priority', icon: <ScheduleIcon /> },
    { label: 'Review & Confirm', icon: <ReviewIcon /> }
  ];

  // Convert CDS alerts to dialog alerts
  const dialogAlerts = [
    ...alerts,
    ...cdsAlerts.map(alert => ({
      severity: alert.indicator === 'critical' ? 'error' : 
                alert.indicator === 'warning' ? 'warning' : 'info',
      message: alert.summary
    }))
  ];

  return (
    <SimplifiedClinicalDialog
      open={open}
      onClose={onClose}
      title="Place Clinical Orders"
      subtitle={`For ${patient?.name?.[0]?.given?.join(' ')} ${patient?.name?.[0]?.family || ''}`}
      category="order"
      loading={loading}
      alerts={dialogAlerts}
      maxWidth="md"
      actions={[
        {
          label: activeStep === 0 ? 'Cancel' : 'Back',
          onClick: activeStep === 0 ? onClose : handleBack,
          variant: 'outlined',
          startIcon: activeStep > 0 ? <BackIcon /> : null
        },
        ...(activeStep < steps.length - 1 ? [{
          label: 'Next',
          onClick: handleNext,
          variant: 'contained',
          color: 'primary',
          endIcon: <NextIcon />,
          disabled: activeStep === 0 && selectedOrders.length === 0
        }] : [{
          label: 'Place Orders',
          onClick: handleSave,
          variant: 'contained',
          color: 'primary',
          startIcon: <CheckIcon />,
          disabled: saving || selectedOrders.length === 0
        }])
      ]}
    >
      {/* Progress Bar */}
      <LinearProgress 
        variant="determinate" 
        value={(activeStep + 1) / steps.length * 100}
        sx={{ 
          mb: 3,
          height: 6,
          borderRadius: getBorderRadius('pill'),
          backgroundColor: alpha(theme.palette.primary.main, 0.1),
          '& .MuiLinearProgress-bar': {
            borderRadius: getBorderRadius('pill'),
            background: clinicalTokens.gradients.primary
          }
        }}
      />

      {/* Step Indicators */}
      <Stack direction="row" justifyContent="center" spacing={2} sx={{ mb: 4 }}>
        {steps.map((step, index) => (
          <Stack key={index} alignItems="center" spacing={0.5}>
            <Paper
              elevation={0}
              sx={{
                width: 48,
                height: 48,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                background: index <= activeStep 
                  ? clinicalTokens.gradients.primary
                  : alpha(theme.palette.action.disabled, 0.1),
                color: index <= activeStep ? 'white' : 'text.disabled',
                ...getSmoothTransition(['all'])
              }}
            >
              {index < activeStep ? <CheckIcon /> : step.icon}
            </Paper>
            <Typography 
              variant="caption" 
              color={index <= activeStep ? 'primary' : 'text.disabled'}
              fontWeight={index === activeStep ? 600 : 400}
            >
              {step.label}
            </Typography>
          </Stack>
        ))}
      </Stack>

      {/* Step Content */}
      <Box sx={{ minHeight: 400 }}>
        {activeStep === 0 && <OrderSelectionStep />}
        {activeStep === 1 && <DetailsAndPriorityStep />}
        {activeStep === 2 && <ReviewAndConfirmStep />}
      </Box>
    </SimplifiedClinicalDialog>
  );
};

export default OrderDialogWizard;