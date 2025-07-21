/**
 * Medication Discontinuation Service
 * Handles medication discontinuation workflow with proper FHIR tracking
 */

import { fhirClient } from '../core/fhir/services/fhirClient';
import { medicationListManagementService } from './medicationListManagementService';
import { format, addDays, parseISO } from 'date-fns';

class MedicationDiscontinuationService {
  constructor() {
    this.discontinuationCache = new Map();
  }

  /**
   * Discontinuation status definitions
   */
  DISCONTINUATION_STATUSES = {
    PLANNED: 'planned',
    IN_PROGRESS: 'in-progress',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    FAILED: 'failed'
  };

  /**
   * Discontinue a medication with comprehensive tracking
   */
  async discontinueMedication(discontinuationData) {
    try {
      const { medicationRequestId } = discontinuationData;
      
      // Get the original medication request
      const originalRequest = await fhirClient.read('MedicationRequest', medicationRequestId);
      
      // Update the medication request status
      const updatedRequest = {
        ...originalRequest,
        status: discontinuationData.discontinuationType === 'immediate' ? 'stopped' : 'on-hold',
        statusReason: this.buildStatusReason(discontinuationData),
        note: [
          ...(originalRequest.note || []),
          {
            text: this.buildDiscontinuationNote(discontinuationData),
            time: new Date().toISOString()
          }
        ],
        extension: [
          ...(originalRequest.extension || []),
          {
            url: 'http://example.org/fhir/medication-discontinuation',
            extension: this.buildDiscontinuationExtension(discontinuationData)
          }
        ]
      };

      // Update the medication request
      const updatedMedicationRequest = await fhirClient.update('MedicationRequest', updatedRequest);

      // Create discontinuation tracking resource
      const discontinuationTracking = await this.createDiscontinuationTracking(
        originalRequest,
        discontinuationData
      );

      // Handle tapering schedule if applicable
      let taperingPlan = null;
      if (discontinuationData.discontinuationType === 'tapered') {
        taperingPlan = await this.createTaperingPlan(originalRequest, discontinuationData);
      }

      // Update medication lists
      try {
        await medicationListManagementService.handlePrescriptionStatusUpdate(
          medicationRequestId,
          updatedRequest.status,
          originalRequest.status
        );
      } catch (error) {
        // Error updating medication lists - continue with rest of process
      }

      // Create follow-up appointments if required
      let followUpAppointment = null;
      if (discontinuationData.notifications?.followUpRequired) {
        followUpAppointment = await this.createFollowUpAppointment(
          originalRequest,
          discontinuationData
        );
      }

      // Create monitoring plan if required
      let monitoringPlan = null;
      if (discontinuationData.monitoring?.required) {
        monitoringPlan = await this.createMonitoringPlan(
          originalRequest,
          discontinuationData
        );
      }

      // Clear cache
      this.clearCache(originalRequest.subject?.reference?.split('/')[1]);

      return {
        originalRequest,
        updatedRequest: updatedMedicationRequest,
        discontinuationTracking,
        taperingPlan,
        followUpAppointment,
        monitoringPlan,
        success: true
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Create discontinuation tracking resource
   */
  async createDiscontinuationTracking(originalRequest, discontinuationData) {
    try {
      const discontinuationResource = {
        resourceType: 'Basic',
        meta: {
          profile: ['http://example.org/fhir/StructureDefinition/MedicationDiscontinuation']
        },
        identifier: [{
          system: 'http://example.org/medication-discontinuation',
          value: `disc-${originalRequest.id}-${Date.now()}`
        }],
        code: {
          coding: [{
            system: 'http://example.org/medication-discontinuation-codes',
            code: 'medication-discontinuation',
            display: 'Medication Discontinuation'
          }]
        },
        subject: originalRequest.subject,
        created: new Date().toISOString(),
        author: {
          display: discontinuationData.discontinuedBy || 'Unknown Provider'
        },
        extension: [
          {
            url: 'http://example.org/fhir/original-medication',
            valueReference: { reference: `MedicationRequest/${originalRequest.id}` }
          },
          {
            url: 'http://example.org/fhir/discontinuation-reason',
            extension: [
              {
                url: 'category',
                valueString: discontinuationData.reason.category
              },
              {
                url: 'code',
                valueString: discontinuationData.reason.code
              },
              {
                url: 'display',
                valueString: discontinuationData.reason.display
              },
              {
                url: 'clinicalNotes',
                valueString: discontinuationData.reason.text || ''
              }
            ]
          },
          {
            url: 'http://example.org/fhir/discontinuation-type',
            valueString: discontinuationData.discontinuationType
          },
          {
            url: 'http://example.org/fhir/effective-date',
            valueDateTime: discontinuationData.effectiveDate
          }
        ]
      };

      return await fhirClient.create('Basic', discontinuationResource);

    } catch (error) {
      throw error;
    }
  }

  /**
   * Create tapering plan as a CarePlan resource
   */
  async createTaperingPlan(originalRequest, discontinuationData) {
    try {
      const { taperingSchedule } = discontinuationData;
      if (!taperingSchedule) return null;

      const carePlan = {
        resourceType: 'CarePlan',
        status: 'active',
        intent: 'plan',
        category: [{
          coding: [{
            system: 'http://hl7.org/fhir/us/core/CodeSystem/careplan-category',
            code: 'drug-therapy',
            display: 'Drug therapy'
          }]
        }],
        title: `Medication Tapering Plan - ${originalRequest.medicationCodeableConcept?.text || 'Unknown Medication'}`,
        description: 'Gradual discontinuation schedule to minimize withdrawal effects',
        subject: originalRequest.subject,
        created: new Date().toISOString(),
        author: {
          display: discontinuationData.discontinuedBy || 'Unknown Provider'
        },
        period: {
          start: discontinuationData.effectiveDate,
          end: this.calculateTaperingEndDate(discontinuationData.effectiveDate, taperingSchedule)
        },
        activity: this.buildTaperingActivities(originalRequest, taperingSchedule, discontinuationData.effectiveDate),
        note: [{
          text: `Tapering schedule for discontinuation. Original medication: ${originalRequest.medicationCodeableConcept?.text || 'Unknown'}`,
          time: new Date().toISOString()
        }]
      };

      return await fhirClient.create('CarePlan', carePlan);

    } catch (error) {
      throw error;
    }
  }

  /**
   * Build tapering activities for CarePlan
   */
  buildTaperingActivities(originalRequest, taperingSchedule, startDate) {
    const activities = [];
    const scheduleSteps = this.getTaperingScheduleSteps(taperingSchedule.scheduleId);
    
    scheduleSteps.forEach((step, index) => {
      const activityDate = addDays(parseISO(startDate), step.day);
      
      activities.push({
        detail: {
          kind: 'MedicationRequest',
          code: {
            coding: [{
              system: 'http://snomed.info/sct',
              code: '432102000',
              display: 'Administration of substance'
            }]
          },
          status: 'not-started',
          scheduledTiming: {
            event: [activityDate.toISOString()]
          },
          description: `${step.note} (${step.percentage}% of original dose)`,
          extension: [{
            url: 'http://example.org/fhir/tapering-step',
            extension: [
              {
                url: 'stepNumber',
                valueInteger: index + 1
              },
              {
                url: 'dosePercentage',
                valueDecimal: step.percentage / 100
              },
              {
                url: 'originalMedication',
                valueReference: { reference: `MedicationRequest/${originalRequest.id}` }
              }
            ]
          }]
        }
      });
    });

    return activities;
  }

  /**
   * Create follow-up appointment
   */
  async createFollowUpAppointment(originalRequest, discontinuationData) {
    try {
      const { followUpDate } = discontinuationData.notifications;
      if (!followUpDate) return null;

      const appointment = {
        resourceType: 'Appointment',
        status: 'proposed',
        serviceCategory: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/service-category',
            code: 'gp',
            display: 'General Practice'
          }]
        }],
        serviceType: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/service-type',
            code: '124',
            display: 'General practice'
          }]
        }],
        appointmentType: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/v2-0276',
            code: 'FOLLOWUP',
            display: 'Follow-up'
          }]
        },
        reasonCode: [{
          coding: [{
            system: 'http://snomed.info/sct',
            code: '182856006',
            display: 'Review of medication'
          }],
          text: 'Follow-up after medication discontinuation'
        }],
        description: `Follow-up appointment for medication discontinuation: ${originalRequest.medicationCodeableConcept?.text || 'Unknown medication'}`,
        start: followUpDate,
        end: addDays(parseISO(followUpDate), 0).toISOString(), // Same day, duration handled separately
        minutesDuration: 30,
        participant: [{
          actor: originalRequest.subject,
          required: 'required',
          status: 'needs-action'
        }],
        comment: `Follow-up required due to medication discontinuation for: ${discontinuationData.reason.display}`
      };

      return await fhirClient.create('Appointment', appointment);

    } catch (error) {
      throw error;
    }
  }

  /**
   * Create monitoring plan
   */
  async createMonitoringPlan(originalRequest, discontinuationData) {
    try {
      const { monitoring } = discontinuationData;
      if (!monitoring?.required) return null;

      const monitoringPlan = {
        resourceType: 'CarePlan',
        status: 'active',
        intent: 'plan',
        category: [{
          coding: [{
            system: 'http://hl7.org/fhir/us/core/CodeSystem/careplan-category',
            code: 'assess-plan',
            display: 'Assessment and Plan of Treatment'
          }]
        }],
        title: `Post-Discontinuation Monitoring - ${originalRequest.medicationCodeableConcept?.text || 'Unknown Medication'}`,
        description: 'Monitoring plan following medication discontinuation',
        subject: originalRequest.subject,
        created: new Date().toISOString(),
        author: {
          display: discontinuationData.discontinuedBy || 'Unknown Provider'
        },
        period: {
          start: discontinuationData.effectiveDate,
          end: addDays(parseISO(discontinuationData.effectiveDate), 30).toISOString() // Default 30-day monitoring
        },
        activity: [{
          detail: {
            kind: 'Task',
            code: {
              coding: [{
                system: 'http://snomed.info/sct',
                code: '182836005',
                display: 'Review of medication'
              }]
            },
            status: 'not-started',
            description: monitoring.instructions || 'Monitor patient following medication discontinuation',
            scheduledTiming: {
              repeat: {
                frequency: 1,
                period: 1,
                periodUnit: 'wk'
              }
            }
          }
        }],
        note: [{
          text: monitoring.instructions || 'Post-discontinuation monitoring required',
          time: new Date().toISOString()
        }]
      };

      return await fhirClient.create('CarePlan', monitoringPlan);

    } catch (error) {
      throw error;
    }
  }

  /**
   * Get discontinuation history for a medication
   */
  async getDiscontinuationHistory(medicationRequestId) {
    try {
      // Search for discontinuation tracking resources
      const response = await fhirClient.search('Basic', {
        code: 'medication-discontinuation',
        _profile: 'http://example.org/fhir/StructureDefinition/MedicationDiscontinuation',
        _count: 50
      });

      const discontinuations = (response.resources || []).filter(resource => {
        const originalMedRef = resource.extension?.find(
          ext => ext.url === 'http://example.org/fhir/original-medication'
        )?.valueReference?.reference;
        return originalMedRef === `MedicationRequest/${medicationRequestId}`;
      });

      // Enrich with additional data
      const enrichedHistory = await Promise.all(
        discontinuations.map(async (disc) => {
          try {
            // Get associated care plans (tapering/monitoring)
            const carePlansResponse = await fhirClient.search('CarePlan', {
              patient: disc.subject?.reference?.split('/')[1],
              _count: 10
            });

            const relatedCarePlans = (carePlansResponse.resources || []).filter(cp =>
              cp.title?.includes(medicationRequestId) || 
              cp.description?.includes(medicationRequestId)
            );

            return {
              ...disc,
              relatedCarePlans
            };
          } catch (error) {
            return disc;
          }
        })
      );

      return {
        medicationRequestId,
        discontinuations: enrichedHistory,
        totalDiscontinuations: enrichedHistory.length,
        lastDiscontinuation: enrichedHistory[0] // Most recent first
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Cancel a planned discontinuation
   */
  async cancelDiscontinuation(discontinuationId, cancellationReason) {
    try {
      const discontinuation = await fhirClient.read('Basic', discontinuationId);
      
      // Update discontinuation status
      const updatedDiscontinuation = {
        ...discontinuation,
        extension: [
          ...(discontinuation.extension || []),
          {
            url: 'http://example.org/fhir/discontinuation-status',
            valueString: this.DISCONTINUATION_STATUSES.CANCELLED
          },
          {
            url: 'http://example.org/fhir/cancellation-reason',
            valueString: cancellationReason
          },
          {
            url: 'http://example.org/fhir/cancellation-date',
            valueDateTime: new Date().toISOString()
          }
        ]
      };

      await fhirClient.update('Basic', updatedDiscontinuation);

      // Reactivate original medication request if applicable
      const originalMedRef = discontinuation.extension?.find(
        ext => ext.url === 'http://example.org/fhir/original-medication'
      )?.valueReference?.reference;

      if (originalMedRef) {
        const [resourceType, resourceId] = originalMedRef.split('/');
        const originalRequest = await fhirClient.read(resourceType, resourceId);
        
        if (originalRequest.status === 'on-hold' || originalRequest.status === 'stopped') {
          const reactivatedRequest = {
            ...originalRequest,
            status: 'active',
            note: [
              ...(originalRequest.note || []),
              {
                text: `Discontinuation cancelled: ${cancellationReason}. Medication reactivated.`,
                time: new Date().toISOString()
              }
            ]
          };

          await fhirClient.update(resourceType, reactivatedRequest);
        }
      }

      return updatedDiscontinuation;

    } catch (error) {
      throw error;
    }
  }

  /**
   * Helper methods
   */
  buildStatusReason(discontinuationData) {
    return [{
      coding: [{
        system: 'http://example.org/medication-discontinuation-reasons',
        code: discontinuationData.reason.code,
        display: discontinuationData.reason.display
      }],
      text: discontinuationData.reason.text
    }];
  }

  buildDiscontinuationNote(discontinuationData) {
    const parts = [
      `Medication discontinued due to: ${discontinuationData.reason.display}`,
      `Discontinuation type: ${discontinuationData.discontinuationType}`,
      `Effective date: ${format(parseISO(discontinuationData.effectiveDate), 'MMM d, yyyy')}`
    ];

    if (discontinuationData.alternativeTherapy) {
      parts.push(`Alternative therapy: ${discontinuationData.alternativeTherapy}`);
    }

    if (discontinuationData.reason.text) {
      parts.push(`Clinical notes: ${discontinuationData.reason.text}`);
    }

    return parts.join('. ');
  }

  buildDiscontinuationExtension(discontinuationData) {
    const extensions = [
      {
        url: 'discontinuationType',
        valueString: discontinuationData.discontinuationType
      },
      {
        url: 'effectiveDate',
        valueDateTime: discontinuationData.effectiveDate
      },
      {
        url: 'discontinuedBy',
        valueString: discontinuationData.discontinuedBy || 'Unknown'
      }
    ];

    if (discontinuationData.alternativeTherapy) {
      extensions.push({
        url: 'alternativeTherapy',
        valueString: discontinuationData.alternativeTherapy
      });
    }

    if (discontinuationData.taperingSchedule) {
      extensions.push({
        url: 'taperingSchedule',
        valueString: discontinuationData.taperingSchedule.scheduleId
      });
    }

    return extensions;
  }

  getTaperingScheduleSteps(scheduleId) {
    const schedules = {
      'gradual-2week': [
        { day: 0, percentage: 100, note: 'Continue current dose' },
        { day: 3, percentage: 75, note: 'Reduce to 75% of original dose' },
        { day: 7, percentage: 50, note: 'Reduce to 50% of original dose' },
        { day: 10, percentage: 25, note: 'Reduce to 25% of original dose' },
        { day: 14, percentage: 0, note: 'Discontinue completely' }
      ],
      'conservative-4week': [
        { day: 0, percentage: 100, note: 'Continue current dose' },
        { day: 7, percentage: 75, note: 'Reduce to 75% of original dose' },
        { day: 14, percentage: 50, note: 'Reduce to 50% of original dose' },
        { day: 21, percentage: 25, note: 'Reduce to 25% of original dose' },
        { day: 28, percentage: 0, note: 'Discontinue completely' }
      ],
      'immediate': [
        { day: 0, percentage: 0, note: 'Discontinue immediately' }
      ]
    };

    return schedules[scheduleId] || schedules['immediate'];
  }

  calculateTaperingEndDate(startDate, taperingSchedule) {
    const scheduleSteps = this.getTaperingScheduleSteps(taperingSchedule.scheduleId);
    const lastStep = scheduleSteps[scheduleSteps.length - 1];
    return addDays(parseISO(startDate), lastStep.day).toISOString();
  }

  clearCache(patientId = null) {
    if (patientId) {
      this.discontinuationCache.delete(patientId);
    } else {
      this.discontinuationCache.clear();
    }
  }
}

// Export singleton instance
export const medicationDiscontinuationService = new MedicationDiscontinuationService();