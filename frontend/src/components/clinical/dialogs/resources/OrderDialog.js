/**
 * OrderDialog Component
 * FHIR-compliant dialog for placing clinical orders (labs, imaging, procedures)
 * Integrates CDS hooks for appropriateness criteria and clinical guidance
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
  ListItemIcon,
  ListItemSecondaryAction,
  IconButton,
  Tooltip,
  Button,
  ButtonGroup,
  FormControlLabel,
  Radio,
  RadioGroup,
  Switch,
  Divider,
  TextField,
  Autocomplete,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Badge,
  useTheme,
  alpha
} from '@mui/material';
import {
  Science as LabIcon,
  CameraAlt as ImagingIcon,
  MedicalServices as ProcedureIcon,
  Assignment as OrderIcon,
  Schedule as ScheduleIcon,
  LocalShipping as TransportIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandIcon,
  Favorite as FavoriteIcon,
  History as HistoryIcon,
  TrendingUp as StatIcon,
  LocationOn as LocationIcon,
  AttachMoney as CostIcon
} from '@mui/icons-material';
import ClinicalDialog from '../base/ClinicalDialog';
import ClinicalTextField from '../fields/ClinicalTextField';
import ClinicalDatePicker from '../fields/ClinicalDatePicker';
import ClinicalCodeSelector from '../fields/ClinicalCodeSelector';
import CDSAlertPresenter, { ALERT_MODES } from '../../cds/CDSAlertPresenter';
import { clinicalCDSService } from '../../../../services/clinicalCDSService';
import { orderService } from '../../../../services/orderService';
import { format, addDays } from 'date-fns';

// Order category options
const CATEGORY_OPTIONS = [
  { value: 'laboratory', label: 'Laboratory', icon: LabIcon, color: 'primary' },
  { value: 'imaging', label: 'Imaging', icon: ImagingIcon, color: 'secondary' },
  { value: 'procedure', label: 'Procedure', icon: ProcedureIcon, color: 'warning' }
];

// Priority options
const PRIORITY_OPTIONS = [
  { value: 'routine', label: 'Routine', color: 'default', description: 'Normal processing' },
  { value: 'urgent', label: 'Urgent', color: 'warning', description: 'Expedited processing' },
  { value: 'asap', label: 'ASAP', color: 'error', description: 'As soon as possible' },
  { value: 'stat', label: 'STAT', color: 'error', description: 'Immediate processing', badge: true }
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
  },
  'thyroid': {
    name: 'Thyroid Function',
    code: '55204-3',
    components: ['TSH', 'Free T4', 'Free T3']
  }
};

// Common imaging studies
const IMAGING_STUDIES = {
  'chest-xray': {
    name: 'Chest X-ray',
    modality: 'XR',
    views: ['PA', 'Lateral'],
    appropriateness: ['Pneumonia', 'CHF', 'COPD exacerbation']
  },
  'ct-head': {
    name: 'CT Head without contrast',
    modality: 'CT',
    contrast: false,
    appropriateness: ['Head trauma', 'Stroke', 'Altered mental status']
  },
  'ct-abdomen': {
    name: 'CT Abdomen/Pelvis with contrast',
    modality: 'CT',
    contrast: true,
    appropriateness: ['Abdominal pain', 'Appendicitis', 'Diverticulitis']
  },
  'mri-brain': {
    name: 'MRI Brain',
    modality: 'MR',
    appropriateness: ['MS', 'Tumor', 'Seizure']
  },
  'ultrasound-abdomen': {
    name: 'Ultrasound Abdomen',
    modality: 'US',
    appropriateness: ['Gallstones', 'Liver disease', 'Pregnancy']
  }
};

const OrderDialog = ({
  open,
  onClose,
  mode = 'create',
  order = null,
  patient,
  onSave,
  clinicalContext = {},
  defaultCategory = null
}) => {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState(defaultCategory || 'laboratory');
  const [formData, setFormData] = useState({
    status: 'draft',
    intent: 'order',
    priority: 'routine',
    category: [],
    code: null,
    subject: null,
    encounter: null,
    authoredOn: new Date().toISOString(),
    requester: null,
    performerType: null,
    performer: null,
    locationReference: null,
    reasonCode: [],
    reasonReference: [],
    insurance: [],
    supportingInfo: [],
    specimen: [],
    bodySite: [],
    note: [],
    patientInstruction: '',
    relevantHistory: [],
    quantity: { value: 1 },
    doNotPerform: false,
    asNeededBoolean: false,
    asNeededCodeableConcept: null,
    occurrenceDateTime: null,
    occurrencePeriod: null
  });
  
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [cdsAlerts, setCdsAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checkingAppropriateness, setCheckingAppropriateness] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [orderSets, setOrderSets] = useState([]);
  const [appropriatenessScore, setAppropriatenessScore] = useState(null);

  // Initialize form data
  useEffect(() => {
    if (order && mode === 'edit') {
      setFormData(order);
      setSelectedCategory(order.category?.[0]?.coding?.[0]?.code || 'laboratory');
    }
    loadOrderData();
  }, [order, mode]);

  // Load favorites and recent orders
  const loadOrderData = async () => {
    try {
      // Load provider's favorite orders
      const favs = await orderService.getFavoriteOrders(clinicalContext.user?.id);
      setFavorites(favs);
      
      // Load recent orders
      const recent = await orderService.getRecentOrders(clinicalContext.user?.id);
      setRecentOrders(recent);
      
      // Load order sets
      const sets = await orderService.getOrderSets(clinicalContext.user?.id);
      setOrderSets(sets);
    } catch (error) {
      console.error('Failed to load order data:', error);
    }
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
      // Format orders for CDS
      const formattedOrders = orders.map(order => ({
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
      }));
      
      // Fire CDS hooks for order entry
      const cdsResult = await clinicalCDSService.fireLabOrderHooks({
        patient,
        orders: formattedOrders,
        user: clinicalContext.user
      });
      
      // Update CDS alerts
      setCdsAlerts(cdsResult.alerts);
      
      // Calculate appropriateness score
      if (selectedCategory === 'imaging') {
        const score = await orderService.calculateAppropriatenessScore(
          orders[0]?.code,
          clinicalContext.conditions || []
        );
        setAppropriatenessScore(score);
      }
      
      // Set form alerts based on CDS results
      if (cdsResult.hasCritical) {
        setAlerts([{
          severity: 'error',
          message: 'Critical alerts detected. Review before placing orders.'
        }]);
      }
      if (cdsResult.hasWarnings) {
        setWarnings([{
          severity: 'warning',
          message: 'Clinical warnings detected. Review recommendations.'
        }]);
      }
    } catch (error) {
      console.error('Failed to check appropriateness:', error);
    } finally {
      setCheckingAppropriateness(false);
    }
  };

  // Handle CDS alert actions
  const handleCDSAction = async (action, alert) => {
    console.log('CDS action:', action, alert);
    
    if (action.uuid === 'suggest-alternative') {
      // Show alternative orders
      setActiveTab(0); // Go back to order selection
    } else if (action.uuid === 'review-guidelines') {
      // Open clinical guidelines
      if (action.resource?.url) {
        window.open(action.resource.url, '_blank');
      }
    }
  };

  // Use favorite order
  const handleUseFavorite = (favorite) => {
    handleAddOrder(favorite.code, {
      priority: favorite.defaultPriority,
      instructions: favorite.defaultInstructions
    });
  };

  // Use order set
  const handleUseOrderSet = (orderSet) => {
    orderSet.orders.forEach(order => {
      handleAddOrder(order.code, order);
    });
  };

  // Validation
  const handleValidate = async (data) => {
    const errors = [];
    
    if (selectedOrders.length === 0) {
      errors.push({ field: 'orders', message: 'At least one order is required' });
    }
    
    if (!data.priority) {
      errors.push({ field: 'priority', message: 'Priority is required' });
    }
    
    // Validate specimen requirements for labs
    if (selectedCategory === 'laboratory') {
      const needsSpecimen = selectedOrders.some(o => 
        o.code?.coding?.[0]?.code !== 'PANEL' // Panels don't need specimen info
      );
      if (needsSpecimen && !data.specimen?.length) {
        warnings.push({
          field: 'specimen',
          message: 'Consider specifying specimen requirements'
        });
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  };

  // Save handler
  const handleSave = async (validatedData) => {
    setSaving(true);
    try {
      // Create ServiceRequest resources for each order
      const serviceRequests = selectedOrders.map(order => ({
        resourceType: 'ServiceRequest',
        ...(order.id && { id: order.id }),
        
        status: validatedData.status,
        intent: validatedData.intent,
        priority: order.priority || validatedData.priority,
        
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
          display: `${patient.name?.[0]?.family}, ${patient.name?.[0]?.given?.join(' ')}`
        },
        
        ...(clinicalContext.encounter && {
          encounter: {
            reference: `Encounter/${clinicalContext.encounter.id}`
          }
        }),
        
        authoredOn: validatedData.authoredOn,
        requester: {
          reference: `Practitioner/${clinicalContext.user?.id || 'current-user'}`,
          display: clinicalContext.user?.name || 'Current User'
        },
        
        ...(validatedData.occurrenceDateTime && {
          occurrenceDateTime: validatedData.occurrenceDateTime
        }),
        
        ...(validatedData.performer && { performer: [validatedData.performer] }),
        ...(validatedData.locationReference && { locationReference: [validatedData.locationReference] }),
        
        ...(validatedData.reasonCode?.length > 0 && { reasonCode: validatedData.reasonCode }),
        ...(validatedData.bodySite?.length > 0 && { bodySite: validatedData.bodySite }),
        ...(validatedData.note?.length > 0 && { note: validatedData.note }),
        ...(validatedData.patientInstruction && { patientInstruction: validatedData.patientInstruction }),
        
        ...(selectedCategory === 'laboratory' && validatedData.specimen?.length > 0 && {
          specimen: validatedData.specimen
        })
      }));
      
      await onSave(serviceRequests);
    } catch (error) {
      console.error('Failed to save orders:', error);
      throw error;
    } finally {
      setSaving(false);
    }
  };

  // Calculate order summary
  const orderSummary = useMemo(() => {
    const summary = {
      total: selectedOrders.length,
      byPriority: {},
      byCategory: {}
    };
    
    selectedOrders.forEach(order => {
      const priority = order.priority || formData.priority;
      summary.byPriority[priority] = (summary.byPriority[priority] || 0) + 1;
    });
    
    return summary;
  }, [selectedOrders, formData.priority]);

  // Tab panels
  const renderOrderSelectionTab = () => (
    <Box sx={{ p: 2 }}>
      <Stack spacing={3}>
        {/* CDS Alerts */}
        {cdsAlerts.length > 0 && (
          <CDSAlertPresenter
            alerts={cdsAlerts}
            mode={ALERT_MODES.INLINE}
            onAction={handleCDSAction}
            onDismiss={(alert) => {
              setCdsAlerts(prev => prev.filter(a => a.id !== alert.id));
            }}
            context={{
              userId: clinicalContext.user?.id,
              patientId: patient.id
            }}
            requireAcknowledgment={cdsAlerts.some(a => a.indicator === 'critical')}
          />
        )}
        
        {/* Appropriateness checking */}
        {checkingAppropriateness && (
          <Alert severity="info" icon={<CircularProgress size={20} />}>
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
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Order Category
          </Typography>
          <ButtonGroup fullWidth>
            {CATEGORY_OPTIONS.map(category => {
              const Icon = category.icon;
              return (
                <Button
                  key={category.value}
                  variant={selectedCategory === category.value ? 'contained' : 'outlined'}
                  onClick={() => setSelectedCategory(category.value)}
                  startIcon={<Icon />}
                  color={category.color}
                >
                  {category.label}
                </Button>
              );
            })}
          </ButtonGroup>
        </Box>
        
        {/* Quick order sets */}
        {orderSets.length > 0 && (
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Order Sets
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {orderSets.map((set, idx) => (
                <Chip
                  key={idx}
                  label={`${set.name} (${set.orders.length})`}
                  onClick={() => handleUseOrderSet(set)}
                  variant="outlined"
                  size="small"
                />
              ))}
            </Stack>
          </Box>
        )}
        
        {/* Order search/selection based on category */}
        {selectedCategory === 'laboratory' && (
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Common Lab Panels
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
              <ClinicalCodeSelector
                resource="ServiceRequest"
                field="code"
                label="Search Individual Labs"
                value={null}
                onChange={(value) => value && handleAddOrder(value)}
                searchType="laboratory"
                placeholder="Search by lab name or code..."
                clearOnSelect
              />
            </Box>
          </Box>
        )}
        
        {selectedCategory === 'imaging' && (
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Common Imaging Studies
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
                      modality: study.modality,
                      contrast: study.contrast
                    })}
                  >
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <ImagingIcon color="secondary" />
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" fontWeight="medium">
                          {study.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Appropriate for: {study.appropriateness.join(', ')}
                        </Typography>
                      </Box>
                    </Stack>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}
        
        {/* Selected orders list */}
        {selectedOrders.length > 0 && (
          <Box>
            <Typography variant="subtitle2" gutterBottom>
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
                  <ListItemIcon>
                    {selectedCategory === 'laboratory' ? <LabIcon /> :
                     selectedCategory === 'imaging' ? <ImagingIcon /> :
                     <ProcedureIcon />}
                  </ListItemIcon>
                  <ListItemText
                    primary={order.code?.text || order.code?.coding?.[0]?.display}
                    secondary={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip 
                          label={order.priority || formData.priority}
                          size="small"
                          color={
                            PRIORITY_OPTIONS.find(p => p.value === (order.priority || formData.priority))?.color
                          }
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
          </Box>
        )}
      </Stack>
    </Box>
  );

  const renderOrderDetailsTab = () => (
    <Box sx={{ p: 2 }}>
      <Stack spacing={3}>
        {/* Priority */}
        <FormControl fullWidth required>
          <InputLabel>Priority</InputLabel>
          <Select
            value={formData.priority}
            onChange={(e) => handleFieldChange('priority', e.target.value)}
            label="Priority"
          >
            {PRIORITY_OPTIONS.map(option => (
              <MenuItem key={option.value} value={option.value}>
                <Stack direction="row" spacing={1} alignItems="center">
                  {option.badge && <Badge color="error" variant="dot" />}
                  <Chip 
                    size="small" 
                    color={option.color} 
                    label={option.label}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {option.description}
                  </Typography>
                </Stack>
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        
        {/* When to perform */}
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <ClinicalDatePicker
              label="Perform Date/Time"
              value={formData.occurrenceDateTime}
              onChange={(value) => handleFieldChange('occurrenceDateTime', value)}
              minDate={new Date()}
              showTime
              helperText="When should this order be performed?"
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.asNeededBoolean}
                  onChange={(e) => handleFieldChange('asNeededBoolean', e.target.checked)}
                />
              }
              label="As needed (PRN)"
            />
          </Grid>
        </Grid>
        
        {/* Reason for order */}
        <ClinicalCodeSelector
          resource="Condition"
          field="reasonCode"
          label="Clinical Indication"
          value={formData.reasonCode?.[0]}
          onChange={(value) => handleFieldChange('reasonCode', [value])}
          searchType="condition"
          helperText="Why is this order being placed?"
          showCurrentConditions
        />
        
        {/* Body site for imaging */}
        {selectedCategory === 'imaging' && (
          <ClinicalCodeSelector
            resource="BodyStructure"
            field="bodySite"
            label="Body Site"
            value={formData.bodySite?.[0]}
            onChange={(value) => handleFieldChange('bodySite', [value])}
            searchType="body-site"
            helperText="Anatomical location for imaging"
          />
        )}
        
        {/* Specimen for labs */}
        {selectedCategory === 'laboratory' && (
          <FormControl fullWidth>
            <InputLabel>Specimen Type</InputLabel>
            <Select
              value={formData.specimen?.[0]?.type || ''}
              onChange={(e) => handleFieldChange('specimen', [{
                type: e.target.value,
                collectedDateTime: new Date().toISOString()
              }])}
              label="Specimen Type"
            >
              <MenuItem value="">Not specified</MenuItem>
              <MenuItem value="blood">Blood</MenuItem>
              <MenuItem value="urine">Urine</MenuItem>
              <MenuItem value="stool">Stool</MenuItem>
              <MenuItem value="sputum">Sputum</MenuItem>
              <MenuItem value="csf">CSF</MenuItem>
              <MenuItem value="tissue">Tissue</MenuItem>
              <MenuItem value="other">Other</MenuItem>
            </Select>
          </FormControl>
        )}
        
        {/* Special instructions */}
        <TextField
          label="Special Instructions"
          value={formData.note?.[0]?.text || ''}
          onChange={(e) => handleFieldChange('note', [{
            text: e.target.value,
            time: new Date().toISOString()
          }])}
          multiline
          rows={2}
          fullWidth
          placeholder="Any special instructions for this order..."
        />
        
        {/* Patient instructions */}
        <TextField
          label="Patient Instructions"
          value={formData.patientInstruction}
          onChange={(e) => handleFieldChange('patientInstruction', e.target.value)}
          multiline
          rows={2}
          fullWidth
          placeholder="Instructions for the patient (e.g., fasting requirements)..."
        />
      </Stack>
    </Box>
  );

  const renderReviewTab = () => (
    <Box sx={{ p: 2 }}>
      <Stack spacing={3}>
        <Typography variant="h6" gutterBottom>
          Order Summary
        </Typography>
        
        {/* Order statistics */}
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <Typography variant="subtitle2" color="text.secondary">
                Total Orders
              </Typography>
              <Typography variant="h4">
                {orderSummary.total}
              </Typography>
            </Grid>
            
            <Grid item xs={12} sm={8}>
              <Typography variant="subtitle2" color="text.secondary">
                By Priority
              </Typography>
              <Stack direction="row" spacing={1}>
                {Object.entries(orderSummary.byPriority).map(([priority, count]) => (
                  <Chip
                    key={priority}
                    label={`${priority}: ${count}`}
                    color={PRIORITY_OPTIONS.find(p => p.value === priority)?.color}
                    size="small"
                  />
                ))}
              </Stack>
            </Grid>
          </Grid>
        </Paper>
        
        {/* Order list */}
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Orders to be Placed
          </Typography>
          {CATEGORY_OPTIONS.map(category => {
            const categoryOrders = selectedOrders.filter(o => 
              // Filter by category - simplified for this example
              true
            );
            
            if (categoryOrders.length === 0) return null;
            
            const Icon = category.icon;
            
            return (
              <Accordion key={category.value} defaultExpanded>
                <AccordionSummary expandIcon={<ExpandIcon />}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Icon color={category.color} />
                    <Typography>
                      {category.label} ({categoryOrders.length})
                    </Typography>
                  </Stack>
                </AccordionSummary>
                <AccordionDetails>
                  <List dense>
                    {categoryOrders.map(order => (
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
                </AccordionDetails>
              </Accordion>
            );
          })}
        </Box>
        
        {/* Clinical indication */}
        {formData.reasonCode?.length > 0 && (
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Clinical Indication
            </Typography>
            <Typography variant="body1">
              {formData.reasonCode[0].text || formData.reasonCode[0].coding?.[0]?.display}
            </Typography>
          </Paper>
        )}
        
        {/* Instructions summary */}
        {(formData.note?.[0]?.text || formData.patientInstruction) && (
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Instructions
            </Typography>
            {formData.note?.[0]?.text && (
              <Box sx={{ mb: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Special Instructions:
                </Typography>
                <Typography variant="body2">
                  {formData.note[0].text}
                </Typography>
              </Box>
            )}
            {formData.patientInstruction && (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Patient Instructions:
                </Typography>
                <Typography variant="body2">
                  {formData.patientInstruction}
                </Typography>
              </Box>
            )}
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
        
        {/* Actions */}
        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            startIcon={<FavoriteIcon />}
            onClick={() => {
              // Save as favorite or order set
              console.log('Save as favorite');
            }}
          >
            Save as Favorite
          </Button>
          
          <Button
            variant="outlined"
            onClick={() => {
              // Print requisitions
              console.log('Print requisitions');
            }}
          >
            Print Requisitions
          </Button>
        </Stack>
      </Stack>
    </Box>
  );

  // Field change handler
  const handleFieldChange = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  return (
    <ClinicalDialog
      open={open}
      onClose={onClose}
      title="Place Orders"
      subtitle="Create clinical orders for labs, imaging, or procedures"
      mode={mode}
      size="large"
      resource={formData}
      resourceType="ServiceRequest"
      onSave={handleSave}
      onValidate={handleValidate}
      clinicalContext={clinicalContext}
      alerts={alerts}
      warnings={warnings}
      loading={loading}
      saving={saving}
      showProgress={false}
      enableVoiceInput
      enableUndo
      autoSaveDraft
    >
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)}>
          <Tab 
            icon={<OrderIcon />} 
            label="Select Orders"
            iconPosition="start"
          />
          <Tab 
            icon={<ScheduleIcon />} 
            label="Order Details"
            iconPosition="start"
          />
          <Tab 
            icon={<CheckIcon />} 
            label="Review & Submit"
            iconPosition="start"
            disabled={selectedOrders.length === 0}
          />
        </Tabs>
      </Box>
      
      <Box sx={{ mt: 2 }}>
        {activeTab === 0 && renderOrderSelectionTab()}
        {activeTab === 1 && renderOrderDetailsTab()}
        {activeTab === 2 && renderReviewTab()}
      </Box>
    </ClinicalDialog>
  );
};

export default OrderDialog;