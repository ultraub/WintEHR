-- CDS Visual Builder Database Schema
-- Created: 2025-10-19
-- Updated: 2026-04-30 (added cql-based service support + student value_sets)
-- Purpose: Storage for visually-built CDS services and student-authored CQL+ValueSets

-- Create schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS cds_visual_builder;

-- Visual Service Configurations Table
CREATE TABLE IF NOT EXISTS cds_visual_builder.service_configs (
    id SERIAL PRIMARY KEY,

    -- Service Identity
    service_id VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(500) NOT NULL,
    description TEXT,

    -- Service Classification
    service_type VARCHAR(100) NOT NULL,
    category VARCHAR(100),
    hook_type VARCHAR(100) NOT NULL,

    -- Visual Configuration (JSON)
    conditions JSONB NOT NULL DEFAULT '[]',
    card_config JSONB NOT NULL,
    display_config JSONB NOT NULL DEFAULT '{}',
    prefetch_config JSONB DEFAULT '{}',

    -- CQL authoring path (service_type='cql-based').
    -- cql_source holds the student's CQL text. The deploy flow uploads it to HAPI
    -- as a Library via the dev helper (content-hash naming during draft, stable
    -- canonical URL on deploy) and pairs it with a PlanDefinition. The two
    -- canonical URL columns let the runtime dispatcher reach HAPI without
    -- re-deriving them on every request.
    cql_source TEXT,
    library_canonical_url VARCHAR(500),
    plan_definition_canonical_url VARCHAR(500),

    -- Generated Code (Python; reference only — never executed)
    generated_code TEXT,
    code_hash VARCHAR(64),

    -- Service Lifecycle
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    version INTEGER NOT NULL DEFAULT 1,

    -- Audit Fields
    created_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_deployed_at TIMESTAMP WITH TIME ZONE,

    -- Soft Delete
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by VARCHAR(255),

    -- Constraints
    CONSTRAINT valid_status CHECK (status IN ('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED'))
);

-- Backfill columns for existing deployments (the schema file is also re-run on
-- restart for idempotency; ALTERs are no-ops if the columns are already present).
ALTER TABLE cds_visual_builder.service_configs
    ADD COLUMN IF NOT EXISTS cql_source TEXT;
ALTER TABLE cds_visual_builder.service_configs
    ADD COLUMN IF NOT EXISTS library_canonical_url VARCHAR(500);
ALTER TABLE cds_visual_builder.service_configs
    ADD COLUMN IF NOT EXISTS plan_definition_canonical_url VARCHAR(500);

-- Service Version History Table
CREATE TABLE IF NOT EXISTS cds_visual_builder.service_versions (
    id SERIAL PRIMARY KEY,
    service_id VARCHAR(255) NOT NULL,
    version INTEGER NOT NULL,

    -- Configuration Snapshot
    conditions JSONB NOT NULL,
    card_config JSONB NOT NULL,
    display_config JSONB NOT NULL,
    prefetch_config JSONB,

    -- CQL snapshot (NULL for visual services)
    cql_source TEXT,

    -- Code Snapshot
    generated_code TEXT,
    code_hash VARCHAR(64),

    -- Version Metadata
    created_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    version_notes TEXT,

    CONSTRAINT unique_service_version UNIQUE (service_id, version)
);

-- Backfill cql_source on the version-history table for existing deployments.
ALTER TABLE cds_visual_builder.service_versions
    ADD COLUMN IF NOT EXISTS cql_source TEXT;

