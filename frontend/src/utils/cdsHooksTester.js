/**
 * CDS Hooks Testing Utility
 * Provides functions to test CDS hooks with real patient data
 */
import { cdsHooksClient } from '../services/cdsHooksClient';
import { fhirClient } from '../services/fhirClient';

class CDSHooksTester {
  constructor() {
    this.testResults = [];
  }

  /**
   * Test all patient-view hooks for a specific patient
   */
  async testPatientViewHooks(patientId) {
    console.log(`🔍 Testing patient-view hooks for patient: ${patientId}`);
    
    try {
      // Get patient data for context
      const patient = await fhirClient.read('Patient', patientId);
      console.log(`👤 Patient: ${patient.name?.[0]?.given?.[0]} ${patient.name?.[0]?.family}`);

      // Get available services
      const services = await cdsHooksClient.discoverServices();
      const patientViewServices = services.filter(s => s.hook === 'patient-view');
      
      console.log(`🔗 Found ${patientViewServices.length} patient-view services`);

      const results = [];

      for (const service of patientViewServices) {
        console.log(`\n🧪 Testing service: ${service.title || service.id}`);
        
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
          
          console.log(`✅ Success: ${result.cardCount} cards generated (${executionTime}ms)`);
          
          if (result.cards.length > 0) {
            result.cards.forEach((card, index) => {
              console.log(`   📋 Card ${index + 1}: ${card.summary} (${card.indicator})`);
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
          console.log(`❌ Failed: ${error.message}`);
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
      console.error(`💥 Error testing patient ${patientId}:`, error);
      return [];
    }
  }

  /**
   * Test medication-prescribe hooks with sample medication
   */
  async testMedicationPrescribeHooks(patientId, medicationName = 'Lisinopril') {
    console.log(`💊 Testing medication-prescribe hooks for patient: ${patientId}`);
    console.log(`💊 Test medication: ${medicationName}`);
    
    try {
      const services = await cdsHooksClient.discoverServices();
      const medicationServices = services.filter(s => s.hook === 'medication-prescribe');
      
      console.log(`🔗 Found ${medicationServices.length} medication-prescribe services`);

      const results = [];

      for (const service of medicationServices) {
        console.log(`\n🧪 Testing service: ${service.title || service.id}`);
        
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
          
          console.log(`✅ Success: ${result.cardCount} cards generated (${executionTime}ms)`);
          
          if (result.cards.length > 0) {
            result.cards.forEach((card, index) => {
              console.log(`   📋 Card ${index + 1}: ${card.summary} (${card.indicator})`);
              if (card.detail) {
                console.log(`      Details: ${card.detail}`);
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
          console.log(`❌ Failed: ${error.message}`);
        }
      }

      return results;

    } catch (error) {
      console.error(`💥 Error testing medication prescribe for patient ${patientId}:`, error);
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
      console.error('Error getting test patients:', error);
      return [];
    }
  }

  /**
   * Run comprehensive CDS hooks test suite
   */
  async runTestSuite() {
    console.log(`🚀 Starting CDS Hooks Test Suite`);
    console.log(`📅 ${new Date().toISOString()}`);
    console.log(`${'='.repeat(50)}`);

    try {
      // Get test patients
      const patients = await this.getTestPatients(5);
      console.log(`👥 Testing with ${patients.length} patients\n`);

      const allResults = [];

      for (const patient of patients) {
        console.log(`\n${'='.repeat(30)}`);
        console.log(`Testing Patient: ${patient.id}`);
        console.log(`${'='.repeat(30)}`);

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
      console.log(`\n${'='.repeat(50)}`);
      console.log(`📊 TEST SUITE SUMMARY`);
      console.log(`${'='.repeat(50)}`);
      console.log(`Total tests: ${allResults.length}`);
      console.log(`Successful: ${allResults.filter(r => r.success).length}`);
      console.log(`Failed: ${allResults.filter(r => !r.success).length}`);
      console.log(`Cards generated: ${allResults.reduce((sum, r) => sum + (r.cardCount || 0), 0)}`);
      console.log(`Average execution time: ${Math.round(allResults.reduce((sum, r) => sum + (r.executionTime || 0), 0) / allResults.length)}ms`);

      return {
        totalTests: allResults.length,
        successful: allResults.filter(r => r.success).length,
        failed: allResults.filter(r => !r.success).length,
        totalCards: allResults.reduce((sum, r) => sum + (r.cardCount || 0), 0),
        results: allResults
      };

    } catch (error) {
      console.error(`💥 Test suite failed:`, error);
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