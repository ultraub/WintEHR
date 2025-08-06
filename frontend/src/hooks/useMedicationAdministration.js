/**
 * useMedicationAdministration Hook
 * React hook for FHIR R4 MedicationAdministration resource management
 * Part of Phase 2 Implementation: MedicationAdministration Integration
 */

import { useState, useEffect, useCallback } from 'react';
import { medicationAdministrationService } from '../services/medicationAdministrationService';
import { useClinicalWorkflow, CLINICAL_EVENTS } from '../contexts/ClinicalWorkflowContext';

/**
 * Hook for managing MedicationAdministration resources
 * @param {string} patientId - Patient ID
 * @param {Object} options - Configuration options
 * @returns {Object} Administration state and functions
 */
export const useMedicationAdministration = (patientId, options = {}) => {
  const [administrations, setAdministrations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { publish } = useClinicalWorkflow();

  const refreshAdministrations = useCallback(async () => {
    if (!patientId) return;

    setLoading(true);
    setError(null);

    try {
      const administrations = await medicationAdministrationService.getPatientAdministrations(
        patientId, 
        options.filters
      );
      setAdministrations(administrations);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [patientId, options.filters]);

  useEffect(() => {
    refreshAdministrations();
  }, [refreshAdministrations]);

  const recordAdministration = useCallback(async (administrationData) => {
    setLoading(true);
    try {
      const newAdministration = await medicationAdministrationService.createMedicationAdministration(administrationData);
      
      // Refresh the list
      await refreshAdministrations();
      
      // Publish event for cross-module integration
      await publish(CLINICAL_EVENTS.MEDICATION_ADMINISTERED, {
        administrationId: newAdministration.id,
        patientId,
        medicationRequest: administrationData.request?.reference,
        status: administrationData.status,
        effectiveDateTime: administrationData.effectiveDateTime
      });

      return newAdministration;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [patientId, refreshAdministrations, publish]);

  const updateAdministrationStatus = useCallback(async (administrationId, status, reason = null) => {
    setLoading(true);
    try {
      const updatedAdministration = await medicationAdministrationService.updateAdministrationStatus(
        administrationId,
        status,
        reason
      );
      
      // Refresh the list
      await refreshAdministrations();
      
      // Publish status change event
      await publish(CLINICAL_EVENTS.MEDICATION_STATUS_CHANGED, {
        administrationId,
        patientId,
        oldStatus: administrations.find(a => a.id === administrationId)?.status,
        newStatus: status,
        reason
      });

      return updatedAdministration;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [patientId, refreshAdministrations, publish, administrations]);

  return {
    administrations,
    loading,
    error,
    refreshAdministrations,
    recordAdministration,
    updateAdministrationStatus
  };
};

/**
 * Hook for Medication Administration Record (MAR) functionality
 * @param {string} patientId - Patient ID
 * @param {string} encounterId - Encounter ID (optional)
 * @param {Date} date - Date for MAR (defaults to today)
 * @returns {Object} MAR state and functions
 */
export const useMedicationAdministrationRecord = (patientId, encounterId = null, date = new Date()) => {
  const [marData, setMarData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { publish } = useClinicalWorkflow();

  const refreshMAR = useCallback(async () => {
    if (!patientId) return;

    setLoading(true);
    setError(null);

    try {
      const mar = await medicationAdministrationService.getMedicationAdministrationRecord(
        patientId,
        encounterId,
        date
      );
      setMarData(mar);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [patientId, encounterId, date]);

  useEffect(() => {
    refreshMAR();
  }, [refreshMAR]);

  const recordMARAdministration = useCallback(async (medicationRequestId, scheduledTime, administrationData) => {
    setLoading(true);
    try {
      const administrationRecord = {
        status: 'completed',
        medicationCodeableConcept: administrationData.medicationCodeableConcept,
        subject: { reference: `Patient/${patientId}` },
        context: encounterId ? { reference: `Encounter/${encounterId}` } : undefined,
        effectiveDateTime: administrationData.effectiveDateTime || new Date().toISOString(),
        request: { reference: `MedicationRequest/${medicationRequestId}` },
        performer: administrationData.performer || [],
        dosage: administrationData.dosage,
        note: administrationData.note || []
      };

      const newAdministration = await medicationAdministrationService.createMedicationAdministration(administrationRecord);
      
      // Refresh MAR
      await refreshMAR();
      
      // Publish MAR administration event
      await publish(CLINICAL_EVENTS.MAR_ADMINISTRATION_RECORDED, {
        administrationId: newAdministration.id,
        patientId,
        encounterId,
        medicationRequestId,
        scheduledTime,
        administeredTime: administrationRecord.effectiveDateTime,
        date: date.toISOString().split('T')[0]
      });

      return newAdministration;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [patientId, encounterId, date, refreshMAR, publish]);

  const recordMARMissedDose = useCallback(async (medicationRequestId, scheduledTime, reason) => {
    setLoading(true);
    try {
      // Get the medication request to get medication details
      const marMedication = marData?.medications?.find(m => m.medicationRequest.id === medicationRequestId);
      if (!marMedication) {
        throw new Error('Medication request not found in MAR');
      }

      const missedRecord = {
        status: 'not-done',
        statusReason: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/reason-medication-not-given',
            code: reason,
            display: medicationAdministrationService.getStatusReasonDisplay(reason)
          }]
        }],
        medicationCodeableConcept: marMedication.medicationRequest.medicationCodeableConcept,
        subject: { reference: `Patient/${patientId}` },
        context: encounterId ? { reference: `Encounter/${encounterId}` } : undefined,
        effectiveDateTime: scheduledTime,
        request: { reference: `MedicationRequest/${medicationRequestId}` },
        note: [{
          text: `Missed dose at scheduled time ${new Date(scheduledTime).toLocaleTimeString()}. Reason: ${reason}`
        }]
      };

      const missedAdministration = await medicationAdministrationService.createMedicationAdministration(missedRecord);
      
      // Refresh MAR
      await refreshMAR();
      
      // Publish missed dose event
      await publish(CLINICAL_EVENTS.MAR_DOSE_MISSED, {
        administrationId: missedAdministration.id,
        patientId,
        encounterId,
        medicationRequestId,
        scheduledTime,
        reason,
        date: date.toISOString().split('T')[0]
      });

      return missedAdministration;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [patientId, encounterId, date, marData, refreshMAR, publish]);

  return {
    marData,
    loading,
    error,
    refreshMAR,
    recordMARAdministration,
    recordMARMissedDose
  };
};

/**
 * Hook for administration metrics and analytics
 * @param {string} patientId - Patient ID
 * @param {number} days - Number of days for analysis
 * @returns {Object} Metrics state and functions
 */
export const useMedicationAdministrationMetrics = (patientId, days = 30) => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refreshMetrics = useCallback(async () => {
    if (!patientId) return;

    setLoading(true);
    setError(null);

    try {
      const metricsData = await medicationAdministrationService.getAdministrationMetrics(patientId, days);
      setMetrics(metricsData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [patientId, days]);

  useEffect(() => {
    refreshMetrics();
  }, [refreshMetrics]);

  return {
    metrics,
    loading,
    error,
    refreshMetrics
  };
};

/**
 * Hook for administration validation
 * @param {string} medicationRequestId - MedicationRequest ID
 * @param {string} patientId - Patient ID
 * @returns {Object} Validation state and functions
 */
export const useMedicationAdministrationValidation = (medicationRequestId, patientId) => {
  const [validation, setValidation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const validateAdministration = useCallback(async () => {
    if (!medicationRequestId || !patientId) return;

    setLoading(true);
    setError(null);

    try {
      const validationResult = await medicationAdministrationService.validateAdministrationPrerequisites(
        medicationRequestId,
        patientId
      );
      setValidation(validationResult);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [medicationRequestId, patientId]);

  useEffect(() => {
    validateAdministration();
  }, [validateAdministration]);

  return {
    validation,
    loading,
    error,
    validateAdministration
  };
};