-- Service Execution Log Table
--
-- Single source of truth for service execution metrics. Populated by
-- backend/api/cds_hooks/feedback/persistence.py::log_service_execution,
-- which is called from every arm of execute_service (success + failure).
--
-- No FK constraint on service_id — built-in services (which live in
-- code rather than in service_configs) need to be able to log too. The
-- legacy `service_analytics` rollup table was dropped (see migration
-- block below) because nothing ever wrote to it; `get_service_analytics`
-- and `service.py::_get_service_metrics` now aggregate directly from
-- this table.
CREATE TABLE IF NOT EXISTS cds_visual_builder.execution_logs (
    id SERIAL PRIMARY KEY,
    service_id VARCHAR(255) NOT NULL,

    -- Execution Context
    patient_id VARCHAR(255),
    user_id VARCHAR(255),
    hook_instance VARCHAR(255),

    -- Execution Results
    success BOOLEAN NOT NULL,
    execution_time_ms INTEGER,
    cards_returned INTEGER DEFAULT 0,

    -- Error Tracking
    error_message TEXT,
    stack_trace TEXT,

    -- Timestamp
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Migrations for existing deployments — idempotent.
-- 1. Drop the legacy service_analytics rollup table; nothing wrote to it
--    and analytics now compute from execution_logs directly.
DROP TABLE IF EXISTS cds_visual_builder.service_analytics CASCADE;
-- 2. Drop the FK on execution_logs.service_id so built-in services (which
--    aren't in service_configs) can also log execution metrics.
ALTER TABLE cds_visual_builder.execution_logs
    DROP CONSTRAINT IF EXISTS fk_service_log;

-- Student-authored ValueSets (Phase 2 of the CQL feature; created here so the
-- schema is consistent in one file).
-- Each row corresponds to a real FHIR ValueSet stored in HAPI; we keep
-- metadata + the codes JSON locally for fast list/search and to know which
-- ValueSets are student-authored vs. system terminology (`wintehr-*`).
CREATE TABLE IF NOT EXISTS cds_visual_builder.value_sets (
    id BIGSERIAL PRIMARY KEY,

    vs_id VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(500) NOT NULL,
    title VARCHAR(500),
    description TEXT,

    -- The HAPI canonical URL the student references from CQL via:
    --   valueset "MyVS": '<hapi_canonical_url>'
    hapi_canonical_url VARCHAR(500) NOT NULL,

    -- Cached code list: [{system, code, display}]; kept in sync with HAPI on save.
    codes JSONB NOT NULL DEFAULT '[]',

    created_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_service_configs_status
    ON cds_visual_builder.service_configs(status)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_service_configs_hook_type
    ON cds_visual_builder.service_configs(hook_type)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_service_configs_service_type
    ON cds_visual_builder.service_configs(service_type)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_service_configs_created_by
    ON cds_visual_builder.service_configs(created_by);

CREATE INDEX IF NOT EXISTS idx_service_versions_service_id
    ON cds_visual_builder.service_versions(service_id);

CREATE INDEX IF NOT EXISTS idx_execution_logs_service_id
    ON cds_visual_builder.execution_logs(service_id);

CREATE INDEX IF NOT EXISTS idx_execution_logs_executed_at
    ON cds_visual_builder.execution_logs(executed_at);

CREATE INDEX IF NOT EXISTS idx_value_sets_created_by
    ON cds_visual_builder.value_sets(created_by)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_value_sets_name
    ON cds_visual_builder.value_sets(name)
    WHERE deleted_at IS NULL;

-- Trigger for automatic updated_at timestamp
CREATE OR REPLACE FUNCTION cds_visual_builder.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_service_configs_updated_at
    ON cds_visual_builder.service_configs;
CREATE TRIGGER update_service_configs_updated_at
    BEFORE UPDATE ON cds_visual_builder.service_configs
    FOR EACH ROW
    EXECUTE FUNCTION cds_visual_builder.update_updated_at_column();

DROP TRIGGER IF EXISTS update_value_sets_updated_at
    ON cds_visual_builder.value_sets;
CREATE TRIGGER update_value_sets_updated_at
    BEFORE UPDATE ON cds_visual_builder.value_sets
    FOR EACH ROW
    EXECUTE FUNCTION cds_visual_builder.update_updated_at_column();

-- Trigger for automatic version increment on update.
-- Includes cql_source in the change-detection set so that CQL-only edits
-- still record a version snapshot.
CREATE OR REPLACE FUNCTION cds_visual_builder.increment_version()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.conditions IS DISTINCT FROM OLD.conditions OR
        NEW.card_config IS DISTINCT FROM OLD.card_config OR
        NEW.display_config IS DISTINCT FROM OLD.display_config OR
        NEW.prefetch_config IS DISTINCT FROM OLD.prefetch_config OR
        NEW.cql_source IS DISTINCT FROM OLD.cql_source) THEN

        NEW.version = OLD.version + 1;

        INSERT INTO cds_visual_builder.service_versions (
            service_id, version, conditions, card_config,
            display_config, prefetch_config, cql_source,
            generated_code, code_hash, created_by
        ) VALUES (
            OLD.service_id, OLD.version, OLD.conditions,
            OLD.card_config, OLD.display_config, OLD.prefetch_config,
            OLD.cql_source, OLD.generated_code, OLD.code_hash, NEW.created_by
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_increment_version
    ON cds_visual_builder.service_configs;
CREATE TRIGGER auto_increment_version
    BEFORE UPDATE ON cds_visual_builder.service_configs
    FOR EACH ROW
    EXECUTE FUNCTION cds_visual_builder.increment_version();

-- Grant permissions (adjust as needed for your environment)
GRANT USAGE ON SCHEMA cds_visual_builder TO emr_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cds_visual_builder TO emr_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA cds_visual_builder TO emr_user;

-- Comments for documentation
COMMENT ON SCHEMA cds_visual_builder IS 'Schema for CDS Visual Builder service configurations, CQL services, and analytics';
COMMENT ON TABLE cds_visual_builder.service_configs IS 'Main table for visual + CQL CDS service configurations';
COMMENT ON COLUMN cds_visual_builder.service_configs.cql_source IS 'CQL text for service_type=cql-based; uploaded to HAPI as a Library on save';
COMMENT ON COLUMN cds_visual_builder.service_configs.library_canonical_url IS 'HAPI canonical URL of the Library generated from cql_source';
COMMENT ON COLUMN cds_visual_builder.service_configs.plan_definition_canonical_url IS 'HAPI canonical URL of the PlanDefinition wrapper that runs the CQL';
COMMENT ON TABLE cds_visual_builder.service_versions IS 'Version history for service configurations';
COMMENT ON TABLE cds_visual_builder.execution_logs IS 'Execution metrics — written by execute_service, read by analytics + service registry table';
COMMENT ON TABLE cds_visual_builder.value_sets IS 'Student-authored ValueSets; mirrored to HAPI as FHIR ValueSet resources';

DO $$
BEGIN
    RAISE NOTICE 'CDS Visual Builder schema created/updated successfully';
END
$$;
