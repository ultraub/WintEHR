# Enhanced FHIR Client for WintEHR

## Overview

The Enhanced FHIR Client is a TypeScript-based, feature-rich client for interacting with FHIR R4 servers. It provides advanced capabilities including request/response interceptors, automatic retry logic, smart caching, request queuing, and batch operations.

**Key Features:**
- 🔒 Full TypeScript support with FHIR R4 types
- 🔄 Automatic retry with exponential backoff
- 💾 Smart caching with TTL configuration
- 📊 Request queuing and rate limiting
- 🚀 Batch operations support
- 🔍 Built-in critical value detection
- 📈 Performance-optimized endpoints
- 🎯 Request/response interceptors
- 🔔 Integrated notification system

## Installation & Setup

The enhanced FHIR client is already integrated into the WintEHR frontend. To use it:

```typescript
import { fhirClient } from '@/core/fhir/services/fhirClient';
import type { Patient, Condition, MedicationRequest } from '@/core/fhir/types';
```

## Configuration

### Default Configuration

The client comes with sensible defaults:

```typescript
{
  baseUrl: '/fhir/R4',
  cache: {
    enabled: true,
    defaultTTL: 5 * 60 * 1000, // 5 minutes
    maxSize: 200
  },
  queue: {
    maxConcurrent: 5,
    requestsPerSecond: 20,
    retryAttempts: 3,
    retryDelay: 1000,
    retryMultiplier: 2,
    maxRetryDelay: 10000
  }
}
```

### Custom Configuration

Create a custom instance with specific settings:

```typescript
import FHIRClient from '@/core/fhir/services/fhirClient';

const customClient = new FHIRClient({
  baseUrl: 'https://api.example.com/fhir/R4',
  auth: {
    token: 'your-auth-token',
    type: 'Bearer'
  },
  cache: {
    enabled: true,
    defaultTTL: 10 * 60 * 1000, // 10 minutes
    maxSize: 500
  },
  queue: {
    maxConcurrent: 10,
    requestsPerSecond: 50
  }
});
```

## Basic Usage

### CRUD Operations

```typescript
// Create a resource
const newPatient = await fhirClient.create<Patient>('Patient', {
  resourceType: 'Patient',
  name: [{ family: 'Smith', given: ['John'] }],
  gender: 'male',
  birthDate: '1990-01-01'
});

// Read a resource
const patient = await fhirClient.read<Patient>('Patient', '123');

// Update a resource
const updatedPatient = await fhirClient.update<Patient>('Patient', '123', {
  ...patient,
  active: true
});

// Delete a resource
await fhirClient.delete('Patient', '123');
```

### Search Operations

```typescript
// Basic search
const conditions = await fhirClient.search<Condition>('Condition', {
  patient: 'Patient/123',
  'clinical-status': 'active',
  _sort: '-onset-date',
  _count: 50
});

// Search with includes
const encounters = await fhirClient.search<Encounter>('Encounter', {
  patient: 'Patient/123',
  _include: 'Encounter:practitioner',
  _revinclude: 'Observation:encounter'
});
```

### Convenience Methods

```typescript
// Get patient
const patient = await fhirClient.getPatient('123');

// Get vital signs
const vitals = await fhirClient.getVitalSigns('Patient/123', 100);

// Get lab results
const labs = await fhirClient.getLabResults('Patient/123', 50);

// Get medications
const meds = await fhirClient.getMedications('Patient/123', 'active');

// Get conditions
const conditions = await fhirClient.getConditions('Patient/123', 'active');

// Get encounters
const encounters = await fhirClient.getEncounters('Patient/123', 'finished');

// Get allergies
const allergies = await fhirClient.getAllergies('Patient/123');
```

## Advanced Features

### Batch Operations

```typescript
// Batch update multiple resources
const resources = [patient1, patient2, patient3];
const results = await fhirClient.batchUpdate(resources);

results.forEach((result, index) => {
  if (result.success) {
    console.log(`Resource ${index} updated successfully`);
  } else {
    console.error(`Resource ${index} failed:`, result.error);
  }
});

// Batch create
const newResources = [newCondition1, newCondition2];
const createResults = await fhirClient.batchCreate(newResources);

// Custom batch requests
const batchRequests = [
  { method: 'GET', url: 'Patient/123' },
  { method: 'POST', url: 'Observation', resource: newObservation },
  { method: 'DELETE', url: 'AllergyIntolerance/456' }
];
const batchResults = await fhirClient.batch(batchRequests);
```

### Transaction Bundle

```typescript
const transactionBundle: Bundle = {
  resourceType: 'Bundle',
  type: 'transaction',
  entry: [
    {
      request: { method: 'POST', url: 'Patient' },
      resource: newPatient
    },
    {
      request: { method: 'PUT', url: 'Condition/123' },
      resource: updatedCondition
    }
  ]
};

const result = await fhirClient.transaction(transactionBundle);
```

### Critical Value Detection

```typescript
// Search for critical lab values
const criticalValues = await fhirClient.searchCriticalLabValues(
  'Patient/123',
  '24h' // or '7d', '30d'
);

criticalValues.forEach(({ definition, results, count }) => {
  console.log(`${definition.name}: ${count} critical values`);
  results.forEach(obs => {
    console.log(`- ${obs.valueQuantity?.value} ${obs.valueQuantity?.unit}`);
  });
});
```

### Performance-Optimized Endpoints

