-- Wipe Legacy FHIR Data from PostgreSQL
-- Date: 2025-10-04
-- Purpose: Remove all FHIR data from PostgreSQL fhir.* tables
--          HAPI FHIR is now the sole FHIR data source

-- WARNING: This is irreversible! HAPI FHIR is now the source of truth.

BEGIN;

-- Record counts before deletion (for verification)
DO $$
DECLARE
    resources_count INTEGER;
    search_params_count INTEGER;
    compartments_count INTEGER;
    references_count INTEGER;
    history_count INTEGER;
    audit_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO resources_count FROM fhir.resources;
    SELECT COUNT(*) INTO search_params_count FROM fhir.search_params;
    SELECT COUNT(*) INTO compartments_count FROM fhir.compartments;
    SELECT COUNT(*) INTO references_count FROM fhir.references;
    SELECT COUNT(*) INTO history_count FROM fhir.resource_history;
    SELECT COUNT(*) INTO audit_count FROM fhir.audit_logs;

    RAISE NOTICE 'PRE-DELETION COUNTS:';
    RAISE NOTICE '  fhir.resources: %', resources_count;
    RAISE NOTICE '  fhir.search_params: %', search_params_count;
    RAISE NOTICE '  fhir.compartments: %', compartments_count;
    RAISE NOTICE '  fhir.references: %', references_count;
    RAISE NOTICE '  fhir.resource_history: %', history_count;
    RAISE NOTICE '  fhir.audit_logs: %', audit_count;
END $$;

-- Truncate tables in correct order (respecting foreign keys)
TRUNCATE TABLE fhir.search_params CASCADE;
TRUNCATE TABLE fhir.compartments CASCADE;
TRUNCATE TABLE fhir.references CASCADE;
TRUNCATE TABLE fhir.resource_history CASCADE;
TRUNCATE TABLE fhir.audit_logs CASCADE;
TRUNCATE TABLE fhir.resources CASCADE;

-- Verify deletion
DO $$
DECLARE
    total_remaining INTEGER;
BEGIN
    SELECT
        (SELECT COUNT(*) FROM fhir.resources) +
        (SELECT COUNT(*) FROM fhir.search_params) +
        (SELECT COUNT(*) FROM fhir.compartments) +
        (SELECT COUNT(*) FROM fhir.references) +
        (SELECT COUNT(*) FROM fhir.resource_history) +
        (SELECT COUNT(*) FROM fhir.audit_logs)
    INTO total_remaining;

    IF total_remaining > 0 THEN
        RAISE EXCEPTION 'Deletion failed! % rows remaining', total_remaining;
    ELSE
        RAISE NOTICE 'SUCCESS: All legacy FHIR data deleted';
        RAISE NOTICE 'HAPI FHIR is now the sole FHIR data source';
    END IF;
END $$;

COMMIT;

-- Add comment to tables indicating they are no longer used
COMMENT ON TABLE fhir.resources IS 'DEPRECATED: HAPI FHIR is now the FHIR data source. This table is kept for schema compatibility only.';
COMMENT ON TABLE fhir.search_params IS 'DEPRECATED: HAPI FHIR is now the FHIR data source. This table is kept for schema compatibility only.';
COMMENT ON TABLE fhir.compartments IS 'DEPRECATED: HAPI FHIR is now the FHIR data source. This table is kept for schema compatibility only.';
COMMENT ON TABLE fhir.references IS 'DEPRECATED: HAPI FHIR is now the FHIR data source. This table is kept for schema compatibility only.';
COMMENT ON TABLE fhir.resource_history IS 'DEPRECATED: HAPI FHIR is now the FHIR data source. This table is kept for schema compatibility only.';
COMMENT ON TABLE fhir.audit_logs IS 'DEPRECATED: HAPI FHIR is now the FHIR data source. This table is kept for schema compatibility only.';
