# WintEHR API Documentation

**Version**: 1.0.0  
**Last Updated**: 2025-08-06  
**Base URL**: `http://localhost:8000` (Development)  
**API Version**: `/api/v1`

## Table of Contents
- [Authentication](#authentication)
- [FHIR API](#fhir-api)
- [CDS Hooks API](#cds-hooks-api)
- [Clinical Services API](#clinical-services-api)
- [WebSocket API](#websocket-api)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)

## Authentication

### Overview
WintEHR uses JWT (JSON Web Token) based authentication for API access.

### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "demo",
  "password": "password"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "expires_in": 3600,
  "user": {
    "id": "user-123",
    "username": "demo",
    "role": "physician",
    "permissions": ["read", "write", "prescribe"]
  }
}
```

### Refresh Token
```http
POST /api/auth/refresh
Authorization: Bearer {token}
```

### Logout
```http
POST /api/auth/logout
Authorization: Bearer {token}
```

## FHIR API

### Base URL
```
/fhir/R4
```

### Supported Resources (38 Types)
- Patient, Practitioner, Organization
- Encounter, Appointment, Schedule
- Condition, Procedure, Observation
- MedicationRequest, MedicationDispense, MedicationAdministration
- AllergyIntolerance, Immunization
- DiagnosticReport, ImagingStudy
- CarePlan, CareTeam, Goal
- DocumentReference, Binary
- And more...

### Resource Operations

#### Create Resource
```http
POST /fhir/R4/{ResourceType}
Content-Type: application/fhir+json
Authorization: Bearer {token}

{
  "resourceType": "Patient",
  "identifier": [{
    "system": "http://hospital.org/mrn",
    "value": "12345"
  }],
  "name": [{
    "family": "Smith",
    "given": ["John", "Michael"]
  }],
  "birthDate": "1970-01-01"
}
```

**Response:** `201 Created`
```json
{
  "resourceType": "Patient",
  "id": "patient-123",
  "meta": {
    "versionId": "1",
    "lastUpdated": "2025-08-06T10:00:00Z"
  },
  ...
}
```

#### Read Resource
```http
GET /fhir/R4/{ResourceType}/{id}
Authorization: Bearer {token}
```

**Response:** `200 OK`

#### Update Resource
```http
PUT /fhir/R4/{ResourceType}/{id}
Content-Type: application/fhir+json
Authorization: Bearer {token}

{
  "resourceType": "Patient",
  "id": "patient-123",
  ...
}
```

**Response:** `200 OK`

#### Delete Resource
```http
DELETE /fhir/R4/{ResourceType}/{id}
Authorization: Bearer {token}
```

**Response:** `204 No Content`

#### Search Resources
```http
GET /fhir/R4/{ResourceType}?{parameters}
Authorization: Bearer {token}
```

**Common Search Parameters:**
- `_id`: Resource ID
- `_lastUpdated`: Last update timestamp
- `_count`: Number of results per page
- `_offset`: Pagination offset
- `_sort`: Sort order
- `_include`: Include referenced resources

**Example Searches:**
```http
# Search patients by name
GET /fhir/R4/Patient?name=Smith

# Search active conditions for a patient
GET /fhir/R4/Condition?patient=Patient/123&clinical-status=active

# Search observations with date range
GET /fhir/R4/Observation?patient=Patient/123&date=ge2024-01-01&date=le2024-12-31

# Include related resources
GET /fhir/R4/MedicationRequest?patient=Patient/123&_include=MedicationRequest:medication
```

### Bundle Operations

#### Transaction Bundle
```http
POST /fhir/R4
Content-Type: application/fhir+json
Authorization: Bearer {token}

{
  "resourceType": "Bundle",
  "type": "transaction",
  "entry": [
    {
      "request": {
        "method": "POST",
        "url": "Patient"
      },
      "resource": {
        "resourceType": "Patient",
        ...
      }
    },
    {
      "request": {
        "method": "PUT",
        "url": "Observation/obs-123"
      },
      "resource": {
        "resourceType": "Observation",
        ...
      }
    }
  ]
}
```

### Compartment Operations

#### Patient Everything
```http
GET /fhir/R4/Patient/{id}/$everything
Authorization: Bearer {token}
```

Returns all resources related to a specific patient.

### History Operations

#### Resource History
```http
GET /fhir/R4/{ResourceType}/{id}/_history
Authorization: Bearer {token}
```

#### Version Read
```http
GET /fhir/R4/{ResourceType}/{id}/_history/{versionId}
Authorization: Bearer {token}
```

## CDS Hooks API

### Discovery Endpoint
```http
GET /api/cds-services
```

**Response:**
```json
{
  "services": [
    {
      "id": "medication-prescribe",
      "hook": "medication-prescribe",
      "title": "Medication Prescribing Guidance",
      "description": "Provides drug interaction and dosing guidance",
      "prefetch": {
        "patient": "Patient/{{context.patientId}}",
        "medications": "MedicationRequest?patient={{context.patientId}}"
      }
    }
  ]
}
```

### Service Invocation
```http
POST /api/cds-services/{serviceId}
Content-Type: application/json
Authorization: Bearer {token}

{
  "hook": "medication-prescribe",
  "hookInstance": "instance-123",
  "context": {
    "userId": "Practitioner/123",
    "patientId": "Patient/456",
    "medications": [{
      "resourceType": "MedicationRequest",
      ...
    }]
  },
  "prefetch": {
    "patient": {
      "resourceType": "Patient",
      ...
    }
  }
}
```

**Response:**
```json
{
  "cards": [
    {
      "uuid": "card-123",
      "summary": "Drug Interaction Warning",
      "indicator": "warning",
      "detail": "Potential interaction between medications",
      "source": {
        "label": "Drug Database",
        "url": "http://drugs.example.com"
      },
      "suggestions": [
        {
          "label": "Use alternative medication",
          "uuid": "suggestion-1",
          "actions": [...]
        }
      ]
    }
  ]
}
```

### Available CDS Hooks
- `patient-view`: Patient chart opened
- `medication-prescribe`: Medication prescribed
- `order-review`: Order review and sign
- `order-select`: Order selection
- `appointment-book`: Appointment booking

## Clinical Services API

### Clinical Catalogs

#### Get Medication Catalog
```http
GET /api/catalogs/medications
Authorization: Bearer {token}
```

**Response:**
```json
{
  "medications": [
    {
      "id": "med-123",
      "name": "Aspirin",
      "dosageForm": "tablet",
      "strength": "81mg",
      "rxNormCode": "243670"
    }
  ],
  "total": 150
}
```

#### Get Lab Catalog
```http
GET /api/catalogs/labs
Authorization: Bearer {token}
```

#### Get Imaging Catalog
```http
GET /api/catalogs/imaging
Authorization: Bearer {token}
```

### Clinical Workflow

#### Create Order
```http
POST /api/orders
Content-Type: application/json
Authorization: Bearer {token}

{
  "type": "lab",
  "patient": "Patient/123",
  "practitioner": "Practitioner/456",
  "code": "LOINC:2345-7",
  "priority": "routine",
  "instructions": "Fasting required"
}
```

#### Get Order Status
```http
GET /api/orders/{orderId}/status
Authorization: Bearer {token}
```

#### Update Order Status
```http
PUT /api/orders/{orderId}/status
Content-Type: application/json
Authorization: Bearer {token}

{
  "status": "completed",
  "completedBy": "Practitioner/789",
  "completedAt": "2025-08-06T14:30:00Z",
  "results": [{...}]
}
```

### Pharmacy Operations

#### Get Prescription Queue
```http
GET /api/pharmacy/queue?status=pending
Authorization: Bearer {token}
```

#### Dispense Medication
```http
POST /api/pharmacy/dispense
Content-Type: application/json
Authorization: Bearer {token}

{
  "prescription": "MedicationRequest/123",
  "quantity": 30,
  "daysSupply": 30,
  "lotNumber": "LOT123",
  "expirationDate": "2026-12-31",
  "dispensedBy": "Practitioner/pharmacist-1"
}
```

### Imaging Operations

#### Get DICOM Studies
```http
GET /api/imaging/studies?patient=Patient/123
Authorization: Bearer {token}
```

#### Get DICOM Images
```http
GET /api/imaging/studies/{studyId}/series/{seriesId}/instances
Authorization: Bearer {token}
```

#### Download DICOM File
```http
GET /api/imaging/wado?studyUID={uid}&seriesUID={uid}&objectUID={uid}
Authorization: Bearer {token}
```

## WebSocket API

### Connection
```javascript
const socket = io('ws://localhost:8000', {
  auth: {
    token: 'your-jwt-token'
  }
});
```

### Events

#### Subscribe to Patient Updates
```javascript
socket.emit('subscribe', {
  type: 'patient',
  id: 'Patient/123'
});

socket.on('patient:update', (data) => {
  console.log('Patient updated:', data);
});
```

#### Clinical Events
```javascript
// Subscribe to clinical events
socket.emit('subscribe', {
  type: 'clinical',
  scope: 'all'
});

// Receive events
socket.on('order:created', (order) => { ... });
socket.on('result:available', (result) => { ... });
socket.on('medication:dispensed', (medication) => { ... });
```

#### System Notifications
```javascript
socket.on('system:alert', (alert) => {
  console.log('System alert:', alert);
});

socket.on('system:maintenance', (info) => {
  console.log('Maintenance scheduled:', info);
});
```

## Error Handling

### Error Response Format
```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "The requested resource was not found",
    "details": {
      "resourceType": "Patient",
      "id": "999"
    },
    "timestamp": "2025-08-06T10:00:00Z",
    "traceId": "trace-123"
  }
}
```

### HTTP Status Codes
- `200 OK`: Successful GET, PUT
- `201 Created`: Successful POST
- `204 No Content`: Successful DELETE
- `400 Bad Request`: Invalid request format
- `401 Unauthorized`: Missing or invalid authentication
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `409 Conflict`: Resource version conflict
- `422 Unprocessable Entity`: Validation error
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error
- `503 Service Unavailable`: Service temporarily unavailable

### Common Error Codes
- `INVALID_REQUEST`: Request format or parameters invalid
- `RESOURCE_NOT_FOUND`: Requested resource doesn't exist
- `VALIDATION_ERROR`: Resource validation failed
- `DUPLICATE_RESOURCE`: Resource already exists
- `VERSION_CONFLICT`: Resource version mismatch
- `PERMISSION_DENIED`: Insufficient permissions
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `SERVICE_ERROR`: Internal service error

## Rate Limiting

### Default Limits
- **Anonymous**: 100 requests per hour
- **Authenticated**: 1000 requests per hour
- **Admin**: 10000 requests per hour

### Rate Limit Headers
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1628856000
```

### Rate Limit Response
```http
HTTP/1.1 429 Too Many Requests
Retry-After: 3600

{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Please retry after 3600 seconds",
    "retryAfter": 3600
  }
}
```

## API Versioning

### Version in URL
```
/api/v1/...  (current)
/api/v2/...  (future)
```

### Version in Header
```http
Accept: application/vnd.wintehr.v1+json
```

## Pagination

### Request Parameters
- `_count`: Number of results per page (default: 10, max: 100)
- `_offset`: Skip this many results (for pagination)
- `_cursor`: Cursor-based pagination token

### Response Format
```json
{
  "resourceType": "Bundle",
  "type": "searchset",
  "total": 250,
  "link": [
    {
      "relation": "self",
      "url": "/fhir/R4/Patient?_count=10&_offset=0"
    },
    {
      "relation": "next",
      "url": "/fhir/R4/Patient?_count=10&_offset=10"
    },
    {
      "relation": "last",
      "url": "/fhir/R4/Patient?_count=10&_offset=240"
    }
  ],
  "entry": [...]
}
```

## Search Modifiers

### String Modifiers
- `:exact`: Exact match
- `:contains`: Contains substring
- `:missing`: Parameter is missing

### Token Modifiers
- `:text`: Text search
- `:not`: Not equal
- `:above`: Subsumes search
- `:below`: Subsumed by search

### Date Modifiers
- `eq`: Equal
- `ne`: Not equal
- `lt`: Less than
- `le`: Less than or equal
- `gt`: Greater than
- `ge`: Greater than or equal

## Batch Operations

### Batch Request
```http
POST /api/batch
Content-Type: application/json
Authorization: Bearer {token}

{
  "requests": [
    {
      "id": "req-1",
      "method": "GET",
      "url": "/fhir/R4/Patient/123"
    },
    {
      "id": "req-2",
      "method": "POST",
      "url": "/fhir/R4/Observation",
      "body": {...}
    }
  ]
}
```

### Batch Response
```json
{
  "responses": [
    {
      "id": "req-1",
      "status": 200,
      "body": {...}
    },
    {
      "id": "req-2",
      "status": 201,
      "body": {...}
    }
  ]
}
```

## Health Check Endpoints

### Liveness Probe
```http
GET /health/live
```

Response: `200 OK` if service is running

### Readiness Probe
```http
GET /health/ready
```

Response: `200 OK` if service is ready to accept requests

### Detailed Health Status
```http
GET /health/status
Authorization: Bearer {token}
```

**Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2025-08-06T10:00:00Z",
  "services": {
    "database": "healthy",
    "redis": "healthy",
    "websocket": "healthy"
  },
  "metrics": {
    "uptime": 86400,
    "requests": 10000,
    "errors": 5,
    "responseTime": 45
  }
}
```

## Testing Endpoints (Development Only)

### Generate Test Data
```http
POST /api/test/generate-patients
Content-Type: application/json
Authorization: Bearer {token}

{
  "count": 10,
  "seed": 12345
}
```

### Clear Test Data
```http
DELETE /api/test/clear-data
Authorization: Bearer {token}
```

### Reset Database
```http
POST /api/test/reset-database
Authorization: Bearer {token}
```

⚠️ **Warning**: These endpoints are only available in development mode.

---

Built with ❤️ for the healthcare community.