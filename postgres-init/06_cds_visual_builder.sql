-- CDS Visual Builder Database Schema
-- Created: 2025-10-19
-- Purpose: Storage for visually-built CDS services

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

    -- Generated Code
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

    -- Code Snapshot
    generated_code TEXT,
    code_hash VARCHAR(64),

    -- Version Metadata
    created_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    version_notes TEXT,

    CONSTRAINT unique_service_version UNIQUE (service_id, version)
);

-- Service Analytics Table
CREATE TABLE IF NOT EXISTS cds_visual_builder.service_analytics (
    id SERIAL PRIMARY KEY,
    service_id VARCHAR(255) NOT NULL,

    -- Execution Metrics
    total_executions INTEGER DEFAULT 0,
    successful_executions INTEGER DEFAULT 0,
    failed_executions INTEGER DEFAULT 0,

    -- Performance Metrics
    avg_execution_time_ms DECIMAL(10, 2),
    min_execution_time_ms DECIMAL(10, 2),
    max_execution_time_ms DECIMAL(10, 2),

    -- Card Metrics
    total_cards_shown INTEGER DEFAULT 0,
    cards_accepted INTEGER DEFAULT 0,
    cards_dismissed INTEGER DEFAULT 0,

    -- User Feedback
    avg_user_rating DECIMAL(3, 2),
    total_ratings INTEGER DEFAULT 0,

    -- Time Windows
    last_execution_at TIMESTAMP WITH TIME ZONE,
    metrics_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT fk_service FOREIGN KEY (service_id)
        REFERENCES cds_visual_builder.service_configs(service_id)
        ON DELETE CASCADE
);

-- Service Execution Log Table
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
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT fk_service_log FOREIGN KEY (service_id)
        REFERENCES cds_visual_builder.service_configs(service_id)
        ON DELETE CASCADE
);

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_service_configs_status
    ON cds_visual_builder.service_configs(status)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_service_configs_hook_type
    ON cds_visual_builder.service_configs(hook_type)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_service_configs_created_by
    ON cds_visual_builder.service_configs(created_by);

CREATE INDEX IF NOT EXISTS idx_service_versions_service_id
    ON cds_visual_builder.service_versions(service_id);

CREATE INDEX IF NOT EXISTS idx_execution_logs_service_id
    ON cds_visual_builder.execution_logs(service_id);

CREATE INDEX IF NOT EXISTS idx_execution_logs_executed_at
    ON cds_visual_builder.execution_logs(executed_at);

-- Trigger for automatic updated_at timestamp
CREATE OR REPLACE FUNCTION cds_visual_builder.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_service_configs_updated_at
    BEFORE UPDATE ON cds_visual_builder.service_configs
    FOR EACH ROW
    EXECUTE FUNCTION cds_visual_builder.update_updated_at_column();

-- Trigger for automatic version increment on update
CREATE OR REPLACE FUNCTION cds_visual_builder.increment_version()
RETURNS TRIGGER AS $$
BEGIN
    -- Only increment if configuration actually changed
    IF (NEW.conditions != OLD.conditions OR
        NEW.card_config != OLD.card_config OR
        NEW.display_config != OLD.display_config OR
        NEW.prefetch_config != OLD.prefetch_config) THEN

        NEW.version = OLD.version + 1;

        -- Create version history entry
        INSERT INTO cds_visual_builder.service_versions (
            service_id, version, conditions, card_config,
            display_config, prefetch_config, generated_code,
            code_hash, created_by
        ) VALUES (
            OLD.service_id, OLD.version, OLD.conditions,
            OLD.card_config, OLD.display_config, OLD.prefetch_config,
            OLD.generated_code, OLD.code_hash, NEW.created_by
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_increment_version
    BEFORE UPDATE ON cds_visual_builder.service_configs
    FOR EACH ROW
    EXECUTE FUNCTION cds_visual_builder.increment_version();

-- Grant permissions (adjust as needed for your environment)
GRANT USAGE ON SCHEMA cds_visual_builder TO emr_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cds_visual_builder TO emr_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA cds_visual_builder TO emr_user;

-- Comments for documentation
COMMENT ON SCHEMA cds_visual_builder IS 'Schema for CDS Visual Builder service configurations and analytics';
COMMENT ON TABLE cds_visual_builder.service_configs IS 'Main table storing visual CDS service configurations';
COMMENT ON TABLE cds_visual_builder.service_versions IS 'Version history for service configurations';
COMMENT ON TABLE cds_visual_builder.service_analytics IS 'Performance and usage analytics for services';
COMMENT ON TABLE cds_visual_builder.execution_logs IS 'Execution logs for debugging and monitoring';

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'CDS Visual Builder schema created successfully';
END
$$;
