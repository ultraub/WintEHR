/**
 * CPOE (Computerized Physician Order Entry) Dialog
 * Comprehensive order entry system with clinical decision support
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Stack,
  Paper,
  Divider,
  Chip,
  TextField,
  FormControl,
  FormControlLabel,
  Checkbox,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Stepper,
  Step,
  StepLabel,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Collapse,
  Grid,
  Card,
  CardContent,
  Autocomplete,
  IconButton,
  Tooltip,
  useTheme,
  alpha,
  Tabs,
  Tab,
  Avatar
} from '@mui/material';
import {
  Medication as MedicationIcon,
  Science as LabIcon,
  Image as ImagingIcon,
  Assignment as OrderIcon,
  Assignment as AssignmentIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  Info as InfoIcon,
  Person as PatientIcon,
  Schedule as ScheduleIcon,
  LocalPharmacy as PharmacyIcon,
  ExpandMore as ExpandMoreIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Send as SendIcon,
  Security as SecurityIcon,
  VerifiedUser as VerifiedIcon,
  History as HistoryIcon
} from '@mui/icons-material';
import { format, addDays, addWeeks, addMonths } from 'date-fns';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import { useAuth } from '../../../../contexts/AuthContext';
import { useClinicalWorkflow, CLINICAL_EVENTS } from '../../../../contexts/ClinicalWorkflowContext';
import { fhirClient } from '../../../../services/fhirClient';
import { prescriptionStatusService } from '../../../../services/prescriptionStatusService';
import { medicationListManagementService } from '../../../../services/medicationListManagementService';
import { enhancedLabOrderingService } from '../../../../services/enhancedLabOrderingService';
import EnhancedMedicationSearch from '../../prescribing/EnhancedMedicationSearch';
import MedicationHistoryReview from '../../prescribing/MedicationHistoryReview';

// Order Templates
const ORDER_TEMPLATES = {
  medication: {
    'diabetes-starter': {
      name: 'Diabetes Starter Pack',
      items: [
        {
          medication: 'Metformin 500mg',
          dosage: '500mg',
          frequency: 'twice daily',
          duration: '30 days',
          quantity: 60,
          refills: 5
        },
        {
          medication: 'Glucometer supplies',
          dosage: 'Test strips',
          frequency: 'as needed',
          duration: '30 days',
          quantity: 100,
          refills: 5
        }
      ]
    },
    'hypertension-basic': {
      name: 'Hypertension Management',
      items: [
        {
          medication: 'Lisinopril 10mg',
          dosage: '10mg',
          frequency: 'once daily',
          duration: '30 days',
          quantity: 30,
          refills: 5
        }
      ]
    }
  },
  lab: {}, // Enhanced lab ordering now handled by enhancedLabOrderingService
  imaging: {
    'chest-workup': {
      name: 'Chest X-Ray Workup',
      items: [
        { study: 'Chest X-Ray PA and Lateral', code: '36643-5', priority: 'routine' }
      ]
    },
    'abdominal-pain': {
      name: 'Abdominal Pain Workup',
      items: [
        { study: 'CT Abdomen/Pelvis with Contrast', code: '46333-0', priority: 'urgent' }
      ]
    }
  }
};

// Clinical Decision Support Rules
const CDS_RULES = {
  medication: [
    {
      condition: (medication, patient, allergies) => {
        return allergies.some(allergy => 
          allergy.code?.text?.toLowerCase().includes('penicillin') &&
          medication.toLowerCase().includes('amoxicillin')
        );
      },
      severity: 'error',
      message: 'Patient has penicillin allergy. Amoxicillin is contraindicated.',
      suggestion: 'Consider azithromycin or cephalexin instead.'
    },
    {
      condition: (medication, patient) => {
        const age = patient.birthDate ? 
          new Date().getFullYear() - new Date(patient.birthDate).getFullYear() : 0;
        return age > 65 && medication.toLowerCase().includes('aspirin');
      },
      severity: 'warning',
      message: 'Patient is over 65. Monitor for bleeding risk with aspirin.',
      suggestion: 'Consider lower dose or alternative antiplatelet therapy.'
    }
  ],
  lab: [
    {
      condition: (test, patient, conditions) => {
        return conditions.some(c => 
          c.code?.text?.toLowerCase().includes('diabetes') &&
          test.toLowerCase().includes('a1c')
        );
      },
      severity: 'info',
      message: 'Patient has diabetes. A1C monitoring recommended every 3-6 months.',
      suggestion: 'Consider adding fasting glucose and microalbumin.'
    }
  ]
};

const CPOEDialog = ({ 
  open, 
  onClose, 
  patientId, 
  initialOrderType = 'medication',
  encounterId = null,
  onOrderCreated 
}) => {
  const theme = useTheme();
  const { currentUser } = useAuth();
  const { getPatientResources, currentPatient } = useFHIRResource();
  const { publish } = useClinicalWorkflow();

  // State management
  const [activeTab, setActiveTab] = useState(0);
  const [orderType, setOrderType] = useState(initialOrderType);
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [cdsAlerts, setCdsAlerts] = useState([]);
  const [validationErrors, setValidationErrors] = useState([]);
  const [orderDetails, setOrderDetails] = useState({
    priority: 'routine',
    notes: '',
    indication: '',
    providerPin: '',
    scheduleDate: null
  });
  const [showMedicationHistory, setShowMedicationHistory] = useState(false);
  
  // Enhanced lab ordering state
  const [labPanels, setLabPanels] = useState({});
  const [conditionSets, setConditionSets] = useState({});
  const [routineTemplates, setRoutineTemplates] = useState({});
  const [appropriatenessAlerts, setAppropriatenessAlerts] = useState([]);
  const [patientConditions, setPatientConditions] = useState([]);

  // Initialize with empty order based on type
  useEffect(() => {
    if (open) {
      resetForm();
    }
  }, [open, orderType]);

  // Initialize enhanced lab ordering data
  useEffect(() => {
    if (open && orderType === 'lab') {
      initializeLabOrderingData();
    }
  }, [open, orderType, patientId]);

  const initializeLabOrderingData = async () => {
    try {
      // Load lab panels, condition sets, and routine templates
      const panels = enhancedLabOrderingService.getCommonLabPanels();
      const conditions = enhancedLabOrderingService.getConditionBasedSets();
      const templates = enhancedLabOrderingService.getRoutineCareTemplates();
      
      setLabPanels(panels);
      setConditionSets(conditions);
      setRoutineTemplates(templates);

      // Get patient conditions for appropriateness checking
      if (patientId) {
        const conditions = getPatientResources(patientId, 'Condition') || [];
        setPatientConditions(conditions);
      }
    } catch (error) {
      console.error('Error initializing lab ordering data:', error);
    }
  };

  const resetForm = () => {
    setOrders([]);
    setSelectedTemplate('');
    setCdsAlerts([]);
    setValidationErrors([]);
    setAppropriatenessAlerts([]);
    setOrderDetails({
      priority: 'routine',
      notes: '',
      indication: '',
      providerPin: '',
      scheduleDate: null
    });
    
    // Add initial empty order
    addNewOrder();
  };

  const addNewOrder = () => {
    const newOrder = {
      id: Date.now(),
      type: orderType,
      ...getEmptyOrderData(orderType)
    };
    setOrders(prev => [...prev, newOrder]);
  };

  const getEmptyOrderData = (type) => {
    switch (type) {
      case 'medication':
        return {
          medication: '',
          dosage: '',
          route: 'oral',
          frequency: '',
          duration: '',
          quantity: '',
          refills: 0,
          substitution: true
        };
      case 'lab':
        return {
          test: '',
          code: '',
          specimen: 'blood',
          fastingRequired: false,
          urgency: 'routine'
        };
      case 'imaging':
        return {
          study: '',
          code: '',
          bodyPart: '',
          contrast: false,
          reason: ''
        };
      default:
        return {};
    }
  };

  const updateOrder = (orderId, field, value) => {
    setOrders(prev => prev.map(order => 
      order.id === orderId ? { ...order, [field]: value } : order
    ));
    
    // Trigger CDS checks when medication changes
    if (field === 'medication' && orderType === 'medication') {
      checkCDSRules(value);
    }
    
    // Trigger lab appropriateness checks when lab test changes
    if (field === 'test' && orderType === 'lab') {
      checkLabAppropriateness(value);
    }
  };

  // Lab appropriateness checking
  const checkLabAppropriateness = async (testName) => {
    if (!testName || !patientId) return;
    
    try {
      const alerts = await enhancedLabOrderingService.checkLabAppropriateness({
        patientId,
        testName,
        patientConditions,
        recentOrders: getPatientResources(patientId, 'ServiceRequest') || [],
        currentMedications: getPatientResources(patientId, 'MedicationRequest') || []
      });
      
      setAppropriatenessAlerts(alerts);
    } catch (error) {
      console.error('Error checking lab appropriateness:', error);
    }
  };

  const removeOrder = (orderId) => {
    setOrders(prev => prev.filter(order => order.id !== orderId));
  };

  // Handle enhanced medication selection
  const handleMedicationFromHistory = (historicalMed) => {
    // Create new order based on historical medication
    const newOrder = {
      id: Date.now(),
      type: 'medication',
      medication: historicalMed.medication,
      dosage: historicalMed.dosageInstructions?.split(' ')[0] || '',
      route: 'oral', // Default, could be parsed from dosageInstructions
      frequency: historicalMed.dosageInstructions?.replace(/^\d+\w+\s*/, '') || '',
      duration: '30 days', // Default
      quantity: historicalMed.quantity?.value || '',
      refills: historicalMed.refills || 0,
      substitution: true
    };
    
    setOrders(prev => [...prev, newOrder]);
    setShowMedicationHistory(false);
    
    // Trigger CDS checks
    checkCDSRules(historicalMed.medication);
  };

  const handleMedicationSelect = (orderId, medicationData) => {
    if (medicationData.template) {
      // Handle template selection - create multiple orders
      const templateOrders = medicationData.medications.map(medData => ({
        id: Date.now() + Math.random(),
        ...getEmptyOrderData('medication'),
        medication: medData.medication?.name || '',
        dosage: medData.dosing?.split(' ')[0] || '',
        frequency: medData.dosing?.replace(/^\d+\w+\s*/, '') || '',
        duration: medData.duration || '',
        refills: medData.refills || 0,
        route: 'oral'
      }));

      setOrders(prev => [...prev.filter(order => order.id !== orderId), ...templateOrders]);
    } else if (medicationData.medication) {
      // Handle single medication selection
      const medication = medicationData.medication;
      const dosing = medicationData.dosing;

      setOrders(prev => prev.map(order => 
        order.id === orderId ? {
          ...order,
          medication: medication.name || '',
          dosage: dosing?.recommended?.initial?.split(' ')[0] || dosing?.adult?.initial?.split(' ')[0] || '',
          frequency: dosing?.recommended?.initial?.replace(/^\d+\w+\s*/, '') || dosing?.adult?.initial?.replace(/^\d+\w+\s*/, '') || '',
          duration: '30 days',
          route: 'oral',
          medicationDetails: medication,
          dosingGuidance: dosing,
          safetyAlerts: medicationData.safetyAlerts || []
        } : order
      ));

      // Trigger CDS checks with enhanced data
      if (medicationData.safetyAlerts?.length > 0) {
        const enhancedAlerts = medicationData.safetyAlerts.map(alert => ({
          severity: alert.severity === 'critical' ? 'error' : alert.severity,
          message: alert.description || alert.reaction || 'Safety alert',
          suggestion: alert.recommendation || 'Review medication safety',
          type: 'medication'
        }));
        
        setCdsAlerts(prev => [...prev, ...enhancedAlerts]);
      }
    }
  };

  const checkCDSRules = async (medication) => {
    if (!medication || !currentPatient) return;
    
    try {
      // Get patient allergies and conditions
      const allergies = getPatientResources(patientId, 'AllergyIntolerance') || [];
      const conditions = getPatientResources(patientId, 'Condition') || [];
      
      const alerts = [];
      
      // Check medication rules
      CDS_RULES.medication.forEach(rule => {
        if (rule.condition(medication, currentPatient, allergies)) {
          alerts.push({
            severity: rule.severity,
            message: rule.message,
            suggestion: rule.suggestion,
            type: 'medication'
          });
        }
      });
      
      setCdsAlerts(alerts);
    } catch (error) {
      // Handle CDS check error
    }
  };

  const applyTemplate = (templateKey) => {
    if (orderType === 'lab') {
      applyLabTemplate(templateKey);
    } else {
      const template = ORDER_TEMPLATES[orderType]?.[templateKey];
      if (!template) return;
      
      const templateOrders = template.items.map((item, index) => ({
        id: Date.now() + index,
        type: orderType,
        ...item
      }));
      
      setOrders(templateOrders);
      setSelectedTemplate(templateKey);
    }
  };

  const applyLabTemplate = (templateKey) => {
    let template = null;
    let sourceType = '';

    // Check which type of lab template this is
    if (labPanels[templateKey]) {
      template = labPanels[templateKey];
      sourceType = 'panel';
    } else if (conditionSets[templateKey]) {
      template = conditionSets[templateKey];
      sourceType = 'condition-set';
    } else if (routineTemplates[templateKey]) {
      template = routineTemplates[templateKey];
      sourceType = 'routine-template';
    }

    if (!template) return;

    let templateOrders = [];

    if (sourceType === 'panel') {
      // Single panel with components
      templateOrders = [{
        id: Date.now(),
        type: 'lab',
        test: template.name,
        code: template.code,
        specimen: 'blood',
        fastingRequired: template.fastingRequired || false,
        urgency: 'routine',
        panelComponents: template.components,
        estimatedTAT: template.estimatedTAT,
        clinicalUse: template.clinicalUse
      }];
    } else if (sourceType === 'condition-set' || sourceType === 'routine-template') {
      // Multiple tests/panels
      templateOrders = template.tests.map((test, index) => ({
        id: Date.now() + index,
        type: 'lab',
        test: test.name,
        code: test.code,
        specimen: test.specimen || 'blood',
        fastingRequired: test.fastingRequired || false,
        urgency: test.urgency || 'routine',
        estimatedTAT: test.estimatedTAT,
        clinicalUse: test.clinicalUse
      }));
    }

    setOrders(templateOrders);
    setSelectedTemplate(templateKey);

    // Check appropriateness for each test
    templateOrders.forEach(order => {
      checkLabAppropriateness(order.test);
    });
  };

  const validateOrders = () => {
    const errors = [];
    
    orders.forEach((order, index) => {
      if (orderType === 'medication') {
        if (!order.medication) errors.push(`Order ${index + 1}: Medication is required`);
        if (!order.dosage) errors.push(`Order ${index + 1}: Dosage is required`);
        if (!order.frequency) errors.push(`Order ${index + 1}: Frequency is required`);
      } else if (orderType === 'lab') {
        if (!order.test) errors.push(`Order ${index + 1}: Test name is required`);
      } else if (orderType === 'imaging') {
        if (!order.study) errors.push(`Order ${index + 1}: Study name is required`);
        if (!order.reason) errors.push(`Order ${index + 1}: Clinical indication is required`);
      }
    });
    
    if (!orderDetails.indication) {
      errors.push('Clinical indication is required');
    }
    
    if (!orderDetails.providerPin) {
      errors.push('Provider PIN is required for order signing');
    }
    
    setValidationErrors(errors);
    return errors.length === 0;
  };

  const submitOrders = async () => {
    if (!validateOrders()) {
      return;
    }
    
    setLoading(true);
    
    try {
      const createdOrders = [];
      
      for (const order of orders) {
        let fhirResource;
        
        if (orderType === 'medication') {
          fhirResource = {
            resourceType: 'MedicationRequest',
            status: 'active',
            intent: 'order',
            priority: orderDetails.priority,
            subject: { reference: `Patient/${patientId}` },
            encounter: encounterId ? { reference: `Encounter/${encounterId}` } : undefined,
            authoredOn: new Date().toISOString(),
            requester: {
              reference: `Practitioner/${currentUser.id}`,
              display: currentUser.name || currentUser.username
            },
            medicationCodeableConcept: {
              text: order.medication
            },
            dosageInstruction: [{
              text: `${order.dosage} ${order.route} ${order.frequency} for ${order.duration}`,
              route: {
                coding: [{
                  system: 'http://snomed.info/sct',
                  code: order.route === 'oral' ? '26643006' : '263887005',
                  display: order.route
                }]
              }
            }],
            dispenseRequest: {
              quantity: { 
                value: parseFloat(order.quantity) || 30,
                unit: 'tablet'
              },
              numberOfRepeatsAllowed: parseInt(order.refills) || 0
            },
            substitution: {
              allowedBoolean: order.substitution
            },
            reasonCode: [{
              text: orderDetails.indication
            }],
            note: orderDetails.notes ? [{ text: orderDetails.notes }] : []
          };
        } else if (orderType === 'lab') {
          fhirResource = {
            resourceType: 'ServiceRequest',
            status: 'active',
            intent: 'order',
            priority: orderDetails.priority,
            subject: { reference: `Patient/${patientId}` },
            encounter: encounterId ? { reference: `Encounter/${encounterId}` } : undefined,
            authoredOn: new Date().toISOString(),
            requester: {
              reference: `Practitioner/${currentUser.id}`,
              display: currentUser.name || currentUser.username
            },
            category: [{
              coding: [{
                system: 'http://snomed.info/sct',
                code: '108252007',
                display: 'Laboratory procedure'
              }]
            }],
            code: {
              text: order.test,
              coding: order.code ? [{
                system: 'http://loinc.org',
                code: order.code
              }] : []
            },
            specimen: [{
              display: order.specimen
            }],
            reasonCode: [{
              text: orderDetails.indication
            }],
            note: [
              ...(orderDetails.notes ? [{ text: orderDetails.notes }] : []),
              ...(order.fastingRequired ? [{ text: 'Fasting required' }] : [])
            ]
          };
        } else if (orderType === 'imaging') {
          fhirResource = {
            resourceType: 'ServiceRequest',
            status: 'active',
            intent: 'order',
            priority: orderDetails.priority,
            subject: { reference: `Patient/${patientId}` },
            encounter: encounterId ? { reference: `Encounter/${encounterId}` } : undefined,
            authoredOn: new Date().toISOString(),
            requester: {
              reference: `Practitioner/${currentUser.id}`,
              display: currentUser.name || currentUser.username
            },
            category: [{
              coding: [{
                system: 'http://snomed.info/sct',
                code: '363679005',
                display: 'Imaging'
              }]
            }],
            code: {
              text: order.study,
              coding: order.code ? [{
                system: 'http://loinc.org',
                code: order.code
              }] : []
            },
            bodySite: order.bodyPart ? [{
              text: order.bodyPart
            }] : [],
            reasonCode: [{
              text: order.reason || orderDetails.indication
            }],
            note: [
              ...(orderDetails.notes ? [{ text: orderDetails.notes }] : []),
              ...(order.contrast ? [{ text: 'Contrast required' }] : [])
            ]
          };
        }
        
        // Save the order
        const resourceType = orderType === 'medication' ? 'MedicationRequest' : 'ServiceRequest';
        const createdResource = await fhirClient.create(resourceType, fhirResource);
        
        if (!createdResource) {
          throw new Error(`Failed to create ${orderType} order`);
        }
        
        createdOrders.push(createdResource);
      }
      
      // Publish order created events
      for (const order of createdOrders) {
        const eventData = {
          orderId: order.id,
          patientId,
          encounterId,
          orderType,
          providerId: currentUser.id,
          priority: orderDetails.priority,
          timestamp: new Date().toISOString()
        };

        // Add medication-specific data for prescriptions
        if (orderType === 'medication') {
          eventData.medicationRequestId = order.id;
          eventData.medication = order.medicationCodeableConcept?.text;
          
          // Initialize prescription status tracking
          try {
            await prescriptionStatusService.updatePrescriptionStatus(
              order.id,
              'ORDERED',
              'Prescription created and sent to pharmacy'
            );
          } catch (error) {
            console.error('Error initializing prescription status:', error);
          }
          
          // Update medication lists automatically
          try {
            await medicationListManagementService.handleNewPrescription(order);
          } catch (error) {
            console.error('Error updating medication lists:', error);
          }
        }

        await publish(CLINICAL_EVENTS.ORDER_PLACED, eventData);
      }
      
      // Refresh patient resources
      window.dispatchEvent(new CustomEvent('fhir-resources-updated', { 
        detail: { patientId } 
      }));
      
      // Notify parent component
      if (onOrderCreated) {
        onOrderCreated(createdOrders);
      }
      
      onClose();
      
    } catch (error) {
      setValidationErrors([`Failed to submit orders: ${error.message}`]);
    } finally {
      setLoading(false);
    }
  };

  const renderOrderForm = (order) => {
    switch (orderType) {
      case 'medication':
        return (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <EnhancedMedicationSearch
                patientId={patientId}
                currentMedications={orders.filter(o => o.medication && o.id !== order.id).map(o => o.medicationDetails).filter(Boolean)}
                onMedicationSelect={(medicationData) => handleMedicationSelect(order.id, medicationData)}
                defaultValue={order.medication}
                showDosingGuidance={true}
                showSafetyChecks={true}
                showTemplates={true}
              />
            </Grid>
            {order.medication && (
              <>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    label="Dosage"
                    value={order.dosage}
                    onChange={(e) => updateOrder(order.id, 'dosage', e.target.value)}
                    placeholder="e.g., 500mg"
                    helperText={order.dosingGuidance?.recommended?.initial || order.dosingGuidance?.adult?.initial || ''}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Route</InputLabel>
                <Select
                  value={order.route}
                  onChange={(e) => updateOrder(order.id, 'route', e.target.value)}
                >
                  <MenuItem value="oral">Oral</MenuItem>
                  <MenuItem value="topical">Topical</MenuItem>
                  <MenuItem value="injection">Injection</MenuItem>
                  <MenuItem value="inhalation">Inhalation</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Frequency"
                value={order.frequency}
                onChange={(e) => updateOrder(order.id, 'frequency', e.target.value)}
                placeholder="e.g., twice daily"
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Duration"
                value={order.duration}
                onChange={(e) => updateOrder(order.id, 'duration', e.target.value)}
                placeholder="e.g., 30 days"
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                fullWidth
                label="Quantity"
                type="number"
                value={order.quantity}
                onChange={(e) => updateOrder(order.id, 'quantity', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                fullWidth
                label="Refills"
                type="number"
                value={order.refills}
                onChange={(e) => updateOrder(order.id, 'refills', e.target.value)}
                inputProps={{ min: 0, max: 11 }}
              />
            </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={order.substitution}
                        onChange={(e) => updateOrder(order.id, 'substitution', e.target.checked)}
                      />
                    }
                    label="Allow generic substitution"
                  />
                </Grid>
              </>
            )}
          </Grid>
        );
        
      case 'lab':
        return (
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Test/Panel"
                value={order.test}
                onChange={(e) => updateOrder(order.id, 'test', e.target.value)}
                placeholder="Enter test name"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="LOINC Code"
                value={order.code}
                onChange={(e) => updateOrder(order.id, 'code', e.target.value)}
                placeholder="Optional"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Specimen</InputLabel>
                <Select
                  value={order.specimen}
                  onChange={(e) => updateOrder(order.id, 'specimen', e.target.value)}
                >
                  <MenuItem value="blood">Blood</MenuItem>
                  <MenuItem value="urine">Urine</MenuItem>
                  <MenuItem value="stool">Stool</MenuItem>
                  <MenuItem value="sputum">Sputum</MenuItem>
                  <MenuItem value="swab">Swab</MenuItem>
                  <MenuItem value="saliva">Saliva</MenuItem>
                  <MenuItem value="csf">CSF</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            {/* Enhanced lab order fields */}
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Priority</InputLabel>
                <Select
                  value={order.urgency || 'routine'}
                  onChange={(e) => updateOrder(order.id, 'urgency', e.target.value)}
                >
                  <MenuItem value="routine">Routine</MenuItem>
                  <MenuItem value="urgent">Urgent</MenuItem>
                  <MenuItem value="stat">STAT</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            {order.estimatedTAT && (
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Estimated TAT"
                  value={order.estimatedTAT}
                  InputProps={{ readOnly: true }}
                  helperText="Estimated turnaround time"
                />
              </Grid>
            )}
            
            {order.clinicalUse && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Clinical Use"
                  value={order.clinicalUse}
                  InputProps={{ readOnly: true }}
                  multiline
                  rows={2}
                  helperText="Clinical indication for this test"
                />
              </Grid>
            )}
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={order.fastingRequired}
                    onChange={(e) => updateOrder(order.id, 'fastingRequired', e.target.checked)}
                  />
                }
                label="Fasting required"
              />
            </Grid>
            
            {/* Panel Components Display */}
            {order.panelComponents && order.panelComponents.length > 0 && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  Panel Components:
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {order.panelComponents.map((component, index) => (
                    <Chip
                      key={index}
                      label={component.name}
                      size="small"
                      variant="outlined"
                      title={`${component.code} - ${component.system}`}
                    />
                  ))}
                </Stack>
              </Grid>
            )}
          </Grid>
        );
        
      case 'imaging':
        return (
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Study"
                value={order.study}
                onChange={(e) => updateOrder(order.id, 'study', e.target.value)}
                placeholder="Enter imaging study"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Body Part"
                value={order.bodyPart}
                onChange={(e) => updateOrder(order.id, 'bodyPart', e.target.value)}
                placeholder="e.g., chest"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Priority</InputLabel>
                <Select
                  value={order.urgency || 'routine'}
                  onChange={(e) => updateOrder(order.id, 'urgency', e.target.value)}
                >
                  <MenuItem value="routine">Routine</MenuItem>
                  <MenuItem value="urgent">Urgent</MenuItem>
                  <MenuItem value="stat">STAT</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Clinical Indication"
                value={order.reason}
                onChange={(e) => updateOrder(order.id, 'reason', e.target.value)}
                placeholder="Reason for imaging study"
                multiline
                rows={2}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={order.contrast}
                    onChange={(e) => updateOrder(order.id, 'contrast', e.target.checked)}
                  />
                }
                label="Contrast required"
              />
            </Grid>
          </Grid>
        );
        
      default:
        return null;
    }
  };

  if (!currentPatient) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      disableEscapeKeyDown
    >
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h6">
              Computerized Physician Order Entry (CPOE)
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Patient: {currentPatient.name?.[0]?.given?.join(' ')} {currentPatient.name?.[0]?.family}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Chip label={`${orders.length} Order${orders.length !== 1 ? 's' : ''}`} />
            {(cdsAlerts.length > 0 || appropriatenessAlerts.length > 0) && (
              <Chip 
                label={`${cdsAlerts.length + appropriatenessAlerts.length} Alert${(cdsAlerts.length + appropriatenessAlerts.length) !== 1 ? 's' : ''}`} 
                color="warning"
                icon={<WarningIcon />}
              />
            )}
          </Stack>
        </Stack>
      </DialogTitle>

      <DialogContent>
        {/* Order Type Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
            <Tab 
              icon={<MedicationIcon />} 
              label="Medications" 
              onClick={() => setOrderType('medication')}
            />
            <Tab 
              icon={<LabIcon />} 
              label="Laboratory" 
              onClick={() => setOrderType('lab')}
            />
            <Tab 
              icon={<ImagingIcon />} 
              label="Imaging" 
              onClick={() => setOrderType('imaging')}
            />
          </Tabs>
        </Box>

        {/* Order Templates */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Order Templates
          </Typography>
          
          {orderType === 'lab' ? (
            <Box>
              {/* Common Lab Panels */}
              {Object.keys(labPanels).length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Common Lab Panels
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {Object.entries(labPanels).map(([key, panel]) => (
                      <Button
                        key={key}
                        variant={selectedTemplate === key ? 'contained' : 'outlined'}
                        size="small"
                        onClick={() => applyTemplate(key)}
                        startIcon={<LabIcon />}
                      >
                        {panel.name}
                      </Button>
                    ))}
                  </Stack>
                </Box>
              )}

              {/* Condition-Based Sets */}
              {Object.keys(conditionSets).length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Condition-Based Lab Sets
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {Object.entries(conditionSets).map(([key, set]) => (
                      <Button
                        key={key}
                        variant={selectedTemplate === key ? 'contained' : 'outlined'}
                        size="small"
                        onClick={() => applyTemplate(key)}
                        startIcon={<AssignmentIcon />}
                      >
                        {set.name}
                      </Button>
                    ))}
                  </Stack>
                </Box>
              )}

              {/* Routine Care Templates */}
              {Object.keys(routineTemplates).length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Routine Care Templates
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {Object.entries(routineTemplates).map(([key, template]) => (
                      <Button
                        key={key}
                        variant={selectedTemplate === key ? 'contained' : 'outlined'}
                        size="small"
                        onClick={() => applyTemplate(key)}
                        startIcon={<ScheduleIcon />}
                      >
                        {template.name}
                      </Button>
                    ))}
                  </Stack>
                </Box>
              )}
            </Box>
          ) : (
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {Object.entries(ORDER_TEMPLATES[orderType] || {}).map(([key, template]) => (
                <Button
                  key={key}
                  variant={selectedTemplate === key ? 'contained' : 'outlined'}
                  size="small"
                  onClick={() => applyTemplate(key)}
                >
                  {template.name}
                </Button>
              ))}
            </Stack>
          )}
        </Box>

        {/* Medication History for medication orders */}
        {orderType === 'medication' && (
          <Box sx={{ mb: 3 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">
                Medication History
              </Typography>
              <Button
                size="small"
                startIcon={<HistoryIcon />}
                onClick={() => setShowMedicationHistory(!showMedicationHistory)}
                variant={showMedicationHistory ? 'contained' : 'outlined'}
              >
                {showMedicationHistory ? 'Hide' : 'Review'} History
              </Button>
            </Stack>
            
            <Collapse in={showMedicationHistory}>
              <Paper variant="outlined" sx={{ p: 2, maxHeight: 400, overflow: 'auto' }}>
                <MedicationHistoryReview
                  patientId={patientId}
                  onMedicationSelect={handleMedicationFromHistory}
                  showActiveOnly={false}
                  timeRange={12}
                  highlightDuplicates={true}
                  compactView={false}
                />
              </Paper>
            </Collapse>
          </Box>
        )}

        {/* CDS Alerts */}
        {(cdsAlerts.length > 0 || appropriatenessAlerts.length > 0) && (
          <Box sx={{ mb: 3 }}>
            {/* Medication CDS Alerts */}
            {cdsAlerts.map((alert, index) => (
              <Alert 
                key={`cds-${index}`} 
                severity={alert.severity} 
                sx={{ mb: 1 }}
                action={
                  alert.suggestion && (
                    <Button color="inherit" size="small">
                      Apply Suggestion
                    </Button>
                  )
                }
              >
                <Typography variant="body2" fontWeight="bold">
                  {alert.message}
                </Typography>
                {alert.suggestion && (
                  <Typography variant="body2">
                    Suggestion: {alert.suggestion}
                  </Typography>
                )}
              </Alert>
            ))}
            
            {/* Lab Appropriateness Alerts */}
            {appropriatenessAlerts.map((alert, index) => (
              <Alert 
                key={`lab-${index}`} 
                severity={alert.severity} 
                sx={{ mb: 1 }}
                icon={<LabIcon />}
                action={
                  alert.recommendation && (
                    <Button color="inherit" size="small">
                      View Details
                    </Button>
                  )
                }
              >
                <Typography variant="body2" fontWeight="bold">
                  {alert.message}
                </Typography>
                {alert.reason && (
                  <Typography variant="body2">
                    Reason: {alert.reason}
                  </Typography>
                )}
                {alert.recommendation && (
                  <Typography variant="body2">
                    Recommendation: {alert.recommendation}
                  </Typography>
                )}
                {alert.lastOrderDate && (
                  <Typography variant="caption" color="text.secondary">
                    Last ordered: {format(new Date(alert.lastOrderDate), 'MMM d, yyyy')}
                  </Typography>
                )}
              </Alert>
            ))}
          </Box>
        )}

        {/* Orders List */}
        <Typography variant="h6" gutterBottom>
          Orders ({orders.length})
        </Typography>
        
        {orders.map((order, index) => (
          <Card key={order.id} sx={{ mb: 2 }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="subtitle1">
                  {orderType.charAt(0).toUpperCase() + orderType.slice(1)} Order {index + 1}
                </Typography>
                <IconButton onClick={() => removeOrder(order.id)} disabled={orders.length === 1}>
                  <DeleteIcon />
                </IconButton>
              </Stack>
              {renderOrderForm(order)}
            </CardContent>
          </Card>
        ))}

        <Button
          startIcon={<AddIcon />}
          onClick={addNewOrder}
          variant="outlined"
          sx={{ mb: 3 }}
        >
          Add Another {orderType} Order
        </Button>

        {/* Order Details */}
        <Typography variant="h6" gutterBottom>
          Order Details
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>Priority</InputLabel>
              <Select
                value={orderDetails.priority}
                onChange={(e) => setOrderDetails({ ...orderDetails, priority: e.target.value })}
              >
                <MenuItem value="routine">Routine</MenuItem>
                <MenuItem value="urgent">Urgent</MenuItem>
                <MenuItem value="asap">ASAP</MenuItem>
                <MenuItem value="stat">STAT</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={8}>
            <TextField
              fullWidth
              label="Clinical Indication"
              value={orderDetails.indication}
              onChange={(e) => setOrderDetails({ ...orderDetails, indication: e.target.value })}
              placeholder="Reason for ordering"
              required
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Provider Notes"
              value={orderDetails.notes}
              onChange={(e) => setOrderDetails({ ...orderDetails, notes: e.target.value })}
              placeholder="Additional notes or instructions"
              multiline
              rows={2}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Provider PIN"
              type="password"
              value={orderDetails.providerPin}
              onChange={(e) => setOrderDetails({ ...orderDetails, providerPin: e.target.value })}
              placeholder="Enter PIN to sign orders"
              required
              InputProps={{
                startAdornment: <SecurityIcon sx={{ mr: 1, color: 'text.secondary' }} />
              }}
            />
          </Grid>
        </Grid>

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <Alert severity="error" sx={{ mt: 2 }}>
            <Typography variant="subtitle2">Please correct the following:</Typography>
            <ul>
              {validationErrors.map((error, idx) => (
                <li key={idx}>{error}</li>
              ))}
            </ul>
          </Alert>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button 
          variant="outlined"
          startIcon={<SaveIcon />}
          disabled={loading || orders.length === 0}
        >
          Save as Draft
        </Button>
        <Button
          variant="contained"
          startIcon={loading ? <CircularProgress size={20} /> : <SendIcon />}
          onClick={submitOrders}
          disabled={loading || orders.length === 0}
        >
          {loading ? 'Submitting...' : 'Sign & Submit Orders'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default React.memo(CPOEDialog);