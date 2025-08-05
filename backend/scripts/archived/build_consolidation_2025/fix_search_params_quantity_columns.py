#!/usr/bin/env python3
"""
Add missing quantity columns to search_params table.
"""

import asyncio
import asyncpg
import os
import logging

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

async def add_quantity_columns():
    """Add missing quantity columns to search_params table."""
    
    # Database connection
    DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://emr_user:emr_password@postgres:5432/emr_db')
    
    # Convert to asyncpg format
    if 'postgresql://' in DATABASE_URL:
        DATABASE_URL = DATABASE_URL.replace('postgresql://', 'postgresql+asyncpg://')
    if '+asyncpg' in DATABASE_URL:
        DATABASE_URL = DATABASE_URL.replace('+asyncpg', '')
    
    conn = await asyncpg.connect(DATABASE_URL)
    
    try:
        # Check if columns already exist
        existing_columns = await conn.fetch("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'fhir' 
            AND table_name = 'search_params'
            AND column_name IN ('value_quantity_value', 'value_quantity_unit')
        """)
        
        existing_column_names = [col['column_name'] for col in existing_columns]
        
        # Add value_quantity_value if missing
        if 'value_quantity_value' not in existing_column_names:
            logger.info("Adding value_quantity_value column...")
            await conn.execute("""
                ALTER TABLE fhir.search_params 
                ADD COLUMN value_quantity_value NUMERIC
            """)
            logger.info("✅ Added value_quantity_value column")
        else:
            logger.info("✓ value_quantity_value column already exists")
        
        # Add value_quantity_unit if missing
        if 'value_quantity_unit' not in existing_column_names:
            logger.info("Adding value_quantity_unit column...")
            await conn.execute("""
                ALTER TABLE fhir.search_params 
                ADD COLUMN value_quantity_unit VARCHAR(255)
            """)
            logger.info("✅ Added value_quantity_unit column")
        else:
            logger.info("✓ value_quantity_unit column already exists")
        
        # Create index for quantity searches if needed
        logger.info("Creating quantity search index...")
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_search_params_quantity 
            ON fhir.search_params(param_name, value_quantity_value) 
            WHERE value_quantity_value IS NOT NULL
        """)
        logger.info("✅ Quantity search index created/verified")
        
        # Verify columns
        final_columns = await conn.fetch("""
            SELECT column_name, data_type
            FROM information_schema.columns 
            WHERE table_schema = 'fhir' 
            AND table_name = 'search_params'
            AND column_name LIKE 'value_%'
            ORDER BY column_name
        """)
        
        logger.info("\nFinal search_params value columns:")
        for col in final_columns:
            logger.info(f"  - {col['column_name']}: {col['data_type']}")
        
    except Exception as e:
        logger.error(f"Error adding quantity columns: {e}")
        raise
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(add_quantity_columns())