# FHIR R4 Implementation Quick Reference

## Phase 1: Critical Patient Safety (Weeks 1-2)

### 1.1 Medication Lot Tracking ⚠️ CRITICAL
```python
# File: backend/api/fhir/fhir_router.py
# Add to MedicationDispense search params:
- lot-number
- expiration-date

# Why: Patient safety - medication recalls
```

### 1.2 Order-to-Result Linking ⚠️ CRITICAL  
```python
# Add "based-on" parameter to:
- Observation
- DiagnosticReport

# Why: Track which results fulfill which orders
```

### 1.3 Condition Categories ⚠️ CRITICAL
```python
# Add "category" to Condition
# Values: problem-list-item | encounter-diagnosis

# Why: Distinguish active problems from visit diagnoses
```

### 1.4 Provenance Search ⚠️ CRITICAL
```python
# Enable search for existing Provenance model
# Parameters: target, agent, activity, recorded

# Why: Data integrity and audit trails
```

## Phase 2: Core Workflows (Weeks 3-6)

### 2.1 Add Identifier Search
Missing on: Observation, Condition, Procedure, Immunization, DiagnosticReport, ServiceRequest, Task

### 2.2 Missing Modifier
```python
# Implement :missing globally
# Example: GET /Patient?phone:missing=true
```

### 2.3 Practitioner Qualifications
```python
# Add "qualification" search
# Find providers by specialty/credentials
```

### 2.4 Basic Chaining
```python
# Priority chains:
- subject:Patient.name
- performer:Practitioner.name  
- encounter:Encounter.type
```

## Quick Implementation Patterns

### Adding a Search Parameter
```python
# 1. Add to RESOURCE_MAPPINGS
"search_params": [..., "new-param"]

# 2. Add handler method
def _handle_resource_params(self, query, param, value, modifier):
    if param == "new-param":
        # Implementation

# 3. Add to storage.py definitions
'new-param': {'type': 'token|string|date|reference'}
```

### Common Parameter Types
```python
# Token (exact match)
query.filter(Model.field == value)

# String (partial match)
query.filter(Model.field.ilike(f"%{value}%"))

# Date (with modifiers)
self._apply_date_filter(query, Model.date_field, value, modifier)

# Reference
query.filter(Model.reference_field == f"ResourceType/{id}")
```

## Priority by Clinical Impact

### 🔴 Patient Safety (Phase 1)
1. Medication lot tracking
2. Order-result linking
3. Problem list categories
4. Data provenance

### 🟡 Daily Operations (Phase 2)
1. Identifier searches
2. Missing data queries
3. Provider credentials
4. Basic chaining

### 🟢 Enhanced Features (Phase 3+)
1. Complex lab searches
2. Advanced modifiers
3. ValueSet integration
4. Special operations

## Testing Checklist

### For Each Parameter Added
- [ ] Unit test with valid data
- [ ] Test with missing data
- [ ] Test with invalid format
- [ ] Test modifiers (if applicable)
- [ ] Performance test with large dataset
- [ ] Clinical workflow test

## Common Pitfalls to Avoid

1. **Don't forget R4/R5 compatibility**
   - MedicationRequest uses different fields
   - Check version negotiation

2. **Handle both reference formats**
   ```python
   # Both must work:
   "Patient/123"
   "urn:uuid:123"
   ```

3. **Always validate search parameters**
   - Check against allowed list
   - Return proper OperationOutcome

4. **Test with real Synthea data**
   - Don't assume fields exist
   - Handle null/missing gracefully

## File Locations

- Main Router: `/backend/api/fhir/fhir_router.py`
- Storage Engine: `/backend/core/fhir/storage.py`
- Search Handler: `/backend/core/fhir/search.py`
- Query Builder: `/backend/api/fhir/query_builder.py`
- Models: `/backend/models/`

## Git Commit Format
```bash
feat(fhir): Add lot-number search to MedicationDispense
fix(fhir): Enable based-on parameter for Observation
docs(fhir): Update search parameter documentation
```

## Questions to Ask

Before implementing:
1. Is this parameter in the FHIR R4 spec?
2. What's the clinical use case?
3. What modifier support is needed?
4. Are there performance implications?
5. How does this integrate with existing workflows?

## Resources

- FHIR R4 Spec: https://hl7.org/fhir/R4/
- Search Parameters: https://hl7.org/fhir/R4/search.html
- MedGenEMR Docs: `/docs/modules/`