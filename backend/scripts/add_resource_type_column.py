#!/usr/bin/env python3
"""
Add resource_type column to search_params table

This migration script adds the missing resource_type column to the fhir.search_params table
and populates it with data from the resources table. This fixes the schema mismatch that
was causing FHIR update/delete operations to fail.
"""

import asyncio
import os
import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql+asyncpg://robertbarrett@127.0.0.1:5432/medgenemr')


async def check_column_exists(session: AsyncSession) -> bool:
    """Check if resource_type column already exists."""
    query = text("""
        SELECT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_schema = 'fhir' 
            AND table_name = 'search_params' 
            AND column_name = 'resource_type'
        )
    """)
    
    result = await session.execute(query)
    return result.scalar()


async def add_resource_type_column(session: AsyncSession):
    """Add resource_type column to search_params table."""
    logger.info("🔧 Adding resource_type column to fhir.search_params table...")
    
    # Step 1: Add the column as nullable first
    add_column_query = text("""
        ALTER TABLE fhir.search_params 
        ADD COLUMN resource_type VARCHAR(50)
    """)
    
    await session.execute(add_column_query)
    logger.info("✅ Added resource_type column")
    
    # Step 2: Populate existing records by joining with resources table
    populate_query = text("""
        UPDATE fhir.search_params sp 
        SET resource_type = r.resource_type 
        FROM fhir.resources r 
        WHERE sp.resource_id = r.id 
        AND sp.resource_type IS NULL
    """)
    
    result = await session.execute(populate_query)
    rows_updated = result.rowcount
    logger.info(f"✅ Populated resource_type for {rows_updated} existing records")
    
    # Step 3: Make the column NOT NULL
    not_null_query = text("""
        ALTER TABLE fhir.search_params 
        ALTER COLUMN resource_type SET NOT NULL
    """)
    
    await session.execute(not_null_query)
    logger.info("✅ Set resource_type column to NOT NULL")
    
    # Step 4: Add index for performance
    index_query = text("""
        CREATE INDEX IF NOT EXISTS idx_search_params_resource_type 
        ON fhir.search_params(resource_type)
    """)
    
    await session.execute(index_query)
    logger.info("✅ Added index on resource_type column")
    
    # Step 5: Add composite index for common queries
    composite_index_query = text("""
        CREATE INDEX IF NOT EXISTS idx_search_params_type_name 
        ON fhir.search_params(resource_type, param_name)
    """)
    
    await session.execute(composite_index_query)
    logger.info("✅ Added composite index on resource_type and param_name")


async def verify_migration(session: AsyncSession):
    """Verify the migration was successful."""
    logger.info("🔍 Verifying migration...")
    
    # Check column exists and is properly typed
    column_check = text("""
        SELECT 
            column_name,
            data_type,
            is_nullable,
            character_maximum_length
        FROM information_schema.columns 
        WHERE table_schema = 'fhir' 
        AND table_name = 'search_params' 
        AND column_name = 'resource_type'
    """)
    
    result = await session.execute(column_check)
    column_info = result.fetchone()
    
    if column_info:
        logger.info(f"✅ Column verified: {column_info.column_name} {column_info.data_type}({column_info.character_maximum_length}) NOT NULL: {column_info.is_nullable == 'NO'}")
    else:
        logger.error("❌ Column not found after migration!")
        return False
    
    # Check data population
    data_check = text("""
        SELECT 
            COUNT(*) as total_records,
            COUNT(resource_type) as populated_records,
            COUNT(DISTINCT resource_type) as unique_types
        FROM fhir.search_params
    """)
    
    result = await session.execute(data_check)
    stats = result.fetchone()
    
    logger.info(f"📊 Data verification:")
    logger.info(f"   - Total records: {stats.total_records}")
    logger.info(f"   - Populated records: {stats.populated_records}")
    logger.info(f"   - Unique resource types: {stats.unique_types}")
    
    if stats.total_records == stats.populated_records:
        logger.info("✅ All records have resource_type populated")
    else:
        logger.warning(f"⚠️  {stats.total_records - stats.populated_records} records missing resource_type")
    
    # Check indexes
    index_check = text("""
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename = 'search_params' 
        AND schemaname = 'fhir'
        AND indexname LIKE '%resource_type%'
    """)
    
    result = await session.execute(index_check)
    indexes = result.fetchall()
    
    logger.info(f"✅ Found {len(indexes)} resource_type indexes:")
    for idx in indexes:
        logger.info(f"   - {idx.indexname}")
    
    return True


async def run_migration():
    """Run the complete migration process."""
    logger.info("🚀 Starting resource_type column migration...")
    
    engine = create_async_engine(DATABASE_URL, echo=False)
    
    try:
        async with engine.begin() as conn:
            # Use a session for the migration
            session = AsyncSession(bind=conn)
            
            # Check if column already exists
            if await check_column_exists(session):
                logger.info("✅ resource_type column already exists - skipping migration")
                await verify_migration(session)
                return True
            
            # Run the migration
            await add_resource_type_column(session)
            
            # Verify the migration
            if await verify_migration(session):
                logger.info("🎉 Migration completed successfully!")
                return True
            else:
                logger.error("❌ Migration verification failed!")
                return False
                
    except Exception as e:
        logger.error(f"❌ Migration failed: {e}")
        return False
    finally:
        await engine.dispose()


if __name__ == "__main__":
    success = asyncio.run(run_migration())
    sys.exit(0 if success else 1)