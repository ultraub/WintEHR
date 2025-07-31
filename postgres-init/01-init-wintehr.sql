-- ========================================================================
-- WintEHR PostgreSQL Initialization Script
-- This script is automatically executed by PostgreSQL docker-entrypoint-initdb.d
-- ========================================================================

-- Connect to the WintEHR database
\c emr_db;

-- Set up error handling
\set ON_ERROR_STOP on

\echo 'Starting WintEHR database initialization...'

-- Create schemas
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'fhir') THEN
        CREATE SCHEMA fhir;
        RAISE NOTICE 'Created schema: fhir';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN
        CREATE SCHEMA auth;
        RAISE NOTICE 'Created schema: auth';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'cds_hooks') THEN
        CREATE SCHEMA cds_hooks;
        RAISE NOTICE 'Created schema: cds_hooks';
    END IF;
END$$;

-- ========================================================================
-- FHIR Resource Tables
-- ========================================================================

-- Main resources table
CREATE TABLE IF NOT EXISTS fhir.resources (
    id BIGSERIAL PRIMARY KEY,
    resource_type VARCHAR(255) NOT NULL,
    fhir_id VARCHAR(255) NOT NULL,
    version_id INTEGER NOT NULL DEFAULT 1,
    last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted BOOLEAN DEFAULT FALSE,
    resource JSONB NOT NULL,
    UNIQUE(resource_type, fhir_id)
);

-- Resource history table for versioning
CREATE TABLE IF NOT EXISTS fhir.resource_history (
    id BIGSERIAL PRIMARY KEY,
    resource_id BIGINT NOT NULL,
    version_id INTEGER NOT NULL,
    operation VARCHAR(50) NOT NULL,
    resource JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (resource_id) REFERENCES fhir.resources(id) ON DELETE CASCADE
);

-- Search parameters table for FHIR search
CREATE TABLE IF NOT EXISTS fhir.search_params (
    id BIGSERIAL PRIMARY KEY,
    resource_id BIGINT NOT NULL,
    resource_type VARCHAR(255),
    param_name VARCHAR(255) NOT NULL,
    param_type VARCHAR(50),
    value_string TEXT,
    value_number NUMERIC,
    value_date DATE,
    value_token_system VARCHAR(255),
    value_token_code VARCHAR(255),
    value_reference VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (resource_id) REFERENCES fhir.resources(id) ON DELETE CASCADE
);

-- Resource references table for relationship tracking
CREATE TABLE IF NOT EXISTS fhir.references (
    id BIGSERIAL PRIMARY KEY,
    source_resource_id BIGINT NOT NULL,
    source_id BIGINT, -- Alias for compatibility (will be synced with source_resource_id)
    source_path VARCHAR(255) NOT NULL,
    target_resource_type VARCHAR(255),
    target_resource_id VARCHAR(255),
    target_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (source_resource_id) REFERENCES fhir.resources(id) ON DELETE CASCADE
);

-- Compartments table for patient compartment
CREATE TABLE IF NOT EXISTS fhir.compartments (
    id BIGSERIAL PRIMARY KEY,
    compartment_type VARCHAR(50) NOT NULL,
    compartment_id VARCHAR(255) NOT NULL,
    resource_id BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (resource_id) REFERENCES fhir.resources(id) ON DELETE CASCADE
);

-- Audit log table for security and compliance
CREATE TABLE IF NOT EXISTS fhir.audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(255),
    action VARCHAR(50) NOT NULL,
    resource_type VARCHAR(255),
    resource_id VARCHAR(255),
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================================================
-- Authentication Tables
-- ========================================================================

