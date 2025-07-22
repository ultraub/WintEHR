/**
 * Migration Example: Using Enhanced FHIR Client
 * 
 * This file demonstrates how to migrate components from the old
 * fhirService/fhirClient to the new TypeScript-enhanced version.
 * 
 * @since 2025-01-21
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Box, CircularProgress, Alert } from '@mui/material';

// NEW: Import from TypeScript files with proper types
import FHIRClient, { fhirClient } from '../services/fhirClient';
import { notificationService } from '../../../services/notificationService';
import type { Patient, Observation, SearchResult } from '../types';

// Example 1: Basic Component Migration
const VitalsExample: React.FC<{ patientId: string }> = ({ patientId }) => {
  const [vitals, setVitals] = useState<Observation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchVitals = async () => {
      try {
        setLoading(true);
        setError(null);

        // NEW: TypeScript types provide autocomplete and type safety
        const result: SearchResult<Observation> = await fhirClient.getVitalSigns(
          patientId,
          20 // limit
        );

        setVitals(result.resources);
        
        // NEW: Use notification service for success feedback
        notificationService.fhirSuccess('Loaded', 'Vital Signs', patientId);
      } catch (err) {
        setError(err as Error);
        
        // NEW: FHIR-specific error handling
        notificationService.fhirError(err, {
          operation: 'FETCH',
          resourceType: 'Observation',
          details: 'Failed to load vital signs'
        });
      } finally {
        setLoading(false);
      }
    };

    fetchVitals();
  }, [patientId]);

  if (loading) return <CircularProgress />;
  if (error) return <Alert severity="error">{error.message}</Alert>;

  return (
    <Box>
      {vitals.map(vital => (
        <div key={vital.id}>
          {/* TypeScript ensures proper property access */}
          {vital.code.text || vital.code.coding?.[0]?.display}
        </div>
      ))}
    </Box>
  );
};

// Example 2: Advanced Features - Caching and Interceptors
const PatientHeaderExample: React.FC<{ patientId: string }> = ({ patientId }) => {
  const [patient, setPatient] = useState<Patient | null>(null);

  useEffect(() => {
    const loadPatient = async () => {
      try {
        // This will use cache if available (5-minute TTL by default)
        const patient = await fhirClient.getPatient(patientId);
        setPatient(patient);
      } catch (err) {
        // Error interceptor already shows notification
        console.error('Failed to load patient:', err);
      }
    };

    loadPatient();

    // Prefetch related resources in background
    const commonResources = [
      { resourceType: 'Condition' as const, params: { patient: patientId } },
      { resourceType: 'MedicationRequest' as const, params: { patient: patientId } },
      { resourceType: 'Observation' as const, params: { patient: patientId } }
    ];
    fhirClient.prefetchResources(commonResources).catch(console.error);
  }, [patientId]);

  // Clear cache when patient data is updated
  const handlePatientUpdate = useCallback(async (updatedPatient: Patient) => {
    try {
      const result = await fhirClient.update('Patient', patientId, updatedPatient);
      setPatient(result);
      
      // Cache is automatically cleared on update
      notificationService.fhirSuccess('Updated', 'Patient', patientId);
    } catch (err) {
      notificationService.fhirError(err);
    }
  }, [patientId]);

  return patient ? (
    <div>
      {patient.name?.[0]?.given?.join(' ')} {patient.name?.[0]?.family}
    </div>
  ) : null;
};

// Example 3: Batch Operations
const BatchUpdateExample: React.FC = () => {
  const handleBatchUpdate = async (resources: any[]) => {
    const loadingId = notificationService.loading('Processing batch update...');

    try {
      const results = await fhirClient.batchUpdate(resources);
      
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      notificationService.updateSuccess(
        loadingId,
        `Batch complete: ${successCount} succeeded, ${failureCount} failed`
      );

      // Handle individual failures
      results.forEach((result, index) => {
        if (!result.success && result.error) {
          console.error(`Failed to update resource ${index}:`, result.error);
        }
      });
    } catch (err) {
      notificationService.updateError(loadingId, err as Error);
    }
  };

  return null; // Implementation details
};

// Example 4: Advanced Search with Critical Value Detection
const CriticalLabsExample: React.FC<{ patientId: string }> = ({ patientId }) => {
  const [criticalLabs, setCriticalLabs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkCriticalValues = async () => {
      try {
        setLoading(true);
        
        // NEW: Built-in critical value search
        const critical = await fhirClient.searchCriticalLabValues(
          patientId,
          '24h' // timeframe
        );

        if (critical.length > 0) {
          setCriticalLabs(critical);
          
          // Alert for critical values
          notificationService.warning(
            `Found ${critical.length} critical lab values in the last 24 hours`,
            { persistent: true }
          );
        }
      } catch (err) {
        notificationService.error('Failed to check critical values');
      } finally {
        setLoading(false);
      }
    };

    checkCriticalValues();
  }, [patientId]);

  return (
    <Box>
      {criticalLabs.map((item, index) => (
        <Alert key={index} severity="error">
          {item.definition.name}: {item.count} critical result(s)
        </Alert>
      ))}
    </Box>
  );
};

// Example 5: Performance-Optimized Endpoints
const OptimizedDataFetch: React.FC<{ patientId: string }> = ({ patientId }) => {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const fetchOptimized = async () => {
      try {
        // NEW: Use optimized backend endpoints
        const [bundle, timeline, summary] = await Promise.all([
          fhirClient.getPatientBundleOptimized(patientId, {
            resourceTypes: ['Condition', 'MedicationRequest', 'Observation'],
            priority: 'critical',
            limit: 50
          }),
          fhirClient.getPatientTimelineOptimized(patientId, {
            days: 30,
            resourceTypes: ['Encounter', 'Procedure']
          }),
          fhirClient.getPatientSummaryOptimized(patientId)
        ]);

        setData({ bundle, timeline, summary });
      } catch (err) {
        notificationService.error('Failed to load patient data');
      }
    };

    fetchOptimized();
  }, [patientId]);

  return null; // Implementation details
};

// Example 6: Custom Interceptors
const setupCustomInterceptors = () => {
  // Add performance tracking
  fhirClient.addRequestInterceptor((config) => {
    // Store metadata on the config object
    (config as any).metadata = { startTime: Date.now() };
    return config;
  });

  fhirClient.addResponseInterceptor((response) => {
    const duration = Date.now() - (response.config as any).metadata?.startTime;
    console.log(`Request took ${duration}ms`);
    return response;
  });

  // Add custom error handling
  fhirClient.addErrorInterceptor(async (error) => {
    if (error.response?.status === 401) {
      // Handle authentication errors
      window.location.href = '/login';
    }
    return Promise.reject(error);
  });
};

// Example 7: Reference Handling
const ReferenceExample = () => {
  // Build references with proper types
  const patientRef = FHIRClient.reference('Patient', '123', 'John Doe');
  
  // Extract IDs from various reference formats
  const id1 = FHIRClient.extractId('Patient/123');
  const id2 = FHIRClient.extractId({ reference: 'Patient/123' });
  const id3 = FHIRClient.extractId('http://example.com/fhir/Patient/123');

  return null;
};

// Export examples
export {
  VitalsExample,
  PatientHeaderExample,
  BatchUpdateExample,
  CriticalLabsExample,
  OptimizedDataFetch,
  setupCustomInterceptors,
  ReferenceExample
};