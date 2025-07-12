# FHIR References Table Report

## Summary
The `fhir.references` table is now fully functional and populated with all FHIR resource references from the database.

## Current Status
- **Total References**: 113,757
- **Unique Source Resources**: 24,244
- **Unique Target Resources**: 24,688
- **Unique Relationship Types**: 52

## Key Findings

### 1. Schema Structure
The references table correctly stores:
- `source_id` (BIGINT) - Foreign key to fhir.resources.id
- `source_type` (VARCHAR 50) - Source resource type
- `target_type` (VARCHAR 50) - Target resource type  
- `target_id` (VARCHAR 255) - FHIR ID of the target resource
- `reference_path` (VARCHAR 100) - JSON path where reference was found
- `reference_value` (TEXT) - Original reference value
- `created_at` (TIMESTAMP) - When reference was extracted

### 2. Fixed Issues
- **Problem**: Reference extraction was disabled due to incorrect assumption about schema
- **Solution**: Fixed `_extract_references` method to properly store references
- **Enhancement**: Added `_infer_resource_type_from_path` to handle urn:uuid references

### 3. Reference Formats Handled
- Standard format: `ResourceType/id` (e.g., `Patient/123`)
- URN format: `urn:uuid:xxx` (common in Synthea data)
- Query format: `ResourceType?identifier=xxx` (used in some references)
- Internal references: `#xxx` (skipped as they refer to contained resources)

### 4. Top Reference Patterns
1. **Observation -> Patient** (8,599 references via subject)
2. **Observation -> Encounter** (8,599 references via encounter)
3. **Procedure -> Patient** (3,928 references via subject)
4. **Procedure -> Encounter** (3,928 references via encounter)
5. **DiagnosticReport -> Patient** (2,431 references via subject)

### 5. Reference Extraction Performance
- Processed 24,939 resources in ~18 seconds
- Batch processing with 100 resources per batch
- Commits every 1,000 resources for reliability

## Usage Examples

### Find all resources for a patient
```sql
SELECT source_type, COUNT(*) 
FROM fhir.references 
WHERE target_type = 'Patient' 
AND target_id = 'patient-id'
GROUP BY source_type;
```

### Find reference chains
```sql
-- Observation -> Encounter -> Patient
SELECT obs.*, enc.*, pat.*
FROM fhir.resources obs
JOIN fhir.references ref1 ON ref1.source_id = obs.id 
JOIN fhir.resources enc ON enc.fhir_id = ref1.target_id
JOIN fhir.references ref2 ON ref2.source_id = enc.id
JOIN fhir.resources pat ON pat.fhir_id = ref2.target_id
WHERE obs.resource_type = 'Observation';
```

### Reverse lookups
```sql
-- Find patients with specific conditions
SELECT DISTINCT pat.*
FROM fhir.resources cond
JOIN fhir.references ref ON ref.source_id = cond.id
JOIN fhir.resources pat ON pat.fhir_id = ref.target_id
WHERE cond.resource_type = 'Condition'
AND cond.resource->>'code' LIKE '%diabetes%';
```

## Maintenance

### Populate references for new resources
The `_extract_references` method is automatically called when:
- Creating new resources (`create_resource`)
- Updating existing resources (`update_resource`)

### Bulk population script
Use `populate_references_table.py` to rebuild the entire references table:
```bash
python scripts/populate_references_table.py
```

## Next Steps
1. ✅ References are now automatically extracted on resource create/update
2. ✅ All existing resources have been processed
3. ✅ Reference queries are working correctly
4. Consider adding database triggers as a backup to ensure references are always extracted
5. Consider adding reference validation to check if target resources exist