#!/usr/bin/env python3
"""
Complete Database Initialization Script

This script ensures all required tables and schemas are properly created
with the correct data types and relationships.

Usage:
    python scripts/init_database_complete.py
"""

import asyncio
import asyncpg
import sys
from pathlib import Path
import logging


async def init_database():
    """Initialize the complete database schema."""
    
    logging.info("🚀 Initializing WintEHR Database Schema")
    logging.info("=" * 50)
    try:
        # Connect to database
        conn = await asyncpg.connect('postgresql://emr_user:emr_password@postgres:5432/emr_db')
        
        # Execute complete schema initialization
        await conn.execute("""
            -- Create schemas
            CREATE SCHEMA IF NOT EXISTS fhir;
            CREATE SCHEMA IF NOT EXISTS cds_hooks;
            
            -- Create or update resources table
            CREATE TABLE IF NOT EXISTS fhir.resources (
                id SERIAL PRIMARY KEY,
                resource_type VARCHAR(255) NOT NULL,
                fhir_id VARCHAR(255) NOT NULL,
                version_id INTEGER NOT NULL DEFAULT 1,
                last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                resource JSONB NOT NULL,
                deleted BOOLEAN DEFAULT FALSE,
                UNIQUE(resource_type, fhir_id)
            );
            
            -- Add deleted column if missing
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_schema = 'fhir' 
                    AND table_name = 'resources' 
                    AND column_name = 'deleted'
                ) THEN
                    ALTER TABLE fhir.resources ADD COLUMN deleted BOOLEAN DEFAULT FALSE;
                END IF;
            END$$;
            
            -- Create search_params table with correct data types
            CREATE TABLE IF NOT EXISTS fhir.search_params (
                id SERIAL PRIMARY KEY,
                resource_id INTEGER NOT NULL,
                resource_type VARCHAR(50) NOT NULL,
                param_name VARCHAR(100) NOT NULL,
                param_type VARCHAR(20) NOT NULL,
                value_string TEXT,
                value_token VARCHAR(500),
                value_reference VARCHAR(500),
                value_date TIMESTAMP,
                value_number NUMERIC,
                value_quantity_value NUMERIC,
                value_quantity_unit VARCHAR(100),
                value_token_system VARCHAR(500),
                value_token_code VARCHAR(500),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (resource_id) REFERENCES fhir.resources(id) ON DELETE CASCADE
            );
            
            -- Create resource_history table for versioning
            CREATE TABLE IF NOT EXISTS fhir.resource_history (
                id SERIAL PRIMARY KEY,
                resource_id INTEGER NOT NULL,
                version_id INTEGER NOT NULL,
                operation VARCHAR(20) NOT NULL, -- 'create', 'update', 'delete'
                resource JSONB NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_resource_history_resource 
                    FOREIGN KEY (resource_id) 
                    REFERENCES fhir.resources(id) 
                    ON DELETE CASCADE,
                CONSTRAINT idx_resource_history_unique 
                    UNIQUE (resource_id, version_id)
            );
            
            -- Create references table for FHIR reference tracking
            CREATE TABLE IF NOT EXISTS fhir.references (
                id SERIAL PRIMARY KEY,
                source_id INTEGER NOT NULL,
                source_type VARCHAR(50) NOT NULL,
                target_type VARCHAR(50) NOT NULL,
                target_id VARCHAR(255) NOT NULL,
                reference_path VARCHAR(100) NOT NULL,
                reference_value TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_references_source 
                    FOREIGN KEY (source_id) 
                    REFERENCES fhir.resources(id) 
                    ON DELETE CASCADE
            );
            
            -- Create indexes for performance
            CREATE INDEX IF NOT EXISTS idx_resources_type ON fhir.resources(resource_type);
            CREATE INDEX IF NOT EXISTS idx_resources_type_id ON fhir.resources(resource_type, fhir_id);
            CREATE INDEX IF NOT EXISTS idx_resources_updated ON fhir.resources(last_updated);
            CREATE INDEX IF NOT EXISTS idx_search_params_resource ON fhir.search_params(resource_id, resource_type);
            CREATE INDEX IF NOT EXISTS idx_search_params_token ON fhir.search_params(param_name, value_token) WHERE value_token IS NOT NULL;
            CREATE INDEX IF NOT EXISTS idx_search_params_reference ON fhir.search_params(param_name, value_reference) WHERE value_reference IS NOT NULL;
            CREATE INDEX IF NOT EXISTS idx_search_params_param_name ON fhir.search_params(param_name);
            CREATE INDEX IF NOT EXISTS idx_resource_history_resource_id ON fhir.resource_history(resource_id);
            CREATE INDEX IF NOT EXISTS idx_resource_history_created_at ON fhir.resource_history(created_at);
            CREATE INDEX IF NOT EXISTS idx_resource_history_operation ON fhir.resource_history(operation);
            CREATE INDEX IF NOT EXISTS idx_references_source ON fhir.references(source_id, source_type);
            CREATE INDEX IF NOT EXISTS idx_references_target ON fhir.references(target_type, target_id);
            CREATE INDEX IF NOT EXISTS idx_references_path ON fhir.references(reference_path);
        """)
        
        # Check table counts
        result = await conn.fetchrow("""
            SELECT 
                (SELECT COUNT(*) FROM fhir.resources WHERE deleted = FALSE OR deleted IS NULL) as resource_count,
                (SELECT COUNT(*) FROM fhir.search_params) as search_param_count,
                (SELECT COUNT(*) FROM fhir.resource_history) as history_count
        """)
        
        logging.info(f"✅ Database schema initialized successfully")
        logging.info(f"📊 Current counts:")
        logging.info(f"   - Resources: {result['resource_count']:,}")
        logging.info(f"   - Search params: {result['search_param_count']:,}")
        logging.info(f"   - History records: {result['history_count']:,}")
        await conn.close()
        return True
        
    except Exception as e:
        logging.info(f"❌ Database initialization failed: {e}")
        return False

if __name__ == '__main__':
    success = asyncio.run(init_database())
    sys.exit(0 if success else 1)