#!/usr/bin/env python3
"""
Fix references table column names to match what the code expects.
"""

import asyncio
import asyncpg
import os
import logging

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

async def fix_references_table():
    """Fix references table column names."""
    
    # Database connection
    DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://emr_user:emr_password@postgres:5432/emr_db')
    
    # Convert to asyncpg format
    if 'postgresql://' in DATABASE_URL:
        DATABASE_URL = DATABASE_URL.replace('postgresql://', 'postgresql+asyncpg://')
    if '+asyncpg' in DATABASE_URL:
        DATABASE_URL = DATABASE_URL.replace('+asyncpg', '')
    
    conn = await asyncpg.connect(DATABASE_URL)
    
    try:
        # First, backup the existing data
        logger.info("Backing up existing references data...")
        existing_data = await conn.fetch("SELECT * FROM fhir.references")
        logger.info(f"Backed up {len(existing_data)} references")
        
        # Check if new columns already exist
        new_columns = await conn.fetch("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'fhir' 
            AND table_name = 'references'
            AND column_name IN ('source_type', 'target_type', 'reference_value')
        """)
        
        new_column_names = [col['column_name'] for col in new_columns]
        
        # Add missing columns
        if 'source_type' not in new_column_names:
            logger.info("Adding source_type column...")
            await conn.execute("""
                ALTER TABLE fhir.references 
                ADD COLUMN source_type VARCHAR(255)
            """)
            logger.info("✅ Added source_type column")
        
        if 'target_type' not in new_column_names:
            logger.info("Adding target_type column...")
            await conn.execute("""
                ALTER TABLE fhir.references 
                ADD COLUMN target_type VARCHAR(255)
            """)
            # Migrate data from target_resource_type
            await conn.execute("""
                UPDATE fhir.references 
                SET target_type = target_resource_type 
                WHERE target_type IS NULL AND target_resource_type IS NOT NULL
            """)
            logger.info("✅ Added target_type column and migrated data")
        
        if 'target_id' not in new_column_names:
            logger.info("Adding target_id column...")
            await conn.execute("""
                ALTER TABLE fhir.references 
                ADD COLUMN target_id VARCHAR(255)
            """)
            # Migrate data from target_resource_id
            await conn.execute("""
                UPDATE fhir.references 
                SET target_id = target_resource_id 
                WHERE target_id IS NULL AND target_resource_id IS NOT NULL
            """)
            logger.info("✅ Added target_id column and migrated data")
        
        if 'reference_path' not in new_column_names:
            logger.info("Adding reference_path column...")
            await conn.execute("""
                ALTER TABLE fhir.references 
                ADD COLUMN reference_path VARCHAR(255)
            """)
            # Migrate data from source_path
            await conn.execute("""
                UPDATE fhir.references 
                SET reference_path = source_path 
                WHERE reference_path IS NULL AND source_path IS NOT NULL
            """)
            logger.info("✅ Added reference_path column and migrated data")
        
        if 'reference_value' not in new_column_names:
            logger.info("Adding reference_value column...")
            await conn.execute("""
                ALTER TABLE fhir.references 
                ADD COLUMN reference_value TEXT
            """)
            logger.info("✅ Added reference_value column")
        
        # Create indexes for the new columns
        logger.info("Creating indexes...")
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_references_source_type 
            ON fhir.references(source_type, source_id)
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_references_target_type 
            ON fhir.references(target_type, target_id)
        """)
        logger.info("✅ Created indexes")
        
        # Verify the final structure
        final_columns = await conn.fetch("""
            SELECT column_name, data_type
            FROM information_schema.columns 
            WHERE table_schema = 'fhir' 
            AND table_name = 'references'
            ORDER BY ordinal_position
        """)
        
        logger.info("\nFinal references table structure:")
        for col in final_columns:
            logger.info(f"  - {col['column_name']}: {col['data_type']}")
        
    except Exception as e:
        logger.error(f"Error fixing references table: {e}")
        raise
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(fix_references_table())