#!/usr/bin/env python3
"""
Add missing value_token column to search_params table.
"""

import asyncio
import asyncpg
import os
import logging

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

async def add_value_token_column():
    """Add missing value_token column to search_params table."""
    
    # Database connection
    DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://emr_user:emr_password@postgres:5432/emr_db')
    
    # Convert to asyncpg format
    if 'postgresql://' in DATABASE_URL:
        DATABASE_URL = DATABASE_URL.replace('postgresql://', 'postgresql+asyncpg://')
    if '+asyncpg' in DATABASE_URL:
        DATABASE_URL = DATABASE_URL.replace('+asyncpg', '')
    
    conn = await asyncpg.connect(DATABASE_URL)
    
    try:
        # Check if column already exists
        existing_columns = await conn.fetch("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'fhir' 
            AND table_name = 'search_params'
            AND column_name = 'value_token'
        """)
        
        if not existing_columns:
            logger.info("Adding value_token column...")
            await conn.execute("""
                ALTER TABLE fhir.search_params 
                ADD COLUMN value_token VARCHAR(255)
            """)
            logger.info("✅ Added value_token column")
            
            # Update existing token search parameters to populate value_token
            logger.info("Populating value_token from value_token_code...")
            await conn.execute("""
                UPDATE fhir.search_params 
                SET value_token = value_token_code 
                WHERE param_type = 'token' 
                AND value_token_code IS NOT NULL 
                AND value_token IS NULL
            """)
            count = await conn.fetchval("""
                SELECT COUNT(*) 
                FROM fhir.search_params 
                WHERE param_type = 'token' 
                AND value_token IS NOT NULL
            """)
            logger.info(f"✅ Updated {count} token search parameters")
            
            # Create index for better performance
            logger.info("Creating index on value_token...")
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_search_params_value_token 
                ON fhir.search_params(param_name, value_token) 
                WHERE value_token IS NOT NULL
            """)
            logger.info("✅ Created index on value_token")
        else:
            logger.info("✓ value_token column already exists")
        
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
        logger.error(f"Error adding value_token column: {e}")
        raise
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(add_value_token_column())