# Location Resource Testing Documentation

## Resource Overview
The Location resource represents physical places where healthcare services are provided. This includes hospitals, clinics, rooms, buildings, vehicles, and virtual locations. Location supports hierarchical relationships and geographic positioning for advanced search capabilities.

## FHIR R4 Specification
- **Base URL**: https://hl7.org/fhir/R4/location.html
- **Resource Type**: Administrative
- **Maturity Level**: 4 (Normative)

## Current Implementation Analysis

### Implementation Status
**❌ NOT IMPLEMENTED** - Location is not included in the current storage.py search parameter definitions (lines 70-179). This represents a significant gap for healthcare facility management and geographic search capabilities.

### Expected Search Parameters (Per FHIR R4 Spec)
```python
'Location': {
    'identifier': {'type': 'token'},               # Location identifiers
    'name': {'type': 'string'},                   # Location name
    'address': {'type': 'string'},                # Address (any field)
    'address-city': {'type': 'string'},           # City
    'address-country': {'type': 'string'},        # Country
    'address-postalcode': {'type': 'string'},     # Postal code
    'address-state': {'type': 'string'},          # State
    'address-use': {'type': 'token'},             # Address use (home, work, etc.)
    'organization': {'type': 'reference'},        # Managing organization
    'partof': {'type': 'reference'},              # Parent location
    'status': {'type': 'token'},                  # Location status
    'type': {'type': 'token'},                    # Location type
    'operational-status': {'type': 'token'},      # Operational status
    'mode': {'type': 'token'},                    # Instance vs kind
    'endpoint': {'type': 'reference'},            # Technical endpoints
    'near': {'type': 'special'}                   # Geographic proximity
}
```

## Geographic Search Capabilities

### WGS84 Geographic Positioning
```json
{
  "position": {
    "longitude": -71.0589,
    "latitude": 42.3601,
    "altitude": 44.3
  }
}
```

### Geographic Search Syntax
```
GET /fhir/Location?near=42.3601|-71.0589|10km
GET /fhir/Location?near=42.3601|-71.0589|5mi
```

## Location Hierarchies

### Physical Location Hierarchy
```
Hospital Campus (Building Complex)
├── Main Hospital Building
│   ├── Emergency Department
│   │   ├── Emergency Room 1
│   │   ├── Emergency Room 2
│   │   └── Trauma Bay
│   ├── Cardiology Unit
│   │   ├── Cardiac Cath Lab 1
│   │   ├── Cardiac Cath Lab 2
│   │   └── Recovery Room
│   └── Laboratory
│       ├── Chemistry Lab
│       ├── Microbiology Lab
│       └── Blood Bank
├── Outpatient Clinic Building
└── Parking Garage
```

## Test Scenarios

### 1. Basic CRUD Operations

#### 1.1 Create Location
**Test Case**: Create a healthcare facility location
```json
{
  "resourceType": "Location",
  "id": "emergency-dept-001",
  "status": "active",
  "name": "Emergency Department",
  "alias": ["ED", "Emergency Room"],
  "description": "24-hour emergency medical services",
  "mode": "instance",
  "type": [
    {
      "coding": [
        {
          "system": "http://terminology.hl7.org/CodeSystem/v3-RoleCode",
          "code": "ER",
          "display": "Emergency room"
        }
      ]
    }
  ],
  "physicalType": {
    "coding": [
      {
        "system": "http://terminology.hl7.org/CodeSystem/location-physical-type",
        "code": "wi",
        "display": "Wing"
      }
    ]
  },
  "managingOrganization": {
    "reference": "Organization/hospital-001",
    "display": "General Hospital"
  },
  "partOf": {
    "reference": "Location/hospital-main-building",
    "display": "Main Hospital Building"
  },
  "address": {
    "use": "work",
    "type": "physical",
    "line": ["123 Medical Center Drive", "Emergency Department"],
    "city": "Boston",
    "state": "MA",
    "postalCode": "02101",
    "country": "USA"
  },
  "position": {
    "longitude": -71.0589,
    "latitude": 42.3601,
    "altitude": 44.3
  },
  "telecom": [
    {
      "system": "phone",
      "value": "+1-555-911-1111",
      "use": "work"
    }
  ],
  "operationalStatus": {
    "system": "http://terminology.hl7.org/CodeSystem/v2-0116",
    "code": "O",
    "display": "Occupied"
  },
  "hoursOfOperation": [
    {
      "daysOfWeek": ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
      "allDay": true
    }
  ],
  "availabilityExceptions": "Available 24/7 for emergency services"
}
```

**Expected Result**: HTTP 201 Created with populated meta fields

#### 1.2 Read Location
**Test Case**: Retrieve Location by ID
```
GET /fhir/Location/emergency-dept-001
```

**Expected Result**: HTTP 200 OK with complete resource including geographic coordinates

#### 1.3 Update Location
**Test Case**: Update location information
- Modify operational status
- Update contact information
- Change hours of operation

**Expected Result**: HTTP 200 OK with incremented version

#### 1.4 Delete Location
**Test Case**: Deactivate location
```
DELETE /fhir/Location/emergency-dept-001
```

