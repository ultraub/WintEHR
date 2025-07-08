# Services Module

## Overview
The Services Module provides the core business logic layer for MedGenEMR, encapsulating all API interactions, data transformations, and external service integrations. This module demonstrates clean architecture principles with clear separation of concerns.

## Architecture
```
Services Module
├── fhirService.js (Core FHIR operations)
├── searchService.js (Clinical catalog search)
├── pharmacyService.js (Medication workflows)
├── dicomService.js (Medical imaging)
├── authService.js (Authentication)
└── api.js (Base HTTP client)
```

## Core Services

### fhirService.js
**Purpose**: Centralized FHIR R4 API operations with caching and error handling

**Key Methods**:
```javascript
// Resource CRUD operations
getPatient(patientId)
createCondition(conditionData)
updateMedicationRequest(id, updates)
deleteProblem(conditionId)

// Bulk operations
getPatientResources(patientId)
refreshPatientResources(patientId)

// Search operations
searchConditions(params)
searchMedications(params)

// Specialized workflows
getMedicationHistory(patientId)
getActiveProblems(patientId)
getRecentEncounters(patientId)
```

**Features**:
- Automatic bearer token injection
- Response transformation
- Error standardization
- Resource caching
- Retry logic for failed requests

### searchService.js
**Purpose**: Clinical catalog search with multiple data sources

**Key Methods**:
```javascript
// Condition searches
searchConditions(query, limit)
searchSNOMED(query)
searchICD10(query)

// Medication searches  
searchMedications(query, limit)
searchRxNorm(query)
searchNDC(query)

// Lab searches
searchLabs(query, limit)
searchLOINC(query)

// Universal search
searchAll(query, limit)
```

**Features**:
- Multi-source aggregation
- Result ranking/scoring
- Fuzzy matching
- Cache layer for common searches
- Fallback strategies

### pharmacyService.js
**Purpose**: Medication dispensing and pharmacy workflows

**Key Methods**:
```javascript
// Dispensing workflow
getPendingPrescriptions()
dispenseMedication(dispensingData)
updateDispenseStatus(dispenseId, status)

// Verification
verifyPrescription(rxId)
checkInsurance(patientId, medicationId)
calculateCopay(prescription)

// Inventory (placeholder)
checkStock(medicationId)
adjustInventory(medicationId, quantity)
```

**Features**:
- MedicationDispense FHIR resource creation
- Workflow state management
- Insurance verification stubs
- Dispensing history tracking
- Queue management

### dicomService.js
**Purpose**: Medical imaging data management

**Key Methods**:
```javascript
// Study management
getStudies(patientId)
getStudyMetadata(studyId)
getSeriesMetadata(studyId, seriesId)

// Image retrieval
getImageUrl(studyId, seriesId, instanceId)
getImageMetadata(instanceIds)
downloadStudy(studyId)

// Viewer support
getViewerConfig(studyId)
saveViewerState(studyId, state)
```

**Features**:
- WADO-RS endpoint integration
- Image caching strategies
- Metadata parsing
- Multi-frame support
- Viewer state persistence

### authService.js
**Purpose**: Authentication and authorization

**Key Methods**:
```javascript
// Authentication
login(credentials)
logout()
refreshToken()
validateSession()

// User management
getCurrentUser()
getUserPermissions()
hasPermission(resource, action)

// Role-based access
getRoles()
checkRole(requiredRole)
```

**Features**:
- Dual-mode authentication (simple/JWT)
- Token management
- Permission checking
- Session persistence
- Role-based access control

## Shared Patterns

### API Client Configuration
```javascript
// Base configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// Request interceptor
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      // Handle unauthorized
    }
    return Promise.reject(error);
  }
);
```

### Error Handling Pattern
```javascript
class ServiceError extends Error {
  constructor(message, code, details) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

// Consistent error handling
try {
  const response = await api.get(endpoint);
  return response.data;
} catch (error) {
  throw new ServiceError(
    error.response?.data?.message || 'Service error',
    error.response?.status || 500,
    error.response?.data
  );
}
```

### Caching Strategy
```javascript
// Simple in-memory cache
const cache = new Map();

const getCached = async (key, fetcher, ttl = 300000) => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data;
  }
  
  const data = await fetcher();
  cache.set(key, { data, timestamp: Date.now() });
  return data;
};
```

## Integration Points

### Backend APIs
- FHIR R4 endpoints: `/fhir/R4/*`
- Clinical catalogs: `/api/emr/clinical/catalog/*`
- Pharmacy workflows: `/api/pharmacy/*`
- DICOM services: `/api/dicom/*`
- Authentication: `/api/auth/*`

### Frontend Integration
- Used by all React components
- Integrated with Context providers
- Powers custom hooks
- Enables real-time updates

### External Services
- FHIR server compliance
- DICOM WADO-RS protocol
- Clinical terminology services
- Authentication providers

## Key Features

### FHIR Compliance
- Full FHIR R4 resource support
- Search parameter handling
- Bundle operations
- Transaction support
- Validation integration

### Performance Optimization
- Request batching
- Response caching
- Lazy loading
- Pagination support
- Connection pooling

### Developer Experience
- TypeScript definitions (planned)
- Comprehensive error messages
- Debug logging
- Request/response interceptors
- Mock data support

## Educational Value

### API Design Patterns
- RESTful best practices
- Service layer architecture
- Error handling strategies
- Caching implementations
- Authentication flows

### Healthcare Standards
- FHIR R4 implementation
- DICOM protocols
- Clinical terminologies
- HL7 standards
- Security requirements

### Software Engineering
- Clean code principles
- SOLID design patterns
- Dependency injection
- Unit testing strategies
- Documentation practices

## Missing Features & Improvements

### Planned Enhancements
- GraphQL support
- WebSocket integration
- Offline capabilities
- Advanced caching (Redis)
- Request queuing

### Technical Improvements
- TypeScript migration
- Unit test coverage
- Performance monitoring
- Error tracking
- API versioning

### Healthcare Features
- CDS Hooks integration
- SMART on FHIR apps
- Bulk FHIR operations
- Terminology server integration
- External EHR connectivity

## Best Practices

### Service Design
- Single responsibility principle
- Consistent method naming
- Clear error messages
- Proper async/await usage
- Resource cleanup

### API Integration
- Use environment variables
- Implement retry logic
- Handle rate limiting
- Log API calls
- Monitor performance

### Security
- Never store sensitive data in localStorage
- Sanitize user inputs
- Use HTTPS always
- Implement CSRF protection
- Regular security audits

## Module Dependencies
```
Services Module
├── API Module (base HTTP client)
├── Utils Module (helpers, formatters)
├── Constants Module (API endpoints, config)
└── External APIs
    ├── FHIR Server
    ├── DICOM Server
    ├── Terminology Services
    └── Auth Provider
```

## Testing Strategy
- Unit tests for each service method
- Mock API responses
- Error scenario testing
- Integration tests with backend
- Performance benchmarks