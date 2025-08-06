#!/usr/bin/env python3
"""
Definitive Database Initialization Script

This is the CONSOLIDATED script that creates the complete, correct database schema
for WintEHR with all required tables, columns, constraints, and indexes.

This script consolidates and replaces all other initialization scripts:
- init_database_unified.py
- init_database_complete.py  
- init_database.py
- init_fhir_only.py

Enhanced Features (2025-01-17):
- Docker environment detection
- Comprehensive schema validation
- Production/development mode support
- Enhanced error handling and logging
- Complete CDS Hooks support
- Performance optimization with proper indexes

Usage:
    python scripts/setup/init_database_definitive.py [--mode=development|production] [--verify-only]
"""

import asyncio
import asyncpg
import sys
import argparse
import logging
from pathlib import Path
from datetime import datetime
import os


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class DefinitiveDatabaseInitializer:
    """Definitive, comprehensive database initialization."""
    
    def __init__(self, mode="development", verify_only=False, skip_drop=False):
        self.mode = mode
        self.verify_only = verify_only
        self.skip_drop = skip_drop
        self.connection = None
        
        # Database connection configuration with Docker detection
        is_docker = os.path.exists('/.dockerenv') or os.environ.get('DOCKER_CONTAINER', False)
        
        self.db_config = {
            'host': 'postgres' if (self.mode == 'production' or is_docker) else 'localhost',
            'port': 5432,
            'user': 'emr_user',
            'password': 'emr_password',
            'database': 'emr_db'
        }
        
    async def connect(self):
        """Establish database connection."""
        try:
            connection_string = f"postgresql://{self.db_config['user']}:{self.db_config['password']}@{self.db_config['host']}:{self.db_config['port']}/{self.db_config['database']}"
            self.connection = await asyncpg.connect(connection_string)
            logger.info(f"✅ Connected to database in {self.mode} mode")
            return True
        except Exception as e:
            logger.error(f"❌ Database connection failed: {e}")
            return False
    
    async def close(self):
        """Close database connection."""
        if self.connection:
            await self.connection.close()
            logger.info("🔌 Database connection closed")
    
    async def init_database_definitive(self):
        """Initialize the complete database schema definitively."""
        
        logger.info("🚀 WintEHR Definitive Database Initialization")
        logger.info("=" * 60)
        
        if self.verify_only:
            return await self.verify_schema_only()
        
        try:
            if not self.skip_drop:
                # Drop and recreate everything to ensure consistency
                logger.info("🧹 Cleaning up any existing schema...")
                await self.connection.execute("""
                    -- Drop all FHIR tables if they exist
                    DROP TABLE IF EXISTS fhir.audit_logs CASCADE;
                    DROP TABLE IF EXISTS fhir.compartments CASCADE;
                    DROP TABLE IF EXISTS fhir.references CASCADE;
                    DROP TABLE IF EXISTS fhir.resource_history CASCADE;
                    DROP TABLE IF EXISTS fhir.search_params CASCADE;
                    DROP TABLE IF EXISTS fhir.resources CASCADE;
                    
                    -- Drop and recreate schemas
                    DROP SCHEMA IF EXISTS fhir CASCADE;
                    DROP SCHEMA IF EXISTS cds_hooks CASCADE;
                    DROP SCHEMA IF EXISTS auth CASCADE;
                    
                    CREATE SCHEMA fhir;
                    CREATE SCHEMA cds_hooks;
                    CREATE SCHEMA auth;
                """)
                
                logger.info("✅ Schemas cleaned and recreated")
            else:
                logger.info("⏭️ Skipping schema drop (--skip-drop flag set)")
                # Ensure schemas exist
                await self.connection.execute("""
                    CREATE SCHEMA IF NOT EXISTS fhir;
                    CREATE SCHEMA IF NOT EXISTS cds_hooks;
                    CREATE SCHEMA IF NOT EXISTS auth;
                """)
                logger.info("✅ Schemas verified/created")
            # Create the definitive schema
            logger.info("🏗️  Creating definitive database schema...")
            
            # Determine whether to use IF NOT EXISTS based on skip_drop flag
            table_prefix = "CREATE TABLE IF NOT EXISTS" if self.skip_drop else "CREATE TABLE"
            
            await self.connection.execute(f"""
                -- Create resources table (the foundation)
                {table_prefix} fhir.resources (
                    id BIGSERIAL PRIMARY KEY,
                    resource_type VARCHAR(255) NOT NULL,
                fhir_id VARCHAR(255) NOT NULL UNIQUE,
                version_id INTEGER NOT NULL DEFAULT 1,
                last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                resource JSONB NOT NULL,
                deleted BOOLEAN DEFAULT FALSE,
                
                -- Ensure uniqueness of resource_type + fhir_id
                CONSTRAINT resources_resource_type_fhir_id_key UNIQUE(resource_type, fhir_id)
            );
            
            -- Create search_params table with ALL required columns
            {table_prefix} fhir.search_params (
                id BIGSERIAL PRIMARY KEY,
                resource_id BIGINT NOT NULL,
                resource_type VARCHAR(50) NOT NULL,
                param_name VARCHAR(100) NOT NULL,
                param_type VARCHAR(20) NOT NULL,
                
                -- Value columns for different data types
                value_string TEXT,
                value_number NUMERIC,
                value_date TIMESTAMP WITH TIME ZONE,
                value_token VARCHAR(500),
                value_token_system VARCHAR(500),
                value_token_code VARCHAR(500),
                value_reference VARCHAR(500),
                value_quantity_value NUMERIC,
                value_quantity_unit VARCHAR(100),
                
                -- Metadata
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                
                -- Foreign key to resources
                CONSTRAINT fk_search_params_resource 
                    FOREIGN KEY (resource_id) 
                    REFERENCES fhir.resources(id) 
                    ON DELETE CASCADE
            );
            
            -- Create resource_history table for versioning
            {table_prefix} fhir.resource_history (
                id BIGSERIAL PRIMARY KEY,
                resource_id BIGINT NOT NULL,
                version_id INTEGER NOT NULL,
                operation VARCHAR(20) NOT NULL, -- 'create', 'update', 'delete'
                resource JSONB NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                
                -- Foreign key and uniqueness
                CONSTRAINT fk_resource_history_resource 
                    FOREIGN KEY (resource_id) 
                    REFERENCES fhir.resources(id) 
                    ON DELETE CASCADE,
                CONSTRAINT resource_history_unique 
                    UNIQUE (resource_id, version_id)
            );
            
            -- Create references table for FHIR reference tracking
            {table_prefix} fhir.references (
                id BIGSERIAL PRIMARY KEY,
                source_id BIGINT NOT NULL,
                source_type VARCHAR(50) NOT NULL,
                target_type VARCHAR(50) NOT NULL,
                target_id VARCHAR(255) NOT NULL,
                reference_path VARCHAR(100) NOT NULL,
                reference_value TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                
                -- Foreign key
                CONSTRAINT fk_references_source 
                    FOREIGN KEY (source_id) 
                    REFERENCES fhir.resources(id) 
                    ON DELETE CASCADE
            );
            
            -- Create compartments table for Patient/$everything operations
            {table_prefix} fhir.compartments (
                id BIGSERIAL PRIMARY KEY,
                compartment_type VARCHAR(50) NOT NULL,
                compartment_id VARCHAR(255) NOT NULL,
                resource_id BIGINT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                
                -- Foreign key
                CONSTRAINT fk_compartments_resource 
                    FOREIGN KEY (resource_id) 
                    REFERENCES fhir.resources(id) 
                    ON DELETE CASCADE,
                
                -- Ensure uniqueness
                CONSTRAINT compartments_unique 
                    UNIQUE (compartment_type, compartment_id, resource_id)
            );
            
            -- Create audit_logs table for FHIR operation auditing
            {table_prefix} fhir.audit_logs (
                id BIGSERIAL PRIMARY KEY,
                resource_type VARCHAR(50),
                resource_id VARCHAR(255),
                operation VARCHAR(20) NOT NULL,
                user_id VARCHAR(255),
                ip_address VARCHAR(45),
                user_agent TEXT,
                request_id VARCHAR(255),
                http_method VARCHAR(10),
                url_path TEXT,
                query_params TEXT,
                request_body TEXT,
                response_status INTEGER,
                response_body TEXT,
                error_message TEXT,
                duration_ms INTEGER,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            
            -- Create organizations table (referenced by providers)
            CREATE TABLE IF NOT EXISTS auth.organizations (
                id VARCHAR PRIMARY KEY,
                synthea_id VARCHAR UNIQUE,
                name VARCHAR NOT NULL,
                type VARCHAR,
                address VARCHAR,
                city VARCHAR,
                state VARCHAR,
                zip_code VARCHAR,
                phone VARCHAR,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            
            -- Create providers table for authentication and clinical assignments
            CREATE TABLE IF NOT EXISTS auth.providers (
                id VARCHAR PRIMARY KEY,
                synthea_id VARCHAR UNIQUE,
                npi VARCHAR UNIQUE,
                dea VARCHAR,
                state_license VARCHAR,
                prefix VARCHAR,
                first_name VARCHAR NOT NULL,
                middle_name VARCHAR,
                last_name VARCHAR NOT NULL,
                suffix VARCHAR,
                address VARCHAR,
                city VARCHAR,
                state VARCHAR,
                zip_code VARCHAR,
                phone VARCHAR,
                email VARCHAR,
                specialty VARCHAR,
                organization_id VARCHAR REFERENCES auth.organizations(id),
                active BOOLEAN DEFAULT TRUE,
                fhir_json JSONB,
                fhir_meta JSONB,
                extensions JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            
            -- Create user_sessions table for authentication
            CREATE TABLE IF NOT EXISTS auth.user_sessions (
                id SERIAL PRIMARY KEY,
                provider_id VARCHAR REFERENCES auth.providers(id),
                session_token VARCHAR UNIQUE NOT NULL,
                expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            
            -- Create patient_provider_assignments table
            CREATE TABLE IF NOT EXISTS auth.patient_provider_assignments (
                id SERIAL PRIMARY KEY,
                patient_id VARCHAR NOT NULL,
                provider_id VARCHAR REFERENCES auth.providers(id),
                assignment_type VARCHAR,
                is_active BOOLEAN DEFAULT TRUE,
                start_date TIMESTAMP WITH TIME ZONE,
                end_date TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            
            -- Create CDS Hooks configuration table
            CREATE TABLE IF NOT EXISTS cds_hooks.hook_configurations (
                id SERIAL PRIMARY KEY,
                hook_id VARCHAR(255) UNIQUE NOT NULL,
                hook_type VARCHAR(100) NOT NULL,
                title VARCHAR(500),
                description TEXT,
                enabled BOOLEAN DEFAULT true,
                is_active BOOLEAN DEFAULT true,
                conditions JSONB DEFAULT '[]'::jsonb,
                actions JSONB DEFAULT '[]'::jsonb,
                configuration JSONB NOT NULL DEFAULT '{{}}'::jsonb,
                prefetch JSONB DEFAULT '{{}}'::jsonb,
                display_behavior JSONB DEFAULT NULL,
                usage_requirements TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_by VARCHAR(255),
                updated_by VARCHAR(255),
                version INTEGER DEFAULT 1,
                tags JSONB DEFAULT '[]'::jsonb
            );
            
            -- Create CDS Hooks feedback table for persistence
            CREATE TABLE IF NOT EXISTS cds_hooks.feedback (
                id BIGSERIAL PRIMARY KEY,
                feedback_id UUID DEFAULT gen_random_uuid(),
                hook_instance_id VARCHAR(255) NOT NULL,
                service_id VARCHAR(255) NOT NULL,
                card_uuid VARCHAR(255) NOT NULL,
                outcome VARCHAR(50) NOT NULL CHECK (outcome IN ('accepted', 'overridden', 'ignored')),
                override_reason JSONB,
                accepted_suggestions JSONB,
                user_id VARCHAR(255),
                patient_id VARCHAR(255),
                encounter_id VARCHAR(255),
                context JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            
            -- Create CDS Hooks feedback analytics table
            CREATE TABLE IF NOT EXISTS cds_hooks.feedback_analytics (
                id BIGSERIAL PRIMARY KEY,
                service_id VARCHAR(255) NOT NULL,
                period_start TIMESTAMP WITH TIME ZONE NOT NULL,
                period_end TIMESTAMP WITH TIME ZONE NOT NULL,
                total_cards INT DEFAULT 0,
                accepted_count INT DEFAULT 0,
                overridden_count INT DEFAULT 0,
                ignored_count INT DEFAULT 0,
                acceptance_rate DECIMAL(5,2),
                common_override_reasons JSONB,
                user_patterns JSONB,
                patient_patterns JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                
                -- Ensure unique periods per service
                CONSTRAINT unique_analytics_period UNIQUE (service_id, period_start, period_end)
            );
            
            -- Create CDS Hooks execution log table
            CREATE TABLE IF NOT EXISTS cds_hooks.execution_log (
                id BIGSERIAL PRIMARY KEY,
                service_id VARCHAR(255) NOT NULL,
                hook_type VARCHAR(100) NOT NULL,
                patient_id VARCHAR(255),
                user_id VARCHAR(255),
                context JSONB,
                request_data JSONB,
                response_data JSONB,
                cards_returned INT DEFAULT 0,
                execution_time_ms INT,
                success BOOLEAN DEFAULT true,
                error_message TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
            logger.info("✅ Tables created successfully")
            # Create all performance indexes
            logger.info("📊 Creating performance indexes...")
            await self.connection.execute("""
            -- Resources table indexes
            CREATE INDEX IF NOT EXISTS idx_resources_type ON fhir.resources(resource_type);
            CREATE INDEX IF NOT EXISTS idx_resources_type_id ON fhir.resources(resource_type, fhir_id);
            CREATE INDEX IF NOT EXISTS idx_resources_updated ON fhir.resources(last_updated);
            CREATE INDEX IF NOT EXISTS idx_resources_deleted ON fhir.resources(deleted) WHERE deleted = false;
            
            -- Search params indexes for performance
            CREATE INDEX IF NOT EXISTS idx_search_params_resource ON fhir.search_params(resource_id, resource_type);
            CREATE INDEX IF NOT EXISTS idx_search_params_param_name ON fhir.search_params(param_name);
            CREATE INDEX IF NOT EXISTS idx_search_params_param_type ON fhir.search_params(param_type);
            CREATE INDEX IF NOT EXISTS idx_search_params_string ON fhir.search_params(param_name, value_string) WHERE value_string IS NOT NULL;
            CREATE INDEX IF NOT EXISTS idx_search_params_number ON fhir.search_params(param_name, value_number) WHERE value_number IS NOT NULL;
            CREATE INDEX IF NOT EXISTS idx_search_params_date ON fhir.search_params(param_name, value_date) WHERE value_date IS NOT NULL;
            CREATE INDEX IF NOT EXISTS idx_search_params_token ON fhir.search_params(param_name, value_token) WHERE value_token IS NOT NULL;
            CREATE INDEX IF NOT EXISTS idx_search_params_token_code ON fhir.search_params(param_name, value_token_code) WHERE value_token_code IS NOT NULL;
            CREATE INDEX IF NOT EXISTS idx_search_params_reference ON fhir.search_params(param_name, value_reference) WHERE value_reference IS NOT NULL;
            
            -- Resource history indexes
            CREATE INDEX IF NOT EXISTS idx_resource_history_resource_id ON fhir.resource_history(resource_id);
            CREATE INDEX IF NOT EXISTS idx_resource_history_created_at ON fhir.resource_history(created_at);
            CREATE INDEX IF NOT EXISTS idx_resource_history_operation ON fhir.resource_history(operation);
            
            -- References indexes
            CREATE INDEX IF NOT EXISTS idx_references_source ON fhir.references(source_id, source_type);
            CREATE INDEX IF NOT EXISTS idx_references_target ON fhir.references(target_type, target_id);
            CREATE INDEX IF NOT EXISTS idx_references_path ON fhir.references(reference_path);
            
            -- Compartments indexes
            CREATE INDEX IF NOT EXISTS idx_compartments_compartment ON fhir.compartments(compartment_type, compartment_id);
            CREATE INDEX IF NOT EXISTS idx_compartments_resource ON fhir.compartments(resource_id);
            CREATE INDEX IF NOT EXISTS idx_compartments_type_id ON fhir.compartments(compartment_type, compartment_id, resource_id);
            
            -- Audit logs indexes
            CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON fhir.audit_logs(resource_type, resource_id);
            CREATE INDEX IF NOT EXISTS idx_audit_logs_operation ON fhir.audit_logs(operation);
            CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON fhir.audit_logs(created_at);
            CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON fhir.audit_logs(user_id);
            
            -- CDS Hooks indexes
            CREATE INDEX IF NOT EXISTS idx_hook_configurations_type ON cds_hooks.hook_configurations(hook_type);
            CREATE INDEX IF NOT EXISTS idx_hook_configurations_enabled ON cds_hooks.hook_configurations(enabled);
            CREATE INDEX IF NOT EXISTS idx_hook_configurations_created_at ON cds_hooks.hook_configurations(created_at);
            CREATE INDEX IF NOT EXISTS idx_hook_configurations_updated_at ON cds_hooks.hook_configurations(updated_at);
            
            -- CDS Hooks feedback indexes
            CREATE INDEX IF NOT EXISTS idx_feedback_service ON cds_hooks.feedback (service_id);
            CREATE INDEX IF NOT EXISTS idx_feedback_patient ON cds_hooks.feedback (patient_id);
            CREATE INDEX IF NOT EXISTS idx_feedback_user ON cds_hooks.feedback (user_id);
            CREATE INDEX IF NOT EXISTS idx_feedback_created ON cds_hooks.feedback (created_at);
            CREATE INDEX IF NOT EXISTS idx_feedback_outcome ON cds_hooks.feedback (outcome);
            
            -- CDS Hooks feedback_analytics indexes
            CREATE INDEX IF NOT EXISTS idx_analytics_service ON cds_hooks.feedback_analytics (service_id);
            CREATE INDEX IF NOT EXISTS idx_analytics_period ON cds_hooks.feedback_analytics (period_start, period_end);
            CREATE INDEX IF NOT EXISTS idx_analytics_created ON cds_hooks.feedback_analytics (created_at);
            
            -- CDS Hooks execution_log indexes
            CREATE INDEX IF NOT EXISTS idx_execution_service ON cds_hooks.execution_log (service_id);
            CREATE INDEX IF NOT EXISTS idx_execution_patient ON cds_hooks.execution_log (patient_id);
            CREATE INDEX IF NOT EXISTS idx_execution_created ON cds_hooks.execution_log (created_at);
            CREATE INDEX IF NOT EXISTS idx_execution_success ON cds_hooks.execution_log (success);
            
            -- Provider and Auth indexes
            CREATE INDEX IF NOT EXISTS idx_provider_name ON auth.providers(last_name, first_name);
            CREATE INDEX IF NOT EXISTS idx_provider_specialty ON auth.providers(specialty);
            CREATE INDEX IF NOT EXISTS idx_provider_org ON auth.providers(organization_id);
            CREATE INDEX IF NOT EXISTS idx_provider_active ON auth.providers(active);
            CREATE INDEX IF NOT EXISTS idx_patient_provider_assignment ON auth.patient_provider_assignments(patient_id, provider_id);
            CREATE INDEX IF NOT EXISTS idx_patient_provider_active ON auth.patient_provider_assignments(is_active);
            CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON auth.user_sessions(session_token);
            CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON auth.user_sessions(is_active);
            CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON auth.user_sessions(expires_at);
        """)
        
            logger.info("✅ Indexes created successfully")
            # Test the schema with a simple query
            logger.info("🧪 Testing schema with basic queries...")
            result = await self.connection.fetchval("SELECT COUNT(*) FROM fhir.resources")
            logger.info(f"✅ Resources table accessible (count: {result})")
            
            result = await self.connection.fetchval("SELECT COUNT(*) FROM fhir.search_params")
            logger.info(f"✅ Search params table accessible (count: {result})")
            
            result = await self.connection.fetchval("SELECT COUNT(*) FROM fhir.resource_history")
            logger.info(f"✅ Resource history table accessible (count: {result})")
            
            result = await self.connection.fetchval("SELECT COUNT(*) FROM fhir.references")
            logger.info(f"✅ References table accessible (count: {result})")
            
            result = await self.connection.fetchval("SELECT COUNT(*) FROM fhir.compartments")
            logger.info(f"✅ Compartments table accessible (count: {result})")
            
            result = await self.connection.fetchval("SELECT COUNT(*) FROM fhir.audit_logs")
            logger.info(f"✅ Audit logs table accessible (count: {result})")
            
            result = await self.connection.fetchval("SELECT COUNT(*) FROM cds_hooks.hook_configurations")
            logger.info(f"✅ CDS Hooks configurations table accessible (count: {result})")
            
            result = await self.connection.fetchval("SELECT COUNT(*) FROM cds_hooks.feedback")
            logger.info(f"✅ CDS Hooks feedback table accessible (count: {result})")
            
            result = await self.connection.fetchval("SELECT COUNT(*) FROM cds_hooks.feedback_analytics")
            logger.info(f"✅ CDS Hooks analytics table accessible (count: {result})")
            
            result = await self.connection.fetchval("SELECT COUNT(*) FROM cds_hooks.execution_log")
            logger.info(f"✅ CDS Hooks execution log table accessible (count: {result})")
            
            result = await self.connection.fetchval("SELECT COUNT(*) FROM auth.organizations")
            logger.info(f"✅ Organizations table accessible (count: {result})")
            
            result = await self.connection.fetchval("SELECT COUNT(*) FROM auth.providers")
            logger.info(f"✅ Providers table accessible (count: {result})")
            
            result = await self.connection.fetchval("SELECT COUNT(*) FROM auth.user_sessions")
            logger.info(f"✅ User sessions table accessible (count: {result})")
            
            result = await self.connection.fetchval("SELECT COUNT(*) FROM auth.patient_provider_assignments")
            logger.info(f"✅ Patient-provider assignments table accessible (count: {result})")
            
            logger.info("🎉 Database initialization completed successfully!")
            return True
            
        except Exception as e:
            logger.error(f"❌ Database initialization failed: {e}")
            return False
    
    async def verify_schema_only(self):
        """Verify existing schema without making changes."""
        logger.info("🔍 Verifying existing database schema...")
        
        try:
            # Check if schemas exist
            schemas = await self.connection.fetch("""
                SELECT schema_name FROM information_schema.schemata 
                WHERE schema_name IN ('fhir', 'cds_hooks', 'auth')
            """)
            
            existing_schemas = [row['schema_name'] for row in schemas]
            expected_schemas = ['fhir', 'cds_hooks', 'auth']
            missing_schemas = set(expected_schemas) - set(existing_schemas)
            
            if missing_schemas:
                logger.error(f"❌ Missing schemas: {missing_schemas}")
                return False
            
            # Check FHIR tables
            fhir_tables = await self.connection.fetch("""
                SELECT table_name FROM information_schema.tables 
                WHERE table_schema = 'fhir' ORDER BY table_name
            """)
            
            existing_tables = [row['table_name'] for row in fhir_tables]
            expected_tables = ['resources', 'search_params', 'resource_history', 'references', 'compartments', 'audit_logs']
            missing_tables = set(expected_tables) - set(existing_tables)
            
            if missing_tables:
                logger.error(f"❌ Missing FHIR tables: {missing_tables}")
                return False
            
            # Check CDS Hooks tables
            cds_tables = await self.connection.fetch("""
                SELECT table_name FROM information_schema.tables 
                WHERE table_schema = 'cds_hooks' ORDER BY table_name
            """)
            
            existing_cds_tables = [row['table_name'] for row in cds_tables]
            expected_cds_tables = ['hook_configurations', 'feedback', 'feedback_analytics', 'execution_log']
            missing_cds_tables = set(expected_cds_tables) - set(existing_cds_tables)
            
            if missing_cds_tables:
                logger.error(f"❌ Missing CDS Hooks tables: {missing_cds_tables}")
                return False
            
            logger.info("✅ Database schema verification passed")
            return True
            
        except Exception as e:
            logger.error(f"❌ Schema verification failed: {e}")
            return False


async def main():
    """Run the database initialization."""
    parser = argparse.ArgumentParser(
        description="Definitive Database Initialization Script for WintEHR"
    )
    parser.add_argument(
        '--mode', 
        choices=['development', 'production'],
        default='development',
        help='Database initialization mode'
    )
    parser.add_argument(
        '--verify-only', 
        action='store_true',
        help='Only verify existing schema without making changes'
    )
    parser.add_argument(
        '--skip-drop',
        action='store_true',
        help='Skip dropping existing schema (only create missing tables)'
    )
    
    args = parser.parse_args()
    
    initializer = DefinitiveDatabaseInitializer(
        mode=args.mode,
        verify_only=args.verify_only,
        skip_drop=args.skip_drop
    )
    
    try:
        if not await initializer.connect():
            sys.exit(1)
        
        success = await initializer.init_database_definitive()
        
        if success:
            logger.info("✅ Database operation completed successfully")
            sys.exit(0)
        else:
            logger.error("❌ Database operation failed")
            sys.exit(1)
            
    except Exception as e:
        logger.error(f"❌ Unexpected error: {e}")
        sys.exit(1)
    finally:
        await initializer.close()


if __name__ == "__main__":
    asyncio.run(main())