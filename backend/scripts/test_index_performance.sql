-- Test script to verify index performance improvements
-- Run before and after index optimization to compare

\timing on

-- Test 1: Patient-centric query
EXPLAIN (ANALYZE, BUFFERS) 
SELECT COUNT(*) FROM fhir.resources r
JOIN fhir.search_params sp ON r.id = sp.resource_id
WHERE sp.param_name = 'patient' 
AND sp.value_reference = (
    SELECT 'Patient/' || fhir_id 
    FROM fhir.resources 
    WHERE resource_type = 'Patient' 
    LIMIT 1
)
AND r.resource_type = 'Observation';

-- Test 2: Date range query
EXPLAIN (ANALYZE, BUFFERS)
SELECT COUNT(*) FROM fhir.resources r
JOIN fhir.search_params sp ON r.id = sp.resource_id
WHERE r.resource_type = 'Encounter'
AND sp.param_name = 'date'
AND sp.value_date BETWEEN CURRENT_DATE - INTERVAL '1 year' AND CURRENT_DATE;

-- Test 3: Active medications
EXPLAIN (ANALYZE, BUFFERS)
SELECT COUNT(*) FROM fhir.resources
WHERE resource_type = 'MedicationRequest' 
AND deleted = false
AND (resource->>'status' = 'active')
AND (resource->'subject'->>'reference') = (
    SELECT 'Patient/' || fhir_id 
    FROM fhir.resources 
    WHERE resource_type = 'Patient' 
    LIMIT 1
);

-- Test 4: Code search
EXPLAIN (ANALYZE, BUFFERS)
SELECT COUNT(*) FROM fhir.resources r
JOIN fhir.search_params sp ON r.id = sp.resource_id
WHERE r.resource_type = 'Observation'
AND sp.param_name = 'code'
AND sp.value_token_code = '85354-9';

-- Test 5: Recent observations by category
EXPLAIN (ANALYZE, BUFFERS)
SELECT COUNT(*) FROM fhir.resources
WHERE resource_type = 'Observation'
AND deleted = false
AND (resource->'category'->0->'coding'->0->>'code' = 'vital-signs')
AND (resource->>'effectiveDateTime') > (CURRENT_DATE - INTERVAL '30 days')::text;

-- Show index usage statistics
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch,
    pg_size_pretty(pg_relation_size(schemaname||'.'||indexname)) as size
FROM pg_stat_user_indexes
WHERE schemaname = 'fhir'
AND idx_scan > 0
ORDER BY idx_scan DESC
LIMIT 20;