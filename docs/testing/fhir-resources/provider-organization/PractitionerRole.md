# PractitionerRole Resource Testing Documentation

## Resource Overview
The PractitionerRole resource represents the relationship between a Practitioner and an Organization, including the roles, specialties, locations, and services the practitioner provides within that organizational context.

## FHIR R4 Specification
- **Base URL**: https://hl7.org/fhir/R4/practitionerrole.html
- **Resource Type**: Administrative
- **Maturity Level**: 4 (Normative)

## Current Implementation Analysis

### Implementation Status
**❌ NOT IMPLEMENTED** - PractitionerRole is not included in the current storage.py search parameter definitions (lines 70-179). This represents a significant gap in provider directory functionality.

### Expected Search Parameters (Per FHIR R4 Spec)
```python
'PractitionerRole': {
    'practitioner': {'type': 'reference'},     # Reference to Practitioner
    'organization': {'type': 'reference'},     # Reference to Organization  
    'location': {'type': 'reference'},         # Reference to Location(s)
    'specialty': {'type': 'token'},            # Practitioner specialty
    'role': {'type': 'token'},                 # Practitioner role/code
    'service': {'type': 'reference'},          # Healthcare services
    'active': {'type': 'token'},               # Active status
    'date': {'type': 'date'},                  # Period of role
    'email': {'type': 'token'},                # Contact email
    'phone': {'type': 'token'},                # Contact phone  
    'telecom': {'type': 'token'},              # Any telecom
    'endpoint': {'type': 'reference'}          # Technical endpoints
}
```

## Resource Relationships

### Core Relationships
```
PractitionerRole → Practitioner (1:1 reference)
PractitionerRole → Organization (1:1 reference)  
PractitionerRole → Location (1:many references)
PractitionerRole → HealthcareService (1:many references)
PractitionerRole → Endpoint (1:many references)
```

### Provider Directory Structure
```
Organization (Hospital)
├── Location (Emergency Department)
│   └── PractitionerRole (Dr. Smith as Emergency Physician)
│       └── Practitioner (Dr. John Smith)
├── Location (Cardiology Unit)
│   └── PractitionerRole (Dr. Smith as Cardiologist)
│       └── Practitioner (Dr. John Smith)
└── HealthcareService (Emergency Care)
    └── PractitionerRole (Multiple practitioners)
```

## Test Scenarios

### 1. Basic CRUD Operations

#### 1.1 Create PractitionerRole
**Test Case**: Create a PractitionerRole linking Practitioner to Organization
```json
{
  "resourceType": "PractitionerRole",
  "id": "practitioner-role-001",
  "active": true,
  "period": {
    "start": "2024-01-01"
  },
  "practitioner": {
    "reference": "Practitioner/practitioner-001",
    "display": "Dr. John Smith"
  },
  "organization": {
    "reference": "Organization/hospital-001", 
    "display": "General Hospital"
  },
  "location": [
    {
      "reference": "Location/emergency-dept",
      "display": "Emergency Department"
    }
  ],
  "code": [
    {
      "coding": [
        {
          "system": "http://snomed.info/sct",
          "code": "309343006",
          "display": "Physician"
        }
      ]
    }
  ],
  "specialty": [
    {
      "coding": [
        {
          "system": "http://snomed.info/sct", 
          "code": "419772000",
          "display": "Family practice"
        }
      ]
    }
  ],
  "telecom": [
    {
      "system": "phone",
      "value": "+1-555-123-4567",
      "use": "work"
    },
    {
      "system": "email",
      "value": "john.smith@hospital.org", 
      "use": "work"
    }
  ],
  "availableTime": [
    {
      "daysOfWeek": ["mon", "tue", "wed", "thu", "fri"],
      "availableStartTime": "08:00:00",
      "availableEndTime": "17:00:00"
    }
  ]
}
```

**Expected Result**: HTTP 201 Created with populated meta fields

#### 1.2 Read PractitionerRole
**Test Case**: Retrieve PractitionerRole by ID
```
GET /fhir/PractitionerRole/practitioner-role-001
```

**Expected Result**: HTTP 200 OK with complete resource including references

#### 1.3 Update PractitionerRole
**Test Case**: Update role specialty or location
- Add new specialty
- Change assigned location
- Update availability schedule

**Expected Result**: HTTP 200 OK with incremented version

