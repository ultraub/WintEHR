# FHIR Search API - Phase 2 Documentation

## Overview

This document covers the Phase 2 enhancements to the FHIR Search API, implementing additional search capabilities required for advanced clinical workflows and R4 compliance.

## Phase 2 Features

### 2.1 Universal Identifier Search

All FHIR resources now support identifier search, regardless of storage method (SQLAlchemy models or JSONB).

#### Syntax
```
GET /api/fhir/{ResourceType}?identifier={value}
GET /api/fhir/{ResourceType}?identifier={system}|{value}
```

#### Examples
```bash
# Search Patient by SSN
GET /api/fhir/Patient?identifier=999-99-9999

# Search Patient by SSN with system
GET /api/fhir/Patient?identifier=http://hl7.org/fhir/sid/us-ssn|999-99-9999

# Search Practitioner by NPI
GET /api/fhir/Practitioner?identifier=1234567890

# Search Observation by identifier
GET /api/fhir/Observation?identifier=LAB-12345

# Search any resource by identifier
GET /api/fhir/MedicationRequest?identifier=RX-001
```

#### Implementation Details
- Uses JSONB path queries for resources stored as JSON
- Searches across all identifier array elements
- Supports both system|value and value-only searches
- Case-sensitive exact match on identifier values

### 2.2 Missing Modifier Support

The `:missing` modifier allows searching for resources where a parameter is present or absent.

#### Syntax
```
GET /api/fhir/{ResourceType}?{parameter}:missing={true|false}
```

#### Examples
```bash
# Find Conditions without an encounter reference
GET /api/fhir/Condition?encounter:missing=true

# Find Conditions with an encounter reference
GET /api/fhir/Condition?encounter:missing=false

# Find Observations without identifiers
GET /api/fhir/Observation?identifier:missing=true

# Find Patients with identifiers
GET /api/fhir/Patient?identifier:missing=false

# Find DocumentReferences without a subject
GET /api/fhir/DocumentReference?subject:missing=true
```

#### Supported Parameters
- All reference parameters (patient, subject, encounter, etc.)
- identifier
- category, type, code
- status fields
- Date fields
- String fields

#### Implementation Details
- For JSONB resources: checks if field is null or has jsonb_typeof 'null'
- For SQLAlchemy models: checks NULL and empty strings for string fields
- Returns resources where the entire parameter is absent, not just empty

### 2.3 Provider Credential Searches

Enhanced search capabilities for practitioner qualifications and roles.

#### Practitioner Qualification Search
```bash
# Search by qualification text
GET /api/fhir/Practitioner?qualification=MD

# Search by qualification with system
GET /api/fhir/Practitioner?qualification=http://terminology.hl7.org/CodeSystem/v2-0360|MD

# Search by specialty
GET /api/fhir/Practitioner?qualification=Cardiology
```

#### PractitionerRole Searches
```bash
# Search by role code
GET /api/fhir/PractitionerRole?role=doctor
GET /api/fhir/PractitionerRole?role=http://terminology.hl7.org/CodeSystem/practitioner-role|doctor

# Search by specialty
GET /api/fhir/PractitionerRole?specialty=207Q00000X
GET /api/fhir/PractitionerRole?specialty=http://nucc.org/provider-taxonomy|207Q00000X

# Search by practitioner
GET /api/fhir/PractitionerRole?practitioner=Practitioner/123

# Search by organization
GET /api/fhir/PractitionerRole?organization=Organization/456
```

#### Implementation Details
- Practitioner: searches in specialty field (partial match without system)
- PractitionerRole: searches in code.coding and specialty.coding arrays
- Supports token format (system|code) for precise matching
- JSONB path queries for array navigation

### 2.4 Basic Chained Parameter Support

Chained parameters allow searching based on criteria of referenced resources.

#### Syntax
```
GET /api/fhir/{ResourceType}?{reference}.{parameter}={value}
```

#### Examples
```bash
# Find Observations for patients named Smith
GET /api/fhir/Observation?patient.name=Smith

# Find Conditions for patients with family name Johnson
GET /api/fhir/Condition?subject.family=Johnson

# Find MedicationRequests for patients with given name John
GET /api/fhir/MedicationRequest?patient.given=John

# Find Encounters for patients with specific identifier
GET /api/fhir/Encounter?patient.identifier=MRN12345

# Find Procedures performed by Dr. Williams
GET /api/fhir/Procedure?performer.name=Williams
```

#### Supported Chains
- `patient.name` - searches name.family, name.given, and name.text
- `patient.family` - searches name.family
- `patient.given` - searches name.given array
- `patient.identifier` - searches identifier.value
- `subject.*` - same as patient chains
- `performer.*` - searches Practitioner resources
- `encounter.*` - searches Encounter resources
- `organization.*` - searches Organization resources

#### Implementation Details
- Creates subquery to find matching referenced resources
- Uses JSONB path queries for name searches
- Returns resources that reference any matching resource
- Performance optimized with proper indexes

## Combined Usage Examples

### Complex Searches
```bash
# Find recent glucose observations for patients named Smith
GET /api/fhir/Observation?patient.name=Smith&code=http://loinc.org|2339-0&date=ge2024-01-01

# Find active practitioners with MD qualification
GET /api/fhir/Practitioner?qualification=MD&active=true

# Find conditions with category for patients with encounters
GET /api/fhir/Condition?category=problem-list-item&encounter:missing=false

# Find medication requests without identifiers for specific patient
GET /api/fhir/MedicationRequest?identifier:missing=true&patient=123
```

## Performance Considerations

1. **Identifier Search**: Indexed via GIN index on JSONB identifier field
2. **Missing Modifier**: Uses PostgreSQL JSONB operators for efficiency
3. **Chained Parameters**: Creates subqueries - may be slower for large datasets
4. **Token Searches**: JSONB path queries optimized by PostgreSQL

## Migration Notes

- No database schema changes required for Phase 2
- All features backward compatible
- Existing searches continue to work unchanged
- New features opt-in via search parameters

## Testing

Run the Phase 2 test suite:
```bash
docker-compose exec backend pytest tests/test_phase2_fhir_search.py -v
```

## Future Enhancements

### Phase 3 Possibilities
- Reverse chaining (_has parameter)
- Advanced modifiers (:above, :below for hierarchical codes)
- Composite search parameters
- _filter parameter for complex boolean logic
- GraphQL support

### Performance Optimizations
- Materialized views for common chains
- Search result caching
- Parallel query execution
- Search parameter indexing

## References

- [FHIR R4 Search](https://www.hl7.org/fhir/search.html)
- [FHIR Search Parameters](https://www.hl7.org/fhir/searchparameter-registry.html)
- [Chained Parameters](https://www.hl7.org/fhir/search.html#chaining)
- [Search Modifiers](https://www.hl7.org/fhir/search.html#modifiers)