# FHIR Search API - Phase 3 Documentation

## Overview

This document covers the Phase 3 advanced FHIR search features, implementing sophisticated query capabilities required for clinical decision support, population health, and complex EMR workflows.

## Phase 3A Features (Critical for Clinical Use)

### 3A.1 Enhanced _include Parameter

The `_include` parameter now supports comprehensive reference inclusion across all major reference fields.

#### Supported Include Paths
```
Observation:subject          # Include referenced Patient
Observation:encounter        # Include referenced Encounter
Observation:performer        # Include referenced Practitioner
Observation:basedOn         # Include referenced ServiceRequest

Condition:subject/patient    # Include referenced Patient
Condition:encounter         # Include referenced Encounter

Procedure:subject/patient   # Include referenced Patient
Procedure:performer         # Include referenced Practitioner
Procedure:encounter         # Include referenced Encounter

MedicationRequest:patient   # Include referenced Patient
MedicationRequest:medication # Include referenced Medication
MedicationRequest:prescriber # Include referenced Practitioner

Encounter:subject/patient   # Include referenced Patient
Encounter:serviceProvider   # Include referenced Organization
Encounter:location          # Include referenced Location
```

#### Examples
```bash
# Include patient with observations
GET /api/fhir/Observation?_include=Observation:subject

# Include encounter and patient
GET /api/fhir/Condition?_include=Condition:encounter&_include=Condition:subject

# Include medication details with prescriptions
GET /api/fhir/MedicationRequest?_include=MedicationRequest:medication

# Multiple includes
GET /api/fhir/Observation?_include=Observation:subject&_include=Observation:encounter
```

### 3A.2 Enhanced _revinclude Parameter

The `_revinclude` parameter now supports more resource types and reference fields.

#### Supported Revinclude Paths
```
# Patient-based revincludes
Patient <- Observation:patient
Patient <- Condition:patient
Patient <- MedicationRequest:patient
Patient <- AllergyIntolerance:patient
Patient <- Immunization:patient
Patient <- Procedure:patient
Patient <- DiagnosticReport:patient
Patient <- DocumentReference:patient
Patient <- CarePlan:patient

# Encounter-based revincludes
Encounter <- Observation:encounter
Encounter <- Condition:encounter
Encounter <- Procedure:encounter
Encounter <- DiagnosticReport:encounter

# Practitioner-based revincludes
Practitioner <- Observation:performer
Practitioner <- Procedure:performer
```

#### Examples
```bash
# Get patient with all clinical data
GET /api/fhir/Patient?_id=123&_revinclude=Observation:patient&_revinclude=Condition:patient

# Get encounter with all associated resources
GET /api/fhir/Encounter?_id=456&_revinclude=Observation:encounter&_revinclude=Procedure:encounter

# Get practitioner with their work
GET /api/fhir/Practitioner?_id=789&_revinclude=Observation:performer
```

### 3A.3 _has Parameter (Reverse Chaining)

The `_has` parameter enables searching for resources that are referenced by other resources matching specific criteria.

#### Syntax
```
_has:{ResourceType}:{reference}:{parameter}={value}
```

#### Supported Combinations
```
# Find patients who have specific observations
_has:Observation:patient:code={loinc_code}
_has:Observation:patient:status={status}
_has:Observation:patient:date={date}

# Find patients who have specific conditions
_has:Condition:patient:code={snomed_code}
_has:Condition:patient:clinical-status={status}

# Find patients who have specific medications
_has:MedicationRequest:patient:code={rxnorm_code}
_has:MedicationRequest:patient:status={status}

# Find patients who have specific procedures
_has:Procedure:patient:code={procedure_code}
_has:Procedure:patient:status={status}
```

#### Examples
```bash
# Find all patients with glucose observations
GET /api/fhir/Patient?_has:Observation:patient:code=http://loinc.org|2339-0

# Find patients with active diabetes
GET /api/fhir/Patient?_has:Condition:patient:code=http://snomed.info/sct|44054006&_has:Condition:patient:clinical-status=active

# Find patients on insulin
GET /api/fhir/Patient?_has:MedicationRequest:patient:code=http://www.nlm.nih.gov/research/umls/rxnorm|274783

# Complex query: Diabetic patients with recent high glucose
GET /api/fhir/Patient?_has:Condition:patient:code=http://snomed.info/sct|44054006&_has:Observation:patient:code=http://loinc.org|2339-0&_has:Observation:patient:date=ge2024-01-01
```

### 3A.4 Composite Search Parameters

Composite parameters allow searching on multiple correlated values as a single unit, essential for vital signs and lab results.

#### Observation Composites

**code-value-quantity**
Search for observations with specific code AND numeric value.
```bash
# Systolic BP > 140
GET /api/fhir/Observation?code-value-quantity=http://loinc.org|8480-6$gt140

# Glucose <= 7.0
GET /api/fhir/Observation?code-value-quantity=http://loinc.org|2339-0$le7.0

# HbA1c = 6.5
GET /api/fhir/Observation?code-value-quantity=http://loinc.org|4548-4$6.5
```

