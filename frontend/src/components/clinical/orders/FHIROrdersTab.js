/**
 * FHIR Orders Tab Component
 * Manages clinical orders using FHIR ServiceRequest and MedicationRequest resources
 */
import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
  List,
  Button,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Grid,
  Card,
  CardContent
} from '@mui/material';
import {
  Add as AddIcon,
  LocalPharmacy as MedicationIcon,
  Science as LabIcon,
  CameraAlt as ImagingIcon,
  Assignment as ProcedureIcon,
  Delete as DeleteIcon,
  CheckCircle as ActiveIcon,
  Schedule as DraftIcon,
  Cancel as CancelledIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { useClinical } from '../../../contexts/ClinicalContext';
import { fhirClient } from '../../../services/fhirClient';

const TabPanel = ({ children, value, index }) => (
  <div hidden={value !== index} style={{ paddingTop: 16 }}>
    {value === index && children}
  </div>
);

const FHIROrdersTab = () => {
  const { currentPatient, currentEncounter } = useClinical();
  const [activeTab, setActiveTab] = useState(0);
  const [orders, setOrders] = useState({
    medications: [],
    labs: [],
    imaging: [],
    procedures: []
  });
  const [, setLoading] = useState(true);
  const [showNewOrderDialog, setShowNewOrderDialog] = useState(false);
  const [orderType, setOrderType] = useState('medication');
  const [newOrder, setNewOrder] = useState({
    display: '',
    priority: 'routine',
    instructions: '',
    reason: ''
  });

  useEffect(() => {
    if (currentPatient) {
      loadOrders();
    }
  }, [currentPatient?.id, currentEncounter?.id]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      // Load MedicationRequests
      const medRequests = await fhirClient.search('MedicationRequest', {
        patient: currentPatient.id,
        _sort: '-authored-on',
        _count: 100
      });

      // Load ServiceRequests for labs, imaging, and procedures
      const serviceRequests = await fhirClient.search('ServiceRequest', {
        patient: currentPatient.id,
        _sort: '-authored-on',
        _count: 100
      });

      // Categorize orders
      const medications = (medRequests.resources || []).map(transformMedicationRequest);
      
      const labs = [];
      const imaging = [];
      const procedures = [];

      (serviceRequests.resources || []).forEach(req => {
        const transformed = transformServiceRequest(req);
        const category = req.category?.[0]?.coding?.[0]?.code;
        
        if (category === 'laboratory' || category === '108252007') {
          labs.push(transformed);
        } else if (category === 'imaging' || category === '363679005') {
          imaging.push(transformed);
        } else {
          procedures.push(transformed);
        }
      });

      setOrders({ medications, labs, imaging, procedures });
    } catch (error) {
      
    } finally {
      setLoading(false);
    }
  };

  const transformMedicationRequest = (medReq) => ({
    id: medReq.id,
    type: 'medication',
    display: medReq.medicationCodeableConcept?.text || 
             medReq.medicationCodeableConcept?.coding?.[0]?.display ||
             medReq.medicationReference?.display || 'Unknown Medication',
    status: medReq.status,
    priority: medReq.priority || 'routine',
    dosage: medReq.dosageInstruction?.[0]?.text || '',
    route: medReq.dosageInstruction?.[0]?.route?.text || '',
    frequency: medReq.dosageInstruction?.[0]?.timing?.code?.text || '',
    authoredOn: medReq.authoredOn,
    requester: medReq.requester?.display || 'Unknown',
    reason: medReq.reasonCode?.[0]?.text || medReq.reasonReference?.[0]?.display || ''
  });

  const transformServiceRequest = (serviceReq) => ({
    id: serviceReq.id,
    type: 'service',
    display: serviceReq.code?.text || serviceReq.code?.coding?.[0]?.display || 'Unknown Service',
    status: serviceReq.status,
    priority: serviceReq.priority || 'routine',
    instructions: serviceReq.patientInstruction?.[0]?.instruction || 
                  serviceReq.note?.[0]?.text || '',
    authoredOn: serviceReq.authoredOn,
    requester: serviceReq.requester?.display || 'Unknown',
    reason: serviceReq.reasonCode?.[0]?.text || serviceReq.reasonReference?.[0]?.display || '',
    category: serviceReq.category?.[0]?.coding?.[0]?.code || 'procedure'
  });

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active':
      case 'completed':
        return <ActiveIcon color="success" fontSize="small" />;
      case 'draft':
        return <DraftIcon color="action" fontSize="small" />;
      case 'cancelled':
      case 'stopped':
        return <CancelledIcon color="error" fontSize="small" />;
      default:
        return null;
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent':
      case 'stat':
        return 'error';
      case 'asap':
        return 'warning';
      default:
        return 'default';
    }
  };

  const handleCreateOrder = async () => {
    try {
      if (orderType === 'medication') {
        // Create MedicationRequest
        const medRequest = {
          resourceType: 'MedicationRequest',
          status: 'draft',
          intent: 'order',
          priority: newOrder.priority,
          medicationCodeableConcept: {
            text: newOrder.display
          },
          subject: fhirClient.reference('Patient', currentPatient.id),
          encounter: currentEncounter ? 
            fhirClient.reference('Encounter', currentEncounter.id) : undefined,
          authoredOn: new Date().toISOString(),
          requester: {
            display: 'Current Provider' // Would use actual provider reference
          },
          dosageInstruction: newOrder.instructions ? [{
            text: newOrder.instructions
          }] : undefined,
          reasonCode: newOrder.reason ? [{
            text: newOrder.reason
          }] : undefined
        };

        await fhirClient.create('MedicationRequest', medRequest);
      } else {
        // Create ServiceRequest
        const serviceRequest = {
          resourceType: 'ServiceRequest',
          status: 'draft',
          intent: 'order',
          priority: newOrder.priority,
          code: {
            text: newOrder.display
          },
          subject: fhirClient.reference('Patient', currentPatient.id),
          encounter: currentEncounter ? 
            fhirClient.reference('Encounter', currentEncounter.id) : undefined,
          authoredOn: new Date().toISOString(),
          requester: {
            display: 'Current Provider' // Would use actual provider reference
          },
          category: [{
            coding: [{
              system: 'http://snomed.info/sct',
              code: orderType === 'lab' ? '108252007' : 
                    orderType === 'imaging' ? '363679005' : '387713003',
              display: orderType === 'lab' ? 'Laboratory procedure' : 
                      orderType === 'imaging' ? 'Imaging procedure' : 'Surgical procedure'
            }]
          }],
          note: newOrder.instructions ? [{
            text: newOrder.instructions
          }] : undefined,
          reasonCode: newOrder.reason ? [{
            text: newOrder.reason
          }] : undefined
        };

        await fhirClient.create('ServiceRequest', serviceRequest);
      }

      // Reload orders and close dialog
      await loadOrders();
      setShowNewOrderDialog(false);
      setNewOrder({
        display: '',
        priority: 'routine',
        instructions: '',
        reason: ''
      });
    } catch (error) {
      
      alert('Failed to create order: ' + error.message);
    }
  };

  const handleDeleteOrder = async (order) => {
    if (!window.confirm('Are you sure you want to cancel this order?')) {
      return;
    }

    try {
      const resourceType = order.type === 'medication' ? 'MedicationRequest' : 'ServiceRequest';
      const resource = await fhirClient.read(resourceType, order.id);
      resource.status = 'cancelled';
      await fhirClient.update(resourceType, order.id, resource);
      await loadOrders();
    } catch (error) {
      
      alert('Failed to cancel order: ' + error.message);
    }
  };

  const renderOrderList = (orderList, type) => {
    if (orderList.length === 0) {
      return (
        <Alert severity="info">
          No {type} orders found for this patient.
        </Alert>
      );
    }

    return (
      <List>
        {orderList.map((order) => (
          <Card key={order.id} sx={{ mb: 2 }}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                <Box flex={1}>
                  <Typography variant="h6" component="div">
                    {order.display}
                  </Typography>
                  <Box display="flex" gap={1} mt={1} mb={1}>
                    <Chip
                      icon={getStatusIcon(order.status)}
                      label={order.status}
                      size="small"
                      variant="outlined"
                    />
                    <Chip
                      label={order.priority}
                      size="small"
                      color={getPriorityColor(order.priority)}
                    />
                  </Box>
                  {order.dosage && (
                    <Typography variant="body2" color="text.secondary">
                      Dosage: {order.dosage} {order.route && `• Route: ${order.route}`} {order.frequency && `• ${order.frequency}`}
                    </Typography>
                  )}
                  {order.instructions && (
                    <Typography variant="body2" color="text.secondary">
                      Instructions: {order.instructions}
                    </Typography>
                  )}
                  {order.reason && (
                    <Typography variant="body2" color="text.secondary">
                      Reason: {order.reason}
                    </Typography>
                  )}
                  <Typography variant="caption" display="block" mt={1}>
                    Ordered by {order.requester} on {format(new Date(order.authoredOn), 'MM/dd/yyyy')}
                  </Typography>
                </Box>
                <Box>
                  {order.status === 'draft' && (
                    <IconButton
                      size="small"
                      onClick={() => handleDeleteOrder(order)}
                      color="error"
                    >
                      <DeleteIcon />
                    </IconButton>
                  )}
                </Box>
              </Box>
            </CardContent>
          </Card>
        ))}
      </List>
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">Clinical Orders</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setShowNewOrderDialog(true)}
        >
          New Order
        </Button>
      </Box>

      <Paper sx={{ mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
          <Tab icon={<MedicationIcon />} label={`Medications (${orders.medications.length})`} />
          <Tab icon={<LabIcon />} label={`Laboratory (${orders.labs.length})`} />
          <Tab icon={<ImagingIcon />} label={`Imaging (${orders.imaging.length})`} />
          <Tab icon={<ProcedureIcon />} label={`Procedures (${orders.procedures.length})`} />
        </Tabs>
      </Paper>

      <TabPanel value={activeTab} index={0}>
        {renderOrderList(orders.medications, 'medication')}
      </TabPanel>

      <TabPanel value={activeTab} index={1}>
        {renderOrderList(orders.labs, 'laboratory')}
      </TabPanel>

      <TabPanel value={activeTab} index={2}>
        {renderOrderList(orders.imaging, 'imaging')}
      </TabPanel>

      <TabPanel value={activeTab} index={3}>
        {renderOrderList(orders.procedures, 'procedure')}
      </TabPanel>

      {/* New Order Dialog */}
      <Dialog
        open={showNewOrderDialog}
        onClose={() => setShowNewOrderDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create New Order</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Order Type</InputLabel>
                <Select
                  value={orderType}
                  onChange={(e) => setOrderType(e.target.value)}
                  label="Order Type"
                >
                  <MenuItem value="medication">
                    <Box display="flex" alignItems="center" gap={1}>
                      <MedicationIcon fontSize="small" />
                      Medication
                    </Box>
                  </MenuItem>
                  <MenuItem value="lab">
                    <Box display="flex" alignItems="center" gap={1}>
                      <LabIcon fontSize="small" />
                      Laboratory
                    </Box>
                  </MenuItem>
                  <MenuItem value="imaging">
                    <Box display="flex" alignItems="center" gap={1}>
                      <ImagingIcon fontSize="small" />
                      Imaging
                    </Box>
                  </MenuItem>
                  <MenuItem value="procedure">
                    <Box display="flex" alignItems="center" gap={1}>
                      <ProcedureIcon fontSize="small" />
                      Procedure
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={orderType === 'medication' ? 'Medication Name' : 'Order Description'}
                value={newOrder.display}
                onChange={(e) => setNewOrder({ ...newOrder, display: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Priority</InputLabel>
                <Select
                  value={newOrder.priority}
                  onChange={(e) => setNewOrder({ ...newOrder, priority: e.target.value })}
                  label="Priority"
                >
                  <MenuItem value="routine">Routine</MenuItem>
                  <MenuItem value="urgent">Urgent</MenuItem>
                  <MenuItem value="asap">ASAP</MenuItem>
                  <MenuItem value="stat">STAT</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Instructions"
                value={newOrder.instructions}
                onChange={(e) => setNewOrder({ ...newOrder, instructions: e.target.value })}
                multiline
                rows={2}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Reason for Order"
                value={newOrder.reason}
                onChange={(e) => setNewOrder({ ...newOrder, reason: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowNewOrderDialog(false)}>Cancel</Button>
          <Button
            onClick={handleCreateOrder}
            variant="contained"
            disabled={!newOrder.display}
          >
            Create Order
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FHIROrdersTab;