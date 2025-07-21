/**
 * Medication Workflow Validation Service
 * Ensures data consistency and integrity across all medication workflows
 */

import { fhirClient } from '../core/fhir/services/fhirClient';
import { medicationListManagementService } from './medicationListManagementService';
import { prescriptionRefillService } from './prescriptionRefillService';
import { medicationEffectivenessService } from './medicationEffectivenessService';
import { differenceInDays, parseISO } from 'date-fns';

class MedicationWorkflowValidator {
  constructor() {
    this.validationCache = new Map();
    this.consistencyRules = this.initializeConsistencyRules();
  }

  /**
   * Initialize data consistency rules
   */
  initializeConsistencyRules() {
    return {
      // Status consistency rules
      statusTransitions: {
        'draft': ['active', 'cancelled'],
        'active': ['on-hold', 'completed', 'stopped', 'cancelled'],
        'on-hold': ['active', 'stopped', 'cancelled'],
        'completed': [], // Terminal state
        'stopped': [], // Terminal state
        'cancelled': [], // Terminal state
        'entered-in-error': [] // Terminal state
      },

      // Required related resources
      requiredRelations: {
        'active': ['monitoring-plan'], // Active meds should have monitoring
        'completed': ['dispense-record'], // Completed meds should have dispense records
        'stopped': ['discontinuation-record'] // Stopped meds should have discontinuation records
      },

      // Data integrity constraints
      integrityConstraints: {
        'dosage_not_empty': med => med.dosageInstruction?.length > 0,
        'authored_date_valid': med => med.authoredOn && !isNaN(Date.parse(med.authoredOn)),
        'patient_reference_valid': med => med.subject?.reference?.startsWith('Patient/'),
        'medication_coded': med => med.medicationCodeableConcept?.coding?.length > 0 || 
                                   med.medicationCodeableConcept?.text,
        'dispense_quantity_positive': dispense => !dispense.quantity || dispense.quantity.value > 0,
        'days_supply_positive': dispense => !dispense.daysSupply || dispense.daysSupply.value > 0
      },

      // Cross-workflow consistency
      crossWorkflowRules: {
        'refill_request_valid': async (refillRequest, originalMed) => {
          // Refill requests should only exist for active medications
          if (originalMed.status !== 'active') {
            return { valid: false, issue: 'Refill request exists for non-active medication' };
          }
          
          // Check refill count
          const refillsUsed = refillRequest.refillInfo?.refillNumber || 0;
          const refillsAllowed = originalMed.dispenseRequest?.numberOfRepeatsAllowed || 0;
          if (refillsUsed > refillsAllowed) {
            return { valid: false, issue: 'Refill count exceeds allowed repeats' };
          }
          
          return { valid: true };
        },

        'discontinuation_consistent': async (discontinuation, medicationRequest) => {
          // Discontinuation records should match medication status
          const medicationStatus = medicationRequest.status;
          const discType = discontinuation.extension?.find(
            ext => ext.url === 'http://example.org/fhir/discontinuation-type'
          )?.valueString;

          if (discType === 'immediate' && medicationStatus !== 'stopped') {
            return { valid: false, issue: 'Immediate discontinuation but medication not stopped' };
          }

          if (discType === 'tapered' && !['on-hold', 'stopped'].includes(medicationStatus)) {
            return { valid: false, issue: 'Tapered discontinuation but medication still active' };
          }

          return { valid: true };
        },

        'monitoring_plan_exists': async (medicationRequest) => {
          // Active medications should have monitoring plans
          if (medicationRequest.status === 'active') {
            try {
              const monitoringPlans = await fhirClient.search('CarePlan', {
                patient: medicationRequest.subject.reference.split('/')[1],
                status: 'active',
                category: 'assess-plan',
                _count: 50
              });

              const hasPlan = (monitoringPlans.resources || []).some(plan => {
                const medicationExt = plan.extension?.find(
                  ext => ext.url === 'http://example.org/fhir/medication-monitoring'
                );
                const medRef = medicationExt?.extension?.find(
                  ext => ext.url === 'originalMedication'
                )?.valueReference?.reference;
                
                return medRef === `MedicationRequest/${medicationRequest.id}`;
              });

              if (!hasPlan) {
                return { valid: false, issue: 'Active medication missing monitoring plan' };
              }
            } catch (error) {
              // Monitoring plan check failed - continue with validation
            }
          }

          return { valid: true };
        }
      }
    };
  }

