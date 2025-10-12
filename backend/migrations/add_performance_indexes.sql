-- Performance optimization indexes for FHIR resources
-- Run this migration to improve query performance

-- Index on resource_type and patient references (most common query pattern)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_resources_type_patient 
ON fhir.resources (resource_type, ((resource->'subject'->>'reference')));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_resources_type_patient_alt
ON fhir.resources (resource_type, ((resource->'patient'->>'reference')));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_resources_type_beneficiary
ON fhir.resources (resource_type, ((resource->'beneficiary'->>'reference')));

-- Index on last_updated for sorting and filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_resources_last_updated 
ON fhir.resources (last_updated DESC);

-- Composite index for resource_type, deleted status, and last_updated
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_resources_type_deleted_updated 
ON fhir.resources (resource_type, deleted, last_updated DESC);

-- Index on FHIR ID for individual resource lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_resources_fhir_id 
ON fhir.resources (fhir_id);

-- Composite index for resource_type and fhir_id (unique lookup)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_resources_type_fhir_id 
ON fhir.resources (resource_type, fhir_id);

-- Index on resource status fields for common filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_resources_status 
ON fhir.resources USING GIN ((resource->'status'));

-- Index on resource dates (effectiveDateTime, authoredOn, etc.)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_resources_effective_date 
ON fhir.resources USING GIN ((resource->'effectiveDateTime'));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_resources_authored_date 
ON fhir.resources USING GIN ((resource->'authoredOn'));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_resources_performed_date 
ON fhir.resources USING GIN ((resource->'performedDateTime'));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_resources_date 
ON fhir.resources USING GIN ((resource->'date'));

-- Index on observation categories for filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_resources_obs_category 
ON fhir.resources USING GIN ((resource->'category')) 
WHERE resource_type = 'Observation';

-- Index on condition clinical status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_resources_condition_status 
ON fhir.resources USING GIN ((resource->'clinicalStatus')) 
WHERE resource_type = 'Condition';

-- Index on medication status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_resources_med_status 
ON fhir.resources USING GIN ((resource->'status')) 
WHERE resource_type = 'MedicationRequest';

-- Index on encounter references for context queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_resources_encounter_ref 
ON fhir.resources USING GIN ((resource->'encounter'));

-- Index on resource codes for searching
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_resources_code 
ON fhir.resources USING GIN ((resource->'code'));

-- Analyze tables to update statistics
ANALYZE fhir.resources;