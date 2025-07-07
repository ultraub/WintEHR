#!/usr/bin/env python3
"""
Definitive Database Initialization Script

This is the ONE script that creates the complete, correct database schema
for MedGenEMR with all required tables, columns, constraints, and indexes.

This script replaces all other initialization attempts and ensures consistency.

Usage:
    python scripts/init_database_definitive.py
"""

import asyncio
import asyncpg
import sys
from pathlib import Path

async def init_database_definitive():
    """Initialize the complete database schema definitively."""
    
    print("🚀 MedGenEMR Definitive Database Initialization")
    print("=" * 60)
    
    try:
        # Connect to database
        conn = await asyncpg.connect('postgresql://emr_user:emr_password@postgres:5432/emr_db')
        
        # Drop and recreate everything to ensure consistency
        print("🧹 Cleaning up any existing schema...")
        await conn.execute("""
            -- Drop all FHIR tables if they exist
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
        
        print("✅ Schemas cleaned and recreated")
        
        # Create the definitive schema
        print("🏗️  Creating definitive database schema...")
        await conn.execute("""
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
        """)
        
        print("✅ Tables created successfully")
        
        # Create all performance indexes
        print("📊 Creating performance indexes...")
        await conn.execute("""
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
        """)
        
        print("✅ Indexes created successfully")
        
        # Verify the schema
        print("🔍 Verifying schema...")
        
        # Check table counts
        result = await conn.fetchrow("""
            SELECT 
                (SELECT COUNT(*) FROM fhir.resources WHERE deleted = FALSE OR deleted IS NULL) as resource_count,
                (SELECT COUNT(*) FROM fhir.search_params) as search_param_count,
                (SELECT COUNT(*) FROM fhir.resource_history) as history_count,
                (SELECT COUNT(*) FROM fhir.references) as reference_count
        """)
        
        # Check schema structure
        tables = await conn.fetch("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'fhir'
            ORDER BY table_name
        """)
        
        table_names = [row['table_name'] for row in tables]
        expected_tables = ['resources', 'search_params', 'resource_history', 'references']
        
        missing_tables = set(expected_tables) - set(table_names)
        if missing_tables:
            raise Exception(f"Missing tables: {missing_tables}")
        
        # Check critical columns exist
        search_params_columns = await conn.fetch("""
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_schema = 'fhir' AND table_name = 'search_params'
            ORDER BY ordinal_position
        """)
        
        search_columns = {row['column_name']: row['data_type'] for row in search_params_columns}
        required_columns = [
            'resource_id', 'resource_type', 'param_name', 'param_type',
            'value_string', 'value_number', 'value_date', 'value_token',
            'value_token_system', 'value_token_code', 'value_reference'
        ]
        
        missing_columns = set(required_columns) - set(search_columns.keys())
        if missing_columns:
            raise Exception(f"Missing search_params columns: {missing_columns}")
        
        print(f"✅ Schema validation passed")
        print(f"📊 Definitive Schema Summary:")
        print(f"   - Tables created: {len(table_names)}")
        print(f"   - Expected tables: {', '.join(expected_tables)}")
        print(f"   - Actual tables: {', '.join(table_names)}")
        print(f"   - Search params columns: {len(search_columns)}")
        print(f"   - Resources: {result['resource_count']:,}")
        print(f"   - Search params: {result['search_param_count']:,}")
        print(f"   - History records: {result['history_count']:,}")
        print(f"   - References: {result['reference_count']:,}")
        
        await conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Definitive database initialization failed: {e}")
        return False

if __name__ == '__main__':
    success = asyncio.run(init_database_definitive())
    sys.exit(0 if success else 1)