/**
 * OrdersMode Component
 * Unified order management with drag-and-drop, templates, and CDS integration
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  TextField,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  ListItemButton,
  Chip,
  Stack,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  FormControlLabel,
  InputLabel,
  Select,
  MenuItem,
  Radio,
  RadioGroup,
  Checkbox,
  Tab,
  Tabs,
  Card,
  CardContent,
  CardActions,
  Collapse,
  Alert,
  CircularProgress,
  Tooltip,
  Badge,
  Avatar,
  InputAdornment,
  Autocomplete,
  Snackbar,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  useTheme,
  alpha,
  Fade,
  Grow,
  FormGroup,
  FormLabel
} from '@mui/material';
import {
  Search as SearchIcon,
  Science as LabIcon,
  MedicalServices as ImagingIcon,
  Medication as MedicationIcon,
  LocalHospital as ProcedureIcon,
  Send as ReferralIcon,
  Inventory as SuppliesIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  DragIndicator as DragIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  History as HistoryIcon,
  LibraryBooks as TemplateIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  CheckCircle as CheckIcon,
  ShoppingCart as CartIcon,
  Send as SendIcon,
  Save as SaveIcon,
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Schedule as ScheduleIcon,
  Today as TodayIcon,
  DateRange as DateRangeIcon,
  Lightbulb as CDSIcon,
  ErrorOutline as ErrorIcon,
  ContentCopy as CopyIcon,
  Favorite as FavoriteIcon,
  FavoriteBorder as FavoriteBorderIcon
} from '@mui/icons-material';
// Custom drag and drop implementation without external dependencies
import { format } from 'date-fns';
import { useParams } from 'react-router-dom';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import { fhirClient } from '../../../../services/fhirClient';
import { 
  useConditions,
  useMedications,
  usePatientResourceType
} from '../../../../hooks/useFHIRResources';

// Order types configuration
const ORDER_TYPES = {
  lab: {
    label: 'Laboratory',
    icon: <LabIcon />,
    color: 'primary',
    resourceType: 'ServiceRequest',
    category: 'laboratory'
  },
  imaging: {
    label: 'Imaging',
    icon: <ImagingIcon />,
    color: 'secondary',
    resourceType: 'ServiceRequest',
    category: 'imaging'
  },
  medication: {
    label: 'Medication',
    icon: <MedicationIcon />,
    color: 'success',
    resourceType: 'MedicationRequest',
    category: 'medication'
  },
  procedure: {
    label: 'Procedure',
    icon: <ProcedureIcon />,
    color: 'warning',
    resourceType: 'ServiceRequest',
    category: 'procedure'
  },
  referral: {
    label: 'Referral',
    icon: <ReferralIcon />,
    color: 'info',
    resourceType: 'ServiceRequest',
    category: 'referral'
  },
  supplies: {
    label: 'Supplies',
    icon: <SuppliesIcon />,
    color: 'error',
    resourceType: 'SupplyRequest',
    category: 'supplies'
  }
};

// Common lab orders
const COMMON_LAB_ORDERS = [
  { code: '24323-8', display: 'Comprehensive Metabolic Panel', system: 'http://loinc.org' },
  { code: '58410-2', display: 'Complete Blood Count', system: 'http://loinc.org' },
  { code: '2093-3', display: 'Cholesterol Panel', system: 'http://loinc.org' },
  { code: '25454-2', display: 'Liver Function Tests', system: 'http://loinc.org' },
  { code: '24362-6', display: 'Kidney Function Tests', system: 'http://loinc.org' },
  { code: '33914-3', display: 'HbA1c', system: 'http://loinc.org' },
  { code: '2885-2', display: 'Thyroid Panel', system: 'http://loinc.org' },
  { code: '24364-2', display: 'Coagulation Panel', system: 'http://loinc.org' }
];

// Common imaging orders
const COMMON_IMAGING_ORDERS = [
  { code: '39714-3', display: 'Chest X-Ray', system: 'http://loinc.org' },
  { code: '24558-9', display: 'CT Head without contrast', system: 'http://loinc.org' },
  { code: '24590-2', display: 'CT Chest with contrast', system: 'http://loinc.org' },
  { code: '24567-0', display: 'MRI Brain', system: 'http://loinc.org' },
  { code: '46356-9', display: 'Ultrasound Abdomen', system: 'http://loinc.org' },
  { code: '38269-9', display: 'EKG 12-lead', system: 'http://loinc.org' }
];

// Priority options
const PRIORITY_OPTIONS = [
  { value: 'routine', label: 'Routine', color: 'default' },
  { value: 'urgent', label: 'Urgent', color: 'warning' },
  { value: 'asap', label: 'ASAP', color: 'error' },
  { value: 'stat', label: 'STAT', color: 'error' }
];

// Order Catalog Component
const OrderCatalog = ({ onAddOrder, searchQuery, selectedType }) => {
  const theme = useTheme();
  const [favorites, setFavorites] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [expandedCategories, setExpandedCategories] = useState({
    common: true,
    favorites: true,
    recent: false
  });

  // Get catalog items based on type
  const catalogItems = useMemo(() => {
    switch (selectedType) {
      case 'lab':
        return COMMON_LAB_ORDERS;
      case 'imaging':
        return COMMON_IMAGING_ORDERS;
      case 'medication':
        // This would connect to a medication database
        return [];
      default:
        return [];
    }
  }, [selectedType]);

  // Filter items based on search
  const filteredItems = useMemo(() => {
    if (!searchQuery) return catalogItems;
    const query = searchQuery.toLowerCase();
    return catalogItems.filter(item => 
      item.display.toLowerCase().includes(query) ||
      item.code.toLowerCase().includes(query)
    );
  }, [catalogItems, searchQuery]);

  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const toggleFavorite = (item, event) => {
    event.stopPropagation();
    setFavorites(prev => {
      const isFavorite = prev.some(fav => fav.code === item.code);
      if (isFavorite) {
        return prev.filter(fav => fav.code !== item.code);
      }
      return [...prev, item];
    });
  };

  const handleAddOrder = (item) => {
    onAddOrder({
      ...item,
      type: selectedType,
      id: `temp-${Date.now()}-${Math.random()}`,
      priority: 'routine',
      status: 'draft'
    });
    
    // Add to recent orders
    setRecentOrders(prev => {
      const filtered = prev.filter(order => order.code !== item.code);
      return [item, ...filtered].slice(0, 5);
    });
  };

  return (
    <Box>
      {/* Favorites */}
      {favorites.length > 0 && (
        <>
          <ListItemButton onClick={() => toggleCategory('favorites')}>
            <ListItemIcon>
              <FavoriteIcon color="error" />
            </ListItemIcon>
            <ListItemText primary="Favorites" secondary={`${favorites.length} items`} />
            {expandedCategories.favorites ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </ListItemButton>
          <Collapse in={expandedCategories.favorites}>
            <List disablePadding>
              {favorites.map((item) => (
                <ListItem key={item.code} disablePadding>
                  <ListItemButton onClick={() => handleAddOrder(item)} sx={{ pl: 4 }}>
                    <ListItemText 
                      primary={item.display}
                      secondary={`Code: ${item.code}`}
                    />
                    <ListItemSecondaryAction>
                      <IconButton size="small" onClick={(e) => toggleFavorite(item, e)}>
                        <StarIcon color="warning" />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </Collapse>
          <Divider />
        </>
      )}

      {/* Common Orders */}
      <ListItemButton onClick={() => toggleCategory('common')}>
        <ListItemIcon>
          {ORDER_TYPES[selectedType]?.icon}
        </ListItemIcon>
        <ListItemText 
          primary={`Common ${ORDER_TYPES[selectedType]?.label} Orders`}
          secondary={`${filteredItems.length} items`}
        />
        {expandedCategories.common ? <ExpandLessIcon /> : <ExpandMoreIcon />}
      </ListItemButton>
      <Collapse in={expandedCategories.common}>
        <List disablePadding>
          {filteredItems.map((item) => {
            const isFavorite = favorites.some(fav => fav.code === item.code);
            return (
              <ListItem key={item.code} disablePadding>
                <ListItemButton onClick={() => handleAddOrder(item)} sx={{ pl: 4 }}>
                  <ListItemText 
                    primary={item.display}
                    secondary={`Code: ${item.code}`}
                  />
                  <ListItemSecondaryAction>
                    <IconButton 
                      size="small" 
                      onClick={(e) => toggleFavorite(item, e)}
                    >
                      {isFavorite ? <StarIcon color="warning" /> : <StarBorderIcon />}
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      </Collapse>

      {/* Recent Orders */}
      {recentOrders.length > 0 && (
        <>
          <Divider />
          <ListItemButton onClick={() => toggleCategory('recent')}>
            <ListItemIcon>
              <HistoryIcon />
            </ListItemIcon>
            <ListItemText primary="Recent Orders" secondary={`${recentOrders.length} items`} />
            {expandedCategories.recent ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </ListItemButton>
          <Collapse in={expandedCategories.recent}>
            <List disablePadding>
              {recentOrders.map((item, index) => (
                <ListItem key={`recent-${index}`} disablePadding>
                  <ListItemButton onClick={() => handleAddOrder(item)} sx={{ pl: 4 }}>
                    <ListItemText 
                      primary={item.display}
                      secondary={`Code: ${item.code}`}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </Collapse>
        </>
      )}
    </Box>
  );
};

// Order Details Dialog
const OrderDetailsDialog = ({ open, onClose, order, onSave }) => {
  const theme = useTheme();
  const [editedOrder, setEditedOrder] = useState(order || {});

  useEffect(() => {
    setEditedOrder(order || {});
  }, [order]);

  const handleChange = (field, value) => {
    setEditedOrder(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = () => {
    onSave(editedOrder);
    onClose();
  };

  if (!order) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={2}>
          {ORDER_TYPES[order.type]?.icon}
          <Typography variant="h6">Order Details</Typography>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 2 }}>
          <Typography variant="subtitle1" fontWeight="500">
            {order.display}
          </Typography>

          <FormControl fullWidth>
            <InputLabel>Priority</InputLabel>
            <Select
              value={editedOrder.priority || 'routine'}
              onChange={(e) => handleChange('priority', e.target.value)}
            >
              {PRIORITY_OPTIONS.map(option => (
                <MenuItem key={option.value} value={option.value}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Chip 
                      label={option.label} 
                      size="small" 
                      color={option.color}
                    />
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {order.type === 'medication' && (
            <>
              <TextField
                fullWidth
                label="Dosage"
                value={editedOrder.dosage || ''}
                onChange={(e) => handleChange('dosage', e.target.value)}
              />
              <FormControl fullWidth>
                <InputLabel>Route</InputLabel>
                <Select
                  value={editedOrder.route || ''}
                  onChange={(e) => handleChange('route', e.target.value)}
                >
                  <MenuItem value="oral">Oral</MenuItem>
                  <MenuItem value="iv">IV</MenuItem>
                  <MenuItem value="im">IM</MenuItem>
                  <MenuItem value="subcut">Subcutaneous</MenuItem>
                  <MenuItem value="topical">Topical</MenuItem>
                </Select>
              </FormControl>
              <TextField
                fullWidth
                label="Frequency"
                value={editedOrder.frequency || ''}
                onChange={(e) => handleChange('frequency', e.target.value)}
                placeholder="e.g., twice daily, every 8 hours"
              />
              <TextField
                fullWidth
                label="Duration"
                value={editedOrder.duration || ''}
                onChange={(e) => handleChange('duration', e.target.value)}
                placeholder="e.g., 7 days, 2 weeks"
              />
            </>
          )}

          <TextField
            fullWidth
            multiline
            rows={3}
            label="Clinical Indication"
            value={editedOrder.indication || ''}
            onChange={(e) => handleChange('indication', e.target.value)}
            placeholder="Reason for this order..."
          />

          <TextField
            fullWidth
            multiline
            rows={2}
            label="Special Instructions"
            value={editedOrder.instructions || ''}
            onChange={(e) => handleChange('instructions', e.target.value)}
            placeholder="Any special instructions..."
          />

          {order.type === 'lab' && (
            <FormControl>
              <FormLabel>Specimen Type</FormLabel>
              <RadioGroup
                value={editedOrder.specimen || 'blood'}
                onChange={(e) => handleChange('specimen', e.target.value)}
              >
                <FormControlLabel value="blood" control={<Radio />} label="Blood" />
                <FormControlLabel value="urine" control={<Radio />} label="Urine" />
                <FormControlLabel value="other" control={<Radio />} label="Other" />
              </RadioGroup>
            </FormControl>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave}>Save</Button>
      </DialogActions>
    </Dialog>
  );
};

// Order Card Component with drag functionality
const OrderCard = ({ order, onEdit, onDelete, index, onDragStart, onDragEnd, onDragOver, onDrop, isDragging }) => {
  const theme = useTheme();
  const typeConfig = ORDER_TYPES[order.type];
  const priorityConfig = PRIORITY_OPTIONS.find(p => p.value === order.priority) || PRIORITY_OPTIONS[0];

  return (
    <Card 
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, index)}
      sx={{
        mb: 1,
        opacity: isDragging ? 0.5 : 1,
        transform: isDragging ? 'scale(1.05)' : 'scale(1)',
        transition: 'all 0.2s ease',
        cursor: 'move',
        '&:hover': {
          boxShadow: theme.shadows[4]
        }
      }}
    >
      <CardContent sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="flex-start" spacing={2}>
          <DragIcon color="action" />
          
          <Avatar 
            sx={{ 
              bgcolor: alpha(theme.palette[typeConfig.color].main, 0.1),
              color: theme.palette[typeConfig.color].main,
              width: 32,
              height: 32
            }}
          >
            {typeConfig.icon}
          </Avatar>

          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2" fontWeight="500">
              {order.display}
            </Typography>
            {order.code && (
              <Typography variant="caption" color="text.secondary">
                Code: {order.code}
              </Typography>
            )}
            <Stack direction="row" spacing={1} mt={0.5}>
              <Chip 
                label={priorityConfig.label} 
                size="small" 
                color={priorityConfig.color}
              />
              {order.indication && (
                <Chip 
                  label={order.indication} 
                  size="small" 
                  variant="outlined"
                />
              )}
            </Stack>
          </Box>

          <Stack direction="row" spacing={0.5}>
            <IconButton size="small" onClick={() => onEdit(order)}>
              <EditIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={() => onDelete(order.id)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
};

// CDS Alerts Component
const CDSAlerts = ({ orders, conditions, medications, allergies }) => {
  const theme = useTheme();
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    // Simulate CDS checks
    const newAlerts = [];

    // Check for drug allergies
    orders.forEach(order => {
      if (order.type === 'medication') {
        allergies.forEach(allergy => {
          if (allergy.code?.text?.toLowerCase().includes(order.display.toLowerCase())) {
            newAlerts.push({
              id: `allergy-${order.id}-${allergy.id}`,
              severity: 'error',
              message: `Patient has allergy to ${allergy.code?.text}`,
              order: order.display
            });
          }
        });
      }
    });

    // Check for duplicate orders
    const orderCodes = orders.map(o => o.code);
    const duplicates = orderCodes.filter((code, index) => orderCodes.indexOf(code) !== index);
    duplicates.forEach(code => {
      const order = orders.find(o => o.code === code);
      newAlerts.push({
        id: `duplicate-${code}`,
        severity: 'warning',
        message: `Duplicate order: ${order.display}`,
        order: order.display
      });
    });

    setAlerts(newAlerts);
  }, [orders, conditions, medications, allergies]);

  if (alerts.length === 0) {
    return (
      <Alert severity="success" icon={<CheckIcon />}>
        No clinical decision support alerts
      </Alert>
    );
  }

  return (
    <Stack spacing={1}>
      {alerts.map(alert => (
        <Alert 
          key={alert.id} 
          severity={alert.severity}
          sx={{ '& .MuiAlert-message': { width: '100%' } }}
        >
          <Stack>
            <Typography variant="body2" fontWeight="500">
              {alert.message}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Related to: {alert.order}
            </Typography>
          </Stack>
        </Alert>
      ))}
    </Stack>
  );
};

// Main OrdersMode Component
const OrdersMode = () => {
  const theme = useTheme();
  const { patientId } = useParams();
  const { currentPatient } = useFHIRResource();
  
  // State
  const [selectedType, setSelectedType] = useState('lab');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [orderDetailsOpen, setOrderDetailsOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Get patient context
  const conditions = useConditions(patientId);
  const medications = useMedications(patientId);
  const allergies = usePatientResourceType(patientId, 'AllergyIntolerance');

  // Handle order addition
  const handleAddOrder = (order) => {
    setSelectedOrders(prev => [...prev, order]);
  };

  // Drag and drop state
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dropTargetIndex, setDropTargetIndex] = useState(null);

  // Handle drag start
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target.innerHTML);
  };

  // Handle drag end
  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDropTargetIndex(null);
  };

  // Handle drag over
  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  // Handle drop
  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) return;

    const items = Array.from(selectedOrders);
    const [reorderedItem] = items.splice(draggedIndex, 1);
    items.splice(dropIndex, 0, reorderedItem);

    setSelectedOrders(items);
    setDraggedIndex(null);
  };

  // Handle order edit
  const handleEditOrder = (order) => {
    setEditingOrder(order);
    setOrderDetailsOpen(true);
  };

  // Handle order save
  const handleSaveOrder = (editedOrder) => {
    setSelectedOrders(prev => 
      prev.map(order => order.id === editedOrder.id ? editedOrder : order)
    );
  };

  // Handle order delete
  const handleDeleteOrder = (orderId) => {
    setSelectedOrders(prev => prev.filter(order => order.id !== orderId));
  };

  // Submit orders
  const handleSubmitOrders = async () => {
    setSubmitting(true);
    
    try {
      const orderPromises = selectedOrders.map(async (order) => {
        const resource = createFHIRResource(order, patientId);
        
        if (order.type === 'medication') {
          return await fhirClient.create('MedicationRequest', resource);
        } else if (order.type === 'supplies') {
          return await fhirClient.create('SupplyRequest', resource);
        } else {
          return await fhirClient.create('ServiceRequest', resource);
        }
      });

      await Promise.all(orderPromises);
      
      setSnackbar({
        open: true,
        message: `Successfully submitted ${selectedOrders.length} orders`,
        severity: 'success'
      });
      
      // Clear selected orders
      setSelectedOrders([]);
    } catch (error) {
      console.error('Error submitting orders:', error);
      setSnackbar({
        open: true,
        message: 'Error submitting orders. Please try again.',
        severity: 'error'
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Create FHIR resource from order
  const createFHIRResource = (order, patientId) => {
    const now = new Date().toISOString();
    
    if (order.type === 'medication') {
      return {
        resourceType: 'MedicationRequest',
        status: 'active',
        intent: 'order',
        priority: order.priority || 'routine',
        medicationCodeableConcept: {
          coding: [{
            system: order.system || 'http://www.nlm.nih.gov/research/umls/rxnorm',
            code: order.code,
            display: order.display
          }],
          text: order.display
        },
        subject: {
          reference: `Patient/${patientId}`
        },
        authoredOn: now,
        dosageInstruction: order.dosage ? [{
          text: `${order.dosage} ${order.frequency || ''} for ${order.duration || ''}`.trim(),
          timing: {
            code: {
              text: order.frequency
            }
          },
          route: order.route ? {
            coding: [{
              display: order.route
            }]
          } : undefined
        }] : undefined,
        note: order.instructions ? [{
          text: order.instructions
        }] : undefined
      };
    } else {
      return {
        resourceType: 'ServiceRequest',
        status: 'active',
        intent: 'order',
        priority: order.priority || 'routine',
        category: [{
          coding: [{
            system: 'http://snomed.info/sct',
            code: ORDER_TYPES[order.type]?.category,
            display: ORDER_TYPES[order.type]?.label
          }]
        }],
        code: {
          coding: [{
            system: order.system || 'http://loinc.org',
            code: order.code,
            display: order.display
          }],
          text: order.display
        },
        subject: {
          reference: `Patient/${patientId}`
        },
        authoredOn: now,
        reasonCode: order.indication ? [{
          text: order.indication
        }] : undefined,
        note: order.instructions ? [{
          text: order.instructions
        }] : undefined,
        bodySite: order.type === 'imaging' ? [{
          text: order.bodySite || 'Not specified'
        }] : undefined,
        specimen: order.type === 'lab' && order.specimen ? [{
          display: order.specimen
        }] : undefined
      };
    }
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Grid container spacing={2} sx={{ flex: 1, minHeight: 0 }}>
        {/* Order Catalog - Left Panel */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Order Type Tabs */}
            <Tabs
              value={selectedType}
              onChange={(e, value) => setSelectedType(value)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{ borderBottom: 1, borderColor: 'divider' }}
            >
              {Object.entries(ORDER_TYPES).map(([key, config]) => (
                <Tab
                  key={key}
                  value={key}
                  icon={config.icon}
                  label={config.label}
                  iconPosition="start"
                />
              ))}
            </Tabs>

            {/* Search */}
            <Box sx={{ p: 2 }}>
              <TextField
                fullWidth
                size="small"
                placeholder={`Search ${ORDER_TYPES[selectedType]?.label} orders...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  )
                }}
              />
            </Box>

            {/* Catalog */}
            <Box sx={{ flex: 1, overflow: 'auto' }}>
              <OrderCatalog
                selectedType={selectedType}
                searchQuery={searchQuery}
                onAddOrder={handleAddOrder}
              />
            </Box>
          </Paper>
        </Grid>

        {/* Selected Orders - Middle Panel */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Typography variant="h6">
                  Order Cart
                </Typography>
                <Badge badgeContent={selectedOrders.length} color="primary">
                  <CartIcon />
                </Badge>
              </Stack>
            </Box>

            <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
              {selectedOrders.length === 0 ? (
                <Box
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'text.secondary'
                  }}
                >
                  <CartIcon sx={{ fontSize: 64, mb: 2, opacity: 0.3 }} />
                  <Typography variant="body1" color="text.secondary">
                    No orders selected
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Add orders from the catalog
                  </Typography>
                </Box>
              ) : (
                <Box
                  sx={{
                    borderRadius: 1,
                    minHeight: 100
                  }}
                >
                  {selectedOrders.map((order, index) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      index={index}
                      onEdit={handleEditOrder}
                      onDelete={handleDeleteOrder}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                      isDragging={draggedIndex === index}
                    />
                  ))}
                </Box>
              )}
            </Box>

            {selectedOrders.length > 0 && (
              <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
                <Stack spacing={2}>
                  <Button
                    fullWidth
                    variant="contained"
                    size="large"
                    startIcon={<SendIcon />}
                    onClick={handleSubmitOrders}
                    disabled={submitting}
                  >
                    {submitting ? 'Submitting...' : `Submit ${selectedOrders.length} Orders`}
                  </Button>
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<SaveIcon />}
                    disabled={submitting}
                  >
                    Save as Order Set
                  </Button>
                </Stack>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* CDS & Patient Context - Right Panel */}
        <Grid item xs={12} md={4}>
          <Stack spacing={2} sx={{ height: '100%' }}>
            {/* CDS Alerts */}
            <Paper sx={{ p: 2 }}>
              <Stack spacing={2}>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CDSIcon color="primary" />
                  Clinical Decision Support
                </Typography>
                <CDSAlerts
                  orders={selectedOrders}
                  conditions={conditions.activeConditions || []}
                  medications={medications.activeMedications || []}
                  allergies={allergies.resources || []}
                />
              </Stack>
            </Paper>

            {/* Patient Context */}
            <Paper sx={{ flex: 1, overflow: 'auto', p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Patient Context
              </Typography>
              
              <Stack spacing={2}>
                {/* Active Conditions */}
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Active Conditions
                  </Typography>
                  {conditions.activeConditions?.length > 0 ? (
                    <Stack spacing={0.5}>
                      {conditions.activeConditions.slice(0, 3).map(condition => (
                        <Chip
                          key={condition.id}
                          label={condition.code?.text || 'Unknown'}
                          size="small"
                          variant="outlined"
                          color="error"
                        />
                      ))}
                    </Stack>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No active conditions
                    </Typography>
                  )}
                </Box>

                {/* Current Medications */}
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Current Medications
                  </Typography>
                  {medications.activeMedications?.length > 0 ? (
                    <Stack spacing={0.5}>
                      {medications.activeMedications.slice(0, 3).map(med => (
                        <Chip
                          key={med.id}
                          label={med.medicationCodeableConcept?.text || 'Unknown'}
                          size="small"
                          variant="outlined"
                          color="primary"
                        />
                      ))}
                    </Stack>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No active medications
                    </Typography>
                  )}
                </Box>

                {/* Allergies */}
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Allergies
                  </Typography>
                  {allergies.resources?.length > 0 ? (
                    <Stack spacing={0.5}>
                      {allergies.resources.filter(a => 
                        a.clinicalStatus?.coding?.[0]?.code === 'active'
                      ).map(allergy => (
                        <Chip
                          key={allergy.id}
                          label={allergy.code?.text || 'Unknown'}
                          size="small"
                          color="warning"
                          icon={<WarningIcon />}
                        />
                      ))}
                    </Stack>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      NKDA - No known drug allergies
                    </Typography>
                  )}
                </Box>
              </Stack>
            </Paper>
          </Stack>
        </Grid>
      </Grid>

      {/* Order Details Dialog */}
      <OrderDetailsDialog
        open={orderDetailsOpen}
        onClose={() => {
          setOrderDetailsOpen(false);
          setEditingOrder(null);
        }}
        order={editingOrder}
        onSave={handleSaveOrder}
      />

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default OrdersMode;