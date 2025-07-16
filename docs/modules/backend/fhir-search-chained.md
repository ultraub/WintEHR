# FHIR R4 Chained Search Implementation

## Overview

This document describes the implementation of FHIR R4 chained search functionality in the MedGenEMR system, completed on 2025-07-16.

## What are Chained Searches?

Chained searches allow searching for resources based on the properties of resources they reference. For example, finding all Observations for patients with a specific name, without knowing the patient IDs.

## Implementation Details

### Core Components

1. **SearchParameterHandler** (`backend/fhir/core/search/basic.py`)
   - `_parse_chained_parameter()` - Parses chain syntax
   - `_build_chained_clause()` - Generates SQL for chains
   - `_build_simple_chain_clause()` - Single-level chains
   - `_build_multilevel_chain_clause()` - Multi-level chains (up to 2 levels)

### Supported Chain Types

1. **Simple Chains**
   ```
   Patient?general-practitioner.name=Smith
   Observation?patient.family=Doe
   ```

2. **Type-Specific Chains** (for polymorphic references)
   ```
   Observation?subject:Patient.name=John
   MedicationRequest?subject:Patient.identifier=12345
   ```

3. **Multi-Level Chains** (limited to 2 levels)
   ```
   Patient?managingOrganization.partOf.name=Hospital
   ```

### SQL Generation Strategy

The implementation uses EXISTS subqueries for efficient filtering:

```sql
EXISTS (
    SELECT 1 FROM fhir.resources chain_1
    WHERE chain_1.resource_type = 'Practitioner'
    AND chain_1.deleted = false
    AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(chain_1.resource->'name') AS n
        WHERE n->>'family' ILIKE '%Smith%'
    )
    AND (
        r.resource->'generalPractitioner'->>'reference' = 
            'Practitioner/' || chain_1.fhir_id
    )
)
```

### Reference Type Mappings

Common reference parameters are automatically mapped to resource types:

| Parameter | Target Type |
|-----------|-------------|
| subject | Patient |
| patient | Patient |
| performer | Practitioner |
| requester | Practitioner |
| organization | Organization |
| encounter | Encounter |
| general-practitioner | Practitioner |

### Supported Target Parameters

The following parameters can be used in chains:

- **Human Names**: name, family, given
- **Identifiers**: identifier
- **Demographics**: birthdate, gender
- **Codes**: code (searches in coding array)
- **Generic**: Any other field (uses ILIKE search)

## Usage Examples

### Clinical Scenarios

1. **Find all lab results for patients of a specific doctor**
   ```
   GET /api/fhir/Observation?category=laboratory&performer.name=Smith
   ```

2. **Find medications prescribed by a specific practitioner**
   ```
   GET /api/fhir/MedicationRequest?requester.identifier=NPI123456
   ```

3. **Find patients in a specific healthcare network**
   ```
   GET /api/fhir/Patient?managingOrganization.partOf.name=Regional%20Health
   ```

### Combined with Other Features

Chained searches work with other FHIR search features:

```bash
# Chain + Include
GET /api/fhir/Observation?patient.name=John&_include=Observation:patient

# Chain + Date filter
GET /api/fhir/Observation?patient.birthdate=1970-01-01&date=ge2024-01-01

# Multiple chains
GET /api/fhir/Observation?patient.family=Doe&performer.name=Smith
```

## Testing

Comprehensive tests are provided in:
- `backend/tests/fhir/test_chained_searches.py` - Unit tests
- `test_chained_search_manual.py` - Manual integration test

## Performance Considerations

1. **Indexed Columns**: Ensure `resource_type`, `fhir_id`, and `deleted` are indexed
2. **JSONB Indexes**: Consider GIN indexes for frequently searched JSON paths
3. **Query Planning**: EXISTS subqueries are generally efficient for PostgreSQL
4. **Caching**: Results can be cached at the application level

## Limitations

1. **Chain Depth**: Limited to 2 levels (e.g., a.b.c but not a.b.c.d)
2. **Performance**: Very deep chains or chains on large datasets may be slow
3. **Wildcards**: Chain targets must be exact matches (no wildcard support)

## Future Enhancements

1. Support for deeper chain levels (3+)
2. Optimization for common chain patterns
3. Chain parameter caching
4. Support for _has parameter (reverse chaining)

## References

- [FHIR R4 Search - Chained Parameters](https://hl7.org/fhir/R4/search.html#chaining)
- [FHIR Search Implementation Guide](https://www.hl7.org/fhir/search.html)