#### 1.4 Delete PractitionerRole
**Test Case**: Remove practitioner role assignment
```
DELETE /fhir/PractitionerRole/practitioner-role-001
```

**Expected Result**: HTTP 204 No Content, resource marked as deleted

### 2. Relationship Search Testing

#### 2.1 Practitioner Reference Search
```
GET /fhir/PractitionerRole?practitioner=Practitioner/practitioner-001
GET /fhir/PractitionerRole?practitioner:Practitioner.name=Smith
```

**Test Cases**:
- Direct practitioner reference
- Chained search on practitioner attributes
- Multiple practitioners
- Invalid practitioner references

#### 2.2 Organization Reference Search  
```
GET /fhir/PractitionerRole?organization=Organization/hospital-001
GET /fhir/PractitionerRole?organization:Organization.name=General Hospital
```

**Test Cases**:
- Direct organization reference
- Chained search on organization attributes
- Multiple organizations
- Organizational hierarchy queries

#### 2.3 Location Reference Search
```
GET /fhir/PractitionerRole?location=Location/emergency-dept
GET /fhir/PractitionerRole?location:Location.name=Emergency
```

**Test Cases**:
- Direct location reference
- Chained search on location attributes
- Multiple locations per role
- Geographic location queries

#### 2.4 Healthcare Service Search
```
GET /fhir/PractitionerRole?service=HealthcareService/emergency-care
GET /fhir/PractitionerRole?service:HealthcareService.type=emergency
```

**Test Cases**:
- Direct service reference
- Service type filtering
- Multiple services per role

### 3. Specialty and Role Search Testing

#### 3.1 Specialty Search (Token)
```
GET /fhir/PractitionerRole?specialty=419772000
GET /fhir/PractitionerRole?specialty=http://snomed.info/sct|419772000
GET /fhir/PractitionerRole?specialty:text=family practice
```

**Test Cases**:
- SNOMED specialty codes
- System|code format
- Text-based specialty search
- Multiple specialties per role

#### 3.2 Role/Code Search (Token)
```
GET /fhir/PractitionerRole?role=309343006
GET /fhir/PractitionerRole?role=http://snomed.info/sct|309343006
```

**Test Cases**:
- Role code searches
- Professional role categorization
- Multiple roles per practitioner

### 4. Provider Directory Use Cases

#### 4.1 Find Practitioners by Organization
**Scenario**: Find all practitioners working at a specific hospital
```
GET /fhir/PractitionerRole?organization=Organization/hospital-001
GET /fhir/PractitionerRole?organization=Organization/hospital-001&_include=PractitionerRole:practitioner
```

#### 4.2 Find Practitioners by Specialty
**Scenario**: Find all cardiologists in the network
```
GET /fhir/PractitionerRole?specialty=http://snomed.info/sct|394579002&_include=PractitionerRole:practitioner
```

#### 4.3 Find Practitioners by Location  
**Scenario**: Find practitioners available at emergency department
```
GET /fhir/PractitionerRole?location=Location/emergency-dept&active=true&_include=PractitionerRole:practitioner
```

#### 4.4 Provider Availability Search
**Scenario**: Find available practitioners for specific time periods
```
GET /fhir/PractitionerRole?date=ge2024-07-14&date=le2024-07-21
```

### 5. Complex Search Scenarios

#### 5.1 Multi-Organization Practitioners
**Test Case**: Practitioner working at multiple organizations
```json
[
  {
    "resourceType": "PractitionerRole",
    "practitioner": {"reference": "Practitioner/dr-smith"},
    "organization": {"reference": "Organization/hospital-a"},
    "specialty": [{"coding": [{"code": "419772000", "display": "Family practice"}]}]
  },
  {
    "resourceType": "PractitionerRole", 
    "practitioner": {"reference": "Practitioner/dr-smith"},
    "organization": {"reference": "Organization/clinic-b"},
    "specialty": [{"coding": [{"code": "394579002", "display": "Cardiology"}]}]
  }
]
```

**Search Tests**:
```
GET /fhir/PractitionerRole?practitioner=Practitioner/dr-smith
GET /fhir/PractitionerRole?practitioner=Practitioner/dr-smith&specialty=419772000
```

#### 5.2 Hierarchical Organization Search
**Test Case**: Find practitioners in organization hierarchy
```
GET /fhir/PractitionerRole?organization:Organization.partof=Organization/health-system
```

