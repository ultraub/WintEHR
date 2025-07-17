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
    
    def __init__(self, mode="development", verify_only=False):
        self.mode = mode
        self.verify_only = verify_only
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
            # Drop and recreate everything to ensure consistency
            logger.info("🧹 Cleaning up any existing schema...")
            await self.connection.execute("""
                -- Drop all FHIR tables if they exist
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
            # Create the definitive schema
            logger.info("🏗️  Creating definitive database schema...")
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
                
                -- Ensure uniqueness of resource_type + fhir_id
                CONSTRAINT resources_resource_type_fhir_id_key UNIQUE(resource_type, fhir_id)
            );
            
            -- Create search_params table with ALL required columns
            CREATE TABLE fhir.search_params (
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
            CREATE TABLE fhir.resource_history (
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
            CREATE TABLE fhir.references (
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
                tags JSONB DEFAULT '[]'::jsonb
            );
        """)
        
            logger.info("✅ Tables created successfully")
            # Create all performance indexes
            logger.info("📊 Creating performance indexes...")
            await self.connection.execute("""
            -- Resources table indexes
            CREATE INDEX idx_resources_type ON fhir.resources(resource_type);
            CREATE INDEX idx_resources_type_id ON fhir.resources(resource_type, fhir_id);
            CREATE INDEX idx_resources_updated ON fhir.resources(last_updated);
            CREATE INDEX idx_resources_deleted ON fhir.resources(deleted) WHERE deleted = false;
            
            -- Search params indexes for performance
            CREATE INDEX idx_search_params_resource ON fhir.search_params(resource_id, resource_type);
            CREATE INDEX idx_search_params_param_name ON fhir.search_params(param_name);
            CREATE INDEX idx_search_params_param_type ON fhir.search_params(param_type);
            CREATE INDEX idx_search_params_string ON fhir.search_params(param_name, value_string) WHERE value_string IS NOT NULL;
            CREATE INDEX idx_search_params_number ON fhir.search_params(param_name, value_number) WHERE value_number IS NOT NULL;
            CREATE INDEX idx_search_params_date ON fhir.search_params(param_name, value_date) WHERE value_date IS NOT NULL;
            CREATE INDEX idx_search_params_token ON fhir.search_params(param_name, value_token) WHERE value_token IS NOT NULL;
            CREATE INDEX idx_search_params_token_code ON fhir.search_params(param_name, value_token_code) WHERE value_token_code IS NOT NULL;
            CREATE INDEX idx_search_params_reference ON fhir.search_params(param_name, value_reference) WHERE value_reference IS NOT NULL;
            
            -- Resource history indexes
            CREATE INDEX idx_resource_history_resource_id ON fhir.resource_history(resource_id);
            CREATE INDEX idx_resource_history_created_at ON fhir.resource_history(created_at);
            CREATE INDEX idx_resource_history_operation ON fhir.resource_history(operation);
            
            -- References indexes
            CREATE INDEX idx_references_source ON fhir.references(source_id, source_type);
            CREATE INDEX idx_references_target ON fhir.references(target_type, target_id);
            CREATE INDEX idx_references_path ON fhir.references(reference_path);
            
            -- CDS Hooks indexes
            CREATE INDEX idx_hook_configurations_type ON cds_hooks.hook_configurations(hook_type);
            CREATE INDEX idx_hook_configurations_enabled ON cds_hooks.hook_configurations(enabled);
            CREATE INDEX idx_hook_configurations_created_at ON cds_hooks.hook_configurations(created_at);
            CREATE INDEX idx_hook_configurations_updated_at ON cds_hooks.hook_configurations(updated_at);
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
            
            result = await self.connection.fetchval("SELECT COUNT(*) FROM cds_hooks.hook_configurations")
            logger.info(f"✅ CDS Hooks table accessible (count: {result})")
            
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
            expected_tables = ['resources', 'search_params', 'resource_history', 'references']
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
            expected_cds_tables = ['hook_configurations']
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
    
    args = parser.parse_args()
    
    initializer = DefinitiveDatabaseInitializer(
        mode=args.mode,
        verify_only=args.verify_only
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