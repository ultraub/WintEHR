# FHIR Search Parameter Implementation Guide

**Date**: 2025-01-19  
**Status**: Active Implementation

## Overview

This guide documents the implementation of FHIR R4 search parameters for the WintEHR system. It provides patterns learned from the Patient resource implementation and guidelines for implementing search parameters for all supported resources.

## Key Learnings from Patient Implementation

### 1. Search Parameter Types

- **token**: For coded values (gender, language, identifiers)
  - Always include both system and code when available
  - Example: `value_token_system='http://hl7.org/fhir/administrative-gender', value_token_code='female'`

- **string**: For human-readable text (names, addresses)
  - Always lowercase for case-insensitive searching
  - Example: `value_string=name['family'].lower()`

- **date**: For date/time values (birthDate, deceasedDateTime)
  - Use proper datetime parsing with error handling
  - Example: `datetime.strptime(resource_data['birthDate'], '%Y-%m-%d')`

- **reference**: For references to other resources
  - Store the full reference string
  - Example: `value_reference=gp['reference']`

### 2. Implementation Patterns

#### Pattern 1: Token Parameters with System
```python
if 'gender' in resource_data:
    params_to_extract.append({
        'param_name': 'gender',
        'param_type': 'token',
        'value_token_system': 'http://hl7.org/fhir/administrative-gender',
        'value_token_code': resource_data['gender']
    })
```

#### Pattern 2: Composite Name Search
```python
# Build full name from parts for general search
name_parts = []
if 'given' in name:
    name_parts.extend(name['given'])
if 'family' in name:
    name_parts.append(name['family'])
if name_parts:
    full_name = ' '.join(name_parts)
    params_to_extract.append({
        'param_name': 'name',
        'param_type': 'string',
        'value_string': full_name.lower()
    })
```

#### Pattern 3: Address Components
```python
# Index both full address and components
if 'city' in address:
    params_to_extract.append({
        'param_name': 'address-city',
        'param_type': 'string',
        'value_string': address['city'].lower()
    })
```

#### Pattern 4: Array Handling
```python
# Handle arrays of complex types
if 'identifier' in resource_data:
    for identifier in resource_data['identifier']:
        if 'value' in identifier:
            params_to_extract.append({
                'param_name': 'identifier',
                'param_type': 'token',
                'value_token_system': identifier.get('system'),
                'value_token_code': identifier['value']
            })
```

## Common Issues and Solutions

### Issue 1: Datetime Serialization in Cache
**Problem**: Cache was failing when trying to JSON serialize datetime objects.
**Solution**: Convert datetime objects to ISO format strings in cache key generation.

### Issue 2: Missing Search Parameter Values
**Problem**: Gender searches returned no results because only the code was indexed without system.
**Solution**: Always include both system and code for token parameters when the system is known.

### Issue 3: Case Sensitivity
**Problem**: String searches were case-sensitive by default.
**Solution**: Always lowercase string values during indexing and searching.

## Implementation Status by Resource Type

### ✅ Completed
1. **Patient** - All 15+ search parameters implemented
   - identifier, name, family, given, phonetic, gender, birthdate, deceased, death-date, address, address-city, address-state, address-postalcode, address-country, telecom, phone, language, general-practitioner, organization

### 🔧 Partially Implemented
2. **Observation** - Basic parameters only
   - Need: value-quantity, value-concept, component-code, component-value-quantity
   
3. **Condition** - Basic parameters only
   - Need: severity, evidence, stage, abatement-date, recorded-date
   
4. **MedicationRequest** - Basic parameters only
   - Need: intent, priority, requester, intended-performer, intended-dispenser

5. **Encounter** - Basic parameters only
   - Need: class, service-provider, episode-of-care, diagnosis, reason-code

### ❌ Not Implemented
6. **Practitioner** - No search parameters
7. **Organization** - No search parameters
8. **Location** - No search parameters
9. **Appointment** - No search parameters
10. **Procedure** - Basic parameters only
11. **Medication** - No search parameters
12. **DiagnosticReport** - Basic parameters only
13. **ImagingStudy** - No search parameters
14. **CarePlan** - No search parameters
15. **Goal** - No search parameters
16. **Immunization** - Basic parameters only
17. **AllergyIntolerance** - Basic parameters only
18. **DocumentReference** - No search parameters
19. **Task** - No search parameters
20. **ServiceRequest** - No search parameters
... (and others)

## Next Steps

### Immediate Priority
1. **Create comprehensive extraction for Practitioner**
   - name, identifier, given, family, gender, active, communication
   
2. **Create comprehensive extraction for Organization**
   - name, identifier, active, type, address, partof
   
3. **Enhance Observation extraction**
   - Add value-quantity, value-concept, component searches

### Scripts Needed
1. **Comprehensive re-indexing script** that:
   - Re-indexes ALL resources with proper search parameters
   - Shows progress and handles errors gracefully
   - Can be run during deployment

2. **Search parameter verification script** that:
   - Checks if all expected parameters are indexed
   - Reports missing parameters by resource type
   - Can fix missing parameters automatically

## Testing Checklist

For each resource type, test:
- [ ] Token searches (with and without system)
- [ ] String searches (case insensitive)
- [ ] Date searches (exact and ranges)
- [ ] Reference searches
- [ ] Composite searches (like name)
- [ ] Multiple parameter searches (AND logic)

## References

- [FHIR R4 Search](https://www.hl7.org/fhir/search.html)
- [FHIR R4 Search Parameters](https://www.hl7.org/fhir/searchparameter-registry.html)
- [Patient Search Parameters](https://www.hl7.org/fhir/patient.html#search)