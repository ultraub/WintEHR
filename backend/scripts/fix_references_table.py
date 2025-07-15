#!/usr/bin/env python
"""
Fix the references table schema to match what the FHIR storage engine expects.
This script checks the current schema and updates it if necessary.
"""

import asyncio
import logging
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from database import DATABASE_URL

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


async def check_and_fix_references_table():
    """Check the references table schema and fix it if needed."""
    
    # Create async engine
    engine = create_async_engine(DATABASE_URL.replace('postgresql://', 'postgresql+asyncpg://'))
    
    async with engine.begin() as conn:
        logger.info("Checking references table schema...")
        
        # Check if the table exists
        result = await conn.execute(text("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'fhir' 
                AND table_name = 'references'
            );
        """))
        table_exists = result.scalar()
        
        if not table_exists:
            logger.info("References table does not exist. Creating it...")
            await create_references_table(conn)
        else:
            # Check column structure
            result = await conn.execute(text("""
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_schema = 'fhir' 
                AND table_name = 'references'
                ORDER BY ordinal_position;
            """))
            columns = {row[0]: row[1] for row in result}
            
            logger.info(f"Current columns: {list(columns.keys())}")
            
            # Check if we have the expected columns
            expected_columns = {
                'source_type', 'target_type', 'reference_path', 'reference_value'
            }
            missing_columns = expected_columns - set(columns.keys())
            
            if missing_columns:
                logger.info(f"Missing columns: {missing_columns}")
                await fix_references_table_schema(conn, columns)
            else:
                logger.info("✅ References table schema is correct!")
                
        # Verify the final schema
        await verify_schema(conn)
        
    await engine.dispose()


async def create_references_table(conn):
    """Create the references table with the correct schema."""
    await conn.execute(text("""
        CREATE TABLE fhir.references (
            id BIGSERIAL PRIMARY KEY,
            source_id BIGINT NOT NULL,
            source_type VARCHAR(50) NOT NULL,
            target_type VARCHAR(50),
            target_id VARCHAR(64),
            reference_path VARCHAR(255) NOT NULL,
            reference_value TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (source_id) REFERENCES fhir.resources(id) ON DELETE CASCADE
        );
    """))
    
    # Create indexes
    await conn.execute(text("""
        CREATE INDEX idx_references_source ON fhir.references(source_id);
    """))
    await conn.execute(text("""
        CREATE INDEX idx_references_target ON fhir.references(target_type, target_id);
    """))
    await conn.execute(text("""
        CREATE INDEX idx_references_source_type ON fhir.references(source_type, source_id);
    """))
    
    logger.info("✅ Created references table with correct schema")


async def fix_references_table_schema(conn, existing_columns):
    """Fix the references table schema by adding missing columns or recreating."""
    
    # Check if we can add columns or need to recreate
    if 'source_resource_id' in existing_columns or 'source_path' in existing_columns:
        # This is the old schema, we need to migrate
        logger.info("Detected old schema. Migrating to new schema...")
        
        # First, rename the old table
        await conn.execute(text("""
            ALTER TABLE fhir.references RENAME TO references_old;
        """))
        
        # Create new table with correct schema
        await create_references_table(conn)
        
        # Migrate data if possible
        if 'source_resource_id' in existing_columns:
            logger.info("Migrating existing data...")
            await conn.execute(text("""
                INSERT INTO fhir.references (
                    source_id, source_type, target_type, target_id, 
                    reference_path, reference_value
                )
                SELECT 
                    COALESCE(source_id, source_resource_id) as source_id,
                    'Unknown' as source_type,  -- We'll need to update this
                    target_resource_type as target_type,
                    target_resource_id as target_id,
                    source_path as reference_path,
                    COALESCE(target_url, 
                        CONCAT(target_resource_type, '/', target_resource_id)
                    ) as reference_value
                FROM fhir.references_old
                WHERE source_resource_id IS NOT NULL;
            """))
            
            # Update source_type based on resources table
            await conn.execute(text("""
                UPDATE fhir.references r
                SET source_type = res.resource_type
                FROM fhir.resources res
                WHERE r.source_id = res.id;
            """))
            
            logger.info("✅ Data migration completed")
            
            # Drop old table
            await conn.execute(text("DROP TABLE fhir.references_old;"))
    else:
        # Just add missing columns
        logger.info("Adding missing columns...")
        
        if 'source_type' not in existing_columns:
            await conn.execute(text("""
                ALTER TABLE fhir.references 
                ADD COLUMN source_type VARCHAR(50) NOT NULL DEFAULT 'Unknown';
            """))
            
        if 'target_type' not in existing_columns:
            await conn.execute(text("""
                ALTER TABLE fhir.references 
                ADD COLUMN target_type VARCHAR(50);
            """))
            
        if 'reference_path' not in existing_columns:
            await conn.execute(text("""
                ALTER TABLE fhir.references 
                ADD COLUMN reference_path VARCHAR(255) NOT NULL DEFAULT 'unknown';
            """))
            
        if 'reference_value' not in existing_columns:
            await conn.execute(text("""
                ALTER TABLE fhir.references 
                ADD COLUMN reference_value TEXT NOT NULL DEFAULT '';
            """))
            
        # Update source_type from resources table
        await conn.execute(text("""
            UPDATE fhir.references r
            SET source_type = res.resource_type
            FROM fhir.resources res
            WHERE r.source_id = res.id AND r.source_type = 'Unknown';
        """))
        
        logger.info("✅ Added missing columns")


async def verify_schema(conn):
    """Verify the final schema is correct."""
    result = await conn.execute(text("""
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_schema = 'fhir' 
        AND table_name = 'references'
        ORDER BY ordinal_position;
    """))
    
    logger.info("\nFinal schema:")
    for row in result:
        logger.info(f"  {row[0]}: {row[1]} {'NULL' if row[2] == 'YES' else 'NOT NULL'}")
    
    # Test insert
    try:
        await conn.execute(text("""
            INSERT INTO fhir.references (
                source_id, source_type, target_type, target_id,
                reference_path, reference_value
            ) VALUES (
                1, 'Test', 'Patient', 'test-123',
                'subject', 'Patient/test-123'
            );
        """))
        await conn.execute(text("""
            DELETE FROM fhir.references WHERE source_type = 'Test';
        """))
        logger.info("\n✅ Test insert successful!")
    except Exception as e:
        logger.error(f"\n❌ Test insert failed: {e}")


async def main():
    """Main entry point."""
    try:
        await check_and_fix_references_table()
        logger.info("\n🎉 References table schema fixed successfully!")
        logger.info("\nNext steps:")
        logger.info("1. Restart the backend server")
        logger.info("2. Try updating a condition again")
    except Exception as e:
        logger.error(f"\n❌ Error: {e}")
        raise


if __name__ == "__main__":
    asyncio.run(main())