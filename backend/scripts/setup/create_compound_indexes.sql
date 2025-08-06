-- Compound Index Creation Script for Performance Optimization
-- Author: WintEHR Team
-- Date: 2025-01-24
-- Purpose: Add critical compound indexes to resolve performance issues

-- Connect to the database
\c emr_db

-- Set timing on to see how long each index takes
\timing on

-- Compound indexes for search_params table
-- These dramatically improve multi-parameter searches

-- 1. Compound index for string searches
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_params_compound_string 
ON fhir.search_params (resource_type, param_name, value_string) 
WHERE value_string IS NOT NULL;

COMMENT ON INDEX idx_search_params_compound_string IS 'Compound index for string searches';

-- 2. Compound index for token searches
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_params_compound_token 
ON fhir.search_params (resource_type, param_name, value_token) 
WHERE value_token IS NOT NULL;

COMMENT ON INDEX idx_search_params_compound_token IS 'Compound index for token searches';

-- 3. Compound index for reference searches
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_params_compound_reference 
ON fhir.search_params (resource_type, param_name, value_reference) 
WHERE value_reference IS NOT NULL;

COMMENT ON INDEX idx_search_params_compound_reference IS 'Compound index for reference searches';

-- 4. Compound index for date searches
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_params_compound_date 
ON fhir.search_params (resource_type, param_name, value_date) 
WHERE value_date IS NOT NULL;

COMMENT ON INDEX idx_search_params_compound_date IS 'Compound index for date searches';

-- 5. Compound index for number searches
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_params_compound_number 
ON fhir.search_params (resource_type, param_name, value_number) 
WHERE value_number IS NOT NULL;

COMMENT ON INDEX idx_search_params_compound_number IS 'Compound index for number searches';

-- 6. Specialized index for patient reference searches (covers beneficiary, patient, subject)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_params_patient_reference 
ON fhir.search_params (param_name, value_reference, resource_type) 
WHERE param_name IN ('patient', 'subject', 'beneficiary');

COMMENT ON INDEX idx_search_params_patient_reference IS 'Optimized for patient reference searches';

-- 7. Specialized index for status searches
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_params_status_token 
ON fhir.search_params (param_name, value_token, resource_type) 
WHERE param_name = 'status';

COMMENT ON INDEX idx_search_params_status_token IS 'Optimized for status searches';

-- 8. Covering index for resources table
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_resources_covering 
ON fhir.resources (resource_type, fhir_id, deleted, last_updated) 
WHERE deleted = false;

COMMENT ON INDEX idx_resources_covering IS 'Covering index for resource lookups';

-- 9. Index for search params resource lookup (optimizes JOINs)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_params_resource_lookup 
ON fhir.search_params (resource_id, resource_type, param_name);

COMMENT ON INDEX idx_search_params_resource_lookup IS 'Optimize JOIN operations';

-- Update table statistics for query planner
ANALYZE fhir.resources;
ANALYZE fhir.search_params;
ANALYZE fhir.references;
ANALYZE fhir.compartments;

-- Show all indexes on search_params table
\di fhir.search_params*

-- Show index sizes
SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(schemaname||'.'||indexname::text)) as index_size
FROM pg_indexes
WHERE schemaname = 'fhir'
AND (indexname LIKE '%compound%' OR indexname LIKE '%covering%' OR indexname LIKE '%patient_reference%' OR indexname LIKE '%status_token%')
ORDER BY pg_relation_size(schemaname||'.'||indexname::text) DESC;

\echo 'Index creation completed successfully!'