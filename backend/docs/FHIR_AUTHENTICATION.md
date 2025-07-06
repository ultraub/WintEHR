# FHIR-Based Authentication Implementation

## Overview

This document describes the FHIR-compliant authentication system implemented in MedGenEMR. The system uses FHIR Person and Practitioner resources to manage user identity and authentication, providing a standards-based approach to healthcare system authentication.

## Architecture

### Core Components

1. **FHIR Resources**
   - `Person` - Represents the identity of an individual across different roles
   - `Practitioner` - Represents a healthcare professional's clinical role
   - `PractitionerRole` - Defines roles within organizations

2. **Authentication Tokens**
   - Session tokens for backward compatibility
   - JWT access tokens for FHIR compliance
   - Refresh tokens for token renewal

3. **Database Models**
   - `Provider` table extended with FHIR fields
   - `UserSession` table for session management
   - `fhir_audit_log` table for audit trails
   - `fhir_person_links` table for identity mapping

## API Endpoints

### FHIR Authentication (`/api/fhir-auth`)

#### Login
```http
POST /api/fhir-auth/login
Content-Type: application/json

{
  "identifier": "NPI123456",  // NPI, email, or user ID
  "credential": null,         // Optional, for future password support
  "organization_id": "org123" // Optional organization context
}
```

Response:
```json
{
  "session_token": "session_abc123",
  "expires_at": "2024-01-01T08:00:00Z",
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "Bearer",
  "scope": "user/*.read user/*.write",
  "practitioner": { /* FHIR Practitioner resource */ },
  "person": { /* FHIR Person resource */ },
  "practitioner_role": { /* FHIR PractitionerRole resource */ }
}
```

#### Get Current User
```http
GET /api/fhir-auth/me
Authorization: Bearer <token>
```

Returns a FHIR Bundle containing:
- Practitioner resource
- Person resource
- PractitionerRole resource (if applicable)
- Organization resource (if applicable)

#### Validate Session
```http
POST /api/fhir-auth/validate-session
Authorization: Bearer <token>
```

Returns FHIR OperationOutcome with session status.

#### Refresh Token
```http
POST /api/fhir-auth/token/refresh
Content-Type: application/json

{
  "refresh_token": "eyJ..."
}
```

### FHIR Resource Endpoints

#### Search Practitioners
```http
GET /api/fhir-auth/Practitioner?name=Smith&active=true
```

#### Get Practitioner by ID
```http
GET /api/fhir-auth/Practitioner/{id}
```

#### Get Person by ID
```http
GET /api/fhir-auth/Person/{id}
```

## Authentication Flow

1. **Login Process**
   - User provides identifier (NPI, email, or ID)
   - System validates provider exists and is active
   - Creates session and JWT tokens
   - Returns FHIR resources and tokens

2. **Token Validation**
   - Accepts both session tokens and JWT tokens
   - JWT tokens are validated first
   - Falls back to session token lookup
   - Updates last activity timestamp

3. **Context Management**
   - FHIR context includes practitioner, person, and organization
   - Supports SMART on FHIR launch contexts
   - Maintains patient context when selected

## Data Model

### Provider Extensions
```sql
-- FHIR-specific fields added to providers table
fhir_version_id VARCHAR(50)      -- FHIR resource version
fhir_last_updated TIMESTAMP      -- Last FHIR update time
fhir_identifiers JSON            -- Additional identifiers
qualifications JSON              -- Professional qualifications
languages JSON                   -- Communication languages
photo_url VARCHAR(500)           -- Profile photo URL
```

### Person Resource Mapping
```json
{
  "resourceType": "Person",
  "id": "<provider.id>",
  "identifier": [
    {
      "system": "http://hl7.org/fhir/sid/us-npi",
      "value": "<provider.npi>"
    },
    {
      "system": "http://medgenemr.local/identifier/user",
      "value": "<provider.id>"
    }
  ],
  "name": [{
    "use": "official",
    "family": "<provider.last_name>",
    "given": ["<provider.first_name>"]
  }],
  "link": [{
    "target": {
      "reference": "Practitioner/<provider.id>"
    },
    "assurance": "level3"
  }]
}
```

