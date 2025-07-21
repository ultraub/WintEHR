/**
 * OrderDialog Component
 * FHIR-compliant dialog for placing clinical orders (labs, imaging, procedures)
 * Integrates CDS hooks for appropriateness criteria and clinical guidance
 * 
 * Updated 2025-01-21: Simplified UI with reduced icons and new fhirClient
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Grid,
  Stack,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  AlertTitle,
  CircularProgress,
  Tabs,
  Tab,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Button,
  ButtonGroup,
  FormControlLabel,
  Switch,
  TextField,
  Autocomplete,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  useTheme,
  alpha
} from '@mui/material';
import {
  Delete as DeleteIcon,
  ExpandMore as ExpandIcon,
  Add as AddIcon
} from '@mui/icons-material';
import SimplifiedClinicalDialog from '../../common/SimplifiedClinicalDialog';
import { fhirClient } from '../../../../core/fhir/services/fhirClient';
import { notificationService } from '../../../../services/notificationService';
import { clinicalCDSService } from '../../../../services/clinicalCDSService';
import { getClinicalCatalog } from '../../../../services/cdsClinicalDataService';
import { format, addDays } from 'date-fns';
import type { ServiceRequest } from '../../../../core/fhir/types';

// Order category options
const CATEGORY_OPTIONS = [
  { value: 'laboratory', label: 'Laboratory', color: '#2196f3' },
  { value: 'imaging', label: 'Imaging', color: '#9c27b0' },
  { value: 'procedure', label: 'Procedure', color: '#ff9800' }
];

// Priority options
const PRIORITY_OPTIONS = [
  { value: 'routine', label: 'Routine', description: 'Normal processing' },
  { value: 'urgent', label: 'Urgent', description: 'Expedited processing' },
  { value: 'asap', label: 'ASAP', description: 'As soon as possible' },
  { value: 'stat', label: 'STAT', description: 'Immediate processing' }
];

// Common lab panels
const LAB_PANELS = {
  'basic-metabolic': {
    name: 'Basic Metabolic Panel',
    code: '51990-0',
    components: ['Glucose', 'BUN', 'Creatinine', 'Sodium', 'Potassium', 'Chloride', 'CO2']
  },
  'complete-metabolic': {
    name: 'Comprehensive Metabolic Panel',
    code: '24323-8',
    components: ['BMP components', 'Albumin', 'Total protein', 'ALT', 'AST', 'Bilirubin']
  },
  'cbc': {
    name: 'Complete Blood Count',
    code: '58410-2',
    components: ['WBC', 'RBC', 'Hemoglobin', 'Hematocrit', 'Platelets', 'Differential']
  },
  'lipid': {
    name: 'Lipid Panel',
    code: '57698-3',
    components: ['Total cholesterol', 'LDL', 'HDL', 'Triglycerides']
  }
};

// Common imaging studies
const IMAGING_STUDIES = {
  'chest-xray': {
    name: 'Chest X-ray',
    modality: 'XR',
    appropriateness: ['Pneumonia', 'CHF', 'COPD exacerbation']
  },
  'ct-head': {
    name: 'CT Head without contrast',
    modality: 'CT',
    appropriateness: ['Head trauma', 'Stroke', 'Altered mental status']
  },
  'ct-abdomen': {
    name: 'CT Abdomen/Pelvis with contrast',
    modality: 'CT',
    appropriateness: ['Abdominal pain', 'Appendicitis', 'Diverticulitis']
  }
};

const OrderDialog = ({
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
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState(defaultCategory || 'laboratory');
  const [orderCatalog, setOrderCatalog] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [cdsAlerts, setCdsAlerts] = useState([]);
  
  // Form state
  const [formData, setFormData] = useState({
    priority: 'routine',
    occurrenceDateTime: '',
    reasonCode: null,
    bodySite: null,
    specimen: '',
    specialInstructions: '',
    patientInstructions: ''
  });
  
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [checkingAppropriateness, setCheckingAppropriateness] = useState(false);
  const [appropriatenessScore, setAppropriatenessScore] = useState(null);

  // Load order catalog based on category
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
      } catch (error) {
        console.error('Failed to load order catalog:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadCatalog();
  }, [selectedCategory, open]);
  
  // Initialize form for edit mode
  useEffect(() => {
    if (order && mode === 'edit') {
      // Parse existing order data
      setSelectedCategory(order.category?.[0]?.coding?.[0]?.code || 'laboratory');
      setFormData({
        priority: order.priority || 'routine',
        occurrenceDateTime: order.occurrenceDateTime || '',
        reasonCode: order.reasonCode?.[0] || null,
        bodySite: order.bodySite?.[0] || null,
        specimen: order.specimen?.[0]?.type || '',
        specialInstructions: order.note?.[0]?.text || '',
        patientInstructions: order.patientInstruction || ''
      });
      setSelectedOrders([{
        id: order.id,
        code: order.code,
        priority: order.priority
      }]);
    }
  }, [order, mode]);

  // Field change handler
  const handleFieldChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  // Add order to list
  const handleAddOrder = (orderCode, orderDetails = {}) => {
    const newOrder = {
      id: `order-${Date.now()}-${Math.random()}`,
      code: orderCode,
      priority: formData.priority,
      ...orderDetails
    };
    
    setSelectedOrders(prev => [...prev, newOrder]);
    
    // Check appropriateness for each order
    checkOrderAppropriateness([...selectedOrders, newOrder]);
  };

  // Remove order from list
  const handleRemoveOrder = (orderId) => {
    setSelectedOrders(prev => prev.filter(o => o.id !== orderId));
  };

  // Check order appropriateness and fire CDS hooks
  const checkOrderAppropriateness = async (orders) => {
    if (!patient || orders.length === 0) return;
    
    setCheckingAppropriateness(true);
    try {
      // Fire CDS hooks for order entry
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
              display: CATEGORY_OPTIONS.find(c => c.value === selectedCategory)?.label
            }]
          }]
        })),
        operation: 'create'
      });
      
      if (cdsResult.alerts && cdsResult.alerts.length > 0) {
        setCdsAlerts(cdsResult.alerts);
      }
      
      // Simple appropriateness scoring for imaging
      if (selectedCategory === 'imaging' && formData.reasonCode) {
        // Basic scoring based on indication
        const score = formData.reasonCode ? 7 : 4;
        setAppropriatenessScore(score);
      }
    } catch (error) {
      console.error('Failed to check appropriateness:', error);
    } finally {
      setCheckingAppropriateness(false);
    }
  };

  // Handle save
  const handleSave = async () => {
    try {
      setSaving(true);
      setAlerts([]);
      
      // Validate
      if (selectedOrders.length === 0) {
        setAlerts([{ severity: 'error', message: 'Please select at least one order' }]);
        return;
      }
      
      // Create ServiceRequest resources
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
              display: CATEGORY_OPTIONS.find(c => c.value === selectedCategory)?.label
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
        if (formData.occurrenceDateTime) {
          serviceRequest.occurrenceDateTime = new Date(formData.occurrenceDateTime).toISOString();
        }
        
        if (formData.reasonCode) {
          serviceRequest.reasonCode = [formData.reasonCode];
        }
        
        if (formData.bodySite && selectedCategory === 'imaging') {
          serviceRequest.bodySite = [formData.bodySite];
        }
        
        if (formData.specimen && selectedCategory === 'laboratory') {
          serviceRequest.specimen = [{
            type: formData.specimen,
            collectedDateTime: new Date().toISOString()
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
        
        let result;
        if (mode === 'edit' && order.id) {
          result = await fhirClient.update('ServiceRequest', order.id, {
            ...serviceRequest,
            id: order.id
          } as ServiceRequest);
        } else {
          result = await fhirClient.create('ServiceRequest', serviceRequest);
        }
        
        serviceRequests.push(result);
      }
      
      // Notify success
      notificationService.success(`Successfully ${mode === 'edit' ? 'updated' : 'created'} ${serviceRequests.length} order(s)`);
      
      // Call parent callback
      if (onSave) {
        onSave(serviceRequests);
      }
      
      onClose();
    } catch (error) {
      console.error('Failed to save orders:', error);
      notificationService.fhirError(error, {
        operation: mode === 'edit' ? 'UPDATE' : 'CREATE',
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

  // Convert CDS alerts to dialog alerts
  const dialogAlerts = [
    ...alerts,
    ...cdsAlerts.map(alert => ({
      severity: alert.indicator === 'critical' ? 'error' : 
                alert.indicator === 'warning' ? 'warning' : 'info',
      message: alert.summary
    }))
  ];

  // Calculate order summary
  const orderSummary = useMemo(() => {
    const byPriority = {};
    selectedOrders.forEach(order => {
      const priority = order.priority || formData.priority;
      byPriority[priority] = (byPriority[priority] || 0) + 1;
    });
    
    return {
      total: selectedOrders.length,
      byPriority
    };
  }, [selectedOrders, formData.priority]);

  // Get category color
  const getCategoryColor = (category) => {
    return CATEGORY_OPTIONS.find(c => c.value === category)?.color || theme.palette.grey[500];
  };
  
  // Get priority color
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'stat':
      case 'asap':
        return theme.palette.error.main;
      case 'urgent':
        return theme.palette.warning.main;
      default:
        return theme.palette.text.secondary;
    }
  };
  
  // Tab panels
  const renderOrderSelectionTab = () => (
    <Stack spacing={3}>
      {/* Appropriateness checking */}
      {checkingAppropriateness && (
        <Alert severity="info">
          <CircularProgress size={16} sx={{ mr: 1 }} />
          Checking clinical appropriateness and guidelines...
        </Alert>
      )}
      
      {/* Appropriateness score for imaging */}
      {selectedCategory === 'imaging' && appropriatenessScore !== null && (
        <Alert 
          severity={
            appropriatenessScore >= 7 ? 'success' : 
            appropriatenessScore >= 4 ? 'warning' : 
            'error'
          }
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
      )}
      
      {/* Category selection */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom color="primary">
          Order Category
        </Typography>
        <ButtonGroup fullWidth>
          {CATEGORY_OPTIONS.map(category => (
            <Button
              key={category.value}
              variant={selectedCategory === category.value ? 'contained' : 'outlined'}
              onClick={() => setSelectedCategory(category.value)}
              sx={{
                backgroundColor: selectedCategory === category.value ? category.color : 'transparent',
                borderColor: category.color,
                color: selectedCategory === category.value ? 'white' : category.color,
                '&:hover': {
                  backgroundColor: selectedCategory === category.value ? 
                    category.color : 
                    alpha(category.color, 0.08)
                }
              }}
            >
              {category.label}
            </Button>
          ))}
        </ButtonGroup>
      </Paper>
      
      {/* Order search/selection based on category */}
      {selectedCategory === 'laboratory' && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle2" gutterBottom color="primary">
            Select Laboratory Tests
          </Typography>
          <Grid container spacing={1}>
            {Object.entries(LAB_PANELS).map(([key, panel]) => (
              <Grid item xs={12} sm={6} key={key}>
                <Paper
                  variant="outlined"
                  sx={{ 
                    p: 2, 
                    cursor: 'pointer',
                    '&:hover': { 
                      backgroundColor: alpha(theme.palette.primary.main, 0.08) 
                    }
                  }}
                  onClick={() => handleAddOrder({
                    coding: [{
                      system: 'http://loinc.org',
                      code: panel.code,
                      display: panel.name
                    }],
                    text: panel.name
                  })}
                >
                  <Typography variant="body2" fontWeight="medium">
                    {panel.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {panel.components.join(', ')}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
          
          {/* Individual lab search */}
          <Box sx={{ mt: 2 }}>
            <Autocomplete
              options={orderCatalog}
              getOptionLabel={(option) => option.display || option.name || ''}
              value={null}
              onChange={(event, newValue) => {
                if (newValue) {
                  handleAddOrder({
                    coding: [{
                      system: 'http://loinc.org',
                      code: newValue.code,
                      display: newValue.display
                    }],
                    text: newValue.display
                  });
                }
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Search Individual Labs"
                  placeholder="Search by lab name or code..."
                  variant="outlined"
                  size="small"
                  fullWidth
                />
              )}
            />
          </Box>
        </Paper>
      )}
      
      {selectedCategory === 'imaging' && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle2" gutterBottom color="primary">
            Select Imaging Studies
          </Typography>
          <Grid container spacing={1}>
            {Object.entries(IMAGING_STUDIES).map(([key, study]) => (
              <Grid item xs={12} sm={6} key={key}>
                <Paper
                  variant="outlined"
                  sx={{ 
                    p: 2, 
                    cursor: 'pointer',
                    '&:hover': { 
                      backgroundColor: alpha(theme.palette.secondary.main, 0.08) 
                    }
                  }}
                  onClick={() => handleAddOrder({
                    coding: [{
                      system: 'http://loinc.org',
                      code: key,
                      display: study.name
                    }],
                    text: study.name
                  }, {
                    modality: study.modality
                  })}
                >
                  <Typography variant="body2" fontWeight="medium">
                    {study.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Appropriate for: {study.appropriateness.join(', ')}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
          
          {/* Individual imaging search */}
          <Box sx={{ mt: 2 }}>
            <Autocomplete
              options={orderCatalog}
              getOptionLabel={(option) => option.display || option.name || ''}
              value={null}
              onChange={(event, newValue) => {
                if (newValue) {
                  handleAddOrder({
                    coding: [{
                      system: 'http://loinc.org',
                      code: newValue.code,
                      display: newValue.display
                    }],
                    text: newValue.display
                  });
                }
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Search Imaging Studies"
                  placeholder="Search by study name..."
                  variant="outlined"
                  size="small"
                  fullWidth
                />
              )}
            />
          </Box>
        </Paper>
      )}
      
      {/* Selected orders list */}
      {selectedOrders.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle2" gutterBottom color="primary">
            Selected Orders ({selectedOrders.length})
          </Typography>
          <List dense>
            {selectedOrders.map((order) => (
              <ListItem
                key={order.id}
                secondaryAction={
                  <IconButton
                    edge="end"
                    onClick={() => handleRemoveOrder(order.id)}
                    size="small"
                  >
                    <DeleteIcon />
                  </IconButton>
                }
              >
                <ListItemText
                  primary={order.code?.text || order.code?.coding?.[0]?.display}
                  secondary={
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip 
                        label={order.priority || formData.priority}
                        size="small"
                        sx={{
                          backgroundColor: alpha(getPriorityColor(order.priority || formData.priority), 0.1),
                          color: getPriorityColor(order.priority || formData.priority)
                        }}
                      />
                      {order.modality && (
                        <Typography variant="caption" color="text.secondary">
                          {order.modality}
                        </Typography>
                      )}
                    </Stack>
                  }
                />
              </ListItem>
            ))}
          </List>
        </Paper>
      )}
    </Stack>
  );

  const renderOrderDetailsTab = () => (
    <Stack spacing={3}>
      {/* Priority */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom color="primary">
          Order Priority
        </Typography>
        <FormControl fullWidth size="small" required>
          <InputLabel>Priority</InputLabel>
          <Select
            value={formData.priority}
            onChange={(e) => handleFieldChange('priority', e.target.value)}
            label="Priority"
          >
            {PRIORITY_OPTIONS.map(option => (
              <MenuItem key={option.value} value={option.value}>
                <Stack spacing={0.5}>
                  <Typography 
                    variant="body2"
                    color={getPriorityColor(option.value)}
                    fontWeight={option.value === 'stat' ? 'bold' : 'normal'}
                  >
                    {option.label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {option.description}
                  </Typography>
                </Stack>
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Paper>
      
      {/* Timing */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom color="primary">
          Timing & Schedule
        </Typography>
        <TextField
          label="Perform Date/Time"
          type="datetime-local"
          value={formData.occurrenceDateTime}
          onChange={(e) => handleFieldChange('occurrenceDateTime', e.target.value)}
          fullWidth
          size="small"
          InputLabelProps={{ shrink: true }}
          helperText="When should this order be performed?"
        />
      </Paper>
      
      {/* Clinical information */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom color="primary">
          Clinical Information
        </Typography>
        <Stack spacing={2}>
          <Autocomplete
            options={[
              { code: 'chest-pain', display: 'Chest pain' },
              { code: 'shortness-breath', display: 'Shortness of breath' },
              { code: 'abdominal-pain', display: 'Abdominal pain' },
              { code: 'headache', display: 'Headache' },
              { code: 'fever', display: 'Fever' }
            ]}
            getOptionLabel={(option) => option.display}
            value={formData.reasonCode}
            onChange={(event, newValue) => handleFieldChange('reasonCode', newValue)}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Clinical Indication"
                placeholder="Why is this order being placed?"
                variant="outlined"
                size="small"
                fullWidth
              />
            )}
          />
          
          {/* Body site for imaging */}
          {selectedCategory === 'imaging' && (
            <TextField
              label="Body Site"
              value={formData.bodySite || ''}
              onChange={(e) => handleFieldChange('bodySite', e.target.value)}
              fullWidth
              size="small"
              placeholder="Anatomical location for imaging"
            />
          )}
          
          {/* Specimen for labs */}
          {selectedCategory === 'laboratory' && (
            <FormControl fullWidth size="small">
              <InputLabel>Specimen Type</InputLabel>
              <Select
                value={formData.specimen}
                onChange={(e) => handleFieldChange('specimen', e.target.value)}
                label="Specimen Type"
              >
                <MenuItem value="">Not specified</MenuItem>
                <MenuItem value="blood">Blood</MenuItem>
                <MenuItem value="urine">Urine</MenuItem>
                <MenuItem value="stool">Stool</MenuItem>
                <MenuItem value="sputum">Sputum</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </Select>
            </FormControl>
          )}
        </Stack>
      </Paper>
      
      {/* Instructions */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom color="primary">
          Instructions
        </Typography>
        <Stack spacing={2}>
          <TextField
            label="Special Instructions"
            value={formData.specialInstructions}
            onChange={(e) => handleFieldChange('specialInstructions', e.target.value)}
            multiline
            rows={2}
            fullWidth
            size="small"
            placeholder="Any special instructions for this order..."
          />
          
          <TextField
            label="Patient Instructions"
            value={formData.patientInstructions}
            onChange={(e) => handleFieldChange('patientInstructions', e.target.value)}
            multiline
            rows={2}
            fullWidth
            size="small"
            placeholder="Instructions for the patient (e.g., fasting requirements)..."
          />
        </Stack>
      </Paper>
    </Stack>
  );

  const renderReviewTab = () => (
    <Stack spacing={3}>
      {/* Order summary */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom color="primary">
          Order Summary
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <Typography variant="caption" color="text.secondary">
              Total Orders
            </Typography>
            <Typography variant="h4">
              {orderSummary.total}
            </Typography>
          </Grid>
          
          <Grid item xs={12} sm={8}>
            <Typography variant="caption" color="text.secondary">
              By Priority
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              {Object.entries(orderSummary.byPriority).map(([priority, count]) => (
                <Chip
                  key={priority}
                  label={`${priority}: ${count}`}
                  size="small"
                  sx={{
                    backgroundColor: alpha(getPriorityColor(priority), 0.1),
                    color: getPriorityColor(priority)
                  }}
                />
              ))}
            </Stack>
          </Grid>
        </Grid>
      </Paper>
      
      {/* Orders to be placed */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom color="primary">
          Orders to be Placed
        </Typography>
        <List dense>
          {selectedOrders.map(order => (
            <ListItem key={order.id}>
              <ListItemText
                primary={order.code?.text || order.code?.coding?.[0]?.display}
                secondary={
                  <Stack spacing={0.5}>
                    <Typography variant="caption">
                      Priority: {order.priority || formData.priority}
                    </Typography>
                    {formData.occurrenceDateTime && (
                      <Typography variant="caption">
                        Scheduled: {format(new Date(formData.occurrenceDateTime), 'MMM d, yyyy h:mm a')}
                      </Typography>
                    )}
                  </Stack>
                }
              />
            </ListItem>
          ))}
        </List>
      </Paper>
      
      {/* Clinical information */}
      {(formData.reasonCode || formData.specialInstructions || formData.patientInstructions) && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle2" gutterBottom color="primary">
            Clinical Information
          </Typography>
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
            {formData.specialInstructions && (
              <Box>
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
          </Stack>
        </Paper>
      )}
      
      {/* Safety check */}
      <Alert 
        severity={cdsAlerts.some(a => a.indicator === 'critical') ? 'error' : 'success'}
      >
        <AlertTitle>Clinical Decision Support</AlertTitle>
        {cdsAlerts.length === 0 ? (
          <Typography variant="body2">
            ✓ No clinical alerts or warnings for these orders
          </Typography>
        ) : (
          <Typography variant="body2">
            {cdsAlerts.filter(a => a.indicator === 'critical').length} critical alerts,{' '}
            {cdsAlerts.filter(a => a.indicator === 'warning').length} warnings
          </Typography>
        )}
      </Alert>
    </Stack>
  );

  return (
    <SimplifiedClinicalDialog
      open={open}
      onClose={onClose}
      title={mode === 'edit' ? 'Edit Order' : 'Place Orders'}
      subtitle={`For ${patient?.name?.[0]?.given?.join(' ')} ${patient?.name?.[0]?.family || ''}`}
      category="order"
      loading={loading}
      alerts={dialogAlerts}
      maxWidth="md"
      actions={[
        {
          label: 'Cancel',
          onClick: onClose,
          variant: 'outlined'
        },
        {
          label: mode === 'edit' ? 'Update Orders' : 'Place Orders',
          onClick: handleSave,
          variant: 'contained',
          color: 'primary',
          disabled: saving || selectedOrders.length === 0
        }
      ]}
    >
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)}>
          <Tab label="Select Orders" />
          <Tab label="Order Details" disabled={selectedOrders.length === 0} />
          <Tab label="Review & Submit" disabled={selectedOrders.length === 0} />
        </Tabs>
      </Box>
      
      <Box sx={{ mt: 2 }}>
        {activeTab === 0 && renderOrderSelectionTab()}
        {activeTab === 1 && renderOrderDetailsTab()}
        {activeTab === 2 && renderReviewTab()}
      </Box>
    </SimplifiedClinicalDialog>
  );
};

export default OrderDialog;