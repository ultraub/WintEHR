/**
 * useMedicationDispense Hook
 * Provides comprehensive MedicationDispense resource management
 * Part of Phase 1 Implementation: MedicationDispense Integration
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { fhirClient } from '../core/fhir/services/fhirClient';
import { useClinicalWorkflow, CLINICAL_EVENTS } from '../contexts/ClinicalWorkflowContext';
import { useAuth } from '../contexts/AuthContext';

export const useMedicationDispense = (patientId, options = {}) => {
  const [dispenses, setDispenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { publish } = useClinicalWorkflow();
  const { user } = useAuth();
  
  const searchParams = useMemo(() => ({
    subject: patientId,
    _sort: '-whenhandover',
    _count: options.limit || 50,
    ...options.searchParams
  }), [patientId, options.limit, options.searchParams]);
  
  const fetchDispenses = useCallback(async () => {
    if (!patientId) {
      setDispenses([]);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fhirClient.search('MedicationDispense', searchParams);
      const dispenseList = response.entry?.map(entry => entry.resource) || [];
      setDispenses(dispenseList);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [patientId, searchParams]);
  
  useEffect(() => {
    fetchDispenses();
  }, [fetchDispenses]);
  
  const createDispense = useCallback(async (dispenseData) => {
    try {
      setLoading(true);
      
      // Validate required fields
      if (!dispenseData.medicationCodeableConcept && !dispenseData.medicationReference) {
        throw new Error('Medication reference or codeable concept is required');
      }
      if (!dispenseData.subject) {
        throw new Error('Patient subject is required');
      }
      if (!dispenseData.status) {
        throw new Error('Dispense status is required');
      }
      
      // Create the MedicationDispense resource
      const medicationDispense = {
        resourceType: 'MedicationDispense',
        status: dispenseData.status || 'completed',
        medicationCodeableConcept: dispenseData.medicationCodeableConcept,
        medicationReference: dispenseData.medicationReference,
        subject: dispenseData.subject,
        authorizingPrescription: dispenseData.authorizingPrescription || [],
        quantity: dispenseData.quantity,
        daysSupply: dispenseData.daysSupply,
        whenPrepared: dispenseData.whenPrepared || new Date().toISOString(),
        whenHandedOver: dispenseData.whenHandedOver || new Date().toISOString(),
        performer: dispenseData.performer || [{
          actor: {
            reference: user?.practitioner_id ? `Practitioner/${user.practitioner_id}` : 
                      user?.id ? `Practitioner/${user.id}` : 
                      `Practitioner/${Date.now()}`,
            display: user?.display_name || user?.name || 'Pharmacist'
          }
        }],
        location: dispenseData.location,
        note: dispenseData.note || [],
        substitution: dispenseData.substitution,
        dosageInstruction: dispenseData.dosageInstruction || []
      };
      
      const createdDispense = await fhirClient.create('MedicationDispense', medicationDispense);
      
      // Update local state
      setDispenses(prev => [createdDispense, ...prev]);
      
      // Publish workflow event
      await publish(CLINICAL_EVENTS.MEDICATION_DISPENSED, {
        medicationDispense: createdDispense,
        prescriptionId: dispenseData.authorizingPrescription?.[0]?.reference?.split('/')[1],
        patientId: patientId,
        timestamp: createdDispense.whenHandedOver
      });
      
      return createdDispense;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [patientId, publish]);
  
  const updateDispense = useCallback(async (dispenseId, updates) => {
    try {
      setLoading(true);
      
      const updatedDispense = await fhirClient.update('MedicationDispense', dispenseId, updates);
      
      // Update local state
      setDispenses(prev => prev.map(dispense => 
        dispense.id === dispenseId ? updatedDispense : dispense
      ));
      
      return updatedDispense;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);
  
  const getDispensesByPrescription = useCallback(async (prescriptionId) => {
    try {
      const response = await fhirClient.search('MedicationDispense', {
        prescription: prescriptionId,
        _sort: '-whenhandover'
      });
      return response.entry?.map(entry => entry.resource) || [];
    } catch (err) {
      return [];
    }
  }, []);
  
  const getDispensesByStatus = useCallback((status) => {
    return dispenses.filter(dispense => dispense.status === status);
  }, [dispenses]);
  
  const getDispensesByDateRange = useCallback((startDate, endDate) => {
    return dispenses.filter(dispense => {
      const handoverDate = new Date(dispense.whenHandedOver);
      return handoverDate >= startDate && handoverDate <= endDate;
    });
  }, [dispenses]);
  
  const getDispenseMetrics = useMemo(() => {
    const metrics = {
      total: dispenses.length,
      byStatus: {},
      byDate: {},
      totalQuantity: 0
    };
    
    dispenses.forEach(dispense => {
      // By status
      const status = dispense.status;
      metrics.byStatus[status] = (metrics.byStatus[status] || 0) + 1;
      
      // By date
      const date = dispense.whenHandedOver?.split('T')[0];
      if (date) {
        metrics.byDate[date] = (metrics.byDate[date] || 0) + 1;
      }
      
      // Total quantity
      if (dispense.quantity?.value) {
        metrics.totalQuantity += dispense.quantity.value;
      }
    });
    
    return metrics;
  }, [dispenses]);
  
  return {
    dispenses,
    loading,
    error,
    createDispense,
    updateDispense,
    refreshDispenses: fetchDispenses,
    getDispensesByPrescription,
    getDispensesByStatus,
    getDispensesByDateRange,
    metrics: getDispenseMetrics
  };
};

export const useMedicationWorkflow = (prescriptionId) => {
  const [workflow, setWorkflow] = useState({
    prescription: null,
    dispenses: [],
    administrations: [],
    status: 'unknown',
    progress: {
      prescribed: 0,
      dispensed: 0,
      administered: 0
    },
    timeline: []
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const loadWorkflow = useCallback(async () => {
    if (!prescriptionId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Load prescription
      const prescription = await fhirClient.read('MedicationRequest', prescriptionId);
      
      // Load related dispenses
      const dispensesResponse = await fhirClient.search('MedicationDispense', {
        prescription: prescriptionId,
        _sort: '-whenhandover'
      });
      const dispenses = dispensesResponse.entry?.map(e => e.resource) || [];
      
      // Load related administrations (Phase 2 implementation)
      let administrations = [];
      try {
        const administrationsResponse = await fhirClient.search('MedicationAdministration', {
          request: prescriptionId,
          _sort: '-effective-time'
        });
        administrations = administrationsResponse.entry?.map(e => e.resource) || [];
      } catch (err) {
        // Administrations may not exist for this prescription
        administrations = [];
      }
      
      // Calculate workflow status
      const status = calculateWorkflowStatus(prescription, dispenses, administrations);
      
      // Calculate progress
      const prescribedQuantity = prescription.dispenseRequest?.quantity?.value || 0;
      const dispensedQuantity = dispenses.reduce((total, dispense) => 
        total + (dispense.quantity?.value || 0), 0
      );
      const administeredQuantity = administrations
        .filter(admin => admin.status === 'completed')
        .reduce((total, admin) => 
          total + (admin.dosage?.dose?.value || 0), 0
        );
      
      const progress = {
        prescribed: prescribedQuantity,
        dispensed: dispensedQuantity,
        administered: administeredQuantity
      };
      
      // Create timeline
      const timeline = createWorkflowTimeline(prescription, dispenses, administrations);
      
      setWorkflow({
        prescription,
        dispenses,
        administrations,
        status,
        progress,
        timeline
      });
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [prescriptionId]);
  
  useEffect(() => {
    loadWorkflow();
  }, [loadWorkflow]);
  
  return {
    workflow,
    loading,
    error,
    refreshWorkflow: loadWorkflow
  };
};

// Helper functions
const calculateWorkflowStatus = (prescription, dispenses, administrations) => {
  if (prescription.status === 'cancelled' || prescription.status === 'stopped') {
    return prescription.status;
  }
  
  const prescribedQuantity = prescription.dispenseRequest?.quantity?.value || 0;
  const dispensedQuantity = dispenses.reduce((total, dispense) => 
    total + (dispense.quantity?.value || 0), 0
  );
  const administeredQuantity = administrations
    .filter(admin => admin.status === 'completed')
    .reduce((total, admin) => 
      total + (admin.dosage?.dose?.value || 0), 0
    );
  
  if (administeredQuantity >= prescribedQuantity) return 'completed';
  if (administeredQuantity > 0) return 'partially-administered';
  if (dispensedQuantity > 0) return 'dispensed';
  if (prescription.status === 'active') return 'prescribed';
  
  return 'unknown';
};

const createWorkflowTimeline = (prescription, dispenses, administrations) => {
  const events = [];
  
  // Add prescription event
  events.push({
    type: 'prescription',
    timestamp: prescription.authoredOn,
    resource: prescription,
    title: 'Prescribed',
    description: `Prescribed by ${prescription.requester?.display || 'Unknown Provider'}`,
    icon: 'prescription'
  });
  
  // Add dispense events
  dispenses.forEach(dispense => {
    events.push({
      type: 'dispense',
      timestamp: dispense.whenHandedOver || dispense.whenPrepared,
      resource: dispense,
      title: 'Dispensed',
      description: `${dispense.quantity?.value || 0} ${dispense.quantity?.unit || 'units'} dispensed`,
      icon: 'dispense'
    });
  });
  
  // Add administration events
  administrations.forEach(admin => {
    events.push({
      type: 'administration',
      timestamp: admin.effectiveDateTime,
      resource: admin,
      title: admin.status === 'completed' ? 'Administered' : 'Not Given',
      description: admin.status === 'completed' 
        ? `${admin.dosage?.dose?.value || 0} ${admin.dosage?.dose?.unit || 'units'} administered`
        : `Not given: ${admin.statusReason?.[0]?.text || 'No reason specified'}`,
      icon: admin.status === 'completed' ? 'administered' : 'not-given'
    });
  });
  
  return events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
};

export default useMedicationDispense;