**Expected Result**: HTTP 204 No Content, check cascade effects

### 2. Geographic Search Testing

#### 2.1 Proximity Search
```
GET /fhir/Location?near=42.3601|-71.0589|5km
GET /fhir/Location?near=42.3601|-71.0589|10mi
```

**Test Cases**:
- Find locations within 5 kilometers
- Find locations within 10 miles
- Different distance units (km, mi, m)
- Edge cases (exact distance boundaries)

#### 2.2 Geographic Boundary Testing
**Test Cases**:
- Locations exactly at distance boundary
- Very close locations (same building)
- Very distant locations (different continents)
- Missing coordinate handling

#### 2.3 Coordinate Validation
**Test Cases**:
- Valid WGS84 coordinates
- Invalid latitude/longitude ranges
- Missing coordinates
- Altitude handling (optional)

### 3. Hierarchical Location Testing

#### 3.1 Parent-Child Relationships
**Test Case**: Create location hierarchy
```json
{
  "resourceType": "Bundle",
  "type": "transaction",
  "entry": [
    {
      "resource": {
        "resourceType": "Location",
        "id": "hospital-campus",
        "name": "Hospital Campus",
        "mode": "kind"
      }
    },
    {
      "resource": {
        "resourceType": "Location",
        "id": "main-building",
        "name": "Main Hospital Building",
        "partOf": {"reference": "Location/hospital-campus"}
      }
    },
    {
      "resource": {
        "resourceType": "Location",
        "id": "emergency-dept",
        "name": "Emergency Department", 
        "partOf": {"reference": "Location/main-building"}
      }
    },
    {
      "resource": {
        "resourceType": "Location",
        "id": "trauma-bay-1",
        "name": "Trauma Bay 1",
        "partOf": {"reference": "Location/emergency-dept"}
      }
    }
  ]
}
```

#### 3.2 Hierarchy Navigation
**Test Cases**:
```
GET /fhir/Location?partof=Location/hospital-campus
GET /fhir/Location?partof=Location/emergency-dept
```

**Expected Results**:
- Find all child locations
- Recursive hierarchy traversal
- Room and facility discovery

#### 3.3 Location Path Resolution
**Test Cases**:
- Trace location path to root
- Find sibling locations
- Identify location lineage

### 4. Location Type and Status Testing

#### 4.1 Location Types
```
GET /fhir/Location?type=ER
GET /fhir/Location?type=http://terminology.hl7.org/CodeSystem/v3-RoleCode|HOSP
```

**Test Cases**:
- Emergency room types
- Hospital types
- Clinic types
- Ambulatory care types
- Virtual location types

#### 4.2 Location Status
```
GET /fhir/Location?status=active
GET /fhir/Location?status=inactive
GET /fhir/Location?status=suspended
```

**Test Cases**:
- Active locations only
- Temporarily suspended locations
- Permanently inactive locations

#### 4.3 Operational Status
```
GET /fhir/Location?operational-status=O
GET /fhir/Location?operational-status=C
```

**Test Cases**:
- Occupied locations
- Closed locations
- Housekeeping status
- Contaminated/isolation status

### 5. Organization Integration Testing

#### 5.1 Managing Organization Relationships
**Test Case**: Locations managed by organizations
```json
{
  "resourceType": "Location",
  "managingOrganization": {
    "reference": "Organization/hospital-001"
  }
}
```

**Search Tests**:
```
GET /fhir/Location?organization=Organization/hospital-001
GET /fhir/Location?organization:Organization.name=General Hospital
```

#### 5.2 Multi-Organization Locations
**Test Case**: Shared facilities
- Joint ventures
- Shared imaging centers
- Multi-tenant buildings

### 6. Address and Contact Testing

#### 6.1 Address Search
```
GET /fhir/Location?address=123 Medical Center
GET /fhir/Location?address-city=Boston
GET /fhir/Location?address-state=MA
GET /fhir/Location?address-postalcode=02101
```

**Test Cases**:
- Partial address matching
- City-based searches
- State/province filtering
- Postal code searches
- International addresses

#### 6.2 Contact Information
**Test Cases**:
- Phone number validation
- Multiple contact methods
- Emergency contact numbers
- Business hours correlation

### 7. Healthcare Facility Use Cases

#### 7.1 Emergency Services Lookup
**Scenario**: Find nearest emergency departments
```
GET /fhir/Location?type=ER&near=42.3601|-71.0589|25km&status=active
```

#### 7.2 Specialty Care Locations
**Scenario**: Find cardiac catheterization labs
```
GET /fhir/Location?type=cardiac-cath-lab&organization=Organization/hospital-001
```

#### 7.3 Outpatient Clinic Directory
**Scenario**: Find all outpatient locations in region
```
GET /fhir/Location?type=outpatient&address-state=MA&status=active
```

#### 7.4 Resource Scheduling Integration
**Scenario**: Find available locations for procedures
```
GET /fhir/Location?type=operating-room&operational-status=available
```

### 8. Complex Search Scenarios

