/**
 * Order Context Provider
 * Manages clinical orders using FHIR ServiceRequest resources
 */
import React, { createContext, useContext, useState } from 'react';
import { fhirClient } from '../services/fhirClient';
import { useClinical } from './ClinicalContext';

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
  const [activeOrders, setActiveOrders] = useState([]);
  const [pendingOrders, setPendingOrders] = useState([]);
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
    const extension = fhirRequest.extension?.find(e => e.url === 'http://medgenemr.com/medication-details');
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
        url: 'http://medgenemr.com/medication-details',
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
      
      const orders = result.resources.map(transformFHIRServiceRequest);
      setActiveOrders(orders);
    } catch (error) {
      console.error('Error loading active orders:', error);
      throw error;
    }
  };

  // Load order sets (using hardcoded data for now)
  const loadOrderSets = async (specialty) => {
    try {
      // Mock order sets until we have a proper service
      const mockOrderSets = [
        {
          id: 'admission-basic',
          name: 'Basic Admission Orders',
          specialty: 'general',
          orders: [
            { type: 'laboratory', code: '24323-8', display: 'Comprehensive metabolic panel' },
            { type: 'laboratory', code: '58410-2', display: 'Complete blood count' },
            { type: 'imaging', code: '36643-5', display: 'Chest X-ray' }
          ]
        },
        {
          id: 'cardiac-workup',
          name: 'Cardiac Workup',
          specialty: 'cardiology',
          orders: [
            { type: 'laboratory', code: '2157-6', display: 'Troponin' },
            { type: 'laboratory', code: '33762-6', display: 'NT-proBNP' },
            { type: 'imaging', code: '34552-0', display: 'EKG 12-lead' }
          ]
        }
      ];
      
      const filtered = specialty 
        ? mockOrderSets.filter(set => set.specialty === specialty)
        : mockOrderSets;
      
      setOrderSets(filtered);
    } catch (error) {
      console.error('Error loading order sets:', error);
      throw error;
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

      await loadActiveOrders(currentPatient.id);
      return { order: { ...order, id: result.id } };
    } catch (error) {
      console.error('Error creating medication order:', error);
      throw error;
    } finally {
      setIsProcessingOrder(false);
    }
  };

  // Mock drug interaction checking
  const checkDrugInteractions = async (order) => {
    // In real implementation, this would call a drug interaction service
    const mockAlerts = [];
    
    // Check against active medications
    const activeMeds = activeOrders.filter(o => o.orderType === 'medication' && o.status === 'active');
    
    // Mock interaction check
    if (order.medicationDetails.medicationName?.toLowerCase().includes('warfarin') && 
        activeMeds.some(m => m.display?.toLowerCase().includes('aspirin'))) {
      mockAlerts.push({
        severity: 'high',
        type: 'drug-drug',
        message: 'Potential interaction between Warfarin and Aspirin - increased bleeding risk'
      });
    }
    
    return mockAlerts;
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

      await loadActiveOrders(currentPatient.id);
      return { order: { ...order, id: result.id } };
    } catch (error) {
      console.error('Error creating laboratory order:', error);
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

      await loadActiveOrders(currentPatient.id);
      return { order: { ...order, id: result.id } };
    } catch (error) {
      console.error('Error creating imaging order:', error);
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
        url: 'http://medgenemr.com/discontinuation-reason',
        valueString: reason
      });
      
      await fhirClient.update('ServiceRequest', orderId, fhirRequest);
      
      if (currentPatient) {
        await loadActiveOrders(currentPatient.id);
      }
    } catch (error) {
      console.error('Error discontinuing order:', error);
      throw error;
    }
  };

  // Apply order set
  const applyOrderSet = async (orderSetId) => {
    if (!currentPatient) {
      throw new Error('No patient selected');
    }

    setIsProcessingOrder(true);
    try {
      const orderSet = orderSets.find(set => set.id === orderSetId);
      if (!orderSet) {
        throw new Error('Order set not found');
      }

      // Create all orders in the set
      const promises = orderSet.orders.map(orderTemplate => {
        const order = {
          patientId: currentPatient.id,
          encounterId: currentEncounter?.id,
          orderType: orderTemplate.type,
          priority: 'routine',
          code: orderTemplate.code,
          display: orderTemplate.display
        };

        const fhirRequest = transformToFHIRServiceRequest(order);
        return fhirClient.create('ServiceRequest', fhirRequest);
      });

      await Promise.all(promises);
      await loadActiveOrders(currentPatient.id);
    } catch (error) {
      console.error('Error applying order set:', error);
      throw error;
    } finally {
      setIsProcessingOrder(false);
    }
  };

  // Clear alerts
  const clearCurrentAlerts = () => {
    setCurrentOrderAlerts([]);
  };

  // Search medications (mock - would integrate with drug database)
  const searchMedications = async (query) => {
    // Mock medication search with proper RxNorm codes
    const mockMedications = [
      { name: 'Aspirin 81mg', code: '243670', display: 'Aspirin 81 MG Oral Tablet' },
      { name: 'Metformin 500mg', code: '860974', display: 'Metformin hydrochloride 500 MG Oral Tablet' },
      { name: 'Lisinopril 10mg', code: '314076', display: 'Lisinopril 10 MG Oral Tablet' },
      { name: 'Amoxicillin 500mg', code: '308192', display: 'Amoxicillin 500 MG Oral Capsule' },
      { name: 'Omeprazole 20mg', code: '314077', display: 'Omeprazole 20 MG Oral Capsule' },
      { name: 'Warfarin 5mg', code: '855332', display: 'Warfarin Sodium 5 MG Oral Tablet' }
    ];
    
    return mockMedications.filter(med => 
      med.name.toLowerCase().includes(query.toLowerCase())
    );
  };

  // Search laboratory tests (mock - would integrate with lab catalog)
  const searchLaboratoryTests = async (query) => {
    // Mock lab test search with proper LOINC codes
    const mockTests = [
      { name: 'Complete Blood Count', code: '58410-2', display: 'Complete blood count (hemogram) panel' },
      { name: 'Basic Metabolic Panel', code: '24323-8', display: 'Comprehensive metabolic panel' },
      { name: 'Lipid Panel', code: '24331-1', display: 'Lipid panel with direct LDL' },
      { name: 'Hemoglobin A1c', code: '4548-4', display: 'Hemoglobin A1c/Hemoglobin.total in Blood' },
      { name: 'TSH', code: '3016-3', display: 'Thyrotropin [Units/volume] in Serum or Plasma' },
      { name: 'Urinalysis', code: '24356-8', display: 'Urinalysis complete panel' },
      { name: 'Liver Function Tests', code: '24325-3', display: 'Hepatic function panel' },
      { name: 'PT/INR', code: '5902-2', display: 'Prothrombin time (PT)' }
    ];
    
    return mockTests.filter(test => 
      test.name.toLowerCase().includes(query.toLowerCase())
    );
  };

  // Search imaging studies (mock - would integrate with radiology catalog)
  const searchImagingStudies = async (query) => {
    // Mock imaging search with proper codes
    const mockImaging = [
      { name: 'Chest X-ray', code: '36643-5', display: 'Chest X-ray 2 Views' },
      { name: 'CT Head', code: '24725-4', display: 'CT Head without contrast' },
      { name: 'MRI Brain', code: '24590-2', display: 'MRI Brain without contrast' },
      { name: 'Abdominal Ultrasound', code: '44120-2', display: 'Ultrasound of Abdomen' },
      { name: 'Echocardiogram', code: '34552-0', display: 'Echocardiography' },
      { name: 'CT Chest', code: '24627-2', display: 'CT Chest with contrast' }
    ];
    
    return mockImaging.filter(study => 
      study.name.toLowerCase().includes(query.toLowerCase())
    );
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