**component-code-value-quantity**
Search within observation components (for multi-part observations like blood pressure).
```bash
# Systolic component > 140
GET /api/fhir/Observation?component-code-value-quantity=http://loinc.org|8480-6$gt140

# Diastolic component > 90
GET /api/fhir/Observation?component-code-value-quantity=http://loinc.org|8462-4$gt90
```

#### MedicationRequest Composites

**medication-code-status**
Search for medications with specific code AND status.
```bash
# Active insulin prescriptions
GET /api/fhir/MedicationRequest?medication-code-status=http://www.nlm.nih.gov/research/umls/rxnorm|274783$active

# Stopped beta blockers
GET /api/fhir/MedicationRequest?medication-code-status=http://www.nlm.nih.gov/research/umls/rxnorm|123456$stopped
```

#### Condition Composites

**code-status**
Search for conditions with specific code AND clinical status.
```bash
# Active diabetes
GET /api/fhir/Condition?code-status=http://snomed.info/sct|44054006$active

# Resolved hypertension
GET /api/fhir/Condition?code-status=http://snomed.info/sct|38341003$resolved
```

#### Value Comparators
- `gt` - greater than
- `ge` - greater than or equal
- `lt` - less than
- `le` - less than or equal
- `ne` - not equal
- `eq` - equal (default)

## Advanced Usage Examples

### Population Health Query
Find all patients with uncontrolled diabetes (HbA1c > 7.0):
```bash
GET /api/fhir/Patient?_has:Condition:patient:code=http://snomed.info/sct|44054006&_has:Observation:patient:code-value-quantity=http://loinc.org|4548-4$gt7.0
```

### Clinical Workflow Query
Get patient with recent labs and active medications:
```bash
GET /api/fhir/Patient?_id=123&_revinclude=Observation:patient&_revinclude=MedicationRequest:patient&_filter=Observation.date ge 2024-01-01 and MedicationRequest.status eq "active"
```

### Quality Measure Query
Find patients with hypertension who need blood pressure checks:
```bash
GET /api/fhir/Patient?_has:Condition:patient:code=http://snomed.info/sct|38341003&_has:Observation:patient:code=http://loinc.org|55284-4&_has:Observation:patient:date=lt2024-01-01
```

### Complex Multi-Resource Query
Get diabetic patients with their recent glucose readings and medications:
```bash
GET /api/fhir/Patient?_has:Condition:patient:code=http://snomed.info/sct|44054006&_revinclude=Observation:patient&_revinclude=MedicationRequest:patient&_include=Patient:generalPractitioner
```

## Performance Considerations

### Query Optimization
1. **_has queries** create subqueries - use specific search criteria to limit scope
2. **Composite parameters** are optimized for common clinical queries
3. **Multiple _include/_revinclude** may impact performance - consider pagination
4. **Combine with other filters** to reduce result set size

### Best Practices
1. Use specific codes with systems (e.g., `http://loinc.org|2339-0` vs just `2339-0`)
2. Limit _revinclude scope with additional search parameters
3. Use composite parameters instead of separate searches when possible
4. Consider using _summary parameter to reduce payload size

## Implementation Details

### Search Mode Indicators
All Bundle entries include search mode:
- `"mode": "match"` - Primary search results
- `"mode": "include"` - Resources added via _include/_revinclude

### Parameter Limits
- Multiple _has parameters use AND logic
- Multiple _include/_revinclude parameters are additive
- Composite parameters must have correct number of components

### Error Handling
- Invalid _has format: Returns empty results
- Unknown composite parameter: Returns 400 error
- Missing composite components: Ignored
- Invalid references: Skipped

## Testing

Run the Phase 3 test suite:
```bash
docker-compose exec backend pytest tests/test_phase3_fhir_search.py -v
```

## Future Enhancements (Phase 3B)

### Planned Features
1. **_filter parameter** - Complex boolean queries
2. **Advanced modifiers** - :text, :above, :below for hierarchical codes
3. **Multi-level chaining** - patient.organization.name
4. **Search result caching** - Redis-based caching for performance
5. **Async search** - Long-running searches with polling

### Not Yet Implemented
- _filter parameter with full grammar
- :iterate modifier for recursive includes
- Custom SearchParameter resources
- GraphQL interface
- Subscription support

## Migration Notes

- All Phase 3 features are backward compatible
- No database schema changes required
- Existing searches continue to work unchanged
- New features are opt-in via parameters

## References

- [FHIR R4 Search](https://www.hl7.org/fhir/search.html)
- [_include and _revinclude](https://www.hl7.org/fhir/search.html#include)
- [Reverse Chaining](https://www.hl7.org/fhir/search.html#has)
- [Composite Search Parameters](https://www.hl7.org/fhir/search.html#composite)