#### 8.1 Multi-Criteria Location Search
```
GET /fhir/Location?type=ER&near=42.3601|-71.0589|10km&status=active&operational-status=O
```

#### 8.2 Hierarchical and Geographic Combined
```
GET /fhir/Location?partof=Location/hospital-campus&near=42.3601|-71.0589|1km
```

#### 8.3 Organization and Location Combined
```
GET /fhir/Location?organization:Organization.type=prov&address-city=Boston
```

### 9. Virtual and Mobile Locations

#### 9.1 Virtual Locations
**Test Case**: Telemedicine locations
```json
{
  "resourceType": "Location",
  "mode": "kind",
  "type": [
    {
      "coding": [
        {
          "code": "virtual",
          "display": "Virtual location"
        }
      ]
    }
  ],
  "physicalType": {
    "coding": [
      {
        "code": "vi",
        "display": "Virtual"
      }
    ]
  }
}
```

#### 9.2 Mobile Locations
**Test Case**: Ambulances and mobile units
```json
{
  "resourceType": "Location",
  "mode": "instance",
  "type": [
    {
      "coding": [
        {
          "code": "AMB",
          "display": "Ambulance"
        }
      ]
    }
  ],
  "physicalType": {
    "coding": [
      {
        "code": "ve",
        "display": "Vehicle"
      }
    ]
  }
}
```

### 10. Performance and Scalability Testing

#### 10.1 Large Location Networks
**Test Data**:
- 1000+ locations
- Multi-level hierarchies (6+ levels deep)
- Geographic distribution across regions

**Performance Metrics**:
- Geographic search response time
- Hierarchy traversal performance
- Large result set handling

#### 10.2 Geographic Query Optimization
**Test Cases**:
- Spatial indexing performance
- Distance calculation efficiency
- Large geographic areas

### 11. Integration Points

#### 11.1 PractitionerRole Integration
**Test Case**: Practitioners working at locations
```json
{
  "resourceType": "PractitionerRole",
  "practitioner": {"reference": "Practitioner/dr-smith"},
  "location": [
    {"reference": "Location/emergency-dept-001"}
  ]
}
```

#### 11.2 Encounter Location References
**Test Case**: Encounters at specific locations
```json
{
  "resourceType": "Encounter",
  "location": [
    {
      "location": {"reference": "Location/emergency-dept-001"},
      "status": "active"
    }
  ]
}
```

#### 11.3 Appointment Scheduling
**Test Case**: Appointments at locations
```json
{
  "resourceType": "Appointment",
  "participant": [
    {
      "actor": {"reference": "Location/exam-room-101"},
      "required": "required",
      "status": "accepted"
    }
  ]
}
```

## Implementation Requirements

### 1. Database Schema Design
**Priority: Critical**
```sql
-- Geographic indexing for spatial queries
CREATE INDEX idx_location_coordinates ON fhir.location_search_params 
  USING GIST (ST_Point(longitude, latitude));

-- Hierarchy indexing for partof relationships
CREATE INDEX idx_location_partof ON fhir.location_search_params (partof_reference);

-- Address component indexes
CREATE INDEX idx_location_city ON fhir.location_search_params (address_city);
CREATE INDEX idx_location_state ON fhir.location_search_params (address_state);
```

### 2. Geographic Search Implementation
**Priority: Critical**
- PostGIS spatial extensions
- Distance calculation algorithms
- Coordinate validation
- Proximity search optimization

### 3. Hierarchy Management
**Priority: High**
- Recursive hierarchy queries
- Circular reference prevention
- Efficient tree traversal
- Bulk hierarchy operations

### 4. Address Normalization
**Priority: Medium**
- Address standardization
- Geocoding integration
- International address support

## Current Implementation Status

| Feature | Status | Priority |
|---------|--------|----------|
| Resource Definition | ❌ Missing | Critical |
| Basic CRUD | ❌ Missing | Critical |
| Search Parameters | ❌ Missing | Critical |
| Geographic Search | ❌ Missing | Critical |
| Hierarchy Support | ❌ Missing | High |
| Address Search | ❌ Missing | High |
| Organization Integration | ❌ Missing | High |
| Operational Status | ❌ Missing | Medium |

## Test Data Requirements

### Minimum Test Dataset
- 10 locations with geographic coordinates
- 3-level location hierarchy
- Various location types (hospital, clinic, room)
- Different operational statuses
- Address variations (urban, rural, international)

### Comprehensive Test Dataset
- 100+ locations across multiple states/regions
- Complex multi-level hierarchies
- All location types and statuses
- Geographic distribution for proximity testing
- Virtual and mobile locations

## Security and Privacy Considerations

### Access Control
- Location-based access restrictions
- Sensitive location protection
- Patient location privacy

### Data Validation
- Coordinate validation
- Address format verification
- Hierarchy integrity checks

## Recent Updates
- **2025-07-14**: Initial comprehensive testing documentation created for Location resource
- Identified complete absence of Location implementation in current system
- Documented critical geographic search capabilities requirements
- Outlined complex hierarchy and organization integration needs
- Defined spatial indexing and performance requirements for large-scale healthcare facility management