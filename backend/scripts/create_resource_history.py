#!/usr/bin/env python3
"""
Create the missing fhir.resource_history table
This table is required for tracking FHIR resource updates
"""

import asyncio
import os
import sys
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import DATABASE_URL
import logging


async def create_resource_history_table():
    """Create the fhir.resource_history table"""
    
    # Create async engine
    engine = create_async_engine(DATABASE_URL.replace('postgresql://', 'postgresql+asyncpg://'))
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    try:
        async with async_session() as session:
            logging.info("Creating fhir.resource_history table...")
            # Execute each SQL statement separately
            
            # 1. Create the table
            await session.execute(text("""
                CREATE TABLE IF NOT EXISTS fhir.resource_history (
                    id SERIAL PRIMARY KEY,
                    resource_id INTEGER NOT NULL,
                    version_id INTEGER NOT NULL,
                    operation VARCHAR(20) NOT NULL,
                    resource JSONB NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    
                    CONSTRAINT fk_resource_history_resource 
                        FOREIGN KEY (resource_id) 
                        REFERENCES fhir.resources(id) 
                        ON DELETE CASCADE,
                    
                    CONSTRAINT idx_resource_history_unique 
                        UNIQUE (resource_id, version_id)
                )
            """))
            logging.info("✓ Created table")
            # 2. Create indexes
            await session.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_resource_history_resource_id 
                    ON fhir.resource_history(resource_id)
            """))
            logging.info("✓ Created resource_id index")
            await session.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_resource_history_created_at 
                    ON fhir.resource_history(created_at)
            """))
            logging.info("✓ Created created_at index")
            await session.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_resource_history_operation 
                    ON fhir.resource_history(operation)
            """))
            logging.info("✓ Created operation index")
            # 3. Add comments
            await session.execute(text("""
                COMMENT ON TABLE fhir.resource_history IS 
                    'History table for tracking changes to FHIR resources'
            """))
            
            await session.execute(text("""
                COMMENT ON COLUMN fhir.resource_history.resource_id IS 
                    'Foreign key to fhir.resources table'
            """))
            
            await session.execute(text("""
                COMMENT ON COLUMN fhir.resource_history.version_id IS 
                    'Version number of the resource'
            """))
            
            await session.execute(text("""
                COMMENT ON COLUMN fhir.resource_history.operation IS 
                    'Type of operation: create, update, or delete'
            """))
            
            await session.execute(text("""
                COMMENT ON COLUMN fhir.resource_history.resource IS 
                    'Full FHIR resource JSON at this version'
            """))
            
            await session.execute(text("""
                COMMENT ON COLUMN fhir.resource_history.created_at IS 
                    'Timestamp when this version was created'
            """))
            logging.info("✓ Added table and column comments")
            await session.commit()
            
            logging.info("✓ Successfully created fhir.resource_history table")
            # Verify the table was created
            result = await session.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'fhir' 
                    AND table_name = 'resource_history'
                );
            """))
            exists = result.scalar()
            
            if exists:
                logging.info("✓ Table verification successful")
                # Get table structure
                result = await session.execute(text("""
                    SELECT column_name, data_type, is_nullable, column_default
                    FROM information_schema.columns
                    WHERE table_schema = 'fhir' 
                    AND table_name = 'resource_history'
                    ORDER BY ordinal_position;
                """))
                
                logging.info("\nTable structure:")
                logging.info("-" * 80)
                for row in result:
                    print(f"  {row.column_name:<20} {row.data_type:<20} "
                          f"{'NULL' if row.is_nullable == 'YES' else 'NOT NULL':<10} "
                          f"{row.column_default or ''}")
            else:
                logging.info("✗ Table creation failed - table does not exist")
    except Exception as e:
        logging.error(f"\n✗ Error creating table: {e}")
        logging.error(f"\nError type: {type(e).__name__}")
        if hasattr(e, 'orig'):
            logging.error(f"Original error: {e.orig}")
        raise
    finally:
        await engine.dispose()

if __name__ == "__main__":
    logging.info("FHIR Resource History Table Creator")
    logging.info("=" * 80)
    asyncio.run(create_resource_history_table())