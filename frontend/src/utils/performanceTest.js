/**
 * Performance Testing Utility
 * Tests the FHIR API performance improvements
 */

import { fhirClient } from '../core/fhir/services/fhirClient';

class PerformanceTest {
  constructor() {
    this.results = [];
    this.patientId = null;
  }

  // Measure API call performance
  async measureApiCall(name, apiCall) {
    const startTime = performance.now();
    let result = null;
    let error = null;
    let resourceCount = 0;
    let dataSize = 0;

    try {
      result = await apiCall();
      
      // Count resources
      if (result.resources) {
        resourceCount = result.resources.length;
      } else if (result.entry) {
        resourceCount = result.entry.length;
      } else if (Array.isArray(result)) {
        resourceCount = result.length;
      } else if (result.id) {
        resourceCount = 1;
      }

      // Estimate data size (rough approximation)
      dataSize = JSON.stringify(result).length;
    } catch (err) {
      error = err.message;
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    const testResult = {
      name,
      duration: Math.round(duration),
      resourceCount,
      dataSize,
      dataSizeKB: Math.round(dataSize / 1024),
      success: !error,
      error
    };

    this.results.push(testResult);
    return testResult;
  }

  // Get a test patient ID
  async getTestPatient() {
    try {
      const result = await fhirClient.search('Patient', { 
        _count: 1,
        _sort: '-_lastUpdated'
      });
      
      if (result.resources && result.resources.length > 0) {
        this.patientId = result.resources[0].id;
        return this.patientId;
      }
      throw new Error('No patients found');
    } catch (error) {
      console.error('Failed to get test patient:', error);
      throw error;
    }
  }

  // Run all tests
  async runAllTests() {
    console.log('🧪 Starting Performance Tests...');
    console.log('================================');
    
    try {
      // Get test patient
      await this.getTestPatient();
      console.log(`✅ Using test patient: ${this.patientId}`);
      console.log('');

      // Test individual optimized methods
      console.log('📊 Testing Optimized FHIR Client Methods:');
      console.log('-----------------------------------------');

      await this.measureApiCall('getObservations (limit 50)', 
        () => fhirClient.getObservations(this.patientId));

      await this.measureApiCall('getVitalSigns (limit 50)', 
        () => fhirClient.getVitalSigns(this.patientId));

      await this.measureApiCall('getMedications (limit 50)', 
        () => fhirClient.getMedications(this.patientId));

      await this.measureApiCall('getConditions (limit 50)', 
        () => fhirClient.getConditions(this.patientId));

      await this.measureApiCall('getEncounters (limit 20)', 
        () => fhirClient.getEncounters(this.patientId));

      await this.measureApiCall('getAllergies (limit 50)', 
        () => fhirClient.getAllergies(this.patientId));

      // Test with _summary parameter
      console.log('\n📊 Testing _summary Parameter:');
      console.log('------------------------------');

      await this.measureApiCall('Encounters with _summary', 
        () => fhirClient.search('Encounter', { 
          patient: this.patientId, 
          _count: 100,
          _summary: 'true'
        }));

      await this.measureApiCall('Encounters without _summary', 
        () => fhirClient.search('Encounter', { 
          patient: this.patientId, 
          _count: 100
        }));

      await this.measureApiCall('MedicationRequests with _summary', 
        () => fhirClient.search('MedicationRequest', { 
          patient: this.patientId,
          _count: 50,
          _summary: 'true'
        }));

      await this.measureApiCall('MedicationRequests without _summary', 
        () => fhirClient.search('MedicationRequest', { 
          patient: this.patientId,
          _count: 50
        }));

      // Test parallel loading simulation
      console.log('\n📊 Testing Parallel Loading:');
      console.log('----------------------------');

      await this.measureApiCall('Parallel: 5 resource types', async () => {
        const promises = [
          fhirClient.getConditions(this.patientId),
          fhirClient.getMedications(this.patientId),
          fhirClient.getObservations(this.patientId),
          fhirClient.getEncounters(this.patientId),
          fhirClient.getAllergies(this.patientId)
        ];
        const results = await Promise.all(promises);
        return { 
          resources: results.flatMap(r => r.resources || []),
          totalCalls: promises.length
        };
      });

      // Compare with old approach (simulated)
      console.log('\n📊 Comparing with Old Approach (1000 limit):');
      console.log('--------------------------------------------');

      await this.measureApiCall('OLD: Observations (limit 1000)', 
        () => fhirClient.search('Observation', { 
          patient: this.patientId, 
          _count: 1000 
        }));

      await this.measureApiCall('NEW: Observations (limit 50)', 
        () => fhirClient.search('Observation', { 
          patient: this.patientId, 
          _count: 50 
        }));

      // Print summary
      this.printSummary();

    } catch (error) {
      console.error('❌ Test failed:', error);
    }
  }

  // Print test summary
  printSummary() {
    console.log('\n\n📈 PERFORMANCE TEST SUMMARY');
    console.log('===========================\n');

    // Calculate averages
    const successfulTests = this.results.filter(r => r.success);
    const avgDuration = successfulTests.reduce((sum, r) => sum + r.duration, 0) / successfulTests.length;
    const totalDataSize = successfulTests.reduce((sum, r) => sum + r.dataSizeKB, 0);

    console.log('📊 Overall Metrics:');
    console.log(`  • Total tests run: ${this.results.length}`);
    console.log(`  • Successful tests: ${successfulTests.length}`);
    console.log(`  • Average duration: ${Math.round(avgDuration)}ms`);
    console.log(`  • Total data transferred: ${totalDataSize}KB`);
    console.log('');

    console.log('📋 Detailed Results:');
    console.log('Test Name                                | Duration | Resources | Data Size');
    console.log('----------------------------------------------------------------------');
    
    this.results.forEach(result => {
      const name = result.name.padEnd(40);
      const duration = result.success ? `${result.duration}ms`.padEnd(8) : 'FAILED'.padEnd(8);
      const resources = result.success ? result.resourceCount.toString().padEnd(9) : '-'.padEnd(9);
      const dataSize = result.success ? `${result.dataSizeKB}KB` : '-';
      
      console.log(`${name} | ${duration} | ${resources} | ${dataSize}`);
    });

    // Calculate improvements
    const oldObs = this.results.find(r => r.name.includes('OLD: Observations'));
    const newObs = this.results.find(r => r.name.includes('NEW: Observations'));
    
    if (oldObs && newObs && oldObs.success && newObs.success) {
      console.log('\n🎯 Performance Improvements:');
      const timeSaving = Math.round(((oldObs.duration - newObs.duration) / oldObs.duration) * 100);
      const dataSaving = Math.round(((oldObs.dataSizeKB - newObs.dataSizeKB) / oldObs.dataSizeKB) * 100);
      
      console.log(`  • Time saved: ${timeSaving}% (${oldObs.duration}ms → ${newObs.duration}ms)`);
      console.log(`  • Data saved: ${dataSaving}% (${oldObs.dataSizeKB}KB → ${newObs.dataSizeKB}KB)`);
      console.log(`  • Resources: ${oldObs.resourceCount} → ${newObs.resourceCount}`);
    }

    // Check _summary impact
    const withSummary = this.results.filter(r => r.name.includes('with _summary') && r.success);
    const withoutSummary = this.results.filter(r => r.name.includes('without _summary') && r.success);
    
    if (withSummary.length > 0 && withoutSummary.length > 0) {
      console.log('\n📉 _summary Parameter Impact:');
      withSummary.forEach(summaryTest => {
        const baseName = summaryTest.name.replace(' with _summary', '');
        const noSummaryTest = withoutSummary.find(t => t.name.includes(baseName));
        
        if (noSummaryTest) {
          const dataSaving = Math.round(((noSummaryTest.dataSizeKB - summaryTest.dataSizeKB) / noSummaryTest.dataSizeKB) * 100);
          console.log(`  • ${baseName}: ${dataSaving}% data reduction (${noSummaryTest.dataSizeKB}KB → ${summaryTest.dataSizeKB}KB)`);
        }
      });
    }

    console.log('\n✅ Performance testing completed!');
  }
}

// Export for use in console
window.PerformanceTest = PerformanceTest;

// Auto-run if called directly
if (typeof window !== 'undefined' && window.location.pathname.includes('test')) {
  const tester = new PerformanceTest();
  tester.runAllTests();
}

export default PerformanceTest;