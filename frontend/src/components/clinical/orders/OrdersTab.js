/**
 * Orders Tab Component
 * CPOE (Computerized Provider Order Entry) functionality
 */
import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  FormControl,
  InputLabel,
  MenuItem,
  Chip,
  Alert,
  Card,
  CardContent,
  CardActions,
  Divider,
  Autocomplete,
  CircularProgress
} from '@mui/material';
import {
  Add as AddIcon,
  LocalPharmacy as MedicationIcon,
  Science as LabIcon,
  Camera as ImagingIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Send as SendIcon
} from '@mui/icons-material';
import { useOrders } from '../../../contexts/OrderContext';
import { useClinical } from '../../../contexts/ClinicalContext';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import cdsHooksService from '../../../services/cdsHooks';
import CDSAlerts from '../../CDSAlerts';

const OrdersTab = () => {
  const { currentPatient, currentEncounter } = useClinical();
  const { activeOrders, orderSets, createMedicationOrder, createLaboratoryOrder, createImagingOrder, loadActiveOrders, loadOrderSets } = useOrders();
  const { currentUser } = useAuth();
  const [newOrderDialog, setNewOrderDialog] = useState(false);
  const [orderType, setOrderType] = useState('');
  const [newOrder, setNewOrder] = useState({
    orderType: '',
    description: '',
    instructions: '',
    priority: 'routine',
    category: '',
    selectedItem: null
  });
  
  // Catalog search states
  const [medications, setMedications] = useState([]);
  const [labTests, setLabTests] = useState([]);
  const [imagingStudies, setImagingStudies] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [catalogSearchTerm, setCatalogSearchTerm] = useState('');

  useEffect(() => {
    if (currentPatient) {
      loadActiveOrders(currentPatient.id);
      loadOrderSets();
      
      // Check for pending medication order from renewal
      const pendingOrder = sessionStorage.getItem('pendingMedicationOrder');
      if (pendingOrder) {
        const orderData = JSON.parse(pendingOrder);
        sessionStorage.removeItem('pendingMedicationOrder'); // Clear it after reading
        
        // Pre-populate the order form
        setOrderType('medication');
        setNewOrder({
          orderType: 'medication',
          description: orderData.medicationName,
          instructions: `${orderData.dosage || ''} ${orderData.frequency || ''}`.trim(),
          priority: 'routine',
          category: 'medication',
          selectedItem: {
            name: orderData.medicationName,
            dosage: orderData.dosage,
            frequency: orderData.frequency,
            route: orderData.route
          }
        });
        setNewOrderDialog(true);
        
        // Pre-populate the catalog search
        setCatalogSearchTerm(orderData.medicationName);
        searchCatalog('medication', orderData.medicationName);
      }
    }
  }, [currentPatient]);

  // Search catalog items based on category and search term
  const searchCatalog = async (category, searchTerm) => {
    if (!searchTerm || searchTerm.length < 2) {
      return;
    }

    setLoadingCatalog(true);
    try {
      let response;
      switch (category) {
        case 'medication':
          response = await api.get('/api/catalogs/medications', {
            params: { search: searchTerm }
          });
          setMedications(response.data || []);
          break;
        case 'laboratory':
          response = await api.get('/api/catalogs/lab-tests', {
            params: { search: searchTerm }
          });
          setLabTests(response.data || []);
          break;
        case 'imaging':
          response = await api.get('/api/catalogs/imaging-studies', {
            params: { search: searchTerm }
          });
          setImagingStudies(response.data || []);
          break;
      }
    } catch (error) {
      console.error('Error searching catalog:', error);
    } finally {
      setLoadingCatalog(false);
    }
  };

  // Handle catalog item selection
  const handleCatalogItemSelect = (item) => {
    if (!item) return;

    let orderDetails = {};
    switch (newOrder.category) {
      case 'medication':
        orderDetails = {
          orderType: item.generic_name,
          description: `${item.generic_name} ${item.strength} ${item.dosage_form}`,
          instructions: `Route: ${item.route}\nFrequency: ${item.frequency_options?.[0] || 'As directed'}`,
          selectedItem: item
        };
        break;
      case 'laboratory':
        orderDetails = {
          orderType: item.test_name,
          description: item.test_description || item.test_name,
          instructions: `Specimen: ${item.specimen_type || 'Standard'}\n${item.fasting_required ? 'Fasting required' : ''}`,
          selectedItem: item
        };
        break;
      case 'imaging':
        orderDetails = {
          orderType: item.study_name,
          description: item.study_description || item.study_name,
          instructions: `Modality: ${item.modality}\n${item.prep_instructions || 'Standard preparation'}`,
          selectedItem: item
        };
        break;
    }

    setNewOrder({
      ...newOrder,
      ...orderDetails
    });
  };

  const handleCreateOrder = async () => {
    try {
      const orderData = {
        ...newOrder,
        patientId: currentPatient.id,
        encounterId: currentEncounter?.id
      };

      switch (newOrder.category) {
        case 'medication':
          // Parse dose and unit from strength field
          const strengthMatch = newOrder.selectedItem?.strength?.match(/(\d+(?:\.\d+)?)\s*(\w+)/);
          const dose = strengthMatch ? parseFloat(strengthMatch[1]) : 1;
          const doseUnit = strengthMatch ? strengthMatch[2] : 'unit';
          
          // Fire medication-prescribe CDS hook
          const userId = currentUser?.id || 'demo-user';
          const medicationData = {
            medication_name: newOrder.orderType,
            medication_code: newOrder.selectedItem?.rxnorm_code,
            dose: dose,
            dose_unit: doseUnit,
            route: newOrder.selectedItem?.route || 'oral',
            frequency: newOrder.selectedItem?.frequency_options?.[0] || 'once daily'
          };
          
          const cdsCards = await cdsHooksService.fireMedicationPrescribe(
            currentPatient.id,
            userId,
            currentEncounter?.id,
            [medicationData]
          );
          
          // If there are critical alerts, confirm with user
          const criticalAlerts = cdsCards.filter(card => card.indicator === 'critical');
          if (criticalAlerts.length > 0) {
            const proceed = window.confirm(
              `Critical alert: ${criticalAlerts[0].summary}\n\nDo you want to proceed with this order?`
            );
            if (!proceed) {
              return;
            }
          }
          
          await createMedicationOrder({
            medication_name: newOrder.orderType,
            medication_code: newOrder.selectedItem?.rxnorm_code,
            dose: dose,
            dose_unit: doseUnit,
            route: newOrder.selectedItem?.route || 'oral',
            frequency: newOrder.selectedItem?.frequency_options?.[0] || 'once daily',
            duration: '30 days',
            instructions: newOrder.instructions,
            priority: newOrder.priority,
            generic_allowed: true,
            refills: 0
          });
          break;
        case 'laboratory':
          await createLaboratoryOrder({
            test_name: newOrder.orderType,
            test_code: newOrder.selectedItem?.loinc_code,
            specimen_type: newOrder.selectedItem?.specimen_type,
            instructions: newOrder.instructions,
            priority: newOrder.priority,
            fasting_required: newOrder.selectedItem?.fasting_required || false
          });
          break;
        case 'imaging':
          await createImagingOrder({
            study_name: newOrder.orderType,
            modality: newOrder.selectedItem?.modality || 'Unknown',
            body_site: newOrder.selectedItem?.body_part,
            contrast: newOrder.selectedItem?.contrast_required || false,
            reason_for_exam: newOrder.instructions,
            transport_mode: 'ambulatory',
            priority: newOrder.priority
          });
          break;
        default:
          throw new Error('Invalid order category');
      }

      handleCloseDialog();
      loadActiveOrders(currentPatient.id);
    } catch (error) {
      console.error('Error creating order:', error);
      alert(`Error creating order: ${error.response?.data?.detail || error.message}`);
    }
  };

  const handleCloseDialog = () => {
    setNewOrderDialog(false);
    setNewOrder({
      orderType: '',
      description: '',
      instructions: '',
      priority: 'routine',
      category: '',
      selectedItem: null
    });
    setCatalogSearchTerm('');
    setMedications([]);
    setLabTests([]);
    setImagingStudies([]);
  };

  const getOrderIcon = (category) => {
    switch (category) {
      case 'medication':
        return <MedicationIcon />;
      case 'laboratory':
        return <LabIcon />;
      case 'imaging':
        return <ImagingIcon />;
      default:
        return <EditIcon />;
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'stat':
        return 'error';
      case 'urgent':
        return 'warning';
      case 'routine':
        return 'default';
      default:
        return 'default';
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* CDS Alerts for medication prescribe */}
      <CDSAlerts hook="medication-prescribe" patientId={currentPatient?.id} />
      
      <Grid container spacing={3}>
        {/* Active Orders */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Active Orders</Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setNewOrderDialog(true)}
              >
                New Order
              </Button>
            </Box>
            
            {activeOrders && activeOrders.length > 0 ? (
              <List>
                {activeOrders.map((order, index) => (
                  <ListItem key={index} divider>
                    <ListItemIcon>
                      {getOrderIcon(order.category)}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="subtitle1">
                            {order.description || order.orderType}
                          </Typography>
                          <Chip 
                            label={order.priority} 
                            size="small" 
                            color={getPriorityColor(order.priority)}
                          />
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            {order.instructions}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Status: {order.status} | Ordered: {new Date(order.createdAt || Date.now()).toLocaleDateString()}
                          </Typography>
                        </Box>
                      }
                    />
                    <IconButton>
                      <EditIcon />
                    </IconButton>
                  </ListItem>
                ))}
              </List>
            ) : (
              <Alert severity="info">
                No active orders for this patient.
              </Alert>
            )}
          </Paper>
        </Grid>

        {/* Order Sets */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Order Sets
            </Typography>
            {orderSets && orderSets.length > 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {orderSets.map((orderSet, index) => (
                  <Card key={index} variant="outlined">
                    <CardContent sx={{ pb: 1 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        {orderSet.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {orderSet.description}
                      </Typography>
                    </CardContent>
                    <CardActions>
                      <Button size="small" startIcon={<SendIcon />}>
                        Apply Set
                      </Button>
                    </CardActions>
                  </Card>
                ))}
              </Box>
            ) : (
              <Alert severity="info">
                No order sets available.
              </Alert>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* New Order Dialog */}
      <Dialog open={newOrderDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>Create New Order</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Order Category</InputLabel>
              <Select
                value={newOrder.category}
                label="Order Category"
                onChange={(e) => {
                  setNewOrder({ ...newOrder, category: e.target.value, selectedItem: null });
                  setCatalogSearchTerm('');
                  setMedications([]);
                  setLabTests([]);
                  setImagingStudies([]);
                }}
              >
                <MenuItem value="medication">Medication</MenuItem>
                <MenuItem value="laboratory">Laboratory</MenuItem>
                <MenuItem value="imaging">Imaging</MenuItem>
              </Select>
            </FormControl>

            {newOrder.category === 'medication' && (
              <Autocomplete
                fullWidth
                options={medications}
                getOptionLabel={(option) => `${option.generic_name} ${option.strength} ${option.dosage_form}`}
                value={newOrder.selectedItem}
                onChange={(event, value) => handleCatalogItemSelect(value)}
                onInputChange={(event, value) => {
                  setCatalogSearchTerm(value);
                  if (value && value.length >= 2) {
                    searchCatalog('medication', value);
                  }
                }}
                loading={loadingCatalog}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Search Medications"
                    placeholder="Type medication name..."
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {loadingCatalog ? <CircularProgress color="inherit" size={20} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
                renderOption={(props, option) => (
                  <Box component="li" {...props}>
                    <Box>
                      <Typography variant="body2">
                        {option.generic_name} {option.strength}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {option.brand_name && `(${option.brand_name}) • `}
                        {option.drug_class} • {option.route}
                        {option.is_controlled_substance && ' • CONTROLLED'}
                      </Typography>
                    </Box>
                  </Box>
                )}
              />
            )}

            {newOrder.category === 'laboratory' && (
              <Autocomplete
                fullWidth
                options={labTests}
                getOptionLabel={(option) => option.test_name}
                value={newOrder.selectedItem}
                onChange={(event, value) => handleCatalogItemSelect(value)}
                onInputChange={(event, value) => {
                  setCatalogSearchTerm(value);
                  if (value && value.length >= 2) {
                    searchCatalog('laboratory', value);
                  }
                }}
                loading={loadingCatalog}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Search Lab Tests"
                    placeholder="Type test name..."
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {loadingCatalog ? <CircularProgress color="inherit" size={20} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
                renderOption={(props, option) => (
                  <Box component="li" {...props}>
                    <Box>
                      <Typography variant="body2">
                        {option.test_name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {option.test_code && `${option.test_code} • `}
                        {option.specimen_type} • {option.test_category}
                        {option.stat_available && ' • STAT available'}
                      </Typography>
                    </Box>
                  </Box>
                )}
              />
            )}

            {newOrder.category === 'imaging' && (
              <Autocomplete
                fullWidth
                options={imagingStudies}
                getOptionLabel={(option) => option.study_name}
                value={newOrder.selectedItem}
                onChange={(event, value) => handleCatalogItemSelect(value)}
                onInputChange={(event, value) => {
                  setCatalogSearchTerm(value);
                  if (value && value.length >= 2) {
                    searchCatalog('imaging', value);
                  }
                }}
                loading={loadingCatalog}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Search Imaging Studies"
                    placeholder="Type study name..."
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {loadingCatalog ? <CircularProgress color="inherit" size={20} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
                renderOption={(props, option) => (
                  <Box component="li" {...props}>
                    <Box>
                      <Typography variant="body2">
                        {option.study_name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {option.modality} • {option.body_part}
                        {option.contrast_required && ' • Contrast required'}
                      </Typography>
                    </Box>
                  </Box>
                )}
              />
            )}

            <TextField
              fullWidth
              label="Description"
              value={newOrder.description}
              onChange={(e) => setNewOrder({ ...newOrder, description: e.target.value })}
              multiline
              rows={2}
            />

            <TextField
              fullWidth
              label="Instructions"
              value={newOrder.instructions}
              onChange={(e) => setNewOrder({ ...newOrder, instructions: e.target.value })}
              multiline
              rows={3}
              placeholder="Detailed instructions for the order"
            />

            <FormControl fullWidth>
              <InputLabel>Priority</InputLabel>
              <Select
                value={newOrder.priority}
                label="Priority"
                onChange={(e) => setNewOrder({ ...newOrder, priority: e.target.value })}
              >
                <MenuItem value="routine">Routine</MenuItem>
                <MenuItem value="urgent">Urgent</MenuItem>
                <MenuItem value="stat">STAT</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button 
            onClick={handleCreateOrder} 
            variant="contained"
            disabled={!newOrder.orderType || !newOrder.category}
          >
            Create Order
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default OrdersTab;