# FHIR Content Negotiation

This document describes the content negotiation implementation for the FHIR R4 API.

## Overview

The FHIR API implements proper HTTP content negotiation as required by the FHIR specification:
- Returns `406 Not Acceptable` when the Accept header requests unsupported formats
- Returns `415 Unsupported Media Type` when the Content-Type is not supported
- Supports both `application/json` and `application/fhir+json` media types

## Supported Media Types

### Accept Header (Response Format)
- `application/json`
- `application/fhir+json`
- `*/*` (wildcard - returns FHIR JSON)

### Content-Type Header (Request Format)
- `application/json`
- `application/fhir+json`

## HTTP Status Codes

### 406 Not Acceptable
Returned when the client's Accept header specifies media types that the server cannot produce.

Example:
```http
GET /fhir/R4/Patient
Accept: application/xml

HTTP/1.1 406 Not Acceptable
Content-Type: application/fhir+json

{
  "resourceType": "OperationOutcome",
  "issue": [{
    "severity": "error",
    "code": "not-acceptable",
    "details": {
      "text": "None of the requested media types are supported: application/xml. Supported types are: application/json, application/fhir+json, */*"
    }
  }]
}
```

### 415 Unsupported Media Type
Returned when the client sends data in a format the server cannot process.

Example:
```http
POST /fhir/R4/Patient
Content-Type: application/xml

HTTP/1.1 415 Unsupported Media Type
Content-Type: application/fhir+json

{
  "resourceType": "OperationOutcome",
  "issue": [{
    "severity": "error",
    "code": "not-supported",
    "details": {
      "text": "Unsupported Content-Type: application/xml. Supported types are: application/json, application/fhir+json"
    }
  }]
}
```

## Implementation Details

### Middleware
The content negotiation is implemented as a FastAPI middleware (`content_negotiation_middleware`) that:
1. Intercepts all requests to `/fhir/R4/*` endpoints
2. Validates Accept headers for all requests
3. Validates Content-Type headers for POST, PUT, and PATCH requests
4. Returns appropriate error responses with FHIR OperationOutcome resources

### Priority Handling
The middleware properly handles Accept headers with multiple media types and quality values:
```http
Accept: application/xml;q=0.9, application/json;q=0.8, */*;q=0.1
```
In this case, even though `application/xml` has higher priority, the server will select `application/json` as it's the highest priority **supported** type.

### Special Cases
- The `/fhir/R4/metadata` endpoint bypasses content negotiation to ensure the capability statement is always accessible
- GET requests without Content-Type headers are allowed (as they have no request body)
- Missing Content-Type headers for POST/PUT/PATCH requests return 415

## Testing

### Manual Testing
Use the provided test scripts:
```bash
# Run comprehensive tests
python tests/test_content_negotiation.py

# Run demonstration
python tests/demo_content_negotiation.py
```

### Unit Tests
Content negotiation is tested in:
```bash
pytest tests/test_fhir_endpoints.py::TestContentNegotiation -v
```

### curl Examples

Test 406 response:
```bash
curl -H "Accept: application/xml" http://localhost:8000/fhir/R4/Patient
```

Test 415 response:
```bash
curl -X POST -H "Content-Type: application/xml" \
  -d '{"resourceType":"Patient"}' \
  http://localhost:8000/fhir/R4/Patient
```

## Compliance

This implementation follows:
- [FHIR R4 HTTP specification](http://hl7.org/fhir/R4/http.html)
- [RFC 7231 - HTTP/1.1 Semantics](https://tools.ietf.org/html/rfc7231)
- Standard HTTP content negotiation practices