-- Users table
CREATE TABLE IF NOT EXISTS auth.users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255),
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Roles table
CREATE TABLE IF NOT EXISTS auth.roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User roles junction table
CREATE TABLE IF NOT EXISTS auth.user_roles (
    user_id INTEGER REFERENCES auth.users(id) ON DELETE CASCADE,
    role_id INTEGER REFERENCES auth.roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

-- ========================================================================
-- CDS Hooks Tables
-- ========================================================================

-- CDS Hooks configuration table
CREATE TABLE IF NOT EXISTS cds_hooks.hook_configurations (
    id SERIAL PRIMARY KEY,
    hook_id VARCHAR(255) UNIQUE NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    hook_type VARCHAR(100) NOT NULL,
    prefetch JSONB,
    configuration JSONB NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- CDS Hooks execution log
CREATE TABLE IF NOT EXISTS cds_hooks.execution_log (
    id BIGSERIAL PRIMARY KEY,
    hook_id VARCHAR(255) NOT NULL,
    execution_id UUID DEFAULT gen_random_uuid(),
    patient_id VARCHAR(255),
    user_id VARCHAR(255),
    context JSONB,
    cards JSONB,
    execution_time_ms INTEGER,
    status VARCHAR(50) NOT NULL,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================================================
-- Indexes for Performance
-- ========================================================================

\echo 'Creating indexes for performance optimization...'

-- Resources table indexes
CREATE INDEX IF NOT EXISTS idx_resources_type ON fhir.resources(resource_type);
CREATE INDEX IF NOT EXISTS idx_resources_type_id ON fhir.resources(resource_type, fhir_id);
CREATE INDEX IF NOT EXISTS idx_resources_updated ON fhir.resources(last_updated);
CREATE INDEX IF NOT EXISTS idx_resources_deleted ON fhir.resources(deleted);
CREATE INDEX IF NOT EXISTS idx_resources_resource_gin ON fhir.resources USING gin(resource);

-- Resource history indexes
CREATE INDEX IF NOT EXISTS idx_resource_history_resource_id ON fhir.resource_history(resource_id);
CREATE INDEX IF NOT EXISTS idx_resource_history_version ON fhir.resource_history(resource_id, version_id);
CREATE INDEX IF NOT EXISTS idx_resource_history_operation ON fhir.resource_history(operation);

-- Search parameters indexes
CREATE INDEX IF NOT EXISTS idx_search_params_resource_id ON fhir.search_params(resource_id);
CREATE INDEX IF NOT EXISTS idx_search_params_name_type ON fhir.search_params(param_name, param_type);
CREATE INDEX IF NOT EXISTS idx_search_params_string ON fhir.search_params(param_name, value_string) WHERE value_string IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_search_params_number ON fhir.search_params(param_name, value_number) WHERE value_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_search_params_date ON fhir.search_params(param_name, value_date) WHERE value_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_search_params_token ON fhir.search_params(param_name, value_token_code) WHERE value_token_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_search_params_reference ON fhir.search_params(param_name, value_reference) WHERE value_reference IS NOT NULL;

-- References table indexes
CREATE INDEX IF NOT EXISTS idx_references_source ON fhir.references(source_resource_id);
CREATE INDEX IF NOT EXISTS idx_references_source_id ON fhir.references(source_id);
CREATE INDEX IF NOT EXISTS idx_references_target ON fhir.references(target_resource_type, target_resource_id);

-- Compartments table indexes
CREATE INDEX IF NOT EXISTS idx_compartments_type_id ON fhir.compartments(compartment_type, compartment_id);
CREATE INDEX IF NOT EXISTS idx_compartments_resource ON fhir.compartments(resource_id);

-- Audit logs indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON fhir.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON fhir.audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON fhir.audit_logs(created_at);

-- CDS Hooks indexes
CREATE INDEX IF NOT EXISTS idx_cds_hooks_config_active ON cds_hooks.hook_configurations(is_active);
CREATE INDEX IF NOT EXISTS idx_cds_hooks_config_type ON cds_hooks.hook_configurations(hook_type);
CREATE INDEX IF NOT EXISTS idx_cds_hooks_log_hook ON cds_hooks.execution_log(hook_id);
CREATE INDEX IF NOT EXISTS idx_cds_hooks_log_patient ON cds_hooks.execution_log(patient_id);
CREATE INDEX IF NOT EXISTS idx_cds_hooks_log_created ON cds_hooks.execution_log(created_at);

-- ========================================================================
-- Functions and Triggers
-- ========================================================================

\echo 'Creating database functions and triggers...'

-- Function to automatically update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for auth.users updated_at
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_users_updated_at') THEN
        CREATE TRIGGER update_users_updated_at
            BEFORE UPDATE ON auth.users
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END$$;

-- Trigger for cds_hooks.hook_configurations updated_at
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_hook_configurations_updated_at') THEN
        CREATE TRIGGER update_hook_configurations_updated_at
            BEFORE UPDATE ON cds_hooks.hook_configurations
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END$$;

-- Function to sync source_id with source_resource_id in references table
CREATE OR REPLACE FUNCTION sync_references_source_id()
RETURNS TRIGGER AS $$
BEGIN
    NEW.source_id = NEW.source_resource_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to keep source_id in sync
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sync_references_source_id_trigger') THEN
        CREATE TRIGGER sync_references_source_id_trigger
            BEFORE INSERT OR UPDATE ON fhir.references
            FOR EACH ROW
            EXECUTE FUNCTION sync_references_source_id();
    END IF;
END$$;

-- ========================================================================
-- Initial Data
-- ========================================================================

\echo 'Inserting initial configuration data...'

-- Insert default roles
INSERT INTO auth.roles (name, description) VALUES
    ('admin', 'System administrator'),
    ('provider', 'Healthcare provider'),
    ('nurse', 'Nursing staff'),
    ('pharmacist', 'Pharmacy staff'),
    ('viewer', 'Read-only access')
ON CONFLICT (name) DO NOTHING;

-- Insert default users (passwords will be hashed by application)
INSERT INTO auth.users (username, email, password_hash, is_active, is_admin) VALUES
    ('admin', 'admin@example.com', 'password', true, true),
    ('demo', 'demo@example.com', 'password', true, false),
    ('nurse', 'nurse@example.com', 'password', true, false),
    ('pharmacist', 'pharmacist@example.com', 'password', true, false)
ON CONFLICT (username) DO NOTHING;

-- ========================================================================
-- Permissions
-- ========================================================================

\echo 'Setting up database permissions...'

-- Grant appropriate permissions to emr_user
GRANT USAGE ON SCHEMA fhir TO emr_user;
GRANT USAGE ON SCHEMA auth TO emr_user;
GRANT USAGE ON SCHEMA cds_hooks TO emr_user;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA fhir TO emr_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA auth TO emr_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cds_hooks TO emr_user;

GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA fhir TO emr_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA auth TO emr_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA cds_hooks TO emr_user;

-- ========================================================================
-- Verification and Summary
-- ========================================================================

\echo 'Verifying database initialization...'

-- Verify schemas exist
DO $$
DECLARE
    schema_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO schema_count
    FROM information_schema.schemata 
    WHERE schema_name IN ('fhir', 'auth', 'cds_hooks');
    
    IF schema_count = 3 THEN
        RAISE NOTICE '✅ All schemas created successfully';
    ELSE
        RAISE EXCEPTION '❌ Schema creation failed. Expected 3, found %', schema_count;
    END IF;
END$$;

-- Verify core tables exist
DO $$
DECLARE
    table_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables 
    WHERE table_schema = 'fhir' 
    AND table_name IN ('resources', 'resource_history', 'search_params', 'references');
    
    IF table_count = 4 THEN
        RAISE NOTICE '✅ All core FHIR tables created successfully';
    ELSE
        RAISE EXCEPTION '❌ FHIR table creation failed. Expected 4, found %', table_count;
    END IF;
END$$;

-- Show summary
\echo 'Database initialization summary:'
SELECT 
    schemaname,
    COUNT(*) as table_count
FROM pg_tables 
WHERE schemaname IN ('fhir', 'auth', 'cds_hooks')
GROUP BY schemaname
ORDER BY schemaname;

\echo '✅ WintEHR database initialization completed successfully!'
\echo 'Database is ready for FHIR resource storage and clinical operations.'