  /**
   * Validate complete medication workflow for a patient
   */
  async validatePatientMedicationWorkflow(patientId) {
    try {
      const validationReport = {
        patientId,
        timestamp: new Date().toISOString(),
        overall: { valid: true, score: 100 },
        medications: [],
        crossWorkflow: [],
        recommendations: [],
        criticalIssues: [],
        warnings: []
      };

      // Get all medication-related resources
      const medicationData = await this.gatherMedicationData(patientId);
      
      // Validate each medication
      for (const medication of medicationData.medications) {
        const medValidation = await this.validateSingleMedication(medication, medicationData);
        validationReport.medications.push(medValidation);
        
        if (!medValidation.valid) {
          validationReport.overall.valid = false;
        }
      }

      // Validate cross-workflow consistency
      const crossWorkflowValidation = await this.validateCrossWorkflowConsistency(medicationData);
      validationReport.crossWorkflow = crossWorkflowValidation;

      // Calculate overall score
      validationReport.overall.score = this.calculateOverallScore(validationReport);

      // Generate recommendations
      validationReport.recommendations = this.generateRecommendations(validationReport);

      // Categorize issues
      this.categorizeIssues(validationReport);

      return validationReport;

    } catch (error) {
      throw error;
    }
  }

  /**
   * Gather all medication-related data for a patient
   * NOTE: Uses defensive programming to handle missing FHIR resource types
   */
  async gatherMedicationData(patientId) {
    try {

      const [
        medicationsResponse,
        dispensesResponse,
        listsResponse,
        carePlansResponse,
        basicsResponse,
        observationsResponse
      ] = await Promise.all([
        fhirClient.search('MedicationRequest', { patient: patientId, _count: 100 }),
        fhirClient.search('MedicationDispense', { patient: patientId, _count: 100 }),
        fhirClient.search('List', { patient: patientId, _count: 50 }),
        fhirClient.search('CarePlan', { patient: patientId, _count: 50 }),
        fhirClient.search('Basic', { patient: patientId, _count: 100 }),
        fhirClient.search('Observation', { 
          patient: patientId, 
          category: 'therapy',
          _count: 100 
        })
      ]);

      return {
        medications: medicationsResponse.resources || [],
        dispenses: dispensesResponse.resources || [],
        lists: listsResponse.resources || [],
        carePlans: carePlansResponse.resources || [],
        discontinuations: (basicsResponse.resources || []).filter(basic => 
          basic.code?.coding?.[0]?.code === 'medication-discontinuation'
        ),
        effectivenessAssessments: (observationsResponse.resources || []).filter(obs =>
          obs.code?.coding?.[0]?.code === 'medication-effectiveness-assessment'
        )
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Validate a single medication and its related workflows
   */
  async validateSingleMedication(medication, medicationData) {
    const validation = {
      medicationId: medication.id,
      medicationName: medication.medicationCodeableConcept?.text || 'Unknown',
      status: medication.status,
      valid: true,
      issues: [],
      workflows: {
        prescribing: { valid: true, issues: [] },
        dispensing: { valid: true, issues: [] },
        refills: { valid: true, issues: [] },
        discontinuation: { valid: true, issues: [] },
        monitoring: { valid: true, issues: [] }
      }
    };

    // Validate basic medication data integrity
    this.validateMedicationIntegrity(medication, validation);

    // Validate dispensing workflow
    await this.validateDispensingWorkflow(medication, medicationData, validation);

    // Validate refill workflow
    await this.validateRefillWorkflow(medication, medicationData, validation);

    // Validate discontinuation workflow
    await this.validateDiscontinuationWorkflow(medication, medicationData, validation);

    // Validate monitoring workflow
    await this.validateMonitoringWorkflow(medication, medicationData, validation);

    // Determine overall validity
    validation.valid = Object.values(validation.workflows).every(workflow => workflow.valid);

    return validation;
  }

  /**
   * Validate medication data integrity
   */
  validateMedicationIntegrity(medication, validation) {
    const constraints = this.consistencyRules.integrityConstraints;
    
    Object.entries(constraints).forEach(([ruleName, ruleFunction]) => {
      if (!ruleFunction(medication)) {
        validation.workflows.prescribing.valid = false;
        validation.workflows.prescribing.issues.push({
          type: 'integrity',
          rule: ruleName,
          message: `Medication fails integrity constraint: ${ruleName}`,
          severity: 'error'
        });
      }
    });
  }

  /**
   * Validate dispensing workflow
   */
  async validateDispensingWorkflow(medication, medicationData, validation) {
    const relatedDispenses = medicationData.dispenses.filter(dispense =>
      dispense.authorizingPrescription?.some(ref => 
        ref.reference === `MedicationRequest/${medication.id}`
      )
    );

    // Check if completed medications have dispense records
    if (medication.status === 'completed' && relatedDispenses.length === 0) {
      validation.workflows.dispensing.valid = false;
      validation.workflows.dispensing.issues.push({
        type: 'missing-dispense',
        message: 'Completed medication has no dispense records',
        severity: 'warning'
      });
    }

    // Validate dispense quantities and dates
    relatedDispenses.forEach(dispense => {
      if (!this.consistencyRules.integrityConstraints.dispense_quantity_positive(dispense)) {
        validation.workflows.dispensing.valid = false;
        validation.workflows.dispensing.issues.push({
          type: 'invalid-quantity',
          message: 'Dispense has invalid quantity',
          severity: 'error',
          dispenseId: dispense.id
        });
      }

      if (!this.consistencyRules.integrityConstraints.days_supply_positive(dispense)) {
        validation.workflows.dispensing.valid = false;
        validation.workflows.dispensing.issues.push({
          type: 'invalid-days-supply',
          message: 'Dispense has invalid days supply',
          severity: 'error',
          dispenseId: dispense.id
        });
      }
    });
  }

  /**
   * Validate refill workflow
   */
  async validateRefillWorkflow(medication, medicationData, validation) {
    try {
      // Get refill requests for this medication
      const refillHistory = await prescriptionRefillService.getRefillHistory(medication.id);
      
      if (refillHistory) {
        // Validate refill count doesn't exceed allowed
        const refillsAllowed = medication.dispenseRequest?.numberOfRepeatsAllowed || 0;
        if (refillHistory.refillsUsed > refillsAllowed) {
          validation.workflows.refills.valid = false;
          validation.workflows.refills.issues.push({
            type: 'excess-refills',
            message: `Refills used (${refillHistory.refillsUsed}) exceeds allowed (${refillsAllowed})`,
            severity: 'error'
          });
        }

        // Check for gaps in refill timing
        const adherence = await prescriptionRefillService.calculateMedicationAdherence(medication.id);
        if (adherence && adherence.adherenceRate < 0.8 && medication.status === 'active') {
          validation.workflows.refills.valid = false;
          validation.workflows.refills.issues.push({
            type: 'poor-adherence',
            message: `Poor medication adherence (${Math.round(adherence.adherenceRate * 100)}%)`,
            severity: 'warning'
          });
        }
      }
    } catch (error) {
      // Refill workflow validation failed - continue
    }
  }

  /**
   * Validate discontinuation workflow
   */
  async validateDiscontinuationWorkflow(medication, medicationData, validation) {
    const relatedDiscontinuations = medicationData.discontinuations.filter(disc => {
      const medicationRef = disc.extension?.find(
        ext => ext.url === 'http://example.org/fhir/original-medication'
      )?.valueReference?.reference;
      return medicationRef === `MedicationRequest/${medication.id}`;
    });

    // Check if stopped medications have discontinuation records
    if (medication.status === 'stopped' && relatedDiscontinuations.length === 0) {
      validation.workflows.discontinuation.valid = false;
      validation.workflows.discontinuation.issues.push({
        type: 'missing-discontinuation-record',
        message: 'Stopped medication has no discontinuation record',
        severity: 'warning'
      });
    }

    // Validate discontinuation consistency
    for (const discontinuation of relatedDiscontinuations) {
      const rule = this.consistencyRules.crossWorkflowRules.discontinuation_consistent;
      const result = await rule(discontinuation, medication);
      
      if (!result.valid) {
        validation.workflows.discontinuation.valid = false;
        validation.workflows.discontinuation.issues.push({
          type: 'inconsistent-discontinuation',
          message: result.issue,
          severity: 'error',
          discontinuationId: discontinuation.id
        });
      }
    }
  }

  /**
   * Validate monitoring workflow
   */
  async validateMonitoringWorkflow(medication, medicationData, validation) {
    // Check if active medications have monitoring plans
    const rule = this.consistencyRules.crossWorkflowRules.monitoring_plan_exists;
    const result = await rule(medication);
    
    if (!result.valid) {
      validation.workflows.monitoring.valid = false;
      validation.workflows.monitoring.issues.push({
        type: 'missing-monitoring-plan',
        message: result.issue,
        severity: 'warning'
      });
    }

    // Check for recent effectiveness assessments
    const relatedAssessments = medicationData.effectivenessAssessments.filter(assessment => {
      const medicationExt = assessment.extension?.find(
        ext => ext.url === 'http://example.org/fhir/medication-assessment'
      );
      const medicationRef = medicationExt?.extension?.find(
        ext => ext.url === 'medicationReference'
      )?.valueReference?.reference;
      
      return medicationRef === `MedicationRequest/${medication.id}`;
    });

    if (medication.status === 'active') {
      const daysSinceStart = differenceInDays(new Date(), parseISO(medication.authoredOn));
      const hasRecentAssessment = relatedAssessments.some(assessment => 
        differenceInDays(new Date(), parseISO(assessment.effectiveDateTime)) <= 90
      );

      if (daysSinceStart > 30 && !hasRecentAssessment) {
        validation.workflows.monitoring.valid = false;
        validation.workflows.monitoring.issues.push({
          type: 'overdue-assessment',
          message: 'Medication lacks recent effectiveness assessment',
          severity: 'info'
        });
      }
    }
  }

  /**
   * Validate cross-workflow consistency
   */
  async validateCrossWorkflowConsistency(medicationData) {
    const crossWorkflowIssues = [];

    // Check medication list consistency
    try {
      const medicationLists = medicationData.lists.filter(list =>
        list.code?.coding?.[0]?.code === 'current-medications' ||
        list.code?.coding?.[0]?.code === 'active-prescriptions'
      );

      for (const list of medicationLists) {
        const listMedications = list.entry?.map(entry => entry.item?.reference) || [];
        const activeMedications = medicationData.medications
          .filter(med => med.status === 'active')
          .map(med => `MedicationRequest/${med.id}`);

        const missingFromList = activeMedications.filter(medRef => !listMedications.includes(medRef));
        const extraInList = listMedications.filter(medRef => !activeMedications.includes(medRef));

        if (missingFromList.length > 0 || extraInList.length > 0) {
          crossWorkflowIssues.push({
            type: 'list-inconsistency',
            message: `Medication list inconsistency: ${missingFromList.length} missing, ${extraInList.length} extra`,
            severity: 'warning',
            listId: list.id
          });
        }
      }
    } catch (error) {
      // Medication list validation failed - continue
    }

    // Check status transition validity
    medicationData.medications.forEach(medication => {
      if (medication.meta?.versionId && parseInt(medication.meta.versionId) > 1) {
        // This medication has been updated - we should validate status transitions
        // In a real implementation, we'd track status history
        const currentStatus = medication.status;
        
        // This is a simplified check - in practice, you'd need status history
        if (currentStatus === 'entered-in-error') {
          crossWorkflowIssues.push({
            type: 'error-status',
            message: 'Medication marked as entered-in-error',
            severity: 'error',
            medicationId: medication.id
          });
        }
      }
    });

    return crossWorkflowIssues;
  }

  /**
   * Calculate overall validation score
   */
  calculateOverallScore(validationReport) {
    let totalIssues = 0;
    let errorCount = 0;
    let warningCount = 0;

    validationReport.medications.forEach(medValidation => {
      Object.values(medValidation.workflows).forEach(workflow => {
        totalIssues += workflow.issues.length;
        errorCount += workflow.issues.filter(issue => issue.severity === 'error').length;
        warningCount += workflow.issues.filter(issue => issue.severity === 'warning').length;
      });
    });

    totalIssues += validationReport.crossWorkflow.length;
    errorCount += validationReport.crossWorkflow.filter(issue => issue.severity === 'error').length;
    warningCount += validationReport.crossWorkflow.filter(issue => issue.severity === 'warning').length;

    // Calculate score: start at 100, deduct points for issues
    let score = 100;
    score -= errorCount * 10; // Errors are serious
    score -= warningCount * 5; // Warnings are moderate
    score -= (totalIssues - errorCount - warningCount) * 2; // Info issues are minor

    return Math.max(0, score);
  }

  /**
   * Generate recommendations based on validation results
   */
  generateRecommendations(validationReport) {
    const recommendations = [];

    // Analyze common issues and generate recommendations
    const allIssues = [];
    validationReport.medications.forEach(medValidation => {
      Object.values(medValidation.workflows).forEach(workflow => {
        allIssues.push(...workflow.issues);
      });
    });
    allIssues.push(...validationReport.crossWorkflow);

    // Count issue types
    const issueTypeCounts = {};
    allIssues.forEach(issue => {
      issueTypeCounts[issue.type] = (issueTypeCounts[issue.type] || 0) + 1;
    });

    // Generate specific recommendations
    if (issueTypeCounts['missing-monitoring-plan'] > 0) {
      recommendations.push({
        type: 'monitoring',
        priority: 'medium',
        message: `Create monitoring plans for ${issueTypeCounts['missing-monitoring-plan']} medications`,
        action: 'Create effectiveness monitoring plans for active medications'
      });
    }

    if (issueTypeCounts['overdue-assessment'] > 0) {
      recommendations.push({
        type: 'assessment',
        priority: 'high',
        message: `Complete overdue assessments for ${issueTypeCounts['overdue-assessment']} medications`,
        action: 'Schedule and complete effectiveness assessments'
      });
    }

    if (issueTypeCounts['poor-adherence'] > 0) {
      recommendations.push({
        type: 'adherence',
        priority: 'high',
        message: `Address adherence issues for ${issueTypeCounts['poor-adherence']} medications`,
        action: 'Review patient adherence and provide education or support'
      });
    }

    if (issueTypeCounts['list-inconsistency'] > 0) {
      recommendations.push({
        type: 'data-consistency',
        priority: 'low',
        message: 'Update medication lists to reflect current status',
        action: 'Reconcile medication lists with current prescriptions'
      });
    }

    return recommendations;
  }

  /**
   * Categorize issues by severity
   */
  categorizeIssues(validationReport) {
    const allIssues = [];
    validationReport.medications.forEach(medValidation => {
      Object.values(medValidation.workflows).forEach(workflow => {
        allIssues.push(...workflow.issues.map(issue => ({
          ...issue,
          medicationId: medValidation.medicationId,
          medicationName: medValidation.medicationName
        })));
      });
    });
    allIssues.push(...validationReport.crossWorkflow);

    validationReport.criticalIssues = allIssues.filter(issue => issue.severity === 'error');
    validationReport.warnings = allIssues.filter(issue => issue.severity === 'warning');
  }

  /**
   * Auto-fix common data consistency issues
   */
  async autoFixConsistencyIssues(validationReport) {
    const fixResults = {
      attempted: 0,
      successful: 0,
      failed: 0,
      fixes: []
    };

    // Auto-fix medication list inconsistencies
    const listIssues = validationReport.crossWorkflow.filter(issue => issue.type === 'list-inconsistency');
    for (const issue of listIssues) {
      try {
        fixResults.attempted++;
        // In a real implementation, this would call medicationListManagementService
        // to synchronize the lists
        await medicationListManagementService.synchronizeMedicationLists(validationReport.patientId);
        fixResults.successful++;
        fixResults.fixes.push({
          type: 'list-sync',
          message: 'Synchronized medication lists',
          listId: issue.listId
        });
      } catch (error) {
        fixResults.failed++;
      }
    }

    // Auto-create missing monitoring plans
    const monitoringIssues = validationReport.medications.filter(medValidation =>
      medValidation.workflows.monitoring.issues.some(issue => issue.type === 'missing-monitoring-plan')
    );

    for (const medValidation of monitoringIssues) {
      try {
        fixResults.attempted++;
        // Create monitoring plan for medication
        const medication = await fhirClient.read('MedicationRequest', medValidation.medicationId);
        await medicationEffectivenessService.createMonitoringPlan(medication);
        fixResults.successful++;
        fixResults.fixes.push({
          type: 'monitoring-plan',
          message: 'Created monitoring plan',
          medicationId: medValidation.medicationId
        });
      } catch (error) {
        fixResults.failed++;
      }
    }

    return fixResults;
  }

  clearCache(patientId = null) {
    if (patientId) {
      this.validationCache.delete(patientId);
    } else {
      this.validationCache.clear();
    }
  }
}

// Export singleton instance
export const medicationWorkflowValidator = new MedicationWorkflowValidator();