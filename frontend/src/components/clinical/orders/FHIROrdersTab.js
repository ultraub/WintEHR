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
import { fhirClient } from '../../../core/fhir/services/fhirClient';
import { cdsHooksClient } from '../../../services/cdsHooksClient';
import { useAuth } from '../../../contexts/AuthContext';

const TabPanel = ({ children, value, index }) => (
  <div hidden={value !== index} style={{ paddingTop: 16 }}>
    {value === index && children}
  </div>
);

const FHIROrdersTab = () => {
  const { currentPatient, currentEncounter } = useClinical();
  const { user } = useAuth();
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
  const [cdsAlerts, setCdsAlerts] = useState([]);
  const [showCdsAlertDialog, setShowCdsAlertDialog] = useState(false);
  const [pendingOrder, setPendingOrder] = useState(null);
  const [patientAllergies, setPatientAllergies] = useState([]);

  useEffect(() => {
    if (currentPatient) {
      loadOrders();
      loadPatientAllergies();
    }
  }, [currentPatient?.id, currentEncounter?.id]);

  // Load patient allergies from FHIR
  const loadPatientAllergies = async () => {
    try {
      const allergies = await fhirClient.search('AllergyIntolerance', {
        patient: currentPatient.id,
        'clinical-status': 'active',
        _count: 50
      });

      const allergyList = (allergies.resources || []).map(allergy => ({
        id: allergy.id,
        substance: allergy.code?.coding?.[0]?.display || allergy.code?.text || 'Unknown',
        reaction: allergy.reaction?.[0]?.manifestation?.[0]?.coding?.[0]?.display ||
                  allergy.reaction?.[0]?.manifestation?.[0]?.text || 'Not specified',
        severity: allergy.reaction?.[0]?.severity || allergy.criticality || 'unknown',
        category: allergy.category?.[0] || 'unknown'
      }));

      setPatientAllergies(allergyList);
    } catch (error) {
      console.error('Failed to load allergies:', error);
      setPatientAllergies([]);
    }
  };

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

  // Build the FHIR resource for the order
  const buildOrderResource = () => {
    if (orderType === 'medication') {
      return {
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
        requester: user?.id ? fhirClient.reference('Practitioner', user.id) : {
          display: 'Current Provider'
        },
        dosageInstruction: newOrder.instructions ? [{
          text: newOrder.instructions
        }] : undefined,
        reasonCode: newOrder.reason ? [{
          text: newOrder.reason
        }] : undefined
      };
    } else {
      return {
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
        requester: user?.id ? fhirClient.reference('Practitioner', user.id) : {
          display: 'Current Provider'
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
    }
  };

  // Execute CDS Hooks before order creation
  const checkCdsAlerts = async (orderResource) => {
    try {
      const userId = user?.id || 'unknown';
      let alerts = [];

      if (orderType === 'medication') {
        // Fire medication-prescribe hook for medication orders
        alerts = await cdsHooksClient.fireMedicationPrescribe(
          currentPatient.id,
          userId,
          [orderResource]
        );
      } else {
        // Fire order-sign hook for other order types
        alerts = await cdsHooksClient.fireOrderSign(
          currentPatient.id,
          userId,
          [orderResource]
        );
      }

      return alerts || [];
    } catch (error) {
      console.error('CDS Hooks check failed:', error);
      // Return warning alert so user knows CDS check failed
      return [{
        indicator: 'warning',
        summary: 'Clinical Decision Support Unavailable',
        detail: 'Unable to check clinical decision support rules. Please verify order safety manually.',
        source: { label: 'System' }
      }];
    }
  };

  // Actually create the order in FHIR
  const submitOrder = async (orderResource) => {
    const resourceType = orderResource.resourceType;
    await fhirClient.create(resourceType, orderResource);

    // Reload orders and close dialog
    await loadOrders();
    setShowNewOrderDialog(false);
    setShowCdsAlertDialog(false);
    setPendingOrder(null);
    setCdsAlerts([]);
    setNewOrder({
      display: '',
      priority: 'routine',
      instructions: '',
      reason: ''
    });
  };

  // Handle proceeding with order after CDS alerts
  const handleProceedWithOrder = async () => {
    if (pendingOrder) {
      try {
        await submitOrder(pendingOrder);
      } catch (error) {
        console.error('Failed to create order:', error);
        alert('Failed to create order: ' + error.message);
      }
    }
  };

  // Handle canceling order due to CDS alerts
  const handleCancelOrder = () => {
    setShowCdsAlertDialog(false);
    setPendingOrder(null);
    setCdsAlerts([]);
  };

  const handleCreateOrder = async () => {
    try {
      const orderResource = buildOrderResource();

      // Check CDS Hooks before creating order
      const alerts = await checkCdsAlerts(orderResource);

      if (alerts.length > 0) {
        // Show CDS alerts and let user decide to proceed or cancel
        setCdsAlerts(alerts);
        setPendingOrder(orderResource);
        setShowCdsAlertDialog(true);
      } else {
        // No alerts, proceed with order creation
        await submitOrder(orderResource);
      }
    } catch (error) {
      console.error('Failed to create order:', error);
      alert('Failed to create order: ' + error.message);
    }
  };

  // Discontinue/cancel an order - uses appropriate FHIR status per resource type
  const handleDiscontinueOrder = async (order) => {
    const action = order.status === 'draft' ? 'delete' : 'discontinue';
    const confirmMessage = action === 'delete'
      ? 'Are you sure you want to delete this draft order?'
      : 'Are you sure you want to discontinue this order?';

    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      const resourceType = order.type === 'medication' ? 'MedicationRequest' : 'ServiceRequest';
      const resource = await fhirClient.read(resourceType, order.id);

      // Use appropriate FHIR status per resource type:
      // MedicationRequest: 'stopped' for discontinued, 'cancelled' for draft
      // ServiceRequest: 'revoked' for discontinued/cancelled
      if (order.type === 'medication') {
        resource.status = order.status === 'draft' ? 'cancelled' : 'stopped';
      } else {
        resource.status = 'revoked';
      }

      await fhirClient.update(resourceType, order.id, resource);
      await loadOrders();
    } catch (error) {
      console.error('Failed to discontinue order:', error);
      alert('Failed to discontinue order: ' + error.message);
    }
  };

  // Alias for backward compatibility
  const handleDeleteOrder = handleDiscontinueOrder;

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
                      title="Delete draft order"
                    >
                      <DeleteIcon />
                    </IconButton>
                  )}
                  {order.status === 'active' && (
                    <Button
                      size="small"
                      onClick={() => handleDiscontinueOrder(order)}
                      color="error"
                      variant="outlined"
                      startIcon={<CancelledIcon />}
                    >
                      Discontinue
                    </Button>
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
          {/* Allergy Warning Section - Show for medication orders */}
          {orderType === 'medication' && patientAllergies.length > 0 && (
            <Alert severity="warning" sx={{ mb: 2, mt: 1 }}>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                Patient Allergies ({patientAllergies.length})
              </Typography>
              <Box component="ul" sx={{ m: 0, pl: 2 }}>
                {patientAllergies.slice(0, 5).map((allergy, index) => (
                  <li key={allergy.id || index}>
                    <Typography variant="body2">
                      <strong>{allergy.substance}</strong>
                      {allergy.reaction !== 'Not specified' && ` - ${allergy.reaction}`}
                      {allergy.severity && allergy.severity !== 'unknown' && (
                        <Chip
                          label={allergy.severity}
                          size="small"
                          color={allergy.severity === 'severe' || allergy.severity === 'high' ? 'error' : 'warning'}
                          sx={{ ml: 1, height: 18, fontSize: '0.7rem' }}
                        />
                      )}
                    </Typography>
                  </li>
                ))}
              </Box>
              {patientAllergies.length > 5 && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                  + {patientAllergies.length - 5} more allergies
                </Typography>
              )}
            </Alert>
          )}

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

      {/* CDS Alert Dialog */}
      <Dialog
        open={showCdsAlertDialog}
        onClose={handleCancelOrder}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ bgcolor: 'warning.light', color: 'warning.contrastText' }}>
          Clinical Decision Support Alerts
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography variant="body2" color="text.secondary" mb={2}>
            The following clinical alerts were generated for this order. Please review before proceeding.
          </Typography>
          {cdsAlerts.map((alert, index) => (
            <Alert
              key={index}
              severity={alert.indicator === 'critical' ? 'error' : alert.indicator === 'warning' ? 'warning' : 'info'}
              sx={{ mb: 2 }}
            >
              <Typography variant="subtitle2" fontWeight="bold">
                {alert.summary}
              </Typography>
              {alert.detail && (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  {alert.detail}
                </Typography>
              )}
              {alert.source?.label && (
                <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                  Source: {alert.source.label}
                </Typography>
              )}
            </Alert>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelOrder} color="error">
            Cancel Order
          </Button>
          <Button onClick={handleProceedWithOrder} variant="contained" color="warning">
            Acknowledge & Proceed
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FHIROrdersTab;