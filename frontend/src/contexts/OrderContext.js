/**
 * Order Context Provider
 * Manages clinical orders state and CPOE functionality
 */
import React, { createContext, useContext, useState } from 'react';
import api from '../services/api';
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

  // Load active orders for patient
  const loadActiveOrders = async (patientId) => {
    try {
      const response = await api.get('/api/clinical/orders/active', {
        params: { patient_id: patientId }
      });
      setActiveOrders(response.data);
    } catch (error) {
      console.error('Error loading active orders:', error);
      throw error;
    }
  };

  // Load order sets
  const loadOrderSets = async (specialty) => {
    try {
      const response = await api.get('/api/clinical/orders/order-sets/', {
        params: specialty ? { specialty } : {}
      });
      setOrderSets(response.data);
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
      const response = await api.post('/api/clinical/orders/medications', {
        patient_id: currentPatient.id,
        encounter_id: currentEncounter?.id,
        order_type: 'medication',
        priority: orderDetails.priority || 'routine',
        medication_details: orderDetails,
        override_alerts: overrideAlerts
      });

      const { order, alerts, order_saved } = response.data;

      if (alerts && alerts.length > 0) {
        setCurrentOrderAlerts(alerts);
      }

      if (order_saved && order) {
        await loadActiveOrders(currentPatient.id);
        return { order };
      }

      return { alerts };
    } catch (error) {
      console.error('Error creating medication order:', error);
      throw error;
    } finally {
      setIsProcessingOrder(false);
    }
  };

  // Create laboratory order
  const createLaboratoryOrder = async (orderDetails) => {
    if (!currentPatient) {
      throw new Error('No patient selected');
    }

    setIsProcessingOrder(true);
    try {
      const response = await api.post('/api/clinical/orders/laboratory', {
        patient_id: currentPatient.id,
        encounter_id: currentEncounter?.id,
        order_type: 'laboratory',
        priority: orderDetails.priority || 'routine',
        laboratory_details: orderDetails
      });

      await loadActiveOrders(currentPatient.id);
      return response.data;
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
      const response = await api.post('/api/clinical/orders/imaging', {
        patient_id: currentPatient.id,
        encounter_id: currentEncounter?.id,
        order_type: 'imaging',
        priority: orderDetails.priority || 'routine',
        imaging_details: orderDetails
      });

      await loadActiveOrders(currentPatient.id);
      return response.data;
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
      await api.put(`/api/clinical/orders/${orderId}/discontinue`, { reason });
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
      await api.post(`/api/clinical/orders/order-sets/${orderSetId}/apply`, {
        patient_id: currentPatient.id,
        encounter_id: currentEncounter?.id
      });

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
    // Mock medication search
    const mockMedications = [
      { name: 'Aspirin 81mg', code: 'RxNorm:123' },
      { name: 'Metformin 500mg', code: 'RxNorm:456' },
      { name: 'Lisinopril 10mg', code: 'RxNorm:789' }
    ];
    
    return mockMedications.filter(med => 
      med.name.toLowerCase().includes(query.toLowerCase())
    );
  };

  // Search laboratory tests (mock - would integrate with lab catalog)
  const searchLaboratoryTests = async (query) => {
    // Mock lab test search
    const mockTests = [
      { name: 'Complete Blood Count', code: 'LOINC:123' },
      { name: 'Basic Metabolic Panel', code: 'LOINC:456' },
      { name: 'Lipid Panel', code: 'LOINC:789' }
    ];
    
    return mockTests.filter(test => 
      test.name.toLowerCase().includes(query.toLowerCase())
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
    searchLaboratoryTests
  };

  return (
    <OrderContext.Provider value={value}>
      {children}
    </OrderContext.Provider>
  );
};