#### 5.3 Geographic Provider Search
**Test Case**: Find practitioners within geographic area
```
GET /fhir/PractitionerRole?location:Location.near=42.3601|-71.0589|10km
```

### 6. Integration Testing

#### 6.1 Reference Integrity Testing
**Test Cases**:
- Create PractitionerRole with non-existent Practitioner
- Create PractitionerRole with non-existent Organization
- Delete referenced Practitioner (cascade behavior)
- Delete referenced Organization (cascade behavior)

#### 6.2 Cross-Resource Search Testing
**Test Cases**:
- Include Practitioner details in PractitionerRole search
- Include Organization details in PractitionerRole search
- Include Location details in PractitionerRole search
- Reverse includes (find PractitionerRoles from Practitioner search)

### 7. Workflow Testing

#### 7.1 Provider Onboarding Workflow
**Steps**:
1. Create Practitioner resource
2. Create PractitionerRole linking to Organization
3. Assign Location(s)  
4. Set specialties and available times
5. Activate role

**Validation**:
- All references resolve correctly
- Search queries return expected results
- Provider appears in directory searches

#### 7.2 Provider Role Changes
**Steps**:
1. Update PractitionerRole specialty
2. Change assigned locations
3. Modify availability schedule
4. End role (set end date)

**Validation**:
- Historical role information preserved
- Current role status accurate
- Search results reflect changes

#### 7.3 Provider Directory Queries
**Test Scenarios**:
- Emergency department staffing lookup
- Specialist referral searches
- On-call provider identification
- Credentialed provider verification

### 8. Performance and Scalability Testing

#### 8.1 Large Provider Networks
**Test Data**:
- 1000+ practitioners
- 100+ organizations  
- 500+ locations
- Multiple roles per practitioner

**Performance Metrics**:
- Provider search response time
- Directory lookup performance
- Complex query optimization

#### 8.2 Concurrent Role Management
**Test Cases**:
- Simultaneous role assignments
- Concurrent specialty updates
- Parallel provider searches

### 9. Security and Privacy Testing

#### 9.1 Access Control
**Test Cases**:
- Role-based provider directory access
- Patient access to provider information
- Administrative vs clinical views

#### 9.2 Data Protection
**Test Cases**:
- Provider contact information privacy
- Sensitive credential data handling
- Audit trail for provider changes

## Implementation Requirements

### 1. Database Schema Updates
**Priority: Critical**
```sql
-- Add PractitionerRole resource support
-- Implement reference tables for relationships
-- Create indexes for search performance
```

### 2. Search Parameter Implementation
**Priority: Critical**
- Add PractitionerRole to search parameter definitions
- Implement reference-based searches
- Support chained parameter queries

### 3. FHIR Operations Support
**Priority: High**
- Full CRUD operations
- Reference validation
- Include/revinclude support

### 4. Provider Directory Features
**Priority: High**
- Specialty-based searches
- Organization hierarchy support
- Geographic location queries
- Availability scheduling

## Current Implementation Status

| Feature | Status | Priority |
|---------|--------|----------|
| Resource Definition | ❌ Missing | Critical |
| Basic CRUD | ❌ Missing | Critical |
| Search Parameters | ❌ Missing | Critical |
| Reference Validation | ❌ Missing | Critical |
| Relationship Queries | ❌ Missing | High |
| Provider Directory | ❌ Missing | High |
| Specialty Search | ❌ Missing | High |
| Location Integration | ❌ Missing | Medium |

## Test Data Requirements

### Minimum Test Dataset
- 5 practitioners with different specialties
- 3 organizations (hospital, clinic, practice)
- 10 practitioner roles with varied assignments
- Multiple locations per organization
- Cross-organization practitioner assignments

### Comprehensive Test Dataset  
- 50+ practitioners
- 10+ organizations with hierarchy
- 100+ practitioner roles
- Geographic distribution of locations
- Complex availability schedules
- Historical role changes

## Integration Points

### Frontend Integration
- Provider search interfaces
- Role assignment dialogs
- Provider directory views
- Scheduling integrations

### Backend Integration
- Reference resolution services
- Provider authentication systems
- Credentialing workflows
- Reporting and analytics

## Recent Updates
- **2025-07-14**: Initial comprehensive testing documentation created for PractitionerRole resource
- Identified complete absence of PractitionerRole implementation
- Documented critical provider directory functionality gaps
- Outlined complex relationship testing requirements
- Defined integration points with Practitioner, Organization, and Location resources