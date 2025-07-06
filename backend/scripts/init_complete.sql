-- Complete initialization SQL for MedGenEMR
-- This file contains all necessary database setup for Docker initialization

-- Create FHIR schema if not exists
CREATE SCHEMA IF NOT EXISTS fhir;

-- Create CDS Hooks schema if not exists
CREATE SCHEMA IF NOT EXISTS cds_hooks;

-- Create FHIR resources table
CREATE TABLE IF NOT EXISTS fhir.resources (
    id BIGSERIAL PRIMARY KEY,
    resource_type VARCHAR(50) NOT NULL,
    fhir_id VARCHAR(64) NOT NULL,
    version_id INTEGER NOT NULL DEFAULT 1,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted BOOLEAN DEFAULT FALSE,
    resource JSONB NOT NULL,
    UNIQUE(resource_type, fhir_id, version_id)
);

-- Create references table
CREATE TABLE IF NOT EXISTS fhir.references (
    id BIGSERIAL PRIMARY KEY,
    source_id BIGINT NOT NULL,
    source_type VARCHAR(50) NOT NULL,
    target_type VARCHAR(50),
    target_id VARCHAR(64),
    reference_path VARCHAR(255) NOT NULL,
    reference_value TEXT NOT NULL,
    FOREIGN KEY (source_id) REFERENCES fhir.resources(id) ON DELETE CASCADE
);

-- Create search_params table if not exists
CREATE TABLE IF NOT EXISTS fhir.search_params (
    id BIGSERIAL PRIMARY KEY,
    resource_id BIGINT NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    param_name VARCHAR(100) NOT NULL,
    param_type VARCHAR(20) NOT NULL,
    value_string TEXT,
    value_token VARCHAR(500),
    value_reference VARCHAR(500),
    value_date TIMESTAMP WITH TIME ZONE,
    value_number NUMERIC,
    value_quantity_value NUMERIC,
    value_quantity_unit VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (resource_id) REFERENCES fhir.resources(id) ON DELETE CASCADE
);

-- Create indexes for search_params
CREATE INDEX IF NOT EXISTS idx_search_params_resource ON fhir.search_params(resource_id, resource_type);
CREATE INDEX IF NOT EXISTS idx_search_params_token ON fhir.search_params(param_name, value_token) WHERE value_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_search_params_reference ON fhir.search_params(param_name, value_reference) WHERE value_reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_search_params_string ON fhir.search_params(param_name, value_string) WHERE value_string IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_search_params_date ON fhir.search_params(param_name, value_date) WHERE value_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_search_params_number ON fhir.search_params(param_name, value_number) WHERE value_number IS NOT NULL;

-- Create resource_history table for tracking FHIR resource changes
CREATE TABLE IF NOT EXISTS fhir.resource_history (
    id BIGSERIAL PRIMARY KEY,
    resource_id BIGINT NOT NULL,
    version_id INTEGER NOT NULL,
    operation VARCHAR(20) NOT NULL, -- 'create', 'update', 'delete'
    resource JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key to resources table
    CONSTRAINT fk_resource_history_resource 
        FOREIGN KEY (resource_id) 
        REFERENCES fhir.resources(id) 
        ON DELETE CASCADE,
    
    -- Index for efficient queries
    CONSTRAINT idx_resource_history_unique 
        UNIQUE (resource_id, version_id)
);

-- Create indexes for resource_history
CREATE INDEX IF NOT EXISTS idx_resource_history_resource_id ON fhir.resource_history(resource_id);
CREATE INDEX IF NOT EXISTS idx_resource_history_created_at ON fhir.resource_history(created_at);
CREATE INDEX IF NOT EXISTS idx_resource_history_operation ON fhir.resource_history(operation);

-- Create CDS Hooks tables
CREATE TABLE IF NOT EXISTS cds_hooks.hook_configurations (
    id VARCHAR(255) PRIMARY KEY,
    hook_type VARCHAR(100) NOT NULL,
    title VARCHAR(255),
    description TEXT,
    enabled BOOLEAN DEFAULT true,
    conditions JSONB DEFAULT '[]'::jsonb,
    actions JSONB DEFAULT '[]'::jsonb,
    prefetch JSONB DEFAULT '{}'::jsonb,
    usage_requirements TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    version INTEGER DEFAULT 1,
    tags JSONB DEFAULT '[]'::jsonb
);

-- Create indexes for CDS Hooks
CREATE INDEX IF NOT EXISTS idx_hook_type ON cds_hooks.hook_configurations(hook_type);
CREATE INDEX IF NOT EXISTS idx_enabled ON cds_hooks.hook_configurations(enabled);
CREATE INDEX IF NOT EXISTS idx_tags ON cds_hooks.hook_configurations USING GIN(tags);

-- Grant permissions to emr_user
GRANT ALL PRIVILEGES ON SCHEMA fhir TO emr_user;
GRANT ALL PRIVILEGES ON SCHEMA cds_hooks TO emr_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA fhir TO emr_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cds_hooks TO emr_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA fhir TO emr_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA cds_hooks TO emr_user;

-- Ensure emr_user owns the schemas
ALTER SCHEMA fhir OWNER TO emr_user;
ALTER SCHEMA cds_hooks OWNER TO emr_user;

-- Add comments for documentation
COMMENT ON SCHEMA fhir IS 'FHIR resource storage and search indexes';
COMMENT ON SCHEMA cds_hooks IS 'CDS Hooks configuration and storage';
COMMENT ON TABLE fhir.resources IS 'Main FHIR resource storage table';
COMMENT ON TABLE fhir.search_params IS 'Search parameter index for FHIR resources';
COMMENT ON TABLE fhir.resource_history IS 'Version history for FHIR resources';
COMMENT ON TABLE cds_hooks.hook_configurations IS 'CDS Hooks configuration storage';

-- Show final status
SELECT 'Database initialization complete' AS status;
SELECT table_schema, table_name FROM information_schema.tables 
WHERE table_schema IN ('fhir', 'cds_hooks') 
ORDER BY table_schema, table_name;