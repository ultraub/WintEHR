-- ========================================================================
-- WintEHR PostgreSQL Initialization Script
-- This script is automatically executed by PostgreSQL docker-entrypoint-initdb.d
-- ========================================================================
--
-- NOTE: FHIR data is stored by HAPI FHIR server in its own tables (hfj_*)
--       This script only creates schemas for authentication and CDS Hooks
-- ========================================================================

-- Connect to the WintEHR database
\c emr_db;

-- Set up error handling
\set ON_ERROR_STOP on

\echo 'Starting WintEHR database initialization...'

-- Create schemas
DO $$
BEGIN
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
    display_behavior JSONB DEFAULT '{}'::jsonb,
    enabled BOOLEAN DEFAULT TRUE,
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
GRANT USAGE ON SCHEMA auth TO emr_user;
GRANT USAGE ON SCHEMA cds_hooks TO emr_user;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA auth TO emr_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cds_hooks TO emr_user;

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
    WHERE schema_name IN ('auth', 'cds_hooks');

    IF schema_count = 2 THEN
        RAISE NOTICE '✅ All schemas created successfully';
    ELSE
        RAISE EXCEPTION '❌ Schema creation failed. Expected 2, found %', schema_count;
    END IF;
END$$;

-- Verify core tables exist
DO $$
DECLARE
    table_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE (table_schema = 'auth' AND table_name IN ('users', 'roles', 'user_roles'))
       OR (table_schema = 'cds_hooks' AND table_name IN ('hook_configurations', 'execution_log'));

    IF table_count = 5 THEN
        RAISE NOTICE '✅ All core tables created successfully';
    ELSE
        RAISE EXCEPTION '❌ Table creation failed. Expected 5, found %', table_count;
    END IF;
END$$;

-- Show summary
\echo 'Database initialization summary:'
SELECT
    schemaname,
    COUNT(*) as table_count
FROM pg_tables
WHERE schemaname IN ('auth', 'cds_hooks')
GROUP BY schemaname
ORDER BY schemaname;

\echo '✅ WintEHR database initialization completed successfully!'
\echo 'Database is ready for authentication and CDS Hooks.'
\echo 'FHIR data is managed by HAPI FHIR server in its own tables.'
