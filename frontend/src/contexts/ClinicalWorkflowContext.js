/**
 * Clinical Workflow Context
 * Manages cross-tab communication, workflow orchestration, and clinical context sharing
 */
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useFHIRResource } from './FHIRResourceContext';
import { useAuth } from './AuthContext';
import websocketService from '../services/websocket';

const ClinicalWorkflowContext = createContext();

// Clinical Event Types
export const CLINICAL_EVENTS = {
  ORDER_PLACED: 'order.placed',
  ORDER_COMPLETED: 'order.completed',
  RESULT_RECEIVED: 'result.received',
  RESULT_ACKNOWLEDGED: 'result.acknowledged',
  MEDICATION_DISPENSED: 'medication.dispensed',
  MEDICATION_ADMINISTERED: 'medication.administered',
  ENCOUNTER_CREATED: 'encounter.created',
  ENCOUNTER_UPDATED: 'encounter.updated',
  DOCUMENTATION_CREATED: 'documentation.created',
  DOCUMENTATION_SHARED: 'documentation.shared',
  QUALITY_DOCUMENTATION_INITIATED: 'quality.documentation.initiated',
  PROBLEM_ADDED: 'problem.added',
  PROBLEM_RESOLVED: 'problem.resolved',
  CRITICAL_ALERT: 'alert.critical',
  WORKFLOW_NOTIFICATION: 'workflow.notification',
  TAB_UPDATE: 'tab.update',
  IMAGING_STUDY_AVAILABLE: 'imaging.study.available',
  CARE_PLAN_UPDATED: 'careplan.updated'
};

// Workflow Types
export const WORKFLOW_TYPES = {
  ORDER_TO_RESULT: 'order-result',
  PRESCRIPTION_TO_DISPENSE: 'prescription-dispense',
  ENCOUNTER_TO_DOCUMENTATION: 'encounter-documentation',
  IMAGING_TO_REPORT: 'imaging-report',
  PROBLEM_TO_CAREPLAN: 'problem-careplan'
};