### Practitioner Resource Mapping
```json
{
  "resourceType": "Practitioner",
  "id": "<provider.id>",
  "identifier": [
    {
      "type": {
        "coding": [{
          "system": "http://terminology.hl7.org/CodeSystem/v2-0203",
          "code": "NPI"
        }]
      },
      "system": "http://hl7.org/fhir/sid/us-npi",
      "value": "<provider.npi>"
    }
  ],
  "active": true,
  "name": [{
    "use": "official",
    "family": "<provider.last_name>",
    "given": ["<provider.first_name>"]
  }],
  "qualification": [{
    "code": {
      "text": "<provider.specialty>"
    }
  }]
}
```

## JWT Token Structure

### Access Token Claims
```json
{
  "sub": "practitioner-id",
  "iss": "http://medgenemr.local/fhir",
  "aud": "http://medgenemr.local/fhir",
  "exp": 1234567890,
  "iat": 1234567890,
  "practitioner_ref": "Practitioner/123",
  "person_ref": "Person/123",
  "organization_ref": "Organization/456",
  "scope": "user/*.read user/*.write launch/patient",
  "context": {
    "session_id": "session-123",
    "login_time": "2024-01-01T00:00:00Z"
  }
}
```

## Migration Path

### For Existing Systems

1. **Check Migration Status**
```http
GET /api/auth-migration/status
```

2. **Migrate Session**
```http
POST /api/auth-migration/migrate-session
```

3. **Update Provider Fields**
```http
POST /api/auth-migration/update-provider-fhir-fields
{
  "npi": "1234567890",
  "email": "doctor@example.com",
  "phone": "555-1234"
}
```

### Backward Compatibility

The system maintains backward compatibility by:
- Supporting both session tokens and JWT tokens
- Providing legacy authentication endpoints
- Using a compatibility wrapper for existing code
- Falling back between authentication methods

## Security Considerations

1. **Token Security**
   - JWT tokens use HS256 algorithm
   - Tokens expire after 8 hours
   - Refresh tokens expire after 30 days
   - Secret key must be configured in production

2. **Audit Logging**
   - All authentication events are logged
   - FHIR AuditEvent resources created
   - Tracks login, logout, and token refresh

3. **Access Control**
   - Provider must be active to authenticate
   - Sessions validated on each request
   - Organization context enforced when specified

## Usage Examples

### Frontend Integration
```javascript
// Login
const response = await fetch('/api/fhir-auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ identifier: 'NPI123456' })
});

const data = await response.json();
localStorage.setItem('access_token', data.access_token);
localStorage.setItem('practitioner', JSON.stringify(data.practitioner));

// Make authenticated request
const patients = await fetch('/fhir/R4/Patient', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('access_token')}`
  }
});
```

### Backend Integration
```python
from api.fhir_auth import require_fhir_auth, get_current_fhir_provider
from api.fhir_context import get_fhir_context

@router.get("/my-endpoint")
async def my_endpoint(
    provider: Provider = Depends(get_current_fhir_provider),
    context: FHIRContext = Depends(get_fhir_context)
):
    # Access FHIR resources
    practitioner_ref = context.practitioner_reference
    person_ref = context.person_reference
    
    # Use provider data
    return {
        "provider_name": f"{provider.first_name} {provider.last_name}",
        "fhir_references": {
            "practitioner": practitioner_ref,
            "person": person_ref
        }
    }
```

## Configuration

### Environment Variables
```bash
# JWT Configuration
JWT_SECRET_KEY=your-secret-key-change-in-production
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=480  # 8 hours

# Database
DATABASE_URL=postgresql://user:pass@localhost/medgenemr
```

### Running Migrations
```bash
cd backend
python migrations/add_fhir_auth_fields.py
```

## Testing

### Test Authentication Flow
```bash
# Login
curl -X POST http://localhost:8000/api/fhir-auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier": "NPI123456"}'

# Get current user
curl http://localhost:8000/api/fhir-auth/me \
  -H "Authorization: Bearer <access_token>"

# Validate session
curl -X POST http://localhost:8000/api/fhir-auth/validate-session \
  -H "Authorization: Bearer <access_token>"
```

## Troubleshooting

### Common Issues

1. **"Practitioner not found"**
   - Ensure provider exists in database
   - Check provider is active
   - Verify identifier format

2. **"Invalid token"**
   - Check token hasn't expired
   - Verify JWT_SECRET_KEY is consistent
   - Ensure Bearer prefix in Authorization header

3. **"No active session"**
   - Session may have expired
   - Provider may have been deactivated
   - Use refresh token to get new access token