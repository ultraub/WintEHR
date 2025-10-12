"""
Migration: Add FHIR Version Metadata Support
Creates tables and indexes for version-aware FHIR storage
"""

import asyncio
import asyncpg
from sqlalchemy import text
import logging
import sys
import os

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import engine

logger = logging.getLogger(__name__)

async def create_version_metadata_table():
    """Create the FHIR resource version metadata table"""
    
    async with engine.begin() as conn:
        # Create fhir schema if it doesn't exist
        await conn.execute(text("CREATE SCHEMA IF NOT EXISTS fhir"))
        
        # Create resource_versions table
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS fhir.resource_versions (
                id SERIAL PRIMARY KEY,
                fhir_id VARCHAR(255) NOT NULL,
                detected_version VARCHAR(20) NOT NULL,
                stored_version VARCHAR(20) NOT NULL,
                original_version VARCHAR(20),
                transformation_applied BOOLEAN DEFAULT FALSE,
                compatibility_level VARCHAR(50) DEFAULT 'full',
                detection_confidence DECIMAL(3,2) DEFAULT 1.0,
                version_indicators JSONB DEFAULT '[]',
                storage_strategy VARCHAR(20) DEFAULT 'native',
                extensions JSONB DEFAULT '{}',
                profiles JSONB DEFAULT '[]',
                transformation_log JSONB DEFAULT '[]',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                
                -- Constraints
                CONSTRAINT unique_fhir_id UNIQUE (fhir_id),
                CONSTRAINT valid_versions CHECK (
                    detected_version IN ('4.0.1', '5.0.0', '6.0.0') AND
                    stored_version IN ('4.0.1', '5.0.0', '6.0.0') AND
                    (original_version IS NULL OR original_version IN ('4.0.1', '5.0.0', '6.0.0'))
                ),
                CONSTRAINT valid_confidence CHECK (
                    detection_confidence >= 0.0 AND detection_confidence <= 1.0
                ),
                CONSTRAINT valid_storage_strategy CHECK (
                    storage_strategy IN ('native', 'canonical', 'multi', 'hybrid')
                )
            )
        """))
        
        # Create indexes for performance
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_resource_versions_fhir_id 
            ON fhir.resource_versions (fhir_id)
        """))
        
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_resource_versions_detected_version 
            ON fhir.resource_versions (detected_version)
        """))
        
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_resource_versions_stored_version 
            ON fhir.resource_versions (stored_version)
        """))
        
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_resource_versions_strategy 
            ON fhir.resource_versions (storage_strategy)
        """))
        
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_resource_versions_transformation 
            ON fhir.resource_versions (transformation_applied)
        """))
        
        # Create GIN index for JSONB fields
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_resource_versions_extensions_gin 
            ON fhir.resource_versions USING GIN (extensions)
        """))
        
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_resource_versions_profiles_gin 
            ON fhir.resource_versions USING GIN (profiles)
        """))
        
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_resource_versions_indicators_gin 
            ON fhir.resource_versions USING GIN (version_indicators)
        """))
        
        logger.info("Created fhir.resource_versions table with indexes")

async def create_version_compatibility_table():
    """Create table for FHIR version compatibility matrix"""
    
    async with engine.begin() as conn:
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS fhir.version_compatibility (
                id SERIAL PRIMARY KEY,
                source_version VARCHAR(20) NOT NULL,
                target_version VARCHAR(20) NOT NULL,
                resource_type VARCHAR(100),
                compatibility_level VARCHAR(50) NOT NULL,
                transformation_available BOOLEAN DEFAULT FALSE,
                data_loss_risk VARCHAR(20) DEFAULT 'none',
                notes TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                
                -- Constraints
                CONSTRAINT unique_version_resource_combo UNIQUE (source_version, target_version, resource_type),
                CONSTRAINT valid_source_version CHECK (source_version IN ('4.0.1', '5.0.0', '6.0.0')),
                CONSTRAINT valid_target_version CHECK (target_version IN ('4.0.1', '5.0.0', '6.0.0')),
                CONSTRAINT valid_compatibility CHECK (
                    compatibility_level IN ('full', 'partial', 'minimal', 'none')
                ),
                CONSTRAINT valid_data_loss_risk CHECK (
                    data_loss_risk IN ('none', 'low', 'medium', 'high', 'severe')
                )
            )
        """))
        
        # Insert default compatibility data
        await conn.execute(text("""
            INSERT INTO fhir.version_compatibility 
            (source_version, target_version, compatibility_level, transformation_available, data_loss_risk, notes)
            VALUES 
            -- R4 to R5
            ('4.0.1', '5.0.0', 'partial', true, 'low', 'Most resources compatible with minor field changes'),
            ('5.0.0', '4.0.1', 'partial', true, 'medium', 'Some R5 features may be lost in downgrade'),
            
            -- R5 to R6 (future)
            ('5.0.0', '6.0.0', 'minimal', false, 'high', 'Major changes expected in R6'),
            ('6.0.0', '5.0.0', 'minimal', false, 'high', 'R6 features incompatible with R5'),
            
            -- R4 to R6 (future)
            ('4.0.1', '6.0.0', 'minimal', false, 'severe', 'Major version gap requires careful migration'),
            ('6.0.0', '4.0.1', 'minimal', false, 'severe', 'Significant data loss expected')
            
            ON CONFLICT (source_version, target_version, resource_type) DO NOTHING
        """))
        
        logger.info("Created fhir.version_compatibility table with default data")

