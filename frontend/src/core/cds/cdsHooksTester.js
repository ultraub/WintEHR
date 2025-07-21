/**
 * CDS Hooks Testing Utility
 * Provides functions to test CDS hooks with real patient data
 */
import { cdsHooksClient } from '../services/cdsHooksClient';
import { fhirClient } from '../core/fhir/services/fhirClient';

class CDSHooksTester {
  constructor() {
    this.testResults = [];
  }

  /**
   * Test all patient-view hooks for a specific patient
   */
  async testPatientViewHooks(patientId) {
    
    
    try {
      // Get patient data for context
      const patient = await fhirClient.read('Patient', patientId);
      

      // Get available services
      const services = await cdsHooksClient.discoverServices();
      const patientViewServices = services.filter(s => s.hook === 'patient-view');
      
      

      const results = [];

      for (const service of patientViewServices) {
        
        
        const startTime = Date.now();
        
        try {
          const context = {
            hook: 'patient-view',
            hookInstance: `test-${Date.now()}`,
            context: {
              patientId: patientId
            }
          };

          const response = await cdsHooksClient.callService(service.id, context);
          const endTime = Date.now();
          const executionTime = endTime - startTime;

          const result = {
            serviceId: service.id,
            serviceName: service.title || service.id,
            patientId,
            success: true,
            executionTime,
            cardCount: response.cards?.length || 0,
            cards: response.cards || [],
            timestamp: new Date()
          };

          results.push(result);
          
          // Test successful
          
          if (result.cards.length > 0) {
            result.cards.forEach((card, index) => {
              // Processing card
            });
          }

        } catch (error) {
          const result = {
            serviceId: service.id,
            serviceName: service.title || service.id,
            patientId,
            success: false,
            error: error.message,
            timestamp: new Date()
          };

          results.push(result);
          
        }
      }

      this.testResults.push({
        patientId,
        hook: 'patient-view',
        timestamp: new Date(),
        results
      });

      return results;

    } catch (error) {
      
      return [];
    }
  }

  /**
   * Test medication-prescribe hooks with sample medication
   */
  async testMedicationPrescribeHooks(patientId, medicationName = 'Lisinopril') {
    
    
    
    try {
      const services = await cdsHooksClient.discoverServices();
      const medicationServices = services.filter(s => s.hook === 'medication-prescribe');
      
      

      const results = [];

      for (const service of medicationServices) {
        
        
        const startTime = Date.now();
        
        try {
          const context = {
            hook: 'medication-prescribe',
            hookInstance: `test-${Date.now()}`,
            context: {
              patientId: patientId,
              medications: {
                new: [{
                  resourceType: 'MedicationRequest',
                  medicationCodeableConcept: {
                    text: medicationName,
                    coding: [{
                      system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
                      code: '29046',
                      display: medicationName
                    }]
                  }
                }]
              }
            }
          };

          const response = await cdsHooksClient.callService(service.id, context);
          const endTime = Date.now();
          const executionTime = endTime - startTime;

          const result = {
            serviceId: service.id,
            serviceName: service.title || service.id,
            patientId,
            medication: medicationName,
            success: true,
            executionTime,
            cardCount: response.cards?.length || 0,
            cards: response.cards || [],
            timestamp: new Date()
          };

          results.push(result);
          
          // Summary generated
          
          if (result.cards.length > 0) {
            result.cards.forEach((card, index) => {
              // Processing card details
              if (card.detail) {
                // Card has detail
              }
            });
          }

        } catch (error) {
          const result = {
            serviceId: service.id,
            serviceName: service.title || service.id,
            patientId,
            medication: medicationName,
            success: false,
            error: error.message,
            timestamp: new Date()
          };

          results.push(result);
          
        }
      }

      return results;

    } catch (error) {
      
      return [];
    }
  }

  /**
   * Get available patients for testing
   */
  async getTestPatients(limit = 10) {
    try {
      const response = await fhirClient.search('Patient', { _count: limit });
      return response.resources || [];
    } catch (error) {
      
      return [];
    }
  }

  /**
   * Run comprehensive CDS hooks test suite
   */
  async runTestSuite() {
    // Starting test suite

    try {
      // Get test patients
      const patients = await this.getTestPatients(5);
      

      const allResults = [];

      for (const patient of patients) {
        // Testing patient

        // Test patient-view hooks
        const patientViewResults = await this.testPatientViewHooks(patient.id);
        allResults.push(...patientViewResults);

        // Test medication-prescribe hooks with common medications
        const testMedications = ['Lisinopril', 'Metformin', 'Aspirin'];
        for (const medication of testMedications) {
          const medicationResults = await this.testMedicationPrescribeHooks(patient.id, medication);
          allResults.push(...medicationResults);
        }

        // Small delay between patients
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Summary
      // Test suite completed
      
      // Total results: allResults.length
      // Successful tests: allResults.filter(r => r.success).length
      // Total cards: allResults.reduce((sum, r) => sum + (r.cardCount || 0), 0)
      // Average execution time: allResults.reduce((sum, r) => sum + (r.executionTime || 0), 0) / allResults.length

      return {
        totalTests: allResults.length,
        successful: allResults.filter(r => r.success).length,
        failed: allResults.filter(r => !r.success).length,
        totalCards: allResults.reduce((sum, r) => sum + (r.cardCount || 0), 0),
        results: allResults
      };

    } catch (error) {
      
      return null;
    }
  }

  /**
   * Get test results
   */
  getTestResults() {
    return this.testResults;
  }

  /**
   * Clear test results
   */
  clearTestResults() {
    this.testResults = [];
  }
}

// Export singleton instance
export const cdsHooksTester = new CDSHooksTester();

// Export class for custom instances
export default CDSHooksTester;