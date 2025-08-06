# CLAUDE.md - FHIR Implementation Quick Reference

**Purpose**: Essential guide for AI agents working with WintEHR's FHIR storage engine and REST API implementation.

**Last Updated**: 2025-01-20

## 🎯 Overview

This directory contains the core FHIR R4 implementation for WintEHR, providing:
- Complete FHIR R4 storage engine with PostgreSQL
- Search parameter extraction and indexing
- Resource validation and versioning
- Bundle processing and transactions
- FHIR operations ($everything, $match, etc.)

## 📁 Directory Structure

```
backend/fhir/
├── __init__.py                  # Package initialization
├── core/                        # Core FHIR functionality
│   ├── storage.py              # Main FHIRStorageEngine class
│   ├── search_params.py        # Search parameter extraction
│   ├── search_handler.py       # Search query processing
│   ├── operation_handler.py    # FHIR operations
│   ├── reference_resolver.py   # Reference resolution
│   └── bundle_processor.py     # Bundle handling
├── models/                      # FHIR resource models
│   └── search_parameters.py    # Search param definitions
├── utils/                       # Utility functions
│   ├── fhir_validator.py       # Resource validation
│   └── query_builder.py        # SQL query construction
└── constants.py                 # FHIR constants

```

## 🔧 Core Components

### FHIRStorageEngine (`core/storage.py`)
Main storage interface for all FHIR operations:
```python
# Key methods:
async def create_resource(resource_type: str, data: dict) -> dict
async def update_resource(resource_type: str, resource_id: str, data: dict) -> dict
async def get_resource(resource_type: str, resource_id: str) -> dict
async def search_resources(resource_type: str, params: dict) -> dict
async def delete_resource(resource_type: str, resource_id: str) -> dict
```

### SearchParameterExtractor (`core/search_params.py`)
Extracts and indexes searchable parameters from resources:
```python
# Automatic extraction during create/update
# Supports all FHIR search parameter types:
# - string, token, reference, date, number, quantity, composite
```

### SearchParameterHandler (`core/search_handler.py`)
Processes search queries with full FHIR search syntax:
```python
# Supports:
# - Simple searches: ?name=Smith
# - Modifiers: ?name:contains=john
# - Chained searches: ?subject:Patient.name=Smith
# - Composite searches: ?component-code-value=8480-6$lt90
```

### OperationHandler (`core/operation_handler.py`)
Implements FHIR operations:
- `Patient/$everything` - Get all resources for a patient
- `Observation/$lastn` - Get last N observations
- Custom operations as needed

## ⚠️ Critical Implementation Details

### Search Parameter Indexing
**MUST index search parameters** for all resources:
```python
# Automatic during resource creation:
await self._index_search_parameters(resource_type, resource_id, data)

# Manual re-indexing if needed:
python scripts/consolidated_search_indexing.py --mode index
```

### Key Search Parameters
- **_id**: Resource identifier
- **patient/subject**: Patient reference (critical for clinical queries)
- **code**: Clinical codes
- **status**: Resource status
- **date**: Temporal searches

### Database Tables
All managed by FHIRStorageEngine:
- `fhir.resources` - Main resource storage
- `fhir.resource_history` - Version history
- `fhir.search_params` - Search indexes
- `fhir.references` - Resource relationships
- `fhir.compartments` - Patient compartments
- `fhir.audit_logs` - Audit trail

## 🚀 Common Operations

### Creating Resources
```python
# Always validate before creation
patient_data = {
    "resourceType": "Patient",
    "name": [{"family": "Smith", "given": ["John"]}],
    "birthDate": "1970-01-01"
}

result = await storage.create_resource("Patient", patient_data)
# Automatically indexes search parameters
# Updates compartments if applicable
```

### Searching Resources
```python
# Simple search
patients = await storage.search_resources("Patient", {"name": "Smith"})

# Complex search with modifiers
conditions = await storage.search_resources("Condition", {
    "patient": "Patient/123",
    "clinical-status": "active",
    "onset-date": "ge2024-01-01"
})

# Search with includes
encounters = await storage.search_resources("Encounter", {
    "patient": "Patient/123",
    "_include": "Encounter:practitioner"
})
```

### Bundle Processing
```python
# Transaction bundle
bundle = {
    "resourceType": "Bundle",
    "type": "transaction",
    "entry": [...]
}

result = await storage.process_bundle(bundle)
```

## 🐛 Troubleshooting

### Empty Search Results
```bash
# Check if search parameters are indexed
docker exec emr-backend python scripts/verify_search_params_after_import.py

# Re-index if needed
docker exec emr-backend python scripts/consolidated_search_indexing.py --mode index
```

### Reference Resolution Issues
```bash
# Verify references table
docker exec emr-postgres psql -U emr_user -d emr_db -c "
SELECT COUNT(*) FROM fhir.references 
WHERE source_type = 'MedicationRequest';"
```

### Performance Issues
```bash
# Check index usage
docker exec emr-postgres psql -U emr_user -d emr_db -c "
EXPLAIN ANALYZE 
SELECT * FROM fhir.search_params 
WHERE resource_type = 'Patient' AND param_name = 'name';"
```

## 📝 Best Practices

1. **Always Use Synthea Data**: Never create mock patient data
2. **Validate Resources**: Use FHIR validator before storage
3. **Index Search Parameters**: Critical for query performance
4. **Handle References**: Maintain referential integrity
5. **Version Resources**: Track all changes in history
6. **Test with Real Data**: Use actual Synthea patients
7. **Monitor Performance**: Check query execution plans

## 🔗 Related Documentation

- **Main CLAUDE.md**: `/CLAUDE.md` - Project overview
- **API Documentation**: `/docs/API_ENDPOINTS.md`
- **Search Indexing**: `/docs/SEARCH_PARAM_BUILD_INTEGRATION_SUMMARY.md`
- **Storage Details**: `/docs/modules/backend/fhir-storage.md`

## 💡 Quick Tips

- Search parameters are extracted automatically during resource creation
- Use `_summary=true` for faster searches when full resources aren't needed
- Patient compartments enable efficient `$everything` operations
- Bundle transactions are atomic - all succeed or all fail
- Resource history is maintained automatically
- Always handle null/undefined references gracefully

---

**Remember**: This is the core of WintEHR's data layer. Data integrity and FHIR compliance are paramount.