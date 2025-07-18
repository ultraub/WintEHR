/**
 * Order Context Provider
 * Manages clinical orders using FHIR ServiceRequest resources
 */
import React, { createContext, useContext, useState } from 'react';
import { fhirClient } from '../services/fhirClient';
import { useClinical } from './ClinicalContext';
import { useFHIRResource } from './FHIRResourceContext';
import api from '../services/api';

const OrderContext = createContext(undefined);

export const useOrders = () => {
  const context = useContext(OrderContext);
  if (!context) {
    throw new Error('useOrders must be used within an OrderProvider');
  }
  return context;
};

export const OrderProvider = ({ children }) => {
  const { currentPatient, currentEncounter } = useClinical();
  const { refreshPatientResources } = useFHIRResource();
  const [activeOrders, setActiveOrders] = useState([]);
  const [pendingOrders] = useState([]);
  const [orderSets, setOrderSets] = useState([]);
  const [currentOrderAlerts, setCurrentOrderAlerts] = useState([]);
  const [isProcessingOrder, setIsProcessingOrder] = useState(false);

  // Transform FHIR ServiceRequest to internal format
  const transformFHIRServiceRequest = (fhirRequest) => {
    const orderType = determineOrderType(fhirRequest);
    
    return {
      id: fhirRequest.id,
      patientId: fhirRequest.subject?.reference?.split('/')[1],
      encounterId: fhirRequest.encounter?.reference?.split('/')[1],
      orderType,
      status: fhirRequest.status,
      priority: fhirRequest.priority || 'routine',
      code: fhirRequest.code?.coding?.[0]?.code,
      display: fhirRequest.code?.coding?.[0]?.display || fhirRequest.code?.text,
      authoredOn: fhirRequest.authoredOn,
      requester: fhirRequest.requester?.reference?.split('/')[1],
      performerType: fhirRequest.performerType?.coding?.[0]?.display,
      category: fhirRequest.category?.[0]?.coding?.[0]?.code,
      instructions: fhirRequest.patientInstruction,
      // Extract medication details if present
      medicationDetails: extractMedicationDetails(fhirRequest),
      // Extract specimen for lab orders
      specimen: fhirRequest.specimen?.[0]?.display,
      // Extract body site for imaging
      bodySite: fhirRequest.bodySite?.[0]?.coding?.[0]?.display,
      // Reason for order
      reason: fhirRequest.reasonCode?.[0]?.text
    };
  };

  // Determine order type from ServiceRequest
  const determineOrderType = (fhirRequest) => {
    const category = fhirRequest.category?.[0]?.coding?.[0]?.code;
    if (category === '387713003') return 'medication';
    if (category === '108252007') return 'laboratory';
    if (category === '363679005') return 'imaging';
    return 'other';
  };

  // Extract medication details from extensions or contained resources
  const extractMedicationDetails = (fhirRequest) => {
    const extension = fhirRequest.extension?.find(e => e.url === 'http://wintehr.com/medication-details');
    if (!extension) return null;
    
    return {
      medicationName: extension.valueString,
      dosage: extension.extension?.find(e => e.url === 'dosage')?.valueString,
      route: extension.extension?.find(e => e.url === 'route')?.valueString,
      frequency: extension.extension?.find(e => e.url === 'frequency')?.valueString,
      duration: extension.extension?.find(e => e.url === 'duration')?.valueString
    };
  };

  // Transform internal order to FHIR ServiceRequest
  const transformToFHIRServiceRequest = (order) => {
    const fhirRequest = {
      resourceType: 'ServiceRequest',
      status: order.status || 'active',
      intent: order.intent || 'order',
      priority: order.priority || 'routine',
      subject: {
        reference: `Patient/${order.patientId}`
      },
      authoredOn: order.authoredOn || new Date().toISOString(),
      code: {
        coding: [{
          system: getCodeSystem(order.orderType),
          code: order.code || 'unknown',
          display: order.display
        }],
        text: order.display
      },
      category: [{
        coding: [{
          system: 'http://snomed.info/sct',
          code: getCategoryCode(order.orderType),
          display: getCategoryDisplay(order.orderType)
        }]
      }]
    };

    // Add optional fields
    if (order.encounterId) {
      fhirRequest.encounter = { reference: `Encounter/${order.encounterId}` };
    }

    if (order.requester) {
      fhirRequest.requester = { reference: `Practitioner/${order.requester}` };
    }

    if (order.instructions) {
      fhirRequest.patientInstruction = order.instructions;
    }

    if (order.reason) {
      fhirRequest.reasonCode = [{ text: order.reason }];
    }

    // Add order-type specific details
    if (order.orderType === 'medication' && order.medicationDetails) {
      fhirRequest.extension = [{
        url: 'http://wintehr.com/medication-details',
        valueString: order.medicationDetails.medicationName,
        extension: [
          { url: 'dosage', valueString: order.medicationDetails.dosage },
          { url: 'route', valueString: order.medicationDetails.route },
          { url: 'frequency', valueString: order.medicationDetails.frequency },
          { url: 'duration', valueString: order.medicationDetails.duration }
        ].filter(e => e.valueString)
      }];
    }

    if (order.orderType === 'laboratory' && order.specimen) {
      fhirRequest.specimen = [{ display: order.specimen }];
    }

    if (order.orderType === 'imaging' && order.bodySite) {
      fhirRequest.bodySite = [{
        coding: [{ display: order.bodySite }]
      }];
    }

    if (order.id) {
      fhirRequest.id = order.id;
    }

    return fhirRequest;
  };

  // Helper functions for code systems and categories
  const getCodeSystem = (orderType) => {
    const systems = {
      medication: 'http://www.nlm.nih.gov/research/umls/rxnorm',
      laboratory: 'http://loinc.org',
      imaging: 'http://loinc.org'
    };
    return systems[orderType] || 'http://snomed.info/sct';
  };

  const getCategoryCode = (orderType) => {
    const codes = {
      medication: '387713003',
      laboratory: '108252007',
      imaging: '363679005'
    };
    return codes[orderType] || '410321003';
  };

  const getCategoryDisplay = (orderType) => {
    const displays = {
      medication: 'Medication request',
      laboratory: 'Laboratory procedure',
      imaging: 'Imaging procedure'
    };
    return displays[orderType] || 'Clinical procedure';
  };

  // Load active orders for patient
  const loadActiveOrders = async (patientId) => {
    try {
      const result = await fhirClient.search('ServiceRequest', {
        patient: patientId,
        status: 'active,on-hold',
        _sort: '-authored'
      });
      
      const orders = (result.resources || []).map(transformFHIRServiceRequest);
      setActiveOrders(orders);
    } catch (error) {
      
      throw error;
    }
  };

  // Transform FHIR Questionnaire to order set
  const transformQuestionnaireToOrderSet = (questionnaire) => {
    const code = questionnaire.code?.[0]?.code || questionnaire.id;
    
    return {
      id: questionnaire.id,
      name: questionnaire.title || questionnaire.name,
      description: questionnaire.description,
      specialty: getSpecialtyFromCode(code),
      orders: questionnaire.item?.map(item => ({
        type: item.extension?.find(e => e.url === 'http://wintehr.com/order-type')?.valueCode || 'other',
        code: item.code?.[0]?.code,
        display: item.text || item.code?.[0]?.display,
        priority: item.extension?.find(e => e.url === 'http://wintehr.com/order-priority')?.valueCode || 'routine',
        frequency: item.extension?.find(e => e.url === 'http://wintehr.com/order-frequency')?.valueString,
        selected: item.initial?.[0]?.valueBoolean || false,
        linkId: item.linkId
      })) || []
    };
  };

  // Map order set codes to specialties
  const getSpecialtyFromCode = (code) => {
    const specialtyMap = {
      'admission-basic': 'general',
      'cardiac-workup': 'cardiology',
      'diabetes-monitoring': 'endocrinology',
      'sepsis-bundle': 'critical-care'
    };
    return specialtyMap[code] || 'general';
  };

  // Load order sets from FHIR Questionnaires
  const loadOrderSets = async (specialty) => {
    try {
      // Search for questionnaires with order-set-type code
      const searchParams = {
        code: 'http://wintehr.com/order-set-type|',
        _count: 50
      };
      
      const result = await fhirClient.search('Questionnaire', searchParams);
      
      if (result.resources) {
        const orderSets = result.resources.map(transformQuestionnaireToOrderSet);
        
        const filtered = specialty 
          ? orderSets.filter(set => set.specialty === specialty)
          : orderSets;
        
        setOrderSets(filtered);
      }
    } catch (error) {
      
      // Fallback to empty array instead of throwing
      setOrderSets([]);
    }
  };

  // Create medication order
  const createMedicationOrder = async (orderDetails, overrideAlerts = false) => {
    if (!currentPatient) {
      throw new Error('No patient selected');
    }

    setIsProcessingOrder(true);
    try {
      // Create the order object
      const order = {
        patientId: currentPatient.id,
        encounterId: currentEncounter?.id,
        orderType: 'medication',
        priority: orderDetails.priority || 'routine',
        code: orderDetails.code,
        display: orderDetails.name || orderDetails.display,
        medicationDetails: {
          medicationName: orderDetails.name,
          dosage: orderDetails.dosage,
          route: orderDetails.route,
          frequency: orderDetails.frequency,
          duration: orderDetails.duration
        },
        instructions: orderDetails.instructions,
        reason: orderDetails.reason
      };

      // Check for drug interactions (mock)
      const alerts = await checkDrugInteractions(order);
      
      if (alerts.length > 0 && !overrideAlerts) {
        setCurrentOrderAlerts(alerts);
        return { alerts };
      }

      // Create FHIR ServiceRequest
      const fhirRequest = transformToFHIRServiceRequest(order);
      const result = await fhirClient.create('ServiceRequest', fhirRequest);

      // Refresh patient resources to update all contexts
      if (currentPatient?.id) {
        await refreshPatientResources(currentPatient.id);
      }
      
      await loadActiveOrders(currentPatient.id);
      return { order: { ...order, id: result.id } };
    } catch (error) {
      
      throw error;
    } finally {
      setIsProcessingOrder(false);
    }
  };

  // Check drug interactions using the API
  const checkDrugInteractions = async (order) => {
    try {
      // Get active medications
      const activeMeds = activeOrders
        .filter(o => o.orderType === 'medication' && o.status === 'active')
        .map(med => ({
          name: med.display || med.medicationDetails?.medicationName,
          code: med.code
        }));
      
      // Add the new medication
      const allMeds = [...activeMeds, {
        name: order.medicationDetails?.medicationName || order.display,
        code: order.code
      }];
      
      // Call drug interaction API
      const response = await api.post('/api/emr/clinical/drug-interactions/check-interactions', allMeds);
      
      // Transform interactions to alerts
      const alerts = response.data.interactions.map(interaction => ({
        severity: interaction.severity,
        type: 'drug-drug',
        message: interaction.description,
        drugs: interaction.drugs,
        clinicalConsequence: interaction.clinical_consequence,
        management: interaction.management
      }));
      
      return alerts;
    } catch (error) {
      
      // Return empty array on error to allow order to proceed
      return [];
    }
  };

  // Create laboratory order
  const createLaboratoryOrder = async (orderDetails) => {
    if (!currentPatient) {
      throw new Error('No patient selected');
    }

    setIsProcessingOrder(true);
    try {
      const order = {
        patientId: currentPatient.id,
        encounterId: currentEncounter?.id,
        orderType: 'laboratory',
        priority: orderDetails.priority || 'routine',
        code: orderDetails.code,
        display: orderDetails.name || orderDetails.display,
        specimen: orderDetails.specimen,
        instructions: orderDetails.instructions,
        reason: orderDetails.reason
      };

      const fhirRequest = transformToFHIRServiceRequest(order);
      const result = await fhirClient.create('ServiceRequest', fhirRequest);

      // Refresh patient resources to update all contexts
      if (currentPatient?.id) {
        await refreshPatientResources(currentPatient.id);
      }

      await loadActiveOrders(currentPatient.id);
      return { order: { ...order, id: result.id } };
    } catch (error) {
      
      throw error;
    } finally {
      setIsProcessingOrder(false);
    }
  };

  // Create imaging order
  const createImagingOrder = async (orderDetails) => {
    if (!currentPatient) {
      throw new Error('No patient selected');
    }

    setIsProcessingOrder(true);
    try {
      const order = {
        patientId: currentPatient.id,
        encounterId: currentEncounter?.id,
        orderType: 'imaging',
        priority: orderDetails.priority || 'routine',
        code: orderDetails.code,
        display: orderDetails.name || orderDetails.display,
        bodySite: orderDetails.bodySite,
        instructions: orderDetails.instructions,
        reason: orderDetails.reason
      };

      const fhirRequest = transformToFHIRServiceRequest(order);
      const result = await fhirClient.create('ServiceRequest', fhirRequest);

      // Refresh patient resources to update all contexts
      if (currentPatient?.id) {
        await refreshPatientResources(currentPatient.id);
      }

      await loadActiveOrders(currentPatient.id);
      return { order: { ...order, id: result.id } };
    } catch (error) {
      
      throw error;
    } finally {
      setIsProcessingOrder(false);
    }
  };

  // Discontinue order
  const discontinueOrder = async (orderId, reason) => {
    try {
      // Get the current order
      const fhirRequest = await fhirClient.read('ServiceRequest', orderId);
      
      // Update status to revoked
      fhirRequest.status = 'revoked';
      
      // Add extension for discontinuation reason
      if (!fhirRequest.extension) fhirRequest.extension = [];
      fhirRequest.extension.push({
        url: 'http://wintehr.com/discontinuation-reason',
        valueString: reason
      });
      
      await fhirClient.update('ServiceRequest', orderId, fhirRequest);
      
      // Refresh patient resources to update all contexts
      if (currentPatient?.id) {
        await refreshPatientResources(currentPatient.id);
      }
      
      if (currentPatient) {
        await loadActiveOrders(currentPatient.id);
      }
    } catch (error) {
      
      throw error;
    }
  };

  // Apply order set with selected items
  const applyOrderSet = async (orderSetId, selectedOrders = null) => {
    if (!currentPatient) {
      throw new Error('No patient selected');
    }

    setIsProcessingOrder(true);
    try {
      const orderSet = orderSets.find(set => set.id === orderSetId);
      if (!orderSet) {
        throw new Error('Order set not found');
      }

      // Filter orders based on selection (if provided)
      const ordersToCreate = selectedOrders 
        ? orderSet.orders.filter(order => selectedOrders.includes(order.linkId))
        : orderSet.orders.filter(order => order.selected);

      if (ordersToCreate.length === 0) {
        throw new Error('No orders selected');
      }

      // Create all selected orders
      const promises = ordersToCreate.map(orderTemplate => {
        const order = {
          patientId: currentPatient.id,
          encounterId: currentEncounter?.id,
          orderType: orderTemplate.type,
          priority: orderTemplate.priority || 'routine',
          code: orderTemplate.code,
          display: orderTemplate.display,
          instructions: orderTemplate.frequency
        };

        const fhirRequest = transformToFHIRServiceRequest(order);
        
        // Add order set reference
        if (!fhirRequest.extension) fhirRequest.extension = [];
        fhirRequest.extension.push({
          url: 'http://wintehr.com/order-set-reference',
          valueReference: {
            reference: `Questionnaire/${orderSetId}`,
            display: orderSet.name
          }
        });

        return fhirClient.create('ServiceRequest', fhirRequest);
      });

      const results = await Promise.all(promises);
      
      // Refresh patient resources to update all contexts
      if (currentPatient?.id) {
        await refreshPatientResources(currentPatient.id);
      }
      
      await loadActiveOrders(currentPatient.id);
      
      return {
        created: results.length,
        orderSetName: orderSet.name
      };
    } catch (error) {
      
      throw error;
    } finally {
      setIsProcessingOrder(false);
    }
  };

  // Clear alerts
  const clearCurrentAlerts = () => {
    setCurrentOrderAlerts([]);
  };

  // Search medications using FHIR resources
  const searchMedications = async (query) => {
    try {
      const response = await api.get('/api/catalogs/medications', {
        params: { search: query, limit: 20 }
      });
      
      return response.data.map(med => ({
        name: med.name,
        code: med.code,
        display: med.name,
        system: med.system || 'http://www.nlm.nih.gov/research/umls/rxnorm',
        form: med.form
      }));
    } catch (error) {
      
      // Fallback to common medications
      return [
        { name: 'Aspirin 81mg', code: '243670', display: 'Aspirin 81 MG Oral Tablet' },
        { name: 'Metformin 500mg', code: '860974', display: 'Metformin hydrochloride 500 MG Oral Tablet' },
        { name: 'Lisinopril 10mg', code: '314076', display: 'Lisinopril 10 MG Oral Tablet' }
      ].filter(med => med.name.toLowerCase().includes(query.toLowerCase()));
    }
  };

  // Search laboratory tests using FHIR resources
  const searchLaboratoryTests = async (query) => {
    try {
      const response = await api.get('/api/catalogs/lab-tests', {
        params: { search: query, limit: 20 }
      });
      
      return response.data.map(test => ({
        name: test.display || test.name,
        code: test.code,
        display: test.display || test.name,
        system: test.system || 'http://loinc.org'
      }));
    } catch (error) {
      
      // Fallback to common tests
      return [
        { name: 'Complete Blood Count', code: '58410-2', display: 'Complete blood count (hemogram) panel' },
        { name: 'Basic Metabolic Panel', code: '24323-8', display: 'Comprehensive metabolic panel' },
        { name: 'Hemoglobin A1c', code: '4548-4', display: 'Hemoglobin A1c/Hemoglobin.total in Blood' }
      ].filter(test => test.name.toLowerCase().includes(query.toLowerCase()));
    }
  };

  // Search imaging studies using FHIR resources
  const searchImagingStudies = async (query) => {
    try {
      const response = await api.get('/api/catalogs/imaging-studies', {
        params: { search: query, limit: 20 }
      });
      
      return response.data.map(proc => ({
        name: proc.display || proc.name,
        code: proc.code,
        display: proc.display || proc.name,
        system: proc.system || 'http://loinc.org/vs/radlex'
      }));
    } catch (error) {
      
      // Fallback to common procedures
      return [
        { name: 'Chest X-ray', code: '36643-5', display: 'Chest X-ray 2 Views' },
        { name: 'CT Head', code: '24725-4', display: 'CT Head without contrast' },
        { name: 'MRI Brain', code: '24590-2', display: 'MRI Brain without contrast' }
      ].filter(study => study.name.toLowerCase().includes(query.toLowerCase()));
    }
  };

  const value = {
    activeOrders,
    pendingOrders,
    orderSets,
    currentOrderAlerts,
    isProcessingOrder,
    loadActiveOrders,
    loadOrderSets,
    createMedicationOrder,
    createLaboratoryOrder,
    createImagingOrder,
    discontinueOrder,
    applyOrderSet,
    clearCurrentAlerts,
    searchMedications,
    searchLaboratoryTests,
    searchImagingStudies
  };

  return (
    <OrderContext.Provider value={value}>
      {children}
    </OrderContext.Provider>
  );
};