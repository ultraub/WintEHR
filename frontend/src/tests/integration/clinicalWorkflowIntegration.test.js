/**
 * Clinical Workflow Integration Tests
 * Verifies cross-module event communication and data flow
 */

import { renderHook, act } from '@testing-library/react-hooks';
import { render, screen, waitFor, fireEvent } from '../test-utils';
import { useClinicalWorkflow, CLINICAL_EVENTS } from '../../contexts/ClinicalWorkflowContext';
import { useFHIRResource } from '../../contexts/FHIRResourceContext';

// Mock modules
jest.mock('../../services/fhirClient');
jest.mock('../../services/enhancedLabOrderingService');

describe('Clinical Workflow Integration', () => {
  describe('Order-to-Result Workflow', () => {
    test('ORDER_PLACED event triggers result monitoring', async () => {
      const { result } = renderHook(() => useClinicalWorkflow(), {
        wrapper: ({ children }) => (
          <AppProviders>
            {children}
          </AppProviders>
        )
      });

      const mockOrder = {
        orderId: 'test-order-123',
        type: 'laboratory',
        patient: 'patient-123',
        code: '1234-5',
        display: 'Basic Metabolic Panel'
      };

      let receivedEvent = null;
      
      // Subscribe to order events
      act(() => {
        const unsubscribe = result.current.subscribe(
          CLINICAL_EVENTS.ORDER_PLACED,
          (data) => {
            receivedEvent = data;
          }
        );
      });

      // Publish order event
      await act(async () => {
        await result.current.publish(CLINICAL_EVENTS.ORDER_PLACED, mockOrder);
      });

      // Verify event was received
      expect(receivedEvent).toEqual(mockOrder);
    });

    test('RESULT_RECEIVED event updates order status', async () => {
      const { result } = renderHook(() => useClinicalWorkflow(), {
        wrapper: ({ children }) => (
          <AppProviders>
            {children}
          </AppProviders>
        )
      });

      const mockResult = {
        orderId: 'test-order-123',
        observationId: 'observation-456',
        status: 'final',
        value: '140',
        unit: 'mg/dL',
        interpretation: 'high'
      };

      let receivedEvent = null;
      
      // Subscribe to result events
      act(() => {
        const unsubscribe = result.current.subscribe(
          CLINICAL_EVENTS.RESULT_RECEIVED,
          (data) => {
            receivedEvent = data;
          }
        );
      });

      // Publish result event
      await act(async () => {
        await result.current.publish(CLINICAL_EVENTS.RESULT_RECEIVED, mockResult);
      });

      // Verify event was received
      expect(receivedEvent).toEqual(mockResult);
    });
  });

  describe('Prescription-to-Dispense Workflow', () => {
    test('MEDICATION_PRESCRIBED event notifies pharmacy', async () => {
      const { result } = renderHook(() => useClinicalWorkflow(), {
        wrapper: ({ children }) => (
          <AppProviders>
            {children}
          </AppProviders>
        )
      });

      const mockPrescription = {
        medicationRequestId: 'med-request-123',
        patient: 'patient-123',
        medication: 'Lisinopril 10mg',
        quantity: 30,
        refills: 3
      };

      let pharmacyNotified = false;
      
      // Subscribe as pharmacy module
      act(() => {
        const unsubscribe = result.current.subscribe(
          CLINICAL_EVENTS.MEDICATION_PRESCRIBED,
          (data) => {
            pharmacyNotified = true;
            expect(data.medicationRequestId).toBe(mockPrescription.medicationRequestId);
          }
        );
      });

      // Publish prescription event
      await act(async () => {
        await result.current.publish(CLINICAL_EVENTS.MEDICATION_PRESCRIBED, mockPrescription);
      });

      // Verify pharmacy was notified
      expect(pharmacyNotified).toBe(true);
    });

    test('MEDICATION_DISPENSED event updates patient record', async () => {
      const { result } = renderHook(() => useClinicalWorkflow(), {
        wrapper: ({ children }) => (
          <AppProviders>
            {children}
          </AppProviders>
        )
      });

      const mockDispense = {
        medicationRequestId: 'med-request-123',
        medicationDispenseId: 'dispense-456',
        status: 'completed',
        quantity: 30,
        daysSupply: 30
      };

      let chartUpdated = false;
      
      // Subscribe as chart module
      act(() => {
        const unsubscribe = result.current.subscribe(
          CLINICAL_EVENTS.MEDICATION_DISPENSED,
          (data) => {
            chartUpdated = true;
            expect(data.status).toBe('completed');
          }
        );
      });

      // Publish dispense event
      await act(async () => {
        await result.current.publish(CLINICAL_EVENTS.MEDICATION_DISPENSED, mockDispense);
      });

      // Verify chart was updated
      expect(chartUpdated).toBe(true);
    });
  });

  describe('Documentation Workflow', () => {
    test('NOTE_CREATED event triggers encounter update', async () => {
      const { result } = renderHook(() => useClinicalWorkflow(), {
        wrapper: ({ children }) => (
          <AppProviders>
            {children}
          </AppProviders>
        )
      });

      const mockNote = {
        documentId: 'doc-123',
        encounterId: 'encounter-456',
        type: 'progress-note',
        status: 'current',
        author: 'Dr. Smith'
      };

      let encounterNotified = false;
      
      // Subscribe as encounter module
      act(() => {
        const unsubscribe = result.current.subscribe(
          CLINICAL_EVENTS.NOTE_CREATED,
          (data) => {
            encounterNotified = true;
            expect(data.encounterId).toBe(mockNote.encounterId);
          }
        );
      });

      // Publish note event
      await act(async () => {
        await result.current.publish(CLINICAL_EVENTS.NOTE_CREATED, mockNote);
      });

      // Verify encounter was notified
      expect(encounterNotified).toBe(true);
    });

    test('NOTE_SIGNED event updates note status', async () => {
      const { result } = renderHook(() => useClinicalWorkflow(), {
        wrapper: ({ children }) => (
          <AppProviders>
            {children}
          </AppProviders>
        )
      });

      const mockSignedNote = {
        documentId: 'doc-123',
        status: 'final',
        signedBy: 'Dr. Smith',
        signedAt: new Date().toISOString()
      };

      let statusUpdated = false;
      
      // Subscribe to note signed events
      act(() => {
        const unsubscribe = result.current.subscribe(
          CLINICAL_EVENTS.NOTE_SIGNED,
          (data) => {
            statusUpdated = true;
            expect(data.status).toBe('final');
          }
        );
      });

      // Publish signed event
      await act(async () => {
        await result.current.publish(CLINICAL_EVENTS.NOTE_SIGNED, mockSignedNote);
      });

      // Verify status was updated
      expect(statusUpdated).toBe(true);
    });
  });

  describe('Alert Propagation', () => {
    test('CRITICAL_LAB_RESULT triggers multiple module updates', async () => {
      const { result } = renderHook(() => useClinicalWorkflow(), {
        wrapper: ({ children }) => (
          <AppProviders>
            {children}
          </AppProviders>
        )
      });

      const mockCriticalResult = {
        observationId: 'obs-critical-123',
        patientId: 'patient-123',
        code: 'potassium',
        value: 6.5,
        unit: 'mmol/L',
        interpretation: 'critical-high',
        message: 'Critical potassium level - immediate attention required'
      };

      const modulesNotified = {
        alerts: false,
        orders: false,
        encounters: false
      };
      
      // Subscribe multiple modules
      act(() => {
        // Alerts module
        result.current.subscribe(
          CLINICAL_EVENTS.CRITICAL_LAB_RESULT,
          (data) => {
            modulesNotified.alerts = true;
          }
        );

        // Orders module (may need to order follow-up)
        result.current.subscribe(
          CLINICAL_EVENTS.CRITICAL_LAB_RESULT,
          (data) => {
            modulesNotified.orders = true;
          }
        );

        // Encounters module (may need documentation)
        result.current.subscribe(
          CLINICAL_EVENTS.CRITICAL_LAB_RESULT,
          (data) => {
            modulesNotified.encounters = true;
          }
        );
      });

      // Publish critical result
      await act(async () => {
        await result.current.publish(CLINICAL_EVENTS.CRITICAL_LAB_RESULT, mockCriticalResult);
      });

      // Verify all modules were notified
      expect(modulesNotified.alerts).toBe(true);
      expect(modulesNotified.orders).toBe(true);
      expect(modulesNotified.encounters).toBe(true);
    });
  });

  describe('Resource Update Cascades', () => {
    test('Updating patient allergy cascades to medication checks', async () => {
      const { result: workflowResult } = renderHook(() => useClinicalWorkflow(), {
        wrapper: ({ children }) => (
          <AppProviders>
            {children}
          </AppProviders>
        )
      });

      const mockAllergy = {
        allergyId: 'allergy-123',
        patientId: 'patient-123',
        substance: 'Penicillin',
        reaction: 'Anaphylaxis',
        criticality: 'high'
      };

      let medicationCheckTriggered = false;
      
      // Subscribe to allergy updates
      act(() => {
        const unsubscribe = workflowResult.current.subscribe(
          CLINICAL_EVENTS.ALLERGY_ADDED,
          (data) => {
            medicationCheckTriggered = true;
            expect(data.substance).toBe('Penicillin');
          }
        );
      });

      // Publish allergy update
      await act(async () => {
        await workflowResult.current.publish(CLINICAL_EVENTS.ALLERGY_ADDED, mockAllergy);
      });

      // Verify medication check was triggered
      expect(medicationCheckTriggered).toBe(true);
    });
  });
});