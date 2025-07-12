#!/usr/bin/env python3
"""
Unified Database Initialization Script for MedGenEMR

This is the consolidated, definitive database initialization script that replaces
all other initialization scripts. It creates the complete, correct database schema
with all required tables, columns, constraints, and indexes.

Features:
- Complete FHIR R4 schema with all resource types
- CDS Hooks configuration tables
- Performance indexes and constraints
- CRUD operation validation
- Schema integrity verification
- Logging and error handling

Usage:
    python scripts/init_database_unified.py [--mode=development|production] [--verify-only]
"""

import asyncio
import asyncpg
import sys
import argparse
import logging
from pathlib import Path
from datetime import datetime
import json

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class UnifiedDatabaseInitializer:
    """Unified database initialization with comprehensive schema setup."""
    
    def __init__(self, mode="development", verify_only=False):
        self.mode = mode
        self.verify_only = verify_only
        self.connection = None
        
        # Database connection configuration
        # When running in Docker, always use 'postgres' as the host
        import os
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
    
    async def verify_schema_only(self):
        """Verify existing schema without making changes."""
        logger.info("🔍 Verifying existing database schema...")
        
        try:
            # Check if schemas exist
            schemas = await self.connection.fetch("""
                SELECT schema_name FROM information_schema.schemata 
                WHERE schema_name IN ('fhir', 'cds_hooks')
            """)
            
            existing_schemas = [row['schema_name'] for row in schemas]
            expected_schemas = ['fhir', 'cds_hooks']
            missing_schemas = set(expected_schemas) - set(existing_schemas)
            
            if missing_schemas:
                logger.error(f"❌ Missing schemas: {missing_schemas}")
                return False
            
            # Check FHIR tables
            fhir_tables = await self.connection.fetch("""
                SELECT table_name FROM information_schema.tables 
                WHERE table_schema = 'fhir' ORDER BY table_name
            """)
            
            fhir_table_names = [row['table_name'] for row in fhir_tables]
            expected_fhir_tables = ['resources', 'resource_history', 'search_params', 'references']
            missing_fhir_tables = set(expected_fhir_tables) - set(fhir_table_names)
            
            if missing_fhir_tables:
                logger.error(f"❌ Missing FHIR tables: {missing_fhir_tables}")
                return False
            
            # Check CDS Hooks tables
            cds_tables = await self.connection.fetch("""
                SELECT table_name FROM information_schema.tables 
                WHERE table_schema = 'cds_hooks' ORDER BY table_name
            """)
            
            cds_table_names = [row['table_name'] for row in cds_tables]
            if 'hook_configurations' not in cds_table_names:
                logger.error("❌ Missing CDS Hooks table: hook_configurations")
                return False
            
            # Check critical columns in search_params
            search_columns = await self.connection.fetch("""
                SELECT column_name, data_type, is_nullable 
                FROM information_schema.columns 
                WHERE table_schema = 'fhir' AND table_name = 'search_params'
                ORDER BY ordinal_position
            """)
            
            search_column_names = [row['column_name'] for row in search_columns]
            required_columns = [
                'id', 'resource_id', 'resource_type', 'param_name', 'param_type',
                'value_string', 'value_number', 'value_date', 'value_token',
                'value_token_system', 'value_token_code', 'value_reference',
                'value_quantity_value', 'value_quantity_unit'
            ]
            
            missing_columns = set(required_columns) - set(search_column_names)
            if missing_columns:
                logger.error(f"❌ Missing search_params columns: {missing_columns}")
                return False
            
            # Get current data counts
            result = await self.connection.fetchrow("""
                SELECT 
                    (SELECT COUNT(*) FROM fhir.resources WHERE deleted = FALSE OR deleted IS NULL) as resource_count,
                    (SELECT COUNT(*) FROM fhir.search_params) as search_param_count,
                    (SELECT COUNT(*) FROM fhir.resource_history) as history_count,
                    (SELECT COUNT(*) FROM fhir.references) as reference_count,
                    (SELECT COUNT(*) FROM cds_hooks.hook_configurations) as cds_hooks_count
            """)
            
            logger.info("✅ Schema verification passed")
            logger.info(f"📊 Database Status:")
            logger.info(f"   - FHIR tables: {len(fhir_table_names)} (expected: {len(expected_fhir_tables)})")
            logger.info(f"   - CDS Hooks tables: {len(cds_table_names)}")
            logger.info(f"   - Search params columns: {len(search_column_names)}")
            logger.info(f"   - Resources: {result['resource_count']:,}")
            logger.info(f"   - Search params: {result['search_param_count']:,}")
            logger.info(f"   - History records: {result['history_count']:,}")
            logger.info(f"   - References: {result['reference_count']:,}")
            logger.info(f"   - CDS Hooks: {result['cds_hooks_count']:,}")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Schema verification failed: {e}")
            return False
    
    async def clean_existing_schema(self):
        """Clean existing schema for fresh initialization."""
        logger.info("🧹 Cleaning existing schema...")
        
        try:
            await self.connection.execute("""
                -- Drop all FHIR tables in correct order (respecting foreign keys)
                DROP TABLE IF EXISTS fhir.references CASCADE;
                DROP TABLE IF EXISTS fhir.resource_history CASCADE;
                DROP TABLE IF EXISTS fhir.search_params CASCADE;
                DROP TABLE IF EXISTS fhir.resources CASCADE;
                
                -- Drop and recreate schemas
                DROP SCHEMA IF EXISTS fhir CASCADE;
                DROP SCHEMA IF EXISTS cds_hooks CASCADE;
                
                CREATE SCHEMA fhir;
                CREATE SCHEMA cds_hooks;
            """)
            
            logger.info("✅ Schema cleaned and recreated")
            return True
            
        except Exception as e:
            logger.error(f"❌ Schema cleanup failed: {e}")
            return False
    
    async def create_fhir_schema(self):
        """Create comprehensive FHIR schema."""
        logger.info("🏗️ Creating FHIR schema...")
        
        try:
            await self.connection.execute("""
                -- Create resources table (the foundation)
                CREATE TABLE fhir.resources (
                    id BIGSERIAL PRIMARY KEY,
                    resource_type VARCHAR(255) NOT NULL,
                    fhir_id VARCHAR(255) NOT NULL,
                    version_id INTEGER NOT NULL DEFAULT 1,
                    last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                    resource JSONB NOT NULL,
                    deleted BOOLEAN DEFAULT FALSE,
                    
                    -- Ensure uniqueness of resource_type + fhir_id for active resources
                    CONSTRAINT resources_resource_type_fhir_id_key UNIQUE(resource_type, fhir_id)
                );
                
                -- Create search_params table with ALL required columns
                CREATE TABLE fhir.search_params (
                    id BIGSERIAL PRIMARY KEY,
                    resource_id BIGINT NOT NULL,
                    resource_type VARCHAR(50) NOT NULL,
                    param_name VARCHAR(100) NOT NULL,
                    param_type VARCHAR(20) NOT NULL,
                    
                    -- Value columns for different FHIR data types
                    value_string TEXT,
                    value_number NUMERIC,
                    value_date TIMESTAMP WITH TIME ZONE,
                    value_token VARCHAR(500),
                    value_token_system VARCHAR(500),
                    value_token_code VARCHAR(500),
                    value_reference VARCHAR(500),
                    value_quantity_value NUMERIC,
                    value_quantity_unit VARCHAR(100),
                    value_uri TEXT,
                    value_composite TEXT,
                    
                    -- Metadata
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    
                    -- Foreign key to resources
                    CONSTRAINT fk_search_params_resource 
                        FOREIGN KEY (resource_id) 
                        REFERENCES fhir.resources(id) 
                        ON DELETE CASCADE
                );
                
                -- Create resource_history table for versioning
                CREATE TABLE fhir.resource_history (
                    id BIGSERIAL PRIMARY KEY,
                    resource_id BIGINT NOT NULL,
                    version_id INTEGER NOT NULL,
                    operation VARCHAR(20) NOT NULL, -- 'create', 'update', 'delete'
                    resource JSONB NOT NULL,
                    changed_fields JSONB, -- Track what changed
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    created_by VARCHAR(255),
                    
                    -- Foreign key and uniqueness
                    CONSTRAINT fk_resource_history_resource 
                        FOREIGN KEY (resource_id) 
                        REFERENCES fhir.resources(id) 
                        ON DELETE CASCADE,
                    CONSTRAINT resource_history_unique 
                        UNIQUE (resource_id, version_id)
                );
                
                -- Create references table for FHIR reference tracking
                CREATE TABLE fhir.references (
                    id BIGSERIAL PRIMARY KEY,
                    source_id BIGINT NOT NULL,
                    source_type VARCHAR(50) NOT NULL,
                    target_type VARCHAR(50) NOT NULL,
                    target_id VARCHAR(255) NOT NULL,
                    reference_path VARCHAR(100) NOT NULL,
                    reference_value TEXT NOT NULL,
                    reference_display VARCHAR(500),
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    
                    -- Foreign key
                    CONSTRAINT fk_references_source 
                        FOREIGN KEY (source_id) 
                        REFERENCES fhir.resources(id) 
                        ON DELETE CASCADE
                );
            """)
            
            logger.info("✅ FHIR tables created successfully")
            return True
            
        except Exception as e:
            logger.error(f"❌ FHIR schema creation failed: {e}")
            return False
    
    async def create_cds_hooks_schema(self):
        """Create CDS Hooks schema."""
        logger.info("🔧 Creating CDS Hooks schema...")
        
        try:
            await self.connection.execute("""
                -- Create CDS Hooks configuration table
                CREATE TABLE cds_hooks.hook_configurations (
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
                    tags JSONB DEFAULT '[]'::jsonb,
                    priority INTEGER DEFAULT 100,
                    
                    -- Constraints
                    CONSTRAINT valid_hook_type CHECK (hook_type IN (
                        'patient-view', 'medication-prescribe', 'order-review',
                        'order-select', 'order-sign', 'appointment-book'
                    ))
                );
                
                -- Create CDS Hooks execution log table
                CREATE TABLE cds_hooks.hook_execution_log (
                    id BIGSERIAL PRIMARY KEY,
                    hook_id VARCHAR(255) NOT NULL,
                    patient_id VARCHAR(255),
                    user_id VARCHAR(255),
                    execution_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    execution_duration_ms INTEGER,
                    cards_returned INTEGER DEFAULT 0,
                    success BOOLEAN DEFAULT true,
                    error_message TEXT,
                    context_data JSONB,
                    
                    -- Foreign key
                    CONSTRAINT fk_execution_log_hook 
                        FOREIGN KEY (hook_id) 
                        REFERENCES cds_hooks.hook_configurations(id) 
                        ON DELETE CASCADE
                );
            """)
            
            logger.info("✅ CDS Hooks tables created successfully")
            return True
            
        except Exception as e:
            logger.error(f"❌ CDS Hooks schema creation failed: {e}")
            return False
    
    async def create_indexes(self):
        """Create performance indexes."""
        logger.info("📊 Creating performance indexes...")
        
        try:
            await self.connection.execute("""
                -- Resources table indexes
                CREATE INDEX idx_resources_type ON fhir.resources(resource_type);
                CREATE INDEX idx_resources_type_id ON fhir.resources(resource_type, fhir_id);
                CREATE INDEX idx_resources_updated ON fhir.resources(last_updated DESC);
                CREATE INDEX idx_resources_deleted ON fhir.resources(deleted) WHERE deleted = false;
                CREATE INDEX idx_resources_json_gin ON fhir.resources USING gin(resource);
                
                -- Search params indexes for high-performance FHIR queries
                CREATE INDEX idx_search_params_resource ON fhir.search_params(resource_id, resource_type);
                CREATE INDEX idx_search_params_param_name ON fhir.search_params(param_name);
                CREATE INDEX idx_search_params_param_type ON fhir.search_params(param_type);
                CREATE INDEX idx_search_params_composite ON fhir.search_params(resource_type, param_name, param_type);
                
                -- Value-specific indexes (conditional)
                CREATE INDEX idx_search_params_string ON fhir.search_params(param_name, value_string) WHERE value_string IS NOT NULL;
                CREATE INDEX idx_search_params_number ON fhir.search_params(param_name, value_number) WHERE value_number IS NOT NULL;
                CREATE INDEX idx_search_params_date ON fhir.search_params(param_name, value_date) WHERE value_date IS NOT NULL;
                CREATE INDEX idx_search_params_token ON fhir.search_params(param_name, value_token) WHERE value_token IS NOT NULL;
                CREATE INDEX idx_search_params_token_code ON fhir.search_params(param_name, value_token_code) WHERE value_token_code IS NOT NULL;
                CREATE INDEX idx_search_params_reference ON fhir.search_params(param_name, value_reference) WHERE value_reference IS NOT NULL;
                CREATE INDEX idx_search_params_quantity ON fhir.search_params(param_name, value_quantity_value, value_quantity_unit) WHERE value_quantity_value IS NOT NULL;
                
                -- Resource history indexes
                CREATE INDEX idx_resource_history_resource_id ON fhir.resource_history(resource_id);
                CREATE INDEX idx_resource_history_created_at ON fhir.resource_history(created_at DESC);
                CREATE INDEX idx_resource_history_operation ON fhir.resource_history(operation);
                CREATE INDEX idx_resource_history_version ON fhir.resource_history(resource_id, version_id DESC);
                
                -- References indexes for relationship queries
                CREATE INDEX idx_references_source ON fhir.references(source_id, source_type);
                CREATE INDEX idx_references_target ON fhir.references(target_type, target_id);
                CREATE INDEX idx_references_path ON fhir.references(reference_path);
                CREATE INDEX idx_references_composite ON fhir.references(source_type, target_type, target_id);
                
                -- CDS Hooks indexes
                CREATE INDEX idx_hook_configurations_type ON cds_hooks.hook_configurations(hook_type);
                CREATE INDEX idx_hook_configurations_enabled ON cds_hooks.hook_configurations(enabled) WHERE enabled = true;
                CREATE INDEX idx_hook_configurations_created_at ON cds_hooks.hook_configurations(created_at DESC);
                CREATE INDEX idx_hook_configurations_updated_at ON cds_hooks.hook_configurations(updated_at DESC);
                CREATE INDEX idx_hook_configurations_priority ON cds_hooks.hook_configurations(priority, enabled);
                
                -- Execution log indexes
                CREATE INDEX idx_execution_log_hook_id ON cds_hooks.hook_execution_log(hook_id);
                CREATE INDEX idx_execution_log_patient ON cds_hooks.hook_execution_log(patient_id);
                CREATE INDEX idx_execution_log_time ON cds_hooks.hook_execution_log(execution_time DESC);
                CREATE INDEX idx_execution_log_success ON cds_hooks.hook_execution_log(success, execution_time DESC);
            """)
            
            logger.info("✅ Performance indexes created successfully")
            return True
            
        except Exception as e:
            logger.error(f"❌ Index creation failed: {e}")
            return False
    
    async def create_triggers(self):
        """Create database triggers for automation."""
        logger.info("⚡ Creating database triggers...")
        
        try:
            await self.connection.execute("""
                -- Function to update the updated_at timestamp
                CREATE OR REPLACE FUNCTION update_updated_at_column()
                RETURNS TRIGGER AS $$
                BEGIN
                    NEW.updated_at = CURRENT_TIMESTAMP;
                    RETURN NEW;
                END;
                $$ language 'plpgsql';
                
                -- Trigger for CDS Hooks configurations
                CREATE TRIGGER update_hook_configurations_updated_at 
                    BEFORE UPDATE ON cds_hooks.hook_configurations 
                    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
                
                -- Function to create resource history entries
                CREATE OR REPLACE FUNCTION create_resource_history()
                RETURNS TRIGGER AS $$
                BEGIN
                    INSERT INTO fhir.resource_history (
                        resource_id, version_id, operation, resource, created_by
                    ) VALUES (
                        COALESCE(NEW.id, OLD.id),
                        COALESCE(NEW.version_id, OLD.version_id),
                        CASE 
                            WHEN TG_OP = 'INSERT' THEN 'create'
                            WHEN TG_OP = 'UPDATE' THEN 'update'
                            WHEN TG_OP = 'DELETE' THEN 'delete'
                        END,
                        COALESCE(NEW.resource, OLD.resource),
                        current_user
                    );
                    RETURN COALESCE(NEW, OLD);
                END;
                $$ language 'plpgsql';
                
                -- Trigger for resource history
                CREATE TRIGGER resource_history_trigger 
                    AFTER INSERT OR UPDATE OR DELETE ON fhir.resources 
                    FOR EACH ROW EXECUTE FUNCTION create_resource_history();
            """)
            
            logger.info("✅ Database triggers created successfully")
            return True
            
        except Exception as e:
            logger.error(f"❌ Trigger creation failed: {e}")
            return False
    
    async def test_crud_operations(self):
        """Test basic CRUD operations to ensure schema works."""
        logger.info("🧪 Testing CRUD operations...")
        
        try:
            # Test patient creation
            test_patient = {
                "resourceType": "Patient",
                "id": "test-patient-123",
                "name": [{"family": "TestFamily", "given": ["TestGiven"]}],
                "gender": "unknown"
            }
            
            # Create
            patient_id = await self.connection.fetchval("""
                INSERT INTO fhir.resources (resource_type, fhir_id, resource)
                VALUES ($1, $2, $3)
                RETURNING id
            """, "Patient", "test-patient-123", json.dumps(test_patient))
            
            # Read
            result = await self.connection.fetchrow("""
                SELECT resource_type, fhir_id, resource 
                FROM fhir.resources 
                WHERE id = $1
            """, patient_id)
            
            if not result or result['resource_type'] != 'Patient':
                raise Exception("Patient creation/read test failed")
            
            # Test search param insertion
            await self.connection.execute("""
                INSERT INTO fhir.search_params (
                    resource_id, resource_type, param_name, param_type, value_string
                ) VALUES ($1, $2, $3, $4, $5)
            """, patient_id, "Patient", "family", "string", "TestFamily")
            
            # Test history entry (should be created by trigger)
            history_count = await self.connection.fetchval("""
                SELECT COUNT(*) FROM fhir.resource_history WHERE resource_id = $1
            """, patient_id)
            
            if history_count == 0:
                raise Exception("History trigger test failed")
            
            # Update
            test_patient["name"][0]["family"] = "UpdatedFamily"
            await self.connection.execute("""
                UPDATE fhir.resources 
                SET resource = $1, version_id = version_id + 1, last_updated = NOW()
                WHERE id = $2
            """, json.dumps(test_patient), patient_id)
            
            # Test CDS Hook creation
            await self.connection.execute("""
                INSERT INTO cds_hooks.hook_configurations (
                    id, hook_type, title, description, enabled
                ) VALUES ($1, $2, $3, $4, $5)
            """, "test-hook", "patient-view", "Test Hook", "Test description", True)
            
            # Cleanup test data
            await self.connection.execute("DELETE FROM fhir.resources WHERE id = $1", patient_id)
            await self.connection.execute("DELETE FROM cds_hooks.hook_configurations WHERE id = $1", "test-hook")
            
            logger.info("✅ CRUD operations test passed")
            return True
            
        except Exception as e:
            logger.error(f"❌ CRUD operations test failed: {e}")
            return False
    
    async def get_final_summary(self):
        """Get final database summary."""
        try:
            # Table counts
            fhir_tables = await self.connection.fetch("""
                SELECT table_name FROM information_schema.tables 
                WHERE table_schema = 'fhir' ORDER BY table_name
            """)
            
            cds_tables = await self.connection.fetch("""
                SELECT table_name FROM information_schema.tables 
                WHERE table_schema = 'cds_hooks' ORDER BY table_name
            """)
            
            # Index counts
            fhir_indexes = await self.connection.fetch("""
                SELECT indexname FROM pg_indexes 
                WHERE schemaname = 'fhir' AND indexname NOT LIKE '%_pkey'
            """)
            
            cds_indexes = await self.connection.fetch("""
                SELECT indexname FROM pg_indexes 
                WHERE schemaname = 'cds_hooks' AND indexname NOT LIKE '%_pkey'
            """)
            
            # Data counts
            result = await self.connection.fetchrow("""
                SELECT 
                    (SELECT COUNT(*) FROM fhir.resources WHERE deleted = FALSE OR deleted IS NULL) as resource_count,
                    (SELECT COUNT(*) FROM fhir.search_params) as search_param_count,
                    (SELECT COUNT(*) FROM fhir.resource_history) as history_count,
                    (SELECT COUNT(*) FROM fhir.references) as reference_count,
                    (SELECT COUNT(*) FROM cds_hooks.hook_configurations) as cds_hooks_count
            """)
            
            summary = {
                "mode": self.mode,
                "timestamp": datetime.now().isoformat(),
                "tables": {
                    "fhir": len(fhir_tables),
                    "cds_hooks": len(cds_tables)
                },
                "indexes": {
                    "fhir": len(fhir_indexes),
                    "cds_hooks": len(cds_indexes)
                },
                "data": {
                    "resources": result['resource_count'],
                    "search_params": result['search_param_count'],
                    "history": result['history_count'],
                    "references": result['reference_count'],
                    "cds_hooks": result['cds_hooks_count']
                }
            }
            
            return summary
            
        except Exception as e:
            logger.error(f"❌ Failed to get summary: {e}")
            return None
    
    async def initialize(self):
        """Main initialization method."""
        logger.info("🚀 MedGenEMR Unified Database Initialization")
        logger.info("=" * 60)
        logger.info(f"Mode: {self.mode}")
        logger.info(f"Verify only: {self.verify_only}")
        
        # Connect to database
        if not await self.connect():
            return False
        
        try:
            # If verify-only mode, just check schema
            if self.verify_only:
                return await self.verify_schema_only()
            
            # Full initialization
            steps = [
                ("Clean existing schema", self.clean_existing_schema),
                ("Create FHIR schema", self.create_fhir_schema),
                ("Create CDS Hooks schema", self.create_cds_hooks_schema),
                ("Create indexes", self.create_indexes),
                ("Create triggers", self.create_triggers),
                ("Test CRUD operations", self.test_crud_operations),
            ]
            
            for step_name, step_func in steps:
                logger.info(f"📍 {step_name}...")
                if not await step_func():
                    logger.error(f"❌ Failed at step: {step_name}")
                    return False
            
            # Get final summary
            summary = await self.get_final_summary()
            if summary:
                logger.info("🎉 Database initialization completed successfully!")
                logger.info("📊 Final Summary:")
                logger.info(f"   - Mode: {summary['mode']}")
                logger.info(f"   - FHIR tables: {summary['tables']['fhir']}")
                logger.info(f"   - CDS Hooks tables: {summary['tables']['cds_hooks']}")
                logger.info(f"   - FHIR indexes: {summary['indexes']['fhir']}")
                logger.info(f"   - CDS Hooks indexes: {summary['indexes']['cds_hooks']}")
                logger.info(f"   - Resources: {summary['data']['resources']:,}")
                logger.info(f"   - Search params: {summary['data']['search_params']:,}")
                logger.info(f"   - History records: {summary['data']['history']:,}")
                logger.info(f"   - References: {summary['data']['references']:,}")
                logger.info(f"   - CDS Hooks: {summary['data']['cds_hooks']:,}")
                
                # Save summary to file
                with open('/app/backend/data/database_init_summary.json', 'w') as f:
                    json.dump(summary, f, indent=2)
                logger.info("📄 Summary saved to backend/data/database_init_summary.json")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Database initialization failed: {e}")
            return False
        
        finally:
            await self.close()


async def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description='MedGenEMR Unified Database Initializer')
    parser.add_argument('--mode', choices=['development', 'production'], 
                        default='development', help='Deployment mode')
    parser.add_argument('--verify-only', action='store_true', 
                        help='Only verify existing schema, do not recreate')
    
    args = parser.parse_args()
    
    initializer = UnifiedDatabaseInitializer(mode=args.mode, verify_only=args.verify_only)
    success = await initializer.initialize()
    
    return 0 if success else 1


if __name__ == '__main__':
    sys.exit(asyncio.run(main()))