```typescript
// Get optimized patient bundle
const bundle = await fhirClient.getPatientBundleOptimized('123', {
  resourceTypes: ['Condition', 'MedicationRequest', 'Observation'],
  priority: 'critical', // or 'all'
  limit: 100
});

// Get patient timeline
const timeline = await fhirClient.getPatientTimelineOptimized('123', {
  days: 30,
  limit: 50,
  resourceTypes: ['Encounter', 'Procedure', 'Observation']
});

// Get patient summary
const summary = await fhirClient.getPatientSummaryOptimized('123');
```

### Interceptors

```typescript
// Add request interceptor
fhirClient.addRequestInterceptor((config) => {
  console.log(`Making request to: ${config.url}`);
  
  // Add custom headers
  config.headers['X-Custom-Header'] = 'value';
  
  return config;
});

// Add response interceptor
fhirClient.addResponseInterceptor((response) => {
  console.log(`Response received: ${response.status}`);
  
  // Track metrics
  if (window.performance) {
    performance.mark(`fhir-response-${response.config.url}`);
  }
  
  return response;
});

// Add error interceptor
fhirClient.addErrorInterceptor(async (error) => {
  if (error.response?.status === 401) {
    // Refresh token logic
    const newToken = await refreshAuthToken();
    error.config.headers.Authorization = `Bearer ${newToken}`;
    return fhirClient.request(error.config);
  }
  
  return Promise.reject(error);
});
```

### Cache Management

```typescript
// Clear all cache
fhirClient.clearCache();

// Clear cache by pattern
fhirClient.clearCache('Patient.*'); // Clear all Patient resources
fhirClient.clearCache('Observation\\?.*'); // Clear all Observation searches

// Prefetch common resources
await fhirClient.prefetchCommonResources('Patient/123');
```

## Error Handling

The client provides enhanced error messages and automatic error notifications:

```typescript
try {
  const patient = await fhirClient.getPatient('invalid-id');
} catch (error) {
  // Error is automatically logged and user is notified
  // Error types:
  // - 400: FHIR Validation Error
  // - 401: Unauthorized - redirects to login
  // - 403: Forbidden - shows permission error
  // - 404: Resource not found
  // - 422: Validation error with OperationOutcome
  // - 500+: Server errors with retry
}
```

## Helper Methods

```typescript
// Build a reference
const ref = FHIRClient.reference('Patient', '123', 'John Doe');
// Result: { reference: 'Patient/123', display: 'John Doe' }

// Extract ID from reference
const id1 = FHIRClient.extractId('Patient/123'); // '123'
const id2 = FHIRClient.extractId({ reference: 'Patient/123' }); // '123'
const id3 = FHIRClient.extractId('http://example.com/fhir/Patient/123'); // '123'
```

## Migration Guide

### From Old fhirService

```javascript
// Old
import { fhirService } from '@/services/fhirService';
const patient = await fhirService.getPatient(patientId);

// New
import { fhirClient } from '@/core/fhir/services/fhirClient';
import type { Patient } from '@/core/fhir/types';
const patient: Patient = await fhirClient.getPatient(patientId);
```

### Key Differences

1. **TypeScript Support**: Full type safety and autocomplete
2. **Built-in Caching**: Automatic caching with configurable TTL
3. **Retry Logic**: Automatic retry on failures
4. **Better Error Handling**: Integrated notifications
5. **Performance**: Request queuing and rate limiting
6. **Batch Operations**: Native support for batch and transaction bundles

## Best Practices

1. **Use TypeScript Types**: Import and use proper FHIR types for type safety
2. **Handle Errors**: Errors are automatically notified, but still handle them in your logic
3. **Leverage Caching**: Use default caching for read operations
4. **Batch When Possible**: Use batch operations for multiple updates
5. **Monitor Performance**: Use interceptors to track performance
6. **Clear Cache After Updates**: Cache is automatically cleared, but you can manually clear if needed

## Testing

```typescript
import { fhirClient } from '@/core/fhir/services/fhirClient';
import { renderHook } from '@testing-library/react-hooks';

// Mock the client
jest.mock('@/core/fhir/services/fhirClient');

// In your tests
beforeEach(() => {
  (fhirClient.getPatient as jest.Mock).mockResolvedValue({
    resourceType: 'Patient',
    id: '123',
    name: [{ family: 'Test', given: ['Patient'] }]
  });
});
```

## Performance Considerations

- **Caching**: Reduces server load and improves response times
- **Request Queuing**: Prevents overwhelming the server
- **Batch Operations**: Reduces network overhead
- **Optimized Endpoints**: Use backend-optimized endpoints when available
- **Virtual Scrolling**: For large result sets, implement virtual scrolling in UI

## Troubleshooting

### Cache Issues
```typescript
// If data seems stale
fhirClient.clearCache();

// Check cache usage
console.log('Cache cleared for fresh data');
```

### Network Issues
```typescript
// Automatic retry handles transient failures
// For persistent issues, check:
// 1. Network connectivity
// 2. FHIR server status
// 3. Authentication token validity
```

### Performance Issues
```typescript
// Use performance monitoring
const start = performance.now();
const result = await fhirClient.search('Observation', params);
console.log(`Search took ${performance.now() - start}ms`);

// Adjust queue settings if needed
// Reduce concurrent requests or requests per second
```

## Support

For issues or questions:
1. Check the console for detailed error messages
2. Review network tab for failed requests
3. Verify FHIR server is accessible
4. Check authentication status
5. Review this documentation

---

**Note**: This client is optimized for WintEHR's specific use cases and FHIR R4 compliance. Always test with real Synthea data in development.