async def add_version_columns_to_resources():
    """Add version metadata columns to existing resources table"""
    
    async with engine.begin() as conn:
        # Add FHIR version column to main resources table
        try:
            await conn.execute(text("""
                ALTER TABLE fhir.resources 
                ADD COLUMN IF NOT EXISTS fhir_version VARCHAR(20) DEFAULT '4.0.1'
            """))
            
            await conn.execute(text("""
                ALTER TABLE fhir.resources 
                ADD COLUMN IF NOT EXISTS version_metadata_id INTEGER REFERENCES fhir.resource_versions(id)
            """))
            
            # Create index on fhir_version
            await conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_resources_fhir_version 
                ON fhir.resources (fhir_version)
            """))
            
            logger.info("Added version columns to fhir.resources table")
            
        except Exception as e:
            logger.warning(f"Could not add version columns (may already exist): {e}")

async def create_version_migration_log():
    """Create table to track version migrations"""
    
    async with engine.begin() as conn:
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS fhir.version_migrations (
                id SERIAL PRIMARY KEY,
                fhir_id VARCHAR(255) NOT NULL,
                resource_type VARCHAR(100) NOT NULL,
                from_version VARCHAR(20) NOT NULL,
                to_version VARCHAR(20) NOT NULL,
                migration_type VARCHAR(50) NOT NULL, -- 'automatic', 'manual', 'batch'
                status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'completed', 'failed', 'rollback'
                started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                completed_at TIMESTAMP WITH TIME ZONE,
                error_message TEXT,
                transformation_log JSONB DEFAULT '[]',
                rollback_data JSONB,
                created_by VARCHAR(255),
                
                -- Constraints
                CONSTRAINT valid_migration_status CHECK (
                    status IN ('pending', 'in_progress', 'completed', 'failed', 'rollback')
                ),
                CONSTRAINT valid_migration_type CHECK (
                    migration_type IN ('automatic', 'manual', 'batch', 'system')
                )
            )
        """))
        
        # Create indexes
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_version_migrations_fhir_id 
            ON fhir.version_migrations (fhir_id)
        """))
        
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_version_migrations_status 
            ON fhir.version_migrations (status)
        """))
        
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_version_migrations_type 
            ON fhir.version_migrations (migration_type)
        """))
        
        logger.info("Created fhir.version_migrations table")

async def run_migration():
    """Run the complete FHIR version metadata migration"""
    logger.info("Starting FHIR version metadata migration...")
    
    try:
        await create_version_metadata_table()
        await create_version_compatibility_table()
        await add_version_columns_to_resources()
        await create_version_migration_log()
        
        logger.info("FHIR version metadata migration completed successfully!")
        
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        raise

if __name__ == "__main__":
    asyncio.run(run_migration())