export const ClinicalWorkflowProvider = ({ children }) => {
  const { currentPatient, getPatientResources } = useFHIRResource();
  const { currentUser } = useAuth();
  
  // Clinical context state
  const [clinicalContext, setClinicalContext] = useState({
    activeProblems: [],
    currentMedications: [],
    pendingOrders: [],
    recentResults: [],
    activeEncounter: null,
    careGoals: [],
    alerts: [],
    activeQualityMeasures: []
  });
  
  // Event listeners and notifications
  const [eventListeners, setEventListeners] = useState(new Map());
  const [notifications, setNotifications] = useState([]);
  const [workflowStates, setWorkflowStates] = useState(new Map());
  
  // WebSocket connection state
  const [wsConnected, setWsConnected] = useState(false);
  const [wsReconnecting, setWsReconnecting] = useState(false);
  const wsUnsubscribers = useRef([]);

  // Subscribe to clinical events
  const subscribe = useCallback((eventType, callback) => {
    setEventListeners(prev => {
      const newMap = new Map(prev);
      const listeners = newMap.get(eventType) || [];
      listeners.push(callback);
      newMap.set(eventType, listeners);
      return newMap;
    });
    
    // Return unsubscribe function
    return () => {
      setEventListeners(prev => {
        const newMap = new Map(prev);
        const currentListeners = newMap.get(eventType) || [];
        const updatedListeners = currentListeners.filter(cb => cb !== callback);
        newMap.set(eventType, updatedListeners);
        return newMap;
      });
    };
  }, []); // Remove eventListeners dependency to prevent infinite loops

  // Publish clinical events
  const publish = useCallback(async (eventType, data) => {
    // Send event via WebSocket if connected
    if (wsConnected) {
      websocketService.send(eventType, {
        ...data,
        patientId: currentPatient?.id,
        userId: currentUser?.id,
        timestamp: new Date().toISOString()
      });
    }
    
    // Get current listeners from state ref to avoid dependency
    setEventListeners(currentEventListeners => {
      const listeners = currentEventListeners.get(eventType) || [];
      
      // Execute all listeners asynchronously
      (async () => {
        for (const listener of listeners) {
          try {
            await listener(data);
          } catch (error) {
            console.error(`Error in event listener for ${eventType}:`, error);
          }
        }
        
        // Handle special event types with automated workflows
        await handleAutomatedWorkflows(eventType, data);
      })();
      
      return currentEventListeners; // Return unchanged state
    });
  }, [wsConnected, currentPatient?.id, currentUser?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // Missing dep: handleAutomatedWorkflows. Not added as it's defined below and would cause circular dependency

  // Handle automated workflows
  const handleAutomatedWorkflows = async (eventType, data) => {
    switch (eventType) {
      case CLINICAL_EVENTS.ORDER_PLACED:
        await handleOrderPlaced(data);
        break;
      case CLINICAL_EVENTS.RESULT_RECEIVED:
        await handleResultReceived(data);
        break;
      case CLINICAL_EVENTS.MEDICATION_DISPENSED:
        await handleMedicationDispensed(data);
        break;
      case CLINICAL_EVENTS.ENCOUNTER_CREATED:
        await handleEncounterCreated(data);
        break;
      case CLINICAL_EVENTS.PROBLEM_ADDED:
        await handleProblemAdded(data);
        break;
      case CLINICAL_EVENTS.QUALITY_DOCUMENTATION_INITIATED:
        await handleQualityDocumentationInitiated(data);
        break;
      default:
        break;
    }
  };

  // Automated workflow handlers
  const handleOrderPlaced = async (orderData) => {
    // Create pending result placeholder for lab orders
    if (orderData.category === 'laboratory') {
      await createPendingResultPlaceholder(orderData);
    }
    
    // Add to pending orders
    updateClinicalContext(prev => ({
      ...prev,
      pendingOrders: [...prev.pendingOrders, orderData]
    }));
    
    // Notify relevant tabs
    publish(CLINICAL_EVENTS.TAB_UPDATE, {
      targetTabs: ['orders', 'results'],
      updateType: 'order_placed',
      data: orderData
    });
  };

  const handleResultReceived = async (resultData) => {
    // Check for abnormal values
    const abnormalResults = checkForAbnormalResults(resultData);
    
    if (abnormalResults.length > 0) {
      // Create critical alerts for abnormal results
      await createCriticalAlert({
        type: 'abnormal_result',
        severity: 'high',
        message: `Abnormal lab results detected: ${abnormalResults.map(r => r.name).join(', ')}`,
        data: resultData,
        actions: [
          { label: 'Review Results', action: 'navigate', target: 'results' },
          { label: 'Add to Note', action: 'document', target: 'documentation' }
        ]
      });
    }
    
    // Update recent results
    updateClinicalContext(prev => ({
      ...prev,
      recentResults: [resultData, ...prev.recentResults.slice(0, 9)],
      pendingOrders: prev.pendingOrders.filter(order => order.id !== resultData.basedOn?.[0]?.reference?.split('/')[1])
    }));
    
    // Suggest follow-up orders for abnormal results
    if (abnormalResults.length > 0) {
      await suggestFollowUpOrders(abnormalResults);
    }
  };

  const handleMedicationDispensed = async (dispenseData) => {
    // Update medication status
    updateClinicalContext(prev => ({
      ...prev,
      currentMedications: prev.currentMedications.map(med => 
        med.id === dispenseData.authorizingPrescription?.[0]?.reference?.split('/')[1]
          ? { ...med, status: 'active', dispensed: true }
          : med
      )
    }));
    
    // Schedule monitoring if required
    await scheduleMonitoringForMedication(dispenseData);
    
    // Notify pharmacy and chart review tabs
    publish(CLINICAL_EVENTS.TAB_UPDATE, {
      targetTabs: ['pharmacy', 'chart'],
      updateType: 'medication_dispensed',
      data: dispenseData
    });
  };

  const handleEncounterCreated = async (encounterData) => {
    // Set as active encounter
    updateClinicalContext(prev => ({
      ...prev,
      activeEncounter: encounterData
    }));
    
    // Create documentation template
    await createDocumentationTemplate(encounterData);
    
    // Apply problem-based order sets
    await applyOrderSets(encounterData);
    
    // Notify relevant tabs
    publish(CLINICAL_EVENTS.TAB_UPDATE, {
      targetTabs: ['encounters', 'documentation', 'orders'],
      updateType: 'encounter_created',
      data: encounterData
    });
  };

  const handleProblemAdded = async (problemData) => {
    // Add to active problems
    updateClinicalContext(prev => ({
      ...prev,
      activeProblems: [...prev.activeProblems, problemData]
    }));
    
    // Suggest care plan goals
    await suggestCareGoals(problemData);
    
    // Suggest relevant order sets
    await suggestOrderSets(problemData);
    
    // Notify chart review and care plan tabs
    publish(CLINICAL_EVENTS.TAB_UPDATE, {
      targetTabs: ['chart', 'careplan', 'orders'],
      updateType: 'problem_added',
      data: problemData
    });
  };

  const handleQualityDocumentationInitiated = async (qualityData) => {
    // Update clinical context with quality measure tracking
    updateClinicalContext(prev => ({
      ...prev,
      activeQualityMeasures: [
        ...(prev.activeQualityMeasures || []),
        {
          measureId: qualityData.measureId,
          measureName: qualityData.measureName,
          priority: qualityData.priority,
          patientId: qualityData.patientId,
          encounterId: qualityData.encounterId,
          initiatedAt: qualityData.timestamp,
          status: 'documentation_initiated'
        }
      ]
    }));

    // Create workflow notification for quality improvement
    await createWorkflowNotification('quality_documentation', 'initiated', {
      measureId: qualityData.measureId,
      measureName: qualityData.measureName,
      priority: qualityData.priority,
      patientId: qualityData.patientId,
      encounterId: qualityData.encounterId
    });

    // Notify relevant tabs about quality measure documentation
    publish(CLINICAL_EVENTS.TAB_UPDATE, {
      targetTabs: ['documentation', 'encounters', 'chart'],
      updateType: 'quality_documentation_initiated',
      data: qualityData
    });

    // If high priority, create a workflow reminder
    if (qualityData.priority === 'high') {
      await scheduleQualityFollowUp(qualityData);
    }
  };

  // Clinical decision support functions
  const checkForAbnormalResults = (resultData) => {
    const abnormal = [];
    const observations = Array.isArray(resultData) ? resultData : [resultData];
    
    for (const obs of observations) {
      if (obs.resourceType === 'Observation' && obs.valueQuantity) {
        const referenceRange = obs.referenceRange?.[0];
        if (referenceRange) {
          const value = obs.valueQuantity.value;
          const low = referenceRange.low?.value;
          const high = referenceRange.high?.value;
          
          if ((low && value < low) || (high && value > high)) {
            abnormal.push({
              id: obs.id,
              name: obs.code?.text || obs.code?.coding?.[0]?.display,
              value: obs.valueQuantity,
              referenceRange: referenceRange
            });
          }
        }
      }
    }
    
    return abnormal;
  };

  const createCriticalAlert = async (alertData) => {
    const alert = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      patientId: currentPatient?.id,
      ...alertData
    };
    
    setNotifications(prev => [alert, ...prev]);
    
    // Publish critical alert event
    publish(CLINICAL_EVENTS.CRITICAL_ALERT, alert);
  };

  const createWorkflowNotification = async (workflowType, step, data) => {
    const notification = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      patientId: currentPatient?.id,
      type: 'workflow',
      workflowType,
      step,
      data,
      message: generateWorkflowMessage(workflowType, step, data)
    };
    
    setNotifications(prev => [notification, ...prev.slice(0, 19)]);
    
    publish(CLINICAL_EVENTS.WORKFLOW_NOTIFICATION, notification);
  };

  const generateWorkflowMessage = (workflowType, step, data) => {
    switch (workflowType) {
      case WORKFLOW_TYPES.ORDER_TO_RESULT:
        return step === 'completed' ? 
          `Lab results available for ${data.name}` :
          `Lab order placed: ${data.name}`;
      case WORKFLOW_TYPES.PRESCRIPTION_TO_DISPENSE:
        return step === 'completed' ?
          `Medication dispensed: ${data.medicationName}` :
          `Prescription sent to pharmacy: ${data.medicationName}`;
      case 'quality_documentation':
        return step === 'initiated' ?
          `Quality measure documentation started: ${data.measureName}` :
          `Quality measure documentation updated: ${data.measureName}`;
      default:
        return `Workflow update: ${workflowType} - ${step}`;
    }
  };

  // Cross-tab navigation with context
  const navigateWithContext = useCallback((targetTab, contextData) => {
    publish(CLINICAL_EVENTS.TAB_UPDATE, {
      targetTabs: [targetTab],
      updateType: 'navigate_with_context',
      data: contextData
    });
  }, [publish]);

  // Get current clinical context
  const getCurrentClinicalContext = useCallback(() => {
    return {
      ...clinicalContext,
      patientId: currentPatient?.id,
      userId: currentUser?.id,
      timestamp: new Date().toISOString()
    };
  }, [clinicalContext, currentPatient, currentUser]);

  // Update clinical context
  const updateClinicalContext = useCallback((updater) => {
    if (typeof updater === 'function') {
      setClinicalContext(updater);
    } else {
      setClinicalContext(prev => ({ ...prev, ...updater }));
    }
  }, []);

  // Initialize WebSocket connection
  useEffect(() => {
    if (currentUser) {
      // Connect WebSocket with auth token
      const token = localStorage.getItem('auth_token');
      if (token) {
        websocketService.connect(token);
        
        // Monitor connection state
        const unsubscribeConnection = websocketService.onConnectionChange((state) => {
          setWsConnected(state === 'connected');
          setWsReconnecting(state === 'reconnecting');
        });
        
        // Subscribe to all clinical events via WebSocket
        const eventTypes = Object.values(CLINICAL_EVENTS);
        const unsubscribers = [];
        
        eventTypes.forEach(eventType => {
          const unsubscribe = websocketService.subscribe(eventType, (data) => {
            // Forward WebSocket events to local event listeners
            const listeners = eventListeners.get(eventType) || [];
            listeners.forEach(listener => {
              try {
                listener(data);
              } catch (error) {
                console.error(`Error in event listener for ${eventType}:`, error);
              }
            });
            
            // Handle automated workflows
            handleAutomatedWorkflows(eventType, data);
          });
          unsubscribers.push(unsubscribe);
        });
        
        wsUnsubscribers.current = [...unsubscribers, unsubscribeConnection];
      }
    }
    
    return () => {
      // Cleanup WebSocket subscriptions
      wsUnsubscribers.current.forEach(unsubscribe => unsubscribe());
      wsUnsubscribers.current = [];
      websocketService.disconnect();
    };
  }, [currentUser]); // eslint-disable-line react-hooks/exhaustive-deps
  
  // Load clinical context when patient changes
  useEffect(() => {
    if (currentPatient?.id) {
      loadClinicalContext();
    }
  }, [currentPatient?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // Missing dep: loadClinicalContext. Adding it would cause infinite loops since it's defined below

  const loadClinicalContext = async () => {
    try {
      const patientId = currentPatient.id;
      
      // Load active problems (Conditions)
      const conditions = getPatientResources(patientId, 'Condition') || [];
      const activeProblems = conditions.filter(c => 
        c.clinicalStatus?.coding?.[0]?.code === 'active'
      );
      
      // Load current medications (MedicationRequests)
      const medRequests = getPatientResources(patientId, 'MedicationRequest') || [];
      const currentMedications = medRequests.filter(mr => 
        mr.status === 'active'
      );
      
      // Load pending orders
      const serviceRequests = getPatientResources(patientId, 'ServiceRequest') || [];
      const pendingOrders = serviceRequests.filter(sr => 
        ['active', 'draft'].includes(sr.status)
      );
      
      // Load recent results
      const observations = getPatientResources(patientId, 'Observation') || [];
      const recentResults = observations
        .sort((a, b) => new Date(b.effectiveDateTime || 0) - new Date(a.effectiveDateTime || 0))
        .slice(0, 10);
      
      // Load encounters
      const encounters = getPatientResources(patientId, 'Encounter') || [];
      const activeEncounter = encounters.find(e => e.status === 'in-progress');
      
      updateClinicalContext({
        activeProblems,
        currentMedications,
        pendingOrders,
        recentResults,
        activeEncounter,
        careGoals: [], // TODO: Load from CarePlan resources
        alerts: []
      });
      
    } catch (error) {
      
    }
  };

  // Helper functions for automated workflows
  const createPendingResultPlaceholder = async (orderData) => {
    // This would create a placeholder result that gets updated when actual results arrive
  };

  const scheduleMonitoringForMedication = async (dispenseData) => {
    // This would schedule monitoring labs based on medication type
  };

  const createDocumentationTemplate = async (encounterData) => {
    // This would create a SOAP note template for the encounter
  };

  const applyOrderSets = async (encounterData) => {
    // This would suggest order sets based on encounter type and patient problems
  };

  const suggestCareGoals = async (problemData) => {
    // This would suggest care plan goals based on the problem
  };

  const suggestOrderSets = async (problemData) => {
    // This would suggest relevant order sets for the problem
  };

  const scheduleQualityFollowUp = async (qualityData) => {
    // Schedule follow-up reminder for high-priority quality measures
    const followUpNotification = {
      id: `quality-followup-${qualityData.measureId}-${Date.now()}`,
      timestamp: new Date().toISOString(),
      patientId: qualityData.patientId,
      type: 'quality_followup',
      priority: 'high',
      measureId: qualityData.measureId,
      measureName: qualityData.measureName,
      message: `High-priority quality measure documentation requires follow-up: ${qualityData.measureName}`,
      scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
      actions: [
        { label: 'Complete Documentation', action: 'navigate', target: 'documentation' },
        { label: 'Review Quality Status', action: 'navigate', target: 'quality' }
      ]
    };

    // Add to notifications for follow-up tracking
    setNotifications(prev => [followUpNotification, ...prev]);
    
    // Publish follow-up event
    publish(CLINICAL_EVENTS.WORKFLOW_NOTIFICATION, followUpNotification);
  };

  const suggestFollowUpOrders = async (abnormalResults) => {
    // This would suggest follow-up orders for abnormal results
  };

  // Clear notifications
  const clearNotification = useCallback((notificationId) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  }, []);

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const value = {
    // Clinical context
    clinicalContext,
    getCurrentClinicalContext,
    updateClinicalContext,
    
    // Event system
    subscribe,
    publish,
    CLINICAL_EVENTS,
    WORKFLOW_TYPES,
    
    // Notifications
    notifications,
    clearNotification,
    clearAllNotifications,
    createCriticalAlert,
    createWorkflowNotification,
    
    // Navigation
    navigateWithContext,
    
    // Workflow states
    workflowStates,
    setWorkflowStates,
    
    // WebSocket status
    wsConnected,
    wsReconnecting
  };

  return (
    <ClinicalWorkflowContext.Provider value={value}>
      {children}
    </ClinicalWorkflowContext.Provider>
  );
};

export const useClinicalWorkflow = () => {
  const context = useContext(ClinicalWorkflowContext);
  if (!context) {
    throw new Error('useClinicalWorkflow must be used within a ClinicalWorkflowProvider');
  }
  return context;
};

export default ClinicalWorkflowContext;