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
  Cancel as CancelledIcon,
  Visibility as ViewResultsIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { useClinical } from '../../../contexts/ClinicalContext';
import { fhirClient } from '../../../core/fhir/services/fhirClient';
import { cdsHooksClient } from '../../../services/cdsHooksClient';
import { useAuth } from '../../../contexts/AuthContext';
import { enhancedOrderSearchService } from '../../../services/enhancedOrderSearch';
import { useClinicalWorkflow } from '../../../contexts/ClinicalWorkflowContext';

const TabPanel = ({ children, value, index }) => (
  <div hidden={value !== index} style={{ paddingTop: 16 }}>
    {value === index && children}
  </div>
);

const FHIROrdersTab = () => {
  const { currentPatient, currentEncounter } = useClinical();
  const { user } = useAuth();
  const { publish } = useClinicalWorkflow();
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
  // Order-Result linking: Track which orders have results
  const [orderResults, setOrderResults] = useState({}); // { orderId: { has_results, total_results, result_status } }

  useEffect(() => {
    if (currentPatient) {
      loadOrders();
      loadPatientAllergies();
    }
  }, [currentPatient?.id, currentEncounter?.id]);

  // Check for results when orders are loaded (Order-Result Linking)
  useEffect(() => {
    const checkOrderResults = async () => {
      const allOrders = [
        ...orders.labs.map(o => ({ ...o, resourceType: 'ServiceRequest' })),
        ...orders.imaging.map(o => ({ ...o, resourceType: 'ServiceRequest' })),
        ...orders.procedures.map(o => ({ ...o, resourceType: 'ServiceRequest' })),
        ...orders.medications.map(o => ({ ...o, resourceType: 'MedicationRequest' }))
      ];

      if (allOrders.length === 0) return;

      const resultsMap = {};

      // Check results for lab and imaging orders (most likely to have results)
      const ordersToCheck = [...orders.labs, ...orders.imaging];

      await Promise.all(
        ordersToCheck.map(async (order) => {
          try {
            const results = await enhancedOrderSearchService.getOrderResults(
              order.id,
              'ServiceRequest'
            );
            resultsMap[order.id] = {
              has_results: results.has_results,
              total_results: results.total_results,
              result_status: results.result_status
            };
          } catch (error) {
            console.error(`Failed to check results for order ${order.id}:`, error);
            resultsMap[order.id] = { has_results: false, total_results: 0, result_status: 'error' };
          }
        })
      );

      setOrderResults(resultsMap);
    };

    if (orders.labs.length > 0 || orders.imaging.length > 0) {
      checkOrderResults();
    }
  }, [orders.labs, orders.imaging]);

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
      // Load MedicationRequests with included Medication resources for name resolution
      const medRequests = await fhirClient.search('MedicationRequest', {
        patient: currentPatient.id,
        _sort: '-authored-on',
        _count: 100,
        _include: 'MedicationRequest:medication'
      });

      // Load ServiceRequests for labs, imaging, and procedures
      const serviceRequests = await fhirClient.search('ServiceRequest', {
        patient: currentPatient.id,
        _sort: '-authored-on',
        _count: 100
      });

      // Extract and enrich MedicationRequest resources with included Medication data
      const allResources = medRequests.resources || [];
      const medicationResources = allResources.filter(r => r.resourceType === 'Medication');
      const medicationRequestResources = allResources.filter(r => r.resourceType === 'MedicationRequest');

      // Build medication lookup for name resolution
      const medicationLookup = {};
      medicationResources.forEach(med => {
        if (med.id) {
          medicationLookup[med.id] = med;
        }
      });

      // Enrich MedicationRequests that use medicationReference
      const enrichedMedRequests = medicationRequestResources.map(medRequest => {
        if (medRequest.medicationReference && !medRequest.medicationCodeableConcept) {
          const refId = medRequest.medicationReference.reference?.replace('Medication/', '');
          const medication = medicationLookup[refId];
          if (medication?.code) {
            return {
              ...medRequest,
              _resolvedMedicationCodeableConcept: medication.code,
              medicationReference: {
                ...medRequest.medicationReference,
                display: medication.code.text || medication.code.coding?.[0]?.display
              }
            };
          }
        }
        return medRequest;
      });

      // Categorize orders
      const medications = enrichedMedRequests.map(transformMedicationRequest);
      
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
             medReq._resolvedMedicationCodeableConcept?.text ||
             medReq._resolvedMedicationCodeableConcept?.coding?.[0]?.display ||
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

  // Submit order through backend API for proper safety checks and audit trail
  const submitOrder = async (orderResource) => {
    const api = (await import('../../../services/api')).default;
    
    try {
      if (orderResource.resourceType === 'MedicationRequest') {
        // Route medication orders through backend for safety checks
        const medicationOrder = {
          patient_id: currentPatient.id,
          encounter_id: currentEncounter?.id,
          order_type: 'medication',
          priority: orderResource.priority || 'routine',
          indication: orderResource.reasonCode?.[0]?.text || newOrder.reason,
          clinical_information: newOrder.instructions,
          medication_details: {
            medication_name: orderResource.medicationCodeableConcept?.text || newOrder.display,
            medication_code: orderResource.medicationCodeableConcept?.coding?.[0]?.code,
            dose: 1, // Default - form should capture this
            dose_unit: 'unit',
            route: 'oral', // Default - form should capture this
            frequency: 'daily', // Default - form should capture this
            prn: false,
            dispense_quantity: 30,
            dispense_unit: 'tablets',
            refills: 0,
            generic_allowed: true,
            pharmacy_notes: newOrder.instructions
          },
          override_alerts: cdsAlerts.length > 0 // If we got here with alerts, user acknowledged them
        };
        
        const response = await api.post('/api/clinical/orders/medications', medicationOrder);
        
        // Check if order was blocked by safety alerts
        if (response.data && !response.data.order_saved) {
          // Show alerts that blocked the order
          if (response.data.alerts && response.data.alerts.length > 0) {
            setCdsAlerts(response.data.alerts.map(alert => ({
              indicator: alert.severity === 'high' ? 'critical' : alert.severity,
              summary: alert.message,
              detail: `Type: ${alert.type}`,
              source: { label: 'Drug Safety Check' }
            })));
            setPendingOrder(orderResource);
            setShowCdsAlertDialog(true);
            return; // Don't close dialog yet
          }
        }
      } else {
        // Route service requests (lab, imaging, procedure) through backend
        const category = orderResource.category?.[0]?.coding?.[0]?.code;
        let endpoint = '/api/clinical/orders/laboratory'; // default
        let orderPayload = {
          patient_id: currentPatient.id,
          encounter_id: currentEncounter?.id,
          priority: orderResource.priority || 'routine',
          indication: orderResource.reasonCode?.[0]?.text || newOrder.reason,
          clinical_information: newOrder.instructions
        };
        
        if (category === '363679005' || orderType === 'imaging') {
          endpoint = '/api/clinical/orders/imaging';
          orderPayload.imaging_details = {
            modality: newOrder.display.split(' ')[0] || 'XR', // Extract modality from display
            body_site: null,
            laterality: null,
            contrast: false,
            reason_for_exam: newOrder.reason,
            transport_mode: 'ambulatory'
          };
        } else {
          // Laboratory order
          orderPayload.laboratory_details = {
            test_name: newOrder.display,
            test_code: orderResource.code?.coding?.[0]?.code,
            specimen_type: null,
            fasting_required: false,
            special_instructions: newOrder.instructions
          };
        }
        
        await api.post(endpoint, orderPayload);
      }

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
    } catch (error) {
      console.error('Failed to create order via backend:', error);
      // If backend fails, show error to user
      throw new Error(error.response?.data?.detail || error.message || 'Failed to create order');
    }
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

  // Discontinue/cancel an order - routes through backend API for audit trail
  const handleDiscontinueOrder = async (order) => {
    const action = order.status === 'draft' ? 'delete' : 'discontinue';
    const confirmMessage = action === 'delete'
      ? 'Are you sure you want to delete this draft order?'
      : 'Are you sure you want to discontinue this order?';

    if (!window.confirm(confirmMessage)) {
      return;
    }

    // Prompt for discontinuation reason
    const reason = action === 'discontinue' 
      ? window.prompt('Please provide a reason for discontinuation:')
      : 'Draft order deleted';
    
    if (action === 'discontinue' && !reason) {
      alert('A reason is required to discontinue an order.');
      return;
    }

    try {
      const api = (await import('../../../services/api')).default;
      const resourceType = order.type === 'medication' ? 'MedicationRequest' : 'ServiceRequest';
      
      // Use backend API for discontinuation with audit trail
      await api.put(`/api/clinical/orders/${order.id}/discontinue`, null, {
        params: {
          resource_type: resourceType,
          reason: reason
        }
      });
      
      await loadOrders();
    } catch (error) {
      console.error('Failed to discontinue order:', error);
      alert('Failed to discontinue order: ' + (error.response?.data?.detail || error.message));
    }
  };

  // Alias for backward compatibility
  const handleDeleteOrder = handleDiscontinueOrder;

  // Navigate to Results tab with order context (Order-Result Linking)
  const handleViewResults = async (order) => {
    try {
      // Publish clinical event to navigate to Results tab with order filter
      // This allows the Results tab to filter and highlight results linked to this order
      publish('TAB_UPDATE', {
        targetTab: 'results',
        filter: {
          basedOn: `ServiceRequest/${order.id}`,
          orderId: order.id,
          orderDisplay: order.display
        }
      });

      // Also publish a specific order-result navigation event for debugging/logging
      publish('ORDER_RESULT_NAVIGATION', {
        orderId: order.id,
        orderType: order.type === 'medication' ? 'MedicationRequest' : 'ServiceRequest',
        orderDisplay: order.display,
        patientId: currentPatient?.id
      });
    } catch (error) {
      console.error('Failed to navigate to results:', error);
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
                  <Box display="flex" gap={1} mt={1} mb={1} flexWrap="wrap">
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
                    {/* Result status indicator - Order-Result Linking */}
                    {orderResults[order.id]?.has_results && (
                      <Chip
                        icon={<ViewResultsIcon fontSize="small" />}
                        label={orderResults[order.id].result_status === 'complete' ? 'Results Ready' : 'Partial Results'}
                        size="small"
                        color={orderResults[order.id].result_status === 'complete' ? 'success' : 'warning'}
                      />
                    )}
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
                <Box display="flex" gap={1} alignItems="center">
                  {/* View Results button - Order-Result Linking */}
                  {(type === 'laboratory' || type === 'imaging') && (
                    <Button
                      size="small"
                      onClick={() => handleViewResults(order)}
                      color="primary"
                      variant={orderResults[order.id]?.has_results ? 'contained' : 'outlined'}
                      startIcon={<ViewResultsIcon />}
                      title={
                        orderResults[order.id]?.has_results
                          ? `View ${orderResults[order.id].total_results} result(s)`
                          : 'Check for results'
                      }
                    >
                      {orderResults[order.id]?.has_results
                        ? `Results (${orderResults[order.id].total_results})`
                        : 'View Results'}
                    </Button>
                  )}
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